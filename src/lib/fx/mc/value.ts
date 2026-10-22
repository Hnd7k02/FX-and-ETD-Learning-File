/**
 * Monte Carlo valuation and zero-cost solvers. Pure, no DOM.
 *
 * PV = E[Σ_i DF(t_i) · pnl_i] in CHF, DF(t) = e^(−rd · t), estimated over GBM paths with daily
 * steps (gbm.ts) and the product kernels (payoffs.ts). With antithetic pairs the standard error
 * is computed from the pair averages (the two paths of a pair are not independent).
 *
 * Solvers (strike, coupon, pivot width) use common random numbers: the observations of all
 * paths are simulated once (same seed) and every trial value of the parameter is priced on the
 * same paths, so the estimated PV is a smooth (mostly piecewise linear) function of the
 * parameter and Brent's method finds its root reliably. The standard error of the solution is
 * the delta method: SE(x*) = SE(PV(x*)) / |∂PV/∂x|, with ∂PV/∂x by a central difference on
 * the same paths.
 */
import { GbmPathSource } from './gbm';
import {
  discountFactors,
  runKernel,
  type CashflowSink,
  type CashflowKind,
  type EndReason,
} from './payoffs';
import { DEFAULT_MARKET, MC_CONFIG, type Market, type Product, type SolveParam } from './products';

/** Monte Carlo options; defaults from MC_CONFIG.engine (interactive path count). */
export interface McOptions {
  paths?: number;
  seed?: number;
  antithetic?: boolean;
}

interface ResolvedOptions {
  paths: number;
  seed: number;
  antithetic: boolean;
}

function resolve(o: McOptions): ResolvedOptions {
  return {
    paths: o.paths ?? MC_CONFIG.engine.interactivePaths,
    seed: o.seed ?? MC_CONFIG.engine.seed,
    antithetic: o.antithetic ?? MC_CONFIG.engine.antithetic,
  };
}

/** Distribution facts of a valuation (for the risk box and the "when does it go wrong" text). */
export interface PriceStats {
  /** Share of paths ending by maturity, knock-out or target. */
  endProbability: Record<EndReason, number>;
  /** Expected number of fixings until the product ends. */
  expectedFixings: number;
  /** Expected traded USD amount (signed, undiscounted; + bought, − sold). */
  expectedBase: number;
  /** 5 % quantile of the path PV (CHF): the bad tail. */
  pvQuantile05: number;
  /** Worst and best path PV (CHF). */
  pvMin: number;
  pvMax: number;
}

/** Result of {@link price}. */
export interface PriceResult {
  /** Present value in CHF (client view). */
  pv: number;
  /** Standard error of pv (CHF). */
  stdErr: number;
  /** Paths used (even with antithetic pairs). */
  paths: number;
  seed: number;
  antithetic: boolean;
  stats: PriceStats;
}

// ---------------------------------------------------------------------------------------------
// Path evaluation
// ---------------------------------------------------------------------------------------------

/** Sink that adds DF · pnl and the traded USD amount; remembers how the path ended. */
class PvSink implements CashflowSink {
  pv = 0;
  base = 0;
  endIndex = -1;
  reason: EndReason = 'maturity';

  constructor(private readonly dfs: Float64Array) {}

  reset(): void {
    this.pv = 0;
    this.base = 0;
  }

  flow(i: number, _kind: CashflowKind, amountBase: number, _q: number, pnl: number): void {
    this.pv += this.dfs[i]! * pnl;
    this.base += amountBase;
  }

  end(i: number, reason: EndReason): void {
    this.endIndex = i;
    this.reason = reason;
  }
}

/**
 * Evaluates paths one by one (rows of observations) and accumulates mean, standard error and
 * the statistics. Shared by the streaming pricer and the solvers, so both give identical
 * numbers for identical paths.
 */
class PathEvaluator {
  private readonly sink: PvSink;
  private readonly perPath: Float64Array;
  private count = 0;
  private units = 0;
  private mean = 0;
  private m2 = 0;
  private pending = 0;
  private fixingsSum = 0;
  private baseSum = 0;
  private readonly ends: Record<EndReason, number> = { maturity: 0, knockout: 0, target: 0 };

  constructor(
    private readonly product: Product,
    dfs: Float64Array,
    private readonly antithetic: boolean,
    totalPaths: number,
  ) {
    this.sink = new PvSink(dfs);
    this.perPath = new Float64Array(totalPaths);
  }

