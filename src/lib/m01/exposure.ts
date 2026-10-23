/**
 * Module 01, section 1: the importer's spot exposure.
 *
 * The Swiss importer owes USD N (USD 1 Mio.) and buys the dollars at the spot rate S
 * (USD/CHF, CHF per 1 USD). His cost in CHF is linear in the rate: C(S) = N · S, so every pip
 * (0.0001) costs N · 0.0001 and every big figure (0.01) N · 0.01. The inverse quote CHF/USD
 * (USD per 1 CHF) is 1 / S; percentage moves of a rate and of its inverse are not symmetric.
 *
 * The "typical range" is the ±1σ band of the log-normal model around today's spot, without
 * drift: S · e^(±σ√T). With σ = 8 % and T = 0.25 it covers roughly two thirds of outcomes.
 */
import { EXAMPLE } from '@/lib/fx/example';
import { normCdf } from '@/lib/fx/normal';

/** Pip and big figure of USD/CHF (and every non-JPY pair). */
export const PIP = 1e-4;
export const BIG_FIGURE = 1e-2;

/** Slider range and step of the exposure figure (teaching choice, D-22). */
export const EXPOSURE_RANGE = {
  min: 0.74,
  max: 0.86,
  step: 0.0005,
} as const;

/** CHF cost of buying `notional` USD at the rate S. */
export function costChf(S: number, notional: number = EXAMPLE.notional): number {
  return S * notional;
}

/** Inverse quote: USD per 1 CHF when S is CHF per 1 USD. */
export function inverseRate(S: number): number {
  if (!(S > 0)) throw new RangeError(`rate must be positive, got ${S}`);
  return 1 / S;
}

/** Relative change S1 / S0 − 1 (as a fraction). */
export function pctChange(S0: number, S1: number): number {
  return S1 / S0 - 1;
}

/**
 * Relative change of the inverse quote when the rate moves from S0 to S1:
 * (1/S1) / (1/S0) − 1 = S0 / S1 − 1 = −x / (1 + x) with x = S1 / S0 − 1.
 */
export function inversePctChange(S0: number, S1: number): number {
  return S0 / S1 - 1;
}

/** A rate move expressed in pips and in big figures (signed). */
export function moveIn(S0: number, S1: number): { pips: number; bigFigures: number } {
  const d = S1 - S0;
  return { pips: d / PIP, bigFigures: d / BIG_FIGURE };
}

/** Everything the exposure figure shows for one rate. */
export interface Exposure {
  S: number;
  cost: number;
  /** Cost minus today's cost (CHF, signed: + = more expensive for the importer). */
  diff: number;
  pct: number;
  inverse: number;
  inversePct: number;
  pips: number;
  bigFigures: number;
  /** "up" if the dollar is dearer than today (by more than half a pip), "down" if cheaper. */
  dir: 'up' | 'flat' | 'down';
}

/** Exposure of the importer at rate S against today's spot S0. */
export function exposure(
  S: number,
  S0: number = EXAMPLE.spot,
  notional: number = EXAMPLE.notional,
): Exposure {
  const cost = costChf(S, notional);
  const today = costChf(S0, notional);
  const { pips, bigFigures } = moveIn(S0, S);
  return {
    S,
    cost,
    diff: cost - today,
    pct: pctChange(S0, S),
    inverse: inverseRate(S),
    inversePct: inversePctChange(S0, S),
    pips,
    bigFigures,
    dir: pips > 0.5 ? 'up' : pips < -0.5 ? 'down' : 'flat',
  };
}

/** ±1σ band of the rate after T years (log-normal, no drift): [S·e^(−σ√T), S·e^(+σ√T)]. */
export function sigmaRange(
  S: number = EXAMPLE.spot,
  vol: number = EXAMPLE.vol,
  T: number = EXAMPLE.T,
): [number, number] {
  const k = vol * Math.sqrt(T);
  return [S * Math.exp(-k), S * Math.exp(k)];
}

/**
 * Model probability that the rate after T years lies at S or further away from S0 on the same
 * side (above S if S > S0, below S if S < S0). Same log-normal model without drift as
 * {@link sigmaRange}: P = N(−|ln(S/S0)| / (σ√T)). At S = S0 the answer is ½.
 */
export function probBeyond(
  S: number,
  S0: number = EXAMPLE.spot,
  vol: number = EXAMPLE.vol,
  T: number = EXAMPLE.T,
): number {
  if (!(S > 0) || !(S0 > 0)) throw new RangeError(`rates must be positive, got ${S}, ${S0}`);
  const z = Math.log(S / S0) / (vol * Math.sqrt(T));
  return normCdf(-Math.abs(z));
}

/**
 * Whole big-figure blocks between S0 and S (for the stacked bar): the signed number of complete
 * big figures and the remaining fraction of the last block (0 ≤ rest < 1).
 */
export function bigFigureBlocks(S0: number, S: number): { whole: number; rest: number } {
  const bf = (S - S0) / BIG_FIGURE;
  const abs = Math.abs(bf);
  // 1e-9 guards against 0.81 − 0.80 = 0.010000000000000009 style noise
  const whole = Math.floor(abs + 1e-9);
  const rest = Math.max(0, abs - whole);
  return { whole: Math.sign(bf) * whole, rest: rest < 1e-9 ? 0 : rest };
}
