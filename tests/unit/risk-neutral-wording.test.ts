/**
 * «Risikoneutral» (supplement point 13): risk-neutral is the pricing measure (drift rd − rf,
 * expected value = forward); constant vol, a lognormal distribution and no jumps are extra
 * assumptions of the model. The glossary and the texts keep the two apart.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getGlossaryEntry } from '@/content/glossary';
import { hedgeoutcome } from '@/i18n/dict/hedgeoutcome';

const LANGS = ['de', 'en'] as const;
type Lang = (typeof LANGS)[number];

const entry = getGlossaryEntry('risk-neutral')!;
/** The two sentences of a definition (same split as tests/unit/glossary.test.ts). */
const sentences = (s: string) => s.split(/(?<=[a-zäöüß)])\.\s+(?=[A-ZÄÖÜ])/);

const MEASURE = {
  de: [
    /Bewertungsmass/,
    /rd − rf/,
    /Erwartungswert( bei Verfall)? ist der Forward/,
    /keine Prognose/,
  ],
  en: [
    /pricing measure/,
    /rd − rf/,
    /expected value( at expiry)? is the forward/,
    /not a forecast/,
  ],
} as const;
const ASSUMPTIONS = {
  de: [/Konstante Vola/, /Lognormalverteilung/, /keine Sprünge/, /Annahmen des Modells/],
  en: [/Constant volatility/, /lognormal/, /no jumps/, /assumptions of the model/],
} as const;
/** Model assumptions that must not sit in the sentence that defines the measure. */
const MODEL_WORDS = /Vola|volatility|lognormal|Sprünge|jumps|Garman/i;
/** Old wording that calls the centring on the forward a property of the model (02/1). */
const CENTRED_MODEL = /Modell ist um den Forward zentriert|model is centred on the forward/i;

function mdx(path: string, lang: Lang): string {
  return readFileSync(
    join(process.cwd(), 'src/content/modules', path.replace('{l}', lang)),
    'utf8',
  );
}

