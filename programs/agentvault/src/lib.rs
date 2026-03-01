use anchor_lang::prelude::*;

pub mod errors;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("AgVt1111111111111111111111111111111111111111");

#[program]
pub mod agentvault {
    use super::*;

    /// Initialize a new user vault with an agent delegate
    pub fn initialize_vault(
        ctx: Context<InitializeVault>,
        agent: Pubkey,
        initial_policy_hash: [u8; 32],
    ) -> Result<()> {
        instructions::initialize_vault::handler(ctx, agent, initial_policy_hash)
    }

    /// Update the policy configuration for a vault
    pub fn update_policy(
        ctx: Context<UpdatePolicy>,
        new_policy_hash: [u8; 32],
        daily_limit: u64,
        tx_limit: u64,
        max_slippage_bps: u16,
        auto_execute: bool,
    ) -> Result<()> {
        instructions::update_policy::handler(
            ctx,
            new_policy_hash,
            daily_limit,
            tx_limit,
            max_slippage_bps,
            auto_execute,
        )
    }

    /// Execute a token swap via Jupiter (agent-signed)
    pub fn execute_swap(
        ctx: Context<ExecuteSwap>,
        params: instructions::execute_swap::SwapParams,
    ) -> Result<()> {
        instructions::execute_swap::handler(ctx, params)
    }

    /// Stake SOL to a liquid staking protocol (agent-signed)
    pub fn execute_stake(
        ctx: Context<ExecuteStake>,
        params: instructions::execute_stake::StakeParams,
    ) -> Result<()> {
        instructions::execute_stake::handler(ctx, params)
    }

    /// Supply assets to a lending protocol (agent-signed)
    pub fn execute_lend(
        ctx: Context<ExecuteLend>,
        params: instructions::execute_lend::LendParams,
    ) -> Result<()> {
        instructions::execute_lend::handler(ctx, params)
    }

    /// Withdraw funds from the vault (user-signed only)
    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        instructions::withdraw::handler(ctx, amount)
    }

    /// Emergency halt all agent activity (user-signed only)
    pub fn emergency_halt(ctx: Context<EmergencyHalt>) -> Result<()> {
        instructions::emergency_halt::handler(ctx)
    }

    /// Resume vault activity after emergency halt
    pub fn resume_vault(ctx: Context<ResumeVault>) -> Result<()> {
        instructions::resume_vault::handler(ctx)
    }

    /// Register a new strategy in the marketplace
    pub fn register_strategy(
        ctx: Context<RegisterStrategy>,
        strategy_id: [u8; 32],
        metadata_uri: String,
        subscription_fee: u64,
        performance_fee_bps: u16,
    ) -> Result<()> {
        instructions::register_strategy::handler(
            ctx,
            strategy_id,
            metadata_uri,
            subscription_fee,
            performance_fee_bps,
        )
    }

    /// Subscribe to a marketplace strategy
    pub fn subscribe_strategy(ctx: Context<SubscribeStrategy>) -> Result<()> {
        instructions::subscribe_strategy::handler(ctx)
    }

    /// Record performance snapshot for a strategy
    pub fn record_performance(
        ctx: Context<RecordPerformance>,
        epoch: u64,
        pnl_bps: i32,
    ) -> Result<()> {
        instructions::record_performance::handler(ctx, epoch, pnl_bps)
    }
}
