import { describe, expect, it } from 'vitest';
import {
  areaPath,
  clamp,
  easeInOutCubic,
  easeOutCubic,
  lerpPoints,
  linePath,
  nearestIndex,
  niceStep,
  niceTicks,
  project,
  sample,
  scaleLinear,
  tangentSegment,
} from '@/lib/chart';

describe('scaleLinear', () => {
  it('maps and inverts', () => {
    const s = scaleLinear([0.74, 0.86], [48, 628]);
    expect(s(0.74)).toBe(48);
    expect(s(0.86)).toBeCloseTo(628, 10);
    expect(s.invert(s(0.8))).toBeCloseTo(0.8, 12);
    expect(s.domain).toEqual([0.74, 0.86]);
  });
  it('handles a degenerate domain', () => {
    const s = scaleLinear([1, 1], [0, 100]);
    expect(s(5)).toBe(0);
    expect(s.invert(50)).toBe(1);
  });
});

describe('nice ticks', () => {
  it('chooses 1-2-2.5-5 steps', () => {
    expect(niceStep(10, 5)).toBe(2);
    expect(niceStep(1600, 4)).toBe(500);
    expect(niceStep(0.12, 6)).toBeCloseTo(0.02, 12);
    expect(niceStep(12, 5)).toBe(2.5);
    expect(niceStep(0)).toBe(1);
    expect(niceStep(90, 2)).toBe(50);
  });
  it('covers the range', () => {
    expect(niceTicks(-800, 800, 4)).toEqual([-500, 0, 500]);
    expect(niceTicks(0.74, 0.86, 6)).toEqual([0.74, 0.76, 0.78, 0.8, 0.82, 0.84, 0.86]);
    expect(niceTicks(10, 0, 5)).toEqual([0, 2, 4, 6, 8, 10]);
  });
});

describe('paths', () => {
  it('samples and builds line and area paths', () => {
    const pts = sample((x) => x * 2, 0, 1, 2);
    expect(pts).toEqual([
      [0, 0],
      [0.5, 1],
      [1, 2],
    ]);
    expect(linePath(pts)).toBe('M0.0,0.0L0.5,1.0L1.0,2.0');
    expect(
      linePath([
        [0, 0],
        [1, NaN],
        [2, 2],
      ]),
    ).toBe('M0.0,0.0M2.0,2.0');
    expect(
      areaPath(pts, [
        [0, 0],
        [1, 0],
      ]),
    ).toBe('M0.0,0.0L0.5,1.0L1.0,2.0L1.0,0.0L0.0,0.0Z');
    expect(areaPath([], pts)).toBe('');
    expect(
      project(
        pts,
        (x) => x * 10,
        (y) => -y,
      ),
    ).toEqual([
      [0, -0],
      [5, -1],
      [10, -2],
    ]);
  });
});

describe('tangent clipping', () => {
  it('clips to the y range', () => {
    const [a, ya, b, yb] = tangentSegment(0.8, 100, 5000, 0.775, 0.825, 0, 800);
    expect(a).toBeCloseTo(0.78, 10);
    expect(ya).toBeCloseTo(0, 8);
    expect(b).toBeCloseTo(0.825, 10);
    expect(yb).toBeCloseTo(225, 8);
  });
  it('keeps flat tangents whole', () => {
    expect(tangentSegment(0.8, 0.5, 0, 0.7, 0.9, 0, 1)).toEqual([0.7, 0.5, 0.9, 0.5]);
  });
});

describe('easing and morphing', () => {
  it('eases', () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(0.5)).toBe(0.5);
    expect(easeInOutCubic(1)).toBe(1);
    expect(easeInOutCubic(0.25)).toBeCloseTo(0.0625, 12);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(0.5)).toBeCloseTo(0.875, 12);
  });
  it('interpolates point lists', () => {
    expect(
      lerpPoints(
        [
          [0, 0],
          [1, 1],
        ],
        [
          [2, 2],
          [3, 3],
        ],
        0.5,
      ),
    ).toEqual([
      [1, 1],
      [2, 2],
    ]);
  });
  it('clamps and finds nearest indices', () => {
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(-5, 0, 1)).toBe(0);
    expect(nearestIndex([0, 1, 2, 3], 2.4)).toBe(2);
    expect(nearestIndex([0, 1, 2, 3], 2.6)).toBe(3);
    expect(nearestIndex([0, 1, 2, 3], -1)).toBe(0);
    expect(nearestIndex([], 1)).toBe(-1);
  });
});
