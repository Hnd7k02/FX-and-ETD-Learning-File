/**
 * Module 07 (Barrier & Binary): every parameter of the four figures and of the module texts in
 * ONE documented object (DECISIONS D-22). Change a value here and the figures, the numbers in
 * the texts (src/lib/nums/m07.ts) and the quiz follow.
 *
 * Market inputs come from the running example (src/lib/fx/example.ts, "Beispielwerte, keine
 * Marktdaten"); barrier levels reuse the factors of the Monte Carlo products (MC_CONFIG), so the
 * window barrier and the double no-touch of section 4/3 match the precomputed values.
 * Entries marked "choice" are teaching choices Dario may want to change.
 */
import { EXAMPLE, EXAMPLE_STRIKE } from '@/lib/fx/example';
import { MC_CONFIG } from '@/lib/fx/mc/products';
import type { OptionType } from '@/lib/fx/vanilla';

/** Pip of USD/CHF and EUR/CHF. */
export const PIP = 1e-4;

/** Round to the 0.0005 grid of the sliders (and drop binary noise). */
export function onGrid(x: number, step = 0.0005): number {
  return Number((Math.round(x / step) * step).toFixed(6));
}

const S = EXAMPLE.spot;
const WINDOW = MC_CONFIG.products.windowBarrier;
const DNT = MC_CONFIG.products.doubleNoTouch;

