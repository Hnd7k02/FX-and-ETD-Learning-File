import { describe, expect, it } from 'vitest';
import { EVENTS, RISKOMETER } from '@/lib/data/riskometer-data';
import { PAIRS } from '@/lib/data/series';
import {
  RISKOMETER_UI,
  buildRiskometerProps,
  dayNumbers,
  deepLinkSearch,
  defaultEventFor,
  eventsOfPair,
  layoutFor,
  lerpArray,
  levelBounds,
  levelTrend,
  markerIndex,
  pairCode,
  parseDeepLink,
  parseNumbers,
  parsePairCode,
  resolveSelection,
  seriesExtremes,
  spanYears,
  placeTags,
  tipShift,
  xScaleFor,
  yAxisMax,
  yScaleFor,
  yTicksFor,
  yearStart,
  yearTicks,
  type RkEvent,
} from '@/lib/riskometer-ui';

const link = (slug: string) => ({ label: slug, href: `/module/${slug}/1/` });
const props = buildRiskometerProps(RISKOMETER, EVENTS, 'de', link);
const dates = props.dates.split(',');

describe('buildRiskometerProps', () => {
  it('shares the weekly dates across pairs and rounds nothing away', () => {
    expect(dates.length).toBe(RISKOMETER.pairs['EUR/CHF'].weekly.length);
    expect(dates[0]).toBe(RISKOMETER.pairs['EUR/CHF'].weekly[0]![0]);
    for (const p of PAIRS) {
      const vols = parseNumbers(props.pairs[p].vols);
      expect(vols.length).toBe(dates.length);
      expect(vols[dates.length - 1]).toBe(RISKOMETER.pairs[p].current.vol);
      expect(vols.every(Number.isFinite)).toBe(true);
      expect(props.pairs[p].yearly.length).toBeGreaterThan(15);
      for (const y of props.pairs[p].yearly) expect(y.level).toBeGreaterThanOrEqual(1);
    }
    expect(props.asOf).toBe(RISKOMETER.asOf);
    expect(props.method.percentiles).toEqual([20, 60, 85, 97]);
  });

  it('fills the event texts per pair and leaves no placeholder', () => {
    expect(props.events.length).toBe(EVENTS.length);
    for (const e of props.events) {
      const src = EVENTS.find((x) => x.id === e.id)!;
      expect(Object.keys(e.pairs).sort()).toEqual([...src.pairs].sort());
      expect(e.modules.map((m) => m.label)).toEqual(src.modules);
      for (const pe of Object.values(e.pairs)) {
        expect(pe.what).not.toMatch(/\{\w+\}/);
        for (const m of pe.means) expect(m).not.toMatch(/\{\w+\}/);
        expect(pe.week).toBeGreaterThanOrEqual(0);
        expect(pe.week).toBeLessThan(dates.length);
      }
    }
  });

  it('places the 2015 marker on the visible weekly spike, not on the week after the cliff', () => {
    const e = props.events.find((x) => x.id === 'chf-shock-2015')!.pairs['EUR/CHF']!;
    const vols = parseNumbers(props.pairs['EUR/CHF'].vols);
    const m = RISKOMETER.pairs['EUR/CHF'].events['chf-shock-2015']!;
    expect(vols[e.week]).toBeGreaterThan(50);
    expect(e.week).toBeGreaterThanOrEqual(m.anchorWeekIndex);
    expect(e.week).toBeLessThanOrEqual(m.peakWeekIndex);
  });

  it('uses the English texts for en', () => {
    const en = buildRiskometerProps(RISKOMETER, EVENTS, 'en', link);
    expect(en.events[0]!.title).toBe(EVENTS[0]!.title.en);
    expect(en.events[0]!.pairs['EUR/CHF']!.what).toContain('franc');
  });

  it('throws when the pairs do not share the weekly dates', () => {
    const broken = structuredClone(RISKOMETER);
    broken.pairs['USD/JPY'].weekly = broken.pairs['USD/JPY'].weekly.slice(1);
    expect(() => buildRiskometerProps(broken, EVENTS, 'de', link)).toThrow(/weekly dates/);
  });
});

