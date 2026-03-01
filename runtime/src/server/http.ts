import { createServer, IncomingMessage, ServerResponse } from 'http';
import { createLogger } from '../utils/logger.js';
import { AgentRuntime } from '../agent/runtime.js';
import { AgentWebSocketServer } from './websocket.js';

const logger = createLogger('http-server');

type RouteHandler = (
  req: IncomingMessage,
  res: ServerResponse,
  params: Record<string, string>,
  body?: any
) => Promise<void>;

interface Route {
  method: string;
  pattern: RegExp;
  handler: RouteHandler;
  paramNames: string[];
}

export class HttpApiServer {
  private runtime: AgentRuntime;
  private wsServer?: AgentWebSocketServer;
  private routes: Route[] = [];
  private server: ReturnType<typeof createServer>;

  constructor(runtime: AgentRuntime, port: number = 3001) {
    this.runtime = runtime;
    this.server = createServer(this.handleRequest.bind(this));

    this.setupRoutes();

    this.server.listen(port, () => {
      logger.info({ port }, 'HTTP API server listening');
    });
  }

  setWebSocketServer(wsServer: AgentWebSocketServer): void {
    this.wsServer = wsServer;
  }

  private setupRoutes(): void {
    // Health check
    this.addRoute('GET', '/health', this.handleHealth.bind(this));

    // Stats
    this.addRoute('GET', '/stats', this.handleStats.bind(this));

    // Protocol info
    this.addRoute('GET', '/protocols', this.handleProtocols.bind(this));
    this.addRoute('GET', '/protocols/stats', this.handleProtocolStats.bind(this));

    // Vault operations
    this.addRoute('GET', '/vaults/:address', this.handleGetVault.bind(this));
    this.addRoute('GET', '/vaults/:address/portfolio', this.handleGetPortfolio.bind(this));
    this.addRoute('GET', '/vaults/:address/activity', this.handleGetActivity.bind(this));
    this.addRoute('GET', '/vaults/:address/policy', this.handleGetPolicy.bind(this));

    // Intent submission (alternative to WebSocket)
    this.addRoute('POST', '/vaults/:address/intents', this.handleSubmitIntent.bind(this));

    // Prices
    this.addRoute('GET', '/prices/:mint', this.handleGetPrice.bind(this));
    this.addRoute('POST', '/prices', this.handleGetPrices.bind(this));

    // Quotes
    this.addRoute('POST', '/quotes/swap', this.handleSwapQuote.bind(this));
    this.addRoute('POST', '/quotes/stake', this.handleStakeQuote.bind(this));
    this.addRoute('POST', '/quotes/lend', this.handleLendQuote.bind(this));
  }

  private addRoute(method: string, path: string, handler: RouteHandler): void {
    const paramNames: string[] = [];
    const pattern = path.replace(/:(\w+)/g, (_, name) => {
      paramNames.push(name);
      return '([^/]+)';
    });

    this.routes.push({
      method,
      pattern: new RegExp(`^${pattern}$`),
      handler,
      paramNames,
    });
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const path = url.pathname;
    const method = req.method || 'GET';

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Find matching route
    for (const route of this.routes) {
      if (route.method !== method) continue;

      const match = path.match(route.pattern);
      if (!match) continue;

      // Extract params
      const params: Record<string, string> = {};
      route.paramNames.forEach((name, i) => {
        params[name] = match[i + 1];
      });

      // Parse body for POST/PUT
      let body: any;
      if (['POST', 'PUT', 'PATCH'].includes(method)) {
        body = await this.parseBody(req);
      }

      try {
        await route.handler(req, res, params, body);
      } catch (error) {
        logger.error({ error, path, method }, 'Route handler error');
        this.sendJson(res, 500, { error: 'Internal server error' });
      }
      return;
    }

    // 404
    this.sendJson(res, 404, { error: 'Not found' });
  }

