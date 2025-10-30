"use client";
import React, { useMemo, useState, useCallback } from "react";
import Image from "next/image";
import useSWR from "swr";
import { fetchAgents, fetchBalanceHistory } from "@/lib/api";
import type { Agent } from "@/types";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Label,
} from "recharts";

type Mode = "usd" | "percent";

type TimeframeKey = "30m" | "1h" | "6h" | "12h" | "24h";

function normalizeModel(raw: string) {
  const lower = raw.toLowerCase();
  const noAccents = lower.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return noAccents.replace(/\s+/g, "");
}

function mapLLM(model?: string) {
  const raw = model ?? "-";
  const m = normalizeModel(raw);
  if (m.includes("openai") || m.includes("gpt"))
    return { name: "GPT 5", logo: "/icons/GPT_logo.png", color: "#60a5fa" };
  if (m.includes("claude") || m.includes("anthropic") || m.includes("sonnet"))
    return {
      name: "CLAUDE SONNET 4.5",
      logo: "/icons/Claude_logo.png",
      color: "#DA7B5C",
    };
  if (m.includes("gemini"))
    return {
      name: "GEMINI 2.5 PRO",
      logo: "/icons/Gemini_logo.webp",
      color: "#A794FB",
    };
  if (m.includes("grok") || m.includes("xai"))
    return { name: "GROK 4", logo: "/icons/Grok_logo.webp", color: "#22c55e" };
  if (m.includes("deepseek"))
    return {
      name: "DEEPSEEK REASONER V3.1",
      logo: "/icons/deepseek_logo.png",
      color: "#5370FE",
    };
  if (m.includes("qwen"))
    return {
      name: "QWEN3 MAX INSTRUCT",
      logo: "/icons/qwen_logo.png",
      color: "#653DDC",
    };
  return { name: raw.toUpperCase(), logo: "", color: "#9ca3af" };
}

function hoursForTimeframe(timeframe: TimeframeKey): number {
  const map: Record<TimeframeKey, number> = {
    // "1m": 1 / 60,
    // "15m": 15 / 60,
    "30m": 30 / 60,
    "1h": 1,
    "6h": 6,
    "12h": 12,
    "24h": 24,
  };
  return map[timeframe];
}

function generateFallbackData(
  agent: Agent,
  timeframe: TimeframeKey
): { timestamp: number; value: number }[] {
  const hours = hoursForTimeframe(timeframe);
  const currentBalance = agent.balance || 100;
  const startTime = Date.now() - hours * 60 * 60 * 1000;

  const points: { timestamp: number; value: number }[] = [];
  const steps = Math.min(Math.ceil(hours * 4), 20);

  for (let i = 0; i <= steps; i++) {
    const progress = i / steps;
    const value = 100 + (currentBalance - 100) * progress;
    const timestamp = startTime + hours * 60 * 60 * 1000 * progress;
    points.push({ timestamp, value });
  }

  return points;
}

// Custom legend component to show agent images (memoized for performance)
const CustomLegend = React.memo(
  (props: {
    payload?: Array<{ value: string; color: string }>;
    hiddenAgents?: Set<string>;
    onToggle?: (agentName: string) => void;
  }) => {
    const { payload, hiddenAgents, onToggle } = props;

    if (!payload || !payload.length) return null;

    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "16px",
          marginTop: "12px",
          flexWrap: "wrap",
        }}
      >
        {payload.map((entry, index: number) => {
          // Extract agent info from entry value (name)
          const agentName = entry.value;
          const color = entry.color;
          const isHidden = hiddenAgents?.has(agentName);

          // Find matching logo
          let logo = "";
          if (agentName.includes("CLAUDE")) logo = "/icons/Claude_logo.png";
          else if (agentName.includes("DEEPSEEK"))
            logo = "/icons/deepseek_logo.png";
          else if (agentName.includes("GEMINI"))
            logo = "/icons/Gemini_logo.webp";
          else if (agentName.includes("GROK")) logo = "/icons/Grok_logo.webp";
          else if (agentName.includes("GPT")) logo = "/icons/GPT_logo.png";
          else if (agentName.includes("QWEN")) logo = "/icons/qwen_logo.png";

          return (
            <div
              key={`legend-${index}`}
              onClick={() => onToggle?.(agentName)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "4px 8px",
                borderRadius: "6px",
                background: isHidden
                  ? "rgba(30, 41, 59, 0.15)"
                  : "rgba(30, 41, 59, 0.5)",
                border: isHidden ? `2px dashed ${color}` : `2px solid ${color}`,
                cursor: "pointer",
                transition: "all 0.2s ease",
                filter: isHidden ? "grayscale(0.7)" : "none",
                opacity: isHidden ? 0.5 : 1,
              }}
              title={isHidden ? "Click to activate" : "Click to deactivate"}
            >
              {logo && (
                <Image
                  src={logo}
                  alt={agentName}
                  width={18}
                  height={18}
                  style={{
                    borderRadius: "50%",
                    objectFit: "contain",
                  }}
                  unoptimized
                />
              )}
              <div
                style={{
                  width: "20px",
                  height: "3px",
                  background: color,
                  borderRadius: "2px",
                }}
              />
              <span
                style={{
                  fontSize: "11px",
                  color: isHidden ? "#9ca3af" : "#e5e7eb",
                  fontWeight: "500",
                  textDecoration: isHidden ? "line-through" : "none",
                }}
              >
                {agentName}
              </span>
            </div>
          );
        })}
      </div>
    );
  }
);

