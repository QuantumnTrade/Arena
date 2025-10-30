import {
  type Agent,
  type AIResponse,
  type AIDecision,
  type Position,
  getSystemPromptV2,
  getSystemPromptV3,
} from "@/types";
import { fetchMarketDataForAI } from "./market-service";
import * as AsterClient from "@/lib/aster-client";

import {
  fetchActivePositions,
  createPosition,
  closePosition,
  createAgentSummary,
  fetchLatestAgentSummary,
  updateAgentStats,
  updateAgentActivePositions,
} from "./supabase-service";
import * as AsterExecution from "./aster-execution-service";

/**
 * AI Trading Service
 *
 * Orchestrates the complete AI trading flow:
 * 1. Fetch market data
 * 2. Call AI analysis API
 * 3. Execute trading decisions
 * 4. Update database
 */

export interface TradingResult {
  success: boolean;
  agentId: string;
  agentModel: string;
  decisionsExecuted: number;
  positionsOpened: number;
  positionsClosed: number;
  errors: string[];
  timestamp: string;
}

/**
 * Execute AI trading analysis for a single agent
 */
export async function executeAITrading(agent: Agent): Promise<TradingResult> {
  const result: TradingResult = {
    success: false,
    agentId: agent.id,
    agentModel: agent.model,
    decisionsExecuted: 0,
    positionsOpened: 0,
    positionsClosed: 0,
    errors: [],
    timestamp: new Date().toISOString(),
  };

  const analysisStartTime = Date.now();

  try {
    console.log(`[QuantumnTrade AI] Starting analysis for ${agent.model}...`);

    // 0. Auto-transfer BNB from Spot to Futures if available
    try {
      const transferResult = await AsterClient.autoTransferBNBToFutures();

      if (transferResult.transferred) {
        console.log(
          `[QuantumnTrade AI] ✅ Auto-transferred ${transferResult.amount} BNB to Futures wallet`
        );
      }
    } catch (error) {
      console.warn(`[QuantumnTrade AI] Auto-transfer check skipped:`, error);
      // Continue even if auto-transfer fails
    }

    // 1. Fetch current market data
    const marketData = await fetchMarketDataForAI();

    console.log(
      `[QuantumnTrade AI] Fetched market data for ${marketData.length} symbols`
    );

    // 2. Fetch active positions
    const activePositions = await fetchActivePositions(agent.id);
    console.log(
      `[QuantumnTrade AI] Agent has ${activePositions.length} active positions`
    );

    // 3. Fetch latest summary for context continuity
    let previousSummary = null;
    try {
      previousSummary = await fetchLatestAgentSummary(agent.id);
      if (previousSummary) {
        console.log(
          `[QuantumnTrade AI] Found previous analysis from ${new Date(previousSummary.session_timestamp).toLocaleString()}`
        );
      }
    } catch (error) {
      console.warn(`[QuantumnTrade AI] Could not fetch previous summary:`, error);
      // Continue without previous context
    }

    // 4. Get system prompt (use default if not set)
    const systemPrompt = agent.systemPrompt || getSystemPromptV3();

    // 5. Call AI analysis API (server-side route)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const aiResponse = await fetch(`${baseUrl}/api/ai-analysis`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        agentId: agent.id,
        agentModel: agent.model,
        systemPrompt,
        marketData,
        activePositions,
        balance: agent.balance || 0, // Default to 0 if null
        availableCapital: agent.available_capital || agent.balance || 0, // Default to 0 if null
        previousSummary, // Include previous analysis for context
      }),
    });

    console.log(`[QuantumnTrade AI] AI response:`, aiResponse);

    if (!aiResponse.ok) {
      const errorData = await aiResponse.json();
      throw new Error(
        `AI API error: ${errorData.error || aiResponse.statusText}`
      );
    }

    const aiData = await aiResponse.json();
    const aiDecision: AIResponse = aiData.decision;

    console.log(
      `[QuantumnTrade AI] Received AI decision:`,
      aiDecision.conclusion
    );

    // 6. Extract decisions
    const decisions = Object.values(aiDecision.decisions).map(
      (d) => d.trade_signal_args
    );

    // 7. Create agent summary FIRST (before trade execution)
    // This ensures summary is always saved even if trades fail
    const analysisEndTime = Date.now();
    const runtimeMinutes = (analysisEndTime - analysisStartTime) / 60000;

    try {
      await createAgentSummary(
        agent.id,
        decisions,
        aiDecision.conclusion,
        1, // invocation count
        runtimeMinutes
      );
      console.log(
        `[QuantumnTrade AI] ✅ Summary saved to database (runtime: ${runtimeMinutes.toFixed(
          2
        )}m)`
      );
    } catch (error) {
      console.error(`[QuantumnTrade AI] ❌ Failed to save summary:`, error);
      result.errors.push("Failed to save summary to database");
    }

    // 8. Process each trading decision (separate from summary)
    // If trades fail, summary is already saved
    for (const decision of decisions) {
      try {
        await processDecision(agent, decision, activePositions);
        result.decisionsExecuted++;

        if (decision.signal === "long" || decision.signal === "short") {
          result.positionsOpened++;
        } else if (decision.signal === "close") {
          result.positionsClosed++;
        }
      } catch (error) {
        const errorMsg = `Failed to process ${decision.coin} ${
          decision.signal
        }: ${error instanceof Error ? error.message : "Unknown error"}`;
        console.error(`[QuantumnTrade AI] ${errorMsg}`);
        result.errors.push(errorMsg);
      }
    }

    // 9. Update active positions count
    try {
      await updateAgentActivePositions(agent.id);
    } catch (error) {
      console.error(
        `[QuantumnTrade AI] Failed to update active positions:`,
        error
      );
    }

    // Success if summary was saved (trades can fail but summary is preserved)
    result.success =
      result.errors.length === 0 ||
      !result.errors.includes("Failed to save summary to database");
    console.log(
      `[QuantumnTrade AI] Completed for ${agent.model}: ${result.positionsOpened} opened, ${result.positionsClosed} closed`
    );

    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error(
      `[QuantumnTrade AI] Fatal error for ${agent.model}:`,
      errorMsg
    );
    result.errors.push(errorMsg);

    // DO NOT save error summary to database
    // Only save summary when AI analysis succeeds
    console.log(
      `[QuantumnTrade AI] ⚠️ Skipping summary save due to analysis error`
    );

    return result;
  }
}

