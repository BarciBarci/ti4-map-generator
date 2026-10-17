# TI4 Balanced Map Generator

Eine kleine, rein clientseitige Web-App, die **ausgeglichene Twilight-Imperium-4-Karten für 3–6 Spieler** erzeugt
und den passenden **Map-String** sowie eine gerenderte Übersicht ausgibt.

**Live:** https://barcibarci.github.io/ti4-map-generator/

Basiert auf den Layouts und Tile-Daten des [TI4 Map Lab](https://github.com/joepinion/ti4-map-lab) (CC BY-SA 4.0).

![Beispielkarte](screenshot.png)

## Features

- Spielerzahlen **3–6**, jeweils mit mehreren Layouts (Standard / Skinny / Settlers / Warp / Large Galaxy).
- Tile-Vorrat wählbar: **Grundspiel / Prophecy of Kings / Thunder's Edge**.
- **Vollautomatische Optimierung über alle fünf Bewertungen** (Simple Slice, Joebrew, **Resource Access**,
  **Influence Access**, **Tech Access**) – nicht nur ein einzelner Wert. So werden Einseitigkeiten vermieden
  (z. B. „Ressourcen fair, aber Influence schief“).
- **Automatisches Neugenerieren:** Es laufen mehrere Runden; pro Runde wird der Tile-Vorrat frisch gezogen und die
  Karte komplett optimiert. Ist nach einer Runde noch etwas einseitig, wird neu generiert. Abgebrochen wird, sobald
  keine Bewertung mehr über der Zielschwelle liegt.
- **Evaluator-Umschalter** (Anzeige/Details) und Button **„Balance verbessern“** zum Nachoptimieren einer Karte.
- Ziel-**Blau-Anteil** einstellbar (Standard 60 % ≈ Community-Verhältnis 3:2).
- **Wormholes je Typ 0 oder mindestens 2:** Ein einzelnes Wormhole ist funktionslos (es hat keinen Partner), deshalb
  sind pro Typ entweder 0 oder ≥ 2 Tiles auf der Karte (mehr ist erlaubt). Ist die Option aktiv (oder Creuss dabei),
  wird von **jedem** im Tile-Vorrat vorhandenen Typ mindestens ein Paar erzwungen. Da der Optimierer nur gleichfarbige
  Tiles mit gleichem Wormhole-Typ tauscht, bleibt die Paarung garantiert erhalten.
- Legalität wird erzwungen: keine zwei Anomalien benachbart, keine zwei gleichen Wormholes benachbart.
- **Faktionen berücksichtigen (optional):** sichert je gewählter Fraktion das vorteilhafte Kartenmerkmal
  (Muaat→Supernova, Saar→Asteroidenfeld, Empyrean→Nebel, Vuil'raith→Gravitationsriss, Creuss→α/β-Wormhole)
  **in Reichweite** des jeweiligen Heimatsystems; optional **möglichst auch für die Nachbarn erreichbar**
  (umkämpfte Randzone). Eine Fraktion ist nur einmal wählbar – siehe Abschnitt unten.
- **Design-Umschalter:** Classic (dunkel), **Retro 8-Bit** (kräftige Farben, dicke Outlines, Scanlines,
  Monospace) und **Biomech/Giger** (entsättigt, Knochen-/Asche-Töne mit Säuregrün). Vorschauen in `previews/`.
- Ausgabe: gerenderte Karte (**PNG**- oder SVG-Download), **Map-String** (kompatibel mit TI4 Map Lab / TTS / keeganw),
  Statistik (Blue/Red, Resources/Influence, Tech, Traits R/G/B, Wormholes) und die Home-Werte.

## Was in der Anzeige bedeutet

| Anzeige | Bedeutung |
| --- | --- |
| `Blue/Red` | Anzahl blauer (besiedelbarer) vs. roter Systeme (leer/Anomalie) im gewählten Set. |
| `Res/Inf` | Summe **Ressourcen** und **Influence** aller Planeten auf der Karte. |
| `Tech` | Vorkommende Tech-Spezialisierungen als Buchstaben: **R**=Warfare, **B**=Propulsion, **G**=Biotic, **Y**=Cybernetic. |
| `Traits R/G/B` | Anzahl roter / grüner / blauer Planeten (Hazardous / Industrial / Cultural). |
| `Wormholes` | Anzahl je Typ (α/β/δ). Gültig ist **0 oder ≥ 2** pro Typ (ein Einzelnes wäre nutzlos; mehr als 2 sind erlaubt). |
| `Gap <Evaluator>` | **Gap** = größter minus kleinster Home-Wert unter allen Spielern (in Einheiten des Evaluators); `Leer` = Systeme ohne Planeten im Slice. |
| `Max Gap` | größter **relativer** Gap über alle Evaluatoren in % (siehe unten). |
| `Einseitig` | Evaluatoren, deren relativer Gap über der Zielschwelle (2 %) liegt – „hier ist es noch schief“. |
| `<Fraktion>: <Merkmal>` | Erreichte Reichweite des fraktionsspezifischen Merkmals: `+Nachbar` / `+2 Nachbarn` / `nur eigenes` / `fehlt`. |
| `Wormhole ≤1/Slice` | Ob höchstens ein Wormhole im Slice jedes Spielers liegt (best effort). |
| `Wormhole am Home` | `keins` / `ja` – ob ein Wormhole direkt an einem Heimatsystem liegt. |

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

- **Wert pro System**: Summe über die Planeten von `Ressourcen-/Influence-Anteil + Tech-Bonus` gemäß Evaluator,
  plus Boni für Legendary-Planeten etc. (Parameter wie im Map Lab).
- **Home-Wert**: für jedes Heimatsystem die Summe `Systemwert × Distanzgewicht` über alle Systeme in Reichweite.
  Mecatol Rex zählt mit.
- **Gap** = größter − kleinster Home-Wert. Damit die Evaluatoren (mit sehr unterschiedlichen Einheiten) vergleichbar
  sind, wird ein **relativer Gap** = `Gap / größter Betrag` verwendet. Eine **Totzone von 1 Einheit** sorgt dafür,
  dass ein Unterschied von 1 (z. B. ein einzelner Tech-Punkt) nicht übergewichtet wird.
- **Zielfunktion**: minimiert wird `Summe(relative Gaps) + 8 × größter relativer Gap` – der schlechteste Evaluator
  zählt also am stärksten (Mini-Max).
- **Ablauf** beim Klick auf „Karte generieren“ (alles automatisch, kein Zutun nötig):
  1. Tile-Vorrat wählen (Blau/Rot-Ziel, Wormholes je Typ ≥ 2).
  2. Pro Runde: neue Zufallskarte → Warmup auf Simple Slice/Joebrew → Optimierung über **alle fünf** Evaluatoren
     → Bank-Tausche; zwischendurch „Kicks“ (Iterated Local Search). Bei Stillstand wird die Zufallskarte intern neu
     gewürfelt.
  3. Reicht das Ergebnis (noch) nicht, startet eine **neue Runde mit frischem Tile-Vorrat**.
  4. Behalten wird die Karte mit dem kleinsten kombinierten Gap; Gesamt-Zeitbudget je Wahl ≈ 4–10 s. Abgebrochen wird
     früh, sobald der größte relative Gap ≤ 2 % ist.
- Typische Ergebnisse: **3–4 Spieler** meist ≤ 2 %, **5–6 Spieler** meist ≤ 3–5 % (der erreichte Wert wird immer
  angezeigt – die App beschönigt nichts).
- **„Balance verbessern“** optimiert die bestehende Karte weiter (Swaps + Bank-Tausche über alle fünf Evaluatoren).

## Faktionen berücksichtigen

Option **„Faktionen berücksichtigen“**: pro Spieler eine Fraktion wählen (eine Fraktion ist nur **einmal**
wählbar – bereits vergebene Optionen werden in den übrigen Dropdowns deaktiviert). Der Generator sichert
dann das **fraktionsspezifische, vorteilhafte Kartenmerkmal** und legt es **in Reichweite (≤ 2 Felder)** des
jeweiligen Heimatsystems ab – fehlt es, wird die Fraktion benachteiligt.

Option **„Merkmal möglichst auch für Nachbarn erreichbar“** (umkämpfte Randzone): das Merkmal wird so platziert,
dass es möglichst auch die **Nachbarn** erreichen können – gestuft:

| Stufe | Bedeutung |
| --- | --- |
| `both` | in Reichweite von eigenem Home **und beiden** Nachbarn |
| `near` | in Reichweite von eigenem Home **und mind. einem** Nachbarn |
| `own` | nur eigenes Home (Fallback) |

Gewählt wird die **beste erfüllbare** Stufe; sie wird unter der Karte am Heimatsystem bzw. in der Datenzeile
angezeigt. Ist der Schalter **„für Nachbarn erreichbar“** aktiv, wird **kein** stiller Rückfall auf „nur eigenes"
gemacht: lässt sich für ein Merkmal keine gemeinsame Randzone finden, wird ein neuer Versuch gewürfelt; gibt es
im Layout gar keine gemeinsame Randzone (z. B. *3-Player Standard/Warp*), meldet die App das ausdrücklich. **Wichtiger Befund**
(`tools/probe_reach.js`): Stufe `both` ist in **keinem** der eingebauten Layouts erfüllbar (Schnittmenge der
drei Slices = 0), Stufe `near` dagegen in allen außer *3-Player Standard* und *3-Player Warp*. Der Schalter
bewirkt also real, dass das Merkmal in die **umkämpfte Randzone** zwischen dem eigenen und einem Nachbar-Slice
gelegt wird statt tief ins eigene Gebiet.

| Fraktion | benötigtes Merkmal |
| --- | --- |
| The Embers of Muaat | Supernova |
| The Clan of Saar | Asteroidenfeld |
| The Empyrean | Nebel |
| The Vuil'raith Cabal | Gravitationsriss |
| The Ghosts of Creuss | α/β-Wormhole |

### Was dabei berücksichtigt wird (Algorithmus)

1. **Vorrat:** `chooseTiles` erzwingt, dass genügend Merkmals-Tiles in der Auswahl sind (`ensureFeatures`).
   Es wird ein **farbgleiches** Tile ersetzt, damit das Blue/Red-Verhältnis erhalten bleibt.
2. **Konstruktion:** `randomFill` platziert die Merkmals-Tiles **zuerst** auf einem Feld **≤ 2 Zügen** vom
   Heimatsystem (`reachPositions`; andere Heimatsysteme und Mecatol werden nicht durchquert – entspricht
   KeeganWs `SLICE_DISTANCE = 2`). Mit aktivem Schalter wird dabei die beste erfüllbare Stufe
   `both` → `near` gewählt (**kein** Rückfall auf `own`). Gelingt die Platzierung nicht, wird der Versuch
   verworfen und neu gewürfelt.
3. **Fixierung:** die so platzierten Tiles werden **gepinnt**. `swapLegal` (Tausch-Suche) und `bankClimb`
   (Bank-Tausch) lassen sie unangetastet – die Balance-Optimierung kann sie also nicht mehr aus der
   Reichweite schieben, während alle übrigen Tiles normal optimiert werden.
4. **Wormholes:** wird Creuss gewählt, wird die Paar-Garantie (je Typ ≥ 2) auch dann erzwungen, wenn die Option
   „Wormholes paarweise“ ausgeschaltet ist.
5. **Anzeige/Prüfung:** `featureReport` prüft nach der Optimierung je Fraktion die erreichte Stufe
   (`both`/`near`/`own`) bzw. „fehlt“ (Kennzeichnung grün/rot unter der Karte, Fraktionskürzel am
   Heimatsystem). `test.js` verifiziert das für 4/5/6 Spieler – auch im Nachbar-Modus.

**Bewusste Grenzen:** Es wird *ein* Garantie-Tile je Bedarf fixiert (keine ganzen Slices); die weiche
Balance läuft weiter über die fünf Evaluatoren. Discordant-Stars-Fraktionen (z. B. Nivyn Star Kings,
benötigt ebenfalls einen Gravitationsriss) sind nicht enthalten, weil unsere Tile-Daten keine DS-Tiles kennen.

### Quelle

Die Zuordnung stammt aus **KeeganW/ti4**, Option *„Ensure Faction Anomalies“* (`src/options/MapOptions.js`),
sowie die Slice-Balance aus `src/helpers/Slices.js` (Gewichte: resources 1 / influence 1 / planets 0.25 /
anomalies 1, Slice = 2 Hops):

- https://github.com/KeeganW/ti4
- https://github.com/KeeganW/ti4/blob/master/src/options/MapOptions.js
- https://github.com/KeeganW/ti4/blob/master/src/helpers/Slices.js

Das ist **kein offizielles FFG/Asmodee-Dokument**, sondern ein Community-Standard. Creuss ist in KeeganWs
Liste nicht enthalten; der Wormhole-Bedarf folgt direkt aus seiner Fähigkeit („behandelt alle Systeme mit
alpha-/beta-Wormhole als benachbart“). Weitere geprüfte Quellen zum Umfeld: `acodcha/ti4-cartographer`
(Layout-Eigenschaften + empfohlene Aggression/VP) und `daveah/ti4_planet_selection` (Ressourcen-/Influence-,
max. 1 Wormhole pro Spieler).

## Legende (Symbole auf der Karte)

Unterhalb der Karte steht auf der Webseite eine Legende; dieselbe Erklärung findet sich im Screenshot:

| Symbol | Bedeutung |
| --- | --- |
| `R` `B` `G` `Y` (Kreis am Planeten) | Tech-Spezialisierung: Warfare / Propulsion / Biotic / Cybernetic |
| `3/1` unter dem Planeten | Ressourcen / Influence des Planeten |
| Punktfarbe des Planeten | rot = Hazardous, grün = Industrial, blau = Cultural |
| `SN` `GR` `NEB` `AST` `ES` | Anomalien: Supernova, Gravitationsriss, Nebel, Asteroidenfeld, Entropic Scar |
| `α` / `β` | Alpha- / Beta-Wormhole (je Typ 0 oder ≥ 2 auf der Karte) |
| `★` / `⌂` | legendärer Planet / Raumstation |
| kleine Zahl oben | System-Tile-Nummer |
| `HOME` + Wert | Heimatsystem und sein Home-Wert |
| `MECATOL 1/6` | Mecatol Rex (1 Ressource / 6 Influence) |
| `◇` | Warprand (leeres Feld, nur Verbindung) |
| blaue / rote Fläche | besiedelbares System / leeres System bzw. Anomalie |

## Balancing-Dimensionen (mit Quellen)

Die App optimiert über **sechs** Dimensionen. Fünf sind die Evaluatoren aus dem Map Lab
(Simple Slice, Joebrew, Resource-/Influence-/Tech-Access); die sechste haben wir ergänzt:

| Dimension | Was gemessen wird | Quelle |
| --- | --- | --- |
| **Leere Felder** | Anzahl Systeme **ohne Planeten** (Anomalie/Wormhole/leer) im eigenen Slice (≤ 2 Züge) pro Spieler | `daveah/ti4_planet_selection`: „each player has a similar total number of **non-planet tiles**" · `KeeganW/ti4` (`src/helpers/Slices.js`): `IMBALANCE_WEIGHTS = { resources: 1, influence: 1, planets: 0.25, **anomalies: 1** }` mit `if (system.type === "red") value.anomalies += 1` |

Zusätzlich gelten zwei **Wormhole-Regeln** (immer aktiv):

| Regel | Quelle |
| --- | --- |
| **Höchstens 1 Wormhole pro Spieler-Slice** | `daveah/ti4_planet_selection`: „and **each player has at most one wormhole**" |
| **Kein Wormhole direkt am Heimsystem** | Community-Praxis; u. a. `acodcha/ti4-cartographer` behandelt Wormholes in der Kategorie `SystemCategory::AnomalyWormholeEmpty` und bilanziert sie pro Spieler (`source/Anomaly.hpp`, `source/SystemCategory.hpp`). Hinweis: acodchas Anomalie-Scores sind Erfahrungswerte, keine Regel. |

Umsetzung (technisch): „Leere Felder" ist als **sechste, lineare Dimension** in die Zielfunktion eingebaut
(gleiche Gewichtung wie die übrigen Dimensionen, Totzone 1 Feld); angezeigt als Pille `Gap Leer`, der Spread
steht zusätzlich im Test (`leer=[…]`).

Die beiden Wormhole-Regeln:

- **Kein Wormhole am Heimsystem** ist ein **hartes** Constraint in `sysConflicts` und wird damit beim Start
  und bei jedem Tausch (`swapLegal`, `bankClimb`) geprüft.
- **Höchstens 1 Wormhole pro Slice** ist **best effort**: `randomFill` setzt die Wormholes bewusst (Greedy mit
  Limit-Check) und markiert die Startbelegung als „streng"; ist sie sauber, halten alle Züge die Regel ein.
  Geometrisch ist sie nicht überall erfüllbar (enge Layouts: z. B. *3-Player Settlers* hat 15 Felder, davon 9
  home-adjazent, bei 4 Wormholes) — dann wird sie nicht erzwungen und die Pille zeigt das Ergebnis ehrlich.
  Messung: `node test.js` → „Wormhole ≤1/Slice erfüllt: 6/11 Layouts".

Die Anzeige unter der Karte prüft alle drei Regeln über die Pillen `Leer` (Dimension), `Wormhole ≤1/Slice` und
`Wormhole am Home`.

> Diese Quellen sind Community-/Implementierungs-Konventionen, **keine** offiziellen FFG/Asmodee-Regeln.
> BoardGameGeek, Reddit und die Suchmaschinen sind aus dieser Umgebung bot-geblockt; geprüfte Quellen sind
> die oben verlinkten GitHub-Repos.

## Designs

Über das Dropdown **„Design“** lässt sich die Optik umschalten (gilt für Karte + Seite). Die Wahl wird im
`localStorage` gespeichert und beim nächsten Aufruf wiederhergestellt.

| Design | Stil |
| --- | --- |
| `Classic (dunkel)` | bisheriges, dezentes Dunkelblau/Dunkelgrün/Dunkelbraun |
| `Retro 8-Bit` | kräftige Primärfarben, dicke schwarze Outlines, Scanline-Overlay, Monospace-Schrift |
| `Biomech (Giger)` | entsättigte Knochen-/Asche-/Rost-Töne, dünne Linien, Säuregrün als Akzent |
| `Realistisch` | eigener Sternenhimmel, Farbverläufe auf den Hexen, **schattierte Planetenkugeln** mit Glanzpunkt (prozedural gezeichnet) |

Vorschauen (vom App-Renderer selbst erzeugt):

```bash
node tools/preview_themes.js     # schreibt previews/theme-<name>.svg
```

> **Warum kein „echtes" Tile-Artwork?** Der realistische Look von `keeganw.github.io/ti4` stammt aus
> **eingescannten FFG-Kacheln** (`public/tiles/ST_<id>.webp`) und einem Galaxie-Hintergrundbild. Diese stehen
> unter Urheberrecht und werden hier **nicht** eingebettet (Hotlinks würden zudem den PNG-Export per
> Canvas-Tainting zerstören). Das Design `Realistisch` ist deshalb vollständig **eigene, prozedurale Grafik**
> (SVG-Verläufe, Sternenfeld, Planeten mit Licht/Schatten). Wer eigenes/lizenziertes Artwork hat, kann es über
> einen optionalen PNG-Sprite-Layer einsetzen (auf Anfrage).

## Daten aktualisieren

`data.js` wird aus dem Map-Lab-Repo erzeugt:

```bash
python3 build_data.py
```

## Test & Benchmark

```bash
# Vollständige Prüfung: Gaps, legale Platzierung, Wormhole-Paare (je Typ ≥2), keine Tile-Dubletten + Faktions-Garantien
node test.js 4000        # optional: Zeitbudget in ms pro Karte

# Benchmark der App-Pipeline (generateRounds) über alle Layouts
node tools/measure.js

# Analyse: Streuung über verschiedene Tile-Auswahlen (erreichbarer "Boden" je Layout)
node tools/probe_seeds.js "6-Player" 10 0.60

# Analyse: k-opt-Test – findet LNS (exakte Permutation von k Positionen) noch eine Verbesserung?
node tools/probe_lns.js 7

# Analyse: welche Merkmals-Reichweite ist je Layout überhaupt möglich (own / +Nachbar / +2 Nachbarn)?
node tools/probe_reach.js
```

## Screenshot / Beispielkarte neu erzeugen

```bash
node tools/export_map.js        # schreibt tools/map.json (Beispielkarte, inkl. Faktionskürzeln)
python3 tools/make_screenshot.py # rendert screenshot.png (1200x630, Pillow)
```

Das Beispiel nutzt den Nachbar-Modus mit sechs Fraktionen; die Fraktionskürzel stehen am Heimatsystem.

## Credits & Lizenz

> **Nicht-kommerzielles Fan-Projekt.** Twilight Imperium ist ein Markenzeichen von Fantasy Flight Games / Asmodee;
> dieses Projekt steht in keiner Verbindung dazu.

- **Layouts, Tile-Daten und die Evaluator-Vorlagen stammen aus dem
  [TI4 Map Lab](https://github.com/joepinion/ti4-map-lab) von Joseph Arthur Ellis** und werden von `build_data.py`
  automatisch von dort geladen. Diese Daten stehen unter **CC BY-SA 4.0** – die Namensnennung ist deshalb Pflicht und
  im UI-Footer sowie hier angegeben.
- Eigener Code (Generator, Optimierer, Rendering, UI): frei verwendbar (z. B. MIT).
- Beim Weiterverbreiten die **CC-BY-SA-Auflagen** der Kartendaten beachten (Namensnennung + Share-Alike).
