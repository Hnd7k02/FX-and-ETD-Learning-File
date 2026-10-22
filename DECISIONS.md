# Decisions

Format: `D-xx · date · origin`, then question, decision, reasoning. Origin is `Dario`, `Claude, von Dario bestätigt` or `Claude`.

## D-01 · 2026-10 · Dario

**Question:** What kind of tool is this?
**Decision:** A pure education tool without any reference to a bank.
**Reasoning:** No names of banks, firms, people or clients; no internal terms or processes. Keeps the tool neutral and shareable as a portfolio piece.

## D-02 · 2026-10 · Dario

**Question:** Language?
**Decision:** German with English technical terms, fully switchable to English.
**Reasoning:** The target audience works in Switzerland; the desk speaks English terms.

## D-03 · 2026-10 · Dario

**Question:** How deep?
**Decision:** Intuition and worked examples first, formulas collapsible; focus on moneyness, forward, arbitrage and the six Greeks with derivations.
**Reasoning:** Beginners stay with the story, the curious can open every derivation.

## D-04 · 2026-10 · Claude, von Dario bestätigt

**Question:** Structure?
**Decision:** Nine modules that build on each other (01 Spot … 09 Hedge, Alpha, Yield).
**Reasoning:** Linear → options → exotics → application mirrors how the instruments are built from each other.

## D-05 · 2026-10 · Dario

**Question:** Design direction?
**Decision:** Direction B "Lernpfad" instead of A "Dashboard".
**Reasoning:** A path invites learning in order; a dashboard invites browsing.

## D-06 · 2026-10 · Dario

**Question:** How to show the Riskometer?
**Decision:** As a gauge (Tacho), not a bar.
**Reasoning:** Immediately readable, memorable.

## D-07 · 2026-10 · Claude, von Dario bestätigt

**Question:** Name?
**Decision:** "Forward First".
**Reasoning:** The red thread: everything is reduced to the forward.

## D-08 · 2026-10 · Claude, von Dario bestätigt

**Question:** Navigation between modules?
**Decision:** No module wheel; the transition station → module header stays.
**Reasoning:** Less gimmick, the learning path stays the home base.

## D-09 · 2026-10 · Dario

**Question:** Extras?
**Decision:** Running example, G10 profiles, franc-shock case, quiz per module, Riskometer with real data.
**Reasoning:** Each extra connects the theory to something concrete.

## D-10 · 2026-10 · Claude

**Question:** Stack and hosting?
**Decision:** Astro, TypeScript, Preact; hosting on Cloudflare.
**Reasoning:** Static output, tiny JS budget, islands only where interaction is needed; Cloudflare is free and fast for static assets.

## D-11 · 2026-10 · Claude

**Question:** Data source for the Riskometer?
**Decision:** ECB euro foreign exchange reference rates.
**Reasoning:** Official, free, daily, long history since 1999, stable API.

## D-12 · 2026-10 · Claude, von Dario bestätigt

**Question:** Riskometer method?
**Decision:** 21 log returns, zero mean, annualised with √252; percentiles of all daily values since 2006 per pair; five levels at P20/P60/P85/P97.
**Reasoning:** A one-month window reacts quickly but not nervously; percentiles make the pairs comparable.

## D-13 · 2026-10-22 · Claude

**Question:** Cloudflare Pages or Workers Static Assets?
**Decision:** Workers with Static Assets (`wrangler.jsonc`, `assets.directory = ./dist`), connected to GitHub through Workers Builds.
**Reasoning:** Cloudflare recommends Workers for new projects, including purely static sites; Pages keeps working but receives no new features. Static assets on Workers are free and need no Worker code.

## D-14 · 2026-10-22 · Claude

**Question:** Exact versions?
**Decision:** Node 24 LTS, Astro 7.4, TypeScript 6.0, Preact 10.29, Vitest 5, Playwright 1.56, ESLint 10.
**Reasoning:** Astro 7 requires Node ≥ 22.23; Node 24 is the active LTS. TypeScript 7 (native port) is not yet supported by `astro check` and typescript-eslint, so 6.0. Preact 10 is the long-proven line; the islands use only hooks, an upgrade to 11 is a one-line change. Playwright 1.56 matches the Chromium build preinstalled in the build sandbox; CI installs its own browser.

## D-15 · 2026-10-22 · Claude

