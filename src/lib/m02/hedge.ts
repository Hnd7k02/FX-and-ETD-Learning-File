/**
 * Figure (a) HedgeOutcome, section 1: what the Swiss importer pays in CHF for USD 1 Mio. at
 * maturity, unhedged (N · S_T) or with the forward (N · F, flat). Plus a set of model scenarios
 * for the rate at expiry, to show that the forward removes the spread of outcomes, not the cost.
 * Pure functions; amounts in CHF, rates in CHF per USD.
 */
import { forwardContinuous, forwardMoneyMarket } from '@/lib/fx/forward';
import { Rng } from '@/lib/fx/mc/rng';
import { M02_CONFIG } from './config';

/** Market inputs of the money-market forward. */
export interface ForwardMarket {
  spot: number;
  rd: number;
  rf: number;
  days: number;
  /** Option-model year fraction (used only by the continuous convention). */
  T: number;
  basisQuote: number;
  basisBase: number;
}

/**
 * The forward the importer deals: money market S · (1 + rd · t) / (1 + rf · t) or, if the config
 * says so, continuous S · e^((rd − rf)T).
 */
export function dealForward(
  m: ForwardMarket = M02_CONFIG.market,
  convention: 'moneyMarket' | 'continuous' = M02_CONFIG.dealConvention,
): number {
  return convention === 'continuous'
    ? forwardContinuous(m.spot, m.rd, m.rf, m.T)
    : forwardMoneyMarket(m.spot, m.rd, m.rf, m.days, m.basisQuote, m.basisBase);
}

/** How the forward compares with no hedge at one rate at expiry. */
export type HedgeVerdict = 'saves' | 'costs' | 'equal';

export interface HedgeOutcome {
  /** Rate at expiry. */
  st: number;
  /** CHF paid without hedge: N · S_T. */
  unhedged: number;
  /** CHF paid with the forward: N · F (independent of S_T). */
  hedged: number;
  /** unhedged − hedged: > 0 the forward saved money, < 0 it gave up a cheaper dollar. */
  diff: number;
  verdict: HedgeVerdict;
}

/** Below this difference in CHF both are called equal (display noise). */
const EQUAL_CHF = 0.5;

/** Cost of N USD at the rate at expiry, unhedged and with the forward F. */
export function hedgeOutcome(st: number, F: number, notional: number): HedgeOutcome {
  const unhedged = notional * st;
  const hedged = notional * F;
  const diff = unhedged - hedged;
  const verdict: HedgeVerdict =
    Math.abs(diff) < EQUAL_CHF ? 'equal' : diff > 0 ? 'saves' : 'costs';
  return { st, unhedged, hedged, diff, verdict };
}

/** Snaps a rate to the slider grid and clamps it to the range. */
export function snapRate(
  x: number,
  range: readonly [number, number] = M02_CONFIG.hedge.stRange,
  step: number = M02_CONFIG.hedge.stStep,
): number {
  const v = Math.round(x / step) * step;
  return Number(Math.min(range[1], Math.max(range[0], v)).toFixed(6));
}

/**
 * Model scenarios for the rate at expiry: S_T = F · exp(−½σ²T + σ√T · z), lognormal with
 * mean F (drift rd − rf, as in the Monte Carlo engine). Drawn as antithetic pairs (z, −z) from
 * the seeded generator and shuffled, so the same seed always gives the same list.
 */
export function scenarioRates(seed: number, count: number, F: number, vol: number, T: number) {
  const rng = new Rng(seed);
  const sd = vol * Math.sqrt(T);
  const mu = -0.5 * sd * sd;
  const out: number[] = [];
  while (out.length < count) {
    const z = rng.normal();
    out.push(F * Math.exp(mu + sd * z));
    if (out.length < count) out.push(F * Math.exp(mu - sd * z));
  }
  // Fisher-Yates with the same generator: pairs are not shown next to each other.
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng.uniform() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export interface ScenarioStats {
  n: number;
  /** Cheapest and dearest unhedged outcome in CHF. */
  min: number;
  max: number;
  /** max − min: the spread the forward removes. */
  spread: number;
  /** Average unhedged cost in CHF. */
  mean: number;
  /** Scenarios in which the forward was cheaper than no hedge (S_T > F). */
  forwardCheaper: number;
  /** Scenarios in which no hedge was cheaper (S_T < F). */
  forwardDearer: number;
}

/** Statistics of the unhedged CHF cost over the scenarios; the forward cost is N · F always. */
export function scenarioStats(rates: readonly number[], F: number, notional: number): ScenarioStats {
  if (rates.length === 0) {
    return { n: 0, min: 0, max: 0, spread: 0, mean: 0, forwardCheaper: 0, forwardDearer: 0 };
  }
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  let cheaper = 0;
  let dearer = 0;
  for (const st of rates) {
    const o = hedgeOutcome(st, F, notional);
    min = Math.min(min, o.unhedged);
    max = Math.max(max, o.unhedged);
    sum += o.unhedged;
    if (o.verdict === 'saves') cheaper++;
    else if (o.verdict === 'costs') dearer++;
  }
  return {
    n: rates.length,
    min,
    max,
    spread: max - min,
    mean: sum / rates.length,
    forwardCheaper: cheaper,
    forwardDearer: dearer,
  };
}

/** The default scenario sample of the figure (config seed and count). */
export function defaultScenarios(F: number = dealForward()): number[] {
  const c = M02_CONFIG.hedge.scenarios;
  return scenarioRates(c.seed, c.count, F, c.vol, M02_CONFIG.market.T);
}
