use anchor_lang::prelude::*;
use anchor_lang::solana_program::{instruction::Instruction, program::invoke_signed};
use anchor_spl::token::{Token, TokenAccount};
use crate::state::{UserVault, PolicyConfig};
use crate::errors::AgentVaultError;

/// Jupiter V6 Program ID
pub const JUPITER_V6_PROGRAM_ID: Pubkey = pubkey!("JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4");

#[derive(Accounts)]
pub struct ExecuteSwap<'info> {
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

    /// The vault's token account for the input token
    #[account(
        mut,
        constraint = input_token_account.owner == vault.key() @ AgentVaultError::InvalidTokenAccount,
    )]
    pub input_token_account: Account<'info, TokenAccount>,

    /// The vault's token account for the output token
    #[account(
        mut,
        constraint = output_token_account.owner == vault.key() @ AgentVaultError::InvalidTokenAccount,
    )]
    pub output_token_account: Account<'info, TokenAccount>,

    /// CHECK: Jupiter program - verified by address constraint
    #[account(
        constraint = jupiter_program.key() == JUPITER_V6_PROGRAM_ID @ AgentVaultError::InvalidJupiterProgram,
    )]
    pub jupiter_program: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct SwapParams {
    /// Amount of input tokens to swap
    pub amount_in: u64,
    /// Minimum output tokens expected (slippage protection)
    pub minimum_amount_out: u64,
    /// Jupiter route data (serialized from Jupiter API)
    pub route_data: Vec<u8>,
}

pub fn handler(ctx: Context<ExecuteSwap>, params: SwapParams) -> Result<()> {
    let vault = &ctx.accounts.vault;
    let policy = &ctx.accounts.policy;
    let input_token_account = &ctx.accounts.input_token_account;
    let clock = Clock::get()?;

    // === POLICY CHECKS ===

    // Check input token is in allowlist
    require!(
        policy.asset_allowlist.contains(&input_token_account.mint),
        AgentVaultError::AssetNotAllowed
    );

    // Check output token is in allowlist
    require!(
        policy.asset_allowlist.contains(&ctx.accounts.output_token_account.mint),
        AgentVaultError::AssetNotAllowed
    );

    // Check Jupiter is in program allowlist
    require!(
        policy.program_allowlist.contains(&JUPITER_V6_PROGRAM_ID),
        AgentVaultError::ProgramNotAllowed
    );

    // Check transaction spending limit
    require!(
        params.amount_in <= policy.tx_limit,
        AgentVaultError::TransactionLimitExceeded
    );

    // Check daily limit (with reset logic)
    let mut daily_spent = policy.daily_spent;
    if policy.is_new_day(clock.unix_timestamp) {
        daily_spent = 0;
    }
    require!(
        daily_spent.saturating_add(params.amount_in) <= policy.daily_limit,
        AgentVaultError::DailyLimitExceeded
    );

    // Check slippage bounds
    let slippage_bps = calculate_slippage_bps(params.amount_in, params.minimum_amount_out);
    require!(
        slippage_bps <= policy.max_slippage_bps,
        AgentVaultError::SlippageExceeded
    );

    // Check sufficient balance
    require!(
        input_token_account.amount >= params.amount_in,
        AgentVaultError::InsufficientBalance
    );

    // === EXECUTE JUPITER SWAP VIA CPI ===
    
    let vault_seeds = &[
        UserVault::SEED_PREFIX,
        vault.owner.as_ref(),
        &[vault.bump],
    ];
    let signer_seeds = &[&vault_seeds[..]];

    // Build Jupiter swap instruction from route data
    // Jupiter expects the route data to contain all necessary account metas
    let jupiter_ix = build_jupiter_instruction(
        &ctx.accounts.jupiter_program.key(),
        &params.route_data,
        &ctx.remaining_accounts,
    )?;

    // Execute CPI to Jupiter
    invoke_signed(
        &jupiter_ix,
        &ctx.remaining_accounts.iter().map(|a| a.to_account_info()).collect::<Vec<_>>(),
        signer_seeds,
    )?;

    // === UPDATE STATE ===
    
    let vault = &mut ctx.accounts.vault.to_account_info();
    let mut vault_data = UserVault::try_from_slice(&vault.data.borrow())?;
    vault_data.last_activity = clock.unix_timestamp;
    vault_data.tx_count = vault_data.tx_count.saturating_add(1);

    msg!(
        "Swap executed: {} -> min {} | slippage: {}bps",
        params.amount_in,
        params.minimum_amount_out,
        slippage_bps
    );

    Ok(())
}

/// Calculate slippage in basis points
fn calculate_slippage_bps(amount_in: u64, minimum_out: u64) -> u16 {
    if minimum_out == 0 || amount_in == 0 {
        return 10000; // 100% slippage if no minimum
    }
    // This is a simplified calculation - in production you'd use price oracles
    // to determine the expected output and compare against minimum
    ((amount_in.saturating_sub(minimum_out)) * 10000 / amount_in) as u16
}

/// Build a Jupiter instruction from serialized route data
fn build_jupiter_instruction(
    program_id: &Pubkey,
    route_data: &[u8],
    remaining_accounts: &[AccountInfo],
) -> Result<Instruction> {
    // Jupiter route data contains:
    // - The instruction discriminator
    // - Swap parameters
    // - Route information
    
    // Build account metas from remaining accounts
    let account_metas: Vec<_> = remaining_accounts
        .iter()
        .map(|acc| {
            if acc.is_writable {
                AccountMeta::new(*acc.key, acc.is_signer)
            } else {
                AccountMeta::new_readonly(*acc.key, acc.is_signer)
            }
        })
        .collect();

    Ok(Instruction {
        program_id: *program_id,
        accounts: account_metas,
        data: route_data.to_vec(),
    })
}
