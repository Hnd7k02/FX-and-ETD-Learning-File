# Forward First: Master-Prompt für Claude Code

Version 1.2 · Oktober 2026 · Konzept und Produktentscheide: Dario Moffa

1.2: Ausgabe ist eine einzige Offline-HTML-Datei für Arbeits-PC und iPad, kein Hosting, kein Login (D-13, Abschnitte 3, 4, 9, 11, 13).

Du baust **Forward First**, ein interaktives Lerntool für den Devisenmarkt: vom Spot über Forward und FX Swap zu Vanilla Options, den sechs Greeks und exotischen Strukturen. Der rote Faden: **Alles wird auf den Forward heruntergebrochen.**

Lies dieses Dokument vollständig, danach `docs/design/README.md`. Erst dann beginnst du.

---

## 0. Arbeitsweise

1. **Phasen mit Stopps.** Du arbeitest den Phasenplan (Abschnitt 13) der Reihe nach ab. Am Ende jeder Phase hältst du an und lieferst einen kurzen Bericht: was gebaut wurde, Ergebnis von `npm run check` mit Exit-Code, offene Punkte, wie Dario es ansehen kann. Dann wartest du auf "weiter".
2. **Modellwechsel.** Jede Phase nennt ein empfohlenes Modell und eine Effort-Stufe. Empfiehlt die nächste Phase etwas anderes als die aktuelle, schreibst du am Ende des Berichts: "Nächste Phase: bitte auf ‹Modell, Effort› wechseln." Dann wartest du.
3. **Fragen statt raten.** Ist etwas unklar oder widersprüchlich, fragst du. Kleine technische Entscheide triffst du selbst und trägst sie in `DECISIONS.md` ein.
4. **Gedächtnis im Repo.** Ab Phase 0 pflegst du drei Dateien im Repo-Root:
   - `CLAUDE.md`: die Regeln aus Abschnitt 2 und 11, knapp. Jede neue Session liest sie zuerst.
   - `DECISIONS.md`: jeder Entscheid mit Herkunft (Format in Abschnitt 12).
   - `PROGRESS.md`: Phase, Stand, nächster Schritt, offene Fragen. So kann jede neue Session nahtlos weitermachen.
5. **Prüfe Exit-Codes, nicht Zusammenfassungen.** Eine Phase gilt erst als fertig, wenn `npm run check` mit Exit-Code 0 endet (ab Phase 2 zusätzlich `npm run e2e`; die E2E-Tests decken nur bereits gebaute Features ab und wachsen mit jeder Phase).
6. **Commits:** klein, sprechend, Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`, `data:`).

## 1. Produkt

**In einem Satz:** Ein helles, ruhiges Lerntool, das FX-Instrumente aufbauend erklärt, jede Zahl live rechnet und mit einem Riskometer echte Marktausschläge erlebbar macht.

**Zielgruppe:** Einsteigerinnen und Einsteiger in Banking und Wealth Management, Studierende, Dario selbst. Das Tool dient auch als Portfolio-Projekt für Bewerbungen.

**Ziele V1**
- Neun Module, Deutsch mit englischen Fachbegriffen, komplett auf Englisch umschaltbar.
- Drei Signature-Interaktionen: Wow-Moment, Greeks-Labor, Riskometer.
- Jede Zahl ist gerechnet und getestet, nichts ist abgetippt.
- Ein Repo, das als Beleg taugt: Tests, Entscheide mit Herkunft, saubere Doku.

**Nicht-Ziele V1:** Accounts oder Backend, Dark Mode, Intraday-Kurse, Handelsempfehlungen, Analytics, CMS, Kommentare.

## 2. Leitplanken (nicht verhandelbar)

- **Education only.** Keine Namen von Banken, Firmen, Personen oder Kunden. Keine internen Begriffe, Systeme oder Prozesse irgendeiner Bank. Darios Arbeitgeber kommt weder im Tool noch im Repo vor.
- **Disclaimer** im Footer jeder Seite und auf der Über-Seite: "Nur zu Bildungszwecken. Keine Anlageberatung." (EN: "For educational purposes only. Not investment advice.")
- **Zahlen-Integrität:** Jede Zahl in UI und Texten kommt aus dem Rechenkern (`src/lib/fx`) oder aus den Daten (`src/data`). In Texten stehen Platzhalter, keine abgetippten Werte. Ausnahme: historische Fakten mit Quelle (z. B. Mindestkurs 1.20, Zins −0.75 %).
- **Fakten-Integrität:** Marktereignisse, institutionelle Fakten und Statistiken nur mit Quelle in `src/content/sources.md`. Lehrbuchwissen ist erlaubt, Erfundenes nicht. Bist du unsicher, lass es weg und notiere es in `PROGRESS.md` als offene Frage.
- **Strukturierte Produkte:** immer in Bausteine zerlegt, immer mit Verlustszenario, immer generisch ohne Produkt- oder Anbieternamen.
- **Schweizer Formate:** `de-CH` mit Apostroph als Tausendertrenner und Punkt als Dezimalzeichen (CHF 12’669, 0.7930). Prozent mit geschütztem Leerzeichen ("8 %"). Kurse mit 4 Nachkommastellen, JPY-Paare mit 2. Pip = 0.0001, bei JPY-Paaren 0.01. Englisch: `en-GB`.
- **Du-Form** im Deutschen, kurze Sätze. Fachbegriffe wie Forward Points, Strike, Moneyness oder Knock-out bleiben englisch; das Glossar erklärt sie.

## 3. Tech-Stack und Struktur

- **Astro** (aktuelle Version, statischer Output) + **TypeScript strict** + **Preact**-Inseln für alle interaktiven Komponenten.
- **CSS** mit Custom Properties aus `docs/design/tokens.css`, kein Tailwind, keine UI-Bibliothek.
- **Charts** als handgeschriebenes SVG wie im Prototyp, keine Chart-Bibliothek.
- **Tests:** Vitest (Unit), Playwright (E2E), `@axe-core/playwright` (Barrierefreiheit). ESLint, Prettier, `astro check` (prüft auch `.astro`-Dateien).
- **Ausgabe: eine einzige Datei `forward-first.html`** (D-13). Sie läuft offline über `file://` auf dem Arbeits-PC (Chrome und Edge, Doppelklick) und in der Dateien-App des iPad (WebKit). Das iPad lädt dort keine Nebendateien, deshalb steckt alles in der einen Datei: CSS, JavaScript, Schriften (Subset), Riskometer-Daten, beide Sprachen. Keine externen Dateien, keine Netzwerk-Anfragen, abgesichert durch eine Content-Security-Policy im Meta-Tag (`default-src 'none'`, Skript nur per Hash). Ziel unter 3 MB, höchstens 5 MB.
- **Build:** `npm run build` = Astro-Build (`dist/`, dient nur noch als Zwischenstufe und Testumgebung) und danach `scripts/build-offline.ts`, das alle Seiten in die Datei `release/forward-first.html` packt (Seiteninhalte gzip + Base64, ein JavaScript-Bundle für Router und Inseln, Schriften als data-URI).
- **Navigation in der Datei** per Hash-Routing mit denselben Pfaden wie in Abschnitt 5, z. B. `#/module/05-greeks/2/` oder `#/riskometer/?pair=USDJPY`. Rechenkern, Komponenten und Inhalte sind dieselben wie im Astro-Build.
- **Alles Optionale mit Feature-Erkennung und Fallback:** Übergang Station → Modul mit der View Transitions API, sonst normaler Wechsel; Monte Carlo ohne Web Worker in kleinen Häppchen auf dem Main Thread; Fortschritt in `localStorage`, und wenn das blockiert ist, läuft das Tool ohne gespeicherten Fortschritt weiter.
- **Kein Hosting, keine PWA, kein Login.** Die Datei wird als GitHub Release zum Download bereitgestellt (Abschnitt 9).
- **Node LTS, npm.**

