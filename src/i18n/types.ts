export const LANGS = ['de', 'en'] as const;
export type Lang = (typeof LANGS)[number];

/** Number and date locale per UI language (Swiss German / British English). */
export const LOCALE: Record<Lang, string> = { de: 'de-CH', en: 'en-GB' };

export function isLang(x: unknown): x is Lang {
  return x === 'de' || x === 'en';
}

/** A bilingual string. Content data (modules, quiz, glossary) uses this shape. */
export interface L10n {
  de: string;
  en: string;
}

/**
 * Defines a dictionary namespace. TypeScript enforces that `de` and `en` have the same keys;
 * tests/unit/i18n.test.ts checks it again at runtime for every namespace.
 */
export function defineDict<const K extends string>(d: {
  de: Record<K, string>;
  en: Record<K, string>;
}): { de: Record<K, string>; en: Record<K, string> } {
  return d;
}

/** Replaces `{name}` placeholders. Unknown placeholders stay visible so tests can catch them. */
export function fill(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (m, k: string) =>
    Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k]) : m,
  );
}

/** Returns a typed translator for one namespace and language. */
export function translator<K extends string>(
  dict: { de: Record<K, string>; en: Record<K, string> },
  lang: Lang,
): (key: K, vars?: Record<string, string | number>) => string {
  const table = dict[lang];
  return (key, vars) => fill(table[key], vars);
}
