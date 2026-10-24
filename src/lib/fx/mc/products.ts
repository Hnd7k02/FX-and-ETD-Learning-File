/**
 * Structured products for the Monte Carlo engine: typed definitions, the building-block
 * description for the UI, and MC_CONFIG, the ONE place for every parameter, path count, seed
 * and convention of the engine (D-22: uncertain choices live in one documented config object).
 *
 * Simplified, generic product designs ("Marktvarianten unterscheiden sich"), as defined in
 * docs/MASTER_PROMPT.md §8.7. Notation: S_i = USD/CHF fixing, N = notional per fixing,
 * leverage 2. Zero premium: the strike, coupon or pivot width is solved so that PV = 0.
 *
 * Sign convention everywhere: from the client's point of view. Amounts in base currency (USD)
 * and quote currency (CHF) are + when the client receives them and − when he pays them.
 * P&L "against the market" (pnlQuote) = amountBase · S_i + amountQuote, e.g. buying N USD at K
 * when the fixing is S_i is worth (S_i − K) · N CHF.
 */
import { EXAMPLE, EXAMPLE_STRIKE } from '../example';
import type { OptionType } from '../vanilla';

/** Market inputs of the engine (continuous rates, rd = CHF / quote, rf = USD / base). */
export interface Market {
  /** Spot, quote currency per 1 unit base (USD/CHF). */
  spot: number;
  /** Quote-currency (domestic, CHF) rate, continuous p.a. */
  rd: number;
  /** Base-currency (foreign, USD) rate, continuous p.a. */
  rf: number;
  /** Volatility p.a. (decimal). */
  vol: number;
}

/** Fixing frequency of a fixing schedule. */
export type Frequency = 'weekly' | 'monthly';

/**
 * What happens on the fixing where a TARF / Pivot TARF reaches its target:
 * - 'capped': the client trades N at an adjusted rate so that the counted gain equals the
 *   remaining target exactly (cumulative gain = target), then the product ends. §8.7 default.
 * - 'full': the full trade at the strike is done (gain may exceed the target), then it ends.
 * - 'none': no trade on that fixing ("no payout" variant), the product ends.
 */
export type LastFixingRule = 'capped' | 'full' | 'none';

// ---------------------------------------------------------------------------------------------
// MC_CONFIG: change parameters here, nowhere else.
// ---------------------------------------------------------------------------------------------

/**
 * All engine and product settings in one object. Values marked "choice" are modelling choices
 * Dario may want to change; the comment says what the alternative would be.
 */
