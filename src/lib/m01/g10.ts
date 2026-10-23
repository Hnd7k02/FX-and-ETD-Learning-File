/**
 * Module 01, section 4: the ten G10 currencies and their typical roles.
 *
 * Roles are textbook tendencies, not laws of nature: a funding currency needs a low interest
 * rate, a safe haven is sought in crises, a commodity currency follows its main exports. The
 * texts (central bank, drivers) live in src/i18n/dict/g10profiles.ts; this file holds the
 * structure so it can be filtered and tested. Order: as in MASTER_PROMPT §10.
 */

export type G10Code = 'USD' | 'EUR' | 'JPY' | 'GBP' | 'CHF' | 'AUD' | 'NZD' | 'CAD' | 'NOK' | 'SEK';
export type G10Role = 'reserve' | 'safeHaven' | 'commodity' | 'funding';

export const G10_ROLES: readonly G10Role[] = ['reserve', 'safeHaven', 'commodity', 'funding'];

export interface G10Profile {
  code: G10Code;
  roles: readonly G10Role[];
  /** Usual pair against the dollar or the euro, in market quoting order (base/quote). */
  pair: string;
  /** Spot value date of that pair in business days (USD/CAD settles T+1). */
  spotDays: 1 | 2;
}

export const G10: readonly G10Profile[] = [
  { code: 'USD', roles: ['reserve', 'safeHaven'], pair: 'EUR/USD', spotDays: 2 },
  { code: 'EUR', roles: ['reserve'], pair: 'EUR/USD', spotDays: 2 },
  { code: 'JPY', roles: ['safeHaven', 'funding'], pair: 'USD/JPY', spotDays: 2 },
  { code: 'GBP', roles: [], pair: 'GBP/USD', spotDays: 2 },
  { code: 'CHF', roles: ['safeHaven', 'funding'], pair: 'USD/CHF', spotDays: 2 },
  { code: 'AUD', roles: ['commodity'], pair: 'AUD/USD', spotDays: 2 },
  { code: 'NZD', roles: ['commodity'], pair: 'NZD/USD', spotDays: 2 },
  { code: 'CAD', roles: ['commodity'], pair: 'USD/CAD', spotDays: 1 },
  { code: 'NOK', roles: ['commodity'], pair: 'EUR/NOK', spotDays: 2 },
  { code: 'SEK', roles: [], pair: 'EUR/SEK', spotDays: 2 },
];

export type G10Filter = 'all' | G10Role;

/** Codes matching a role filter ('all' → every currency). */
export function matchingCodes(filter: G10Filter): G10Code[] {
  return G10.filter((p) => filter === 'all' || p.roles.includes(filter)).map((p) => p.code);
}

/** Profile of a code. */
export function profileOf(code: G10Code): G10Profile {
  const p = G10.find((x) => x.code === code);
  if (!p) throw new RangeError(`unknown G10 code ${code}`);
  return p;
}

/**
 * The currency to show after a filter change: keep the current one if it still matches,
 * otherwise the first match.
 */
export function selectionAfterFilter(current: G10Code, filter: G10Filter): G10Code {
  const m = matchingCodes(filter);
  return m.includes(current) ? current : (m[0] ?? current);
}
