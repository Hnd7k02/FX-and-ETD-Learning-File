/**
 * Transport hardening (DECISIONS D-41, supplement points 1 to 5): the escape scanner rewrites
 * only \n \r \t \v \f, \xHH and an escaped backslash before n, r or t; it keeps the meaning in
 * every context (proved with acorn + regexpp and by running the code); everything else that is
 * not on the tested list stops the build; the final check runs on the file bytes.
 */
import { runInNewContext, Script } from 'node:vm';
import { transformSync, type TransformOptions } from 'esbuild';
import { describe, expect, it } from 'vitest';
import { fileProblems, scriptBlocks } from '../../scripts/lib/filecheck';
import { scriptSemanticsDiff } from '../../scripts/lib/semantics';
import {
  cssAscii,
  cssEscapeProblems,
  decodeCssHexEscapes,
  htmlAscii,
  rewriteJsEscapes,
  simulateMail,
  transportProblems,
} from '../../scripts/lib/transport';
import { buildDate, OFFLINE_VERSION, versionedFileName } from '../../scripts/lib/version';

/** Evaluates an expression in a fresh context. */
const run = (expr: string): unknown => runInNewContext(`(${expr})`);

/**
 * Rewrites and checks that the result is transport-safe and means the same. The proof parses the
 * expression in parentheses, so a lone string is a value and not a directive.
 */
function rewriteChecked(src: string): string {
  const out = rewriteJsEscapes(src);
  expect(transportProblems(out), out).toEqual([]);
  expect(simulateMail(out, true), out).toBe(out);
  expect(scriptSemanticsDiff(`(${src})`, `(${out})`), `${src} → ${out}`).toBeNull();
  return out;
}

/* Rules × contexts ------------------------------------------------------------------------- */

/** Escape bodies as written in source (String.raw keeps the backslashes). */
const RULES: Record<string, string> = {
  'newline, return, tab, vertical tab, form feed': String.raw`\n\r\t\v\f`,
  'hex escapes (lower and upper case)': String.raw`\x41\x7e\xE4`,
  'escaped backslash before n, r, t': String.raw`\\n\\r\\t`,
  'escaped backslash + n': String.raw`\\n`,
  'escaped backslash + newline escape': String.raw`\\\n`,
  'two escaped backslashes + n': String.raw`\\\\n`,
  'two escaped backslashes + newline escape': String.raw`\\\\\n`,
  'surrogate pair stays': String.raw`\ud83d\ude00`,
};

const CONTEXTS: Record<string, (body: string) => string> = {
  string: (b) => `"${b}"`,
  template: (b) => `\`${b}\``,
  'regex without flag': (b) => `/${b}/`,
  'regex u': (b) => `/${b}/u`,
  'regex v': (b) => `/${b}/v`,
  'character class': (b) => `/[${b}]/`,
  'character class u': (b) => `/[${b}]/u`,
  'character class v': (b) => `/[${b}]/v`,
};

/** Strings every regex fixture is tested against. */
const PROBES = [
  '\n',
  '\r',
  '\t',
  '\v',
  '\f',
  'A',
  '~',
  'ä',
  '\\',
  'n',
  'r',
  't',
  '\\n',
  '\\r\\t',
  '\\\n',
  '\\\\n',
  '\\\\\n',
  '\ud83d\ude00',
  'x',
];

/** Comparable runtime value: strings as they are, regexes by flags and by what they match. */
function behaviour(expr: string): unknown {
  const v = run(expr);
  // the value comes from another realm: instanceof RegExp would be false
  if (Object.prototype.toString.call(v) === '[object RegExp]') {
    const re = v as RegExp;
    return { flags: re.flags, matches: PROBES.map((p) => re.test(p)) };
  }
  return v;
}

describe('rewriteJsEscapes: every rule in every context', () => {
  for (const [rule, body] of Object.entries(RULES)) {
    for (const [ctx, wrap] of Object.entries(CONTEXTS)) {
      it(`${rule} in ${ctx}`, () => {
        const src = wrap(body);
        const out = rewriteChecked(src);
        expect(behaviour(out)).toEqual(behaviour(src));
      });
    }
  }
});

