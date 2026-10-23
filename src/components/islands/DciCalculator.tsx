/**
 * Dual currency calculator (modules 08 and 09). A CHF deposit plus a sold USD put / CHF call:
 * enhanced yield against the money-market rate, break-even, and the outcome at maturity for
 * any fixing — kept in CHF above the strike, converted into USD at the strike below it. The
 * chart shows the result against a plain deposit, so the conversion risk is visible as the
 * region below zero.
 *
 * Props (serialisable, set on DciCalculatorFigure.astro; module 09 may reuse them):
 * - lang: 'de' | 'en'.
 * - capital?: CHF amount (default 100’000 from MC_CONFIG.products.dualCurrency).
 * - months?: 1 | 2 | 3 tenor in months (default 1).
 * - distance?: strike distance below spot as a fraction (default 0.01 = 1 %).
 * - fixing?: initial USD/CHF at maturity for the outcome card (default: 2 % below the strike,
 *   DCI_CONFIG.initialFixingBelowStrike).
 *
 * Interaction: sliders for capital, strike distance and the fixing at maturity, tenor buttons,
 * and a draggable fixing handle on the chart (the fixing slider is its accessible twin).
 * Maths in src/lib/dcicalc.ts (closed form from src/lib/fx/mc/dci.ts), strings in
 * src/i18n/dict/dcicalculator.ts.
 */
import type { JSX } from 'preact';
import { useId, useMemo, useRef, useState } from 'preact/hooks';
import { GridY } from '@/components/ui/Chart';
import { Legend, type LegendItem } from '@/components/ui/Legend';
import { Segmented } from '@/components/ui/Segmented';
import { Slider } from '@/components/ui/Slider';
import { StatHero, StatRow, StatTable } from '@/components/ui/Stat';
import { useElementWidth, usePrefersReducedMotion, useTween } from '@/components/ui/hooks';
import { dcicalculator as dict } from '@/i18n/dict/dcicalculator';
import { translator, type Lang } from '@/i18n/types';
import { clamp, linePath, niceTicks, scaleLinear, type Point } from '@/lib/chart';
import { EXAMPLE, EXAMPLE_LABEL } from '@/lib/fx/example';
import { fmtMoney, fmtNumber, fmtPct, fmtPips, fmtRate } from '@/lib/format';
import {
  DCI_CONFIG,
  dciCurve,
  dciOutcome,
  dciRange,
  dciView,
  defaultFixing,
  snapFixing,
  type DciMonths,
} from '@/lib/dcicalc';

export interface DciCalculatorProps {
  lang: Lang;
  capital?: number;
  months?: number;
  distance?: number;
  fixing?: number;
}

const PAIR = EXAMPLE.pair;
const SAMPLES = 80;
const isMonths = (m: unknown): m is DciMonths =>
  (DCI_CONFIG.months as readonly unknown[]).includes(m);

function layoutFor(w: number) {
  const width = Math.max(280, Math.round(w));
  const compact = width < 560;
  return {
    width,
    compact,
    font: compact ? 11 : 12,
    left: compact ? 52 : 64,
    right: compact ? 12 : 18,
    top: 30,
    height: compact ? 270 : Math.round(clamp(width * 0.5, 300, 360)),
    axis: 26,
  };
}

