/**
 * Riskometer page: configuration, island props and pure helpers (no DOM).
 *
 * Everything that is a choice rather than a fact lives in RISKOMETER_UI (DECISIONS D-22):
 * default pair and event, marker placement, timings, breakpoints, axis rounding.
 * `buildRiskometerProps` turns the generated data into the island's props (texts filled for the
 * page language, weekly dates shared by all pairs, values rounded) so the HTML stays small.
 */
import type { LevelIndex } from '@/i18n/dict/levels';
import type { Lang } from '@/i18n/types';
import { clamp, niceTicks, scaleLinear, type Scale } from '@/lib/chart';
import { dayNumber } from '@/lib/data/dates';
import { eventTexts, type MarketEvent } from '@/lib/data/events';
import { levelOf } from '@/lib/data/levels';
import type { RiskometerData } from '@/lib/data/riskometer';
import { isPair, PAIRS, type Pair } from '@/lib/data/series';

export type { Pair };

/** Choices of the Riskometer page, all in one place. */
export const RISKOMETER_UI = {
  /** Pair shown on load (the home page's mini gauge shows the same pair). */
  defaultPair: 'EUR/CHF' as Pair,
  /**
   * Event selected when a pair is shown for the first time: the most dramatic one. Pairs not
   * listed here get the event with the highest 1-month vol peak (gfc-2008 for EUR/USD and
   * USD/JPY with today's data).
   */
  defaultEvent: { 'EUR/CHF': 'chf-shock-2015', 'USD/CHF': 'chf-shock-2015' } as Partial<
    Record<Pair, string>
  >,
  /**
   * An event marker sits on the highest weekly value between the week of the event day and the
   * week of the daily vol peak. (The daily peak alone can land on the week after the cliff: for
   * EUR/CHF 2015 the daily peak is on 12.02., the weekly value of 13.02. is already 14 %.)
   */
  markerWeek: 'weeklyPeak' as const,
  /** Needle sweep on first view: CSS animation, --ff-needle (1.4 s, easeOutCubic). */
  needleMoveMs: 700,
  /** Line and y-axis morph on a pair change (ms, easeInOutCubic). */
  morphMs: 500,
  /** Container width (CSS px) below which the chart uses the compact layout. */
  compactBelow: 640,
  /** Year tick spacing in years for the wide and the compact layout. */
  yearStep: { wide: 4, compact: 5 },
  /** Headroom above the highest weekly value before the y-axis is rounded up to a nice tick. */
  yHeadroom: 1.04,
  /** Number of y gridlines the axis aims for. */
  yTickCount: 4,
  /** Hit area of an event marker in CSS px (touch targets ≥ 44 px). */
  markerHit: 44,
  /** Minimum horizontal distance between two year tags before the later one is lifted a row. */
  tagMinGap: 40,
  /** Row height for lifted year tags (CSS px). */
  tagRow: 22,
  /** Tooltip anchoring: left-aligned below this share of the width, right-aligned above the other. */
  tipEdge: { left: 12, right: 88 },
  /** Query parameters of the deep link (?pair=EURUSD&event=gfc-2008). */
  query: { pair: 'pair', event: 'event' },
} as const;

/* ---------- Pairs ---------- */

/** "EUR/CHF" → "EURCHF" (dictionary keys and deep links). */
export const pairCode = (pair: Pair): string => pair.replace('/', '');

/** Accepts "EURUSD", "EUR/USD", "eur-usd" and "eur_usd"; null for anything else. */
export function parsePairCode(code: string | null | undefined): Pair | null {
  if (!code) return null;
  const s = code.toUpperCase().replace(/[^A-Z]/g, '');
  if (s.length !== 6) return null;
  const pair = `${s.slice(0, 3)}/${s.slice(3)}`;
  return isPair(pair) ? pair : null;
}

/* ---------- Island props ---------- */

export interface RkPairEvent {
  /** `what` plus the pair note, placeholders filled. */
  what: string;
  means: string[];
  from: number;
  to: number;
  fromDate: string;
  toDate: string;
  movePct: number;
  peak: number;
  peakDate: string;
  peakLevel: LevelIndex;
  isRecord: boolean;
  /** Index into the weekly series where the marker sits (see RISKOMETER_UI.markerWeek). */
  week: number;
}

