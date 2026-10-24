/**
 * Quiz parity (Review 3, Block D): in all 72 questions the German and the English prompt, every
 * option label and every explanation carry the same numbers. The same `correct` index alone does
 * not prove that, so the numeric tokens of both texts are compared, as a multiset and in order.
 *
 * The normaliser is minimal and must not hide a real difference:
 *  1. Spaces: no-break (U+00A0), narrow no-break (U+202F) and thin (U+2009) spaces become spaces.
 *  2. Dates: the formatter's language forms become ISO, so «15.01.2015», «15. Januar 2015» and
 *     «15 Jan 2015», «15 January 2015» all read 2015-01-15; «Jan. 2015» and «Jan 2015» read
 *     2015-01. The month names come from src/lib/format.ts itself, not from a typed table.
 *  3. Thousands: ’ (U+2019), ' and , between a digit and exactly three digits are dropped
 *     («CHF 12’669» and «CHF 12,669» → 12669). The decimal point is a point in both languages.
 *  4. Percent: the space before % goes («8 %» and «8%» → 8%); the % stays part of the token.
 *  5. Magnitude: «1 Mio.» → 1m and «1 Mrd.» → 1bn, the English forms 1m / 1bn as they are. The
 *     unit stays in the token, so «1 Mio.» against «1» or «1,000,000» is a difference.
 *  6. Ordinals: the English suffix is dropped («6th» → 6); the German ordinal point is no decimal
 *     point, so «6. Fixing» → 6 by the token grammar.
 *  7. Signs: −, – and - directly before a digit and not after a digit are a sign («−30.3» → -30.3).
 *     A dash between two digits is a range («13:00–17:00») and separates two tokens.
 *  8. Tokens: an optional sign, digits, further digit groups after . : or - (0.7930, 13:00,
 *     2015-01-15), an optional unit (%, m, bn). A digit run directly after a Latin letter is an
 *     identifier (d1, d2, N(d2)) and no number; a letter after a number (25P, 3-month) is text.
 *
 * The order is compared too, except for the fields in REORDERED, where the translation moves a
 * clause. Every entry there must really be reordered, so the list cannot go stale.
 */
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { QUIZZES, type QuizQuestion } from '@/content/quiz';
import { MODULE_SLUGS } from '@/data/modules';
import {
  fmtDate,
  fmtDateLong,
  fmtMillions,
  fmtMoney,
  fmtMonthYear,
  fmtNumber,
  fmtPct,
  fmtPips,
  fmtRate,
} from '@/lib/format';

/* ---------- Normaliser ---------- */

/** Month names in both languages and both lengths, taken from the formatter. */
const MONTH_BY_NAME = new Map<string, number>();
for (let m = 1; m <= 12; m++) {
  const iso = `2000-${String(m).padStart(2, '0')}-01`;
  for (const lang of ['de', 'en'] as const) {
    MONTH_BY_NAME.set(fmtMonthYear(iso, lang).replace(' 2000', ''), m);
    MONTH_BY_NAME.set(
      fmtDateLong(iso, lang)
        .replace(/^1[.]? /, '')
        .replace(' 2000', ''),
      m,
    );
  }
}
const MONTH_ALT = [...MONTH_BY_NAME.keys()]
  .sort((a, b) => b.length - a.length)
  .map((name) => name.replace('.', '[.]'))
  .join('|');
/** «15. Januar 2015», «15 Jan 2015», «Jan. 2015» … */
const DATE_WORDS = new RegExp(`(?:([0-9]{1,2})[.]? )?(${MONTH_ALT}) ([0-9]{4})(?![0-9])`, 'g');
/** «15.01.2015» */
const DATE_DOTTED = /(?<![0-9.])(\d{1,2})\.(\d{1,2})\.(\d{4})(?!\d)/g;
const pad = (x: string | number) => String(x).padStart(2, '0');

const TOKEN = /(?<![A-Za-z\d])[+-]?\d+(?:[.:-]\d+)*(?:%|m(?![A-Za-z])|bn(?![A-Za-z]))?/g;

