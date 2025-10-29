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
  return 8000;
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
      previousSummary
    );

    // 5. Call AIML API
    console.log(
      `[AI-Analysis] Calling AIML for agent ${agentModel} (${agentId})`
    );

    // Check if model is Claude (Anthropic models don't support system role in messages)
    const aimlModel = mapAgentModelToAIML(agentModel);
    const isClaudeModel =
      aimlModel.includes("claude") || aimlModel.includes("anthropic");

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
          system:
            systemPrompt +
            "\n\nIMPORTANT: You MUST respond with valid JSON only. No markdown, no code blocks, just pure JSON.",
          temperature: 0.7,
          max_tokens: getAgentMaxToken(agentModel),
        }
      : {
          // Standard format for other models (GPT, Gemini, Grok, DeepSeek)
          model: aimlModel,
          messages: [
            {
              role: "system",
              content:
                systemPrompt +
                "\n\nIMPORTANT: You MUST respond with valid JSON only. No markdown, no code blocks, just pure JSON.",
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
      parsedDecision =
        typeof aiDecision === "string"
          ? JSON.parse(
              aiDecision.startsWith("```json") && aiDecision.endsWith("```")
                ? aiDecision
                    .replace(/```json\s*/g, "")
                    .replace(/```/g, "")
                    .trim()
                : aiDecision
            )
          : aiDecision;
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
  previousSummary?: any
): string {
  let prompt = "";

  // Add previous analysis if available (for context continuity)
  if (previousSummary) {
    prompt += `=== YOUR PREVIOUS ANALYSIS ===\n`;
    prompt += `Time: ${new Date(
      previousSummary.session_timestamp
    ).toLocaleString()}\n\n`;

    if (previousSummary.conclusion) {
      prompt += `Conclusion:\n${previousSummary.conclusion}\n\n`;
    }

    if (
      previousSummary.decisions_made &&
      previousSummary.decisions_made.length > 0
    ) {
      prompt += `Previous Decisions:\n`;
      previousSummary.decisions_made.forEach((decision: any, idx: number) => {
        prompt += `${idx + 1}. ${
          decision.coin
        } - ${decision.signal.toUpperCase()}\n`;
        if (decision.signal === "long" || decision.signal === "short") {
          prompt += `   Entry: $${decision.entry_price}, SL: $${decision.stop_loss}, TP: $${decision.profit_target}\n`;
          prompt += `   Confidence: ${(decision.confidence * 100).toFixed(
            0
          )}%\n`;
        }
        if (decision.justification) {
          prompt += `   Reasoning: ${decision.justification}\n`;
        }
        prompt += `\n`;
      });
    }

    prompt += `\n`;
  }

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

  // Add active positions if any
  if (activePositions.length > 0) {
    prompt += `=== YOUR ACTIVE POSITIONS ===\n\n`;
    activePositions.forEach((pos, idx) => {
      prompt += `Position ${idx + 1}: ${pos.symbol} ${pos.side}\n`;
      prompt += `  Entry: $${pos.entry_price}\n`;
      prompt += `  Size: $${pos.size_usd} (${pos.leverage}x)\n`;
      prompt += `  Stop Loss: $${pos.stop_loss}\n`;
      prompt += `  Take Profit: $${pos.take_profit}\n`;
      prompt += `  Invalidation: ${pos.invalidation_condition}\n`;
      prompt += `  Exit Strategy: ${pos.exit_strategy}\n\n`;
    });
  }

  prompt += `\n=== INSTRUCTIONS ===\n`;

  if (previousSummary) {
    prompt += `═══════════════════════════════════════════════════════════════\n`;
    prompt += `⚠️  CONTINUATION ANALYSIS - ADAPTIVE INTELLIGENCE REQUIRED\n`;
    prompt += `═══════════════════════════════════════════════════════════════\n\n`;

    prompt += `🧠 CONTEXT AWARENESS:\n`;
    prompt += `Your previous analysis is shown above for REFERENCE and CONTINUITY.\n`;
    prompt += `Time has passed. Market has evolved. You must demonstrate LEARNING and ADAPTATION.\n\n`;

    prompt += `═══════════════════════════════════════════════════════════════\n`;
    prompt += `📊 STEP 1: MARKET EVOLUTION ANALYSIS (CRITICAL!)\n`;
    prompt += `═══════════════════════════════════════════════════════════════\n\n`;

    prompt += `Compare PREVIOUS vs CURRENT state:\n\n`;

    prompt += `For EACH coin, calculate and analyze:\n`;
    prompt += `  ✓ Price Movement: (Current Price - Previous Price) / Previous Price × 100%\n`;
    prompt += `  ✓ Prediction Accuracy: Did price move as you expected? (Yes/No + Why)\n`;
    prompt += `  ✓ Technical Validation: Are your previous indicators still valid?\n`;
    prompt += `  ✓ Trend Confirmation: Is the trend intact, reversing, or consolidating?\n`;
    prompt += `  ✓ Key Levels: Were support/resistance levels respected or broken?\n\n`;

    prompt += `Example Analysis Format:\n`;
    prompt += `"BTC: Previously at $67,000, now at $67,500 (+0.75%). My bullish bias was\n`;
    prompt += `CORRECT. RSI moved from 58 to 62 (still healthy). Price respected $66,800\n`;
    prompt += `support as predicted. Trend remains intact."\n\n`;

    prompt += `═══════════════════════════════════════════════════════════════\n`;
    prompt += `🎯 STEP 2: ACTIVE POSITION MANAGEMENT (MANDATORY!)\n`;
    prompt += `═══════════════════════════════════════════════════════════════\n\n`;

    if (activePositions.length > 0) {
      prompt += `⚠️  YOU HAVE ${activePositions.length} ACTIVE POSITION(S) - MANAGE THEM INTELLIGENTLY!\n\n`;

      activePositions.forEach((pos, idx) => {
        prompt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        prompt += `Position ${idx + 1}: ${pos.symbol} ${pos.side}\n`;
        prompt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        prompt += `  Entry Price: $${pos.entry_price}\n`;
        prompt += `  Current Price: [CHECK LATEST ${pos.symbol} PRICE FROM MARKET DATA]\n`;
        prompt += `  Stop Loss: $${pos.stop_loss}\n`;
        prompt += `  Take Profit: $${pos.take_profit}\n`;
        prompt += `  Size: $${pos.size_usd} (${pos.leverage}x leverage)\n`;
        prompt += `  Invalidation Condition: "${pos.invalidation_condition}"\n\n`;

        prompt += `  🔍 REQUIRED ANALYSIS FOR THIS POSITION:\n\n`;

        prompt += `  1. Calculate Current P&L:\n`;
        const side = pos.side.toUpperCase();
        if (side === "LONG") {
          prompt += `     Formula: ((Current Price - Entry Price) / Entry Price) × Size × Leverage\n`;
          prompt += `     Is it profitable? By how much?\n\n`;
        } else {
          prompt += `     Formula: ((Entry Price - Current Price) / Entry Price) × Size × Leverage\n`;
          prompt += `     Is it profitable? By how much?\n\n`;
        }

        prompt += `  2. Check Invalidation Condition:\n`;
        prompt += `     ❓ Is "${pos.invalidation_condition}" triggered?\n`;
        prompt += `     → If YES: Signal = "close" (IMMEDIATELY!)\n`;
        prompt += `     → If NO: Continue to next checks\n\n`;

        prompt += `  3. Evaluate Technical Setup:\n`;
        prompt += `     ❓ Is the original ${side} setup still valid?\n`;
        prompt += `     ❓ Are indicators still supporting this direction?\n`;
        prompt += `     ❓ Has market structure changed significantly?\n\n`;

        prompt += `  4. Risk/Reward Assessment:\n`;
        prompt += `     ❓ Distance to TP: $${pos.take_profit} (how close?)\n`;
        prompt += `     ❓ Distance to SL: $${pos.stop_loss} (how close?)\n`;
        prompt += `     ❓ Is R:R still favorable or deteriorating?\n\n`;

        prompt += `  5. DECISION LOGIC:\n`;
        prompt += `     ✅ Signal = "hold" IF:\n`;
        prompt += `        • Invalidation NOT triggered\n`;
        prompt += `        • Setup still valid (trend intact, indicators confirming)\n`;
        prompt += `        • Price moving toward TP (not SL)\n`;
        prompt += `        • No major structure break\n\n`;

        prompt += `     ❌ Signal = "close" IF:\n`;
        prompt += `        • Invalidation condition triggered\n`;
        prompt += `        • TP reached or very close (take profit!)\n`;
        prompt += `        • Setup invalidated (trend reversed, structure broken)\n`;
        prompt += `        • SL very close and setup weakening\n`;
        prompt += `        • Better opportunity elsewhere (reallocation)\n\n`;
      });

      prompt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    } else {
      prompt += `✅ No active positions - You have full flexibility to open new trades.\n\n`;
    }

    prompt += `═══════════════════════════════════════════════════════════════\n`;
    prompt += `🔬 STEP 3: FRESH TECHNICAL ANALYSIS\n`;
    prompt += `═══════════════════════════════════════════════════════════════\n\n`;

    prompt += `Re-evaluate ALL indicators with CURRENT data:\n\n`;

    prompt += `For EACH coin (BTC, ASTER, GIGGLE, BNB):\n\n`;

    prompt += `  📈 Price Action:\n`;
    prompt += `     • Current price and recent movement\n`;
    prompt += `     • Support/resistance levels (update based on recent action)\n`;
    prompt += `     • Candlestick patterns (if any significant ones)\n\n`;

    prompt += `  📊 Technical Indicators (use CURRENT values!):\n`;
    prompt += `     • RSI: Current value, trend, overbought/oversold?\n`;
    prompt += `     • MACD: Histogram, signal line, bullish/bearish crossover?\n`;
    prompt += `     • Bollinger Bands: Position relative to bands, squeeze/expansion?\n`;
    prompt += `     • Volume: Increasing/decreasing, confirming price action?\n\n`;

    prompt += `  🎯 Multi-Timeframe Confluence:\n`;
    prompt += `     • 5M: Short-term momentum\n`;
    prompt += `     • 15M: Entry timing\n`;
    prompt += `     • 1H: Trend direction\n`;
    prompt += `     • 4H: Major trend confirmation\n`;
    prompt += `     → Do timeframes align or conflict?\n\n`;

    prompt += `═══════════════════════════════════════════════════════════════\n`;
    prompt += `✍️  STEP 4: WRITE INTELLIGENT CONCLUSION\n`;
    prompt += `═══════════════════════════════════════════════════════════════\n\n`;

    prompt += `Your conclusion MUST:\n\n`;

    prompt += `  1. Start with temporal context:\n`;
    prompt += `     "Since my last analysis [X minutes/hours ago]..."\n\n`;

    prompt += `  2. Acknowledge prediction accuracy:\n`;
    prompt += `     "My previous [bullish/bearish] bias on [coin] was [CORRECT/INCORRECT]\n`;
    prompt += `     because [specific reason with data]."\n\n`;

    prompt += `  3. Describe market evolution:\n`;
    prompt += `     "The market has [consolidated/rallied/dumped/reversed]. Key developments:\n`;
    prompt += `     - [Specific price movement with %]\n`;
    prompt += `     - [Technical indicator changes]\n`;
    prompt += `     - [Structure breaks or confirmations]"\n\n`;

    prompt += `  4. Update market outlook:\n`;
    prompt += `     "Looking ahead, I expect [specific prediction] because [reasoning].\n`;
    prompt += `     Key levels to watch: [support/resistance with prices]."\n\n`;

    prompt += `  5. Demonstrate learning:\n`;
    prompt += `     If you were wrong: "I underestimated [factor]. Going forward, I will\n`;
    prompt += `     pay closer attention to [specific indicator/pattern]."\n\n`;

    prompt += `═══════════════════════════════════════════════════════════════\n`;
    prompt += `🎲 STEP 5: INTELLIGENT AND SMART TRADING DECISIONS\n`;
    prompt += `═══════════════════════════════════════════════════════════════\n\n`;

    prompt += `For EACH coin, provide decision using CURRENT prices:\n\n`;

    prompt += `🔹 IF YOU HAVE AN ACTIVE POSITION:\n\n`;

    prompt += `   Signal Options: "hold" or "close"\n\n`;

    prompt += `   Choose "hold" when:\n`;
    prompt += `   ✓ Setup still valid and trending toward TP\n`;
    prompt += `   ✓ No invalidation triggered\n`;
    prompt += `   ✓ Risk/reward still favorable\n\n`;

    prompt += `   Choose "close" when:\n`;
    prompt += `   ✓ Invalidation condition met\n`;
    prompt += `   ✓ TP reached or imminent\n`;
    prompt += `   ✓ Setup broken or reversed\n`;
    prompt += `   ✓ Better opportunity for capital reallocation\n\n`;

    prompt += `   Justification must include:\n`;
    prompt += `   • Current P&L status\n`;
    prompt += `   • Technical setup validity\n`;
    prompt += `   • Specific reason for hold/close\n\n`;

    prompt += `🔹 IF NO ACTIVE POSITION:\n\n`;

    prompt += `   Signal Options: "long", "short", or "wait"\n\n`;

    prompt += `   Entry Criteria (must meet ALL):\n`;
    prompt += `   ✓ Clear trend direction confirmed\n`;
    prompt += `   ✓ Multiple indicators aligned\n`;
    prompt += `   ✓ Good risk/reward ratio (min 1:2)\n`;
    prompt += `   ✓ Sufficient capital available ($${availableCapital.toFixed(
      2
    )})\n`;
    prompt += `   ✓ No conflicting signals across timeframes\n\n`;

    prompt += `   Price Calculation (CRITICAL!):\n`;
    prompt += `   • Entry Price: Use CURRENT market price from latest data\n`;
    prompt += `   • Stop Loss: Calculate from CURRENT price (not old levels)\n`;
    prompt += `   • Take Profit: Set realistic target based on CURRENT structure\n\n`;

    prompt += `   Position Sizing:\n`;
    prompt += `   • Respect available capital: $${availableCapital.toFixed(
      2
    )}\n`;
    prompt += `   • Use appropriate leverage (2x-10x based on confidence)\n`;
    prompt += `   • Higher confidence = higher size (within limits)\n\n`;

    prompt += `   Choose "wait" when:\n`;
    prompt += `   ✓ Conflicting signals\n`;
    prompt += `   ✓ Consolidation/choppy price action\n`;
    prompt += `   ✓ Waiting for breakout/breakdown confirmation\n`;
    prompt += `   ✓ Risk/reward not favorable\n\n`;

    prompt += `═══════════════════════════════════════════════════════════════\n`;
    prompt += `🚫 FORBIDDEN ACTIONS (WILL CAUSE ERRORS!)\n`;
    prompt += `═══════════════════════════════════════════════════════════════\n\n`;

    prompt += `❌ DO NOT copy-paste previous conclusion (must be unique!)\n`;
    prompt += `❌ DO NOT use outdated prices for entry/SL/TP\n`;
    prompt += `❌ DO NOT ignore active positions (you MUST manage them!)\n`;
    prompt += `❌ DO NOT open duplicate positions on same coin\n`;
    prompt += `❌ DO NOT repeat identical reasoning if market changed\n`;
    prompt += `❌ DO NOT ignore invalidation conditions\n`;
    prompt += `❌ DO NOT exceed available capital ($${availableCapital.toFixed(
      2
    )})\n`;
    prompt += `❌ DO NOT make decisions without checking CURRENT data\n`;
    prompt += `❌ DO NOT use generic justifications (be specific!)\n\n`;

    prompt += `═══════════════════════════════════════════════════════════════\n`;
    prompt += `📤 EXPECTED OUTPUT FORMAT\n`;
    prompt += `═══════════════════════════════════════════════════════════════\n\n`;

    prompt += `Your response must include:\n\n`;

    prompt += `✓ UNIQUE conclusion reflecting market evolution (not copy-paste!)\n`;
    prompt += `✓ Specific price movement analysis with percentages\n`;
    prompt += `✓ Prediction accuracy acknowledgment (right/wrong + why)\n`;
    prompt += `✓ UPDATED decisions for ALL 4 coins with CURRENT prices\n`;
    prompt += `✓ Clear HOLD/CLOSE signals for active positions with P&L status\n`;
    prompt += `✓ Fresh LONG/SHORT/WAIT signals for coins without positions\n`;
    prompt += `✓ Specific technical reasoning (not generic statements)\n`;
    prompt += `✓ Proper JSON format as specified in system prompt\n\n`;
  } else {
    prompt += `═══════════════════════════════════════════════════════════════\n`;
    prompt += `🎯 FIRST ANALYSIS - ESTABLISH YOUR BASELINE STRATEGY\n`;
    prompt += `═══════════════════════════════════════════════════════════════\n\n`;

    prompt += `This is your FIRST analysis. You're starting with a clean slate.\n\n`;

    prompt += `📊 ANALYZE THOROUGHLY:\n\n`;

    prompt += `For EACH coin (BTC, ASTER, GIGGLE, BNB):\n\n`;

    prompt += `  1. Price Action Analysis:\n`;
    prompt += `     • Current price and recent trend\n`;
    prompt += `     • Key support/resistance levels\n`;
    prompt += `     • Market structure (higher highs/lows or lower highs/lows)\n\n`;

    prompt += `  2. Technical Indicators:\n`;
    prompt += `     • RSI: Overbought/oversold/neutral?\n`;
    prompt += `     • MACD: Bullish/bearish momentum?\n`;
    prompt += `     • Bollinger Bands: Volatility and position\n`;
    prompt += `     • Volume: Confirming or diverging?\n\n`;

    prompt += `  3. Multi-Timeframe Analysis:\n`;
    prompt += `     • 5M: Entry timing\n`;
    prompt += `     • 15M: Short-term trend\n`;
    prompt += `     • 1H: Medium-term direction\n`;
    prompt += `     • 4H: Major trend\n\n`;

    prompt += `🎲 PROVIDE SMART DECISIONS:\n\n`;

    prompt += `For each coin:\n\n`;

    prompt += `  Signal: "long", "short", or "wait"\n\n`;

    prompt += `  If LONG or SHORT:\n`;
    prompt += `  • Entry Price: CURRENT market price (from latest data)\n`;
    prompt += `  • Stop Loss: Based on technical levels (support/resistance)\n`;
    prompt += `  • Take Profit: Realistic target (1.5x-3x risk)\n`;
    prompt += `  • Size: Respect available capital ($${availableCapital.toFixed(
      2
    )})\n`;
    prompt += `  • Leverage: 2x-10x based on confidence (higher confidence = higher leverage)\n`;
    prompt += `  • Confidence: 0.0-1.0 (be honest about setup quality)\n`;
    prompt += `  • Justification: Specific technical reasons with data\n`;
    prompt += `  • Invalidation: Clear condition that would prove setup wrong\n\n`;

    prompt += `  If WAIT:\n`;
    prompt += `  • Explain what you're waiting for (breakout, pullback, confirmation)\n`;
    prompt += `  • Specify price levels or conditions to watch\n\n`;

    prompt += `📋 CONCLUSION REQUIREMENTS:\n\n`;

    prompt += `  • Overall market sentiment (bullish/bearish/neutral)\n`;
    prompt += `  • Key themes across all coins\n`;
    prompt += `  • Risk factors to monitor\n`;
    prompt += `  • Your strategic approach for this session\n\n`;

    prompt += `Return your complete analysis in the JSON format specified in the system prompt.\n\n`;
  }

  prompt += `Return your analysis in the JSON format specified in the system prompt.\n`;

  return prompt;
}

/**
 * Map agent model name to AIML API model identifier
 */
function mapAgentModelToAIML(agentModel: string): string {
  const modelMap: { [key: string]: string } = {
    grok: "x-ai/grok-4-fast-reasoning",
    deepseek: "deepseek/deepseek-reasoner-v3.1",
    gemini: "google/gemini-2.5-pro",
    openai: "openai/gpt-5-chat-latest",
    claude: "anthropic/claude-sonnet-4.5",
  };

  const normalized = agentModel.toLowerCase().trim();
  return modelMap[normalized] || "gpt-4o"; // default to GPT-4
}
