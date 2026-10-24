/**
 * Deterministic scenario paths for the path simulator (§8.4). Pure, no DOM.
 *
 * Every scenario is a daily path path[0 … days] (path[0] = spot); the same name, spot, horizon
 * and seed always give the same path. Parameters live in MC_CONFIG.scenarios.
 *
 *   ln(S_d / S_0) = ln(1 + move) · d / days + σ · B(t_d) + ln(1 + gap) · 1{d ≥ gap day}
 *
 * B is a Brownian bridge (seeded random walk pinned to zero at both ends, t_d = d / 365), so
 * the noise makes the path look like a market path while the end point stays exact:
 * S_end = spot · (1 + move) · (1 + gap). The move is over the whole horizon, so a 26-week
 * accumulator and a 12-month TARF tell the same story. Defaults:
 * - trendUp / trendDown: move ±8 %.
 * - sideways: no move, low noise; the path wanders and comes back to the spot.
 * - shock: no move and a one-day gap (default −6 % after 40 % of the horizon).
 * - random: a risk-neutral GBM path with the market vol, as in the valuation (not pinned).
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
  /** Total relative move over the horizon, e.g. −0.08. */
  move?: number;
  /** Noise volatility p.a. */
  vol?: number;
  /** Relative one-day gap, e.g. −0.06 (shock). */
  gap?: number;
  /** Position of the gap as a fraction of the horizon, 0 … 1 (shock). */
  gapAt?: number;
  seed?: number;
}

/** Day of the gap in a shock scenario of `days` days (between day 1 and the last day). */
export function shockDay(days: number, gapAt: number = MC_CONFIG.scenarios.shock.gapAt): number {
  return Math.min(days, Math.max(1, Math.round(gapAt * days)));
}

/**
 * Daily scenario path of `days` days (length days + 1) starting at market.spot.
 * 'random' uses the market (rd, rf, vol) like the valuation; the others use their own move,
 * noise and gap from MC_CONFIG.scenarios, overridable via `opts`.
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
  if (name === 'random') return randomPath(days, market, opts.seed ?? cfg.random.seed);
  const c = cfg[name];
  const move = opts.move ?? c.move;
  const vol = opts.vol ?? c.vol;
  const gap = opts.gap ?? ('gap' in c ? c.gap : 0);
  const gapDay = name === 'shock' ? shockDay(days, opts.gapAt ?? cfg.shock.gapAt) : -1;
  const dt = MC_CONFIG.conventions.dt;

  // Seeded random walk W, then the bridge B_d = W_d − (d / days) · W_days.
  const rng = new Rng(opts.seed ?? c.seed);
  const w = new Float64Array(days + 1);
  const step = vol * Math.sqrt(dt);
  for (let d = 1; d <= days; d++) w[d] = w[d - 1]! + step * rng.normal();
  const end = w[days]!;

  const path = new Float64Array(days + 1);
  const jump = Math.log(1 + gap);
  const trend = Math.log(1 + move);
  for (let d = 0; d <= days; d++) {
    const x = (trend - end) * (d / days) + w[d]! + (d >= gapDay && gapDay > 0 ? jump : 0);
    path[d] = market.spot * Math.exp(x);
  }
  return path;
}

/** One risk-neutral GBM path (a copy) with the market vol, from a seed. */
export function randomPath(
  days: number,
  market: Market = DEFAULT_MARKET,
  seed: number = MC_CONFIG.scenarios.random.seed,
): Float64Array {
  const src = new GbmPathSource(market, { paths: 1, days, seed, antithetic: false });
  return src.next()!.slice();
}
