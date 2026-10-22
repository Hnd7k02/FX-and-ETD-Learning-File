/**
 * History chart of the Riskometer: weekly realised 1-month vol since 2006 (area 10 % blue + 2 px
 * line), year ticks, crosshair with tooltip (pointer and touch), the current value tagged "Heute",
 * event markers (≥ 44 px hit area) and a dashed stem under the selected event.
 *
 * The viewBox equals the container width in CSS px so labels keep their size; under
 * RISKOMETER_UI.compactBelow the layout is compact and the event buttons move into a chip row
 * below the chart (the dots in the chart stay as markers), because the 44 px hit areas of
 * neighbouring events would overlap on a phone.
 *
 * A pair change morphs the line and the y-axis together (same weekly dates for every pair).
 */
import type { JSX } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { AxisX, GridY } from '@/components/ui/Chart';
import { useElementWidth } from '@/components/ui/hooks';
import type { Lang } from '@/i18n/types';
import { easeInOutCubic, linePath, nearestIndex, type Point } from '@/lib/chart';
import { fmtDate, fmtPctValue } from '@/lib/format';
import {
  RISKOMETER_UI,
  layoutFor,
  lerpArray,
  stackTags,
  tipShift,
  xScaleFor,
  yAxisMax,
  yScaleFor,
  yTicksFor,
  yearStart,
  yearTicks,
} from '@/lib/riskometer-ui';

export interface ChartMarker {
  id: string;
  year: string;
  /** Index into the weekly series. */
  week: number;
  /** Accessible name of the button. */
  aria: string;
}

export interface RiskometerChartProps {
  lang: Lang;
  dates: string[];
  /** Day numbers of `dates`. */
  days: number[];
  /** Weekly vol of the selected pair (percent). */
  vols: number[];
  markers: ChartMarker[];
  selected: string | null;
  onSelect: (id: string) => void;
  reduced: boolean;
  label: string;
  summaryId: string;
  todayTag: string;
  eventsGroupLabel: string;
}

interface Morph {
  vals: number[];
  yMax: number;
}

/** Tweens the series and the y-axis top together (instant when `instant`). */
function useSeriesMorph(target: number[], yMaxTarget: number, instant: boolean): Morph {
  const [state, setState] = useState<Morph>({ vals: target, yMax: yMaxTarget });
  const current = useRef(state);
  current.current = state;
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    raf.current = null;
    const from = current.current;
    if (from.vals === target && from.yMax === yMaxTarget) return;
    if (instant || typeof requestAnimationFrame === 'undefined') {
      setState({ vals: target, yMax: yMaxTarget });
      return;
    }
    const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / RISKOMETER_UI.morphMs);
      const e = easeInOutCubic(k);
      setState(
        k >= 1
          ? { vals: target, yMax: yMaxTarget }
          : { vals: lerpArray(from.vals, target, e), yMax: from.yMax + (yMaxTarget - from.yMax) * e },
      );
      raf.current = k < 1 ? requestAnimationFrame(step) : null;
    };
    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
      raf.current = null;
    };
  }, [target, yMaxTarget, instant]);

  return state;
}

