use anchor_lang::prelude::*;
use crate::state::{UserVault, PolicyConfig};
use crate::errors::AgentVaultError;

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
        mut,
        seeds = [PolicyConfig::SEED_PREFIX, vault.key().as_ref()],
        bump = policy.bump,
        has_one = vault,
    )]
    pub policy: Account<'info, PolicyConfig>,

    /// CHECK: Marinade or other staking program
    pub staking_program: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<ExecuteStake>, amount: u64) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    let policy = &mut ctx.accounts.policy;
    let clock = Clock::get()?;

    // Check spending limits
    require!(
        amount <= policy.tx_limit,
        AgentVaultError::TransactionLimitExceeded
    );

    // Reset daily spent if new day
    if policy.is_new_day(clock.unix_timestamp) {
        policy.daily_spent = 0;
        policy.last_reset = clock.unix_timestamp;
    }

    // Check daily limit
    require!(
        policy.daily_spent.saturating_add(amount) <= policy.daily_limit,
        AgentVaultError::DailyLimitExceeded
    );

    // Check vault balance
    require!(
        vault.balance >= amount,
        AgentVaultError::InsufficientBalance
    );

    // Update state
    policy.daily_spent = policy.daily_spent.saturating_add(amount);
    vault.last_activity = clock.unix_timestamp;
    vault.tx_count = vault.tx_count.saturating_add(1);

    // NOTE: In production, this would execute a CPI call to Marinade/Lido
    msg!("Stake executed: {} lamports", amount);

    Ok(())
}
