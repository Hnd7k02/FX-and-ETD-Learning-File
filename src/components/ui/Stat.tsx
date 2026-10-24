/** Key figure tiles and rows (label + mono value), used in lab side panels. */
import type { ComponentChildren, JSX } from 'preact';

export function StatRow(p: {
  label: string;
  sub?: string;
  value: string;
  symbol?: ComponentChildren;
  highlight?: boolean;
}): JSX.Element {
  return (
    <div class={`ff-stat-row${p.highlight ? ' is-highlight' : ''}`}>
      {p.symbol !== undefined && <span class="ff-stat-symbol math">{p.symbol}</span>}
      <span class="ff-stat-text">
        <span class="ff-stat-label">{p.label}</span>
        {p.sub && <span class="ff-stat-sub">{p.sub}</span>}
      </span>
      <span class="ff-stat-value mono">{p.value}</span>
    </div>
  );
}

export function StatHero(p: { label: string; value: string; sub?: string }): JSX.Element {
  return (
    <div class="ff-stat-hero">
      <span class="ff-stat-hero-label">{p.label}</span>
      <span class="ff-stat-hero-value">
        <span class="ff-stat-hero-main">{p.value}</span>
        {p.sub && <span class="ff-stat-hero-sub">{p.sub}</span>}
      </span>
    </div>
  );
}

export function StatTable({ children }: { children: ComponentChildren }): JSX.Element {
  return <div class="ff-stat-table">{children}</div>;
}
