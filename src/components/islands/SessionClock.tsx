/**
 * Session clock (module 01, section 2; MASTER_PROMPT §8.5): one FX trading day in Zurich time.
 *
 * Five session bars (Wellington → Sydney → Tokyo → London → New York) and a schematic
 * liquidity curve that peaks in the London/New York overlap. Drag the time cursor (pointer
 * events) or use the slider; switch the day (the week starts on Sunday evening in Zurich, i.e.
 * Monday morning in Wellington) and the season (daylight saving time). The current Zurich time
 * is marked on the client only and updates every 30 seconds; the server render shows no marker.
 * "Play" runs the cursor through the day; each session flashes when it opens. Curves morph in
 * 300 ms (instant under reduced motion; playback then jumps hour by hour). Logic:
 * src/lib/m01/sessions.ts.
 */
import type { JSX } from 'preact';
import { useEffect, useId, useMemo, useRef, useState } from 'preact/hooks';
import { Segmented } from '@/components/ui/Segmented';
import { Slider } from '@/components/ui/Slider';
import {
  useElementWidth,
  useInView,
  usePrefersReducedMotion,
  useTween,
} from '@/components/ui/hooks';
import { sessionclock as dict } from '@/i18n/dict/sessionclock';
import { translator, type Lang } from '@/i18n/types';
import { areaPath, linePath, scaleLinear, type Point } from '@/lib/chart';
import {
  SESSION_CONFIG,
  fmtClock,
  liquidityAt,
  liquidityCurve,
  liquidityLevel,
  openSessions,
  overlapWindow,
  sessionIntervals,
  visibleSegments,
  weekStart,
  zurichClock,
  zurichWindow,
  type DayType,
  type LiquidityLevel,
  type Season,
  type SessionId,
  type ZurichClock,
} from '@/lib/m01/sessions';
import { snap, useSvgDrag } from './m01-shared';

export interface SessionClockProps {
  lang: Lang;
}

const DAYS: DayType[] = ['monThu', 'fri', 'sat', 'sun'];
const SEASONS: Season[] = ['winter', 'summer'];
const LEVELS: LiquidityLevel[] = ['closed', 'thin', 'moderate', 'high', 'peak'];
const STEP = 0.25;
const SAMPLES = 144;
const LAST = 24 - STEP;
/** Playback timing (UI choice, D-22): one day in `playSeconds`; reduced motion jumps hourly. */
const CLOCK_UI = { playSeconds: 16, rmStepHours: 1, rmStepMs: 700 } as const;
const NEW_YORK = SESSION_CONFIG.sessions.find((s) => s.id === 'newYork')!;

function layoutFor(w: number) {
  const width = Math.max(280, Math.round(w));
  const compact = width < 560;
  const labelW = compact ? 74 : 96;
  // compact: the curve title and the overlap label sit on two lines above the curve
  const curveTop = compact ? 50 : 30;
  const curveH = compact ? 96 : 176;
  const rowsTop = curveTop + curveH + 20;
  const rowH = compact ? 20 : 28;
  const rowGap = compact ? 8 : 12;
  const rowsBottom = rowsTop + 5 * rowH + 4 * rowGap;
  const font = compact ? 11 : 12;
  const axisY = rowsBottom + 14 + font;
  const rail = axisY + 24;
  return {
    width,
    compact,
    font,
    labelW,
    x0: labelW,
    x1: width - (compact ? 10 : 14),
    curveTop,
    curveBottom: curveTop + curveH,
    rowsTop,
    rowH,
    rowGap,
    rowsBottom,
    axisY,
    rail,
    height: rail + 20,
  };
}

