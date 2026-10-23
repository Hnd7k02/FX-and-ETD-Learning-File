/**
 * GapReplay (module 07, section 4): the franc shock as a hypothetical scenario with daily ECB
 * reference rates (information only, not tradable prices), replayed day by day. The minimum rate
 * (sourced fact) holds the series up; a stop-loss and four knock-out barriers sit below it. On
 * the decision day the fixing jumps over all of them at once: the stop is filled at that fixing
 * (simplification), the knock-outs, observed daily against the fixing, are extinguished on it
 * (gap risk). Rows of the table light up at that moment, the extra loss counts up.
 *
 * The series comes from the figure wrapper (read from data/raw/ecb-eur-reference.csv at build
 * time); the maths is in src/lib/m07/gap.ts. Play/pause plus a day slider; under reduced motion
 * the figure starts at the end and changes without animation.
 */
import type { JSX } from 'preact';
import { useMemo, useRef } from 'preact/hooks';
import { Slider } from '@/components/ui/Slider';
import { StatHero, StatRow, StatTable } from '@/components/ui/Stat';
import {
  useElementWidth,
  useInView,
  usePrefersReducedMotion,
  useTween,
} from '@/components/ui/hooks';
import { gapreplay as dict } from '@/i18n/dict/gapreplay';
import { translator, type Lang } from '@/i18n/types';
import { linePath, scaleLinear, type Point } from '@/lib/chart';
import {
  fmtDate,
  fmtMillions,
  fmtMoney,
  fmtMonthYear,
  fmtNumber,
  fmtPct,
  fmtRate,
} from '@/lib/format';
import { M07_CONFIG, chartLayout } from '@/lib/m07/config';
import { gapSummary, type FixingPoint } from '@/lib/m07/gap';
import { annotationBox, inRange, usePlayback } from './m07-shared';

export interface GapReplayProps {
  lang: Lang;
  /** Daily EUR/CHF fixings of the window (ECB). */
  series: FixingPoint[];
  /** Minimum rate (from the sourced fact) and its texts. */
  floor: number;
  floorText: string;
  floorSince: string;
  /** Date the minimum rate was discontinued (sourced fact). */
  floorEnd: string;
  /** Time of the ECB concertation (sourced fact), shown in the note. */
  ecbTime: string;
  /** Riskometer deep link for the event. */
  riskometerHref: string;
}

const G = M07_CONFIG.gap;
const PAIR = 'EUR/CHF';

