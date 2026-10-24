/**
 * Riskometer gauge geometry (DECISIONS D-06: a gauge, not a bar). Pure functions, no DOM.
 *
 * Five equal arc segments over the upper half circle, 36° each, with a 1.6° gap between
 * neighbours (0.8° trimmed from each inner edge; the outer edges at 0° and 180° stay). The needle
 * points left (180°) at position 0 and right (0°) at position 5; the position is the level index
 * plus the share within the level (see RiskSummary.needle).
 *
 * Angles are measured from the right, counter-clockwise, in degrees; SVG y points down.
 * Values match the paths in docs/design/B-Home.dc.html and Riskometer.dc.html.
 */
import { clamp, type Point } from '@/lib/chart';

export const GAUGE_SEGMENTS = 5;
export const GAUGE_GAP_DEG = 1.6;
const SWEEP = 180;
const SEGMENT = SWEEP / GAUGE_SEGMENTS;

export interface GaugeGeometry {
  width: number;
  height: number;
  cx: number;
  cy: number;
  r: number;
  /** Stroke width of the segments. */
  stroke: number;
  /** Needle length from the hub. */
  needle: number;
  /** Hub radius. */
  hub: number;
  /** Needle stroke width. */
  needleStroke: number;
}

/** Mini gauge on the home page (240 × 140). */
export const MINI_GAUGE: GaugeGeometry = {
  width: 240,
  height: 140,
  cx: 120,
  cy: 124,
  r: 96,
  stroke: 16,
  needle: 76,
  hub: 8,
  needleStroke: 4,
};

/** Full gauge on the Riskometer page (320 × 190). */
export const FULL_GAUGE: GaugeGeometry = {
  width: 320,
  height: 190,
  cx: 160,
  cy: 170,
  r: 130,
  stroke: 24,
  needle: 102,
  hub: 11,
  needleStroke: 5,
};

const rad = (deg: number) => (deg * Math.PI) / 180;

/** Point on a circle at `deg` (0 = right, 90 = top, 180 = left). */
export function polar(cx: number, cy: number, r: number, deg: number): Point {
  return [cx + r * Math.cos(rad(deg)), cy - r * Math.sin(rad(deg))];
}

const f = (n: number) => n.toFixed(2);

/** Clockwise arc (on screen) from `fromDeg` down to `toDeg` (fromDeg > toDeg). */
export function arcPath(cx: number, cy: number, r: number, fromDeg: number, toDeg: number): string {
  const [x0, y0] = polar(cx, cy, r, fromDeg);
  const [x1, y1] = polar(cx, cy, r, toDeg);
  const large = Math.abs(fromDeg - toDeg) > 180 ? 1 : 0;
  return `M${f(x0)},${f(y0)}A${r},${r} 0 ${large} 1 ${f(x1)},${f(y1)}`;
}

/** Angular extent [from, to] of segment i (0..4), inner edges trimmed by half the gap. */
export function segmentAngles(i: number, gap = GAUGE_GAP_DEG): [number, number] {
  const from = SWEEP - SEGMENT * i - (i === 0 ? 0 : gap / 2);
  const to = SWEEP - SEGMENT * (i + 1) + (i === GAUGE_SEGMENTS - 1 ? 0 : gap / 2);
  return [from, to];
}

/** The five segment paths, left (calm) to right (extreme). */
export function gaugeSegments(g: GaugeGeometry, gap = GAUGE_GAP_DEG): string[] {
  const out: string[] = [];
  for (let i = 0; i < GAUGE_SEGMENTS; i++) {
    const [from, to] = segmentAngles(i, gap);
    out.push(arcPath(g.cx, g.cy, g.r, from, to));
  }
  return out;
}

/** CSS/SVG rotation of a needle drawn pointing right: −180° at position 0, 0° at position 5. */
export function needleAngle(pos: number): number {
  return -SWEEP + SEGMENT * clamp(pos, 0, GAUGE_SEGMENTS);
}

/** Needle tip for a position 0..5. */
export function needleTip(g: GaugeGeometry, pos: number): Point {
  return polar(g.cx, g.cy, g.needle, -needleAngle(pos));
}

/** Needle path from the hub to the tip (static, as in the prototype markup). */
export function needlePath(g: GaugeGeometry, pos: number): string {
  const [x, y] = needleTip(g, pos);
  return `M${g.cx},${g.cy}L${f(x)},${f(y)}`;
}

/** Needle path pointing right, to be rotated by needleAngle(pos) around the hub. */
export const needleBasePath = (g: GaugeGeometry): string =>
  `M${g.cx},${g.cy}L${g.cx + g.needle},${g.cy}`;

/** Level index 1..5 for a needle position 0..5. */
export function levelAt(pos: number): 1 | 2 | 3 | 4 | 5 {
  const i = Math.floor(clamp(pos, 0, GAUGE_SEGMENTS - 1e-9));
  return (i + 1) as 1 | 2 | 3 | 4 | 5;
}
