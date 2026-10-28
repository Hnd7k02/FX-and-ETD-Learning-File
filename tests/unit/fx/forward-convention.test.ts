/**
 * Forward conventions (02.2): the gap between the continuous and the money-market forward comes
 * from using the same rate once as simple interest (90/360) and once as continuous interest
 * (90/365 for the same end date, or the stylised T = 0.25). It is no arbitrage gain: with
 * term-matched continuous rates, r = ln(1 + r_MM · 90/360) / (90/365), the continuous formula
 * gives the money-market forward for the same end date (tolerance 1e-12).
 */
import { describe, expect, it } from 'vitest';
import { basisOf } from '@/lib/fx/daycount';
import { EXAMPLE as E } from '@/lib/fx/example';
import { continuousFromSimple, forwardContinuous, forwardMoneyMarket } from '@/lib/fx/forward';
import { formatNum } from '@/lib/nums/format';
import { M02, nums } from '@/lib/nums/m02';
import { quiz } from '@/content/quiz/02-forward';
import { about } from '@/i18n/dict/about';
import { paritypaths } from '@/i18n/dict/paritypaths';
import { fmtRate } from '@/lib/format';
import { M02_CONFIG } from '@/lib/m02/config';

const PIP = 1e-4;
const DAYS = E.mmDays;
const T_MM = DAYS / 360;
const T_365 = DAYS / 365;

describe('term-matched continuous rates', () => {
  it('converting the 90-day money-market rates gives the same forward for the same end date', () => {
    const rdCont = continuousFromSimple(E.rd, T_MM, T_365);
    const rfCont = continuousFromSimple(E.rf, T_MM, T_365);
    // the formula of the text, written out
    expect(rfCont).toBe(Math.log(1 + E.rf * (DAYS / 360)) / (DAYS / 365));
    expect(rdCont).toBe(Math.log(1 + E.rd * (DAYS / 360)) / (DAYS / 365));
    const mm = forwardMoneyMarket(E.spot, E.rd, E.rf, DAYS);
    const cont = forwardContinuous(E.spot, rdCont, rfCont, T_365);
    expect(Math.abs(cont - mm)).toBeLessThan(1e-12);
  });

  it('holds for other rates, terms and day counts', () => {
    for (const days of [1, 7, 30, 61, 90, 182, 365, 730]) {
      for (const [rd, rf] of [
        [0, 0.035],
        [0.015, 0.04],
        [0.05, 0.01],
        [-0.0075, 0.0525],
        [0.02, 0.02],
      ] as const) {
        for (const [quote, base] of [
          ['CHF', 'USD'],
          ['JPY', 'USD'],
          ['CHF', 'GBP'],
        ] as const) {
          const bq = basisOf(quote);
          const bb = basisOf(base);
          const T = days / 365;
          const mm = forwardMoneyMarket(E.spot, rd, rf, days, bq, bb);
          const cont = forwardContinuous(
            E.spot,
            continuousFromSimple(rd, days / bq, T),
            continuousFromSimple(rf, days / bb, T),
            T,
          );
          expect(Math.abs(cont - mm), `${days}d ${rd}/${rf} ${quote}/${base}`).toBeLessThan(1e-12);
        }
      }
    }
  });

  it('the continuous interest factor equals the simple one', () => {
    for (const r of [-0.0075, 0, 0.01, 0.035, 0.08]) {
      const rc = continuousFromSimple(r, T_MM, T_365);
      expect(Math.exp(rc * T_365)).toBeCloseTo(1 + r * T_MM, 14);
    }
    expect(continuousFromSimple(0, T_MM, T_365)).toBe(0);
  });

  it('without the conversion the same rate gives +0.65 pips at the same end date', () => {
    const gap = (forwardContinuous(E.spot, E.rd, E.rf, T_365) - M02.F) / PIP;
    expect(gap).toBeCloseTo(0.6488, 4);
    expect(gap).toBeCloseTo(nums['m02.fwdCont90DiffPips']!.value, 12);
    // simple over 90/360 grows the dollar more than continuous over 90/365
    expect(1 + E.rf * T_MM).toBeGreaterThan(Math.exp(E.rf * T_365));
  });

  it('the plus sign comes from the larger money-market year fraction, not from compounding', () => {
    // 02.2: the money market counts the larger year fraction (90/360 > 90/365); that matters more
    // than continuous compounding, which on its own would grow the dollar more (forward lower)
    expect(T_MM).toBeGreaterThan(T_365);
    const simpleMM = 1 + E.rf * T_MM;
    const simple365 = 1 + E.rf * T_365;
    const cont365 = Math.exp(E.rf * T_365);
    const yearFractionEffect = simpleMM - simple365;
    const compoundingEffect = cont365 - simple365;
    expect(compoundingEffect).toBeGreaterThan(0);
    expect(yearFractionEffect).toBeGreaterThan(compoundingEffect);
    // at the same year fraction, compounding alone gives the opposite sign
    expect((forwardContinuous(E.spot, E.rd, E.rf, T_MM) - M02.F) / PIP).toBeLessThan(0);
  });

  it('at the stylised T = 0.25 in both worlds the same conversion closes the −0.3 pips', () => {
    expect((M02.fCont - M02.F) / PIP).toBeCloseTo(-0.3018, 4);
    const rf = continuousFromSimple(E.rf, T_MM, E.T);
    const rd = continuousFromSimple(E.rd, T_MM, E.T);
    expect(Math.abs(forwardContinuous(E.spot, rd, rf, E.T) - M02.F)).toBeLessThan(1e-12);
    expect(nums['m02.rfCont']!.value).toBe(rf);
  });
});

