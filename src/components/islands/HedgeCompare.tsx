/**
 * Hedge comparison (module 09, section 2): the importer's five tools on one axis. The chart
 * shows the rate he pays at expiry (CHF per USD) against USD/CHF at expiry for staying
 * unhedged, the forward, a USD call, a zero-cost collar and a structured (leveraged) hedge.
 * Drag the rate at expiry or play it: the ranking on the right re-sorts as it moves, the
 * landmarks (strikes, cap, floor, "worse than the forward") light up when they are crossed,
 * and a chip names the tool that is cheapest in hindsight — a different one at every rate.
 *
 * Props: lang, show? (strategies visible first, default all five), st? (initial USD/CHF at
 * expiry). Maths in src/lib/m09/hedge.ts, strings in src/i18n/dict/hedgecompare.ts.
 */
import type { JSX } from 'preact';
import { useEffect, useId, useMemo, useRef, useState } from 'preact/hooks';
import { AxisX, GridY } from '@/components/ui/Chart';
import { Slider } from '@/components/ui/Slider';
import {
  useElementWidth,
  useInView,
  usePrefersReducedMotion,
  useTween,
} from '@/components/ui/hooks';
import { hedgecompare as dict } from '@/i18n/dict/hedgecompare';
import { translator, type Lang } from '@/i18n/types';
import { clamp, linePath, niceTicks, scaleLinear, type Point } from '@/lib/chart';
import { EXAMPLE } from '@/lib/fx/example';
import { fmtMillions, fmtMoney, fmtNumber, fmtPips, fmtRate } from '@/lib/format';
import { M09_CONFIG, PIP } from '@/lib/m09/config';
import {
  HEDGE_IDS,
  cheapestAt,
  crossedEvents,
  hedgeCurve,
  hedgeEvents,
  hedgeRange,
  hedgeRate,
  hedgeSetup,
  initialHedgeFixing,
  isHedgeId,
  snapHedgeFixing,
  tourPosition,
  tourStops,
  tourWaypoints,
  type HedgeEvent,
  type HedgeId,
} from '@/lib/m09/hedge';

export interface HedgeCompareProps {
  lang: Lang;
  show?: string[];
  st?: number;
}

const PAIR = EXAMPLE.pair;
const N = EXAMPLE.notional;
const H = M09_CONFIG.hedge;
const SAMPLES = 200;
const ROW_H = 58;

/** Line styles per strategy (colour semantics: long blue, short orange, forward black). */
const STYLE: Record<HedgeId, { color: string; width: number; dash?: string }> = {
  unhedged: { color: 'var(--ff-payoff)', width: 2 },
  forward: { color: 'var(--ff-forward)', width: 2, dash: '7 5' },
  call: { color: 'var(--ff-long)', width: 3 },
  collar: { color: 'var(--ff-options)', width: 2.5 },
  leveraged: { color: 'var(--ff-short)', width: 2.5 },
};

function layoutFor(w: number) {
  const width = Math.max(280, Math.round(w));
  const compact = width < 560;
  const font = compact ? 11 : 12;
  const titleRow = font + 8;
  const plot = compact ? 260 : Math.round(clamp(width * 0.56, 300, 380));
  const top = 30;
  const plotBottom = top + plot;
  const rail = plotBottom + 22;
  const ticksY = rail + 36;
  return {
    width,
    height: ticksY + titleRow,
    compact,
    font,
    left: compact ? 46 : 56,
    right: compact ? 8 : 14,
    top,
    plotBottom,
    rail,
    ticksY,
  };
}

