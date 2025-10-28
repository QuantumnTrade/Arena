import React from 'react';
import MetricCard from '@/components/MetricCard';
import type { Indicators, Ticker } from '@/types';

interface Props {
  symbol: string;
  ticker?: Ticker;
  indicators?: Indicators;
  loading?: boolean;
}

export default function TickerSummary({ symbol, ticker, indicators, loading }: Props) {
  const changeColor = (ticker?.change24h ?? 0) >= 0 ? 'text-green-400' : 'text-red-400';
  const changePrefix = (ticker?.change24h ?? 0) >= 0 ? '+' : '';

  return (
    <div className="rounded-xl bg-black/90 border border-slate-800 p-4">
      <div className="flex items-end justify-between mb-4">
        <div>
          <div className="text-sm text-slate-400">Symbol</div>
          <div className="text-2xl font-bold text-slate-100">{symbol}</div>
        </div>
        <div className="text-right">
          <div className="text-sm text-slate-400">Last Price</div>
          <div className="text-2xl font-bold text-slate-100">{ticker?.price ? `$${ticker.price.toLocaleString()}` : '-'}</div>
          <div className={`text-xs ${changeColor}`}>{ticker?.change24h !== undefined ? `${changePrefix}${ticker.change24h}%` : '-'}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        <MetricCard label="1mSMA" value={indicators?.sma1m} />
        <MetricCard label="EMA" value={indicators?.ema1m} />
        <MetricCard label="RSI" value={indicators?.rsi} />
        <MetricCard label="MACD" value={indicators?.macd} />
        <MetricCard label="ATR" value={indicators?.atr} />
        <MetricCard label="AO" value={indicators?.ao} />
        <MetricCard label="VOL" value={indicators?.vol} />
        <MetricCard label="OBV" value={indicators?.obv} />
        <MetricCard label="SUP" value={indicators?.sup} />
      </div>

      {loading && (
        <div className="mt-3 text-xs text-slate-400">Loading data…</div>
      )}
    </div>
  );
}