export const MC_CONFIG = {
  /** Running example market (src/lib/fx/example.ts). "Beispielwerte, keine Marktdaten". */
  market: { spot: EXAMPLE.spot, rd: EXAMPLE.rd, rf: EXAMPLE.rf, vol: EXAMPLE.vol },

  conventions: {
    /** Option-model year: T = days / 365 everywhere (§6). */
    daysPerYear: 365,
    /** Simulation step: one calendar day, Δt = 1/365 (§7). */
    dt: 1 / 365,
    /** Weekly fixings: every 7 calendar days (day 7, 14, …). Choice: business days ignored. */
    weeklyStepDays: 7,
    /** Monthly fixings: day_i = round(i · 365 / 12) → 30, 61, 91, …, 365. Choice. */
    monthsPerYear: 12,
    /**
     * Discounting: DF(t) = e^(−rd · t), t = day / 365; every cash flow settles on its fixing
     * day (choice: no spot lag of two business days).
     */
    settlementLagDays: 0,
  },

  engine: {
    /** One seed for every run (CRN across products); any safe integer works. */
    seed: 20_261_022,
    /** Antithetic pairs (Z, −Z); paths are rounded up to an even number. */
    antithetic: true,
    /** Paths for interactive valuations in the Web Worker (fast, SE a few pips). */
    interactivePaths: 20_000,
    /**
     * Paths for scripts/precompute-mc.ts: 4’000’000 (2’000’000 antithetic pairs) gives standard
     * errors of 0.1–0.35 pips on the strikes and about 0.5 (TPF) / 0.8 (RTPF) pips on the
     * coupons in about 2 minutes; the weekly set holds 26 fixings × 4 Mio. doubles ≈ 830 MB.
     * Up to Version 6, 1’000’000 paths ran in 25 s with 0.2–0.5 pips on the strikes but
     * 0.97 / 1.61 pips on the coupons, and that run sat 2.5 / 2.3 standard errors above the
     * exact coupons (found in Review 3; 4’000’000 since Version 7, D-66).
     */
    precomputePaths: 4_000_000,
    /**
     * Broadie-Glasserman-Kou constant β = −ζ(½)/√(2π) ≈ 0.5826: a barrier monitored every
     * Δt behaves like a continuous barrier shifted away from the spot by e^(±β σ √Δt).
     */
    bgkBeta: 0.5826,
  },

  solver: {
    /** Absolute tolerance on the solved parameter (strike, coupon or width in CHF per USD). */
    tolerance: 1e-9,
    maxIterations: 100,
    /** Bracket widenings (each doubles the width) if the start bracket has no sign change. */
    maxBracketExpansions: 8,
    /** Central finite-difference bump for ∂PV/∂x in the delta-method standard error. */
    bump: { strike: 5e-4, coupon: 1e-4, width: 5e-4 },
    /** Start brackets, relative to spot (strike) or absolute in CHF per USD (coupon, width). */
    bracket: {
      strike: [0.85, 1.15],
      coupon: [0, 0.05],
      width: [0, 0.1],
    },
  },

  /** Product parameters (§8.7 table). Factors are relative to spot. */
  products: {
    accumulator: {
      frequency: 'weekly',
      fixings: 26,
      notional: 40_000,
      leverage: 2,
      /** Knock-out barrier B = spot · 1.03; knocked out when S_i ≥ B. */
      barrierFactor: 1.03,
      /** Choice: no trade on the knock-out fixing (alternative: still buy N at K). */
      tradeOnKnockOutFixing: false,
    },
    decumulator: {
      frequency: 'weekly',
      fixings: 26,
      notional: 40_000,
      leverage: 2,
      /** Knock-out barrier B = spot · 0.97; knocked out when S_i ≤ B. */
      barrierFactor: 0.97,
      tradeOnKnockOutFixing: false,
    },
    tarf: {
      frequency: 'monthly',
      fixings: 12,
      notional: 100_000,
      leverage: 2,
      /** Target in pips per 1 USD (500 pips = 0.0500). */
      targetPips: 500,
      lastFixing: 'capped' as LastFixingRule,
    },
    pivotTarf: {
      /** Choice: fixings and notional as the TARF (§8.7 only says "wie TARF"). */
      frequency: 'monthly',
      fixings: 12,
      notional: 100_000,
      leverage: 2,
      /** Pivot P = spot · 1; K1 = P − d, K2 = P + d with d solved. */
      pivotFactor: 1,
      targetPips: 300,
      lastFixing: 'capped' as LastFixingRule,
    },
    tpf: {
      frequency: 'monthly',
      fixings: 12,
      /** Choice: N = USD 100’000 (not fixed in §8.7). Coupon c is in CHF per 1 USD. */
      notional: 100_000,
      leverage: 2,
      /** Strike K = spot · (1 − 2.5 %). */
      strikeFactor: 0.975,
      targetCoupons: 6,
    },
    rtpf: {
      frequency: 'monthly',
      fixings: 12,
      notional: 100_000,
      leverage: 2,
      /** Range L = spot · (1 − 3.5 %), U = spot · (1 + 3.5 %). */
      lowerFactor: 0.965,
      upperFactor: 1.035,
      targetCoupons: 6,
    },
    windowBarrier: {
      /** Up-and-out USD call, strike ATMF of the running example (0.7930). */
      type: 'call' as OptionType,
      strike: EXAMPLE_STRIKE,
      /** Barrier H = spot · 1.03, active only in the window (days 1 … 30, inclusive). */
      barrierFactor: 1.03,
      windowStartDay: 1,
      windowEndDay: 30,
      /** Choice: 91 days ≈ 3 months (integer days for daily steps; T = 91/365). */
      expiryDay: 91,
      notional: EXAMPLE.notional,
    },
    doubleNoTouch: {
      /** Pays CHF 100’000 at expiry if every daily fixing stays strictly inside (L, U). */
      payout: 100_000,
      lowerFactor: 0.96,
      upperFactor: 1.04,
      expiryDay: 91,
    },
    dualCurrency: {
      /** CHF 100’000 invested for 30 days (1 month). */
      capital: 100_000,
      days: 30,
      /** Strike K = spot · (1 − 1 %) of the sold USD put / CHF call. */
      strikeFactor: 0.99,
      /** Interest annualisation: CHF money market ACT/360 (choice; 365 = ACT/365). */
      interestBasis: 360 as 360 | 365,
      /**
       * Choice: on conversion only the capital is converted at K, the interest is paid in
       * CHF (§8.7 "Kapital wird zu K in USD umgewandelt, plus Zins"). true = convert both.
       */
      convertInterest: false,
    },
  },

  /**
   * Deterministic scenario paths for the path simulator (§8.4). `move` is the total change over
   * the horizon (whatever the product's length, so every product tells the same story), `vol`
   * the noise p.a. The noise is a Brownian bridge (zero at both ends), so the end point is
   * exact: S_end = spot · (1 + move) · (1 + gap).
   */
  scenarios: {
    trendUp: { move: 0.08, vol: 0.04, seed: 101 },
    trendDown: { move: -0.08, vol: 0.04, seed: 102 },
    /** Lower noise: stays inside ±3 % (below the accumulator barrier) over 6 and 12 months. */
    sideways: { move: 0, vol: 0.025, seed: 103 },
    /** A one-day gap of −6 % (CHF strengthens) after 40 % of the horizon. */
    shock: { move: 0, vol: 0.04, gap: -0.06, gapAt: 0.4, seed: 104 },
    /** Risk-neutral GBM with the market vol (as in the valuation). */
    random: { seed: 105 },
  },
} as const;

