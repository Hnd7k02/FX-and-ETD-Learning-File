/**
 * Transport hardening of the finished file (DECISIONS D-41): the file survives the mail
 * transport unchanged, its scripts compile before and after it, the CSP allows inline scripts
 * without a hash, the version is visible, and a broken copy explains itself.
 */
import { mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Script } from 'node:vm';
import { simulateMail, transportProblems } from '../../scripts/lib/transport';
import { FILE, expect, test } from './fixtures';

const VERSION = 5;
const html = () => readFileSync(FILE, 'utf8');

/** Inline scripts with JavaScript (the data block is base64, not code). */
function scripts(text: string): { id: string; code: string }[] {
  return [...text.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)]
    .filter((m) => !/type="application\/octet-stream"/.test(m[1]!))
    .map((m) => ({ id: /id="([^"]+)"/.exec(m[1]!)?.[1] ?? '?', code: m[2]! }));
}

test.describe('transport', () => {
  test('the file is plain ASCII with tested escapes only', () => {
    const text = html();
    expect(transportProblems(text)).toEqual([]);
    expect(/[^\n -~]/.test(text)).toBe(false);
    expect(text.includes('String.raw')).toBe(false);
  });

  test('the mail simulation changes no byte (\\n, worst case also \\r and \\t)', () => {
    const text = html();
    expect(simulateMail(text) === text).toBe(true);
    expect(simulateMail(text, true) === text).toBe(true);
  });

  test('every inline script compiles before and after the simulation', () => {
    const before = scripts(html());
    expect(before.map((s) => s.id)).toEqual(['ff-diag', 'ff-main']);
    const after = scripts(simulateMail(html(), true));
    for (const s of [...before, ...after]) {
      expect(() => new Script(s.code, { filename: s.id }), s.id).not.toThrow();
    }
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

  test('version in the loading text, in the copy and on the About page', async ({ page, open }) => {
    const text = html();
    expect(text).toContain(`<meta name="ff-version" content="${VERSION}">`);
    expect(
      /id="ff-loading"[^>]*>Forward First 5 \(\d{2}\.\d{2}\.\d{4}\) wird geladen/.test(text),
    ).toBe(true);
    const copy = FILE.replace(/forward-first\.html$/, `forward-first-v${VERSION}.html`);
    expect(statSync(copy).size).toBe(statSync(FILE).size);
    expect(readFileSync(copy, 'utf8') === text).toBe(true);

    await open('/ueber/');
    await expect(page.locator('[data-ff-version]')).toHaveText(
      /^Offline-Datei Version 5 vom \d{2}\.\d{2}\.\d{4}$/,
    );
    await open('/en/about/');
    await expect(page.locator('[data-ff-version]')).toHaveText(/^Offline file version 5 of /);
  });

  test('no diagnostics box when the app starts', async ({ page, open }) => {
    await open();
    await page.waitForTimeout(4500);
    await expect(page.locator('#ff-diagnose')).toHaveCount(0);
  });

  test('a copy broken in transport shows the diagnostics box', async ({ page, guard }) => {
    // Version 1 failure: one "\n" in the main script became a line break
    const text = html();
    const broken = text.replace(
      /(<script id="ff-main">[\s\S]*?)\\u000a/,
      (_m, head: string) => `${head}\n`,
    );
    expect(broken.length).toBe(text.length - 5);
    const dir = mkdtempSync(join(tmpdir(), 'ff-transport-'));
    const file = join(dir, 'forward-first.html');
    writeFileSync(file, broken);
    await page.goto(pathToFileURL(file).href);
    const box = page.locator('#ff-diagnose');
    await expect(box).toBeVisible({ timeout: 8000 });
    await expect(box).toContainText('Forward First 5');
    await expect(box).toContainText('main script started: nein / no');
    await expect(box).toContainText(/Hauptskript \/ main script: \d+ \(Build \d+\) ABWEICHUNG/);
    await expect(box).toContainText(/Datenblock \/ data block: \d+ \(Build \d+\) OK/);
    await expect(box).toContainText('JS-Fehler / JS errors:');
    // the syntax error is the point of this test
    guard.errors.length = 0;
  });
});
