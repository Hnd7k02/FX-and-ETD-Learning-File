/**
 * Moneyness explorer (module 04, section 3): premium over the strike, split into intrinsic
 * value against the forward and time value; moneyness chip relative to the forward; desk
 * strikes 10Δ/25Δ put, ATMF, ATM DNS, 25Δ/10Δ call. Drag the strike on the chart or use the
 * slider (accessible twin) and the marker buttons.
 * Maths in src/lib/moneyness.ts, strings in src/i18n/dict/m04.ts (mx.*).
 */
import type { JSX } from 'preact';
import { useId, useMemo, useRef, useState } from 'preact/hooks';
import { AxisX, GridY } from '@/components/ui/Chart';
import { Legend } from '@/components/ui/Legend';
import { Segmented } from '@/components/ui/Segmented';
import { Slider } from '@/components/ui/Slider';
import { StatHero, StatRow, StatTable } from '@/components/ui/Stat';
import { useElementWidth, usePrefersReducedMotion, useTween } from '@/components/ui/hooks';
import { m04 as dict } from '@/i18n/dict/m04';
import { translator, type Lang } from '@/i18n/types';
import { areaPath, clamp, linePath, niceTicks, scaleLinear, type Point } from '@/lib/chart';
import { EXAMPLE, EXAMPLE_FORWARD } from '@/lib/fx/example';
import type { OptionType } from '@/lib/fx/vanilla';
import { fmtMoney, fmtNumber, fmtPct, fmtPips, fmtRate } from '@/lib/format';
import {
  K_RANGE,
  K_STEP,
  markerAt,
  moneyness,
  premiumCurves,
  premiumSplit,
  strikeMarkers,
  type MarkerId,
  type OptionMarket,
} from '@/lib/moneyness';

/** lo ≤ v ≤ hi. */
const inside = (v: number, lo: number, hi: number): boolean => lo <= v && v <= hi;

export interface MoneynessExplorerProps {
  lang: Lang;
  /** Start type (default call). */
  type?: OptionType;
}

const M: OptionMarket = {
  S: EXAMPLE.spot,
  T: EXAMPLE.T,
  vol: EXAMPLE.vol,
  rd: EXAMPLE.rd,
  rf: EXAMPLE.rf,
};
const PAIR = EXAMPLE.pair;
const N = EXAMPLE.notional;
const MARKERS = strikeMarkers(M);
const SAMPLES = 110;
const KS = Array.from(
  { length: SAMPLES + 1 },
  (_, i) => K_RANGE[0] + ((K_RANGE[1] - K_RANGE[0]) * i) / SAMPLES,
);
const Y_DOMAIN: [number, number] = [0, 600];
/** Slider and drag snap onto a desk strike within this distance (2 pips). */
const SNAP = 2e-4;
/**
 * Strikes on the 5-pip grid show 4 decimals; computed desk strikes (the exact forward 0.79303,
 * DNS, delta strikes) show 5, so the ATMF strike is not mistaken for the rounded example
 * strike 0.7930 (126.69 pips) of sections 1 and 2.
 */
const fmtK = (k: number): string =>
  fmtRate(k, PAIR, Math.abs(k / K_STEP - Math.round(k / K_STEP)) < 1e-6 ? 4 : 5);

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
    left: compact ? 38 : 46,
    right: compact ? 10 : 16,
    top: 44,
    plotBottom: rail - 16,
    rail,
  };
}

