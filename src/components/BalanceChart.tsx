"use client";
import React, { useEffect, useRef } from 'react';
import type { Snapshot } from '@/types';

interface Props {
  snapshots?: Snapshot[];
  loading?: boolean;
}

export default function BalanceChart({ snapshots, loading }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    let chart: any;
    let area: any;
    let remove: () => void = () => {};

    (async () => {
      const lib = await import('lightweight-charts');
      chart = lib.createChart(containerRef.current!, {
        width: containerRef.current!.clientWidth,
        height: 360,
        layout: {
          background: { type: lib.ColorType.Solid, color: 'transparent' },
          textColor: '#e5e7eb',
        },
        grid: {
          vertLines: { color: '#1f2937' },
          horzLines: { color: '#1f2937' },
        },
        timeScale: { borderColor: '#1f2937' },
        rightPriceScale: { borderColor: '#1f2937' },
      });

      area = chart.addSeries(lib.AreaSeries, {
        lineColor: '#9ca3af',
        topColor: 'rgba(156, 163, 175, 0.35)',
        bottomColor: 'rgba(156, 163, 175, 0.05)',
      });

      if (snapshots?.length) {
        // Map ke detik unix, urutkan asc, lalu deduplikasi timestamp yang sama
        const mapped = snapshots.map((s) => ({
          time: Math.floor(new Date(s.snapshot_time).getTime() / 1000),
          value: s.total_balance,
        }));
        const sorted = mapped.sort((a, b) => a.time - b.time);
        const filtered = sorted.filter((d) => Number.isFinite(d.time) && Number.isFinite(d.value));
        const dedup: { time: number; value: number }[] = [];
        let lastTime = -Infinity;
        for (const d of filtered) {
          if (d.time !== lastTime) {
            dedup.push(d);
            lastTime = d.time;
          } else {
            // Jika ada timestamp sama, ambil data terakhir
            dedup[dedup.length - 1] = d;
          }
        }
        if (dedup.length > 0) {
          area.setData(dedup);
        }
      }

      const handleResize = () => {
        chart.applyOptions({ width: containerRef.current!.clientWidth });
      };
      window.addEventListener('resize', handleResize);
      remove = () => {
        window.removeEventListener('resize', handleResize);
        chart.remove();
      };
    })();

    return () => remove();
  }, [snapshots]);

  return (
    <div>
      {loading && <div className="text-xs text-slate-400 mb-2">Loading portfolio balance…</div>}
      <div ref={containerRef} className="w-full h-[280px]" />
    </div>
  );
}
