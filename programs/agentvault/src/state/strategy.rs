use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Default)]
pub enum StrategyStatus {
    #[default]
    Active,
    Paused,
    Deprecated,
}

#[account]
#[derive(Default)]
pub struct StrategyRegistry {
    /// Creator of this strategy
    pub creator: Pubkey,
    
    /// Unique strategy identifier (hash)
    pub strategy_id: [u8; 32],
    
    /// URI to off-chain metadata (IPFS/Arweave)
    pub metadata_uri: String,
    
    /// One-time subscription fee in lamports
    pub subscription_fee: u64,
    
    /// Performance fee in basis points (max 5000 = 50%)
    pub performance_fee_bps: u16,
    
    /// Number of active subscribers
    pub subscriber_count: u32,
    
    /// Total revenue earned in lamports
    pub total_revenue: u64,
    
    /// Strategy status
    pub status: StrategyStatus,
    
    /// Timestamp when strategy was registered
    pub created_at: i64,
    
    /// Bump seed for PDA derivation
    pub bump: u8,
}

impl StrategyRegistry {
    pub const LEN: usize = 8 +  // discriminator
        32 +  // creator
        32 +  // strategy_id
        4 + 200 +  // metadata_uri (max 200 chars)
        8 +   // subscription_fee
        2 +   // performance_fee_bps
        4 +   // subscriber_count
        8 +   // total_revenue
        1 +   // status
        8 +   // created_at
        1 +   // bump
        64;   // padding

    pub const SEED_PREFIX: &'static [u8] = b"strategy";
    pub const MAX_PERFORMANCE_FEE_BPS: u16 = 5000; // 50%
    pub const MAX_METADATA_URI_LEN: usize = 200;
}

#[account]
#[derive(Default)]
pub struct StrategySubscription {
    /// The vault subscribing to the strategy
    pub vault: Pubkey,
    
    /// The strategy being subscribed to
    pub strategy: Pubkey,
    
    /// Timestamp when subscription started
    pub subscribed_at: i64,
    
    /// Whether subscription is active
    pub is_active: bool,
    
    /// Cumulative PnL since subscription (in basis points)
    pub cumulative_pnl_bps: i32,
    
    /// Performance fees paid in lamports
    pub fees_paid: u64,
    
    /// Bump seed for PDA derivation
    pub bump: u8,
}

impl StrategySubscription {
    pub const LEN: usize = 8 +  // discriminator
        32 +  // vault
        32 +  // strategy
        8 +   // subscribed_at
        1 +   // is_active
        4 +   // cumulative_pnl_bps
        8 +   // fees_paid
        1 +   // bump
        32;   // padding

    pub const SEED_PREFIX: &'static [u8] = b"subscription";
}
