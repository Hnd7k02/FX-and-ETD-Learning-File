/**
 * Module 01, section 3: market, limit and stop-loss orders, including gap risk.
 *
 * The importer has to BUY USD 1 Mio. within two weeks. A buy order is filled on the ask.
 * - Market: filled at once at the current ask. Execution certain, price not.
 * - Limit (below the market): filled when the ask falls to the limit, at the limit or better.
 *   Price certain, execution not. If the market never gets there, he buys at the end.
 * - Stop-loss (buy stop above the market): when the ask reaches the stop it becomes a market
 *   order. In a continuous market it fills at about the stop; after a gap (the market jumps
 *   over the weekend) it fills at the first price after the gap, far worse than the stop.
 *
 * The two price paths are SCHEMATIC and deterministic (no market data): ten trading days of
 * six points each, Monday to Friday twice, with the weekend between index 29 and 30.
 */
import { EXAMPLE } from '@/lib/fx/example';

export type OrderType = 'market' | 'limit' | 'stop';
export type PathScenario = 'calm' | 'gap';

export const ORDER_TYPES: readonly OrderType[] = ['market', 'limit', 'stop'];

/** One config object for the order demo (D-22). Levels and paths are teaching values. */
export const ORDER_DEMO = {
  notional: EXAMPLE.notional,
  /** Half the spread in pips; buy orders deal on mid + half spread. */
  halfSpreadPips: 2,
  days: 10,
  perDay: 6,
  /** First index after the weekend. */
  weekendAt: 30,
  /** Default levels and slider ranges (USD/CHF). */
  limit: { level: 0.795, min: 0.785, max: 0.7995 },
  stop: { level: 0.81, min: 0.8025, max: 0.82 },
  step: 0.0005,
  /** Key points [index, mid] of the paths; the wiggle vanishes at each key point. */
  keys: {
    calm: [
      [0, 0.8],
      [9, 0.7972],
      [19, 0.7942],
      [29, 0.8016],
      [30, 0.8019],
      [44, 0.8062],
      [52, 0.8114],
      [59, 0.8088],
    ],
    gap: [
      [0, 0.8],
      [11, 0.8024],
      [21, 0.8041],
      [29, 0.8072],
      [30, 0.8238],
      [41, 0.8216],
      [50, 0.8252],
      [59, 0.8236],
    ],
  } as Record<PathScenario, Array<[number, number]>>,
  /** Amplitude of the deterministic wiggle between key points (price units). */
  wiggle: 0.0022,
} as const;

const PIP = 1e-4;

/** Deterministic pseudo-noise in [−0.5, 0.5] (hash of the index). */
function hashNoise(i: number, seed: number): number {
  const x = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453;
  return x - Math.floor(x) - 0.5;
}

export interface PricePath {
  scenario: PathScenario;
  mid: number[];
  ask: number[];
  /** First index after a price gap, or null if trading was continuous. */
  gapAt: number | null;
}

/** Builds a schematic path: key points, linear in between, plus a wiggle that is 0 at the keys. */
export function buildPath(scenario: PathScenario, cfg = ORDER_DEMO): PricePath {
  const keys = cfg.keys[scenario];
  const n = cfg.days * cfg.perDay;
  const seed = scenario === 'calm' ? 1 : 2;
  const mid: number[] = [];
  for (let i = 0; i < n; i++) {
    let k = 0;
    while (k < keys.length - 2 && keys[k + 1]![0] <= i) k++;
    const [i0, v0] = keys[k]!;
    const [i1, v1] = keys[k + 1]!;
    const f = i1 === i0 ? 0 : Math.min(1, Math.max(0, (i - i0) / (i1 - i0)));
    const smooth = (hashNoise(i, seed) + hashNoise(i + 1, seed) + hashNoise(i - 1, seed)) / 1.5;
    const taper = Math.sin(Math.PI * f);
    mid.push(Math.round((v0 + (v1 - v0) * f + cfg.wiggle * smooth * taper) / 1e-5) * 1e-5);
  }
  const ask = mid.map((m) => Math.round((m + cfg.halfSpreadPips * PIP) / 1e-6) * 1e-6);
  const jump = Math.abs(mid[cfg.weekendAt]! - mid[cfg.weekendAt - 1]!) / PIP;
  return { scenario, mid, ask, gapAt: jump > 20 ? cfg.weekendAt : null };
}

export interface Fill {
  type: OrderType;
  level: number | null;
  /** True if the order itself was executed (false: he buys at the end at the market). */
  filled: boolean;
  /** Index of execution (the last index if not filled). */
  index: number;
  /** Execution price (ask). */
  price: number;
  /** Execution minus level in pips (+ = worse for a buyer); 0 for market orders. */
  slippagePips: number;
  /** True if the execution happened across a price gap. */
  viaGap: boolean;
  /** CHF paid for the notional. */
  costChf: number;
}

/**
 * Executes a BUY order on the ask path.
 * - Limit at L: first index with ask ≤ L. Already marketable at index 0 → ask[0]. Reached in
 *   continuous trading → exactly L. Reached across the gap → ask after the gap (better than L).
 * - Stop at L: first index with ask ≥ L. Already triggered at index 0 → ask[0]. Reached in
 *   continuous trading → L. Reached across the gap → ask after the gap (worse than L).
 * - Not reached: filled = false, the importer buys at the last ask.
 */
export function fillBuy(
  path: PricePath,
  type: OrderType,
  level: number | null,
  notional: number = ORDER_DEMO.notional,
): Fill {
  const { ask, gapAt } = path;
  const last = ask.length - 1;
  const done = (filled: boolean, index: number, price: number, viaGap: boolean): Fill => ({
    type,
    level: type === 'market' ? null : level,
    filled,
    index,
    price,
    slippagePips: !filled || type === 'market' || level === null ? 0 : (price - level) / PIP,
    viaGap,
    costChf: price * notional,
  });
  if (type === 'market' || level === null) return done(true, 0, ask[0]!, false);
  const hit = (a: number) => (type === 'limit' ? a <= level + 1e-12 : a >= level - 1e-12);
  for (let i = 0; i <= last; i++) {
    if (!hit(ask[i]!)) continue;
    if (i === 0) return done(true, 0, ask[0]!, false);
    const viaGap = gapAt === i;
    return done(true, i, viaGap ? ask[i]! : level, viaGap);
  }
  return done(false, last, ask[last]!, false);
}
