import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MODULE_SLUGS } from '@/data/modules';
import { parseRawCsv } from '@/lib/data/csv';
import { bankDaysBetween } from '@/lib/data/dates';
import {
  PEAK_RANGE,
  PLACEHOLDERS,
  eventMetrics,
  eventTexts,
  eventVars,
  eventsForPair,
  parseEvents,
  type EventMetrics,
  type MarketEvent,
} from '@/lib/data/events';
import { levelOf } from '@/lib/data/levels';
import { PAIRS, pairSeries, type Pair } from '@/lib/data/series';
import { thresholds, type Thresholds } from '@/lib/data/stats';
import { realisedVol } from '@/lib/data/vol';
import { LANGS } from '@/i18n/types';

const RAW_EVENTS: unknown = JSON.parse(readFileSync('src/data/events.json', 'utf8'));
const EVENTS = parseEvents(RAW_EVENTS);
const SEED = parseRawCsv(readFileSync('data/raw/ecb-eur-reference.csv', 'utf8'));

const series = Object.fromEntries(PAIRS.map((p) => [p, pairSeries(SEED, p)])) as Record<
  Pair,
  ReturnType<typeof pairSeries>
>;
const vols = Object.fromEntries(PAIRS.map((p) => [p, realisedVol(series[p])])) as Record<
  Pair,
  ReturnType<typeof realisedVol>
>;
const ths = Object.fromEntries(PAIRS.map((p) => [p, thresholds(vols[p])])) as Record<Pair, Thresholds>;
const ev = (id: string) => EVENTS.find((e) => e.id === id)!;
const metrics = (id: string, pair: Pair) => eventMetrics(ev(id), series[pair], vols[pair], ths[pair]);

