import { createLogger } from '../utils/logger.js';
import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
} from '@solana/spl-token';

const logger = createLogger('marginfi-adapter');

// MarginFi program addresses
export const MARGINFI_PROGRAM_ID = new PublicKey('MFv2hWf31Z9kbCa1snEPYctwafyhdvnV7FZnsebVacA');
export const MARGINFI_GROUP = new PublicKey('4qp6Fx6tnZkY5Wropq9wUYgtFxXKwE6viZxFHg3rdAG8');

// Common token mints
export const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
export const SOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');

// MarginFi bank addresses (these would be fetched dynamically in production)
export const USDC_BANK = new PublicKey('2s37akK2eyBbp8DZgCm7RtsaEz8eJP3Nxd4urLHQv7yB');
export const SOL_BANK = new PublicKey('CCKtUs6Cgwo4aaQUmBPmyoApH2gUDErxNZCAntD6LYGh');

export interface LendingPool {
  bank: PublicKey;
  mint: PublicKey;
  symbol: string;
  depositApy: number;
  borrowApy: number;
  totalDeposits: number;
  totalBorrows: number;
  utilizationRate: number;
}

export interface DepositQuote {
  amount: number;
  mint: PublicKey;
  bank: PublicKey;
  estimatedApy: number;
}

export interface UserPosition {
  asset: string;
  mint: PublicKey;
  deposited: number;
  borrowed: number;
  healthFactor: number;
}

export class MarginFiAdapter {
  private connection: Connection;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  /**
   * Get available lending pools
   */
  async getPools(): Promise<LendingPool[]> {
    // In production, fetch from MarginFi API or parse on-chain data
    // For now, return known pools
    return [
      {
        bank: USDC_BANK,
        mint: USDC_MINT,
        symbol: 'USDC',
        depositApy: 0.052, // 5.2%
        borrowApy: 0.078,  // 7.8%
        totalDeposits: 50_000_000,
        totalBorrows: 35_000_000,
        utilizationRate: 0.7,
      },
      {
        bank: SOL_BANK,
        mint: SOL_MINT,
        symbol: 'SOL',
        depositApy: 0.031, // 3.1%
        borrowApy: 0.055,  // 5.5%
        totalDeposits: 100_000,
        totalBorrows: 60_000,
        utilizationRate: 0.6,
      },
    ];
  }

  /**
   * Get deposit quote
   */
  async getDepositQuote(mint: PublicKey, amount: number): Promise<DepositQuote> {
    const pools = await this.getPools();
    const pool = pools.find(p => p.mint.equals(mint));

    if (!pool) {
      throw new Error(`No lending pool found for mint: ${mint.toBase58()}`);
    }

    return {
      amount,
      mint,
      bank: pool.bank,
      estimatedApy: pool.depositApy,
    };
  }

