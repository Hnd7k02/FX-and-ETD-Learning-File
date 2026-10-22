import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { GLOSSARY } from '@/content/glossary';
import { getModule } from '@/data/modules';
import { modulePath } from '@/i18n/routes';

const TOTAL = GLOSSARY.length;

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

async function expectNoSeriousAxeViolations(page: Page) {
  // @axe-core/playwright ships its own playwright-core types; the runtime object is the same.
  const results = await new AxeBuilder({
    page: page as unknown as ConstructorParameters<typeof AxeBuilder>[0]['page'],
  }).analyze();
  const serious = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );
  expect(
    serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
  ).toEqual([]);
}

const visibleItems = (page: Page) => page.locator('[data-gl-item]:visible');

test.describe('glossary', () => {
  test('renders every term server-side, sorted A–Z with letter anchors', async ({ page }) => {
    await page.goto('/glossar/');
    await expect(page.getByRole('heading', { level: 1, name: 'Glossar' })).toBeVisible();
    await expect(page.locator('[data-gl-item]')).toHaveCount(TOTAL);
    await expect(page.locator('dl.gl-list dt').first()).toBeVisible();
    await expect(page.locator('#letter-a')).toBeAttached();
    await page.locator('a[data-gl-letter="F"]').click();
    await expect(page).toHaveURL(/#letter-f$/);
  });

  test('search filters the list, shows a count and an empty state', async ({ page }) => {
    await page.goto('/glossar/');
    const search = page.getByRole('searchbox', { name: 'Begriff suchen' });
    const status = page.locator('.gls-count[role="status"]');
    await expect(status).toContainText(String(TOTAL));

    await search.fill('knock');
    await expect(status).toContainText(`von ${TOTAL}`);
    const n = await visibleItems(page).count();
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThan(TOTAL);
    await expect(page.locator('#term-knock-out')).toBeVisible();
    await expect(page.locator('#term-forward')).toBeHidden();
    await expect(page).toHaveURL(/\?q=knock/);

    // German term found via the English alias, English term via the German one
    await search.fill('terminpunkte');
    await expect(page.locator('#term-forward-points')).toBeVisible();

    await search.fill('zzzz-kein-begriff');
    await expect(visibleItems(page)).toHaveCount(0);
    await expect(page.getByText('Kein Begriff passt zu')).toBeVisible();
    await page.getByRole('button', { name: 'Suche zurücksetzen' }).click();
    await expect(visibleItems(page)).toHaveCount(TOTAL);
    await expect(search).toHaveValue('');
  });

  test('family filter shows only terms of that family', async ({ page }) => {
    await page.goto('/glossar/');
    const filters = page.getByRole('group', { name: 'Nach Modulfamilie filtern' });
    await filters.getByRole('button', { name: /Exotics/ }).click();
    await expect(filters.getByRole('button', { name: /Exotics/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    const families = await visibleItems(page).evaluateAll((els) =>
      els.map((e) => (e as HTMLElement).dataset.family),
    );
    expect(families.length).toBe(
      GLOSSARY.filter((e) => getModule(e.module).family === 'exotics').length,
    );
    expect(new Set(families)).toEqual(new Set(['exotics']));
  });

  test('a "see also" link to a filtered-out term clears the filter and jumps there', async ({
    page,
  }) => {
    await page.goto('/glossar/?q=rebate');
    const item = page.locator('#term-rebate');
    await expect(item).toBeVisible();
    await expect(page.locator('#term-knock-out')).toBeHidden();
    await item.getByRole('link', { name: 'Knock-out' }).click();
    await expect(page.locator('#term-knock-out')).toBeVisible();
    await expect(page).toHaveURL(/#term-knock-out$/);
    await expect(visibleItems(page)).toHaveCount(TOTAL);
  });

  test('module chip links to the module section where the term is taught', async ({ page }) => {
    await page.goto('/glossar/');
    const entry = GLOSSARY.find((e) => e.id === 'forward-points')!;
    const expected = modulePath('de', entry.module, entry.section ?? '1');
    const chip = page.locator('#term-forward-points a.gl-chip');
    await expect(chip).toHaveAttribute('href', expected);
    await expect(chip).toHaveAttribute('data-family', getModule(entry.module).family);
    await expect(chip).toContainText(getModule(entry.module).n);
    await chip.click();
    await page.waitForURL(`**${expected}`);
  });

  test('English glossary renders with English terms', async ({ page }) => {
    await page.goto('/en/glossary/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('heading', { level: 1, name: 'Glossary' })).toBeVisible();
    await expect(page.locator('#term-exchange-rate .gl-term-name')).toHaveText('Exchange rate');
    await expect(page.locator('#term-forward-points a.gl-chip')).toHaveAttribute(
      'href',
      /^\/en\/module\//,
    );
    await page.getByRole('searchbox', { name: 'Search terms' }).fill('wechselkurs');
    await expect(page.locator('#term-exchange-rate')).toBeVisible();
  });
});

test.describe('about & methodology', () => {
  test('shows the disclaimer, models, sources and credits', async ({ page }) => {
    await page.goto('/ueber/');
    await expect(page.getByRole('heading', { level: 1, name: 'Über Forward First' })).toBeVisible();
    await expect(page.locator('.ab-disclaimer')).toContainText(
      'Nur zu Bildungszwecken. Keine Anlageberatung.',
    );
    await expect(page.getByText('Beispielwerte, keine Marktdaten')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Garman-Kohlhagen' })).toBeVisible();
    await expect(page.locator('.ab-source').first()).toBeVisible();
    await expect(page.locator('.ab-source a[href^="https://"]').first()).toBeVisible();
    await expect(page.locator('main')).toContainText('Konzept und Produktentscheide: Dario Moffa');
  });

  test('reset progress needs a confirmation and clears localStorage', async ({ page }) => {
    await page.goto('/ueber/');
    await page.evaluate(() =>
      localStorage.setItem(
        'ff-progress-v1',
        JSON.stringify({ v: 1, sections: { '01-spot/1': true, '01-spot/2': true }, quiz: {} }),
      ),
    );
    await page.reload();
    const reset = page.getByRole('button', { name: 'Fortschritt zurücksetzen' });
    await reset.scrollIntoViewIfNeeded();
    await expect(page.getByText(/Gespeicherter Fortschritt/)).toBeVisible();

    // first click only asks
    await reset.click();
    await expect(page.getByText('Wirklich zurücksetzen?')).toBeVisible();
    await page.getByRole('button', { name: 'Abbrechen' }).click();
    expect(await page.evaluate(() => localStorage.getItem('ff-progress-v1'))).not.toBeNull();
    await expect(page.getByRole('status').filter({ hasText: 'Nichts geändert.' })).toBeVisible();

    // confirm deletes
    await reset.click();
    await page.getByRole('button', { name: 'Ja, zurücksetzen' }).click();
    expect(await page.evaluate(() => localStorage.getItem('ff-progress-v1'))).toBeNull();
    await expect(
      page.getByRole('status').filter({ hasText: 'Fortschritt zurückgesetzt.' }),
    ).toBeVisible();
    await expect(page.getByText('Noch kein Fortschritt gespeichert.')).toBeVisible();
  });

  test('English about page renders', async ({ page }) => {
    await page.goto('/en/about/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(
      page.getByRole('heading', { level: 1, name: 'About Forward First' }),
    ).toBeVisible();
    await expect(page.locator('.ab-disclaimer')).toContainText(
      'For educational purposes only. Not investment advice.',
    );
    await expect(page.getByRole('button', { name: 'Reset progress' })).toBeVisible();
  });
});

for (const path of ['/glossar/', '/en/glossary/', '/ueber/', '/en/about/']) {
  test(`no horizontal scroll and no serious axe violations on ${path}`, async ({ page }) => {
    await page.goto(path);
    await expectNoHorizontalScroll(page);
    await expectNoSeriousAxeViolations(page);
  });
}
