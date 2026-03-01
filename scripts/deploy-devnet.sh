#!/bin/bash

# ==============================================================================
# AgentVault Devnet Deployment Script
# ==============================================================================

set -e

echo "🚀 AgentVault Devnet Deployment"
echo "================================"

# Check prerequisites
command -v solana >/dev/null 2>&1 || { echo "❌ Solana CLI required"; exit 1; }
command -v anchor >/dev/null 2>&1 || { echo "❌ Anchor CLI required"; exit 1; }

# Configuration
CLUSTER="devnet"
PROGRAM_NAME="agentvault"

echo ""
echo "📋 Configuration:"
echo "   Cluster: $CLUSTER"
echo "   Program: $PROGRAM_NAME"
echo ""

# Check wallet
WALLET=$(solana config get keypair | awk '{print $2}')
if [ ! -f "$WALLET" ]; then
    echo "❌ Wallet not found at $WALLET"
    echo "   Run: solana-keygen new"
    exit 1
fi

PUBKEY=$(solana-keygen pubkey "$WALLET")
echo "👛 Deployer: $PUBKEY"

# Check balance
BALANCE=$(solana balance --url $CLUSTER | awk '{print $1}')
echo "💰 Balance: $BALANCE SOL"

MIN_BALANCE=5
if (( $(echo "$BALANCE < $MIN_BALANCE" | bc -l) )); then
    echo ""
    echo "⚠️  Low balance! Need at least $MIN_BALANCE SOL for deployment."
    echo "   Run: solana airdrop 5 --url devnet"
    exit 1
fi

# Set cluster
echo ""
echo "🔧 Setting cluster to $CLUSTER..."
solana config set --url $CLUSTER

# Build program
echo ""
echo "🔨 Building program..."
anchor build

# Get program keypair path
PROGRAM_KEYPAIR="target/deploy/${PROGRAM_NAME}-keypair.json"
if [ ! -f "$PROGRAM_KEYPAIR" ]; then
    echo "❌ Program keypair not found at $PROGRAM_KEYPAIR"
    exit 1
fi

PROGRAM_ID=$(solana-keygen pubkey "$PROGRAM_KEYPAIR")
echo "📦 Program ID: $PROGRAM_ID"

# Check if program already deployed
echo ""
echo "🔍 Checking existing deployment..."
if solana program show "$PROGRAM_ID" --url $CLUSTER >/dev/null 2>&1; then
    echo "   Program already deployed, upgrading..."
    DEPLOY_CMD="anchor upgrade target/deploy/${PROGRAM_NAME}.so --program-id $PROGRAM_ID --provider.cluster $CLUSTER"
else
    echo "   New deployment..."
    DEPLOY_CMD="anchor deploy --provider.cluster $CLUSTER"
fi

# Deploy
echo ""
echo "🚀 Deploying to $CLUSTER..."
$DEPLOY_CMD

# Verify deployment
echo ""
echo "✅ Verifying deployment..."
solana program show "$PROGRAM_ID" --url $CLUSTER

# Update Anchor.toml with new program ID
echo ""
echo "📝 Updating Anchor.toml..."
sed -i "s/agentvault = \".*\"/agentvault = \"$PROGRAM_ID\"/" Anchor.toml

# Generate IDL
echo ""
echo "📄 Generating IDL..."
anchor idl init --filepath target/idl/${PROGRAM_NAME}.json "$PROGRAM_ID" --provider.cluster $CLUSTER 2>/dev/null || \
anchor idl upgrade --filepath target/idl/${PROGRAM_NAME}.json "$PROGRAM_ID" --provider.cluster $CLUSTER 2>/dev/null || \
echo "   IDL upload skipped (may require authority)"

# Copy IDL to app
echo ""
echo "📋 Copying IDL to frontend..."
mkdir -p app/src/idl
cp target/idl/${PROGRAM_NAME}.json app/src/idl/

# Summary
echo ""
echo "============================================"
echo "✅ Deployment Complete!"
echo "============================================"
echo ""
echo "Program ID: $PROGRAM_ID"
echo "Cluster:    $CLUSTER"
echo "Explorer:   https://explorer.solana.com/address/$PROGRAM_ID?cluster=$CLUSTER"
echo ""
echo "Next steps:"
echo "  1. Update .env with NEXT_PUBLIC_PROGRAM_ID=$PROGRAM_ID"
echo "  2. Update runtime config"
echo "  3. Run frontend: pnpm --filter app dev"
echo ""
