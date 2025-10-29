/**
 * ASTER Finance Futures API Client
 *
 * Implements real trading execution with ASTER DEX
 * Base URL: https://fapi.asterdex.com
 *
 * Authentication: HMAC SHA256 Signature (V2 API)
 * Documentation: https://github.com/asterdex/api-docs/blob/master/aster-finance-futures-api.md
 * 
 * SECURITY: Supports per-agent credentials from .env (never stored in database)
 */

import { type AsterCredentials } from './aster-credentials';

const ASTER_BASE_URL =
  process.env.NEXT_PUBLIC_ASTER_BASE_URL || "https://fapi.asterdex.com";
// Spot API uses the same base URL as Futures
const ASTER_SPOT_BASE_URL =
  process.env.NEXT_PUBLIC_ASTER_SPOT_BASE_URL || "https://fapi.asterdex.com";

// Default credentials (fallback)
const DEFAULT_API_KEY = process.env.NEXT_PUBLIC_ASTER_API_KEY;
const DEFAULT_SECRET_KEY = process.env.NEXT_PUBLIC_ASTER_SECRET_KEY;

// Types
export interface AsterOrderParams {
  symbol: string;
  side: "BUY" | "SELL";
  type:
    | "LIMIT"
    | "MARKET"
    | "STOP"
    | "TAKE_PROFIT"
    | "STOP_MARKET"
    | "TAKE_PROFIT_MARKET";
  positionSide?: "LONG" | "SHORT" | "BOTH";
  quantity?: number;
  price?: number;
  timeInForce?: "GTC" | "IOC" | "FOK";
  reduceOnly?: boolean;
  stopPrice?: number;
  closePosition?: boolean;
  newClientOrderId?: string;
}

export interface AsterOrderResponse {
  orderId: number;
  symbol: string;
  status: string;
  clientOrderId: string;
  price: string;
  avgPrice: string;
  origQty: string;
  executedQty: string;
  cumQty: string;
  cumQuote: string;
  timeInForce: string;
  type: string;
  reduceOnly: boolean;
  closePosition: boolean;
  side: string;
  positionSide: string;
  stopPrice?: string;
  workingType?: string;
  priceProtect: boolean;
  origType: string;
  updateTime: number;
}

export interface AsterPosition {
  symbol: string;
  positionAmt: string;
  entryPrice: string;
  markPrice: string;
  unRealizedProfit: string;
  liquidationPrice: string;
  leverage: string;
  maxNotionalValue: string;
  marginType: string;
  isolatedMargin: string;
  isAutoAddMargin: string;
  positionSide: string;
  updateTime: number;
}

export interface AsterBalance {
  accountAlias: string;
  asset: string;
  balance: string;
  crossWalletBalance: string;
  crossUnPnl: string;
  availableBalance: string;
  maxWithdrawAmount: string;
  marginAvailable: boolean;
  updateTime: number;
}

/**
 * Generate HMAC SHA256 signature for ASTER V2 API
 * 
 * @param queryString - Query string to sign
 * @param secretKey - Secret key for signing (per-agent or default)
 */
