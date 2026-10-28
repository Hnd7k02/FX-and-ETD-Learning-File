import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EXAMPLE as E, EXAMPLE_FORWARD as F } from '@/lib/fx/example';
import { nums as m04nums } from '@/lib/nums/m04';
import { formatNum } from '@/lib/nums';
import { NBSP, fmtPct } from '@/lib/format';
import { premiumSplit, strikeMarkers, type OptionMarket } from '@/lib/moneyness';
import { m04 as m04dict } from '@/i18n/dict/m04';
import { GLOSSARY } from '@/content/glossary';

const v = (k: string) => m04nums[k]!.value;
const de = (k: string) => formatNum(m04nums[k]!, 'de');
const en = (k: string) => formatNum(m04nums[k]!, 'en');

describe('module 04.3: delta is not a probability (supplement point 12)', () => {
  // Check values at the exact delta strikes 0.815145 / 0.772752 (25Δ) and the 10Δ strikes.
  const rows = [
    {
      strike: 'm04.call25',
      K: 0.815145,
      delta: 'm04.call25Delta',
      d: 0.25,
      prob: 'm04.call25Prob',
      p: 0.2396,
      pDe: '23.96',
      dDe: '0.25',
    },
    {
      strike: 'm04.put25',
      K: 0.772752,
      delta: 'm04.put25Delta',
      d: -0.25,
      prob: 'm04.put25Prob',
      p: 0.2651,
      pDe: '26.51',
      dDe: '−0.25',
    },
    {
      strike: 'm04.call10',
      K: 0.835244,
      delta: 'm04.call10Delta',
      d: 0.1,
      prob: 'm04.call10Prob',
      p: 0.094,
      pDe: '9.40',
      dDe: '0.10',
    },
    {
      strike: 'm04.put10',
      K: 0.754156,
      delta: 'm04.put10Delta',
      d: -0.1,
      prob: 'm04.put10Prob',
      p: 0.1081,
      pDe: '10.81',
      dDe: '−0.10',
    },
  ] as const;

  it.each(rows)('$strike: delta $d and chance $p are two separate values', (r) => {
    expect(v(r.strike)).toBeCloseTo(r.K, 6);
    // delta, unrounded and as shown
    expect(v(r.delta)).toBeCloseTo(r.d, 12);
    expect(de(r.delta)).toBe(r.dDe);
    expect(en(r.delta)).toBe(r.dDe);
    // risk-neutral chance in the money, unrounded and as shown
    expect(v(r.prob)).toBeCloseTo(r.p, 4);
    expect(de(r.prob)).toBe(`${r.pDe}${NBSP}%`);
    expect(en(r.prob)).toBe(`${r.pDe}%`);
    // not the same number
    expect(Math.abs(v(r.prob) - Math.abs(v(r.delta)))).toBeGreaterThan(0.005);
  });

  it('N(d1) at the 25Δ strikes is 0.25 · e^(rf T) = 0.2522', () => {
    expect(v('m04.nd1At25')).toBeCloseTo(0.25 * Math.exp(E.rf * E.T), 12);
    expect(v('m04.nd1At25')).toBeCloseTo(0.2522, 4);
    expect(de('m04.nd1At25')).toBe('0.2522');
    expect(en('m04.nd1At25')).toBe('0.2522');
    // the call chance lies below, the put chance above N(d1) = N(−d1)
    expect(v('m04.call25Prob')).toBeLessThan(v('m04.nd1At25'));
    expect(v('m04.put25Prob')).toBeGreaterThan(v('m04.nd1At25'));
  });
});

