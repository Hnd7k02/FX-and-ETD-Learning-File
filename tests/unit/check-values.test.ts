/**
 * No check value is typed into a component, a text, the quiz, the glossary or a dictionary
 * (supplement point 21): the check values of Version 5 live only in the unit tests, and every
 * shown number comes from the calculation core through <Num> or a formatter. Each pattern below
 * matches a check value in its German and English display forms.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const CHECK_VALUES: Record<string, RegExp> = {
  '25Δ call strike 0.815145': /\b0\.815145\b/,
  '25Δ put strike 0.772752': /\b0\.772752\b/,
  'chance 23.96 %': /\b23\.96\b/,
  'chance 26.51 %': /\b26\.51\b/,
  'chance 9.40 %': /\b9\.40\s?%/,
  'chance 10.81 %': /\b10\.81\b/,
  'call premium 47.2659 / 47.27': /\b47\.27(?:\d{2})?\b|\b47\.2659\b/,
  'put premium 49.5022 / 49.50': /\b49\.50(?:22)?\b/,
  'net −2.2362 / −2.23': /\b2\.23(?:62)?\b/,
  'net CHF −223.62': /\b223\.62\b/,
  'zero-cost put 0.7721506': /\b0\.772150?6?\b|\b0\.772151\b/,
  'forward gap +0.65 pips': /\b0\.65\s?(?:Pips|pips)\b/,
  'max-loss bounds (D-43)':
    /1[’',]?(?:609[’',]?922|804[’',]?296|872[’',]?000|800[’',]?595|852[’',]?800)\b/,
};

const ROOT = process.cwd();
function walk(dir: string, re: RegExp, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, re, out);
    else if (re.test(name)) out.push(p);
  }
  return out;
}

const FILES = [
  ...walk(join(ROOT, 'src/content/modules'), /\.mdx$/),
  ...walk(join(ROOT, 'src/content/quiz'), /\.ts$/),
  join(ROOT, 'src/content/glossary.ts'),
  ...walk(join(ROOT, 'src/i18n/dict'), /\.ts$/),
  ...walk(join(ROOT, 'src/components'), /\.(tsx|astro)$/),
  ...walk(join(ROOT, 'src/views'), /\.astro$/),
];

describe('no check values in components, texts or dictionaries', () => {
  it('scans the texts, quiz, glossary, dictionaries and components', () => {
    expect(FILES.length).toBeGreaterThan(150);
  });

  for (const [name, re] of Object.entries(CHECK_VALUES)) {
    it(name, () => {
      const hits = FILES.flatMap((f) =>
        readFileSync(f, 'utf8')
          .split('\n')
          .map((line, i) => [line, i] as const)
          .filter(([line]) => re.test(line))
          .map(([line, i]) => `${relative(ROOT, f)}:${i + 1}: ${line.trim().slice(0, 100)}`),
      );
      expect(hits).toEqual([]);
    });
  }
});
