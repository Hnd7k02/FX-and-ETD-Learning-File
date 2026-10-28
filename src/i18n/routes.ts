import type { Lang } from './types';

/** Section keys of a module page: four content sections plus the quiz. */
export const SECTION_KEYS = ['1', '2', '3', '4', 'quiz'] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

const prefix = (lang: Lang) => (lang === 'en' ? '/en' : '');

export const homePath = (lang: Lang) => `${prefix(lang)}/`;
export const modulePath = (lang: Lang, slug: string, section: SectionKey = '1') =>
  `${prefix(lang)}/module/${slug}/${section}/`;
export const riskometerPath = (lang: Lang) => `${prefix(lang)}/riskometer/`;
export const glossaryPath = (lang: Lang) => (lang === 'en' ? '/en/glossary/' : '/glossar/');
export const aboutPath = (lang: Lang) => (lang === 'en' ? '/en/about/' : '/ueber/');

/** Pages whose slug differs between languages. */
const PAIRS: Array<[de: string, en: string]> = [
  ['/glossar/', '/en/glossary/'],
  ['/ueber/', '/en/about/'],
];

/** Maps a pathname to the same page in the other language. */
export function switchLangPath(pathname: string, to: Lang): string {
  let p = pathname.endsWith('/') ? pathname : `${pathname}/`;
  for (const [de, en] of PAIRS) {
    if (to === 'en' && p.startsWith(de)) return en + p.slice(de.length);
    if (to === 'de' && p.startsWith(en)) return de + p.slice(en.length);
  }
  const isEn = p === '/en/' || p.startsWith('/en/');
  if (to === 'en') return isEn ? p : `/en${p}`;
  if (!isEn) return p;
  p = p.slice(3);
  return p === '' ? '/' : p;
}

/** Language of a pathname. */
export function langFromPath(pathname: string): Lang {
  return pathname === '/en' || pathname.startsWith('/en/') ? 'en' : 'de';
}