/** Equal rates (ties share a rank): within 1e-9 CHF per USD. */
function tied(a: number, b: number): boolean {
  return Math.abs(a - b) < 1e-9;
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

export default function HedgeCompare(props: HedgeCompareProps): JSX.Element {
  const { lang } = props;
  const t = translator(dict, lang);
  const uid = useId().replace(/[^A-Za-z0-9_-]/g, '');
  const rm = usePrefersReducedMotion();
  const setup = useMemo(() => hedgeSetup(), []);
  const range = hedgeRange();
  const xs = useMemo(
    () =>
      Array.from(
        { length: SAMPLES + 1 },
        (_, i) => range[0] + ((range[1] - range[0]) * i) / SAMPLES,
      ),
    [],
  );
  const curves = useMemo(() => {
    const out = {} as Record<HedgeId, number[]>;
    for (const id of HEDGE_IDS) out[id] = hedgeCurve(id, xs, setup);
    return out;
  }, [xs, setup]);

  const [shown, setShown] = useState<HedgeId[]>(() => {
    const s = (props.show ?? []).filter(isHedgeId);
    return s.length ? HEDGE_IDS.filter((id) => s.includes(id)) : [...HEDGE_IDS];
  });
  const [st, setSt] = useState(() =>
    typeof props.st === 'number' ? snapHedgeFixing(props.st) : initialHedgeFixing(),
  );
  const [dragging, setDragging] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [event, setEvent] = useState<{ e: HedgeEvent; n: number } | null>(null);
  const prevSt = useRef(st);
  const eventCount = useRef(0);
  const box = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const pointer = useRef<number | null>(null);
  const inView = useInView(root);
  const L = layoutFor(useElementWidth(box, 640));

  const events = useMemo(() => hedgeEvents(setup, shown), [setup, shown]);

  /* landmarks crossed since the last position light up */
  useEffect(() => {
    const hit = crossedEvents(prevSt.current, st, events);
    prevSt.current = st;
    if (hit.length) {
      eventCount.current += 1;
      setEvent({ e: hit[hit.length - 1]!, n: eventCount.current });
    }
  }, [st, events]);

  /* ---------- playback ---------- */
  useEffect(() => {
    if (!playing || !inView) return;
    const w = tourWaypoints();
    if (rm) {
      const stops = tourStops(events, w).slice(1);
      let i = 0;
      const id = setInterval(() => {
        setSt(stops[i]!);
        i += 1;
        if (i >= stops.length) {
          clearInterval(id);
          setPlaying(false);
        }
      }, H.tour.stepMs);
      return () => clearInterval(id);
    }
    let raf = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / H.tour.ms);
      setSt(tourPosition(k, w));
      if (k < 1) raf = requestAnimationFrame(step);
      else setPlaying(false);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, inView, rm, events]);

  /* ---------- values at S_T ---------- */
  const rates = HEDGE_IDS.map((id) => hedgeRate(id, st, setup));
  const instant = rm || dragging || playing;
  const tw = useTween(rates, 300, instant);
  const best = cheapestAt(st, shown, setup);
  const minRate = Math.min(...shown.map((id) => rates[HEDGE_IDS.indexOf(id)]!));
  /* ties (e.g. collar and unhedged between the collar strikes) share the first place */
  const bestIds = shown.filter((id) => tied(rates[HEDGE_IDS.indexOf(id)]!, minRate));
  const rowH = L.compact ? 66 : ROW_H;
  const order = [...shown].sort((a, b) => {
    const d = rates[HEDGE_IDS.indexOf(a)]! - rates[HEDGE_IDS.indexOf(b)]!;
    return Math.abs(d) > 1e-9 ? d : HEDGE_IDS.indexOf(a) - HEDGE_IDS.indexOf(b);
  });

  /* ---------- scales ---------- */
  const sx = scaleLinear(range, [L.left, L.width - L.right]);
  const sy = scaleLinear(range, [L.plotBottom, L.top]);
  const ticks = niceTicks(range[0], range[1], L.compact ? 4 : 6);
  const x = sx(st);

  /* ---------- interaction ---------- */
  const setFix = (v: number) => setSt(snapHedgeFixing(v));
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
  const toggle = (id: HedgeId) =>
    setShown((s) => {
      if (s.includes(id)) return s.length > 1 ? s.filter((x) => x !== id) : s;
      return HEDGE_IDS.filter((x) => x === id || s.includes(x));
    });

  /* ---------- texts ---------- */
  const rate = (v: number) => fmtRate(v, PAIR);
  const chf = (v: number, sign = false) => fmtMoney(v, EXAMPLE.quote, lang, 0, sign);
  const name = (id: HedgeId) => t(`hc.name.${id}`);
  const keyText = (id: HedgeId): string => {
    switch (id) {
      case 'unhedged':
        return t('hc.key.unhedged');
      case 'forward':
        return t('hc.key.forward', { f: rate(setup.forward) });
      case 'call':
        return t('hc.key.call', {
          k: rate(setup.call.strike),
          p: fmtPips(setup.call.premium / PIP, lang, 0),
        });
      case 'collar':
        return t('hc.key.collar', {
          kp: rate(setup.collar.putStrike),
          kc: rate(setup.collar.callStrike),
        });
      case 'leveraged':
        return t('hc.key.leveraged', { k: rate(setup.leveraged.strike) });
    }
  };
  const evText = (e: HedgeEvent) => t(`hc.ev.${e.id}`, { k: rate(e.level) });
  const notional = fmtMillions(N, EXAMPLE.base, lang);
  const costs = order.map((id) =>
    t('hc.cost', { name: name(id), chf: chf(rates[HEDGE_IDS.indexOf(id)]! * N) }),
  );
  const bestName = bestIds.map(name).join(' = ');
  const aria = t('hc.aria', {
    lines: shown.map(name).join(', '),
    st: rate(st),
    costs: costs.join(', '),
    best: bestName,
  });
  const summary = t('hc.summary', {
    st: rate(st),
    n: notional,
    costs: costs.join(', '),
    best: bestName,
  });
  const fwdRate = setup.forward;

  const fs = `${L.font}px`;
  const clipId = `hc-clip-${uid}`;

  return (
    <div
      class="hc"
      ref={root}
      data-hc
      data-st={st.toFixed(4)}
      data-best={best ?? ''}
      data-shown={shown.join(',')}
    >
      <div class="ff-lab-head">
        <div class="hc-head-text">
          <div class="ff-lab-title">{t('hc.title')}</div>
          <div class="ff-lab-sub">
            {t('hc.sub', {
              pair: PAIR,
              notional,
              months: EXAMPLE.months,
              spot: rate(EXAMPLE.spot),
              forward: rate(fwdRate),
            })}
          </div>
        </div>
        {best && (
          <span class="hc-lead" key={`lead-${bestIds.join('-')}`} data-lead aria-live="polite">
            {t('hc.lead', { name: bestName })}
          </span>
        )}
      </div>

      <div class="hc-toggles" role="group" aria-label={t('hc.toggles')}>
        {HEDGE_IDS.map((id) => (
          <button
            key={id}
            type="button"
            class="hc-toggle"
            aria-pressed={shown.includes(id)}
            data-toggle={id}
            onClick={() => toggle(id)}
          >
            <svg width="26" height="10" viewBox="0 0 26 10" aria-hidden="true">
              <path
                d="M1,5H25"
                style={lineStyle(
                  STYLE[id].color,
                  STYLE[id].width,
                  STYLE[id].dash ? '5 3' : undefined,
                )}
              />
            </svg>
            <span class="hc-toggle-text">
              <span class="hc-toggle-name">{name(id)}</span>
              <span class="hc-toggle-key">{keyText(id)}</span>
            </span>
          </button>
        ))}
      </div>

      <div class="ff-lab">
        <div class="ff-lab-main">
          <div ref={box}>
            <svg
              ref={svgRef}
              viewBox={`0 0 ${L.width} ${L.height}`}
              role="img"
              aria-label={aria}
              class="hc-svg"
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
                ticks={ticks}
                x0={L.left}
                x1={L.width - L.right}
                format={(v) => fmtRate(v, PAIR, 2)}
                fontSize={L.font}
                axisAt={null}
              />
              <text
                x={L.left}
                y={L.top - 14}
                style={{ fontSize: fs, fontWeight: 600, fill: 'var(--ff-muted)' }}
              >
                {t('hc.y')}
              </text>

              <g clip-path={`url(#${clipId})`}>
                {HEDGE_IDS.filter((id) => shown.includes(id)).map((id) => (
                  <path
                    key={id}
                    d={linePath(xs.map((v, i): Point => [sx(v), sy(curves[id][i]!)]))}
                    class="hc-line"
                    pathLength={STYLE[id].dash ? undefined : 1}
                    data-line={id}
                    style={lineStyle(STYLE[id].color, STYLE[id].width, STYLE[id].dash)}
                  />
                ))}
              </g>

              {/* marker at S_T */}
              <path
                d={`M${x.toFixed(1)},${L.top}V${L.rail}`}
                style={{ fill: 'none', stroke: 'var(--ff-ink)', strokeWidth: 1.25 }}
              />
              {/* landmarks */}
              {events.map((e) => {
                const ex = sx(e.level);
                const ey = sy(hedgeRate(e.strategy, e.level, setup));
                const active = event?.e.id === e.id;
                return (
                  <g key={e.id} data-event={e.id} class={active ? 'hc-ev is-active' : 'hc-ev'}>
                    {active && (
                      <circle
                        key={`ring-${event?.n}`}
                        class="hc-ring"
                        cx={ex}
                        cy={ey}
                        r={12}
                        style={{ fill: 'none', stroke: STYLE[e.strategy].color, strokeWidth: 2 }}
                      />
                    )}
                    <rect
                      x={ex - 4}
                      y={ey - 4}
                      width={8}
                      height={8}
                      transform={`rotate(45 ${ex} ${ey})`}
                      style={{ fill: '#fff', stroke: STYLE[e.strategy].color, strokeWidth: 2 }}
                    />
                  </g>
                );
              })}

              {/* one dot per strategy at S_T */}
              {HEDGE_IDS.filter((id) => shown.includes(id)).map((id) => (
                <circle
                  key={`dot-${id}`}
                  cx={x}
                  cy={sy(clamp(tw[HEDGE_IDS.indexOf(id)]!, range[0], range[1]))}
                  r={bestIds.includes(id) ? 7 : 5}
                  style={{ fill: STYLE[id].color, stroke: '#fff', strokeWidth: 2.5 }}
                />
              ))}

              {/* the latest landmark as a note at the top of the chart */}
              {!L.compact && event && events.some((e) => e.id === event.e.id) && (
                <text
                  key={`note-${event.n}`}
                  class="hc-note"
                  data-note
                  x={L.left + 8}
                  y={L.top + L.font + 4}
                  style={{
                    fontSize: `${L.font + (L.compact ? 0 : 1)}px`,
                    fontWeight: 800,
                    fill: 'var(--ff-ink)',
                    ...halo,
                  }}
                >
                  {evText(event.e)}
                </text>
              )}

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
                class={`hc-handle${dragging ? ' is-active' : ''}`}
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
                ticks={ticks}
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
                {t('hc.x')}
              </text>
            </svg>
          </div>
          {L.compact && event && events.some((e) => e.id === event.e.id) && (
            <p class="hc-note-text" key={`nt-${event.n}`}>
              {evText(event.e)}
            </p>
          )}
          <p class="hc-hint">{t('hc.drag')}</p>
          <p class="sr-only" data-summary>
            {summary}
          </p>
        </div>

        <div class="ff-lab-side">
          <div class="hc-rank" data-rank>
            <div class="hc-rank-head">{t('hc.rank', { st: rate(st), n: notional })}</div>
            <ol class="hc-rank-list" style={{ height: `${shown.length * rowH}px` }}>
              {shown.map((id) => {
                const i = HEDGE_IDS.indexOf(id);
                const pos = order.indexOf(id);
                const diff = (tw[i]! - fwdRate) * N;
                return (
                  <li
                    key={id}
                    class={`hc-row${bestIds.includes(id) ? ' is-best' : ''}`}
                    style={{ transform: `translateY(${pos * rowH}px)`, height: `${rowH}px` }}
                    data-row={id}
                    data-pos={pos + 1}
                  >
                    <span class="hc-row-pos mono" aria-hidden="true">
                      {pos + 1}
                    </span>
                    <span
                      class="hc-row-swatch"
                      style={{ background: STYLE[id].color }}
                      aria-hidden="true"
                    />
                    <span class="hc-row-text">
                      <span class="hc-row-name">{name(id)}</span>
                      {bestIds.includes(id) && <span class="hc-tag">{t('hc.best')}</span>}
                    </span>
                    <span class="hc-row-nums">
                      <span class="hc-row-value mono">{chf(tw[i]! * N)}</span>
                      <span class="hc-row-sub">
                        {id === 'forward'
                          ? t('hc.isFwd')
                          : t('hc.vsFwd', { d: fmtNumber(Math.round(diff), lang, { sign: true }) })}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
          <div class="panel">
            <Slider
              id={`hc-st-${uid}`}
              label={t('hc.st')}
              value={st}
              min={range[0]}
              max={range[1]}
              step={H.fixingStep}
              valueText={rate(st)}
              onInput={(v) => {
                setPlaying(false);
                setFix(v);
              }}
            />
            <button
              type="button"
              class="btn btn-light hc-play"
              aria-pressed={playing}
              data-play
              onClick={() => setPlaying((p) => !p)}
            >
              {playing ? (
                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M5 3.5V12.5M11 3.5V12.5" class="hc-icon-stroke" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M5 3.2L12.5 8L5 12.8Z" class="hc-icon-fill" />
                </svg>
              )}
              <span>{playing ? t('hc.pause') : t('hc.play')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
