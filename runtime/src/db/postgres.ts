import { createLogger } from '../utils/logger.js';
import {
  ActivityLogEntry,
  VaultState,
  PolicyConfig,
  Strategy,
  UserPosition,
} from '../types/index.js';

const logger = createLogger('postgres');

// ============================================================================
// Database Schema Types
// ============================================================================

export interface DbVault {
  address: string;
  owner: string;
  agent: string;
  balance: string;
  status: string;
  policy_hash: string;
  created_at: Date;
  updated_at: Date;
}

export interface DbActivity {
  id: string;
  vault_address: string;
  action_type: string;
  tx_signature: string | null;
  reasoning: string;
  policy_decision: string;
  policy_errors: any | null;
  gas_used: number | null;
  created_at: Date;
}

export interface DbStrategy {
  id: string;
  name: string;
  description: string;
  creator: string;
  config: any;
  subscription_fee: string;
  performance_fee_bps: number;
  subscriber_count: number;
  status: string;
  created_at: Date;
  updated_at: Date;
}

export interface DbSubscription {
  id: string;
  vault_address: string;
  strategy_id: string;
  subscribed_at: Date;
  status: string;
}

// ============================================================================
// PostgreSQL Client
// ============================================================================

export class PostgresClient {
  private connectionString: string;
  private pool: any; // pg.Pool in production

  constructor(connectionString: string) {
    this.connectionString = connectionString;
    logger.info('PostgreSQL client initialized');
  }

  async connect(): Promise<void> {
    // In production, use pg package:
    // const { Pool } = await import('pg');
    // this.pool = new Pool({ connectionString: this.connectionString });
    logger.info('PostgreSQL connected');
  }

  async disconnect(): Promise<void> {
    // await this.pool?.end();
    logger.info('PostgreSQL disconnected');
  }

  // ============================================================================
  // Vault Operations
  // ============================================================================

  async getVault(address: string): Promise<DbVault | null> {
    logger.debug({ address }, 'Fetching vault');
    // const result = await this.pool.query(
    //   'SELECT * FROM vaults WHERE address = $1',
    //   [address]
    // );
    // return result.rows[0] || null;
    return null;
  }

  async upsertVault(vault: Partial<DbVault> & { address: string }): Promise<void> {
    logger.debug({ address: vault.address }, 'Upserting vault');
    // await this.pool.query(`
    //   INSERT INTO vaults (address, owner, agent, balance, status, policy_hash, created_at, updated_at)
    //   VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
    //   ON CONFLICT (address) DO UPDATE SET
    //     owner = COALESCE(EXCLUDED.owner, vaults.owner),
    //     agent = COALESCE(EXCLUDED.agent, vaults.agent),
    //     balance = COALESCE(EXCLUDED.balance, vaults.balance),
    //     status = COALESCE(EXCLUDED.status, vaults.status),
    //     policy_hash = COALESCE(EXCLUDED.policy_hash, vaults.policy_hash),
    //     updated_at = NOW()
    // `, [vault.address, vault.owner, vault.agent, vault.balance, vault.status, vault.policy_hash]);
  }

  async listVaults(limit: number = 100, offset: number = 0): Promise<DbVault[]> {
    // const result = await this.pool.query(
    //   'SELECT * FROM vaults ORDER BY created_at DESC LIMIT $1 OFFSET $2',
    //   [limit, offset]
    // );
    // return result.rows;
    return [];
  }

  // ============================================================================
  // Activity Log Operations
  // ============================================================================

  async logActivity(entry: ActivityLogEntry): Promise<void> {
    logger.debug({ id: entry.id, actionType: entry.actionType }, 'Logging activity');
    // await this.pool.query(`
    //   INSERT INTO activity_logs (id, vault_address, action_type, tx_signature, reasoning, policy_decision, policy_errors, gas_used, created_at)
    //   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    // `, [
    //   entry.id,
    //   entry.vaultAddress,
    //   entry.actionType,
    //   entry.txSignature,
    //   entry.reasoning,
    //   entry.policyDecision,
    //   JSON.stringify(entry.policyErrors),
    //   entry.gasUsed,
    //   entry.timestamp
    // ]);
  }