export interface RkEvent {
  id: string;
  year: string;
  title: string;
  dateLabel: string;
  modules: Array<{ label: string; href: string }>;
  pairs: Partial<Record<Pair, RkPairEvent>>;
}

export interface RkYear {
  year: number;
  vol: number;
  date: string;
  level: LevelIndex;
}

export interface RkPair {
  /** Weekly realised vol in percent, one value per date in `dates`. */
  vols: number[];
  current: { date: string; vol: number; percentile: number; level: LevelIndex; needle: number };
  thresholds: { p20: number; p60: number; p85: number; p97: number; max: number; maxDate: string };
  yearly: RkYear[];
}

export interface RiskometerProps {
  lang: Lang;
  asOf: string;
  method: { window: number; annualisation: number; since: string; percentiles: number[] };
  /** Weekly dates (ISO, identical for every pair), comma-separated to keep the HTML small. */
  dates: string;
  pairs: Record<Pair, RkPair>;
  events: RkEvent[];
}

/** Index of the highest weekly value between two week indices (inclusive, any order). */
export function markerIndex(vols: readonly number[], a: number, b: number): number {
  const n = vols.length;
  if (n === 0) return -1;
  const lo = clamp(Math.min(a, b), 0, n - 1);
  const hi = clamp(Math.max(a, b), 0, n - 1);
  let best = lo;
  for (let i = lo + 1; i <= hi; i++) if (vols[i]! > vols[best]!) best = i;
  return best;
}

/**
 * Props of the Riskometer island for one language. Throws if the pairs do not share the weekly
 * dates (the chart morphs between pairs on the same x positions).
 */
export function buildRiskometerProps(
  data: RiskometerData,
  events: readonly MarketEvent[],
  lang: Lang,
  moduleLink: (slug: string) => { label: string; href: string },
): RiskometerProps {
  const first = data.pairs[PAIRS[0]].weekly;
  const dates = first.map(([d]) => d);
  const pairs = {} as Record<Pair, RkPair>;
  for (const pair of PAIRS) {
    const pd = data.pairs[pair];
    if (pd.weekly.length !== dates.length || pd.weekly.some(([d], i) => d !== dates[i])) {
      throw new Error(`riskometer.json: weekly dates of ${pair} differ from ${PAIRS[0]}`);
    }
    const { p20, p60, p85, p97, max, maxDate } = pd.thresholds;
    pairs[pair] = {
      vols: pd.weekly.map(([, v]) => v),
      current: { ...pd.current },
      thresholds: { p20, p60, p85, p97, max, maxDate },
      yearly: pd.yearlyMax.map((y) => ({ ...y, level: levelOf(y.vol, pd.thresholds) })),
    };
  }
  const out: RkEvent[] = events.map((e) => {
    const perPair: Partial<Record<Pair, RkPairEvent>> = {};
    for (const pair of e.pairs) {
      const m = data.pairs[pair].events[e.id];
      if (!m) throw new Error(`riskometer.json: no metrics for ${e.id} / ${pair}`);
      const texts = eventTexts(e, pair, lang, m);
      perPair[pair] = {
        what: texts.what,
        means: texts.means,
        from: m.from,
        to: m.to,
        fromDate: m.fromDate,
        toDate: m.toDate,
        movePct: m.movePct,
        peak: m.peak,
        peakDate: m.peakDate,
        peakLevel: m.peakLevel,
        isRecord: m.isRecord,
        week: markerIndex(pairs[pair].vols, m.anchorWeekIndex, m.peakWeekIndex),
      };
    }
    return {
      id: e.id,
      year: e.year,
      title: e.title[lang],
      dateLabel: e.dateLabel[lang],
      modules: e.modules.map(moduleLink),
      pairs: perPair,
    };
  });
  return {
    lang,
    asOf: data.asOf,
    method: {
      window: data.method.window,
      annualisation: data.method.annualisation,
      since: data.method.since,
      percentiles: [...data.method.percentiles],
    },
    dates: dates.join(','),
    pairs,
    events: out,
  };
}

/* ---------- Selection (pair, event, deep link) ---------- */

