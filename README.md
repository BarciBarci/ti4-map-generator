# TI4 Balanced Map Generator

Eine kleine, rein clientseitige Web-App, die **ausgeglichene Twilight-Imperium-4-Karten für 3–6 Spieler** erzeugt
und den passenden **Map-String** sowie eine gerenderte Übersicht ausgibt.

Basiert auf den Layouts und Tile-Daten des [TI4 Map Lab](https://github.com/joepinion/ti4-map-lab) (CC BY-SA 4.0).

## Features

- Spielerzahlen **3–6**, jeweils mit mehreren Layouts (Standard / Skinny / Settlers / Warp / Large Galaxy).
- Tile-Vorrat wählbar: **Grundspiel / Prophecy of Kings / Thunder's Edge**.
- **Evaluator-Umschalter** (Simple Slice, Joebrew, Resource/Influence/Tech Access) – die Karte wird nach dem gewählten
  Maßstab bewertet und kann mit **„Balance verbessern“** nachoptimiert werden.
- Ziel-**Blau-Anteil** einstellbar (Standard 60 % ≈ Community-Verhältnis 3:2).
- **Wormholes als Paare** (gleich viele α und β).
- Optimierung per Zufalls-Restarts + lokaler Suche bis **Balance Gap 0** (jeder Spieler sieht dieselbe Wertsumme);
  Legalität wird erzwungen (keine zwei Anomalien benachbart, keine zwei gleichen Wormholes benachbart).
- Ausgabe: gerenderte Karte (als **PNG** oder SVG downloadbar), **Map-String** (kompatibel mit Map Lab / TTS / keeganw),
  Statistik (Blue/Red, Resources/Influence, Tech, Traits R/G/B, Wormholes) und die Home-Werte.

## Lokal starten

Da alles statisch ist, reicht ein einfacher Webserver (nötig, weil `data.js` per `<script>` geladen wird – das geht
auch per Doppelklick, aber ein Server ist sauberer):

```bash
python3 -m http.server 8000
# dann http://localhost:8000/ öffnen
```

## Auf GitHub Pages veröffentlichen

1. Auf GitHub ein neues, leeres Repository anlegen (z. B. `ti4-map-generator`).
2. In diesem Ordner:

```bash
git init
git add .
git commit -m "TI4 balanced map generator"
git branch -M main
git remote add origin https://github.com/<DEIN-NAME>/ti4-map-generator.git
git push -u origin main
```

3. Im Repo: **Settings → Pages → Source: Deploy from a branch → Branch: `main` / `/ (root)`** → Save.
4. Nach ca. 1 Minute erreichbar unter `https://<DEIN-NAME>.github.io/ti4-map-generator/`.
   (Bei einem Repo namens `<DEIN-NAME>.github.io` stattdessen direkt unter der Wurzel.)

## Wie die Optimierung funktioniert

- **Wert pro System**: Summe über Planeten von `max(Ressourcen, Influence) + 1 pro Tech-Spezialisierung`,
  plus Bonus für Legendary-Planeten und Space Stations.
- **Home-Wert**: für jedes Heimatsystem die Summe `Systemwert × Distanzgewicht` über alle Systeme in Reichweite
  (Gewichte 3/2/1 für Distanz 1/2/3).
- **Balance Gap** = größter − kleinster Home-Wert. Ziel: **0**.
- Die App füllt zufällig (legal), verbessert dann per Tausch-Verfahren und wiederholt das mit vielen Restarts in einem
  Zeitfenster; behalten wird die beste Karte.

## Daten aktualisieren

`data.js` wird aus dem Map-Lab-Repo erzeugt:

```bash
python3 build_data.py
```

## Test

```bash
node test.js   # prüft alle Layouts auf Gap 0, legale Platzierung, Wormhole-Paare und Rendering
```

## Credits & Lizenz

> **Nicht-kommerzielles Fan-Projekt.** Twilight Imperium ist ein Markenzeichen von Fantasy Flight Games / Asmodee;
dieses Projekt steht in keiner Verbindung dazu.

- **Layouts, Tile-Daten und die Evaluator-Vorlagen stammen aus dem
  [TI4 Map Lab](https://github.com/joepinion/ti4-map-lab) von Joseph Arthur Ellis** und werden von `build_data.py`
  automatisch von dort geladen. Diese Daten stehen unter **CC BY-SA 4.0** – die Namensnennung ist deshalb Pflicht und
  im UI-Footer sowie hier angegeben.
- Eigener Code (Generator, Optimierer, Rendering, UI): frei verwendbar (z. B. MIT).
- Beim Weiterverbreiten die **CC-BY-SA-Auflagen** der Kartendaten beachten (Namensnennung + Share-Alike).