export function RiskometerChart(p: RiskometerChartProps): JSX.Element {
  const box = useRef<HTMLDivElement>(null);
  const width = useElementWidth(box, 1000);
  const layout = layoutFor(width);
  const yMaxTarget = useMemo(() => yAxisMax(Math.max(...p.vols)), [p.vols]);
  const { vals, yMax } = useSeriesMorph(p.vols, yMaxTarget, p.reduced);
  const [hover, setHover] = useState<number | null>(null);

  const n = p.days.length;
  const x = xScaleFor(p.days, layout);
  const y = yScaleFor(yMax, layout);
  const axisY = layout.height - layout.bottom;
  const W = layout.width;
  const H = layout.height;

  const pts: Point[] = new Array(n);
  for (let i = 0; i < n; i++) pts[i] = [x(p.days[i]!), y(vals[i] ?? 0)];
  const line = linePath(pts);
  const area = n
    ? `${line}L${pts[n - 1]![0].toFixed(1)},${axisY}L${pts[0]![0].toFixed(1)},${axisY}Z`
    : '';

  const years = yearTicks(p.dates[0] ?? '2006-01-01', p.dates[n - 1] ?? '2026-01-01', layout.yearStep);
  const yearDays = years.map(yearStart);
  const yearOf = new Map(yearDays.map((d, i) => [d, years[i]!]));
  const xTicks = yearDays.filter((d) => {
    const px = x(d);
    return px >= layout.left - 10 && px <= W - layout.right + 10;
  });

  const markerPos = p.markers.map((m) => {
    const i = Math.min(Math.max(m.week, 0), n - 1);
    return { m, px: pts[i]?.[0] ?? 0, py: pts[i]?.[1] ?? 0 };
  });
  const rows = stackTags(markerPos.map((k) => k.px));
  const sel = markerPos.find((k) => k.m.id === p.selected);

  const last = pts[n - 1];
  const todayTop = last ? (last[1] / H) * 100 : 0;

  const pointAt = (e: PointerEvent) => {
    const el = box.current;
    if (!el || n === 0) return null;
    const r = el.getBoundingClientRect();
    if (r.width <= 0) return null;
    const fx = ((e.clientX - r.left) / r.width) * W;
    if (fx < layout.left - 12 || fx > W - layout.right + 12) return null;
    return nearestIndex(p.days, x.invert(fx));
  };
  const onMove = (e: PointerEvent) => {
    const i = pointAt(e);
    if (i !== hover) setHover(i);
  };
  const onLeave = (e: PointerEvent) => {
    // A finger lifts after a tap: keep the tooltip so the value can be read.
    if (e.pointerType !== 'touch') setHover(null);
  };

  const hx = hover !== null ? (pts[hover]?.[0] ?? 0) : 0;
  const hy = hover !== null ? (pts[hover]?.[1] ?? 0) : 0;
  const tipLeft = (hx / W) * 100;
  const fs = layout.font;

  const markerButton = (k: (typeof markerPos)[number], row: number) => {
    const on = k.m.id === p.selected;
    return (
      <button
        key={k.m.id}
        type="button"
        class="rk-ev"
        data-event={k.m.id}
        aria-pressed={on}
        aria-label={k.m.aria}
        style={{ left: `${((k.px / W) * 100).toFixed(2)}%`, top: `${((k.py / H) * 100).toFixed(2)}%` }}
        onClick={() => p.onSelect(k.m.id)}
      >
        <span class="rk-ev-tag" style={{ bottom: `${30 + row * RISKOMETER_UI.tagRow}px` }}>
          {k.m.year}
        </span>
        <span class="rk-ev-dot" aria-hidden="true" />
      </button>
    );
  };

  return (
    <div class="rk-chart-block">
      <div
        class="rk-chart"
        ref={box}
        data-compact={layout.compact ? 'true' : undefined}
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={onLeave}
        onPointerCancel={() => setHover(null)}
      >
        <svg
          class="rk-svg"
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={p.label}
          aria-describedby={p.summaryId}
        >
          <GridY
            y={y}
            ticks={yTicksFor(yMax)}
            x0={layout.left}
            x1={W - layout.right}
            format={(v) => fmtPctValue(v, p.lang, 0)}
            fontSize={fs}
          />
          <AxisX
            x={x}
            ticks={xTicks}
            y={axisY + fs + 14}
            format={(d) => String(yearOf.get(d) ?? '')}
            fontSize={fs}
          />
          <path d={area} class="rk-area" />
          <path d={line} class="rk-line" />
          {sel && <path d={`M${sel.px.toFixed(1)},${sel.py.toFixed(1)}V${axisY}`} class="rk-stem" />}
          {hover !== null && (
            <g class="rk-hover">
              <path d={`M${hx.toFixed(1)},${layout.top}V${axisY}`} class="rk-cross" />
              <circle cx={hx.toFixed(1)} cy={hy.toFixed(1)} r="5" class="rk-hover-dot" />
            </g>
          )}
          {last && <circle cx={last[0].toFixed(1)} cy={last[1].toFixed(1)} r="5" class="rk-last" />}
        </svg>

        {layout.compact
          ? markerPos.map((k) => (
              <span
                key={k.m.id}
                class="rk-ev rk-ev-static"
                data-selected={k.m.id === p.selected ? 'true' : undefined}
                aria-hidden="true"
                style={{
                  left: `${((k.px / W) * 100).toFixed(2)}%`,
                  top: `${((k.py / H) * 100).toFixed(2)}%`,
                }}
              >
                <span class="rk-ev-dot" />
              </span>
            ))
          : markerPos.map((k, i) => markerButton(k, rows[i] ?? 0))}

        {last && (
          <span class="rk-today-tag" style={{ top: `${todayTop.toFixed(2)}%` }} data-today-tag>
            {p.todayTag}
          </span>
        )}

        {hover !== null && (
          <div
            class="rk-tip"
            data-tip
            style={{ left: `${tipLeft.toFixed(2)}%`, transform: `translateX(${tipShift(tipLeft)}%)` }}
          >
            <span class="rk-tip-date">{fmtDate(p.dates[hover] ?? '', p.lang)}</span>
            <b>{fmtPctValue(vals[hover] ?? 0, p.lang, 1)}</b>
          </div>
        )}
      </div>

      {layout.compact && (
        <div class="rk-ev-row" role="group" aria-label={p.eventsGroupLabel}>
          {p.markers.map((m) => (
            <button
              key={m.id}
              type="button"
              class="rk-ev-chip mono"
              data-event-chip={m.id}
              aria-pressed={m.id === p.selected}
              aria-label={m.aria}
              onClick={() => p.onSelect(m.id)}
            >
              {m.year}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
