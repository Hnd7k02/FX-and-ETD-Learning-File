/**
 * URL helpers that work in both delivery modes:
 * - web build: real paths with ?query and #anchor,
 * - offline file (forward-first.html, file://): hash routes "#/path/?query#anchor" (DECISIONS D-13).
 * Islands use these instead of touching location.search / location.hash directly.
 */

/** True when the page runs as the single offline file with hash routing. */
export function isHashRouted(): boolean {
  if (typeof window === 'undefined') return false;
  return (window as unknown as { __FF_OFFLINE__?: boolean }).__FF_OFFLINE__ === true;
}

/** Splits a hash route "#/path/?a=1#anchor" into its parts. */
export function parseHashRoute(hash: string): { path: string; query: string; anchor: string } {
  let h = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!h.startsWith('/')) return { path: '', query: '', anchor: h };
  let anchor = '';
  const a = h.indexOf('#');
  if (a >= 0) {
    anchor = h.slice(a + 1);
    h = h.slice(0, a);
  }
  let query = '';
  const q = h.indexOf('?');
  if (q >= 0) {
    query = h.slice(q + 1);
    h = h.slice(0, q);
  }
  const path = h.endsWith('/') ? h : `${h}/`;
  return { path, query, anchor };
}

/** Query parameters of the current page (search params, or the query part of the hash route). */
export function readQuery(): URLSearchParams {
  if (typeof window === 'undefined') return new URLSearchParams();
  if (isHashRouted()) return new URLSearchParams(parseHashRoute(window.location.hash).query);
  return new URLSearchParams(window.location.search);
}

/** Replaces the query of the current page without navigation or a history entry. */
export function writeQuery(params: URLSearchParams): void {
  if (typeof window === 'undefined') return;
  const qs = params.toString();
  try {
    if (isHashRouted()) {
      const { path, anchor } = parseHashRoute(window.location.hash);
      const next = `#${path}${qs ? `?${qs}` : ''}${anchor ? `#${anchor}` : ''}`;
      window.history.replaceState(window.history.state, '', next);
      return;
    }
    const url = new URL(window.location.href);
    url.search = qs;
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
  } catch {
    /* history may be unavailable (sandboxed frames) */
  }
}

/** Scrolls to an element id on the current page without changing the route. */
/**
 * Jumps to an in-page target like a followed fragment link: scrolls to it, marks it with
 * `data-target` (stands in for :target, which a hash route cannot set) and moves keyboard focus
 * there, so the next Tab continues at the target (WCAG 2.4.3). Returns false if the id is absent.
 */
export function jumpToId(id: string, smooth = true): boolean {
  if (!scrollToId(id, smooth)) return false;
  const el = document.getElementById(id)!;
  document.querySelectorAll('[data-target]').forEach((t) => t.removeAttribute('data-target'));
  el.setAttribute('data-target', '');
  if (!el.hasAttribute('tabindex') && !el.matches('a[href], button, input, select, textarea')) {
    el.setAttribute('tabindex', '-1');
    el.setAttribute('data-jump-focus', '');
  }
  el.focus({ preventScroll: true });
  return true;
}

export function scrollToId(id: string, smooth = true): boolean {
  if (typeof document === 'undefined' || !id) return false;
  const el = document.getElementById(id);
  if (!el) return false;
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: smooth && !reduce ? 'smooth' : 'auto', block: 'start' });
  if (!isHashRouted()) {
    try {
      window.history.replaceState(window.history.state, '', `#${id}`);
    } catch {
      /* ignore */
    }
  }
  return true;
}
