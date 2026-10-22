/**
 * Builds the content of src/data/fx/mc-products.json: fair (zero-cost) strikes, coupons and the
 * pivot width of the §8.7 products with standard errors, the window barrier and double no-touch
 * values, and the dual currency terms. Pure (no file access); scripts/precompute-mc.ts writes
 * the file. Deterministic: same config and seed → same numbers (rounded, see ROUNDING).
 */
import { doubleNoTouch } from '../exotics/doubleNoTouch';
import { gkPrice } from '../vanilla';
import { buildDualCurrency, dualCurrencyQuote } from './dci';
import { bgkShift } from './gbm';
import {
  averageFixingDay,
  buildProduct,
  DEFAULT_MARKET,
  forwardAt,
  MC_CONFIG,
  PIP,
  SOLVED_PARAM,
  type Market,
  type Product,
  type SolveParam,
  type ZeroCostKind,
} from './products';
import { price, simulateObservations, solveParameter, type ObservationSet, type PriceStats } from './value';

/** Decimal places in the JSON. Rates and strikes: 0.01 pip; pips: 0.01; CHF: 0.01. */
export const ROUNDING = { rate: 6, rateErr: 7, pips: 2, chf: 2, prob: 4, count: 3 } as const;

/** Rounds to `digits` decimals via toFixed (deterministic, no binary noise in the JSON). */
export function roundTo(x: number, digits: number): number {
  const r = Number(x.toFixed(digits));
  return Object.is(r, -0) ? 0 : r;
}

/** Statistics of a valuation as stored in the JSON. */
export interface StoredStats {
  pMaturity: number;
  pKnockOut: number;
  pTarget: number;
  expectedFixings: number;
  /** Expected USD traded (+ bought, − sold). */
  expectedBase: number;
  /** 5 % quantile and minimum of the path PV (CHF). */
  pvQuantile05: number;
  pvMin: number;
}

/** One zero-cost product in the JSON. */
export interface StoredZeroCost {
  param: SolveParam;
  /** Solved parameter (strike, coupon or width in CHF per USD). */
  value: number;
  stdErr: number;
  stdErrPips: number;
  paths: number;
  seed: number;
  antithetic: boolean;
  iterations: number;
  /** PV at the solution on the same paths (CHF, ≈ 0) and its standard error. */
  pvAtValue: number;
  pvStdErr: number;
  /** Forward to the average fixing day and that day. */
  forwardAvg: number;
  avgFixingDay: number;
  stats: StoredStats;
  /** Full product definition with the solved parameter (what fairProduct() returns). */
  product: Product;
  /** Strike products: fair strike, and its distance to forwardAvg in pips (+ = above). */
  fairStrike?: number;
  vsForwardPips?: number;
  /** Coupon products: fair coupon (CHF per USD) and in pips. */
  fairCoupon?: number;
  couponPips?: number;
  /** Pivot TARF: fair half-width d and the strikes K1 = P − d, K2 = P + d. */
  fairWidth?: number;
  lowerStrike?: number;
  upperStrike?: number;
}

/** A premium product valued by Monte Carlo, with closed forms for comparison. */
export interface StoredPremium {
  pv: number;
  stdErr: number;
  paths: number;
  seed: number;
  stats: StoredStats;
  product: Product;
  /** Comparison values (CHF): e.g. vanilla, continuous closed form, BGK-shifted closed form. */
  compare: Record<string, number>;
}

export interface McProductsData {
  generatedAt: string;
  note: string;
  market: Market;
  engine: {
    generator: string;
    normals: string;
    stepDays: number;
    antithetic: boolean;
    paths: number;
    seed: number;
  };
  products: Record<ZeroCostKind, StoredZeroCost> & {
    windowBarrier: StoredPremium;
    doubleNoTouch: StoredPremium;
  };
  dualCurrency: {
    capital: number;
    days: number;
    strike: number;
    interestBasis: number;
    convertInterest: boolean;
    premium: number;
    premiumPips: number;
    moneyMarketRate: number;
    premiumYield: number;
    yieldPa: number;
    interest: number;
    conversionAmountBase: number;
    breakEven: number;
  };
}

export interface PrecomputeOptions {
  paths?: number;
  seed?: number;
  market?: Market;
  /** ISO date for generatedAt (date only). */
  date?: string;
  /** Progress messages (e.g. console.log). */
  log?: (message: string) => void;
}