export default function GapReplay(p: GapReplayProps): JSX.Element {
  const { lang, series } = p;
  const t = translator(dict, lang);
  const sum = useMemo(() => gapSummary(series), [series]);
  const last = series.length - 1;

  const box = useRef<HTMLDivElement>(null);
  const width = useElementWidth(box, 620);
  const inView = useInView(box);
  const rm = usePrefersReducedMotion();
  const play = usePlayback(last, G.msPerDay, { autoplay: true, reduced: rm, inView });
  const L = chartLayout(width, width < 480 ? 0.85 : 0.52, 280);

  const pos = play.pos;
  const idx = Math.max(0, Math.min(last, Math.floor(pos + 1e-9)));
  const shock = sum.shockIndex;
  const triggered = shock >= 0 && pos >= shock;
  const cur = series[idx]!;

  /* ---------- geometry ---------- */
  const labelSpace = L.compact ? 74 : 92;
  const x0 = L.left;
  const x1 = L.width - L.right - labelSpace;
  const x = scaleLinear([0, last], [x0, x1]);
  const y = scaleLinear(G.yDomain, [L.height - L.bottom, L.top]);
  const valueAt = (q: number) => {
    const i = Math.max(0, Math.min(last, Math.floor(q)));
    const f = q - i;
    return i < last && f > 0
      ? series[i]!.value + (series[i + 1]!.value - series[i]!.value) * f
      : series[i]!.value;
  };

  const before: Point[] = [];
  const gapSeg: Point[] = [];
  const after: Point[] = [];
  for (let i = 0; i <= Math.floor(pos); i++) {
    const pt: Point = [x(i), y(series[i]!.value)];
    if (shock < 0 || i < shock) before.push(pt);
    else after.push(pt);
  }
  const tip: Point = [x(pos), y(valueAt(pos))];
  if (shock > 0 && inRange(pos, shock - 1, shock) && pos !== shock - 1 && pos !== shock) {
    gapSeg.push([x(shock - 1), y(series[shock - 1]!.value)], tip);
  } else if (shock >= 0 && pos >= shock) {
    gapSeg.push([x(shock - 1), y(series[shock - 1]!.value)], [x(shock), y(series[shock]!.value)]);
    if (pos > Math.floor(pos)) after.push(tip);
  } else if (pos > Math.floor(pos)) {
    before.push(tip);
  }

  /* ---------- counters ---------- */
  const tw = useTween(
    [triggered ? sum.stopSlipChf : 0, triggered ? sum.putLostChf : 0, triggered ? sum.dayMove : 0],
    rm ? 0 : 700,
    rm,
  );
  const [slip, lost, move] = tw as [number, number, number];

  /* ---------- texts ---------- */
  const rate = (v: number) => fmtRate(v, PAIR);
  const date = (iso: string) => fmtDate(iso, lang);
  const notional = fmtMillions(G.notional, 'EUR', lang);
  const shockDate = shock >= 0 ? date(series[shock]!.date) : '';
  const status = triggered
    ? t('gr.status.after', {
        date: shockDate,
        before: rate(sum.before),
        shock: rate(sum.shock),
        move: fmtPct(sum.dayMove, lang, 1),
        stop: rate(G.stop),
        n: G.knockOuts.length,
        koHigh: rate(Math.max(...G.knockOuts)),
        koLow: rate(Math.min(...G.knockOuts)),
        slip: fmtMoney(sum.stopSlipChf, 'CHF', lang),
      })
    : t('gr.status.before');
  const summary = t('gr.summary', { date: date(cur.date), rate: rate(cur.value), status });

  /* ---------- months on the x-axis ---------- */
  const monthStarts = series
    .map((q, i) => ({ i, m: q.date.slice(0, 7) }))
    .filter((q, i, a) => i === 0 || q.m !== a[i - 1]!.m);

  const yTicks: number[] = [];
  const step = L.compact ? 0.08 : 0.04;
  for (let v = Math.ceil(G.yDomain[0] / step) * step; v <= G.yDomain[1] + 1e-9; v += step) {
    yTicks.push(Number(v.toFixed(4)));
  }

  const orders = [
    {
      key: 'stop',
      label: t('gr.row.stop'),
      o: sum.stop,
      line: t(L.compact ? 'gr.stopShort' : 'gr.stop', { v: rate(G.stop) }),
    },
    ...sum.knockOuts.map((o) => ({
      key: `ko${o.level}`,
      label: t('gr.row.ko'),
      o,
      line: L.compact ? rate(o.level) : t('gr.ko', { v: rate(o.level) }),
    })),
  ];

  // annotation at the shock
  // The annotation sits in the empty lower left, left of the shock day; if that corner is too
  // narrow (phones) it is shown as a note below the chart instead.
  const ahaRoom = (shock >= 0 ? x(shock) : x1) - x0 - 16;
  const ahaInChart = ahaRoom >= 170;
  let aha: JSX.Element | null = null;
  if (triggered && ahaInChart) {
    const l1 = t('gr.aha.t');
    const l2 = t('gr.aha.d', { n: G.knockOuts.length, v: rate(sum.shock) });
    const b = annotationBox(l1, l2, Math.min(300, ahaRoom));
    // lower left: below the floor before the shock, where the chart is empty
    const ax = x0 + 6;
    const ay = L.height - L.bottom - b.h - 6;
    aha = (
      <g class="m7-aha" data-aha="gap">
        <rect x={ax} y={ay} width={b.w} height={b.h} rx={10} class="m7-aha-box" />
        <text x={ax + 11} y={ay + 18} class="m7-aha-title">
          {l1}
        </text>
        {b.lines.map((line, i) => (
          <text key={i} x={ax + 11} y={ay + 35 + i * 17} class="m7-aha-text">
            {line}
          </text>
        ))}
      </g>
    );
  }

  const playLabel = play.playing ? t('gr.pause') : play.done ? t('gr.replay') : t('gr.play');
  const shockX = shock >= 0 ? x(shock) : 0;

  return (
    <div class="m7 gr" data-gapreplay data-triggered={triggered ? 'true' : 'false'}>
      <div class="ff-lab-head">
        <div class="m7-titles">
          <div class="ff-lab-title">{t('gr.title')}</div>
          <div class="ff-lab-sub">
            {t('gr.sub', { from: date(series[0]!.date), to: date(series[last]!.date) })}
          </div>
        </div>
        <span class={`m7-chip${triggered ? ' is-bad' : ''}`} data-date={cur.date}>
          <b>{date(cur.date)}</b>
          <span class="mono">{rate(cur.value)}</span>
        </span>
      </div>

      <div class="ff-lab">
        <div class="ff-lab-main" ref={box}>
          <div class="m7-chart-head">
            <ul class="m7-legend" aria-hidden="true">
              <li>
                <span class="m7-sw gr-sw-fix" />
                {t('gr.legend.fix')}
              </li>
              <li>
                <span class="m7-sw m7-sw-dash" />
                {t('gr.legend.floor')}
              </li>
              <li>
                <span class="m7-sw gr-sw-order" />
                {t('gr.legend.orders')}
              </li>
            </ul>
          </div>
          <svg
            viewBox={`0 0 ${L.width} ${L.height}`}
            role="img"
            aria-label={t('gr.aria', { summary })}
            class="m7-svg"
          >
            {yTicks.map((v) => (
              <g key={`y${v}`}>
                <path d={`M${x0},${y(v).toFixed(1)}H${x1}`} class="m7-grid" />
                <text x={x0 - 8} y={y(v) + 4} class="m7-tick" text-anchor="end">
                  {fmtRate(v, PAIR, 2)}
                </text>
              </g>
            ))}
            {monthStarts.map((q) => (
              <text key={q.m} x={x(q.i)} y={L.height - 10} class="m7-tick" text-anchor="start">
                {fmtMonthYear(series[q.i]!.date, lang)}
              </text>
            ))}
            {/* orders below the market */}
            {orders.map(({ key, o, line }) => {
              const hit = triggered && o.index === shock;
              return (
                <g key={key} class={`gr-order${hit ? ' is-hit' : ''}`}>
                  <path d={`M${x0},${y(o.level).toFixed(1)}H${x1}`} class="gr-order-line" />
                  <text x={x1 + 6} y={y(o.level) + 4} class="gr-order-label">
                    {line}
                  </text>
                  {hit && (
                    <circle
                      cx={shockX}
                      cy={y(o.level)}
                      r={5}
                      class="m7-hit m7-pop"
                      style={{ transformOrigin: `${shockX}px ${y(o.level)}px` }}
                    />
                  )}
                </g>
              );
            })}
            {/* floor: solid until the decision, faded after */}
            {shock >= 0 && (
              <>
                <path d={`M${x0},${y(p.floor).toFixed(1)}H${shockX.toFixed(1)}`} class="gr-floor" />
                <path
                  d={`M${shockX.toFixed(1)},${y(p.floor).toFixed(1)}H${x1}`}
                  class="gr-floor is-gone"
                />
                <text
                  x={x0 + 6}
                  y={y(p.floor) - 8}
                  class={`m7-label${triggered ? ' gr-gone-label' : ''}`}
                >
                  {L.compact
                    ? t('gr.floorShort', { v: p.floorText })
                    : triggered
                      ? t('gr.floorEnded', {
                          v: p.floorText,
                          since: p.floorSince,
                          date: p.floorEnd,
                        })
                      : t('gr.floor', { v: p.floorText, since: p.floorSince })}
                </text>
              </>
            )}
            {/* the series */}
            <path d={linePath(before)} class="gr-line" />
            {gapSeg.length === 2 && <path d={linePath(gapSeg)} class="gr-gap" />}
            <path d={linePath(after)} class="gr-line" />
            {triggered && !L.compact && (
              <text
                x={shockX - 8}
                y={(y(sum.before) + y(sum.shock)) / 2}
                class="m7-label"
                text-anchor="end"
              >
                {t('gr.gap')}
              </text>
            )}
            <circle cx={tip[0]} cy={tip[1]} r={5} class="m7-dot" />
            {aha}
          </svg>
          {triggered && !ahaInChart && (
            <p class="gr-aha" data-aha="gap">
              <b>{t('gr.aha.t')}</b> {t('gr.aha.d', { n: G.knockOuts.length, v: rate(sum.shock) })}
            </p>
          )}
          <div class="m7-buttons gr-controls">
            <button type="button" class="m7-btn m7-btn-dark" onClick={play.toggle} data-play>
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                {play.playing ? (
                  <path d="M4 2.5V11.5M10 2.5V11.5" class="m7-icon-stroke" />
                ) : (
                  <path d="M4 2.2L11.5 7L4 11.8Z" class="m7-icon-fill" />
                )}
              </svg>
              {playLabel}
            </button>
            <div class="gr-scrub">
              <Slider
                id="gr-day"
                label={t('gr.slider')}
                value={idx}
                min={0}
                max={last}
                step={1}
                valueText={t('gr.sliderValue', { date: date(cur.date), rate: rate(cur.value) })}
                onInput={(v) => play.seek(v)}
              />
            </div>
          </div>
          <div class="m7-table-wrap">
            <table class="m7-table">
              <caption class="gr-caption">
                {t('gr.table', { notional })}
                <span>{t('gr.tableSub', { k: rate(G.putStrike) })}</span>
              </caption>
              <thead>
                <tr>
                  <th scope="col">{t('gr.col.order')}</th>
                  <th scope="col" class="num">
                    {t('gr.col.level')}
                  </th>
                  <th scope="col" class="num">
                    {t('gr.col.fill')}
                  </th>
                  <th scope="col" class="num">
                    {t('gr.col.gap')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {orders.map(({ key, label, o }) => {
                  const hit = o.index !== null && pos >= o.index;
                  return (
                    <tr
                      key={key}
                      class={hit ? 'is-hit' : ''}
                      data-order={key}
                      data-hit={hit ? 'true' : 'false'}
                    >
                      <td>{label}</td>
                      <td class="num">{rate(o.level)}</td>
                      <td class="num">{hit ? rate(o.fill) : t('gr.pending')}</td>
                      <td class="num">{hit ? fmtNumber(-o.gapPips, lang) : t('gr.pending')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p class="sr-only">{summary}</p>
        </div>

        <div class="ff-lab-side">
          <StatTable>
            <StatHero
              label={t('gr.hero')}
              value={fmtMoney(-slip, 'CHF', lang)}
              sub={t('gr.heroSub', { v: rate(G.stop), notional })}
            />
            <StatRow
              label={t('gr.row.put', { k: rate(G.putStrike) })}
              sub={t('gr.row.putSub')}
              value={fmtMoney(-lost, 'CHF', lang)}
              highlight
            />
            <StatRow
              label={t('gr.row.move')}
              sub={t('gr.row.moveSub', { from: rate(sum.before), to: rate(sum.shock) })}
              value={fmtPct(move, lang, 1)}
            />
            <StatRow
              label={t('gr.row.low')}
              sub={t('gr.row.lowSub', { date: date(series[sum.lowIndex]!.date) })}
              value={rate(sum.low)}
            />
          </StatTable>
          <p class="m7-note">{t('gr.note', { time: p.ecbTime })}</p>
          <a class="m7-link" href={p.riskometerHref} data-riskometer>
            {t('gr.link')}
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <path d="M2 7H12M8 3L12 7L8 11" class="m7-icon-stroke" />
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
}
