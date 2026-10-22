/**
 * One-touch and no-touch with continuous monitoring (Reiner-Rubinstein 1991, binary barrier
 * options in Haug, "The Complete Guide to Option Pricing Formulas").
 *
 * Convention: pair Base/Quote (e.g. USD/CHF), rd = quote-currency rate (domestic, CHF),
 * rf = base-currency rate (foreign, USD), continuous rates, cost of carry b = rd − rf,
 * T in years (days/365), vol as a decimal. The payout is a cash amount in quote currency;
 * values are in quote currency (per 1 unit of payout if payout = 1).
 *
 * - One-touch: pays if the spot touches H at any time before expiry, either at the moment
 *   of the hit ('hit') or at expiry ('expiry', the usual interbank FX convention).
 * - No-touch: pays at expiry if H was never touched.
 * Pay at expiry: one-touch + no-touch = payout · e^(−rd T).
 *
 * The same quantities are the rebate terms of barrier options (barrier.ts): knock-in
 * rebate = no-touch (Haug E), knock-out rebate = one-touch paid at hit (Haug F).
 */
import { normCdf } from '../normal';

export type BarrierDirection = 'up' | 'down';
export type TouchPayAt = 'hit' | 'expiry';

export interface NoTouchParams {
  /** Spot, quote currency per 1 unit base. */
  S: number;
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
  /** Cash amount in quote currency (default 1). */
  payout?: number;
  /** 'up' (H above spot) or 'down' (H below spot); default inferred from H vs S. */
  direction?: BarrierDirection;
}

export interface TouchParams extends NoTouchParams {
  /** When a one-touch pays: at the hit or at expiry (default 'expiry'). */
  payAt?: TouchPayAt;
}

/** Common quantities of the Reiner-Rubinstein formulas (Haug's notation). */
export interface HaugSetup {
  /** σ√T. */
  sd: number;
  /** μ = (b − σ²/2)/σ², drift of ln S in units of σ². */
  mu: number;
  /** λ² = μ² + 2·rd/σ² (negative only for some negative rates rd). */
  lambda2: number;
  /** e^(−rd T), quote-currency discount factor. */
  dfd: number;
  /** e^(−rf T) = e^((b − rd) T), base-currency discount factor. */
  dff: number;
}

/** μ, λ², σ√T and the two discount factors for T > 0, vol > 0. */
export function haugSetup(T: number, vol: number, rd: number, rf: number): HaugSetup {
  const v2 = vol * vol;
  const mu = (rd - rf - 0.5 * v2) / v2;
  return {
    sd: vol * Math.sqrt(T),
    mu,
    lambda2: mu * mu + (2 * rd) / v2,
    dfd: Math.exp(-rd * T),
    dff: Math.exp(-rf * T),
  };
}

/**
 * Time (years) at which the forward path S·e^(b t), b = rd − rf, reaches H, if that happens
 * within [0, T]; otherwise null. This is the spot path when vol = 0: t* = ln(H/S)/b.
 */
export function forwardPathHitTime(
  S: number,
  H: number,
  T: number,
  rd: number,
  rf: number,
): number | null {
  if (S === H) return 0;
  const b = rd - rf;
  if (b === 0) return null;
  const t = Math.log(H / S) / b;
  return t > 0 && t <= T ? t : null;
}

/** Throws RangeError unless every value is finite and > 0. */
export function assertPositive(fn: string, values: Record<string, number>): void {
  for (const [name, value] of Object.entries(values)) {
    if (!(value > 0 && Number.isFinite(value))) {
      throw new RangeError(`${fn}: ${name} must be a positive finite number, got ${value}`);
    }
  }
}

/** Barrier direction: the explicit one, else 'up' if H > S and 'down' if H ≤ S. */
export function barrierDirection(
  S: number,
  H: number,
  direction?: BarrierDirection,
): BarrierDirection {
  return direction ?? (H > S ? 'up' : 'down');
}

/**
 * ln N(x), also far in the left tail where N(x) underflows to 0 (x < −37): there the
 * asymptotic series ln N(x) ≈ −x²/2 − ln(−x) − ½ln(2π) + ln(1 − 1/x² + 3/x⁴ − 15/x⁶ + 105/x⁸).
 */
export function logNormCdf(x: number): number {
  if (x > -37) return Math.log(normCdf(x));
  const r = 1 / (x * x);
  const series = 1 - r * (1 - r * (3 - r * (15 - 105 * r)));
  return -0.5 * x * x - Math.log(-x) - 0.5 * Math.log(2 * Math.PI) + Math.log(series);
}

