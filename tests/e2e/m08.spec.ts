/**
 * Module 08 structured products: every section and the quiz render in DE and EN without
 * horizontal scroll; every island reacts to input (building-block steps and fixing, path
 * simulator scenarios, scrub, playback, drag twins, 100-path view, live Monte Carlo value in the
 * worker, dual currency calculator); axe finds no serious or critical violations.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

const BASE = '/module/08-structured-products';
const SECTIONS = ['1', '2', '3', '4'] as const;
const LANGS = [
  { prefix: '', lang: 'de' },
  { prefix: '/en', lang: 'en' },
] as const;

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

/** Scrolls through the page so every client:visible island hydrates. */
async function hydrateAll(page: Page) {
  const h = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < h; y += 500) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await page.waitForTimeout(40);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
}

/** Scrolls to the n-th island matching `selector` and waits until it has hydrated. */
async function hydrated(page: Page, selector: string, nth = 0): Promise<Locator> {
  const el = page.locator(selector).nth(nth);
  await el.waitFor();
  const y = await el.evaluate((n) => n.getBoundingClientRect().top + window.scrollY - 80);
  await page.evaluate((yy) => window.scrollTo(0, yy), y);
  await page.locator(`astro-island:not([ssr]) ${selector}`).nth(nth).waitFor();
  return el;
}

/** Sets a labelled range input (the accessible twin of a chart handle). */
async function setRange(scope: Locator, label: string, value: number | string) {
  await scope.getByRole('slider', { name: label, exact: true }).fill(String(value));
}

