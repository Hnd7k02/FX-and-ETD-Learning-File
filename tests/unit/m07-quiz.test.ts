/** Module 07 quiz: shape, both languages, numbers from the core, varied answer positions. */
import { describe, expect, it } from 'vitest';
import { quiz } from '@/content/quiz/07-barrier-binary';
import { fmtNumber } from '@/lib/format';
import { PIP } from '@/lib/m07/config';
import { M07 } from '@/lib/nums/m07';

const all = [...quiz.quiz, ...Object.values(quiz.checks)];

describe('m07 quiz', () => {
  it('has four graded questions and four checks', () => {
    expect(quiz.slug).toBe('07-barrier-binary');
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
        expect(s).not.toMatch(/NaN|undefined|\{\w+\}/);
      }
    }
    expect(q.options[q.correct]!.explain.de).toMatch(/^Richtig/);
    expect(q.options[q.correct]!.explain.en).toMatch(/^Correct/);
  });

  it('does not always put the right answer first', () => {
    expect(new Set(all.map((q) => q.correct)).size).toBeGreaterThan(1);
  });

  it('takes its numbers from the core', () => {
    const c2 = quiz.checks['2'];
    expect(c2.options[c2.correct]!.label.de).toBe(fmtNumber(M07.uic / PIP, 'de', { digits: 1 }));
  });
});
