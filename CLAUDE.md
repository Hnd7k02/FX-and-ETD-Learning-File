# CLAUDE.md – Forward First

Read this first, then `PROGRESS.md` (where we are) and `DECISIONS.md` (why things are the way they are). The full brief is `docs/MASTER_PROMPT.md`; the visual reference is `docs/design/`.

## Product in one line

A light, calm learning tool for FX: spot → forward → FX swap → vanilla options → six Greeks → exotics. Everything is reduced to the forward. Every number is calculated live; a Riskometer shows real market swings.

## Non-negotiable rules

- **Education only.** No names of banks, companies, people or clients. No internal terms, systems or processes of any bank. Dario's employer never appears in the tool or the repo.
- **Disclaimer** in every footer and on the About page: "Nur zu Bildungszwecken. Keine Anlageberatung." / "For educational purposes only. Not investment advice."
- **Number integrity.** Every number in UI and text comes from the calculation core (`src/lib/fx`) or data (`src/data`). In MDX use `<Num of="…" />` (registry `src/lib/nums/<ns>.ts`), never typed-in example or reference values. Exception: sourced historical facts via `<Fact id="…" />` (registry `src/content/facts/<ns>.ts`, source in `src/content/sources.md`).
- **Fact integrity.** Market events, institutional facts and statistics only with a source in `src/content/sources.md`. Textbook knowledge is fine, invented facts are not. If unsure, leave it out and add an open question to `PROGRESS.md`.
- **Structured products:** always decomposed into building blocks, always with a loss scenario, always generic (no product or provider names).
- **Swiss formats:** `de-CH` with ’ as thousands separator and . as decimal (CHF 12’669, 0.7930); percent with no-break space ("8 %"); rates 4 decimals, JPY pairs 2; pip = 0.0001 (JPY 0.01). English `en-GB`. Use the helpers in `src/lib/format.ts`; never format numbers by hand.
- **German:** du-form, short sentences. Terms like Forward Points, Strike, Moneyness, Knock-out stay English; the glossary explains them.
- **Design:** direction B "Lernpfad" (`docs/design/*.dc.html`, tokens in `src/styles/tokens.css`). Light, white cards on light grey, black pill buttons, accents only to highlight. Long blue, short orange, forward/tangents black, time value blue 10 %, expiry payoff grey dashed. Families: linear blue, options violet, exotics orange, application teal. Riskometer levels always with a label.
- **Accessibility:** WCAG 2.2 AA, real `<button>/<a>/<input>` with labels, every chart has `aria-label` plus a text alternative, visible focus, `prefers-reduced-motion` respected, touch targets ≥ 44 px, no horizontal page scroll from 390 px.

## Stack and commands

Astro 7 (static) · TypeScript strict · Preact islands · MDX · hand-written SVG charts · Vitest · Playwright + axe · ESLint · Prettier. Node 24 LTS (`.nvmrc`).

- `npm run check` = `astro check` + ESLint + Prettier check + Vitest with coverage (≥ 90 % lines in `src/lib`). The exit code decides.
- `npm run e2e` = Playwright (390 px and 1440 px) incl. axe. Needs `npm run build` first. In the sandbox set `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome` if browsers are not found.
- `npm run build` → `dist/`.
- Data: `npm run data:fetch` (ECB API) → `npm run data:build` (Riskometer JSON) → `npm run data:mc` (Monte Carlo fair strikes).

Sandbox note: Node 24 is linked into `~/.local/bin` (ahead of the preinstalled Node 22).

## Where things live

- `src/lib/fx/` calculation core (pure functions, no DOM) · `src/lib/data/` Riskometer maths · `src/lib/format.ts` formatting · `src/lib/progress.ts` progress model.
- `src/data/modules.ts` module registry (slugs, families, titles, sections in DE/EN).
- `src/content/modules/{slug}/{de|en}/{1..4}.mdx` section texts · `src/content/quiz/{slug}.ts` quiz and per-section check questions · `src/content/glossary.ts` · `src/content/sources.md`.
- `src/i18n/dict/*.ts` UI strings per namespace (`defineDict` enforces equal keys) · `src/i18n/routes.ts` paths.
- `src/components/content/` MDX building blocks (Num, Fact, Formula, Desk, Derivation, Takeaway, Figure, Callout) · `src/components/islands/` Preact islands · `src/components/figures/` Astro wrappers that hydrate islands for MDX.
- `scripts/` data pipeline · `data/raw/` ECB raw data (versioned) · `src/data/fx/` generated JSON.

## Working style

- Small Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`, `data:`).
- Record every decision in `DECISIONS.md` (`D-xx · date · origin`), keep `PROGRESS.md` current.
- Check exit codes, not summaries.
