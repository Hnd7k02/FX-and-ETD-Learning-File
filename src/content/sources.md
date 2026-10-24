# Quellen / Sources

Every market event, institutional fact and statistic used in Forward First is listed here.
Each entry has an id (the `## id` heading) that `<Fact>` registries and event data refer to.
Format per entry: title, publisher, date, URL, what it supports. A book has an ISBN instead of a
URL (no links to copies of books; statements are paraphrased, never copied).

<!-- Allgemein -->

## ecb-reference-rates

- Titel: Euro foreign exchange reference rates
- Herausgeber: Europäische Zentralbank (EZB) / European Central Bank
- Datum: laufend, an Arbeitstagen um ca. 16:00 MEZ / on working days around 16:00 CET
- URL: https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html
- Belegt: Datenquelle des Riskometers (EUR/CHF, EUR/USD direkt; USD/CHF und USD/JPY als Kreuzkurse); Referenzkurse dienen nur Informationszwecken.

<!-- Lehrbuch und Fachliteratur / textbooks and literature (Version 6, Review 2) -->

## hull-2012

- Titel: Options, Futures, and Other Derivatives, 8. Auflage / 8th edition
- Herausgeber: John C. Hull; Pearson
- Datum: 2012
- ISBN: 978-0-13-216494-8
- Belegt: Lehrbuchwissen, sinngemäss wiedergegeben (kein Buchtext übernommen). Version 7: Kapitel «Introduction» (Absichern mit Forward oder Option, Modul 09.1), «Mechanics of Futures Markets» (Währungsfutures werden an Börsen gehandelt, Modul 01.2), «Trading Strategies Involving Options» (Break-even eines gekauften Calls = Strike plus Prämie, Modul 06.1), «The Greek Letters» (Theta eines Calls im Geld auf eine Währung mit hohem Zins kann positiv sein, Glossar «Theta»), «Exotic Options» (Cash-or-nothing-Digital zahlt einen festen Betrag, Modul 07.3). Kapitel «Determination of Forward and Futures Prices»: gedeckte Zinsparität bei Währungen, der Forward folgt aus Spot und den beiden Zinsen (Modul 02.3). Kapitel «The Greek Letters»: Delta eines Forward-Kontrakts e^(−r_f·T); Greeks für ein Asset mit Rendite q, bei Währungen q = r_f (Modul 05.2, 05.3); die Lage des Gamma- und des Vega-Maximums ist aus diesen Formeln hergeleitet. Kapitel «Exotic Options»: Barrier-Optionen und In-Out-Parität (Modul 07.4); Volatility und Variance Swaps (Modul 05.1, 05.3).

## bis-2016-cip

- Titel: Covered interest parity lost: understanding the cross-currency basis
- Herausgeber: Claudio Borio, Robert N. McCauley, Patrick McGuire, Vladyslav Sushko; BIS Quarterly Review, Bank für Internationalen Zahlungsausgleich (BIZ) / Bank for International Settlements (BIS)
- Datum: September 2016
- URL: https://www.bis.org/publ/qtrpdf/r_qt1609e.htm
- Belegt: Am Markt weicht der Terminkurs seit der Finanzkrise 2008 dauerhaft von der gedeckten Zinsparität ab; diese Abweichung ist die Cross-Currency Basis. Darum sagt Modul 02.3: Der Forward folgt aus Spot und Zinsen, am Markt kommt die Basis dazu.

## jensen-1968

- Titel: The Performance of Mutual Funds in the Period 1945–1964
- Herausgeber: Michael C. Jensen; Journal of Finance, Vol. 23, Nr. 2, S. 389–416
- Datum: 1968
- URL: https://papers.ssrn.com/abstract=244153
- Belegt: Alpha als risikobereinigter Mehrertrag gegenüber einem Vergleichsmassstab (Jensens Alpha). Modul 09.3 und Glossar «Alpha».

## jewitt-2015

