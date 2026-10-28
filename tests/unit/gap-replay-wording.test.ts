/**
 * Franc-shock replay (module 07, section 4), supplement point 17: the replay is a hypothetical
 * scenario with daily ECB reference rates and never reads as an executable historical
 * transaction, not in the text, the caption, the island's visible, ARIA and status strings or
 * the quiz. A fill is always an assumption; a knock-out means the option is extinguished under
 * the assumed terms; the options have no rebate, and the texts say so. The glossary entries that
 * the replay links (knock-out, gap risk) say the same; a rebate added to the replay would need
 * its own row and new texts, so the config may not carry one silently.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getGlossaryEntry } from '@/content/glossary';
import { quiz } from '@/content/quiz/07-barrier-binary';
import { gapreplay } from '@/i18n/dict/gapreplay';
import { M07_CONFIG } from '@/lib/m07/config';
import { fixingsWindow, gapSummary } from '@/lib/m07/gap';

const LANGS = ['de', 'en'] as const;
type Lang = (typeof LANGS)[number];

/** Words that describe a fill (execution) of the stop. */
const FILL = { de: /ausgeführt|Ausführung/, en: /\bfill(ed)?\b/ } as const;
/** Words that mark a statement as part of the hypothetical scenario. */
const ASSUMED = {
  de: /Annahme|angenommen|Szenario|hypothetisch/i,
  en: /assum|scenario|hypothetical/i,
} as const;
/** Words for the extinction of a knock-out option. */
const EXTINGUISHED = { de: /erlisch|erlösch|erlosch/, en: /extinguish/ } as const;
/** The terms under which it is extinguished. */
const TERMS = { de: /Bedingungen/, en: /\bterms\b/ } as const;
const NO_REBATE = { de: /(kein|ohne) Rebate/, en: /no rebate/ } as const;
/** Wording that the supplement replaced (the option does not "simply" cease to exist). */
const OLD = { de: /erlischt einfach/, en: /simply ceases/ } as const;

function sectionText(lang: Lang): string {
  return readFileSync(
    join(process.cwd(), 'src/content/modules/07-barrier-binary', lang, '4.mdx'),
    'utf8',
  );
}

function caption(lang: Lang): string {
  const m = sectionText(lang).match(/<GapReplayFigure caption="([^"]+)"/);
  expect(m, `${lang}: GapReplayFigure caption`).not.toBeNull();
  return m![1]!;
}

const check = quiz.checks['4'];

/** Prompt and explanations of the gap check (the wrong labels are wrong on purpose). */
function quizTexts(lang: Lang): string[] {
  return [check.prompt[lang], ...check.options.map((o) => o.explain[lang])];
}

function expectAssumed(text: string, lang: Lang, where: string) {
  if (FILL[lang].test(text)) {
    expect(ASSUMED[lang].test(text), `${where}: fill without assumption «${text}»`).toBe(true);
  }
  if (EXTINGUISHED[lang].test(text)) {
    expect(TERMS[lang].test(text), `${where}: knock-out without its terms «${text}»`).toBe(true);
  }
  expect(OLD[lang].test(text), `${where}: old wording «${text}»`).toBe(false);
}

