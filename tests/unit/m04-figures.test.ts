import { describe, expect, it } from 'vitest';
import { EXAMPLE as E, EXAMPLE_FORWARD as F, EXAMPLE_STRIKE as K } from '@/lib/fx/example';
import { gkPrice } from '@/lib/fx/vanilla';
import { greeks } from '@/lib/fx/greeks';
import { atmDnsStrike, strikeFromDelta } from '@/lib/fx/implied';
import {
  FORWARD_DIGITS,
  ST_RANGE,
  ST_START,
  hedgeCosts,
  hedgeFacts,
  hedgeRegion,
  rankCosts,
  savingChf,
  type HedgeSetup,
} from '@/lib/hedge-cost';
import { M04, nums as m04nums } from '@/lib/nums/m04';
import { quiz as m04quiz } from '@/content/quiz/04-vanilla-options';
import { fmtMoney, fmtPips, fmtRate } from '@/lib/format';
import { formatNum } from '@/lib/nums';
import {
  ATMF_TOL,
  K_RANGE,
  markerAt,
  moneyness,
  premiumCurves,
  premiumSplit,
  strikeMarkers,
  type OptionMarket,
} from '@/lib/moneyness';
import {
  DRIVERS,
  DRIVER_ORDER,
  bumpEffect,
  direction,
  driverCurve,
  exampleDrivers,
  pricePips,
  slope,
  withDriver,
} from '@/lib/price-drivers';

const H: HedgeSetup = {
  S: E.spot,
  K,
  T: E.T,
  vol: E.vol,
  rd: E.rd,
  rf: E.rf,
  notional: E.notional,
};
const call = gkPrice(E.spot, K, E.T, E.vol, E.rd, E.rf, 'call');
const put = gkPrice(E.spot, K, E.T, E.vol, E.rd, E.rf, 'put');
const M: OptionMarket = { S: E.spot, T: E.T, vol: E.vol, rd: E.rd, rf: E.rf };

describe('hedge cost: option vs forward', () => {
  const f = hedgeFacts(H);

  it('uses the forward and the call of the example', () => {
    expect(f.F).toBeCloseTo(F, 14);
    expect(f.premium).toBeCloseTo(call, 14);
    expect(f.premiumAtExpiry).toBeCloseTo(call * Math.exp(E.rd * E.T), 14);
    expect(f.cap).toBeCloseTo(K + f.premiumAtExpiry, 14);
    expect(f.optionBeatsUnhedgedAbove).toBe(f.cap);
    expect(f.optionBeatsForwardBelow).toBeCloseTo(F - f.premiumAtExpiry, 14);
  });

  it('costs in CHF for USD 1 Mio.', () => {
    const c = hedgeCosts(0.84, H, f);
    expect(c.unhedged).toBeCloseTo(0.84 * E.notional, 6);
    expect(c.forward).toBeCloseTo(F * E.notional, 6);
    expect(c.option).toBeCloseTo((K + f.premiumAtExpiry) * E.notional, 6);
    expect(hedgeCosts(0.76, H).option).toBeCloseTo((0.76 + f.premiumAtExpiry) * E.notional, 6);
  });

  it('the option is never the cheapest in hindsight, but never the dearest outside the middle', () => {
    for (let s = ST_RANGE[0]; s <= ST_RANGE[1]; s += 0.0025) {
      const r = rankCosts(hedgeCosts(s, H, f));
      expect(r.cheapest).not.toBe('option');
      const region = hedgeRegion(s, f);
      if (region !== 'middle') expect(r.dearest).not.toBe('option');
      else expect(r.dearest).toBe('option');
    }
  });

  it('deals the forward at 5 decimals, so rate × notional matches the CHF amount on screen', () => {
    const fd = hedgeFacts({ ...H, forwardDigits: FORWARD_DIGITS });
    expect(fd.F).toBe(Number(F.toFixed(5)));
    const c = hedgeCosts(0.76, { ...H, forwardDigits: FORWARD_DIGITS }, fd);
    expect(fmtMoney(c.forward, 'CHF', 'de')).toBe(
      fmtMoney(Number(fmtRate(fd.F, 'USD/CHF', 5)) * E.notional, 'CHF', 'de'),
    );
    // savings are differences of the whole-franc amounts shown
    expect(savingChf(c, 'option', 'forward')).toBe(Math.round(c.forward) - Math.round(c.option));
    expect(Number.isInteger(savingChf(c, 'option', 'unhedged'))).toBe(true);
  });

  it('regions', () => {
    expect(hedgeRegion(0.74, f)).toBe('weakUsd');
    expect(hedgeRegion(0.8, f)).toBe('middle');
    expect(hedgeRegion(ST_START, f)).toBe('strongUsd');
  });
});

