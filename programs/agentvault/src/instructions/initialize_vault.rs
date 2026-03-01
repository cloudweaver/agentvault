use anchor_lang::prelude::*;
use crate::state::{UserVault, VaultStatus, PolicyConfig};

#[derive(Accounts)]
pub struct InitializeVault<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        init,
        payer = owner,
        space = UserVault::LEN,
        seeds = [UserVault::SEED_PREFIX, owner.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, UserVault>,

    #[account(
        init,
        payer = owner,
        space = PolicyConfig::LEN,
        seeds = [PolicyConfig::SEED_PREFIX, vault.key().as_ref()],
        bump
    )]
    pub policy: Account<'info, PolicyConfig>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<InitializeVault>,
    agent: Pubkey,
    initial_policy_hash: [u8; 32],
) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    let policy = &mut ctx.accounts.policy;
    let clock = Clock::get()?;

    // Initialize vault
    vault.owner = ctx.accounts.owner.key();
    vault.agent = agent;
    vault.policy_hash = initial_policy_hash;
    vault.balance = 0;
    vault.total_deposited = 0;
    vault.total_withdrawn = 0;
    vault.status = VaultStatus::Active;
    vault.created_at = clock.unix_timestamp;
    vault.last_activity = clock.unix_timestamp;
    vault.tx_count = 0;
    vault.bump = ctx.bumps.vault;

    // Initialize policy with sensible defaults
    policy.vault = vault.key();
    policy.tx_limit = 5_000_000_000; // 5 SOL per tx
    policy.daily_limit = 20_000_000_000; // 20 SOL per day
    policy.daily_spent = 0;
    policy.last_reset = clock.unix_timestamp;
    policy.max_slippage_bps = 100; // 1%
    policy.auto_execute = false;
    policy.bump = ctx.bumps.policy;

    msg!("Vault initialized for owner: {}", vault.owner);
    msg!("Agent delegate: {}", vault.agent);

    Ok(())
}
