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
- Device hardening after a review round (three reviewers for iPad WebKit, PC `file://` browsers and router state; every finding checked by a skeptic): touches that start on an SVG chart handle with `touch-action: none` cancel page panning in JS, and handles that drag only sideways (`touch-action: pan-y`) do so once the first move is clearly sideways (`src/client/svg-touch.ts`), because iPadOS before WebKit bug 309293 (fixed March 2026) ignores touch-action on SVG child elements; animation loops clamp the frame step (`src/lib/anim.ts`; a negative first step crashed the franc-shock replay); ResizeObserver updates are applied in the next frame; unknown English routes fall back to the 404 page; the data block stays in the document so a copy saved with Ctrl+S still starts (an incomplete copy shows a message instead of hanging); in-page anchors mark the target (`data-target`, stands in for `:target`) and move focus there; a link to the open page adds no history entry and keeps the island's state (a remount for another query replaces the entry); "Weiterlernen" follows progress changes on the page; the learning path card is the containing block of its hidden labels (they widened the page to 998 px between 640 and 1000 px).

**Reasoning:** Reuses the whole Astro pipeline (MDX, `<Num>`, i18n, components) instead of rebuilding the site as a client-only app; the only new runtime code is the router and the island mount. All settings are in the build script (D-22).

## D-41 · 2026-10-23 · Review 23.10.2026

**Transport-Regel: die Datei übersteht den Mailversand**

**Question:** The file reaches the work PC by e-mail. On the way, backslash + n turned into a real line break; in Version 1 one such escape (the word-split regex `/[ \t\r\n]+/`) was a SyntaxError and the page stayed at "loading". How do we make sure that cannot happen again?
**Decision:** The rule is built into `scripts/build-offline.ts` (helpers in `scripts/lib/transport.ts`, `semantics.ts`, `filecheck.ts`, `version.ts`). Revised by the binding supplement of 23.10.2026:

- The rule holds for every byte of the file (HTML, CSS, JS): only 0x0A and 0x20–0x7E, and only the escapes that arrived intact in the mail test: `\uXXXX` (exactly 4 hex digits), `\\`, `\/`, `\.`, `\{`, `\}`, `\d`, `\s`, `\w`, `\B`.
- esbuild with `charset: 'ascii'` and `supported: { 'unicode-escapes': false }`, so characters above U+FFFF come as surrogate pairs, never as `\u{…}`. esbuild leaves non-ASCII raw in regex literals, so the source writes them as `\uXXXX` (Quiz.tsx, en and em dash).
- The scanner reads backslash pairs from left to right and rewrites only three things, each with the same meaning in strings, templates, regular expressions with and without `u`/`v` and character classes: `\n \r \t \v \f` → `\u000a \u000d \u0009 \u000b \u000c`; `\xHH` → `\u00hh`; an escaped backslash directly before n, r or t → `\u005c`. Every other escape stays; if it is not on the list, the build stops with script index, position and context. Back-references, `\b`, `\0`, `\u{`, `\p{`, `String.raw` and a trailing backslash are never reinterpreted.
- Proof of meaning: esbuild output and written script are parsed with acorn (`ecmaVersion: 'latest'`) and compared without start, end and raw; strings by value (a directive by its raw text), templates by their cooked value (tagged templates also raw), regular expressions by flags and the pattern tree of `@eslint-community/regexpp` (code points). Any difference stops the build. devDependencies `acorn` 8.19.0 and `@eslint-community/regexpp` 4.12.2 (exact versions).
- Every check runs on the bytes of the written file read back from disk (a temporary file, renamed only when everything passes): bytes, escapes, mail simulation (also the worst case `\r` → CR, `\t` → TAB), no ES module, data block plain base64 and never compiled, `vm.Script` only for the two classic scripts (main script, diagnostics), the CSS has only escapes that start with a tested pair and end unambiguously (a space follows when a hex digit or whitespace comes next) and decodes to its source, the lengths the diagnostics expects are the characters as written.
- HTML text as `&#N;`. CSS escapes only `\d…` and `\B…`: today `\d7` (×) and `\B7` (· in the glossary). Any other special character in CSS goes into the markup as an HTML entity and is shown with `content: attr(data-…)`; the build stops otherwise.
- CSP `script-src 'unsafe-inline'` instead of a sha256 hash: a character changed in transport must not block the script silently. `default-src 'none'`, `connect-src 'none'` and all other locks stay.
- Start diagnostics (`src/offline/diagnose.ts`, before the data block): `window.__FF_OFFLINE__` is the first statement of the main script, `window.__FF_READY__` is set once the first page is on screen. If it is not ready after 4 s, a yellow box shows version, both flags, the lengths of data block and main script against the build, «lokal» or «Netzlaufwerk» (no path, no server name), browser, CSP violations and JS errors (text only).
- The version number lives only in `OFFLINE_VERSION` (`scripts/lib/version.ts`); date = build date in Europe/Zurich, from `SOURCE_DATE_EPOCH` when set. `release/forward-first.html` and `release/forward-first-v5.html` are byte-identical (SHA-256 checked by the build and the offline tests).
- Browser test (Playwright over `file://`): umlauts, «», ’, Δ and σ in DE and EN and × and · from the CSS arrive on screen.

