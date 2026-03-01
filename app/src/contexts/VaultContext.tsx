'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useWebSocket, ConnectionStatus } from '@/hooks/useWebSocket';
import { api, type Portfolio, type ActionPlan, type ActivityEntry, type Policy, type Vault } from '@/lib/api';

// ============================================================================
// Types
// ============================================================================

interface PendingPlan {
  plan: ActionPlan;
  receivedAt: Date;
}

interface VaultContextType {
  // Connection
  connectionStatus: ConnectionStatus;
  
  // Vault state
  vault: Vault | null;
  portfolio: Portfolio | null;
  policy: Policy | null;
  activities: ActivityEntry[];
  
  // Pending actions
  pendingPlans: PendingPlan[];
  
  // Prices
  prices: Record<string, number>;
  
  // Loading states
  isLoading: boolean;
  
  // Actions
  selectVault: (address: string) => Promise<void>;
  refreshPortfolio: () => Promise<void>;
  refreshActivity: () => Promise<void>;
  submitIntent: (text: string) => void;
  approvePlan: (planId: string) => void;
  rejectPlan: (planId: string) => void;
}

// ============================================================================
// Context
// ============================================================================

const VaultContext = createContext<VaultContextType | null>(null);

export function useVault() {
  const ctx = useContext(VaultContext);
  if (!ctx) {
    throw new Error('useVault must be used within VaultProvider');
  }
  return ctx;
}

// ============================================================================
// Provider
// ============================================================================

export function VaultProvider({ children }: { children: React.ReactNode }) {
  // State
  const [vault, setVault] = useState<Vault | null>(null);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [pendingPlans, setPendingPlans] = useState<PendingPlan[]>([]);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(false);

  // WebSocket callbacks
  const handleActionPlan = useCallback((plan: ActionPlan) => {
    if (plan.status === 'pending_approval') {
      setPendingPlans((prev) => [...prev, { plan, receivedAt: new Date() }]);
    }
  }, []);

  const handleActionExecuted = useCallback((planId: string, signatures: string[], success: boolean) => {
    // Remove from pending
    setPendingPlans((prev) => prev.filter((p) => p.plan.id !== planId));
    
    // Refresh portfolio after execution
    if (success && vault) {
      api.getPortfolio(vault.address).then(setPortfolio).catch(console.error);
    }
  }, [vault]);

  const handleActionFailed = useCallback((planId: string, error: string) => {
    // Remove from pending
    setPendingPlans((prev) => prev.filter((p) => p.plan.id !== planId));
    console.error(`Action ${planId} failed:`, error);
  }, []);

  const handleActivity = useCallback((entry: ActivityEntry) => {
    setActivities((prev) => [entry, ...prev].slice(0, 100));
  }, []);

  const handlePortfolioUpdate = useCallback((vaultAddress: string, newPortfolio: Portfolio) => {
    if (vault?.address === vaultAddress) {
      setPortfolio(newPortfolio);
    }
  }, [vault]);

  const handlePriceUpdate = useCallback((newPrices: Record<string, number>) => {
    setPrices((prev) => ({ ...prev, ...newPrices }));
  }, []);

  const handleError = useCallback((message: string, code?: string) => {
    console.error(`WebSocket error [${code}]:`, message);
  }, []);

  // WebSocket hook
  const ws = useWebSocket({
    onActionPlan: handleActionPlan,
    onActionExecuted: handleActionExecuted,
    onActionFailed: handleActionFailed,
    onActivity: handleActivity,
    onPortfolioUpdate: handlePortfolioUpdate,
    onPriceUpdate: handlePriceUpdate,
    onError: handleError,
  });

  // Actions
  const selectVault = useCallback(async (address: string) => {
    setIsLoading(true);
    try {
      // Unsubscribe from previous vault
      if (vault?.address) {
        ws.unsubscribe(vault.address);
      }

      // Fetch vault data
      const [vaultData, portfolioData, policyData, activityData] = await Promise.all([
        api.getVault(address),
        api.getPortfolio(address),
        api.getPolicy(address),
        api.getActivity(address),
      ]);

      setVault(vaultData);
      setPortfolio(portfolioData);
      setPolicy(policyData);
      setActivities(activityData.activities);
      setPendingPlans([]);

      // Subscribe to vault updates
      ws.subscribe(address);
    } catch (error) {
      console.error('Failed to select vault:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [vault, ws]);

  const refreshPortfolio = useCallback(async () => {
    if (!vault) return;
    try {
      const data = await api.getPortfolio(vault.address);
      setPortfolio(data);
    } catch (error) {
      console.error('Failed to refresh portfolio:', error);
    }
  }, [vault]);

  const refreshActivity = useCallback(async () => {
    if (!vault) return;
    try {
      const data = await api.getActivity(vault.address);
      setActivities(data.activities);
    } catch (error) {
      console.error('Failed to refresh activity:', error);
    }
  }, [vault]);

  const submitIntent = useCallback((text: string) => {
    if (!vault) return;
    ws.submitIntent(vault.address, text);
  }, [vault, ws]);

  const approvePlan = useCallback((planId: string) => {
    ws.approvePlan(planId);
  }, [ws]);

  const rejectPlan = useCallback((planId: string) => {
    ws.rejectPlan(planId);
    setPendingPlans((prev) => prev.filter((p) => p.plan.id !== planId));
  }, [ws]);

  // Context value
  const value: VaultContextType = {
    connectionStatus: ws.status,
    vault,
    portfolio,
    policy,
    activities,
    pendingPlans,
    prices,
    isLoading,
    selectVault,
    refreshPortfolio,
    refreshActivity,
    submitIntent,
    approvePlan,
    rejectPlan,
  };

  return (
    <VaultContext.Provider value={value}>
      {children}
    </VaultContext.Provider>
  );
}
