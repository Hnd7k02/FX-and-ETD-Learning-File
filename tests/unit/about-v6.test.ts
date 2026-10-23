/**
 * Version 6, group "methodology and loading text" (points 6 and 12):
 * - point 6: the ECB data are updated by hand (workflow "Release", no schedule, D-13). No text
 *   claims an automatic or daily update any more. The About page describes the checks of the
 *   fetch exactly as src/lib/data/validate.ts runs them (numbers from its constants), says that
 *   the file holds a frozen data snapshot, and the data date really is rendered in the
 *   Riskometer and in the footer.
 * - point 12: the loading text of the offline file says why it stays when a view runs no
 *   JavaScript (the preview of the iPad Files app) and where to open the file, in German and
 *   English; after htmlAscii it is pure ASCII and stays readable at 390 px.
 * Check values are typed only here.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { about } from '@/i18n/dict/about';
import { common } from '@/i18n/dict/common';
import { riskometer } from '@/i18n/dict/riskometer';
import { fill, LANGS, type Lang } from '@/i18n/types';
import type { RawRow } from '@/lib/data/csv';
import { bankDaysBetween, isIsoDate } from '@/lib/data/dates';
import {
  MAX_ABS_LOG_RETURN,
  MAX_AGE_BANK_DAYS,
  checkContinuity,
  validate,
  type ValidationRule,
} from '@/lib/data/validate';
import { fmtPct, NBSP } from '@/lib/format';
import { htmlAscii } from '../../scripts/lib/transport';

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

function walk(dir: string, re: RegExp, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, re, out);
    else if (re.test(name)) out.push(p);
  }
  return out;
}

/** Wordings that claim an automatic or daily data update (the old About text and variants). */
const AUTO_UPDATE: readonly RegExp[] = [
  /werktags um 15:30/i,
  /15:30 UTC/i,
  /GitHub Action holt/i,
  /holt die Kurse (werktags|täglich|automatisch)/i,
  /täglich aktualisiert/i,
  /automatisch aktualisiert/i,
  /tägliche[sn]? (Daten-)?Update/i,
  /weekdays at 15:30/i,
  /GitHub Action fetches/i,
  /fetches the rates (on weekdays|daily|automatically)/i,
  /updated daily/i,
  /daily (data )?update/i,
  /updated automatically/i,
  /automatically updated/i,
];

/** Every text a reader sees: dictionaries, section texts, quiz, glossary, components, README. */
function readerFiles(): string[] {
  return [
    ...walk(join(ROOT, 'src/i18n/dict'), /[.]ts$/),
    ...walk(join(ROOT, 'src/content/modules'), /[.]mdx$/),
    ...walk(join(ROOT, 'src/content/quiz'), /[.]ts$/),
    join(ROOT, 'src/content/glossary.ts'),
    ...walk(join(ROOT, 'src/components'), /[.](astro|tsx|ts)$/),
    ...walk(join(ROOT, 'src/views'), /[.]astro$/),
    ...walk(join(ROOT, 'src/layouts'), /[.]astro$/),
    join(ROOT, 'README.md'),
  ];
}

/** The About update text as the page renders it (AboutView fills the same two placeholders). */
function updateText(lang: Lang): string {
  return fill(about[lang]['about.risk.update'], {
    maxAge: MAX_AGE_BANK_DAYS,
    maxJump: fmtPct(MAX_ABS_LOG_RETURN, lang, 0),
  });
}

