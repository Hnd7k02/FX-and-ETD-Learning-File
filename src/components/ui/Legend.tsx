/** Chart legend: line samples with labels (solid, dashed or area). */
import type { JSX } from 'preact';

export interface LegendItem {
  label: string;
  color: string;
  kind?: 'line' | 'dashed' | 'area';
  width?: number;
}

export function Legend({ items }: { items: LegendItem[] }): JSX.Element {
  return (
    <ul class="ff-legend">
      {items.map((it) => (
        <li key={it.label}>
          <span
            aria-hidden="true"
            class="ff-legend-swatch"
            style={
              it.kind === 'area'
                ? { borderTop: `10px solid ${it.color}` }
                : {
                    borderTop: `${it.width ?? 3}px ${it.kind === 'dashed' ? 'dashed' : 'solid'} ${it.color}`,
                  }
            }
          />
          <span>{it.label}</span>
        </li>
      ))}
    </ul>
  );
}
