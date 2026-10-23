/**
 * Module 03 (FX Swap): every parameter of the four figures and of the module texts in ONE
 * documented object (DECISIONS D-22). Change a value here and the figures, the numbers in the
 * texts (src/lib/nums/m03.ts) and the quiz (src/content/quiz/03-fx-swap.ts) follow.
 *
 * Market inputs come from the running example (src/lib/fx/example.ts, "Beispielwerte, keine
 * Marktdaten"): USD/CHF spot 0.8000, CHF rate (quote, rd) 0 %, USD rate (base, rf) 3.5 %,
 * 3 months = 90 days in the money market, USD 1 Mio. FX swaps are money-market instruments:
 * simple rates with the day count of each currency (CHF and USD Act/360).
 * Entries marked "choice" are teaching choices Dario may want to change.
 */
import { EXAMPLE } from '@/lib/fx/example';
import { basisOf } from '@/lib/fx/daycount';
import { forwardMoneyMarket } from '@/lib/fx/forward';

/** Pip of USD/CHF. */
export const PIP = 1e-4;

/** A tenor with simplified calendar days (no holidays, no value-date rules). */
export interface Tenor {
  id: string;
  days: number;
}

const basisQuote = basisOf(EXAMPLE.quote);
const basisBase = basisOf(EXAMPLE.base);

export const M03_CONFIG = {
  /** Running example (money-market view). */
  market: {
    pair: EXAMPLE.pair,
    base: EXAMPLE.base,
    quote: EXAMPLE.quote,
    spot: EXAMPLE.spot,
    rd: EXAMPLE.rd,
    rf: EXAMPLE.rf,
    days: EXAMPLE.mmDays,
    months: EXAMPLE.months,
    notional: EXAMPLE.notional,
    basisQuote,
    basisBase,
  },

  /** Choice: far rates and outright forwards with 5 decimals (0.1 pip), as in module 02. */
  rateDigits: 5,

  /**
   * (a) SwapTrip, section 1: a Swiss firm holds CHF and needs USD 1 Mio. for one month
   * (pays a supplier today, receives USD from a customer in a month). It buys the USD spot and
   * sells them back one month forward (buy/sell USD). The playback draws a model spot path
   * to show that the swap's amounts stay fixed while the open round trip swings.
   */
  trip: {
    /** Choice: one month = 30 days (money market, simplified). */
    days: 30,
    /** Model path of the spot during the month (lognormal, drift rd − rf, daily steps). */
    vol: EXAMPLE.vol,
    /** Choice: seed of the first path; "new path" adds 1. */
    seed: 20261023,
    /** Playback speed: milliseconds per day (30 days ≈ 3.6 s). */
    msPerDay: 120,
    /** Teaching scenarios for the text: spot in one month, dollar stronger / weaker (choice). */
    scenarioUp: 0.82,
    scenarioDown: 0.78,
    /** y axis of the chart (USD/CHF). */
    yDomain: [0.765, 0.835] as [number, number],
  },

  /** (b) SwapLegs, section 2: near and far leg of a swap on USD 1 Mio. */
  legs: {
    /** Choice: tenors with simplified calendar days (3M = the example's 90 days). */
    tenors: [
      { id: '1W', days: 7 },
      { id: '1M', days: 30 },
      { id: '3M', days: 90 },
      { id: '6M', days: 182 },
      { id: '1Y', days: 365 },
    ] as Tenor[],
    defaultTenor: '3M',
    /** Rate sliders (simple p.a.). Choice: 0 % to 6 % in 0.25 % steps. */
    rateRange: [0, 0.06] as [number, number],
    rateStep: 0.0025,
    /** y axis of the rate track: spot ± 500 pips covers 6 % differential over 1 year. */
    yHalfRangePips: 500,
  },

  /**
   * (c) HedgeRoll, section 3: the importer's forward (USD 1 Mio., dealt in module 02) matures,
   * but the supplier wants the money one month later. A sell/buy USD swap closes the old
   * forward (near leg at the spot of the roll date) and opens a new one (far leg). D-25: the
   * all-in rate is old forward + swap points; interest on the cash settlement between the
   * roll date and the new maturity is ignored (said in the text).
   */
  roll: {
    /**
     * Choice: the maturing forward is the money-market forward of the running example
     * (S · (1 + rd · 90/360) / (1 + rf · 90/360)), i.e. the forward the importer deals in
     * module 02 (M02_CONFIG.dealConvention = 'moneyMarket').
     */
    oldForward: forwardMoneyMarket(
      EXAMPLE.spot,
      EXAMPLE.rd,
      EXAMPLE.rf,
      EXAMPLE.mmDays,
      basisQuote,
      basisBase,
    ),
    /**
     * How far the payment slips. Choice: 1 month = 30 days (default), 2 and 3 months, with the
     * same simplified month as the rest of the module (3 months = the example's 90 days).
     */
    slips: [
      { id: '1M', days: 30 },
      { id: '2M', days: 60 },
      { id: '3M', days: 90 },
    ] as Tenor[],
    defaultSlip: '1M',
    /** Spot at the roll date: slider / handle range and step. */
    spotRange: [0.74, 0.86] as [number, number],
    spotStep: 0.0005,
    /**
     * Teaching scenarios: dollar stronger / weaker at the roll date (choice). Picked so that the
     * rounded numbers in the text add up (old forward + swap points = all-in rate to 0.1 pip,
     * gap between the two all-in rates); tests/unit/m03.test.ts checks this.
     */
    scenarioUp: 0.82,
    scenarioDown: 0.775,
    /** Start value of the slider (choice: case 1 of the text, the stronger dollar). */
    spotStart: 0.82,
    /** Playback tour of the roll-date spot: waypoints and total duration. */
    tour: { waypoints: [0.82, 0.75, 0.85, 0.82] as number[], ms: 7200 },
    /** y axis of the rate chart. */
    yDomain: [0.73, 0.87] as [number, number],
  },

  /**
   * (d) SwapCompare, section 4: FX swap versus cross-currency swap (CCS) for a Swiss firm that
   * holds CHF and needs USD 1 Mio. Simplified CCS: fixed-for-fixed, coupons at the example's
   * money-market rates, annual periods of 365 days Act/360 (a tenor under a year has one
   * period), re-exchange at the initial spot, no cross-currency basis. The FX swap of the
   * same tenor compounds the money-market factors period by period, so both price the same
   * interest differential.
   */
  compare: {
    /** Choice: tenors offered in the figure. */
    tenors: [
      { id: '3M', days: 90 },
      { id: '1Y', days: 365 },
      { id: '2Y', days: 730 },
      { id: '5Y', days: 1825 },
      { id: '10Y', days: 3650 },
    ] as Tenor[],
    defaultTenor: '5Y',
    /** Days of one CCS coupon period (annual). */
    periodDays: 365,
    /** Choice: FX swaps longer than this are flagged as unusual in the figure. */
    fxSwapTypicalMaxDays: 365,
  },
} as const;

/** Looks up a tenor by id; throws if it is not configured (catches typos in tests). */
export function tenorById(list: readonly Tenor[], id: string): Tenor {
  const t = list.find((x) => x.id === id);
  if (!t) throw new Error(`m03: tenor ${id} is not configured`);
  return t;
}
