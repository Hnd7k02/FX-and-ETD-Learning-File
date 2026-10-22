/**
 * Validation of the raw ECB data before anything is computed or committed (MASTER_PROMPT §9).
 *
 * Rules (each error names its rule):
 *  - empty      at least one row
 *  - date       every date is a real "YYYY-MM-DD" date
 *  - order      dates strictly ascending …
 *  - duplicate  … and no date twice
 *  - rate       every rate is a finite number > 0 (an empty cell is a missing rate)
 *  - future     no date after `today`
 *  - stale      the last date is at most `maxAgeBankDays` bank business days (Mon–Fri) before
 *               `today`; skipped when no `today` is given
 *  - jump       |daily log return| < 10 % for EUR/CHF, EUR/USD, USD/CHF and USD/JPY (cross
 *               rates included), except for the documented whitelist below
 *
 * The 10 % bound is far outside normal G10 moves (the largest other daily move in the seed is
 * well below it) but catches decimal-point and unit errors, which move a rate by a factor ≥ 10.
 */
import { CURRENCIES, type RawRow } from './csv';
import { bankDaysBetween, isIsoDate } from './dates';
import { PAIRS, crossRate, type Pair } from './series';

export type ValidationRule =
  | 'empty'
  | 'date'
  | 'order'
  | 'duplicate'
  | 'rate'
  | 'future'
  | 'stale'
  | 'jump'
  | 'continuity';

export interface ValidationError {
  rule: ValidationRule;
  message: string;
  date?: string;
  pair?: Pair;
}

export interface WhitelistEntry {
  date: string;
  pair: Pair;
  /** Why the jump is genuine, with the id of the source in src/content/sources. */
  reason: string;
}

/**
 * Documented exceptions to the jump rule. 15.01.2015: the SNB discontinued the minimum
 * exchange rate of CHF 1.20 per euro (source snb-2015-01-15); the ECB fixing of that day
 * shows EUR/CHF and USD/CHF about 15 % lower than the day before.
 */
export const DEFAULT_WHITELIST: readonly WhitelistEntry[] = [
  { date: '2015-01-15', pair: 'EUR/CHF', reason: 'SNB discontinues the 1.20 floor (snb-2015-01-15)' },
  { date: '2015-01-15', pair: 'USD/CHF', reason: 'SNB discontinues the 1.20 floor (snb-2015-01-15)' },
];

export const MAX_ABS_LOG_RETURN = 0.1;
export const MAX_AGE_BANK_DAYS = 5;

export interface ValidationOptions {
  /** ISO date of the run; enables the "future" and "stale" checks. */
  today?: string;
  maxAgeBankDays?: number;
  whitelist?: readonly WhitelistEntry[];
  maxAbsLogReturn?: number;
}

function pct(x: number): string {
  return `${(x * 100).toFixed(2)} %`;
}

