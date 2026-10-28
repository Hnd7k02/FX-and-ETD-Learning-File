/**
 * Glossary helpers: sorting, A–Z grouping and the search used by the glossary page.
 * Pure functions, shared by the server-rendered page and the search island.
 */
import type { Lang } from '@/i18n/types';
import { LOCALE } from '@/i18n/types';

/** Bucket for terms that start with a digit ("2-Way Price", "25-Delta"). */
export const DIGIT_BUCKET = '0–9';

/** The 26 letters of the index bar. */
export const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

/**
 * Length-preserving fold for search: lower case, accents removed character by character
 * ("Ä" → "a", "é" → "e"). Because every character maps to exactly one character, a match
 * position in the folded text is also the position in the original text (used for highlighting).
 */
export function fold(s: string): string {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    out += c.normalize('NFD').charAt(0).toLowerCase().charAt(0);
  }
  return out;
}

/** Splits a query into folded tokens; empty input gives no tokens. */
export function searchTokens(query: string): string[] {
  return fold(query)
    .split(/[\s,;]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/** True if every token occurs in the (already folded) haystack. No tokens match everything. */
export function matchesTokens(foldedHaystack: string, tokens: string[]): boolean {
  return tokens.every((t) => foldedHaystack.includes(t));
}

/** Builds the folded search text of an entry from its parts. */
export function searchText(parts: Array<string | undefined>): string {
  return fold(parts.filter(Boolean).join(' · '));
}

/** Index letter of a term: first letter without accents, or the digit bucket. */
export function indexLetter(term: string): string {
  const first = fold(term.trim()).charAt(0);
  if (/[0-9]/.test(first)) return DIGIT_BUCKET;
  const up = first.toUpperCase();
  return /[A-Z]/.test(up) ? up : '#';
}

/** Compares two terms in the page language (accents and case only as tie-breakers). */
export function compareTerms(a: string, b: string, lang: Lang): number {
  return a.localeCompare(b, LOCALE[lang], { sensitivity: 'base', numeric: true });
}

export interface LetterGroup<T> {
  letter: string;
  items: T[];
}

/**
 * Sorts items by their term in the page language and groups them by index letter.
 * The digit bucket comes first, then A–Z.
 */
export function groupByLetter<T>(
  items: readonly T[],
  termOf: (item: T) => string,
  lang: Lang,
): LetterGroup<T>[] {
  const sorted = [...items].sort((a, b) => compareTerms(termOf(a), termOf(b), lang));
  const groups = new Map<string, T[]>();
  for (const item of sorted) {
    const letter = indexLetter(termOf(item));
    const list = groups.get(letter);
    if (list) list.push(item);
    else groups.set(letter, [item]);
  }
  const rank = (l: string) => (l === DIGIT_BUCKET ? -1 : l === '#' ? 99 : ALPHABET.indexOf(l));
  return [...groups.entries()]
    .sort(([a], [b]) => rank(a) - rank(b))
    .map(([letter, list]) => ({ letter, items: list }));
}

/** Anchor id of a letter group ("0–9" → "letter-0-9"). */
export function letterAnchor(letter: string): string {
  return `letter-${letter === DIGIT_BUCKET ? '0-9' : letter.toLowerCase()}`;
}

/** Anchor id of a term. */
export const termAnchor = (id: string) => `term-${id}`;

/**
 * Ranges [start, end) of every token occurrence in `text` (case- and accent-insensitive),
 * merged where they overlap. Used to highlight matches.
 */
export function matchRanges(text: string, tokens: string[]): Array<[number, number]> {
  if (!tokens.length || !text) return [];
  const hay = fold(text);
  const raw: Array<[number, number]> = [];
  for (const t of tokens) {
    let from = 0;
    for (;;) {
      const i = hay.indexOf(t, from);
      if (i < 0) break;
      raw.push([i, i + t.length]);
      from = i + Math.max(t.length, 1);
    }
  }
  raw.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged: Array<[number, number]> = [];
  for (const r of raw) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([r[0], r[1]]);
  }
  return merged;
}
