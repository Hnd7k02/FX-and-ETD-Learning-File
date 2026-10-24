/**
 * Figure (b) SwapLegs, section 2: the two legs of an FX swap, its swap points and its cash
 * flows, plus the link to the forward points of module 02.
 *
 * Swap points = far − near (in pips) = forward points of the money-market forward:
 *   F − S = S · (rd · tq − rf · tb) / (1 + rf · tb)  ≈  S · (rd − rf) · t
 * The approximation drops the denominator (and assumes equal day counts).
 * Pure functions; rates in CHF per USD, amounts signed from the client's view (+ receive).
 */
import { forwardMoneyMarket, forwardPoints } from '@/lib/fx/forward';
import { fxSwap, type FxSwapResult, type SwapSide } from '@/lib/fx/swap';
import { M03_CONFIG, PIP } from './config';
import type { SwapMarket } from './trip';

/** Inputs of the legs view. */
export interface LegsInput extends SwapMarket {
  days: number;
  side: SwapSide;
}

/** One row of the cash-flow table. */
export interface LegRow {
  leg: 'near' | 'far';
  rate: number;
  base: number;
  quote: number;
}

/** View model of the swap legs. */
export interface LegsView {
  swap: FxSwapResult;
  rows: [LegRow, LegRow];
  /** Net amounts of both legs: base 0, quote = N · (F − S) for buy/sell. */
  net: { base: number; quote: number };
  /** Swap points in pips (far − near). */
  points: number;
  /** Forward points of the money-market forward of the same tenor (module 02): identical. */
  forwardPoints: number;
  /** Linear approximation S · (rd − rf) · days / 360 in pips. */
  approxPoints: number;
  /** Rate differential rd − rf (simple p.a.). */
  diff: number;
  /** 'discount' if far < near (base currency has the higher rate), 'premium', or 'flat'. */
  shape: 'discount' | 'premium' | 'flat';
  /** Interest on the base notional for the period, in base currency (simple). */
  baseInterest: number;
  /** Interest on the quote amount N · S for the period, in quote currency (simple). */
  quoteInterest: number;
}

/** Below this many pips the swap points count as zero ("flat"). */
const FLAT_PIPS = 0.05;

/** Computes both legs, the swap points and the cash-flow table for one swap. */
export function swapLegs(input: LegsInput): LegsView {
  const { spot: S, rd, rf, days, notional: N, side, base, quote } = input;
  const swap = fxSwap({
    S,
    rd,
    rf,
    days,
    notionalBase: N,
    side,
    quoteCcy: quote,
    baseCcy: base,
  });
  const bq = M03_CONFIG.market.basisQuote;
  const bb = M03_CONFIG.market.basisBase;
  const fwd = forwardMoneyMarket(S, rd, rf, days, bq, bb);
  const points = swap.swapPoints;
  const shape = Math.abs(points) < FLAT_PIPS ? 'flat' : points < 0 ? 'discount' : 'premium';
  return {
    swap,
    rows: [
      { leg: 'near', rate: swap.near.rate, base: swap.near.base, quote: swap.near.quote },
      { leg: 'far', rate: swap.far.rate, base: swap.far.base, quote: swap.far.quote },
    ],
    net: { base: swap.near.base + swap.far.base, quote: swap.netQuote },
    points,
    forwardPoints: forwardPoints(fwd, S, swap.pair),
    approxPoints: (S * (rd - rf) * days) / bq / PIP,
    diff: rd - rf,
    shape,
    baseInterest: (N * rf * days) / bb,
    quoteInterest: (N * S * rd * days) / bq,
  };
}

/** Snaps a rate slider value to its grid (avoids float noise such as 0.035000000004). */
export function snapRate(x: number, step: number = M03_CONFIG.legs.rateStep): number {
  const [lo, hi] = M03_CONFIG.legs.rateRange;
  const v = Math.round(x / step) * step;
  return Number(Math.min(hi, Math.max(lo, v)).toFixed(6));
}
