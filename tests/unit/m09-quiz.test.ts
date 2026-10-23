import { describe, expect, it } from 'vitest';
import { quiz } from '@/content/quiz/09-hedge-alpha-yield';
import { M09 } from '@/lib/nums/m09';
import { fmtRate } from '@/lib/format';

const all = [...quiz.quiz, ...Object.values(quiz.checks)];

describe('module 09 quiz', () => {
  it('has four graded questions and one check per section', () => {
    expect(quiz.slug).toBe('09-hedge-alpha-yield');
    expect(quiz.quiz).toHaveLength(4);
    expect(Object.keys(quiz.checks).sort()).toEqual(['1', '2', '3', '4']);
  });

  it('has 3–4 options with explanations in both languages and a valid answer', () => {
    const ids = new Set<string>();
    for (const q of all) {
      expect(ids.has(q.id)).toBe(false);
      ids.add(q.id);
      expect(q.options.length).toBeGreaterThanOrEqual(3);
      expect(q.options.length).toBeLessThanOrEqual(4);
      expect(q.correct).toBeGreaterThanOrEqual(0);
      expect(q.correct).toBeLessThan(q.options.length);
      for (const l of ['de', 'en'] as const) {
        expect(q.prompt[l]).not.toMatch(/\{|\}|undefined|NaN/);
        for (const o of q.options) {
          expect(o.label[l].length).toBeGreaterThan(0);
          expect(o.explain[l].length).toBeGreaterThan(10);
          expect(o.label[l] + o.explain[l]).not.toMatch(/undefined|NaN/);
        }
      }
    }
  });

  it('does not always put the right answer first', () => {
    expect(new Set(all.map((q) => q.correct)).size).toBeGreaterThan(1);
  });

  it('uses numbers from the registry', () => {
    const c2 = quiz.checks['2'];
    expect(c2.options[c2.correct]!.label.de).toContain(fmtRate(M09.levWorse));
    const c4 = quiz.checks['4'];
    expect(c4.options[c4.correct]!.label.en).toContain(fmtRate(M09.carryForward, 'USD/CHF', 5));
  });

  it('q1: the whole pips shown in the explanation add up', () => {
    const fwdLoss = Math.round(Math.abs(M09.s1FwdDownPips));
    const premium = Math.round(M09.callPremiumPips);
    const q1 = quiz.quiz[0]!;
    const right = q1.options[q1.correct]!;
    expect(right.label.de).toContain(`${fwdLoss - premium} Pips besser`);
    expect(right.explain.de).toContain(`${fwdLoss} Pips`);
    expect(right.explain.de).toContain(`${premium} Pips`);
  });
});