**Reasoning:** The mail test showed exactly which escapes arrive intact; everything else is rewritten into those forms or fails the build, so a broken file can no longer be produced. The diagnostics box makes a future transport problem visible on the device instead of a silent "loading".

## D-42 · 2026-10-23 · Review 23.10.2026

**Tween-Regel: Werte, die einem Regler folgen, laufen nicht hinterher**

**Question:** Two device reports: in "Option oder Forward?" (04.1) the dots jumped off their lines while the slider moved, and in the barrier lab (07.2) the parity bar ran in bursts. Measured cause: animations on values that follow a slider (a 300 ms ease-in-out restarted on every input starts at speed zero; a CSS width transition restarted on every change).
**Decision:**

- `useTween`: a target that arrives while an animation runs or within its duration after the last change jumps; only a single, isolated change (toggle, preset, reset) animates (`tweenShouldJump`, `src/lib/anim.ts`). Covers mouse, touch and keyboard, also where no drag flag is set.
- Dots that sit on a line are never tweened: OptionVsForward uses the costs directly; HedgeShaper and HedgeCompare take the dot height from the same samples as the drawn curve (`polylineAt`), so the dot stays on the line also while a block toggle morphs the curve.
- No CSS transition on a property that follows a slider: the barrier lab's parity bars and the CarryCushion meter lost theirs. Audited and kept (discrete changes only): button and hover effects, toggle switches, the PriceDrivers arrows, the HedgeCompare row reordering, the path simulator's ensemble bars, the derivation icon.
- Parity bar: padding only when a label is shown, so a zero KO share is zero pixels wide (was a 12 px stripe).
- Barrier lab time to expiry in days 1–365 (T = days/365, shown in days, weeks or months): one week step moved the bar by up to 95 px at short maturities. The start value is 91.25 days, i.e. exactly the example's T = 0.25, so every number of the running example is unchanged; the "2 weeks" example of 07.2 is now 14 days (T = 14/365 instead of 2/52; the values move by 0.1 pip and 0.2 gamma and come via `<Num>`).
- Supplement of 23.10.2026 (points 9 to 11): at the latest two frames after the last input nothing moves.
  - The tween rule also jumps within `duration` of an input on any range slider or a pointer drag of more than 4 px inside a figure (one tracker in `src/components/ui/hooks.ts`), so values that follow a slider only now and then (an axis range, a label position) no longer glide after it. `useTween` decides in a layout effect, so a jump is drawn in the same frame as the slider, also through a chain of tweens.
  - While a slider or a chart handle moves, and for a quick series of clicks in the same figure (again within 300 ms), finite CSS animations and transitions of that figure end at once (Web Animations `finish()`): pops, rings, fade-ins, the radius transition of the path simulator. A single click keeps its animation; endless decorative pulses (off under reduced motion) are not touched.
  - HedgeCompare: the ranking rows jump while the rate is dragged or a slider moves (glide only after a single change). Cash-and-carry: crossing the fair forward while dragging shows the new steps at once (the step-by-step replay only after a single change). The panel-level drag flag counts only a pointer down on a range slider, so the reset button and toggles in the same panel animate again.
  - Barrier lab parity as shown (D-26): KO and vanilla rounded, KI the rest (`parityShown`), so the shown KO + KI equals the shown vanilla; the bars use the unrounded values.
