/**
 * Greeks lab (MASTER_PROMPT §8.2): faithful port of docs/design/GreeksLab.dc.html.
 *
 * Two charts share the left column (price curve with its tangent above, a Greek below), the
 * sliders, the premium, the six Greeks on USD 1 Mio. and the numeric check sit on the right
 * (below the charts on phones). Prop `mode` picks what the charts show:
 *   delta-gamma  V(S) with tangent Δ, Δ(S) with tangent Γ (default)
 *   vega         V(σ) with tangent ν, ν(S) with its peak near ATMF
 *   theta        V(t) with tangent Θ, one-day Θ(t) accelerating towards expiry
 *   rho          V(r_CHF) with tangent ρ_d, V(r_USD) with tangent ρ_f (plus two rate sliders)
 *
 * Maths: src/lib/greekslab.ts on top of the calculation core. Wow without noise: the dot can be
 * dragged right on the chart (the slider is the accessible twin), every change tweens in 300 ms
 * (instant while dragging and under reduced motion), numbers count to their new value, and a
 * short annotation appears exactly when the learner reaches the interesting configuration.
 */
import type { JSX } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Slider } from '@/components/ui/Slider';
import { StatHero, StatRow, StatTable } from '@/components/ui/Stat';
import { useElementWidth, usePrefersReducedMotion, useTween } from '@/components/ui/hooks';
import { greekslab as dict } from '@/i18n/dict/greekslab';
import { translator, type Lang } from '@/i18n/types';
import { scaleLinear, type Point, type Scale } from '@/lib/chart';
import { EXAMPLE } from '@/lib/fx/example';
import { fmtMillions, fmtMoney, fmtNumber, fmtPctValue, fmtPips, fmtRate } from '@/lib/format';
import {
  CHART_MIN,
  CHART_RATIO,
  LAB_CONFIG,
  aha as ahaFor,
  labLayout,
  labNumbers,
  moneyness,
  panels,
  paramFromX,
  pctDigits,
  placeCallout,
  sameParams,
  sharedX,
  weeksLabel,
  xTicks,
  xValue,
  yTicks,
  type AhaKey,
  type LabLayout,
  type LabMode,
  type LabParams,
  type PanelId,
  type PanelSpec,
  type XKey,
} from '@/lib/greekslab';

export interface GreeksLabProps {
  lang: Lang;
  mode?: LabMode;
}

const PAIR = EXAMPLE.pair;
const TWEEN_MS = 300;
const CALL_FONT = 12;

interface Gesture {
  panel: PanelId;
  id: number;
  x: number;
  y: number;
  active: boolean;
}

