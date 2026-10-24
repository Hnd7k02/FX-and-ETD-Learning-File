import { describe, expect, it } from 'vitest';
import { GLOSSARY, getGlossaryEntry } from '@/content/glossary';
import { MODULE_SLUGS, getModule } from '@/data/modules';
import { EXAMPLE, EXAMPLE_STRIKE } from '@/lib/fx/example';
import {
  ALPHABET,
  DIGIT_BUCKET,
  compareTerms,
  fold,
  groupByLetter,
  indexLetter,
  letterAnchor,
  matchRanges,
  matchesTokens,
  searchText,
  searchTokens,
  termAnchor,
} from '@/lib/glossary';

const ids = GLOSSARY.map((e) => e.id);

describe('glossary data', () => {
  it('has at least 55 terms', () => {
    expect(GLOSSARY.length).toBeGreaterThanOrEqual(55);
  });

  it('has unique kebab-case ids', () => {
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it.each(GLOSSARY.map((e) => [e.id, e] as const))(
    '%s has DE and EN term and definition',
    (_id, e) => {
      for (const lang of ['de', 'en'] as const) {
        expect(e.term[lang].trim(), `${lang} term`).not.toBe('');
        expect(e.def[lang].trim(), `${lang} def`).not.toBe('');
        // 1–2 sentences, ending with a full stop
        expect(e.def[lang].trim()).toMatch(/[.!?)]$/);
        const sentences = e.def[lang].split(/(?<=[a-zäöüß)])\.\s+(?=[A-ZÄÖÜ])/).length;
        expect(sentences, `${lang} sentences`).toBeLessThanOrEqual(2);
        expect(e.def[lang].length, `${lang} length`).toBeLessThan(320);
      }
    },
  );

  it('every module slug and section exists', () => {
    for (const e of GLOSSARY) {
      expect(MODULE_SLUGS, e.id).toContain(e.module);
      const sec = Number(e.section ?? '1');
      expect(getModule(e.module).sections[sec - 1], e.id).toBeDefined();
    }
  });

  it('every "see" id exists, is not the entry itself and is not repeated', () => {
    for (const e of GLOSSARY) {
      const see = e.see ?? [];
      expect(new Set(see).size, e.id).toBe(see.length);
      for (const s of see) {
        expect(getGlossaryEntry(s), `${e.id} → ${s}`).toBeDefined();
        expect(s).not.toBe(e.id);
      }
    }
  });

  it('covers every module of the learning path', () => {
    for (const slug of MODULE_SLUGS) {
      expect(
        GLOSSARY.some((e) => e.module === slug),
        slug,
      ).toBe(true);
    }
  });

  it('includes the core terms of the brief', () => {
    for (const id of [
      'pip',
      'big-figure',
      'forward-points',
      'interest-rate-parity',
      'fx-swap',
      'swap-points',
      'strike',
      'moneyness',
      'atmf',
      'garman-kohlhagen',
      'black-76',
      'put-call-parity',
      'delta',
      'gamma',
      'vega',
      'theta',
      'rho',
      'risk-reversal',
      'butterfly',
      'knock-out',
      'reverse-knock-out',
      'double-no-touch',
      'accumulator',
      'tarf',
      'pivot-tarf',
      'tpf',
      'rtpf',
      'dual-currency',
      'monte-carlo',
      'hedge',
      'alpha',
      'yield',
    ]) {
      expect(ids, id).toContain(id);
    }
  });

  const allText = GLOSSARY.flatMap((e) => [
    e.term.de,
    e.term.en,
    e.def.de,
    e.def.en,
    ...(e.aliases ?? []),
  ]);

  it('avoids "garantiert"/"guaranteed" and "risikolos"/"risk-free" outside rate/arbitrage contexts', () => {
    for (const e of GLOSSARY) {
      for (const text of [e.def.de, e.def.en]) {
        expect(/garantiert|guarantee/i.test(text), text).toBe(false);
        if (/risikolos|risk-?free|riskless/i.test(text)) {
          expect(/arbitrage|zins|rate/i.test(text), text).toBe(true);
        }
      }
    }
  });

  it('names no banks or providers', () => {
    const names =
      /\b(UBS|Credit Suisse|Julius|Raiffeisen|Kantonalbank|Goldman|JPMorgan|HSBC|Barclays|Citi|BNP|Deutsche Bank|Leonteq|Vontobel)\b/;
    for (const t of allText) expect(names.test(t), t).toBe(false);
  });

  it('uses no numbers from the running example', () => {
    const literals = [
      EXAMPLE.spot.toFixed(4),
      EXAMPLE_STRIKE.toFixed(4),
      '0.79303',
      '126.7',
      '12’669',
      '3.5 %',
      '3.5%',
      '8 %',
      '8%',
      '1 Mio',
      '1 million',
    ];
    for (const t of allText) {
      for (const lit of literals) expect(t.includes(lit), `${lit} in "${t}"`).toBe(false);
    }
  });

  it('keeps English technical terms in German', () => {
    const de = (id: string) => getGlossaryEntry(id)!.term.de;
    expect(de('forward-points')).toBe('Forward Points');
    expect(de('strike')).toBe('Strike');
    expect(de('moneyness')).toBe('Moneyness');
    expect(de('knock-out')).toBe('Knock-out');
  });

  it('German definitions use du, never the formal Sie', () => {
    // A capitalised Sie/Ihnen/Ihr inside a sentence is the formal address; at the start of a
    // sentence "Sie" is the ordinary pronoun ("Sie ist der Lohn …").
    const formal = /(?<![.!?:]\s|^)\b(Sie|Ihnen|Ihr|Ihre|Ihren)\b/;
    for (const e of GLOSSARY) {
      expect(formal.test(e.def.de), e.def.de).toBe(false);
    }
    expect(formal.test('Das zahlen Sie.')).toBe(true);
    expect(formal.test('Gut. Sie ist der Lohn.')).toBe(false);
  });
});

