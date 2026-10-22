/**
 * Calendar helpers for ISO dates ("YYYY-MM-DD"), all in UTC so the result never depends on
 * the time zone of the machine that runs the build.
 */

const DAY_MS = 86_400_000;
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True for a real calendar date written as "YYYY-MM-DD". */
export function isIsoDate(s: string): boolean {
  const m = ISO_RE.exec(s);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const t = new Date(Date.UTC(y, mo - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d;
}

/** Days since 1970-01-01 (UTC). Throws on an invalid date. */
export function dayNumber(iso: string): number {
  if (!isIsoDate(iso)) throw new Error(`Invalid ISO date: ${iso}`);
  return Math.round(Date.parse(`${iso}T00:00:00Z`) / DAY_MS);
}

/** Inverse of dayNumber. */
export function isoFromDayNumber(n: number): string {
  return new Date(n * DAY_MS).toISOString().slice(0, 10);
}

/** ISO weekday: 1 = Monday … 7 = Sunday. */
export function weekday(iso: string): number {
  // 1970-01-01 was a Thursday (ISO weekday 4).
  return ((((dayNumber(iso) + 3) % 7) + 7) % 7) + 1;
}

/** Monday of the ISO week (Monday to Sunday) that contains the date; used as a week key. */
export function isoWeekStart(iso: string): string {
  return isoFromDayNumber(dayNumber(iso) - (weekday(iso) - 1));
}

/**
 * Bank business days after `from` up to and including `to`, counting Monday to Friday only
 * (public holidays are not modelled). Returns a negative count if `to` lies before `from`.
 * Example: Friday → following Monday = 1.
 */
export function bankDaysBetween(from: string, to: string): number {
  const a = dayNumber(from);
  const b = dayNumber(to);
  if (b < a) return -bankDaysBetween(to, from);
  let count = 0;
  for (let d = a + 1; d <= b; d++) {
    const wd = ((((d + 3) % 7) + 7) % 7) + 1;
    if (wd <= 5) count++;
  }
  return count;
}

/** Today's date in UTC as ISO string. */
export function todayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}
