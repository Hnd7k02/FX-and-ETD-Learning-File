/**
 * Number and date formatting for Forward First.
 *
 * German (de-CH): apostrophe ’ (U+2019) as thousands separator, point as decimal sign,
 * percent with a no-break space ("8 %"), e.g. "CHF 12’669", "0.7930".
 * English (en-GB): comma as thousands separator, "8%".
 * Both languages use the typographic minus sign (U+2212).
 *
 * Implemented by hand instead of Intl so the output does not depend on the ICU version.
 */
import type { Lang } from '@/i18n/types';

export const MINUS = '−';
export const NBSP = ' ';
export const THIN_NBSP = ' ';
const GROUP: Record<Lang, string> = { de: '’', en: ',' };

export interface NumberOptions {
  /** Decimal places (default 0). */
  digits?: number;
  /** Show "+" for positive values. */
  sign?: boolean;
  /** Use thousands separators (default true). */
  group?: boolean;
}

/** Formats a plain number, e.g. fmtNumber(12669.4, 'de') → "12’669". */
export function fmtNumber(x: number, lang: Lang, opts: NumberOptions = {}): string {
  const { digits = 0, sign = false, group = true } = opts;
  if (!Number.isFinite(x)) return x > 0 ? '∞' : x < 0 ? `${MINUS}∞` : '–';
  const fixed = Math.abs(x).toFixed(digits);
  const isZero = Number(fixed) === 0;
  const [int = '0', frac] = fixed.split('.');
  const intGrouped = group ? int.replace(/\B(?=(\d{3})+(?!\d))/g, GROUP[lang]) : int;
  const body = frac !== undefined ? `${intGrouped}.${frac}` : intGrouped;
  if (x < 0 && !isZero) return MINUS + body;
  if (sign && !isZero) return `+${body}`;
  return body;
}

/** True if the pair is quoted with 2 decimals (JPY pairs). */
export function isJpyPair(pair: string): boolean {
  return pair.toUpperCase().includes('JPY');
}

/** Exchange rate: 4 decimals, JPY pairs 2 decimals. No thousands separator. */
export function fmtRate(x: number, pair = 'USD/CHF', digits?: number): string {
  const d = digits ?? (isJpyPair(pair) ? 2 : 4);
  return fmtNumber(x, 'en', { digits: d, group: false });
}

/** Size of one pip: 0.0001, for JPY pairs 0.01. */
export function pipSize(pair = 'USD/CHF'): number {
  return isJpyPair(pair) ? 0.01 : 0.0001;
}

/** Price difference expressed in pips. */
export function toPips(diff: number, pair = 'USD/CHF'): number {
  return diff / pipSize(pair);
}

/** Pips, e.g. "126.7" or "−69.7" (with sign option "+12.0"). */
export function fmtPips(pips: number, lang: Lang, digits = 1, sign = false): string {
  return fmtNumber(pips, lang, { digits, sign });
}

/** Percent from a fraction: fmtPct(0.08, 'de') → "8.0 %"; fmtPct(0.08, 'en') → "8.0%". */
export function fmtPct(fraction: number, lang: Lang, digits = 1, sign = false): string {
  const n = fmtNumber(fraction * 100, lang, { digits, sign });
  return lang === 'de' ? `${n}${NBSP}%` : `${n}%`;
}

/** Percent from a value already in percent: fmtPctValue(6.04, 'de') → "6.0 %". */
export function fmtPctValue(percent: number, lang: Lang, digits = 1, sign = false): string {
  return fmtPct(percent / 100, lang, digits, sign);
}

/** Money: fmtMoney(12669, 'CHF', 'de') → "CHF 12’669". */
export function fmtMoney(x: number, ccy: string, lang: Lang, digits = 0, sign = false): string {
  return `${ccy}${NBSP}${fmtNumber(x, lang, { digits, sign })}`;
}

/** Compact money: 1’000’000 → "1 Mio." / "1m". */
export function fmtMillions(x: number, ccy: string, lang: Lang, digits = 0): string {
  const n = fmtNumber(x / 1e6, lang, { digits });
  return lang === 'de' ? `${ccy}${NBSP}${n}${NBSP}Mio.` : `${ccy}${NBSP}${n}m`;
}

const MONTHS: Record<Lang, string[]> = {
  de: [
    'Jan.',
    'Feb.',
    'März',
    'Apr.',
    'Mai',
    'Juni',
    'Juli',
    'Aug.',
    'Sept.',
    'Okt.',
    'Nov.',
    'Dez.',
  ],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};
const MONTHS_LONG: Record<Lang, string[]> = {
  de: [
    'Januar',
    'Februar',
    'März',
    'April',
    'Mai',
    'Juni',
    'Juli',
    'August',
    'September',
    'Oktober',
    'November',
    'Dezember',
  ],
  en: [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ],
};

function parseIso(iso: string): [number, number, number] {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) throw new Error(`Invalid ISO date: ${iso}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** Date: de "15.01.2015", en "15 Jan 2015". Input ISO "YYYY-MM-DD". */
export function fmtDate(iso: string, lang: Lang): string {
  const [y, mo, d] = parseIso(iso);
  if (lang === 'de') return `${String(d).padStart(2, '0')}.${String(mo).padStart(2, '0')}.${y}`;
  return `${d} ${MONTHS.en[mo - 1]} ${y}`;
}

/** Month and year: de "Jan. 2015", en "Jan 2015". */
export function fmtMonthYear(iso: string, lang: Lang): string {
  const [y, mo] = parseIso(iso);
  return `${MONTHS[lang][mo - 1]} ${y}`;
}

/** Long date: de "15. Januar 2015", en "15 January 2015". */
export function fmtDateLong(iso: string, lang: Lang): string {
  const [y, mo, d] = parseIso(iso);
  return lang === 'de'
    ? `${d}. ${MONTHS_LONG.de[mo - 1]} ${y}`
    : `${d} ${MONTHS_LONG.en[mo - 1]} ${y}`;
}
