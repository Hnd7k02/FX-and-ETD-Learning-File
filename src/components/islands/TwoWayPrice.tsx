/**
 * Two-way price (module 01, section 3): anatomy of a USD/CHF quote and what widens the spread.
 *
 * A dealing-style tile shows bid and ask split into big figure and pips; a ruler shows the
 * spread as a band around the mid. Five toggles (thin market, late evening, large amount, high
 * vol, risk event) widen the spread by schematic amounts; prices and costs count to their new
 * values in 300 ms (instant under reduced motion). Logic: src/lib/m01/quote.ts.
 */
import type { JSX } from 'preact';
import { useRef, useState } from 'preact/hooks';
import { StatRow, StatTable } from '@/components/ui/Stat';
import { useElementWidth, usePrefersReducedMotion, useTween } from '@/components/ui/hooks';
import { twowayprice as dict } from '@/i18n/dict/twowayprice';
import { translator, type Lang } from '@/i18n/types';
import { scaleLinear } from '@/lib/chart';
import { EXAMPLE } from '@/lib/fx/example';
import { fmtMillions, fmtMoney, fmtNumber, fmtRate } from '@/lib/format';
import {
  SPREAD_DRIVERS,
  SPREAD_MODEL as M,
  quoteParts,
  spreadCost,
  spreadPips,
  twoWayQuote,
  type DriverState,
  type SpreadDriver,
} from '@/lib/m01/quote';

export interface TwoWayPriceProps {
  lang: Lang;
}

const PAIR = M.pair;
const N = EXAMPLE.notional;
const PIP = 1e-4;
const MAX_SPREAD = spreadPips(Object.fromEntries(SPREAD_DRIVERS.map((d) => [d, true])));
/** Ruler half-width in pips (a little wider than the widest spread). */
const HALF = Math.ceil(MAX_SPREAD / 2 / 4) * 4 + 4;