describe('m02 numbers of the conversion', () => {
  it('m02.rfCont90: term-matched continuous USD rate 3.533 %', () => {
    const d = nums['m02.rfCont90']!;
    expect(d.value).toBeCloseTo(0.0353317591, 10);
    expect(d.value).toBe(M02.rfCont90);
    expect(formatNum(d, 'de')).toBe('3.533 %');
    expect(formatNum(d, 'en')).toBe('3.533%');
  });

  it('m02.fwdCont90Conv: the continuous forward with converted rates is the money-market forward', () => {
    const d = nums['m02.fwdCont90Conv']!;
    expect(d.value).toBeCloseTo(0.7930607187, 10);
    expect(Math.abs(d.value - nums['m02.fwd']!.value)).toBeLessThan(1e-12);
    expect(M02.rdCont90).toBe(0);
    expect(formatNum(d, 'de')).toBe('0.79306');
    expect(formatNum(d, 'en')).toBe('0.79306');
    // shown with 6 digits in 02.2, next to the money-market forward
    expect(formatNum(d, 'de', { digits: 6 })).toBe('0.793061');
    expect(formatNum(d, 'en', { digits: 6 })).toBe(
      formatNum(nums['m02.fwd']!, 'en', { digits: 6 }),
    );
  });

  it('m02.rfCont (same T = 0.25) keeps its value and display', () => {
    const d = nums['m02.rfCont']!;
    expect(d.value).toBeCloseTo(0.0348477624, 10);
    expect(formatNum(d, 'de')).toBe('3.485 %');
    expect(formatNum(d, 'en')).toBe('3.485%');
  });
});

describe('the gap is named as convention, not as a price or an arbitrage gain', () => {
  it('quiz m02-q2: the continuous distractor explains the missing conversion', () => {
    const q = quiz.quiz.find((x) => x.id === 'm02-q2')!;
    const label = fmtRate(M02.fCont, E.pair, M02_CONFIG.forwardDigits);
    const opt = q.options.find((o) => o.label.de === label)!;
    expect(opt).toBeDefined();
    expect(q.options.indexOf(opt)).not.toBe(q.correct);
    expect(opt.explain.de).toContain('unverändert als stetigen Zins');
    expect(opt.explain.de).toContain('kein Arbitragegewinn');
    expect(opt.explain.de).not.toContain('kein anderer Preis');
    expect(opt.explain.en).toContain('needs the converted rate');
    expect(opt.explain.en).toContain('not an arbitrage gain');
    expect(opt.explain.en).not.toContain('not a different price');
  });

  it('ParityPaths labels the continuous difference in both languages', () => {
    expect(paritypaths.de['pp.cont.diffSub']).toBe('Konvention, kein Arbitragegewinn');
    expect(paritypaths.en['pp.cont.diffSub']).toBe('convention, not an arbitrage gain');
  });

  it('About: the gap holds at the same T and closes with converted rates', () => {
    expect(about.de['about.models.fwd.p']).toContain('bei gleichem T {diff} Pips');
    expect(about.de['about.models.fwd.p']).toContain('kein Arbitragegewinn');
    expect(about.en['about.models.fwd.p']).toContain('{diff} pips at the same T');
    expect(about.en['about.models.fwd.p']).toContain('not an arbitrage gain');
  });
});
