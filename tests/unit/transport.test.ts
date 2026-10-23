/**
 * Transport hardening (DECISIONS D-41): the escape scanner keeps the meaning of every script,
 * leaves only tested escapes behind, and the checks find everything the mail transport could
 * change.
 */
import { runInNewContext, Script } from 'node:vm';
import { describe, expect, it } from 'vitest';
import {
  cssAscii,
  htmlAscii,
  rewriteJsEscapes,
  simulateMail,
  transportProblems,
} from '../../scripts/lib/transport';

/** Evaluates an expression in a fresh context. */
const run = (expr: string): unknown => runInNewContext(`(${expr})`);

/**
 * Fixtures as JavaScript source (String.raw keeps the backslashes as written). Each one is an
 * expression whose value must not change when its escapes are rewritten.
 */
const FIXTURES: Record<string, string> = {
  'newline, return, tab, vt, ff': String.raw`"a\nb\rc\td\ve\ff"`,
  'escaped backslash before n, r, t': String.raw`"C:\\new\\road\\table"`,
  'escaped backslash, then newline escape': String.raw`"x\\\ny"`,
  'three backslashes before n': String.raw`"p\\\\n"`,
  'hex and code point escapes': String.raw`"\x41\x7e\u{41}\u{1F600}\u00e9"`,
  nul: String.raw`"a\0b".length`,
  quotes: String.raw`'it\'s' + "\"q\""`,
  'safe escapes stay': String.raw`"a\/b\.c\{d\}"`,
  'word split regex (the Version 1 bug)': String.raw`"a \t\r\nb".split(/[ \t\r\n]+/).join("|")`,
  'regex with escaped backslash before n': String.raw`/\\n/.test("\\n") && !/\\n/.test("\n")`,
  'regex with escaped punctuation': String.raw`/^\(\)\[\]\+\*\?\|\^\$\-\/\.\{\}$/.test("()[]+*?|^$-/.{}")`,
  'character class with escaped hyphen': String.raw`[/[a\-z]/.test("-"), /[a\-z]/.test("b")].join()`,
  'letter escapes stay': String.raw`/^\d\s\w+\B$/.test("1 ab")`,
  'unicode regex with code point': String.raw`/^\u{1F600}$/u.test("\u{1F600}")`,
  'template literal': 'String(`x\\n${1 + 1}\\t\\`y\\` \\${z}`)',
  'raw non-ASCII in a regex': '"a – b".split(/\\s*[–—-]\\s*/).join("|")',
  'raw non-ASCII in a string': '"Grüezi · ×"',
};

describe('rewriteJsEscapes', () => {
  for (const [name, src] of Object.entries(FIXTURES)) {
    it(`keeps the value: ${name}`, () => {
      const out = rewriteJsEscapes(src);
      expect(run(out)).toEqual(run(src));
      expect(transportProblems(out)).toEqual([]);
      expect(simulateMail(out, true)).toBe(out);
    });
  }

  it('writes the expected forms', () => {
    expect(rewriteJsEscapes(String.raw`"\n\r\t\v\f"`)).toBe(
      String.raw`"\u000a\u000d\u0009\u000b\u000c"`,
    );
    expect(rewriteJsEscapes(String.raw`"\x41"`)).toBe(String.raw`"\u0041"`);
    expect(rewriteJsEscapes(String.raw`"\u{1F600}"`)).toBe(String.raw`"\ud83d\ude00"`);
    expect(rewriteJsEscapes(String.raw`"\u{41}"`)).toBe(String.raw`"\u0041"`);
    expect(rewriteJsEscapes(String.raw`"\\n"`)).toBe(String.raw`"\u005cn"`);
    expect(rewriteJsEscapes(String.raw`"\\\n"`)).toBe(String.raw`"\\\u000a"`);
    expect(rewriteJsEscapes(String.raw`"\\x"`)).toBe(String.raw`"\\x"`);
    expect(rewriteJsEscapes(String.raw`/\(\-\)/`)).toBe(String.raw`/\u0028\u002d\u0029/`);
    expect(rewriteJsEscapes(String.raw`/\d\s\w\B\/\.\{\}/`)).toBe(String.raw`/\d\s\w\B\/\.\{\}/`);
    expect(rewriteJsEscapes(String.raw`"\0"`)).toBe(String.raw`"\u0000"`);
    expect(rewriteJsEscapes('"×"')).toBe(String.raw`"\u00d7"`);
  });

  it('leaves untested escapes alone, so the check reports them', () => {
    for (const src of [
      String.raw`/\bx/`,
      String.raw`/\S/`,
      String.raw`/(a)\1/`,
      String.raw`"\08"`,
    ]) {
      const out = rewriteJsEscapes(src);
      expect(out).toBe(src);
      expect(transportProblems(out).map((p) => p.kind)).toContain('escape');
    }
  });

  it('keeps scripts compilable', () => {
    const code = String.raw`function f(s){return s.replace(/[\t\r\n]+/g," ").split(/\\n/)}`;
    expect(() => new Script(rewriteJsEscapes(code))).not.toThrow();
  });
});

