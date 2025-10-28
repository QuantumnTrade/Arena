import { NextResponse } from 'next/server';
export const runtime = 'nodejs';
import { fetchMexcKlines, fetchBinanceKlines, symbolToPair } from '@/lib/exchange-data';
import { computeIndicatorsFromKlines } from '@/lib/indicators-calc';
import { fetchTimeseries } from '@/lib/api';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const symbol = (url.searchParams.get('symbol') || 'BTC').toUpperCase();

  const pair = symbolToPair(symbol);

  let klines = null;
  try {
    // Prefer MEXC for GIGGLE as requested
    if (symbol === 'GIGGLE') {
      klines = await fetchMexcKlines(pair, 200);
    } else {
      // Try MEXC first, then Binance
      klines = await fetchMexcKlines(pair, 200);
    }
  } catch (err) {
    // Fallback to Binance if MEXC fails
    try {
      klines = await fetchBinanceKlines(pair, 200);
    } catch (err2) {
      klines = null;
    }
  }

  if (!klines || klines.length < 30) {
    // Synthetic fallback: use local timeseries to compute close-based indicators
    try {
      const points = await fetchTimeseries(symbol, '1m');
      if (points && points.length >= 30) {
        // Build pseudo-ohlc from timeseries
        const kl = points.map((p, i) => {
          const close = p.value;
          const prevClose = i > 0 ? points[i - 1].value : close;
          const drift = 0.0008; // ±0.08% random band to emulate H/L
          const high = Math.max(close, close * (1 + drift * Math.random()));
          const low = Math.min(close, close * (1 - drift * Math.random()));
          const volume = Math.max(1, Math.round(1000 + Math.random() * 500));
          return {
            openTime: p.time * 1000,
            open: prevClose,
            high,
            low,
            close,
            volume,
            closeTime: p.time * 1000 + 60000,
          };
        });
        const indicators = computeIndicatorsFromKlines(kl);
        return NextResponse.json(indicators);
      }
    } catch (e) {
      // ignore and return minimal zeros
    }
    // Minimal fallback if still unavailable
    return NextResponse.json({ sma1m: 0, ema1m: 0 });
  }

  const indicators = computeIndicatorsFromKlines(klines);
  return NextResponse.json(indicators);
}
