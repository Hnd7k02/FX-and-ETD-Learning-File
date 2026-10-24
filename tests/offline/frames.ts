/**
 * Frame recorder for the slider and animation tests (DECISIONS D-42, supplement points 9 to 11).
 * Samples one island on every animation frame and measures what is rendered
 * (getBoundingClientRect, getScreenCTM), not the attributes:
 * - a fingerprint of everything that can move: the boxes of the SVG shapes and of every element
 *   with an inline size or position, plus the text,
 * - for every dot with data-dot="k": its distance in px from the line data-line="k" at the
 *   dot's rendered x,
 * - for every parity bar segment: rendered width against the width it is told to have.
 * It also stamps the time of every value input (input, change, pointer and touch end, keyup) and of every
 * Monte Carlo result that arrives (data-pv leaves "busy"), so a test can check that nothing moves
 * from the second frame after the last input on. Elements with an endless CSS animation (a
 * decorative pulse, switched off under reduced motion) are left out; an SVG group counts by its
 * own rendered transform (getScreenCTM), not by the box of its children.
 */
import type { Locator, Page } from '@playwright/test';
import { expect } from './fixtures';

export interface Frame {
  t: number;
  /** distance dot ↔ line (px) per dot key */
  dots: Record<string, number>;
  /** |rendered width − requested width| (px) per bar segment */
  bars: number[];
  /** fingerprint of everything that can move */
  state: string;
  /** with FF_DEBUG_FRAMES=1: the fingerprint per element (for the failure message) */
  parts?: Record<string, string>;
}

export interface Recording {
  frames: Frame[];
  /** performance.now() of the last value input, or -1 */
  lastInput: number;
}

