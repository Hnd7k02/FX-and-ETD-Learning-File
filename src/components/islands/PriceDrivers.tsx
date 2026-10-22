/**
 * Price drivers (module 04, section 4): the six Garman-Kohlhagen inputs S, K, T, σ, rd, rf
 * as sliders; for each, arrows show whether the USD call and the USD put rise or fall when the
 * input rises (computed live, so they can flip). The chart shows call and put along the input
 * you touched last; its slope is the Greek of module 05. Put-call parity stays visible.
 * Maths in src/lib/price-drivers.ts, strings in src/i18n/dict/m04.ts (pd.*).
 */
import type { JSX } from 'preact';
import { useId, useMemo, useRef, useState } from 'preact/hooks';
import { AxisX, GridY } from '@/components/ui/Chart';
import { Legend } from '@/components/ui/Legend';
import { Slider } from '@/components/ui/Slider';
import { useElementWidth, usePrefersReducedMotion, useTween } from '@/components/ui/hooks';
import { m04 as dict } from '@/i18n/dict/m04';
import { translator, type Lang } from '@/i18n/types';
import { clamp, linePath, niceStep, niceTicks, scaleLinear, type Point } from '@/lib/chart';
import { EXAMPLE } from '@/lib/fx/example';
import type { OptionType } from '@/lib/fx/vanilla';
import { fmtMillions, fmtMoney, fmtNumber, fmtPct, fmtPips, fmtRate } from '@/lib/format';
import {
  DRIVERS,
  DRIVER_ORDER,
  bumpEffect,
  direction,
  driverCurve,
  exampleDrivers,
  pricePips,
  withDriver,
  type Direction,
  type DriverId,
  type DriverValues,
} from '@/lib/price-drivers';

export interface PriceDriversProps {
  lang: Lang;
}

const PAIR = EXAMPLE.pair;
const N = EXAMPLE.notional;
const SAMPLES = 80;

function layoutFor(w: number) {
  const width = Math.max(280, Math.round(w));
  const compact = width < 560;
  const height = compact ? 280 : Math.round(clamp(width * 0.52, 300, 370));
  return {
    width,
    height,
    compact,
    font: compact ? 11 : 12,
    left: compact ? 40 : 48,
    right: compact ? 12 : 18,
    top: 28,
    bottom: height - 50,
  };
}

function Arrow({ dir }: { dir: Direction }): JSX.Element {
  const d =
    dir === 'up'
      ? 'M6 10V2.5M2.5 6L6 2.5L9.5 6'
      : dir === 'down'
        ? 'M6 2V9.5M2.5 6L6 9.5L9.5 6'
        : 'M2 6H10';
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <path
        d={d}
        style={{
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.8,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }}
      />
    </svg>
  );
}