describe('rewriteJsEscapes: exact output', () => {
  it('control escapes become \\u000X', () => {
    expect(rewriteJsEscapes(String.raw`"\n\r\t\v\f"`)).toBe(
      String.raw`"\u000a\u000d\u0009\u000b\u000c"`,
    );
  });
  it('\\xHH becomes \\u00hh', () => {
    expect(rewriteJsEscapes(String.raw`"\x41\xE4"`)).toBe(String.raw`"\u0041\u00e4"`);
  });
  it('nested backslashes are read in pairs from the left', () => {
    expect(rewriteJsEscapes(String.raw`"\\n"`)).toBe(String.raw`"\u005cn"`);
    expect(rewriteJsEscapes(String.raw`"\\\n"`)).toBe(String.raw`"\\\u000a"`);
    expect(rewriteJsEscapes(String.raw`"\\\\n"`)).toBe(String.raw`"\\\u005cn"`);
    expect(rewriteJsEscapes(String.raw`"\\x"`)).toBe(String.raw`"\\x"`);
    expect(rewriteJsEscapes(String.raw`"\\\\"`)).toBe(String.raw`"\\\\"`);
  });
  it('tested escapes and surrogate pairs stay as they are', () => {
    const safe = String.raw`/\d\s\w\B\/\.\{\}\\\u00e9/.test("\ud83d\ude00")`;
    expect(rewriteJsEscapes(safe)).toBe(safe);
  });
  it('an escape at the very end of the input', () => {
    expect(rewriteJsEscapes(String.raw`a\n`)).toBe(String.raw`a\u000a`);
    expect(rewriteJsEscapes(String.raw`a\x41`)).toBe(String.raw`a\u0041`);
    expect(rewriteJsEscapes(String.raw`a\\`)).toBe(String.raw`a\\`);
    expect(rewriteJsEscapes('a\\')).toBe('a\\');
    expect(rewriteJsEscapes(String.raw`a\x4`)).toBe(String.raw`a\x4`);
  });
  it('keeps the Version 1 word-split regex compilable and equal', () => {
    const v1 = String.raw`"a \t\r\nb".split(/[ \t\r\n]+/).join("|")`;
    const out = rewriteChecked(v1);
    expect(run(out)).toBe('a|b');
    expect(() => new Script(out)).not.toThrow();
  });
});

/* Abort cases ------------------------------------------------------------------------------- */

describe('everything else stops the build', () => {
  const ABORT: Record<string, string> = {
    'back-reference': String.raw`/(a)\1/`,
    'named back-reference': String.raw`/(?<a>x)\k<a>/`,
    'word boundary': String.raw`/\bx/`,
    'backspace in a class': String.raw`/[\b]/`,
    nul: String.raw`"\0"`,
    'code point escape': String.raw`"\u{1F600}"`,
    'code point escape in a u regex': String.raw`/\u{1F600}/u`,
    'property escape': String.raw`/\p{L}/u`,
    'negated classes': String.raw`/\S\D\W/`,
    'escaped punctuation': String.raw`/\(\)\[\]\-\+\*\?\|\^\$/`,
    'escaped quotes': String.raw`'it\'s' + "\"" + ${'`\\``'}`,
    'incomplete unicode escape': String.raw`/\u12/`,
    'incomplete hex escape': String.raw`/\x4/`,
    'line continuation': '"a\\\nb"',
    'trailing backslash': 'a\\',
  };
  for (const [name, src] of Object.entries(ABORT)) {
    it(`${name}: left as it is and reported`, () => {
      const out = rewriteJsEscapes(src);
      expect(out).toBe(src);
      expect(transportProblems(out).map((p) => p.kind)).toContain('escape');
    });
  }

  it('raw characters outside 0x0A and 0x20…0x7E', () => {
    for (const s of ['a\tb', 'a\rb', 'a×b', '/[–]/', '"\ud83d\ude00"']) {
      expect(
        transportProblems(rewriteJsEscapes(s)).map((p) => p.kind),
        s,
      ).toContain('char');
    }
  });

  it('a backslash before n, r or t anywhere, also as the second half of \\\\', () => {
    expect(transportProblems(String.raw`"\n"`).map((p) => p.kind)).toEqual(['control-escape']);
    expect(transportProblems(String.raw`"\\n"`).map((p) => p.kind)).toEqual(['control-escape']);
    expect(transportProblems(String.raw`\r\t`).map((p) => p.kind)).toEqual([
      'control-escape',
      'control-escape',
    ]);
  });

  it('String.raw: a rewritten escape changes what the tag sees, the proof reports it', () => {
    const src = 'String.raw`a\\nb`';
    const diff = scriptSemanticsDiff(src, rewriteJsEscapes(src));
    expect(diff).toContain('raw (tagged template)');
  });

  it('the CSS hex escapes that are not tested', () => {
    expect(transportProblems(String.raw`\b7`).map((p) => p.kind)).toContain('escape');
    expect(transportProblems(String.raw`\2013`).map((p) => p.kind)).toContain('escape');
  });
});

