// Lightweight exchange data fetchers for public klines
// Supports MEXC and Binance with 1m interval for indicator computation

export interface Kline {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
}

function toNum(n: any): number {
  const v = typeof n === 'string' ? parseFloat(n) : Number(n);
  return Number.isFinite(v) ? v : 0;
}

function parseRawKlines(raw: any[]): Kline[] {
  // Both Binance and MEXC return array-of-arrays in similar positions
  // [
  //   openTime, open, high, low, close, volume, closeTime, quoteAssetVolume,
  //   numberOfTrades, takerBuyBaseAssetVolume, takerBuyQuoteAssetVolume, ignore
  // ]
  return (raw || []).map((r) => ({
    openTime: Number(r[0]),
    open: toNum(r[1]),
    high: toNum(r[2]),
    low: toNum(r[3]),
    close: toNum(r[4]),
    volume: toNum(r[5]),
    closeTime: Number(r[6]),
  }));
}

export async function fetchMexcKlines(symbolPair: string, limit = 200): Promise<Kline[]> {
  const url = `https://api.mexc.com/api/v3/klines?symbol=${encodeURIComponent(symbolPair)}&interval=1m&limit=${limit}`;
  const res = await fetch(url, {
    next: { revalidate: 0 },
    headers: { 'User-Agent': 'llm-trading/1.0' },
  });
  if (!res.ok) throw new Error(`MEXC klines failed: ${res.status}`);
  const raw = await res.json();
  return parseRawKlines(raw);
}

export async function fetchBinanceKlines(symbolPair: string, limit = 200): Promise<Kline[]> {
  const url = `https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(symbolPair)}&interval=1m&limit=${limit}`;
  const res = await fetch(url, {
    next: { revalidate: 0 },
    headers: { 'User-Agent': 'llm-trading/1.0' },
  });
  if (!res.ok) throw new Error(`Binance klines failed: ${res.status}`);
  const raw = await res.json();
  return parseRawKlines(raw);
}

/**
 * Fetch from Gate.io Spot
 */
export async function fetchGateioKlines(symbolPair: string, limit = 200): Promise<Kline[]> {
  const pair = symbolPair.replace('USDT', '_USDT');
  const url = `https://api.gateio.ws/api/v4/spot/candlesticks?currency_pair=${pair}&interval=1m&limit=${limit}`;
  
  const res = await fetch(url, {
    next: { revalidate: 0 },
    headers: { 'User-Agent': 'llm-trading/1.0' },
  });
  
  if (!res.ok) throw new Error(`Gate.io Spot klines failed: ${res.status}`);
  
  const raw = await res.json();
  
  // Gate.io returns: [[timestamp, volume, close, high, low, open], ...]
  return (raw || []).map((r: any[]) => ({
    openTime: Number(r[0]) * 1000,
    open: toNum(r[5]),
    high: toNum(r[3]),
    low: toNum(r[4]),
    close: toNum(r[2]),
    volume: toNum(r[1]),
    closeTime: Number(r[0]) * 1000 + 60000,
  }));
}

/**
 * Fetch from Gate.io FUTURES (Perpetual Contracts)
 * No rate limit - free to use
 */
export async function fetchGateioFuturesKlines(symbolPair: string, limit = 200): Promise<Kline[]> {
  const contract = symbolPair.replace('USDT', '_USDT');
  const url = `https://api.gateio.ws/api/v4/futures/usdt/candlesticks?contract=${contract}&interval=1m&limit=${limit}`;
  
  const res = await fetch(url, {
    next: { revalidate: 0 },
    headers: { 'User-Agent': 'llm-trading/1.0' },
  });
  
  if (!res.ok) throw new Error(`Gate.io Futures klines failed: ${res.status}`);
  
  const raw = await res.json();
  
  // Gate.io Futures returns: [{t, v, c, h, l, o}, ...]
  return (raw || []).map((candle: any) => ({
    openTime: Number(candle.t) * 1000,
    open: toNum(candle.o),
    high: toNum(candle.h),
    low: toNum(candle.l),
    close: toNum(candle.c),
    volume: toNum(candle.v),
    closeTime: Number(candle.t) * 1000 + 60000,
  }));
}

/**
 * Fetch from Binance FUTURES (USDT-M Perpetual)
 * No rate limit - free to use
 */
export async function fetchBinanceFuturesKlines(symbolPair: string, limit = 200): Promise<Kline[]> {
  const url = `https://fapi.binance.com/fapi/v1/klines?symbol=${encodeURIComponent(symbolPair)}&interval=1m&limit=${limit}`;
  
  const res = await fetch(url, {
    next: { revalidate: 0 },
    headers: { 'User-Agent': 'llm-trading/1.0' },
  });
  
  if (!res.ok) throw new Error(`Binance Futures klines failed: ${res.status}`);
  
  const raw = await res.json();
  return parseRawKlines(raw);
}

/**
 * Fetch from Bybit FUTURES (Linear Perpetual)
 * No rate limit - free to use
 */
