/**
 * Runtime of the offline file forward-first.html (DECISIONS D-13).
 *
 * One HTML file, opened over file:// on the work PC (Chrome/Edge) and in the iPad Files app
 * (WebKit). The Astro build pre-renders every page; scripts/build-offline.ts packs their main
 * content (gzip + base64) into the file. This runtime:
 * - routes by hash (#/module/05-greeks/2/, #/riskometer/?pair=EURUSD, #/glossar/#term-pip),
 * - swaps the page content (inside a View Transition where supported),
 * - renders the Preact islands of the page (the same components as the web build),
 * - dispatches 'astro:page-load' so the page scripts in src/client/* run as on the web,
 * - keeps every link inside the file and makes no network request.
 * Optional features are feature-detected: View Transitions, localStorage (progress simply is not
 * saved when storage is blocked), IntersectionObserver.
 */
import { gunzipSync, strFromU8 } from 'fflate';
import { h, render, type ComponentType } from 'preact';
import '@/client/topnav';
import '@/client/stepper';
import '@/client/section-end';
import '@/client/about-toc';
import '@/client/home';
import '@/client/svg-touch';
import { switchLangPath } from '@/i18n/routes';
import { fmtDate } from '@/lib/format';
import { jumpToId, parseHashRoute } from '@/lib/url';
import { ISLANDS } from 'virtual:ff-islands';

type Lang = 'de' | 'en';
type NavKey = 'modules' | 'riskometer' | 'glossary' | 'about' | null;

interface PageRec {
  /** <title> */
  t: string;
  /** language */
  l: Lang;
  /** module family (data-family) */
  f?: string;
  /** footer: 1 = wide container, 0 = module container */
  w: 0 | 1;
  /** main content HTML */
  h: string;
}

interface Chrome {
  /** skip link + top navigation */
  top: string;
  /** footer in the wide (1) and the module (0) container */
  footer: [string, string];
}

interface OfflineData {
  asOf: string;
  built: string;
  /** version of the offline file and its build date (ISO) */
  version?: { number: number; date: string };
  pages: Record<string, PageRec>;
  aliases: Record<string, string>;
  chrome: Record<Lang, Chrome>;
}

declare global {
  interface Window {
    __FF_OFFLINE__?: boolean;
  }
}

/* ------------------------------------------------------------------------------------------ */
/* Data                                                                                        */
/* ------------------------------------------------------------------------------------------ */

function loadData(): OfflineData {
  const el = document.getElementById('ff-data');
  if (!el?.textContent) throw new Error('Forward First: data block missing');
  const bin = atob(el.textContent.trim());
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  // The data block stays in the document: a copy saved with Ctrl+S ("Webpage, Complete") must
  // still contain it.
  return JSON.parse(strFromU8(gunzipSync(bytes))) as OfflineData;
}

/** Replaces the loading text when the file cannot start (e.g. an incomplete copy). */
function startupFailed(err: unknown): never {
  const el = document.getElementById('main');
  if (el) {
    el.innerHTML =
      '<p class="container" style="padding:48px 16px;font-family:system-ui,sans-serif">' +
      'Forward First konnte nicht starten. Bitte die Originaldatei forward-first.html öffnen, ' +
      'keine im Browser gespeicherte Kopie. / Forward First could not start. Please open the ' +
      'original file forward-first.html, not a copy saved by the browser.</p>';
  }
  throw err;
}

/* ------------------------------------------------------------------------------------------ */
/* Islands                                                                                     */
/* ------------------------------------------------------------------------------------------ */