describe('moneyness and premium split', () => {
  it('classifies against the forward with a 1-pip ATMF band', () => {
    expect(moneyness(K, F, 'call').label).toBe('ATMF');
    expect(moneyness(0.78, F, 'call').label).toBe('ITM');
    expect(moneyness(0.78, F, 'put').label).toBe('OTM');
    expect(moneyness(0.81, F, 'call').label).toBe('OTM');
    expect(moneyness(0.81, F, 'put').label).toBe('ITM');
    // spot is 0.8000, but a 0.7990 call is OTM against the forward
    expect(moneyness(0.799, F, 'call').label).toBe('OTM');
    expect(moneyness(0.78, F, 'call').fMinusKPips).toBeCloseTo((F - 0.78) / 1e-4, 8);
    expect(moneyness(F + 2 * ATMF_TOL, F, 'call', 3 * ATMF_TOL).label).toBe('ATMF');
  });

  it('premium = intrinsic against the forward + time value', () => {
    const s = premiumSplit(0.77, M, 'call');
    expect(s.price).toBeCloseTo(gkPrice(E.spot, 0.77, E.T, E.vol, E.rd, E.rf, 'call'), 14);
    expect(s.intrinsic).toBeCloseTo(Math.exp(-E.rd * E.T) * (F - 0.77), 14);
    expect(s.time).toBeCloseTo(s.price - s.intrinsic, 14);
    expect(s.time).toBeGreaterThan(0);
    const otm = premiumSplit(0.82, M, 'call');
    expect(otm.intrinsic).toBe(0);
    expect(otm.time).toBeCloseTo(otm.price, 14);
  });

  it('quotes the example in % of the USD notional and gives the deltas', () => {
    const s = premiumSplit(K, M, 'call');
    expect(s.pctBase).toBeCloseTo(call / E.spot, 14);
    const g = greeks(E.spot, K, E.T, E.vol, E.rd, E.rf, 'call');
    expect(s.delta).toBeCloseTo(g.delta, 14);
    expect(s.deltaFwd).toBeCloseTo(g.deltaFwd, 14);
    expect(premiumSplit(K, M, 'put').price).toBeCloseTo(put, 14);
  });

  it('marks the desk strikes in order: 10Δ put < 25Δ put < ATMF < DNS < 25Δ call < 10Δ call', () => {
    const mk = strikeMarkers(M);
    expect(mk.map((m) => m.id)).toEqual(['p10', 'p25', 'atmf', 'dns', 'c25', 'c10']);
    expect(mk[1]!.K).toBeCloseTo(strikeFromDelta(-0.25, E.spot, E.T, E.vol, E.rd, E.rf, 'put'), 14);
    expect(mk[3]!.K).toBeCloseTo(atmDnsStrike(E.spot, E.T, E.vol, E.rd, E.rf), 14);
    for (const m of mk) {
      expect(m.K).toBeGreaterThan(K_RANGE[0]);
      expect(m.K).toBeLessThan(K_RANGE[1]);
    }
    // a 25Δ call has spot delta 0.25 by construction
    const c25 = mk.find((m) => m.id === 'c25')!.K;
    expect(premiumSplit(c25, M, 'call').delta).toBeCloseTo(0.25, 10);
    expect(markerAt(c25 + 0.00005, mk)?.id).toBe('c25');
    expect(markerAt(0.8, mk)).toBeNull();
    // ATMF and DNS are 6 pips apart; the nearer one wins
    expect(markerAt(F, mk, 1e-3)?.id).toBe('atmf');
  });

  it('curves over strikes', () => {
    const c = premiumCurves([0.76, K, 0.83], M, 'put');
    expect(c.price[1]).toBeCloseTo(put / 1e-4, 8);
    expect(c.intrinsic[0]).toBe(0);
    expect(c.intrinsic[2]).toBeCloseTo((Math.exp(-E.rd * E.T) * (0.83 - F)) / 1e-4, 8);
  });
});

