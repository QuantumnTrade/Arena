/**
 * ASTER Account State Management (PER-AGENT)
 * 
 * Zustand store for managing ASTER DEX account data
 * SUPPORTS MULTI-AGENT: Each agent has separate wallet/credentials
 * 
 * Best practices:
 * - Per-agent state isolation
 * - Typed state and actions
 * - Immutable updates
 * - Selective subscriptions
 * - Computed values via selectors
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

// Types
export interface AsterAsset {
  asset: string;
  balance: number;
  availableBalance: number;
  crossWalletBalance: number;
  unrealizedPnl: number;
}

export interface AsterPosition {
  symbol: string;
  positionAmt: number;
  entryPrice: number;
  markPrice: number;
  unrealizedProfit: number;
  liquidationPrice: number;
  leverage: number;
  positionSide: string;
}

// Per-agent account data
export interface AgentAccountData {
  agentId: string;
  agentModel?: string;
  credentialKey?: string;
  
  // Connection status
  isConnected: boolean;
  lastUpdate: number | null;
  error: string | null;
  
  // Account data
  totalBalance: number;
  availableBalance: number;
  canTrade: boolean;
  multiAssetsMode: boolean;
  
  // Assets
  assets: Record<string, AsterAsset>;
  
  // Positions
  positions: AsterPosition[];
  totalPositions: number;
  totalExposure: number;
  totalUnrealizedPnl: number;
  
  // Server info
  serverTime: string | null;
  timeDiff: number;
}

export interface AsterAccountState {
  // Multi-agent accounts (keyed by agentId)
  accounts: Record<string, AgentAccountData>;
  
  // Currently selected agent for UI
  selectedAgentId: string | null;
}

export interface AsterAccountActions {
  // Agent selection
  selectAgent: (agentId: string) => void;
  
  // Update full account data for specific agent
  setAgentAccountData: (agentId: string, data: Partial<AgentAccountData>) => void;
  
  // Update specific parts for specific agent
  setAgentAssets: (agentId: string, assets: Record<string, AsterAsset>) => void;
  setAgentPositions: (agentId: string, positions: AsterPosition[]) => void;
  setAgentConnectionStatus: (agentId: string, isConnected: boolean, error?: string | null) => void;
  
  // Remove agent data
  removeAgent: (agentId: string) => void;
  
  // Reset store
  reset: () => void;
  
  // Mark agent as updated
  markAgentUpdated: (agentId: string) => void;
}

export type AsterStore = AsterAccountState & AsterAccountActions;

// Initial state for new agent
const createInitialAgentData = (agentId: string): AgentAccountData => ({
  agentId,
  isConnected: false,
  lastUpdate: null,
  error: null,
  totalBalance: 0,
  availableBalance: 0,
  canTrade: false,
  multiAssetsMode: false,
  assets: {},
  positions: [],
  totalPositions: 0,
  totalExposure: 0,
  totalUnrealizedPnl: 0,
  serverTime: null,
  timeDiff: 0,
});

// Initial store state
const initialState: AsterAccountState = {
  accounts: {},
  selectedAgentId: null,
};

/**
 * ASTER Account Store
 * 
 * Usage:
 * ```tsx
 * // Get full state
 * const { totalBalance, canTrade } = useAsterStore();
 * 
 * // Selective subscription (better performance)
 * const totalBalance = useAsterStore(state => state.totalBalance);
 * 
 * // Actions
 * const setAccountData = useAsterStore(state => state.setAccountData);
 * ```
 */
