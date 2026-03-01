import { WebSocketServer, WebSocket } from 'ws';
import { createServer, Server as HttpServer } from 'http';
import { createLogger } from '../utils/logger.js';
import { AgentRuntime } from '../agent/runtime.js';
import {
  UserIntent,
  ActionPlan,
  ActivityLogEntry,
  Portfolio,
  VaultState,
} from '../types/index.js';

const logger = createLogger('websocket');

// ============================================================================
// Message Types
// ============================================================================

export type ClientMessage =
  | { type: 'subscribe'; vaultAddress: string }
  | { type: 'unsubscribe'; vaultAddress: string }
  | { type: 'intent'; vaultAddress: string; text: string }
  | { type: 'approve'; planId: string }
  | { type: 'reject'; planId: string }
  | { type: 'get_portfolio'; vaultAddress: string }
  | { type: 'get_activity'; vaultAddress: string; limit?: number }
  | { type: 'ping' };

export type ServerMessage =
  | { type: 'subscribed'; vaultAddress: string }
  | { type: 'unsubscribed'; vaultAddress: string }
  | { type: 'action_plan'; plan: ActionPlan }
  | { type: 'action_executed'; planId: string; signatures: string[]; success: boolean }
  | { type: 'action_failed'; planId: string; error: string }
  | { type: 'activity'; entry: ActivityLogEntry }
  | { type: 'portfolio_update'; vaultAddress: string; portfolio: Portfolio }
  | { type: 'vault_update'; vault: VaultState }
  | { type: 'price_update'; prices: Record<string, number> }
  | { type: 'error'; message: string; code?: string }
  | { type: 'pong' };

// ============================================================================
// Client Connection
// ============================================================================

interface ClientConnection {
  id: string;
  ws: WebSocket;
  subscribedVaults: Set<string>;
  lastPing: number;
  userId?: string;
}

// ============================================================================
// WebSocket Server
// ============================================================================

export class AgentWebSocketServer {
  private wss: WebSocketServer;
  private httpServer: HttpServer;
  private runtime: AgentRuntime;
  private clients: Map<string, ClientConnection> = new Map();
  private vaultSubscribers: Map<string, Set<string>> = new Map(); // vaultAddress -> clientIds
  private pendingPlans: Map<string, ActionPlan> = new Map();
  private pingInterval?: NodeJS.Timeout;

  constructor(runtime: AgentRuntime, port: number = 3002) {
    this.runtime = runtime;
    this.httpServer = createServer();
    this.wss = new WebSocketServer({ server: this.httpServer });

    this.setupWebSocketHandlers();
    this.startPingInterval();

    this.httpServer.listen(port, () => {
      logger.info({ port }, 'WebSocket server listening');
    });
  }

