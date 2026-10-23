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
  endOf,
  nextTarget,
  parity,
  parityFrame,
  parityLayout,
  prevTarget,
  startOf,
  stepAt,
  stepState,
  timeline,
  type ParityCard,
} from '@/lib/m02/parity';
import {
  curveDomain,
  curvePoint,
  forwardCurve,
  matchPreset,
  nearestTenor,
  pointsApprox,
  premiumWording,
  visibleLabels,
  visibleLabelsByPriority,
} from '@/lib/m02/curve';
import {
  CARRY_MARKET,
  carryFor,
  clampMarket,
  groupSteps,
  marketRange,
  netFlows,
  reactionAt,
  revealOrder,
  snapMarket,
  startMarket,
  stepRateKind,
} from '@/lib/m02/carry';
import { nums } from '@/lib/nums/m02';
import { quiz } from '@/content/quiz/02-forward';
import { facts } from '@/content/facts/m02';

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
    expect(stepState(2, 2, 0)).toBe('todo');
  });

  it('steps forward and back through the timeline', () => {
    const tl = timeline([100, 100, 100]);
    // mid-step 1 → end of step 1; at a step start → end of that step; at the end → end
    expect(nextTarget(150, tl)).toBe(200);
    expect(nextTarget(200, tl)).toBe(300);
    expect(nextTarget(0, tl)).toBe(100);
    expect(nextTarget(tl.total, tl)).toBe(tl.total);
    expect(prevTarget(150, tl)).toBe(100);
    expect(prevTarget(200, tl)).toBe(100);
    expect(prevTarget(0, tl)).toBe(0);
    expect(prevTarget(tl.total, tl)).toBe(tl.starts[PARITY_STEPS.length - 1]);
    expect(endOf(99, tl)).toBe(tl.total);
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

  it('keeps the selected and the named tenors first when labels collide', () => {
    const ids = ['1W', '1M', '2M', '3M'];
    const xs = [0, 15, 30, 45];
    // 1M and 3M by priority; 1W and 2M are too close to them.
    expect(visibleLabelsByPriority(xs, ids, 20, ['1M', '3M'])).toEqual([1, 3]);
    // The selected tenor wins over the priority list.
    expect(visibleLabelsByPriority(xs, ids, 20, ['1M', '3M'], 0)).toEqual([0, 3]);
    // Everything fits: all labels in order.
    expect(visibleLabelsByPriority(xs, ids, 10, ['3M'])).toEqual([0, 1, 2, 3]);
    expect(visibleLabelsByPriority([], [], 10)).toEqual([]);
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

describe('m02 parity playback frame', () => {
  const tl = timeline();
  const P2 = { ...P, rd: 0.02 };
  const r2 = parity(P2);

  it('shows nothing before the start and everything after the end', () => {
    const f0 = parityFrame(0, P2, r2, tl);
    expect(PARITY_STEPS.every((id) => f0.steps[id].state === 'todo')).toBe(true);
    expect(f0.day).toBe(0);
    expect(f0.usd).toBeCloseTo(r2.usdToday, 6);
    const fEnd = parityFrame(tl.total + 10, P2, r2, tl);
    expect(PARITY_STEPS.every((id) => fEnd.steps[id].state === 'done')).toBe(true);
    expect(PARITY_STEPS.every((id) => fEnd.steps[id].k === 1)).toBe(true);
    expect(fEnd.day).toBe(P2.days);
    expect(fEnd.usd).toBeCloseTo(N, 6);
    expect(fEnd.chf).toBeCloseTo(r2.chfRepay, 6);
  });

  it('counts the amount of the active step and runs the days during the term', () => {
    const i = PARITY_STEPS.indexOf('B1');
    const mid = parityFrame(tl.starts[i]! + tl.durations[i]! * 0.3, P2, r2, tl);
    expect(mid.steps.B1.state).toBe('active');
    expect(mid.steps.B1.k).toBeGreaterThan(0);
    expect(mid.steps.B1.k).toBeLessThan(1);
    expect(mid.steps.A1.state).toBe('done');
    const late = parityFrame(tl.starts[i]! + tl.durations[i]! * 0.8, P2, r2, tl);
    expect(late.steps.B1.k).toBe(1);
    const ti = PARITY_STEPS.indexOf('time');
    const half = parityFrame(tl.starts[ti]! + tl.durations[ti]! / 2, P2, r2, tl);
    expect(half.day).toBeCloseTo(P2.days / 2, 6);
    expect(half.usd).toBeGreaterThan(r2.usdToday);
    expect(half.usd).toBeLessThan(N);
    expect(half.chf).toBeGreaterThan(r2.chfLoan);
  });

  it('lays out two lanes that fit the width and do not overlap', () => {
    for (const w of [300, 326, 519, 520, 600, 1000]) {
      const L = parityLayout(w);
      expect(L.compact).toBe(w < 520);
      expect(L.font).toBeGreaterThanOrEqual(11);
      expect(L.laneA.x + L.laneA.w).toBeLessThan(L.laneB.x);
      expect(L.laneB.x + L.laneB.w).toBeCloseTo(L.width, 6);
      const ids = Object.keys(L.cards) as ParityCard[];
      for (const id of ids) {
        const c = L.cards[id];
        expect(c.x).toBeGreaterThanOrEqual(0);
        expect(c.x + c.w).toBeLessThanOrEqual(L.width + 1e-9);
        expect(c.y + c.h).toBeLessThan(L.result.y);
      }
      // lane B cards stack without overlap; the term band sits between today and maturity
      const b = ['B1', 'B2', 'B3', 'B4', 'B5'].map((id) => L.cards[id as ParityCard]);
      for (let k = 1; k < b.length; k++) expect(b[k]!.y).toBeGreaterThan(b[k - 1]!.y + b[k - 1]!.h);
      expect(L.termY).toBeGreaterThan(L.cards.B3.y + L.cards.B3.h);
      expect(L.maturityY).toBeLessThan(L.cards.B4.y);
      // route A's settlement card spans both maturity rows, so the "=" signs line up
      expect(L.cards.A2.y).toBe(L.cards.B4.y);
      expect(L.cards.A2.y + L.cards.A2.h).toBe(L.cards.B5.y + L.cards.B5.h);
      expect(L.height).toBeGreaterThan(L.result.y + L.result.h);
    }
    expect(parityLayout(100).width).toBe(300);
  });
});

describe('m02 curve presets and tenor picking', () => {
  it('recognises the presets of the config', () => {
    for (const p of M02_CONFIG.curve.presets) expect(matchPreset(p.rd, p.rf)).toBe(p.id);
    expect(matchPreset(0.011, 0.022)).toBeNull();
    const swapped = M02_CONFIG.curve.presets.find((p) => p.id === 'swapped')!;
    const pt = curvePoint(
      { spot: M.spot, rd: swapped.rd, rf: swapped.rf, basisQuote: 360, basisBase: 360 },
      { id: '3M', days: 90 },
    );
    expect(pt.wording).toBe('premium');
  });

  it('picks the nearest tenor', () => {
    expect(M02_CONFIG.curve.tenors[nearestTenor(0)]!.id).toBe('1W');
    expect(M02_CONFIG.curve.tenors[nearestTenor(95)]!.id).toBe('3M');
    expect(M02_CONFIG.curve.tenors[nearestTenor(400)]!.id).toBe('1Y');
  });
});

describe('m02 cash and carry display helpers', () => {
  const fair = forwardMoneyMarket(M.spot, M.rd, M.rf, M.days);

  it('labels step rates as interest or FX rates', () => {
    expect(stepRateKind('borrowQuote')).toBe('pct');
    expect(stepRateKind('investBase')).toBe('pct');
    expect(stepRateKind('withdrawQuote')).toBe('pct');
    expect(stepRateKind('repayBase')).toBe('pct');
    expect(stepRateKind('buyBaseSpot')).toBe('fx');
    expect(stepRateKind('sellBaseForward')).toBe('fx');
    expect(stepRateKind('profit')).toBe('none');
  });

  it('reveals today first, then maturity, then the profit', () => {
    const order = revealOrder(carryFor(fair + 10 * PIP));
    expect(order).toHaveLength(9);
    expect(order[0]).toBe('borrowQuote');
    expect(order[4]).toBe('withdrawBase');
    expect(order[8]).toBe('profit');
    expect(revealOrder(carryFor(fair))).toEqual([]);
  });
});

describe('m02 quiz', () => {
  const all = [...quiz.quiz, ...Object.values(quiz.checks)];

  it('has four graded questions and one check per section', () => {
    expect(quiz.slug).toBe('02-forward');
    expect(quiz.quiz).toHaveLength(4);
    expect(Object.keys(quiz.checks).sort()).toEqual(['1', '2', '3', '4']);
  });

  it('has 3–4 distinct options with explanations in both languages', () => {
    const ids = new Set<string>();
    for (const q of all) {
      expect(ids.has(q.id)).toBe(false);
      ids.add(q.id);
      expect(q.options.length).toBeGreaterThanOrEqual(3);
      expect(q.options.length).toBeLessThanOrEqual(4);
      expect(q.correct).toBeGreaterThanOrEqual(0);
      expect(q.correct).toBeLessThan(q.options.length);
      for (const lang of ['de', 'en'] as const) {
        expect(q.prompt[lang].trim()).not.toBe('');
        const labels = q.options.map((o) => o.label[lang]);
        expect(new Set(labels).size).toBe(labels.length);
        for (const o of q.options) {
          expect(o.label[lang].trim()).not.toBe('');
          expect(o.explain[lang].trim()).not.toBe('');
          expect(o.label[lang]).not.toMatch(/NaN|undefined|\{\w+\}/);
          expect(o.explain[lang]).not.toMatch(/NaN|undefined|\{\w+\}/);
        }
      }
    }
  });

  it('marks the computed values as correct', () => {
    expect(quiz.checks['1'].options[quiz.checks['1'].correct]!.label.de).toBe('CHF\u00a0793’061');
    expect(quiz.checks['2'].options[quiz.checks['2'].correct]!.label.en).toBe('USD\u00a0991,326');
    expect(quiz.quiz[1].options[quiz.quiz[1].correct]!.label.de).toBe('0.79306');
    expect(quiz.quiz[0].options[quiz.quiz[0].correct]!.label.de).toBe('CHF\u00a0+46’939');
    expect(quiz.quiz[3].options[quiz.quiz[3].correct]!.label.de).toContain('1’000');
  });
});

describe('m02 facts', () => {
  it('have both languages and a source', () => {
    for (const [id, f] of Object.entries(facts)) {
      expect(id.startsWith('m02-')).toBe(true);
      expect(f.de.trim()).not.toBe('');
      expect(f.en.trim()).not.toBe('');
      expect(f.source).toBe('bis-rpfx25-fx');
    }
  });
});
