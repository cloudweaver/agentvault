use anchor_lang::prelude::*;
use anchor_lang::solana_program::{instruction::Instruction, program::invoke_signed};
use anchor_spl::token::{Token, TokenAccount, Mint};
use crate::state::{UserVault, PolicyConfig};
use crate::errors::AgentVaultError;

/// Marinade Finance Program ID
pub const MARINADE_PROGRAM_ID: Pubkey = pubkey!("MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD");

/// mSOL Token Mint
pub const MSOL_MINT: Pubkey = pubkey!("mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So");

#[derive(Accounts)]
pub struct ExecuteStake<'info> {
    /// The agent delegate signing the transaction
    pub agent: Signer<'info>,

    #[account(
        mut,
        seeds = [UserVault::SEED_PREFIX, vault.owner.as_ref()],
        bump = vault.bump,
        constraint = vault.agent == agent.key() @ AgentVaultError::UnauthorizedAgent,
        constraint = vault.is_active() @ AgentVaultError::VaultHalted,
    )]
    pub vault: Account<'info, UserVault>,

    #[account(
        seeds = [PolicyConfig::SEED_PREFIX, vault.key().as_ref()],
        bump = policy.bump,
        has_one = vault,
    )]
    pub policy: Account<'info, PolicyConfig>,

    /// The vault's mSOL token account to receive staked tokens
    #[account(
        mut,
        constraint = msol_token_account.owner == vault.key() @ AgentVaultError::InvalidTokenAccount,
        constraint = msol_token_account.mint == MSOL_MINT @ AgentVaultError::InvalidTokenAccount,
    )]
    pub msol_token_account: Account<'info, TokenAccount>,

    /// CHECK: Marinade state account
    #[account(mut)]
    pub marinade_state: UncheckedAccount<'info>,

    /// CHECK: mSOL mint authority (PDA of Marinade)
    pub msol_mint_authority: UncheckedAccount<'info>,

    /// CHECK: Marinade reserve PDA
    #[account(mut)]
    pub reserve_pda: UncheckedAccount<'info>,

    /// CHECK: Marinade program - verified by address constraint
    #[account(
        constraint = marinade_program.key() == MARINADE_PROGRAM_ID @ AgentVaultError::InvalidMarinadeProgram,
    )]
    pub marinade_program: UncheckedAccount<'info>,

    #[account(
        mut,
        constraint = msol_mint.key() == MSOL_MINT @ AgentVaultError::InvalidTokenAccount,
    )]
    pub msol_mint: Account<'info, Mint>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct StakeParams {
    /// Amount of SOL (in lamports) to stake
    pub amount: u64,
}

pub fn handler(ctx: Context<ExecuteStake>, params: StakeParams) -> Result<()> {
    let vault = &ctx.accounts.vault;
    let policy = &ctx.accounts.policy;
    let clock = Clock::get()?;

    // === POLICY CHECKS ===

    // Check Marinade is in program allowlist
    require!(
        policy.program_allowlist.contains(&MARINADE_PROGRAM_ID),
        AgentVaultError::ProgramNotAllowed
    );

    // Check mSOL is in asset allowlist (output token)
    require!(
        policy.asset_allowlist.contains(&MSOL_MINT),
        AgentVaultError::AssetNotAllowed
    );

    // Check transaction spending limit
    require!(
        params.amount <= policy.tx_limit,
        AgentVaultError::TransactionLimitExceeded
    );

    // Check daily limit (with reset logic)
    let mut daily_spent = policy.daily_spent;
    if policy.is_new_day(clock.unix_timestamp) {
        daily_spent = 0;
    }
    require!(
        daily_spent.saturating_add(params.amount) <= policy.daily_limit,
        AgentVaultError::DailyLimitExceeded
    );

    // Check vault has sufficient SOL balance
    require!(
        vault.balance >= params.amount,
        AgentVaultError::InsufficientBalance
    );

    // === EXECUTE MARINADE STAKE VIA CPI ===

    let vault_seeds = &[
        UserVault::SEED_PREFIX,
        vault.owner.as_ref(),
        &[vault.bump],
    ];
    let signer_seeds = &[&vault_seeds[..]];

    // Marinade deposit instruction discriminator: [242, 35, 198, 137, 82, 225, 242, 182]
    let deposit_discriminator: [u8; 8] = [242, 35, 198, 137, 82, 225, 242, 182];
    
    let mut data = deposit_discriminator.to_vec();
    data.extend_from_slice(&params.amount.to_le_bytes());

    let marinade_ix = Instruction {
        program_id: MARINADE_PROGRAM_ID,
        accounts: vec![
            AccountMeta::new(ctx.accounts.marinade_state.key(), false),
            AccountMeta::new(ctx.accounts.msol_mint.key(), false),
            AccountMeta::new_readonly(ctx.accounts.msol_mint_authority.key(), false),
            AccountMeta::new(ctx.accounts.reserve_pda.key(), false),
            AccountMeta::new(vault.key(), true), // transfer_from (signer)
            AccountMeta::new(ctx.accounts.msol_token_account.key(), false),
            AccountMeta::new_readonly(ctx.accounts.token_program.key(), false),
            AccountMeta::new_readonly(ctx.accounts.system_program.key(), false),
        ],
        data,
    };

    invoke_signed(
        &marinade_ix,
        &[
            ctx.accounts.marinade_state.to_account_info(),
            ctx.accounts.msol_mint.to_account_info(),
            ctx.accounts.msol_mint_authority.to_account_info(),
            ctx.accounts.reserve_pda.to_account_info(),
            ctx.accounts.vault.to_account_info(),
            ctx.accounts.msol_token_account.to_account_info(),
            ctx.accounts.token_program.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
        ],
        signer_seeds,
    )?;

    // === UPDATE STATE ===
    
    let vault = &mut ctx.accounts.vault;
    vault.balance = vault.balance.saturating_sub(params.amount);
    vault.last_activity = clock.unix_timestamp;
    vault.tx_count = vault.tx_count.saturating_add(1);

    msg!(
        "Staked {} lamports via Marinade | new vault balance: {}",
        params.amount,
        vault.balance
    );

    Ok(())
}
