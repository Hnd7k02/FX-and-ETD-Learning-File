/** Module 06 quiz and numbers: shape, both languages, numbers from the core, sums that add up. */
import { describe, expect, it } from 'vitest';
import { quiz } from '@/content/quiz/06-combos-smile';
import { fmtMoney, fmtPct, fmtPips } from '@/lib/format';
import { EXAMPLE as E } from '@/lib/fx/example';
import { M06, M06_SOLVED_DIGITS, nums } from '@/lib/nums/m06';
import { formatNum } from '@/lib/nums/format';

const all = [...quiz.quiz, ...Object.values(quiz.checks)];

describe('m06 quiz', () => {
  it('has four graded questions and four checks', () => {
    expect(quiz.slug).toBe('06-combos-smile');
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
      expect(new Set(q.options.map((o) => o.label[lang])).size).toBe(q.options.length);
    }
    expect(q.options[q.correct]!.explain.de).toMatch(/^Richtig/);
    expect(q.options[q.correct]!.explain.en).toMatch(/^Correct/);
  });

  it('does not always put the right answer first', () => {
    expect(new Set(all.map((q) => q.correct)).size).toBeGreaterThan(1);
  });

  it('takes its numbers from the core', () => {
    const q4 = quiz.quiz[3];
    expect(q4.options[q4.correct]!.label.de).toBe(fmtPct(M06.vol25P, 'de', 2));
    const q2 = quiz.quiz[1];
    expect(q2.options[q2.correct]!.label.en).toBe(fmtMoney(M06.rrPutK * E.notional, 'CHF', 'en'));
    const c2 = quiz.checks['2'];
    expect(c2.options[c2.correct]!.label.de).toBe(fmtMoney(M06.csMaxGain, 'CHF', 'de'));
  });
});

