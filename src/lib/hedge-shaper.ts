/**
 * Hedge shaper (module 06, section 1): how combining options shapes the importer's cost and risk.
 * Pure functions, no DOM. Used by the HedgeShaper island and the module 06 number registry.
 *
 * The Swiss importer pays USD N at expiry. He starts with a long USD call (= CHF put) at the
 * spot and adds two optional building blocks:
 * - sell a USD call further up (call spread): cheaper, but the cap ends at the upper strike;
 * - sell a USD put below, strike solved for zero cost (collar; with both blocks: seagull).
 *
 * Effective rate (CHF paid per USD at expiry, premium carried to expiry at rd):
 *   rate(S_T) = S_T − payoff(S_T) / N + premium · e^(rd T) / N
 * Convention: pair USD/CHF, rd = CHF rate (quote, domestic), rf = USD rate (base, foreign),
 * T = days/365. Strikes come from the payoff builder templates (src/lib/payoff.ts), so the
 * seagull here is the same as the seagull template in section 3.
 */
import {
  kinks,
  netPremium,
  positionPayoff,
  solveZeroCostStrike,
  templateStrikes,
  type Leg,
  type PayoffMarket,
} from '@/lib/payoff';

export type ShaperId = 'call' | 'call-spread' | 'collar' | 'seagull';

export const SHAPER_IDS: readonly ShaperId[] = ['call', 'call-spread', 'collar', 'seagull'];

export interface ShaperBlocks {
  /** Sell a USD call above the bought call (caps the protection). */
  sellCall: boolean;
  /** Sell a USD put below, strike solved so that the net premium is zero. */
  sellPut: boolean;
}

/** Which structure the blocks form. */
export function shaperId(b: ShaperBlocks): ShaperId {
  if (b.sellCall && b.sellPut) return 'seagull';
  if (b.sellCall) return 'call-spread';
  if (b.sellPut) return 'collar';
  return 'call';
}

/** Blocks of a structure (inverse of shaperId). */
export function shaperBlocks(id: ShaperId): ShaperBlocks {
  return {
    sellCall: id === 'call-spread' || id === 'seagull',
    sellPut: id === 'collar' || id === 'seagull',
  };
}

export interface ShaperStrikes {
  /** Bought USD call: the spot on the 5-pip grid (the seagull template's lower strike). */
  call: number;
  /** Sold USD call: spot + 300 pips (the seagull template's upper strike). */
  sellCall: number;
}

/** Strikes of the building blocks (change them in templateStrikes, src/lib/payoff.ts). */
export function shaperStrikes(m: PayoffMarket): ShaperStrikes {
  const k = templateStrikes(m);
  return { call: k.seagullLow, sellCall: k.seagullHigh };
}

export interface ShaperPosition {
  id: ShaperId;
  legs: Leg[];
  /** Solved strike of the sold put (zero cost), or null without a sold put. */
  putStrike: number | null;
}

/** Search range for the zero-cost put strike (below the bought call). */
const PUT_RANGE = (m: PayoffMarket, kCall: number): [number, number] => [0.5 * m.S, kCall];

/** Legs of a structure; the sold put's strike is solved for zero net premium. */
export function shaperPosition(id: ShaperId, m: PayoffMarket): ShaperPosition {
  const k = shaperStrikes(m);
  const N = m.notional;
  const b = shaperBlocks(id);
  const legs: Leg[] = [{ side: 'long', kind: 'call', strike: k.call, notional: N }];
  if (b.sellCall) legs.push({ side: 'short', kind: 'call', strike: k.sellCall, notional: N });
  let putStrike: number | null = null;
  if (b.sellPut) {
    const put: Leg = { side: 'short', kind: 'put', strike: k.call, notional: N };
    legs.push(put);
    const i = legs.length - 1;
    putStrike = solveZeroCostStrike(legs, i, m, PUT_RANGE(m, k.call), k.call);
    if (putStrike === null) {
      legs.pop();
    } else {
      legs[i] = { ...put, strike: putStrike };
    }
  }
  return { id, legs, putStrike };
}

/** Premium per USD of the reference notional, carried to expiry (quote currency). */
function premiumAtExpiry(legs: readonly Leg[], m: PayoffMarket): number {
  return (netPremium(legs, m).quote / m.notional) * Math.exp(m.rd * m.T);
}

