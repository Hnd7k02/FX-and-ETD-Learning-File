/**
 * SwapLegs (module 03, section 2): the two legs of an FX swap on USD 1 Mio.
 * Top: cash flows from the client's view at the near date (spot) and the far date, as arrows
 * (up = receive, blue; down = pay, orange) with amounts in both currencies. Middle: the forward
 * curve over one year with the near point (spot) and the far point (draggable along the curve,
 * snaps to the tenors); the bracket between them is the swap points. Below: the cash-flow
 * table and the "aha": swap points = forward points = the interest differential.
 * Controls: direction (buy/sell or sell/buy USD), tenor, CHF and USD rate.
 * Maths in src/lib/m03/legs.ts, strings in src/i18n/dict/swaplegs.ts.
 */
import type { JSX } from 'preact';
import { useId, useRef, useState } from 'preact/hooks';
import { GridY } from '@/components/ui/Chart';
import { Segmented } from '@/components/ui/Segmented';
import { Slider } from '@/components/ui/Slider';
import { StatRow, StatTable } from '@/components/ui/Stat';
import { useElementWidth, usePrefersReducedMotion, useTween } from '@/components/ui/hooks';
import { swaplegs as dict } from '@/i18n/dict/swaplegs';
import { translator, type Lang } from '@/i18n/types';
import { linePath, niceTicks, scaleLinear, type Point } from '@/lib/chart';
import type { SwapSide } from '@/lib/fx/swap';
import { forwardMoneyMarket } from '@/lib/fx/forward';
import { fmtMillions, fmtMoney, fmtNumber, fmtPct, fmtPips, fmtRate } from '@/lib/format';
import { M03_CONFIG, PIP, tenorById } from '@/lib/m03/config';
import { snapRate, swapLegs } from '@/lib/m03/legs';
import { fitCentre, textWidth } from '@/lib/m03/text';
import { EXAMPLE_MARKET as MK } from '@/lib/m03/trip';
import { useDragX, useSliderDrag } from './m03-shared';

export interface SwapLegsProps {
  lang: Lang;
  /** Start values (default: the running example, buy/sell USD, 3M). */
  initial?: { side?: SwapSide; tenor?: string; rd?: number; rf?: number };
}

const C = M03_CONFIG;
const G = C.legs;
const PAIR = C.market.pair;
const RD = C.rateDigits;
const BQ = C.market.basisQuote;
const BB = C.market.basisBase;
const MAX_DAYS = Math.max(...G.tenors.map((x) => x.days));

const COLOR = {
  in: 'var(--ff-long)',
  out: 'var(--ff-short)',
  fwd: 'var(--ff-forward)',
  accent: 'var(--ff-linear)',
} as const;

function flowsLayout(w: number) {
  const width = Math.max(300, Math.round(w));
  const compact = width < 560;
  const font = compact ? 11 : 12;
  const L = compact ? 46 : 56;
  const top = 22;
  const axisY = top + 8 + L;
  const height = axisY + L + 64;
  return {
    width,
    height,
    compact,
    font,
    L,
    axisY,
    xToday: compact ? 18 : 28,
    xNear: Math.round(width * (compact ? 0.3 : 0.32)),
    xFar: Math.round(width * (compact ? 0.76 : 0.78)),
    dx: compact ? 12 : 16,
  };
}

function trackLayout(w: number) {
  const width = Math.max(300, Math.round(w));
  const compact = width < 560;
  const font = compact ? 11 : 12;
  const height = compact ? 196 : 216;
  return {
    width,
    height,
    compact,
    font,
    left: compact ? 50 : 58,
    right: width - (compact ? 14 : 22),
    top: 22,
    bottom: height - 34,
  };
}

