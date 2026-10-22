/**
 * Shared hooks of the module 07 islands (BarrierPaths, BarrierLab, TouchLab, GapReplay):
 * playback with play/pause that pauses off-screen, and pointer dragging of chart handles that
 * leaves vertical page scrolling alone on touch screens. No strings, no maths.
 */
import type { RefObject } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';

/** Playback state of a day-by-day animation. `pos` is fractional (0 … total). */
export interface Playback {
  pos: number;
  playing: boolean;
  done: boolean;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seek: (p: number) => void;
  /** Back to 0 and play (or straight to the end under reduced motion). */
  restart: () => void;
}

/**
 * Plays from 0 to `total` at `msPerStep` per step. Starts once by itself when the figure first
 * scrolls into view (`autoplay`), never under reduced motion (then it shows the end state).
 * Pauses while off-screen and resumes when visible again.
 */
export function usePlayback(
  total: number,
  msPerStep: number,
  opts: { autoplay: boolean; reduced: boolean; inView: boolean },
): Playback {
  const [pos, setPos] = useState(0);
  const [playing, setPlaying] = useState(false);
  const started = useRef(false);
  const posRef = useRef(0);
  posRef.current = pos;

  // First visibility: autoplay, or jump to the end under reduced motion.
  useEffect(() => {
    if (started.current || !opts.inView) return;
    started.current = true;
    if (opts.reduced || !opts.autoplay) {
      setPos(total);
    } else {
      setPos(0);
      setPlaying(true);
    }
  }, [opts.inView, opts.reduced, opts.autoplay, total]);

  useEffect(() => {
    if (!playing || !opts.inView || typeof requestAnimationFrame === 'undefined') return;
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = now - last;
      last = now;
      const next = Math.min(total, posRef.current + dt / msPerStep);
      setPos(next);
      if (next >= total) {
        setPlaying(false);
        return;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, opts.inView, total, msPerStep]);

  const play = () => {
    if (posRef.current >= total) setPos(0);
    setPlaying(true);
  };
  const pause = () => setPlaying(false);
  return {
    pos,
    playing,
    done: pos >= total,
    play,
    pause,
    toggle: () => (playing ? pause() : play()),
    seek: (p: number) => {
      setPlaying(false);
      setPos(Math.max(0, Math.min(total, p)));
    },
    restart: () => {
      if (opts.reduced) {
        setPlaying(false);
        setPos(total);
      } else {
        setPos(0);
        setPlaying(true);
      }
    },
  };
}

/** A draggable handle on an SVG chart, in viewBox coordinates. */
export interface DragTarget<K extends string> {
  key: K;
  /** Distance of the pointer (viewBox units) from the handle; Infinity if not grabbable. */
  distance: (vx: number, vy: number) => number;
  /** Called with the pointer position while dragging. */
  move: (vx: number, vy: number) => void;
}

/**
 * Pointer dragging on an SVG whose viewBox is `width` units wide. A drag starts on the nearest
 * target within `grab` units (larger for touch). Touch gestures that start away from every
 * handle keep scrolling the page (CSS touch-action: pan-y on the SVG).
 */
export function useSvgDrag<K extends string>(
  svg: RefObject<SVGSVGElement>,
  width: number,
  targets: DragTarget<K>[],
  grab = { mouse: 14, touch: 26 },
): {
  active: K | null;
  handlers: {
    onPointerDown: (e: PointerEvent) => void;
    onPointerMove: (e: PointerEvent) => void;
    onPointerUp: (e: PointerEvent) => void;
    onPointerCancel: (e: PointerEvent) => void;
    onLostPointerCapture: (e: PointerEvent) => void;
  };
} {
  const [active, setActive] = useState<K | null>(null);
  const live = useRef({ targets, width, id: -1, key: null as K | null });
  live.current.targets = targets;
  live.current.width = width;

  const toView = (e: PointerEvent): [number, number] => {
    const el = svg.current;
    if (!el) return [0, 0];
    const r = el.getBoundingClientRect();
    const k = live.current.width / Math.max(1, r.width);
    return [(e.clientX - r.left) * k, (e.clientY - r.top) * k];
  };

  const onPointerDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const [vx, vy] = toView(e);
    const limit = e.pointerType === 'touch' ? grab.touch : grab.mouse;
    let best: DragTarget<K> | null = null;
    let bestD = limit;
    for (const t of live.current.targets) {
      const d = t.distance(vx, vy);
      if (d <= bestD) {
        best = t;
        bestD = d;
      }
    }
    if (!best) return;
    e.preventDefault();
    live.current.id = e.pointerId;
    live.current.key = best.key;
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    setActive(best.key);
    best.move(vx, vy);
  };
  const onPointerMove = (e: PointerEvent) => {
    if (live.current.id !== e.pointerId || live.current.key === null) return;
    const t = live.current.targets.find((x) => x.key === live.current.key);
    if (!t) return;
    const [vx, vy] = toView(e);
    t.move(vx, vy);
  };
  const end = (e: PointerEvent) => {
    if (live.current.id !== e.pointerId) return;
    live.current.id = -1;
    live.current.key = null;
    setActive(null);
  };
  return {
    active,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: end,
      onPointerCancel: end,
      onLostPointerCapture: end,
    },
  };
}

/** Hover state of an element that only matters for pointer devices (cursor hints). */
export function useHoverTarget<K extends string>(
  svg: RefObject<SVGSVGElement>,
  width: number,
  targets: DragTarget<K>[],
  grab = 14,
): [K | null, (e: PointerEvent) => void, () => void] {
  const [hover, setHover] = useState<K | null>(null);
  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    const el = svg.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const k = width / Math.max(1, r.width);
    const vx = (e.clientX - r.left) * k;
    const vy = (e.clientY - r.top) * k;
    let best: K | null = null;
    let bestD = grab;
    for (const t of targets) {
      const d = t.distance(vx, vy);
      if (d <= bestD) {
        best = t.key;
        bestD = d;
      }
    }
    if (best !== hover) setHover(best);
  };
  return [hover, onMove, () => setHover(null)];
}
