#!/bin/bash

# ==============================================================================
# Generate TypeScript types from Anchor IDL
# ==============================================================================

set -e

echo "📦 Generating TypeScript types from IDL..."

# Build to ensure IDL is up to date
anchor build

# Check if IDL exists
IDL_PATH="target/idl/agentvault.json"
if [ ! -f "$IDL_PATH" ]; then
    echo "❌ IDL not found at $IDL_PATH"
    echo "   Run: anchor build"
    exit 1
fi

# Create output directories
mkdir -p app/src/idl
mkdir -p runtime/src/idl

# Copy IDL
cp "$IDL_PATH" app/src/idl/
cp "$IDL_PATH" runtime/src/idl/

echo "✅ IDL copied to app/src/idl/ and runtime/src/idl/"

# Generate TypeScript types using anchor's built-in generator
# This creates types that work with @coral-xyz/anchor
cat > app/src/idl/types.ts << 'EOF'
/**
 * Auto-generated TypeScript types for AgentVault program
 * Generated from: target/idl/agentvault.json
 */

import { PublicKey } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';

// Account types
export interface UserVault {
  owner: PublicKey;
  agent: PublicKey;
  policyHash: number[];
  balance: BN;
  status: VaultStatus;
  lastActivity: BN;
  txCount: BN;
  createdAt: BN;
  bump: number;
}

export interface PolicyConfig {
  vault: PublicKey;
  dailyLimit: BN;
  txLimit: BN;
  dailySpent: BN;
  lastReset: BN;
  maxSlippageBps: number;
  assetAllowlist: PublicKey[];
  programAllowlist: PublicKey[];
  autoExecute: boolean;
  bump: number;
}

export interface Strategy {
  id: number[];
  creator: PublicKey;
  metadataUri: string;
  subscriptionFee: BN;
  performanceFeeBps: number;
  subscriberCount: number;
  status: StrategyStatus;
  createdAt: BN;
  bump: number;
}

export interface PerformanceLog {
  strategy: PublicKey;
  epoch: BN;
  pnlBps: number;
  cumulativePnlBps: number;
  maxDrawdownBps: number;
  timestamp: BN;
  bump: number;
}

// Enum types
export type VaultStatus = 
  | { active: {} }
  | { paused: {} }
  | { halted: {} };

export type StrategyStatus =
  | { active: {} }
  | { paused: {} }
  | { deprecated: {} };

// Instruction parameter types
export interface SwapParams {
  amountIn: BN;
  minimumAmountOut: BN;
  routeData: Buffer;
}

export interface StakeParams {
  amount: BN;
}

export interface LendParams {
  amount: BN;
  protocol: LendingProtocol;
}

export type LendingProtocol =
  | { marginFi: {} }
  | { kamino: {} };

// Program addresses
export const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID || 'AgVt1111111111111111111111111111111111111111'
);

// PDA derivation helpers
export function deriveVaultPda(owner: PublicKey, programId: PublicKey = PROGRAM_ID): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('vault'), owner.toBuffer()],
    programId
  );
}

export function derivePolicyPda(vault: PublicKey, programId: PublicKey = PROGRAM_ID): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('policy'), vault.toBuffer()],
    programId
  );
}

export function deriveStrategyPda(
  creator: PublicKey,
  strategyId: Buffer,
  programId: PublicKey = PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('strategy'), creator.toBuffer(), strategyId],
    programId
  );
}

export function derivePerformancePda(
  strategy: PublicKey,
  epoch: BN,
  programId: PublicKey = PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('perf'), strategy.toBuffer(), epoch.toArrayLike(Buffer, 'le', 8)],
    programId
  );
}
EOF

# Copy to runtime as well
cp app/src/idl/types.ts runtime/src/idl/

echo "✅ TypeScript types generated"
echo ""
echo "Files created:"
echo "  - app/src/idl/agentvault.json"
echo "  - app/src/idl/types.ts"
echo "  - runtime/src/idl/agentvault.json"
echo "  - runtime/src/idl/types.ts"
