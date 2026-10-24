/**
 * The running example (single source of truth). Beispielwerte, keine Marktdaten.
 *
 * A Swiss importer has to pay USD 1 million in three months and fears a stronger dollar.
 * Pair USD/CHF (base USD, quote CHF). Convention: rd = rate of the quote currency (CHF,
 * domestic), rf = rate of the base currency (USD, foreign). Prices in CHF per 1 USD.
 *
 * Option model time: T = days / 365 (or weeks / 52). Money-market convention: Act/360.
 */

export const EXAMPLE = {
  pair: 'USD/CHF',
  base: 'USD',
  quote: 'CHF',
  /** Spot USD/CHF. */
  spot: 0.8,
  /** CHF rate (domestic, quote currency), continuous in the option model. */
  rd: 0.0,
  /** USD rate (foreign, base currency). */
  rf: 0.035,
  /** Time to expiry in years in the option model (3 months). */
  T: 0.25,
  /** Days in the money-market convention (Act/360). */
  mmDays: 90,
  /** Implied volatility. */
  vol: 0.08,
  /** Notional in USD. */
  notional: 1_000_000,
  /** Months to payment. */
  months: 3,
} as const;

/** Continuous forward of the example, S · e^((rd − rf) · T) ≈ 0.79303. */
export const EXAMPLE_FORWARD = EXAMPLE.spot * Math.exp((EXAMPLE.rd - EXAMPLE.rf) * EXAMPLE.T);

/** Strike = ATMF, rounded to 4 decimals (0.7930). */
export const EXAMPLE_STRIKE = Math.round(EXAMPLE_FORWARD * 1e4) / 1e4;

export const EXAMPLE_LABEL = {
  de: 'Beispielwerte, keine Marktdaten',
  en: 'Example values, not market data',
} as const;

/**
 * Example smile quotes for USD/CHF 3M (module 06). Beispielwerte, keine Marktdaten.
 * ATM vol, 25-delta risk reversal (σ25 USD call − σ25 USD put; negative = CHF calls in demand)
 * and 25-delta butterfly in the smile-strangle convention. Change here to change everywhere.
 */
export const EXAMPLE_SMILE = {
  atm: 0.08,
  rr25: -0.01,
  bf25: 0.0025,
} as const;
