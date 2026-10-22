/**
 * Payoff builder (MASTER_PROMPT §8.3), reused by modules 04 and 06.
 *
 * Props (all serialisable, set them on PayoffBuilderFigure.astro):
 * - lang: 'de' | 'en'.
 * - templates?: template ids for the chip row (default DEFAULT_TEMPLATES in src/lib/payoff.ts:
 *   the four basic positions, synthetic forward, call and put spread, risk reversal, straddle,
 *   strangle, butterfly, seagull; 'long-forward' on request). Unknown ids are ignored.
 * - initial?: template shown first (default: the first of `templates`).
 * - view?: 'value' (value today + payoff at expiry, default) or 'pnl' (both after premium).
 * - smile?: true values every option leg at the smile vol of its strike (EXAMPLE_SMILE).
 *
 * Interaction: drag the strike handles on the x axis (pointer events, one handle per distinct
 * strike); each leg also has a strike slider as the accessible twin. Near the zero-cost strike a
 * dragged handle snaps onto it. "Zero Cost halten" makes one leg's strike follow so that the net
 * premium stays zero. Maths in src/lib/payoff.ts, strings in src/i18n/dict/payoff.ts.
 */
import type { JSX } from 'preact';
import { useEffect, useId, useMemo, useRef, useState } from 'preact/hooks';
import { AxisX, GridY } from '@/components/ui/Chart';
import { Legend, type LegendItem } from '@/components/ui/Legend';
import { Segmented } from '@/components/ui/Segmented';
import { Slider } from '@/components/ui/Slider';
import { StatHero, StatRow, StatTable } from '@/components/ui/Stat';
import { useElementWidth, usePrefersReducedMotion, useTween } from '@/components/ui/hooks';
import { payoff as dict } from '@/i18n/dict/payoff';
import { translator, type Lang } from '@/i18n/types';
import { clamp, linePath, niceStep, niceTicks, scaleLinear, type Point } from '@/lib/chart';
import { EXAMPLE, EXAMPLE_FORWARD, EXAMPLE_SMILE } from '@/lib/fx/example';
import { fmtMillions, fmtMoney, fmtNumber, fmtPct, fmtPips, fmtRate, pipSize } from '@/lib/format';
import {
  DEFAULT_TEMPLATES,
  STRIKE_RANGE,
  STRIKE_STEP,
  TEMPLATE_IDS,
  X_RANGE,
  breakEvens,
  buildTemplate,
  expiryExtremes,
  identifyTemplate,
  isTemplateId,
  legPayoff,
  legValue,
  legVol,
  netGreeks,
  netPremium,
  payoffSketch,
  roundStrike,
  solveZeroCostStrike,
  strikeGroups,
  type Leg,
  type LegKind,
  type LegSide,
  type PayoffMarket,
  type TemplateId,
} from '@/lib/payoff';

export interface PayoffBuilderProps {
  lang: Lang;
  templates?: string[];
  initial?: string;
  view?: 'value' | 'pnl';
  smile?: boolean;
}

type View = 'value' | 'pnl';
type Change = 'init' | 'template' | 'toggle' | 'slider' | 'drag';

interface BuilderState {
  legs: Leg[];
  /** Leg whose strike is solved for zero cost and follows the others. */
  solve: number | null;
  /** Leg for which the last zero-cost lock failed (note in its card). */
  unreachable: number | null;
}

