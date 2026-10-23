# Quellen Modul 01 / Sources module 01 (FX-Markt & Spot)

Facts of module 01 are registered in `src/content/facts/m01.ts`. Everything else in the module
is either computed (running example, schematic teaching models in `src/lib/m01`, ECB reference
rates in `data/raw/ecb-eur-reference.csv`) or textbook knowledge and market convention (T+2,
USD/CAD T+1, pips and big figures, session times as a schematic, central bank names, roles of
currencies as tendencies).

Verification (23.10.2026): bis.org cannot be opened from the build sandbox (network policy,
"CONNECT tunnel failed, 403"; WebFetch: host not found). The statements below were checked with
several web searches whose results quote the bis.org pages listed (press release, statistical
release `rpfx25_fx.htm`, Quarterly Review December 2025). Please open the URLs once from a normal
browser before publishing (open question in the module report).

## bis-press-2025-09-30

- Titel: Global FX trading hits $9.6 trillion per day in April 2025 and OTC interest rate derivatives surge 79%
- Herausgeber: Bank für Internationalen Zahlungsausgleich (BIZ) / Bank for International Settlements (BIS)
- Datum: 30.09.2025
- URL: https://www.bis.org/press/p250930.htm
- Belegt: Vorläufige Ergebnisse der Triennial Central Bank Survey 2025 (52 Jurisdiktionen, über 1’100 Banken und Händler). Der US-Dollar stand auf einer Seite von 89 % aller Devisengeschäfte im April 2025; der Euro folgt mit 28.9 %, der Yen mit 16.8 %, das Pfund mit 10.2 %. Der Schweizer Franken stieg zur sechstmeistgehandelten Währung auf (Statistik-Release rpfx25_fx: Anteil 6.4 %, 2022 Rang 8). Fakten `m01-bis-usd-share`, `m01-bis-chf-rank`. Gesamtumsatz vorläufig USD 9.6 Billionen pro Tag, final siehe `bis-qr-2025-12-fx`.

## bis-qr-2025-12-fx

- Titel: Global FX markets when hedging takes centre stage (BIS Quarterly Review, December 2025)
- Herausgeber: Bank für Internationalen Zahlungsausgleich (BIZ) / Bank for International Settlements (BIS)
- Datum: 08.12.2025
- URL: https://www.bis.org/publ/qtrpdf/r_qt2512b.htm
- Belegt: Finale Zahlen der Triennial Survey 2025: Der Umsatz im globalen Devisenmarkt betrug im April 2025 durchschnittlich USD 9.5 Billionen pro Tag, 27 % mehr als im April 2022. Der Anstieg von Spot- und Forward-Handel hängt mit der hohen Volatilität und der Dollar-Abwertung nach den US-Zollankündigungen zusammen. Fakten `m01-bis-turnover`, `m01-bis-month`.

## bis-qr-2025-12-foreword

- Titel: Shifting currents in FX and interest rate derivatives: highlights from the 2025 Triennial Survey (BIS Quarterly Review, December 2025, Foreword)
- Herausgeber: Bank für Internationalen Zahlungsausgleich (BIZ) / Bank for International Settlements (BIS)
- Datum: 08.12.2025
- URL: https://www.bis.org/publ/qtrpdf/r_qt2512_foreword.htm
- Belegt: Der Handel stieg nach den US-Zollankündigungen vom 2. April 2025 und einer unerwarteten Abwertung des US-Dollars; Devisenumsatz USD 9.5 Billionen pro Tag im April 2025. Fakt `m01-tariff-date`. Die Grösse der Dollar-Bewegung im April 2025 zeigt das Modul nicht als Fakt, sondern rechnet sie aus den EZB-Referenzkursen (`ecb-reference-rates`).
