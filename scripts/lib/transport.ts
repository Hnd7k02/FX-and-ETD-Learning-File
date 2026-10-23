/**
 * Transport hardening for the single offline file (DECISIONS D-41, supplement of 23.10.2026).
 *
 * The file travels by e-mail to the work PC. On the way, the two characters backslash + "n"
 * turned into a real line break: one such escape in the main script was a SyntaxError and the
 * page stayed at "loading". The mail test showed which escapes arrive intact:
 *   \uXXXX (exactly 4 hex digits), \\, \/, \., \{, \}, \d, \s, \w, \B.
 * The rule holds for every byte of the file (HTML, CSS and JS alike).
 *
 * This module
 * - rewrites the few escapes that need it (`rewriteJsEscapes`): \n \r \t \v \f, \xHH, and an
 *   escaped backslash directly before n, r or t; everything else is left alone and checked,
 * - turns non-ASCII text into ASCII for HTML (`htmlAscii`) and CSS (`cssAscii`),
 * - lists everything that is not transport-safe (`transportProblems`, `cssEscapeProblems`),
 * - simulates the transport for the tests (`simulateMail`).
 */

/** Escapes that arrived intact in the mail test (the character after the backslash). */
export const SAFE_ESCAPES = new Set(['\\', '/', '.', '{', '}', 'd', 's', 'w', 'B']);

const HEX = /^[0-9a-fA-F]$/;
const hex4 = (code: number) => code.toString(16).padStart(4, '0');
const u = (code: number) => `\\u${hex4(code)}`;

/** Control escapes and the code points they stand for. */
const CONTROL: Record<string, number> = { n: 0x0a, r: 0x0d, t: 0x09, v: 0x0b, f: 0x0c };

/**
 * Rewrites the escapes of a JavaScript source that are not transport-safe but have a safe
 * equivalent. Reads backslash pairs from left to right (no global replace), so "\\n" (escaped
 * backslash + n) and "\n" stay apart. Only three rewrites, each with the same meaning in
 * strings, templates, regular expressions with and without u/v, and character classes:
 * - \n \r \t \v \f → \u000a \u000d \u0009 \u000b \u000c
 * - \xHH → \u00HH
 * - \\ directly before n, r or t → \ (the backslash itself)
 * Every other escape stays as it is; `transportProblems` decides whether it may stay. Nothing
 * else is reinterpreted (back-references, \b, \0, \u{…}, \p{…}, a trailing backslash).
 */
export function rewriteJsEscapes(src: string): string {
  let out = '';
  let i = 0;
  while (i < src.length) {
    const ch = src[i]!;
    if (ch !== '\\') {
      out += ch;
      i++;
      continue;
    }
    const c = src[i + 1];
    if (c === undefined) {
      out += ch; // trailing backslash: left for the check
      i++;
      continue;
    }
    if (c in CONTROL) {
      out += u(CONTROL[c]!);
    } else if (c === 'x' && HEX.test(src[i + 2] ?? '') && HEX.test(src[i + 3] ?? '')) {
      out += `\\u00${src.slice(i + 2, i + 4).toLowerCase()}`;
      i += 4;
      continue;
    } else if (c === '\\') {
      out += /[nrt]/.test(src[i + 2] ?? '') ? u(0x5c) : '\\\\';
    } else {
      out += ch + c;
    }
    i += 2;
  }
  return out;
}

/** HTML text: every character outside 0x20…0x7E (except LF) as a numeric reference &#N;. */
export function htmlAscii(s: string): string {
  let out = '';
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    out += cp === 0x0a || (cp >= 0x20 && cp <= 0x7e) ? ch : `&#${cp};`;
  }
  return out;
}

/**
 * CSS: every non-ASCII character as a CSS escape. Only escapes that start with a tested pair are
 * allowed: \d… (lowercase d) and \B… (uppercase B, CSS hex is case-insensitive). Today these are
 * \d7 (×) and \B7 (·). Any other character is reported in `unsafe` (put it into the markup as an
 * HTML entity and use content: attr(data-…) instead). A space follows the escape when a hex
 * digit or whitespace comes next (CSS would take one whitespace as part of the escape), so every
 * escape ends unambiguously.
 */
