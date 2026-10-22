/**
 * Payoff logic of every Monte Carlo product: one kernel per product, used both by the pricer
 * (fast, only the discounted P&L is summed) and by the path simulator (every cash flow with
 * its details). Pure, no DOM.
 *
 * A kernel walks through the observations of one path (the spots on product.fixingDays) and
 * reports each event to a {@link CashflowSink}. The pricer passes a sink that only adds
 * DF · pnl; {@link productPayoff} passes one that records full {@link Cashflow} objects. So the
 * simulator shows exactly the logic that is priced.
 *
 * Conventions (client view): amounts + received, − paid; pnlQuote = amountBase · S_i +
 * amountQuote, the CHF value of the cash flow against the market at the fixing.
 */
import {
  MC_CONFIG,
  type LastFixingRule,
  type Market,
  type Product,
  type ProductKind,
  type ProductOf,
} from './products';

/** Kind of an event on a fixing. 'ko' and 'target' are markers with zero amounts. */
export type CashflowKind = 'buy' | 'sell' | 'coupon' | 'payment' | 'ko' | 'target';

/** Why a product ended. */
export type EndReason = 'maturity' | 'knockout' | 'target';

/** One event of a path, client view. */
export interface Cashflow {
  /** Fixing (observation) number, 1-based as in the UI ("Fixing 3 of 26"). */
  fixing: number;
  /** Calendar day from today. */
  day: number;
  /** Spot fixing S_i. */
  spot: number;
  kind: CashflowKind;
  /** USD received (+) or paid (−). */
  amountBase: number;
  /** CHF received (+) or paid (−). */
  amountQuote: number;
  /** CHF value against the market: amountBase · spot + amountQuote. */
  pnlQuote: number;
  /** Traded rate for 'buy' / 'sell' (CHF per USD), otherwise null. */
  rate: number | null;
  /**
   * Target progress after this fixing: counted gain in CHF per USD (TARF, Pivot TARF) or the
   * number of coupons paid (TPF, RTPF); 0 for products without a target.
   */
  targetProgress: number;
  /** Discount factor e^(−rd · day/365) of the cash flow. */
  df: number;
}

/** Result of one path. */
export interface PayoffResult {
  cashflows: Cashflow[];
  /** Number (1-based) of the last fixing processed. */
  endedAt: number;
  /** Day of the last fixing processed. */
  endDay: number;
  reason: EndReason;
  /** Σ pnlQuote (undiscounted, CHF). */
  totalPnlQuote: number;
  /** Σ DF · pnlQuote (CHF), the path's contribution to the PV. */
  pvQuote: number;
  /** Σ amountBase (USD bought +, sold −). */
  totalBase: number;
  /** Σ amountQuote (CHF). */
  totalQuote: number;
}

/**
 * Receives the events of a kernel. `i` is the 0-based observation index; `rate` is NaN for
 * events without a traded rate.
 */
export interface CashflowSink {
  flow(
    i: number,
    kind: CashflowKind,
    amountBase: number,
    amountQuote: number,
    pnlQuote: number,
    rate: number,
    targetProgress: number,
  ): void;
  end(i: number, reason: EndReason): void;
}

/**
 * A kernel reads the observations obs[off … off + n − 1] (n = product.fixingDays.length) of one
 * path and reports every event to the sink, ending with exactly one sink.end call.
 */
export type Kernel<P extends Product> = (
  obs: ArrayLike<number>,
  off: number,
  p: P,
  sink: CashflowSink,
) => void;

// ---------------------------------------------------------------------------------------------
// Kernels
// ---------------------------------------------------------------------------------------------

/**
 * Accumulator (client buys USD), per fixing S:
 * S ≥ B → knock-out, product ends (trade on that fixing only if tradeOnKnockOutFixing: N at K);
 * K ≤ S < B → buys N at K; S < K → buys leverage · N at K.
 */
