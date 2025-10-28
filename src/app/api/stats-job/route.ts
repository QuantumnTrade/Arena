/**
 * API Route: Stats Job Control
 * 
 * This endpoint controls the stats recalculation background job.
 * It allows starting, stopping, and checking the status of the job.
 * 
 * Security: This is a server-side only endpoint
 */

import { NextResponse } from 'next/server';
import {
  startStatsRecalculationJob,
  stopStatsRecalculationJob,
  isStatsJobRunning,
} from '@/services/stats-recalculation-job';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/stats-job
 * 
 * Control the stats recalculation job
 * Body: { action: 'start' | 'stop' }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;

    if (!action || !['start', 'stop'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "start" or "stop"' },
        { status: 400 }
      );
    }

    if (action === 'start') {
      startStatsRecalculationJob();
      return NextResponse.json({
        success: true,
        message: 'Stats recalculation job started',
        isRunning: isStatsJobRunning(),
      });
    }

    if (action === 'stop') {
      stopStatsRecalculationJob();
      return NextResponse.json({
        success: true,
        message: 'Stats recalculation job stopped',
        isRunning: isStatsJobRunning(),
      });
    }

    return NextResponse.json(
      { error: 'Unknown action' },
      { status: 400 }
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] Stats Job Control - Error:', errorMsg);

    return NextResponse.json(
      { error: errorMsg },
      { status: 500 }
    );
  }
}

/**
 * GET /api/stats-job
 * 
 * Get the status of the stats recalculation job
 */
export async function GET() {
  return NextResponse.json({
    isRunning: isStatsJobRunning(),
    interval: '10 seconds',
    timestamp: new Date().toISOString(),
  });
}