**Question:** The build sandbox cannot reach the ECB API. Where does the first data snapshot come from?
**Decision:** The initial `data/raw/ecb-eur-reference.csv` was converted from the ECB's official `eurofxref-hist.zip` (as bundled unchanged in the PyPI package CurrencyConverter 0.18.22, data until 14.09.2026). From then on the daily GitHub Action fetches directly from the ECB Data Portal API and overwrites the file.
**Reasoning:** Same ECB reference rates, same values; only the delivery route differs. Documented so nobody wonders why the first commit predates the API fetch.

## D-16 · 2026-10-22 · Dario

**Question:** Stop after every phase?
**Decision:** No. In this session Claude works through as many phases as possible without waiting for "weiter", records open questions in `PROGRESS.md` and decides small things itself.
**Reasoning:** Dario's instruction at the start of the session ("so weit du kannst", focus on learning value and wow effect).

## D-17 · 2026-10-22 · Claude

**Question:** How is content organised so that numbers stay honest?
**Decision:** One MDX file per section and language. Numbers via `<Num of="ns.key" />` from per-namespace registries in `src/lib/nums/` (merged automatically), facts via `<Fact id="…" />` from `src/content/facts/`, sources in `src/content/sources.md`. A content lint fails on unknown keys, missing sources, forbidden words and typed-in reference values.
**Reasoning:** Per-namespace files let modules be written in parallel without merge conflicts; the lint makes the integrity rule enforceable instead of a promise.

## D-18 · 2026-10-22 · Claude

**Question:** The B-Modul prototype shows a quiz card inside a section, the brief has a separate quiz page. Which one?
**Decision:** Both. Every section ends with one ungraded "Kurz geprüft" question (retrieval practice); the quiz page per module has the four graded questions (pass from 3 of 4).
**Reasoning:** Matches the prototype and the brief; a question right after reading is one of the most effective learning techniques.

## D-19 · 2026-10-22 · Claude

**Question:** Language switch: buttons (prototype) or links?
**Decision:** Links styled as the prototype's segmented control, with `hreflang` and `aria-current`. The choice is stored (`ff-lang`); the German home page sends a visitor who chose English to `/en/` once per browser session.
**Reasoning:** The switch navigates to another page, so a link is the correct element.

## D-20 · 2026-10-22 · Claude

**Question:** Normal distribution accuracy?
**Decision:** Hart/West double-precision algorithm for N(x) (error < 1e-14) and Acklam + Halley step for N⁻¹, instead of the Abramowitz-Stegun 7.1.26 approximation in the prototypes (error ≈ 1e-7).
**Reasoning:** The tests compare against the Python reference down to 1e-10 (parity); the prototype formula is good enough for the eye but not for the tests.

## D-21 · 2026-10-22 · Claude

**Question:** Minus sign and English percent?
**Decision:** Typographic minus (U+2212) in both languages; English percent without a space ("8%").
**Reasoning:** Matches the prototypes; en-GB convention has no space before the percent sign.

## D-22 · 2026-10-22 · Dario

**Question:** How to handle choices Claude is unsure about while Dario is away?

**Decision:** Decide, and make the choice easy to change later: every uncertain parameter lives in one clearly named, documented config object (e.g. the running example in `src/lib/fx/example.ts`, module structure in `src/data/modules.ts`, product parameters in `PRODUCT_DEFAULTS` in `src/lib/fx/mc/products.ts`, Riskometer method constants in `src/lib/data`), never as scattered literals. Each such choice gets an entry here or an open question in `PROGRESS.md`.

**Reasoning:** Dario's instruction during the session ("if you're not sure … code it so we can change it easily later").

## D-23 · 2026-10-22 · Claude

**Question:** Where do glossary chips link to?

**Decision:** To the exact section where the term is taught (optional `section` per glossary entry), not always to section 1.

**Reasoning:** One click to the explanation instead of searching through the module. Change per term in `src/content/glossary.ts`.

## D-24 · 2026-10-22 · Claude

**Question:** Conventions of the closed-form exotics?