describe('risk-neutral: measure and model assumptions (point 13)', () => {
  it.each(LANGS)('the glossary defines the measure first, then the assumptions (%s)', (lang) => {
    const [measure, model] = sentences(entry.def[lang]);
    expect(model, 'two sentences').toBeDefined();
    for (const re of MEASURE[lang]) expect(measure).toMatch(re);
    expect(MODEL_WORDS.test(measure!), `measure sentence «${measure}»`).toBe(false);
    for (const re of ASSUMPTIONS[lang]) expect(model).toMatch(re);
  });

  it('replaces the C6 definition («in this tool with constant vol») and keeps the aliases', () => {
    expect(entry.def.de).not.toMatch(/Ein Bewertungsmodell|in diesem Tool mit/);
    expect(entry.def.en).not.toMatch(/A pricing model|in this tool with/);
    for (const alias of [
      'risikoneutrales Mass',
      'risikoneutrale Wahrscheinlichkeit',
      'risk-neutral measure',
      'risk-neutral probability',
    ]) {
      expect(entry.aliases, alias).toContain(alias);
    }
    expect(entry.see).toEqual(expect.arrayContaining(['garman-kohlhagen', 'volatility-smile']));
  });

  it('dates the expected value and names the measure the probabilities belong to', () => {
    // the forward for T is the expected rate at T (as in 01/1 and 04/4), not at any date
    expect(entry.def.de).toMatch(/Erwartungswert bei Verfall ist der Forward/);
    expect(entry.def.en).toMatch(/expected value at expiry is the forward/);
    // «darunter» would read as «among them»
    expect(entry.def.de).toMatch(/Wahrscheinlichkeiten unter diesem Mass/);
    expect(entry.def.de).not.toMatch(/darunter/);
    expect(entry.def.en).toMatch(/probabilities under it/);
  });

  it.each(LANGS)('01/1 separates the measure from the assumptions of the formula (%s)', (lang) => {
    const src = mdx('01-spot/{l}/1.mdx', lang);
    const para = src
      .split(/\n[ \t]*\n/)
      .find((b) => /^\*\*(Wahrscheinlichkeit|Probability)\./.test(b));
    expect(para).toBeDefined();
    expect(para).toMatch(lang === 'de' ? /Das heisst nur/ : /That only means/);
    expect(para).toMatch(
      lang === 'de' ? /zusätzliche Annahmen des Modells/ : /further assumptions of the model/,
    );
    expect(para).toMatch(/#term-risk-neutral/);
  });

  it.each(LANGS)('02/1 calls the centring risk-neutral, lognormal a model (%s)', (lang) => {
    const blocks = mdx('02-forward/{l}/1.mdx', lang).split(/\n[ \t]*\n/);
    const centred = blocks.find((b) => /m02\.scnMean/.test(b));
    expect(centred, 'paragraph with the scenario mean').toBeDefined();
    expect(centred).toMatch(
      lang === 'de'
        ? /Szenarien sind \[risikoneutral\]\(\/glossar\/#term-risk-neutral\) um den Forward zentriert/
        : /scenarios are centred on the forward, \[risk-neutrally\]\(\/en\/glossary\/#term-risk-neutral\)/,
    );
    const derivation = blocks.find((b) => /^\*\*(Die Szenarien|The scenarios)\.\*\*/.test(b));
    expect(derivation, 'derivation paragraph on the scenarios').toBeDefined();
    // the measure requires the mean at the forward; it is not the property itself
    expect(derivation).toMatch(
      lang === 'de'
        ? /Dass sie im Mittel beim Forward liegen, verlangt das \[risikoneutrale\]/
        : /That they average out at the forward is what the \[risk-neutral\]\([^)]+\) pricing measure requires/,
    );
    expect(derivation).toMatch(
      lang === 'de' ? /zusätzliche Annahme des Modells/ : /extra assumption of the model/,
    );
    expect(derivation).not.toMatch(/Das ist das \[risikoneutrale|that is the \[risk-neutral/);
  });

  it.each(LANGS)('the scenario sub-label puts the measure before the model (%s)', (lang) => {
    const sub = hedgeoutcome[lang]['ho.scn.sub'];
    const [measure, model] = sub.split(lang === 'de' ? '; Modell:' : '; model:');
    expect(model, `«${sub}»`).toBeDefined();
    expect(measure).toBe(
      lang === 'de'
        ? 'Risikoneutral um den Forward zentriert'
        : 'Risk-neutral, centred on the forward',
    );
    expect(model).toMatch(/lognormal/);
    expect(model).toContain('{vol}');
    expect(model).toMatch(lang === 'de' ? /Keine Prognose\.$/ : /Not a forecast\.$/);
    expect(CENTRED_MODEL.test(sub)).toBe(false);
  });

  it.each(LANGS)(
    '09/1 grounds E[S_T] = F in no-arbitrage (interest rate parity), not in step 3 (%s)',
    (lang) => {
      const blocks = mdx('09-hedge-alpha-yield/{l}/1.mdx', lang).split(/\n[ \t]*\n/);
      const step1 = blocks.find((b) => b.startsWith('**1.**'));
      const step3 = blocks.find((b) => b.startsWith('**3.**'));
      expect(step1).toBeDefined();
      expect(step3).toBeDefined();
      expect(step1).toMatch(
        lang === 'de'
          ? /folgt aus der Arbitragefreiheit zwischen Spot, Geldmarkt und Forward \(Zinsparität, \[Modul 02\]\(\/module\/02-forward\/2\/\)\)/
          : /follows from the absence of arbitrage between spot, money market and forward \(interest rate parity, \[module 02\]\(\/en\/module\/02-forward\/2\/\)\)/,
      );
      // the market forward carries the basis as well: no «parity alone» claim (final review)
      expect(step1).not.toMatch(/allein aus der Zinsparität|parity alone/);
      // step 3 derives the zero value of the forward from steps 1 and 2; step 1 must not use it
      expect(step1).not.toMatch(/nichts kostet|kostet heute nichts|costs nothing|costing nothing/);
      expect(step3).toMatch(lang === 'de' ? /also den Wert null/ : /so its value is zero/);
    },
  );

  it.each(LANGS)('no text calls the measure a model (%s)', (lang) => {
    const files = [
      '01-spot/{l}/1.mdx',
      '02-forward/{l}/1.mdx',
      '04-vanilla-options/{l}/4.mdx',
      '07-barrier-binary/{l}/3.mdx',
      '07-barrier-binary/{l}/4.mdx',
      '08-structured-products/{l}/1.mdx',
      '09-hedge-alpha-yield/{l}/1.mdx',
      '09-hedge-alpha-yield/{l}/4.mdx',
    ];
    const conflated = lang === 'de' ? /risikoneutral\w*\s+Modell/ : /risk-neutral\s+model/i;
    for (const f of files) {
      const src = mdx(f, lang);
      expect(conflated.test(src), f).toBe(false);
      expect(/Drift des Optionsmodells|drift of the option model/.test(src), f).toBe(false);
      expect(CENTRED_MODEL.test(src), `${f}: centring called a model property`).toBe(false);
    }
  });
});
