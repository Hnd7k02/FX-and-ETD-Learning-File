/**
 * Smile builder (module 06, section 4): the implied vol per strike from the three FX quotes
 * ATM, 25Δ risk reversal and 25Δ butterfly (smile-strangle convention, quadratic in the call's
 * forward delta, src/lib/fx/smile.ts). Sliders for the three quotes; the three pillars (25Δ put,
 * ATM, 25Δ call) can be dragged on the chart. The x axis toggles between strike and delta and the
 * curve morphs between both. The butterfly is drawn as the gap between ATM and the middle of the
 * wings; aha notes appear when RR = 0 (symmetric) or BF = 0 (no curvature). Example values, not
 * market data. Pure helpers in src/lib/smile-builder.ts, strings in src/i18n/dict/smilebuilder.ts.
 */
import type { JSX } from 'preact';
import { useId, useMemo, useRef, useState } from 'preact/hooks';
import { AxisX, GridY } from '@/components/ui/Chart';
import { Legend } from '@/components/ui/Legend';
import { Segmented } from '@/components/ui/Segmented';
import { Slider } from '@/components/ui/Slider';
import { StatRow, StatTable } from '@/components/ui/Stat';
import { useElementWidth, usePrefersReducedMotion, useTween } from '@/components/ui/hooks';
import { smilebuilder as dict } from '@/i18n/dict/smilebuilder';
import { translator, type Lang } from '@/i18n/types';
import { clamp, linePath, niceStep, niceTicks, scaleLinear, type Point } from '@/lib/chart';
import { EXAMPLE, EXAMPLE_FORWARD, EXAMPLE_LABEL, EXAMPLE_SMILE } from '@/lib/fx/example';
import type { SmileQuotes } from '@/lib/fx/smile';
import { fmtNumber, fmtPct, fmtPips, fmtRate, pipSize } from '@/lib/format';
import {
  DELTA_TICKS,
  SMILE_LIMITS,
  baseVolRange,
  dragPillar,
  higherWing,
  pickLabelSpot,
  premiumEffect,
  sameQuotes,
  smileGeometry,
  smilePresets,
  smileShape,
  volDomain,
  type LabelBox,
  type Pillar,
} from '@/lib/smile-builder';

export interface SmileBuilderProps {
  lang: Lang;
  /** Start with the strike axis (default) or the delta axis. */
  initialView?: 'strike' | 'delta';
}

type View = 'strike' | 'delta';
type Preset = 'example' | 'symmetric' | 'flat';
type Change = 'init' | 'slider' | 'preset' | 'drag';
type Anchor = 'start' | 'middle' | 'end';

const PAIR = EXAMPLE.pair;
const PIP = pipSize(PAIR);
const F = EXAMPLE_FORWARD;
const T = EXAMPLE.T;
const X_STRIKE: [number, number] = [0.73, 0.86];
const X_DELTA: [number, number] = [0.98, 0.02];
const BASE = baseVolRange(EXAMPLE_SMILE.atm);
const PRESETS = smilePresets(EXAMPLE_SMILE);
const PRESET_IDS: Preset[] = ['example', 'symmetric', 'flat'];
const PILLARS: Pillar[] = ['put25', 'atm', 'call25'];
/** lo ≤ v ≤ hi. */
const inside = (v: number, lo: number, hi: number): boolean => lo <= v && v <= hi;

function layoutFor(w: number) {
  const width = Math.max(280, Math.round(w));
  const compact = width < 560;
  const height = compact ? 330 : Math.round(clamp(width * 0.6, 320, 410));
  return {
    width,
    height,
    compact,
    font: compact ? 11 : 12,
    left: compact ? 40 : 50,
    right: compact ? 10 : 16,
    top: 18,
    plotBottom: height - 36,
  };
}

const halo = {
  paintOrder: 'stroke' as const,
  stroke: '#fff',
  strokeWidth: 4,
  strokeLinejoin: 'round' as const,
};

