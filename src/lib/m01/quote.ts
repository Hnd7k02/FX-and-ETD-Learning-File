/**
 * Module 01, section 3: anatomy of a two-way price and what widens the spread.
 *
 * A market maker quotes bid (where he buys the base currency from you) and ask (where he sells
 * it to you) around a mid. The spread model is SCHEMATIC: a base spread for USD 1 Mio. in
 * liquid hours plus fixed add-ons per driver (teaching values, D-22), all in whole even pips so
 * bid and ask stay on the pip grid. Real spreads depend on the pair, the client and the moment.
 */
import { fmtRate, pipSize } from '@/lib/format';
import { EXAMPLE } from '@/lib/fx/example';

export type SpreadDriver = 'liquidity' | 'time' | 'size' | 'vol' | 'event';

export const SPREAD_DRIVERS: readonly SpreadDriver[] = [
  'liquidity',
  'time',
  'size',
  'vol',
  'event',
];

/** One config object for the spread demo (schematic teaching values). */
export const SPREAD_MODEL = {
  pair: EXAMPLE.pair,
  mid: EXAMPLE.spot,
  /** Spread in pips for USD 1 Mio. in liquid hours, calm market. */
  basePips: 4,
  /** Extra pips when a driver is switched on. */
  addPips: { liquidity: 4, time: 2, size: 2, vol: 4, event: 12 } as Record<SpreadDriver, number>,
} as const;

export type DriverState = Partial<Record<SpreadDriver, boolean>>;

/** Spread in pips for a set of active drivers. */
export function spreadPips(on: DriverState, model = SPREAD_MODEL): number {
  let s = model.basePips;
  for (const d of SPREAD_DRIVERS) if (on[d]) s += model.addPips[d];
  return s;
}

export interface TwoWayQuote {
  bid: number;
  ask: number;
  mid: number;
  spreadPips: number;
}

/** Bid and ask symmetric around the mid. */
export function twoWayQuote(mid: number, spread: number, pair: string = EXAMPLE.pair): TwoWayQuote {
  const half = (spread * pipSize(pair)) / 2;
  return { bid: mid - half, ask: mid + half, mid, spreadPips: spread };
}

/**
 * Splits a rate into big figure and pips as a dealing screen shows it:
 * 0.7998 → { big: "0.79", pips: "98" }; USD/JPY 145.23 → { big: "145.", pips: "23" }.
 */
export function quoteParts(
  rate: number,
  pair: string = EXAMPLE.pair,
): { big: string; pips: string } {
  const s = fmtRate(rate, pair);
  const cut = s.length - 2;
  return { big: s.slice(0, cut), pips: s.slice(cut) };
}

/**
 * What the spread costs a client on `notional` base units, in quote currency:
 * - "half": one trade against the mid (half the spread),
 * - "full": buying and selling straight back (the whole spread).
 */
export function spreadCost(
  spread: number,
  notional: number = EXAMPLE.notional,
  kind: 'half' | 'full' = 'half',
  pair: string = EXAMPLE.pair,
): number {
  const pips = kind === 'half' ? spread / 2 : spread;
  return pips * pipSize(pair) * notional;
}

/** Pip value in quote currency for `notional` base units (USD 1 Mio. → CHF 100). */
export function pipValue(notional: number = EXAMPLE.notional, pair: string = EXAMPLE.pair): number {
  return pipSize(pair) * notional;
}
