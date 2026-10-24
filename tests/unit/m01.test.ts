/**
 * Module 01 (FX market & spot): pure logic behind the figures and the number registry.
 */
import { describe, expect, it } from 'vitest';
import { EXAMPLE } from '@/lib/fx/example';
import { triangularArbitrage } from '@/lib/fx/arbitrage';
import { forwardMoneyMarket } from '@/lib/fx/forward';
import {
  BIG_FIGURE,
  bigFigureBlocks,
  costChf,
  exposure,
  inversePctChange,
  inverseRate,
  moveIn,
  pctChange,
  probBeyond,
  probBetween,
  sigmaRange,
} from '@/lib/m01/exposure';
import { digitalCash } from '@/lib/fx/exotics/digital';
import {
  SESSION_CONFIG,
  dayTypeOf,
  fmtClock,
  inOverlap,
  liquidityAt,
  liquidityCurve,
  liquidityLevel,
  openSessions,
  overlapWindow,
  sessionIntervals,
  visibleSegments,
  weekStart,
  zurichClock,
  zurichWindow,
} from '@/lib/m01/sessions';
import {
  SPREAD_DRIVERS,
  SPREAD_MODEL,
  pipValue,
  quoteParts,
  spreadCost,
  spreadPips,
  twoWayQuote,
} from '@/lib/m01/quote';
import { ORDER_DEMO, buildPath, fillBuy } from '@/lib/m01/orders';
import { TRI_CONFIG, defaultMids, directAt, quoteAround, triState } from '@/lib/m01/triangle';
import {
  G10,
  G10_ROLES,
  G10_SCENARIOS,
  G10_SCENARIO_RULES,
  matchingCodes,
  pairConvention,
  profileOf,
  selectionAfterFilter,
  tendencies,
  tendency,
  type G10Code,
} from '@/lib/m01/g10';
import { APRIL_2025, windowMove } from '@/lib/m01/history';
import { M01, nums } from '@/lib/nums/m01';
import { formatNum } from '@/lib/nums';

const S0 = EXAMPLE.spot;
const N = EXAMPLE.notional;

