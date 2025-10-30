/**
 * Background Job: AI Trading Analysis
 * 
 * This service runs a background job that executes AI trading analysis
 * every 2.5 minutes on the SERVER SIDE (not client).
 * 
 * IMPORTANT: This runs on the SERVER SIDE ONLY (Node.js environment)
 * - Only ONE instance runs regardless of how many users access the website
 * - Prevents resource waste and overload
 * - Ensures consistent analysis for all users
 */

let intervalId: NodeJS.Timeout | null = null;
let isRunning = false;
let isAnalyzing = false;
let lastAnalysisTime: Date | null = null;
let lastAnalysisResults: Record<string, unknown> | null = null;

const ANALYSIS_INTERVAL_MS = 300000; // 5 minutes (300 seconds) - Reduced frequency to avoid Vercel rate limits
const API_ENDPOINT = '/api/ai-analysis-all';
const JITTER_MS = 30000; // Add 0-30s random jitter to prevent burst patterns

/**
 * Start the AI analysis background job
 */
export function startAIAnalysisJob() {
  if (isRunning) {
    console.log('[AI Analysis Job] Already running, skipping start');
    return;
  }

  console.log('[AI Analysis Job] Starting background job (interval: 5 minutes with jitter)');
  isRunning = true;

  // Run immediately on start (with initial delay to avoid startup burst)
  setTimeout(() => {
    runAnalysis();
  }, 5000); // 5 second initial delay

  // Then run every 5 minutes with random jitter
  intervalId = setInterval(() => {
    // Add random jitter (0-30s) to prevent predictable burst patterns
    const jitter = Math.floor(Math.random() * JITTER_MS);
    setTimeout(() => {
      runAnalysis();
    }, jitter);
  }, ANALYSIS_INTERVAL_MS);
}

/**
 * Stop the AI analysis background job
 */
export function stopAIAnalysisJob() {
  if (!isRunning) {
    console.log('[AI Analysis Job] Not running, skipping stop');
    return;
  }

  console.log('[AI Analysis Job] Stopping background job');
  
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  
  isRunning = false;
}

/**
 * Check if the job is currently running
 */
export function isAIAnalysisJobRunning(): boolean {
  return isRunning;
}

/**
 * Check if analysis is currently in progress
 */
export function isCurrentlyAnalyzing(): boolean {
  return isAnalyzing;
}

/**
 * Get last analysis time and results
 */
export function getLastAnalysisInfo() {
  return {
    lastAnalysisTime,
    lastAnalysisResults,
    isAnalyzing,
  };
}

/**
 * Execute the AI analysis
 */
async function runAnalysis() {
  // Skip if already analyzing
  if (isAnalyzing) {
    console.log('[AI Analysis Job] Analysis already in progress, skipping...');
    return;
  }

  try {
    isAnalyzing = true;
    console.log('[AI Analysis Job] 🚀 Starting AI analysis...');

    // Get the base URL for the API
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const url = `${baseUrl}${API_ENDPOINT}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      // Add timeout to prevent hanging
      signal: AbortSignal.timeout(120000), // 2 minute timeout (AI analysis can take time)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`API returned ${response.status}: ${errorData.error || 'Unknown error'}`);
    }

    const result = await response.json();
    
    // Store results
    lastAnalysisTime = new Date();
    lastAnalysisResults = result;
    
    console.log('[AI Analysis Job] ✅ Analysis completed:', {
      timestamp: lastAnalysisTime.toISOString(),
      agentsAnalyzed: result.agentsAnalyzed || 0,
      success: result.success,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[AI Analysis Job] ❌ Analysis failed:', errorMsg);
    
    // Don't throw - just log and continue
    lastAnalysisResults = {
      success: false,
      error: errorMsg,
    };
  } finally {
    isAnalyzing = false;
  }
}

/**
 * Manually trigger analysis (for testing or manual trigger)
 */
export async function triggerAnalysisNow() {
  console.log('[AI Analysis Job] Manual trigger requested');
  await runAnalysis();
}
