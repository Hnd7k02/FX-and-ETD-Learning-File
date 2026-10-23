/**
 * Carry cushion (module 09, section 4): three yield ideas built from each other on one axis,
 * all measured against a CHF deposit of the same amount on a USD 1 Mio. exposure.
 *   1 Carry: buy USD at spot, deposit them at the USD rate. Break-even = the forward.
 *   2 + short USD call at the cap: a discount certificate. Lower break-even, gain capped.
 *   3 The same curve as CHF deposit + short USD put: dual currency ("same curve").
 * The cushion bracket (spot → break-even) and the 1σ band of the model show the trade-off;
 * the meter compares the cushion with a typical move, and "play" runs the tenor from 1 to 12
 * months: the cushion grows with time, the typical move only with its square root.
 *
 * Props: lang, step? ('carry' | 'discount' | 'dci'), months?, st?. Maths in
 * src/lib/m09/carry.ts, strings in src/i18n/dict/carrycushion.ts.
 */
import type { JSX } from 'preact';
import { useEffect, useId, useMemo, useRef, useState } from 'preact/hooks';
import { AxisX, GridY } from '@/components/ui/Chart';
import { Legend, type LegendItem } from '@/components/ui/Legend';
import { Slider } from '@/components/ui/Slider';
import { StatHero, StatRow, StatTable } from '@/components/ui/Stat';
import {
  useElementWidth,
  useInView,
  usePrefersReducedMotion,
  useTween,
} from '@/components/ui/hooks';
import { carrycushion as dict } from '@/i18n/dict/carrycushion';
import { translator, type Lang } from '@/i18n/types';
import { clamp, linePath, niceTicks, scaleLinear, type Point } from '@/lib/chart';
import { EXAMPLE, EXAMPLE_LABEL } from '@/lib/fx/example';
import { fmtMillions, fmtMoney, fmtNumber, fmtPct, fmtRate } from '@/lib/format';
import { M09_CONFIG, PIP } from '@/lib/m09/config';
import {
  CARRY_DEFAULTS,
  YIELD_STEPS,
  carryRange,
  carryView,
  clampCarryInputs,
  cushionPips,
  initialCarryFixing,
  isYieldStep,
  probLoss,
  snapCarryFixing,
  yieldBlockPerUsd,
  yieldPnl,
  yieldReturnPa,
  type CarryInputs,
  type YieldBlock,
  type YieldStep,
} from '@/lib/m09/carry';

export interface CarryCushionProps {
  lang: Lang;
  step?: string;
  months?: number;
  st?: number;
}

const PAIR = EXAMPLE.pair;
const C = M09_CONFIG.carry;
const N = C.notionalBase;
const Y_MAX = 100_000;
const SAMPLES = 200;

