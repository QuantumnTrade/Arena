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
    return 150000;
  }
  if (modelLower.includes("gemini")) {
    return 850000;
  }
  if (modelLower.includes("grok") || modelLower.includes("xai")) {
    return 100000;
  }
  if (modelLower.includes("deepseek")) {
    return 8000;
  }

  // Default fallback
  return 5000;
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

    const requestBody = {
      model: mapAgentModelToAIML(agentModel),
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
                ? aiDecision.replace(/```json\s*/g, "").replace(/```/g, "").trim()
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
  let prompt = '';

  // Add previous analysis if available (for context continuity)
  if (previousSummary) {
    prompt += `=== YOUR PREVIOUS ANALYSIS ===\n`;
    prompt += `Time: ${new Date(previousSummary.session_timestamp).toLocaleString()}\n\n`;
    
    if (previousSummary.conclusion) {
      prompt += `Conclusion:\n${previousSummary.conclusion}\n\n`;
    }
    
    if (previousSummary.decisions_made && previousSummary.decisions_made.length > 0) {
      prompt += `Previous Decisions:\n`;
      previousSummary.decisions_made.forEach((decision: any, idx: number) => {
        prompt += `${idx + 1}. ${decision.coin} - ${decision.signal.toUpperCase()}\n`;
        if (decision.signal === 'long' || decision.signal === 'short') {
          prompt += `   Entry: $${decision.entry_price}, SL: $${decision.stop_loss}, TP: $${decision.profit_target}\n`;
          prompt += `   Confidence: ${(decision.confidence * 100).toFixed(0)}%\n`;
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
    prompt += `${market.symbol} PRICE: $${market.price.toFixed(2)}\n`;

    if (market.indicators) {
      prompt += `Indicators:\n`;
      Object.entries(market.indicators).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          prompt += `  - ${key}: ${value}\n`;
        }
      });
    }

    if (market.timeframes) {
      prompt += `Timeframes:\n`;
      Object.entries(market.timeframes).forEach(([tf, data]) => {
        prompt += `  - ${tf}: ${JSON.stringify(data)}\n`;
      });
    }

    prompt += `\n`;
  }); 

  // Add account info
  prompt += `=== ACCOUNT INFO ===\n`;
  prompt += `Total Balance: $${balance.toFixed(2)}\n`;
  prompt += `Available Capital: $${availableCapital.toFixed(2)}\n`;
  prompt += `Active Positions: ${activePositions.length}\n\n`;

  // Add active positions if any
  if (activePositions.length > 0) {
    prompt += `=== ACTIVE POSITIONS ===\n\n`;
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
    prompt += `⚠️ IMPORTANT: This is a NEW analysis session, NOT a copy-paste of your previous work.\n\n`;
    prompt += `Your previous analysis is shown above for REFERENCE ONLY.\n`;
    prompt += `The market has MOVED since then. Prices have CHANGED. You MUST:\n\n`;
    prompt += `1. ✅ Analyze the CURRENT market data (prices, indicators, timeframes) - NOT the old data\n`;
    prompt += `2. ✅ Compare current price action vs your previous expectations\n`;
    prompt += `3. ✅ Write a NEW conclusion describing what happened since last analysis\n`;
    prompt += `4. ✅ For each coin, make a FRESH decision based on CURRENT conditions:\n`;
    prompt += `   - If you opened a position: Is it still valid? Should you HOLD, CLOSE, or adjust?\n`;
    prompt += `   - If you were WAITING: Has a new setup formed? Or still waiting?\n`;
    prompt += `   - Use CURRENT prices for entry/SL/TP - NOT old prices\n`;
    prompt += `5. ✅ Your conclusion MUST be different from previous - describe market evolution\n\n`;
    prompt += `❌ DO NOT copy your previous conclusion word-for-word\n`;
    prompt += `❌ DO NOT use old entry prices if market has moved\n`;
    prompt += `❌ DO NOT repeat the same reasoning if conditions changed\n\n`;
    prompt += `Provide FRESH trading decisions for BTC, ASTER, GIGGLE, and BNB based on CURRENT market data.\n`;
  } else {
    prompt += `Analyze the current market data and provide trading decisions for BTC, ASTER, GIGGLE, and BNB.\n`;
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
    deepseek: "deepseek/deepseek-chat-v3.1",
    gemini: "google/gemini-2.5-pro",
    openai: "openai/gpt-5-chat-latest",
    claude: "claude-3-5-sonnet-20241022",
  };

  const normalized = agentModel.toLowerCase().trim();
  return modelMap[normalized] || "gpt-4o"; // default to GPT-4
}