export default function GreeksLab({ lang, mode = 'delta-gamma' }: GreeksLabProps): JSX.Element {
  const t = translator(dict, lang);
  const uid = `gl-${mode}`;
  const R = LAB_CONFIG.ranges;

  const [params, setParams] = useState<LabParams>({ ...LAB_CONFIG.defaults });
  const [dragPanel, setDragPanel] = useState<PanelId | null>(null);
  const [sliderDrag, setSliderDrag] = useState(false);
  const [interacted, setInteracted] = useState(false);
  const rm = usePrefersReducedMotion();
  const instant = rm || dragPanel !== null || sliderDrag;

  const tw = useTween(
    [params.spot, params.weeks, params.volPct, params.rdPct, params.rfPct],
    TWEEN_MS,
    instant,
  );
  const twKey = tw.join(',');
  const shown: LabParams = useMemo(
    () => ({ spot: tw[0]!, weeks: tw[1]!, volPct: tw[2]!, rdPct: tw[3]!, rfPct: tw[4]! }),
    [twKey],
  );
  const n = useMemo(() => labNumbers(shown), [twKey]);
  const [top, bottom] = useMemo(() => panels(mode, shown, n), [mode, twKey]);

  // Axis domains follow the target (not every tween frame) and glide on their own.
  const pKey = `${params.spot},${params.weeks},${params.volPct},${params.rdPct},${params.rfPct}`;
  const target = useMemo(() => panels(mode, params), [mode, pKey]);
  const doms = useTween(
    [...target[0].yDomain, ...target[1].yDomain],
    TWEEN_MS,
    rm || dragPanel !== null,
  );
  const aha = useMemo(() => ahaFor(mode, params), [mode, pKey]);

  // Keep the last annotation while it fades out.
  const lastAha = useRef<AhaKey | null>(null);
  if (aha) lastAha.current = aha.key;
  const ahaKey = aha?.key ?? lastAha.current;

  const box = useRef<HTMLDivElement>(null);
  const width = useElementWidth(box, 560);
  const L = labLayout(width);

  const update = (patch: Partial<LabParams>) => {
    setInteracted(true);
    setParams((p) => ({ ...p, ...patch }));
  };

  // Slider dragging: instant while the pointer is down on a slider, tween for keys and clicks.
  useEffect(() => {
    if (!sliderDrag) return;
    const up = () => setSliderDrag(false);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [sliderDrag]);

  /* ---------- chart geometry ---------- */
  const geo = (spec: PanelSpec, which: PanelId, d0: number, d1: number) => {
    const g = which === 'top' ? L.top : L.bottom;
    const x = scaleLinear(spec.xDomain, [L.left, L.width - L.right]);
    const y = scaleLinear([d0, d1], [g.plotBottom, g.plotTop]);
    return { x, y, g };
  };
  const topGeo = geo(top, 'top', doms[0]!, doms[1]!);
  const botGeo = geo(bottom, 'bottom', doms[2]!, doms[3]!);
  const geoRef = useRef({ top: topGeo, bottom: botGeo, specs: { top, bottom } });
  geoRef.current = { top: topGeo, bottom: botGeo, specs: { top, bottom } };

  /* ---------- pointer drag on the chart ---------- */
  const gesture = useRef<Gesture | null>(null);

  const toData = (e: PointerEvent, svg: SVGSVGElement, panel: PanelId) => {
    const rect = svg.getBoundingClientRect();
    const vx = ((e.clientX - rect.left) / Math.max(1, rect.width)) * L.width;
    const spec = geoRef.current.specs[panel];
    update(paramFromX(spec.x, geoRef.current[panel].x.invert(vx)));
  };

  const dotDistance = (e: PointerEvent, svg: SVGSVGElement, panel: PanelId) => {
    const rect = svg.getBoundingClientRect();
    const k = rect.width / L.width;
    const G = geoRef.current[panel];
    const spec = geoRef.current.specs[panel];
    const cx = rect.left + G.x(spec.at[0]) * k;
    const cy = rect.top + clampY(G.y(spec.at[1]), G.g) * k;
    return Math.hypot(e.clientX - cx, e.clientY - cy);
  };

  const onDown = (panel: PanelId) => (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const svg = e.currentTarget as SVGSVGElement;
    const active = e.pointerType !== 'touch' || dotDistance(e, svg, panel) < 30;
    gesture.current = { panel, id: e.pointerId, x: e.clientX, y: e.clientY, active };
    if (active) {
      svg.setPointerCapture?.(e.pointerId);
      setDragPanel(panel);
      toData(e, svg, panel);
    }
  };
  const onMove = (e: PointerEvent) => {
    const gs = gesture.current;
    if (!gs || gs.id !== e.pointerId) return;
    const svg = e.currentTarget as SVGSVGElement;
    if (!gs.active) {
      const dx = Math.abs(e.clientX - gs.x);
      const dy = Math.abs(e.clientY - gs.y);
      if (dx < 8 || dx < dy) return;
      gs.active = true;
      svg.setPointerCapture?.(e.pointerId);
      setDragPanel(gs.panel);
    }
    toData(e, svg, gs.panel);
  };
  const onUp = (e: PointerEvent) => {
    if (gesture.current?.id !== e.pointerId) return;
    gesture.current = null;
    setDragPanel(null);
  };

  /* ---------- texts ---------- */
  const notional = fmtMillions(LAB_CONFIG.notional, EXAMPLE.base, lang);
  const pct = (v: number) => fmtPctValue(v, lang, pctDigits(v));
  const weeksText = (w: number) => {
    const k = weeksLabel(w);
    return k === 'one'
      ? t('gl.weeks.one')
      : k === 'year'
        ? t('gl.weeks.year')
        : k === 'threeMonths'
          ? t('gl.weeks.threeMonths', { n: w })
          : t('gl.weeks.n', { n: w });
  };
  const money = moneyness(n.forward);
  const moneyText =
    money.kind === 'ATMF'
      ? t('gl.money.atmf')
      : t(money.kind === 'ITM' ? 'gl.money.itm' : 'gl.money.otm', {
          pips: fmtNumber(money.pips, lang),
        });
  const num = (x: number, digits: number, sign = false) => fmtNumber(x, lang, { digits, sign });
  const chf = (x: number, digits = 0, sign = false) => fmtMoney(x, 'CHF', lang, digits, sign);

  const xFmt = (x: XKey, v: number): string => {
    switch (x) {
      case 'spot':
        return fmtRate(v, PAIR, 2);
      case 'volPct':
      case 'rdPct':
      case 'rfPct':
        return fmtPctValue(v, lang, 0);
      case 'days': {
        const m = Math.round((v * 12) / 365);
        return m === 0 ? t('gl.tick.expiry') : t('gl.tick.months', { n: m });
      }
    }
  };
  const xNow = (x: XKey): string => {
    switch (x) {
      case 'spot':
        return fmtRate(params.spot, PAIR);
      case 'volPct':
        return fmtPctValue(params.volPct, lang, 1);
      case 'days':
        return weeksText(params.weeks);
      case 'rdPct':
        return pct(params.rdPct);
      case 'rfPct':
        return pct(params.rfPct);
    }
  };
  const axisTitle: Record<XKey, string> = {
    spot: t('gl.axis.spot'),
    volPct: t('gl.axis.vol'),
    days: t('gl.axis.days'),
    rdPct: t('gl.axis.rd'),
    rfPct: t('gl.axis.rf'),
  };

  /* ---------- per-mode heads, pills, aria ---------- */
  const slope = t('gl.pill.slope');
  const slopeShort = t('gl.pill.slopeShort');
  type Head = {
    title: string;
    color: string;
    pillBg: string;
    tangent: boolean;
    sym: JSX.Element;
    value: string;
    unit?: string;
    aria: string;
  };
  const heads = ((): [Head, Head] => {
    const blue = 'var(--ff-long)';
    const violet = 'var(--ff-delta-curve)';
    const chip = 'var(--ff-chip)';
    const soft = 'var(--ff-options-soft)';
    switch (mode) {
      case 'vega': {
        const peak = bottom.peak ? fmtRate(bottom.peak[0], PAIR) : t('gl.aria.peakOutside');
        return [
          {
            title: t('gl.head.priceVol'),
            color: blue,
            pillBg: chip,
            tangent: true,
            sym: <>ν</>,
            value: num(n.vegaPips, 1),
            unit: t('gl.unit.pipsPerVol'),
            aria: t('gl.aria.vega.top', { x: xNow('volPct'), v: num(n.vegaPips, 1) }),
          },
          {
            title: t('gl.head.vega'),
            color: violet,
            pillBg: soft,
            tangent: false,
            sym: <>ν</>,
            value: chf(n.vegaChf),
            unit: t('gl.unit.perVol'),
            aria: t('gl.aria.vega.bottom', { v: chf(n.vegaChf), x: xNow('spot'), peak }),
          },
        ];
      }
      case 'theta':
        return [
          {
            title: t('gl.head.priceTime'),
            color: blue,
            pillBg: chip,
            tangent: true,
            sym: <>Θ</>,
            value: num(n.thetaPips, 2),
            unit: t('gl.unit.pipsPerDay'),
            aria: t('gl.aria.theta.top', { x: xNow('days'), v: num(n.thetaPips, 2) }),
          },
          {
            title: t('gl.head.theta'),
            color: violet,
            pillBg: soft,
            tangent: false,
            sym: <>Θ</>,
            value: chf(n.thetaDayChf),
            unit: t('gl.unit.perDay'),
            aria: t('gl.aria.theta.bottom', { v: chf(n.thetaDayChf), x: xNow('days') }),
          },
        ];
      case 'rho':
        return [
          {
            title: t('gl.head.priceRd'),
            color: blue,
            pillBg: chip,
            tangent: true,
            sym: (
              <>
                ρ<sub>d</sub>
              </>
            ),
            value: num(n.rhoDPips, 1, true),
            unit: t('gl.unit.pipsPerPct'),
            aria: t('gl.aria.rho.top', { x: xNow('rdPct'), v: num(n.rhoDPips, 1, true) }),
          },
          {
            title: t('gl.head.priceRf'),
            color: blue,
            pillBg: chip,
            tangent: true,
            sym: (
              <>
                ρ<sub>f</sub>
              </>
            ),
            value: num(n.rhoFPips, 1, true),
            unit: t('gl.unit.pipsPerPct'),
            aria: t('gl.aria.rho.bottom', { x: xNow('rfPct'), v: num(n.rhoFPips, 1, true) }),
          },
        ];
      default:
        return [
          {
            title: t('gl.head.priceSpot'),
            color: blue,
            pillBg: chip,
            tangent: true,
            sym: <>Δ</>,
            value: num(n.delta, 3),
            aria: t('gl.aria.dg.top', { x: xNow('spot'), v: num(n.delta, 3) }),
          },
          {
            title: t('gl.head.delta'),
            color: violet,
            pillBg: soft,
            tangent: true,
            sym: <>Γ</>,
            value: num(n.gamma, 2),
            aria: t('gl.aria.dg.bottom', { x: xNow('spot'), v: num(n.gamma, 2) }),
          },
        ];
    }
  })();

  const ghostLabel = t('gl.head.ghost', {
    months: EXAMPLE.months,
    vol: fmtPctValue(LAB_CONFIG.defaults.volPct, lang, 0),
  });

  /* ---------- one chart ---------- */
  const yFmt = (spec: PanelSpec, v: number): string | null => {
    if (spec.y === 'delta') {
      return Math.abs(v * 2 - Math.round(v * 2)) < 1e-9 ? num(v, 1) : null;
    }
    return num(v, 0);
  };

  const chart = (which: PanelId, spec: PanelSpec, head: Head, G: ReturnType<typeof geo>) => {
    const { x, y, g } = G;
    const x0 = L.left;
    const x1 = L.width - L.right;
    const dom: [number, number] = which === 'top' ? [doms[0]!, doms[1]!] : [doms[2]!, doms[3]!];
    const step = (which === 'top' ? target[0] : target[1]).yStep;
    const ticks = yTicks(dom, step);
    const zeroIn = Math.min(...dom) - 1e-9 <= 0 && 0 <= Math.max(...dom) + 1e-9;
    const P = (pts: Point[]) => path(pts, x, y);
    const cx = x(spec.at[0]);
    const cy = clampY(y(spec.at[1]), g);
    const clipId = `${uid}-clip-${which}`;
    const guideX = x(xValue(spec.x, shown));
    const titleX = which === 'bottom' || !sharedX(mode);
    // Put the axis title (and the payoff label) on the side where the curve leaves room.
    const titleText = axisTitle[spec.x];
    const titleW = titleText.length * 6.8;
    const px = projected(spec.points, x, y);
    const crowd = (a: number, b: number) =>
      px.filter(([u, v]) => u >= a - 4 && u <= b + 4 && v >= g.plotBottom - 24).length;
    const titleRight =
      crowd(x1 - titleW, x1) <= crowd(x0 + 4, x0 + 4 + titleW);
    const titleBox = titleRight ? { a: x1 - titleW, b: x1 } : { a: x0 + 4, b: x0 + 4 + titleW };
    const strikeLabel =
      (which === 'top' && spec.x === 'spot') || (which === 'bottom' && mode === 'vega');
    const dragging = dragPanel === which;

    // annotation
    const showAha = aha?.panel === which || (!aha && lastAha.current && lastPanel(mode) === which);
    let callout: JSX.Element | null = null;
    if (showAha && ahaKey) {
      const l1 = t(`gl.aha.${ahaKey}.t`);
      const l2 = t(`gl.aha.${ahaKey}.d`);
      const w = Math.ceil(Math.max(l1.length * 7.1, l2.length * 6.3)) + 20;
      const h = 44;
      const obstacles: Point[] = [...px];
      for (const r of spec.refs) {
        const rx = x(r.x);
        for (let k = 0; k <= 8; k++) obstacles.push([rx + k * 8, g.plotTop + 10]);
      }
      if (titleX) {
        for (let px = titleBox.a; px <= titleBox.b; px += 8)
          obstacles.push([px, g.plotBottom - 12], [px, g.plotBottom - 4]);
      }
      if (spec.tangent) {
        const [a0, b0, a1, b1] = spec.tangent;
        for (let i = 0; i <= 12; i++) {
          const k = i / 12;
          obstacles.push([x(a0 + (a1 - a0) * k), y(b0 + (b1 - b0) * k)]);
        }
      }
      const b = placeCallout(
        [cx, cy],
        { w, h },
        { x0: x0 + 2, x1: x1 - 2, y0: g.plotTop + 2, y1: g.plotBottom - 2 },
        obstacles,
        14,
      );
      // a thin leader when the box had to move away from the dot
      const nx = Math.min(Math.max(cx, b.x), b.x + b.w);
      const ny = Math.min(Math.max(cy, b.y), b.y + b.h);
      const far = Math.hypot(nx - cx, ny - cy) > 26;
      callout = (
        <g
          class="gl-aha"
          data-aha={aha ? aha.key : ''}
          style={{ opacity: aha ? 1 : 0, transition: rm ? 'none' : 'opacity 300ms ease' }}
        >
          {far && (
            <path
              d={`M${cx.toFixed(1)},${cy.toFixed(1)}L${nx.toFixed(1)},${ny.toFixed(1)}`}
              class="gl-aha-leader"
            />
          )}
          <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={10} class="gl-aha-box" />
          <text x={b.x + 10} y={b.y + 18} class="gl-aha-title">
            {l1}
          </text>
          <text x={b.x + 10} y={b.y + 35} class="gl-aha-text">
            {l2}
          </text>
        </g>
      );
    }

    return (
      <div
        class="gl-chart"
        style={{
          height: `max(${which === 'top' ? CHART_MIN.top : CHART_MIN.bottom}px, ${(
            (which === 'top' ? CHART_RATIO.top : CHART_RATIO.bottom) * 100
          ).toFixed(3)}cqw)`,
        }}
      >
        <svg
          viewBox={`0 0 ${L.width} ${g.height}`}
          role="img"
          aria-label={head.aria}
          data-panel={which}
          class={`gl-svg${dragging ? ' is-dragging' : ''}`}
          onPointerDown={onDown(which)}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onLostPointerCapture={onUp}
        >
          <defs>
            <clipPath id={clipId}>
              <rect
                x={x0 - 4}
                y={g.plotTop - 4}
                width={x1 - x0 + 8}
                height={g.plotBottom - g.plotTop + 8}
              />
            </clipPath>
          </defs>
          {/* grid */}
          {ticks.map((v) => {
            const yy = y(v);
            const label = yFmt(spec, v);
            const isAxis = zeroIn && Math.abs(v) < 1e-9;
            return (
              <g key={`g${v}`}>
                <path
                  d={`M${x0},${yy.toFixed(1)}H${x1}`}
                  class={isAxis ? 'gl-axis' : 'gl-grid'}
                />
                {label !== null && (
                  <text x={x0 - 8} y={yy + 4} class="gl-tick" text-anchor="end">
                    {label}
                  </text>
                )}
              </g>
            );
          })}
          {/* reference lines */}
          {spec.refs.map((r) => {
            const rx = x(r.x);
            return (
              <g key={`r${r.kind}`}>
                <path d={`M${rx.toFixed(1)},${g.plotTop}V${g.plotBottom}`} class="gl-ref" />
                {(r.kind === 'equalRates' || strikeLabel) && (
                  <text
                    x={rx + (rx > x1 - 90 ? -6 : 6)}
                    y={g.plotTop + 14}
                    class="gl-ref-label"
                    text-anchor={rx > x1 - 90 ? 'end' : 'start'}
                  >
                    {r.kind === 'strike'
                      ? t('gl.ref.strike')
                      : t(which === 'top' ? 'gl.ref.equalTop' : 'gl.ref.equalBottom')}
                  </text>
                )}
              </g>
            );
          })}
          {/* guide at the current x */}
          <path d={`M${guideX.toFixed(1)},${g.plotTop}V${g.plotBottom}`} class="gl-guide" />
          <g clip-path={`url(#${clipId})`}>
            {spec.payoff && <path d={P(spec.payoff)} class="gl-payoff" />}
            {spec.ghost && <path d={P(spec.ghost)} class="gl-ghost" />}
            {spec.ghost && <GhostLabel pts={spec.ghost} x={x} y={y} text={ghostLabel} />}
            <path d={P(spec.points)} class="gl-curve" style={{ stroke: head.color }} />
            {spec.peak && (
              <circle cx={x(spec.peak[0])} cy={y(spec.peak[1])} r={5} class="gl-peak" />
            )}
            {spec.tangent && (
              <path
                d={`M${x(spec.tangent[0]).toFixed(1)},${y(spec.tangent[1]).toFixed(1)}L${x(
                  spec.tangent[2],
                ).toFixed(1)},${y(spec.tangent[3]).toFixed(1)}`}
                class="gl-tangent"
              />
            )}
          </g>
          {spec.payoff && mode === 'theta' && (
            <text
              x={x0 + 6}
              y={clampY(y(spec.payoff[0]![1]), g) - 8}
              class="gl-label"
              text-anchor="start"
            >
              {t('gl.ref.payoff')}
            </text>
          )}
          {/* the dot */}
          {dragging && <circle cx={cx} cy={cy} r={16} class="gl-halo" />}
          <circle cx={cx} cy={cy} r={dragging ? 8 : 6} class="gl-dot" />
          {/* x axis */}
          {xTicks(spec.x, L.compact).map((v) => (
            <text key={`x${v}`} x={x(v)} y={g.height - 12} class="gl-tick" text-anchor="middle">
              {xFmt(spec.x, v)}
            </text>
          ))}
          {titleX && (
            <rect
              x={titleBox.a - 4}
              y={g.plotBottom - 21}
              width={titleBox.b - titleBox.a + 8}
              height={17}
              rx={4}
              class="gl-title-bg"
            />
          )}
          {titleX && (
            <text
              x={titleRight ? x1 : x0 + 4}
              y={g.plotBottom - 8}
              class="gl-axis-title"
              text-anchor={titleRight ? 'end' : 'start'}
            >
              {titleText}
            </text>
          )}
          {callout}
        </svg>
      </div>
    );
  };

  const panelHead = (head: Head) => (
    <div class="gl-head">
      <span class="gl-legend">
        <span aria-hidden="true" class="gl-swatch" style={{ borderTopColor: head.color }} />
        <span>{greek(head.title)}</span>
      </span>
      <span class="gl-pill" style={{ background: head.pillBg }}>
        <span aria-hidden="true" class={head.tangent ? 'gl-pill-line' : 'gl-pill-dot'} />
        <span>
          {head.tangent && (
            <>
              <span class="gl-slope-long">{slope}</span>
              <span class="gl-slope-short">{slopeShort}</span> ={' '}
            </>
          )}
          <span class="gl-sym">{head.sym}</span> = <b>{head.value}</b>
          {head.unit && <> {head.unit}</>}
        </span>
      </span>
    </div>
  );

  /* ---------- side column ---------- */
  const highlight = {
    delta: mode === 'delta-gamma',
    gamma: mode === 'delta-gamma',
    vega: mode === 'vega',
    theta: mode === 'theta',
    rho: mode === 'rho',
  };

  const check = ((): JSX.Element => {
    switch (mode) {
      case 'vega':
        return (
          <>
            <span class="gl-check-f math">
              [<i>V</i>(σ + <i>h</i>) − <i>V</i>(σ − <i>h</i>)] / 2<i>h</i>{' '}
              <span class="gl-nowrap">= {chf(n.check.vegaChf, 2)}</span>
            </span>
            <span>{greek(t('gl.check.vega', { notional, v: chf(n.vegaChf, 2) }))}</span>
          </>
        );
      case 'theta':
        return (
          <>
            <span class="gl-check-f math">
              −[<i>V</i>(<i>T</i> + <i>h</i>) − <i>V</i>(<i>T</i> − <i>h</i>)] / 2<i>h</i>{' '}
              <span class="gl-nowrap">= {chf(n.check.thetaChf, 2)}</span>
            </span>
            <span>
              {greek(
                t('gl.check.theta', {
                  v: chf(n.thetaAnalyticChf, 2),
                  day: chf(n.thetaDayChf, 2),
                }),
              )}
            </span>
          </>
        );
      case 'rho':
        return (
          <>
            <span class="gl-check-f math">
              [<i>V</i>(<i>r</i>
              <sub>d</sub> + <i>h</i>) − <i>V</i>(<i>r</i>
              <sub>d</sub> − <i>h</i>)] / 2<i>h</i>{' '}
              <span class="gl-nowrap">= {chf(n.check.rhoDChf, 2, true)}</span>
            </span>
            <span class="gl-check-f math">
              [<i>V</i>(<i>r</i>
              <sub>f</sub> + <i>h</i>) − <i>V</i>(<i>r</i>
              <sub>f</sub> − <i>h</i>)] / 2<i>h</i>{' '}
              <span class="gl-nowrap">= {chf(n.check.rhoFChf, 2, true)}</span>
            </span>
            <span>
              {t('gl.check.rho', {
                notional,
                d: chf(n.rhoDChf, 2, true),
                f: chf(n.rhoFChf, 2, true),
              })}
            </span>
          </>
        );
      default:
        return (
          <>
            <span class="gl-check-f math">
              [Δ(<i>S</i> + <i>h</i>) − Δ(<i>S</i> − <i>h</i>)] / 2<i>h</i> = {num(n.check.gamma, 2)}
            </span>
            <span>{greek(t('gl.check.gamma', { v: num(n.gamma, 2) }))}</span>
          </>
        );
    }
  })();

  const atDefaults = sameParams(params, LAB_CONFIG.defaults);
  const summary = t('gl.summary', {
    mode: t(
      mode === 'delta-gamma' ? 'gl.mode.dg' : mode === 'vega' ? 'gl.mode.vega' : `gl.mode.${mode}`,
    ),
    spot: xNow('spot'),
    weeks: weeksText(params.weeks),
    vol: fmtPctValue(params.volPct, lang, 1),
    rd: pct(params.rdPct),
    rf: pct(params.rfPct),
    money: `${money.kind}: ${moneyText}`,
    pips: fmtPips(n.pricePips, lang),
    chf: chf(n.priceChf),
    delta: num(n.delta, 3),
    gamma: num(n.gamma, 2),
    vega: chf(n.vegaChf),
    theta: chf(n.thetaDayChf, 0, true),
    rhoD: chf(n.rhoDChf, 0, true),
    rhoF: chf(n.rhoFChf, 0, true),
  });

  const sliderWrap = (el: JSX.Element) => (
    <div onPointerDown={() => setSliderDrag(true)}>{el}</div>
  );

  return (
    <div class="gl" data-greekslab data-mode={mode} data-dragging={dragPanel ? 'true' : 'false'}>
      <div class="ff-lab-head">
        <div class="gl-titles">
          <div class="ff-lab-title">{t('gl.title')}</div>
          <div class="ff-lab-sub">
            {t('gl.sub', {
              option: t('gl.option'),
              strike: fmtRate(LAB_CONFIG.strike, PAIR),
              notional,
              rd: pct(params.rdPct),
              rf: pct(params.rfPct),
            })}
          </div>
        </div>
        <span class={`gl-money is-${money.kind.toLowerCase()}`} data-money={money.kind}>
          <b>{money.kind}</b>
          {moneyText}
        </span>
      </div>

      <div class="ff-lab">
        <div class="ff-lab-main gl-main" ref={box}>
          {panelHead(heads[0])}
          {chart('top', top, heads[0], topGeo)}
          {panelHead(heads[1])}
          {chart('bottom', bottom, heads[1], botGeo)}
          <p class="gl-hint">
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <path d="M2 7H12M2 7L4.5 4.5M2 7L4.5 9.5M12 7L9.5 4.5M12 7L9.5 9.5" />
            </svg>
            {t('gl.hint')}
          </p>
        </div>

        <div class="ff-lab-side">
          <div class="panel">
            {sliderWrap(
              <Slider
                id={`${uid}-spot`}
                label={t('gl.slider.spot')}
                value={params.spot}
                {...R.spot}
                valueText={fmtRate(params.spot, PAIR)}
                onInput={(v) => update({ spot: v })}
              />,
            )}
            {sliderWrap(
              <Slider
                id={`${uid}-weeks`}
                label={t('gl.slider.weeks')}
                value={params.weeks}
                {...R.weeks}
                valueText={weeksText(params.weeks)}
                onInput={(v) => update({ weeks: v })}
              />,
            )}
            {sliderWrap(
              <Slider
                id={`${uid}-vol`}
                label={t('gl.slider.vol')}
                value={params.volPct}
                {...R.volPct}
                valueText={fmtPctValue(params.volPct, lang, 1)}
                onInput={(v) => update({ volPct: v })}
              />,
            )}
            {mode === 'rho' && (
              <>
                {sliderWrap(
                  <Slider
                    id={`${uid}-rd`}
                    label={t('gl.slider.rd')}
                    value={params.rdPct}
                    {...R.rdPct}
                    valueText={fmtPctValue(params.rdPct, lang, 2)}
                    onInput={(v) => update({ rdPct: v })}
                  />,
                )}
                {sliderWrap(
                  <Slider
                    id={`${uid}-rf`}
                    label={t('gl.slider.rf')}
                    value={params.rfPct}
                    {...R.rfPct}
                    valueText={fmtPctValue(params.rfPct, lang, 2)}
                    onInput={(v) => update({ rfPct: v })}
                  />,
                )}
              </>
            )}
            <button
              type="button"
              class="gl-reset"
              data-reset
              disabled={atDefaults}
              onClick={() => update({ ...LAB_CONFIG.defaults })}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                <path d="M3 5.5A4.5 4.5 0 1 1 2.6 8.6M3 2.5V5.5H6" />
              </svg>
              {t('gl.reset')}
            </button>
          </div>

          <div role="group" aria-label={t('gl.table', { notional })}>
            <StatTable>
              <StatHero
                label={t('gl.premium')}
                value={t('gl.premiumPips', { v: fmtPips(n.pricePips, lang) })}
                sub={t('gl.premiumChf', { chf: chf(n.priceChf), notional })}
              />
              <StatRow
                symbol="Δ"
                label={t('gl.name.delta')}
                sub={t('gl.unit.slopePrice')}
                value={num(n.delta, 3)}
                highlight={highlight.delta}
              />
              <StatRow
                symbol="Γ"
                label={t('gl.name.gamma')}
                sub={t('gl.unit.perBigFigure', { v: num(n.gammaBigFigure, 3, true) })}
                value={num(n.gamma, 2)}
                highlight={highlight.gamma}
              />
              <StatRow
                symbol="ν"
                label={t('gl.name.vega')}
                sub={t('gl.unit.perVol')}
                value={chf(n.vegaChf)}
                highlight={highlight.vega}
              />
              <StatRow
                symbol="Θ"
                label={t('gl.name.theta')}
                sub={t('gl.unit.perDay')}
                value={chf(n.thetaDayChf, 0, true)}
                highlight={highlight.theta}
              />
              <StatRow
                symbol={
                  <>
                    ρ<sub>d</sub>
                  </>
                }
                label={t('gl.name.rhoD')}
                sub={t('gl.unit.perPctChf')}
                value={chf(n.rhoDChf, 0, true)}
                highlight={highlight.rho}
              />
              <StatRow
                symbol={
                  <>
                    ρ<sub>f</sub>
                  </>
                }
                label={t('gl.name.rhoF')}
                sub={t('gl.unit.perPctUsd')}
                value={chf(n.rhoFChf, 0, true)}
                highlight={highlight.rho}
              />
            </StatTable>
          </div>

          <div class="ff-check" data-check>
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              aria-hidden="true"
              style={{ flex: '0 0 20px', marginTop: 2 }}
            >
              <circle cx="10" cy="10" r="9" style={{ fill: 'var(--ff-good-text)' }} />
              <path
                d="M6 10.3L8.8 13L14 7.4"
                style={{
                  fill: 'none',
                  stroke: '#fff',
                  strokeWidth: 2,
                  strokeLinecap: 'round',
                  strokeLinejoin: 'round',
                }}
              />
            </svg>
            <div class="gl-check-body">
              <span class="gl-check-title">{t('gl.check.title')}</span>
              {check}
            </div>
          </div>
        </div>
      </div>

      <p class="sr-only" data-summary>
        {summary}
      </p>
      <div class="sr-only" aria-live="polite" aria-atomic="true">
        {interacted && aha ? `${t(`gl.aha.${aha.key}.t`)}: ${t(`gl.aha.${aha.key}.d`)}` : ''}
      </div>
    </div>
  );
}

/** Label of the example curve, centred above its highest point. */
function GhostLabel(p: { pts: Point[]; x: Scale; y: Scale; text: string }): JSX.Element {
  const top = p.pts.reduce((a, b) => (b[1] > a[1] ? b : a));
  return (
    <text x={p.x(top[0])} y={p.y(top[1]) - 8} class="gl-label" text-anchor="middle">
      {p.text}
    </text>
  );
}

/** Wraps Greek letters in a span set in STIX Two (the UI font has no Greek glyphs). */
function greek(text: string): Array<string | JSX.Element> {
  return text
    .split(/([\u0391-\u03C9])/)
    .filter(Boolean)
    .map((part, i) =>
      /^[\u0391-\u03C9]$/.test(part) ? (
        <span key={i} class="gl-sym">
          {part}
        </span>
      ) : (
        part
      ),
    );
}

/** Panel that carries the annotation of a mode (rho: the CHF-rate chart). */
const lastPanel = (mode: LabMode): PanelId => (mode === 'rho' ? 'top' : 'bottom');

const clampY = (v: number, g: LabLayout['top']): number =>
  Math.min(g.plotBottom, Math.max(g.plotTop, v));

function projected(pts: Point[], x: Scale, y: Scale): Point[] {
  return pts.map(([a, b]) => [x(a), y(b)]);
}

function path(pts: Point[], x: Scale, y: Scale): string {
  let d = '';
  for (let i = 0; i < pts.length; i++) {
    const [a, b] = pts[i]!;
    if (!Number.isFinite(b)) continue;
    d += `${d ? 'L' : 'M'}${x(a).toFixed(1)},${y(b).toFixed(1)}`;
  }
  return d;
}

