import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fill, isLang, translator } from '@/i18n/types';
import { MODULES } from '@/data/modules';

type Dict = { de: Record<string, string>; en: Record<string, string> };

const dictModules = import.meta.glob<Record<string, unknown>>('/src/i18n/dict/*.ts', {
  eager: true,
});

function isDict(x: unknown): x is Dict {
  return (
    !!x &&
    typeof x === 'object' &&
    'de' in x &&
    'en' in x &&
    typeof (x as Dict).de === 'object' &&
    typeof (x as Dict).en === 'object'
  );
}

describe('i18n dictionaries', () => {
  const dicts: Array<[string, Dict]> = [];
  for (const [path, mod] of Object.entries(dictModules)) {
    for (const [name, value] of Object.entries(mod)) {
      if (isDict(value)) dicts.push([`${path}#${name}`, value]);
    }
  }

  it('finds at least the common dictionary', () => {
    expect(dicts.length).toBeGreaterThan(0);
  });

  it.each(dicts)('%s has the same keys in DE and EN, none empty', (_name, d) => {
    expect(Object.keys(d.en).sort()).toEqual(Object.keys(d.de).sort());
    for (const lang of ['de', 'en'] as const) {
      for (const [k, v] of Object.entries(d[lang])) {
        expect(v.trim(), `${lang}:${k}`).not.toBe('');
      }
    }
  });

  it.each(dicts)('%s uses the same placeholders in DE and EN', (_name, d) => {
    for (const k of Object.keys(d.de)) {
      const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
      expect(ph(d.en[k] ?? ''), k).toEqual(ph(d.de[k] ?? ''));
    }
  });

  it('modules have titles and sections in both languages', () => {
    for (const m of MODULES) {
      for (const l10n of [
        m.title,
        m.headline,
        ...m.sections.flatMap((s) => [s.title, s.short, s.teaser]),
      ]) {
        expect(l10n.de.trim()).not.toBe('');
        expect(l10n.en.trim()).not.toBe('');
      }
    }
  });

  it('fills placeholders', () => {
    expect(fill('{a} von {b}', { a: 3, b: 4 })).toBe('3 von 4');
    expect(fill('{a} {missing}', { a: 1 })).toBe('1 {missing}');
    expect(fill('plain')).toBe('plain');
    const t = translator({ de: { k: 'Hallo {n}' }, en: { k: 'Hello {n}' } }, 'en');
    expect(t('k', { n: 'Dario' })).toBe('Hello Dario');
    expect(isLang('de')).toBe(true);
    expect(isLang('fr')).toBe(false);
  });
});

describe('no hard-coded UI strings in islands', () => {
  const dir = join(process.cwd(), 'src/components/islands');
  const files = (() => {
    try {
      return readdirSync(dir).filter((f) => f.endsWith('.tsx'));
    } catch {
      return [] as string[];
    }
  })();
  it.each(files.length ? files : ['(none)'])('%s renders text only via dictionaries', (f) => {
    if (f === '(none)') return;
    const src = readFileSync(join(dir, f), 'utf8');
    // JSX text between tags that contains a word of 3+ letters (umlauts included)
    const offenders = [...src.matchAll(/>([^<>{}\n]*[A-Za-zÄÖÜäöüß]{3,}[^<>{}\n]*)</g)]
      .map((m) => m[1]!.trim())
      .filter((s) => s && !/^(?:[A-Z]{1,4}\/[A-Z]{1,4}|USD|CHF|EUR|JPY|ATMF|ITM|OTM)$/.test(s));
    expect(offenders, `hard-coded text in ${f}`).toEqual([]);
  });
});
