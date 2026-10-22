/**
 * FX forward: covered interest parity.
 *
 * Convention: pair Base/Quote (e.g. USD/CHF), rd = rate of the quote currency (domestic, CHF),
 * rf = rate of the base currency (foreign, USD). Prices in quote currency per 1 unit of base.
 *
 * Two ways to the same certain amount at maturity must cost the same today:
 * (a) invest quote currency at rd, or (b) buy base spot, invest it at rf and sell it forward.
 * - Money market (simple rates, day count per currency): F = S · (1 + rd · tq) / (1 + rf · tb)
 * - Continuous (option models, T = days / 365): F = S · e^((rd − rf) · T)
 * In the running example the two differ by about 0.3 pips.
 */
import { pipSize } from '@/lib/format';
import { basisOf } from './daycount';

/** Forward convention: continuous rates (option models) or simple money-market rates. */
export type ForwardConvention = 'continuous' | 'moneyMarket';

/** Options for {@link forward} in the money-market convention. */
export interface ForwardOptions {
  /** Calendar days to maturity. Default: Math.round(T · 360). */
  days?: number;
  /** Quote currency (domestic, rd), sets its day count. Default ACT/360. */
  quoteCcy?: string;
  /** Base currency (foreign, rf), sets its day count. Default ACT/360. */
  baseCcy?: string;
}

/**
 * Forward with continuous rates: F = S · e^((rd − rf) · T).
 * S in quote per base, rd and rf continuous p.a. (0.035 = 3.5 %), T in years.
 */
export function forwardContinuous(S: number, rd: number, rf: number, T: number): number {
  return S * Math.exp((rd - rf) * T);
}

/**
 * Forward with simple money-market rates: F = S · (1 + rd · days / basisQuote) /
 * (1 + rf · days / basisBase). Rates simple p.a., days in calendar days, bases 360 or 365.
 */
export function forwardMoneyMarket(
  S: number,
  rd: number,
  rf: number,
  days: number,
  basisQuote = 360,
  basisBase = 360,
): number {
  return (S * (1 + (rd * days) / basisQuote)) / (1 + (rf * days) / basisBase);
}

/**
 * Forward in the chosen convention.
 * - 'continuous': S · e^((rd − rf) · T), T in years.
 * - 'moneyMarket': S · (1 + rd · tq) / (1 + rf · tb) with days = opts.days ?? Math.round(T · 360)
 *   and the day count of opts.quoteCcy / opts.baseCcy (ACT/360 if not given).
 */
export function forward(
  S: number,
  rd: number,
  rf: number,
  T: number,
  convention: ForwardConvention = 'continuous',
  opts: ForwardOptions = {},
): number {
  if (convention === 'continuous') return forwardContinuous(S, rd, rf, T);
  const days = opts.days ?? Math.round(T * 360);
  return forwardMoneyMarket(S, rd, rf, days, basisOf(opts.quoteCcy), basisOf(opts.baseCcy));
}

/**
 * Forward points in pips: (F − S) / pip, pip = 0.0001 (JPY pairs 0.01).
 * Negative = forward discount (base currency has the higher rate), positive = premium.
 */
export function forwardPoints(F: number, S: number, pair = 'USD/CHF'): number {
  return (F - S) / pipSize(pair);
}

/** Forward premium (+) or discount (−) as a fraction of spot: F / S − 1 (not annualised). */
export function forwardPremium(F: number, S: number): number {
  return F / S - 1;
}

/**
 * Annualised forward premium in money-market terms: (F / S − 1) · basis / days.
 * Approximately the rate differential rd − rf; exact (= rd) if rf = 0 and basis is the quote
 * currency's basis. Returns NaN for days ≤ 0.
 */
export function forwardPremiumAnnualized(F: number, S: number, days: number, basis = 360): number {
  if (days <= 0) return Number.NaN;
  return (forwardPremium(F, S) * basis) / days;
}

/**
 * Rate differential implied by a forward, continuous convention: rd − rf = ln(F / S) / T
 * (p.a., continuous; T in years). Returns NaN for T ≤ 0.
 */
export function impliedRateDifferential(S: number, F: number, T: number): number {
  if (T <= 0) return Number.NaN;
  return Math.log(F / S) / T;
}

/**
 * Quote-currency rate implied by spot, forward and the base rate (money-market "implied
 * yield"): rd = ((F / S) · (1 + rf · days / basisBase) − 1) · basisQuote / days.
 * Simple rate p.a. Inverse of {@link forwardMoneyMarket} in rd. Returns NaN for days ≤ 0.
 */
export function impliedQuoteRate(
  S: number,
  F: number,
  rf: number,
  days: number,
  basisQuote = 360,
  basisBase = 360,
): number {
  if (days <= 0) return Number.NaN;
  return (((F / S) * (1 + (rf * days) / basisBase) - 1) * basisQuote) / days;
}

/** Decomposition of the money-market forward into "spot + cost − benefit". */
export interface ForwardCarry {
  /** Spot, quote per base. */
  spot: number;
  /** Cost of carry: interest on the quote currency, S · rd · tq / (1 + rf · tb). */
  cost: number;
  /** Benefit: interest earned on the base currency, S · rf · tb / (1 + rf · tb). */
  benefit: number;
  /** Forward = spot + cost − benefit (identical to {@link forwardMoneyMarket}). */
  forward: number;
}

/**
 * Exact "Forward = Spot + Cost − Benefit" in the money-market convention.
 * Cost = S · rd · tq / (1 + rf · tb) (financing the quote currency),
 * Benefit = S · rf · tb / (1 + rf · tb) (interest on the base currency you hold),
 * with tq = days / basisQuote and tb = days / basisBase. All in quote currency per 1 base.
 */
export function forwardCarry(
  S: number,
  rd: number,
  rf: number,
  days: number,
  basisQuote = 360,
  basisBase = 360,
): ForwardCarry {
  const tq = days / basisQuote;
  const tb = days / basisBase;
  const growthBase = 1 + rf * tb;
  const cost = (S * rd * tq) / growthBase;
  const benefit = (S * rf * tb) / growthBase;
  return { spot: S, cost, benefit, forward: S + cost - benefit };
}