async function generateHMACSignature(
  queryString: string,
  secretKey: string
): Promise<string> {
  if (!secretKey) {
    throw new Error("Secret key is required for signature generation");
  }

  const encoder = new TextEncoder();
  const keyData = encoder.encode(secretKey);
  const messageData = encoder.encode(queryString);

  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", key, messageData);

  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Build query string from parameters
 */
function buildQueryString(params: Record<string, any>): string {
  return Object.keys(params)
    .filter((key) => params[key] !== undefined && params[key] !== null)
    .map((key) => `${key}=${encodeURIComponent(params[key])}`)
    .join("&");
}


// Request queue for proper rate limiting across parallel requests
let requestQueue: Promise<any> = Promise.resolve();
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 300; // Increased to 300ms between requests for better stability

/**
 * Make authenticated request to ASTER V2 API with HMAC signature
 * 
 * @param method - HTTP method
 * @param endpoint - API endpoint
 * @param params - Request parameters
 * @param requiresSignature - Whether signature is required
 * @param credentials - Optional per-agent credentials (uses default if not provided)
 * @param retryCount - Number of retries (internal use)
 */
async function asterRequest<T>(
  method: "GET" | "POST" | "DELETE",
  endpoint: string,
  params: Record<string, any> = {},
  requiresSignature: boolean = true,
  credentials?: AsterCredentials,
  retryCount: number = 0
): Promise<T> {
  const MAX_RETRIES = 3; // Increased from 2 to 3
  
  // Queue this request to ensure sequential execution
  // This prevents parallel requests from overwhelming the API
  return new Promise((resolve, reject) => {
    requestQueue = requestQueue.then(async () => {
      try {
        // Rate limiting: Wait if needed to avoid hitting API limits
        const now = Date.now();
        const timeSinceLastRequest = now - lastRequestTime;
        if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
          const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
          await new Promise(r => setTimeout(r, waitTime));
        }
        lastRequestTime = Date.now();
        
        const result = await executeRequest<T>(method, endpoint, params, requiresSignature, credentials, retryCount, MAX_RETRIES);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    }).catch(reject);
  });
}

/**
 * Execute the actual request (separated from queue logic)
 */
async function executeRequest<T>(
  method: "GET" | "POST" | "DELETE",
  endpoint: string,
  params: Record<string, any>,
  requiresSignature: boolean,
  credentials: AsterCredentials | undefined,
  retryCount: number,
  MAX_RETRIES: number
): Promise<T> {
  
  // Use provided credentials or fall back to default
  const apiKey = credentials?.apiKey || DEFAULT_API_KEY;
  const secretKey = credentials?.secretKey || DEFAULT_SECRET_KEY;

  if (!apiKey) {
    throw new Error("ASTER API key is not configured");
  }

  if (!secretKey) {
    throw new Error("ASTER secret key is not configured");
  }

  // Use server time with minimal offset (ASTER recommends staying close to server time)
  const timestamp = Date.now();
  const allParams = {
    ...params,
    timestamp,
    recvWindow: 5000, // Reduced from 10000 to 5000 for better security
  };

  let queryString = buildQueryString(allParams);

  if (requiresSignature) {
    const signature = await generateHMACSignature(queryString, secretKey);
    queryString += `&signature=${signature}`;
  }

  const url =
    method === "GET" || method === "DELETE"
      ? `${ASTER_BASE_URL}${endpoint}?${queryString}`
      : `${ASTER_BASE_URL}${endpoint}`;

  const options: RequestInit = {
    method,
    headers: {
      "X-MBX-APIKEY": apiKey,
      "Content-Type": "application/json",
    },
  };

  if (method === "POST") {
    options.body = queryString;
    options.headers = {
      ...options.headers,
      "Content-Type": "application/x-www-form-urlencoded",
    };
  }

  console.log(`[ASTER V2] Request: ${method} ${endpoint}${retryCount > 0 ? ` (retry ${retryCount}/${MAX_RETRIES})` : ''}`);
  
  // Add timeout to prevent hanging requests
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 second timeout (increased for stability)
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorText = '';
      try {
        errorText = await response.text();
      } catch (e) {
        errorText = 'Unable to read error response';
      }
      console.error(`[ASTER V2] API Error ${response.status}:`, errorText);
      throw new Error(`ASTER V2 API Error ${response.status}: ${errorText}`);
    }

    // Check if response has content
    let text = '';
    try {
      text = await response.text();
    } catch (e) {
      console.error(`[ASTER V2] Failed to read response text from ${endpoint}:`, e);
      throw new Error(`Failed to read response from ASTER API`);
    }

    if (!text || text.trim() === '') {
      console.error(`[ASTER V2] Empty response from ${endpoint}`);
      throw new Error(`Empty response from ASTER API`);
    }

    // Parse JSON
    try {
      const data = JSON.parse(text);
      // console.log(`[ASTER V2] Response from ${endpoint}:`, data);
      return data;
    } catch (parseError) {
      console.error(`[ASTER V2] JSON Parse Error for ${endpoint}:`, parseError);
      console.error(`[ASTER V2] Response text (first 500 chars):`, text.substring(0, 500));
      console.error(`[ASTER V2] Response length:`, text.length);
      console.error(`[ASTER V2] Response headers:`, {
        contentType: response.headers.get('content-type'),
        contentLength: response.headers.get('content-length'),
      });
      throw new Error(`Failed to parse JSON response from ${endpoint}: ${parseError instanceof Error ? parseError.message : 'Unknown parse error'}`);
    }
  } catch (error) {
    clearTimeout(timeoutId);
    
    // Handle abort/timeout
    if (error instanceof Error && error.name === 'AbortError') {
      console.error(`[ASTER V2] Request timeout for ${endpoint}`);
      
      // Retry on timeout with exponential backoff
      if (retryCount < MAX_RETRIES) {
        const backoffTime = Math.min(1000 * Math.pow(2, retryCount), 8000); // Exponential: 1s, 2s, 4s, max 8s
        console.log(`[ASTER V2] Retrying ${endpoint} after ${backoffTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffTime));
        return executeRequest<T>(method, endpoint, params, requiresSignature, credentials, retryCount + 1, MAX_RETRIES);
      }
      
      throw new Error(`Request timeout after 20 seconds`);
    }
    
    // Retry on JSON parse errors or empty responses
    if (error instanceof Error && (
      error.message.includes('Failed to parse JSON') ||
      error.message.includes('Empty response') ||
      error.message.includes('Unexpected end of JSON input')
    )) {
      if (retryCount < MAX_RETRIES) {
        const backoffTime = Math.min(500 * Math.pow(2, retryCount), 4000); // Exponential: 500ms, 1s, 2s, max 4s
        console.log(`[ASTER V2] Retrying ${endpoint} due to parse error after ${backoffTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffTime));
        return executeRequest<T>(method, endpoint, params, requiresSignature, credentials, retryCount + 1, MAX_RETRIES);
      }
    }
    
    // Retry on rate limit errors (429)
    if (error instanceof Error && error.message.includes('429')) {
      if (retryCount < MAX_RETRIES) {
        const backoffTime = Math.min(2000 * Math.pow(2, retryCount), 16000); // Longer backoff: 2s, 4s, 8s, max 16s
        console.warn(`[ASTER V2] Rate limit hit for ${endpoint}, backing off ${backoffTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffTime));
        return executeRequest<T>(method, endpoint, params, requiresSignature, credentials, retryCount + 1, MAX_RETRIES);
      }
    }
    
    throw error;
  }
}


/**
 * Test connectivity to ASTER API
 */
export async function testConnectivity(): Promise<boolean> {
  try {
    await fetch(`${ASTER_BASE_URL}/fapi/v1/ping`);
    return true;
  } catch (error) {
    console.error("[ASTER] Connectivity test failed:", error);
    return false;
  }
}

/**
 * Get server time
 */
export async function getServerTime(): Promise<number> {
  const response = await fetch(`${ASTER_BASE_URL}/fapi/v1/time`);
  const data = await response.json();
  return data.serverTime;
}

/**
 * Place a new order
 * 
 * @param params - Order parameters
 * @param credentials - Optional per-agent credentials
 */
export async function placeOrder(
  params: AsterOrderParams,
  credentials?: AsterCredentials
): Promise<AsterOrderResponse> {
  const orderParams: Record<string, any> = {
    symbol: params.symbol,
    side: params.side,
    type: params.type,
  };

  // Add optional parameters
  if (params.positionSide) orderParams.positionSide = params.positionSide;
  if (params.quantity !== undefined) orderParams.quantity = params.quantity;
  if (params.price !== undefined) orderParams.price = params.price;
  if (params.timeInForce) orderParams.timeInForce = params.timeInForce;
  
  // Only send reduceOnly if explicitly set to true
  if (params.reduceOnly === true) {
    orderParams.reduceOnly = "true";
  }
  
  if (params.stopPrice !== undefined) orderParams.stopPrice = params.stopPrice;
  
  // Only send closePosition if explicitly set to true
  if (params.closePosition === true) {
    orderParams.closePosition = "true";
  }
  
  if (params.newClientOrderId)
    orderParams.newClientOrderId = params.newClientOrderId;

  return asterRequest<AsterOrderResponse>(
    "POST",
    "/fapi/v1/order",
    orderParams,
    true,
    credentials
  );
}

/**
 * Query order status
 * 
 * @param symbol - Trading symbol
 * @param orderId - Order ID
 * @param credentials - Optional per-agent credentials
 */
export async function queryOrder(
  symbol: string,
  orderId: number,
  credentials?: AsterCredentials
): Promise<AsterOrderResponse> {
  return asterRequest<AsterOrderResponse>(
    "GET",
    "/fapi/v1/order",
    { symbol, orderId },
    true,
    credentials
  );
}

/**
 * Cancel an order
 * 
 * @param symbol - Trading symbol
 * @param orderId - Order ID
 * @param credentials - Optional per-agent credentials
 */
export async function cancelOrder(
  symbol: string,
  orderId: number,
  credentials?: AsterCredentials
): Promise<AsterOrderResponse> {
  return asterRequest<AsterOrderResponse>(
    "DELETE",
    "/fapi/v1/order",
    { symbol, orderId },
    true,
    credentials
  );
}

/**
 * Cancel all open orders for a symbol
 * 
 * @param symbol - Trading symbol
 * @param credentials - Optional per-agent credentials
 */
export async function cancelAllOrders(
  symbol: string,
  credentials?: AsterCredentials
): Promise<{ code: string; msg: string }> {
  return asterRequest(
    "DELETE",
    "/fapi/v1/allOpenOrders",
    { symbol },
    true,
    credentials
  );
}

/**
 * Get all open orders
 * 
 * @param symbolOrCredentials - Symbol filter (string) OR credentials (object)
 * @param credentials - Optional per-agent credentials (if first param is symbol)
 */
export async function getOpenOrders(
  symbolOrCredentials?: string | AsterCredentials,
  credentials?: AsterCredentials
): Promise<AsterOrderResponse[]> {
  // Handle overloaded parameters
  let symbol: string | undefined;
  let creds: AsterCredentials | undefined;
  
  if (typeof symbolOrCredentials === 'string') {
    symbol = symbolOrCredentials;
    creds = credentials;
  } else if (symbolOrCredentials && typeof symbolOrCredentials === 'object') {
    symbol = undefined;
    creds = symbolOrCredentials;
  } else {
    symbol = undefined;
    creds = undefined;
  }
  
  const params = symbol ? { symbol } : {};
  return asterRequest<AsterOrderResponse[]>(
    "GET",
    "/fapi/v1/openOrders",
    params,
    true,
    creds
  );
}

/**
 * Get account balance (V2 API)
 * V2 uses HMAC SHA256 signature authentication
 * Endpoint: GET /fapi/v2/balance
 * 
 * @param credentials - Optional per-agent credentials
 */
export async function getAccountBalance(
  credentials?: AsterCredentials
): Promise<AsterBalance[]> {
  return asterRequest<AsterBalance[]>(
    "GET",
    "/fapi/v2/balance",
    {},
    true,
    credentials
  );
}

/**
 * Get position information (V2 API)
 * V2 uses HMAC SHA256 signature authentication
 * Endpoint: GET /fapi/v2/positionRisk
 * 
 * @param symbolOrCredentials - Symbol filter (string) OR credentials (object)
 * @param credentials - Optional per-agent credentials (if first param is symbol)
 */
export async function getPositionInfo(
  symbolOrCredentials?: string | AsterCredentials,
  credentials?: AsterCredentials
): Promise<AsterPosition[]> {
  // Handle overloaded parameters
  let symbol: string | undefined;
  let creds: AsterCredentials | undefined;
  
  if (typeof symbolOrCredentials === 'string') {
    // Called as: getPositionInfo('BTCUSDT', credentials)
    symbol = symbolOrCredentials;
    creds = credentials;
  } else if (symbolOrCredentials && typeof symbolOrCredentials === 'object') {
    // Called as: getPositionInfo(credentials)
    symbol = undefined;
    creds = symbolOrCredentials;
  } else {
    // Called as: getPositionInfo()
    symbol = undefined;
    creds = undefined;
  }
  
  const params = symbol ? { symbol } : {};
  return asterRequest<AsterPosition[]>(
    "GET",
    "/fapi/v2/positionRisk",
    params,
    true,
    creds
  );
}

/**
 * Get account information (V2 API)
 * V2 uses HMAC SHA256 signature authentication
 * Endpoint: GET /fapi/v2/account
 * 
 * @param credentials - Optional per-agent credentials
 */
export async function getAccountInfo(
  credentials?: AsterCredentials
): Promise<any> {
  return asterRequest<any>(
    "GET",
    "/fapi/v2/account",
    {},
    true,
    credentials
  );
}

/**
 * Get current position mode (Hedge Mode or One-way Mode)
 * 
 * @param credentials - Optional per-agent credentials
 * @returns { dualSidePosition: boolean } - true: Hedge Mode, false: One-way Mode
 */
export async function getPositionMode(
  credentials?: AsterCredentials
): Promise<{ dualSidePosition: boolean }> {
  return asterRequest(
    "GET",
    "/fapi/v1/positionSide/dual",
    {},
    true,
    credentials
  );
}

/**
 * Change position mode (Hedge Mode or One-way Mode)
 * 
 * @param dualSidePosition - true: Hedge Mode, false: One-way Mode
 * @param credentials - Optional per-agent credentials
 */
export async function changePositionMode(
  dualSidePosition: boolean,
  credentials?: AsterCredentials
): Promise<{ code: number; msg: string }> {
  return asterRequest(
    "POST",
    "/fapi/v1/positionSide/dual",
    { dualSidePosition: dualSidePosition.toString() },
    true,
    credentials
  );
}

/**
 * Change initial leverage
 * 
 * @param symbol - Trading symbol
 * @param leverage - Leverage value
 * @param credentials - Optional per-agent credentials
 */
export async function changeInitialLeverage(
  symbol: string,
  leverage: number,
  credentials?: AsterCredentials
): Promise<{ leverage: number; maxNotionalValue: string; symbol: string }> {
  return asterRequest(
    "POST",
    "/fapi/v1/leverage",
    { symbol, leverage },
    true,
    credentials
  );
}

/**
 * Change margin type (ISOLATED or CROSSED)
 * 
 * @param symbol - Trading symbol
 * @param marginType - Margin type
 * @param credentials - Optional per-agent credentials
 */
export async function changeMarginType(
  symbol: string,
  marginType: "ISOLATED" | "CROSSED",
  credentials?: AsterCredentials
): Promise<{ code: number; msg: string }> {
  return asterRequest(
    "POST",
    "/fapi/v1/marginType",
    { symbol, marginType },
    true,
    credentials
  );
}

/**
 * Enable Multi-Assets Mode
 * Allows using BNB as margin for USDT trading pairs
 * CRITICAL for trading with BNB balance!
 * 
 * @param credentials - Optional per-agent credentials
 */
export async function enableMultiAssetsMode(
  credentials?: AsterCredentials
): Promise<{
  code: number;
  msg: string;
}> {
  return asterRequest(
    "POST",
    "/fapi/v1/multiAssetsMargin",
    { multiAssetsMargin: "true" },
    true,
    credentials
  );
}

/**
 * Disable Multi-Assets Mode (back to Single-Asset Mode)
 * 
 * @param credentials - Optional per-agent credentials
 */
export async function disableMultiAssetsMode(
  credentials?: AsterCredentials
): Promise<{
  code: number;
  msg: string;
}> {
  return asterRequest(
    "POST",
    "/fapi/v1/multiAssetsMargin",
    { multiAssetsMargin: "false" },
    true,
    credentials
  );
}

/**
 * Get current Multi-Assets Mode status
 * 
 * @param credentials - Optional per-agent credentials
 */
export async function getMultiAssetsMode(
  credentials?: AsterCredentials
): Promise<{
  multiAssetsMargin: boolean;
}> {
  return asterRequest(
    "GET",
    "/fapi/v1/multiAssetsMargin",
    {},
    true,
    credentials
  );
}

/**
 * Helper: Place MARKET BUY order (LONG)
 * 
 * @param symbol - Trading symbol
 * @param quantity - Order quantity
 * @param positionSide - Position side
 * @param credentials - Optional per-agent credentials
 */
export async function marketBuy(
  symbol: string,
  quantity: number,
  positionSide: "LONG" | "SHORT" | "BOTH" = "BOTH",
  credentials?: AsterCredentials
): Promise<AsterOrderResponse> {
  return placeOrder({
    symbol,
    side: "BUY",
    type: "MARKET",
    quantity,
    positionSide,
  }, credentials);
}

/**
 * Helper: Place MARKET SELL order (SHORT)
 * 
 * @param symbol - Trading symbol
 * @param quantity - Order quantity
 * @param positionSide - Position side
 * @param credentials - Optional per-agent credentials
 */
export async function marketSell(
  symbol: string,
  quantity: number,
  positionSide: "LONG" | "SHORT" | "BOTH" = "BOTH",
  credentials?: AsterCredentials
): Promise<AsterOrderResponse> {
  return placeOrder({
    symbol,
    side: "SELL",
    type: "MARKET",
    quantity,
    positionSide,
  }, credentials);
}

/**
 * Helper: Close position with MARKET order
 * 
 * IMPORTANT: 
 * - closePosition=true can ONLY be used with STOP_MARKET or TAKE_PROFIT_MARKET
 * - reduceOnly CANNOT be sent in Hedge Mode (when positionSide is specified)
 * - For MARKET orders in Hedge Mode: just send opposite side with exact quantity
 * 
 * @param symbol - Trading symbol
 * @param positionSide - Position side to close
 * @param credentials - Optional per-agent credentials
 */
export async function closePositionMarket(
  symbol: string,
  positionSide: "LONG" | "SHORT" | "BOTH",
  credentials?: AsterCredentials
): Promise<AsterOrderResponse> {
  // First, get current position to know the quantity
  const positions = await getPositionInfo(credentials);
  const position = positions.find(
    (p) => p.symbol === symbol && parseFloat(p.positionAmt) !== 0
  );

  if (!position) {
    throw new Error(`No active position found for ${symbol}`);
  }

  const positionAmt = Math.abs(parseFloat(position.positionAmt));
  const side = parseFloat(position.positionAmt) > 0 ? "SELL" : "BUY";

  // Check position mode to determine if we should send positionSide
  let usePositionSide = false;
  try {
    const positionMode = await getPositionMode(credentials);
    usePositionSide = positionMode.dualSidePosition; // true = Hedge Mode, false = One-way Mode
  } catch (error) {
    console.warn('[ASTER] Failed to get position mode, assuming One-way Mode');
    usePositionSide = false;
  }

  // Build order parameters based on position mode
  const orderParams: AsterOrderParams = {
    symbol,
    side,
    type: "MARKET",
    quantity: positionAmt,
  };

  // Only add positionSide in Hedge Mode
  if (usePositionSide) {
    orderParams.positionSide = positionSide;
  }

  return placeOrder(orderParams, credentials);
}

/**
 * Helper: Place STOP LOSS order
 * 
 * @param symbol - Trading symbol
 * @param stopPrice - Stop loss price
 * @param positionSide - Position side
 * @param credentials - Optional per-agent credentials
 */
export async function placeStopLoss(
  symbol: string,
  stopPrice: number,
  positionSide: "LONG" | "SHORT" | "BOTH",
  credentials?: AsterCredentials
): Promise<AsterOrderResponse> {
  const side = positionSide === "LONG" ? "SELL" : "BUY";

  return placeOrder({
    symbol,
    side,
    type: "STOP_MARKET",
    stopPrice,
    closePosition: true,
    positionSide,
  }, credentials);
}

/**
 * Helper: Place TAKE PROFIT order
 * 
 * @param symbol - Trading symbol
 * @param stopPrice - Take profit price
 * @param positionSide - Position side
 * @param credentials - Optional per-agent credentials
 */
export async function placeTakeProfit(
  symbol: string,
  stopPrice: number,
  positionSide: "LONG" | "SHORT" | "BOTH",
  credentials?: AsterCredentials
): Promise<AsterOrderResponse> {
  const side = positionSide === "LONG" ? "SELL" : "BUY";

  return placeOrder({
    symbol,
    side,
    type: "TAKE_PROFIT_MARKET",
    stopPrice,
    closePosition: true,
    positionSide,
  }, credentials);
}

/**
 * Make authenticated request to ASTER Spot API
 * Uses default credentials (not per-agent)
 */
async function asterSpotRequest<T>(
  method: "GET" | "POST" | "DELETE",
  endpoint: string,
  params: Record<string, any> = {},
  requiresSignature: boolean = true
): Promise<T> {
  if (!DEFAULT_API_KEY) {
    throw new Error("ASTER_API_KEY is not configured");
  }

  if (!DEFAULT_SECRET_KEY) {
    throw new Error("ASTER_SECRET_KEY is not configured");
  }

  // Add timestamp (adjust for server time difference)
  const timestamp = Date.now() - 3000;
  const allParams = {
    ...params,
    timestamp,
    recvWindow: 10000,
  };

  // Build query string
  let queryString = buildQueryString(allParams);

  // Generate signature if required
  if (requiresSignature) {
    const signature = await generateHMACSignature(queryString, DEFAULT_SECRET_KEY);
    queryString += `&signature=${signature}`;
  }

  // Build URL using SPOT base URL
  const url =
    method === "GET" || method === "DELETE"
      ? `${ASTER_SPOT_BASE_URL}${endpoint}?${queryString}`
      : `${ASTER_SPOT_BASE_URL}${endpoint}`;

  // Prepare request options
  const options: RequestInit = {
    method,
    headers: {
      "X-MBX-APIKEY": DEFAULT_API_KEY,
      "Content-Type": "application/json",
    },
  };

  // Add body for POST requests
  if (method === "POST") {
    options.body = queryString;
    options.headers = {
      ...options.headers,
      "Content-Type": "application/x-www-form-urlencoded",
    };
  }

  console.log(`[ASTER SPOT] ${method} ${endpoint}`, { params: allParams });

  const response = await fetch(url, options);

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[ASTER SPOT] API Error:`, errorText);
    throw new Error(`ASTER SPOT API Error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
//   console.log(`[ASTER SPOT] Response:`, data);
  return data;
}

/**
 * Get spot wallet balance
 * ASTER doesn't have separate Spot balance API
 * Returns empty balances since we can't access Spot wallet via API
 */
export async function getSpotBalance(): Promise<{
  balances: Array<{ asset: string; free: string; locked: string }>;
}> {
  // ASTER doesn't expose Spot wallet balance via API
  // User must check Spot balance manually via dashboard
  console.warn(
    "[ASTER] Spot balance API not available - check dashboard manually"
  );
  return { balances: [] };
}

/**
 * Transfer assets between Spot and Futures wallets
 * Uses ASTER Spot API endpoint
 */
export async function transferSpotFutures(
  asset: string,
  amount: number,
  direction: "SPOT_TO_FUTURES" | "FUTURES_TO_SPOT"
): Promise<{ tranId: number; status: string }> {
  const kindType =
    direction === "SPOT_TO_FUTURES" ? "SPOT_FUTURE" : "FUTURE_SPOT";
  const clientTranId = `transfer_${Date.now()}_${Math.random()
    .toString(36)
    .substring(7)}`;

  return asterSpotRequest<{ tranId: number; status: string }>(
    "POST",
    "/api/v1/asset/wallet/transfer",
    {
      amount: amount.toString(),
      asset,
      clientTranId,
      kindType,
    }
  );
}

/**
 * Auto-transfer all BNB from Spot to Futures wallet
 * Checks Spot wallet and transfers all available BNB to Futures
 * Returns transfer result or null if no balance to transfer
 */
export async function autoTransferBNBToFutures(): Promise<{
  transferred: boolean;
  amount?: number;
  tranId?: number;
  message: string;
}> {
  // ASTER doesn't provide Spot balance API
  // Auto-transfer is not possible - must be done manually via dashboard
  console.log("[ASTER] Auto-transfer not available - Spot API not accessible");
  console.log("[ASTER] Please transfer BNB manually via ASTER dashboard:");
  console.log("[ASTER] 1. Go to https://www.asterdex.com");
  console.log("[ASTER] 2. Wallet → Transfer");
  console.log("[ASTER] 3. Transfer BNB from Spot to Futures");

  return {
    transferred: false,
    message:
      "Auto-transfer not available. Please transfer BNB manually via ASTER dashboard (Wallet → Transfer → Spot to Futures)",
  };
}
