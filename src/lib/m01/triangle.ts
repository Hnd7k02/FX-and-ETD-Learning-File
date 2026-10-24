/**
 * Module 01, section 3: triangular arbitrage EUR/USD × USD/CHF against EUR/CHF.
 *
 * The implied cross EUR/CHF = EUR/USD · USD/CHF. With two-way prices you always deal on the
 * worse side, so the cross has its own bid (bid · bid) and ask (ask · ask). Only when the direct
 * EUR/CHF quote lies completely outside [implied bid, implied ask] does the round trip earn
 * money. The maths is src/lib/fx/arbitrage.ts (triangularArbitrage); this file holds the
 * teaching setup and the helpers for the calculator figure.
 *
 * EUR/USD 1.1000 is a round teaching value (not market data); USD/CHF is the running example.
 */
import { triangularArbitrage, type TriangularResult } from '@/lib/fx/arbitrage';
import { EXAMPLE } from '@/lib/fx/example';

const PIP = 1e-4;

/** One config object for the calculator (D-22). Spreads in pips, schematic. */
export const TRI_CONFIG = {
  eurusd: 1.1,
  usdchf: EXAMPLE.spot,
  spreadPips: { eurusd: 2, usdchf: 2, eurchf: 4 },
  /** Slider ranges (rates). EUR/CHF is set relative to the implied cross in the figure. */
  ranges: {
    eurusd: [1.08, 1.12],
    usdchf: [0.78, 0.82],
    eurchf: [0.86, 0.9],
  } as Record<'eurusd' | 'usdchf' | 'eurchf', [number, number]>,
  step: 0.0001,
  /** Half-width of the zoomed EUR/CHF ruler around the implied cross, in pips. */
  rulerPips: 30,
  /** Worked example: the direct EUR/CHF mid this many pips above the implied cross. */
  examplePips: 10,
} as const;

export interface TriMids {
  eurusd: number;
  usdchf: number;
  eurchf: number;
}

export interface TriQuote {
  bid: number;
  ask: number;
}

/** Two-way quote around a mid with a spread in pips (spread 0 → bid = ask = mid). */
export function quoteAround(mid: number, spreadPips: number): TriQuote {
  const h = (spreadPips * PIP) / 2;
  return { bid: mid - h, ask: mid + h };
}

export interface TriState extends TriangularResult {
  quotes: { eurusd: TriQuote; usdchf: TriQuote; eurchf: TriQuote };
  /** Direct mid minus implied mid, in pips. */
  offsetPips: number;
  /** Inner band in which the direct mid can move without arbitrage, in pips around the implied mid. */
  noArbPips: [number, number];
}

/** Rounds to 6 decimals (quotes are on a 0.00005 grid; this only removes float noise). */
const r6 = (x: number): number => Math.round(x * 1e6) / 1e6;

/** Quotes, arbitrage result and the no-arbitrage band for the given mids. */
export function triState(m: TriMids, withSpread: boolean, cfg = TRI_CONFIG): TriState {
  const sp = withSpread ? cfg.spreadPips : { eurusd: 0, usdchf: 0, eurchf: 0 };
  const eurusd = quoteAround(m.eurusd, sp.eurusd);
  const usdchf = quoteAround(m.usdchf, sp.usdchf);
  const eurchf = quoteAround(m.eurchf, sp.eurchf);
  const res = triangularArbitrage({ eurusd, usdchf, eurchf });
  const halfDirect = sp.eurchf / 2;
  return {
    ...res,
    quotes: { eurusd, usdchf, eurchf },
    offsetPips: r6((m.eurchf - res.implied) / PIP),
    noArbPips: [
      r6((res.impliedBid - res.implied) / PIP - halfDirect),
      r6((res.impliedAsk - res.implied) / PIP + halfDirect),
    ],
  };
}

/** Direct EUR/CHF mid that sits `pips` away from the implied cross, on the pip grid. */
export function directAt(eurusd: number, usdchf: number, pips: number): number {
  return Math.round((eurusd * usdchf + pips * PIP) / PIP) * PIP;
}

/** Default mids of the calculator: consistent prices (no arbitrage). */
export function defaultMids(cfg = TRI_CONFIG): TriMids {
  return { eurusd: cfg.eurusd, usdchf: cfg.usdchf, eurchf: directAt(cfg.eurusd, cfg.usdchf, 0) };
}
