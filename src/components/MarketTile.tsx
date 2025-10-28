"use client";
import React, { useEffect, useRef } from "react";
import useSWR from "swr";
import { fetchIndicators, fetchTicker } from "@/lib/api";
import type { Indicators, Ticker } from "@/types";

function formatNumber(n?: number, opts: Intl.NumberFormatOptions = {}) {
  if (n === undefined || n === null) return "-";
  if (typeof n === "number" && Number.isNaN(n)) return "-";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    ...opts,
  }).format(n);
}

function mapToTVSymbol(sym: string) {
  switch (sym) {
    case "GIGGLE":
      return "MEXC:GIGGLEUSDT";
    case "ASTER":
      return "BINANCE:ASTERUSDT";
    case "ETH":
      return "BINANCE:ETHUSDT";
    case "SOL":
      return "BINANCE:SOLUSDT";
    case "BNB":
      return "BINANCE:BNBUSDT";
    case "BTC":
    default:
      return "BINANCE:BTCUSDT";
  }
}

// Perubahan indikator dengan warna persist + flash
function ChangeIndicator({
  id,
  field,
  value,
  formatOpts,
  signColor,
}: {
  id: string;
  field: string;
  value?: number;
  formatOpts?: Intl.NumberFormatOptions;
  signColor?: boolean;
}) {
  const prev = React.useRef<number | undefined>(undefined);
  const [flash, setFlash] = React.useState<"up" | "down" | null>(null);

  React.useEffect(() => {
    const p = prev.current;
    if (typeof p === "number" && typeof value === "number") {
      if (value > p) setFlash("up");
      else if (value < p) setFlash("down");
      else setFlash(null);
      const t = setTimeout(() => setFlash(null), 800);
      return () => clearTimeout(t);
    }
    prev.current = value;
  }, [id, field, value]);

  React.useEffect(() => {
    prev.current = value;
  }, [value]);

  const baseColor = signColor
    ? typeof value === "number"
      ? value > 0
        ? "text-green-400"
        : value < 0
        ? "text-red-400"
        : "text-slate-300"
      : "text-slate-300"
    : typeof prev.current === "number" && typeof value === "number"
    ? value > (prev.current as number)
      ? "text-green-400"
      : value < (prev.current as number)
      ? "text-red-400"
      : "text-slate-300"
    : "text-slate-300";
  const flashCls =
    flash === "up" ? "flash-up" : flash === "down" ? "flash-down" : "";

  // Digit roll with initial mount animation
  const DigitRoll: React.FC<{ digit: number }> = ({ digit }) => {
    const items = React.useMemo(
      () => Array.from({ length: 10 }, (_, i) => i),
      []
    );
    const [mounted, setMounted] = React.useState(false);
    React.useEffect(() => {
      const t = setTimeout(() => setMounted(true), 0);
      return () => clearTimeout(t);
    }, []);
    const translate = mounted ? `translateY(-${digit}em)` : `translateY(0)`;
    return (
      <span className="digit-roll">
        <span className="digit-roll-inner" style={{ transform: translate }}>
          {items.map((d) => (
            <span key={d}>{d}</span>
          ))}
        </span>
      </span>
    );
  };

  function renderRollingText(text: string) {
    return (
      <span className="digits-tabular">
        {text.split("").map((ch, idx) => {
          const code = ch.charCodeAt(0);
          const d = code - 48;
          const isDigit = d >= 0 && d <= 9;
          return isDigit ? (
            <DigitRoll key={idx} digit={d} />
          ) : (
            <span key={idx} className="digit-static">
              {ch}
            </span>
          );
        })}
      </span>
    );
  }

  return (
    <span className={`inline-block rounded px-1 ${baseColor} ${flashCls}`}>
      {renderRollingText(formatNumber(value, formatOpts ?? {}))}
    </span>
  );
}

interface Props {
  symbol: "BTC" | "ETH" | "SOL" | "BNB" | "GIGGLE" | "ASTER";
  onReady?: (symbol: Props["symbol"]) => void;
}