/* Semantics proof --------------------------------------------------------------------------- */

describe('scriptSemanticsDiff', () => {
  it('equal meaning: escapes of the same code points', () => {
    for (const [a, b] of [
      [String.raw`x="\x41\n"`, String.raw`x="\u0041\u000a"`],
      [String.raw`/[\\n]/`, String.raw`/[\u005cn]/`],
      [String.raw`/\x41/v`, String.raw`/A/v`],
      ['`a\\tb${1}`', '`a\\u0009b${1}`'],
      [String.raw`x="\ud83d\ude00"`, String.raw`x="\uD83D\uDE00"`],
    ]) {
      expect(scriptSemanticsDiff(a!, b!), `${a} ~ ${b}`).toBeNull();
    }
  });

  it('reports a changed value, flag, pattern, template or parse error', () => {
    expect(scriptSemanticsDiff('x="a"', 'x="b"')).toContain('value');
    // a directive counts by its raw text ("use\u0020strict" is no use-strict directive)
    expect(scriptSemanticsDiff(String.raw`"a\n";`, String.raw`"a\u000a";`)).toContain('directive');
    expect(scriptSemanticsDiff('/a/', '/a/u')).toContain('flags');
    expect(scriptSemanticsDiff(String.raw`/\x41/`, '/B/')).toContain('regex');
    expect(scriptSemanticsDiff(String.raw`/\bx/`, String.raw`/\u0008x/`)).toContain('regex');
    expect(scriptSemanticsDiff('`a${1}`', '`b${1}`')).toContain('cooked');
    expect(scriptSemanticsDiff('f(1)', 'f(1,)')).toBeNull();
    expect(scriptSemanticsDiff('f(1)', 'g(1)')).toContain('name');
    expect(scriptSemanticsDiff('f(', 'f()')).toContain('original does not parse');
    expect(scriptSemanticsDiff('f()', 'f(')).toContain('rewritten source does not parse');
  });
});

/* esbuild settings -------------------------------------------------------------------------- */

describe('esbuild output (charset ascii, unicode-escapes off)', () => {
  const opts: TransformOptions = {
    charset: 'ascii',
    minify: true,
    supported: { 'unicode-escapes': false },
    target: ['chrome100', 'safari15'],
  };

  it('writes characters above U+FFFF as surrogate pairs, never as \\u{…}', () => {
    const { code } = transformSync('x="\ud83d\ude00 ä";y=`\ud83d\ude00${1}`', opts);
    expect(code).toContain(String.raw`\uD83D\uDE00`);
    expect(code).not.toContain('\\u{');
    const out = rewriteJsEscapes(code);
    expect(transportProblems(out)).toEqual([]);
    expect(scriptSemanticsDiff(code, out)).toBeNull();
  });

  it('leaves non-ASCII raw in regex literals (why Quiz.tsx writes \\u2013 itself)', () => {
    expect(transformSync('y=/[–—]/', opts).code).toContain('–');
    expect(transformSync(String.raw`y=/[\u2013\u2014]/`, opts).code).toContain(
      String.raw`\u2013\u2014`,
    );
  });
});

