import {
  Operation,
  PolicyConfig,
  PolicyValidationResult,
  PolicyError,
  PolicyWarning,
} from '../types/index.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('policy-engine');

const LAMPORTS_PER_SOL = 1_000_000_000;

export class PolicyEngine {
  /**
   * Validate an operation against a policy configuration
   */
  validateOperation(operation: Operation, policy: PolicyConfig): PolicyValidationResult {
    const errors: PolicyError[] = [];
    const warnings: PolicyWarning[] = [];

    switch (operation.type) {
      case 'swap':
        this.validateSwap(operation, policy, errors, warnings);
        break;
      case 'stake':
      case 'unstake':
        this.validateStake(operation, policy, errors, warnings);
        break;
      case 'lend':
      case 'withdraw_lending':
        this.validateLending(operation, policy, errors, warnings);
        break;
      case 'transfer':
        this.validateTransfer(operation, policy, errors, warnings);
        break;
      default:
        warnings.push({
          code: 'UNKNOWN_OPERATION',
          message: `Unknown operation type: ${operation.type}`,
        });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private validateSwap(
    operation: Operation,
    policy: PolicyConfig,
    errors: PolicyError[],
    warnings: PolicyWarning[]
  ): void {
    const { inputMint, outputMint, amount, slippageBps } = operation.params as any;

    // Check spending limits
    const amountSol = Number(amount) / LAMPORTS_PER_SOL;
    
    if (amountSol > policy.spending.perTransaction.sol) {
      errors.push({
        code: 'TX_LIMIT_EXCEEDED',
        message: `Transaction amount ${amountSol} SOL exceeds limit of ${policy.spending.perTransaction.sol} SOL`,
        field: 'amount',
      });
    }

    // Check asset allowlist
    if (policy.allowlists.assets.length > 0) {
      if (!policy.allowlists.assets.includes(inputMint)) {
        errors.push({
          code: 'ASSET_NOT_ALLOWED',
          message: `Input token ${inputMint} not in allowlist`,
          field: 'inputMint',
        });
      }
      if (!policy.allowlists.assets.includes(outputMint)) {
        errors.push({
          code: 'ASSET_NOT_ALLOWED',
          message: `Output token ${outputMint} not in allowlist`,
          field: 'outputMint',
        });
      }
    }

    // Check slippage
    if (slippageBps && slippageBps > policy.limits.maxSlippageBps) {
      errors.push({
        code: 'SLIPPAGE_EXCEEDED',
        message: `Slippage ${slippageBps} bps exceeds max ${policy.limits.maxSlippageBps} bps`,
        field: 'slippageBps',
      });
    }

    // Add warning for large trades
    if (amountSol > policy.spending.perTransaction.sol * 0.8) {
      warnings.push({
        code: 'LARGE_TRANSACTION',
        message: `Transaction is ${((amountSol / policy.spending.perTransaction.sol) * 100).toFixed(0)}% of limit`,
      });
    }
  }

  private validateStake(
    operation: Operation,
    policy: PolicyConfig,
    errors: PolicyError[],
    warnings: PolicyWarning[]
  ): void {
    const { amount, protocol } = operation.params as any;

    // Check spending limits
    const amountSol = Number(amount) / LAMPORTS_PER_SOL;
    
    if (amountSol > policy.spending.perTransaction.sol) {
      errors.push({
        code: 'TX_LIMIT_EXCEEDED',
        message: `Stake amount ${amountSol} SOL exceeds limit of ${policy.spending.perTransaction.sol} SOL`,
        field: 'amount',
      });
    }

    // Check program allowlist
    if (policy.allowlists.programs.length > 0 && protocol) {
      if (!policy.allowlists.programs.includes(protocol)) {
        errors.push({
          code: 'PROGRAM_NOT_ALLOWED',
          message: `Staking protocol ${protocol} not in allowlist`,
          field: 'protocol',
        });
      }
    }
  }

  private validateLending(
    operation: Operation,
    policy: PolicyConfig,
    errors: PolicyError[],
    warnings: PolicyWarning[]
  ): void {
    const { amount, protocol, mint } = operation.params as any;

    // Check spending limits
    const amountSol = Number(amount) / LAMPORTS_PER_SOL;
    
    if (amountSol > policy.spending.perTransaction.sol) {
      errors.push({
        code: 'TX_LIMIT_EXCEEDED',
        message: `Lending amount exceeds limit`,
        field: 'amount',
      });
    }

    // Check program allowlist
    if (policy.allowlists.programs.length > 0 && protocol) {
      if (!policy.allowlists.programs.includes(protocol)) {
        errors.push({
          code: 'PROGRAM_NOT_ALLOWED',
          message: `Lending protocol ${protocol} not in allowlist`,
          field: 'protocol',
        });
      }
    }

    // Check asset allowlist
    if (policy.allowlists.assets.length > 0 && mint) {
      if (!policy.allowlists.assets.includes(mint)) {
        errors.push({
          code: 'ASSET_NOT_ALLOWED',
          message: `Token ${mint} not in allowlist`,
          field: 'mint',
        });
      }
    }
  }

  private validateTransfer(
    operation: Operation,
    policy: PolicyConfig,
    errors: PolicyError[],
    warnings: PolicyWarning[]
  ): void {
    // Transfers are generally restricted
    errors.push({
      code: 'TRANSFER_NOT_ALLOWED',
      message: 'Direct transfers require owner approval',
    });
  }

  /**
   * Calculate hash of policy for on-chain verification
   */
  calculatePolicyHash(policy: PolicyConfig): string {
    const serialized = JSON.stringify(policy);
    // In production, use proper crypto hashing
    const encoder = new TextEncoder();
    const data = encoder.encode(serialized);
    
    // Simple hash for demonstration
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      hash = ((hash << 5) - hash) + data[i];
      hash = hash & hash;
    }
    
    return hash.toString(16).padStart(64, '0');
  }
}
