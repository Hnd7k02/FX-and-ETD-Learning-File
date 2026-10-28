/** Module 03 quiz: shape, both languages, numbers from the core, varied answer positions. */
import { describe, expect, it } from 'vitest';
import { quiz } from '@/content/quiz/03-fx-swap';
import { fmtMoney, fmtPips, fmtRate } from '@/lib/format';
import { M03 } from '@/lib/nums/m03';

const all = [...quiz.quiz, ...Object.values(quiz.checks)];

describe('m03 quiz', () => {
  it('has four graded questions and four checks', () => {
    expect(quiz.slug).toBe('03-fx-swap');
    expect(quiz.quiz).toHaveLength(4);
    expect(Object.keys(quiz.checks).sort()).toEqual(['1', '2', '3', '4']);
    expect(new Set(all.map((q) => q.id)).size).toBe(all.length);
  });

  it.each(all.map((q) => [q.id, q] as const))('%s is complete in DE and EN', (_id, q) => {
    expect(q.options.length).toBeGreaterThanOrEqual(3);
    expect(q.options.length).toBeLessThanOrEqual(4);
    expect(q.correct).toBeGreaterThanOrEqual(0);
    expect(q.correct).toBeLessThan(q.options.length);
    for (const lang of ['de', 'en'] as const) {
      const texts = [q.prompt[lang], ...q.options.flatMap((o) => [o.label[lang], o.explain[lang]])];
      for (const s of texts) {
        expect(s.trim()).not.toBe('');
        expect(s).not.toMatch(/NaN|undefined|Infinity|\{\w+\}/);
      }
    }
    expect(q.options[q.correct]!.explain.de).toMatch(/^Richtig/);
    expect(q.options[q.correct]!.explain.en).toMatch(/^Correct/);
    const labels = q.options.map((o) => o.label.de);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('does not always put the right answer first', () => {
    expect(new Set(all.map((q) => q.correct)).size).toBeGreaterThan(2);
  });

  it('takes its numbers from the core', () => {
    const [q1, , q3] = quiz.quiz;
    expect(q1.options[q1.correct]!.label.de).toBe(fmtPips(M03.legs.points, 'de', 1, true));
    expect(q3.options[q3.correct]!.label.de).toBe(fmtRate(M03.up.allIn, 'USD/CHF', 5));
    const c3 = quiz.checks['3'];
    expect(c3.options[c3.correct]!.label.de).toContain(fmtMoney(-M03.down.settlement, 'CHF', 'de'));
  });
});
