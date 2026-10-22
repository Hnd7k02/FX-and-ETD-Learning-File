/**
 * Module 05 numbers (src/lib/nums/m05.ts) against the reference table in MASTER_PROMPT §6
 * (docs/reference/gk_reference.py), and the quiz file's numeric options.
 */
import { describe, expect, it } from 'vitest';
import { MINUS, NBSP } from '@/lib/format';
import { NUMS, formatNum, getNum } from '@/lib/nums';
import { M05 } from '@/lib/nums/m05';
import { quiz } from '@/content/quiz/05-greeks';

describe('m05 numbers', () => {
  it('match the reference values', () => {
    expect(M05.delta).toBeCloseTo(0.5039, 4);
    expect(M05.deltaUp).toBeCloseTo(0.6244, 4);
    expect(M05.gamma).toBeCloseTo(12.3556, 3);
    expect(M05.gammaNumeric).toBeCloseTo(M05.gamma, 3);
    expect(M05.deltaChangeApprox).toBeCloseTo(0.124, 3);
    expect(M05.vegaPointChf).toBeCloseTo(1582, 0);
    expect(M05.thetaOneDayChf).toBeCloseTo(-30.82, 2);
    expect(M05.thetaGammaDayChf).toBeCloseTo(-69.33, 2);
    // analytic theta per day = gamma share + carry
    expect(M05.thetaGammaDayChf + M05.thetaCarryDayChf).toBeCloseTo(-30.67, 2);
    expect(M05.rhoDomesticChf).toBeCloseTo(976, 0);
    expect(M05.rhoForeignChf).toBeCloseTo(-1008, 0);
    expect(M05.breakEvenPips).toBeCloseTo(33.5, 2);
    expect(M05.callChf).toBeCloseTo(12669, 0);
  });

  it('are registered under the m05 namespace and format the Swiss way', () => {
    expect(Object.keys(NUMS).filter((k) => k.startsWith('m05.')).length).toBeGreaterThan(15);
    expect(formatNum(getNum('m05.gamma'), 'de')).toBe('12.36');
    expect(formatNum(getNum('m05.delta'), 'de')).toBe('0.504');
    expect(formatNum(getNum('m05.deltaChangeApprox'), 'de')).toBe('+0.124');
    expect(formatNum(getNum('m05.breakEvenPips'), 'de')).toBe('33.5');
    expect(formatNum(getNum('m05.thetaGammaDay'), 'de')).toBe(`CHF${NBSP}${MINUS}69`);
    expect(formatNum(getNum('m05.thetaDay'), 'de')).toBe(`CHF${NBSP}${MINUS}31`);
    expect(formatNum(getNum('m05.vegaPoint'), 'de')).toBe(`CHF${NBSP}1’582`);
    expect(formatNum(getNum('m05.vegaPoint'), 'en')).toBe(`CHF${NBSP}1,582`);
  });
});

describe('05-greeks quiz content', () => {
  it('has four graded questions and a check per section, each with a valid correct index', () => {
    expect(quiz.slug).toBe('05-greeks');
    expect(quiz.quiz).toHaveLength(4);
    const all = [...quiz.quiz, ...Object.values(quiz.checks)];
    expect(Object.keys(quiz.checks).sort()).toEqual(['1', '2', '3', '4']);
    for (const q of all) {
      expect(q.options.length).toBeGreaterThanOrEqual(3);
      expect(q.options.length).toBeLessThanOrEqual(4);
      expect(q.correct).toBeGreaterThanOrEqual(0);
      expect(q.correct).toBeLessThan(q.options.length);
      for (const o of q.options) {
        expect(o.label.de.trim()).not.toBe('');
        expect(o.label.en.trim()).not.toBe('');
        expect(o.explain.de.trim()).not.toBe('');
        expect(o.explain.en.trim()).not.toBe('');
      }
    }
    const ids = all.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('builds the big-figure check from the core (prototype question)', () => {
    const c = quiz.checks['2'];
    expect(c.options.map((o) => o.label.de)).toEqual(['+0.012', '+0.124', '+1.236']);
    expect(c.options[c.correct]!.label.de).toBe('+0.124');
    expect(c.options[c.correct]!.explain.de).toContain('12.36');
  });
});
