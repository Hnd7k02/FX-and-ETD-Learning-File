/**
 * Figure (d) SwapCompare, section 4: FX swap versus cross-currency swap (CCS) for a firm that
 * holds CHF and needs USD N for a period (buy USD now, give them back at the end).
 *
 * FX swap: two exchanges, now at S and at the end at the forward F; no flows in between. The
 *   interest differential sits in the far rate: F = S · Π (1 + rd · τq) / (1 + rf · τb).
 * CCS (simplified, fixed-for-fixed): exchange at S now, coupons each period (pay USD at rf,
 *   receive CHF at rd), re-exchange at the SAME rate S at the end.
 * Both price the same differential: in present value the FX swap's CHF shortfall equals the
 * CCS's net coupons, N · S · (DF_CHF(T) − DF_USD(T)) (no cross-currency basis).
 * Pure functions; amounts signed from the firm's view (+ receive, − pay).
 */
import { M03_CONFIG } from './config';
import type { SwapMarket } from './trip';

/** One cash flow on the timeline. */
export interface Flow {
  /** Days from the start. */
  day: number;
  ccy: 'base' | 'quote';
  /** Signed amount in that currency. */
  amount: number;
  kind: 'notional' | 'coupon';
}

/** Result of one instrument. */
export interface InstrumentFlows {
  flows: Flow[];
  /** Rate of the exchange at the start and at the end. */
  startRate: number;
  endRate: number;
}

/** Comparison of both instruments for one tenor. */
export interface Comparison {
  tenorDays: number;
  /** Coupon periods in days (one period if the tenor is at most one period). */
  periods: number[];
  fxSwap: InstrumentFlows;
  ccs: InstrumentFlows;
  /** Swap points of the FX swap in pips. */
  swapPoints: number;
  /** FX swap: CHF received back less than paid, at maturity (positive = cost). */
  fxCostChf: number;
  /** CCS: one USD coupon (positive amount) and one CHF coupon (positive amount). */
  ccsCouponBase: number;
  ccsCouponQuote: number;
  /** Present value of the interest cost in CHF: FX swap and CCS (equal without basis). */
  pvFxChf: number;
  pvCcsChf: number;
  /** Discount factors at maturity (simple per period, compounded over periods). */
  dfQuote: number;
  dfBase: number;
  /** True if the tenor is longer than what is usual for an FX swap (config). */
  fxSwapUnusual: boolean;
}

/** Splits a tenor into coupon periods of `periodDays` (one stub period if shorter). */
export function couponPeriods(tenorDays: number, periodDays: number): number[] {
  if (tenorDays <= 0) return [];
  if (tenorDays <= periodDays) return [tenorDays];
  const n = Math.floor(tenorDays / periodDays);
  const rest = tenorDays - n * periodDays;
  const out = Array.from({ length: n }, () => periodDays);
  if (rest > 0) out.push(rest);
  return out;
}

/** Compares FX swap and CCS (buy USD now, return them at the end) for one tenor. */
export function compareSwaps(
  m: SwapMarket,
  tenorDays: number,
  periodDays: number = M03_CONFIG.compare.periodDays,
): Comparison {
  const { spot: S, rd, rf, notional: N } = m;
  const bq = M03_CONFIG.market.basisQuote;
  const bb = M03_CONFIG.market.basisBase;
  const periods = couponPeriods(tenorDays, periodDays);

  let growthQ = 1;
  let growthB = 1;
  let day = 0;
  let annuityQ = 0;
  let annuityB = 0;
  const ccsFlows: Flow[] = [
    { day: 0, ccy: 'base', amount: N, kind: 'notional' },
    { day: 0, ccy: 'quote', amount: -N * S, kind: 'notional' },
  ];
  let couponBase = 0;
  let couponQuote = 0;
  for (const p of periods) {
    day += p;
    const tq = p / bq;
    const tb = p / bb;
    growthQ *= 1 + rd * tq;
    growthB *= 1 + rf * tb;
    couponBase = N * rf * tb;
    couponQuote = N * S * rd * tq;
    annuityB += tb / growthB;
    annuityQ += tq / growthQ;
    ccsFlows.push({ day, ccy: 'base', amount: -couponBase, kind: 'coupon' });
    ccsFlows.push({ day, ccy: 'quote', amount: couponQuote, kind: 'coupon' });
  }
  ccsFlows.push({ day: tenorDays, ccy: 'base', amount: -N, kind: 'notional' });
  ccsFlows.push({ day: tenorDays, ccy: 'quote', amount: N * S, kind: 'notional' });

  const F = (S * growthQ) / growthB;
  const dfQuote = 1 / growthQ;
  const dfBase = 1 / growthB;
  const fxFlows: Flow[] = [
    { day: 0, ccy: 'base', amount: N, kind: 'notional' },
    { day: 0, ccy: 'quote', amount: -N * S, kind: 'notional' },
    { day: tenorDays, ccy: 'base', amount: -N, kind: 'notional' },
    { day: tenorDays, ccy: 'quote', amount: N * F, kind: 'notional' },
  ];
  const fxCostChf = N * (S - F);
  return {
    tenorDays,
    periods,
    fxSwap: { flows: fxFlows, startRate: S, endRate: F },
    ccs: { flows: ccsFlows, startRate: S, endRate: S },
    swapPoints: (F - S) / 1e-4,
    fxCostChf,
    ccsCouponBase: couponBase,
    ccsCouponQuote: couponQuote,
    pvFxChf: fxCostChf * dfQuote,
    pvCcsChf: S * N * rf * annuityB - N * S * rd * annuityQ,
    dfQuote,
    dfBase,
    fxSwapUnusual: tenorDays > M03_CONFIG.compare.fxSwapTypicalMaxDays,
  };
}
