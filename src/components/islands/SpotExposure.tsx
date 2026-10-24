/**
 * Spot exposure (module 01, section 1): what USD 1 Mio. cost the Swiss importer in CHF.
 *
 * Drag the rate on the chart (pointer events) or use the slider (accessible twin). The cost line
 * is N · S; between today's cost and the current point a column of blocks grows or shrinks, one
 * block per big figure (= CHF 10’000 on USD 1 Mio.). The shaded band is the ±1σ range for three
 * months. Numbers count to their new value (300 ms; instant while dragging and under reduced
 * motion). Maths: src/lib/m01/exposure.ts. Strings: src/i18n/dict/spotexposure.ts.
 */
import type { JSX } from 'preact';
import { useId, useMemo, useRef, useState } from 'preact/hooks';
import { AxisX, GridY } from '@/components/ui/Chart';
import { Slider } from '@/components/ui/Slider';
import { StatHero, StatRow, StatTable } from '@/components/ui/Stat';
import { useElementWidth, usePrefersReducedMotion, useTween } from '@/components/ui/hooks';
import { spotexposure as dict } from '@/i18n/dict/spotexposure';
import { translator, type Lang } from '@/i18n/types';
import { clamp, niceTicks, scaleLinear } from '@/lib/chart';
import { EXAMPLE } from '@/lib/fx/example';
import { fmtMillions, fmtMoney, fmtNumber, fmtPct, fmtRate } from '@/lib/format';
import {
  BIG_FIGURE,
  EXPOSURE_RANGE as R,
  M01_SCENARIOS,
  bigFigureBlocks,
  exposure,
  probBeyond,
  sigmaRange,
} from '@/lib/m01/exposure';
import { inside, snap, useSvgDrag } from './m01-shared';

export interface SpotExposureProps {
  lang: Lang;
}

const S0 = EXAMPLE.spot;
const N = EXAMPLE.notional;
const PAIR = EXAMPLE.pair;
/** y domain in CHF thousands. */
const Y_DOMAIN: [number, number] = [R.min * N * 0.001 - 10, R.max * N * 0.001 + 10];
const PRESETS = [M01_SCENARIOS.stDown, S0, S0 + BIG_FIGURE, M01_SCENARIOS.stUp];
const SIGMA = sigmaRange();

function layoutFor(w: number) {
  const width = Math.max(280, Math.round(w));
  const compact = width < 560;
  const height = compact ? 330 : Math.round(clamp(width * 0.82, 360, 470));
  const rail = height - (compact ? 38 : 42);
  return {
    width,
    height,
    compact,
    font: compact ? 11 : 12,
    left: compact ? 38 : 48,
    right: compact ? 10 : 16,
    top: 30,
    plotBottom: rail - 18,
    rail,
    block: compact ? 18 : 22,
  };
}

