/**
 * ASTER Account API (PER-AGENT)
 * 
 * Production endpoint for fetching and syncing ASTER account data
 * - Supports per-agent credentials
 * - Fetches account balance, positions, and status
 * - Updates Zustand store automatically
 * - Called every 5 seconds from client
 * 
 * GET /api/aster-account?agentId=xxx (optional)
 * If no agentId provided, syncs all agents from database
 */

import { NextResponse } from 'next/server';
import { fetchAgentAccountData } from '@/services/aster-account-service';
import { syncAgentBalance, syncAllAgentsBalances } from '@/lib/agent-sync-service';
import { fetchAgents } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Rate limiting: Track last request time
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 8000; // Minimum 8 seconds between requests

export async function GET(request: Request) {
  try {
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;

    // Parse query params
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');

    // Rate limit check
    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
      // Return cached data from store
      const { useAsterStore, selectAgentAccount, selectSelectedAgent } = await import('@/store/aster-store');
      const state = useAsterStore.getState();
      
      if (agentId) {
        // Return specific agent data
        const agentAccount = selectAgentAccount(agentId)(state);
        if (!agentAccount) {
          return NextResponse.json({
            success: false,
            error: 'Agent not found in store',
          }, { status: 404 });
        }
        
        return NextResponse.json({
          success: true,
          cached: true,
          data: agentAccount,
        });
      } else {
        // Return all agents data
        return NextResponse.json({
          success: true,
          cached: true,
          data: {
            accounts: state.accounts,
            selectedAgentId: state.selectedAgentId,
          },
        });
      }
    }

    lastRequestTime = now;

    if (agentId) {
      // Sync specific agent
      console.log(`[ASTER Account API] Syncing agent: ${agentId}`);
      
      // Fetch agent from database
      const agents = await fetchAgents();
      const agent = agents.find(a => a.id === agentId);
      
      if (!agent) {
        return NextResponse.json({
          success: false,
          error: 'Agent not found',
        }, { status: 404 });
      }

      if (!agent.credential_key) {
        return NextResponse.json({
          success: false,
          error: 'Agent has no credential_key configured',
        }, { status: 400 });
      }

      // Sync agent balance to database
      const syncResult = await syncAgentBalance(agent);
      
      if (!syncResult.success) {
        return NextResponse.json({
          success: false,
          error: syncResult.error || 'Failed to sync agent',
        }, { status: 500 });
      }

      // Fetch and update store
      const result = await fetchAgentAccountData(agent);

      if (!result.success) {
        return NextResponse.json({
          success: false,
          error: result.error || 'Failed to fetch account data',
        }, { status: 500 });
      }

      // Get updated state from store
      const { useAsterStore, selectAgentAccount } = await import('@/store/aster-store');
      const state = useAsterStore.getState();
      const agentAccount = selectAgentAccount(agentId)(state);

      return NextResponse.json({
        success: true,
        data: agentAccount,
      });
    } else {
      // Sync all agents
      console.log('[ASTER Account API] Syncing all agents...');
      
      // Fetch all agents from database
      const agents = await fetchAgents();
      const activeAgents = agents.filter(a => a.is_active && a.credential_key);

      if (activeAgents.length === 0) {
        return NextResponse.json({
          success: true,
          message: 'No active agents with credentials',
          data: { accounts: {}, selectedAgentId: null },
        });
      }

      // Sync all agents to database
      const syncResults = await syncAllAgentsBalances(activeAgents);
      console.log(`[ASTER Account API] Synced ${syncResults.filter(r => r.success).length}/${syncResults.length} agents`);

      // Fetch and update store for all agents SEQUENTIALLY to avoid API overload
      for (const agent of activeAgents) {
        try {
          await fetchAgentAccountData(agent);
          // Small delay between agents to prevent rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.error(`[ASTER Account API] Failed to fetch ${agent.model}:`, error);
          // Continue with next agent even if one fails
        }
      }

      // Get updated state from store
      const { useAsterStore } = await import('@/store/aster-store');
      const state = useAsterStore.getState();

      return NextResponse.json({
        success: true,
        data: {
          accounts: state.accounts,
          selectedAgentId: state.selectedAgentId,
          syncResults: syncResults.map(r => ({
            agentId: r.agentId,
            agentModel: r.agentModel,
            success: r.success,
            balance: r.balance,
            error: r.error,
          })),
        },
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[ASTER Account API] Error:', errorMessage);

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
