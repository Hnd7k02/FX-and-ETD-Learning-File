/**
 * Glossary search (island). The terms are server-rendered; this island only filters them:
 * it hides items whose folded search text (data-search) misses a query token or whose
 * module family does not match, hides empty letter groups, dims their index letters,
 * highlights matches (CSS Custom Highlight API where available) and keeps ?q= in the URL.
 * Without JavaScript the full list stays visible.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Family } from '@/data/modules';
import { FAMILIES } from '@/data/modules';
import { glossary as dict } from '@/i18n/dict/glossary';
import { translator, type Lang } from '@/i18n/types';
import { matchRanges, matchesTokens, searchTokens } from '@/lib/glossary';

type FamilyFilter = 'all' | Family;

export interface GlossarySearchProps {
  lang: Lang;
  total: number;
  /** Number of terms per module family. */
  familyCounts: Record<Family, number>;
}

const FAMILY_KEYS = Object.keys(FAMILIES) as Family[];
const HL_NAME = 'gl-match';

function isFamily(x: string | null): x is Family {
  return !!x && (FAMILY_KEYS as string[]).includes(x);
}

/** Applies the filter to the server-rendered list and returns the number of visible terms. */
function applyFilter(query: string, family: FamilyFilter): number {
  const tokens = searchTokens(query);
  let shown = 0;
  const items = document.querySelectorAll<HTMLElement>('[data-gl-item]');
  for (const el of items) {
    const ok =
      (family === 'all' || el.dataset.family === family) &&
      matchesTokens(el.dataset.search ?? '', tokens);
    el.hidden = !ok;
    if (ok) shown++;
  }
  for (const g of document.querySelectorAll<HTMLElement>('[data-gl-group]')) {
    const any = g.querySelector('[data-gl-item]:not([hidden])');
    g.hidden = !any;
    const link = document.querySelector<HTMLElement>(`[data-gl-letter="${g.dataset.glGroup}"]`);
    if (link) link.toggleAttribute('data-dim', !any);
  }
  highlight(tokens);
  return shown;
}

/** Highlights token matches inside visible [data-gl-hl] elements (progressive enhancement). */
function highlight(tokens: string[]): void {
  const registry = typeof CSS !== 'undefined' ? CSS.highlights : undefined;
  if (!registry || typeof Highlight === 'undefined') return;
  if (!tokens.length) {
    registry.delete(HL_NAME);
    return;
  }
  const ranges: Range[] = [];
  for (const el of document.querySelectorAll<HTMLElement>(
    '[data-gl-item]:not([hidden]) [data-gl-hl]',
  )) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const text = n.textContent ?? '';
      for (const [a, b] of matchRanges(text, tokens)) {
        const r = new Range();
        r.setStart(n, a);
        r.setEnd(n, b);
        ranges.push(r);
      }
    }
  }
  registry.set(HL_NAME, new Highlight(...ranges));
}

function writeUrl(query: string, family: FamilyFilter): void {
  try {
    const url = new URL(location.href);
    if (query.trim()) url.searchParams.set('q', query.trim());
    else url.searchParams.delete('q');
    if (family !== 'all') url.searchParams.set('f', family);
    else url.searchParams.delete('f');
    history.replaceState(history.state, '', url.pathname + url.search + url.hash);
  } catch {
    /* ignore (sandboxed iframes) */
  }
}

export default function GlossarySearch({ lang, total, familyCounts }: GlossarySearchProps) {
  const t = translator(dict, lang);
  const [query, setQuery] = useState('');
  const [family, setFamily] = useState<FamilyFilter>('all');
  const [shown, setShown] = useState(total);
  const [ready, setReady] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  // Initial state from the URL (?q=…&f=…).
  useEffect(() => {
    const p = new URLSearchParams(location.search);
    const q = p.get('q') ?? '';
    const f = p.get('f');
    if (q) setQuery(q);
    if (isFamily(f)) setFamily(f);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    setShown(applyFilter(query, family));
    writeUrl(query, family);
  }, [query, family, ready]);

  // "/" focuses the search; links to hidden terms clear the filter first.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      e.preventDefault();
      input.current?.focus();
      input.current?.select();
    };
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.('a[href^="#"]');
      if (!a) return;
      const id = decodeURIComponent(a.getAttribute('href')!.slice(1));
      const target = id ? document.getElementById(id) : null;
      if (!target || !(target.hidden || target.closest('[hidden]'))) return;
      e.preventDefault();
      applyFilter('', 'all');
      setQuery('');
      setFamily('all');
      location.hash = id;
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('click', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('click', onClick);
      CSS.highlights?.delete(HL_NAME);
    };
  }, []);

  const clear = () => {
    setQuery('');
    setFamily('all');
    input.current?.focus();
  };

  const filtered = query.trim() !== '' || family !== 'all';
  const familyOptions: Array<{ value: FamilyFilter; label: string; count: number }> = [
    { value: 'all', label: t('glossary.filterAll'), count: total },
    ...FAMILY_KEYS.map((f) => ({
      value: f,
      label: FAMILIES[f].label[lang],
      count: familyCounts[f],
    })),
  ];

  return (
    <div class="gls" role="search">
      <div class="gls-field">
        <label class="sr-only" for="glossary-q">
          {t('glossary.searchLabel')}
        </label>
        <svg class="gls-icon" width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="8.5" cy="8.5" r="5.75" fill="none" stroke="currentColor" stroke-width="2" />
          <path d="M13 13l4.5 4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
        <input
          ref={input}
          id="glossary-q"
          class="gls-input"
          type="search"
          inputMode="search"
          autoComplete="off"
          spellcheck={false}
          enterKeyHint="search"
          placeholder={t('glossary.searchPlaceholder')}
          aria-describedby="glossary-hint"
          value={query}
          onInput={(e) => setQuery((e.currentTarget as HTMLInputElement).value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && query) {
              e.preventDefault();
              setQuery('');
            }
          }}
        />
        <kbd class="gls-kbd" aria-hidden="true" title={t('glossary.shortcut', { key: '/' })}>
          /
        </kbd>
      </div>
      <p id="glossary-hint" class="gls-hint">
        {t('glossary.searchHint')}
      </p>

      <div class="gls-row">
        <div class="gls-filters" role="group" aria-label={t('glossary.filterLabel')}>
          {familyOptions.map((o) => (
            <button
              key={o.value}
              type="button"
              class="gls-filter"
              data-family={o.value === 'all' ? undefined : o.value}
              aria-pressed={family === o.value}
              onClick={() => setFamily(o.value)}
            >
              {o.value !== 'all' && <span class="dot gls-dot" aria-hidden="true" />}
              {o.label}
              <span class="gls-filter-n mono">{o.count}</span>
            </button>
          ))}
        </div>
        <p class="gls-count" role="status" aria-live="polite" aria-atomic="true">
          {filtered ? t('glossary.count', { shown, total }) : t('glossary.countAll', { total })}
        </p>
      </div>

      {filtered && shown === 0 && (
        <div class="gls-empty">
          <p class="gls-empty-title">{t('glossary.empty', { q: query.trim() })}</p>
          <p class="gls-empty-hint">{t('glossary.emptyHint')}</p>
          <button type="button" class="btn btn-light" onClick={clear}>
            {t('glossary.clear')}
          </button>
        </div>
      )}
    </div>
  );
}