- Titel: FX Derivatives Trader School
- Herausgeber: Giles Jewitt; Wiley
- Datum: 2015
- ISBN: 978-1-118-96745-4
- Belegt: Weiterführende Literatur zur Praxis am FX-Options-Desk (Konventionen, Strukturen wie TARFs); kein Beleg für eine einzelne Aussage im Tool.

<!-- Version 7, Review 3 (24.10.2026): Quellen zu den geänderten Aussagen. URLs stammen aus dem Review; die Seiten waren aus der Sandbox nicht abrufbar (Proxy), Inhalte sinngemäss nach dem Review wiedergegeben. -->

## bis-xtd

- Titel: Exchange-traded derivatives statistics
- Herausgeber: Bank für Internationalen Zahlungsausgleich (BIZ) / Bank for International Settlements (BIS)
- Datum: laufend (quartalsweise) / ongoing (quarterly)
- URL: https://data.bis.org/topics/XTD_DER
- Belegt: Es gibt börsengehandelte Futures und Optionen auf Devisen (und Zinsen); die BIZ erfasst sie in einer eigenen Statistik. Modul 01.2 sagt darum: Spot, Forwards und FX Swaps laufen überwiegend ausserbörslich, Währungsfutures und Optionen darauf werden an Börsen gehandelt. Das Tool nennt keine Grössenangabe zum Börsenanteil und keine Börse im Lerntext.

## cme-rulebook-254a

- Titel: CME Rulebook, Chapter 254A: Options on Swiss Franc/U.S. Dollar Futures (mit Chapter 254: Swiss Franc/U.S. Dollar Futures)
- Herausgeber: CME Group (Regelwerk einer Terminbörse)
- Datum: laufend / current rulebook
- URL: https://www.cmegroup.com/rulebook/CME/III/250/254A/254A.pdf
- Belegt: Primärbeleg, dass CHF/USD-Futures und Optionen darauf an einer Börse mit standardisierten Verträgen gehandelt werden (Modul 01.2). Nur als Quellenangabe (D-50); im Lerntext steht kein Börsenname.

## oic-option-strategies

- Titel: Option Strategies Quick Guide
- Herausgeber: The Options Industry Council (OIC) / OCC
- Datum: ohne Jahr (Stand Review 3, Oktober 2026)
- URL: https://prd-web.theocc.com/getmedia/f34f8a0d-806f-4f1a-adf7-d49d8d94b16e/option-strategies-quick-guide.pdf
- Belegt: Break-even eines gekauften Calls = Strike plus Prämie. Modul 06.1: Endet der Kurs nahe bei Forward und Strike, kostet eine Struktur mit Prämie mehr als «ohne Absicherung» und als der Forward.

## seco-kmu-fx

- Titel: Wechselkursrisiken: So können sich KMU absichern
- Herausgeber: Staatssekretariat für Wirtschaft (SECO), KMU-Portal
- Datum: laufend / ongoing
- URL: https://www.kmu.admin.ch/de/wechselkursrisiken-so-koennen-sich-kmu-absichern
- Belegt: Ein Forward fixiert den Kurs, eine Option kostet eine Prämie und lässt die Chance offen; welches Instrument passt, hängt vom tragbaren Worst Case ab. Modul 09.1: Der Call lohnt sich erst unter F − Prämie.

## sec-cftc-2013-binary

- Titel: Investor Alert: Binary Options and Fraud
- Herausgeber: U.S. Securities and Exchange Commission (SEC) und Commodity Futures Trading Commission (CFTC)
- Datum: 06.06.2013
- URL: https://www.investor.gov/introduction-investing/general-resources/news-alerts/alerts-bulletins/investor-alerts/investor-61
- Belegt: Eine binäre (digitale) Option zahlt einen festen Betrag oder nichts. Modul 07.3: Für den Importeur höchstens ein Teilschutz, kein proportionaler Schutz wie beim USD Call.

## hkma-2011-accumulator

- Titel: Buy at a discount?
- Herausgeber: Hong Kong Monetary Authority (HKMA), inSight
- Datum: 28.09.2011
- URL: https://www.hkma.gov.hk/eng/news-and-media/insight/2011/09/20110928/
- Belegt: Ein Accumulator kauft unter dem Marktkurs, solange der Kurs in einer Spanne bleibt; steigt er stark, endet der Vertrag (Knock-out), fällt er stark, kauft man die doppelte Menge über dem Marktkurs. Modul 08.2, Merksatz.