export default function MoneynessExplorer(props: MoneynessExplorerProps): JSX.Element {
  const { lang } = props;
  const t = translator(dict, lang);
  const uid = useId().replace(/[^A-Za-z0-9_-]/g, '');
  const rm = usePrefersReducedMotion();
  const [type, setType] = useState<OptionType>(props.type === 'put' ? 'put' : 'call');
  const [K, setK] = useState<number>(EXAMPLE_FORWARD);
  const [dragging, setDragging] = useState(false);
  const [how, setHow] = useState<'init' | 'slider' | 'jump'>('init');
  const box = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const pointer = useRef<number | null>(null);
  const L = layoutFor(useElementWidth(box, 640));

  const curves = useMemo(() => premiumCurves(KS, M, type), [type]);
  const instant = rm || how === 'init' || dragging || how === 'slider';
  const ys = useTween([...curves.price, ...curves.intrinsic], 300, rm || how === 'init');
  const split = premiumSplit(K, M, type);
  const pips = (x: number) => x / 1e-4;
  const shown = useTween(
    [pips(split.price), pips(split.intrinsic), pips(split.time), K],
    300,
    instant,
  );
  const money = moneyness(K, split.F, type);
  const near = markerAt(K, MARKERS, 1e-9);

  const sx = scaleLinear([K_RANGE[0], K_RANGE[1]], [L.left, L.width - L.right]);
  const sy = scaleLinear(Y_DOMAIN, [L.plotBottom, L.top]);
  const n = SAMPLES + 1;
  const pricePts = KS.map((k, i): Point => [sx(k), sy(ys[i] ?? 0)]);
  const intrPts = KS.map((k, i): Point => [sx(k), sy(ys[n + i] ?? 0)]);
  const xTicks = niceTicks(K_RANGE[0], K_RANGE[1], L.compact ? 4 : 6).filter((v) =>
    inside(v, K_RANGE[0] + 1e-9, K_RANGE[1] - 1e-9),
  );
  const yTicks = niceTicks(Y_DOMAIN[0], Y_DOMAIN[1], L.compact ? 3 : 6);

  const setStrike = (v: number, mode: 'slider' | 'jump') => {
    setHow(mode);
    const snap = mode === 'slider' ? markerAt(v, MARKERS, SNAP) : null;
    setK(clamp(snap ? snap.K : v, K_RANGE[0], K_RANGE[1]));
  };
  const toStrike = (clientX: number) => {
    const el = svgRef.current;
    if (!el) return K;
    const r = el.getBoundingClientRect();
    const k = sx.invert(((clientX - r.left) * L.width) / Math.max(1, r.width));
    return Math.round(k / K_STEP) * K_STEP;
  };
  const onDown = (e: PointerEvent) => {
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    pointer.current = e.pointerId;
    setDragging(true);
    setStrike(toStrike(e.clientX), 'slider');
  };
  const onMove = (e: PointerEvent) => {
    if (pointer.current === e.pointerId) setStrike(toStrike(e.clientX), 'slider');
  };
  const onUp = (e: PointerEvent) => {
    if (pointer.current !== e.pointerId) return;
    pointer.current = null;
    setDragging(false);
  };

  /* ---------- texts ---------- */
  const pipsText = (v: number) => t('mx.pips', { v: fmtPips(v, lang) });
  const typeLabel = t(type === 'call' ? 'mx.call' : 'mx.put');
  const moneyText =
    money.label === 'ATMF'
      ? t('mx.atmfText')
      : money.fMinusKPips > 0
        ? t('mx.above', { pips: fmtPips(money.fMinusKPips, lang) })
        : t('mx.below', { pips: fmtPips(-money.fMinusKPips, lang) });
  const premiumSub = t('mx.premiumSub', {
    chf: fmtMoney(pips(split.price) * 1e-4 * N, EXAMPLE.quote, lang),
    pct: fmtPct(split.pctBase, lang, 2),
  });
  const aria = t('mx.aria', {
    type: typeLabel,
    k: fmtK(K),
    price: pipsText(pips(split.price)),
    intrinsic: pipsText(pips(split.intrinsic)),
    time: pipsText(pips(split.time)),
    money: `${money.label}, ${moneyText}`,
  });
  const callDelta = premiumSplit(K, M, 'call').delta;
  const putDelta = premiumSplit(K, M, 'put').delta;
  const aha = near
    ? t(`mx.aha.${near.id}`, {
        c: fmtNumber(callDelta, lang, { digits: 3 }),
        p: fmtNumber(putDelta, lang, { digits: 3 }),
      })
    : '';

  const kx = sx(shown[3]!);
  const barW = L.compact ? 8 : 10;
  const yZero = sy(0);
  const yIntr = sy(shown[1]!);
  const yPrice = sy(shown[0]!);
  const fx = sx(split.F);
  const fs = `${L.font}px`;
  const total = Math.max(shown[0]!, 1e-9);
  const moneyClass =
    money.label === 'ATMF' ? 'is-atmf' : money.label === 'ITM' ? 'is-itm' : 'is-otm';

  return (
    <div class="mx" data-mx data-money={money.label} data-k={K.toFixed(5)}>
      <div class="ff-lab-head">
        <div class="mx-head-text">
          <div class="ff-lab-title">{t('mx.title')}</div>
          <div class="ff-lab-sub">
            {t('mx.sub', {
              pair: PAIR,
              spot: fmtRate(M.S, PAIR),
              forward: fmtK(split.F),
              months: EXAMPLE.months,
              vol: fmtPct(M.vol, lang, 0),
            })}
          </div>
        </div>
        <span class={`mx-money ${moneyClass}`} data-money-chip>
          <b>{money.label}</b>
          {moneyText}
        </span>
      </div>
      <div class="ff-lab">
        <div class="ff-lab-main">
          <Legend
            items={[
              { label: t('mx.lg.price'), color: 'var(--ff-long)' },
              { label: t('mx.lg.intrinsic'), color: 'var(--ff-payoff)', kind: 'dashed', width: 2 },
              { label: t('mx.lg.time'), color: 'rgba(37, 99, 235, 0.18)', kind: 'area' },
            ]}
          />
          <div ref={box}>
            <svg
              ref={svgRef}
              viewBox={`0 0 ${L.width} ${L.height}`}
              role="img"
              aria-label={aria}
              class="mx-svg"
            >
              <GridY
                y={sy}
                ticks={yTicks}
                x0={L.left}
                x1={L.width - L.right}
                format={(v) => fmtNumber(v, lang)}
                fontSize={L.font}
              />
              <text
                x={L.left}
                y={L.top - 28}
                style={{ fontSize: fs, fontWeight: 600, fill: 'var(--ff-muted)' }}
              >
                {t('mx.y')}
              </text>
              {/* desk strikes along the top */}
              {MARKERS.map((mk) => {
                const x = sx(mk.K);
                const anchor = mk.id === 'atmf' ? 'end' : mk.id === 'dns' ? 'start' : 'middle';
                const dx = mk.id === 'atmf' ? -3 : mk.id === 'dns' ? 3 : 0;
                const on = near?.id === mk.id;
                return (
                  <g key={mk.id}>
                    <path
                      d={`M${x.toFixed(1)},${L.top - 6}V${L.plotBottom}`}
                      style={{
                        fill: 'none',
                        stroke: on ? 'var(--ff-options)' : 'var(--ff-grid)',
                        strokeWidth: 1,
                        strokeDasharray: mk.id === 'atmf' ? '4 5' : '2 4',
                      }}
                    />
                    <text
                      x={x + dx}
                      y={L.top - 10}
                      style={{
                        fontSize: `${L.font - 1}px`,
                        fontWeight: on ? 800 : 600,
                        fill: on ? 'var(--ff-options-text)' : 'var(--ff-muted)',
                        textAnchor: anchor,
                      }}
                    >
                      {t(`mx.short.${mk.id}`)}
                    </text>
                  </g>
                );
              })}
              <path
                d={`M${fx.toFixed(1)},${L.top - 6}V${L.plotBottom}`}
                style={{
                  fill: 'none',
                  stroke: 'var(--ff-ref)',
                  strokeWidth: 1,
                  strokeDasharray: '4 5',
                }}
              />
              <path d={areaPath(pricePts, intrPts)} style={{ fill: 'var(--ff-timevalue)' }} />
              <path
                d={linePath(intrPts)}
                style={{
                  fill: 'none',
                  stroke: 'var(--ff-payoff)',
                  strokeWidth: 2,
                  strokeDasharray: '6 6',
                }}
              />
              <path
                d={linePath(pricePts)}
                style={{
                  fill: 'none',
                  stroke: 'var(--ff-long)',
                  strokeWidth: 3,
                  strokeLinecap: 'round',
                  strokeLinejoin: 'round',
                }}
              />
              {/* stacked bar at the strike: intrinsic (grey) + time value (blue) */}
              <path
                d={`M${kx.toFixed(1)},${L.top - 6}V${L.rail}`}
                style={{ fill: 'none', stroke: 'var(--ff-ink)', strokeWidth: 1, opacity: 0.5 }}
              />
              <rect
                x={kx - barW / 2}
                y={yIntr}
                width={barW}
                height={Math.max(0, yZero - yIntr)}
                rx={2}
                style={{ fill: 'var(--ff-payoff)' }}
              />
              <rect
                x={kx - barW / 2}
                y={yPrice}
                width={barW}
                height={Math.max(0, yIntr - yPrice)}
                rx={2}
                style={{
                  fill: 'rgba(37, 99, 235, 0.28)',
                  stroke: 'var(--ff-long)',
                  strokeWidth: 1.5,
                }}
              />
              <circle
                cx={kx}
                cy={yPrice}
                r={6}
                style={{ fill: 'var(--ff-long)', stroke: '#fff', strokeWidth: 2.5 }}
              />
              <text
                x={kx + (kx > L.width - 150 ? -14 : 14)}
                y={yPrice - 10}
                style={{
                  fontSize: fs,
                  fontWeight: 700,
                  fill: 'var(--ff-ink)',
                  textAnchor: kx > L.width - 150 ? 'end' : 'start',
                  paintOrder: 'stroke',
                  stroke: '#fff',
                  strokeWidth: 4,
                }}
              >
                {pipsText(shown[0]!)}
              </text>

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
                class={`mx-handle${dragging ? ' is-active' : ''}`}
                data-handle
                onPointerDown={onDown}
                onPointerMove={onMove}
                onPointerUp={onUp}
                onPointerCancel={onUp}
              >
                <rect
                  x={kx - 26}
                  y={L.rail - 22}
                  width={52}
                  height={44}
                  style={{ fill: 'transparent' }}
                />
                <rect
                  x={kx - 34}
                  y={L.rail - 11}
                  width={68}
                  height={22}
                  rx={11}
                  style={{ fill: 'var(--ff-ink)', stroke: '#fff', strokeWidth: 2 }}
                />
                <text
                  x={kx}
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
                  {fmtK(K)}
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
          <div class="mx-markers" role="group" aria-label={t('mx.markers')}>
            {MARKERS.map((mk) => (
              <button
                key={mk.id}
                type="button"
                aria-pressed={Math.abs(mk.K - K) < 1e-9}
                data-marker={mk.id}
                onClick={() => setStrike(mk.K, 'jump')}
              >
                <span>{t(`mx.m.${mk.id as MarkerId}`)}</span>
                <span class="mono">{fmtK(mk.K)}</span>
              </button>
            ))}
          </div>
          <p class="mx-aha" aria-live="polite" data-aha>
            {aha && (
              <span class="mx-aha-text" key={near?.id}>
                {aha}
              </span>
            )}
          </p>
        </div>
        <div class="ff-lab-side">
          <div class="panel">
            <Segmented
              label={t('mx.type')}
              value={type}
              onChange={(v) => {
                setHow('jump');
                setType(v);
              }}
              options={[
                { value: 'call', label: t('mx.call') },
                { value: 'put', label: t('mx.put') },
              ]}
            />
            <Slider
              id={`mx-${uid}`}
              label={t('mx.strike')}
              value={K}
              min={K_RANGE[0]}
              max={K_RANGE[1]}
              step={K_STEP}
              valueText={fmtK(K)}
              onInput={(v) => setStrike(v, 'slider')}
            />
          </div>
          <StatTable>
            <StatHero label={t('mx.premium')} value={pipsText(shown[0]!)} sub={premiumSub} />
            <div class="mx-bar" role="img" aria-label={t('mx.bar')}>
              <span
                class="mx-bar-intr"
                style={{ width: `${(100 * Math.max(0, shown[1]!)) / total}%` }}
              />
              <span
                class="mx-bar-time"
                style={{ width: `${(100 * Math.max(0, shown[2]!)) / total}%` }}
              />
            </div>
            <StatRow
              label={t('mx.intrinsic')}
              sub={t('mx.intrinsicSub')}
              value={pipsText(shown[1]!)}
              symbol={<span aria-hidden="true" class="mx-sw mx-sw-intr" />}
            />
            <StatRow
              label={t('mx.time')}
              sub={t('mx.timeSub')}
              value={pipsText(shown[2]!)}
              symbol={<span aria-hidden="true" class="mx-sw mx-sw-time" />}
            />
            <StatRow
              symbol="Δ"
              label={t('mx.delta')}
              sub={t('mx.deltaSub')}
              value={fmtNumber(split.delta, lang, { digits: 3 })}
            />
          </StatTable>
        </div>
      </div>
    </div>
  );
}