/** Starts recording the island that contains `inside`. */
export async function startRecorder(
  inside: Locator,
  debug = process.env.FF_DEBUG_FRAMES === '1',
): Promise<void> {
  await inside.evaluate((el, debug) => {
    const root = (el.closest('[data-ff-island]') ?? el) as HTMLElement;
    const SHAPES =
      'svg circle, svg path, svg line, svg rect, svg text, svg polyline, svg polygon, ' +
      '[style*="width"], [style*="height"], [style*="left"], [style*="transform"]';

    /** Screen points of a line: exact for M/L/H/V paths, else sampled along the path. */
    const screenPoints = (path: SVGPathElement): [number, number][] => {
      const m = path.getScreenCTM();
      if (!m) return [];
      const map = (x: number, y: number): [number, number] => [
        m.a * x + m.c * y + m.e,
        m.b * x + m.d * y + m.f,
      ];
      const d = path.getAttribute('d') ?? '';
      if (/^[\sMLHV0-9.,eE+-]*$/.test(d)) {
        const pts: [number, number][] = [];
        let cx = 0;
        let cy = 0;
        for (const c of d.matchAll(/([MLHV])([^MLHV]*)/g)) {
          const n = c[2]!.split(/[ ,]+/).filter(Boolean).map(Number);
          if (c[1] === 'H') cx = n[0]!;
          else if (c[1] === 'V') cy = n[0]!;
          else [cx, cy] = [n[0]!, n[1]!];
          pts.push(map(cx, cy));
        }
        return pts;
      }
      const len = path.getTotalLength();
      const out: [number, number][] = [];
      for (let i = 0; i <= 600; i++) {
        const p = path.getPointAtLength((len * i) / 600);
        out.push(map(p.x, p.y));
      }
      return out;
    };
    const yAt = (pts: [number, number][], x: number): number | null => {
      for (let i = 1; i < pts.length; i++) {
        const [x0, y0] = pts[i - 1]!;
        const [x1, y1] = pts[i]!;
        if ((x >= x0 && x <= x1) || (x >= x1 && x <= x0)) {
          return x1 === x0 ? y0 : y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
        }
      }
      return null;
    };

    const rec = { frames: [] as unknown[], lastInput: -1, on: true };
    (window as unknown as { __rec: typeof rec }).__rec = rec;
    const stamp = () => {
      if (rec.on) rec.lastInput = performance.now();
    };
    const INPUTS = ['input', 'change', 'click', 'pointerup', 'pointercancel', 'keyup', 'touchend'];
    for (const type of INPUTS) {
      root.addEventListener(type, stamp, true);
    }
    // a Monte Carlo result counts like an input: the figure may change once when it arrives
    new MutationObserver((ms) => {
      if (ms.some((m) => (m.target as Element).getAttribute('data-pv') !== 'busy')) stamp();
    }).observe(root, { subtree: true, attributes: true, attributeFilter: ['data-pv'] });

    // Elements with an endless animation (a flowing dash, a pulse) are not measured. Found in
    // every frame: an element that appears with an input is left out from its first frame on,
    // instead of dropping out of the fingerprint a few frames later, which looked like movement.
    let endless = new Set<Element>();
    const findEndless = () => {
      endless = new Set(
        root
          .getAnimations({ subtree: true })
          .filter((a) => a.effect?.getTiming().iterations === Infinity)
          .map((a) => (a.effect as KeyframeEffect).target)
          .filter((t): t is Element => t instanceof Element),
      );
    };
    const sample = () => {
      findEndless();
      const parts: string[] = [];
      const keyed: Record<string, string> = {};
      const seen: Record<string, number> = {};
      const add = (e: Element, v: string) => {
        parts.push(v);
        if (!debug) return;
        const base = `${e.tagName}.${(e.getAttribute('class') ?? '').trim().replace(/\s+/g, '.')}`;
        keyed[`${base}#${(seen[base] = (seen[base] ?? 0) + 1)}`] = v;
      };
      for (const e of root.querySelectorAll(SHAPES + ', svg g')) {
        if (endless.has(e)) continue;
        if (e.tagName === 'g') {
          const m = (e as SVGGElement).getScreenCTM();
          if (m) add(e, `g:${[m.a, m.b, m.c, m.d, m.e, m.f].map((v) => v.toFixed(2)).join(',')}`);
          continue;
        }
        const r = e.getBoundingClientRect();
        add(
          e,
          `${e.tagName}:${r.x.toFixed(1)},${r.y.toFixed(1)},${r.width.toFixed(1)},${r.height.toFixed(1)}`,
        );
      }
      parts.push(root.textContent ?? '');
      if (debug) {
        for (const e of root.querySelectorAll('*')) {
          const own = [...e.childNodes]
            .filter((c) => c.nodeType === 3)
            .map((c) => c.textContent)
            .join('')
            .trim();
          if (own) add(e, `text:${own.slice(0, 40)}`);
        }
      }
      const dots: Record<string, number> = {};
      for (const dot of root.querySelectorAll<SVGGraphicsElement>('[data-dot]')) {
        const key = dot.getAttribute('data-dot')!;
        const svg = dot.ownerSVGElement;
        const line = svg?.querySelector<SVGPathElement>(`path[data-line="${key}"]`);
        const r = dot.getBoundingClientRect();
        if (!line || !r.width) continue;
        const y = yAt(screenPoints(line), r.x + r.width / 2);
        if (y !== null) {
          dots[key] = Math.max(dots[key] ?? 0, Math.abs(r.y + r.height / 2 - y));
        }
      }
      const bars: number[] = [];
      for (const span of root.querySelectorAll<HTMLElement>('.m7-bar > span')) {
        const pw = span.parentElement!.getBoundingClientRect().width;
        const w = span.getBoundingClientRect().width;
        bars.push(Math.abs(w - (pw * Number.parseFloat(span.style.width)) / 100));
      }
      return {
        t: performance.now(),
        dots,
        bars,
        state: parts.join('|'),
        ...(debug ? { parts: keyed } : {}),
      };
    };
    const loop = () => {
      if (!rec.on) return;
      rec.frames.push(sample());
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }, debug);
}

/** With FF_DEBUG_FRAMES=1: the elements that still change after the second frame. */
export function movingParts(rec: Recording): string {
  const { after } = settledAt(rec);
  const fin = after[after.length - 1]?.parts;
  if (!fin) return '';
  const moving = new Map<string, string>();
  for (const f of after.slice(1)) {
    for (const [k, v] of Object.entries(f.parts ?? {})) {
      if (fin[k] !== v && !moving.has(k)) moving.set(k, `${v} -> ${fin[k]}`);
    }
  }
  return [...moving]
    .slice(0, 5)
    .map(([k, v]) => `${k} ${v}`)
    .join(' ;; ');
}

export async function stopRecorder(page: Page): Promise<Recording> {
  return page.evaluate(() => {
    const rec = (window as unknown as { __rec: Recording & { on: boolean } }).__rec;
    rec.on = false;
    return { frames: rec.frames, lastInput: rec.lastInput };
  });
}

/** Index of the first frame after the last input from which on nothing changes, or -1. */
export function settledAt(rec: Recording): { after: Frame[]; index: number } {
  const after = rec.frames.filter((f) => f.t > rec.lastInput);
  const last = after[after.length - 1]?.state;
  let index = after.length - 1;
  while (index > 0 && after[index - 1]!.state === last) index--;
  return { after, index: after.length ? index : -1 };
}

/** At the latest two frames after the last input nothing moves any more (point 11). */
export function expectSettledWithinTwoFrames(rec: Recording, what: string): void {
  const { after, index } = settledAt(rec);
  expect(after.length, `${what}: frames after the last input`).toBeGreaterThan(5);
  // after[0] is the first frame after the input, after[1] the second
  expect(
    index,
    `${what}: still moving ${index} frames after the last input ${movingParts(rec)}`,
  ).toBeLessThanOrEqual(1);
}

/** Every dot on its line and every bar as wide as it should be, in every frame (1 px). */
export function expectOnTheLines(rec: Recording, what: string): void {
  for (const f of rec.frames) {
    for (const [k, d] of Object.entries(f.dots)) {
      expect(d, `${what}: dot ${k} off its line by ${d.toFixed(2)} px`).toBeLessThanOrEqual(1);
    }
    for (const b of f.bars) {
      expect(b, `${what}: bar width off by ${b.toFixed(2)} px`).toBeLessThanOrEqual(1);
    }
  }
}

/** Number of different states in the recording. */
export const distinctStates = (rec: Recording) => new Set(rec.frames.map((f) => f.state)).size;

/**
 * Milliseconds between the first and the last frame that differs from the frame before. A jump
 * changes within one or two frames; an animation keeps changing for most of its duration, at any
 * frame rate (the WebKit runners in CI draw far fewer frames per second than a desktop).
 */
export function changeSpan(rec: Recording): number {
  const t: number[] = [];
  for (let i = 1; i < rec.frames.length; i++) {
    if (rec.frames[i]!.state !== rec.frames[i - 1]!.state) t.push(rec.frames[i]!.t);
  }
  return t.length ? t[t.length - 1]! - t[0]! : 0;
}

/**
 * Waits until the recorder holds at least `n` frames after the last input, so the stillness check
 * has frames to look at also where a busy main thread (Monte Carlo in chunks) draws few of them.
 */
export async function waitForFramesAfterInput(page: Page, n = 8, timeout = 20_000): Promise<void> {
  await page.waitForFunction(
    (k) => {
      const rec = (window as unknown as { __rec: Recording }).__rec;
      return rec.frames.filter((f) => f.t > rec.lastInput).length >= k;
    },
    n,
    { timeout },
  );
}

/**
 * Clicks the elements one after the other inside the page, `gap` ms apart. Playwright's own
 * click waits for stable frames first, which on a slow runner spreads a "quick" series over more
 * than the 300 ms of the tween rule, so each click becomes a single change.
 */
export async function clickSeries(page: Page, targets: Locator[], gap = 50): Promise<void> {
  const handles = await Promise.all(targets.map((t) => t.elementHandle()));
  await page.evaluate(
    async ({ els, ms }) => {
      for (const el of els) {
        (el as HTMLElement).click();
        await new Promise((r) => setTimeout(r, ms));
      }
    },
    { els: handles, ms: gap },
  );
}

/** Drags the thumb of a range input in small mouse steps (2 px) towards the far end. */
export async function dragSlider(page: Page, slider: Locator, steps = 30): Promise<void> {
  await slider.scrollIntoViewIfNeeded();
  const box = (await slider.boundingBox())!;
  const value = Number(await slider.inputValue());
  const min = Number((await slider.getAttribute('min')) ?? 0);
  const max = Number((await slider.getAttribute('max')) ?? 100);
  const k = max > min ? (value - min) / (max - min) : 0.5;
  const direction = k > 0.5 ? -1 : 1;
  // A point on the thumb: its centre runs from half a thumb inside the left edge to half a thumb
  // inside the right edge. At the ends (the session clock sits at its maximum late in the
  // evening) a press exactly on the edge of the box misses the input and the drag moves nothing.
  const inset = Math.min(10, box.width / 4);
  const x0 = box.x + inset + k * (box.width - 2 * inset);
  const y = box.y + box.height / 2;
  await page.mouse.move(x0, y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(x0 + direction * 2 * i, y);
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
}

/** Holds an arrow key towards the far end: repeated keydown about 33 ms apart, then keyup. */
export async function holdArrow(page: Page, slider: Locator, presses = 20): Promise<void> {
  await slider.scrollIntoViewIfNeeded();
  const value = Number(await slider.inputValue());
  const min = Number((await slider.getAttribute('min')) ?? 0);
  const max = Number((await slider.getAttribute('max')) ?? 100);
  const key = max > min && (value - min) / (max - min) > 0.5 ? 'ArrowLeft' : 'ArrowRight';
  await slider.focus();
  for (let i = 0; i < presses; i++) {
    await page.keyboard.down(key);
    await page.waitForTimeout(33);
  }
  await page.keyboard.up(key);
}

/**
 * Pauses a running playback in the island of `inside` (its play button reads or is labelled
 * "Pause"). A
 * playback is a deliberate animation that runs on its own; the slider tests start from rest.
 */
export async function pausePlayback(inside: Locator): Promise<void> {
  const island = inside.locator('xpath=ancestor::*[@data-ff-island][1]');
  const buttons = island.locator('[data-play]');
  for (let i = 0; i < (await buttons.count()); i++) {
    const b = buttons.nth(i);
    const label = `${(await b.textContent()) ?? ''} ${(await b.getAttribute('aria-label')) ?? ''}`;
    if ((await b.isVisible()) && /Pause/.test(label)) await b.click();
  }
}

/** Waits until no Monte Carlo value of the island is being computed (data-pv="busy"). */
export async function waitForResults(inside: Locator): Promise<void> {
  const island = inside.locator('xpath=ancestor::*[@data-ff-island][1]');
  await expect(island.locator('[data-pv="busy"]')).toHaveCount(0, { timeout: 15_000 });
}
