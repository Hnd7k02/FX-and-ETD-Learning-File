/**
 * Content lint (see MASTER_PROMPT §11 and DECISIONS D-17):
 * - every <Num of> exists in the number registry,
 * - every <Fact id> exists and its source is listed in sources.md,
 * - no forbidden terms (bank names, "garantiert", "risikolos" outside arbitrage/rates),
 * - no typed-in example or reference values outside <Num>,
 * - no wording retired in Version 6 (RETIRED_V6, Review 2).
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { NUMS } from '@/lib/nums';
import { FACTS } from '@/content/facts';
import { GLOSSARY } from '@/content/glossary';

const ROOT = process.cwd();
const CONTENT = join(ROOT, 'src/content');

function walk(dir: string, ext: string[]): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p, ext));
    else if (ext.some((e) => name.endsWith(e))) out.push(p);
  }
  return out;
}

const mdxFiles = walk(join(CONTENT, 'modules'), ['.mdx']);
const textFiles = [
  ...mdxFiles,
  ...walk(join(CONTENT, 'quiz'), ['.ts']),
  ...walk(join(ROOT, 'src/i18n/dict'), ['.ts']),
  ...walk(join(ROOT, 'src/components'), ['.astro', '.tsx']),
  ...walk(join(ROOT, 'src/data'), ['.ts', '.json']),
  ...(existsSync(join(CONTENT, 'glossary.ts')) ? [join(CONTENT, 'glossary.ts')] : []),
];

/**
 * Maximum-loss wording (C1): the texts and quizzes of modules 08 and 09 and the dictionaries of
 * the product matrix, the building blocks and the path simulator use three terms: no built-in
 * stop, very high but finite, theoretically unlimited (src/lib/fx/mc/maxloss.ts).
 */
const MAX_LOSS_FILES = [
  ...mdxFiles.filter((f) => /[\\/]0[89]-[^\\/]+[\\/]/.test(relative(ROOT, f))),
  ...walk(join(CONTENT, 'quiz'), ['.ts']).filter((f) => /[\\/]0[89]-[^\\/]*\.ts$/.test(f)),
  ...['productmatrix', 'structureblocks', 'pathsimulator'].map((n) =>
    join(ROOT, 'src/i18n/dict', `${n}.ts`),
  ),
];
/** «Gewinn begrenzt, Verlust nicht» and its variants, in both languages. */
const GAIN_CAPPED_LOSS_NOT =
  /(begrenzt|gedeckelt|gekappt),?\s+(der\s+|dein\s+)?Verlust\s+nicht|Gewinn,\s+nicht\s+den\s+Verlust|(capped|limited),\s+(the\s+|your\s+)?loss\s+(is\s+)?not|gain,\s+not\s+the\s+loss/i;
/** «Verluste ohne Boden» and its variants: downwards every loss here has a floor (S = 0). */
const NO_FLOOR = /ohne\s+(Boden|Grenze)|no\s+floor|without\s+a\s+floor/i;
/** The old clip label of the product matrix and the old 09.3 caption (no longer used, C16). */
const OLD_CLIP_WORDING = /Verlust\s+geht\s+weiter|loss\s+continues|aus\s+dem\s+Chart/i;

/**
 * Risk-neutral probabilities (C6): every block (paragraph, list, table) of a section text that
 * shows one of these numbers says «risikoneutral, keine Prognose» («risk-neutral, not a
 * forecast»), as the calculators do. A table may say it in the paragraph right after it; formula
 * blocks only repeat a number from the text around them.
 */
