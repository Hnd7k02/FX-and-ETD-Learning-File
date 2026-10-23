/**
 * Module 07 Barrier & Binary: every section renders in DE and EN with its figure, each island
 * reacts to input (BarrierPaths, BarrierLab, TouchLab, GapReplay), the quiz page works, axe finds
 * no serious or critical violations and there is no horizontal scroll (390 px project).
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const SLUG = '07-barrier-binary';
const path = (lang: 'de' | 'en', section: string) =>
  `${lang === 'en' ? '/en' : ''}/module/${SLUG}/${section}/`;

const FIGURES: Record<string, string> = {
  '1': '[data-barrierpaths]',
  '2': '[data-barrierlab]',
  '3': '[data-touchlab]',
  '4': '[data-gapreplay]',
};

const TITLES = {
  de: [
    'Intuition',
    'Knock-out und Knock-in',
    'Digital und Touch',
    'Zweite Generation und Gap-Risiko',
  ],
  en: [
    'Intuition',
    'Knock-out and knock-in',
    'Digital and touch',
    'Second generation and gap risk',
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
  await expect(page.locator('[data-num="m07.uocPips"]').first()).toHaveText('17.2');
  await expect(page.locator('[data-num="m07.paritySumPips"]').first()).toHaveText('126.7');
  await page.goto(path('de', '4'));
  await expect(page.locator('[data-fact="m07-floor"]').first()).toHaveText('1.20');
  await expect(page.locator('[data-fact="m07-floor"]').first()).toHaveAttribute(
    'data-source',
    'snb-2011-09-06',
  );
  await expect(page.locator('[data-num="m07.gapShock"]').first()).toHaveText('1.0280');
});

test('BarrierPaths: knock-in, barrier slider and new paths', async ({ page }) => {
  await page.goto(path('de', '1'));
  const fig = await hydrate(page, FIGURES['1']!);
  const hero = fig.locator('.ff-stat-hero');
  const before = await hero.textContent();
  await fig.getByRole('button', { name: 'Knock-in', exact: true }).click();
  await expect(fig).toHaveAttribute('data-io', 'in');
  await expect(hero).not.toHaveText(before ?? '');
  await fig.locator('#bp-barrier').fill('0.776');
  await expect(fig).toHaveAttribute('data-dir', 'down');
  const note = await fig.locator('.m7-note').textContent();
  await fig.locator('[data-reseed]').click();
  await expect(fig.locator('.m7-note')).not.toHaveText(note ?? '');
});

test('BarrierLab: reverse knock-out near the barrier, direction and parity', async ({ page }) => {
  await page.goto(path('en', '2'));
  const fig = await hydrate(page, FIGURES['2']!);
  await expect(fig).toHaveAttribute('data-reverse', 'true');
  await fig.locator('#bl-spot').fill('0.82');
  await expect(fig.locator('[data-aha="reverseNear"]')).toBeVisible();
  await fig.getByRole('button', { name: 'Down (below)', exact: true }).click();
  await expect(fig).toHaveAttribute('data-kind', 'down-and-out');
  await expect(fig).toHaveAttribute('data-reverse', 'false');
  await expect(fig.locator('.m7-check-f')).toContainText('0.0000');
  await fig.locator('[data-reset]').click();
  await expect(fig).toHaveAttribute('data-kind', 'up-and-out');
});

test('TouchLab: modes, payment toggle and vol', async ({ page }) => {
  await page.goto(path('de', '3'));
  const fig = await hydrate(page, FIGURES['3']!);
  await expect(fig).toHaveAttribute('data-mode', 'oneTouch');
  await fig.getByRole('button', { name: 'bei Berührung', exact: true }).click();
  await expect(fig.locator('[data-aha="same"]')).toBeVisible();
  await fig.getByRole('button', { name: 'Double No-Touch', exact: true }).click();
  await expect(fig).toHaveAttribute('data-mode', 'dnt');
  const hero = fig.locator('.ff-stat-hero-main');
  const before = await hero.textContent();
  await fig.locator('#tl-vol').fill('12');
  await expect(hero).not.toHaveText(before ?? '');
  await fig.getByRole('button', { name: 'Digital', exact: true }).click();
  await fig.locator('#tl-spread').fill('4');
  await expect(fig.locator('[data-aha="digital"]')).toBeVisible();
});

test('GapReplay: the shock triggers every order at once and links to the Riskometer', async ({
  page,
}) => {
  await page.goto(path('de', '4'));
  const fig = await hydrate(page, FIGURES['4']!);
  await fig.locator('#gr-day').fill('0');
  await expect(fig).toHaveAttribute('data-triggered', 'false');
  await expect(fig.locator('tr[data-hit="true"]')).toHaveCount(0);
  const max = await fig.locator('#gr-day').getAttribute('max');
  await fig.locator('#gr-day').fill(max ?? '60');
  await expect(fig).toHaveAttribute('data-triggered', 'true');
  await expect(fig.locator('tr[data-hit="true"]')).toHaveCount(5);
  await expect(fig.locator('[data-riskometer]')).toHaveAttribute(
    'href',
    '/riskometer/?event=chf-shock-2015&pair=EURCHF',
  );
});

test('quiz page shows the four graded questions (de)', async ({ page }) => {
  await page.goto(path('de', 'quiz'));
  await expect(
    page.getByText('Welche Option ist ein Reverse Knock-out?', { exact: false }),
  ).toBeVisible();
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