/** Astro's prop serialisation: every value is [type, value] (see astro-island). */
function reviveValue(raw: unknown): unknown {
  if (!Array.isArray(raw)) return raw;
  const [type, value] = raw as [number, unknown];
  switch (type) {
    case 0:
      return reviveObject(value);
    case 1:
      return (value as unknown[]).map(reviveValue);
    case 2:
      return new RegExp(value as string);
    case 3:
      return new Date(value as string);
    case 4:
      return new Map((value as unknown[]).map(reviveValue) as [unknown, unknown][]);
    case 5:
      return new Set((value as unknown[]).map(reviveValue));
    case 6:
      return BigInt(value as string);
    case 7:
      return new URL(value as string);
    case 8:
      return new Uint8Array(value as number[]);
    case 9:
      return new Uint16Array(value as number[]);
    case 10:
      return new Uint32Array(value as number[]);
    case 11:
      return Infinity * (value as number);
    default:
      return undefined;
  }
}

function reviveObject(obj: unknown): unknown {
  if (typeof obj !== 'object' || obj === null) return obj;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) out[k] = reviveValue(v);
  return out;
}

/** Component file name, set by scripts/build-offline.ts from Astro's chunk URL. */
function islandName(el: Element): string {
  return el.getAttribute('data-ff-island') ?? '';
}

const mounted = new Set<Element>();

function mountIslands(root: ParentNode): void {
  root.querySelectorAll('astro-island').forEach((el) => {
    const mod = ISLANDS[islandName(el)];
    const exp = el.getAttribute('component-export') || 'default';
    const Comp = mod?.[exp] as ComponentType<Record<string, unknown>> | undefined;
    if (!Comp) {
      console.warn('Forward First: unknown island', islandName(el));
      return;
    }
    let props: Record<string, unknown> = {};
    try {
      props = reviveObject(JSON.parse(el.getAttribute('props') || '{}')) as Record<string, unknown>;
    } catch (e) {
      console.warn('Forward First: bad island props', e);
    }
    const child = h(Comp, props);
    // Same root id seed as Astro's Preact client, so useId() values stay unique per island.
    const id = Number.parseInt(el.getAttribute('data-preact-island-id') ?? '', 10);
    const mask = [Number.isNaN(id) ? el.getAttribute('uid') : id, 0];
    (child as unknown as { _mask: unknown; __m: unknown })._mask = mask;
    (child as unknown as { _mask: unknown; __m: unknown }).__m = mask;
    render(child, el);
    el.removeAttribute('ssr');
    mounted.add(el);
  });
}

function unmountIslands(): void {
  for (const el of mounted) render(null, el);
  mounted.clear();
}

/* ------------------------------------------------------------------------------------------ */
/* Links                                                                                       */
/* ------------------------------------------------------------------------------------------ */

const isInternalPath = (href: string | null): boolean =>
  !!href && href.startsWith('/') && !href.startsWith('//');

/** Turns "/module/05-greeks/2/" into "#/module/05-greeks/2/" so links stay inside the file. */
function rewriteLinks(root: ParentNode): void {
  root.querySelectorAll<HTMLAnchorElement>('a[href^="/"]').forEach((a) => {
    const href = a.getAttribute('href');
    if (href && isInternalPath(href)) a.setAttribute('href', `#${href}`);
  });
}

/* ------------------------------------------------------------------------------------------ */
/* Router                                                                                      */
/* ------------------------------------------------------------------------------------------ */

let data: OfflineData;
try {
  data = loadData();
} catch (err) {
  startupFailed(err);
}
const main = document.getElementById('main')!;
const top = document.getElementById('ff-top')!;
const bottom = document.getElementById('ff-bottom')!;
const announcer = document.getElementById('ff-announcer');
const scrollMemory = new Map<string, number>();
let current = '';
let chromeKey = '';
let navByLink = false;
let first = true;

function storedLang(): Lang {
  try {
    return localStorage.getItem('ff-lang') === 'en' ? 'en' : 'de';
  } catch {
    return 'de';
  }
}

/** The page shown for a route: the page itself, its alias target or the 404 page. */
function resolve(path: string): string {
  if (!path) return storedLang() === 'en' ? '/en/' : '/';
  if (data.pages[path]) return path;
  const alias = data.aliases[path];
  if (alias && data.pages[alias]) return alias;
  const notFound = path.startsWith('/en/') ? '/en/404/' : '/404/';
  if (data.pages[notFound]) return notFound;
  const notFoundAlias = data.aliases[notFound];
  return notFoundAlias && data.pages[notFoundAlias] ? notFoundAlias : '/404/';
}

