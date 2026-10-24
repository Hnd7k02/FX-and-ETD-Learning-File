/**
 * Currency pairs of the Riskometer, cross rates and simple time-series helpers.
 *
 * The ECB publishes units of each currency per 1 EUR. EUR/CHF and EUR/USD are read directly;
 * the two USD pairs are cross rates through the euro:
 *   USD/CHF = (CHF per EUR) / (USD per EUR),   USD/JPY = (JPY per EUR) / (USD per EUR).
 */
import type { RawRow } from './csv';
import { isoWeekStart } from './dates';

export const PAIRS = ['EUR/CHF', 'EUR/USD', 'USD/CHF', 'USD/JPY'] as const;
export type Pair = (typeof PAIRS)[number];

export function isPair(x: unknown): x is Pair {
  return typeof x === 'string' && (PAIRS as readonly string[]).includes(x);
}

/** One observation of a daily series. */
export interface Point {
  date: string;
  value: number;
}
export type Series = Point[];

/** Exchange rate of the pair on one ECB fixing day. */
export function crossRate(row: RawRow, pair: Pair): number {
  switch (pair) {
    case 'EUR/CHF':
      return row.CHF;
    case 'EUR/USD':
      return row.USD;
    case 'USD/CHF':
      return row.CHF / row.USD;
    case 'USD/JPY':
      return row.JPY / row.USD;
  }
}

/** Daily series of one pair (one point per raw row). */
export function pairSeries(rows: readonly RawRow[], pair: Pair): Series {
  return rows.map((r) => ({ date: r.date, value: crossRate(r, pair) }));
}

/** Points on or after `from` (ISO date). */
export function since(series: readonly Point[], from: string): Series {
  return series.filter((p) => p.date >= from);
}

/**
 * Weekly sampling for the chart: the last observation of each ISO week (Monday to Sunday),
 * starting with the first week that has an observation on or after `from`. The date of each
 * weekly point is the date of that last observation (usually a Friday).
 */
export function weekly(series: readonly Point[], from = '2006-01-01'): Series {
  const out: Series = [];
  let lastKey = '';
  for (const p of series) {
    if (p.date < from) continue;
    const key = isoWeekStart(p.date);
    if (key === lastKey) out[out.length - 1] = p;
    else out.push(p);
    lastKey = key;
  }
  return out;
}

/** Index of the first point with date ≥ iso, or series.length if there is none. */
export function indexOnOrAfter(series: readonly Point[], iso: string): number {
  let lo = 0;
  let hi = series.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (series[mid]!.date < iso) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Index of the last point with date ≤ iso, or −1 if there is none. */
export function indexOnOrBefore(series: readonly Point[], iso: string): number {
  let lo = 0;
  let hi = series.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (series[mid]!.date <= iso) lo = mid + 1;
    else hi = mid;
  }
  return lo - 1;
}

/** Index of the point whose ISO week contains `iso`, or −1 (for weekly series). */
export function weekIndexOf(weeklySeries: readonly Point[], iso: string): number {
  const key = isoWeekStart(iso);
  const i = indexOnOrAfter(weeklySeries, key);
  const p = weeklySeries[i];
  return p && isoWeekStart(p.date) === key ? i : -1;
}
