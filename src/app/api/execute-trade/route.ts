import { NextRequest, NextResponse } from "next/server";
import { getAgentCredentials } from "@/lib/aster-credentials";
import * as AsterExecution from "@/lib/aster-execution-service";
import { fetchGateioPrice } from "@/lib/exchange-data";
import type { AIDecision } from "@/types";

/**
 * Secure API Route for Trade Execution
 * 
 * This route handles ASTER trade execution server-side to:
 * 1. Keep API keys secure (never exposed to client)
 * 2. Access environment variables safely
 * 3. Execute trades with proper credentials
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agent, decision, action } = body;

    // Validate request
    if (!agent?.credential_key) {
      return NextResponse.json(
        { success: false, error: "Agent credential_key is required" },
        { status: 400 }
      );
    }

    if (!decision) {
      return NextResponse.json(
        { success: false, error: "Decision is required" },
        { status: 400 }
      );
    }

    if (!action || !["long", "short", "close"].includes(action)) {
      return NextResponse.json(
        { success: false, error: "Invalid action. Must be: long, short, or close" },
        { status: 400 }
      );
    }

    console.log(`[Execute Trade API] ${agent.model} - ${action.toUpperCase()} ${decision.coin}`);

    // Get agent credentials (server-side only - SECURE!)
    const credentials = getAgentCredentials(agent.credential_key);

    // Fetch REAL-TIME accurate price from Gate.io before executing
    let updatedDecision = decision as AIDecision;
    
    if (action === "long" || action === "short") {
      try {
        const realTimePrice = await fetchGateioPrice(decision.coin);
        
        if (realTimePrice > 0) {
          console.log(`[Execute Trade API] Price update for ${decision.coin}:`, {
            aiSuggestedPrice: decision.entry_price,
            realTimePrice,
            difference: ((realTimePrice - decision.entry_price) / decision.entry_price * 100).toFixed(2) + '%'
          });
          
          // Update decision with accurate real-time price
          updatedDecision = {
            ...decision,
            entry_price: realTimePrice,
          };
        } else {
          console.warn(`[Execute Trade API] Failed to fetch real-time price for ${decision.coin}, using AI suggested price`);
        }
      } catch (error) {
        console.error(`[Execute Trade API] Error fetching real-time price:`, error);
        // Continue with AI suggested price if fetch fails
      }
    }

    // Execute trade based on action
    let result;
    
    if (action === "long") {
      result = await AsterExecution.executeLong(updatedDecision, credentials);
    } else if (action === "short") {
      result = await AsterExecution.executeShort(updatedDecision, credentials);
    } else if (action === "close") {
      result = await AsterExecution.executeClose(decision.coin, credentials);
    }

    console.log(`[Execute Trade API] Result:`, result);

    return NextResponse.json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[Execute Trade API] Error:", errorMessage);
    
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}