import { describe, expect, it } from 'vitest';
import {
  bankDaysBetween,
  dayNumber,
  isIsoDate,
  isoFromDayNumber,
  isoWeekStart,
  todayIso,
  weekday,
} from '@/lib/data/dates';

describe('ISO date helpers', () => {
  it('recognises real calendar dates only', () => {
    expect(isIsoDate('2024-02-29')).toBe(true);
    expect(isIsoDate('2023-02-29')).toBe(false);
    expect(isIsoDate('2015-13-01')).toBe(false);
    expect(isIsoDate('2015-1-5')).toBe(false);
    expect(isIsoDate('15.01.2015')).toBe(false);
  });

  it('converts to day numbers and back', () => {
    expect(dayNumber('1970-01-01')).toBe(0);
    expect(dayNumber('1970-01-02')).toBe(1);
    expect(isoFromDayNumber(dayNumber('2015-01-15'))).toBe('2015-01-15');
    expect(() => dayNumber('2015-02-30')).toThrow(/Invalid ISO date/);
  });

  it('knows the weekday and the Monday of the ISO week', () => {
    expect(weekday('2015-01-15')).toBe(4); // Thursday
    expect(weekday('2026-09-14')).toBe(1); // Monday
    expect(weekday('2026-09-13')).toBe(7); // Sunday
    expect(weekday('1969-12-31')).toBe(3); // before the epoch
    expect(isoWeekStart('2026-09-13')).toBe('2026-09-07');
    expect(isoWeekStart('2026-09-14')).toBe('2026-09-14');
    expect(isoWeekStart('2021-01-01')).toBe('2020-12-28'); // week spans the year boundary
  });

  it('counts bank business days (Mon–Fri) after `from` up to `to`', () => {
    expect(bankDaysBetween('2026-09-11', '2026-09-14')).toBe(1); // Fri → Mon
    expect(bankDaysBetween('2026-09-14', '2026-09-14')).toBe(0);
    expect(bankDaysBetween('2026-09-14', '2026-09-21')).toBe(5);
    expect(bankDaysBetween('2026-09-12', '2026-09-13')).toBe(0); // Sat → Sun
    expect(bankDaysBetween('2026-09-14', '2026-09-11')).toBe(-1);
    expect(bankDaysBetween('2026-09-14', '2026-10-22')).toBe(28);
  });

  it('gives today in UTC', () => {
    expect(todayIso(new Date('2026-10-22T23:30:00Z'))).toBe('2026-10-22');
    expect(todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