## ifec-2022-accumulators

- Titel: Accumulators and decumulators
- Herausgeber: Investor and Financial Education Council (IFEC), Hongkong
- Datum: 29.12.2022
- URL: https://www.ifec.org.hk/web/en/blog/2022/12/accumulators-and-decumulators-1.page
- Belegt: Aufbau und Risiken von Accumulators und Decumulators (Rabatt, Knock-out, Hebel unter dem Strike). Modul 08.2, Merksatz.

## bossens-2010

- Titel: Vanna-Volga methods applied to FX derivatives: from theory to market practice
- Herausgeber: Frédéric Bossens, Grégory Rayée, Nikos S. Skantzos, Griselda Deelstra; arXiv 0904.1074
- Datum: 2010
- URL: https://arxiv.org/abs/0904.1074
- Belegt: Prämienadjustiertes Delta Δ_pa = Δ_Spot − V/S, wenn die Prämie in der Basiswährung bezahlt wird; welche Konvention gilt, hängt vom Währungspaar ab. Glossar «Prämienadjustiertes Delta».

## wystup-2018-greeks

- Titel: FX Greeks (FX Column)
- Herausgeber: Uwe Wystup; MathFinance
- Datum: 06.11.2018
- URL: https://mathfinance.com/wp-content/uploads/2025/02/Wystup-FXcolumn-Greeks.pdf
- Belegt: Spot-Delta, prämienadjustiertes Delta und Forward-Delta am FX-Markt; die Prämie in der Basiswährung ist selbst eine Position. Glossar «Prämienadjustiertes Delta».

## kwok-mafs5030-hw4

- Titel: MAFS5030 Quantitative Modeling of Derivative Securities, Homework 4
- Herausgeber: Yue-Kuen Kwok; Hong Kong University of Science and Technology (HKUST)
- Datum: ohne Jahr (Kursunterlage)
- URL: https://www.math.hkust.edu.hk/~maykwok/courses/MAFS5030/HWs/MAFS5030_hw4.pdf
- Belegt: Theta eines Calls kann tief im Geld positiv sein (Aufgabe 4). Glossar «Theta»: Für den Käufer meist negativ; bei FX-Optionen kann der Zins-Carry tief im Geld überwiegen.

## bis-2008-fxswaps

- Titel: The basic mechanics of FX swaps and cross-currency basis swaps
- Herausgeber: Bank für Internationalen Zahlungsausgleich (BIZ) / Bank for International Settlements (BIS), BIS Quarterly Review
- Datum: März 2008 / March 2008
- URL: https://www.bis.org/publ/qtrpdf/r_qt0803z.htm
- Belegt: Mechanik eines FX Swaps (Near Leg per Spot, Far Leg auf Termin) und eines Cross-Currency Basis Swaps; die Swap Points sind die Forward Points, wenn der Swap per Spot beginnt. Modul 03.2 und die Figur «Swap Legs».

## derman-2007

- Titel: The Second-Most Important Equation (Gamma gegen Theta beim Delta-Hedge)
- Herausgeber: Emanuel Derman (Blog)
- Datum: 2007
- URL: https://emanuelderman.com/the-second-most-important-equation/
- Belegt: Der Gewinn eines delta-gehedgten Calls aus Gamma gegen den Zeitwertverlust gilt im Modell (konstante Vola, laufender Delta-Hedge ohne Kosten). Modul 05.4, Merksatz «Im Modell».

## lyuu-barrier

- Titel: Barrier options (Vorlesungsunterlage Finance 1, 25.03.2022)
- Herausgeber: Yuh-Dauh Lyuu; National Taiwan University (NTU)
- Datum: 25.03.2022
- URL: https://www.csie.ntu.edu.tw/~lyuu/finance1/2022/20220325.pdf
- Belegt: Ein Knock-in hat vor der Berührung der Barriere einen Wert (In-Out-Parität, Bewertung von Knock-in-Optionen). Modul 07.1: Vorher hast du nur die Anwartschaft darauf, der Vertrag hat aber schon einen Wert.

