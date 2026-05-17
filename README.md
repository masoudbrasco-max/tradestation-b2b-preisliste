# tradestation b2b

Mobile-first Bestellseite fuer Handy-Ersatzteile. Die Seite ist statisch aufgebaut und eignet sich direkt fuer GitHub Pages.

## Struktur

```text
.
├── index.html
├── impressum.html
├── datenschutz.html
├── agb.html
├── assets/
│   ├── css/styles.css
│   ├── js/app.js
│   └── img/favicon.svg
├── data/preisliste.csv
└── tools/dev-server.ps1
```

## CSV-Daten

Die Website laedt zuerst live diese Google-Sheets-CSV:

```text
https://docs.google.com/spreadsheets/d/e/2PACX-1vS2R3O4d67rRnfVkau6dRZlFxdjttwUsLDbNBVgaCU5dHWaNdQhYLcW1i1qw5xhCQ/pub?gid=1018114951&single=true&output=csv
```

Erkannte Spalten:

- Produktdaten: `Kategorie`, `Marke`, `Modell`, `Artikelgruppe`, `QualitaetVariante`, `Preis`, `BestandStatus`, `Angebotsartikel`, `Hinweis`, `Aktiv`, `Sortierung`
- Banner: `AngebotsbannerAktiv`, `AngebotsbannerText`, `AngebotsbannerButton`, `AngebotsbannerZiel`, `AngebotsbannerStart`, `AngebotsbannerEnde`
- Standorte: `WhatsAppOffenbach`, `WhatsAppKassel`, `WhatsAppGoettingen`, `StandortOffenbachGoogleMaps`, `StandortKasselGoogleMaps`, `StandortGoettingenGoogleMaps`

Die erste Datenzeile dient als Konfiguration fuer Banner, WhatsApp-Nummern und Kartenlinks. Alle aktiven Artikel mit `Aktiv = Ja` werden automatisch angezeigt.

`data/preisliste.csv` ist nur ein lokaler Fallback, falls Google Sheets kurz nicht erreichbar ist. Neue Artikel erscheinen automatisch, sobald sie im Google Sheet aktiv gesetzt sind.

## Banner aendern

Im Google Sheet:

- `AngebotsbannerAktiv` auf `Ja` setzen
- `AngebotsbannerText` eintragen
- optional `AngebotsbannerButton` und `AngebotsbannerZiel` setzen

Wenn `AngebotsbannerZiel` z. B. `iPhone 17 Pro` ist, filtert ein Tap auf den Banner direkt danach.

## WhatsApp-Nummern

Die Nummern werden aus der CSV gelesen:

- Offenbach: `WhatsAppOffenbach`
- Kassel: `WhatsAppKassel`
- Goettingen: `WhatsAppGoettingen`

Ist fuer Goettingen noch keine Nummer hinterlegt, bleibt der Standort sichtbar, WhatsApp-Senden wird fuer diesen Standort aber sauber blockiert.

## Lokal testen

Ein einfacher lokaler Server reicht, zum Beispiel:

```powershell
.\tools\dev-server.ps1 -Port 4173 -Root .
```

Dann im Browser oeffnen:

```text
http://127.0.0.1:4173/
```

## GitHub Pages veroeffentlichen

1. Neues GitHub-Repository anlegen.
2. Alle Dateien aus diesem Ordner in das Repository hochladen.
3. In GitHub zu `Settings` -> `Pages` gehen.
4. Unter `Build and deployment` die Quelle `Deploy from a branch` waehlen.
5. Branch `main` und Ordner `/root` auswaehlen.
6. Speichern. Nach kurzer Zeit zeigt GitHub die Pages-URL an.

## Rechtliches

Impressum, Datenschutz und B2B-Bestellhinweise sind vorbereitet. Vor Livegang bitte mindestens E-Mail-Adresse, korrekte steuerliche Bezeichnung und finalen Rechtstext pruefen.
