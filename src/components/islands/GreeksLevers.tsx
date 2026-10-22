/**
 * Five levers (module 05, section 1): the sign table of the Greeks, alive.
 *
 * One row per market input of the importer's USD call (spot, time, vol, CHF rate, USD rate).
 * Pick a direction and the bar shows the exact change of the premium (full repricing) next to
 * the estimate of the lever's Greek, plus one sentence on why. Bars and numbers glide in 300 ms
 * (instant under reduced motion). Maths: src/lib/greeksfigures.ts. Strings: greekslevers.ts.
 */
import type { JSX } from 'preact';
import { useMemo, useState } from 'preact/hooks';
import { Segmented } from '@/components/ui/Segmented';
import { usePrefersReducedMotion, useTween } from '@/components/ui/hooks';
import { greekslevers as dict } from '@/i18n/dict/greekslevers';
import { translator, type Lang } from '@/i18n/types';
import { EXAMPLE, EXAMPLE_STRIKE } from '@/lib/fx/example';
import { fmtMoney, fmtRate } from '@/lib/format';
import {
  LEVER_CONFIG,
  basePremiumChf,
  leverEffect,
  leverForward,
  type LeverChoice,
  type LeverKey,
} from '@/lib/greeksfigures';

export interface GreeksLeversProps {
  lang: Lang;
}

const SYMBOL: Record<LeverKey, JSX.Element> = {
  spot: <>Δ Γ</>,
  time: <>Θ</>,
  vol: <>ν</>,
  rd: (
    <>
      ρ<sub>d</sub>
    </>
  ),
  rf: (
    <>
      ρ<sub>f</sub>
    </>
  ),
};

export default function GreeksLevers({ lang }: GreeksLeversProps): JSX.Element {
  const t = translator(dict, lang);
  const C = LEVER_CONFIG;
  const [choice, setChoice] = useState<Record<LeverKey, LeverChoice>>({ ...C.defaults });
  const rm = usePrefersReducedMotion();

  const effects = useMemo(
    () => C.order.map((k) => ({ key: k, ...leverEffect(k, choice[k]) })),
    [C.order.map((k) => choice[k]).join(',')],
  );
  const shown = useTween(
    effects.flatMap((e) => [e.exact, e.estimate]),
    300,
    rm,
  );

  const chf = (x: number, sign = true) => fmtMoney(x, EXAMPLE.quote, lang, 0, sign);
  const strike = fmtRate(EXAMPLE_STRIKE, EXAMPLE.pair);
  const optLabel = (k: LeverKey, c: LeverChoice): string => {
    if (k === 'time') return t(`glv.opt.time.${c as 'day' | 'week' | 'month'}`);
    if (k === 'rd' || k === 'rf') return t(`glv.opt.rate.${c as 'down' | 'up'}`);
    return t(`glv.opt.${k}.${c as 'down' | 'up'}`);
  };
  const why = (k: LeverKey, c: LeverChoice): string => {
    const fwd = fmtRate(leverForward(k, c), EXAMPLE.pair);
    if (k === 'time') return t('glv.why.time');
    const d = c as 'down' | 'up';
    if (k === 'spot') return t(`glv.why.spot.${d}`, { strike });
    if (k === 'vol') return t(`glv.why.vol.${d}`);
    return t(`glv.why.${k}.${d}`, { fwd });
  };

  const axis = C.axisChf;
  const list = effects
    .map((e) => `${t(`glv.name.${e.key}`)} ${optLabel(e.key, choice[e.key])}: ${chf(e.exact)}`)
    .join('; ');

  return (
    <div class="glv" data-levers>
      <div class="ff-lab-head">
        <div class="glv-titles">
          <div class="ff-lab-title">{t('glv.title')}</div>
          <div class="ff-lab-sub">{t('glv.sub')}</div>
        </div>
        <span class="glv-premium">
          {t('glv.premium')} <b>{chf(basePremiumChf(), false)}</b>
        </span>
      </div>

      <div class="glv-rows" role="group" aria-label={t('glv.group')}>
        {effects.map((e, i) => {
          const exact = shown[2 * i] ?? e.exact;
          const est = shown[2 * i + 1] ?? e.estimate;
          const share = Math.min(1, Math.abs(exact) / axis);
          const up = e.exact >= 0;
          const name = t(`glv.name.${e.key}`);
          const dir = up ? t('glv.more') : t('glv.less');
          return (
            <div class="glv-row" key={e.key} data-lever={e.key} data-sign={up ? 'up' : 'down'}>
              <span class="glv-name">
                <span class="glv-sym" aria-hidden="true">
                  <span>{SYMBOL[e.key]}</span>
                </span>
                {name}
              </span>
              <div class="glv-ctrl">
                <Segmented
                  label={t('glv.choice', { lever: name })}
                  options={C.choices[e.key].map((c) => ({ value: c, label: optLabel(e.key, c) }))}
                  value={choice[e.key]}
                  onChange={(v) => setChoice((s) => ({ ...s, [e.key]: v }))}
                />
              </div>
              <div
                class="glv-track"
                role="img"
                aria-label={t('glv.bar', { lever: name, v: chf(e.exact), dir })}
              >
                <span class="glv-zero" aria-hidden="true" />
                <span
                  class={`glv-bar ${up ? 'is-up' : 'is-down'}`}
                  aria-hidden="true"
                  style={{
                    left: up ? '50%' : `${50 - share * 50}%`,
                    width: `${share * 50}%`,
                  }}
                />
              </div>
              <span class={`glv-value ${up ? 'is-up' : 'is-down'}`} data-value>
                {chf(exact)}
                <small>{dir}</small>
              </span>
              <div class="glv-foot">
                <span class="glv-why">{why(e.key, choice[e.key])}</span>
                <span class="glv-est">{t(`glv.estimate.${e.key}`, { v: chf(est) })}</span>
              </div>
            </div>
          );
        })}
      </div>
      <p class="sr-only" data-summary>
        {t('glv.summary', { premium: chf(basePremiumChf(), false), list })}
      </p>
    </div>
  );
}
