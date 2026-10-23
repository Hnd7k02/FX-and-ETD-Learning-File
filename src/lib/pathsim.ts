/**
 * Path simulator (MASTER_PROMPT §8.4, modules 07/08): pure logic behind the PathSimulator
 * island. No DOM. Everything the island shows (fixings, cash flows, events, P&L against a
 * forward hedge, the 100-path view) is computed here, from the Monte Carlo product kernels
 * (src/lib/fx/mc/payoffs.ts), the scenario templates (scenarios.ts) and the precomputed fair
 * values (fair.ts / src/data/fx/mc-products.json). So the simulator shows exactly the logic
 * that is priced.
 *
 * P&L convention (client view, CHF): every fixing is valued "against the market", i.e. against
 * buying or selling the same USD at the fixing S_i. For a USD buyer: (S_i − K) · q_i.
 * Benchmark of the hedge products (accumulator, TARF: buy; decumulator: sell) is a plain
 * forward hedge of the PLANNED amount N on every scheduled fixing, each at the forward to its
 * fixing date F_i = S · e^((rd − rf) · day_i / 365) (src/lib/fx/forward.ts). Both are measured
 * against the same market purchase, so "product − forward" is exactly how much cheaper (+) or
 * dearer (−) the product made the USD than the forward hedge. Coupon and range products (pivot
 * TARF, TPF, RTPF) are not hedges; their benchmark is the gross gains / coupons received, so the
 * gap between the two lines is what the leveraged losses took away.
 *
 * Uncertain choices live in PATHSIM_CONFIG (D-22).
 */
import { forwardContinuous } from '@/lib/fx/forward';
import { MC_PRODUCTS, fairProduct } from '@/lib/fx/mc/fair';
import { GbmPathSource } from '@/lib/fx/mc/gbm';
import {
  productPayoff,
  type Cashflow,
  type EndReason,
  type PayoffResult,
} from '@/lib/fx/mc/payoffs';
import {
  DEFAULT_MARKET,
  MC_CONFIG,
  PIP,
  SOLVED_PARAM,
  level,
  type Market,
  type ProductOf,
  type ProductOverrides,
  type SolveParam,
  type ZeroCostKind,
} from '@/lib/fx/mc/products';
import { scenarioPath, shockDay, type ScenarioName } from '@/lib/fx/mc/scenarios';

/** How a product's P&L is compared (see the module comment). */
export type BenchmarkKind = 'forwardBuy' | 'forwardSell' | 'gains';

/** The six zero-cost products of §8.7 that the simulator plays. */
export type SimKind = ZeroCostKind;

/**
 * All settings of the simulator in one place (D-22). Values marked "choice" are modelling or
 * UI choices Dario may want to change.
 */