/** Product parameters of §8.7 (part of MC_CONFIG). */
export const PRODUCT_DEFAULTS = MC_CONFIG.products;

/** The running example market as a {@link Market}. */
export const DEFAULT_MARKET: Market = { ...MC_CONFIG.market };

// ---------------------------------------------------------------------------------------------
// Product types
// ---------------------------------------------------------------------------------------------

interface ProductBase {
  /**
   * Observation days in calendar days from today, ascending, ≥ 1: the fixing dates, or the
   * daily monitoring dates of a barrier product. The last one is the final day.
   */
  fixingDays: readonly number[];
}

/** Accumulator (client buys USD). Per fixing: K ≤ S_i < B buys N at K; S_i < K buys 2N. */
export interface AccumulatorProduct extends ProductBase {
  kind: 'accumulator';
  notional: number;
  leverage: number;
  strike: number;
  /** Knock-out when S_i ≥ barrier. */
  barrier: number;
  tradeOnKnockOutFixing: boolean;
}

/** Decumulator (client sells USD). Per fixing: B < S_i ≤ K sells N at K; S_i > K sells 2N. */
export interface DecumulatorProduct extends ProductBase {
  kind: 'decumulator';
  notional: number;
  leverage: number;
  strike: number;
  /** Knock-out when S_i ≤ barrier. */
  barrier: number;
  tradeOnKnockOutFixing: boolean;
}

/** TARF (client buys USD): S_i ≥ K buys N, gain counts to the target; S_i < K buys 2N. */
export interface TarfProduct extends ProductBase {
  kind: 'tarf';
  notional: number;
  leverage: number;
  strike: number;
  /** Target in CHF per 1 USD (500 pips = 0.05). */
  target: number;
  lastFixing: LastFixingRule;
}