- Tests over `file://` on the rendered geometry (`getBoundingClientRect`, `getScreenCTM`), frame by frame (`tests/offline/frames.ts`):
  - `sliders.spec.ts`: every slider on every German page with an interactive figure (37 pages), mouse drag in 2 px steps and a held arrow key (repeated keydown); from the second frame after the last input nothing moves, dots within 1 px of their lines, parity bars within 1 px of their width. A running playback is paused first (a deliberate animation of its own); a Monte Carlo value that arrives later counts like an input.
  - `smooth.spec.ts`: dots on their lines in three figures with the dots really measured; touch on a chart handle over the DevTools protocol in Chromium; a single toggle, preset and reset still animate (at least 5 different frames); a quick series of toggles or presets is still from the second frame after the last click; barrier lab parity against `labNumbers` for six states.
  - Not tested: native range sliders by touch (not automatable); touch frame by frame in WebKit (the WebKit projects test the handle behaviour in `offline.spec.ts`); the English pages separately (same islands).

**Reasoning:** The maths was right; the animations were wrong. The rule lives in one hook and one pure function, so every island follows it.

## D-43 · 2026-10-23 · Review 23.10.2026

**Maximalverlust-Klassen statt «nicht begrenzt»**

**Question:** The texts said the loss of the leveraged structures was "not limited". USD/CHF cannot fall below zero, so for a dollar buyer the loss is finite. How do we describe the worst case correctly?
**Decision:** Three terms, computed in `src/lib/fx/mc/maxloss.ts` from the product parameters:

- «kein eingebauter Verluststopp» / "no built-in stop on losses": every one of these structures.
- «sehr hoch, aber endlich» / "very high, but finite": accumulator, TARF, TPF, structured hedge. Bound = fixings × leverage × N × strike (all fixings at S = 0). Check values: accumulator CHF 1’609’922, TARF 1’804’296, TPF 1’872’000; pivot TARF below 1’800’595, RTPF below 1’852’800.
- «theoretisch unbegrenzt» / "theoretically unlimited": decumulator, and pivot TARF and RTPF upwards (they sell or pay with leverage above a level).
- The payoff kernels on a path with every fixing at S = 0 give exactly −bound; for decumulator, pivot TARF and RTPF the loss grows linearly with S without limit (tests).
- Matrix `LossKind` 'unlimited' → 'noStop' (structured, accumulator, tarf, tpf) and 'unbounded' (pivotTarf, rtpf), both severity 3; chips «hoch, ohne Stopp» / «theoretisch unbegrenzt»; `pm.clip` «läuft aus dem Bild» / «off the chart» (supplement point 16; was «Verlust geht weiter»: the curve only leaves the chart). Takeaways: «Der Gewinn ist gedeckelt, für den Verlust gibt es keinen eingebauten Stopp.» Quiz m09-q3 names the theoretical TARF maximum next to the worst simulated path.
- The risk boxes explain the bound in words (e.g. "USD 2’080’000 bought at the strike, worth nothing") rather than as a product with the rounded strike, which would not add up on screen.
- Content lint: in modules 08/09 (MDX, quiz) and the product matrix, structure blocks and path simulator texts no «nicht begrenzt» / «not limited», no «ohne Boden/Grenze» / «no floor», no "gain capped, loss not" formula; «unbegrenzt» / «unlimited» only together with «theoretisch» / «theoretically». The 09/4 carry sentence now says "no further cushion and no stop; in the extreme the whole amount is lost".

- Supplement of 23.10.2026 (point 16): `MaxLoss` is typed per side, `down` and `up` each `{ kind: 'finite', chf }` or `{ kind: 'unbounded' }` (a side without loss is finite 0); no numeric `Infinity`, no `total`. `finiteChf()` throws on an unbounded side, so ∞ or NaN never reach a formatter (test). The tests run on the app's own products and kernels (`M08_PRODUCTS`, `M08_MAX_LOSS`, `simProduct`, `fairProduct`). `productMaxLoss`/`lossKindOf` tie the matrix chips to the typed bound. The text alternative of a clipped curve (`pm.clipAlt`) names the product and points to its «Worst Case» chip; the 09.3 caption says the same. Content lint bans «Verlust geht weiter», «loss continues» and «aus dem Chart» in the 08/09 texts and the matrix.