/** One cash-flow arrow (from the axis, up = receive, down = pay). */
function Arrow(p: { x: number; y0: number; len: number; color: string }): JSX.Element {
  const tip = p.y0 - p.len;
  const dir = p.len >= 0 ? 1 : -1;
  const head = Math.abs(p.len) > 8;
  return (
    <g>
      <path
        d={`M${p.x.toFixed(1)},${p.y0.toFixed(1)}V${tip.toFixed(1)}`}
        style={{ stroke: p.color }}
        class="m3-arrow"
      />
      {head && (
        <path
          d={`M${(p.x - 5).toFixed(1)},${(tip + dir * 8).toFixed(1)}L${p.x.toFixed(1)},${tip.toFixed(1)}L${(p.x + 5).toFixed(1)},${(tip + dir * 8).toFixed(1)}`}
          style={{ stroke: p.color }}
          class="m3-arrow"
        />
      )}
    </g>
  );
}

export default function SwapLegs({ lang, initial }: SwapLegsProps): JSX.Element {
  const t = translator(dict, lang);
  const uid = useId().replace(/[^A-Za-z0-9_-]/g, '');
  const rm = usePrefersReducedMotion();
  const flowBox = useRef<HTMLDivElement>(null);
  const trackBox = useRef<HTMLDivElement>(null);
  const trackSvg = useRef<SVGSVGElement>(null);
  const FL = flowsLayout(useElementWidth(flowBox, 640));
  const TL = trackLayout(useElementWidth(trackBox, 640));

  const [side, setSide] = useState<SwapSide>(initial?.side ?? 'buySellBase');
  const [tenorId, setTenorId] = useState<string>(initial?.tenor ?? G.defaultTenor);
  const [rd, setRd] = useState<number>(initial?.rd ?? MK.rd);
  const [rf, setRf] = useState<number>(initial?.rf ?? MK.rf);
  const [touched, setTouched] = useState(false);
  const [sliding, onSlide] = useSliderDrag();

  const tenor = tenorById(G.tenors, tenorId);
  const v = swapLegs({ ...MK, rd, rf, days: tenor.days, side });
  const near = v.rows[0];
  const far = v.rows[1];

  // tracks: forward curve over a year
  const sx = scaleLinear([0, MAX_DAYS], [TL.left, TL.right]);
  const curveAt = (d: number) => forwardMoneyMarket(MK.spot, rd, rf, d, BQ, BB);
  const end = curveAt(MAX_DAYS);
  const lo = Math.min(MK.spot, end);
  const hi = Math.max(MK.spot, end);
  const pad = Math.max((hi - lo) * 0.2, 14 * PIP);
  const drag = useDragX(trackSvg, TL.width, (vx) => {
    const d = sx.invert(vx);
    let best = G.tenors[0]!;
    for (const x of G.tenors) if (Math.abs(x.days - d) < Math.abs(best.days - d)) best = x;
    if (best.id !== tenorId) {
      setTenorId(best.id);
      setTouched(true);
    }
  });
  const instant = rm || sliding || drag.dragging;
  const [y0, y1] = useTween([lo - pad, hi + pad], 300, rm || sliding);
  const sy = scaleLinear([y0, y1], [TL.bottom, TL.top]);
  const farDays = useTween(tenor.days, 300, instant);
  const farRateShown = curveAt(farDays);
  const curvePts: Point[] = [];
  const activePts: Point[] = [];
  for (let k = 0; k <= 60; k++) {
    const d = (MAX_DAYS * k) / 60;
    const p: Point = [sx(d), sy(curveAt(d))];
    curvePts.push(p);
    if (d <= farDays) activePts.push(p);
  }
  activePts.push([sx(farDays), sy(farRateShown)]);

  // flows: arrow direction tweens through zero when the side flips
  const sgn = side === 'buySellBase' ? 1 : -1;
  const k = useTween(sgn, 300, rm);
  const usdLen = (legSign: number) => legSign * k * FL.L;

  const money = (x: number, ccy: string, sign = true) => fmtMoney(x, ccy, lang, 0, sign);
  const rateTxt = (x: number) => fmtRate(x, PAIR, RD);
  const pipsTxt = fmtPips(v.points, lang, 1, true);
  const nearTxt = fmtRate(near.rate, PAIR);
  const farTxt = rateTxt(far.rate);
  const fs = `${FL.font}px`;
  const base = C.market.base;
  const quote = C.market.quote;

  const flowLabel = (x: number, len: number, text: string) => {
    const w = textWidth(text, FL.font, 0.6) + 4;
    const cx = fitCentre(x, w, 2, FL.width - 2);
    const y = len >= 0 ? FL.axisY - Math.abs(len) - 9 : FL.axisY + Math.abs(len) + FL.font + 7;
    return (
      <text
        x={cx}
        y={y}
        class="m3-flow-label"
        style={{
          fontSize: fs,
          fill: len >= 0 ? 'var(--ff-linear-text)' : 'var(--ff-exotics-text)',
        }}
      >
        {text}
      </text>
    );
  };
  const legArrows = (x: number, legSign: number, baseAmt: number, quoteAmt: number) => {
    const lu = usdLen(legSign);
    const lc = -lu;
    return (
      <g>
        <Arrow x={x - FL.dx} y0={FL.axisY} len={lu} color={lu >= 0 ? COLOR.in : COLOR.out} />
        <Arrow x={x + FL.dx} y0={FL.axisY} len={lc} color={lc >= 0 ? COLOR.in : COLOR.out} />
        {flowLabel(x - FL.dx, lu, money(baseAmt, base))}
        {flowLabel(x + FL.dx, lc, money(quoteAmt, quote))}
      </g>
    );
  };

  const shapeChip =
    v.shape === 'discount'
      ? 'sl.chip.discount'
      : v.shape === 'premium'
        ? 'sl.chip.premium'
        : 'sl.chip.flat';
  const chipClass = v.shape === 'discount' ? 'is-warn' : v.shape === 'premium' ? 'is-blue' : '';
  const aha = touched && v.shape !== 'discount';
  const ahaTitle = v.shape === 'flat' ? t('sl.aha.flat.title') : t('sl.aha.premium.title');
  const ahaText = v.shape === 'flat' ? t('sl.aha.flat') : t('sl.aha.premium');
  const sideLabel = side === 'buySellBase' ? t('sl.side.buySell') : t('sl.side.sellBuy');
  const netSubKey =
    Math.abs(v.net.quote) < 0.5
      ? 'sl.row.netSub.zero'
      : v.net.quote < 0
        ? 'sl.row.netSub.pay'
        : 'sl.row.netSub.get';

  const yTicks = niceTicks(y0, y1, TL.compact ? 3 : 4).filter((x) => x > y0 && x < y1);
  const farX = sx(farDays);
  const farY = sy(farRateShown);
  const nearY = sy(MK.spot);
  const bracketLabel = t('sl.track.points', { pips: pipsTxt });
  const blW = textWidth(bracketLabel, TL.font + 1) + 8;
  const blLeft = farX + 12 + blW > TL.right;
  const set = (fn: () => void) => {
    fn();
    setTouched(true);
  };
  const notional = fmtMillions(C.market.notional, '', lang).trim();

  return (
    <div
      class="m3 sl"
      data-legs-lab
      data-side={side}
      data-tenor={tenorId}
      data-points={v.points.toFixed(2)}
    >
      <div class="ff-lab-head">
        <div class="m3-titles">
          <div class="ff-lab-title">{t('sl.title')}</div>
          <div class="ff-lab-sub">
            {t('sl.sub', {
              notional,
              spot: nearTxt,
              rd: fmtPct(rd, lang, 2),
              rf: fmtPct(rf, lang, 2),
            })}
          </div>
        </div>
        <span class={`m3-chip ${chipClass}`} data-chip>
          {t(shapeChip)}
        </span>
      </div>
      <div class="ff-lab">
        <div class="ff-lab-main">
          <div class="m3-chart-head">
            <b>{t('sl.flows.title')}</b>
            <span class="m3-key">
              <span class="m3-key-sw is-in" aria-hidden="true" />
              {t('sl.flows.in')}
              <span class="m3-key-sw is-out" aria-hidden="true" />
              {t('sl.flows.out')}
            </span>
          </div>
          <div ref={flowBox}>
            <svg
              viewBox={`0 0 ${FL.width} ${FL.height}`}
              role="img"
              class="m3-svg"
              aria-label={t('sl.aria.flows', {
                side: sideLabel,
                tenor: tenorId,
                nearBase: money(near.base, base),
                nearQuote: money(near.quote, quote),
                near: nearTxt,
                farBase: money(far.base, base),
                farQuote: money(far.quote, quote),
                far: farTxt,
              })}
            >
              <path d={`M${FL.xToday},${FL.axisY}H${FL.width - 8}`} class="m3-axis" />
              <path
                d={`M${FL.width - 16},${FL.axisY - 5}L${FL.width - 8},${FL.axisY}L${FL.width - 16},${FL.axisY + 5}`}
                class="m3-axis"
              />
              <circle cx={FL.xToday} cy={FL.axisY} r={4} class="m3-tick-dot" />
              {[FL.xNear, FL.xFar].map((x) => (
                <path
                  key={x}
                  d={`M${x},${FL.axisY - FL.L - 2}V${FL.axisY + FL.L + 2}`}
                  class="m3-station"
                />
              ))}
              <text
                x={(FL.xNear + FL.xFar) / 2}
                y={FL.axisY - 8}
                class="m3-days"
                style={{ fontSize: fs }}
              >
                {t('sl.days', { days: tenor.days })}
              </text>
              {legArrows(FL.xNear, 1, near.base, near.quote)}
              {legArrows(FL.xFar, -1, far.base, far.quote)}
              {/* station captions */}
              <text
                x={FL.xToday}
                y={FL.axisY + FL.L + 40}
                class="m3-cap"
                style={{ fontSize: fs, textAnchor: 'start' }}
              >
                {t('sl.station.today')}
              </text>
              {[
                {
                  x: FL.xNear,
                  name: t('sl.station.near'),
                  sub: t('sl.station.nearSub', { rate: nearTxt }),
                },
                {
                  x: FL.xFar,
                  name: t('sl.station.far'),
                  sub: t('sl.station.farSub', { tenor: tenorId, rate: farTxt }),
                },
              ].map((s) => {
                const w = textWidth(s.sub, FL.font) + 6;
                const cx = fitCentre(s.x, w, 2, FL.width - 2);
                return (
                  <g key={s.name}>
                    <text x={cx} y={FL.axisY + FL.L + 40} class="m3-cap" style={{ fontSize: fs }}>
                      {s.name}
                    </text>
                    <text
                      x={cx}
                      y={FL.axisY + FL.L + 56}
                      class="m3-cap-sub"
                      style={{ fontSize: fs }}
                    >
                      {s.sub}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          <div class="m3-chart-head">
            <b>{t('sl.track.title')}</b>
            <span class="m3-hint">{t('sl.track.drag')}</span>
          </div>
          <div ref={trackBox}>
            <svg
              ref={trackSvg}
              viewBox={`0 0 ${TL.width} ${TL.height}`}
              role="img"
              class="m3-svg"
              aria-label={t('sl.aria.track', {
                near: nearTxt,
                far: farTxt,
                days: tenor.days,
                pips: pipsTxt,
              })}
            >
              <GridY
                y={sy}
                ticks={yTicks}
                x0={TL.left}
                x1={TL.right}
                format={(x) => fmtRate(x, PAIR)}
                fontSize={TL.font}
                axisAt={null}
              />
              <path d={linePath(curvePts)} class="m3-curve" />
              <path d={linePath(activePts)} class="m3-line" style={{ stroke: COLOR.fwd }} />
              <path
                d={`M${sx(0).toFixed(1)},${nearY.toFixed(1)}H${farX.toFixed(1)}`}
                class="m3-ref"
              />
              {Math.abs(farY - nearY) > 2 && (
                <path
                  d={`M${farX.toFixed(1)},${nearY.toFixed(1)}V${farY.toFixed(1)}`}
                  class="m3-bracket is-accent"
                />
              )}
              <text
                x={blLeft ? farX - 12 : farX + 12}
                y={(nearY + farY) / 2 + TL.font * 0.35}
                class="m3-bracket-label"
                style={{ fontSize: `${TL.font + 1}px`, textAnchor: blLeft ? 'end' : 'start' }}
              >
                {bracketLabel}
              </text>
              <circle cx={sx(0)} cy={nearY} r={5} class="m3-dot" />
              <text
                x={sx(0) + 8}
                y={nearY + (farY >= nearY ? -10 : 18)}
                class="m3-leg-label"
                style={{ fontSize: `${TL.font}px` }}
              >
                {t('sl.track.near')}
              </text>
              {/* tenor ticks */}
              {G.tenors.map((x) => {
                const hide = TL.compact && x.days < 20 && x.id !== tenorId;
                return (
                  <g key={x.id}>
                    <path d={`M${sx(x.days).toFixed(1)},${TL.bottom}v5`} class="m3-axis" />
                    {!hide && (
                      <text
                        x={sx(x.days)}
                        y={TL.height - 10}
                        class={`m3-tenor${x.id === tenorId ? ' is-on' : ''}`}
                        style={{ fontSize: `${TL.font}px` }}
                      >
                        {x.id}
                      </text>
                    )}
                  </g>
                );
              })}
              <path d={`M${TL.left},${TL.bottom}H${TL.right}`} class="m3-axis" />
              {/* draggable far point */}
              <g
                class={`m3-handle${drag.dragging ? ' is-active' : ''}`}
                data-far-handle
                {...drag.handlers}
              >
                <rect
                  x={TL.left}
                  y={TL.top}
                  width={TL.right - TL.left}
                  height={TL.bottom - TL.top}
                  class="m3-hit"
                />
                <circle cx={farX} cy={farY} r={22} class="m3-hit" />
                <circle cx={farX} cy={farY} r={8} class="m3-handle-dot" />
              </g>
            </svg>
          </div>

          <div
            class="ff-scroll-x m3-table-wrap"
            tabIndex={0}
            role="region"
            aria-label={t('sl.table.caption')}
          >
            <table class="ff-table m3-table" data-table>
              <caption class="sr-only">{t('sl.table.caption')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('sl.table.leg')}</th>
                  <th scope="col" class="num">
                    {t('sl.table.rate')}
                  </th>
                  <th scope="col" class="num">
                    {base}
                  </th>
                  <th scope="col" class="num">
                    {quote}
                  </th>
                </tr>
              </thead>
              <tbody>
                {[
                  {
                    name: t('sl.table.near'),
                    date: t('sl.table.nearDate'),
                    row: near,
                    rate: nearTxt,
                  },
                  {
                    name: t('sl.table.far'),
                    date: t('sl.table.farDate', { days: tenor.days }),
                    row: far,
                    rate: farTxt,
                  },
                ].map((r) => (
                  <tr key={r.name}>
                    <th scope="row">
                      <span class="m3-cell-main">{r.name}</span>
                      <span class="m3-cell-sub">{r.date}</span>
                    </th>
                    <td class="num">{r.rate}</td>
                    <td class={`num ${r.row.base >= 0 ? 'is-in' : 'is-out'}`}>
                      {fmtNumber(r.row.base, lang, { sign: true })}
                    </td>
                    <td class={`num ${r.row.quote >= 0 ? 'is-in' : 'is-out'}`}>
                      {fmtNumber(r.row.quote, lang, { sign: true })}
                    </td>
                  </tr>
                ))}
                <tr class="is-net">
                  <th scope="row">
                    <span class="m3-cell-main">{t('sl.table.net')}</span>
                    <span class="m3-cell-sub">{t('sl.table.netSub')}</span>
                  </th>
                  <td class="num">{pipsTxt}</td>
                  <td class="num">{fmtNumber(v.net.base, lang)}</td>
                  <td class="num" data-net>
                    {fmtNumber(v.net.quote, lang, { sign: true })}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class={`m3-insight${aha ? ' is-aha' : ''}`} data-insight>
            {aha && <b>{ahaTitle}</b>}
            {aha && <span>{ahaText}</span>}
            <span class="m3-eq">
              <b>{t('sl.eq.title')}</b>
              <span class="math">
                <i>F</i> − <i>S</i> = <i>S</i> · (<i>r</i>
                <sub>CHF</sub> · <i>t</i> − <i>r</i>
                <sub>USD</sub> · <i>t</i>) / (1 + <i>r</i>
                <sub>USD</sub> · <i>t</i>) = <span class="mono">{pipsTxt}</span>
              </span>
              <span class="m3-eq-sub">
                {t('sl.eq.approx')}:{' '}
                <span class="mono">{fmtPips(v.approxPoints, lang, 1, true)}</span>
              </span>
              <span>
                {t('sl.eq.text', { diff: fmtPct(v.diff, lang, 2, true), days: tenor.days })}
              </span>
            </span>
          </div>
        </div>

        <div class="ff-lab-side">
          <div class="panel">
            <div class="m3-seg-field">
              <span class="field-label">{t('sl.seg.side')}</span>
              <Segmented
                label={t('sl.seg.side')}
                value={side}
                onChange={(x) => set(() => setSide(x))}
                options={[
                  { value: 'buySellBase', label: t('sl.side.buySell') },
                  { value: 'sellBuyBase', label: t('sl.side.sellBuy') },
                ]}
              />
            </div>
            <div class="m3-seg-field">
              <span class="field-label">{t('sl.seg.tenor')}</span>
              <Segmented
                label={t('sl.seg.tenor')}
                value={tenorId}
                mono
                onChange={(x) => set(() => setTenorId(x))}
                options={G.tenors.map((x) => ({ value: x.id, label: x.id }))}
              />
            </div>
            <div onPointerDown={onSlide}>
              <Slider
                id={`sl-rd-${uid}`}
                label={t('sl.slider.rd')}
                value={rd}
                min={G.rateRange[0]}
                max={G.rateRange[1]}
                step={G.rateStep}
                valueText={fmtPct(rd, lang, 2)}
                onInput={(x) => set(() => setRd(snapRate(x)))}
              />
            </div>
            <div onPointerDown={onSlide}>
              <Slider
                id={`sl-rf-${uid}`}
                label={t('sl.slider.rf')}
                value={rf}
                min={G.rateRange[0]}
                max={G.rateRange[1]}
                step={G.rateStep}
                valueText={fmtPct(rf, lang, 2)}
                onInput={(x) => set(() => setRf(snapRate(x)))}
              />
            </div>
            <button
              type="button"
              class="m3-btn"
              data-reset
              onClick={() => {
                setSide('buySellBase');
                setTenorId(G.defaultTenor);
                setRd(MK.rd);
                setRf(MK.rf);
                setTouched(false);
              }}
            >
              {t('sl.reset')}
            </button>
          </div>
          <StatTable>
            <StatRow label={t('sl.row.near')} sub={t('sl.row.nearSub')} value={nearTxt} />
            <StatRow
              label={t('sl.row.far')}
              sub={t('sl.row.farSub', { tenor: tenorId })}
              value={farTxt}
            />
            <StatRow
              label={t('sl.row.points')}
              sub={t('sl.row.pointsSub')}
              value={pipsTxt}
              highlight
            />
            <StatRow label={t('sl.row.net')} sub={t(netSubKey)} value={money(v.net.quote, quote)} />
          </StatTable>
          <p class="m3-hint">{t('sl.hint')}</p>
          <div class="sr-only" aria-live="polite" aria-atomic="true">
            {touched
              ? t('sl.live', {
                  tenor: tenorId,
                  far: farTxt,
                  pips: pipsTxt,
                  net: money(v.net.quote, quote),
                })
              : ''}
          </div>
        </div>
      </div>
    </div>
  );
}