export const M07_CONFIG = {
  /** Running example: USD/CHF spot, rates, vol, 3 months (T = 0.25), USD 1 Mio. */
  market: {
    spot: S,
    rd: EXAMPLE.rd,
    rf: EXAMPLE.rf,
    vol: EXAMPLE.vol,
    T: EXAMPLE.T,
    notional: EXAMPLE.notional,
  },
  /** The importer's USD call / CHF put: strike ATMF (0.7930). */
  strike: EXAMPLE_STRIKE,
  /**
   * The two barriers of the module texts. Up = spot · 1.03 (0.8240), the factor of the window
   * barrier in MC_CONFIG, so sections 1, 2 and 4 talk about the same level; down = mirrored,
   * spot · 0.97 (0.7760). Choice.
   */
  barriers: {
    up: onGrid(S * WINDOW.barrierFactor),
    down: onGrid(S * (2 - WINDOW.barrierFactor)),
  },
  /** Rebate example of section 2, in pips per USD (choice). */
  rebatePips: 20,
  /**
   * Loss scenario of section 1 (choice): USD/CHF ends 60 pips above the up barrier, so the
   * up-and-out call is gone and the importer pays the market rate.
   */
  lossSpotPips: 60,
  /** Spot "close to the barrier" for the delta example of section 2 (choice: 40 pips below). */
  nearBarrierPips: 40,
  /**
   * Discrete monitoring: one observation per day (Δt = 1/365) and the Broadie-Glasserman-Kou
   * constant β = 0.5826 of the Monte Carlo engine.
   */
  monitoring: {
    dt: MC_CONFIG.conventions.dt,
    beta: MC_CONFIG.engine.bgkBeta,
  },

  /** Figure (a) BarrierPaths, section 1. */
  paths: {
    /** Paths on screen (choice: few enough to follow each one, same on every screen). */
    count: 10,
    /** Daily steps over 3 months (91 days ≈ T = 0.25; integer days for daily steps). */
    days: 91,
    /** First seed; "Neue Pfade" adds 1 (choice: seed 7 shows hits on both sides). */
    seed: 7,
    /** Playback speed: milliseconds per simulated day (91 days ≈ 3.6 s). */
    msPerDay: 40,
    /** Barrier slider range and step (USD/CHF). */
    barrier: { min: 0.76, max: 0.84, step: 0.0005 },
    /** Fixed y-axis around the spot (USD/CHF); paths outside are clipped. */
    yDomain: [0.735, 0.865] as [number, number],
  },

  /** Figure (b) BarrierLab, section 2. */
  lab: {
    defaults: {
      type: 'call' as OptionType,
      dir: 'up' as 'up' | 'down',
      io: 'out' as 'in' | 'out',
      strike: EXAMPLE_STRIKE,
      barrier: onGrid(S * WINDOW.barrierFactor),
      rebatePips: 0,
      spot: S,
      weeks: 13,
      monitoring: 'continuous' as 'continuous' | 'daily',
    },
    ranges: {
      strike: { min: 0.76, max: 0.84, step: 0.0005 },
      barrier: { min: 0.74, max: 0.86, step: 0.0005 },
      rebatePips: { min: 0, max: 100, step: 5 },
      spot: { min: 0.74, max: 0.86, step: 0.0005 },
      weeks: { min: 1, max: 52, step: 1 },
    },
    /** x-axis of both charts (spot USD/CHF). */
    xDomain: [0.74, 0.86] as [number, number],
    /** Spot grid of the curves (pips between samples). */
    sampleStepPips: 5,
    /** Bump for the numeric delta and gamma (1 pip, as in the Greeks lab). */
    bumpPips: 1,
    /** The delta chart is clipped to this range so that one spike does not flatten the rest. */
    deltaClip: [-12, 3] as [number, number],
    /** Spot within this many pips of the barrier counts as "near" (annotation). */
    nearPips: 60,
  },

  /** Figure (c) TouchLab, section 3. Payout in CHF (quote currency). */
  touch: {
    payout: DNT.payout,
    days: 91,
    defaults: {
      mode: 'oneTouch' as TouchMode,
      strike: EXAMPLE_STRIKE,
      spreadPips: 50,
      barrier: onGrid(S * WINDOW.barrierFactor),
      lower: onGrid(S * DNT.lowerFactor),
      upper: onGrid(S * DNT.upperFactor),
      rdPct: EXAMPLE.rd * 100,
      volPct: EXAMPLE.vol * 100,
      payAt: 'expiry' as 'expiry' | 'hit',
    },
    ranges: {
      strike: { min: 0.76, max: 0.84, step: 0.0005 },
      spreadPips: { min: 2, max: 200, step: 2 },
      barrier: { min: 0.75, max: 0.85, step: 0.0005 },
      lower: { min: 0.74, max: 0.799, step: 0.0005 },
      upper: { min: 0.801, max: 0.86, step: 0.0005 },
      rdPct: { min: -1, max: 4, step: 0.25 },
      volPct: { min: 2, max: 16, step: 0.5 },
    },
    /** Minimum distance of a barrier from the spot (pips) so a touch is not certain. */
    minGapPips: 10,
    /** x-axis of the "price vs level" chart (USD/CHF) and the vol axis of the DNT chart (%). */
    levelDomain: [0.75, 0.85] as [number, number],
    volDomain: [2, 16] as [number, number],
    /**
     * Faint sample paths in the path view (seeded, as in section 1). Choice: seed 80, whose
     * counts at the defaults (one-touch 5 of 12, DNT 4 of 12) sit close to the model.
     */
    samplePaths: 12,
    seed: 80,
    /** Example of section 3: one-touch paid at hit vs at expiry with a CHF rate of 1 %. */
    rdExample: 0.01,
    /** Example of section 3: call-spread width for the digital (pips). */
    spreadExamplePips: 50,
    /** DNT vol example (section 3): ±2 vol points around the example vol. */
    volBumpPct: 2,
  },

  /** Figure (d) GapReplay, section 4: the franc shock in ECB reference rates. */
  gap: {
    pair: 'EUR/CHF' as const,
    /** Window of daily ECB fixings shown (ISO dates, inclusive). */
    from: '2014-12-01',
    to: '2015-02-27',
    /** The SNB decision day (fact m07-floor-end, source snb-2015-01-15). */
    shockDate: '2015-01-15',
    /**
     * Hypothetical orders (choice, not market data): a stop-loss that sells EUR below the floor,
     * and a EUR put / CHF call with strike 1.2000 and four alternative down-and-out barriers
     * (reverse knock-outs: the barrier is in the money). Notional EUR 1 Mio.
     */
    stop: 1.195,
    putStrike: 1.2,
    knockOuts: [1.18, 1.15, 1.1, 1.05],
    notional: 1_000_000,
    /**
     * Fill rule (choice): an order is triggered by the first fixing at or below its level and
     * filled at that fixing, the next price this series knows. In the market a stop is filled
     * at the next tradable price; the ECB series shows one fixing per day only.
     */
    msPerDay: 140,
    yDomain: [0.96, 1.24] as [number, number],
    /** Riskometer deep link (contract with the Riskometer page: ?event=<id>&pair=<pair>). */
    riskometerEvent: 'chf-shock-2015',
  },

  /** Section 4: the window barrier of the Monte Carlo engine (precomputed, 1 Mio. paths). */
  window: {
    startDay: WINDOW.windowStartDay,
    endDay: WINDOW.windowEndDay,
    expiryDay: WINDOW.expiryDay,
  },
} as const;

export type TouchMode = 'digital' | 'oneTouch' | 'noTouch' | 'dnt';

/** Chart layout with a 1:1 viewBox (labels stay at 12 px on every screen). */
export interface ChartLayout {
  width: number;
  height: number;
  compact: boolean;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * Layout for a measured width: height = width · ratio, at least `min`; compact under 480 px
 * (fewer ticks, smaller left margin).
 */
export function chartLayout(width: number, ratio: number, min: number): ChartLayout {
  const w = Math.max(260, Math.round(width));
  const compact = w < 480;
  return {
    width: w,
    height: Math.max(min, Math.round(w * ratio)),
    compact,
    left: compact ? 46 : 54,
    right: compact ? 12 : 16,
    top: 14,
    bottom: 34,
  };
}
