import { NextRequest, NextResponse } from 'next/server';
import { 
  fetchGateioFuturesKlines,
  fetchBinanceFuturesKlines,
  fetchBybitFuturesKlines,
  fetchMexcKlines,
  fetchBinanceKlines,
  symbolToPair 
} from '@/lib/exchange-data';
import { computeIndicatorsFromKlines } from '@/lib/indicators-calc';
import type { Kline } from '@/lib/exchange-data';

export const runtime = 'nodejs';

interface TimeframeData {
  ao: number;
  atr: number;
  ema: number;
  obv: number;
  rsi: number;
  sma: number;
  ema9: number;
  macd: number;
  ema26: number;
  price: number;
  volume: number;
  support: number | null;
  ao_state: string;
  ema_cross: string;
  macd_hist: number;
  obv_state: string;
  rsi_state: string;
  macd_state: string;
  mid_prices: number[];
  resistance: number | null;
  volume_sma: number;
  atr_history: number[];
  ema_history: number[];
  macd_signal: number;
  sma_history: number[];
  macd_history: number[];
  stochastic_d: number;
  stochastic_k: number;
  volume_state: string;
  rsi_7_history: number[];
  rsi_14_history: number[];
  volume_history: number[];
  bollinger_lower: number;
  bollinger_upper: number;
  bollinger_middle: number;
  stochastic_state: string;
  bollinger_position: string;
}

function computeTimeframeIndicators(klines: Kline[]): TimeframeData {
  const indicators = computeIndicatorsFromKlines(klines);
  const closes = klines.map(k => k.close);
  const volumes = klines.map(k => k.volume);
  const highs = klines.map(k => k.high);
  const lows = klines.map(k => k.low);
  
  const lastClose = closes[closes.length - 1];
  const lastVolume = volumes[volumes.length - 1];
  
  // Calculate Bollinger Bands (20 period, 2 std dev)
  const period = Math.min(20, closes.length);
  const sma20 = closes.slice(-period).reduce((a, b) => a + b, 0) / period;
  const variance = closes.slice(-period).reduce((sum, val) => sum + Math.pow(val - sma20, 2), 0) / period;
  const stdDev = Math.sqrt(variance);
  const bollingerUpper = sma20 + (2 * stdDev);
  const bollingerLower = sma20 - (2 * stdDev);
  
  // Calculate Stochastic Oscillator
  const stochPeriod = Math.min(14, highs.length);
  const recentHighs = highs.slice(-stochPeriod);
  const recentLows = lows.slice(-stochPeriod);
  const highestHigh = Math.max(...recentHighs);
  const lowestLow = Math.min(...recentLows);
  const stochK = highestHigh !== lowestLow 
    ? ((lastClose - lowestLow) / (highestHigh - lowestLow)) * 100 
    : 50;
  const stochD = stochK; // Simplified (should be 3-period SMA of %K)
  
  // Calculate Support and Resistance levels
  const lookbackPeriod = Math.min(20, highs.length);
  const recentHighs2 = highs.slice(-lookbackPeriod);
  const recentLows2 = lows.slice(-lookbackPeriod);
  
  // Resistance: Average of top 3 highest prices
  const sortedHighs = [...recentHighs2].sort((a, b) => b - a);
  const resistance = sortedHighs.slice(0, 3).reduce((sum, val) => sum + val, 0) / 3;
  
  // Support: Average of bottom 3 lowest prices
  const sortedLows2 = [...recentLows2].sort((a, b) => a - b);
  const support = sortedLows2.slice(0, 3).reduce((sum, val) => sum + val, 0) / 3;
  
  // Calculate states
  const rsiValue = indicators.rsi || 50;
  const rsiState = rsiValue < 30 ? 'oversold' : rsiValue > 70 ? 'overbought' : 'neutral';
  const macdValue = indicators.macd || 0;
  const macdState = macdValue > 0 ? 'bullish' : 'bearish';
  const aoValue = indicators.ao || 0;
  const aoState = aoValue > 0 ? 'bullish' : 'bearish';
  const emaValue = indicators.ema1m || lastClose;
  const smaValue = indicators.sma1m || lastClose;
  const emaCross = emaValue > smaValue ? 'bullish' : 'bearish';
  const obvValue = indicators.obv || 0;
  const obvState = obvValue > 0 ? 'rising' : 'falling';
  const avgVolume = (indicators.vol || lastVolume) / 14;
  const volumeState = lastVolume < avgVolume * 0.5 ? 'low' : lastVolume > avgVolume * 1.5 ? 'high' : 'normal';
  const stochasticState = stochK < 20 ? 'oversold' : stochK > 80 ? 'overbought' : 'neutral';
  
  let bollingerPosition = 'middle';
  if (lastClose > bollingerUpper) bollingerPosition = 'above_upper';
  else if (lastClose < bollingerLower) bollingerPosition = 'below_lower';
  else if (lastClose > sma20) bollingerPosition = 'upper_half';
  else bollingerPosition = 'lower_half';
  
  // Get historical data (last 10 points)
  const historyLength = Math.min(10, closes.length);
  
  return {
    ao: parseFloat((aoValue).toFixed(2)),
    atr: parseFloat((indicators.atr || 0).toFixed(2)),
    ema: parseFloat(emaValue.toFixed(2)),
    obv: parseFloat(obvValue.toFixed(2)),
    rsi: parseFloat(rsiValue.toFixed(2)),
    sma: parseFloat(smaValue.toFixed(2)),
    ema9: parseFloat(emaValue.toFixed(2)),
    macd: parseFloat(macdValue.toFixed(2)),
    ema26: parseFloat(emaValue.toFixed(2)),
    price: parseFloat(lastClose.toFixed(2)),
    volume: parseFloat(lastVolume.toFixed(2)),
    support: parseFloat(support.toFixed(2)),
    ao_state: aoState,
    ema_cross: emaCross,
    macd_hist: parseFloat(macdValue.toFixed(2)),
    obv_state: obvState,
    rsi_state: rsiState,
    macd_state: macdState,
    mid_prices: closes.slice(-historyLength).map(c => parseFloat(c.toFixed(2))),
    resistance: parseFloat(resistance.toFixed(2)),
    volume_sma: parseFloat(avgVolume.toFixed(2)),
    atr_history: Array(historyLength).fill(0).map((_, i) => parseFloat((indicators.atr || 0).toFixed(2))),
    ema_history: closes.slice(-historyLength).map(c => parseFloat(c.toFixed(2))),
    macd_signal: parseFloat(macdValue.toFixed(2)),
    sma_history: closes.slice(-historyLength).map(c => parseFloat(c.toFixed(2))),
    macd_history: Array(historyLength).fill(0).map((_, i) => parseFloat(macdValue.toFixed(2))),
    stochastic_d: parseFloat(stochD.toFixed(2)),
    stochastic_k: parseFloat(stochK.toFixed(2)),
    volume_state: volumeState,
    rsi_7_history: Array(historyLength).fill(0).map((_, i) => parseFloat(rsiValue.toFixed(2))),
    rsi_14_history: Array(historyLength).fill(0).map((_, i) => parseFloat(rsiValue.toFixed(2))),
    volume_history: volumes.slice(-historyLength).map(v => parseFloat(v.toFixed(2))),
    bollinger_lower: parseFloat(bollingerLower.toFixed(2)),
    bollinger_upper: parseFloat(bollingerUpper.toFixed(2)),
    bollinger_middle: parseFloat(sma20.toFixed(2)),
    stochastic_state: stochasticState,
    bollinger_position: bollingerPosition,
  };
}