describe('exposure (section 1)', () => {
  it('costs N · S and moves CHF 10’000 per big figure', () => {
    expect(costChf(S0)).toBeCloseTo(800_000, 6);
    expect(costChf(S0 + BIG_FIGURE) - costChf(S0)).toBeCloseTo(10_000, 6);
    const e = exposure(0.84);
    expect(e.diff).toBeCloseTo(40_000, 6);
    expect(e.pct).toBeCloseTo(0.05, 12);
    expect(e.inverse).toBeCloseTo(1 / 0.84, 12);
    expect(e.inversePct).toBeCloseTo(-0.05 / 1.05, 12);
    expect(e.bigFigures).toBeCloseTo(4, 9);
    expect(e.pips).toBeCloseTo(400, 6);
    expect(e.dir).toBe('up');
    expect(exposure(S0).dir).toBe('flat');
    expect(exposure(0.79).dir).toBe('down');
  });

  it('handles the inverse quote and asymmetric percentages', () => {
    expect(inverseRate(0.8)).toBeCloseTo(1.25, 12);
    expect(() => inverseRate(0)).toThrow(RangeError);
    expect(pctChange(0.8, 0.84)).toBeCloseTo(0.05, 12);
    expect(inversePctChange(0.8, 0.84)).toBeCloseTo(0.8 / 0.84 - 1, 12);
    // the inverse moves by −x/(1+x)
    const x = 0.05;
    expect(inversePctChange(1, 1 + x)).toBeCloseTo(-x / (1 + x), 12);
    expect(moveIn(0.8, 0.8125)).toEqual({
      pips: expect.closeTo(125, 6),
      bigFigures: expect.closeTo(1.25, 9),
    });
  });

  it('gives a ±1σ range symmetric in log terms', () => {
    const [lo, hi] = sigmaRange();
    expect(Math.log(hi / S0)).toBeCloseTo(EXAMPLE.vol * Math.sqrt(EXAMPLE.T), 12);
    expect(Math.log(S0 / lo)).toBeCloseTo(EXAMPLE.vol * Math.sqrt(EXAMPLE.T), 12);
    expect(lo).toBeLessThan(S0);
    expect(hi).toBeGreaterThan(S0);
  });

  it('gives the risk-neutral probability of ending beyond a rate (C6)', () => {
    const { vol, T, rd, rf } = EXAMPLE;
    const df = Math.exp(-rd * T);
    // = undiscounted digital: N(d2) above, N(−d2) below (drift rd − rf, mean at the forward)
    for (const K of [0.76, 0.78, 0.82, 0.84]) {
      const type = K > S0 ? 'call' : 'put';
      expect(probBeyond(K)).toBeCloseTo(digitalCash(S0, K, T, vol, rd, rf, type) / df, 12);
    }
    // check values (Prüfwerte): 0.84 → 7.235 %, 0.76 → 14.834 %
    expect(probBeyond(0.84)).toBeCloseTo(0.0723508, 6);
    expect(probBeyond(0.76)).toBeCloseTo(0.1483393, 6);
    // the forward is below spot: a fall of four big figures is likelier than a rise of four
    expect(probBeyond(0.76)).toBeGreaterThan(probBeyond(0.84));
    // monotone: further away is less likely
    expect(probBeyond(0.84)).toBeLessThan(probBeyond(0.82));
    expect(probBeyond(0.76)).toBeLessThan(probBeyond(0.78));
    // with zero drift of ln S (rf = rd − σ²/2) it is the symmetric ±1σ value of the band
    const k = vol * Math.sqrt(T);
    const flat = rd - 0.5 * vol * vol;
    expect(probBeyond(S0 * Math.exp(k), S0, vol, T, rd, flat)).toBeCloseTo(0.158655, 5);
    expect(probBeyond(S0 * Math.exp(-k), S0, vol, T, rd, flat)).toBeCloseTo(0.158655, 5);
    expect(probBeyond(S0, S0, vol, T, rd, flat)).toBeCloseTo(0.5, 12);
    expect(() => probBeyond(0)).toThrow(RangeError);
    expect(() => probBeyond(0.8, S0, 0)).toThrow(RangeError);
    expect(() => probBeyond(0.8, S0, vol, 0)).toThrow(RangeError);
  });

  it('gives the risk-neutral probability of ending inside the ±1σ band (C6)', () => {
    const [lo, hi] = sigmaRange();
    // check value (Prüfwert): 66.90 %, still about two in three
    expect(probBetween(lo, hi)).toBeCloseTo(0.669027, 5);
    expect(probBetween(lo, hi)).toBeCloseTo(1 - probBeyond(hi) - probBeyond(lo), 12);
    expect(() => probBetween(0.8, 0.8)).toThrow(RangeError);
    expect(() => probBetween(0, 0.8)).toThrow(RangeError);
    expect(() => probBetween(0.78, 0.82, S0, -0.1)).toThrow(RangeError);
  });

  it('splits a move into whole big-figure blocks and a rest', () => {
    expect(bigFigureBlocks(0.8, 0.81)).toEqual({ whole: 1, rest: 0 });
    const b = bigFigureBlocks(0.8, 0.8235);
    expect(b.whole).toBe(2);
    expect(b.rest).toBeCloseTo(0.35, 9);
    const d = bigFigureBlocks(0.8, 0.775);
    expect(d.whole).toBe(-2);
    expect(d.rest).toBeCloseTo(0.5, 9);
    expect(bigFigureBlocks(0.8, 0.8)).toEqual({ whole: 0, rest: 0 });
  });
});

