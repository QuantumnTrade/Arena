/**
 * API Route: AI Analysis Job Control
 * 
 * This endpoint controls the AI analysis background job.
 * It allows starting, stopping, checking status, and getting last results.
 * 
 * Security: This is a server-side only endpoint
 */

import { NextResponse } from 'next/server';
import {
  startAIAnalysisJob,
  stopAIAnalysisJob,
  isAIAnalysisJobRunning,
  isCurrentlyAnalyzing,
  getLastAnalysisInfo,
  triggerAnalysisNow,
} from '@/services/ai-analysis-job';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/ai-analysis-job
 * 
 * Control the AI analysis job
 * Body: { action: 'start' | 'stop' | 'trigger' }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;

    if (!action || !['start', 'stop', 'trigger'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "start", "stop", or "trigger"' },
        { status: 400 }
      );
    }

    if (action === 'start') {
      startAIAnalysisJob();
      return NextResponse.json({
        success: true,
        message: 'AI analysis job started',
        isRunning: isAIAnalysisJobRunning(),
        isAnalyzing: isCurrentlyAnalyzing(),
      });
    }

    if (action === 'stop') {
      stopAIAnalysisJob();
      return NextResponse.json({
        success: true,
        message: 'AI analysis job stopped',
        isRunning: isAIAnalysisJobRunning(),
      });
    }

    if (action === 'trigger') {
      // Trigger analysis immediately
      await triggerAnalysisNow();
      return NextResponse.json({
        success: true,
        message: 'AI analysis triggered manually',
        ...getLastAnalysisInfo(),
      });
    }

    return NextResponse.json(
      { error: 'Unknown action' },
      { status: 400 }
    );
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API] AI Analysis Job Control - Error:', errorMsg);

    return NextResponse.json(
      { error: errorMsg },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ai-analysis-job
 * 
 * Get the status of the AI analysis job
 */
export async function GET() {
  const info = getLastAnalysisInfo();
  
  return NextResponse.json({
    isRunning: isAIAnalysisJobRunning(),
    isAnalyzing: isCurrentlyAnalyzing(),
    interval: '2.5 minutes (150 seconds)',
    lastAnalysisTime: info.lastAnalysisTime?.toISOString() || null,
    lastAnalysisResults: info.lastAnalysisResults,
    timestamp: new Date().toISOString(),
  });
}