export const PATHSIM_CONFIG = {
  /** Products offered when the figure does not restrict them, in module order. */
  products: ['accumulator', 'decumulator', 'tarf', 'pivotTarf', 'tpf', 'rtpf'] as const,
  /** Scenario templates in display order (parameters in MC_CONFIG.scenarios). */
  scenarios: ['trendUp', 'trendDown', 'sideways', 'shock', 'random'] as const,
  /** Choice: benchmark per product (forward hedge of the planned amount, or gross gains). */
  benchmark: {
    accumulator: 'forwardBuy',
    decumulator: 'forwardSell',
    tarf: 'forwardBuy',
    pivotTarf: 'gains',
    tpf: 'gains',
    rtpf: 'gains',
  } as Readonly<Record<SimKind, BenchmarkKind>>,
  /** Drag range of the path end of a trend (total move over the horizon). Choice. */
  move: { min: -0.15, max: 0.15, step: 0.005 },
  /** Drag range of the one-day gap of the shock scenario. Choice. */
  gap: { min: -0.12, max: -0.02, step: 0.005 },
  /** Playback: seconds for the whole horizon at speed 1, speeds offered, hold at an event. */
  playSeconds: 12,
  speeds: [0.5, 1, 2] as const,
  eventHoldMs: 1200,
  /** "100 paths" view: number of risk-neutral GBM paths and their seed (choice). */
  ensemble: { paths: 100, seed: 20_261_101 },
  /** Random single path: first seed (MC_CONFIG) and the step of the "new path" button. */
  random: { seed: MC_CONFIG.scenarios.random.seed, step: 1 },
  /**
   * Named start scenarios used by the module texts and figures (prop `preset`), so a number in
   * the text and the figure that shows it come from the same settings. Choice.
   * - strongDown: the strongest down-trend the slider offers (double amounts, over-hedged).
   * - earlyShock: a −10 % gap after 20 days, before a TARF can reach its target.
   */
  presets: {
    strongDown: { name: 'trendDown', move: -0.15 },
    earlyShock: { name: 'shock', gap: -0.1, gapDay: 20 },
  } as const satisfies Record<string, ScenarioSettings>,
  /**
   * Range of the adjustable solved parameter (strike, coupon, pivot half-width). Strikes run
   * from 200 pips on the "better" side of the fair strike to 100 pips beyond the forward.
   * Choice.
   */
  param: {
    strikeBeyondFair: 0.02,
    strikeBeyondForward: 0.01,
    strikeStep: 0.0005,
    coupon: { min: 0, maxFactor: 2, step: 0.0005 },
    width: { min: 0.01, max: 0.08, step: 0.0005 },
  },
  /**
   * Quote step of the fair TPF / RTPF coupon in CHF per USD: 0.1 pip = CHF 1 per fixing on
   * USD 100’000. The simulator and the module texts use the quoted coupon, so "coupon × number
   * of coupons" adds up exactly on screen (CHF 7’754 × 6 = CHF 46’524). The rounding moves the
   * coupon by at most 0.05 pip, far inside its Monte Carlo standard error (about 1 pip). Choice.
   */
  couponQuoteStep: 0.00001,
} as const;

// ---------------------------------------------------------------------------------------------
// Products and the solved parameter
// ---------------------------------------------------------------------------------------------

/** Type guard for the simulator products. */
export function isSimKind(x: unknown): x is SimKind {
  return typeof x === 'string' && (PATHSIM_CONFIG.products as readonly string[]).includes(x);
}

/** Type guard for the scenario names. */
export function isScenario(x: unknown): x is ScenarioName {
  return typeof x === 'string' && (PATHSIM_CONFIG.scenarios as readonly string[]).includes(x);
}

export type PresetName = keyof typeof PATHSIM_CONFIG.presets;

/** Type guard for the named scenario presets. */
export function isPreset(x: unknown): x is PresetName {
  return typeof x === 'string' && Object.prototype.hasOwnProperty.call(PATHSIM_CONFIG.presets, x);
}

/** Last fixing day of a product (the simulated horizon in days). */
export function horizonDays(product: { fixingDays: readonly number[] }): number {
  return product.fixingDays[product.fixingDays.length - 1]!;
}

/** The parameter solved for zero cost: strike, coupon or pivot half-width. */
export function solvedParam(kind: SimKind): SolveParam {
  return SOLVED_PARAM[kind];
}

/** Current value of the solved parameter of a product. */
export function paramOf<K extends SimKind>(product: ProductOf<K>): number {
  const p = product as ProductOf<SimKind>;
  switch (p.kind) {
    case 'pivotTarf':
      return p.pivot - p.lowerStrike;
    case 'tpf':
    case 'rtpf':
      return p.coupon;
    default:
      return p.strike;
  }
}

/** Product overrides that set the solved parameter (same shape the MC worker accepts). */
export function paramOverrides<K extends SimKind>(kind: K, value: number): ProductOverrides<K> {
  const k: SimKind = kind;
  if (k === 'pivotTarf') {
    const pivot = fairProduct('pivotTarf').pivot;
    return {
      lowerStrike: level(pivot - value),
      upperStrike: level(pivot + value),
    } as ProductOverrides<K>;
  }
  if (k === 'tpf' || k === 'rtpf') return { coupon: value } as ProductOverrides<K>;
  return { strike: value } as ProductOverrides<K>;
}

/** A coupon rounded to the quote step (PATHSIM_CONFIG.couponQuoteStep). */
export function quoteCoupon(coupon: number): number {
  const step = PATHSIM_CONFIG.couponQuoteStep;
  return Number((Math.round(coupon / step) * step).toFixed(8));
}

/**
 * The fair product of the running example, optionally with an adjusted solved parameter.
 * Coupon products carry the quoted fair coupon (PATHSIM_CONFIG.couponQuoteStep).
 */