  private async parseBody(req: IncomingMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      let data = '';
      req.on('data', (chunk) => (data += chunk));
      req.on('end', () => {
        try {
          resolve(data ? JSON.parse(data) : {});
        } catch {
          resolve({});
        }
      });
      req.on('error', reject);
    });
  }

  private sendJson(res: ServerResponse, status: number, data: any): void {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  }

  // ============================================================================
  // Route Handlers
  // ============================================================================

  private async handleHealth(req: IncomingMessage, res: ServerResponse): Promise<void> {
    this.sendJson(res, 200, {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '0.1.0',
    });
  }

  private async handleStats(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const wsStats = this.wsServer?.getStats() || {
      connectedClients: 0,
      subscribedVaults: 0,
      pendingPlans: 0,
    };

    this.sendJson(res, 200, {
      websocket: wsStats,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    });
  }

  private async handleProtocols(req: IncomingMessage, res: ServerResponse): Promise<void> {
    this.sendJson(res, 200, {
      protocols: [
        {
          name: 'Jupiter',
          type: 'swap',
          programId: 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',
          status: 'active',
        },
        {
          name: 'Marinade',
          type: 'staking',
          programId: 'MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD',
          status: 'active',
        },
        {
          name: 'MarginFi',
          type: 'lending',
          programId: 'MFv2hWf31Z9kbCa1snEPYctwafyhdvnV7FZnsebVacA',
          status: 'active',
        },
        {
          name: 'Kamino',
          type: 'lending',
          programId: 'KLend2g3cP87ber41GAmhvH3VPVwWvxTKjkN6nh8VqD',
          status: 'active',
        },
      ],
    });
  }

  private async handleProtocolStats(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const stats = await this.runtime.getProtocolStats();
      this.sendJson(res, 200, stats);
    } catch (error) {
      logger.error({ error }, 'Failed to fetch protocol stats');
      this.sendJson(res, 500, { error: 'Failed to fetch protocol stats' });
    }
  }

  private async handleGetVault(
    req: IncomingMessage,
    res: ServerResponse,
    params: Record<string, string>
  ): Promise<void> {
    const { address } = params;

    // In production, fetch from runtime/chain
    this.sendJson(res, 200, {
      address,
      owner: 'owner_pubkey',
      agent: 'agent_pubkey',
      balance: '1000000000',
      status: 'active',
      policyHash: 'hash',
      txCount: 0,
    });
  }

  private async handleGetPortfolio(
    req: IncomingMessage,
    res: ServerResponse,
    params: Record<string, string>
  ): Promise<void> {
    const { address } = params;

    // In production, fetch from runtime
    this.sendJson(res, 200, {
      vaultAddress: address,
      totalValueUsd: 1000,
      totalValueSol: 10,
      positions: [],
      lastUpdated: new Date().toISOString(),
    });
  }

  private async handleGetActivity(
    req: IncomingMessage,
    res: ServerResponse,
    params: Record<string, string>
  ): Promise<void> {
    const { address } = params;
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const limit = parseInt(url.searchParams.get('limit') || '50');

    // In production, fetch from database
    this.sendJson(res, 200, {
      vaultAddress: address,
      activities: [],
      total: 0,
      limit,
    });
  }

  private async handleGetPolicy(
    req: IncomingMessage,
    res: ServerResponse,
    params: Record<string, string>
  ): Promise<void> {
    const { address } = params;

    // In production, fetch from runtime/chain
    this.sendJson(res, 200, {
      vaultAddress: address,
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
    });
  }

  private async handleSubmitIntent(
    req: IncomingMessage,
    res: ServerResponse,
    params: Record<string, string>,
    body: any
  ): Promise<void> {
    const { address } = params;
    const { text } = body;

    if (!text) {
      this.sendJson(res, 400, { error: 'Missing intent text' });
      return;
    }

    try {
      const intent = {
        id: `intent_${Date.now()}`,
        userId: 'api_user',
        vaultAddress: address,
        text,
        timestamp: new Date(),
      };

      const actionPlan = await this.runtime.processIntent(intent);
      this.sendJson(res, 200, { actionPlan });
    } catch (error) {
      logger.error({ error, address, text }, 'Failed to process intent');
      this.sendJson(res, 500, {
        error: error instanceof Error ? error.message : 'Failed to process intent',
      });
    }
  }

  private async handleGetPrice(
    req: IncomingMessage,
    res: ServerResponse,
    params: Record<string, string>
  ): Promise<void> {
    const { mint } = params;

    // In production, use Jupiter adapter
    this.sendJson(res, 200, {
      mint,
      priceUsd: 100,
      timestamp: new Date().toISOString(),
    });
  }

  private async handleGetPrices(
    req: IncomingMessage,
    res: ServerResponse,
    params: Record<string, string>,
    body: any
  ): Promise<void> {
    const { mints } = body;

    if (!Array.isArray(mints)) {
      this.sendJson(res, 400, { error: 'mints must be an array' });
      return;
    }

    // In production, use Jupiter adapter
    const prices: Record<string, number> = {};
    for (const mint of mints) {
      prices[mint] = 100;
    }

    this.sendJson(res, 200, { prices });
  }

  private async handleSwapQuote(
    req: IncomingMessage,
    res: ServerResponse,
    params: Record<string, string>,
    body: any
  ): Promise<void> {
    const { inputMint, outputMint, amount, slippageBps } = body;

    if (!inputMint || !outputMint || !amount) {
      this.sendJson(res, 400, { error: 'Missing required fields' });
      return;
    }

    // In production, use Jupiter adapter
    this.sendJson(res, 200, {
      inputMint,
      outputMint,
      inAmount: amount,
      outAmount: Math.floor(amount * 0.99).toString(),
      priceImpactPct: '0.1',
      route: [],
    });
  }

  private async handleStakeQuote(
    req: IncomingMessage,
    res: ServerResponse,
    params: Record<string, string>,
    body: any
  ): Promise<void> {
    const { amount } = body;

    if (!amount) {
      this.sendJson(res, 400, { error: 'Missing amount' });
      return;
    }

    // In production, use Marinade adapter
    this.sendJson(res, 200, {
      inputAmount: amount,
      outputAmount: Math.floor(amount / 1.05),
      exchangeRate: 1.05,
      fee: Math.floor(amount * 0.001),
      apy: 0.068,
    });
  }

  private async handleLendQuote(
    req: IncomingMessage,
    res: ServerResponse,
    params: Record<string, string>,
    body: any
  ): Promise<void> {
    const { mint, amount, protocol } = body;

    if (!mint || !amount) {
      this.sendJson(res, 400, { error: 'Missing required fields' });
      return;
    }

    // In production, use MarginFi adapter
    this.sendJson(res, 200, {
      mint,
      amount,
      protocol: protocol || 'marginfi',
      estimatedApy: 0.052,
      utilizationRate: 0.7,
    });
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    return new Promise((resolve) => {
      this.server.close(() => {
        logger.info('HTTP server shut down');
        resolve();
      });
    });
  }
}