```
src/
  lib/fx/          Rechenkern: reine Funktionen, kein DOM
  lib/data/        realisierte Vola, Perzentile, Stufen, Ereignis-Kennzahlen
  components/      Astro-Komponenten und Preact-Inseln
  content/         Module (MDX, de/en), Quiz, Glossar, sources.md
  i18n/            UI-Strings de/en
  pages/           Routen (de unter /, en unter /en/)
  client/          Seitenskripte (Navigation, Stepper, Abschnittsende), im Astro-Build und in der Datei gleich
  offline/         Laufzeit der Offline-Datei: Hash-Router, Inseln, Übergänge
  data/fx/         generierte JSON-Snapshots für das Riskometer
  styles/          tokens.css, base.css
scripts/           fetch-ecb.ts, build-riskometer.ts, precompute-mc.ts, build-offline.ts
data/raw/          EZB-Rohdaten (CSV), versioniert
tests/             unit/, offline/ (die Datei über file://), e2e/ (Komponenten im Astro-Build)
release/           forward-first.html (Build-Ergebnis, nicht versioniert)
docs/              MASTER_PROMPT.md, design/, reference/
```

## 4. Design (verbindlich: Richtung B "Lernpfad")

Referenz: `docs/design/*.dc.html` und `docs/design/tokens.css`. Baue Layout, Abstände, Farben, Schriften und Interaktionen getreu nach. Jede bewusste Abweichung kommt mit Begründung in `DECISIONS.md`.

- **Look:** hell, minimalistisch, Finance. Weisse Karten auf hellgrauer Fläche, schwarze Pill-Buttons. Akzentfarben nur zum Hervorheben.
- **Schriften:** Plus Jakarta Sans (UI), JetBrains Mono (Kurse, Tabellenwerte), STIX Two Text (Formeln, Variablen kursiv). Aus Fontsource als woff2-Subset (Latin, bei STIX zusätzlich Griechisch) direkt in die Datei eingebettet, keine Requests; `font-display: swap` und System-Fallbacks.
- **Farbsemantik in Charts:** Long blau, Short orange, Forward und Tangenten schwarz, Zeitwert als blaue Fläche mit 10 % Deckkraft, Auszahlung bei Verfall grau gestrichelt. Gridlines 1 px durchgezogen, Achse dunkler.
- **Modulfamilien:** Linear blau (01–03), Optionen violett (04–06), Exotics orange (07–08), Anwendung teal (09).
- **Riskometer-Stufen:** Ruhig grün, Normal lime, Erhöht gelb, Hoch orange, Extrem rot. Immer mit Label, nie Farbe allein.
- **Startseite:** Top-Nav (Logo "Forward First" mit Hockey-Stick-Glyphe, Module, Riskometer mit Stufen-Punkt, Glossar, DE/EN, schwarzer Button "Weiterlernen"), Hero ("Alles beginnt beim Forward."), Wow-Karte in voller Breite, Lernpfad mit 9 Stationen in 4 Familien, Karte "Weiter, wo du warst", Karte "Riskometer heute" mit Tacho, Footer.
- **Modulseite:** Kopfband mit Breadcrumb, Familien-Chip, Titel und Abschnitts-Stepper; Lesespalte mit 680 px; Figures (Labore, Charts) in voller Containerbreite von 1080 px; Formelboxen; dunkler "Am Desk"-Callout; Quiz-Karte; Zurück/Weiter.
- **Übergang (Signature):** Tippt man im Lernpfad eine Station an, wächst sie in den Modulkopf. Umsetzung in der Offline-Datei mit der View Transitions API (`document.startViewTransition`) und passenden `view-transition-name`-Werten. Ohne Browser-Support wird normal navigiert, bei `prefers-reduced-motion` ohne Animation.
- **Responsive:** 390 bis 1440 px, kein horizontales Scrollen der Seite. Zielgeräte: Arbeits-PC (1440 × 900) und iPad hoch (820 × 1180) und quer (1180 × 820). Unter 640 px wird der Lernpfad zur vertikalen Liste, die Labor-Bedienelemente rutschen unter die Charts. Touch-Ziele mindestens 44 px.
- **Barrierefreiheit:** WCAG 2.2 AA. Echte `<button>`, `<a>`, `<input>` mit `<label>`. Jeder Chart hat ein `aria-label` und eine Textalternative. Sichtbare Fokusringe, `prefers-reduced-motion` überall respektiert.

## 5. Seiten, Navigation, Fortschritt