describe('session clock (section 2)', () => {
  const byId = (id: string) => SESSION_CONFIG.sessions.find((s) => s.id === id)!;

  it('places the sessions in Zurich time for both seasons', () => {
    expect(zurichWindow(byId('london'), 'winter')).toEqual({ open: 9, close: 18 });
    expect(zurichWindow(byId('london'), 'summer')).toEqual({ open: 9, close: 18 });
    expect(zurichWindow(byId('newYork'), 'winter')).toEqual({ open: 14, close: 23 });
    expect(zurichWindow(byId('tokyo'), 'winter')).toEqual({ open: 1, close: 10 });
    expect(zurichWindow(byId('tokyo'), 'summer')).toEqual({ open: 2, close: 11 });
    expect(zurichWindow(byId('wellington'), 'winter')).toEqual({ open: 20, close: 5 });
    expect(zurichWindow(byId('sydney'), 'summer')).toEqual({ open: 0, close: 9 });
  });

  it('peaks in the London/New York overlap', () => {
    for (const season of ['winter', 'summer'] as const) {
      expect(overlapWindow(season, 'monThu')).toEqual([14, 18]);
      const curve = liquidityCurve(season, 'monThu', 96);
      const peak = curve.reduce((a, b) => (b[1] > a[1] ? b : a));
      expect(peak[0]).toBeGreaterThanOrEqual(14);
      expect(peak[0]).toBeLessThan(18);
      expect(peak[1]).toBeGreaterThan(0.99);
      expect(liquidityLevel(season, 'monThu', 15)).toBe('peak');
      expect(liquidityLevel(season, 'monThu', 11)).toBe('high');
      expect(inOverlap(season, 'monThu', 15)).toBe(true);
      expect(inOverlap(season, 'monThu', 12)).toBe(false);
    }
    // Asia alone is less liquid than London alone
    expect(liquidityAt('winter', 'monThu', 3)).toBeLessThan(liquidityAt('winter', 'monThu', 11));
    expect(liquidityLevel('winter', 'monThu', 3)).toBe('moderate');
    expect(liquidityLevel('winter', 'monThu', 7.5)).toBe('thin');
  });

  it('starts the week in Wellington on Sunday evening and closes it on Friday', () => {
    expect(weekStart('winter')).toEqual({ hour: 20, session: 'wellington' });
    expect(weekStart('summer')).toEqual({ hour: 22, session: 'wellington' });
    expect(openSessions('winter', 'sun', 12)).toEqual([]);
    expect(openSessions('winter', 'sun', 20.5)).toEqual(['wellington']);
    expect(openSessions('winter', 'sun', 22.5)).toEqual(['wellington', 'sydney']);
    expect(liquidityLevel('winter', 'sat', 12)).toBe('closed');
    expect(liquidityAt('winter', 'sat', 12)).toBe(0);
    expect(overlapWindow('winter', 'sun')).toBeNull();
    expect(openSessions('winter', 'fri', 22.5)).toEqual(['newYork']);
    expect(openSessions('winter', 'fri', 23.5)).toEqual([]);
    expect(openSessions('winter', 'fri', 2)).toEqual(['wellington', 'sydney', 'tokyo']);
    expect(openSessions('winter', 'monThu', 23.5)).toEqual(['wellington', 'sydney']);
    expect(openSessions('summer', 'sun', 23)).toEqual(['wellington']);
  });

  it('clips intervals to the visible day', () => {
    const w = byId('wellington');
    expect(sessionIntervals(w, 'winter', 'monThu')).toEqual([
      [-4, 5],
      [20, 29],
    ]);
    expect(visibleSegments(sessionIntervals(w, 'winter', 'monThu'))).toEqual([
      [0, 5],
      [20, 24],
    ]);
    expect(sessionIntervals(w, 'winter', 'sat')).toEqual([]);
    expect(sessionIntervals(byId('london'), 'winter', 'sun')).toEqual([]);
    expect(sessionIntervals(byId('london'), 'winter', 'fri')).toEqual([[9, 18]]);
  });

  it('reads the Zurich clock with daylight saving time', () => {
    expect(zurichClock(new Date('2026-10-23T12:30:00Z'))).toEqual({
      hour: 14.5,
      weekday: 5,
      season: 'summer',
      day: 'fri',
    });
    expect(zurichClock(new Date('2026-12-06T21:15:00Z'))).toEqual({
      hour: 22.25,
      weekday: 0,
      season: 'winter',
      day: 'sun',
    });
    expect(zurichClock(new Date('2026-12-05T10:00:00Z')).day).toBe('sat');
    expect(dayTypeOf(2)).toBe('monThu');
    expect(fmtClock(14.5)).toBe('14:30');
    expect(fmtClock(0)).toBe('00:00');
    expect(fmtClock(23.999)).toBe('24:00');
  });
});

