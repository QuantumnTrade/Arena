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
