import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseRawCsv } from '@/lib/data/csv';
import { isoWeekStart } from '@/lib/data/dates';
import { parseEvents } from '@/lib/data/events';
import { levelOf } from '@/lib/data/levels';
import { buildRiskometer, buildSummary, toJson } from '@/lib/data/riskometer';
import { EVENTS, RISKOMETER, eventsFor, pairData } from '@/lib/data/riskometer-data';
import { PAIRS } from '@/lib/data/series';
import { getRiskSummary } from '@/lib/risk-summary';

const SEED = parseRawCsv(readFileSync('data/raw/ecb-eur-reference.csv', 'utf8'));
const EVENTS_JSON = parseEvents(JSON.parse(readFileSync('src/data/events.json', 'utf8')));
const data = buildRiskometer(SEED, EVENTS_JSON);

describe('Riskometer build on the seed data', () => {
  it('records the method and the as-of date', () => {
    expect(data.asOf).toBe(SEED[SEED.length - 1]!.date);
    expect(data.method).toEqual({
      window: 21,
      annualisation: 252,
      since: '2006-01-01',
      percentiles: [20, 60, 85, 97],
      peakRange: { before: 10, after: 60 },
      source: 'ecb-reference-rates',
    });
    expect(Object.keys(data.pairs)).toEqual([...PAIRS]);
  });

  it.each(PAIRS)('%s: current reading is consistent with thresholds and chart', (pair) => {
    const d = data.pairs[pair];
    const t = d.thresholds;
    expect(t.p20 < t.p60 && t.p60 < t.p85 && t.p85 < t.p97 && t.p97 < t.max).toBe(true);
    expect(d.current.date).toBe(data.asOf);
    expect(d.current.level).toBe(levelOf(d.current.vol, t));
    expect(d.current.needle).toBeGreaterThanOrEqual(d.current.level - 1);
    expect(d.current.needle).toBeLessThanOrEqual(d.current.level);
    expect(d.current.percentile).toBeGreaterThanOrEqual(0);
    expect(d.current.percentile).toBeLessThanOrEqual(100);
    // chart: weekly from 2006, one point per ISO week, last point = today
    expect(d.weekly[0]![0] >= '2006-01-01' && d.weekly[0]![0] < '2006-01-09').toBe(true);
    const last = d.weekly[d.weekly.length - 1]!;
    expect(last).toEqual([d.current.date, d.current.vol]);
    const weeks = d.weekly.map(([date]) => isoWeekStart(date));
    expect(new Set(weeks).size).toBe(weeks.length);
    expect([...weeks].sort()).toEqual(weeks);
    // table: one row per year since 2006, the overall maximum is among them
    expect(d.yearlyMax.map((y) => y.year)).toEqual(
      Array.from({ length: Number(data.asOf.slice(0, 4)) - 2005 }, (_, i) => 2006 + i),
    );
    expect(Math.max(...d.yearlyMax.map((y) => y.vol))).toBe(t.max);
    expect(d.yearlyMax.find((y) => y.vol === t.max)!.date).toBe(t.maxDate);
  });

  it.each(PAIRS)('%s: events carry chart indexes into the weekly series', (pair) => {
    const d = data.pairs[pair];
    const ids = EVENTS_JSON.filter((e) => e.pairs.includes(pair)).map((e) => e.id);
    expect(Object.keys(d.events)).toEqual(ids);
    for (const [id, e] of Object.entries(d.events)) {
      expect(isoWeekStart(d.weekly[e.anchorWeekIndex]![0]), id).toBe(isoWeekStart(e.dayDate));
      expect(isoWeekStart(d.weekly[e.peakWeekIndex]![0]), id).toBe(isoWeekStart(e.peakDate));
      expect(e.peakWeekIndex).toBeGreaterThanOrEqual(e.anchorWeekIndex - 2);
    }
  });

  it('marks the record peaks', () => {
    const rec = PAIRS.flatMap((p) =>
      Object.entries(data.pairs[p].events)
        .filter(([, e]) => e.isRecord)
        .map(([id]) => `${p} ${id}`),
    );
    expect(rec).toEqual(['EUR/CHF chf-shock-2015', 'USD/CHF chf-shock-2015', 'USD/JPY gfc-2008']);
  });

  it('gives the EUR/CHF summary for nav dot and mini gauge', () => {
    const s = buildSummary(data);
    const c = data.pairs['EUR/CHF'].current;
    expect(s).toEqual({ pair: 'EUR/CHF', asOf: data.asOf, vol: c.vol, level: c.level, percentile: c.percentile, needle: c.needle });
    expect(buildSummary(data, 'USD/JPY').pair).toBe('USD/JPY');
  });

  it('is deterministic and matches the committed files (run `npm run data:build` if not)', () => {
    const json = toJson(data);
    expect(toJson(buildRiskometer(SEED, EVENTS_JSON))).toBe(json);
    expect(readFileSync('src/data/fx/riskometer.json', 'utf8')).toBe(json);
    expect(readFileSync('src/data/fx/summary.json', 'utf8')).toBe(toJson(buildSummary(data)));
  });

  it('needs data and at least 22 fixings', () => {
    expect(() => buildRiskometer([], EVENTS_JSON)).toThrow(/no data/);
    expect(() => buildRiskometer(SEED.slice(0, 21), [])).toThrow(/not enough fixings/);
  });
});

describe('typed access for pages', () => {
  it('exposes the generated data and the validated events', () => {
    expect(RISKOMETER.asOf).toBe(data.asOf);
    expect(pairData('EUR/USD').thresholds).toEqual(data.pairs['EUR/USD'].thresholds);
    expect(EVENTS.map((e) => e.id)).toEqual(EVENTS_JSON.map((e) => e.id));
    expect(eventsFor('USD/CHF').map((e) => e.id)).toEqual(['gfc-2008', 'floor-2011', 'chf-shock-2015']);
    expect(getRiskSummary()).toEqual(buildSummary(data));
  });
});

describe('deterministic JSON', () => {
  it('keeps primitive arrays on one line and drops undefined', () => {
    const out = toJson({ a: 1, b: [1, 'x', null], c: [[1, 2], []], d: {}, e: undefined, f: { g: true } });
    expect(out).toBe(
      [
        '{',
        '  "a": 1,',
        '  "b": [1, "x", null],',
        '  "c": [',
        '    [1, 2],',
        '    []',
        '  ],',
        '  "d": {},',
        '  "f": {',
        '    "g": true',
        '  }',
        '}',
        '',
      ].join('\n'),
    );
    expect(JSON.parse(out)).toEqual({ a: 1, b: [1, 'x', null], c: [[1, 2], []], d: {}, f: { g: true } });
    expect(toJson('x')).toBe('"x"\n');
  });
});