describe('two-way price (section 3)', () => {
  it('widens the spread per driver in whole even pips', () => {
    expect(spreadPips({})).toBe(SPREAD_MODEL.basePips);
    const all = Object.fromEntries(SPREAD_DRIVERS.map((d) => [d, true]));
    const max = spreadPips(all);
    expect(max).toBe(
      SPREAD_MODEL.basePips + Object.values(SPREAD_MODEL.addPips).reduce((a, b) => a + b, 0),
    );
    for (const d of SPREAD_DRIVERS) {
      expect(spreadPips({ [d]: true }) - SPREAD_MODEL.basePips).toBe(SPREAD_MODEL.addPips[d]);
      expect(SPREAD_MODEL.addPips[d] % 2).toBe(0);
    }
  });

  it('quotes bid and ask around the mid and splits big figure and pips', () => {
    const q = twoWayQuote(0.8, 4);
    expect(q.bid).toBeCloseTo(0.7998, 12);
    expect(q.ask).toBeCloseTo(0.8002, 12);
    expect(quoteParts(q.bid)).toEqual({ big: '0.79', pips: '98' });
    expect(quoteParts(q.ask)).toEqual({ big: '0.80', pips: '02' });
    expect(quoteParts(145.23, 'USD/JPY')).toEqual({ big: '145.', pips: '23' });
    expect(twoWayQuote(145, 4, 'USD/JPY').ask).toBeCloseTo(145.02, 12);
  });

  it('prices the spread for the client', () => {
    expect(pipValue()).toBeCloseTo(100, 9);
    expect(spreadCost(4)).toBeCloseTo(200, 9);
    expect(spreadCost(4, N, 'full')).toBeCloseTo(400, 9);
  });
});

describe('orders and gap risk (section 3)', () => {
  const calm = buildPath('calm');
  const gap = buildPath('gap');

  it('builds deterministic paths; only the gap scenario jumps over the weekend', () => {
    expect(calm.mid).toHaveLength(ORDER_DEMO.days * ORDER_DEMO.perDay);
    expect(buildPath('calm').mid).toEqual(calm.mid);
    expect(calm.gapAt).toBeNull();
    expect(gap.gapAt).toBe(ORDER_DEMO.weekendAt);
    expect(calm.mid[0]).toBeCloseTo(S0, 9);
    expect(gap.ask[0]! - gap.mid[0]!).toBeCloseTo(ORDER_DEMO.halfSpreadPips * 1e-4, 9);
    const before = Math.max(...gap.ask.slice(0, ORDER_DEMO.weekendAt));
    expect(before).toBeLessThan(ORDER_DEMO.stop.level);
    expect(gap.ask[ORDER_DEMO.weekendAt]!).toBeGreaterThan(ORDER_DEMO.stop.max);
  });

  it('fills a market order at once on the ask', () => {
    const f = fillBuy(calm, 'market', null);
    expect(f).toMatchObject({ filled: true, index: 0, slippagePips: 0, level: null });
    expect(f.price).toBeCloseTo(calm.ask[0]!, 12);
    expect(f.costChf).toBeCloseTo(calm.ask[0]! * N, 6);
    expect(fillBuy(calm, 'limit', null).index).toBe(0);
  });

  it('fills a limit at the limit, or not at all', () => {
    const f = fillBuy(calm, 'limit', ORDER_DEMO.limit.level);
    expect(f.filled).toBe(true);
    expect(f.price).toBe(ORDER_DEMO.limit.level);
    expect(f.index).toBeGreaterThan(0);
    const g = fillBuy(gap, 'limit', ORDER_DEMO.limit.level);
    expect(g.filled).toBe(false);
    expect(g.index).toBe(gap.ask.length - 1);
    expect(g.price).toBeCloseTo(gap.ask.at(-1)!, 12);
    expect(g.slippagePips).toBe(0);
    // a limit above the market is marketable at once
    expect(fillBuy(calm, 'limit', 0.81)).toMatchObject({ filled: true, index: 0 });
  });

  it('fills a stop at the level in a calm market, far worse after a gap', () => {
    const f = fillBuy(calm, 'stop', ORDER_DEMO.stop.level);
    expect(f).toMatchObject({ filled: true, viaGap: false });
    expect(f.price).toBe(ORDER_DEMO.stop.level);
    const g = fillBuy(gap, 'stop', ORDER_DEMO.stop.level);
    expect(g.viaGap).toBe(true);
    expect(g.index).toBe(ORDER_DEMO.weekendAt);
    expect(g.slippagePips).toBeGreaterThan(100);
    expect(fillBuy(calm, 'stop', ORDER_DEMO.stop.max)).toMatchObject({ filled: false });
    expect(fillBuy(calm, 'stop', 0.79)).toMatchObject({ filled: true, index: 0 });
  });

  it('gives a better price than the limit when the market gaps through it', () => {
    // a buy limit high above the pre-gap prices but below the post-gap ones is never hit;
    // a limit hit across a gap downwards: mirror the gap path
    const down = { ...gap, mid: gap.mid.map((m) => 1.6 - m), ask: gap.ask.map((a) => 1.6 - a) };
    const lvl = 1.6 - 0.815;
    const f = fillBuy(down, 'limit', lvl);
    expect(f.viaGap).toBe(true);
    expect(f.price).toBeLessThan(lvl);
    expect(f.slippagePips).toBeLessThan(0);
  });
});

