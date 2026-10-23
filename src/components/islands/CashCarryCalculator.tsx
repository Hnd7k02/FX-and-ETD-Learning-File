/**
 * CashCarryCalculator (module 02, section 4): type a market forward (or drag it on the ruler)
 * and see the fair forward, the mispricing in pips, the direction of the cash and carry and its
 * steps as a timeline with the cash flows today and at maturity. Net today is zero in both
 * currencies; at maturity the profit N · |F_market − F_fair| is left over. "Market reacts" lets
 * the forward glide back to fair while the profit melts away: why the market keeps it there.
 * Maths: cashAndCarry in src/lib/fx/arbitrage.ts, prepared in src/lib/m02/carry.ts;
 * strings in src/i18n/dict/cashcarry.ts.
 */
import type { JSX } from 'preact';
import { useEffect, useId, useRef, useState } from 'preact/hooks';
import { Slider } from '@/components/ui/Slider';
import { StatHero, StatRow, StatTable } from '@/components/ui/Stat';
import {
  useElementWidth,
  useInView,
  usePrefersReducedMotion,
  useTween,
} from '@/components/ui/hooks';
import { cashcarry as dict } from '@/i18n/dict/cashcarry';
import { translator, type Lang } from '@/i18n/types';
import { clamp, scaleLinear } from '@/lib/chart';
import type { CarryStep } from '@/lib/fx/arbitrage';
import { fmtMillions, fmtMoney, fmtPct, fmtPips, fmtRate } from '@/lib/format';
import {
  carryFor,
  clampMarket,
  groupSteps,
  marketRange,
  netFlows,
  reactionAt,
  revealOrder,
  snapMarket,
  startMarket,
  stepRateKind,
} from '@/lib/m02/carry';
import { M02_CONFIG, PIP } from '@/lib/m02/config';
import { dealForward } from '@/lib/m02/hedge';
import { textWidth } from '@/lib/m02/text';
import { useDragX, usePlayback, useSliderDrag } from './m02-shared';

export interface CashCarryCalculatorProps {
  lang: Lang;
}

const M = M02_CONFIG.market;
const A = M02_CONFIG.arbitrage;
const PAIR = M.pair;
const FD = M02_CONFIG.forwardDigits;
const N = M.notional;
const FAIR = carryFor(dealForward()).fairForward;
const RANGE = marketRange(FAIR);

type Dir = 'rich' | 'cheap' | 'none';

function layoutFor(w: number) {
  const width = Math.max(300, Math.round(w));
  const compact = width < 520;
  const font = compact ? 11 : 12;
  const pad = compact ? 14 : 22;
  return { width, compact, font, pad, height: 128, track: 66 };
}

