/**
 * ParityPaths (module 02, section 2): two equally safe routes to USD 1 Mio. at maturity, as two
 * vertical swim lanes with time flowing down. Route A (left) buys the dollars forward at F.
 * Route B (right) borrows CHF today, buys USD spot and invests them at the USD rate. The steps
 * play one by one (play/pause, step back/forward), the amounts count, the balances grow during
 * the term, and at maturity both lanes land on the same USD and the same CHF amount: "=".
 * Sliders for both rates and the term recompute everything (covered interest parity).
 * Maths in src/lib/m02/parity.ts, strings in src/i18n/dict/paritypaths.ts.
 */
import type { JSX } from 'preact';
import { useId, useMemo, useRef, useState } from 'preact/hooks';
import { Slider } from '@/components/ui/Slider';
import { StatRow, StatTable } from '@/components/ui/Stat';
import {
  useElementWidth,
  useInView,
  usePrefersReducedMotion,
  useTween,
} from '@/components/ui/hooks';
import { paritypaths as dict } from '@/i18n/dict/paritypaths';
import { translator, type Lang } from '@/i18n/types';
import { fmtMillions, fmtMoney, fmtNumber, fmtPct, fmtPips, fmtRate } from '@/lib/format';
import { M02_CONFIG } from '@/lib/m02/config';
import {
  PARITY_STEPS,
  nextTarget,
  parity,
  parityFrame,
  parityLayout,
  prevTarget,
  timeline,
  type Box,
  type ParityLayout,
  type ParityStepId,
  type StepView,
} from '@/lib/m02/parity';
import { textWidth, wrapText } from '@/lib/m02/text';
import { usePlayback, useSliderDrag } from './m02-shared';

export interface ParityPathsProps {
  lang: Lang;
}

const M = M02_CONFIG.market;
const PC = M02_CONFIG.parity;
const PAIR = M.pair;
const N = M.notional;
const FD = M02_CONFIG.forwardDigits;

/** Colour semantics: forward black; USD (long) blue; CHF loan (short) orange. Text tones pass AA. */
const COLOR = {
  a: 'var(--ff-forward)',
  usd: 'var(--ff-long)',
  usdText: 'var(--ff-linear-text)',
  chf: 'var(--ff-short)',
  chfText: 'var(--ff-exotics-text)',
} as const;

interface CardProps {
  L: ParityLayout;
  box: Box;
  view: StepView;
  id: string;
  title: string;
  amount: string;
  color: string;
  textColor: string;
}

/** One step card: wrapped title, mono amount, accent bar; dashed while not reached. */
function Card({ L, box, view, id, title, amount, color, textColor }: CardProps): JSX.Element {
  const pad = L.compact ? 9 : 12;
  const maxChars = Math.max(8, Math.floor((box.w - 2 * pad - 4) / (L.font * 0.58)));
  const lines = wrapText(title, maxChars).slice(0, 2);
  const todo = view.state === 'todo';
  return (
    <g class={`pp-card is-${view.state}`} data-card={id} data-state={view.state}>
      <rect
        x={box.x + 0.5}
        y={box.y + 0.5}
        width={box.w - 1}
        height={box.h - 1}
        rx={12}
        class="pp-card-box"
        style={view.state === 'active' ? { stroke: color } : undefined}
      />
      {!todo && (
        <rect x={box.x + 0.5} y={box.y + 10} width={3} height={box.h - 20} rx={1.5} fill={color} />
      )}
      {lines.map((line, i) => (
        <text
          key={i}
          x={box.x + pad + 2}
          y={box.y + pad + L.font + i * (L.font + 3)}
          class="pp-card-title"
          style={{ fontSize: `${L.font}px` }}
        >
          {line}
        </text>
      ))}
      <text
        x={box.x + pad + 2}
        y={box.y + box.h - pad}
        class="pp-card-amount"
        style={{ fontSize: `${L.mono}px`, fill: todo ? 'var(--ff-muted)' : textColor }}
      >
        {todo ? '–' : amount}
      </text>
    </g>
  );
}

