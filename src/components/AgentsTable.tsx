"use client";
import React from "react";
import type { Agent } from "@/types";

interface Props {
  agents: Agent[];
  loading?: boolean;
}

function normalizeModel(raw: string) {
  const lower = raw.toLowerCase();
  const noAccents = lower.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return noAccents.replace(/\s+/g, "");
}

function mapLLM(model?: string) {
  const raw = model ?? "-";
  const m = normalizeModel(raw);
  if (m.includes("openai") || m.includes("gpt"))
    return { name: "GPT 5", logo: "/icons/GPT_logo.png" };
  if (m.includes("claude") || m.includes("anthropic") || m.includes("sonnet"))
    return { name: "CLAUDE SONNET 4.5", logo: "/icons/Claude_logo.png" };
  if (m.includes("gemini"))
    return { name: "GEMINI 2.5 PRO", logo: "/icons/Gemini_logo.webp" };
  if (m.includes("grok") || m.includes("xai"))
    return { name: "GROK 4", logo: "/icons/Grok_logo.webp" };
  if (m.includes("deepseek"))
    return { name: "DEEPSEEK CHAT V3.1", logo: "/icons/deepseek_logo.png" };
  if (m.includes("qwen"))
    return { name: "QWEN3 MAX", logo: "/icons/qwen_logo.png" };
  return { name: raw.toUpperCase(), logo: "" };
}

// Helpers to format numbers
const fmtCurrency = (n?: number) =>
  typeof n === "number" ? `$${n.toLocaleString()}` : "-";
const fmtCurrencySigned = (n?: number) =>
  typeof n === "number"
    ? `${n >= 0 ? "+" : ""}$${Math.abs(n).toLocaleString()}`
    : "-";
const fmtPercent = (n?: number) =>
  typeof n === "number" ? `${n.toFixed(2)}%` : "-";
const fmtPercentSigned = (n?: number) =>
  typeof n === "number" ? `${n >= 0 ? "+" : ""}${n.toFixed(2)}%` : "-";
const fmtInt = (n?: number) => (typeof n === "number" ? `${n}` : "-");

// Digit roll component to animate each digit scrolling
const DigitRoll: React.FC<{ digit: number }> = ({ digit }) => {
  const items = React.useMemo(
    () => Array.from({ length: 10 }, (_, i) => i),
    []
  );
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    const t = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(t);
  }, []);
  const translate = mounted ? `translateY(-${digit}em)` : "translateY(0)";
  return (
    <span className="digit-roll">
      <span className="digit-roll-inner" style={{ transform: translate }}>
        {items.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </span>
    </span>
  );
};

function renderRollingText(text: string) {
  return (
    <span className="digits-tabular">
      {text.split("").map((ch, idx) => {
        const code = ch.charCodeAt(0);
        const d = code - 48;
        const isDigit = d >= 0 && d <= 9;
        return isDigit ? (
          <DigitRoll key={idx} digit={d} />
        ) : (
          <span key={idx} className="digit-static">
            {ch}
          </span>
        );
      })}
    </span>
  );
}

// Small component to detect value changes and apply color animation
function ChangeValue({
  id,
  field,
  value,
  formatter,
  signColor,
}: {
  id: string;
  field: string;
  value?: number;
  formatter: (v?: number) => string;
  signColor?: boolean;
}) {
  const prev = React.useRef<number | undefined>(undefined);
  const [flash, setFlash] = React.useState<"up" | "down" | null>(null);

  React.useEffect(() => {
    const p = prev.current;
    if (typeof p === "number" && typeof value === "number") {
      if (value > p) setFlash("up");
      else if (value < p) setFlash("down");
      else setFlash(null);
      const t = setTimeout(() => setFlash(null), 800);
      return () => clearTimeout(t);
    }
    prev.current = value;
  }, [id, field, value]);

  React.useEffect(() => {
    prev.current = value;
  }, [value]);

  const baseColor = signColor
    ? typeof value === "number"
      ? value > 0
        ? "text-green-400"
        : value < 0
        ? "text-red-400"
        : "text-slate-100"
      : "text-slate-100"
    : "text-slate-100";

  const flashCls =
    flash === "up" ? "flash-up" : flash === "down" ? "flash-down" : "";

  return (
    <span
      className={`inline-block rounded px-1 transition-colors duration-500 ${baseColor} ${flashCls}`}
    >
      {renderRollingText(formatter(value))}
    </span>
  );
}

