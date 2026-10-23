/**
 * Module 03 FX Swap: every section renders in DE and EN with its figure, each island reacts to
 * input (SwapTrip, SwapLegs, HedgeRoll, SwapCompare), numbers and facts come from the registries,
 * the quiz page works, axe finds no serious or critical violations and there is no horizontal
 * scroll (390 px project).
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const SLUG = '03-fx-swap';
const path = (lang: 'de' | 'en', section: string) =>
  `${lang === 'en' ? '/en' : ''}/module/${SLUG}/${section}/`;

const FIGURES: Record<string, string> = {
  '1': '[data-trip]',
  '2': '[data-legs-lab]',
  '3': '[data-roll]',
  '4': '[data-compare]',
};

const TITLES = {
  de: [
    'Intuition',
    'Near und Far Leg',
    'Hedge rollen',
    'Abgrenzung: FX Swap und Cross-Currency Swap',
  ],
  en: ['Intuition', 'Near and far leg', 'Rolling a hedge', 'FX swap vs cross-currency swap'],
};

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

async function expectNoSeriousAxeViolations(page: Page) {
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

/** Scrolls the figure into view (client:visible) and waits until its island has hydrated. */
async function hydrate(page: Page, selector: string) {
  const el = page.locator(selector).first();
  await el.scrollIntoViewIfNeeded();
  await page.waitForFunction((sel) => {
    const node = document.querySelector(sel);
    const island = node?.closest('astro-island');
    return !!island && !island.hasAttribute('ssr');
  }, selector);
  return el;
}

for (const lang of ['de', 'en'] as const) {
  for (const n of ['1', '2', '3', '4']) {
    test(`section ${n} renders with its figure (${lang})`, async ({ page }) => {
      await page.goto(path(lang, n));
      await expect(
        page.getByRole('heading', { level: 2, name: TITLES[lang][Number(n) - 1] }),
      ).toBeVisible();
      await expect(page.locator('[data-section-content]')).toBeVisible();
      await expect(page.locator('details.derivation').first()).not.toHaveAttribute('open', '');
      await expect(page.locator('.takeaway')).toBeVisible();
      const fig = await hydrate(page, FIGURES[n]!);
      await expect(fig.locator('svg[role="img"]').first()).toHaveAttribute('aria-label', /\S/);
      await expectNoHorizontalScroll(page);
    });
  }
}

test('numbers come from the core and facts carry a source', async ({ page }) => {
  await page.goto(path('de', '2'));
  await expect(page.locator('[data-num="ex.fwdPointsMM"]').first()).toHaveText('−69.4');
  await expect(page.locator('[data-num="ex.forwardMM"]').first()).toHaveText('0.79306');
  await expect(page.locator('[data-num="m03.approxPoints"]').first()).toHaveText('−70.0');
  await page.goto(path('de', '3'));
  await expect(page.locator('[data-num="m03.rollAllInUp"]').first()).toHaveText('0.79068');
  await expect(page.locator('[data-num="m03.rollAllInDown"]').first()).toHaveText('0.79081');
  await page.goto(path('en', '4'));
  await expect(page.locator('[data-num="m03.fwd1y"]').first()).toHaveText('0.77258');
  await expect(page.locator('[data-fact="m03-bis-swaps"]').first()).toHaveAttribute(
    'data-source',
    'bis-triennial-2025',
  );
});

test('SwapTrip: scrub through the month, the swap result stays fixed', async ({ page }) => {
  await page.goto(path('de', '1'));
  const fig = await hydrate(page, FIGURES['1']!);
  const day = fig.getByRole('slider', { name: 'Tag im Monat' });
  await day.fill('0');
  await expect(fig).toHaveAttribute('data-day', '0');
  await day.fill('30');
  await expect(fig).toHaveAttribute('data-day', '30');
  await expect(fig.locator('.m3-insight.is-aha')).toBeVisible();
  const swapRow = fig.locator('.ff-stat-row.is-highlight .ff-stat-value');
  const swap = await swapRow.textContent();
  const seed = await fig.getAttribute('data-seed');
  await fig.locator('[data-reseed]').click();
  await expect(fig).not.toHaveAttribute('data-seed', seed ?? '');
  await expect(swapRow).toHaveText(swap ?? '');
});

test('SwapLegs: direction, tenor and rates', async ({ page }) => {
  await page.goto(path('en', '2'));
  const fig = await hydrate(page, FIGURES['2']!);
  await expect(fig).toHaveAttribute('data-points', '-69.39');
  await fig.getByRole('button', { name: 'Sell/buy USD', exact: true }).click();
  await expect(fig).toHaveAttribute('data-side', 'sellBuyBase');
  await expect(fig).toHaveAttribute('data-points', '-69.39');
  await expect(fig.locator('[data-net]')).toHaveText('+6,939');
  await fig.getByRole('button', { name: '1Y', exact: true }).click();
  await expect(fig).toHaveAttribute('data-points', '-274.16');
  await fig.getByRole('slider', { name: 'USD rate (base)' }).fill('0');
  await expect(fig).toHaveAttribute('data-points', '0.00');
  await expect(fig.locator('.m3-insight.is-aha')).toBeVisible();
  await fig.locator('[data-reset]').click();
  await expect(fig).toHaveAttribute('data-tenor', '3M');
  await expect(fig).toHaveAttribute('data-side', 'buySellBase');
});

test('HedgeRoll: settlement sign follows the spot, the tour plays', async ({ page }) => {
  await page.goto(path('de', '3'));
  const fig = await hydrate(page, FIGURES['3']!);
  await expect(fig).toHaveAttribute('data-side', 'receive');
  const spot = fig.getByRole('slider', { name: 'Spot am Roll-Datum' });
  await spot.fill('0.78');
  await expect(fig).toHaveAttribute('data-side', 'pay');
  await expect(fig.locator('[data-chip]')).toContainText('13’061');
  await fig.getByRole('button', { name: '2M', exact: true }).click();
  await expect(fig).toHaveAttribute('data-slip', '2M');
  await fig.locator('[data-play]').click();
  await expect(fig).not.toHaveAttribute('data-spot', '0.7800');
});

test('SwapCompare: tenor, highlight and the present-value check', async ({ page }) => {
  await page.goto(path('de', '4'));
  const fig = await hydrate(page, FIGURES['4']!);
  await expect(fig).toHaveAttribute('data-tenor', '5Y');
  await fig.getByRole('button', { name: '1Y', exact: true }).click();
  await expect(fig).toHaveAttribute('data-tenor', '1Y');
  await expect(fig.locator('[data-check]')).toContainText('FX Swap CHF 27’416');
  await expect(fig.locator('[data-check]')).toContainText('Cross-Currency Swap CHF 27’416');
  await fig.getByRole('button', { name: 'Zinsen', exact: true }).click();
  await expect(fig).toHaveAttribute('data-focus', 'interest');
  await expect(fig.locator('[data-cmp-table] .is-focus')).toHaveCount(2);
});

test('quiz page shows the four graded questions (de)', async ({ page }) => {
  await page.goto(path('de', 'quiz'));
  await expect(page.getByText('Wie viele Swap Points', { exact: false })).toBeVisible();
  await expectNoHorizontalScroll(page);
});

for (const n of ['1', '2', '3', '4']) {
  test(`axe: section ${n} has no serious violations`, async ({ page }) => {
    await page.goto(path('de', n));
    await hydrate(page, FIGURES[n]!);
    await expectNoSeriousAxeViolations(page);
  });
}

test('axe: quiz page has no serious violations', async ({ page }) => {
  await page.goto(path('en', 'quiz'));
  await expectNoSeriousAxeViolations(page);
});
