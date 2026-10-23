/**
 * Timing helpers for requestAnimationFrame loops.
 *
 * The timestamp of the first frame can be earlier than a performance.now() read in the effect
 * that requested it (the frame started before the effect ran, e.g. after a long task on a slow
 * device). Unclamped, that gives a negative step: a playback position below 0 and an index of −1.
 * After a tab returns from the background the step can also be very large; `max` caps it.
 */

/** Milliseconds since the previous frame, never negative and at most `max`. */
export function frameDelta(now: number, last: number, max = Number.POSITIVE_INFINITY): number {
  const dt = now - last;
  if (!(dt > 0)) return 0;
  return Math.min(max, dt);
}

/** Progress 0…1 of a tween that started at `t0` and lasts `duration` ms. */
export function tweenProgress(now: number, t0: number, duration: number): number {
  if (!(duration > 0)) return 1;
  const k = (now - t0) / duration;
  if (!(k > 0)) return 0;
  return Math.min(1, k);
}

/**
 * Tween rule (DECISIONS D-42): a new target jumps when it arrives while an animation runs or
 * within `duration` ms of the previous change — that is continuous input (slider, drag, held
 * arrow key, playback), where an ease-in-out restarted on every frame would lag behind and snap
 * back. Only a single, isolated change (toggle, preset, reset) animates.
 */
export function tweenShouldJump(o: {
  instant: boolean;
  running: boolean;
  sinceLastChange: number;
  duration: number;
}): boolean {
  return o.instant || o.running || !(o.duration > 0) || o.sinceLastChange < o.duration;
}
