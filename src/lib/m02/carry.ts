/**
 * Figure (d) CashCarryCalculator, section 4: the cash-and-carry of the core (cashAndCarry in
 * src/lib/fx/arbitrage.ts) prepared for display: market-forward range and snapping, the steps
 * grouped into "today" and "at maturity", the net cash flows per currency (zero today, the
 * profit at maturity) and the glide of the market forward back to fair ("the market reacts").
 * Pure functions; rates in CHF per USD, amounts signed (+ receive, − pay).
 */
import { cashAndCarry, type CarryStep, type CashAndCarryResult } from '@/lib/fx/arbitrage';
import { easeInOutCubic } from '@/lib/chart';
import { M02_CONFIG, PIP } from './config';

const M = M02_CONFIG.market;
const A = M02_CONFIG.arbitrage;

/** The calculator's market inputs (the running example). */
export interface CarryMarket {
  spot: number;
  rd: number;
  rf: number;
  days: number;
  notional: number;
  basisQuote: number;
  basisBase: number;
}

export const CARRY_MARKET: CarryMarket = {
  spot: M.spot,
  rd: M.rd,
  rf: M.rf,
  days: M.days,
  notional: M.notional,
  basisQuote: M.basisQuote,
  basisBase: M.basisBase,
};

/** Cash and carry for a market forward on the example market. */
export function carryFor(marketForward: number, m: CarryMarket = CARRY_MARKET): CashAndCarryResult {
  return cashAndCarry({
    S: m.spot,
    rd: m.rd,
    rf: m.rf,
    days: m.days,
    marketForward,
    notionalBase: m.notional,
    basisQuote: m.basisQuote,
    basisBase: m.basisBase,
    baseCcy: M.base,
    quoteCcy: M.quote,
  });
}

/** Slider range around the fair forward: fair ± rangePips, step stepPips (in rate units). */
export function marketRange(fair: number): { min: number; max: number; step: number } {
  return {
    min: fair - A.rangePips * PIP,
    max: fair + A.rangePips * PIP,
    step: A.stepPips * PIP,
  };
}

/** Clamps a typed or dragged market forward into the range (NaN falls back to fair). */
export function clampMarket(x: number, fair: number): number {
  const r = marketRange(fair);
  if (!Number.isFinite(x)) return fair;
  return Math.min(r.max, Math.max(r.min, x));
}

/** Snaps to the slider grid fair + k · step (used while dragging). */
export function snapMarket(x: number, fair: number): number {
  const r = marketRange(fair);
  const k = Math.round((clampMarket(x, fair) - fair) / r.step);
  return fair + k * r.step;
}

/** Start value: fair + mispricingPips. */
export function startMarket(fair: number): number {
  return fair + A.mispricingPips * PIP;
}

export interface StepGroups {
  today: CarryStep[];
  maturity: CarryStep[];
  /** The profit summary line (not a cash flow), if there is a trade. */
  profit: CarryStep | null;
}

/** Splits the ordered steps into today, maturity and the profit line. */
export function groupSteps(r: CashAndCarryResult): StepGroups {
  const today: CarryStep[] = [];
  const maturity: CarryStep[] = [];
  let profit: CarryStep | null = null;
  for (const s of r.steps) {
    if (s.key === 'profit') profit = s;
    else if (s.at === 'today') today.push(s);
    else maturity.push(s);
  }
  return { today, maturity, profit };
}

/**
 * Net cash per currency today and at maturity, summing only real cash flows (the forward
 * agreement and the profit line move no cash). Spot trades count both legs.
 */
export function netFlows(r: CashAndCarryResult): {
  today: Record<string, number>;
  maturity: Record<string, number>;
} {
  const out = { today: {} as Record<string, number>, maturity: {} as Record<string, number> };
  for (const s of r.steps) {
    if (!s.cashflow) continue;
    const bucket = out[s.at];
    bucket[s.ccy] = (bucket[s.ccy] ?? 0) + s.amount;
    if (s.counter) bucket[s.counter.ccy] = (bucket[s.counter.ccy] ?? 0) + s.counter.amount;
  }
  // Remove float noise (e.g. 1e-10) so "CHF 0" never shows as "−0".
  for (const b of [out.today, out.maturity]) {
    for (const k of Object.keys(b)) if (Math.abs(b[k]!) < 1e-6) b[k] = 0;
  }
  return out;
}

/**
 * "The market reacts": the market forward at progress k ∈ [0, 1] on its way from `from` back to
 * the fair forward (easeInOutCubic). k ≥ 1 is exactly fair.
 */
export function reactionAt(from: number, fair: number, k: number): number {
  if (k >= 1) return fair;
  if (k <= 0) return from;
  return from + (fair - from) * easeInOutCubic(k);
}

/** How a step's `rate` is shown: an interest rate p.a., an FX rate (spot/forward) or nothing. */
export function stepRateKind(key: CarryStep['key']): 'pct' | 'fx' | 'none' {
  if (key === 'profit') return 'none';
  if (/^(borrow|invest|withdraw|repay)/.test(key)) return 'pct';
  return 'fx';
}

/** Ids of the step list in reveal order (today, then maturity, then the profit line). */
export function revealOrder(r: CashAndCarryResult): CarryStep['key'][] {
  const g = groupSteps(r);
  return [...g.today, ...g.maturity, ...(g.profit ? [g.profit] : [])].map((s) => s.key);
}
