"use client";
import React, { useEffect, useRef } from 'react';

declare global {
  interface Window {
    TradingView?: any;
  }
}

interface ChartPanelProps {
  symbol?: 'BTC' | 'ETH' | 'SOL' | 'BNB' | 'GIGGLE' | 'ASTER';
  loading?: boolean;
}

function mapToTVSymbol(sym?: string): string {
  switch (sym) {
    case 'GIGGLE': return 'MEXC:GIGGLEUSDT';
    case 'ASTER': return 'BINANCE:ASTERUSDT';
    case 'ETH': return 'BINANCE:ETHUSDT';
    case 'SOL': return 'BINANCE:SOLUSDT';
    case 'BNB': return 'BINANCE:BNBUSDT';
    case 'BTC':
    default: return 'BINANCE:BTCUSDT';
  }
}

export default function ChartPanel({ symbol, loading }: ChartPanelProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetRef = useRef<any>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const ensureScript = () => new Promise<void>((resolve) => {
      if (window.TradingView && window.TradingView.widget) {
        resolve();
        return;
      }
      const existing = document.getElementById('tradingview-widget-script') as HTMLScriptElement | null;
      if (existing) {
        existing.addEventListener('load', () => resolve());
        return;
      }
      const script = document.createElement('script');
      script.id = 'tradingview-widget-script';
      script.src = 'https://s3.tradingview.com/tv.js';
      script.async = true;
      script.onload = () => resolve();
      document.head.appendChild(script);
    });

    let disposed = false;
    (async () => {
      await ensureScript();
      if (disposed) return;
      container.innerHTML = '';
      const containerId = `tv-chart-${mapToTVSymbol(symbol).replace(':','-')}`;
      container.id = containerId;
      
      widgetRef.current = new window.TradingView.widget({
        symbol: mapToTVSymbol(symbol),
        interval: '60',
        timezone: 'Etc/UTC',
        theme: 'dark',
        style: '1',
        locale: 'en',
        autosize: true,
        hide_side_toolbar: false,
        allow_symbol_change: false,
        container_id: containerId,
        studies: [],
      });
    })();

    return () => {
      disposed = true;
      if (container) container.innerHTML = '';
      widgetRef.current = null;
    };
  }, [symbol]);

  return (
    <div className="rounded-xl bg-black/90 border border-slate-800 p-3">
      {loading && <div className="text-xs text-slate-400 mb-2">Loading chart…</div>}
      <div ref={containerRef} className="w-full h-[360px]" />
    </div>
  );
}