describe('transportProblems', () => {
  it('accepts plain ASCII with tested escapes', () => {
    expect(transportProblems(String.raw`a\u00e9 \\ \/ \. \{ \} \d \s \w \B` + '\nb')).toEqual([]);
  });

  it('finds characters outside 0x0A and 0x20…0x7E', () => {
    expect(transportProblems('a\tb').map((p) => p.kind)).toEqual(['char']);
    expect(transportProblems('a\rb').map((p) => p.kind)).toEqual(['char']);
    expect(transportProblems('a×b').map((p) => p.kind)).toEqual(['char']);
  });

  it('finds a backslash before n, r or t anywhere, also after an escaped backslash', () => {
    expect(transportProblems(String.raw`"\n"`).map((p) => p.kind)).toEqual(['control-escape']);
    expect(transportProblems(String.raw`"\\n"`).map((p) => p.kind)).toEqual(['control-escape']);
    expect(transportProblems(String.raw`\r\t`).map((p) => p.kind)).toEqual([
      'control-escape',
      'control-escape',
    ]);
  });

  it('finds escapes outside the tested list', () => {
    for (const s of [
      String.raw`\b`,
      String.raw`\S`,
      String.raw`\D`,
      String.raw`\W`,
      String.raw`\1`,
      String.raw`\k<a>`,
      String.raw`\x41`,
      String.raw`\u12`,
      String.raw`\u{41}`,
      String.raw`\'`,
      String.raw`\b7`,
    ]) {
      expect(
        transportProblems(s).map((p) => p.kind),
        s,
      ).toContain('escape');
    }
  });
});

describe('simulateMail', () => {
  it('turns backslash + n into a line feed; the worst case also \\r and \\t', () => {
    expect(simulateMail(String.raw`a\nb\rc\td`)).toBe(String.raw`a` + '\n' + String.raw`b\rc\td`);
    expect(simulateMail(String.raw`a\nb\rc\td`, true)).toBe('a\nb\rc\td');
  });

  it('breaks the Version 1 word-split regex, but not its rewritten form', () => {
    const v1 = String.raw`"a b".split(/[ \t\r\n]+/)`;
    expect(() => new Script(simulateMail(v1, true))).toThrow();
    const v5 = rewriteJsEscapes(v1);
    expect(simulateMail(v5, true)).toBe(v5);
  });
});

describe('ASCII for HTML and CSS', () => {
  it('htmlAscii writes numeric references', () => {
    expect(htmlAscii('für … 😀\nok')).toBe('f&#252;r &#8230; &#128512;\nok');
  });

  it('cssAscii escapes, adds a space before hex digits and flags unsafe escapes', () => {
    expect(cssAscii('a::before{content:"×"}')).toEqual({
      css: String.raw`a::before{content:"\d7"}`,
      unsafe: [],
    });
    expect(cssAscii('content:"×1"').css).toBe(String.raw`content:"\d7 1"`);
    expect(cssAscii('content:"·"').unsafe).toEqual(['U+00B7']);
    expect(cssAscii('a\tb').css).toBe('a b');
  });
});
