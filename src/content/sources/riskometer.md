# Quellen Riskometer / Riskometer sources

Sources for the market events in `src/data/events.json` and the validation whitelist in
`src/lib/data/validate.ts`. Data source of the Riskometer itself: `ecb-reference-rates` in
`src/content/sources.md`. Numbers that the ECB data can compute (moves, vol peaks) are not
sourced here; they are calculated by `scripts/build-riskometer.ts`.

Verification (22.10.2026): every URL below was found in a web search index with a matching
title and summary; the pages themselves could not be opened from the build sandbox (network
policy). See PROGRESS.md, open questions.

## bis-ar-2009

- Titel: 79th Annual Report, 2008/09, Chapter II "The global financial crisis"
- Herausgeber: Bank für Internationalen Zahlungsausgleich (BIZ) / Bank for International Settlements (BIS)
- Datum: 29.06.2009
- URL: https://www.bis.org/publ/arpdf/ar2009e.htm
- Belegt: Konkurs einer grossen US-Investmentbank am 15.09.2008; ab diesem Tag weltweiter Vertrauensverlust (Phase drei der Krise, 15.09.2008 bis Ende Oktober 2008). Ereignis `gfc-2008`.

## snb-speech-2009-09-25

- Titel: The Swiss franc and the financial market crisis (Referat)
- Herausgeber: Schweizerische Nationalbank (SNB)
- Datum: 25.09.2009
- URL: https://www.snb.ch/en/publications/communication/speeches/2009/ref_20090925_tjn
- Belegt: Die Finanzkrise hat gezeigt, dass der Franken weiterhin den Status eines sicheren Hafens hat; Safe-Haven-Effekte führten zur Aufwertung des Frankens. Ereignis `gfc-2008` ("In Krisen wertet der Franken typischerweise auf").

## bis-qr-2009-12-dollar

- Titel: Dollar appreciation in 2008: safe haven, carry trades, dollar shortage and overhedging (BIS Quarterly Review, December 2009)
- Herausgeber: Bank for International Settlements (BIS)
- Datum: 07.12.2009
- URL: https://www.bis.org/publ/qtrpdf/r_qt0912i.htm
- Belegt: Aufwertung des Dollars im zweiten Halbjahr 2008: Flucht in US-Treasury-Bills (sicherer Hafen), Auflösung von Carry-Trades, Dollarknappheit bei Banken. Ereignis `gfc-2008` (EUR/USD, USD/JPY).

## snb-2011-09-06

- Titel: Swiss National Bank sets minimum exchange rate at CHF 1.20 per euro
- Herausgeber: Schweizerische Nationalbank (SNB)
- Datum: 06.09.2011
- URL: https://www.snb.ch/en/publications/communication/press-releases/2011/pre_20110906
- Belegt: Einführung des Mindestkurses von 1.20 Franken pro Euro am 06.09.2011 mit sofortiger Wirkung; Durchsetzung mit Devisenkäufen in unbeschränkter Höhe; Begründung mit der massiven Überbewertung des Frankens. Ereignis `floor-2011`.

## snb-2015-01-15

- Titel: Swiss National Bank discontinues minimum exchange rate and lowers interest rate to −0.75%
- Herausgeber: Schweizerische Nationalbank (SNB)
- Datum: 15.01.2015
- URL: https://www.snb.ch/en/publications/communication/press-releases/2015/pre_20150115
- Belegt: Aufhebung des Mindestkurses von 1.20 Franken pro Euro mit sofortiger Wirkung; Zins auf Sichtguthaben (über dem Freibetrag) um 0.5 Prozentpunkte auf −0.75 % gesenkt. Ereignis `chf-shock-2015`; Ausnahme 15.01.2015 (EUR/CHF, USD/CHF) in der Whitelist der Datenvalidierung.

## euco-2022-02-24

- Titel: Special meeting of the European Council (24 February 2022) – Conclusions (EUCO 18/22)
- Herausgeber: Europäischer Rat / European Council
- Datum: 24.02.2022
- URL: https://data.consilium.europa.eu/doc/document/ST-18-2022-INIT/en/pdf
- Belegt: Militärische Aggression Russlands gegen die Ukraine, am 24.02.2022 vom Europäischen Rat verurteilt. Ereignis `ukraine-2022`.