/** Validates raw rows; returns the list of errors (empty = valid). */
export function validate(rows: readonly RawRow[], opts: ValidationOptions = {}): ValidationError[] {
  const {
    today,
    maxAgeBankDays = MAX_AGE_BANK_DAYS,
    whitelist = DEFAULT_WHITELIST,
    maxAbsLogReturn = MAX_ABS_LOG_RETURN,
  } = opts;
  const errors: ValidationError[] = [];
  if (rows.length === 0) return [{ rule: 'empty', message: 'no data rows' }];

  let datesOk = true;
  rows.forEach((r, i) => {
    if (!isIsoDate(r.date)) {
      datesOk = false;
      errors.push({ rule: 'date', date: r.date, message: `row ${i + 1}: invalid date "${r.date}"` });
    }
    for (const ccy of CURRENCIES) {
      const v = r[ccy];
      if (!Number.isFinite(v) || v <= 0) {
        errors.push({
          rule: 'rate',
          date: r.date,
          message: `${r.date}: ${ccy} per EUR must be a number > 0, got "${Number.isNaN(v) ? '' : v}"`,
        });
      }
    }
    if (i > 0) {
      const prev = rows[i - 1]!.date;
      if (r.date === prev) {
        errors.push({ rule: 'duplicate', date: r.date, message: `${r.date} appears twice` });
      } else if (r.date < prev) {
        errors.push({ rule: 'order', date: r.date, message: `${r.date} follows ${prev}` });
      }
    }
  });

  if (today !== undefined && datesOk) {
    const last = rows[rows.length - 1]!.date;
    if (last > today) {
      errors.push({ rule: 'future', date: last, message: `last date ${last} is after ${today}` });
    } else {
      const age = bankDaysBetween(last, today);
      if (age > maxAgeBankDays) {
        errors.push({
          rule: 'stale',
          date: last,
          message: `last date ${last} is ${age} bank days before ${today} (max ${maxAgeBankDays})`,
        });
      }
    }
  }

  const allowed = new Set(whitelist.map((w) => `${w.date}|${w.pair}`));
  for (const pair of PAIRS) {
    for (let i = 1; i < rows.length; i++) {
      const a = crossRate(rows[i - 1]!, pair);
      const b = crossRate(rows[i]!, pair);
      if (!(a > 0 && b > 0)) continue; // reported by the rate rule
      const r = Math.log(b / a);
      const date = rows[i]!.date;
      if (Math.abs(r) >= maxAbsLogReturn && !allowed.has(`${date}|${pair}`)) {
        errors.push({
          rule: 'jump',
          date,
          pair,
          message: `${pair} ${date}: daily log return ${pct(r)} exceeds ±${pct(maxAbsLogReturn)}`,
        });
      }
    }
  }
  return errors;
}

/** All daily log returns with |r| ≥ bound, whitelisted or not (for reports). */
export function largeMoves(
  rows: readonly RawRow[],
  bound = MAX_ABS_LOG_RETURN,
): { date: string; pair: Pair; logReturn: number }[] {
  const out: { date: string; pair: Pair; logReturn: number }[] = [];
  for (const pair of PAIRS) {
    for (let i = 1; i < rows.length; i++) {
      const r = Math.log(crossRate(rows[i]!, pair) / crossRate(rows[i - 1]!, pair));
      if (Math.abs(r) >= bound) out.push({ date: rows[i]!.date, pair, logReturn: r });
    }
  }
  return out;
}

export interface ContinuityReport {
  errors: ValidationError[];
  /** Dates in `next` that are not in `prev`. */
  added: number;
  /** Dates present in both with a different value for at least one currency (ECB revisions). */
  revised: string[];
}

/**
 * Compares freshly fetched data with the versioned file so a truncated download can never
 * replace the history: every date of `prev` must still be there and `next` may not end earlier.
 */
export function checkContinuity(prev: readonly RawRow[], next: readonly RawRow[]): ContinuityReport {
  const errors: ValidationError[] = [];
  const nextByDate = new Map(next.map((r) => [r.date, r]));
  const prevDates = new Set(prev.map((r) => r.date));
  const missing: string[] = [];
  const revised: string[] = [];
  for (const r of prev) {
    const n = nextByDate.get(r.date);
    if (!n) missing.push(r.date);
    else if (CURRENCIES.some((c) => !Object.is(n[c], r[c]))) revised.push(r.date);
  }
  if (missing.length > 0) {
    errors.push({
      rule: 'continuity',
      date: missing[0],
      message: `${missing.length} date(s) of the existing file are missing in the new data, first ${missing[0]}`,
    });
  }
  const prevLast = prev[prev.length - 1]?.date;
  const nextLast = next[next.length - 1]?.date;
  if (prevLast && (!nextLast || nextLast < prevLast)) {
    errors.push({
      rule: 'continuity',
      date: nextLast,
      message: `new data ends ${nextLast ?? '(empty)'}, before the existing ${prevLast}`,
    });
  }
  const added = next.filter((r) => !prevDates.has(r.date)).length;
  return { errors, added, revised };
}
