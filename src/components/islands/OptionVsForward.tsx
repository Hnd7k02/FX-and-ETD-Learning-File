/**
 * Option vs forward (module 04, section 1): what the Swiss importer pays in CHF for USD 1 Mio.
 * at expiry, unhedged, with the forward or with a USD call (= CHF put) including its premium.
 * Drag the rate at expiry on the chart (pointer events) or with the slider (accessible twin).
 * Maths in src/lib/hedge-cost.ts, strings in src/i18n/dict/m04.ts (ovf.*).
 */
import type { JSX } from 'preact';
import { useId, useMemo, useRef, useState } from 'preact/hooks';
import { AxisX, GridY } from '@/components/ui/Chart';
import { Legend } from '@/components/ui/Legend';
import { Slider } from '@/components/ui/Slider';
import { StatRow, StatTable } from '@/components/ui/Stat';
import { useElementWidth, usePrefersReducedMotion, useTween } from '@/components/ui/hooks';
import { m04 as dict } from '@/i18n/dict/m04';
import { translator, type Lang } from '@/i18n/types';
import { clamp, linePath, niceTicks, scaleLinear, type Point } from '@/lib/chart';
import { EXAMPLE, EXAMPLE_STRIKE } from '@/lib/fx/example';
import { fmtMillions, fmtMoney, fmtNumber, fmtRate } from '@/lib/format';
import {
  FORWARD_DIGITS,
  ST_RANGE,
  ST_START,
  ST_STEP,
  hedgeCosts,
  hedgeFacts,
  hedgeRegion,
  rankCosts,
  savingChf,
  type HedgeChoice,
  type HedgeRegion,
  type HedgeSetup,
} from '@/lib/hedge-cost';

/** lo ≤ v ≤ hi. */
const inside = (v: number, lo: number, hi: number): boolean => lo <= v && v <= hi;

export interface OptionVsForwardProps {
  lang: Lang;
}

const SETUP: HedgeSetup = {
  S: EXAMPLE.spot,
  K: EXAMPLE_STRIKE,
  T: EXAMPLE.T,
  vol: EXAMPLE.vol,
  rd: EXAMPLE.rd,
  rf: EXAMPLE.rf,
  notional: EXAMPLE.notional,
  forwardDigits: FORWARD_DIGITS,
};
const FACTS = hedgeFacts(SETUP);
const PAIR = EXAMPLE.pair;
const N = EXAMPLE.notional;
/** y domain in CHF thousands. */
const Y_DOMAIN: [number, number] = [710, 890];
const COLORS: Record<HedgeChoice, string> = {
  unhedged: 'var(--ff-short)',
  forward: 'var(--ff-forward)',
  option: 'var(--ff-long)',
};

function layoutFor(w: number) {
  const width = Math.max(280, Math.round(w));
  const compact = width < 560;
  const height = compact ? 300 : Math.round(clamp(width * 0.58, 320, 400));
  const rail = height - (compact ? 38 : 42);
  return {
    width,
    height,
    compact,
    font: compact ? 11 : 12,
    left: compact ? 40 : 48,
    right: compact ? 10 : 16,
    top: 30,
    plotBottom: rail - 16,
    rail,
  };
}

const bandOf = (r: HedgeRegion): [number, number] =>
  r === 'weakUsd'
    ? [ST_RANGE[0], FACTS.optionBeatsForwardBelow]
    : r === 'middle'
      ? [FACTS.optionBeatsForwardBelow, FACTS.optionBeatsUnhedgedAbove]
      : [FACTS.optionBeatsUnhedgedAbove, ST_RANGE[1]];