/**
 * Effective rate the importer pays per USD at expiry for S_T: market purchase minus the hedge
 * payoff plus the premium carried to expiry. Without legs it is S_T (unhedged).
 */
export function effectiveRate(legs: readonly Leg[], m: PayoffMarket, ST: number): number {
  return ST - positionPayoff(legs, ST) / m.notional + premiumAtExpiry(legs, m);
}

/** Effective rates on a grid of S_T (premium computed once). */
export function effectiveCurve(legs: readonly Leg[], m: PayoffMarket, xs: readonly number[]) {
  const p = premiumAtExpiry(legs, m);
  return xs.map((x) => x - positionPayoff(legs, x) / m.notional + p);
}

export interface ShaperFacts {
  id: ShaperId;
  /** Net premium in pips of the notional (> 0 pay, < 0 receive). */
  premiumPips: number;
  /** Net premium in quote currency (CHF) on the notional. */
  premiumQuote: number;
  zeroCost: boolean;
  /** Worst rate while the protection holds: the flat level from the bought call's strike. */
  capRate: number;
  /** Rate at expiry where the cap starts (the bought call's strike). */
  capFrom: number;
  /** Upper end of the protection (sold call strike), or null if the cap holds for any S_T. */
  protectionEndsAt: number | null;
  /** Above protectionEndsAt the importer pays S_T minus this amount per USD. */
  discountAbove: number | null;
  /** Best rate (floor) because of the sold put, or null if a falling dollar helps fully. */
  floorRate: number | null;
  /** Strike of the sold put, or null. */
  putStrike: number | null;
}

/** Key facts of a structure: premium, cap, end of protection, floor. */
export function shaperFacts(pos: ShaperPosition, m: PayoffMarket, pip = 1e-4): ShaperFacts {
  const prem = netPremium(pos.legs, m);
  const ks = kinks(pos.legs);
  const kCall = pos.legs[0]!.strike;
  const kMax = ks[ks.length - 1]!;
  const kMin = ks[0]!;
  const rate = (x: number) => effectiveRate(pos.legs, m, x);
  const h = 0.01;
  const slopeAbove = (rate(kMax + h) - rate(kMax)) / h;
  const slopeBelow = (rate(kMin) - rate(kMin - h)) / h;
  const capHolds = Math.abs(slopeAbove) < 1e-9;
  const flatBelow = Math.abs(slopeBelow) < 1e-9;
  return {
    id: pos.id,
    premiumPips: prem.pips,
    premiumQuote: prem.quote,
    zeroCost: Math.abs(prem.quote / m.notional / pip) < 0.05,
    capRate: rate(kCall),
    capFrom: kCall,
    protectionEndsAt: capHolds ? null : kMax,
    discountAbove: capHolds ? null : kMax - rate(kMax),
    floorRate: flatBelow ? rate(kMin) : null,
    putStrike: pos.putStrike,
  };
}

/** Segments where the structure is cheaper (benefit) or dearer (cost) than staying unhedged. */
export interface ShaperBand {
  from: number;
  to: number;
  kind: 'benefit' | 'cost';
}

/**
 * Splits [x0, x1] into bands where rate(S_T) < S_T (the hedge saves money) or > S_T (it costs
 * money compared to staying unhedged), using the grid xs (sorted). Crossings are interpolated.
 */
export function shaperBands(xs: readonly number[], rates: readonly number[]): ShaperBand[] {
  const out: ShaperBand[] = [];
  const diff = xs.map((x, i) => (rates[i] ?? x) - x);
  const kindOf = (d: number): ShaperBand['kind'] | null =>
    Math.abs(d) < 1e-12 ? null : d < 0 ? 'benefit' : 'cost';
  let start = xs[0]!;
  let kind = kindOf(diff[0]!);
  for (let i = 1; i < xs.length; i++) {
    const k = kindOf(diff[i]!);
    if (k !== kind) {
      const d0 = diff[i - 1]!;
      const d1 = diff[i]!;
      const cross = d1 !== d0 ? xs[i - 1]! - (d0 * (xs[i]! - xs[i - 1]!)) / (d1 - d0) : xs[i]!;
      if (kind) out.push({ from: start, to: cross, kind });
      start = cross;
      kind = k;
    }
  }
  if (kind) out.push({ from: start, to: xs[xs.length - 1]!, kind });
  return out.filter((b) => b.to - b.from > 1e-9);
}