**Routen** (Deutsch unter `/`, Englisch unter `/en/`):
In der Offline-Datei stehen dieselben Pfade nach dem `#`, z. B. `forward-first.html#/en/riskometer/`.
- Startseite: `/` und `/en/`
- Modulabschnitte: `/module/{modul}/1/` bis `/module/{modul}/4/` sowie `/module/{modul}/quiz/`, in beiden Sprachen mit gleichen Slugs; `/module/{modul}/` leitet auf Abschnitt 1 um. Modul-Slugs: `01-spot`, `02-forward`, `03-fx-swap`, `04-vanilla-options`, `05-greeks`, `06-combos-smile`, `07-barrier-binary`, `08-structured-products`, `09-hedge-alpha-yield`
- Riskometer: `/riskometer/` und `/en/riskometer/`
- Glossar: `/glossar/` und `/en/glossary/`
- Über und Methodik: `/ueber/` und `/en/about/`

**Fortschritt** in `localStorage` (Schlüssel `ff-progress-v1`), nur im Browser, ohne Tracking. Ist `localStorage` blockiert, läuft das Tool ohne gespeicherten Fortschritt weiter:
- Ein Abschnitt ist erledigt, wenn sein Ende sichtbar war (IntersectionObserver).
- Ein Modul ist erledigt, wenn sein Quiz mit mindestens 3 von 4 bestanden ist.
- Fortschritt in Prozent = (erledigte Abschnitte + bestandene Quiz) / 45, also 9 Module × 4 Abschnitte plus 9 Quiz.
- Die Startseite zeigt den Fortschritt in Prozent, den Status jeder Station und "Weiter, wo du warst". "Weiterlernen" führt zum ersten offenen Abschnitt.
- Auf der Über-Seite gibt es "Fortschritt zurücksetzen".

**Sprache:** Der Umschalter öffnet dieselbe Seite in der anderen Sprache und merkt sich die Wahl.

## 6. Durchgehendes Beispiel (Single Source of Truth)

Alle Module erzählen denselben Fall: **Ein Schweizer Importeur muss in 3 Monaten USD 1 Mio. bezahlen.** Er fürchtet einen stärkeren Dollar.

Definiert in `src/lib/fx/example.ts`, gekennzeichnet als "Beispielwerte, keine Marktdaten":
- USD/CHF Spot 0.8000; Zins CHF 0.0 % (domestic, Quote-Währung), USD 3.5 % (foreign, Base-Währung)
- Laufzeit 3 Monate: T = 0.25 im Optionsmodell, 90 Tage Act/360 in der Geldmarkt-Konvention. Im Optionsmodell gilt überall T = Tage/365 bzw. Wochen/52.
- Vola 8 %; Strike ATMF 0.7930; Nominal USD 1 Mio.; Position Long USD Call / CHF Put

**Referenzwerte für die Tests** (aus `docs/reference/gk_reference.py`):

| Grösse | Wert | Toleranz |
|---|---|---|
| Forward stetig | 0.79303 (−69.7 Pips) | 1e-5 |
| Forward Geldmarkt (Act/360, 90 Tage) | 0.79306 (−69.4 Pips) | 1e-5 |
| Call | 126.69 Pips = CHF 12’669 | 0.01 Pips |
| Put-Call-Parität | C − P = DF_d · (F − K) | 1e-10 |
| Delta (Spot) | 0.5039; bei S = 0.8100: 0.6244 | 1e-4 |
| Gamma | 12.3556 (+0.124 Delta je Big Figure) | 1e-3 |
| Vega | CHF 1’582 je Vola-Punkt | CHF 1 |
| Theta analytisch (Jahres-Theta / 365) | CHF −30.67 pro Kalendertag | CHF 0.01 |
| Theta als 1-Tages-Differenz V(T − 1/365) − V(T); diesen Wert zeigt das UI | CHF −30.82 | CHF 0.01 |
| Gamma-Anteil von Theta, Θ_Γ = −½ · σ² · S² · Γ / 365 | CHF −69.33 pro Kalendertag | CHF 0.01 |
| Rho CHF / Rho USD | CHF +976 / CHF −1’008 je +1 % | CHF 1 |
| Zeitwert ATMF (Black-76) | 126.5 Pips (3M), 253.0 Pips (1Y) | 0.1 Pips |
| Break-even-Tagesbewegung eines delta-gehedgten Calls, σ · S / √365 | 33.50 Pips | 0.01 Pips |

## 7. Rechenkern `src/lib/fx`

Konvention: Paar Base/Quote, `rd` = Zins der Quote-Währung (domestic), `rf` = Zins der Base-Währung (foreign). Preise in Quote-Währung pro 1 Einheit Base.

- **Forward:** `forward(S, rd, rf, T, convention)` mit `continuous` und `moneyMarket` (Tageszählung pro Währung konfigurierbar: CHF, USD, EUR Act/360; GBP, JPY Act/365); `forwardPoints`; Cash-and-Carry-Arbitrage (Schritte und Gewinn bei Abweichung vom fairen Forward).
- **FX Swap:** Near und Far Leg, Swap Points, Cashflows, Hedge-Roll.
- **Vanilla:** Garman-Kohlhagen (Call, Put), Black-76 auf den Forward, innerer Wert gegen den Forward und Zeitwert, Put-Call-Parität, implizite Vola (Newton mit Bisektions-Fallback), Strike aus Spot-Delta (25Δ, 10Δ).
- **Greeks:** Delta (Spot und Forward), Gamma, Vega, Theta, Rho domestic, Rho foreign; analytisch plus Finite-Differenzen-Check als eigene Funktion fürs UI ("numerischer Check"). Theta zeigt das UI als 1-Tages-Differenz, die Herleitung nutzt die analytische Formel; beide sind getestet.
- **Smile:** Quotes ATM, 25Δ Risk Reversal und 25Δ Butterfly in der Smile-Strangle-Konvention. RR = σ(25Δ USD Call) − σ(25Δ USD Put); Nachfrage nach CHF-Calls bedeutet RR < 0. Interpolation quadratisch im Forward-Delta des Calls: σ(Δ) = ATM − 2 · RR · (Δ − 0.5) + 16 · BF · (Δ − 0.5)². Daraus folgen σ25C = ATM + BF + RR/2 (Δ = 0.25) und σ25P = ATM + BF − RR/2 (Δ = 0.75). Die Broker-Fly-Konvention nur als Desk-Hinweis im Text.
- **Exotics, geschlossene Formeln:** europäische Digitals (Cash-or-Nothing), die acht Single-Barrier-Typen (Reiner-Rubinstein, stetige Beobachtung), One-Touch und No-Touch, Double No-Touch per Reihenformel (z. B. nach Hui, 1996). In-Out-Parität als Test.
- **Monte Carlo (erst in Phase 6):** Seed-basierter RNG, GBM mit Drift rd − rf, Tagesschritte (Δt = 1/365), antithetische Pfade. Für Window Barrier, Accumulator und Decumulator, TARF, Pivot TARF, TPF und RTPF, dazu als Kontrolle für Double No-Touch. Die Simulation beobachtet Barrieren einmal pro Tag; für Vergleiche mit stetigen Formeln wird die Barriere nach Broadie-Glasserman-Kou um den Faktor e^(±0.5826 · σ · √Δt) verschoben. Interaktive Szenarien laufen in einem Web Worker. Faire Strikes bzw. Coupons für die Produkte aus 8.7 rechnet `scripts/precompute-mc.ts` beim Build und schreibt sie als JSON mit Pfadanzahl und Standardfehler.

