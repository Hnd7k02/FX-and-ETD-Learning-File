/**
 * Module 02 (Forward): pure logic of the four figures (src/lib/m02) and the number registry
 * m02 against the reference values of MASTER_PROMPT §6.
 */
import { describe, expect, it } from 'vitest';
import { forwardContinuous, forwardMoneyMarket } from '@/lib/fx/forward';
import { M02_CONFIG, PIP } from '@/lib/m02/config';
import {
  dealForward,
  defaultScenarios,
  hedgeOutcome,
  scenarioRates,
  scenarioStats,
  snapRate,
} from '@/lib/m02/hedge';
import {
  PARITY_STEPS,
  balancesAt,
  parity,
  startOf,
  stepAt,
  stepState,
  timeline,
} from '@/lib/m02/parity';
import {
  curveDomain,
  curvePoint,
  forwardCurve,
  pointsApprox,
  premiumWording,
  visibleLabels,
} from '@/lib/m02/curve';
import {
  CARRY_MARKET,
  carryFor,
  clampMarket,
  groupSteps,
  marketRange,
  netFlows,
  reactionAt,
  snapMarket,
  startMarket,
} from '@/lib/m02/carry';
import { nums } from '@/lib/nums/m02';

const M = M02_CONFIG.market;
const N = M.notional;
const P = {
  spot: M.spot,
  rd: M.rd,
  rf: M.rf,
  days: M.days,
  notional: N,
  basisQuote: M.basisQuote,
  basisBase: M.basisBase,
};

describe('m02 hedge outcome', () => {
  const F = dealForward();

  it('deals the money-market forward of the example (0.79306)', () => {
    expect(F).toBeCloseTo(0.79306, 5);
    expect(dealForward(M, 'continuous')).toBeCloseTo(0.79303, 5);
  });

  it('costs N · S_T unhedged and N · F with the forward', () => {
    const up = hedgeOutcome(0.84, F, N);
    expect(up.unhedged).toBeCloseTo(840_000, 6);
    expect(up.hedged).toBeCloseTo(N * F, 6);
    expect(up.verdict).toBe('saves');
    expect(up.diff).toBeGreaterThan(0);
    const down = hedgeOutcome(0.76, F, N);
    expect(down.verdict).toBe('costs');
    expect(down.diff).toBeCloseTo(760_000 - N * F, 6);
    expect(hedgeOutcome(F, F, N).verdict).toBe('equal');
  });

  it('snaps rates to the slider grid and clamps them', () => {
    expect(snapRate(0.80026)).toBe(0.8005);
    expect(snapRate(0.5)).toBe(M02_CONFIG.hedge.stRange[0]);
    expect(snapRate(1.2)).toBe(M02_CONFIG.hedge.stRange[1]);
  });

  it('draws reproducible, balanced lognormal scenarios around the forward', () => {
    const a = scenarioRates(7, 41, F, 0.08, 0.25);
    const b = scenarioRates(7, 41, F, 0.08, 0.25);
    expect(a).toEqual(b);
    expect(a).toHaveLength(41);
    expect(scenarioRates(8, 41, F, 0.08, 0.25)).not.toEqual(a);
    const big = scenarioRates(1, 20_000, F, 0.08, 0.25);
    const mean = big.reduce((s, x) => s + x, 0) / big.length;
    expect(Math.abs(mean - F)).toBeLessThan(0.0005);
    expect(Math.min(...big)).toBeGreaterThan(0);
  });

  it('summarises the spread the forward removes', () => {
    const rates = [0.76, 0.8, 0.84, F];
    const s = scenarioStats(rates, F, N);
    expect(s.n).toBe(4);
    expect(s.min).toBeCloseTo(760_000, 6);
    expect(s.max).toBeCloseTo(840_000, 6);
    expect(s.spread).toBeCloseTo(80_000, 6);
    expect(s.forwardCheaper).toBe(2);
    expect(s.forwardDearer).toBe(1);
    expect(s.mean).toBeCloseTo(((0.76 + 0.8 + 0.84 + F) / 4) * N, 6);
    expect(scenarioStats([], F, N).n).toBe(0);
  });

  it('builds the default sample from the config', () => {
    const d = defaultScenarios();
    expect(d).toHaveLength(M02_CONFIG.hedge.scenarios.count);
    const s = scenarioStats(d, F, N);
    expect(s.forwardCheaper + s.forwardDearer).toBe(d.length);
    // antithetic pairs keep the sample balanced around the forward
    expect(Math.abs(s.forwardCheaper - s.forwardDearer)).toBeLessThanOrEqual(6);
  });
});