/** Normalises a text and returns its numeric tokens in reading order. */
function numbers(text: string): string[] {
  const t = text
    .replace(/[\u00a0\u202f\u2009]/g, ' ')
    .replace(DATE_DOTTED, (_m, d: string, mo: string, y: string) => `${y}-${pad(mo)}-${pad(d)}`)
    .replace(DATE_WORDS, (_m, d: string | undefined, name: string, y: string) => {
      const mo = pad(MONTH_BY_NAME.get(name)!);
      return d ? `${y}-${mo}-${pad(d)}` : `${y}-${mo}`;
    })
    .replace(/(\d)[\u2019',](?=\d{3}(?!\d))/g, '$1')
    .replace(/(\d) %/g, '$1%')
    .replace(/(\d) Mio\./g, '$1m')
    .replace(/(\d) Mrd\./g, '$1bn')
    .replace(/(\d)(?:st|nd|rd|th)(?![A-Za-z])/g, '$1')
    .replace(/(^|[^\d])[\u2212\u2013-](?=\d)/g, '$1-');
  return t.match(TOKEN) ?? [];
}

/* ---------- Questions ---------- */

const LETTERS = ['A', 'B', 'C', 'D'];

const ALL = Object.values(QUIZZES).flatMap((quiz) =>
  [...quiz.quiz, ...Object.values(quiz.checks)].map((q) => [q.id, q] as const),
);

interface Field {
  key: string;
  de: string;
  en: string;
}

function fields(q: QuizQuestion): Field[] {
  return [
    { key: `${q.id} prompt`, de: q.prompt.de, en: q.prompt.en },
    ...q.options.flatMap((o, i) => [
      { key: `${q.id} option ${LETTERS[i]} label`, de: o.label.de, en: o.label.en },
      { key: `${q.id} option ${LETTERS[i]} explanation`, de: o.explain.de, en: o.explain.en },
    ]),
  ];
}

/**
 * Fields whose translation moves a clause, so the same numbers come in another order
 * (e.g. «tauscht sie zum Spot 0.8000 in USD 1 Mio.» / «changes them into USD 1m at the spot rate
 * of 0.8000»). Add a field here only when the multiset is equal and the order differs.
 */
const REORDERED = new Set(['m01-q4 prompt', 'm02-c2 prompt', 'm02-c2 option A explanation']);

const sorted = (xs: string[]) => [...xs].sort();

/** Describes the difference between the DE and EN numbers of a field, or null if there is none. */
function describeDiff(f: Field): string | null {
  const de = numbers(f.de);
  const en = numbers(f.en);
  const sameOrder = de.join('\u0001') === en.join('\u0001');
  const sameSet = sorted(de).join('\u0001') === sorted(en).join('\u0001');
  if (sameOrder) {
    return REORDERED.has(f.key)
      ? `${f.key}: listed in REORDERED, but DE and EN have the same order. Remove it there.`
      : null;
  }
  if (sameSet && REORDERED.has(f.key)) return null;
  const lines = [
    sameSet
      ? `${f.key}: same numbers, other order (add the field to REORDERED only if the translation moves a clause)`
      : `${f.key}: numbers differ`,
    `  DE: ${f.de}`,
    `  EN: ${f.en}`,
    `  DE numbers: ${de.join(' | ') || '(none)'}`,
    `  EN numbers: ${en.join(' | ') || '(none)'}`,
  ];
  const n = Math.max(de.length, en.length);
  for (let i = 0; i < n; i++) {
    if (de[i] !== en[i]) {
      lines.push(`  first difference at #${i + 1}: DE «${de[i] ?? '–'}», EN «${en[i] ?? '–'}»`);
      break;
    }
  }
  return lines.join('\n');
}

/* ---------- Tests ---------- */

describe('quiz registry', () => {
  it('has one quiz per module: 9 quizzes × (4 graded + 4 checks) = 72 questions', () => {
    const files = readdirSync(join(process.cwd(), 'src/content/quiz')).filter((name) =>
      /^\d\d-.*\.ts$/.test(name),
    );
    expect(files).toHaveLength(9);
    expect(Object.keys(QUIZZES).sort()).toEqual([...MODULE_SLUGS].sort());
    expect(Object.keys(QUIZZES)).toHaveLength(9);
    for (const quiz of Object.values(QUIZZES)) {
      expect(quiz.quiz, quiz.slug).toHaveLength(4);
      expect(Object.keys(quiz.checks).sort(), quiz.slug).toEqual(['1', '2', '3', '4']);
    }
    expect(ALL).toHaveLength(72);
    expect(new Set(ALL.map(([id]) => id)).size).toBe(72);
  });

  it.each(ALL)('%s has 3 to 4 options and a valid correct index', (_id, q) => {
    expect(q.options.length).toBeGreaterThanOrEqual(3);
    expect(q.options.length).toBeLessThanOrEqual(4);
    expect(Number.isInteger(q.correct)).toBe(true);
    expect(q.correct).toBeGreaterThanOrEqual(0);
    expect(q.correct).toBeLessThan(q.options.length);
  });
});

describe('number normaliser', () => {
  const same = (de: string, en: string, expected: string[]) => {
    expect(numbers(de), de).toEqual(expected);
    expect(numbers(en), en).toEqual(expected);
  };

  it('reads the language forms of the formatter alike', () => {
    same(fmtMoney(12669, 'CHF', 'de'), fmtMoney(12669, 'CHF', 'en'), ['12669']);
    same(fmtMoney(1804296, 'CHF', 'de'), fmtMoney(1804296, 'CHF', 'en'), ['1804296']);
    same(fmtMoney(-18061, 'CHF', 'de'), fmtMoney(-18061, 'CHF', 'en'), ['-18061']);
    same(fmtMoney(46939, 'CHF', 'de', 0, true), fmtMoney(46939, 'CHF', 'en', 0, true), ['+46939']);
    same(fmtNumber(-30.3, 'de', { digits: 1 }), fmtNumber(-30.3, 'en', { digits: 1 }), ['-30.3']);
    same(fmtPips(12, 'de', 1, true), fmtPips(12, 'en', 1, true), ['+12.0']);
    same(fmtPct(0.08, 'de'), fmtPct(0.08, 'en'), ['8.0%']);
    same(fmtPct(-0.0245, 'de', 2), fmtPct(-0.0245, 'en', 2), ['-2.45%']);
    same(fmtMillions(1e6, 'USD', 'de'), fmtMillions(1e6, 'USD', 'en'), ['1m']);
    same(fmtMillions(2e6, 'USD', 'de'), fmtMillions(2e6, 'USD', 'en'), ['2m']);
    same(fmtDate('2015-01-15', 'de'), fmtDate('2015-01-15', 'en'), ['2015-01-15']);
    same(fmtDateLong('2015-01-15', 'de'), fmtDateLong('2015-01-15', 'en'), ['2015-01-15']);
    same(fmtDateLong('2022-03-07', 'de'), fmtDateLong('2022-03-07', 'en'), ['2022-03-07']);
    same(fmtMonthYear('2015-01-15', 'de'), fmtMonthYear('2015-01-15', 'en'), ['2015-01']);
    same(fmtMonthYear('2015-09-15', 'de'), fmtMonthYear('2015-09-15', 'en'), ['2015-09']);
    same(`Kurs ${fmtRate(0.793)}`, `rate ${fmtRate(0.793)}`, ['0.7930']);
    same('6. Fixing', '6th fixing', ['6']);
    same('13:00–17:00', '13:00–17:00', ['13:00', '17:00']);
    same('3-Monats-Forward', '3-month forward', ['3']);
    same('(1 + 3.5 % · 90/360)', '(1 + 3.5% · 90/360)', ['1', '3.5%', '90', '360']);
    same('N(d1) und N(d2)', 'N(d1) and N(d2)', []);
    same('25P', '25P', ['25']);
  });

  it('keeps real differences', () => {
    const differ = (a: string, b: string) =>
      expect(numbers(a), `${a} vs ${b}`).not.toEqual(numbers(b));
    differ('0.7930', '0.7931');
    differ('0.7930', '0.793');
    differ('CHF 12’669', 'CHF 1,266');
    differ('CHF 12’669', 'CHF 126,69');
    differ('8 %', '8');
    differ('−30', '30');
    differ('+30', '30');
    differ('USD 1 Mio.', 'USD 1');
    differ('USD 1 Mio.', 'USD 1,000,000');
    differ('13:00', '13:30');
    differ('15.01.2015', '16 Jan 2015');
    differ('15.01.2015', '15 Feb 2015');
    differ('100 Pips und 10’000', '10,000 and 100 pips');
    differ('zweimal 5', '5 and 5');
  });
});

describe('quiz parity DE/EN', () => {
  it.each(ALL)('%s carries the same numbers in DE and EN', (_id, q) => {
    const problems = fields(q)
      .map(describeDiff)
      .filter((p): p is string => p !== null);
    expect(problems, problems.join('\n\n')).toEqual([]);
  });

  it('lists only existing fields in REORDERED', () => {
    const keys = new Set(ALL.flatMap(([, q]) => fields(q).map((f) => f.key)));
    for (const key of REORDERED) expect(keys.has(key), key).toBe(true);
  });
});