**Tests (mindestens):** alle Referenzwerte aus Abschnitt 6; Parität; KI + KO = Vanilla; Knock-out mit sehr weit entfernter Barriere = Vanilla (der Knock-in geht dabei gegen 0); Digital ≈ −∂C/∂K; Monotonie (Call steigt mit S und σ). Monte Carlo: europäische Payoffs gegen die geschlossene Formel innerhalb von 3 Standardfehlern; Barrieren und Touch mit BGK-Korrektur innerhalb einer dokumentierten Toleranz. Testabdeckung von `src/lib` mindestens 90 % Zeilen.

## 8. Signature-Komponenten

### 8.1 Wow-Moment `WowChart` (Startseite, Modul 04)

Getreu nach `WowChart.dc.html`. Vier Phasen auf derselben Achse (USD/CHF, Gewinn bzw. Wert in Pips, Strike = Forward 0.7930):
1. **Forward: linear.** Gerade durch den Strike, Delta 1.
2. **Call: asymmetrisch.** Die Linie knickt am Strike ab; der Forward bleibt gestrichelt zum Vergleich.
3. **Vor Verfall: der Zeitwert.** Glatte Black-76-Kurve über dem Knick; Zeitwert als Fläche, Markierung "Zeitwert ‹n› Pips" am Strike. Regler "Laufzeit bis Verfall" (0 bis 365 Tage).
4. **Long Call + Short Put = Forward.** Call blau, Put orange, die Summe als schwarze Linie: die Put-Call-Parität.

Verhalten: Autoplay, Phase 5.2 s, Phase 3 6.4 s; Kurven-Morph 900 ms easeInOutCubic; in Phase 3 läuft die Laufzeit von 365 Tagen bis T = 0.25 (91.25 Tage, Anzeige "3 Monate"); T = Tage/365. Fortschrittsbalken im aktiven Schritt, Play/Pause-Button. Ein Klick auf einen Schritt oder den Regler stoppt den Autoplay. Bei `prefers-reduced-motion` gibt es keinen Autoplay und keinen Morph. Legende, Untertitel und Formel-Chip wechseln pro Phase. Die Texte stehen im Prototyp.

### 8.2 Greeks-Labor `GreeksLab` (Modul 05)

Getreu nach `GreeksLab.dc.html`:
- Oben die Preis-Kurve V(S) mit Tangente (Steigung = Delta), unten die Delta-Kurve mit Tangente (Steigung = Gamma), gemeinsame x-Achse, vertikale Hilfslinie beim aktuellen Spot. Tangenten auf den Plotbereich geclippt.
- Regler: Spot 0.7600 bis 0.8400 (Schritt 0.0005), Laufzeit 1 bis 52 Wochen (T = Wochen/52), Vola 4 bis 16 % (Schritt 0.5).
- Moneyness-Chip relativ zum Forward: ATMF bei |F − K| ≤ 1 Pip, sonst ITM oder OTM mit Abstand in Pips; Prämie in Pips und CHF; die sechs Greeks auf USD 1 Mio.; numerischer Gamma-Check.
- Prop `mode`: `delta-gamma` (Standard), `vega` (x-Achse Vola), `theta` (x-Achse Restlaufzeit), `rho` (x-Achse Zins CHF bzw. USD). So trägt dieselbe Komponente alle Abschnitte von Modul 05.

### 8.3 Payoff-Builder (Module 04 und 06)

Beine: Long/Short Call, Put oder Forward, mit Strike und Nominal. Er zeigt die Auszahlung bei Verfall und den Wert heute. Vorlagen: die vier Grundpositionen, synthetischer Forward, Call- und Put-Spread, Risk Reversal (Zero-Cost-Collar für den Importeur), Straddle, Strangle, Butterfly, Seagull. Die Nettoprämie wird angezeigt; ist sie null, steht "Zero Cost".

### 8.4 Pfad-Simulator (Module 07 und 08)

Seed-basierte Pfade und Szenario-Vorlagen: Trend auf, Trend ab, Seitwärts, Schock mit Gap. Er zeigt Barrieren-Ereignisse, Fixings, eine Cashflow-Tabelle und den kumulierten Gewinn bzw. Verlust gegenüber einem Forward-Hedge. Die Wiedergabe lässt sich pausieren.

### 8.5 Session-Uhr (Modul 01)

24-Stunden-Band mit Wellington/Sydney → Tokio → London → New York und einer schematischen Liquiditätskurve (höchste Liquidität bei der Überlappung London/New York). Beschriftet als "schematisch". Die eigene Uhrzeit (Europe/Zurich) wird markiert.

### 8.6 Riskometer: siehe Abschnitt 9.

### 8.7 Strukturierte Produkte: Definitionen (Module 08 und 09)

Vereinfachte, generische Ausgestaltungen; im Tool als solche gekennzeichnet ("Marktvarianten unterscheiden sich"). S_i = Fixing USD/CHF, N = Nominal pro Fixing, Hebel 2. Keine Prämie: Strike bzw. Coupon wird so gelöst, dass der Barwert null ist (Monte Carlo). Die Parameter sind Beispielwerte.

