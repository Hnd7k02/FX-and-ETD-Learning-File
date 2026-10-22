/**
 * Figure (a) BarrierPaths and the faint paths of the TouchLab: a handful of seeded daily GBM
 * paths (src/lib/fx/mc rng + gbm) and the day each one first touches a barrier. Pure, no DOM.
 *
 * Paths are independent (no antithetic pairs, which would show mirror images on screen).
 * A barrier is observed once per day on the simulated fixings, as in the Monte Carlo engine.
 */
import { GbmPathSource } from '@/lib/fx/mc/gbm';
import type { Market } from '@/lib/fx/mc/products';
import { barrierPrice, isBarrierTouched, type BarrierKind } from '@/lib/fx/exotics/barrier';
import { touchProbability } from '@/lib/fx/exotics/touch';
import { gkPrice, type OptionType } from '@/lib/fx/vanilla';
import { M07_CONFIG } from './config';

export type Direction = 'up' | 'down';

/** Barrier direction from its level: above the spot = up, at or below = down. */
export function directionOf(spot: number, barrier: number): Direction {
  return barrier > spot ? 'up' : 'down';
}

/** True if the level s is at or beyond the barrier (up: s ≥ H, down: s ≤ H). */
export function beyond(s: number, barrier: number, dir: Direction): boolean {
  return dir === 'up' ? s >= barrier : s <= barrier;
}

/** First day d (0 … days) with path[d] at or beyond the barrier, or null if never. */
export function firstHit(path: ArrayLike<number>, barrier: number, dir: Direction): number | null {
  for (let d = 0; d < path.length; d++) {
    if (beyond(path[d]!, barrier, dir)) return d;
  }
  return null;
}

/** `count` independent daily GBM paths (copies), days + 1 points each, from one seed. */
export function seededPaths(market: Market, count: number, days: number, seed: number): number[][] {
  const src = new GbmPathSource(market, { paths: count, days, seed, antithetic: false });
  const out: number[][] = [];
  for (let p = src.next(); p !== undefined; p = src.next()) out.push(Array.from(p));
  return out;
}

/** Hit days of every path for one barrier (null = never touched). */
export function hitDays(
  paths: readonly number[][],
  barrier: number,
  dir: Direction,
): (number | null)[] {
  return paths.map((p) => firstHit(p, barrier, dir));
}

/**
 * Status of a path at the playback day `day` for a knock-out or knock-in:
 * 'alive' (counts), 'dead' (knocked out) or 'waiting' (knock-in not yet activated).
 */
export function pathStatus(
  hit: number | null,
  day: number,
  io: 'in' | 'out',
): 'alive' | 'dead' | 'waiting' {
  const touched = hit !== null && hit <= day;
  if (io === 'out') return touched ? 'dead' : 'alive';
  return touched ? 'alive' : 'waiting';
}

/** Market of the module (running example). */
export const M07_MARKET: Market = {
  spot: M07_CONFIG.market.spot,
  rd: M07_CONFIG.market.rd,
  rf: M07_CONFIG.market.rf,
  vol: M07_CONFIG.market.vol,
};

/**
 * Continuous barrier equivalent to a daily observed one (Broadie-Glasserman-Kou):
 * H · e^(±β σ √Δt), pushed away from the spot (up: higher, down: lower).
 */
export function dailyEquivalentBarrier(
  barrier: number,
  dir: Direction,
  vol: number,
  dt: number = M07_CONFIG.monitoring.dt,
): number {
  const shift = M07_CONFIG.monitoring.beta * vol * Math.sqrt(dt);
  return barrier * Math.exp(dir === 'up' ? shift : -shift);
}

/** BGK factor e^(β σ √Δt) (> 1). */
export function bgkFactor(vol: number, dt: number = M07_CONFIG.monitoring.dt): number {
  return Math.exp(M07_CONFIG.monitoring.beta * vol * Math.sqrt(dt));
}

/** Key numbers of the importer's barrier call for figure (a) and section 1. */
export interface PathsSummary {
  dir: Direction;
  kind: BarrierKind;
  /** Vanilla USD call (CHF per USD). */
  vanilla: number;
  /** The chosen barrier option (knock-out or knock-in), continuous monitoring. */
  price: number;
  /** 1 − price / vanilla. */
  discount: number;
  /** Model probability of a touch before expiry with daily observation (BGK). */
  touchProb: number;
}

/** Prices of the importer's call with a barrier (K = ATMF, T = 3 months). */
export function pathsSummary(
  barrier: number,
  io: 'in' | 'out',
  market: Market = M07_MARKET,
): PathsSummary {
  const { spot: S, rd, rf, vol } = market;
  const { T } = M07_CONFIG.market;
  const K = M07_CONFIG.strike;
  const type: OptionType = 'call';
  const dir = directionOf(S, barrier);
  const kind = `${dir}-and-${io}` as BarrierKind;
  const vanilla = gkPrice(S, K, T, vol, rd, rf, type);
  const price = barrierPrice({ S, K, H: barrier, T, vol, rd, rf, type, kind });
  const touchProb = isBarrierTouched(kind, S, barrier)
    ? 1
    : touchProbability({
        S,
        H: dailyEquivalentBarrier(barrier, dir, vol),
        T,
        vol,
        rd,
        rf,
        direction: dir,
      });
  return { dir, kind, vanilla, price, discount: vanilla > 0 ? 1 - price / vanilla : 0, touchProb };
}
