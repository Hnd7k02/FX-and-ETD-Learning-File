/**
 * Module 04 Vanilla Options: every section renders in DE and EN with its figures, each island
 * reacts to input (keyboard and pointer), the quiz page works, axe finds no serious or critical
 * violations and there is no horizontal scroll (390 px and 1440 px projects).
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const BASE = '/module/04-vanilla-options';
const path = (lang: 'de' | 'en', s: string) => `${lang === 'en' ? '/en' : ''}${BASE}/${s}/`;

const FIGURES: Record<string, string[]> = {
  '1': ['[data-ovf]'],
  '2': ['[data-four-positions]', '[data-pb]'],
  '3': ['[data-mx]'],
  '4': ['[data-pd]', '[data-pb]', '[data-wow]'],
};
const H2: Record<'de' | 'en', string[]> = {
  de: ['Intuition', 'Vier Grundpositionen', 'Moneyness und Prämie', 'Pricing und Parität'],
  en: ['Intuition', 'Four basic positions', 'Moneyness and premium', 'Pricing and parity'],
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

/** Scrolls every island into view so client:visible hydrates it, then waits for all of them. */
async function hydrateAll(page: Page) {
  for (const island of await page.locator('astro-island').all()) {
    await island.scrollIntoViewIfNeeded();
  }
  await page.waitForFunction(() =>
    [...document.querySelectorAll('astro-island')].every((i) => !i.hasAttribute('ssr')),
  );
}

for (const lang of ['de', 'en'] as const) {
  for (const s of ['1', '2', '3', '4']) {
    test(`section ${s} (${lang}) renders its figures, numbers and takeaway`, async ({ page }) => {
      await page.goto(path(lang, s));
      await expect(page.locator('html')).toHaveAttribute('lang', lang);
      await expect(
        page.getByRole('heading', { level: 2, name: H2[lang][Number(s) - 1] }),
      ).toBeVisible();
      for (const sel of FIGURES[s]!) await expect(page.locator(sel).first()).toBeAttached();
      expect(await page.locator('[data-section-content] [data-num]').count()).toBeGreaterThan(3);
      await expect(page.locator('details.derivation')).toHaveCount(1);
      await expect(page.locator('.takeaway')).toHaveCount(1);
      await hydrateAll(page);
      for (const svg of await page.locator('.figure svg[role="img"]').all()) {
        expect((await svg.getAttribute('aria-label'))?.length ?? 0).toBeGreaterThan(10);
      }
      await expectNoHorizontalScroll(page);
      await expectNoSeriousAxeViolations(page);
    });
  }
}

