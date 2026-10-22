/** Labelled range input in the lab style (label left, mono value right). */
import type { JSX } from 'preact';

export interface SliderProps {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  /** Visible value text, e.g. "0.8000" or "13 Wochen". */
  valueText: string;
  onInput: (v: number) => void;
  /** Optional accent colour for the thumb/track. */
  accent?: string;
  disabled?: boolean;
}

export function Slider(p: SliderProps): JSX.Element {
  return (
    <div class="ff-slider">
      <label for={p.id} class="field-label">
        <span>{p.label}</span>
        <span class="field-value" aria-hidden="true">
          {p.valueText}
        </span>
      </label>
      <input
        id={p.id}
        class="range"
        type="range"
        min={p.min}
        max={p.max}
        step={p.step}
        value={p.value}
        disabled={p.disabled}
        aria-valuetext={p.valueText}
        style={p.accent ? { accentColor: p.accent } : undefined}
        onInput={(e) => p.onInput(Number((e.currentTarget as HTMLInputElement).value))}
      />
    </div>
  );
}