describe('module 04.3: the negative time value against spot comes from the split (point 19)', () => {
  it('gap between the two intrinsic values = S − F (DF = 1), 69.7 pips', () => {
    expect(v('m04.itmSpotGapPips')).toBeCloseTo((E.spot - F) / 1e-4, 9);
    expect(v('m04.itmSpotGapPips')).toBeCloseTo(69.69, 2);
    expect(de('m04.itmSpotGapPips')).toBe('69.7');
    expect(en('m04.itmSpotGapPips')).toBe('69.7');
  });

  it('adds up as shown: 270.0 − 200.3 = 69.7 and 49.5 − 69.7 = −20.2', () => {
    const shown = (k: string) => Number(v(k).toFixed(1));
    expect(shown('m04.itmSpotIntrinsicPips') - shown('m04.itmIntrinsicPips')).toBeCloseTo(
      shown('m04.itmSpotGapPips'),
      9,
    );
    expect(shown('m04.itmTimePips') - shown('m04.itmSpotGapPips')).toBeCloseTo(
      shown('m04.itmSpotTimePips'),
      9,
    );
    // the premium itself stays positive: no negative premium
    expect(v('m04.itmPips')).toBeGreaterThan(0);
    expect(v('m04.itmTimePips')).toBeGreaterThan(0);
    expect(v('m04.itmSpotTimePips')).toBeLessThan(0);
  });
});

describe('moneyness explorer: delta and chance in the money side by side', () => {
  const M: OptionMarket = { S: E.spot, T: E.T, vol: E.vol, rd: E.rd, rf: E.rf };

  it('shows N(d2) / N(−d2) next to delta at the delta markers', () => {
    const at = (id: string) => strikeMarkers(M).find((m) => m.id === id)!.K;
    const c25 = premiumSplit(at('c25'), M, 'call');
    const p25 = premiumSplit(at('p25'), M, 'put');
    expect(c25.delta).toBeCloseTo(0.25, 12);
    expect(c25.probItm).toBeCloseTo(0.2396, 4);
    expect(fmtPct(c25.probItm, 'de', 2)).toBe(formatNum(m04nums['m04.call25Prob']!, 'de'));
    expect(fmtPct(c25.probItm, 'en', 2)).toBe(formatNum(m04nums['m04.call25Prob']!, 'en'));
    expect(p25.delta).toBeCloseTo(-0.25, 12);
    expect(p25.probItm).toBeCloseTo(0.2651, 4);
    expect(fmtPct(p25.probItm, 'de', 2)).toBe(formatNum(m04nums['m04.put25Prob']!, 'de'));
    // call + put chance = 1 at any strike
    const k = 0.79;
    expect(premiumSplit(k, M, 'call').probItm + premiumSplit(k, M, 'put').probItm).toBeCloseTo(
      1,
      14,
    );
  });
});

describe('no text treats delta as a probability (supplement point 12)', () => {
  const walk = (d: string): string[] =>
    readdirSync(d).flatMap((f) => {
      const p = join(d, f);
      return statSync(p).isDirectory() ? walk(p) : [p];
    });
  const files = [
    ...walk('src/content/modules'),
    ...walk('src/content/quiz'),
    ...walk('src/i18n/dict'),
    'src/content/glossary.ts',
  ];
  const WRONG = [
    /Grob ist es auch die Chance/,
    /Roughly, it is also the chance/,
    /einem von vier Fällen/,
    /one-in-four/,
    /Delta (ist|is)( also| auch| grob| etwa| ungefähr| roughly| about)* (die|the) (Chance|chance|Wahrscheinlichkeit|probability)/i,
  ];

  it.each(files)('%s has no "delta = chance" statement', (f) => {
    const src = readFileSync(f, 'utf8');
    for (const re of WRONG) expect(re.test(src), `${re}`).toBe(false);
    // "Delta ≈ chance" only as a rule of thumb, in the same block
    for (const block of src.split(/\n[ \t]*\n/)) {
      if (/Delta ≈ (Chance|the chance|chance)/i.test(block)) {
        expect(/Faustregel|rule of thumb/i.test(block), block.slice(0, 120)).toBe(true);
      }
    }
  });

  it('04.3 shows delta and the chance in the money as two columns, DE and EN', () => {
    for (const lang of ['de', 'en']) {
      const src = readFileSync(`src/content/modules/04-vanilla-options/${lang}/3.mdx`, 'utf8');
      expect(src).toContain(lang === 'de' ? 'keine Wahrscheinlichkeit' : 'not a probability');
      for (const k of ['call25', 'put25', 'call10', 'put10']) {
        expect(src).toContain(`of="m04.${k}Delta"`);
        expect(src).toContain(`of="m04.${k}Prob"`);
      }
    }
  });
});