const RISK_NEUTRAL_NUMS = [
  'm01.probUp',
  'm01.probDown',
  'm01.bandProb',
  'm04.call25Prob',
  'm04.put25Prob',
  'm04.call10Prob',
  'm04.put10Prob',
  'm07.touchUp',
  'm07.touchDown',
  'm07.touchUp1',
  'm07.digitalProb',
  'm07.windowKo',
  'm08.accPKo',
  'm08.decPKo',
  'm08.tarfPTarget',
  'm08.tarfPMaturity',
  'm08.pivPTarget',
  'm08.tpfPTarget',
  'm08.rtpfPTarget',
  'm08.dciPConv',
  'm09.carryPLoss',
  'm09.yPLoss',
];
const RISK_NEUTRAL_NOTE = {
  de: /risikoneutral(e Wahrscheinlichkeit)?, keine Prognose/,
  en: /risk-neutral( probability)?, not a forecast/,
} as const;
/** Dictionary strings that show a model probability (besides every string with {prob}). */
const RISK_NEUTRAL_DICT_KEYS: Record<string, string[]> = {
  spotexposure: ['note.up', 'note.upFar', 'note.down', 'note.downFar'],
  m04: ['mx.probSub'],
  barrierlab: ['bl.row.probSub', 'bl.summary'],
  barrierpaths: ['bp.row.probSub', 'bp.summary'],
  touchlab: ['tl.row.probSub', 'tl.summary'],
  pathsimulator: ['ps.st.pEndSub', 'ps.st.pEndNote'],
  dcicalculator: ['dci.pConvSub'],
  carrycushion: ['cc.row.pSub', 'cc.summary'],
};
const dictFiles = import.meta.glob<Record<string, unknown>>('/src/i18n/dict/*.ts', {
  eager: true,
});
const langOf = (f: string): 'de' | 'en' => (/[\\/]en[\\/]/.test(relative(ROOT, f)) ? 'en' : 'de');
/** Markdown links reduced to their text, so a linked term still reads as the note. */
const unlink = (src: string) => src.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');