export default function AgentsTable({ agents, loading }: Props) {
  return (
    <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
      {loading && (
        <div className="text-xs text-slate-400 mb-2">Loading agents…</div>
      )}
      <table className="min-w-[640px] sm:min-w-full text-sm w-full">
        <thead>
          <tr className="text-slate-400 text-xs sm:text-sm">
            <th className="px-2 sm:px-3 py-2 text-left font-medium whitespace-nowrap">
              Model
            </th>
            <th className="px-2 sm:px-3 py-2 text-right font-medium whitespace-nowrap">
              Balance
            </th>
            <th className="px-2 sm:px-3 py-2 text-right font-medium whitespace-nowrap">
              Total PnL
            </th>
            <th className="px-2 sm:px-3 py-2 text-right font-medium whitespace-nowrap">
              ROI
            </th>
            <th className="px-2 sm:px-3 py-2 text-right font-medium whitespace-nowrap">
              Trades
            </th>
            <th className="px-2 sm:px-3 py-2 text-right font-medium whitespace-nowrap">
              Win Rate
            </th>
            <th className="px-2 sm:px-3 py-2 text-right font-medium whitespace-nowrap">
              Active Pos.
            </th>
          </tr>
        </thead>
        <tbody>
          {agents && agents.length > 0 ? (
            agents.map((a) => (
              <tr
                key={a.id}
                className="border-t border-slate-800 text-xs sm:text-sm"
              >
                <td className="px-2 sm:px-3 py-2 text-slate-100 font-medium">
                  <div className="flex items-center gap-2">
                    {(() => {
                      const { name, logo } = mapLLM(a.model);
                      return (
                        <>
                          {logo && (
                            <img
                              src={logo}
                              alt={name}
                              className="h-5 w-5 rounded-sm"
                            />
                          )}
                          <span>{name}</span>
                        </>
                      );
                    })()}
                  </div>
                </td>
                <td className="px-2 sm:px-3 py-2 text-right">
                  <ChangeValue
                    id={a.id}
                    field="balance"
                    value={a.balance}
                    formatter={fmtCurrency}
                  />
                </td>
                <td className="px-2 sm:px-3 py-2 text-right">
                  <ChangeValue
                    id={a.id}
                    field="total_pnl"
                    value={a.total_pnl}
                    formatter={fmtCurrencySigned}
                    signColor
                  />
                </td>
                <td className="px-2 sm:px-3 py-2 text-right">
                  <ChangeValue
                    id={a.id}
                    field="roi"
                    value={a.roi}
                    formatter={fmtPercentSigned}
                    signColor
                  />
                </td>
                <td className="px-2 sm:px-3 py-2 text-right">
                  <ChangeValue
                    id={a.id}
                    field="trade_count"
                    value={a.trade_count}
                    formatter={fmtInt}
                  />
                </td>
                <td className="px-2 sm:px-3 py-2 text-right">
                  <ChangeValue
                    id={a.id}
                    field="win_rate"
                    value={a.win_rate}
                    formatter={fmtPercentSigned}
                    signColor
                  />
                </td>
                <td className="px-2 sm:px-3 py-2 text-right">
                  <ChangeValue
                    id={a.id}
                    field="active_positions"
                    value={a.active_positions}
                    formatter={fmtInt}
                  />
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={7} className="px-3 py-6 text-center text-slate-400">
                No agents data
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
