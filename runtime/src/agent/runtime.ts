import { Connection, PublicKey } from '@solana/web3.js';
import { Config } from '../config.js';
import { PolicyEngine } from '../policy/engine.js';
import { ClaudeLLMProvider } from '../llm/claude.js';
import { JupiterAdapter } from '../adapters/jupiter.js';
import { createLogger } from '../utils/logger.js';
import {
  UserIntent,
  ActionPlan,
  AgentContext,
  VaultState,
  Portfolio,
  PolicyConfig,
  ActivityLogEntry,
} from '../types/index.js';

const logger = createLogger('runtime');

export class AgentRuntime {
  private config: Config;
  private connection: Connection;
  private policyEngine: PolicyEngine;
  private llmProvider: ClaudeLLMProvider;
  private jupiterAdapter: JupiterAdapter;
  private isRunning: boolean = false;
  private monitoringInterval?: NodeJS.Timeout;

  constructor(config: Config) {
    this.config = config;
    this.connection = new Connection(config.solanaRpcUrl, 'confirmed');
    this.policyEngine = new PolicyEngine();
    this.llmProvider = new ClaudeLLMProvider(config.anthropicApiKey);
    this.jupiterAdapter = new JupiterAdapter();
  }

  async start(): Promise<void> {
    logger.info('Starting agent runtime...');
    this.isRunning = true;

    // Start monitoring loop
    this.startMonitoringLoop();

    logger.info('Agent runtime started');
  }

  async stop(): Promise<void> {
    logger.info('Stopping agent runtime...');
    this.isRunning = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    logger.info('Agent runtime stopped');
  }

  /**
   * Process a user intent and execute if approved
   */
  async processIntent(intent: UserIntent): Promise<ActionPlan> {
    logger.info({ intentId: intent.id }, 'Processing user intent');

    // 1. Build context
    const context = await this.buildContext(intent.vaultAddress);

    // 2. Generate action plan via LLM
    const actionPlan = await this.llmProvider.generateActionPlan(intent, context);
    logger.info({ planId: actionPlan.id, operations: actionPlan.operations.length }, 'Action plan generated');

    // 3. Validate against policy
    for (const operation of actionPlan.operations) {
      const validation = this.policyEngine.validateOperation(operation, context.policy);
      
      if (!validation.valid) {
        logger.warn({ operation, errors: validation.errors }, 'Operation rejected by policy');
        await this.logActivity(intent.vaultAddress, operation.type, 'rejected', actionPlan.reasoning, validation.errors);
        throw new Error(`Policy violation: ${validation.errors.map(e => e.message).join(', ')}`);
      }
    }

    // 4. Execute operations (if auto-execute enabled or approved)
    if (context.policy.autoExecute.priceTriggers) {
      await this.executeActionPlan(actionPlan, context);
    }

    return actionPlan;
  }

  /**
   * Execute an approved action plan
   */
  private async executeActionPlan(plan: ActionPlan, context: AgentContext): Promise<void> {
    logger.info({ planId: plan.id }, 'Executing action plan');

    for (const operation of plan.operations) {
      try {
        switch (operation.type) {
          case 'swap':
            await this.executeSwap(operation, context);
            break;
          case 'stake':
            await this.executeStake(operation, context);
            break;
          default:
            logger.warn({ type: operation.type }, 'Unknown operation type');
        }

        await this.logActivity(context.vault.address, operation.type, 'approved', plan.reasoning);
      } catch (error) {
        logger.error({ error, operation }, 'Operation execution failed');
        throw error;
      }
    }
  }

  private async executeSwap(operation: any, context: AgentContext): Promise<string> {
    const { inputMint, outputMint, amount, slippageBps } = operation.params;
    
    // Get quote from Jupiter
    const quote = await this.jupiterAdapter.getQuote({
      inputMint,
      outputMint,
      amount,
      slippageBps: slippageBps || context.policy.limits.maxSlippageBps,
    });

    logger.info({ quote }, 'Jupiter quote received');

    // Simulate transaction
    const simulation = await this.jupiterAdapter.simulateSwap(quote);
    if (!simulation.success) {
      throw new Error(`Swap simulation failed: ${simulation.error}`);
    }

    // Execute swap
    // In production, this would submit the transaction
    logger.info('Swap executed successfully');
    return 'simulated_tx_signature';
  }

  private async executeStake(operation: any, context: AgentContext): Promise<string> {
    const { amount, protocol } = operation.params;
    
    logger.info({ amount, protocol }, 'Executing stake');
    
    // In production, this would call the staking protocol
    return 'simulated_tx_signature';
  }

  /**
   * Build context for LLM reasoning
   */
  private async buildContext(vaultAddress: string): Promise<AgentContext> {
    const vault = await this.fetchVaultState(vaultAddress);
    const portfolio = await this.fetchPortfolio(vaultAddress);
    const policy = await this.fetchPolicy(vaultAddress);

    return {
      vault,
      portfolio,
      policy,
      activeStrategies: [],
      recentActivity: [],
    };
  }

  private async fetchVaultState(address: string): Promise<VaultState> {
    // In production, fetch from on-chain
    return {
      address,
      owner: 'owner_pubkey',
      agent: 'agent_pubkey',
      balance: BigInt(1000000000),
      status: 'active',
      policyHash: 'hash',
      createdAt: new Date(),
      lastActivity: new Date(),
      txCount: 0,
    };
  }

  private async fetchPortfolio(vaultAddress: string): Promise<Portfolio> {
    // In production, fetch token accounts and prices
    return {
      totalValueUsd: 1000,
      totalValueSol: 10,
      positions: [],
      lastUpdated: new Date(),
    };
  }

  private async fetchPolicy(vaultAddress: string): Promise<PolicyConfig> {
    // In production, fetch from on-chain + off-chain storage
    return {
      version: 1,
      spending: {
        perTransaction: { sol: 5 },
        daily: { sol: 20 },
      },
      allowlists: {
        assets: [],
        programs: [],
      },
      limits: {
        maxPositionPercent: 30,
        minStablecoinPercent: 20,
        maxSlippageBps: 100,
      },
      autoExecute: {
        priceTriggers: true,
        newProtocols: false,
      },
    };
  }

  private async logActivity(
    vaultAddress: string,
    actionType: string,
    decision: 'approved' | 'rejected',
    reasoning: string,
    errors?: any[]
  ): Promise<void> {
    const entry: ActivityLogEntry = {
      id: crypto.randomUUID(),
      vaultAddress,
      actionType: actionType as any,
      reasoning,
      policyDecision: decision,
      policyErrors: errors,
      timestamp: new Date(),
    };

    logger.info({ entry }, 'Activity logged');
    // In production, persist to database
  }

  /**
   * Background monitoring loop for trigger evaluation
   */
  private startMonitoringLoop(): void {
    this.monitoringInterval = setInterval(async () => {
      if (!this.isRunning) return;

      try {
        await this.evaluateTriggers();
      } catch (error) {
        logger.error({ error }, 'Error in monitoring loop');
      }
    }, this.config.monitoringIntervalMs);
  }

  private async evaluateTriggers(): Promise<void> {
    // In production, iterate through active strategies and check triggers
    logger.debug('Evaluating triggers...');
  }
}
