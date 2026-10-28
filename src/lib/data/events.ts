/**
 * Market events of the Riskometer (src/data/events.json) and their key figures.
 *
 * ── Placeholder contract ────────────────────────────────────────────────────────────────
 * The texts `what`, `pairNote[pair]` and `means[]` (DE and EN) never contain a number that the
 * data can compute. They use placeholders that are filled per pair from the ECB data:
 *
 *   {pair}         the pair, e.g. "EUR/CHF"
 *   {from}         rate at the first fixing on/after window.from   (4 decimals, JPY pairs 2)
 *   {to}           rate at the last fixing on/before window.to
 *   {fromDate}     date of that first fixing                          ("02.09.2008" / "2 Sep 2008")
 *   {toDate}       date of that last fixing
 *   {movePct}      change from {from} to {to} in percent, signed     ("−10.3 %" / "−10.3%")
 *   {moveAbsPct}   the same without sign                              ("10.3 %")
 *   {dayDate}      first fixing on/after anchorDate (the day the event shows in the fixings)
 *   {dayMovePct}   change on {dayDate} against the fixing before, signed
 *   {dayMoveAbsPct} the same without sign
 *   {volBefore}    1-month realised vol on the fixing before {dayDate} ("1.3 %")
 *   {peak}         highest 1-month vol from `peakRange.before` trading days before to
 *                  `peakRange.after` trading days after {dayDate} (default 10 and 60)
 *   {peakDate}     date of that peak
 *   {peakLevel}    Riskometer level of that peak for this pair ("Hoch" / "High")
 *
 * Sourced historical facts (dates, the 1.20 floor, −0.75 %) are plain text; every event lists
 * the ids of its sources (src/content/sources/riskometer.md). Pair-specific sentences go into
 * `pairNote` (appended to `what` for that pair) or into a `means` item with `pairs`.
 * `parseEvents` enforces the contract; tests check that every text fills completely.
 * ─────────────────────────────────────────────────────────────────────────────────────────
 */
import { fmtDate, fmtPctValue, fmtRate } from '@/lib/format';
import { fill, type L10n, type Lang } from '@/i18n/types';
import { levels, type LevelIndex } from '@/i18n/dict/levels';
import { isIsoDate } from './dates';
import { levelOf } from './levels';
import { indexOnOrAfter, indexOnOrBefore, isPair, type Pair, type Point } from './series';
import type { Thresholds } from './stats';

export const PLACEHOLDERS = [
  'pair',
  'from',
  'to',
  'fromDate',
  'toDate',
  'movePct',
  'moveAbsPct',
  'dayDate',
  'dayMovePct',
  'dayMoveAbsPct',
  'volBefore',
  'peak',
  'peakDate',
  'peakLevel',
] as const;
export type Placeholder = (typeof PLACEHOLDERS)[number];

/** Default range for the vol peak, in trading days around the anchor fixing. */
export const PEAK_RANGE = { before: 10, after: 60 } as const;

export interface EventWindow {
  from: string;
  to: string;
}

/** One bullet of "Was es bedeutet"; `pairs` limits it to some pairs of the event. */
export interface EventMeaning extends L10n {
  pairs?: Pair[];
}

export interface MarketEvent {
  id: string;
  /** Day of the event (ISO). */
  anchorDate: string;
  /** Short label on the chart marker, e.g. "2015". */
  year: string;
  /** Pairs for which the event is shown. */
  pairs: Pair[];
  /** Window for the exchange-rate move {from} → {to}. */
  window: EventWindow;
  /**
   * Optional narrower peak range (trading days), when the default 60 days after the anchor
   * would reach into a later, unrelated event.
   */
  peakRange?: { before: number; after: number };
  title: L10n;
  dateLabel: L10n;
  what: L10n;
  pairNote?: Partial<Record<Pair, L10n>>;
  means: EventMeaning[];
  /** Module slugs ("Vertiefen in"). */
  modules: string[];
  /** Source ids (## headings in src/content/sources/*.md). */
  sources: string[];
}

export interface EventMetrics {
  from: number;
  fromDate: string;
  to: number;
  toDate: string;
  /** (to / from − 1) · 100 */
  movePct: number;
  dayDate: string;
  /** Change on dayDate against the previous fixing, in percent. */
  dayMovePct: number;
  /** Vol (percent) on the fixing before dayDate. */
  volBefore: number;
  /** Highest vol (percent) in the peak range and its date. */
  peak: number;
  peakDate: string;
  /** Level of the peak by the pair's thresholds. */
  peakLevel: LevelIndex;
  /** True if the peak is the highest daily value of the percentile base (since 2006). */
  isRecord: boolean;
}

