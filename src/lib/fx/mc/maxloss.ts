/**
 * Theoretical maximum loss of the zero-cost structured products (modules 08 and 09), from the
 * product parameters alone: no simulation, no market data. Pure, no DOM.
 *
 * USD/CHF cannot fall below zero. A product that buys dollars with leverage below a strike, or
 * pays twice the distance below it, therefore has a finite worst case: every fixing at S = 0.
 * Then nothing ends the product early (no knock-out below the strike, no gain towards the
 * target, no coupon), and every fixing loses the leveraged amount times the strike:
 *
 *   down = fixings × leverage × N × K_down
 *
 * K_down is the strike at which the accumulator and the TARF buy, the lower strike K1 of the
 * pivot TARF, the TPF strike or the lower edge L of the RTPF range.
 *
 * Upwards the rate has no limit. A product that has to SELL dollars with leverage above a level
 * (decumulator above K, pivot TARF above K2 at K2) or pays twice the distance above it (RTPF
 * above U: two short calls) loses linearly without bound. On a path with every fixing at
 * S > K_up:
 *
 *   loss(S) = fixings × leverage × N × (S − K_up)   → ∞ as S → ∞
 *
 * Three terms for the texts and the product matrix (src/lib/matrix.ts): every one of these
 * products has "no built-in stop" on the loss; the loss is "very high, but finite" when only
 * the down side loses (accumulator, TARF, TPF) and "theoretically unlimited" when the product
 * sells with leverage above a level (decumulator; pivot TARF and RTPF upwards).
 *
 * Amounts in CHF against the market, as the kernels' pnlQuote (undiscounted), loss > 0.
 */
import type { ProductOf, ZeroCostKind } from './products';

/** A product whose strike, coupon or pivot width was solved for zero cost (§8.7). */
export type ZeroCostProduct = ProductOf<ZeroCostKind>;

/** 'finite': very high, but finite. 'unbounded': theoretically unlimited (upwards). */
export type MaxLossClass = 'finite' | 'unbounded';

/** Theoretical maximum loss of one product, in CHF against the market (loss > 0). */
export interface MaxLoss {
  /** Loss if every fixing is at S = 0 (0 if the product does not lose when the dollar falls). */
  down: number;
  /** Loss as the dollar rises: Infinity if the product loses with leverage above a level, else 0. */
  up: number;
  /** The theoretical maximum loss: max(down, up). */
  total: number;
  kind: MaxLossClass;
  /**
   * CHF lost per 1 CHF/USD beyond a loss level when every fixing is there:
   * fixings × leverage × N.
   */
  slope: number;
  /** Level below which the product loses with leverage, or null. */
  downLevel: number | null;
  /** Level above which the product loses with leverage, or null. */
  upLevel: number | null;
}

/** Levels beyond which a product loses with leverage (null: no loss on that side). */
export function lossLevels(p: ZeroCostProduct): { down: number | null; up: number | null } {
  switch (p.kind) {
    case 'accumulator':
      /* above the barrier it is knocked out, between strike and barrier it gains */
      return { down: p.strike, up: null };
    case 'decumulator':
      /* below the barrier it is knocked out, between barrier and strike it gains */
      return { down: null, up: p.strike };
    case 'tarf':
      return { down: p.strike, up: null };
    case 'pivotTarf':
      /* buys 2N at K1 below K1, sells 2N at K2 above K2 */
      return { down: p.lowerStrike, up: p.upperStrike };
    case 'tpf':
      return { down: p.strike, up: null };
    case 'rtpf':
      /* 2 × short put at L, 2 × short call at U */
      return { down: p.lower, up: p.upper };
  }
}

/**
 * Theoretical maximum loss of a zero-cost product from its parameters (fixings, leverage,
 * notional, strike or range): finite downwards (S ≥ 0), unlimited upwards if the product loses
 * with leverage above a level.
 */
export function maxLoss(p: ZeroCostProduct): MaxLoss {
  const slope = p.fixingDays.length * p.leverage * p.notional;
  const lv = lossLevels(p);
  const down = lv.down === null ? 0 : slope * lv.down;
  const up = lv.up === null ? 0 : Number.POSITIVE_INFINITY;
  return {
    down,
    up,
    total: Math.max(down, up),
    kind: lv.up === null ? 'finite' : 'unbounded',
    slope,
    downLevel: lv.down,
    upLevel: lv.up,
  };
}
