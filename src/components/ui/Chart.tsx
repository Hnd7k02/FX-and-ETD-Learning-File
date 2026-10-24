/**
 * SVG chart primitives in the Forward First style: 1 px gridlines (#EEF0F3), darker axis (#C9CDD4),
 * labels 12–13 px in --ff-muted. All coordinates are in viewBox units.
 */
import type { ComponentChildren, JSX } from 'preact';
import type { Scale } from '@/lib/chart';

export interface ChartSvgProps {
  width: number;
  height: number;
  label: string;
  children: ComponentChildren;
  class?: string;
}

/** Responsive SVG with role="img" and an aria-label. */
export function ChartSvg(p: ChartSvgProps): JSX.Element {
  return (
    <svg
      viewBox={`0 0 ${p.width} ${p.height}`}
      role="img"
      aria-label={p.label}
      class={p.class}
      style={{
        display: 'block',
        width: '100%',
        height: 'auto',
        overflow: 'visible',
        fontFamily: 'var(--ff-font-ui)',
      }}
    >
      {p.children}
    </svg>
  );
}

export interface GridYProps {
  y: Scale;
  ticks: number[];
  x0: number;
  x1: number;
  format: (v: number) => string;
  /** Value drawn as the darker axis line (default 0 if in range). */
  axisAt?: number | null;
  fontSize?: number;
  labelX?: number;
}

/** Horizontal gridlines with labels on the left. */
export function GridY(p: GridYProps): JSX.Element {
  const fs = p.fontSize ?? 12;
  const axis = p.axisAt === undefined ? 0 : p.axisAt;
  return (
    <g>
      {p.ticks.map((t) => (
        <g key={t}>
          <path
            d={`M${p.x0},${p.y(t).toFixed(1)}H${p.x1}`}
            style={{
              fill: 'none',
              stroke:
                axis !== null && Math.abs(t - axis) < 1e-12 ? 'var(--ff-axis)' : 'var(--ff-grid)',
              strokeWidth: 1,
            }}
          />
          <text
            x={p.labelX ?? p.x0 - 8}
            y={p.y(t) + fs * 0.33}
            style={{ fontSize: `${fs}px`, fill: 'var(--ff-muted)', textAnchor: 'end' }}
          >
            {p.format(t)}
          </text>
        </g>
      ))}
    </g>
  );
}

export interface AxisXProps {
  x: Scale;
  ticks: number[];
  y: number;
  format: (v: number) => string;
  fontSize?: number;
  title?: string;
  titleX?: number;
}

/** Tick labels below the plot (no tick marks, like the prototypes) and an optional axis title. */
export function AxisX(p: AxisXProps): JSX.Element {
  const fs = p.fontSize ?? 12;
  return (
    <g>
      {p.ticks.map((t) => (
        <text
          key={t}
          x={p.x(t)}
          y={p.y}
          style={{ fontSize: `${fs}px`, fill: 'var(--ff-muted)', textAnchor: 'middle' }}
        >
          {p.format(t)}
        </text>
      ))}
      {p.title && (
        <text
          x={p.titleX ?? p.x.range[1]}
          y={p.y - fs - 6}
          style={{
            fontSize: `${fs}px`,
            fontWeight: 600,
            fill: 'var(--ff-muted)',
            textAnchor: 'end',
          }}
        >
          {p.title}
        </text>
      )}
    </g>
  );
}

/** Vertical dashed reference line (strike, barrier …) with an optional label. */
export function RefLineX(p: {
  x: number;
  y0: number;
  y1: number;
  label?: string;
  color?: string;
  dash?: string;
  fontSize?: number;
  anchor?: 'start' | 'end';
}): JSX.Element {
  const fs = p.fontSize ?? 12;
  const color = p.color ?? 'var(--ff-ref)';
  return (
    <g>
      <path
        d={`M${p.x.toFixed(1)},${p.y0}V${p.y1}`}
        style={{ fill: 'none', stroke: color, strokeWidth: 1, strokeDasharray: p.dash ?? '4 5' }}
      />
      {p.label && (
        <text
          x={p.x + (p.anchor === 'end' ? -8 : 8)}
          y={Math.min(p.y0, p.y1) + fs + 4}
          style={{
            fontSize: `${fs}px`,
            fontWeight: 600,
            fill: 'var(--ff-ink-2)',
            textAnchor: p.anchor ?? 'start',
          }}
        >
          {p.label}
        </text>
      )}
    </g>
  );
}
