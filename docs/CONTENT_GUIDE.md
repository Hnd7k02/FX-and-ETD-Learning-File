# Content guide: how a module section is written

This is the house style for every module (DE and EN). Read `CLAUDE.md` first.

## Files per module

```
src/content/modules/{slug}/de/1.mdx … 4.mdx   German sections
src/content/modules/{slug}/en/1.mdx … 4.mdx   English sections (full translation, same structure)
src/content/quiz/{slug}.ts                     4 graded quiz questions + 1 check question per section
src/lib/nums/m{NN}.ts                          numbers used by this module (keys "m{NN}.…")
src/content/facts/m{NN}.ts                     sourced facts used by this module (optional)
src/content/sources/{slug}.md                  source entries for those facts (merged into sources.md later)
src/i18n/dict/{name}.ts                        UI strings of module-specific islands (defineDict)
src/components/islands/{Name}.tsx              Preact islands (interactive figures)
src/components/figures/{Name}.astro            Astro wrapper that hydrates the island; import this in MDX
```

The section title, short label and teaser come from `src/data/modules.ts`. The page template renders the H2 title, the "Abschnitt n von 5" eyebrow, the check question at the end and the pager. **Do not repeat the title in MDX.**

## Section pattern (MASTER_PROMPT §10)

1. **Intuition** with the running example (the Swiss importer who must pay USD 1 Mio. in 3 months).
2. **Core with interaction**: a figure (island) in full width.
3. **Worked example**: numbers only via `<Num of="…" />`.
4. **Derivation and formula details** inside `<Derivation>` (collapsed by default).
5. Optional **"Am Desk"** (`<Desk title="…">`): how practitioners use it. Generic, no bank names, no internal terms.
6. One **Merksatz** (`<Takeaway>`), always last.

Length: about 350–650 words per section in German (without the derivation), short sentences, du-form. English is a full translation in natural British English (not word-for-word), same components, same numbers.

## Components available in MDX without import

| Component | Use |
|---|---|
| `<Num of="ex.spot" />` | Any number from the example or the calculation core. Optional `digits`, `sign`. |
| `<Fact id="snb-floor-1-20" />` | A sourced historical number or date (e.g. 1.20, −0.75 %). |
| `<Formula>…</Formula>` | Formula box in STIX Two Text. `variant="accent"` (family colour) for the key result, `variant="dark"` inside Desk. Use `<i>S</i>`, `<sub>`, `<sup>`, Unicode (Δ Γ σ √ · − ⇒ ≈ ∂). |
| `<Derivation title="…">…</Derivation>` | Collapsible derivation; default title "Herleitung"/"Derivation". |
| `<Desk title="…">…</Desk>` | Dark "Am Desk" callout. |
| `<Takeaway>…</Takeaway>` | Merksatz, one or two sentences. |
| `<Figure caption="…">…</Figure>` | Full-width frame for an island. |
| `<Callout variant="note|warn|bad|good" title="…">…</Callout>` | Side note, risk warning, loss scenario. |

Islands are imported explicitly at the top of the MDX file, as Astro wrappers:

```mdx
import GreeksLabFigure from '@/components/figures/GreeksLabFigure.astro';

<GreeksLabFigure mode="vega" caption="Zieh an der Vola: …" />
```

The wrapper reads the language itself (`Astro.currentLocale`) and passes it to the island with `client:visible`.

## Numbers

- Never type a value from the example or the core into MDX. Register it in `src/lib/nums/m{NN}.ts`:

  ```ts
  import { gkPrice } from '@/lib/fx';
  import { EXAMPLE as E, EXAMPLE_STRIKE as K } from '@/lib/fx/example';
  import type { NumTable } from './types';

  export const nums: NumTable = {
    'm04.callPips': { value: gkPrice(E.spot, K, E.T, E.vol, E.rd, E.rf, 'call') * 1e4, kind: 'pips', digits: 2 },
  };
  ```

  Kinds: `rate` (4 decimals), `pips` (1), `money` (`ccy`, 0), `pct` (fraction → "8.0 %"), `num` (2).
- Shared example values live in `src/lib/nums/ex.ts` (`ex.spot`, `ex.strike`, `ex.forward`, `ex.vol`, `ex.rd`, `ex.rf`, `ex.notional`, `ex.callPips`, `ex.callChf`, …). Reuse them.
- Conventions and textbook constants are normal text: T+2, 25Δ, √252, 365 days, "1 Pip = 0.0001".
- Round numbers that are part of a didactic statement and not example or reference values ("eine Big Figure, also 100 Pips") are fine as text.

## Facts and sources