describe('point 6: no automatic or daily update is claimed', () => {
  it('knows the old wordings it guards against', () => {
    const oldDe =
      'Update: Eine GitHub Action holt die Kurse werktags um 15:30 UTC, prüft sie und baut die Seite.';
    const oldEn =
      'Updates: a GitHub Action fetches the rates on weekdays at 15:30 UTC, validates them.';
    expect(AUTO_UPDATE.some((re) => re.test(oldDe))).toBe(true);
    expect(AUTO_UPDATE.some((re) => re.test(oldEn))).toBe(true);
    expect(AUTO_UPDATE.some((re) => re.test('Die Kurse werden täglich aktualisiert.'))).toBe(true);
    expect(AUTO_UPDATE.some((re) => re.test('The data is updated daily.'))).toBe(true);
    // the ECB publication time and daily fixings are facts, not update claims
    for (const l of LANGS) {
      expect(AUTO_UPDATE.some((re) => re.test(riskometer[l]['rk.footData']))).toBe(false);
    }
    expect(AUTO_UPDATE.some((re) => re.test('daily ECB reference rates'))).toBe(false);
  });

  it('the Riskometer footnote says the time is when the ECB publishes, not when the file updates', () => {
    expect(riskometer.de['rk.footData']).toContain(
      'EZB-Referenzkurse, veröffentlicht an jedem Arbeitstag um ca. 16:00 MEZ;',
    );
    expect(riskometer.en['rk.footData']).toContain(
      'ECB reference rates, published on working days around 16:00 CET;',
    );
    // «werktags» includes Saturday in German; the ECB publishes on working days (Mon–Fri)
    expect(about.de['about.risk.step1.p']).toContain(
      'Die EZB veröffentlicht sie an jedem Arbeitstag um ca. 16:00 MEZ.',
    );
    expect(about.en['about.risk.step1.p']).toContain(
      'The ECB publishes them on working days around 16:00 CET.',
    );
  });

  it('retired wordings (update time read as a schedule, «today» for a frozen value) are gone', () => {
    const RETIRED = [
      '(werktags, ca. 16:00 MEZ)',
      '(business days, about 16:00 CET)',
      'Werktags um ca. 16:00 MEZ, abgerufen',
      'On working days around 16:00 CET, fetched',
      'veröffentlicht sie werktags',
      'Rang des heutigen Werts',
      'Rank of today’s value',
      'Währungspaar gerade schwankt',
      'is swinging right now',
    ];
    const hits: string[] = [];
    for (const f of readerFiles()) {
      const text = readFileSync(f, 'utf8');
      for (const s of RETIRED) if (text.includes(s)) hits.push(`${relative(ROOT, f)}: «${s}»`);
    }
    expect(hits).toEqual([]);
  });

  it('no dictionary, section text, quiz, glossary, component or README claims one', () => {
    const files = readerFiles();
    expect(files.length).toBeGreaterThan(50);
    const hits: string[] = [];
    for (const f of files) {
      const text = readFileSync(f, 'utf8');
      for (const re of AUTO_UPDATE) {
        const m = re.exec(text);
        if (m) hits.push(`${relative(ROOT, f)}: «${m[0]}»`);
      }
    }
    expect(hits).toEqual([]);
  });

  it('the release workflow really has no schedule and fetches with validation', () => {
    const wf = read('.github/workflows/release.yml');
    expect(wf).toContain('workflow_dispatch');
    expect(wf).not.toMatch(/^\s*schedule:/m);
    expect(wf).not.toMatch(/cron/);
    expect(wf).toContain('npm run data:fetch');
    expect(wf).toContain('npm run data:build');
    expect(wf).toContain('npm run check');
    expect(wf).toContain('npm run e2e');
    expect(wf).toContain('gh release create');
    // «by default»: the data input is on unless someone unticks it, and both the fetch and the
    // Riskometer recompute run only with it
    expect(wf).toMatch(/update_data:[^]*?type: boolean\s+default: true/);
    const stepIf = (run: string): string | undefined => {
      const m = new RegExp(`- name: [^\\n]+\\n\\s+(if: [^\\n]+\\n\\s+)?run: ${run}`).exec(wf);
      return m?.[1]?.trim();
    };
    expect(stepIf('npm run data:fetch')).toBe('if: ${{ inputs.update_data }}');
    expect(stepIf('npm run data:build')).toBe('if: ${{ inputs.update_data }}');
    expect(stepIf('npm run check')).toBeUndefined();
    // every listed step comes before the data commit, and the commit before the release
    const at = (s: string) => wf.indexOf(s);
    for (const s of [
      'npm run data:fetch',
      'npm run data:build',
      'npm run check',
      'npm run build',
      'npm run e2e',
    ]) {
      expect(at(s)).toBeGreaterThan(0);
      expect(at(s)).toBeLessThan(at('git commit'));
    }
    expect(at('git commit')).toBeLessThan(at('gh release create'));
    expect(wf).not.toMatch(/if: (always|failure)[(][)]/);
    const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };
    expect(pkg.scripts['data:fetch']).toContain('scripts/fetch-ecb.ts');
    const fetch = read('scripts/fetch-ecb.ts');
    // the stale check runs against the date of the fetch, and the history must stay complete
    expect(fetch).toMatch(/validate[(]rows, [{] today [}][)]/);
    expect(fetch).toMatch(/checkContinuity[(]prev, rows[)]/);
  });
});