describe('markerIndex', () => {
  it('finds the highest value between two indices in any order', () => {
    const v = [1, 5, 2, 9, 3, 7];
    expect(markerIndex(v, 0, 2)).toBe(1);
    expect(markerIndex(v, 4, 1)).toBe(3);
    expect(markerIndex(v, 3, 3)).toBe(3);
    expect(markerIndex(v, -5, 99)).toBe(3);
    expect(markerIndex([], 0, 1)).toBe(-1);
  });
});

describe('pairs and deep links', () => {
  it('maps pair codes both ways', () => {
    expect(pairCode('EUR/CHF')).toBe('EURCHF');
    expect(parsePairCode('EURUSD')).toBe('EUR/USD');
    expect(parsePairCode('usd-jpy')).toBe('USD/JPY');
    expect(parsePairCode('USD/CHF')).toBe('USD/CHF');
    expect(parsePairCode('GBPUSD')).toBeNull();
    expect(parsePairCode('')).toBeNull();
    expect(parsePairCode(null)).toBeNull();
  });

  it('parses the query string and ignores junk', () => {
    expect(parseDeepLink('?pair=EURUSD&event=gfc-2008')).toEqual({
      pair: 'EUR/USD',
      event: 'gfc-2008',
    });
    expect(parseDeepLink('pair=xyz&event=<b>')).toEqual({ pair: null, event: null });
    expect(parseDeepLink('')).toEqual({ pair: null, event: null });
  });

  it('writes only what differs from the defaults', () => {
    const ev = props.events;
    const d = defaultEventFor(ev, 'EUR/CHF');
    expect(deepLinkSearch(ev, { pair: 'EUR/CHF', event: d })).toBe('');
    expect(deepLinkSearch(ev, { pair: 'EUR/CHF', event: 'gfc-2008' })).toBe('?event=gfc-2008');
    expect(deepLinkSearch(ev, { pair: 'USD/JPY', event: defaultEventFor(ev, 'USD/JPY') })).toBe(
      '?pair=USDJPY',
    );
    expect(deepLinkSearch(ev, { pair: 'EUR/USD', event: 'ukraine-2022' })).toBe(
      '?pair=EURUSD&event=ukraine-2022',
    );
  });
});

describe('selection', () => {
  const ev = props.events;

  it('uses the configured default event and the highest peak otherwise', () => {
    expect(defaultEventFor(ev, 'EUR/CHF')).toBe('chf-shock-2015');
    expect(defaultEventFor(ev, 'USD/CHF')).toBe('chf-shock-2015');
    expect(defaultEventFor(ev, 'EUR/USD')).toBe('gfc-2008');
    expect(defaultEventFor(ev, 'USD/JPY')).toBe('gfc-2008');
    expect(defaultEventFor([], 'EUR/CHF')).toBeNull();
    expect(RISKOMETER_UI.defaultPair).toBe('EUR/CHF');
  });

  it('lists only the events of a pair', () => {
    expect(eventsOfPair(ev, 'USD/JPY').map((e) => e.id)).toEqual(['gfc-2008', 'carry-2024']);
  });

  it('keeps an event across pairs when it exists there, else falls back', () => {
    expect(resolveSelection(ev, 'USD/JPY', 'gfc-2008')).toEqual({
      pair: 'USD/JPY',
      event: 'gfc-2008',
    });
    expect(resolveSelection(ev, 'USD/JPY', 'floor-2011')).toEqual({
      pair: 'USD/JPY',
      event: 'gfc-2008',
    });
    expect(resolveSelection(ev, null, null)).toEqual({ pair: 'EUR/CHF', event: 'chf-shock-2015' });
    expect(resolveSelection(ev, null, 'nope')).toEqual({
      pair: 'EUR/CHF',
      event: 'chf-shock-2015',
    });
  });

  it('picks the first pair of an event when no pair is given', () => {
    const only: RkEvent[] = [
      {
        id: 'x',
        year: '2020',
        title: 'x',
        dateLabel: 'x',
        modules: [],
        pairs: { 'USD/JPY': ev[0]!.pairs['USD/JPY']! },
      },
    ];
    expect(resolveSelection(only, null, 'x')).toEqual({ pair: 'USD/JPY', event: 'x' });
  });
});