export function cssAscii(css: string): { css: string; unsafe: string[] } {
  let out = '';
  const unsafe: string[] = [];
  const chars = [...css];
  chars.forEach((ch, k) => {
    const cp = ch.codePointAt(0)!;
    if (cp === 0x0a || (cp >= 0x20 && cp <= 0x7e)) {
      out += ch;
      return;
    }
    if (cp === 0x09 || cp === 0x0d) {
      out += ' ';
      return;
    }
    let h = cp.toString(16);
    if (h.startsWith('d')) h = `d${h.slice(1)}`;
    else if (h.startsWith('b')) h = `B${h.slice(1)}`;
    else unsafe.push(`U+${hex4(cp).toUpperCase()}`);
    const next = chars[k + 1] ?? '';
    out += `\\${h}${/^[0-9a-fA-F \t\n\r]$/.test(next) ? ' ' : ''}`;
  });
  return { css: out, unsafe };
}

/**
 * Escapes in CSS that are not transport-safe or do not end unambiguously: a hex escape must
 * start with a tested pair (\d or \B), may have at most 6 hex digits and must be followed by a
 * character that is not a hex digit (a single space counts as the terminator).
 */
export function cssEscapeProblems(css: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < css.length; i++) {
    if (css[i] !== '\\') continue;
    const c = css[i + 1] ?? '';
    if (c === '\\') {
      i++;
      continue;
    }
    if (!HEX.test(c)) {
      i++;
      continue; // non-hex escapes are checked by transportProblems
    }
    let j = i + 1;
    while (j < css.length && HEX.test(css[j]!)) j++;
    const run = css.slice(i + 1, j);
    const near = css.slice(Math.max(0, i - 20), j + 20);
    if (!(run[0] === 'd' || run[0] === 'B')) out.push(`untested CSS escape \\${run}: …${near}…`);
    if (run.length > 6) out.push(`CSS escape \\${run} does not end unambiguously: …${near}…`);
    i = j - 1;
  }
  return out;
}

/**
 * Decodes CSS hex escapes as the CSS syntax does (backslash, 1 to 6 hex digits, one optional
 * whitespace as terminator). Used to prove that `cssAscii` is lossless: decoding its output must
 * give the original CSS back.
 */
export function decodeCssHexEscapes(css: string): string {
  return css.replace(/\\([0-9a-fA-F]{1,6})[ \t\n]?/g, (_m, h: string) =>
    String.fromCodePoint(Number.parseInt(h, 16)),
  );
}

export interface Problem {
  index: number;
  kind: 'char' | 'control-escape' | 'escape';
  text: string;
}

/**
 * Everything in a text that is not transport-safe:
 * - a character other than 0x0A and 0x20…0x7E,
 * - a backslash directly before n, r or t (anywhere, also as the second half of "\\"),
 * - an escape other than \uXXXX (4 hex digits), \\, \/, \., \{, \}, \d, \s, \w, \B,
 *   including a backslash at the very end.
 */
export function transportProblems(text: string, max = 20): Problem[] {
  const out: Problem[] = [];
  const near = (i: number) => text.slice(Math.max(0, i - 30), i + 30);
  for (let i = 0; i < text.length && out.length < max; i++) {
    const code = text.charCodeAt(i);
    if (code !== 0x0a && (code < 0x20 || code > 0x7e)) {
      out.push({ index: i, kind: 'char', text: `U+${hex4(code).toUpperCase()} …${near(i)}…` });
    }
  }
  for (const m of text.matchAll(/\\[nrt]/g)) {
    if (out.length >= max) break;
    out.push({ index: m.index!, kind: 'control-escape', text: `…${near(m.index!)}…` });
  }
  for (let i = 0; i < text.length && out.length < max; i++) {
    if (text[i] !== '\\') continue;
    const c = text[i + 1] ?? '';
    if (c === 'u' && /^[0-9a-fA-F]{4}$/.test(text.slice(i + 2, i + 6))) {
      i += 5;
      continue;
    }
    if (SAFE_ESCAPES.has(c)) {
      i += 1;
      continue;
    }
    if (!/[nrt]/.test(c)) {
      const what = c === '' ? 'backslash at the end' : `\\${c}`;
      out.push({ index: i, kind: 'escape', text: `${what} …${near(i)}…` });
    }
    i += 1;
  }
  return out.sort((a, b) => a.index - b.index);
}

/**
 * Simulates the mail transport: backslash + n becomes a line feed. The worst case also turns
 * backslash + r into a carriage return and backslash + t into a tab.
 */
export function simulateMail(text: string, worstCase = false): string {
  let s = text.replace(/\\n/g, '\n');
  if (worstCase) s = s.replace(/\\r/g, '\r').replace(/\\t/g, '\t');
  return s;
}