describe('m02 parity', () => {
  const r = parity(P);

  it('route B costs the same as route A (covered interest parity)', () => {
    expect(r.forward).toBeCloseTo(forwardMoneyMarket(M.spot, M.rd, M.rf, M.days), 12);
    expect(r.chfRepay).toBeCloseTo(r.chfForward, 6);
    expect(r.usdToday * r.growthBase).toBeCloseTo(N, 6);
    expect(r.chfLoan).toBeCloseTo(M.spot * r.usdToday, 6);
    expect(r.usdInterest).toBeCloseTo(N - r.usdToday, 6);
    expect(r.chfInterest).toBeCloseTo(0, 9);
  });

  it('matches the reference forwards and their 0.3-pip gap', () => {
    expect(r.forward).toBeCloseTo(0.79306, 5);
    expect(r.forwardContinuous).toBeCloseTo(forwardContinuous(M.spot, M.rd, M.rf, M.T), 12);
    expect(r.diffPips).toBeCloseTo(-0.3, 1);
    expect(r.points).toBeCloseTo(-69.4, 1);
  });

  it('holds for other rates and terms, also with a positive CHF rate', () => {
    for (const [rd, rf, days] of [
      [0.04, 0.01, 180],
      [-0.0075, 0.02, 30],
      [0.02, 0.02, 365],
    ] as const) {
      const q = parity({ ...P, rd, rf, days });
      expect(q.chfRepay).toBeCloseTo(q.chfForward, 6);
      expect(q.chfInterest).toBeCloseTo(q.chfLoan * rd * (days / 360), 6);
    }
    expect(parity({ ...P, rd: 0.02, rf: 0.02, days: 365 }).points).toBeCloseTo(0, 9);
    expect(parity({ ...P, rd: 0.04, rf: 0.01, days: 180 }).points).toBeGreaterThan(0);
  });

  it('accrues the balances of route B day by day', () => {
    const q = { ...P, rd: 0.02 };
    const rq = parity(q);
    expect(balancesAt(0, q, rq).usd).toBeCloseTo(rq.usdToday, 6);
    expect(balancesAt(q.days, q, rq).usd).toBeCloseTo(N, 6);
    expect(balancesAt(q.days, q, rq).chf).toBeCloseTo(rq.chfRepay, 6);
    expect(balancesAt(999, q).usd).toBeCloseTo(N, 6);
    expect(balancesAt(-5, q).chf).toBeCloseTo(rq.chfLoan, 6);
  });

  it('plays the steps on a timeline', () => {
    const tl = timeline([100, 200]);
    expect(tl.durations).toHaveLength(PARITY_STEPS.length);
    expect(tl.durations[0]).toBe(100);
    expect(tl.durations[2]).toBe(1000);
    expect(tl.starts[1]).toBe(100);
    expect(stepAt(0, tl)).toEqual({ index: 0, frac: 0 });
    expect(stepAt(150, tl)).toEqual({ index: 1, frac: 0.25 });
    expect(stepAt(-10, tl).index).toBe(0);
    expect(stepAt(tl.total + 5, tl)).toEqual({ index: PARITY_STEPS.length - 1, frac: 1 });
    expect(startOf(1, tl)).toBe(100);
    expect(startOf(-1, tl)).toBe(0);
    expect(startOf(99, tl)).toBe(tl.total);
    const def = timeline();
    expect(def.total).toBe(M02_CONFIG.parity.stepMs.reduce((s, x) => s + x, 0));
    expect(stepState(0, 2, 0.5)).toBe('done');
    expect(stepState(3, 2, 0.5)).toBe('todo');
    expect(stepState(2, 2, 0.5)).toBe('active');
    expect(stepState(2, 2, 1)).toBe('done');
  });
});

describe('m02 forward curve', () => {
  const market = {
    spot: M.spot,
    rd: M.rd,
    rf: M.rf,
    basisQuote: M.basisQuote,
    basisBase: M.basisBase,
  };

  it('splits the forward into spot + cost − benefit', () => {
    const p = curvePoint(market, { id: '3M', days: 90 });
    expect(p.costPips).toBeCloseTo(0, 9);
    expect(p.benefitPips).toBeCloseTo(69.4, 1);
    expect(p.points).toBeCloseTo(p.costPips - p.benefitPips, 9);
    expect(p.forward).toBeCloseTo(M.spot + (p.costPips - p.benefitPips) * PIP, 12);
    expect(p.wording).toBe('discount');
    expect(p.premiumPa).toBeCloseTo(-0.0347, 4);
  });

  it('gives a premium when the CHF rate is higher and flat when both are equal', () => {
    const hi = curvePoint({ ...market, rd: 0.05 }, { id: '1Y', days: 365 });
    expect(hi.wording).toBe('premium');
    expect(hi.costPips).toBeGreaterThan(hi.benefitPips);
    expect(curvePoint({ ...market, rd: 0.035 }, { id: '6M', days: 182 }).wording).toBe('flat');
    expect(premiumWording(0.01)).toBe('flat');
    expect(premiumWording(-3)).toBe('discount');
  });

  it('covers every tenor of the config and grows with the term', () => {
    const c = forwardCurve(market);
    expect(c.map((p) => p.id)).toEqual(M02_CONFIG.curve.tenors.map((t) => t.id));
    for (let i = 1; i < c.length; i++) expect(c[i]!.points).toBeLessThan(c[i - 1]!.points);
    expect(pointsApprox(market, 90)).toBeCloseTo(-70, 9);
    const [lo, hi] = curveDomain(c);
    expect(lo).toBeLessThanOrEqual(Math.min(...c.map((p) => -p.benefitPips)));
    expect(hi).toBeGreaterThanOrEqual(50);
    expect(Math.abs(lo % 50)).toBe(0);
  });

  it('keeps x labels apart and always shows the last one', () => {
    expect(visibleLabels([0, 5, 30, 60, 62], 20)).toEqual([0, 2, 4]);
    expect(visibleLabels([0, 40, 80], 20)).toEqual([0, 1, 2]);
    expect(visibleLabels([], 20)).toEqual([]);
  });
});

