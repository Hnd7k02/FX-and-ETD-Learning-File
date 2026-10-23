/**
 * BarrierLab (module 07, section 2): the eight single barriers on the calculation core.
 * Pick call/put, up/down and in/out, move strike, barrier, rebate, spot and time to expiry, and
 * switch between continuous and daily (BGK) monitoring. The lab shows
 * - the value today against spot with the knocked zone and, for knock-outs, the payoff at expiry
 *   with its cliff at the barrier (dashed), the vanilla for comparison,
 * - the numeric delta against spot (it jumps at the barrier and flips sign for reverse KOs),
 * - the in-out parity KO + KI = vanilla as two bars and a numeric check,
 * - price, discount, touch probability, delta and gamma next to the vanilla's.
 *
 * Maths in src/lib/m07/barrierlab.ts. Spot and barrier can be dragged on the charts (sliders
 * are the accessible twins); changes tween in 300 ms, instantly while dragging or under reduced
 * motion; a short annotation appears when the configuration teaches something.
 */
import type { JSX } from 'preact';
import { useMemo, useRef, useState } from 'preact/hooks';
import { Segmented } from '@/components/ui/Segmented';
import { Slider } from '@/components/ui/Slider';
import { StatHero, StatRow, StatTable } from '@/components/ui/Stat';
import { useElementWidth, usePrefersReducedMotion, useTween } from '@/components/ui/hooks';
import { barrierlab as dict } from '@/i18n/dict/barrierlab';
import { translator, type Lang } from '@/i18n/types';
import { linePath, scaleLinear, type Point } from '@/lib/chart';
import { fmtMillions, fmtMoney, fmtNumber, fmtPct, fmtRate } from '@/lib/format';
import { M07_CONFIG, PIP, chartLayout, onGrid } from '@/lib/m07/config';
import { bgkFactor } from '@/lib/m07/paths';
import {
  defaultLabState,
  labAha,
  labCurves,
  labNumbers,
  mirrorBarrier,
  type LabState,
} from '@/lib/m07/barrierlab';
import { annotationBox, inRange, useSliderDrag, useSvgDrag, type DragTarget } from './m07-shared';

export interface BarrierLabProps {
  lang: Lang;
  /** Optional start configuration (e.g. a regular down-and-out for a text example). */
  initial?: Partial<LabState>;
}

const PAIR = 'USD/CHF';
const C = M07_CONFIG.lab;
const R = C.ranges;
const M = M07_CONFIG.market;

const pctDigits = (v: number) => (Number.isInteger(Math.round(v * 1e6) / 1e4) ? 0 : 1);

