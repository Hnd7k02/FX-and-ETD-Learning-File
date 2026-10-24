import { describe, expect, it } from 'vitest';
import {
  fmtDate,
  fmtDateLong,
  fmtMillions,
  fmtMoney,
  fmtMonthYear,
  fmtNumber,
  fmtPct,
  fmtPctValue,
  fmtPips,
  fmtRate,
  isJpyPair,
  pipSize,
  toPips,
} from '@/lib/format';

describe('fmtNumber', () => {
  it('uses the Swiss apostrophe in German and a comma in English', () => {
    expect(fmtNumber(12669.4, 'de')).toBe('12’669');
    expect(fmtNumber(12669.4, 'en')).toBe('12,669');
    expect(fmtNumber(1234567.891, 'de', { digits: 2 })).toBe('1’234’567.89');
  });
  it('uses the typographic minus and optional plus sign', () => {
    expect(fmtNumber(-30.82, 'de', { digits: 2 })).toBe('−30.82');
    expect(fmtNumber(976, 'de', { sign: true })).toBe('+976');
    expect(fmtNumber(-0.0001, 'de', { digits: 2 })).toBe('0.00');
    expect(fmtNumber(0, 'de', { sign: true })).toBe('0');
  });
  it('handles non-finite values', () => {
    expect(fmtNumber(Infinity, 'de')).toBe('∞');
    expect(fmtNumber(-Infinity, 'de')).toBe('−∞');
    expect(fmtNumber(NaN, 'de')).toBe('–');
  });
  it('can switch grouping off', () => {
    expect(fmtNumber(12669, 'de', { group: false })).toBe('12669');
  });
});

describe('rates and pips', () => {
  it('formats rates with 4 decimals, JPY pairs with 2', () => {
    expect(fmtRate(0.793)).toBe('0.7930');
    expect(fmtRate(147.256, 'USD/JPY')).toBe('147.26');
    expect(fmtRate(0.79303, 'USD/CHF', 5)).toBe('0.79303');
  });
  it('knows pip sizes', () => {
    expect(isJpyPair('usd/jpy')).toBe(true);
    expect(pipSize('USD/CHF')).toBe(0.0001);
    expect(pipSize('USD/JPY')).toBe(0.01);
    expect(toPips(-0.00697)).toBeCloseTo(-69.7, 10);
    expect(fmtPips(126.69, 'de', 2)).toBe('126.69');
    expect(fmtPips(-69.7, 'en', 1, true)).toBe('−69.7');
  });
});

describe('percent and money', () => {
  it('adds a no-break space before % in German only', () => {
    expect(fmtPct(0.08, 'de', 0)).toBe('8 %');
    expect(fmtPct(0.08, 'en', 0)).toBe('8%');
    expect(fmtPctValue(6.04, 'de')).toBe('6.0 %');
    expect(fmtPct(-0.0075, 'de', 2)).toBe('−0.75 %');
  });
  it('formats money with a no-break space after the currency', () => {
    expect(fmtMoney(12669, 'CHF', 'de')).toBe('CHF 12’669');
    expect(fmtMoney(-1008, 'CHF', 'en', 0, true)).toBe('CHF −1,008');
    expect(fmtMillions(1_000_000, 'USD', 'de')).toBe('USD 1 Mio.');
    expect(fmtMillions(1_000_000, 'USD', 'en')).toBe('USD 1m');
  });
});

describe('dates', () => {
  it('formats ISO dates per language', () => {
    expect(fmtDate('2015-01-15', 'de')).toBe('15.01.2015');
    expect(fmtDate('2015-01-15', 'en')).toBe('15 Jan 2015');
    expect(fmtMonthYear('2008-11-06', 'de')).toBe('Nov. 2008');
    expect(fmtDateLong('2015-01-15', 'de')).toBe('15. Januar 2015');
    expect(fmtDateLong('2015-01-15', 'en')).toBe('15 January 2015');
  });
  it('rejects malformed dates', () => {
    expect(() => fmtDate('15.01.2015', 'de')).toThrow();
  });
});