/**
 * ratio^power · N(x) without overflow. The reflection terms of barrier formulas multiply a
 * possibly huge weight such as (H/S)^(2μ) (low vol, large carry) by a tiny tail probability;
 * evaluated naively that is ∞ · 0 = NaN. In log space: exp(power · ln(ratio) + ln N(x)).
 */
export function powTimesCdf(ratio: number, power: number, x: number): number {
  const weight = ratio ** power;
  // Direct product while neither factor over- or underflows (N(x) = 0 only below −37).
  if (weight < 1e300 && x > -37) return weight * normCdf(x);
  return Math.exp(power * Math.log(ratio) + logNormCdf(x));
}

/**
 * Risk-neutral probability that ln S never reaches ln H before T (T > 0, vol > 0, spot on
 * the far side of the barrier). Reflection principle with drift ν = b − σ²/2 = μσ²:
 *   P = N(η(x2 − σ√T)) − (H/S)^(2μ) · N(η(y2 − σ√T)),
 *   x2 − σ√T = (ln(S/H) + νT)/σ√T,  y2 − σ√T = (ln(H/S) + νT)/σ√T,
 * η = +1 for a down barrier, −1 for an up barrier. Dimensionless.
 */
export function noTouchProbabilityRaw(
  S: number,
  H: number,
  T: number,
  vol: number,
  rd: number,
  rf: number,
  eta: 1 | -1,
): number {
  const { sd, mu } = haugSetup(T, vol, rd, rf);
  const x2m = Math.log(S / H) / sd + mu * sd; // Haug x2 − σ√T
  const y2m = Math.log(H / S) / sd + mu * sd; // Haug y2 − σ√T
  const p = normCdf(eta * x2m) - powTimesCdf(H / S, 2 * mu, eta * y2m);
  return Math.min(Math.max(p, 0), 1);
}

/**
 * Expected discount factor at the hit, E[e^(−rd τ) · 1{τ ≤ T}], τ = first time S reaches H
 * (T > 0, vol > 0, spot on the far side). Closed form (Haug term F per unit rebate):
 *   (H/S)^(μ+λ) N(ηz) + (H/S)^(μ−λ) N(ηz − 2ηλσ√T),  z = ln(H/S)/σ√T + λσ√T,
 *   λ = √(μ² + 2rd/σ²).
 * If λ² < 0 (possible with negative rd), integration by parts instead:
 *   e^(−rd T)·P(τ ≤ T) + rd · ∫₀ᵀ e^(−rd t)·P(τ ≤ t) dt (Simpson in √t, 400 steps).
 */
export function hitDiscountFactor(
  S: number,
  H: number,
  T: number,
  vol: number,
  rd: number,
  rf: number,
  eta: 1 | -1,
): number {
  const { sd, mu, lambda2 } = haugSetup(T, vol, rd, rf);
  if (lambda2 < 0) return hitDiscountFactorByQuadrature(S, H, T, vol, rd, rf, eta);
  const lambda = Math.sqrt(lambda2);
  const hs = H / S;
  const z = Math.log(hs) / sd + lambda * sd;
  return (
    powTimesCdf(hs, mu + lambda, eta * z) +
    powTimesCdf(hs, mu - lambda, eta * z - 2 * eta * lambda * sd)
  );
}

/**
 * E[e^(−rd τ) · 1{τ ≤ T}] by integration by parts and Simpson's rule (any sign of rd):
 *   e^(−rd T)·P(τ ≤ T) + rd · ∫₀ᵀ e^(−rd t)·P(τ ≤ t) dt, with P(τ ≤ t) = 1 − no-touch prob.
 * The integral runs in u = √t (dt = 2u du): P(τ ≤ t) rises steeply over t ≈ ln(H/S)²/σ², which
 * for a barrier close to the spot is a tiny part of [0, T]; in √t it is resolved with the same
 * number of steps (error ≈ 1e-15 instead of ≈ 1e-7 at 1 % from the barrier).
 * Used when the closed form needs an imaginary λ; exported to test it against the closed form.
 */
