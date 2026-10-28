import { expect, test } from '@playwright/test';

test('home page loads with title, nav and disclaimer', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Forward First/);
  await expect(page.getByRole('navigation', { name: 'Hauptnavigation' })).toBeVisible();
  await expect(page.locator('footer')).toContainText(
    'Nur zu Bildungszwecken. Keine Anlageberatung.',
  );
});

test('english home page', async ({ page }) => {
  await page.goto('/en/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('footer')).toContainText(
    'For educational purposes only. Not investment advice.',
  );
});

test('no horizontal scroll', async ({ page }) => {
  await page.goto('/');
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
