import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseRawCsv, type RawRow } from '@/lib/data/csv';
import {
  DEFAULT_WHITELIST,
  MAX_ABS_LOG_RETURN,
  checkContinuity,
  largeMoves,
  validate,
} from '@/lib/data/validate';

/** The seed snapshot (D-15); later fixings appended by a manual Release run are not part of these tests. */
const SEED = parseRawCsv(readFileSync('data/raw/ecb-eur-reference.csv', 'utf8')).filter(
  (r) => r.date <= '2026-09-14',
);

/** A clean week of fixings (Mon 2026-09-07 … Mon 2026-09-14). */
function week(): RawRow[] {
  return [
    { date: '2026-09-07', USD: 1.16, CHF: 0.94, JPY: 179 },
    { date: '2026-09-08', USD: 1.161, CHF: 0.941, JPY: 179.2 },
    { date: '2026-09-09', USD: 1.159, CHF: 0.942, JPY: 178.9 },
    { date: '2026-09-10', USD: 1.1616, CHF: 0.9432, JPY: 179.09 },
    { date: '2026-09-11', USD: 1.1592, CHF: 0.9451, JPY: 178.56 },
    { date: '2026-09-14', USD: 1.1551, CHF: 0.9431, JPY: 178.52 },
  ];
}
const rules = (rows: RawRow[], opts = {}) => validate(rows, opts).map((e) => e.rule);

describe('validation rules', () => {
  it('accepts clean data (with and without today)', () => {
    expect(validate(week())).toEqual([]);
    expect(validate(week(), { today: '2026-09-14' })).toEqual([]);
    expect(validate(week(), { today: '2026-09-21' })).toEqual([]); // 5 bank days
  });

  it('empty: needs at least one row', () => {
    expect(rules([])).toEqual(['empty']);
  });

  it('date: rejects invalid dates (and skips the age check then)', () => {
    const rows = week();
    rows[5]!.date = '2026-09-31';
    expect(rules(rows, { today: '2026-09-14' })).toEqual(['date']);
  });

  it('order and duplicate: dates strictly ascending', () => {
    const swapped = week();
    [swapped[1], swapped[2]] = [swapped[2]!, swapped[1]!];
    expect(rules(swapped)).toEqual(['order']);
    const dup = week();
    dup[3]!.date = dup[2]!.date;
    expect(rules(dup)).toEqual(['duplicate']);
  });

  it('rate: every rate must be a finite number > 0', () => {
    for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const rows = week();
      rows[3]!.CHF = bad;
      const errs = validate(rows);
      expect(errs.map((e) => e.rule)).toEqual(['rate']);
      expect(errs[0]!.date).toBe('2026-09-10');
    }
    const missing = week();
    missing[3]!.USD = Number.NaN;
    expect(validate(missing)[0]!.message).toMatch(/USD per EUR must be a number > 0, got ""/);
  });

  it('stale: last fixing at most 5 bank days old', () => {
    expect(rules(week(), { today: '2026-09-22' })).toEqual(['stale']); // 6 bank days
    expect(rules(week(), { today: '2026-09-15', maxAgeBankDays: 0 })).toEqual(['stale']);
    // weekends do not count: Mon 14.09 → Sun 20.09 is 4 bank days, → Mon 21.09 is 5
    expect(rules(week(), { today: '2026-09-20' })).toEqual([]);
  });

  it('future: no fixing after today', () => {
    expect(rules(week(), { today: '2026-09-11' })).toEqual(['future']);
  });

  it('jump: |daily log return| < 10 % for all four pairs, cross rates included', () => {
    expect(MAX_ABS_LOG_RETURN).toBe(0.1);
    const chf = week();
    chf[5]!.CHF = 0.84; // EUR/CHF −11.6 % and USD/CHF as well
    expect(validate(chf).map((e) => [e.rule, e.pair])).toEqual([
      ['jump', 'EUR/CHF'],
      ['jump', 'USD/CHF'],
    ]);
    const jpy = week();
    jpy[5]!.JPY = 1785.2; // decimal-point error
    expect(validate(jpy).map((e) => [e.pair, e.date])).toEqual([['USD/JPY', '2026-09-14']]);
    const usd = week();
    usd[5]!.USD = 1.3; // moves EUR/USD and both USD crosses
    expect(validate(usd).map((e) => e.pair)).toEqual(['EUR/USD', 'USD/CHF', 'USD/JPY']);
    // just below the bound passes
    const ok = week();
    ok[5]!.CHF = ok[4]!.CHF * Math.exp(-0.0999);
    expect(validate(ok)).toEqual([]);
  });

  it('jump: documented whitelist only for the listed date and pair', () => {
    expect(DEFAULT_WHITELIST.map((w) => `${w.date} ${w.pair}`)).toEqual([
      '2015-01-15 EUR/CHF',
      '2015-01-15 USD/CHF',
    ]);
    const chf = week();
    chf[5]!.CHF = 0.84;
    const wl = [{ date: '2026-09-14', pair: 'EUR/CHF' as const, reason: 'test' }];
    expect(validate(chf, { whitelist: wl }).map((e) => e.pair)).toEqual(['USD/CHF']);
    expect(validate(chf, { maxAbsLogReturn: 0.2 })).toEqual([]);
  });
});

