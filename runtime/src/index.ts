import { AgentRuntime } from './agent/runtime.js';
import { AgentWebSocketServer, HttpApiServer } from './server/index.js';
import { createLogger } from './utils/logger.js';
import { loadConfig } from './config.js';

const logger = createLogger('main');

async function main() {
  logger.info('Starting AgentVault Runtime...');

  const config = loadConfig();
  
  // Initialize runtime
  const runtime = new AgentRuntime(config);
  await runtime.start();

  // Start HTTP API server
  const httpPort = config.port || 3001;
  const httpServer = new HttpApiServer(runtime, httpPort);
  logger.info({ port: httpPort }, 'HTTP API server started');

  // Start WebSocket server
  const wsPort = (config.port || 3001) + 1; // WebSocket on port + 1
  const wsServer = new AgentWebSocketServer(runtime, wsPort);
  httpServer.setWebSocketServer(wsServer);
  logger.info({ port: wsPort }, 'WebSocket server started');

  // Handle graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down...');
    await Promise.all([
      runtime.stop(),
      wsServer.shutdown(),
      httpServer.shutdown(),
    ]);
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  logger.info({
    httpPort,
    wsPort,
    rpcUrl: config.solanaRpcUrl,
  }, 'AgentVault Runtime started successfully');
}

main().catch((error) => {
  logger.error({ error }, 'Fatal error in main');
  process.exit(1);
});

// Exports
export { AgentRuntime } from './agent/runtime.js';
export { PolicyEngine } from './policy/engine.js';
export { AgentWebSocketServer, HttpApiServer } from './server/index.js';
export * from './types/index.js';
export * from './adapters/index.js';
