/**
 * Module 09 hedge, alpha, yield: every section and the quiz render in DE and EN without
 * horizontal scroll; every island reacts to input (product matrix: need, view, alpha grid,
 * highlight, rate slider, playback and matrix table; hedge comparison: toggles, rate slider,
 * ranking, landmarks, playback; carry cushion: steps, sliders, twin chip, tenor playback);
 * axe finds no serious or critical violations.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

const BASE = '/module/09-hedge-alpha-yield';
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

test.describe('module 09 · hedge, alpha, yield', () => {
  for (const { prefix, lang } of LANGS) {
    for (const s of SECTIONS) {
      test(`section ${s} renders (${lang})`, async ({ page }) => {
        await page.goto(`${prefix}${BASE}/${s}/`);
        await expect(page.locator('[data-section-content]')).toBeVisible();
        await expect(page.locator('[data-section-content] .takeaway')).toHaveCount(1);
        await expect(page.locator('[data-section-content] details.derivation')).toHaveCount(1);
        await expect(page.locator('[data-section-content] .figure')).not.toHaveCount(0);
        await expect(page.locator('html')).toHaveAttribute('lang', lang);
        await expect(page.locator('[data-quiz="check"]')).toHaveCount(1);
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

  test('product matrix: need, view, highlight and rate change the picture', async ({ page }) => {
    await page.goto(`${BASE}/1/`);
    const pm = await hydrated(page, '[data-pm]');
    await expect(pm).toHaveAttribute('data-need', 'hedge');
    await expect(pm).toHaveAttribute('data-view', 'up');
    await expect(pm.locator('[data-card]')).toHaveCount(4);
    await expect(pm.locator('[data-aha]')).toBeVisible();

    // a different view brings different products
    await pm.locator('[data-view-btn="sideways"]').click();
    await expect(pm).toHaveAttribute('data-view', 'sideways');
    await expect(pm.locator('[data-card="structured"]')).toBeVisible();
    await expect(pm.locator('[data-card="structured"] [data-chip="leverage"]')).toContainText('2×');

    // highlight another curve from its card
    await pm.locator('[data-show="structured"]').click();
    await expect(pm).toHaveAttribute('data-hl', 'structured');
    await expect(pm.locator('[data-show="structured"]')).toHaveAttribute('aria-pressed', 'true');

    // the rate slider (accessible twin of the handle) moves the readout
    const row = pm.locator('[data-row="structured"] [data-value]');
    const before = (await row.textContent()) ?? '';
    await pm.getByRole('slider').fill('0.76');
    await expect(pm).toHaveAttribute('data-st', '0.7600');
    await expect(row).not.toHaveText(before);

    // alpha: the 2 × 2 grid
    await pm.locator('[data-need-btn="alpha"]').click();
    await expect(pm).toHaveAttribute('data-need', 'alpha');
    await expect(pm).toHaveAttribute('data-view', 'coupon-direct');
    // the TPF's leveraged loss runs off the chart: marked "not limited"
    await expect(pm.locator('[data-clip]')).not.toHaveCount(0);
    await pm.locator('[data-view-btn="strike-range"]').click();
    await expect(pm).toHaveAttribute('data-view', 'strike-range');
    await expect(pm.locator('[data-card="pivotTarf"]')).toBeVisible();

    // yield: the twins share one curve
    await pm.locator('[data-need-btn="yield"]').click();
    await pm.locator('[data-view-btn="sideways"]').click();
    await expect(pm.locator('[data-aha]')).toBeVisible();
    await expect(pm.locator('[data-card]')).toHaveCount(3);

    // the matrix table jumps to a cell
    await pm.locator('.pm-table summary').click();
    await pm.locator('.pm-table tbody tr').first().locator('button').click();
    await expect(pm).toHaveAttribute('data-need', 'hedge');
    await expect(pm).toHaveAttribute('data-view', 'up');
  });

  test('product matrix: the handle drags and playback moves the rate', async ({ page }) => {
    await page.goto(`${BASE}/3/`);
    const pm = await hydrated(page, '[data-pm]');
    await expect(pm).toHaveAttribute('data-need', 'alpha');
    const handle = pm.locator('[data-handle] rect').first();
    await handle.scrollIntoViewIfNeeded();
    const box = await handle.boundingBox();
    expect(box).not.toBeNull();
    const svg = await pm.locator('svg.pm-svg').boundingBox();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.mouse.move(svg!.x + svg!.width * 0.2, box!.y + box!.height / 2, { steps: 5 });
    await page.mouse.up();
    const dragged = Number(await pm.getAttribute('data-st'));
    expect(dragged).toBeLessThan(0.8);
    await pm.locator('[data-play]').click();
    await expect(pm.locator('[data-play]')).toHaveAttribute('aria-pressed', 'true');
    await expect
      .poll(async () => Number(await pm.getAttribute('data-st')), { timeout: 5000 })
      .not.toBe(dragged);
  });

  test('hedge comparison: toggles, ranking, landmarks and playback', async ({ page }) => {
    await page.goto(`${BASE}/2/`);
    const hc = await hydrated(page, '[data-hc]');
    await expect(hc.locator('[data-line]')).toHaveCount(5);
    await expect(hc).toHaveAttribute('data-best', 'leveraged');

    // a weak dollar: staying unhedged is cheapest in hindsight, the structured hedge last
    await hc.getByRole('slider').fill('0.76');
    await expect(hc).toHaveAttribute('data-best', 'unhedged');
    await expect(hc.locator('[data-row="leveraged"]')).toHaveAttribute('data-pos', '5');
    await expect(hc.locator('[data-note], .hc-note-text')).not.toHaveCount(0);

    // hide a strategy
    await hc.locator('[data-toggle="unhedged"]').click();
    await expect(hc.locator('[data-line]')).toHaveCount(4);
    await expect(hc.locator('[data-toggle="unhedged"]')).toHaveAttribute('aria-pressed', 'false');
    await expect(hc).not.toHaveAttribute('data-best', 'unhedged');

    // playback moves the rate
    const st = await hc.getAttribute('data-st');
    await hc.locator('[data-play]').click();
    await expect.poll(async () => hc.getAttribute('data-st'), { timeout: 5000 }).not.toBe(st);
  });

  test('carry cushion: steps, twin, sliders and tenor playback', async ({ page }) => {
    await page.goto(`${BASE}/4/`);
    const cc = await hydrated(page, '[data-cc]');
    await expect(cc).toHaveAttribute('data-step', 'carry');
    const beCarry = Number(await cc.getAttribute('data-be'));

    await cc.locator('[data-step-btn="discount"]').click();
    await expect(cc).toHaveAttribute('data-step', 'discount');
    const beDisc = Number(await cc.getAttribute('data-be'));
    expect(beDisc).toBeLessThan(beCarry);

    await cc.locator('[data-step-btn="dci"]').click();
    await expect(cc.locator('[data-twin]')).toBeVisible();
    expect(Number(await cc.getAttribute('data-be'))).toBeCloseTo(beDisc, 6);

    // a longer tenor widens the cushion: the break-even falls
    await cc.getByRole('slider', { name: /Laufzeit/ }).fill('12');
    await expect(cc).toHaveAttribute('data-months', '12');
    expect(Number(await cc.getAttribute('data-be'))).toBeLessThan(beDisc);

    // the rate at expiry moves the result
    const hero = cc.locator('.ff-stat-hero-main');
    const before = (await hero.textContent()) ?? '';
    await cc.getByRole('slider', { name: /USD\/CHF/ }).fill('0.75');
    await expect(cc).toHaveAttribute('data-st', '0.7500');
    await expect(hero).not.toHaveText(before);

    // tenor playback runs from 1 month upwards
    await cc.locator('[data-play]').click();
    await expect
      .poll(async () => Number(await cc.getAttribute('data-months')), { timeout: 5000 })
      .toBeGreaterThan(1);
  });

  for (const { prefix, lang } of LANGS) {
    for (const s of [...SECTIONS, 'quiz']) {
      test(`axe: no serious or critical violations (${lang} ${s})`, async ({ page }) => {
        await page.goto(`${prefix}${BASE}/${s}/`);
        await hydrateAll(page);
        await page.waitForTimeout(400);
        const r = await new AxeBuilder({ page }).analyze();
        const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
        expect(
          bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
        ).toEqual([]);
      });
    }
  }
});
