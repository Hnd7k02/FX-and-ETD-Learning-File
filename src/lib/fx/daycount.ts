/**
 * Day count conventions of the money market.
 *
 * Money-market rates are simple (not compounded) and quoted per year; the year fraction of a
 * period of `days` calendar days is days / 360 (ACT/360) or days / 365 (ACT/365), depending on
 * the currency. CHF, USD and EUR use ACT/360; GBP and JPY use ACT/365.
 *
 * The option models use continuous rates with T = days / 365 everywhere; these conventions only
 * apply to the money-market forward, FX swaps and cash-and-carry.
 */

/** Day count convention: actual days divided by 360 or by 365. */
export type DayCount = 'ACT/360' | 'ACT/365';

/** Money-market day count per currency (ISO code). Unknown currencies fall back to ACT/360. */
export const DAY_COUNT: Readonly<Record<string, DayCount>> = {
  CHF: 'ACT/360',
  USD: 'ACT/360',
  EUR: 'ACT/360',
  GBP: 'ACT/365',
  JPY: 'ACT/365',
};

/** Fallback for currencies not listed in {@link DAY_COUNT}. */
export const DEFAULT_DAY_COUNT: DayCount = 'ACT/360';

/** Days per year of a convention: 360 for ACT/360, 365 for ACT/365. */
export function dayBasis(dc: DayCount): 360 | 365 {
  return dc === 'ACT/365' ? 365 : 360;
}

/** Year fraction of `days` calendar days: t = days / basis (dimensionless, in years). */
export function yearFraction(days: number, dc: DayCount): number {
  return days / dayBasis(dc);
}

/**
 * Day count of a currency (ISO code, case-insensitive). Unknown or missing codes return
 * ACT/360 ({@link DEFAULT_DAY_COUNT}).
 */
export function dayCountOf(ccy?: string): DayCount {
  if (ccy === undefined) return DEFAULT_DAY_COUNT;
  return DAY_COUNT[ccy.toUpperCase()] ?? DEFAULT_DAY_COUNT;
}

/** Days-per-year basis of a currency: dayBasis(dayCountOf(ccy)), i.e. 360 or 365. */
export function basisOf(ccy?: string): 360 | 365 {
  return dayBasis(dayCountOf(ccy));
}
