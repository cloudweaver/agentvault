use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Default)]
pub enum VaultStatus {
    #[default]
    Active,
    Paused,
    Halted,
}

#[account]
#[derive(Default)]
pub struct UserVault {
    /// The owner of this vault (user's main wallet)
    pub owner: Pubkey,
    
    /// The agent delegate keypair authorized to execute trades
    pub agent: Pubkey,
    
    /// Hash of the current policy configuration
    pub policy_hash: [u8; 32],
    
    /// Current SOL balance in the vault
    pub balance: u64,
    
    /// Total SOL deposited lifetime
    pub total_deposited: u64,
    
    /// Total SOL withdrawn lifetime
    pub total_withdrawn: u64,
    
    /// Current status of the vault
    pub status: VaultStatus,
    
    /// Timestamp when vault was created
    pub created_at: i64,
    
    /// Last activity timestamp
    pub last_activity: i64,
    
    /// Number of transactions executed
    pub tx_count: u64,
    
    /// Bump seed for PDA derivation
    pub bump: u8,
}

impl UserVault {
    pub const LEN: usize = 8 +  // discriminator
        32 +  // owner
        32 +  // agent
        32 +  // policy_hash
        8 +   // balance
        8 +   // total_deposited
        8 +   // total_withdrawn
        1 +   // status
        8 +   // created_at
        8 +   // last_activity
        8 +   // tx_count
        1 +   // bump
        64;   // padding for future fields

    pub const SEED_PREFIX: &'static [u8] = b"vault";

    pub fn is_active(&self) -> bool {
        self.status == VaultStatus::Active
    }

    pub fn is_halted(&self) -> bool {
        self.status == VaultStatus::Halted
    }
}