| Produkt | Pro Fixing | Ende | Beispielparameter |
|---|---|---|---|
| Accumulator (Käufer von USD) | K ≤ S_i < B: kauft N zu K. S_i < K: kauft 2N zu K. | S_i ≥ B (Knock-out) oder Laufzeitende | 26 Wochen-Fixings, N = USD 40’000, B = Spot + 3 %, K gelöst |
| Decumulator (Verkäufer von USD) | B < S_i ≤ K: verkauft N zu K. S_i > K: verkauft 2N zu K. | S_i ≤ B oder Laufzeitende | gespiegelt, B = Spot − 3 % |
| TARF (Käufer von USD) | S_i ≥ K: kauft N zu K, Gewinn (S_i − K) · N zählt aufs Target. S_i < K: kauft 2N zu K, der Verlust zählt nicht. | kumulierter Gewinn erreicht das Target (letzter Gewinn aufs Target gekappt) oder Laufzeitende | 12 Monats-Fixings, N = USD 100’000, Target 500 Pips, K gelöst |
| Pivot TARF | K1 < S_i ≤ P: kauft N zu K1. P < S_i < K2: verkauft N zu K2. S_i ≤ K1: kauft 2N zu K1. S_i ≥ K2: verkauft 2N zu K2. Gewinne zählen aufs Target. | wie TARF | P = Spot, K1 und K2 symmetrisch um P gelöst, Target 300 Pips |
| TPF (Coupon, direktional) | S_i ≥ K: erhält Coupon c · N. S_i < K: zahlt 2 · (K − S_i) · N. | Summe der Coupons erreicht das Target oder Laufzeitende | 12 Monats-Fixings, K = Spot − 2.5 %, Target = 6 Coupons, c gelöst |
| RTPF (Coupon, Range) | L ≤ S_i ≤ U: erhält c · N. S_i < L: zahlt 2 · (L − S_i) · N. S_i > U: zahlt 2 · (S_i − U) · N. | wie TPF | L und U = Spot ∓ 3.5 %, Target = 6 Coupons, c gelöst |
| Dual Currency (Anlage in CHF) | eine Fixierung bei Verfall. S_T ≥ K: CHF-Kapital plus erhöhter Zins. S_T < K: Kapital wird zu K in USD umgewandelt, plus Zins. | Verfall | CHF 100’000, 1 Monat, K = Spot − 1 %; Zins = Geldmarktzins plus annualisierte Prämie des verkauften USD Put / CHF Call |

Im Text wird jede Zeile in Bausteine zerlegt, z. B. Accumulator = Serie aus gekauften Calls und doppelt so vielen verkauften Puts zum selben Strike, mit Knock-out bei B.

## 9. Riskometer und Datenpipeline

**Quelle:** EZB-Referenzkurse (werktags um ca. 16:00 MEZ) über die ECB Data Portal API:
`https://data-api.ecb.europa.eu/service/data/EXR/D.USD+CHF+JPY.EUR.SP00.A?startPeriod=1999-01-04&format=csvdata`
Paare: EUR/CHF und EUR/USD direkt; USD/CHF = EURCHF/EURUSD; USD/JPY = EURJPY/EURUSD. Rohdaten versioniert unter `data/raw/`.

**Methode** (in `src/lib/data`, getestet):
- Realisierte Vola: Log-Renditen aufeinanderfolgender Fixings, Fenster 21 Log-Renditen (22 Fixings), Mittelwert 0, annualisiert mit √252, in %.
- Chart: Wochenwerte (letzter Wert der Woche) ab 2006; Kennzahlen aus Tageswerten.
- Perzentil-Basis: alle Tageswerte seit 01.01.2006, je Paar separat. Stufen: unter P20 Ruhig, P20 bis P60 Normal, P60 bis P85 Erhöht, P85 bis P97 Hoch, ab P97 Extrem. Die Schwellen in % stehen in der Legende.
- Tacho: fünf gleich breite Segmente; Nadel = Segmentindex + Anteil innerhalb der Stufe, gemessen in Perzentilen. Die Stufe Extrem reicht von P97 bis P100 (historisches Maximum); Werte darüber werden geklemmt. Nadel-Animation 1.4 s easeOutCubic von links.

**Ereignisse** in `src/data/events.json`, mit `id`, `anchorDate`, `pairs`, Zeitfenster für die Kursbewegung, Texten DE/EN mit Platzhaltern (`{from}`, `{to}`, `{movePct}`, `{peak}`, `{peakDate}`). Die Kennzahlen rechnet das Build-Skript aus den Daten; die Spitze ist das Maximum der Vola von 10 Handelstagen vor bis 60 Handelstage nach `anchorDate` (2008 lag die Spitze erst im November). Startbestand (Texte im Prototyp `Riskometer.dc.html`, Zahlen dort durch Platzhalter ersetzen):

| id | Anker | Paare | Titel |
|---|---|---|---|
| gfc-2008 | 15.09.2008 | alle vier | Finanzkrise |
| floor-2011 | 06.09.2011 | EUR/CHF, USD/CHF | Mindestkurs 1.20 |
| chf-shock-2015 | 15.01.2015 | EUR/CHF, USD/CHF | Frankenschock |
| ukraine-2022 | 24.02.2022 | EUR/CHF, EUR/USD | Krieg in der Ukraine |
| carry-2024 | 05.08.2024 | EUR/CHF, USD/JPY | Carry-Unwind |
| fiscal-2025 | 05.03.2025 | EUR/CHF, EUR/USD | Deutsches Fiskalpaket |

Quellen für die Ereignis-Fakten gehören in `src/content/sources.md`, z. B. die SNB-Medienmitteilung vom 15.01.2015.

**UI** (getreu nach `Riskometer.dc.html`): Paar-Umschalter mit vier Paaren, Tacho mit Stufe und Perzentil, Chart mit Crosshair und Tooltip (Maus und Touch), Ereignis-Buttons (mindestens 44 px) nur für passende Paare, Fallkarte (`aria-live`), Umschalter "Daten als Tabelle" (Jahreshöchstwerte), Fussnote mit Methode und Quelle, "Stand ‹Datum›". Auf der Startseite der Mini-Tacho für EUR/CHF. Der Footer jeder Seite zeigt den Datenstand ("Kursdaten: EZB-Referenzkurse, Stand ‹Datum›").

