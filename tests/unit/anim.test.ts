import { describe, expect, it } from 'vitest';
import { frameDelta, tweenProgress } from '@/lib/anim';

describe('frameDelta', () => {
  it('is the time since the last frame', () => {
    expect(frameDelta(1016, 1000)).toBe(16);
  });
  it('is never negative (first frame stamped before the effect read the clock)', () => {
    expect(frameDelta(995.2, 1000)).toBe(0);
    expect(frameDelta(Number.NaN, 1000)).toBe(0);
  });
  it('is capped after a long pause', () => {
    expect(frameDelta(6000, 1000, 64)).toBe(64);
    expect(frameDelta(1030, 1000, 64)).toBe(30);
  });
});

describe('tweenProgress', () => {
  it('runs from 0 to 1 over the duration', () => {
    expect(tweenProgress(1000, 1000, 400)).toBe(0);
    expect(tweenProgress(1200, 1000, 400)).toBe(0.5);
    expect(tweenProgress(1400, 1000, 400)).toBe(1);
    expect(tweenProgress(9000, 1000, 400)).toBe(1);
  });
  it('is 0 before the start and 1 without a duration', () => {
    expect(tweenProgress(990, 1000, 400)).toBe(0);
    expect(tweenProgress(990, 1000, 0)).toBe(1);
  });
});
