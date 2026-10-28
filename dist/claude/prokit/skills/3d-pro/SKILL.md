---
name: 3d-pro
description: 3D-Modelle konstruieren und prüfen (STL/OBJ/3MF/STEP, OpenSCAD, build123d/CadQuery, Blender-Python, Three.js, 3D-Druck, Toleranzen). Mit Mesh-Prüfung und PNG-Vorschau.
metadata:
  short-description: Druckfertige 3D-Modelle bauen, prüfen und ansehen
---

# 3D Pro

Sprachmodelle sehen ihre 3D-Modelle nicht. Darum gilt: **Kein Modell ist fertig, bevor es geprüft und angesehen wurde.** Die Werkzeuge liegen in `scripts/` neben dieser Datei und brauchen nur Node.

## Werkzeuge

- `node scripts/check.mjs <datei.stl|obj> [--bed 220x220x250] [--overhang 45] [--density 1.24]` prüft:
  - Maße und Volumen, Gewicht massiv und geschätzt gedruckt
  - Dichtheit (offene oder Non-Manifold-Kanten) und gekippte Normalen
  - getrennte Teile, Überhänge in %, Auflagefläche, ob es aufs Druckbett passt, Einheitenfehler
  - **Wandstärke** (min, 5 %, Median, Anteil unter `--min-wall`, Standard 0,8 mm) und **kleinster Spalt** zwischen Bereichen (Warnung unter `--min-gap`, Standard 0,3 mm), jeweils mit Koordinate der Stelle
  - Exit-Code 1 bei nicht dichtem Modell.
- `node scripts/render.mjs <datei> [out.png] [--view iso|front|right|top|all]` schreibt eine PNG-Vorschau mit 4 Ansichten. **Das Bild danach immer selbst ansehen.** Rote Flächen bedeuten Rückseiten, also gekippte Normalen oder Löcher.

## Werkzeugwahl

| Aufgabe | Werkzeug | Referenz |
|---|---|---|
| Mechanische Teile, Halter, Boxen, einfache Parametrik | OpenSCAD | `references/openscad.md` |
| Fasen/Rundungen an Kanten, STEP für CAD, komplexe Konstruktion | build123d (oder CadQuery) | `references/build123d.md` |
| Organische Formen, Skulpturen, Mesh-Reparatur, Render-Bilder | Blender (Python, headless) | `references/blender.md` |
| 3D im Browser, Produktviewer, Szenen | Three.js | `references/threejs.md` |
| Alles, was gedruckt wird | zusätzlich | `references/druck.md` |

Vorhandene Werkzeuge zuerst prüfen (`openscad --version`, `python -c "import build123d"`, `blender --version`). Wenn nichts installiert ist, OpenSCAD- oder build123d-Code liefern und die Installation in einer Zeile nennen.

## Ablauf

1. **Anforderungen in Zahlen:**
   - Hauptmaße, Gegenstücke (welche Schraube, welches Gerät, welche Wandstärke), Material, Drucker und Druckbett.
   - Fehlendes sinnvoll annehmen und als Parameter oben in die Datei schreiben.
2. **Parametrisch modellieren:**
   - Alle Maße als benannte Variablen in mm, ohne Zahlen mitten im Code.
   - Spiel und Toleranzen als eigene Parameter (`clearance = 0.2`).
   - Aus wenigen, einfachen Körpern aufbauen.
   - Alle Körper zu EINEM Teil vereinigen (union).
3. **Druckgerecht konstruieren** (`references/druck.md`):
   - flache Seite aufs Bett, Überhänge ≤ 45° oder Fase statt Rundung
   - Wände in Vielfachen der Linienbreite
   - Löcher mit Zugabe
   - Kraftrichtung entlang der Schichten
4. **Exportieren:** STL (binär) oder 3MF zum Drucken, STEP zum Weiterkonstruieren, GLB für Web/Echtzeit. Das Modell liegt auf Z = 0.
5. **Prüfen:** `check.mjs` ausführen. Jede Warnung beheben oder begründen, warum sie gewollt ist. Gemessene Wandstärke mit dem Parameter vergleichen: Weicht sie ab, stimmt die Geometrie nicht.
6. **Ansehen:** `render.mjs` ausführen, das PNG öffnen und vergleichen: Stimmen Form, Proportionen, Löcher, Ausrichtung? Erst dann weiter.
7. **Bericht** (kurz):
   - Datei, Außenmaße, Gewicht
   - empfohlene Druckausrichtung, Stützmaterial ja/nein
   - Material und Infill
   - welche Parameter man anpassen kann.

## Fehler, die du vermeiden musst

- Körper nur nebeneinander statt vereinigt: `check.mjs` meldet dann mehrere Teile.
- Koplanare Flächen bei Differenzen: Schnittkörper immer 0,01–1 mm über die Fläche hinaus verlängern.
- Einheit Meter oder Zoll statt mm, Modell schwebt über Z = 0, Normalen zeigen nach innen.
- Löcher ohne Zugabe: Sie werden beim Druck zu klein.
- Passungen ohne Spiel: Teile passen nicht zusammen.
- Feine Details unter Düsenbreite (0,4 mm): Sie werden nicht gedruckt.
- Gewinde direkt drucken, wenn Einpressmuttern oder selbstschneidende Schrauben besser sind.
