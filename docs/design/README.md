# Design-Referenz: Forward First (Richtung B "Lernpfad")

Diese Dateien sind die freigegebenen Prototypen aus dem Design-Canvas (Oktober 2026).
Sie sind die verbindliche visuelle Referenz. Baue sie im echten Stack nach; kopiere
nicht das Prototyp-Format.

| Datei | Was sie zeigt | Wird zu |
|---|---|---|
| `B-Home.dc.html` | Startseite: Top-Nav, Hero, Wow-Karte, Lernpfad mit 9 Stationen, "Weiter, wo du warst", Riskometer-Tacho, Footer | `src/pages/index.astro` + Komponenten |
| `B-Modul.dc.html` | Modul-Abschnitt (05 Greeks, Abschnitt 2): Kopfband mit Abschnitts-Stepper, Lesespalte, Figure in voller Breite, Herleitung mit Formelboxen, "Am Desk", Quiz, Zurück/Weiter | Modul-Template |
| `WowChart.dc.html` | Wow-Moment: Forward → Call → Zeitwert → Parität, Autoplay, Morph, Laufzeit-Regler | `WowChart` (Preact) |
| `GreeksLab.dc.html` | Greeks-Labor: Preis- und Delta-Kurve mit Tangenten, Regler, 6 Greeks, numerischer Check | `GreeksLab` (Preact) |
| `Riskometer.dc.html` | Riskometer-Seite: Tacho mit Nadel, 20-Jahre-Chart mit Hover, anklickbare Ereignisse, Fallkarte | Riskometer-Seite + Komponenten |
| `tokens.css` | Alle Farben, Schriften, Radien, Schatten, Masse | `src/styles/tokens.css` |

## So liest du die `.dc.html`-Dateien

Es ist das Format des Design-Canvas, kein Framework:

- Markup in `<x-dc>`: Die **Inline-Styles sind die exakten Werte** (Abstände, Grössen, Farben, Radien). Übernimm sie in CSS-Klassen mit den Tokens.
- `{{ name }}` ist ein Platzhalter, gefüllt von `renderVals()` in der Klasse `Component` im `<script type="text/x-dc">` am Dateiende.
- `<sc-for list="{{ items }}" as="item">` ist eine Schleife, `<sc-if value="{{ flag }}">` eine Bedingung.
- `<dc-import name="WowChart">` bindet eine andere Datei als Kindkomponente ein (Startseite und Modulseite nutzen `WowChart` und `GreeksLab`).
- `onClick="{{ handler }}"` und `onChange="{{ handler }}"` sind React-artige Events.
- `support.js` und `<helmet>` gehören zum Canvas; ignorieren.

## Was du übernehmen darfst

- **Rechenlogik:** Die Methoden in `WowChart` (Black-76 auf den Forward, Morph, Easing) und `GreeksLab` (Garman-Kohlhagen, Greeks, Tangenten-Clipping, Schweizer Zahlenformat) sind gegen `docs/reference/gk_reference.py` geprüft. Portiere sie nach `src/lib/fx` und decke sie mit Tests ab.
- **Animationen und Interaktion:** Ablauf, Timings und Texte des Wow-Moments, Regler-Bereiche des Greeks-Labors, Nadel-Animation und Hover des Riskometers.
- **Texte:** Alle sichtbaren deutschen Texte sind abgenommen. Zahlen darin werden im Build aus Rechenkern oder Daten eingesetzt.

## Was im Prototyp nur Platzhalter ist

- Fortschritt (49 %, "In Arbeit · 40 %", erledigte Module): kommt im Build aus `localStorage`.
- Riskometer-Daten: Der Prototyp nutzt Fed-H.10-Mittagskurse (via datahub.io). Der Build nutzt **EZB-Referenzkurse** und rechnet alle Werte selbst (Stand, Perzentil, Stufe, Ereignis-Kennzahlen). Die Zahlen werden sich daher leicht unterscheiden; das ist korrekt.
- Paar-Auswahl im Riskometer: im Prototyp deaktiviert, im Build aktiv (EUR/CHF, USD/CHF, EUR/USD, USD/JPY).
- Glossar, Über-Seite und die Module ausser 05 sind nicht gestaltet: Nutze dieselben Bausteine.

## Optional

Dario kann die Artboards im Canvas als PNG exportieren und unter `docs/design/screens/` ablegen. Sind PNGs vorhanden, nutze sie für den visuellen Abgleich in Phase 8.
