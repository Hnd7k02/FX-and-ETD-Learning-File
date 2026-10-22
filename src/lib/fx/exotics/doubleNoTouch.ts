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
 * Shortcut for that last case: if hardly any path can touch BOTH barriers, they act
 * independently and DNT = payout · e^(−rd T) · (1 − P(touch L) − P(touch U))
 * (inclusion–exclusion). The neglected P(touch both) is at most
 * P(touch L)·P(L → U within T) + P(touch U)·P(U → L within T). The price uses the shortcut
 * when this bound is below 1e-16, or when it is smaller than the rounding error of the
 * series (very low vol with large carry, where the series terms cancel).
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
   * Number of series terms; forces the series. Default: automatic (shortcut or series with
   * n ≈ 8.9 · Z/(π σ√T) terms, at least 50 and at most 20’000; see dntDefaultTerms).
   */
  terms?: number;
}

/** How a DNT price was obtained, for a step-by-step view. */
export interface DntBreakdown {
  /** Price in quote currency (per `payout`). */
  price: number;
  /**
   * 'series': Hui's series · 'independent': inclusion–exclusion of two single no-touches ·
   * 'touched': spot at or outside a barrier · 'expired': T ≤ 0 · 'no-vol': vol ≤ 0.
   */
  method: 'series' | 'independent' | 'touched' | 'expired' | 'no-vol';
  /** Series terms used (0 if the series was not used). */
  terms: number;
  /** Estimated absolute error in quote currency (0 for the exact special cases). */
  errorEstimate: number;
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
 * The factor e^(½βσ²T) = e^(−½α²σ²T − rd T) contains the discounting.
 * errorEstimate = rounding (1e-15 · Σ|term|) + size of the last term (truncation).
 * Not clamped.
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
): { value: number; errorEstimate: number } {
  const v2 = vol * vol;
  const k = (2 * (rd - rf)) / v2 - 1;
  const alpha = -0.5 * k; // = −(b − σ²/2)/σ², minus the drift of ln S in units of σ²
  const beta = -0.25 * k * k - (2 * rd) / v2; // = −α² − 2rd/σ²
  const Z = Math.log(U / L);
  const x = Math.log(S / L); // position in the corridor, 0 < x < Z
  // (S/L)^α · e^(½βσ²T) and (S/U)^α · e^(½βσ²T), combined in the exponent so that a large α
  // (low vol, large carry) does not overflow on its own.
  const shared = 0.5 * beta * v2 * T;
  const fromL = Math.exp(alpha * x + shared);
  const fromU = Math.exp(alpha * (x - Z) + shared);
  let sum = 0;
  let absSum = 0;
  let last = 0;
  for (let i = 1; i <= terms; i++) {
    const w = (i * Math.PI) / Z; // wave number iπ/Z
    const sign = i % 2 === 0 ? 1 : -1; // (−1)^i
    last =
      ((2 * Math.PI * i) / (Z * Z)) *
      ((fromL - sign * fromU) / (alpha * alpha + w * w)) *
      Math.sin(w * x) *
      Math.exp(-0.5 * w * w * v2 * T);
    sum += last;
    absSum += Math.abs(last);
  }
  return {
    value: payout * sum,
    errorEstimate: Math.abs(payout) * (1e-15 * absSum + Math.abs(last)),
  };
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
 * Double no-touch with the method used and an error estimate (see module doc).
 * Special cases: spot at or outside a barrier → 0; T ≤ 0 → payout; vol ≤ 0 → the forward
 * path S·e^((rd − rf)t) decides. The price is clamped to [0, payout · e^(−rd T)].
 * Throws RangeError unless S, L, U > 0 and L < U.
 */
export function dntBreakdown(p: DoubleTouchParams): DntBreakdown {
  const { S, L, U, T, vol, rd, rf, payout = 1 } = p;
  assertPositive('doubleNoTouch', { S, L, U });
  if (!(L < U)) throw new RangeError(`doubleNoTouch: needs L < U, got L = ${L}, U = ${U}`);
  const exact = (price: number, method: DntBreakdown['method']): DntBreakdown => ({
    price,
    method,
    terms: 0,
    errorEstimate: 0,
  });
  if (S <= L || S >= U) return exact(0, 'touched');
  if (T <= 0) return exact(payout, 'expired');
  const dfd = Math.exp(-rd * T);
  if (vol <= 0) {
    const hits =
      forwardPathHitTime(S, L, T, rd, rf) !== null || forwardPathHitTime(S, U, T, rd, rf) !== null;
    return exact(hits ? 0 : payout * dfd, 'no-vol');
  }
  const clamp = (v: number): number => Math.min(Math.max(v, 0), payout * dfd);

  if (p.terms !== undefined) {
    const s = dntSeries(S, L, U, T, vol, rd, rf, payout, p.terms);
    return {
      price: clamp(s.value),
      method: 'series',
      terms: p.terms,
      errorEstimate: s.errorEstimate,
    };
  }

  const { touchL, touchU, bothBound } = dntTouchProbabilities(S, L, U, T, vol, rd, rf);
  const independent: DntBreakdown = {
    price: clamp(payout * dfd * (1 - touchL - touchU)),
    method: 'independent',
    terms: 0,
    errorEstimate: Math.abs(payout) * dfd * bothBound,
  };
  if (bothBound < 1e-16) return independent;
  const terms = dntDefaultTerms(Math.log(U / L), vol, T);
  const s = dntSeries(S, L, U, T, vol, rd, rf, payout, terms);
  if (!Number.isFinite(s.value) || !(s.errorEstimate < independent.errorEstimate)) {
    return independent;
  }
  return { price: clamp(s.value), method: 'series', terms, errorEstimate: s.errorEstimate };
}

/**
 * Double no-touch: pays `payout` (quote currency) at expiry if the spot stays strictly
 * inside (L, U) until T. Hui's series, or the inclusion–exclusion shortcut where that is
 * more accurate; see dntBreakdown.
 */
export function doubleNoTouch(p: DoubleTouchParams): number {
  return dntBreakdown(p).price;
}

/**
 * Double one-touch, paid at expiry: pays `payout` if L or U is touched before T.
 * Value = payout · e^(−rd T) − DNT (quote currency). Already touched: payout · e^(−rd T).
 */
export function doubleOneTouch(p: DoubleTouchParams): number {
  const { T, rd, payout = 1 } = p;
  return payout * Math.exp(-rd * Math.max(T, 0)) - doubleNoTouch(p);
}