export default function CashCarryCalculator({ lang }: CashCarryCalculatorProps): JSX.Element {
  const t = translator(dict, lang);
  const uid = useId().replace(/[^A-Za-z0-9_-]/g, '');
  const rm = usePrefersReducedMotion();
  const box = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const inView = useInView(box);
  const L = layoutFor(useElementWidth(box, 600));

  const [market, setMarketRaw] = useState<number>(startMarket(FAIR));
  const [draft, setDraft] = useState<string>(fmtRate(startMarket(FAIR), PAIR, FD));
  const [editing, setEditing] = useState(false);
  const [reacting, setReacting] = useState<{ from: number; t0: number } | null>(null);
  const [reacted, setReacted] = useState<Dir | null>(null);
  const [sliding, onSlide] = useSliderDrag();

  const r = carryFor(market);
  const dir: Dir =
    r.direction === 'borrowQuoteBuyBase'
      ? 'rich'
      : r.direction === 'borrowBaseSellBase'
        ? 'cheap'
        : 'none';
  const groups = groupSteps(r);
  const order = revealOrder(r);
  const net = netFlows(r);

  const play = usePlayback(order.length, A.stepMs, { autoplay: true, reduced: rm, inView });
  const shown = play.playing
    ? Math.floor(play.pos) + 1
    : play.started && !play.done
      ? Math.ceil(play.pos)
      : order.length;
  const revealed = (key: CarryStep['key']) => shown > order.indexOf(key);
  const activeKey = play.playing ? order[Math.min(order.length - 1, shown - 1)] : undefined;

  const setMarket = (v: number, fromUser = true) => {
    const x = clampMarket(v, FAIR);
    setMarketRaw(x);
    if (!editing) setDraft(fmtRate(x, PAIR, FD));
    if (fromUser) {
      setReacted(null);
      setReacting(null);
    }
  };

  // Crossing the fair forward flips the trade: play the new steps.
  const lastDir = useRef<Dir>(dir);
  useEffect(() => {
    if (lastDir.current === dir) return;
    lastDir.current = dir;
    if (dir !== 'none') play.restart();
  }, [dir]);

  // "Market reacts": glide back to fair.
  useEffect(() => {
    if (!reacting || typeof requestAnimationFrame === 'undefined') return;
    let raf = 0;
    const step = (now: number) => {
      const k = (now - reacting.t0) / A.reactionMs;
      const v = reactionAt(reacting.from, FAIR, k);
      setMarketRaw(v);
      setDraft(fmtRate(v, PAIR, FD));
      if (k >= 1) {
        setReacting(null);
        return;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [reacting]);

  const react = () => {
    if (dir === 'none') return;
    setReacted(dir);
    play.seek(order.length); // show every step while the profit melts away
    if (rm) {
      setMarketRaw(FAIR);
      setDraft(fmtRate(FAIR, PAIR, FD));
    } else {
      setReacting({ from: market, t0: performance.now() });
    }
  };

  const span = A.rangePips;
  const sx = scaleLinear([-span, span], [L.pad, L.width - L.pad]);
  const drag = useDragX(svgRef, L.width, (vx) =>
    setMarket(snapMarket(FAIR + sx.invert(vx) * PIP, FAIR)),
  );
  const instant = rm || drag.dragging || sliding || !!reacting;
  const [profitShown, gapShown] = useTween([r.profitQuote, r.mispricingPips], 300, instant);

  const chf = (x: number, sign = false) => fmtMoney(x, M.quote, lang, 0, sign);
  const money = (x: number, ccy: string, sign = true) => fmtMoney(x, ccy, lang, 0, sign);
  const notional = fmtMillions(N, '', lang).trim();
  const pipsTxt = (x: number) => fmtPips(x, lang, 1, true);
  /** Size of the mispricing without sign; "too dear"/"too cheap" already says the direction. */
  const pipsAbs = (x: number) => fmtPips(Math.abs(x), lang, 1);
  const gapPips = r.mispricingPips;

  // ---------- ruler ----------
  const x0 = sx(0);
  const xm = sx(clamp(gapShown, -span, span));
  const fs = `${L.font}px`;
  const ticks: number[] = [];
  for (let p = -span; p <= span + 1e-9; p += 10) ticks.push(Math.round(p));
  const labelTicks = ticks.filter((p) => p % (L.compact ? 50 : 25) === 0);
  const gapLabel = t('cc.ruler.gap', { pips: pipsAbs(gapPips), chf: chf(r.profitQuote) });
  const gapW = textWidth(gapLabel, L.font + 1);
  const gapX = clamp((x0 + xm) / 2, L.pad + gapW / 2, L.width - L.pad - gapW / 2);
  const mTxt = fmtRate(market, PAIR, FD);

  const chipKey =
    dir === 'rich' ? 'cc.chip.rich' : dir === 'cheap' ? 'cc.chip.cheap' : 'cc.chip.none';
  const aha = reacted !== null && !reacting && dir === 'none';
  const insight = aha
    ? t(reacted === 'cheap' ? 'cc.aha.textCheap' : 'cc.aha.text')
    : dir === 'none'
      ? t('cc.insight.none')
      : t(dir === 'rich' ? 'cc.insight.rich' : 'cc.insight.cheap', { profit: chf(r.profitQuote) });

  const aria = t('cc.aria', {
    market: mTxt,
    fair: fmtRate(FAIR, PAIR, FD),
    pips: pipsTxt(gapPips),
    result: dir === 'none' ? t('cc.ariaNone') : t('cc.ariaProfit', { profit: chf(r.profitQuote) }),
  });

  const rateText = (s: CarryStep) => {
    const kind = stepRateKind(s.key);
    if (kind === 'none' || s.rate === undefined) return '';
    return kind === 'pct'
      ? fmtPct(s.rate, lang, 2)
      : fmtRate(s.rate, PAIR, s.key.includes('Spot') ? 4 : FD);
  };
  /** Colour by direction, as in module 03: received blue, paid orange, zero neutral. */
  const flowClass = (amount: number) => (amount > 0.5 ? 'is-in' : amount < -0.5 ? 'is-out' : '');

  const stepItem = (s: CarryStep, n: number) => {
    const on = revealed(s.key);
    const state = !on ? 'is-todo' : s.key === activeKey ? 'is-active' : 'is-done';
    const flows: Array<{ ccy: string; amount: number }> = [{ ccy: s.ccy, amount: s.amount }];
    if (s.counter) flows.push(s.counter);
    return (
      <li key={s.key} class={`cc-step ${state}`} data-key={s.key}>
        <span class="cc-n" aria-hidden="true">
          {n}
        </span>
        <div class="cc-body">
          <span class="cc-text">{t(`cc.step.${s.key}`, { rate: rateText(s), notional })}</span>
          <span class={`cc-amts${s.cashflow ? '' : ' is-contract'}`}>
            {flows.map((f) => (
              <span key={f.ccy} class={`cc-amt mono ${flowClass(f.amount)}`}>
                {on ? money(f.amount, f.ccy) : '–'}
              </span>
            ))}
            {!s.cashflow && <span class="cc-contract">{t('cc.contract')}</span>}
          </span>
        </div>
      </li>
    );
  };

  const netRow = (
    label: string,
    flows: Record<string, number>,
    visible: boolean,
    zeroNote: boolean,
  ) => (
    <div class={`cc-net${visible ? '' : ' is-todo'}`}>
      <span class="cc-net-label">{label}</span>
      <span class="cc-net-vals mono">
        {[M.base, M.quote].map((ccy) => (
          <span key={ccy} class={flowClass(flows[ccy] ?? 0)}>
            {visible ? money(flows[ccy] ?? 0, ccy) : '–'}
          </span>
        ))}
      </span>
      {zeroNote && visible && <span class="cc-net-note">✓ {t('cc.netZero')}</span>}
    </div>
  );
  const todayDone = groups.today.every((s) => revealed(s.key));
  const maturityDone = groups.maturity.every((s) => revealed(s.key));
  const profitOn = groups.profit ? revealed('profit') : false;

  return (
    <div class="m2 cc" data-cc data-dir={dir} data-market={market.toFixed(6)}>
      <div class="ff-lab-head">
        <div class="m2-titles">
          <div class="ff-lab-title">{t('cc.title')}</div>
          <div class="ff-lab-sub">
            {t('cc.sub', {
              spot: fmtRate(M.spot, PAIR),
              rd: fmtPct(M.rd, lang, 2),
              rf: fmtPct(M.rf, lang, 2),
              days: M.days,
              notional,
            })}
          </div>
        </div>
        <span class={`m2-chip ${dir === 'none' ? 'is-good' : 'is-warn'}`} data-chip>
          {t(chipKey, { pips: pipsAbs(gapPips) })}
        </span>
      </div>
      <div class="ff-lab">
        <div class="ff-lab-main">
          <div ref={box}>
            <svg
              ref={svgRef}
              viewBox={`0 0 ${L.width} ${L.height}`}
              role="img"
              aria-label={aria}
              class="m2-svg cc-svg"
            >
              <text x={L.pad} y={16} class="cc-region" style={{ fontSize: fs }}>
                {t('cc.ruler.cheap')}
              </text>
              <text
                x={L.width - L.pad}
                y={16}
                class="cc-region"
                style={{ fontSize: fs, textAnchor: 'end' }}
              >
                {t('cc.ruler.rich')}
              </text>
              <text x={x0} y={16} class="cc-fair-label" style={{ fontSize: fs }}>
                {t('cc.ruler.fair', { fwd: fmtRate(FAIR, PAIR, FD) })}
              </text>
              <path d={`M${L.pad},${L.track}H${L.width - L.pad}`} class="m2-rail" />
              {ticks.map((p) => (
                <path
                  key={p}
                  d={`M${sx(p).toFixed(1)},${L.track + 8}V${L.track + (p % 50 === 0 ? 15 : 12)}`}
                  class="m2-axis"
                />
              ))}
              {labelTicks.map((p) => (
                <text key={p} x={sx(p)} y={L.track + 29} class="cc-tick" style={{ fontSize: fs }}>
                  {p === 0 ? '0' : fmtPips(p, lang, 0, true)}
                </text>
              ))}
              {/* gap = profit per unit */}
              {Math.abs(xm - x0) > 0.5 && (
                <rect
                  x={Math.min(x0, xm)}
                  y={L.track - 9}
                  width={Math.abs(xm - x0)}
                  height={18}
                  rx={4}
                  class="cc-gap"
                />
              )}
              <path d={`M${x0.toFixed(1)},${24}V${L.track + 16}`} class="cc-fair" />
              {dir !== 'none' && (
                <text
                  x={gapX}
                  y={L.height - 6}
                  class="cc-gap-label"
                  style={{ fontSize: `${L.font + 1}px` }}
                >
                  {gapLabel}
                </text>
              )}
              <g
                class={`m2-handle${drag.dragging ? ' is-active' : ''}`}
                data-handle
                {...drag.handlers}
              >
                <rect x={0} y={L.track - 26} width={L.width} height={52} class="m2-hit" />
                <rect
                  x={xm - 38}
                  y={L.track - 12}
                  width={76}
                  height={24}
                  rx={12}
                  class="m2-handle-pill"
                />
                <text x={xm} y={L.track + 4} class="m2-handle-text">
                  {mTxt}
                </text>
              </g>
            </svg>
          </div>
          <p class="m2-hint">{t('cc.hint')}</p>

          <div class="cc-timeline" data-steps={order.length}>
            {dir === 'none' ? (
              <p class="cc-none">{t('cc.none')}</p>
            ) : (
              <>
                <div class="cc-col">
                  <div class="cc-col-head">{t('cc.today')}</div>
                  <ol class="cc-list" aria-label={t('cc.today')}>
                    {groups.today.map((s, i) => stepItem(s, i + 1))}
                  </ol>
                  {netRow(t('cc.netToday'), net.today, todayDone, true)}
                </div>
                <div class="cc-col">
                  <div class="cc-col-head">{t('cc.maturity', { days: M.days })}</div>
                  <ol class="cc-list" aria-label={t('cc.maturity', { days: M.days })}>
                    {groups.maturity.map((s, i) => stepItem(s, groups.today.length + i + 1))}
                  </ol>
                  {netRow(t('cc.netMaturity'), net.maturity, maturityDone, false)}
                </div>
              </>
            )}
          </div>
          <div class={`m2-insight${aha ? ' is-aha' : ''}`} data-insight>
            {aha && <b>{t('cc.aha.title')}</b>}
            <span>{insight}</span>
          </div>
        </div>

        <div class="ff-lab-side">
          <div class="panel m2-controls">
            <div class="m2-field">
              <label class="field-label" for={`cc-in-${uid}`}>
                <span>{t('cc.input')}</span>
              </label>
              <input
                id={`cc-in-${uid}`}
                class="m2-input mono"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                spellcheck={false}
                value={draft}
                aria-describedby={`cc-help-${uid}`}
                onFocus={() => setEditing(true)}
                onBlur={() => {
                  setEditing(false);
                  setDraft(fmtRate(market, PAIR, FD));
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
                }}
                onInput={(e) => {
                  const raw = (e.currentTarget as HTMLInputElement).value;
                  setDraft(raw);
                  const v = Number(raw.replace(',', '.').trim());
                  if (raw.trim() !== '' && Number.isFinite(v) && v > 0) setMarket(v);
                }}
              />
              <span id={`cc-help-${uid}`} class="m2-small">
                {t('cc.inputHelp', {
                  min: fmtRate(RANGE.min, PAIR, FD),
                  max: fmtRate(RANGE.max, PAIR, FD),
                })}
              </span>
            </div>
            <div onPointerDown={onSlide}>
              <Slider
                id={`cc-sl-${uid}`}
                label={t('cc.slider')}
                value={market}
                min={RANGE.min}
                max={RANGE.max}
                step={RANGE.step}
                valueText={mTxt}
                onInput={(v) => setMarket(v)}
              />
            </div>
            <div class="m2-buttons">
              <button
                type="button"
                class="m2-btn m2-btn-dark"
                onClick={play.playing ? play.pause : play.restart}
                disabled={dir === 'none'}
                data-play
              >
                <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                  {play.playing ? (
                    <path d="M4 2.5V11.5M10 2.5V11.5" class="m2-icon-stroke" />
                  ) : (
                    <path d="M4 2.2L11.5 7L4 11.8Z" class="m2-icon-fill" />
                  )}
                </svg>
                {play.playing ? t('cc.pause') : t('cc.play')}
              </button>
              <button
                type="button"
                class="m2-btn"
                onClick={react}
                disabled={dir === 'none' || !!reacting}
                data-react
              >
                {t('cc.react')}
              </button>
              <button
                type="button"
                class="m2-btn"
                onClick={() => setMarket(startMarket(FAIR))}
                data-reset
              >
                {t('cc.reset', { pips: pipsTxt(A.mispricingPips) })}
              </button>
            </div>
          </div>

          <StatTable>
            <StatRow
              label={t('cc.row.fair')}
              sub={t('cc.row.fairSub')}
              value={fmtRate(FAIR, PAIR, FD)}
            />
            <StatRow label={t('cc.row.market')} sub={t('cc.row.marketSub')} value={mTxt} />
            <StatRow
              label={t('cc.row.gap')}
              sub={t('cc.row.gapSub')}
              value={t('cc.row.gapVal', { pips: pipsTxt(gapPips) })}
              highlight
            />
          </StatTable>
          <div
            class={`cc-hero${profitOn || dir === 'none' ? '' : ' is-todo'}`}
            data-profit={r.profitQuote.toFixed(2)}
          >
            <StatHero
              label={t('cc.profit')}
              value={dir === 'none' ? chf(0) : profitOn ? chf(profitShown, true) : '–'}
              sub={
                dir === 'none'
                  ? t('cc.profitNone')
                  : profitOn
                    ? t('cc.profitSub', { pv: chf(r.profitPresentValue) })
                    : undefined
              }
            />
          </div>
          <div class="sr-only" aria-live="polite" aria-atomic="true">
            {sliding || drag.dragging || reacting ? '' : aria}
          </div>
        </div>
      </div>
    </div>
  );
}
