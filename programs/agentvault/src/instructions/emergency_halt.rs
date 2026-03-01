use anchor_lang::prelude::*;
use crate::state::{UserVault, VaultStatus};
use crate::errors::AgentVaultError;

#[derive(Accounts)]
pub struct EmergencyHalt<'info> {
    /// Only the vault owner can trigger emergency halt
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [UserVault::SEED_PREFIX, owner.key().as_ref()],
        bump = vault.bump,
        has_one = owner @ AgentVaultError::UnauthorizedOwner,
    )]
    pub vault: Account<'info, UserVault>,
}

pub fn handler(ctx: Context<EmergencyHalt>) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    let clock = Clock::get()?;

    vault.status = VaultStatus::Halted;
    vault.last_activity = clock.unix_timestamp;

    msg!("EMERGENCY HALT activated for vault: {}", vault.key());
    msg!("All agent activity suspended. User withdrawal still permitted.");

    Ok(())
}
