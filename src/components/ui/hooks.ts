/**
 * Shared Preact hooks for islands: reduced motion, element width, in-view and tweening.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { tweenProgress, tweenShouldJump } from '@/lib/anim';
import type { RefObject } from 'preact';
import { easeInOutCubic } from '@/lib/chart';

/** True when the user prefers reduced motion (updates live). */
export function usePrefersReducedMotion(): boolean {
  const [rm, setRm] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setRm(mq.matches);
    const on = (e: MediaQueryListEvent) => setRm(e.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return rm;
}

/** Width of an element in CSS pixels (ResizeObserver). `fallback` is used before mount (SSR). */
export function useElementWidth<T extends Element>(ref: RefObject<T>, fallback = 1000): number {
  const [w, setW] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    // The new width is applied in the next frame (see RiskometerChart useBoxSize).
    let raf = 0;
    const ro = new ResizeObserver((entries) => {
      const cw = entries[0]?.contentRect.width;
      if (!cw) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setW((prev) => (Math.abs(cw - prev) > 0.5 ? cw : prev)));
    });
    ro.observe(el);
    setW(el.getBoundingClientRect().width || fallback);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [ref.current]);
  return w;
}

/** True while the element is at least partly visible. */
export function useInView<T extends Element>(ref: RefObject<T>, rootMargin = '0px'): boolean {
  const [v, setV] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((es) => setV(es.some((e) => e.isIntersecting)), {
      rootMargin,
    });
    io.observe(el);
    return () => io.disconnect();
  }, [ref.current, rootMargin]);
  return v;
}

/*
 * Continuous input (D-42): the time of the last input on any range slider of the page or of the
 * last pointer drag (more than 4 px) inside a figure. While a slider or a chart handle moves, and
 * when a button in a figure is clicked again within 300 ms (a quick series of toggles or presets),
 * finite CSS animations and transitions in that figure (a pop, a ring, a fade-in, a radius
 * transition) end at once, for the frames right after each input, so nothing runs on after it.
 * A single click keeps its animation.
 */
let lastSlide = Number.NEGATIVE_INFINITY;
const QUICK_MS = 300;
const settling = new Set<Element>();
/** Frames left in which CSS animations of `settling` are ended (frame-based: slow devices too). */
let settleFrames = 0;
const SETTLE_FRAMES = 4;
const lastClick = new WeakMap<Element, number>();

function settleCss(root: Element): void {
  const r = root as Element & { getAnimations?: (o?: { subtree?: boolean }) => Animation[] };
  if (typeof r.getAnimations !== 'function') return;
  for (const a of r.getAnimations({ subtree: true })) {
    const css = 'animationName' in a || 'transitionProperty' in a;
    if (!css || a.effect?.getTiming().iterations === Number.POSITIVE_INFINITY) continue;
    try {
      a.finish();
    } catch {
      // an animation that cannot finish keeps running
    }
  }
}

function settleLoop(): void {
  for (const root of settling) settleCss(root);
  settleFrames -= 1;
  if (settleFrames > 0) requestAnimationFrame(settleLoop);
  else settling.clear();
}

/**
 * Ends the CSS animations of `root` in the next frames after an input. Counted in frames, not
 * milliseconds: on a slow device a render after the input can land two or three frames later.
 */
function settleSoon(root: Element): void {
  if (typeof requestAnimationFrame === 'undefined') return;
  const idle = settling.size === 0;
  settling.add(root);
  settleFrames = SETTLE_FRAMES;
  if (idle) requestAnimationFrame(settleLoop);
}

const islandOf = (el: Element | null) => el?.closest?.('[data-ff-island], astro-island') ?? null;

/** Where the current pointer went down (a drag counts from 4 px on). */
let down: { x: number; y: number } | null = null;

if (typeof document !== 'undefined') {
  // 'change' ends a drag on a range slider (mouse up); a render on it belongs to the same gesture
  const onRange = (e: Event) => {
    const el = e.target as HTMLInputElement | null;
    if (!el || el.type !== 'range') return;
    lastSlide = performance.now();
    const root = islandOf(el);
    if (root) settleSoon(root);
  };
  document.addEventListener('input', onRange, true);
  document.addEventListener('change', onRange, true);
  document.addEventListener(
    'pointerdown',
    (e) => {
      down = { x: e.clientX, y: e.clientY };
    },
    true,
  );
  document.addEventListener(
    'pointermove',
    (e) => {
      if (!down || e.buttons === 0) return;
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) < 4) return;
      const root = islandOf(e.target as Element | null);
      if (!root) return;
      lastSlide = performance.now();
      settleSoon(root);
    },
    true,
  );
  const up = () => {
    down = null;
  };
  document.addEventListener('pointerup', up, true);
  document.addEventListener('pointercancel', up, true);
  document.addEventListener(
    'click',
    (e) => {
      const root = islandOf(e.target as Element | null);
      if (!root) return;
      const now = performance.now();
      if (now - (lastClick.get(root) ?? Number.NEGATIVE_INFINITY) < QUICK_MS) settleSoon(root);
      lastClick.set(root, now);
    },
    true,
  );
}

/** Milliseconds since the last input on a range slider or the last drag anywhere on the page. */
export function sinceSlide(now: number = performance.now()): number {
  return now - lastSlide;
}

/**
 * Animates towards `target` (number or number[]) over `duration` ms with easeInOutCubic, but only
 * for a single, isolated change (toggle, preset, reset). A target that arrives while an animation
 * runs, within `duration` ms of the previous change or within `duration` ms of a slider input
 * jumps (slider, drag, held arrow key, playback: mouse, touch and keyboard alike), and so does
 * every change when `instant` is true (reduced motion, dragging). DECISIONS D-42.
 */
export function useTween<T extends number | number[]>(
  target: T,
  duration = 300,
  instant = false,
): T {
  const [value, setValue] = useState<T>(target);
  const from = useRef<T>(target);
  const raf = useRef<number | null>(null);
  const lastChange = useRef(Number.NEGATIVE_INFINITY);
  // end time of the running animation (the effect cleanup cancels the frame before each run)
  const animUntil = useRef(0);
  const current = useRef<T>(target);
  current.current = value;

  // A layout effect: a jump is applied before the next frame, so a value that follows a slider
  // is drawn in the same frame as the slider (also through a chain of tweens).
  useLayoutEffect(() => {
    const now = typeof performance !== 'undefined' ? performance.now() : 0;
    const running = now < animUntil.current;
    const sinceLastChange = now - lastChange.current;
    lastChange.current = now;
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    raf.current = null;
    if (
      typeof requestAnimationFrame === 'undefined' ||
      tweenShouldJump({ instant, running, sinceLastChange, duration, sinceSlide: sinceSlide(now) })
    ) {
      setValue(target);
      return;
    }
    from.current = current.current;
    const t0 = now;
    animUntil.current = now + duration;
    const step = (time: number) => {
      const k = tweenProgress(time, t0, duration);
      const e = easeInOutCubic(k);
      const a = from.current;
      let next: T;
      if (Array.isArray(target) && Array.isArray(a) && a.length === target.length) {
        next = target.map((v, i) => (a[i] as number) + (v - (a[i] as number)) * e) as T;
      } else if (typeof target === 'number' && typeof a === 'number') {
        next = (a + (target - a) * e) as T;
      } else {
        next = target;
      }
      setValue(next);
      raf.current = k < 1 ? requestAnimationFrame(step) : null;
    };
    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
      raf.current = null;
    };
  }, [Array.isArray(target) ? target.join(',') : target, duration, instant]);

  return value;
}