  /**
   * Find or derive MarginFi account PDA for user
   */
  async findUserAccount(userPublicKey: PublicKey): Promise<PublicKey> {
    const [marginfiAccount] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('marginfi_account'),
        MARGINFI_GROUP.toBuffer(),
        userPublicKey.toBuffer(),
      ],
      MARGINFI_PROGRAM_ID
    );
    return marginfiAccount;
  }

  /**
   * Check if user has MarginFi account
   */
  async userAccountExists(userPublicKey: PublicKey): Promise<boolean> {
    const account = await this.findUserAccount(userPublicKey);
    const info = await this.connection.getAccountInfo(account);
    return info !== null;
  }

  /**
   * Build transaction to initialize MarginFi account
   */
  buildInitAccountInstruction(
    userPublicKey: PublicKey,
    marginfiAccount: PublicKey,
  ): TransactionInstruction {
    // Discriminator for marginfi_account_initialize
    const discriminator = Buffer.from([43, 49, 147, 45, 89, 4, 143, 46]);

    return {
      programId: MARGINFI_PROGRAM_ID,
      keys: [
        { pubkey: MARGINFI_GROUP, isSigner: false, isWritable: false },
        { pubkey: marginfiAccount, isSigner: false, isWritable: true },
        { pubkey: userPublicKey, isSigner: true, isWritable: true },
        { pubkey: new PublicKey('11111111111111111111111111111111'), isSigner: false, isWritable: false },
      ],
      data: discriminator,
    };
  }

  /**
   * Build deposit transaction
   */
  async buildDepositTransaction(
    userPublicKey: PublicKey,
    mint: PublicKey,
    amount: number,
  ): Promise<Transaction> {
    const tx = new Transaction();

    // Find MarginFi account
    const marginfiAccount = await this.findUserAccount(userPublicKey);

    // Check if account exists, create if not
    const accountExists = await this.userAccountExists(userPublicKey);
    if (!accountExists) {
      tx.add(this.buildInitAccountInstruction(userPublicKey, marginfiAccount));
    }

    // Get bank for this mint
    const quote = await this.getDepositQuote(mint, amount);

    // Get user's token account
    const userTokenAccount = await getAssociatedTokenAddress(mint, userPublicKey);

    // Get bank's liquidity vault (would be fetched from bank account data)
    const [bankLiquidityVault] = PublicKey.findProgramAddressSync(
      [quote.bank.toBuffer(), Buffer.from('liquidity_vault')],
      MARGINFI_PROGRAM_ID
    );

    // Discriminator for lending_account_deposit
    const discriminator = Buffer.from([171, 94, 235, 103, 82, 64, 212, 140]);
    const amountBuffer = Buffer.alloc(8);
    amountBuffer.writeBigUInt64LE(BigInt(amount));

    const data = Buffer.concat([discriminator, amountBuffer]);

    tx.add({
      programId: MARGINFI_PROGRAM_ID,
      keys: [
        { pubkey: MARGINFI_GROUP, isSigner: false, isWritable: false },
        { pubkey: marginfiAccount, isSigner: false, isWritable: true },
        { pubkey: userPublicKey, isSigner: true, isWritable: false },
        { pubkey: quote.bank, isSigner: false, isWritable: true },
        { pubkey: userTokenAccount, isSigner: false, isWritable: true },
        { pubkey: bankLiquidityVault, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
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
   * Build withdraw transaction
   */
  async buildWithdrawTransaction(
    userPublicKey: PublicKey,
    mint: PublicKey,
    amount: number,
  ): Promise<Transaction> {
    const tx = new Transaction();

    const marginfiAccount = await this.findUserAccount(userPublicKey);
    const quote = await this.getDepositQuote(mint, amount);
    const userTokenAccount = await getAssociatedTokenAddress(mint, userPublicKey);

    const [bankLiquidityVault] = PublicKey.findProgramAddressSync(
      [quote.bank.toBuffer(), Buffer.from('liquidity_vault')],
      MARGINFI_PROGRAM_ID
    );

    const [bankLiquidityVaultAuthority] = PublicKey.findProgramAddressSync(
      [quote.bank.toBuffer(), Buffer.from('liquidity_vault_auth')],
      MARGINFI_PROGRAM_ID
    );

    // Discriminator for lending_account_withdraw
    const discriminator = Buffer.from([36, 72, 74, 118, 219, 113, 62, 137]);
    const amountBuffer = Buffer.alloc(8);
    amountBuffer.writeBigUInt64LE(BigInt(amount));
    const withdrawAll = Buffer.from([0]); // false

    const data = Buffer.concat([discriminator, amountBuffer, withdrawAll]);

    tx.add({
      programId: MARGINFI_PROGRAM_ID,
      keys: [
        { pubkey: MARGINFI_GROUP, isSigner: false, isWritable: false },
        { pubkey: marginfiAccount, isSigner: false, isWritable: true },
        { pubkey: userPublicKey, isSigner: true, isWritable: false },
        { pubkey: quote.bank, isSigner: false, isWritable: true },
        { pubkey: userTokenAccount, isSigner: false, isWritable: true },
        { pubkey: bankLiquidityVaultAuthority, isSigner: false, isWritable: false },
        { pubkey: bankLiquidityVault, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      data,
    });

    const { blockhash } = await this.connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = userPublicKey;

    return tx;
  }

  /**
   * Get user's positions
   */
  async getUserPositions(userPublicKey: PublicKey): Promise<UserPosition[]> {
    const marginfiAccount = await this.findUserAccount(userPublicKey);
    const accountInfo = await this.connection.getAccountInfo(marginfiAccount);

    if (!accountInfo) {
      return [];
    }

    // Parse account data to get positions
    // In production, use proper borsh deserialization
    // For now, return empty array
    logger.info({ user: userPublicKey.toBase58() }, 'Fetching user positions');

    return [];
  }

  /**
   * Simulate transaction
   */
  async simulate(tx: Transaction): Promise<{ success: boolean; error?: string }> {
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
}
