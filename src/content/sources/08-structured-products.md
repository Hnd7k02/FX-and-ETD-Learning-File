# Quellen Modul 08 / Sources module 08 (Strukturierte Produkte)

Module 08 uses two sourced facts, registered in `src/content/facts/m08.ts`. Both reuse the
entry `snb-2015-01-15` of `src/content/sources/riskometer.md` (not duplicated here):

- `m08-floor`: minimum exchange rate of CHF 1.20 per euro,
- `m08-floor-end`: discontinued on 15.01.2015 "with immediate effect".

Verification (23.10.2026): a web search confirmed both statements via the SNB's introductory
remarks of 15.01.2015 reproduced by the BIS (https://www.bis.org/review/r150116a.htm: "The Swiss
National Bank (SNB) has decided to discontinue the minimum exchange rate of CHF 1.20 per euro
with immediate effect") and a reproduction of the SNB press release ("Swiss National Bank
discontinues minimum exchange rate and lowers interest rate to −0.75%"). snb.ch, bis.org and
the reproduction could not be opened from the build sandbox (DNS blocked), so the check relied
on the search index.

Every other number of the module (fair strikes and coupons with standard errors, scenario
results, dual currency terms) is computed by the calculation core and the Monte Carlo engine
(`src/lib/nums/m08.ts`); the product parameters are example values (MASTER_PROMPT §8.7).
