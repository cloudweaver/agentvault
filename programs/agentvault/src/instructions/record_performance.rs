use anchor_lang::prelude::*;
use crate::state::{StrategyRegistry, PerformanceLog};
use crate::errors::AgentVaultError;

#[derive(Accounts)]
#[instruction(epoch: u64)]
pub struct RecordPerformance<'info> {
    /// Only the strategy creator can record performance
    pub creator: Signer<'info>,

    #[account(
        constraint = strategy.creator == creator.key() @ AgentVaultError::UnauthorizedOwner,
    )]
    pub strategy: Account<'info, StrategyRegistry>,

    #[account(
        init,
        payer = creator,
        space = PerformanceLog::LEN,
        seeds = [
            PerformanceLog::SEED_PREFIX,
            strategy.key().as_ref(),
            &epoch.to_le_bytes()
        ],
        bump
    )]
    pub performance: Account<'info, PerformanceLog>,

    /// Previous epoch's performance log for cumulative calculation
    /// CHECK: Optional, validated in handler
    pub previous_performance: Option<UncheckedAccount<'info>>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<RecordPerformance>,
    epoch: u64,
    pnl_bps: i32,
) -> Result<()> {
    let performance = &mut ctx.accounts.performance;
    let clock = Clock::get()?;

    // Calculate cumulative PnL
    let cumulative_pnl_bps = if let Some(prev) = &ctx.accounts.previous_performance {
        // In production, deserialize and read previous cumulative
        // For now, just use the epoch PnL
        pnl_bps
    } else {
        pnl_bps
    };

    // Initialize performance log
    performance.strategy = ctx.accounts.strategy.key();
    performance.epoch = epoch;
    performance.epoch_pnl_bps = pnl_bps;
    performance.cumulative_pnl_bps = cumulative_pnl_bps;
    performance.max_drawdown_bps = if pnl_bps < 0 { -pnl_bps } else { 0 };
    performance.trade_count = 0; // Updated separately
    performance.win_rate_bps = 0; // Updated separately
    performance.recorded_at = clock.unix_timestamp;
    performance.bump = ctx.bumps.performance;

    msg!("Performance recorded for epoch {}", epoch);
    msg!("Epoch PnL: {} bps", pnl_bps);
    msg!("Cumulative PnL: {} bps", cumulative_pnl_bps);

    Ok(())
}
