use anchor_lang::prelude::*;
use crate::state::UserVault;
use crate::errors::AgentVaultError;

#[derive(Accounts)]
pub struct Withdraw<'info> {
    /// Only the vault owner can withdraw
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [UserVault::SEED_PREFIX, owner.key().as_ref()],
        bump = vault.bump,
        has_one = owner @ AgentVaultError::UnauthorizedOwner,
    )]
    pub vault: Account<'info, UserVault>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    let clock = Clock::get()?;

    // Check vault balance
    require!(
        vault.balance >= amount,
        AgentVaultError::InsufficientBalance
    );

    // Transfer SOL from vault PDA to owner
    let vault_info = vault.to_account_info();
    let owner_info = ctx.accounts.owner.to_account_info();

    **vault_info.try_borrow_mut_lamports()? = vault_info
        .lamports()
        .checked_sub(amount)
        .ok_or(AgentVaultError::ArithmeticOverflow)?;
    
    **owner_info.try_borrow_mut_lamports()? = owner_info
        .lamports()
        .checked_add(amount)
        .ok_or(AgentVaultError::ArithmeticOverflow)?;

    // Update state
    vault.balance = vault.balance.saturating_sub(amount);
    vault.total_withdrawn = vault.total_withdrawn.saturating_add(amount);
    vault.last_activity = clock.unix_timestamp;

    msg!("Withdrawal: {} lamports to {}", amount, ctx.accounts.owner.key());

    Ok(())
}
