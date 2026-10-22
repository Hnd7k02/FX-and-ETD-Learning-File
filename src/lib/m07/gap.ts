/**
 * Figure (d) GapReplay, section 4: the franc shock of 15.01.2015 in ECB reference rates, and the
 * gap risk of stops and barriers. Pure, no DOM, no file access (the caller passes the raw CSV).
 *
 * Model (choice, see M07_CONFIG.gap): the series has one fixing per business day. An order
 * below the market (stop-loss that sells EUR, down-and-out barrier) is triggered by the first
 * fixing at or below its level and filled / knocked out at that fixing, the next price the
 * series knows. Everything between two fixings is invisible here.
 */
import { parseRawCsv } from '@/lib/data/csv';
import { pairSeries, type Pair, type Point } from '@/lib/data/series';
import { M07_CONFIG, PIP } from './config';

export type { Point as FixingPoint } from '@/lib/data/series';

/** Daily ECB fixings of a pair between two ISO dates (inclusive) from the raw CSV text. */
export function fixingsWindow(rawCsv: string, pair: Pair, from: string, to: string): Point[] {
  return pairSeries(parseRawCsv(rawCsv), pair).filter((p) => p.date >= from && p.date <= to);
}

/** One order or barrier below the market and what the series does to it. */
export interface GapOrder {
  level: number;
  /** Index of the triggering fixing in the series, or null if never reached. */
  index: number | null;
  /** The fixing it is filled / knocked out at (NaN if never). */
  fill: number;
  /** The fixing before the trigger (the last price above the level). */
  before: number;
  /** level − fill in pips (≥ 0): how far beyond the level the series jumped. */
  gapPips: number;
}

/** Applies the fill rule to every level (orders below the market, triggered by S ≤ level). */
export function gapOrders(series: readonly Point[], levels: readonly number[]): GapOrder[] {
  return levels.map((level) => {
    const index = series.findIndex((p) => p.value <= level);
    if (index < 0) return { level, index: null, fill: Number.NaN, before: Number.NaN, gapPips: 0 };
    const fill = series[index]!.value;
    const before = index > 0 ? series[index - 1]!.value : Number.NaN;
    return { level, index, fill, before, gapPips: (level - fill) / PIP };
  });
}

/** Largest one-day fall (log return) in the series: index of the day and the simple move. */
export function biggestDrop(series: readonly Point[]): { index: number; move: number } {
  let best = { index: -1, move: 0, log: 0 };
  for (let i = 1; i < series.length; i++) {
    const r = Math.log(series[i]!.value / series[i - 1]!.value);
    if (r < best.log)
      best = { index: i, move: series[i]!.value / series[i - 1]!.value - 1, log: r };
  }
  return { index: best.index, move: best.move };
}

/** Index of an ISO date in the series (exact match), or −1. */
export function indexOfDate(series: readonly Point[], iso: string): number {
  return series.findIndex((p) => p.date === iso);
}

/** Everything the replay and the texts need, computed once from the series. */
export interface GapSummary {
  series: Point[];
  shockIndex: number;
  /** Fixing before the shock day and on it. */
  before: number;
  shock: number;
  /** Simple move shock / before − 1. */
  dayMove: number;
  stop: GapOrder;
  knockOuts: GapOrder[];
  /** Stop: (stop level − fill) · notional in CHF (the unplanned extra loss). */
  stopSlipChf: number;
  /** Put strike − fixing at the knock-out, times notional: intrinsic value lost with the KO. */
  putLostChf: number;
  /** Lowest fixing of the window and its index. */
  low: number;
  lowIndex: number;
}

export function gapSummary(series: readonly Point[], cfg = M07_CONFIG.gap): GapSummary {
  const s = [...series];
  const shockIndex = indexOfDate(s, cfg.shockDate);
  const stop = gapOrders(s, [cfg.stop])[0]!;
  const knockOuts = gapOrders(s, cfg.knockOuts);
  const before = shockIndex > 0 ? s[shockIndex - 1]!.value : Number.NaN;
  const shock = shockIndex >= 0 ? s[shockIndex]!.value : Number.NaN;
  let lowIndex = 0;
  s.forEach((p, i) => {
    if (p.value < s[lowIndex]!.value) lowIndex = i;
  });
  const firstKo = knockOuts.find((k) => k.index !== null);
  return {
    series: s,
    shockIndex,
    before,
    shock,
    dayMove: shock / before - 1,
    stop,
    knockOuts,
    stopSlipChf: Number.isFinite(stop.fill) ? (cfg.stop - stop.fill) * cfg.notional : 0,
    putLostChf: firstKo ? Math.max(cfg.putStrike - firstKo.fill, 0) * cfg.notional : 0,
    low: s[lowIndex]?.value ?? Number.NaN,
    lowIndex,
  };
}

/** Riskometer deep link for the event (path from src/i18n/routes riskometerPath). */
export function riskometerLink(
  base: string,
  event: string = M07_CONFIG.gap.riskometerEvent,
  pair: string = M07_CONFIG.gap.pair,
): string {
  return `${base}?event=${encodeURIComponent(event)}&pair=${encodeURIComponent(pair)}`;
}