/** Pivot TARF: buys at K1 below the pivot, sells at K2 above it; gains count to the target. */
export interface PivotTarfProduct extends ProductBase {
  kind: 'pivotTarf';
  notional: number;
  leverage: number;
  pivot: number;
  /** K1 = P − d. */
  lowerStrike: number;
  /** K2 = P + d. */
  upperStrike: number;
  target: number;
  lastFixing: LastFixingRule;
}

/** TPF: S_i ≥ K receives c·N; S_i < K pays 2·(K − S_i)·N; ends after targetCoupons coupons. */
export interface TpfProduct extends ProductBase {
  kind: 'tpf';
  notional: number;
  leverage: number;
  strike: number;
  /** Coupon in CHF per 1 USD of notional (0.0010 = 10 pips). */
  coupon: number;
  targetCoupons: number;
}

/** RTPF: L ≤ S_i ≤ U receives c·N; outside pays 2 × the distance to the range × N. */
export interface RtpfProduct extends ProductBase {
  kind: 'rtpf';
  notional: number;
  leverage: number;
  lower: number;
  upper: number;
  coupon: number;
  targetCoupons: number;
}

/**
 * Window barrier option: a knock-out call or put whose barrier is only monitored on the days
 * windowStartDay … windowEndDay (inclusive, daily). Exercise at expiryDay (physical: the call
 * buys N USD at K).
 */
export interface WindowBarrierProduct extends ProductBase {
  kind: 'windowBarrier';
  type: OptionType;
  /** 'up': knocked out when S ≥ barrier; 'down': when S ≤ barrier. */
  direction: 'up' | 'down';
  notional: number;
  strike: number;
  barrier: number;
  windowStartDay: number;
  windowEndDay: number;
  expiryDay: number;
}

/** Double no-touch: pays `payout` CHF at expiry if every daily fixing stays inside (L, U). */
export interface DoubleNoTouchProduct extends ProductBase {
  kind: 'doubleNoTouch';
  payout: number;
  lower: number;
  upper: number;
  expiryDay: number;
}

export type Product =
  | AccumulatorProduct
  | DecumulatorProduct
  | TarfProduct
  | PivotTarfProduct
  | TpfProduct
  | RtpfProduct
  | WindowBarrierProduct
  | DoubleNoTouchProduct;

export type ProductKind = Product['kind'];
export type ProductOf<K extends ProductKind> = Extract<Product, { kind: K }>;
/** Overrides of a product's fields (distributive: for a union of kinds, a union of partials). */
export type ProductOverrides<K extends ProductKind> = K extends ProductKind
  ? Partial<Omit<ProductOf<K>, 'kind'>>
  : never;

/** All Monte Carlo product kinds, in the order of module 08. */
export const PRODUCT_KINDS: readonly ProductKind[] = [
  'accumulator',
  'decumulator',
  'tarf',
  'pivotTarf',
  'tpf',
  'rtpf',
  'windowBarrier',
  'doubleNoTouch',
];

/** The zero-cost products of §8.7 and the parameter solved for PV = 0. */
export const SOLVED_PARAM = {
  accumulator: 'strike',
  decumulator: 'strike',
  tarf: 'strike',
  pivotTarf: 'width',
  tpf: 'coupon',
  rtpf: 'coupon',
} as const;

export type ZeroCostKind = keyof typeof SOLVED_PARAM;
export type SolveParam = (typeof SOLVED_PARAM)[ZeroCostKind];

// ---------------------------------------------------------------------------------------------
// Schedules and builders
// ---------------------------------------------------------------------------------------------

/**
 * Fixing days for `count` fixings: weekly = 7, 14, …; monthly = round(i · 365 / 12).
 * Calendar days, no business-day adjustment.
 */
export function fixingSchedule(frequency: Frequency, count: number): number[] {
  if (!Number.isInteger(count) || count < 1) {
    throw new RangeError(`fixingSchedule: count must be a positive integer, got ${count}`);
  }
  const c = MC_CONFIG.conventions;
  const days: number[] = [];
  for (let i = 1; i <= count; i++) {
    days.push(
      frequency === 'weekly'
        ? i * c.weeklyStepDays
        : Math.round((i * c.daysPerYear) / c.monthsPerYear),
    );
  }
  return days;
}

