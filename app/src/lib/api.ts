/**
 * AgentVault API Client
 * 
 * HTTP client for the runtime API
 */

const API_BASE = process.env.NEXT_PUBLIC_RUNTIME_URL || 'http://localhost:3001';

// ============================================================================
// Types
// ============================================================================

export interface Vault {
  address: string;
  owner: string;
  agent: string;
  balance: string;
  status: 'active' | 'paused' | 'halted';
  policyHash: string;
  txCount: number;
}

export interface Portfolio {
  vaultAddress: string;
  totalValueUsd: number;
  totalValueSol: number;
  positions: Position[];
  lastUpdated: string;
}

export interface Position {
  mint: string;
  symbol: string;
  amount: string;
  decimals: number;
  valueUsd: number;
  percentOfPortfolio: number;
}

export interface ActivityEntry {
  id: string;
  vaultAddress: string;
  actionType: string;
  txSignature?: string;
  reasoning: string;
  policyDecision: 'approved' | 'rejected';
  policyErrors?: { message: string }[];
  timestamp: string;
}

export interface Policy {
  vaultAddress: string;
  version: number;
  spending: {
    perTransaction: { sol: number };
    daily: { sol: number };
  };
  allowlists: {
    assets: string[];
    programs: string[];
  };
  limits: {
    maxPositionPercent: number;
    minStablecoinPercent: number;
    maxSlippageBps: number;
  };
  autoExecute: {
    priceTriggers: boolean;
    newProtocols: boolean;
  };
}

export interface ActionPlan {
  id: string;
  intentId: string;
  operations: Operation[];
  reasoning: string;
  estimatedGas: number;
  status?: string;
  executionResults?: {
    signatures: string[];
    success: boolean;
  };
}

export interface Operation {
  type: string;
  params: Record<string, unknown>;
  estimatedGas: number;
  requiresApproval: boolean;
}

export interface SwapQuote {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  priceImpactPct: string;
}

export interface StakeQuote {
  inputAmount: number;
  outputAmount: number;
  exchangeRate: number;
  fee: number;
  apy: number;
}

export interface ProtocolStats {
  marinade: {
    apy: number;
    exchangeRate: number;
  };
  marginfi: {
    pools: Array<{
      bank: string;
      mint: string;
      symbol: string;
      depositApy: number;
      borrowApy: number;
    }>;
  };
}

// ============================================================================
// API Client
// ============================================================================

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new ApiError(res.status, error.error || 'Request failed');
  }

  return res.json();
}

// ============================================================================
// API Methods
// ============================================================================

export const api = {
  // Health & Stats
  async health(): Promise<{ status: string; timestamp: string; version: string }> {
    return fetchApi('/health');
  },

  async stats(): Promise<{
    websocket: { connectedClients: number; subscribedVaults: number; pendingPlans: number };
    uptime: number;
  }> {
    return fetchApi('/stats');
  },

  // Protocols
  async getProtocols(): Promise<{
    protocols: Array<{ name: string; type: string; programId: string; status: string }>;
  }> {
    return fetchApi('/protocols');
  },

  async getProtocolStats(): Promise<ProtocolStats> {
    return fetchApi('/protocols/stats');
  },

  // Vaults
  async getVault(address: string): Promise<Vault> {
    return fetchApi(`/vaults/${address}`);
  },

  async getPortfolio(address: string): Promise<Portfolio> {
    return fetchApi(`/vaults/${address}/portfolio`);
  },

  async getActivity(address: string, limit = 50): Promise<{
    vaultAddress: string;
    activities: ActivityEntry[];
    total: number;
  }> {
    return fetchApi(`/vaults/${address}/activity?limit=${limit}`);
  },

  async getPolicy(address: string): Promise<Policy> {
    return fetchApi(`/vaults/${address}/policy`);
  },

  // Intents
  async submitIntent(vaultAddress: string, text: string): Promise<{ actionPlan: ActionPlan }> {
    return fetchApi(`/vaults/${vaultAddress}/intents`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
  },

  // Prices
  async getPrice(mint: string): Promise<{ mint: string; priceUsd: number; timestamp: string }> {
    return fetchApi(`/prices/${mint}`);
  },

  async getPrices(mints: string[]): Promise<{ prices: Record<string, number> }> {
    return fetchApi('/prices', {
      method: 'POST',
      body: JSON.stringify({ mints }),
    });
  },

  // Quotes
  async getSwapQuote(inputMint: string, outputMint: string, amount: number, slippageBps = 100): Promise<SwapQuote> {
    return fetchApi('/quotes/swap', {
      method: 'POST',
      body: JSON.stringify({ inputMint, outputMint, amount, slippageBps }),
    });
  },

  async getStakeQuote(amount: number): Promise<StakeQuote> {
    return fetchApi('/quotes/stake', {
      method: 'POST',
      body: JSON.stringify({ amount }),
    });
  },

  async getLendQuote(mint: string, amount: number, protocol = 'marginfi'): Promise<{
    mint: string;
    amount: number;
    protocol: string;
    estimatedApy: number;
    utilizationRate: number;
  }> {
    return fetchApi('/quotes/lend', {
      method: 'POST',
      body: JSON.stringify({ mint, amount, protocol }),
    });
  },
};

export { ApiError };