**Daten-Update von Hand** (kein Cron): GitHub Action `.github/workflows/release.yml`, gestartet unter Actions → Release → "Run workflow": EZB-Daten holen → validieren → rechnen → `npm run check` → `npm run build` → Datei in Chromium und WebKit testen → geänderte Daten committen (`data: ECB ‹Datum›`) → GitHub Release mit `forward-first.html` als Download. Die Datei zeigt den Datenstand.
- Validierung: Daten aufsteigend, keine Duplikate, Kurse > 0, letzter Wert höchstens 5 Bankarbeitstage alt, tägliche |Log-Rendite| < 10 % für alle vier Paare inklusive der Kreuzkurse. Ausnahmen nur über eine dokumentierte Whitelist (15.01.2015 für EUR/CHF und USD/CHF). Schlägt etwas fehl, endet der Lauf ohne Commit und ohne Release.
- Workflow mit `permissions: contents: write` und `concurrency`, damit sich Läufe nicht überholen. Ohne Datenabruf (Schalter `update_data` aus) baut er nur die Datei neu und veröffentlicht sie.
- Lokal geht dasselbe mit `npm run data:fetch`, `npm run data:build`, `npm run check`, `npm run build`, `npm run e2e`.

**Tests:** Vola auf synthetischen Reihen mit bekanntem Ergebnis, Perzentile, Stufen-Mapping, Kreuzkurse, Ereignis-Kennzahlen auf Fixture-Daten, Validierungsregeln.

## 10. Inhalte

**Vorlage pro Modul:** vier inhaltliche Abschnitte plus Quiz. Jeder Abschnitt folgt dem Muster: Intuition am Fallbeispiel → Kern mit Interaktion → Rechenbeispiel (Zahlen aus dem Rechenkern) → Herleitung und Formel-Details **aufklappbar** (`<details>`, standardmässig zu) → bei Bedarf "Am Desk" → ein Merksatz.

**Quiz:** 4 Fragen pro Modul, Single Choice mit 3 bis 4 Optionen, Erklärung zu jeder Antwort, bestanden ab 3 von 4.

**Zahlen in MDX:** Werte aus dem Beispiel oder dem Rechenkern nur über `<Num of="…" />`. Belegte historische Zahlen (z. B. 1.20, −0.75 %) über `<Fact id="…" />`, verknüpft mit einem Eintrag in `sources.md`. Konventionen wie T+2 oder 25Δ sind normaler Text.

### 01 · FX-Markt & Spot
1. **Intuition:** Was ein Wechselkurs ist; der Importeur und seine USD 1 Mio.
2. **Ein Markt ohne Börse:** OTC, rund um die Uhr; die Woche startet in Wellington (Session-Uhr). Teilnehmer: Zentralbanken und Staatsfonds (Sovereigns), Real Money (z. B. Pensionskassen, Versicherungen, Asset Manager), Fast Money (z. B. Hedge Funds, gehebelt und kurzfristig), Firmen, Banken als Market Maker, Privat- und Wealth-Kunden.
3. **Quotierung und 2-Way Price:** Base/Quote, Pips, Big Figure, Bid/Ask, Spread und seine Treiber (Liquidität, Uhrzeit, Volumen, Vola, Risk Events); Valuta T+2 (USD/CAD T+1); Market, Limit und Stop-Loss inklusive Gap-Risiko. Dreiecksarbitrage mit Rechner (EUR/USD × USD/CHF gegen EUR/CHF).
4. **Gefühl für Währungen:** G10-Steckbriefe (USD, EUR, JPY, GBP, CHF, AUD, NZD, CAD, NOK, SEK): Zentralbank, Rolle (Safe Haven, Rohstoff, Funding/Carry), typische Treiber. Nur belegbare Aussagen.

### 02 · Forward
1. **Intuition:** Kurs heute fixieren, Lieferung später.
2. **Zinsparität:** Herleitung über zwei gleich sichere Wege; F = S · (1 + r_Quote · t) / (1 + r_Base · t); stetige Form für die Optionsmodelle (Unterschied im Beispiel 0.3 Pips).
3. **Forward Points und Carry:** Aufschlag und Abschlag; Darios Merkregel "Forward = Spot + Cost − Benefit" sauber übersetzt: Cost = Zins der Quote-Währung, Benefit = Zins der Base-Währung. "Contango" ist ein Rohstoffbegriff, in FX heisst es Forward-Aufschlag bzw. -Abschlag. Ein Forward ist keine Prognose.
4. **Arbitrage:** Cash-and-Carry-Rechner mit Schritt-für-Schritt-Ablauf.

### 03 · FX Swap
1. **Intuition:** Währung auf Zeit tauschen.
2. **Near und Far Leg:** zwei Geschäfte in Gegenrichtung, gleicher Nominalbetrag; der Preis sind die Swap Points.
3. **Hedge rollen:** Die Zahlung des Importeurs verschiebt sich um einen Monat; der Swap verlängert den Forward. Mit Cashflows.
4. **Abgrenzung:** FX Swap vs. Cross-Currency Swap. Umsatzzahlen nur mit verifizierter Quelle (BIS Triennial Survey, neueste Ausgabe), sonst weglassen.

### 04 · Vanilla Options
1. **Intuition:** ein Recht, keine Pflicht. Ein USD Call ist zugleich ein CHF Put.
2. **Vier Grundpositionen:** Long/Short Call und Put im Payoff-Builder (Darios Skizze, korrekt beschriftet).
3. **Moneyness und Prämie:** relativ zum Forward (ATMF, ITM, OTM), Delta-Quotierung (25Δ, 10Δ), am Desk der delta-neutrale Straddle als ATM-Konvention; Prämie = innerer Wert + Zeitwert; Quotierung in Pips oder % vom Nominal; europäisch vs. amerikanisch.
4. **Pricing und Parität:** Garman-Kohlhagen mit Preistreibern (S, K, T, σ, rd, rf) als Brücke zu Modul 05; Put-Call-Parität, synthetischer Forward (Long Call + Short Put, Delta ≈ 1), Arbitrage bei Verletzung. Wow-Moment als Zusammenfassung.

