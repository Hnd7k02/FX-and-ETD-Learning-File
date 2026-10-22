/**
 * Riskometer page island (MASTER_PROMPT §9, docs/design/Riskometer.dc.html): header with pair
 * switcher, "Heute" card with the gauge, history chart, case card (aria-live) and the yearly
 * table as text alternative. Rendered on the server for the default pair and hydrated with
 * client:load. Props come from buildRiskometerProps (src/lib/riskometer-ui.ts); every string
 * comes from src/i18n/dict/riskometer.ts and levels.ts.
 *
 * Deep links: ?pair=EURUSD&event=gfc-2008 is read on load; after the first interaction the
 * selection is written back with history.replaceState (only what differs from the defaults).
 */
import type { JSX } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { usePrefersReducedMotion } from '@/components/ui/hooks';
import { LEVEL_COLORS, levels, type LevelIndex } from '@/i18n/dict/levels';
import { riskometer as dict } from '@/i18n/dict/riskometer';
import { translator } from '@/i18n/types';
import { PAIRS, type Pair } from '@/lib/data/series';
import { fmtDate, fmtNumber, fmtPctValue, fmtRate } from '@/lib/format';
import {
  dayNumbers,
  deepLinkSearch,
  eventsOfPair,
  levelBounds,
  levelTrend,
  parseDeepLink,
  parseNumbers,
  resolveSelection,
  seriesExtremes,
  spanYears,
  type RiskometerProps,
  type Selection,
} from '@/lib/riskometer-ui';
import { RiskometerChart, type ChartMarker } from './RiskometerChart';
import { RiskometerGauge } from './RiskometerGauge';

const H1_KEY = {
  'EUR/CHF': 'rk.h1.EURCHF',
  'USD/CHF': 'rk.h1.USDCHF',
  'EUR/USD': 'rk.h1.EURUSD',
  'USD/JPY': 'rk.h1.USDJPY',
} as const;

const LEVEL_KEY = {
  1: 'level.1',
  2: 'level.2',
  3: 'level.3',
  4: 'level.4',
  5: 'level.5',
} as const;

