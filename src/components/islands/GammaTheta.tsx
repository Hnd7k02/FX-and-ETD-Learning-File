/**
 * Gamma against theta (module 05, section 4): one-day P&L of the delta-hedged USD call,
 * ½ · Γ · [(ΔS)² − σ² · S² · Δt], as a parabola over the day's move.
 *
 * Drag the dot (or use the slider) to set the move; the shaded zones show where gamma earns more
 * than theta costs. The break-even lines sit at σ · S / √365, and the side panel turns the move
 * into a realised vol, so "realised above implied" becomes visible. Same look as the Greeks lab.
 * Maths: src/lib/greeksfigures.ts. Strings: src/i18n/dict/gammatheta.ts.
 */
import type { JSX } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Slider } from '@/components/ui/Slider';
import { StatHero, StatRow, StatTable } from '@/components/ui/Stat';
import { useElementWidth, usePrefersReducedMotion, useTween } from '@/components/ui/hooks';
import { gammatheta as dict } from '@/i18n/dict/gammatheta';
import { translator, type Lang } from '@/i18n/types';
import { clamp, scaleLinear, type Point } from '@/lib/chart';
import { EXAMPLE } from '@/lib/fx/example';
import { fmtMillions, fmtMoney, fmtNumber, fmtPctValue, fmtPips } from '@/lib/format';
import { placeCallout, yTicks } from '@/lib/greekslab';
import {
  GT_CONFIG,
  gammaTheta,
  gammaThetaCurve,
  gammaThetaDomain,
  gammaThetaZone,
} from '@/lib/greeksfigures';

export interface GammaThetaProps {
  lang: Lang;
}

const RATIO = 0.56;
const MIN_H = 250;

