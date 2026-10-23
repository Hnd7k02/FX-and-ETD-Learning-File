/**
 * Product matrix (module 09, sections 1 and 3): Dario's product concept as an interactive
 * matrix. Choose a need (hedge, alpha, yield) and a market view; the chart overlays the result
 * at expiry of every matching product on one axis (same view, very different risk), the side
 * panel ranks them at a rate at expiry you drag or play, and the cards show building blocks,
 * a live key number, four labelled risk chips and a link into the module that explains them.
 * The whole matrix is also available as a table.
 *
 * Props: lang, need? ('hedge' | 'alpha' | 'yield'), view? (a view of that need), st? (initial
 * USD/CHF at expiry). Mapping and risk data in src/lib/matrix.ts (MATRIX, PRODUCTS), strings in
 * src/i18n/dict/productmatrix.ts.
 */
import type { JSX } from 'preact';
import { useEffect, useId, useMemo, useRef, useState } from 'preact/hooks';
import { tweenProgress } from '@/lib/anim';
import { AxisX, GridY } from '@/components/ui/Chart';
import { Legend } from '@/components/ui/Legend';
import { Slider } from '@/components/ui/Slider';
import {
  useElementWidth,
  useInView,
  usePrefersReducedMotion,
  useTween,
} from '@/components/ui/hooks';
import { productmatrix as dict } from '@/i18n/dict/productmatrix';
import { modulePath } from '@/i18n/routes';
import { translator, type Lang } from '@/i18n/types';
import { clamp, linePath, niceTicks, scaleLinear, type Point } from '@/lib/chart';
import { EXAMPLE, EXAMPLE_LABEL } from '@/lib/fx/example';
import { fmtNumber, fmtPct, fmtPips, fmtRate } from '@/lib/format';
import { M09_CONFIG, PIP } from '@/lib/m09/config';
import { tourPosition } from '@/lib/m09/hedge';
import {
  ALPHA_PAYS,
  ALPHA_SHAPES,
  ALPHA_VIEW_IDS,
  DIR_VIEW_IDS,
  NEED_IDS,
  PRODUCTS,
  alphaView,
  cellProducts,
  cellRiskSpread,
  cellSpreadAt,
  keyFact,
  makeCell,
  matrixGrid,
  matrixParams,
  matrixRange,
  productResult,
  profileGroups,
  riskChips,
  snapMatrixFixing,
  type Cell,
  type DirViewId,
  type Family,
  type NeedId,
  type ProductId,
  type ViewId,
} from '@/lib/matrix';
import { getModule } from '@/data/modules';

export interface ProductMatrixProps {
  lang: Lang;
  need?: string;
  view?: string;
  st?: number;
}

const PAIR = EXAMPLE.pair;
const CLIP = M09_CONFIG.matrix.clipPips;
const Y_RANGE: [number, number] = [-CLIP, CLIP];
/** Upper estimate of the average glyph width of the bold clip label, in em (for its anchor). */
const CLIP_LABEL_EM = 0.62;
/** Playback tour relative to spot and timing (normal motion / reduced motion stops). */
const TOUR = { waypoints: [0, 0.1, -0.1, 0] as const, ms: 9000, stepMs: 1100 };

const FAMILY_CLASS: Record<Family, string> = {
  linear: 'is-linear',
  order: 'is-neutral',
  option: 'is-option',
  structured: 'is-structured',
  yield: 'is-yield',
  deposit: 'is-neutral',
};

