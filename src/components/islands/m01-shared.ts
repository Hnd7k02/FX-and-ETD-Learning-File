/**
 * Shared helpers of the module 01 islands: horizontal (or vertical) dragging on an SVG chart
 * with pointer events. The slider next to each chart is the accessible twin; dragging is the
 * direct, tactile path. Coordinates are converted from client pixels to viewBox units.
 */
import { useRef, useState } from 'preact/hooks';
import type { RefObject } from 'preact';

export interface DragHandlers {
  onPointerDown: (e: PointerEvent) => void;
  onPointerMove: (e: PointerEvent) => void;
  onPointerUp: (e: PointerEvent) => void;
  onPointerCancel: (e: PointerEvent) => void;
}

/**
 * Pointer drag along one axis of an SVG. `toValue` receives the pointer position in viewBox
 * units (x or y) and calls `onValue` with the data value. Returns the handlers and a flag that
 * is true while a pointer is down (use it to skip tweens while dragging).
 */
export function useSvgDrag(
  svgRef: RefObject<SVGSVGElement>,
  viewBox: { width: number; height: number },
  axis: 'x' | 'y',
  onValue: (viewBoxCoord: number) => void,
): { dragging: boolean; handlers: DragHandlers } {
  const [dragging, setDragging] = useState(false);
  const pointer = useRef<number | null>(null);

  const coord = (e: PointerEvent): number | null => {
    const el = svgRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (axis === 'x') return ((e.clientX - r.left) * viewBox.width) / Math.max(1, r.width);
    return ((e.clientY - r.top) * viewBox.height) / Math.max(1, r.height);
  };

  const handlers: DragHandlers = {
    onPointerDown: (e) => {
      if (e.button !== undefined && e.button > 0) return;
      e.preventDefault();
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
      pointer.current = e.pointerId;
      setDragging(true);
      const c = coord(e);
      if (c !== null) onValue(c);
    },
    onPointerMove: (e) => {
      if (pointer.current !== e.pointerId) return;
      const c = coord(e);
      if (c !== null) onValue(c);
    },
    onPointerUp: (e) => {
      if (pointer.current !== e.pointerId) return;
      pointer.current = null;
      setDragging(false);
    },
    onPointerCancel: (e) => {
      if (pointer.current !== e.pointerId) return;
      pointer.current = null;
      setDragging(false);
    },
  };
  return { dragging, handlers };
}

/** Rounds to a step and clamps to [lo, hi]; removes float noise (0.8 + 0.0005 · n). */
export function snap(v: number, step: number, lo: number, hi: number): number {
  const s = Math.round(v / step) * step;
  const c = Math.min(hi, Math.max(lo, s));
  return Math.round(c * 1e8) / 1e8;
}

/** True if lo ≤ v ≤ hi (a named helper keeps comparison operators out of JSX-like lines). */
export function inside(v: number, lo: number, hi: number): boolean {
  return !(v < lo || v > hi);
}
