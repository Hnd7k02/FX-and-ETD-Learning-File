/**
 * Figure (c) TouchLab, section 3: European digital, one-touch, no-touch and double no-touch on
 * the calculation core (digitalCash, oneTouch, noTouch, touchProbability, doubleNoTouch),
 * pure and testable. Values in CHF for a payout of M07_CONFIG.touch.payout CHF, fractions of
 * the payout for the charts.
 *
 * Lessons the curves carry:
 * - digital = limit of a call spread (C(K − ε/2) − C(K + ε/2)) / ε → −∂C/∂K = e^(−rd T) N(d2),
 * - one-touch / no-touch: price ≈ discounted touch probability; OT + NT = e^(−rd T) (paid at
 *   expiry); paid at the hit the one-touch is worth more when rd > 0 (D-24),
 * - double no-touch: a corridor; the more vol, the cheaper (short vega).
 */
import { digitalCash } from '@/lib/fx/exotics/digital';
import { doubleNoTouch } from '@/lib/fx/exotics/doubleNoTouch';
import { noTouch, oneTouch, touchProbability } from '@/lib/fx/exotics/touch';
import { normPdf } from '@/lib/fx/normal';
import { gkPrice } from '@/lib/fx/vanilla';
import { M07_CONFIG, PIP, type TouchMode } from './config';
import type { Point } from './barrierlab';

export interface TouchState {
  mode: TouchMode;
  strike: number;
  spreadPips: number;
  barrier: number;
  lower: number;
  upper: number;
  rdPct: number;
  volPct: number;
  payAt: 'expiry' | 'hit';
}

export interface TouchMarket {
  S: number;
  T: number;
  vol: number;
  rd: number;
  rf: number;
}

const M = M07_CONFIG.market;
const C = M07_CONFIG.touch;

export function defaultTouchState(): TouchState {
  return { ...C.defaults };
}

/** Market of a state: example spot, T and USD rate; CHF rate and vol from the sliders. */
export function touchMarket(s: Pick<TouchState, 'rdPct' | 'volPct'>): TouchMarket {
  return { S: M.spot, T: M.T, vol: s.volPct / 100, rd: s.rdPct / 100, rf: M.rf };
}

/** Call spread long K − ε/2, short K + ε/2, scaled by 1/ε: pays 0 … 1 with a ramp of width ε. */
export function callSpreadDigital(m: TouchMarket, K: number, eps: number): number {
  const { S, T, vol, rd, rf } = m;
  return (gkPrice(S, K - eps / 2, T, vol, rd, rf, 'call') - gkPrice(S, K + eps / 2, T, vol, rd, rf, 'call')) / eps;
}

/** Payoff of that call spread at expiry for S_T = x (0 … 1). */
export function callSpreadPayoff(x: number, K: number, eps: number): number {
  return Math.min(1, Math.max(0, (x - (K - eps / 2)) / eps));
}

/** Risk-neutral (lognormal) density of S_T at x, for the shaded area in the digital view. */
export function terminalDensity(m: TouchMarket, x: number): number {
  const { S, T, vol, rd, rf } = m;
  const sd = vol * Math.sqrt(T);
  const mean = Math.log(S) + (rd - rf - 0.5 * vol * vol) * T;
  return normPdf((Math.log(x) - mean) / sd) / (x * sd);
}

/** Quantile of S_t: S · exp((rd − rf − σ²/2) t + z σ √t). */
export function quantileAt(m: TouchMarket, t: number, z: number): number {
  return m.S * Math.exp((m.rd - m.rf - 0.5 * m.vol * m.vol) * t + z * m.vol * Math.sqrt(t));
}

/** Forward S · e^((rd − rf) t). */
export function forwardAt(m: TouchMarket, t: number): number {
  return m.S * Math.exp((m.rd - m.rf) * t);
}

/** Headline numbers of one state, as fractions of the payout (multiply by payout for CHF). */
export interface TouchNumbers {
  /** Price per 1 CHF payout. */
  price: number;
  /** Risk-neutral probability that the option pays. */
  prob: number;
  /** e^(−rd T). */
  df: number;
  /** Mode-specific comparison: call spread (digital), OT paid at the other time (OT), OT (NT). */
  compare: number;
}

export function touchNumbers(s: TouchState): TouchNumbers {
  const m = touchMarket(s);
  const { S, T, vol, rd, rf } = m;
  const df = Math.exp(-rd * T);
  switch (s.mode) {
    case 'digital': {
      const price = digitalCash(S, s.strike, T, vol, rd, rf, 'call');
      return { price, prob: price / df, df, compare: callSpreadDigital(m, s.strike, s.spreadPips * PIP) };
    }
    case 'oneTouch': {
      const p = { S, H: s.barrier, T, vol, rd, rf };
      const other = s.payAt === 'hit' ? 'expiry' : 'hit';
      return {
        price: oneTouch({ ...p, payAt: s.payAt }),
        prob: touchProbability(p),
        df,
        compare: oneTouch({ ...p, payAt: other }),
      };
    }
    case 'noTouch': {
      const p = { S, H: s.barrier, T, vol, rd, rf };
      return {
        price: noTouch(p),
        prob: 1 - touchProbability(p),
        df,
        compare: oneTouch(p),
      };
    }
    case 'dnt': {
      const price = doubleNoTouch({ S, L: s.lower, U: s.upper, T, vol, rd, rf });
      return { price, prob: price / df, df, compare: doubleNoTouch({ S, L: s.lower, U: s.upper, T, vol: vol + C.volBumpPct / 100, rd, rf }) };
    }
  }
}

