/**
 * Implied volatility and strikes from delta (Garman-Kohlhagen).
 *
 * Convention: pair Base/Quote (e.g. USD/CHF), rd = continuously compounded rate of the
 * quote currency (domestic, CHF), rf = rate of the base currency (foreign, USD).
 * Prices in quote currency per 1 unit of base currency. T in years (days/365 or weeks/52).
 * Volatilities as decimals (0.08 = 8 %).
 */
import { normInv, normPdf } from './normal';
import { d1d2, gkPrice, type OptionType } from './vanilla';

/** Lower end of the implied-vol search interval (decimal). */
export const VOL_MIN = 1e-6;
/** Upper end of the implied-vol search interval (decimal, 500 %). */
export const VOL_MAX = 5;

export interface ImpliedVolOptions {
  /** Start value for Newton (decimal). Default: Manaster-Koehler point √(2·|ln(F/K)|/T). */
  guess?: number;
  /** Absolute price tolerance in quote currency per 1 unit base. Default 1e-10. */
  tol?: number;
  /** Maximum number of iterations (Newton or bisection steps). Default 100. */
  maxIter?: number;
}

export interface ImpliedVolResult {
  /** Implied volatility (decimal). */
  vol: number;
  /** Number of steps (Newton or bisection) taken after the start value. */
  iterations: number;
  /** How many of those steps fell back to bisection. */
  bisections: number;
  /** Every volatility tried, starting with the start value (for a step-by-step view). */
  path: number[];
}

/**
 * No-arbitrage price bounds of a European FX option, in quote currency per 1 unit base.
 * Call: max(S·e^(−rf T) − K·e^(−rd T), 0) ≤ C < S·e^(−rf T).
 * Put:  max(K·e^(−rd T) − S·e^(−rf T), 0) ≤ P < K·e^(−rd T).
 */
export function noArbitrageBounds(
  S: number,
  K: number,
  T: number,
  rd: number,
  rf: number,
  type: OptionType,
): { lower: number; upper: number } {
  const spotLeg = S * Math.exp(-rf * T);
  const strikeLeg = K * Math.exp(-rd * T);
  return type === 'call'
    ? { lower: Math.max(spotLeg - strikeLeg, 0), upper: spotLeg }
    : { lower: Math.max(strikeLeg - spotLeg, 0), upper: strikeLeg };
}

/**
 * Implied volatility with full solver detail: the σ for which gkPrice(S, K, T, σ, rd, rf) =
 * price. Newton on vega ν = S·e^(−rf T)·φ(d1)·√T, safeguarded by a bracket [VOL_MIN, VOL_MAX]:
 * a Newton step that leaves the current bracket (or meets zero vega) becomes a bisection step.
 * Converged when |model price − price| ≤ tol.
 *
 * Throws RangeError for invalid inputs (S, K, T ≤ 0, non-finite price), for prices outside
 * the no-arbitrage bounds (see noArbitrageBounds; the upper bound itself means σ = ∞) and
 * for prices whose implied vol lies outside [VOL_MIN, VOL_MAX] by more than tol in price.
 * Throws Error if maxIter steps are not enough.
 */