describe('triangular arbitrage (section 3)', () => {
  it('starts consistent and has a no-arbitrage band from the spreads', () => {
    const m = defaultMids();
    expect(m.eurchf).toBeCloseTo(TRI_CONFIG.eurusd * TRI_CONFIG.usdchf, 9);
    const s = triState(m, true);
    expect(s.direction).toBe('none');
    expect(s.offsetPips).toBeCloseTo(0, 6);
    expect(s.noArbPips[0]).toBeLessThan(0);
    expect(s.noArbPips[1]).toBeGreaterThan(0);
    // just inside and just outside the upper edge
    const inside = triState({ ...m, eurchf: m.eurchf + (s.noArbPips[1] - 0.1) * 1e-4 }, true);
    expect(inside.direction).toBe('none');
    const outside = triState({ ...m, eurchf: m.eurchf + (s.noArbPips[1] + 0.1) * 1e-4 }, true);
    expect(outside.direction).toBe('sellDirectBuyCross');
    const below = triState({ ...m, eurchf: m.eurchf + (s.noArbPips[0] - 0.1) * 1e-4 }, true);
    expect(below.direction).toBe('buyDirectSellCross');
  });

  it('matches the core without spreads: every gap is profit', () => {
    const m = { ...defaultMids(), eurchf: directAt(1.1, 0.8, TRI_CONFIG.examplePips) };
    const s = triState(m, false);
    const core = triangularArbitrage({ eurusd: 1.1, usdchf: 0.8, eurchf: m.eurchf });
    expect(s.profitPerEurMillion).toBeCloseTo(core.profitPerEurMillion, 9);
    expect(s.noArbPips).toEqual([0, 0]);
    expect(s.offsetPips).toBeCloseTo(TRI_CONFIG.examplePips, 6);
    expect(quoteAround(1, 0)).toEqual({ bid: 1, ask: 1 });
  });

  it('round trip with spreads: legs chain and the profit is positive', () => {
    const m = { ...defaultMids(), eurchf: directAt(1.1, 0.8, TRI_CONFIG.examplePips) };
    const s = triState(m, true);
    expect(s.direction).toBe('sellDirectBuyCross');
    expect(s.legs).toHaveLength(3);
    expect(s.legs[0]!.receive.amount).toBeCloseTo(s.legs[1]!.pay.amount, 6);
    expect(s.legs[1]!.receive.amount).toBeCloseTo(s.legs[2]!.pay.amount, 6);
    expect(s.legs[2]!.receive.amount - 1e6).toBeCloseTo(s.profitPerEurMillion, 6);
    expect(s.profitPerEurMillion).toBeGreaterThan(0);
    expect(s.profitPerEurMillion).toBeLessThan(triState(m, false).profitPerEurMillion);
  });
});

