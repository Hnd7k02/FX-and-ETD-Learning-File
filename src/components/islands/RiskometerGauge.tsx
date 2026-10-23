/**
 * Full Riskometer gauge (320 × 190, FULL_GAUGE): five level arcs and a needle.
 *
 * The first sweep from the left is a CSS animation (`--ff-needle`, 1.4 s easeOutCubic, 0 ms under
 * prefers-reduced-motion), so it plays as soon as the HTML renders, before the island hydrates.
 * Later moves (pair change) are tweened here over RISKOMETER_UI.needleMoveMs with easeInOutCubic;
 * the entry animation is dropped once it has played or as soon as the needle moves by script.
 */
import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { tweenProgress } from '@/lib/anim';
import { LEVEL_COLORS, type LevelIndex } from '@/i18n/dict/levels';
import { easeInOutCubic } from '@/lib/chart';
import { FULL_GAUGE, gaugeSegments, needleAngle, needleBasePath } from '@/lib/gauge';
import { RISKOMETER_UI } from '@/lib/riskometer-ui';

/** Angle that follows `target` smoothly (instantly when `reduced`). */
export function useNeedleAngle(target: number, reduced: boolean): number {
  const [angle, setAngle] = useState(target);
  const current = useRef(target);
  current.current = angle;
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    raf.current = null;
    const from = current.current;
    if (from === target) return;
    if (reduced || typeof requestAnimationFrame === 'undefined') {
      setAngle(target);
      return;
    }
    const t0 = performance.now();
    const step = (now: number) => {
      const k = tweenProgress(now, t0, RISKOMETER_UI.needleMoveMs);
      setAngle(k >= 1 ? target : from + (target - from) * easeInOutCubic(k));
      raf.current = k < 1 ? requestAnimationFrame(step) : null;
    };
    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
      raf.current = null;
    };
  }, [target, reduced]);

  return angle;
}

export interface RiskometerGaugeProps {
  /** Needle position 0..5. */
  needle: number;
  /** Accessible description, e.g. "Tacho: Stufe Erhöht, Perzentil 76". */
  label: string;
  reduced: boolean;
}

export function RiskometerGauge(p: RiskometerGaugeProps): JSX.Element {
  const g = FULL_GAUGE;
  const segments = gaugeSegments(g);
  const target = needleAngle(p.needle);
  const angle = useNeedleAngle(target, p.reduced);
  const [entered, setEntered] = useState(false);
  const firstTarget = useRef(target);
  useEffect(() => {
    if (target !== firstTarget.current) setEntered(true);
  }, [target]);

  return (
    <svg
      class="rk-gauge"
      viewBox={`0 0 ${g.width} ${g.height}`}
      role="img"
      aria-label={p.label}
      data-needle={p.needle}
    >
      {segments.map((d, i) => (
        <path
          key={i}
          d={d}
          style={{
            fill: 'none',
            stroke: LEVEL_COLORS[(i + 1) as LevelIndex],
            strokeWidth: g.stroke,
          }}
        />
      ))}
      <g
        class="rk-needle"
        data-enter={entered ? undefined : ''}
        style={`--needle:${angle.toFixed(2)}deg`}
        onAnimationEnd={() => setEntered(true)}
      >
        <path
          d={needleBasePath(g)}
          style={{
            fill: 'none',
            stroke: 'var(--ff-ink)',
            strokeWidth: g.needleStroke,
            strokeLinecap: 'round',
          }}
        />
      </g>
      <circle
        cx={g.cx}
        cy={g.cy}
        r={g.hub}
        style={{ fill: 'var(--ff-ink)', stroke: '#fff', strokeWidth: 3 }}
      />
    </svg>
  );
}
