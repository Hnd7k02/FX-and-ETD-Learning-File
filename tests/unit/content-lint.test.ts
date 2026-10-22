/**
 * Content lint (see MASTER_PROMPT §11 and DECISIONS D-17):
 * - every <Num of> exists in the number registry,
 * - every <Fact id> exists and its source is listed in sources.md,
 * - no forbidden terms (bank names, "garantiert", "risikolos" outside arbitrage/rates),
 * - no typed-in example or reference values outside <Num>.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { NUMS } from '@/lib/nums';
import { FACTS } from '@/content/facts';

const ROOT = process.cwd();
const CONTENT = join(ROOT, 'src/content');

function walk(dir: string, ext: string[]): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p, ext));
    else if (ext.some((e) => name.endsWith(e))) out.push(p);
  }
  return out;
}

const mdxFiles = walk(join(CONTENT, 'modules'), ['.mdx']);
const textFiles = [
  ...mdxFiles,
  ...walk(join(CONTENT, 'quiz'), ['.ts']),
  ...walk(join(ROOT, 'src/i18n/dict'), ['.ts']),
  ...walk(join(ROOT, 'src/components'), ['.astro', '.tsx']),
  ...walk(join(ROOT, 'src/data'), ['.ts', '.json']),
  ...(existsSync(join(CONTENT, 'glossary.ts')) ? [join(CONTENT, 'glossary.ts')] : []),
];

function sourceIds(): Set<string> {
  const ids = new Set<string>();
  const files = [join(CONTENT, 'sources.md'), ...walk(join(CONTENT, 'sources'), ['.md'])];
  for (const f of files) {
    if (!existsSync(f)) continue;
    for (const m of readFileSync(f, 'utf8').matchAll(/^##\s+([a-z0-9][a-z0-9-]*)\s*$/gm))
      ids.add(m[1]!);
  }
  return ids;
}

/** Commercial banks and other firms that must never be named. */
const FORBIDDEN_NAMES = [
  'UBS',
  'Credit Suisse',
  'Julius Bär',
  'Julius Baer',
  'Raiffeisen',
  'Kantonalbank',
  'ZKB',
  'PostFinance',
  'Vontobel',
  'Pictet',
  'Lombard Odier',
  'Leonteq',
  'EFG',
  'Goldman',
  'JPMorgan',
  'J.P. Morgan',
  'Morgan Stanley',
  'Deutsche Bank',
  'Commerzbank',
  'HSBC',
  'Barclays',
  'Citigroup',
  'Citibank',
  'BNP',
  'Société Générale',
  'Santander',
  'Bank of America',
  'Nomura',
  'Mizuho',
];

/** Values from the running example and the reference table that must come from <Num>. */
const REFERENCE_LITERALS = [
  '0.8000',
  '0.7930',
  '0.79303',
  '0.79306',
  '126.69',
  '12’669',
  "12'669",
  '12,669',
  '0.5039',
  '0.6244',
  '12.3556',
  '12.36',
  '1’582',
  '1,582',
  '30.82',
  '30.67',
  '69.33',
  '1’008',
  '1,008',
  '126.5',
  '253.0',
  '33.50',
  '33.5',
];

function stripAllowed(src: string): string {
  return src
    .replace(/^import .*$/gm, '')
    .replace(/<Num\b[^>]*\/>/g, ' ')
    .replace(/<Fact\b[^>]*\/>/g, ' ')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ');
}

describe('content lint', () => {
  const sources = sourceIds();

  it('sources.md has entries', () => {
    expect(sources.size).toBeGreaterThan(0);
  });

  it.each(mdxFiles.map((f) => [relative(ROOT, f), f]))('%s uses registered <Num> keys', (_r, f) => {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/<Num\b[^>]*\bof="([^"]+)"/g)) {
      expect(NUMS[m[1]!], `unknown <Num of="${m[1]}">`).toBeDefined();
    }
  });

  it.each(mdxFiles.map((f) => [relative(ROOT, f), f]))('%s uses registered <Fact> ids', (_r, f) => {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/<Fact\b[^>]*\bid="([^"]+)"/g)) {
      expect(FACTS[m[1]!], `unknown <Fact id="${m[1]}">`).toBeDefined();
    }
  });

  it('every fact has a source in sources.md', () => {
    for (const [id, f] of Object.entries(FACTS)) {
      expect(sources.has(f.source), `fact ${id} → missing source "${f.source}"`).toBe(true);
    }
  });

  it.each(mdxFiles.map((f) => [relative(ROOT, f), f]))(
    '%s contains no typed-in reference values',
    (_r, f) => {
      const src = stripAllowed(readFileSync(f, 'utf8'));
      for (const lit of REFERENCE_LITERALS) {
        const re = new RegExp(
          `(?<![\\d.’',])${lit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\d’',])`,
        );
        expect(re.test(src), `literal "${lit}" must come from <Num>`).toBe(false);
      }
      expect(
        /(Vola|vol(atility)?)\D{0,12}\b8(\.0)?\s?%/i.test(src),
        'vol 8 % must come from <Num>',
      ).toBe(false);
      expect(/\b3\.5\s?%/.test(src), 'USD rate 3.5 % must come from <Num>').toBe(false);
    },
  );

  it.each(textFiles.map((f) => [relative(ROOT, f), f]))('%s names no banks or firms', (_r, f) => {
    const src = readFileSync(f, 'utf8');
    for (const name of FORBIDDEN_NAMES) {
      const re = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
      expect(re.test(src), `forbidden name "${name}"`).toBe(false);
    }
  });

  it.each(textFiles.map((f) => [relative(ROOT, f), f]))(
    '%s avoids "garantiert" and "risikolos" outside allowed contexts',
    (_r, f) => {
      const lines = readFileSync(f, 'utf8').split('\n');
      for (const line of lines) {
        if (/\bgarantiert|\bguarantee[ds]?\b/i.test(line)) {
          expect(
            /(nicht|kein\w*|not|no|never|nie)\s+(\w+\s+){0,2}(garantiert|guaranteed)/i.test(line),
            line,
          ).toBe(true);
        }
        if (/risikolos|risk-?free|riskless/i.test(line)) {
          expect(/arbitrage|zins|rate|anlage|deposit|carry/i.test(line), line).toBe(true);
        }
      }
    },
  );
});