CustomLegend.displayName = "CustomLegend";

// Custom dot component to show agent image and balance at the end of line (memoized)
const CustomEndDot = React.memo(
  (props: {
    cx?: number;
    cy?: number;
    payload?: { isLast?: boolean };
    dataKey?: string;
    agents?: Agent[];
    stroke?: string;
  }) => {
    const { cx, cy, payload, dataKey, agents, stroke } = props;

    // Only show on the last point
    if (!payload?.isLast || cx === undefined || cy === undefined) return null;

    const agent = agents?.find((a: Agent) => {
      const agentKey = mapLLM(a.model).name.toLowerCase().replace(/\s+/g, "_");
      return dataKey === agentKey;
    });

    if (!agent) return null;

    const { logo, color } = mapLLM(agent.model);
    const balance = agent.balance || 100;
    const lineColor = stroke || color; // Use line color if provided

    return (
      <g>
        {/* Outer glow circles with line color */}
        <circle cx={cx} cy={cy} r={32} fill={lineColor} opacity={0.15} />
        <circle cx={cx} cy={cy} r={24} fill={lineColor} opacity={0.3} />

        {/* Main circle background with line color */}
        <circle cx={cx} cy={cy} r={18} fill={lineColor} opacity={0.9} />

        {/* Agent logo (using foreignObject to embed image) */}
        {logo && (
          <foreignObject x={cx - 16} y={cy - 16} width={32} height={32}>
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "transparent",
              }}
            >
              <Image
                src={logo}
                alt={agent.model}
                width={26}
                height={26}
                style={{
                  objectFit: "contain",
                  filter: "drop-shadow(0 0 3px rgba(0,0,0,0.4))",
                }}
                unoptimized
              />
            </div>
          </foreignObject>
        )}

        {/* Balance label below the circle */}
        <foreignObject x={cx - 35} y={cy + 25} width={70} height={28}>
          <div
            style={{
              background: "rgba(0, 0, 0, 0.9)",
              color: "white",
              padding: "4px 8px",
              borderRadius: "6px",
              fontSize: "12px",
              fontWeight: "bold",
              whiteSpace: "nowrap",
              border: `2px solid ${lineColor}`,
              boxShadow: `0 0 8px ${lineColor}40`,
              textAlign: "center",
            }}
          >
            ${balance.toFixed(2)}
          </div>
        </foreignObject>
      </g>
    );
  }
);

CustomEndDot.displayName = "CustomEndDot";

// Reduce data points for better performance on large timeframes
function sampleData<T extends Record<string, number | string | boolean>>(
  data: T[],
  maxPoints: number
): T[] {
  if (data.length <= maxPoints) return data;

  const step = Math.ceil(data.length / maxPoints);
  const sampled: T[] = [];

  for (let i = 0; i < data.length; i += step) {
    sampled.push(data[i]);
  }

  // Always include the last point
  if (sampled[sampled.length - 1] !== data[data.length - 1]) {
    sampled.push(data[data.length - 1]);
  }

  return sampled;
}