/**
 * Key figures of an event for one pair.
 * @param pair   daily exchange rates of the pair (ascending)
 * @param vol    daily realised vol of the pair in percent (ascending)
 * @param t      level thresholds of the pair (for peakLevel and isRecord)
 */
export function eventMetrics(
  event: Pick<MarketEvent, 'id' | 'anchorDate' | 'window' | 'peakRange'>,
  pair: readonly Point[],
  vol: readonly Point[],
  t: Thresholds,
): EventMetrics {
  const iFrom = indexOnOrAfter(pair, event.window.from);
  const iTo = indexOnOrBefore(pair, event.window.to);
  if (iFrom >= pair.length || iTo < iFrom) {
    throw new Error(`${event.id}: no fixings in window ${event.window.from} … ${event.window.to}`);
  }
  const iDay = indexOnOrAfter(pair, event.anchorDate);
  if (iDay < 1 || iDay >= pair.length) {
    throw new Error(`${event.id}: anchor ${event.anchorDate} is outside the data`);
  }
  const a = indexOnOrAfter(vol, pair[iDay]!.date);
  if (a < 1 || a >= vol.length) {
    throw new Error(`${event.id}: no vol around ${event.anchorDate}`);
  }
  const range = event.peakRange ?? PEAK_RANGE;
  const lo = Math.max(0, a - range.before);
  const hi = Math.min(vol.length - 1, a + range.after);
  let peak = vol[lo]!;
  for (let i = lo + 1; i <= hi; i++) if (vol[i]!.value > peak.value) peak = vol[i]!;
  const from = pair[iFrom]!;
  const to = pair[iTo]!;
  return {
    from: from.value,
    fromDate: from.date,
    to: to.value,
    toDate: to.date,
    movePct: (to.value / from.value - 1) * 100,
    dayDate: pair[iDay]!.date,
    dayMovePct: (pair[iDay]!.value / pair[iDay - 1]!.value - 1) * 100,
    volBefore: vol[a - 1]!.value,
    peak: peak.value,
    peakDate: peak.date,
    peakLevel: levelOf(peak.value, t),
    isRecord: peak.date === t.maxDate,
  };
}

/** Formatted values for all placeholders. */
export function eventVars(m: EventMetrics, pair: Pair, lang: Lang): Record<Placeholder, string> {
  return {
    pair,
    from: fmtRate(m.from, pair),
    to: fmtRate(m.to, pair),
    fromDate: fmtDate(m.fromDate, lang),
    toDate: fmtDate(m.toDate, lang),
    movePct: fmtPctValue(m.movePct, lang, 1, true),
    moveAbsPct: fmtPctValue(Math.abs(m.movePct), lang, 1),
    dayDate: fmtDate(m.dayDate, lang),
    dayMovePct: fmtPctValue(m.dayMovePct, lang, 1, true),
    dayMoveAbsPct: fmtPctValue(Math.abs(m.dayMovePct), lang, 1),
    volBefore: fmtPctValue(m.volBefore, lang, 1),
    peak: fmtPctValue(m.peak, lang, 1),
    peakDate: fmtDate(m.peakDate, lang),
    peakLevel: levels[lang][`level.${m.peakLevel}`],
  };
}

export interface EventTexts {
  title: string;
  dateLabel: string;
  /** `what` followed by the pair note, placeholders filled. */
  what: string;
  means: string[];
}

/** Texts of an event for one pair and language, with all placeholders filled. */
export function eventTexts(
  event: MarketEvent,
  pair: Pair,
  lang: Lang,
  metrics: EventMetrics,
): EventTexts {
  const vars = eventVars(metrics, pair, lang);
  const note = event.pairNote?.[pair];
  const what = note ? `${event.what[lang]} ${note[lang]}` : event.what[lang];
  return {
    title: event.title[lang],
    dateLabel: event.dateLabel[lang],
    what: fill(what, vars),
    means: event.means
      .filter((m) => !m.pairs || m.pairs.includes(pair))
      .map((m) => fill(m[lang], vars)),
  };
}

/** Events that apply to a pair, in file order. */
export function eventsForPair(events: readonly MarketEvent[], pair: Pair): MarketEvent[] {
  return events.filter((e) => e.pairs.includes(pair));
}

// ── Runtime validation of events.json ─────────────────────────────────────────────────────

const ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function fail(msg: string): never {
  throw new Error(`events.json: ${msg}`);
}