export function impliedVolDetail(
  price: number,
  S: number,
  K: number,
  T: number,
  rd: number,
  rf: number,
  type: OptionType,
  opts: ImpliedVolOptions = {},
): ImpliedVolResult {
  const { tol = 1e-10, maxIter = 100 } = opts;
  if (!(S > 0 && K > 0 && T > 0) || !Number.isFinite(price)) {
    throw new RangeError('impliedVol: needs S > 0, K > 0, T > 0 and a finite price');
  }
  const { lower, upper } = noArbitrageBounds(S, K, T, rd, rf, type);
  if (price < lower - tol || price >= upper) {
    throw new RangeError(
      `impliedVol: price ${price} outside the no-arbitrage bounds [${lower}, ${upper})`,
    );
  }

  const model = (vol: number): number => gkPrice(S, K, T, vol, rd, rf, type);
  const vega = (vol: number): number => {
    const { d1 } = d1d2(S, K, T, vol, rd, rf);
    return S * Math.exp(-rf * T) * normPdf(d1) * Math.sqrt(T);
  };

  // Edges of the search interval: the vol is either there or outside it.
  const fMin = model(VOL_MIN) - price;
  if (Math.abs(fMin) <= tol) return { vol: VOL_MIN, iterations: 0, bisections: 0, path: [VOL_MIN] };
  if (fMin > 0) throw new RangeError(`impliedVol: implied vol below ${VOL_MIN}`);
  const fMax = model(VOL_MAX) - price;
  if (Math.abs(fMax) <= tol) return { vol: VOL_MAX, iterations: 0, bisections: 0, path: [VOL_MAX] };
  if (fMax < 0) throw new RangeError(`impliedVol: implied vol above ${VOL_MAX}`);

  // Manaster-Koehler start: the inflection point of price(σ), from which Newton is monotone.
  const F = S * Math.exp((rd - rf) * T);
  const start = opts.guess ?? Math.sqrt((2 * Math.abs(Math.log(F / K))) / T);
  let vol = Math.min(Math.max(start, VOL_MIN), VOL_MAX);
  let lo = VOL_MIN;
  let hi = VOL_MAX;
  let bisections = 0;
  const path = [vol];

  for (let i = 1; i <= maxIter; i++) {
    const diff = model(vol) - price;
    if (Math.abs(diff) <= tol) return { vol, iterations: i - 1, bisections, path };
    if (diff > 0) hi = vol;
    else lo = vol;
    const v = vega(vol);
    let next = vol - diff / v;
    if (!(v > 0) || !(next > lo && next < hi)) {
      next = 0.5 * (lo + hi);
      bisections++;
    }
    vol = next;
    path.push(vol);
  }
  if (Math.abs(model(vol) - price) <= tol) return { vol, iterations: maxIter, bisections, path };
  throw new Error(`impliedVol: no convergence within ${maxIter} iterations`);
}

/**
 * Implied volatility (decimal) from a Garman-Kohlhagen price in quote currency per 1 unit
 * base. Newton on vega with bisection fallback on [1e-6, 5]; details and errors as in
 * impliedVolDetail.
 */
export function impliedVol(
  price: number,
  S: number,
  K: number,
  T: number,
  rd: number,
  rf: number,
  type: OptionType,
  opts: ImpliedVolOptions = {},
): number {
  return impliedVolDetail(price, S, K, T, rd, rf, type, opts).vol;
}

/** Which delta a strike is quoted in. */
export type DeltaKind = 'spot' | 'forward';

/**
 * Strike from a delta (closed form, no iteration), in quote currency per 1 unit base.
 *
 * Spot delta:    call Δ = e^(−rf T)·N(d1),  put Δ = −e^(−rf T)·N(−d1).
 * Forward delta: call Δ = N(d1),            put Δ = −N(−d1).
 * Solve for d1 with N⁻¹, then K = F · e^(−d1·σ√T + ½σ²T) with F = S·e^((rd − rf)T).
 *
 * Put deltas may be given negative (−0.25) or as absolute value (0.25); only |Δ| is used.
 * Call deltas must be positive. Non-premium-adjusted delta (premium in quote currency).
 * Throws RangeError if |Δ| (spot: |Δ|·e^(rf T)) is not in (0, 1) or T, vol, S ≤ 0.
 */
export function strikeFromDelta(
  delta: number,
  S: number,
  T: number,
  vol: number,
  rd: number,
  rf: number,
  type: OptionType,
  kind: DeltaKind = 'spot',
): number {
  if (!(S > 0 && T > 0 && vol > 0)) {
    throw new RangeError('strikeFromDelta: needs S > 0, T > 0 and vol > 0');
  }
  const abs = type === 'put' ? Math.abs(delta) : delta;
  // N(d1) for a call, N(−d1) for a put.
  const p = kind === 'spot' ? abs * Math.exp(rf * T) : abs;
  if (!(p > 0 && p < 1)) {
    throw new RangeError(
      `strikeFromDelta: ${kind} ${type} delta ${delta} is not attainable (N(±d1) = ${p})`,
    );
  }
  const d1 = type === 'call' ? normInv(p) : -normInv(p);
  const sd = vol * Math.sqrt(T);
  const F = S * Math.exp((rd - rf) * T);
  return F * Math.exp(-d1 * sd + 0.5 * sd * sd);
}

/** ATMF strike = forward F = S · e^((rd − rf)T), quote currency per 1 unit base. */
export function atmfStrike(S: number, T: number, rd: number, rf: number): number {
  return S * Math.exp((rd - rf) * T);
}

/**
 * Delta-neutral straddle strike (desk ATM convention): call and put spot deltas cancel,
 * so N(d1) = ½, d1 = 0 and K = F · e^(+½σ²T). Slightly above the forward.
 */
export function atmDnsStrike(S: number, T: number, vol: number, rd: number, rf: number): number {
  return atmfStrike(S, T, rd, rf) * Math.exp(0.5 * vol * vol * T);
}
