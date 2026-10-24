/**
 * Order demo (module 01, section 3): market, limit and stop-loss orders, and gap risk.
 *
 * The importer has to buy USD 1 Mio. within two weeks. Pick an order type and a market path
 * (calm, or a gap over the weekend); drag the dashed order level on the chart (pointer events)
 * or use the slider. The path draws itself once per scenario (1.4 s; instant under reduced
 * motion) and the fill appears where the order is executed. After a gap a stop is filled far
 * beyond its level; the bracket shows the slippage. Logic: src/lib/m01/orders.ts.
 */
import type { JSX } from 'preact';
import { useId, useMemo, useRef, useState } from 'preact/hooks';
import { GridY } from '@/components/ui/Chart';
import { Segmented } from '@/components/ui/Segmented';
import { Slider } from '@/components/ui/Slider';
import { StatHero, StatRow, StatTable } from '@/components/ui/Stat';
import { useElementWidth } from '@/components/ui/hooks';
import { orderdemo as dict } from '@/i18n/dict/orderdemo';
import { translator, type Lang } from '@/i18n/types';
import { clamp, linePath, niceTicks, scaleLinear, type Point } from '@/lib/chart';
import { EXAMPLE } from '@/lib/fx/example';
import { fmtMillions, fmtMoney, fmtNumber, fmtRate } from '@/lib/format';
import {
  ORDER_DEMO as C,
  ORDER_TYPES,
  buildPath,
  fillBuy,
  type OrderType,
  type PathScenario,
} from '@/lib/m01/orders';
import { inside, snap, useSvgDrag } from './m01-shared';

export interface OrderDemoProps {
  lang: Lang;
}

const PAIR = EXAMPLE.pair;
const N = C.notional;
const PIP = 1e-4;
const GAP = 3;
const COUNT = C.days * C.perDay;
const Y_DOMAIN: [number, number] = [0.784, 0.83];
const SCENARIOS: PathScenario[] = ['calm', 'gap'];
const PATHS = { calm: buildPath('calm'), gap: buildPath('gap') };
const xi = (i: number) => i + (i >= C.weekendAt ? GAP : 0);

function layoutFor(w: number) {
  const width = Math.max(280, Math.round(w));
  const compact = width < 560;
  const height = compact ? 300 : Math.round(clamp(width * 0.62, 320, 400));
  return {
    width,
    height,
    compact,
    font: compact ? 11 : 12,
    left: compact ? 44 : 52,
    right: compact ? 62 : 70,
    top: 30,
    bottom: height - 28,
  };
}

