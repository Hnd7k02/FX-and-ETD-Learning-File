/**
 * ForwardCurve (module 02, section 3): forward points of USD/CHF for the tenors 1W … 1Y, each
 * split into "Forward = Spot + Cost − Benefit" as a small waterfall: the cost of the CHF you pay
 * with (quote rate, orange) goes up, the interest on the USD you would hold (base rate, blue)
 * comes off, the black dot is what is left: the forward points. Presets and sliders move both
 * rates; the bars morph. Swap the rates and the points change sign although nobody changed a
 * view on the dollar: a forward is not a forecast.
 * Maths in src/lib/m02/curve.ts (forwardCarry of the core), strings in src/i18n/dict/forwardcurve.ts.
 */
import type { JSX } from 'preact';
import { useId, useRef, useState } from 'preact/hooks';
import { GridY } from '@/components/ui/Chart';
import { Legend } from '@/components/ui/Legend';
import { Segmented } from '@/components/ui/Segmented';
import { Slider } from '@/components/ui/Slider';
import { StatRow, StatTable } from '@/components/ui/Stat';
import { useElementWidth, usePrefersReducedMotion, useTween } from '@/components/ui/hooks';
import { forwardcurve as dict } from '@/i18n/dict/forwardcurve';
import { translator, type Lang } from '@/i18n/types';
import { clamp, linePath, niceTicks, scaleLinear } from '@/lib/chart';
import { fmtNumber, fmtPct, fmtPips, fmtRate } from '@/lib/format';
import { M02_CONFIG, PIP } from '@/lib/m02/config';
import {
  curveDomain,
  forwardCurve,
  matchPreset,
  nearestTenor,
  premiumWording,
  visibleLabels,
} from '@/lib/m02/curve';
import { textWidth } from '@/lib/m02/text';
import { useDragX, useSliderDrag } from './m02-shared';

export interface ForwardCurveProps {
  lang: Lang;
}

const M = M02_CONFIG.market;
const CC = M02_CONFIG.curve;
const PAIR = M.pair;
const FD = M02_CONFIG.forwardDigits;
const TENORS = CC.tenors;
const START = Math.max(
  0,
  TENORS.findIndex((t) => t.id === CC.defaultTenor),
);
const START_WORDING = premiumWording(
  forwardCurve({
    spot: M.spot,
    rd: M.rd,
    rf: M.rf,
    basisQuote: M.basisQuote,
    basisBase: M.basisBase,
  })[START]!.points,
);

/** Colour semantics: cost (CHF financing, short) orange, benefit (USD held, long) blue, points black. */
const COLOR = {
  cost: 'var(--ff-short)',
  benefit: 'var(--ff-long)',
  points: 'var(--ff-forward)',
} as const;

function layoutFor(w: number) {
  const width = Math.max(300, Math.round(w));
  const compact = width < 560;
  const height = compact ? 300 : Math.round(clamp(width * 0.6, 330, 390));
  const font = compact ? 11 : 12;
  const left = compact ? 40 : 50;
  const right = compact ? 8 : 14;
  const top = 34;
  const bottom = height - 30;
  const half = compact ? 5 : 8;
  return { width, height, compact, font, left, right, top, bottom, half };
}