export async function fetchBybitFuturesKlines(symbolPair: string, limit = 200): Promise<Kline[]> {
  const url = `https://api.bybit.com/v5/market/kline?category=linear&symbol=${encodeURIComponent(symbolPair)}&interval=1&limit=${limit}`;
  
  const res = await fetch(url, {
    next: { revalidate: 0 },
    headers: { 'User-Agent': 'llm-trading/1.0' },
  });
  
  if (!res.ok) throw new Error(`Bybit Futures klines failed: ${res.status}`);
  
  const data = await res.json();
  
  // Bybit returns: {result: {list: [[timestamp, open, high, low, close, volume, turnover], ...]}}
  const list = data?.result?.list || [];
  
  return list.map((r: any[]) => ({
    openTime: Number(r[0]),
    open: toNum(r[1]),
    high: toNum(r[2]),
    low: toNum(r[3]),
    close: toNum(r[4]),
    volume: toNum(r[5]),
    closeTime: Number(r[0]) + 60000,
  })).reverse(); // Bybit returns newest first, reverse to oldest first
}

export function symbolToPair(symbol: string): string {
  const s = symbol?.toUpperCase();
  switch (s) {
    case 'BTC':
      return 'BTCUSDT';
    case 'BNB':
      return 'BNBUSDT';
    case 'GIGGLE':
      return 'GIGGLEUSDT';
    case 'ASTER':
      return 'ASTERUSDT';
    default:
      return `${s}USDT`;
  }
}

/**
 * Convert symbol to Gate.io pair format (e.g., BTC -> btc_usdt)
 */
export function symbolToGatePair(symbol: string): string {
  const s = symbol?.toUpperCase();
  switch (s) {
    case 'BTC':
      return 'btc_usdt';
    case 'BNB':
      return 'bnb_usdt';
    case 'GIGGLE':
      return 'giggle_usdt';
    case 'ASTER':
      return 'aster_usdt';
    default:
      return `${s.toLowerCase()}_usdt`;
  }
}

export interface TickerPrice {
  symbol: string;
  price: number;
  volume24h?: number;
  change24h?: number;
  high24h?: number;
  low24h?: number;
  timestamp?: number;
}

/**
 * Fetch all tickers from Gate.io API v2
 * Returns all trading pairs at once (cached 20 seconds on Gate.io side)
 * FREE - No API key required
 * 
 * Response format:
 * {
 *   "btc_usdt": {
 *     "result": "true",
 *     "last": "67234.50",
 *     "lowestAsk": "67235.00",
 *     "highestBid": "67234.00",
 *     "percentChange": "2.5",
 *     "baseVolume": "12345.67",
 *     "quoteVolume": "830000000",
 *     "high24hr": "68000.00",
 *     "low24hr": "65000.00"
 *   }
 * }
 */
export async function fetchGateioTickers(): Promise<Record<string, TickerPrice>> {
  const url = 'https://data.gateapi.io/api2/1/tickers';
  
  const res = await fetch(url, {
    next: { revalidate: 0 },
    headers: { 'User-Agent': 'llm-trading/1.0' },
  });
  
  if (!res.ok) throw new Error(`Gate.io tickers failed: ${res.status}`);
  
  const data = await res.json();
  
  const tickers: Record<string, TickerPrice> = {};
  
  for (const [pair, ticker] of Object.entries(data)) {
    const t = ticker as any;
    
    // Skip if result is not "true" or if no valid data
    if (t.result !== 'true' && t.result !== true) {
      continue;
    }
    
    const price = parseFloat(t.last || '0');
    const volume = parseFloat(t.baseVolume || '0');
    const change = parseFloat(t.percentChange || '0');
    const high = parseFloat(t.high24hr || '0');
    const low = parseFloat(t.low24hr || '0');
    
    // Only add if we have a valid price
    if (price > 0) {
      tickers[pair] = {
        symbol: pair,
        price,
        volume24h: volume,
        change24h: change,
        high24h: high,
        low24h: low,
        timestamp: Date.now(),
      };
    }
  }
  
  return tickers;
}

/**
 * Fetch ticker price for specific symbols from Gate.io
 * @param symbols - Array of symbols like ['BTC', 'BNB', 'ASTER', 'GIGGLE']
 * @returns Array of ticker prices
 */
export async function fetchGateioPrices(symbols: string[]): Promise<TickerPrice[]> {
  const allTickers = await fetchGateioTickers();
  
  return symbols.map(symbol => {
    const gatePair = symbolToGatePair(symbol);
    const ticker = allTickers[gatePair];
    
    if (!ticker) {
      console.warn(`[Gate.io] Ticker not found for ${symbol} (${gatePair})`);
      return {
        symbol,
        price: 0,
        timestamp: Date.now(),
      };
    }
    
    return {
      ...ticker,
      symbol, // Use original symbol format
    };
  });
}

/**
 * Fetch single ticker price from Gate.io
 * @param symbol - Symbol like 'BTC', 'BNB', 'ASTER', 'GIGGLE'
 */
export async function fetchGateioPrice(symbol: string): Promise<number> {
  const prices = await fetchGateioPrices([symbol]);
  return prices[0]?.price || 0;
}