export function simProduct<K extends SimKind>(kind: K, param?: number): ProductOf<K> {
  if (param !== undefined) return fairProduct(kind, paramOverrides(kind, param));
  const k: SimKind = kind;
  if (k === 'tpf' || k === 'rtpf') {
    const coupon = quoteCoupon(fairProduct(k).coupon);
    return fairProduct(kind, { coupon } as ProductOverrides<K>);
  }
  return fairProduct(kind);
}

/**
 * Mean number of fixings of the paths that ended EARLY (knock-out or target), from the mean
 * over all paths: the other paths run all n fixings, so
 * E[all] = p(maturity) · n + p(early) · E[early]. Null when no path ends early.
 */
export function earlyEndFixings(
  expectedFixings: number,
  pMaturity: number,
  pEarly: number,
  n: number,
): number | null {
  return pEarly > 0 ? (expectedFixings - pMaturity * n) / pEarly : null;
}

/** Fair value of the solved parameter from mc-products.json, with its MC facts. */
export interface FairInfo {
  param: SolveParam;
  value: number;
  stdErr: number;
  stdErrPips: number;
  paths: number;
  /** Forward to the average fixing day and that day. */
  forwardAvg: number;
  avgFixingDay: number;
  /** Strike products: fair strike − forwardAvg in pips (− = below the forward). */
  vsForwardPips: number | null;
  /** Coupon products: coupon in pips. */
  couponPips: number | null;
  pTarget: number;
  pKnockOut: number;
  pMaturity: number;
  expectedFixings: number;
  pvQuantile05: number;
  pvMin: number;
}

export function fairInfo(kind: SimKind): FairInfo {
  const s = MC_PRODUCTS.products[kind];
  return {
    param: s.param,
    value: s.value,
    stdErr: s.stdErr,
    stdErrPips: s.stdErrPips,
    paths: s.paths,
    forwardAvg: s.forwardAvg,
    avgFixingDay: s.avgFixingDay,
    vsForwardPips: s.vsForwardPips ?? null,
    couponPips: s.couponPips ?? null,
    pTarget: s.stats.pTarget,
    pKnockOut: s.stats.pKnockOut,
    pMaturity: s.stats.pMaturity,
    expectedFixings: s.stats.expectedFixings,
    pvQuantile05: s.stats.pvQuantile05,
    pvMin: s.stats.pvMin,
  };
}