export default function SmileBuilder(props: SmileBuilderProps): JSX.Element {
  const { lang } = props;
  const t = translator(dict, lang);
  const uid = useId().replace(/[^A-Za-z0-9_-]/g, '');
  const rm = usePrefersReducedMotion();
  const [q, setQ] = useState<SmileQuotes>({ ...EXAMPLE_SMILE });
  const [view, setView] = useState<View>(props.initialView === 'delta' ? 'delta' : 'strike');
  const [change, setChange] = useState<Change>('init');
  const [drag, setDrag] = useState<Pillar | null>(null);
  const frozen = useRef<[number, number] | null>(null);
  const pointer = useRef<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const L = layoutFor(useElementWidth(box, 640));

  /* quotes tween on presets (the curve morphs), instant for sliders, drags and reduced motion */
  const qt = useTween([q.atm, q.rr25, q.bf25], 300, rm || change !== 'preset');
  const qv: SmileQuotes = { atm: qt[0]!, rr25: qt[1]!, bf25: qt[2]! };
  const geom = useMemo(() => smileGeometry(qv, F, T), [qt.join()]);
  const target = useMemo(() => smileGeometry(q, F, T), [q]);
  const domTarget = drag && frozen.current ? frozen.current : volDomain(target, BASE);
  const dom = useTween(domTarget, 300, rm || drag !== null);
  const mix = useTween(view === 'delta' ? 1 : 0, 450, rm)!;

  /* ---------- scales ---------- */
  const sxK = scaleLinear(X_STRIKE, [L.left, L.width - L.right]);
  const sxD = scaleLinear(X_DELTA, [L.left, L.width - L.right]);
  const sy = scaleLinear([dom[0]!, dom[1]!], [L.plotBottom, L.top]);
  const xOf = (K: number, d: number) => sxK(K) + (sxD(d) - sxK(K)) * mix;
  const step = niceStep(dom[1]! - dom[0]!, 5);
  const yTicks = niceTicks(dom[0]!, dom[1]!, 5).filter((v) =>
    inside(v, dom[0]! - 1e-9, dom[1]! + 1e-9),
  );
  const yDigits = step >= 0.01 - 1e-12 ? 0 : 1;
  const screen = geom.points.map((p): Point => [xOf(p.K, p.deltaFwd), sy(p.vol)]);
  const curvePath = linePath(screen);
  const P = geom.pillars;
  const px = (k: Pillar) => xOf(P[k].K, P[k].deltaFwd);

  /* ---------- interaction ---------- */
  const setQuote = (patch: Partial<SmileQuotes>) => {
    setChange('slider');
    setQ((cur) => ({ ...cur, ...patch }));
  };
  const pick = (id: Preset) => {
    setChange('preset');
    setQ({ ...PRESETS[id] });
  };
  const volFromPointer = (clientY: number) => {
    const el = svgRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const yv = ((clientY - r.top) * L.height) / Math.max(1, r.height);
    const d = frozen.current ?? [dom[0]!, dom[1]!];
    return clamp(sy.invert(yv), Math.max(0.005, d[0]), d[1]);
  };
  const onDown = (k: Pillar) => (e: PointerEvent) => {
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    pointer.current = e.pointerId;
    frozen.current = [dom[0]!, dom[1]!];
    setChange('drag');
    setDrag(k);
  };
  const onMove = (e: PointerEvent) => {
    if (pointer.current !== e.pointerId || !drag) return;
    const v = volFromPointer(e.clientY);
    if (v !== null) setQ((cur) => dragPillar(cur, drag, v));
  };
  const onUp = (e: PointerEvent) => {
    if (pointer.current !== e.pointerId) return;
    pointer.current = null;
    frozen.current = null;
    setDrag(null);
  };

  /* ---------- texts ---------- */
  const pct = (v: number, digits = 2, sign = false) => fmtPct(v, lang, digits, sign);
  const shape = smileShape(q);
  const wing = higherWing(q);
  const preset = PRESET_IDS.find((id) => sameQuotes(PRESETS[id], q)) ?? null;
  const tp = target.pillars;
  const aria = t('sb.aria', {
    pair: PAIR,
    months: EXAMPLE.months,
    axis: t(view === 'delta' ? 'sb.axisDelta' : 'sb.axisStrike'),
    p: pct(tp.put25.vol),
    a: pct(tp.atm.vol),
    c: pct(tp.call25.vol),
    rr: pct(q.rr25, 2, true),
    bf: pct(q.bf25, 2, true),
  });
  const eff = useMemo(() => premiumEffect(q, EXAMPLE.spot, T, EXAMPLE.rd, EXAMPLE.rf), [q]);
  /* prices on the 0.1-pip display grid, so the difference shown is the difference of the two
     prices shown (52.9 − 43.6 = +9.3) */
  const r1 = (x: number) => Math.round(x * 10) / 10;
  const effRow = (k: 'put25' | 'call25') => {
    const e = eff[k];
    const pSmile = r1(e.smile / PIP);
    const pFlat = r1(e.flat / PIP);
    return {
      sub: t('sb.eff.sub', {
        smile: pct(e.volSmile),
        flat: pct(e.volFlat),
        pSmile: fmtPips(pSmile, lang),
        pFlat: fmtPips(pFlat, lang),
      }),
      value: t('sb.pips', { v: fmtPips(pSmile - pFlat, lang, 1, true) }),
    };
  };

  /* ---------- annotation geometry ---------- */
  const fs = `${L.font}px`;
  const clipId = `sb-clip-${uid}`;
  const atmY = sy(geom.pillars.atm.vol);
  const midY = sy(geom.wingAverage);
  const showBf = Math.abs(atmY - midY) > 7;
  const xAtm = px('atm');
  const xPut = px('put25');
  const xCall = px('call25');
  const bfLabelLeft = xAtm + 70 > L.width - L.right;
  const deltaAxis = mix >= 0.5;
  const xTicks = deltaAxis
    ? DELTA_TICKS.map((d) => d.delta)
    : niceTicks(X_STRIKE[0], X_STRIKE[1], L.compact ? 4 : 7).filter((v) =>
        inside(v, X_STRIKE[0] + 1e-9, X_STRIKE[1] - 1e-9),
      );
  const deltaLabel = (v: number) => {
    const d = DELTA_TICKS.find((x) => inside(x.delta, v - 1e-9, v + 1e-9));
    return d ? t(`sb.tick.${d.key}`) : '';
  };
  const SHORT: Record<Pillar, 'p25' | 'atm' | 'c25'> = { put25: 'p25', atm: 'atm', call25: 'c25' };
  const pillarLabel = (k: Pillar) =>
    `${L.compact ? t(`sb.tick.${SHORT[k]}`) : t(`sb.pillar.${k}`)} ${pct(geom.pillars[k].vol)}`;

  /* label placement: BF label first, then each pillar label on its clearest side */
  const charW = L.font * 0.58;
  const boxOf = (tx: number, ty: number, w: number, anchor: Anchor): LabelBox => {
    const x0 = anchor === 'end' ? tx - w : anchor === 'middle' ? tx - w / 2 : tx;
    return { x0, x1: x0 + w, y0: ty - L.font, y1: ty + 3 };
  };
  const bfText = t('sb.bfLabel', { v: pct(qv.bf25, 2, true) });
  const bfSpot = {
    x: xAtm + (bfLabelLeft ? -10 : 10),
    y: (atmY + midY) / 2 + L.font * 0.35,
    anchor: (bfLabelLeft ? 'end' : 'start') as Anchor,
  };
  const placed: LabelBox[] = PILLARS.map((k) => {
    const x = px(k);
    const y = sy(geom.pillars[k].vol);
    return { x0: x - 9, x1: x + 9, y0: y - 9, y1: y + 9 };
  });
  if (showBf) placed.push(boxOf(bfSpot.x, bfSpot.y, bfText.length * charW, bfSpot.anchor));
  const labelSpots = {} as Record<Pillar, { x: number; y: number; anchor: Anchor }>;
  for (const k of ['put25', 'call25', 'atm'] as const) {
    const x = px(k);
    const y = sy(geom.pillars[k].vol);
    const w = pillarLabel(k).length * charW;
    const out: Anchor = k === 'put25' ? 'end' : 'start';
    const inn: Anchor = k === 'put25' ? 'start' : 'end';
    const dOut = k === 'put25' ? -11 : 11;
    const up = y - 12;
    const down = y + L.font + 12;
    const spots: Array<{ x: number; y: number; anchor: Anchor }> =
      k === 'atm'
        ? [
            { x, y: down, anchor: 'middle' },
            { x, y: up, anchor: 'middle' },
            { x: x + 12, y: down, anchor: 'start' },
            { x: x - 12, y: down, anchor: 'end' },
          ]
        : [
            { x: x + dOut, y: up, anchor: out },
            { x: x + dOut, y: down, anchor: out },
            { x: x - dOut, y: up, anchor: inn },
            { x: x - dOut, y: down, anchor: inn },
          ];
    const boxes = spots.map((sp) => boxOf(sp.x, sp.y, w, sp.anchor));
    const fits = boxes
      .map((b, i) => ({ b, i }))
      .filter(
        ({ b }) =>
          inside(b.x0, L.left, b.x1) &&
          inside(b.x1, b.x0, L.width - L.right) &&
          inside(b.y0, L.top, Infinity),
      );
    const pool = fits.length ? fits : boxes.map((b, i) => ({ b, i }));
    const pick =
      pool[
        pickLabelSpot(
          pool.map((p) => p.b),
          screen,
          [atmY, midY],
          placed,
        )
      ]!;
    labelSpots[k] = spots[pick.i]!;
    placed.push(pick.b);
  }

  return (
    <div
      class="sb"
      data-sb
      data-view={view}
      data-shape={shape}
      data-atm={q.atm.toFixed(4)}
      data-rr={q.rr25.toFixed(4)}
      data-bf={q.bf25.toFixed(4)}
    >
      <div class="ff-lab-head">
        <div class="sb-head-text">
          <div class="ff-lab-title">{t('sb.title')}</div>
          <div class="ff-lab-sub">
            {t('sb.sub', { pair: PAIR, months: EXAMPLE.months, forward: fmtRate(F, PAIR) })}
          </div>
        </div>
        <span class="ff-pill-note sb-example">{EXAMPLE_LABEL[lang]}</span>
      </div>

      <div class="ff-lab">
        <div class="ff-lab-main">
          <div class="sb-top">
            <Legend
              items={[
                {
                  label: t(view === 'delta' ? 'sb.lg.smileDelta' : 'sb.lg.smile'),
                  color: 'var(--ff-options)',
                  width: 3,
                },
                { label: t('sb.lg.flat'), color: 'var(--ff-payoff)', kind: 'dashed', width: 1.75 },
                { label: t('sb.lg.mid'), color: 'var(--ff-ink-2)', kind: 'dashed', width: 1.5 },
              ]}
            />
            <Segmented
              label={t('sb.view')}
              value={view}
              onChange={(v) => setView(v)}
              options={[
                { value: 'strike', label: t('sb.view.strike') },
                { value: 'delta', label: t('sb.view.delta') },
              ]}
            />
          </div>
          <div class="sb-aha-row" role="status" aria-live="polite">
            {shape !== 'smile' && (
              <span class="sb-aha" key={shape} data-aha={shape}>
                {t(`sb.aha.${shape}`)}
              </span>
            )}
          </div>
          <div ref={box}>
            <svg
              ref={svgRef}
              viewBox={`0 0 ${L.width} ${L.height}`}
              role="img"
              aria-label={aria}
              class="sb-svg"
            >
              <defs>
                <clipPath id={clipId}>
                  <rect
                    x={L.left}
                    y={L.top - 4}
                    width={L.width - L.left - L.right}
                    height={L.plotBottom - L.top + 8}
                  />
                </clipPath>
              </defs>
              <GridY
                y={sy}
                ticks={yTicks}
                x0={L.left}
                x1={L.width - L.right}
                format={(v) => pct(v, yDigits)}
                fontSize={L.font}
                axisAt={null}
              />

              {/* wing note: which side the market pays up for */}
              {wing !== 'none' && (
                <text
                  key={`wing-${wing}`}
                  class="sb-note"
                  x={wing === 'left' ? L.left + 8 : L.width - L.right - 8}
                  y={L.top + L.font + 2}
                  style={{
                    fontSize: fs,
                    fontWeight: 700,
                    fill: 'var(--ff-options-text)',
                    textAnchor: wing === 'left' ? 'start' : 'end',
                    ...halo,
                  }}
                >
                  {t(wing === 'left' ? 'sb.wing.left' : 'sb.wing.right')}
                </text>
              )}

              <g clip-path={`url(#${clipId})`}>
                {/* flat ATM reference */}
                <path
                  d={`M${L.left},${atmY.toFixed(1)}H${L.width - L.right}`}
                  style={{
                    fill: 'none',
                    stroke: 'var(--ff-payoff)',
                    strokeWidth: 1.75,
                    strokeDasharray: '6 6',
                  }}
                />
                {/* middle of the wings */}
                <path
                  d={`M${Math.min(xPut, xCall).toFixed(1)},${midY.toFixed(1)}H${Math.max(xPut, xCall).toFixed(1)}`}
                  style={{
                    fill: 'none',
                    stroke: 'var(--ff-ink-2)',
                    strokeWidth: 1.5,
                    strokeDasharray: '2 4',
                  }}
                />
                <path
                  d={curvePath}
                  data-curve
                  style={{
                    fill: 'none',
                    stroke: 'var(--ff-options)',
                    strokeWidth: 3,
                    strokeLinecap: 'round',
                    strokeLinejoin: 'round',
                  }}
                />
              </g>

              {/* butterfly: the gap between ATM and the middle of the wings */}
              {showBf && (
                <g class="sb-bf" data-bf-bracket>
                  <path
                    d={`M${xAtm - 5},${midY.toFixed(1)}H${xAtm + 5}M${xAtm},${midY.toFixed(1)}V${atmY.toFixed(1)}`}
                    style={{ fill: 'none', stroke: 'var(--ff-forward)', strokeWidth: 2 }}
                  />
                  <text
                    x={bfSpot.x}
                    y={bfSpot.y}
                    style={{
                      fontSize: fs,
                      fontWeight: 800,
                      fill: 'var(--ff-ink)',
                      textAnchor: bfSpot.anchor,
                      ...halo,
                    }}
                  >
                    {bfText}
                  </text>
                </g>
              )}

              {/* pillars: draggable */}
              {PILLARS.map((k) => {
                const x = px(k);
                const y = sy(geom.pillars[k].vol);
                const spot = labelSpots[k];
                const active = drag === k;
                return (
                  <g
                    key={k}
                    class={`sb-handle${active ? ' is-active' : ''}`}
                    data-pillar={k}
                    onPointerDown={onDown(k)}
                    onPointerMove={onMove}
                    onPointerUp={onUp}
                    onPointerCancel={onUp}
                  >
                    <rect
                      x={x - 22}
                      y={y - 22}
                      width={44}
                      height={44}
                      style={{ fill: 'transparent' }}
                    />
                    <circle
                      cx={x}
                      cy={y}
                      r={active ? 8.5 : 7}
                      style={{
                        fill: k === 'atm' ? 'var(--ff-forward)' : 'var(--ff-options)',
                        stroke: '#fff',
                        strokeWidth: 2.5,
                      }}
                    />
                    <text
                      x={spot.x}
                      y={spot.y}
                      style={{
                        fontSize: fs,
                        fontWeight: 700,
                        fill: 'var(--ff-ink)',
                        textAnchor: spot.anchor,
                        pointerEvents: 'none',
                        ...halo,
                      }}
                    >
                      {pillarLabel(k)}
                    </text>
                  </g>
                );
              })}

              <AxisX
                x={deltaAxis ? sxD : sxK}
                ticks={xTicks}
                y={L.height - 6}
                format={(v) => (deltaAxis ? deltaLabel(v) : fmtRate(v, PAIR, 2))}
                fontSize={L.font}
                title={deltaAxis ? t('sb.xDelta') : t('sb.xStrike', { pair: PAIR })}
              />
              <text
                x={L.left}
                y={L.top - 6}
                style={{ fontSize: fs, fontWeight: 600, fill: 'var(--ff-muted)' }}
              >
                {t('sb.y')}
              </text>
            </svg>
          </div>
          <p class="sb-hint">{t('sb.drag')}</p>
          <table class="sr-only">
            <caption>{t('sb.table')}</caption>
            <thead>
              <tr>
                <th scope="col">{t('sb.th.pillar')}</th>
                <th scope="col">{t('sb.th.strike')}</th>
                <th scope="col">{t('sb.th.delta')}</th>
                <th scope="col">{t('sb.th.vol')}</th>
              </tr>
            </thead>
            <tbody>
              {PILLARS.map((k) => (
                <tr key={k}>
                  <th scope="row">{t(`sb.pillar.${k}`)}</th>
                  <td>{fmtRate(tp[k].K, PAIR)}</td>
                  <td>{fmtNumber(tp[k].deltaFwd, lang, { digits: 2 })}</td>
                  <td>{pct(tp[k].vol)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div class="ff-lab-side">
          <Segmented
            label={t('sb.presets')}
            value={preset ?? ('custom' as Preset)}
            onChange={pick}
            options={PRESET_IDS.map((id) => ({ value: id, label: t(`sb.p.${id}`) }))}
          />
          <div class="panel" role="group" aria-label={t('sb.quotes')}>
            <Slider
              id={`sb-${uid}-atm`}
              label={t('sb.atm')}
              value={q.atm}
              min={SMILE_LIMITS.atm.min}
              max={SMILE_LIMITS.atm.max}
              step={SMILE_LIMITS.atm.step}
              valueText={pct(q.atm)}
              onInput={(v) => setQuote({ atm: v })}
            />
            <Slider
              id={`sb-${uid}-rr`}
              label={t('sb.rr')}
              value={q.rr25}
              min={SMILE_LIMITS.rr.min}
              max={SMILE_LIMITS.rr.max}
              step={SMILE_LIMITS.rr.step}
              valueText={pct(q.rr25, 2, true)}
              onInput={(v) => setQuote({ rr25: Math.abs(v) < 1e-9 ? 0 : v })}
            />
            <Slider
              id={`sb-${uid}-bf`}
              label={t('sb.bf')}
              value={q.bf25}
              min={SMILE_LIMITS.bf.min}
              max={SMILE_LIMITS.bf.max}
              step={SMILE_LIMITS.bf.step}
              valueText={pct(q.bf25, 2, true)}
              onInput={(v) => setQuote({ bf25: Math.abs(v) < 1e-9 ? 0 : v })}
            />
          </div>
          <StatTable>
            <StatRow
              label={t('sb.row.put25')}
              sub={t('sb.row.put25Sub', { k: fmtRate(tp.put25.K, PAIR) })}
              value={pct(tp.put25.vol)}
            />
            <StatRow
              label={t('sb.row.atm')}
              sub={t('sb.row.atmSub', { k: fmtRate(tp.atm.K, PAIR) })}
              value={pct(tp.atm.vol)}
            />
            <StatRow
              label={t('sb.row.call25')}
              sub={t('sb.row.call25Sub', { k: fmtRate(tp.call25.K, PAIR) })}
              value={pct(tp.call25.vol)}
            />
          </StatTable>
          <div class="sb-effect">
            <p class="sb-effect-title">{t('sb.effect')}</p>
            <StatTable>
              {(['put25', 'call25'] as const).map((k) => {
                const r = effRow(k);
                return (
                  <StatRow key={k} label={t(`sb.eff.${k}`)} sub={r.sub} value={r.value} highlight />
                );
              })}
            </StatTable>
          </div>
        </div>
      </div>
    </div>
  );
}
