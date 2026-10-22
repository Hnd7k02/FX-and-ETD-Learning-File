/** Segmented control (pill buttons with aria-pressed). */
import type { JSX } from 'preact';

export interface SegmentedProps<V extends string> {
  label: string;
  options: Array<{ value: V; label: string }>;
  value: V;
  onChange: (v: V) => void;
  mono?: boolean;
}

export function Segmented<V extends string>(p: SegmentedProps<V>): JSX.Element {
  return (
    <div class="segmented" role="group" aria-label={p.label}>
      {p.options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={p.value === o.value}
          class={p.mono ? 'mono' : undefined}
          onClick={() => p.onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