export default function BarrierLab({ lang, initial }: BarrierLabProps): JSX.Element {
  const t = translator(dict, lang);
  const start = useMemo(() => ({ ...defaultLabState(), ...initial }), []);
  const [s, setS] = useState<LabState>(start);
  const [sliding, onSlide] = useSliderDrag();
  const rm = usePrefersReducedMotion();

  const box = useRef<HTMLDivElement>(null);
  const svgV = useRef<SVGSVGElement>(null);
  const svgD = useRef<SVGSVGElement>(null);
  const width = useElementWidth(box, 600);
  const compact = width < 480;
  const LV = chartLayout(width, compact ? 0.72 : 0.48, 250);
  const LD = chartLayout(width, compact ? 0.48 : 0.28, 170);

  const set = (patch: Partial<LabState>) => setS((p) => ({ ...p, ...patch }));

  const n = useMemo(() => labNumbers(s), [s]);
  const curves = useMemo(() => labCurves(s), [s]);
  const aha = labAha(s, n);

  /* ---------- scales ---------- */
  const [xa, xb] = C.xDomain;
  const x0 = LV.left;
  const x1 = LV.width - LV.right;
  const x = scaleLinear([xa, xb], [x0, x1]);

  const yMaxTarget =
    Math.max(40, ...curves.option.map((p) => p[1]), ...(curves.payoff ?? []).map((p) => p[1])) *
    1.12;
  const dVals = curves.delta.map((p) => p[1]);
  const dTarget: [number, number] = [
    Math.min(-0.2, ...dVals) * 1.08,
    Math.max(1.05, ...dVals) * 1.04,
  ];

  const dragV = useSvgDrag(svgV, LV.width, targets(LV, 'value'));
  const dragD = useSvgDrag(svgD, LD.width, targets(LD, 'delta'));
  const dragging = dragV.active !== null || dragD.active !== null;
  const instant = rm || dragging || sliding;

  const dom = useTween([yMaxTarget, dTarget[0], dTarget[1]], 300, instant);
  const yV = scaleLinear([0, dom[0]!], [LV.height - LV.bottom, LV.top]);
  const yD = scaleLinear([dom[1]!, dom[2]!], [LD.height - LD.bottom, LD.top]);

  const nums = useTween(
    [
      n.price / PIP,
      n.vanilla / PIP,
      n.discount,
      n.touchProb,
      n.delta,
      n.gamma,
      n.ko / PIP,
      n.ki / PIP,
    ],
    300,
    instant,
  );
  const [pricePips, vanillaPips, discount, prob, delta, gamma, koPips, kiPips] =
    nums as number[] as [number, number, number, number, number, number, number, number];

  function targets(
    L: ReturnType<typeof chartLayout>,
    which: 'value' | 'delta',
  ): DragTarget<'spot' | 'barrier'>[] {
    const xs = scaleLinear([xa, xb], [L.left, L.width - L.right]);
    return [
      {
        key: 'spot',
        distance: (vx, vy) => {
          const cy = which === 'value' ? yVRef.current(spotY()) : yDRef.current(n.delta);
          return Math.hypot(vx - xs(s.spot), vy - cy);
        },
        move: (vx) => {
          const v = onGrid(xs.invert(vx), R.spot.step);
          set({ spot: Math.min(R.spot.max, Math.max(R.spot.min, v)) });
        },
      },
      {
        key: 'barrier',
        distance: (vx, vy) =>
          inRange(vy, L.top - 12, L.height - L.bottom)
            ? Math.abs(vx - xs(s.barrier)) + 4
            : Infinity,
        move: (vx) => {
          const v = onGrid(xs.invert(vx), R.barrier.step);
          set({ barrier: Math.min(R.barrier.max, Math.max(R.barrier.min, v)) });
        },
      },
    ];
  }
  // Scales of the last render for the drag hit-tests (they run between renders).
  const yVRef = useRef(yV);
  const yDRef = useRef(yD);
  yVRef.current = yV;
  yDRef.current = yD;
  function spotY(): number {
    return n.price / PIP;
  }

  /* ---------- texts ---------- */
  const rate = (v: number) => fmtRate(v, PAIR);
  const num = (v: number, d: number, sign = false) => fmtNumber(v, lang, { digits: d, sign });
  const pct = (v: number) => fmtPct(v, lang, pctDigits(v));
  const kind = t('bl.kind', {
    dir: t(`bl.dir.${s.dir}`),
    io: t(`bl.io.${s.io}`),
    type: t(`bl.type.${s.type}`),
  });
  const time =
    s.weeks === 1
      ? t('bl.weeks.one')
      : s.weeks === 52
        ? t('bl.weeks.year')
        : s.weeks === 13
          ? t('bl.weeks.q', { n: 13 })
          : t('bl.weeks.n', { n: s.weeks });
  const notional = fmtMillions(M.notional, 'USD', lang);
  const summary = t('bl.summary', {
    kind,
    strike: rate(s.strike),
    barrier: rate(s.barrier),
    spot: rate(s.spot),
    time,
    price: num(n.price / PIP, 1),
    vanilla: num(n.vanilla / PIP, 1),
    delta: num(n.delta, 3),
    gamma: num(n.gamma, 1),
    prob: fmtPct(n.touchProb, lang, 0),
    ko: num(n.ko / PIP, 1),
    ki: num(n.ki / PIP, 1),
  });

  const chip = n.touched
    ? s.io === 'out'
      ? { cls: 'is-bad', b: t('bl.chip.out'), text: t('bl.chip.outText') }
      : { cls: 'is-good', b: t('bl.chip.in'), text: t('bl.chip.inText') }
    : n.reverse
      ? { cls: 'is-warn', b: t('bl.chip.reverse'), text: t('bl.chip.reverseText') }
      : { cls: '', b: t('bl.chip.regular'), text: t('bl.chip.regularText') };

  /* ---------- chart pieces ---------- */
  const xTicks = compact ? [0.76, 0.8, 0.84] : [0.74, 0.76, 0.78, 0.8, 0.82, 0.84, 0.86];
  const zone = (L: ReturnType<typeof chartLayout>) => {
    const [r0, r1] = curves.region;
    const a = x(Math.max(xa, r0));
    const b = x(Math.min(xb, r1));
    return (
      <rect
        x={Math.min(a, b)}
        y={L.top}
        width={Math.abs(b - a)}
        height={L.height - L.bottom - L.top}
        class="m7-zone"
      />
    );
  };
  const vline = (L: ReturnType<typeof chartLayout>, v: number, cls: string) => (
    <path d={`M${x(v).toFixed(1)},${L.top}V${L.height - L.bottom}`} class={cls} />
  );
  const xAxis = (L: ReturnType<typeof chartLayout>) => (
    <g>
      {xTicks.map((v) => (
        <text key={`x${v}`} x={x(v)} y={L.height - 10} class="m7-tick" text-anchor="middle">
          {fmtRate(v, PAIR, 2)}
        </text>
      ))}
    </g>
  );
  const yGrid = (y: typeof yV, ticks: number[], fmt: (v: number) => string) => (
    <g>
      {ticks.map((v) => (
        <g key={`g${v}`}>
          <path
            d={`M${x0},${y(v).toFixed(1)}H${x1}`}
            class={Math.abs(v) < 1e-12 ? 'm7-axis' : 'm7-grid'}
          />
          <text x={x0 - 8} y={y(v) + 4} class="m7-tick" text-anchor="end">
            {fmt(v)}
          </text>
        </g>
      ))}
    </g>
  );
  const ticksFor = (lo: number, hi: number, count: number): { ticks: number[]; digits: number } => {
    const raw = (hi - lo) / count;
    const mag = 10 ** Math.floor(Math.log10(raw));
    const st = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((k) => k >= raw) ?? mag * 10;
    const ticks: number[] = [];
    for (let v = Math.ceil(lo / st) * st; v <= hi + 1e-9; v += st) ticks.push(Number(v.toFixed(6)));
    return { ticks, digits: st >= 1 ? 0 : st >= 0.1 ? 1 : 2 };
  };
  const vTicks = ticksFor(0, dom[0]!, compact ? 3 : 4);
  const dTicks = ticksFor(dom[1]!, dom[2]!, compact ? 3 : 4);
  const P = (pts: Point[], y: typeof yV) => linePath(pts.map(([a, b]) => [x(a), y(b)]));
  const clipV = 'bl-clip-v';
  const clipD = 'bl-clip-d';
  const sx = x(s.spot);
  const svY = yV(Math.min(dom[0]!, n.price / PIP));
  const sdY = yD(Math.max(dom[1]!, Math.min(dom[2]!, n.delta)));
  const bx = x(s.barrier);
  const effX = x(n.effectiveBarrier);
  const showEff = s.monitoring === 'daily' && Math.abs(n.effectiveBarrier - s.barrier) > 1e-9;
  const labelLeft = s.dir === 'down';
  const zoneText = t(s.io === 'out' ? 'bl.zone.out' : 'bl.zone.in');
  const zoneWidth = Math.abs(
    x(Math.min(xb, curves.region[1])) - x(Math.max(xa, curves.region[0])),
  );
  const zoneFits = zoneWidth >= zoneText.length * 7 + 20;
  const zoneY = LV.height - LV.bottom - 10;
  const zoneX = labelLeft ? bx - 6 : bx + 17;

  // annotation on the value chart, next to the spot dot
  let ahaEl: JSX.Element | null = null;
  if (aha) {
    const key = aha === 'touched' ? `touched.${s.io}` : aha;
    const l1 = t(`bl.aha.${key}.t` as Parameters<typeof t>[0]);
    const l2 = t(`bl.aha.${key}.d` as Parameters<typeof t>[0]);
    const { lines, w, h } = annotationBox(l1, l2, Math.min(330, x1 - x0 - 8));
    const right = sx < (x0 + x1) / 2;
    const ax = Math.max(x0 + 4, Math.min(x1 - w - 4, right ? sx + 16 : sx - w - 16));
    const ay = Math.max(LV.top + 4, Math.min(LV.height - LV.bottom - h - 4, svY - h - 18));
    ahaEl = (
      <g class="m7-aha" key={key} data-aha={aha}>
        <rect x={ax} y={ay} width={w} height={h} rx={10} class="m7-aha-box" />
        <text x={ax + 11} y={ay + 18} class="m7-aha-title">
          {l1}
        </text>
        {lines.map((line, i) => (
          <text key={i} x={ax + 11} y={ay + 35 + i * 17} class="m7-aha-text">
            {line}
          </text>
        ))}
      </g>
    );
  }

  const sumPips = koPips + kiPips;
  const scaleMax = Math.max(sumPips, vanillaPips, 1e-9);
  const seg = (v: number) => `${Math.max(0, (v / scaleMax) * 100).toFixed(2)}%`;
  const fits = (v: number) => (v / scaleMax) * Math.max(width, 280) > 64;

  const atDefaults = JSON.stringify(s) === JSON.stringify(start);

  return (
    <div
      class="m7 bl"
      data-barrierlab
      data-kind={n.kind}
      data-reverse={n.reverse ? 'true' : 'false'}
    >
      <div class="ff-lab-head">
        <div class="m7-titles">
          <div class="ff-lab-title">{t('bl.title')}</div>
          <div class="ff-lab-sub">
            {t('bl.sub', {
              kind,
              strike: rate(s.strike),
              barrier: rate(s.barrier),
              time,
              vol: fmtPct(M.vol, lang, 0),
              rd: pct(M.rd),
              rf: pct(M.rf),
            })}
          </div>
        </div>
        <span class={`m7-chip ${chip.cls}`} data-chip>
          <b>{chip.b}</b>
          {chip.text}
        </span>
      </div>

      <div class="bl-toolbar">
        <Segmented
          label={t('bl.seg.type')}
          options={[
            { value: 'call', label: t('bl.opt.call') },
            { value: 'put', label: t('bl.opt.put') },
          ]}
          value={s.type}
          onChange={(type) => set({ type })}
        />
        <Segmented
          label={t('bl.seg.dir')}
          options={[
            { value: 'up', label: t('bl.opt.up') },
            { value: 'down', label: t('bl.opt.down') },
          ]}
          value={s.dir}
          onChange={(dir) =>
            dir !== s.dir && set({ dir, barrier: mirrorBarrier(s.barrier, s.spot) })
          }
        />
        <Segmented
          label={t('bl.seg.io')}
          options={[
            { value: 'out', label: t('bl.opt.out') },
            { value: 'in', label: t('bl.opt.in') },
          ]}
          value={s.io}
          onChange={(io) => set({ io })}
        />
      </div>

      <div class="ff-lab">
        <div class="ff-lab-main" ref={box}>
          <div class="m7-chart-head">
            <span class="tl-subhead">{t('bl.head.value')}</span>
          </div>
          <div class="m7-chart-head">
            <ul class="m7-legend" aria-hidden="true">
              <li>
                <span class="m7-sw" />
                {t('bl.legend.option')}
              </li>
              <li>
                <span class="m7-sw m7-sw-vanilla" />
                {t('bl.legend.vanilla')}
              </li>
              {curves.payoff && (
                <li>
                  <span class="m7-sw m7-sw-payoff" />
                  {t('bl.legend.payoff')}
                </li>
              )}
            </ul>
            <span class="m7-pill">{t('bl.pill.price', { v: num(pricePips, 1) })}</span>
          </div>
          <svg
            ref={svgV}
            viewBox={`0 0 ${LV.width} ${LV.height}`}
            role="img"
            aria-label={t('bl.aria.value', { kind, summary })}
            class={`m7-svg${dragV.active ? ' is-dragging' : ''}`}
            data-chart="value"
            {...dragV.handlers}
          >
            <defs>
              <clipPath id={clipV}>
                <rect
                  x={x0 - 2}
                  y={LV.top - 2}
                  width={x1 - x0 + 4}
                  height={LV.height - LV.bottom - LV.top + 4}
                />
              </clipPath>
            </defs>
            {zone(LV)}
            {yGrid(yV, vTicks.ticks, (v) => num(v, vTicks.digits))}
            {vline(LV, s.strike, 'm7-ref')}
            <text
              x={x(s.strike) + (s.strike < s.barrier ? -6 : 6)}
              y={LV.top + 34}
              class="m7-ref-label"
              text-anchor={s.strike < s.barrier ? 'end' : 'start'}
            >
              {t('bl.ref.strike')}
            </text>
            <g clip-path={`url(#${clipV})`}>
              <path d={P(curves.vanilla, yV)} class="m7-compare" />
              {curves.payoff && <path d={P(curves.payoff, yV)} class="m7-payoff" />}
              <path d={P(curves.option, yV)} class="m7-curve" />
            </g>
            {showEff && vline(LV, n.effectiveBarrier, 'm7-barrier is-dashed bl-eff')}
            {vline(LV, s.barrier, 'm7-barrier')}
            <text
              x={bx + (labelLeft ? 8 : -8)}
              y={LV.top + 14}
              class="m7-barrier-label"
              text-anchor={labelLeft ? 'start' : 'end'}
            >
              {t('bl.ref.barrier', { v: rate(s.barrier) })}
            </text>
            {showEff && (
              <text
                x={effX + (labelLeft ? -8 : 8)}
                y={LV.top + 30}
                class="m7-barrier-label"
                text-anchor={labelLeft ? 'end' : 'start'}
              >
                {t('bl.ref.effective', { v: rate(n.effectiveBarrier) })}
              </text>
            )}
            {zoneFits ? (
              <text
                x={labelLeft ? x0 + 8 : x1 - 8}
                y={zoneY}
                class="m7-zone-label"
                text-anchor={labelLeft ? 'start' : 'end'}
              >
                {zoneText}
              </text>
            ) : (
              <text
                transform={`translate(${zoneX.toFixed(1)},${zoneY}) rotate(-90)`}
                class="m7-zone-label"
              >
                {zoneText}
              </text>
            )}
            <g class="m7-handle" transform={`translate(${bx.toFixed(1)},${LV.top - 2})`}>
              <circle r={22} class="m7-handle-hit" />
              <circle r={dragV.active === 'barrier' ? 11 : 9} class="m7-handle-dot" />
              <path d="M-2.5,-3.5V3.5M0.5,-3.5V3.5M3.5,-3.5V3.5" class="m7-handle-grip" />
            </g>
            <path d={`M${sx.toFixed(1)},${LV.top}V${LV.height - LV.bottom}`} class="bl-guide" />
            {dragV.active === 'spot' && <circle cx={sx} cy={svY} r={16} class="m7-halo" />}
            <circle cx={sx} cy={svY} r={dragV.active === 'spot' ? 8 : 6} class="m7-dot" />
            {xAxis(LV)}
            {ahaEl}
          </svg>

          <div class="m7-chart-head">
            <span class="tl-subhead">{t('bl.head.delta')}</span>
          </div>
          <div class="m7-chart-head">
            <ul class="m7-legend" aria-hidden="true">
              <li>
                <span class="m7-sw m7-sw-delta" />
                {t('bl.legend.delta')}
              </li>
              <li>
                <span class="m7-sw m7-sw-vanilla" />
                {t('bl.legend.vdelta')}
              </li>
            </ul>
            <span class="m7-pill is-soft">{t('bl.pill.delta', { v: num(delta, 3) })}</span>
          </div>
          <svg
            ref={svgD}
            viewBox={`0 0 ${LD.width} ${LD.height}`}
            role="img"
            aria-label={t('bl.aria.delta', {
              kind,
              spot: rate(s.spot),
              delta: num(n.delta, 3),
              vdelta: num(n.vanillaDelta, 3),
            })}
            class={`m7-svg${dragD.active ? ' is-dragging' : ''}`}
            data-chart="delta"
            {...dragD.handlers}
          >
            <defs>
              <clipPath id={clipD}>
                <rect
                  x={x0 - 2}
                  y={LD.top - 2}
                  width={x1 - x0 + 4}
                  height={LD.height - LD.bottom - LD.top + 4}
                />
              </clipPath>
            </defs>
            {zone(LD)}
            {yGrid(yD, dTicks.ticks, (v) => num(v, dTicks.digits))}
            {vline(LD, s.strike, 'm7-ref')}
            <g clip-path={`url(#${clipD})`}>
              <path d={P(curves.vanillaDelta, yD)} class="m7-compare" />
              <path d={P(curves.delta, yD)} class="m7-curve-delta" />
            </g>
            {vline(LD, s.barrier, 'm7-barrier')}
            <path d={`M${sx.toFixed(1)},${LD.top}V${LD.height - LD.bottom}`} class="bl-guide" />
            <circle cx={sx} cy={sdY} r={dragD.active === 'spot' ? 8 : 6} class="m7-dot" />
            {xAxis(LD)}
          </svg>
          <p class="m7-hint">{t('bl.hint')}</p>

          <div class="m7-parity" data-parity>
            <div class="m7-parity-head">
              <span>{t('bl.parity.title', { spot: rate(s.spot) })}</span>
              <span class="m7-muted">{t('bl.parity.rebate')}</span>
            </div>
            <div class="m7-parity-row">
              <span>{t('bl.parity.sum')}</span>
              <div class="m7-bar">
                <span
                  class={`is-ko${s.io === 'out' ? ' is-selected' : ''}`}
                  style={{ width: seg(koPips) }}
                  title={t('bl.parity.ko')}
                >
                  {fits(koPips) ? num(koPips, 1) : ''}
                </span>
                <span
                  class={`is-ki${s.io === 'in' ? ' is-selected' : ''}`}
                  style={{ width: seg(kiPips) }}
                  title={t('bl.parity.ki')}
                >
                  {fits(kiPips) ? num(kiPips, 1) : ''}
                </span>
              </div>
            </div>
            <div class="m7-parity-row">
              <span>{t('bl.parity.vanilla')}</span>
              <div class="m7-bar">
                <span class="is-van" style={{ width: seg(vanillaPips) }}>
                  {fits(vanillaPips) ? num(vanillaPips, 1) : ''}
                </span>
              </div>
            </div>
            <ul class="m7-legend" aria-hidden="true">
              <li>
                <span class="m7-sw" />
                {t('bl.parity.ko')}
              </li>
              <li>
                <span class="m7-sw m7-sw-ki" />
                {t('bl.parity.ki')}
              </li>
            </ul>
            <p class="m7-note mono">
              {t('bl.parity.eq', {
                ko: num(koPips, 1),
                ki: num(kiPips, 1),
                sum: num(sumPips, 1),
                v: num(vanillaPips, 1),
              })}
            </p>
          </div>
          <p class="sr-only">{summary}</p>
        </div>

        <div class="ff-lab-side">
          <div class="panel" onPointerDown={onSlide}>
            <Slider
              id="bl-spot"
              label={t('bl.slider.spot')}
              value={s.spot}
              {...R.spot}
              valueText={rate(s.spot)}
              onInput={(v) => set({ spot: v })}
            />
            <Slider
              id="bl-barrier"
              label={t('bl.slider.barrier')}
              value={s.barrier}
              {...R.barrier}
              valueText={rate(s.barrier)}
              onInput={(v) => set({ barrier: v })}
              accent="var(--ff-exotics)"
            />
            <Slider
              id="bl-strike"
              label={t('bl.slider.strike')}
              value={s.strike}
              {...R.strike}
              valueText={rate(s.strike)}
              onInput={(v) => set({ strike: v })}
            />
            <Slider
              id="bl-rebate"
              label={t('bl.slider.rebate')}
              value={s.rebatePips}
              {...R.rebatePips}
              valueText={t('bl.pips', { v: num(s.rebatePips, 0) })}
              onInput={(v) => set({ rebatePips: v })}
            />
            <Slider
              id="bl-weeks"
              label={t('bl.slider.weeks')}
              value={s.weeks}
              {...R.weeks}
              valueText={time}
              onInput={(v) => set({ weeks: v })}
            />
            <div class="m7-seg-field">
              <span class="m7-seg-label" aria-hidden="true">
                {t('bl.seg.mon')}
              </span>
              <Segmented
                label={t('bl.seg.mon')}
                options={[
                  { value: 'continuous', label: t('bl.opt.continuous') },
                  { value: 'daily', label: t('bl.opt.daily') },
                ]}
                value={s.monitoring}
                onChange={(monitoring) => set({ monitoring })}
              />
            </div>
            <button
              type="button"
              class="m7-btn"
              data-reset
              disabled={atDefaults}
              onClick={() => setS({ ...start })}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                <path d="M3 5.5A4.5 4.5 0 1 1 2.6 8.6M3 2.5V5.5H6" class="m7-icon-stroke" />
              </svg>
              {t('bl.reset')}
            </button>
          </div>

          <StatTable>
            <StatHero
              label={t('bl.hero', { kind })}
              value={t('bl.pips', { v: num(pricePips, 1) })}
              sub={t('bl.heroSub', {
                chf: fmtMoney(pricePips * PIP * M.notional, 'CHF', lang),
                notional,
              })}
            />
            <StatRow
              label={t('bl.row.vanilla', { type: t(`bl.type.${s.type}`) })}
              sub={t('bl.row.vanillaSub')}
              value={t('bl.pips', { v: num(vanillaPips, 1) })}
            />
            <StatRow
              label={t(discount >= 0 ? 'bl.row.discount' : 'bl.row.dearer')}
              sub={t('bl.row.discountSub')}
              value={fmtPct(Math.abs(discount), lang, 0)}
              highlight
            />
            {s.rebatePips > 0 && (
              <StatRow
                label={t('bl.row.rebate')}
                sub={t('bl.row.rebateSub')}
                value={t('bl.pips', { v: num(n.rebateValue / PIP, 1) })}
              />
            )}
            <StatRow
              label={t('bl.row.prob')}
              sub={t('bl.row.probSub')}
              value={fmtPct(prob, lang, 0)}
            />
            <StatRow
              symbol={<>Δ</>}
              label={t('bl.row.delta')}
              sub={t('bl.row.deltaSub', { v: num(n.vanillaDelta, 3) })}
              value={num(delta, 3)}
            />
            <StatRow
              symbol={<>Γ</>}
              label={t('bl.row.gamma')}
              sub={t('bl.row.gammaSub', { v: num(n.vanillaGamma, 1) })}
              value={num(gamma, 1)}
            />
          </StatTable>

          <div class="ff-check">
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              aria-hidden="true"
              class="m7-check-icon"
            >
              <circle cx="10" cy="10" r="9" />
              <path d="M6 10.3L8.8 13L14 7.4" />
            </svg>
            <div class="m7-check-body">
              <span class="m7-check-title">{t('bl.check.title')}</span>
              <span class="m7-check-f" data-parity-gap={n.parityGap}>
                KO + KI − <i>V</i> = {num(n.parityGap / PIP, 4)}
              </span>
              <span>{t('bl.check.text')}</span>
              {s.monitoring === 'daily' && (
                <span>
                  {t('bl.mon.note', {
                    eff: rate(n.effectiveBarrier),
                    f: num(bgkFactor(M.vol), 5),
                  })}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
