import type { AIDecision, Agent } from "@/types";
import * as AsterClient from "./aster-client";
import type { AsterCredentials } from "./aster-credentials";

/**
 * ASTER Order Execution Service
 *
 * Integrates ASTER API with AI Trading decisions
 * Handles real order execution on ASTER exchange
 */

export interface ExecutionResult {
  success: boolean;
  orderId?: number;
  error?: string;
  asterResponse?: any;
}

/**
 * Convert coin symbol to ASTER format
 * BTC -> BTCUSDT, ETH -> ETHUSDT, etc.
 */
function toAsterSymbol(coin: string): string {
  const symbolMap: Record<string, string> = {
    BTC: "BTCUSDT",
    ETH: "ETHUSDT",
    SOL: "SOLUSDT",
    BNB: "BNBUSDT",
  };

  return symbolMap[coin.toUpperCase()] || `${coin.toUpperCase()}USDT`;
}

/**
 * Symbol precision cache to avoid repeated API calls
 */
const symbolPrecisionCache: Map<string, { stepSize: string; minQty: string; maxQty: string; minNotional: string }> = new Map();

/**
 * Get symbol precision and filters from exchange info
 */
async function getSymbolPrecision(symbol: string): Promise<{ 
  stepSize: string; 
  minQty: string; 
  maxQty: string;
  minNotional: string;
}> {
  // Check cache first
  if (symbolPrecisionCache.has(symbol)) {
    const cached = symbolPrecisionCache.get(symbol)!;
    console.log(`[ASTER Execution] Using cached precision for ${symbol}:`, cached);
    return cached;
  }

  try {
    console.log(`[ASTER Execution] Fetching precision for ${symbol}...`);
    
    // Fetch exchange info
    const response = await fetch(`${process.env.NEXT_PUBLIC_ASTER_BASE_URL || 'https://fapi.asterdex.com'}/fapi/v1/exchangeInfo`);
    
    if (!response.ok) {
      throw new Error(`Exchange info API returned ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.symbols || !Array.isArray(data.symbols)) {
      throw new Error('Invalid exchange info response format');
    }
    
    // Find symbol info
    const symbolInfo = data.symbols.find((s: any) => s.symbol === symbol);
    if (!symbolInfo) {
      console.error(`[ASTER Execution] Available symbols:`, data.symbols.map((s: any) => s.symbol).slice(0, 10));
      throw new Error(`Symbol ${symbol} not found in exchange info`);
    }

    // Find LOT_SIZE filter
    const lotSizeFilter = symbolInfo.filters.find((f: any) => f.filterType === 'LOT_SIZE');
    if (!lotSizeFilter) {
      console.error(`[ASTER Execution] Available filters for ${symbol}:`, symbolInfo.filters.map((f: any) => f.filterType));
      throw new Error(`LOT_SIZE filter not found for ${symbol}`);
    }

    // Find MIN_NOTIONAL filter
    const minNotionalFilter = symbolInfo.filters.find((f: any) => f.filterType === 'MIN_NOTIONAL');
    const minNotional = minNotionalFilter?.notional || '5.0'; // Default to 5.0 if not found

    const precision = {
      stepSize: lotSizeFilter.stepSize,
      minQty: lotSizeFilter.minQty,
      maxQty: lotSizeFilter.maxQty,
      minNotional
    };

    // Cache it
    symbolPrecisionCache.set(symbol, precision);
    
    console.log(`[ASTER Execution] ✅ ${symbol} precision loaded:`, precision);
    return precision;
  } catch (error) {
    console.error(`[ASTER Execution] ❌ Failed to get precision for ${symbol}:`, error);
    console.warn(`[ASTER Execution] Using fallback precision for ${symbol}`);
    
    // Fallback to safe defaults
    const fallback = {
      stepSize: '0.001',
      minQty: '0.001',
      maxQty: '1000000',
      minNotional: '5.0' // ASTER default
    };
    
    return fallback;
  }
}

/**
 * Round quantity to match symbol's stepSize
 */
function roundToStepSize(quantity: number, stepSize: string): number {
  const stepSizeNum = parseFloat(stepSize);
  const precision = stepSize.includes('.') ? stepSize.split('.')[1].length : 0;
  
  // Round down to nearest stepSize multiple
  const rounded = Math.floor(quantity / stepSizeNum) * stepSizeNum;
  
  return Number(rounded.toFixed(precision));
}

/**
 * Get appropriate positionSide based on user's position mode setting
 * 
 * @param side - "LONG" or "SHORT"
 * @param credentials - Optional per-agent credentials
 * @returns positionSide - "LONG", "SHORT", or "BOTH"
 */
async function getPositionSide(
  side: "LONG" | "SHORT",
  credentials?: AsterCredentials
): Promise<"LONG" | "SHORT" | "BOTH"> {
  try {
    const positionMode = await AsterClient.getPositionMode(credentials);
    
    // Hedge Mode: use specific side
    if (positionMode.dualSidePosition) {
      console.log(`[ASTER Execution] Hedge Mode detected - using positionSide: ${side}`);
      return side;
    }
    
    // One-way Mode: always use BOTH
    console.log(`[ASTER Execution] One-way Mode detected - using positionSide: BOTH`);
    return "BOTH";
  } catch (error) {
    console.warn(`[ASTER Execution] Failed to get position mode, defaulting to BOTH:`, error);
    return "BOTH";
  }
}

/**
 * Calculate quantity from size_usd and entry_price with proper precision
 * Ensures quantity meets MIN_NOTIONAL requirement (price × quantity ≥ minNotional)
 */
async function calculateQuantity(
  sizeUsd: number,
  entryPrice: number,
  symbol: string
): Promise<number> {
  const rawQuantity = sizeUsd / entryPrice;
  
  console.log(`[ASTER Execution] Calculating quantity for ${symbol}:`, {
    sizeUsd,
    entryPrice,
    rawQuantity
  });
  
  // Get symbol precision and filters
  const { stepSize, minQty, maxQty, minNotional } = await getSymbolPrecision(symbol);
  
  // Round to stepSize
  let quantity = roundToStepSize(rawQuantity, stepSize);
  
  // Validate against min/max quantity
  const minQtyNum = parseFloat(minQty);
  const maxQtyNum = parseFloat(maxQty);
  const minNotionalNum = parseFloat(minNotional);
  
  if (quantity < minQtyNum) {
    console.warn(`[ASTER Execution] ⚠️ Quantity ${quantity} < minQty ${minQty}, using minimum`);
    quantity = minQtyNum;
  }
  
  if (quantity > maxQtyNum) {
    console.warn(`[ASTER Execution] ⚠️ Quantity ${quantity} > maxQty ${maxQty}, using maximum`);
    quantity = maxQtyNum;
  }
  
  // CRITICAL: Validate MIN_NOTIONAL (price × quantity ≥ minNotional)
  const notionalValue = quantity * entryPrice;
  
  if (notionalValue < minNotionalNum) {
    console.warn(`[ASTER Execution] ⚠️ Notional ${notionalValue.toFixed(2)} < minNotional ${minNotional}`);
    
    // Calculate minimum quantity needed to meet MIN_NOTIONAL
    const minQuantityForNotional = minNotionalNum / entryPrice;
    const adjustedQuantity = roundToStepSize(minQuantityForNotional, stepSize);
    
    // If rounded down is still below minNotional, round up
    if (adjustedQuantity * entryPrice < minNotionalNum) {
      const stepSizeNum = parseFloat(stepSize);
      quantity = adjustedQuantity + stepSizeNum;
    } else {
      quantity = adjustedQuantity;
    }
    
    console.log(`[ASTER Execution] 📈 Adjusted quantity to ${quantity} to meet MIN_NOTIONAL (notional: ${(quantity * entryPrice).toFixed(2)})`);
  }
  
  console.log(`[ASTER Execution] ✅ Final quantity for ${symbol}: ${quantity} (stepSize: ${stepSize}, notional: ${(quantity * entryPrice).toFixed(2)})`);
  
  return quantity;
}

/**
 * Execute LONG position (BUY order)
 *
 * @param decision - Trading decision
 * @param credentials - Optional per-agent credentials
 */
export async function executeLong(
  decision: AIDecision,
  credentials?: AsterCredentials
): Promise<ExecutionResult> {
  try {
    // CRITICAL VALIDATION: Prevent invalid parameters from reaching ASTER API
    if (!decision.size_usd || decision.size_usd <= 0) {
      const errorMsg = `Invalid size_usd: ${decision.size_usd} (must be > 0)`;
      console.error(`[ASTER Execution] ❌ ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
    
    if (!decision.leverage || decision.leverage <= 0 || decision.leverage > 125) {
      const errorMsg = `Invalid leverage: ${decision.leverage} (must be 1-125)`;
      console.error(`[ASTER Execution] ❌ ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
    
    if (!decision.entry_price || decision.entry_price <= 0) {
      const errorMsg = `Invalid entry_price: ${decision.entry_price} (must be > 0)`;
      console.error(`[ASTER Execution] ❌ ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
    
    const symbol = toAsterSymbol(decision.coin);
    const quantity = await calculateQuantity(decision.size_usd, decision.entry_price, symbol);
    
    // Validate calculated quantity
    if (!quantity || quantity <= 0) {
      const errorMsg = `Invalid calculated quantity: ${quantity} (size_usd: ${decision.size_usd}, entry_price: ${decision.entry_price})`;
      console.error(`[ASTER Execution] ❌ ${errorMsg}`);
      return { success: false, error: errorMsg };
    }

    // Cap leverage at 10x for safety
    const safeLeverage = Math.min(Math.max(decision.leverage, 1), 10);
    
    console.log(`[ASTER Execution] Opening LONG position:`, {
      symbol,
      quantity,
      entry_price: decision.entry_price,
      size_usd: decision.size_usd,
      leverage: safeLeverage,
      originalLeverage: decision.leverage,
    });

    // Set leverage first
    await AsterClient.changeInitialLeverage(
      symbol,
      safeLeverage,
      credentials
    );

    // Get appropriate positionSide based on user's position mode
    const positionSide = await getPositionSide("LONG", credentials);

    // Place MARKET BUY order
    const orderResponse = await AsterClient.marketBuy(
      symbol,
      quantity,
      positionSide,
      credentials
    );

    console.log(
      `[ASTER Execution] LONG order placed successfully:`,
      orderResponse
    );

    // Place STOP LOSS order if specified
    if (decision.stop_loss) {
      try {
        await AsterClient.placeStopLoss(
          symbol,
          decision.stop_loss,
          positionSide,
          credentials
        );
        console.log(
          `[ASTER Execution] Stop loss placed at ${decision.stop_loss}`
        );
      } catch (error) {
        console.error(`[ASTER Execution] Failed to place stop loss:`, error);
      }
    }

    // Place TAKE PROFIT order if specified
    if (decision.profit_target) {
      try {
        await AsterClient.placeTakeProfit(
          symbol,
          decision.profit_target,
          positionSide,
          credentials
        );
        console.log(
          `[ASTER Execution] Take profit placed at ${decision.profit_target}`
        );
      } catch (error) {
        console.error(`[ASTER Execution] Failed to place take profit:`, error);
      }
    }

    return {
      success: true,
      orderId: orderResponse.orderId,
      asterResponse: orderResponse,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error(`[ASTER Execution] Failed to execute LONG:`, errorMsg);
    return {
      success: false,
      error: errorMsg,
    };
  }
}

/**
 * Execute SHORT position (SELL order)
 *
 * @param decision - Trading decision
 * @param credentials - Optional per-agent credentials
 */
export async function executeShort(
  decision: AIDecision,
  credentials?: AsterCredentials
): Promise<ExecutionResult> {
  try {
    // CRITICAL VALIDATION: Prevent invalid parameters from reaching ASTER API
    if (!decision.size_usd || decision.size_usd <= 0) {
      const errorMsg = `Invalid size_usd: ${decision.size_usd} (must be > 0)`;
      console.error(`[ASTER Execution] ❌ ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
    
    if (!decision.leverage || decision.leverage <= 0 || decision.leverage > 125) {
      const errorMsg = `Invalid leverage: ${decision.leverage} (must be 1-125)`;
      console.error(`[ASTER Execution] ❌ ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
    
    if (!decision.entry_price || decision.entry_price <= 0) {
      const errorMsg = `Invalid entry_price: ${decision.entry_price} (must be > 0)`;
      console.error(`[ASTER Execution] ❌ ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
    
    const symbol = toAsterSymbol(decision.coin);
    const quantity = await calculateQuantity(decision.size_usd, decision.entry_price, symbol);
    
    // Validate calculated quantity
    if (!quantity || quantity <= 0) {
      const errorMsg = `Invalid calculated quantity: ${quantity} (size_usd: ${decision.size_usd}, entry_price: ${decision.entry_price})`;
      console.error(`[ASTER Execution] ❌ ${errorMsg}`);
      return { success: false, error: errorMsg };
    }

    // Cap leverage at 10x for safety
    const safeLeverage = Math.min(Math.max(decision.leverage, 1), 10);
    
    console.log(`[ASTER Execution] Opening SHORT position:`, {
      symbol,
      quantity,
      entry_price: decision.entry_price,
      size_usd: decision.size_usd,
      leverage: safeLeverage,
      originalLeverage: decision.leverage,
    });

    // Set leverage first
    await AsterClient.changeInitialLeverage(
      symbol,
      safeLeverage,
      credentials
    );

    // Get appropriate positionSide based on user's position mode
    const positionSide = await getPositionSide("SHORT", credentials);

    // Place MARKET SELL order
    const orderResponse = await AsterClient.marketSell(
      symbol,
      quantity,
      positionSide,
      credentials
    );

    console.log(
      `[ASTER Execution] SHORT order placed successfully:`,
      orderResponse
    );

    // Place STOP LOSS order if specified
    if (decision.stop_loss) {
      try {
        await AsterClient.placeStopLoss(
          symbol,
          decision.stop_loss,
          positionSide,
          credentials
        );
        console.log(
          `[ASTER Execution] Stop loss placed at ${decision.stop_loss}`
        );
      } catch (error) {
        console.error(`[ASTER Execution] Failed to place stop loss:`, error);
      }
    }

    // Place TAKE PROFIT order if specified
    if (decision.profit_target) {
      try {
        await AsterClient.placeTakeProfit(
          symbol,
          decision.profit_target,
          positionSide,
          credentials
        );
        console.log(
          `[ASTER Execution] Take profit placed at ${decision.profit_target}`
        );
      } catch (error) {
        console.error(`[ASTER Execution] Failed to place take profit:`, error);
      }
    }

    return {
      success: true,
      orderId: orderResponse.orderId,
      asterResponse: orderResponse,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error(`[ASTER Execution] Failed to execute SHORT:`, errorMsg);
    return {
      success: false,
      error: errorMsg,
    };
  }
}

/**
 * Close existing position
 *
 * @param coin - Coin symbol
 * @param credentials - Optional per-agent credentials
 */
export async function executeClose(
  coin: string,
  credentials?: AsterCredentials
): Promise<ExecutionResult> {
  try {
    const symbol = toAsterSymbol(coin);

    console.log(`[ASTER Execution] Closing position for ${symbol}`);

    // Get current position to determine side AND capture markPrice before closing
    const positions = await AsterClient.getPositionInfo(credentials);
    const position = positions.find(
      (p) => p.symbol === symbol && parseFloat(p.positionAmt) !== 0
    );

    if (!position) {
      return {
        success: false,
        error: "No active position found",
      };
    }

    // Determine position side
    const positionAmt = parseFloat(position.positionAmt);
    const positionSide = positionAmt > 0 ? "LONG" : "SHORT";
    
    // IMPORTANT: Capture markPrice BEFORE closing (as fallback for avgPrice)
    const markPrice = parseFloat(position.markPrice);

    // Close position
    const orderResponse = await AsterClient.closePositionMarket(
      symbol,
      positionSide,
      credentials
    );

    console.log(
      `[ASTER Execution] Position closed successfully:`,
      orderResponse
    );

    // Use avgPrice from order response, fallback to markPrice if avgPrice is 0 or invalid
    const avgPrice = orderResponse.avgPrice && parseFloat(orderResponse.avgPrice) > 0
      ? parseFloat(orderResponse.avgPrice)
      : markPrice;

    return {
      success: true,
      orderId: orderResponse.orderId,
      asterResponse: {
        ...orderResponse,
        avgPrice: avgPrice.toString(), // Override with valid price
        markPrice: markPrice.toString(), // Include markPrice for reference
      },
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error(`[ASTER Execution] Failed to close position:`, errorMsg);
    return {
      success: false,
      error: errorMsg,
    };
  }
}

/**
 * Get account balance in USD equivalent
 * Supports both USDT and BNB as trading capital
 * BNB is converted to USD using current market price
 *
 * @param credentials - Optional per-agent credentials
 */
export async function getAccountBalance(
  credentials?: AsterCredentials
): Promise<number> {
  try {
    const balances = await AsterClient.getAccountBalance(credentials);

    // Check USDT balance
    const usdtBalance = balances.find((b) => b.asset === "USDT");
    const usdtAmount = usdtBalance
      ? parseFloat(usdtBalance.availableBalance)
      : 0;

    // Check BNB balance
    const bnbBalance = balances.find((b) => b.asset === "BNB");
    const bnbAmount = bnbBalance ? parseFloat(bnbBalance.availableBalance) : 0;

    // If we have BNB, convert to USD equivalent
    let bnbUsdValue = 0;
    if (bnbAmount > 0) {
      try {
        // Get BNB price from market data
        const bnbPrice = await getBNBPrice(credentials);
        bnbUsdValue = bnbAmount * bnbPrice;
        console.log(
          `[ASTER Execution] BNB Balance: ${bnbAmount} BNB (~$${bnbUsdValue.toFixed(
            2
          )} @ $${bnbPrice})`
        );
      } catch (error) {
        console.error(`[ASTER Execution] Failed to get BNB price:`, error);
      }
    }

    const totalUsdValue = usdtAmount + bnbUsdValue;
    console.log(
      `[ASTER Execution] Total Balance: $${totalUsdValue.toFixed(
        2
      )} (USDT: $${usdtAmount}, BNB: $${bnbUsdValue.toFixed(2)})`
    );

    return totalUsdValue;
  } catch (error) {
    console.error(`[ASTER Execution] Failed to get balance:`, error);
    return 0;
  }
}

/**
 * Get current BNB price in USD
 * Fetches from ASTER market data
 *
 * @param credentials - Optional per-agent credentials
 */
async function getBNBPrice(credentials?: AsterCredentials): Promise<number> {
  try {
    // Fetch BNB price from your market data API
    const response = await fetch("/api/ticker?symbol=BNB", {
      headers: {
        Authorization: `Bearer ${credentials?.apiKey}`,
      },
    });
    if (response.ok) {
      const data = await response.json();
      return data.price || 600; // Fallback to ~$600 if API fails
    }
  } catch (error) {
    console.error(`[ASTER Execution] Failed to fetch BNB price:`, error);
  }

  // Fallback: Use approximate BNB price
  return 600;
}

/**
 * Get current positions from ASTER
 *
 * @param credentials - Optional per-agent credentials
 */
export async function getCurrentPositions(
  credentials?: AsterCredentials
): Promise<AsterClient.AsterPosition[]> {
  try {
    const positions = await AsterClient.getPositionInfo(credentials);
    // Filter only positions with non-zero amount
    return positions.filter((p) => parseFloat(p.positionAmt) !== 0);
  } catch (error) {
    console.error(`[ASTER Execution] Failed to get positions:`, error);
    return [];
  }
}

/**
 * Test ASTER API connection
 */
export async function testConnection(): Promise<boolean> {
  try {
    const isConnected = await AsterClient.testConnectivity();
    if (isConnected) {
      const serverTime = await AsterClient.getServerTime();
      console.log(
        `[ASTER Execution] Connected successfully. Server time: ${new Date(
          serverTime
        ).toISOString()}`
      );
    }
    return isConnected;
  } catch (error) {
    console.error(`[ASTER Execution] Connection test failed:`, error);
    return false;
  }
}