describe('m06 numbers', () => {
  it('are finite', () => {
    for (const [k, d] of Object.entries(nums)) expect(Number.isFinite(d.value), k).toBe(true);
  });

  it('displayed parts add up (call spread, max gain)', () => {
    const d = (k: string) => Number(formatNum(nums[k]!, 'en').replace(/,/g, ''));
    expect(d('m06.shCallPips') - d('m06.shSpreadSavePips')).toBeCloseTo(d('m06.shSpreadPips'), 6);
    expect(Number(fmtPips(M06.csCallPips, 'en'))).toBeCloseTo(
      d('m06.csSoldPips') + d('m06.csPips'),
      6,
    );
    expect(d('m06.csWidthPips') - d('m06.csPips')).toBeCloseTo(d('m06.csMaxGainPips'), 6);
  });

  it('displayed smile price differences are the differences of the displayed prices', () => {
    const d = (k: string) =>
      Number(formatNum(nums[k]!, 'en').replace(/[+,]/g, '').replace('−', '-'));
    expect(d('m06.put25SmilePips') - d('m06.put25FlatPips')).toBeCloseTo(d('m06.put25DiffPips'), 6);
    expect(d('m06.call25SmilePips') - d('m06.call25FlatPips')).toBeCloseTo(
      d('m06.call25DiffPips'),
      6,
    );
  });

  it('supports the claims in the text', () => {
    const v = (k: string) => nums[k]!.value;
    // section 1: every option structure lies between the forward and staying unhedged
    for (const id of ['Call', 'Spread', 'Collar', 'Seagull']) {
      expect(v(`m06.up${id}Chf`)).toBeGreaterThan(v('m06.fwdChf'));
      expect(v(`m06.up${id}Chf`)).toBeLessThan(v('m06.upUnhedgedChf'));
      expect(v(`m06.down${id}Chf`)).toBeLessThan(v('m06.fwdChf'));
      expect(v(`m06.down${id}Chf`)).toBeGreaterThan(v('m06.downUnhedgedChf'));
    }
    // ... and the collar is the cheapest option structure when the dollar is strong
    for (const id of ['Call', 'Spread', 'Seagull'])
      expect(v('m06.upCollarChf')).toBeLessThan(v(`m06.up${id}Chf`));
    // section 3: a full revaluation, not vega × shock (volga): the strangle gains more,
    // the seagull loses more than vega alone says
    const pts = v('m06.shockPts');
    expect(v('m06.strShockChf')).toBeGreaterThan(pts * v('m06.strVegaChf'));
    expect(v('m06.sgShockChf')).toBeLessThan(pts * v('m06.sgVegaChf'));
    // the straddle approximation √(2/π)·σ√T·F matches the exact value at K = F to 0.1 pip
    expect(Math.abs(v('m06.straddleApproxPips') - v('m06.straddleAtFPips'))).toBeLessThan(0.1);
    // the break-even move ≈ the expected absolute move √(2/π)·σ√T
    expect(Math.abs(v('m06.straddleMovePct') - v('m06.expMovePct'))).toBeLessThan(5e-4);
    // the straddle at the DNS strike loses if USD/CHF is still at the spot at expiry
    expect(v('m06.straddleBeHi')).toBeGreaterThan(E.spot);
  });

  it('separates the 25Δ risk reversal from the zero-cost collar (flat vol)', () => {
    const v = (k: string) => nums[k]!.value;
    // 25Δ risk reversal: both strikes fixed by the delta convention, net premium not zero
    expect(M06.rrCallK).toBeCloseTo(0.815, 12);
    expect(M06.rrCallPips).toBeCloseTo(47.27, 2);
    expect(v('m06.rr25PutK')).toBeCloseTo(0.773, 12);
    expect(M06.rr25PutPips).toBeCloseTo(49.5, 2);
    // net premium call − put, unrounded and signed (< 0: the importer receives); details in
    // tests/unit/m06-rr.test.ts
    expect(v('m06.rr25NetPips')).toBeCloseTo(-2.2362, 4);
    expect(v('m06.rr25NetPips')).toBeCloseTo(M06.rrCallPips - M06.rr25PutPips, 9);
    expect(v('m06.rr25NetChf')).toBeCloseTo(-223.62, 2);
    // zero-cost collar: call kept, put solved lower
    expect(M06.rrPutK).toBeCloseTo(0.77215, 5);
    expect(formatNum(nums['m06.rrPutK']!, 'de')).toBe('0.7722');
    expect(v('m06.rrPutGapPips')).toBeCloseTo(8.494, 3);
    expect(formatNum(nums['m06.rrPutGapPips']!, 'de')).toBe('8.49');
    // the gap adds up with the strikes as the text shows them (25Δ put 4, solved put 6 digits)
    const k6 = Number(formatNum(nums['m06.rrPutK']!, 'en', { digits: M06_SOLVED_DIGITS }));
    expect((v('m06.rr25PutK') - k6) / 1e-4).toBeCloseTo(
      Number(formatNum(nums['m06.rrPutGapPips']!, 'en')),
      6,
    );
  });

  it('matches the reference structure of the example', () => {
    // zero-cost puts: seagull below collar; smile helps the importer's collar
    expect(M06.shSeagull.putStrike!).toBeLessThan(M06.shCollar.putStrike!);
    expect(M06.rrPutSmile).toBeLessThan(M06.rrPutK);
    // vol views: straddle long vega, butterfly and seagull short vega
    expect(M06.straddleVega).toBeGreaterThan(0);
    expect(M06.straddleShock).toBeGreaterThan(0);
    expect(M06.flyVega).toBeLessThan(0);
    expect(M06.seagullVega).toBeLessThan(0);
    expect(M06.seagullShock).toBeLessThan(0);
    // smile wings
    expect(M06.vol25C).toBeCloseTo(M06.atm + M06.bf25 + M06.rr25 / 2, 14);
    expect(M06.vol25P).toBeCloseTo(M06.atm + M06.bf25 - M06.rr25 / 2, 14);
  });
});
