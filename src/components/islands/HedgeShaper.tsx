/**
 * Hedge shaper (module 06, section 1): the importer starts with a USD call and adds building
 * blocks — a sold call above (call spread), a sold put below solved for zero cost (collar), or
 * both (seagull). The chart shows the rate he pays at expiry against the rate at expiry, compared
 * with staying unhedged and with the forward. Curves morph between structures; the premium
 * counts down; "Zero Cost" appears when the sold put pays for the call.
 * Drag the rate at expiry on the axis (pointer events) or use the slider (accessible twin).
 * Maths in src/lib/hedge-shaper.ts, strings in src/i18n/dict/hedgeshaper.ts.
 */
import type { JSX } from 'preact';
import { useId, useMemo, useRef, useState } from 'preact/hooks';
import { AxisX, GridY } from '@/components/ui/Chart';
import { Legend } from '@/components/ui/Legend';
import { Slider } from '@/components/ui/Slider';
import { StatHero, StatRow, StatTable } from '@/components/ui/Stat';
import { useElementWidth, usePrefersReducedMotion, useTween } from '@/components/ui/hooks';
import { hedgeshaper as dict } from '@/i18n/dict/hedgeshaper';
import { translator, type Lang } from '@/i18n/types';
import { clamp, linePath, niceTicks, scaleLinear, type Point } from '@/lib/chart';
import { EXAMPLE, EXAMPLE_FORWARD } from '@/lib/fx/example';
import { fmtMillions, fmtMoney, fmtPips, fmtRate, pipSize } from '@/lib/format';
import {
  SHAPER_IDS,
  effectiveCurve,
  effectiveRate,
  shaperFacts,
  shaperId,
  shaperPosition,
  shaperStrikes,
  type ShaperBlocks,
  type ShaperFacts,
  type ShaperId,
  type ShaperPosition,
} from '@/lib/hedge-shaper';
import type { PayoffMarket } from '@/lib/payoff';

export interface HedgeShaperProps {
  lang: Lang;
}

const MARKET: PayoffMarket = {
  S: EXAMPLE.spot,
  T: EXAMPLE.T,
  vol: EXAMPLE.vol,
  rd: EXAMPLE.rd,
  rf: EXAMPLE.rf,
  notional: EXAMPLE.notional,
  pair: EXAMPLE.pair,
};
const PAIR = EXAMPLE.pair;
const PIP = pipSize(PAIR);
const N = EXAMPLE.notional;
/** x and y range of the chart (USD/CHF at expiry and rate paid): a square, so unhedged is 45°. */
const RANGE: [number, number] = [0.74, 0.86];
const ST_STEP = 0.0005;
/** Start of the rate-at-expiry marker: a strong dollar, the importer's fear. */
const ST_START = 0.84;
const SAMPLES = 240;
const XS: number[] = Array.from(
  { length: SAMPLES + 1 },
  (_, i) => RANGE[0] + ((RANGE[1] - RANGE[0]) * i) / SAMPLES,
);
const COLORS = {
  structure: 'var(--ff-long)',
  unhedged: 'var(--ff-short)',
  forward: 'var(--ff-forward)',
} as const;

function layoutFor(w: number) {
  const width = Math.max(280, Math.round(w));
  const compact = width < 560;
  const font = compact ? 11 : 12;
  /* bottom rows: rail with the handle, tick labels, axis title */
  const titleRow = font + 8;
  const height = (compact ? 320 : Math.round(clamp(width * 0.66, 340, 440))) + titleRow;
  const rail = height - titleRow - (compact ? 38 : 42);
  return {
    width,
    height,
    compact,
    font,
    left: compact ? 44 : 54,
    right: compact ? 10 : 16,
    top: 30,
    plotBottom: rail - 16,
    rail,
    ticksY: height - titleRow - 6,
  };
}

