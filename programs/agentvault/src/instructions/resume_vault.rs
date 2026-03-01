use anchor_lang::prelude::*;
use crate::state::{UserVault, VaultStatus};
use crate::errors::AgentVaultError;

#[derive(Accounts)]
pub struct ResumeVault<'info> {
    /// Only the vault owner can resume
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [UserVault::SEED_PREFIX, owner.key().as_ref()],
        bump = vault.bump,
        has_one = owner @ AgentVaultError::UnauthorizedOwner,
    )]
    pub vault: Account<'info, UserVault>,
}

pub fn handler(ctx: Context<ResumeVault>) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    let clock = Clock::get()?;

    require!(
        vault.status == VaultStatus::Halted,
        AgentVaultError::InvalidPolicyConfig
    );

    vault.status = VaultStatus::Active;
    vault.last_activity = clock.unix_timestamp;

    msg!("Vault resumed: {}", vault.key());
    msg!("Agent activity re-enabled.");

    Ok(())
}
