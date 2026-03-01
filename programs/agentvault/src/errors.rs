use anchor_lang::prelude::*;

#[error_code]
pub enum AgentVaultError {
    #[msg("Unauthorized: Only the vault owner can perform this action")]
    UnauthorizedOwner,

    #[msg("Unauthorized: Only the vault agent can perform this action")]
    UnauthorizedAgent,

    #[msg("Vault is currently halted - emergency stop is active")]
    VaultHalted,

    #[msg("Transaction amount exceeds per-transaction limit")]
    TransactionLimitExceeded,

    #[msg("Daily spending limit exceeded")]
    DailyLimitExceeded,

    #[msg("Asset not in allowlist")]
    AssetNotAllowed,

    #[msg("Program not in allowlist")]
    ProgramNotAllowed,

    #[msg("Slippage exceeds maximum allowed")]
    SlippageExceeded,

    #[msg("Insufficient vault balance")]
    InsufficientBalance,

    #[msg("Policy hash mismatch - sync required")]
    PolicyHashMismatch,

    #[msg("Invalid policy configuration")]
    InvalidPolicyConfig,

    #[msg("Strategy already registered")]
    StrategyAlreadyExists,

    #[msg("Strategy not found")]
    StrategyNotFound,

    #[msg("Already subscribed to this strategy")]
    AlreadySubscribed,

    #[msg("Invalid subscription fee")]
    InvalidSubscriptionFee,

    #[msg("Performance fee too high (max 50%)")]
    PerformanceFeeTooHigh,

    #[msg("Invalid metadata URI")]
    InvalidMetadataUri,

    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,

    #[msg("Invalid epoch for performance recording")]
    InvalidEpoch,
}
