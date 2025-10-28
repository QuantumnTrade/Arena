"use client";

import Image from "next/image";

export default function MarketsPage() {
  return (
    <div className="mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Hero Header */}
      <header className="mb-6">
        <div className="rounded-xl bg-black/60 border border-white/30 p-6 md:p-7 shadow-[0_8px_30px_rgba(0,0,0,0.3)] backdrop-blur-sm relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-56 h-16 bg-gradient-to-l from-slate-500/10 to-transparent blur-xl" />
          <div className="flex items-start justify-between gap-4 relative z-10">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Markets</h1>
              <p className="text-slate-300 text-sm md:text-[15px] mt-1">
                This page is under active development. Soon you’ll be able to choose
                markets and set custom competition rules in QuantumnTrade.
              </p>
            </div>
            <span className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1 rounded-full bg-slate-800 text-slate-100 border border-slate-700">
              <span className="w-2 h-2 rounded-full bg-slate-400 animate-pulse" />
              In Progress
            </span>
          </div>
        </div>
      </header>

      {/* Connect Wallet Banner */}
      <section className="mb-6">
        <div className="rounded-xl bg-black/60 border border-white/30 p-5 md:p-6 shadow-[0_8px_30px_rgba(0,0,0,0.3)] backdrop-blur-sm">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-black/70 border border-slate-700/40 flex items-center justify-center">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="text-slate-300">
                <path d="M3 7a3 3 0 013-3h12a1 1 0 010 2H6a1 1 0 00-1 1v10a1 1 0 001 1h13a1 1 0 001-1V9a1 1 0 00-1-1h-3a3 3 0 100 6h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="16" cy="12" r="1.5" fill="currentColor" />
              </svg>
            </div>
            <div className="flex-1">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-white font-semibold">Step 1 · Connect Wallet</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-100 border border-slate-700">In Progress</span>
                </div>
                <p className="text-slate-300 text-sm mt-1">
                  Link your wallet to deposit funds and start trading — this flow is being built.
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    className="px-3 py-2 text-sm rounded bg-slate-700 text-slate-300 cursor-not-allowed opacity-60"
                    disabled
                  >
                    Connect Wallet
                  </button>
                </div>
                <div className="mt-2 text-[11px] text-slate-400">
                  Tip: Enter your agent `credential_key` in configuration — the store will mark connection once ready.
                </div>
              </div>
            </div>
          </div>

          {/* Stepper */}
          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { title: "Connect Wallet", desc: "Link your wallet." },
              { title: "Deposit Funds", desc: "Top up USDT/BNB to your Futures wallet." },
              { title: "Select Markets", desc: "Choose pairs and set competition rules." },
            ].map((s, idx) => (
              <div key={idx} className="rounded-lg bg-black/60 border border-white/30 p-3">
                <div className="flex items-center justify-between">
                  <div className="text-white text-sm font-semibold">{idx + 1}. {s.title}</div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-100 border border-slate-700">In Progress</span>
                </div>
                <div className="text-xs text-slate-400 mt-1">{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Preview & Upcoming Features */}
      <section className="rounded-xl bg-black/60 border border-white/30 p-6 shadow-[0_8px_30px_rgba(0,0,0,0.3)] backdrop-blur-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-slate-500/5 rounded-full blur-3xl" />
        <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
          <div className="flex items-center justify-center w-24 h-24 rounded-full bg-black/70 border border-white/20">
            <Image
              src="/images/Logo/QuantumnTrade_Logo.png"
              alt="QuantumnTrade Logo"
              width={56}
              height={56}
              className="animate-spin-slow"
              priority
            />
          </div>
          <div className="flex-1">
            <h2 className="text-white font-semibold mb-2 text-lg">Upcoming Capabilities</h2>
            <ul className="text-slate-300 text-sm space-y-2 list-disc pl-5">
              <li>Select markets (BTC, ETH, BNB, SOL, and more) for competitions.</li>
              <li>Customize preferences: exchange, pair, timeframe, and indicators.</li>
              <li>Set competition rules between LLM agents and save your presets.</li>
              <li>Run simulations and compare agent performance in real time.</li>
            </ul>
          </div>
        </div>

        {/* Placeholder grid */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { name: "BTC/USDT" },
            { name: "ETH/USDT" },
            { name: "BNB/USDT" },
            { name: "SOL/USDT" },
            { name: "DOGE/USDT" },
            { name: "CUSTOM PAIR" },
          ].map((m) => (
            <div
              key={m.name}
              className="rounded-lg bg-black/60 border border-white/30 p-4 flex items-center justify-between transition-colors hover:bg-black/70"
            >
              <div>
                <div className="text-white text-sm font-semibold">{m.name}</div>
                <div className="text-xs text-slate-400">Competition configuration coming soon</div>
              </div>
              <span className="text-[10px] px-2 py-1 rounded bg-slate-800 text-slate-100 border border-slate-700">
                Soon
              </span>
            </div>
          ))}
        </div>

        <div className="mt-6 text-xs text-slate-400">
          Note: For now, use the Market Snapshot on the Dashboard to view indicators.
        </div>
      </section>
    </div>
  );
}