export const accumulatorKernel: Kernel<ProductOf<'accumulator'>> = (obs, off, p, sink) => {
  const n = p.fixingDays.length;
  const K = p.strike;
  for (let i = 0; i < n; i++) {
    const S = obs[off + i]!;
    if (S >= p.barrier) {
      if (p.tradeOnKnockOutFixing) {
        sink.flow(i, 'buy', p.notional, -K * p.notional, (S - K) * p.notional, K, 0);
      }
      sink.flow(i, 'ko', 0, 0, 0, NaN, 0);
      sink.end(i, 'knockout');
      return;
    }
    const q = S >= K ? p.notional : p.leverage * p.notional;
    sink.flow(i, 'buy', q, -K * q, (S - K) * q, K, 0);
  }
  sink.end(n - 1, 'maturity');
};

/**
 * Decumulator (client sells USD), mirror of the accumulator:
 * S ≤ B → knock-out; B < S ≤ K → sells N at K; S > K → sells leverage · N at K.
 */
export const decumulatorKernel: Kernel<ProductOf<'decumulator'>> = (obs, off, p, sink) => {
  const n = p.fixingDays.length;
  const K = p.strike;
  for (let i = 0; i < n; i++) {
    const S = obs[off + i]!;
    if (S <= p.barrier) {
      if (p.tradeOnKnockOutFixing) {
        sink.flow(i, 'sell', -p.notional, K * p.notional, (K - S) * p.notional, K, 0);
      }
      sink.flow(i, 'ko', 0, 0, 0, NaN, 0);
      sink.end(i, 'knockout');
      return;
    }
    const q = S <= K ? p.notional : p.leverage * p.notional;
    sink.flow(i, 'sell', -q, K * q, (K - S) * q, K, 0);
  }
  sink.end(n - 1, 'maturity');
};

/**
 * Trade on the fixing that reaches the target. `gain` ≥ 0 is the full gain per USD at the
 * strike, `remaining` the target still open; `buy` = client buys USD (else sells).
 * 'capped': N at the rate that makes the gain equal `remaining`; 'full': N at the strike;
 * 'none': no trade.
 */
function targetTrade(
  sink: CashflowSink,
  i: number,
  rule: LastFixingRule,
  buy: boolean,
  S: number,
  notional: number,
  gain: number,
  remaining: number,
  target: number,
): void {
  if (rule !== 'none') {
    const g = rule === 'capped' ? remaining : gain;
    const rate = buy ? S - g : S + g;
    if (buy) sink.flow(i, 'buy', notional, -rate * notional, g * notional, rate, target);
    else sink.flow(i, 'sell', -notional, rate * notional, g * notional, rate, target);
  }
  sink.flow(i, 'target', 0, 0, 0, NaN, target);
  sink.end(i, 'target');
}

/**
 * TARF (client buys USD), per fixing S:
 * S ≥ K → buys N at K, the gain (S − K) counts to the target; if the cumulative gain reaches
 * the target, the last gain is capped (MC_CONFIG lastFixing) and the product ends.
 * S < K → buys leverage · N at K; the loss does not count.
 */
export const tarfKernel: Kernel<ProductOf<'tarf'>> = (obs, off, p, sink) => {
  const n = p.fixingDays.length;
  const K = p.strike;
  const N = p.notional;
  let cum = 0;
  for (let i = 0; i < n; i++) {
    const S = obs[off + i]!;
    if (S >= K) {
      const g = S - K;
      if (cum + g >= p.target) {
        targetTrade(sink, i, p.lastFixing, true, S, N, g, p.target - cum, p.target);
        return;
      }
      cum += g;
      sink.flow(i, 'buy', N, -K * N, g * N, K, cum);
    } else {
      const q = p.leverage * N;
      sink.flow(i, 'buy', q, -K * q, (S - K) * q, K, cum);
    }
  }
  sink.end(n - 1, 'maturity');
};

/**
 * Pivot TARF, per fixing S (P = pivot, K1 < P < K2):
 * S ≤ K1 → buys leverage · N at K1 (loss); K1 < S ≤ P → buys N at K1 (gain S − K1 counts);
 * P < S < K2 → sells N at K2 (gain K2 − S counts); S ≥ K2 → sells leverage · N at K2 (loss).
 * Gains count to the target as in the TARF.
 */
