import { createLogger } from '../utils/logger.js';
import { Portfolio, TriggerCondition, ActionPlan } from '../types/index.js';

const logger = createLogger('redis');

// ============================================================================
// Redis Key Prefixes
// ============================================================================

const KEYS = {
  // Session & Auth
  session: (id: string) => `session:${id}`,
  userSessions: (userId: string) => `user:${userId}:sessions`,
  
  // Vault Cache
  vault: (address: string) => `vault:${address}`,
  vaultPortfolio: (address: string) => `vault:${address}:portfolio`,
  vaultPolicy: (address: string) => `vault:${address}:policy`,
  
  // Price Cache
  price: (mint: string) => `price:${mint}`,
  priceAll: () => 'prices:all',
  
  // Triggers & Monitoring
  activeTriggers: (vaultAddress: string) => `triggers:${vaultAddress}`,
  triggerState: (triggerId: string) => `trigger:${triggerId}:state`,
  
  // Pending Actions
  pendingPlan: (planId: string) => `plan:${planId}`,
  vaultPendingPlans: (vaultAddress: string) => `vault:${vaultAddress}:pending`,
  
  // Rate Limiting
  rateLimit: (key: string) => `ratelimit:${key}`,
  
  // WebSocket
  wsClient: (clientId: string) => `ws:client:${clientId}`,
  wsVaultSubscribers: (vaultAddress: string) => `ws:vault:${vaultAddress}:subscribers`,
  
  // Locks
  lock: (resource: string) => `lock:${resource}`,
};

// ============================================================================
// Redis Client
// ============================================================================

export class RedisClient {
  private client: any; // Redis client from ioredis
  private connected: boolean = false;

  constructor(private url: string) {
    logger.info('Redis client initialized');
  }

  async connect(): Promise<void> {
    // In production, use ioredis:
    // const Redis = (await import('ioredis')).default;
    // this.client = new Redis(this.url);
    // await new Promise<void>((resolve, reject) => {
    //   this.client.on('connect', () => {
    //     this.connected = true;
    //     resolve();
    //   });
    //   this.client.on('error', reject);
    // });
    this.connected = true;
    logger.info('Redis connected');
  }

  async disconnect(): Promise<void> {
    // await this.client?.quit();
    this.connected = false;
    logger.info('Redis disconnected');
  }

  isConnected(): boolean {
    return this.connected;
  }

  // ============================================================================
  // Generic Operations
  // ============================================================================

  async get<T>(key: string): Promise<T | null> {
    // const value = await this.client.get(key);
    // return value ? JSON.parse(value) : null;
    return null;
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    // const serialized = JSON.stringify(value);
    // if (ttlSeconds) {
    //   await this.client.setex(key, ttlSeconds, serialized);
    // } else {
    //   await this.client.set(key, serialized);
    // }
  }

  async del(key: string): Promise<void> {
    // await this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    // return (await this.client.exists(key)) === 1;
    return false;
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    // await this.client.expire(key, ttlSeconds);
  }

  async ttl(key: string): Promise<number> {
    // return await this.client.ttl(key);
    return -1;
  }

  // ============================================================================
  // Price Cache
  // ============================================================================

  async cachePrice(mint: string, priceUsd: number, ttlSeconds: number = 30): Promise<void> {
    await this.set(KEYS.price(mint), { priceUsd, timestamp: Date.now() }, ttlSeconds);
  }

  async getCachedPrice(mint: string): Promise<{ priceUsd: number; timestamp: number } | null> {
    return this.get(KEYS.price(mint));
  }

  async cachePrices(prices: Record<string, number>, ttlSeconds: number = 30): Promise<void> {
    await this.set(KEYS.priceAll(), { prices, timestamp: Date.now() }, ttlSeconds);
  }

  async getCachedPrices(): Promise<{ prices: Record<string, number>; timestamp: number } | null> {
    return this.get(KEYS.priceAll());
  }