function storeStats(s: PriceStats): StoredStats {
  return {
    pMaturity: roundTo(s.endProbability.maturity, ROUNDING.prob),
    pKnockOut: roundTo(s.endProbability.knockout, ROUNDING.prob),
    pTarget: roundTo(s.endProbability.target, ROUNDING.prob),
    expectedFixings: roundTo(s.expectedFixings, ROUNDING.count),
    expectedBase: roundTo(s.expectedBase, ROUNDING.chf),
    pvQuantile05: roundTo(s.pvQuantile05, ROUNDING.chf),
    pvMin: roundTo(s.pvMin, ROUNDING.chf),
  };
}

/** Rounds the solved parameter inside the product definition (so fairProduct uses it). */
function roundedProduct(p: Product, param: SolveParam, value: number): Product {
  if (param === 'width' && p.kind === 'pivotTarf') {
    return {
      ...p,
      lowerStrike: roundTo(p.pivot - value, ROUNDING.rate),
      upperStrike: roundTo(p.pivot + value, ROUNDING.rate),
    };
  }
  return { ...p, [param]: value } as Product;
}

/** Runs every valuation; returns the JSON object. */
export function precomputeMcProducts(opts: PrecomputeOptions = {}): McProductsData {
  const market = opts.market ?? DEFAULT_MARKET;
  const paths = opts.paths ?? MC_CONFIG.engine.precomputePaths;
  const seed = opts.seed ?? MC_CONFIG.engine.seed;
  const antithetic = MC_CONFIG.engine.antithetic;
  const log = opts.log ?? (() => undefined);
  const mc = { paths, seed, antithetic };

  // Products with the same fixing days share one simulation (common random numbers).
  const cache = new Map<string, ObservationSet>();
  const observations = (days: readonly number[]): ObservationSet => {
    const key = days.join(',');
    let set = cache.get(key);
    if (!set) {
      set = simulateObservations(market, days, mc);
      cache.set(key, set);
    }
    return set;
  };

  const zeroCost = {} as Record<ZeroCostKind, StoredZeroCost>;
  for (const kind of Object.keys(SOLVED_PARAM) as ZeroCostKind[]) {
    const t0 = Date.now();
    const param = SOLVED_PARAM[kind];
    const start = buildProduct(kind, market);
    const r = solveParameter(start, param, market, { ...mc, observations: observations(start.fixingDays) });
    const value = roundTo(r.value, ROUNDING.rate);
    const forwardAvg = forwardAt(market, averageFixingDay(start));
    const entry: StoredZeroCost = {
      param,
      value,
      stdErr: roundTo(r.stdErr, ROUNDING.rateErr),
      stdErrPips: roundTo(r.stdErr / PIP, ROUNDING.pips),
      paths: r.paths,
      seed: r.seed,
      antithetic: r.antithetic,
      iterations: r.iterations,
      pvAtValue: roundTo(r.pvAtValue, ROUNDING.chf),
      pvStdErr: roundTo(r.pvStdErr, ROUNDING.chf),
      forwardAvg: roundTo(forwardAvg, ROUNDING.rate),
      avgFixingDay: roundTo(averageFixingDay(start), ROUNDING.count),
      stats: storeStats(r.priced.stats),
      product: roundedProduct(r.product, param, value),
    };
    if (param === 'strike') {
      entry.fairStrike = value;
      entry.vsForwardPips = roundTo((value - forwardAvg) / PIP, ROUNDING.pips);
    } else if (param === 'coupon') {
      entry.fairCoupon = value;
      entry.couponPips = roundTo(value / PIP, ROUNDING.pips);
    } else {
      const p = entry.product as Extract<Product, { kind: 'pivotTarf' }>;
      entry.fairWidth = value;
      entry.lowerStrike = p.lowerStrike;
      entry.upperStrike = p.upperStrike;
    }
    zeroCost[kind] = entry;
    log(
      `${kind.padEnd(12)} ${param.padEnd(6)} ${value.toFixed(6)} ± ${entry.stdErrPips.toFixed(2)} pips` +
        `  (forward avg ${forwardAvg.toFixed(5)}, ${r.iterations} it, ${((Date.now() - t0) / 1000).toFixed(1)} s)`,
    );
  }

  // Window barrier (no closed form for the window; vanilla for comparison).
  const t1 = Date.now();
  const wb = buildProduct('windowBarrier', market);
  const wbPrice = price(wb, market, mc);
  const T = wb.expiryDay / MC_CONFIG.conventions.daysPerYear;
  const vanilla = wb.notional * gkPrice(market.spot, wb.strike, T, market.vol, market.rd, market.rf, wb.type);
  log(
    `windowBarrier pv ${wbPrice.pv.toFixed(2)} ± ${wbPrice.stdErr.toFixed(2)} CHF (vanilla ${vanilla.toFixed(2)}, ` +
      `${((Date.now() - t1) / 1000).toFixed(1)} s)`,
  );

  // Double no-touch against Hui's continuous series, plain and with BGK-shifted barriers.
  const t2 = Date.now();
  const dnt = buildProduct('doubleNoTouch', market);
  const dntPrice = price(dnt, market, mc);
  const Td = dnt.expiryDay / MC_CONFIG.conventions.daysPerYear;
  const dntArgs = { S: market.spot, T: Td, vol: market.vol, rd: market.rd, rf: market.rf, payout: dnt.payout };
  const dntContinuous = doubleNoTouch({ ...dntArgs, L: dnt.lower, U: dnt.upper });
  const dntBgk = doubleNoTouch({
    ...dntArgs,
    L: bgkShift(dnt.lower, market.spot, market.vol),
    U: bgkShift(dnt.upper, market.spot, market.vol),
  });
  log(
    `doubleNoTouch pv ${dntPrice.pv.toFixed(2)} ± ${dntPrice.stdErr.toFixed(2)} CHF (continuous ` +
      `${dntContinuous.toFixed(2)}, BGK ${dntBgk.toFixed(2)}, ${((Date.now() - t2) / 1000).toFixed(1)} s)`,
  );

  // Dual currency, closed form.
  const dci = buildDualCurrency(market);
  const q = dualCurrencyQuote(dci, market);

  return {
    generatedAt: opts.date ?? new Date().toISOString().slice(0, 10),
    note: 'Generated by scripts/precompute-mc.ts (npm run data:mc). Example values, not market data.',
    market: { ...market },
    engine: {
      generator: 'xoshiro128** (SplitMix32 seeding)',
      normals: 'Marsaglia polar',
      stepDays: 1,
      antithetic,
      paths: zeroCost.accumulator.paths,
      seed,
    },
    products: {
      ...zeroCost,
      windowBarrier: {
        pv: roundTo(wbPrice.pv, ROUNDING.chf),
        stdErr: roundTo(wbPrice.stdErr, ROUNDING.chf),
        paths: wbPrice.paths,
        seed,
        stats: storeStats(wbPrice.stats),
        product: wb,
        compare: { vanilla: roundTo(vanilla, ROUNDING.chf) },
      },
      doubleNoTouch: {
        pv: roundTo(dntPrice.pv, ROUNDING.chf),
        stdErr: roundTo(dntPrice.stdErr, ROUNDING.chf),
        paths: dntPrice.paths,
        seed,
        stats: storeStats(dntPrice.stats),
        product: dnt,
        compare: {
          continuous: roundTo(dntContinuous, ROUNDING.chf),
          continuousBgk: roundTo(dntBgk, ROUNDING.chf),
        },
      },
    },
    dualCurrency: {
      capital: dci.capital,
      days: dci.days,
      strike: roundTo(dci.strike, ROUNDING.rate),
      interestBasis: dci.interestBasis,
      convertInterest: dci.convertInterest,
      premium: roundTo(q.premium, ROUNDING.chf),
      premiumPips: roundTo(q.putPerUnit / PIP, ROUNDING.pips),
      moneyMarketRate: roundTo(q.moneyMarketRate, ROUNDING.rate),
      premiumYield: roundTo(q.premiumYield, ROUNDING.rate),
      yieldPa: roundTo(q.yieldPa, ROUNDING.rate),
      interest: roundTo(q.interest, ROUNDING.chf),
      conversionAmountBase: roundTo(q.conversionAmountBase, ROUNDING.chf),
      breakEven: roundTo(q.breakEven, ROUNDING.rate),
    },
  };
}
