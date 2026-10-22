/**
 * Module 05 Greeks: every section renders in DE and EN without horizontal scroll, every island
 * reacts to input (sliders, segmented controls, a drag on the chart), and axe finds no serious
 * or critical violations.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

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

/** Waits until the island containing `selector` has hydrated (Astro drops the ssr attribute). */
async function hydrated(page: Page, selector: string) {
  const el = page.locator(selector).first();
  await el.waitFor();
  // hydration may swap the node while we scroll; scroll by position instead of by element
  const y = await el.evaluate((n) => n.getBoundingClientRect().top + window.scrollY - 80);
  await page.evaluate((yy) => window.scrollTo(0, yy), y);
  await page.locator(`astro-island:not([ssr]) ${selector}`).first().waitFor();
  return el;
}

test.describe('module 05 · Greeks', () => {
  for (const { prefix, lang } of LANGS) {
    for (const s of SECTIONS) {
      test(`section ${s} renders (${lang})`, async ({ page }) => {
        await page.goto(`${prefix}/module/05-greeks/${s}/`);
        await expect(page.locator('[data-section-content]')).toBeVisible();
        await expect(page.locator('[data-section-content] .takeaway')).toHaveCount(1);
        await expect(page.locator('[data-section-content] details.derivation')).not.toHaveCount(0);
        await expect(page.locator('html')).toHaveAttribute('lang', lang);
        await hydrateAll(page);
        await expectNoHorizontalScroll(page);
      });
    }

    test(`quiz page renders (${lang})`, async ({ page }) => {
      await page.goto(`${prefix}/module/05-greeks/quiz/`);
      await expect(page.locator('[data-quiz="quiz"]')).toBeVisible();
      await expect(page.locator('[data-quiz="quiz"] [data-option]')).toHaveCount(3);
      await expectNoHorizontalScroll(page);
    });
  }

  test('five levers: flipping a lever flips its bar', async ({ page }) => {
    await page.goto('/module/05-greeks/1/');
    const levers = await hydrated(page, '[data-levers]');
    const rf = levers.locator('[data-lever="rf"]');
    await expect(rf).toHaveAttribute('data-sign', 'down');
    const before = (await rf.locator('[data-value]').textContent()) ?? '';
    await rf.getByRole('button', { name: /−1/ }).click();
    await expect(rf).toHaveAttribute('data-sign', 'up');
    await expect(rf.locator('[data-value]')).not.toHaveText(before);
    const time = levers.locator('[data-lever="time"]');
    const monthValue = (await time.locator('[data-value]').textContent()) ?? '';
    await time.getByRole('button', { name: /Tag/ }).click();
    await expect(time.locator('[data-value]')).not.toHaveText(monthValue);
  });

  test('greeks lab (delta-gamma): spot slider and drag move delta and gamma', async ({
    page,
  }) => {
    await page.goto('/module/05-greeks/2/');
    const lab = await hydrated(page, '[data-greekslab][data-mode="delta-gamma"]');
    const summary = lab.locator('[data-summary]');
    const start = (await summary.textContent()) ?? '';
    await expect(lab.locator('[data-aha]')).toHaveAttribute('data-aha', 'gammaPeak');

    const spot = lab.locator('#gl-delta-gamma-spot');
    await spot.focus();
    await page.keyboard.press('End');
    await expect(spot).toHaveValue('0.84');
    await expect(summary).not.toHaveText(start);
    await expect(lab.locator('[data-money]')).toHaveAttribute('data-money', 'ITM');
    await expect(lab.locator('[data-aha]')).toHaveAttribute('data-aha', 'deltaHigh');

    // drag the dot on the delta chart back to the left
    await lab.locator('[data-reset]').click();
    await expect(spot).toHaveValue('0.8');
    const svg = lab.locator('svg[data-panel="bottom"]');
    const box = (await svg.boundingBox())!;
    const y = box.y + box.height * 0.5;
    await page.mouse.move(box.x + box.width * 0.5, y);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) await page.mouse.move(box.x + box.width * (0.5 - 0.04 * i), y);
    await page.mouse.up();
    expect(Number(await spot.inputValue())).toBeLessThan(0.79);
  });

  test('greeks lab (vega): maturity slider grows vega and shows the example curve', async ({
    page,
  }) => {
    await page.goto('/module/05-greeks/3/');
    const lab = await hydrated(page, '[data-greekslab][data-mode="vega"]');
    const summary = lab.locator('[data-summary]');
    const start = (await summary.textContent()) ?? '';
    await lab.locator('#gl-vega-weeks').fill('52');
    await expect(summary).not.toHaveText(start);
    await expect(lab.locator('svg[data-panel="bottom"] .gl-ghost')).toHaveCount(1);
  });

  test('greeks lab (theta, rho): annotations appear at the interesting settings', async ({
    page,
  }) => {
    await page.goto('/module/05-greeks/4/');
    const theta = await hydrated(page, '[data-greekslab][data-mode="theta"]');
    const weeks = theta.locator('#gl-theta-weeks');
    await weeks.focus();
    await page.keyboard.press('Home');
    await page.keyboard.press('ArrowRight');
    await expect(weeks).toHaveValue('2');
    await expect(theta.locator('[data-aha]')).toHaveAttribute('data-aha', 'thetaAccel');

    const rho = await hydrated(page, '[data-greekslab][data-mode="rho"]');
    await rho.locator('#gl-rho-rd').fill('3.5');
    await expect(rho.locator('[data-aha]')).toHaveAttribute('data-aha', 'equalRates');
    await expect(rho.locator('[data-money]')).toHaveAttribute('data-money', 'ITM');
  });

  test('gamma against theta: a large move turns the day profitable', async ({ page }) => {
    await page.goto('/module/05-greeks/4/');
    const gt = await hydrated(page, '[data-gammatheta]');
    await expect(gt).toHaveAttribute('data-zone', 'flat');
    const move = gt.locator('#gt-move');
    await move.focus();
    await page.keyboard.press('End');
    await expect(gt).toHaveAttribute('data-zone', 'gain');
    await move.fill('20');
    await expect(gt).toHaveAttribute('data-zone', 'loss');
  });

  for (const { prefix, lang } of LANGS) {
    for (const s of SECTIONS) {
      test(`section ${s} has no serious axe violations (${lang})`, async ({ page }) => {
        await page.goto(`${prefix}/module/05-greeks/${s}/`);
        await hydrateAll(page);
        const results = await new AxeBuilder({ page }).analyze();
        const bad = results.violations.filter(
          (v) => v.impact === 'serious' || v.impact === 'critical',
        );
        expect(bad.map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
      });
    }
  }
});
