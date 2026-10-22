/**
 * Figure (b) BarrierLab, section 2: single-barrier options on the calculation core
 * (barrierPrice / barrierBreakdown / isReverse in src/lib/fx/exotics), pure and testable.
 *
 * - price of the chosen option against the vanilla, the in-out parity KO + KI = vanilla,
 * - value against spot with the knocked region, the payoff at expiry ("never touched") with
 *   its cliff at the barrier, and the numeric delta (central differences, one-sided at the
 *   barrier so the bump never crosses it),
 * - continuous vs daily monitoring via the Broadie-Glasserman-Kou shift.
 * Prices in CHF per 1 USD (quote currency per unit base); pips = 0.0001.
 */
import { barrierPrice, isBarrierTouched, isReverse, type BarrierKind } from '@/lib/fx/exotics/barrier';
import { touchProbability } from '@/lib/fx/exotics/touch';
import { gkPrice, payoff, type OptionType } from '@/lib/fx/vanilla';
import { M07_CONFIG, PIP, onGrid } from './config';
import { dailyEquivalentBarrier, type Direction } from './paths';

export interface LabState {
  type: OptionType;
  dir: Direction;
  io: 'in' | 'out';
  strike: number;
  barrier: number;
  rebatePips: number;
  spot: number;
  weeks: number;
  monitoring: 'continuous' | 'daily';
}

export type Point = [number, number];

const M = M07_CONFIG.market;

/** Haug kind from direction and in/out. */
export function kindOf(s: Pick<LabState, 'dir' | 'io'>): BarrierKind {
  return `${s.dir}-and-${s.io}` as BarrierKind;
}

/** Option-model time: weeks / 52. */
export function yearsOf(weeks: number): number {
  return weeks / 52;
}

/** The barrier that enters the closed form: as set, or BGK-shifted for daily monitoring. */
export function effectiveBarrier(s: LabState): number {
  return s.monitoring === 'daily' ? dailyEquivalentBarrier(s.barrier, s.dir, M.vol) : s.barrier;
}

/**
 * Price of a barrier option of the state's type at spot S (other fields from the state).
 * A spot at or beyond the barrier as set counts as touched for both kinds of monitoring
 * (knock-out = rebate, knock-in = vanilla); daily monitoring shifts only the alive side.
 */
export function priceAt(s: LabState, S: number, io: 'in' | 'out' = s.io, rebate = s.rebatePips * PIP): number {
  if (isBarrierTouched(kindOf({ dir: s.dir, io }), S, s.barrier)) {
    return io === 'out' ? rebate : vanillaAt(s, S);
  }
  return barrierPrice({
    S,
    K: s.strike,
    H: effectiveBarrier(s),
    T: yearsOf(s.weeks),
    vol: M.vol,
    rd: M.rd,
    rf: M.rf,
    type: s.type,
    kind: kindOf({ dir: s.dir, io }),
    rebate,
  });
}

/** Vanilla of the state's type at spot S. */
export function vanillaAt(s: LabState, S: number): number {
  return gkPrice(S, s.strike, yearsOf(s.weeks), M.vol, M.rd, M.rf, s.type);
}

/**
 * Numeric delta and gamma at S with bump h (central differences). If the bump would cross the
 * (effective) barrier, one-sided differences on the alive side are used, so the jump at the
 * barrier never leaks into the slope.
 */
export function numericGreeks(
  f: (S: number) => number,
  S: number,
  barrier: number,
  dir: Direction,
  h = M07_CONFIG.lab.bumpPips * PIP,
): { delta: number; gamma: number } {
  const crossUp = dir === 'up' && S + h >= barrier && S < barrier;
  const crossDown = dir === 'down' && S - h <= barrier && S > barrier;
  if (crossUp) {
    const [a, b, c] = [f(S - 2 * h), f(S - h), f(S)];
    return { delta: (3 * c - 4 * b + a) / (2 * h), gamma: (c - 2 * b + a) / (h * h) };
  }
  if (crossDown) {
    const [a, b, c] = [f(S), f(S + h), f(S + 2 * h)];
    return { delta: (-3 * a + 4 * b - c) / (2 * h), gamma: (a - 2 * b + c) / (h * h) };
  }
  const up = f(S + h);
  const mid = f(S);
  const down = f(S - h);
  return { delta: (up - down) / (2 * h), gamma: (up - 2 * mid + down) / (h * h) };
}