describe('events.json', () => {
  it('holds the six events of MASTER_PROMPT §9 with their anchors and pairs', () => {
    expect(EVENTS.map((e) => [e.id, e.anchorDate, e.pairs.join(' ')])).toEqual([
      ['gfc-2008', '2008-09-15', 'EUR/CHF EUR/USD USD/CHF USD/JPY'],
      ['floor-2011', '2011-09-06', 'EUR/CHF USD/CHF'],
      ['chf-shock-2015', '2015-01-15', 'EUR/CHF USD/CHF'],
      ['ukraine-2022', '2022-02-24', 'EUR/CHF EUR/USD'],
      ['carry-2024', '2024-08-05', 'EUR/CHF USD/JPY'],
      ['fiscal-2025', '2025-03-05', 'EUR/CHF EUR/USD'],
    ]);
  });

  it('links existing modules', () => {
    for (const e of EVENTS) for (const m of e.modules) expect(MODULE_SLUGS, `${e.id} → ${m}`).toContain(m);
  });

  it('names sources that exist in src/content/sources', () => {
    const dir = 'src/content/sources';
    const files = ['src/content/sources.md', ...readdirSync(dir).map((f) => join(dir, f))];
    const ids = new Set<string>();
    for (const f of files.filter((x) => existsSync(x) && x.endsWith('.md'))) {
      for (const m of readFileSync(f, 'utf8').matchAll(/^##\s+([a-z0-9][a-z0-9-]*)\s*$/gm)) ids.add(m[1]!);
    }
    for (const e of EVENTS) for (const s of e.sources) expect(ids.has(s), `${e.id} → ${s}`).toBe(true);
  });

  it('fills every text completely for every pair and language', () => {
    for (const e of EVENTS) {
      for (const pair of e.pairs) {
        const m = metrics(e.id, pair);
        for (const lang of LANGS) {
          const t = eventTexts(e, pair, lang, m);
          for (const s of [t.title, t.dateLabel, t.what, ...t.means]) {
            expect(s, `${e.id} ${pair} ${lang}`).not.toMatch(/[{}]|undefined|NaN/);
          }
          expect(t.means.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('contains no typed-in value that the data computes', () => {
    for (const e of EVENTS) {
      const raw = JSON.stringify(e);
      for (const pair of e.pairs) {
        const m = metrics(e.id, pair);
        for (const lang of LANGS) {
          const v = eventVars(m, pair, lang);
          for (const k of ['from', 'to', 'movePct', 'moveAbsPct', 'dayMoveAbsPct', 'volBefore', 'peak'] as const) {
            expect(raw.includes(v[k]), `${e.id} ${pair}: "${v[k]}" (${k}) must be a placeholder`).toBe(false);
          }
        }
      }
    }
  });
});

describe('parseEvents rejects broken data', () => {
  const base = (RAW_EVENTS as Record<string, unknown>[])[2]!; // chf-shock-2015
  const clone = () => JSON.parse(JSON.stringify(base)) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const cases: [string, (e: Record<string, any>) => unknown, RegExp][] = [ // eslint-disable-line @typescript-eslint/no-explicit-any
    ['not an object', () => 5, /must be an object/],
    ['bad id', (e) => ({ ...e, id: 'Bad Id' }), /bad id/],
    ['bad anchor date', (e) => ({ ...e, anchorDate: '2015-02-30' }), /anchorDate must be an ISO date/],
    ['missing year', (e) => ({ ...e, year: '' }), /year must be a text/],
    ['empty pairs', (e) => ({ ...e, pairs: [] }), /non-empty list of pairs/],
    ['unknown pair', (e) => ({ ...e, pairs: ['EUR/GBP'] }), /unknown pair EUR\/GBP/],
    ['window not an object', (e) => ({ ...e, window: '2015' }), /window must be/],
    ['window order', (e) => ({ ...e, window: { from: '2015-01-20', to: '2015-01-14' } }), /from < to/],
    ['anchor outside window', (e) => ({ ...e, window: { from: '2015-01-16', to: '2015-01-23' } }), /from ≤ anchorDate/],
    ['bad peak range', (e) => ({ ...e, peakRange: { before: -1, after: 5 } }), /peakRange/],
    ['peak range not an object', (e) => ({ ...e, peakRange: 3 }), /peakRange/],
    ['title missing en', (e) => ({ ...e, title: { de: 'x' } }), /title\.en must be a non-empty text/],
    ['title not bilingual', (e) => ({ ...e, title: 'x' }), /title must be \{de, en\}/],
    ['placeholder in title', (e) => ({ ...e, title: { de: '{pair}', en: 'x' } }), /may not contain placeholders/],
    ['unknown placeholder', (e) => ({ ...e, what: { de: '{price}', en: 'x' } }), /unknown placeholder \{price\}/],
    ['pairNote not an object', (e) => ({ ...e, pairNote: [] }), /pairNote must be an object/],
    ['pairNote for other pair', (e) => ({ ...e, pairNote: { 'USD/JPY': { de: 'x', en: 'y' } } }), /not a pair of the event/],
    ['no means', (e) => ({ ...e, means: [] }), /means must be a list/],
    ['means pair outside event', (e) => ({ ...e, means: [{ de: 'x', en: 'y', pairs: ['EUR/USD'] }] }), /not a pair of the event/],
    ['no modules', (e) => ({ ...e, modules: [] }), /modules must be a non-empty list/],
    ['bad source id', (e) => ({ ...e, sources: ['SNB 2015'] }), /bad id/],
  ];

  it.each(cases)('%s', (_name, mutate, re) => {
    expect(() => parseEvents([mutate(clone())])).toThrow(re);
  });

  it('rejects a non-list and duplicate ids', () => {
    expect(() => parseEvents({})).toThrow(/top level must be a list/);
    expect(() => parseEvents([clone(), clone()])).toThrow(/duplicate id chf-shock-2015/);
  });

  it('keeps optional fields only when present', () => {
    const e = clone();
    delete e.pairNote;
    e.means = [{ de: 'a', en: 'b' }];
    const [p] = parseEvents([e]);
    expect(p!.pairNote).toBeUndefined();
    expect(p!.peakRange).toBeUndefined();
    expect(p!.means).toEqual([{ de: 'a', en: 'b' }]);
    expect(parseEvents([{ ...clone(), peakRange: { before: 0, after: 20 } }])[0]!.peakRange).toEqual({
      before: 0,
      after: 20,
    });
  });
});

describe('event metrics on the fixture (Oct 2014 – Apr 2015)', () => {
  const rows = parseRawCsv(readFileSync('tests/fixtures/data/raw-2014-10-to-2015-04.csv', 'utf8'));
  const s = pairSeries(rows, 'EUR/CHF');
  const vol = realisedVol(s);
  const t: Thresholds = { p20: 3, p60: 5, p85: 8, p97: 12, max: 55.777062559107236, maxDate: '2015-02-12', days: 1 };
  const shock = ev('chf-shock-2015');
  const m = eventMetrics(shock, s, vol, t);

  /** Independent vol calculation: 21 log returns ending at the given date. */
  function volAt(date: string): number {
    const i = s.findIndex((p) => p.date === date);
    let ss = 0;
    for (let k = i - 20; k <= i; k++) ss += Math.log(s[k]!.value / s[k - 1]!.value) ** 2;
    return Math.sqrt(ss / 21) * Math.sqrt(252) * 100;
  }

  it('takes the first fixing on/after window.from and the last on/before window.to', () => {
    expect([m.fromDate, m.from, m.toDate, m.to]).toEqual(['2015-01-14', 1.201, '2015-01-23', 0.9816]);
    expect(m.movePct).toBeCloseTo((0.9816 / 1.201 - 1) * 100, 12);
    // window edges on non-fixing days snap inwards
    const w = eventMetrics({ ...shock, window: { from: '2015-01-10', to: '2015-01-25' } }, s, vol, t);
    expect([w.fromDate, w.toDate]).toEqual(['2015-01-12', '2015-01-23']);
  });

  it('measures the anchor-day move and the vol before it', () => {
    expect(m.dayDate).toBe('2015-01-15');
    expect(m.dayMovePct).toBeCloseTo((1.028 / 1.201 - 1) * 100, 12);
    expect(m.volBefore).toBeCloseTo(volAt('2015-01-14'), 12);
  });

  it('finds the peak from 10 trading days before to 60 after the anchor', () => {
    expect(PEAK_RANGE).toEqual({ before: 10, after: 60 });
    const a = s.findIndex((p) => p.date === '2015-01-15');
    let best = { v: -1, d: '' };
    for (let i = a - 10; i <= Math.min(a + 60, s.length - 1); i++) {
      const v = volAt(s[i]!.date);
      if (v > best.v) best = { v, d: s[i]!.date };
    }
    expect(m.peak).toBeCloseTo(best.v, 12);
    expect(m.peakDate).toBe(best.d);
    expect(m.peakDate).toBe('2015-02-12');
    expect(m.peakLevel).toBe(5);
    expect(m.isRecord).toBe(true);
  });

  it('honours a narrower peak range', () => {
    const n = eventMetrics({ ...shock, peakRange: { before: 0, after: 5 } }, s, vol, t);
    expect(n.peakDate).toBe('2015-01-22');
    expect(n.isRecord).toBe(false);
  });

  it('fails clearly when the data does not cover the event', () => {
    const late = { ...shock, id: 'x', anchorDate: '2016-01-04', window: { from: '2016-01-01', to: '2016-01-08' } };
    expect(() => eventMetrics(late, s, vol, t)).toThrow(/no fixings in window/);
    const early = { ...shock, id: 'y', anchorDate: '2014-10-01', window: { from: '2014-10-01', to: '2014-10-03' } };
    expect(() => eventMetrics(early, s, vol, t)).toThrow(/outside the data/);
    const noVol = { ...shock, id: 'z', anchorDate: '2014-10-10', window: { from: '2014-10-01', to: '2014-10-20' } };
    expect(() => eventMetrics(noVol, s, vol, t)).toThrow(/no vol around/);
  });

  it('formats the placeholders in Swiss German and British English', () => {
    expect(PLACEHOLDERS).toHaveLength(14);
    const de = eventVars(m, 'EUR/CHF', 'de');
    expect(de).toEqual({
      pair: 'EUR/CHF',
      from: '1.2010',
      to: '0.9816',
      fromDate: '14.01.2015',
      toDate: '23.01.2015',
      movePct: '−18.3 %',
      moveAbsPct: '18.3 %',
      dayDate: '15.01.2015',
      dayMovePct: '−14.4 %',
      dayMoveAbsPct: '14.4 %',
      volBefore: de.volBefore,
      peak: '55.8 %',
      peakDate: '12.02.2015',
      peakLevel: 'Extrem',
    });
    expect(de.volBefore).toMatch(/^1\.3 %$/);
    const en = eventVars(m, 'EUR/CHF', 'en');
    expect([en.movePct, en.fromDate, en.peakLevel]).toEqual(['−18.3%', '14 Jan 2015', 'Extreme']);
    const jpy = eventVars({ ...m, from: 153.8689, to: 142.2396 } as EventMetrics, 'USD/JPY', 'de');
    expect([jpy.from, jpy.to]).toEqual(['153.87', '142.24']);
  });

  it('builds texts per pair: pair note appended, means filtered by pair', () => {
    const de = eventTexts(shock, 'EUR/CHF', 'de', m);
    expect(de.title).toBe('Frankenschock');
    expect(de.what).toContain('−0.75 %');
    expect(de.what).toContain('liegt EUR/CHF 14.4 % tiefer');
    expect(de.means.some((x) => x.startsWith('Ruhe vor dem Sturm'))).toBe(true);
    const usd = eventTexts(shock, 'USD/CHF', 'en', m);
    expect(usd.what).toContain('USD/CHF is 14.4% lower');
    expect(usd.means.some((x) => x.startsWith('Calm before the storm'))).toBe(false);
    const noNote: MarketEvent = { ...shock, pairNote: undefined };
    expect(eventTexts(noNote, 'EUR/CHF', 'en', m).what).toBe(shock.what.en);
  });

  it('lists the events of a pair', () => {
    expect(eventsForPair(EVENTS, 'USD/JPY').map((e) => e.id)).toEqual(['gfc-2008', 'carry-2024']);
    expect(eventsForPair(EVENTS, 'EUR/CHF')).toHaveLength(6);
  });
});

/**
 * The event texts make qualitative statements ("falls", "lowest since January 2015", "the peak
 * comes late"). These tests check each statement against the ECB data, so a text can never
 * contradict the numbers shown next to it.
 */
describe('statements in the event texts hold in the data', () => {
  it('2008: the euro loses against franc and dollar, the yen gains, USD/CHF moves least', () => {
    expect(metrics('gfc-2008', 'EUR/CHF').movePct).toBeLessThan(0);
    expect(metrics('gfc-2008', 'EUR/USD').movePct).toBeLessThan(0);
    expect(metrics('gfc-2008', 'USD/JPY').movePct).toBeLessThan(0);
    const usdchf = Math.abs(metrics('gfc-2008', 'USD/CHF').movePct);
    expect(usdchf).toBeLessThan(Math.abs(metrics('gfc-2008', 'EUR/CHF').movePct));
    expect(usdchf).toBeLessThan(Math.abs(metrics('gfc-2008', 'EUR/USD').movePct));
  });

  it('2008: vol rises and the peak comes weeks after the anchor for every pair', () => {
    for (const p of PAIRS) {
      const m = metrics('gfc-2008', p);
      expect(m.peak, p).toBeGreaterThan(m.volBefore);
      expect(bankDaysBetween(m.dayDate, m.peakDate), p).toBeGreaterThanOrEqual(20);
    }
  });

  it('2011: EUR/CHF close to parity, one-day jump up, vol already high, cliff after 21 days', () => {
    const m = metrics('floor-2011', 'EUR/CHF');
    expect(m.from).toBeLessThan(1.05);
    expect(m.toDate).toBe(m.dayDate);
    expect(m.dayMovePct).toBeGreaterThan(5);
    expect(metrics('floor-2011', 'USD/CHF').dayMovePct).toBeGreaterThan(5);
    expect(levelOf(m.volBefore, ths['EUR/CHF'])).toBe(5);
    const v = vols['EUR/CHF'];
    const i = v.findIndex((p) => p.date === '2011-09-06');
    expect(v[i + 20]!.value).toBeGreaterThan(20); // still in the window
    expect(v[i + 21]!.value).toBeLessThan(v[i + 20]!.value / 2); // jump drops out
  });

  it('2011–2014: EUR/CHF vol mostly at level Ruhig under the floor', () => {
    const under = vols['EUR/CHF'].filter((p) => p.date >= '2012-01-01' && p.date <= '2014-12-31');
    const calm = under.filter((p) => levelOf(p.value, ths['EUR/CHF']) === 1).length;
    expect(calm / under.length).toBeGreaterThan(0.5);
  });

  it('2015: both CHF pairs fall on the day, vol was calm before for EUR/CHF', () => {
    for (const p of ['EUR/CHF', 'USD/CHF'] as const) {
      const m = metrics('chf-shock-2015', p);
      expect(m.dayMovePct).toBeLessThan(-10);
      expect(m.movePct).toBeLessThan(0);
      expect(m.isRecord).toBe(true);
    }
    expect(levelOf(metrics('chf-shock-2015', 'EUR/CHF').volBefore, ths['EUR/CHF'])).toBe(1);
  });

  it('2022: EUR/CHF at its lowest fixing since January 2015, vol far below 2011 and 2015', () => {
    const m = metrics('ukraine-2022', 'EUR/CHF');
    const between = series['EUR/CHF'].filter((p) => p.date >= '2015-02-01' && p.date < m.toDate);
    expect(Math.min(...between.map((p) => p.value))).toBeGreaterThan(m.to);
    const jan2015 = series['EUR/CHF'].filter((p) => p.date.startsWith('2015-01'));
    expect(jan2015.some((p) => p.value <= m.to)).toBe(true);
    expect(m.peak).toBeLessThan(metrics('floor-2011', 'EUR/CHF').peak / 2);
    expect(m.peak).toBeLessThan(metrics('chf-shock-2015', 'EUR/CHF').peak / 2);
    expect(metrics('ukraine-2022', 'EUR/USD').movePct).toBeLessThan(0);
  });

  it('2022: the same vol means a different level for EUR/CHF and EUR/USD', () => {
    const chf = metrics('ukraine-2022', 'EUR/CHF');
    const usd = metrics('ukraine-2022', 'EUR/USD');
    expect(Math.abs(chf.peak - usd.peak)).toBeLessThan(0.5);
    expect(chf.peakLevel).toBeGreaterThan(usd.peakLevel);
  });

  it('2024: EUR/CHF and USD/JPY fall, USD/JPY most of all on 5 August', () => {
    expect(metrics('carry-2024', 'EUR/CHF').movePct).toBeLessThan(0);
    const jpy = metrics('carry-2024', 'USD/JPY');
    expect(jpy.movePct).toBeLessThan(0);
    expect(jpy.dayDate).toBe('2024-08-05');
    expect(jpy.dayMovePct).toBeLessThan(0);
  });

  it('2025: the euro rises on 5 March, EUR/CHF vol jumps out of a calm market', () => {
    for (const p of ['EUR/CHF', 'EUR/USD'] as const) {
      const m = metrics('fiscal-2025', p);
      expect(m.dayDate).toBe('2025-03-05');
      expect(m.dayMovePct).toBeGreaterThan(0);
      expect(m.movePct).toBeGreaterThan(0);
      expect(m.peakDate < '2025-04-03').toBe(true); // the peak range stops before the April tariff turmoil
    }
    const chf = metrics('fiscal-2025', 'EUR/CHF');
    expect(chf.peakLevel).toBeGreaterThan(levelOf(chf.volBefore, ths['EUR/CHF']));
  });
});
