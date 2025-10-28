import type {
  Agent,
  Indicators,
  Snapshot,
  Ticker,
  TimeseriesPoint,
} from "@/types";

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const TICKER_PATH = process.env.NEXT_PUBLIC_TICKER_PATH || "/api/ticker";
const INDICATOR_PATH =
  process.env.NEXT_PUBLIC_INDICATORS_PATH || "/api/market-snapshot";
const SERIES_PATH =
  process.env.NEXT_PUBLIC_TIMESERIES_PATH || "/api/timeseries";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_KEY;

const QUANTUM_SUPABASE_URL = process.env.NEXT_PUBLIC_QUANTUM_SUPABASE_URL;
const QUANTUM_SUPABASE_KEY = process.env.NEXT_PUBLIC_QUANTUM_SUPABASE_KEY;

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { next: { revalidate: 0 }, ...(init || {}) });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json();
}

function supabaseHeaders(): HeadersInit {
  if (!SUPABASE_KEY) throw new Error("Missing NEXT_PUBLIC_SUPABASE_KEY");
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
  };
}

function quantumSupabaseHeaders(): HeadersInit {
  if (!QUANTUM_SUPABASE_KEY)
    throw new Error("Missing NEXT_PUBLIC_QUANTUM_SUPABASE_KEY");
  return {
    apikey: QUANTUM_SUPABASE_KEY,
    Authorization: `Bearer ${QUANTUM_SUPABASE_KEY}`,
    "Content-Type": "application/json",
  };
}

export async function fetchTicker(symbol: string): Promise<Ticker> {
  // 1) Try Supabase REST 'prices' table (skip RPC entirely)
  // if (SUPABASE_URL) {
  //   try {
  //     const restUrl = `${SUPABASE_URL}/rest/v1/prices?select=symbol,price&symbol=eq.${encodeURIComponent(
  //       symbol
  //     )}&limit=1`;
  //     const rows2 = await fetchJSON<Array<{ symbol: string; price: number }>>(
  //       restUrl,
  //       { headers: supabaseHeaders() }
  //     );
  //     const row2 = rows2?.[0];
  //     if (row2 && typeof row2.price === "number") {
  //       return { symbol: row2.symbol, price: row2.price };
  //     }
  //   } catch (err) {
  //     // ignore and continue to BASE_URL/local
  //   }
  // }

  // 2) Fallback to external BASE_URL if configured
  if (BASE_URL) {
    const url = `${BASE_URL}${TICKER_PATH}?symbol=${encodeURIComponent(
      symbol
    )}`;
    try {
      const t = await fetchJSON<Ticker>(url);
      // Validate price
      if (t && Number.isFinite(t.price) && t.price > 0) return t;
    } catch (err) {
      console.warn(`[API] fetchTicker failed, using local fallback:`, err);
    }
  }

  // 3) Local dummy
  const price = 80000 + Math.random() * 5000;
  return { symbol, price: Number(price.toFixed(2)) };
}

export async function fetchIndicators(symbol: string): Promise<Indicators> {
  // 1) Fetch snapshot and parse interval 1m
  try {
    const localUrl = `${INDICATOR_PATH}?symbol=${encodeURIComponent(symbol)}`; // e.g., /api/market-snapshot
    const snapshot = await fetchJSON<any>(localUrl);

    // Support both object and array responses
    const pickSnapshot = (data: any) => {
      if (Array.isArray(data)) {
        return (
          data.find(
            (d) => (d.symbol || "").toUpperCase() === symbol.toUpperCase()
          ) || data[0]
        );
      }
      return data;
    };

    const snap = pickSnapshot(snapshot);
    const intervals = snap?.intervals || {};
    const i1m =
      intervals["1m"] || intervals["1M"] || intervals["oneMinute"] || null;

    if (!i1m) throw new Error("Snapshot missing 1m interval");

    // Normalize potential field names from 1m payload
    const macdValue =
      typeof i1m.macd === "number"
        ? i1m.macd
        : typeof i1m.macd?.value === "number"
        ? i1m.macd.value
        : undefined;

    return {
      sma1m: i1m.sma ?? i1m.sma1m ?? 0,
      ema1m: i1m.ema ?? i1m.ema1m ?? 0,
      rsi: i1m.rsi,
      macd: macdValue,
      atr: i1m.atr,
      ao: i1m.ao,
      vol: i1m.volume ?? i1m.vol,
      obv: i1m.obv,
      sup: i1m.support ?? i1m.sup,
    };
  } catch (err) {
    // continue to local dummy
  }

  // 2) Local dummy
  return {
    sma1m: 0,
    ema1m: 0,
    rsi: undefined,
    macd: undefined,
    atr: undefined,
    ao: undefined,
    vol: undefined,
    obv: undefined,
    sup: undefined,
  };
}

/**
 * Fetch full market snapshot for a symbol
 * Returns object containing { symbol, price, data_timestamp|timestamp, intervals }
 * without altering server route shape.
 */
