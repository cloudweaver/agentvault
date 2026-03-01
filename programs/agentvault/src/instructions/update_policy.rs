use anchor_lang::prelude::*;
use crate::state::{UserVault, PolicyConfig};
use crate::errors::AgentVaultError;

#[derive(Accounts)]
pub struct UpdatePolicy<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [UserVault::SEED_PREFIX, owner.key().as_ref()],
        bump = vault.bump,
        has_one = owner @ AgentVaultError::UnauthorizedOwner,
    )]
    pub vault: Account<'info, UserVault>,

    #[account(
        mut,
        seeds = [PolicyConfig::SEED_PREFIX, vault.key().as_ref()],
        bump = policy.bump,
        has_one = vault,
    )]
    pub policy: Account<'info, PolicyConfig>,
}

pub fn handler(
    ctx: Context<UpdatePolicy>,
    new_policy_hash: [u8; 32],
    daily_limit: u64,
    tx_limit: u64,
    max_slippage_bps: u16,
    auto_execute: bool,
) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    let policy = &mut ctx.accounts.policy;
    let clock = Clock::get()?;

    // Validate policy configuration
    require!(
        tx_limit <= daily_limit,
        AgentVaultError::InvalidPolicyConfig
    );
    require!(
        max_slippage_bps <= 1000, // Max 10% slippage
        AgentVaultError::InvalidPolicyConfig
    );

    // Update vault policy hash
    vault.policy_hash = new_policy_hash;
    vault.last_activity = clock.unix_timestamp;

    // Update policy config
    policy.daily_limit = daily_limit;
    policy.tx_limit = tx_limit;
    policy.max_slippage_bps = max_slippage_bps;
    policy.auto_execute = auto_execute;

    msg!("Policy updated for vault: {}", vault.key());
    msg!("New daily limit: {} lamports", daily_limit);
    msg!("New tx limit: {} lamports", tx_limit);

    Ok(())
}
