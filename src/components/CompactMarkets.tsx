"use client";
import React from "react";
import MarketTile from "@/components/MarketTile";

const symbols = ["BTC", "GIGGLE", "ASTER", "BNB"] as const;

export default function CompactMarkets() {
  // Track readiness per-symbol agar bisa tampilkan skeleton per tile
  const [loaded, setLoaded] = React.useState<Record<string, boolean>>({});

  const markReady = (s: (typeof symbols)[number]) =>
    setLoaded((prev) => ({ ...prev, [s]: true }));

  return (
    <div className="relative">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-2 gap-6 items-stretch">
        {symbols.map((s) => (
          <div className="h-full relative" key={s}>
            {/* Skeleton tile muncul sampai tile siap, tanpa overlay global */}
            {!loaded[s] && (
              <div className="rounded-xl bg-black/80 border border-slate-800/50 p-3 text-[11px] shadow-lg backdrop-blur-sm overflow-hidden animate-pulse">
                <div className="h-[130px] mb-2 bg-slate-800/40 rounded" />
                <div className="grid grid-cols-3 gap-x-1 gap-y-1.5 mt-2">
                  {Array.from({ length: 9 }).map((_, i) => (
                    <div key={i} className="bg-gray-600/30 rounded px-1.5 py-1 border-l border-slate-700/30">
                      <div className="h-3 w-10 bg-slate-700/40 rounded mb-1" />
                      <div className="h-3 w-16 bg-slate-700/40 rounded" />
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className={!loaded[s] ? "absolute inset-0 opacity-0 pointer-events-none" : "relative"}>
              <MarketTile symbol={s} onReady={() => markReady(s)} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