function TrendIcon({ trend }: { trend: 'up' | 'flat' | 'down' }): JSX.Element {
  const d =
    trend === 'up'
      ? 'M6 10V2M2.5 5.5L6 2L9.5 5.5'
      : trend === 'down'
        ? 'M6 2V10M2.5 6.5L6 10L9.5 6.5'
        : 'M2 6H10';
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export default function Riskometer(p: RiskometerProps): JSX.Element {
  const lang = p.lang;
  const t = translator(dict, lang);
  const tl = translator(levels, lang);
  const reduced = usePrefersReducedMotion();
  const dates = useMemo(() => p.dates.split(','), [p.dates]);
  const days = useMemo(() => dayNumbers(dates), [dates]);
  const series = useMemo(() => {
    const out = {} as Record<Pair, number[]>;
    for (const x of PAIRS) out[x] = parseNumbers(p.pairs[x].vols);
    return out;
  }, [p.pairs]);
  const [sel, setSel] = useState<Selection>(() => resolveSelection(p.events, null, null));
  const [tableOpen, setTableOpen] = useState(false);
  const touched = useRef(false);

  // Deep link on load; write the selection back after the first interaction.
  useEffect(() => {
    const dl = parseDeepLink(window.location.search);
    if (dl.pair || dl.event) setSel(resolveSelection(p.events, dl.pair, dl.event));
  }, []);
  useEffect(() => {
    if (!touched.current) return;
    const { pathname, hash } = window.location;
    window.history.replaceState(
      window.history.state,
      '',
      `${pathname}${deepLinkSearch(p.events, sel)}${hash}`,
    );
  }, [sel]);

  const choosePair = (pair: Pair) => {
    touched.current = true;
    setSel((s) => resolveSelection(p.events, pair, s.event));
  };
  const chooseEvent = (id: string) => {
    touched.current = true;
    setSel((s) => resolveSelection(p.events, s.pair, id));
  };

  /* ---------- derived ---------- */
  const pair = sel.pair;
  const pd = p.pairs[pair];
  const vols = series[pair];
  const cur = pd.current;
  const level = cur.level as LevelIndex;
  const levelName = tl(LEVEL_KEY[level]);
  const sinceYear = p.method.since.slice(0, 4);
  const firstDate = dates[0] ?? p.method.since;
  const lastDate = dates[dates.length - 1] ?? p.asOf;
  const own = eventsOfPair(p.events, pair);
  const ev = own.find((e) => e.id === sel.event) ?? null;
  const pe = ev ? ev.pairs[pair]! : null;
  const pct = fmtPctValue(cur.percentile, lang, 0);
  const pctPlain = fmtNumber(Math.round(cur.percentile), lang);
  const volText = fmtPctValue(cur.vol, lang, 1);
  const ext = seriesExtremes(vols);

  const markers: ChartMarker[] = own.map((e) => ({
    id: e.id,
    year: e.year,
    week: e.pairs[pair]!.week,
    aria: t('rk.eventAria', {
      year: e.year,
      title: e.title,
      peak: fmtPctValue(e.pairs[pair]!.peak, lang, 1),
    }),
  }));

  const bounds = levelBounds(pd.thresholds);
  const rangeText = (lo: number | null, hi: number | null) =>
    lo === null
      ? t('rk.legend.below', { v: fmtPctValue(hi ?? 0, lang, 1) })
      : hi === null
        ? t('rk.legend.above', { v: fmtPctValue(lo, lang, 1) })
        : t('rk.legend.between', {
            a: fmtNumber(lo, lang, { digits: 1 }),
            b: fmtPctValue(hi, lang, 1),
          });

  const summary = t('rk.chartSummary', {
    from: fmtDate(firstDate, lang),
    to: fmtDate(lastDate, lang),
    min: fmtPctValue(ext.min, lang, 1),
    minDate: fmtDate(dates[ext.minIndex] ?? firstDate, lang),
    max: fmtPctValue(ext.max, lang, 1),
    maxDate: fmtDate(dates[ext.maxIndex] ?? lastDate, lang),
    current: volText,
  });

  return (
    <div class="rk" data-rk data-pair={pair} data-selected-event={sel.event ?? ''}>
      <header class="rk-head">
        <div class="rk-head-text">
          <span class="rk-chip">
            <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M2.5 11.5A5.5 5.5 0 0 1 13.5 11.5" />
              <path d="M8 11.5L10.6 7.4" />
            </svg>
            {t('rk.chip')}
          </span>
          <h1 class="rk-h1" data-h1>
            {t(H1_KEY[pair])}
          </h1>
          <p class="rk-lead">{t('rk.lead', { pair })}</p>
        </div>
        <div class="rk-head-side">
          <div class="rk-pairs" role="group" aria-label={t('rk.pairGroup')}>
            {PAIRS.map((x) => (
              <button
                key={x}
                type="button"
                class="mono"
                aria-pressed={x === pair}
                data-pair-btn={x.replace('/', '')}
                onClick={() => choosePair(x)}
              >
                {x}
              </button>
            ))}
          </div>
          <span class="rk-asof">{t('rk.asOf', { date: fmtDate(p.asOf, lang) })}</span>
        </div>
      </header>

      <div class="rk-row">
        <section class="rk-card rk-today" aria-labelledby="rk-today-h">
          <div class="rk-today-head">
            <h2 id="rk-today-h">{t('rk.today')}</h2>
            <span class="rk-sub">{t('rk.todaySub', { pair })}</span>
          </div>
          <RiskometerGauge
            needle={cur.needle}
            label={t('rk.gaugeAria', { level: levelName, pct: pctPlain })}
            reduced={reduced}
          />
          <span class="rk-vol" data-vol>
            {volText}
          </span>
          <span class="chip rk-level" data-level={level}>
            <TrendIcon trend={levelTrend(level)} />
            {levelName}
          </span>
          <p class="rk-pct">{t('rk.percentile', { pct, year: sinceYear })}</p>
          <ul class="rk-legend" aria-label={t('rk.legendAria', { pair })}>
            {bounds.map(([lo, hi], i) => {
              const lv = (i + 1) as LevelIndex;
              const on = lv === level;
              return (
                <li
                  key={lv}
                  class="rk-legend-row"
                  data-level={lv}
                  data-on={on ? 'true' : undefined}
                  aria-current={on ? 'true' : undefined}
                >
                  <span
                    class="rk-swatch"
                    style={{ background: LEVEL_COLORS[lv] }}
                    aria-hidden="true"
                  />
                  <span class="rk-legend-name">
                    {tl(LEVEL_KEY[lv])}
                    {on && <span class="sr-only"> ({t('rk.legend.current')})</span>}
                  </span>
                  <span class="rk-legend-range mono">{rangeText(lo, hi)}</span>
                </li>
              );
            })}
          </ul>
        </section>

        <section class="rk-card rk-hist" aria-labelledby="rk-hist-h">
          <div class="rk-hist-head">
            <h2 id="rk-hist-h">
              {t('rk.histTitle', { years: spanYears(firstDate, lastDate), pair })}
            </h2>
            <span class="rk-sub">
              {t('rk.histSub', { from: firstDate.slice(0, 4), to: lastDate.slice(0, 4) })}
            </span>
          </div>
          <p class="sr-only" id="rk-chart-summary">
            {summary}
          </p>
          <RiskometerChart
            lang={lang}
            dates={dates}
            days={days}
            vols={vols}
            markers={markers}
            selected={sel.event}
            onSelect={chooseEvent}
            reduced={reduced}
            label={t('rk.chartAria', { pair, year: sinceYear, n: markers.length })}
            summaryId="rk-chart-summary"
            todayTag={t('rk.todayTag', { v: volText })}
            eventsGroupLabel={t('rk.eventsGroup')}
          />
          <div class="rk-table-wrap">
            <button
              type="button"
              class="rk-table-btn"
              aria-expanded={tableOpen}
              aria-controls="rk-table"
              data-table-toggle
              onClick={() => setTableOpen((o) => !o)}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
                <path d="M2 3.5h12M2 8h12M2 12.5h12" />
              </svg>
              {tableOpen ? t('rk.tableHide') : t('rk.tableShow')}
            </button>
            <div id="rk-table" class="rk-table ff-scroll-x" hidden={!tableOpen}>
              <table class="ff-table">
                <caption class="rk-table-caption">
                  {t('rk.tableCaption', { pair, year: sinceYear })}
                </caption>
                <thead>
                  <tr>
                    <th scope="col" class="num">
                      {t('rk.colYear')}
                    </th>
                    <th scope="col" class="num">
                      {t('rk.colMax')}
                    </th>
                    <th scope="col">{t('rk.colDate')}</th>
                    <th scope="col">{t('rk.colLevel')}</th>
                  </tr>
                </thead>
                <tbody>
                  {pd.yearly.map((yr) => (
                    <tr key={yr.year}>
                      <td class="num">{String(yr.year)}</td>
                      <td class="num">{fmtPctValue(yr.vol, lang, 1)}</td>
                      <td>{fmtDate(yr.date, lang)}</td>
                      <td>
                        <span class="rk-level-cell">
                          <span
                            class="rk-swatch"
                            style={{ background: LEVEL_COLORS[yr.level] }}
                            aria-hidden="true"
                          />
                          {tl(LEVEL_KEY[yr.level])}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>

      <section class="rk-card rk-case" aria-live="polite" aria-labelledby="rk-case-h">
        {ev && pe ? (
          <>
            <div class="rk-case-main">
              <div class="rk-case-meta">
                <span class="rk-year" data-case-year>
                  {ev.year}
                </span>
                <span class="rk-case-date">{ev.dateLabel}</span>
              </div>
              <h2 id="rk-case-h" class="rk-case-title" data-case-title>
                {ev.title}
              </h2>
              <p class="rk-case-what">{pe.what}</p>
              <h3 class="rk-case-h3">{t('rk.meansH')}</h3>
              <ul class="rk-means">
                {pe.means.map((m) => (
                  <li key={m}>
                    <span class="rk-means-dot" aria-hidden="true" />
                    <span>{m}</span>
                  </li>
                ))}
              </ul>
              <div class="rk-deepen">
                <span class="rk-sub">{t('rk.deepen')}</span>
                {ev.modules.map((m) => (
                  <a key={m.href} class="rk-mod" href={m.href}>
                    {m.label}
                  </a>
                ))}
              </div>
            </div>
            <div class="rk-case-side">
              <div class="rk-box">
                <span class="rk-box-label">{pair}</span>
                <span class="rk-move mono" data-case-move>
                  {`${fmtRate(pe.from, pair)} → ${fmtRate(pe.to, pair)}`}
                </span>
                <span class="rk-move-note">
                  <TrendIcon trend={pe.movePct < 0 ? 'down' : 'up'} />
                  {t('rk.moveNote', {
                    move: fmtPctValue(pe.movePct, lang, 1, true),
                    from: fmtDate(pe.fromDate, lang),
                    to: fmtDate(pe.toDate, lang),
                  })}
                </span>
              </div>
              <div class="rk-box rk-box-dark">
                <span class="rk-box-label">{t('rk.peakH')}</span>
                <span class="rk-peak" data-case-peak>
                  {fmtPctValue(pe.peak, lang, 1)}
                </span>
                <span class="rk-box-sub">
                  {t('rk.peakSub', { date: fmtDate(pe.peakDate, lang), today: volText })}
                </span>
                {pe.isRecord && (
                  <span class="rk-record">{t('rk.peakRecord', { year: sinceYear })}</span>
                )}
              </div>
            </div>
          </>
        ) : (
          <h2 id="rk-case-h" class="rk-case-title">
            {t('rk.eventsGroup')}
          </h2>
        )}
      </section>
    </div>
  );
}
