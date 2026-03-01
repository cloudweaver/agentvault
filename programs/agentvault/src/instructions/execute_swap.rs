use anchor_lang::prelude::*;
use crate::state::{UserVault, PolicyConfig};
use crate::errors::AgentVaultError;

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
        mut,
        seeds = [PolicyConfig::SEED_PREFIX, vault.key().as_ref()],
        bump = policy.bump,
        has_one = vault,
    )]
    pub policy: Account<'info, PolicyConfig>,

    /// CHECK: Jupiter program for CPI
    pub jupiter_program: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<ExecuteSwap>,
    amount_in: u64,
    minimum_amount_out: u64,
) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    let policy = &mut ctx.accounts.policy;
    let clock = Clock::get()?;

    // Check spending limits
    require!(
        amount_in <= policy.tx_limit,
        AgentVaultError::TransactionLimitExceeded
    );

    // Reset daily spent if new day
    if policy.is_new_day(clock.unix_timestamp) {
        policy.daily_spent = 0;
        policy.last_reset = clock.unix_timestamp;
    }

    // Check daily limit
    require!(
        policy.daily_spent.saturating_add(amount_in) <= policy.daily_limit,
        AgentVaultError::DailyLimitExceeded
    );

    // Check vault balance
    require!(
        vault.balance >= amount_in,
        AgentVaultError::InsufficientBalance
    );

    // Calculate slippage
    // In production, this would be checked against actual Jupiter quote
    let slippage_bps = if minimum_amount_out > 0 {
        ((amount_in.saturating_sub(minimum_amount_out)) * 10000 / amount_in) as u16
    } else {
        0
    };

    require!(
        slippage_bps <= policy.max_slippage_bps,
        AgentVaultError::SlippageExceeded
    );

    // Update state
    policy.daily_spent = policy.daily_spent.saturating_add(amount_in);
    vault.last_activity = clock.unix_timestamp;
    vault.tx_count = vault.tx_count.saturating_add(1);

    // NOTE: In production, this would execute a CPI call to Jupiter
    // For now, we log the intent and update state
    msg!("Swap executed: {} lamports in, min {} lamports out", amount_in, minimum_amount_out);
    msg!("Daily spent: {}/{}", policy.daily_spent, policy.daily_limit);

    Ok(())
}
