/**
 * No lag while dragging (DECISIONS D-42). Values that follow a slider are drawn in the same frame:
 * every dot stays on its line, every parity bar has the width it is told to have, and nothing
 * moves on after the input stops. Recorded frame by frame (requestAnimationFrame) while a slider
 * is dragged in small mouse steps and while an arrow key is held.
 */
import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures';

interface Sample {
  t: number;
  /** distance dot ↔ line (px) per dot key */
  dots: Record<string, number>;
  /** |rendered width − style width| (px) per bar segment */
  bars: number[];
  /** a fingerprint of everything that can move (positions, widths) */
  state: string;
}

/** Installs a frame recorder in the page; samples every animation frame until stopped. */
async function startRecorder(page: Page, root: string) {
  await page.evaluate((sel) => {
    const yAt = (d: string, x: number): number | null => {
      const pts: [number, number][] = [];
      let cx = 0;
      let cy = 0;
      for (const m of d.matchAll(/([MLHV])([^MLHV]*)/g)) {
        const nums = m[2]!.split(/[ ,]+/).filter(Boolean).map(Number);
        if (m[1] === 'H') cx = nums[0]!;
        else if (m[1] === 'V') cy = nums[0]!;
        else [cx, cy] = [nums[0]!, nums[1]!];
        pts.push([cx, cy]);
      }
      for (let i = 1; i < pts.length; i++) {
        const [x0, y0] = pts[i - 1]!;
        const [x1, y1] = pts[i]!;
        if ((x >= x0 && x <= x1) || (x >= x1 && x <= x0)) {
          return x1 === x0 ? y0 : y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
        }
      }
      return null;
    };
    const host = document.querySelector(sel)!;
    const rec = { frames: [] as unknown[], on: true };
    (window as unknown as { __rec: typeof rec }).__rec = rec;
    const sample = () => {
      const dots: Record<string, number> = {};
      const parts: string[] = [];
      for (const svg of host.querySelectorAll('svg')) {
        const vb = svg.viewBox.baseVal;
        const r = svg.getBoundingClientRect();
        if (!vb || !vb.width || !r.width) continue;
        const scale = r.width / vb.width;
        for (const dot of svg.querySelectorAll('[data-dot]')) {
          const key = dot.getAttribute('data-dot')!;
          const line = svg.querySelector(`[data-line="${key}"]`);
          const cxv = Number(dot.getAttribute('cx'));
          const cyv = Number(dot.getAttribute('cy'));
          parts.push(`${key}:${cxv.toFixed(2)},${cyv.toFixed(2)}`);
          if (!line) continue;
          const y = yAt(line.getAttribute('d') ?? '', cxv);
          if (y !== null) dots[key] = Math.max(dots[key] ?? 0, Math.abs(cyv - y) * scale);
        }
      }
      const bars: number[] = [];
      for (const span of host.querySelectorAll<HTMLElement>('.m7-bar > span')) {
        const pw = span.parentElement!.getBoundingClientRect().width;
        const w = span.getBoundingClientRect().width;
        const pct = Number.parseFloat(span.style.width);
        bars.push(Math.abs(w - (pw * pct) / 100));
        parts.push(`bar:${w.toFixed(2)}`);
      }
      return { t: performance.now(), dots, bars, state: parts.join('|') };
    };
    const loop = () => {
      if (!rec.on) return;
      rec.frames.push(sample());
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }, root);
}

async function stopRecorder(page: Page): Promise<Sample[]> {
  return page.evaluate(() => {
    const rec = (window as unknown as { __rec: { frames: Sample[]; on: boolean } }).__rec;
    rec.on = false;
    return rec.frames;
  });
}

/** Drags the range input's thumb in small mouse steps (2 px), 40 steps. */
async function dragSlider(page: Page, slider: Locator, direction: 1 | -1 = 1) {
  await slider.scrollIntoViewIfNeeded();
  const box = (await slider.boundingBox())!;
  const value = Number(await slider.inputValue());
  const min = Number(await slider.getAttribute('min'));
  const max = Number(await slider.getAttribute('max'));
  const x0 = box.x + ((value - min) / (max - min)) * box.width;
  const y = box.y + box.height / 2;
  await page.mouse.move(x0, y);
  await page.mouse.down();
  for (let i = 1; i <= 40; i++) {
    await page.mouse.move(x0 + direction * 2 * i, y);
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
}

/** Holds an arrow key: 30 key presses about 33 ms apart (typical auto-repeat). */
async function holdArrow(page: Page, slider: Locator, key: 'ArrowRight' | 'ArrowLeft') {
  await slider.focus();
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press(key);
    await page.waitForTimeout(33);
  }
}

/** Checks the recorded frames: on the line, true widths, and still after release. */
function check(frames: Sample[], releasedAt: number, expectDots: string[]) {
  expect(frames.length).toBeGreaterThan(20);
  for (const f of frames) {
    for (const [k, d] of Object.entries(f.dots)) {
      expect(d, `dot ${k} off its line by ${d.toFixed(2)} px`).toBeLessThanOrEqual(1);
    }
    for (const b of f.bars) {
      expect(b, `bar width off by ${b.toFixed(2)} px`).toBeLessThanOrEqual(1);
    }
  }
  for (const k of expectDots) {
    expect(
      frames.some((f) => k in f.dots),
      `dot ${k} measured`,
    ).toBe(true);
  }
  // nothing moves after the input stopped (one frame of grace for the last render)
  const after = frames.filter((f) => f.t > releasedAt + 50);
  expect(after.length).toBeGreaterThan(5);
  expect(new Set(after.map((f) => f.state)).size, 'moves after release').toBe(1);
  // and it did move during the input
  expect(new Set(frames.map((f) => f.state)).size).toBeGreaterThan(5);
}

async function run(
  page: Page,
  root: string,
  slider: Locator,
  how: 'mouse' | 'key',
  expectDots: string[],
  direction: 1 | -1 = 1,
) {
  await startRecorder(page, root);
  if (how === 'mouse') await dragSlider(page, slider, direction);
  else await holdArrow(page, slider, direction === 1 ? 'ArrowRight' : 'ArrowLeft');
  const releasedAt = await page.evaluate(() => performance.now());
  await page.waitForTimeout(500);
  check(await stopRecorder(page), releasedAt, expectDots);
}

test.describe('no lag while dragging', () => {
  for (const how of ['mouse', 'key'] as const) {
    test(`option or forward: dots stay on their lines (${how})`, async ({ page, open }) => {
      await open('/module/04-vanilla-options/1/');
      const slider = page.locator('input[id^="ovf-"]').first();
      await run(page, '[data-ovf], .ovf', slider, how, ['unhedged', 'forward', 'option'], -1);
    });

    test(`hedge shaper: the structure dot stays on its curve (${how})`, async ({ page, open }) => {
      await open('/module/06-combos-smile/1/');
      const slider = page.locator('input[id^="hs-"]').first();
      await run(page, '.hs', slider, how, ['structure', 'unhedged'], -1);
    });

    test(`hedge compare: every dot stays on its line (${how})`, async ({ page, open }) => {
      await open('/module/09-hedge-alpha-yield/2/');
      const slider = page.locator('input[id^="hc-st-"]').first();
      await run(page, '.hc', slider, how, ['forward', 'unhedged']);
    });

    test(`barrier lab: parity bars follow the spot (${how})`, async ({ page, open }) => {
      await open('/module/07-barrier-binary/2/');
      await run(page, '[data-parity]', page.locator('#bl-spot'), how, []);
    });

    test(`barrier lab: parity bars follow the time to expiry (${how})`, async ({ page, open }) => {
      await open('/module/07-barrier-binary/2/');
      const days = page.locator('#bl-days');
      // short maturities, where one step changes most
      await days.fill('10');
      await run(page, '[data-parity]', days, how, []);
    });
  }

  test('barrier lab: KO share of the bar = KO / (KO + KI); zero KO is zero wide', async ({
    page,
    open,
  }) => {
    await open('/module/07-barrier-binary/2/');
    const parity = page.locator('[data-parity]');
    const share = async () =>
      parity.evaluate((el) => {
        const ko = el.querySelector<HTMLElement>('.m7-bar .is-ko')!.getBoundingClientRect().width;
        const ki = el.querySelector<HTMLElement>('.m7-bar .is-ki')!.getBoundingClientRect().width;
        const nums = (el.querySelector('.m7-note')!.textContent ?? '')
          .replace(/’/g, '')
          .match(/-?[0-9]+(?:\.[0-9]+)?/g)!
          .map(Number);
        return { rendered: ko / (ko + ki), numbers: nums[0]! / (nums[0]! + nums[1]!), ko };
      });
    for (const spot of ['0.79', '0.8', '0.81']) {
      await page.locator('#bl-spot').fill(spot);
      const s = await share();
      expect(Math.abs(s.rendered - s.numbers)).toBeLessThan(0.01);
    }
    // spot beyond the barrier: knocked out, the KO part has no width at all
    await page.locator('#bl-spot').fill('0.86');
    await expect.poll(async () => (await share()).ko).toBeLessThan(0.5);
  });
});
