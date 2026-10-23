/**
 * Smile builder (module 06, section 4): pure helpers around src/lib/fx/smile.ts for the
 * SmileBuilder island. No DOM.
 *
 * The smile is given by three quotes (ATM, 25Δ risk reversal, 25Δ butterfly, smile-strangle
 * convention) and interpolated quadratically in the forward delta of the USD call:
 *   σ(Δ) = ATM − 2 · RR · (Δ − 0.5) + 16 · BF · (Δ − 0.5)²
 * The chart samples it on a delta grid, so each point has a strike and a delta and the curve can
 * morph between the strike view and the delta view without recomputing anything.
 * Convention: rd = CHF rate (quote), rf = USD rate (base), T = days/365, vols as decimals.
 */
import { gkPrice } from '@/lib/fx/vanilla';
import {
  quotesFromVols,
  smilePillars,
  smileVol,
  strikeFromForwardDelta,
  vol25Call,
  vol25Put,
  type SmilePoint,
  type SmileQuotes,
} from '@/lib/fx/smile';

/** Slider ranges and steps of the three quotes (decimal vols). Change here (D-22). */
export const SMILE_LIMITS = {
  atm: { min: 0.04, max: 0.16, step: 0.001 },
  rr: { min: -0.03, max: 0.03, step: 0.0005 },
  bf: { min: 0, max: 0.015, step: 0.0005 },
} as const;

/** |RR| or |BF| below this counts as zero (aha annotations), decimal vol. */
export const ZERO_TOL = 0.00025;
/** A dragged wing snaps RR or BF to exactly zero when it is this close (decimal vol). */
export const SNAP_TOL = 0.0008;

/** Delta grid of the chart: call forward delta 0.02, 0.03, …, 0.98 (97 points). */
export const SMILE_GRID: readonly number[] = Array.from(
  { length: 97 },
  (_, i) => Math.round((i + 2) * 100) / 10000,
);

/** Delta ticks of the chart with their pillar names: 10Δ put … 10Δ call. */
export const DELTA_TICKS: ReadonlyArray<{ delta: number; key: 'p10' | 'p25' | 'atm' | 'c25' | 'c10' }> =
  [
    { delta: 0.9, key: 'p10' },
    { delta: 0.75, key: 'p25' },
    { delta: 0.5, key: 'atm' },
    { delta: 0.25, key: 'c25' },
    { delta: 0.1, key: 'c10' },
  ];

export type Pillar = 'put25' | 'atm' | 'call25';

export interface SmileGeometry {
  /** Points on the delta grid, in grid order (rising delta = falling strike). */
  points: SmilePoint[];
  pillars: Record<Pillar, SmilePoint>;
  /** (σ25C + σ25P) / 2, the level the butterfly measures against ATM. */
  wingAverage: number;
  minVol: number;
  maxVol: number;
}

/** Curve, pillars and range of a smile for forward F and time T. */
export function smileGeometry(q: SmileQuotes, F: number, T: number): SmileGeometry {
  const points = SMILE_GRID.map((d) => {
    const vol = smileVol(d, q);
    return { deltaFwd: d, vol, K: strikeFromForwardDelta(d, F, T, vol) };
  });
  const vols = points.map((p) => p.vol);
  return {
    points,
    pillars: smilePillars(F, T, q),
    wingAverage: 0.5 * (vol25Call(q) + vol25Put(q)),
    minVol: Math.min(...vols),
    maxVol: Math.max(...vols),
  };
}

const roundTo = (x: number, step: number) => Number((Math.round(x / step) * step).toFixed(6));
const clampTo = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** Quotes clamped to the slider ranges and rounded to their steps. */
export function clampQuotes(q: SmileQuotes): SmileQuotes {
  const L = SMILE_LIMITS;
  return {
    atm: clampTo(roundTo(q.atm, L.atm.step), L.atm.min, L.atm.max),
    rr25: clampTo(roundTo(q.rr25, L.rr.step), L.rr.min, L.rr.max),
    bf25: clampTo(roundTo(q.bf25, L.bf.step), L.bf.min, L.bf.max),
  };
}

/**
 * New quotes after dragging one pillar to vol `v`:
 * - ATM: the whole smile moves in parallel (RR and BF unchanged, like the ATM slider);
 * - a wing: only that wing's vol changes, ATM and the other wing stay, so RR and BF follow.
 * RR and BF snap to zero within SNAP_TOL (that is where the aha annotations appear); the result
 * is clamped to the slider ranges.
 */