## snb-2022-03-24

- Titel: Monetary policy assessment of 24 March 2022
- Herausgeber: Schweizerische Nationalbank (SNB)
- Datum: 24.03.2022
- URL: https://www.snb.ch/en/mmr/reference/pre_20220324/source/pre_20220324.en.pdf
- Belegt: Der russische Angriff auf die Ukraine hat die Unsicherheit weltweit stark erhöht; der Franken bleibt hoch bewertet. Ereignis `ukraine-2022`.

## bis-bulletin-90

- Titel: The market turbulence and carry trade unwind of August 2024 (BIS Bulletin No 90)
- Herausgeber: Bank for International Settlements (BIS)
- Datum: 27.08.2024
- URL: https://www.bis.org/publ/bisbull90.htm
- Belegt: Auflösung gehebelter Positionen und von Carry-Trades Anfang August 2024, vor allem in Yen finanzierter; Höhepunkt des Stresses am 05.08.2024. Ereignis `carry-2024`.

## bis-qr-2024-09

- Titel: Carry off, carry on (BIS Quarterly Review, September 2024)
- Herausgeber: Bank for International Settlements (BIS)
- Datum: 16.09.2024
- URL: https://www.bis.org/publications/qr-202409/carry-off-carry-on
- Belegt: Yen und Schweizer Franken als traditionelle Finanzierungswährungen von Carry-Trades werteten Ende Juli und Anfang August 2024 auf. Ereignis `carry-2024`.

## zdf-2025-03-04

- Titel: Union und SPD: Einigung auf Sondervermögen bei Sondierungen
- Herausgeber: ZDF (zdfheute)
- Datum: 04.03.2025
- URL: https://www.zdfheute.de/politik/deutschland/sondierung-cdu-spd-sondervermoegen-100.html
- Belegt: Ankündigung am Abend des 04.03.2025 in Berlin: Sondervermögen von 500 Mrd. Euro für Infrastruktur und Änderung der Schuldenbremse für Verteidigungsausgaben. Ereignis `fiscal-2025`.

## bundestag-2025-03-18

- Titel: Mehrheit für Reform der Schuldenbremse: 512 Abgeordnete stimmen mit Ja
- Herausgeber: Deutscher Bundestag (Textarchiv)
- Datum: 18.03.2025
- URL: https://www.bundestag.de/dokumente/textarchiv/2025/kw12-de-sondersitzung-1056916
- Belegt: Der Bundestag beschliesst am 18.03.2025 die Grundgesetzänderung: Lockerung der Schuldenbremse für Verteidigungsausgaben, Sondervermögen Infrastruktur von 500 Mrd. Euro. Ereignis `fiscal-2025`.

## bpb-2025-grundgesetz

- Titel: Grundgesetzänderung für Verteidigung und Sondervermögen
- Herausgeber: Bundeszentrale für politische Bildung (bpb)
- Datum: März 2025
- URL: https://www.bpb.de/kurz-knapp/hintergrund-aktuell/560839/grundgesetzaenderung-fuer-verteidigung-und-sondervermoegen/
- Belegt: Änderung der Artikel 109, 115 und 143h GG; Sondervermögen von 500 Mrd. Euro für Infrastruktur und Klimaschutz; Zustimmung des Bundesrates am 21.03.2025. Ereignis `fiscal-2025`.

## g115-2025-1a

- Titel: Gesetz zur Ausführung von Artikel 115 des Grundgesetzes (Artikel 115-Gesetz), § 1a Bereichsausnahme
- Herausgeber: Bundesministerium der Justiz / Bundesamt für Justiz (gesetze-im-internet.de)
- Datum: Fassung 2025
- URL: https://www.gesetze-im-internet.de/g_115/__1a.html
- Belegt: Verteidigungsausgaben (und weitere sicherheitsbezogene Ausgaben), soweit sie 1 % des nominalen Bruttoinlandsprodukts übersteigen, werden bei der Schuldenbremse nicht angerechnet. Ereignis `fiscal-2025`.
