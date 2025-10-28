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