/** Days from `from` to `to` inclusive (daily monitoring). */
export function dailyDays(from: number, to: number): number[] {
  const days: number[] = [];
  for (let d = Math.max(1, from); d <= to; d++) days.push(d);
  return days;
}

/** Forward to a calendar day: S · e^((rd − rf) · day / 365). */
export function forwardAt(market: Market, day: number): number {
  return (
    market.spot * Math.exp(((market.rd - market.rf) * day) / MC_CONFIG.conventions.daysPerYear)
  );
}

/** Average of the fixing days of a product (the "average fixing date"). */
export function averageFixingDay(product: Product): number {
  const d = product.fixingDays;
  return d.reduce((s, x) => s + x, 0) / d.length;
}

/** Forward to the average fixing day, the benchmark for a "better rate than the forward". */
export function forwardAtAverageFixing(product: Product, market: Market = DEFAULT_MARKET): number {
  return forwardAt(market, averageFixingDay(product));
}

/** Pip size of USD/CHF (0.0001). */
export const PIP = 1e-4;

/**
 * Level derived from spot · factor, rounded to 8 decimals to drop binary noise
 * (0.8 · 1.03 = 0.8240000000000001 → 0.824). 8 decimals = 0.0001 pip, far below any effect.
 */
export function level(x: number): number {
  return Number(x.toFixed(8));
}

/**
 * Builds a product with the defaults of {@link PRODUCT_DEFAULTS} for a market, then applies
 * `overrides` (absolute values, e.g. { strike: 0.7712 }).
 *
 * The solved parameter (strike, coupon or pivot width) gets a neutral START value only:
 * strikes = forward to the average fixing day, coupon = 0, width = 0. Use the fair value from
 * src/data/fx/mc-products.json (fairProduct in index.ts) or solve it (value.ts).
 */
