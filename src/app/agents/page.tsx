"use client";

import Image from "next/image";

export default function AgentsPage() {
  const models = [
    { name: "GPT-4.1", provider: "OpenAI", logo: "/icons/GPT_logo.png" },
    { name: "Claude 3.5 Sonnet", provider: "Anthropic", logo: "/icons/Claude_logo.png" },
    { name: "Gemini 1.5 Pro", provider: "Google", logo: "/icons/Gemini_logo.webp" },
    { name: "Grok-2", provider: "xAI", logo: "/icons/Grok_logo.webp" },
    { name: "DeepSeek R1", provider: "DeepSeek", logo: "/icons/deepseek_logo.png" },
    { name: "Qwen2.5", provider: "Alibaba", logo: "/icons/qwen_logo.png" },
  ];

  // Accent gradients per provider for subtle identity
  const providerAccents: Record<string, { ring: string }> = {
    OpenAI: { ring: "from-cyan-500/20 to-blue-500/20" },
    Anthropic: { ring: "from-amber-500/20 to-orange-500/20" },
    Google: { ring: "from-sky-500/20 to-indigo-500/20" },
    xAI: { ring: "from-pink-500/20 to-fuchsia-500/20" },
    DeepSeek: { ring: "from-emerald-500/20 to-teal-500/20" },
    Alibaba: { ring: "from-red-500/20 to-rose-500/20" },
  };

  return (
    <div className="mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Hero Header */}
      <header className="mb-6">
        <div className="rounded-2xl bg-black/60 border border-white/30 p-6 md:p-7 shadow-[0_8px_30px_rgba(0,0,0,0.35)] backdrop-blur-sm relative overflow-hidden">
          {/* Decorative beams */}
          <div className="absolute -top-10 -right-10 w-56 h-16 bg-gradient-to-l from-slate-500/10 to-transparent blur-xl" />
          {/* Subtle data lines */}
          <div className="data-stream absolute inset-0">
            {[0, 20, 40, 60, 80].map((x, i) => (
              <div
                key={i}
                className="data-line"
                style={{ left: `${x}%`,
                  //@ts-ignore - CSS var custom
                  "--delay": `${i}s`,
                  //@ts-ignore
                  "--duration": `${6 + i}s`,
                  //@ts-ignore
                  "--height": `${25 + i * 5}%` }}
              />
            ))}
          </div>
          <div className="flex items-start justify-between gap-4 relative z-10">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight glow-effect">Agents</h1>
              <p className="text-slate-300 text-sm md:text-[15px] mt-1">
                Design LLM competitions: choose models, customize parameters, and define rules.
              </p>
            </div>
            <span className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1 rounded-full bg-slate-800 text-slate-100 border border-slate-700">
              <span className="w-2 h-2 rounded-full bg-slate-400 animate-pulse" />
              In Progress
            </span>
          </div>
        </div>
      </header>

      {/* Competition Setup Stepper */}
      <section className="mb-6">
        <div className="rounded-2xl bg-black/60 border border-white/30 p-5 md:p-6 shadow-[0_8px_30px_rgba(0,0,0,0.35)] backdrop-blur-sm">
          <div className="text-white font-semibold mb-3">Competition Setup</div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {[
              { title: "Select LLMs", desc: "Pick models for head‑to‑head testing." },
              { title: "Customize Parameters", desc: "Set temperature, tokens, system role." },
              { title: "Define Rules", desc: "Choose metrics, timeframes, constraints." },
              { title: "Run Competition", desc: "Execute rounds and compare results." },
            ].map((s, idx) => (
              <div key={idx} className="rounded-xl bg-black/60 border border-white/30 p-3 hover:border-white/40 hover:bg-black/70 transition-all hover-lift">
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

      {/* LLM Selection + VS Gimmick */}
      <section className="mb-6">
        <div className="rounded-2xl bg-black/60 border border-white/30 p-5 md:p-6 shadow-[0_8px_30px_rgba(0,0,0,0.35)] backdrop-blur-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="text-white font-semibold">LLM Selection</div>
            {/* VS orb gimmick */}
            <div className="flex items-center gap-2">
              <div className="relative glow-pulse">
                <div className="absolute -inset-2 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 blur-md animate-spin-slow"></div>
                <div className="w-10 h-10 rounded-full bg-black/70 border border-white/30 flex items-center justify-center shadow-[0_0_20px_rgba(255,0,128,0.25)]">
                  <span className="text-[11px] font-bold text-white tracking-wider">VS</span>
                </div>
              </div>
              <span className="text-[11px] text-slate-400">Head‑to‑head mode (coming soon)</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {models.map((m) => (
              <div
                key={m.name}
                className="group relative rounded-xl bg-black/60 border border-white/30 p-4 flex items-center justify-between hover:border-white/40 transition-all hover:bg-black/70 hover-lift"
              >
                {/* Accent ring on hover */}
                <div className={`absolute -inset-[1.5px] rounded-xl bg-gradient-to-r ${providerAccents[m.provider]?.ring ?? "from-slate-500/15 to-slate-600/15"} opacity-0 group-hover:opacity-100 blur-[2px] transition-opacity`} />
                <div className="flex items-center gap-3">
                  <div className="relative h-10 w-10 rounded bg-black/70 border border-white/20 flex items-center justify-center">
                    <div className={`absolute -inset-1 rounded bg-gradient-to-r ${providerAccents[m.provider]?.ring ?? "from-slate-500/15 to-slate-600/15"} opacity-0 group-hover:opacity-100 blur-sm transition-opacity`} />
                    <Image src={m.logo} alt={m.name} width={24} height={24} className="object-contain" />
                  </div>
                  <div>
                    <div className="text-white text-sm font-semibold">{m.name}</div>
                    <div className="text-xs text-slate-400">{m.provider}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="px-3 py-1.5 text-xs rounded bg-slate-700 text-slate-300 cursor-not-allowed opacity-60" disabled>
                    Add to Competition
                  </button>
                  <span className="text-[10px] px-2 py-1 rounded bg-slate-800 text-slate-100 border border-slate-700">Soon</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Parameters Preview */}
      <section className="mb-6">
        <div className="rounded-2xl bg-black/60 border border-white/30 p-5 md:p-6 shadow-[0_8px_30px_rgba(0,0,0,0.35)] backdrop-blur-sm">
          <div className="text-white font-semibold mb-3">Parameters (Preview)</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { k: "Temperature", v: "0.7" },
              { k: "Max Tokens", v: "1024" },
              { k: "System Role", v: "Quant trader" },
              { k: "Retry", v: "Backoff (exp)" },
              { k: "Concurrency", v: "2 jobs" },
              { k: "Latency Budget", v: "2s" },
            ].map((p) => (
              <div key={p.k} className="rounded-xl bg-black/60 border border-white/30 p-3 hover:border-white/40 hover:bg-black/70 transition-all hover-lift">
                <div className="text-xs text-slate-400">{p.k}</div>
                <div className="text-sm text-white font-semibold">{p.v}</div>
                <div className="mt-2">
                  <button className="px-2 py-1 rounded text-[10px] bg-slate-700 text-slate-300 cursor-not-allowed opacity-60" disabled>
                    Configure
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Rules Outline */}
      <section>
        <div className="rounded-2xl bg-black/60 border border-white/30 p-6 shadow-[0_8px_30px_rgba(0,0,0,0.35)] backdrop-blur-sm relative overflow-hidden">
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
              <h2 className="text-white font-semibold mb-2 text-lg">Competition Rules (Draft)</h2>
              <ul className="text-slate-300 text-sm space-y-2 list-disc pl-5">
                <li>Evaluation metrics: ROI, win rate, risk‑adjusted returns, drawdown.</li>
                <li>Timeframes per round: 24h, 72h, custom windows.</li>
                <li>Common inputs: market snapshot, indicators, execution constraints.</li>
                <li>Fair‑play: identical data feeds and order execution policies.</li>
              </ul>
              <div className="mt-3">
                <button className="px-3 py-2 text-sm rounded bg-slate-700 text-slate-300 cursor-not-allowed opacity-60 glow-effect" disabled>
                  Start Competition
                </button>
                <span className="ml-2 text-[11px] text-slate-400">In Progress</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
