"use client";

import React, { useState, useEffect } from "react";
import useSWR from "swr";
import { fetchAgents } from "@/lib/api";

import AgentsTable from "@/components/AgentsTable";
import CompactMarkets from "@/components/CompactMarkets";
import AccountValueChart from "@/components/AccountValueChart";
import AgentDetail from "@/components/AgentDetail";
import Image from "next/image";
import { useAsterAccountSync } from "@/hooks/use-aster-sync";

export default function Page() {
  const {
    data: fetchedAgents,
    isLoading: agentsLoading,
    error: agentsError,
  } = useSWR(["supabase", "agents"], fetchAgents, {
    refreshInterval: 5000, // Refresh every 5 seconds
    dedupingInterval: 5000,
    revalidateOnFocus: true, // Refresh when user returns to tab
    revalidateOnReconnect: true, // Refresh when internet reconnects
    fallbackData: [],
  });

  // Use Supabase data as-is without adding dummy agents
  const agents = React.useMemo(() => {
    return Array.isArray(fetchedAgents) ? fetchedAgents : [];
  }, [fetchedAgents]);

  // Auto-sync ASTER account every 5 seconds
  useAsterAccountSync();

  // State management
  const [isMounted, setIsMounted] = useState(false);

  // Generate quantum particles (memoized to avoid regeneration)
  const particles = React.useMemo(() => {
    if (!isMounted) return [];
    const newParticles = [];
    for (let i = 0; i < 15; i++) {
      const size = Math.floor(Math.random() * 50) + 10; // 10px - 60px
      const xPos = Math.floor(Math.random() * 100);
      const delay = Math.floor(Math.random() * 10);
      const duration = Math.floor(Math.random() * 10) + 15; // 15s - 25s
      const opacity = Math.random() * 0.3 + 0.1; // 0.1 - 0.4
      const xOffset = Math.random() * 200 - 100;

      newParticles.push(
        <div
          key={`particle-${i}`}
          className="particle"
          style={
            {
              width: `${size}px`,
              height: `${size}px`,
              left: `${xPos}%`,
              "--delay": `${delay}s`,
              "--duration": `${duration}s`,
              "--x-offset": `${xOffset}px`,
              "--max-opacity": opacity,
            } as React.CSSProperties
          }
        />
      );
    }
    return newParticles;
  }, [isMounted]);

  // Generate data lines (memoized to avoid regeneration)
  const dataLines = React.useMemo(() => {
    if (!isMounted) return [];
    const newLines = [];
    for (let i = 0; i < 8; i++) {
      const xPos = Math.floor(Math.random() * 100);
      const delay = Math.floor(Math.random() * 5);
      const duration = Math.floor(Math.random() * 5) + 8; // 8s - 13s
      const height = Math.floor(Math.random() * 30) + 20; // 20% - 50%

      newLines.push(
        <div
          key={`data-line-${i}`}
          className="data-line"
          style={
            {
              left: `${xPos}%`,
              "--delay": `${delay}s`,
              "--duration": `${duration}s`,
              "--height": `${height}%`,
            } as React.CSSProperties
          }
        />
      );
    }
    return newLines;
  }, [isMounted]);

  // Set mounted flag on client-side only
  useEffect(() => {
    setIsMounted(true);
  }, []);

  return (
    <main className="min-h-screen bg-black text-slate-100 relative overflow-hidden">
      {/* Quantum Particles Animation - shown only after component mounts */}
      <div className="quantum-particles">{particles}</div>

      {/* Data Stream Animation - shown only after component mounts */}
      <div className="data-stream">{dataLines}</div>

      {/* Quantum Wave Animation */}
      <div className="quantum-wave">
        <div className="wave"></div>
        <div className="wave"></div>
        <div className="wave"></div>
      </div>

      {/* Navbar moved to global layout */}

      <div className="mx-auto px-4 sm:px-6 lg:px-8 py-6 mt-4">
        <header className="flex flex-col lg:flex-row items-start lg:items-center justify-between mb-8 border-b border-slate-700/30 pb-6 relative gap-4">
          <div className="relative z-10">
            <h2 className="text-xl md:text-2xl font-bold text-white">
              Quantumn Dashboard
            </h2>
            <p className="text-slate-300 text-sm font-light tracking-wide mt-1">
              Empowering Smarter Trades with AI, Quantum Speed, and LLM
              competition
            </p>
          </div>
          {/* AI Analysis Status Indicator */}
          {/* <section className="relative z-10 w-full lg:w-auto">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              {lastAnalysis && (
                <div className="text-xs sm:text-sm text-slate-400 whitespace-nowrap">
                  Last analysis: {lastAnalysis}
                </div>
              )}
              {isAnalyzing && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800/50 border border-slate-700/50">
                  <span className="animate-spin text-lg">⚡</span>
                  <span className="text-sm text-white">AI Analyzing...</span>
                  <span className="text-xs text-slate-400">({completedAgents}/{totalAgents})</span>
                </div>
              )}
            </div>
          </section> */}
          <div className="absolute top-0 right-0 w-64 h-16 bg-gradient-to-l from-slate-500/10 to-transparent blur-xl"></div>
        </header>

        {/* Main Layout: Sidebar Left + Content Right */}
        <div className="grid grid-cols-12 gap-4 lg:gap-6">
          {/* LEFT SIDEBAR - 2 Agents */}
          <aside className="col-span-12 lg:col-span-4 xl:col-span-3 space-y-4 lg:space-y-6">
            {agents.slice(0, 2).map((agent) => (
              <AgentDetail key={agent.id} agent={agent} />
            ))}
          </aside>

          {/* RIGHT CONTENT AREA - Split into 2 columns */}
          <div className="col-span-12 lg:col-span-8 xl:col-span-9">
            <div className="grid grid-cols-12 gap-4 lg:gap-6">
              {/* Main Content (Market, Chart, Button) */}
              <div className="col-span-12 xl:col-span-8 space-y-4 lg:space-y-6">
                {/* Market Snapshot */}
                <section>
                  <div className="rounded-xl bg-black/60 border border-white/30 p-4 shadow-[0_8px_30px_rgba(0,0,0,0.3)] backdrop-blur-sm relative overflow-hidden group transition-all duration-300 hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)]">
                    <div className="absolute top-0 right-0 w-40 h-40 bg-slate-500/5 rounded-full blur-3xl group-hover:bg-slate-500/10 transition-all duration-500"></div>
                    <div className="text-sm text-white mb-2 font-medium flex items-center">
                      <span className="inline-block w-2 h-2 rounded-full bg-slate-400 mr-2 animate-pulse"></span>
                      Market Snapshot
                    </div>
                    <div className="mt-2 relative z-10">
                      <CompactMarkets />
                    </div>
                  </div>
                </section>

                {/* Account Value Chart */}
                <section>
                  <div className="rounded-xl bg-black/60 border border-white/30 p-4 shadow-[0_8px_30px_rgba(0,0,0,0.3)] backdrop-blur-sm relative overflow-hidden">
                    <AccountValueChart />
                  </div>
                </section>
              </div>

              {/* Right Side - 2 More Agents */}
              <div className="col-span-12 xl:col-span-4 space-y-4 lg:space-y-6">
                {agents.slice(2, 4).map((agent) => (
                  <AgentDetail key={agent.id} agent={agent} />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Agents Table - Full Width */}
        <div className="grid grid-cols-12 gap-4 lg:gap-6 mt-6 lg:mt-8">
          <aside className="col-span-12">
            <div className="rounded-xl bg-black/60 border border-slate-700/30 p-4 shadow-[0_8px_30px_rgba(0,0,0,0.3)] backdrop-blur-sm h-full relative overflow-hidden group transition-all duration-300 hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)]">
              <div className="absolute top-0 left-0 w-40 h-40 bg-slate-500/5 rounded-full blur-3xl group-hover:bg-slate-500/10 transition-all duration-500"></div>
              <div className="text-sm text-white mb-2 font-medium flex items-center relative z-10">
                <span className="inline-block w-2 h-2 rounded-full bg-slate-400 mr-2"></span>
                Active Agents Summary
              </div>
              <AgentsTable
                agents={(agents ?? [])
                  .filter((a) => {
                    const raw = a.model ?? "";
                    const normalized = raw
                      .toLowerCase()
                      .normalize("NFD")
                      .replace(/[\u0300-\u036f]/g, "")
                      .replace(/\s+/g, "");
                    const allowed = [
                      "claude",
                      "anthropic",
                      "sonnet",
                      "deepseek",
                      "gemini",
                      "grok",
                      "xai",
                      "openai",
                      "qwen",
                      "gpt",
                    ];
                    return allowed.some((k) => normalized.includes(k));
                  })
                  .sort((a, b) => (b.total_pnl || 0) - (a.total_pnl || 0))}
                loading={agentsLoading}
              />
              {agentsError && (
                <div className="mt-2 text-xs text-red-400">
                  Failed to load agents
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