export function buildProduct<K extends ProductKind>(
  kind: K,
  market: Market = DEFAULT_MARKET,
  overrides: ProductOverrides<K> = {} as ProductOverrides<K>,
): ProductOf<K> {
  const S = market.spot;
  const P = PRODUCT_DEFAULTS;
  const k: ProductKind = kind;
  let base: Product;
  switch (k) {
    case 'accumulator':
    case 'decumulator': {
      const d = P[k];
      const fixingDays = fixingSchedule(d.frequency, d.fixings);
      base = {
        kind: k,
        fixingDays,
        notional: d.notional,
        leverage: d.leverage,
        strike: level(forwardAt(market, mean(fixingDays))),
        barrier: level(S * d.barrierFactor),
        tradeOnKnockOutFixing: d.tradeOnKnockOutFixing,
      };
      break;
    }
    case 'tarf': {
      const d = P.tarf;
      const fixingDays = fixingSchedule(d.frequency, d.fixings);
      base = {
        kind: k,
        fixingDays,
        notional: d.notional,
        leverage: d.leverage,
        strike: level(forwardAt(market, mean(fixingDays))),
        target: level(d.targetPips * PIP),
        lastFixing: d.lastFixing,
      };
      break;
    }
    case 'pivotTarf': {
      const d = P.pivotTarf;
      const pivot = level(S * d.pivotFactor);
      base = {
        kind: k,
        fixingDays: fixingSchedule(d.frequency, d.fixings),
        notional: d.notional,
        leverage: d.leverage,
        pivot,
        lowerStrike: pivot,
        upperStrike: pivot,
        target: level(d.targetPips * PIP),
        lastFixing: d.lastFixing,
      };
      break;
    }
    case 'tpf': {
      const d = P.tpf;
      base = {
        kind: k,
        fixingDays: fixingSchedule(d.frequency, d.fixings),
        notional: d.notional,
        leverage: d.leverage,
        strike: level(S * d.strikeFactor),
        coupon: 0,
        targetCoupons: d.targetCoupons,
      };
      break;
    }
    case 'rtpf': {
      const d = P.rtpf;
      base = {
        kind: k,
        fixingDays: fixingSchedule(d.frequency, d.fixings),
        notional: d.notional,
        leverage: d.leverage,
        lower: level(S * d.lowerFactor),
        upper: level(S * d.upperFactor),
        coupon: 0,
        targetCoupons: d.targetCoupons,
      };
      break;
    }
    case 'windowBarrier': {
      const d = P.windowBarrier;
      base = {
        kind: k,
        fixingDays: windowObservationDays(d.windowStartDay, d.windowEndDay, d.expiryDay),
        type: d.type,
        direction: d.barrierFactor >= 1 ? 'up' : 'down',
        notional: d.notional,
        strike: d.strike,
        barrier: level(S * d.barrierFactor),
        windowStartDay: d.windowStartDay,
        windowEndDay: d.windowEndDay,
        expiryDay: d.expiryDay,
      };
      break;
    }
    case 'doubleNoTouch': {
      const d = P.doubleNoTouch;
      base = {
        kind: k,
        fixingDays: dailyDays(1, d.expiryDay),
        payout: d.payout,
        lower: level(S * d.lowerFactor),
        upper: level(S * d.upperFactor),
        expiryDay: d.expiryDay,
      };
      break;
    }
    default:
      throw new RangeError(`buildProduct: unknown product kind ${String(kind)}`);
  }
  let product = { ...base, ...(overrides as object) } as Product;
  // An overridden window barrier level decides its direction (up if at or above spot), unless
  // the direction itself is overridden: a level below spot must not stay an 'up' barrier,
  // which would knock out every path on the first window day.
  if (product.kind === 'windowBarrier' && 'barrier' in overrides && !('direction' in overrides)) {
    product = { ...product, direction: product.barrier >= S ? 'up' : 'down' };
  }
  return withConsistentDays(product, overrides as object) as ProductOf<K>;
}

/** Observation days of a window barrier: the window days plus the expiry day. */
export function windowObservationDays(start: number, end: number, expiry: number): number[] {
  const days = dailyDays(start, Math.min(end, expiry));
  if (days[days.length - 1] !== expiry) days.push(expiry);
  return days;
}

/** Recomputes the observation days if window or expiry were overridden but the days were not. */
function withConsistentDays(p: Product, overrides: object): Product {
  if ('fixingDays' in overrides) return p;
  if (p.kind === 'windowBarrier') {
    return {
      ...p,
      fixingDays: windowObservationDays(p.windowStartDay, p.windowEndDay, p.expiryDay),
    };
  }
  if (p.kind === 'doubleNoTouch') return { ...p, fixingDays: dailyDays(1, p.expiryDay) };
  return p;
}