/** Pill on a band divider, centred on the spine. */
function BandChip({ L, y, text }: { L: ParityLayout; y: number; text: string }): JSX.Element {
  const w = textWidth(text, L.font, 0.6) + 22;
  return (
    <g class="pp-chip">
      <rect x={L.spine - w / 2} y={y - 11} width={w} height={22} rx={11} />
      <text x={L.spine} y={y + L.font * 0.35} style={{ fontSize: `${L.font}px` }}>
        {text}
      </text>
    </g>
  );
}

export default function ParityPaths({ lang }: ParityPathsProps): JSX.Element {
  const t = translator(dict, lang);
  const uid = useId().replace(/[^A-Za-z0-9_-]/g, '');
  const rm = usePrefersReducedMotion();
  const box = useRef<HTMLDivElement>(null);
  const inView = useInView(box);
  const L = parityLayout(useElementWidth(box, 600));

  const [rd, setRd] = useState<number>(M.rd);
  const [rf, setRf] = useState<number>(M.rf);
  const [days, setDays] = useState<number>(M.days);
  const [manual, setManual] = useState(false);
  const [sliding, onSlide] = useSliderDrag();

  const input = {
    spot: M.spot,
    rd,
    rf,
    days,
    notional: N,
    basisQuote: M.basisQuote,
    basisBase: M.basisBase,
  };
  const r = parity(input);
  const tl = useMemo(() => timeline(PC.stepMs), []);
  const play = usePlayback(tl.total, 1, { autoplay: true, reduced: rm, inView });
  const fr = parityFrame(play.pos, input, r, tl);
  const S = fr.steps;

  const instant = rm || sliding;
  const [fwd, chfLoan, usdToday, chfRepay, usdInt, chfInt, fCont, usdBal, chfBal] = useTween(
    [
      r.forward,
      r.chfLoan,
      r.usdToday,
      r.chfRepay,
      r.usdInterest,
      r.chfInterest,
      r.forwardContinuous,
      fr.usd,
      fr.chf,
    ],
    300,
    instant || play.playing,
  );

  const chf = (x: number) => fmtMoney(x, M.quote, lang);
  const usd = (x: number) => fmtMoney(x, M.base, lang);
  const num = (x: number) => fmtNumber(x, lang);
  const pct = (x: number) => fmtPct(x, lang, 2);
  const notional = fmtMillions(N, '', lang).trim();
  const fwdTxt = fmtRate(fwd, PAIR, FD);
  const spotTxt = fmtRate(M.spot, PAIR);
  const pointsTxt = fmtPips(r.points, lang, 1, true);
  const fs = `${L.font}px`;

  const vars = {
    notional,
    days,
    fwd: fwdTxt,
    spot: spotTxt,
    rd: pct(rd),
    rf: pct(rf),
    chfLoan: chf(chfLoan),
    usdToday: usd(usdToday),
    usdInterest: usd(usdInt),
    chfInterest: chf(chfInt),
    chfRepay: chf(chfRepay),
    chfFwd: chf(N * fwd),
  };

  // Narrative: the latest step that has begun.
  let latest = -1;
  PARITY_STEPS.forEach((id, i) => {
    if (S[id].state !== 'todo') latest = i;
  });
  const latestId: ParityStepId | null = latest >= 0 ? PARITY_STEPS[latest]! : null;
  const aha = latestId === 'result';
  const narrative =
    latestId === null
      ? t('pp.idle')
      : aha
        ? t('pp.aha.text', { notional, chf: chf(chfRepay) })
        : t(`pp.step.${latestId}`, vars);
  const stepNo = Math.max(1, latest + 1);

  const playLabel = play.playing ? t('pp.pause') : play.done ? t('pp.replay') : t('pp.play');
  const go = (target: number) => {
    setManual(true);
    play.seek(target);
  };

  // Geometry helpers
  const C = L.cards;
  const cx = (b: Box) => b.x + b.w / 2;
  const laneACx = L.laneA.x + L.laneA.w / 2;
  const termRun = S.time.state === 'active';
  const termText =
    termRun || S.time.state === 'done'
      ? t('pp.band.termRun', { day: Math.round(fr.day), days })
      : t('pp.band.term', { days });
  const dayFrac = days > 0 ? fr.day / days : 0;
  const dotY = L.termY + (L.maturityY - L.termY) * dayFrac;
  const balanceShown = S.B3.state === 'done';
  const resultOn = S.result.state !== 'todo';

  /** Connector between two cards in lane B, drawn with the progress of the step it leads to. */
  const connector = (from: Box, to: Box, k: number, key: string) => {
    const x = cx(from);
    const y0 = from.y + from.h + 2;
    const y1 = to.y - 3;
    return (
      <g key={key}>
        <path d={`M${x},${y0}V${y1}`} class="pp-conn-track" />
        <path
          d={`M${x},${y0}V${y1}`}
          class="pp-conn"
          pathLength={1}
          style={{ strokeDasharray: 1, strokeDashoffset: 1 - k }}
        />
      </g>
    );
  };

  // Result box text
  const formulaFull = t('pp.result.formula', { chf: chf(chfRepay), notional, fwd: fwdTxt });
  const formula =
    textWidth(formulaFull, L.mono, 0.62) < L.result.w - 32
      ? formulaFull
      : t('pp.result.formulaShort', { fwd: fwdTxt });
  const noteLines = wrapText(
    t('pp.card.A1note'),
    Math.floor((L.laneA.w - 16) / (L.font * 0.56)),
  ).slice(0, 2);

  const aria = t('pp.aria', vars);

  const twoHalves = (b: Box) => {
    const mid = b.y + b.h / 2;
    return [
      { x: b.x, y: b.y, w: b.w, h: mid - b.y - 7 },
      { x: b.x, y: mid + 7, w: b.w, h: b.y + b.h - mid - 7 },
    ];
  };
  const [a2Top, a2Bottom] = twoHalves(C.A2);

  return (
    <div class="m2 pp" data-pp data-step={latestId ?? 'idle'} data-fwd={r.forward.toFixed(6)}>
      <div class="ff-lab-head">
        <div class="m2-titles">
          <div class="ff-lab-title">{t('pp.title', { notional })}</div>
          <div class="ff-lab-sub">{t('pp.sub', { spot: spotTxt, days })}</div>
        </div>
        <span class="m2-chip" data-chip>
          {t('pp.chip', { fwd: fmtRate(r.forward, PAIR, FD), points: pointsTxt })}
        </span>
      </div>
      <div class="ff-lab">
        <div class="ff-lab-main">
          <div ref={box}>
            <svg
              viewBox={`0 0 ${L.width} ${L.height}`}
              role="img"
              aria-label={aria}
              class="m2-svg pp-svg"
            >
              {/* lane titles */}
              <text x={L.laneA.x + 2} y={L.titleY} class="pp-lane-title" style={{ fontSize: `${L.font + 2}px` }}>
                {t('pp.laneA')}
              </text>
              <text x={L.laneA.x + 2} y={L.subY} class="pp-lane-sub" style={{ fontSize: fs }}>
                {t('pp.laneASub')}
              </text>
              <text x={L.laneB.x + 2} y={L.titleY} class="pp-lane-title" style={{ fontSize: `${L.font + 2}px` }}>
                {t('pp.laneB')}
              </text>
              <text x={L.laneB.x + 2} y={L.subY} class="pp-lane-sub" style={{ fontSize: fs }}>
                {t('pp.laneBSub')}
              </text>

              {/* band dividers and the spine */}
              {[L.todayY, L.termY, L.maturityY].map((y) => (
                <path key={y} d={`M0,${y}H${L.width}`} class="m2-grid" />
              ))}
              <path d={`M${L.spine},${L.todayY}V${L.result.y - 6}`} class="pp-spine" />
              {termRun && (
                <path
                  d={`M${L.spine},${L.termY}V${dotY.toFixed(1)}`}
                  class="pp-spine-run"
                />
              )}

              {/* lane A: the forward waits through the term */}
              <path
                d={`M${laneACx},${C.A1.y + C.A1.h + 2}V${C.A2.y - 3}`}
                class={`pp-wait${S.A1.state === 'todo' ? ' is-todo' : ''}`}
              />
              {S.A1.state !== 'todo' &&
                noteLines.map((line, i) => (
                  <text
                    key={i}
                    x={laneACx}
                    y={C.B2.y + C.B2.h / 2 + i * (L.font + 3) - ((noteLines.length - 1) * (L.font + 3)) / 2}
                    class="pp-note"
                    style={{ fontSize: fs }}
                  >
                    {line}
                  </text>
                ))}
              {S.A1.state !== 'todo' && (
                <g class="pp-lock">
                  <rect
                    x={laneACx - Math.min(L.laneA.w / 2 - 4, 58)}
                    y={L.termMid - 20}
                    width={Math.min(L.laneA.w - 8, 116)}
                    height={40}
                    rx={10}
                  />
                  <text x={laneACx} y={L.termMid - 5} style={{ fontSize: fs }} class="pp-lock-label">
                    {t('pp.term.waiting')}
                  </text>
                  <text x={laneACx} y={L.termMid + 12} style={{ fontSize: `${L.mono}px` }} class="pp-lock-value">
                    {fwdTxt}
                  </text>
                </g>
              )}

              {/* lane B: connectors and the balances of the term */}
              {connector(C.B1, C.B2, S.B2.k, 'c12')}
              {connector(C.B2, C.B3, S.B3.k, 'c23')}
              {(
                [
                  { y: L.balanceY[0], label: t('pp.term.usd'), v: usdBal, color: COLOR.usd, text: COLOR.usdText },
                  { y: L.balanceY[1], label: t('pp.term.chf'), v: chfBal, color: COLOR.chf, text: COLOR.chfText },
                ] as const
              ).map((b) => (
                <g key={b.label} class="pp-balance">
                  <text x={L.laneB.x + 2} y={b.y - 6} style={{ fontSize: fs }} class="pp-balance-label">
                    {b.label}
                  </text>
                  <text
                    x={L.laneB.x + L.laneB.w - 2}
                    y={b.y - 6}
                    style={{ fontSize: `${L.mono}px`, fill: balanceShown ? b.text : 'var(--ff-muted)' }}
                    class="pp-balance-value"
                  >
                    {balanceShown ? num(b.v) : '–'}
                  </text>
                  <rect x={L.laneB.x} y={b.y} width={L.laneB.w} height={4} rx={2} class="pp-track" />
                  <rect
                    x={L.laneB.x}
                    y={b.y}
                    width={L.laneB.w}
                    height={4}
                    rx={2}
                    fill={b.color}
                    class="pp-fill"
                    style={{ transform: `scaleX(${balanceShown ? dayFrac : 0})` }}
                  />
                </g>
              ))}

              {/* cards */}
              <Card
                L={L}
                box={C.A1}
                view={S.A1}
                id="A1"
                title={t('pp.card.A1')}
                amount={`F = ${fwdTxt}`}
                color={COLOR.a}
                textColor="var(--ff-ink)"
              />
              <Card
                L={L}
                box={C.B1}
                view={S.B1}
                id="B1"
                title={t('pp.card.B1', { rd: pct(rd) })}
                amount={chf(chfLoan * S.B1.k)}
                color={COLOR.chf}
                textColor={COLOR.chfText}
              />
              <Card
                L={L}
                box={C.B2}
                view={S.B2}
                id="B2"
                title={t('pp.card.B2', { spot: spotTxt })}
                amount={usd(usdToday * S.B2.k)}
                color={COLOR.usd}
                textColor={COLOR.usdText}
              />
              <Card
                L={L}
                box={C.B3}
                view={S.B3}
                id="B3"
                title={t('pp.card.B3', { rf: pct(rf) })}
                amount={usd(usdToday * S.B3.k)}
                color={COLOR.usd}
                textColor={COLOR.usdText}
              />
              <Card
                L={L}
                box={C.B4}
                view={S.B4}
                id="B4"
                title={t('pp.card.B4')}
                amount={usd(N)}
                color={COLOR.usd}
                textColor={COLOR.usdText}
              />
              <Card
                L={L}
                box={C.B5}
                view={S.B5}
                id="B5"
                title={t('pp.card.B5')}
                amount={chf(chfRepay * S.B5.k)}
                color={COLOR.chf}
                textColor={COLOR.chfText}
              />
              <g data-card="A2">
                <Card
                  L={L}
                  box={a2Top!}
                  view={S.A2}
                  id="A2usd"
                  title={t('pp.card.A2usd')}
                  amount={usd(N)}
                  color={COLOR.a}
                  textColor={COLOR.usdText}
                />
                <Card
                  L={L}
                  box={a2Bottom!}
                  view={S.A2}
                  id="A2chf"
                  title={t('pp.card.A2chf')}
                  amount={chf(N * fwd * S.A2.k)}
                  color={COLOR.a}
                  textColor={COLOR.chfText}
                />
              </g>

              {/* equal signs between the lanes */}
              {resultOn &&
                [C.B4.y + C.B4.h / 2, C.B5.y + C.B5.h / 2].map((y, i) => (
                  <g key={i} class="pp-eq" transform={`translate(${L.spine} ${y})`}>
                    <circle r={L.compact ? 12 : 15} />
                    <path d="M-5,-3H5M-5,3H5" />
                  </g>
                ))}

              {/* band chips (on top of the dividers) */}
              <BandChip L={L} y={L.todayY} text={t('pp.band.today')} />
              <BandChip L={L} y={L.termY} text={termText} />
              <BandChip L={L} y={L.maturityY} text={t('pp.band.maturity')} />
              {termRun && <circle cx={L.spine} cy={dotY} r={5} class="pp-dot" />}

              {/* result */}
              {resultOn ? (
                <g class="pp-result is-on" data-result>
                  <rect
                    x={L.result.x + 0.5}
                    y={L.result.y}
                    width={L.result.w - 1}
                    height={L.result.h}
                    rx={14}
                  />
                  <text
                    x={L.result.x + L.result.w / 2}
                    y={L.result.y + (L.compact ? 30 : 28)}
                    class="pp-result-title"
                    style={{ fontSize: `${L.font + 2}px` }}
                  >
                    {t('pp.result.title')}
                  </text>
                  <text
                    x={L.result.x + L.result.w / 2}
                    y={L.result.y + (L.compact ? 58 : 54)}
                    class="pp-result-formula"
                    style={{ fontSize: `${L.mono}px` }}
                  >
                    {formula}
                  </text>
                </g>
              ) : (
                <g class="pp-result">
                  <rect
                    x={L.result.x + 0.5}
                    y={L.result.y}
                    width={L.result.w - 1}
                    height={L.result.h}
                    rx={14}
                  />
                  <text
                    x={L.result.x + L.result.w / 2}
                    y={L.result.y + L.result.h / 2 + L.font * 0.35}
                    class="pp-result-todo"
                    style={{ fontSize: fs }}
                  >
                    {t('pp.result.todo')}
                  </text>
                </g>
              )}
            </svg>
          </div>
          <div class={`m2-insight${aha ? ' is-aha' : ''}`} data-insight>
            {aha && <b>{t('pp.aha.title')}</b>}
            {!aha && latestId !== null && (
              <b class="m2-step-no">{t('pp.counter', { i: stepNo, n: PARITY_STEPS.length })}</b>
            )}
            <span>{narrative}</span>
          </div>
          <ol class="sr-only" aria-label={t('pp.list')}>
            {PARITY_STEPS.filter((id) => id !== 'result').map((id) => (
              <li key={id}>{t(`pp.step.${id}`, vars)}</li>
            ))}
            <li>{t('pp.aha.text', { notional, chf: chf(chfRepay) })}</li>
          </ol>
        </div>

        <div class="ff-lab-side">
          <div class="panel m2-controls">
            <div class="m2-buttons pp-transport">
              <button
                type="button"
                class="m2-btn m2-icon-btn"
                aria-label={t('pp.prev')}
                onClick={() => go(prevTarget(play.pos, tl))}
                data-prev
              >
                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M10 3.5L5.5 8L10 12.5" class="m2-icon-stroke" />
                </svg>
              </button>
              <button type="button" class="m2-btn m2-btn-dark pp-play" onClick={play.toggle} data-play>
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
                class="m2-btn m2-icon-btn"
                aria-label={t('pp.next')}
                onClick={() => go(nextTarget(play.pos, tl))}
                data-next
              >
                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M6 3.5L10.5 8L6 12.5" class="m2-icon-stroke" />
                </svg>
              </button>
            </div>
            <div class="m2-progress" aria-hidden="true">
              <span style={{ transform: `scaleX(${Math.min(1, play.pos / tl.total)})` }} />
            </div>
            <div onPointerDown={onSlide} class="m2-sliders">
              <Slider
                id={`pp-rd-${uid}`}
                label={t('pp.slider.rd')}
                value={rd}
                min={PC.rateRange[0]}
                max={PC.rateRange[1]}
                step={PC.rateStep}
                valueText={pct(rd)}
                onInput={setRd}
              />
              <Slider
                id={`pp-rf-${uid}`}
                label={t('pp.slider.rf')}
                value={rf}
                min={PC.rateRange[0]}
                max={PC.rateRange[1]}
                step={PC.rateStep}
                valueText={pct(rf)}
                onInput={setRf}
              />
              <Slider
                id={`pp-days-${uid}`}
                label={t('pp.slider.days')}
                value={days}
                min={PC.daysRange[0]}
                max={PC.daysRange[1]}
                step={PC.daysStep}
                valueText={t('pp.days', { days })}
                onInput={(v) => setDays(Math.round(v))}
              />
            </div>
          </div>

          <StatTable>
            <StatRow
              symbol={<span aria-hidden="true" class="m2-sw" style={{ borderTopColor: COLOR.a }} />}
              label={t('pp.row.a')}
              sub={t('pp.row.aSub', { notional })}
              value={chf(N * fwd)}
            />
            <StatRow
              symbol={<span aria-hidden="true" class="m2-sw" style={{ borderTopColor: COLOR.chf }} />}
              label={t('pp.row.b')}
              sub={t('pp.row.bSub', { chfLoan: num(chfLoan) })}
              value={chf(chfRepay)}
            />
            <StatRow
              label={t('pp.row.fwd')}
              sub={t('pp.row.fwdSub', { points: pointsTxt })}
              value={fwdTxt}
              highlight
            />
          </StatTable>

          <div class="m2-box" data-cont>
            <div class="m2-box-head">
              <b>{t('pp.cont.title')}</b>
              <span>{t('pp.cont.sub', { t: fmtNumber(r.tq, lang, { digits: 4 }) })}</span>
            </div>
            <dl class="m2-dl">
              <div>
                <dt>{t('pp.cont.fwd')}</dt>
                <dd class="mono">{fmtRate(fCont, PAIR, FD)}</dd>
              </div>
              <div>
                <dt>{t('pp.cont.diff')}</dt>
                <dd class="mono">{t('pp.cont.diffVal', { pips: fmtPips(r.diffPips, lang, 2, true) })}</dd>
              </div>
            </dl>
          </div>
          <div class="sr-only" aria-live="polite" aria-atomic="true">
            {manual && !play.playing ? narrative : ''}
          </div>
        </div>
      </div>
    </div>
  );
}
