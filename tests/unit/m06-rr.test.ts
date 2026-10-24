/**
 * 06.2: the 25Δ risk reversal and the zero-cost collar of the importer.
 *
 * - The 25Δ strikes are spot-delta strikes without premium adjustment at the flat vol, on the
 *   5-pip grid of the payoff builder (the grid is part of the definition); the smile of 06.4
 *   places its pillars by forward delta.
 * - Leg premiums and the net premium are computed unrounded; a calculation shown in the text
 *   adds up with the displayed numbers (D-26): 47.27 − 49.50 = −2.23.
 * - The zero-cost put strike is solved unrounded and rounded only for the display: to 6
 *   decimals wherever an amount is derived from it (strike × USD 1 Mio. adds up), else to 4.
 *
 * Every number is checked twice: unrounded with a tolerance and as displayed (de and en).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { quiz } from '@/content/quiz/06-combos-smile';
import { fmtMoney } from '@/lib/format';
import { EXAMPLE as E } from '@/lib/fx/example';
import { greeks } from '@/lib/fx/greeks';
import { strikeFromDelta } from '@/lib/fx/implied';
import { smilePillars } from '@/lib/fx/smile';
import { formatNum } from '@/lib/nums/format';
import { nums as nums04 } from '@/lib/nums/m04';
import { M06, M06_SOLVED_DIGITS, MARKET, nums } from '@/lib/nums/m06';
import {
  STRIKE_STEP,
  buildTemplate,
  netPremium,
  positionValue,
  roundStrike,
  solveZeroCostStrike,
  templateStrikes,
} from '@/lib/payoff';
import type { Lang } from '@/i18n/types';

const LANGS: Lang[] = ['de', 'en'];
const v = (k: string) => nums[k]!.value;
const show = (k: string, lang: Lang, digits?: number) =>
  formatNum(nums[k]!, lang, digits === undefined ? {} : { digits });
/** A displayed number back as a JS number (typographic minus, no grouping below 1’000). */
const back = (s: string) => Number(s.replace('−', '-').replace(/[^0-9.-]/g, ''));
const C = (n: string) => `CHF ${n}`;

describe('25Δ strikes: spot delta without premium adjustment, on the 5-pip grid', () => {
  const { S, T, vol, rd, rf } = MARKET;
  const rawCall = strikeFromDelta(0.25, S, T, vol, rd, rf, 'call', 'spot');
  const rawPut = strikeFromDelta(-0.25, S, T, vol, rd, rf, 'put', 'spot');

  it('solves the unrounded strikes from the spot delta (no premium adjustment)', () => {
    expect(greeks(S, rawCall, T, vol, rd, rf, 'call').delta).toBeCloseTo(0.25, 12);
    expect(greeks(S, rawPut, T, vol, rd, rf, 'put').delta).toBeCloseTo(-0.25, 12);
    expect(rawCall).toBeCloseTo(0.8151445, 7);
    expect(rawPut).toBeCloseTo(0.7727519, 7);
  });

  it('puts them on the 5-pip grid: the grid is part of the definition', () => {
    const ks = templateStrikes(MARKET);
    expect(ks.call25).toBe(roundStrike(rawCall));
    expect(ks.put25).toBe(roundStrike(rawPut));
    expect(ks.call25).toBeCloseTo(0.815, 12);
    expect(ks.put25).toBeCloseTo(0.773, 12);
    expect(M06.rrCallK).toBe(ks.call25);
    expect(v('m06.rr25PutK')).toBe(ks.put25);
    for (const lang of LANGS) {
      expect(show('m06.rrCallK', lang)).toBe('0.8150');
      expect(show('m06.rr25PutK', lang)).toBe('0.7730');
    }
  });

  it('registers the grid: 5 pips', () => {
    expect(v('m06.strikeStepPips')).toBeCloseTo(STRIKE_STEP / 1e-4, 12);
    expect(v('m06.strikeStepPips')).toBeCloseTo(5, 12);
    for (const lang of LANGS) expect(show('m06.strikeStepPips', lang)).toBe('5');
  });

  it('differs from the forward-delta strikes the smile of 06.4 uses', () => {
    const fwdCall = strikeFromDelta(0.25, S, T, vol, rd, rf, 'call', 'forward');
    expect(Math.abs(fwdCall - rawCall)).toBeGreaterThan(1e-4);
    const pil = smilePillars(M06.forward, T, { atm: vol, rr25: 0, bf25: 0 });
    expect(pil.call25.deltaFwd).toBe(0.25);
    expect(pil.call25.K).toBeCloseTo(fwdCall, 10);
  });
});