describe('point 6: the About page describes the real process', () => {
  it('check values of the validation constants and their formatting', () => {
    expect(MAX_AGE_BANK_DAYS).toBe(5);
    expect(MAX_ABS_LOG_RETURN).toBe(0.1);
    expect(fmtPct(MAX_ABS_LOG_RETURN, 'de', 0)).toBe(`10${NBSP}%`);
    expect(fmtPct(MAX_ABS_LOG_RETURN, 'en', 0)).toBe('10%');
  });

  const RULE_WORDS: Record<Lang, Record<string, RegExp>> = {
    de: {
      manual: /Update von Hand/,
      schedule: /hat keinen Zeitplan/,
      byDefault:
        /Standardmässig holt er zuerst die EZB-Kurse, prüft sie und rechnet das Riskometer neu[.] Die Prüfung verlangt: /,
      date: /jedes Datum gültig/,
      order: /streng aufsteigend/,
      duplicate: /nur einmal/,
      rate: /jeder Kurs über null/,
      future: /kein Datum in der Zukunft/,
      stale: /letzter Wert beim Abruf höchstens 5 Bankarbeitstage [(]Mo–Fr[)] alt/,
      jump: /Betrag der täglichen Log-Rendite je Paar unter 10 % mit dokumentierter Ausnahme/,
      continuity: /kein bisher gespeichertes Datum fehlt/,
      checks:
        /Dann führt er Typprüfung, Lint und Unit-Tests aus, baut die Datei und testet sie in Chromium und WebKit[.]/,
      stop: /Scheitert einer dieser Schritte, bricht er ab, bevor Daten committet oder ein Release veröffentlicht wird[.]/,
      commit: /Nur geänderte Daten ergeben einen Commit[.]/,
      release: /GitHub Release/,
    },
    en: {
      manual: /Updates by hand/,
      schedule: /has no schedule/,
      byDefault:
        /By default it first fetches the ECB rates, validates them and recalculates the Riskometer[.] The validation requires: /,
      date: /every date valid/,
      order: /strictly ascending/,
      duplicate: /present once/,
      rate: /every rate above zero/,
      future: /no date in the future/,
      stale: /last value at most 5 business days [(]Mon–Fri[)] old at the time of the fetch/,
      jump: /absolute daily log return per pair below 10% with a documented exception/,
      continuity: /no previously stored date missing/,
      checks:
        /Then it runs type checks, lint and unit tests, builds the file and tests it in Chromium and WebKit[.]/,
      stop: /If any of these steps fails, it stops before data is committed or a release is published[.]/,
      commit: /Only changed data leads to a commit[.]/,
      release: /GitHub Release/,
    },
  };

  it.each(LANGS)('the update text names every check with the numbers of validate.ts (%s)', (l) => {
    const text = updateText(l).replaceAll(NBSP, ' ');
    expect(text).not.toMatch(/[{}]/);
    for (const [what, re] of Object.entries(RULE_WORDS[l])) {
      expect(re.test(text), `${l} ${what}: «${text}»`).toBe(true);
    }
  });

  it('every check the text names is a real rule of the validation', () => {
    const r = (date: string, CHF = 0.94, USD = 1.16, JPY = 179): RawRow => ({
      date,
      USD,
      CHF,
      JPY,
    });
    const rules = (rows: RawRow[], today?: string): ValidationRule[] =>
      validate(rows, today === undefined ? {} : { today }).map((e) => e.rule);

    expect(rules([r('2026-09-11'), r('2026-09-14')], '2026-09-14')).toEqual([]);
    expect(rules([r('2026-09-11'), r('2026-02-30')])).toContain('date');
    expect(rules([r('2026-09-14'), r('2026-09-11')])).toContain('order');
    expect(rules([r('2026-09-14'), r('2026-09-14')])).toContain('duplicate');
    expect(rules([r('2026-09-11'), r('2026-09-14', 0)])).toContain('rate');
    expect(rules([r('2026-09-11'), r('2026-09-14')], '2026-09-11')).toContain('future');
    // stale: Mon 14.09. → Mon 21.09. are 5 bank days (allowed), → Tue 22.09. are 6
    expect(bankDaysBetween('2026-09-14', '2026-09-21')).toBe(5);
    expect(bankDaysBetween('2026-09-14', '2026-09-22')).toBe(6);
    expect(rules([r('2026-09-11'), r('2026-09-14')], '2026-09-21')).not.toContain('stale');
    expect(rules([r('2026-09-11'), r('2026-09-14')], '2026-09-22')).toContain('stale');
    // jump: ln(1.11) = 0.104 is above the bound, ln(1.10) = 0.095 below it
    expect(rules([r('2026-09-11'), r('2026-09-14', 0.94 * 1.11)])).toContain('jump');
    expect(rules([r('2026-09-11'), r('2026-09-14', 0.94 * 1.1)])).not.toContain('jump');
    // the documented exception (15.01.2015, end of the CHF floor) is not a jump error
    expect(rules([r('2015-01-14', 1.2), r('2015-01-15', 1.02)])).not.toContain('jump');
    // continuity: a date of the stored file may not disappear
    const prev = [r('2026-09-10'), r('2026-09-11'), r('2026-09-14')];
    const next = [r('2026-09-10'), r('2026-09-14')];
    expect(checkContinuity(prev, next).errors.map((e) => e.rule)).toEqual(['continuity']);
  });

  it.each(LANGS)('the snapshot text says frozen, and where the date is shown (%s)', (l) => {
    const text = about[l]['about.risk.snapshot'];
    const words =
      l === 'de'
        ? [
            /Eingefrorener Datenstand/,
            /Die Datei enthält die Daten vom letzten Abruf und lädt keine neuen nach[.]/,
            /Neue Daten kommen nur mit einem neuen Release/,
            /im Riskometer und in der Fusszeile jeder Seite/,
          ]
        : [
            /Frozen data snapshot/,
            /the file contains the data from the last fetch and never loads new data[.]/,
            /New data only comes with a new release/,
            /in the Riskometer and in the footer of every page/,
          ];
    for (const re of words) expect(re.test(text), `${l}: «${text}»`).toBe(true);
  });

  it('the data date really appears in the Riskometer and in the footer', () => {
    for (const l of LANGS) {
      expect(common[l]['footer.dataAsOf']).toContain('{date}');
      expect(riskometer[l]['rk.asOf']).toContain('{date}');
    }
    const footer = read('src/components/layout/Footer.astro');
    expect(footer).toContain("t('footer.dataAsOf', { date: fmtDate(risk.asOf, lang) })");
    expect(read('src/layouts/BaseLayout.astro')).toMatch(/<Footer lang=[{]lang[}]/);
    expect(read('src/components/islands/Riskometer.tsx')).toContain(
      "t('rk.asOf', { date: fmtDate(p.asOf, lang) })",
    );
    const summary = JSON.parse(read('src/data/fx/summary.json')) as { asOf: string };
    const rm = JSON.parse(read('src/data/fx/riskometer.json')) as { asOf: string };
    expect(isIsoDate(summary.asOf)).toBe(true);
    expect(rm.asOf).toBe(summary.asOf);
  });

  it('the About page renders the snapshot and fills the update text from validate.ts', () => {
    const view = read('src/views/AboutView.astro');
    expect(view).toContain("t('about.risk.snapshot')");
    expect(view).toMatch(
      /t[(]'about.risk.update', [{]\s*maxAge: MAX_AGE_BANK_DAYS,\s*maxJump: fmtPct[(]MAX_ABS_LOG_RETURN, lang, 0[)],?\s*[}][)]/,
    );
  });
});

