/**
 * TouchLab (module 07, section 3): digital, one-touch, no-touch and double no-touch on the
 * calculation core. The upper chart shows what the product pays: for the digital the payoff at
 * expiry (step) against a call spread (ramp) over the distribution of USD/CHF; for the touch
 * products the path view with the 68 % / 95 % cone, the forward, seeded sample paths (those
 * that pay in blue) and the barrier(s). The lower chart shows the price in % of the payout
 * against the level (or, for the DNT, against vol) next to the risk-neutral probability: the
 * price is almost the discounted probability.
 *
 * Maths in src/lib/m07/touchlab.ts. Barriers and strike can be dragged (orange handles), the
 * dot in the lower chart too; the sliders are the accessible twins. Pay-at-hit vs at-expiry for
 * the one-touch is a toggle (D-24); with the CHF rate at 0 % both are equal.
 */
import type { JSX } from 'preact';
import { useMemo, useRef, useState } from 'preact/hooks';
import { Segmented } from '@/components/ui/Segmented';
import { Slider } from '@/components/ui/Slider';
import { StatHero, StatRow, StatTable } from '@/components/ui/Stat';
import { useElementWidth, usePrefersReducedMotion, useTween } from '@/components/ui/hooks';
import { touchlab as dict } from '@/i18n/dict/touchlab';
import { translator, type Lang } from '@/i18n/types';
import { areaPath, linePath, scaleLinear, type Point } from '@/lib/chart';
import { fmtMoney, fmtNumber, fmtPct, fmtPctValue, fmtRate } from '@/lib/format';
import { M07_CONFIG, PIP, chartLayout, onGrid, type TouchMode } from '@/lib/m07/config';
import { seededPaths } from '@/lib/m07/paths';
import {
  callSpreadPayoff,
  clampBarrier,
  clampCorridor,
  defaultTouchState,
  forwardAt,
  pathExitDay,
  pathPays,
  quantileAt,
  terminalDensity,
  touchAha,
  touchCurves,
  touchMarket,
  touchNumbers,
  type TouchState,
} from '@/lib/m07/touchlab';
import { annotationBox, inRange, useSliderDrag, useSvgDrag, type DragTarget } from './m07-shared';

/** Monte Carlo check of the DNT (src/data/fx/mc-products.json), passed by the wrapper. */
export interface DntCheck {
  pv: number;
  stdErr: number;
  bgk: number;
  lower: number;
  upper: number;
  vol: number;
}

export interface TouchLabProps {
  lang: Lang;
  mc: DntCheck;
  initialMode?: TouchMode;
}

const PAIR = 'USD/CHF';
const C = M07_CONFIG.touch;
const R = C.ranges;
const S = M07_CONFIG.market.spot;
const MONTH_DAYS = 365 / 12;
const MODES: TouchMode[] = ['digital', 'oneTouch', 'noTouch', 'dnt'];

type Handle = 'strike' | 'barrier' | 'lower' | 'upper';

