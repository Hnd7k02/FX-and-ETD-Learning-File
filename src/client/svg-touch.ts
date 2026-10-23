/**
 * Chart handles on touch screens.
 *
 * The drag handles inside the SVG charts carry `touch-action: none` (they drag in any direction
 * or vertically: barrier lines, level handles) or `touch-action: pan-y` (they drag only sideways,
 * so a vertical swipe on them should still scroll the page). iPadOS WebKit before the fix for
 * WebKit bug 309293 (March 2026) ignores touch-action on SVG child elements: the page scrolls,
 * WebKit sends pointercancel and the drag stops after a few pixels.
 *
 * This script applies both values by hand for one-finger touches that start on an element inside
 * an <svg> (the element or one of its ancestors below the root <svg>):
 * - `none`: panning is cancelled from the start;
 * - `pan-y`: panning is cancelled once the first movement is clearly sideways; a vertical
 *   movement scrolls as usual.
 * Pointer events, which the drag code uses, keep flowing. Touches anywhere else are untouched.
 */

type Mode = 'none' | 'pan-y' | null;

/** The touch-action an SVG child element asks for (null outside SVGs or when nothing is set). */
export function svgTouchMode(target: EventTarget | null): Mode {
  let el: Element | null = target instanceof Element ? target : null;
  // walk up while inside an <svg> (ownerSVGElement is null for the root <svg> and HTML elements)
  while (el && (el as SVGElement).ownerSVGElement) {
    const ta = getComputedStyle(el).touchAction;
    if (ta === 'none') return 'none';
    if (ta === 'pan-y') return 'pan-y';
    el = el.parentElement;
  }
  return null;
}

/** Movement in px before a pan-y touch is classified as sideways or vertical. */
const SLOP = 6;

let mode: Mode = null;
let x0 = 0;
let y0 = 0;

function onStart(e: TouchEvent): void {
  mode = e.touches.length === 1 ? svgTouchMode(e.target) : null;
  if (mode === 'pan-y') {
    x0 = e.touches[0]?.clientX ?? 0;
    y0 = e.touches[0]?.clientY ?? 0;
  }
  if (mode === 'none' && e.cancelable) e.preventDefault();
}

function onMove(e: TouchEvent): void {
  if (mode === 'pan-y') {
    const t = e.touches[0];
    if (!t) return;
    const dx = Math.abs(t.clientX - x0);
    const dy = Math.abs(t.clientY - y0);
    if (dx < SLOP && dy < SLOP) return;
    mode = dx > dy ? 'none' : null; // sideways: the handle keeps the touch; vertical: scroll
  }
  if (mode === 'none' && e.cancelable) e.preventDefault();
}

function release(): void {
  mode = null;
}

if (typeof window !== 'undefined' && 'ontouchstart' in window) {
  document.addEventListener('touchstart', onStart, { passive: false });
  document.addEventListener('touchmove', onMove, { passive: false });
  document.addEventListener('touchend', release);
  document.addEventListener('touchcancel', release);
}
