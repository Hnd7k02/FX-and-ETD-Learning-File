/**
 * Module 08: the statements in the section texts must stay true for the registered numbers
 * (if MC_CONFIG, the presets or mc-products.json change, these tests say which sentence to
 * rewrite), and the quiz must be well formed.
 */
import { describe, expect, it } from 'vitest';
import { M08 as M, nums } from '@/lib/nums/m08';
import { quiz } from '@/content/quiz/08-structured-products';
import { EXAMPLE } from '@/lib/fx/example';

describe('module 08 numbers back the texts', () => {
  it('section 1: the strike story adds up in whole pips', () => {
    expect(M.accK2).toBeLessThan(M.accFwd);
    expect(M.accStrike).toBeLessThan(M.accK2);
    expect(Math.round(M.accK2Pips) + Math.round(M.accKoPips)).toBe(Math.round(M.accBetterPips));
    expect(M.accSePips).toBeLessThan(1);
    expect(M.accAvgDay / 365).toBeGreaterThan(0.2);
    expect(M.accAvgDay / 365).toBeLessThan(0.3);
  });

  it('section 2: knock-out up, calm wins, double amounts down', () => {
    expect(M.accUp.reason).toBe('knockout');
    expect(M.accUp.base).toBeLessThan(M.accUp.need);
    expect(M.accUp.diff).toBeLessThan(0);
    expect(M.accSide.reason).toBe('maturity');
    expect(M.accSide.leveraged).toBe(0);
    expect(M.accSide.diff).toBeGreaterThan(0);
    expect(M.accDown.reason).toBe('maturity');
    expect(M.accDown.base).toBeGreaterThan(M.accDown.need);
    expect(M.accDown.diff).toBeLessThan(0);
    expect(M.accDown.firstLeveraged).toBeGreaterThan(1);
    expect(M.accBreakLev).toBeLessThan(M.accStrike);
    expect(M.decStrike).toBeGreaterThan(EXAMPLE.spot);
    expect(M.decBarrier).toBeLessThan(EXAMPLE.spot);
  });

  it('section 3: good scenarios end early, an early shock runs to maturity', () => {
    expect(M.tarfStrike).toBeLessThan(EXAMPLE.spot - 0.04);
    expect(M.tarfPTarget).toBeGreaterThan(0.9);
    expect(M.tarfUp.reason).toBe('target');
    expect(M.tarfUp.pnl).toBeCloseTo(M.tarfTargetChf, 6);
    expect(M.tarfUp.diff).toBeLessThan(0);
    expect(M.tarfShock.reason).toBe('maturity');
    expect(M.tarfShock.firstLeveraged).toBe(1);
    expect(M.tarfShock.leveraged).toBe(M.tarfFixings);
    expect(M.tarfShock.base).toBeCloseTo(2 * M.tarfShock.need, 6);
    expect(M.tarfShock.pnl).toBeLessThan(0);
    expect(M.tarfK2).toBeGreaterThan(M.tarfStrike);
    expect(M.tarfImpliedLoss).toBeLessThan(-10 * M.tarfTargetChf);
    expect(M.pivQ05).toBeGreaterThan(0);
    expect(M.pivWorst).toBeLessThan(0);
    expect(M.pivShock.pnl).toBeLessThan(0);
    expect(M.shockGap).toBeLessThan(0);
  });

  it('section 4: coupons capped, losses beyond the coupons, conversion below the strike', () => {
    expect(M.tpfSide.reason).toBe('target');
    expect(M.tpfSide.coupons).toBe(M.tpfTargetCoupons);
    expect(M.tpfSide.pnl).toBeCloseTo(M.tpfMaxChf, 6);
    expect(M.tpfDown.pnl).toBeLessThan(-M.tpfDown.bench);
    expect(M.rtpfUp.reason).toBe('maturity');
    expect(M.rtpfUp.pnl).toBeLessThan(0);
    expect(M.rtpfUp.bench).toBeGreaterThan(0);
    expect(M.tpfFwdEnd).toBeLessThan(M.tpfStrike);
    expect(M.tpfCrossMonth).toBeGreaterThan(6);
    expect(M.tpfCrossMonth).toBeLessThan(12);
    expect(M.tpfCouponPips).toBeGreaterThan(M.tpfCouponNoTargetPips);
    expect(M.rtpfCouponPips).toBeGreaterThan(M.rtpfCouponNoTargetPips);
    expect(M.dciFixing).toBeLessThan(M.dciStrike);
    expect(M.dciOutDiff).toBeLessThan(0);
    expect(M.dciStrikeVsFwdPips).toBeLessThan(0);
    expect(M.dciMm).toBe(0);
    expect(M.dci3Interest).toBeGreaterThan(M.dciInterest);
    expect(M.dci3Yield).toBeLessThan(M.dciYield);
  });

  it('registers only finite m08 numbers', () => {
    for (const [k, d] of Object.entries(nums)) {
      expect(k.startsWith('m08.'), k).toBe(true);
      expect(Number.isFinite(d.value), k).toBe(true);
    }
  });
});

describe('module 08 quiz', () => {
  const all = [...quiz.quiz, ...Object.values(quiz.checks)];

  it('has four graded questions and one check per section', () => {
    expect(quiz.slug).toBe('08-structured-products');
    expect(quiz.quiz).toHaveLength(4);
    expect(Object.keys(quiz.checks).sort()).toEqual(['1', '2', '3', '4']);
    expect(new Set(all.map((q) => q.id)).size).toBe(all.length);
  });

  it.each(all.map((q) => [q.id, q] as const))('%s is well formed in DE and EN', (_id, q) => {
    expect(q.options.length).toBeGreaterThanOrEqual(3);
    expect(q.options.length).toBeLessThanOrEqual(4);
    expect(q.correct).toBeGreaterThanOrEqual(0);
    expect(q.correct).toBeLessThan(q.options.length);
    const texts = [q.prompt, ...q.options.flatMap((o) => [o.label, o.explain])];
    for (const t of texts) {
      for (const lang of ['de', 'en'] as const) {
        expect(t[lang].trim()).not.toBe('');
        expect(t[lang]).not.toMatch(/NaN|undefined|Infinity|\{\w+\}/);
      }
    }
    const labels = q.options.map((o) => o.label.de);
    expect(new Set(labels).size).toBe(labels.length);
  });
});
