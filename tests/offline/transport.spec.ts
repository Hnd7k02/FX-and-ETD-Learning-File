/**
 * Transport hardening of the finished file (DECISIONS D-41): the file survives the mail
 * transport unchanged, its scripts compile before and after it, the CSP allows inline scripts
 * without a hash, the CSS has only tested escapes, special characters arrive on screen, the
 * version is visible, both release files are byte-identical, and a broken copy explains itself.
 */
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Script } from 'node:vm';
import type { Page } from '@playwright/test';
import { scriptBlocks } from '../../scripts/lib/filecheck';
import { decodeCssHexEscapes, simulateMail, transportProblems } from '../../scripts/lib/transport';
import { OFFLINE_VERSION, versionedFileName } from '../../scripts/lib/version';
import { FILE, expect, test } from './fixtures';

const VERSION = OFFLINE_VERSION.number;
const html = () => readFileSync(FILE, 'latin1');
const sha256 = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');

/** Inline scripts with JavaScript (the data block is base64, not code). */
const scripts = (text: string) =>
  scriptBlocks(text).filter((s) => s.type !== 'application/octet-stream');

/** Writes a changed copy of the file to a temporary folder and returns its file:// URL. */
function brokenCopy(change: (text: string) => string): { url: string; dir: string } {
  const dir = mkdtempSync(join(tmpdir(), 'ff-transport-'));
  const file = join(dir, 'forward-first.html');
  writeFileSync(file, change(html()), 'latin1');
  return { url: pathToFileURL(file).href, dir };
}

test.describe('transport', () => {
  test('the file is plain ASCII with tested escapes only', () => {
    const bytes = readFileSync(FILE);
    expect(bytes.every((b) => b === 0x0a || (b >= 0x20 && b <= 0x7e))).toBe(true);
    const text = html();
    expect(transportProblems(text)).toEqual([]);
    expect(text.includes('String.raw')).toBe(false);
  });

  test('the mail simulation changes no byte (\\n, worst case also \\r and \\t)', () => {
    const text = html();
    expect(simulateMail(text) === text).toBe(true);
    expect(simulateMail(text, true) === text).toBe(true);
  });

  test('two classic scripts, no module; both compile before and after the simulation', () => {
    const blocks = scriptBlocks(html());
    expect(blocks.map((b) => [b.id, b.type])).toEqual([
      ['ff-diag', ''],
      ['ff-data', 'application/octet-stream'],
      ['ff-main', ''],
    ]);
    const after = scripts(simulateMail(html(), true));
    for (const s of [...scripts(html()), ...after]) {
      expect(() => new Script(s.content, { filename: s.id }), s.id).not.toThrow();
    }
  });

  test('the diagnostics expects the main script length as written', () => {
    const blocks = scripts(html());
    const diag = blocks.find((b) => b.id === 'ff-diag')!.content;
    const main = blocks.find((b) => b.id === 'ff-main')!.content;
    expect(Number(/lm:(\d+)/.exec(diag)?.[1])).toBe(main.length);
    const data = scriptBlocks(html()).find((b) => b.id === 'ff-data')!.content;
    expect(Number(/ld:(\d+)/.exec(diag)?.[1])).toBe(data.length);
  });

  test('CSS: only the tested escapes \\d7 and \\B7, each ending unambiguously', () => {
    const css = /<style>([\s\S]*?)<\/style>/.exec(html())![1]!;
    const escapes = [...css.matchAll(/\\([0-9a-fA-F]+)([\s\S]?)/g)];
    expect(escapes.length).toBeGreaterThan(0);
    for (const m of escapes) {
      expect(['d7', 'B7']).toContain(m[1]);
      expect(/[0-9a-fA-F]/.test(m[2]!), `after \\${m[1]}`).toBe(false);
    }
    const decoded = decodeCssHexEscapes(css);
    expect(decoded).toContain('content:"×"');
    expect(decoded).toContain('content:"·"');
  });

  test('CSP: inline scripts allowed without a hash, everything else locked', () => {
    const csp = /<meta http-equiv="Content-Security-Policy" content="([^"]+)">/.exec(html())?.[1];
    expect(csp).toContain("script-src 'unsafe-inline'");
    expect(csp).not.toContain('sha256');
    for (const rule of [
      "default-src 'none'",
      "connect-src 'none'",
      "object-src 'none'",
      "frame-src 'none'",
      "worker-src 'none'",
      "base-uri 'none'",
      "form-action 'none'",
    ]) {
      expect(csp).toContain(rule);
    }
  });

  test('version in the loading text and on the About page; both files byte-identical', async ({
    page,
    open,
  }) => {
    const text = html();
    expect(text).toContain(`<meta name="ff-version" content="${VERSION}">`);
    expect(
      new RegExp(
        `id="ff-loading"[^>]*>Forward First ${VERSION} \\(\\d{2}\\.\\d{2}\\.\\d{4}\\) wird geladen`,
      ).test(text),
    ).toBe(true);
    const copy = join(dirname(FILE), versionedFileName());
    expect(sha256(copy)).toBe(sha256(FILE));

    await open('/ueber/');
    await expect(page.locator('[data-ff-version]')).toHaveText(
      new RegExp(`^Offline-Datei Version ${VERSION} vom \\d{2}\\.\\d{2}\\.\\d{4}$`),
    );
    await open('/en/about/');
    await expect(page.locator('[data-ff-version]')).toHaveText(
      new RegExp(`^Offline file version ${VERSION} of `),
    );
  });

  test('ready flags and no diagnostics box when the app starts', async ({ page, open }) => {
    await open();
    const flags = await page.evaluate(() => {
      const w = window as unknown as { __FF_OFFLINE__?: boolean; __FF_READY__?: boolean };
      return [w.__FF_OFFLINE__, w.__FF_READY__];
    });
    expect(flags).toEqual([true, true]);
    await page.waitForTimeout(4500);
    await expect(page.locator('#ff-diagnose')).toHaveCount(0);
  });

  test('main script broken in transport: box with both flags, no path', async ({ page, guard }) => {
    // Version 1 failure: one "\n" in the main script became a line break
    const { url, dir } = brokenCopy((text) => {
      const broken = text.replace(
        /(<script id="ff-main">[\s\S]*?)\\u000a/,
        (_m, head: string) => `${head}\n`,
      );
      expect(broken.length).toBe(text.length - 5);
      return broken;
    });
    await page.goto(url);
    const box = page.locator('#ff-diagnose');
    await expect(box).toBeVisible({ timeout: 8000 });
    await expect(box).toContainText(`Forward First ${VERSION}`);
    await expect(box).toContainText('main script started (__FF_OFFLINE__): nein / no');
    await expect(box).toContainText('interface ready (__FF_READY__): nein / no');
    await expect(box).toContainText(/Hauptskript \/ main script: \d+ \(Build \d+\) ABWEICHUNG/);
    await expect(box).toContainText(/Datenblock \/ data block: \d+ \(Build \d+\) OK/);
    await expect(box).toContainText('Ort / location: lokal / local');
    await expect(box).toContainText('JS-Fehler / JS errors:');
    expect(await box.textContent()).not.toContain(dir);
    expect(await box.textContent()).not.toContain('forward-first.html');
    // the syntax error is the point of this test
    guard.errors.length = 0;
  });

  test('data block broken in transport: main script started, interface not ready', async ({
    page,
    guard,
  }) => {
    const { url } = brokenCopy((text) =>
      text.replace(/(<script id="ff-data" type="application\/octet-stream">)(.{40})/, '$1'),
    );
    await page.goto(url);
    const box = page.locator('#ff-diagnose');
    await expect(box).toBeVisible({ timeout: 8000 });
    await expect(box).toContainText('main script started (__FF_OFFLINE__): ja / yes');
    await expect(box).toContainText('interface ready (__FF_READY__): nein / no');
    await expect(box).toContainText(/Datenblock \/ data block: \d+ \(Build \d+\) ABWEICHUNG/);
    await expect(box).toContainText(/Hauptskript \/ main script: \d+ \(Build \d+\) OK/);
    guard.errors.length = 0;
  });
});