export default function MarketTile({ symbol, onReady }: Props) {
  const {
    data: indicators,
    isLoading: indLoading,
    error: indError,
  } = useSWR<Indicators>(
    ["indicators", symbol],
    () => fetchIndicators(symbol),
    {
      refreshInterval: 10000,
      dedupingInterval: 15000,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      shouldRetryOnError: false,
    }
  );
  const { data: ticker } = useSWR<Ticker>(
    ["ticker", symbol],
    () => fetchTicker(symbol),
    {
      refreshInterval: 10000,
      dedupingInterval: 12000,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      shouldRetryOnError: true,
    }
  );

  // Trigger onReady sekali ketika indikator & ticker pertama kali tersedia
  const readyRef = useRef(false);
  useEffect(() => {
    if (!readyRef.current && indicators && ticker) {
      readyRef.current = true;
      onReady?.(symbol);
    }
  }, [indicators, ticker, symbol, onReady]);
  const sma = indicators?.sma1m;
  const ema = indicators?.ema1m;
  const rsi = indicators?.rsi;
  const macd = indicators?.macd;
  const atr = indicators?.atr;
  const ao = indicators?.ao;
  const vol = indicators?.vol;
  const obv = indicators?.obv;
  const sup = indicators?.sup;

  // Track last update time using client local time on data refresh
  const [lastUpdateTS, setLastUpdateTS] = React.useState<number | undefined>(
    undefined
  );
  React.useEffect(() => {
    setLastUpdateTS(Date.now());
  }, [ticker]);

  const hhmm = lastUpdateTS
    ? new Date(lastUpdateTS).toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "—";

  // Track price history for trend detection (1 minute intervals)
  const priceHistoryRef = React.useRef<{ price: number; timestamp: number }[]>(
    []
  );
  const [isBullish, setIsBullish] = React.useState<boolean | null>(null);

  // Update trend based on price comparison every 1 minute
  React.useEffect(() => {
    if (!ticker?.price) return;

    const now = Date.now();
    const currentPrice = ticker.price;

    // Add current price to history
    priceHistoryRef.current.push({ price: currentPrice, timestamp: now });

    // Keep only last 2 minutes of data (for comparison)
    const twoMinutesAgo = now - 2 * 60 * 1000;
    priceHistoryRef.current = priceHistoryRef.current.filter(
      (entry) => entry.timestamp > twoMinutesAgo
    );

    // Compare with price from 1 minute ago
    const oneMinuteAgo = now - 30 * 1000;
    const oldPrice = priceHistoryRef.current.find(
      (entry) => entry.timestamp <= oneMinuteAgo
    );

    if (oldPrice) {
      // Determine trend: bullish if price increased, bearish if decreased
      const trend = currentPrice > oldPrice.price;
      setIsBullish(trend);
    } else {
      // Not enough data yet
      setIsBullish(null);
    }
  }, [ticker?.price, symbol]);

  // TradingView mini chart embed - render once, no re-render on color change
  const tvRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = tvRef.current;
    if (!container) return;

    // Only create widget once per symbol
    container.innerHTML = "";
    const widgetSlot = document.createElement("div");
    widgetSlot.className = "tradingview-widget-container__widget";
    container.appendChild(widgetSlot);

    const script = document.createElement("script");
    script.type = "text/javascript";
    script.src =
      "https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js";
    script.async = true;

    // Use neutral gray color for chart line
    script.innerHTML = `{
      "symbol": "${mapToTVSymbol(symbol)}",
      "locale": "en",
      "dateRange": "1D",
      "colorTheme": "dark",
      "trendLineColor": "#9ca3af",
      "underLineColor": "rgba(156,163,175,0.15)",
      "isTransparent": true,
      "autosize": true,
      "largeChartUrl": ""
    }`;
    container.appendChild(script);

    return () => {
      container.innerHTML = "";
    };
  }, [symbol]); // Only re-render when symbol changes, NOT when colors change

  // Rolling text util untuk header harga
  const DigitRollHeader: React.FC<{ digit: number }> = ({ digit }) => {
    const items = React.useMemo(
      () => Array.from({ length: 10 }, (_, i) => i),
      []
    );
    const translate = `translateY(-${digit}em)`;
    return (
      <span className="digit-roll">
        <span className="digit-roll-inner" style={{ transform: translate }}>
          {items.map((d) => (
            <span key={d}>{d}</span>
          ))}
        </span>
      </span>
    );
  };
  function renderRollingHeader(text: string) {
    return (
      <span className="digits-tabular">
        {text.split("")?.map((ch, idx) => {
          const code = ch.charCodeAt(0);
          const d = code - 48;
          const isDigit = d >= 0 && d <= 9;
          return isDigit ? (
            <DigitRollHeader key={idx} digit={d} />
          ) : (
            <span key={idx} className="digit-static">
              {ch}
            </span>
          );
        })}
      </span>
    );
  }

  function HeaderPrice({ id, value }: { id: string; value?: number }) {
    const prev = React.useRef<number | undefined>(undefined);
    const [flash, setFlash] = React.useState<"up" | "down" | null>(null);
    React.useEffect(() => {
      const p = prev.current;
      if (typeof p === "number" && typeof value === "number") {
        if (value > p) setFlash("up");
        else if (value < p) setFlash("down");
        else setFlash(null);
        const t = setTimeout(() => setFlash(null), 800);
        return () => clearTimeout(t);
      }
      prev.current = value;
    }, [id, value]);
    React.useEffect(() => {
      prev.current = value;
    }, [value]);
    const flashCls =
      flash === "up" ? "flash-up" : flash === "down" ? "flash-down" : "";
    const txt = `$${formatNumber(value, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
    return (
      <span className={`inline-block rounded px-1 ${flashCls}`}>
        {renderRollingHeader(txt)}
      </span>
    );
  }

  return (
    <div className="rounded-xl bg-black/90 border border-slate-800/50 p-3 text-[11px] shadow-lg backdrop-blur-sm relative overflow-hidden group hover:border-slate-700/50 transition-all">
      {/* Decorative elements */}
      <div className="absolute -right-6 -top-6 w-12 h-12 bg-slate-500/10 rounded-full blur-xl"></div>
      <div className="absolute -left-4 -bottom-4 w-8 h-8 bg-slate-500/5 rounded-full blur-lg"></div>

      {/* TradingView Mini Chart + overlay harga */}
      <div className="relative w-full h-[130px] mb-2 bg-black/80 rounded-md overflow-hidden">
        {/* Color overlay for smooth trend indication - no widget re-render */}
        <div
          className="absolute inset-0 pointer-events-none transition-all duration-700 ease-in-out"
          style={{
            background:
              isBullish === null
                ? "linear-gradient(to top, rgba(100,100,100,0.08), transparent)"
                : isBullish
                ? "linear-gradient(to top, rgba(16,185,129,0.12), transparent)"
                : "linear-gradient(to top, rgba(239,68,68,0.12), transparent)",
            boxShadow:
              isBullish === null
                ? "inset 0 0 20px rgba(100,100,100,0.1)"
                : isBullish
                ? "inset 0 0 20px rgba(16,185,129,0.15)"
                : "inset 0 0 20px rgba(239,68,68,0.15)",
          }}
        />

        {/* Border indicator */}
        <div
          className="absolute left-0 top-0 bottom-0 w-1 transition-all duration-700 ease-in-out"
          style={{
            backgroundColor:
              isBullish === null
                ? "#6b7280"
                : isBullish
                ? "#10b981"
                : "#ef4444",
            boxShadow:
              isBullish === null
                ? "0 0 10px rgba(107,114,128,0.5)"
                : isBullish
                ? "0 0 10px rgba(16,185,129,0.5)"
                : "0 0 10px rgba(239,68,68,0.5)",
          }}
        />

        <div ref={tvRef} className="absolute inset-0 ml-1 mt-2 w-full" />
      </div>

      {/* Ringkasan indikator dari API (tetap di bawah) */}
      <div className="grid grid-cols-3 gap-x-1 gap-y-1.5 mt-2 relative">
        <div className="col-span-3 text-[10px] text-slate-400 border-b border-slate-800/50 pb-1 mb-1 flex justify-between items-center">
          <span suppressHydrationWarning>Last Update: {hhmm}</span>
          {indLoading && (
            <span className="text-slate-400 animate-pulse flex items-center gap-1">
              <svg
                className="w-3 h-3 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Refreshing...
            </span>
          )}
          {indError && (
            <span
              className="text-red-400 flex items-center gap-1"
              title="Failed to load indicators"
            >
              <svg
                className="w-3 h-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Failed
            </span>
          )}
        </div>

        <div className="bg-gray-600/30 rounded px-1.5 py-1 border-l border-slate-700/30">
          <div className="text-[9px] text-gray-400 tracking-wide ">1mSMA</div>
          <div className="text-slate-300">
            <ChangeIndicator id={symbol} field="sma1m" value={sma} />
          </div>
        </div>

        <div className="bg-gray-600/30 rounded px-1.5 py-1 border-l border-slate-700/30">
          <div className="text-[9px] text-gray-400 tracking-wide">EMA</div>
          <div className="text-slate-300">
            <ChangeIndicator id={symbol} field="ema1m" value={ema} />
          </div>
        </div>

        <div className="bg-gray-600/30 rounded px-1.5 py-1 border-l border-slate-700/30">
          <div className="text-[9px] text-gray-400 tracking-wide ">RSI</div>
          <div className="text-slate-300">
            <ChangeIndicator id={symbol} field="rsi" value={rsi} />
          </div>
        </div>

        <div className="bg-gray-600/30 rounded px-1.5 py-1 border-l border-slate-700/30">
          <div className="text-[9px] text-gray-400 tracking-wide ">MACD</div>
          <div className="text-slate-300">
            <ChangeIndicator id={symbol} field="macd" value={macd} signColor />
          </div>
        </div>

        <div className="bg-gray-600/30 rounded px-1.5 py-1 border-l border-slate-700/30">
          <div className="text-[9px] text-gray-400 tracking-wide ">ATR</div>
          <div className="text-slate-300">
            <ChangeIndicator id={symbol} field="atr" value={atr} />
          </div>
        </div>

        <div className="bg-gray-600/30 rounded px-1.5 py-1 border-l border-slate-700/30">
          <div className="text-[9px] text-gray-400 tracking-wide ">AO</div>
          <div className="text-slate-300">
            <ChangeIndicator id={symbol} field="ao" value={ao} signColor />
          </div>
        </div>

        <div className="bg-gray-600/30 rounded px-1.5 py-1 border-l border-slate-700/30">
          <div className="text-[9px] text-gray-400 tracking-wide ">VOL</div>
          <div className="text-slate-300">
            <ChangeIndicator
              id={symbol}
              field="vol"
              value={vol}
              formatOpts={{ maximumFractionDigits: 0 }}
            />
          </div>
        </div>

        <div className="bg-gray-600/30 rounded px-1.5 py-1 border-l border-slate-700/30">
          <div className="text-[9px] text-gray-400 tracking-wide ">OBV</div>
          <div className="text-slate-300">
            <ChangeIndicator
              id={symbol}
              field="obv"
              value={obv}
              formatOpts={{ maximumFractionDigits: 0 }}
              signColor
            />
          </div>
        </div>

        <div className="bg-gray-600/30 rounded px-1.5 py-1 border-l border-slate-700/30">
          <div className="text-[9px] text-gray-400 tracking-wide ">SUP</div>
          <div className="text-slate-300">
            <ChangeIndicator id={symbol} field="sup" value={sup} />
          </div>
        </div>
      </div>
    </div>
  );
}