function navKeyOf(path: string): NavKey {
  const p = path.replace(/^\/en\//, '/');
  if (p === '/' || p.startsWith('/module/')) return 'modules';
  if (p.startsWith('/riskometer/')) return 'riskometer';
  if (p.startsWith('/glossar/') || p.startsWith('/glossary/')) return 'glossary';
  if (p.startsWith('/ueber/') || p.startsWith('/about/')) return 'about';
  return null;
}

const NAV_HREF: Record<Exclude<NavKey, null>, RegExp> = {
  modules: /^#\/(en\/)?(#lernpfad)?$/,
  riskometer: /riskometer\/$/,
  glossary: /(glossar|glossary)\/$/,
  about: /(ueber|about)\/$/,
};

function updateChrome(path: string, page: PageRec): void {
  const key = `${page.l}:${page.w}`;
  if (key !== chromeKey) {
    const c = data.chrome[page.l];
    top.innerHTML = c.top;
    bottom.innerHTML = c.footer[page.w === 1 ? 0 : 1];
    rewriteLinks(top);
    rewriteLinks(bottom);
    chromeKey = key;
  }
  // active navigation item
  const nav = navKeyOf(path);
  top.querySelectorAll<HTMLAnchorElement>('.top-link').forEach((a) => {
    const href = a.getAttribute('href') ?? '';
    const on = nav !== null && NAV_HREF[nav].test(href);
    if (on) {
      a.setAttribute('aria-current', 'page');
      a.dataset.active = 'true';
    } else {
      a.removeAttribute('aria-current');
      delete a.dataset.active;
    }
  });
  // language switch: same page in the other language
  top.querySelectorAll<HTMLAnchorElement>('a[data-lang-switch]').forEach((a) => {
    const to = a.dataset.langSwitch === 'en' ? 'en' : 'de';
    const target = to === page.l ? path : switchLangPath(path, to);
    a.setAttribute('href', `#${data.pages[target] ? target : to === 'en' ? '/en/' : '/'}`);
    if (to === page.l) a.setAttribute('aria-current', 'true');
    else a.removeAttribute('aria-current');
  });
}

function swap(path: string, page: PageRec): void {
  unmountIslands();
  document.dispatchEvent(new Event('astro:before-swap'));
  document.documentElement.lang = page.l;
  document.title = page.t;
  for (const el of [document.documentElement, document.body]) {
    if (page.f) el.setAttribute('data-family', page.f);
    else el.removeAttribute('data-family');
  }
  updateChrome(path, page);
  main.innerHTML = page.h;
  main.dataset.route = path;
  rewriteLinks(main);
  showVersion(page.l);
  mountIslands(main);
}

/** About page: "Offline-Datei Version 5 vom 23.10.2026" (template from the page, data from the build). */
function showVersion(lang: Lang): void {
  const v = data.version;
  if (!v) return;
  main.querySelectorAll<HTMLElement>('[data-ff-version]').forEach((el) => {
    const tpl = el.dataset.template ?? '';
    el.textContent = tpl.replace('{n}', String(v.number)).replace('{date}', fmtDate(v.date, lang));
    el.hidden = false;
  });
}

function show(force = false): void {
  const { path: raw, anchor } = parseHashRoute(window.location.hash);
  const path = resolve(raw);
  const page = data.pages[path] ?? data.pages['/404/']!;
  const sameRoute = path === current;
  if (sameRoute && !first && !force) {
    navByLink = false;
    if (anchor) jumpToId(anchor);
    return;
  }
  if (current) scrollMemory.set(current, window.scrollY);
  const prev = current;
  current = path;

  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const doc = document as Document & {
    startViewTransition?: (cb: () => void) => { ready?: Promise<void>; finished?: Promise<void> };
  };
  const wasFirst = first;
  const byLink = navByLink;
  navByLink = false;
  first = false;
  const run = () => {
    swap(path, page);
    // scroll: anchor (which also takes the focus), else restored position (back/forward), else top
    const jumped = !!anchor && jumpToId(anchor, false);
    if (!jumped) {
      const y = !byLink ? scrollMemory.get(path) : undefined;
      window.scrollTo(0, y ?? 0);
    }
    document.dispatchEvent(new Event('astro:page-load'));
    if (!wasFirst) {
      if (!jumped) main.focus({ preventScroll: true });
      if (announcer) announcer.textContent = page.t;
    }
  };
  if (!wasFirst && prev && !reduce && typeof doc.startViewTransition === 'function') {
    try {
      const vt = doc.startViewTransition(run);
      // A skipped transition (e.g. a second tap before the first one ends) rejects these
      // promises; the page itself has been swapped either way.
      vt.ready?.catch(() => {});
      vt.finished?.catch(() => {});
    } catch {
      run();
    }
  } else {
    run();
  }
}

/**
 * Goes to a route inside the file. history.pushState changes only the fragment and starts no
 * navigation, so it also works in embedded web views that refuse link navigations (the iPad
 * Files app preview). Fallback: set the hash and let 'hashchange' do the rest.
 */
function navigate(route: string): void {
  const target = `#${route}`;
  const next = parseHashRoute(target);
  const now = parseHashRoute(window.location.hash);
  if (resolve(next.path) === current && (!next.query || next.query === now.query)) {
    // Link to the page that is already open (without a query of its own): no history entry and
    // no remount, so an island keeps its state and query; only the anchor if there is one.
    navByLink = false;
    if (next.anchor) jumpToId(next.anchor);
    return;
  }
  navByLink = true;
  // Same page with another query (e.g. a Riskometer deep link on the Riskometer): mount again and
  // replace the entry, so Back never lands on a query the open island does not show.
  const force = resolve(next.path) === current;
  try {
    if (force) history.replaceState(null, '', target);
    else history.pushState(null, '', target);
  } catch {
    window.location.hash = target;
    return;
  }
  show(force);
}

/* ------------------------------------------------------------------------------------------ */
/* Global listeners                                                                            */
/* ------------------------------------------------------------------------------------------ */

document.addEventListener('click', (e) => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
    return;
  }
  const a = (e.target as Element | null)?.closest?.('a');
  if (!a) return;
  const href = a.getAttribute('href');
  if (!href) return;
  if (isInternalPath(href)) {
    e.preventDefault();
    navigate(href);
    return;
  }
  if (href.startsWith('#/')) {
    e.preventDefault();
    navigate(href.slice(1));
    return;
  }
  if (href.startsWith('#')) {
    // in-page anchor (skip link, glossary letters, table of contents): keep the route
    e.preventDefault();
    const id = decodeURIComponent(href.slice(1));
    if (id === 'main') {
      main.focus();
      return;
    }
    jumpToId(id);
  }
});

// Back/forward after pushState fires 'popstate'; typed or programmatic hash changes fire
// 'hashchange'. show() ignores the second call for the same route.
window.addEventListener('popstate', () => show());
window.addEventListener('hashchange', () => show());

// Links created later by islands or page scripts (e.g. "Weiterlernen") are rewritten as well.
new MutationObserver((records) => {
  for (const r of records) {
    if (r.type === 'attributes' && r.target instanceof HTMLAnchorElement) {
      const href = r.target.getAttribute('href');
      if (href && isInternalPath(href)) r.target.setAttribute('href', `#${href}`);
    } else {
      r.addedNodes.forEach((n) => {
        if (n instanceof HTMLAnchorElement) {
          const href = n.getAttribute('href');
          if (href && isInternalPath(href)) n.setAttribute('href', `#${href}`);
        } else if (n instanceof Element) {
          rewriteLinks(n);
        }
      });
    }
  }
}).observe(document.body, {
  subtree: true,
  childList: true,
  attributes: true,
  attributeFilter: ['href'],
});

if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
show();