export default function OptionVsForward({ lang }: OptionVsForwardProps): JSX.Element {
  const t = translator(dict, lang);
  const uid = useId().replace(/[^A-Za-z0-9_-]/g, '');
  const rm = usePrefersReducedMotion();
  const [st, setSt] = useState(ST_START);
  const [dragging, setDragging] = useState(false);
  const [moved, setMoved] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const pointer = useRef<number | null>(null);
  const L = layoutFor(useElementWidth(box, 640));

  const costs = hedgeCosts(st, SETUP, FACTS);
  const rank = rankCosts(costs);
  const region = hedgeRegion(st, FACTS);
  const instant = rm || dragging || !moved;
  const shown = useTween([costs.unhedged, costs.forward, costs.option], 300, instant);
  const band = useTween(bandOf(region), 300, rm);

  const sx = scaleLinear([ST_RANGE[0], ST_RANGE[1]], [L.left, L.width - L.right]);
  const sy = scaleLinear(Y_DOMAIN, [L.plotBottom, L.top]);
  const yk = (chf: number) => sy(chf / 1000);
  const lines = useMemo(() => {
    const xs = [ST_RANGE[0], SETUP.K, ST_RANGE[1]];
    return {
      unhedged: [ST_RANGE[0], ST_RANGE[1]].map((x): [number, number] => [x, x * N]),
      forward: [ST_RANGE[0], ST_RANGE[1]].map((x): [number, number] => [x, FACTS.F * N]),
      option: xs.map((x): [number, number] => [x, hedgeCosts(x, SETUP, FACTS).option]),
    };
  }, []);
  const path = (pts: Array<[number, number]>) =>
    linePath(pts.map(([x, y]): Point => [sx(x), yk(y)]));
  const xTicks = niceTicks(ST_RANGE[0], ST_RANGE[1], L.compact ? 4 : 8).filter((v) =>
    inside(v, ST_RANGE[0] + 1e-9, ST_RANGE[1] - 1e-9),
  );
  const yTicks = niceTicks(Y_DOMAIN[0], Y_DOMAIN[1], L.compact ? 4 : 5);

  const set = (v: number) => {
    setMoved(true);
    setSt(clamp(Math.round(v / ST_STEP) * ST_STEP, ST_RANGE[0], ST_RANGE[1]));
  };
  const toRate = (clientX: number) => {
    const el = svgRef.current;
    if (!el) return st;
    const r = el.getBoundingClientRect();
    return sx.invert(((clientX - r.left) * L.width) / Math.max(1, r.width));
  };
  const onDown = (e: PointerEvent) => {
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    pointer.current = e.pointerId;
    setDragging(true);
    set(toRate(e.clientX));
  };
  const onMove = (e: PointerEvent) => {
    if (pointer.current !== e.pointerId) return;
    set(toRate(e.clientX));
  };
  const onUp = (e: PointerEvent) => {
    if (pointer.current !== e.pointerId) return;
    pointer.current = null;
    setDragging(false);
  };

  const chf = (x: number) => fmtMoney(x, EXAMPLE.quote, lang);
  const notional = fmtMillions(N, '', lang).trim();
  const x = sx(st);
  const fs = `${L.font}px`;
  const choices: HedgeChoice[] = ['unhedged', 'forward', 'option'];
  const label: Record<HedgeChoice, string> = {
    unhedged: t('ovf.unhedged'),
    forward: t('ovf.forward'),
    option: t('ovf.option'),
  };
  const text = t(`ovf.text.${region}`, {
    forward: chf(costs.forward),
    save: chf(savingChf(costs, 'option', 'forward')),
    premium: chf(FACTS.premium * N),
    unhedged: chf(costs.unhedged),
    cap: chf(FACTS.cap * N),
  });
  const aria = t('ovf.aria', {
    notional,
    st: fmtRate(st, PAIR),
    unhedged: chf(costs.unhedged),
    forward: chf(costs.forward),
    option: chf(costs.option),
  });
  const bandLabel = t(`ovf.band.${region}`);
  const bandMid = (sx(band[0]!) + sx(band[1]!)) / 2;
  /** Half the label width (estimate: 0.56 em per character), so the label stays inside. */
  const bandHalf = (bandLabel.length * L.font * 0.56) / 2 + 4;

  return (
    <div class="ovf" data-ovf data-region={region} data-st={st.toFixed(4)}>
      <div class="ff-lab-head">
        <div class="ovf-head-text">
          <div class="ff-lab-title">{t('ovf.title')}</div>
          <div class="ff-lab-sub">
            {t('ovf.sub', {
              notional,
              months: EXAMPLE.months,
              forward: fmtRate(FACTS.F, PAIR, FORWARD_DIGITS),
              k: fmtRate(SETUP.K, PAIR),
              premium: chf(FACTS.premium * N),
            })}
          </div>
        </div>
        <span class="ff-pill-note ovf-chip">{t('ovf.chip')}</span>
      </div>
      <div class="ff-lab">
        <div class="ff-lab-main">
          <Legend
            items={choices.map((c) => ({
              label: label[c],
              color: COLORS[c],
              width: c === 'option' ? 3 : 2.25,
            }))}
          />
          <div ref={box}>
            <svg
              ref={svgRef}
              viewBox={`0 0 ${L.width} ${L.height}`}
              role="img"
              aria-label={aria}
              class="ovf-svg"
            >
              <rect
                x={sx(band[0]!)}
                y={L.top}
                width={Math.max(0, sx(band[1]!) - sx(band[0]!))}
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
                {t('ovf.y')}
              </text>
              <text
                x={clamp(bandMid, L.left + bandHalf, L.width - L.right - bandHalf)}
                y={L.top + L.font + 6}
                class="ovf-band-label"
                key={region}
                style={{
                  fontSize: fs,
                  fontWeight: 700,
                  fill: 'var(--ff-ink-2)',
                  textAnchor: 'middle',
                  paintOrder: 'stroke',
                  stroke: 'var(--ff-surface-2)',
                  strokeWidth: 4,
                }}
              >
                {bandLabel}
              </text>
              {/* strike and cap */}
              <path
                d={`M${sx(SETUP.K).toFixed(1)},${L.top}V${L.plotBottom}`}
                style={{
                  fill: 'none',
                  stroke: 'var(--ff-ref)',
                  strokeWidth: 1,
                  strokeDasharray: '4 5',
                }}
              />
              <text
                x={sx(SETUP.K) - 6}
                y={L.plotBottom - 8}
                style={{
                  fontSize: fs,
                  fontWeight: 600,
                  fill: 'var(--ff-ink-2)',
                  textAnchor: 'end',
                }}
              >
                K {fmtRate(SETUP.K, PAIR)}
              </text>
              <path d={path(lines.unhedged)} style={lineStyle(COLORS.unhedged, 2.25)} />
              <path d={path(lines.forward)} style={lineStyle(COLORS.forward, 2.25)} />
              <path d={path(lines.option)} style={lineStyle(COLORS.option, 3)} />
              {/* cap label left of the kink, above the line: free space there, and away from
                  the start marker at a strong dollar */}
              <text
                x={sx(SETUP.K) - 6}
                y={yk(FACTS.cap * N) - 8}
                style={{
                  fontSize: fs,
                  fontWeight: 700,
                  fill: 'var(--ff-linear-text)',
                  textAnchor: 'end',
                  paintOrder: 'stroke',
                  stroke: '#fff',
                  strokeWidth: 4,
                }}
              >
                {t('ovf.cap', { cap: chf(FACTS.cap * N) })}
              </text>

              {/* marker at the rate at expiry */}
              <path
                d={`M${x.toFixed(1)},${L.top}V${L.rail}`}
                style={{ fill: 'none', stroke: 'var(--ff-ink)', strokeWidth: 1.5 }}
              />
              {choices.map((c, i) => (
                <circle
                  key={c}
                  cx={x}
                  cy={yk(shown[i]!)}
                  r={c === 'option' ? 6 : 5}
                  style={{ fill: COLORS[c], stroke: '#fff', strokeWidth: 2.5 }}
                />
              ))}
              <path
                d={`M${L.left},${L.rail}H${L.width - L.right}`}
                style={{
                  fill: 'none',
                  stroke: 'var(--ff-line)',
                  strokeWidth: 4,
                  strokeLinecap: 'round',
                }}
              />
              <g
                class={`ovf-handle${dragging ? ' is-active' : ''}`}
                data-handle
                onPointerDown={onDown}
                onPointerMove={onMove}
                onPointerUp={onUp}
                onPointerCancel={onUp}
              >
                <rect
                  x={x - 26}
                  y={L.rail - 22}
                  width={52}
                  height={44}
                  style={{ fill: 'transparent' }}
                />
                <rect
                  x={x - 34}
                  y={L.rail - 11}
                  width={68}
                  height={22}
                  rx={11}
                  style={{ fill: 'var(--ff-ink)', stroke: '#fff', strokeWidth: 2 }}
                />
                <text
                  x={x}
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
                  {fmtRate(st, PAIR)}
                </text>
              </g>
              <AxisX
                x={sx}
                ticks={xTicks}
                y={L.height - 6}
                format={(v) => fmtRate(v, PAIR, 2)}
                fontSize={L.font}
              />
            </svg>
          </div>
          <p class="ovf-hint">{t('ovf.drag')}</p>
        </div>
        <div class="ff-lab-side">
          <div class="panel">
            <Slider
              id={`ovf-${uid}`}
              label={t('ovf.slider')}
              value={st}
              min={ST_RANGE[0]}
              max={ST_RANGE[1]}
              step={ST_STEP}
              valueText={fmtRate(st, PAIR)}
              onInput={set}
            />
          </div>
          <StatTable>
            {choices.map((c, i) => (
              <StatRow
                key={c}
                symbol={
                  <span
                    aria-hidden="true"
                    class="ovf-swatch"
                    style={{ borderTopColor: COLORS[c] }}
                  />
                }
                label={label[c]}
                sub={
                  rank.cheapest === c
                    ? t('ovf.cheapest')
                    : rank.dearest === c
                      ? t('ovf.dearest')
                      : undefined
                }
                value={chf(shown[i]!)}
                highlight={rank.cheapest === c}
              />
            ))}
          </StatTable>
          <p class={`ovf-note ovf-note--${region}`} data-note>
            {text}
          </p>
          <div class="sr-only" aria-live="polite" aria-atomic="true">
            {moved ? bandLabel : ''}
          </div>
        </div>
      </div>
    </div>
  );
}

function lineStyle(color: string, width: number) {
  return {
    fill: 'none',
    stroke: color,
    strokeWidth: width,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };
}
