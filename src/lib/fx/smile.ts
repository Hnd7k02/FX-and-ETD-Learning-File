/**
 * Volatility smile from the three FX market quotes ATM, 25Δ risk reversal and 25Δ butterfly.
 *
 * Convention: pair Base/Quote (e.g. USD/CHF), rd = quote-currency rate (domestic, CHF),
 * rf = base-currency rate (foreign, USD). Vols as decimals (0.08 = 8 %). T in years
 * (days/365). Delta is the undiscounted forward delta of the base-currency CALL,
 * Δ = N(d1) with d1 = (ln(F/K) + ½σ²T) / (σ√T), so Δ runs from 1 (low strike) to 0 (high
 * strike).
 *
 * Smile-strangle convention, quadratic in Δ:
 *   σ(Δ) = ATM − 2 · RR · (Δ − 0.5) + 16 · BF · (Δ − 0.5)²
 * - Δ = 0.5  → ATM (delta-neutral straddle strike K = F · e^(½σ²T)).
 * - Δ = 0.25 → 25Δ base call (high strike):  σ25C = ATM + BF + RR/2.
 * - Δ = 0.75 → 25Δ base put (low strike, put delta −0.25): σ25P = ATM + BF − RR/2.
 * RR = σ25C − σ25P. In USD/CHF, demand for CHF calls (= USD puts, low strikes) makes the
 * USD puts dearer, so RR < 0 and the smile is higher on the left (low strikes).
 * BF = (σ25C + σ25P)/2 − ATM measures the curvature (how much both wings sit above ATM).
 */
import { normCdf, normInv } from './normal';

/** Market quotes of a smile, all as decimal vols (0.08 = 8 %, 0.005 = 0.5 vol points). */
export interface SmileQuotes {
  /** ATM vol (delta-neutral straddle). */
  atm: number;
  /** 25Δ risk reversal σ25C − σ25P (base call minus base put). */
  rr25: number;
  /** 25Δ butterfly (smile strangle) (σ25C + σ25P)/2 − ATM. */
  bf25: number;
}

/** One point of a smile curve. */
export interface SmilePoint {
  /** Strike in quote currency per 1 unit base. */
  K: number;
  /** Forward delta of the base call at this strike, N(d1), in [0, 1]. */
  deltaFwd: number;
  /** Implied vol (decimal). */
  vol: number;
}

/** Result of solving the smile vol for a strike, with the steps for a step-by-step view. */
export interface SmileSolveResult {
  /** Smile vol at the strike (decimal). */
  vol: number;
  /** Forward call delta at the strike, evaluated with that vol. */
  deltaFwd: number;
  /** Which method found the vol. */
  method: 'fixed-point' | 'bisection';
  /** Number of iterations (fixed-point or bisection steps). */
  iterations: number;
  /** Fixed-point iterates σ0, σ1, … (σ0 = ATM); for bisection the midpoints. */
  path: number[];
}

/**
 * Smile vol at a forward call delta (decimal):
 * σ(Δ) = ATM − 2 · RR · (Δ − 0.5) + 16 · BF · (Δ − 0.5)².
 * Pure formula; may be ≤ 0 for extreme quotes (see minSmileVol).
 */
export function smileVol(deltaCallFwd: number, q: SmileQuotes): number {
  const x = deltaCallFwd - 0.5;
  return q.atm - 2 * q.rr25 * x + 16 * q.bf25 * x * x;
}

/** Vol of the 25Δ base call (Δ = 0.25, high strike): ATM + BF + RR/2. */
export function vol25Call(q: SmileQuotes): number {
  return q.atm + q.bf25 + 0.5 * q.rr25;
}

/** Vol of the 25Δ base put (call Δ = 0.75, low strike): ATM + BF − RR/2. */
export function vol25Put(q: SmileQuotes): number {
  return q.atm + q.bf25 - 0.5 * q.rr25;
}