/** Curves of the lower chart ("price against level" or, for the DNT, against vol). */
export interface TouchCurves {
  /** x of the curves: level (USD/CHF) or vol in %. */
  x: 'level' | 'vol';
  price: Point[];
  /** Probability (dashed); equal to price when rd = 0 and paid at expiry. */
  prob: Point[];
  /** Second price curve: call spread (digital), no-touch (OT), one-touch (NT); none for DNT. */
  second: Point[] | null;
  /** Marker [x, y] of the current state on the price curve. */
  at: Point;
}

const linspace = (a: number, b: number, n: number) => Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);

export function touchCurves(s: TouchState, n = 120): TouchCurves {
  const m = touchMarket(s);
  const { S, T, vol, rd, rf } = m;
  const [a, b] = C.levelDomain;
  const now = touchNumbers(s);
  switch (s.mode) {
    case 'digital': {
      const xs = linspace(a, b, n);
      const eps = s.spreadPips * PIP;
      const df = Math.exp(-rd * T);
      return {
        x: 'level',
        price: xs.map((K) => [K, digitalCash(S, K, T, vol, rd, rf, 'call')]),
        prob: xs.map((K) => [K, digitalCash(S, K, T, vol, rd, rf, 'call') / df]),
        second: xs.map((K) => [K, callSpreadDigital(m, K, eps)]),
        at: [s.strike, now.price],
      };
    }
    case 'oneTouch':
    case 'noTouch': {
      // Barriers on both sides of the spot; at the spot itself a touch is certain.
      const xs = linspace(a, b, n).filter((x) => Math.abs(x - S) > 0.5 * PIP);
      const ot = (H: number) => oneTouch({ S, H, T, vol, rd, rf, payAt: s.payAt });
      const nt = (H: number) => noTouch({ S, H, T, vol, rd, rf });
      const pt = (H: number) => touchProbability({ S, H, T, vol, rd, rf });
      const isOt = s.mode === 'oneTouch';
      return {
        x: 'level',
        price: xs.map((H) => [H, isOt ? ot(H) : nt(H)]),
        prob: xs.map((H) => [H, isOt ? pt(H) : 1 - pt(H)]),
        second: xs.map((H) => [H, isOt ? nt(H) : ot(H)]),
        at: [s.barrier, now.price],
      };
    }
    case 'dnt': {
      const [v0, v1] = C.volDomain;
      const vols = linspace(v0, v1, n);
      const dnt = (v: number) => doubleNoTouch({ S, L: s.lower, U: s.upper, T, vol: v / 100, rd, rf });
      const df = Math.exp(-rd * T);
      return {
        x: 'vol',
        price: vols.map((v) => [v, dnt(v)]),
        prob: vols.map((v) => [v, dnt(v) / df]),
        second: null,
        at: [s.volPct, now.price],
      };
    }
  }
}

/**
 * Keeps a barrier at least minGapPips away from the spot on the side it is on (a level
 * dragged onto the spot would be touched at once). Corridor: lower < spot < upper.
 */
export function clampBarrier(H: number, spot: number = M.spot): number {
  const gap = C.minGapPips * PIP;
  if (Math.abs(H - spot) >= gap) return H;
  return H >= spot ? spot + gap : spot - gap;
}

export function clampCorridor(lower: number, upper: number, spot: number = M.spot): [number, number] {
  const gap = C.minGapPips * PIP;
  return [Math.min(lower, spot - gap), Math.max(upper, spot + gap)];
}

/** Which paths pay in the path view: digital (S_T > K), OT (touched), NT (not touched), DNT (inside). */
export function pathPays(path: readonly number[], s: TouchState): boolean {
  switch (s.mode) {
    case 'digital':
      return path[path.length - 1]! > s.strike;
    case 'oneTouch':
    case 'noTouch': {
      const up = s.barrier > M.spot;
      const touched = path.some((x) => (up ? x >= s.barrier : x <= s.barrier));
      return s.mode === 'oneTouch' ? touched : !touched;
    }
    case 'dnt':
      return path.every((x) => x > s.lower && x < s.upper);
  }
}

/** First day a path leaves (touches) the relevant barrier, or null (for fading the rest). */
export function pathExitDay(path: readonly number[], s: TouchState): number | null {
  for (let d = 0; d < path.length; d++) {
    const x = path[d]!;
    if (s.mode === 'dnt' && (x <= s.lower || x >= s.upper)) return d;
    if (s.mode === 'oneTouch' || s.mode === 'noTouch') {
      const up = s.barrier > M.spot;
      if (up ? x >= s.barrier : x <= s.barrier) return d;
    }
  }
  return null;
}
