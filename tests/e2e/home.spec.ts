import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

test.describe('home page', () => {
  test('wow chart autoplays: the pressed step changes over time', async ({ page }) => {
    await page.goto('/');
    const steps = page.locator('[data-wow] [data-step]');
    await expect(steps).toHaveCount(4);
    await expect(steps.nth(0)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-wow]')).toHaveAttribute('data-playing', 'true');
    // phase 1 lasts 5.2 s, then the chart morphs to the call
    await expect(steps.nth(1)).toHaveAttribute('aria-pressed', 'true', { timeout: 9000 });
    await expect(steps.nth(0)).toHaveAttribute('aria-pressed', 'false');
  });

  test('wow chart can be controlled: step 3 shows the slider and stops autoplay', async ({
    page,
  }) => {
    await page.goto('/');
    const wow = page.locator('[data-wow]');
    await page.locator('[data-step="3"]').click();
    await expect(page.locator('[data-step="3"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(wow).toHaveAttribute('data-playing', 'false');
    await expect(page.locator('[data-play]')).toHaveAttribute('aria-pressed', 'false');

    const slider = page.locator('#wow-days');
    await expect(slider).toBeVisible();
    const marker = wow.locator('[data-tv]');
    await expect(marker).toBeVisible();
    await expect(marker).toContainText(/\d/);
    const before = (await marker.textContent()) ?? '';
    const valueBefore = (await slider.inputValue()) ?? '';

    await slider.focus();
    await page.keyboard.press('End');
    await expect(slider).not.toHaveValue(valueBefore);
    await expect(marker).not.toHaveText(before);
    await expect(wow.locator('.field-value')).toHaveText(/Jahr|year/);

    await page.keyboard.press('Home');
    await expect(wow.locator('.field-value')).toHaveText(/Verfall|Expiry/);

    // still phase 3 after the slider interaction, the chart did not advance on its own
    await expect(page.locator('[data-step="3"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(wow).toHaveAttribute('data-playing', 'false');
  });

  test('play/pause button toggles autoplay', async ({ page }) => {
    await page.goto('/');
    const play = page.locator('[data-play]');
    await expect(play).toHaveAttribute('aria-pressed', 'true');
    await play.click();
    await expect(play).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('[data-wow]')).toHaveAttribute('data-playing', 'false');
    await play.click();
    await expect(page.locator('[data-wow]')).toHaveAttribute('data-playing', 'true');
  });

  test('learning path shows nine stations that link to modules', async ({ page }) => {
    await page.goto('/');
    const stations = page.locator('#lernpfad [data-station]');
    await expect(stations).toHaveCount(9);
    await expect(stations.first()).toHaveAttribute('href', /\/module\/01-spot\/1\/$/);
    await expect(stations.last()).toHaveAttribute('href', /\/module\/09-hedge-alpha-yield\/1\/$/);
    await expect(page.locator('#lernpfad')).toContainText(/0 von 9|0 of 9/);
    for (const s of await stations.all()) {
      const box = await s.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
  });

  test('progress from localStorage updates path, hero and resume card', async ({ page }) => {
    await page.addInitScript(() => {
      const p = {
        v: 1,
        sections: {
          '01-spot/1': true,
          '01-spot/2': true,
          '01-spot/3': true,
          '01-spot/4': true,
          '02-forward/1': true,
        },
        quiz: { '01-spot': { best: 4, total: 4, passed: true } },
        last: { slug: '02-forward', section: '1' },
      };
      localStorage.setItem('ff-progress-v1', JSON.stringify(p));
    });
    await page.goto('/');
    await expect(page.locator('[data-station="01-spot"]')).toHaveAttribute('data-state', 'done');
    await expect(page.locator('[data-station="02-forward"]')).toHaveAttribute(
      'data-state',
      'current',
    );
    await expect(page.locator('[data-station="02-forward"]')).toHaveAttribute(
      'href',
      /\/module\/02-forward\/2\/$/,
    );
    await expect(page.locator('[data-station="02-forward"] [data-chip]')).toBeVisible();
    await expect(page.locator('[data-cta]')).toContainText('02 Forward');
    await expect(page.locator('[data-resume-title]')).toContainText('Forward');
    await expect(page.locator('[data-pill="2"]')).toHaveAttribute('data-state', 'current');
    await expect(page.locator('#lernpfad')).toContainText('1 von 9');
  });

  test('language switch goes to /en/ and back', async ({ page }) => {
    await page.goto('/');
    await page.locator('a[data-lang-switch="en"]').click();
    await expect(page).toHaveURL(/\/en\/$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('h1')).toContainText('Everything starts with the forward.');
    await expect(page.locator('[data-wow] [data-step="3"]')).toContainText('Time value');
    await page.locator('a[data-lang-switch="de"]').click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  });

  test('riskometer card links to the riskometer with a labelled level', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('[data-risk]');
    await expect(card).toHaveAttribute('href', /\/riskometer\/$/);
    await expect(page.getByRole('link', { name: /Riskometer (heute|today)/ })).toBeVisible();
    await expect(card.locator('.level')).not.toHaveText('');
  });

  for (const path of ['/', '/en/']) {
    test(`no horizontal scroll and no serious axe violations on ${path}`, async ({ page }) => {
      await page.goto(path);
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

test.describe('reduced motion', () => {
  test('wow chart does not autoplay', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const wow = page.locator('[data-wow]');
    await expect(wow).toHaveAttribute('data-playing', 'false');
    await expect(page.locator('[data-play]')).toHaveAttribute('aria-pressed', 'false');
    await page.waitForTimeout(1500);
    await expect(page.locator('[data-step="1"]')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('[data-step="4"]').click();
    await expect(page.locator('[data-step="4"]')).toHaveAttribute('aria-pressed', 'true');
  });
});
