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

**Question:** Stack and output?
**Decision:** Astro, TypeScript, Preact. Updated 2026-10-23: no hosting; the output is one offline HTML file `forward-first.html` built from the Astro output (D-13, D-40). The original choice was hosting on Cloudflare.
**Reasoning:** Static output, islands only where interaction is needed. Static pre-rendering is exactly what the single file needs: every page is rendered once at build time and packed into the file, so calculation core, components and content stay unchanged.

## D-11 · 2026-10 · Claude

**Question:** Data source for the Riskometer?
**Decision:** ECB euro foreign exchange reference rates.
**Reasoning:** Official, free, daily, long history since 1999, stable API.

## D-12 · 2026-10 · Claude, von Dario bestätigt

**Question:** Riskometer method?
**Decision:** 21 log returns, zero mean, annualised with √252; percentiles of all daily values since 2006 per pair; five levels at P20/P60/P85/P97.
**Reasoning:** A one-month window reacts quickly but not nervously; percentiles make the pairs comparable.

## D-13 · 2026-10-23 · Dario

**Eine Offline-HTML-Datei für Arbeits-PC und iPad, kein Hosting, kein Login**

**Question:** How does Dario use Forward First: hosted site or file?
**Decision:** Forward First is one HTML file, `forward-first.html`, that runs offline on the work PC (Chrome and Edge, double click) and in the iPad Files app (WebKit). No hosting, no PWA, no Cloudflare, no login. Everything is inside the one file: CSS, JavaScript, fonts (subset), Riskometer data, both languages. No external files and no network requests, enforced by a Content-Security-Policy meta tag. Target under 3 MB, at most 5 MB. Navigation by hash routing inside the file (e.g. `#/module/05-greeks/2/`). Optional features are feature-detected with a fallback: View Transitions for station → module, Monte Carlo without a Web Worker in small chunks on the main thread, progress in `localStorage` (if blocked, the tool runs without saved progress). The data update is manual: fetch ECB data, validate, test, build the file, publish it as a GitHub Release; no daily cron; the tool shows the data date. Tests open the built file over `file://` in Chromium (1440 × 900) and WebKit (iPad 820 × 1180 and 1180 × 820) with the network blocked; any request fails the test. Lighthouse and the 120 KB JS budget are dropped.
**Evidence:** Device test by Dario on 2026-10-23: a local test HTML file with inline JavaScript runs in the iPad Files app and on the work PC by double click; the iPad does not load side files there, so everything has to be in one file.
**Reasoning:** The tool is used where hosting is not an option; one file is the only format that works on both devices. Replaces the earlier D-13 (Cloudflare Workers Static Assets, 2026-10-22), which is void; `wrangler.jsonc` and the daily data cron are removed.

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

## D-30 · 2026-10-22 · Claude

**Question:** The approved prototype text for 2008 names the failed investment bank; D-01 forbids bank names.

**Decision:** Neutral wording ("eine grosse US-Investmentbank" / "a major US investment bank") for now; listed as an open question for Dario.

**Reasoning:** When two of Dario's rules collide, the stricter one wins until he decides. One-line change in `src/data/events.json`.

## D-31 · 2026-10-22 · Claude

**Question:** How do the Riskometer event texts stay true to the data?

**Decision:** Every computed number in `src/data/events.json` is a placeholder filled at build time (`{from}`, `{to}`, `{movePct}`, `{peak}`, `{peakDate}`, plus `{dayDate}`, `{dayMovePct}`, `{dayMoveAbsPct}`, `{volBefore}`, `{peakLevel}`); pair-specific sentences go into `pairNote[pair]`. Tests check each qualitative statement against the data. Corrections made because the ECB fixings say otherwise: EUR/CHF did not close below parity in March 2022 (ECB low 1.0056; the text now says "lowest since January 2015"); the 2015 move window runs to 23.01.2015 (ECB low); the fiscal-2025 peak window is anchor to +20 trading days (otherwise the April 2025 tariff turmoil would count). Claims without an official source were dropped ("within minutes", "largest Bund yield jump since 1990").

**Reasoning:** The prototype used Fed noon rates; the build uses ECB fixings (D-11), so a few statements had to follow the data, not the other way round.

## D-32 · 2026-10-22 · Claude

**Question:** Deviations of the home page from the B-Home prototype?

