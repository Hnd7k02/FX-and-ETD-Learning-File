/**
 * Wow moment (MASTER_PROMPT §8.1): four phases on the same axes, forward → call → time value →
 * put-call parity. Faithful to docs/design/WowChart.dc.html; maths in src/lib/wow.ts.
 *
 * Animation state lives in a ref and is rendered once per frame (requestAnimationFrame), like the
 * prototype's setState loop. Autoplay pauses off-screen and in hidden tabs; prefers-reduced-motion
 * disables autoplay and the morph. Strings come from src/i18n/dict/wow.ts.
 */
import type { JSX } from 'preact';
import { useEffect, useReducer, useRef } from 'preact/hooks';
import { AxisX, GridY, RefLineX } from '@/components/ui/Chart';
import { Legend, type LegendItem } from '@/components/ui/Legend';
import { Slider } from '@/components/ui/Slider';
import { useElementWidth, useInView } from '@/components/ui/hooks';
import { wow as dict } from '@/i18n/dict/wow';
import { translator, type Lang } from '@/i18n/types';
import { clamp, easeInOutCubic } from '@/lib/chart';
import { EXAMPLE, EXAMPLE_FORWARD, EXAMPLE_STRIKE } from '@/lib/fx/example';
import { fmtNumber, fmtPct, fmtPips, fmtRate } from '@/lib/format';
import {
  DAYS_MAX,
  DAYS_TARGET,
  HEIGHT_RATIO,
  MIN_HEIGHT,
  MORPH_MS,
  PHASES,
  PHASE_MS,
  clockDays,
  daysLabelKind,
  forwardPointsRounded,
  frame,
  layoutFor,
  scalesFor,
  xTicks,
  yTicks,
  type Phase,
} from '@/lib/wow';

export interface WowChartProps {
  lang: Lang;
}

interface Anim {
  phase: Phase;
  prev: Phase;
  /** Morph progress 0..1. */
  t: number;
  /** Days to expiry (float while the clock runs, integer from the slider). */
  days: number;
  /** Autoplay wanted by the user (may still be paused off-screen). */
  playing: boolean;
  /** Progress of the current phase 0..1 (progress bar). */
  prog: number;
  /** Milliseconds into the current phase. */
  elapsed: number;
  last: number;
  rm: boolean;
  /** True after the first click or slider move: captions are then announced politely. */
  interacted: boolean;
}

const KEYS = ['1', '2', '3', '4'] as const;
const PROGRESS_COLOR = '#60a5fa';

