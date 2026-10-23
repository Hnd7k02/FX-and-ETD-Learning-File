/**
 * Transport hardening for the single offline file (DECISIONS D-41).
 *
 * The file travels by e-mail to the work PC. On the way, the two characters backslash + "n"
 * turned into a real line break: one such escape in the main script was a SyntaxError and the
 * page stayed at "loading". A mail test showed which escapes arrive intact. This module
 * - rewrites every escape in the inline scripts into a form that arrived intact (`rewriteJsEscapes`),
 * - turns non-ASCII text into ASCII for HTML (`htmlAscii`) and CSS (`cssAscii`),
 * - lists everything in the finished file that is not transport-safe (`transportProblems`),
 * - simulates the transport for the tests (`simulateMail`).
 *
 * The file may contain only 0x0A and 0x20…0x7E. Escapes that are known to survive:
 * \uXXXX (exactly 4 hex digits), \\, \/, \., \{, \}, \d, \s, \w, \B.
 */

/** Escapes that arrived intact in the mail test (the letter after the backslash). */
export const SAFE_ESCAPES = new Set(['\\', '/', '.', '{', '}', 'd', 's', 'w', 'B']);

const HEX = /^[0-9a-fA-F]$/;
const hex4 = (code: number) => code.toString(16).padStart(4, '0');
const u = (code: number) => `\\u${hex4(code)}`;

/** Control escapes and the code points they stand for. */
const CONTROL: Record<string, number> = { n: 0x0a, r: 0x0d, t: 0x09, v: 0x0b, f: 0x0c };

/** A code point as one \uXXXX or as a surrogate pair. */
function codePointEscape(cp: number): string {
  if (cp <= 0xffff) return u(cp);
  const v = cp - 0x10000;
  return u(0xd800 + (v >> 10)) + u(0xdc00 + (v & 0x3ff));
}

const isPunct = (c: string) => /^[!-/:-@[-`{-~]$/.test(c);

/**
 * Rewrites the escapes of a JavaScript source into transport-safe forms. Reads backslash pairs
 * from left to right (no global replace), so "\\n" (escaped backslash + n) and "\n" stay apart.
 * Every rewrite has the same meaning in strings, template literals, regular expressions and
 * character classes:
 * - \n \r \t \v \f → \u000a \u000d \u0009 \u000b \u000c
 * - \xHH → \u00HH; \u{…} → \uXXXX or a surrogate pair; \0 (not before a digit) → \u0000
 * - \\ directly before n, r or t → \ (the backslash itself)
 * - escaped punctuation other than \\ \/ \. \{ \} → \u00XX
 * - a raw non-ASCII character → \uXXXX (per UTF-16 unit)
 * Letter escapes such as \d \s \w \B stay. Anything else is left for `transportProblems`.
 */
export function rewriteJsEscapes(src: string): string {
  let out = '';
  let i = 0;
  while (i < src.length) {
    const ch = src[i]!;
    if (ch !== '\\') {
      // non-ASCII left by the bundler (e.g. inside regular expressions): one \uXXXX per UTF-16
      // unit, valid in strings, templates, regular expressions and identifiers
      const code = src.charCodeAt(i);
      out += code > 0x7e ? u(code) : ch;
      i++;
      continue;
    }
    const c = src[i + 1];
    if (c === undefined) {
      out += ch;
      i++;
      continue;
    }
    if (c in CONTROL) {
      out += u(CONTROL[c]!);
      i += 2;
    } else if (c === 'x' && HEX.test(src[i + 2] ?? '') && HEX.test(src[i + 3] ?? '')) {
      out += `\\u00${src.slice(i + 2, i + 4).toLowerCase()}`;
      i += 4;
    } else if (c === 'u' && src[i + 2] === '{') {
      const end = src.indexOf('}', i + 3);
      const cp = Number.parseInt(src.slice(i + 3, end), 16);
      if (end < 0 || !Number.isFinite(cp)) {
        out += '\\u';
        i += 2;
      } else {
        out += codePointEscape(cp);
        i = end + 1;
      }
    } else if (c === '0' && !/[0-9]/.test(src[i + 2] ?? '')) {
      out += u(0);
      i += 2;
    } else if (c === '\\') {
      out += /[nrt]/.test(src[i + 2] ?? '') ? u(0x5c) : '\\\\';
      i += 2;
    } else if (isPunct(c) && !SAFE_ESCAPES.has(c)) {
      out += u(c.charCodeAt(0));
      i += 2;
    } else {
      // \uXXXX, safe escapes, letter escapes: unchanged (checked later)
      out += ch + c;
      i += 2;
    }
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
 * CSS: every non-ASCII character as a CSS escape (\hex, plus a space if a hex digit or a space
 * follows). Only escapes that start with "\d" are transport-safe, so other characters fail.
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
    const h = cp.toString(16);
    if (!h.startsWith('d')) unsafe.push(`U+${hex4(cp).toUpperCase()}`);
    const next = chars[k + 1] ?? '';
    out += `\\${h}${/^[0-9a-fA-F ]$/.test(next) ? ' ' : ''}`;
  });
  return { css: out, unsafe };
}

export interface Problem {
  index: number;
  kind: 'char' | 'control-escape' | 'escape';
  text: string;
}

/**
 * Everything in a finished file that is not transport-safe:
 * - a character other than 0x0A and 0x20…0x7E,
 * - a backslash directly before n, r or t (anywhere, also as the second half of "\\"),
 * - an escape other than \uXXXX (4 hex digits), \\, \/, \., \{, \}, \d, \s, \w, \B.
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
    if (!/[nrt]/.test(c)) out.push({ index: i, kind: 'escape', text: `\\${c} …${near(i)}…` });
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