**Decision:** The Wow chart's SVG renders 1:1 in CSS pixels (viewBox = container width) so labels stay 13 px at every width, compact layout under 640 px; the phase-3 clock ends at 91.25 days (T = 0.25, "3 Monate"); the Riskometer card uses its visible text as accessible name (an aria-label failed axe "label-content-name-mismatch"); the learning path becomes a vertical list under 640 px; level chip icon up for levels ≥ 3, dash for 2, down for 1.

**Reasoning:** Readability on phones, accessibility, and the spec's T = 0.25.

## D-33 · 2026-10-22 · Claude

**Question:** Deviations of the module template from B-Modul?

**Decision:** Stepper items are links (44 px; numbers only under 640 px with full labels for screen readers); the per-section question is titled "Kurz geprüft" with the hint "ohne Wertung", the quiz page uses "Frage n von 4"; derivations are collapsed (§10) with the worked example visible above; appear animations are transform-only (opacity fades failed contrast checks mid-animation); `/module/{slug}/` uses Astro's static redirect page.

**Reasoning:** Brief §10 and accessibility take precedence over the static prototype.

## D-34 · 2026-10-22 · Claude

**Question:** Rendering details found during integration.

**Decision:** `<Num>`/`<Fact>` render with `set:text` (formatting could otherwise add spaces around values); `.formula` is a block with `width: fit-content` where plain child `<span>`s are lines and inline elements stay inline; Vitest's persistent module cache is off because the registries use `import.meta.glob` and new files would stay invisible.

**Reasoning:** Bugs reported by the template agent; fixed centrally so no module has to work around them.

## D-35 · 2026-10-23 · Claude

**Question:** Deviations of the Riskometer page from the prototype?

**Decision:** All four pairs active; H1 follows the pair (Franken / Euro / Yen). Event markers sit on the highest weekly value between the anchor week and the daily-peak week (otherwise the 2015 dot would sit at the foot of the cliff, because the 15.01. return leaves the 21-day window the day after the daily peak). Under 640 px the event buttons become a chip row below the chart (44 px hit areas would overlap on the chart). Year tags lift a row when they collide. The chart fills the card height with 12 px labels. Deep links `?pair=EURUSD&event=gfc-2008` are read on load and written after an interaction. Default events and all timings in `RISKOMETER_UI` (`src/lib/riskometer-ui.ts`).

**Reasoning:** Fidelity where the prototype works, deviations where real data or touch targets require it.

## D-36 · 2026-10-23 · Claude

**Question:** `@axe-core/playwright` pulled a second, newer `playwright-core`, which broke `astro check` on the e2e specs.

**Decision:** `overrides: { "playwright-core": "1.56.1" }` in `package.json`, matching `@playwright/test` (D-14).

**Reasoning:** One Playwright version in the tree, types agree, no casts in the specs.

## D-37 · 2026-10-23 · Claude

**Question:** Plus Jakarta Sans has no Greek glyphs; system fallbacks drew ν like a "v".

**Decision:** STIX Two Text is the second family in `--ff-font-ui`, so Greek letters in UI text fall back per glyph to the formula font (its Greek subset is self-hosted and loaded only when needed via `unicode-range`).

**Reasoning:** Δ, Γ, ν, Θ, ρ, σ look the same in labels and formulas; no extra request for pages without Greek letters.

## D-38 · 2026-10-23 · Claude

**Question:** Choices made while building modules 04, 05, 07 and 08 that Dario may want to change?

**Decision:** Kept as built, each in one config object:

- 04: strikes named by spot delta (USD/CHF practice is premium-adjusted; the desk box says so) — `strikeMarkers` in `src/lib/moneyness.ts`; the moneyness explorer starts at the exact forward (pure time value 126.5 pips), the builder at the rounded strike 0.7930 (126.69 pips), explained in the text; short-put maximum loss shown as K − premium ("if USD/CHF fell to zero").
- 05: the carry part of theta is shown as the rounded residual so −69 + 38 = −31 on screen (extends D-26); rho mode has sliders for both interest rates; lab limits in `LAB_CONFIG`, `LEVER_CONFIG`, `GT_CONFIG`.
- 07: barriers at spot × 1.03 / × 0.97 (same as the MC window barrier), hypothetical orders in the franc-shock replay (stop at 1.1950, knock-outs at 1.18/1.15/1.10/1.05), fill at the first fixing beyond the level — `M07_CONFIG`.
- 08: products compared with a forward hedge of the planned amount (accumulator, decumulator, TARF); pivot TARF, TPF, RTPF show gains/coupons received; start scenarios, speeds and DCI defaults in `PATHSIM_CONFIG` and `DCI_CONFIG`.