  /** Adds the path whose observations are obs[off … off + n − 1]. */
  add(obs: ArrayLike<number>, off: number): void {
    const s = this.sink;
    s.reset();
    runKernel(this.product, obs, off, s);
    const pv = s.pv;
    this.perPath[this.count] = pv;
    this.fixingsSum += s.endIndex + 1;
    this.baseSum += s.base;
    this.ends[s.reason]++;
    if (this.antithetic && this.count % 2 === 0) {
      this.pending = pv;
    } else {
      this.addUnit(this.antithetic ? 0.5 * (this.pending + pv) : pv);
    }
    this.count++;
  }

  private addUnit(x: number): void {
    // Welford's running mean and variance.
    this.units++;
    const d = x - this.mean;
    this.mean += d / this.units;
    this.m2 += d * (x - this.mean);
  }

  /** PV and standard error only (no sorting): used inside the solver loop. */
  pvAndError(): { pv: number; stdErr: number } {
    const n = this.units;
    const stdErr = n > 1 ? Math.sqrt(this.m2 / (n - 1) / n) : 0;
    return { pv: this.mean, stdErr };
  }

  result(seed: number): PriceResult {
    const n = this.count;
    const sorted = this.perPath.subarray(0, n).slice().sort();
    const { pv, stdErr } = this.pvAndError();
    return {
      pv,
      stdErr,
      paths: n,
      seed,
      antithetic: this.antithetic,
      stats: {
        endProbability: {
          maturity: this.ends.maturity / n,
          knockout: this.ends.knockout / n,
          target: this.ends.target / n,
        },
        expectedFixings: this.fixingsSum / n,
        expectedBase: this.baseSum / n,
        pvQuantile05: sorted[Math.floor(0.05 * (n - 1))]!,
        pvMin: sorted[0]!,
        pvMax: sorted[n - 1]!,
      },
    };
  }
}

/**
 * Values a product by Monte Carlo (streaming: memory O(days), not O(paths · days)).
 * Defaults: MC_CONFIG.engine (interactive path count, seed, antithetic).
 */
export function price(
  product: Product,
  market: Market = DEFAULT_MARKET,
  opts: McOptions = {},
): PriceResult {
  const o = resolve(opts);
  const days = product.fixingDays;
  const n = days.length;
  const src = new GbmPathSource(market, { ...o, days: days[n - 1]! });
  const ev = new PathEvaluator(
    product,
    discountFactors(days, market.rd),
    src.info.antithetic,
    src.info.paths,
  );
  const obs = new Float64Array(n);
  for (let path = src.next(); path !== undefined; path = src.next()) {
    for (let i = 0; i < n; i++) obs[i] = path[days[i]!]!;
    ev.add(obs, 0);
  }
  return ev.result(o.seed);
}

/** Spots of every simulated path on a set of observation days (row-major, path by path). */
export interface ObservationSet {
  days: readonly number[];
  paths: number;
  seed: number;
  antithetic: boolean;
  /** data[k · days.length + i] = spot of path k on days[i]. */
  data: Float64Array;
}

/**
 * Simulates daily GBM paths and keeps only the spots on `days` (memory paths · days.length).
 * Use it to price several variants of a product on the same paths (common random numbers).
 */
export function simulateObservations(
  market: Market,
  days: readonly number[],
  opts: McOptions = {},
): ObservationSet {
  const o = resolve(opts);
  const n = days.length;
  const src = new GbmPathSource(market, { ...o, days: days[n - 1]! });
  const data = new Float64Array(src.info.paths * n);
  let off = 0;
  for (let path = src.next(); path !== undefined; path = src.next()) {
    for (let i = 0; i < n; i++) data[off + i] = path[days[i]!]!;
    off += n;
  }
  return {
    days: [...days],
    paths: src.info.paths,
    seed: o.seed,
    antithetic: src.info.antithetic,
    data,
  };
}

function checkDays(product: Product, set: ObservationSet): void {
  const a = product.fixingDays;
  const b = set.days;
  if (a.length !== b.length || a.some((d, i) => d !== b[i])) {
    throw new RangeError('priceOnObservations: the product fixing days differ from the set');
  }
}

/** Values a product on pre-simulated observations (identical to price() for the same paths). */
export function priceOnObservations(
  product: Product,
  set: ObservationSet,
  market: Pick<Market, 'rd'> = DEFAULT_MARKET,
): PriceResult {
  return evaluateSet(product, set, market).result(set.seed);
}

function evaluateSet(
  product: Product,
  set: ObservationSet,
  market: Pick<Market, 'rd'>,
): PathEvaluator {
  checkDays(product, set);
  const n = set.days.length;
  const ev = new PathEvaluator(
    product,
    discountFactors(set.days, market.rd),
    set.antithetic,
    set.paths,
  );
  for (let k = 0, off = 0; k < set.paths; k++, off += n) ev.add(set.data, off);
  return ev;
}