export async function fetchMarketSnapshot(symbol: string): Promise<any> {
  // Build absolute URL for server-side calls
  let url: string;

  if (BASE_URL) {
    // If BASE_URL is set, use it (external API)
    url = `${BASE_URL}${INDICATOR_PATH}?symbol=${encodeURIComponent(symbol)}`;
  } else {
    // For internal API calls, use absolute URL with current host
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (typeof window !== "undefined"
        ? window.location.origin
        : "http://localhost:3000");
    url = `${baseUrl}${INDICATOR_PATH}?symbol=${encodeURIComponent(symbol)}`;
  }

  console.log(`[API] Fetching market snapshot from: ${url}`);

  try {
    const data = await fetchJSON<any>(url);

    console.log(`[API] Market snapshot response for ${symbol}:`, {
      hasData: !!data,
      isArray: Array.isArray(data),
      price: Array.isArray(data) ? data[0]?.price : data?.price,
      hasIntervals: Array.isArray(data)
        ? !!data[0]?.intervals
        : !!data?.intervals,
    });

    if (Array.isArray(data)) {
      return (
        data.find(
          (d) => (d.symbol || "").toUpperCase() === symbol.toUpperCase()
        ) || data[0]
      );
    }
    return data;
  } catch (err) {
    console.error(`[API] Failed to fetch market snapshot for ${symbol}:`, err);
    // Minimal fallback structure to keep consumer robust
    return {
      symbol,
      price: 0,
      data_timestamp: new Date().toISOString(),
      intervals: { "1m": {} },
    };
  }
}

export async function fetchTimeseries(
  symbol: string,
  interval: string
): Promise<TimeseriesPoint[]> {
  if (!BASE_URL) {
    const now = Math.floor(Date.now() / 1000);
    const points: TimeseriesPoint[] = Array.from({ length: 180 }, (_, i) => {
      const time = now - (180 - i) * 60;
      const base = 80000 + Math.sin(i / 8) * 400 + Math.random() * 150;
      return { time, value: Number(base.toFixed(2)) };
    });
    return points;
  }
  const url = `${BASE_URL}${SERIES_PATH}?symbol=${encodeURIComponent(
    symbol
  )}&interval=${encodeURIComponent(interval)}`;
  return fetchJSON<TimeseriesPoint[]>(url);
}

export async function fetchAgents(): Promise<Agent[]> {
  if (!QUANTUM_SUPABASE_URL || !QUANTUM_SUPABASE_KEY) {
    // Env tidak lengkap: kembalikan list kosong agar UI stabil pada initial load
    return [];
  }
  try {
    const url = `${QUANTUM_SUPABASE_URL}/rest/v1/agents?select=id,model,balance,total_pnl,roi,trade_count,win_count,loss_count,win_rate,active_positions,is_active,available_capital,credential_key,system_prompt,last_user_prompt,created_at,updated_at&order=model.asc`;
    return await fetchJSON<Agent[]>(url, { headers: quantumSupabaseHeaders() });
  } catch (err) {
    // Propagate error agar SWR menjaga data sebelumnya dan UI tidak kosong saat timeout
    const e = err instanceof Error ? err : new Error("fetchAgents failed");
    throw e;
  }
}

export async function fetchSnapshots(fromISO?: string): Promise<Snapshot[]> {
  if (!SUPABASE_URL) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  const filter = fromISO
    ? `&snapshot_time=gte.${encodeURIComponent(fromISO)}`
    : "";
  const url = `${SUPABASE_URL}/rest/v1/snapshots?select=snapshot_time,models_data,total_balance${filter}&order=snapshot_time.asc`;
  return fetchJSON<Snapshot[]>(url, { headers: supabaseHeaders() });
}

/**
 * Fetch balance history for all agents
 * Used for real-time charting
 */
export async function fetchBalanceHistory(
  hours: number = 96
): Promise<Record<string, Array<{ timestamp: string; balance: number }>>> {
  if (!QUANTUM_SUPABASE_URL || !QUANTUM_SUPABASE_KEY) {
    return {};
  }

  try {
    const startTime = new Date(
      Date.now() - hours * 60 * 60 * 1000
    ).toISOString();
    const url = `${QUANTUM_SUPABASE_URL}/rest/v1/agent_balance_history?timestamp=gte.${startTime}&select=agent_id,timestamp,balance&order=timestamp.asc`;

    const data: Array<{
      agent_id: string;
      timestamp: string;
      balance: number;
    }> = await fetchJSON(url, { headers: quantumSupabaseHeaders() });

    // Group by agent_id
    const grouped: Record<
      string,
      Array<{ timestamp: string; balance: number }>
    > = {};

    for (const item of data) {
      if (!grouped[item.agent_id]) {
        grouped[item.agent_id] = [];
      }
      grouped[item.agent_id].push({
        timestamp: item.timestamp,
        balance: item.balance,
      });
    }

    return grouped;
  } catch (err) {
    console.error("Failed to fetch balance history:", err);
    return {};
  }
}

// Removed: fetchLatestMarketData (Supabase RPC) — indicators now sourced via /api/indicators