/**
 * Process a single trading decision with REAL ASTER execution
 */
async function processDecision(
  agent: Agent,
  decision: AIDecision,
  activePositions: Position[]
): Promise<void> {
  const symbol = decision.coin;
  const signal = decision.signal;
  const agentId = agent.id;

  // Validate agent has credential_key
  if (!agent.credential_key) {
    throw new Error(`Agent ${agent.model} has no credential_key configured`);
  }

  console.log(`[QuantumnTrade AI] Processing ${signal} for ${symbol} using ${agent.model}`);

  // Check if there's an active position for this symbol
  const existingPosition = activePositions.find((p) => p.symbol === symbol);

  if (signal === "long" || signal === "short") {
    // Open new position with REAL ASTER EXECUTION
    if (existingPosition) {
      console.log(
        `[QuantumnTrade AI] Skipping ${signal} for ${symbol}: position already exists`
      );
      return;
    }

    if (decision.confidence < 0.6) {
      console.log(
        `[QuantumnTrade AI] Skipping ${signal} for ${symbol}: confidence too low (${decision.confidence})`
      );
      return;
    }

    console.log(
      `[QuantumnTrade AI] 🚀 EXECUTING REAL ${signal.toUpperCase()} on ASTER for ${symbol}`
    );

    // Execute on ASTER exchange via secure API route
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/execute-trade`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agent: {
          id: agent.id,
          model: agent.model,
          credential_key: agent.credential_key,
        },
        decision,
        action: signal, // 'long' or 'short'
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to execute trade");
    }

    const executionResult = await response.json();

    if (executionResult.success && executionResult.orderId) {
      console.log(
        `[QuantumnTrade AI] ✅ ASTER order executed successfully! Order ID: ${executionResult.orderId}`
      );

      // Store position in database with ASTER order IDs
      const asterOrderIds = {
        entryOrderId: executionResult.orderId,
        stopLossOrderId: executionResult.asterResponse?.stopLossOrderId,
        takeProfitOrderId: executionResult.asterResponse?.takeProfitOrderId,
      };

      await createPosition(agentId, decision, asterOrderIds);
      console.log(
        `[QuantumnTrade AI] 💾 Position saved to database with order IDs`
      );
    } else {
      console.error(
        `[QuantumnTrade AI] ❌ ASTER execution failed:`,
        executionResult.error
      );
      // DO NOT save position to database if entry order failed (no entry_order_id)
      console.log(
        `[QuantumnTrade AI] ⚠️ Position NOT saved to database - entry order failed`
      );
    }
  } else if (signal === "close") {
    // Close existing position with REAL ASTER EXECUTION
    if (!existingPosition) {
      console.log(
        `[QuantumnTrade AI] Skipping close for ${symbol}: no active position`
      );
      return;
    }

    console.log(
      `[QuantumnTrade AI] 🚀 EXECUTING REAL CLOSE on ASTER for ${symbol}`
    );

    // Execute close on ASTER exchange via secure API route
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/execute-trade`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agent: {
          id: agent.id,
          model: agent.model,
          credential_key: agent.credential_key,
        },
        decision: { coin: symbol },
        action: "close",
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to close position");
    }

    const closeResult = await response.json();

    if (closeResult.success) {
      console.log(`[QuantumnTrade AI] ✅ ASTER position closed successfully!`);

      // Get actual exit price from ASTER response
      // Priority: avgPrice > markPrice > fallback to entry price
      let exitPrice = existingPosition.entry_price; // Default fallback
      
      if (closeResult.asterResponse?.avgPrice) {
        const avgPrice = parseFloat(closeResult.asterResponse.avgPrice);
        if (avgPrice > 0) {
          exitPrice = avgPrice;
          console.log(`[QuantumnTrade AI] Using avgPrice: ${exitPrice}`);
        }
      }
      
      // If avgPrice is 0 or invalid, try markPrice
      if (exitPrice === existingPosition.entry_price && closeResult.asterResponse?.markPrice) {
        const markPrice = parseFloat(closeResult.asterResponse.markPrice);
        if (markPrice > 0) {
          exitPrice = markPrice;
          console.log(`[QuantumnTrade AI] Using markPrice as fallback: ${exitPrice}`);
        }
      }

      // Close position in database (this calculates PnL)
      const closedPosition = await closePosition(existingPosition.id, exitPrice, "AI_DECISION_ASTER");

      // Update agent stats with the closed position (includes calculated PnL)
      await updateAgentStats(agentId, closedPosition);

      console.log(
        `[QuantumnTrade AI] 💾 Position closed in database. Exit: ${exitPrice}, PnL: ${closedPosition.pnl_usd?.toFixed(
          2
        )} USD`
      );
    } else {
      // Handle "No active position found" gracefully
      if (closeResult.error?.includes("No active position")) {
        console.warn(
          `[QuantumnTrade AI] ⚠️ Position already closed for ${symbol}`
        );
        // Still update database if position exists there
        if (existingPosition) {
          const closedPosition = await closePosition(existingPosition.id, decision.entry_price, "ALREADY_CLOSED");
          // Update agent stats even if position was already closed on exchange
          await updateAgentStats(agentId, closedPosition);
        }
      } else {
        console.error(
          `[QuantumnTrade AI] ❌ ASTER close failed:`,
          closeResult.error
        );
      }
    }
  } else if (signal === "hold") {
    // Hold existing position (no action needed)
    console.log(`[QuantumnTrade AI] 📊 Holding position for ${symbol}`);
  } else if (signal === "wait") {
    // Wait (no position, no action)
    console.log(`[QuantumnTrade AI] ⏳ Waiting for ${symbol} setup`);
  }
}

