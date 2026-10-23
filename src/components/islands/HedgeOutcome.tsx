/**
 * HedgeOutcome (module 02, section 1): what the Swiss importer pays in CHF for USD 1 Mio. at
 * maturity, unhedged (orange diagonal, N · S_T) or with the forward (black, flat at N · F).
 * Drag the rate at maturity on the rail below the chart (slider as accessible twin). "Play
 * scenarios" drops model outcomes one by one: on the orange line they scatter, in the strip on
 * the right the unhedged costs spread out while every forward outcome lands on the same point.
 * Maths in src/lib/m02/hedge.ts, strings in src/i18n/dict/hedgeoutcome.ts.
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
import { hedgeoutcome as dict } from '@/i18n/dict/hedgeoutcome';
import { translator, type Lang } from '@/i18n/types';
import { clamp, niceTicks, scaleLinear } from '@/lib/chart';
import { fmtMillions, fmtMoney, fmtNumber, fmtPct, fmtRate } from '@/lib/format';
import { M02_CONFIG } from '@/lib/m02/config';
import {
  dealForward,
  hedgeOutcome,
  scenarioRates,
  scenarioStats,
  snapRate,
  type HedgeVerdict,
} from '@/lib/m02/hedge';
import { textWidth } from '@/lib/m02/text';
import { useDragX, usePlayback, useSliderDrag } from './m02-shared';

export interface HedgeOutcomeProps {
  lang: Lang;
}

const M = M02_CONFIG.market;
const H = M02_CONFIG.hedge;
const SC = H.scenarios;
const N = M.notional;
const PAIR = M.pair;
const F = dealForward();
const FD = M02_CONFIG.forwardDigits;

/** Colour semantics: unhedged = orange, forward = black, verdict good/warn. */
const COLOR = {
  unhedged: 'var(--ff-short)',
  forward: 'var(--ff-forward)',
  saves: 'var(--ff-good-text)',
  costs: 'var(--ff-warn-text)',
  equal: 'var(--ff-ink-2)',
} as const;

function layoutFor(w: number) {
  const width = Math.max(300, Math.round(w));
  const compact = width < 560;
  const height = compact ? 340 : Math.round(clamp(width * 0.55, 350, 420));
  const font = compact ? 11 : 12;
  const strip = compact ? 74 : 92;
  const left = compact ? 36 : 44;
  const right = 6;
  const top = 36;
  const rail = height - (compact ? 38 : 42);
  const plotBottom = rail - 20;
  const plotRight = width - right - strip;
  return {
    width,
    height,
    compact,
    font,
    left,
    top,
    rail,
    plotBottom,
    plotRight,
    stripSep: plotRight + 10,
    stripU: plotRight + 10 + (strip - 10) * 0.3,
    stripH: plotRight + 10 + (strip - 10) * 0.78,
  };
}

/** Deterministic horizontal jitter of strip dots (px). */
const jitter = (i: number) => (((i * 37) % 11) - 5) * 1.3;

