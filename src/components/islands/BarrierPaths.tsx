/**
 * BarrierPaths (module 07, section 1): a handful of seeded daily USD/CHF paths with a barrier.
 * Knock-out: a path that touches the barrier fades (the option is gone). Knock-in: it lights up
 * (the option comes alive). The paths play day by day; each touch pops up exactly on its day.
 *
 * Maths in src/lib/m07/paths.ts (GBM paths from src/lib/fx/mc, prices from the core). The barrier
 * can be dragged on the chart; the slider is its accessible twin. Under reduced motion the
 * figure shows the final state and changes without animation.
 */
import type { JSX } from 'preact';
import { useMemo, useRef, useState } from 'preact/hooks';
import { Segmented } from '@/components/ui/Segmented';
import { Slider } from '@/components/ui/Slider';
import { StatHero, StatRow, StatTable } from '@/components/ui/Stat';
import {
  useElementWidth,
  useInView,
  usePrefersReducedMotion,
  useTween,
} from '@/components/ui/hooks';
import { barrierpaths as dict } from '@/i18n/dict/barrierpaths';
import { translator, type Lang } from '@/i18n/types';
import { scaleLinear } from '@/lib/chart';
import { fmtMillions, fmtMoney, fmtNumber, fmtPct, fmtRate } from '@/lib/format';
import { M07_CONFIG, chartLayout, onGrid } from '@/lib/m07/config';
import { M07_MARKET, directionOf, hitDays, pathsSummary, seededPaths } from '@/lib/m07/paths';
import {
  annotationBox,
  usePlayback,
  useSliderDrag,
  useSvgDrag,
  type DragTarget,
} from './m07-shared';

export interface BarrierPathsProps {
  lang: Lang;
}

const C = M07_CONFIG.paths;
const PAIR = 'USD/CHF';
const MONTH_DAYS = 365 / 12;