  async getActivity(
    vaultAddress: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<ActivityLogEntry[]> {
    logger.debug({ vaultAddress, limit, offset }, 'Fetching activity');
    // const result = await this.pool.query(`
    //   SELECT * FROM activity_logs
    //   WHERE vault_address = $1
    //   ORDER BY created_at DESC
    //   LIMIT $2 OFFSET $3
    // `, [vaultAddress, limit, offset]);
    // return result.rows.map(this.mapActivityRow);
    return [];
  }

  async getActivityCount(vaultAddress: string): Promise<number> {
    // const result = await this.pool.query(
    //   'SELECT COUNT(*) FROM activity_logs WHERE vault_address = $1',
    //   [vaultAddress]
    // );
    // return parseInt(result.rows[0].count);
    return 0;
  }

  async getRecentActivity(vaultAddress: string, since: Date): Promise<ActivityLogEntry[]> {
    // const result = await this.pool.query(`
    //   SELECT * FROM activity_logs
    //   WHERE vault_address = $1 AND created_at > $2
    //   ORDER BY created_at DESC
    // `, [vaultAddress, since]);
    // return result.rows.map(this.mapActivityRow);
    return [];
  }

  // ============================================================================
  // Strategy Operations
  // ============================================================================

  async getStrategy(id: string): Promise<DbStrategy | null> {
    // const result = await this.pool.query(
    //   'SELECT * FROM strategies WHERE id = $1',
    //   [id]
    // );
    // return result.rows[0] || null;
    return null;
  }

  async listStrategies(
    filters?: { status?: string; creator?: string },
    limit: number = 50,
    offset: number = 0
  ): Promise<DbStrategy[]> {
    // let query = 'SELECT * FROM strategies WHERE 1=1';
    // const params: any[] = [];
    // if (filters?.status) {
    //   params.push(filters.status);
    //   query += ` AND status = $${params.length}`;
    // }
    // if (filters?.creator) {
    //   params.push(filters.creator);
    //   query += ` AND creator = $${params.length}`;
    // }
    // params.push(limit, offset);
    // query += ` ORDER BY subscriber_count DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;
    // const result = await this.pool.query(query, params);
    // return result.rows;
    return [];
  }

  async createStrategy(strategy: Omit<DbStrategy, 'created_at' | 'updated_at'>): Promise<void> {
    // await this.pool.query(`
    //   INSERT INTO strategies (id, name, description, creator, config, subscription_fee, performance_fee_bps, subscriber_count, status, created_at, updated_at)
    //   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
    // `, [strategy.id, strategy.name, strategy.description, strategy.creator, JSON.stringify(strategy.config), strategy.subscription_fee, strategy.performance_fee_bps, strategy.subscriber_count, strategy.status]);
  }

  async updateStrategySubscriberCount(strategyId: string, delta: number): Promise<void> {
    // await this.pool.query(`
    //   UPDATE strategies SET subscriber_count = subscriber_count + $1, updated_at = NOW()
    //   WHERE id = $2
    // `, [delta, strategyId]);
  }

  // ============================================================================
  // Subscription Operations
  // ============================================================================

  async getSubscription(vaultAddress: string, strategyId: string): Promise<DbSubscription | null> {
    // const result = await this.pool.query(
    //   'SELECT * FROM subscriptions WHERE vault_address = $1 AND strategy_id = $2',
    //   [vaultAddress, strategyId]
    // );
    // return result.rows[0] || null;
    return null;
  }

  async getVaultSubscriptions(vaultAddress: string): Promise<DbSubscription[]> {
    // const result = await this.pool.query(
    //   'SELECT * FROM subscriptions WHERE vault_address = $1 AND status = $2',
    //   [vaultAddress, 'active']
    // );
    // return result.rows;
    return [];
  }

  async createSubscription(subscription: Omit<DbSubscription, 'subscribed_at'>): Promise<void> {
    // await this.pool.query(`
    //   INSERT INTO subscriptions (id, vault_address, strategy_id, subscribed_at, status)
    //   VALUES ($1, $2, $3, NOW(), $4)
    // `, [subscription.id, subscription.vault_address, subscription.strategy_id, subscription.status]);
  }

  async updateSubscriptionStatus(id: string, status: string): Promise<void> {
    // await this.pool.query(
    //   'UPDATE subscriptions SET status = $1 WHERE id = $2',
    //   [status, id]
    // );
  }

  // ============================================================================
  // Performance Tracking
  // ============================================================================

  async recordPerformance(
    strategyId: string,
    epoch: number,
    pnlBps: number,
    metadata?: any
  ): Promise<void> {
    // await this.pool.query(`
    //   INSERT INTO performance_logs (strategy_id, epoch, pnl_bps, metadata, created_at)
    //   VALUES ($1, $2, $3, $4, NOW())
    // `, [strategyId, epoch, pnlBps, JSON.stringify(metadata)]);
  }

  async getPerformanceHistory(
    strategyId: string,
    limit: number = 30
  ): Promise<{ epoch: number; pnlBps: number; createdAt: Date }[]> {
    // const result = await this.pool.query(`
    //   SELECT epoch, pnl_bps, created_at FROM performance_logs
    //   WHERE strategy_id = $1
    //   ORDER BY epoch DESC
    //   LIMIT $2
    // `, [strategyId, limit]);
    // return result.rows.map(r => ({ epoch: r.epoch, pnlBps: r.pnl_bps, createdAt: r.created_at }));
    return [];
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private mapActivityRow(row: any): ActivityLogEntry {
    return {
      id: row.id,
      vaultAddress: row.vault_address,
      actionType: row.action_type,
      txSignature: row.tx_signature,
      reasoning: row.reasoning,
      policyDecision: row.policy_decision,
      policyErrors: row.policy_errors,
      gasUsed: row.gas_used,
      timestamp: row.created_at,
    };
  }
}

// ============================================================================
// Database Migrations
// ============================================================================

export const MIGRATIONS = [
  {
    version: 1,
    name: 'initial_schema',
    sql: `
      -- Vaults table
      CREATE TABLE IF NOT EXISTS vaults (
        address VARCHAR(44) PRIMARY KEY,
        owner VARCHAR(44) NOT NULL,
        agent VARCHAR(44) NOT NULL,
        balance NUMERIC(20, 0) NOT NULL DEFAULT 0,
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        policy_hash VARCHAR(64),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE INDEX idx_vaults_owner ON vaults(owner);
      CREATE INDEX idx_vaults_status ON vaults(status);

      -- Activity logs table
      CREATE TABLE IF NOT EXISTS activity_logs (
        id UUID PRIMARY KEY,
        vault_address VARCHAR(44) NOT NULL REFERENCES vaults(address),
        action_type VARCHAR(50) NOT NULL,
        tx_signature VARCHAR(88),
        reasoning TEXT,
        policy_decision VARCHAR(20) NOT NULL,
        policy_errors JSONB,
        gas_used INTEGER,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE INDEX idx_activity_vault ON activity_logs(vault_address);
      CREATE INDEX idx_activity_created ON activity_logs(created_at DESC);
      CREATE INDEX idx_activity_action ON activity_logs(action_type);

      -- Strategies table
      CREATE TABLE IF NOT EXISTS strategies (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        creator VARCHAR(44) NOT NULL,
        config JSONB NOT NULL,
        subscription_fee NUMERIC(20, 0) NOT NULL DEFAULT 0,
        performance_fee_bps INTEGER NOT NULL DEFAULT 0,
        subscriber_count INTEGER NOT NULL DEFAULT 0,
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE INDEX idx_strategies_creator ON strategies(creator);
      CREATE INDEX idx_strategies_status ON strategies(status);
      CREATE INDEX idx_strategies_subscribers ON strategies(subscriber_count DESC);

      -- Subscriptions table
      CREATE TABLE IF NOT EXISTS subscriptions (
        id UUID PRIMARY KEY,
        vault_address VARCHAR(44) NOT NULL REFERENCES vaults(address),
        strategy_id VARCHAR(64) NOT NULL REFERENCES strategies(id),
        subscribed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        UNIQUE(vault_address, strategy_id)
      );

      CREATE INDEX idx_subscriptions_vault ON subscriptions(vault_address);
      CREATE INDEX idx_subscriptions_strategy ON subscriptions(strategy_id);

      -- Performance logs table
      CREATE TABLE IF NOT EXISTS performance_logs (
        id SERIAL PRIMARY KEY,
        strategy_id VARCHAR(64) NOT NULL REFERENCES strategies(id),
        epoch BIGINT NOT NULL,
        pnl_bps INTEGER NOT NULL,
        metadata JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(strategy_id, epoch)
      );

      CREATE INDEX idx_performance_strategy ON performance_logs(strategy_id);
      CREATE INDEX idx_performance_epoch ON performance_logs(epoch DESC);
    `,
  },
  {
    version: 2,
    name: 'add_policies_table',
    sql: `
      -- Policies table for off-chain policy storage
      CREATE TABLE IF NOT EXISTS policies (
        id UUID PRIMARY KEY,
        vault_address VARCHAR(44) NOT NULL REFERENCES vaults(address),
        version INTEGER NOT NULL,
        config JSONB NOT NULL,
        hash VARCHAR(64) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        is_active BOOLEAN NOT NULL DEFAULT true
      );

      CREATE INDEX idx_policies_vault ON policies(vault_address);
      CREATE INDEX idx_policies_active ON policies(vault_address, is_active) WHERE is_active = true;
    `,
  },
  {
    version: 3,
    name: 'add_triggers_table',
    sql: `
      -- Triggers table for monitoring conditions
      CREATE TABLE IF NOT EXISTS triggers (
        id UUID PRIMARY KEY,
        vault_address VARCHAR(44) NOT NULL REFERENCES vaults(address),
        strategy_id VARCHAR(64) REFERENCES strategies(id),
        type VARCHAR(50) NOT NULL,
        condition JSONB NOT NULL,
        action JSONB NOT NULL,
        enabled BOOLEAN NOT NULL DEFAULT true,
        last_fired_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE INDEX idx_triggers_vault ON triggers(vault_address);
      CREATE INDEX idx_triggers_enabled ON triggers(enabled) WHERE enabled = true;
    `,
  },
];
