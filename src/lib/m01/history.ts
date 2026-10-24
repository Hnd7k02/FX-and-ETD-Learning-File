/**
 * Module 01, section 4: a real counter-example to "the dollar is always a safe haven".
 *
 * After the US tariff announcements of 2 April 2025 markets were turbulent, yet the dollar lost
 * value (BIS, see src/content/sources/01-spot.md). The size of the move is computed here from
 * the ECB reference rates (data/raw/ecb-eur-reference.csv), never typed in: the cross rate on
 * the anchor day and its extreme within the window.
 */
import type { Point, Series } from '@/lib/data/series';

/** One config object for the window (D-22): anchor = day of the announcement, end of window. */
export const APRIL_2025 = { anchor: '2025-04-02', to: '2025-04-30' } as const;

export interface WindowMove {
  start: Point;
  /** Lowest fixing after the anchor, up to and including `to`. */
  low: Point;
  /** Highest fixing after the anchor, up to and including `to`. */
  high: Point;
  /** low / start − 1 (fraction, negative if the rate fell). */
  lowPct: number;
  /** high / start − 1. */
  highPct: number;
}

/**
 * Move of a series from the fixing on (or after) `anchor` to its low and high in (anchor, to].
 * Throws if the window holds no fixing after the anchor.
 */
export function windowMove(series: Series, anchor: string, to: string): WindowMove {
  const i0 = series.findIndex((p) => p.date >= anchor);
  if (i0 < 0) throw new RangeError(`no fixing on or after ${anchor}`);
  const start = series[i0]!;
  const after = series.slice(i0 + 1).filter((p) => p.date <= to);
  if (!after.length) throw new RangeError(`no fixing between ${start.date} and ${to}`);
  let low = after[0]!;
  let high = after[0]!;
  for (const p of after) {
    if (p.value < low.value) low = p;
    if (p.value > high.value) high = p;
  }
  return {
    start,
    low,
    high,
    lowPct: low.value / start.value - 1,
    highPct: high.value / start.value - 1,
  };
}