describe('layout and scales', () => {
  it('switches to the compact layout under 640 px and keeps labels ≥ 11 px', () => {
    const wide = layoutFor(1000);
    expect(wide).toMatchObject({ width: 1000, height: 340, left: 44, top: 44, compact: false });
    const narrow = layoutFor(358);
    expect(narrow.compact).toBe(true);
    expect(narrow.font).toBeGreaterThanOrEqual(11);
    expect(narrow.width).toBe(358);
    expect(layoutFor(100).width).toBe(280);
  });

  it('x in time, y in percent', () => {
    const days = dayNumbers(dates);
    const l = layoutFor(1000);
    const x = xScaleFor(days, l);
    expect(x(days[0]!)).toBe(44);
    expect(x(days[days.length - 1]!)).toBe(984);
    const y = yScaleFor(60, l);
    expect(y(0)).toBe(300);
    expect(y(60)).toBe(44);
    expect(x.invert(x(days[500]!))).toBeCloseTo(days[500]!, 6);
  });

  it('rounds the y axis up to a nice tick with headroom', () => {
    expect(yAxisMax(55.57)).toBe(60);
    expect(yAxisMax(53.85)).toBe(60);
    expect(yAxisMax(29.69)).toBe(40);
    expect(yAxisMax(26.1)).toBe(30);
    expect(yAxisMax(0)).toBeGreaterThan(0);
    expect(yTicksFor(60)).toEqual([0, 20, 40, 60]);
    expect(yTicksFor(30)).toEqual([0, 10, 20, 30]);
  });

  it('labels years from the first year in steps', () => {
    expect(yearTicks('2006-01-06', '2026-09-14', 4)).toEqual([2006, 2010, 2014, 2018, 2022, 2026]);
    expect(yearTicks('2006-01-06', '2026-09-14', 5)).toEqual([2006, 2011, 2016, 2021, 2026]);
    expect(yearStart(1970)).toBe(0);
    expect(spanYears('2006-01-06', '2026-09-14')).toBe(20);
  });

  it('parses number lists', () => {
    expect(parseNumbers('2.27,3.1,0')).toEqual([2.27, 3.1, 0]);
    expect(parseNumbers('')).toEqual([]);
  });

  it('interpolates arrays and finds extremes', () => {
    expect(lerpArray([0, 10], [10, 0], 0.5)).toEqual([5, 5]);
    expect(lerpArray([0, 10, 20], [10, 0], 1)).toEqual([10, 0]);
    expect(seriesExtremes([3, 1, 4, 1, 5])).toEqual({ min: 1, minIndex: 1, max: 5, maxIndex: 4 });
    expect(seriesExtremes([])).toEqual({ min: 0, minIndex: 0, max: 0, maxIndex: 0 });
  });

  it('lifts year tags that would overlap each other or a fixed tag', () => {
    const tag = (x: number, y = 100): { x: number; y: number; w: number; h: number } => ({
      x,
      y,
      w: 42,
      h: 21,
    });
    expect(placeTags([tag(100), tag(300), tag(500)])).toEqual([0, 0, 0]);
    expect(placeTags([tag(100), tag(120), tag(500)])).toEqual([0, 1, 0]);
    expect(placeTags([tag(100), tag(120), tag(130)])).toEqual([0, 1, 2]);
    expect(placeTags([tag(120), tag(100)])).toEqual([1, 0]);
    // same x but far apart vertically: no lift
    expect(placeTags([tag(100, 100), tag(100, 200)])).toEqual([0, 0]);
    // the fixed "Zuletzt" (latest) tag pushes a neighbour up
    expect(placeTags([tag(100)], [{ x: 120, y: 105, w: 78, h: 21 }])).toEqual([1]);
    expect(placeTags([tag(100)], [{ x: 300, y: 105, w: 78, h: 21 }])).toEqual([0]);
    expect(placeTags([])).toEqual([]);
  });

  it('anchors the tooltip away from the edges', () => {
    expect(tipShift(5)).toBe(0);
    expect(tipShift(50)).toBe(-50);
    expect(tipShift(95)).toBe(-100);
  });
});

describe('texts', () => {
  it('level bounds and chip trend', () => {
    const b = levelBounds({ p20: 2, p60: 4, p85: 7, p97: 12 });
    expect(b).toEqual([
      [null, 2],
      [2, 4],
      [4, 7],
      [7, 12],
      [12, null],
    ]);
    expect(levelTrend(1)).toBe('down');
    expect(levelTrend(2)).toBe('flat');
    expect(levelTrend(3)).toBe('up');
    expect(levelTrend(5)).toBe('up');
  });
});
