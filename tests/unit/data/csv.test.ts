import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  RAW_HEADER,
  parseEcbCsv,
  parseRawCsv,
  serializeRawCsv,
  splitCsvLine,
} from '@/lib/data/csv';

const FIX = 'tests/fixtures/data';

describe('raw format', () => {
  it('parses and serialises without loss (seed file round trip)', () => {
    const text = readFileSync('data/raw/ecb-eur-reference.csv', 'utf8');
    const rows = parseRawCsv(text);
    expect(rows[0]).toEqual({ date: '1999-01-04', USD: 1.1789, CHF: 1.6168, JPY: 133.73 });
    expect(serializeRawCsv(rows)).toBe(text);
  });

  it('reads CRLF, a BOM and empty cells (as NaN) and writes empty cells back', () => {
    const rows = parseRawCsv(`\uFEFF${RAW_HEADER}\r\n2026-01-05,1.1,,150\r\n\r\n`);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.USD).toBe(1.1);
    expect(rows[0]!.CHF).toBeNaN();
    expect(serializeRawCsv(rows)).toBe(`${RAW_HEADER}\n2026-01-05,1.1,,150\n`);
  });

  it('reads non-numeric cells as NaN', () => {
    const rows = parseRawCsv(`${RAW_HEADER}\n2026-01-05,abc,NaN,1e400`);
    expect(rows[0]!.USD).toBeNaN();
    expect(rows[0]!.CHF).toBeNaN();
    expect(rows[0]!.JPY).toBeNaN();
  });

  it('rejects a wrong header', () => {
    expect(() => parseRawCsv('date,CHF,USD,JPY\n')).toThrow(/Unexpected header/);
    expect(() => parseRawCsv('')).toThrow(/Unexpected header ""/);
  });
});

describe('CSV line splitting', () => {
  it('handles quotes, commas in quotes and escaped quotes', () => {
    expect(splitCsvLine('a,"b, c",d')).toEqual(['a', 'b, c', 'd']);
    expect(splitCsvLine('"say ""hi""",,x')).toEqual(['say "hi"', '', 'x']);
    expect(splitCsvLine('')).toEqual(['']);
  });
});

describe('ECB csvdata parser', () => {
  it('pivots the fixture into raw rows, sorted by date', () => {
    const { rows, skipped } = parseEcbCsv(readFileSync(`${FIX}/ecb-csvdata.csv`, 'utf8'));
    expect(skipped).toBe(0);
    expect(rows).toHaveLength(30);
    expect(rows[0]!.date).toBe('2026-08-04');
    expect(rows[29]).toEqual({ date: '2026-09-14', USD: 1.1551, CHF: 0.9431, JPY: 178.52 });
    // the same values as the raw file (the fixture was cut from the seed)
    const raw = parseRawCsv(readFileSync('data/raw/ecb-eur-reference.csv', 'utf8'));
    expect(rows).toEqual(raw.filter((r) => r.date >= '2026-08-04' && r.date <= '2026-09-14'));
  });

  it('skips other currencies and empty values, keeps gaps as NaN', () => {
    const text = [
      'TIME_PERIOD,CURRENCY,OBS_VALUE,TITLE_COMPL',
      '2026-01-06,CHF,0.93,"rate, CHF"',
      '2026-01-05,USD,1.17,"rate, USD"',
      '2026-01-05,CHF,0.94,"rate, CHF"',
      '2026-01-05,JPY,180.1,"rate, JPY"',
      '2026-01-05,GBP,0.87,"rate, GBP"',
      '2026-01-06,USD,,"rate, USD"',
      '2026-01-06,JPY,NaN,"rate, JPY"',
    ].join('\n');
    const { rows, skipped } = parseEcbCsv(text);
    expect(skipped).toBe(3);
    expect(rows.map((r) => r.date)).toEqual(['2026-01-05', '2026-01-06']);
    expect(rows[0]).toEqual({ date: '2026-01-05', USD: 1.17, CHF: 0.94, JPY: 180.1 });
    expect(rows[1]!.CHF).toBe(0.93);
    expect(rows[1]!.USD).toBeNaN();
    expect(rows[1]!.JPY).toBeNaN();
  });

  it('sorts unordered dates and requires the key columns', () => {
    const text =
      'CURRENCY,TIME_PERIOD,OBS_VALUE\nUSD,2026-01-07,1\nUSD,2026-01-05,1\nUSD,2026-01-06,1\nUSD,2026-01-06,2';
    const { rows } = parseEcbCsv(text);
    expect(rows.map((r) => [r.date, r.USD])).toEqual([
      ['2026-01-05', 1],
      ['2026-01-06', 2],
      ['2026-01-07', 1],
    ]);
    expect(() => parseEcbCsv('DATE,CURRENCY,VALUE\n')).toThrow(/TIME_PERIOD/);
    expect(() => parseEcbCsv('')).toThrow(/TIME_PERIOD/);
  });
});