export default function BarrierPaths({ lang }: BarrierPathsProps): JSX.Element {
  const t = translator(dict, lang);
  const [io, setIo] = useState<'out' | 'in'>('out');
  const [barrier, setBarrier] = useState<number>(M07_CONFIG.barriers.up);
  const [seed, setSeed] = useState<number>(C.seed);
  const [sliding, onSlide] = useSliderDrag();

  const box = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const width = useElementWidth(box, 620);
  const inView = useInView(box);
  const rm = usePrefersReducedMotion();
  const L = chartLayout(width, width < 480 ? 0.8 : 0.56, 270);
  const play = usePlayback(C.days, C.msPerDay, { autoplay: true, reduced: rm, inView });

  const S = M07_MARKET.spot;
  const dir = directionOf(S, barrier);
  const paths = useMemo(() => seededPaths(M07_MARKET, C.count, C.days, seed), [seed]);
  const hits = useMemo(() => hitDays(paths, barrier, dir), [paths, barrier, dir]);
  const sum = useMemo(() => pathsSummary(barrier, io), [barrier, io]);

  /* ---------- geometry ---------- */
  const handleSpace = 20;
  const x0 = L.left;
  const x1 = L.width - L.right - handleSpace;
  const x = scaleLinear([0, C.days], [x0, x1]);
  const y = scaleLinear(C.yDomain, [L.height - L.bottom, L.top]);
  const day = play.pos;
  const dayInt = Math.floor(day);

  const drag = useSvgDrag(svg, L.width, [
    {
      key: 'barrier',
      distance: (vx, vy) => (vx >= x0 - 8 ? Math.abs(vy - y(barrier)) : Infinity),
      move: (_vx, vy) => {
        const r = C.barrier;
        setBarrier(Math.min(r.max, Math.max(r.min, onGrid(y.invert(vy), r.step))));
      },
    } satisfies DragTarget<'barrier'>,
  ]);
  const instant = rm || drag.active !== null || sliding;

  const tw = useTween(
    [sum.price * 1e4, sum.vanilla * 1e4, sum.discount, sum.touchProb],
    300,
    instant,
  );
  const [pricePips, vanillaPips, discount, prob] = tw as [number, number, number, number];

  /* ---------- paths ---------- */
  const pt = (p: number[], d: number): [number, number] => {
    const i = Math.min(Math.floor(d), p.length - 1);
    const f = d - i;
    const v = i + 1 < p.length && f > 0 ? p[i]! + (p[i + 1]! - p[i]!) * f : p[i]!;
    return [x(d), y(v)];
  };
  const poly = (p: number[], from: number, to: number): string => {
    if (to < from) return '';
    let s = '';
    for (let d = from; d <= Math.floor(to); d++) {
      const [px, py] = pt(p, d);
      s += `${s ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`;
    }
    if (to > Math.floor(to)) {
      const [px, py] = pt(p, to);
      s += `L${px.toFixed(1)},${py.toFixed(1)}`;
    }
    return s;
  };

  const touchedNow = hits.filter((h) => h !== null && h <= day).length;
  const firstHit = hits.reduce<{ i: number; d: number } | null>((best, h, i) => {
    if (h === null || h > day) return best;
    return !best || h < best.d ? { i, d: h } : best;
  }, null);

  /* ---------- texts ---------- */
  const rate = (v: number) => fmtRate(v, PAIR);
  const pips = (v: number, d = 1) => fmtNumber(v, lang, { digits: d });
  const kindLabel = t(`bp.kind.${sum.kind}`);
  const notional = fmtMillions(M07_CONFIG.market.notional, 'USD', lang);
  const months = t('bp.months');
  const summary = t('bp.summary', {
    d: dayInt,
    n: C.days,
    hits: touchedNow,
    total: C.count,
    barrier: rate(barrier),
    state: t(io === 'out' ? 'bp.count.out' : 'bp.count.in'),
    prob: fmtPct(sum.touchProb, lang, 0),
    kind: kindLabel,
    price: pips(sum.price * 1e4),
    vanilla: pips(sum.vanilla * 1e4),
  });

  /* ---------- annotation ---------- */
  let aha: JSX.Element | null = null;
  if (firstHit) {
    const [ax, ay] = pt(paths[firstHit.i]!, firstHit.d);
    const l1 = t(io === 'out' ? 'bp.aha.out.t' : 'bp.aha.in.t');
    const l2 = t(io === 'out' ? 'bp.aha.out.d' : 'bp.aha.in.d');
    const { lines, w, h } = annotationBox(l1, l2, Math.min(330, x1 - x0 - 8));
    const left = ax > (x0 + x1) / 2;
    const bx = Math.max(x0 + 4, Math.min(x1 - w - 4, left ? ax - w - 14 : ax + 14));
    const above = dir === 'down';
    const by = Math.max(
      L.top + 4,
      Math.min(L.height - L.bottom - h - 4, above ? ay - h - 16 : ay + 16),
    );
    aha = (
      <g class="m7-aha" data-aha={io}>
        <rect x={bx} y={by} width={w} height={h} rx={10} class="m7-aha-box" />
        <text x={bx + 11} y={by + 18} class="m7-aha-title">
          {l1}
        </text>
        {lines.map((line, i) => (
          <text key={i} x={bx + 11} y={by + 35 + i * 17} class="m7-aha-text">
            {line}
          </text>
        ))}
      </g>
    );
  }

  const yTicks: number[] = [];
  const step = L.compact ? 0.04 : 0.02;
  for (let v = Math.ceil(C.yDomain[0] / step) * step; v <= C.yDomain[1] + 1e-9; v += step) {
    yTicks.push(Number(v.toFixed(4)));
  }
  const months0 = [0, 1, 2, 3];
  const by = y(barrier);
  const zone =
    dir === 'up'
      ? { y: L.top, h: Math.max(0, by - L.top) }
      : { y: by, h: Math.max(0, L.height - L.bottom - by) };

  const playLabel = play.playing ? t('bp.pause') : play.done ? t('bp.replay') : t('bp.play');

  return (
    <div class="m7 bp" data-barrierpaths data-io={io} data-dir={dir}>
      <div class="ff-lab-head">
        <div class="m7-titles">
          <div class="ff-lab-title">{t('bp.title')}</div>
          <div class="ff-lab-sub">
            {t('bp.sub', {
              strike: rate(M07_CONFIG.strike),
              months,
              vol: fmtPct(M07_MARKET.vol, lang, 0),
              n: C.count,
            })}
          </div>
        </div>
      </div>

      <div class="ff-lab">
        <div class="ff-lab-main" ref={box}>
          <div class="m7-chart-head">
            <ul class="m7-legend" aria-hidden="true">
              <li>
                <span class="m7-sw m7-sw-alive" />
                {t('bp.legend.alive')}
              </li>
              <li>
                <span class={`m7-sw ${io === 'out' ? 'm7-sw-dead' : 'm7-sw-wait'}`} />
                {t(io === 'out' ? 'bp.legend.dead' : 'bp.legend.waiting')}
              </li>
              <li>
                <span class="m7-sw-ring" />
                {t('bp.legend.touch')}
              </li>
            </ul>
            <span class="m7-pill mono" data-day={dayInt}>
              {t('bp.day', { d: dayInt, n: C.days })}
            </span>
          </div>
          <svg
            ref={svg}
            viewBox={`0 0 ${L.width} ${L.height}`}
            role="img"
            aria-label={t('bp.aria', {
              months,
              barrier: rate(barrier),
              strike: rate(M07_CONFIG.strike),
              summary,
            })}
            class={`m7-svg${drag.active ? ' is-dragging' : ''}`}
            {...drag.handlers}
          >
            {yTicks.map((v) => (
              <g key={`y${v}`}>
                <path d={`M${x0},${y(v).toFixed(1)}H${x1}`} class="m7-grid" />
                <text x={x0 - 8} y={y(v) + 4} class="m7-tick" text-anchor="end">
                  {fmtRate(v, PAIR, 2)}
                </text>
              </g>
            ))}
            {months0.map((m) => (
              <text
                key={`x${m}`}
                x={x(Math.min(C.days, m * MONTH_DAYS))}
                y={L.height - 10}
                class="m7-tick"
                text-anchor={m === 0 ? 'start' : m === 3 ? 'end' : 'middle'}
              >
                {m === 0 ? t('bp.axis.today') : t('bp.axis.month', { n: m })}
              </text>
            ))}
            {/* zone beyond the barrier */}
            <rect x={x0} y={zone.y} width={x1 - x0} height={zone.h} class="m7-zone" />
            {/* strike */}
            <path d={`M${x0},${y(M07_CONFIG.strike).toFixed(1)}H${x1}`} class="m7-ref" />
            <text x={x1 - 4} y={y(M07_CONFIG.strike) - 6} class="m7-ref-label" text-anchor="end">
              {t('bp.label.strike', { v: rate(M07_CONFIG.strike) })}
            </text>
            {/* paths */}
            {paths.map((p, i) => {
              const h = hits[i] ?? null;
              const hitNow = h !== null && h <= day;
              const before = poly(p, 0, hitNow ? h! : day);
              const after = hitNow ? poly(p, h!, day) : '';
              const preCls = io === 'out' ? 'm7-path-alive' : 'm7-path-wait';
              const postCls = io === 'out' ? 'm7-path-dead' : 'm7-path-alive';
              const [hx, hy] = hitNow ? pt(p, h!) : [0, 0];
              const [ex, ey] = pt(p, day);
              const aliveEnd = io === 'out' ? !hitNow : hitNow;
              return (
                <g key={`p${seed}-${i}`} data-path={i} data-hit={h ?? ''}>
                  <path d={before} class={preCls} />
                  {after && <path d={after} class={postCls} />}
                  {aliveEnd && day > 0 && <circle cx={ex} cy={ey} r={3} class="m7-path-head" />}
                  {hitNow && (
                    <circle
                      key={`hit${seed}-${i}-${barrier}`}
                      cx={hx}
                      cy={hy}
                      r={5.5}
                      class="m7-hit m7-pop"
                      style={{ transformOrigin: `${hx}px ${hy}px` }}
                    />
                  )}
                </g>
              );
            })}
            <text
              x={x0 + 8}
              y={dir === 'up' ? L.top + 15 : L.height - L.bottom - 8}
              class="m7-zone-label"
            >
              {t(io === 'out' ? 'bp.region.out' : 'bp.region.in')}
            </text>
            {/* spot today */}
            <circle cx={x(0)} cy={y(S)} r={4.5} class="m7-spot" />
            {/* barrier with handle */}
            <path d={`M${x0},${by.toFixed(1)}H${x1}`} class="m7-barrier" />
            <text x={x0 + 8} y={dir === 'up' ? by - 7 : by + 16} class="m7-barrier-label">
              {t('bp.label.barrier', { v: rate(barrier) })}
            </text>
            <g class="m7-handle" transform={`translate(${x1 + 10},${by.toFixed(1)})`}>
              <circle r={drag.active ? 11 : 9} class="m7-handle-dot" />
              <path d="M-3.5,-2.5H3.5M-3.5,0.5H3.5M-3.5,3.5H3.5" class="m7-handle-grip" />
            </g>
            {aha}
          </svg>
          <p class="m7-hint">{t('bp.hint')}</p>
          <p class="sr-only">{summary}</p>
        </div>

        <div class="ff-lab-side">
          <div class="panel">
            <Segmented
              label={t('bp.io')}
              options={[
                { value: 'out', label: t('bp.io.out') },
                { value: 'in', label: t('bp.io.in') },
              ]}
              value={io}
              onChange={setIo}
            />
            <div onPointerDown={onSlide}>
              <Slider
                id="bp-barrier"
                label={t('bp.slider.barrier')}
                value={barrier}
                {...C.barrier}
                valueText={rate(barrier)}
                onInput={setBarrier}
                accent="var(--ff-exotics)"
              />
            </div>
            <div class="m7-buttons">
              <button type="button" class="m7-btn m7-btn-dark" onClick={play.toggle} data-play>
                <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                  {play.playing ? (
                    <path d="M4 2.5V11.5M10 2.5V11.5" class="m7-icon-stroke" />
                  ) : (
                    <path d="M4 2.2L11.5 7L4 11.8Z" class="m7-icon-fill" />
                  )}
                </svg>
                {playLabel}
              </button>
              <button
                type="button"
                class="m7-btn"
                data-reseed
                onClick={() => {
                  setSeed((s) => s + 1);
                  play.restart();
                }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                  <path d="M3 5.5A4.5 4.5 0 1 1 2.6 8.6M3 2.5V5.5H6" class="m7-icon-stroke" />
                </svg>
                {t('bp.reseed')}
              </button>
            </div>
          </div>

          <div class={`m7-counter is-${io}`} aria-hidden="true">
            <span class="m7-counter-n mono" data-count={touchedNow}>
              {touchedNow}
            </span>
            <span class="m7-counter-t">
              <b>{t(io === 'out' ? 'bp.count.out' : 'bp.count.in')}</b>
              <span>{t('bp.count.of', { n: C.count })}</span>
            </span>
          </div>

          <StatTable>
            <StatHero
              label={t('bp.price', { kind: kindLabel })}
              value={t('bp.unit.pips', { v: pips(pricePips) })}
              sub={t('bp.priceSub', {
                chf: fmtMoney((pricePips / 1e4) * M07_CONFIG.market.notional, 'CHF', lang),
                notional,
              })}
            />
            <StatRow
              label={t('bp.row.vanilla')}
              sub={t('bp.row.vanillaSub')}
              value={t('bp.unit.pips', { v: pips(vanillaPips) })}
            />
            <StatRow
              label={t(discount >= 0 ? 'bp.row.discount' : 'bp.row.dearer')}
              sub={t('bp.row.discountSub')}
              value={fmtPct(Math.abs(discount), lang, 0)}
              highlight
            />
            <StatRow
              label={t('bp.row.prob')}
              sub={t('bp.row.probSub')}
              value={fmtPct(prob, lang, 0)}
            />
          </StatTable>
          <p class="m7-note">{t('bp.note', { seed })}</p>
        </div>
      </div>
    </div>
  );
}
