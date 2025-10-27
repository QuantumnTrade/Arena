"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import useSWR from "swr";
import { fetchAgents, fetchBalanceHistory } from "@/lib/api";
import type { Agent } from "@/types";

type Mode = "usd" | "percent";

type RangeKey = "ALL" | "24H" | "72H";

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
      color: "#c084fc",
    };
  if (m.includes("gemini"))
    return {
      name: "GEMINI 2.5 PRO",
      logo: "/icons/Gemini_logo.webp",
      color: "#fb923c",
    };
  if (m.includes("grok") || m.includes("xai"))
    return { name: "GROK 4", logo: "/icons/Grok_logo.webp", color: "#22c55e" };
  if (m.includes("deepseek"))
    return {
      name: "DEEPSEEK CHAT V3.1",
      logo: "/icons/deepseek_logo.png",
      color: "#ec4899",
    };
  if (m.includes("qwen"))
    return {
      name: "QWEN3 MAX",
      logo: "/icons/qwen_logo.png",
      color: "#14b8a6",
    };
  return { name: raw.toUpperCase(), logo: "", color: autoColor(raw) };
}

// Whitelist model LLM yang boleh tampil di grafik
const ALLOWED_LABELS = [
  "CLAUDE SONNET 4.5",
  "DEEPSEEK CHAT V3.1",
  "GEMINI 2.5 PRO",
  "GROK 4",
  "GPT 5",
  "QWEN3 MAX",
] as const;
const isAllowedLabel = (label: string) =>
  (ALLOWED_LABELS as readonly string[]).includes(label);

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStrToInt(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return h >>> 0;
}

function hoursForRange(range: RangeKey): number {
  if (range === "ALL") return 96;
  if (range === "72H") return 72;
  return 24;
}

// Fallback: Generate simulated data if no historical data exists
function generateFallbackData(
  agent: Agent,
  range: RangeKey
): { time: number; value: number }[] {
  const hours = hoursForRange(range);
  const currentBalance = agent.balance || 100;
  const startTime = Date.now() - hours * 60 * 60 * 1000;
  
  // Simple linear interpolation from 100 to current balance
  const points: { time: number; value: number }[] = [];
  const steps = Math.min(hours, 20); // Max 20 points for fallback
  
  for (let i = 0; i <= steps; i++) {
    const progress = i / steps;
    const value = 100 + (currentBalance - 100) * progress;
    const time = Math.floor((startTime + (hours * 60 * 60 * 1000 * progress)) / 1000);
    points.push({ time, value });
  }
  
  return points;
}

function simulateSeries(agent: Agent, range: RangeKey) {
  const hours = hoursForRange(range);
  const steps = hours * 4;
  const start = Date.now() - hours * 60 * 60 * 1000;
  const seed = hashStrToInt(`${agent.id}-${agent.model}`);
  const rand = mulberry32(seed);

  const base = 100;
  const targetRaw = Number.isFinite(agent.balance)
    ? agent.balance
    : base * (1 + (agent.roi ?? 0) / 100) + (agent.total_pnl ?? 0);
  const target = Number.isFinite(targetRaw) ? targetRaw : base;
  const drift = (target - base) / steps;

  const vol = Math.max(
    0.005,
    Math.min(
      0.12,
      (Math.abs(agent.roi ?? 0) / 100) * 0.6 +
        (agent.trade_count ?? 0) * 0.001 +
        (agent.active_positions ?? 0) * 0.02
    )
  );

  const series: { time: number; value: number }[] = [];
  let v = base;
  for (let i = 0; i < steps; i++) {
    const noise = (rand() - 0.5) * 2 * vol * base;
    v = Math.max(200, v + drift + noise);
    const t = Math.floor(
      (start + i * ((hours * 60 * 60 * 1000) / steps)) / 1000
    );
    series.push({ time: t, value: v });
  }
  series[series.length - 1] = {
    time: Math.floor(Date.now() / 1000),
    value: target,
  };
  return series;
}

function toPercent(points: { time: number; value: number }[]) {
  if (!points.length) return points;
  const base = points[0].value;
  
  // Handle zero or very small starting balance
  if (base === 0 || !Number.isFinite(base)) {
    // If starting balance is 0, show absolute change from 0
    return points.map((p) => ({
      time: p.time,
      value: p.value, // Show actual value instead of percent
    }));
  }
  
  return points.map((p) => ({
    time: p.time,
    value: ((p.value - base) / base) * 100,
  }));
}

