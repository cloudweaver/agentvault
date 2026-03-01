# Quick Start Guide

Get AgentVault running locally in under 5 minutes.

## Prerequisites

- Node.js 20+
- pnpm 8+
- Rust 1.75+
- Solana CLI 1.18+
- Anchor 0.32+

## Installation

```bash
# Clone the repo
git clone https://github.com/cloudweaver/agentvault.git
cd agentvault

# Install dependencies
pnpm install

# Copy environment config
cp .env.example .env.local
```

## Local Development

### 1. Start Local Validator

```bash
solana-test-validator
```

### 2. Build & Deploy Programs

```bash
anchor build
anchor deploy
```

### 3. Run the Runtime Agent

```bash
cd runtime
pnpm dev
```

### 4. Start the Frontend

```bash
cd app
pnpm dev
```

Visit http://localhost:3000

## First Agent Setup

1. Connect your wallet (devnet)
2. Create a new vault with initial deposit
3. Set your policy constraints:
   - Daily spending limit
   - Allowed tokens
   - Approved protocols
4. Start chatting with your agent!

## Example Commands

```
"Swap 10 USDC to SOL when price drops below $150"
"Stake my idle SOL on Marinade"
"Show my portfolio performance this week"
"Set max daily spend to 50 USDC"
```

## Next Steps

- [Architecture Overview](./ARCHITECTURE.md)
- [Policy Configuration](./POLICIES.md)
- [API Reference](./API.md)