export default function TouchLab({ lang, mc, initialMode }: TouchLabProps): JSX.Element {
  const t = translator(dict, lang);
  const start = useMemo(
    () => ({ ...defaultTouchState(), ...(initialMode ? { mode: initialMode } : {}) }),
    [],
  );
  const [s, setS] = useState<TouchState>(start);
  const [sliding, onSlide] = useSliderDrag();
  const rm = usePrefersReducedMotion();
  const set = (patch: Partial<TouchState>) => setS((p) => ({ ...p, ...patch }));

  const box = useRef<HTMLDivElement>(null);
  const svgTop = useRef<SVGSVGElement>(null);
  const svgBot = useRef<SVGSVGElement>(null);
  const width = useElementWidth(box, 600);
  const compact = width < 480;
  const LT = chartLayout(width, compact ? 0.78 : 0.48, 250);
  const LB = chartLayout(width, compact ? 0.6 : 0.34, 190);

  const m = touchMarket(s);
  const n = useMemo(() => touchNumbers(s), [s]);
  const curves = useMemo(() => touchCurves(s), [s]);
  const paths = useMemo(
    () => seededPaths({ spot: S, rd: m.rd, rf: m.rf, vol: m.vol }, C.samplePaths, C.days, C.seed),
    [m.rd, m.vol],
  );
  const aha = touchAha(s);

  /* ---------- geometry: top chart ---------- */
  const handleSpace = 20;
  const x0 = LT.left;
  const x1 = LT.width - LT.right - handleSpace;
  const yDom: [number, number] = [0.74, 0.86];
  const isDigital = s.mode === 'digital';
  const xDays = scaleLinear([0, C.days], [x0, x1]);
  const xLevel = scaleLinear(yDom, [x0, x1]);
  const yTop = scaleLinear(isDigital ? [0, 1.08] : yDom, [LT.height - LT.bottom, LT.top]);

  /* ---------- geometry: bottom chart ---------- */
  const bx0 = LB.left;
  const bx1 = LB.width - LB.right - handleSpace;
  const xB = scaleLinear(curves.x === 'vol' ? C.volDomain : C.levelDomain, [bx0, bx1]);
  const yB = scaleLinear([0, 1.04], [LB.height - LB.bottom, LB.top]);

  const clampTo = (v: number, r: { min: number; max: number; step: number }) =>
    Math.min(r.max, Math.max(r.min, onGrid(v, r.step)));
  const moveLevel = (key: Handle, v: number) => {
    if (key === 'strike') set({ strike: clampTo(v, R.strike) });
    else if (key === 'barrier') set({ barrier: clampBarrier(clampTo(v, R.barrier)) });
    else if (key === 'lower') {
      const [l] = clampCorridor(clampTo(v, R.lower), s.upper);
      set({ lower: l });
    } else {
      const [, u] = clampCorridor(s.lower, clampTo(v, R.upper));
      set({ upper: u });
    }
  };

  const topTargets: DragTarget<Handle>[] = isDigital
    ? [
        {
          key: 'strike',
          distance: (vx, vy) =>
            inRange(vy, LT.top - 14, LT.height - LT.bottom)
              ? Math.abs(vx - xLevel(s.strike))
              : Infinity,
          move: (vx) => moveLevel('strike', xLevel.invert(vx)),
        },
      ]
    : s.mode === 'dnt'
      ? (['lower', 'upper'] as const).map((key) => ({
          key,
          distance: (vx: number, vy: number) =>
            vx >= x0 - 8 ? Math.abs(vy - yTop(s[key])) : Infinity,
          move: (_vx: number, vy: number) => moveLevel(key, yTop.invert(vy)),
        }))
      : [
          {
            key: 'barrier',
            distance: (vx, vy) => (vx >= x0 - 8 ? Math.abs(vy - yTop(s.barrier)) : Infinity),
            move: (_vx, vy) => moveLevel('barrier', yTop.invert(vy)),
          },
        ];
  const dragTop = useSvgDrag(svgTop, LT.width, topTargets);
  const dragBot = useSvgDrag<'at'>(svgBot, LB.width, [
    {
      key: 'at',
      distance: (vx, vy) => Math.hypot(vx - xB(curves.at[0]), vy - yB(curves.at[1])),
      move: (vx) => {
        const v = xB.invert(vx);
        if (s.mode === 'dnt') set({ volPct: clampTo(v, R.volPct) });
        else if (isDigital) moveLevel('strike', v);
        else moveLevel('barrier', v);
      },
    },
  ]);
  const instant = rm || sliding || dragTop.active !== null || dragBot.active !== null;
  const tw = useTween([n.price, n.prob, n.df, n.compare], 300, instant);
  const [price, prob, df, compare] = tw as [number, number, number, number];

  /* ---------- texts ---------- */
  const rate = (v: number) => fmtRate(v, PAIR);
  const chf = (frac: number, digits = 0, sign = false) =>
    fmtMoney(frac * C.payout, 'CHF', lang, digits, sign);
  const pct = (v: number, d = 1) => fmtPct(v, lang, d);
  const volText = (v: number) => fmtPctValue(v, lang, Number.isInteger(v) ? 0 : 1);
  const rdText = (v: number) => fmtPctValue(v, lang, Number.isInteger(v) ? 0 : 2);
  const modeLabel = t(`tl.mode.${s.mode}`);
  const levelText =
    s.mode === 'digital'
      ? t('tl.level.digital', { k: rate(s.strike) })
      : s.mode === 'dnt'
        ? t('tl.level.dnt', { l: rate(s.lower), u: rate(s.upper) })
        : t('tl.level.touch', { h: rate(s.barrier) });
  const months = t('tl.months');
  const summary = t('tl.summary', {
    mode: modeLabel,
    rule: t(`tl.rule.${s.mode}`),
    level: levelText,
    price: chf(n.price),
    pct: pct(n.price),
    prob: pct(n.prob),
    df: fmtNumber(n.df, lang, { digits: 4 }),
  });
  const pays = paths.filter((p) => pathPays(p, s)).length;

  /* ---------- top chart ---------- */
  const cone = useMemo(() => {
    const ts = Array.from({ length: C.days + 1 }, (_, d) => d);
    const q = (z: number) => ts.map((d): Point => [d, quantileAt(m, d / 365, z)]);
    return {
      o2: q(2),
      u2: q(-2),
      o1: q(1),
      u1: q(-1),
      fwd: ts.map((d): Point => [d, forwardAt(m, d / 365)]),
    };
  }, [m.rd, m.vol]);
  const PT = (pts: Point[]) => pts.map(([a, b]): Point => [xDays(a), yTop(b)]);

  const pathsView = (
    <g clip-path="url(#tl-clip-top)">
      <path d={areaPath(PT(cone.o2), PT(cone.u2))} class="tl-cone2" />
      <path d={areaPath(PT(cone.o1), PT(cone.u1))} class="tl-cone1" />
      {paths.map((p, i) => {
        const ok = pathPays(p, s);
        const exit = pathExitDay(p, s);
        const pts = p.map((v, d): Point => [xDays(d), yTop(v)]);
        return (
          <g key={`tp${i}`} data-pays={ok ? 'true' : 'false'}>
            <path d={linePath(pts)} class={ok ? 'm7-path-pay' : 'm7-path-faint'} />
            {exit !== null && <circle cx={pts[exit]![0]} cy={pts[exit]![1]} r={4} class="m7-hit" />}
          </g>
        );
      })}
      <path d={linePath(PT(cone.fwd))} class="tl-forward" />
    </g>
  );

  const levelLine = (key: 'barrier' | 'lower' | 'upper') => {
    const v = s[key];
    const yy = yTop(v);
    const above = v > S;
    return (
      <g key={key}>
        <rect
          x={x0}
          width={x1 - x0}
          y={above ? LT.top : yy}
          height={above ? Math.max(0, yy - LT.top) : Math.max(0, LT.height - LT.bottom - yy)}
          class="m7-zone"
        />
        <rect x={x0} y={yy - 12} width={x1 - x0} height={24} class="m7-hitband" />
        <path d={`M${x0},${yy.toFixed(1)}H${x1}`} class="m7-barrier" />
        <text x={x0 + 8} y={above ? yy - 7 : yy + 16} class="m7-barrier-label">
          {t('tl.ref.barrier', { v: rate(v) })}
        </text>
        <g class="m7-handle" transform={`translate(${x1 + 10},${yy.toFixed(1)})`}>
          <circle r={22} class="m7-handle-hit" />
          <circle r={dragTop.active === key ? 11 : 9} class="m7-handle-dot" />
          <path d="M-3.5,-2.5H3.5M-3.5,0.5H3.5M-3.5,3.5H3.5" class="m7-handle-grip" />
        </g>
      </g>
    );
  };

  const digitalView = (() => {
    const xs = Array.from({ length: 161 }, (_, i) => yDom[0] + ((yDom[1] - yDom[0]) * i) / 160);
    const dens = xs.map((v) => terminalDensity(m, v));
    const dmax = Math.max(...dens);
    const dpts = xs.map((v, i): Point => [xLevel(v), yTop((0.85 * dens[i]!) / dmax)]);
    const base = xs.map((v): Point => [xLevel(v), yTop(0)]);
    const right = xs.map((v, i) => [v, i] as const).filter(([v]) => v >= s.strike);
    const rTop = right.map(([, i]) => dpts[i]!);
    const rBase = right.map(([, i]) => base[i]!);
    const eps = s.spreadPips * PIP;
    const kx = xLevel(s.strike);
    const step: Point[] = [
      [xLevel(yDom[0]), yTop(0)],
      [kx, yTop(0)],
      [kx, yTop(1)],
      [xLevel(yDom[1]), yTop(1)],
    ];
    const ramp = xs
      .concat([s.strike - eps / 2, s.strike + eps / 2])
      .sort((a, b) => a - b)
      .map((v): Point => [xLevel(v), yTop(callSpreadPayoff(v, s.strike, eps))]);
    return (
      <g>
        <path d={areaPath(dpts, base)} class="m7-area" />
        {rTop.length > 1 && <path d={areaPath(rTop, rBase)} class="m7-area-strong" />}
        <path d={linePath(step)} class="m7-curve" />
        <path d={linePath(ramp)} class="m7-compare" />
        <text x={kx + 8} y={yTop(0.45)} class="m7-label">
          {t('tl.area', { p: pct(n.prob) })}
        </text>
        <path
          d={`M${kx.toFixed(1)},${LT.top}V${LT.height - LT.bottom}`}
          class="m7-barrier is-dashed"
        />
        <text x={kx - 8} y={LT.top + 14} class="m7-barrier-label" text-anchor="end">
          {t('tl.ref.strike', { v: rate(s.strike) })}
        </text>
        <g class="m7-handle" transform={`translate(${kx.toFixed(1)},${LT.top - 2})`}>
          <circle r={22} class="m7-handle-hit" />
          <circle r={dragTop.active === 'strike' ? 11 : 9} class="m7-handle-dot" />
          <path d="M-2.5,-3.5V3.5M0.5,-3.5V3.5M3.5,-3.5V3.5" class="m7-handle-grip" />
        </g>
      </g>
    );
  })();

  const topTicksY = isDigital
    ? [0, 0.25, 0.5, 0.75, 1]
    : compact
      ? [0.76, 0.8, 0.84]
      : [0.74, 0.76, 0.78, 0.8, 0.82, 0.84, 0.86];
  const topTicksX = isDigital
    ? compact
      ? [0.76, 0.8, 0.84]
      : [0.74, 0.76, 0.78, 0.8, 0.82, 0.84, 0.86]
    : [0, 1, 2, 3];

  // annotation (top chart, upper left corner of the plot)
  let ahaEl: JSX.Element | null = null;
  if (aha) {
    const l1 = t(`tl.aha.${aha}.t`);
    const l2 = t(`tl.aha.${aha}.d`);
    const b = annotationBox(l1, l2, Math.min(320, x1 - x0 - 16));
    const ax = isDigital ? x0 + 8 : x1 - b.w - 8;
    const ay = isDigital ? LT.top + 24 : LT.height - LT.bottom - b.h - 8;
    ahaEl = (
      <g class="m7-aha" key={aha} data-aha={aha}>
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

  /* ---------- bottom chart ---------- */
  const PB = (pts: Point[]) => linePath(pts.map(([a, b]): Point => [xB(a), yB(b)]));
  const bTicksX =
    curves.x === 'vol'
      ? [2, 4, 6, 8, 10, 12, 14, 16]
      : compact
        ? [0.76, 0.8, 0.84]
        : [0.75, 0.77, 0.79, 0.81, 0.83, 0.85];
  const atX = xB(curves.at[0]);
  const atY = yB(curves.at[1]);
  const secondLabel =
    s.mode === 'digital'
      ? t('tl.legend.secondDigital')
      : s.mode === 'oneTouch'
        ? t('tl.legend.secondOT')
        : t('tl.legend.secondNT');
  const bottomHead =
    s.mode === 'dnt'
      ? t('tl.head.vol')
      : s.mode === 'digital'
        ? t('tl.head.strike')
        : t('tl.head.level');

  /* ---------- side ---------- */
  const atDefaults = JSON.stringify({ ...s, mode: start.mode }) === JSON.stringify(start);
  const atMcDefaults =
    Math.abs(s.lower - mc.lower) < 1e-9 &&
    Math.abs(s.upper - mc.upper) < 1e-9 &&
    Math.abs(s.volPct / 100 - mc.vol) < 1e-9 &&
    s.rdPct === C.defaults.rdPct;
  const compareRow = (() => {
    switch (s.mode) {
      case 'digital':
        return (
          <StatRow
            label={t('tl.row.spread', { w: t('tl.pips', { v: fmtNumber(s.spreadPips, lang) }) })}
            sub={t('tl.row.spreadSub')}
            value={chf(compare)}
          />
        );
      case 'oneTouch':
        return (
          <StatRow
            label={t(s.payAt === 'hit' ? 'tl.row.otOther.expiry' : 'tl.row.otOther.hit')}
            sub={t('tl.row.otOtherSub')}
            value={chf(compare)}
          />
        );
      case 'noTouch':
        return (
          <>
            <StatRow label={t('tl.row.ot')} sub={t('tl.row.otSub')} value={chf(compare)} />
            <StatRow
              label={t('tl.row.sum')}
              sub={t('tl.row.sumSub')}
              value={chf(price + compare)}
            />
          </>
        );
      case 'dnt':
        return (
          <StatRow
            label={t('tl.row.volUp', { v: volText(s.volPct + C.volBumpPct) })}
            sub={t('tl.row.volUpSub')}
            value={chf(compare)}
          />
        );
    }
  })();
  const checkText = (() => {
    switch (s.mode) {
      case 'digital':
        return t('tl.check.digital', { d: chf(n.compare - n.price, 2, true) });
      case 'dnt':
        return atMcDefaults
          ? t('tl.check.dnt', {
              l: rate(mc.lower),
              u: rate(mc.upper),
              mc: fmtMoney(mc.pv, 'CHF', lang),
              se: fmtMoney(mc.stdErr, 'CHF', lang),
              bgk: fmtMoney(mc.bgk, 'CHF', lang),
            })
          : t('tl.check.dntOff', {
              l: rate(mc.lower),
              u: rate(mc.upper),
              v: fmtPct(mc.vol, lang, 0),
              mc: fmtMoney(mc.pv, 'CHF', lang),
              se: fmtMoney(mc.stdErr, 'CHF', lang),
            });
      default:
        if (s.mode === 'oneTouch' && s.payAt === 'hit') {
          const key =
            s.rdPct > 0 ? 'tl.check.hit' : s.rdPct < 0 ? 'tl.check.hitNeg' : 'tl.check.hitZero';
          return t(key, { v: chf(n.df * n.prob) });
        }
        return t('tl.check.expiry', { v: chf(n.df * n.prob) });
    }
  })();

  const slider = (
    id: string,
    label: string,
    key: keyof TouchState,
    r: { min: number; max: number; step: number },
    text: string,
    accent?: string,
  ) => (
    <Slider
      id={`tl-${id}`}
      label={label}
      value={s[key] as number}
      {...r}
      valueText={text}
      accent={accent}
      onInput={(v) =>
        key === 'barrier' || key === 'lower' || key === 'upper'
          ? moveLevel(key, v)
          : set({ [key]: v })
      }
    />
  );

  return (
    <div class="m7 tl" data-touchlab data-mode={s.mode}>
      <div class="ff-lab-head">
        <div class="m7-titles">
          <div class="ff-lab-title">{t('tl.title')}</div>
          <div class="ff-lab-sub">
            {t('tl.sub', {
              payout: fmtMoney(C.payout, 'CHF', lang),
              spot: rate(S),
              months,
              rd: fmtPct(m.rd, lang, Number.isInteger(s.rdPct) ? 0 : 2),
              rf: fmtPct(m.rf, lang, 1),
            })}
          </div>
        </div>
      </div>
      <div class="bl-toolbar">
        <Segmented
          label={t('tl.mode')}
          options={MODES.map((v) => ({ value: v, label: t(`tl.mode.${v}`) }))}
          value={s.mode}
          onChange={(mode) => set({ mode })}
        />
      </div>
      <p class="tl-rule">{t(`tl.rule.${s.mode}`)}</p>

      <div class="ff-lab">
        <div class="ff-lab-main" ref={box}>
          <div class="m7-chart-head">
            <ul class="m7-legend" aria-hidden="true">
              {isDigital ? (
                <>
                  <li>
                    <span class="m7-sw" />
                    {t('tl.legend.digital')}
                  </li>
                  <li>
                    <span class="m7-sw m7-sw-vanilla" />
                    {t('tl.legend.spread')}
                  </li>
                  <li>
                    <span class="m7-sw-area" />
                    {t('tl.legend.density')}
                  </li>
                </>
              ) : (
                <>
                  <li>
                    <span class="m7-sw-area" />
                    {t('tl.legend.cone')}
                  </li>
                  <li>
                    <span class="m7-sw tl-sw-fwd" />
                    {t('tl.legend.forward')}
                  </li>
                  <li>
                    <span class="m7-sw tl-sw-pay" />
                    {t('tl.legend.pays')}
                  </li>
                  <li>
                    <span class="m7-sw m7-sw-dead" />
                    {t('tl.legend.nopay')}
                  </li>
                </>
              )}
            </ul>
            {!isDigital && (
              <span class="m7-pill" data-pays={pays}>
                {t('tl.pays.count', { k: pays, n: C.samplePaths })}
              </span>
            )}
          </div>
          <svg
            ref={svgTop}
            viewBox={`0 0 ${LT.width} ${LT.height}`}
            role="img"
            aria-label={t('tl.aria.top', { months, summary })}
            class={`m7-svg${dragTop.active ? ' is-dragging' : ''}`}
            data-chart="top"
            {...dragTop.handlers}
          >
            <defs>
              <clipPath id="tl-clip-top">
                <rect x={x0} y={LT.top} width={x1 - x0} height={LT.height - LT.bottom - LT.top} />
              </clipPath>
            </defs>
            {topTicksY.map((v) => (
              <g key={`ty${v}`}>
                <path
                  d={`M${x0},${yTop(v).toFixed(1)}H${x1}`}
                  class={isDigital && v === 0 ? 'm7-axis' : 'm7-grid'}
                />
                <text x={x0 - 8} y={yTop(v) + 4} class="m7-tick" text-anchor="end">
                  {isDigital ? fmtPct(v, lang, 0) : fmtRate(v, PAIR, 2)}
                </text>
              </g>
            ))}
            {topTicksX.map((v, i) => (
              <text
                key={`tx${v}`}
                x={isDigital ? xLevel(v) : xDays(Math.min(C.days, v * MONTH_DAYS))}
                y={LT.height - 10}
                class="m7-tick"
                text-anchor={isDigital ? 'middle' : i === 0 ? 'start' : i === 3 ? 'end' : 'middle'}
              >
                {isDigital
                  ? fmtRate(v, PAIR, 2)
                  : v === 0
                    ? t('tl.axis.today')
                    : t('tl.axis.month', { n: v })}
              </text>
            ))}
            {isDigital ? (
              digitalView
            ) : (
              <>
                {pathsView}
                {s.mode === 'dnt' ? (
                  <>
                    {levelLine('upper')}
                    {levelLine('lower')}
                  </>
                ) : (
                  levelLine('barrier')
                )}
                <circle cx={xDays(0)} cy={yTop(S)} r={4.5} class="m7-spot" />
                <text
                  x={x1 - 8}
                  y={s.mode === 'dnt' || s.barrier > S ? LT.top + 15 : LT.height - LT.bottom - 10}
                  class="m7-zone-label"
                  text-anchor="end"
                >
                  {t(`tl.zone.${s.mode}` as 'tl.zone.dnt')}
                </text>
              </>
            )}
            {ahaEl}
          </svg>

          <div class="m7-chart-head">
            <span class="tl-subhead">{bottomHead}</span>
          </div>
          <div class="m7-chart-head">
            <ul class="m7-legend" aria-hidden="true">
              <li>
                <span class="m7-sw" />
                {t('tl.legend.price')}
              </li>
              <li>
                <span class="m7-sw m7-sw-dash" />
                {t('tl.legend.prob')}
              </li>
              {curves.second && (
                <li>
                  <span class="m7-sw m7-sw-vanilla" />
                  {secondLabel}
                </li>
              )}
            </ul>
          </div>
          <svg
            ref={svgBot}
            viewBox={`0 0 ${LB.width} ${LB.height}`}
            role="img"
            aria-label={t('tl.aria.bottom', {
              x: curves.x === 'vol' ? t('tl.axis.vol') : t('tl.axis.level'),
              price: pct(n.price),
              at: curves.x === 'vol' ? volText(s.volPct) : rate(curves.at[0]),
            })}
            class={`m7-svg${dragBot.active ? ' is-dragging' : ''}`}
            data-chart="bottom"
            {...dragBot.handlers}
          >
            {[0, 0.25, 0.5, 0.75, 1].map((v) => (
              <g key={`by${v}`}>
                <path
                  d={`M${bx0},${yB(v).toFixed(1)}H${bx1}`}
                  class={v === 0 ? 'm7-axis' : 'm7-grid'}
                />
                <text x={bx0 - 8} y={yB(v) + 4} class="m7-tick" text-anchor="end">
                  {fmtPct(v, lang, 0)}
                </text>
              </g>
            ))}
            {bTicksX.map((v) => (
              <text
                key={`bx${v}`}
                x={xB(v)}
                y={LB.height - 10}
                class="m7-tick"
                text-anchor="middle"
              >
                {curves.x === 'vol' ? fmtPctValue(v, lang, 0) : fmtRate(v, PAIR, 2)}
              </text>
            ))}
            {curves.x === 'level' && s.mode !== 'digital' && (
              <g>
                <path
                  d={`M${xB(S).toFixed(1)},${LB.top}V${LB.height - LB.bottom}`}
                  class="m7-ref"
                />
                <text x={xB(S) + 6} y={yB(0.5) + 4} class="m7-ref-label">
                  {t('tl.ref.spot')}
                </text>
              </g>
            )}
            {curves.second && <path d={PB(curves.second)} class="m7-compare" />}
            <path d={PB(curves.price)} class="m7-curve" />
            <path d={PB(curves.prob)} class="m7-prob" />
            <path d={`M${atX.toFixed(1)},${LB.top}V${LB.height - LB.bottom}`} class="bl-guide" />
            {dragBot.active && <circle cx={atX} cy={atY} r={16} class="m7-halo" />}
            <circle cx={atX} cy={atY} r={dragBot.active ? 8 : 6} class="m7-dot" />
          </svg>
          <p class="m7-hint">{t('tl.hint')}</p>
          <p class="sr-only">{summary}</p>
        </div>

        <div class="ff-lab-side">
          <div class="panel" onPointerDown={onSlide}>
            {s.mode === 'digital' && (
              <>
                {slider(
                  'strike',
                  t('tl.slider.strike'),
                  'strike',
                  R.strike,
                  rate(s.strike),
                  'var(--ff-exotics)',
                )}
                {slider(
                  'spread',
                  t('tl.slider.spread'),
                  'spreadPips',
                  R.spreadPips,
                  t('tl.pips', { v: fmtNumber(s.spreadPips, lang) }),
                )}
              </>
            )}
            {(s.mode === 'oneTouch' || s.mode === 'noTouch') &&
              slider(
                'barrier',
                t('tl.slider.barrier'),
                'barrier',
                R.barrier,
                rate(s.barrier),
                'var(--ff-exotics)',
              )}
            {s.mode === 'dnt' && (
              <>
                {slider(
                  'upper',
                  t('tl.slider.upper'),
                  'upper',
                  R.upper,
                  rate(s.upper),
                  'var(--ff-exotics)',
                )}
                {slider(
                  'lower',
                  t('tl.slider.lower'),
                  'lower',
                  R.lower,
                  rate(s.lower),
                  'var(--ff-exotics)',
                )}
              </>
            )}
            {s.mode === 'oneTouch' && (
              <div class="m7-seg-field">
                <span class="m7-seg-label" aria-hidden="true">
                  {t('tl.payAt')}
                </span>
                <Segmented
                  label={t('tl.payAt')}
                  options={[
                    { value: 'expiry', label: t('tl.payAt.expiry') },
                    { value: 'hit', label: t('tl.payAt.hit') },
                  ]}
                  value={s.payAt}
                  onChange={(payAt) => set({ payAt })}
                />
              </div>
            )}
            {(s.mode === 'oneTouch' || s.mode === 'noTouch') &&
              slider('rd', t('tl.slider.rd'), 'rdPct', R.rdPct, rdText(s.rdPct))}
            {slider('vol', t('tl.slider.vol'), 'volPct', R.volPct, volText(s.volPct))}
            <button
              type="button"
              class="m7-btn"
              data-reset
              disabled={atDefaults}
              onClick={() => setS({ ...start, mode: s.mode })}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                <path d="M3 5.5A4.5 4.5 0 1 1 2.6 8.6M3 2.5V5.5H6" class="m7-icon-stroke" />
              </svg>
              {t('tl.reset')}
            </button>
          </div>

          <StatTable>
            <StatHero
              label={t('tl.hero', { mode: modeLabel })}
              value={chf(price)}
              sub={t('tl.heroSub', { pct: pct(price) })}
            />
            <StatRow
              label={t('tl.row.prob')}
              sub={t('tl.row.probSub')}
              value={pct(prob)}
              highlight
            />
            <StatRow
              label={t('tl.row.df')}
              sub={t('tl.row.dfSub')}
              value={fmtNumber(df, lang, { digits: 4 })}
            />
            {compareRow}
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
              <span class="m7-check-title">{t('tl.check.title')}</span>
              <span>{checkText}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