describe('m02 cash and carry calculator', () => {
  const fair = forwardMoneyMarket(M.spot, M.rd, M.rf, M.days);

  it('starts 10 pips rich and earns N · gap at maturity', () => {
    const mkt = startMarket(fair);
    const r = carryFor(mkt);
    expect(r.fairForward).toBeCloseTo(fair, 12);
    expect(r.mispricingPips).toBeCloseTo(M02_CONFIG.arbitrage.mispricingPips, 9);
    expect(r.direction).toBe('borrowQuoteBuyBase');
    expect(r.profitQuote).toBeCloseTo(1000, 6);
    const g = groupSteps(r);
    expect(g.today.map((s) => s.key)).toEqual([
      'borrowQuote',
      'buyBaseSpot',
      'investBase',
      'sellBaseForward',
    ]);
    expect(g.maturity).toHaveLength(4);
    expect(g.profit?.amount).toBeCloseTo(1000, 6);
    const net = netFlows(r);
    expect(net.today).toEqual({ CHF: 0, USD: 0 });
    expect(net.maturity.USD).toBe(0);
    expect(net.maturity.CHF).toBeCloseTo(1000, 6);
  });

  it('reverses when the market forward is too cheap', () => {
    const r = carryFor(fair - 10 * PIP);
    expect(r.direction).toBe('borrowBaseSellBase');
    const net = netFlows(r);
    expect(net.today).toEqual({ USD: 0, CHF: 0 });
    expect(net.maturity.CHF).toBeCloseTo(1000, 6);
    expect(groupSteps(r).today[0]!.key).toBe('borrowBase');
  });

  it('does nothing at the fair forward', () => {
    const r = carryFor(fair);
    expect(r.direction).toBe('none');
    const g = groupSteps(r);
    expect(g.today).toHaveLength(0);
    expect(g.profit).toBeNull();
    expect(netFlows(r)).toEqual({ today: {}, maturity: {} });
  });

  it('keeps the market forward in range and on the grid', () => {
    const rng = marketRange(fair);
    expect(rng.max - rng.min).toBeCloseTo(2 * M02_CONFIG.arbitrage.rangePips * PIP, 12);
    expect(clampMarket(2, fair)).toBe(rng.max);
    expect(clampMarket(0, fair)).toBe(rng.min);
    expect(clampMarket(Number.NaN, fair)).toBe(fair);
    expect((snapMarket(fair + 0.000123, fair) - fair) / PIP).toBeCloseTo(1.2, 9);
    expect(CARRY_MARKET.notional).toBe(N);
  });

  it('glides back to fair when the market reacts', () => {
    const from = fair + 10 * PIP;
    expect(reactionAt(from, fair, 0)).toBe(from);
    expect(reactionAt(from, fair, 1)).toBe(fair);
    expect(reactionAt(from, fair, 0.5)).toBeCloseTo(fair + 5 * PIP, 12);
    expect(reactionAt(from, fair, -1)).toBe(from);
  });
});

describe('m02 numbers', () => {
  it('registers only m02 keys with finite values', () => {
    for (const [k, d] of Object.entries(nums)) {
      expect(k.startsWith('m02.')).toBe(true);
      expect(Number.isFinite(d.value), k).toBe(true);
    }
  });

  it('matches the reference values', () => {
    expect(nums['m02.fwd']!.value).toBeCloseTo(0.79306, 5);
    expect(nums['m02.fwdChf']!.value).toBeCloseTo(793_060.7, 1);
    expect(nums['m02.usdToday']!.value).toBeCloseTo(991_325.9, 1);
    expect(nums['m02.arbProfit']!.value).toBeCloseTo(1000, 6);
    expect(nums['m02.benefitPips']!.value).toBeCloseTo(69.4, 1);
  });
});

describe('m02 text helpers', () => {
  it('wraps at spaces and estimates widths', async () => {
    const { wrapText, textWidth } = await import('@/lib/m02/text');
    expect(wrapText('one two three four', 9)).toEqual(['one two', 'three', 'four']);
    expect(wrapText('  ', 5)).toEqual([]);
    expect(wrapText('averyveryverylongword x', 5)).toEqual(['averyveryverylongword', 'x']);
    expect(textWidth('abcd', 10)).toBeCloseTo(22.4, 9);
  });
});
