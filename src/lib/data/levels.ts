/**
 * Riskometer levels and gauge needle (MASTER_PROMPT §9).
 *
 * Levels, by the thresholds of the pair (daily values since 2006):
 *   1 Ruhig   v < P20
 *   2 Normal  P20 ≤ v < P60
 *   3 Erhöht  P60 ≤ v < P85
 *   4 Hoch    P85 ≤ v < P97
 *   5 Extrem  P97 ≤ v
 *
 * Needle (0..5): the gauge has five segments of equal width. The needle stands at
 * segment index + share within the level, where the share is measured in percentile space:
 * level k spans the percentile ranks LEVEL_BOUNDS[k−1] … LEVEL_BOUNDS[k], so a value with
 * percentile rank 76 (level Erhöht, 60 … 85) sits at 2 + (76 − 60)/(85 − 60) = 2.64.
 * Extrem runs from P97 to P100 = historical maximum; values at or above it are clamped to 5.
 */
import type { LevelIndex } from '@/i18n/dict/levels';
import { percentileRank, type Thresholds } from './stats';

/** Percentile bounds of the five levels. */
export const LEVEL_BOUNDS = [0, 20, 60, 85, 97, 100] as const;

export function levelOf(value: number, t: Pick<Thresholds, 'p20' | 'p60' | 'p85' | 'p97'>): LevelIndex {
  if (value < t.p20) return 1;
  if (value < t.p60) return 2;
  if (value < t.p85) return 3;
  if (value < t.p97) return 4;
  return 5;
}

/**
 * Needle position 0..5 for a value, given the thresholds and the ascending daily values of the
 * percentile base (the same sample the thresholds were computed from).
 */
export function needle(value: number, t: Thresholds, sorted: readonly number[]): number {
  const level = levelOf(value, t);
  if (value >= t.max) return 5;
  const lo = LEVEL_BOUNDS[level - 1]!;
  const hi = LEVEL_BOUNDS[level]!;
  const share = (percentileRank(sorted, value) - lo) / (hi - lo);
  // The level comes from interpolated thresholds and the rank from the empirical distribution;
  // right at a threshold they can disagree by one observation, so keep the needle in its level.
  return level - 1 + Math.min(1, Math.max(0, share));
}

/** Gauge angle in degrees for a needle position: 0 → −180° (left), 5 → 0° (right). */
export function needleAngle(n: number): number {
  return -180 + (Math.min(5, Math.max(0, n)) / 5) * 180;
}
