/**
 * ASTER Account Auto-Sync Hook (PER-AGENT)
 * 
 * Automatically syncs ALL active agents' ASTER account data with exponential backoff
 * - Calls /api/aster-account (no params = sync all agents)
 * - Updates Zustand store for each agent
 * - Handles rate limiting and caching
 * 
 * Call this in root layout or main page
 */

'use client';

import { useEffect, useRef, useState } from 'react';

const INITIAL_SYNC_INTERVAL = 10000; // Start with 10 seconds
const MAX_SYNC_INTERVAL = 60000; // Max 60 seconds
const MIN_SYNC_INTERVAL = 10000; // Min 10 seconds

export function useAsterAccountSync() {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [syncInterval, setSyncInterval] = useState(INITIAL_SYNC_INTERVAL);
  const consecutiveErrorsRef = useRef(0);

  useEffect(() => {
    async function syncAccount() {
      try {
        const response = await fetch('/api/aster-account');
        
        // Check if response is OK
        if (!response.ok) {
          // console.error('[ASTER Sync] HTTP Error:', response.status, response.statusText);
          return;
        }

        // Check if response has content
        const text = await response.text();
        if (!text) {
          // console.error('[ASTER Sync] Empty response');
          return;
        }

        // Parse JSON
        let data;
        try {
          data = JSON.parse(text);
        } catch (parseError) {
          // console.error('[ASTER Sync] JSON Parse Error:', parseError);
          // console.error('[ASTER Sync] Response text:', text.substring(0, 200));
          return;
        }

        if (!data.success) {
          // console.error('[ASTER Sync] Failed:', data.error);
          
          // Increment error counter and increase interval
          consecutiveErrorsRef.current += 1;
          const newInterval = Math.min(
            syncInterval * 2,
            MAX_SYNC_INTERVAL
          );
          
          if (newInterval !== syncInterval) {
            // console.warn(`[ASTER Sync] Increasing interval to ${newInterval}ms due to errors`);
            setSyncInterval(newInterval);
          }
          
          return;
        }

        // Success - reset error counter and interval
        if (consecutiveErrorsRef.current > 0) {
          console.log('[ASTER Sync] ✅ Recovered from errors, resetting interval');
          consecutiveErrorsRef.current = 0;
          setSyncInterval(INITIAL_SYNC_INTERVAL);
        }

        // Log sync results (new per-agent format)
        if (data.data?.syncResults) {
          const successCount = data.data.syncResults.filter((r: any) => r.success).length;
          const totalCount = data.data.syncResults.length;
          console.log(`[ASTER Sync] ✅ Synced ${successCount}/${totalCount} agents`, {
            cached: data.cached,
            agents: data.data.syncResults.map((r: any) => `${r.agentModel}: ${r.success ? '✅' : '❌'}`),
          });
        } else if (data.cached) {
          console.log('[ASTER Sync] 📦 Using cached data (rate limited)');
        } else {
          console.log('[ASTER Sync] ✅ All agents synced');
        }
      } catch (error) {
        // console.error('[ASTER Sync] Error:', error);
        
        // Increment error counter and increase interval
        consecutiveErrorsRef.current += 1;
        const newInterval = Math.min(
          syncInterval * 2,
          MAX_SYNC_INTERVAL
        );
        
        if (newInterval !== syncInterval) {
          // console.warn(`[ASTER Sync] Increasing interval to ${newInterval}ms due to errors`);
          setSyncInterval(newInterval);
        }
      }
    }

    // Initial sync
    syncAccount();

    // Setup interval with dynamic interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    intervalRef.current = setInterval(syncAccount, syncInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [syncInterval]); // Re-run when interval changes
}