export const pivotTarfKernel: Kernel<ProductOf<'pivotTarf'>> = (obs, off, p, sink) => {
  const n = p.fixingDays.length;
  const K1 = p.lowerStrike;
  const K2 = p.upperStrike;
  const N = p.notional;
  const L = p.leverage * N;
  let cum = 0;
  for (let i = 0; i < n; i++) {
    const S = obs[off + i]!;
    if (S <= K1) {
      sink.flow(i, 'buy', L, -K1 * L, (S - K1) * L, K1, cum);
    } else if (S >= K2) {
      sink.flow(i, 'sell', -L, K2 * L, (K2 - S) * L, K2, cum);
    } else {
      const buy = S <= p.pivot;
      const g = buy ? S - K1 : K2 - S;
      if (cum + g >= p.target) {
        targetTrade(sink, i, p.lastFixing, buy, S, N, g, p.target - cum, p.target);
        return;
      }
      cum += g;
      if (buy) sink.flow(i, 'buy', N, -K1 * N, g * N, K1, cum);
      else sink.flow(i, 'sell', -N, K2 * N, g * N, K2, cum);
    }
  }
  sink.end(n - 1, 'maturity');
};

/**
 * TPF (directional coupon), per fixing S:
 * S ≥ K → receives c · N (one coupon); S < K → pays leverage · (K − S) · N.
 * Ends after the fixing that pays coupon number targetCoupons.
 */
export const tpfKernel: Kernel<ProductOf<'tpf'>> = (obs, off, p, sink) => {
  const n = p.fixingDays.length;
  const N = p.notional;
  let coupons = 0;
  for (let i = 0; i < n; i++) {
    const S = obs[off + i]!;
    if (S >= p.strike) {
      coupons++;
      sink.flow(i, 'coupon', 0, p.coupon * N, p.coupon * N, NaN, coupons);
      if (coupons >= p.targetCoupons) {
        sink.flow(i, 'target', 0, 0, 0, NaN, coupons);
        sink.end(i, 'target');
        return;
      }
    } else {
      const pay = -p.leverage * (p.strike - S) * N;
      sink.flow(i, 'payment', 0, pay, pay, NaN, coupons);
    }
  }
  sink.end(n - 1, 'maturity');
};

/**
 * RTPF (range coupon), per fixing S:
 * L ≤ S ≤ U → receives c · N; S < L → pays leverage · (L − S) · N;
 * S > U → pays leverage · (S − U) · N. Ends after targetCoupons coupons.
 */
export const rtpfKernel: Kernel<ProductOf<'rtpf'>> = (obs, off, p, sink) => {
  const n = p.fixingDays.length;
  const N = p.notional;
  let coupons = 0;
  for (let i = 0; i < n; i++) {
    const S = obs[off + i]!;
    if (S >= p.lower && S <= p.upper) {
      coupons++;
      sink.flow(i, 'coupon', 0, p.coupon * N, p.coupon * N, NaN, coupons);
      if (coupons >= p.targetCoupons) {
        sink.flow(i, 'target', 0, 0, 0, NaN, coupons);
        sink.end(i, 'target');
        return;
      }
    } else {
      const dist = S < p.lower ? p.lower - S : S - p.upper;
      const pay = -p.leverage * dist * N;
      sink.flow(i, 'payment', 0, pay, pay, NaN, coupons);
    }
  }
  sink.end(n - 1, 'maturity');
};

/**
 * Window barrier: on observation days inside [windowStartDay, windowEndDay] a touch of the
 * barrier (up: S ≥ H, down: S ≤ H) knocks the option out. At expiryDay the surviving option is
 * exercised if in the money (call: buys N at K; put: sells N at K).
 */
