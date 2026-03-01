<div align="center">

<img src="assets/logo.svg" alt="AgentVault" width="120" />

# AgentVault

### Your Personal AI Agent Wallet on Solana

*Autonomous DeFi management within user-defined guardrails*

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Solana](https://img.shields.io/badge/Solana-1.18+-purple.svg)](https://solana.com)
[![Anchor](https://img.shields.io/badge/Anchor-0.32+-teal.svg)](https://anchor-lang.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://typescriptlang.org)

[Documentation](https://docs.agentvault.io) · [Live App](https://app.agentvault.io) · [Discord](https://discord.gg/agentvault)

</div>

---

## Overview

AgentVault transforms your Solana wallet into an intelligent, autonomous financial assistant. Express your intent in natural language, set guardrails you trust, and let your AI agent handle the rest — monitoring markets, executing swaps, managing yield positions, and reporting back with full transparency.

**The problem:** Current crypto wallets require deep technical knowledge, constant monitoring, and manual execution. DeFi is fragmented across dozens of protocols, each with its own interface and risks.

**The solution:** An LLM-powered agent that sits between you and on-chain protocols. It understands natural language, operates within strict policy constraints, and provides complete visibility into every action it takes.

## Key Features

- **Natural Language Interface** — Talk to your wallet like you'd talk to a financial advisor
- **Policy-Constrained Autonomy** — Set spending limits, asset allowlists, and contract permissions
- **Dual-Layer Enforcement** — Policies enforced both off-chain (fast) and on-chain (trustless)
- **Transparent Activity Feed** — Every action logged with reasoning traces and on-chain receipts
- **Strategy Marketplace** — Discover, subscribe to, and monetize proven agent behaviors
- **Verifiable Performance** — On-chain proof of returns, not marketing claims

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (L6)                           │
│              Next.js Dashboard · Mobile App · API               │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    STRATEGY MARKETPLACE (L5)                    │
│         On-chain Registry · Performance Tracking · Revenue      │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PROTOCOL ADAPTERS (L4)                       │
│          Jupiter · Raydium · Marinade · Orca · Tensor           │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                     POLICY ENGINE (L3)                          │
│     Budget Limits · Rate Limiting · Allowlists · Constraints    │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AGENT RUNTIME (L2)                           │
│       LLM Reasoning · Tool Execution · Memory · Scheduler       │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                   SOLANA PROGRAM (L1)                           │
│       Escrow · Policy Enforcement · Strategy Registry           │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- [Rust](https://rustup.rs/) (1.75+)
- [Solana CLI](https://docs.solana.com/cli/install-solana-cli-tools) (1.18+)
- [Anchor](https://www.anchor-lang.com/docs/installation) (0.32+)
- [Node.js](https://nodejs.org/) (20+)
- [pnpm](https://pnpm.io/) (8+)

### Installation

```bash
# Clone the repository
git clone https://github.com/cloudweaver/agentvault.git
cd agentvault

# Install dependencies
pnpm install

# Build the Solana program
anchor build

# Run tests
anchor test

# Start the development environment
pnpm dev
```

### Environment Setup

```bash
# Copy environment template
cp .env.example .env

# Configure your environment
# - ANTHROPIC_API_KEY: Your Claude API key
# - HELIUS_API_KEY: Solana RPC provider
# - DATABASE_URL: PostgreSQL connection string
```

## Project Structure

```
agentvault/
├── programs/
│   └── agentvault/          # Anchor Solana program (Rust)
│       ├── src/
│       │   ├── lib.rs       # Program entrypoint
│       │   ├── instructions/# Instruction handlers
│       │   ├── state/       # Account structures
│       │   └── errors.rs    # Custom errors
│       └── Cargo.toml
├── runtime/                  # Agent runtime (TypeScript)
│   ├── src/
│   │   ├── agent/           # Core agent logic
│   │   ├── llm/             # LLM provider integrations
│   │   ├── policy/          # Policy engine
│   │   ├── adapters/        # Protocol adapters
│   │   └── tools/           # MCP tool definitions
│   └── package.json
├── app/                      # Frontend (Next.js)
│   ├── src/
│   │   ├── app/             # App router pages
│   │   ├── components/      # React components
│   │   └── lib/             # Utilities
│   └── package.json
├── packages/
│   ├── sdk/                 # TypeScript SDK
│   └── types/               # Shared type definitions
├── tests/                   # Integration tests
├── Anchor.toml              # Anchor configuration
└── package.json             # Workspace root
```

## Solana Program

The AgentVault program provides on-chain infrastructure for secure, policy-constrained agent execution.

### Instructions

| Instruction | Description |
|-------------|-------------|
| `initialize_vault` | Create user vault with agent delegate and initial policy |
| `update_policy` | Update on-chain policy hash (user signature required) |
| `execute_swap` | Agent-signed swap via Jupiter CPI within spending limits |
| `execute_stake` | Stake SOL to validators or liquid staking protocols |
| `execute_lend` | Supply assets to lending protocols |
| `register_strategy` | Publish strategy to marketplace registry |
| `subscribe_strategy` | Subscribe to a strategy with fee payment |
| `withdraw` | User-signed withdrawal from vault |
| `emergency_halt` | Freeze all agent activity (user-only) |

### Account Structure

```rust
#[account]
pub struct UserVault {
    pub owner: Pubkey,           // User's main wallet
    pub agent: Pubkey,           // Delegate keypair for agent
    pub policy_hash: [u8; 32],   // Hash of active policy config
    pub balance: u64,            // SOL balance in vault
    pub status: VaultStatus,     // Active, Paused, Halted
    pub created_at: i64,
    pub bump: u8,
}

#[account]
pub struct PolicyConfig {
    pub vault: Pubkey,
    pub daily_limit: u64,        // Max SOL per day
    pub tx_limit: u64,           // Max SOL per transaction
    pub asset_allowlist: Vec<Pubkey>,
    pub program_allowlist: Vec<Pubkey>,
    pub auto_execute: bool,
    pub bump: u8,
}
```

## Agent Runtime

The runtime hosts AI agents that interpret user intent and execute on-chain actions within policy constraints.

### Reasoning Loop

```
┌─────────┐     ┌──────────┐     ┌─────────┐     ┌────────┐
│  PLAN   │ ──▶ │ VALIDATE │ ──▶ │ EXECUTE │ ──▶ │ REPORT │
└─────────┘     └──────────┘     └─────────┘     └────────┘
    │                │                │               │
    ▼                ▼                ▼               ▼
  LLM generates   Policy engine   Adapters build   Results logged
  ActionPlan      checks limits   & submit tx      with reasoning
```

### Tool Definitions (MCP)

```typescript
const tools = {
  swap_tokens: {
    description: "Execute token swap via Jupiter",
    parameters: {
      inputMint: "SPL token mint address",
      outputMint: "SPL token mint address", 
      amount: "Amount in lamports",
      slippage: "Max slippage in basis points"
    }
  },
  check_price: {
    description: "Get real-time token price",
    parameters: {
      mint: "SPL token mint address"
    }
  },
  get_portfolio: {
    description: "Retrieve current vault balances and positions"
  },
  // ... more tools
};
```

## Policy Engine

Policies define what the agent can and cannot do. They're enforced at two layers:

1. **Off-chain (Runtime)** — Fast validation with detailed error messages
2. **On-chain (Program)** — Final enforcement, trustless and tamper-proof

### Policy Categories

| Category | Description | Example |
|----------|-------------|---------|
| Spending Limits | Per-tx and daily maximums | Max 5 SOL per swap, 20 SOL/day |
| Asset Allowlist | Tokens the agent can hold | Only SOL, USDC, JitoSOL |
| Program Allowlist | Contracts the agent can call | Jupiter v6, Marinade only |
| Position Limits | Max allocation per token | Max 30% in any single token |
| Slippage Guard | Maximum acceptable slippage | Reject trades with >1% slip |
| Auto-Execute | Which actions need approval | Price triggers: auto; new protocols: manual |

### Example Policy

```json
{
  "version": 1,
  "spending": {
    "perTransaction": { "sol": 5 },
    "daily": { "sol": 20 }
  },
  "allowlists": {
    "assets": ["So11111111111111111111111111111111111111112", "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"],
    "programs": ["JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4"]
  },
  "limits": {
    "maxPositionPercent": 30,
    "minStablecoinPercent": 20,
    "maxSlippageBps": 100
  },
  "autoExecute": {
    "priceTriggers": true,
    "newProtocols": false
  }
}
```

## Strategy Marketplace

Users can publish, discover, and subscribe to agent strategies — reusable behavioral templates with verifiable on-chain performance.

### Example Strategies

| Strategy | Behavior | Risk |
|----------|----------|------|
| DCA Accumulator | Dollar-cost average into SOL weekly | Low |
| Yield Optimizer | Rebalance to highest APY across protocols | Medium |
| Momentum Trader | Buy tokens breaking 20-day highs | High |
| Stablecoin Shield | Auto-convert to USDC on 10% drawdown | Low |
| Airdrop Farmer | Interact with eligible protocols | Medium |

### Revenue Model

- **Subscription fees** — One-time or recurring SOL payments
- **Performance fees** — Percentage of profits while subscribed
- **Tip jar** — Optional user-initiated tips

## Security

Security is foundational to AgentVault. The system uses defense-in-depth:

### Key Principles

1. **User keys never touch the agent** — A scoped delegate keypair handles execution
2. **Delegate cannot withdraw** — Agent can trade within limits but not extract funds
3. **Dual-layer enforcement** — Off-chain for speed, on-chain for trust
4. **Emergency halt is user-only** — No admin or agent override
5. **Policy updates require user signature** — Agent cannot modify its own constraints

### Threat Mitigations

| Threat | Mitigation |
|--------|------------|
| LLM prompt injection | Tool outputs sanitized; LLM cannot modify policies |
| Runtime compromise | On-chain enforcement prevents unauthorized actions |
| Rogue strategy | Strategies execute within user's policy bounds |
| Oracle manipulation | Multi-source price feeds; reject on divergence |
| MEV attacks | Jito bundles for private transaction submission |

## Development

### Building

```bash
# Build Solana program
anchor build

# Build runtime
pnpm --filter runtime build

# Build frontend
pnpm --filter app build

# Build everything
pnpm build
```

### Testing

```bash
# Solana program tests
anchor test

# Runtime unit tests
pnpm --filter runtime test

# Integration tests
pnpm test:integration

# All tests
pnpm test
```

### Local Development

```bash
# Start local Solana validator
solana-test-validator

# Deploy program locally
anchor deploy --provider.cluster localnet

# Start runtime in dev mode
pnpm --filter runtime dev

# Start frontend
pnpm --filter app dev
```

## Roadmap

- [x] Core Solana program (vault, policies, swaps)
- [x] Agent runtime with Claude integration
- [x] Policy engine (off-chain + on-chain)
- [x] Jupiter swap adapter
- [ ] Marinade staking adapter
- [ ] MarginFi lending adapter
- [ ] Strategy marketplace contracts
- [ ] Performance tracking system
- [ ] Frontend dashboard
- [ ] Mobile app
- [ ] Mainnet deployment

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

```bash
# Fork and clone
git clone https://github.com/YOUR_USERNAME/agentvault.git

# Create a branch
git checkout -b feature/your-feature

# Make changes and test
pnpm test

# Submit a pull request
```

## License

MIT License — see [LICENSE](LICENSE) for details.

---

<div align="center">

**AgentVault** — *Autonomous finance, your rules.*

[Website](https://agentvault.io) · [Docs](https://docs.agentvault.io) · [Twitter](https://twitter.com/agentvault) · [Discord](https://discord.gg/agentvault)

</div>


