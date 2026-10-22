/**
 * Deterministic scenario paths for the path simulator (§8.4). Pure, no DOM.
 *
 * Every scenario is a daily path path[0 … days] (path[0] = spot) built in log space from a
 * drift, seeded noise and scenario features; the same name, spot, horizon and seed always give
 * the same path. Parameters live in MC_CONFIG.scenarios.
 *
 *   ln S_{d+1} = ln S_d + (μ − ½σ²) Δt − κ (ln S_d − ln S_0) Δt + σ √Δt Z_d   (+ ln(1 + gap))
 *
 * - trendUp / trendDown: drift μ = ±12 % p.a. with mild noise.
 * - sideways: no drift, mean reversion κ towards the spot keeps it in a band.
 * - shock: no drift and a one-day gap (default −6 % after 40 % of the horizon).
 * - random: a risk-neutral GBM path with the market vol, as in the valuation.
 */
import { GbmPathSource } from './gbm';
import { DEFAULT_MARKET, MC_CONFIG, type Market } from './products';
import { Rng } from './rng';

export type ScenarioName = keyof typeof MC_CONFIG.scenarios;

/** Scenario names in display order. */
export const SCENARIO_NAMES: readonly ScenarioName[] = [
  'trendUp',
  'trendDown',
  'sideways',
  'shock',
  'random',
];

/** Optional overrides of a scenario (defaults from MC_CONFIG.scenarios). */
export interface ScenarioOptions {
  /** Drift p.a. (trend scenarios). */
  driftPa?: number;
  /** Noise volatility p.a. */
  vol?: number;
  /** Mean-reversion speed per year (sideways). */
  meanReversion?: number;
  /** Relative one-day gap, e.g. −0.06 (shock). */
  gap?: number;
  /** Position of the gap as a fraction of the horizon, 0 … 1 (shock). */
  gapAt?: number;
  seed?: number;
}

/** Day of the gap in a shock scenario of `days` days (at least day 1). */
export function shockDay(days: number, gapAt: number = MC_CONFIG.scenarios.shock.gapAt): number {
  return Math.min(days, Math.max(1, Math.round(gapAt * days)));
}

/**
 * Daily scenario path of `days` days (length days + 1) starting at market.spot.
 * 'random' uses the market (rd, rf, vol) like the valuation; the others use their own drift
 * and noise from MC_CONFIG.scenarios, overridable via `opts`.
 */
export function scenarioPath(
  name: ScenarioName,
  days: number,
  market: Market = DEFAULT_MARKET,
  opts: ScenarioOptions = {},
): Float64Array {
  if (!Number.isInteger(days) || days < 1) {
    throw new RangeError(`scenarioPath: days must be a positive integer, got ${days}`);
  }
  const cfg = MC_CONFIG.scenarios;
  if (name === 'random') {
    return randomPath(days, market, opts.seed ?? cfg.random.seed);
  }
  const c = cfg[name];
  const mu = opts.driftPa ?? ('driftPa' in c ? c.driftPa : 0);
  const vol = opts.vol ?? c.vol;
  const kappa = opts.meanReversion ?? ('meanReversion' in c ? c.meanReversion : 0);
  const gap = opts.gap ?? ('gap' in c ? c.gap : 0);
  const gapDay = name === 'shock' ? shockDay(days, opts.gapAt ?? cfg.shock.gapAt) : -1;
  const rng = new Rng(opts.seed ?? c.seed);
  const dt = MC_CONFIG.conventions.dt;
  const sq = Math.sqrt(dt);
  const path = new Float64Array(days + 1);
  path[0] = market.spot;
  let x = 0; // ln(S / S0)
  for (let d = 1; d <= days; d++) {
    x += (mu - 0.5 * vol * vol) * dt - kappa * x * dt + vol * sq * rng.normal();
    if (d === gapDay) x += Math.log(1 + gap);
    path[d] = market.spot * Math.exp(x);
  }
  return path;
}

/** One risk-neutral GBM path (copy) with the market vol, from a seed. */
export function randomPath(
  days: number,
  market: Market = DEFAULT_MARKET,
  seed: number = MC_CONFIG.scenarios.random.seed,
): Float64Array {
  const src = new GbmPathSource(market, { paths: 1, days, seed, antithetic: false });
  return src.next()!.slice();
}
