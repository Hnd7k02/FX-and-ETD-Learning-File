# Quellen Modul 03 / Sources module 03 (FX Swap)

Facts of module 03 are registered in `src/content/facts/m03.ts`. Everything else in the module
is textbook knowledge (covered interest parity, FX swap and cross-currency swap mechanics) or
computed from the running example.

Verification (23.10.2026): web searches confirmed the statements of the BIS press release of
30.09.2025 ("Global FX trading hits $9.6 trillion per day in April 2025 …"; FX swaps remained
the most traded instrument with average daily turnover of $4 trillion, up 5 % from April 2022)
and of the BIS Quarterly Review of December 2025 ("Turnover in global foreign exchange (FX)
markets averaged $9.5 trillion per day in April 2025, a 27 % increase from April 2022"; final
data). The 2025 survey is the latest edition (the next one is due in 2028). bis.org could not be
opened from the build sandbox (network policy); the facts are rounded so they hold for both the
preliminary and the final figures.

## bis-triennial-2025

- Titel: Triennial Central Bank Survey of Foreign Exchange and OTC Derivatives Markets 2025 / Global FX trading hits $9.6 trillion per day in April 2025
- Herausgeber: Bank für Internationalen Zahlungsausgleich (BIZ) / Bank for International Settlements (BIS)
- Datum: 30.09.2025 (vorläufige Zahlen), Schlusszahlen im BIS Quarterly Review vom Dezember 2025
- URL: https://www.bis.org/statistics/rpfx25_fx.htm
- Belegt: Im April 2025 waren FX Swaps das meistgehandelte Instrument am Devisenmarkt mit einem durchschnittlichen Tagesumsatz von rund USD 4 Billionen; Gesamtumsatz USD 9.6 Billionen pro Tag (vorläufig) bzw. USD 9.5 Billionen (Schlusszahlen); Anteil daraus abgeleitet gut 40 %. Fakten `m03-bis-month`, `m03-bis-swaps`, `m03-bis-total`, `m03-bis-share`. Geprüft per Websuche (23.10.2026), Seite aus der Sandbox nicht erreichbar.

## bis-qr-2025-12-fx

- Titel: Global FX markets when hedging takes centre stage (BIS Quarterly Review, December 2025)
- Herausgeber: Bank für Internationalen Zahlungsausgleich (BIZ) / Bank for International Settlements (BIS)
- Datum: 08.12.2025
- URL: https://www.bis.org/publ/qtrpdf/r_qt2512b.htm
- Belegt: Schlusszahlen der Umfrage 2025: Devisenumsatz im April 2025 durchschnittlich USD 9.5 Billionen pro Tag, 27 % mehr als im April 2022; FX Swaps bleiben das grösste Instrument, das Wachstum kam vor allem aus dem Handel mit institutionellen Anlegern. Stützt die Rundung «knapp USD 10 Billionen» im Fakt `m03-bis-total`. Geprüft per Websuche (23.10.2026).