const BASE_MARKET: PayoffMarket = {
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
const SAMPLES = 120;
const MAX_LEGS = 4;
const NOTIONAL_STEP = 0.5 * N;
const NOTIONAL_MIN = 0.5 * N;
const NOTIONAL_MAX = 3 * N;
/** A dragged strike snaps onto the zero-cost strike when it is this close (quote units). */
const MAGNET = 4 * PIP;
const MIN_SPAN_PIPS = 300;

const XS: number[] = Array.from(
  { length: SAMPLES + 1 },
  (_, i) => X_RANGE[0] + ((X_RANGE[1] - X_RANGE[0]) * i) / SAMPLES,
);

interface Layout {
  width: number;
  height: number;
  compact: boolean;
  font: number;
  left: number;
  right: number;
  top: number;
  plotBottom: number;
  rail: number;
}

function layoutFor(w: number): Layout {
  const width = Math.max(280, Math.round(w));
  const compact = width < 560;
  const height = compact ? 310 : Math.round(clamp(width * 0.6, 330, 430));
  const rail = height - (compact ? 38 : 42);
  return {
    width,
    height,
    compact,
    font: compact ? 11 : 12,
    left: compact ? 46 : 58,
    right: compact ? 10 : 16,
    top: 30,
    plotBottom: rail - 16,
    rail,
  };
}

const sideColor = (side: LegSide, kind: LegKind): string =>
  kind === 'forward' ? 'var(--ff-forward)' : side === 'long' ? 'var(--ff-long)' : 'var(--ff-short)';

/** Template list from the props: known ids only, default list if nothing is left. */
function resolveTemplates(ids?: string[]): TemplateId[] {
  const list = (ids ?? []).filter(isTemplateId);
  return list.length ? list : [...DEFAULT_TEMPLATES];
}

const pathOf = (ys: number[], sx: (x: number) => number, sy: (y: number) => number): string =>
  linePath(XS.map((x, i): Point => [sx(x), sy(ys[i] ?? 0)]));

export default function PayoffBuilder(props: PayoffBuilderProps): JSX.Element {
  const { lang } = props;
  const t = translator(dict, lang);
  const uid = useId().replace(/[^A-Za-z0-9_-]/g, '');
  const rm = usePrefersReducedMotion();
  const market = useMemo<PayoffMarket>(
    () => (props.smile ? { ...BASE_MARKET, smile: EXAMPLE_SMILE } : BASE_MARKET),
    [props.smile],
  );
  const templates = useMemo(() => resolveTemplates(props.templates), [props.templates?.join()]);
  const firstId: TemplateId =
    props.initial && isTemplateId(props.initial) ? props.initial : templates[0]!;

  const [state, setState] = useState<BuilderState>(() => {
    const tp = buildTemplate(firstId, market);
    return { legs: tp.legs, solve: tp.solve, unreachable: null };
  });
  const [view, setView] = useState<View>(props.view === 'pnl' ? 'pnl' : 'value');
  const [change, setChange] = useState<Change>('init');
  const [drag, setDrag] = useState<number[] | null>(null);
  const [interacted, setInteracted] = useState(false);
  const dragRef = useRef<{ group: number[]; pointerId: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const width = useElementWidth(box, 640);
  const layout = layoutFor(width);

  const { legs, solve } = state;
  const templateNow = identifyTemplate(legs, TEMPLATE_IDS);
  const pressed = templateNow && templates.includes(templateNow) ? templateNow : null;

  /* ---------- maths (memoised per position and view) ---------- */
  const calc = useMemo(() => {
    const prem = netPremium(legs, market);
    const growth = Math.exp(market.rd * market.T);
    const legPrem = legs.map((l) => legValue(l, market));
    const vols = legs.map((l) => legVol(l, market));
    const toPips = (q: number) => q / N / PIP;
    const shift = view === 'pnl' ? toPips(prem.quote * growth) : 0;
    const shiftToday = view === 'pnl' ? toPips(prem.quote) : 0;
    const payoff: number[] = [];
    const value: number[] = [];
    const legCurves: number[][] = legs.map(() => []);
    for (const x of XS) {
      let p = 0;
      let v = 0;
      legs.forEach((l, j) => {
        const lp = legPayoff(l, x);
        p += lp;
        v += legValue(l, market, x, market.T, vols[j]);
        legCurves[j]!.push(toPips(lp) - (view === 'pnl' ? toPips(legPrem[j]! * growth) : 0));
      });
      payoff.push(toPips(p) - shift);
      value.push(toPips(v) - shiftToday);
    }
    let lo = Math.min(0, ...payoff, ...value);
    let hi = Math.max(0, ...payoff, ...value);
    const span = Math.max(hi - lo, MIN_SPAN_PIPS);
    const pad = span * 0.1;
    const step = niceStep(span + 2 * pad, 5);
    lo = Math.floor((lo - pad) / step) * step;
    hi = Math.ceil((hi + pad) / step) * step;
    if (hi - lo < MIN_SPAN_PIPS) hi = lo + MIN_SPAN_PIPS;
    return {
      prem,
      greeks: netGreeks(legs, market),
      extremes: expiryExtremes(legs, market),
      be: breakEvens(legs, market),
      payoff,
      value,
      legCurves,
      domain: [lo, hi] as [number, number],
      spotPips: view === 'pnl' ? 0 : prem.pips,
    };
  }, [legs, market, view]);

  /* ---------- tweens: curves morph, numbers count, instant while dragging ---------- */
  const instant = rm || drag !== null || change === 'slider' || change === 'init';
  const net = useTween([...calc.payoff, ...calc.value], 300, instant);
  const legFlat = useTween(calc.legCurves.flat(), 300, instant);
  const dom = useTween(calc.domain, 300, instant);
  const premTween = useTween(calc.prem.pips, 300, instant);
  const spotTween = useTween(calc.spotPips, 300, instant);

  /* ---------- live announcement of zero cost ---------- */
  const [live, setLive] = useState('');
  const prevZero = useRef(calc.prem.zeroCost);
  useEffect(() => {
    if (prevZero.current !== calc.prem.zeroCost && interacted) {
      setLive(
        calc.prem.zeroCost
          ? t('pb.live.zero')
          : t('pb.live.lost', { premium: t('pb.pips', { v: fmtPips(calc.prem.pips, lang) }) }),
      );
    }
    prevZero.current = calc.prem.zeroCost;
  }, [calc.prem.zeroCost]);

  /* ---------- state updates ---------- */
  const reSolve = (s: BuilderState): BuilderState => {
    if (s.solve === null) return { ...s, unreachable: null };
    const i = s.solve;
    const K = solveZeroCostStrike(s.legs, i, market, STRIKE_RANGE, s.legs[i]!.strike);
    if (K === null) return { ...s, unreachable: i };
    const next = s.legs.slice();
    next[i] = { ...next[i]!, strike: K };
    return { ...s, legs: next, unreachable: null };
  };

  const setStrikes = (group: number[], K: number, how: Change, magnet: boolean) => {
    setInteracted(true);
    setChange(how);
    setState((cur) => {
      let next = cur.legs.map((l, i) => (group.includes(i) ? { ...l, strike: K } : l));
      let lock = cur.solve;
      if (lock !== null && group.includes(lock)) lock = null;
      if (lock === null && magnet) {
        const K0 = solveZeroCostStrike(next, group, market, STRIKE_RANGE, K);
        if (K0 !== null && Math.abs(K0 - K) <= MAGNET) {
          next = next.map((l, i) => (group.includes(i) ? { ...l, strike: K0 } : l));
        }
      }
      return reSolve({ ...cur, legs: next, solve: lock });
    });
  };

  const updateLeg = (i: number, patch: Partial<Leg>) => {
    setInteracted(true);
    setChange('toggle');
    setState((cur) => {
      const next = cur.legs.map((l, j) => (j === i ? { ...l, ...patch } : l));
      return reSolve({ ...cur, legs: next });
    });
  };

  const pickTemplate = (id: TemplateId) => {
    setInteracted(true);
    setChange('template');
    const tp = buildTemplate(id, market);
    setState({ legs: tp.legs, solve: tp.solve, unreachable: null });
  };

  const addLeg = () => {
    setInteracted(true);
    setChange('toggle');
    setState((cur) =>
      cur.legs.length >= MAX_LEGS
        ? cur
        : reSolve({
            ...cur,
            legs: [
              ...cur.legs,
              { side: 'long', kind: 'call', strike: roundStrike(EXAMPLE_FORWARD), notional: N },
            ],
          }),
    );
  };

  const removeLeg = (i: number) => {
    setInteracted(true);
    setChange('toggle');
    setState((cur) => {
      if (cur.legs.length <= 1) return cur;
      const lock = cur.solve === i ? null : cur.solve !== null && cur.solve > i ? cur.solve - 1 : cur.solve;
      return reSolve({ ...cur, legs: cur.legs.filter((_, j) => j !== i), solve: lock });
    });
  };

  const toggleLock = (i: number) => {
    setInteracted(true);
    setChange('toggle');
    setState((cur) => {
      if (cur.solve === i) return { ...cur, solve: null, unreachable: null };
      const solved = reSolve({ ...cur, solve: i });
      return solved.unreachable === i ? { ...cur, solve: null, unreachable: i } : solved;
    });
  };

  /* ---------- scales ---------- */
  const L = layout;
  const sx = scaleLinear([X_RANGE[0], X_RANGE[1]], [L.left, L.width - L.right]);
  const sy = scaleLinear([dom[0]!, dom[1]!], [L.plotBottom, L.top]);
  const yTicks = niceTicks(dom[0]!, dom[1]!, L.compact ? 4 : 6).filter(
    (v) => v >= dom[0]! - 1e-9 && v <= dom[1]! + 1e-9,
  );
  const xTicks = niceTicks(X_RANGE[0], X_RANGE[1], L.compact ? 4 : 7).filter(
    (v) => v > X_RANGE[0] + 1e-9 && v < X_RANGE[1] - 1e-9,
  );
  const n = SAMPLES + 1;
  const payoffPath = pathOf(net.slice(0, n), sx, sy);
  const valuePath = pathOf(net.slice(n, 2 * n), sx, sy);
  const legPaths =
    legFlat.length === legs.length * n
      ? legs.map((_, j) => pathOf(legFlat.slice(j * n, (j + 1) * n), sx, sy))
      : calc.legCurves.map((ys) => pathOf(ys, sx, sy));

  /* ---------- drag handles ---------- */
  const groups = strikeGroups(legs);
  const rows: number[] = [];
  const lastX: number[] = [-Infinity, -Infinity];
  for (const g of groups) {
    const x = sx(g.strike);
    const w = 16 + (1 + 2 * g.legs.length) * 7;
    const row = x - lastX[0]! >= w + 6 ? 0 : 1;
    rows.push(row);
    lastX[row] = x;
  }

  const pointerToStrike = (clientX: number): number => {
    const el = svgRef.current;
    if (!el) return legs[0]!.strike;
    const rect = el.getBoundingClientRect();
    const xv = ((clientX - rect.left) * L.width) / Math.max(1, rect.width);
    return clamp(roundStrike(sx.invert(xv)), STRIKE_RANGE[0], STRIKE_RANGE[1]);
  };
  const onDown = (group: number[]) => (e: PointerEvent) => {
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    dragRef.current = { group, pointerId: e.pointerId };
    setDrag(group);
    setChange('drag');
  };
  const onMove = (e: PointerEvent) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    setStrikes(d.group, pointerToStrike(e.clientX), 'drag', true);
  };
  const onUp = (e: PointerEvent) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    dragRef.current = null;
    setDrag(null);
  };

  /* ---------- texts ---------- */
  const name = t(`pb.t.${templateNow ?? 'custom'}`);
  const pipsText = (v: number) => t('pb.pips', { v: fmtPips(v, lang) });
  const chf = (v: number, sign = false) => fmtMoney(v, EXAMPLE.quote, lang, 0, sign);
  const millions = (x: number) =>
    fmtMillions(x, EXAMPLE.base, lang, Number.isInteger(x / 1e6) ? 0 : 1);
  const prem = calc.prem;
  const premAbsChf = chf(Math.abs(premTween) * N * PIP);
  const premSub = prem.zeroCost
    ? t('pb.zero')
    : prem.direction === 'pay'
      ? t('pb.pay', { chf: premAbsChf })
      : t('pb.receive', { chf: premAbsChf });
  const gainText = (x: number | 'unlimited') => (x === 'unlimited' ? t('pb.unlimited') : chf(x));
  const beText = calc.be.length
    ? calc.be.map((b) => fmtRate(b, PAIR)).join(' · ')
    : t('pb.noBreakEven');
  const g = calc.greeks;
  const deltaRatio = fmtNumber(g.delta / N, lang, { digits: 3 });
  const kindLabel = (k: LegKind) => t(k === 'call' ? 'pb.call' : k === 'put' ? 'pb.put' : 'pb.forward');
  const legsAria = legs
    .map((l) =>
      t('pb.ariaLeg', {
        side: t(l.side === 'long' ? 'pb.sideLong' : 'pb.sideShort'),
        kind: kindLabel(l.kind),
        k: fmtRate(l.strike, PAIR),
        notional: millions(l.notional),
      }),
    )
    .join('; ');
  const premiumText = pipsText(prem.pips);
  const ariaLabel = t('pb.aria', { position: name, premium: premiumText, legs: legsAria });
  const summary = t('pb.summary', {
    position: name,
    premium: premiumText,
    chf: chf(prem.quote),
    gain: gainText(calc.extremes.maxGain),
    loss: gainText(calc.extremes.maxLoss),
    be: beText,
    delta: deltaRatio,
  });
  const sub = t(props.smile ? 'pb.subSmile' : 'pb.sub', {
    pair: PAIR,
    spot: fmtRate(EXAMPLE.spot, PAIR),
    forward: fmtRate(EXAMPLE_FORWARD, PAIR),
    months: EXAMPLE.months,
    vol: fmtPct(EXAMPLE.vol, lang, 0),
  });

  const hasLong = legs.some((l) => l.side === 'long' && l.kind !== 'forward');
  const hasShort = legs.some((l) => l.side === 'short' && l.kind !== 'forward');
  const legend: LegendItem[] = [
    { label: t(view === 'pnl' ? 'pb.lg.pnlToday' : 'pb.lg.value'), color: 'var(--ff-long)' },
    {
      label: t(view === 'pnl' ? 'pb.lg.pnlExpiry' : 'pb.lg.payoff'),
      color: 'var(--ff-payoff)',
      kind: 'dashed',
      width: 2,
    },
  ];
  if (legs.length > 1 && hasLong)
    legend.push({ label: t('pb.lg.legLong'), color: 'rgba(37, 99, 235, 0.45)', width: 2 });
  if (legs.length > 1 && hasShort)
    legend.push({ label: t('pb.lg.legShort'), color: 'rgba(234, 88, 12, 0.5)', width: 2 });

  /* ---------- template glyphs (memoised) ---------- */
  const glyphs = useMemo(() => {
    const out: Record<string, string> = {};
    for (const id of templates) {
      const ys = payoffSketch(buildTemplate(id, market).legs, 0.745, 0.845, 20);
      out[id] = linePath(ys.map((y, i): Point => [2 + (i * 30) / 20, 9 - y * 6.5]));
    }
    return out;
  }, [templates, market]);

  const spotX = sx(EXAMPLE.spot);
  const spotY = sy(spotTween);
  const zeroY = sy(0);
  const fs = `${L.font}px`;
  const clipId = `pb-clip-${uid}`;
  const labelRight = spotX > L.width - 150;

  return (
    <div
      ref={box}
      class="pb"
      data-pb
      data-template={templateNow ?? 'custom'}
      data-zero-cost={prem.zeroCost ? 'true' : 'false'}
      data-premium-pips={prem.pips.toFixed(4)}
    >
      <div class="ff-lab-head">
        <div class="pb-head-text">
          <div class="ff-lab-title">{t('pb.title')}</div>
          <div class="ff-lab-sub">{sub}</div>
        </div>
        <div class="pb-chips-status">
          <span class="ff-pill-note pb-name" data-position-name>
            {name}
          </span>
          {prem.zeroCost && (
            <span class="pb-zero" data-zero-chip>
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                <circle cx="7" cy="7" r="6.5" style={{ fill: 'var(--ff-good-text)' }} />
                <path
                  d="M4 7.2L6 9.2L10 5"
                  style={{
                    fill: 'none',
                    stroke: '#fff',
                    strokeWidth: 1.8,
                    strokeLinecap: 'round',
                    strokeLinejoin: 'round',
                  }}
                />
              </svg>
              {t('pb.zero')}
            </span>
          )}
        </div>
      </div>

      {templates.length > 1 && (
        <div class="pb-templates" role="group" aria-label={t('pb.templates')}>
          {templates.map((id) => (
            <button
              key={id}
              type="button"
              class="pb-chip"
              aria-pressed={pressed === id}
              data-tpl={id}
              onClick={() => pickTemplate(id)}
            >
              <svg width="34" height="18" viewBox="0 0 34 18" aria-hidden="true">
                <path d="M2,9H32" style={{ stroke: 'currentColor', strokeOpacity: 0.25, strokeWidth: 1 }} />
                <path
                  d={glyphs[id]}
                  style={{
                    fill: 'none',
                    stroke: 'currentColor',
                    strokeWidth: 1.8,
                    strokeLinecap: 'round',
                    strokeLinejoin: 'round',
                  }}
                />
              </svg>
              <span>{t(`pb.t.${id}`)}</span>
            </button>
          ))}
        </div>
      )}
      <p class="pb-desc" data-desc>
        {t(`pb.d.${templateNow ?? 'custom'}`)}
      </p>

      <div class="ff-lab">
        <div class="ff-lab-main">
          <div class="pb-legend-row">
            <Legend items={legend} />
            <Segmented
              label={t('pb.view')}
              value={view}
              onChange={(v) => {
                setInteracted(true);
                setChange('toggle');
                setView(v);
              }}
              options={[
                { value: 'value', label: t('pb.view.value') },
                { value: 'pnl', label: t('pb.view.pnl') },
              ]}
            />
          </div>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${L.width} ${L.height}`}
            role="img"
            aria-label={ariaLabel}
            class="pb-svg"
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
              ticks={yTicks}
              x0={L.left}
              x1={L.width - L.right}
              format={(v) => fmtPips(v, lang, 0, true)}
              fontSize={L.font}
            />
            <text x={L.left} y={L.top - 14} style={{ fontSize: fs, fontWeight: 600, fill: 'var(--ff-muted)' }}>
              {t(view === 'pnl' ? 'pb.yPnl' : 'pb.yValue')}
            </text>

            {/* strike lines */}
            {groups.map((gr) => (
              <path
                key={`k${gr.legs.join('-')}`}
                d={`M${sx(gr.strike).toFixed(1)},${L.top}V${L.rail}`}
                style={{
                  fill: 'none',
                  stroke: 'var(--ff-ref)',
                  strokeWidth: 1,
                  strokeDasharray: '4 5',
                }}
              />
            ))}

            {/* spot line */}
            <path
              d={`M${spotX.toFixed(1)},${L.top}V${L.plotBottom}`}
              style={{ fill: 'none', stroke: 'var(--ff-axis)', strokeWidth: 1, strokeDasharray: '2 4' }}
            />
            <text
              x={spotX + (labelRight ? -6 : 6)}
              y={L.top + L.font}
              style={{
                fontSize: fs,
                fontWeight: 600,
                fill: 'var(--ff-muted)',
                textAnchor: labelRight ? 'end' : 'start',
              }}
            >
              {t('pb.spot')} {fmtRate(EXAMPLE.spot, PAIR)}
            </text>

            <g clip-path={`url(#${clipId})`}>
              {legs.length > 1 &&
                legs.map((l, j) => (
                  <path
                    key={`leg${j}`}
                    d={legPaths[j]}
                    style={{
                      fill: 'none',
                      stroke: sideColor(l.side, l.kind),
                      strokeOpacity: 0.42,
                      strokeWidth: 1.5,
                      strokeLinejoin: 'round',
                    }}
                  />
                ))}
              <path
                d={payoffPath}
                data-payoff
                style={{
                  fill: 'none',
                  stroke: 'var(--ff-payoff)',
                  strokeWidth: 2,
                  strokeDasharray: '6 6',
                  strokeLinejoin: 'round',
                }}
              />
              <path
                d={valuePath}
                data-value
                style={{
                  fill: 'none',
                  stroke: 'var(--ff-long)',
                  strokeWidth: 3,
                  strokeLinecap: 'round',
                  strokeLinejoin: 'round',
                }}
              />
            </g>

            {/* break-evens (P&L view) */}
            {view === 'pnl' &&
              calc.be
                .filter((b) => b > X_RANGE[0] && b < X_RANGE[1])
                .map((b) => (
                  <g key={`be${b.toFixed(6)}`}>
                    <circle
                      cx={sx(b)}
                      cy={zeroY}
                      r={4.5}
                      style={{ fill: '#fff', stroke: 'var(--ff-forward)', strokeWidth: 2 }}
                    />
                    <text
                      x={sx(b)}
                      y={zeroY + L.font + 8}
                      style={{
                        fontSize: fs,
                        fontWeight: 700,
                        fill: 'var(--ff-ink)',
                        textAnchor: 'middle',
                        paintOrder: 'stroke',
                        stroke: '#fff',
                        strokeWidth: 3,
                      }}
                    >
                      {t('pb.be')}
                    </text>
                  </g>
                ))}

            {/* value today at the current spot */}
            <circle
              cx={spotX}
              cy={spotY}
              r={6}
              style={{ fill: 'var(--ff-long)', stroke: '#fff', strokeWidth: 2.5 }}
            />
            {prem.zeroCost ? (
              <g class="pb-aha" key="aha">
                <text
                  x={spotX + (labelRight ? -12 : 12)}
                  y={spotY - 12}
                  style={{
                    fontSize: `${L.font + 1}px`,
                    fontWeight: 800,
                    fill: 'var(--ff-good-text-strong)',
                    textAnchor: labelRight ? 'end' : 'start',
                    paintOrder: 'stroke',
                    stroke: '#fff',
                    strokeWidth: 4,
                    strokeLinejoin: 'round',
                  }}
                >
                  {t('pb.aha')}
                </text>
              </g>
            ) : (
              <text
                x={spotX + (labelRight ? -12 : 12)}
                y={spotY - 12}
                style={{
                  fontSize: fs,
                  fontWeight: 700,
                  fill: 'var(--ff-ink)',
                  textAnchor: labelRight ? 'end' : 'start',
                  paintOrder: 'stroke',
                  stroke: '#fff',
                  strokeWidth: 4,
                  strokeLinejoin: 'round',
                }}
              >
                {t('pb.spotValue', { pips: fmtPips(spotTween, lang, 1, true) })}
              </text>
            )}

            {/* handle rail and strike handles */}
            <path
              d={`M${L.left},${L.rail}H${L.width - L.right}`}
              style={{ fill: 'none', stroke: 'var(--ff-line)', strokeWidth: 4, strokeLinecap: 'round' }}
            />
            {groups.map((gr, gi) => {
              const x = sx(gr.strike);
              const cy = rows[gi] === 0 ? L.rail : L.rail - 26;
              const label = `K${gr.legs.map((i) => i + 1).join('·')}`;
              const w = 16 + label.length * 7;
              const sides = new Set(gr.legs.map((i) => sideColor(legs[i]!.side, legs[i]!.kind)));
              const color = sides.size === 1 ? [...sides][0]! : 'var(--ff-forward)';
              const active = drag !== null && drag.join() === gr.legs.join();
              return (
                <g
                  key={`h${gr.legs.join('-')}`}
                  class={`pb-handle${active ? ' is-active' : ''}`}
                  data-handle={gr.legs.join('-')}
                  onPointerDown={onDown(gr.legs)}
                  onPointerMove={onMove}
                  onPointerUp={onUp}
                  onPointerCancel={onUp}
                >
                  <rect x={x - 24} y={cy - 22} width={48} height={44} style={{ fill: 'transparent' }} />
                  <rect
                    x={x - w / 2}
                    y={cy - 11}
                    width={w}
                    height={22}
                    rx={11}
                    style={{ fill: color, stroke: '#fff', strokeWidth: 2 }}
                  />
                  <text
                    x={x}
                    y={cy + 4}
                    style={{
                      fontSize: '11px',
                      fontWeight: 800,
                      fill: '#fff',
                      textAnchor: 'middle',
                      pointerEvents: 'none',
                    }}
                  >
                    {label}
                  </text>
                  {active && (
                    <text
                      x={x}
                      y={cy - 18}
                      style={{
                        fontSize: '12px',
                        fontWeight: 700,
                        fill: 'var(--ff-ink)',
                        textAnchor: 'middle',
                        fontFamily: 'var(--ff-font-mono)',
                        paintOrder: 'stroke',
                        stroke: '#fff',
                        strokeWidth: 4,
                      }}
                    >
                      {fmtRate(gr.strike, PAIR)}
                    </text>
                  )}
                </g>
              );
            })}

            <AxisX
              x={sx}
              ticks={xTicks}
              y={L.height - 6}
              format={(v) => fmtRate(v, PAIR, 2)}
              fontSize={L.font}
            />
          </svg>
          <p class="pb-hint">{t('pb.dragHint')}</p>
          <p class="sr-only" data-summary>
            {summary}
          </p>
          <div class="sr-only" aria-live="polite" aria-atomic="true">
            {live}
          </div>
        </div>

        <div class="ff-lab-side">
          <StatTable>
            <StatHero
              label={t('pb.premium')}
              value={pipsText(prem.zeroCost ? 0 : premTween)}
              sub={premSub}
            />
            <StatRow
              symbol="Δ"
              label={t('pb.delta')}
              sub={t('pb.deltaSub', {
                fwd: fmtNumber(g.deltaFwd / N, lang, { digits: 3 }),
                usd: fmtMoney(g.delta, EXAMPLE.base, lang),
              })}
              value={deltaRatio}
            />
            <StatRow symbol="ν" label={t('pb.vega')} sub={t('pb.vegaSub')} value={chf(g.vega)} />
            <StatRow symbol="Θ" label={t('pb.theta')} sub={t('pb.thetaSub')} value={chf(g.theta)} />
            <StatRow
              label={t('pb.maxGain')}
              sub={t('pb.atExpiry')}
              value={gainText(calc.extremes.maxGain)}
              highlight
            />
            <StatRow
              label={t('pb.maxLoss')}
              sub={t('pb.atExpiry')}
              value={gainText(calc.extremes.maxLoss)}
              highlight
            />
            <StatRow label={t('pb.breakEven')} sub={t('pb.atExpiry')} value={beText} highlight />
          </StatTable>
        </div>
      </div>

      <div class="pb-legs" role="group" aria-label={t('pb.legs')}>
        {legs.map((l, i) => {
          const nn = i + 1;
          const color = sideColor(l.side, l.kind);
          return (
            <div class="pb-leg" key={`leg-card-${i}`} data-leg={i} style={{ '--pb-leg': color }}>
              <div class="pb-leg-head">
                <span class="pb-leg-tag" aria-hidden="true">
                  K{nn}
                </span>
                <span class="pb-leg-name">{t('pb.leg', { n: nn })}</span>
                {legs.length > 1 && (
                  <button
                    type="button"
                    class="pb-icon-btn"
                    aria-label={t('pb.remove', { n: nn })}
                    onClick={() => removeLeg(i)}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                      <path
                        d="M3 3L11 11M11 3L3 11"
                        style={{ stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' }}
                      />
                    </svg>
                  </button>
                )}
              </div>
              <Segmented
                label={t('pb.side', { n: nn })}
                value={l.side}
                onChange={(v) => updateLeg(i, { side: v })}
                options={[
                  { value: 'long', label: t('pb.long') },
                  { value: 'short', label: t('pb.short') },
                ]}
              />
              <Segmented
                label={t('pb.kind', { n: nn })}
                value={l.kind}
                onChange={(v) => updateLeg(i, { kind: v })}
                options={[
                  { value: 'call', label: t('pb.call') },
                  { value: 'put', label: t('pb.put') },
                  { value: 'forward', label: t('pb.fwdShort') },
                ]}
              />
              <Slider
                id={`pb-${uid}-k${i}`}
                label={t('pb.strike', { n: nn })}
                value={l.strike}
                min={STRIKE_RANGE[0]}
                max={STRIKE_RANGE[1]}
                step={STRIKE_STEP}
                valueText={fmtRate(l.strike, PAIR)}
                onInput={(v) => setStrikes([i], v, 'slider', false)}
              />
              <div class="pb-leg-row">
                <span class="pb-leg-label">{t('pb.notional')}</span>
                <div class="pb-stepper">
                  <button
                    type="button"
                    aria-label={t('pb.less', { n: nn })}
                    disabled={l.notional <= NOTIONAL_MIN + 1}
                    onClick={() => updateLeg(i, { notional: Math.max(NOTIONAL_MIN, l.notional - NOTIONAL_STEP) })}
                  >
                    −
                  </button>
                  <span class="mono" data-notional>
                    {millions(l.notional)}
                  </span>
                  <button
                    type="button"
                    aria-label={t('pb.more', { n: nn })}
                    disabled={l.notional >= NOTIONAL_MAX - 1}
                    onClick={() => updateLeg(i, { notional: Math.min(NOTIONAL_MAX, l.notional + NOTIONAL_STEP) })}
                  >
                    +
                  </button>
                </div>
              </div>
              <button
                type="button"
                class="pb-lock"
                aria-pressed={solve === i}
                data-lock={i}
                onClick={() => toggleLock(i)}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                  <rect x="2.5" y="6" width="9" height="6.5" rx="1.5" style={{ fill: 'currentColor' }} />
                  <path
                    d={solve === i ? 'M4.5 6V4.5a2.5 2.5 0 0 1 5 0V6' : 'M4.5 6V4.5a2.5 2.5 0 0 1 5 0'}
                    style={{ fill: 'none', stroke: 'currentColor', strokeWidth: 1.6 }}
                  />
                </svg>
                {t('pb.lock')}
              </button>
              {solve === i && <p class="pb-note">{t('pb.lockHint', { n: nn })}</p>}
              {state.unreachable === i && <p class="pb-note pb-note--warn">{t('pb.unreachable')}</p>}
            </div>
          );
        })}
        {legs.length < MAX_LEGS && (
          <button type="button" class="pb-add" onClick={addLeg} data-add-leg>
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M8 3V13M3 8H13" style={{ stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' }} />
            </svg>
            {t('pb.add')}
          </button>
        )}
      </div>
    </div>
  );
}
