/**
 * Moneyness and premium (module 04, section 3). Pure functions, no DOM.
 *
 * Moneyness is measured against the forward F (not the spot): a call is in the money (ITM) if
 * K < F, out of the money (OTM) if K > F, at the money forward (ATMF) if |F − K| ≤ 1 pip
 * (same tolerance as the Greeks lab). For a put it is the other way round.
 * Premium = intrinsic value against the forward, discounted (DF_d · max(±(F − K), 0)),
 * plus time value. Convention: rd = quote (CHF), rf = base (USD), T = days/365.
 */
import { gkPrice, intrinsicForward, type OptionType } from '@/lib/fx/vanilla';
import { greeks } from '@/lib/fx/greeks';
import { atmDnsStrike, atmfStrike, strikeFromDelta } from '@/lib/fx/implied';

export interface OptionMarket {
  S: number;
  T: number;
  vol: number;
  rd: number;
  rf: number;
}

export type MoneynessLabel = 'ATMF' | 'ITM' | 'OTM';

/** ATMF tolerance in price units (1 pip). */
export const ATMF_TOL = 1e-4;

export interface MoneynessInfo {
  label: MoneynessLabel;
  /** Forward minus strike in pips, signed (> 0: forward above the strike). */
  fMinusKPips: number;
}

export function moneyness(K: number, F: number, type: OptionType, tol = ATMF_TOL): MoneynessInfo {
  const d = F - K;
  const fMinusKPips = d / 1e-4;
  if (Math.abs(d) <= tol) return { label: 'ATMF', fMinusKPips };
  const itm = type === 'call' ? d > 0 : d < 0;
  return { label: itm ? 'ITM' : 'OTM', fMinusKPips };
}

export interface PremiumSplit {
  /** Forward. */
  F: number;
  /** Premium per unit base (quote currency). */
  price: number;
  /** Discounted intrinsic value against the forward. */
  intrinsic: number;
  /** price − intrinsic (≥ 0 for European options in this model). */
  time: number;
  /** Premium as a fraction of the base notional at spot: price / S (e.g. 1.58 % of USD). */
  pctBase: number;
  /** Spot delta and forward delta. */
  delta: number;
  deltaFwd: number;
}

export function premiumSplit(K: number, m: OptionMarket, type: OptionType): PremiumSplit {
  const F = atmfStrike(m.S, m.T, m.rd, m.rf);
  const df = Math.exp(-m.rd * m.T);
  const price = gkPrice(m.S, K, m.T, m.vol, m.rd, m.rf, type);
  const intrinsic = intrinsicForward(F, K, type, df);
  const g = greeks(m.S, K, m.T, m.vol, m.rd, m.rf, type);
  return {
    F,
    price,
    intrinsic,
    time: price - intrinsic,
    pctBase: price / m.S,
    delta: g.delta,
    deltaFwd: g.deltaFwd,
  };
}

export type MarkerId = 'p10' | 'p25' | 'atmf' | 'dns' | 'c25' | 'c10';

export interface StrikeMarker {
  id: MarkerId;
  K: number;
}

/**
 * Desk reference strikes: 10Δ and 25Δ put, ATMF, ATM delta-neutral straddle, 25Δ and 10Δ call
 * (spot delta, not premium-adjusted), sorted by strike.
 */
export function strikeMarkers(m: OptionMarket): StrikeMarker[] {
  const k = (d: number, type: OptionType) => strikeFromDelta(d, m.S, m.T, m.vol, m.rd, m.rf, type);
  return [
    { id: 'p10' as const, K: k(-0.1, 'put') },
    { id: 'p25' as const, K: k(-0.25, 'put') },
    { id: 'atmf' as const, K: atmfStrike(m.S, m.T, m.rd, m.rf) },
    { id: 'dns' as const, K: atmDnsStrike(m.S, m.T, m.vol, m.rd, m.rf) },
    { id: 'c25' as const, K: k(0.25, 'call') },
    { id: 'c10' as const, K: k(0.1, 'call') },
  ].sort((a, b) => a.K - b.K);
}

/** The marker within `tol` of K, if any (for the "aha" note). */
export function markerAt(
  K: number,
  markers: readonly StrikeMarker[],
  tol = ATMF_TOL,
): StrikeMarker | null {
  let best: StrikeMarker | null = null;
  for (const mk of markers) {
    if (Math.abs(mk.K - K) <= tol && (!best || Math.abs(mk.K - K) < Math.abs(best.K - K)))
      best = mk;
  }
  return best;
}

/** Premium, intrinsic and time value (pips) over a strike grid for the chart. */
export function premiumCurves(
  ks: readonly number[],
  m: OptionMarket,
  type: OptionType,
): { price: number[]; intrinsic: number[] } {
  const F = atmfStrike(m.S, m.T, m.rd, m.rf);
  const df = Math.exp(-m.rd * m.T);
  return {
    price: ks.map((K) => gkPrice(m.S, K, m.T, m.vol, m.rd, m.rf, type) / 1e-4),
    intrinsic: ks.map((K) => intrinsicForward(F, K, type, df) / 1e-4),
  };
}

/** Strike range of the explorer and its slider step. */
export const K_RANGE: readonly [number, number] = [0.74, 0.85];
export const K_STEP = 0.0005;