### 05 · Greeks
1. **Intuition:** Eine Option reagiert auf Kurs, Zeit, Vola und zwei Zinsen.
2. **Delta und Gamma:** Steigung und Krümmung; Gamma als Ableitung von Delta, mit Herleitung in vier Schritten (Prototyp `B-Modul.dc.html`).
3. **Vega:** Herleitung, Beispiel, warum Vega bei ATMF am grössten ist.
4. **Theta und Rho:** Theta-Formel inklusive Carry-Term; Gamma gegen Theta: P&L eines delta-gehedgten Calls ≈ ½ · Γ · [(ΔS)² − σ² · S² · Δt], Break-even bei |ΔS| = σ · S / √365 = 33.5 Pips pro Tag. Klar trennen: Θ_Γ (CHF −69 pro Tag) ist der Gamma-Anteil, das Theta im Labor (CHF −31) enthält zusätzlich den Zins-Carry. Rho domestic und Rho foreign. Am Desk: Vanna und Volga als Ausblick, prämienadjustiertes Delta als Hinweis.

Jeder Greek: Definition als Ableitung, Intuition, Formel, Herleitung (aufklappbar), Zahl im Beispiel, numerischer Check, Bedeutung am Desk.

### 06 · Kombos & Vola-Smile
1. **Intuition:** Optionen kombinieren, um Kosten und Risiko zu formen.
2. **Spreads und Risk Reversal:** Call- und Put-Spread; Risk Reversal als Zero-Cost-Collar des Importeurs.
3. **Straddle, Strangle, Butterfly, Seagull:** im Payoff-Builder, mit Sicht auf die Vola.
4. **Vola-Smile:** implizite Vola je Strike; Markt-Quotes ATM, 25Δ RR, 25Δ BF; Smile-Builder; Vorzeichen-Intuition (Nachfrage nach CHF-Calls als Absicherung). Beispielwerte kennzeichnen.

### 07 · Barrier & Binary
1. **Intuition:** Optionen, die erst beim Berühren entstehen oder dann verschwinden.
2. **Knock-out und Knock-in:** Up/Down, In-Out-Parität, Reverse Knock-out (Barriere im Geld), Rebate, stetige vs. diskrete Beobachtung; Greeks nahe der Barriere.
3. **Digital und Touch:** europäisches Digital, One-Touch, No-Touch, Double No-Touch.
4. **Zweite Generation und Gap-Risiko:** Double Barrier, Window Barrier; der Frankenschock als Fall (Link ins Riskometer).

### 08 · Strukturierte Produkte
1. **Intuition:** ein besserer Kurs als der Forward, finanziert durch verkaufte Optionen; dazu Hebel und Pfadabhängigkeit.
2. **Accumulator und Decumulator:** Strike, Knock-out, doppelte Menge im Verlustfall; Pfad-Simulator.
3. **TARF und Pivot TARF:** Fixings, Target, gehebelte Verluste ohne eingebauten Stopp (TARF sehr hoch, aber endlich; Pivot TARF nach oben theoretisch unbegrenzt); Pivot mit zwei Strikes.
4. **TPF, RTPF und Dual Currency:** Der TPF zahlt einen Coupon, solange das Fixing auf der richtigen Seite des Strikes liegt (direktional), der RTPF, solange es in der Range liegt. Ausserhalb entstehen gehebelte Verluste, potenziell weit über den erhaltenen Coupons. Dual Currency (1 bis 3 Monate): Festgeld plus verkaufte Option, Konversionsrisiko. Definitionen in 8.7.

Jedes Produkt: Bausteine, fairer Strike bzw. Coupon im Vergleich zum Forward (Monte Carlo, mit Standardfehler), "Wann geht es schief" als Szenario, Risiko-Box (Maximalverlust, Hebel, Pfadabhängigkeit).

### 09 · Hedge, Alpha, Yield
Darios Produktkonzept als interaktive Matrix: Man wählt ein Bedürfnis und eine Marktsicht und sieht die passenden Produkte mit Risiko-Chips und Links in die Module.
1. **Intuition:** erst das Bedürfnis, dann das Produkt.
2. **Hedgen:** Spot, Forward, Limit und Stop-Loss, Put/Call, Risk Reversal, strukturierte Hedges.
3. **Alpha:** nach Coupon oder Strike × Direct oder Range: Coupon Direct = TPF, Coupon Range = RTPF, Strike Direct = TARF und Accumulator, Strike Range = Pivot TARF.
4. **Yield und Carry:** Dual Currency (1 bis 3 Monate), Discount-Zertifikat; Carry als Kosten-Nutzen-Abwägung.

### Glossar und Über-Seite
- **Glossar:** rund 60 Begriffe DE/EN, je 1 bis 2 Sätze, Link zum Modul, Suche.
- **Über und Methodik:** Disclaimer, Modelle (Garman-Kohlhagen, Black-76, Monte Carlo), Datenquelle und Methode des Riskometers, Quellenliste, "Konzept und Produktentscheide: Dario Moffa · Gebaut mit Claude Code", Fortschritt zurücksetzen.

**Englisch:** vollständige Übersetzung aller Inhalte, Quizfragen und UI-Strings; Fachbegriffe bleiben gleich.

## 11. Qualität und Definition of Done

- `npm run check` = Typecheck + Lint + Unit-Tests; `npm run build` = Astro-Build und `forward-first.html`; `npm run e2e` = Playwright gegen die gebaute Datei; `npm run e2e:web` = Komponenten-Tests am Astro-Build inklusive axe. Massgebend ist der Exit-Code.
- **i18n-Test:** jeder Schlüssel DE und EN vorhanden, keine hart codierten UI-Strings in Komponenten.
- **Content-Lint:** Liste verbotener Begriffe (Banknamen, "garantiert", "risikolos" ausser im Arbitrage-Kontext). Schlägt fehl, wenn ein Beispiel- oder Referenzwert aus `example.ts` als Literal ausserhalb von `<Num>` steht oder ein `<Fact>` keinen Eintrag in `sources.md` hat.
- **Offline-Datei (E2E):** Playwright öffnet `release/forward-first.html` über `file://` in Chromium (1440 × 900) und WebKit (iPad, 820 × 1180 hoch und 1180 × 820 quer) bei blockiertem Netzwerk. Jede Netzwerk-Anfrage und jeder Konsolenfehler lässt den Test scheitern.
- **E2E-Smoke gegen diese Datei:** Startseite lädt (mit Disclaimer und Datenstand); Wow-Moment spielt und lässt sich steuern; Greeks-Labor reagiert auf Regler (Delta und Gamma ändern sich); Quiz-Ablauf; Riskometer (Paarwechsel, Ereignis-Klick aktualisiert die Fallkarte); Sprachwechsel; kein horizontales Scrollen. Dazu: Hash-Routing inklusive Zurück-Taste, blockierter `localStorage`, Monte Carlo ohne Worker, jede Seite der Datei rendert ohne Fehler.
- **Komponenten-Tests** (`npm run e2e:web`): Playwright am Astro-Build bei 390 px und 1440 px, inklusive axe.
- **Grösse:** Datei unter 3 MB als Ziel, der Build bricht über 5 MB ab. Lighthouse und das JS-Budget pro Seite entfallen (D-13).
- **Visueller Abgleich** mit den Prototypen in Phase 8.

