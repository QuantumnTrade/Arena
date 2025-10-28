import { fetchMarketSnapshot } from "./api";
import type { SymbolCode } from "@/types";

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
  const symbols: SymbolCode[] = ["BTC", "GIGGLE", "ASTER", "BNB"];

  const marketDataPromises = symbols.map(async (symbol) => {
    try {
      // Fetch snapshot (preferred) and fallbacks if necessary
      const snapshot = await fetchMarketSnapshot(symbol);
      const intervals = snapshot?.intervals || {};
      const i1m =
        intervals["1m"] || intervals["1M"] || intervals["oneMinute"] || {};
      const macdValue =
        typeof i1m.macd === "number"
          ? i1m.macd
          : typeof i1m.macd?.value === "number"
          ? i1m.macd.value
          : undefined;

      // Normalize numeric values and avoid invalid zeros
      const normalize = (v: any): number | undefined => {
        const num = Number(v);
        return Number.isFinite(num) && num > 0 ? num : undefined;
      };

      const price = snapshot?.price ?? 0;
      const sma1m = normalize(i1m.sma ?? i1m.sma1m) ?? (price || undefined);
      const ema1m = normalize(i1m.ema ?? i1m.ema1m) ?? (price || undefined);

      return {
        symbol,
        price,
        indicators: {
          sma1m,
          ema1m,
          rsi: i1m.rsi,
          macd: macdValue,
          atr: i1m.atr,
          ao: i1m.ao,
          vol: i1m.volume ?? i1m.vol,
          obv: i1m.obv,
          sup: i1m.support ?? i1m.sup,
        },
        timestamp:
          snapshot?.data_timestamp ||
          snapshot?.timestamp ||
          new Date().toISOString(),
      };
    } catch (error) {
      console.error(
        `[Market Service] Failed to fetch data for ${symbol}:`,
        error
      );
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
export async function fetchMarketDataForSymbol(
  symbol: SymbolCode
): Promise<MarketSnapshot> {
  try {
    const snapshot = await fetchMarketSnapshot(symbol);
    const intervals = snapshot?.intervals || {};
    const i1m =
      intervals["1m"] || intervals["1M"] || intervals["oneMinute"] || {};
    const macdValue =
      typeof i1m.macd === "number"
        ? i1m.macd
        : typeof i1m.macd?.value === "number"
        ? i1m.macd.value
        : undefined;

    const normalize = (v: any): number | undefined => {
      const num = Number(v);
      return Number.isFinite(num) && num > 0 ? num : undefined;
    };

    const price = snapshot?.price ?? 0;
    const sma1m = normalize(i1m.sma ?? i1m.sma1m) ?? (price || undefined);
    const ema1m = normalize(i1m.ema ?? i1m.ema1m) ?? (price || undefined);

    return {
      symbol,
      price,
      indicators: {
        sma1m,
        ema1m,
        rsi: i1m.rsi,
        macd: macdValue,
        atr: i1m.atr,
        ao: i1m.ao,
        vol: i1m.volume ?? i1m.vol,
        obv: i1m.obv,
        sup: i1m.support ?? i1m.sup,
      },
      timestamp:
        snapshot?.data_timestamp ||
        snapshot?.timestamp ||
        new Date().toISOString(),
    };
  } catch (error) {
    console.error(
      `[Market Service] Failed to fetch data for ${symbol}:`,
      error
    );
    throw error;
  }
}
