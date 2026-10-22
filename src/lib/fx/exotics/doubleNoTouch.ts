/**
 * Double no-touch (DNT) and double one-touch with continuous monitoring, by the eigenfunction
 * series of Hui (1996), as in Wystup, "FX Options and Structured Products".
 *
 * Convention: pair Base/Quote (e.g. USD/CHF), rd = quote-currency rate (domestic, CHF),
 * rf = base-currency rate (foreign, USD), continuous rates, b = rd − rf, T in years
 * (days/365), vol as a decimal. The payout is cash in quote currency, paid at expiry.
 *
 * Idea: in x = ln(S/L) the spot is a Brownian motion with drift on the corridor [0, Z],
 * Z = ln(U/L), killed when it reaches either end. The killed heat kernel is a sine series,
 * (2/Z)·Σ sin(iπx/Z)·sin(iπy/Z)·e^(−½(iπ/Z)²σ²T); integrating over y gives the price.
 * Each term decays like e^(−½(iπ/Z)²σ²T): long T or a narrow corridor need few terms,
 * a short T in a wide corridor needs many.
 *
 * Shortcut for that last case: if no path can realistically touch BOTH barriers, the two
 * barriers act independently and DNT = payout · e^(−rd T) · (1 − P(touch L) − P(touch U))
 * (inclusion–exclusion). The neglected term P(touch both) is bounded by
 * P(touch L)·P(L → U within T) + P(touch U)·P(U → L within T); the shortcut is used only when
 * that bound is below 1e-16.
 */
import { assertPositive, forwardPathHitTime, noTouchProbabilityRaw } from './touch';

export interface DoubleTouchParams {
  /** Spot, quote currency per 1 unit base. */
  S: number;
  /** Lower barrier. */
  L: number;
  /** Upper barrier (U > L). */
  U: number;
  /** Time to expiry in years. */
  T: number;
  /** Volatility (decimal). */
  vol: number;
  /** Quote-currency (domestic) rate, continuous. */
  rd: number;
  /** Base-currency (foreign) rate, continuous. */
  rf: number;
  /** Cash amount in quote currency, paid at expiry (default 1). */
  payout?: number;
  /**
   * Number of series terms; forces the series. Default: the inclusion–exclusion shortcut if
   * it is exact to 1e-16, else enough terms for the last one to be below 1e-17 relative,
   * n ≈ 8.9 · Z/(π σ√T), at least 50 and at most 20’000.
   */
  terms?: number;
}

/** Number of series terms for which e^(−½(nπ/Z)²σ²T) < e^(−39) (≈ 1e-17), in [50, 20’000]. */
export function dntDefaultTerms(Z: number, vol: number, T: number): number {
  const n = Math.ceil((Z / (Math.PI * vol * Math.sqrt(T))) * Math.sqrt(2 * 39));
  return Math.min(Math.max(n, 50), 20_000);
}

/**
 * Hui's series for the double no-touch (T > 0, vol > 0, L < S < U), in quote currency:
 *   α = −½(2b/σ² − 1),  β = −¼(2b/σ² − 1)² − 2rd/σ²,  Z = ln(U/L)
 *   DNT = payout · Σ_{i=1..n} (2πi/Z²) · [(S/L)^α − (−1)^i (S/U)^α] / [α² + (iπ/Z)²]
 *                  · sin(iπ/Z · ln(S/L)) · e^(−½[(iπ/Z)² − β]σ²T)
 * The factor e^(½βσ²T) contains the discounting e^(−rd T). Not clamped; doubleNoTouch
 * clamps to [0, payout · e^(−rd T)].
 */
