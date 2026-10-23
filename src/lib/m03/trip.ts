/**
 * Figure (a) SwapTrip, section 1: a firm holds CHF and needs USD for a while.
 *
 * With an FX swap it buys USD N at spot today (near leg) and sells them back at the forward F
 * after `days` (far leg). Both rates are fixed today, so the CHF it gets back is known:
 * N · F. The difference N · (F − S) is the price of borrowing USD against CHF for the period.
 * Without the swap (buy spot today, sell spot later) the result N · (S_T − S) depends on the
 * spot path. Pure functions; rates in CHF per USD, amounts in CHF unless noted.
 */
import { fxSwap, type FxSwapResult } from '@/lib/fx/swap';
import { Rng } from '@/lib/fx/mc/rng';
import { M03_CONFIG } from './config';

/** Market inputs of a swap (simple money-market rates). */
export interface SwapMarket {
  spot: number;
  rd: number;
  rf: number;
  notional: number;
  base: string;
  quote: string;
}

/** Market of the running example. */
export const EXAMPLE_MARKET: SwapMarket = {
  spot: M03_CONFIG.market.spot,
  rd: M03_CONFIG.market.rd,
  rf: M03_CONFIG.market.rf,
  notional: M03_CONFIG.market.notional,
  base: M03_CONFIG.market.base,
  quote: M03_CONFIG.market.quote,
};

/** The swap of the trip: buy USD near, sell them far. */
export interface TripSwap {
  swap: FxSwapResult;
  /** CHF paid today (positive amount). */
  nearChf: number;
  /** CHF received back at the far date (positive amount). */
  farChf: number;
  /** Price of the swap in CHF (positive = the firm gets back less CHF than it paid). */
  costChf: number;
  /** USD interest on the notional for the period (simple, base currency day count). */
  usdInterest: number;
  /** CHF interest on N · S for the period (what the CHF would have earned). */
  chfInterest: number;
}

/** Buy/sell swap on the base currency for `days` (the firm needs USD, holds CHF). */
export function tripSwap(m: SwapMarket, days: number): TripSwap {
  const swap = fxSwap({
    S: m.spot,
    rd: m.rd,
    rf: m.rf,
    days,
    notionalBase: m.notional,
    side: 'buySellBase',
    quoteCcy: m.quote,
    baseCcy: m.base,
  });
  const tb = days / M03_CONFIG.market.basisBase;
  const tq = days / M03_CONFIG.market.basisQuote;
  return {
    swap,
    nearChf: -swap.near.quote,
    farChf: swap.far.quote,
    costChf: -swap.netQuote,
    usdInterest: m.notional * m.rf * tb,
    chfInterest: m.notional * m.spot * m.rd * tq,
  };
}

/**
 * The open round trip without a swap: buy N at spot today, sell N at the spot `st` later.
 * Result in CHF: N · (st − S). Positive = gain.
 */
export function roundTripChf(m: SwapMarket, st: number): number {
  return m.notional * (st - m.spot);
}

/**
 * A model spot path with daily steps (Δt = 1/365), lognormal with drift rd − rf (simple rates
 * used as continuous; the difference is invisible on the chart). `days + 1` points, the first
 * is the spot. Reproducible from the seed (xoshiro128**, same as the Monte Carlo engine).
 */
export function spotPath(
  m: Pick<SwapMarket, 'spot' | 'rd' | 'rf'>,
  vol: number,
  days: number,
  seed: number,
): number[] {
  const rng = new Rng(seed);
  const dt = 1 / 365;
  const drift = (m.rd - m.rf - 0.5 * vol * vol) * dt;
  const diff = vol * Math.sqrt(dt);
  const out = [m.spot];
  let s = m.spot;
  for (let i = 0; i < days; i++) {
    s *= Math.exp(drift + diff * rng.normal());
    out.push(s);
  }
  return out;
}

/** Spot at a fractional day `pos` of a path (linear between days, clamped to the ends). */
export function pathAt(path: readonly number[], pos: number): number {
  const last = path.length - 1;
  if (last < 0) return Number.NaN;
  if (pos <= 0) return path[0]!;
  if (pos >= last) return path[last]!;
  const i = Math.floor(pos);
  const k = pos - i;
  return path[i]! + (path[i + 1]! - path[i]!) * k;
}

/** The locked swap rate line from (0, S) to (days, F): the rate fixed for each date. */
export function swapLineAt(near: number, far: number, days: number, day: number): number {
  if (days <= 0) return near;
  const k = Math.max(0, Math.min(1, day / days));
  return near + (far - near) * k;
}
