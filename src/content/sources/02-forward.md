# Quellen Modul 02 / Sources module 02 (Forward)

Facts of module 02 are registered in `src/content/facts/m02.ts`. Everything else in the module
is computed from the running example (`src/lib/fx/example.ts`, `src/lib/m02/config.ts`) or is
textbook knowledge: covered interest parity, money-market day counts (CHF, USD, EUR Act/360),
forward points and their quoting convention, cash and carry, the cross-currency basis as a
concept (no numbers).

Verification (23.10.2026): bis.org cannot be opened from the build sandbox (WebFetch: host not
found). The statements below were checked with two independent web searches whose results quote
the bis.org pages listed (statistical release `rpfx25_fx.htm`, commentary of 30.09.2025, press
release `p250930.htm`); all give the same figures. They are preliminary survey results. Please
open the URL once from a normal browser before publishing (open question in the module report).

## bis-rpfx25-fx

- Titel: OTC foreign exchange turnover in April 2025 (Triennial Central Bank Survey, preliminary results)
- Herausgeber: Bank für Internationalen Zahlungsausgleich (BIZ) / Bank for International Settlements (BIS)
- Datum: 30.09.2025
- URL: https://www.bis.org/statistics/rpfx25_fx.htm
- Belegt: Im April 2025 lag der Umsatz mit FX Spot um 42 % und mit Outright Forwards um 60 % über April 2022. Die Anteile am weltweiten Devisenumsatz stiegen von 28 % auf 31 % (Spot) und von 15 % auf 19 % (Outright Forwards). Vorläufige Zahlen. Fakten `m02-bis-fwd-share`, `m02-bis-fwd-growth`, `m02-bis-month`.