describe('glossary helpers', () => {
  it('folds case and accents without changing the length', () => {
    expect(fold('Ärger Über Öl')).toBe('arger uber ol');
    expect(fold('Prämie').length).toBe('Prämie'.length);
    expect(fold('Δ')).toBe('δ');
  });

  it('tokenises queries', () => {
    expect(searchTokens('  Forward   Points ')).toEqual(['forward', 'points']);
    expect(searchTokens('')).toEqual([]);
    expect(searchTokens('a, b; c')).toEqual(['a', 'b', 'c']);
  });

  it('matches all tokens', () => {
    const hay = searchText(['Forward Points', 'Terminpunkte', undefined, 'Differenz in Pips']);
    expect(matchesTokens(hay, searchTokens('points pips'))).toBe(true);
    expect(matchesTokens(hay, searchTokens('termin'))).toBe(true);
    expect(matchesTokens(hay, searchTokens('points gamma'))).toBe(false);
    expect(matchesTokens(hay, [])).toBe(true);
  });

  it('finds terms across languages and aliases', () => {
    const fp = GLOSSARY.find((e) => e.id === 'forward-points')!;
    const hay = searchText([fp.term.de, fp.term.en, ...(fp.aliases ?? []), fp.def.de]);
    expect(matchesTokens(hay, searchTokens('terminpunkte'))).toBe(true);
    const atm = GLOSSARY.find((e) => e.id === 'atmf')!;
    expect(
      matchesTokens(
        searchText([atm.term.de, ...(atm.aliases ?? [])]),
        searchTokens('at the money'),
      ),
    ).toBe(true);
  });

  it('assigns index letters', () => {
    expect(indexLetter('Ärger')).toBe('A');
    expect(indexLetter('25-Delta')).toBe(DIGIT_BUCKET);
    expect(indexLetter('2-Way Price')).toBe(DIGIT_BUCKET);
    expect(indexLetter('Δ-Hedge')).toBe('#');
    expect(indexLetter('  vega')).toBe('V');
  });

  it('sorts in the page language and groups A–Z, digits first, symbols last', () => {
    const items = ['Zeitwert', 'Ask', '25-Delta', 'Öl', 'Option', 'Δ', 'Arbitrage'];
    const groups = groupByLetter(items, (x) => x, 'de');
    expect(groups.map((g) => g.letter)).toEqual([DIGIT_BUCKET, 'A', 'O', 'Z', '#']);
    expect(groups[1]!.items).toEqual(['Arbitrage', 'Ask']);
    expect(groups[2]!.items).toEqual(['Öl', 'Option']);
    expect(compareTerms('Ask', 'Bid', 'en')).toBeLessThan(0);
  });

  it('groups the real glossary without losing terms', () => {
    for (const lang of ['de', 'en'] as const) {
      const groups = groupByLetter(GLOSSARY, (e) => e.term[lang], lang);
      expect(groups.reduce((n, g) => n + g.items.length, 0)).toBe(GLOSSARY.length);
      for (const g of groups) {
        expect([DIGIT_BUCKET, ...ALPHABET]).toContain(g.letter);
        for (const e of g.items) expect(indexLetter(e.term[lang])).toBe(g.letter);
      }
    }
  });

  it('builds anchors', () => {
    expect(letterAnchor('A')).toBe('letter-a');
    expect(letterAnchor(DIGIT_BUCKET)).toBe('letter-0-9');
    expect(termAnchor('pip')).toBe('term-pip');
  });

  it('finds and merges match ranges for highlighting', () => {
    expect(matchRanges('Forward Points', ['forward'])).toEqual([[0, 7]]);
    expect(matchRanges('Prämie und Prämie', ['pram'])).toEqual([
      [0, 4],
      [11, 15],
    ]);
    expect(matchRanges('Knock-out', ['knock', 'ck-o'])).toEqual([[0, 7]]);
    expect(matchRanges('abc', [])).toEqual([]);
    expect(matchRanges('', ['a'])).toEqual([]);
  });
});
