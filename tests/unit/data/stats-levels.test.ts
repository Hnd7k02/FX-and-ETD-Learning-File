import { describe, expect, it } from 'vitest';
import { LEVEL_BOUNDS, levelOf, needle, needleAngle } from '@/lib/data/levels';
import {
  LEVEL_PERCENTILES,
  PERCENTILE_SINCE,
  percentileRank,
  quantile,
  sortedValues,
  thresholds,
  yearlyMax,
  type Thresholds,
} from '@/lib/data/stats';
import { isoFromDayNumber, dayNumber } from '@/lib/data/dates';
import type { Series } from '@/lib/data/series';

const ONE_TO_HUNDRED = Array.from({ length: 100 }, (_, i) => i + 1);

/** Daily points from 2006-01-02 with the given values. */
function daily(values: number[], start = '2006-01-02'): Series {
  const d0 = dayNumber(start);
  return values.map((value, i) => ({ date: isoFromDayNumber(d0 + i), value }));
}

describe('percentiles (type 7, linear interpolation between order statistics)', () => {
  it('matches the textbook values on 1..5', () => {
    const x = [1, 2, 3, 4, 5];
    expect(quantile(x, 0)).toBe(1);
    expect(quantile(x, 0.2)).toBeCloseTo(1.8, 12);
    expect(quantile(x, 0.6)).toBeCloseTo(3.4, 12);
    expect(quantile(x, 0.85)).toBeCloseTo(4.4, 12);
    expect(quantile(x, 0.97)).toBeCloseTo(4.88, 12);
    expect(quantile(x, 1)).toBe(5);
    expect(quantile([7], 0.5)).toBe(7);
  });

  it('matches numpy.percentile on 1..100', () => {
    expect(quantile(ONE_TO_HUNDRED, 0.2)).toBeCloseTo(20.8, 12);
    expect(quantile(ONE_TO_HUNDRED, 0.6)).toBeCloseTo(60.4, 12);
    expect(quantile(ONE_TO_HUNDRED, 0.85)).toBeCloseTo(85.15, 12);
    expect(quantile(ONE_TO_HUNDRED, 0.97)).toBeCloseTo(97.03, 12);
  });

  it('rejects an empty sample and p outside [0, 1]', () => {
    expect(() => quantile([], 0.5)).toThrow(/empty/);
    expect(() => quantile([1], 1.2)).toThrow(/\[0, 1\]/);
    expect(() => quantile([1], Number.NaN)).toThrow(/\[0, 1\]/);
  });

  it('percentile rank = share of values ≤ v', () => {
    const x = [1, 2, 3, 4, 5];
    expect(percentileRank(x, 3)).toBe(60);
    expect(percentileRank(x, 3.5)).toBe(60);
    expect(percentileRank(x, 0.5)).toBe(0);
    expect(percentileRank(x, 5)).toBe(100);
    expect(percentileRank([1, 2, 2, 2, 3], 2)).toBe(80);
    expect(() => percentileRank([], 1)).toThrow(/empty/);
  });

  it('sorts values ascending without changing the input', () => {
    const s = daily([3, 1, 2]);
    expect(sortedValues(s)).toEqual([1, 2, 3]);
    expect(s.map((p) => p.value)).toEqual([3, 1, 2]);
  });
});

describe('thresholds', () => {
  it('uses P20, P60, P85, P97 and the maximum of all daily values since 2006', () => {
    expect(LEVEL_PERCENTILES).toEqual([20, 60, 85, 97]);
    expect(PERCENTILE_SINCE).toBe('2006-01-01');
    // values before 2006 (here 1000) are ignored
    const s = [...daily([1000, 1000], '2005-12-30'), ...daily([...ONE_TO_HUNDRED].reverse())];
    const t = thresholds(s);
    expect(t.p20).toBeCloseTo(20.8, 12);
    expect(t.p60).toBeCloseTo(60.4, 12);
    expect(t.p85).toBeCloseTo(85.15, 12);
    expect(t.p97).toBeCloseTo(97.03, 12);
    expect(t.max).toBe(100);
    expect(t.maxDate).toBe('2006-01-02');
    expect(t.days).toBe(100);
  });

  it('throws without data in the base period', () => {
    expect(() => thresholds(daily([1, 2], '2005-01-01'))).toThrow(/no daily values/);
  });
});