export default function OrderDemo({ lang }: OrderDemoProps): JSX.Element {
  const t = translator(dict, lang);
  const uid = useId().replace(/[^A-Za-z0-9_-]/g, '');
  const [type, setType] = useState<OrderType>('stop');
  const [scenario, setScenario] = useState<PathScenario>('calm');
  const [levels, setLevels] = useState({ limit: C.limit.level, stop: C.stop.level });
  const box = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const L = layoutFor(useElementWidth(box, 640));

  const path = PATHS[scenario];
  const level = type === 'market' ? null : levels[type];
  const fill = fillBuy(path, type, level);
  const market = fillBuy(path, 'market', null);
  const range = type === 'limit' ? C.limit : C.stop;

  const sx = scaleLinear([0, COUNT - 1 + GAP], [L.left, L.width - L.right]);
  const sy = scaleLinear(Y_DOMAIN, [L.bottom, L.top]);
  const setLevel = (v: number) => {
    if (type === 'market') return;
    setLevels((o) => ({ ...o, [type]: snap(v, C.step, range.min, range.max) }));
  };
  const { dragging, handlers } = useSvgDrag(svgRef, L, 'y', (y) => setLevel(sy.invert(y)));

  const lines = useMemo(() => {
    const pts = (from: number, to: number): Point[] =>
      path.ask.slice(from, to).map((a, k): Point => [sx(xi(from + k)), sy(a)]);
    return {
      week1: linePath(pts(0, C.weekendAt)),
      week2: linePath(pts(C.weekendAt, COUNT)),
      bridge: linePath([
        [sx(xi(C.weekendAt - 1)), sy(path.ask[C.weekendAt - 1]!)],
        [sx(xi(C.weekendAt)), sy(path.ask[C.weekendAt]!)],
      ]),
    };
  }, [scenario, L.width, L.height]);

  const rate = (x: number) => fmtRate(x, PAIR);
  const chf = (x: number, sign = false) => fmtMoney(x, EXAMPLE.quote, lang, 0, sign);
  const notional = fmtMillions(N, '', lang).trim();
  const typeLabel = t(`type.${type}`);
  const day = Math.floor(fill.index / C.perDay) + 1;
  const vsMarket = (fill.price - market.price) * N;
  const fs = `${L.font}px`;
  const yTicks = niceTicks(Y_DOMAIN[0], Y_DOMAIN[1], L.compact ? 4 : 5).filter((v) =>
    inside(v, Y_DOMAIN[0], Y_DOMAIN[1]),
  );
  const dayNames = t('days').split(',');

  /** Comparison with the market order on day 1, in words (no signed amounts in prose). */
  const cmpKey = Math.abs(vsMarket) <= 0.5 ? 'cmpSame' : vsMarket > 0 ? 'cmpMore' : 'cmpLess';
  let noteKey:
    | 'note.market'
    | 'note.limitFilled'
    | 'note.limitGapFilled'
    | 'note.limitMissed'
    | 'note.stopFilled'
    | 'note.stopGap'
    | 'note.stopMissed' = 'note.market';
  if (type === 'limit')
    noteKey = !fill.filled
      ? 'note.limitMissed'
      : fill.viaGap
        ? 'note.limitGapFilled'
        : 'note.limitFilled';
  if (type === 'stop')
    noteKey = !fill.filled ? 'note.stopMissed' : fill.viaGap ? 'note.stopGap' : 'note.stopFilled';
  const note = t(noteKey, {
    rate: rate(fill.price),
    level: level === null ? '' : rate(level),
    diff: t(cmpKey, { chf: chf(Math.abs(vsMarket)) }),
    friday: rate(path.ask[C.weekendAt - 1]!),
    monday: rate(path.ask[C.weekendAt]!),
    pips: fmtNumber(fill.slippagePips, lang),
    slipChf: chf(fill.slippagePips * PIP * N),
  });

  const fx = sx(xi(fill.index));
  const fy = sy(fill.price);
  const ly = level === null ? 0 : sy(level);
  const fillColor = !fill.filled
    ? 'var(--ff-muted)'
    : fill.slippagePips > 0.5
      ? 'var(--ff-bad)'
      : 'var(--ff-long)';
  const aria = t('aria', {
    pair: PAIR,
    scenario: t(`scenario.${scenario}`),
    type: typeLabel,
    levelText: level === null ? '' : t('ariaLevel', { rate: rate(level) }),
    result: fill.filled
      ? t('ariaFilled', { n: day, rate: rate(fill.price) })
      : t('ariaMissed', { rate: rate(fill.price) }),
  });
  const pillW = L.compact ? 56 : 62;
  const fillText = fill.filled
    ? t('fillLabel', { rate: rate(fill.price) })
    : t('endLabel', { rate: rate(fill.price) });
  const fillAnchorEnd = fx > (L.left + L.width) / 2;

  return (
    <div
      class="od"
      data-od
      data-type={type}
      data-scenario={scenario}
      data-filled={fill.filled}
      data-gap={fill.viaGap}
      data-price={fill.price.toFixed(4)}
    >
      <div class="ff-lab-head">
        <div class="od-head-text">
          <div class="ff-lab-title">{t('title')}</div>
          <div class="ff-lab-sub">{t('sub', { notional })}</div>
        </div>
      </div>
      <div class="ff-lab">
        <div class="ff-lab-main">
          <div ref={box}>
            <svg
              ref={svgRef}
              viewBox={`0 0 ${L.width} ${L.height}`}
              role="img"
              aria-label={aria}
              class="od-svg"
            >
              {/* weekend */}
              <rect
                x={sx(C.weekendAt - 0.5)}
                y={L.top}
                width={sx(xi(C.weekendAt) - 0.5) - sx(C.weekendAt - 0.5)}
                height={L.bottom - L.top}
                style={{ fill: 'var(--ff-surface-2)' }}
              />
              <text
                x={(sx(C.weekendAt - 0.5) + sx(xi(C.weekendAt) - 0.5)) / 2}
                y={L.bottom - 8}
                style={{
                  fontSize: L.compact ? '10px' : fs,
                  fontWeight: 600,
                  fill: 'var(--ff-muted)',
                  textAnchor: 'middle',
                }}
              >
                {L.compact ? '' : t('weekend')}
              </text>
              <GridY
                y={sy}
                ticks={yTicks}
                x0={L.left}
                x1={L.width - L.right}
                format={(v) => fmtRate(v, PAIR, 2)}
                fontSize={L.font}
                axisAt={null}
              />
              <text
                x={L.left}
                y={L.top - 14}
                style={{ fontSize: fs, fontWeight: 600, fill: 'var(--ff-muted)' }}
              >
                {t('y', { pair: PAIR })}
              </text>
              {/* days */}
              {dayNames.map((d, k) => {
                const i = k * C.perDay + (C.perDay - 1) / 2;
                return (
                  <text
                    key={k}
                    x={sx(xi(i))}
                    y={L.height - 6}
                    style={{ fontSize: fs, fill: 'var(--ff-muted)', textAnchor: 'middle' }}
                  >
                    {L.compact ? d.slice(0, 2) : d}
                  </text>
                );
              })}
              {/* path */}
              <g key={scenario} class="od-path">
                <path
                  d={lines.week1}
                  pathLength={1}
                  class="od-line od-line--1"
                  style={{ fill: 'none', stroke: 'var(--ff-ink)', strokeWidth: 2 }}
                />
                <path
                  d={lines.bridge}
                  style={{
                    fill: 'none',
                    stroke: 'var(--ff-ref)',
                    strokeWidth: 1.5,
                    strokeDasharray: '3 4',
                  }}
                  class="od-bridge"
                />
                <path
                  d={lines.week2}
                  pathLength={1}
                  class="od-line od-line--2"
                  style={{ fill: 'none', stroke: 'var(--ff-ink)', strokeWidth: 2 }}
                />
              </g>
              {/* order level */}
              {level !== null && (
                <g>
                  <path
                    d={`M${L.left},${ly.toFixed(1)}H${L.width - pillW}`}
                    style={{
                      fill: 'none',
                      stroke: type === 'limit' ? 'var(--ff-long)' : 'var(--ff-short)',
                      strokeWidth: 2,
                      strokeDasharray: '6 5',
                    }}
                  />
                  <path
                    d={`M${L.left},${ly.toFixed(1)}H${L.width - L.right}`}
                    class="od-grab"
                    style={{ fill: 'none', stroke: 'transparent', strokeWidth: 18 }}
                    {...handlers}
                  />
                </g>
              )}
              {/* slippage bracket */}
              {fill.filled && level !== null && Math.abs(fill.slippagePips) > 0.5 && (
                <g class="od-slip" data-slip>
                  <path
                    d={`M${fx + 10},${ly.toFixed(1)}V${fy.toFixed(1)}`}
                    style={{ fill: 'none', stroke: 'var(--ff-bad)', strokeWidth: 2 }}
                  />
                  <path
                    d={`M${fx + 5},${ly.toFixed(1)}H${fx + 15}M${fx + 5},${fy.toFixed(1)}H${fx + 15}`}
                    style={{ fill: 'none', stroke: 'var(--ff-bad)', strokeWidth: 2 }}
                  />
                  <text
                    x={fx + 20}
                    y={(ly + fy) / 2 + 4}
                    style={{
                      fontSize: fs,
                      fontWeight: 800,
                      fill: 'var(--ff-bad-text)',
                      paintOrder: 'stroke',
                      stroke: '#fff',
                      strokeWidth: 4,
                    }}
                  >
                    {t('slipLabel', { pips: fmtNumber(Math.abs(fill.slippagePips), lang) })}
                  </text>
                </g>
              )}
              {/* fill */}
              <g
                key={`f-${scenario}`}
                class="od-fill"
                style={{ animationDelay: `${(fill.index / COUNT) * 1.4}s` }}
              >
                <circle
                  cx={fx}
                  cy={fy}
                  r={7}
                  style={{
                    fill: fill.filled ? fillColor : '#fff',
                    stroke: fill.filled ? '#fff' : fillColor,
                    strokeWidth: fill.filled ? 2.5 : 2,
                  }}
                />
                <text
                  x={fillAnchorEnd ? fx - 12 : fx + 12}
                  y={fy - 12}
                  style={{
                    fontSize: fs,
                    fontWeight: 700,
                    fill: 'var(--ff-ink)',
                    textAnchor: fillAnchorEnd ? 'end' : 'start',
                    paintOrder: 'stroke',
                    stroke: '#fff',
                    strokeWidth: 4,
                  }}
                >
                  {fillText}
                </text>
              </g>
              {/* level handle */}
              {level !== null && (
                <g class={`od-handle${dragging ? ' is-active' : ''}`} data-handle {...handlers}>
                  <rect
                    x={L.width - L.right}
                    y={ly - 22}
                    width={L.right}
                    height={44}
                    style={{ fill: 'transparent' }}
                  />
                  <rect
                    x={L.width - pillW - 2}
                    y={ly - 11}
                    width={pillW}
                    height={22}
                    rx={11}
                    style={{
                      fill: type === 'limit' ? 'var(--ff-long)' : 'var(--ff-exotics-text)',
                      stroke: '#fff',
                      strokeWidth: 2,
                    }}
                  />
                  <text
                    x={L.width - pillW / 2 - 2}
                    y={ly + 4}
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      fill: '#fff',
                      textAnchor: 'middle',
                      fontFamily: 'var(--ff-font-mono)',
                      pointerEvents: 'none',
                    }}
                  >
                    {rate(level)}
                  </text>
                </g>
              )}
            </svg>
          </div>
          <div class="od-legend">
            <span class="od-legend-item">
              <span aria-hidden="true" class="od-swatch" />
              {t('askLine')}
            </span>
            {level !== null && (
              <span class="od-legend-item">
                <span aria-hidden="true" class={`od-swatch od-swatch--${type}`} />
                {t('levelLabel', { type: typeLabel, rate: rate(level) })}
              </span>
            )}
            {level !== null && <span class="od-hint">{t('drag')}</span>}
          </div>
        </div>
        <div class="ff-lab-side">
          <StatTable>
            <StatHero
              label={t('heroLabel')}
              value={rate(fill.price)}
              sub={t('heroSub', { cost: chf(fill.costChf), notional })}
            />
            <StatRow label={t('rowFilled')} value={fill.filled ? t('yes') : t('no')} />
            <StatRow label={t('rowDay')} value={t('dayN', { n: day })} />
            {type !== 'market' && (
              <StatRow
                label={t('rowSlip')}
                value={
                  fill.filled
                    ? t('pipsValue', { pips: fmtNumber(fill.slippagePips, lang, { sign: true }) })
                    : '–'
                }
                highlight={fill.slippagePips > 0.5}
              />
            )}
            <StatRow label={t('rowVsMarket')} value={chf(vsMarket, true)} />
          </StatTable>
          <div class="panel">
            <div class="od-control">
              <span class="field-label">{t('type')}</span>
              <Segmented
                label={t('type')}
                options={ORDER_TYPES.map((o) => ({ value: o, label: t(`type.${o}`) }))}
                value={type}
                onChange={setType}
              />
            </div>
            <div class="od-control">
              <span class="field-label">{t('scenario')}</span>
              <Segmented
                label={t('scenario')}
                options={SCENARIOS.map((s) => ({ value: s, label: t(`scenario.${s}`) }))}
                value={scenario}
                onChange={setScenario}
              />
            </div>
            {level !== null && (
              <Slider
                id={`od-${uid}`}
                label={t('level', { type: typeLabel })}
                value={level}
                min={range.min}
                max={range.max}
                step={C.step}
                valueText={rate(level)}
                onInput={setLevel}
              />
            )}
          </div>
          <p
            class={`od-note${fill.viaGap && type === 'stop' ? ' is-gap' : ''}`}
            data-note
            aria-live="polite"
          >
            {note}
          </p>
        </div>
      </div>
    </div>
  );
}