**Reasoning:** "Not limited" was wrong for the buyer and blurred the real point: there is no stop, and the bound, while finite, is several times the notional at stake in any normal scenario.

## D-44 · 2026-10-23 · Review 23.10.2026

**Forward-Konvention: T = 0.25 gegen 90/360 offen trennen**

**Question:** 02.2 said "T = days/365" but used T = 0.25 (91.25 days) against 90/360 in the money market. Which comparison is right?
**Decision:** The tool keeps T = 0.25 as a stylised convention for "3 months" in both worlds and says so (money market 90/360, option model 0.25 years = 91.25 days). Then 02.2 shows the like-for-like case: for exactly 90 days (T = 90/365) the continuous formula gives 0.79313, 0.65 pips above the money market (0.7930607). Supplement of 23.10.2026 (point 14): the gap comes only from using the same 3.5 % once as simple interest over 90/360 and once as continuous interest over 90/365 (the larger money-market year fraction outweighs continuous compounding, which explains the plus sign). It is no arbitrage gain and the text says so: with the term-matched continuous rate r = ln(1 + r_MM · 90/360) / (90/365) = 3.533 % (core function `continuousFromSimple`, nums `m02.rfCont90`, `m02.fwdCont90Conv`) the continuous formula gives the same forward for the same end date (unit test, tolerance 1e-12). New glossary entry «Stetige Verzinsung»; the quiz distractor m02-q2 explains the unconverted rate; ParityPaths labels the gap «Konvention, kein Arbitragegewinn». Merksatz: compare forwards only with the same end date and the same convention. The derivation "Woher die 0.3 Pips kommen" says it holds at equal T; the cross references in 04/1 and 09/2 say «bei gleichem T = 0.25». Both 90-day forwards are shown with 6 decimals so the gap adds up on screen (D-26 rule). New nums `m02.fwdCont90`, `m02.fwdCont90DiffPips`, `m02.daysT`. Convention labels (90/360, 90/365) stay typed, as elsewhere.

**Reasoning:** The 0.3-pip gap was correct but only under equal T; without saying so, a reader could think continuous compounding always gives a lower forward.

## D-45 · 2026-10-23 · Review 23.10.2026

**Risk Reversal und Zero-Cost-Collar trennen**

**Question:** 06.2 treated the 25Δ risk reversal as zero cost. At a flat 8 % vol the 25Δ call 0.8150 costs 47.2659 pips and the 25Δ put 0.7730 brings 49.5022 pips: net call − put −2.2362 pips, the importer receives CHF 223.62.
**Decision:** Two cases: the 25Δ risk reversal (strikes fixed by the delta convention, net premium rarely zero) and the zero-cost collar (one strike chosen, the other solved for zero net premium: put 0.7721506, shown 0.7722, 8.49 pips below the 25Δ put). The rest of 06.2 works with the zero-cost collar («Der Zero-Cost-Collar des Importeurs»); takeaway and derivation step 3 separate the two. Supplement of 23.10.2026 (point 15):

- Strike convention: 06.2 (and 06.3) use spot-delta strikes without premium adjustment at the flat vol, rounded to the 5-pip grid of the payoff builder (0.8150 / 0.7730; `m06.strikeStepPips`). The grid is part of the definition: on the grid the spot delta is 0.2514 / −0.2525; without it the strikes are 0.8151 / 0.7728 as in 04.3. 06.4 places the smile pillars by forward delta. New glossary entry «Spot- und Forward-Delta»; aliases for premium adjustment.
- Premiums and net unrounded: call 47.2659, put 49.5022, net −2.2362 pips (CHF −223.62); `m06.rr25NetPips` and `m06.rr25NetChf` are signed call − put. Shown per D-26 as 47.27 − 49.50 = −2.23 (`m06.rr25NetShownPips`, the difference of the shown legs); the next sentence gives the unrounded −2.2362 pips and CHF −223.62.
- Zero-cost strike solved unrounded (0.7721506, residual below 1e-6 CHF, test) and rounded only for display: 6 decimals (0.772151) wherever an amount comes from it (06.2, quiz m06-q2: strike × notional and CHF 12’151 add up), otherwise 0.7722; the gap 0.7730 − 0.772151 = 8.49 pips. Registry entry `m06.rrCallPips` removed (it duplicated `m06.rr25CallPips` at 1 decimal). Payoff builder: «Zero-Cost-Collar» only while the net premium is zero, otherwise «Collar (Risk Reversal)» (template id unchanged); the seagull description no longer claims zero cost in every state. Product matrix, 09/2 point 5 and the glossary follow (alias «Collar» only on zero-cost-collar). New nums `m06.rr25PutK`, `m06.rr25NetPips`, `m06.rr25NetChf`, `m06.rrPutGapPips`.