export default function DciCalculator(props: DciCalculatorProps): JSX.Element {
  const { lang } = props;
  const t = translator(dict, lang);
  const uid = useId().replace(/[^A-Za-z0-9_-]/g, '');
  const rm = usePrefersReducedMotion();
  const C = DCI_CONFIG;
  const [capital, setCapital] = useState(
    clamp(props.capital ?? C.capital.initial, C.capital.min, C.capital.max),
  );
  const [months, setMonths] = useState<DciMonths>(isMonths(props.months) ? props.months : 1);
  const [distance, setDistance] = useState(
    clamp(props.distance ?? C.distance.initial, C.distance.min, C.distance.max),
  );
  const view = useMemo(() => dciView(capital, months, distance), [capital, months, distance]);
  const K = view.product.strike;
  const [x0, x1] = dciRange();
  const snapFix = (x: number) => snapFixing(x);
  const [fixing, setFixing] = useState(() =>
    props.fixing !== undefined ? snapFixing(props.fixing) : defaultFixing(view),
  );
  const [drag, setDrag] = useState(false);
  const [sliding, setSliding] = useState(false);
  const dragId = useRef<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const L = layoutFor(useElementWidth(box, 640));

  /* ---------- curve: result against the deposit ---------- */
  const curve = useMemo(() => {
    const c = dciCurve(view, x0, x1, SAMPLES);
    return c.dci.map(([x, v]): Point => [x, v - view.depositValue]);
  }, [view]);
  const instant = rm || drag || sliding;
  const ysTween = useTween(
    curve.map((p) => p[1]),
    300,
    instant,
  );
  const pts: Point[] =
    ysTween.length === curve.length ? curve.map((p, i) => [p[0], ysTween[i]!]) : curve;
  const domTarget = useMemo<[number, number]>(() => {
    const lo = Math.min(...curve.map((p) => p[1]));
    const hi = Math.max(0, ...curve.map((p) => p[1]));
    const span = Math.max(hi - lo, capital * 0.01);
    return [lo - span * 0.06, hi + span * 0.18];
  }, [curve, capital]);
  const dom = useTween(domTarget, 300, instant);
  const xs = scaleLinear([x0, x1], [L.left, L.width - L.right]);
  const plotBottom = L.height - L.axis;
  const ys = scaleLinear([dom[0]!, dom[1]!], [plotBottom, L.top]);
  const yTicks = niceTicks(dom[0]!, dom[1]!, L.compact ? 4 : 5).filter(
    (v) => v >= dom[0]! && v <= dom[1]!,
  );
  const xTicks = niceTicks(x0, x1, L.compact ? 4 : 6).filter((v) => v > x0 && v < x1);
  const kTw = useTween(K, 300, instant);
  const beTw = useTween(view.quote.breakEven, 300, instant);

  /* ---------- outcome ---------- */
  const out = dciOutcome(view, fixing);
  const diff = out.vsDepositQuote;
  const chf = (x: number, sign = false) => fmtMoney(x, EXAMPLE.quote, lang, 0, sign);
  const usd = (x: number) => fmtMoney(x, EXAMPLE.base, lang);
  const rate = (x: number) => fmtRate(x, PAIR);
  const pct = (x: number, d = 2) => fmtPct(x, lang, d);
  const q = view.quote;
  const outText = !out.converted
    ? t('dci.out.keep', {
        s: rate(fixing),
        total: chf(out.amountQuote),
        int: chf(q.interest),
        diff: chf(diff),
      })
    : t(diff >= 0 ? 'dci.out.convertGood' : 'dci.out.convertBad', {
        s: rate(fixing),
        usd: usd(out.amountBase),
        k: rate(K),
        int: chf(q.interest),
        value: chf(out.valueQuote),
        diff: chf(Math.abs(diff)),
      });
  const tone = !out.converted ? 'good' : diff >= 0 ? 'warn' : 'bad';

  /* ---------- pointer ---------- */
  const toRate = (clientX: number) => {
    const el = svgRef.current;
    if (!el) return fixing;
    const r = el.getBoundingClientRect();
    return snapFix(xs.invert(((clientX - r.left) * L.width) / Math.max(1, r.width)));
  };
  const onDown = (e: PointerEvent) => {
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    dragId.current = e.pointerId;
    setDrag(true);
    setFixing(toRate(e.clientX));
  };
  const onMove = (e: PointerEvent) => {
    if (dragId.current !== e.pointerId) return;
    setFixing(toRate(e.clientX));
  };
  const onUp = (e: PointerEvent) => {
    if (dragId.current !== e.pointerId) return;
    dragId.current = null;
    setDrag(false);
  };

  /* ---------- drawing ---------- */
  const fs = `${L.font}px`;
  const zero = ys(0);
  const dciD = linePath(pts.map(([x, y]): Point => [xs(x), ys(y)]));
  const kx = xs(kTw);
  const bex = xs(beTw);
  const fx = xs(fixing);
  const fy = ys(diff);
  const spotX = xs(EXAMPLE.spot);
  const fwdX = xs(view.forward);
  const clipId = `dci-clip-${uid}`;
  const halo = {
    paintOrder: 'stroke',
    stroke: '#fff',
    strokeWidth: 4,
    strokeLinejoin: 'round',
  } as const;
  const legend: LegendItem[] = [
    { label: t('dci.lg.dci'), color: 'var(--ff-long)' },
    { label: t('dci.lg.deposit'), color: 'var(--ff-forward)', kind: 'dashed', width: 2 },
    { label: t('dci.lg.zone'), color: 'rgba(234, 88, 12, 0.18)', kind: 'area' },
  ];
  const fixLabel = rate(fixing);
  const fixW = fixLabel.length * 7.4 + 18;
  const fixLabelX = clamp(fx - fixW / 2, L.left, L.width - L.right - fixW);
  const aria = t('dci.aria', {
    k: rate(K),
    be: rate(q.breakEven),
    yield: pct(q.yieldPa),
    s: rate(fixing),
    diff: chf(diff, true),
  });
  const monthsLabel = (m: number) => t(m === 1 ? 'dci.month' : 'dci.months', { m });

  return (
    <div
      class="dci"
      data-dci
      data-converted={out.converted ? 'true' : 'false'}
      data-yield={q.yieldPa.toFixed(6)}
    >
      <div class="ff-lab-head">
        <div class="dci-head-text">
          <div class="ff-lab-title">{t('dci.title')}</div>
          <div class="ff-lab-sub">
            {t('dci.sub', {
              spot: rate(EXAMPLE.spot),
              vol: fmtPct(EXAMPLE.vol, lang, 0),
              label: EXAMPLE_LABEL[lang],
            })}
          </div>
        </div>
        <span class="ff-pill-note dci-generic">{t('dci.generic')}</span>
      </div>

      <div class="ff-lab">
        <div class="ff-lab-main">
          <Legend items={legend} />
          <div ref={box} class="dci-chart">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${L.width} ${L.height}`}
              role="img"
              aria-label={aria}
              class={`dci-svg${drag ? ' is-dragging' : ''}`}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
              data-dci-chart
            >
              <defs>
                <clipPath id={clipId}>
                  <rect
                    x={L.left}
                    y={L.top - 4}
                    width={L.width - L.left - L.right}
                    height={plotBottom - L.top + 8}
                  />
                </clipPath>
              </defs>
              {/* conversion zone */}
              <rect
                x={L.left}
                y={L.top}
                width={Math.max(0, kx - L.left)}
                height={plotBottom - L.top}
                class="dci-zone"
              />
              {kx - L.left > 90 && (
                <text
                  x={L.left + 8}
                  y={L.top + L.font + 4}
                  class="dci-zone-label"
                  style={{ fontSize: fs }}
                >
                  {t('dci.zone')}
                </text>
              )}
              <GridY
                y={ys}
                ticks={yTicks}
                x0={L.left}
                x1={L.width - L.right}
                format={(v) => fmtNumber(v, lang, { sign: true })}
                axisAt={null}
                fontSize={L.font}
              />
              <text x={L.left} y={L.top - 14} class="dci-axis-title" style={{ fontSize: fs }}>
                {t('dci.y')}
              </text>
              {/* reference lines: spot, forward, strike */}
              <path d={`M${spotX.toFixed(1)},${L.top}V${plotBottom}`} class="dci-guide" />
              <text
                x={spotX + 4}
                y={plotBottom - 6}
                class="dci-ref-label"
                style={{ fontSize: fs, ...halo }}
              >
                {t('dci.spot')}
              </text>
              <path d={`M${fwdX.toFixed(1)},${L.top}V${plotBottom}`} class="dci-guide" />
              <text
                x={fwdX - 4}
                y={plotBottom - 6}
                class="dci-ref-label"
                style={{ fontSize: fs, textAnchor: 'end', ...halo }}
              >
                {t('dci.fwd')}
              </text>
              <path d={`M${kx.toFixed(1)},${L.top}V${plotBottom}`} class="dci-strike" />
              {/* deposit = zero line */}
              <path d={`M${L.left},${zero.toFixed(1)}H${L.width - L.right}`} class="dci-deposit" />
              {/* DCI result */}
              <g clip-path={`url(#${clipId})`}>
                <path d={dciD} class="dci-line" />
              </g>
              <text
                x={kx + 6}
                y={L.top + L.font + 4}
                class="dci-k-label"
                style={{ fontSize: fs, ...halo }}
              >
                {t('dci.k', { v: rate(K) })}
              </text>
              {/* break-even */}
              <circle cx={bex} cy={zero} r={5} class="dci-be" />
              <text
                x={bex - 8}
                y={zero + L.font + 10}
                class="dci-be-label"
                style={{ fontSize: fs, textAnchor: 'end', ...halo }}
              >
                {t('dci.be', { v: rate(q.breakEven) })}
              </text>
              {/* fixing handle */}
              <g class="dci-handle" onPointerDown={onDown} data-handle="fixing">
                <rect
                  x={fx - 22}
                  y={L.top}
                  width={44}
                  height={plotBottom - L.top}
                  style={{ fill: 'transparent' }}
                />
                <path d={`M${fx.toFixed(1)},${L.top}V${plotBottom}`} class="dci-fix-line" />
                <circle cx={fx} cy={fy} r={7} class={`dci-fix-dot dci-fix-dot--${tone}`} />
                <rect
                  x={fixLabelX}
                  y={plotBottom + 4}
                  width={fixW}
                  height={20}
                  rx={10}
                  class="dci-fix-pill"
                />
                <text
                  x={fixLabelX + fixW / 2}
                  y={plotBottom + 14 + L.font * 0.36}
                  class="dci-fix-text"
                  style={{ fontSize: fs, textAnchor: 'middle' }}
                >
                  {fixLabel}
                </text>
              </g>
              {xTicks.map((v) =>
                Math.abs(xs(v) - fx) < fixW / 2 + 16 ? null : (
                  <text
                    key={`x${v}`}
                    x={xs(v)}
                    y={L.height - 6}
                    style={{ fontSize: fs, fill: 'var(--ff-muted)', textAnchor: 'middle' }}
                  >
                    {fmtRate(v, PAIR, 2)}
                  </text>
                ),
              )}
            </svg>
          </div>
          <p class="dci-hint">{t('dci.dragHint')}</p>
          <div class={`dci-out dci-out--${tone}`} data-outcome={tone} aria-live="polite">
            {outText}
          </div>
          <p class="dci-blocks">
            {t('dci.blocks', {
              cap: chf(capital),
              k: rate(K),
              usd: usd(q.conversionAmountBase),
              prem: chf(q.premium),
            })}
          </p>
        </div>

        <div class="ff-lab-side">
          <div class="panel">
            <Slider
              id={`dci-${uid}-cap`}
              label={t('dci.capital')}
              value={capital}
              min={C.capital.min}
              max={C.capital.max}
              step={C.capital.step}
              valueText={chf(capital)}
              onInput={(v) => {
                setSliding(true);
                setCapital(v);
              }}
            />
            <div class="dci-field">
              <span class="field-label">
                <span>{t('dci.tenor')}</span>
              </span>
              <Segmented
                label={t('dci.tenor')}
                value={String(months)}
                onChange={(v) => {
                  setSliding(false);
                  const m = Number(v);
                  if (isMonths(m)) setMonths(m);
                }}
                options={C.months.map((m) => ({ value: String(m), label: monthsLabel(m) }))}
              />
            </div>
            <Slider
              id={`dci-${uid}-dist`}
              label={t('dci.distance')}
              value={distance}
              min={C.distance.min}
              max={C.distance.max}
              step={C.distance.step}
              valueText={t('dci.distanceValue', { pct: pct(distance), k: rate(K) })}
              onInput={(v) => {
                setSliding(true);
                setDistance(v);
              }}
            />
            <Slider
              id={`dci-${uid}-fix`}
              label={t('dci.fixing')}
              value={fixing}
              min={x0}
              max={x1}
              step={C.fixingStep}
              valueText={rate(fixing)}
              onInput={(v) => {
                setSliding(true);
                setFixing(snapFix(v));
              }}
            />
          </div>
          <StatTable>
            <StatHero
              label={t('dci.yield')}
              value={pct(q.yieldPa)}
              sub={t('dci.yieldSub', { mm: pct(q.moneyMarketRate), prem: pct(q.premiumYield) })}
            />
            <StatRow
              label={t('dci.interest')}
              sub={t('dci.interestSub', { dep: chf(view.depositInterest) })}
              value={chf(q.interest)}
            />
            <StatRow
              label={t('dci.strike')}
              sub={t('dci.strikeSub', {
                spot: fmtPips(view.strikeVsSpotPips, lang, 1, true),
                fwd: fmtPips(view.strikeVsForwardPips, lang, 1, true),
              })}
              value={rate(K)}
            />
            <StatRow
              label={t('dci.breakEven')}
              sub={t('dci.breakEvenSub')}
              value={rate(q.breakEven)}
              highlight
            />
            <StatRow
              label={t('dci.pConv')}
              sub={t('dci.pConvSub')}
              value={fmtPct(view.pConversion, lang, 1)}
              highlight
            />
          </StatTable>
        </div>
      </div>
    </div>
  );
}
