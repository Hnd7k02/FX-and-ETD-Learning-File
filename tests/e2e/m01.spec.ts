/**
 * Module 01 FX market & spot: every section renders in DE and EN with its figures, each island
 * reacts to input (SpotExposure, SessionClock, TwoWayPrice, OrderDemo, TriangularArbitrage,
 * G10Profiles), numbers and facts come from the registries, the quiz page works, axe finds no
 * serious or critical violations and there is no horizontal scroll (390 px project).
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const SLUG = '01-spot';
const path = (lang: 'de' | 'en', section: string) =>
  `${lang === 'en' ? '/en' : ''}/module/${SLUG}/${section}/`;

/** Figures per section (section 3 has three). */
const FIGURES: Record<string, string[]> = {
  '1': ['[data-spx]'],
  '2': ['[data-sc]'],
  '3': ['[data-twp]', '[data-od]', '[data-tri]'],
  '4': ['[data-g10]'],
};

const TITLES = {
  de: ['Intuition', 'Ein Markt ohne Börse', 'Quotierung und 2-Way Price', 'Gefühl für Währungen'],
  en: [
    'Intuition',
    'A market without an exchange',
    'Quotes and the two-way price',
    'A feel for currencies',
  ],
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
    test(`section ${n} renders with its figures (${lang})`, async ({ page }) => {
      await page.goto(path(lang, n));
      await expect(
        page.getByRole('heading', { level: 2, name: TITLES[lang][Number(n) - 1] }),
      ).toBeVisible();
      await expect(page.locator('[data-section-content]')).toBeVisible();
      await expect(page.locator('details.derivation').first()).not.toHaveAttribute('open', '');
      await expect(page.locator('.takeaway')).toBeVisible();
      for (const sel of FIGURES[n]!) {
        const fig = await hydrate(page, sel);
        if (n === '4') {
          await expect(fig.locator('[role="group"]').first()).toHaveAttribute('aria-label', /\S/);
        } else {
          await expect(fig.locator('[role="img"]').first()).toHaveAttribute('aria-label', /\S/);
        }
      }
      await expectNoHorizontalScroll(page);
    });
  }
}

test('numbers come from the registry and facts carry a source', async ({ page }) => {
  await page.goto(path('de', '1'));
  await expect(page.locator('[data-num="m01.bigFigChf"]').first()).toHaveText(/^CHF\s10’000$/);
  await expect(page.locator('[data-num="m01.inverse"]').first()).toHaveText('1.2500');
  await page.goto(path('de', '2'));
  await expect(page.locator('[data-fact="m01-bis-turnover"]').first()).toHaveAttribute(
    'data-source',
    'bis-qr-2025-12-fx',
  );
  await page.goto(path('en', '4'));
  await expect(page.locator('[data-num="m01.carryBreakEven"]').first()).toHaveText('0.79306');
  await expect(page.locator('[data-fact="m01-bis-chf-rank"]').first()).toHaveText(
    'sixth most traded',
  );
});

test('SpotExposure: the rate moves the cost, the blocks and the note', async ({ page }) => {
  await page.goto(path('de', '1'));
  const fig = await hydrate(page, '[data-spx]');
  await expect(fig).toHaveAttribute('data-dir', 'flat');
  const hero = fig.locator('.ff-stat-hero-main');
  await expect(hero).toHaveText(/800’000/);
  await fig.locator('input[type="range"]').fill('0.84');
  await expect(fig).toHaveAttribute('data-rate', '0.8400');
  await expect(fig).toHaveAttribute('data-dir', 'up');
  await expect(fig).toHaveAttribute('data-blocks', '4');
  await expect(fig.locator('[data-annot]')).toBeVisible();
  await expect(hero).toHaveText(/840’000/);
  await expect(fig.locator('[data-note]')).toContainText('11');
  await fig.getByRole('button', { name: '0.7600' }).click();
  await expect(fig).toHaveAttribute('data-dir', 'down');
});

test('SessionClock: day, time, peak and playback', async ({ page }) => {
  await page.goto(path('en', '2'));
  const fig = await hydrate(page, '[data-sc]');
  await fig.getByRole('button', { name: 'Mon–Thu', exact: true }).click();
  await fig.locator('input[type="range"]').fill('15');
  await expect(fig).toHaveAttribute('data-day', 'monThu');
  await expect(fig).toHaveAttribute('data-level', 'peak');
  await expect(fig).toHaveAttribute('data-open', /london/);
  await expect(fig).toHaveAttribute('data-open', /newYork/);
  await fig.getByRole('button', { name: 'Sat', exact: true }).click();
  await expect(fig).toHaveAttribute('data-level', 'closed');
  await fig.getByRole('button', { name: 'Sun', exact: true }).click();
  await fig.locator('input[type="range"]').fill('2');
  const play = fig.locator('[data-play]');
  await play.click();
  await expect(fig).toHaveAttribute('data-playing', 'true');
  await expect
    .poll(async () => Number(await fig.getAttribute('data-hour')), { timeout: 6000 })
    .toBeGreaterThan(3);
  await play.click();
  await expect(fig).toHaveAttribute('data-playing', 'false');
});

