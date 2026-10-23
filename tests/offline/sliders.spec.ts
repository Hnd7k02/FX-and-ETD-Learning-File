/**
 * Every slider of every interactive figure (supplement points 9 and 11, DECISIONS D-42): dragged
 * with the mouse in small steps and moved with a held arrow key, recorded frame by frame on the
 * rendered geometry. From the second frame after the last input on nothing in the figure moves
 * any more; dots stay on their lines and parity bars are as wide as they should be in every
 * frame. One test per page; it lists every slider that fails. A running playback is paused
 * first (it is an animation of its own), and a Monte Carlo value that is computed after the input
 * counts like an input when it arrives.
 */
import { expect, pageHtml, test } from './fixtures';
import {
  dragSlider,
  holdArrow,
  movingParts,
  pausePlayback,
  settledAt,
  startRecorder,
  stopRecorder,
  waitForResults,
  type Recording,
} from './frames';

/** German pages with an interactive figure other than the quiz (the English ones are the same islands). */
const PAGES = Object.entries(pageHtml())
  .filter(([route]) => !route.startsWith('/en/'))
  .filter(([, h]) =>
    [...h.matchAll(/data-ff-island="([A-Za-z]+)"/g)].some(
      (m) => !['Quiz', 'GlossarySearch', 'ResetProgress'].includes(m[1]!),
    ),
  )
  .map(([route]) => route)
  .sort();

/** What went wrong in one recording, or null. */
function problems(rec: Recording): string | null {
  const out: string[] = [];
  const { after, index } = settledAt(rec);
  if (after.length < 6) out.push(`only ${after.length} frames after the last input`);
  else if (index > 1) out.push(`still moving ${index} frames after the last input`);
  let dot = 0;
  let bar = 0;
  for (const f of rec.frames) {
    for (const d of Object.values(f.dots)) dot = Math.max(dot, d);
    for (const b of f.bars) bar = Math.max(bar, b);
  }
  if (dot > 1) out.push(`a dot ${dot.toFixed(2)} px off its line`);
  if (bar > 1) out.push(`a bar ${bar.toFixed(2)} px off its width`);
  return out.length ? out.join('; ') : null;
}

test.describe('every slider: no lag, still after two frames', () => {
  for (const route of PAGES) {
    test(route, async ({ page, open }) => {
      test.setTimeout(240_000);
      await open(route);
      const sliders = page.locator('[data-ff-island] input[type="range"]');
      // islands mount after the route; wait until every figure on the page is there
      await page.waitForTimeout(300);
      const count = await sliders.count();
      const failures: string[] = [];
      let tested = 0;
      for (let i = 0; i < count; i++) {
        const slider = sliders.nth(i);
        if (!(await slider.isVisible()) || (await slider.isDisabled())) continue;
        const name =
          (await slider.getAttribute('id')) ?? (await slider.getAttribute('aria-label')) ?? `#${i}`;
        await slider.scrollIntoViewIfNeeded();
        await page.waitForTimeout(300); // a playback starts when its figure comes into view
        await pausePlayback(slider);
        for (const how of ['mouse', 'key'] as const) {
          await page.waitForTimeout(400); // let a previous animation end
          await startRecorder(slider);
          if (how === 'mouse') await dragSlider(page, slider);
          else await holdArrow(page, slider);
          await waitForResults(slider);
          await page.waitForTimeout(350);
          const rec = await stopRecorder(page);
          const moved = new Set(rec.frames.map((f) => f.state)).size > 1;
          const p = problems(rec);
          if (p) failures.push(`${name} (${how}): ${p} ${movingParts(rec)}`.trim());
          if (!moved) failures.push(`${name} (${how}): nothing changed`);
        }
        tested++;
      }
      test.info().annotations.push({ type: 'sliders', description: String(tested) });
      expect(failures, `${tested} sliders on ${route}`).toEqual([]);
    });
  }
});
