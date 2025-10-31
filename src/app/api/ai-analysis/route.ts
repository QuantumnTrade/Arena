import { NextRequest, NextResponse } from "next/server";

/**
 * Secure API Route for AIML Analysis
 *
 * This route handles AI market analysis requests server-side to:
 * 1. Keep API keys secure (never exposed to client)
 * 2. Validate requests
 * 3. Handle errors gracefully
 *
 * Best Practices:
 * - API key stored in server-side env variable
 * - No CORS issues
 * - Centralized error handling
 */

const AIML_API_KEY = process.env.NEXT_PUBLIC_AIML_KEY;
const AIML_API_URL =
  process.env.NEXT_PUBLIC_AIML_API_URL ||
  "https://api.aimlapi.com/v1/chat/completions";

function getAgentMaxToken(model: string): number {
  const modelLower = model.toLowerCase();

  if (modelLower.includes("gpt") || modelLower.includes("openai")) {
    return 12800;
  }

  if (
    modelLower.includes("claude") ||
    modelLower.includes("anthropic") ||
    modelLower.includes("sonnet")
  ) {
    return 64000;
  }
  if (modelLower.includes("gemini")) {
    return 850000;
  }
  if (modelLower.includes("grok") || modelLower.includes("xai")) {
    return 64000;
  }
  if (modelLower.includes("deepseek")) {
    return 8000;
  }

  // Default fallback
  return 12000;
}

interface AIMLRequest {
  agentId: string;
  agentModel: string;
  systemPrompt: string;
  marketData: {
    symbol: string;
    price: number;
    indicators?: any;
    timeframes?: any;
  }[];
  activePositions?: any[];
  balance: number;
  availableCapital: number;
  previousSummary?: any; // Previous analysis for context continuity
  // Agent performance metrics
  roi?: number;
  winRate?: number;
  totalTrades?: number;
}