export default function SessionClock({ lang }: SessionClockProps): JSX.Element {
  const t = translator(dict, lang);
  const uid = useId().replace(/[^A-Za-z0-9_-]/g, '');
  const rm = usePrefersReducedMotion();
  const [day, setDay] = useState<DayType>('monThu');
  const [season, setSeason] = useState<Season>('winter');
  const [hour, setHour] = useState(10);
  const [now, setNow] = useState<ZurichClock | null>(null);
  const [playing, setPlaying] = useState(false);
  const touched = useRef(false);
  const hourRef = useRef(hour);
  hourRef.current = hour;
  const box = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const L = layoutFor(useElementWidth(box, 640));
  // pause off-screen: watch the whole figure (on phones the controls sit below the chart)
  const root = useRef<HTMLDivElement>(null);
  const inView = useInView(root);

  // Client only: read the Zurich clock, follow it until the learner takes over.
  useEffect(() => {
    const tick = () => {
      const c = zurichClock(new Date());
      setNow(c);
      if (!touched.current) {
        setDay(c.day);
        setSeason(c.season);
        setHour(snap(c.hour, STEP, 0, LAST));
      }
    };
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, []);

  const sx = scaleLinear([0, 24], [L.x0, L.x1]);
  const sy = scaleLinear([0, 1], [L.curveBottom, L.curveTop + 8]);
  const setH = (h: number) => {
    touched.current = true;
    setPlaying(false);
    setHour(snap(h, STEP, 0, LAST));
  };

  // Playback: the cursor runs through the day and stops at its end (paused off-screen).
  useEffect(() => {
    if (!playing || !inView) return;
    const advance = (dh: number): boolean => {
      const n = Math.min(LAST, hourRef.current + dh);
      hourRef.current = n;
      setHour(n);
      if (n >= LAST) {
        setPlaying(false);
        return false;
      }
      return true;
    };
    if (rm) {
      const id = window.setInterval(() => advance(CLOCK_UI.rmStepHours), CLOCK_UI.rmStepMs);
      return () => window.clearInterval(id);
    }
    let raf = 0;
    let last = performance.now();
    const step = (t: number) => {
      const dt = Math.min(0.1, (t - last) / 1000);
      last = t;
      if (advance((dt * 24) / CLOCK_UI.playSeconds)) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, inView, rm]);

  const togglePlay = () => {
    touched.current = true;
    if (playing) {
      setPlaying(false);
      setHour(snap(hourRef.current, STEP, 0, LAST));
      return;
    }
    if (hourRef.current >= LAST - 1e-9) {
      hourRef.current = 0;
      setHour(0);
    }
    setPlaying(true);
  };
  const { dragging, handlers } = useSvgDrag(svgRef, L, 'x', (x) => setH(sx.invert(x)));

  const curve = useMemo(() => liquidityCurve(season, day, SAMPLES).map((p) => p[1]), [season, day]);
  const shownCurve = useTween(curve, 300, rm);
  const [shownHour] = useTween([hour], 300, rm || dragging || playing);
  const h = shownHour ?? hour;

  const level = liquidityLevel(season, day, hour);
  const open = openSessions(season, day, hour);
  const overlap = overlapWindow(season, day);
  const inPeak = level === 'peak';
  const ws = weekStart(season);
  const nyClose = zurichWindow(NEW_YORK, season).close;

  const pts: Point[] = shownCurve.map((v, i) => [sx((24 * i) / SAMPLES), sy(v)]);
  const area = areaPath(
    pts,
    pts.map(([x]): Point => [x, sy(0)]),
  );
  const fs = `${L.font}px`;
  const hours = L.compact ? [0, 6, 12, 18, 24] : [0, 3, 6, 9, 12, 15, 18, 21, 24];
  const city = (id: SessionId) => t(`city.${id}`);
  const openText = open.length ? open.map(city).join(', ') : t('none');
  const showNow = !!now && now.day === day && now.season === season;
  const xNow = now ? sx(now.hour) : 0;
  const xCur = sx(h);
  // the time pill on the rail stays inside the SVG at the end of the day
  const pillX = Math.min(Math.max(xCur, 29), L.width - 29);
  const yCur = sy(liquidityAt(season, day, h));

  const aria = t('aria', {
    day: t(`dayLong.${day}`),
    season: t(`seasonLong.${season}`),
    time: fmtClock(hour),
    open: openText,
    level: t(`level.${level}`),
    overlap: overlap ? `${fmtClock(overlap[0])}–${fmtClock(overlap[1])}` : '–',
  });

  /** Two-line annotation (split at ": "), anchored left or right of x. */
  const note = (
    x: number,
    y: number,
    text: string,
    anchor: 'start' | 'end',
    key: string,
    dy: number,
  ) => {
    const [a, b] = text.includes(': ') ? text.split(': ') : [text, ''];
    const tx = anchor === 'end' ? x - 8 : x + 8;
    return (
      <text
        key={key}
        x={tx}
        y={y}
        class="sc-note-text"
        style={{ fontSize: fs, fontWeight: 700, fill: 'var(--ff-ink-2)', textAnchor: anchor }}
      >
        <tspan x={tx}>{b ? `${a}:` : a}</tspan>
        {b && (
          <tspan x={tx} dy={dy} style={{ fontWeight: 600, fill: 'var(--ff-muted)' }}>
            {b}
          </tspan>
        )}
      </text>
    );
  };

  return (
    <div
      ref={root}
      class="sc"
      data-sc
      data-day={day}
      data-season={season}
      data-hour={hour.toFixed(2)}
      data-level={level}
      data-open={open.join(',')}
      data-playing={playing}
    >
      <div class="ff-lab-head">
        <div class="sc-head-text">
          <div class="ff-lab-title">{t('title')}</div>
          <div class="ff-lab-sub">{t('sub')}</div>
        </div>
        <span class="ff-pill-note sc-chip">{t('chip')}</span>
      </div>
      <div class="ff-lab">
        <div class="ff-lab-main">
          <div ref={box}>
            <svg
              ref={svgRef}
              viewBox={`0 0 ${L.width} ${L.height}`}
              role="img"
              aria-label={aria}
              class="sc-svg"
            >
              {overlap && (
                <g class={inPeak ? 'sc-overlap is-peak' : 'sc-overlap'}>
                  <rect
                    x={sx(overlap[0])}
                    y={L.curveTop}
                    width={sx(overlap[1]) - sx(overlap[0])}
                    height={L.rowsBottom - L.curveTop}
                    rx={6}
                  />
                </g>
              )}
              <text
                x={L.x0}
                y={L.curveTop - (L.compact ? 30 : 12)}
                style={{ fontSize: fs, fontWeight: 600, fill: 'var(--ff-muted)' }}
              >
                {t('curve')}
              </text>
              {overlap && (
                <text
                  x={(sx(overlap[0]) + sx(overlap[1])) / 2}
                  y={L.curveTop - (L.compact ? 8 : 12)}
                  style={{
                    fontSize: fs,
                    fontWeight: 700,
                    fill: 'var(--ff-linear-text)',
                    textAnchor: 'middle',
                  }}
                >
                  {t('overlap')}
                </text>
              )}
              {[0.5, 1].map((v) => (
                <path
                  key={v}
                  d={`M${L.x0},${sy(v).toFixed(1)}H${L.x1}`}
                  style={{ fill: 'none', stroke: 'var(--ff-grid)', strokeWidth: 1 }}
                />
              ))}
              <path
                d={`M${L.x0},${sy(0).toFixed(1)}H${L.x1}`}
                style={{ fill: 'none', stroke: 'var(--ff-axis)', strokeWidth: 1 }}
              />
              <path d={area} style={{ fill: 'var(--ff-timevalue)' }} />
              <path
                d={linePath(pts)}
                style={{
                  fill: 'none',
                  stroke: 'var(--ff-long)',
                  strokeWidth: 2.5,
                  strokeLinejoin: 'round',
                }}
              />
              {day === 'sun' &&
                note(sx(ws.hour), L.curveTop + 22, t('weekStart'), 'end', 'ws', L.font + 6)}
              {day === 'sat' && (
                <text
                  x={(L.x0 + L.x1) / 2}
                  y={(L.curveTop + L.curveBottom) / 2}
                  class="sc-note-text"
                  style={{
                    fontSize: fs,
                    fontWeight: 700,
                    fill: 'var(--ff-ink-2)',
                    textAnchor: 'middle',
                  }}
                >
                  {t('weekendText')}
                </text>
              )}
              {day === 'sun' && (
                <path
                  d={`M${sx(ws.hour).toFixed(1)},${L.curveTop + 6}V${L.rowsBottom}`}
                  style={{ fill: 'none', stroke: 'var(--ff-ink)', strokeWidth: 1.5 }}
                />
              )}

              {/* session rows */}
              {SESSION_CONFIG.sessions.map((s, i) => {
                const y = L.rowsTop + i * (L.rowH + L.rowGap);
                const segs = visibleSegments(sessionIntervals(s, season, day));
                const isOpen = open.includes(s.id);
                const w = zurichWindow(s, season);
                return (
                  <g key={s.id} data-row={s.id} data-open={isOpen}>
                    <text
                      x={L.x0 - 10}
                      y={y + L.rowH / 2 + L.font * 0.35}
                      style={{
                        fontSize: fs,
                        fontWeight: isOpen ? 800 : 600,
                        fill: isOpen ? 'var(--ff-ink)' : 'var(--ff-muted)',
                        textAnchor: 'end',
                      }}
                    >
                      {city(s.id)}
                    </text>
                    <rect
                      x={L.x0}
                      y={y}
                      width={L.x1 - L.x0}
                      height={L.rowH}
                      rx={L.rowH / 2}
                      style={{ fill: 'var(--ff-surface-2)' }}
                    />
                    {playing &&
                      isOpen &&
                      segs.map(([a, b]) => (
                        <rect
                          key={`flash-${a}-${b}`}
                          x={sx(a)}
                          y={y}
                          width={Math.max(0, sx(b) - sx(a))}
                          height={L.rowH}
                          rx={L.rowH / 2}
                          class="sc-flash"
                          aria-hidden="true"
                        />
                      ))}
                    {segs.map(([a, b]) => (
                      <rect
                        key={`${a}-${b}-${w.open}`}
                        x={sx(a)}
                        y={y}
                        width={Math.max(0, sx(b) - sx(a))}
                        height={L.rowH}
                        rx={L.rowH / 2}
                        class="sc-bar"
                        style={{
                          fill: isOpen ? 'var(--ff-long)' : 'var(--ff-linear-soft)',
                          stroke: 'var(--ff-long)',
                          strokeWidth: 1,
                        }}
                      />
                    ))}
                  </g>
                );
              })}

              {day === 'fri' && (
                <g>
                  <path
                    d={`M${sx(nyClose).toFixed(1)},${L.curveTop + 6}V${L.rowsBottom}`}
                    style={{ fill: 'none', stroke: 'var(--ff-ink)', strokeWidth: 1.5 }}
                  />
                  {note(
                    sx(nyClose),
                    L.rowsTop + L.rowH / 2 + L.font * 0.35,
                    t('weekEnd'),
                    'end',
                    'we',
                    L.rowH + L.rowGap,
                  )}
                </g>
              )}

              {/* hours */}
              {hours.map((v) => (
                <text
                  key={v}
                  x={sx(v)}
                  y={L.axisY}
                  style={{ fontSize: fs, fill: 'var(--ff-muted)', textAnchor: 'middle' }}
                >
                  {fmtClock(v).slice(0, 2)}
                </text>
              ))}

              {/* now marker (client only) */}
              {showNow && now && (
                <g data-now aria-hidden="true">
                  <path
                    d={`M${xNow.toFixed(1)},${L.curveTop}V${L.rowsBottom + 4}`}
                    style={{
                      fill: 'none',
                      stroke: 'var(--ff-linear-text)',
                      strokeWidth: 1.5,
                      strokeDasharray: '3 3',
                    }}
                  />
                  <circle
                    cx={xNow}
                    cy={L.curveTop}
                    r={4}
                    class={rm ? undefined : 'sc-pulse'}
                    style={{ fill: 'var(--ff-linear-text)' }}
                  />
                </g>
              )}

              {/* cursor */}
              <path
                d={`M${xCur.toFixed(1)},${L.curveTop}V${L.rail}`}
                style={{ fill: 'none', stroke: 'var(--ff-ink)', strokeWidth: 1.5 }}
              />
              <circle
                cx={xCur}
                cy={yCur}
                r={5.5}
                style={{ fill: 'var(--ff-ink)', stroke: '#fff', strokeWidth: 2.5 }}
              />
              <rect
                x={L.x0}
                y={L.curveTop}
                width={L.x1 - L.x0}
                height={L.rowsBottom - L.curveTop}
                class="sc-surface"
                style={{ fill: 'transparent' }}
                {...handlers}
              />
              <path
                d={`M${L.x0},${L.rail}H${L.x1}`}
                style={{
                  fill: 'none',
                  stroke: 'var(--ff-line)',
                  strokeWidth: 4,
                  strokeLinecap: 'round',
                }}
              />
              <g class={`sc-handle${dragging ? ' is-active' : ''}`} data-handle {...handlers}>
                <rect
                  x={pillX - 30}
                  y={L.rail - 22}
                  width={60}
                  height={44}
                  style={{ fill: 'transparent' }}
                />
                <rect
                  x={pillX - 28}
                  y={L.rail - 11}
                  width={56}
                  height={22}
                  rx={11}
                  style={{ fill: 'var(--ff-ink)', stroke: '#fff', strokeWidth: 2 }}
                />
                <text
                  x={pillX}
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
                  {fmtClock(h)}
                </text>
              </g>
            </svg>
          </div>
          <div class="sc-below">
            {showNow && now && (
              <span class="sc-now-chip" data-now-chip>
                <span aria-hidden="true" class="sc-now-dot" />
                {t('nowLabel', { time: fmtClock(now.hour) })}
              </span>
            )}
            <span class="sc-hint">{t('drag')}</span>
          </div>
        </div>
        <div class="ff-lab-side">
          <div class="sc-status">
            <div class="sc-status-head">
              <span class="sc-status-label">{t('heroLabel', { day: t(`dayLong.${day}`) })}</span>
              <span class="sc-status-time mono">{fmtClock(h)}</span>
            </div>
            <div class="sc-status-row">
              <span class="sc-status-key">{t('open')}</span>
              <span class="sc-chips">
                {open.length ? (
                  open.map((id) => (
                    <span key={id} class="sc-city-chip">
                      {city(id)}
                    </span>
                  ))
                ) : (
                  <span class="sc-city-chip is-none">{t('none')}</span>
                )}
              </span>
            </div>
            <div class="sc-status-row">
              <span class="sc-status-key">{t('level')}</span>
              <span class="sc-meter" aria-hidden="true">
                {LEVELS.slice(1).map((lv, i) => (
                  <span
                    key={lv}
                    class={`sc-meter-bar${LEVELS.indexOf(level) > i ? ' is-on' : ''}`}
                  />
                ))}
              </span>
              <span class="sc-level" data-level-text>
                {t(`level.${level}`)}
              </span>
            </div>
          </div>
          <div class="panel">
            <div class="sc-control">
              <span class="field-label">{t('day')}</span>
              <Segmented
                label={t('day')}
                options={DAYS.map((d) => ({ value: d, label: t(`day.${d}`) }))}
                value={day}
                onChange={(d) => {
                  touched.current = true;
                  setDay(d);
                }}
              />
            </div>
            <div class="sc-control">
              <span class="field-label">{t('season')}</span>
              <Segmented
                label={t('season')}
                options={SEASONS.map((s) => ({ value: s, label: t(`season.${s}`) }))}
                value={season}
                onChange={(s) => {
                  touched.current = true;
                  setSeason(s);
                }}
              />
            </div>
            <Slider
              id={`sc-${uid}`}
              label={t('slider')}
              value={hour}
              min={0}
              max={LAST}
              step={STEP}
              valueText={fmtClock(hour)}
              onInput={setH}
            />
            <div class="sc-buttons">
              <button
                type="button"
                class="btn btn-dark sc-play"
                aria-pressed={playing}
                data-play
                onClick={togglePlay}
              >
                {playing ? (
                  <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
                    <path
                      d="M5 3.5V12.5M11 3.5V12.5"
                      style={{ stroke: 'currentColor', strokeWidth: 2.4, strokeLinecap: 'round' }}
                    />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M4.5 2.8L13 8L4.5 13.2Z" style={{ fill: 'currentColor' }} />
                  </svg>
                )}
                {playing ? t('pause') : t('play')}
              </button>
              <button
                type="button"
                class="btn btn-light sc-now-btn"
                disabled={!now}
                onClick={() => {
                  if (!now) return;
                  touched.current = false;
                  setPlaying(false);
                  setDay(now.day);
                  setSeason(now.season);
                  setHour(snap(now.hour, STEP, 0, LAST));
                }}
              >
                {t('nowButton')}
              </button>
            </div>
          </div>
          <p class={`sc-hint-box sc-hint-box--${level}`} data-hint>
            {t(`hint.${level}`)}
          </p>
          <p class="sc-dst">{t('dst')}</p>
          <div class="sr-only" aria-live="polite" aria-atomic="true">
            {dragging || playing ? '' : `${fmtClock(hour)}: ${openText}. ${t(`level.${level}`)}.`}
          </div>
          {now && <p class="sr-only">{t('ariaNow', { time: fmtClock(now.hour) })}</p>}
        </div>
      </div>
    </div>
  );
}
