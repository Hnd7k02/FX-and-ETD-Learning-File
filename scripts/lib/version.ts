/**
 * Version of the offline file (DECISIONS D-41). The number lives only here: the build shows it
 * while loading and on the About page and names the copy release/forward-first-v<number>.html;
 * the tests read it from here.
 */
export const OFFLINE_VERSION = { number: 5 } as const;

/** File name of the versioned copy. */
export const versionedFileName = (n: number = OFFLINE_VERSION.number) => `forward-first-v${n}.html`;

/**
 * Build date as ISO date (yyyy-mm-dd) in Europe/Zurich. SOURCE_DATE_EPOCH (seconds since 1970,
 * the reproducible-builds convention) wins when set.
 */
export function buildDate(env: Record<string, string | undefined> = process.env): string {
  const epoch = env.SOURCE_DATE_EPOCH;
  const at = epoch && /^[0-9]+$/.test(epoch) ? new Date(Number(epoch) * 1000) : new Date();
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Zurich',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
}
