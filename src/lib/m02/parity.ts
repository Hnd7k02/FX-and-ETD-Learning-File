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

/** State of a step relative to the active one (a step at frac 0 has not begun yet). */
export function stepState(step: number, active: number, frac: number): 'todo' | 'active' | 'done' {
  if (step < active) return 'done';
  if (step > active) return 'todo';
  if (frac >= 1) return 'done';
  return frac <= 0 ? 'todo' : 'active';
}

/** End of step `index` in ms (clamped to the timeline). */
export function endOf(index: number, tl: Timeline = timeline()): number {
  const i = Math.min(PARITY_STEPS.length - 1, Math.max(0, index));
  return tl.starts[i]! + tl.durations[i]!;
}

/**
 * Target of the "next step" button: the end of the step that is running, or the end of the next
 * one if the current step has not begun or is complete.
 */
export function nextTarget(pos: number, tl: Timeline = timeline()): number {
  const { index, frac } = stepAt(pos, tl);
  if (frac > 0 && frac < 1) return endOf(index, tl);
  return frac >= 1 ? endOf(index + 1, tl) : endOf(index, tl);
}

/**
 * Target of the "previous step" button: the start of the running step (undo it), or the start of
 * the previous one if the current step has not begun.
 */
export function prevTarget(pos: number, tl: Timeline = timeline()): number {
  const { index, frac } = stepAt(pos, tl);
  if (frac >= 1) return startOf(index, tl);
  if (frac > 0) return startOf(index, tl);
  return startOf(Math.max(0, index - 1), tl);
}

/** Display state of one step at a playback position. */
export interface StepView {
  state: 'todo' | 'active' | 'done';
  /** Counting progress of the step's amount, 0 … 1 (eased, complete after 60 % of the step). */
  k: number;
}

export interface ParityFrame {
  /** Index of the active step and its progress. */
  index: number;
  frac: number;
  /** Days passed (0 before the 'time' step, `days` after it). */
  day: number;
  /** Route B balances at `day`: USD deposit and CHF loan. */
  usd: number;
  chf: number;
  steps: Record<ParityStepId, StepView>;
}

/** Ease-out for counting numbers (fast start, calm landing). */
function easeOut(k: number): number {
  return 1 - (1 - k) ** 3;
}

/**
 * Everything the figure shows at playback time `pos` (ms): step states, counting progress,
 * the day counter and the balances of route B. Pure, so the animation is testable.
 */
export function parityFrame(
  pos: number,
  p: ParityInput,
  r: ParityResult = parity(p),
  tl: Timeline = timeline(),
): ParityFrame {
  const { index, frac } = stepAt(pos, tl);
  const steps = {} as Record<ParityStepId, StepView>;
  PARITY_STEPS.forEach((id, i) => {
    const state = stepState(i, index, frac);
    const k = state === 'done' ? 1 : state === 'todo' ? 0 : easeOut(Math.min(1, frac / 0.6));
    steps[id] = { state, k };
  });
  const timeIdx = PARITY_STEPS.indexOf('time');
  const dayFrac = index > timeIdx ? 1 : index < timeIdx ? 0 : frac;
  const day = p.days * dayFrac;
  const b = balancesAt(day, p, r);
  return { index, frac, day, usd: b.usd, chf: b.chf, steps };
}

/** A rectangle in viewBox units. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Cards of the two lanes: A1/A2 route A (forward), B1…B5 route B (money market). */
export type ParityCard = 'A1' | 'A2' | 'B1' | 'B2' | 'B3' | 'B4' | 'B5';

export interface ParityLayout {
  width: number;
  height: number;
  compact: boolean;
  /** Font sizes of labels and amounts (≥ 11 px). */
  font: number;
  mono: number;
  /** Centre line between the lanes. */
  spine: number;
  laneA: { x: number; w: number };
  laneB: { x: number; w: number };
  /** Y of the lane titles and subtitles. */
  titleY: number;
  subY: number;
  /** Y of the band dividers (chip centres): today, the term, maturity. */
  todayY: number;
  termY: number;
  maturityY: number;
  /** Rows of the balances in the term band (lane B) and the middle of the band. */
  balanceY: [number, number];
  termMid: number;
  cards: Record<ParityCard, Box>;
  result: Box;
}

/**
 * Geometry of the two vertical swim lanes (route A left, route B right, time flowing down) for
 * an SVG `width` px wide (1:1 with CSS pixels, so fonts stay ≥ 11 px). Compact under 520 px.
 */
export function parityLayout(width: number): ParityLayout {
  const W = Math.max(300, Math.round(width));
  const compact = W < 520;
  const font = compact ? 11 : 12;
  const mono = compact ? 11.5 : 13;
  const gutter = compact ? 40 : 64;
  const spine = W / 2;
  const laneW = (W - gutter) / 2;
  const laneA = { x: 0, w: laneW };
  const laneB = { x: W - laneW, w: laneW };
  const head = compact ? 40 : 44;
  const h = compact ? 62 : 54;
  const g = 14;
  const todayY = head + 12;
  const c0 = todayY + 22;
  const row = (i: number) => c0 + i * (h + g);
  const termY = row(3) - g + 22;
  const balanceY: [number, number] = [termY + 26, termY + 26 + (compact ? 30 : 28)];
  const maturityY = balanceY[1] + (compact ? 34 : 32);
  const m0 = maturityY + 22;
  const mrow = (i: number) => m0 + i * (h + g);
  const box = (lane: { x: number; w: number }, y: number, hh = h): Box => ({
    x: lane.x,
    y,
    w: lane.w,
    h: hh,
  });
  const resultY = mrow(2) - g + 18;
  const resultH = compact ? 92 : 74;
  return {
    width: W,
    height: resultY + resultH + 2,
    compact,
    font,
    mono,
    spine,
    laneA,
    laneB,
    titleY: compact ? 14 : 16,
    subY: compact ? 30 : 34,
    todayY,
    termY,
    maturityY,
    balanceY,
    termMid: (termY + maturityY) / 2,
    cards: {
      A1: box(laneA, row(0)),
      B1: box(laneB, row(0)),
      B2: box(laneB, row(1)),
      B3: box(laneB, row(2)),
      B4: box(laneB, mrow(0)),
      B5: box(laneB, mrow(1)),
      A2: box(laneA, mrow(0), 2 * h + g),
    },
    result: { x: 0, y: resultY, w: W, h: resultH },
  };
}