/** Events of a pair, in file order. */
export function eventsOfPair(events: readonly RkEvent[], pair: Pair): RkEvent[] {
  return events.filter((e) => e.pairs[pair] !== undefined);
}

/** Default event of a pair: the configured one, else the highest peak, else the first; null if none. */
export function defaultEventFor(events: readonly RkEvent[], pair: Pair): string | null {
  const own = eventsOfPair(events, pair);
  if (own.length === 0) return null;
  const wanted = RISKOMETER_UI.defaultEvent[pair];
  if (wanted && own.some((e) => e.id === wanted)) return wanted;
  let best = own[0]!;
  for (const e of own) if (e.pairs[pair]!.peak > best.pairs[pair]!.peak) best = e;
  return best.id;
}

export interface Selection {
  pair: Pair;
  event: string | null;
}

/**
 * Resolves a wanted pair and event to a valid selection: an event that exists for the pair is
 * kept (so the same event can be compared across pairs), otherwise the pair's default event is
 * used. Without a pair, an event picks the first pair it belongs to.
 */
export function resolveSelection(
  events: readonly RkEvent[],
  pair: Pair | null | undefined,
  event: string | null | undefined,
): Selection {
  let p: Pair = pair ?? RISKOMETER_UI.defaultPair;
  const ev = event ? events.find((e) => e.id === event) : undefined;
  if (!pair && ev && ev.pairs[p] === undefined) {
    p = (PAIRS.find((x) => ev.pairs[x] !== undefined) ?? p) as Pair;
  }
  return { pair: p, event: ev && ev.pairs[p] !== undefined ? ev.id : defaultEventFor(events, p) };
}

/** Reads ?pair=…&event=… from a search string (both optional, unknown values ignored). */
export function parseDeepLink(search: string): { pair: Pair | null; event: string | null } {
  const q = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const event = q.get(RISKOMETER_UI.query.event);
  return {
    pair: parsePairCode(q.get(RISKOMETER_UI.query.pair)),
    event: event && /^[a-z0-9-]+$/.test(event) ? event : null,
  };
}