export const useAsterStore = create<AsterStore>()(
  devtools(
    (set) => ({
      ...initialState,

      // Select agent
      selectAgent: (agentId: string) =>
        set(
          (state) => ({
            ...state,
            selectedAgentId: agentId,
          }),
          false,
          'selectAgent'
        ),

      // Update full account data for specific agent
      setAgentAccountData: (agentId: string, data: Partial<AgentAccountData>) =>
        set(
          (state) => ({
            ...state,
            accounts: {
              ...state.accounts,
              [agentId]: {
                ...(state.accounts[agentId] || createInitialAgentData(agentId)),
                ...data,
                agentId,
                lastUpdate: Date.now(),
              },
            },
          }),
          false,
          'setAgentAccountData'
        ),

      // Update assets for specific agent
      setAgentAssets: (agentId: string, assets: Record<string, AsterAsset>) =>
        set(
          (state) => ({
            ...state,
            accounts: {
              ...state.accounts,
              [agentId]: {
                ...(state.accounts[agentId] || createInitialAgentData(agentId)),
                assets,
                lastUpdate: Date.now(),
              },
            },
          }),
          false,
          'setAgentAssets'
        ),

      // Update positions for specific agent
      setAgentPositions: (agentId: string, positions: AsterPosition[]) =>
        set(
          (state) => {
            const totalExposure = positions.reduce(
              (sum, p) => sum + Math.abs(p.positionAmt * p.markPrice),
              0
            );
            const totalUnrealizedPnl = positions.reduce(
              (sum, p) => sum + p.unrealizedProfit,
              0
            );

            return {
              ...state,
              accounts: {
                ...state.accounts,
                [agentId]: {
                  ...(state.accounts[agentId] || createInitialAgentData(agentId)),
                  positions,
                  totalPositions: positions.filter(p => p.positionAmt !== 0).length,
                  totalExposure,
                  totalUnrealizedPnl,
                  lastUpdate: Date.now(),
                },
              },
            };
          },
          false,
          'setAgentPositions'
        ),

      // Update connection status for specific agent
      setAgentConnectionStatus: (agentId: string, isConnected: boolean, error: string | null = null) =>
        set(
          (state) => ({
            ...state,
            accounts: {
              ...state.accounts,
              [agentId]: {
                ...(state.accounts[agentId] || createInitialAgentData(agentId)),
                isConnected,
                error,
                lastUpdate: Date.now(),
              },
            },
          }),
          false,
          'setAgentConnectionStatus'
        ),

      // Mark agent as updated
      markAgentUpdated: (agentId: string) =>
        set(
          (state) => ({
            ...state,
            accounts: {
              ...state.accounts,
              [agentId]: {
                ...(state.accounts[agentId] || createInitialAgentData(agentId)),
                lastUpdate: Date.now(),
              },
            },
          }),
          false,
          'markAgentUpdated'
        ),

      // Remove agent data
      removeAgent: (agentId: string) =>
        set(
          (state) => {
            const { [agentId]: removed, ...remainingAccounts } = state.accounts;
            return {
              ...state,
              accounts: remainingAccounts,
              selectedAgentId: state.selectedAgentId === agentId ? null : state.selectedAgentId,
            };
          },
          false,
          'removeAgent'
        ),

      // Reset store
      reset: () =>
        set(
          initialState,
          false,
          'reset'
        ),
    }),
    {
      name: 'aster-store',
      enabled: process.env.NODE_ENV === 'development',
    }
  )
);

// ============================================
// SELECTORS (for better performance)
// ============================================

/**
 * Get agent account data
 */
export const selectAgentAccount = (agentId: string) => (state: AsterStore) =>
  state.accounts[agentId];

/**
 * Get currently selected agent data
 */
export const selectSelectedAgent = (state: AsterStore) =>
  state.selectedAgentId ? state.accounts[state.selectedAgentId] : null;

/**
 * Get specific asset balance for agent
 */
export const selectAgentAsset = (agentId: string, asset: string) => (state: AsterStore) =>
  state.accounts[agentId]?.assets[asset];

/**
 * Get BNB balance for agent
 */
export const selectAgentBNBBalance = (agentId: string) => (state: AsterStore) =>
  state.accounts[agentId]?.assets['BNB']?.availableBalance || 0;

/**
 * Get USDT balance for agent
 */
export const selectAgentUSDTBalance = (agentId: string) => (state: AsterStore) =>
  state.accounts[agentId]?.assets['USDT']?.availableBalance || 0;

/**
 * Get active positions only for agent
 */
export const selectAgentActivePositions = (agentId: string) => (state: AsterStore) =>
  state.accounts[agentId]?.positions.filter((p) => p.positionAmt !== 0) || [];

/**
 * Get position by symbol for agent
 */
export const selectAgentPosition = (agentId: string, symbol: string) => (state: AsterStore) =>
  state.accounts[agentId]?.positions.find((p) => p.symbol === symbol);

/**
 * Check if agent can trade
 */
export const selectAgentCanTrade = (agentId: string) => (state: AsterStore) => {
  const account = state.accounts[agentId];
  return account ? account.isConnected && account.canTrade && account.availableBalance > 2 : false;
};

/**
 * Get account summary for agent
 */
export const selectAgentAccountSummary = (agentId: string) => (state: AsterStore) => {
  const account = state.accounts[agentId];
  return account ? {
    totalBalance: account.totalBalance,
    availableBalance: account.availableBalance,
    totalPositions: account.totalPositions,
    totalExposure: account.totalExposure,
    totalUnrealizedPnl: account.totalUnrealizedPnl,
    canTrade: account.canTrade,
    multiAssetsMode: account.multiAssetsMode,
  } : null;
};

/**
 * Get all agent IDs
 */
export const selectAllAgentIds = (state: AsterStore) =>
  Object.keys(state.accounts);
