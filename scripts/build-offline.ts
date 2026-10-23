/**
 * Builds release/forward-first.html: ONE self-contained file for the work PC (Chrome/Edge over
 * file://) and the iPad Files app (WebKit). DECISIONS D-13.
 *
 * Input: the static Astro build in dist/ (run `astro build` first; `npm run build` does both).
 * Output: release/forward-first.html with
 * - all pages (DE + EN) as gzip + base64 data block, unpacked at runtime (fflate),
 * - all CSS inline, fonts as woff2 data URIs (Latin and Greek subsets only),
 * - one IIFE script (esbuild) with Preact, every island, the page scripts and the hash router,
 * - a Content-Security-Policy that allows no network request at all,
 * - a small start-diagnostics script (src/offline/diagnose.ts).
 * No external files, no network. Fails if the file exceeds 5 MB, warns above 3 MB.
 *
 * Transport hardening (DECISIONS D-41): the file travels by e-mail, where backslash + n turned
 * into a line break once. The whole file is plain ASCII (0x0A, 0x20…0x7E), every escape in the
 * scripts is rewritten into a form that arrived intact (scripts/lib/transport.ts), the CSP allows
 * inline scripts instead of a hash (a changed character must not block the script silently), and
 * the build fails if anything unsafe is left.
 */
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { build, type Plugin } from 'esbuild';
import { fmtDate } from '../src/lib/format';
import { fileProblems } from './lib/filecheck';
import { cssAscii, htmlAscii, rewriteJsEscapes } from './lib/transport';
import { buildDate, OFFLINE_VERSION, versionedFileName } from './lib/version';

const ROOT = process.cwd();
const DIST = join(ROOT, 'dist');
const OUT_DIR = join(ROOT, 'release');
const OUT = join(OUT_DIR, 'forward-first.html');
const OUT_VERSIONED = join(OUT_DIR, versionedFileName());
const OUT_TMP = join(OUT_DIR, '.forward-first.tmp.html');
const MB = 1024 * 1024;
const TARGET_BYTES = 3 * MB;
const MAX_BYTES = 5 * MB;

/** Font files that are embedded (fontsource subsets); every other @font-face is dropped. */
const FONT_KEEP = [
  /^plus-jakarta-sans-latin-(400|500|600|700|800)-normal$/,
  /^jetbrains-mono-latin-(500|600)-normal$/,
  /^stix-two-text-(latin|greek)-(400|500)-(normal|italic)$/,
];

type Lang = 'de' | 'en';
interface PageRec {
  t: string;
  l: Lang;
  f?: string;
  w: 0 | 1;
  h: string;
}

const log = (...a: unknown[]) => console.log('[offline]', ...a);
const fail = (msg: string): never => {
  console.error(`[offline] ERROR: ${msg}`);
  process.exit(1);
};

/* ---------------------------------------------------------------------------------------- */

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith('.html')) out.push(p);
  }
  return out;
}

function routeOf(file: string): string {
  const rel = relative(DIST, file).split('\\').join('/');
  if (rel === '404.html') return '/404/';
  return `/${rel.replace(/index\.html$/, '')}`;
}

const decodeEntities = (s: string) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&');

function attr(tag: string, name: string): string | undefined {
  const m = new RegExp(`\\s${name}="([^"]*)"`).exec(tag);
  return m ? m[1] : undefined;
}

/** Inner HTML of <div id="main" …> (up to the closing tag before the footer). */
function extractMain(html: string): string {
  const open = html.indexOf('<div id="main"');
  if (open < 0) fail('page without <div id="main">');
  const start = html.indexOf('>', open) + 1;
  const footer = html.lastIndexOf('<footer');
  const end = html.lastIndexOf('</div>', footer);
  if (footer < 0 || end < start) fail('cannot find end of main');
  return html.slice(start, end);
}

function extractTop(html: string): string {
  const body = html.indexOf('<body');
  const start = html.indexOf('>', body) + 1;
  const end = html.indexOf('<div id="main"');
  return html.slice(start, end);
}