function layoutFor(w: number) {
  const width = Math.max(280, Math.round(w));
  const compact = width < 560;
  const font = compact ? 11 : 12;
  const titleRow = font + 8;
  const plot = compact ? 250 : Math.round(clamp(width * 0.46, 280, 340));
  const top = 30;
  const plotBottom = top + plot;
  const rail = plotBottom + 22;
  const ticksY = rail + 36;
  const height = ticksY + titleRow;
  return {
    width,
    height,
    compact,
    font,
    left: compact ? 50 : 56,
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

function ArrowGlyph({ view }: { view: DirViewId }): JSX.Element {
  const d =
    view === 'up'
      ? 'M3 12L8 7L11 10L15 5M11 5H15V9'
      : view === 'down'
        ? 'M3 5L8 10L11 7L15 12M11 12H15V8'
        : view === 'sideways'
          ? 'M3 9C5 7 7 11 9 9S13 7 15 9'
          : 'M6.5 6.5A2.5 2.5 0 1 1 9 9V10.5M9 13.2V13.3';
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" class="pm-glyph">
      <path d={d} />
    </svg>
  );
}

export default function ProductMatrix(props: ProductMatrixProps): JSX.Element {
  const { lang } = props;
  const t = translator(dict, lang);
  const uid = useId().replace(/[^A-Za-z0-9_-]/g, '');
  const rm = usePrefersReducedMotion();
  const params = useMemo(matrixParams, []);
  const xs = useMemo(() => matrixGrid(params), [params]);
  const range = matrixRange();

  const [cell, setCell] = useState<Cell>(() => makeCell(props.need, props.view));
  const [hl, setHl] = useState<ProductId | null>(null);
  const [st, setSt] = useState(() =>
    snapMatrixFixing(
      typeof props.st === 'number' ? props.st : EXAMPLE.spot * (1 + M09_CONFIG.matrix.initialMove),
    ),
  );
  const [dragging, setDragging] = useState(false);
  const [playing, setPlaying] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const pointer = useRef<number | null>(null);
  const inView = useInView(root);
  const L = layoutFor(useElementWidth(box, 640));

  const products = cellProducts(cell);
  const groups = useMemo(() => profileGroups(cell, xs, params), [cell, xs, params]);
  const hlGroup = Math.max(
    0,
    groups.findIndex((g) => (hl ? g.includes(hl) : false)),
  );
  const cellKey = `${cell.need}.${cell.view}`;

  /* ---------- playback ---------- */
  const tour = useMemo(() => TOUR.waypoints.map((w) => EXAMPLE.spot * (1 + w)), []);
  useEffect(() => {
    if (!playing || !inView) return;
    if (rm) {
      const stops = tour.slice(1);
      let i = 0;
      const id = setInterval(() => {
        setSt(snapMatrixFixing(stops[i]!));
        i += 1;
        if (i >= stops.length) {
          clearInterval(id);
          setPlaying(false);
        }
      }, TOUR.stepMs);
      return () => clearInterval(id);
    }
    let raf = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const k = tweenProgress(now, t0, TOUR.ms);
      setSt(snapMatrixFixing(tourPosition(k, tour)));
      if (k < 1) raf = requestAnimationFrame(step);
      else setPlaying(false);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, inView, rm, tour]);

  /* ---------- values at S_T ---------- */
  const results = products.map((id) => productResult(id, st, params));
  const pipsAt = results.map((r) => (r === null ? 0 : r / PIP));
  const tweenPips = useTween(pipsAt, 300, rm || dragging || playing);
  const spread = cellSpreadAt(cell, st, params);

  /* ---------- scales and curves ---------- */
  const sx = scaleLinear(range, [L.left, L.width - L.right]);
  const sy = scaleLinear(Y_RANGE, [L.plotBottom, L.top]);
  const ticksX = niceTicks(range[0], range[1], L.compact ? 4 : 8);
  const ticksY = niceTicks(Y_RANGE[0], Y_RANGE[1], L.compact ? 4 : 8);

  const curves = useMemo(
    () =>
      groups.map((g) =>
        xs.map((x) => clamp((productResult(g[0]!, x, params) ?? 0) / PIP, -CLIP, CLIP)),
      ),
    [groups, xs, params],
  );
  const curvePts = curves.map((ys) => xs.map((x, i): Point => [sx(x), sy(ys[i]!)]));
  const hlPts = curvePts[hlGroup];
  const areas = useMemo(() => {
    const ys = curves[hlGroup];
    if (!ys) return null;
    const y0 = sy(0);
    const pos = xs.map((x, i): Point => [sx(x), sy(Math.max(ys[i]!, 0))]);
    const neg = xs.map((x, i): Point => [sx(x), sy(Math.min(ys[i]!, 0))]);
    const close = (pts: Point[]) =>
      `${linePath(pts)}L${sx(xs[xs.length - 1]!).toFixed(1)},${y0.toFixed(1)}L${sx(xs[0]!).toFixed(1)},${y0.toFixed(1)}Z`;
    return { pos: close(pos), neg: close(neg) };
  }, [curves, hlGroup, L.width, L.height]);

  /* clip markers of the highlighted curve: where it leaves the chart at the bottom */
  const clipMarks = useMemo(() => {
    const g = groups[hlGroup];
    if (!g) return [];
    const raw = xs.map((x) => (productResult(g[0]!, x, params) ?? 0) / PIP);
    const marks: number[] = [];
    for (let i = 1; i < raw.length; i++) {
      const a = raw[i - 1]! < -CLIP;
      const b = raw[i]! < -CLIP;
      if (a !== b) marks.push(a ? xs[i - 1]! : xs[i]!);
    }
    if (raw[0]! < -CLIP && !marks.length) marks.push(xs[0]!);
    return marks;
  }, [groups, hlGroup, xs, params]);

  /**
   * Grey comparison curves must stay tellable apart without colour: the first one is solid,
   * every further one dashed (legend and chart match).
   */
  const otherDash = (gi: number): string | undefined => {
    if (gi === hlGroup) return undefined;
    const rank = groups.slice(0, gi).filter((_, i) => i !== hlGroup).length;
    return rank === 0 ? undefined : '6 5';
  };

  const groupName = (g: ProductId[]) =>
    g.length > 1
      ? t('pm.same', { a: t(`pm.p.${g[0]!}.name`), b: t(`pm.p.${g[1]!}.name`) })
      : t(`pm.p.${g[0]!}.name`);

  /* label of the highlighted curve: right end, above the line, inside the plot */
  const labelX = sx(range[1]) - 6;
  const hlYs = curves[hlGroup];
  /* falling to the right: below the line, otherwise above it (the line never crosses the text) */
  const endY = sy(hlYs ? hlYs[hlYs.length - 1]! : 0);
  const prevY = sy(hlYs ? hlYs[Math.max(0, hlYs.length - 8)]! : 0);
  const labelY = clamp(
    endY > prevY + 0.5 ? endY + L.font + 8 : endY - 9,
    L.top + L.font,
    L.plotBottom - 6,
  );

  /* dots at S_T: tweened y per group */
  const dotYs = groups.map((g) => {
    const i = products.indexOf(g[0]!);
    return clamp(tweenPips[i] ?? 0, -CLIP, CLIP);
  });

  /* ---------- interaction ---------- */
  const setFix = (v: number) => setSt(snapMatrixFixing(v));
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
    setPlaying(false);
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
  const choose = (c: Cell) => {
    setCell(c);
    setHl(null);
  };
  const chooseNeed = (n: NeedId) => {
    if (n === cell.need) return;
    choose(makeCell(n));
  };

  /* ---------- texts ---------- */
  const rate = (x: number) => fmtRate(x, PAIR);
  const pipsTxt = (v: number) => t('pm.pips', { v: fmtPips(v, lang, 0, true) });
  const needName = t(`pm.need.${cell.need}`);
  const viewName = t(`pm.view.${cell.view}`);
  const months = M09_CONFIG.yieldProducts.months;

  const keyText = (id: ProductId) => {
    const k = keyFact(id, params);
    let value: string;
    switch (k.kind) {
      case 'rate':
        value = rate(k.value);
        break;
      case 'range':
        value = t('pm.key.range', { a: rate(k.value), b: rate(k.value2 ?? k.value) });
        break;
      case 'pips':
        value = t('pm.key.pips', { v: fmtPips(k.value, lang, 0) });
        break;
      case 'pct':
        value = fmtPct(k.value, lang, 1);
        break;
    }
    return {
      label: t(`pm.key.${k.label}` as Parameters<typeof t>[0], { m: months }),
      value,
      sub: k.vsPips === undefined ? null : t('pm.key.vs', { v: fmtPips(k.vsPips, lang, 0, true) }),
    };
  };

  const spreadRisk = cellRiskSpread(cell);
  const twin = groups.find((g) => g.length > 1 && g.includes('dci'));
  let aha: string | null = null;
  if (twin) aha = t('pm.aha.twin', { a: t('pm.p.discount.name'), b: t('pm.p.dci.name') });
  else if (cell.need === 'alpha') aha = t('pm.aha.alpha');
  else if (products.length === 1 && products[0] === 'deposit') aha = t('pm.aha.deposit');
  else if (spreadRisk.max > spreadRisk.min)
    aha = t('pm.aha.spread', {
      min: t(`pm.chip.loss.${PRODUCTS[spreadRisk.minId].loss}` as Parameters<typeof t>[0]),
      max: t(`pm.chip.loss.${PRODUCTS[spreadRisk.maxId].loss}` as Parameters<typeof t>[0]),
    });

  const resultText = (i: number) => (results[i] === null ? t('pm.noProfile') : pipsTxt(pipsAt[i]!));
  const aria = t('pm.aria', {
    need: needName,
    view: viewName,
    curves: groups.map((g) => groupName(g)).join(', '),
    st: rate(st),
    results: products
      .map((id, i) => t('pm.ariaCurve', { name: t(`pm.p.${id}.name`), v: resultText(i) }))
      .join(', '),
  });
  const summary = t('pm.summary', {
    need: needName,
    view: viewName,
    products: products.map((id) => t(`pm.p.${id}.name`)).join(', '),
    note: t(`pm.cell.${cellKey}` as Parameters<typeof t>[0]),
  });

  /* ---------- geometry ---------- */
  const fs = `${L.font}px`;
  const clipId = `pm-clip-${uid}`;
  const x = sx(st);
  const spotX = sx(EXAMPLE.spot);
  const yLabel = cell.need === 'alpha' ? t('pm.yAlpha') : t('pm.y');

  return (
    <div
      class="pm"
      ref={root}
      data-pm
      data-need={cell.need}
      data-view={cell.view}
      data-st={st.toFixed(4)}
      data-hl={groups[hlGroup]?.[0] ?? ''}
    >
      <div class="ff-lab-head">
        <div class="pm-head-text">
          <div class="ff-lab-title">{t('pm.title')}</div>
          <div class="ff-lab-sub">
            {t('pm.sub', { pair: PAIR, spot: rate(EXAMPLE.spot), forward: rate(params.forward) })}
          </div>
        </div>
        <span class="ff-pill-note pm-example">{EXAMPLE_LABEL[lang]}</span>
      </div>

      {/* ---------- 1 need, 2 view ---------- */}
      <div class="pm-pick">
        <div class="pm-pick-col">
          <span class="pm-step" id={`pm-need-${uid}`}>
            {t('pm.step.need')}
          </span>
          <div class="pm-needs" role="group" aria-labelledby={`pm-need-${uid}`}>
            {NEED_IDS.map((n) => (
              <button
                key={n}
                type="button"
                class="pm-need"
                aria-pressed={cell.need === n}
                data-need-btn={n}
                onClick={() => chooseNeed(n)}
              >
                <span class="pm-need-name">{t(`pm.need.${n}`)}</span>
                <span class="pm-need-sub">{t(`pm.need.${n}.sub`)}</span>
              </button>
            ))}
          </div>
        </div>
        <div class="pm-pick-col is-view">
          <span class="pm-step" id={`pm-view-${uid}`}>
            {t('pm.step.view')}
          </span>
          {cell.need === 'alpha' ? (
            <div class="pm-alpha" role="group" aria-labelledby={`pm-view-${uid}`}>
              <span class="pm-alpha-corner" aria-hidden="true" />
              {ALPHA_SHAPES.map((sh) => (
                <span key={sh} class="pm-alpha-head" aria-hidden="true">
                  <b>{t(`pm.alpha.${sh}`)}</b>
                  <span>{t(`pm.alpha.${sh}.sub`)}</span>
                </span>
              ))}
              {ALPHA_PAYS.map((pay) => [
                <span key={`h-${pay}`} class="pm-alpha-row" aria-hidden="true">
                  <b>{t(`pm.alpha.${pay}`)}</b>
                  <span>{t(`pm.alpha.${pay}.sub`)}</span>
                </span>,
                ...ALPHA_SHAPES.map((sh) => {
                  const v = alphaView(pay, sh);
                  const names = cellProducts({ need: 'alpha', view: v })
                    .map((id) => t(`pm.p.${id}.name`))
                    .join(' · ');
                  return (
                    <button
                      key={v}
                      type="button"
                      class="pm-alpha-cell"
                      aria-pressed={cell.view === v}
                      aria-label={`${t(`pm.view.${v}`)}: ${names}`}
                      data-view-btn={v}
                      onClick={() => choose({ need: 'alpha', view: v })}
                    >
                      <span class="pm-alpha-names">{names}</span>
                    </button>
                  );
                }),
              ])}
            </div>
          ) : (
            <div class="pm-views" role="group" aria-labelledby={`pm-view-${uid}`}>
              {DIR_VIEW_IDS.map((v) => (
                <button
                  key={v}
                  type="button"
                  class="pm-view"
                  aria-pressed={cell.view === v}
                  data-view-btn={v}
                  onClick={() =>
                    choose(
                      cell.need === 'yield'
                        ? { need: 'yield', view: v }
                        : { need: 'hedge', view: v },
                    )
                  }
                >
                  <ArrowGlyph view={v} />
                  <span>{t(`pm.view.${v}`)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div class="pm-note-row" aria-live="polite">
        <p class="pm-note" data-note key={`note-${cellKey}`}>
          {t(`pm.cell.${cellKey}` as Parameters<typeof t>[0])}
        </p>
        {aha && (
          <p class="pm-aha" data-aha key={`aha-${cellKey}`}>
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <path
                d="M8 1.5L9.6 6.4L14.5 8L9.6 9.6L8 14.5L6.4 9.6L1.5 8L6.4 6.4Z"
                style={{ fill: 'currentColor' }}
              />
            </svg>
            <span>{aha}</span>
          </p>
        )}
      </div>

      {/* ---------- chart and ranking ---------- */}
      <div class="ff-lab pm-lab">
        <div class="ff-lab-main">
          <Legend
            items={groups.map((g, gi) => ({
              label: groupName(g),
              color: gi === hlGroup ? 'var(--ff-forward)' : 'var(--ff-ref)',
              width: gi === hlGroup ? 3 : 2,
              kind: otherDash(gi) ? ('dashed' as const) : ('line' as const),
            }))}
          />
          <div ref={box}>
            <svg
              ref={svgRef}
              viewBox={`0 0 ${L.width} ${L.height}`}
              role="img"
              aria-label={aria}
              class="pm-svg"
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
              <GridY
                y={sy}
                ticks={ticksY}
                x0={L.left}
                x1={L.width - L.right}
                format={(v) => fmtNumber(v, lang, { sign: v > 0 })}
                fontSize={L.font}
              />
              <text
                x={L.left}
                y={L.top - 14}
                style={{ fontSize: fs, fontWeight: 600, fill: 'var(--ff-muted)' }}
              >
                {yLabel}
              </text>
              <path
                d={`M${spotX.toFixed(1)},${L.top}V${L.plotBottom}`}
                style={lineStyle('var(--ff-ref)', 1, '4 5')}
              />
              <text
                x={spotX + 6}
                y={L.plotBottom - 6}
                style={{ fontSize: fs, fontWeight: 600, fill: 'var(--ff-ink-2)', ...halo }}
              >
                {t('pm.spot')} {rate(EXAMPLE.spot)}
              </text>

              <g clip-path={`url(#${clipId})`} key={`curves-${cellKey}`} class="pm-curves">
                {areas && (
                  <g class="pm-areas">
                    <path d={areas.pos} style={{ fill: 'var(--ff-timevalue)' }} />
                    <path d={areas.neg} style={{ fill: 'rgba(234, 88, 12, 0.1)' }} />
                  </g>
                )}
                {curvePts.map((pts, gi) => {
                  if (gi === hlGroup) return null;
                  const dash = otherDash(gi);
                  /* a dashed curve cannot use the pathLength draw-in, it fades in instead */
                  return dash ? (
                    <path
                      key={`c${gi}`}
                      d={linePath(pts)}
                      class="pm-curve-dash"
                      style={lineStyle('var(--ff-ref)', 1.75, dash)}
                    />
                  ) : (
                    <path
                      key={`c${gi}`}
                      d={linePath(pts)}
                      class="pm-curve"
                      pathLength={1}
                      style={lineStyle('var(--ff-ref)', 1.75)}
                    />
                  );
                })}
                {hlPts && (
                  <path
                    d={linePath(hlPts)}
                    class="pm-curve is-hl"
                    pathLength={1}
                    data-curve
                    style={lineStyle('var(--ff-forward)', 3)}
                  />
                )}
              </g>

              {/* marker at S_T */}
              <path
                d={`M${x.toFixed(1)},${L.top}V${L.rail}`}
                style={{ fill: 'none', stroke: 'var(--ff-ink)', strokeWidth: 1.25 }}
              />
              {/* direct label of the highlighted curve at the right end */}
              {groups[hlGroup] && (
                <text
                  key={`l-${cellKey}-${hlGroup}`}
                  x={labelX}
                  y={labelY}
                  class="pm-label"
                  data-label
                  style={{
                    fontSize: fs,
                    fontWeight: 800,
                    fill: 'var(--ff-ink)',
                    textAnchor: 'end',
                    ...halo,
                  }}
                >
                  {groupName(groups[hlGroup]!)}
                </text>
              )}

              {/* "loss continues" where the highlighted curve leaves the chart */}
              {clipMarks.map((cx, i) => {
                const px = clamp(sx(cx), L.left + 40, L.width - L.right - 40);
                /* centred label, unless it would run past the plot: then it ends (or starts) at the arrow */
                const half = (t('pm.clip').length * L.font * CLIP_LABEL_EM) / 2;
                const anchor =
                  px + half > L.width - L.right ? 'end' : px - half < L.left ? 'start' : 'middle';
                const tx = anchor === 'end' ? px + 4 : anchor === 'start' ? px - 4 : px;
                return (
                  <g key={`clip-${cellKey}-${i}`} class="pm-clipmark" data-clip>
                    <path
                      d={`M${px.toFixed(1)},${L.plotBottom - 22}V${L.plotBottom - 4}M${(px - 4).toFixed(1)},${L.plotBottom - 9}L${px.toFixed(1)},${L.plotBottom - 4}L${(px + 4).toFixed(1)},${L.plotBottom - 9}`}
                      style={lineStyle('var(--ff-bad-text)', 1.75)}
                    />
                    <text
                      x={tx}
                      y={L.plotBottom - 27}
                      style={{
                        fontSize: fs,
                        fontWeight: 800,
                        fill: 'var(--ff-bad-text)',
                        textAnchor: anchor,
                        ...halo,
                      }}
                    >
                      {t('pm.clip')}
                    </text>
                  </g>
                );
              })}

              {groups.map((_, gi) => (
                <circle
                  key={`d${gi}`}
                  cx={x}
                  cy={sy(dotYs[gi]!)}
                  r={gi === hlGroup ? 6.5 : 4.5}
                  style={{
                    fill: gi === hlGroup ? 'var(--ff-forward)' : 'var(--ff-ref)',
                    stroke: '#fff',
                    strokeWidth: 2.5,
                  }}
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
                class={`pm-handle${dragging ? ' is-active' : ''}`}
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
                {t('pm.x')}
              </text>
            </svg>
          </div>
          <p class="pm-hint">{t('pm.drag')}</p>
          <p class="sr-only" data-summary>
            {summary}
          </p>
        </div>

        <div class="ff-lab-side">
          <div class="pm-rows" role="group" aria-label={t('pm.rows')}>
            <div class="pm-rows-head">
              <span>{t('pm.at', { st: rate(st) })}</span>
            </div>
            {products.map((id, i) => {
              const has = results[i] !== null;
              const gi = groups.findIndex((g) => g.includes(id));
              const isBest = !!spread?.best.includes(id);
              const isWorst = !!spread?.worst.includes(id);
              return (
                <button
                  key={`${cellKey}-${id}`}
                  type="button"
                  class={`pm-row${gi === hlGroup && has ? ' is-hl' : ''}`}
                  aria-pressed={has ? gi === hlGroup : undefined}
                  disabled={!has}
                  data-row={id}
                  onClick={() => setHl(id)}
                >
                  <span class="pm-row-name">
                    {t(`pm.p.${id}.name`)}
                    {isBest && <span class="pm-tag is-best">{t('pm.best')}</span>}
                    {isWorst && <span class="pm-tag is-worst">{t('pm.worst')}</span>}
                  </span>
                  <span class="pm-row-value mono" data-value>
                    {has ? pipsTxt(tweenPips[i] ?? 0) : t('pm.noProfile')}
                  </span>
                </button>
              );
            })}
          </div>
          <div class="panel">
            <Slider
              id={`pm-st-${uid}`}
              label={t('pm.st')}
              value={st}
              min={range[0]}
              max={range[1]}
              step={M09_CONFIG.matrix.fixingStep}
              valueText={rate(st)}
              onInput={(v) => {
                setPlaying(false);
                setFix(v);
              }}
            />
            <button
              type="button"
              class="btn btn-light pm-play"
              aria-pressed={playing}
              data-play
              onClick={() => setPlaying((p) => !p)}
            >
              {playing ? (
                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M5 3.5V12.5M11 3.5V12.5" class="pm-icon-stroke" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M5 3.2L12.5 8L5 12.8Z" class="pm-icon-fill" />
                </svg>
              )}
              <span>{playing ? t('pm.pause') : t('pm.play')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ---------- product cards ---------- */}
      <ul class="pm-cards" key={`cards-${cellKey}`} data-cards>
        {products.map((id, i) => {
          const def = PRODUCTS[id];
          const k = keyText(id);
          const gi = groups.findIndex((g) => g.includes(id));
          const has = gi >= 0;
          const m = getModule(def.link.slug);
          return (
            <li
              key={id}
              class={`pm-card${has && gi === hlGroup ? ' is-hl' : ''}`}
              style={{ animationDelay: `${i * 70}ms` }}
              data-card={id}
            >
              <div class="pm-card-top">
                <span class={`pm-fam ${FAMILY_CLASS[def.family]}`}>
                  {t(`pm.fam.${def.family}`)}
                </span>
              </div>
              <p class="pm-card-name">{t(`pm.p.${id}.name`)}</p>
              <p class="pm-card-blocks">{t(`pm.p.${id}.blocks`)}</p>
              <div class="pm-key">
                <span class="pm-key-label">{k.label}</span>
                <span class="pm-key-value mono">{k.value}</span>
                {k.sub && <span class="pm-key-sub">{k.sub}</span>}
              </div>
              <p class="pm-card-use">{t(`pm.p.${id}.use`)}</p>
              <ul class="pm-chips" aria-label={t('pm.chips')}>
                {riskChips(id).map((c) => (
                  <li key={c.kind} class={`pm-chip sev-${c.severity}`} data-chip={c.kind}>
                    <span class="pm-chip-k">{t(`pm.chip.kind.${c.kind}`)}</span>
                    <span class="pm-chip-v">
                      {t(`pm.chip.${c.value}` as Parameters<typeof t>[0])}
                    </span>
                    <span class="pm-dots" aria-hidden="true">
                      {[1, 2, 3].map((d) => (
                        <span key={d} class={d <= c.severity ? 'on' : undefined} />
                      ))}
                    </span>
                    <span class="sr-only">
                      {' '}
                      ({t('pm.sev.sr', { s: t(`pm.sev.${c.severity}`) })})
                    </span>
                  </li>
                ))}
              </ul>
              <div class="pm-card-foot">
                {has ? (
                  <button
                    type="button"
                    class="pm-show"
                    aria-pressed={gi === hlGroup}
                    data-show={id}
                    onClick={() => setHl(id)}
                  >
                    {gi === hlGroup && (
                      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                        <path
                          d="M2.5 7.3L5.6 10.2L11.5 3.8"
                          style={{
                            fill: 'none',
                            stroke: 'currentColor',
                            strokeWidth: 2,
                            strokeLinecap: 'round',
                            strokeLinejoin: 'round',
                          }}
                        />
                      </svg>
                    )}
                    {t('pm.show')}
                  </button>
                ) : (
                  <span class="pm-noprofile">{t('pm.noProfileLong')}</span>
                )}
                <a class="pm-link" href={modulePath(lang, def.link.slug, def.link.section)}>
                  {t('pm.link', { n: m.n, s: def.link.section })}
                  <span aria-hidden="true">{' →'}</span>
                </a>
              </div>
            </li>
          );
        })}
      </ul>

      <p class="pm-generic">{t('pm.generic')}</p>

      {/* ---------- the whole matrix as a table ---------- */}
      <details class="pm-table">
        <summary>{t('pm.table')}</summary>
        <div class="ff-scroll-x">
          <table class="ff-table">
            <thead>
              <tr>
                <th scope="col">{t('pm.table.need')}</th>
                <th scope="col">{t('pm.table.view')}</th>
                <th scope="col">{t('pm.table.products')}</th>
                <th scope="col">
                  <span class="sr-only">{t('pm.table.go')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {NEED_IDS.flatMap((n) =>
                (n === 'alpha' ? ALPHA_VIEW_IDS : DIR_VIEW_IDS).map((v: ViewId, vi) => {
                  const c = makeCell(n, v);
                  const current = c.need === cell.need && c.view === cell.view;
                  return (
                    <tr key={`${n}.${v}`} class={current ? 'is-current' : undefined}>
                      <th scope="row">{vi === 0 ? t(`pm.need.${n}`) : ''}</th>
                      <td>{t(`pm.view.${v}`)}</td>
                      <td>
                        {cellProducts(c)
                          .map((id) => t(`pm.p.${id}.name`))
                          .join(', ')}
                      </td>
                      <td>
                        {current ? (
                          <span class="pm-current">{t('pm.table.current')}</span>
                        ) : (
                          <button
                            type="button"
                            class="pm-go"
                            aria-label={t('pm.table.goLabel', {
                              need: t(`pm.need.${n}`),
                              view: t(`pm.view.${v}`),
                            })}
                            onClick={() => choose(c)}
                          >
                            {t('pm.table.go')}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                }),
              )}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
