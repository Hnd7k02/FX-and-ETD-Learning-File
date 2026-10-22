/**
 * Single-barrier options with continuous monitoring: the eight types (down/up, in/out,
 * call/put) after Reiner and Rubinstein (1991), in the notation of Haug, "The Complete
 * Guide to Option Pricing Formulas" (terms A–F with η and φ).
 *
 * Convention: pair Base/Quote (e.g. USD/CHF), rd = quote-currency rate (domestic, CHF),
 * rf = base-currency rate (foreign, USD), continuous rates, cost of carry b = rd − rf,
 * T in years (days/365), vol as a decimal. Prices in quote currency per 1 unit base; the
 * rebate is a cash amount in quote currency per 1 unit base.
 *
 * Rebate timing (as in Haug): a knock-OUT pays its rebate at the moment the barrier is hit
 * (term F, a one-touch paid at hit); a knock-IN pays its rebate at expiry if the barrier was
 * never hit (term E, a no-touch paid at expiry).
 */
import { normCdf } from '../normal';
import { gkPrice, payoff, type OptionType } from '../vanilla';
import {
  assertPositive,
  forwardPathHitTime,
  haugSetup,
  hitDiscountFactor,
  noTouchProbabilityRaw,
} from './touch';

export type BarrierKind = 'down-and-out' | 'down-and-in' | 'up-and-out' | 'up-and-in';

export interface BarrierParams {
  /** Spot, quote currency per 1 unit base. */
  S: number;
  /** Strike. */
  K: number;
  /** Barrier level. */
  H: number;
  /** Time to expiry in years. */
  T: number;
  /** Volatility (decimal). */
  vol: number;
  /** Quote-currency (domestic) rate, continuous. */
  rd: number;
  /** Base-currency (foreign) rate, continuous. */
  rf: number;
  type: OptionType;
  kind: BarrierKind;
  /** Cash rebate in quote currency per 1 unit base (default 0); timing see module doc. */
  rebate?: number;
}

/** The six Haug terms, each in quote currency per 1 unit base. */
export interface HaugTerms {
  /** Vanilla with strike K: φ·S·e^(−rf T)·N(φx1) − φ·K·e^(−rd T)·N(φx1 − φσ√T). */
  A: number;
  /** As A, but the exercise probability measured at the barrier H (x2 instead of x1). */
  B: number;
  /** Mirror image of A (reflection principle): weights (H/S)^(2(μ+1)) and (H/S)^(2μ), y1. */
  C: number;
  /** Mirror image of B, with y2. */
  D: number;
  /** Knock-in rebate: paid at expiry if the barrier was never hit (no-touch). */
  E: number;
  /** Knock-out rebate: paid when the barrier is hit (one-touch at hit). */
  F: number;
}

/** How a barrier price was obtained, for a step-by-step view. */
export interface BarrierBreakdown {
  /** Price in quote currency per 1 unit base. */
  price: number;
  /**
   * 'formula': Haug terms (barrier not hit, T > 0, vol > 0) · 'touched': spot already at or
   * beyond the barrier · 'expired': T ≤ 0 · 'no-vol': vol ≤ 0, the spot follows the forward.
   */
  case: 'formula' | 'touched' | 'expired' | 'no-vol';
  /** Haug recipe such as 'A − C + F', or a short text for the special cases. */
  formula: string;
  /** All six terms (only for case 'formula'). */
  terms: HaugTerms | null;
  /** η = +1 for a down barrier, −1 for an up barrier. */
  eta: 1 | -1;
  /** φ = +1 for a call, −1 for a put. */
  phi: 1 | -1;
}

/**
 * Haug's recipe table: which terms make up each of the eight types, split by strike above
 * (K ≥ H) or below (K < H) the barrier. Both columns agree at K = H (then A = B, C = D).
 */