**Decision:** Knock-out rebates are paid at the hit, knock-in rebates at expiry (Haug). `oneTouch` pays at expiry by default (`payAt: 'hit'` optional), the usual interbank FX convention; with the CHF rate at 0 % both are equal in the example. European digitals pay ½ exactly at the strike. Pay-at-hit values with negative rates use a quadrature in u = √t (the uniform-in-t version was off by up to 6e-6 per unit near the barrier; found and fixed by the verification agent). Very low vols are computed in log space; vol ≤ 0 follows the forward path instead of throwing. The Double No-Touch uses Hui's series with an automatic number of terms, or 1 − two single touch probabilities when the chance of touching both barriers is provably below 1e-16.

**Reasoning:** Matches the literature, never breaks a slider at an edge, verified against independent formulations (method of images, first-passage quadrature, image-sum DNT, PDE) to 1e-12, see `docs/reference/xcheck/`.

## D-25 · 2026-10-22 · Claude

**Question:** How exact is the hedge roll in module 03?

**Decision:** Near leg at current spot; the all-in rate is old forward + swap points; interest on the cash settlement between roll date and new maturity is ignored and said so in the text.

**Reasoning:** Keeps the teaching example readable; the historical-rate rollover and the settlement interest are desk details mentioned in prose.

## D-26 · 2026-10-22 · Claude

**Question:** How to split theta in the texts?

**Decision:** `ex.thetaGammaChf` = −½σ²S²Γ/365 · N (CHF −69.33), `ex.thetaDayChf` = one-day difference (CHF −30.82, shown in the lab), and the carry part `ex.thetaCarryChf` is the residual of the two (CHF +38.50), so the parts add up to the number on screen. The analytic carry term (CHF +38.66) differs by the second-order effect of the one-day step; the derivation says so.

**Reasoning:** Learners check sums; numbers that do not add up undermine trust.

## D-27 · 2026-10-22 · Claude

**Question:** Smile example values for module 06?

**Decision:** `EXAMPLE_SMILE = { atm: 8 %, rr25: −1.0 %, bf25: 0.25 % }` in `src/lib/fx/example.ts`, labelled as example values.

**Reasoning:** A negative risk reversal illustrates the typical demand for CHF calls as protection; the size is a round, plausible teaching value, not market data. One place to change.

## D-28 · 2026-10-22 · Claude

**Question:** Monte Carlo engine and product conventions (§7, §8.7)?

**Decision:** xoshiro128\*\* (SplitMix32 seeding), Marsaglia polar normals, exact log-Euler GBM with drift rd − rf, daily steps, antithetic pairs, 1’000’000 paths for the precomputed fair values (seed 20261022), 20’000 paths for interactive runs in a Web Worker. Conventions, all in `MC_CONFIG` (`src/lib/fx/mc/products.ts`): no trade on the knock-out fixing of accumulator/decumulator; the last TARF gain is capped to the target; weekly fixings every 7 calendar days, monthly on day round(i·365/12), no business-day adjustment, settlement on the fixing day; Pivot TARF, TPF and RTPF use USD 100’000 per fixing and 12 monthly fixings (not specified in §8.7, copied from the TARF); dual currency interest Act/360, only the capital is converted. Fair values carry a standard error from the delta method; an independent re-implementation reproduced every value within 1.5 standard errors.

**Reasoning:** Reproducible, fast enough (precompute 25 s), every convention changeable in one place; `npm run data:mc` regenerates `src/data/fx/mc-products.json` and a test fails if the JSON no longer matches the config.

## D-29 · 2026-10-22 · Claude

**Question:** The §8.7 parameters give a TARF that reaches its 500-pip target after about 2.4 fixings in 94 % of paths, and TPF/RTPF coupons of about 775–810 pips per fixing. Change the parameters?

**Decision:** Keep Dario's parameters for now and teach the consequence: a target caps the good scenarios (the product ends early) while the bad scenarios run to maturity with double amounts — the asymmetry is the central TARF lesson. The large TPF/RTPF coupons are explained by the strike being set relative to the spot while the forward falls by the interest differential (strike above the 1-year forward). The "better than forward" comparison uses the forward at the average scheduled fixing day. Alternatives measured by the MC agent (TARF target 1’500 pips: K = 0.7540, about 6 fixings; Pivot TARF target 1’000 pips: about 5 fixings) are listed as an open question for Dario.

**Reasoning:** The spec names the parameters as examples; changing them silently would contradict D-16/D-22, and the current values produce a valuable teaching point. Changing them is one edit in `MC_CONFIG` plus `npm run data:mc`.
