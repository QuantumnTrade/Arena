// Compute common technical indicators from OHLCV klines
import type { Kline } from "./exchange-data";
import type { Indicators } from "@/types";

function avg(arr: number[]): number {
  if (!arr.length) return 0;
  const s = arr.reduce((a, b) => a + b, 0);
  return s / arr.length;
}

function ema(values: number[], period: number): number {
  if (!values.length) return 0;
  const k = 2 / (period + 1);
  let emaVal = values[0];
  for (let i = 1; i < values.length; i++) {
    emaVal = values[i] * k + emaVal * (1 - k);
  }
  return emaVal;
}

function sma(values: number[], period: number): number {
  if (values.length < period) return avg(values.slice(-period));
  return avg(values.slice(-period));
}

function rsi(values: number[], period = 14): number {
  if (values.length < period + 1) return 50;
  let gains = 0;
  let losses = 0;
  for (let i = values.length - period; i < values.length; i++) {
    const delta = values[i] - values[i - 1];
    if (delta >= 0) gains += delta;
    else losses -= delta;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function macd(values: number[], fast = 12, slow = 26, signal = 9): number {
  if (values.length < slow + signal) return 0;
  const macdLine = ema(values, fast) - ema(values, slow);
  // For a single-point estimate, approximate signal as EMA of macdLine using last values
  // In practice, you’d compute the MACD series; here we return the MACD line.
  return macdLine;
}

function atr(klines: Kline[], period = 14): number {
  if (klines.length < period + 1) return 0;
  let trs: number[] = [];
  for (let i = klines.length - period; i < klines.length; i++) {
    const curr = klines[i];
    const prev = klines[i - 1] || curr;
    const tr = Math.max(
      curr.high - curr.low,
      Math.abs(curr.high - prev.close),
      Math.abs(curr.low - prev.close)
    );
    trs.push(tr);
  }
  return avg(trs);
}

function awesomeOscillator(
  klines: Kline[],
  shortPeriod = 5,
  longPeriod = 34
): number {
  if (klines.length < longPeriod) return 0;
  const medians = klines.map((k) => (k.high + k.low) / 2);
  const short = sma(medians, shortPeriod);
  const long = sma(medians, longPeriod);
  return short - long;
}

function obv(klines: Kline[]): number {
  if (!klines.length) return 0;
  let result = 0;
  for (let i = 1; i < klines.length; i++) {
    const sign =
      klines[i].close > klines[i - 1].close
        ? 1
        : klines[i].close < klines[i - 1].close
        ? -1
        : 0;
    result += sign * klines[i].volume;
  }
  return result;
}

function supportLevel(klines: Kline[], lookback = 20): number {
  const slice = klines.slice(-lookback);
  if (!slice.length) return 0;
  return slice.reduce((min, k) => (k.low < min ? k.low : min), slice[0].low);
}

export function computeIndicatorsFromKlines(klines: Kline[]): Indicators {
  const closes = klines.map((k) => k.close);
  const volumes = klines.map((k) => k.volume);

  return {
    sma1m: sma(closes, 14),
    ema1m: ema(closes, 14),
    rsi: rsi(closes, 14),
    macd: macd(closes, 12, 26, 9),
    atr: atr(klines, 14),
    ao: awesomeOscillator(klines, 5, 34),
    vol: volumes.slice(-14).reduce((a, b) => a + b, 0),
    obv: obv(klines),
    sup: supportLevel(klines, 20),
  };
}