describe('yearly maxima', () => {
  it('gives the highest value per year with its first date, from 2006 on', () => {
    const s: Series = [
      { date: '2005-06-01', value: 99 },
      { date: '2006-03-01', value: 4 },
      { date: '2006-07-01', value: 9 },
      { date: '2006-08-01', value: 9 },
      { date: '2007-01-02', value: 2 },
      { date: '2007-12-31', value: 3 },
    ];
    expect(yearlyMax(s)).toEqual([
      { year: 2006, vol: 9, date: '2006-07-01' },
      { year: 2007, vol: 3, date: '2007-12-31' },
    ]);
    expect(yearlyMax(s, '2005-01-01')[0]).toEqual({ year: 2005, vol: 99, date: '2005-06-01' });
  });
});

const T: Thresholds = { p20: 20, p60: 60, p85: 85, p97: 97, max: 100, maxDate: '2015-01-15', days: 100 };

describe('levels', () => {
  it('maps values to 1..5 with each threshold belonging to the higher level', () => {
    expect(levelOf(0, T)).toBe(1);
    expect(levelOf(19.999, T)).toBe(1);
    expect(levelOf(20, T)).toBe(2);
    expect(levelOf(59.999, T)).toBe(2);
    expect(levelOf(60, T)).toBe(3);
    expect(levelOf(84.999, T)).toBe(3);
    expect(levelOf(85, T)).toBe(4);
    expect(levelOf(96.999, T)).toBe(4);
    expect(levelOf(97, T)).toBe(5);
    expect(levelOf(500, T)).toBe(5);
  });
});

describe('needle', () => {
  const t = thresholds(daily(ONE_TO_HUNDRED));
  const sorted = ONE_TO_HUNDRED;

  it('has five equal segments bounded at P0/P20/P60/P85/P97/P100', () => {
    expect(LEVEL_BOUNDS).toEqual([0, 20, 60, 85, 97, 100]);
  });

  it('is segment index + share within the level in percentile space', () => {
    expect(needle(10, t, sorted)).toBeCloseTo(0.5, 12); // rank 10 of 0..20
    expect(needle(40, t, sorted)).toBeCloseTo(1.5, 12); // rank 40 of 20..60
    expect(needle(72.5, t, sorted)).toBeCloseTo(2 + 12 / 25, 12); // rank 72 of 60..85
    expect(needle(90, t, sorted)).toBeCloseTo(3 + 5 / 12, 12); // rank 90 of 85..97
    expect(needle(98.5, t, sorted)).toBeCloseTo(4 + 1 / 3, 12); // rank 98 of 97..100
  });

  it('starts each level at its lower bound', () => {
    expect(needle(t.p20, t, sorted)).toBeCloseTo(1, 12);
    expect(needle(t.p60, t, sorted)).toBeCloseTo(2, 12);
    expect(needle(0, t, sorted)).toBe(0);
  });

  it('clamps at the historical maximum and above', () => {
    expect(needle(100, t, sorted)).toBe(5);
    expect(needle(250, t, sorted)).toBe(5);
  });

  it('stays inside the level when threshold and empirical rank disagree', () => {
    // level 2 by threshold, but rank 16 is below the P20 bound → share clamped to 0
    expect(needle(16, { ...t, p20: 15 }, sorted)).toBe(1);
    // level 1 by threshold, rank 25 above the P20 bound → share clamped to 1
    expect(needle(25, { ...t, p20: 30 }, sorted)).toBe(1);
  });

  it('turns into a gauge angle from −180° (left) to 0° (right)', () => {
    expect(needleAngle(0)).toBe(-180);
    expect(needleAngle(2.5)).toBe(-90);
    expect(needleAngle(5)).toBe(0);
    expect(needleAngle(-1)).toBe(-180);
    expect(needleAngle(7)).toBe(0);
  });
});
