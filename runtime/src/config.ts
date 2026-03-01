import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const ConfigSchema = z.object({
  // Server
  port: z.number().default(3001),
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // Solana
  solanaRpcUrl: z.string().url(),
  heliusApiKey: z.string().optional(),
  programId: z.string(),

  // LLM Providers
  anthropicApiKey: z.string(),
  xaiApiKey: z.string().optional(),

  // Database
  redisUrl: z.string().url().optional(),
  databaseUrl: z.string().optional(),

  // Price Feeds
  birdeyeApiKey: z.string().optional(),
  pythPriceFeedUrl: z.string().url().optional(),

  // Monitoring
  monitoringIntervalMs: z.number().default(30000),
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(): Config {
  const config = ConfigSchema.parse({
    port: parseInt(process.env.RUNTIME_PORT || '3001'),
    nodeEnv: process.env.NODE_ENV,
    logLevel: process.env.LOG_LEVEL,

    solanaRpcUrl: process.env.SOLANA_RPC_URL || process.env.HELIUS_RPC_URL,
    heliusApiKey: process.env.HELIUS_API_KEY,
    programId: process.env.NEXT_PUBLIC_PROGRAM_ID || 'AgVt1111111111111111111111111111111111111111',

    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    xaiApiKey: process.env.XAI_API_KEY,

    redisUrl: process.env.REDIS_URL,
    databaseUrl: process.env.DATABASE_URL,

    birdeyeApiKey: process.env.BIRDEYE_API_KEY,
    pythPriceFeedUrl: process.env.PYTH_PRICE_FEED_URL,

    monitoringIntervalMs: parseInt(process.env.MONITORING_INTERVAL_MS || '30000'),
  });

  return config;
}