describe('franc-shock replay wording (point 17)', () => {
  it('knows the patterns it checks', () => {
    expect(FILL.de.test('gilt als ausgeführt')).toBe(true);
    expect(FILL.en.test('counts as filled')).toBe(true);
    expect(FILL.en.test('fixing')).toBe(false);
    expect(ASSUMED.de.test('Annahme: Der Stop gilt als ausgeführt')).toBe(true);
    expect(EXTINGUISHED.de.test('Die Optionen erlöschen')).toBe(true);
    expect(EXTINGUISHED.de.test('Knock-outs erloschen')).toBe(true);
    expect(NO_REBATE.de.test('ohne Rebate')).toBe(true);
    expect(NO_REBATE.en.test('with no rebate')).toBe(true);
  });

  it.each(LANGS)('every island string words fills and knock-outs as assumptions (%s)', (lang) => {
    for (const [key, text] of Object.entries(gapreplay[lang])) {
      expectAssumed(text, lang, `gapreplay ${lang}:${key}`);
    }
  });

  it.each(LANGS)(
    'the title, status and ARIA texts call it hypothetical or assumed (%s)',
    (lang) => {
      const d = gapreplay[lang];
      for (const key of ['gr.title', 'gr.aha.t', 'gr.status.before', 'gr.status.after'] as const) {
        expect(ASSUMED[lang].test(d[key]), `${lang}:${key}`).toBe(true);
      }
      expect(d['gr.aria']).toMatch(lang === 'de' ? /angenommen/ : /assumed/);
      expect(d['gr.aria']).toContain('{summary}');
    },
  );

  it.each(LANGS)('the island says that the options have no rebate (%s)', (lang) => {
    const d = gapreplay[lang];
    for (const key of ['gr.tableSub', 'gr.row.putSub', 'gr.status.after'] as const) {
      expect(NO_REBATE[lang].test(d[key]), `${lang}:${key}`).toBe(true);
    }
    expect(d['gr.note']).toMatch(lang === 'de' ? /kein Rebate/ : /no rebate/);
  });

  it.each(LANGS)('the figure caption is an assumption, with no rebate (%s)', (lang) => {
    const c = caption(lang);
    expect(c).toMatch(lang === 'de' ? /^Hypothetisches Szenario/ : /^Hypothetical scenario/);
    expectAssumed(c, lang, `${lang} caption`);
    expect(NO_REBATE[lang].test(c), `${lang} caption`).toBe(true);
  });

  it.each(LANGS)('the section text never calls a knock-out a simple end (%s)', (lang) => {
    const src = sectionText(lang);
    expect(OLD[lang].test(src)).toBe(false);
    // the loss scenario names the assumed terms and the missing rebate
    const callout = src.slice(src.indexOf('<Callout variant="bad"'), src.indexOf('</Callout>'));
    expect(callout).toMatch(
      lang === 'de' ? /nach den angenommenen Bedingungen/ : /under the assumed terms/,
    );
    expect(NO_REBATE[lang].test(callout), `${lang} callout`).toBe(true);
    // the exporter's put is an assumed example, not a historical trade
    expect(callout).toContain(lang === 'de' ? 'Nimm an' : 'Suppose');
  });

  it.each(LANGS)('the quiz check words the fill as an assumption (%s)', (lang) => {
    for (const text of quizTexts(lang)) expectAssumed(text, lang, `m07-c4 ${lang}`);
    expect(ASSUMED[lang].test(check.prompt[lang])).toBe(true);
    const right = check.options[check.correct]!;
    expect(right.explain[lang]).toMatch(
      lang === 'de' ? /nach den angenommenen Bedingungen/ : /under the assumed terms/,
    );
  });

  it('cross references to the replay call it hypothetical', () => {
    for (const lang of LANGS) {
      const src = readFileSync(
        join(process.cwd(), 'src/content/modules/01-spot', lang, '3.mdx'),
        'utf8',
      );
      const block = src
        .split(/\n[ \t]*\n/)
        .find((b) => /07-barrier-binary\/4\//.test(b) && /Frankenschock|franc shock/.test(b));
      expect(block, `${lang} 01/3 links the replay`).toBeDefined();
      expect(block).toMatch(lang === 'de' ? /hypothetisches Szenario/ : /hypothetical scenario/);
    }
  });

  it.each(LANGS)('the glossary extinguishes a knock-out under its terms (%s)', (lang) => {
    for (const id of ['knock-out', 'gap-risk']) {
      const def = getGlossaryEntry(id)!.def[lang];
      expect(EXTINGUISHED[lang].test(def), `${id}: extinction «${def}»`).toBe(true);
      expect(TERMS[lang].test(def), `${id}: knock-out without its terms «${def}»`).toBe(true);
      expect(OLD[lang].test(def), id).toBe(false);
      expect(def, id).not.toMatch(/verfällt sofort wertlos|dies immediately/);
    }
    // a rebate is paid on its own; in-out parity holds without one
    const ko = getGlossaryEntry('knock-out')!.def[lang];
    expect(ko).toMatch(
      lang === 'de' ? /Rebate wird gesondert gezahlt/ : /rebate is paid separately/,
    );
    expect(ko).toMatch(
      lang === 'de' ? /ohne Rebate zusammen die Vanilla/ : /Without a rebate, a knock-out/,
    );
  });
});

describe('franc-shock replay has no rebate (point 17)', () => {
  const g = M07_CONFIG.gap;

  it('the replay config carries no rebate', () => {
    const keys = Object.keys(g).filter((k) => /rebate/i.test(k));
    expect(keys, 'point 17: a rebate needs its own row and new texts').toEqual([]);
  });

  it('the lost value is the put intrinsic value at the knock-out, nothing netted', () => {
    const raw = readFileSync(join(process.cwd(), 'data/raw/ecb-eur-reference.csv'), 'utf8');
    const s = gapSummary(fixingsWindow(raw, g.pair, g.from, g.to));
    const keys = Object.keys(s).filter((k) => /rebate/i.test(k));
    expect(keys, 'point 17: a rebate needs its own row and new texts').toEqual([]);
    expect(s.putLostChf).toBeGreaterThan(0);
    expect(s.putLostChf).toBeCloseTo((g.putStrike - s.shock) * g.notional, 6);
  });
});