describe('25Δ risk reversal: premiums and net premium unrounded, display adds up', () => {
  it('call 47.2659 pips, shown 47.27', () => {
    expect(v('m06.rr25CallPips')).toBeCloseTo(47.2659, 4);
    expect(v('m06.rr25CallPips')).toBeCloseTo(M06.rrCallPips, 12);
    for (const lang of LANGS) expect(show('m06.rr25CallPips', lang)).toBe('47.27');
  });

  it('put 49.5022 pips, shown 49.50', () => {
    expect(v('m06.rr25PutPips')).toBeCloseTo(49.5022, 4);
    expect(v('m06.rr25PutPips')).toBeCloseTo(M06.rr25PutPips, 12);
    for (const lang of LANGS) expect(show('m06.rr25PutPips', lang)).toBe('49.50');
  });

  it('net −2.2362 pips unrounded (call − put), CHF −223.62 on USD 1 Mio.', () => {
    const legs = buildTemplate('risk-reversal', MARKET).legs;
    const rr25 = netPremium(
      [legs[0]!, { ...legs[1]!, strike: templateStrikes(MARKET).put25 }],
      MARKET,
    );
    expect(v('m06.rr25NetPips')).toBeCloseTo(-2.2362, 4);
    expect(v('m06.rr25NetPips')).toBeCloseTo(rr25.pips, 12);
    expect(v('m06.rr25NetPips')).toBeCloseTo(v('m06.rr25CallPips') - v('m06.rr25PutPips'), 9);
    expect(v('m06.rr25NetChf')).toBeCloseTo(-223.62, 2);
    expect(v('m06.rr25NetChf')).toBeCloseTo(rr25.quote, 9);
    expect(v('m06.rr25NetChf')).toBeCloseTo(v('m06.rr25NetPips') * 1e-4 * E.notional, 9);
    expect(M06.rr25NetPips).toBe(v('m06.rr25NetPips'));
    expect(M06.rr25NetChf).toBe(v('m06.rr25NetChf'));
    for (const lang of LANGS) {
      expect(show('m06.rr25NetPips', lang)).toBe('−2.2362');
      expect(show('m06.rr25NetChf', lang)).toBe(C('−223.62'));
    }
  });

  it('the shown calculation adds up: 47.27 − 49.50 = −2.23', () => {
    expect(v('m06.rr25NetShownPips')).toBeCloseTo(47.27 - 49.5, 9);
    for (const lang of LANGS) {
      expect(show('m06.rr25NetShownPips', lang)).toBe('−2.23');
      const call = back(show('m06.rr25CallPips', lang));
      const put = back(show('m06.rr25PutPips', lang));
      expect(back(show('m06.rr25NetShownPips', lang))).toBeCloseTo(call - put, 9);
      // the unrounded net in pips and in CHF agree as shown (1 pip on USD 1 Mio. = CHF 100)
      expect(back(show('m06.rr25NetChf', lang))).toBeCloseTo(
        back(show('m06.rr25NetPips', lang)) * 1e-4 * E.notional,
        9,
      );
    }
    // the shown net differs from the unrounded one only by the rounding of the two legs
    expect(Math.abs(v('m06.rr25NetShownPips') - v('m06.rr25NetPips'))).toBeLessThan(0.01);
  });

  it('the call premium in CHF agrees with the shown pips (47.27 pips → CHF 4’727)', () => {
    expect(v('m06.rrCallChf')).toBeCloseTo(4726.59, 2);
    expect(show('m06.rrCallChf', 'de')).toBe(C('4’727'));
    expect(show('m06.rrCallChf', 'en')).toBe(C('4,727'));
    expect(back(show('m06.rrCallChf', 'en'))).toBe(
      Math.round(back(show('m06.rr25CallPips', 'en')) * 1e-4 * E.notional),
    );
  });
});