/**
 * Text of the page (decoded characters, also inside closed derivations) and the CSS content of a
 * ::before pseudo-element.
 */
async function shown(page: Page, route: string, before: string) {
  // a hash change keeps the old #main[data-route] until the new page is swapped in
  await page.waitForFunction((r) => document.getElementById('main')?.dataset.route === r, route);
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    return {
      text: document.getElementById('main')!.textContent ?? '',
      before: el ? getComputedStyle(el, '::before').content : null,
    };
  }, before);
}

test.describe('special characters on screen', () => {
  const BROKEN = /[�]|Ã|Â|&#\d+;/;

  test('DE: umlauts, «», ’, Δ, σ and × · from CSS', async ({ page, open }) => {
    await open('/module/01-spot/1/');
    let s = await shown(page, '/module/01-spot/1/', 'body');
    for (const ch of ['ä', 'ö', 'ü', '’', 'Δ', 'σ']) expect(s.text, ch).toContain(ch);
    expect(s.text).not.toMatch(BROKEN);

    await open('/glossar/');
    s = await shown(page, '/glossar/', '.gl-see li + li');
    for (const ch of ['ä', 'ö', 'ü', '«', '»', 'Δ']) expect(s.text, ch).toContain(ch);
    expect(s.before).toBe('"·"');
    expect(s.text).not.toMatch(BROKEN);

    await open('/ueber/');
    s = await shown(page, '/ueber/', '.ab-not li');
    expect(s.before).toBe('"×"');
    expect(s.text).not.toMatch(BROKEN);
  });

  test('EN: umlauts, «», ’, Δ, σ and × · from CSS', async ({ page, open }) => {
    await open('/en/about/');
    let s = await shown(page, '/en/about/', '.ab-not li');
    for (const ch of ['ä', 'ö', 'ü', '«', '»', '’', 'Δ', 'σ']) expect(s.text, ch).toContain(ch);
    expect(s.before).toBe('"×"');
    expect(s.text).not.toMatch(BROKEN);

    await open('/en/glossary/');
    s = await shown(page, '/en/glossary/', '.gl-see li + li');
    expect(s.before).toBe('"·"');
    expect(s.text).not.toMatch(BROKEN);
  });
});