test.describe('module 08 · structured products', () => {
  for (const { prefix, lang } of LANGS) {
    for (const s of SECTIONS) {
      test(`section ${s} renders (${lang})`, async ({ page }) => {
        await page.goto(`${prefix}${BASE}/${s}/`);
        await expect(page.locator('[data-section-content]')).toBeVisible();
        await expect(page.locator('[data-section-content] .takeaway')).toHaveCount(1);
        await expect(page.locator('[data-section-content] details.derivation')).toHaveCount(1);
        await expect(page.locator('[data-section-content] .figure')).not.toHaveCount(0);
        await expect(page.locator('html')).toHaveAttribute('lang', lang);
        await hydrateAll(page);
        await expectNoHorizontalScroll(page);
      });
    }

    test(`quiz page renders (${lang})`, async ({ page }) => {
      await page.goto(`${prefix}${BASE}/quiz/`);
      await expect(page.locator('[data-quiz="quiz"]')).toBeVisible();
      await expect(page.locator('[data-quiz="quiz"] [data-option]')).toHaveCount(4);
      await expectNoHorizontalScroll(page);
    });
  }

  test('building blocks: steps move the strike, the fixing moves the readout', async ({ page }) => {
    await page.goto(`${BASE}/1/`);
    const sb = await hydrated(page, '[data-sb]');
    await sb.locator('[data-step-btn="1"]').click();
    await expect(sb).toHaveAttribute('data-step', '1');
    const readout = sb.locator('[data-readout]');
    const first = (await readout.textContent()) ?? '';
    await sb.locator('[data-step-btn="3"]').click();
    await expect(sb).toHaveAttribute('data-step', '3');
    await expect(sb.locator('[data-step-text]')).toContainText('Knock-out');
    await expect(readout).not.toHaveText(first);
    const atStep3 = (await readout.textContent()) ?? '';
    await setRange(sb, 'Fixing', 0.83);
    await expect(readout).not.toHaveText(atStep3);
    await expect(readout).toContainText('Knock-out');

    // TARF: the target caps the gain of one fixing (500 pips on USD 100’000 = CHF 5’000)
    await sb.locator('.sb-chip', { hasText: 'TARF' }).click();
    await sb.locator('[data-step-btn="3"]').click();
    await expect(sb).toHaveAttribute('data-step', '3');
    await setRange(sb, 'Fixing', 0.86);
    await expect(readout).toContainText('TARF CHF +5’000');
  });

  test('path simulator: scenarios, scrub, play and the drag twins change the outcome', async ({
    page,
  }) => {
    await page.goto(`${BASE}/2/`);
    const ps = await hydrated(page, '[data-ps]');
    await expect(ps).toHaveAttribute('data-product', 'accumulator');
    await expect(ps).toHaveAttribute('data-reason', 'knockout');

    // scrub to the end: the knock-out is announced and the table holds every fixing
    await ps.locator('[data-play]').click();
    await setRange(ps, 'Zeit', 182);
    await expect(ps).toHaveAttribute('data-day', '182');
    await expect(ps.locator('[data-banner]')).toHaveAttribute('data-banner', 'ko');
    await expect(ps.locator('[data-cashflows] tbody tr')).toHaveCount(26);

    // calm market: no knock-out
    await ps.locator('[data-scenario-chip="sideways"]').click();
    await expect(ps).toHaveAttribute('data-scenario', 'sideways');
    await expect(ps).toHaveAttribute('data-reason', 'maturity');

    // drag twin of the path end: a deep fall brings double amounts
    await setRange(ps, 'Kursbewegung bis Laufzeitende', -0.15);
    await expect(ps).toHaveAttribute('data-reason', 'maturity');
    await expect(ps.locator('[data-cashflows] tr.is-lev')).not.toHaveCount(0);

    // playback advances the day
    await ps.locator('[data-restart]').click();
    await expect(ps).toHaveAttribute('data-playing', 'true');
    await expect
      .poll(async () => Number(await ps.getAttribute('data-day')), { timeout: 6000 })
      .toBeGreaterThan(10);
    await ps.locator('[data-play]').click();
    await expect(ps).toHaveAttribute('data-playing', 'false');

    // decumulator chip switches the product
    await ps.locator('[data-product-chip="decumulator"]').click();
    await expect(ps).toHaveAttribute('data-product', 'decumulator');
  });

  test('path simulator: strike slider prices the product in the web worker', async ({ page }) => {
    await page.goto(`${BASE}/2/`);
    const ps = await hydrated(page, '[data-ps]');
    const pv = ps.locator('[data-pv]');
    await expect(pv).toHaveAttribute('data-pv', 'idle');
    await setRange(ps, 'Strike K', 0.79);
    await expect(pv).toHaveAttribute('data-pv', 'done', { timeout: 20_000 });
    await expect(pv.locator('.ps-pv-value')).toContainText('−');
    await ps.locator('[data-param-reset]').click();
    await expect(pv).toHaveAttribute('data-pv', 'idle');
  });

  test('path simulator: early shock, then 100 paths show the asymmetry (en)', async ({ page }) => {
    await page.goto(`/en${BASE}/3/`);
    const ps = await hydrated(page, '[data-ps]');
    await expect(ps).toHaveAttribute('data-product', 'tarf');
    await expect(ps).toHaveAttribute('data-scenario', 'shock');
    await expect(ps).toHaveAttribute('data-reason', 'maturity');
    await setRange(ps, 'Shock: day', 200);
    await expect(ps).toHaveAttribute('data-reason', 'target');

    await ps.getByRole('button', { name: '100 paths' }).click();
    await expect(ps).toHaveAttribute('data-view', 'ensemble');
    await setRange(ps, 'Time', 365);
    await expect(ps.locator('[data-banner]')).toHaveAttribute('data-banner', 'ensemble-done');
    await expect(ps.locator('.ps-bar.is-shown')).toHaveCount(100);
  });

  test('dual currency calculator: conversion below the strike, yield from the distance', async ({
    page,
  }) => {
    await page.goto(`${BASE}/4/`);
    const dci = await hydrated(page, '[data-dci]');
    await expect(dci).toHaveAttribute('data-converted', 'true');
    await setRange(dci, 'Kurs bei Verfall', 0.82);
    await expect(dci).toHaveAttribute('data-converted', 'false');
    await expect(dci.locator('[data-outcome]')).toHaveAttribute('data-outcome', 'good');
    const y1 = Number(await dci.getAttribute('data-yield'));
    await setRange(dci, 'Strike unter Spot', 0.025);
    await expect.poll(async () => Number(await dci.getAttribute('data-yield'))).toBeLessThan(y1);
    await dci.getByRole('button', { name: '3 Monate' }).click();
    await expect.poll(async () => Number(await dci.getAttribute('data-yield'))).not.toBe(y1);
  });

  for (const { prefix, lang } of LANGS) {
    for (const s of SECTIONS) {
      test(`section ${s} has no serious axe violations (${lang})`, async ({ page }) => {
        await page.goto(`${prefix}${BASE}/${s}/`);
        await hydrateAll(page);
        // @axe-core/playwright ships its own playwright-core types; the page object is the same at runtime
        const axePage = page as unknown as ConstructorParameters<typeof AxeBuilder>[0]['page'];
        const results = await new AxeBuilder({ page: axePage }).analyze();
        const bad = results.violations.filter(
          (v) => v.impact === 'serious' || v.impact === 'critical',
        );
        expect(bad.map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
      });
    }
  }
});
