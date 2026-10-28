/**
 * Percentiles, percentile ranks, level thresholds and yearly maxima of a daily vol series.
 *
 * Percentile definition (Hyndman & Fan type 7, the default of R, NumPy and Excel PERCENTILE.INC):
 * for sorted values x₀ ≤ … ≤ x_{n−1} and p in [0, 1], h = (n − 1)·p and
 *   Q(p) = x_⌊h⌋ + (h − ⌊h⌋) · (x_⌊h⌋+1 − x_⌊h⌋),
 * i.e. linear interpolation between neighbouring order statistics; Q(0) = min, Q(1) = max.
 *
 * Percentile rank of a value v: share of the daily values that are ≤ v, in percent (0..100).
 */
import type { Point } from './series';

/** Percentiles that separate the five levels (Ruhig | Normal | Erhöht | Hoch | Extrem). */
export const LEVEL_PERCENTILES = [20, 60, 85, 97] as const;
/** First date of the percentile base (all daily values from this date on, per pair). */
export const PERCENTILE_SINCE = '2006-01-01';

export interface Thresholds {
  p20: number;
  p60: number;
  p85: number;
  p97: number;
  /** Historical maximum of the base (= P100). */
  max: number;
  maxDate: string;
  /** Number of daily values in the base. */
  days: number;
}

/** Ascending copy of the values. */
export function sortedValues(series: readonly Point[]): number[] {
  return series.map((p) => p.value).sort((a, b) => a - b);
}

/** Type-7 quantile of ascending values; p in [0, 1]. */
export function quantile(sorted: readonly number[], p: number): number {
  const n = sorted.length;
  if (n === 0) throw new Error('quantile of an empty sample');
  if (!(p >= 0 && p <= 1)) throw new Error(`p must be in [0, 1], got ${p}`);
  const h = (n - 1) * p;
  const lo = Math.floor(h);
  const hi = Math.min(lo + 1, n - 1);
  return sorted[lo]! + (h - lo) * (sorted[hi]! - sorted[lo]!);
}

/** Share of values ≤ v in percent (ascending input). */
export function percentileRank(sorted: readonly number[], v: number): number {
  const n = sorted.length;
  if (n === 0) throw new Error('percentile rank in an empty sample');
  let lo = 0;
  let hi = n;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid]! <= v) lo = mid + 1;
    else hi = mid;
  }
  return (lo / n) * 100;
}

/** Level thresholds and maximum of the daily values on or after `from`. */
export function thresholds(vol: readonly Point[], from = PERCENTILE_SINCE): Thresholds {
  const base = vol.filter((p) => p.date >= from);
  if (base.length === 0) throw new Error(`no daily values on or after ${from}`);
  const sorted = sortedValues(base);
  let maxPoint = base[0]!;
  for (const p of base) if (p.value > maxPoint.value) maxPoint = p;
  const [a, b, c, d] = LEVEL_PERCENTILES;
  return {
    p20: quantile(sorted, a / 100),
    p60: quantile(sorted, b / 100),
    p85: quantile(sorted, c / 100),
    p97: quantile(sorted, d / 100),
    max: maxPoint.value,
    maxDate: maxPoint.date,
    days: base.length,
  };
}

export interface YearMax {
  year: number;
  vol: number;
  date: string;
}

/** Highest daily value per calendar year (first date if the maximum repeats), from `from` on. */
export function yearlyMax(vol: readonly Point[], from = PERCENTILE_SINCE): YearMax[] {
  const out: YearMax[] = [];
  for (const p of vol) {
    if (p.date < from) continue;
    const year = Number(p.date.slice(0, 4));
    const last = out[out.length - 1];
    if (!last || last.year !== year) out.push({ year, vol: p.value, date: p.date });
    else if (p.value > last.vol) {
      last.vol = p.value;
      last.date = p.date;
    }
  }
  return out;
}
