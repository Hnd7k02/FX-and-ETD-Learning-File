/**
 * Shared setup for the offline file tests.
 *
 * - `open(route)` loads release/forward-first.html over file:// with a hash route.
 * - Every request that is not file:, data: or blob: fails the test. The network itself is blocked
 *   by the config (dead proxy, Chromium offline mode); no interception, which breaks file:// in WebKit.
 * - Console errors and uncaught page errors (incl. CSP violations) fail the test.
 * - `routes()` lists every page packed into the file (read from its data block).
 */
import { expect, test as base, type Page } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';

export const FILE = resolve('release/forward-first.html');
export const FILE_URL = pathToFileURL(FILE).href;

const LOCAL = /^(file|data|blob|about):/;

interface Guard {
  requests: string[];
  errors: string[];
}

export const test = base.extend<{
  guard: Guard;
  open: (route?: string) => Promise<void>;
}>({
  guard: [
    async ({ page }, use) => {
      if (!existsSync(FILE)) throw new Error(`${FILE} missing: run npm run build first`);
      const guard: Guard = { requests: [], errors: [] };
      page.on('request', (req) => {
        if (!LOCAL.test(req.url()) && !guard.requests.includes(req.url())) {
          guard.requests.push(req.url());
        }
      });
      page.on('console', (msg) => {
        if (msg.type() === 'error') guard.errors.push(msg.text());
      });
      page.on('pageerror', (err) => guard.errors.push(`pageerror: ${err.message}`));
      await use(guard);
      expect(guard.requests, 'network requests').toEqual([]);
      expect(guard.errors, 'console errors').toEqual([]);
    },
    { auto: true },
  ],
  open: async ({ page }, use) => {
    await use(async (route = '') => {
      await page.goto(route ? `${FILE_URL}#${route}` : FILE_URL);
      await page.locator('#main[data-route]').waitFor({ state: 'attached' });
    });
  },
});

export { expect };

let cache: Record<string, string> | null = null;

/** The markup of every page packed into the file, by route (read from its data block). */
export function pageHtml(): Record<string, string> {
  if (cache) return cache;
  const html = readFileSync(FILE, 'utf8');
  const m = /<script id="ff-data" type="application\/octet-stream">([^<]+)<\/script>/.exec(html);
  if (!m) throw new Error('data block not found');
  const data = JSON.parse(gunzipSync(Buffer.from(m[1]!.trim(), 'base64')).toString('utf8')) as {
    pages: Record<string, { h: string }>;
  };
  cache = Object.fromEntries(Object.entries(data.pages).map(([r, p]) => [r, p.h]));
  return cache;
}

/** Every route packed into the file, e.g. "/", "/en/module/05-greeks/2/". */
export function routes(): string[] {
  return Object.keys(pageHtml()).sort();
}

export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

/** The route the file currently shows (without the hash sign). */
export async function currentRoute(page: Page): Promise<string> {
  return page.evaluate(() => decodeURIComponent(window.location.hash.slice(1)));
}