describe('delta vs chance: wording stays precise (review of point 12)', () => {
  const mdx = (lang: 'de' | 'en') =>
    readFileSync(`src/content/modules/04-vanilla-options/${lang}/3.mdx`, 'utf8');

  it('the 25Δ notes quote the wings right after the delta, then the chance', () => {
    const quote = {
      de: 'So quotiert der Markt die Flügel.',
      en: 'This is how the market quotes the wings.',
    };
    const notProb = { de: 'keine Wahrscheinlichkeit', en: 'not a probability' };
    for (const lang of ['de', 'en'] as const) {
      for (const [key, ph] of [
        ['mx.aha.p25', '{p}'],
        ['mx.aha.c25', '{c}'],
      ] as const) {
        const s = m04dict[lang][key];
        // the quoting sentence follows the delta sentence directly
        expect(s, `${lang} ${key}`).toContain(`${ph}. ${quote[lang]}`);
        // and comes before the probability part
        expect(s.indexOf(quote[lang])).toBeLessThan(s.indexOf(notProb[lang]));
        expect(s.indexOf(quote[lang])).toBeLessThan(s.indexOf('{prob}'));
      }
    }
  });

  it('N(d2) is the chance in the model (Garman-Kohlhagen, flat vol), DE and EN', () => {
    expect(mdx('de')).toContain('im Modell dieses Tools ([Garman-Kohlhagen]');
    expect(mdx('de')).toContain('flache Vola) beim Call N(<i>d</i><sub>2</sub>)');
    expect(mdx('en')).toContain("in this tool's model ([Garman-Kohlhagen]");
    expect(mdx('en')).toContain('flat vol), N(<i>d</i><sub>2</sub>) for a call');
    const def = GLOSSARY.find((e) => e.id === 'prob-itm')!.def;
    expect(def.de).toContain('im Garman-Kohlhagen-Modell');
    expect(def.en).toContain('in the Garman-Kohlhagen model');
    for (const id of ['delta', 'delta-25']) {
      const d = GLOSSARY.find((e) => e.id === id)!.def;
      expect(d.de, id).toMatch(/im Modell N\(d2\)/);
      expect(d.en, id).toMatch(/in the model, N\(d2\)/);
    }
  });

  it('the put chance is compared with the size of the delta, not with a negative number', () => {
    expect(mdx('de')).toContain('beim Put etwas grösser als der Betrag des Deltas');
    expect(mdx('en')).toContain('for the put a little larger than the size of the delta');
    // the comparison the text makes holds at both delta levels
    for (const lvl of ['25', '10']) {
      expect(v(`m04.call${lvl}Prob`)).toBeLessThan(v(`m04.call${lvl}Delta`));
      expect(v(`m04.put${lvl}Prob`)).toBeGreaterThan(Math.abs(v(`m04.put${lvl}Delta`)));
    }
  });

  it('the link to module 07 keeps the discounting: price of a digital paying 1 franc', () => {
    expect(mdx('de')).toContain(
      'abgezinst ist es der Preis eines Digital Calls, der 1 Franken zahlt',
    );
    expect(mdx('en')).toContain('discounted, it is the price of a digital call that pays 1 franc');
    expect(mdx('de')).not.toContain('wieder, als Preis eines Digital Calls');
    expect(mdx('en')).not.toContain('as the price of a digital call');
  });
});
