/**
 * Builds the Riskometer data (src/data/fx/riskometer.json) and the EUR/CHF summary
 * (src/data/fx/summary.json) from the raw ECB rows. Pure and deterministic: the same input
 * gives byte-identical output, so the daily data commit only changes when the data changes.
 */
import type { LevelIndex } from '@/i18n/dict/levels';
import type { RiskSummary } from '@/lib/risk-summary';
import type { RawRow } from './csv';
import { eventMetrics, eventsForPair, PEAK_RANGE, type EventMetrics, type MarketEvent } from './events';
import { levelOf, needle } from './levels';
import { PAIRS, pairSeries, since, weekIndexOf, weekly, type Pair } from './series';
import {
  LEVEL_PERCENTILES,
  PERCENTILE_SINCE,
  percentileRank,
  sortedValues,
  thresholds,
  yearlyMax,
  type Thresholds,
  type YearMax,
} from './stats';
import { ANNUALISATION, VOL_WINDOW, realisedVol } from './vol';

export interface RiskometerMethod {
  /** Log returns per window. */
  window: number;
  /** Trading days per year. */
  annualisation: number;
  /** Start of the percentile base, of the chart and of the yearly table. */
  since: string;
  /** Level thresholds as percentiles. */
  percentiles: number[];
  /** Default peak range around an event, in trading days. */
  peakRange: { before: number; after: number };
  /** Source id of the data. */
  source: string;
}

export interface CurrentReading {
  date: string;
  /** Realised 1-month vol in percent. */
  vol: number;
  /** Percentile rank 0..100 among daily values since `method.since`. */
  percentile: number;
  level: LevelIndex;
  /** Needle 0..5. */
  needle: number;
}

export interface PairEvent extends EventMetrics {
  /** Index into `weekly` of the week of the anchor fixing (chart marker). */
  anchorWeekIndex: number;
  /** Index into `weekly` of the week of the peak. */
  peakWeekIndex: number;
}

export interface PairData {
  current: CurrentReading;
  thresholds: Thresholds;
  events: Record<string, PairEvent>;
  yearlyMax: YearMax[];
  /** [date of the last fixing of the ISO week, vol in percent]. */
  weekly: [string, number][];
}

export interface RiskometerData {
  asOf: string;
  method: RiskometerMethod;
  pairs: Record<Pair, PairData>;
}

const round = (x: number, d: number): number => {
  const f = 10 ** d;
  const r = Math.round(x * f) / f;
  return Object.is(r, -0) ? 0 : r;
};
const r2 = (x: number) => round(x, 2);

function buildPair(rows: readonly RawRow[], pair: Pair, events: readonly MarketEvent[]): PairData {
  const series = pairSeries(rows, pair);
  const vol = realisedVol(series);
  if (vol.length === 0) throw new Error(`${pair}: not enough fixings for a ${VOL_WINDOW}-day vol`);
  const base = since(vol, PERCENTILE_SINCE);
  const sorted = sortedValues(base);
  const t = thresholds(vol, PERCENTILE_SINCE);
  const last = vol[vol.length - 1]!;
  const w = weekly(vol, PERCENTILE_SINCE);

  const ev: Record<string, PairEvent> = {};
  for (const e of eventsForPair(events, pair)) {
    const m = eventMetrics(e, series, vol, t);
    ev[e.id] = {
      from: round(m.from, 6),
      fromDate: m.fromDate,
      to: round(m.to, 6),
      toDate: m.toDate,
      movePct: r2(m.movePct),
      dayDate: m.dayDate,
      dayMovePct: r2(m.dayMovePct),
      volBefore: r2(m.volBefore),
      peak: r2(m.peak),
      peakDate: m.peakDate,
      peakLevel: m.peakLevel,
      isRecord: m.isRecord,
      anchorWeekIndex: weekIndexOf(w, m.dayDate),
      peakWeekIndex: weekIndexOf(w, m.peakDate),
    };
  }

  return {
    current: {
      date: last.date,
      vol: r2(last.value),
      percentile: round(percentileRank(sorted, last.value), 1),
      level: levelOf(last.value, t),
      needle: round(needle(last.value, t, sorted), 3),
    },
    thresholds: {
      p20: r2(t.p20),
      p60: r2(t.p60),
      p85: r2(t.p85),
      p97: r2(t.p97),
      max: r2(t.max),
      maxDate: t.maxDate,
      days: t.days,
    },
    events: ev,
    yearlyMax: yearlyMax(vol, PERCENTILE_SINCE).map((y) => ({ ...y, vol: r2(y.vol) })),
    weekly: w.map((p) => [p.date, r2(p.value)]),
  };
}

/** Full Riskometer data for the four pairs. */
export function buildRiskometer(rows: readonly RawRow[], events: readonly MarketEvent[]): RiskometerData {
  if (rows.length === 0) throw new Error('no data');
  const pairs = {} as Record<Pair, PairData>;
  for (const p of PAIRS) pairs[p] = buildPair(rows, p, events);
  return {
    asOf: rows[rows.length - 1]!.date,
    method: {
      window: VOL_WINDOW,
      annualisation: ANNUALISATION,
      since: PERCENTILE_SINCE,
      percentiles: [...LEVEL_PERCENTILES],
      peakRange: { ...PEAK_RANGE },
      source: 'ecb-reference-rates',
    },
    pairs,
  };
}

/** Summary for the nav dot and the home-page mini gauge. */
export function buildSummary(data: RiskometerData, pair: Pair = 'EUR/CHF'): RiskSummary {
  const c = data.pairs[pair].current;
  return {
    pair,
    asOf: data.asOf,
    vol: c.vol,
    level: c.level,
    percentile: c.percentile,
    needle: c.needle,
  };
}

/**
 * Deterministic JSON: two-space indentation, keys in insertion order, arrays that contain
 * only primitives on one line (so the weekly series is one line per week), trailing newline.
 */
export function toJson(value: unknown): string {
  const prim = (v: unknown) => v === null || typeof v !== 'object';
  const fmt = (v: unknown, ind: string): string => {
    if (prim(v)) return JSON.stringify(v);
    const next = ind + '  ';
    if (Array.isArray(v)) {
      if (v.length === 0) return '[]';
      if (v.every(prim)) return `[${v.map((x) => JSON.stringify(x)).join(', ')}]`;
      return `[\n${v.map((x) => next + fmt(x, next)).join(',\n')}\n${ind}]`;
    }
    const entries = Object.entries(v as Record<string, unknown>).filter(([, x]) => x !== undefined);
    if (entries.length === 0) return '{}';
    return `{\n${entries.map(([k, x]) => `${next}${JSON.stringify(k)}: ${fmt(x, next)}`).join(',\n')}\n${ind}}`;
  };
  return fmt(value, '') + '\n';
}