/** Slider range [min, max, step] of the solved parameter (PATHSIM_CONFIG.param). */
export function paramRange(kind: SimKind): [number, number, number] {
  const c = PATHSIM_CONFIG.param;
  const f = fairInfo(kind);
  const snap = (x: number, step: number) => Number((Math.round(x / step) * step).toFixed(6));
  switch (solvedParam(kind)) {
    case 'coupon':
      return [c.coupon.min, snap(f.value * c.coupon.maxFactor, c.coupon.step), c.coupon.step];
    case 'width':
      return [c.width.min, c.width.max, c.width.step];
    default: {
      const step = c.strikeStep;
      // Buyers (accumulator, TARF) get a strike below the forward, sellers above.
      const below = f.value < f.forwardAvg;
      const lo = below ? f.value - c.strikeBeyondFair : f.forwardAvg - c.strikeBeyondForward;
      const hi = below ? f.forwardAvg + c.strikeBeyondForward : f.value + c.strikeBeyondFair;
      return [snap(lo, step), snap(hi, step), step];
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Levels and zones (what the chart draws behind the path)
// ---------------------------------------------------------------------------------------------

/** A horizontal level of a product: strike, barrier, pivot or range bound. */
export type LevelKey =
  'strike' | 'barrier' | 'pivot' | 'lower' | 'upper' | 'lowerStrike' | 'upperStrike';

export interface ProductLevel {
  key: LevelKey;
  value: number;
}

/**
 * Zone of fixing levels: 'gain' (N at the strike, gain counts, coupon), 'loss' (leveraged
 * amount or payment), 'ko' (knock-out region). `from`/`to` are rates; ±Infinity = open.
 */
export interface Zone {
  kind: 'gain' | 'loss' | 'ko';
  from: number;
  to: number;
}

export function productLevels(product: ProductOf<SimKind>): ProductLevel[] {
  switch (product.kind) {
    case 'accumulator':
    case 'decumulator':
      return [
        { key: 'strike', value: product.strike },
        { key: 'barrier', value: product.barrier },
      ];
    case 'tarf':
    case 'tpf':
      return [{ key: 'strike', value: product.strike }];
    case 'pivotTarf':
      return [
        { key: 'lowerStrike', value: product.lowerStrike },
        { key: 'pivot', value: product.pivot },
        { key: 'upperStrike', value: product.upperStrike },
      ];
    case 'rtpf':
      return [
        { key: 'lower', value: product.lower },
        { key: 'upper', value: product.upper },
      ];
  }
}

export function productZones(product: ProductOf<SimKind>): Zone[] {
  const inf = Number.POSITIVE_INFINITY;
  switch (product.kind) {
    case 'accumulator':
      return [
        { kind: 'ko', from: product.barrier, to: inf },
        { kind: 'gain', from: product.strike, to: product.barrier },
        { kind: 'loss', from: -inf, to: product.strike },
      ];
    case 'decumulator':
      return [
        { kind: 'loss', from: product.strike, to: inf },
        { kind: 'gain', from: product.barrier, to: product.strike },
        { kind: 'ko', from: -inf, to: product.barrier },
      ];
    case 'tarf':
    case 'tpf':
      return [
        { kind: 'gain', from: product.strike, to: inf },
        { kind: 'loss', from: -inf, to: product.strike },
      ];
    case 'pivotTarf':
      return [
        { kind: 'loss', from: product.upperStrike, to: inf },
        { kind: 'gain', from: product.lowerStrike, to: product.upperStrike },
        { kind: 'loss', from: -inf, to: product.lowerStrike },
      ];
    case 'rtpf':
      return [
        { kind: 'loss', from: product.upper, to: inf },
        { kind: 'gain', from: product.lower, to: product.upper },
        { kind: 'loss', from: -inf, to: product.lower },
      ];
  }
}

// ---------------------------------------------------------------------------------------------
// One simulated path
// ---------------------------------------------------------------------------------------------

/** Scenario settings of one run. `move` and `gap` apply to the templates, `seed` to 'random'. */
export interface ScenarioSettings {
  name: ScenarioName;
  /** Total move over the horizon (trend, sideways, shock); default from MC_CONFIG. */
  move?: number;
  /** One-day gap (shock), e.g. −0.06. */
  gap?: number;
  /** Day of the gap (shock), 1 … horizon. */
  gapDay?: number;
  /** Seed of the random path. */
  seed?: number;
}

/** Default scenario settings from MC_CONFIG.scenarios for a horizon. */
export function defaultScenario(name: ScenarioName, days: number): Required<ScenarioSettings> {
  const s = MC_CONFIG.scenarios;
  const base = { name, move: 0, gap: 0, gapDay: 0, seed: s.random.seed };
  if (name === 'random') return base;
  if (name === 'shock') {
    return {
      ...base,
      move: s.shock.move,
      gap: s.shock.gap,
      gapDay: shockDay(days),
      seed: s.shock.seed,
    };
  }
  return { ...base, move: s[name].move, seed: s[name].seed };
}

/** Daily path of a scenario over `days` days (path[0] = spot). */
export function scenarioFor(
  settings: ScenarioSettings,
  days: number,
  market: Market = DEFAULT_MARKET,
): Float64Array {
  const d = defaultScenario(settings.name, days);
  if (settings.name === 'random') {
    return scenarioPath('random', days, market, { seed: settings.seed ?? d.seed });
  }
  const opts: { move: number; gap?: number; gapAt?: number } = { move: settings.move ?? d.move };
  if (settings.name === 'shock') {
    const gapDay = Math.min(days, Math.max(1, Math.round(settings.gapDay ?? d.gapDay)));
    opts.gap = settings.gap ?? d.gap;
    // shockDay rounds gapAt · days; aim at the middle of the day so it lands exactly.
    opts.gapAt = gapDay / days;
  }
  return scenarioPath(settings.name, days, market, opts);
}

/** What a fixing row shows. 'none' = after the product ended (not traded any more). */
export type RowKind =
  'buy' | 'buyLev' | 'sell' | 'sellLev' | 'coupon' | 'payment' | 'ko' | 'target' | 'none';

/** One scheduled fixing of a simulated path (one row of the cash-flow table). */
export interface FixingRow {
  /** 0-based index and 1-based fixing number. */
  index: number;
  fixing: number;
  day: number;
  spot: number;
  /** Forward to this fixing day (continuous, T = day / 365). */
  forward: number;
  /** True if the product was still alive on this fixing. */
  active: boolean;
  kind: RowKind;
  /** Event on this fixing: knock-out or target reached (the product ends here). */
  event: 'ko' | 'target' | null;
  /** True if the fixing traded or paid the leveraged amount. */
  leveraged: boolean;
  /** USD received (+) or paid (−) and CHF received (+) or paid (−) by the product. */
  amountBase: number;
  amountQuote: number;
  /** Traded rate (CHF per USD), null for coupons and payments. */
  rate: number | null;
  /** Product P&L of this fixing against the market (CHF), and cumulated. */
  pnl: number;
  cumPnl: number;
  /** Benchmark of this fixing (forward hedge P&L, or gross gain received) and cumulated. */
  bench: number;
  cumBench: number;
  /** Target progress after this fixing: gain in CHF per USD (TARFs) or coupons paid. */
  targetProgress: number;
  /** Planned USD of the hedge products (N, signed: + buy, − sell); 0 for the others. */
  needBase: number;
}

/** A full simulated path of one product. */
export interface Simulation {
  kind: SimKind;
  product: ProductOf<SimKind>;
  market: Market;
  scenario: Required<ScenarioSettings>;
  benchmark: BenchmarkKind;
  days: number;
  path: Float64Array;
  result: PayoffResult;
  rows: FixingRow[];
  /** Index of the last active fixing, its day and why the product ended. */
  endIndex: number;
  endDay: number;
  reason: EndReason;
  /** Index of the first leveraged fixing, −1 if none. */
  firstLeveraged: number;
  /** Day of the gap of a shock scenario, null otherwise. */
  gapDay: number | null;
}

/** Forward to a calendar day, F = S · e^((rd − rf) · day / 365), from src/lib/fx/forward.ts. */
export function forwardToDay(day: number, market: Market = DEFAULT_MARKET): number {
  return forwardContinuous(
    market.spot,
    market.rd,
    market.rf,
    day / MC_CONFIG.conventions.daysPerYear,
  );
}

function rowKind(cfs: Cashflow[], notional: number): { kind: RowKind; leveraged: boolean } {
  const trade = cfs.find((c) => c.kind !== 'ko' && c.kind !== 'target');
  const marker = cfs.find((c) => c.kind === 'ko' || c.kind === 'target');
  if (!trade) return { kind: marker ? (marker.kind as RowKind) : 'none', leveraged: false };
  const lev = Math.abs(trade.amountBase) > notional * 1.0000001;
  switch (trade.kind) {
    case 'buy':
      return { kind: lev ? 'buyLev' : 'buy', leveraged: lev };
    case 'sell':
      return { kind: lev ? 'sellLev' : 'sell', leveraged: lev };
    case 'payment':
      return { kind: 'payment', leveraged: true };
    default:
      return { kind: trade.kind as RowKind, leveraged: false };
  }
}

/**
 * Simulates one product on one scenario path: every scheduled fixing as a row (with the
 * product's cash flows until it ended and the benchmark on every fixing), plus end facts.
 * `param` overrides the solved parameter (undefined = fair).
 */
export function simulate(
  kind: SimKind,
  scenario: ScenarioSettings,
  param?: number,
  market: Market = DEFAULT_MARKET,
): Simulation {
  const product = simProduct(kind, param) as ProductOf<SimKind>;
  const days = horizonDays(product);
  const sc = { ...defaultScenario(scenario.name, days), ...stripUndefined(scenario) };
  if (sc.name === 'shock') sc.gapDay = Math.min(days, Math.max(1, Math.round(sc.gapDay)));
  const path = scenarioFor(sc, days, market);
  const result = productPayoff(path, product, market);
  const benchmark = PATHSIM_CONFIG.benchmark[kind];
  const N = product.notional;
  const byFixing = new Map<number, Cashflow[]>();
  for (const c of result.cashflows) {
    const list = byFixing.get(c.fixing) ?? [];
    list.push(c);
    byFixing.set(c.fixing, list);
  }
  const rows: FixingRow[] = [];
  let cumPnl = 0;
  let cumBench = 0;
  let progress = 0;
  let firstLeveraged = -1;
  const endIndex = result.endedAt - 1;
  product.fixingDays.forEach((day, i) => {
    const spot = path[day]!;
    const forward = forwardToDay(day, market);
    const cfs = byFixing.get(i + 1) ?? [];
    const active = i <= endIndex;
    const { kind: rk, leveraged } = active
      ? rowKind(cfs, N)
      : { kind: 'none' as const, leveraged: false };
    const pnl = cfs.reduce((s, c) => s + c.pnlQuote, 0);
    const amountBase = cfs.reduce((s, c) => s + c.amountBase, 0);
    const amountQuote = cfs.reduce((s, c) => s + c.amountQuote, 0);
    const rate = cfs.find((c) => c.rate !== null)?.rate ?? null;
    const marker = cfs.find((c) => c.kind === 'ko' || c.kind === 'target');
    if (cfs.length) progress = cfs[cfs.length - 1]!.targetProgress;
    let bench: number;
    let needBase = 0;
    if (benchmark === 'forwardBuy') {
      bench = (spot - forward) * N;
      needBase = N;
    } else if (benchmark === 'forwardSell') {
      bench = (forward - spot) * N;
      needBase = -N;
    } else {
      bench = active ? cfs.reduce((s, c) => s + Math.max(0, c.pnlQuote), 0) : 0;
    }
    cumPnl += pnl;
    cumBench += bench;
    if (leveraged && firstLeveraged < 0) firstLeveraged = i;
    rows.push({
      index: i,
      fixing: i + 1,
      day,
      spot,
      forward,
      active,
      kind: rk,
      event: marker ? (marker.kind as 'ko' | 'target') : null,
      leveraged,
      amountBase,
      amountQuote,
      rate,
      pnl,
      cumPnl,
      bench,
      cumBench,
      targetProgress: progress,
      needBase,
    });
  });
  return {
    kind,
    product,
    market,
    scenario: sc,
    benchmark,
    days,
    path,
    result,
    rows,
    endIndex,
    endDay: result.endDay,
    reason: result.reason,
    firstLeveraged,
    gapDay: sc.name === 'shock' ? sc.gapDay : null,
  };
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}

// ---------------------------------------------------------------------------------------------
// Playback state
// ---------------------------------------------------------------------------------------------

/** Linear interpolation of a daily path at a fractional day t (clamped to the horizon). */
export function spotAt(path: ArrayLike<number>, t: number): number {
  const last = path.length - 1;
  const x = Math.min(last, Math.max(0, t));
  const i = Math.floor(x);
  if (i >= last) return path[last]!;
  const f = x - i;
  return path[i]! + (path[i + 1]! - path[i]!) * f;
}

/** Everything the panel shows at playback time t (in days). */
export interface PlayState {
  t: number;
  spot: number;
  /** Number of scheduled fixings with day ≤ t, and of those the product traded. */
  passed: number;
  passedActive: number;
  /** True once the product ended (knock-out, target or last fixing) at or before t. */
  ended: boolean;
  /** Last row passed (null before the first fixing). */
  last: FixingRow | null;
  cumPnl: number;
  cumBench: number;
  /** Product − benchmark (CHF): for the hedges the advantage over the forward hedge. */
  diff: number;
  /** USD traded so far by the product (signed) and planned so far (signed, hedges only). */
  base: number;
  need: number;
  /** Target progress so far (TARFs: CHF per USD; TPF/RTPF: coupons). */
  targetProgress: number;
}

export function playState(sim: Simulation, t: number): PlayState {
  let passed = 0;
  let last: FixingRow | null = null;
  let base = 0;
  let need = 0;
  for (const r of sim.rows) {
    if (r.day > t + 1e-9) break;
    passed++;
    last = r;
    base += r.amountBase;
    need += r.needBase;
  }
  const passedActive = Math.min(passed, sim.endIndex + 1);
  const cumPnl = last?.cumPnl ?? 0;
  const cumBench = last?.cumBench ?? 0;
  return {
    t,
    spot: spotAt(sim.path, t),
    passed,
    passedActive,
    ended: sim.endDay <= t + 1e-9,
    last,
    cumPnl,
    cumBench,
    diff: cumPnl - cumBench,
    base,
    need,
    targetProgress: last?.targetProgress ?? 0,
  };
}

/** A moment worth announcing: the gap, the first leveraged fixing, the end of the product. */
export interface SimEvent {
  type: 'gap' | 'leverage' | 'ko' | 'target' | 'maturity';
  day: number;
  /** 1-based fixing number (0 for the gap). */
  fixing: number;
}

export function simEvents(sim: Simulation): SimEvent[] {
  const ev: SimEvent[] = [];
  if (sim.gapDay !== null) ev.push({ type: 'gap', day: sim.gapDay, fixing: 0 });
  if (sim.firstLeveraged >= 0) {
    const r = sim.rows[sim.firstLeveraged]!;
    ev.push({ type: 'leverage', day: r.day, fixing: r.fixing });
  }
  const end = sim.rows[sim.endIndex]!;
  ev.push({
    type: sim.reason === 'knockout' ? 'ko' : sim.reason === 'target' ? 'target' : 'maturity',
    day: end.day,
    fixing: end.fixing,
  });
  return ev.sort((a, b) => a.day - b.day);
}

/** The latest event at or before t (what the "aha" line shows), or null. */
export function eventAt(events: readonly SimEvent[], t: number): SimEvent | null {
  let out: SimEvent | null = null;
  for (const e of events) if (e.day <= t + 1e-9) out = e;
  return out;
}

/**
 * Step series of the cumulative P&L for the chart: [day, value] points, starting at (0, 0),
 * jumping at each fixing. `which` = product (stops at the end day) or benchmark (all fixings).
 * Points after `t` are dropped and the last value is carried to t.
 */
export function pnlSteps(
  sim: Simulation,
  which: 'product' | 'bench',
  t: number = sim.days,
): Array<[number, number]> {
  const pts: Array<[number, number]> = [[0, 0]];
  let v = 0;
  for (const r of sim.rows) {
    if (r.day > t + 1e-9) break;
    if (which === 'product' && !r.active) break;
    const next = which === 'product' ? r.cumPnl : r.cumBench;
    pts.push([r.day, v], [r.day, next]);
    v = next;
  }
  const end = which === 'product' ? Math.min(t, sim.endDay) : t;
  if (pts[pts.length - 1]![0] < end) pts.push([end, v]);
  return pts;
}

// ---------------------------------------------------------------------------------------------
// The 100-path view
// ---------------------------------------------------------------------------------------------

/** One path of the ensemble with its outcome. */
export interface EnsemblePath {
  path: Float64Array;
  endIndex: number;
  endDay: number;
  reason: EndReason;
  /** Product P&L against the market (CHF, undiscounted) and the benchmark over all fixings. */
  pnl: number;
  bench: number;
}

/** Simulates `n` risk-neutral GBM paths (market vol, seeded) and evaluates the product. */
export function simulateEnsemble(
  kind: SimKind,
  n: number = PATHSIM_CONFIG.ensemble.paths,
  seed: number = PATHSIM_CONFIG.ensemble.seed,
  param?: number,
  market: Market = DEFAULT_MARKET,
): EnsemblePath[] {
  const product = simProduct(kind, param) as ProductOf<SimKind>;
  const days = horizonDays(product);
  const src = new GbmPathSource(market, { paths: n, days, seed, antithetic: false });
  const out: EnsemblePath[] = [];
  const benchmark = PATHSIM_CONFIG.benchmark[kind];
  for (let p = src.next(); p; p = src.next()) {
    const path = p.slice();
    const r = productPayoff(path, product, market);
    let bench = 0;
    for (const day of product.fixingDays) {
      const f = forwardToDay(day, market);
      if (benchmark === 'forwardBuy') bench += (path[day]! - f) * product.notional;
      else if (benchmark === 'forwardSell') bench += (f - path[day]!) * product.notional;
    }
    if (benchmark === 'gains') {
      bench = r.cashflows.reduce((s, c) => s + Math.max(0, c.pnlQuote), 0);
    }
    out.push({
      path,
      endIndex: r.endedAt - 1,
      endDay: r.endDay,
      reason: r.reason,
      pnl: r.totalPnlQuote,
      bench,
    });
  }
  return out;
}

/** Summary of an ensemble: how the paths ended, mean P&L with standard error, extremes. */
export interface EnsembleSummary {
  n: number;
  count: Record<EndReason, number>;
  /** Mean number of fixings until the product ended (all paths). */
  meanFixings: number;
  /** Mean number of fixings of the paths that ended early (target / knock-out), null if none. */
  meanFixingsEarly: number | null;
  meanPnl: number;
  stdErr: number;
  worst: number;
  best: number;
  /** Mean P&L of the paths that ended early (target / knock-out) and of those at maturity. */
  meanEarly: number | null;
  meanMaturity: number | null;
  /** Mean and worst P&L of the paths with a loss, and their number. */
  losses: number;
  meanLoss: number | null;
}

export function summarizeEnsemble(paths: readonly EnsemblePath[]): EnsembleSummary {
  const n = paths.length;
  const count: Record<EndReason, number> = { maturity: 0, knockout: 0, target: 0 };
  let sum = 0;
  let sum2 = 0;
  let fix = 0;
  let worst = Number.POSITIVE_INFINITY;
  let best = Number.NEGATIVE_INFINITY;
  let early = 0;
  let earlyN = 0;
  let earlyFix = 0;
  let mat = 0;
  let lossSum = 0;
  let lossN = 0;
  for (const p of paths) {
    count[p.reason]++;
    sum += p.pnl;
    sum2 += p.pnl * p.pnl;
    fix += p.endIndex + 1;
    worst = Math.min(worst, p.pnl);
    best = Math.max(best, p.pnl);
    if (p.reason === 'maturity') mat += p.pnl;
    else {
      early += p.pnl;
      earlyN++;
      earlyFix += p.endIndex + 1;
    }
    if (p.pnl < 0) {
      lossSum += p.pnl;
      lossN++;
    }
  }
  const mean = n ? sum / n : 0;
  const variance = n > 1 ? (sum2 - n * mean * mean) / (n - 1) : 0;
  return {
    n,
    count,
    meanFixings: n ? fix / n : 0,
    meanFixingsEarly: earlyN ? earlyFix / earlyN : null,
    meanPnl: mean,
    stdErr: n > 1 ? Math.sqrt(Math.max(0, variance) / n) : 0,
    worst: n ? worst : 0,
    best: n ? best : 0,
    meanEarly: earlyN ? early / earlyN : null,
    meanMaturity: count.maturity ? mat / count.maturity : null,
    losses: lossN,
    meanLoss: lossN ? lossSum / lossN : null,
  };
}

/** Indices of the ensemble paths sorted by P&L (ascending), for the outcome bars. */
export function sortedByPnl(paths: readonly EnsemblePath[]): number[] {
  return paths.map((_, i) => i).sort((a, b) => paths[a]!.pnl - paths[b]!.pnl || a - b);
}

// ---------------------------------------------------------------------------------------------
// Chart helpers
// ---------------------------------------------------------------------------------------------

/**
 * Rate domain [lo, hi] that shows the paths and the product levels, padded by `pad` (relative
 * to the span) and at least `minSpan` wide.
 */
export function rateDomain(
  paths: ReadonlyArray<ArrayLike<number>>,
  levels: readonly number[],
  pad = 0.08,
  minSpan = 0.04,
): [number, number] {
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  for (const p of paths) {
    for (let i = 0; i < p.length; i++) {
      const v = p[i]!;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
  }
  for (const v of levels) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [0, 1];
  let span = hi - lo;
  if (span < minSpan) {
    const mid = (lo + hi) / 2;
    lo = mid - minSpan / 2;
    hi = mid + minSpan / 2;
    span = minSpan;
  }
  return [lo - span * pad, hi + span * pad];
}

/** Month ticks (in days) for a horizon: every month up to 6 months, else every 3 months. */
export function monthTicks(days: number): Array<{ day: number; month: number }> {
  const year = MC_CONFIG.conventions.daysPerYear;
  const months = Math.round((days * 12) / year);
  const step = months <= 6 ? 1 : 3;
  const out: Array<{ day: number; month: number }> = [];
  for (let m = 0; m <= months; m += step) {
    out.push({ day: Math.min(days, Math.round((m * year) / 12)), month: m });
  }
  return out;
}

/** Pips of a rate difference. */
export const toPips = (x: number): number => x / PIP;