export default function AccountValueChart() {
  const [mode, setMode] = useState<Mode>("usd");
  const [range, setRange] = useState<RangeKey>("ALL");
  const containerRef = useRef<HTMLDivElement | null>(null);

  const { data: agents, isLoading } = useSWR<Agent[]>(
    ["supabase", "agents-for-chart"],
    fetchAgents,
    {
      refreshInterval: 15000,
      dedupingInterval: 8000,
      revalidateOnFocus: false,
      fallbackData: [],
    }
  );

  // Fetch historical balance data
  const { data: balanceHistory } = useSWR(
    ["balance-history", range],
    () => fetchBalanceHistory(hoursForRange(range)),
    {
      refreshInterval: 30000, // Refresh every 30 seconds
      dedupingInterval: 15000,
      revalidateOnFocus: false,
      fallbackData: {},
    }
  );

  const agentSeries = useMemo(() => {
    const map: Record<string, { time: number; value: number }[]> = {};
    const now = Date.now();
    const rangeMs = hoursForRange(range) * 60 * 60 * 1000;
    const startTime = now - rangeMs;
    
    (agents ?? []).forEach((a) => {
      const label = mapLLM(a.model).name;
      const history = balanceHistory?.[a.id];
      
      if (history && history.length > 0) {
        // Use real historical data - filter by timeframe and sort
        const filteredData = history
          .map(h => ({
            time: Math.floor(new Date(h.timestamp).getTime() / 1000),
            value: h.balance,
            timestamp: new Date(h.timestamp).getTime(),
          }))
          .filter(h => {
            // Filter by timeframe AND validate data
            return h.timestamp >= startTime && 
                   Number.isFinite(h.value) && 
                   h.value >= 0; // Allow zero balance
          })
          .sort((a, b) => a.time - b.time); // Ensure chronological order
        
        // Deduplicate by timestamp (keep last value if multiple entries at same time)
        const deduplicated: { time: number; value: number }[] = [];
        const timeMap = new Map<number, number>();
        
        filteredData.forEach(({ time, value }) => {
          timeMap.set(time, value); // Overwrites if duplicate
        });
        
        // Convert back to array
        timeMap.forEach((value, time) => {
          deduplicated.push({ time, value });
        });
        
        // Sort again after deduplication
        deduplicated.sort((a, b) => a.time - b.time);
        
        map[label] = deduplicated;
        
        // If no data in range, use fallback
        if (map[label].length === 0) {
          map[label] = generateFallbackData(a, range);
        }
      } else {
        // Fallback to simulated data if no history exists yet
        map[label] = generateFallbackData(a, range);
      }
    });
    
    return map;
  }, [agents, range, balanceHistory]);

  const allLabels = useMemo(
    () => Array.from(new Set((agents ?? []).map((a) => mapLLM(a.model).name))),
    [agents]
  );
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    if (!agents || agents.length === 0 || selected.length > 0) return;
    const unique = Array.from(
      new Set((agents ?? []).map((a) => mapLLM(a.model).name))
    );
    if (unique.length > 0) setSelected(unique);
  }, [agents, selected.length]);

  const labels = selected.filter((l) => agentSeries[l]);
  const ready = labels.length > 0;

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !ready) return;

    let chart: any = null;
    let cleanup: () => void = () => {};

    (async () => {
      const lib = await import("lightweight-charts");
      chart = lib.createChart(el, {
        width: el.clientWidth,
        height: 480,
        layout: {
          background: { type: lib.ColorType.Solid, color: "transparent" },
          textColor: "#e5e7eb",
        },
        grid: {
          vertLines: { color: "#1f2937" },
          horzLines: { color: "#1f2937" },
        },
        timeScale: {
          borderColor: "#1f2937",
          timeVisible: true,
          secondsVisible: false,
          rightOffset: 5,
          barSpacing: 6,
          minBarSpacing: 3,
          fixLeftEdge: true,
          fixRightEdge: true,
        },
        rightPriceScale: {
          borderColor: "#1f2937",
          scaleMargins: {
            top: 0.1,
            bottom: 0.1,
          },
        },
      });

      const basePoints = (agentSeries[labels[0]] ?? []).map((p) => ({
        time: p.time,
        value: 100,
      }));
      const baseline = chart.addSeries(lib.LineSeries, {
        color: "#9ca3af",
        lineWidth: 1,
        lineStyle: lib.LineStyle.Dotted,
      });
      baseline.setData(
        mode === "percent"
          ? basePoints.map((p) => ({ time: p.time, value: 0 }))
          : basePoints
      );

      labels.forEach((label) => {
        const { color } = mapLLM(label);
        const s = chart.addSeries(lib.LineSeries, {
          color,
          lineWidth: 3,
          priceLineVisible: false,
          lastValueVisible: true,
          crosshairMarkerVisible: true,
          crosshairMarkerRadius: 4,
        });
        const data = agentSeries[label] ?? [];
        const chartData = mode === "percent" ? toPercent(data) : data;
        
        // Ensure data is sorted and valid
        const validData = chartData
          .filter(d => {
            // Strict validation
            return d.time && 
                   Number.isFinite(d.time) && 
                   Number.isFinite(d.value) &&
                   d.time > 0;
          })
          .sort((a, b) => a.time - b.time);
        
        // Only set data if we have valid points
        if (validData.length > 0) {
          s.setData(validData);
        }
      });
      
      // Fit content to show all data points
      chart.timeScale().fitContent();

      const onResize = () => chart.applyOptions({ width: el.clientWidth });
      window.addEventListener("resize", onResize);
      cleanup = () => {
        window.removeEventListener("resize", onResize);
        chart.remove();
      };
    })();

    return () => cleanup();
  }, [ready, mode, range, labels.join("|")]);

  const legendSpecs = useMemo(
    () => allLabels.map((k) => mapLLM(k)),
    [allLabels]
  );

  return (
    <div className="rounded-xl bg-black/90 border border-slate-800/50 p-4 shadow-xl backdrop-blur-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-slate-300 font-semibold">
          AGENTS PERFORMANCE (Start $100 → Current Balance)
        </div>
        <div className="flex items-center gap-2">
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
          <div className="ml-4 flex items-center gap-1">
            {(["ALL", "72H", "24H"] as RangeKey[]).map((rk) => (
              <button
                key={rk}
                className={`px-2 py-1 rounded text-xs ${
                  range === rk
                    ? "bg-slate-800 text-slate-100"
                    : "bg-slate-800/40 text-slate-400"
                }`}
                onClick={() => setRange(rk)}
              >
                {rk}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!ready && (
        <div className="text-xs text-slate-400">
          {isLoading ? "Loading agents…" : "No agent data available."}
        </div>
      )}

      <div ref={containerRef} className="w-full h-[480px]" />

      {legendSpecs.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {legendSpecs.map((spec) => {
            const active = labels.includes(spec.name);
            return (
              <button
                key={spec.name}
                onClick={() => {
                  setSelected((prev) =>
                    prev.includes(spec.name)
                      ? prev.filter((l) => l !== spec.name)
                      : [...prev, spec.name]
                  );
                }}
                className={`flex items-center gap-2 text-xs px-2 py-1 rounded border transition-colors ${
                  active
                    ? "bg-slate-800 text-slate-100"
                    : "bg-slate-800/40 text-slate-400"
                }`}
                style={
                  active
                    ? {
                        borderColor: spec.color,
                        boxShadow: `0 0 0 1px ${spec.color}55, 0 0 8px ${spec.color}33`,
                      }
                    : { borderColor: "#334155" }
                }
                title={active ? "Click to hide" : "Click to show"}
              >
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: spec.color }}
                ></span>
                {spec.logo && (
                  <Image
                    src={spec.logo}
                    alt={spec.name}
                    width={16}
                    height={16}
                    className="h-4 w-4 rounded-sm"
                  />
                )}
                <span>{spec.name}</span>
              </button>
            );
          })}
          <span className="text-[10px] text-slate-500">
            click label to toggle
          </span>
        </div>
      )}
    </div>
  );
}

function autoColor(label: string) {
  const seed = hashStrToInt(label);
  const rng = mulberry32(seed);
  const h = Math.floor(rng() * 360);
  const s = 70;
  const l = 55;
  const S = s / 100;
  const L = l / 100;
  const c = (1 - Math.abs(2 * L - 1)) * S;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = L - c / 2;
  let r = 0,
    g = 0,
    b = 0;
  if (h < 60) {
    r = c;
    g = x;
    b = 0;
  } else if (h < 120) {
    r = x;
    g = c;
    b = 0;
  } else if (h < 180) {
    r = 0;
    g = c;
    b = x;
  } else if (h < 240) {
    r = 0;
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    g = 0;
    b = c;
  } else {
    r = c;
    g = 0;
    b = x;
  }
  const toHex = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