export default function PriceDrivers({ lang }: PriceDriversProps): JSX.Element {
  const t = translator(dict, lang);
  const uid = useId().replace(/[^A-Za-z0-9_-]/g, '');
  const rm = usePrefersReducedMotion();
  const [v, setV] = useState<DriverValues>(exampleDrivers);
  const [active, setActive] = useState<DriverId>('S');
  const [how, setHow] = useState<'init' | 'slider' | 'switch'>('init');
  const box = useRef<HTMLDivElement>(null);
  const L = layoutFor(useElementWidth(box, 600));

  const curve = useMemo(() => driverCurve(v, active, SAMPLES), [v, active]);
  const call = pricePips(v, 'call');
  const put = pricePips(v, 'put');
  const yMax = Math.max(...curve.call, ...curve.put, 50);
  const step = niceStep(yMax * 1.08, 5);
  const top = Math.ceil((yMax * 1.08) / step) * step;
  const instant = rm || how !== 'switch';
  const ys = useTween([...curve.call, ...curve.put], 300, instant);
  const dom = useTween([0, top], 300, instant);
  const prices = useTween([call, put], 300, rm || how !== 'switch');

  const def = DRIVERS[active];
  const sx = scaleLinear([def.min, def.max], [L.left, L.width - L.right]);
  const sy = scaleLinear([dom[0]!, dom[1]!], [L.bottom, L.top]);
  const n = SAMPLES + 1;
  const pts = (off: number) => curve.xs.map((x, i): Point => [sx(x), sy(ys[off + i] ?? 0)]);
  const xNow = v[def.key];

  const fmtX = (id: DriverId, x: number, digits?: number): string => {
    if (id === 'S' || id === 'K') return fmtRate(x, PAIR, digits);
    if (id === 'T') return fmtNumber(x, lang);
    return fmtPct(x, lang, digits ?? 2);
  };
  const weeksText = (w: number) =>
    w === 52
      ? t('pd.year')
      : w === 13
        ? t('pd.weeks3m')
        : w === 1
          ? t('pd.week')
          : t('pd.weeks', { n: w });
  const valueText = (id: DriverId) =>
    id === 'T' ? weeksText(v.weeks) : fmtX(id, v[DRIVERS[id].key]);
  const name = (id: DriverId) => t(`pd.${id}`, { pair: PAIR });
  const dirText = (d: Direction) => t(d === 'up' ? 'pd.up' : d === 'down' ? 'pd.down' : 'pd.flat');
  const pipsText = (x: number) => t('pd.pips', { v: fmtPips(x, lang) });
  const signed = (x: number) => t('pd.pips', { v: fmtPips(x, lang, 1, true) });

  const onDriver = (id: DriverId, x: number) => {
    setHow(active === id ? 'slider' : 'switch');
    setActive(id);
    setV((cur) => withDriver(cur, id, x));
  };
  const focusDriver = (id: DriverId) => {
    if (id === active) return;
    setHow('switch');
    setActive(id);
  };

  const effects = DRIVER_ORDER.map((id) => ({
    id,
    call: direction(v, id, 'call'),
    put: direction(v, id, 'put'),
  }));
  const effectsText = effects
    .map(
      (e) =>
        `${name(e.id)}: ${t('pd.effect', { opt: t('pd.callShort'), dir: dirText(e.call) })}, ${t('pd.effect', { opt: t('pd.putShort'), dir: dirText(e.put) })}`,
    )
    .join('; ');
  const F = v.S * Math.exp((v.rd - v.rf) * (v.weeks / 52));
  const dfd = Math.exp(-v.rd * (v.weeks / 52));
  const parity = (dfd * (F - v.K)) / 1e-4;
  const bump = (type: OptionType) => signed(bumpEffect(v, active, type));
  const xTicks = niceTicks(def.min, def.max, L.compact ? 4 : 6).filter(
    (x) => x >= def.min - 1e-9 && x <= def.max + 1e-9,
  );
  const yTicks = niceTicks(dom[0]!, dom[1]!, L.compact ? 4 : 5).filter((y) => y <= dom[1]! + 1e-9);
  const fs = `${L.font}px`;
  const aria = t('pd.aria', { driver: name(active), call: pipsText(call), put: pipsText(put) });
  const reset = () => {
    setHow('switch');
    setV(exampleDrivers());
  };

  return (
    <div class="pd" data-pd data-active={active}>
      <div class="ff-lab-head">
        <div class="pd-head-text">
          <div class="ff-lab-title">{t('pd.title')}</div>
          <div class="ff-lab-sub">{t('pd.sub', { notional: fmtMillions(N, '', lang).trim() })}</div>
        </div>
        <button type="button" class="btn btn-light pd-reset" onClick={reset} data-reset>
          {t('pd.reset')}
        </button>
      </div>
      <div class="ff-lab">
        <div class="ff-lab-main">
          <div class="pd-prices">
            <div class="pd-price pd-price--call" data-price-call={call.toFixed(3)}>
              <span class="pd-price-label">{t('pd.call')}</span>
              <span class="pd-price-main">{pipsText(prices[0]!)}</span>
              <span class="pd-price-sub">
                {fmtMoney(prices[0]! * 1e-4 * N, EXAMPLE.quote, lang)}
              </span>
            </div>
            <div class="pd-price pd-price--put" data-price-put={put.toFixed(3)}>
              <span class="pd-price-label">{t('pd.put')}</span>
              <span class="pd-price-main">{pipsText(prices[1]!)}</span>
              <span class="pd-price-sub">
                {fmtMoney(prices[1]! * 1e-4 * N, EXAMPLE.quote, lang)}
              </span>
            </div>
          </div>
          <div class="pd-parity math" data-parity>
            {t('pd.parity', { diff: fmtPips(parity, lang, 2, true) })}
          </div>
          <div class="pd-chart-head">
            <Legend
              items={[
                { label: t('pd.call'), color: 'var(--ff-long)' },
                { label: t('pd.put'), color: 'var(--ff-short)' },
              ]}
            />
            <span class="ff-pill-note pd-slope" key={active}>
              <b>{t(`pd.slope.${active}`)}</b>
            </span>
          </div>
          <div ref={box}>
            <svg viewBox={`0 0 ${L.width} ${L.height}`} role="img" aria-label={aria} class="pd-svg">
              <GridY
                y={sy}
                ticks={yTicks}
                x0={L.left}
                x1={L.width - L.right}
                format={(y) => fmtNumber(y, lang)}
                fontSize={L.font}
              />
              <text
                x={L.left}
                y={L.top - 12}
                style={{ fontSize: fs, fontWeight: 600, fill: 'var(--ff-muted)' }}
              >
                {t('pd.y')}
              </text>
              <path
                d={`M${sx(xNow).toFixed(1)},${L.top}V${L.bottom}`}
                style={{ fill: 'none', stroke: 'var(--ff-ink)', strokeWidth: 1, opacity: 0.5 }}
              />
              <path
                d={linePath(pts(n))}
                style={{
                  fill: 'none',
                  stroke: 'var(--ff-short)',
                  strokeWidth: 2.5,
                  strokeLinecap: 'round',
                  strokeLinejoin: 'round',
                }}
              />
              <path
                d={linePath(pts(0))}
                style={{
                  fill: 'none',
                  stroke: 'var(--ff-long)',
                  strokeWidth: 3,
                  strokeLinecap: 'round',
                  strokeLinejoin: 'round',
                }}
              />
              <circle
                cx={sx(xNow)}
                cy={sy(put)}
                r={5}
                style={{ fill: 'var(--ff-short)', stroke: '#fff', strokeWidth: 2.5 }}
              />
              <circle
                cx={sx(xNow)}
                cy={sy(call)}
                r={6}
                style={{ fill: 'var(--ff-long)', stroke: '#fff', strokeWidth: 2.5 }}
              />
              <AxisX
                x={sx}
                ticks={xTicks}
                y={L.bottom + L.font + 10}
                format={(x) => fmtX(active, x, active === 'S' || active === 'K' ? 2 : 0)}
                fontSize={L.font}
              />
              <text
                x={L.width - L.right}
                y={L.height - 4}
                style={{ fontSize: fs, fontWeight: 600, fill: 'var(--ff-muted)', textAnchor: 'end' }}
              >
                {t(`pd.x${active}`, { pair: PAIR })}
              </text>
            </svg>
          </div>
          <p class="pd-bump" data-bump>
            {t(`pd.bump.${active}`, { c: bump('call'), p: bump('put') })}
          </p>
          <p class="sr-only">
            {t('pd.summary', { call: pipsText(call), put: pipsText(put), effects: effectsText })}
          </p>
        </div>
        <div class="ff-lab-side">
          <div class="pd-drivers">
            {effects.map((e) => {
              const d = DRIVERS[e.id];
              return (
                <div
                  key={e.id}
                  class={`pd-driver${active === e.id ? ' is-active' : ''}`}
                  data-driver={e.id}
                  onFocusIn={() => focusDriver(e.id)}
                  onPointerDown={() => focusDriver(e.id)}
                >
                  <Slider
                    id={`pd-${uid}-${e.id}`}
                    label={name(e.id)}
                    value={v[d.key]}
                    min={d.min}
                    max={d.max}
                    step={d.step}
                    valueText={valueText(e.id)}
                    onInput={(x) => onDriver(e.id, x)}
                  />
                  <div class="pd-effects">
                    <span class={`pd-eff pd-eff--call is-${e.call}`} data-eff-call={e.call}>
                      <Arrow dir={e.call} />
                      {t('pd.callShort')}
                      <span class="sr-only">{dirText(e.call)}</span>
                    </span>
                    <span class={`pd-eff pd-eff--put is-${e.put}`} data-eff-put={e.put}>
                      <Arrow dir={e.put} />
                      {t('pd.putShort')}
                      <span class="sr-only">{dirText(e.put)}</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