describe('zero-cost collar: the put strike is solved unrounded, rounded only for display', () => {
  it('solves 0.7721506 with a residual below 1e-6 CHF', () => {
    expect(M06.rrPutK).toBeCloseTo(0.7721506, 7);
    expect(v('m06.rrPutK')).toBe(M06.rrPutK);
    expect(Math.abs(M06.rrResidualChf)).toBeLessThan(1e-6);
    // the template, the solver and the registry hold the same unrounded strike
    const tp = buildTemplate('risk-reversal', MARKET);
    expect(tp.legs[1]!.strike).toBe(M06.rrPutK);
    expect(Math.abs(positionValue(tp.legs, MARKET))).toBeLessThan(1e-6);
    const again = solveZeroCostStrike(tp.legs, 1, MARKET)!;
    expect(again).toBeCloseTo(M06.rrPutK, 10);
    // not on the grid: rounding before solving would leave a residual of many francs
    expect(roundStrike(M06.rrPutK)).not.toBe(M06.rrPutK);
    const rounded = [tp.legs[0]!, { ...tp.legs[1]!, strike: roundStrike(M06.rrPutK) }];
    expect(Math.abs(positionValue(rounded, MARKET))).toBeGreaterThan(1);
  });

  it('shows 0.772151 where an amount is derived from it, 0.7722 otherwise; the gap adds up', () => {
    expect(M06_SOLVED_DIGITS).toBe(6);
    for (const lang of LANGS) {
      expect(show('m06.rrPutK', lang)).toBe('0.7722');
      expect(show('m06.rrPutK', lang, M06_SOLVED_DIGITS)).toBe('0.772151');
      expect(show('m06.rrPutGapPips', lang)).toBe('8.49');
      // 0.7730 − 0.772151 = 8.49 pips, as shown
      const gap =
        (back(show('m06.rr25PutK', lang)) - back(show('m06.rrPutK', lang, M06_SOLVED_DIGITS))) /
        1e-4;
      expect(gap).toBeCloseTo(back(show('m06.rrPutGapPips', lang)), 9);
    }
    expect(v('m06.rrPutGapPips')).toBeCloseTo(8.494, 3);
  });

  it('the shown strike times the notional is the shown amount (D-26)', () => {
    expect(v('m06.downRrChf')).toBeCloseTo(772150.6, 1);
    expect(v('m06.downRrChf')).toBeCloseTo(M06.rrPutK * E.notional, 6);
    expect(show('m06.downRrChf', 'de')).toBe(C('772’151'));
    expect(show('m06.downRrChf', 'en')).toBe(C('772,151'));
    const extra = (M06.rrPutK - M06.stDown) * E.notional;
    expect(extra).toBeCloseTo(12150.6, 1);
    for (const lang of LANGS) {
      const k = back(show('m06.rrPutK', lang, M06_SOLVED_DIGITS));
      const st = back(show('m06.stDown', lang));
      // 0.772151 × 1 Mio. = CHF 772’151
      expect(Math.round(k * E.notional)).toBe(back(show('m06.downRrChf', lang)));
      // (0.772151 − 0.7600) × 1 Mio. = CHF 12’151
      expect(Math.round((k - st) * E.notional)).toBe(back(fmtMoney(extra, E.quote, lang)));
      // with the 4-decimal strike it would not add up (CHF 772’200)
      expect(Math.round(back(show('m06.rrPutK', lang)) * E.notional)).not.toBe(
        back(show('m06.downRrChf', lang)),
      );
    }
    expect(fmtMoney(extra, E.quote, 'de')).toBe(C('12’151'));
    expect(fmtMoney(extra, E.quote, 'en')).toBe(C('12,151'));
  });
});