/* File check -------------------------------------------------------------------------------- */

describe('fileProblems (bytes of the written file)', () => {
  const MAIN = String.raw`window.__FF_OFFLINE__=!0;var a="x\ny\\n",b=/[\t\r\n]+/;`;
  const DIAG = 'var d=1;';
  const CSS = 'a::before{content:"×"}b::after{content:"·a"}';
  const DATA = 'H4sIAAAAAAAA/w==';

  function page(o: { main?: string; diag?: string; data?: string; css?: string; extra?: string }) {
    const main = o.main ?? rewriteJsEscapes(MAIN);
    return [
      '<!doctype html><html><head>',
      `<style>${o.css ?? cssAscii(CSS).css}</style></head><body>`,
      `<script id="ff-diag">${o.diag ?? DIAG}</script>`,
      `<script id="ff-data" type="application/octet-stream">${o.data ?? DATA}</script>`,
      `<script id="ff-main">${main}</script>`,
      o.extra ?? '',
      '</body></html>\n',
    ].join('');
  }
  const bytes = (s: string) => new Uint8Array(Buffer.from(s, 'utf8'));
  const expectations = (lm?: number) => ({
    scripts: { 'ff-diag': DIAG, 'ff-main': MAIN },
    css: CSS,
    lengths: { 'ff-main': lm ?? rewriteJsEscapes(MAIN).length },
  });

  it('passes a correct file', () => {
    expect(fileProblems(bytes(page({})), expectations())).toEqual([]);
  });

  it('finds the scripts with id, type and offset', () => {
    const html = page({});
    const blocks = scriptBlocks(html);
    expect(blocks.map((b) => [b.index, b.id, b.type])).toEqual([
      [0, 'ff-diag', ''],
      [1, 'ff-data', 'application/octet-stream'],
      [2, 'ff-main', ''],
    ]);
    for (const b of blocks) expect(html.slice(b.start, b.start + b.content.length)).toBe(b.content);
  });

  it('a byte outside ASCII', () => {
    expect(fileProblems(bytes(page({ diag: 'var d="×";' })), expectations())[0]).toMatch(
      /^byte 0xc3 at \d+$/,
    );
  });

  it('an ES module', () => {
    const p = fileProblems(
      bytes(page({ extra: '<script type="module">export{}</script>' })),
      expectations(),
    );
    expect(p.join()).toContain('ES module');
  });

  it('the data block is never compiled, but must be base64', () => {
    expect(fileProblems(bytes(page({ data: 'ab+/cd==' })), expectations())).toEqual([]);
    expect(fileProblems(bytes(page({ data: 'not base64!' })), expectations()).join()).toContain(
      'data block is not base64',
    );
  });

  it('an untested escape names the script, the position and the context', () => {
    const p = fileProblems(bytes(page({ diag: String.raw`var d=/\(x\)/;` })), expectations());
    expect(p.join('\n')).toMatch(/script #0 \(ff-diag\) position 7 \(file offset \d+\): escape/);
    expect(p.join('\n')).toContain('meaning changed');
  });

  it('a script that does not compile or means something else', () => {
    expect(fileProblems(bytes(page({ diag: 'var d=;' })), expectations()).join()).toContain(
      'does not compile',
    );
    expect(fileProblems(bytes(page({ diag: 'var d=2;' })), expectations()).join()).toContain(
      'meaning changed',
    );
  });

  it('a length the diagnostics does not expect, a missing or an unknown script', () => {
    expect(fileProblems(bytes(page({})), expectations(1)).join()).toContain('diagnostics expects');
    const noMain = page({}).replace(/<script id="ff-main">[\s\S]*?<\/script>/, '');
    expect(fileProblems(bytes(noMain), expectations()).join()).toContain('ff-main missing');
    expect(
      fileProblems(bytes(page({ extra: '<script id="x">1</script>' })), expectations()).join(),
    ).toContain('no esbuild output');
  });

  it('a control escape in the markup and the mail simulation', () => {
    const p = fileProblems(bytes(page({ extra: String.raw`<p>a\nb</p>` })), expectations());
    expect(p.join()).toContain('control-escape');
    expect(p.join()).toContain('mail simulation');
  });

  it('CSS: an untested escape and an escape that does not end where it should', () => {
    expect(
      fileProblems(bytes(page({ css: String.raw`a::before{content:"\2013"}` })), {
        ...expectations(),
        css: 'a::before{content:"–"}',
      }).join(),
    ).toContain('untested CSS escape');
    // "\d7a" reads as U+0D7A, not as "×" + "a"
    expect(
      fileProblems(bytes(page({ css: String.raw`b::after{content:"\B7a"}` })), {
        ...expectations(),
        css: 'b::after{content:"·a"}',
      }).join(),
    ).toContain('decoding differs');
  });
});

/* CSS and HTML ------------------------------------------------------------------------------ */

describe('ASCII for CSS and HTML', () => {
  it('cssAscii: only \\d… and \\B…; a space ends the escape before hex digits and whitespace', () => {
    const src = 'a{content:"×"}b{content:"·a"}c{content:"× "}d{content:"·\n"}e{content:"×"}';
    const { css, unsafe } = cssAscii(src);
    expect(unsafe).toEqual([]);
    expect(css).toBe(
      String.raw`a{content:"\d7"}b{content:"\B7 a"}c{content:"\d7  "}d{content:"\B7 ` +
        '\n' +
        String.raw`"}e{content:"\d7"}`,
    );
    expect(decodeCssHexEscapes(css)).toBe(src);
    expect(cssEscapeProblems(css)).toEqual([]);
    expect(transportProblems(css)).toEqual([]);
  });

  it('cssAscii: every other character is reported, tab and return become a space', () => {
    expect(cssAscii('a{content:"–"}').unsafe).toEqual(['U+2013']);
    expect(cssAscii('a{content:"’"}').unsafe).toEqual(['U+2019']);
    expect(cssAscii('a{\tb:c\r}').css).toBe('a{ b:c }');
  });

  it('cssEscapeProblems: untested start or more than six hex digits', () => {
    expect(cssEscapeProblems(String.raw`\2013`)[0]).toContain('untested');
    expect(cssEscapeProblems(String.raw`\d7`)).toEqual([]);
    expect(cssEscapeProblems(String.raw`\B7`)).toEqual([]);
    expect(cssEscapeProblems(String.raw`\d70000a`).join()).toContain('does not end');
    expect(cssEscapeProblems(String.raw`\\d7`)).toEqual([]);
  });

  it('htmlAscii writes numeric references', () => {
    expect(htmlAscii('Grüezi – «CHF» ’ Δσ \ud83d\ude00')).toBe(
      'Gr&#252;ezi &#8211; &#171;CHF&#187; &#8217; &#916;&#963; &#128512;',
    );
  });
});

/* Mail simulation, version ------------------------------------------------------------------ */

describe('simulateMail', () => {
  it('turns backslash + n into a line feed; the worst case also \\r and \\t', () => {
    expect(simulateMail(String.raw`a\nb\rc\td`)).toBe('a\n' + String.raw`b\rc\td`);
    expect(simulateMail(String.raw`a\nb\rc\td`, true)).toBe('a\nb\rc\td');
  });

  it('breaks the Version 1 word-split regex, but not its rewritten form', () => {
    const v1 = String.raw`"a b".split(/[ \t\r\n]+/)`;
    expect(() => new Script(simulateMail(v1, true))).toThrow();
    const v5 = rewriteJsEscapes(v1);
    expect(simulateMail(v5, true)).toBe(v5);
  });
});

describe('version', () => {
  it('names the copy after the one version number', () => {
    expect(versionedFileName()).toBe(`forward-first-v${OFFLINE_VERSION.number}.html`);
  });

  it('build date in Europe/Zurich, from SOURCE_DATE_EPOCH when set', () => {
    // 22.10.2026 22:30 UTC is already the 23rd in Zurich (CEST, UTC+2)
    expect(buildDate({ SOURCE_DATE_EPOCH: '1792708200' })).toBe('2026-10-23');
    expect(buildDate({ SOURCE_DATE_EPOCH: 'soon' })).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(buildDate({})).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
