# TradeStation Ersatzteil-Bestellung

Moderne statische Bestell-Website für GitHub Pages. Die App lädt die Preisliste dynamisch aus einer veröffentlichten Google-Sheets-CSV und nutzt `data/preisliste.csv` als lokalen Fallback.

## Funktionen

- Live-Suche nach Modell, Qualität, Artikeltyp, Bestand und Hinweis
- Filter nach Kategorie, Modell, Artikeltyp und Qualität
- Warenkorb-ähnliche Auswahl mit Mengen
- WhatsApp-Bestellung mit Einzelpreisen, Positionssummen und Gesamtsumme
- Standortlogik für Offenbach und Kassel
- PDF-Bestellzusammenfassung im Browser
- Dark-/Light-Mode mit Speicherung
- Angebotsbanner über Google-Sheets-Konfigurationszeile
- Rechtliche Seiten: Impressum, Datenschutz, AGB

## Projektstruktur

```text
.
├── index.html
├── impressum.html
├── datenschutz.html
├── agb.html
├── assets/
│   ├── css/styles.css
│   └── js/
│       ├── app.js
│       └── config.js
└── data/preisliste.csv
```

## Google-Sheets-Anbindung

Die Datenquelle steht in `assets/js/config.js`:

```js
sheetCsvUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vS2R3O4d67rRnfVkau6dRZlFxdjttwUsLDbNBVgaCU5dHWaNdQhYLcW1i1qw5xhCQ/pub?gid=1018114951&single=true&output=csv"
```

Die Website erwartet diese Spalten:

- `Kategorie`
- `Marke`
- `Modell`
- `Artikelgruppe`
- `QualitaetVariante`
- `Preis`
- `BestandStatus`
- `Angebotsartikel`
- `Hinweis`
- `Aktiv`
- `Sortierung`

Die erste Konfigurationszeile kann zusätzlich Banner, WhatsApp-Nummern und Maps-Links enthalten:

- `AngebotsbannerAktiv`
- `AngebotsbannerText`
- `AngebotsbannerButton`
- `AngebotsbannerZiel`
- `WhatsAppOffenbach`
- `WhatsAppKassel`
- `StandortOffenbachGoogleMaps`
- `StandortKasselGoogleMaps`

## Banner ändern

In Google Sheets:

1. `AngebotsbannerAktiv` auf `Ja` setzen.
2. `AngebotsbannerText` befüllen.
3. Optional `AngebotsbannerButton` und `AngebotsbannerZiel` befüllen.

Wenn `AngebotsbannerZiel` ein Text ist, wird er als Suche übernommen. Wenn es eine URL ist, wird sie geöffnet.

## Produktlogik

Die App blendet zusätzlich zur Tabellenpflege ungültige Kombinationen aus:

- OLED-Displays nicht für iPhone 8, iPhone 8 Plus, iPhone XR und iPhone 11
- Diagnostic Akkus nur ab iPhone 12

## GitHub Pages Deployment

1. Neues GitHub-Repository erstellen.
2. Alle Dateien aus diesem Ordner in das Repository hochladen.
3. In GitHub auf `Settings` → `Pages` gehen.
4. Bei `Build and deployment` die Quelle `Deploy from a branch` wählen.
5. Branch `main` und Ordner `/root` auswählen.
6. Speichern und die angezeigte GitHub-Pages-URL öffnen.

## Lokale Vorschau

Direktes Öffnen der `index.html` kann den CSV-Import blockieren. Für eine lokale Vorschau:

```powershell
powershell -ExecutionPolicy Bypass -File tools/dev-server.ps1 -Port 4173
```

Danach `http://127.0.0.1:4173/` öffnen.

## Rechtliches

`impressum.html`, `datenschutz.html` und `agb.html` enthalten technische Platzhalter. Vor Veröffentlichung bitte echte Unternehmensdaten und rechtlich geprüfte Texte einsetzen.