function isObj(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function checkText(x: unknown, where: string, placeholders: boolean): L10n {
  if (!isObj(x)) fail(`${where} must be {de, en}`);
  for (const lang of ['de', 'en'] as const) {
    const s = x[lang];
    if (typeof s !== 'string' || s.trim() === '') fail(`${where}.${lang} must be a non-empty text`);
    for (const m of s.matchAll(/\{([^}]*)\}/g)) {
      if (!placeholders) fail(`${where}.${lang} may not contain placeholders`);
      if (!(PLACEHOLDERS as readonly string[]).includes(m[1]!)) {
        fail(`${where}.${lang}: unknown placeholder {${m[1]}}`);
      }
    }
  }
  return x as unknown as L10n;
}

function checkPairs(x: unknown, where: string, allowed?: readonly Pair[]): Pair[] {
  if (!Array.isArray(x) || x.length === 0) fail(`${where} must be a non-empty list of pairs`);
  for (const p of x) {
    if (!isPair(p)) fail(`${where}: unknown pair ${String(p)}`);
    if (allowed && !allowed.includes(p)) fail(`${where}: ${p} is not a pair of the event`);
  }
  return x as Pair[];
}

function checkDate(x: unknown, where: string): string {
  if (typeof x !== 'string' || !isIsoDate(x)) fail(`${where} must be an ISO date`);
  return x;
}

function checkIds(x: unknown, where: string): string[] {
  if (!Array.isArray(x) || x.length === 0) fail(`${where} must be a non-empty list`);
  for (const s of x)
    if (typeof s !== 'string' || !ID_RE.test(s)) fail(`${where}: bad id ${String(s)}`);
  return x as string[];
}

/** Validates the parsed events.json and returns it typed. Throws on the first problem. */
export function parseEvents(json: unknown): MarketEvent[] {
  if (!Array.isArray(json)) fail('top level must be a list');
  const seen = new Set<string>();
  return json.map((e, k): MarketEvent => {
    if (!isObj(e)) fail(`event ${k} must be an object`);
    const id = e.id;
    if (typeof id !== 'string' || !ID_RE.test(id)) fail(`event ${k}: bad id`);
    if (seen.has(id)) fail(`duplicate id ${id}`);
    seen.add(id);
    const anchorDate = checkDate(e.anchorDate, `${id}.anchorDate`);
    if (typeof e.year !== 'string' || e.year === '') fail(`${id}.year must be a text`);
    const pairs = checkPairs(e.pairs, `${id}.pairs`);
    if (!isObj(e.window)) fail(`${id}.window must be {from, to}`);
    const window = {
      from: checkDate(e.window.from, `${id}.window.from`),
      to: checkDate(e.window.to, `${id}.window.to`),
    };
    if (!(window.from < window.to && window.from <= anchorDate && anchorDate <= window.to)) {
      fail(`${id}.window must satisfy from < to and from ≤ anchorDate ≤ to`);
    }
    let peakRange: MarketEvent['peakRange'];
    if (e.peakRange !== undefined) {
      const r = e.peakRange;
      if (
        !isObj(r) ||
        !Number.isInteger(r.before) ||
        !Number.isInteger(r.after) ||
        (r.before as number) < 0 ||
        (r.after as number) < 1
      ) {
        fail(`${id}.peakRange must be {before ≥ 0, after ≥ 1} in trading days`);
      }
      peakRange = { before: r.before as number, after: r.after as number };
    }
    let pairNote: MarketEvent['pairNote'];
    if (e.pairNote !== undefined) {
      if (!isObj(e.pairNote)) fail(`${id}.pairNote must be an object`);
      pairNote = {};
      for (const [p, t] of Object.entries(e.pairNote)) {
        checkPairs([p], `${id}.pairNote`, pairs);
        pairNote[p as Pair] = checkText(t, `${id}.pairNote.${p}`, true);
      }
    }
    if (!Array.isArray(e.means) || e.means.length === 0) fail(`${id}.means must be a list`);
    const means = e.means.map((m: unknown, i: number): EventMeaning => {
      const t = checkText(m, `${id}.means[${i}]`, true);
      const mp = (m as Record<string, unknown>).pairs;
      const out: EventMeaning = { de: t.de, en: t.en };
      if (mp !== undefined) out.pairs = checkPairs(mp, `${id}.means[${i}].pairs`, pairs);
      return out;
    });
    const ev: MarketEvent = {
      id,
      anchorDate,
      year: e.year,
      pairs,
      window,
      title: checkText(e.title, `${id}.title`, false),
      dateLabel: checkText(e.dateLabel, `${id}.dateLabel`, false),
      what: checkText(e.what, `${id}.what`, true),
      means,
      modules: checkIds(e.modules, `${id}.modules`),
      sources: checkIds(e.sources, `${id}.sources`),
    };
    if (peakRange) ev.peakRange = peakRange;
    if (pairNote) ev.pairNote = pairNote;
    return ev;
  });
}
