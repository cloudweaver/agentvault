use anchor_lang::prelude::*;
use crate::state::{UserVault, StrategyRegistry, StrategySubscription, StrategyStatus};
use crate::errors::AgentVaultError;

#[derive(Accounts)]
pub struct SubscribeStrategy<'info> {
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
        constraint = strategy.status == StrategyStatus::Active @ AgentVaultError::StrategyNotFound,
    )]
    pub strategy: Account<'info, StrategyRegistry>,

    /// Strategy creator receives the subscription fee
    /// CHECK: Validated against strategy.creator
    #[account(
        mut,
        constraint = creator.key() == strategy.creator @ AgentVaultError::UnauthorizedOwner,
    )]
    pub creator: UncheckedAccount<'info>,

    #[account(
        init,
        payer = owner,
        space = StrategySubscription::LEN,
        seeds = [
            StrategySubscription::SEED_PREFIX,
            vault.key().as_ref(),
            strategy.key().as_ref()
        ],
        bump
    )]
    pub subscription: Account<'info, StrategySubscription>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<SubscribeStrategy>) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    let strategy = &mut ctx.accounts.strategy;
    let subscription = &mut ctx.accounts.subscription;
    let clock = Clock::get()?;

    // Transfer subscription fee to creator
    let fee = strategy.subscription_fee;
    if fee > 0 {
        let owner_info = ctx.accounts.owner.to_account_info();
        let creator_info = ctx.accounts.creator.to_account_info();

        **owner_info.try_borrow_mut_lamports()? = owner_info
            .lamports()
            .checked_sub(fee)
            .ok_or(AgentVaultError::InsufficientBalance)?;
        
        **creator_info.try_borrow_mut_lamports()? = creator_info
            .lamports()
            .checked_add(fee)
            .ok_or(AgentVaultError::ArithmeticOverflow)?;

        strategy.total_revenue = strategy.total_revenue.saturating_add(fee);
    }

    // Initialize subscription
    subscription.vault = vault.key();
    subscription.strategy = strategy.key();
    subscription.subscribed_at = clock.unix_timestamp;
    subscription.is_active = true;
    subscription.cumulative_pnl_bps = 0;
    subscription.fees_paid = fee;
    subscription.bump = ctx.bumps.subscription;

    // Update strategy stats
    strategy.subscriber_count = strategy.subscriber_count.saturating_add(1);

    // Update vault
    vault.last_activity = clock.unix_timestamp;

    msg!("Subscribed to strategy: {}", strategy.key());
    msg!("Fee paid: {} lamports", fee);

    Ok(())
}
