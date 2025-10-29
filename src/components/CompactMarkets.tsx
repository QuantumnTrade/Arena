"use client";
import React from "react";
import MarketTile from "@/components/MarketTile";

const symbols = ["BTC", "GIGGLE", "ASTER", "BNB"] as const;

export default function CompactMarkets() {
  const [loadedCount, setLoadedCount] = React.useState(0);

  const allLoaded = loadedCount >= symbols.length;

  return (
    <div className="relative">
      {/* Overlay loading global sampai semua tile ready */}
      {!allLoaded && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 text-slate-200">
            <svg
              className="w-10 h-10 animate-spin text-slate-300"
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
            <div className="text-xs tracking-wide text-slate-300">
              Loading markets... {loadedCount}/{symbols.length}
            </div>
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-2 gap-6 items-stretch">
        {symbols.map((s) => (
          <div className="h-full" key={s}>
            <MarketTile
              symbol={s}
              onReady={() => setLoadedCount((c) => c + 1)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
