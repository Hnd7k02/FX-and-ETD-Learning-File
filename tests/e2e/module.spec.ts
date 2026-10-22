/**
 * Module template (B-Modul): header and stepper, MDX numbers, check question, progress
 * tracking via the end-of-section marker, pager links, quiz flow, English route, redirect,
 * placeholder for unwritten sections, axe and no horizontal scroll (390 px project).
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const SEC2 = '/module/05-greeks/2/';
const QUIZ = '/module/05-greeks/quiz/';
const STORAGE = 'ff-progress-v1';

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

/** Waits until every Preact island on the page has hydrated (Astro drops the ssr attribute). */
async function waitHydrated(page: Page) {
  await page.waitForFunction(() =>
    [...document.querySelectorAll('astro-island')].every((i) => !i.hasAttribute('ssr')),
  );
}

const progress = (page: Page) =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null'), STORAGE);

test.describe('module section page', () => {
  test('shows header, chips, stepper with section 2 current and numbers from the core', async ({
    page,
  }) => {
    await page.goto(SEC2);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Greeks: wie der Optionspreis reagiert' }),
    ).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Pfad' })).toContainText('05 Greeks');
    await expect(page.locator('.mh .chip-family')).toHaveText(/05 · Optionen/);
    await expect(page.locator('.mh .chip-outline')).toHaveText(/Aufbau · 35 min/);

    const steps = page.locator('[data-step]');
    await expect(steps).toHaveCount(5);
    await expect(page.locator('[data-step="2"]')).toHaveAttribute('aria-current', 'step');
    await expect(page.locator('[data-step="2"]')).toHaveAttribute('data-state', 'current');
    await expect(page.locator('[data-step="1"]')).toHaveAttribute('data-state', 'open');
    await expect(page.locator('[data-step="quiz"]')).toHaveAttribute(
      'href',
      '/module/05-greeks/quiz/',
    );
    for (const s of await steps.all()) {
      const box = await s.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }

    await expect(page.locator('.intro .eyebrow')).toHaveText('Abschnitt 2 von 5');
    await expect(page.getByRole('heading', { level: 2, name: 'Delta und Gamma' })).toBeVisible();
    await expect(page.locator('[data-num="m05.gamma"]').first()).toHaveText(/12\.36/);
    await expect(page.locator('[data-num="m05.delta"]').first()).toHaveText(/0\.504/);
    await expect(page.locator('[data-num="m05.breakEvenPips"]')).toHaveText(/33\.5/);
    await expect(page.locator('[data-num="m05.thetaGammaDay"]')).toHaveText(/CHF\s−69/);
    await expect(page.locator('details.derivation')).not.toHaveAttribute('open', '');
    await expect(page.locator('.desk')).toContainText('Gamma gegen Theta');
    await expect(page.locator('.takeaway')).toBeVisible();
  });

  test('check question gives feedback and can be retried', async ({ page }) => {
    await page.goto(SEC2);
    const card = page.locator('[data-quiz="check"]');
    await card.scrollIntoViewIfNeeded();
    await waitHydrated(page);
    await expect(card).toContainText('Kurz geprüft');
    const options = card.locator('.qz-opt');
    await expect(options).toHaveCount(3);
    await expect(options.nth(1)).toHaveText(/\+0\.124/);

    await options.nth(0).click();
    await expect(options.nth(0)).toHaveAttribute('aria-pressed', 'true');
    await expect(options.nth(0)).toHaveAttribute('data-state', 'wrong');
    await expect(options.nth(1)).toHaveAttribute('data-state', 'correct');
    const status = card.getByRole('status');
    await expect(status).toContainText('Nicht ganz.');
    await expect(status).toContainText('Richtig ist B.');
    // locked after answering
    await options.nth(2).click();
    await expect(options.nth(2)).toHaveAttribute('aria-pressed', 'false');

    await card.getByRole('button', { name: 'Nochmals versuchen' }).click();
    await expect(options.nth(0)).toHaveAttribute('data-state', 'idle');
    await options.nth(1).click();
    await expect(status).toContainText('Richtig.');
  });

  test('reaching the end marks the section done; reload and next section show it', async ({
    page,
  }) => {
    await page.goto(SEC2);
    expect((await progress(page))?.last).toEqual({ slug: '05-greeks', section: '2' });
    expect((await progress(page))?.sections ?? {}).toEqual({});
    await expect(page.locator('[data-section-done]')).toBeHidden();

    await page.locator('[data-section-end]').scrollIntoViewIfNeeded();
    await expect(page.locator('[data-section-done]')).toBeVisible();
    await expect(page.locator('[data-section-done]')).toHaveText(/Abschnitt erledigt/);
    expect((await progress(page)).sections).toEqual({ '05-greeks/2': true });
    await expect(page.locator('[data-step="2"]')).toHaveAttribute('data-done', 'true');

    await page.reload();
    await expect(page.locator('[data-section-done]')).toBeVisible();
    await expect(page.locator('[data-step="2"]')).toHaveAttribute('data-done', 'true');

    await page.goto('/module/05-greeks/3/');
    await expect(page.locator('[data-step="2"]')).toHaveAttribute('data-state', 'done');
    await expect(page.locator('[data-step="3"]')).toHaveAttribute('data-state', 'current');
    expect((await progress(page)).last).toEqual({ slug: '05-greeks', section: '3' });
  });

  test('pager links: previous/next section, learning path, quiz and next module', async ({
    page,
  }) => {
    await page.goto(SEC2);
    const pager = page.getByRole('navigation', { name: 'Weiter' });
    await expect(pager.getByRole('link', { name: /Zurück.*1 · Intuition/ })).toHaveAttribute(
      'href',
      '/module/05-greeks/1/',
    );
    await expect(pager.getByRole('link', { name: /Weiter.*3 · Vega/ })).toHaveAttribute(
      'href',
      '/module/05-greeks/3/',
    );

    await page.goto('/module/05-greeks/1/');
    await expect(page.locator('.pager-back')).toHaveAttribute('href', '/#lernpfad');
    await page.goto('/module/05-greeks/4/');
    await expect(page.locator('.pager-next')).toHaveAttribute('href', '/module/05-greeks/quiz/');
    await expect(page.locator('.pager-next')).toContainText('5 · Quiz');
    await page.goto(QUIZ);
    await expect(page.locator('.pager-next')).toHaveAttribute(
      'href',
      '/module/06-combos-smile/1/',
    );
    await expect(page.locator('.pager-next')).toContainText('Nächstes Modul');
    await page.goto('/module/09-hedge-alpha-yield/quiz/');
    await expect(page.locator('.pager-next')).toHaveAttribute('href', '/#lernpfad');
  });

  test('/module/{slug}/ redirects to section 1', async ({ page }) => {
    await page.goto('/module/05-greeks/');
    await page.waitForURL(/\/module\/05-greeks\/1\/$/);
    await expect(page.locator('[data-step="1"]')).toHaveAttribute('aria-current', 'step');
  });

  test('a section without text shows the placeholder, with header and pager', async ({ page }) => {
    await page.goto('/module/01-spot/3/');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Der Devisenmarkt und der Spotkurs' }),
    ).toBeVisible();
    await expect(page.locator('[data-coming="section"]')).toContainText(
      'Dieser Abschnitt entsteht gerade.',
    );
    await expect(page.locator('[data-quiz]')).toHaveCount(0);
    await expect(page.locator('.pager-next')).toHaveAttribute('href', '/module/01-spot/4/');
  });

  test('English section renders in English with the same numbers', async ({ page }) => {
    await page.goto('/en/module/05-greeks/2/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Greeks: how the option price reacts' }),
    ).toBeVisible();
    await expect(page.locator('.intro .eyebrow')).toHaveText('Section 2 of 5');
    await expect(page.getByRole('heading', { level: 2, name: 'Delta and gamma' })).toBeVisible();
    await expect(page.locator('[data-num="m05.vegaPoint"], [data-num="m05.gamma"]').first()).toHaveText(
      /12\.36/,
    );
    await expect(page.locator('[data-quiz="check"]')).toContainText('Quick check');
    await expect(page.locator('.pager-next')).toHaveAttribute('href', '/en/module/05-greeks/3/');
    await expect(page.locator('a[data-lang-switch="de"]')).toHaveAttribute(
      'href',
      '/module/05-greeks/2/',
    );
  });
});

