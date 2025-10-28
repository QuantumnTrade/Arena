/**
 * ASTER Account Hooks (PER-AGENT)
 * 
 * Custom hooks for easy access to ASTER account data
 * SUPPORTS MULTI-AGENT: Each hook requires agentId parameter
 * 
 * Best practices:
 * - Per-agent data isolation
 * - Selective subscriptions for performance
 * - Computed values
 * - Auto-refresh capabilities
 */

import { useEffect, useCallback, useRef } from 'react';
import {
  useAsterStore,
  selectAgentAccount,
  selectAgentBNBBalance,
  selectAgentUSDTBalance,
  selectAgentActivePositions,
  selectAgentCanTrade,
  selectAgentAccountSummary,
  selectSelectedAgent,
} from '@/store/aster-store';
import { fetchAgentAccountData, fetchAgentBalances, fetchAgentPositions } from '@/services/aster-account-service';
import type { Agent } from '@/types';

/**
 * Hook to get full account state for specific agent
 * Use sparingly - prefer specific hooks for better performance
 * 
 * @param agentId - Agent ID
 */
export function useAgentAccount(agentId: string) {
  return useAsterStore(selectAgentAccount(agentId));
}

/**
 * Hook to get currently selected agent account
 */
export function useSelectedAgentAccount() {
  return useAsterStore(selectSelectedAgent);
}

/**
 * Hook to get account summary for specific agent (optimized)
 * 
 * @param agentId - Agent ID
 */
export function useAgentAccountSummary(agentId: string) {
  return useAsterStore(selectAgentAccountSummary(agentId));
}

/**
 * Hook to get BNB balance for specific agent
 * 
 * @param agentId - Agent ID
 */
export function useAgentBNBBalance(agentId: string) {
  return useAsterStore(selectAgentBNBBalance(agentId));
}

/**
 * Hook to get USDT balance for specific agent
 * 
 * @param agentId - Agent ID
 */
export function useAgentUSDTBalance(agentId: string) {
  return useAsterStore(selectAgentUSDTBalance(agentId));
}

/**
 * Hook to get specific asset balance for agent
 * 
 * @param agentId - Agent ID
 * @param asset - Asset symbol (e.g., 'USDT', 'BNB')
 */
export function useAgentAssetBalance(agentId: string, asset: string) {
  return useAsterStore((state) => state.accounts[agentId]?.assets[asset]);
}

/**
 * Hook to get active positions for specific agent
 * 
 * @param agentId - Agent ID
 */
export function useAgentActivePositions(agentId: string) {
  return useAsterStore(selectAgentActivePositions(agentId));
}

/**
 * Hook to get all positions for specific agent
 * 
 * @param agentId - Agent ID
 */
export function useAgentPositions(agentId: string) {
  return useAsterStore((state) => state.accounts[agentId]?.positions || []);
}

/**
 * Hook to get specific position for agent
 * 
 * @param agentId - Agent ID
 * @param symbol - Trading symbol
 */
export function useAgentPosition(agentId: string, symbol: string) {
  return useAsterStore((state) => 
    state.accounts[agentId]?.positions.find((p) => p.symbol === symbol)
  );
}

/**
 * Hook to check if agent can trade
 * 
 * @param agentId - Agent ID
 */
export function useAgentCanTrade(agentId: string) {
  return useAsterStore(selectAgentCanTrade(agentId));
}

/**
 * Hook to get connection status for specific agent
 * 
 * @param agentId - Agent ID
 */
export function useAgentConnectionStatus(agentId: string) {
  return useAsterStore((state) => {
    const account = state.accounts[agentId];
    return account ? {
      isConnected: account.isConnected,
      error: account.error,
      lastUpdate: account.lastUpdate,
    } : {
      isConnected: false,
      error: 'Agent not found',
      lastUpdate: null,
    };
  });
}

/**
 * Hook to get multi-assets mode status for specific agent
 * 
 * @param agentId - Agent ID
 */
export function useAgentMultiAssetsMode(agentId: string) {
  return useAsterStore((state) => state.accounts[agentId]?.multiAssetsMode || false);
}