function extractFooter(html: string): string {
  const s = html.lastIndexOf('<footer');
  const e = html.indexOf('</footer>', s) + '</footer>'.length;
  return html.slice(s, e);
}

/** Links to pages become hash routes so they stay inside the file. */
const rewriteHrefs = (s: string) => s.replace(/href="\/(?!\/)/g, 'href="#/');

/** Cleans a page's main content for the offline file. */
function cleanMain(raw: string, cssOut: Set<string>): string {
  let s = raw;
  // inline styles found in the body move to the global CSS
  s = s.replace(/<style>([\s\S]*?)<\/style>/g, (_m, css: string) => {
    cssOut.add(css);
    return '';
  });
  // Astro's island loader and page scripts are replaced by the offline runtime
  s = s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '');
  // islands render in the browser: drop the pre-rendered markup and loader attributes
  s = s.replace(/(<astro-island\b[^>]*>)[\s\S]*?(<\/astro-island>)/g, (_m, open: string) => {
    const o = open
      .replace(/\scomponent-url="\/_astro\/([A-Za-z0-9_-]+)\.[^"]*"/, ' data-ff-island="$1"')
      .replace(/\srenderer-url="[^"]*"/, '')
      .replace(/\sbefore-hydration-url="[^"]*"/, '')
      .replace(/\sopts="[^"]*"/, '')
      .replace(/\sawait-children(="")?/, '')
      .replace(/\sssr(="")?/, '');
    return `${o}</astro-island>`;
  });
  return rewriteHrefs(s);
}

/* ---------------------------------------------------------------------------------------- */
/* CSS and fonts                                                                             */
/* ---------------------------------------------------------------------------------------- */

function processCss(css: string): string {
  const fontsSeen = new Set<string>();
  const out = css.replace(/@font-face\s*\{[^}]*\}/g, (block) => {
    const m = /url\((?:"|')?\/_astro\/([a-z0-9-]+)\.[A-Za-z0-9_-]+\.woff2(?:"|')?\)/.exec(block);
    if (!m) return '';
    const name = m[1]!;
    if (!FONT_KEEP.some((re) => re.test(name))) return '';
    const file = readdirSync(join(DIST, '_astro')).find(
      (f) => f.startsWith(`${name}.`) && f.endsWith('.woff2'),
    );
    if (!file) fail(`font file for ${name} missing`);
    if (fontsSeen.has(name)) return '';
    fontsSeen.add(name);
    const b64 = readFileSync(join(DIST, '_astro', file!)).toString('base64');
    return block.replace(/src:[^;}]*/, `src:url(data:font/woff2;base64,${b64}) format("woff2")`);
  });
  return out;
}

/* ---------------------------------------------------------------------------------------- */
/* JavaScript bundle                                                                          */
/* ---------------------------------------------------------------------------------------- */

function islandsPlugin(names: string[]): Plugin {
  return {
    name: 'ff-islands',
    setup(b) {
      b.onResolve({ filter: /^virtual:ff-islands$/ }, () => ({
        path: 'ff-islands',
        namespace: 'ff',
      }));
      b.onLoad({ filter: /.*/, namespace: 'ff' }, () => {
        const lines = names.map(
          (n, i) =>
            `import * as I${i} from ${JSON.stringify(resolve(ROOT, 'src/components/islands', `${n}.tsx`))};`,
        );
        const map = names.map((n, i) => `  ${JSON.stringify(n)}: I${i},`).join('\n');
        return {
          contents: `${lines.join('\n')}\nexport const ISLANDS = {\n${map}\n};\n`,
          loader: 'ts',
          resolveDir: ROOT,
        };
      });
    },
  };
}

/** A script as esbuild wrote it and as it goes into the file. */
interface InlineScript {
  original: string;
  js: string;
}

/**
 * esbuild options shared by both scripts. ASCII output; characters above U+FFFF as surrogate
 * pairs (\uD83D\uDE00) instead of the code point form \u{…}, which is not on the tested list.
 */
const ASCII_OUTPUT = {
  charset: 'ascii',
  supported: { 'unicode-escapes': false },
} as const;

