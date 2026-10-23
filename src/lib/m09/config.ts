/**
 * Module 09 (Hedge, Alpha, Yield): every modelling and teaching choice of the module's figures
 * and numbers in ONE documented object (D-22). Change a value here and the figures, the number
 * registry (src/lib/nums/m09.ts) and the quiz follow.
 *
 * Market = the running example (src/lib/fx/example.ts, "Beispielwerte, keine Marktdaten"):
 * USD/CHF 0.8000, rd = CHF 0 % (quote, domestic), rf = USD 3.5 % (base, foreign), vol 8 %,
 * T = 0.25 (3 months, T = days/365 in the option model), money market Act/360 (90 days).
 */
import { EXAMPLE } from '@/lib/fx/example';
import type { PayoffMarket } from '@/lib/payoff';

export const PIP = 1e-4;

export const M09_CONFIG = {
  /** The importer's market (option model: continuous rates, T = 0.25). */
  market: {
    spot: EXAMPLE.spot,
    rd: EXAMPLE.rd,
    rf: EXAMPLE.rf,
    vol: EXAMPLE.vol,
    T: EXAMPLE.T,
    notional: EXAMPLE.notional,
    pair: EXAMPLE.pair,
    mmDays: EXAMPLE.mmDays,
  },

  /** HedgeCompare (section 2): the importer's effective rate at expiry, five strategies. */
  hedge: {
    /**
     * Choice: the USD call is the ATMF call of modules 04/05 (strike EXAMPLE_STRIKE); the
     * collar is the risk-reversal template of module 06 (25Δ USD call, zero-cost USD put).
     */
    callStrike: 'atmf' as const,
    /**
     * Structured hedge = one fixing of an accumulator / TARF without knock-out or target
     * (a "leveraged forward"): buy N at K if S_T ≥ K, buy 2N at K if S_T < K; K solved for
     * zero cost. Choice: the extra N USD are valued at S_T (sold back at the market).
     */
    leverage: 2,
    /** Chart range of S_T relative to spot (±6 %). */
    xRange: [-0.06, 0.06] as const,
    /** Grid of the S_T slider and handle (5 pips). */
    fixingStep: 0.0005,
    /** S_T shown first: the importer's fear, a dollar 4 % stronger. Choice. */
    initialMove: 0.04,
    /** Worked example scenarios at expiry (teaching choices, relative to spot). */
    scenarios: { up: 0.05, down: -0.05 },
    /**
     * Playback tour of S_T: waypoints relative to spot and the duration in ms (normal motion).
     * Under reduced motion the tour jumps between the event levels instead.
     */
    tour: { waypoints: [0, 0.055, -0.055, 0] as const, ms: 9000, stepMs: 1100 },
  },

  /** Orders in the matrix cards (section 2 text): example levels relative to spot. Choice. */
  orders: { limitBelow: 0.01, stopAbove: 0.01 },

  /** Discount certificate on USD (section 4): cap and tenor. Choice: cap at spot, 3 months. */
  discount: { capFactor: 1, T: EXAMPLE.T, days: EXAMPLE.mmDays },

  /**
   * CarryCushion (section 4): a CHF investor buys USD 1 Mio. at spot, deposits them at the USD
   * rate and compares with a CHF deposit. Money market Act/360, simple rates.
   */
  carry: {
    /** USD amount bought at spot (the example notional). */
    notionalBase: EXAMPLE.notional,
    /** Tenor slider in months. */
    months: { min: 1, max: 12, step: 1, initial: EXAMPLE.months },
    /**
     * Choice: money-market days = 30 per month, so 3 months = 90 days = the example's Act/360
     * period (EXAMPLE.mmDays) and 12 months = 360 days.
     */
    daysPerMonth: 30,
    /** USD rate slider (simple p.a.); CHF rate stays at the example's rd. */
    usdRate: { min: 0, max: 0.06, step: 0.0025 },
    /** Vol slider for the 1σ ruler (decimal). */
    vol: { min: 0.04, max: 0.16, step: 0.005 },
    /** Chart range of S_T relative to spot (±10 %). */
    xRange: [-0.1, 0.1] as const,
    fixingStep: 0.0005,
    /** S_T shown first: 2 % below spot (inside the 1σ range, below the forward). Choice. */
    initialMove: -0.02,
    /** Playback: the tenor runs from min to max months in this many ms. */
    playMs: 6000,
  },

  /** Product matrix sparklines (section 1): x range relative to spot and the y clip in pips. */
  matrix: { xRange: [-0.0625, 0.0625] as const, samples: 64, clipPips: 900 },
} as const;

/** The example market in the payoff-builder format (module 06 templates). */
export const M09_MARKET: PayoffMarket = {
  S: M09_CONFIG.market.spot,
  T: M09_CONFIG.market.T,
  vol: M09_CONFIG.market.vol,
  rd: M09_CONFIG.market.rd,
  rf: M09_CONFIG.market.rf,
  notional: M09_CONFIG.market.notional,
  pair: M09_CONFIG.market.pair,
};
