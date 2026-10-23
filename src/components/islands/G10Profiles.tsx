/**
 * G10 profiles (module 01, section 4): ten currencies with central bank, role, typical drivers
 * and the quoting convention of their usual pair.
 *
 * Filter by role (non-matching cards step back but stay in place, so the layout never jumps);
 * pick a scenario (crisis, calm markets, commodity boom) and every card shows its textbook
 * tendency, the badges rising in one after another (transform only, instant under reduced
 * motion). Tap a card for its profile. Logic and scenario rules: src/lib/m01/g10.ts. Strings:
 * src/i18n/dict/g10profiles.ts.
 */
import type { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { Segmented } from '@/components/ui/Segmented';
import { g10profiles as dict } from '@/i18n/dict/g10profiles';
import { translator, type Lang } from '@/i18n/types';
import { fmtMoney, fmtNumber } from '@/lib/format';
import {
  G10,
  G10_ROLES,
  G10_SCENARIOS,
  matchingCodes,
  pairConvention,
  profileOf,
  selectionAfterFilter,
  tendencies,
  tendency,
  type G10Code,
  type G10Filter,
  type G10Scenario,
  type Tendency,
} from '@/lib/m01/g10';

export interface G10ProfilesProps {
  lang: Lang;
  /** Currency shown first (default CHF, the importer's home currency). */
  initial?: G10Code;
}

const FILTERS: G10Filter[] = ['all', ...G10_ROLES];
const ARROW: Record<Tendency, string> = { up: '↑', down: '↓', flat: '–' };

export default function G10Profiles({ lang, initial = 'CHF' }: G10ProfilesProps): JSX.Element {
  const t = translator(dict, lang);
  const [filter, setFilter] = useState<G10Filter>('all');
  const [scenario, setScenario] = useState<G10Scenario>('none');
  const [selected, setSelected] = useState<G10Code>(initial);

  const matches = matchingCodes(filter);
  const prof = profileOf(selected);
  const conv = pairConvention(selected);
  const groups = tendencies(scenario);
  const list = (codes: G10Code[]) => codes.join(', ');
  const scNote = t(`scnote.${scenario}`, { up: list(groups.up), down: list(groups.down) });
  const summary =
    filter === 'all'
      ? t('summaryAll', { codes: list(matches) })
      : t('summary', {
          n: matches.length,
          role: t(`role.${filter}`),
          codes: list(matches),
        });

  const changeFilter = (f: G10Filter) => {
    setFilter(f);
    setSelected((cur) => selectionAfterFilter(cur, f));
  };

  const drivers = t(`drivers.${selected}`).split('|');
  const roleTexts = prof.roles.length
    ? prof.roles.map((r) => t(`roleLong.${r}`))
    : [t('roleLong.none')];

  return (
    <div
      class="g10"
      data-g10
      data-filter={filter}
      data-scenario={scenario}
      data-selected={selected}
    >
      <div class="ff-lab-head">
        <div class="g10-head-text">
          <div class="ff-lab-title">{t('title')}</div>
          <div class="ff-lab-sub">{t('sub')}</div>
        </div>
        <span class="ff-pill-note g10-chip">{t('chip')}</span>
      </div>
      <div class="ff-lab">
        <div class="ff-lab-main">
          <div class="g10-controls">
            <div class="g10-control">
              <span class="field-label">{t('role')}</span>
              <Segmented
                label={t('role')}
                options={FILTERS.map((f) => ({ value: f, label: t(`role.${f}`) }))}
                value={filter}
                onChange={changeFilter}
              />
            </div>
            <div class="g10-control">
              <span class="field-label">{t('scenario')}</span>
              <Segmented
                label={t('scenario')}
                options={G10_SCENARIOS.map((s) => ({ value: s, label: t(`scenario.${s}`) }))}
                value={scenario}
                onChange={setScenario}
              />
            </div>
          </div>

          <div class="g10-grid" role="group" aria-label={t('grid')}>
            {G10.map((p, i) => {
              const on = matches.includes(p.code);
              const tend = tendency(p.code, scenario);
              return (
                <button
                  key={p.code}
                  type="button"
                  class={`g10-card${on ? '' : ' is-dim'}${scenario !== 'none' ? ` is-${tend}` : ''}`}
                  aria-pressed={selected === p.code}
                  data-code={p.code}
                  data-match={on}
                  data-tendency={tend}
                  onClick={() => setSelected(p.code)}
                >
                  <span class="g10-code">{p.code}</span>
                  <span class="g10-name">{t(`name.${p.code}`)}</span>
                  <span class="g10-roles">
                    {p.roles.map((r) => (
                      <span key={r} class={`g10-role g10-role--${r}`}>
                        {t(`role.${r}`)}
                      </span>
                    ))}
                  </span>
                  {scenario !== 'none' && (
                    <span
                      key={`${scenario}-${p.code}`}
                      class={`g10-tend g10-tend--${tend}`}
                      style={{ animationDelay: `${i * 40}ms` }}
                    >
                      <span aria-hidden="true">{ARROW[tend]}</span> {t(`tend.${tend}`)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <p class={`g10-note g10-note--${scenario}`} data-note aria-live="polite">
            {scNote}
            {scenario !== 'none' && <span class="g10-caveat"> {t('caveat')}</span>}
          </p>
          <p class="sr-only" aria-live="polite">
            {summary}
          </p>
        </div>

        <div class="ff-lab-side">
          <div class="g10-detail" data-detail aria-live="polite">
            <div class="g10-detail-head">
              <span class="g10-detail-label">{t('selected')}</span>
              <span class="g10-detail-title">
                <span class="g10-detail-code">{selected}</span>
                <span class="g10-detail-name">{t(`name.${selected}`)}</span>
              </span>
            </div>
            <div class="g10-detail-row">
              <span class="g10-detail-key">{t('cb')}</span>
              <span class="g10-detail-val">{t(`cb.${selected}`)}</span>
            </div>
            <div class="g10-detail-row">
              <span class="g10-detail-key">{t('roles')}</span>
              <span class="g10-detail-val">
                {roleTexts.map((r) => (
                  <span key={r} class="g10-detail-line">
                    {r}
                  </span>
                ))}
              </span>
            </div>
            <div class="g10-detail-row">
              <span class="g10-detail-key">{t('drivers')}</span>
              <ul class="g10-drivers">
                {drivers.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </div>
            <div class="g10-detail-row">
              <span class="g10-detail-key">{t('conv')}</span>
              <span class="g10-detail-val">
                <span class="g10-detail-line">
                  <b class="mono">{t('convPair', { pair: conv.pair })}</b>
                </span>
                <span class="g10-detail-line">
                  {t('convDecimals', {
                    dec: conv.decimals,
                    pip: fmtNumber(conv.pip, 'en', { digits: conv.decimals }),
                  })}
                </span>
                <span class="g10-detail-line">
                  {t('convPipValue', {
                    base: conv.base,
                    value: fmtMoney(conv.pipValuePerMillion, conv.quote, lang),
                  })}
                </span>
                <span class="g10-detail-line" data-value-date>
                  {t(conv.spotDays === 1 ? 'convValueOne' : 'convValue', { days: conv.spotDays })}
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
