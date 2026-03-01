#!/usr/bin/env tsx

/**
 * Setup Test Vault Script
 * 
 * Creates a test vault on devnet for development and testing.
 * 
 * Usage:
 *   pnpm setup:vault
 *   pnpm setup:vault --amount 1
 */

import {
  Connection,
  Keypair,
  PublicKey,
  LAMPORTS_PER_SOL,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import fs from 'fs';
import path from 'path';

// Configuration
const DEVNET_RPC = 'https://api.devnet.solana.com';
const PROGRAM_ID = process.env.PROGRAM_ID || 'AgVt1111111111111111111111111111111111111111';

async function main() {
  console.log('🏦 AgentVault Test Setup');
  console.log('========================\n');

  // Parse args
  const args = process.argv.slice(2);
  const amountIndex = args.indexOf('--amount');
  const depositAmount = amountIndex !== -1 ? parseFloat(args[amountIndex + 1]) : 0.1;

  // Load wallet
  const walletPath = process.env.WALLET_PATH || `${process.env.HOME}/.config/solana/id.json`;
  if (!fs.existsSync(walletPath)) {
    console.error('❌ Wallet not found at', walletPath);
    console.error('   Run: solana-keygen new');
    process.exit(1);
  }

  const walletData = JSON.parse(fs.readFileSync(walletPath, 'utf-8'));
  const wallet = Keypair.fromSecretKey(Uint8Array.from(walletData));
  console.log('👛 Wallet:', wallet.publicKey.toBase58());

  // Connect to devnet
  const connection = new Connection(DEVNET_RPC, 'confirmed');
  console.log('🌐 Connected to devnet');

  // Check balance
  const balance = await connection.getBalance(wallet.publicKey);
  console.log('💰 Balance:', balance / LAMPORTS_PER_SOL, 'SOL');

  if (balance < depositAmount * LAMPORTS_PER_SOL + 0.1 * LAMPORTS_PER_SOL) {
    console.log('\n⚠️  Low balance! Requesting airdrop...');
    try {
      const sig = await connection.requestAirdrop(
        wallet.publicKey,
        2 * LAMPORTS_PER_SOL
      );
      await connection.confirmTransaction(sig);
      console.log('✅ Airdrop received');
    } catch (e) {
      console.error('❌ Airdrop failed. Try manually: solana airdrop 2 --url devnet');
    }
  }

  // Generate agent keypair
  const agentKeypair = Keypair.generate();
  console.log('\n🤖 Agent keypair generated:', agentKeypair.publicKey.toBase58());

  // Save agent keypair
  const agentKeyPath = './agent-keypair.json';
  fs.writeFileSync(agentKeyPath, JSON.stringify(Array.from(agentKeypair.secretKey)));
  console.log('💾 Agent keypair saved to', agentKeyPath);

  // Derive vault PDA
  const programId = new PublicKey(PROGRAM_ID);
  const [vaultPda, vaultBump] = PublicKey.findProgramAddressSync(
    [Buffer.from('vault'), wallet.publicKey.toBuffer()],
    programId
  );
  console.log('\n🏦 Vault PDA:', vaultPda.toBase58());

  // Derive policy PDA
  const [policyPda, policyBump] = PublicKey.findProgramAddressSync(
    [Buffer.from('policy'), vaultPda.toBuffer()],
    programId
  );
  console.log('📋 Policy PDA:', policyPda.toBase58());

  // Create initial policy hash (sha256 of default policy)
  const defaultPolicy = {
    version: 1,
    spending: { perTransaction: { sol: 5 }, daily: { sol: 20 } },
    allowlists: { assets: [], programs: [] },
    limits: { maxPositionPercent: 30, minStablecoinPercent: 20, maxSlippageBps: 100 },
    autoExecute: { priceTriggers: true, newProtocols: false },
  };
  
  // Simple hash for demo (use proper sha256 in production)
  const policyHash = Buffer.alloc(32);
  const policyStr = JSON.stringify(defaultPolicy);
  for (let i = 0; i < Math.min(policyStr.length, 32); i++) {
    policyHash[i] = policyStr.charCodeAt(i);
  }

  console.log('\n📝 Default policy configured');

  // Output setup info
  console.log('\n============================================');
  console.log('✅ Setup Complete!');
  console.log('============================================\n');

  console.log('Environment variables to set:\n');
  console.log(`PROGRAM_ID=${PROGRAM_ID}`);
  console.log(`VAULT_ADDRESS=${vaultPda.toBase58()}`);
  console.log(`AGENT_PUBKEY=${agentKeypair.publicKey.toBase58()}`);
  console.log(`AGENT_KEYPAIR_PATH=${path.resolve(agentKeyPath)}`);
  console.log(`OWNER_PUBKEY=${wallet.publicKey.toBase58()}`);

  console.log('\nTo initialize vault on-chain, run:');
  console.log('  anchor test --skip-local-validator --provider.cluster devnet');

  console.log('\n⚠️  Keep agent-keypair.json safe! It controls your vault.');
}

main().catch(console.error);
