/**
 * Vanilla FX options: Garman-Kohlhagen on the spot and Black-76 on the forward.
 *
 * Convention: pair Base/Quote (e.g. USD/CHF), rd = continuously compounded rate of the
 * quote currency (domestic, CHF), rf = rate of the base currency (foreign, USD).
 * Prices are in quote currency per 1 unit of base currency. T in years (days/365).
 */
import { normCdf } from './normal';

export type OptionType = 'call' | 'put';

export interface D1D2 {
  /** Forward S · e^((rd − rf)T). */
  F: number;
  d1: number;
  d2: number;
}

/** d1 and d2 of the Garman-Kohlhagen model (via the forward). Requires T > 0, vol > 0. */
export function d1d2(S: number, K: number, T: number, vol: number, rd: number, rf: number): D1D2 {
  const F = S * Math.exp((rd - rf) * T);
  const sd = vol * Math.sqrt(T);
  const d1 = (Math.log(F / K) + 0.5 * sd * sd) / sd;
  return { F, d1, d2: d1 - sd };
}

/** Payoff at expiry against the spot. */
export function payoff(S: number, K: number, type: OptionType): number {
  return type === 'call' ? Math.max(S - K, 0) : Math.max(K - S, 0);
}

/**
 * Garman-Kohlhagen price. For T ≤ 0 returns the payoff against the spot.
 * Call = e^(−rd T) · [F N(d1) − K N(d2)], Put = e^(−rd T) · [K N(−d2) − F N(−d1)].
 */
export function gkPrice(
  S: number,
  K: number,
  T: number,
  vol: number,
  rd: number,
  rf: number,
  type: OptionType,
): number {
  if (T <= 0) return payoff(S, K, type);
  if (vol <= 0) {
    const F = S * Math.exp((rd - rf) * T);
    return Math.exp(-rd * T) * payoff(F, K, type);
  }
  const { F, d1, d2 } = d1d2(S, K, T, vol, rd, rf);
  const df = Math.exp(-rd * T);
  return type === 'call'
    ? df * (F * normCdf(d1) - K * normCdf(d2))
    : df * (K * normCdf(-d2) - F * normCdf(-d1));
}

/**
 * Black-76 price on the forward F, discounted with df (default 1 = undiscounted, as in the
 * Wow moment). For T ≤ 0 returns df · payoff(F).
 */
export function black76(
  F: number,
  K: number,
  T: number,
  vol: number,
  type: OptionType,
  df = 1,
): number {
  if (T <= 0 || vol <= 0) return df * payoff(F, K, type);
  const sd = vol * Math.sqrt(T);
  const d1 = (Math.log(F / K) + 0.5 * sd * sd) / sd;
  const d2 = d1 - sd;
  return type === 'call'
    ? df * (F * normCdf(d1) - K * normCdf(d2))
    : df * (K * normCdf(-d2) - F * normCdf(-d1));
}

/** Intrinsic value against the forward, discounted: df · max(±(F − K), 0). */
export function intrinsicForward(F: number, K: number, type: OptionType, df = 1): number {
  return df * payoff(F, K, type);
}

/** Time value = option price − intrinsic value against the forward. */
export function timeValue(
  S: number,
  K: number,
  T: number,
  vol: number,
  rd: number,
  rf: number,
  type: OptionType,
): number {
  const F = S * Math.exp((rd - rf) * T);
  const df = Math.exp(-rd * T);
  return gkPrice(S, K, T, vol, rd, rf, type) - intrinsicForward(F, K, type, df);
}

/** Put-call parity residual: (C − P) − DF_d · (F − K). Zero for consistent prices. */
export function parityResidual(
  call: number,
  put: number,
  F: number,
  K: number,
  dfd: number,
): number {
  return call - put - dfd * (F - K);
}

/** Put from call via parity: P = C − DF_d · (F − K). */
export function putFromCall(call: number, F: number, K: number, dfd: number): number {
  return call - dfd * (F - K);
}