async function bundleJs(islandNames: string[]): Promise<InlineScript> {
  const res = await build({
    entryPoints: [join(ROOT, 'src/offline/main.tsx')],
    bundle: true,
    write: false,
    format: 'iife',
    // FF_DEBUG=1 keeps names and line breaks for readable stack traces while debugging.
    minify: process.env.FF_DEBUG !== '1',
    legalComments: 'none',
    // ASCII only: every non-ASCII character becomes an escape (rewritten below)
    ...ASCII_OUTPUT,
    target: ['chrome100', 'edge100', 'safari15'],
    jsx: 'automatic',
    jsxImportSource: 'preact',
    tsconfig: join(ROOT, 'tsconfig.json'),
    define: {
      'process.env.NODE_ENV': '"production"',
      'import.meta.env.DEV': 'false',
      'import.meta.env.PROD': 'true',
      'import.meta.env.SSR': 'false',
    },
    banner: { js: 'window.__FF_OFFLINE__=true;' },
    plugins: [islandsPlugin(islandNames)],
    logLevel: 'warning',
  });
  return inlineScript(res.outputFiles[0]!.text, 'main script');
}

/**
 * Makes a script safe to inline and to send by mail: no "</script" or "<!--" and the few escapes
 * with a transport-safe twin rewritten. No String.raw (the tag sees the raw escapes). Whether the
 * result is transport-safe, compiles and still means the same is checked on the written file
 * (scripts/lib/filecheck.ts).
 */
function inlineScript(code: string, label: string): InlineScript {
  const original = code.trim();
  if (original.includes('String.raw')) fail(`${label} contains String.raw`);
  const js = rewriteJsEscapes(
    original.replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\u0021--'),
  );
  return { original, js };
}

/** Start diagnostics, bundled like the main script with the values measured at build time. */
async function bundleDiagnose(values: { v: number; d: string; ld: number; lm: number }) {
  const res = await build({
    entryPoints: [join(ROOT, 'src/offline/diagnose.ts')],
    bundle: true,
    write: false,
    format: 'iife',
    minify: true,
    legalComments: 'none',
    ...ASCII_OUTPUT,
    target: ['chrome100', 'edge100', 'safari15'],
    define: { __FF_DIAG__: JSON.stringify(values) },
    logLevel: 'warning',
  });
  return inlineScript(res.outputFiles[0]!.text, 'diagnostics script');
}

/** SHA-256 of a file as read from disk (hex). */
const sha256 = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');

/* ---------------------------------------------------------------------------------------- */