/**
 * Quotes from three vols (the inverse of vol25Call / vol25Put):
 * RR = σ25C − σ25P, BF = (σ25C + σ25P)/2 − ATM.
 */
export function quotesFromVols(atm: number, vol25C: number, vol25P: number): SmileQuotes {
  return { atm, rr25: vol25C - vol25P, bf25: 0.5 * (vol25C + vol25P) - atm };
}

/**
 * Lowest and highest smile vol over all deltas Δ ∈ [0, 1] (decimal). The quadratic takes
 * its extremes at Δ = 0, Δ = 1 or its vertex Δ* = 0.5 + RR/(16 · BF).
 * A UI can use min ≤ 0 to warn that the quotes are not usable.
 */
export function smileRange(q: SmileQuotes): { min: number; max: number } {
  const candidates = [smileVol(0, q), smileVol(1, q)];
  if (q.bf25 !== 0) {
    const vertex = 0.5 + q.rr25 / (16 * q.bf25);
    if (vertex > 0 && vertex < 1) candidates.push(smileVol(vertex, q));
  }
  return { min: Math.min(...candidates), max: Math.max(...candidates) };
}

/** Lowest smile vol over Δ ∈ [0, 1]; ≤ 0 means the quotes give a negative wing. */
export function minSmileVol(q: SmileQuotes): number {
  return smileRange(q).min;
}

/** Forward call delta N(d1), d1 = (ln(F/K) + ½σ²T)/(σ√T). Requires F, K, T, vol > 0. */
export function forwardDelta(K: number, F: number, T: number, vol: number): number {
  const sd = vol * Math.sqrt(T);
  return normCdf((Math.log(F / K) + 0.5 * sd * sd) / sd);
}

/**
 * Strike with forward call delta Δ at vol σ: K = F · e^(−N⁻¹(Δ)·σ√T + ½σ²T).
 * Δ = 0.5 gives the delta-neutral straddle strike F · e^(½σ²T). Requires 0 < Δ < 1.
 */
export function strikeFromForwardDelta(
  deltaCallFwd: number,
  F: number,
  T: number,
  vol: number,
): number {
  const sd = vol * Math.sqrt(T);
  return F * Math.exp(-normInv(deltaCallFwd) * sd + 0.5 * sd * sd);
}

/**
 * Strike that belongs to a forward call delta on the smile: σ = σ(Δ), then
 * K = F · e^(−N⁻¹(Δ)·σ√T + ½σ²T). No iteration needed, because the smile is given in Δ.
 * Throws RangeError if Δ ∉ (0, 1) or σ(Δ) ≤ 0.
 */
export function smileStrike(deltaCallFwd: number, F: number, T: number, q: SmileQuotes): number {
  if (!(deltaCallFwd > 0 && deltaCallFwd < 1)) {
    throw new RangeError(`smileStrike: delta must be in (0, 1), got ${deltaCallFwd}`);
  }
  const vol = smileVol(deltaCallFwd, q);
  if (!(vol > 0)) throw new RangeError(`smileStrike: smile vol ${vol} ≤ 0 at Δ ${deltaCallFwd}`);
  return strikeFromForwardDelta(deltaCallFwd, F, T, vol);
}

/** Smallest vol used by the bisection fallback (decimal). */
const VOL_LO = 1e-8;
/** Tolerance for |σ(n+1) − σ(n)| and for the bisection width (decimal vol). */
const TOL = 1e-13;
const MAX_FIXED_POINT = 200;
const MAX_BISECTION = 200;

/**
 * Smile vol at a strike, with solver detail. The smile is quoted in delta, but the delta
 * depends on the vol, so σ solves σ = σ(N(d1(K, σ))). Fixed-point iteration from σ0 = ATM
 * (usually 5–10 steps, since the slope of the map is small); if it does not converge,
 * bisection on g(σ) = σ − σ(N(d1(K, σ))) over [1e-8, max smile vol].
 * Throws RangeError for F, K, T ≤ 0 or if no positive solution exists.
 */
