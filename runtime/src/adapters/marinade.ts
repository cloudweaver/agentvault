import { createLogger } from '../utils/logger.js';
import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';

const logger = createLogger('marinade-adapter');

// Marinade program addresses
export const MARINADE_PROGRAM_ID = new PublicKey('MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD');
export const MARINADE_STATE = new PublicKey('8szGkuLTAux9XMgZ2vtY39jVSowEcpBfFfD8hXSEqdGC');
export const MSOL_MINT = new PublicKey('mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So');
export const MSOL_MINT_AUTHORITY = new PublicKey('3JLPCS1qM2zRw3Dp6V4hZnYHd4toMNPkNesXdX9tg6KM');
export const RESERVE_PDA = new PublicKey('Du3Ysj1wKbxPKkuPPnvzQLQh8oMSVifs3jGZjJWXFmHN');

export interface StakeQuote {
  inputAmount: number;  // SOL in lamports
  outputAmount: number; // mSOL in smallest units
  exchangeRate: number;
  fee: number;
}

export interface StakeResult {
  signature: string;
  inputAmount: number;
  outputAmount: number;
  slot: number;
}

export class MarinadeAdapter {
  private connection: Connection;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  /**
   * Get current mSOL/SOL exchange rate
   */
  async getExchangeRate(): Promise<number> {
    try {
      // Fetch Marinade state account to get exchange rate
      const stateAccount = await this.connection.getAccountInfo(MARINADE_STATE);
      if (!stateAccount) {
        throw new Error('Failed to fetch Marinade state');
      }

      // Parse the state to get exchange rate
      // Marinade state layout: msol_supply at offset 8, total_virtual_staked_lamports at offset 16
      const data = stateAccount.data;
      const msolSupply = data.readBigUInt64LE(8);
      const totalStaked = data.readBigUInt64LE(16);

      if (msolSupply === BigInt(0)) {
        return 1.0;
      }

      return Number(totalStaked) / Number(msolSupply);
    } catch (error) {
      logger.warn({ error }, 'Failed to fetch exchange rate, using default');
      return 1.05; // Default approximate rate
    }
  }

  /**
   * Get a quote for staking SOL
   */
  async getStakeQuote(amountLamports: number): Promise<StakeQuote> {
    const exchangeRate = await this.getExchangeRate();
    
    // Calculate expected mSOL output
    const outputAmount = Math.floor(amountLamports / exchangeRate);
    
    // Marinade has minimal fees (~0.1%)
    const fee = Math.floor(amountLamports * 0.001);

    const quote: StakeQuote = {
      inputAmount: amountLamports,
      outputAmount,
      exchangeRate,
      fee,
    };

    logger.info({
      inputSol: amountLamports / LAMPORTS_PER_SOL,
      outputMsol: outputAmount / LAMPORTS_PER_SOL,
      exchangeRate,
    }, 'Marinade stake quote');

    return quote;
  }

  /**
   * Build stake transaction
   */
  async buildStakeTransaction(
    userPublicKey: PublicKey,
    amountLamports: number,
  ): Promise<Transaction> {
    const tx = new Transaction();

    // Get or create mSOL token account for user
    const msolAta = await getAssociatedTokenAddress(
      MSOL_MINT,
      userPublicKey,
    );

    // Check if ATA exists
    const ataAccount = await this.connection.getAccountInfo(msolAta);
    if (!ataAccount) {
      tx.add(
        createAssociatedTokenAccountInstruction(
          userPublicKey,  // payer
          msolAta,        // ata
          userPublicKey,  // owner
          MSOL_MINT,      // mint
        )
      );
    }

    // Marinade deposit instruction
    // Discriminator: [242, 35, 198, 137, 82, 225, 242, 182]
    const discriminator = Buffer.from([242, 35, 198, 137, 82, 225, 242, 182]);
    const amountBuffer = Buffer.alloc(8);
    amountBuffer.writeBigUInt64LE(BigInt(amountLamports));

    const data = Buffer.concat([discriminator, amountBuffer]);

    tx.add({
      programId: MARINADE_PROGRAM_ID,
      keys: [
        { pubkey: MARINADE_STATE, isSigner: false, isWritable: true },
        { pubkey: MSOL_MINT, isSigner: false, isWritable: true },
        { pubkey: MSOL_MINT_AUTHORITY, isSigner: false, isWritable: false },
        { pubkey: RESERVE_PDA, isSigner: false, isWritable: true },
        { pubkey: userPublicKey, isSigner: true, isWritable: true },
        { pubkey: msolAta, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data,
    });

    // Get recent blockhash
    const { blockhash } = await this.connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = userPublicKey;

    return tx;
  }

  /**
   * Simulate stake transaction
   */
  async simulateStake(tx: Transaction): Promise<{ success: boolean; error?: string }> {
    try {
      const simulation = await this.connection.simulateTransaction(tx);
      
      if (simulation.value.err) {
        return {
          success: false,
          error: JSON.stringify(simulation.value.err),
        };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get user's mSOL balance
   */
  async getMsolBalance(userPublicKey: PublicKey): Promise<number> {
    try {
      const msolAta = await getAssociatedTokenAddress(MSOL_MINT, userPublicKey);
      const balance = await this.connection.getTokenAccountBalance(msolAta);
      return Number(balance.value.amount);
    } catch {
      return 0;
    }
  }

  /**
   * Get current APY estimate
   */
  async getApyEstimate(): Promise<number> {
    // Marinade's APY varies but is typically 6-8%
    // In production, fetch from Marinade API
    return 0.068; // 6.8%
  }
}