export default function TwoWayPrice({ lang }: TwoWayPriceProps): JSX.Element {
  const t = translator(dict, lang);
  const rm = usePrefersReducedMotion();
  const [on, setOn] = useState<DriverState>({});
  const box = useRef<HTMLDivElement>(null);
  const W = Math.max(280, Math.round(useElementWidth(box, 600)));
  const compact = W < 520;

  const spread = spreadPips(on);
  const [shown] = useTween([spread], 300, rm);
  const s = shown ?? spread;
  // while counting, keep the shown prices on the pip grid so the digits roll pip by pip
  const half = Math.round(s / 2);
  const q = twoWayQuote(M.mid, half * 2);
  const exact = twoWayQuote(M.mid, spread);
  const bid = quoteParts(q.bid, PAIR);
  const ask = quoteParts(q.ask, PAIR);
  const chf = (x: number) => fmtMoney(x, EXAMPLE.quote, lang);
  const notional = fmtMillions(N, '', lang).trim();
  const halfCost = spreadCost(spread, N);
  const baseHalf = spreadCost(M.basePips, N);
  const count = SPREAD_DRIVERS.filter((d) => on[d]).length;
  const noteKey = spread === M.basePips ? 'note.base' : count >= 4 ? 'note.wide' : 'note.wider';
  const note = t(noteKey, {
    pips: fmtNumber(spread, lang),
    half: chf(halfCost),
    base: chf(baseHalf),
    factor: fmtNumber(halfCost / baseHalf, lang, { digits: 0 }),
  });

  // ruler
  const H = compact ? 96 : 104;
  const left = 12;
  const right = W - 12;
  const sx = scaleLinear([-HALF, HALF], [left, right]);
  const axisY = 56;
  const fs = compact ? 11 : 12;
  const xb = sx(-s / 2);
  const xa = sx(s / 2);
  const ticks: number[] = [];
  for (let p = -HALF; p <= HALF; p += 2) ticks.push(p);
  const labelled = [-HALF + 4, 0, HALF - 4];

  const toggle = (d: SpreadDriver) => setOn((o) => ({ ...o, [d]: !o[d] }));

  return (
    <div class="twp" data-twp data-spread={spread}>
      <div class="ff-lab-head">
        <div class="twp-head-text">
          <div class="ff-lab-title">{t('title')}</div>
          <div class="ff-lab-sub">
            {t('sub', { pair: PAIR, mid: fmtRate(M.mid, PAIR), notional })}
          </div>
        </div>
        <span class="ff-pill-note twp-chip">{t('chip')}</span>
      </div>
      <div class="ff-lab">
        <div class="ff-lab-main">
          <div
            class="twp-quote"
            role="img"
            aria-label={t('quoteAria', {
              pair: PAIR,
              bid: fmtRate(exact.bid, PAIR),
              ask: fmtRate(exact.ask, PAIR),
              pips: fmtNumber(spread, lang),
            })}
          >
            <div class="twp-side twp-side--bid">
              <span class="twp-side-label">{t('bid')}</span>
              <span class="twp-price mono" aria-hidden="true">
                <span class="twp-big">{bid.big}</span>
                <span class="twp-pips">{bid.pips}</span>
              </span>
              <span class="twp-parts" aria-hidden="true">
                <span class="twp-part twp-part--big">{t('bigFigure')}</span>
                <span class="twp-part twp-part--pips">{t('pips')}</span>
              </span>
              <span class="twp-role">{t('bidRole')}</span>
            </div>
            <div class="twp-mid">
              <span class="twp-spread-pill" data-spread-pill>
                {t('spread', { pips: fmtNumber(half * 2, lang) })}
              </span>
            </div>
            <div class="twp-side twp-side--ask">
              <span class="twp-side-label">{t('ask')}</span>
              <span class="twp-price mono" aria-hidden="true">
                <span class="twp-big">{ask.big}</span>
                <span class="twp-pips">{ask.pips}</span>
              </span>
              <span class="twp-parts" aria-hidden="true">
                <span class="twp-part twp-part--big">{t('bigFigure')}</span>
                <span class="twp-part twp-part--pips">{t('pips')}</span>
              </span>
              <span class="twp-role">{t('askRole')}</span>
            </div>
          </div>
          <div ref={box} class="twp-ruler">
            <div class="twp-ruler-title">{t('ruler')}</div>
            <svg
              viewBox={`0 0 ${W} ${H}`}
              role="img"
              aria-label={t('rulerAria', {
                mid: fmtRate(M.mid, PAIR),
                bid: fmtRate(exact.bid, PAIR),
                ask: fmtRate(exact.ask, PAIR),
                pips: fmtNumber(spread, lang),
              })}
              class="twp-svg"
            >
              {ticks.map((p) => (
                <path
                  key={p}
                  d={`M${sx(p).toFixed(1)},${axisY - (p % 10 === 0 ? 6 : 3)}V${axisY + (p % 10 === 0 ? 6 : 3)}`}
                  style={{ stroke: 'var(--ff-axis)', strokeWidth: 1 }}
                />
              ))}
              <rect
                x={xb}
                y={axisY - 12}
                width={Math.max(0, xa - xb)}
                height={24}
                rx={6}
                style={{ fill: 'var(--ff-exotics-soft)', stroke: 'var(--ff-short)', strokeWidth: 1.5 }}
              />
              <path
                d={`M${left},${axisY}H${right}`}
                style={{ stroke: 'var(--ff-axis)', strokeWidth: 1 }}
              />
              <path
                d={`M${sx(0)},${axisY - 12}V${axisY + 12}`}
                style={{ stroke: 'var(--ff-ink)', strokeWidth: 1.5, strokeDasharray: '2 2' }}
              />
              <text
                x={xb - 6}
                y={axisY - 18}
                style={{ fontSize: `${fs}px`, fontWeight: 700, fill: 'var(--ff-ink)', textAnchor: 'end' }}
              >
                {t('bid')} {fmtRate(q.bid, PAIR)}
              </text>
              <text
                x={xa + 6}
                y={axisY - 18}
                style={{ fontSize: `${fs}px`, fontWeight: 700, fill: 'var(--ff-ink)', textAnchor: 'start' }}
              >
                {t('ask')} {fmtRate(q.ask, PAIR)}
              </text>
              {labelled.map((p) => (
                <text
                  key={p}
                  x={sx(p)}
                  y={axisY + 30}
                  style={{ fontSize: `${fs}px`, fill: 'var(--ff-muted)', textAnchor: 'middle' }}
                >
                  {p === 0 ? `${t('mid')} ${fmtRate(M.mid, PAIR)}` : fmtRate(M.mid + p * PIP, PAIR)}
                </text>
              ))}
            </svg>
          </div>
          <p class="twp-schematic">{t('schematic')}</p>
        </div>
        <div class="ff-lab-side">
          <div class="twp-drivers" role="group" aria-label={t('drivers')}>
            <div class="twp-drivers-title">{t('drivers')}</div>
            {SPREAD_DRIVERS.map((d) => (
              <button
                key={d}
                type="button"
                class="twp-driver"
                aria-pressed={!!on[d]}
                data-driver={d}
                onClick={() => toggle(d)}
              >
                <span class="twp-switch" aria-hidden="true">
                  <span class="twp-knob" />
                </span>
                <span class="twp-driver-text">
                  <span class="twp-driver-label">{t(`driver.${d}`)}</span>
                  <span class="twp-driver-sub">{t(`driver.${d}.sub`)}</span>
                </span>
                <span class="twp-driver-pips mono">{t('addPips', { pips: M.addPips[d] })}</span>
              </button>
            ))}
            {count > 0 && (
              <button type="button" class="btn btn-light twp-reset" onClick={() => setOn({})}>
                {t('reset')}
              </button>
            )}
          </div>
          <StatTable>
            <StatRow
              label={t('rowBuy', { notional })}
              sub={t('rowBuySub')}
              value={chf(q.ask * N)}
            />
            <StatRow
              label={t('rowSell', { notional })}
              sub={t('rowSellSub')}
              value={chf(q.bid * N)}
            />
            <StatRow
              label={t('rowHalf')}
              sub={t('rowHalfSub')}
              value={chf(spreadCost(half * 2, N))}
              highlight
            />
            <StatRow
              label={t('rowFull')}
              sub={t('rowFullSub')}
              value={chf(spreadCost(half * 2, N, 'full'))}
            />
          </StatTable>
          <p class={`twp-note${count >= 4 ? ' is-wide' : ''}`} data-note aria-live="polite">
            {note}
          </p>
        </div>
      </div>
    </div>
  );
}