export function solveVolAtStrike(
  K: number,
  F: number,
  T: number,
  q: SmileQuotes,
): SmileSolveResult {
  if (!(K > 0 && F > 0 && T > 0)) {
    throw new RangeError('volAtStrike: needs K > 0, F > 0 and T > 0');
  }
  const map = (vol: number): number => smileVol(forwardDelta(K, F, T, vol), q);

  // 1) Fixed point σ ← σ(Δ(σ)).
  let vol = q.atm;
  const path = [vol];
  for (let i = 1; i <= MAX_FIXED_POINT && vol > 0; i++) {
    const next = map(vol);
    path.push(next);
    if (Math.abs(next - vol) <= TOL && next > 0) {
      return {
        vol: next,
        deltaFwd: forwardDelta(K, F, T, next),
        method: 'fixed-point',
        iterations: i,
        path,
      };
    }
    vol = next;
  }

  // 2) Bisection fallback on g(σ) = σ − σ(Δ(σ)), with g(lo) < 0 ≤ g(hi).
  const g = (v: number): number => v - map(v);
  let lo = VOL_LO;
  let hi = smileRange(q).max;
  if (!(g(lo) < 0 && hi > lo && g(hi) >= 0)) {
    throw new RangeError('volAtStrike: no positive smile vol for this strike (check quotes)');
  }
  const mids: number[] = [];
  let iterations = 0;
  while (hi - lo > TOL && iterations < MAX_BISECTION) {
    const mid = 0.5 * (lo + hi);
    mids.push(mid);
    if (g(mid) < 0) lo = mid;
    else hi = mid;
    iterations++;
  }
  const root = 0.5 * (lo + hi);
  return {
    vol: root,
    deltaFwd: forwardDelta(K, F, T, root),
    method: 'bisection',
    iterations,
    path: mids,
  };
}

/** Smile vol at strike K (decimal); see solveVolAtStrike. */
export function volAtStrike(K: number, F: number, T: number, q: SmileQuotes): number {
  return solveVolAtStrike(K, F, T, q).vol;
}

/** Grid for smileCurve: either strikes or forward call deltas. */
export type SmileGrid = { strikes: readonly number[] } | { deltas: readonly number[] };

/** Default delta grid for a smile chart: Δ = 0.05, 0.10, …, 0.95 (call forward delta). */
export const DEFAULT_SMILE_DELTAS: readonly number[] = Array.from(
  { length: 19 },
  (_, i) => Math.round((i + 1) * 5) / 100,
);

/**
 * Smile curve as points { K, deltaFwd, vol } in the order of the grid.
 * - { strikes }: σ from volAtStrike, Δ = N(d1) at that σ.
 * - { deltas }: σ = σ(Δ) directly, K from smileStrike.
 * Sort by K for a chart (a delta grid runs from high to low strikes as Δ rises).
 */
export function smileCurve(F: number, T: number, q: SmileQuotes, grid: SmileGrid): SmilePoint[] {
  if ('strikes' in grid) {
    return grid.strikes.map((K) => {
      const r = solveVolAtStrike(K, F, T, q);
      return { K, deltaFwd: r.deltaFwd, vol: r.vol };
    });
  }
  return grid.deltas.map((deltaFwd) => ({
    K: smileStrike(deltaFwd, F, T, q),
    deltaFwd,
    vol: smileVol(deltaFwd, q),
  }));
}

/** The three pillar strikes of the smile: 25Δ put (low), ATM (DNS), 25Δ call (high). */
export function smilePillars(
  F: number,
  T: number,
  q: SmileQuotes,
): { put25: SmilePoint; atm: SmilePoint; call25: SmilePoint } {
  const point = (deltaFwd: number): SmilePoint => ({
    K: smileStrike(deltaFwd, F, T, q),
    deltaFwd,
    vol: smileVol(deltaFwd, q),
  });
  return { put25: point(0.75), atm: point(0.5), call25: point(0.25) };
}
