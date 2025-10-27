/**
 * Next.js Instrumentation
 * 
 * ⚠️ IMPORTANT: This file is DISABLED for production (Vercel) deployments.
 * 
 * WHY DISABLED:
 * - Vercel uses serverless functions with multiple instances
 * - Each instance runs instrumentation.ts independently
 * - This causes MULTIPLE background jobs running simultaneously
 * - Result: Duplicate API calls, wasted resources, rate limit issues
 * 
 * SOLUTION:
 * - Use Vercel Cron Jobs for scheduled tasks (vercel.json)
 * - Cron jobs run ONCE per schedule, not per instance
 * - For local development, manually start jobs via API endpoints
 * 
 * Documentation: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Only run on server-side (Node.js runtime)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // DISABLE background jobs - Using Supabase pg_cron instead
    // Supabase pg_cron handles all scheduled tasks (both local and production)
    console.log('[Instrumentation] ⚠️ Background jobs DISABLED - Using Supabase pg_cron');
    console.log('[Instrumentation] ℹ️ Cron jobs managed by Supabase (see SUPABASE_CRON_SETUP.md)');
    return;

    // OLD CODE - Disabled because we use Supabase pg_cron now
    // // DISABLE background jobs in production (Vercel)
    // // Use Vercel Cron Jobs instead
    // if (process.env.VERCEL === '1' || process.env.NODE_ENV === 'production') {
    //   console.log('[Instrumentation] ⚠️ Running on Vercel/Production - Background jobs DISABLED');
    //   console.log('[Instrumentation] ℹ️ Use Vercel Cron Jobs for scheduled tasks');
    //   return;
    // }
    //
    // // Only run background jobs in local development
    // console.log('[Instrumentation] Initializing server-side services (LOCAL DEV ONLY)...');
    //
    // // Import and start the stats recalculation job
    // const { startStatsRecalculationJob } = await import(
    //   '@/services/stats-recalculation-job'
    // );
    //
    // // Import and start the AI analysis job
    // const { startAIAnalysisJob } = await import(
    //   '@/services/ai-analysis-job'
    // );
    //
    // // Start the background jobs
    // startStatsRecalculationJob();
    // startAIAnalysisJob();
    //
    // console.log('[Instrumentation] ✅ Server-side services initialized (LOCAL DEV)');
    // console.log('[Instrumentation] - Stats Recalculation Job: Running (every 10s)');
    // console.log('[Instrumentation] - AI Analysis Job: Running (every 2.5min)');
  }
}