export default function HedgeOutcome({ lang }: HedgeOutcomeProps): JSX.Element {
  const t = translator(dict, lang);
  const uid = useId().replace(/[^A-Za-z0-9_-]/g, '');
  const rm = usePrefersReducedMotion();
  const box = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const inView = useInView(box);
  const L = layoutFor(useElementWidth(box, 640));

  const [st, setSt] = useState<number>(H.stStart);
  const [moved, setMoved] = useState(false);
  const [sliding, onSlide] = useSliderDrag();
  const [seed, setSeed] = useState<number>(SC.seed);
  const rates = useMemo(() => scenarioRates(seed, SC.count, F, SC.vol, M.T), [seed]);
  const play = usePlayback(SC.count, SC.msPerScenario, { autoplay: true, reduced: rm, inView });
  const shown = Math.min(SC.count, Math.floor(play.pos + 1e-9));
  const stats = scenarioStats(rates.slice(0, shown), F, N);

  const sx = scaleLinear(H.stRange, [L.left, L.plotRight]);
  const sy = scaleLinear(H.yDomain, [L.plotBottom, L.top]);
  const yChf = (chf: number) => sy(chf / 1000);

  const set = (v: number) => {
    setMoved(true);
    setSt(snapRate(v));
  };
  const drag = useDragX(svgRef, L.width, (vx) => set(sx.invert(vx)));

  const o = hedgeOutcome(st, F, N);
  const instant = rm || drag.dragging || sliding || !moved;
  const [shownUnhedged, shownDiff] = useTween([o.unhedged, o.diff], 300, instant);
  const yU = useTween(yChf(o.unhedged), 300, instant);

  const chf = (x: number) => fmtMoney(x, M.quote, lang);
  const notional = fmtMillions(N, '', lang).trim();
  const fwdTxt = fmtRate(F, PAIR, FD);
  const stTxt = fmtRate(st, PAIR);
  const verdict: HedgeVerdict = o.verdict;
  const fs = `${L.font}px`;
  const x = sx(st);
  const yF = yChf(N * F);
  const xF = sx(F);

  const yTicks = niceTicks(H.yDomain[0], H.yDomain[1], L.compact ? 4 : 5).filter(
    (v) => v > H.yDomain[0] && v < H.yDomain[1],
  );
  const xTicks = niceTicks(H.stRange[0], H.stRange[1], L.compact ? 4 : 6).filter(
    (v) => v > H.stRange[0] + 1e-9 && v < H.stRange[1] - 1e-9,
  );

  // Verdict bracket label: right of the guide, or left near the strip.
  const diffLabel = chf(Math.abs(shownDiff));
  const labelW = textWidth(diffLabel, L.font + 1) + 8;
  const labelLeft = x + 12 + labelW > L.plotRight;
  const yMid = (yU + yF) / 2;

  // Aha after a full run of all scenarios.
  const aha = play.done && shown === SC.count && play.started;
  const last = shown > 0 ? rates[shown - 1]! : null;
  const insight = aha
    ? t('ho.aha.text', { min: chf(stats.min), max: chf(stats.max), fwd: chf(N * F) })
    : play.playing && last !== null
      ? t('ho.insight.running', {
          i: shown,
          st: fmtRate(last, PAIR),
          unhedged: chf(N * last),
          hedged: chf(N * F),
        })
      : t('ho.insight.idle', { months: M.months });

  const aria =
    t('ho.aria', {
      notional,
      st: stTxt,
      unhedged: chf(o.unhedged),
      hedged: chf(o.hedged),
    }) +
    (shown > 0
      ? ` ${t('ho.aria.scn', { n: shown, min: chf(stats.min), max: chf(stats.max), hedged: chf(o.hedged) })}`
      : '');

  const regionSaves = L.compact
    ? [t('ho.region.savesB')]
    : [t('ho.region.savesA'), t('ho.region.savesB')];
  const regionCosts = L.compact
    ? [t('ho.region.costsB')]
    : [t('ho.region.costsA'), t('ho.region.costsB')];
  const chipKey =
    verdict === 'saves' ? 'ho.chip.saves' : verdict === 'costs' ? 'ho.chip.costs' : 'ho.chip.equal';
  const noteKey =
    verdict === 'saves' ? 'ho.note.saves' : verdict === 'costs' ? 'ho.note.costs' : 'ho.note.equal';
  const diffKey =
    verdict === 'saves'
      ? 'ho.row.diff.saves'
      : verdict === 'costs'
        ? 'ho.row.diff.costs'
        : 'ho.row.diff.equal';
  const playLabel = play.playing ? t('ho.pause') : play.done ? t('ho.replay') : t('ho.play');
  const newest = shown - 1;

  return (
    <div class="m2 ho" data-ho data-st={st.toFixed(4)} data-verdict={verdict} data-shown={shown}>
      <div class="ff-lab-head">
        <div class="m2-titles">
          <div class="ff-lab-title">{t('ho.title')}</div>
          <div class="ff-lab-sub">
            {t('ho.sub', {
              notional,
              months: M.months,
              fwd: fwdTxt,
              spot: fmtRate(M.spot, PAIR),
            })}
          </div>
        </div>
        <span class={`m2-chip is-${verdict}`} data-chip>
          {t(chipKey, { chf: chf(Math.abs(o.diff)) })}
        </span>
      </div>
      <div class="ff-lab">
        <div class="ff-lab-main">
          <Legend
            items={[
              { label: t('ho.legend.unhedged'), color: COLOR.unhedged, width: 3 },
              { label: t('ho.legend.forward'), color: COLOR.forward, width: 3 },
              { label: t('ho.legend.scenarios'), color: 'rgba(234, 88, 12, 0.55)', kind: 'area' },
            ]}
          />
          <div ref={box}>
            <svg
              ref={svgRef}
              viewBox={`0 0 ${L.width} ${L.height}`}
              role="img"
              aria-label={aria}
              class="m2-svg"
            >
              {/* regions left and right of the forward */}
              <rect
                x={L.left}
                y={L.top}
                width={Math.max(0, xF - L.left)}
                height={L.plotBottom - L.top}
                class="ho-region is-costs"
              />
              <rect
                x={xF}
                y={L.top}
                width={Math.max(0, L.plotRight - xF)}
                height={L.plotBottom - L.top}
                class="ho-region is-saves"
              />
              <GridY
                y={sy}
                ticks={yTicks}
                x0={L.left}
                x1={L.plotRight}
                format={(v) => fmtNumber(v, lang)}
                fontSize={L.font}
                axisAt={null}
              />
              <text x={L.left} y={L.top - 18} class="m2-axis-title" style={{ fontSize: fs }}>
                {t('ho.y')}
              </text>
              {regionCosts.map((line, i) => (
                <text
                  key={`c${i}`}
                  x={L.left + 8}
                  y={L.top + L.font + 6 + i * (L.font + 4)}
                  class="ho-region-label is-costs"
                  style={{ fontSize: fs }}
                >
                  {line}
                </text>
              ))}
              {regionSaves.map((line, i) => (
                <text
                  key={`s${i}`}
                  x={L.plotRight - 8}
                  y={L.plotBottom - 8 - (regionSaves.length - 1 - i) * (L.font + 4)}
                  class="ho-region-label is-saves"
                  style={{ fontSize: fs, textAnchor: 'end' }}
                >
                  {line}
                </text>
              ))}

              {/* forward reference */}
              <path d={`M${xF.toFixed(1)},${L.top}V${L.plotBottom}`} class="m2-ref" />
              <text x={xF + 6} y={L.top + L.font + 6} class="m2-ref-label" style={{ fontSize: fs }}>
                {t('ho.fLabel', { fwd: fwdTxt })}
              </text>

              {/* lines */}
              <path
                d={`M${L.left},${yChf(N * H.stRange[0]).toFixed(1)}L${L.plotRight},${yChf(N * H.stRange[1]).toFixed(1)}`}
                class="m2-line"
                style={{ stroke: COLOR.unhedged }}
              />
              <path
                d={`M${L.left},${yF.toFixed(1)}H${L.plotRight}`}
                class="m2-line"
                style={{ stroke: COLOR.forward }}
              />

              {/* scenarios on the line */}
              <g aria-hidden="true">
                {rates.slice(0, shown).map((r, i) => (
                  <circle
                    key={`${seed}-${i}`}
                    cx={sx(r)}
                    cy={yChf(N * r)}
                    r={3.6}
                    class={`ho-sdot${i === newest && play.playing ? ' is-new' : ''}`}
                  />
                ))}
              </g>

              {/* strips: unhedged spread vs forward point */}
              <path d={`M${L.stripSep},${L.top - 6}V${L.plotBottom}`} class="m2-grid" />
              <text
                x={L.stripU}
                y={L.top - 18}
                class="m2-axis-title"
                style={{ fontSize: fs, textAnchor: 'middle' }}
              >
                {t('ho.strip.unhedged')}
              </text>
              <text
                x={L.stripH}
                y={L.top - 18}
                class="m2-axis-title"
                style={{ fontSize: fs, textAnchor: 'middle' }}
              >
                {t('ho.strip.hedged')}
              </text>
              {shown > 1 && (
                <path
                  d={`M${L.stripU},${yChf(stats.max).toFixed(1)}V${yChf(stats.min).toFixed(1)}`}
                  class="ho-range"
                />
              )}
              <g aria-hidden="true">
                {rates.slice(0, shown).map((r, i) => (
                  <circle
                    key={`s-${seed}-${i}`}
                    cx={L.stripU + jitter(i)}
                    cy={yChf(N * r)}
                    r={3.4}
                    class={`ho-stripdot${i === newest && play.playing ? ' is-new' : ''}`}
                    style={
                      i === newest && play.playing
                        ? { '--dx': `${(sx(r) - L.stripU - jitter(i)).toFixed(1)}px` }
                        : undefined
                    }
                  />
                ))}
              </g>
              {shown > 0 && (
                <g>
                  <circle cx={L.stripH} cy={yF} r={5} class="ho-fdot" />
                  <text
                    x={L.stripH}
                    y={yF - 10}
                    class="ho-fcount"
                    style={{ fontSize: fs, textAnchor: 'middle' }}
                  >
                    {`×${shown}`}
                  </text>
                </g>
              )}

              {/* rate at maturity: guide, bracket, dots */}
              <path d={`M${x.toFixed(1)},${L.top}V${L.rail}`} class="ho-guide" />
              {verdict !== 'equal' && (
                <path
                  d={`M${x.toFixed(1)},${yU.toFixed(1)}V${yF.toFixed(1)}`}
                  class="ho-bracket"
                  style={{ stroke: COLOR[verdict] }}
                />
              )}
              {verdict !== 'equal' && Math.abs(yU - yF) > 14 && (
                <text
                  x={labelLeft ? x - 12 : x + 12}
                  y={yMid + L.font * 0.35}
                  class="ho-diff-label"
                  style={{
                    fontSize: `${L.font + 1}px`,
                    fill: COLOR[verdict],
                    textAnchor: labelLeft ? 'end' : 'start',
                  }}
                >
                  {diffLabel}
                </text>
              )}
              <circle cx={x} cy={yF} r={6} class="ho-dot" style={{ fill: COLOR.forward }} />
              <circle cx={x} cy={yU} r={6} class="ho-dot" style={{ fill: COLOR.unhedged }} />

              {/* rail with the draggable handle */}
              <path d={`M${L.left},${L.rail}H${L.plotRight}`} class="m2-rail" />
              <g
                class={`m2-handle${drag.dragging ? ' is-active' : ''}`}
                data-handle
                {...drag.handlers}
              >
                <rect
                  x={L.left - 10}
                  y={L.rail - 22}
                  width={L.plotRight - L.left + 20}
                  height={44}
                  class="m2-hit"
                />
                <rect
                  x={x - 34}
                  y={L.rail - 11}
                  width={68}
                  height={22}
                  rx={11}
                  class="m2-handle-pill"
                />
                <text x={x} y={L.rail + 4} class="m2-handle-text">
                  {stTxt}
                </text>
              </g>
              <AxisX
                x={sx}
                ticks={xTicks}
                y={L.height - 4}
                format={(v) => fmtRate(v, PAIR, 2)}
                fontSize={L.font}
              />
            </svg>
          </div>
          <div class={`m2-insight${aha ? ' is-aha' : ''}`} data-insight>
            {aha && <b>{t('ho.aha.title')}</b>}
            <span>{insight}</span>
          </div>
          <p class="m2-hint">{t('ho.hint')}</p>
        </div>

        <div class="ff-lab-side">
          <div class="panel">
            <div onPointerDown={onSlide}>
              <Slider
                id={`ho-st-${uid}`}
                label={t('ho.slider')}
                value={st}
                min={H.stRange[0]}
                max={H.stRange[1]}
                step={H.stStep}
                valueText={stTxt}
                onInput={set}
              />
            </div>
            <div class="m2-buttons">
              <button type="button" class="m2-btn m2-btn-dark" onClick={play.toggle} data-play>
                <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                  {play.playing ? (
                    <path d="M4 2.5V11.5M10 2.5V11.5" class="m2-icon-stroke" />
                  ) : (
                    <path d="M4 2.2L11.5 7L4 11.8Z" class="m2-icon-fill" />
                  )}
                </svg>
                {playLabel}
              </button>
              <button
                type="button"
                class="m2-btn"
                data-reseed
                onClick={() => {
                  setSeed((s) => s + 1);
                  play.restart();
                }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                  <path d="M3 5.5A4.5 4.5 0 1 1 2.6 8.6M3 2.5V5.5H6" class="m2-icon-stroke" />
                </svg>
                {t('ho.reseed')}
              </button>
            </div>
          </div>

          <StatTable>
            <StatRow
              symbol={
                <span aria-hidden="true" class="m2-sw" style={{ borderTopColor: COLOR.unhedged }} />
              }
              label={t('ho.row.unhedged')}
              sub={t('ho.row.unhedgedSub', { notional, st: stTxt })}
              value={chf(shownUnhedged)}
            />
            <StatRow
              symbol={
                <span aria-hidden="true" class="m2-sw" style={{ borderTopColor: COLOR.forward }} />
              }
              label={t('ho.row.forward')}
              sub={t('ho.row.forwardSub')}
              value={chf(o.hedged)}
            />
            <StatRow
              label={t(diffKey)}
              sub={t('ho.row.diffSub')}
              value={chf(Math.abs(shownDiff))}
              highlight
            />
          </StatTable>

          <div class="m2-box" data-scn>
            <div class="m2-box-head">
              <b>{t('ho.scn.title', { shown, n: SC.count })}</b>
              <span>{t('ho.scn.sub', { vol: fmtPct(SC.vol, lang, 0) })}</span>
            </div>
            <dl class="m2-dl">
              <div>
                <dt>{t('ho.scn.rangeUnhedged')}</dt>
                <dd class="mono">
                  {shown > 0
                    ? `${chf(stats.min)} – ${fmtNumber(stats.max, lang)}`
                    : t('ho.scn.none')}
                </dd>
              </div>
              <div>
                <dt>{t('ho.scn.rangeHedged')}</dt>
                <dd class="mono">{shown > 0 ? chf(0) : t('ho.scn.none')}</dd>
              </div>
              <div>
                <dt>{t('ho.scn.cheaper')}</dt>
                <dd class="mono" data-cheaper={stats.forwardCheaper}>
                  {shown > 0
                    ? t('ho.scn.cheaperVal', { k: stats.forwardCheaper, n: shown })
                    : t('ho.scn.none')}
                </dd>
              </div>
            </dl>
          </div>

          <p class={`m2-note is-${verdict}`} data-note>
            {t(noteKey, {
              st: stTxt,
              unhedged: chf(o.unhedged),
              hedged: chf(o.hedged),
              diff: chf(Math.abs(o.diff)),
            })}
          </p>
          <div class="sr-only" aria-live="polite" aria-atomic="true">
            {moved ? t(chipKey, { chf: chf(Math.abs(o.diff)) }) : ''}
          </div>
        </div>
      </div>
    </div>
  );
}