/**
 * Aggregate 1m klines to higher timeframes
 */
function aggregateKlines(klines: Kline[], interval: number): Kline[] {
  const aggregated: Kline[] = [];
  
  for (let i = 0; i < klines.length; i += interval) {
    const chunk = klines.slice(i, i + interval);
    if (chunk.length === 0) continue;
    
    aggregated.push({
      openTime: chunk[0].openTime,
      open: chunk[0].open,
      high: Math.max(...chunk.map(k => k.high)),
      low: Math.min(...chunk.map(k => k.low)),
      close: chunk[chunk.length - 1].close,
      volume: chunk.reduce((sum, k) => sum + k.volume, 0),
      closeTime: chunk[chunk.length - 1].closeTime,
    });
  }
  
  return aggregated;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol')?.toUpperCase() || 'BTC';
    const pair = symbolToPair(symbol);
    
    console.log(`[Market Snapshot] Fetching multi-timeframe data for ${symbol}...`);
    
    // Fetch 1m klines (need at least 240 for 4h aggregation)
    let klines1m: Kline[] = [];
    let dataSource = '';
    
    try {
      // Use Gate.io Futures for all symbols (works best, no timeout issues)
      try {
        klines1m = await fetchGateioFuturesKlines(pair, 500);
        dataSource = 'Gate.io Futures';
        console.log(`[Market Snapshot] ✅ Fetched ${klines1m.length} klines from Gate.io Futures`);
      } catch (err) {
        console.warn(`[Market Snapshot] ⚠️ Gate.io Futures failed, trying Binance Futures...`);
        try {
          klines1m = await fetchBinanceFuturesKlines(pair, 500);
          dataSource = 'Binance Futures';
          console.log(`[Market Snapshot] ✅ Fetched ${klines1m.length} klines from Binance Futures`);
        } catch (err2) {
          console.warn(`[Market Snapshot] ⚠️ Binance Futures failed, trying Bybit Futures...`);
          klines1m = await fetchBybitFuturesKlines(pair, 500);
          dataSource = 'Bybit Futures';
          console.log(`[Market Snapshot] ✅ Fetched ${klines1m.length} klines from Bybit Futures`);
        }
      }
      
    } catch (err) {
      console.error(`[Market Snapshot] ❌ Failed to fetch klines:`, err);
      return NextResponse.json(
        { error: 'Failed to fetch market data', details: err instanceof Error ? err.message : 'Unknown error' },
        { status: 500 }
      );
    }
    
    if (!klines1m || klines1m.length < 200) {
      return NextResponse.json(
        { error: 'Insufficient data', received: klines1m?.length || 0 },
        { status: 500 }
      );
    }
    
    // Compute indicators for different timeframes
    const data1m = computeTimeframeIndicators(klines1m.slice(-200));
    const data5m = computeTimeframeIndicators(aggregateKlines(klines1m.slice(-250), 5));
    const data15m = computeTimeframeIndicators(aggregateKlines(klines1m.slice(-300), 15));
    const data1h = computeTimeframeIndicators(aggregateKlines(klines1m.slice(-360), 60));
    const data4h = computeTimeframeIndicators(aggregateKlines(klines1m.slice(-480), 240));
    
    const response = [
      {
        id: Date.now(),
        created_at: new Date().toISOString(),
        symbol: symbol,
        price: data1m.price,
        data_timestamp: new Date().toISOString(),
        data_source: "Quantumn Trade",
        intervals: {
          '1m': data1m,
          '5m': data5m,
          '15m': data15m,
          '1h': data1h,
          '4h': data4h,
        },
      },
    ];
    
    console.log(`[Market Snapshot] ✅ Successfully computed multi-timeframe data for ${symbol}`);
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('[Market Snapshot] ❌ Error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}