/** Everything the lab shows for one state. */
export interface LabNumbers {
  kind: BarrierKind;
  reverse: boolean;
  /** Spot already at or beyond the barrier (knocked out / knocked in). */
  touched: boolean;
  effectiveBarrier: number;
  price: number;
  vanilla: number;
  /** 1 − price / vanilla (negative if a rebate makes the option dearer). */
  discount: number;
  /** In-out parity at the current spot, without rebate: ko + ki = vanilla. */
  ko: number;
  ki: number;
  parityGap: number;
  /** Value of the rebate inside the price. */
  rebateValue: number;
  touchProb: number;
  delta: number;
  gamma: number;
  vanillaDelta: number;
  vanillaGamma: number;
}

export function labNumbers(s: LabState): LabNumbers {
  const kind = kindOf(s);
  const H = effectiveBarrier(s);
  const T = yearsOf(s.weeks);
  const touched = isBarrierTouched(kind, s.spot, s.barrier);
  const price = priceAt(s, s.spot);
  const vanilla = vanillaAt(s, s.spot);
  const ko = priceAt(s, s.spot, 'out', 0);
  const ki = priceAt(s, s.spot, 'in', 0);
  const g = numericGreeks((x) => priceAt(s, x), s.spot, s.barrier, s.dir);
  const gv = numericGreeks((x) => vanillaAt(s, x), s.spot, Infinity, s.dir);
  const touchProb = touched
    ? 1
    : touchProbability({ S: s.spot, H, T, vol: M.vol, rd: M.rd, rf: M.rf, direction: s.dir });
  return {
    kind,
    reverse: isReverse(kind, s.type, s.strike, s.barrier),
    touched,
    effectiveBarrier: H,
    price,
    vanilla,
    discount: vanilla > 0 ? 1 - price / vanilla : 0,
    ko,
    ki,
    parityGap: ko + ki - vanilla,
    rebateValue: price - priceAt(s, s.spot, s.io, 0),
    touchProb,
    delta: touched && s.io === 'out' ? 0 : g.delta,
    gamma: touched && s.io === 'out' ? 0 : g.gamma,
    vanillaDelta: gv.delta,
    vanillaGamma: gv.gamma,
  };
}

/**
 * Spot grid on [a, b] every `stepPips`, plus the barrier itself and a few points just inside it
 * (½, 1 and 2 pips), so the steep approach to the barrier is drawn sharply.
 */
export function spotGrid(a: number, b: number, stepPips: number, barrier: number, dir: Direction): number[] {
  const xs: number[] = [];
  const n = Math.round((b - a) / (stepPips * PIP));
  for (let i = 0; i <= n; i++) xs.push(a + ((b - a) * i) / n);
  const inward = dir === 'up' ? -1 : 1;
  for (const k of [0, 0.5, 1, 2]) {
    const x = barrier + inward * k * PIP;
    if (x > a && x < b) xs.push(x);
  }
  return [...new Set(xs.map((x) => Number(x.toFixed(7))))].sort((p, q) => p - q);
}

/** Curves of the two charts. Values in pips; spot on x. */
export interface LabCurves {
  option: Point[];
  vanilla: Point[];
  /** Payoff at expiry if the barrier was never touched (knock-out only), with its cliff. */
  payoff: Point[] | null;
  delta: Point[];
  vanillaDelta: Point[];
  /** Knocked region [x0, x1] on the spot axis (beyond the barrier). */
  region: [number, number];
}

