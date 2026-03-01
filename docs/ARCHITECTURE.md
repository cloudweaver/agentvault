# Architecture

AgentVault uses a layered architecture separating concerns across six distinct layers.

## Layer Overview

```
L6: Frontend       → User interface (Next.js, Mobile)
L5: Marketplace    → Strategy discovery & monetization
L4: Adapters       → Protocol integrations (Jupiter, Raydium, etc.)
L3: Agent Runtime  → LLM orchestration & decision engine
L2: Policy Engine  → Constraint validation & enforcement
L1: Core Program   → On-chain vault & execution (Anchor/Solana)
```

## L1: Core Program

The Solana program managing vault state and enforcing on-chain policies.

**Key accounts:**
- `Vault` — User's agent wallet with deposited funds
- `Policy` — On-chain policy constraints (limits, allowlists)
- `ActionLog` — Immutable record of all agent actions

**Instructions:**
- `initialize_vault` — Create new vault with initial config
- `update_policy` — Modify policy constraints (owner only)
- `execute_action` — Agent-initiated transaction (policy-checked)

## L2: Policy Engine

Dual-layer policy enforcement for speed and trustlessness.

**Off-chain (fast path):**
- Pre-flight validation before transaction construction
- Caches policy state for sub-second decisions
- Rejects invalid intents before gas is spent

**On-chain (trust anchor):**
- Final validation at execution time
- Cannot be bypassed by malicious runtime
- Provides audit trail

## L3: Agent Runtime

LLM-powered decision engine translating intent to action.

**Components:**
- Intent Parser — NL → structured commands
- Strategy Executor — Command → transaction plan
- Risk Analyzer — Plan → risk assessment
- Action Logger — Execution → transparency

## L4: Protocol Adapters

Standardized interfaces to DeFi protocols.

**Supported:**
- Jupiter (swaps)
- Raydium (AMM, farms)
- Marinade (liquid staking)
- Orca (concentrated liquidity)
- Tensor (NFT trading)

## L5: Strategy Marketplace

Discover and monetize agent behaviors.

- On-chain registry of strategies
- Verifiable performance tracking
- Revenue sharing for creators

## L6: Frontend

User interfaces for vault management.

- Next.js web dashboard
- React Native mobile app
- REST/WebSocket API