describe('price drivers', () => {
  const v = exampleDrivers();

  it('starts at the running example', () => {
    expect(v.weeks / 52).toBe(E.T);
    expect(pricePips(v, 'call')).toBeCloseTo(call / 1e-4, 8);
    expect(DRIVER_ORDER).toHaveLength(6);
    for (const id of DRIVER_ORDER) {
      const d = DRIVERS[id];
      expect(v[d.key]).toBeGreaterThanOrEqual(d.min);
      expect(v[d.key]).toBeLessThanOrEqual(d.max);
    }
  });

  it('textbook directions at the example', () => {
    expect(direction(v, 'S', 'call')).toBe('up');
    expect(direction(v, 'S', 'put')).toBe('down');
    expect(direction(v, 'K', 'call')).toBe('down');
    expect(direction(v, 'K', 'put')).toBe('up');
    expect(direction(v, 'vol', 'call')).toBe('up');
    expect(direction(v, 'vol', 'put')).toBe('up');
    expect(direction(v, 'T', 'call')).toBe('up');
    expect(direction(v, 'rd', 'call')).toBe('up');
    expect(direction(v, 'rd', 'put')).toBe('down');
    expect(direction(v, 'rf', 'call')).toBe('down');
    expect(direction(v, 'rf', 'put')).toBe('up');
  });

  it('a deep ITM call can lose value with more time when rf > rd (carry), and a far OTM option is flat', () => {
    const deep = { ...v, K: 0.74, vol: 0.02, weeks: 26 };
    expect(direction(deep, 'T', 'call')).toBe('down');
    const far = { ...v, K: 0.86, vol: 0.02, weeks: 1 };
    expect(direction(far, 'vol', 'call')).toBe('flat');
  });

  it('slope equals the Greek (delta in pips per unit of spot)', () => {
    const g = greeks(E.spot, K, E.T, E.vol, E.rd, E.rf, 'call');
    expect(slope(v, 'S', 'call') * 1e-4).toBeCloseTo(g.delta, 6);
    expect(slope(v, 'vol', 'call') * 1e-4).toBeCloseTo(g.vega, 5);
  });

  it('bump effects and curves', () => {
    expect(bumpEffect(v, 'vol', 'call')).toBeGreaterThan(0);
    expect(bumpEffect({ ...v, weeks: 52 }, 'T', 'call')).toBe(0);
    const c = driverCurve(v, 'S', 40);
    expect(c.xs).toHaveLength(41);
    expect(c.xs[0]).toBe(DRIVERS.S.min);
    expect(c.call[40]).toBeGreaterThan(c.call[0]!);
    expect(c.put[40]).toBeLessThan(c.put[0]!);
    expect(withDriver(v, 'T', 26).weeks).toBe(26);
  });
});

describe('module 04 numbers on screen add up', () => {
  const v = (k: string) => m04nums[k]!.value;
  const shown = (k: string, digits: number) => Number(v(k).toFixed(digits));

  it('section 1: forward, option cost and saving', () => {
    expect(shown('m04.fwdChf', 0)).toBe(Math.round(v('m04.fwdDeal') * E.notional));
    expect(shown('m04.fwdChf', 0) - shown('m04.optionDownChf', 0)).toBe(
      shown('m04.saveDownChf', 0),
    );
    expect(shown('m04.unhedgedUpChf', 0) - shown('m04.capChf', 0)).toBe(shown('m04.saveUpChf', 0));
    expect(Math.round(K * E.notional) + Math.round(call * E.notional)).toBe(shown('m04.capChf', 0));
  });

  it('section 2: payoff − premium = P&L (pips) and the CHF amount matches', () => {
    const pnl = shown('m04.payoffPnlPips', 0) - Number((call / 1e-4).toFixed(2));
    expect(pnl).toBeCloseTo(shown('m04.pnlPips', 2), 9);
    expect(Math.round(v('m04.pnlChf'))).toBe(Math.round(shown('m04.pnlPips', 2) * 100));
  });

  it('section 3: intrinsic + time value = premium (1 digit)', () => {
    expect(shown('m04.itmIntrinsicPips', 1) + shown('m04.itmTimePips', 1)).toBeCloseTo(
      shown('m04.itmPips', 1),
      9,
    );
  });

  it('section 4: call − put = parity gap, as shown', () => {
    const diff = Number((call / 1e-4).toFixed(2)) - Number((put / 1e-4).toFixed(2));
    expect(Number(diff.toFixed(1))).toBe(shown('m04.parityPips', 1));
    expect(shown('m04.parityGapPips', 1)).toBe(shown('m04.parityPips', 1));
  });

  it('quiz: every question has its correct option at the stated index and unique labels', () => {
    for (const q of [...m04quiz.quiz, ...Object.values(m04quiz.checks)]) {
      expect(q.options[q.correct]!.explain.de.startsWith('Richtig')).toBe(true);
      expect(q.options[q.correct]!.explain.en.startsWith('Correct')).toBe(true);
      const labels = q.options.map((o) => o.label.de);
      expect(new Set(labels).size).toBe(labels.length);
    }
  });

  it('check 3: time value = premium − intrinsic against the forward', () => {
    const c3 = m04quiz.checks['3']!;
    expect(c3.options[c3.correct]!.label.de).toBe(`${fmtPips(M04.itmTimePips, 'de')} Pips`);
    expect(M04.itmVsSpotPips).toBeGreaterThan(M04.itmPips);
  });
});

