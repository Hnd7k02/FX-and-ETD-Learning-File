/**
 * Shared Preact hooks for islands: reduced motion, element width, in-view and tweening.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import { tweenProgress } from '@/lib/anim';
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

/**
 * Smoothly animates towards `target` (number or number[]) over `duration` ms with easeInOutCubic.
 * Jumps immediately when `instant` is true (e.g. reduced motion or while dragging a slider).
 */
export function useTween<T extends number | number[]>(
  target: T,
  duration = 300,
  instant = false,
): T {
  const [value, setValue] = useState<T>(target);
  const from = useRef<T>(target);
  const raf = useRef<number | null>(null);
  const current = useRef<T>(target);
  current.current = value;

  useEffect(() => {
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    if (instant || duration <= 0 || typeof requestAnimationFrame === 'undefined') {
      setValue(target);
      return;
    }
    from.current = current.current;
    const t0 = performance.now();
    const step = (now: number) => {
      const k = tweenProgress(now, t0, duration);
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
      if (k < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
    };
  }, [Array.isArray(target) ? target.join(',') : target, duration, instant]);

  return value;
}