/**
 * Generic Monte Carlo expectation of fn(path) over daily GBM paths, with antithetic pair
 * averaging for the standard error. For checks against closed forms (European, digital,
 * barrier payoffs) and for one-off questions in the UI. fn receives the reused path buffer.
 */
export function expectation(
  market: Market,
  days: number,
  fn: (path: Float64Array) => number,
  opts: McOptions = {},
): { mean: number; stdErr: number; paths: number } {
  const o = resolve(opts);
  const src = new GbmPathSource(market, { ...o, days });
  let units = 0;
  let mean = 0;
  let m2 = 0;
  let pending = 0;
  for (let path = src.next(); path !== undefined; path = src.next()) {
    const x = fn(path);
    const k = src.nextIndex - 1;
    if (src.info.antithetic && k % 2 === 0) {
      pending = x;
      continue;
    }
    const u = src.info.antithetic ? 0.5 * (pending + x) : x;
    units++;
    const d = u - mean;
    mean += d / units;
    m2 += d * (u - mean);
  }
  return {
    mean,
    stdErr: units > 1 ? Math.sqrt(m2 / (units - 1) / units) : 0,
    paths: src.info.paths,
  };
}

// ---------------------------------------------------------------------------------------------
// Solvers
// ---------------------------------------------------------------------------------------------

/**
 * Copy of the product with the solved parameter set to x: 'strike' (accumulator, decumulator,
 * TARF, window barrier, TPF), 'coupon' (TPF, RTPF), 'width' (Pivot TARF: K1 = P − x,
 * K2 = P + x).
 */
export function withParam<P extends Product>(product: P, param: SolveParam, x: number): P {
  switch (param) {
    case 'strike':
      if (!('strike' in product)) break;
      return { ...product, strike: x };
    case 'coupon':
      if (!('coupon' in product)) break;
      return { ...product, coupon: x };
    case 'width':
      if (product.kind !== 'pivotTarf') break;
      return { ...product, lowerStrike: product.pivot - x, upperStrike: product.pivot + x };
  }
  throw new RangeError(`withParam: ${product.kind} has no parameter '${param}'`);
}

/** Options of the solvers. */
export interface SolveOptions extends McOptions {
  /** Start bracket [lo, hi] for the parameter; default MC_CONFIG.solver.bracket. */
  bracket?: readonly [number, number];
  /** Absolute tolerance on the parameter; default MC_CONFIG.solver.tolerance. */
  tolerance?: number;
  /** Pre-simulated observations to reuse (must match the product's fixing days). */
  observations?: ObservationSet;
}

/** Result of a solver. */
export interface SolveResult {
  param: SolveParam;
  /** Solved parameter (strike, coupon or width, CHF per USD) with PV ≈ 0. */
  value: number;
  /** Standard error of value (delta method). */
  stdErr: number;
  /** PV (CHF) at value on the same paths (≈ 0) and its standard error. */
  pvAtValue: number;
  pvStdErr: number;
  /** ∂PV/∂x on the same paths (CHF per unit of the parameter). */
  slope: number;
  paths: number;
  seed: number;
  antithetic: boolean;
  /** Brent iterations (plus bracket expansions). */
  iterations: number;
  /** The product with the solved parameter. */
  product: Product;
  /** Valuation at the solution with statistics. */
  priced: PriceResult;
}

/** Default start bracket of a parameter for a market (MC_CONFIG.solver.bracket). */
export function defaultBracket(param: SolveParam, market: Market): [number, number] {
  const b = MC_CONFIG.solver.bracket[param];
  return param === 'strike' ? [b[0] * market.spot, b[1] * market.spot] : [b[0], b[1]];
}

/**
 * Brent's method (Brent 1973, "zeroin"): root of f in [a, b] with f(a) · f(b) ≤ 0.
 * Combines bisection, secant and inverse quadratic interpolation; never leaves the bracket.
 */
