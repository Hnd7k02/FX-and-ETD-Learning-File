import { describe, expect, it } from 'vitest';
import {
  FULL_GAUGE,
  GAUGE_GAP_DEG,
  MINI_GAUGE,
  arcPath,
  gaugeSegments,
  levelAt,
  needleAngle,
  needleBasePath,
  needlePath,
  needleTip,
  polar,
  segmentAngles,
} from '@/lib/gauge';

describe('gauge geometry', () => {
  it('maps polar angles: 0 right, 90 top, 180 left', () => {
    expect(polar(120, 124, 96, 0)).toEqual([216, 124]);
    const [xt, yt] = polar(120, 124, 96, 90);
    expect(xt).toBeCloseTo(120, 9);
    expect(yt).toBeCloseTo(28, 9);
    const [xl, yl] = polar(120, 124, 96, 180);
    expect(xl).toBeCloseTo(24, 9);
    expect(yl).toBeCloseTo(124, 9);
  });

  it('splits the half circle into five equal segments with 1.6° gaps', () => {
    expect(segmentAngles(0)).toEqual([180, 144.8]);
    expect(segmentAngles(1)).toEqual([143.2, 108.8]);
    expect(segmentAngles(4)).toEqual([35.2, 0]);
    let covered = 0;
    for (let i = 0; i < 5; i++) {
      const [a, b] = segmentAngles(i);
      covered += a - b;
    }
    expect(covered).toBeCloseTo(180 - 4 * GAUGE_GAP_DEG, 9);
  });

  it('reproduces the mini gauge paths of the home prototype (240 × 140)', () => {
    const segs = gaugeSegments(MINI_GAUGE);
    expect(segs).toEqual([
      'M24.00,124.00A96,96 0 0 1 41.55,68.66',
      'M43.13,66.49A96,96 0 0 1 89.06,33.12',
      'M91.61,32.29A96,96 0 0 1 148.39,32.29',
      'M150.94,33.12A96,96 0 0 1 196.87,66.49',
      'M198.45,68.66A96,96 0 0 1 216.00,124.00',
    ]);
  });

  it('reproduces the full gauge paths of the Riskometer prototype (320 × 190)', () => {
    const segs = gaugeSegments(FULL_GAUGE);
    expect(segs[0]).toBe('M30.00,170.00A130,130 0 0 1 53.77,95.06');
    expect(segs[2]).toBe('M121.56,45.81A130,130 0 0 1 198.44,45.81');
    expect(segs[4]).toBe('M266.23,95.06A130,130 0 0 1 290.00,170.00');
  });

  it('uses the large-arc flag only beyond 180°', () => {
    expect(arcPath(0, 0, 10, 180, 0)).toContain(' 0 0 1 ');
    expect(arcPath(0, 0, 10, 270, 0)).toContain(' 0 1 1 ');
  });

  it('rotates the needle from −180° (left) to 0° (right) and clamps', () => {
    expect(needleAngle(0)).toBe(-180);
    expect(needleAngle(5)).toBe(0);
    expect(needleAngle(2.5)).toBe(-90);
    expect(needleAngle(-3)).toBe(-180);
    expect(needleAngle(9)).toBe(0);
  });

  it('matches the prototype needle at position 2.632 (level 3, −85.25°)', () => {
    const pos = (180 - 85.25) / 36;
    expect(needleAngle(pos)).toBeCloseTo(-85.25, 9);
    expect(needlePath(MINI_GAUGE, pos)).toBe('M120,124L126.29,48.26');
    const [x, y] = needleTip(FULL_GAUGE, pos);
    expect(x).toBeCloseTo(160 + 102 * Math.cos((85.25 * Math.PI) / 180), 6);
    expect(y).toBeCloseTo(170 - 102 * Math.sin((85.25 * Math.PI) / 180), 6);
    expect(needleBasePath(MINI_GAUGE)).toBe('M120,124L196,124');
  });

  it('derives the level from the needle position', () => {
    expect(levelAt(0)).toBe(1);
    expect(levelAt(0.99)).toBe(1);
    expect(levelAt(1)).toBe(2);
    expect(levelAt(2.632)).toBe(3);
    expect(levelAt(4.5)).toBe(5);
    expect(levelAt(5)).toBe(5);
    expect(levelAt(-1)).toBe(1);
  });
});