/** Search string for a selection: only what differs from the defaults, '' when nothing does. */
export function deepLinkSearch(events: readonly RkEvent[], sel: Selection): string {
  const q = new URLSearchParams();
  if (sel.pair !== RISKOMETER_UI.defaultPair) q.set(RISKOMETER_UI.query.pair, pairCode(sel.pair));
  if (sel.event && sel.event !== defaultEventFor(events, sel.pair)) {
    q.set(RISKOMETER_UI.query.event, sel.event);
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}

/* ---------- Chart layout and scales ---------- */

export interface RkLayout {
  width: number;
  height: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
  font: number;
  compact: boolean;
  yearStep: number;
}

/**
 * Chart layout for a container width. The viewBox equals the container in CSS px so labels
 * keep their size at every width (as the Wow chart, D-32). Wide layout = prototype margins
 * (1000 × 340, plot 44…984 × 44…300).
 */
export function layoutFor(width: number): RkLayout {
  const w = Math.max(280, Math.round(width));
  if (w >= RISKOMETER_UI.compactBelow) {
    return {
      width: w,
      height: Math.max(240, Math.round(w * 0.34)),
      left: 44,
      right: 16,
      top: 44,
      bottom: 40,
      font: 12,
      compact: false,
      yearStep: RISKOMETER_UI.yearStep.wide,
    };
  }
  return {
    width: w,
    height: Math.max(230, Math.round(w * 0.62)),
    left: 38,
    right: 12,
    top: 40,
    bottom: 32,
    font: 11,
    compact: true,
    yearStep: RISKOMETER_UI.yearStep.compact,
  };
}

/** Day numbers of ISO dates (x positions in time, not in index space). */
export function dayNumbers(dates: readonly string[]): number[] {
  return dates.map(dayNumber);
}

export function xScaleFor(days: readonly number[], l: RkLayout): Scale {
  const d0 = days[0] ?? 0;
  const d1 = days[days.length - 1] ?? d0 + 1;
  return scaleLinear([d0, d1], [l.left, l.width - l.right]);
}

export function yScaleFor(yMax: number, l: RkLayout): Scale {
  return scaleLinear([0, yMax], [l.height - l.bottom, l.top]);
}

/** Top of the y-axis for a series maximum: a nice tick with a little headroom. */
export function yAxisMax(maxValue: number): number {
  const v = Math.max(1, maxValue) * RISKOMETER_UI.yHeadroom;
  const ticks = niceTicks(0, v, RISKOMETER_UI.yTickCount);
  const last = ticks[ticks.length - 1] ?? v;
  return last >= v ? last : last + (ticks[1]! - ticks[0]!);
}

/** Gridline values 0 … yMax. */
export function yTicksFor(yMax: number): number[] {
  return niceTicks(0, yMax, RISKOMETER_UI.yTickCount).filter((t) => t <= yMax + 1e-9);
}

/** Years to label: first year, then every `step` years, up to the last year. */
export function yearTicks(firstIso: string, lastIso: string, step: number): number[] {
  const a = Number(firstIso.slice(0, 4));
  const b = Number(lastIso.slice(0, 4));
  const out: number[] = [];
  for (let y = a; y <= b; y += Math.max(1, step)) out.push(y);
  return out;
}

/** Day number of 1 January of a year (for the x position of a year tick). */
export const yearStart = (year: number): number => dayNumber(`${year}-01-01`);

/** Linear interpolation of two equally long number lists. */
export function lerpArray(a: readonly number[], b: readonly number[], t: number): number[] {
  const n = Math.min(a.length, b.length);
  const out = new Array<number>(n);
  for (let i = 0; i < n; i++) out[i] = a[i]! + (b[i]! - a[i]!) * t;
  return out;
}

/**
 * Rows for year tags so that neighbours do not overlap: tags closer than `minGap` to an
 * already placed tag in the same row move one row up. Returns one row index per input, 0 = base.
 */
export function stackTags(xs: readonly number[], minGap = RISKOMETER_UI.tagMinGap): number[] {
  const order = xs.map((x, i) => [x, i] as const).sort((p, q) => p[0] - q[0]);
  const rows = new Array<number>(xs.length).fill(0);
  const placed: Array<{ x: number; row: number }> = [];
  for (const [x, i] of order) {
    let row = 0;
    while (placed.some((p) => p.row === row && Math.abs(p.x - x) < minGap)) row++;
    rows[i] = row;
    placed.push({ x, row });
  }
  return rows;
}

/** Horizontal shift of the tooltip in % of its width: 0 near the left edge, −100 near the right. */
export function tipShift(leftPct: number): number {
  if (leftPct < RISKOMETER_UI.tipEdge.left) return 0;
  if (leftPct > RISKOMETER_UI.tipEdge.right) return -100;
  return -50;
}

/* ---------- Texts ---------- */

/** Lower and upper bound of each level in vol percent (null = open end). */
export function levelBounds(t: {
  p20: number;
  p60: number;
  p85: number;
  p97: number;
}): Array<[number | null, number | null]> {
  return [
    [null, t.p20],
    [t.p20, t.p60],
    [t.p60, t.p85],
    [t.p85, t.p97],
    [t.p97, null],
  ];
}

/** Icon of the level chip: up for levels ≥ 3, dash for 2, down for 1 (home page, D-32). */
export function levelTrend(level: LevelIndex): 'up' | 'flat' | 'down' {
  return level >= 3 ? 'up' : level === 1 ? 'down' : 'flat';
}

export interface SeriesExtremes {
  min: number;
  minIndex: number;
  max: number;
  maxIndex: number;
}

/** Minimum and maximum of a series with their indices (first occurrence). */
export function seriesExtremes(vals: readonly number[]): SeriesExtremes {
  let minIndex = 0;
  let maxIndex = 0;
  for (let i = 1; i < vals.length; i++) {
    if (vals[i]! < vals[minIndex]!) minIndex = i;
    if (vals[i]! > vals[maxIndex]!) maxIndex = i;
  }
  return { min: vals[minIndex] ?? 0, minIndex, max: vals[maxIndex] ?? 0, maxIndex };
}

/** Number of years the chart spans ("20 Jahre"): last year minus first year. */
export function spanYears(firstIso: string, lastIso: string): number {
  return Math.max(1, Number(lastIso.slice(0, 4)) - Number(firstIso.slice(0, 4)));
}