test('TwoWayPrice: drivers widen the spread', async ({ page }) => {
  await page.goto(path('de', '3'));
  const fig = await hydrate(page, '[data-twp]');
  await expect(fig).toHaveAttribute('data-spread', '4');
  await fig.locator('[data-driver="event"]').click();
  await expect(fig).toHaveAttribute('data-spread', '16');
  await expect(fig.locator('[data-driver="event"]')).toHaveAttribute('aria-pressed', 'true');
  await fig.locator('[data-driver="time"]').click();
  await expect(fig).toHaveAttribute('data-spread', '18');
});

test('OrderDemo: a stop is filled far worse after a weekend gap', async ({ page }) => {
  await page.goto(path('en', '3'));
  const fig = await hydrate(page, '[data-od]');
  await fig.getByRole('button', { name: 'Stop-loss', exact: true }).click();
  await expect(fig).toHaveAttribute('data-gap', 'false');
  await fig.getByRole('button', { name: 'Gap over the weekend', exact: true }).click();
  await expect(fig).toHaveAttribute('data-gap', 'true');
  await expect(fig).toHaveAttribute('data-price', '0.8240');
  await expect(fig.locator('[data-slip]')).toBeVisible();
  await fig.getByRole('button', { name: 'Limit', exact: true }).click();
  await expect(fig).toHaveAttribute('data-filled', 'false');
});

test('TriangularArbitrage: a gap outside the band pays, aligning removes it', async ({ page }) => {
  await page.goto(path('de', '3'));
  const fig = await hydrate(page, '[data-tri]');
  await expect(fig).toHaveAttribute('data-direction', 'none');
  await fig.locator('input[type="range"]').nth(2).fill('0.881');
  await expect(fig).toHaveAttribute('data-direction', 'sellDirectBuyCross');
  await expect(fig.locator('[data-legs] li')).toHaveCount(3);
  await fig.locator('input[type="range"]').nth(2).fill('0.879');
  await expect(fig).toHaveAttribute('data-direction', 'buyDirectSellCross');
  await fig.locator('[data-reset]').click();
  await expect(fig).toHaveAttribute('data-direction', 'none');
});

test('G10Profiles: scenario, role filter and profile', async ({ page }) => {
  await page.goto(path('de', '4'));
  const fig = await hydrate(page, '[data-g10]');
  await expect(fig).toHaveAttribute('data-selected', 'CHF');
  await fig.getByRole('button', { name: 'Krise', exact: true }).click();
  await expect(fig.locator('[data-code="USD"]')).toHaveAttribute('data-tendency', 'up');
  await expect(fig.locator('[data-code="AUD"]')).toHaveAttribute('data-tendency', 'down');
  await expect(fig.locator('[data-code="GBP"]')).toHaveAttribute('data-tendency', 'flat');
  await fig.getByRole('button', { name: 'Rohstoff', exact: true }).click();
  await expect(fig.locator('[data-code="CHF"]')).toHaveAttribute('data-match', 'false');
  await expect(fig).toHaveAttribute('data-selected', 'AUD');
  await expect(fig.locator('[data-detail]')).toContainText('Reserve Bank of Australia');
  await fig.locator('[data-code="CAD"]').click();
  await expect(fig.locator('[data-value-date]')).toContainText('T+1');
});

test('quiz page shows the graded questions (de)', async ({ page }) => {
  await page.goto(path('de', 'quiz'));
  await expect(page.getByText('Um wie viel ändert sich CHF/USD', { exact: false })).toBeVisible();
  await expectNoHorizontalScroll(page);
});

for (const n of ['1', '2', '3', '4']) {
  test(`axe: section ${n} has no serious violations`, async ({ page }) => {
    await page.goto(path(n === '3' ? 'en' : 'de', n));
    for (const sel of FIGURES[n]!) await hydrate(page, sel);
    await expectNoSeriousAxeViolations(page);
  });
}

test('axe: quiz page has no serious violations', async ({ page }) => {
  await page.goto(path('en', 'quiz'));
  await expectNoSeriousAxeViolations(page);
});
