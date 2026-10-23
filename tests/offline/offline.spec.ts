/**
 * Smoke tests (MASTER_PROMPT §11) against the single offline file, opened over file:// with the
 * network blocked. Runs in Chromium (work PC) and WebKit (iPad portrait and landscape).
 */
import { readFileSync, statSync } from 'node:fs';
import type { Locator, Page } from '@playwright/test';
import { FILE, currentRoute, expect, expectNoHorizontalScroll, routes, test } from './fixtures';

const STORAGE = 'ff-progress-v1';

/** The event control that is visible in the current layout (overlay button or chip row). */
function eventButton(page: Page, id: string) {
  return page.locator(`[data-event="${id}"]:visible, [data-event-chip="${id}"]:visible`).first();
}

async function setRange(slider: Locator, value: number | string) {
  await slider.fill(String(value));
}

const progress = (page: Page) =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null'), STORAGE);

test.describe('the file', () => {
  test('is one self-contained file under 5 MB with a strict CSP', async () => {
    const size = statSync(FILE).size;
    expect(size).toBeLessThan(5 * 1024 * 1024);
    const html = readFileSync(FILE, 'utf8');
    const csp = /<meta http-equiv="Content-Security-Policy" content="([^"]+)">/.exec(html)?.[1];
    expect(csp).toBeTruthy();
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("connect-src 'none'");
    // no resource is loaded from outside the file
    expect(html).not.toMatch(/<(script|link|img|iframe)\b[^>]*\s(src|href)="(?!data:|#)/i);
    expect(html).not.toMatch(/url\(\s*["']?(https?:|\/\/|\/)/i);
  });
});

test.describe('smoke', () => {
  test('home loads with title, navigation, disclaimer and data date', async ({ page, open }) => {
    await open();
    await expect(page.locator('#main')).toHaveAttribute('data-route', '/');
    await expect(page).toHaveTitle(/Forward First/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'de');
    await expect(page.getByRole('navigation', { name: 'Hauptnavigation' })).toBeVisible();
    await expect(page.locator('footer')).toContainText(
      'Nur zu Bildungszwecken. Keine Anlageberatung.',
    );
    await expect(page.locator('footer [data-data-as-of]')).toHaveAttribute(
      'data-data-as-of',
      /^\d{4}-\d{2}-\d{2}$/,
    );
    await expect(page.locator('footer [data-data-as-of]')).toContainText('EZB');
    await expect(page.locator('#lernpfad [data-station]')).toHaveCount(9);
    await expectNoHorizontalScroll(page);
  });

  test('wow chart plays on its own', async ({ page, open }) => {
    await open();
    const steps = page.locator('[data-wow] [data-step]');
    await expect(steps).toHaveCount(4);
    await expect(steps.nth(0)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-wow]')).toHaveAttribute('data-playing', 'true');
    await expect(steps.nth(1)).toHaveAttribute('aria-pressed', 'true', { timeout: 10_000 });
  });

  test('wow chart can be controlled', async ({ page, open }) => {
    await open();
    const wow = page.locator('[data-wow]');
    await page.locator('[data-wow] [data-step="3"]').click();
    await expect(page.locator('[data-wow] [data-step="3"]')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(wow).toHaveAttribute('data-playing', 'false');
    const slider = page.locator('#wow-days');
    await expect(slider).toBeVisible();
    const marker = wow.locator('[data-tv]');
    const before = (await marker.textContent()) ?? '';
    await setRange(slider, (await slider.getAttribute('max')) ?? '365');
    await expect(marker).not.toHaveText(before);
    await expect(wow.locator('.field-value')).toHaveText(/Jahr|year/);
  });

  test('greeks lab reacts: delta and gamma follow the spot', async ({ page, open }) => {
    await open('/module/05-greeks/2/');
    await expect(page.locator('[data-num="m05.gamma"]').first()).toHaveText(/12\.36/);
    const lab = page.locator('[data-greekslab][data-mode="delta-gamma"]');
    await lab.scrollIntoViewIfNeeded();
    const summary = lab.locator('[data-summary]');
    const start = (await summary.textContent()) ?? '';
    await expect(lab.locator('[data-aha]')).toHaveAttribute('data-aha', 'gammaPeak');
    await setRange(lab.locator('#gl-delta-gamma-spot'), '0.84');
    await expect(summary).not.toHaveText(start);
    await expect(lab.locator('[data-money]')).toHaveAttribute('data-money', 'ITM');
    await expect(lab.locator('[data-aha]')).toHaveAttribute('data-aha', 'deltaHigh');
    await lab.locator('[data-reset]').click();
    await expect(lab.locator('#gl-delta-gamma-spot')).toHaveValue('0.8');
  });

  test('quiz flow: four questions, result, progress kept after reload', async ({ page, open }) => {
    await open('/module/05-greeks/quiz/');
    const card = page.locator('[data-quiz="quiz"]');
    await expect(card.locator('.qz-title')).toHaveText('Kurz geprüft · Frage 1 von 4');
    const picks = [0, 1, 1, 1]; // q4's correct answer is A → 3 of 4
    for (let i = 0; i < 4; i++) {
      await expect(card.locator('.qz-title')).toHaveText(`Kurz geprüft · Frage ${i + 1} von 4`);
      await card.locator(`[data-option="${picks[i]}"]`).click();
      await expect(card.getByRole('status').first()).toContainText(/Richtig\.|Nicht ganz\./);
      await card.locator('[data-next]').click();
    }
    await expect(card).toHaveAttribute('data-state', 'result');
    await expect(card.locator('.qz-score')).toHaveText('3 von 4 richtig');
    expect((await progress(page)).quiz['05-greeks']).toEqual({ best: 3, total: 4, passed: true });

    await page.reload();
    await page.locator('#main[data-route="/module/05-greeks/quiz/"]').waitFor();
    await expect(page.locator('[data-step="quiz"]')).toHaveAttribute('data-done', 'true');
    expect((await progress(page)).quiz['05-greeks'].best).toBe(3);
  });

  test('riskometer: pair switch updates value, title, chart and route', async ({ page, open }) => {
    await open('/riskometer/');
    const root = page.locator('[data-rk]');
    await expect(root).toHaveAttribute('data-pair', 'EUR/CHF');
    const vol = page.locator('[data-vol]');
    await expect(vol).toHaveText(/\d+\.\d\s%/);
    const before = await vol.textContent();
    await page.locator('[data-pair-btn="USDJPY"]').click();
    await expect(root).toHaveAttribute('data-pair', 'USD/JPY');
    await expect(page.locator('h1')).toHaveText('Wie nervös ist der Yen?');
    await expect(vol).not.toHaveText(before ?? '');
    await expect(page.locator('.rk-svg')).toHaveAttribute('aria-label', /USD\/JPY/);
    await expect.poll(() => currentRoute(page)).toBe('/riskometer/?pair=USDJPY');
    await expectNoHorizontalScroll(page);
  });

  test('riskometer: clicking an event updates the case card', async ({ page, open }) => {
    await open('/riskometer/');
    await expect(page.locator('[data-case-title]')).toHaveText('Frankenschock');
    const btn = eventButton(page, 'gfc-2008');
    await btn.click();
    await expect(btn).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-case-title]')).toHaveText('Finanzkrise');
    await expect(page.locator('[data-case-year]')).toHaveText('2008');
    await expect.poll(() => currentRoute(page)).toBe('/riskometer/?event=gfc-2008');
    // the module link of the case card stays inside the file
    const mod = page.locator('.rk-mod').first();
    await expect(mod).toHaveAttribute('href', /^#\/module\/05-greeks\/1\/$/);
    await mod.click();
    await expect(page.locator('#main')).toHaveAttribute('data-route', '/module/05-greeks/1/');
  });

  test('riskometer: deep link selects pair and event', async ({ page, open }) => {
    await open('/en/riskometer/?pair=EURUSD&event=ukraine-2022');
    await expect(page.locator('[data-rk]')).toHaveAttribute('data-pair', 'EUR/USD');
    await expect(page.locator('h1')).toHaveText('How nervous is the euro?');
    await expect(page.locator('[data-case-title]')).toHaveText('War in Ukraine');
  });

  test('language switch keeps the page', async ({ page, open }) => {
    await open('/module/05-greeks/2/');
    await page.locator('a[data-lang-switch="en"]').click();
    await expect(page.locator('#main')).toHaveAttribute('data-route', '/en/module/05-greeks/2/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Greeks: how the option price reacts' }),
    ).toBeVisible();
    await expect(page.locator('footer')).toContainText(
      'For educational purposes only. Not investment advice.',
    );
    await page.locator('a[data-lang-switch="de"]').click();
    await expect(page.locator('#main')).toHaveAttribute('data-route', '/module/05-greeks/2/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  });

  test('no horizontal scroll on home, module and riskometer', async ({ page, open }) => {
    for (const r of ['/', '/module/05-greeks/2/', '/riskometer/', '/en/glossary/']) {
      await open(r);
      await expect(page.locator('#main')).toHaveAttribute('data-route', r);
      await expectNoHorizontalScroll(page);
    }
  });
});

test('no horizontal scroll at laptop window widths', async ({ page, open }) => {
  for (const width of [1024, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    for (const r of ['/', '/module/05-greeks/2/', '/riskometer/', '/glossar/', '/ueber/']) {
      await open(r);
      await expect(page.locator('#main')).toHaveAttribute('data-route', r);
      await expectNoHorizontalScroll(page);
    }
  }
});

test.describe('hash routing', () => {
  test('station → module, pager, back button', async ({ page, open }) => {
    await open();
    await page.locator('#lernpfad [data-station]').first().click();
    await expect(page.locator('#main')).toHaveAttribute('data-route', '/module/01-spot/1/');
    expect(await currentRoute(page)).toBe('/module/01-spot/1/');
    await page.locator('.pager-next').click();
    await expect(page.locator('#main')).toHaveAttribute('data-route', '/module/01-spot/2/');
    await page.goBack();
    await expect(page.locator('#main')).toHaveAttribute('data-route', '/module/01-spot/1/');
    await page.goBack();
    await expect(page.locator('#main')).toHaveAttribute('data-route', '/');
  });

  test('routing works with reduced motion (no view transition)', async ({ page, open }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open();
    await page.locator('#lernpfad [data-station]').nth(4).click();
    await expect(page.locator('#main')).toHaveAttribute('data-route', '/module/05-greeks/1/');
  });

  test('quick successive route changes end on the last route without errors', async ({
    page,
    open,
  }) => {
    await open();
    await page.evaluate(() => {
      window.location.hash = '#/riskometer/';
      window.location.hash = '#/glossar/';
      window.location.hash = '#/module/05-greeks/3/';
    });
    await expect(page.locator('#main')).toHaveAttribute('data-route', '/module/05-greeks/3/');
    await expect(page.locator('[data-greekslab]').first()).toBeVisible();
  });

  test('a link to the open page adds no history entry; Back keeps the scroll position', async ({
    page,
    open,
  }) => {
    await open();
    const station = page.locator('#lernpfad [data-station]').first();
    await station.scrollIntoViewIfNeeded();
    const y = await page.evaluate(() => Math.round(window.scrollY));
    expect(y).toBeGreaterThan(100);
    await station.click();
    await expect(page.locator('#main')).toHaveAttribute('data-route', '/module/01-spot/1/');
    await page.locator('[data-step="1"]').click(); // the step that is already open
    await expect(page.locator('#main')).toHaveAttribute('data-route', '/module/01-spot/1/');
    await page.goBack();
    await expect(page.locator('#main')).toHaveAttribute('data-route', '/');
    await expect
      .poll(() => page.evaluate(() => Math.round(window.scrollY)))
      .toBeGreaterThan(y - 40);
  });

  test('in-page anchors highlight the target and move focus to it', async ({ page, open }) => {
    await open('/glossar/');
    const link = page.locator('.gl-letter-link').nth(5);
    const id = ((await link.getAttribute('href')) ?? '').slice(1);
    await link.click();
    await expect(page.locator(`[id="${id}"]`)).toHaveAttribute('data-target', '');
    await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe(id);
    expect(await currentRoute(page)).toBe('/glossar/');
  });

  test('short, redirect and unknown routes', async ({ page, open }) => {
    await open('/module/05-greeks/2');
    await expect(page.locator('#main')).toHaveAttribute('data-route', '/module/05-greeks/2/');
    await open('/module/05-greeks/');
    await expect(page.locator('#main')).toHaveAttribute('data-route', '/module/05-greeks/1/');
    await open('/gibt-es-nicht/');
    await expect(page.locator('#main')).toHaveAttribute('data-route', '/404/');
    await expect(page.locator('h1')).toBeVisible();
    await open('/en/gibt-es-nicht/');
    await expect(page.locator('#main')).toHaveAttribute('data-route', '/404/');
    await expect(page.locator('h1')).toBeVisible();
  });

  test('top navigation marks the current area', async ({ page, open }) => {
    await open('/riskometer/');
    const nav = page.getByRole('navigation', { name: 'Hauptnavigation' });
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
    await expect(nav.locator('[aria-current="page"]')).toHaveAttribute('href', '#/riskometer/');
  });
});

test.describe('touch', () => {
  test('a touch on a chart handle does not scroll the page, elsewhere it does', async ({
    page,
    open,
  }) => {
    await open('/module/07-barrier-binary/1/');
    await expect(page.locator('.m7-hitband, .m7-handle').first()).toBeAttached();
    const result = await page.evaluate(() => {
      if (!('ontouchstart' in window)) return 'no-touch';
      const handle = [...document.querySelectorAll('svg *')].find(
        (el) => (el as SVGElement).ownerSVGElement && getComputedStyle(el).touchAction === 'none',
      );
      const text = document.querySelector('#main p');
      if (!handle || !text) return 'missing';
      // WebKit does not allow `new Touch()` in scripts: a plain event of the same type with a
      // one-finger touch list reaches the same listener.
      const fire = (target: Element) => {
        const ev = new Event('touchstart', { bubbles: true, cancelable: true });
        Object.defineProperty(ev, 'touches', { value: [{ identifier: 1 }] });
        target.dispatchEvent(ev);
        target.dispatchEvent(new Event('touchend', { bubbles: true }));
        return ev.defaultPrevented;
      };
      return `${fire(handle)}/${fire(text)}`;
    });
    test.skip(result === 'no-touch', 'project without touch input');
    expect(result).toBe('true/false');
  });
});

test.describe('fallbacks', () => {
  test('blocked localStorage: the tool runs without saved progress', async ({ page, open }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get() {
          throw new DOMException('blocked', 'SecurityError');
        },
      });
    });
    await open();
    await expect(page.locator('#lernpfad [data-station]')).toHaveCount(9);
    await open('/module/05-greeks/quiz/');
    const card = page.locator('[data-quiz="quiz"]');
    await card.locator('[data-option="0"]').click();
    await expect(card.getByRole('status').first()).toContainText(/Richtig\.|Nicht ganz\./);
    await open('/module/05-greeks/2/');
    await page.locator('[data-section-end]').scrollIntoViewIfNeeded();
    await expect(page.locator('[data-greekslab]').first()).toBeVisible();
  });

  test('the data block stays in the page (a saved copy keeps working)', async ({ page, open }) => {
    await open();
    const len = await page.evaluate(() => document.getElementById('ff-data')?.textContent?.length);
    expect(len).toBeGreaterThan(100_000);
  });

  test('"Weiterlernen" moves on when a section is finished', async ({ page, open }) => {
    await open('/module/01-spot/1/');
    const cont = page.locator('a[data-continue]');
    await expect(cont).toHaveAttribute('href', '#/module/01-spot/1/');
    await page.locator('[data-section-end]').scrollIntoViewIfNeeded();
    await expect(page.locator('[data-section-done]')).toBeVisible();
    await expect(cont).toHaveAttribute('href', '#/module/01-spot/2/');
  });

  test('monte carlo prices on the main thread (no web worker)', async ({ page, open }) => {
    await open('/module/08-structured-products/2/');
    const ps = page.locator('[data-ps]');
    await ps.scrollIntoViewIfNeeded();
    const pv = ps.locator('[data-pv]');
    await expect(pv).toHaveAttribute('data-pv', 'idle');
    await setRange(ps.getByRole('slider', { name: 'Strike K', exact: true }), 0.79);
    await expect(pv).toHaveAttribute('data-pv', 'done', { timeout: 30_000 });
    await expect(pv.locator('.ps-pv-value')).toContainText('−');
  });
});

for (const lang of ['de', 'en'] as const) {
  test(`every packed page renders without errors (${lang})`, async ({ page, open }) => {
    test.setTimeout(240_000);
    const list = routes().filter((r) => (lang === 'en') === r.startsWith('/en/'));
    expect(list.length).toBeGreaterThan(40);
    await open(list[0]);
    for (const r of list) {
      await page.evaluate((route) => {
        window.location.hash = `#${route}`;
      }, r);
      const main = page.locator(`#main[data-route="${r}"]`);
      await main.waitFor({ state: 'attached' });
      const report = await page.evaluate(() => {
        const islands = [...document.querySelectorAll('#main astro-island')];
        return {
          text: document.getElementById('main')?.textContent?.trim().length ?? 0,
          empty: islands
            .filter((i) => i.childElementCount === 0)
            .map((i) => i.getAttribute('data-ff-island')),
          coming: document.querySelectorAll('#main [data-coming]').length,
          leaks: [...document.querySelectorAll('#main a[href^="/"]')].map((a) =>
            a.getAttribute('href'),
          ),
          overflow: document.documentElement.scrollWidth - window.innerWidth,
        };
      });
      expect.soft(report.text, `${r}: content`).toBeGreaterThan(100);
      expect.soft(report.empty, `${r}: islands without output`).toEqual([]);
      expect.soft(report.coming, `${r}: placeholders`).toBe(0);
      expect.soft(report.leaks, `${r}: links leaving the file`).toEqual([]);
      expect.soft(report.overflow, `${r}: horizontal scroll`).toBeLessThanOrEqual(0);
    }
  });
}