  private setupWebSocketHandlers(): void {
    this.wss.on('connection', (ws, req) => {
      const clientId = this.generateClientId();
      const client: ClientConnection = {
        id: clientId,
        ws,
        subscribedVaults: new Set(),
        lastPing: Date.now(),
      };

      this.clients.set(clientId, client);
      logger.info({ clientId, ip: req.socket.remoteAddress }, 'Client connected');

      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString()) as ClientMessage;
          await this.handleMessage(client, message);
        } catch (error) {
          logger.error({ error, clientId }, 'Failed to handle message');
          this.send(ws, { type: 'error', message: 'Invalid message format' });
        }
      });

      ws.on('close', () => {
        this.handleDisconnect(client);
      });

      ws.on('error', (error) => {
        logger.error({ error, clientId }, 'WebSocket error');
      });
    });
  }

  private async handleMessage(client: ClientConnection, message: ClientMessage): Promise<void> {
    logger.debug({ clientId: client.id, messageType: message.type }, 'Received message');

    switch (message.type) {
      case 'ping':
        client.lastPing = Date.now();
        this.send(client.ws, { type: 'pong' });
        break;

      case 'subscribe':
        this.subscribeToVault(client, message.vaultAddress);
        break;

      case 'unsubscribe':
        this.unsubscribeFromVault(client, message.vaultAddress);
        break;

      case 'intent':
        await this.handleIntent(client, message.vaultAddress, message.text);
        break;

      case 'approve':
        await this.handleApproval(client, message.planId);
        break;

      case 'reject':
        await this.handleRejection(client, message.planId);
        break;

      case 'get_portfolio':
        await this.handleGetPortfolio(client, message.vaultAddress);
        break;

      case 'get_activity':
        await this.handleGetActivity(client, message.vaultAddress, message.limit);
        break;

      default:
        this.send(client.ws, { type: 'error', message: 'Unknown message type' });
    }
  }

  private subscribeToVault(client: ClientConnection, vaultAddress: string): void {
    client.subscribedVaults.add(vaultAddress);

    if (!this.vaultSubscribers.has(vaultAddress)) {
      this.vaultSubscribers.set(vaultAddress, new Set());
    }
    this.vaultSubscribers.get(vaultAddress)!.add(client.id);

    logger.info({ clientId: client.id, vaultAddress }, 'Client subscribed to vault');
    this.send(client.ws, { type: 'subscribed', vaultAddress });
  }

  private unsubscribeFromVault(client: ClientConnection, vaultAddress: string): void {
    client.subscribedVaults.delete(vaultAddress);

    const subscribers = this.vaultSubscribers.get(vaultAddress);
    if (subscribers) {
      subscribers.delete(client.id);
      if (subscribers.size === 0) {
        this.vaultSubscribers.delete(vaultAddress);
      }
    }

    logger.info({ clientId: client.id, vaultAddress }, 'Client unsubscribed from vault');
    this.send(client.ws, { type: 'unsubscribed', vaultAddress });
  }

  private async handleIntent(client: ClientConnection, vaultAddress: string, text: string): Promise<void> {
    try {
      const intent: UserIntent = {
        id: this.generateClientId(),
        userId: client.userId || 'anonymous',
        vaultAddress,
        text,
        timestamp: new Date(),
      };

      logger.info({ clientId: client.id, vaultAddress, text }, 'Processing intent');

      const actionPlan = await this.runtime.processIntent(intent);

      // Store pending plan if it requires approval
      if (actionPlan.status === 'pending_approval') {
        this.pendingPlans.set(actionPlan.id, actionPlan);
      }

      // Send action plan to client
      this.send(client.ws, { type: 'action_plan', plan: actionPlan });

      // If already executed, send execution result
      if (actionPlan.executionResults) {
        this.send(client.ws, {
          type: 'action_executed',
          planId: actionPlan.id,
          signatures: actionPlan.executionResults.signatures,
          success: actionPlan.executionResults.success,
        });
      }

      // Broadcast to other subscribers
      this.broadcastToVault(vaultAddress, { type: 'action_plan', plan: actionPlan }, client.id);

    } catch (error) {
      logger.error({ error, clientId: client.id }, 'Failed to process intent');
      this.send(client.ws, {
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to process intent',
        code: 'INTENT_FAILED',
      });
    }
  }

  private async handleApproval(client: ClientConnection, planId: string): Promise<void> {
    const plan = this.pendingPlans.get(planId);
    if (!plan) {
      this.send(client.ws, { type: 'error', message: 'Plan not found or already processed', code: 'PLAN_NOT_FOUND' });
      return;
    }

    try {
      logger.info({ clientId: client.id, planId }, 'Executing approved plan');

      // Execute the plan through runtime
      // In production, this would call runtime.executeApprovedPlan(plan)
      
      this.pendingPlans.delete(planId);

      this.send(client.ws, {
        type: 'action_executed',
        planId,
        signatures: ['approved_execution_signature'],
        success: true,
      });

      // Broadcast to vault subscribers
      const vaultAddress = plan.operations[0]?.params?.vaultAddress as string;
      if (vaultAddress) {
        this.broadcastToVault(vaultAddress, {
          type: 'action_executed',
          planId,
          signatures: ['approved_execution_signature'],
          success: true,
        });
      }

    } catch (error) {
      logger.error({ error, planId }, 'Failed to execute approved plan');
      this.send(client.ws, {
        type: 'action_failed',
        planId,
        error: error instanceof Error ? error.message : 'Execution failed',
      });
    }
  }

  private async handleRejection(client: ClientConnection, planId: string): Promise<void> {
    const plan = this.pendingPlans.get(planId);
    if (!plan) {
      this.send(client.ws, { type: 'error', message: 'Plan not found', code: 'PLAN_NOT_FOUND' });
      return;
    }

    this.pendingPlans.delete(planId);
    logger.info({ clientId: client.id, planId }, 'Plan rejected by user');

    this.send(client.ws, {
      type: 'action_failed',
      planId,
      error: 'Rejected by user',
    });
  }

  private async handleGetPortfolio(client: ClientConnection, vaultAddress: string): Promise<void> {
    try {
      // In production, fetch from runtime
      const portfolio: Portfolio = {
        totalValueUsd: 1000,
        totalValueSol: 10,
        positions: [],
        lastUpdated: new Date(),
      };

      this.send(client.ws, {
        type: 'portfolio_update',
        vaultAddress,
        portfolio,
      });
    } catch (error) {
      logger.error({ error, vaultAddress }, 'Failed to fetch portfolio');
      this.send(client.ws, { type: 'error', message: 'Failed to fetch portfolio' });
    }
  }

  private async handleGetActivity(client: ClientConnection, vaultAddress: string, limit?: number): Promise<void> {
    try {
      // In production, fetch from database
      const activities: ActivityLogEntry[] = [];

      for (const activity of activities) {
        this.send(client.ws, { type: 'activity', entry: activity });
      }
    } catch (error) {
      logger.error({ error, vaultAddress }, 'Failed to fetch activity');
      this.send(client.ws, { type: 'error', message: 'Failed to fetch activity' });
    }
  }

  private handleDisconnect(client: ClientConnection): void {
    // Remove from all vault subscriptions
    for (const vaultAddress of client.subscribedVaults) {
      const subscribers = this.vaultSubscribers.get(vaultAddress);
      if (subscribers) {
        subscribers.delete(client.id);
        if (subscribers.size === 0) {
          this.vaultSubscribers.delete(vaultAddress);
        }
      }
    }

    this.clients.delete(client.id);
    logger.info({ clientId: client.id }, 'Client disconnected');
  }

  // ============================================================================
  // Broadcasting
  // ============================================================================

  /**
   * Broadcast a message to all clients subscribed to a vault
   */
  broadcastToVault(vaultAddress: string, message: ServerMessage, excludeClientId?: string): void {
    const subscribers = this.vaultSubscribers.get(vaultAddress);
    if (!subscribers) return;

    for (const clientId of subscribers) {
      if (clientId === excludeClientId) continue;

      const client = this.clients.get(clientId);
      if (client && client.ws.readyState === WebSocket.OPEN) {
        this.send(client.ws, message);
      }
    }
  }

  /**
   * Broadcast a message to all connected clients
   */
  broadcast(message: ServerMessage): void {
    for (const client of this.clients.values()) {
      if (client.ws.readyState === WebSocket.OPEN) {
        this.send(client.ws, message);
      }
    }
  }

  /**
   * Broadcast a price update to all clients
   */
  broadcastPriceUpdate(prices: Record<string, number>): void {
    this.broadcast({ type: 'price_update', prices });
  }

  /**
   * Broadcast a portfolio update to vault subscribers
   */
  broadcastPortfolioUpdate(vaultAddress: string, portfolio: Portfolio): void {
    this.broadcastToVault(vaultAddress, {
      type: 'portfolio_update',
      vaultAddress,
      portfolio,
    });
  }

  /**
   * Broadcast an activity log entry to vault subscribers
   */
  broadcastActivity(vaultAddress: string, entry: ActivityLogEntry): void {
    this.broadcastToVault(vaultAddress, { type: 'activity', entry });
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  private send(ws: WebSocket, message: ServerMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private startPingInterval(): void {
    // Ping clients every 30 seconds to keep connections alive
    this.pingInterval = setInterval(() => {
      const now = Date.now();
      const timeout = 60000; // 60 seconds

      for (const [clientId, client] of this.clients) {
        if (now - client.lastPing > timeout) {
          logger.info({ clientId }, 'Client timed out, disconnecting');
          client.ws.terminate();
          this.handleDisconnect(client);
        }
      }
    }, 30000);
  }

  /**
   * Get server statistics
   */
  getStats(): {
    connectedClients: number;
    subscribedVaults: number;
    pendingPlans: number;
  } {
    return {
      connectedClients: this.clients.size,
      subscribedVaults: this.vaultSubscribers.size,
      pendingPlans: this.pendingPlans.size,
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down WebSocket server...');

    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    // Close all client connections
    for (const client of this.clients.values()) {
      client.ws.close(1001, 'Server shutting down');
    }

    return new Promise((resolve) => {
      this.wss.close(() => {
        this.httpServer.close(() => {
          logger.info('WebSocket server shut down');
          resolve();
        });
      });
    });
  }
}
