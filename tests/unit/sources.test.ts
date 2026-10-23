import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  collectSources,
  inlineSegments,
  parseSources,
  splitBilingual,
  urlHost,
} from '@/lib/sources';

const SAMPLE = `# Quellen / Sources

Intro text that is not an entry.
- Titel: not inside a block

## snb-2015

- Titel: Nationalbank hebt Mindestkurs auf
- Herausgeber: Schweizerische Nationalbank (SNB) / Swiss National Bank (SNB)
- Datum: 15.01.2015
- URL: https://www.snb.ch/en/press
- Belegt: Aufhebung des Mindestkurses; Ereignis \`chf-shock-2015\`
- Sprache: en

## ecb-rates
* Title: Euro foreign exchange reference rates
* Publisher: European Central Bank
* Date: daily
* Link: https://www.ecb.europa.eu/stats/
* Supports: Riskometer data
* Title: ignored duplicate key

## Some heading with spaces
- Titel: should not be parsed

## no-fields
`;

/** ISBN-13 with hyphens, e.g. 978-0-13-216494-8. */
const ISBN13 = /^97[89](-[0-9]+){3}-[0-9]$/;

describe('parseSources', () => {
  const entries = parseSources(SAMPLE, 'sample.md');

  it('parses ids in document order and ignores text outside blocks', () => {
    expect(entries.map((e) => e.id)).toEqual(['snb-2015', 'ecb-rates', 'no-fields']);
  });

  it('reads German and English keys', () => {
    const [snb, ecb] = entries;
    expect(snb!.title).toBe('Nationalbank hebt Mindestkurs auf');
    expect(snb!.publisher).toBe('Schweizerische Nationalbank (SNB) / Swiss National Bank (SNB)');
    expect(snb!.date).toBe('15.01.2015');
    expect(snb!.url).toBe('https://www.snb.ch/en/press');
    expect(snb!.supports).toContain('Mindestkurses');
    expect(snb!.extra).toEqual({ Sprache: 'en' });
    expect(snb!.file).toBe('sample.md');
    expect(ecb!.title).toBe('Euro foreign exchange reference rates');
    expect(ecb!.url).toBe('https://www.ecb.europa.eu/stats/');
    expect(ecb!.supports).toBe('Riskometer data');
  });

  it('falls back to the id as title', () => {
    expect(entries[2]!.title).toBe('no-fields');
    expect(entries[2]!.url).toBeUndefined();
  });

  it('handles CRLF line endings and no file name', () => {
    const e = parseSources('## a-b\r\n- URL: https://example.org\r\n');
    expect(e[0]).toMatchObject({ id: 'a-b', url: 'https://example.org' });
    expect(e[0]!.file).toBeUndefined();
  });
});

describe('collectSources', () => {
  it('merges documents, first id wins, sorted by title', () => {
    const all = collectSources([
      { file: 'main.md', markdown: '## b\n- Titel: Beta\n- URL: https://b.org\n' },
      {
        file: 'frag.md',
        markdown: '## a\n- Titel: Alpha\n- URL: https://a.org\n## b\n- Titel: Other\n',
      },
    ]);
    expect(all.map((e) => e.id)).toEqual(['a', 'b']);
    expect(all.find((e) => e.id === 'b')!.title).toBe('Beta');
  });
});

describe('helpers', () => {
  it('extracts the host', () => {
    expect(urlHost('https://www.ecb.europa.eu/x')).toBe('ecb.europa.eu');
    expect(urlHost('not a url')).toBe('');
    expect(urlHost(undefined)).toBe('');
  });

  it('splits bilingual values', () => {
    expect(splitBilingual('Europäische Zentralbank / European Central Bank')).toEqual({
      de: 'Europäische Zentralbank',
      en: 'European Central Bank',
    });
    expect(splitBilingual('15.01.2015')).toEqual({ de: '15.01.2015', en: '15.01.2015' });
    expect(splitBilingual(undefined)).toEqual({ de: '', en: '' });
  });

  it('resolves inline code', () => {
    expect(inlineSegments('Ereignis `gfc-2008` und `x`.')).toEqual([
      { text: 'Ereignis ', code: false },
      { text: 'gfc-2008', code: true },
      { text: ' und ', code: false },
      { text: 'x', code: true },
      { text: '.', code: false },
    ]);
    expect(inlineSegments('plain')).toEqual([{ text: 'plain', code: false }]);
    expect(inlineSegments('open `tick')).toEqual([{ text: 'open `tick', code: false }]);
  });
});

describe('the real source files', () => {
  const root = join(process.cwd(), 'src/content');
  const dir = join(root, 'sources');
  const docs = [
    { file: 'sources.md', markdown: readFileSync(join(root, 'sources.md'), 'utf8') },
    ...(existsSync(dir)
      ? readdirSync(dir)
          .filter((f) => f.endsWith('.md'))
          .map((f) => ({ file: f, markdown: readFileSync(join(dir, f), 'utf8') }))
      : []),
  ];
  const all = collectSources(docs);

  it('contains the ECB reference rates', () => {
    expect(all.some((e) => e.id === 'ecb-reference-rates')).toBe(true);
  });

  it.each(all.map((e) => [e.id, e] as const))(
    '%s has a title and an https URL (a book: an ISBN instead)',
    (_id, e) => {
      expect(e.title.trim()).not.toBe('');
      expect(e.title).not.toBe(e.id);
      if (e.extra['ISBN'] !== undefined) {
        // a book: no link to a copy, the ISBN identifies it (Version 6)
        expect(e.extra['ISBN']).toMatch(ISBN13);
        expect(e.url).toBeUndefined();
        return;
      }
      expect(e.url, `${e.id} has no URL`).toMatch(/^https:\/\//);
      expect(urlHost(e.url)).not.toBe('');
    },
  );

  it('the textbooks and articles of Version 6 are listed', () => {
    const ids = new Set(all.map((e) => e.id));
    for (const id of ['hull-2012', 'bis-2016-cip', 'jensen-1968', 'jewitt-2015']) {
      expect(ids.has(id), id).toBe(true);
    }
    const hull = all.find((e) => e.id === 'hull-2012')!;
    expect(hull.extra['ISBN']).toBe('978-0-13-216494-8');
    for (const chapter of [
      'Determination of Forward and Futures Prices',
      'The Greek Letters',
      'Exotic Options',
    ]) {
      expect(hull.supports).toContain(chapter);
    }
    expect(all.find((e) => e.id === 'jewitt-2015')!.extra['ISBN']).toBe('978-1-118-96745-4');
    // books carry an ISBN and no link at all (no links to copies of books)
    for (const id of ['hull-2012', 'jewitt-2015']) {
      expect(all.find((e) => e.id === id)!.url, id).toBeUndefined();
    }
  });
});

describe('sources.md (single source list)', () => {
  it('has unique ids and every entry has a title and a URL', async () => {
    const { readFileSync } = await import('node:fs');
    const md = readFileSync(`${process.cwd()}/src/content/sources.md`, 'utf8');
    const entries = parseSources(md);
    const ids = entries.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const e of entries) {
      expect(e.title.length, e.id).toBeGreaterThan(0);
      if (e.extra['ISBN'] !== undefined) expect(e.extra['ISBN'], e.id).toMatch(ISBN13);
      else expect(e.url ?? '', e.id).toMatch(/^https:\/\//);
    }
  });
});
