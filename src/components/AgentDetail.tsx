"use client";

import React, { useState, useEffect } from "react";
import useSWR from "swr";
import Image from "next/image";
import type { Agent, Position, AgentSummary } from "@/types";
import { fetchAllPositions, fetchAgentSummaries } from "@/lib/supabase-service";

interface AgentDetailProps {
  agent: Agent;
}

// Helper function to get agent logo based on model name.
function getAgentLogo(model: string): string {
  const modelLower = model.toLowerCase();

  if (modelLower.includes("gpt") || modelLower.includes("openai")) {
    return "/icons/GPT_logo.png";
  }
  if (
    modelLower.includes("claude") ||
    modelLower.includes("anthropic") ||
    modelLower.includes("sonnet")
  ) {
    return "/icons/Claude_logo.png";
  }
  if (modelLower.includes("gemini")) {
    return "/icons/Gemini_logo.webp";
  }
  if (modelLower.includes("grok") || modelLower.includes("xai")) {
    return "/icons/Grok_logo.webp";
  }
  if (modelLower.includes("deepseek")) {
    return "/icons/deepseek_logo.png";
  }
  if (modelLower.includes("qwen")) {
    return "/icons/qwen_logo.png";
  }

  // Default fallback
  return "/icons/GPT_logo.png";
}

// Helper function to get agent good name based on model name
function getAgentName(model: string): string {
  const modelLower = model.toLowerCase();

  if (modelLower.includes("gpt") || modelLower.includes("openai")) {
    return "GPT 5";
  }
  if (
    modelLower.includes("claude") ||
    modelLower.includes("anthropic") ||
    modelLower.includes("sonnet")
  ) {
    return "CLAUDE SONNET 4.5";
  }
  if (modelLower.includes("gemini")) {
    return "GEMINI 2.5 PRO";
  }
  if (modelLower.includes("grok") || modelLower.includes("xai")) {
    return "GROK 4";
  }
  if (modelLower.includes("deepseek")) {
    return "DEEPSEEK REASONER V3.1";
  }
  if (modelLower.includes("qwen")) {
    return "QWEN3 MAX INSTRUCT";
  }

  // Default fallback for unknown models
  return "";
}

type TabType = "ANALYSIS" | "HISTORY" | "ACTIVE" | "DETAILS";