const RECIPES: Record<BarrierKind, Record<OptionType, { kAbove: string; kBelow: string }>> = {
  'down-and-in': {
    call: { kAbove: 'C + E', kBelow: 'A − B + D + E' },
    put: { kAbove: 'B − C + D + E', kBelow: 'A + E' },
  },
  'up-and-in': {
    call: { kAbove: 'A + E', kBelow: 'B − C + D + E' },
    put: { kAbove: 'A − B + D + E', kBelow: 'C + E' },
  },
  'down-and-out': {
    call: { kAbove: 'A − C + F', kBelow: 'B − D + F' },
    put: { kAbove: 'A − B + C − D + F', kBelow: 'F' },
  },
  'up-and-out': {
    call: { kAbove: 'F', kBelow: 'A − B + C − D + F' },
    put: { kAbove: 'B − D + F', kBelow: 'A − C + F' },
  },
};

/** True if the barrier is a down barrier (η = +1). */
function isDown(kind: BarrierKind): boolean {
  return kind.startsWith('down');
}

/** True for knock-out types. */
function isOut(kind: BarrierKind): boolean {
  return kind.endsWith('out');
}

/**
 * Reverse barrier: the barrier sits where the option is in the money, so it can knock
 * out (or in) while the option has intrinsic value — up barrier on a call with H > K, or
 * down barrier on a put with H < K. Example: up-and-out call with K = 0.80, H = 0.85.
 * These have large, sign-changing Greeks near the barrier.
 */
export function isReverse(kind: BarrierKind, type: OptionType, K: number, H: number): boolean {
  return type === 'call' ? !isDown(kind) && H > K : isDown(kind) && H < K;
}

/** True if the spot is already at or beyond the barrier (down: S ≤ H, up: S ≥ H). */
export function isBarrierTouched(kind: BarrierKind, S: number, H: number): boolean {
  return isDown(kind) ? S <= H : S >= H;
}

/**
 * The six Haug terms A–F for T > 0, vol > 0 (Reiner-Rubinstein, Haug ch. 4):
 *   x1 = ln(S/K)/σ√T + (1+μ)σ√T     x2 = ln(S/H)/σ√T + (1+μ)σ√T
 *   y1 = ln(H²/(S K))/σ√T + (1+μ)σ√T y2 = ln(H/S)/σ√T + (1+μ)σ√T
 *   z  = ln(H/S)/σ√T + λσ√T
 *   A = φS e^(−rf T) N(φx1) − φK e^(−rd T) N(φx1 − φσ√T)
 *   B = φS e^(−rf T) N(φx2) − φK e^(−rd T) N(φx2 − φσ√T)
 *   C = φS e^(−rf T) (H/S)^(2(μ+1)) N(ηy1) − φK e^(−rd T) (H/S)^(2μ) N(ηy1 − ησ√T)
 *   D = φS e^(−rf T) (H/S)^(2(μ+1)) N(ηy2) − φK e^(−rd T) (H/S)^(2μ) N(ηy2 − ησ√T)
 *   E = R e^(−rd T) [N(ηx2 − ησ√T) − (H/S)^(2μ) N(ηy2 − ησ√T)]
 *   F = R [(H/S)^(μ+λ) N(ηz) + (H/S)^(μ−λ) N(ηz − 2ηλσ√T)],  λ = √(μ² + 2rd/σ²)
 * with μ = (b − σ²/2)/σ², η = +1 (down) / −1 (up), φ = +1 (call) / −1 (put), R = rebate.
 */
export function haugTerms(
  S: number,
  K: number,
  H: number,
  T: number,
  vol: number,
  rd: number,
  rf: number,
  eta: 1 | -1,
  phi: 1 | -1,
  rebate = 0,
): HaugTerms {
  const { sd, mu, dfd, dff } = haugSetup(T, vol, rd, rf);
  const shift = (1 + mu) * sd;
  const x1 = Math.log(S / K) / sd + shift;
  const x2 = Math.log(S / H) / sd + shift;
  const y1 = Math.log((H * H) / (S * K)) / sd + shift;
  const y2 = Math.log(H / S) / sd + shift;
  const hs = H / S;
  const assetWeight = hs ** (2 * (mu + 1)); // reflection weight on the asset leg
  const cashWeight = hs ** (2 * mu); // reflection weight on the cash leg
  const N = normCdf;

  return {
    A: phi * S * dff * N(phi * x1) - phi * K * dfd * N(phi * x1 - phi * sd),
    B: phi * S * dff * N(phi * x2) - phi * K * dfd * N(phi * x2 - phi * sd),
    C:
      phi * S * dff * assetWeight * N(eta * y1) -
      phi * K * dfd * cashWeight * N(eta * y1 - eta * sd),
    D:
      phi * S * dff * assetWeight * N(eta * y2) -
      phi * K * dfd * cashWeight * N(eta * y2 - eta * sd),
    // E = rebate × no-touch paid at expiry (see touch.ts for the formula).
    E: rebate === 0 ? 0 : rebate * dfd * noTouchProbabilityRaw(S, H, T, vol, rd, rf, eta),
    // F = rebate × one-touch paid at hit (closed form, or quadrature if λ² < 0).
    F: rebate === 0 ? 0 : rebate * hitDiscountFactor(S, H, T, vol, rd, rf, eta),
  };
}

