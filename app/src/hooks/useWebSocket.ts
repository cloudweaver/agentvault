'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { ActionPlan, ActivityEntry, Portfolio } from '@/lib/api';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3002';

// ============================================================================
// Types
// ============================================================================

type ClientMessage =
  | { type: 'subscribe'; vaultAddress: string }
  | { type: 'unsubscribe'; vaultAddress: string }
  | { type: 'intent'; vaultAddress: string; text: string }
  | { type: 'approve'; planId: string }
  | { type: 'reject'; planId: string }
  | { type: 'get_portfolio'; vaultAddress: string }
  | { type: 'ping' };

type ServerMessage =
  | { type: 'subscribed'; vaultAddress: string }
  | { type: 'unsubscribed'; vaultAddress: string }
  | { type: 'action_plan'; plan: ActionPlan }
  | { type: 'action_executed'; planId: string; signatures: string[]; success: boolean }
  | { type: 'action_failed'; planId: string; error: string }
  | { type: 'activity'; entry: ActivityEntry }
  | { type: 'portfolio_update'; vaultAddress: string; portfolio: Portfolio }
  | { type: 'price_update'; prices: Record<string, number> }
  | { type: 'error'; message: string; code?: string }
  | { type: 'pong' };

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface UseWebSocketOptions {
  onActionPlan?: (plan: ActionPlan) => void;
  onActionExecuted?: (planId: string, signatures: string[], success: boolean) => void;
  onActionFailed?: (planId: string, error: string) => void;
  onActivity?: (entry: ActivityEntry) => void;
  onPortfolioUpdate?: (vaultAddress: string, portfolio: Portfolio) => void;
  onPriceUpdate?: (prices: Record<string, number>) => void;
  onError?: (message: string, code?: string) => void;
  reconnect?: boolean;
  reconnectInterval?: number;
}

// ============================================================================
// Hook
// ============================================================================

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    onActionPlan,
    onActionExecuted,
    onActionFailed,
    onActivity,
    onPortfolioUpdate,
    onPriceUpdate,
    onError,
    reconnect = true,
    reconnectInterval = 5000,
  } = options;

  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [subscribedVaults, setSubscribedVaults] = useState<Set<string>>(new Set());
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const pingIntervalRef = useRef<NodeJS.Timeout>();

  // Send message helper
  const send = useCallback((message: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setStatus('connecting');
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('connected');
      
      // Resubscribe to vaults
      subscribedVaults.forEach((vaultAddress) => {
        send({ type: 'subscribe', vaultAddress });
      });

      // Start ping interval
      pingIntervalRef.current = setInterval(() => {
        send({ type: 'ping' });
      }, 30000);
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as ServerMessage;
        
        switch (message.type) {
          case 'subscribed':
            setSubscribedVaults((prev) => new Set([...prev, message.vaultAddress]));
            break;
            
          case 'unsubscribed':
            setSubscribedVaults((prev) => {
              const next = new Set(prev);
              next.delete(message.vaultAddress);
              return next;
            });
            break;
            
          case 'action_plan':
            onActionPlan?.(message.plan);
            break;
            
          case 'action_executed':
            onActionExecuted?.(message.planId, message.signatures, message.success);
            break;
            
          case 'action_failed':
            onActionFailed?.(message.planId, message.error);
            break;
            
          case 'activity':
            onActivity?.(message.entry);
            break;
            
          case 'portfolio_update':
            onPortfolioUpdate?.(message.vaultAddress, message.portfolio);
            break;
            
          case 'price_update':
            onPriceUpdate?.(message.prices);
            break;
            
          case 'error':
            onError?.(message.message, message.code);
            break;
            
          case 'pong':
            // Keep-alive acknowledged
            break;
        }
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e);
      }
    };

    ws.onclose = () => {
      setStatus('disconnected');
      wsRef.current = null;
      
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }

      // Attempt reconnection
      if (reconnect) {
        reconnectTimeoutRef.current = setTimeout(connect, reconnectInterval);
      }
    };

    ws.onerror = () => {
      setStatus('error');
    };
  }, [
    send,
    subscribedVaults,
    reconnect,
    reconnectInterval,
    onActionPlan,
    onActionExecuted,
    onActionFailed,
    onActivity,
    onPortfolioUpdate,
    onPriceUpdate,
    onError,
  ]);

  // Disconnect
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
    }
    wsRef.current?.close();
    wsRef.current = null;
    setStatus('disconnected');
  }, []);

  // Subscribe to vault
  const subscribe = useCallback((vaultAddress: string) => {
    setSubscribedVaults((prev) => new Set([...prev, vaultAddress]));
    send({ type: 'subscribe', vaultAddress });
  }, [send]);

  // Unsubscribe from vault
  const unsubscribe = useCallback((vaultAddress: string) => {
    send({ type: 'unsubscribe', vaultAddress });
    setSubscribedVaults((prev) => {
      const next = new Set(prev);
      next.delete(vaultAddress);
      return next;
    });
  }, [send]);

  // Submit intent
  const submitIntent = useCallback((vaultAddress: string, text: string) => {
    send({ type: 'intent', vaultAddress, text });
  }, [send]);

  // Approve plan
  const approvePlan = useCallback((planId: string) => {
    send({ type: 'approve', planId });
  }, [send]);

  // Reject plan
  const rejectPlan = useCallback((planId: string) => {
    send({ type: 'reject', planId });
  }, [send]);

  // Request portfolio update
  const requestPortfolio = useCallback((vaultAddress: string) => {
    send({ type: 'get_portfolio', vaultAddress });
  }, [send]);

  // Auto-connect on mount
  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    status,
    subscribedVaults: Array.from(subscribedVaults),
    connect,
    disconnect,
    subscribe,
    unsubscribe,
    submitIntent,
    approvePlan,
    rejectPlan,
    requestPortfolio,
  };
}
