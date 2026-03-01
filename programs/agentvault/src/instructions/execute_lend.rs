use anchor_lang::prelude::*;
use anchor_lang::solana_program::{instruction::Instruction, program::invoke_signed};
use anchor_spl::token::{Token, TokenAccount};
use crate::state::{UserVault, PolicyConfig};
use crate::errors::AgentVaultError;

/// MarginFi Program ID (v2)
pub const MARGINFI_PROGRAM_ID: Pubkey = pubkey!("MFv2hWf31Z9kbCa1snEPYctwafyhdvnV7FZnsebVacA");

/// Kamino Lending Program ID
pub const KAMINO_PROGRAM_ID: Pubkey = pubkey!("KLend2g3cP87ber41GAmhvH3VPVwWvxTKjkN6nh8VqD");

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq)]
pub enum LendingProtocol {
    MarginFi,
    Kamino,
}

#[derive(Accounts)]
pub struct ExecuteLend<'info> {
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

    /// The vault's token account for the asset being lent
    #[account(
        mut,
        constraint = user_token_account.owner == vault.key() @ AgentVaultError::InvalidTokenAccount,
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    /// CHECK: The lending protocol's liquidity vault
    #[account(mut)]
    pub protocol_liquidity_vault: UncheckedAccount<'info>,

    /// CHECK: User's position/account in the lending protocol
    #[account(mut)]
    pub user_protocol_account: UncheckedAccount<'info>,

    /// CHECK: The lending protocol's group/market account
    pub protocol_group: UncheckedAccount<'info>,

    /// CHECK: The bank/reserve account for this asset
    #[account(mut)]
    pub bank: UncheckedAccount<'info>,

    /// CHECK: Lending protocol program - verified in handler
    pub lending_program: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct LendParams {
    /// Amount of tokens to supply (in smallest units)
    pub amount: u64,
    /// Which lending protocol to use
    pub protocol: LendingProtocol,
}