/**
 * Execute AI trading for all active agents IN PARALLEL
 * Each agent completes independently without waiting for others
 * Uses Promise.allSettled for better error handling and individual completion tracking
 */
export async function executeAITradingForAllAgents(
  agents: Agent[]
): Promise<TradingResult[]> {
  console.log(
    `[QuantumnTrade AI] 🚀 Starting TRUE PARALLEL execution for ${agents.length} agents`
  );
  const startTime = Date.now();

  // Filter active agents
  const activeAgents = agents.filter((agent) => {
    if (!agent.is_active) {
      console.log(
        `[QuantumnTrade AI] ⏭️ Skipping inactive agent: ${agent.model}`
      );
      return false;
    }
    return true;
  });

  if (activeAgents.length === 0) {
    console.log(`[QuantumnTrade AI] ⚠️ No active agents found`);
    return [];
  }

  console.log(
    `[QuantumnTrade AI] 🎯 Executing ${activeAgents.length} agents independently`
  );

  // Track completion times for each agent
  const agentStartTimes = new Map<string, number>();

  // Execute all agents with staggered delays to avoid Vercel rate limiting
  // Each agent starts 10-15 seconds after the previous one
  const promises = activeAgents.map(async (agent, index) => {
    // Stagger agent execution: 0s, 12s, 24s, 36s, etc.
    const staggerDelay = index * (10000 + Math.floor(Math.random() * 5000)); // 10-15s between agents
    
    if (staggerDelay > 0) {
      console.log(
        `[QuantumnTrade AI] ⏱️ ${agent.model} will start in ${(staggerDelay / 1000).toFixed(1)}s (staggered to avoid rate limits)`
      );
      await new Promise(resolve => setTimeout(resolve, staggerDelay));
    }
    
    const agentStart = Date.now();
    agentStartTimes.set(agent.id, agentStart);

    try {
      const result = await executeAITrading(agent);
      const agentDuration = ((Date.now() - agentStart) / 1000).toFixed(2);
      console.log(
        `[QuantumnTrade AI] ✅ ${agent.model} completed in ${agentDuration}s (independent)`
      );
      return result;
    } catch (error) {
      const agentDuration = ((Date.now() - agentStart) / 1000).toFixed(2);
      console.error(
        `[QuantumnTrade AI] ❌ ${agent.model} failed after ${agentDuration}s:`,
        error
      );
      return {
        success: false,
        agentId: agent.id,
        agentModel: agent.model,
        decisionsExecuted: 0,
        positionsOpened: 0,
        positionsClosed: 0,
        errors: [error instanceof Error ? error.message : "Unknown error"],
        timestamp: new Date().toISOString(),
      } as TradingResult;
    }
  });

  // Use Promise.allSettled to handle each agent independently
  // This ensures we get results even if some agents fail
  const settledResults = await Promise.allSettled(promises);

  // Extract results from settled promises
  const results: TradingResult[] = settledResults.map((settled, index) => {
    if (settled.status === "fulfilled") {
      return settled.value;
    } else {
      // Handle rejected promises
      const agent = activeAgents[index];
      console.error(
        `[QuantumnTrade AI] ❌ Promise rejected for ${agent.model}:`,
        settled.reason
      );
      return {
        success: false,
        agentId: agent.id,
        agentModel: agent.model,
        decisionsExecuted: 0,
        positionsOpened: 0,
        positionsClosed: 0,
        errors: [
          settled.reason instanceof Error
            ? settled.reason.message
            : "Promise rejected",
        ],
        timestamp: new Date().toISOString(),
      } as TradingResult;
    }
  });

  const endTime = Date.now();
  const totalTime = ((endTime - startTime) / 1000).toFixed(2);
  const successCount = results.filter((r) => r.success).length;
  const failCount = results.length - successCount;

  console.log(
    `[QuantumnTrade AI] ✅ ALL agents completed in ${totalTime}s (longest agent)`
  );
  console.log(
    `[QuantumnTrade AI] 📊 Final Results: ${successCount} success, ${failCount} failed`
  );
  console.log(
    `[QuantumnTrade AI] 🎯 Each agent ran independently without blocking others`
  );

  return results;
}