async function main(): Promise<void> {
  if (!existsSync(DIST)) fail('dist/ missing — run `astro build` first');
  const files = walk(DIST).filter((f) => !relative(DIST, f).startsWith('_astro'));
  const pages: Record<string, PageRec> = {};
  const aliases: Record<string, string> = {};
  const cssParts: string[] = [];
  const cssSeen = new Set<string>();
  const bodyCss = new Set<string>();
  const islandNames = new Set<string>();
  const chromeHtml: Record<Lang, { top: string; wide?: string; narrow?: string }> = {
    de: { top: '' },
    en: { top: '' },
  };

  for (const file of files.sort()) {
    const html = readFileSync(file, 'utf8');
    const route = routeOf(file);
    const refresh = /<meta http-equiv="refresh" content="\d+;\s*url=([^"]+)"/.exec(html);
    if (refresh) {
      aliases[route] = decodeEntities(refresh[1]!);
      continue;
    }
    const htmlTag = /<html\b[^>]*>/.exec(html)?.[0] ?? '';
    const lang: Lang = attr(htmlTag, 'lang') === 'en' ? 'en' : 'de';
    const family = attr(htmlTag, 'data-family');
    const title = decodeEntities(/<title>([\s\S]*?)<\/title>/.exec(html)?.[1] ?? 'Forward First');
    const footer = extractFooter(html);
    const wide: 0 | 1 = /container-module/.test(/<footer\b[^>]*>/.exec(footer)?.[0] ?? '') ? 0 : 1;

    // CSS: linked files and head <style> blocks, deduplicated in order of appearance
    const head = html.slice(0, html.indexOf('</head>'));
    for (const m of head.matchAll(/<link rel="stylesheet" href="(\/_astro\/[^"]+\.css)"/g)) {
      if (cssSeen.has(m[1]!)) continue;
      cssSeen.add(m[1]!);
      cssParts.push(readFileSync(join(DIST, m[1]!), 'utf8'));
    }
    for (const m of head.matchAll(/<style>([\s\S]*?)<\/style>/g)) {
      if (cssSeen.has(m[1]!)) continue;
      cssSeen.add(m[1]!);
      cssParts.push(m[1]!);
    }

    const mainHtml = cleanMain(extractMain(html), bodyCss);
    for (const m of mainHtml.matchAll(/data-ff-island="([A-Za-z0-9_-]+)"/g)) {
      islandNames.add(m[1]!);
    }
    pages[route] = { t: title, l: lang, ...(family ? { f: family } : {}), w: wide, h: mainHtml };

    if (!chromeHtml[lang].top && (route === '/' || route === '/en/')) {
      chromeHtml[lang].top = rewriteHrefs(
        extractTop(html).replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, ''),
      );
    }
    if (wide && !chromeHtml[lang].wide) chromeHtml[lang].wide = rewriteHrefs(footer);
    if (!wide && !chromeHtml[lang].narrow) chromeHtml[lang].narrow = rewriteHrefs(footer);
  }
  if (!pages['/'] || !pages['/en/']) fail('home pages missing');
  if (!pages['/404/']) fail('404 page missing');
  if (!pages['/en/404/']) aliases['/en/404/'] = '/404/';
  for (const l of ['de', 'en'] as const) {
    const c = chromeHtml[l];
    if (!c.top || !c.wide || !c.narrow) fail(`chrome for ${l} incomplete`);
  }
  for (const [from, to] of Object.entries(aliases)) {
    if (!pages[to]) fail(`alias ${from} → ${to} has no page`);
  }

  // leftovers that would need the network
  for (const [route, p] of Object.entries(pages)) {
    const bad = /(?:src|href)="\/(?!\/)|\/_astro\//.exec(p.h);
    if (bad)
      fail(`external reference left in ${route}: …${p.h.slice(bad.index - 40, bad.index + 60)}…`);
  }

  const cssSource = processCss([...cssParts, ...bodyCss].join('\n'));
  const cssAsciiResult = cssAscii(cssSource);
  const css = cssAsciiResult.css;
  if (/url\(\s*(?!["']?data:)/.test(css)) fail('CSS still references external files');
  if (cssAsciiResult.unsafe.length)
    fail(`CSS characters without a transport-safe escape: ${cssAsciiResult.unsafe.join(', ')}`);

  const names = [...islandNames].sort();
  for (const n of names) {
    if (!existsSync(join(ROOT, 'src/components/islands', `${n}.tsx`)))
      fail(`island source ${n}.tsx not found`);
  }
  const main = await bundleJs(names);
  const js = main.js;

  const riskometer = JSON.parse(
    readFileSync(join(ROOT, 'src/data/fx/riskometer.json'), 'utf8'),
  ) as {
    asOf: string;
  };
  const built = buildDate();
  const version = { number: OFFLINE_VERSION.number, date: built };
  const versionLabel = `${OFFLINE_VERSION.number} (${fmtDate(built, 'de')})`;
  const data = {
    asOf: riskometer.asOf,
    built,
    version,
    pages,
    aliases,
    chrome: {
      de: { top: chromeHtml.de.top, footer: [chromeHtml.de.wide, chromeHtml.de.narrow] },
      en: { top: chromeHtml.en.top, footer: [chromeHtml.en.wide, chromeHtml.en.narrow] },
    },
  };
  const json = JSON.stringify(data);
  const packed = gzipSync(Buffer.from(json, 'utf8'), { level: 9 }).toString('base64');

  const csp = [
    "default-src 'none'",
    // inline scripts instead of a hash: a character changed in transport must not block the
    // script silently (D-41); everything else stays locked
    "script-src 'unsafe-inline'",
    "style-src 'unsafe-inline'",
    'img-src data:',
    'font-src data:',
    "connect-src 'none'",
    "media-src 'none'",
    "object-src 'none'",
    "frame-src 'none'",
    "worker-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ');
  const icon =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 36 36'%3E%3Crect width='36' height='36' rx='11' fill='%230E1116'/%3E%3Cpath d='M8.3 25.9H19.6L30.6 12.6' fill='none' stroke='%23fff' stroke-width='3.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E";

  const diagnose = await bundleDiagnose({
    v: OFFLINE_VERSION.number,
    d: fmtDate(built, 'de'),
    ld: packed.length,
    lm: js.length,
  });
  const description = htmlAscii(
    'Forward First: ein interaktives Lerntool für den Devisenmarkt. Offline-Datei, nur zu Bildungszwecken.',
  );
  const loading = htmlAscii(
    `Forward First ${versionLabel} wird geladen … Falls nichts erscheint: Datei in Chrome, Edge oder Safari öffnen und JavaScript erlauben. / Loading … If nothing appears, open the file in Chrome, Edge or Safari with JavaScript enabled.`,
  );

  const html = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="referrer" content="no-referrer">
<meta name="description" content="${description}">
<meta name="ff-data-as-of" content="${riskometer.asOf}">
<meta name="ff-built" content="${built}">
<meta name="ff-version" content="${OFFLINE_VERSION.number}">
<title>Forward First</title>
<link rel="icon" href="${icon}">
<style>${css}</style>
</head>
<body>
<div id="ff-top"></div>
<div id="main" tabindex="-1"><p class="container" id="ff-loading" style="padding:48px 16px;font-family:system-ui,sans-serif">${loading}</p></div>
<div id="ff-bottom"></div>
<div id="ff-announcer" class="sr-only" aria-live="polite"></div>
<script id="ff-diag">${diagnose.js}</script>
<script id="ff-data" type="application/octet-stream">${packed}</script>
<script id="ff-main">${js}</script>
</body>
</html>
`;

  // Write to a temporary file and check the bytes read back from disk (D-41): ASCII only, only
  // tested escapes, mail simulation without effect, no ES module, classic scripts compile and
  // mean the same as the esbuild output, CSS decodes to its source, lengths as the diagnostics
  // expects them. Only then the release files are replaced.
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_TMP, html);
  const problems = fileProblems(readFileSync(OUT_TMP), {
    scripts: { 'ff-diag': diagnose.original, 'ff-main': main.original },
    css: cssSource,
    lengths: { 'ff-main': js.length },
  });
  if (problems.length) {
    rmSync(OUT_TMP, { force: true });
    fail(`file is not transport-safe:\n${problems.map((p) => `  ${p}`).join('\n')}`);
  }
  renameSync(OUT_TMP, OUT);
  copyFileSync(OUT, OUT_VERSIONED);
  const hash = sha256(OUT);
  if (sha256(OUT_VERSIONED) !== hash)
    fail(`${basename(OUT_VERSIONED)} differs from ${basename(OUT)}`);
  const size = statSync(OUT).size;
  const kb = (n: number) => `${(n / 1024).toFixed(0)} KB`;
  log(
    `pages ${Object.keys(pages).length}, aliases ${Object.keys(aliases).length}, islands ${names.length}`,
  );
  log(
    `css ${kb(css.length)} · js ${kb(Buffer.byteLength(js))} · data ${kb(packed.length)} (json ${kb(json.length)})`,
  );
  log(`${basename(OUT)}: ${(size / MB).toFixed(2)} MB → ${relative(ROOT, OUT)}`);
  log(`version ${versionLabel} · copy ${relative(ROOT, OUT_VERSIONED)} · transport check passed`);
  log(`sha256 ${hash} (both files)`);
  if (size > MAX_BYTES) fail(`file is larger than 5 MB`);
  if (size > TARGET_BYTES) console.warn('[offline] WARNING: file is larger than the 3 MB target');
}

main().catch((e) => fail(e instanceof Error ? (e.stack ?? e.message) : String(e)));
