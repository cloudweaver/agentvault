import { AgentRuntime } from './agent/runtime.js';
import { createLogger } from './utils/logger.js';
import { loadConfig } from './config.js';

const logger = createLogger('main');

async function main() {
  logger.info('Starting AgentVault Runtime...');

  const config = loadConfig();
  const runtime = new AgentRuntime(config);

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down...');
    await runtime.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, shutting down...');
    await runtime.stop();
    process.exit(0);
  });

  await runtime.start();
  logger.info('AgentVault Runtime started successfully');
}

main().catch((error) => {
  logger.error({ error }, 'Fatal error in main');
  process.exit(1);
});

export { AgentRuntime } from './agent/runtime.js';
export { PolicyEngine } from './policy/engine.js';
export * from './types/index.js';