export default function GammaTheta({ lang }: GammaThetaProps): JSX.Element {
  const t = translator(dict, lang);
  const M = GT_CONFIG.move;
  const [move, setMove] = useState<number>(GT_CONFIG.defaults.movePips);
  const [volPct, setVolPct] = useState<number>(GT_CONFIG.defaults.volPct);
  const [dragging, setDragging] = useState(false);
  const [sliderDrag, setSliderDrag] = useState(false);
  const rm = usePrefersReducedMotion();
  const tw = useTween([move, volPct], 300, rm || dragging || sliderDrag);
  const mv = tw[0]!;
  const vp = tw[1]!;
  const n = useMemo(() => gammaTheta(mv, vp), [mv, vp]);
  const curve = useMemo(() => gammaThetaCurve(vp), [vp]);
  const target = useMemo(() => gammaThetaDomain(volPct), [volPct]);
  const dom = useTween(target.domain, 300, rm);
  const zone = gammaThetaZone(move, volPct);

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

  const box = useRef<HTMLDivElement>(null);
  const width = Math.max(260, Math.round(useElementWidth(box, 560)));
  const height = Math.max(MIN_H, Math.round(width * RATIO));
  const compact = width < 480;
  const left = 52;
  const right = 12;
  const top = 16;
  // the x-axis title sits under the tick labels, so it never covers the curve
  const bottom = height - 54;
  const x = scaleLinear([M.min, M.max], [left, width - right]);
  const y = scaleLinear([dom[0]!, dom[1]!], [bottom, top]);
  const xRef = useRef(x);
  xRef.current = x;

  const P = (pts: Point[]) =>
    pts.map(([a, b], i) => `${i ? 'L' : 'M'}${x(a).toFixed(1)},${y(b).toFixed(1)}`).join('');
  const be = n.breakEvenPips;
  const zeroY = y(0);
  const left0 = curve.filter(([m]) => m <= -be);
  const right0 = curve.filter(([m]) => m >= be);
  const mid = curve.filter(([m]) => m >= -be && m <= be);
  const area = (pts: Point[], from: number, to: number) =>
    pts.length ? `${P([[from, 0], ...pts, [to, 0]])}Z` : '';
  const cx = x(mv);
  const cy = clamp(y(n.pnlChf), top, bottom);

  /* ---------- drag ---------- */
  const drag = useRef<{ id: number; x: number; y: number; active: boolean } | null>(null);
  const setFrom = (e: PointerEvent, svg: SVGSVGElement) => {
    const r = svg.getBoundingClientRect();
    const vx = ((e.clientX - r.left) / Math.max(1, r.width)) * width;
    setMove(clamp(Math.round(xRef.current.invert(vx)), M.min, M.max));
  };
  const onDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const svg = e.currentTarget as SVGSVGElement;
    const r = svg.getBoundingClientRect();
    const k = r.width / width;
    const near = Math.hypot(e.clientX - (r.left + cx * k), e.clientY - (r.top + cy * k)) < 30;
    const active = e.pointerType !== 'touch' || near;
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, active };
    if (active) {
      svg.setPointerCapture?.(e.pointerId);
      setDragging(true);
      setFrom(e, svg);
    }
  };
  const onMove = (e: PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const svg = e.currentTarget as SVGSVGElement;
    if (!d.active) {
      const dx = Math.abs(e.clientX - d.x);
      if (dx < 8 || dx < Math.abs(e.clientY - d.y)) return;
      d.active = true;
      svg.setPointerCapture?.(e.pointerId);
      setDragging(true);
    }
    setFrom(e, svg);
  };
  const onUp = (e: PointerEvent) => {
    if (drag.current?.id !== e.pointerId) return;
    drag.current = null;
    setDragging(false);
  };

  /* ---------- texts ---------- */
  const notional = fmtMillions(EXAMPLE.notional, EXAMPLE.base, lang);
  const chf = (v: number, digits = 0, sign = true) =>
    fmtMoney(v, EXAMPLE.quote, lang, digits, sign);
  const pipsText = (v: number) => fmtPips(v, lang, 0, true);
  const beText = fmtPips(be, lang, 1);
  const ticks = yTicks([dom[0]!, dom[1]!], target.step);
  const xt = compact ? [-100, 0, 100] : [-100, -50, 0, 50, 100];

  // annotation next to the dot
  const l1 = t(`gt.aha.${zone}.t`);
  const l2 = t(`gt.aha.${zone}.d`);
  const w = Math.ceil(Math.max(l1.length * 7.1, l2.length * 6.3)) + 20;
  const obstacles: Point[] = curve.map(([a, b]) => [x(a), y(b)]);
  for (let px = x(-be) - 40; px <= x(be) + 40; px += 8) obstacles.push([px, top + 10]);
  const b = placeCallout(
    [cx, cy],
    { w, h: 44 },
    { x0: left + 2, x1: width - right - 2, y0: top + 24, y1: bottom - 2 },
    obstacles,
    14,
  );

  return (
    <div class="gt" data-gammatheta data-zone={zone}>
      <div class="ff-lab-head">
        <div class="gl-titles">
          <div class="ff-lab-title">{t('gt.title')}</div>
          <div class="ff-lab-sub">{t('gt.sub', { option: t('gt.option'), notional })}</div>
        </div>
      </div>
      <div class="ff-lab">
        <div class="ff-lab-main gl-main" ref={box}>
          <div class="gl-head">
            <span class="gl-legend">
              <span class="gl-legend-item">
                <span aria-hidden="true" class="gl-swatch" />
                {t('gt.head')}
              </span>
            </span>
          </div>
          <div class="gl-chart" style={{ height: `max(${MIN_H}px, ${RATIO * 100}cqw)` }}>
            <svg
              viewBox={`0 0 ${width} ${height}`}
              role="img"
              aria-label={t('gt.aria', {
                be: beText,
                move: pipsText(move),
                pnl: chf(gammaTheta(move, volPct).pnlChf),
              })}
              class={`gl-svg${dragging ? ' is-dragging' : ''}`}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
              onLostPointerCapture={onUp}
            >
              <defs>
                <clipPath id="gt-clip">
                  <rect
                    x={left}
                    y={top - 4}
                    width={width - right - left}
                    height={bottom - top + 8}
                  />
                </clipPath>
              </defs>
              {ticks.map((v) => (
                <g key={`y${v}`}>
                  <path
                    d={`M${left},${y(v).toFixed(1)}H${width - right}`}
                    class={Math.abs(v) < 1e-9 ? 'gl-axis' : 'gl-grid'}
                  />
                  <text x={left - 8} y={y(v) + 4} class="gl-tick" text-anchor="end">
                    {fmtNumber(v, lang)}
                  </text>
                </g>
              ))}
              <g clip-path="url(#gt-clip)">
                <path d={area(left0, M.min, -be)} class="gt-gain" />
                <path d={area(right0, be, M.max)} class="gt-gain" />
                <path d={area(mid, -be, be)} class="gt-loss" />
                <path d={P(curve)} class="gl-curve" style={{ stroke: 'var(--ff-long)' }} />
              </g>
              {[-be, be].map((v) => (
                <g key={`be${v > 0 ? 'p' : 'm'}`}>
                  <path d={`M${x(v).toFixed(1)},${top}V${bottom}`} class="gl-ref" />
                  <text
                    x={x(v) + (v > 0 ? 6 : -6)}
                    y={zeroY - 8}
                    class="gl-ref-label"
                    text-anchor={v > 0 ? 'start' : 'end'}
                  >
                    {fmtPips(v, lang, 1, true)}
                  </text>
                </g>
              ))}
              <text x={x(0)} y={top + 12} class="gl-ref-label" text-anchor="middle">
                {t('gt.breakEven')}
              </text>
              <path d={`M${cx.toFixed(1)},${top}V${bottom}`} class="gl-guide" />
              {dragging && <circle cx={cx} cy={cy} r={16} class="gl-halo" />}
              <circle cx={cx} cy={cy} r={dragging ? 8 : 6} class="gl-dot" />
              {xt.map((v) => (
                <text key={`x${v}`} x={x(v)} y={height - 32} class="gl-tick" text-anchor="middle">
                  {fmtNumber(v, lang, { sign: true })}
                </text>
              ))}
              <text x={width - right} y={height - 8} class="gl-axis-title" text-anchor="end">
                {t('gt.axisX')}
              </text>
              <g class="gl-aha" data-aha={zone}>
                <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={10} class="gl-aha-box" />
                <text x={b.x + 10} y={b.y + 18} class="gl-aha-title">
                  {l1}
                </text>
                <text x={b.x + 10} y={b.y + 35} class="gl-aha-text">
                  {l2}
                </text>
              </g>
            </svg>
          </div>
        </div>

        <div class="ff-lab-side">
          <div class="panel" onPointerDown={() => setSliderDrag(true)}>
            <Slider
              id="gt-move"
              label={t('gt.slider.move')}
              value={move}
              {...M}
              valueText={t('gt.movePips', { v: pipsText(move) })}
              onInput={(v) => setMove(v)}
            />
            <Slider
              id="gt-vol"
              label={t('gt.slider.vol')}
              value={volPct}
              {...GT_CONFIG.vol}
              valueText={fmtPctValue(volPct, lang, 1)}
              onInput={(v) => setVolPct(v)}
            />
          </div>
          <StatTable>
            <StatHero
              label={t('gt.net')}
              value={chf(n.pnlChf)}
              sub={t('gt.netSub', { notional })}
            />
            <StatRow
              symbol="Γ"
              label={t('gt.gain')}
              sub={t('gt.gainSub')}
              value={chf(n.gammaGainChf)}
            />
            <StatRow
              symbol={
                <>
                  Θ<sub>Γ</sub>
                </>
              }
              label={t('gt.theta')}
              sub={t('gt.thetaSub')}
              value={chf(n.thetaGammaChf)}
            />
            <StatRow
              symbol="±"
              label={t('gt.be')}
              sub={t('gt.beSub')}
              value={t('gt.bePips', { v: beText })}
              highlight
            />
            <StatRow
              symbol="σ"
              label={t('gt.realised')}
              sub={t('gt.realisedSub')}
              value={fmtPctValue(n.realisedVol * 100, lang, 1)}
              highlight
            />
          </StatTable>
        </div>
      </div>
      <p class="sr-only" data-summary>
        {t('gt.summary', {
          move: pipsText(move),
          vol: fmtPctValue(volPct, lang, 1),
          gain: chf(gammaTheta(move, volPct).gammaGainChf),
          theta: chf(gammaTheta(move, volPct).thetaGammaChf),
          pnl: chf(gammaTheta(move, volPct).pnlChf),
          be: beText,
          real: fmtPctValue(gammaTheta(move, volPct).realisedVol * 100, lang, 1),
        })}
      </p>
      <div class="sr-only" aria-live="polite" aria-atomic="true">
        {move !== GT_CONFIG.defaults.movePips ? `${l1}: ${l2}` : ''}
      </div>
    </div>
  );
}