export default function WowChart({ lang }: WowChartProps): JSX.Element {
  const t = translator(dict, lang);
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const a = useRef<Anim>({
    phase: 0,
    prev: 0,
    t: 1,
    days: DAYS_TARGET,
    playing: true,
    prog: 0,
    elapsed: 0,
    last: 0,
    rm: false,
    interacted: false,
  });
  const raf = useRef<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const width = useElementWidth(box, 1000);
  const inView = useInView(box);
  const inViewRef = useRef(true);
  inViewRef.current = inView;
  const hiddenRef = useRef(false);

  const running = () => a.current.playing && inViewRef.current && !hiddenRef.current;

  const tick = (now: number) => {
    const s = a.current;
    const dt = clamp(now - s.last, 0, 100);
    s.last = now;
    let changed = false;
    if (s.t < 1) {
      s.t = Math.min(1, s.t + dt / MORPH_MS);
      changed = true;
    }
    const run = running();
    if (run) {
      s.elapsed += dt;
      const dur = PHASE_MS[s.phase]!;
      s.prog = Math.min(1, s.elapsed / dur);
      if (s.phase === 2) s.days = clockDays(s.elapsed);
      changed = true;
      if (s.elapsed >= dur) {
        const next = ((s.phase + 1) % 4) as Phase;
        s.prev = s.phase;
        s.phase = next;
        s.t = s.rm ? 1 : 0;
        s.elapsed = 0;
        s.prog = 0;
        if (next === 2) s.days = DAYS_MAX;
      }
    }
    if (changed) rerender();
    raf.current = run || s.t < 1 ? requestAnimationFrame(tick) : null;
  };

  const kick = () => {
    if (raf.current !== null || typeof requestAnimationFrame === 'undefined') return;
    a.current.last = performance.now();
    raf.current = requestAnimationFrame(tick);
  };

  useEffect(() => {
    const s = a.current;
    let rm = false;
    try {
      rm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      rm = false;
    }
    s.rm = rm;
    if (rm) {
      s.playing = false;
      rerender();
    }
    const onVis = () => {
      hiddenRef.current = document.hidden;
      if (!document.hidden) kick();
    };
    document.addEventListener('visibilitychange', onVis);
    kick();
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      if (raf.current !== null) cancelAnimationFrame(raf.current);
      raf.current = null;
    };
  }, []);

  useEffect(() => {
    if (inView) kick();
  }, [inView]);

  const go = (p: Phase) => {
    const s = a.current;
    s.interacted = true;
    s.playing = false;
    s.prog = 0;
    s.elapsed = 0;
    if (p !== s.phase) {
      s.prev = s.phase;
      s.phase = p;
      s.t = s.rm ? 1 : 0;
    }
    rerender();
    kick();
  };

  const togglePlay = () => {
    const s = a.current;
    s.interacted = true;
    if (s.playing) {
      s.playing = false;
      s.prog = 0;
    } else {
      s.playing = true;
      s.elapsed = 0;
      s.prog = 0;
    }
    rerender();
    kick();
  };

  const onDays = (v: number) => {
    const s = a.current;
    s.interacted = true;
    s.days = clamp(v, 0, DAYS_MAX);
    s.playing = false;
    s.prog = 0;
    rerender();
  };

  /* ---------- derived values for this frame ---------- */
  const s = a.current;
  const e = easeInOutCubic(s.t);
  const T = s.days / DAYS_MAX;
  const layout = layoutFor(width);
  const sc = scalesFor(layout);
  const f = frame(s.prev, s.phase, e, T, sc);
  const k = KEYS[s.phase]!;
  const pair = EXAMPLE.pair;
  const compact = layout.compact;

  const title = t(`wow.title${k}`);
  const text = t(`wow.text${k}`, {
    base: EXAMPLE.base,
    quote: EXAMPLE.quote,
    pips: fmtPips(forwardPointsRounded(), lang, 0),
  });
  const kpi = t(`wow.kpi${k}`);
  const example = t('wow.example', {
    pair,
    spot: fmtRate(EXAMPLE.spot, pair),
    months: EXAMPLE.months,
    forward: fmtRate(EXAMPLE_FORWARD, pair),
    vol: fmtPct(EXAMPLE.vol, lang, 0),
  });
  const strikeText = fmtRate(EXAMPLE_STRIKE, pair);
  const tvText = t('wow.tv', { pips: fmtPips(f.tvPips, lang, 0) });
  const kind = daysLabelKind(s.days);
  const daysText =
    kind === 'expiry'
      ? t('wow.daysExpiry')
      : kind === 'year'
        ? t('wow.daysYear')
        : kind === 'months3'
          ? t('wow.days3m')
          : t('wow.daysN', { n: fmtNumber(Math.round(s.days), lang) });
  const xLabel = t(s.phase === 2 ? 'wow.xForward' : 'wow.xExpiry', { pair });
  const ariaLabel = t('wow.aria', { pair, title });
  const summary =
    t('wow.summary', { n: s.phase + 1, text }) +
    (s.phase === 2 ? ' ' + t('wow.ariaTv', { days: daysText, pips: fmtPips(f.tvPips, lang, 0) }) : '');

  const legends: Record<Phase, LegendItem[]> = {
    0: [{ label: t('wow.legend.forwardPnl'), color: 'var(--ff-forward)' }],
    1: [
      { label: t('wow.legend.longCallExpiry'), color: 'var(--ff-long)' },
      { label: t('wow.legend.forwardCompare'), color: 'var(--ff-forward)', kind: 'dashed', width: 2 },
    ],
    2: [
      { label: t('wow.legend.valueBefore'), color: 'var(--ff-long)' },
      { label: t('wow.legend.payoff'), color: 'var(--ff-payoff)', kind: 'dashed', width: 2 },
      { label: t('wow.legend.timeValue'), color: 'var(--ff-timevalue)', kind: 'area' },
    ],
    3: [
      { label: t('wow.legend.longCall'), color: 'var(--ff-long)' },
      { label: t('wow.legend.shortPut'), color: 'var(--ff-short)' },
      { label: t('wow.legend.sum'), color: 'var(--ff-forward)' },
    ],
  };

  const stepLabels = [t('wow.step1'), t('wow.step2'), t('wow.step3'), t('wow.step4')];
  const fs = `${layout.font}px`;
  const w = f.weights;

  return (
    <div
      ref={box}
      data-wow
      data-phase={s.phase}
      data-playing={s.playing ? 'true' : 'false'}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        color: 'var(--ff-ink)',
        containerType: 'inline-size',
      }}
    >
      {/* steps + example + play/pause */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px 20px',
        }}
      >
        <div
          role="group"
          aria-label={t('wow.group')}
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 4,
            padding: 4,
            background: 'var(--ff-chip)',
            borderRadius: 999,
          }}
        >
          {PHASES.map((i) => {
            const on = s.phase === i;
            return (
              <button
                key={i}
                type="button"
                aria-pressed={on}
                data-step={i + 1}
                onClick={() => go(i)}
                style={{
                  position: 'relative',
                  overflow: 'hidden',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  minHeight: 44,
                  padding: compact ? '0 14px 0 6px' : '0 18px 0 8px',
                  border: 0,
                  borderRadius: 999,
                  fontFamily: 'inherit',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: on ? 'var(--ff-ink)' : 'transparent',
                  color: on ? '#fff' : 'var(--ff-ink-2)',
                  transition: 'background-color 200ms ease, color 200ms ease',
                }}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 26,
                    height: 26,
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 800,
                    background: '#fff',
                    color: 'var(--ff-ink)',
                  }}
                >
                  {i + 1}
                </span>
                <span>{stepLabels[i]}</span>
                <span
                  aria-hidden="true"
                  data-progress
                  style={{
                    position: 'absolute',
                    left: 0,
                    bottom: 0,
                    height: 3,
                    width: `${on && s.playing ? Math.round(s.prog * 100) : 0}%`,
                    background: PROGRESS_COLOR,
                  }}
                />
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <span style={{ fontSize: 13, color: 'var(--ff-muted)' }}>{example}</span>
          <button
            type="button"
            onClick={togglePlay}
            aria-label={s.playing ? t('wow.pause') : t('wow.play')}
            aria-pressed={s.playing}
            data-play
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 44,
              height: 44,
              flex: '0 0 44px',
              border: '1px solid var(--ff-line-input)',
              borderRadius: 999,
              background: '#fff',
              color: 'var(--ff-ink)',
              cursor: 'pointer',
            }}
          >
            {s.playing ? (
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                <path
                  d="M5 3.5V12.5M11 3.5V12.5"
                  style={{ fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' }}
                />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                <path
                  d="M5 3.2L12.5 8L5 12.8Z"
                  style={{
                    fill: 'currentColor',
                    stroke: 'currentColor',
                    strokeWidth: 1.5,
                    strokeLinejoin: 'round',
                  }}
                />
              </svg>
            )}
          </button>
        </div>
      </div>

      <Legend items={legends[s.phase]} />

      {/* chart box: height from the container width, so hydration causes no layout shift */}
      <div style={{ width: '100%', height: `max(${MIN_HEIGHT}px, ${HEIGHT_RATIO * 100}cqw)` }}>
        <svg
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          role="img"
          aria-label={ariaLabel}
          style={{
            display: 'block',
            width: '100%',
            height: '100%',
            overflow: 'visible',
            fontFamily: 'var(--ff-font-ui)',
          }}
        >
          <GridY
            y={sc.y}
            ticks={yTicks()}
            x0={sc.x0}
            x1={sc.x1}
            format={(v) => fmtPips(v, lang, 0, true)}
            fontSize={layout.font}
            labelX={sc.x0 - 10}
          />
          <text
            x={sc.x0}
            y={sc.y0 - 12}
            style={{ fontSize: fs, fontWeight: 600, fill: 'var(--ff-muted)' }}
          >
            {t('wow.yTitle')}
          </text>
          <RefLineX x={f.strikeX} y0={sc.y0} y1={sc.y1} />
          <text
            x={f.strikeX + 8}
            y={sc.y0 + layout.font + 5}
            style={{ fontSize: fs, fontWeight: 600, fill: 'var(--ff-ink-2)' }}
          >
            {compact ? (
              <>
                <tspan x={f.strikeX + 8}>{t('wow.strikeShort')}</tspan>
                <tspan x={f.strikeX + 8} dy={layout.font + 2}>
                  {strikeText}
                </tspan>
              </>
            ) : (
              t('wow.strike', { k: strikeText })
            )}
          </text>

          {w.timeValue > 0 && (
            <>
              <path
                d={f.area}
                style={{ fill: 'var(--ff-long)', fillOpacity: 0.1, stroke: 'none', opacity: w.timeValue }}
              />
              <path
                d={f.pay}
                style={{
                  fill: 'none',
                  stroke: 'var(--ff-payoff)',
                  strokeWidth: 1.75,
                  strokeDasharray: '6 6',
                  opacity: w.timeValue,
                }}
              />
            </>
          )}
          {w.ghost > 0 && (
            <path
              d={f.ghost}
              style={{
                fill: 'none',
                stroke: 'var(--ff-forward)',
                strokeWidth: 1.75,
                strokeDasharray: '6 6',
                opacity: w.ghost,
              }}
            />
          )}
          {w.parity > 0 && (
            <>
              <path
                d={f.longCall}
                style={{
                  fill: 'none',
                  stroke: 'var(--ff-long)',
                  strokeWidth: layout.stroke - 0.5,
                  strokeLinecap: 'round',
                  strokeLinejoin: 'round',
                  opacity: w.parity,
                }}
              />
              <path
                d={f.shortPut}
                style={{
                  fill: 'none',
                  stroke: 'var(--ff-short)',
                  strokeWidth: layout.stroke - 0.5,
                  strokeLinecap: 'round',
                  strokeLinejoin: 'round',
                  opacity: w.parity,
                }}
              />
            </>
          )}
          <path
            d={f.main}
            data-main
            style={{
              fill: 'none',
              stroke: f.mainBlue ? 'var(--ff-long)' : 'var(--ff-forward)',
              strokeWidth: layout.stroke,
              strokeLinecap: 'round',
              strokeLinejoin: 'round',
              transition: 'stroke 600ms ease',
            }}
          />
          {w.timeValue > 0 && (
            <g style={{ opacity: w.timeValue }}>
              <path
                d={`M${f.strikeX.toFixed(1)},${f.zeroY.toFixed(1)}V${f.tvY.toFixed(1)}`}
                style={{ fill: 'none', stroke: 'var(--ff-forward)', strokeWidth: 1.5 }}
              />
              <circle
                cx={f.strikeX}
                cy={f.tvY}
                r={6}
                style={{ fill: 'var(--ff-long)', stroke: '#fff', strokeWidth: 2.5 }}
              />
              <text
                x={f.strikeX + 14}
                y={f.tvY - 12}
                data-tv
                style={{ fontSize: `${layout.fontBig}px`, fontWeight: 700, fill: 'var(--ff-ink)' }}
              >
                {tvText}
              </text>
            </g>
          )}
          <AxisX
            x={sc.x}
            ticks={xTicks(layout)}
            y={layout.height - 12}
            format={(v) => fmtRate(v, pair, 2)}
            fontSize={layout.font}
            title={xLabel}
            titleX={sc.x1}
          />
        </svg>
      </div>
      <p class="sr-only" data-summary>
        {summary}
      </p>
      <div class="sr-only" aria-live={s.interacted ? 'polite' : 'off'} aria-atomic="true">
        {s.interacted ? `${title}. ${text}` : ''}
      </div>

      {/* caption + controls */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: '16px 32px',
          minHeight: compact ? 0 : 108,
        }}
      >
        <div
          style={{ flex: '1 1 420px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}
        >
          <p
            data-caption-title
            style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.01em', lineHeight: 1.25 }}
          >
            {title}
          </p>
          <p style={{ fontSize: 15, lineHeight: 1.55, color: 'var(--ff-ink-2)', maxWidth: 660 }}>
            {text}
          </p>
        </div>
        <div
          style={{
            flex: compact ? '1 1 100%' : '0 1 auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: compact ? 'stretch' : 'flex-end',
            gap: 12,
          }}
        >
          {s.phase === 2 && (
            <div style={{ width: compact ? '100%' : 280, maxWidth: '100%' }}>
              <Slider
                id="wow-days"
                label={t('wow.slider')}
                value={Math.round(s.days)}
                min={0}
                max={DAYS_MAX}
                step={1}
                valueText={daysText}
                onInput={onDays}
                accent="var(--ff-long)"
              />
            </div>
          )}
          <div
            class="math"
            data-kpi
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              alignSelf: compact ? 'flex-start' : 'auto',
              padding: '10px 16px',
              borderRadius: 14,
              background: s.phase === 2 ? 'var(--ff-linear-soft)' : 'var(--ff-chip)',
              fontSize: 21,
              whiteSpace: 'nowrap',
              transition: 'background-color 600ms ease',
            }}
          >
            {kpi}
          </div>
        </div>
      </div>
    </div>
  );
}
