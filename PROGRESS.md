# Progress

Working branch: `claude/forward-first-v1`. Mode: phases without stops (D-16).

| Phase | Content                                                                           | Status      |
| ----- | --------------------------------------------------------------------------------- | ----------- |
| 0     | Setup: scaffold, tooling, tokens, layout shell, i18n routing, CI, memory files    | done        |
| 1     | Calculation core without Monte Carlo                                              | in progress |
| 2     | Design system, home page, Wow moment, module template                             | open        |
| 3     | Module 05 vertical slice (Greeks lab, content, quiz, progress)                    | open        |
| 4     | Riskometer: pipeline, method, events, page, mini gauge, GitHub Action             | open        |
| 5     | Modules 01–04 incl. session clock, calculators, payoff builder                    | open        |
| 6     | Monte Carlo engine, products, modules 06–09, path simulator, matrix               | open        |
| 7     | English complete, glossary, about and methodology                                 | open        |
| 8     | Polish: transitions, micro-interactions, 390 px, visual comparison                | open        |
| 9     | Verification and launch: tests, E2E, Lighthouse, fact check, README, deploy guide | open        |

## Current state

- Phase 0 complete: `npm run check` exit 0, `npm run build` ok, `npm run e2e` 6/6 green (390 px and 1440 px).
- ECB seed data in `data/raw/ecb-eur-reference.csv` (1999-01-04 … 2026-09-14), see D-15.

## Next step

Phase 1: calculation core (`src/lib/fx`) with tests against `docs/reference/gk_reference.py`.

## Open questions for Dario

1. **Production URL:** once the Cloudflare project exists, set `site` in `astro.config.mjs` (currently a placeholder) so canonical and hreflang links are correct.
2. **Data freshness:** the build sandbox could not reach the ECB API; the Riskometer starts with data until 14.09.2026. The first run of the data workflow on GitHub brings it up to date (D-15).