export default function SpotExposure({ lang }: SpotExposureProps): JSX.Element {
  const t = translator(dict, lang);
  const uid = useId().replace(/[^A-Za-z0-9_-]/g, '');
  const rm = usePrefersReducedMotion();
  const [S, setS] = useState<number>(S0);
  const box = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const L = layoutFor(useElementWidth(box, 640));

  const sx = scaleLinear([R.min, R.max], [L.left, L.width - L.right]);
  const sy = scaleLinear(Y_DOMAIN, [L.plotBottom, L.top]);
  const yk = (chf: number) => sy(chf / 1000);

  const set = (v: number) => setS(snap(v, R.step, R.min, R.max));
  const { dragging, handlers } = useSvgDrag(svgRef, L, 'x', (x) => set(sx.invert(x)));
  const [shownS] = useTween([S], 300, rm || dragging);
  const e = exposure(S);
  const shown = exposure(shownS ?? S);
  const blocks = bigFigureBlocks(S0, shownS ?? S);

  const months = EXAMPLE.months;
  const notional = fmtMillions(N, '', lang).trim();
  const chf = (x: number, sign = false) => fmtMoney(x, EXAMPLE.quote, lang, 0, sign);
  const bf = chf(BIG_FIGURE * N);
  const today = chf(S0 * N);
  const far = !inside(S, SIGMA[0], SIGMA[1]);
  const noteKey =
    e.dir === 'flat'
      ? 'note.flat'
      : e.dir === 'up'
        ? far
          ? 'note.upFar'
          : 'note.up'
        : far
          ? 'note.downFar'
          : 'note.down';
  const note = t(noteKey, {
    today,
    bf,
    months,
    pct: fmtPct(Math.abs(e.pct), lang, 2),
    diff: chf(Math.abs(e.diff)),
    prob: fmtPct(probBeyond(S), lang, 0),
  });

  const xTicks = useMemo(
    () => niceTicks(R.min, R.max, L.compact ? 3 : 8).filter((v) => inside(v, R.min, R.max)),
    [L.compact],
  );
  const yTicks = niceTicks(Y_DOMAIN[0], Y_DOMAIN[1], L.compact ? 4 : 5).filter((v) =>
    inside(v, Y_DOMAIN[0], Y_DOMAIN[1]),
  );
  const fs = `${L.font}px`;
  const x = sx(shownS ?? S);
  const yCost = yk(shown.cost);
  const y0 = yk(S0 * N);

  // Blocks: one per whole big figure, plus a partial one for the rest.
  const dirSign = Math.sign((shownS ?? S) - S0);
  const unit = Math.abs(yk(S0 * N + BIG_FIGURE * N) - y0);
  const blockRects: Array<{ y: number; h: number; part: boolean }> = [];
  const whole = Math.abs(blocks.whole);
  for (let i = 0; i < whole + (blocks.rest > 0 ? 1 : 0); i++) {
    const part = i >= whole;
    const h = part ? unit * blocks.rest : unit;
    const top = dirSign > 0 ? y0 - unit * i - h : y0 + unit * i;
    blockRects.push({ y: top, h, part });
  }
  const up = dirSign > 0;
  // Annotation in the corner the cost line never crosses (it rises from bottom left to top
  // right): dollar up → bracket left of the column, text above its top, ending at the column;
  // dollar down → bracket right of the column, text below its bottom, or above its top when
  // the band label leaves no room below.
  const annotLeft = up;
  // "today" label below the dashed cost line, on the side away from the column
  const todayLeft = dirSign >= 0;
  // the rate pill on the rail stays inside the SVG at both ends of the range
  const pillX = clamp(x, 35, L.width - 35);
  const annotTick = annotLeft ? 5 : -5;
  const annotX = annotLeft ? x - L.block / 2 - 8 : x + L.block / 2 + 8;
  const lineGap = L.font + 5;
  const textX = annotX + (annotLeft ? 2 : -2);
  const roomBelow = yCost + 8 + L.font + lineGap + L.font + 10 <= L.plotBottom - 8;
  const firstBaseline = up
    ? yCost - 10 - lineGap
    : roomBelow
      ? Math.max(yCost + 8 + L.font, y0 + 2 * L.font + 14)
      : y0 - 10 - lineGap;
  const bfShown = Math.round(shown.bigFigures * 100) / 100;
  const annotBf = t(Math.abs(bfShown) === 1 ? 'annotBfOne' : 'annotBf', {
    bf: fmtNumber(bfShown, lang, {
      digits: Number.isInteger(bfShown) ? 0 : 2,
      sign: true,
    }),
  });
  const blockFill = up ? 'var(--ff-exotics-soft)' : 'var(--ff-good-soft)';
  const blockStroke = up ? 'var(--ff-short)' : 'var(--ff-good)';
  const blockText = up ? 'var(--ff-exotics-text)' : 'var(--ff-good-text)';

  const aria = t('aria', {
    notional,
    pair: PAIR,
    rate: fmtRate(S, PAIR),
    cost: chf(e.cost),
    diff: chf(e.diff, true),
    inverse: fmtRate(e.inverse, 'CHF/USD'),
  });
  const bandLabel = t('band', { months });
  const bandMid = (sx(SIGMA[0]) + sx(SIGMA[1])) / 2;

  return (
    <div class="spx" data-spx data-rate={S.toFixed(4)} data-dir={e.dir} data-blocks={blocks.whole}>
      <div class="ff-lab-head">
        <div class="spx-head-text">
          <div class="ff-lab-title">{t('title')}</div>
          <div class="ff-lab-sub">
            {t('sub', { notional, months, pair: PAIR, spot: fmtRate(S0, PAIR), today })}
          </div>
        </div>
        <span class="ff-pill-note spx-chip" key={blocks.whole} data-pulse={blocks.whole !== 0}>
          {t('chip', { bf })}
        </span>
      </div>
      <div class="ff-lab">
        <div class="ff-lab-main">
          <div ref={box}>
            <svg
              ref={svgRef}
              viewBox={`0 0 ${L.width} ${L.height}`}
              role="img"
              aria-label={aria}
              class="spx-svg"
            >
              <rect
                x={sx(SIGMA[0])}
                y={L.top}
                width={sx(SIGMA[1]) - sx(SIGMA[0])}
                height={L.plotBottom - L.top}
                style={{ fill: 'var(--ff-surface-2)' }}
              />
              <GridY
                y={sy}
                ticks={yTicks}
                x0={L.left}
                x1={L.width - L.right}
                format={(v) => fmtNumber(v, lang)}
                fontSize={L.font}
                axisAt={null}
              />
              <text
                x={L.left}
                y={L.top - 14}
                style={{ fontSize: fs, fontWeight: 600, fill: 'var(--ff-muted)' }}
              >
                {t('y')}
              </text>
              {/* today: vertical spot line and horizontal cost line */}
              <path
                d={`M${sx(S0).toFixed(1)},${L.top}V${L.plotBottom}`}
                style={{
                  fill: 'none',
                  stroke: 'var(--ff-ref)',
                  strokeWidth: 1,
                  strokeDasharray: '4 5',
                }}
              />
              <path
                d={`M${L.left},${y0.toFixed(1)}H${L.width - L.right}`}
                style={{
                  fill: 'none',
                  stroke: 'var(--ff-ref)',
                  strokeWidth: 1,
                  strokeDasharray: '4 5',
                }}
              />
              <text
                x={bandMid}
                y={L.plotBottom - 8}
                style={{
                  fontSize: fs,
                  fontWeight: 600,
                  fill: 'var(--ff-muted)',
                  textAnchor: 'middle',
                  paintOrder: 'stroke',
                  stroke: 'var(--ff-surface-2)',
                  strokeWidth: 4,
                }}
              >
                {bandLabel}
              </text>
              {/* cost line N · S */}
              <path
                d={`M${sx(R.min).toFixed(1)},${yk(R.min * N).toFixed(1)}L${sx(R.max).toFixed(1)},${yk(R.max * N).toFixed(1)}`}
                style={{
                  fill: 'none',
                  stroke: 'var(--ff-short)',
                  strokeWidth: 3,
                  strokeLinecap: 'round',
                }}
              />
              {/* big-figure blocks between today's cost and the current cost */}
              <g data-block-column>
                {blockRects.map((b, i) => (
                  <g key={i}>
                    <rect
                      x={x - L.block / 2}
                      y={b.y + 1}
                      width={L.block}
                      height={Math.max(0, b.h - 2)}
                      rx={3}
                      style={{
                        fill: blockFill,
                        stroke: blockStroke,
                        strokeWidth: 1.25,
                        strokeDasharray: b.part ? '3 2' : undefined,
                      }}
                    />
                    {!b.part && b.h >= 14 && Math.abs(b.y + b.h / 2 - yCost) > 12 && (
                      <text
                        x={x}
                        y={b.y + b.h / 2 + 5}
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          fill: blockText,
                          textAnchor: 'middle',
                          fontFamily: 'var(--ff-font-mono)',
                        }}
                      >
                        {i + 1}
                      </text>
                    )}
                  </g>
                ))}
              </g>
              {/* aha: the column in big figures and francs */}
              {Math.abs(shown.pips) >= 50 && (
                <g class="spx-annot" data-annot aria-hidden="true">
                  <path
                    d={`M${(annotX + annotTick).toFixed(1)},${y0.toFixed(1)}H${annotX.toFixed(1)}V${yCost.toFixed(1)}H${(annotX + annotTick).toFixed(1)}`}
                    style={{ fill: 'none', stroke: blockStroke, strokeWidth: 1.5 }}
                  />
                  <text
                    x={textX}
                    y={firstBaseline}
                    style={{
                      fontSize: fs,
                      fontWeight: 800,
                      fill: blockText,
                      textAnchor: annotLeft ? 'end' : 'start',
                      paintOrder: 'stroke',
                      stroke: '#fff',
                      strokeWidth: 4,
                    }}
                  >
                    <tspan x={textX}>{annotBf}</tspan>
                    <tspan x={textX} dy={lineGap} style={{ fontFamily: 'var(--ff-font-mono)' }}>
                      {chf(shown.diff, true)}
                    </tspan>
                  </text>
                </g>
              )}
              <circle
                cx={x}
                cy={yCost}
                r={6}
                style={{ fill: 'var(--ff-short)', stroke: '#fff', strokeWidth: 2.5 }}
              />
              <path
                d={`M${x.toFixed(1)},${(up ? y0 + 2 : yCost + 8).toFixed(1)}V${L.rail}`}
                style={{
                  fill: 'none',
                  stroke: 'var(--ff-ink)',
                  strokeWidth: 1,
                  strokeDasharray: '2 3',
                }}
              />
              {/* labels on top of the reference lines (their halo breaks the dashes) */}
              <text
                x={todayLeft ? L.left + 4 : L.width - L.right}
                y={y0 + L.font + 6}
                style={{
                  fontSize: fs,
                  fontWeight: 600,
                  fill: 'var(--ff-ink-2)',
                  textAnchor: todayLeft ? 'start' : 'end',
                  paintOrder: 'stroke',
                  stroke: '#fff',
                  strokeWidth: 4,
                }}
              >
                {t('today', { today })}
              </text>
              {/* drag surface: horizontal drags move the rate, vertical swipes still scroll */}
              <rect
                x={L.left}
                y={L.top}
                width={L.width - L.left - L.right}
                height={L.plotBottom - L.top}
                class="spx-surface"
                style={{ fill: 'transparent' }}
                {...handlers}
              />
              <path
                d={`M${L.left},${L.rail}H${L.width - L.right}`}
                style={{
                  fill: 'none',
                  stroke: 'var(--ff-line)',
                  strokeWidth: 4,
                  strokeLinecap: 'round',
                }}
              />
              <g class={`spx-handle${dragging ? ' is-active' : ''}`} data-handle {...handlers}>
                <rect
                  x={pillX - 30}
                  y={L.rail - 22}
                  width={60}
                  height={44}
                  style={{ fill: 'transparent' }}
                />
                <rect
                  x={pillX - 34}
                  y={L.rail - 11}
                  width={68}
                  height={22}
                  rx={11}
                  style={{ fill: 'var(--ff-ink)', stroke: '#fff', strokeWidth: 2 }}
                />
                <text
                  x={pillX}
                  y={L.rail + 4}
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    fill: '#fff',
                    textAnchor: 'middle',
                    fontFamily: 'var(--ff-font-mono)',
                    pointerEvents: 'none',
                  }}
                >
                  {fmtRate(shownS ?? S, PAIR)}
                </text>
              </g>
              <AxisX
                x={sx}
                ticks={xTicks}
                y={L.height - 4}
                format={(v) => fmtRate(v, PAIR, 2)}
                fontSize={L.font}
              />
            </svg>
          </div>
          <div class="spx-legend">
            <span class="spx-legend-item">
              <span aria-hidden="true" class="spx-swatch spx-swatch--line" />
              {t('legendCost')}
            </span>
            <span class="spx-legend-item">
              <span aria-hidden="true" class="spx-swatch spx-swatch--block" />
              {t('legendBlock', { bf })}
            </span>
            <span class="spx-legend-item">
              <span aria-hidden="true" class="spx-swatch spx-swatch--band" />
              {t('legendBand', { months })}
            </span>
          </div>
          <p class="spx-hint">{t('drag')}</p>
        </div>
        <div class="ff-lab-side">
          <StatTable>
            <StatHero
              label={t('heroLabel')}
              value={chf(shown.cost)}
              sub={t('heroSub', { notional })}
            />
            <StatRow
              label={t('rowRate', { pair: PAIR })}
              sub={t('rowRateSub')}
              value={fmtRate(shownS ?? S, PAIR)}
            />
            <StatRow
              label={t('rowInverse')}
              sub={t('rowInverseSub')}
              value={fmtRate(shown.inverse, 'CHF/USD')}
            />
            <StatRow
              label={t('rowDiff')}
              sub={t('rowDiffSub', {
                pips: fmtNumber(e.pips, lang, { digits: 0, sign: true }),
                bf: fmtNumber(e.bigFigures, lang, { digits: 2, sign: true }),
              })}
              value={chf(shown.diff, true)}
              highlight={e.dir !== 'flat'}
            />
            <StatRow
              label={t('rowUsdPct')}
              sub={t('rowUsdPctSub')}
              value={fmtPct(e.pct, lang, 2, true)}
            />
            <StatRow
              label={t('rowChfPct')}
              sub={t('rowChfPctSub')}
              value={fmtPct(e.inversePct, lang, 2, true)}
            />
          </StatTable>
          <div class="panel">
            <Slider
              id={`spx-${uid}`}
              label={t('slider', { pair: PAIR, months })}
              value={S}
              min={R.min}
              max={R.max}
              step={R.step}
              valueText={fmtRate(S, PAIR)}
              onInput={set}
            />
            <div class="spx-presets" role="group" aria-label={t('presets')}>
              {PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  class="spx-preset mono"
                  aria-pressed={Math.abs(S - p) < 1e-9}
                  onClick={() => set(p)}
                >
                  {Math.abs(p - S0) < 1e-9 ? t('presetToday') : fmtRate(p, PAIR)}
                </button>
              ))}
            </div>
          </div>
          <p class={`spx-note spx-note--${e.dir}`} data-note>
            {note}
          </p>
          <div class="sr-only" aria-live="polite" aria-atomic="true">
            {dragging ? '' : t(`status.${noteKey.slice(5)}` as 'status.flat')}
          </div>
        </div>
      </div>
    </div>
  );
}
