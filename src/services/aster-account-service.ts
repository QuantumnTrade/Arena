/**
 * ASTER Account Service (PER-AGENT)
 * 
 * Service layer for fetching ASTER account data and updating Zustand store
 * SUPPORTS MULTI-AGENT: Each agent uses their own credentials
 * 
 * Best practices:
 * - Per-agent credential isolation
 * - Separation of concerns (API calls vs state management)
 * - Error handling
 * - Type safety
 */

import * as AsterClient from '@/lib/aster-client';
import { getAgentCredentials } from '@/lib/aster-credentials';
import { useAsterStore, AsterAsset, AsterPosition } from '@/store/aster-store';
import type { Agent } from '@/types';

/**
 * Fetch and update account data in store for specific agent
 * 
 * @param agent - Agent with credential_key
 */
export async function fetchAgentAccountData(agent: Agent): Promise<{
  success: boolean;
  error?: string;
}> {
  const store = useAsterStore.getState();

  try {
    if (!agent.credential_key) {
      throw new Error(`Agent ${agent.model} has no credential_key`);
    }

    console.log(`[ASTER Service] Fetching account data for ${agent.model}...`);

    // Get agent credentials
    const credentials = getAgentCredentials(agent.credential_key);

    // 1. Test connectivity
    const isConnected = await AsterClient.testConnectivity();
    if (!isConnected) {
      store.setAgentConnectionStatus(agent.id, false, 'Failed to connect to ASTER API');
      return { success: false, error: 'Connection failed' };
    }
    console.log(`[ASTER Service] ✅ ${agent.model} connected`);

    // 2. Get server time
    const serverTime = await AsterClient.getServerTime();
    const localTime = Date.now();
    const timeDiff = localTime - serverTime;

    // 3. Fetch account balance with agent credentials (with retry)
    let balances;
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
      try {
        balances = await AsterClient.getAccountBalance(credentials);
        break; // Success, exit retry loop
      } catch (error) {
        retryCount++;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        
        if (retryCount >= maxRetries) {
          console.error(`[ASTER Service] Failed to fetch balance after ${maxRetries} retries:`, errorMsg);
          throw error;
        }
        
        console.warn(`[ASTER Service] Balance fetch failed (attempt ${retryCount}/${maxRetries}), retrying in ${retryCount}s...`);
        await new Promise(resolve => setTimeout(resolve, retryCount * 1000)); // Exponential backoff
      }
    }

    // Transform balances to assets map
    const assets: Record<string, AsterAsset> = {};
    let totalBalance = 0;
    let availableBalance = 0;

    for (const balance of balances!) {
      const asset: AsterAsset = {
        asset: balance.asset,
        balance: parseFloat(balance.balance),
        availableBalance: parseFloat(balance.availableBalance),
        crossWalletBalance: parseFloat(balance.crossWalletBalance),
        unrealizedPnl: parseFloat(balance.crossUnPnl),
      };

      assets[balance.asset] = asset;

      // Calculate total (convert to USD equivalent later if needed)
      if (balance.asset === 'USDT') {
        totalBalance += asset.availableBalance;
        availableBalance += asset.availableBalance;
      } else if (balance.asset === 'BNB') {
        // For now, just add BNB balance (should convert to USD in production)
        totalBalance += asset.balance;
        availableBalance += asset.availableBalance;
      }
    }

    // 4. Fetch positions with agent credentials (with retry)
    let positionsData;
    retryCount = 0;
    
    while (retryCount < maxRetries) {
      try {
        positionsData = await AsterClient.getPositionInfo(credentials);
        break; // Success, exit retry loop
      } catch (error) {
        retryCount++;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        
        if (retryCount >= maxRetries) {
          console.error(`[ASTER Service] Failed to fetch positions after ${maxRetries} retries:`, errorMsg);
          throw error;
        }
        
        console.warn(`[ASTER Service] Positions fetch failed (attempt ${retryCount}/${maxRetries}), retrying in ${retryCount}s...`);
        await new Promise(resolve => setTimeout(resolve, retryCount * 1000)); // Exponential backoff
      }
    }
    const positions: AsterPosition[] = positionsData!.map((p) => ({
      symbol: p.symbol,
      positionAmt: parseFloat(p.positionAmt),
      entryPrice: parseFloat(p.entryPrice),
      markPrice: parseFloat(p.markPrice),
      unrealizedProfit: parseFloat(p.unRealizedProfit),
      liquidationPrice: parseFloat(p.liquidationPrice),
      leverage: parseFloat(p.leverage),
      positionSide: p.positionSide,
    }));

    // 5. Get multi-assets mode status
    let multiAssetsMode = false;
    try {
      const modeStatus = await AsterClient.getMultiAssetsMode(credentials);
      multiAssetsMode = modeStatus.multiAssetsMargin;
    } catch (error) {
      console.warn('[ASTER Service] Failed to get multi-assets mode:', error);
    }

    // 6. Update store for this agent
    store.setAgentAccountData(agent.id, {
      agentModel: agent.model,
      credentialKey: agent.credential_key,
      isConnected: true,
      totalBalance,
      availableBalance,
      canTrade: availableBalance > 2,
      multiAssetsMode,
      serverTime: new Date(serverTime).toISOString(),
      timeDiff,
      error: null,
    });

    store.setAgentAssets(agent.id, assets);
    store.setAgentPositions(agent.id, positions);

    console.log(`[ASTER Service] ✅ ${agent.model} store updated`);
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[ASTER Service] Failed to fetch ${agent.model} account data:`, errorMessage);
    
    store.setAgentConnectionStatus(agent.id, false, errorMessage);
    
    return { success: false, error: errorMessage };
  }
}

/**
 * Fetch only balances for specific agent (lighter operation)
 */
export async function fetchAgentBalances(agent: Agent): Promise<{
  success: boolean;
  error?: string;
}> {
  const store = useAsterStore.getState();

  try {
    if (!agent.credential_key) {
      throw new Error(`Agent ${agent.model} has no credential_key`);
    }

    const credentials = getAgentCredentials(agent.credential_key);
    const balances = await AsterClient.getAccountBalance(credentials);

    const assets: Record<string, AsterAsset> = {};
    let totalBalance = 0;
    let availableBalance = 0;

    for (const balance of balances) {
      const asset: AsterAsset = {
        asset: balance.asset,
        balance: parseFloat(balance.balance),
        availableBalance: parseFloat(balance.availableBalance),
        crossWalletBalance: parseFloat(balance.crossWalletBalance),
        unrealizedPnl: parseFloat(balance.crossUnPnl),
      };

      assets[balance.asset] = asset;

      if (balance.asset === 'USDT') {
        totalBalance += asset.availableBalance;
        availableBalance += asset.availableBalance;
      } else if (balance.asset === 'BNB') {
        totalBalance += asset.balance;
        availableBalance += asset.availableBalance;
      }
    }

    store.setAgentAccountData(agent.id, {
      totalBalance,
      availableBalance,
      canTrade: availableBalance > 2,
    });

    store.setAgentAssets(agent.id, assets);

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[ASTER Service] Failed to fetch balances:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Fetch only positions for specific agent (lighter operation)
 */
export async function fetchAgentPositions(agent: Agent): Promise<{
  success: boolean;
  error?: string;
}> {
  const store = useAsterStore.getState();

  try {
    if (!agent.credential_key) {
      throw new Error(`Agent ${agent.model} has no credential_key`);
    }

    const credentials = getAgentCredentials(agent.credential_key);
    const positionsData = await AsterClient.getPositionInfo(credentials);
    const positions: AsterPosition[] = positionsData.map((p) => ({
      symbol: p.symbol,
      positionAmt: parseFloat(p.positionAmt),
      entryPrice: parseFloat(p.entryPrice),
      markPrice: parseFloat(p.markPrice),
      unrealizedProfit: parseFloat(p.unRealizedProfit),
      liquidationPrice: parseFloat(p.liquidationPrice),
      leverage: parseFloat(p.leverage),
      positionSide: p.positionSide,
    }));

    store.setAgentPositions(agent.id, positions);

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[ASTER Service] Failed to fetch positions:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Reset account data for specific agent
 */
export function resetAgentAccountData(agentId: string): void {
  const store = useAsterStore.getState();
  store.removeAgent(agentId);
}

/**
 * Reset all account data
 */
export function resetAllAccountData(): void {
  const store = useAsterStore.getState();
  store.reset();
}
