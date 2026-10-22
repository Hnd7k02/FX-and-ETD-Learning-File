/**
 * Parser for the source list (src/content/sources.md and src/content/sources/*.md).
 *
 * Format per entry:
 *
 *   ## some-id
 *   - Titel: …          (or Title)
 *   - Herausgeber: …    (or Publisher)
 *   - Datum: …          (or Date)
 *   - URL: https://…
 *   - Belegt: …         (or Supports)
 *
 * Text outside "## id" blocks (intro paragraphs, the "# Quellen" heading) is ignored.
 * Unknown keys are kept in `extra`. Pure: no file access, so it runs in tests and at build time.
 */

export interface SourceEntry {
  id: string;
  title: string;
  publisher?: string;
  date?: string;
  url?: string;
  supports?: string;
  /** Any further "- Key: value" lines, keyed by their original label. */
  extra: Record<string, string>;
  /** Name of the file the entry came from (if given). */
  file?: string;
}

const KEY_MAP: Record<string, keyof Omit<SourceEntry, 'id' | 'extra' | 'file'>> = {
  titel: 'title',
  title: 'title',
  herausgeber: 'publisher',
  publisher: 'publisher',
  quelle: 'publisher',
  datum: 'date',
  date: 'date',
  url: 'url',
  link: 'url',
  belegt: 'supports',
  supports: 'supports',
  beleg: 'supports',
};

const HEADING = /^##\s+([a-z0-9][a-z0-9._-]*)\s*$/i;
const FIELD = /^\s*[-*]\s+([^:]+?)\s*:\s*(.*?)\s*$/;

/** Parses one markdown document into source entries, in document order. */
export function parseSources(markdown: string, file?: string): SourceEntry[] {
  const out: SourceEntry[] = [];
  let cur: SourceEntry | null = null;
  for (const line of markdown.replace(/\r\n?/g, '\n').split('\n')) {
    const h = HEADING.exec(line);
    if (h) {
      cur = { id: h[1]!, title: '', extra: {}, ...(file ? { file } : {}) };
      out.push(cur);
      continue;
    }
    if (/^#{1,2}\s/.test(line)) {
      // another heading (e.g. "# Quellen" or "## Some title with spaces") ends the block
      cur = null;
      continue;
    }
    if (!cur) continue;
    const f = FIELD.exec(line);
    if (!f) continue;
    const label = f[1]!.trim();
    const value = f[2]!;
    const key = KEY_MAP[label.toLowerCase()];
    if (key) {
      if (!cur[key]) cur[key] = value;
    } else {
      cur.extra[label] = value;
    }
  }
  for (const e of out) if (!e.title) e.title = e.id;
  return out;
}

/**
 * Parses several documents and merges them. The first occurrence of an id wins (the main
 * sources.md is passed first); entries are returned sorted by title.
 */
export function collectSources(docs: Array<{ file?: string; markdown: string }>): SourceEntry[] {
  const seen = new Map<string, SourceEntry>();
  for (const d of docs) {
    for (const e of parseSources(d.markdown, d.file)) {
      if (!seen.has(e.id)) seen.set(e.id, e);
    }
  }
  return [...seen.values()].sort((a, b) =>
    a.title.localeCompare(b.title, 'en', { sensitivity: 'base' }),
  );
}

/** Host name of a URL without "www." (for compact link labels); empty string if invalid. */
export function urlHost(url: string | undefined): string {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/**
 * Splits a bilingual value written as "Deutsch / English" into its halves. Values without
 * " / " are returned for both languages.
 */
export function splitBilingual(value: string | undefined): { de: string; en: string } {
  if (!value) return { de: '', en: '' };
  const parts = value.split(' / ');
  if (parts.length === 2) return { de: parts[0]!.trim(), en: parts[1]!.trim() };
  return { de: value, en: value };
}