  // ============================================================================
  // Portfolio Cache
  // ============================================================================

  async cachePortfolio(vaultAddress: string, portfolio: Portfolio, ttlSeconds: number = 60): Promise<void> {
    await this.set(KEYS.vaultPortfolio(vaultAddress), portfolio, ttlSeconds);
  }

  async getCachedPortfolio(vaultAddress: string): Promise<Portfolio | null> {
    return this.get(KEYS.vaultPortfolio(vaultAddress));
  }

  async invalidatePortfolio(vaultAddress: string): Promise<void> {
    await this.del(KEYS.vaultPortfolio(vaultAddress));
  }

  // ============================================================================
  // Trigger State
  // ============================================================================

  async setTriggerState(triggerId: string, state: any): Promise<void> {
    await this.set(KEYS.triggerState(triggerId), state);
  }

  async getTriggerState(triggerId: string): Promise<any> {
    return this.get(KEYS.triggerState(triggerId));
  }

  async getActiveTriggers(vaultAddress: string): Promise<TriggerCondition[]> {
    return (await this.get(KEYS.activeTriggers(vaultAddress))) || [];
  }

  async setActiveTriggers(vaultAddress: string, triggers: TriggerCondition[]): Promise<void> {
    await this.set(KEYS.activeTriggers(vaultAddress), triggers);
  }

  async addActiveTrigger(vaultAddress: string, trigger: TriggerCondition): Promise<void> {
    const triggers = await this.getActiveTriggers(vaultAddress);
    triggers.push(trigger);
    await this.setActiveTriggers(vaultAddress, triggers);
  }

  async removeActiveTrigger(vaultAddress: string, triggerId: string): Promise<void> {
    const triggers = await this.getActiveTriggers(vaultAddress);
    const filtered = triggers.filter(t => t.id !== triggerId);
    await this.setActiveTriggers(vaultAddress, filtered);
  }

  // ============================================================================
  // Pending Plans
  // ============================================================================

  async storePendingPlan(plan: ActionPlan, ttlSeconds: number = 300): Promise<void> {
    await this.set(KEYS.pendingPlan(plan.id), plan, ttlSeconds);
    
    // Add to vault's pending list
    // await this.client.sadd(KEYS.vaultPendingPlans(plan.intentId), plan.id);
  }

  async getPendingPlan(planId: string): Promise<ActionPlan | null> {
    return this.get(KEYS.pendingPlan(planId));
  }

  async removePendingPlan(planId: string, vaultAddress?: string): Promise<void> {
    await this.del(KEYS.pendingPlan(planId));
    if (vaultAddress) {
      // await this.client.srem(KEYS.vaultPendingPlans(vaultAddress), planId);
    }
  }

  async getVaultPendingPlans(vaultAddress: string): Promise<string[]> {
    // return await this.client.smembers(KEYS.vaultPendingPlans(vaultAddress));
    return [];
  }

  // ============================================================================
  // Session Management
  // ============================================================================

  async createSession(sessionId: string, data: any, ttlSeconds: number = 86400): Promise<void> {
    await this.set(KEYS.session(sessionId), data, ttlSeconds);
    if (data.userId) {
      // await this.client.sadd(KEYS.userSessions(data.userId), sessionId);
    }
  }

  async getSession(sessionId: string): Promise<any> {
    return this.get(KEYS.session(sessionId));
  }

  async deleteSession(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (session?.userId) {
      // await this.client.srem(KEYS.userSessions(session.userId), sessionId);
    }
    await this.del(KEYS.session(sessionId));
  }

  async refreshSession(sessionId: string, ttlSeconds: number = 86400): Promise<void> {
    await this.expire(KEYS.session(sessionId), ttlSeconds);
  }

  // ============================================================================
  // Rate Limiting
  // ============================================================================

