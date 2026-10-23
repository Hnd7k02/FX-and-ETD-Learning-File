# Quellen Modul 09 / Sources module 09 (Hedge, Alpha, Yield)

Module 09 uses one sourced fact, registered in `src/content/facts/m09.ts`. It reuses the entry
`bis-bulletin-90` of `src/content/sources/riskometer.md` (not duplicated here):

- `m09-carry-peak`: the stress of the August 2024 carry trade unwind peaked on 05.08.2024.

The surrounding sentence in section 4 (callout "Wann geht es schief") states only what the same
bulletin covers: carry trades, mainly funded in yen, were unwound in early August 2024, and the
unwinding of leveraged positions amplified the market move.

Verification (23.10.2026): a web search confirmed the statements via BIS Bulletin No 90 "The
market turbulence and carry trade unwind of August 2024" (Bank for International Settlements,
27.08.2024, https://www.bis.org/publ/bisbull90.htm and https://www.bis.org/publ/bisbull90.pdf):
the peak of the stress occurred on 5 August, yen-funded carry trades were unwound, and the
unwinding of leveraged equity and currency trades amplified the initial reaction to a weak US
macro release. bis.org could not be opened from the build sandbox (DNS blocked), so the check
relied on the search index; the riskometer entry `bis-bulletin-90` records the same content.

The section links to the Riskometer event `carry-2024` (USD/JPY) for the volatility data.
Every other number of the module is computed by the calculation core, the Monte Carlo fair
values of module 08 or the module 09 logic (`src/lib/nums/m09.ts`); scenario levels and product
parameters are example values (`M09_CONFIG`, `MC_CONFIG`). Market conventions used as textbook
knowledge (no source needed): a dual currency investment is a deposit plus a sold option; a
discount certificate is the underlying plus a sold call at the cap.
