# Quellen Modul 07 / Sources module 07 (Barrier & Binary)

Facts of module 07 are registered in `src/content/facts/m07.ts`. The SNB facts reuse the
sources of the Riskometer (`src/content/sources/riskometer.md`):

- `snb-2011-09-06`: minimum exchange rate of CHF 1.20 per euro since 06.09.2011 (facts
  `m07-floor`, `m07-floor-start`).
- `snb-2015-01-15`: minimum exchange rate discontinued on 15.01.2015, sight-deposit rate cut to
  −0.75 % (fact `m07-floor-end`; the rate itself reuses the fact `m05-snb-2015-rate`).
- `ecb-reference-rates` (`src/content/sources.md`): data source of the EUR/CHF fixings in the
  franc-shock replay; every number of the replay is computed from `data/raw/ecb-eur-reference.csv`.

Verification (22.10.2026): web search confirmed the SNB statements (discontinuation of the
minimum rate "with immediate effect", sight-deposit rate −0.75 %, floor set on 06.09.2011),
e.g. via the reproductions https://www.bis.org/review/r150116a.htm (SNB, 15.01.2015) and
https://www.bis.org/review/r120522a.pdf (SNB, 2012: "on 6 September, the SNB set a minimum
exchange rate of CHF 1.20 per euro"). snb.ch and bis.org could not be opened from the build
sandbox (network policy); see the open questions in the module report.

## ecb-reference-rates-method

- Titel: Euro foreign exchange reference rates (methodology)
- Herausgeber: Europäische Zentralbank (EZB) / European Central Bank
- Datum: laufend / ongoing
- URL: https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html
- Belegt: Die Referenzkurse beruhen auf einem täglichen Abstimmungsverfahren zwischen Zentralbanken, das normalerweise um ca. 14:10 MEZ stattfindet; Veröffentlichung um ca. 16:00 MEZ an jedem Arbeitstag; nur zu Informationszwecken. Fakt `m07-ecb-time`. Geprüft per Websuche (22.10.2026, erneut 23.10.2026: «normally takes place around 14:10 CET»), Seite aus der Sandbox nicht erreichbar.