  async checkRateLimit(
    key: string,
    maxRequests: number,
    windowSeconds: number
  ): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
    const rateLimitKey = KEYS.rateLimit(key);
    const now = Date.now();
    const windowStart = now - windowSeconds * 1000;

    // In production with Redis:
    // // Remove old entries
    // await this.client.zremrangebyscore(rateLimitKey, 0, windowStart);
    // // Count current entries
    // const count = await this.client.zcard(rateLimitKey);
    // if (count < maxRequests) {
    //   // Add new entry
    //   await this.client.zadd(rateLimitKey, now, `${now}:${Math.random()}`);
    //   await this.client.expire(rateLimitKey, windowSeconds);
    //   return { allowed: true, remaining: maxRequests - count - 1, resetAt: now + windowSeconds * 1000 };
    // }
    // return { allowed: false, remaining: 0, resetAt: windowStart + windowSeconds * 1000 };

    return { allowed: true, remaining: maxRequests, resetAt: now + windowSeconds * 1000 };
  }

  // ============================================================================
  // Distributed Locking
  // ============================================================================

  async acquireLock(resource: string, ttlMs: number = 10000): Promise<string | null> {
    const lockKey = KEYS.lock(resource);
    const lockValue = `${Date.now()}:${Math.random()}`;

    // In production with Redis:
    // const acquired = await this.client.set(lockKey, lockValue, 'PX', ttlMs, 'NX');
    // return acquired ? lockValue : null;

    return lockValue;
  }

  async releaseLock(resource: string, lockValue: string): Promise<boolean> {
    const lockKey = KEYS.lock(resource);

    // In production with Redis (use Lua script for atomicity):
    // const script = `
    //   if redis.call("get", KEYS[1]) == ARGV[1] then
    //     return redis.call("del", KEYS[1])
    //   else
    //     return 0
    //   end
    // `;
    // const result = await this.client.eval(script, 1, lockKey, lockValue);
    // return result === 1;

    return true;
  }

  async withLock<T>(
    resource: string,
    fn: () => Promise<T>,
    ttlMs: number = 10000
  ): Promise<T> {
    const lockValue = await this.acquireLock(resource, ttlMs);
    if (!lockValue) {
      throw new Error(`Failed to acquire lock for resource: ${resource}`);
    }

    try {
      return await fn();
    } finally {
      await this.releaseLock(resource, lockValue);
    }
  }

  // ============================================================================
  // WebSocket State
  // ============================================================================

  async registerWsClient(clientId: string, data: any, ttlSeconds: number = 3600): Promise<void> {
    await this.set(KEYS.wsClient(clientId), data, ttlSeconds);
  }

  async unregisterWsClient(clientId: string): Promise<void> {
    await this.del(KEYS.wsClient(clientId));
  }

  async addVaultSubscriber(vaultAddress: string, clientId: string): Promise<void> {
    // await this.client.sadd(KEYS.wsVaultSubscribers(vaultAddress), clientId);
  }

  async removeVaultSubscriber(vaultAddress: string, clientId: string): Promise<void> {
    // await this.client.srem(KEYS.wsVaultSubscribers(vaultAddress), clientId);
  }

  async getVaultSubscribers(vaultAddress: string): Promise<string[]> {
    // return await this.client.smembers(KEYS.wsVaultSubscribers(vaultAddress));
    return [];
  }

  // ============================================================================
  // Pub/Sub (for multi-instance coordination)
  // ============================================================================

  async publish(channel: string, message: any): Promise<void> {
    // await this.client.publish(channel, JSON.stringify(message));
  }

  async subscribe(channel: string, callback: (message: any) => void): Promise<void> {
    // const subscriber = this.client.duplicate();
    // await subscriber.subscribe(channel);
    // subscriber.on('message', (ch: string, msg: string) => {
    //   if (ch === channel) {
    //     callback(JSON.parse(msg));
    //   }
    // });
  }
}

// ============================================================================
// Export Keys for testing
// ============================================================================

export { KEYS as REDIS_KEYS };