test.describe('module quiz page', () => {
  test('four questions one at a time, result with score, pass from 3 of 4, retry', async ({
    page,
  }) => {
    await page.goto(QUIZ);
    await waitHydrated(page);
    await expect(page.locator('[data-step="quiz"]')).toHaveAttribute('aria-current', 'step');
    await expect(page.getByRole('heading', { level: 2, name: 'Quiz: Greeks' })).toBeVisible();
    expect((await progress(page)).last).toEqual({ slug: '05-greeks', section: 'quiz' });

    const card = page.locator('[data-quiz="quiz"]');
    const picks = [0, 1, 1, 1]; // q4's correct answer is A → 3 of 4
    for (let i = 0; i < 4; i++) {
      await expect(card.locator('.qz-title')).toHaveText(`Kurz geprüft · Frage ${i + 1} von 4`);
      await expect(card.locator('.qz-dots li').nth(i)).toHaveAttribute('data-state', 'current');
      await card.locator(`[data-option="${picks[i]}"]`).click();
      await expect(card.getByRole('status').first()).toContainText(/Richtig\.|Nicht ganz\./);
      await card.locator('[data-next]').click();
    }

    await expect(card).toHaveAttribute('data-state', 'result');
    await expect(card.locator('.qz-score')).toHaveText('3 von 4 richtig');
    await expect(card).toContainText('Bestanden. Das Modul ist erledigt.');
    await expect(card.locator('.qz-review li')).toHaveCount(4);
    await expect(card.locator('.qz-review li').nth(3)).toHaveAttribute('data-ok', 'false');
    await expect(card).toContainText('Bestes Ergebnis: 3 von 4');
    expect((await progress(page)).quiz['05-greeks']).toEqual({ best: 3, total: 4, passed: true });
    await expect(page.locator('[data-step="quiz"]')).toHaveAttribute('data-done', 'true');

    await card.getByRole('button', { name: 'Nochmals versuchen' }).click();
    await expect(card.locator('.qz-title')).toHaveText('Kurz geprüft · Frage 1 von 4');
    await expect(card.locator('.qz-opt').first()).toHaveAttribute('aria-pressed', 'false');
  });

  test('a failed quiz is not recorded as passed and keeps the best score', async ({ page }) => {
    await page.addInitScript((key) => {
      localStorage.setItem(
        key,
        JSON.stringify({ v: 1, sections: {}, quiz: { '05-greeks': { best: 3, total: 4 } } }),
      );
    }, STORAGE);
    await page.goto(QUIZ);
    await waitHydrated(page);
    const card = page.locator('[data-quiz="quiz"]');
    for (const pick of [2, 0, 0, 2]) {
      await card.locator(`[data-option="${pick}"]`).click();
      await card.locator('[data-next]').click();
    }
    await expect(card.locator('.qz-score')).toHaveText('0 von 4 richtig');
    await expect(card).toContainText('Noch nicht bestanden.');
    await expect(card).toContainText('Bestes Ergebnis: 3 von 4');
    expect((await progress(page)).quiz['05-greeks']).toEqual({ best: 3, total: 4, passed: true });
  });

  test('a module without a quiz shows the placeholder', async ({ page }) => {
    await page.goto('/module/02-forward/quiz/');
    await expect(page.locator('[data-coming="quiz"]')).toContainText(
      'Das Quiz zu diesem Modul entsteht gerade.',
    );
  });
});

for (const path of [SEC2, QUIZ, '/en/module/05-greeks/2/', '/module/01-spot/3/']) {
  test(`no horizontal scroll and no serious axe violations on ${path}`, async ({ page }) => {
    await page.goto(path);
    await expectNoHorizontalScroll(page);
    await expectNoSeriousAxeViolations(page);
  });
}