/**
 * Hook with auto-refresh functionality for specific agent
 * 
 * @param agent - Agent object with credential_key
 * @param intervalMs - Refresh interval in milliseconds (default: 30000 = 30s)
 * @param enabled - Enable/disable auto-refresh (default: true)
 * 
 * @example
 * ```tsx
 * function MyComponent({ agent }) {
 *   const { isLoading, error, refresh } = useAgentAccountWithRefresh(agent, 10000);
 *   const summary = useAgentAccountSummary(agent.id);
 *   
 *   return (
 *     <div>
 *       <p>Balance: ${summary?.totalBalance}</p>
 *       <button onClick={refresh}>Refresh</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useAgentAccountWithRefresh(
  agent: Agent,
  intervalMs: number = 30000,
  enabled: boolean = true
) {
  const account = useAsterStore((state) => state.accounts[agent.id]);
  const isLoading = !account || account.lastUpdate === null;
  const error = account?.error || null;
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const refresh = useCallback(async () => {
    await fetchAgentAccountData(agent);
  }, [agent]);

  useEffect(() => {
    if (!enabled) return;

    // Initial fetch
    refresh();

    // Setup interval
    intervalRef.current = setInterval(refresh, intervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, intervalMs, refresh]);

  return {
    isLoading,
    error,
    refresh,
  };
}

/**
 * Hook for manual refresh (no auto-refresh) for specific agent
 * 
 * @param agent - Agent object with credential_key
 * 
 * @example
 * ```tsx
 * function MyComponent({ agent }) {
 *   const { refresh, refreshBalances, refreshPositions } = useAgentAccountRefresh(agent);
 *   
 *   return (
 *     <div>
 *       <button onClick={refresh}>Refresh All</button>
 *       <button onClick={refreshBalances}>Refresh Balances</button>
 *       <button onClick={refreshPositions}>Refresh Positions</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useAgentAccountRefresh(agent: Agent) {
  const refresh = useCallback(async () => {
    await fetchAgentAccountData(agent);
  }, [agent]);

  const refreshBalances = useCallback(async () => {
    await fetchAgentBalances(agent);
  }, [agent]);

  const refreshPositions = useCallback(async () => {
    await fetchAgentPositions(agent);
  }, [agent]);

  return {
    refresh,
    refreshBalances,
    refreshPositions,
  };
}

/**
 * Hook to initialize account data on mount for specific agent
 * 
 * @param agent - Agent object with credential_key
 * 
 * @example
 * ```tsx
 * function AgentDashboard({ agent }) {
 *   useAgentAccountInit(agent);
 *   
 *   return <YourDashboard />;
 * }
 * ```
 */
export function useAgentAccountInit(agent: Agent) {
  useEffect(() => {
    fetchAgentAccountData(agent);
  }, [agent]);
}

// ============================================
// BACKWARD COMPATIBILITY EXPORTS
// (Deprecated - use Agent-specific hooks)
// ============================================

/**
 * @deprecated Use useAgentAccountSummary(agentId) instead
 */
export function useAccountSummary() {
  const selectedAgent = useAsterStore(selectSelectedAgent);
  return selectedAgent ? {
    totalBalance: selectedAgent.totalBalance,
    availableBalance: selectedAgent.availableBalance,
    totalPositions: selectedAgent.totalPositions,
    totalExposure: selectedAgent.totalExposure,
    totalUnrealizedPnl: selectedAgent.totalUnrealizedPnl,
    canTrade: selectedAgent.canTrade,
    multiAssetsMode: selectedAgent.multiAssetsMode,
  } : null;
}

/**
 * @deprecated Use useAgentBNBBalance(agentId) instead
 */
export function useBNBBalance() {
  const selectedAgent = useAsterStore(selectSelectedAgent);
  return selectedAgent?.assets['BNB']?.availableBalance || 0;
}

/**
 * @deprecated Use useAgentUSDTBalance(agentId) instead
 */
export function useUSDTBalance() {
  const selectedAgent = useAsterStore(selectSelectedAgent);
  return selectedAgent?.assets['USDT']?.availableBalance || 0;
}

/**
 * @deprecated Use useAgentActivePositions(agentId) instead
 */
export function useActivePositions() {
  const selectedAgent = useAsterStore(selectSelectedAgent);
  return selectedAgent?.positions.filter((p) => p.positionAmt !== 0) || [];
}

/**
 * @deprecated Use useAgentAccountWithRefresh(agent) instead
 */
export function useAsterAccountWithRefresh(
  intervalMs: number = 30000,
  enabled: boolean = true
) {
  const selectedAgent = useAsterStore(selectSelectedAgent);
  const isLoading = !selectedAgent || selectedAgent.lastUpdate === null;
  const error = selectedAgent?.error || null;
  
  return {
    isLoading,
    error,
    refresh: async () => {
      console.warn('useAsterAccountWithRefresh is deprecated. Use useAgentAccountWithRefresh(agent) instead.');
    },
  };
}