<!-- Riskometer -->

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
- Belegt (Modul 06): Fakt `m06-snb-safe-haven-2009` (Franken als sicherer Hafen, Vorzeichen-Intuition des Risk Reversals).

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

<!-- Modul 01 -->

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
- Belegt (Modul 03): Schlusszahlen der Umfrage 2025: Devisenumsatz im April 2025 durchschnittlich USD 9.5 Billionen pro Tag, 27 % mehr als im April 2022; FX Swaps bleiben das grösste Instrument, das Wachstum kam vor allem aus dem Handel mit institutionellen Anlegern. Stützt die Rundung «knapp USD 10 Billionen» im Fakt `m03-bis-total`. Geprüft per Websuche (23.10.2026).

## bis-qr-2025-12-foreword

- Titel: Shifting currents in FX and interest rate derivatives: highlights from the 2025 Triennial Survey (BIS Quarterly Review, December 2025, Foreword)
- Herausgeber: Bank für Internationalen Zahlungsausgleich (BIZ) / Bank for International Settlements (BIS)
- Datum: 08.12.2025
- URL: https://www.bis.org/publ/qtrpdf/r_qt2512_foreword.htm
- Belegt: Der Handel stieg nach den US-Zollankündigungen vom 2. April 2025 und einer unerwarteten Abwertung des US-Dollars; Devisenumsatz USD 9.5 Billionen pro Tag im April 2025. Fakt `m01-tariff-date`. Die Grösse der Dollar-Bewegung im April 2025 zeigt das Modul nicht als Fakt, sondern rechnet sie aus den EZB-Referenzkursen (`ecb-reference-rates`).

<!-- Modul 02 -->

## bis-rpfx25-fx

- Titel: OTC foreign exchange turnover in April 2025 (Triennial Central Bank Survey, preliminary results)
- Herausgeber: Bank für Internationalen Zahlungsausgleich (BIZ) / Bank for International Settlements (BIS)
- Datum: 30.09.2025
- URL: https://www.bis.org/statistics/rpfx25_fx.htm
- Belegt: Im April 2025 lag der Umsatz mit FX Spot um 42 % und mit Outright Forwards um 60 % über April 2022. Die Anteile am weltweiten Devisenumsatz stiegen von 28 % auf 31 % (Spot) und von 15 % auf 19 % (Outright Forwards). Vorläufige Zahlen. Fakten `m02-bis-fwd-share`, `m02-bis-fwd-growth`, `m02-bis-month`.

<!-- Modul 03 -->

## bis-triennial-2025

- Titel: Triennial Central Bank Survey of Foreign Exchange and OTC Derivatives Markets 2025 / Global FX trading hits $9.6 trillion per day in April 2025
- Herausgeber: Bank für Internationalen Zahlungsausgleich (BIZ) / Bank for International Settlements (BIS)
- Datum: 30.09.2025 (vorläufige Zahlen), Schlusszahlen im BIS Quarterly Review vom Dezember 2025
- URL: https://www.bis.org/statistics/rpfx25_fx.htm
- Pressemitteilung: https://www.bis.org/press/p250930.htm
- Belegt: Im April 2025 waren FX Swaps das meistgehandelte Instrument am Devisenmarkt mit einem durchschnittlichen Tagesumsatz von rund USD 4 Billionen; Gesamtumsatz USD 9.6 Billionen pro Tag (vorläufig) bzw. USD 9.5 Billionen (Schlusszahlen); Anteil daraus abgeleitet gut 40 %. Die Umfrage findet alle drei Jahre statt; Zentralbanken und Behörden in 52 Ländern erheben die Daten bei den Händlern, die BIZ koordiniert. Fakten `m03-bis-month`, `m03-bis-swaps`, `m03-bis-total`, `m03-bis-share`. Geprüft per Websuche (23.10.2026), Seite aus der Sandbox nicht erreichbar.

