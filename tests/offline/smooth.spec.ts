/**
 * Animation rules (DECISIONS D-42, supplement points 9 to 11), measured on the rendered geometry
 * frame by frame (tests/offline/frames.ts):
 * - dots that sit on a line stay on it (1 px) while a slider is dragged with the mouse or moved
 *   with a held arrow key, and the dots are really measured,
 * - a single change (toggle, preset, reset) still animates; a quick series of the same changes
 *   runs without lag: from the second frame after the last input on nothing moves,
 * - barrier lab: the shown KO + KI equals the shown vanilla and the KO share of the bar is
 *   KO / (KO + KI), both checked against labNumbers from the calculation core.
 * Every slider of every figure is covered by tests/offline/sliders.spec.ts.
 */
import type { Locator, Page } from '@playwright/test';
import {
  defaultLabState,
  labNumbers,
  parityShown,
  type LabState,
} from '../../src/lib/m07/barrierlab';
import { PIP } from '../../src/lib/m07/config';
import { expect, test } from './fixtures';
import {
  changeSpan,
  clickSeries,
  distinctStates,
  dragSlider,
  expectOnTheLines,
  expectSettledWithinTwoFrames,
  holdArrow,
  startRecorder,
  stopRecorder,
  waitForFramesAfterInput,
} from './frames';

/** Records while `act` runs, then waits `rest` ms and for enough frames after the last input. */
async function record(page: Page, inside: Locator, act: () => Promise<void>, rest = 500) {
  await page.waitForTimeout(600); // start from rest
  // per-element fingerprints, so a failure names what still moves (few recordings here)
  await startRecorder(inside, true);
  await act();
  await page.waitForTimeout(rest);
  await waitForFramesAfterInput(page, 8);
  return stopRecorder(page);
}

/** A single change animates: in-between frames over most of the 300 ms, not a jump. */
function expectAnimated(rec: Awaited<ReturnType<typeof record>>, what: string) {
  expect(distinctStates(rec), `${what}: in-between frames`).toBeGreaterThanOrEqual(3);
  expect(changeSpan(rec), `${what}: changes over time (ms)`).toBeGreaterThanOrEqual(150);
}

test.describe('dots stay on their lines while a slider moves', () => {
  const CASES = [
    {
      name: 'option or forward',
      route: '/module/04-vanilla-options/1/',
      slider: 'input[id^="ovf-"]',
      dots: ['unhedged', 'forward', 'option'],
    },
    {
      name: 'hedge shaper',
      route: '/module/06-combos-smile/1/',
      slider: 'input[id^="hs-"]',
      dots: ['structure', 'unhedged'],
    },
    {
      name: 'hedge compare',
      route: '/module/09-hedge-alpha-yield/2/',
      slider: 'input[id^="hc-st-"]',
      dots: ['forward', 'unhedged'],
    },
  ];
  for (const c of CASES) {
    for (const how of ['mouse', 'key'] as const) {
      test(`${c.name} (${how})`, async ({ page, open }) => {
        await open(c.route);
        const slider = page.locator(c.slider).first();
        await slider.scrollIntoViewIfNeeded();
        const rec = await record(page, slider, () =>
          how === 'mouse' ? dragSlider(page, slider, 40) : holdArrow(page, slider, 30),
        );
        for (const k of c.dots) {
          expect(
            rec.frames.some((f) => k in f.dots),
            `dot ${k} measured`,
          ).toBe(true);
        }
        expectOnTheLines(rec, c.name);
        expectSettledWithinTwoFrames(rec, c.name);
        expect(distinctStates(rec)).toBeGreaterThan(5);
      });
    }
  }
});

test('touch (Chromium over CDP): dragging a chart handle, dots stay on their lines', async ({
  page,
  open,
  browserName,
}) => {
  // Native range sliders cannot be driven by touch in automation; the chart handles can, in
  // Chromium through the DevTools protocol. WebKit runs the touch tests in offline.spec.ts.
  test.skip(browserName !== 'chromium', 'touch over CDP only in Chromium');
  // touch input before the file loads, so its touch helper for SVG handles is installed
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
  await open('/module/09-hedge-alpha-yield/2/');
  const handle = page.locator('.hc-handle').first();
  await handle.scrollIntoViewIfNeeded();
  const box = (await handle.boundingBox())!;
  const x0 = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', x: number) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: type === 'touchEnd' ? [] : [{ x, y }],
    });
  const rec = await record(page, handle, async () => {
    await touch('touchStart', x0);
    for (let i = 1; i <= 30; i++) {
      await touch('touchMove', x0 - 3 * i);
      await page.waitForTimeout(16);
    }
    await touch('touchEnd', x0 - 90);
  });
  for (const k of ['forward', 'unhedged']) {
    expect(
      rec.frames.some((f) => k in f.dots),
      `dot ${k} measured`,
    ).toBe(true);
  }
  expect(distinctStates(rec)).toBeGreaterThan(5);
  expectOnTheLines(rec, 'hedge compare touch');
  expectSettledWithinTwoFrames(rec, 'hedge compare touch');
});

