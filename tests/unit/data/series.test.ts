import { describe, expect, it } from 'vitest';
import type { RawRow } from '@/lib/data/csv';
import {
  PAIRS,
  crossRate,
  indexOnOrAfter,
  indexOnOrBefore,
  isPair,
  pairSeries,
  since,
  weekIndexOf,
  weekly,
  type Series,
} from '@/lib/data/series';

const row: RawRow = { date: '2026-09-14', USD: 1.1551, CHF: 0.9431, JPY: 178.52 };

describe('cross rates', () => {
  it('reads EUR pairs directly and derives the USD pairs through the euro', () => {
    expect(crossRate(row, 'EUR/CHF')).toBe(0.9431);
    expect(crossRate(row, 'EUR/USD')).toBe(1.1551);
    expect(crossRate(row, 'USD/CHF')).toBeCloseTo(0.9431 / 1.1551, 15);
    expect(crossRate(row, 'USD/JPY')).toBeCloseTo(178.52 / 1.1551, 12);
    // consistency: EUR/CHF = EUR/USD · USD/CHF
    expect(crossRate(row, 'EUR/USD') * crossRate(row, 'USD/CHF')).toBeCloseTo(0.9431, 15);
  });

  it('lists the four pairs and recognises them', () => {
    expect(PAIRS).toEqual(['EUR/CHF', 'EUR/USD', 'USD/CHF', 'USD/JPY']);
    expect(isPair('USD/JPY')).toBe(true);
    expect(isPair('GBP/USD')).toBe(false);
    expect(isPair(1)).toBe(false);
  });

  it('builds a daily series per pair', () => {
    const rows: RawRow[] = [row, { date: '2026-09-15', USD: 1.2, CHF: 0.96, JPY: 180 }];
    expect(pairSeries(rows, 'USD/CHF')).toEqual([
      { date: '2026-09-14', value: 0.9431 / 1.1551 },
      { date: '2026-09-15', value: 0.96 / 1.2 },
    ]);
  });
});

/** Daily points on the given dates with value = index. */
const pts = (dates: string[]): Series => dates.map((date, i) => ({ date, value: i }));

describe('weekly sampling', () => {
  const s = pts([
    '2005-12-29', // before `from`
    '2005-12-30',
    '2006-01-02', // Monday
    '2006-01-04',
    '2006-01-06', // Friday → last of week 1
    '2006-01-09',
    '2006-01-12', // Thursday (Friday holiday) → last of week 2
    '2006-01-20', // only fixing of week 3
  ]);

  it('keeps the last observation of each ISO week from `from` on', () => {
    expect(weekly(s, '2006-01-01')).toEqual([
      { date: '2006-01-06', value: 4 },
      { date: '2006-01-12', value: 6 },
      { date: '2006-01-20', value: 7 },
    ]);
  });

  it('groups across a year boundary by ISO week and defaults to 2006', () => {
    const t = pts(['2020-12-28', '2020-12-31', '2021-01-01', '2021-01-04']);
    expect(weekly(t)).toEqual([
      { date: '2021-01-01', value: 2 },
      { date: '2021-01-04', value: 3 },
    ]);
    expect(weekly([])).toEqual([]);
  });

  it('filters by start date', () => {
    expect(since(s, '2006-01-09').map((p) => p.date)).toEqual([
      '2006-01-09',
      '2006-01-12',
      '2006-01-20',
    ]);
  });

  it('finds the week of a date', () => {
    const w = weekly(s, '2006-01-01');
    expect(weekIndexOf(w, '2006-01-02')).toBe(0);
    expect(weekIndexOf(w, '2006-01-13')).toBe(1);
    expect(weekIndexOf(w, '2006-01-16')).toBe(2);
    expect(weekIndexOf(w, '2005-12-30')).toBe(-1);
    expect(weekIndexOf(w, '2006-02-01')).toBe(-1);
  });
});

describe('binary search', () => {
  const s = pts(['2026-01-05', '2026-01-06', '2026-01-08']);
  it('finds the first point on or after a date', () => {
    expect(indexOnOrAfter(s, '2026-01-01')).toBe(0);
    expect(indexOnOrAfter(s, '2026-01-06')).toBe(1);
    expect(indexOnOrAfter(s, '2026-01-07')).toBe(2);
    expect(indexOnOrAfter(s, '2026-01-09')).toBe(3);
  });
  it('finds the last point on or before a date', () => {
    expect(indexOnOrBefore(s, '2026-01-01')).toBe(-1);
    expect(indexOnOrBefore(s, '2026-01-06')).toBe(1);
    expect(indexOnOrBefore(s, '2026-01-07')).toBe(1);
    expect(indexOnOrBefore(s, '2026-02-01')).toBe(2);
  });
});