**Reasoning:** Market convention: a risk reversal is quoted by delta; zero cost is a separate choice of strikes.

## D-46 · 2026-10-23 · Review 23.10.2026

**Wahrscheinlichkeiten sind risikoneutral, keine Prognose**

**Question:** The tool shows probabilities (knock-out, touch, target, conversion, "chance in the money") without saying in which model.
**Decision:** Every model probability carries «risikoneutral, keine Prognose» / «risk-neutral, not a forecast» (MDX in brackets, calculators as part of the sub-label); the first note of a section links the new glossary entry «Risikoneutral». Supplement of 23.10.2026 (point 13), replacing the first definition: «risikoneutral» is the pricing measure (the rate drifts with rd − rf, the expected value at expiry is the forward, probabilities under this measure belong to the price and are no forecast); constant vol, a lognormal distribution and no jumps are additional assumptions of the Garman-Kohlhagen model, not part of the measure. Glossary and texts (01/1, 02/1, 04/4, 07/3, 07/4, 08/1, 09/1, 09/4, HedgeOutcome) keep the two apart («unter dem risikoneutralen Mass», never «risikoneutrales Modell»); 09/1 derives E[S_T] = F from interest-rate parity. A wording test guards it. A content-lint rule (`RISK_NEUTRAL_NUMS`) fails when a listed probability num appears without the note in its block. Module 01's rise/fall probabilities were driftless before; they now come from the risk-neutral model (N(d2) with drift), which moves them from 11 % to 7 % (rise to 0.84) and from 10 % to 15 % (fall to 0.76); otherwise the label would be false. The ±1σ band stays driftless around spot; 01/1 shows that with drift the same band holds 67 % (`m01.bandProb`) against 68 % without (`m01.bandProbNoDrift`).

**Reasoning:** A learner must not read a pricing probability as a forecast; the same label everywhere makes the model visible.

## D-47 · 2026-10-23 · Review 23.10.2026

**Moneyness und innerer Wert: gegen Forward und gegen Spot**

**Question:** 04.3 presented forward moneyness and the intrinsic value against the forward as the only definitions; the quiz called the spot answer a "typical mistake".
**Decision:** 04.3 names both conventions: spot moneyness (strike vs spot) and forward moneyness (strike vs forward); the tool uses forward moneyness because a European option is only exercised at expiry. Example: call 0.7990 is 10 pips below spot (spot moneyness: ITM) and 59.7 pips above the forward (forward moneyness: OTM). DF · max(F − K, 0) is the «innerer Wert gegen den Forward»; one sentence names the classic max(S − K, 0), the value of immediate exercise that a European option does not have. ITM call K = 0.7730: premium 249.8 pips, intrinsic value against the forward 200.3, time value 49.5; against the spot it would be 270.0 and −20.2 pips — which is why the tool measures at the forward. Quiz m04-q3 asks «in Forward-Moneyness, wie in diesem Tool»; the spot answer "holds in spot moneyness; the question asked for forward moneyness". Check m04-c3 and the glossary (moneyness, itm, otm, atm, intrinsic-value, time-value) follow. New nums `m04.itmSpotIntrinsicPips`, `m04.itmSpotTimePips`. Supplement of 23.10.2026 (point 19): forward moneyness is this tool's chosen convention, not a property of European options; both conventions are common (04.3, takeaway, quiz m04-q3, glossary). The negative time value against the spot follows from the split, because the USD rate is above the CHF rate; it is neither a negative premium (the call costs 249.8 pips) nor an arbitrage (no early exercise; only the forward value can be locked in today). Shown so that it adds up: 270.0 − 200.3 = 69.7 and 49.5 − 69.7 = −20.2 (`m04.itmSpotGapPips`); 05/2 refers to it where the price curve runs below the expiry payoff.

**Reasoning:** Both conventions are used in practice; teaching one as the only truth would mislead.

## D-48 · 2026-10-23 · Review 23.10.2026

