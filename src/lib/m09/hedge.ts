/**
 * HedgeCompare (module 09, section 2): the importer's toolbox on one axis. Pure, no DOM.
 *
 * The Swiss importer needs USD N at expiry. For a spot S_T at expiry, each strategy gives an
 * effective rate (CHF paid per USD needed, premium carried to expiry at rd):
 *
 *   unhedged   buy at S_T                                       → S_T
 *   forward    buy at F agreed today                             → F
 *   call       USD call / CHF put at K (ATMF), premium p         → min(S_T, K) + p · e^(rd T)
 *   collar     long USD call K_C + short USD put K_P, zero cost  → min(max(S_T, K_P), K_C)
 *   leveraged  one fixing of an accumulator / TARF: long call K_L on N + short put K_L on 2N,
 *              zero cost; below K_L the client buys 2N at K_L and sells the extra N at S_T
 *                                                               → K_L (S_T ≥ K_L), 2 K_L − S_T
 *
 * All five are written as option legs (src/lib/payoff.ts) and evaluated with effectiveRate of
 * module 06 (src/lib/hedge-shaper.ts), so the formulas above are a consequence, not a copy.
 * Convention: USD/CHF, rd = CHF (quote), rf = USD (base), T = days/365. Choices in M09_CONFIG.
 */
import { EXAMPLE_STRIKE } from '@/lib/fx/example';
import { effectiveCurve, effectiveRate } from '@/lib/hedge-shaper';
import {
  buildTemplate,
  marketForward,
  netPremium,
  solveZeroCostStrike,
  type Leg,
  type PayoffMarket,
} from '@/lib/payoff';
import { M09_CONFIG, M09_MARKET } from './config';

const H = M09_CONFIG.hedge;

export type HedgeId = 'unhedged' | 'forward' | 'call' | 'collar' | 'leveraged';

/** Strategies in legend order (simple → structured). */
export const HEDGE_IDS: readonly HedgeId[] = [
  'unhedged',
  'forward',
  'call',
  'collar',
  'leveraged',
];

export function isHedgeId(x: unknown): x is HedgeId {
  return typeof x === 'string' && (HEDGE_IDS as readonly string[]).includes(x);
}

/** Everything the comparison needs, solved once per market. Rates in CHF per USD. */
export interface HedgeSetup {
  market: PayoffMarket;
  /** Continuous forward F = S · e^((rd − rf) T). */
  forward: number;
  call: {
    strike: number;
    /** Premium per USD paid today. */
    premium: number;
    /** Premium carried to expiry, p · e^(rd T). */
    premiumAtExpiry: number;
    /** Worst rate with the call: K + p · e^(rd T). */
    cap: number;
  };
  collar: {
    callStrike: number;
    putStrike: number;
    /** Net premium per USD (≈ 0, zero cost). */
    premium: number;
  };
  leveraged: {
    strike: number;
    leverage: number;
    /** F − K_L: how much better than the forward, per USD. */
    better: number;
    /** Below 2 K_L − F the leveraged hedge costs more than the forward. */
    worseThanForwardBelow: number;
    /** Price of the second sold put at K_L (per USD); equals F − K_L when rd = 0. */
    secondPut: number;
  };
  legs: Record<HedgeId, Leg[]>;
}

/** Solves the strikes and premiums of the five strategies for a market. */
export function hedgeSetup(m: PayoffMarket = M09_MARKET): HedgeSetup {
  const N = m.notional;
  const F = marketForward(m);
  const K = H.callStrike === 'atmf' ? EXAMPLE_STRIKE : F;
  const callLegs: Leg[] = [{ side: 'long', kind: 'call', strike: K, notional: N }];
  const callPrem = netPremium(callLegs, m).quote / N;
  const growth = Math.exp(m.rd * m.T);
  const rr = buildTemplate('risk-reversal', m).legs;
  const lev: Leg[] = [
    { side: 'long', kind: 'call', strike: F, notional: N },
    { side: 'short', kind: 'put', strike: F, notional: H.leverage * N },
  ];
  const kl = solveZeroCostStrike(lev, [0, 1], m, [0.5 * m.S, F], F) ?? F;
  const levLegs = lev.map((l) => ({ ...l, strike: kl }));
  const secondPut = netPremium([{ side: 'long', kind: 'put', strike: kl, notional: N }], m).quote;
  return {
    market: m,
    forward: F,
    call: {
      strike: K,
      premium: callPrem,
      premiumAtExpiry: callPrem * growth,
      cap: K + callPrem * growth,
    },
    collar: {
      callStrike: rr[0]!.strike,
      putStrike: rr[1]!.strike,
      premium: netPremium(rr, m).quote / N,
    },
    leveraged: {
      strike: kl,
      leverage: H.leverage,
      better: F - kl,
      worseThanForwardBelow: 2 * kl - F,
      secondPut: (secondPut / N) * (H.leverage - 1),
    },
    legs: {
      unhedged: [],
      forward: [{ side: 'long', kind: 'forward', strike: F, notional: N }],
      call: callLegs,
      collar: rr,
      leveraged: levLegs,
    },
  };
}

/** Effective rate (CHF per USD needed) of a strategy at the spot S_T at expiry. */
export function hedgeRate(id: HedgeId, ST: number, s: HedgeSetup): number {
  return effectiveRate(s.legs[id], s.market, ST);
}

/** Effective rates of a strategy on a grid of S_T. */
export function hedgeCurve(id: HedgeId, xs: readonly number[], s: HedgeSetup): number[] {
  return effectiveCurve(s.legs[id], s.market, xs);
}

