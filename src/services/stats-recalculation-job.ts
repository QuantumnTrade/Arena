/**
 * Background Job: Stats Recalculation
 * 
 * This service runs a background job that recalculates agent statistics
 * every 10 seconds by calling the recalculate-stats API endpoint.
 * 
 * IMPORTANT: This runs on the SERVER SIDE ONLY (Node.js environment)
 */

let intervalId: NodeJS.Timeout | null = null;
let isRunning = false;

const RECALC_INTERVAL_MS = 10000; // 10 seconds
const API_ENDPOINT = '/api/recalculate-stats';

/**
 * Start the stats recalculation background job
 */
export function startStatsRecalculationJob() {
  if (isRunning) {
    console.log('[Stats Job] Already running, skipping start');
    return;
  }

  console.log('[Stats Job] Starting background job (interval: 10s)');
  isRunning = true;

  // Run immediately on start
  runRecalculation();

  // Then run every 10 seconds
  intervalId = setInterval(() => {
    runRecalculation();
  }, RECALC_INTERVAL_MS);
}

/**
 * Stop the stats recalculation background job
 */
export function stopStatsRecalculationJob() {
  if (!isRunning) {
    console.log('[Stats Job] Not running, skipping stop');
    return;
  }

  console.log('[Stats Job] Stopping background job');
  
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  
  isRunning = false;
}

/**
 * Check if the job is currently running
 */
export function isStatsJobRunning(): boolean {
  return isRunning;
}

/**
 * Execute the recalculation
 */
async function runRecalculation() {
  try {
    console.log('[Stats Job] Running recalculation...');

    // Get the base URL for the API
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const url = `${baseUrl}${API_ENDPOINT}`;

    // Optional: Add authentication token
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    const secretToken = process.env.STATS_RECALC_SECRET_TOKEN;
    if (secretToken) {
      headers['Authorization'] = `Bearer ${secretToken}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      // Add timeout to prevent hanging
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`API returned ${response.status}: ${errorData.error || 'Unknown error'}`);
    }

    const result = await response.json();
    console.log('[Stats Job] ✅ Recalculation completed:', result);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Stats Job] ❌ Recalculation failed:', errorMsg);
  }
}
