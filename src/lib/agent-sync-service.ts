/**
 * Agent Sync Service
 * Syncs each agent's ASTER account balance to database
 * Uses direct fetch API (no @supabase/supabase-js package required)
 */

import * as AsterClient from "@/lib/aster-client";
import { getAgentCredentials, hasCredentials } from "@/lib/aster-credentials";
import type { Agent } from "@/types";

const QUANTUM_SUPABASE_URL = process.env.NEXT_PUBLIC_QUANTUM_SUPABASE_URL;
const QUANTUM_SUPABASE_KEY = process.env.NEXT_PUBLIC_QUANTUM_SUPABASE_KEY;

function getHeaders(): HeadersInit {
  if (!QUANTUM_SUPABASE_KEY) throw new Error('Missing NEXT_PUBLIC_QUANTUM_SUPABASE_KEY');
  return {
    apikey: QUANTUM_SUPABASE_KEY,
    Authorization: `Bearer ${QUANTUM_SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
  };
}

export interface AgentSyncResult {
  agentId: string;
  agentModel: string;
  success: boolean;
  balance?: number;
  availableBalance?: number;
  usdtBalance?: number;
  bnbBalance?: number;
  error?: string;
}

export async function syncAgentBalance(agent: Agent): Promise<AgentSyncResult> {
  const result: AgentSyncResult = {
    agentId: agent.id,
    agentModel: agent.model,
    success: false,
  };

  try {
    if (!agent.credential_key) {
      throw new Error(`Agent ${agent.model} has no credential_key`);
    }

    if (!hasCredentials(agent.credential_key)) {
      throw new Error(`Credentials not configured for ${agent.credential_key}`);
    }

    const credentials = getAgentCredentials(agent.credential_key);

    // Fetch balance from ASTER
    const balances = await AsterClient.getAccountBalance(credentials);

    let totalBalance = 0;
    let availableBalance = 0;
    let usdtBalance = 0;
    let bnbBalance = 0;

    for (const balance of balances) {
      const available = parseFloat(balance.availableBalance);

      if (balance.asset === "USDT") {
        usdtBalance = available;
        totalBalance += available;
        availableBalance += available;
      } else if (balance.asset === "BNB") {
        bnbBalance = parseFloat(balance.balance);
        totalBalance += bnbBalance;
        availableBalance += available;
      }
    }

    // Fetch positions for unrealized PnL
    const positions = await AsterClient.getPositionInfo(credentials);
    let unrealizedPnl = 0;
    let totalExposure = 0;
    let activePositions = 0;

    for (const pos of positions) {
      const posAmt = parseFloat(pos.positionAmt);
      if (posAmt !== 0) {
        unrealizedPnl += parseFloat(pos.unRealizedProfit);
        totalExposure += Math.abs(posAmt) * parseFloat(pos.markPrice);
        activePositions++;
      }
    }

    // Update agent in database using fetch API
    if (!QUANTUM_SUPABASE_URL) throw new Error('Missing NEXT_PUBLIC_QUANTUM_SUPABASE_URL');
    
    const url = `${QUANTUM_SUPABASE_URL}/rest/v1/agents?id=eq.${agent.id}`;
    
    const updateData = {
      balance: totalBalance,
      available_balance: availableBalance,
      usdt_balance: usdtBalance,
      bnb_balance: bnbBalance,
      unrealized_pnl: unrealizedPnl,
      total_exposure: totalExposure,
      active_positions: activePositions,
      can_trade: availableBalance > 2,
      aster_account_connected: true,
      last_sync_at: new Date().toISOString(),
    };

    const response = await fetch(url, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(updateData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to update agent: ${response.status} - ${errorText}`);
    }

    result.success = true;
    result.balance = totalBalance;
    result.availableBalance = availableBalance;
    result.usdtBalance = usdtBalance;
    result.bnbBalance = bnbBalance;

    console.log(
      `[Agent Sync] ✅ ${agent.model}: Balance=${totalBalance.toFixed(2)}, ` +
        `Available=${availableBalance.toFixed(2)}, Positions=${activePositions}`
    );

    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    result.error = errorMsg;
    console.error(`[Agent Sync] ❌ ${agent.model}: ${errorMsg}`);

    // Mark agent as disconnected using fetch API
    try {
      if (QUANTUM_SUPABASE_URL) {
        const url = `${QUANTUM_SUPABASE_URL}/rest/v1/agents?id=eq.${agent.id}`;
        await fetch(url, {
          method: 'PATCH',
          headers: getHeaders(),
          body: JSON.stringify({
            aster_account_connected: false,
            can_trade: false,
          }),
        });
      }
    } catch (updateError) {
      console.error(`[Agent Sync] Failed to mark agent as disconnected:`, updateError);
    }

    return result;
  }
}

export async function syncAllAgentsBalances(
  agents: Agent[]
): Promise<AgentSyncResult[]> {
  console.log(`[Agent Sync] 🔄 Syncing ${agents.length} agents...`);

  const results = await Promise.all(
    agents.map((agent) => syncAgentBalance(agent))
  );

  const successCount = results.filter((r) => r.success).length;
  console.log(
    `[Agent Sync] ✅ Completed: ${successCount}/${results.length} success`
  );

  return results;
}