export function dragPillar(q: SmileQuotes, which: Pillar, v: number): SmileQuotes {
  if (which === 'atm') return clampQuotes({ ...q, atm: v });
  const c = which === 'call25' ? v : vol25Call(q);
  const p = which === 'put25' ? v : vol25Put(q);
  const next = quotesFromVols(q.atm, c, p);
  if (Math.abs(next.rr25) < SNAP_TOL) next.rr25 = 0;
  if (Math.abs(next.bf25) < SNAP_TOL) next.bf25 = 0;
  return clampQuotes(next);
}

export type SmileShape = 'flat' | 'symmetric' | 'skew' | 'smile';

/**
 * Shape of the smile for the aha annotations: flat (RR = BF = 0), symmetric (RR = 0, BF > 0),
 * skew (BF = 0: a straight line in delta), otherwise a skewed smile.
 */
export function smileShape(q: SmileQuotes): SmileShape {
  const rr0 = Math.abs(q.rr25) < ZERO_TOL;
  const bf0 = Math.abs(q.bf25) < ZERO_TOL;
  if (rr0 && bf0) return 'flat';
  if (rr0) return 'symmetric';
  if (bf0) return 'skew';
  return 'smile';
}

/** Which wing is higher: 'left' (USD puts dearer, RR < 0), 'right' (RR > 0) or 'none'. */
export function higherWing(q: SmileQuotes): 'left' | 'right' | 'none' {
  if (q.rr25 <= -ZERO_TOL) return 'left';
  if (q.rr25 >= ZERO_TOL) return 'right';
  return 'none';
}

export interface PremiumEffect {
  K: number;
  /** Smile vol at the pillar. */
  volSmile: number;
  /** Flat vol (ATM) for comparison. */
  volFlat: number;
  /** Premium per USD on the smile and flat (quote currency). */
  smile: number;
  flat: number;
}

/**
 * What the smile does to the price of the two wing options at their pillar strikes:
 * the 25Δ USD put (= CHF call) and the 25Δ USD call, valued with the smile vol and with the
 * flat ATM vol (Garman-Kohlhagen).
 */
export function premiumEffect(
  q: SmileQuotes,
  S: number,
  T: number,
  rd: number,
  rf: number,
): { put25: PremiumEffect; call25: PremiumEffect } {
  const F = S * Math.exp((rd - rf) * T);
  const p = smilePillars(F, T, q);
  const effect = (pt: SmilePoint, type: 'call' | 'put'): PremiumEffect => ({
    K: pt.K,
    volSmile: pt.vol,
    volFlat: q.atm,
    smile: gkPrice(S, pt.K, T, pt.vol, rd, rf, type),
    flat: gkPrice(S, pt.K, T, q.atm, rd, rf, type),
  });
  return { put25: effect(p.put25, 'put'), call25: effect(p.call25, 'call') };
}

/**
 * y domain of the chart (decimal vols): covers the curve and at least [ATM − 2, ATM + 3] vol
 * points, rounded out to whole vol points.
 */
export function volDomain(g: SmileGeometry, atm: number): [number, number] {
  const lo = Math.min(g.minVol, atm - 0.02);
  const hi = Math.max(g.maxVol, atm + 0.03);
  return [Math.max(0, Math.floor(lo * 100 - 1e-9) / 100), Math.ceil(hi * 100 + 1e-9) / 100];
}

/** True if two quote sets are equal within half a slider step. */
export function sameQuotes(a: SmileQuotes, b: SmileQuotes): boolean {
  const L = SMILE_LIMITS;
  return (
    Math.abs(a.atm - b.atm) < L.atm.step / 2 &&
    Math.abs(a.rr25 - b.rr25) < L.rr.step / 2 &&
    Math.abs(a.bf25 - b.bf25) < L.bf.step / 2
  );
}

/** Preset quotes of the builder: the example, the same smile symmetric, and flat. */
export function smilePresets(example: SmileQuotes): Record<'example' | 'symmetric' | 'flat', SmileQuotes> {
  return {
    example: { ...example },
    symmetric: { ...example, rr25: 0 },
    flat: { atm: example.atm, rr25: 0, bf25: 0 },
  };
}
