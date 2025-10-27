import { fetchTicker, fetchIndicators } from './api';
import type { SymbolCode } from '@/types';

/**
 * Market Data Service
 * 
 * Aggregates market data from multiple sources for AI analysis
 */

export interface MarketSnapshot {
  symbol: string;
  price: number;
  indicators?: any;
  timeframes?: any;
  timestamp: string;
}

/**
 * Fetch comprehensive market data for all trading symbols
 */
export async function fetchMarketDataForAI(): Promise<MarketSnapshot[]> {
  const symbols: SymbolCode[] = ['BTC', 'GIGGLE', 'ASTER', 'BNB'];
  
  const marketDataPromises = symbols.map(async (symbol) => {
    try {
      // Fetch ticker and indicators in parallel
      const [ticker, indicators] = await Promise.all([
        fetchTicker(symbol),
        fetchIndicators(symbol),
      ]);

      return {
        symbol,
        price: ticker.price,
        indicators: {
          sma1m: indicators.sma1m,
          ema1m: indicators.ema1m,
          rsi: indicators.rsi,
          macd: indicators.macd,
          atr: indicators.atr,
          ao: indicators.ao,
          vol: indicators.vol,
          obv: indicators.obv,
          sup: indicators.sup,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`[Market Service] Failed to fetch data for ${symbol}:`, error);
      // Return minimal data on error
      return {
        symbol,
        price: 0,
        timestamp: new Date().toISOString(),
      };
    }
  });

  return Promise.all(marketDataPromises);
}

/**
 * Fetch market data for a specific symbol
 */
export async function fetchMarketDataForSymbol(symbol: SymbolCode): Promise<MarketSnapshot> {
  try {
    const [ticker, indicators] = await Promise.all([
      fetchTicker(symbol),
      fetchIndicators(symbol),
    ]);

    return {
      symbol,
      price: ticker.price,
      indicators: {
        sma1m: indicators.sma1m,
        ema1m: indicators.ema1m,
        rsi: indicators.rsi,
        macd: indicators.macd,
        atr: indicators.atr,
        ao: indicators.ao,
        vol: indicators.vol,
        obv: indicators.obv,
        sup: indicators.sup,
      },
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`[Market Service] Failed to fetch data for ${symbol}:`, error);
    throw error;
  }
}