**Reasoning:** D-22; the module texts explain each choice where it matters.

## D-39 · 2026-10-23 · Claude

**Question:** How is content quality checked beyond the authors' own tests?

**Decision:** Every module gets a second, fresh review agent that did not write it (finance correctness, numbers, didactics, DE/EN language, figures at 1440/390 px, accessibility) and fixes findings directly. First round (modules 04, 05, 07, 08) corrected, among others: "spot has no vol" → "no vega"; reversed cause and effect for vanna/volga; gamma/vega peaks described "at the strike" although on the spot axis they sit near ATMF; sign wording ("kostet CHF −45"); unequal bar tracks in the levers figure; module-specific findings are in the review reports. Shared follow-ups done centrally: the quiz card strips a leading verdict word from explanations, Markdown tables render in a focusable scroll region, nice ticks tolerate float noise, stat rows without a symbol use two columns, italic variables get a hair space, glossary corrections (intrinsic value, gamma near ATMF, accumulator knock-out at the barrier, target = profit goal) and new terms vanna, volga, premium-adjusted delta.

**Reasoning:** Authors miss their own mistakes; an adversarial second reader is cheap compared to a wrong explanation in a learning tool.

## D-40 · 2026-10-23 · Claude

**Question:** How is the single file built with the smallest change to the existing code?
**Decision:**

- `npm run build` runs the Astro build as before and then `scripts/build-offline.ts`. The script reads every pre-rendered page from `dist/`, keeps the content of `#main`, the top navigation and the footer per language, and packs all pages as JSON, gzip and Base64 into one `<script type="application/octet-stream">` block (about 0.45 MB instead of 2.2 MB). Redirect pages become route aliases.
- Islands: Astro's server markup is dropped, `component-url` becomes `data-ff-island="Name"`, and one esbuild bundle (IIFE, Preact, all 38 islands, the page scripts from `src/client/`, `fflate` for gunzip) renders them with the same props. The page scripts listen to `astro:page-load` as on the web, so they run unchanged after each route change.
- Router (`src/offline/main.tsx`): `#/path/?query#anchor`, aliases, 404 per language, scroll memory for back/forward, focus to `#main` plus an announcement on every route change, internal links rewritten from `/…` to `#/…`. Clicks change the route with `history.pushState` (no navigation at all, so embedded web views such as the iPad Files preview cannot block it), with a plain hash change as fallback; back/forward via `popstate` and `hashchange`. Islands read and write their query through `src/lib/url.ts`, which works for both hash routes and normal URLs.
- Fonts: the Fontsource woff2 subsets that the pages need (Plus Jakarta Sans latin 400–800, JetBrains Mono latin 500/600, STIX Two Text latin and greek 400/500 regular/italic) as data URIs; other subsets are dropped.
- CSP: `default-src 'none'`; the one inline script is allowed by its SHA-256 hash; styles inline; images and fonts only from `data:`; `connect-src 'none'`. The build fails if anything still points outside the file or the file exceeds 5 MB.
- Monte Carlo: `createInlineMcClient` runs `priceChunked` in chunks of 1’000 paths and yields to the browser between chunks; same random sequence and result as the worker version (unit test), so D-28 stays valid except for "in a Web Worker".
- The Astro web build (`dist/`) stays as a build stage and as the test harness for the detailed component tests (`npm run e2e:web`, incl. axe); it is not deployed.
- CI runs on `ubuntu-24.04` because Playwright 1.56 has no browser builds for Ubuntu 26.04 (the `ubuntu-latest` image since October 2026). WebKit cannot be installed in the Claude sandbox, so the WebKit runs happen in CI.
- Releases are tagged `vYYYY.MM.DD-<run>` and titled with the ECB data date.

**Reasoning:** Reuses the whole Astro pipeline (MDX, `<Num>`, i18n, components) instead of rebuilding the site as a client-only app; the only new runtime code is the router and the island mount. All settings are in the build script (D-22).
