<div align="center">

<img src="assets/banner.jpg" alt="AgentVault - Your Personal AI Agent Wallet on Solana" width="100%" />

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Solana](https://img.shields.io/badge/Solana-1.18+-purple.svg)](https://solana.com)
[![Anchor](https://img.shields.io/badge/Anchor-0.32+-teal.svg)](https://anchor-lang.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://typescriptlang.org)

*Autonomous DeFi management within user-defined guardrails*

[**🎮 Interactive Demo**](https://raw.githack.com/cloudweaver/agentvault/main/docs/demo.html) · [Documentation](https://github.com/cloudweaver/agentvault#readme) · [Discord](https://discord.gg/agentvault)

</div>

---

## 🎮 Try the Demo

**[Launch Interactive Demo →](https://raw.githack.com/cloudweaver/agentvault/main/docs/demo.html)**

Experience the AI-powered wallet interface:
- 💬 **Chat with the agent** using natural language
- 🔄 **Swap tokens** via Jupiter with simulated quotes
- 📈 **Stake SOL** with Marinade for yield
- 🏦 **Lend assets** on MarginFi
- ✅ **Approve/reject** action plans
- 📊 **View portfolio** and activity feed

> No wallet needed — fully interactive demo!

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
            ┌────────────────────┼────────────────────┐
            ▼                    ▼                    ▼
     ┌────────────┐      ┌────────────┐      ┌────────────┐
     │  HTTP API  │      │ WebSocket  │      │  Database  │
     │   :3001    │      │   :3002    │      │ PostgreSQL │
     └────────────┘      └────────────┘      │   Redis    │
            │                    │            └────────────┘
            └────────────────────┼────────────────────┘
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AGENT RUNTIME (L2)                           │
│       LLM Reasoning · Tool Execution · Memory · Scheduler       │
└─────────────────────────────────────────────────────────────────┘
                                 │
            ┌────────────────────┼────────────────────┐
            ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  Jupiter Swap   │  │ Marinade Stake  │  │ MarginFi Lend   │
│    Adapter      │  │    Adapter      │  │    Adapter      │
└─────────────────┘  └─────────────────┘  └─────────────────┘
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
- [PostgreSQL](https://postgresql.org/) (15+)
- [Redis](https://redis.io/) (7+)

### Installation

```bash
# Clone the repository
git clone https://github.com/cloudweaver/agentvault.git
cd agentvault

# Install dependencies
pnpm install

# Copy and configure environment
cp .env.example .env
# Edit .env with your API keys and database URLs

# Run database migrations
pnpm --filter runtime migrate

# Build the Solana program
anchor build

# Run tests
anchor test

# Start the development environment
pnpm dev
```

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `ANTHROPIC_API_KEY` | Claude API key for LLM reasoning | ✅ |
| `SOLANA_RPC_URL` | Solana RPC endpoint (Helius recommended) | ✅ |
| `HELIUS_API_KEY` | Helius API key for webhooks & enhanced RPC | ✅ |
| `DATABASE_URL` | PostgreSQL connection string | ✅ |
| `REDIS_URL` | Redis URL for caching & sessions | ✅ |
| `XAI_API_KEY` | Grok API key (fallback LLM) | Optional |
| `BIRDEYE_API_KEY` | Birdeye API for backup prices | Optional |

## Project Structure

```
agentvault/
├── programs/
│   └── agentvault/              # Anchor Solana program (Rust)
│       ├── src/
│       │   ├── lib.rs           # Program entrypoint
│       │   ├── instructions/    # Instruction handlers
│       │   │   ├── initialize_vault.rs
│       │   │   ├── execute_swap.rs      # Jupiter CPI
│       │   │   ├── execute_stake.rs     # Marinade CPI
│       │   │   ├── execute_lend.rs      # MarginFi/Kamino CPI
│       │   │   └── ...
│       │   ├── state/           # Account structures
│       │   └── errors.rs        # Custom errors
│       └── Cargo.toml
├── runtime/                      # Agent runtime (TypeScript)
│   ├── src/
│   │   ├── agent/
│   │   │   └── runtime.ts       # Core agent orchestration
│   │   ├── server/
│   │   │   ├── http.ts          # REST API server
│   │   │   └── websocket.ts     # Real-time WebSocket server
│   │   ├── db/
│   │   │   ├── postgres.ts      # PostgreSQL client & migrations
│   │   │   └── redis.ts         # Redis caching & sessions
│   │   ├── llm/
│   │   │   └── claude.ts        # Claude integration
│   │   ├── policy/
│   │   │   └── engine.ts        # Policy validation
│   │   ├── adapters/
│   │   │   ├── jupiter.ts       # Swap routing & execution
│   │   │   ├── marinade.ts      # Liquid staking
│   │   │   └── marginfi.ts      # Lending/borrowing
│   │   └── types/               # TypeScript types
│   └── package.json
├── app/                          # Frontend (Next.js)
│   ├── src/
│   │   ├── app/                 # App router pages
│   │   ├── components/          # React components
│   │   │   ├── chat-interface.tsx
│   │   │   ├── portfolio-dashboard.tsx
│   │   │   ├── activity-feed.tsx
│   │   │   └── providers.tsx
│   │   ├── contexts/
│   │   │   └── VaultContext.tsx # Global vault state
│   │   ├── hooks/
│   │   │   └── useWebSocket.ts  # Real-time connection
│   │   └── lib/
│   │       └── api.ts           # HTTP API client
│   └── package.json
├── docs/                         # Documentation
├── .env.example                  # Environment template
├── Anchor.toml                   # Anchor configuration
└── package.json                  # Workspace root
```

## API Reference

### HTTP API (Port 3001)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/stats` | GET | Server statistics |
| `/protocols` | GET | List supported protocols |
| `/protocols/stats` | GET | Protocol APYs and rates |
| `/vaults/:address` | GET | Get vault info |
| `/vaults/:address/portfolio` | GET | Get portfolio balances |
| `/vaults/:address/activity` | GET | Get activity history |
| `/vaults/:address/policy` | GET | Get policy config |
| `/vaults/:address/intents` | POST | Submit natural language intent |
| `/prices/:mint` | GET | Get token price |
| `/quotes/swap` | POST | Get Jupiter swap quote |
| `/quotes/stake` | POST | Get Marinade stake quote |
| `/quotes/lend` | POST | Get MarginFi lend quote |

### WebSocket API (Port 3002)

**Client → Server Messages:**
```typescript
{ type: 'subscribe', vaultAddress: string }
{ type: 'unsubscribe', vaultAddress: string }
{ type: 'intent', vaultAddress: string, text: string }
{ type: 'approve', planId: string }
{ type: 'reject', planId: string }
{ type: 'get_portfolio', vaultAddress: string }
{ type: 'ping' }
```

**Server → Client Messages:**
```typescript
{ type: 'subscribed', vaultAddress: string }
{ type: 'action_plan', plan: ActionPlan }
{ type: 'action_executed', planId: string, signatures: string[], success: boolean }
{ type: 'portfolio_update', vaultAddress: string, portfolio: Portfolio }
{ type: 'price_update', prices: Record<string, number> }
{ type: 'activity', entry: ActivityLogEntry }
{ type: 'error', message: string, code?: string }
{ type: 'pong' }
```

## Database Schema

### PostgreSQL Tables

```sql
-- Vaults
CREATE TABLE vaults (
  address VARCHAR(44) PRIMARY KEY,
  owner VARCHAR(44) NOT NULL,
  agent VARCHAR(44) NOT NULL,
  balance NUMERIC(20, 0) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active',
  policy_hash VARCHAR(64),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Activity Logs
CREATE TABLE activity_logs (
  id UUID PRIMARY KEY,
  vault_address VARCHAR(44) REFERENCES vaults(address),
  action_type VARCHAR(50) NOT NULL,
  tx_signature VARCHAR(88),
  reasoning TEXT,
  policy_decision VARCHAR(20) NOT NULL,
  policy_errors JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Strategies
CREATE TABLE strategies (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  creator VARCHAR(44) NOT NULL,
  config JSONB NOT NULL,
  subscription_fee NUMERIC(20, 0) DEFAULT 0,
  performance_fee_bps INTEGER DEFAULT 0,
  subscriber_count INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active'
);

-- Subscriptions
CREATE TABLE subscriptions (
  vault_address VARCHAR(44) REFERENCES vaults(address),
  strategy_id VARCHAR(64) REFERENCES strategies(id),
  status VARCHAR(20) DEFAULT 'active',
  PRIMARY KEY (vault_address, strategy_id)
);
```

### Redis Keys

| Key Pattern | Purpose | TTL |
|-------------|---------|-----|
| `price:{mint}` | Token price cache | 30s |
| `vault:{address}:portfolio` | Portfolio cache | 60s |
| `plan:{planId}` | Pending action plans | 5m |
| `session:{id}` | User sessions | 24h |
| `triggers:{vaultAddress}` | Active triggers | — |
| `ratelimit:{key}` | Rate limiting | window |
| `lock:{resource}` | Distributed locks | 10s |

## Solana Program

### Instructions

| Instruction | Description | CPI Target |
|-------------|-------------|------------|
| `initialize_vault` | Create vault with agent delegate | — |
| `update_policy` | Update policy hash (user-signed) | — |
| `execute_swap` | Token swap with slippage protection | Jupiter V6 |
| `execute_stake` | Stake SOL to liquid staking | Marinade |
| `execute_lend` | Supply to lending protocols | MarginFi/Kamino |
| `register_strategy` | Publish strategy to marketplace | — |
| `subscribe_strategy` | Subscribe with fee payment | — |
| `withdraw` | User-signed withdrawal | — |
| `emergency_halt` | Freeze agent activity (user-only) | — |

### Integrated Protocols

| Protocol | Address | Function |
|----------|---------|----------|
| Jupiter V6 | `JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4` | Token swaps |
| Marinade | `MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD` | Liquid staking |
| MarginFi | `MFv2hWf31Z9kbCa1snEPYctwafyhdvnV7FZnsebVacA` | Lending |
| Kamino | `KLend2g3cP87ber41GAmhvH3VPVwWvxTKjkN6nh8VqD` | Lending |

## Frontend

The Next.js frontend provides a real-time interface for interacting with your AgentVault.

### Key Components

| Component | Description |
|-----------|-------------|
| `ChatInterface` | Natural language chat with action plan approval |
| `PortfolioDashboard` | Real-time portfolio balances and positions |
| `ActivityFeed` | Transaction history with reasoning traces |
| `Providers` | Wallet adapters, React Query, VaultContext |

### Hooks & Context

```typescript
// Use vault context for global state
import { useVault } from '@/contexts/VaultContext';

const { 
  vault,           // Current vault info
  portfolio,       // Portfolio balances
  activities,      // Activity history
  pendingPlans,    // Plans awaiting approval
  connectionStatus,// WebSocket status
  submitIntent,    // Send natural language intent
  approvePlan,     // Approve action plan
  rejectPlan,      // Reject action plan
} = useVault();
```

```typescript
// Direct WebSocket access
import { useWebSocket } from '@/hooks/useWebSocket';

const ws = useWebSocket({
  onActionPlan: (plan) => console.log('New plan:', plan),
  onPortfolioUpdate: (addr, portfolio) => console.log('Updated:', portfolio),
  onPriceUpdate: (prices) => console.log('Prices:', prices),
});

ws.subscribe(vaultAddress);
ws.submitIntent(vaultAddress, 'Swap 1 SOL to USDC');
```

## Security

### Key Principles

1. **User keys never touch the agent** — Scoped delegate keypair handles execution
2. **Delegate cannot withdraw** — Agent trades within limits but can't extract funds
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

## Development

### Building

```bash
anchor build                    # Solana program
pnpm --filter runtime build     # Runtime
pnpm --filter app build         # Frontend
pnpm build                      # Everything
```

### Database

```bash
pnpm --filter runtime migrate        # Run migrations
pnpm --filter runtime migrate:status # Check status
```

### Testing

```bash
anchor test                     # Solana program
pnpm --filter runtime test      # Runtime
pnpm test                       # All tests
```

### Local Development

```bash
solana-test-validator           # Start local validator
anchor deploy --provider.cluster localnet
pnpm --filter runtime dev       # Runtime with hot reload
pnpm --filter app dev           # Frontend
```

## Deployment

### Devnet Deployment

```bash
# Ensure you have SOL for deployment
solana airdrop 5 --url devnet

# Deploy to devnet (builds, deploys, updates config)
pnpm deploy:devnet

# Setup test vault with agent keypair
pnpm setup:vault

# Generate TypeScript types from IDL
pnpm generate:types
```

The deployment script will:
1. Check wallet balance (minimum 5 SOL required)
2. Build the Anchor program
3. Deploy or upgrade the program
4. Upload IDL to chain
5. Update Anchor.toml with program ID
6. Copy IDL to frontend

### Deployment Checklist

- [ ] Configure `.env` with API keys
- [ ] Fund deployer wallet: `solana airdrop 5 --url devnet`
- [ ] Run `pnpm deploy:devnet`
- [ ] Run `pnpm setup:vault` to create test vault
- [ ] Update frontend `.env` with `NEXT_PUBLIC_PROGRAM_ID`
- [ ] Run `pnpm --filter runtime migrate` for database
- [ ] Start runtime: `pnpm --filter runtime dev`
- [ ] Start frontend: `pnpm --filter app dev`

### Program Addresses

| Network | Program ID |
|---------|------------|
| Devnet | `AgVt1111111111111111111111111111111111111111` |
| Mainnet | TBD |

## Roadmap

### Phase 1: Foundation ✅
- [x] Core Solana program (vault, policies)
- [x] Jupiter/Marinade/MarginFi CPI integrations
- [x] Agent runtime with Claude integration
- [x] Policy engine (off-chain + on-chain)
- [x] Protocol adapters
- [x] WebSocket + HTTP API servers
- [x] PostgreSQL + Redis persistence

### Phase 2: Autonomy ✅
- [x] Monitoring loop with triggers
- [x] Deployment scripts (devnet)
- [x] Frontend WebSocket integration
- [x] Chat interface with plan approval
- [x] Vault context and hooks
- [ ] End-to-end testing

### Phase 3: Marketplace
- [ ] Strategy registration UI
- [ ] Performance tracking
- [ ] Revenue sharing
- [ ] Strategy store

### Phase 4: Scale
- [ ] Mobile app
- [ ] Multi-LLM providers
- [ ] Jito MEV protection
- [ ] Mainnet deployment

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT License — see [LICENSE](LICENSE) for details.

---

<div align="center">

**AgentVault** — *Autonomous finance, your rules.*

[Website](https://agentvault.io) · [Docs](https://docs.agentvault.io) · [Twitter](https://twitter.com/agentvault) · [Discord](https://discord.gg/agentvault)

</div>