pub fn handler(ctx: Context<ExecuteLend>, params: LendParams) -> Result<()> {
    let vault = &ctx.accounts.vault;
    let policy = &ctx.accounts.policy;
    let user_token_account = &ctx.accounts.user_token_account;
    let lending_program = &ctx.accounts.lending_program;
    let clock = Clock::get()?;

    // === VERIFY PROTOCOL ===
    
    let expected_program = match params.protocol {
        LendingProtocol::MarginFi => MARGINFI_PROGRAM_ID,
        LendingProtocol::Kamino => KAMINO_PROGRAM_ID,
    };
    
    require!(
        lending_program.key() == expected_program,
        AgentVaultError::InvalidLendingProgram
    );

    // === POLICY CHECKS ===

    // Check lending protocol is in program allowlist
    require!(
        policy.program_allowlist.contains(&lending_program.key()),
        AgentVaultError::ProgramNotAllowed
    );

    // Check asset being lent is in allowlist
    require!(
        policy.asset_allowlist.contains(&user_token_account.mint),
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

    // Check sufficient token balance
    require!(
        user_token_account.amount >= params.amount,
        AgentVaultError::InsufficientBalance
    );

    // === EXECUTE LENDING DEPOSIT VIA CPI ===

    let vault_seeds = &[
        UserVault::SEED_PREFIX,
        vault.owner.as_ref(),
        &[vault.bump],
    ];
    let signer_seeds = &[&vault_seeds[..]];

    match params.protocol {
        LendingProtocol::MarginFi => {
            execute_marginfi_deposit(
                &ctx,
                params.amount,
                signer_seeds,
            )?;
        }
        LendingProtocol::Kamino => {
            execute_kamino_deposit(
                &ctx,
                params.amount,
                signer_seeds,
            )?;
        }
    }

    // === UPDATE STATE ===

    let vault = &mut ctx.accounts.vault;
    vault.last_activity = clock.unix_timestamp;
    vault.tx_count = vault.tx_count.saturating_add(1);

    msg!(
        "Deposited {} tokens to {:?} lending protocol",
        params.amount,
        params.protocol
    );

    Ok(())
}

fn execute_marginfi_deposit<'info>(
    ctx: &Context<'_, '_, '_, 'info, ExecuteLend<'info>>,
    amount: u64,
    signer_seeds: &[&[&[u8]]],
) -> Result<()> {
    // MarginFi lending_account_deposit discriminator
    // Instruction: deposit(amount: u64)
    let discriminator: [u8; 8] = [171, 94, 235, 103, 82, 64, 212, 140];
    
    let mut data = discriminator.to_vec();
    data.extend_from_slice(&amount.to_le_bytes());

    let deposit_ix = Instruction {
        program_id: MARGINFI_PROGRAM_ID,
        accounts: vec![
            AccountMeta::new(ctx.accounts.protocol_group.key(), false),          // marginfi_group
            AccountMeta::new(ctx.accounts.user_protocol_account.key(), false),   // marginfi_account
            AccountMeta::new_readonly(ctx.accounts.vault.key(), true),           // signer
            AccountMeta::new(ctx.accounts.bank.key(), false),                    // bank
            AccountMeta::new(ctx.accounts.user_token_account.key(), false),      // signer_token_account
            AccountMeta::new(ctx.accounts.protocol_liquidity_vault.key(), false),// bank_liquidity_vault
            AccountMeta::new_readonly(ctx.accounts.token_program.key(), false),  // token_program
        ],
        data,
    };

    invoke_signed(
        &deposit_ix,
        &[
            ctx.accounts.protocol_group.to_account_info(),
            ctx.accounts.user_protocol_account.to_account_info(),
            ctx.accounts.vault.to_account_info(),
            ctx.accounts.bank.to_account_info(),
            ctx.accounts.user_token_account.to_account_info(),
            ctx.accounts.protocol_liquidity_vault.to_account_info(),
            ctx.accounts.token_program.to_account_info(),
        ],
        signer_seeds,
    )?;

    Ok(())
}

fn execute_kamino_deposit<'info>(
    ctx: &Context<'_, '_, '_, 'info, ExecuteLend<'info>>,
    amount: u64,
    signer_seeds: &[&[&[u8]]],
) -> Result<()> {
    // Kamino deposit_reserve_liquidity discriminator
    let discriminator: [u8; 8] = [108, 118, 179, 95, 174, 97, 143, 97];
    
    let mut data = discriminator.to_vec();
    data.extend_from_slice(&amount.to_le_bytes());

    let deposit_ix = Instruction {
        program_id: KAMINO_PROGRAM_ID,
        accounts: vec![
            AccountMeta::new_readonly(ctx.accounts.vault.key(), true),           // owner
            AccountMeta::new(ctx.accounts.user_protocol_account.key(), false),   // obligation
            AccountMeta::new(ctx.accounts.protocol_group.key(), false),          // lending_market
            AccountMeta::new(ctx.accounts.bank.key(), false),                    // reserve
            AccountMeta::new(ctx.accounts.protocol_liquidity_vault.key(), false),// reserve_liquidity_supply
            AccountMeta::new(ctx.accounts.user_token_account.key(), false),      // user_source_liquidity
            AccountMeta::new_readonly(ctx.accounts.token_program.key(), false),  // token_program
        ],
        data,
    };

    invoke_signed(
        &deposit_ix,
        &[
            ctx.accounts.vault.to_account_info(),
            ctx.accounts.user_protocol_account.to_account_info(),
            ctx.accounts.protocol_group.to_account_info(),
            ctx.accounts.bank.to_account_info(),
            ctx.accounts.protocol_liquidity_vault.to_account_info(),
            ctx.accounts.user_token_account.to_account_info(),
            ctx.accounts.token_program.to_account_info(),
        ],
        signer_seeds,
    )?;

    Ok(())
}
