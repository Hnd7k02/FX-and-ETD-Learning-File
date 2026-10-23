/**
 * Module 02 Forward: every section renders in DE and EN with its figure, each island reacts to
 * input (HedgeOutcome, ParityPaths, ForwardCurve, CashCarryCalculator), numbers and facts come
 * from the registries, the quiz page works, axe finds no serious or critical violations and
 * there is no horizontal scroll (390 px project).
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const SLUG = '02-forward';
const path = (lang: 'de' | 'en', section: string) =>
  `${lang === 'en' ? '/en' : ''}/module/${SLUG}/${section}/`;

/** The figure of each section. */
const FIGURES: Record<string, string> = {
  '1': '[data-ho]',
  '2': '[data-pp]',
  '3': '[data-fc]',
  '4': '[data-cc]',
};

const TITLES = {
  de: ['Intuition', 'Zinsparität', 'Forward Points und Carry', 'Arbitrage'],
  en: ['Intuition', 'Interest rate parity', 'Forward points and carry', 'Arbitrage'],
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
      await expect(fig.locator('svg[role="img"]').first()).toHaveAttribute('aria-label', /\d/);
      await expectNoHorizontalScroll(page);
    });
  }
}

test('numbers come from the registry and facts carry a source', async ({ page }) => {
  await page.goto(path('de', '1'));
  await expect(page.locator('[data-num="m02.fwd"]').first()).toHaveText('0.79306');
  await expect(page.locator('[data-num="m02.fwdChf"]').first()).toHaveText(/^CHF\s793’061$/);
  await expect(page.locator('[data-fact="m02-bis-fwd-share"]').first()).toHaveAttribute(
    'data-source',
    'bis-rpfx25-fx',
  );
  await page.goto(path('en', '2'));
  await expect(page.locator('[data-num="m02.usdToday"]').first()).toHaveText(/^USD\s991,326$/);
  await expect(page.locator('[data-num="ex.fwdDiffPips"]').first()).toHaveText('0.3');
  await page.goto(path('en', '4'));
  await expect(page.locator('[data-num="m02.arbProfit"]').first()).toHaveText(/^CHF\s1,000$/);
});

test('HedgeOutcome: the rate at maturity moves the unhedged cost, the forward stays', async ({
  page,
}) => {
  await page.goto(path('de', '1'));
  const fig = await hydrate(page, '[data-ho]');
  const slider = fig.locator('input[type="range"]');
  await slider.fill('0.76');
  await expect(fig).toHaveAttribute('data-verdict', 'costs');
  await expect(fig.locator('[data-note]')).toContainText('760’000');
  await expect(fig.locator('[data-note]')).toContainText('793’061');
  await slider.fill('0.84');
  await expect(fig).toHaveAttribute('data-verdict', 'saves');
  await expect(fig.locator('[data-chip]')).toContainText('46’939');
  await fig.locator('[data-reseed]').click();
  await expect
    .poll(async () => Number(await fig.getAttribute('data-shown')), { timeout: 10_000 })
    .toBe(40);
  await expect(fig.locator('[data-insight]')).toHaveClass(/is-aha/);
});

test('ParityPaths: stepping through both routes ends in the same price', async ({ page }) => {
  await page.goto(path('en', '2'));
  const fig = await hydrate(page, '[data-pp]');
  await fig.locator('[data-play]').click(); // pause or restart; stepping takes over below
  for (let i = 0; i < 11; i++) await fig.locator('[data-next]').click();
  await expect(fig).toHaveAttribute('data-step', 'result');
  await expect(fig.locator('[data-result]')).toBeVisible();
  await expect(fig.locator('[data-insight]')).toHaveClass(/is-aha/);
  await fig.locator('[data-prev]').click();
  await expect(fig).not.toHaveAttribute('data-step', 'result');
  // a higher CHF rate lifts the forward; both routes still cost the same
  await fig.locator('input[type="range"]').first().fill('0.02');
  await expect(fig).toHaveAttribute('data-fwd', '0.797026');
  const values = fig.locator('.ff-stat-row .ff-stat-value');
  await expect(values.nth(0)).toHaveText(/797,026/);
  await expect(values.nth(1)).toHaveText(/797,026/);
});

test('ForwardCurve: swapping the rates flips the points, a forward is not a forecast', async ({
  page,
}) => {
  await page.goto(path('de', '3'));
  const fig = await hydrate(page, '[data-fc]');
  await expect(fig).toHaveAttribute('data-wording', 'discount');
  await expect(fig).toHaveAttribute('data-tenor', '3M');
  await fig.getByRole('button', { name: 'Getauscht', exact: true }).click();
  await expect(fig).toHaveAttribute('data-wording', 'premium');
  await expect(fig.locator('[data-insight]')).toHaveClass(/is-aha/);
  await fig.getByRole('button', { name: 'Gleich', exact: true }).click();
  await expect(fig).toHaveAttribute('data-wording', 'flat');
  await fig.getByRole('button', { name: 'Beispiel', exact: true }).click();
  await expect(fig).toHaveAttribute('data-wording', 'discount');
  await fig.locator('input[type="range"]').nth(2).fill('6');
  await expect(fig).toHaveAttribute('data-tenor', '1Y');
  await expect(fig.locator('.ff-stat-row.is-highlight')).toContainText('0.77258');
});

test('CashCarryCalculator: typed forward, both directions, the market closes the gap', async ({
  page,
}) => {
  await page.goto(path('en', '4'));
  const fig = await hydrate(page, '[data-cc]');
  await expect(fig).toHaveAttribute('data-dir', 'rich');
  await expect(fig.locator('.cc-step')).toHaveCount(8);
  const input = fig.getByLabel('Market forward', { exact: true }).first();
  await input.fill('0.79206');
  await input.press('Enter');
  await expect(fig).toHaveAttribute('data-dir', 'cheap');
  await expect(fig.locator('[data-key="buyBaseForward"]')).toBeVisible();
  await expect(fig.locator('[data-chip]')).toContainText('−10.0');
  await fig.locator('[data-reset]').click();
  await expect(fig).toHaveAttribute('data-dir', 'rich');
  await expect
    .poll(async () => Number(await fig.locator('[data-profit]').getAttribute('data-profit')))
    .toBeCloseTo(1000, 1);
  await fig.locator('[data-react]').click();
  await expect(fig).toHaveAttribute('data-dir', 'none', { timeout: 6000 });
  await expect(fig.locator('[data-insight]')).toHaveClass(/is-aha/);
  await expect(fig.locator('.cc-none')).toBeVisible();
});

test('quiz page shows the graded questions (de)', async ({ page }) => {
  await page.goto(path('de', 'quiz'));
  await expect(
    page.getByText('Was ist der Forward für ihn an diesem Tag wert?', { exact: false }),
  ).toBeVisible();
  await expectNoHorizontalScroll(page);
});

for (const n of ['1', '2', '3', '4']) {
  test(`axe: section ${n} has no serious violations`, async ({ page }) => {
    await page.goto(path(n === '2' || n === '4' ? 'en' : 'de', n));
    await hydrate(page, FIGURES[n]!);
    await expectNoSeriousAxeViolations(page);
  });
}

test('axe: quiz page has no serious violations', async ({ page }) => {
  await page.goto(path('en', 'quiz'));
  await expectNoSeriousAxeViolations(page);
});
