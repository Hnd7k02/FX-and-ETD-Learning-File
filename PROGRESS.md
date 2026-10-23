# Progress

Working branch: `claude/forward-first-v1`. Mode: phases without stops (D-16), uncertain choices kept easy to change (D-22).

| Phase | Content                                                                         | Status                                                                    |
| ----- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 0     | Setup: scaffold, tooling, tokens, layout shell, i18n routing, CI, memory files  | done                                                                      |
| 1     | Calculation core without Monte Carlo                                            | done, independently verified (`docs/reference/xcheck/`)                   |
| 2     | Design system, home page, Wow moment, module template                           | done                                                                      |
| 3     | Module 05 vertical slice (Greeks lab, content, quiz, progress)                  | done, reviewed                                                            |
| 4     | Riskometer: pipeline, method, events, page, mini gauge                          | done                                                                      |
| 5     | Modules 01–04 incl. session clock, calculators, payoff builder                  | done, reviewed                                                            |
| 6     | Monte Carlo engine, products, modules 06–09, path simulator, matrix             | done, reviewed                                                            |
| 7     | English complete, glossary, about and methodology                               | written alongside each module; English review open (after Dario's go)     |
| 7b    | Offline file `forward-first.html` (D-13, D-40)                                  | done; waiting for Dario's device test (work PC and iPad, incl. module 05) |
| 8     | Polish: transitions, micro-interactions, 390 px and iPad, visual comparison     | open                                                                      |
| 9     | Verification and release: tests, E2E in Chromium and WebKit, fact check, README | open                                                                      |

## Stop point (Dario, 23.10.2026)

Dario tests `forward-first.html` on the work PC and the iPad, including module 05. Phases 8 and 9 start only after his go.

## Current state

- **Output:** one offline file `release/forward-first.html`, about 1.6 MB (CSS 475 KB, JS 740 KB, packed pages 446 KB). 99 pages, 19 route aliases, 38 islands, both languages. CSP `default-src 'none'`, no network request (tested).
- **Tests:** `npm run check` green (Vitest 1’989 tests, coverage ≥ 90 % in `src/lib`). Offline file: 19 tests green in Chromium locally; WebKit iPad runs in CI. Web build component tests: 460 green.
- **Calculation core:** forward, swap, roll, arbitrage, Garman-Kohlhagen, Black-76, implied vol, delta strikes, six Greeks, smile, digitals, 8 barriers, touch, double no-touch; all §6 reference values within tolerance; cross-checked against independent formulas (max diff 1.8e-13).
- **Monte Carlo:** 8 products, fair strikes/coupons with standard errors in `src/data/fx/mc-products.json`, independently re-implemented and reproduced; interactive pricing in chunks on the main thread.
- **Riskometer data:** ECB until 14.09.2026; EUR/CHF 3.9 % (Normal, percentile 45). Manual update via Actions → Release.
- **Content:** nine modules with four sections, check questions and quiz each, DE and EN; glossary; about and methodology; every module reviewed by a fresh agent (D-39); sources merged into `src/content/sources.md` with a verification log.

## Next steps

1. Dario: device test of the file (download: latest GitHub Release or the CI artifact `forward-first-html`).
2. After his go: phase 7 English review, phase 8 polish (incl. iPad portrait/landscape), phase 9 verification and release.

## Open questions for Dario

1. **Device test results:** anything that behaves differently on the iPad (Files app preview vs. Safari) or on the work PC (Edge policies, blocked storage) goes here. Playwright's WebKit on Linux is close to, but not the same as, iPadOS Safari.
2. **Data freshness:** the sandbox could not reach the ECB API; data ends 14.09.2026. Run Actions → Release with "Fetch new ECB reference rates first" to update. If `main` is protected, the workflow's push needs a rule exception.
3. **2008 event wording (D-30):** the approved prototype named the failed US investment bank; currently neutral because of the no-bank-names rule. Name it as a historical fact?
4. **Structured product parameters (D-29):** with the §8.7 values the TARF reaches its 500-pip target after ~2.4 fixings in 94 % of paths, TPF/RTPF coupons are ~775–810 pips per fixing. Keep (current: taught as the asymmetry lesson) or change, e.g. TARF target 1’500 pips, strikes relative to the forward? One edit in `MC_CONFIG` + `npm run data:mc`.
5. **Fiscal package 2025 sources:** the announcement date comes from a public broadcaster, not an official page; the "1 % of GDP" rule from the federal law page. Acceptable?
6. **Seventh Riskometer event?** The April 2025 US tariff shock (EUR/USD vol 14.1 %, higher than any fiscal-2025 value).
7. **Source descriptions in English:** the "Belegt" lines in the sources are German; the English About page shows them as is.
8. **Hedge roll (D-25):** include the interest on the cash settlement in the all-in rate?
9. **Daily barrier monitoring:** the Monte Carlo and the BGK shift use calendar days (Δt = 1/365); business days (1/252) would give a shift of about 24 instead of 20 pips. Keep calendar days?
10. **Forward used in modules 04 vs 02:** options use the continuous forward 0.79303, the importer's forward deal in module 02 the money-market forward 0.79306; the 0.3-pip gap is explained. OK?
11. **Market conventions without a source:** "premium paid in USD is usual in USD/CHF" and "interbank one-touches usually pay at expiry" are stated as textbook conventions. Keep or source?
12. **Structured products vs running example:** §8.7 uses 26 weekly / 12 monthly fixings while the example is 3 months; coupons are quoted to 0.1 pip; should dual currency move to module 09?
13. **Franc shock intraday:** state how far EUR/CHF fell during 15.01.2015 (needs an official source, e.g. BIS Quarterly Review)? Currently ECB fixings only.
14. **Links to sources:** the About page links to the original sources (https). Tapping one leaves the file and opens the browser; that is the only way the tool touches the network. Keep?