export function hitDiscountFactorByQuadrature(
  S: number,
  H: number,
  T: number,
  vol: number,
  rd: number,
  rf: number,
  eta: 1 | -1,
  steps = 400,
): number {
  const hitProb = (t: number): number =>
    t <= 0 ? 0 : 1 - noTouchProbabilityRaw(S, H, t, vol, rd, rf, eta);
  const f = (u: number): number => 2 * u * Math.exp(-rd * u * u) * hitProb(u * u);
  const n = steps % 2 === 0 ? steps : steps + 1;
  const sqrtT = Math.sqrt(T);
  const h = sqrtT / n;
  let integral = f(0) + f(sqrtT);
  for (let i = 1; i < n; i++) integral += (i % 2 === 1 ? 4 : 2) * f(i * h);
  integral *= h / 3;
  return Math.exp(-rd * T) * hitProb(T) + rd * integral;
}

/**
 * Risk-neutral probability (dimensionless) that the spot touches H before T. Already at or
 * beyond the barrier: 1. T ≤ 0: 0. vol ≤ 0: 1 if the forward path S·e^((rd − rf)t) reaches
 * H, else 0. Throws RangeError unless S, H > 0.
 */
export function touchProbability(p: Omit<NoTouchParams, 'payout'>): number {
  const { S, H, T, vol, rd, rf } = p;
  assertPositive('touchProbability', { S, H });
  const dir = barrierDirection(S, H, p.direction);
  if (dir === 'down' ? S <= H : S >= H) return 1;
  if (T <= 0) return 0;
  if (vol <= 0) return forwardPathHitTime(S, H, T, rd, rf) === null ? 0 : 1;
  return 1 - noTouchProbabilityRaw(S, H, T, vol, rd, rf, dir === 'down' ? 1 : -1);
}

/**
 * No-touch: pays `payout` (quote currency) at expiry if H is never touched.
 * Value = payout · e^(−rd T) · [N(η(x2 − σ√T)) − (H/S)^(2μ) N(η(y2 − σ√T))] (Haug B2 − B4
 * with φ = η). Touched already: 0. T ≤ 0: payout. vol ≤ 0: the forward path decides.
 * Throws RangeError unless S, H > 0.
 */
export function noTouch(p: NoTouchParams): number {
  const { S, H, T, vol, rd, rf, payout = 1 } = p;
  assertPositive('noTouch', { S, H });
  const dir = barrierDirection(S, H, p.direction);
  if (dir === 'down' ? S <= H : S >= H) return 0;
  if (T <= 0) return payout;
  const dfd = Math.exp(-rd * T);
  if (vol <= 0) return forwardPathHitTime(S, H, T, rd, rf) === null ? payout * dfd : 0;
  return payout * dfd * noTouchProbabilityRaw(S, H, T, vol, rd, rf, dir === 'down' ? 1 : -1);
}

/**
 * One-touch: pays `payout` (quote currency) if H is touched before T.
 * - payAt 'expiry' (default): payout · e^(−rd T) · [N(−η(x2 − σ√T)) + (H/S)^(2μ) N(η(y2 − σ√T))]
 *   (Haug B2 + B4 with φ = −η).
 * - payAt 'hit': payout · [(H/S)^(μ+λ) N(ηz) + (H/S)^(μ−λ) N(ηz − 2ηλσ√T)] (Haug A5).
 * Touched already: payout now ('hit') or payout · e^(−rd T) ('expiry'). T ≤ 0: 0.
 * vol ≤ 0: paid if the forward path reaches H (at t* or at T).
 * Throws RangeError unless S, H > 0.
 */
export function oneTouch(p: TouchParams): number {
  const { S, H, T, vol, rd, rf, payout = 1, payAt = 'expiry' } = p;
  assertPositive('oneTouch', { S, H });
  const dir = barrierDirection(S, H, p.direction);
  const dfd = Math.exp(-rd * Math.max(T, 0));
  if (dir === 'down' ? S <= H : S >= H) return payAt === 'hit' ? payout : payout * dfd;
  if (T <= 0) return 0;
  if (vol <= 0) {
    const tHit = forwardPathHitTime(S, H, T, rd, rf);
    if (tHit === null) return 0;
    return payAt === 'hit' ? payout * Math.exp(-rd * tHit) : payout * dfd;
  }
  const eta: 1 | -1 = dir === 'down' ? 1 : -1;
  if (payAt === 'hit') return payout * hitDiscountFactor(S, H, T, vol, rd, rf, eta);
  const { sd, mu } = haugSetup(T, vol, rd, rf);
  const x2m = Math.log(S / H) / sd + mu * sd;
  const y2m = Math.log(H / S) / sd + mu * sd;
  return payout * dfd * (normCdf(-eta * x2m) + powTimesCdf(H / S, 2 * mu, eta * y2m));
}