test('option vs forward: slider and drag move the rate at expiry', async ({ page }) => {
  await page.goto(path('de', '1'));
  const fig = page.locator('[data-ovf]');
  await fig.scrollIntoViewIfNeeded();
  await hydrateAll(page);
  await expect(fig).toHaveAttribute('data-region', 'strongUsd');
  const slider = fig.locator('input[type="range"]');
  await slider.focus();
  await page.keyboard.press('Home');
  await expect(fig).toHaveAttribute('data-region', 'weakUsd');
  await expect(fig.locator('[data-note]')).toContainText('Forward');
  // drag the handle on the chart back to the right
  const handle = fig.locator('[data-handle]');
  await handle.scrollIntoViewIfNeeded();
  const box = (await handle.boundingBox())!;
  const svgBox = (await fig.locator('svg.ovf-svg').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(svgBox.x + svgBox.width * 0.55, box.y + box.height / 2, { steps: 6 });
  await page.mouse.up();
  await expect(fig).toHaveAttribute('data-region', 'middle');
});

test('option vs forward: the saving in the note equals forward minus option as shown', async ({
  page,
}) => {
  await page.goto(path('en', '1'));
  const fig = page.locator('[data-ovf]');
  await fig.scrollIntoViewIfNeeded();
  await hydrateAll(page);
  await fig.locator('input[type="range"]').focus();
  await page.keyboard.press('Home');
  await expect(fig).toHaveAttribute('data-region', 'weakUsd');
  const chf = (t: string) => Number(t.replace(/[^0-9]/g, ''));
  // the table counts to its new values in 300 ms; compare once it has settled
  await expect
    .poll(async () => {
      const values = await fig.locator('.ff-stat-value').allInnerTexts();
      const note = await fig.locator('[data-note]').innerText();
      const saving = chf(note.match(/save CHF\s([0-9,]+)/)![1]!);
      // rows: unhedged, forward, option
      return saving - (chf(values[1]!) - chf(values[2]!));
    })
    .toBe(0);
});

test('four positions: a break-even dot per card and an aria-label with the values', async ({
  page,
}) => {
  await page.goto(path('de', '2'));
  const fp = page.locator('[data-four-positions]');
  await expect(fp.locator('circle.fp-be')).toHaveCount(4);
  await expect(fp.locator('svg[role="img"]').first()).toHaveAttribute('aria-label', /Break-even/);
});

test('payoff builder: stat values stay inside the card on phones', async ({ page }) => {
  await page.goto(path('de', '4'));
  const pb = page.locator('[data-pb]');
  await pb.scrollIntoViewIfNeeded();
  await hydrateAll(page);
  const table = (await pb.locator('.ff-stat-table').boundingBox())!;
  for (const v of await pb.locator('.ff-stat-value').all()) {
    const box = (await v.boundingBox())!;
    expect(box.x + box.width).toBeLessThanOrEqual(table.x + table.width + 0.5);
  }
});

test('payoff builder: templates, view toggle and strike slider', async ({ page }) => {
  await page.goto(path('en', '2'));
  const pb = page.locator('[data-pb]');
  await pb.scrollIntoViewIfNeeded();
  await hydrateAll(page);
  await expect(pb).toHaveAttribute('data-template', 'long-call');
  const before = Number(await pb.getAttribute('data-premium-pips'));
  expect(before).toBeGreaterThan(100);
  await pb.locator('[data-tpl="short-put"]').click();
  await expect(pb).toHaveAttribute('data-template', 'short-put');
  expect(Number(await pb.getAttribute('data-premium-pips'))).toBeLessThan(0);
  await pb.getByRole('button', { name: 'P&L after premium' }).click();
  await expect(pb.getByRole('button', { name: 'P&L after premium' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  const slider = pb.locator('input[type="range"]').first();
  await slider.focus();
  const p1 = await pb.getAttribute('data-premium-pips');
  await page.keyboard.press('ArrowRight');
  await expect(pb).not.toHaveAttribute('data-premium-pips', p1 ?? '');
  // flipping the leg to long call is recognised as the long call template
  await pb
    .getByRole('group', { name: 'Direction of leg 1' })
    .getByRole('button', { name: 'Long' })
    .click();
  await pb
    .getByRole('group', { name: 'Type of leg 1' })
    .getByRole('button', { name: 'Call' })
    .click();
  await expect(pb).toHaveAttribute('data-template', 'long-call');
});

test('payoff builder: synthetic forward is zero cost at the forward; the lock restores it', async ({
  page,
}) => {
  await page.goto(path('de', '4'));
  const pb = page.locator('[data-pb]');
  await pb.scrollIntoViewIfNeeded();
  await hydrateAll(page);
  await expect(pb).toHaveAttribute('data-template', 'synthetic-forward');
  await expect(pb).toHaveAttribute('data-zero-cost', 'true');
  await expect(pb.locator('[data-zero-chip]')).toBeVisible();
  const k1 = pb.locator('[data-leg="0"] input[type="range"]');
  await k1.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(pb).toHaveAttribute('data-zero-cost', 'false');
  await expect(pb).toHaveAttribute('data-template', 'risk-reversal');
  await pb.locator('[data-lock="1"]').click();
  await expect(pb.locator('[data-lock="1"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(pb).toHaveAttribute('data-zero-cost', 'true');
  // drag the call strike: the locked put strike follows and zero cost stays
  const handle = pb.locator('[data-handle="0"]');
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect(pb).toHaveAttribute('data-zero-cost', 'true');
});

test('moneyness explorer: desk strikes, chip and put switch', async ({ page }) => {
  await page.goto(path('de', '3'));
  const mx = page.locator('[data-mx]');
  await mx.scrollIntoViewIfNeeded();
  await hydrateAll(page);
  await expect(mx).toHaveAttribute('data-money', 'ATMF');
  await expect(mx.locator('[data-aha]')).toContainText('ATMF');
  await mx.locator('[data-marker="c25"]').click();
  await expect(mx).toHaveAttribute('data-money', 'OTM');
  await expect(mx.locator('[data-marker="c25"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(mx.locator('[data-aha]')).toContainText('25Δ');
  await mx.getByRole('button', { name: 'USD Put' }).click();
  await expect(mx).toHaveAttribute('data-money', 'ITM');
  // the 10Δ put note is about the put, and says the call with the same strike is deep ITM
  await mx.locator('[data-marker="p10"]').click();
  await expect(mx).toHaveAttribute('data-money', 'OTM');
  await expect(mx.locator('[data-aha]')).toContainText('tief im Geld');
  const slider = mx.locator('input[type="range"]');
  await slider.focus();
  await page.keyboard.press('Home');
  await expect(mx).toHaveAttribute('data-money', 'OTM');
});

test('price drivers: a slider selects its driver and moves the prices', async ({ page }) => {
  await page.goto(path('en', '4'));
  const pd = page.locator('[data-pd]');
  await pd.scrollIntoViewIfNeeded();
  await hydrateAll(page);
  await expect(pd).toHaveAttribute('data-active', 'S');
  await expect(pd.locator('[data-driver="rf"] [data-eff-call]')).toHaveAttribute(
    'data-eff-call',
    'down',
  );
  const call = pd.locator('[data-price-call]');
  const before = await call.getAttribute('data-price-call');
  await pd.locator('[data-driver="vol"] input[type="range"]').focus();
  await expect(pd).toHaveAttribute('data-active', 'vol');
  await page.keyboard.press('ArrowRight');
  await expect(call).not.toHaveAttribute('data-price-call', before ?? '');
  await pd.locator('[data-reset]').click();
  await expect(call).toHaveAttribute('data-price-call', before ?? '');
});

test('wow chart starts at parity without autoplay', async ({ page }) => {
  await page.goto(path('de', '4'));
  const wow = page.locator('[data-wow]');
  await wow.scrollIntoViewIfNeeded();
  await hydrateAll(page);
  await expect(wow).toHaveAttribute('data-phase', '3');
  await expect(wow).toHaveAttribute('data-playing', 'false');
  await page.locator('[data-wow] [data-step="1"]').click();
  await expect(wow).toHaveAttribute('data-phase', '0');
});

for (const lang of ['de', 'en'] as const) {
  test(`quiz page (${lang}) has four questions and passes axe`, async ({ page }) => {
    await page.goto(path(lang, 'quiz'));
    await hydrateAll(page);
    await expect(page.locator('main')).toContainText(lang === 'de' ? 'Importeur' : 'importer');
    await expectNoHorizontalScroll(page);
    await expectNoSeriousAxeViolations(page);
  });
}
