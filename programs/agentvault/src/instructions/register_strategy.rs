use anchor_lang::prelude::*;
use crate::state::{StrategyRegistry, StrategyStatus};
use crate::errors::AgentVaultError;

#[derive(Accounts)]
#[instruction(strategy_id: [u8; 32])]
pub struct RegisterStrategy<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        init,
        payer = creator,
        space = StrategyRegistry::LEN,
        seeds = [StrategyRegistry::SEED_PREFIX, creator.key().as_ref(), &strategy_id],
        bump
    )]
    pub strategy: Account<'info, StrategyRegistry>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<RegisterStrategy>,
    strategy_id: [u8; 32],
    metadata_uri: String,
    subscription_fee: u64,
    performance_fee_bps: u16,
) -> Result<()> {
    let strategy = &mut ctx.accounts.strategy;
    let clock = Clock::get()?;

    // Validate inputs
    require!(
        metadata_uri.len() <= StrategyRegistry::MAX_METADATA_URI_LEN,
        AgentVaultError::InvalidMetadataUri
    );
    require!(
        performance_fee_bps <= StrategyRegistry::MAX_PERFORMANCE_FEE_BPS,
        AgentVaultError::PerformanceFeeTooHigh
    );

    // Initialize strategy
    strategy.creator = ctx.accounts.creator.key();
    strategy.strategy_id = strategy_id;
    strategy.metadata_uri = metadata_uri;
    strategy.subscription_fee = subscription_fee;
    strategy.performance_fee_bps = performance_fee_bps;
    strategy.subscriber_count = 0;
    strategy.total_revenue = 0;
    strategy.status = StrategyStatus::Active;
    strategy.created_at = clock.unix_timestamp;
    strategy.bump = ctx.bumps.strategy;

    msg!("Strategy registered: {:?}", strategy_id);
    msg!("Creator: {}", strategy.creator);
    msg!("Subscription fee: {} lamports", subscription_fee);

    Ok(())
}
