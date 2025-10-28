/**
 * API Route: Recalculate Agent Stats
 * 
 * This endpoint recalculates agent statistics from all closed positions.
 * It should be called periodically by a background job.
 * 
 * Security: This is a server-side only endpoint
 */

import { NextResponse } from 'next/server';
import { recalculateAllAgentsStats } from '@/lib/supabase-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/recalculate-stats
 * 
 * Recalculates stats for all agents based on their closed positions
 * Called by Vercel Cron Jobs or manual trigger
 */
export async function POST(request: Request) {
  try {
    console.log('[API] Recalculate Stats - Starting...');

    // Authentication: Support Supabase pg_cron, Vercel Cron, and manual triggers
    const authHeader = request.headers.get('authorization');
    const cronSecret = request.headers.get('x-vercel-cron-secret');
    const expectedToken = process.env.STATS_RECALC_SECRET_TOKEN;
    const expectedCronSecret = process.env.CRON_SECRET;
    
    // Allow if:
    // 1. Vercel Cron (has correct cron secret) - Only for Pro accounts
    // 2. Supabase pg_cron or Manual trigger (has correct auth token)
    const isVercelCron = cronSecret && cronSecret === expectedCronSecret;
    const isAuthorized = authHeader === `Bearer ${expectedToken}`;
    
    if (!isVercelCron && !isAuthorized) {
      console.warn('[API] Recalculate Stats - Unauthorized access attempt');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const source = isVercelCron ? 'Vercel Cron' : (authHeader ? 'Supabase pg_cron' : 'Manual Trigger');
    console.log(`[API] Recalculate Stats - Triggered by: ${source}`);

    // Recalculate stats for all agents
    const result = await recalculateAllAgentsStats();

    console.log('[API] Recalculate Stats - Completed:', result);

    return NextResponse.json({
      success: true,
      message: 'Stats recalculated successfully',
      result,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] Recalculate Stats - Error:', errorMsg);

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
 * GET /api/recalculate-stats
 * 
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Stats recalculation endpoint is running',
    timestamp: new Date().toISOString(),
  });
}
