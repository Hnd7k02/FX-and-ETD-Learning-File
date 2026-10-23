/**
 * Module 02 (Forward): every parameter of the four figures and of the module texts in ONE
 * documented object (DECISIONS D-22). Change a value here and the figures, the numbers in the
 * texts (src/lib/nums/m02.ts) and the quiz (src/content/quiz/02-forward.ts) follow.
 *
 * Market inputs come from the running example (src/lib/fx/example.ts, "Beispielwerte, keine
 * Marktdaten"): USD/CHF spot 0.8000, CHF rate (quote, rd) 0 %, USD rate (base, rf) 3.5 %,
 * 3 months = 90 days Act/360 in the money market, USD 1 Mio.
 * Entries marked "choice" are teaching choices Dario may want to change.
 */
import { EXAMPLE } from '@/lib/fx/example';
import { basisOf } from '@/lib/fx/daycount';

/** Pip of USD/CHF. */
export const PIP = 1e-4;

/** A tenor of the forward curve (section 3). */
export interface Tenor {
  id: string;
  /** Calendar days, simplified (no holidays, no value-date rules). */
  days: number;
}

export const M02_CONFIG = {
  /** Running example (money-market view): spot, rates, days, notional, day-count bases. */
  market: {
    pair: EXAMPLE.pair,
    base: EXAMPLE.base,
    quote: EXAMPLE.quote,
    spot: EXAMPLE.spot,
    rd: EXAMPLE.rd,
    rf: EXAMPLE.rf,
    days: EXAMPLE.mmDays,
    T: EXAMPLE.T,
    notional: EXAMPLE.notional,
    months: EXAMPLE.months,
    basisQuote: basisOf(EXAMPLE.quote),
    basisBase: basisOf(EXAMPLE.base),
  },

  /**
   * Choice: the forward the importer actually deals (sections 1, 3, 4) is the money-market
   * forward S · (1 + rd · t) / (1 + rf · t), Act/360 — the way a forward desk prices it. The
   * continuous forward S · e^((rd − rf)T) of the option models (modules 04–07) appears in
   * section 2 as the comparison (difference ≈ 0.3 pips in the example).
   */
  dealConvention: 'moneyMarket' as 'moneyMarket' | 'continuous',

  /** Choice: forward outrights are shown with 5 decimals (forward points to 0.1 pip). */
  forwardDigits: 5,

  /** (a) HedgeOutcome, section 1. */
  hedge: {
    /** Range and step of the rate at expiry (slider and draggable handle). */
    stRange: [0.68, 0.92] as [number, number],
    stStep: 0.0005,
    /** Start value of the slider: the importer's fear, a strong dollar (choice). */
    stStart: 0.84,
    /** Teaching scenarios of the worked example: strong and weak dollar at expiry (choice). */
    stUp: 0.84,
    stDown: 0.76,
    /** y axis of the chart in CHF thousands. */
    yDomain: [670, 930] as [number, number],
    /**
     * Model scenarios of the "play" mode (choice): lognormal rates at expiry with the example
     * vol, centred on the forward (drift rd − rf, as in the Monte Carlo engine). Antithetic
     * pairs, shuffled, so the sample is balanced. Seed and count fix the default sample that
     * the text quotes.
     */
    scenarios: {
      count: 40,
      seed: 20261023,
      vol: EXAMPLE.vol,
      /** Time between two scenarios during playback. */
      msPerScenario: 150,
    },
  },

  /** (b) ParityPaths, section 2. */
  parity: {
    /** Slider ranges of the two rates (simple p.a.) and the days (choice). */
    rateRange: [-0.01, 0.06] as [number, number],
    rateStep: 0.0005,
    daysRange: [7, 365] as [number, number],
    daysStep: 1,
    /**
     * Playback: duration of each step in ms (choice). Order: A1 forward agreed, B1 borrow CHF,
     * B2 buy USD spot, B3 invest USD, time passes, B4 USD deposit matures, B5 repay CHF loan,
     * A2 settle the forward, result.
     */
    stepMs: [1300, 1300, 1300, 1300, 2200, 1200, 1200, 1300, 1600],
  },

  /** (c) ForwardCurve, section 3. */
  curve: {
    /** Tenors with simplified calendar days (choice; 3M = the example's 90 days). */
    tenors: [
      { id: '1W', days: 7 },
      { id: '1M', days: 30 },
      { id: '2M', days: 61 },
      { id: '3M', days: 90 },
      { id: '6M', days: 182 },
      { id: '9M', days: 273 },
      { id: '1Y', days: 365 },
    ] as Tenor[],
    /** Tenor selected at start. */
    defaultTenor: '3M',
    /** Slider ranges of the two rates (choice). */
    rateRange: [-0.01, 0.06] as [number, number],
    rateStep: 0.0005,
    /** What-if of the text: CHF rate raised to this level, USD rate unchanged (choice). */
    whatIfRd: 0.015,
  },

  /** (d) CashCarryCalculator, section 4. */
  arbitrage: {
    /** Start: market forward this many pips above the fair forward (choice). */
    mispricingPips: 10,
    /** Slider range around the fair forward, in pips. */
    rangePips: 50,
    /** Slider step in pips (0.1 pip = fifth decimal). */
    stepPips: 0.1,
    /** "Market reacts": time for the market forward to glide back to fair. */
    reactionMs: 1800,
  },
} as const;