<!-- Modul 04 -->

## garman-kohlhagen-1983

- Titel: Foreign currency option values
- Herausgeber: Journal of International Money and Finance (Elsevier), Vol. 2, Heft 3, S. 231–237
- Datum: Dezember 1983
- URL: https://www.sciencedirect.com/science/article/pii/S0261560683800011
- Belegt: Publikationsjahr 1983 des Garman-Kohlhagen-Modells für Devisenoptionen (Black-Scholes mit zwei Zinsen). Fakt `gk-1983`.

<!-- Modul 05 -->

## snb-2022-09-22

- Titel: Introductory remarks, Swiss National Bank news conference (Thomas Jordan)
- Herausgeber: Schweizerische Nationalbank (SNB), veröffentlicht von der Bank für Internationalen Zahlungsausgleich (BIZ) / Bank for International Settlements (BIS)
- Datum: 22.09.2022
- URL: https://www.bis.org/review/r220922b.htm
- Belegt: Die SNB erhöht den SNB-Leitzins um 0.75 Prozentpunkte auf 0.5 % (von −0.25 %), gültig ab 23.09.2022; damit endet die Phase negativer Zinsen in der Schweiz (seit Januar 2015). Bestätigt im SNB-Geschäftsbericht 2022, Rechenschaftsbericht ("The almost eight-year period of negative interest ended with the decision in September 2022"): https://www.snb.ch/dam/jcr:5f45c39f-19bd-4190-a87f-5674b6f93557/annrep_2022_rechenschaft.en.pdf

<!-- Modul 07 -->

## ecb-reference-rates-method

- Titel: Euro foreign exchange reference rates (methodology)
- Herausgeber: Europäische Zentralbank (EZB) / European Central Bank
- Datum: laufend / ongoing
- URL: https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html
- Belegt: Die Referenzkurse beruhen auf einem täglichen Abstimmungsverfahren zwischen Zentralbanken, das normalerweise um ca. 14:10 MEZ stattfindet; Veröffentlichung um ca. 16:00 MEZ an jedem Arbeitstag; nur zu Informationszwecken, die Nutzung für Transaktionen wird ausdrücklich nicht empfohlen («published for information purposes only», «using the rates for transaction purposes is strongly discouraged»). Darum nennt das Tool sie keine handelbaren Preise und das Replay in 07.4 ein hypothetisches Szenario mit täglichen EZB-Referenzkursen (Text, Caption, GapReplay). Fakt `m07-ecb-time`. Geprüft per Websuche (22.10.2026, erneut 23.10.2026: «normally takes place around 14:10 CET»; 23.10.2026: Informationszweck und Transaktionshinweis), Seite aus der Sandbox nicht erreichbar.

---

# Prüfprotokoll / Verification notes

Notes of the agents that wrote and checked the sources (merged from the former per-module fragments on 23.10.2026).

### Quellen Riskometer / Riskometer sources

Sources for the market events in `src/data/events.json` and the validation whitelist in
`src/lib/data/validate.ts`. Data source of the Riskometer itself: `ecb-reference-rates` in
`src/content/sources.md`. Numbers that the ECB data can compute (moves, vol peaks) are not
sourced here; they are calculated by `scripts/build-riskometer.ts`.

Verification (22.10.2026): every URL below was found in a web search index with a matching
title and summary; the pages themselves could not be opened from the build sandbox (network
policy). See PROGRESS.md, open questions.

### Quellen Modul 01 / Sources module 01 (FX-Markt & Spot)

Facts of module 01 are registered in `src/content/facts/m01.ts`. Everything else in the module
is either computed (running example, schematic teaching models in `src/lib/m01`, ECB reference
rates in `data/raw/ecb-eur-reference.csv`) or textbook knowledge and market convention (T+2,
USD/CAD T+1, pips and big figures, session times as a schematic, central bank names, roles of
currencies as tendencies). The remark in section 2 that reference rates such as the ECB's are
daily snapshots, and the note in section 4 that the ECB publishes no USD/CHF rate (it is a cross
of EUR/CHF and EUR/USD), rest on `ecb-reference-rates` in `src/content/sources.md`.