**EZB-Fixings im Replay und Valuta beim Swap (C4, C5) – Umsetzungsentscheide**

**Decision:**

- 07.4: the franc-shock replay is «ein hypothetisches Szenario mit täglichen EZB-Referenzkursen» everywhere (caption, title, aha, status, note, quiz). ECB reference rates are published for information and are not tradable prices (source `ecb-reference-rates-method`, its "Belegt" line extended; no new fact because the statement carries no value). A stop-loss is filled at the next tradable price (where depended on minute and liquidity; the replay simplifies to the next fixing); a knock-out is not a trade, the option simply expires; with daily observation against a fixing all four barriers go with the same fixing, with continuous observation the first price beyond the barrier counts under the term sheet. The table columns read «Typ» and «Fixing» (a knock-out is not an order); the chart's aha title is shortened to «Hypothetisches Szenario» because annotation titles do not wrap.
- 03.1: a spot deal settles T+2, so the firm pays the supplier on the spot value date, not "today"; a shorter near leg (value today or tomorrow) exists at a slightly different rate. 03.3: the roll swap is dealt two business days before the old maturity, so its near leg has the old forward's value date; «Spot beim Abschluss des Rolls» replaces «Spot am Roll-Datum» in text, caption, slider and quiz. T+2 and "two business days" are market conventions written as text.
- Barrier lab maturity in days: see D-42.
- Supplement of 23.10.2026 (point 17): the replay is nowhere an executable historical transaction, also not in tooltips, ARIA texts or the quiz (m07-c4): every fill is an assumption, stop, put and barriers are «angenommene Beispiele, keine historischen Geschäfte», a knock-out «erlischt nach den angenommenen Bedingungen» (daily observation against the ECB fixing). The replay has no rebates; texts say so, a rebate would be a separate row, and a unit test fails when a rebate appears in its config. The glossary knock-out entry follows: extinguished under the terms of the deal, a rebate paid separately, in-out parity only without a rebate.
- Supplement of 23.10.2026 (point 18): 03.1 and 03.3 say «zwei Bankarbeitstage, nach den Feiertagskalendern beider Währungen»; the tool counts in days without a holiday calendar and says so. Test in the existing model (`src/lib/m03/roll.ts`): on the old maturity the USD of the forward and of the near leg cancel exactly.

**Reasoning:** Precision on what a reference rate is and when money moves; both points are textbook market practice.

## D-49 · 2026-10-23 · Supplement 23.10.2026

**Delta ist keine Wahrscheinlichkeit**

**Question:** 04.3 said the 25Δ call is «grob auch die Chance» to end in the money («in einem von vier Fällen»). Delta is a price sensitivity; how do we show the chance without mixing the two?
**Decision:** (supplement point 12)

- New core function `probItm` in `src/lib/fx/vanilla.ts`: N(d2) for a call, N(−d2) for a put, in the money test with ½ at the strike at T ≤ 0 or zero vol (same edge cases as `digitalCash`, so probItm = digital / DF).
- 04.3 explains delta as a price sensitivity and gets the subsection «Delta ist keine Wahrscheinlichkeit» / "Delta is not a probability" with a table of delta and the risk-neutral chance at the exact delta strikes of module 04: 25Δ call 0.815145 → 23.96 %, 25Δ put 0.772752 → 26.51 %, 10Δ call → 9.40 %, 10Δ put → 10.81 %, each «risikoneutral, keine Prognose». «Delta ≈ Chance» stays only as a rule of thumb with these values beside it. N(d2) is the chance «im Modell (Garman-Kohlhagen, flache Vola)»; with a smile the market-implied chance differs (module 06).
- Moneyness explorer: its own stat row «Chance im Geld» (bei Verfall · risikoneutral, keine Prognose) next to delta; the 25Δ/10Δ notes show both values. Glossary: new entry «Chance im Geld» (aliases N(d2), ITM-Wahrscheinlichkeit …), delta and delta-25 reworded.
- Tests: delta and chance as two separate values at the four strikes (unrounded with tolerance and as shown in DE and EN); a wording guard keeps «Delta ist die Chance» and «einer von vier Fällen» out of every text, quiz, dictionary and the glossary.

**Reasoning:** Delta and the chance coincide only roughly and for different reasons; a learner who prices with delta as a probability makes systematic mistakes, especially for puts.