Historical numbers (EUR/CHF floor 1.20, SNB rate −0.75 %, dates of events) go through `<Fact>`. Each fact names a source id; the source entry goes to `src/content/sources/{slug}.md`:

```md
## snb-2015-01-15
- Titel: Nationalbank hebt Mindestkurs auf und senkt Zins auf −0.75 %
- Herausgeber: Schweizerische Nationalbank (SNB)
- Datum: 15.01.2015
- URL: https://www.snb.ch/…
- Belegt: Aufhebung des Mindestkurses von 1.20; Zins auf Sichtguthaben −0.75 %
```

Only facts you are sure about, with a real, stable source (central bank press releases, BIS, ECB, official statistics). If unsure: leave it out and report it as an open question.

## Quiz file

```ts
import type { ModuleQuiz } from './types';
export const quiz: ModuleQuiz = {
  slug: '05-greeks',
  quiz: [q1, q2, q3, q4],          // graded, pass from 3 of 4
  checks: { '1': c1, '2': c2, '3': c3, '4': c4 }, // one per section, ungraded
};
```

Each question: `id`, `prompt` {de,en}, 3–4 `options` each with `label` {de,en}, `explain` {de,en} (why right or wrong), optional `mono: true` for numeric labels, and `correct` (index). Numbers in labels and explanations come from the core (compute and format with `src/lib/format.ts` inside the TS file). Distractors should be plausible mistakes (sign error, forgot the forward, mixed up base and quote), not jokes.

## Language and tone

- German: du-form, short sentences, active voice. "Forward Points", "Strike", "Moneyness", "Knock-out", "Delta" stay English. Use "Vola" for Volatilität in running text.
- English: British spelling (realised, hedging, colour), same terms.
- No product or provider names, no bank names, no client stories that sound real. Structured products: always building blocks, loss scenario and risk box.
- No "garantiert"/"guaranteed" (except "nicht garantiert"), no "risikolos"/"risk-free" outside arbitrage or risk-free-rate contexts.
- Swiss formats via `<Num>`; in prose write "CHF 1 Mio.", "3 Monate", "T+2".

## Accessibility for figures

Every chart SVG has `role="img"` and an `aria-label` that states the current values, plus a text alternative (visible summary line or `sr-only` table). Controls are real `<input type="range">`/`<button>` with labels, 44 px touch targets. Respect `prefers-reduced-motion`.

## Building islands (interactive figures)

Use the shared building blocks so every lab looks the same:

- `src/lib/chart.ts`: `scaleLinear`, `niceTicks`, `sample`, `linePath`, `areaPath`, `project`, `tangentSegment`, `lerpPoints`, `easeInOutCubic`, `easeOutCubic`, `nearestIndex`, `clamp`.
- `src/components/ui/Chart.tsx`: `ChartSvg` (responsive SVG with `role="img"` + `aria-label`), `GridY` (1 px gridlines, darker axis at 0, left labels), `AxisX` (tick labels and axis title), `RefLineX` (dashed strike/barrier line with label).
- `src/components/ui/Slider.tsx` (labelled range input with mono value), `Segmented.tsx` (pill toggle with `aria-pressed`), `Legend.tsx`, `Stat.tsx` (`StatTable`, `StatHero` dark premium row, `StatRow` Greek-style rows).
- `src/components/ui/hooks.ts`: `usePrefersReducedMotion`, `useElementWidth` (switch to a compact viewBox under ~640 px so labels stay ≥ 11 px), `useInView` (pause animations off-screen), `useTween` (smooth 300 ms transitions, instant under reduced motion).
- CSS classes in `src/styles/ui.css`: `.ff-lab` / `.ff-lab-main` / `.ff-lab-side` (chart left, controls right, controls below on phones), `.ff-lab-head`, `.ff-lab-title`, `.ff-lab-sub`, `.ff-pill-note`, `.ff-check` (green "numerischer Check" box), `.ff-table` (+ `td.num`), `.ff-scroll-x`, plus `.panel`, `.segmented`, `.range`, `.field-label` from base.css.

Chart colour semantics: long/call/option value `var(--ff-long)` blue, short/put sold `var(--ff-short)` orange, forward/sum/tangents `var(--ff-forward)` black, time value area blue at 10 % (`var(--ff-timevalue)`), payoff at expiry `var(--ff-payoff)` grey dashed `6 6`, strike line `var(--ff-ref)` dashed `4 5`, gridlines `var(--ff-grid)`, axis `var(--ff-axis)`. Stroke widths: main curve 3, comparison 1.75 dashed, tangent 2.25.

Pure maths for an island (payoffs, scenario logic) goes into `src/lib/…` with unit tests, not into the `.tsx` file. Islands receive `lang` as a prop and take every string from a dictionary.
