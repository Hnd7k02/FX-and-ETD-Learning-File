/**
 * HedgeRoll (module 03, section 3): the importer's forward matures, but the payment slips. A
 * sell/buy USD swap closes the old forward at today's spot (near leg) and opens a new forward
 * (far leg). Chart: x = spot on the roll date, blue = new far rate, black = all-in rate (old
 * forward + swap points, D-25), grey dashed = old forward. The vertical gap between blue and
 * black is the cash settlement per USD on the roll date (+ receive, − pay). Drag the spot on the
 * rail (slider as accessible twin) or play a tour of spot scenarios: the settlement swings, the
 * all-in rate hardly moves. Below: the cash-flow timeline (roll date, new date, bottom line).
 * Maths in src/lib/m03/roll.ts, strings in src/i18n/dict/hedgeroll.ts.
 */
import type { JSX } from 'preact';
import { useId, useRef, useState } from 'preact/hooks';
import { AxisX, GridY } from '@/components/ui/Chart';
import { Legend } from '@/components/ui/Legend';
import { Segmented } from '@/components/ui/Segmented';
import { Slider } from '@/components/ui/Slider';
import { StatRow, StatTable } from '@/components/ui/Stat';
import {
  useElementWidth,
  useInView,
  usePrefersReducedMotion,
  useTween,
} from '@/components/ui/hooks';
import { hedgeroll as dict } from '@/i18n/dict/hedgeroll';
import { translator, type Lang } from '@/i18n/types';
import { clamp, scaleLinear } from '@/lib/chart';
import { fmtMillions, fmtMoney, fmtNumber, fmtPct, fmtPips, fmtRate } from '@/lib/format';
import { M03_CONFIG, tenorById } from '@/lib/m03/config';
import { allInRange, rollView, snapSpot, tourAt } from '@/lib/m03/roll';
import { innerTicks, nudgeY, textWidth, type Box } from '@/lib/m03/text';
import { EXAMPLE_MARKET as MK } from '@/lib/m03/trip';
import { useDragX, usePlayback, useSliderDrag } from './m03-shared';

export interface HedgeRollProps {
  lang: Lang;
}

const C = M03_CONFIG;
const R = C.roll;
const PAIR = C.market.pair;
const RD = C.rateDigits;
const N = C.market.notional;
const OLD = R.oldForward;
const WP = R.tour.waypoints;

const COLOR = {
  far: 'var(--ff-long)',
  allIn: 'var(--ff-forward)',
  receive: 'var(--ff-good-text)',
  pay: 'var(--ff-short)',
} as const;

function layoutFor(w: number) {
  const width = Math.max(300, Math.round(w));
  const compact = width < 560;
  const height = compact ? 330 : Math.round(clamp(width * 0.68, 360, 450));
  const font = compact ? 11 : 12;
  const left = compact ? 40 : 50;
  const top = 32;
  const rail = height - (compact ? 38 : 42);
  return {
    width,
    height,
    compact,
    font,
    left,
    right: width - (compact ? 10 : 16),
    top,
    rail,
    plotBottom: rail - 22,
  };
}