export default function AgentDetail({ agent }: AgentDetailProps) {
  const [activeTab, setActiveTab] = useState<TabType>("ANALYSIS");

  // Fetch positions
  const { data: positions = [], isLoading: positionsLoading } = useSWR(
    ["positions", agent.id],
    () => fetchAllPositions(agent.id),
    { refreshInterval: 10000 }
  );

  // Fetch summaries (refresh every 10s to quickly show new analysis)
  const { data: summaries = [], isLoading: summariesLoading } = useSWR(
    ["summaries", agent.id],
    () => fetchAgentSummaries(agent.id),
    {
      refreshInterval: 10000, // 10 seconds - matches positions refresh
      revalidateOnFocus: true, // Refresh when user returns to tab
      revalidateOnReconnect: true, // Refresh when internet reconnects
    }
  );

  const activePositions = positions.filter((p) => p.is_active);

  // Sort closed positions by exit_time (newest first)
  const pastPositions = positions
    .filter((p) => !p.is_active)
    .sort((a, b) => {
      // Sort by exit_time descending (newest first)
      const timeA = a.exit_time ? new Date(a.exit_time).getTime() : 0;
      const timeB = b.exit_time ? new Date(b.exit_time).getTime() : 0;
      return timeB - timeA; // Descending order
    })
    .slice(0, 10);

  const latestSummaries = summaries.slice(0, 5); // Get latest 5 summaries

  // Calculate PnL color
  const pnlColor = agent.total_pnl >= 0 ? "text-green-400" : "text-red-400";
  const pnlSign = agent.total_pnl >= 0 ? "+" : "";

  return (
    <div className="rounded-xl bg-black/60 border border-white/30 p-4 shadow-[0_8px_30px_rgba(0,0,0,0.3)] backdrop-blur-sm relative overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/50">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-black/80 flex items-center justify-center overflow-hidden border border-white/30">
            <Image
              src={getAgentLogo(agent.model)}
              alt={getAgentName(agent.model)}
              width={32}
              height={32}
              className="object-contain"
              priority
            />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white capitalize">
              {getAgentName(agent.model)}
            </h3>
            {/* <p className="text-xs text-cyan-400">Agent ID: {agent.id.substring(0, 8)}</p> */}
          </div>
        </div>
        <div className="text-right">
          <div className={`text-2xl font-bold ${pnlColor}`}>
            {pnlSign}${agent.total_pnl.toFixed(2)}
          </div>
          <div className="text-xs text-white/70">
            Balance: ${agent.balance.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <div className="bg-black/60 rounded-lg p-2 text-center">
          <div className="text-xs text-slate-400">ROI</div>
          <div
            className={`text-sm font-bold ${
              agent.roi >= 0 ? "text-green-400" : "text-red-400"
            }`}
          >
            {agent.roi.toFixed(2)}%
          </div>
        </div>
        <div className="bg-black/60 rounded-lg p-2 text-center">
          <div className="text-xs text-slate-400">Trades</div>
          <div className="text-sm font-bold text-white">
            {agent.trade_count}
          </div>
        </div>
        <div className="bg-black/60 rounded-lg p-2 text-center">
          <div className="text-xs text-slate-400">Win Rate</div>
          <div className="text-sm font-bold text-white">
            {agent.win_rate.toFixed(1)}%
          </div>
        </div>
        <div className="bg-black/60 rounded-lg p-2 text-center">
          <div className="text-xs text-slate-400">Active</div>
          <div className="text-sm font-bold text-white">
            {agent.active_positions}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 mb-4 bg-black/60 rounded-lg p-1">
        {(["ANALYSIS", "HISTORY", "ACTIVE", "DETAILS"] as TabType[]).map(
          (tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 px-3 rounded-md text-xs font-medium transition-all ${
                activeTab === tab
                  ? "bg-gray-500/30 text-white border border-white/50"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/70"
              }`}
            >
              {tab}
            </button>
          )
        )}
      </div>

      {/* Tab Content */}
      <div className="min-h-[300px] max-h-[500px] overflow-y-auto custom-scrollbar">
        {activeTab === "ANALYSIS" && (
          <LatestTab summaries={latestSummaries} loading={summariesLoading} />
        )}
        {activeTab === "HISTORY" && (
          <PastTab positions={pastPositions} loading={positionsLoading} />
        )}
        {activeTab === "ACTIVE" && (
          <ActiveTab positions={activePositions} loading={positionsLoading} />
        )}
        {activeTab === "DETAILS" && <DetailsTab agent={agent} />}
      </div>
    </div>
  );
}

// Loading Skeleton Component
function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-4 bg-slate-700/50 rounded w-32"></div>
        <div className="h-4 bg-slate-700/50 rounded w-40"></div>
      </div>

      {/* Conclusion skeleton */}
      <div className="bg-black/60 rounded-lg p-3 space-y-2">
        <div className="h-3 bg-slate-700/50 rounded w-24"></div>
        <div className="h-3 bg-slate-700/50 rounded w-full"></div>
        <div className="h-3 bg-slate-700/50 rounded w-5/6"></div>
        <div className="h-3 bg-slate-700/50 rounded w-4/6"></div>
      </div>

      {/* Decisions skeleton */}
      <div className="space-y-2">
        <div className="h-3 bg-slate-700/50 rounded w-32"></div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-slate-800/50 rounded-lg p-3 space-y-2">
            <div className="flex justify-between">
              <div className="h-3 bg-slate-700/50 rounded w-20"></div>
              <div className="h-3 bg-slate-700/50 rounded w-16"></div>
            </div>
            <div className="h-3 bg-slate-700/50 rounded w-full"></div>
            <div className="h-3 bg-slate-700/50 rounded w-3/4"></div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Typing Effect Hook with realistic variable speed
function useTypingEffect(
  text: string,
  baseSpeed: number = 30,
  enabled: boolean = true
) {
  const [displayedText, setDisplayedText] = useState("");
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    // If not enabled or no text, reset and return
    if (!enabled || !text) {
      setDisplayedText("");
      setIsComplete(false);
      return;
    }

    // Reset state
    setDisplayedText("");
    setIsComplete(false);
    let index = 0;
    let isCancelled = false;

    // Function to get variable typing speed (more realistic)
    const getTypingDelay = (char: string, prevChar: string) => {
      // Longer pause after punctuation
      if (prevChar === "." || prevChar === "!" || prevChar === "?") {
        return baseSpeed * 16; // 16x longer after sentence end
      }
      if (prevChar === "," || prevChar === ";") {
        return baseSpeed * 12; // 8x longer after comma
      }
      // Slightly faster for spaces
      if (char === " ") {
        return baseSpeed * 1;
      }
      // Random variation for natural feel (±20%)
      const variation = 1 + Math.random() * 0.8;
      return baseSpeed * variation;
    };

    // Small delay to ensure DOM is ready
    const startDelay = setTimeout(() => {
      const typeNextChar = () => {
        if (isCancelled || index >= text.length) {
          if (index >= text.length) {
            setIsComplete(true);
          }
          return;
        }

        // Add next character
        setDisplayedText(text.substring(0, index + 1));

        const currentChar = text[index];
        const prevChar = index > 0 ? text[index - 1] : "";
        index++;

        // Schedule next character with variable delay
        const delay = getTypingDelay(currentChar, prevChar);
        setTimeout(typeNextChar, delay);
      };

      // Start typing
      typeNextChar();
    }, 150); // 150ms initial delay before starting

    return () => {
      isCancelled = true;
      clearTimeout(startDelay);
    };
  }, [text, baseSpeed, enabled]);

  return { displayedText, isComplete };
}

// Single Summary Card Component
function SummaryCard({
  summary,
  index,
}: {
  summary: AgentSummary;
  index: number;
}) {
  const [showDecisions, setShowDecisions] = useState(index === 0); // First one expanded by default
  const [isExpanded, setIsExpanded] = useState(index === 0);
  const { displayedText, isComplete } = useTypingEffect(
    summary.conclusion,
    20, // Base speed: 20ms per character (realistic typing speed)
    isExpanded // Only type when expanded
  );

  const timestamp = new Date(summary.session_timestamp)
    .toLocaleString()
    .replaceAll(",", " - ");
  const isLatest = index === 0;

  return (
    <div
      className={`border rounded-lg overflow-hidden transition-all duration-300 ${
        isLatest
          ? "border-slate-600/50 bg-black/80 shadow-lg shadow-black/20"
          : "border-slate-700/50 bg-black/70"
      }`}
    >
      {/* Header - Always Visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-3 flex items-center justify-between hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {isLatest && (
            <span className="px-2 py-0.5 text-[10px] font-bold bg-slate-700/50 text-white rounded-full border border-slate-600/50">
              LATEST
            </span>
          )}
          <span className="text-xs text-white">{timestamp}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-orange-300">
            {summary.total_decisions} Market Decisions | Runtime:{" "}
            {summary.runtime_minutes.toFixed(2)} m
          </span>
          <span
            className="transform transition-transform duration-200"
            style={{
              display: "inline-block",
              transform: isExpanded ? "rotate(0deg)" : "rotate(-90deg)",
            }}
          >
            ▼
          </span>
        </div>
      </button>

      {/* Expandable Content */}
      {isExpanded && (
        <div className="px-3 pb-3 space-y-3 animate-in fade-in duration-200">
          {/* Conclusion with Typing Effect (only for latest) */}
          <div className="bg-gray-600/30 rounded-lg p-3">
            <div className="text-xs font-semibold text-white mb-2 flex items-center gap-2">
              Market Conclusion
              {isLatest && !isComplete && (
                <span className="inline-block w-1 h-4 bg-slate-400 animate-pulse"></span>
              )}
            </div>
            <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
              {isLatest ? displayedText : summary.conclusion}
            </p>
          </div>

          {/* Decisions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold text-orange-300">
                Market Decisions ({summary.decisions_made.length})
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDecisions(!showDecisions);
                }}
                className="text-xs text-slate-300 hover:text-white transition-colors flex items-center gap-1"
              >
                <span
                  className="transform transition-transform duration-200"
                  style={{
                    display: "inline-block",
                    transform: showDecisions
                      ? "rotate(0deg)"
                      : "rotate(-90deg)",
                  }}
                >
                  ▼
                </span>
                {showDecisions ? "Hide" : "Show"}
              </button>
            </div>

            {showDecisions && (
              <div className="space-y-2 animate-in fade-in duration-200">
                {summary.decisions_made.map((decision, idx) => (
                  <DecisionCard key={idx} decision={decision} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// LATEST Tab - Show latest 5 AI decision summaries
function LatestTab({
  summaries,
  loading,
}: {
  summaries: AgentSummary[];
  loading: boolean;
}) {
  if (loading) {
    return <LoadingSkeleton />;
  }

  if (summaries.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-800/50 flex items-center justify-center text-slate-400 border border-slate-700/50">
          <svg
            className="w-8 h-8"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2z"
            />
          </svg>
        </div>
        <p className="text-slate-300 font-medium mb-2">No Analysis Yet</p>
        {/* <p className="text-sm text-slate-400 max-w-xs mx-auto">
          Click the "Run AI Analysis" button to start analyzing market data
        </p> */}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {summaries.map((summary, index) => (
        <SummaryCard key={summary.id} summary={summary} index={index} />
      ))}
    </div>
  );
}

// Helper function to get coin icon based on symbol
function getCoinIcon(symbol: string): string {
  if (!symbol) return "/icons/btc_icon.png"; // Default fallback
  const symbolUpper = symbol.toUpperCase();

  if (symbolUpper === "BTC") {
    return "/icons/btc_icon.png";
  }
  if (symbolUpper === "ETH") {
    return "/icons/eth.svg";
  }
  if (symbolUpper === "SOL") {
    return "/icons/sol.svg";
  }
  if (symbolUpper === "BNB") {
    return "/icons/bnb_icon.png";
  }
  if (symbolUpper === "GIGGLE") {
    return "/icons/giggle_icon.png";
  }
  if (symbolUpper === "ASTER") {
    return "/icons/aster_icon.png";
  }

  return "/icons/aster_icon.png"; // Default fallback
}

// Decision Card Component
function DecisionCard({ decision }: { decision: any }) {
  const signalColors: Record<string, string> = {
    long: "text-green-400",
    short: "text-red-400",
    wait: "text-slate-400",
    hold: "text-blue-400",
    close: "text-slate-300",
  };

  // Guard against null/undefined decision and normalize fields
  if (!decision || typeof decision !== "object") {
    return null; // Skip rendering invalid decision
  }

  const signal: string | undefined =
    typeof decision.signal === "string" ? decision.signal : undefined;
  const coin: string = typeof decision.coin === "string" ? decision.coin : "";

  // Resolve color safely based on signal
  const signalColor = (signal && signalColors[signal]) || "text-white";

  return (
    <div className="bg-gray-600/30 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <Image
            src={getCoinIcon(coin)}
            alt={`${coin} icon`}
            width={20}
            height={20}
            className="rounded-full"
          />
          <span className="text-sm font-bold text-white">{coin}</span>
          <span
            className={`text-xs font-bold uppercase px-auto py-0.5 rounded ${signalColor}`}
          >
            ({signal || "N/A"})
          </span>
        </div>
        <div className="text-xs text-slate-400">
          {decision.confidence
            ? `${(decision.confidence * 100).toFixed(0)}%`
            : "N/A"}
        </div>
      </div>

      {signal !== "wait" && decision.entry_price > 0 && (
        <div className="text-xs text-slate-400 space-y-1">
          <div>Entry: ${decision.entry_price?.toFixed(2) || "N/A"}</div>
          {signal !== "hold" && signal !== "close" && (
            <>
              <div>
                TP: ${decision.profit_target?.toFixed(2) || "N/A"} | SL: $
                {decision.stop_loss?.toFixed(2) || "N/A"}
              </div>
              <div>
                Size: ${decision.size_usd?.toFixed(0) || "N/A"} (
                {decision.leverage}x)
              </div>
            </>
          )}
        </div>
      )}

      {decision.justification && (
        <div className="mt-2 text-xs text-slate-300 italic">
          {decision.justification}
        </div>
      )}

      {decision.invalidation_condition && signal !== "wait" && (
        <div className="mt-2 text-xs text-slate-400">
          Exit Strategy: {decision.invalidation_condition}
        </div>
      )}
    </div>
  );
}

// Position Loading Skeleton
function PositionLoadingSkeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50 space-y-2"
        >
          <div className="flex justify-between">
            <div className="flex items-center gap-2">
              <div className="h-4 bg-slate-700/50 rounded w-16"></div>
              <div className="h-4 bg-slate-700/50 rounded w-12"></div>
            </div>
            <div className="h-4 bg-slate-700/50 rounded w-20"></div>
          </div>
          <div className="space-y-1">
            <div className="h-3 bg-slate-700/50 rounded w-full"></div>
            <div className="h-3 bg-slate-700/50 rounded w-4/5"></div>
            <div className="h-3 bg-slate-700/50 rounded w-3/5"></div>
          </div>
        </div>
      ))}
    </div>
  );
}

// PAST Tab - Show closed positions
function PastTab({
  positions,
  loading,
}: {
  positions: Position[];
  loading: boolean;
}) {
  if (loading) {
    return <PositionLoadingSkeleton />;
  }

  if (positions.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-800/50 flex items-center justify-center text-slate-400 border border-slate-700/50">
          <svg
            className="w-8 h-8"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
        <p className="text-slate-300 font-medium mb-2">No Closed Positions</p>
        <p className="text-sm text-slate-400 max-w-xs mx-auto">
          Past trading positions will appear here once closed
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {positions.map((position) => (
        <PositionCard key={position.id} position={position} isPast />
      ))}
    </div>
  );
}

// ACTIVE Tab - Show active positions
function ActiveTab({
  positions,
  loading,
}: {
  positions: Position[];
  loading: boolean;
}) {
  if (loading) {
    return <PositionLoadingSkeleton />;
  }

  if (positions.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-800/50 flex items-center justify-center text-slate-400 border border-slate-700/50">
          <svg
            className="w-8 h-8"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
        </div>
        <p className="text-slate-300 font-medium mb-2">No Active Positions</p>
        <p className="text-sm text-slate-400 max-w-xs mx-auto">
          Open positions will be displayed here when AI makes trading decisions
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {positions.map((position) => (
        <PositionCard key={position.id} position={position} isPast={false} />
      ))}
    </div>
  );
}

// Position Card Component
function PositionCard({
  position,
  isPast,
}: {
  position: Position;
  isPast: boolean;
}) {
  const sideColor =
    position.side === "LONG" ? "text-green-400" : "text-red-400";
  const pnlColor =
    (position.pnl_usd || 0) >= 0 ? "text-green-400" : "text-red-400";
  const pnlSign = (position.pnl_usd || 0) >= 0 ? "+" : "";

  const entryTime = new Date(position.entry_time).toLocaleString();
  const exitTime = position.exit_time
    ? new Date(position.exit_time).toLocaleString()
    : null;

  return (
    <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <Image
            src={getCoinIcon(position.symbol)}
            alt={`${position.symbol} icon`}
            width={20}
            height={20}
            className="rounded-full"
          />
          <span className="text-sm font-bold text-white">
            {position.symbol}
          </span>
          <span className={`text-xs font-bold uppercase ${sideColor}`}>
            {position.side}
          </span>
        </div>
        {isPast && position.pnl_usd !== undefined && (
          <div className={`text-sm font-bold ${pnlColor}`}>
            {pnlSign}${position.pnl_usd.toFixed(3)}
            <span className="text-xs ml-1">
              ({pnlSign}
              {position.pnl_pct?.toFixed(2)}%)
            </span>
          </div>
        )}
      </div>

      <div className="text-xs text-slate-400 space-y-1">
        <div className="flex justify-between items-center">
          <div>
            <span className="text-slate-500">Entry:</span>{" "}
            <span className="text-white font-medium">
              ${position.entry_price.toFixed(2)}
            </span>
          </div>
          {isPast && position.exit_price && (
            <div>
              <span className="text-slate-500">Exit:</span>{" "}
              <span
                className={`font-medium ${
                  position.pnl_usd && position.pnl_usd >= 0
                    ? "text-green-400"
                    : "text-red-400"
                }`}
              >
                ${position.exit_price.toFixed(2)}
              </span>
            </div>
          )}
          {!isPast && position.exit_price && (
            <div>
              <span className="text-slate-500">Current:</span>{" "}
              <span className="text-cyan-400 font-medium">
                ${position.exit_price.toFixed(2)}
              </span>
            </div>
          )}
        </div>
        <div>
          Size: ${position.size_usd.toFixed(0)} ({position.size_pct.toFixed(1)}
          %)
        </div>
        <div>
          Margin: ${(position.size_usd / position.leverage).toFixed(2)} |
          Leverage: {position.leverage}x | Confidence:{" "}
          {(position.confidence * 100).toFixed(0)}%
        </div>
        <div>Open @ {entryTime}</div>
        {exitTime && <div>Close @ {exitTime}</div>}
      </div>

      <div className="mt-2 text-xs text-slate-300">
        <div className="font-semibold text-white mb-1">Reasoning:</div>
        <p className="italic">{position.reasoning}</p>
      </div>

      <div className="mt-2 text-xs text-slate-400">
        <div className="font-semibold mb-1">Exit Strategy:</div>
        <p>{position.exit_strategy}</p>
      </div>

      {isPast && position.exit_reason && (
        <div className="mt-2 text-xs text-slate-400">
          <span className="font-semibold">Exit Reason:</span>{" "}
          {position.exit_reason}
        </div>
      )}
    </div>
  );
}

// DETAILS Tab - Show agent configuration
function DetailsTab({ agent }: { agent: Agent }) {
  return (
    <div className="space-y-4">
      <div className="bg-black/60 rounded-lg p-3">
        <div className="text-xs font-semibold text-white mb-2">
          Agent Configuration
        </div>
        <div className="text-xs text-slate-300 space-y-2">
          <div className="flex justify-between">
            <span className="text-slate-400">Model:</span>
            <span className="font-medium capitalize">
              {getAgentName(agent.model)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Status:</span>
            <span
              className={agent.is_active ? "text-green-400" : "text-red-400"}
            >
              {agent.is_active ? "Active" : "Inactive"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Created:</span>
            <span>
              {agent.created_at
                ? new Date(agent.created_at).toLocaleDateString()
                : "N/A"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Last Updated:</span>
            <span>
              {agent.updated_at
                ? new Date(agent.updated_at).toLocaleString()
                : "N/A"}
            </span>
          </div>
        </div>
      </div>

      <div className="bg-black/60 rounded-lg p-3">
        <div className="text-xs font-semibold text-white mb-2">
          Performance Metrics
        </div>
        <div className="text-xs text-slate-300 space-y-2">
          <div className="flex justify-between">
            <span className="text-slate-400">Total Trades:</span>
            <span className="font-medium">{agent.trade_count}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Wins / Losses:</span>
            <span className="font-medium">
              <span className="text-green-400">{agent.win_count}</span> /{" "}
              <span className="text-red-400">{agent.loss_count}</span>
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Win Rate:</span>
            <span className="font-medium text-white">
              {agent.win_rate.toFixed(2)}%
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Total PnL:</span>
            <span
              className={`font-medium ${
                agent.total_pnl >= 0 ? "text-green-400" : "text-red-400"
              }`}
            >
              {agent.total_pnl >= 0 ? "+" : ""}${agent.total_pnl.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">ROI:</span>
            <span
              className={`font-medium ${
                agent.roi >= 0 ? "text-green-400" : "text-red-400"
              }`}
            >
              {agent.roi >= 0 ? "+" : ""}
              {agent.roi.toFixed(2)}%
            </span>
          </div>
        </div>
      </div>

      {agent.system_prompt && (
        <div className="bg-black/60 rounded-lg p-3">
          <div className="text-xs font-semibold text-white mb-2">
            System Prompt
          </div>
          <div className="text-xs text-slate-300 max-h-40 overflow-y-auto custom-scrollbar">
            <pre className="whitespace-pre-wrap">{agent.system_prompt}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