export function dntSeries(
  S: number,
  L: number,
  U: number,
  T: number,
  vol: number,
  rd: number,
  rf: number,
  payout: number,
  terms: number,
): number {
  const v2 = vol * vol;
  const k = (2 * (rd - rf)) / v2 - 1;
  const alpha = -0.5 * k; // = −(b − σ²/2)/σ², minus the drift of ln S in units of σ²
  const beta = -0.25 * k * k - (2 * rd) / v2; // = −α² − 2rd/σ²
  const Z = Math.log(U / L);
  const x = Math.log(S / L); // position in the corridor, 0 < x < Z
  // (S/L)^α · e^(½βσ²T) and (S/U)^α · e^(½βσ²T), combined in the exponent so that a large α
  // (low vol, large carry) cannot overflow.
  const shared = 0.5 * beta * v2 * T;
  const fromL = Math.exp(alpha * x + shared);
  const fromU = Math.exp(alpha * (x - Z) + shared);
  let sum = 0;
  for (let i = 1; i <= terms; i++) {
    const w = (i * Math.PI) / Z; // wave number iπ/Z
    const sign = i % 2 === 0 ? 1 : -1; // (−1)^i
    sum +=
      ((2 * Math.PI * i) / (Z * Z)) *
      ((fromL - sign * fromU) / (alpha * alpha + w * w)) *
      Math.sin(w * x) *
      Math.exp(-0.5 * w * w * v2 * T);
  }
  return payout * sum;
}

/**
 * Risk-neutral probabilities for the inclusion–exclusion shortcut (T > 0, vol > 0,
 * L < S < U), all dimensionless: touch L, touch U, and the bound on touching both,
 * bothBound = P(touch L)·P(L → U) + P(touch U)·P(U → L) ≥ P(touch both).
 */
export function dntTouchProbabilities(
  S: number,
  L: number,
  U: number,
  T: number,
  vol: number,
  rd: number,
  rf: number,
): { touchL: number; touchU: number; bothBound: number } {
  const touchL = 1 - noTouchProbabilityRaw(S, L, T, vol, rd, rf, 1);
  const touchU = 1 - noTouchProbabilityRaw(S, U, T, vol, rd, rf, -1);
  const crossUp = 1 - noTouchProbabilityRaw(L, U, T, vol, rd, rf, -1);
  const crossDown = 1 - noTouchProbabilityRaw(U, L, T, vol, rd, rf, 1);
  return { touchL, touchU, bothBound: touchL * crossUp + touchU * crossDown };
}

/**
 * Double no-touch: pays `payout` (quote currency) at expiry if the spot stays strictly
 * inside (L, U) until T. Value from dntSeries (or, without an explicit `terms`, from the
 * inclusion–exclusion shortcut when touching both barriers is impossible to 1e-16, see the
 * module doc), clamped to [0, payout · e^(−rd T)].
 * Special cases: spot at or outside a barrier → 0; T ≤ 0 → payout; vol ≤ 0 → the forward
 * path S·e^((rd − rf)t) decides. Throws RangeError unless S, L, U > 0 and L < U.
 */
export function doubleNoTouch(p: DoubleTouchParams): number {
  const { S, L, U, T, vol, rd, rf, payout = 1 } = p;
  assertPositive('doubleNoTouch', { S, L, U });
  if (!(L < U)) throw new RangeError(`doubleNoTouch: needs L < U, got L = ${L}, U = ${U}`);
  if (S <= L || S >= U) return 0;
  if (T <= 0) return payout;
  const dfd = Math.exp(-rd * T);
  if (vol <= 0) {
    const hits =
      forwardPathHitTime(S, L, T, rd, rf) !== null || forwardPathHitTime(S, U, T, rd, rf) !== null;
    return hits ? 0 : payout * dfd;
  }
  const clamp = (v: number): number => Math.min(Math.max(v, 0), payout * dfd);
  if (p.terms === undefined) {
    const { touchL, touchU, bothBound } = dntTouchProbabilities(S, L, U, T, vol, rd, rf);
    const independent = payout * dfd * (1 - touchL - touchU);
    if (bothBound < 1e-16) return clamp(independent);
    const value = dntSeries(
      S,
      L,
      U,
      T,
      vol,
      rd,
      rf,
      payout,
      dntDefaultTerms(Math.log(U / L), vol, T),
    );
    // Extreme inputs (tiny vol with large carry) can make the series overflow.
    return clamp(Number.isFinite(value) ? value : independent);
  }
  return clamp(dntSeries(S, L, U, T, vol, rd, rf, payout, p.terms));
}

/**
 * Double one-touch, paid at expiry: pays `payout` if L or U is touched before T.
 * Value = payout · e^(−rd T) − DNT (quote currency). Already touched: payout · e^(−rd T).
 */
export function doubleOneTouch(p: DoubleTouchParams): number {
  const { T, rd, payout = 1 } = p;
  return payout * Math.exp(-rd * Math.max(T, 0)) - doubleNoTouch(p);
}