/**
 * Execute AI trading for all active agents with FIRE-AND-FORGET mode
 * Each agent returns result immediately without waiting for others
 * Results are streamed via callback as each agent completes
 */
export function executeAITradingFireAndForget(
  agents: Agent[],
  onAgentComplete?: (result: TradingResult) => void
): void {
  console.log(
    `[QuantumnTrade AI] 🔥 Starting FIRE-AND-FORGET execution for ${agents.length} agents`
  );
  const startTime = Date.now();

  // Filter active agents
  const activeAgents = agents.filter((agent) => {
    if (!agent.is_active) {
      console.log(
        `[QuantumnTrade AI] ⏭️ Skipping inactive agent: ${agent.model}`
      );
      return false;
    }
    return true;
  });

  if (activeAgents.length === 0) {
    console.log(`[QuantumnTrade AI] ⚠️ No active agents found`);
    return;
  }

  console.log(
    `[QuantumnTrade AI] 🚀 Launching ${activeAgents.length} agents (fire-and-forget)`
  );

  let completedCount = 0;
  let successCount = 0;
  let failCount = 0;

  // Launch each agent independently (no await)
  activeAgents.forEach((agent) => {
    const agentStart = Date.now();

    // Fire and forget - don't await
    executeAITrading(agent)
      .then((result) => {
        const agentDuration = ((Date.now() - agentStart) / 1000).toFixed(2);
        completedCount++;
        if (result.success) successCount++;
        else failCount++;

        console.log(
          `[QuantumnTrade AI] ✅ ${agent.model} completed in ${agentDuration}s [${completedCount}/${activeAgents.length}]`
        );

        // Call callback if provided
        if (onAgentComplete) {
          onAgentComplete(result);
        }

        // Log final summary when all agents complete
        if (completedCount === activeAgents.length) {
          const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
          console.log(
            `[QuantumnTrade AI] 🎉 ALL agents completed in ${totalTime}s (fire-and-forget)`
          );
          console.log(
            `[QuantumnTrade AI] 📊 Final: ${successCount} success, ${failCount} failed`
          );
        }
      })
      .catch((error) => {
        const agentDuration = ((Date.now() - agentStart) / 1000).toFixed(2);
        completedCount++;
        failCount++;

        console.error(
          `[QuantumnTrade AI] ❌ ${agent.model} failed after ${agentDuration}s:`,
          error
        );

        const errorResult: TradingResult = {
          success: false,
          agentId: agent.id,
          agentModel: agent.model,
          decisionsExecuted: 0,
          positionsOpened: 0,
          positionsClosed: 0,
          errors: [error instanceof Error ? error.message : "Unknown error"],
          timestamp: new Date().toISOString(),
        };

        // Call callback if provided
        if (onAgentComplete) {
          onAgentComplete(errorResult);
        }

        // Log final summary when all agents complete
        if (completedCount === activeAgents.length) {
          const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
          console.log(
            `[QuantumnTrade AI] 🎉 ALL agents completed in ${totalTime}s (fire-and-forget)`
          );
          console.log(
            `[QuantumnTrade AI] 📊 Final: ${successCount} success, ${failCount} failed`
          );
        }
      });
  });

  console.log(
    `[QuantumnTrade AI] 🔥 All ${activeAgents.length} agents launched! Results will stream as they complete.`
  );
}