export function labCurves(s: LabState, xDomain: [number, number] = M07_CONFIG.lab.xDomain): LabCurves {
  const [a, b] = xDomain;
  const xs = spotGrid(a, b, M07_CONFIG.lab.sampleStepPips, s.barrier, s.dir);
  const pips = (x: number) => x / PIP;
  const option: Point[] = [];
  const vanilla: Point[] = [];
  const delta: Point[] = [];
  const vanillaDelta: Point[] = [];
  const f = (x: number) => priceAt(s, x);
  const fv = (x: number) => vanillaAt(s, x);
  const [lo, hi] = M07_CONFIG.lab.deltaClip;
  for (const x of xs) {
    option.push([x, pips(f(x))]);
    vanilla.push([x, pips(fv(x))]);
    const knocked = isBarrierTouched(kindOf(s), x, s.barrier);
    const d = knocked
      ? s.io === 'out'
        ? 0
        : numericGreeks(fv, x, Infinity, s.dir).delta
      : numericGreeks(f, x, s.barrier, s.dir).delta;
    delta.push([x, Math.min(hi, Math.max(lo, d))]);
    vanillaDelta.push([x, numericGreeks(fv, x, Infinity, s.dir).delta]);
  }
  let pay: Point[] | null = null;
  if (s.io === 'out') {
    const R = pips(s.rebatePips * PIP);
    const inside = xs.filter((x) => !isBarrierTouched(kindOf(s), x, s.barrier));
    const value = (x: number) => pips(payoff(x, s.strike, s.type));
    pay =
      s.dir === 'up'
        ? [
            ...inside.map((x): Point => [x, value(x)]),
            [s.barrier, value(s.barrier)],
            [s.barrier, R],
            [b, R],
          ]
        : [
            [a, R],
            [s.barrier, R],
            [s.barrier, value(s.barrier)],
            ...inside.map((x): Point => [x, value(x)]),
          ];
  }
  const region: [number, number] = s.dir === 'up' ? [Math.max(a, s.barrier), b] : [a, Math.min(b, s.barrier)];
  return { option, vanilla, payoff: pay, delta, vanillaDelta, region };
}

/**
 * When the direction toggles, the barrier moves to the mirror level on the other side of the
 * spot (2·S − H, on the slider grid), so the option stays meaningful.
 */
export function mirrorBarrier(barrier: number, spot: number): number {
  const r = M07_CONFIG.lab.ranges.barrier;
  return Math.min(r.max, Math.max(r.min, onGrid(2 * spot - barrier, r.step)));
}

/** Lab state with the defaults of M07_CONFIG. */
export function defaultLabState(): LabState {
  return { ...M07_CONFIG.lab.defaults };
}

/** Annotation keys of the lab ("aha" moments). */
export type LabAha = 'touched' | 'reverseNear' | 'regularNear' | 'cheap' | null;

/**
 * Which annotation fits: spot beyond the barrier → touched; within `nearPips` of the barrier →
 * reverse (delta flips) or regular (little value left); discount above 50 % → cheap.
 */
export function labAha(s: LabState, n: LabNumbers): LabAha {
  if (n.touched) return 'touched';
  const dist = Math.abs(s.barrier - s.spot) / PIP;
  if (s.io === 'out' && dist <= M07_CONFIG.lab.nearPips) return n.reverse ? 'reverseNear' : 'regularNear';
  if (s.io === 'out' && n.discount > 0.5) return 'cheap';
  return null;
}

/**
 * Method of images for a down-and-out call with K ≥ H and no rebate (Merton, Reiner-Rubinstein):
 *   C_DO(S) = C(S) − (H/S)^(2μ) · C(H²/S),  μ = (rd − rf − σ²/2)/σ².
 * The "mirror" call is valued at the spot H²/S reflected at the barrier; at S = H both terms are
 * equal and the option is worth 0. Returns the pieces (CHF per USD) for the derivation.
 */
export function mirrorDecomposition(
  S: number,
  K: number,
  H: number,
  T: number,
  vol: number,
  rd: number,
  rf: number,
): { vanilla: number; mirrorSpot: number; weight: number; mirrorCall: number; mirror: number; mu: number; price: number } {
  const mu = (rd - rf - 0.5 * vol * vol) / (vol * vol);
  const mirrorSpot = (H * H) / S;
  const weight = (H / S) ** (2 * mu);
  const vanilla = gkPrice(S, K, T, vol, rd, rf, 'call');
  const mirrorCall = gkPrice(mirrorSpot, K, T, vol, rd, rf, 'call');
  const mirror = weight * mirrorCall;
  return { vanilla, mirrorSpot, weight, mirrorCall, mirror, mu, price: vanilla - mirror };
}
