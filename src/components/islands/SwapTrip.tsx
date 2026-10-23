/**
 * SwapTrip (module 03, section 1): a firm holds CHF and needs USD 1 Mio. for one month. The FX
 * swap buys the dollars today (near leg) and sells them back after 30 days at a rate fixed
 * today (far leg). Playback draws a model spot path through the month: the open round trip
 * (buy spot now, sell spot later) swings with it, the swap result stays fixed. At the end the
 * "aha": the swap costs the interest differential, not FX risk.
 * Maths in src/lib/m03/trip.ts, strings in src/i18n/dict/swaptrip.ts.
 */
import type { JSX } from 'preact';
import { useId, useMemo, useRef, useState } from 'preact/hooks';
import { AxisX, GridY } from '@/components/ui/Chart';
import { Legend } from '@/components/ui/Legend';
import { Slider } from '@/components/ui/Slider';
import { StatRow, StatTable } from '@/components/ui/Stat';
import {
  useElementWidth,
  useInView,
  usePrefersReducedMotion,
  useTween,
} from '@/components/ui/hooks';
import { swaptrip as dict } from '@/i18n/dict/swaptrip';
import { translator, type Lang } from '@/i18n/types';
import { clamp, linePath, scaleLinear, type Point } from '@/lib/chart';
import { fmtMillions, fmtMoney, fmtNumber, fmtPct, fmtPips, fmtRate } from '@/lib/format';
import { M03_CONFIG, PIP } from '@/lib/m03/config';
import { innerTicks, textWidth } from '@/lib/m03/text';
import { EXAMPLE_MARKET as MK, pathAt, roundTripChf, spotPath, tripSwap } from '@/lib/m03/trip';
import { usePlayback } from './m03-shared';

export interface SwapTripProps {
  lang: Lang;
}

const C = M03_CONFIG;
const T = C.trip;
const PAIR = C.market.pair;
const RD = C.rateDigits;
const TRIP = tripSwap(MK, T.days);
const NEAR = TRIP.swap.near.rate;
const FAR = TRIP.swap.farRate;
const SWAP_CHF = -TRIP.costChf;

function layoutFor(w: number) {
  const width = Math.max(300, Math.round(w));
  const compact = width < 560;
  const height = compact ? 300 : Math.round(clamp(width * 0.5, 320, 380));
  const font = compact ? 11 : 12;
  const left = compact ? 40 : 48;
  const right = compact ? 10 : 18;
  const top = 34;
  const bottom = height - 30;
  return { width, height, compact, font, left, right: width - right, top, bottom };
}