/** Evaluates a recipe such as 'A − B + D + E' with the given terms. */
function evaluateRecipe(recipe: string, terms: HaugTerms): number {
  let sum = 0;
  let sign = 1;
  for (const token of recipe.split(' ')) {
    if (token === '+') sign = 1;
    else if (token === '−') sign = -1;
    else sum += sign * terms[token as keyof HaugTerms];
  }
  return sum;
}

/**
 * Barrier price with the way it was obtained (case, Haug recipe, terms).
 * Special cases:
 * - touched (down: S ≤ H, up: S ≥ H): knock-out = rebate (paid now), knock-in = vanilla.
 * - expired (T ≤ 0): knock-out = payoff, knock-in = rebate (never knocked in).
 * - no-vol (vol ≤ 0): the spot follows the forward S·e^((rd − rf)t); the barrier is hit at
 *   t* = ln(H/S)/(rd − rf) or not at all.
 * Throws RangeError unless S, K, H > 0.
 */
export function barrierBreakdown(p: BarrierParams): BarrierBreakdown {
  const { S, K, H, T, vol, rd, rf, type, kind, rebate = 0 } = p;
  assertPositive('barrierPrice', { S, K, H });
  const eta: 1 | -1 = isDown(kind) ? 1 : -1;
  const phi: 1 | -1 = type === 'call' ? 1 : -1;
  const out = isOut(kind);
  const result = (price: number, c: BarrierBreakdown['case'], formula: string) => ({
    price,
    case: c,
    formula,
    terms: null,
    eta,
    phi,
  });

  if (isBarrierTouched(kind, S, H)) {
    return out
      ? result(rebate, 'touched', 'rebate (knocked out)')
      : result(gkPrice(S, K, T, vol, rd, rf, type), 'touched', 'vanilla (knocked in)');
  }
  if (T <= 0) {
    return out
      ? result(payoff(S, K, type), 'expired', 'payoff')
      : result(rebate, 'expired', 'rebate (never knocked in)');
  }
  if (vol <= 0) {
    const tHit = forwardPathHitTime(S, H, T, rd, rf);
    const vanilla = gkPrice(S, K, T, 0, rd, rf, type);
    if (tHit === null) {
      return out
        ? result(vanilla, 'no-vol', 'vanilla (forward path misses the barrier)')
        : result(rebate * Math.exp(-rd * T), 'no-vol', 'rebate at expiry (never knocked in)');
    }
    return out
      ? result(rebate * Math.exp(-rd * tHit), 'no-vol', 'rebate at hit (forward path)')
      : result(vanilla, 'no-vol', 'vanilla (forward path hits the barrier)');
  }

  const terms = haugTerms(S, K, H, T, vol, rd, rf, eta, phi, rebate);
  const recipes = RECIPES[kind][type];
  const formula = K >= H ? recipes.kAbove : recipes.kBelow;
  return { price: evaluateRecipe(formula, terms), case: 'formula', formula, terms, eta, phi };
}

/**
 * Price of a continuously monitored single-barrier option (Reiner-Rubinstein / Haug), in
 * quote currency per 1 unit base. In-out parity: knock-in + knock-out = vanilla (rebate 0).
 * See barrierBreakdown for special cases and errors.
 */
export function barrierPrice(p: BarrierParams): number {
  return barrierBreakdown(p).price;
}