## 12. Repo-Doku (Portfolio-Belege)

- **`README.md`** (Englisch): Was, Screenshots, Stack, Architektur, Datenpipeline, Tests, Highlights aus den Entscheiden, Disclaimer, Credits ("Concept and product decisions: Dario Moffa. Built with Claude Code.").
- **`DECISIONS.md`:** je Eintrag `D-xx · Datum · Herkunft` und dazu Frage, Entscheid, Begründung. Herkunft ist `Dario`, `Claude, von Dario bestätigt` oder `Claude`. In Phase 0 vorbefüllen:
  - D-01 Reines Education-Tool ohne Bankbezug (Dario)
  - D-02 Deutsch mit englischen Fachbegriffen, komplett auf Englisch umschaltbar (Dario)
  - D-03 Tiefe: Intuition und Rechenbeispiele, Formeln aufklappbar; Fokus Moneyness, Forward, Arbitrage, sechs Greeks mit Herleitung (Dario)
  - D-04 Struktur mit neun aufbauenden Modulen (Claude, von Dario bestätigt)
  - D-05 Design-Richtung B "Lernpfad" statt A "Dashboard" (Dario)
  - D-06 Riskometer als Tacho statt Balken (Dario)
  - D-07 Name "Forward First" (Claude, von Dario bestätigt)
  - D-08 Kein Modul-Rad als Navigation, der Übergang Station → Modul bleibt (Claude, von Dario bestätigt)
  - D-09 Extras: durchgehendes Fallbeispiel, G10-Steckbriefe, Frankenschock-Fall, Quiz pro Modul, Riskometer mit echten Daten (Dario)
  - D-10 Stack Astro, TypeScript, Preact; Ausgabe als eine Offline-HTML-Datei (Claude; Ausgabe geändert durch D-13)
  - D-11 Datenquelle EZB-Referenzkurse (Claude)
  - D-12 Riskometer-Methode: 21 Log-Renditen, √252, Perzentile seit 2006, fünf Stufen (Claude, von Dario bestätigt)
- **`CLAUDE.md`:** Regeln. **`PROGRESS.md`:** Stand. **Lizenz:** keine (alle Rechte vorbehalten), bis Dario entscheidet.

## 13. Phasenplan

| Phase | Inhalt | Modell · Effort | Stopp, wenn |
|---|---|---|---|
| 0 | Setup: Repo-Gerüst, Tooling, Tokens, Layout-Shell (Top-Nav, Footer), i18n-Routing, CI-Workflow (check und build), `CLAUDE.md`, `DECISIONS.md` (vorbefüllt), `PROGRESS.md` | Opus 5.5 · mittel | lokale Vorschau läuft, CI grün |
| 1 | Rechenkern ohne Monte Carlo (Abschnitt 7: Forward, Swap, Vanilla, Greeks, Smile, geschlossene Exotics) mit Tests und den Referenzwerten aus Abschnitt 6 | Opus 5.5 · hoch | alle Tests grün, Abdeckung ≥ 90 % |
| 2 | Design-System und Startseite nach `B-Home`, Wow-Moment nach `WowChart`, Modul-Template nach `B-Modul` | Fable 5.1 · hoch | Startseite und leeres Template entsprechen dem Prototyp |
| 3 | Modul 05 komplett als Vertical Slice: Greeks-Labor (alle Modi), Inhalte, Quiz, Fortschritt | Opus 5.5 · hoch | Dario hat Modul 05 durchgespielt |
| 4 | Riskometer: Pipeline, Methode, Ereignisse, Seite, Mini-Tacho | Opus 5.5 · hoch | Daten aktuell, Tests grün, Seite nach Prototyp |
| 5 | Module 01 bis 04 inklusive Session-Uhr, Rechnern, Payoff-Builder | Opus 5.5 · hoch | Inhalte und Quiz fertig, Content-Lint grün |
| 6 | Monte-Carlo-Engine und Produkte aus 8.7, Module 06 bis 09 inklusive Pfad-Simulator und Matrix | Opus 5.5 · hoch | Inhalte und Quiz fertig, Monte-Carlo-Tests grün |
| 7 | Englisch komplett, Glossar, Über und Methodik | Opus 5.5 · mittel | i18n-Test grün |
| 7b | Offline-Datei (D-13): `forward-first.html` mit Hash-Routing, eingebetteten Schriften und Daten, CSP; Tests über `file://` in Chromium und WebKit; manueller Release-Workflow | Opus 5.5 · hoch | Dario hat die Datei auf Arbeits-PC und iPad getestet, inklusive Modul 05 |
| 8 | Politur: Übergänge, Mikro-Interaktionen, Responsive bei 390 px und auf dem iPad (hoch und quer), visueller Abgleich | Fable 5.1 · hoch | Abgleich ohne offene Abweichungen |
| 9 | Verifikation und Release: vollständige Tests, E2E gegen die Datei in Chromium und WebKit, Fakten-Check gegen `sources.md` durch einen frischen Subagenten, der den Code nicht geschrieben hat; README; GitHub Release von `forward-first.html` | Opus 5.5 · hoch | Release veröffentlicht, Abschlussbericht |

## 14. Erste Aktion

Bestätige in höchstens fünf Sätzen, wie du das Projekt verstanden hast. Stelle höchstens fünf Fragen, die vor Phase 0 geklärt sein müssen. Warte auf Antwort, dann starte Phase 0.