interface Precomputed {
  pos: Record<ShaperId, ShaperPosition>;
  facts: Record<ShaperId, ShaperFacts>;
  curves: Record<ShaperId, number[]>;
}

function precompute(): Precomputed {
  const pos = {} as Record<ShaperId, ShaperPosition>;
  const facts = {} as Record<ShaperId, ShaperFacts>;
  const curves = {} as Record<ShaperId, number[]>;
  for (const id of SHAPER_IDS) {
    pos[id] = shaperPosition(id, MARKET);
    facts[id] = shaperFacts(pos[id], MARKET, PIP);
    curves[id] = effectiveCurve(pos[id].legs, MARKET, XS);
  }
  return { pos, facts, curves };
}

const lineStyle = (color: string, width: number, dash?: string) => ({
  fill: 'none',
  stroke: color,
  strokeWidth: width,
  strokeDasharray: dash,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

const halo = {
  paintOrder: 'stroke' as const,
  stroke: '#fff',
  strokeWidth: 4,
  strokeLinejoin: 'round' as const,
};

export default function HedgeShaper({ lang }: HedgeShaperProps): JSX.Element {
  const t = translator(dict, lang);
  const uid = useId().replace(/[^A-Za-z0-9_-]/g, '');
  const rm = usePrefersReducedMotion();
  const pre = useMemo(precompute, []);
  const strikes = useMemo(() => shaperStrikes(MARKET), []);
  const [blocks, setBlocks] = useState<ShaperBlocks>({ sellCall: false, sellPut: false });
  const [st, setSt] = useState(ST_START);
  const [dragging, setDragging] = useState(false);
  const [moved, setMoved] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const pointer = useRef<number | null>(null);
  const L = layoutFor(useElementWidth(box, 640));

  const id = shaperId(blocks);
  const pos = pre.pos[id];
  const f = pre.facts[id];

  /* tweens: the curve morphs on a block toggle, numbers count; instant under reduced motion */
  const curve = useTween(pre.curves[id], 300, rm);
  const premTween = useTween(f.premiumPips, 300, rm);
  const rateAt = effectiveRate(pos.legs, MARKET, st);
  const dots = useTween([rateAt], 300, rm || dragging || !moved);

  const sx = scaleLinear(RANGE, [L.left, L.width - L.right]);
  const sy = scaleLinear(RANGE, [L.plotBottom, L.top]);
  const ticks = niceTicks(RANGE[0], RANGE[1], L.compact ? 3 : 6);

  /* areas between the structure and the unhedged diagonal: saves (blue) and costs (orange) */
  const areas = useMemo(() => {
    const save: Point[] = [];
    const cost: Point[] = [];
    XS.forEach((x, i) => {
      const y = curve[i] ?? x;
      save.push([sx(x), sy(Math.min(y, x))]);
      cost.push([sx(x), sy(Math.max(y, x))]);
    });
    const diag = XS.map((x): Point => [sx(x), sy(x)]);
    const close = (pts: Point[]) =>
      `${linePath(pts)}L${[...diag]
        .reverse()
        .map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`)
        .join('L')}Z`;
    return { save: close(save), cost: close(cost) };
  }, [curve, L.width, L.height]);

  const set = (v: number) => {
    setMoved(true);
    setSt(clamp(Math.round(v / ST_STEP) * ST_STEP, RANGE[0], RANGE[1]));
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
  const toggle = (key: keyof ShaperBlocks) => setBlocks((b) => ({ ...b, [key]: !b[key] }));

  /* ---------- texts ---------- */
  const rate = (x: number) => fmtRate(x, PAIR);
  const chf = (x: number) => fmtMoney(x, EXAMPLE.quote, lang);
  const name = t(`hs.name.${id}`);
  const premiumText = t('hs.pips', { v: fmtPips(f.zeroCost ? 0 : f.premiumPips, lang) });
  const capSub =
    f.protectionEndsAt === null
      ? t('hs.capAlways', { from: rate(f.capFrom) })
      : t('hs.capUntil', {
          from: rate(f.capFrom),
          to: rate(f.protectionEndsAt),
          disc: fmtPips((f.discountAbove ?? 0) / PIP, lang, 0),
        });
  const floorText = f.floorRate === null ? t('hs.floorOpen') : rate(f.floorRate);
  const desc = t(`hs.desc.${id}`, {
    k: rate(strikes.call),
    k2: rate(strikes.sellCall),
    kp: pos.putStrike === null ? '' : rate(pos.putStrike),
  });
  const aria = t('hs.aria', {
    name,
    premium: premiumText,
    st: rate(st),
    rate: rate(rateAt),
    unhedged: rate(st),
  });
  const summary = t('hs.summary', {
    name,
    premium: premiumText,
    cap: rate(f.capRate),
    capSub,
    floor: floorText,
    st: rate(st),
    chf: chf(rateAt * N),
  });

  /* ---------- geometry of the annotations ---------- */
  const fs = `${L.font}px`;
  const clipId = `hs-clip-${uid}`;
  const x = sx(st);
  const capX0 = sx(f.capFrom);
  const capX1 = sx(f.protectionEndsAt ?? RANGE[1]);
  const capLabelX = clamp((capX0 + capX1) / 2, L.left + 50, L.width - L.right - 50);
  const floorX1 = pos.putStrike === null ? null : sx(pos.putStrike);
  const floorLabelX = floorX1 === null ? 0 : clamp((L.left + floorX1) / 2, L.left + 46, floorX1);
  const fwdY = sy(EXAMPLE_FORWARD);

  return (
    <div
      class="hs"
      data-hs
      data-structure={id}
      data-zero-cost={f.zeroCost ? 'true' : 'false'}
      data-st={st.toFixed(4)}
    >
      <div class="ff-lab-head">
        <div class="hs-head-text">
          <div class="ff-lab-title">{t('hs.title')}</div>
          <div class="ff-lab-sub">
            {t('hs.sub', {
              pair: PAIR,
              notional: fmtMillions(N, EXAMPLE.base, lang),
              months: EXAMPLE.months,
              forward: rate(EXAMPLE_FORWARD),
            })}
          </div>
        </div>
        <div class="hs-chips">
          <span class="ff-pill-note hs-name" key={id} data-name>
            {name}
          </span>
          {f.zeroCost && (
            <span class="hs-zero" data-zero-chip>
              {t('hs.zero')}
            </span>
          )}
        </div>
      </div>

      <div class="ff-lab">
        <div class="ff-lab-main">
          <Legend
            items={[
              { label: t('hs.lg.structure'), color: COLORS.structure, width: 3 },
              { label: t('hs.lg.unhedged'), color: COLORS.unhedged, width: 2 },
              { label: t('hs.lg.forward'), color: COLORS.forward, kind: 'dashed', width: 1.75 },
            ]}
          />
          <div ref={box}>
            <svg
              ref={svgRef}
              viewBox={`0 0 ${L.width} ${L.height}`}
              role="img"
              aria-label={aria}
              class="hs-svg"
            >
              <defs>
                <clipPath id={clipId}>
                  <rect
                    x={L.left}
                    y={L.top}
                    width={L.width - L.left - L.right}
                    height={L.plotBottom - L.top}
                  />
                </clipPath>
              </defs>
              <GridY
                y={sy}
                ticks={ticks}
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
                {t('hs.y')}
              </text>

              <g clip-path={`url(#${clipId})`}>
                <path d={areas.save} style={{ fill: 'var(--ff-timevalue)' }} />
                <path d={areas.cost} style={{ fill: 'rgba(234, 88, 12, 0.1)' }} />
                {pos.legs.map((l, i) => (
                  <path
                    key={`k${i}`}
                    d={`M${sx(l.strike).toFixed(1)},${L.top}V${L.plotBottom}`}
                    style={lineStyle('var(--ff-ref)', 1, '4 5')}
                  />
                ))}
                <path
                  d={`M${L.left},${fwdY.toFixed(1)}H${L.width - L.right}`}
                  style={lineStyle(COLORS.forward, 1.75, '6 5')}
                />
                <path
                  d={linePath(XS.map((v): Point => [sx(v), sy(v)]))}
                  style={lineStyle(COLORS.unhedged, 2)}
                />
                <path
                  d={linePath(XS.map((v, i): Point => [sx(v), sy(curve[i] ?? v)]))}
                  data-curve
                  style={lineStyle(COLORS.structure, 3)}
                />
              </g>

              {/* forward label at the left end, above the line */}
              <text
                x={L.left + 6}
                y={fwdY - 7}
                style={{ fontSize: fs, fontWeight: 600, fill: 'var(--ff-ink-2)', ...halo }}
              >
                {t('hs.lg.forward')} {rate(EXAMPLE_FORWARD)}
              </text>

              {/* cap and floor annotations */}
              <text
                key={`cap-${id}`}
                class="hs-note"
                x={capLabelX}
                y={sy(f.capRate) - 10}
                style={{
                  fontSize: fs,
                  fontWeight: 800,
                  fill: 'var(--ff-long)',
                  textAnchor: 'middle',
                  ...halo,
                }}
              >
                {t('hs.cap', { r: rate(f.capRate) })}
              </text>
              {f.protectionEndsAt !== null && (
                <text
                  key={`end-${id}`}
                  class="hs-note"
                  x={sx(f.protectionEndsAt) - 6}
                  y={L.top + 2 * L.font + 14}
                  style={{
                    fontSize: fs,
                    fontWeight: 700,
                    fill: 'var(--ff-ink-2)',
                    textAnchor: 'end',
                    ...halo,
                  }}
                >
                  {t('hs.ends', { k: rate(f.protectionEndsAt) })}
                </text>
              )}
              {f.floorRate !== null && floorX1 !== null && (
                <text
                  key={`floor-${id}`}
                  class="hs-note"
                  x={floorLabelX}
                  y={sy(f.floorRate) + L.font + 8}
                  style={{
                    fontSize: fs,
                    fontWeight: 800,
                    fill: 'var(--ff-long)',
                    textAnchor: 'middle',
                    ...halo,
                  }}
                >
                  {t('hs.floor', { r: rate(f.floorRate) })}
                </text>
              )}
              {f.zeroCost && (
                <text
                  key={`aha-${id}`}
                  class="hs-aha"
                  data-aha
                  x={L.left + 8}
                  y={L.top + L.font + 4}
                  style={{
                    fontSize: `${L.font + 1}px`,
                    fontWeight: 800,
                    fill: 'var(--ff-good-text-strong)',
                    ...halo,
                  }}
                >
                  {t(id === 'seagull' ? 'hs.aha.seagull' : 'hs.aha.collar')}
                </text>
              )}

              {/* marker at the rate at expiry */}
              <path
                d={`M${x.toFixed(1)},${L.top}V${L.rail}`}
                style={{ fill: 'none', stroke: 'var(--ff-ink)', strokeWidth: 1.5 }}
              />
              <circle
                cx={x}
                cy={sy(st)}
                r={5}
                style={{ fill: COLORS.unhedged, stroke: '#fff', strokeWidth: 2.5 }}
              />
              <circle
                cx={x}
                cy={sy(dots[0]!)}
                r={6.5}
                style={{ fill: COLORS.structure, stroke: '#fff', strokeWidth: 2.5 }}
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
              <g
                class={`hs-handle${dragging ? ' is-active' : ''}`}
                data-handle
                onPointerDown={onDown}
                onPointerMove={onMove}
                onPointerUp={onUp}
                onPointerCancel={onUp}
              >
                <rect
                  x={x - 28}
                  y={L.rail - 22}
                  width={56}
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
                  {rate(st)}
                </text>
              </g>
              <AxisX
                x={sx}
                ticks={ticks}
                y={L.ticksY}
                format={(v) => fmtRate(v, PAIR, 2)}
                fontSize={L.font}
              />
              <text
                x={L.width - L.right}
                y={L.height - 4}
                style={{
                  fontSize: fs,
                  fontWeight: 600,
                  fill: 'var(--ff-muted)',
                  textAnchor: 'end',
                }}
              >
                {t('hs.x')}
              </text>
            </svg>
          </div>
          <p class="hs-hint">{t('hs.drag')}</p>
          <p class="sr-only" data-summary>
            {summary}
          </p>
        </div>

        <div class="ff-lab-side">
          <div class="hs-blocks" role="group" aria-label={t('hs.blocks')}>
            <div class="hs-block is-base">
              <span class="hs-block-tag" aria-hidden="true" />
              <span class="hs-block-text">
                <span class="hs-block-name">{t('hs.base', { k: rate(strikes.call) })}</span>
                <span class="hs-block-sub">{t('hs.baseSub', { k: rate(strikes.call) })}</span>
              </span>
            </div>
            <button
              type="button"
              class="hs-block is-short"
              aria-pressed={blocks.sellCall}
              data-block="sellCall"
              onClick={() => toggle('sellCall')}
            >
              <span class="hs-block-tag" aria-hidden="true" />
              <span class="hs-block-text">
                <span class="hs-block-name">{t('hs.sellCall', { k: rate(strikes.sellCall) })}</span>
                <span class="hs-block-sub">{t('hs.sellCallSub')}</span>
              </span>
              <span class="hs-block-state" aria-hidden="true">
                {blocks.sellCall ? t('hs.on') : t('hs.add')}
              </span>
            </button>
            <button
              type="button"
              class="hs-block is-short"
              aria-pressed={blocks.sellPut}
              data-block="sellPut"
              onClick={() => toggle('sellPut')}
            >
              <span class="hs-block-tag" aria-hidden="true" />
              <span class="hs-block-text">
                <span class="hs-block-name">
                  {pos.putStrike === null
                    ? t('hs.sellPut')
                    : t('hs.sellPutK', { k: rate(pos.putStrike) })}
                </span>
                <span class="hs-block-sub">{t('hs.sellPutSub')}</span>
              </span>
              <span class="hs-block-state" aria-hidden="true">
                {blocks.sellPut ? t('hs.on') : t('hs.add')}
              </span>
            </button>
          </div>
          <p class="hs-desc" aria-live="polite" data-desc>
            {desc}
          </p>
          <StatTable>
            <StatHero
              label={t('hs.premium')}
              value={t('hs.pips', {
                v: fmtPips(f.zeroCost && Math.abs(premTween) < 0.05 ? 0 : premTween, lang),
              })}
              sub={
                f.zeroCost ? t('hs.zero') : t('hs.pay', { chf: chf(Math.abs(premTween) * PIP * N) })
              }
            />
            <StatRow label={t('hs.capRow')} sub={capSub} value={rate(f.capRate)} />
            <StatRow
              label={t('hs.floorRow')}
              sub={
                f.floorRate === null
                  ? t('hs.floorOpenSub')
                  : t('hs.floorSub', { k: rate(f.floorRate) })
              }
              value={floorText}
            />
            <StatRow
              label={t('hs.atRow', { st: rate(st) })}
              sub={t('hs.atSub', { u: chf(st * N), f: chf(EXAMPLE_FORWARD * N) })}
              value={chf(rateAt * N)}
              highlight
            />
          </StatTable>
          <div class="panel">
            <Slider
              id={`hs-${uid}`}
              label={t('hs.st')}
              value={st}
              min={RANGE[0]}
              max={RANGE[1]}
              step={ST_STEP}
              valueText={rate(st)}
              onInput={set}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
