use anchor_lang::prelude::*;

#[account]
#[derive(Default)]
pub struct PolicyConfig {
    /// The vault this policy belongs to
    pub vault: Pubkey,
    
    /// Maximum SOL per transaction (in lamports)
    pub tx_limit: u64,
    
    /// Maximum SOL per day (in lamports)
    pub daily_limit: u64,
    
    /// Amount spent today (resets at midnight UTC)
    pub daily_spent: u64,
    
    /// Last reset timestamp (for daily limit)
    pub last_reset: i64,
    
    /// Maximum slippage in basis points (100 = 1%)
    pub max_slippage_bps: u16,
    
    /// Whether agent can auto-execute without approval
    pub auto_execute: bool,
    
    /// Bump seed for PDA derivation
    pub bump: u8,
}

impl PolicyConfig {
    pub const LEN: usize = 8 +  // discriminator
        32 +  // vault
        8 +   // tx_limit
        8 +   // daily_limit
        8 +   // daily_spent
        8 +   // last_reset
        2 +   // max_slippage_bps
        1 +   // auto_execute
        1 +   // bump
        64;   // padding

    pub const SEED_PREFIX: &'static [u8] = b"policy";

    /// Check if a transaction amount is within limits
    pub fn check_limits(&self, amount: u64, current_timestamp: i64) -> Result<bool> {
        // Check per-transaction limit
        if amount > self.tx_limit {
            return Ok(false);
        }

        // Check daily limit (reset if new day)
        let daily_spent = if self.is_new_day(current_timestamp) {
            0
        } else {
            self.daily_spent
        };

        if daily_spent.saturating_add(amount) > self.daily_limit {
            return Ok(false);
        }

        Ok(true)
    }

    /// Check if it's a new day since last reset
    pub fn is_new_day(&self, current_timestamp: i64) -> bool {
        const SECONDS_PER_DAY: i64 = 86400;
        (current_timestamp / SECONDS_PER_DAY) > (self.last_reset / SECONDS_PER_DAY)
    }
}

/// Off-chain policy allowlists (stored as hashes on-chain)
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Default)]
pub struct PolicyAllowlists {
    /// Allowed token mints
    pub asset_allowlist: Vec<Pubkey>,
    
    /// Allowed program IDs
    pub program_allowlist: Vec<Pubkey>,
}