describe('06.2 text and quiz m06-q2 show the strike the amounts come from', () => {
  const mdx = (lang: Lang, n: number) =>
    readFileSync(
      join(process.cwd(), `src/content/modules/06-combos-smile/${lang}/${String(n)}.mdx`),
      'utf8',
    );

  it('06.2: every derived amount sits next to the 6-decimal strike', () => {
    for (const lang of LANGS) {
      const src = mdx(lang, 2);
      const tags = [...src.matchAll(/<Num of="m06\.rrPutK"([^/]*)\/>/g)].map((m) => m[1]!.trim());
      expect(tags.length, lang).toBeGreaterThanOrEqual(3);
      for (const extra of tags) expect(['', 'digits={6}'], lang).toContain(extra);
      const line = src.split('\n').find((l) => l.includes('m06.downRrChf'))!;
      expect(line, lang).toContain('<Num of="m06.rrPutK" digits={6} />');
      expect(line, lang).not.toContain('<Num of="m06.rrPutK" />');
    }
  });

  it('06.2: says what is rounded (premiums, strikes on the grid)', () => {
    const de = mdx('de', 2);
    const en = mdx('en', 2);
    expect(de).toContain(
      'Mit den ungerundeten Prämien gerechnet sind es <Num of="m06.rr25NetPips" />',
    );
    expect(en).toContain('Computed from the unrounded premiums it is <Num of="m06.rr25NetPips" />');
    expect(de).not.toMatch(/Ungerundet sind es/);
    expect(en).not.toMatch(/Unrounded it is/);
    expect(de).toContain(
      'Dann rundet es sie auf ein Raster von <Num of="m06.strikeStepPips" /> Pips',
    );
    expect(en).toContain('Then it rounds them to a grid of <Num of="m06.strikeStepPips" /> pips');
    for (const src of [de, en]) {
      expect(src).toContain('<Num of="m04.call25" />');
      expect(src).toContain('<Num of="m04.put25" />');
    }
  });

  it('06.4: the grid comes from the registry, with the full convention', () => {
    const de = mdx('de', 4);
    const en = mdx('en', 4);
    expect(de).toContain(
      'das Spot-Delta ohne Prämienanpassung und ein Raster von <Num of="m06.strikeStepPips" /> Pips',
    );
    expect(en).toContain(
      'the spot delta without premium adjustment and a grid of <Num of="m06.strikeStepPips" /> pips',
    );
    expect(de).not.toMatch(/Raster von 5 Pips/);
    expect(en).not.toMatch(/5-pip grid/);
  });

  it('quiz m06-q2 shows the put strike to 6 decimals, so strike × notional adds up', () => {
    const q2 = quiz.quiz.find((q) => q.id === 'm06-q2')!;
    const ok = q2.options[q2.correct]!;
    for (const lang of LANGS) {
      const k = show('m06.rrPutK', lang, M06_SOLVED_DIGITS);
      expect(q2.prompt[lang]).toContain(
        `${lang === 'de' ? 'Short USD Put' : 'short USD put'} ${k}`,
      );
      expect(q2.prompt[lang]).not.toContain(show('m06.rrPutK', lang));
      expect(ok.label[lang]).toBe(show('m06.downRrChf', lang));
      expect(Math.round(back(k) * E.notional)).toBe(back(ok.label[lang]));
      expect(ok.explain[lang]).toContain(k);
      const extra = fmtMoney((M06.rrPutK - M06.stDown) * E.notional, E.quote, lang);
      expect(ok.explain[lang]).toContain(extra);
      expect(Math.round((back(k) - M06.stDown) * E.notional)).toBe(back(extra));
    }
  });
});

describe('the grid is part of the 25Δ definition in 06.2 and 06.3', () => {
  it('without the grid the strikes are those of module 04 (0.8151 and 0.7728)', () => {
    expect(nums04['m04.call25']!.value).toBeCloseTo(0.8151445, 7);
    expect(nums04['m04.put25']!.value).toBeCloseTo(0.7727519, 7);
    expect(roundStrike(nums04['m04.call25']!.value)).toBe(M06.rrCallK);
    expect(roundStrike(nums04['m04.put25']!.value)).toBe(v('m06.rr25PutK'));
    for (const lang of LANGS) {
      expect(formatNum(nums04['m04.call25']!, lang)).toBe('0.8151');
      expect(formatNum(nums04['m04.put25']!, lang)).toBe('0.7728');
    }
  });

  it('on the grid the spot delta is close to, but not exactly, ±0.25', () => {
    const { S, T, vol, rd, rf } = MARKET;
    const dc = greeks(S, M06.rrCallK, T, vol, rd, rf, 'call').delta;
    const dp = greeks(S, v('m06.rr25PutK'), T, vol, rd, rf, 'put').delta;
    expect(dc).toBeCloseTo(0.2514, 4);
    expect(dp).toBeCloseTo(-0.2525, 4);
    expect(Math.abs(dc - 0.25)).toBeGreaterThan(1e-3);
    expect(Math.abs(dp + 0.25)).toBeGreaterThan(1e-3);
    expect(Math.abs(dc - 0.25)).toBeLessThan(5e-3);
    expect(Math.abs(dp + 0.25)).toBeLessThan(5e-3);
  });
});
