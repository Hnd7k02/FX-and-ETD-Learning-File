import { afterEach, describe, expect, it } from 'vitest';
import {
  isHashRouted,
  jumpToId,
  parseHashRoute,
  readQuery,
  scrollToId,
  writeQuery,
} from '@/lib/url';

type W = {
  location: { hash: string; search: string; href: string; pathname: string };
  history: { state: unknown; replaceState: (s: unknown, t: string, u: string) => void };
  __FF_OFFLINE__?: boolean;
  matchMedia?: () => { matches: boolean };
};

function fakeWindow(hash: string, search = '', offline = true): { w: W; calls: string[] } {
  const calls: string[] = [];
  const w: W = {
    location: {
      hash,
      search,
      href: `file:///x/forward-first.html${search}${hash}`,
      pathname: '/x/forward-first.html',
    },
    history: { state: null, replaceState: (_s, _t, u) => calls.push(u) },
    __FF_OFFLINE__: offline,
    matchMedia: () => ({ matches: true }),
  };
  (globalThis as unknown as { window: W }).window = w;
  return { w, calls };
}

afterEach(() => {
  delete (globalThis as unknown as { window?: W }).window;
  delete (globalThis as unknown as { document?: unknown }).document;
});

describe('parseHashRoute', () => {
  it('splits path, query and anchor', () => {
    expect(parseHashRoute('#/riskometer/?pair=EURUSD&event=gfc-2008')).toEqual({
      path: '/riskometer/',
      query: 'pair=EURUSD&event=gfc-2008',
      anchor: '',
    });
    expect(parseHashRoute('#/glossar/#term-pip')).toEqual({
      path: '/glossar/',
      query: '',
      anchor: 'term-pip',
    });
    expect(parseHashRoute('#/module/05-greeks/2')).toEqual({
      path: '/module/05-greeks/2/',
      query: '',
      anchor: '',
    });
    expect(parseHashRoute('#/#lernpfad')).toEqual({ path: '/', query: '', anchor: 'lernpfad' });
    expect(parseHashRoute('#term-pip')).toEqual({ path: '', query: '', anchor: 'term-pip' });
    expect(parseHashRoute('')).toEqual({ path: '', query: '', anchor: '' });
  });
});

describe('query helpers', () => {
  it('read and write the query inside the hash route (offline file)', () => {
    const { calls } = fakeWindow('#/riskometer/?pair=EURUSD#case');
    expect(isHashRouted()).toBe(true);
    expect(readQuery().get('pair')).toBe('EURUSD');
    writeQuery(new URLSearchParams('pair=USDJPY&event=carry-2024'));
    expect(calls).toEqual(['#/riskometer/?pair=USDJPY&event=carry-2024#case']);
    writeQuery(new URLSearchParams());
    expect(calls[1]).toBe('#/riskometer/#case');
  });

  it('use the search params in the web build', () => {
    const { calls, w } = fakeWindow('', '?q=delta', false);
    w.location.href = 'https://example.org/glossar/?q=delta';
    w.location.pathname = '/glossar/';
    expect(isHashRouted()).toBe(false);
    expect(readQuery().get('q')).toBe('delta');
    writeQuery(new URLSearchParams('q=gamma'));
    expect(calls).toEqual(['/glossar/?q=gamma']);
  });

  it('are safe without a window', () => {
    expect(isHashRouted()).toBe(false);
    expect(readQuery().toString()).toBe('');
    expect(() => writeQuery(new URLSearchParams('a=1'))).not.toThrow();
    expect(scrollToId('x')).toBe(false);
  });

  it('scrollToId scrolls to an element and keeps the route', () => {
    const { calls } = fakeWindow('#/glossar/');
    let scrolled = '';
    (globalThis as unknown as { document: unknown }).document = {
      getElementById: (id: string) =>
        id === 'term-pip' ? { scrollIntoView: () => (scrolled = id) } : null,
    };
    expect(scrollToId('term-pip')).toBe(true);
    expect(scrolled).toBe('term-pip');
    expect(calls).toEqual([]);
    expect(scrollToId('nope')).toBe(false);
    expect(scrollToId('')).toBe(false);
  });

  it('scrollToId records the anchor in the web build', () => {
    const { calls } = fakeWindow('', '', false);
    (globalThis as unknown as { document: unknown }).document = {
      getElementById: () => ({ scrollIntoView: () => undefined }),
    };
    expect(scrollToId('term-pip', false)).toBe(true);
    expect(calls).toEqual(['#term-pip']);
  });

  it('jumpToId marks the target, makes it focusable and focuses it', () => {
    fakeWindow('#/glossar/');
    const attrs: Record<string, Record<string, string>> = { old: { 'data-target': '' }, t: {} };
    let focused = '';
    const el = (id: string, interactive = false) => ({
      scrollIntoView: () => undefined,
      hasAttribute: (a: string) => a in attrs[id]!,
      setAttribute: (a: string, v: string) => (attrs[id]![a] = v),
      removeAttribute: (a: string) => delete attrs[id]![a],
      matches: () => interactive,
      focus: () => (focused = id),
    });
    attrs.btn = {};
    (globalThis as unknown as { document: unknown }).document = {
      getElementById: (id: string) =>
        id === 'term-pip' ? el('t') : id === 'b' ? el('btn', true) : null,
      querySelectorAll: () => [el('old')],
    };
    expect(jumpToId('term-pip')).toBe(true);
    expect(attrs.old).toEqual({});
    expect(attrs.t).toEqual({ 'data-target': '', tabindex: '-1', 'data-jump-focus': '' });
    expect(focused).toBe('t');
    // interactive elements keep their own focus behaviour
    expect(jumpToId('b')).toBe(true);
    expect(attrs.btn).toEqual({ 'data-target': '' });
    expect(focused).toBe('btn');
    expect(jumpToId('nope')).toBe(false);
  });
});