export const windowBarrierKernel: Kernel<ProductOf<'windowBarrier'>> = (obs, off, p, sink) => {
  const n = p.fixingDays.length;
  const up = p.direction === 'up';
  for (let i = 0; i < n; i++) {
    const day = p.fixingDays[i]!;
    const S = obs[off + i]!;
    if (day >= p.windowStartDay && day <= p.windowEndDay && (up ? S >= p.barrier : S <= p.barrier)) {
      sink.flow(i, 'ko', 0, 0, 0, NaN, 0);
      sink.end(i, 'knockout');
      return;
    }
    if (day === p.expiryDay) {
      const N = p.notional;
      const K = p.strike;
      if (p.type === 'call' && S > K) sink.flow(i, 'buy', N, -K * N, (S - K) * N, K, 0);
      else if (p.type === 'put' && S < K) sink.flow(i, 'sell', -N, K * N, (K - S) * N, K, 0);
      sink.end(i, 'maturity');
      return;
    }
  }
  sink.end(n - 1, 'maturity');
};

/**
 * Double no-touch: a daily fixing at or outside the barriers (S ≤ L or S ≥ U) ends it without
 * payment; otherwise it pays `payout` CHF at expiry.
 */
export const doubleNoTouchKernel: Kernel<ProductOf<'doubleNoTouch'>> = (obs, off, p, sink) => {
  const n = p.fixingDays.length;
  for (let i = 0; i < n; i++) {
    const S = obs[off + i]!;
    if (S <= p.lower || S >= p.upper) {
      sink.flow(i, 'ko', 0, 0, 0, NaN, 0);
      sink.end(i, 'knockout');
      return;
    }
  }
  sink.flow(n - 1, 'payment', 0, p.payout, p.payout, NaN, 0);
  sink.end(n - 1, 'maturity');
};

/** Kernel per product kind. */
export const KERNELS: { readonly [K in ProductKind]: Kernel<ProductOf<K>> } = {
  accumulator: accumulatorKernel,
  decumulator: decumulatorKernel,
  tarf: tarfKernel,
  pivotTarf: pivotTarfKernel,
  tpf: tpfKernel,
  rtpf: rtpfKernel,
  windowBarrier: windowBarrierKernel,
  doubleNoTouch: doubleNoTouchKernel,
};

/** Runs the kernel of `product` on obs[off …]. */
export function runKernel(
  product: Product,
  obs: ArrayLike<number>,
  off: number,
  sink: CashflowSink,
): void {
  (KERNELS[product.kind] as Kernel<Product>)(obs, off, product, sink);
}

// ---------------------------------------------------------------------------------------------
// Detailed evaluation of one path (path simulator)
// ---------------------------------------------------------------------------------------------

/** Discount factors e^(−rd · day/365) for the given days. */
export function discountFactors(days: readonly number[], rd: number): Float64Array {
  const out = new Float64Array(days.length);
  const year = MC_CONFIG.conventions.daysPerYear;
  const lag = MC_CONFIG.conventions.settlementLagDays;
  for (let i = 0; i < days.length; i++) out[i] = Math.exp((-rd * (days[i]! + lag)) / year);
  return out;
}

/** Sink that records full cash flows. */
class CollectingSink implements CashflowSink {
  readonly cashflows: Cashflow[] = [];
  endIndex = -1;
  reason: EndReason = 'maturity';

  constructor(
    private readonly days: readonly number[],
    private readonly obs: ArrayLike<number>,
    private readonly dfs: Float64Array,
  ) {}

  flow(
    i: number,
    kind: CashflowKind,
    amountBase: number,
    amountQuote: number,
    pnlQuote: number,
    rate: number,
    targetProgress: number,
  ): void {
    this.cashflows.push({
      fixing: i + 1,
      day: this.days[i]!,
      spot: this.obs[i]!,
      kind,
      amountBase,
      amountQuote,
      pnlQuote,
      rate: Number.isNaN(rate) ? null : rate,
      targetProgress,
      df: this.dfs[i]!,
    });
  }

  end(i: number, reason: EndReason): void {
    this.endIndex = i;
    this.reason = reason;
  }
}