describe('point 12: loading text of the offline file', () => {
  /** The template literal of the loading text in the build script, with a sample version. */
  function loadingSource(): string {
    const src = read('scripts/build-offline.ts');
    const m = /const loading = htmlAscii[(]\s*`([^`]+)`/.exec(src);
    expect(m, 'loading text in scripts/build-offline.ts').not.toBeNull();
    return m![1]!.replace('${versionLabel}', '6 (23.10.2026)');
  }

  it('keeps the start the offline test checks and explains a view without JavaScript', () => {
    const text = loadingSource();
    expect(text.startsWith('Forward First 6 (23.10.2026) wird geladen …')).toBe(true);
    const de =
      'Bleibt nur dieser Text stehen (ohne gelben Diagnose-Kasten), führt diese Ansicht kein JavaScript aus, zum Beispiel die Vorschau der iPad-Dateien-App. Öffne die Datei in Chrome, Edge oder Safari am Computer und erlaube JavaScript.';
    const en =
      'If only this text stays on screen (no yellow diagnostics box), this view does not run JavaScript, for example the preview of the iPad Files app. Open the file in Chrome, Edge or Safari on a computer, with JavaScript allowed.';
    expect(text).toContain(de);
    expect(text).toContain(` / Loading … ${en}`);
    expect(text.indexOf(de)).toBeLessThan(text.indexOf(en));
  });

  it('«no yellow box» really means no JavaScript ran: the box is script-made and yellow', () => {
    // if JavaScript runs but the start fails, the diagnostics script adds a yellow box below the
    // loading text after 4 s; only without JavaScript does the text stay alone
    const diag = read('src/offline/diagnose.ts');
    expect(diag).toContain("box.id = 'ff-diagnose';");
    expect(diag).toContain('background:#fff3b0');
    expect(diag).toMatch(/main[.]appendChild[(]box[)];\s*[}], 4000[)];/);
    const build = read('scripts/build-offline.ts');
    const pos = (s: string) => build.indexOf(s);
    expect(pos('id="ff-loading"')).toBeGreaterThan(0);
    expect(pos('<script id="ff-diag">')).toBeGreaterThan(pos('id="ff-loading"'));
    expect(pos('<script id="ff-main">')).toBeGreaterThan(pos('<script id="ff-diag">'));
  });

  it('is pure ASCII after htmlAscii and has no word too long for 390 px', () => {
    const html = htmlAscii(loadingSource());
    expect([...html].every((ch) => ch.charCodeAt(0) >= 0x20 && ch.charCodeAt(0) <= 0x7e)).toBe(
      true,
    );
    expect(html).toContain('f&#252;hrt');
    expect(html).toContain('&#214;ffne');
    expect(html).toContain('geladen &#8230;');
    // 390 px minus 2 × 16 px padding leaves room for well over 30 characters per line
    const longest = Math.max(
      ...loadingSource()
        .split(' ')
        .map((w) => w.length),
    );
    expect(longest).toBeLessThanOrEqual(20);
    expect(read('scripts/build-offline.ts')).toContain('id="ff-loading" style="padding:48px 16px;');
  });
});
