/**
 * Chart handles on touch screens.
 *
 * The drag handles inside the SVG charts (barrier lines, level handles, rail handles) carry
 * `touch-action: none` so that a finger drags them instead of scrolling the page. iPadOS WebKit
 * before the fix for WebKit bug 309293 (March 2026) ignores touch-action on SVG child elements:
 * the page scrolls, WebKit sends pointercancel and the drag stops after a few pixels.
 *
 * This script applies the rule by hand. A one-finger touch that starts on an element inside an
 * <svg> whose computed touch-action is "none" (the element or one of its ancestors below the root
 * <svg>) cancels the browser's panning for that touch. Pointer events, which the drag code uses,
 * keep flowing. Touches anywhere else scroll as usual.
 */

let locked = false;

/** True when the touch starts on an SVG child element that asks for touch-action: none. */
export function startsOnSvgHandle(target: EventTarget | null): boolean {
  let el: Element | null = target instanceof Element ? target : null;
  // walk up while inside an <svg> (ownerSVGElement is null for the root <svg> and HTML elements)
  while (el && (el as SVGElement).ownerSVGElement) {
    if (getComputedStyle(el).touchAction === 'none') return true;
    el = el.parentElement;
  }
  return false;
}

function onStart(e: TouchEvent): void {
  locked = e.touches.length === 1 && startsOnSvgHandle(e.target);
  if (locked && e.cancelable) e.preventDefault();
}

function onMove(e: TouchEvent): void {
  if (locked && e.cancelable) e.preventDefault();
}

function release(): void {
  locked = false;
}

if (typeof window !== 'undefined' && 'ontouchstart' in window) {
  document.addEventListener('touchstart', onStart, { passive: false });
  document.addEventListener('touchmove', onMove, { passive: false });
  document.addEventListener('touchend', release);
  document.addEventListener('touchcancel', release);
}