test.describe('a single change animates, a quick series does not lag', () => {
  test('hedge shaper: one toggle morphs the curve, the dot stays on it', async ({ page, open }) => {
    await open('/module/06-combos-smile/1/');
    const toggle = page.locator('[data-block="sellCall"]');
    await toggle.scrollIntoViewIfNeeded();
    const rec = await record(page, toggle, () => toggle.click());
    // the curve glides instead of jumping
    expectAnimated(rec, 'hedge shaper toggle');
    expectOnTheLines(rec, 'hedge shaper toggle');
  });

  test('hedge shaper: five quick toggles end without lag', async ({ page, open }) => {
    await open('/module/06-combos-smile/1/');
    const toggle = page.locator('[data-block="sellCall"]');
    await toggle.scrollIntoViewIfNeeded();
    const rec = await record(page, toggle, () => clickSeries(page, Array(5).fill(toggle)));
    expectOnTheLines(rec, 'hedge shaper toggles');
    expectSettledWithinTwoFrames(rec, 'hedge shaper toggles');
  });

  test('smile builder: one preset morphs the smile; quick presets end without lag', async ({
    page,
    open,
  }) => {
    await open('/module/06-combos-smile/4/');
    const group = page.getByRole('group', { name: 'Vorlagen' });
    await group.scrollIntoViewIfNeeded();
    const flat = group.getByRole('button', { name: 'Flach' });
    const example = group.getByRole('button', { name: 'Beispiel' });
    const one = await record(page, flat, () => flat.click());
    expectAnimated(one, 'smile builder preset');
    const series = await record(page, flat, () =>
      clickSeries(page, [example, flat, example, flat], 60),
    );
    expectSettledWithinTwoFrames(series, 'smile builder presets');
  });

  test('barrier lab: reset counts back; quick monitoring toggles end without lag', async ({
    page,
    open,
  }) => {
    await open('/module/07-barrier-binary/2/');
    const lab = page.locator('[data-barrierlab]');
    await page.locator('#bl-spot').fill('0.81');
    const reset = lab.locator('[data-reset]');
    await reset.scrollIntoViewIfNeeded();
    const one = await record(page, reset, () => reset.click());
    expectAnimated(one, 'barrier lab reset');

    const daily = lab.getByRole('button', { name: 'Täglich (BGK)' });
    const cont = lab.getByRole('button', { name: 'Stetig' });
    const series = await record(page, daily, () =>
      clickSeries(page, [daily, cont, daily, cont, daily]),
    );
    expectOnTheLines(series, 'barrier lab toggles');
    expectSettledWithinTwoFrames(series, 'barrier lab toggles');
  });
});

/** Reads the shown parity (pips) and the rendered bar widths of the barrier lab. */
async function shownParity(page: Page) {
  return page.locator('[data-parity]').evaluate((el) => {
    const w = (sel: string) => el.querySelector<HTMLElement>(sel)!.getBoundingClientRect().width;
    const nums = (el.querySelector('.m7-note')!.textContent ?? '')
      .replace(/’/g, '')
      .replace(/−/g, '-')
      .match(/-?[0-9]+(?:\.[0-9]+)?/g)!
      .map(Number);
    return {
      ko: nums[0]!,
      ki: nums[1]!,
      sum: nums[2]!,
      vanilla: nums[3]!,
      koW: w('.m7-bar .is-ko'),
      kiW: w('.m7-bar .is-ki'),
      vanW: w('.m7-bar .is-van'),
    };
  });
}

test.describe('barrier lab parity against the calculation core', () => {
  const STATES: Partial<LabState>[] = [
    {},
    { spot: 0.79 },
    { spot: 0.81 },
    { spot: 0.83, days: 14 },
    { barrier: 0.84, days: 200 },
    { spot: 0.775, barrier: 0.82, days: 1 },
  ];
  for (const change of STATES) {
    test(`shown KO + KI = vanilla, bar share = KO / (KO + KI): ${JSON.stringify(change)}`, async ({
      page,
      open,
    }) => {
      await open('/module/07-barrier-binary/2/');
      const s: LabState = { ...defaultLabState(), ...change };
      if (change.barrier !== undefined) await page.locator('#bl-barrier').fill(String(s.barrier));
      if (change.days !== undefined) await page.locator('#bl-days').fill(String(s.days));
      if (change.spot !== undefined) await page.locator('#bl-spot').fill(String(s.spot));
      const n = labNumbers(s);
      const want = parityShown(n.ko / PIP, n.vanilla / PIP);
      // the numbers count to their new value after a single change; wait until they arrive
      await expect.poll(async () => (await shownParity(page)).vanilla).toBe(want.vanilla);
      await expect.poll(async () => (await shownParity(page)).ko).toBe(want.ko);
      const p = await shownParity(page);

      // shown: KO + KI = sum = vanilla, each from the core
      expect(p.ki).toBe(want.ki);
      expect(Math.round((p.ko + p.ki) * 10)).toBe(Math.round(p.vanilla * 10));
      expect(p.sum).toBe(p.vanilla);
      expect(Math.abs(n.ko + n.ki - n.vanilla)).toBeLessThan(1e-12);

      // rendered: the KO share of the bar and the bar length against the vanilla bar
      const total = p.koW + p.kiW;
      expect(Math.abs(p.koW - (n.ko / (n.ko + n.ki)) * total)).toBeLessThanOrEqual(1);
      expect(Math.abs(total - p.vanW)).toBeLessThanOrEqual(1);
    });
  }

  test('beyond the barrier the KO part has no width', async ({ page, open }) => {
    await open('/module/07-barrier-binary/2/');
    await page.locator('#bl-spot').fill('0.86');
    await expect.poll(async () => (await shownParity(page)).koW).toBeLessThan(0.5);
    expect(labNumbers({ ...defaultLabState(), spot: 0.86 }).ko).toBe(0);
  });
});