export default function ForwardCurve({ lang }: ForwardCurveProps): JSX.Element {
  const t = translator(dict, lang);
  const uid = useId().replace(/[^A-Za-z0-9_-]/g, '');
  const rm = usePrefersReducedMotion();
  const box = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const L = layoutFor(useElementWidth(box, 600));

  const [rd, setRd] = useState<number>(M.rd);
  const [rf, setRf] = useState<number>(M.rf);
  const [sel, setSel] = useState<number>(START);
  const [sliding, onSlide] = useSliderDrag();

  const market = { spot: M.spot, rd, rf, basisQuote: M.basisQuote, basisBase: M.basisBase };
  const pts = forwardCurve(market, TENORS);
  const cur = pts[sel]!;
  const wording = cur.wording;
  const aha = wording !== START_WORDING;

  const [lo0, hi0] = curveDomain(pts, 50);
  const span = hi0 - lo0;
  const domain: [number, number] = [lo0 - span * 0.2, hi0 + span * 0.14];
  const instant = rm || sliding;
  const tw = useTween(
    [...pts.flatMap((p) => [p.costPips, p.benefitPips]), domain[0], domain[1]],
    300,
    instant,
  );
  const n = pts.length;
  const costs = pts.map((_, i) => tw[2 * i]!);
  const benefits = pts.map((_, i) => tw[2 * i + 1]!);
  const nets = costs.map((c, i) => c - benefits[i]!);
  const dom: [number, number] = [tw[2 * n]!, tw[2 * n + 1]!];

  const sx = scaleLinear([-14, 365 + 14], [L.left, L.width - L.right]);
  const sy = scaleLinear(dom, [L.bottom, L.top]);
  const drag = useDragX(svgRef, L.width, (vx) => setSel(nearestTenor(sx.invert(vx), TENORS)));

  const pips = (x: number, sign = true) => fmtPips(x, lang, 1, sign);
  const pct = (x: number, digits = 2, sign = false) => fmtPct(x, lang, digits, sign);
  /** Rate difference with sign and the forward's decimals, e.g. "−0.00694". */
  const signed = (x: number) => fmtNumber(x, lang, { digits: FD, sign: true });
  const fs = `${L.font}px`;
  const xs = TENORS.map((tn) => sx(tn.days));
  const keep = new Set(visibleLabels(xs, L.font * 2.6));
  const yTicks = niceTicks(dom[0], dom[1], L.compact ? 4 : 6).filter(
    (v) => v >= dom[0] && v <= dom[1],
  );

  const netLine = linePath([
    [sx(0), sy(0)],
    ...TENORS.map((tn, i) => [sx(tn.days), sy(nets[i]!)] as [number, number]),
  ]);

  // Selected tenor label: on the side of the zero line away from the bars, clamped to the plot.
  const xSel = xs[sel]!;
  const bandX = useTween(xSel, 300, rm || drag.dragging);
  const netSel = nets[sel]!;
  const lowEnd = Math.min(0, costs[sel]!, netSel);
  const highEnd = Math.max(0, costs[sel]!, netSel);
  const barsBelow = Math.abs(lowEnd) >= Math.abs(highEnd);
  const labelY = barsBelow ? sy(highEnd) - L.font - 16 : sy(lowEnd) + L.font + 10;
  const selText = t('fc.sel', { tenor: cur.id, points: pips(cur.points) });
  const selFwd = t('fc.selFwd', { fwd: fmtRate(cur.forward, PAIR, FD) });
  const labelW = Math.max(textWidth(selText, L.font + 1), textWidth(selFwd, L.font, 0.62));
  const labelX = clamp(xSel, L.left + labelW / 2 + 2, L.width - L.right - labelW / 2 - 2);

  const chipKey =
    wording === 'premium'
      ? 'fc.chip.premium'
      : wording === 'discount'
        ? 'fc.chip.discount'
        : 'fc.chip.flat';
  const insightKey =
    wording === 'premium'
      ? 'fc.insight.premium'
      : wording === 'discount'
        ? 'fc.insight.discount'
        : 'fc.insight.flat';
  const preset = matchPreset(rd, rf);
  const choosePreset = (id: string) => {
    const p = CC.presets.find((x) => x.id === id);
    if (!p) return;
    setRd(p.rd);
    setRf(p.rf);
  };

  const aria = t('fc.aria', {
    rd: pct(rd),
    rf: pct(rf),
    list: pts.map((p) => t('fc.ariaItem', { tenor: p.id, points: pips(p.points) })).join(', '),
    tenor: cur.id,
    fwd: fmtRate(cur.forward, PAIR, FD),
  });

  return (
    <div class="m2 fc" data-fc data-wording={wording} data-tenor={cur.id}>
      <div class="ff-lab-head">
        <div class="m2-titles">
          <div class="ff-lab-title">{t('fc.title')}</div>
          <div class="ff-lab-sub">{t('fc.sub', { spot: fmtRate(M.spot, PAIR) })}</div>
        </div>
        <span
          class={`m2-chip ${wording === 'discount' ? 'is-blue' : wording === 'premium' ? 'is-warn' : ''}`}
          data-chip
        >
          {t(chipKey)}
        </span>
      </div>
      <div class="ff-lab">
        <div class="ff-lab-main">
          <Legend
            items={[
              { label: t('fc.legend.cost'), color: COLOR.cost, kind: 'area' },
              { label: t('fc.legend.benefit'), color: COLOR.benefit, kind: 'area' },
              { label: t('fc.legend.points'), color: COLOR.points, width: 3 },
            ]}
          />
          <div ref={box}>
            <svg
              ref={svgRef}
              viewBox={`0 0 ${L.width} ${L.height}`}
              role="img"
              aria-label={aria}
              class={`m2-svg fc-svg${drag.dragging ? ' is-dragging' : ''}`}
              {...drag.handlers}
            >
              <text x={L.left} y={L.top - 18} class="m2-axis-title" style={{ fontSize: fs }}>
                {t('fc.y')}
              </text>
              {/* selected tenor band */}
              <rect
                x={bandX - L.half * 2 - 6}
                y={L.top}
                width={L.half * 4 + 12}
                height={L.bottom - L.top}
                rx={8}
                class="fc-band"
              />
              <GridY
                y={sy}
                ticks={yTicks}
                x0={L.left}
                x1={L.width - L.right}
                format={(v) => (Math.abs(v) < 1e-9 ? t('fc.spot') : fmtPips(v, lang, 0, true))}
                fontSize={L.font}
              />
              {!L.compact && (
                <text
                  x={L.width - L.right - 4}
                  y={L.top + 4}
                  class="fc-note"
                  style={{ fontSize: fs, textAnchor: 'end' }}
                >
                  {t('fc.notForecast')}
                </text>
              )}

              {/* waterfall bars: cost up from 0 (left), benefit down from cost (right) */}
              {TENORS.map((tn, i) => {
                const x = xs[i]!;
                const c = costs[i]!;
                const net = nets[i]!;
                const yc0 = sy(Math.max(0, c));
                const yc1 = sy(Math.min(0, c));
                const yb0 = sy(Math.max(c, net));
                const yb1 = sy(Math.min(c, net));
                return (
                  <g key={tn.id} class={`fc-bars${i === sel ? ' is-sel' : ''}`}>
                    <rect
                      x={x - 2 * L.half}
                      y={yc0}
                      width={2 * L.half - 1}
                      height={Math.max(0, yc1 - yc0)}
                      rx={2}
                      fill={COLOR.cost}
                    />
                    <path
                      d={`M${x - 2 * L.half},${sy(c).toFixed(1)}H${x + 2 * L.half}`}
                      class="fc-step"
                    />
                    <rect
                      x={x + 1}
                      y={yb0}
                      width={2 * L.half - 1}
                      height={Math.max(0, yb1 - yb0)}
                      rx={2}
                      fill={COLOR.benefit}
                    />
                  </g>
                );
              })}

              {/* forward points line and dots */}
              <path
                d={netLine}
                class="m2-line"
                style={{ stroke: COLOR.points, strokeWidth: 2.25 }}
              />
              <circle cx={sx(0)} cy={sy(0)} r={4.5} class="fc-spot" />
              {TENORS.map((tn, i) => (
                <circle
                  key={tn.id}
                  cx={xs[i]}
                  cy={sy(nets[i]!)}
                  r={i === sel ? 6 : 4}
                  class={`fc-dot${i === sel ? ' is-sel' : ''}`}
                />
              ))}

              {/* selected label */}
              <g class="fc-label" style={{ textAnchor: 'middle' }}>
                <text
                  x={labelX}
                  y={labelY}
                  style={{ fontSize: `${L.font + 1}px` }}
                  class="fc-label-main"
                >
                  {selText}
                </text>
                <text
                  x={labelX}
                  y={labelY + L.font + 4}
                  style={{ fontSize: fs }}
                  class="fc-label-sub"
                >
                  {selFwd}
                </text>
              </g>

              {/* x labels */}
              {TENORS.map((tn, i) =>
                keep.has(i) || i === sel ? (
                  <text
                    key={tn.id}
                    x={xs[i]}
                    y={L.height - 8}
                    class={`fc-xlabel${i === sel ? ' is-sel' : ''}`}
                    style={{ fontSize: fs }}
                  >
                    {tn.id}
                  </text>
                ) : null,
              )}
              {/* invisible hit area so a tap anywhere picks the nearest tenor */}
              <rect
                x={L.left}
                y={L.top}
                width={L.width - L.left - L.right}
                height={L.height - L.top}
                class="m2-hit"
              />
            </svg>
          </div>
          <div class={`m2-insight${aha ? ' is-aha' : ''}`} data-insight>
            {aha && <b>{t('fc.aha.title')}</b>}
            <span>{aha ? `${t(insightKey)} ${t('fc.aha.text')}` : t(insightKey)}</span>
          </div>
          <p class="m2-hint">{t('fc.hint')}</p>
          <table class="sr-only">
            <caption>{t('fc.table')}</caption>
            <thead>
              <tr>
                <th scope="col">{t('fc.th.tenor')}</th>
                <th scope="col">{t('fc.th.cost')}</th>
                <th scope="col">{t('fc.th.benefit')}</th>
                <th scope="col">{t('fc.th.points')}</th>
                <th scope="col">{t('fc.th.fwd')}</th>
              </tr>
            </thead>
            <tbody>
              {pts.map((p) => (
                <tr key={p.id}>
                  <th scope="row">{p.id}</th>
                  <td>{pips(p.costPips)}</td>
                  <td>{pips(-p.benefitPips)}</td>
                  <td>{pips(p.points)}</td>
                  <td>{fmtRate(p.forward, PAIR, FD)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div class="ff-lab-side">
          <div class="panel m2-controls">
            <div class="m2-field m2-seg-fill">
              <span class="field-label" aria-hidden="true">
                {t('fc.presets')}
              </span>
              <Segmented
                label={t('fc.presets')}
                value={preset ?? ''}
                options={CC.presets.map((p) => ({
                  value: p.id,
                  label: t(`fc.preset.${p.id}` as 'fc.preset.example'),
                }))}
                onChange={choosePreset}
              />
            </div>
            <div onPointerDown={onSlide} class="m2-sliders">
              <Slider
                id={`fc-rd-${uid}`}
                label={t('fc.slider.rd')}
                value={rd}
                min={CC.rateRange[0]}
                max={CC.rateRange[1]}
                step={CC.rateStep}
                valueText={pct(rd)}
                onInput={setRd}
              />
              <Slider
                id={`fc-rf-${uid}`}
                label={t('fc.slider.rf')}
                value={rf}
                min={CC.rateRange[0]}
                max={CC.rateRange[1]}
                step={CC.rateStep}
                valueText={pct(rf)}
                onInput={setRf}
              />
            </div>
            <Slider
              id={`fc-tenor-${uid}`}
              label={t('fc.tenor')}
              value={sel}
              min={0}
              max={TENORS.length - 1}
              step={1}
              valueText={cur.id}
              onInput={(v) => setSel(clamp(Math.round(v), 0, TENORS.length - 1))}
            />
          </div>

          <div class="m2-eq-head">{t('fc.eq.title', { tenor: cur.id })}</div>
          <StatTable>
            <StatRow
              label={t('fc.eq.spot')}
              sub={t('fc.eq.spotSub')}
              value={fmtRate(M.spot, PAIR, FD)}
            />
            <StatRow
              symbol={<span aria-hidden="true" class="m2-sq" style={{ background: COLOR.cost }} />}
              label={t('fc.eq.cost')}
              sub={t('fc.eq.costSub', { pips: pips(cur.costPips) })}
              value={signed(cur.costPips * PIP)}
            />
            <StatRow
              symbol={
                <span aria-hidden="true" class="m2-sq" style={{ background: COLOR.benefit }} />
              }
              label={t('fc.eq.benefit')}
              sub={t('fc.eq.benefitSub', { pips: pips(-cur.benefitPips) })}
              value={signed(-cur.benefitPips * PIP)}
            />
            <StatRow
              label={t('fc.eq.fwd')}
              sub={t('fc.eq.fwdSub', { points: pips(cur.points), days: cur.days })}
              value={fmtRate(cur.forward, PAIR, FD)}
              highlight
            />
          </StatTable>
          <div class="m2-box" data-prem>
            <dl class="m2-dl">
              <div>
                <dt>{cur.premiumPa < 0 ? t('fc.prem.labelNeg') : t('fc.prem.label')}</dt>
                <dd class="mono">{pct(cur.premiumPa, 2, true)}</dd>
              </div>
            </dl>
            <span class="m2-small">{t('fc.prem.sub', { diff: pct(rd - rf, 2, true) })}</span>
          </div>
          <div class="sr-only" aria-live="polite" aria-atomic="true">
            {`${t(chipKey)}. ${selText}, ${selFwd}.`}
          </div>
        </div>
      </div>
    </div>
  );
}