function layoutFor(w: number) {
  const width = Math.max(280, Math.round(w));
  const compact = width < 560;
  const font = compact ? 11 : 12;
  const titleRow = font + 8;
  const plot = compact ? 260 : Math.round(clamp(width * 0.52, 290, 360));
  const top = 30;
  const plotBottom = top + plot;
  const rail = plotBottom + 22;
  const ticksY = rail + 36;
  return {
    width,
    height: ticksY + titleRow,
    compact,
    font,
    left: compact ? 52 : 64,
    right: compact ? 8 : 14,
    top,
    plotBottom,
    rail,
    ticksY,
  };
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

export default function CarryCushion(props: CarryCushionProps): JSX.Element {
  const { lang } = props;
  const t = translator(dict, lang);
  const uid = useId().replace(/[^A-Za-z0-9_-]/g, '');
  const rm = usePrefersReducedMotion();
  const range = carryRange();
  const xs = useMemo(
    () =>
      Array.from(
        { length: SAMPLES + 1 },
        (_, i) => range[0] + ((range[1] - range[0]) * i) / SAMPLES,
      ),
    [],
  );

  const [step, setStep] = useState<YieldStep>(isYieldStep(props.step) ? props.step : 'carry');
  const [inputs, setInputs] = useState<CarryInputs>(() =>
    clampCarryInputs({
      ...CARRY_DEFAULTS,
      months: typeof props.months === 'number' ? props.months : CARRY_DEFAULTS.months,
    }),
  );
  const [st, setSt] = useState(() =>
    typeof props.st === 'number' ? snapCarryFixing(props.st) : initialCarryFixing(),
  );
  const [dragging, setDragging] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [played, setPlayed] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const pointer = useRef<number | null>(null);
  const inView = useInView(root);
  const L = layoutFor(useElementWidth(box, 640));

  const v = useMemo(() => carryView(inputs), [inputs]);

  /* ---------- playback: the tenor runs from 1 to 12 months ---------- */
  useEffect(() => {
    if (!playing || !inView) return;
    const stepMs = Math.round(C.playMs / (C.months.max - C.months.min));
    const id = setInterval(() => {
      setInputs((i) => (i.months >= C.months.max ? i : { ...i, months: i.months + 1 }));
    }, stepMs);
    return () => clearInterval(id);
  }, [playing, inView]);
  useEffect(() => {
    if (playing && inputs.months >= C.months.max) {
      setPlaying(false);
      setPlayed(true);
    }
  }, [playing, inputs.months]);

  /* ---------- curves (CHF on N) ---------- */
  const mainCurve = useMemo(
    () => xs.map((x) => clamp(yieldPnl(step, x, v), -Y_MAX * 1.2, Y_MAX * 1.2)),
    [xs, step, v],
  );
  const curve = useTween(mainCurve, 450, rm || dragging);
  /* DCI: deposit (the zero line) + short put = the curve itself, so no separate block lines */
  const blocks: YieldBlock[] = step === 'discount' ? ['long', 'shortCall'] : [];
  const blockCurves = blocks.map((b) => xs.map((x) => yieldBlockPerUsd(b, x, v) * N));
  const carryCurve = xs.map((x) => yieldPnl('carry', x, v));
  const be = v.breakEven[step];
  const beTw = useTween([be, v.sigmaBand[0], v.sigmaBand[1]], 450, rm || dragging);
  const resAt = yieldPnl(step, st, v);
  const tw = useTween([resAt], 300, rm || dragging || playing);

  /* ---------- scales ---------- */
  const sx = scaleLinear(range, [L.left, L.width - L.right]);
  const sy = scaleLinear([-Y_MAX, Y_MAX], [L.plotBottom, L.top]);
  const ticksX = niceTicks(range[0], range[1], L.compact ? 4 : 8);
  const ticksY = niceTicks(-Y_MAX, Y_MAX, L.compact ? 4 : 8);
  const y0 = sy(0);
  const pts = (ys: number[]) => xs.map((x, i): Point => [sx(x), sy(ys[i]!)]);

  const areas = useMemo(() => {
    const pos = xs.map((x, i): Point => [sx(x), sy(Math.max(curve[i]!, 0))]);
    const neg = xs.map((x, i): Point => [sx(x), sy(Math.min(curve[i]!, 0))]);
    const close = (p: Point[]) =>
      `${linePath(p)}L${sx(xs[xs.length - 1]!).toFixed(1)},${y0.toFixed(1)}L${sx(xs[0]!).toFixed(1)},${y0.toFixed(1)}Z`;
    return { pos: close(pos), neg: close(neg) };
  }, [curve, L.width, L.height]);

  /* ---------- interaction ---------- */
  const setFix = (x: number) => setSt(snapCarryFixing(x));
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
    setFix(toRate(e.clientX));
  };
  const onMove = (e: PointerEvent) => {
    if (pointer.current !== e.pointerId) return;
    setFix(toRate(e.clientX));
  };
  const onUp = (e: PointerEvent) => {
    if (pointer.current !== e.pointerId) return;
    pointer.current = null;
    setDragging(false);
  };
  const setInput = (k: keyof CarryInputs, val: number) => {
    setPlaying(false);
    setInputs((i) => clampCarryInputs({ ...i, [k]: val }));
  };

  /* ---------- texts ---------- */
  const rate = (x: number) => fmtRate(x, PAIR);
  const chf = (x: number, sign = false) => fmtMoney(x, EXAMPLE.quote, lang, 0, sign);
  const pips = (x: number) => t('cc.pips', { v: fmtNumber(x, lang) });
  const monthsTxt = (m: number) => (m === 1 ? t('cc.monthVal') : t('cc.monthsVal', { m }));
  const name =
    step === 'carry'
      ? t('cc.lg.carry')
      : step === 'discount'
        ? t('cc.lg.discount')
        : t('cc.lg.dci');
  const cushion = cushionPips(step, v);
  const sigmaPips = v.typicalMove / PIP;
  const pLoss = probLoss(step, v);
  const maxText = step === 'carry' ? t('cc.row.maxOpen') : chf(v.maxGainPerUsd[step] * N);
  const desc = t(`cc.desc.${step}`, { f: rate(v.forward), k: rate(v.strike), be: rate(be) });
  const aria = t('cc.aria', {
    name,
    m: inputs.months,
    be: rate(be),
    p: fmtNumber(cushion, lang),
    s: fmtNumber(sigmaPips, lang),
    st: rate(st),
    res: chf(resAt, true),
  });
  const summary = t('cc.summary', {
    name,
    m: inputs.months,
    be: rate(be),
    p: fmtNumber(cushion, lang),
    max: maxText,
    st: rate(st),
    res: chf(resAt, true),
    pl: fmtPct(pLoss, lang, 0),
  });

  const legend: LegendItem[] =
    step === 'carry'
      ? [{ label: t('cc.lg.carry'), color: 'var(--ff-forward)', width: 3 }]
      : [
          ...(step === 'discount'
            ? [
                { label: t('cc.lg.long'), color: 'var(--ff-long)', width: 1.75 },
                { label: t('cc.lg.shortCall'), color: 'var(--ff-short)', width: 1.75 },
              ]
            : []),
          {
            label: step === 'dci' ? t('cc.lg.dciBlocks') : name,
            color: 'var(--ff-forward)',
            width: 3,
          },
          {
            label: t('cc.lg.carry'),
            color: 'var(--ff-ref)',
            kind: 'dashed' as const,
            width: 1.75,
          },
        ];

  /* ---------- geometry ---------- */
  const fs = `${L.font}px`;
  const clipId = `cc-clip-${uid}`;
  const x = sx(st);
  const spotX = sx(v.spot);
  const beX = sx(beTw[0]!);
  const bandX0 = sx(clamp(beTw[1]!, range[0], range[1]));
  const bandX1 = sx(clamp(beTw[2]!, range[0], range[1]));
  const capX = sx(v.strike);
  const meterMax = Math.max(cushion, sigmaPips, 1);
  const bracketY = y0 + 14;

  return (
    <div
      class="cc"
      ref={root}
      data-cc
      data-step={step}
      data-months={inputs.months}
      data-st={st.toFixed(4)}
      data-be={be.toFixed(4)}
    >
      <div class="ff-lab-head">
        <div class="cc-head-text">
          <div class="ff-lab-title">{t('cc.title')}</div>
          <div class="ff-lab-sub">
            {t('cc.sub', {
              notional: fmtMillions(N, EXAMPLE.base, lang),
              spot: rate(v.spot),
              rd: fmtPct(v.rd, lang, 1),
            })}
          </div>
        </div>
        <span class="ff-pill-note cc-example">{EXAMPLE_LABEL[lang]}</span>
      </div>

      <ol class="cc-steps" aria-label={t('cc.steps')}>
        {YIELD_STEPS.map((s, i) => (
          <li key={s}>
            <button
              type="button"
              class="cc-step"
              aria-pressed={step === s}
              data-step-btn={s}
              onClick={() => setStep(s)}
            >
              <span class="cc-step-n" aria-hidden="true">
                {i + 1}
              </span>
              <span class="cc-step-text">
                <span class="cc-step-name">{t(`cc.step.${s}`)}</span>
                <span class="cc-step-sub">{t(`cc.step.${s}.sub`)}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>

      <div class="cc-desc-row" aria-live="polite">
        <p class="cc-desc" key={`d-${step}`} data-desc>
          {desc}
        </p>
        {step === 'dci' && (
          <p class="cc-twin" data-twin>
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <path
                d="M8 1.5L9.6 6.4L14.5 8L9.6 9.6L8 14.5L6.4 9.6L1.5 8L6.4 6.4Z"
                style={{ fill: 'currentColor' }}
              />
            </svg>
            <span>{t('cc.twin')}</span>
          </p>
        )}
      </div>

      <div class="ff-lab">
        <div class="ff-lab-main">
          <Legend items={legend} />
          <div ref={box}>
            <svg
              ref={svgRef}
              viewBox={`0 0 ${L.width} ${L.height}`}
              role="img"
              aria-label={aria}
              class="cc-svg"
            >
              <defs>
                <clipPath id={clipId}>
                  <rect
                    x={L.left}
                    y={L.top - 2}
                    width={L.width - L.left - L.right}
                    height={L.plotBottom - L.top + 4}
                  />
                </clipPath>
              </defs>

              {/* 1σ band of the model */}
              <rect
                x={bandX0}
                y={L.top}
                width={Math.max(0, bandX1 - bandX0)}
                height={L.plotBottom - L.top}
                style={{ fill: 'rgba(14, 17, 22, 0.04)' }}
              />
              <GridY
                y={sy}
                ticks={ticksY}
                x0={L.left}
                x1={L.width - L.right}
                format={(val) =>
                  L.compact
                    ? t('cc.k', { v: fmtNumber(val / 1000, lang, { sign: val > 0 }) })
                    : fmtNumber(val, lang, { sign: val > 0 })
                }
                fontSize={L.font}
              />
              <text
                x={L.left}
                y={L.top - 14}
                style={{ fontSize: fs, fontWeight: 600, fill: 'var(--ff-muted)' }}
              >
                {t('cc.y')}
              </text>
              <text
                x={(bandX0 + bandX1) / 2}
                y={L.top + L.font + 2}
                style={{
                  fontSize: fs,
                  fontWeight: 600,
                  fill: 'var(--ff-muted)',
                  textAnchor: 'middle',
                  ...halo,
                }}
              >
                {t('cc.band')}
              </text>
              <path
                d={`M${spotX.toFixed(1)},${L.top + L.font + 10}V${L.plotBottom}`}
                style={lineStyle('var(--ff-ref)', 1, '4 5')}
              />
              <text
                x={spotX + 6}
                y={L.plotBottom - 6}
                style={{ fontSize: fs, fontWeight: 600, fill: 'var(--ff-ink-2)', ...halo }}
              >
                {t('cc.spot')} {rate(v.spot)}
              </text>

              <g clip-path={`url(#${clipId})`}>
                <path d={areas.pos} style={{ fill: 'var(--ff-timevalue)' }} />
                <path d={areas.neg} style={{ fill: 'rgba(234, 88, 12, 0.1)' }} />
                {step !== 'carry' && (
                  <path
                    d={linePath(pts(carryCurve))}
                    style={lineStyle('var(--ff-ref)', 1.75, '6 5')}
                    data-carry
                  />
                )}
                {blocks.map((b, i) => (
                  <path
                    key={`${step}-${b}`}
                    class="cc-block"
                    d={linePath(pts(blockCurves[i]!))}
                    style={lineStyle(b === 'long' ? 'var(--ff-long)' : 'var(--ff-short)', 1.75)}
                  />
                ))}
                <path
                  d={linePath(pts(curve))}
                  data-curve
                  style={lineStyle('var(--ff-forward)', 3)}
                />
              </g>

              {/* marker at S_T */}
              <path
                d={`M${x.toFixed(1)},${L.top + L.font + 10}V${L.rail}`}
                style={{ fill: 'none', stroke: 'var(--ff-ink)', strokeWidth: 1.25 }}
              />
              {/* cap of the sold option */}
              {step !== 'carry' && (
                <text
                  x={capX}
                  y={sy(v.maxGainPerUsd[step] * N) - 10}
                  style={{
                    fontSize: fs,
                    fontWeight: 700,
                    fill: 'var(--ff-ink-2)',
                    textAnchor: 'middle',
                    ...halo,
                  }}
                >
                  {t('cc.cap', { k: rate(v.strike) })}
                </text>
              )}

              {/* cushion bracket: spot → break-even, on the zero line */}
              <path
                d={`M${beX.toFixed(1)},${bracketY}H${spotX.toFixed(1)}`}
                class="cc-bracket"
                style={{
                  fill: 'none',
                  stroke: 'var(--ff-apply)',
                  strokeWidth: 5,
                  strokeLinecap: 'round',
                }}
                data-cushion
              />
              <text
                x={clamp((beX + spotX) / 2, L.left + 50, L.width - L.right - 50)}
                y={bracketY + L.font + 10}
                style={{
                  fontSize: fs,
                  fontWeight: 800,
                  fill: 'var(--ff-apply-text)',
                  textAnchor: 'middle',
                  ...halo,
                }}
              >
                {t('cc.cushion', { p: fmtNumber(cushion, lang) })}
              </text>
              <circle
                cx={beX}
                cy={y0}
                r={5.5}
                style={{ fill: '#fff', stroke: 'var(--ff-ink)', strokeWidth: 2.5 }}
              />

              <circle
                cx={x}
                cy={sy(clamp(tw[0]!, -Y_MAX, Y_MAX))}
                r={6.5}
                style={{ fill: 'var(--ff-forward)', stroke: '#fff', strokeWidth: 2.5 }}
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
                class={`cc-handle${dragging ? ' is-active' : ''}`}
                data-handle
                onPointerDown={onDown}
                onPointerMove={onMove}
                onPointerUp={onUp}
                onPointerCancel={onUp}
              >
                <rect
                  x={x - 30}
                  y={L.rail - 22}
                  width={60}
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
                ticks={ticksX}
                y={L.ticksY}
                format={(val) => fmtRate(val, PAIR, 2)}
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
                {t('cc.x')}
              </text>
            </svg>
          </div>
          <p class="cc-hint">{t('cc.drag')}</p>
          {played && (
            <p class="cc-aha" data-aha>
              {t('cc.aha', {
                m: inputs.months,
                c: fmtNumber(cushionPips('carry', v), lang),
                s: fmtNumber(sigmaPips, lang),
              })}
            </p>
          )}
          <p class="sr-only" data-summary>
            {summary}
          </p>
        </div>

        <div class="ff-lab-side">
          <StatTable>
            <StatHero
              label={t('cc.hero', { st: rate(st) })}
              value={chf(tw[0]!, true)}
              sub={t('cc.heroSub', { r: fmtPct(yieldReturnPa(step, st, v), lang, 1, true) })}
            />
            <div class="cc-meter" aria-label={t('cc.meter')} role="group">
              <div class="cc-meter-row">
                <span class="cc-meter-label">{t('cc.meter.cushion')}</span>
                <span class="cc-meter-value mono">{pips(cushion)}</span>
                <span class="cc-meter-track" aria-hidden="true">
                  <span
                    class="cc-meter-bar is-cushion"
                    style={{ transform: `scaleX(${clamp(cushion / meterMax, 0, 1)})` }}
                  />
                </span>
              </div>
              <div class="cc-meter-row">
                <span class="cc-meter-label">{t('cc.meter.sigma')}</span>
                <span class="cc-meter-value mono">{pips(sigmaPips)}</span>
                <span class="cc-meter-track" aria-hidden="true">
                  <span
                    class="cc-meter-bar is-sigma"
                    style={{ transform: `scaleX(${clamp(sigmaPips / meterMax, 0, 1)})` }}
                  />
                </span>
              </div>
            </div>
            <StatRow label={t('cc.row.be')} sub={t('cc.row.beSub')} value={rate(be)} />
            <StatRow
              label={t('cc.row.max')}
              sub={
                step === 'carry'
                  ? t('cc.row.maxOpenSub')
                  : t('cc.row.maxSub', { k: rate(v.strike) })
              }
              value={maxText}
            />
            <StatRow label={t('cc.row.p')} sub={t('cc.row.pSub')} value={fmtPct(pLoss, lang, 0)} />
          </StatTable>
          <div class="panel">
            <Slider
              id={`cc-m-${uid}`}
              label={t('cc.months')}
              value={inputs.months}
              min={C.months.min}
              max={C.months.max}
              step={C.months.step}
              valueText={monthsTxt(inputs.months)}
              onInput={(val) => setInput('months', val)}
            />
            <Slider
              id={`cc-rf-${uid}`}
              label={t('cc.rf')}
              value={inputs.usdRate}
              min={C.usdRate.min}
              max={C.usdRate.max}
              step={C.usdRate.step}
              valueText={fmtPct(inputs.usdRate, lang, 2)}
              onInput={(val) => setInput('usdRate', val)}
            />
            <Slider
              id={`cc-vol-${uid}`}
              label={t('cc.vol')}
              value={inputs.vol}
              min={C.vol.min}
              max={C.vol.max}
              step={C.vol.step}
              valueText={fmtPct(inputs.vol, lang, 1)}
              onInput={(val) => setInput('vol', val)}
            />
            {step !== 'carry' && (
              <Slider
                id={`cc-k-${uid}`}
                label={t('cc.strike')}
                value={inputs.strikeBelow}
                min={C.strikeBelow.min}
                max={C.strikeBelow.max}
                step={C.strikeBelow.step}
                valueText={t('cc.strikeVal', {
                  d: fmtPct(inputs.strikeBelow, lang, 2),
                  k: rate(v.strike),
                })}
                onInput={(val) => setInput('strikeBelow', val)}
              />
            )}
            <Slider
              id={`cc-st-${uid}`}
              label={t('cc.st')}
              value={st}
              min={range[0]}
              max={range[1]}
              step={C.fixingStep}
              valueText={rate(st)}
              onInput={setFix}
            />
            <button
              type="button"
              class="btn btn-light cc-play"
              aria-pressed={playing}
              data-play
              onClick={() => {
                if (playing) {
                  setPlaying(false);
                  return;
                }
                setPlayed(false);
                setInputs((i) => ({ ...i, months: C.months.min }));
                setPlaying(true);
              }}
            >
              {playing ? (
                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M5 3.5V12.5M11 3.5V12.5" class="cc-icon-stroke" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M5 3.2L12.5 8L5 12.8Z" class="cc-icon-fill" />
                </svg>
              )}
              <span>{playing ? t('cc.pause') : t('cc.play')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
