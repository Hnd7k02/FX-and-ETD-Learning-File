import { describe, expect, it } from 'vitest';
import { NUMS, NUM_FILES, formatNum, getNum } from '@/lib/nums';

describe('number registry', () => {
  it('prefixes every key with its file namespace and has no duplicates', () => {
    const seen = new Set<string>();
    for (const [ns, table] of Object.entries(NUM_FILES)) {
      for (const key of Object.keys(table)) {
        expect(key.startsWith(`${ns}.`), `${key} in ${ns}.ts`).toBe(true);
        expect(seen.has(key), `duplicate ${key}`).toBe(false);
        seen.add(key);
      }
    }
  });

  it('holds only finite numbers', () => {
    for (const [k, d] of Object.entries(NUMS)) expect(Number.isFinite(d.value), k).toBe(true);
  });

  it('formats every entry in both languages', () => {
    for (const d of Object.values(NUMS)) {
      expect(formatNum(d, 'de')).not.toBe('');
      expect(formatNum(d, 'en')).not.toBe('');
    }
  });

  it('formats the example inputs the Swiss way', () => {
    expect(formatNum(getNum('ex.spot'), 'de')).toBe('0.8000');
    expect(formatNum(getNum('ex.strike'), 'de')).toBe('0.7930');
    expect(formatNum(getNum('ex.vol'), 'de')).toBe('8 %');
    expect(formatNum(getNum('ex.notional'), 'de')).toBe('USD 1’000’000');
    expect(formatNum({ value: 0.5, kind: 'rate', sign: true }, 'de')).toBe('+0.5000');
    expect(formatNum({ value: 1.5, kind: 'num' }, 'en', { digits: 1 })).toBe('1.5');
    expect(formatNum({ value: -69.7, kind: 'pips' }, 'de')).toBe('−69.7');
    expect(() => getNum('nope.nope')).toThrow();
  });
});
