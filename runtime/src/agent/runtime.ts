import { Connection, PublicKey, Keypair, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { Config } from '../config.js';
import { PolicyEngine } from '../policy/engine.js';
import { ClaudeLLMProvider } from '../llm/claude.js';
import { JupiterAdapter, MarinadeAdapter, MarginFiAdapter } from '../adapters/index.js';
import { createLogger } from '../utils/logger.js';
import {
  UserIntent,
  ActionPlan,
  AgentContext,
  VaultState,
  Portfolio,
  PolicyConfig,
  ActivityLogEntry,
  Operation,
  TriggerCondition,
  Strategy,
} from '../types/index.js';

const logger = createLogger('runtime');

interface MonitoringState {
  lastPriceCheck: number;
  lastPortfolioCheck: number;
  activeTriggers: TriggerCondition[];
}

export class AgentRuntime {
  private config: Config;
  private connection: Connection;
  private policyEngine: PolicyEngine;
  private llmProvider: ClaudeLLMProvider;
  
  // Protocol adapters
  private jupiterAdapter: JupiterAdapter;
  private marinadeAdapter: MarinadeAdapter;
  private marginfiAdapter: MarginFiAdapter;
  
  private isRunning: boolean = false;
  private monitoringInterval?: NodeJS.Timeout;
  private monitoringState: MonitoringState;
  
  // Agent keypair for signing transactions
  private agentKeypair?: Keypair;

  constructor(config: Config) {
    this.config = config;
    this.connection = new Connection(config.solanaRpcUrl, 'confirmed');
    this.policyEngine = new PolicyEngine();
    this.llmProvider = new ClaudeLLMProvider(config.anthropicApiKey);
    
    // Initialize adapters
    this.jupiterAdapter = new JupiterAdapter();
    this.marinadeAdapter = new MarinadeAdapter(this.connection);
    this.marginfiAdapter = new MarginFiAdapter(this.connection);
    
    // Initialize monitoring state
    this.monitoringState = {
      lastPriceCheck: 0,
      lastPortfolioCheck: 0,
      activeTriggers: [],
    };
  }

  /**
   * Initialize agent keypair from environment or file
   */
  async initialize(agentSecretKey?: Uint8Array): Promise<void> {
    if (agentSecretKey) {
      this.agentKeypair = Keypair.fromSecretKey(agentSecretKey);
      logger.info({ agent: this.agentKeypair.publicKey.toBase58() }, 'Agent keypair loaded');
    }
  }

  async start(): Promise<void> {
    logger.info('Starting agent runtime...');
    this.isRunning = true;

    // Start monitoring loop
    this.startMonitoringLoop();

    logger.info({ 
      rpcUrl: this.config.solanaRpcUrl,
      monitoringInterval: this.config.monitoringIntervalMs,
    }, 'Agent runtime started');
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
    logger.info({ intentId: intent.id, text: intent.text }, 'Processing user intent');

    // 1. Build context
    const context = await this.buildContext(intent.vaultAddress);

    // 2. Generate action plan via LLM
    const actionPlan = await this.llmProvider.generateActionPlan(intent, context);
    logger.info({ 
      planId: actionPlan.id, 
      operations: actionPlan.operations.length,
      reasoning: actionPlan.reasoning.substring(0, 100),
    }, 'Action plan generated');

    // 3. Validate each operation against policy
    const validatedOps: Operation[] = [];
    for (const operation of actionPlan.operations) {
      const validation = this.policyEngine.validateOperation(operation, context.policy);
      
      if (!validation.valid) {
        logger.warn({ operation: operation.type, errors: validation.errors }, 'Operation rejected by policy');
        await this.logActivity(
          intent.vaultAddress, 
          operation.type, 
          'rejected', 
          actionPlan.reasoning, 
          undefined,
          validation.errors
        );
        throw new Error(`Policy violation: ${validation.errors.map(e => e.message).join(', ')}`);
      }
      validatedOps.push(operation);
    }

    // 4. Simulate all transactions
    for (const operation of validatedOps) {
      const simulation = await this.simulateOperation(operation, context);
      if (!simulation.success) {
        throw new Error(`Simulation failed for ${operation.type}: ${simulation.error}`);
      }
      logger.info({ operation: operation.type, gas: simulation.estimatedGas }, 'Simulation passed');
    }

    // 5. Execute operations (if auto-execute enabled)
    const requiresApproval = validatedOps.some(op => op.requiresApproval);
    if (!requiresApproval && this.shouldAutoExecute(validatedOps, context)) {
      const results = await this.executeActionPlan(actionPlan, context);
      actionPlan.executionResults = results;
    } else {
      logger.info({ planId: actionPlan.id }, 'Action plan requires user approval');
      actionPlan.status = 'pending_approval';
    }

    return actionPlan;
  }

  /**
   * Simulate an operation before execution
   */
  private async simulateOperation(
    operation: Operation, 
    context: AgentContext
  ): Promise<{ success: boolean; error?: string; estimatedGas?: number }> {
    try {
      switch (operation.type) {
        case 'swap': {
          const quote = await this.jupiterAdapter.getQuote({
            inputMint: operation.params.inputMint,
            outputMint: operation.params.outputMint,
            amount: operation.params.amount,
            slippageBps: operation.params.slippageBps || context.policy.limits.maxSlippageBps,
          });
          return await this.jupiterAdapter.simulateSwap(quote);
        }
        
        case 'stake': {
          const tx = await this.marinadeAdapter.buildStakeTransaction(
            new PublicKey(context.vault.address),
            operation.params.amount,
          );
          return await this.marinadeAdapter.simulateStake(tx);
        }
        
        case 'lend': {
          const tx = await this.marginfiAdapter.buildDepositTransaction(
            new PublicKey(context.vault.address),
            new PublicKey(operation.params.mint),
            operation.params.amount,
          );
          return await this.marginfiAdapter.simulate(tx);
        }
        
        default:
          return { success: true, estimatedGas: 5000 };
      }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Check if operations should auto-execute based on policy
   */
  private shouldAutoExecute(operations: Operation[], context: AgentContext): boolean {
    for (const op of operations) {
      // New protocols require manual approval
      if (op.type === 'lend' && !context.policy.autoExecute.newProtocols) {
        return false;
      }
    }
    return context.policy.autoExecute.priceTriggers;
  }

  /**
   * Execute an approved action plan
   */
  private async executeActionPlan(
    plan: ActionPlan, 
    context: AgentContext
  ): Promise<{ signatures: string[]; success: boolean }> {
    logger.info({ planId: plan.id }, 'Executing action plan');
    const signatures: string[] = [];

    for (const operation of plan.operations) {
      try {
        let signature: string;
        
        switch (operation.type) {
          case 'swap':
            signature = await this.executeSwap(operation, context);
            break;
          case 'stake':
            signature = await this.executeStake(operation, context);
            break;
          case 'lend':
            signature = await this.executeLend(operation, context);
            break;
          case 'unstake':
            signature = await this.executeUnstake(operation, context);
            break;
          case 'withdraw_lending':
            signature = await this.executeWithdrawLending(operation, context);
            break;
          default:
            logger.warn({ type: operation.type }, 'Unknown operation type, skipping');
            continue;
        }

        signatures.push(signature);
        await this.logActivity(
          context.vault.address, 
          operation.type, 
          'approved', 
          plan.reasoning,
          signature
        );
        
        logger.info({ operation: operation.type, signature }, 'Operation executed');
      } catch (error) {
        logger.error({ error, operation: operation.type }, 'Operation execution failed');
        await this.logActivity(
          context.vault.address,
          operation.type,
          'rejected',
          plan.reasoning,
          undefined,
          [{ message: error instanceof Error ? error.message : 'Unknown error' }]
        );
        return { signatures, success: false };
      }
    }

    return { signatures, success: true };
  }

  private async executeSwap(operation: Operation, context: AgentContext): Promise<string> {
    const { inputMint, outputMint, amount, slippageBps } = operation.params;
    
    // Get quote from Jupiter
    const quote = await this.jupiterAdapter.getQuote({
      inputMint,
      outputMint,
      amount,
      slippageBps: slippageBps || context.policy.limits.maxSlippageBps,
    });

    logger.info({ 
      inputMint, 
      outputMint, 
      inAmount: quote.inAmount,
      outAmount: quote.outAmount,
      priceImpact: quote.priceImpactPct,
    }, 'Executing swap');

    // In production, build and submit transaction
    // const signature = await this.jupiterAdapter.executeSwap(quote, context.vault.address, this.signTransaction);
    
    return 'simulated_swap_signature';
  }

  private async executeStake(operation: Operation, context: AgentContext): Promise<string> {
    const { amount } = operation.params;
    
    const quote = await this.marinadeAdapter.getStakeQuote(amount);
    logger.info({ 
      inputSol: amount,
      outputMsol: quote.outputAmount,
      exchangeRate: quote.exchangeRate,
    }, 'Executing stake');

    const tx = await this.marinadeAdapter.buildStakeTransaction(
      new PublicKey(context.vault.address),
      amount,
    );

    // In production with agent keypair:
    // const signature = await sendAndConfirmTransaction(this.connection, tx, [this.agentKeypair!]);
    
    return 'simulated_stake_signature';
  }

  private async executeLend(operation: Operation, context: AgentContext): Promise<string> {
    const { amount, mint, protocol } = operation.params;
    
    const quote = await this.marginfiAdapter.getDepositQuote(new PublicKey(mint), amount);
    logger.info({ 
      amount,
      mint,
      estimatedApy: quote.estimatedApy,
    }, 'Executing lend');

    const tx = await this.marginfiAdapter.buildDepositTransaction(
      new PublicKey(context.vault.address),
      new PublicKey(mint),
      amount,
    );

    // In production with agent keypair:
    // const signature = await sendAndConfirmTransaction(this.connection, tx, [this.agentKeypair!]);
    
    return 'simulated_lend_signature';
  }

  private async executeUnstake(operation: Operation, context: AgentContext): Promise<string> {
    logger.info({ amount: operation.params.amount }, 'Executing unstake');
    return 'simulated_unstake_signature';
  }

  private async executeWithdrawLending(operation: Operation, context: AgentContext): Promise<string> {
    const { amount, mint } = operation.params;
    
    const tx = await this.marginfiAdapter.buildWithdrawTransaction(
      new PublicKey(context.vault.address),
      new PublicKey(mint),
      amount,
    );

    logger.info({ amount, mint }, 'Executing lending withdrawal');
    return 'simulated_withdraw_signature';
  }

  /**
   * Build context for LLM reasoning
   */
  private async buildContext(vaultAddress: string): Promise<AgentContext> {
    const [vault, portfolio, policy] = await Promise.all([
      this.fetchVaultState(vaultAddress),
      this.fetchPortfolio(vaultAddress),
      this.fetchPolicy(vaultAddress),
    ]);

    const recentActivity = await this.fetchRecentActivity(vaultAddress);

    return {
      vault,
      portfolio,
      policy,
      activeStrategies: [],
      recentActivity,
    };
  }

  private async fetchVaultState(address: string): Promise<VaultState> {
    // In production, fetch from on-chain PDA
    try {
      const vaultPubkey = new PublicKey(address);
      const accountInfo = await this.connection.getAccountInfo(vaultPubkey);
      
      if (!accountInfo) {
        throw new Error('Vault not found');
      }

      // Parse vault account data (would use proper borsh deserialization)
      return {
        address,
        owner: 'owner_pubkey',
        agent: this.agentKeypair?.publicKey.toBase58() || 'agent_pubkey',
        balance: BigInt(accountInfo.lamports),
        status: 'active',
        policyHash: 'hash',
        createdAt: new Date(),
        lastActivity: new Date(),
        txCount: 0,
      };
    } catch (error) {
      logger.warn({ address, error }, 'Failed to fetch vault state, using default');
      return {
        address,
        owner: 'owner_pubkey',
        agent: 'agent_pubkey',
        balance: BigInt(0),
        status: 'active',
        policyHash: 'hash',
        createdAt: new Date(),
        lastActivity: new Date(),
        txCount: 0,
      };
    }
  }

  private async fetchPortfolio(vaultAddress: string): Promise<Portfolio> {
    const positions: Portfolio['positions'] = [];
    
    try {
      const vaultPubkey = new PublicKey(vaultAddress);
      
      // Fetch SOL balance
      const solBalance = await this.connection.getBalance(vaultPubkey);
      const solPrice = await this.jupiterAdapter.getPrice('So11111111111111111111111111111111111111112');
      
      positions.push({
        mint: 'So11111111111111111111111111111111111111112',
        symbol: 'SOL',
        amount: BigInt(solBalance),
        decimals: 9,
        valueUsd: (solBalance / 1e9) * solPrice,
        percentOfPortfolio: 100, // Will be recalculated
      });

      // Fetch mSOL balance
      const msolBalance = await this.marinadeAdapter.getMsolBalance(vaultPubkey);
      if (msolBalance > 0) {
        const msolPrice = solPrice * (await this.marinadeAdapter.getExchangeRate());
        positions.push({
          mint: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',
          symbol: 'mSOL',
          amount: BigInt(msolBalance),
          decimals: 9,
          valueUsd: (msolBalance / 1e9) * msolPrice,
          percentOfPortfolio: 0,
        });
      }

      // Calculate percentages
      const totalValue = positions.reduce((sum, p) => sum + p.valueUsd, 0);
      for (const position of positions) {
        position.percentOfPortfolio = totalValue > 0 ? (position.valueUsd / totalValue) * 100 : 0;
      }

      return {
        totalValueUsd: totalValue,
        totalValueSol: solBalance / 1e9,
        positions,
        lastUpdated: new Date(),
      };
    } catch (error) {
      logger.warn({ vaultAddress, error }, 'Failed to fetch portfolio');
      return {
        totalValueUsd: 0,
        totalValueSol: 0,
        positions: [],
        lastUpdated: new Date(),
      };
    }
  }

  private async fetchPolicy(vaultAddress: string): Promise<PolicyConfig> {
    // In production, fetch from on-chain + off-chain storage
    // For now, return default policy
    return {
      version: 1,
      spending: {
        perTransaction: { sol: 5 },
        daily: { sol: 20 },
      },
      allowlists: {
        assets: [
          'So11111111111111111111111111111111111111112',  // SOL
          'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
          'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',  // mSOL
        ],
        programs: [
          'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',  // Jupiter
          'MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD',  // Marinade
          'MFv2hWf31Z9kbCa1snEPYctwafyhdvnV7FZnsebVacA',  // MarginFi
        ],
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

  private async fetchRecentActivity(vaultAddress: string): Promise<ActivityLogEntry[]> {
    // In production, fetch from database
    return [];
  }

  private async logActivity(
    vaultAddress: string,
    actionType: string,
    decision: 'approved' | 'rejected',
    reasoning: string,
    txSignature?: string,
    errors?: any[]
  ): Promise<void> {
    const entry: ActivityLogEntry = {
      id: crypto.randomUUID(),
      vaultAddress,
      actionType: actionType as any,
      reasoning,
      policyDecision: decision,
      policyErrors: errors,
      txSignature,
      timestamp: new Date(),
    };

    logger.info({ 
      vaultAddress,
      actionType,
      decision,
      txSignature,
    }, 'Activity logged');
    
    // In production, persist to database
  }

  /**
   * Background monitoring loop for trigger evaluation
   */
  private startMonitoringLoop(): void {
    const intervalMs = this.config.monitoringIntervalMs || 30000;
    
    this.monitoringInterval = setInterval(async () => {
      if (!this.isRunning) return;

      try {
        await this.evaluateTriggers();
      } catch (error) {
        logger.error({ error }, 'Error in monitoring loop');
      }
    }, intervalMs);
    
    logger.info({ intervalMs }, 'Monitoring loop started');
  }

  /**
   * Evaluate all active triggers and fire matching ones
   */
  private async evaluateTriggers(): Promise<void> {
    const now = Date.now();
    
    // Check prices every 30 seconds
    if (now - this.monitoringState.lastPriceCheck >= 30000) {
      await this.checkPriceTriggers();
      this.monitoringState.lastPriceCheck = now;
    }
    
    // Check portfolio every 5 minutes
    if (now - this.monitoringState.lastPortfolioCheck >= 300000) {
      await this.checkPortfolioTriggers();
      this.monitoringState.lastPortfolioCheck = now;
    }
  }

  private async checkPriceTriggers(): Promise<void> {
    // In production, iterate through active strategies and check price conditions
    logger.debug('Checking price triggers...');
    
    // Example: Check if SOL price crossed threshold
    try {
      const solPrice = await this.jupiterAdapter.getPrice('So11111111111111111111111111111111111111112');
      logger.debug({ solPrice }, 'Current SOL price');
      
      // Check against active triggers...
    } catch (error) {
      logger.warn({ error }, 'Failed to check price triggers');
    }
  }

  private async checkPortfolioTriggers(): Promise<void> {
    // In production, check portfolio health and rebalancing needs
    logger.debug('Checking portfolio triggers...');
  }

  /**
   * Register a new trigger for monitoring
   */
  async registerTrigger(trigger: TriggerCondition): Promise<void> {
    this.monitoringState.activeTriggers.push(trigger);
    logger.info({ triggerId: trigger.id, type: trigger.type }, 'Trigger registered');
  }

  /**
   * Remove a trigger from monitoring
   */
  async unregisterTrigger(triggerId: string): Promise<void> {
    this.monitoringState.activeTriggers = this.monitoringState.activeTriggers.filter(
      t => t.id !== triggerId
    );
    logger.info({ triggerId }, 'Trigger unregistered');
  }

  /**
   * Get current protocol stats
   */
  async getProtocolStats(): Promise<{
    marinade: { apy: number; exchangeRate: number };
    marginfi: { pools: any[] };
  }> {
    const [marinadeApy, exchangeRate, marginfiPools] = await Promise.all([
      this.marinadeAdapter.getApyEstimate(),
      this.marinadeAdapter.getExchangeRate(),
      this.marginfiAdapter.getPools(),
    ]);

    return {
      marinade: { apy: marinadeApy, exchangeRate },
      marginfi: { pools: marginfiPools },
    };
  }
}
