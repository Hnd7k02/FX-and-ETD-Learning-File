/**
 * Every internal link of the file leads somewhere (supplement point 20): in every page (DE and
 * EN) and in the header and footer, a link to a site path names a packed page or an alias, and
 * its anchor exists on the target page. Static check of the data block, no browser needed.
 */
import { expect, packed, test } from './fixtures';

const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&#x2F;/gi, '/');

/** Internal links of a piece of markup: site paths ("/…") and hash routes ("#/…"). */
function links(html: string): string[] {
  return [...html.matchAll(/<a\b[^>]*\shref="([^"]+)"/g)]
    .map((m) => decode(m[1]!))
    .filter((h) => /^#?\/(?!\/)/.test(h))
    .map((h) => h.replace(/^#/, ''));
}

test('every internal link names a page and an anchor that exist', () => {
  const { pages, aliases, chrome } = packed();
  const ids = (route: string) =>
    new Set([...(pages[route]?.h ?? '').matchAll(/\sid="([^"]+)"/g)].map((m) => decode(m[1]!)));
  const sources: [string, string][] = [
    ...Object.entries(pages).map(([r, p]) => [r, p.h] as [string, string]),
    ...Object.entries(chrome).flatMap(([l, c]) => [
      [`header ${l}`, c.top] as [string, string],
      ...c.footer.map((f, i) => [`footer ${l} ${i}`, f] as [string, string]),
    ]),
  ];
  const broken: string[] = [];
  let checked = 0;
  for (const [from, html] of sources) {
    for (const href of links(html)) {
      checked++;
      const [pathQuery, anchor] = href.split('#');
      const path = pathQuery!.split('?')[0]!;
      const route = pages[path] ? path : aliases[path];
      if (!route || !pages[route]) {
        broken.push(`${from} → ${href}: no such page`);
        continue;
      }
      if (anchor && !ids(route).has(decodeURIComponent(anchor))) {
        broken.push(`${from} → ${href}: no anchor #${anchor}`);
      }
    }
  }
  expect(checked).toBeGreaterThan(500);
  expect(broken).toEqual([]);
});
