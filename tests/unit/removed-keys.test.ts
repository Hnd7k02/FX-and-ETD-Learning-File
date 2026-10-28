/**
 * Keys renamed or removed in Version 5 occur nowhere any more (supplement point 20): not in the
 * source, the content, the dictionaries, the scripts or the other tests.
 * - barrier lab time to expiry in days instead of weeks (D-42): bl.slider.weeks → bl.slider.days,
 *   bl.weeks.* → bl.t.*,
 * - max-loss chip «unbegrenzt» replaced by typed classes (D-43, point 16):
 *   pm.chip.loss.unlimited → pm.chip.loss.noStop / pm.chip.loss.unbounded,
 * - risk reversal shown from unrounded premiums (point 15): m06.rrCallPips → m06.rr25CallPips.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const REMOVED: Record<string, string> = {
  'bl.slider.weeks': 'bl.slider.days',
  'bl.weeks.n': 'bl.t.weeks',
  'bl.weeks.one': 'bl.t.week',
  'bl.weeks.q': 'bl.t.months',
  'bl.weeks.year': 'bl.t.year',
  'pm.chip.loss.unlimited': 'pm.chip.loss.noStop / pm.chip.loss.unbounded',
  'm06.rrCallPips': 'm06.rr25CallPips',
};

const ROOT = process.cwd();
const SELF = relative(ROOT, __filename);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|astro|mdx|md|mjs|json)$/.test(name)) out.push(p);
  }
  return out;
}

const FILES = ['src', 'scripts', 'tests']
  .flatMap((d) => walk(join(ROOT, d)))
  .filter((f) => relative(ROOT, f) !== SELF);

describe('renamed and removed keys', () => {
  it('scans the source, content, scripts and tests', () => {
    expect(FILES.length).toBeGreaterThan(300);
  });

  for (const [key, now] of Object.entries(REMOVED)) {
    it(`${key} is gone (now ${now})`, () => {
      const hits = FILES.filter((f) => readFileSync(f, 'utf8').includes(key)).map((f) =>
        relative(ROOT, f),
      );
      expect(hits).toEqual([]);
    });
  }

  it('the replacements exist', () => {
    const all = FILES.map((f) => readFileSync(f, 'utf8')).join('\n');
    for (const k of [
      'bl.slider.days',
      'bl.t.week',
      'bl.t.months',
      'pm.chip.loss.noStop',
      'pm.chip.loss.unbounded',
      'm06.rr25CallPips',
    ]) {
      expect(all.includes(`'${k}'`), k).toBe(true);
    }
  });
});
