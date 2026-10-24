/**
 * European digital (binary) options in the Garman-Kohlhagen setting.
 *
 * Convention: pair Base/Quote (e.g. USD/CHF), rd = quote-currency rate (domestic, CHF),
 * rf = base-currency rate (foreign, USD), continuous rates, T in years (days/365), vol as a
 * decimal. Values in quote currency per 1 unit base (asset-or-nothing) or per `payout`
 * units of quote currency (cash-or-nothing).
 *
 * Building-block view: a vanilla call is "receive the asset if S_T > K" minus "pay K if
 * S_T > K", i.e. Call = AssetOrNothing − K · CashOrNothing (tested).
 */
import { normCdf } from '../normal';
import { d1d2, type OptionType } from '../vanilla';

/**
 * 1 if the option finishes in the money, ½ exactly at the strike (the limit of N(±d2) for
 * T → 0 at S = K, which keeps call + put = 1), 0 otherwise.
 */
function itmIndicator(X: number, K: number, type: OptionType): number {
  if (X === K) return 0.5;
  return (type === 'call' ? X > K : X < K) ? 1 : 0;
}

/**
 * Cash-or-nothing digital: pays `payout` (quote currency) at expiry if S_T > K (call) or
 * S_T < K (put). Value = payout · e^(−rd T) · N(±d2), in quote currency.
 * N(d2) is the risk-neutral probability of finishing above the strike.
 * T ≤ 0: payout · 1{in the money}; vol ≤ 0: payout · e^(−rd T) · 1{forward in the money}.
 */
export function digitalCash(
  S: number,
  K: number,
  T: number,
  vol: number,
  rd: number,
  rf: number,
  type: OptionType,
  payout = 1,
): number {
  if (T <= 0) return payout * itmIndicator(S, K, type);
  const dfd = Math.exp(-rd * T);
  if (vol <= 0) return payout * dfd * itmIndicator(S * Math.exp((rd - rf) * T), K, type);
  const { d2 } = d1d2(S, K, T, vol, rd, rf);
  return payout * dfd * normCdf(type === 'call' ? d2 : -d2);
}

/**
 * Asset-or-nothing digital: delivers 1 unit of base currency at expiry if S_T > K (call)
 * or S_T < K (put). Value = S · e^(−rf T) · N(±d1), in quote currency per 1 unit base.
 * T ≤ 0: S · 1{in the money}; vol ≤ 0: S · e^(−rf T) · 1{forward in the money}.
 */
export function digitalAsset(
  S: number,
  K: number,
  T: number,
  vol: number,
  rd: number,
  rf: number,
  type: OptionType,
): number {
  if (T <= 0) return S * itmIndicator(S, K, type);
  const dff = Math.exp(-rf * T);
  if (vol <= 0) return S * dff * itmIndicator(S * Math.exp((rd - rf) * T), K, type);
  const { d1 } = d1d2(S, K, T, vol, rd, rf);
  return S * dff * normCdf(type === 'call' ? d1 : -d1);
}
