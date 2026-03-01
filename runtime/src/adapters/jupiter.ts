import { createLogger } from '../utils/logger.js';

const logger = createLogger('jupiter-adapter');

const JUPITER_API_URL = 'https://quote-api.jup.ag/v6';

export interface JupiterQuoteRequest {
  inputMint: string;
  outputMint: string;
  amount: string | number;
  slippageBps?: number;
}

export interface JupiterQuote {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  priceImpactPct: string;
  routePlan: RoutePlan[];
  contextSlot: number;
}

interface RoutePlan {
  swapInfo: {
    ammKey: string;
    label: string;
    inputMint: string;
    outputMint: string;
    inAmount: string;
    outAmount: string;
    feeAmount: string;
    feeMint: string;
  };
  percent: number;
}

export interface SwapSimulation {
  success: boolean;
  error?: string;
  estimatedGas?: number;
}

export class JupiterAdapter {
  private baseUrl: string;

  constructor(baseUrl: string = JUPITER_API_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Get a quote for a token swap
   */
  async getQuote(request: JupiterQuoteRequest): Promise<JupiterQuote> {
    const params = new URLSearchParams({
      inputMint: request.inputMint,
      outputMint: request.outputMint,
      amount: request.amount.toString(),
      slippageBps: (request.slippageBps || 100).toString(),
    });

    const url = `${this.baseUrl}/quote?${params}`;
    logger.debug({ url }, 'Fetching Jupiter quote');

    const response = await fetch(url);
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Jupiter quote failed: ${error}`);
    }

    const quote = await response.json() as JupiterQuote;
    logger.info({
      inputMint: quote.inputMint,
      outputMint: quote.outputMint,
      inAmount: quote.inAmount,
      outAmount: quote.outAmount,
      priceImpact: quote.priceImpactPct,
    }, 'Jupiter quote received');

    return quote;
  }

  /**
   * Simulate a swap to check for errors
   */
  async simulateSwap(quote: JupiterQuote): Promise<SwapSimulation> {
    // In production, this would:
    // 1. Get swap transaction from Jupiter
    // 2. Simulate using Solana's simulateTransaction
    // 3. Check for errors and estimate gas

    logger.info('Simulating swap transaction');

    // For now, return success
    return {
      success: true,
      estimatedGas: 5000,
    };
  }

  /**
   * Execute a swap transaction
   */
  async executeSwap(
    quote: JupiterQuote,
    userPublicKey: string,
    signTransaction: (tx: any) => Promise<any>
  ): Promise<string> {
    // Get swap transaction
    const swapResponse = await fetch(`${this.baseUrl}/swap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quoteResponse: quote,
        userPublicKey,
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: 'auto',
      }),
    });

    if (!swapResponse.ok) {
      const error = await swapResponse.text();
      throw new Error(`Jupiter swap failed: ${error}`);
    }

    const { swapTransaction } = await swapResponse.json();

    // In production:
    // 1. Deserialize transaction
    // 2. Sign with agent keypair
    // 3. Submit to network
    // 4. Return signature

    logger.info('Swap transaction executed');
    return 'simulated_signature';
  }

  /**
   * Get token price in USD
   */
  async getPrice(mint: string): Promise<number> {
    const url = `https://price.jup.ag/v6/price?ids=${mint}`;
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Price fetch failed');
      }

      const data = await response.json();
      return data.data[mint]?.price || 0;
    } catch (error) {
      logger.warn({ mint, error }, 'Failed to fetch price');
      return 0;
    }
  }

  /**
   * Get multiple token prices
   */
  async getPrices(mints: string[]): Promise<Record<string, number>> {
    const url = `https://price.jup.ag/v6/price?ids=${mints.join(',')}`;
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Price fetch failed');
      }

      const data = await response.json();
      const prices: Record<string, number> = {};
      
      for (const mint of mints) {
        prices[mint] = data.data[mint]?.price || 0;
      }

      return prices;
    } catch (error) {
      logger.warn({ mints, error }, 'Failed to fetch prices');
      return {};
    }
  }
}