describe('G10 profiles (section 4)', () => {
  it('lists the ten G10 currencies once each', () => {
    expect(G10.map((p) => p.code)).toEqual([
      'USD',
      'EUR',
      'JPY',
      'GBP',
      'CHF',
      'AUD',
      'NZD',
      'CAD',
      'NOK',
      'SEK',
    ]);
    expect(profileOf('CAD').spotDays).toBe(1);
    expect(() => profileOf('XXX' as G10Code)).toThrow(RangeError);
    for (const p of G10) expect(p.pair).toContain(p.code);
  });

  it('filters by role and keeps a valid selection', () => {
    expect(matchingCodes('all')).toHaveLength(10);
    expect(matchingCodes('safeHaven')).toEqual(['USD', 'JPY', 'CHF']);
    expect(matchingCodes('commodity')).toEqual(['AUD', 'NZD', 'CAD', 'NOK']);
    expect(matchingCodes('funding')).toEqual(['JPY', 'CHF']);
    for (const r of G10_ROLES) expect(matchingCodes(r).length).toBeGreaterThan(0);
    expect(selectionAfterFilter('CHF', 'safeHaven')).toBe('CHF');
    expect(selectionAfterFilter('GBP', 'commodity')).toBe('AUD');
  });

  it('maps scenarios to textbook tendencies by role', () => {
    expect(G10_SCENARIOS[0]).toBe('none');
    for (const p of G10) expect(tendency(p.code, 'none')).toBe('flat');
    const off = tendencies('riskOff');
    expect(off.up).toEqual(['USD', 'JPY', 'CHF']);
    expect(off.down).toEqual(['AUD', 'NZD', 'CAD', 'NOK']);
    expect(off.flat).toEqual(['EUR', 'GBP', 'SEK']);
    const on = tendencies('riskOn');
    expect(on.up).toEqual(['AUD', 'NZD', 'CAD', 'NOK']);
    expect(on.down).toEqual(['JPY', 'CHF']);
    expect(tendencies('commodityBoom').up).toEqual(['AUD', 'NZD', 'CAD', 'NOK']);
    expect(tendencies('commodityBoom').down).toEqual([]);
    // every rule only names known roles
    for (const r of Object.values(G10_SCENARIO_RULES))
      for (const role of [...r.up, ...r.down]) expect(G10_ROLES).toContain(role);
  });

  it('gives the quoting convention of the usual pair', () => {
    const jpy = pairConvention('JPY');
    expect(jpy).toMatchObject({
      pair: 'USD/JPY',
      base: 'USD',
      quote: 'JPY',
      decimals: 2,
      pip: 0.01,
    });
    expect(jpy.pipValuePerMillion).toBe(10_000);
    const chf = pairConvention('CHF');
    expect(chf).toMatchObject({
      pair: 'USD/CHF',
      decimals: 4,
      pipValuePerMillion: 100,
      spotDays: 2,
    });
    expect(pairConvention('CAD').spotDays).toBe(1);
    expect(pairConvention('USD').pair).toBe('EUR/USD');
  });
});

describe('April 2025 window (section 4)', () => {
  const series = [
    { date: '2025-03-31', value: 0.9 },
    { date: '2025-04-02', value: 0.88 },
    { date: '2025-04-03', value: 0.86 },
    { date: '2025-04-10', value: 0.81 },
    { date: '2025-04-30', value: 0.83 },
    { date: '2025-05-02', value: 0.7 },
  ];

  it('measures low and high after the anchor inside the window', () => {
    const m = windowMove(series, '2025-04-02', '2025-04-30');
    expect(m.start).toEqual({ date: '2025-04-02', value: 0.88 });
    expect(m.low).toEqual({ date: '2025-04-10', value: 0.81 });
    expect(m.high.date).toBe('2025-04-03');
    expect(m.lowPct).toBeCloseTo(0.81 / 0.88 - 1, 12);
    expect(m.highPct).toBeCloseTo(0.86 / 0.88 - 1, 12);
    // anchor on a holiday: the next fixing counts
    expect(windowMove(series, '2025-04-01', '2025-04-30').start.date).toBe('2025-04-02');
  });

  it('throws without data', () => {
    expect(() => windowMove(series, '2026-01-01', '2026-02-01')).toThrow(RangeError);
    expect(() => windowMove(series, '2025-04-30', '2025-04-30')).toThrow(RangeError);
  });

  it('shows the dollar falling in April 2025 in the ECB data', () => {
    const { usdchf, eurusd } = M01.april2025;
    expect(usdchf.start.date).toBe(APRIL_2025.anchor);
    expect(usdchf.lowPct).toBeLessThan(-0.05);
    expect(eurusd.highPct).toBeGreaterThan(0.05);
    expect(usdchf.low.date <= APRIL_2025.to).toBe(true);
  });
});

