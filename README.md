# Forward First

**An interactive learning tool for the FX market — from spot and forwards to options, the six Greeks and structured products. Everything is reduced to the forward.**

German with English technical terms, fully switchable to English. Every number on screen is calculated live by a tested calculation core; a Riskometer shows real market swings from ECB reference rates.

![Forward First](public/og.png)

> For educational purposes only. Not investment advice.

## What it is

Nine modules that build on each other, all telling the same story — a Swiss importer who has to pay USD 1 million in three months:

| Family      | Modules                                                       |
| ----------- | ------------------------------------------------------------- |
| Linear      | 01 FX market & spot · 02 Forward · 03 FX swap                 |
| Options     | 04 Vanilla options · 05 Greeks · 06 Combos & volatility smile |
| Exotics     | 07 Barrier & binary · 08 Structured products                  |
| Application | 09 Hedge, alpha, yield                                        |

Each module has four sections (intuition → interactive core → worked example → collapsible derivation → "on the desk" → key point), a check question after every section and a four-question quiz. Progress is stored only in the browser.

### Signature interactions

- **Wow moment** (home page): forward → call → time value → put-call parity, morphing on the same axes.
- **Greeks lab**: price and delta curves with live tangents (slope = delta, slope of delta = gamma), all six Greeks with numerical checks.
- **Riskometer**: realised 1-month volatility of EUR/CHF, USD/CHF, EUR/USD and USD/JPY since 2006 as a gauge and a 20-year chart with tappable market events (2008, 2011, 2015, 2022, 2024, 2025).
- **Payoff builder**, **smile builder**, **barrier and touch labs**, **path simulator** for accumulators, TARFs and target profit forwards, **franc-shock replay** with real ECB fixings.

## Stack

Astro 7 (static output) · TypeScript strict · Preact islands · MDX · hand-written SVG charts (no chart library) · self-hosted fonts (Plus Jakarta Sans, JetBrains Mono, STIX Two Text) · Vitest · Playwright + axe · ESLint · Prettier · Cloudflare Workers static assets.

## Architecture

```
src/lib/fx/          calculation core: pure functions, no DOM
  forward, swap, arbitrage, vanilla (Garman-Kohlhagen, Black-76), greeks, implied,
  smile, exotics/ (digital, 8 barriers, touch, double no-touch), mc/ (Monte Carlo)
src/lib/data/        Riskometer maths: realised vol, percentiles, levels, events, validation
src/lib/nums/        named numbers for <Num of="…" /> in the texts (computed, never typed in)
src/content/         module texts (MDX, de/en), quizzes, glossary, facts, sources.md
src/components/      layout, content blocks, Preact islands, figure wrappers
src/i18n/            UI strings per namespace (equal keys enforced in DE and EN)
scripts/             fetch-ecb.ts, build-riskometer.ts, precompute-mc.ts
data/raw/            ECB raw data (versioned)
src/data/fx/         generated JSON (Riskometer, Monte Carlo fair values)
docs/                master prompt, design references, content guide, reference checks
```

**Number integrity.** Texts never contain typed-in example values: `<Num of="ex.callChf" />` renders "CHF 12’669" from the core. Historical facts go through `<Fact id="…" />` and must have an entry in `src/content/sources.md`. A content lint fails the build otherwise.

## Data pipeline

ECB euro reference rates (USD, CHF, JPY per EUR) → EUR/CHF and EUR/USD directly, USD/CHF and USD/JPY as cross rates → realised volatility over 21 log returns, zero mean, annualised with √252 → percentiles of all daily values since 2006 per pair → five levels (calm < P20 ≤ normal < P60 ≤ elevated < P85 ≤ high < P97 ≤ extreme). A GitHub Action (`.github/workflows/data.yml`) fetches, validates, rebuilds and commits on every ECB business day; validation failures stop the job without a commit.

## Tests

- `npm run check` — `astro check`, ESLint, Prettier, Vitest with coverage (≥ 90 % lines in `src/lib`).
- `npm run e2e` — Playwright at 390 px and 1440 px, including axe accessibility checks.
- The running example is tested against an independent Python reference (`docs/reference/gk_reference.py`); exotics against independent formulations (method of images, first-passage quadrature, image-sum double no-touch, PDE) in `docs/reference/xcheck/`; Monte Carlo fair values were reproduced by an independent re-implementation.

## Highlights from the decision log

The full log with origin of every decision is in [`DECISIONS.md`](DECISIONS.md). A few:

- Strict separation of numbers from text with a lint that enforces it (D-17).
- A check question after every section in addition to the module quiz (D-18).
- Double-precision normal distribution instead of the prototype approximation (D-20).
- Where the ECB data contradicted a prototype text, the text was changed, not the data (D-31).
- Structured products are always decomposed into building blocks with a loss scenario; their fair strikes come from a seeded Monte Carlo with standard errors (D-28, D-29).

## Run locally

```bash
nvm use            # Node 24 LTS
npm ci
npm run dev        # http://localhost:4321
npm run check      # types, lint, unit tests
npm run build && npm run e2e
```

## Deploy

Cloudflare Workers with static assets (see `wrangler.jsonc`, decision D-13):

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Import a repository** → select this repository.
2. Build command `npm run build`, deploy command `npx wrangler deploy`, root directory `/`.
3. Environment variable `NODE_VERSION = 24`.
4. Production branch: `main`. Every push to `main` (including the daily data commit) deploys automatically.
5. Afterwards set `site` in `astro.config.mjs` to the production URL.

## Credits

Concept and product decisions: Dario Moffa. Built with Claude Code.

## License

All rights reserved (no licence granted) until decided otherwise.