describe('module 04.3: spot vs forward moneyness and intrinsic value (C7, C8)', () => {
  const v = (k: string) => m04nums[k]!.value;
  const de = (k: string) => formatNum(m04nums[k]!, 'de');

  it('kMid call: ITM in spot moneyness, OTM in forward moneyness (check values)', () => {
    expect(de('m04.kMid')).toBe('0.7990');
    expect(de('m04.kMidSpotPips')).toBe('10');
    expect(de('m04.kMidOtmPips')).toBe('59.7');
    expect(v('m04.kMid')).toBeLessThan(E.spot);
    expect(v('m04.kMid')).toBeGreaterThan(F);
  });

  it('ITM call K = 0.7730: premium, intrinsic value against the forward, time value', () => {
    expect(de('m04.kItm')).toBe('0.7730');
    expect(de('m04.itmPips')).toBe('249.8');
    expect(de('m04.itmIntrinsicPips')).toBe('200.3');
    expect(de('m04.itmTimePips')).toBe('49.5');
    expect(v('m04.itmIntrinsicPips') + v('m04.itmTimePips')).toBeCloseTo(v('m04.itmPips'), 9);
  });

  it('ITM call against spot: classic intrinsic value and a negative time value', () => {
    expect(v('m04.itmSpotIntrinsicPips')).toBeCloseTo(270.0, 9);
    expect(de('m04.itmSpotIntrinsicPips')).toBe('270.0');
    expect(v('m04.itmSpotTimePips')).toBeCloseTo(-20.19, 2);
    expect(de('m04.itmSpotTimePips')).toBe('−20.2');
    expect(v('m04.itmSpotIntrinsicPips') + v('m04.itmSpotTimePips')).toBeCloseTo(
      v('m04.itmPips'),
      9,
    );
    // as shown: 249.8 − 270.0 = −20.2
    expect(
      Number(v('m04.itmPips').toFixed(1)) - Number(v('m04.itmSpotIntrinsicPips').toFixed(1)),
    ).toBeCloseTo(Number(v('m04.itmSpotTimePips').toFixed(1)), 9);
    expect(M04.itmSpotTimePips).toBe(v('m04.itmSpotTimePips'));
    expect(M04.itmVsSpotPips).toBe(v('m04.itmSpotIntrinsicPips'));
  });

  it('quiz m04-q3 asks in forward moneyness and calls the spot answers spot moneyness', () => {
    const q3 = m04quiz.quiz.find((q) => q.id === 'm04-q3')!;
    expect(q3.prompt.de).toContain('In Forward-Moneyness, wie in diesem Tool');
    expect(q3.prompt.en).toContain('In forward moneyness, as in this tool');
    const wrong = q3.options.filter((_, i) => i !== q3.correct);
    const spotAnswers = wrong.filter((o) => o.label.en.startsWith('ITM'));
    expect(spotAnswers).toHaveLength(2);
    for (const o of spotAnswers) {
      expect(o.explain.de).toContain('gilt in Spot-Moneyness');
      expect(o.explain.de).toMatch(/gefragt war Forward-Moneyness/i);
      expect(o.explain.en).toContain('holds in spot moneyness');
    }
    for (const o of q3.options) {
      expect(o.explain.de).not.toMatch(/typische Fehler/);
      expect(o.explain.en).not.toMatch(/classic mistake/);
    }
  });

  it('check m04-c3 asks for the time value against the forward and names the spot answer', () => {
    const c3 = m04quiz.checks['3']!;
    expect(c3.prompt.de).toContain('gegen den Forward');
    expect(c3.prompt.en).toContain('against the forward');
    for (const o of c3.options) {
      expect(o.explain.de).not.toMatch(/ergibt keinen Sinn/);
      expect(o.explain.en).not.toMatch(/makes no sense/);
    }
    const spot = c3.options.find(
      (o) => o.label.de === `${fmtPips(M04.itmSpotTimePips, 'de', 1)} Pips`,
    )!;
    expect(spot).toBeDefined();
    expect(c3.options.indexOf(spot)).not.toBe(c3.correct);
    expect(spot.explain.de).toContain('Zeitwert gegen den Spot');
    expect(spot.explain.en).toContain('time value against spot');
    // the label shows the same value as the 04.3 text: −20.2 pips
    expect(spot.label.de).toBe(`${formatNum(m04nums['m04.itmSpotTimePips']!, 'de')} Pips`);
  });
});
