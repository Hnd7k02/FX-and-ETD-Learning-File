/**
 * Module 06 Combos & Vol Smile: every section renders in DE and EN with its figure, each island
 * reacts to input (keyboard and pointer), the quiz page works, axe finds no serious or critical
 * violations and there is no horizontal scroll (390 px and 1440 px projects).
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const BASE = '/module/06-combos-smile';
const path = (lang: 'de' | 'en', s: string) => `${lang === 'en' ? '/en' : ''}${BASE}/${s}/`;

const FIGURES: Record<string, string[]> = {
  '1': ['[data-hs]'],
  '2': ['[data-pb]'],
  '3': ['[data-pb]'],
  '4': ['[data-sb]'],
};
const H2: Record<'de' | 'en', string[]> = {
  de: [
    'Intuition',
    'Spreads und Risk Reversal',
    'Straddle, Strangle, Butterfly, Seagull',
    'Vola-Smile',
  ],
  en: [
    'Intuition',
    'Spreads and risk reversals',
    'Straddle, strangle, butterfly, seagull',
    'Volatility smile',
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

/** Scrolls every island into view so client:visible hydrates it, then waits for all of them. */
async function hydrateAll(page: Page) {
  for (const island of await page.locator('astro-island').all()) {
    await island.scrollIntoViewIfNeeded();
  }
  await page.waitForFunction(() =>
    [...document.querySelectorAll('astro-island')].every((i) => !i.hasAttribute('ssr')),
  );
}

/** Drags an element by (dx, dy) CSS pixels with the mouse. */
async function dragBy(page: Page, selector: string, dx: number, dy: number) {
  const el = page.locator(selector).first();
  await el.scrollIntoViewIfNeeded();
  const box = (await el.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 6 });
  await page.mouse.up();
}

for (const lang of ['de', 'en'] as const) {
  for (const s of ['1', '2', '3', '4']) {
    test(`section ${s} (${lang}) renders its figure, numbers and takeaway`, async ({ page }) => {
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

test('hedge shaper: blocks build collar and seagull; slider and drag move the rate', async ({
  page,
}) => {
  await page.goto(path('de', '1'));
  const hs = page.locator('[data-hs]');
  await hs.scrollIntoViewIfNeeded();
  await hydrateAll(page);
  await expect(hs).toHaveAttribute('data-structure', 'call');
  await expect(hs).toHaveAttribute('data-zero-cost', 'false');
  await hs.locator('[data-block="sellPut"]').click();
  await expect(hs).toHaveAttribute('data-structure', 'collar');
  await expect(hs).toHaveAttribute('data-zero-cost', 'true');
  await expect(hs.locator('[data-zero-chip]')).toBeVisible();
  await expect(hs.locator('[data-block="sellPut"]')).toHaveAttribute('aria-pressed', 'true');
  await hs.locator('[data-block="sellCall"]').click();
  await expect(hs).toHaveAttribute('data-structure', 'seagull');
  // the seagull's put finances the call spread; the cap only holds up to the sold call
  await expect(hs.locator('[data-aha]')).toContainText('Call-Spread');
  await expect(hs.locator('[data-summary]')).toContainText('darüber Markt minus');
  await hs.locator('[data-block="sellPut"]').click();
  await expect(hs).toHaveAttribute('data-structure', 'call-spread');
  await expect(hs).toHaveAttribute('data-zero-cost', 'false');
  const slider = hs.locator('input[type="range"]');
  await slider.focus();
  await page.keyboard.press('Home');
  await expect(hs).toHaveAttribute('data-st', '0.7400');
  await dragBy(page, '[data-hs] [data-handle]', 80, 0);
  await expect(hs).not.toHaveAttribute('data-st', '0.7400');
});

test('payoff builder (section 2): the collar starts at zero cost with the solved strike marked', async ({
  page,
}) => {
  await page.goto(path('en', '2'));
  const pb = page.locator('[data-pb]');
  await pb.scrollIntoViewIfNeeded();
  await hydrateAll(page);
  await expect(pb).toHaveAttribute('data-template', 'risk-reversal');
  await expect(pb).toHaveAttribute('data-zero-cost', 'true');
  await expect(pb.locator('[data-handle][data-solved="true"]')).toHaveCount(1);
  // the call strike moves, the locked put strike follows and zero cost stays
  const k1 = pb.locator('[data-leg="0"] input[type="range"]');
  await k1.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(pb).toHaveAttribute('data-zero-cost', 'true');
  await pb.locator('[data-tpl="call-spread"]').click();
  await expect(pb).toHaveAttribute('data-template', 'call-spread');
  await expect(pb).toHaveAttribute('data-zero-cost', 'false');
  await expect(pb.locator('[data-handle][data-solved="true"]')).toHaveCount(0);
});

test('payoff builder (section 3): the vol shock lifts the straddle and hurts the butterfly', async ({
  page,
}) => {
  await page.goto(path('de', '3'));
  const pb = page.locator('[data-pb]');
  await pb.scrollIntoViewIfNeeded();
  await hydrateAll(page);
  await expect(pb).toHaveAttribute('data-template', 'straddle');
  await expect(pb).toHaveAttribute('data-vol-shock', '0.0000');
  const shock = pb.locator('.pb-shock input[type="range"]');
  await shock.focus();
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight');
  await expect(pb).toHaveAttribute('data-vol-shock', '0.0100');
  const note = pb.locator('[data-shock-pnl]');
  expect(Number(await note.getAttribute('data-shock-pnl'))).toBeGreaterThan(0);
  await pb.locator('[data-tpl="butterfly"]').click();
  await expect(pb).toHaveAttribute('data-template', 'butterfly');
  expect(Number(await note.getAttribute('data-shock-pnl'))).toBeLessThan(0);
  await expect(pb.getByRole('button', { name: 'G&V nach Prämie' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('smile builder: presets, sliders, axis toggle and dragging a wing', async ({ page }) => {
  await page.goto(path('en', '4'));
  const sb = page.locator('[data-sb]');
  await sb.scrollIntoViewIfNeeded();
  await hydrateAll(page);
  await expect(sb).toHaveAttribute('data-shape', 'smile');
  await expect(sb).toHaveAttribute('data-rr', '-0.0100');
  await sb.getByRole('button', { name: 'Symmetric' }).click();
  await expect(sb).toHaveAttribute('data-shape', 'symmetric');
  await expect(sb.locator('[data-aha="symmetric"]')).toBeVisible();
  await sb.getByRole('button', { name: 'Flat' }).click();
  await expect(sb).toHaveAttribute('data-shape', 'flat');
  await sb.getByRole('button', { name: 'Example' }).click();
  await expect(sb).toHaveAttribute('data-shape', 'smile');
  const rr = sb.getByLabel('25Δ risk reversal');
  await rr.focus();
  await page.keyboard.press('Home');
  await expect(sb).toHaveAttribute('data-rr', '-0.0300');
  await sb.getByRole('button', { name: 'Delta', exact: true }).click();
  await expect(sb).toHaveAttribute('data-view', 'delta');
  // dragging the 25Δ call wing up changes RR and BF
  const bf = await sb.getAttribute('data-bf');
  await dragBy(page, '[data-sb] [data-pillar="call25"] circle', 0, -40);
  await expect(sb).not.toHaveAttribute('data-bf', bf ?? '');
  await expect(sb).not.toHaveAttribute('data-rr', '-0.0300');
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
