/**
 * Figure (b) ParityPaths, section 2: two equally safe routes to USD N at maturity.
 *
 * - Route A: buy USD N forward at F today; at maturity pay N · F CHF.
 * - Route B: borrow CHF Q0 today, buy USD B0 = N / (1 + rf · tb) spot (Q0 = S · B0), invest the
 *   USD at rf. At maturity the deposit pays exactly N USD and the loan costs Q0 · (1 + rd · tq).
 * Same result, no exchange-rate risk on either route ⇒ same price: N · F = Q0 · (1 + rd · tq),
 * so F = S · (1 + rd · tq) / (1 + rf · tb) (covered interest parity, money market).
 *
 * The comparison with the continuous forward of the option models uses the same year fraction
 * T = days / basisQuote, so the two differ only by the compounding (choice, see M02_CONFIG):
 * in the example 90/360 = 0.25 = the option model's T for 3 months.
 * Pure functions; amounts in the currency named, rates simple p.a.
 */
import { forwardContinuous, forwardMoneyMarket } from '@/lib/fx/forward';
import { M02_CONFIG, PIP } from './config';

export interface ParityInput {
  spot: number;
  rd: number;
  rf: number;
  days: number;
  notional: number;
  basisQuote: number;
  basisBase: number;
}

export interface ParityResult {
  /** Year fractions: quote (CHF) and base (USD) money-market day counts. */
  tq: number;
  tb: number;
  /** Growth factors 1 + rd · tq and 1 + rf · tb. */
  growthQuote: number;
  growthBase: number;
  /** Money-market forward (route A price, CHF per USD). */
  forward: number;
  /** Continuous forward S · e^((rd − rf) · tq) of the option models (same year fraction). */
  forwardContinuous: number;
  /** (continuous − money market) in pips: the compounding effect. */
  diffPips: number;
  /** Forward points (money market) in pips. */
  points: number;
  /** Route B today: USD bought spot and invested, B0 = N / (1 + rf · tb). */
  usdToday: number;
  /** Route B today: CHF borrowed and spent, Q0 = S · B0. */
  chfLoan: number;
  /** Interest earned on the USD deposit: N − B0. */
  usdInterest: number;
  /** Interest paid on the CHF loan: Q0 · rd · tq. */
  chfInterest: number;
  /** Route B at maturity: CHF repaid, Q0 · (1 + rd · tq). Equals route A's N · F. */
  chfRepay: number;
  /** Route A at maturity: CHF paid for N USD, N · F. */
  chfForward: number;
}

/** Both routes of covered interest parity with all amounts. */
export function parity(p: ParityInput): ParityResult {
  const tq = p.days / p.basisQuote;
  const tb = p.days / p.basisBase;
  const growthQuote = 1 + p.rd * tq;
  const growthBase = 1 + p.rf * tb;
  const forward = forwardMoneyMarket(p.spot, p.rd, p.rf, p.days, p.basisQuote, p.basisBase);
  const fc = forwardContinuous(p.spot, p.rd, p.rf, tq);
  const usdToday = p.notional / growthBase;
  const chfLoan = p.spot * usdToday;
  return {
    tq,
    tb,
    growthQuote,
    growthBase,
    forward,
    forwardContinuous: fc,
    diffPips: (fc - forward) / PIP,
    points: (forward - p.spot) / PIP,
    usdToday,
    chfLoan,
    usdInterest: p.notional - usdToday,
    chfInterest: chfLoan * p.rd * tq,
    chfRepay: chfLoan * growthQuote,
    chfForward: p.notional * forward,
  };
}

/** Balances of route B after `day` days: USD deposit and CHF loan (simple interest). */
export function balancesAt(
  day: number,
  p: ParityInput,
  r: ParityResult = parity(p),
): { usd: number; chf: number } {
  const d = Math.min(p.days, Math.max(0, day));
  return {
    usd: r.usdToday * (1 + (p.rf * d) / p.basisBase),
    chf: r.chfLoan * (1 + (p.rd * d) / p.basisQuote),
  };
}

/** The steps of the animation, in playback order. */
export const PARITY_STEPS = ['A1', 'B1', 'B2', 'B3', 'time', 'B4', 'B5', 'A2', 'result'] as const;
export type ParityStepId = (typeof PARITY_STEPS)[number];

export interface Timeline {
  /** Start of each step in ms. */
  starts: number[];
  /** Duration of each step in ms. */
  durations: number[];
  /** Total duration in ms. */
  total: number;
}

/** Start times of the steps from their durations (missing durations count 1000 ms). */
export function timeline(ms: readonly number[] = M02_CONFIG.parity.stepMs): Timeline {
  const durations = PARITY_STEPS.map((_, i) => Math.max(1, ms[i] ?? 1000));
  const starts: number[] = [];
  let t = 0;
  for (const d of durations) {
    starts.push(t);
    t += d;
  }
  return { starts, durations, total: t };
}

/**
 * Which step is active at playback time `pos` (ms) and how far it is (0 … 1). At or beyond the
 * end the last step is complete (index = last, frac = 1).
 */
export function stepAt(pos: number, tl: Timeline = timeline()): { index: number; frac: number } {
  const last = PARITY_STEPS.length - 1;
  if (pos >= tl.total) return { index: last, frac: 1 };
  const p = Math.max(0, pos);
  let i = 0;
  while (i < last && p >= tl.starts[i + 1]!) i++;
  return { index: i, frac: Math.min(1, (p - tl.starts[i]!) / tl.durations[i]!) };
}

/** Playback time at which step `index` starts (for "previous/next step" buttons). */
export function startOf(index: number, tl: Timeline = timeline()): number {
  if (index >= PARITY_STEPS.length) return tl.total;
  return tl.starts[Math.max(0, index)]!;
}

/** State of a step relative to the active one. */
export function stepState(step: number, active: number, frac: number): 'todo' | 'active' | 'done' {
  if (step < active) return 'done';
  if (step > active) return 'todo';
  return frac >= 1 ? 'done' : 'active';
}