function mean(xs: readonly number[]): number {
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

// ---------------------------------------------------------------------------------------------
// Building blocks for the UI
// ---------------------------------------------------------------------------------------------

/** Key of a building block; the UI looks up its label in the dictionary. */
export type BlockKey =
  | 'longCall'
  | 'shortCall'
  | 'longPut'
  | 'shortPut'
  | 'longDigitalCall'
  | 'longRangeDigital'
  | 'knockOutUp'
  | 'knockOutDown'
  | 'windowKnockOutUp'
  | 'targetKnockOut'
  | 'couponTargetKnockOut'
  | 'deposit'
  | 'cashAtExpiry'
  | 'shortDoubleOneTouch';

/** One building block: `ratio` × N of an instrument at the level(s) named by product fields. */
export interface BuildingBlock {
  key: BlockKey;
  /** Multiple of the notional per fixing (0 for pure features such as a knock-out). */
  ratio: number;
  /** Product field(s) holding the strike or barrier level, e.g. ['strike']. */
  levels: readonly string[];
  /** True if the block repeats at every fixing (a series of options). */
  perFixing: boolean;
}

/**
 * Decomposition of every product into building blocks (client view). Per fixing, payoff in CHF:
 * - Accumulator: long call K (N) + short put K (2N), all knocked out when S_i ≥ B.
 * - Decumulator: long put K (N) + short call K (2N), knocked out when S_i ≤ B.
 * - TARF: long call K (N) + short put K (2N), ends at the target (cumulative gain).
 * - Pivot TARF: long call K1 (N) − 2 calls P − call K2 (N) − 2 puts K1; the first three form the
 *   tent between K1 and K2 (peak d at P), the short puts K1 and the net short call K2 are the
 *   leveraged losses outside; ends at the target.
 * - TPF: long digital call K paying c (N) + short put K (2N); ends after n coupons.
 * - RTPF: long range digital [L, U] paying c + short put L (2N) + short call U (2N).
 * - Dual Currency: CHF deposit + short USD put / CHF call K on capital / K USD.
 * - Window barrier: long call K with an up-and-out barrier H active only in the window.
 * - Double no-touch: cash at expiry − double one-touch (paid at expiry) on L and U.
 */
export const BUILDING_BLOCKS: Readonly<
  Record<ProductKind | 'dualCurrency', readonly BuildingBlock[]>
> = {
  accumulator: [
    { key: 'longCall', ratio: 1, levels: ['strike'], perFixing: true },
    { key: 'shortPut', ratio: 2, levels: ['strike'], perFixing: true },
    { key: 'knockOutUp', ratio: 0, levels: ['barrier'], perFixing: true },
  ],
  decumulator: [
    { key: 'longPut', ratio: 1, levels: ['strike'], perFixing: true },
    { key: 'shortCall', ratio: 2, levels: ['strike'], perFixing: true },
    { key: 'knockOutDown', ratio: 0, levels: ['barrier'], perFixing: true },
  ],
  tarf: [
    { key: 'longCall', ratio: 1, levels: ['strike'], perFixing: true },
    { key: 'shortPut', ratio: 2, levels: ['strike'], perFixing: true },
    { key: 'targetKnockOut', ratio: 0, levels: ['target'], perFixing: false },
  ],
  pivotTarf: [
    { key: 'longCall', ratio: 1, levels: ['lowerStrike'], perFixing: true },
    { key: 'shortCall', ratio: 2, levels: ['pivot'], perFixing: true },
    { key: 'shortCall', ratio: 1, levels: ['upperStrike'], perFixing: true },
    { key: 'shortPut', ratio: 2, levels: ['lowerStrike'], perFixing: true },
    { key: 'targetKnockOut', ratio: 0, levels: ['target'], perFixing: false },
  ],
  tpf: [
    { key: 'longDigitalCall', ratio: 1, levels: ['strike'], perFixing: true },
    { key: 'shortPut', ratio: 2, levels: ['strike'], perFixing: true },
    { key: 'couponTargetKnockOut', ratio: 0, levels: ['targetCoupons'], perFixing: false },
  ],
  rtpf: [
    { key: 'longRangeDigital', ratio: 1, levels: ['lower', 'upper'], perFixing: true },
    { key: 'shortPut', ratio: 2, levels: ['lower'], perFixing: true },
    { key: 'shortCall', ratio: 2, levels: ['upper'], perFixing: true },
    { key: 'couponTargetKnockOut', ratio: 0, levels: ['targetCoupons'], perFixing: false },
  ],
  windowBarrier: [
    { key: 'longCall', ratio: 1, levels: ['strike'], perFixing: false },
    { key: 'windowKnockOutUp', ratio: 0, levels: ['barrier'], perFixing: false },
  ],
  doubleNoTouch: [
    { key: 'cashAtExpiry', ratio: 1, levels: [], perFixing: false },
    { key: 'shortDoubleOneTouch', ratio: 1, levels: ['lower', 'upper'], perFixing: false },
  ],
  dualCurrency: [
    { key: 'deposit', ratio: 1, levels: [], perFixing: false },
    { key: 'shortPut', ratio: 1, levels: ['strike'], perFixing: false },
  ],
};