/** CHF paid for the USD notional at S_T, per strategy. */
export function hedgeCosts(ST: number, s: HedgeSetup): Record<HedgeId, number> {
  const N = s.market.notional;
  const out = {} as Record<HedgeId, number>;
  for (const id of HEDGE_IDS) out[id] = hedgeRate(id, ST, s) * N;
  return out;
}

/** Cheapest of the given strategies at S_T in hindsight (ties keep the legend order). */
export function cheapestAt(ST: number, ids: readonly HedgeId[], s: HedgeSetup): HedgeId | null {
  let best: HedgeId | null = null;
  let bestRate = Infinity;
  for (const id of HEDGE_IDS) {
    if (!ids.includes(id)) continue;
    const r = hedgeRate(id, ST, s);
    if (r < bestRate - 1e-12) {
      best = id;
      bestRate = r;
    }
  }
  return best;
}

/** Chart range of S_T: spot · (1 + xRange). */
export function hedgeRange(m: PayoffMarket = M09_MARKET): [number, number] {
  return [m.S * (1 + H.xRange[0]), m.S * (1 + H.xRange[1])];
}

/** S_T snapped to the 5-pip grid and clamped to the chart range. */
export function snapHedgeFixing(x: number, m: PayoffMarket = M09_MARKET): number {
  const [lo, hi] = hedgeRange(m);
  const snapped = Number((Math.round(x / H.fixingStep) * H.fixingStep).toFixed(6));
  return Math.min(hi, Math.max(lo, snapped));
}

/** The S_T shown first (the importer's fear: a stronger dollar). */
export function initialHedgeFixing(m: PayoffMarket = M09_MARKET): number {
  return snapHedgeFixing(m.S * (1 + H.initialMove), m);
}

/* ---------- events: levels where a strategy changes character ---------- */

export type HedgeEventId =
  | 'forward'
  | 'callStrike'
  | 'collarCap'
  | 'collarFloor'
  | 'levStrike'
  | 'levWorse';

export interface HedgeEvent {
  id: HedgeEventId;
  /** S_T at which it happens. */
  level: number;
  /** The strategy it belongs to (shown only while that strategy is visible). */
  strategy: HedgeId;
}

/** Events of the visible strategies, sorted by level (ascending). */
export function hedgeEvents(s: HedgeSetup, shown: readonly HedgeId[] = HEDGE_IDS): HedgeEvent[] {
  const all: HedgeEvent[] = [
    { id: 'forward', level: s.forward, strategy: 'forward' },
    { id: 'callStrike', level: s.call.strike, strategy: 'call' },
    { id: 'collarCap', level: s.collar.callStrike, strategy: 'collar' },
    { id: 'collarFloor', level: s.collar.putStrike, strategy: 'collar' },
    { id: 'levStrike', level: s.leveraged.strike, strategy: 'leveraged' },
    { id: 'levWorse', level: s.leveraged.worseThanForwardBelow, strategy: 'leveraged' },
  ];
  return all.filter((e) => shown.includes(e.strategy)).sort((a, b) => a.level - b.level);
}

/**
 * Events crossed when S_T moves from `prev` to `next`, in the order of travel. A level counts
 * as crossed when it lies in (prev, next] going up or [next, prev) going down.
 */
export function crossedEvents(prev: number, next: number, events: readonly HedgeEvent[]) {
  if (next === prev) return [];
  const up = next > prev;
  const hit = events.filter((e) =>
    up ? e.level > prev && e.level <= next : e.level < prev && e.level >= next,
  );
  return up ? hit : [...hit].reverse();
}

/** Absolute waypoints of the playback tour (spot · (1 + w)). */
export function tourWaypoints(m: PayoffMarket = M09_MARKET): number[] {
  return H.tour.waypoints.map((w) => m.S * (1 + w));
}

/** S_T on the tour at progress t ∈ [0, 1], at constant speed along the waypoints. */
export function tourPosition(t: number, waypoints: readonly number[] = tourWaypoints()): number {
  const pts = waypoints.length ? waypoints : [M09_MARKET.S];
  if (pts.length === 1) return pts[0]!;
  const legs = pts.slice(1).map((p, i) => Math.abs(p - pts[i]!));
  const total = legs.reduce((a, b) => a + b, 0);
  if (!(total > 0)) return pts[0]!;
  let d = Math.min(1, Math.max(0, t)) * total;
  for (let i = 0; i < legs.length; i++) {
    const len = legs[i]!;
    if (d <= len || i === legs.length - 1) {
      const k = len > 0 ? Math.min(1, d / len) : 1;
      return pts[i]! + (pts[i + 1]! - pts[i]!) * k;
    }
    d -= len;
  }
  return pts[pts.length - 1]!;
}

/**
 * Discrete stops of the tour for reduced motion: every event level in travel order plus the
 * waypoints, without repeats in a row.
 */
export function tourStops(
  events: readonly HedgeEvent[],
  waypoints: readonly number[] = tourWaypoints(),
): number[] {
  const out: number[] = [];
  const push = (x: number) => {
    if (!out.length || Math.abs(out[out.length - 1]! - x) > 1e-12) out.push(x);
  };
  if (waypoints.length) push(waypoints[0]!);
  for (let i = 1; i < waypoints.length; i++) {
    for (const e of crossedEvents(waypoints[i - 1]!, waypoints[i]!, events)) push(e.level);
    push(waypoints[i]!);
  }
  return out;
}