export default function HedgeRoll({ lang }: HedgeRollProps): JSX.Element {
  const t = translator(dict, lang);
  const uid = useId().replace(/[^A-Za-z0-9_-]/g, '');
  const rm = usePrefersReducedMotion();
  const box = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const inView = useInView(box);
  const L = layoutFor(useElementWidth(box, 640));

  const [spotState, setSpotState] = useState<number>(R.spotStart);
  const [slipId, setSlipId] = useState<string>(R.defaultSlip);
  const [mode, setMode] = useState<'manual' | 'tour'>('manual');
  const [moved, setMoved] = useState(false);
  const [sliding, onSlide] = useSliderDrag();
  const play = usePlayback(1, R.tour.ms, { autoplay: false, reduced: rm, inView });

  const slip = tenorById(R.slips, slipId);
  const base = { oldForward: OLD, notional: N, rd: MK.rd, rf: MK.rf, extraDays: slip.days };
  const target = mode === 'tour' ? tourAt(WP, play.pos) : spotState;

  const sx = scaleLinear(R.spotRange, [L.left, L.right]);
  const sy = scaleLinear(R.yDomain, [L.plotBottom, L.top]);
  const setSpot = (v: number) => {
    setMode('manual');
    play.pause();
    setMoved(true);
    setSpotState(snapSpot(v));
  };
  const drag = useDragX(svgRef, L.width, (vx) => setSpot(sx.invert(vx)));
  const instant = rm || drag.dragging || sliding || mode === 'tour' || !moved;
  const spot = useTween(target, 300, instant);
  const v = rollView({ ...base, spotAtRoll: spot });

  const lineAt = (s: number) => rollView({ ...base, spotAtRoll: s });
  const a = lineAt(R.spotRange[0]);
  const b = lineAt(R.spotRange[1]);
  const x = sx(spot);
  const yFar = sy(v.farRate);
  const yAll = sy(v.allIn);
  const yOld = sy(OLD);
  const xCross = sx(OLD);
  const yCross = sy(lineAt(OLD).allIn);
  const nearCross = Math.abs(spot - OLD) < 0.0015;

  const chf = (z: number, sign = false) => fmtMoney(z, C.market.quote, lang, 0, sign);
  const r4 = (z: number) => fmtRate(z, PAIR);
  const r5 = (z: number) => fmtRate(z, PAIR, RD);
  const side = v.settlementSide;
  const settleTxt = chf(v.settlement, true);
  const absTxt = chf(Math.abs(v.settlement));
  const fs = `${L.font}px`;
  const notional = fmtMillions(N, '', lang).trim();

  // aha after a full tour
  const aha = mode === 'tour' && play.done && play.started;
  const lo = Math.min(...WP);
  const hi = Math.max(...WP);
  const tourRange = allInRange(base, [lo, hi]);
  const insight = aha
    ? t('hr.aha.text', {
        lo: r4(lo),
        hi: r4(hi),
        payMax: chf(lineAt(lo).settlement, true),
        getMax: chf(lineAt(hi).settlement, true),
        aLo: r5(tourRange.min),
        aHi: r5(tourRange.max),
        spread: fmtNumber(tourRange.spreadPips, lang, { digits: 1 }),
      })
    : mode === 'tour' && play.playing
      ? t('hr.insight.running', { spot: r4(spot), settle: settleTxt, allIn: r5(v.allIn) })
      : t('hr.insight.idle');

  const xTicks = innerTicks(R.spotRange[0], R.spotRange[1], 0.02);
  const yTicks = innerTicks(R.yDomain[0], R.yDomain[1], 0.02);
  const gapLabel =
    side === 'receive'
      ? t('hr.gap.receive', { chf: absTxt })
      : side === 'pay'
        ? t('hr.gap.pay', { chf: absTxt })
        : '';
  const glW = textWidth(gapLabel, L.font + 1) + 8;
  const glLeft = x + 12 + glW > L.right;
  const allInLabel = t('hr.allInLabel', { rate: r5(v.allIn) });
  const oldLabel = t('hr.oldLabel', { rate: r5(OLD) });
  const crossLabel = t('hr.cross');
  const clW = textWidth(crossLabel, L.font) + 8;
  const clLeft = xCross + 14 + clW > L.right;
  // gap label: beside the gap, nudged away from the lines if it would hit another label
  const awLabel = textWidth(allInLabel, L.font) + 8;
  // all-in label below the line at the right end, or at the left end while the spot is there
  const allInAtLeft = x > L.right - 4 - awLabel - 12;
  const xAllInLabel = allInAtLeft ? L.left + 6 : L.right - 4 - awLabel;
  const yAllInLabel = sy(allInAtLeft ? a.allIn : b.allIn) + L.font + 8;
  const textBox = (x0: number, w: number, baseline: number, font: number): Box => ({
    x0,
    x1: x0 + w,
    y0: baseline - font,
    y1: baseline + 4,
  });
  const obstacles: Box[] = [
    textBox(L.left + 6, textWidth(oldLabel, L.font) + 8, yOld - 7, L.font),
    textBox(xAllInLabel, awLabel, yAllInLabel, L.font),
  ];
  const gapX0 = glLeft ? x - 12 - glW : x + 12;
  const gapBase = (yFar + yAll) / 2 + L.font * 0.35;
  const gapY = clamp(
    gapBase +
      nudgeY(textBox(gapX0, glW, gapBase, L.font + 1), obstacles, side === 'pay' ? 1 : -1),
    L.top + L.font,
    L.plotBottom - 4,
  );
  const chipKey =
    side === 'receive' ? 'hr.chip.receive' : side === 'pay' ? 'hr.chip.pay' : 'hr.chip.zero';
  const chipClass = side === 'receive' ? 'is-good' : side === 'pay' ? 'is-warn' : '';
  const noteKey =
    side === 'receive' ? 'hr.note.receive' : side === 'pay' ? 'hr.note.pay' : 'hr.note.zero';
  const settleSubKey =
    side === 'receive'
      ? 'hr.row.settleSub.receive'
      : side === 'pay'
        ? 'hr.row.settleSub.pay'
        : 'hr.row.settleSub.zero';
  const slipLabel = t(`hr.slip.${slipId}` as 'hr.slip.1M');
  const pipsTxt = fmtPips(v.points, lang, 1, true);
  const flow = (z: number, ccy: string) => (
    <span class={`m3-flow mono ${z > 0.5 ? 'is-in' : z < -0.5 ? 'is-out' : ''}`}>
      {fmtMoney(z, ccy, lang, 0, true)}
    </span>
  );

  return (
    <div class="m3 hr" data-roll data-spot={spot.toFixed(4)} data-side={side} data-slip={slipId}>
      <div class="ff-lab-head">
        <div class="m3-titles">
          <div class="ff-lab-title">{t('hr.title', { slip: slipLabel })}</div>
          <div class="ff-lab-sub">
            {t('hr.sub', {
              notional,
              old: r5(OLD),
              days: slip.days,
              rd: fmtPct(MK.rd, lang),
              rf: fmtPct(MK.rf, lang),
            })}
          </div>
        </div>
        <span class={`m3-chip ${chipClass}`} data-chip>
          {t(chipKey, { chf: absTxt })}
        </span>
      </div>
      <div class="ff-lab">
        <div class="ff-lab-main">
          <Legend
            items={[
              { label: t('hr.legend.far'), color: COLOR.far, width: 2.5 },
              { label: t('hr.legend.allIn'), color: COLOR.allIn, width: 3 },
              { label: t('hr.legend.old'), color: 'var(--ff-ref)', kind: 'dashed', width: 1.5 },
            ]}
          />
          <div ref={box}>
            <svg
              ref={svgRef}
              viewBox={`0 0 ${L.width} ${L.height}`}
              role="img"
              class="m3-svg"
              aria-label={t('hr.aria', {
                spot: r4(spot),
                far: r5(v.farRate),
                allIn: r5(v.allIn),
                old: r5(OLD),
                settle: settleTxt,
              })}
            >
              <GridY
                y={sy}
                ticks={yTicks}
                x0={L.left}
                x1={L.right}
                format={(z) => fmtRate(z, PAIR, 2)}
                fontSize={L.font}
                axisAt={null}
              />
              <text x={L.left} y={L.top - 16} class="m3-axis-title" style={{ fontSize: fs }}>
                {t('hr.y')}
              </text>
              {/* old forward */}
              <path d={`M${L.left},${yOld.toFixed(1)}H${L.right}`} class="m3-ref" />
              <text x={L.left + 6} y={yOld - 7} class="m3-ref-label" style={{ fontSize: fs }}>
                {oldLabel}
              </text>
              {/* lines */}
              <path
                d={`M${L.left},${sy(a.farRate).toFixed(1)}L${L.right},${sy(b.farRate).toFixed(1)}`}
                class="m3-line is-thin"
                style={{ stroke: COLOR.far }}
              />
              <path
                d={`M${L.left},${sy(a.allIn).toFixed(1)}L${L.right},${sy(b.allIn).toFixed(1)}`}
                class="m3-line"
                style={{ stroke: COLOR.allIn }}
              />
              <text
                x={allInAtLeft ? xAllInLabel : L.right - 4}
                y={yAllInLabel}
                class="m3-line-label"
                style={{ fontSize: fs, textAnchor: allInAtLeft ? 'start' : 'end' }}
              >
                {allInLabel}
              </text>
              {/* crossing: spot = old forward */}
              <circle
                cx={xCross}
                cy={yCross}
                r={nearCross ? 10 : 6}
                class={`m3-cross${nearCross ? ' is-lit' : ''}`}
              />
              {nearCross && (
                <text
                  x={clLeft ? xCross - 14 : xCross + 14}
                  y={yCross - 14}
                  class="m3-event-label"
                  style={{ fontSize: fs, textAnchor: clLeft ? 'end' : 'start' }}
                >
                  {crossLabel}
                </text>
              )}
              {/* current spot: guide, gap, dots */}
              <path d={`M${x.toFixed(1)},${L.top}V${L.rail}`} class="m3-guide" />
              {side !== 'zero' && Math.abs(yFar - yAll) > 2 && (
                <path
                  d={`M${x.toFixed(1)},${yAll.toFixed(1)}V${yFar.toFixed(1)}`}
                  class="m3-gap"
                  style={{ stroke: side === 'receive' ? COLOR.receive : COLOR.pay }}
                />
              )}
              {!L.compact && side !== 'zero' && Math.abs(yFar - yAll) > 14 && (
                <text
                  x={glLeft ? x - 12 : x + 12}
                  y={gapY}
                  class="m3-gap-label"
                  style={{
                    fontSize: `${L.font + 1}px`,
                    fill: side === 'receive' ? COLOR.receive : COLOR.pay,
                    textAnchor: glLeft ? 'end' : 'start',
                  }}
                >
                  {gapLabel}
                </text>
              )}
              <circle cx={x} cy={yFar} r={6} class="m3-dot" style={{ fill: COLOR.far }} />
              <circle cx={x} cy={yAll} r={6} class="m3-dot" />
              {/* rail with the draggable spot */}
              <path d={`M${L.left},${L.rail}H${L.right}`} class="m3-rail" />
              <g
                class={`m3-handle${drag.dragging ? ' is-active' : ''}`}
                data-handle
                {...drag.handlers}
              >
                <rect
                  x={L.left - 10}
                  y={L.rail - 22}
                  width={L.right - L.left + 20}
                  height={44}
                  class="m3-hit"
                />
                <rect
                  x={x - 34}
                  y={L.rail - 11}
                  width={68}
                  height={22}
                  rx={11}
                  class="m3-handle-pill"
                />
                <text x={x} y={L.rail + 4} class="m3-handle-text">
                  {r4(spot)}
                </text>
              </g>
              <AxisX
                x={sx}
                ticks={xTicks}
                y={L.height - 4}
                format={(z) => fmtRate(z, PAIR, 2)}
                fontSize={L.font}
              />
              {!L.compact && (
                <text
                  x={L.right}
                  y={L.plotBottom - 8}
                  class="m3-axis-title"
                  style={{ fontSize: fs, textAnchor: 'end' }}
                >
                  {t('hr.x')}
                </text>
              )}
            </svg>
          </div>
          <div class={`m3-insight${aha ? ' is-aha' : ''}`} data-insight>
            {aha && <b>{t('hr.aha.title')}</b>}
            <span>{insight}</span>
          </div>
          <p class="m3-hint">{t('hr.hint')}</p>
        </div>

        <div class="ff-lab-side">
          <div class="panel">
            <div onPointerDown={onSlide}>
              <Slider
                id={`hr-spot-${uid}`}
                label={t('hr.slider')}
                value={snapSpot(spot)}
                min={R.spotRange[0]}
                max={R.spotRange[1]}
                step={R.spotStep}
                valueText={r4(spot)}
                onInput={setSpot}
              />
            </div>
            <div class="m3-seg-field">
              <span class="field-label">{t('hr.seg.slip')}</span>
              <Segmented
                label={t('hr.seg.slip')}
                value={slipId}
                mono
                onChange={(z) => {
                  setSlipId(z);
                  setMoved(true);
                }}
                options={R.slips.map((z) => ({ value: z.id, label: z.id }))}
              />
            </div>
            <div class="m3-buttons">
              <button
                type="button"
                class="m3-btn m3-btn-dark"
                data-play
                onClick={() => {
                  if (mode === 'tour' && play.playing) {
                    play.pause();
                    return;
                  }
                  setMode('tour');
                  setMoved(true);
                  if (mode === 'tour' && !play.done) play.play();
                  else play.restart();
                }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                  {mode === 'tour' && play.playing ? (
                    <path d="M4 2.5V11.5M10 2.5V11.5" class="m3-icon-stroke" />
                  ) : (
                    <path d="M4 2.2L11.5 7L4 11.8Z" class="m3-icon-fill" />
                  )}
                </svg>
                {mode === 'tour' && play.playing ? t('hr.pause') : t('hr.play')}
              </button>
            </div>
          </div>
          <StatTable>
            <StatRow
              label={t('hr.row.points')}
              sub={t('hr.row.pointsSub', { days: slip.days })}
              value={pipsTxt}
            />
            <StatRow label={t('hr.row.far')} sub={t('hr.row.farSub')} value={r5(v.farRate)} />
            <StatRow label={t('hr.row.settle')} sub={t(settleSubKey)} value={settleTxt} />
            <StatRow
              label={t('hr.row.allIn')}
              sub={t('hr.row.allInSub')}
              value={r5(v.allIn)}
              highlight
            />
          </StatTable>
          <p class={`m3-note ${chipClass}`} data-note>
            {t(noteKey, { chf: absTxt })}
          </p>
          <div class="sr-only" aria-live="polite" aria-atomic="true">
            {moved && mode === 'manual'
              ? t('hr.live', { spot: r4(spot), settle: settleTxt, allIn: r5(v.allIn) })
              : ''}
          </div>
        </div>
      </div>
      <ol class="m3-timeline" data-timeline>
        <li class="m3-tl-card">
          <span class="m3-tl-head">{t('hr.tl.t1')}</span>
          <span class="m3-tl-row">
            <span>{t('hr.tl.fwd')}</span>
            {flow(N, C.market.base)}
            {flow(-N * OLD, C.market.quote)}
          </span>
          <span class="m3-tl-row">
            <span>{t('hr.tl.near', { rate: r4(spot) })}</span>
            {flow(-N, C.market.base)}
            {flow(N * spot, C.market.quote)}
          </span>
          <span class="m3-tl-row is-net">
            <span>{t('hr.tl.net')}</span>
            {flow(0, C.market.base)}
            {flow(v.settlement, C.market.quote)}
          </span>
        </li>
        <li class="m3-tl-card">
          <span class="m3-tl-head">{t('hr.tl.t2', { days: slip.days })}</span>
          <span class="m3-tl-row">
            <span>{t('hr.tl.far', { rate: r5(v.farRate) })}</span>
            {flow(N, C.market.base)}
            {flow(-v.farChf, C.market.quote)}
          </span>
          <span class="m3-tl-row">
            <span>{t('hr.tl.supplier')}</span>
            {flow(-N, C.market.base)}
            <span />
          </span>
        </li>
        <li class="m3-tl-card is-total">
          <span class="m3-tl-head">{t('hr.tl.total')}</span>
          <span class="m3-tl-big mono">{chf(v.totalChf)}</span>
          <span class="m3-tl-for">{t('hr.tl.forUsd', { notional })}</span>
          <span class="m3-tl-sub">
            {t('hr.tl.totalRate', { rate: r5(v.allIn), old: r5(OLD), pips: pipsTxt })}
          </span>
        </li>
      </ol>
    </div>
  );
}