function sourceIds(): Set<string> {
  const ids = new Set<string>();
  const files = [join(CONTENT, 'sources.md'), ...walk(join(CONTENT, 'sources'), ['.md'])];
  for (const f of files) {
    if (!existsSync(f)) continue;
    for (const m of readFileSync(f, 'utf8').matchAll(/^##\s+([a-z0-9][a-z0-9-]*)\s*$/gm))
      ids.add(m[1]!);
  }
  return ids;
}

/** Commercial banks and other firms that must never be named. */
const FORBIDDEN_NAMES = [
  'UBS',
  'Credit Suisse',
  'Julius Bär',
  'Julius Baer',
  'Raiffeisen',
  'Kantonalbank',
  'ZKB',
  'PostFinance',
  'Vontobel',
  'Pictet',
  'Lombard Odier',
  'Leonteq',
  'EFG',
  'Goldman',
  'JPMorgan',
  'J.P. Morgan',
  'Morgan Stanley',
  'Deutsche Bank',
  'Commerzbank',
  'HSBC',
  'Barclays',
  'Citigroup',
  'Citibank',
  'BNP',
  'Société Générale',
  'Santander',
  'Bank of America',
  'Nomura',
  'Mizuho',
];

/**
 * Wordings retired in Version 6 (Review 2, DECISIONS D-51 to D-63), DE and EN, by point. They
 * must not come back in a section text, quiz, dictionary, component, the glossary, the module
 * registry, the loading text of the offline file or the README.
 */
const RETIRED_V6: [point: string, phrase: string][] = [
  ['1 double knock-in', 'Je enger der Korridor, desto billiger, und'],
  ['1 double knock-in', 'The narrower the corridor, the cheaper the option,'],
  ['2 gamma peak', 'Warum Gamma am Strike am grössten ist'],
  ['2 gamma peak', 'also shows why gamma peaks at the strike'],
  ['2 gamma peak', 'wird Gamma am Strike umso grösser'],
  ['2 gamma peak', 'gamma at the strike grows'],
  ['2 gamma peak', 'Vega bei ATMF am grössten'],
  ['2 gamma peak', 'vega peaks at ATMF'],
  ['3 alpha', 'einen Ertrag, der aus einer Marktsicht kommt'],
  ['3 alpha', 'a return that comes from a market view'],
  ['3 alpha', 'Sicht Geld machen'],
  ['3 alpha', 'make money from that view'],
  ['3 alpha', 'make money from her view'],
  ['6 methodology', 'werktags um 15:30'],
  ['6 methodology', 'Eine GitHub Action holt'],
  ['6 methodology', '15:30 UTC'],
  ['6 methodology', 'weekdays at 15:30'],
  ['6 methodology', 'Riskometer heute'],
  ['6 methodology', 'Riskometer today'],
  ['7 interest parity', 'allein aus Spot und Zinsen'],
  ['7 interest parity', 'Die Ursache ist allein der Zinsunterschied'],
  ['7 interest parity', 'spiegeln nur den Zinsunterschied'],
  ['7 interest parity', 'allein aus der Zinsparität'],
  ['7 interest parity', 'immer mit Abschlag'],
  ['7 interest parity', 'hält der Markt die Parität im Normalfall eng ein'],
  ['7 interest parity', 'spot and interest rates alone'],
  ['7 interest parity', 'The only cause is the interest rate differential'],
  ['7 interest parity', 'points only reflect'],
  ['7 interest parity', 'interest-rate parity alone'],
  ['7 interest parity', 'always trades at a forward discount'],
  ['7 interest parity', 'the market normally keeps parity tight'],
  ['8 last TARF fixing', 'Der letzte Gewinn wird so gekappt'],
  ['8 last TARF fixing', 'The last gain is capped'],
  ['9 barrier and jump', 'setzen voraus, dass der Kurs stetig'],
  ['9 barrier and jump', 'Stops und Barrieren setzen voraus'],
  ['9 barrier and jump', 'Barrieren einen stetigen Kursverlauf'],
  ['9 barrier and jump', 'Auch Barrieren werden übersprungen'],
  ['9 barrier and jump', 'und dort kann jemand handeln'],
  ['9 barrier and jump', 'Stops and barriers assume'],
  ['9 barrier and jump', 'barriers a rate that moves continuously'],
  ['9 barrier and jump', 'Barriers are jumped over too'],
  ['9 barrier and jump', 'and someone can trade there'],
  ['10 spot delta', 'Delta läuft gegen eins'],
  ['10 spot delta', 'im Geld fast eins'],
  ['10 spot delta', 'Delta kann ohnehin nie über 1 steigen'],
  ['10 spot delta', 'mit einem Delta von etwa 1'],
  ['10 spot delta', 'delta heads towards one'],
  ['10 spot delta', 'in the money close to one'],
  ['10 spot delta', 'Delta can never exceed 1'],
  ['10 spot delta', 'with a delta of about 1'],
  ['11 vega hedge', 'nur mit anderen Optionen'],
  ['11 vega hedge', 'can only be hedged with other options'],
  ['12 loading text', 'Falls nichts erscheint'],
  ['12 loading text', 'If nothing appears'],
  ['in-out parity', 'Eine der beiden lebt am Ende immer'],
  ['in-out parity', 'One of the two is always alive'],
  ['audit vega', 'Gekaufte Optionen haben positives Vega'],
  ['audit vega', 'Bought options have positive vega'],
  ['audit barrier', 'Alle Formeln dieses Moduls'],
  ['audit barrier', 'Every formula in this module'],
  ['audit barrier', 'Weil sie seltener zahlt, ist sie ohne Rebate günstiger'],
  ['audit barrier', 'Because it pays out less often, it is cheaper'],
  ['audit basis', 'die beiden Wege nicht immer gleich teuer'],
  ['audit basis', 'the two routes are not always equally expensive'],
  ['audit method', 'Interaktive Szenarien laufen in einem Web Worker'],
  ['audit method', 'Interactive scenarios run in a Web Worker'],
  ['audit method', 'Monte Carlo im Web Worker'],
  ['audit method', 'Monte Carlo in a web worker'],
  ['audit method', 'rechnet ein Skript beim Build'],
  ['audit method', 'computed by a script at build time'],
  ['audit method', 'mit dem nächsten Build'],
  ['audit method', 'with the next build'],
  ['audit method', 'Jede Zahl live gerechnet'],
  ['audit method', 'Every number calculated live'],
  ['audit method', 'nicht bei jedem Build'],
  ['audit method', 'not on every build'],
];
const RETIRED_V6_FILES = [
  ...textFiles,
  join(ROOT, 'src/data/modules.ts'),
  join(ROOT, 'scripts/build-offline.ts'),
  join(ROOT, 'README.md'),
];

/** Values from the running example and the reference table that must come from <Num>. */
const REFERENCE_LITERALS = [
  '0.8000',
  '0.7930',
  '0.79303',
  '0.79306',
  '126.69',
  '12’669',
  "12'669",
  '12,669',
  '0.5039',
  '0.6244',
  '12.3556',
  '12.36',
  '1’582',
  '1,582',
  '30.82',
  '30.67',
  '69.33',
  '1’008',
  '1,008',
  '126.5',
  '253.0',
  '33.50',
  '33.5',
];

function stripAllowed(src: string): string {
  return src
    .replace(/^import .*$/gm, '')
    .replace(/<Num\b[^>]*\/>/g, ' ')
    .replace(/<Fact\b[^>]*\/>/g, ' ')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ');
}

describe('content lint', () => {
  const sources = sourceIds();

  it('sources.md has entries', () => {
    expect(sources.size).toBeGreaterThan(0);
  });

  it.each(mdxFiles.map((f) => [relative(ROOT, f), f]))('%s uses registered <Num> keys', (_r, f) => {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/<Num\b[^>]*\bof="([^"]+)"/g)) {
      expect(NUMS[m[1]!], `unknown <Num of="${m[1]}">`).toBeDefined();
    }
  });

  it.each(mdxFiles.map((f) => [relative(ROOT, f), f]))('%s uses registered <Fact> ids', (_r, f) => {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/<Fact\b[^>]*\bid="([^"]+)"/g)) {
      expect(FACTS[m[1]!], `unknown <Fact id="${m[1]}">`).toBeDefined();
    }
  });

  it('every fact has a source in sources.md', () => {
    for (const [id, f] of Object.entries(FACTS)) {
      expect(sources.has(f.source), `fact ${id} → missing source "${f.source}"`).toBe(true);
    }
  });

  it.each(mdxFiles.map((f) => [relative(ROOT, f), f]))(
    '%s contains no typed-in reference values',
    (_r, f) => {
      const src = stripAllowed(readFileSync(f, 'utf8'));
      for (const lit of REFERENCE_LITERALS) {
        const re = new RegExp(
          `(?<![\\d.’',])${lit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\d’',])`,
        );
        expect(re.test(src), `literal "${lit}" must come from <Num>`).toBe(false);
      }
      expect(
        /(Vola|vol(atility)?)\D{0,12}\b8(\.0)?\s?%/i.test(src),
        'vol 8 % must come from <Num>',
      ).toBe(false);
      expect(/\b3\.5\s?%/.test(src), 'USD rate 3.5 % must come from <Num>').toBe(false);
    },
  );

  it('checks the maximum-loss wording of modules 08 and 09', () => {
    expect(MAX_LOSS_FILES.filter((f) => f.endsWith('.mdx')).length).toBeGreaterThanOrEqual(16);
    expect(MAX_LOSS_FILES.filter((f) => f.includes('quiz')).length).toBe(2);
    for (const f of MAX_LOSS_FILES) expect(existsSync(f), f).toBe(true);
    expect(NO_FLOOR.test('gehebelte Verluste ohne Boden')).toBe(true);
    expect(NO_FLOOR.test('with no floor')).toBe(true);
    expect(NO_FLOOR.test('Nach oben hat der Kurs keine Grenze')).toBe(false);
    expect(OLD_CLIP_WORDING.test('Verlust geht weiter')).toBe(true);
    expect(OLD_CLIP_WORDING.test('loss continues')).toBe(true);
    expect(OLD_CLIP_WORDING.test('der aus dem Chart läuft')).toBe(true);
    expect(OLD_CLIP_WORDING.test('läuft aus dem Bild')).toBe(false);
    expect(OLD_CLIP_WORDING.test('off the chart')).toBe(false);
  });

  it.each(MAX_LOSS_FILES.map((f) => [relative(ROOT, f), f]))(
    '%s words the maximum loss precisely (no stop, finite, theoretically unlimited)',
    (_r, f) => {
      const src = readFileSync(f, 'utf8');
      expect(src.match(/nicht\s+begrenzt|not\s+limited/i)?.[0], 'say what the loss is').toBe(
        undefined,
      );
      expect(src.match(GAIN_CAPPED_LOSS_NOT)?.[0], 'use «no built-in stop»').toBe(undefined);
      expect(src.match(NO_FLOOR)?.[0], 'USD/CHF cannot fall below zero').toBe(undefined);
      // the old clip label: a curve only leaves the chart («läuft aus dem Bild» / «off the chart»)
      expect(
        src.match(OLD_CLIP_WORDING)?.[0],
        'say «läuft aus dem Bild» / «off the chart», the chip says how far',
      ).toBe(undefined);
      for (const sentence of src.split(/\n|[.!?](?=\s)/)) {
        if (/unbegrenzt|unlimited/i.test(sentence)) {
          expect(/theoretisch|theoretically/i.test(sentence), sentence.trim()).toBe(true);
        }
      }
    },
  );

  it('knows every risk-neutral probability it checks', () => {
    const all = mdxFiles.map((f) => readFileSync(f, 'utf8')).join('\n');
    for (const k of RISK_NEUTRAL_NUMS) {
      expect(NUMS[k], k).toBeDefined();
      expect(all.includes(`of="${k}"`), `${k} is not used in any section text`).toBe(true);
    }
    expect(RISK_NEUTRAL_NOTE.de.test('risikoneutral, keine Prognose')).toBe(true);
    expect(RISK_NEUTRAL_NOTE.en.test('risk-neutral probability, not a forecast')).toBe(true);
    expect(unlink('([risikoneutral](/glossar/#term-risk-neutral), keine Prognose)')).toBe(
      '(risikoneutral, keine Prognose)',
    );
  });

  it.each(mdxFiles.map((f) => [relative(ROOT, f), f]))(
    '%s marks risk-neutral probabilities as such (C6)',
    (_r, f) => {
      const note = RISK_NEUTRAL_NOTE[langOf(f)];
      const blocks = unlink(readFileSync(f, 'utf8')).split(/\n[ \t]*\n/);
      blocks.forEach((block, i) => {
        const keys = [...block.matchAll(/<Num\b[^>]*\bof="([^"]+)"/g)]
          .map((m) => m[1]!)
          .filter((k) => RISK_NEUTRAL_NUMS.includes(k));
        const head = block.trimStart();
        if (keys.length === 0 || head.startsWith('<Formula')) return;
        const ok = note.test(block) || (head.startsWith('|') && note.test(blocks[i + 1] ?? ''));
        expect(ok, `${keys.join(', ')} without the note: ${head.slice(0, 100)}`).toBe(true);
      });
    },
  );

  it('marks risk-neutral probabilities in the dictionaries (C6)', () => {
    const seen = new Set<string>();
    for (const [path, mod] of Object.entries(dictFiles)) {
      const name = path.replace(/^.*\/([^/]+)\.ts$/, '$1');
      const dict = mod[name] as { de: Record<string, string>; en: Record<string, string> };
      if (!dict?.de || !dict?.en) continue;
      const listed = RISK_NEUTRAL_DICT_KEYS[name] ?? [];
      for (const lang of ['de', 'en'] as const) {
        for (const [k, v] of Object.entries(dict[lang])) {
          if (!listed.includes(k) && !v.includes('{prob}')) continue;
          seen.add(`${name}:${k}`);
          expect(RISK_NEUTRAL_NOTE[lang].test(v), `${name} ${lang}:${k} «${v}»`).toBe(true);
        }
      }
    }
    for (const [name, keys] of Object.entries(RISK_NEUTRAL_DICT_KEYS)) {
      for (const k of keys) expect(seen.has(`${name}:${k}`), `${name}:${k}`).toBe(true);
    }
  });

  it.each(mdxFiles.map((f) => [relative(ROOT, f), f]))(
    '%s links only existing glossary terms, in its own language',
    (_r, f) => {
      const ids = new Set(GLOSSARY.map((e) => e.id));
      const src = readFileSync(f, 'utf8');
      for (const m of src.matchAll(/\]\((\/(?:en\/)?glossa(?:r|ry)\/)#term-([a-z0-9-]+)\)/g)) {
        expect(m[1], `glossary path in ${langOf(f)}`).toBe(
          langOf(f) === 'en' ? '/en/glossary/' : '/glossar/',
        );
        expect(ids.has(m[2]!), `unknown glossary term "${m[2]}"`).toBe(true);
      }
    },
  );

  it.each(textFiles.map((f) => [relative(ROOT, f), f]))('%s names no banks or firms', (_r, f) => {
    const src = readFileSync(f, 'utf8');
    for (const name of FORBIDDEN_NAMES) {
      const re = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
      expect(re.test(src), `forbidden name "${name}"`).toBe(false);
    }
  });

  it('central banks as sources and model authors stay allowed (D-50)', () => {
    for (const name of ['EZB', 'ECB', 'SNB', 'BIZ', 'BIS', 'Garman', 'Kohlhagen', 'Reiner']) {
      expect(
        FORBIDDEN_NAMES.some((f) => f.includes(name) || name.includes(f)),
        name,
      ).toBe(false);
    }
    const sources = readFileSync(join(ROOT, 'src/content/sources.md'), 'utf8');
    for (const publisher of ['(EZB)', '(SNB)', '(BIZ)']) expect(sources).toContain(publisher);
  });

  it('guards the Version 6 wordings in both languages and in every text file', () => {
    expect(RETIRED_V6_FILES.length).toBeGreaterThan(150);
    for (const f of RETIRED_V6_FILES) expect(existsSync(f), f).toBe(true);
    const points = new Set(RETIRED_V6.map(([p]) => p.split(' ')[0]));
    for (const p of ['1', '2', '3', '6', '7', '8', '9', '10', '11', '12']) {
      expect(points.has(p), `point ${p}`).toBe(true);
    }
  });

  it.each(RETIRED_V6)('retired in Version 6 (point %s): «%s»', (_point, phrase) => {
    const hits = RETIRED_V6_FILES.filter((f) => readFileSync(f, 'utf8').includes(phrase)).map((f) =>
      relative(ROOT, f),
    );
    expect(hits).toEqual([]);
  });

  it.each(textFiles.map((f) => [relative(ROOT, f), f]))(
    '%s avoids "garantiert" and "risikolos" outside allowed contexts',
    (_r, f) => {
      const lines = readFileSync(f, 'utf8').split('\n');
      for (const line of lines) {
        if (/\bgarantiert|\bguarantee[ds]?\b/i.test(line)) {
          expect(
            /(nicht|kein\w*|not|no|never|nie)\s+(\w+\s+){0,2}(garantiert|guaranteed)/i.test(line),
            line,
          ).toBe(true);
        }
        if (/risikolos|risk-?free|riskless/i.test(line)) {
          expect(/arbitrage|zins|rate|anlage|deposit|carry/i.test(line), line).toBe(true);
        }
      }
    },
  );
});
