# Progress

Working branch: `claude/forward-first-v5` (Version 6 since Review 2 of 23.10.2026; Version 5 from `claude/forward-first-v1` at 1f0f4ff). Mode: phases without stops (D-16), uncertain choices kept easy to change (D-22).

| Phase | Content                                                                                          | Status                                                                |
| ----- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| 0     | Setup: scaffold, tooling, tokens, layout shell, i18n routing, CI, memory files                   | done                                                                  |
| 1     | Calculation core without Monte Carlo                                                             | done, independently verified (`docs/reference/xcheck/`)               |
| 2     | Design system, home page, Wow moment, module template                                            | done                                                                  |
| 3     | Module 05 vertical slice (Greeks lab, content, quiz, progress)                                   | done, reviewed                                                        |
| 4     | Riskometer: pipeline, method, events, page, mini gauge                                           | done                                                                  |
| 5     | Modules 01–04 incl. session clock, calculators, payoff builder                                   | done, reviewed                                                        |
| 6     | Monte Carlo engine, products, modules 06–09, path simulator, matrix                              | done, reviewed                                                        |
| 7     | English complete, glossary, about and methodology                                                | written alongside each module; English review open (after Dario's go) |
| 7b    | Offline file `forward-first.html` (D-13, D-40)                                                   | done; Version 4 tested by Dario on work PC and iPad                   |
| 7c    | Version 5 after review and device test of 23.10.2026, with the binding supplement (D-41 to D-50) | done                                                                  |
| 7d    | Version 6: subject-matter corrections from Review 2 (D-51 to D-62)                               | done; waiting for Dario's test of Version 6                           |
| 8     | Polish: transitions, micro-interactions, 390 px and iPad, visual comparison                      | open                                                                  |
| 9     | Verification and release: tests, E2E in Chromium and WebKit, fact check, README                  | open                                                                  |

## Stop point (Dario, 23.10.2026)

The branch is in PR #1 against `main` and must not be merged: Dario tests `release/forward-first-v6.html` on the iPad and on the work PC (sent by mail) first. Phases 8 and 9 start only after his go.

## Version 5 (review 23.10.2026)

- **A · Transport (D-41):** plain ASCII file, every script escape rewritten to a mail-tested form, the build fails on anything else; CSP `script-src 'unsafe-inline'`; start diagnostics box after 4 s; `OFFLINE_VERSION` 5, copy `release/forward-first-v5.html`. No new escape kinds (only `\uXXXX`, `\d`, `\s`, `\w`, `\B`, `\/`, `\{`, `\}`).
- **B · Dragging (D-42):** tween rule in `useTween`, dots on their lines, parity bar without transition, barrier lab maturity in days; frame-by-frame tests.
- **C · Content (D-43 to D-48):** max-loss classes, forward conventions, risk reversal vs zero-cost collar, ECB fixings as non-tradable reference rates, value dates of spot and roll, risk-neutral probabilities, spot vs forward moneyness and intrinsic value. DE and EN together; every new number via `<Num>` with a tested check value.

## Supplement to Version 5 (binding, 23.10.2026)

- **A · Transport (D-41):** the rule holds for every byte; CSS escapes only `\d7` (×) and `\B7` (·); esbuild with `unicode-escapes` off; the scanner rewrites only `\n \r \t \v \f`, `\xHH` and `\\` before n/r/t and stops the build on anything else (script index, position, context); acorn + regexpp prove the meaning unchanged; every check runs on the bytes read back from disk; `__FF_READY__` next to `__FF_OFFLINE__`; location only «lokal»/«Netzlaufwerk»; version only in `scripts/lib/version.ts`; both release files byte-identical; browser check of special characters.
- **B · Animation (D-42):** nothing moves two frames after the last input: slider-aware tween rule in a layout effect, CSS animations of a figure end while a slider or handle moves and in quick click series; every slider of 37 pages tested with mouse and held arrow key on the rendered geometry; touch over CDP in Chromium for a chart handle; single toggle, preset and reset still animate; barrier lab parity against `labNumbers` (shown KO + KI = vanilla).
- **C · Content (D-43 to D-49):** delta is not a probability (N(d2), new core function), risk-neutral measure vs model assumptions, forward gap as convention, risk reversal unrounded with the delta convention, typed max loss, ECB replay never a historical trade, value dates with both holiday calendars, forward moneyness as the tool's convention. Tests: removed keys gone, every internal link and anchor valid, no check values in components, texts or dictionaries.
- **D · Names (D-50):** commercial banks, firms, clients, real persons and product brands stay forbidden; central banks as sources and model authors are allowed.

## Version 6 (Review 2, 23.10.2026)

Subject-matter corrections only; the mechanics stay. DE and EN together, every new number via `<Num>` from the core with a tested check value, D-26 holds.

- **1 · Double knock-in (D-51):** a narrower corridor makes the double knock-out cheaper and the double knock-in dearer; in-out parity «ohne Rebate» everywhere.
- **2 · Gamma peak (D-52):** across spot at d1 = −σ√T (spot 0.79805, Γ 12.3786), derivation step 5, rule of thumb «Forward nahe am Strike»; vega mirror case d1 = +σ√T in 05.3.
- **3 · Alpha (D-53):** risk-adjusted excess return over the forward or money market (`jensen-1968`).
- **4 · Carry (D-54):** CHF 6’939.28 on USD 1 Mio. at maturity (USD 991’325.90 today) vs CHF 7’000.00 on USD 1 Mio. today, `moneyMarketCarry`.
- **5 · Coupons (D-55):** TPF and RTPF pay the contractual coupon in modules 08 and 09, matrix, building blocks and simulator (6 × CHF 7’754 = CHF 46’524; RTPF CHF 48’630); fair coupon only «± Standardfehler».
- **6 · Methodology (D-56):** manual Release workflow, validation rules from `validate.ts`, frozen data snapshot; Riskometer labels «Letzter Stand» instead of «Heute».
- **7 · Interest parity (D-57):** forward from spot and rates, not from an expectation; the cross-currency basis comes on top in the market (`hull-2012`, `bis-2016-cip`).
- **8 · Last TARF fixing (D-58):** full notional at fixing ∓ what is left to the target; market variants per term sheet.
- **9 · Barrier and jump (D-59):** a jump past a barrier triggers it; only the pricing formulas assume a continuous rate.
- **10 · Spot delta (D-60):** deep in the money e^(−r_f·T) ≈ 0.991, forward delta 1.
- **11 · Vega hedge (D-61):** not with spot or forwards; other options, less often volatility or variance swaps.
- **12 · Loading text (D-62):** says what a view without JavaScript (iPad Files preview) means and what to do.
- **Sources:** `hull-2012` (ISBN, chapters), `bis-2016-cip`, `jensen-1968`, `jewitt-2015` (further reading only); D-50 extended: publishers and authors allowed in sources, books by ISBN, no links to copies.
- **Guards:** `RETIRED_V6` in the content lint (56 old wordings, DE and EN, in every text file, the module registry, the loading text and the README); unit tests per point (`tests/unit/*-v6.test.ts`). `OFFLINE_VERSION` 6, copy `release/forward-first-v6.html`.
- **Data:** not updated. `npm run data:fetch` could not reach the ECB from the sandbox (proxy 403); the data date stays 14.09.2026.
- **Independent audit (D-63):** six auditors and a skeptic per finding; nine confirmed findings fixed (vega of exotics, model-free parities across jumps, barrier option price, cross-currency basis in 03.4, risk-neutral label in quiz 09, quiz 08 coupon, About methodology on Monte Carlo and closed forms), plus clear nits.

## Current state

- **Output:** one offline file `release/forward-first.html` (byte-identical copy `forward-first-v6.html`), 1.66 MB (CSS 475 KB, JS 757 KB, packed pages 467 KB), plain ASCII. 99 pages, 19 route aliases, 38 islands, both languages. CSP `default-src 'none'`, no network request (tested).
- **Tests:** `npm run check` green (Vitest about 2’600 tests, coverage ≥ 90 % in `src/lib`). Offline file: 96 tests in Chromium 1440 (2 touch tests run only in the WebKit iPad projects); WebKit iPad runs in CI. Web build component tests: 460 green.
- **Calculation core:** forward, swap, roll, arbitrage, Garman-Kohlhagen, Black-76, implied vol, delta strikes, six Greeks, smile, digitals, 8 barriers, touch, double no-touch; all §6 reference values within tolerance; cross-checked against independent formulas (max diff 1.8e-13).
- **Monte Carlo:** 8 products, fair strikes/coupons with standard errors in `src/data/fx/mc-products.json`, independently re-implemented and reproduced; interactive pricing in chunks on the main thread.
- **Riskometer data:** ECB until 14.09.2026; EUR/CHF 3.9 % (Normal, percentile 45). Manual update via Actions → Release.
- **Content:** nine modules with four sections, check questions and quiz each, DE and EN; glossary; about and methodology; every module reviewed by a fresh agent (D-39); sources merged into `src/content/sources.md` with a verification log.

## Next steps

1. Dario: test Version 6 on the iPad and the work PC (by mail), incl. module 04.1 (Option oder Forward?) and 07.2 (barrier lab) while dragging. If the file does not start, the yellow diagnostics box shows why; if only the loading text stays, the view runs no JavaScript.
2. Dario: run Actions → Release with «Fetch new ECB reference rates first» (the sandbox could not reach the ECB).
3. After his go: merge the PR, then phase 7 English review, phase 8 polish, phase 9 verification and release.

## Open questions for Dario

1. **Device test results:** please check on the iPad in particular: dragging the barrier lines in module 07 section 1 and the level handle in module 08 section 2 (must move the handle, not scroll the page), the franc-shock replay in module 07 section 4, and the learning path on the home page in portrait. Anything that behaves differently on the iPad (Files app preview vs. Safari) or on the work PC (Edge policies, blocked storage) goes here. Playwright's WebKit on Linux is close to, but not the same as, iPadOS Safari.
2. **Data freshness:** the sandbox could not reach the ECB API; data ends 14.09.2026. Run Actions → Release with "Fetch new ECB reference rates first" to update. If `main` is protected, the workflow's push needs a rule exception.
3. **2008 event wording (D-30):** the approved prototype named the failed US investment bank; currently neutral because of the no-bank-names rule. Name it as a historical fact?
4. **Structured product parameters (D-29):** with the §8.7 values the TARF reaches its 500-pip target after ~2.4 fixings in 94 % of paths, TPF/RTPF coupons are ~775–810 pips per fixing. Keep (current: taught as the asymmetry lesson) or change, e.g. TARF target 1’500 pips, strikes relative to the forward? One edit in `MC_CONFIG` + `npm run data:mc`.
5. **Fiscal package 2025 sources:** the announcement date comes from a public broadcaster, not an official page; the "1 % of GDP" rule from the federal law page. Acceptable?
6. **Seventh Riskometer event?** The April 2025 US tariff shock (EUR/USD vol 14.1 %, higher than any fiscal-2025 value).
7. **Source descriptions in English:** the "Belegt" lines in the sources are German; the English About page shows them as is.
8. **Hedge roll (D-25):** include the interest on the cash settlement in the all-in rate?
9. **Daily barrier monitoring:** the Monte Carlo and the BGK shift use calendar days (Δt = 1/365); business days (1/252) would give a shift of about 24 instead of 20 pips. Keep calendar days?
10. **Forward used in modules 04 vs 02:** resolved by D-44 (02.2 now separates T = 0.25 and 90/360 and shows the 90-day case).
11. **Market conventions without a source:** "premium paid in USD is usual in USD/CHF" and "interbank one-touches usually pay at expiry" are stated as textbook conventions. Keep or source?
12. **Structured products vs running example:** §8.7 uses 26 weekly / 12 monthly fixings while the example is 3 months; coupons are quoted to 0.1 pip; should dual currency move to module 09?
13. **Franc shock intraday:** state how far EUR/CHF fell during 15.01.2015 (needs an official source, e.g. BIS Quarterly Review)? Currently ECB fixings only.
14. **Links to sources:** the About page links to the original sources (https). Tapping one leaves the file and opens the browser; that is the only way the tool touches the network. Keep?
15. **Module 01 probabilities (D-46):** the rise/fall probabilities are now risk-neutral (with drift): 7 % instead of 11 % for a rise to 0.84, 15 % instead of 10 % for a fall to 0.76. OK?
16. **Probabilities without their own note:** chart legends («Wahrscheinlichkeit») and the path simulator's ensemble counts («93 von 100») carry no note of their own; the stat rows next to them do. Enough?
17. **Barrier lab maturity (D-42):** the slider now runs in days (start 91.25 days = 3 months, shown as «3 Monate (91 Tage)»). OK on the iPad?
18. **Not tested by automation (supplement point 9):** native range sliders by touch (Playwright cannot drive them); touch frame by frame in WebKit (the iPad projects test the handle behaviour only); the English pages are not swept slider by slider (same islands as German). Your device test covers these.
19. **Delta vs chance in the quiz:** module 04 keeps its fixed quiz shape, so there is no own question on «delta is not a probability» (the text, a table, the explorer and the glossary cover it). Add one by replacing check m04-c3?
20. **About page model texts:** «Garman-Kohlhagen» and «Monte Carlo» on the About page do not list the model assumptions (constant vol, lognormal, no jumps); the glossary entry «Risikoneutral» does. Add them there too?
21. **iPad Files app (D-62 vs D-13):** Review 2 found that the Files app preview runs no JavaScript; D-13's device test ran a local test file with inline JavaScript in the Files app. How do you open the file on the iPad (preview, «Open in», another app)? The loading text now says what to do; CLAUDE.md, D-13 and the master prompt still name the Files app as the iPad target.
22. **Cross-currency basis:** the texts name the basis but show no number (no sourced USD/CHF basis value). Add a sourced figure or keep it qualitative?
23. **Monte Carlo fair coupons (D-63):** an independent high-precision recomputation gives about 772.7 pips (TPF) and 806–807 pips (RTPF), against 775.37 ± 0.97 and 810.54 ± 1.61 from the stored run (seed 20261022, 1 Mio. paths). Re-run `npm run data:mc` with more paths (e.g. 4 Mio.)? The contractual coupons, coupons in CHF and maximum gains would change with it.
