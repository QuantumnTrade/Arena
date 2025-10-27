/**
 * API Route: AI Analysis for All Agents
 * 
 * This endpoint triggers AI trading analysis for ALL active agents.
 * Called by the background job every 2.5 minutes.
 * 
 * Security: This is a server-side only endpoint
 */

import { NextResponse } from 'next/server';
import { executeAITradingForAllAgents } from '@/lib/ai-trading-service';
import { fetchAgents } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120; // 2 minutes max execution time

/**
 * POST /api/ai-analysis-all
 * 
 * Triggers AI analysis for all active agents
 * Called by Vercel Cron Jobs or manual trigger
 */
export async function POST(request: Request) {
  try {
    console.log('[API] AI Analysis All - Starting...');

    // Authentication: Support Supabase pg_cron, Vercel Cron, and manual triggers
    const authHeader = request.headers.get('authorization');
    const cronSecret = request.headers.get('x-vercel-cron-secret');
    const expectedToken = process.env.AI_ANALYSIS_SECRET_TOKEN;
    const expectedCronSecret = process.env.CRON_SECRET;
    
    // Allow if:
    // 1. Vercel Cron (has correct cron secret) - Only for Pro accounts
    // 2. Supabase pg_cron or Manual trigger (has correct auth token)
    const isVercelCron = cronSecret && cronSecret === expectedCronSecret;
    const isAuthorized = authHeader === `Bearer ${expectedToken}`;
    
    if (!isVercelCron && !isAuthorized) {
      console.warn('[API] AI Analysis All - Unauthorized access attempt');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const source = isVercelCron ? 'Vercel Cron' : (authHeader ? 'Supabase pg_cron' : 'Manual Trigger');
    console.log(`[API] AI Analysis All - Triggered by: ${source}`);

    // Fetch all agents from database
    const agents = await fetchAgents();
    const activeAgents = agents.filter(a => a.is_active);

    if (activeAgents.length === 0) {
      console.log('[API] AI Analysis All - No active agents found');
      return NextResponse.json({
        success: true,
        message: 'No active agents to analyze',
        agentsAnalyzed: 0,
        results: [],
      });
    }

    console.log(`[API] AI Analysis All - Analyzing ${activeAgents.length} agents...`);

    // Execute AI trading for all agents
    const results = await executeAITradingForAllAgents(activeAgents);

    // Count successes and failures
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    console.log(`[API] AI Analysis All - Completed: ${successCount} success, ${failureCount} failed`);

    return NextResponse.json({
      success: true,
      message: 'AI analysis completed for all agents',
      agentsAnalyzed: activeAgents.length,
      successCount,
      failureCount,
      results: results.map(r => ({
        agentId: r.agentId,
        agentModel: r.agentModel,
        success: r.success,
        decisionsExecuted: r.decisionsExecuted,
        positionsOpened: r.positionsOpened,
        positionsClosed: r.positionsClosed,
        errors: r.errors,
      })),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] AI Analysis All - Error:', errorMsg);

    return NextResponse.json(
      { 
        success: false,
        error: errorMsg 
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ai-analysis-all
 * 
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'AI analysis endpoint is running',
    timestamp: new Date().toISOString(),
  });
}
