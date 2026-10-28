import type { Lang } from '@/i18n/types';

/** Language of the page being rendered (from Astro's i18n routing). */
export function pageLang(currentLocale: string | undefined, override?: Lang): Lang {
  if (override) return override;
  return currentLocale === 'en' ? 'en' : 'de';
}
