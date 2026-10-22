import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

/** The event control that is visible in the current layout (overlay button or chip row). */
function eventButton(page: Page, id: string) {
  return page.locator(`[data-event="${id}"]:visible, [data-event-chip="${id}"]:visible`).first();
}

test.describe('riskometer page', () => {
  test('loads with gauge, value, level and chart for EUR/CHF', async ({ page }) => {
    await page.goto('/riskometer/');
    const root = page.locator('[data-rk]');
    await expect(root).toHaveAttribute('data-pair', 'EUR/CHF');
    await expect(page.locator('h1')).toHaveText('Wie nervös ist der Franken?');
    await expect(page.locator('[data-vol]')).toHaveText(/\d+\.\d %/);
    await expect(page.locator('.rk-level')).toHaveText(/Ruhig|Normal|Erhöht|Hoch|Extrem/);
    await expect(page.locator('.rk-gauge')).toHaveAttribute('aria-label', /Tacho: Stufe/);
    await expect(page.locator('.rk-svg')).toHaveAttribute('aria-label', /EUR\/CHF/);
    await expect(page.locator('#rk-chart-summary')).toContainText(/Höchstwert/);
    await expect(page.locator('.rk-today-tag')).toContainText('Heute');
    await expect(page.locator('footer')).toContainText('Nur zu Bildungszwecken');
    await expect(page.locator('.rk-foot')).toContainText('√252');
  });

  test('pair switch updates value, level, H1, chart and case card', async ({ page }) => {
    await page.goto('/riskometer/');
    const vol = page.locator('[data-vol]');
    const before = await vol.textContent();
    const pathBefore = await page.locator('.rk-line').getAttribute('d');
    await page.locator('[data-pair-btn="USDJPY"]').click();
    await expect(page.locator('[data-rk]')).toHaveAttribute('data-pair', 'USD/JPY');
    await expect(page.locator('[data-pair-btn="USDJPY"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-pair-btn="EURCHF"]')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('h1')).toHaveText('Wie nervös ist der Yen?');
    await expect(vol).not.toHaveText(before ?? '');
    await expect(page.locator('.rk-svg')).toHaveAttribute('aria-label', /USD\/JPY/);
    await expect
      .poll(async () => page.locator('.rk-line').getAttribute('d'), { timeout: 3000 })
      .not.toBe(pathBefore);
    // USD/JPY has two events; the case card shows one of them with the pair's move
    await expect(page.locator('[data-case-title]')).toHaveText(/Finanzkrise|Carry-Unwind/);
    await expect(page.locator('.rk-box-label').first()).toHaveText('USD/JPY');
    await expect(page.locator('[data-case-move]')).toHaveText(/\d{2,3}\.\d{2} → \d{2,3}\.\d{2}/);
    expect(await eventButton(page, 'chf-shock-2015').count()).toBe(0);
    await expect(page).toHaveURL(/\?pair=USDJPY$/);
  });

  test('clicking an event updates the case card and the URL', async ({ page }) => {
    await page.goto('/riskometer/');
    await expect(page.locator('[data-case-title]')).toHaveText('Frankenschock');
    const btn = eventButton(page, 'gfc-2008');
    const box = await btn.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    await btn.click();
    await expect(btn).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-case-title]')).toHaveText('Finanzkrise');
    await expect(page.locator('[data-case-year]')).toHaveText('2008');
    await expect(page.locator('[data-case-peak]')).toHaveText(/\d+\.\d %/);
    await expect(page.locator('.rk-stem')).toHaveCount(1);
    await expect(page.locator('.rk-mod').first()).toHaveAttribute('href', /\/module\/05-greeks\/1\/$/);
    await expect(page).toHaveURL(/\?event=gfc-2008$/);
  });

  test('table toggle shows the yearly maxima of the selected pair', async ({ page }) => {
    await page.goto('/riskometer/');
    const toggle = page.locator('[data-table-toggle]');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('#rk-table')).toBeHidden();
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const table = page.locator('#rk-table');
    await expect(table).toBeVisible();
    await expect(table.locator('caption')).toContainText('EUR/CHF');
    await expect(table.locator('tbody tr')).toHaveCount(21);
    await expect(table.locator('tbody tr').first().locator('td').first()).toHaveText('2006');
    await expect(table.locator('tbody tr').nth(9)).toContainText(/Extrem/);
    await toggle.click();
    await expect(table).toBeHidden();
  });

  test('deep link selects pair and event', async ({ page }) => {
    await page.goto('/en/riskometer/?pair=EURUSD&event=ukraine-2022');
    await expect(page.locator('[data-rk]')).toHaveAttribute('data-pair', 'EUR/USD');
    await expect(page.locator('[data-rk]')).toHaveAttribute('data-event', 'ukraine-2022');
    await expect(page.locator('h1')).toHaveText('How nervous is the euro?');
    await expect(page.locator('[data-case-title]')).toHaveText('War in Ukraine');
    await expect(page.locator('.rk-box-label').first()).toHaveText('EUR/USD');
    await expect(page.locator('[data-vol]')).toHaveText(/\d+\.\d%/);
  });

  test('english page and language switch', async ({ page }) => {
    await page.goto('/en/riskometer/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('h1')).toHaveText('How nervous is the franc?');
    await expect(page.locator('.rk-level')).toHaveText(/Calm|Normal|Elevated|High|Extreme/);
    await page.locator('a[data-lang-switch="de"]').click();
    await expect(page).toHaveURL(/\/riskometer\/$/);
    await expect(page.locator('h1')).toHaveText('Wie nervös ist der Franken?');
  });

  test('reduced motion: needle is at its position without animation', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/riskometer/');
    const needle = page.locator('.rk-needle');
    const style = await needle.getAttribute('style');
    expect(style).toMatch(/--needle:-?\d+(\.\d+)?deg/);
    await page.locator('[data-pair-btn="EURUSD"]').click();
    await expect(page.locator('[data-rk]')).toHaveAttribute('data-pair', 'EUR/USD');
    await expect(needle).not.toHaveAttribute('style', style ?? '');
  });

  for (const path of ['/riskometer/', '/en/riskometer/']) {
    test(`no horizontal scroll and no serious axe violations on ${path}`, async ({ page }) => {
      await page.goto(path);
      await page.locator('[data-table-toggle]').click();
      await expect(page.locator('#rk-table')).toBeVisible();
      await expectNoHorizontalScroll(page);
      const results = await new AxeBuilder({ page }).analyze();
      const serious = results.violations.filter(
        (v) => v.impact === 'serious' || v.impact === 'critical',
      );
      expect(
        serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
      ).toEqual([]);
    });
  }
});
