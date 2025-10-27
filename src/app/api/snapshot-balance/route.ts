/**
 * API Route: Snapshot Agent Balance
 * 
 * This endpoint takes a snapshot of all agents' current balance and stores it
 * in the agent_balance_history table for historical charting.
 * 
 * Security: This is a server-side only endpoint
 */

import { NextResponse } from 'next/server';
import { snapshotAllAgentsBalance } from '@/lib/supabase-service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/snapshot-balance
 * 
 * Takes a snapshot of all agents' current balance
 * Called by Supabase pg_cron or manual trigger
 */
export async function POST(request: Request) {
  try {
    console.log('[API] Snapshot Balance - Starting...');

    // Authentication: Support Supabase pg_cron, Vercel Cron, and manual triggers
    const authHeader = request.headers.get('authorization');
    const cronSecret = request.headers.get('x-vercel-cron-secret');
    const expectedToken = process.env.SNAPSHOT_BALANCE_SECRET_TOKEN;
    const expectedCronSecret = process.env.CRON_SECRET;
    
    const isVercelCron = cronSecret && cronSecret === expectedCronSecret;
    const isAuthorized = authHeader === `Bearer ${expectedToken}`;
    
    if (!isVercelCron && !isAuthorized) {
      console.warn('[API] Snapshot Balance - Unauthorized access attempt');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const source = isVercelCron ? 'Vercel Cron' : (authHeader ? 'Supabase pg_cron' : 'Manual Trigger');
    console.log(`[API] Snapshot Balance - Triggered by: ${source}`);

    // Take snapshot of all agents' balance
    const result = await snapshotAllAgentsBalance();

    console.log('[API] Snapshot Balance - Completed:', result);

    return NextResponse.json({
      success: true,
      message: 'Balance snapshots saved successfully',
      result,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] Snapshot Balance - Error:', errorMsg);

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
 * GET /api/snapshot-balance
 * 
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Balance snapshot endpoint is running',
    timestamp: new Date().toISOString(),
  });
}
