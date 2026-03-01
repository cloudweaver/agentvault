use anchor_lang::prelude::*;

#[account]
#[derive(Default)]
pub struct PerformanceLog {
    /// The strategy this performance log belongs to
    pub strategy: Pubkey,
    
    /// Epoch number for this snapshot
    pub epoch: u64,
    
    /// PnL for this epoch in basis points
    pub epoch_pnl_bps: i32,
    
    /// Cumulative PnL since strategy creation
    pub cumulative_pnl_bps: i32,
    
    /// Maximum drawdown observed (basis points)
    pub max_drawdown_bps: i32,
    
    /// Number of trades executed
    pub trade_count: u32,
    
    /// Win rate in basis points (5000 = 50%)
    pub win_rate_bps: u16,
    
    /// Timestamp of this snapshot
    pub recorded_at: i64,
    
    /// Bump seed for PDA derivation
    pub bump: u8,
}

impl PerformanceLog {
    pub const LEN: usize = 8 +  // discriminator
        32 +  // strategy
        8 +   // epoch
        4 +   // epoch_pnl_bps
        4 +   // cumulative_pnl_bps
        4 +   // max_drawdown_bps
        4 +   // trade_count
        2 +   // win_rate_bps
        8 +   // recorded_at
        1 +   // bump
        32;   // padding

    pub const SEED_PREFIX: &'static [u8] = b"perf";
}

/// Aggregated strategy statistics (computed off-chain, verified on-chain)
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Default)]
pub struct StrategyStats {
    /// Total return since inception (basis points)
    pub total_return_bps: i32,
    
    /// Sharpe ratio * 100 (e.g., 150 = 1.5 Sharpe)
    pub sharpe_ratio_x100: i16,
    
    /// Maximum drawdown (basis points)
    pub max_drawdown_bps: i32,
    
    /// Average trade size in lamports
    pub avg_trade_size: u64,
    
    /// Total volume traded in lamports
    pub total_volume: u64,
    
    /// Number of profitable trades
    pub winning_trades: u32,
    
    /// Number of losing trades  
    pub losing_trades: u32,
}
