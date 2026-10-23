# Progress

Working branch: `claude/forward-first-v1`. Mode: phases without stops (D-16), uncertain choices kept easy to change (D-22).

| Phase | Content                                                                           | Status                                                              |
| ----- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 0     | Setup: scaffold, tooling, tokens, layout shell, i18n routing, CI, memory files    | done                                                                |
| 1     | Calculation core without Monte Carlo                                              | done, independently verified (`docs/reference/xcheck/`)             |
| 2     | Design system, home page, Wow moment, module template                             | done                                                                |
| 3     | Module 05 vertical slice (Greeks lab, content, quiz, progress)                    | in progress                                                         |
| 4     | Riskometer: pipeline, method, events, page, mini gauge, GitHub Action             | pipeline + mini gauge done, page in progress                        |
| 5     | Modules 01–04 incl. session clock, calculators, payoff builder                    | in progress                                                         |
| 6     | Monte Carlo engine, products, modules 06–09, path simulator, matrix               | engine done and verified; modules in progress                       |
| 7     | English complete, glossary, about and methodology                                 | glossary (105 terms) + about done; EN written alongside each module |
| 8     | Polish: transitions, micro-interactions, 390 px, visual comparison                | open                                                                |
| 9     | Verification and launch: tests, E2E, Lighthouse, fact check, README, deploy guide | open                                                                |

## Stop point (Dario, 23.10.2026)

Stop after the integration (all modules built and reviewed, sources merged, `npm run check`, build and full e2e green). Dario clicks through the modules first; phase 7 (English review), phase 8 (polish) and phase 9 (launch) start only after his go.

## Current state

- Calculation core: forward, swap, roll, arbitrage, Garman-Kohlhagen, Black-76, implied vol, delta strikes, six Greeks, smile, digitals, 8 barriers, touch, double no-touch; all §6 reference values within tolerance; cross-checked against independent formulas (max diff 1.8e-13).
- Monte Carlo: 8 products, fair strikes/coupons with standard errors in `src/data/fx/mc-products.json`, independently re-implemented and reproduced.
- Riskometer data: ECB seed until 14.09.2026; EUR/CHF 3.9 % (Normal, percentile 45); daily GitHub Action `.github/workflows/data.yml`.
- Home page with Wow chart, learning path, resume card, mini gauge; module template with stepper, check questions, quiz, progress; glossary; about & methodology.

## Next steps

1. Finish modules 01–09 (agents running), Riskometer page.
2. Integration: merge source fragments into `src/content/sources.md`, full `npm run check`, build, e2e.
3. Review round: fresh agents check finance, numbers, language (DE/EN), facts against sources, accessibility, performance.
4. Polish (phase 8) and README / deploy guide (phase 9).

## Open questions for Dario

1. **Production URL:** set `site` in `astro.config.mjs` once the Cloudflare project exists.
2. **Data freshness:** the sandbox could not reach the ECB API; data ends 14.09.2026. The first (manual) run of the data workflow on GitHub updates it. If `main` is protected, the workflow's push needs a rule exception.
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