export default function AccountValueChart() {
  const [mode, setMode] = useState<Mode>("usd");
  const [timeframe, setTimeframe] = useState<TimeframeKey>("1h");
  const [hiddenAgents, setHiddenAgents] = useState<Set<string>>(new Set());

  const { data: agents, isLoading } = useSWR<Agent[]>(
    ["supabase", "agents-for-chart"],
    fetchAgents,
    {
      refreshInterval: 15000,
      dedupingInterval: 8000,
      revalidateOnFocus: false,
      fallbackData: [],
      keepPreviousData: true, // Prevent flash when revalidating
    }
  );

  // Toggle agent visibility (memoized)
  const toggleAgent = useCallback((agentName: string) => {
    setHiddenAgents((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(agentName)) {
        newSet.delete(agentName);
      } else {
        newSet.add(agentName);
      }
      return newSet;
    });
  }, []);

  // Fetch historical balance data
  const { data: balanceHistory } = useSWR(
    ["balance-history", timeframe],
    () => fetchBalanceHistory(hoursForTimeframe(timeframe)),
    {
      refreshInterval: 30000,
      dedupingInterval: 15000,
      revalidateOnFocus: false,
      fallbackData: {},
      keepPreviousData: true, // Smooth transition when changing timeframe
    }
  );

  // Prepare chart data
  const chartData = useMemo(() => {
    if (!agents || agents.length === 0) return [];

    const rangeMs = hoursForTimeframe(timeframe) * 60 * 60 * 1000;
    const now = new Date().getTime();
    const startTime = now - rangeMs;

    // Collect all timestamps across all agents
    const timestampSet = new Set<number>();
    const agentDataMap: Record<string, Map<number, number>> = {};

    agents.forEach((agent) => {
      const agentKey = mapLLM(agent.model)
        .name.toLowerCase()
        .replace(/\s+/g, "_");
      const history = balanceHistory?.[agent.id];
      const dataMap = new Map<number, number>();

      if (history && history.length > 0) {
        history
          .filter((h) => new Date(h.timestamp).getTime() >= startTime)
          .forEach((h) => {
            const timestamp = new Date(h.timestamp).getTime();
            timestampSet.add(timestamp);
            dataMap.set(timestamp, h.balance);
          });
      } else {
        // Use fallback data
        const fallback = generateFallbackData(agent, timeframe);
        fallback.forEach((p) => {
          timestampSet.add(p.timestamp);
          dataMap.set(p.timestamp, p.value);
        });
      }

      agentDataMap[agentKey] = dataMap;
    });

    // Sort timestamps
    const timestamps = Array.from(timestampSet).sort((a, b) => a - b);

    // Build chart data array
    const data = timestamps.map((timestamp, index) => {
      const point: Record<string, number | string | boolean> = {
        timestamp,
        time: new Date(timestamp).toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        isLast: index === timestamps.length - 1,
      };

      agents.forEach((agent) => {
        const agentKey = mapLLM(agent.model)
          .name.toLowerCase()
          .replace(/\s+/g, "_");
        const value = agentDataMap[agentKey]?.get(timestamp);

        if (value !== undefined) {
          point[agentKey] =
            mode === "percent" ? ((value - 100) / 100) * 100 : value;
        }
      });

      return point;
    });

    // Sample data for better performance on large timeframes
    const maxPoints =
      timeframe === "24h" ? 100 : timeframe === "12h" ? 80 : 150;
    return sampleData(data, maxPoints);
  }, [agents, balanceHistory, timeframe, mode]);

  return (
    <div className="rounded-xl bg-black/90 border border-slate-800/50 p-4 shadow-xl backdrop-blur-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-slate-300 font-semibold">
          AGENTS PERFORMANCE (Start $100 → Current Balance)
        </div>
        <div className="flex items-center gap-2">
          {/* USD vs Percent Toggle */}
          <button
            className={`px-2 py-1 rounded text-xs ${
              mode === "usd"
                ? "bg-slate-800 text-slate-100"
                : "bg-slate-800/40 text-slate-400"
            }`}
            onClick={() => setMode("usd")}
          >
            $
          </button>
          <button
            className={`px-2 py-1 rounded text-xs ${
              mode === "percent"
                ? "bg-slate-800 text-slate-100"
                : "bg-slate-800/40 text-slate-400"
            }`}
            onClick={() => setMode("percent")}
          >
            %
          </button>

          {/* Timeframe Selector */}
          <div className="ml-4 flex items-center gap-1">
            {(["30m", "1h", "6h", "12h", "24h"] as TimeframeKey[]).map((tf) => (
              <button
                key={tf}
                className={`px-2 py-1 rounded text-xs ${
                  timeframe === tf
                    ? "bg-slate-800 text-slate-100"
                    : "bg-slate-800/40 text-slate-400"
                }`}
                onClick={() => setTimeframe(tf)}
              >
                {tf.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Agent Stats - Images and Current Balances */}
      {agents && agents.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-3">
          {agents.map((agent) => {
            const { name, logo, color } = mapLLM(agent.model);
            const balance = agent.balance || 100;
            const roi = agent.roi || 0;
            const roiColor = roi >= 0 ? "text-green-400" : "text-red-400";
            const roiSign = roi >= 0 ? "+" : "";

            return (
              <div
                key={agent.id}
                className="flex items-center gap-2 bg-slate-800/50 rounded-lg px-3 py-2 border border-slate-700/50"
                style={{
                  borderLeftColor: color,
                  borderLeftWidth: "3px",
                }}
              >
                {logo && (
                  <Image
                    src={logo}
                    alt={name}
                    width={24}
                    height={24}
                    className="rounded"
                  />
                )}
                <div className="flex flex-col">
                  <div className="text-xs text-slate-400">{name}</div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">
                      ${balance.toFixed(2)}
                    </span>
                    <span className={`text-xs font-medium ${roiColor}`}>
                      ({roiSign}
                      {roi.toFixed(1)}%)
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Recharts Line Chart */}
      {chartData && chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={400}>
          <LineChart
            data={chartData}
            margin={{ top: 20, right: 50, bottom: 40, left: 10 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis
              dataKey="time"
              stroke="#9ca3af"
              style={{ fontSize: "11px" }}
              interval="preserveStartEnd"
            />
            <YAxis
              stroke="#9ca3af"
              style={{ fontSize: "11px" }}
              tickFormatter={(value) =>
                mode === "percent"
                  ? `${value.toFixed(1)}%`
                  : `$${value.toFixed(0)}`
              }
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "rgba(0, 0, 0, 0.9)",
                border: "1px solid #374151",
                borderRadius: "8px",
              }}
              labelStyle={{ color: "#9ca3af" }}
              formatter={(value: number) =>
                mode === "percent"
                  ? `${value.toFixed(2)}%`
                  : `$${value.toFixed(2)}`
              }
              animationDuration={200}
            />
            <Legend
              content={
                <CustomLegend
                  hiddenAgents={hiddenAgents}
                  onToggle={toggleAgent}
                />
              }
              wrapperStyle={{ fontSize: "12px" }}
            />

            {/* Reference line at starting point */}
            {mode === "percent" && (
              <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="3 3">
                <Label
                  value="Start (0%)"
                  position="insideTopLeft"
                  style={{ fill: "#9ca3af", fontSize: "10px" }}
                />
              </ReferenceLine>
            )}
            {mode === "usd" && (
              <ReferenceLine y={100} stroke="#9ca3af" strokeDasharray="3 3">
                <Label
                  value="Start ($100)"
                  position="insideTopLeft"
                  style={{ fill: "#9ca3af", fontSize: "10px" }}
                />
              </ReferenceLine>
            )}

            {/* Lines for each agent */}
            {agents &&
              agents.map((agent) => {
                const { name, color } = mapLLM(agent.model);
                const agentKey = name.toLowerCase().replace(/\s+/g, "_");
                const isHidden = hiddenAgents.has(name);

                return (
                  <Line
                    key={agent.id}
                    type="monotone"
                    dataKey={agentKey}
                    stroke={color}
                    strokeWidth={2}
                    strokeOpacity={isHidden ? 0 : 1}
                    activeDot={isHidden ? false : { r: 6 }}
                    name={name}
                    dot={isHidden ? false : <CustomEndDot agents={agents} />}
                    hide={false}
                    isAnimationActive={true}
                  />
                );
              })}
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="text-xs text-slate-400 h-[400px] flex items-center justify-center">
          {isLoading
            ? "Loading chart data…"
            : "No data available for selected timeframe."}
        </div>
      )}
    </div>
  );
}
