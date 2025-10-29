"use client";
import React from "react";
import MarketTile from "@/components/MarketTile";

const symbols = ["BTC", "ETH", "SOL", "BNB", "ASTER", "GIGGLE"] as const;

export default function CompactMarkets() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-2 gap-6 items-stretch">
      {symbols.map((s) => (
        <div className="h-full" key={s}>
          <MarketTile symbol={s} />
        </div>
      ))}
    </div>
  );
}
