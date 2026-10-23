/**
 * Figure (c) HedgeRoll, section 3: rolling the importer's forward with an FX swap.
 *
 * At the old maturity T1 the forward delivers +N USD against −N · F_old CHF. The payment slips,
 * so the importer sells the N USD back at the spot S1 (near leg) and buys them again for T2
 * (far leg, F2 = S1 · (1 + rd · t) / (1 + rf · t)). Net at T1: USD 0, CHF N · (S1 − F_old)
 * (the cash settlement: + receive, − pay). At T2: +N USD against −N · F2 CHF.
 * All-in rate = F_old + (F2 − S1) = F2 − settlement / N (D-25: no interest on the settlement).
 * Pure functions; rates in CHF per USD, amounts in CHF.
 */
import { rollHedge, type RollHedgeResult } from '@/lib/fx/swap';
import { M03_CONFIG, PIP } from './config';

/** Inputs of the roll view. */
export interface RollInput {
  oldForward: number;
  notional: number;
  spotAtRoll: number;
  rd: number;
  rf: number;
  extraDays: number;
}

/** View model of the roll. */
export interface RollView {
  result: RollHedgeResult;
  /** Swap points of the roll swap in pips (F2 − S1). */
  points: number;
  /** New far rate F2. */
  farRate: number;
  /** Cash settlement at T1 in CHF: + the importer receives, − the importer pays. */
  settlement: number;
  /** 'receive' | 'pay' | 'zero' (|settlement| below half a franc). */
  settlementSide: 'receive' | 'pay' | 'zero';
  /** All-in rate for T2: old forward + swap points. */
  allIn: number;
  /** CHF the importer pays in total over T1 and T2: N · all-in. */
  totalChf: number;
  /** CHF paid at T2 for the USD (far leg): N · F2. */
  farChf: number;
  /** All-in minus old forward, in pips (= swap points). */
  allInVsOldPips: number;
}

/** Computes the roll for one spot at the roll date. */
export function rollView(i: RollInput): RollView {
  const result = rollHedge({
    oldForward: i.oldForward,
    notionalBase: i.notional,
    spotAtRoll: i.spotAtRoll,
    rd: i.rd,
    rf: i.rf,
    extraDays: i.extraDays,
    baseCcy: M03_CONFIG.market.base,
    quoteCcy: M03_CONFIG.market.quote,
  });
  const s = result.settlementQuote;
  return {
    result,
    points: result.swapPoints,
    farRate: result.farRate,
    settlement: s,
    settlementSide: Math.abs(s) < 0.5 ? 'zero' : s > 0 ? 'receive' : 'pay',
    allIn: result.allInRate,
    totalChf: i.notional * result.allInRate,
    farChf: i.notional * result.farRate,
    allInVsOldPips: (result.allInRate - i.oldForward) / PIP,
  };
}

/** Far rate F2 and all-in rate as functions of the roll-date spot, sampled for the chart. */
export function rollCurves(
  base: Omit<RollInput, 'spotAtRoll'>,
  range: readonly [number, number],
  n = 48,
): { s: number; far: number; allIn: number }[] {
  const out: { s: number; far: number; allIn: number }[] = [];
  for (let k = 0; k <= n; k++) {
    const s = range[0] + ((range[1] - range[0]) * k) / n;
    const v = rollView({ ...base, spotAtRoll: s });
    out.push({ s, far: v.farRate, allIn: v.allIn });
  }
  return out;
}

/** Range of the all-in rate over a spot range (it moves only by the change in swap points). */
export function allInRange(
  base: Omit<RollInput, 'spotAtRoll'>,
  range: readonly [number, number],
): { min: number; max: number; spreadPips: number } {
  const a = rollView({ ...base, spotAtRoll: range[0] }).allIn;
  const b = rollView({ ...base, spotAtRoll: range[1] }).allIn;
  const min = Math.min(a, b);
  const max = Math.max(a, b);
  return { min, max, spreadPips: (max - min) / PIP };
}

/**
 * Position of the playback tour at `k` ∈ [0, 1]: piecewise linear through the waypoints with
 * equal time per leg, eased in and out per leg.
 */
export function tourAt(waypoints: readonly number[], k: number): number {
  const n = waypoints.length - 1;
  if (n <= 0) return waypoints[0] ?? Number.NaN;
  const x = Math.max(0, Math.min(1, k)) * n;
  const i = Math.min(n - 1, Math.floor(x));
  const f = x - i;
  const e = f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;
  return waypoints[i]! + (waypoints[i + 1]! - waypoints[i]!) * e;
}

/** Snaps a spot to the slider grid within the range. */
export function snapSpot(
  x: number,
  step: number = M03_CONFIG.roll.spotStep,
  range: readonly [number, number] = M03_CONFIG.roll.spotRange,
): number {
  const v = Math.round(x / step) * step;
  return Number(Math.min(range[1], Math.max(range[0], v)).toFixed(6));
}

/** True when the spot crossed the old forward between two positions (settlement changes sign). */
export function crossedOldForward(prev: number, next: number, oldForward: number): boolean {
  return (prev - oldForward) * (next - oldForward) <= 0 && prev !== next;
}