export function brent(
  f: (x: number) => number,
  a: number,
  b: number,
  tol: number,
  maxIter: number,
  fa0?: number,
  fb0?: number,
): { root: number; iterations: number } {
  let fa = fa0 ?? f(a);
  let fb = fb0 ?? f(b);
  if (fa === 0) return { root: a, iterations: 0 };
  if (fb === 0) return { root: b, iterations: 0 };
  if (fa * fb > 0) throw new RangeError('brent: f(a) and f(b) have the same sign');
  let c = a;
  let fc = fa;
  let d = b - a;
  let e = d;
  for (let iter = 1; iter <= maxIter; iter++) {
    if (fb * fc > 0) {
      c = a;
      fc = fa;
      d = b - a;
      e = d;
    }
    if (Math.abs(fc) < Math.abs(fb)) {
      a = b;
      b = c;
      c = a;
      fa = fb;
      fb = fc;
      fc = fa;
    }
    const tol1 = 2 * Number.EPSILON * Math.abs(b) + 0.5 * tol;
    const xm = 0.5 * (c - b);
    if (Math.abs(xm) <= tol1 || fb === 0) return { root: b, iterations: iter };
    if (Math.abs(e) >= tol1 && Math.abs(fa) > Math.abs(fb)) {
      const s = fb / fa;
      let p: number;
      let q: number;
      if (a === c) {
        p = 2 * xm * s;
        q = 1 - s;
      } else {
        const qq = fa / fc;
        const r = fb / fc;
        p = s * (2 * xm * qq * (qq - r) - (b - a) * (r - 1));
        q = (qq - 1) * (r - 1) * (s - 1);
      }
      if (p > 0) q = -q;
      p = Math.abs(p);
      if (2 * p < Math.min(3 * xm * q - Math.abs(tol1 * q), Math.abs(e * q))) {
        e = d;
        d = p / q;
      } else {
        d = xm;
        e = d;
      }
    } else {
      d = xm;
      e = d;
    }
    a = b;
    fa = fb;
    b += Math.abs(d) > tol1 ? d : xm > 0 ? tol1 : -tol1;
    fb = f(b);
  }
  return { root: b, iterations: maxIter };
}

/**
 * Solves the parameter `param` of `product` so that its PV is zero (zero-cost structure),
 * with common random numbers and Brent's method. Default paths: MC_CONFIG interactive count.
 */
export function solveParameter(
  product: Product,
  param: SolveParam,
  market: Market = DEFAULT_MARKET,
  opts: SolveOptions = {},
): SolveResult {
  const cfg = MC_CONFIG.solver;
  const set = opts.observations ?? simulateObservations(market, product.fixingDays, opts);
  const pvAt = (x: number) => evaluateSet(withParam(product, param, x), set, market).pvAndError();
  const f = (x: number) => pvAt(x).pv;

  // Bracket with a sign change; widen it if needed (coupon and width stay ≥ 0).
  let [lo, hi] = opts.bracket ?? defaultBracket(param, market);
  let flo = f(lo);
  let fhi = f(hi);
  let expansions = 0;
  while (flo * fhi > 0) {
    if (expansions++ >= cfg.maxBracketExpansions) {
      throw new RangeError(`solveParameter: no sign change of PV for ${product.kind} ${param}`);
    }
    const w = hi - lo;
    const nlo = param === 'strike' ? Math.max(lo - w, 1e-9) : Math.max(lo - w, 0);
    if (nlo !== lo) {
      lo = nlo;
      flo = f(lo);
    }
    hi += w;
    fhi = f(hi);
  }

  const { root, iterations } = brent(
    f,
    lo,
    hi,
    opts.tolerance ?? cfg.tolerance,
    cfg.maxIterations,
    flo,
    fhi,
  );
  const at = pvAt(root);
  const h = cfg.bump[param];
  const lower = param === 'strike' ? root - h : Math.max(root - h, 0);
  const slope = (f(root + h) - f(lower)) / (root + h - lower);
  const solved = withParam(product, param, root);
  return {
    param,
    value: root,
    stdErr: slope !== 0 ? at.stdErr / Math.abs(slope) : Infinity,
    pvAtValue: at.pv,
    pvStdErr: at.stdErr,
    slope,
    paths: set.paths,
    seed: set.seed,
    antithetic: set.antithetic,
    iterations: iterations + expansions,
    product: solved,
    priced: evaluateSet(solved, set, market).result(set.seed),
  };
}

/** Fair (zero-cost) strike of an accumulator, decumulator or TARF. */
export function solveFairStrike(
  product: Product,
  market?: Market,
  opts?: SolveOptions,
): SolveResult {
  return solveParameter(product, 'strike', market, opts);
}

/** Fair (zero-cost) coupon of a TPF or RTPF, in CHF per USD of notional. */
export function solveFairCoupon(
  product: Product,
  market?: Market,
  opts?: SolveOptions,
): SolveResult {
  return solveParameter(product, 'coupon', market, opts);
}

/** Fair (zero-cost) half-width d of a Pivot TARF: K1 = P − d, K2 = P + d. */
export function solvePivotWidth(
  product: Product,
  market?: Market,
  opts?: SolveOptions,
): SolveResult {
  return solveParameter(product, 'width', market, opts);
}