export default function SwapTrip({ lang }: SwapTripProps): JSX.Element {
  const t = translator(dict, lang);
  const uid = useId().replace(/[^A-Za-z0-9_-]/g, '');
  const rm = usePrefersReducedMotion();
  const box = useRef<HTMLDivElement>(null);
  const inView = useInView(box);
  const L = layoutFor(useElementWidth(box, 640));

  const [seed, setSeed] = useState<number>(T.seed);
  const path = useMemo(() => spotPath(MK, T.vol, T.days, seed), [seed]);
  const play = usePlayback(T.days, T.msPerDay, { autoplay: true, reduced: rm, inView });
  const day = play.pos;
  const dayInt = Math.floor(day + 1e-9);
  const spot = pathAt(path, day);
  const open = roundTripChf(MK, spot);

  // y domain: config range, widened if the path leaves it (tweened for calm reseeds)
  const pMin = Math.min(...path);
  const pMax = Math.max(...path);
  const target: [number, number] = [
    Math.min(T.yDomain[0], pMin - 0.004),
    Math.max(T.yDomain[1], pMax + 0.004),
  ];
  const [y0, y1] = useTween(target, 300, rm || play.playing);
  const sx = scaleLinear([0, T.days], [L.left, L.right]);
  const sy = scaleLinear([y0, y1], [L.bottom, L.top]);

  // path up to the playhead (interpolated head)
  const pts: Point[] = [];
  for (let i = 0; i <= dayInt && i < path.length; i++) pts.push([sx(i), sy(path[i]!)]);
  if (dayInt + 1 < path.length && day > dayInt) pts.push([sx(day), sy(spot)]);
  const headX = sx(day);
  const headY = sy(spot);
  const nearY = sy(NEAR);
  const farX = sx(T.days);
  const farY = sy(FAR);

  const chf = (x: number, sign = false) => fmtMoney(x, C.market.quote, lang, 0, sign);
  const rate4 = (x: number) => fmtRate(x, PAIR);
  const nearTxt = rate4(NEAR);
  const farTxt = fmtRate(FAR, PAIR, RD);
  const swapTxt = chf(SWAP_CHF);
  const openTxt = chf(open, true);
  const fs = `${L.font}px`;
  const done = play.done && play.started;
  const aha = done;

  const yStep = y1 - y0 > 0.09 ? 0.04 : 0.02;
  const yTicks = innerTicks(y0, y1, yStep);
  const xTicks = [0, 10, 20, 30].filter((d) => d <= T.days);

  // open-result bracket at the head (orange), label left or right of it
  const showBracket = day > 0.05 && Math.abs(headY - nearY) > 6;
  const openLabel = t('trip.openLabel', { chf: openTxt });
  const olW = textWidth(openLabel, L.font + 1) + 6;
  const labelLeft = headX + 10 + olW > L.right;

  const chip = done
    ? t('trip.chip.done', { swap: swapTxt })
    : play.started
      ? t('trip.chip.running', { day: dayInt, days: T.days })
      : t('trip.chip.idle');
  const insight = aha
    ? t('trip.aha.text', {
        spot: rate4(spot),
        move: fmtPips((spot - NEAR) / PIP, lang, 0, true),
        open: openTxt,
        swap: swapTxt,
      })
    : play.started
      ? t('trip.insight.running', { day: dayInt, spot: rate4(spot), open: openTxt, swap: swapTxt })
      : t('trip.insight.idle');
  const aria = t('trip.aria', {
    days: T.days,
    day: dayInt,
    spot: rate4(spot),
    open: openTxt,
    swap: swapTxt,
    near: nearTxt,
    far: farTxt,
  });
  const playLabel = play.playing ? t('trip.pause') : play.done ? t('trip.replay') : t('trip.play');
  const notional = fmtMillions(C.market.notional, '', lang).trim();

  return (
    <div class="m3 trip" data-trip data-day={dayInt} data-seed={seed} data-done={done}>
      <div class="ff-lab-head">
        <div class="m3-titles">
          <div class="ff-lab-title">{t('trip.title')}</div>
          <div class="ff-lab-sub">
            {t('trip.sub', {
              notional,
              near: nearTxt,
              far: farTxt,
              days: T.days,
              rd: fmtPct(MK.rd, lang),
              rf: fmtPct(MK.rf, lang),
            })}
          </div>
        </div>
        <span class={`m3-chip${done ? ' is-dark' : ''}`} data-chip>
          {chip}
        </span>
      </div>
      <div class="ff-lab">
        <div class="ff-lab-main">
          <Legend
            items={[
              { label: t('trip.legend.spot'), color: 'var(--ff-long)', width: 2.5 },
              { label: t('trip.legend.swap'), color: 'var(--ff-forward)', width: 3 },
              { label: t('trip.legend.open'), color: 'var(--ff-short)', width: 3 },
            ]}
          />
          <div ref={box}>
            <svg viewBox={`0 0 ${L.width} ${L.height}`} role="img" aria-label={aria} class="m3-svg">
              <GridY
                y={sy}
                ticks={yTicks}
                x0={L.left}
                x1={L.right}
                format={(v) => fmtRate(v, PAIR, 2)}
                fontSize={L.font}
                axisAt={null}
              />
              <text x={L.left} y={L.top - 16} class="m3-axis-title" style={{ fontSize: fs }}>
                {t('trip.y')}
              </text>
              {/* near rate reference */}
              <path d={`M${L.left},${nearY.toFixed(1)}H${L.right}`} class="m3-ref" />
              {/* far-leg date */}
              <path d={`M${farX.toFixed(1)},${L.top}V${L.bottom}`} class="m3-ref" />
              {/* the swap: both rates fixed today */}
              <path
                d={`M${sx(0).toFixed(1)},${nearY.toFixed(1)}L${farX.toFixed(1)},${farY.toFixed(1)}`}
                class="m3-line"
                style={{ stroke: 'var(--ff-forward)' }}
              />
              {/* spot path */}
              <path d={linePath(pts)} class="m3-path" />
              {showBracket && (
                <g>
                  <path
                    d={`M${headX.toFixed(1)},${nearY.toFixed(1)}V${headY.toFixed(1)}`}
                    class="m3-bracket"
                  />
                  <text
                    x={labelLeft ? headX - 10 : headX + 10}
                    y={(nearY + headY) / 2 + L.font * 0.35}
                    class="m3-open-label"
                    style={{ fontSize: `${L.font + 1}px`, textAnchor: labelLeft ? 'end' : 'start' }}
                  >
                    {openLabel}
                  </text>
                </g>
              )}
              {play.started && <circle cx={headX} cy={headY} r={5} class="m3-head" />}
              {/* legs */}
              <circle cx={sx(0)} cy={nearY} r={6} class="m3-dot" />
              <text x={sx(0) + 10} y={nearY - 12} class="m3-leg-label" style={{ fontSize: fs }}>
                {t('trip.near', { rate: nearTxt })}
              </text>
              <circle
                cx={farX}
                cy={farY}
                r={done ? 9 : 6}
                class={`m3-dot${done ? ' is-lit' : ''}`}
              />
              <text
                x={farX - 10}
                y={farY + (farY > nearY ? -14 : 22)}
                class="m3-leg-label"
                style={{ fontSize: fs, textAnchor: 'end' }}
              >
                {t('trip.far', { rate: farTxt })}
              </text>
              <AxisX
                x={sx}
                ticks={xTicks}
                y={L.height - 6}
                format={(v) => t('trip.day.value', { day: fmtNumber(v, lang) })}
                fontSize={L.font}
              />
            </svg>
          </div>
          <div class={`m3-insight${aha ? ' is-aha' : ''}`} data-insight>
            {aha && <b>{t('trip.aha.title')}</b>}
            <span>{insight}</span>
          </div>
        </div>

        <div class="ff-lab-side">
          <div class="panel">
            <div class="m3-buttons">
              <button type="button" class="m3-btn m3-btn-dark" onClick={play.toggle} data-play>
                <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                  {play.playing ? (
                    <path d="M4 2.5V11.5M10 2.5V11.5" class="m3-icon-stroke" />
                  ) : (
                    <path d="M4 2.2L11.5 7L4 11.8Z" class="m3-icon-fill" />
                  )}
                </svg>
                {playLabel}
              </button>
              <button
                type="button"
                class="m3-btn"
                data-reseed
                onClick={() => {
                  setSeed((s) => s + 1);
                  play.restart();
                }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                  <path d="M3 5.5A4.5 4.5 0 1 1 2.6 8.6M3 2.5V5.5H6" class="m3-icon-stroke" />
                </svg>
                {t('trip.reseed')}
              </button>
            </div>
            <Slider
              id={`trip-day-${uid}`}
              label={t('trip.slider.day')}
              value={Math.round(day)}
              min={0}
              max={T.days}
              step={1}
              valueText={t('trip.day.value', { day: Math.round(day) })}
              onInput={(v) => play.seek(v)}
            />
          </div>

          <StatTable>
            <StatRow
              label={t('trip.row.spot', { day: dayInt })}
              sub={t('trip.row.spotSub', { vol: fmtPct(T.vol, lang, 0) })}
              value={rate4(spot)}
            />
            <StatRow
              symbol={
                <span
                  aria-hidden="true"
                  class="m3-sw"
                  style={{ borderTopColor: 'var(--ff-short)' }}
                />
              }
              label={t('trip.row.open')}
              sub={t('trip.row.openSub')}
              value={openTxt}
            />
            <StatRow
              symbol={
                <span
                  aria-hidden="true"
                  class="m3-sw"
                  style={{ borderTopColor: 'var(--ff-forward)' }}
                />
              }
              label={t('trip.row.swap')}
              sub={t('trip.row.swapSub')}
              value={swapTxt}
              highlight
            />
          </StatTable>
          <div class="m3-legs is-stack" data-legs>
            <div class="m3-leg">
              <span class="m3-leg-head">{t('trip.legs.near')}</span>
              <span class="m3-leg-rate">{t('trip.legs.buy', { rate: nearTxt })}</span>
              <span class="m3-flow is-in mono">
                {fmtMoney(TRIP.swap.near.base, C.market.base, lang, 0, true)}
              </span>
              <span class="m3-flow is-out mono">{chf(TRIP.swap.near.quote)}</span>
            </div>
            <div class="m3-leg">
              <span class="m3-leg-head">{t('trip.legs.far', { days: T.days })}</span>
              <span class="m3-leg-rate">{t('trip.legs.sell', { rate: farTxt })}</span>
              <span class="m3-flow is-out mono">
                {fmtMoney(TRIP.swap.far.base, C.market.base, lang, 0)}
              </span>
              <span class="m3-flow is-in mono">{chf(TRIP.swap.far.quote, true)}</span>
            </div>
          </div>
          <p class="m3-hint">{t('trip.legs.net', { chf: swapTxt, days: T.days })}</p>
          <p class="m3-hint">{t('trip.hint')}</p>
          <div class="sr-only" aria-live="polite" aria-atomic="true">
            {done ? t('trip.live.done', { days: T.days, open: openTxt, swap: swapTxt }) : ''}
          </div>
        </div>
      </div>
    </div>
  );
}
