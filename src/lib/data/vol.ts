/**
 * Realised volatility (MASTER_PROMPT §9, DECISIONS D-12).
 *
 *   r_t   = ln(S_t / S_{t−1})                      log return between consecutive fixings
 *   σ_t   = √( Σ_{k=t−20..t} r_k² / 21 ) · √252 · 100   in percent per year
 *
 * Window of 21 log returns (22 fixings, about one month), mean assumed to be zero (standard
 * for daily FX returns: the drift over a month is negligible against the noise, and a zero
 * mean keeps a one-day jump fully visible), annualised with 252 trading days.
 */
import type { Point, Series } from './series';

/** Number of log returns in the window. */
export const VOL_WINDOW = 21;
/** Trading days per year used for annualisation. */
export const ANNUALISATION = 252;

/** Log returns of consecutive observations; each return carries the date of its later fixing. */
export function logReturns(series: readonly Point[]): Series {
  const out: Series = [];
  for (let i = 1; i < series.length; i++) {
    out.push({ date: series[i]!.date, value: Math.log(series[i]!.value / series[i - 1]!.value) });
  }
  return out;
}

/**
 * Rolling realised volatility in percent. One value per fixing from the 22nd fixing on
 * (the first full window), dated with that fixing.
 */
export function realisedVol(
  series: readonly Point[],
  window = VOL_WINDOW,
  annualisation = ANNUALISATION,
): Series {
  const r = logReturns(series);
  const out: Series = [];
  const scale = Math.sqrt(annualisation) * 100;
  for (let end = window - 1; end < r.length; end++) {
    let ss = 0;
    for (let k = end - window + 1; k <= end; k++) ss += r[k]!.value ** 2;
    out.push({ date: r[end]!.date, value: Math.sqrt(ss / window) * scale });
  }
  return out;
}