/** The spots of a daily path on the product's observation days. */
export function observationsFromPath(path: ArrayLike<number>, product: Product): Float64Array {
  const days = product.fixingDays;
  const last = days[days.length - 1]!;
  if (path.length <= last) {
    throw new RangeError(
      `observationsFromPath: path has ${path.length} points, needs day ${last} (length ${last + 1})`,
    );
  }
  const obs = new Float64Array(days.length);
  for (let i = 0; i < days.length; i++) obs[i] = path[days[i]!]!;
  return obs;
}

/**
 * Evaluates one daily path (path[0] = spot today, path[d] = spot after d days) for a product:
 * every cash flow with details, when and why it ended, total and discounted P&L (CHF).
 * This is what the path simulator shows; the pricer runs the same kernel.
 */
export function productPayoff(
  path: ArrayLike<number>,
  product: Product,
  market: Pick<Market, 'rd'>,
): PayoffResult {
  const obs = observationsFromPath(path, product);
  const dfs = discountFactors(product.fixingDays, market.rd);
  const sink = new CollectingSink(product.fixingDays, obs, dfs);
  runKernel(product, obs, 0, sink);
  let totalPnlQuote = 0;
  let pvQuote = 0;
  let totalBase = 0;
  let totalQuote = 0;
  for (const c of sink.cashflows) {
    totalPnlQuote += c.pnlQuote;
    pvQuote += c.df * c.pnlQuote;
    totalBase += c.amountBase;
    totalQuote += c.amountQuote;
  }
  return {
    cashflows: sink.cashflows,
    endedAt: sink.endIndex + 1,
    endDay: product.fixingDays[sink.endIndex]!,
    reason: sink.reason,
    totalPnlQuote,
    pvQuote,
    totalBase,
    totalQuote,
  };
}

/** Accumulator on a daily path (see {@link accumulatorKernel}). */
export const accumulatorPayoff = (
  path: ArrayLike<number>,
  p: ProductOf<'accumulator'>,
  m: Pick<Market, 'rd'>,
): PayoffResult => productPayoff(path, p, m);
/** Decumulator on a daily path (see {@link decumulatorKernel}). */
export const decumulatorPayoff = (
  path: ArrayLike<number>,
  p: ProductOf<'decumulator'>,
  m: Pick<Market, 'rd'>,
): PayoffResult => productPayoff(path, p, m);
/** TARF on a daily path (see {@link tarfKernel}). */
export const tarfPayoff = (
  path: ArrayLike<number>,
  p: ProductOf<'tarf'>,
  m: Pick<Market, 'rd'>,
): PayoffResult => productPayoff(path, p, m);
/** Pivot TARF on a daily path (see {@link pivotTarfKernel}). */
export const pivotTarfPayoff = (
  path: ArrayLike<number>,
  p: ProductOf<'pivotTarf'>,
  m: Pick<Market, 'rd'>,
): PayoffResult => productPayoff(path, p, m);
/** TPF on a daily path (see {@link tpfKernel}). */
export const tpfPayoff = (
  path: ArrayLike<number>,
  p: ProductOf<'tpf'>,
  m: Pick<Market, 'rd'>,
): PayoffResult => productPayoff(path, p, m);
/** RTPF on a daily path (see {@link rtpfKernel}). */
export const rtpfPayoff = (
  path: ArrayLike<number>,
  p: ProductOf<'rtpf'>,
  m: Pick<Market, 'rd'>,
): PayoffResult => productPayoff(path, p, m);
/** Window barrier on a daily path (see {@link windowBarrierKernel}). */
export const windowBarrierPayoff = (
  path: ArrayLike<number>,
  p: ProductOf<'windowBarrier'>,
  m: Pick<Market, 'rd'>,
): PayoffResult => productPayoff(path, p, m);
/** Double no-touch on a daily path (see {@link doubleNoTouchKernel}). */
export const doubleNoTouchPayoff = (
  path: ArrayLike<number>,
  p: ProductOf<'doubleNoTouch'>,
  m: Pick<Market, 'rd'>,
): PayoffResult => productPayoff(path, p, m);