describe('number registry m01', () => {
  it('registers only m01 keys with finite values', () => {
    for (const [k, d] of Object.entries(nums)) {
      expect(k.startsWith('m01.')).toBe(true);
      expect(Number.isFinite(d.value), k).toBe(true);
      expect(formatNum(d, 'de')).not.toBe('');
    }
  });

  it('agrees with the logic', () => {
    expect(nums['m01.costToday']!.value).toBeCloseTo(800_000, 6);
    expect(nums['m01.bigFigChf']!.value).toBeCloseTo(10_000, 6);
    expect(nums['m01.pipChf']!.value).toBeCloseTo(100, 6);
    expect(formatNum(nums['m01.inverse']!, 'de')).toBe('1.2500');
    expect(M01.carry.breakEven).toBeCloseTo(nums['m01.carryBreakEven']!.value, 12);
    // the carry break-even is the money-market forward of module 02
    expect(M01.carry.breakEven).toBeCloseTo(
      forwardMoneyMarket(EXAMPLE.spot, EXAMPLE.rd, EXAMPLE.rf, EXAMPLE.mmDays),
      12,
    );
    expect(M01.tri.profit).toBeGreaterThan(0);
    expect(nums['m01.probUp']!.value).toBeCloseTo(M01.probUp, 12);
    expect(M01.probUp).toBeGreaterThan(0.05);
    expect(M01.probUp).toBeLessThan(0.2);
    // risk-neutral probabilities (C6), check values: 7 %, 15 %, 67 %
    expect(formatNum(nums['m01.probUp']!, 'de')).toBe('7\u00a0%');
    expect(formatNum(nums['m01.probDown']!, 'de')).toBe('15\u00a0%');
    expect(nums['m01.bandProb']!.value).toBeCloseTo(M01.bandProb, 12);
    expect(formatNum(nums['m01.bandProb']!, 'de')).toBe('67\u00a0%');
    // the same \u00b11\u03c3 band without drift (log return centred on 0), check value 0.682689 (68 %)
    expect(nums['m01.bandProbNoDrift']!.value).toBeCloseTo(0.682689, 6);
    expect(formatNum(nums['m01.bandProbNoDrift']!, 'de')).toBe('68\u00a0%');
    expect(nums['m01.bandProbNoDrift']!.value).toBeGreaterThan(M01.bandProb);
    expect(formatNum(nums['m01.pipJpy']!, 'de')).toMatch(/^JPY\s10’000$/);
    expect(nums['m01.carryPnlDown']!.value).toBeLessThan(0);
    expect(M01.stopGap.slippagePips).toBeGreaterThan(100);
  });

  it('gives prose amounts that add up and carry no double signs', () => {
    const v = (k: string) => nums[k]!.value;
    // the CHF band amounts match the band rates as shown (4 decimals) times USD 1 Mio.
    const shown = (k: string) => Number(formatNum(nums[k]!, 'en'));
    expect(v('m01.rangeLoChf')).toBeCloseTo((shown('m01.rangeLo') - S0) * N, 6);
    expect(v('m01.rangeHiChf')).toBeCloseTo((shown('m01.rangeHi') - S0) * N, 6);
    // positive twins for sentences that already say "less", "loses", "falls"
    expect(v('m01.rangeLoSave')).toBeCloseTo(-v('m01.rangeLoChf'), 9);
    expect(v('m01.saveDown')).toBeCloseTo(-v('m01.diffDown'), 9);
    expect(v('m01.inverseLossUp')).toBeCloseTo(-v('m01.inversePctUp'), 12);
    expect(v('m01.apr25UsdChfFall')).toBeCloseTo(-v('m01.apr25UsdChfPct'), 12);
    for (const k of ['m01.rangeLoSave', 'm01.saveDown', 'm01.inverseLossUp', 'm01.apr25UsdChfFall'])
      expect(v(k), k).toBeGreaterThan(0);
    // the option-model forward lies below the spot (USD rate above the CHF rate)
    expect(v('m01.fwdBelowPips')).toBeGreaterThan(60);
    expect(v('m01.fwdBelowPips')).toBeLessThan(80);
  });
});
