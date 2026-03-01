import { PublicKey } from '@solana/web3.js';

// ============================================================================
// Core Types
// ============================================================================

export interface UserIntent {
  id: string;
  userId: string;
  vaultAddress: string;
  text: string;
  timestamp: Date;
}

export interface ActionPlan {
  id: string;
  intentId: string;
  operations: Operation[];
  reasoning: string;
  estimatedGas: number;
  status?: 'pending' | 'pending_approval' | 'executing' | 'completed' | 'failed';
  executionResults?: {
    signatures: string[];
    success: boolean;
  };
  createdAt: Date;
}

export interface Operation {
  type: OperationType;
  params: Record<string, unknown>;
  estimatedGas: number;
  requiresApproval: boolean;
}

export type OperationType =
  | 'swap'
  | 'stake'
  | 'unstake'
  | 'lend'
  | 'withdraw_lending'
  | 'transfer'
  | 'set_trigger';

// ============================================================================
// Policy Types
// ============================================================================

export interface PolicyConfig {
  version: number;
  spending: SpendingLimits;
  allowlists: Allowlists;
  limits: PositionLimits;
  autoExecute: AutoExecuteConfig;
}

export interface SpendingLimits {
  perTransaction: { sol: number };
  daily: { sol: number };
}

export interface Allowlists {
  assets: string[];
  programs: string[];
}

export interface PositionLimits {
  maxPositionPercent: number;
  minStablecoinPercent: number;
  maxSlippageBps: number;
}

export interface AutoExecuteConfig {
  priceTriggers: boolean;
  newProtocols: boolean;
}

export interface PolicyValidationResult {
  valid: boolean;
  errors: PolicyError[];
  warnings: PolicyWarning[];
}

export interface PolicyError {
  code: string;
  message: string;
  field?: string;
}

export interface PolicyWarning {
  code: string;
  message: string;
}

// ============================================================================
// Vault Types
// ============================================================================

export interface VaultState {
  address: string;
  owner: string;
  agent: string;
  balance: bigint;
  status: VaultStatus;
  policyHash: string;
  createdAt: Date;
  lastActivity: Date;
  txCount: number;
}

export type VaultStatus = 'active' | 'paused' | 'halted';

export interface Portfolio {
  totalValueUsd: number;
  totalValueSol: number;
  positions: Position[];
  lastUpdated: Date;
}

export interface Position {
  mint: string;
  symbol: string;
  amount: bigint;
  decimals: number;
  valueUsd: number;
  valueSol?: number;
  percentOfPortfolio: number;
}

// ============================================================================
// Strategy Types
// ============================================================================

export interface Strategy {
  id: string;
  name: string;
  description: string;
  creator: string;
  subscriptionFee: bigint;
  performanceFeeBps: number;
  subscriberCount: number;
  status: StrategyStatus;
  triggers: Trigger[];
  createdAt: Date;
}

export type StrategyStatus = 'active' | 'paused' | 'deprecated';

export interface Trigger {
  id: string;
  type: TriggerType;
  condition: TriggerCondition;
  action: TriggerAction;
  enabled: boolean;
}

export type TriggerType = 'price' | 'time' | 'portfolio' | 'event';

export interface TriggerCondition {
  id: string;
  type: TriggerType;
  field: string;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  value: number | string;
  action?: TriggerAction;
  enabled: boolean;
}

export interface TriggerAction {
  type: OperationType;
  params: Record<string, unknown>;
}

// ============================================================================
// Activity Types
// ============================================================================

export interface ActivityLogEntry {
  id: string;
  vaultAddress: string;
  actionType: OperationType;
  txSignature?: string;
  reasoning: string;
  policyDecision: 'approved' | 'rejected';
  policyErrors?: PolicyError[];
  gasUsed?: number;
  timestamp: Date;
}

// ============================================================================
// LLM Types
// ============================================================================

export interface LLMProvider {
  name: string;
  generateActionPlan(intent: UserIntent, context: AgentContext): Promise<ActionPlan>;
  explainAction(operation: Operation): Promise<string>;
}

export interface AgentContext {
  vault: VaultState;
  portfolio: Portfolio;
  policy: PolicyConfig;
  activeStrategies: Strategy[];
  recentActivity: ActivityLogEntry[];
}

// ============================================================================
// Tool Types (MCP)
// ============================================================================

export interface Tool {
  name: string;
  description: string;
  parameters: ToolParameter[];
  execute(params: Record<string, unknown>): Promise<ToolResult>;
}

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object';
  description: string;
  required: boolean;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}
