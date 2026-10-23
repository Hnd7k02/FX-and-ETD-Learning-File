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

/* ---------- Scenarios: textbook tendencies by role ---------- */

export type G10Scenario = 'none' | 'riskOff' | 'riskOn' | 'commodityBoom';
export const G10_SCENARIOS: readonly G10Scenario[] = ['none', 'riskOff', 'riskOn', 'commodityBoom'];
export type Tendency = 'up' | 'down' | 'flat';

/**
 * One config object for the scenario view (D-22). Each scenario maps a ROLE to a tendency of the
 * currency against the others; a currency without a matching role stays 'flat' ("no clear
 * tendency"). Textbook tendencies, not laws: there are crises in which they fail, and the module
 * text shows a sourced counter-example.
 * - riskOff (crisis, flight to safety): safe havens tend to gain, commodity currencies to lose.
 * - riskOn (calm markets, carry trades are built): funding currencies tend to lose (they are
 *   borrowed and sold), pro-cyclical commodity currencies to gain.
 * - commodityBoom (commodity prices rise): commodity currencies tend to gain.
 * A role listed under 'up' wins over the same currency's role under 'down' (JPY and CHF are
 * both safe haven and funding currency).
 */
export const G10_SCENARIO_RULES: Record<
  Exclude<G10Scenario, 'none'>,
  { up: readonly G10Role[]; down: readonly G10Role[] }
> = {
  riskOff: { up: ['safeHaven'], down: ['commodity'] },
  riskOn: { up: ['commodity'], down: ['funding'] },
  commodityBoom: { up: ['commodity'], down: [] },
};

/** Tendency of a currency in a scenario ('flat' = no clear tendency). */
export function tendency(code: G10Code, scenario: G10Scenario): Tendency {
  if (scenario === 'none') return 'flat';
  const rule = G10_SCENARIO_RULES[scenario];
  const { roles } = profileOf(code);
  if (roles.some((r) => rule.up.includes(r))) return 'up';
  if (roles.some((r) => rule.down.includes(r))) return 'down';
  return 'flat';
}

/** Codes per tendency in a scenario (for the summary line and the screen-reader text). */
export function tendencies(scenario: G10Scenario): Record<Tendency, G10Code[]> {
  const out: Record<Tendency, G10Code[]> = { up: [], down: [], flat: [] };
  for (const p of G10) out[tendency(p.code, scenario)].push(p.code);
  return out;
}

/* ---------- Market convention of the usual pair ---------- */

export interface PairConvention {
  pair: string;
  base: string;
  quote: string;
  /** Decimals of the quote (4, JPY pairs 2). */
  decimals: 2 | 4;
  /** Size of one pip (0.0001, JPY pairs 0.01). */
  pip: number;
  /** Value of one pip on 1 Mio. units of the base currency, in the quote currency. */
  pipValuePerMillion: number;
  /** Spot value date in business days (T+2, USD/CAD T+1). */
  spotDays: 1 | 2;
}

/** Quoting convention of a currency's usual pair (see section 3 of the module). */
export function pairConvention(code: G10Code): PairConvention {
  const p = profileOf(code);
  const [base = '', quote = ''] = p.pair.split('/');
  const jpy = p.pair.includes('JPY');
  const pip = jpy ? 0.01 : 0.0001;
  return {
    pair: p.pair,
    base,
    quote,
    decimals: jpy ? 2 : 4,
    pip,
    pipValuePerMillion: Math.round(pip * 1_000_000 * 1e6) / 1e6,
    spotDays: p.spotDays,
  };
}