export async function POST(request: NextRequest) {
  try {
    // 1. Validate API key exists
    if (!AIML_API_KEY) {
      console.error("[AI-Analysis] Missing AIML_API_KEY");
      return NextResponse.json(
        { error: "Server configuration error: Missing API key" },
        { status: 500 }
      );
    }

    // 2. Parse request body
    const body: AIMLRequest = await request.json();
    const {
      agentId,
      agentModel,
      systemPrompt,
      marketData,
      activePositions,
      balance,
      availableCapital,
      previousSummary,
      roi,
      winRate,
      totalTrades,
    } = body;

    // 3. Validate required fields
    if (
      !agentId ||
      !agentModel ||
      !systemPrompt ||
      !marketData ||
      marketData.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: agentId, agentModel, systemPrompt, marketData",
        },
        { status: 400 }
      );
    }

    // DEBUG: Log market data received
    console.log(
      `[AI-Analysis] Market data received:`,
      marketData.map((m) => ({
        symbol: m.symbol,
        price: m.price,
        hasIntervals: !!(m as any).intervals,
        intervalKeys: (m as any).intervals
          ? Object.keys((m as any).intervals)
          : [],
      }))
    );

    // 4. Build user prompt with market context
    const userPrompt = buildUserPrompt(
      marketData,
      activePositions,
      balance,
      availableCapital,
      previousSummary,
      roi,
      winRate,
      totalTrades
    );

    // 5. Call AIML API
    console.log(
      `[AI-Analysis] Calling AIML for agent ${agentModel} (${agentId})`
    );

    // Check if model is Claude (Anthropic models don't support system role in messages)
    const aimlModel = mapAgentModelToAIML(agentModel);
    const isClaudeModel =
      aimlModel.includes("claude") || aimlModel.includes("anthropic");

    const isDeepSeekModel = aimlModel.includes("deepseek");

    const systemPromptWithInstructions = isDeepSeekModel
      ? systemPrompt +
        "\n\nIMPORTANT: You MUST respond with valid JSON only. No markdown, no code blocks, just pure JSON." +
        "\n\nFor DeepSeek Reasoner: Keep your reasoning process CONCISE. Focus on key insights only. Avoid lengthy explanations."
      : systemPrompt +
        "\n\nIMPORTANT: You MUST respond with valid JSON only. No markdown, no code blocks, just pure JSON.";

    const requestBody = isClaudeModel
      ? {
          // Claude format: Only 'user' and 'assistant' roles supported
          // System prompt must be combined with user message
          model: aimlModel,
          messages: [
            {
              role: "user",
              content: userPrompt,
            },
          ],
          system: systemPromptWithInstructions,
          temperature: 0.7,
          max_tokens: getAgentMaxToken(agentModel),
        }
      : {
          // Standard format for other models (GPT, Gemini, Grok, DeepSeek)
          model: aimlModel,
          messages: [
            {
              role: "system",
              content: systemPromptWithInstructions,
            },
            {
              role: "user",
              content: userPrompt,
            },
          ],
          temperature: 0.7,
          max_tokens: getAgentMaxToken(agentModel),
        };

    console.log(
      `[AI-Analysis] Request body:`,
      JSON.stringify(requestBody, null, 2)
    );

    const aimlResponse = await fetch(AIML_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AIML_API_KEY}`,
      },
      body: JSON.stringify(requestBody),
    });

    // 6. Handle AIML API errors
    if (!aimlResponse.ok) {
      const errorText = await aimlResponse.text();
      console.error(
        "[AI-Analysis] AIML API error:",
        aimlResponse.status,
        errorText
      );
      return NextResponse.json(
        { error: `AIML API error: ${aimlResponse.status}`, details: errorText },
        { status: aimlResponse.status }
      );
    }

    // 7. Parse AIML response
    const aimlData = await aimlResponse.json();
    const aiDecision = aimlData.choices?.[0]?.message?.content;

    if (!aiDecision) {
      console.error("[AI-Analysis] No content in AIML response:", aimlData);
      return NextResponse.json(
        { error: "No decision from AI" },
        { status: 500 }
      );
    }

    // 8. Parse JSON response from AI
    let parsedDecision;
    try {
      let cleanedDecision = typeof aiDecision === "string" ? aiDecision : JSON.stringify(aiDecision);
      
      // Remove DeepSeek's thinking tags (e.g., </think>, <think>, etc.)
      cleanedDecision = cleanedDecision.replace(/<\/?think>/g, "");
      
      // Remove markdown code blocks
      if (cleanedDecision.includes("```json") || cleanedDecision.includes("```")) {
        cleanedDecision = cleanedDecision
          .replace(/```json\s*/g, "")
          .replace(/```\s*/g, "")
          .trim();
      }
      
      // Trim whitespace and newlines
      cleanedDecision = cleanedDecision.trim();
      
      // Find JSON object boundaries if there's extra text
      const jsonStart = cleanedDecision.indexOf('{');
      const jsonEnd = cleanedDecision.lastIndexOf('}');
      
      if (jsonStart !== -1 && jsonEnd !== -1 && jsonStart < jsonEnd) {
        cleanedDecision = cleanedDecision.substring(jsonStart, jsonEnd + 1);
      }
      
      parsedDecision = JSON.parse(cleanedDecision);
    } catch (parseError) {
      console.error("[AI-Analysis] Failed to parse AI response:", aiDecision);
      return NextResponse.json(
        { error: "Invalid JSON from AI", raw: aiDecision },
        { status: 500 }
      );
    }

    // 9. Return successful response
    console.log(`[AI-Analysis] Success for agent ${agentModel}`);
    return NextResponse.json({
      success: true,
      agentId,
      agentModel,
      decision: parsedDecision,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[AI-Analysis] Unexpected error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * Build user prompt with current market data and positions
 */
function buildUserPrompt(
  marketData: AIMLRequest["marketData"],
  activePositions: any[] = [],
  balance: number,
  availableCapital: number,
  previousSummary?: any,
  roi?: number,
  winRate?: number,
  totalTrades?: number
): string {
  let prompt = "";

  // Add previous analysis if available (for context continuity)
  // if (previousSummary) {
  //   prompt += `=== YOUR PREVIOUS ANALYSIS ===\n`;
  //   prompt += `Time: ${new Date(
  //     previousSummary.session_timestamp
  //   ).toLocaleString()}\n\n`;

  //   if (previousSummary.conclusion) {
  //     prompt += `Conclusion:\n${previousSummary.conclusion}\n\n`;
  //   }

  //   if (
  //     previousSummary.decisions_made &&
  //     previousSummary.decisions_made.length > 0
  //   ) {
  //     prompt += `Previous Decisions:\n`;
  //     previousSummary.decisions_made.forEach((decision: any, idx: number) => {
  //       prompt += `${idx + 1}. ${
  //         decision.coin
  //       } - ${decision.signal.toUpperCase()}\n`;
  //       if (decision.signal === "long" || decision.signal === "short") {
  //         prompt += `   Entry: $${decision.entry_price}, SL: $${decision.stop_loss}, TP: $${decision.profit_target}\n`;
  //         prompt += `   Confidence: ${(decision.confidence * 100).toFixed(
  //           0
  //         )}%\n`;
  //       }
  //       if (decision.justification) {
  //         prompt += `   Reasoning: ${decision.justification}\n`;
  //       }
  //       prompt += `\n`;
  //     });
  //   }

  //   prompt += `\n`;
  // }]

  const marketPrice = marketData.reduce((acc, market) => {
    acc[market.symbol] = market.price;
    return acc;
  }, {} as Record<string, number>);

  prompt += `=== CURRENT MARKET DATA ===\n\n`;

  // Add market data for each symbol
  marketData.forEach((market) => {
    // DEBUG: Log what we're processing
    console.log(`[buildUserPrompt] Processing ${market.symbol}:`, {
      price: market.price,
      hasIntervals: !!(market as any).intervals,
      hasTimeframes: !!(market as any).timeframes,
      intervalKeys: (market as any).intervals
        ? Object.keys((market as any).intervals)
        : [],
      rawMarket: JSON.stringify(market).substring(0, 200),
    });

    prompt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    prompt += `${market.symbol} - Current Price: $${market.price.toFixed(2)}\n`;
    prompt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    // Check for intervals (actual field from API)
    const intervals = (market as any).intervals || market.timeframes;

    if (intervals) {
      // Define timeframe order for consistent display
      const timeframeOrder = ["1m", "5m", "15m", "1h", "4h"];

      timeframeOrder.forEach((tf) => {
        const tfData = intervals[tf];
        if (tfData) {
          prompt += `📊 ${tf.toUpperCase()} Timeframe:\n`;
          prompt += `   Price: $${
            tfData.price?.toFixed(2) || market.price.toFixed(2)
          }\n`;
          prompt += `   RSI: ${tfData.rsi?.toFixed(2)} (${tfData.rsi_state})\n`;
          prompt += `   MACD: ${tfData.macd?.toFixed(2)} (${
            tfData.macd_state
          })\n`;
          prompt += `   EMA: $${tfData.ema?.toFixed(
            2
          )}, SMA: $${tfData.sma?.toFixed(2)} (${tfData.ema_cross})\n`;
          prompt += `   Volume: ${tfData.volume?.toFixed(0)} (${
            tfData.volume_state
          })\n`;
          prompt += `   Bollinger: Upper=$${tfData.bollinger_upper?.toFixed(
            2
          )}, Mid=$${tfData.bollinger_middle?.toFixed(
            2
          )}, Lower=$${tfData.bollinger_lower?.toFixed(2)} (${
            tfData.bollinger_position
          })\n`;
          prompt += `   Support: $${tfData.support?.toFixed(
            2
          )}, Resistance: $${tfData.resistance?.toFixed(2)}\n`;
          prompt += `   Stochastic K/D: ${tfData.stochastic_k?.toFixed(
            2
          )}/${tfData.stochastic_d?.toFixed(2)} (${tfData.stochastic_state})\n`;
          prompt += `   ATR: ${tfData.atr?.toFixed(
            2
          )}, AO: ${tfData.ao?.toFixed(2)} (${tfData.ao_state})\n`;
          prompt += `   OBV: ${tfData.obv?.toFixed(0)} (${tfData.obv_state})\n`;

          // Add price history for trend analysis
          if (tfData.mid_prices && tfData.mid_prices.length > 0) {
            const prices = tfData.mid_prices.slice(-5); // Last 5 prices
            prompt += `   Recent Prices: ${prices
              .map((p: number) => "$" + p.toFixed(2))
              .join(" → ")}\n`;
          }

          prompt += `\n`;
        }
      });
    } else if (market.indicators) {
      // Fallback to old indicators format if intervals not available
      prompt += `Indicators:\n`;
      Object.entries(market.indicators).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          prompt += `  - ${key}: ${value}\n`;
        }
      });
      prompt += `\n`;
    }

    prompt += `\n`;
  });

  // Add account info
  prompt += `=== YOUR ACCOUNT INFO ===\n`;
  prompt += `Total Balance: $${balance.toFixed(2)}\n`;
  prompt += `Available Capital: $${availableCapital.toFixed(2)}\n`;
  prompt += `Active Positions: ${activePositions.length}\n\n`;

  // Add performance metrics if available
  if (roi !== undefined || winRate !== undefined || totalTrades !== undefined) {
    prompt += `=== YOUR PERFORMANCE METRICS ===\n`;
    if (totalTrades !== undefined) {
      prompt += `Total Trades: ${totalTrades}\n`;
    }
    if (winRate !== undefined) {
      prompt += `Win Rate: ${winRate.toFixed(2)}%\n`;
    }
    if (roi !== undefined) {
      prompt += `ROI: ${roi >= 0 ? '+' : ''}${roi.toFixed(2)}%\n`;
    }
    prompt += `\n`;
  }

  // Add active positions if any
  if (activePositions.length > 0) {
    prompt += `=== YOUR ACTIVE POSITIONS ===\n\n`;
    activePositions.forEach((pos, idx) => {
      const currentPrice = marketPrice[pos.symbol];
      const entryPrice = pos.entry_price;
      const takeProfit = pos.take_profit;
      const stopLoss = pos.stop_loss;
      
      let holdDuration = "";
      const exitStrategy = pos.exit_strategy;

      if(exitStrategy) {
        const cleanExitStrategy = exitStrategy.replace("Duration:", "").trim();
        holdDuration = cleanExitStrategy.split(",")[0];

        if(holdDuration){
          if(holdDuration.endsWith("s")){
            holdDuration = holdDuration.replaceAll("s", " seconds");
          }else if(holdDuration.endsWith("m")){
            holdDuration = holdDuration.replaceAll("m", " minutes");
          }else if(holdDuration.endsWith("min")){
            holdDuration = holdDuration.replaceAll("m", " minutes");
          }else if(holdDuration.endsWith("h")){
            holdDuration = holdDuration.replaceAll("h", " hours");
          }else if(holdDuration.endsWith("d")){
            holdDuration = holdDuration.replaceAll("d", " days");
          }
        }
      }

      // Calculate PnL to make entry vs current distinction crystal clear
      const pnlPercent =
        pos.side === "LONG"
          ? ((currentPrice - entryPrice) / entryPrice) * 100
          : ((entryPrice - currentPrice) / entryPrice) * 100;
      const pnlUsd = (pos.size_usd * pnlPercent) / 100;
      const pnlSign = pnlPercent >= 0 ? "+" : "";

      // Check if TP or SL has been hit
      let tpHit = false;
      let slHit = false;

      if (pos.side === "LONG") {
        tpHit = currentPrice >= takeProfit;
        slHit = currentPrice <= stopLoss;
      } else {
        // SHORT
        tpHit = currentPrice <= takeProfit;
        slHit = currentPrice >= stopLoss;
      }

      prompt += `========================================\n`;
      prompt += `ACTIVE POSITION ${idx + 1}: ${pos.symbol} ${pos.side}\n`;
      prompt += `========================================\n`;
      prompt += `  ENTRY PRICE (when opened): $${entryPrice.toFixed(2)}\n`;
      prompt += `  CURRENT MARKET PRICE (now): $${currentPrice.toFixed(2)}\n`;
      prompt += `  Unrealized PnL: ${pnlSign}$${pnlUsd.toFixed(
        2
      )} (${pnlSign}${pnlPercent.toFixed(2)}%)\n`;
      prompt += `  Position Size: $${pos.size_usd.toFixed(2)} (${
        pos.leverage
      }x leverage)\n`;
      prompt += `  Stop Loss/SL: $${stopLoss.toFixed(2)}${
        slHit ? " [SL HIT]" : ""
      }\n`;
      prompt += `  Take Profit/TP: $${takeProfit.toFixed(2)}${
        tpHit ? " [TP HIT]" : ""
      }\n`;
      prompt += `  Invalidation Condition: ${pos.invalidation_condition}\n`;
      prompt += `  Exit Strategy: ${pos.exit_strategy}\n`;
      
      if(holdDuration) {
        prompt += `  Hold Duration: ${holdDuration}\n`;
      }

      // Add informational note if TP or SL hit
      if (tpHit || slHit) {
        prompt += `\n  NOTE:\n`;
        if (tpHit) {
          prompt += `  - Take Profit level reached: Current $${currentPrice.toFixed(
            2
          )} >= TP $${takeProfit.toFixed(2)}\n`;
        }
        if (slHit) {
          prompt += `  - Stop Loss level reached: Current $${currentPrice.toFixed(
            2
          )} ${pos.side === "LONG" ? "<=" : ">="} SL $${stopLoss.toFixed(2)}\n`;
        }
        prompt += `  - Consider whether to close this position or continue holding based on current market conditions.\n`;
      }

      prompt += `\n`;
    });
  }

  prompt += `\n=== INSTRUCTIONS ===\n`;
  prompt += `Analyze the current market data and provide trading decisions for BTC, ETH, SOL, BNB, ASTER and GIGGLE.\n`;
  prompt += `\n`;
  prompt += `IMPORTANT - DIRECTIONAL BALANCE:\n`;
  prompt += `- Actively look for BOTH bullish (LONG) and bearish (SHORT) setups with equal consideration\n`;
  prompt += `- Do NOT favor LONG over SHORT or vice versa - trade what the market structure shows\n`;
  prompt += `- Bearish divergence, resistance rejections, and premium zones are as valid as bullish setups\n`;
  prompt += `- If you find yourself only seeing LONG setups, deliberately check for SHORT opportunities\n`;
  prompt += `- Quality SHORT setups should be executed with the same confidence as LONG setups\n`;
  prompt += `\n`;
  prompt += `CRITICAL RULES FOR ACTIVE POSITIONS:\n`;
  prompt += `\n`;
  prompt += `A. ENTRY PRICE RULES (for HOLD decisions):\n`;
  prompt += `1. When deciding to HOLD an existing position, you MUST use the ENTRY PRICE shown above, NOT the current market price.\n`;
  prompt += `2. The "ENTRY PRICE (when opened)" is the price at which you originally entered the position.\n`;
  prompt += `3. The "CURRENT MARKET PRICE (now)" is the current market price for reference only.\n`;
  prompt += `4. For HOLD decisions, your entry_price in the JSON response MUST match the "ENTRY PRICE (when opened)" exactly.\n`;
  prompt += `5. Example: If position shows "ENTRY PRICE (when opened): $192.76", your HOLD decision must use entry_price: 192.76\n`;
  prompt += `6. DO NOT use the current market price as the entry price for HOLD decisions!\n`;
  prompt += `\n`;
  prompt += `B. TAKE PROFIT & STOP LOSS AWARENESS:\n`;
  prompt += `7. Pay attention to [TP HIT] and [SL HIT] indicators shown next to TP/SL values.\n`;
  prompt += `8. When you see these indicators:\n`;
  prompt += `   - [TP HIT]: The take profit level has been reached - consider closing to secure profits\n`;
  prompt += `   - [SL HIT]: The stop loss level has been reached - consider closing to limit losses\n`;
  prompt += `9. You can still decide to HOLD if market conditions suggest continuation is favorable.\n`;
  prompt += `10. When deciding to HOLD despite TP/SL hit, provide clear reasoning in your analysis.\n`;
  prompt += `\n`;
  prompt += `C. EXAMPLES:\n`;
  prompt += `Example 1 - TP Hit (LONG):\n`;
  prompt += `  Entry: $3908.57, Current: $3932.30, TP: $3921.30 [TP HIT]\n`;
  prompt += `  → TP reached, consider CLOSE to secure profit OR HOLD if bullish continuation expected\n`;
  prompt += `\n`;
  prompt += `Example 2 - SL Hit (LONG):\n`;
  prompt += `  Entry: $192.76, Current: $191.20, SL: $191.25 [SL HIT]\n`;
  prompt += `  → SL reached, consider CLOSE to limit loss OR HOLD if reversal expected\n`;
  prompt += `\n`;
  prompt += `Example 3 - Normal HOLD (LONG):\n`;
  prompt += `  Entry: $192.76, Current: $193.50, TP: $194.76, SL: $191.25\n`;
  prompt += `  → Price within range, can HOLD with entry_price: 192.76\n`;
  prompt += `\n`;
  prompt += `Return your analysis in the JSON format specified in the system prompt.\n`;

  return prompt;
}

/**
 * Map agent model name to AIML API model identifier
 */
function mapAgentModelToAIML(agentModel: string): string {
  const modelMap: { [key: string]: string } = {
    grok: "x-ai/grok-4-fast-reasoning",
    deepseek: "deepseek/deepseek-r1",
    gemini: "google/gemini-2.5-pro",
    openai: "openai/gpt-5-chat-latest",
    claude: "anthropic/claude-sonnet-4.5",
  };

  const normalized = agentModel.toLowerCase().trim();
  return modelMap[normalized] || "gpt-4o"; // default to GPT-4
}