describe('seed data (data/raw, 1999-01-04 … 2026-09-14)', () => {
  it('passes every rule; the only daily moves ≥ 10 % are the whitelisted 15.01.2015', () => {
    expect(validate(SEED)).toEqual([]);
    const big = largeMoves(SEED);
    expect(big.map((m) => `${m.date} ${m.pair}`)).toEqual([
      '2015-01-15 EUR/CHF',
      '2015-01-15 USD/CHF',
    ]);
    expect(big[0]!.logReturn).toBeCloseTo(Math.log(1.028 / 1.201), 12);
    // without the whitelist the franc shock is reported
    expect(validate(SEED, { whitelist: [] }).map((e) => e.pair)).toEqual(['EUR/CHF', 'USD/CHF']);
  });

  it('the next largest days stay well below the bound', () => {
    const big = largeMoves(SEED, 0.05).filter((m) => m.date !== '2015-01-15');
    expect(big.map((m) => `${m.date} ${m.pair}`)).toEqual([
      '2011-09-06 EUR/CHF',
      '2008-12-18 USD/CHF',
      '2008-12-19 USD/CHF',
      '2011-09-06 USD/CHF',
    ]);
    for (const m of big) expect(Math.abs(m.logReturn)).toBeLessThan(0.085);
  });

  it('is reported as stale on 22.10.2026 (a manual Release run refreshes it)', () => {
    const errs = validate(SEED, { today: '2026-10-22' });
    expect(errs.map((e) => e.rule)).toEqual(['stale']);
    expect(errs[0]!.message).toMatch(/28 bank days/);
  });
});

describe('continuity with the versioned file', () => {
  it('accepts appended fixings and reports revisions', () => {
    const prev = week().slice(0, 5);
    const next = week();
    next[1] = { ...next[1]!, USD: 1.1611 };
    const c = checkContinuity(prev, next);
    expect(c.errors).toEqual([]);
    expect(c.added).toBe(1);
    expect(c.revised).toEqual(['2026-09-08']);
    expect(checkContinuity([], next)).toEqual({ errors: [], added: 6, revised: [] });
  });

  it('rejects a download that lost history or ends earlier', () => {
    const prev = week();
    const missing = checkContinuity(prev, [...prev.slice(0, 2), ...prev.slice(3)]);
    expect(missing.errors.map((e) => e.rule)).toEqual(['continuity']);
    expect(missing.errors[0]!.message).toMatch(/1 date\(s\).*first 2026-09-09/);
    const shorter = checkContinuity(prev, prev.slice(0, 4));
    expect(shorter.errors.map((e) => e.message)).toEqual([
      expect.stringMatching(/2 date\(s\)/),
      expect.stringMatching(/ends 2026-09-10, before the existing 2026-09-14/),
    ]);
    expect(checkContinuity(prev, []).errors[1]!.message).toMatch(/ends \(empty\)/);
  });
});