Verification (23.10.2026): bis.org cannot be opened from the build sandbox (network policy,
"CONNECT tunnel failed, 403"; WebFetch: host not found). The statements below were checked with
several web searches whose results quote the bis.org pages listed (press release, statistical
release `rpfx25_fx.htm`, Quarterly Review December 2025). Please open the URLs once from a normal
browser before publishing (open question in the module report).

Review (23.10.2026): a second web search again returned the BIS press release p250930 with the
dollar on one side of 89 % of all trades and the franc as the sixth most traded currency; the
final turnover of USD 9.5 trillion (Quarterly Review December 2025) could not be re-opened from
the sandbox either.

### Quellen Modul 02 / Sources module 02 (Forward)

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
Second check by the review agent (23.10.2026): a fresh web search again quotes the BIS release
"Turnover of FX spot increased by 42% and outright forwards rose 60%. Their shares in global
turnover increased to 31% and 19%"; bis.org itself was still unreachable from the sandbox. The
60 % is growth of turnover, not of the share; the module text says so.

### Quellen Modul 03 / Sources module 03 (FX Swap)

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

### Quellen Modul 04 / Sources module 04

Verification (22.10.2026): the bibliographic record was confirmed in a web search index
(EconBiz record, Macroption summary and a BIS paper citing it agree on journal, volume, issue
and year). The publisher page could not be opened from the build sandbox (network policy).

### Quellen Modul 05 / Sources module 05

Facts used in `src/content/facts/m05.ts`. The cut to −0.75 % in January 2015 is sourced by
`snb-2015-01-15` in `src/content/sources/riskometer.md`.

Verification (22.10.2026): the build sandbox cannot open snb.ch or bis.org directly (DNS); the
statements below were checked against web search results that quote the SNB news conference
remarks of 22.09.2022 (published by the BIS) and the SNB Annual Report 2022 ("The almost
eight-year period of negative interest ended with the decision in September 2022").

### Quellen Modul 06 / Sources module 06

Module 06 uses one sourced fact, `m06-snb-safe-haven-2009` (section 4, sign intuition of the
risk reversal: demand for CHF calls as protection). It cites the existing entry
`snb-speech-2009-09-25` in `riskometer.md` (SNB speech "The Swiss franc and the financial market
crisis", 25.09.2009), so the entry is not duplicated here. When the source fragments are merged
into `sources.md`, please extend its "Belegt" line with: "Modul 06, Fakt
`m06-snb-safe-haven-2009` (Franken als sicherer Hafen)".

Verification (23.10.2026, checked twice): a web search restricted to snb.ch for the exact
sentence "The crisis has shown that the Swiss franc still has a safe haven status" returns the
SNB's own page "The Swiss franc and the financial market crisis"
(https://www.snb.ch/en/publications/communication/speeches/2009/ref_20090925_tjn, speech by
Thomas J. Jordan, 25.09.2009; German PDF under snb.ch/de/mmr/speeches/id/ref_20090925_tjn). The
indexed text also says that before the crisis the franc's safe-haven role "was frequently
questioned". The SNB and BIS sites themselves could not be opened from the build sandbox (DNS
blocked), so the wording was checked against the search index only.

Review (23.10.2026, second agent): a fresh web search again returned the SNB page with the exact
sentence, given by a member of the SNB Governing Board. The module text therefore attributes the
statement to "ein Mitglied des Direktoriums der SNB" in a 2009 speech (no person named, D-01),
not to the SNB as an institution.

Everything else in module 06 (spreads, risk reversal, straddle, strangle, butterfly, seagull,
the ATM / 25Δ risk reversal / 25Δ butterfly quotes and the quadratic smile in delta) is
textbook material; all numbers come from the calculation core and are example values, not
market data.

### Quellen Modul 07 / Sources module 07 (Barrier & Binary)

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

### Quellen Modul 08 / Sources module 08 (Strukturierte Produkte)

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

### Quellen Modul 09 / Sources module 09 (Hedge, Alpha, Yield)

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
