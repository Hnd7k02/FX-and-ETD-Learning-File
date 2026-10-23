/**
 * Shared hooks of the module 03 islands (SwapTrip, SwapLegs, HedgeRoll, SwapCompare):
 * playback with play/pause that pauses off-screen, a pointer drag along the x axis of an SVG,
 * a "slider is being dragged" flag and a counter that rolls towards a number. No strings, no
 * maths beyond easing.
 */
import type { RefObject } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { frameDelta } from '@/lib/anim';

/** Playback state; `pos` runs from 0 to `total` (days, fractions …). */
export interface Playback {
  pos: number;
  playing: boolean;
  done: boolean;
  /** True once playback was started (by itself or by the user). */
  started: boolean;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seek: (p: number) => void;
  /** Back to 0 and play (straight to the end under reduced motion). */
  restart: () => void;
}

function prefersReduced(flag: boolean): boolean {
  return (
    flag ||
    (typeof window !== 'undefined' &&
      !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
  );
}

/**
 * Plays `pos` from 0 to `total` at `unitMs` per unit. With `autoplay` it starts once when the
 * figure first becomes visible; under reduced motion it shows the end state instead and never
 * animates. Pauses while off-screen and resumes when visible again. `initial` is the position
 * shown before anything plays (e.g. the end state for a figure without autoplay).
 */
export function usePlayback(
  total: number,
  unitMs: number,
  opts: { autoplay: boolean; reduced: boolean; inView: boolean; initial?: number },
): Playback {
  const [pos, setPos] = useState(opts.initial ?? 0);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const first = useRef(false);
  const posRef = useRef(pos);
  posRef.current = pos;

  useEffect(() => {
    if (first.current || !opts.inView) return;
    first.current = true;
    if (!opts.autoplay) return;
    if (prefersReduced(opts.reduced)) {
      setPos(total);
      setStarted(true);
    } else {
      setPos(0);
      setPlaying(true);
      setStarted(true);
    }
  }, [opts.inView, opts.reduced, opts.autoplay, total]);

  useEffect(() => {
    if (!playing || !opts.inView || typeof requestAnimationFrame === 'undefined') return;
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = frameDelta(now, last, 64);
      last = now;
      const next = Math.min(total, Math.max(0, posRef.current + dt / unitMs));
      setPos(next);
      if (next >= total) {
        setPlaying(false);
        return;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, opts.inView, total, unitMs]);

  const play = () => {
    setStarted(true);
    if (prefersReduced(opts.reduced)) {
      setPos(total);
      return;
    }
    if (posRef.current >= total) setPos(0);
    setPlaying(true);
  };
  const pause = () => setPlaying(false);
  return {
    pos,
    playing,
    done: pos >= total,
    started,
    play,
    pause,
    toggle: () => (playing ? pause() : play()),
    seek: (p: number) => {
      setStarted(true);
      setPlaying(false);
      setPos(Math.max(0, Math.min(total, p)));
    },
    restart: () => {
      setStarted(true);
      if (prefersReduced(opts.reduced)) {
        setPlaying(false);
        setPos(total);
      } else {
        setPos(0);
        setPlaying(true);
      }
    },
  };
}

/**
 * Horizontal pointer drag on an SVG whose viewBox is `width` units wide: the handler receives
 * the pointer's x in viewBox units. Pointer capture keeps the drag alive outside the handle.
 */
export function useDragX(
  svg: RefObject<SVGSVGElement>,
  width: number,
  onX: (vx: number) => void,
): {
  dragging: boolean;
  handlers: {
    onPointerDown: (e: PointerEvent) => void;
    onPointerMove: (e: PointerEvent) => void;
    onPointerUp: (e: PointerEvent) => void;
    onPointerCancel: (e: PointerEvent) => void;
  };
} {
  const [dragging, setDragging] = useState(false);
  const id = useRef<number | null>(null);
  const live = useRef({ width, onX });
  live.current = { width, onX };
  const toX = (e: PointerEvent) => {
    const el = svg.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    return ((e.clientX - r.left) * live.current.width) / Math.max(1, r.width);
  };
  const end = (e: PointerEvent) => {
    if (id.current !== e.pointerId) return;
    id.current = null;
    setDragging(false);
  };
  return {
    dragging,
    handlers: {
      onPointerDown: (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        e.preventDefault();
        (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
        id.current = e.pointerId;
        setDragging(true);
        live.current.onX(toX(e));
      },
      onPointerMove: (e) => {
        if (id.current !== e.pointerId) return;
        live.current.onX(toX(e));
      },
      onPointerUp: end,
      onPointerCancel: end,
    },
  };
}

/**
 * True while the pointer is down on a slider, so charts follow it instantly instead of
 * tweening. Returns the flag and the onPointerDown handler for the slider's wrapper.
 */
export function useSliderDrag(): [boolean, () => void] {
  const [sliding, setSliding] = useState(false);
  useEffect(() => {
    if (!sliding) return;
    const up = () => setSliding(false);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [sliding]);
  return [sliding, () => setSliding(true)];
}
