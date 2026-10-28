# build123d / CadQuery (Python, B-Rep-CAD)

Vorteil gegenüber OpenSCAD: echte Kanten-Fasen und -Rundungen, Auswahl von Flächen und Kanten, STEP-Export für andere CAD-Programme.

Installation: `pip install build123d` bzw. `pip install cadquery`, jeweils in einer **eigenen** virtuellen Umgebung. Beide hängen vom CAD-Kern OCP ab, aber in unterschiedlichen Versionen. Zusammen installiert scheitert der Import von CadQuery (`cannot import name … from 'OCP…'`).

## build123d (Builder-Modus)
```python
from build123d import *

# ---- Parameter (mm) ----
breite, tiefe, hoehe = 60, 40, 8
radius = 4
loch_d = 3.4          # M3 Durchgang
senk_d, senk_t = 6.0, 3.2
fase = 0.5

with BuildPart() as platte:
    with BuildSketch():
        RectangleRounded(breite, tiefe, radius)
    extrude(amount=hoehe)
    # Löcher mit Senkung von oben
    with Locations(platte.faces().sort_by(Axis.Z)[-1]):
        with GridLocations(breite - 16, tiefe - 16, 2, 2):
            CounterBoreHole(radius=loch_d / 2, counter_bore_radius=senk_d / 2, counter_bore_depth=senk_t)
    # Untere Außenkante fasen (gegen Elefantenfuß), obere runden
    chamfer(platte.edges().group_by(Axis.Z)[0], length=fase)
    fillet(platte.edges().group_by(Axis.Z)[-1], radius=1)

teil = platte.part
export_stl(teil, "platte.stl")
export_step(teil, "platte.step")
print(teil.bounding_box().size, teil.volume)
```

Nützlich:
- `part.edges().filter_by(Axis.Z)`: senkrechte Kanten, z. B. zum Runden
- `part.faces().sort_by(Axis.Z)[-1]`: oberste Fläche als Arbeitsebene
- `group_by(Axis.Z)[0]`: unterste Kantengruppe
- `mode=Mode.SUBTRACT`: Körper abziehen statt hinzufügen
- `offset(amount=-wand, openings=…)`: Schale mit Öffnung, also ein Gehäuse aus Vollkörper
- `Text("ABC", font_size=8)` in einem `BuildSketch` und dann `extrude`

## CadQuery (Fluent-API)
```python
import cadquery as cq

breite, tiefe, hoehe, wand = 60, 40, 25, 1.8
box = (
    cq.Workplane("XY")
    .box(breite, tiefe, hoehe, centered=(True, True, False))
    .edges("|Z").fillet(4)
    .faces(">Z").shell(-wand)                       # oben offen, Wandstärke wand
    .faces("<Z").workplane()                        # Normale zeigt nach außen (-Z), hole() bohrt ins Material
    .rarray(breite - 16, tiefe - 16, 2, 2).hole(3.4)
)
cq.exporters.export(box, "box.stl")
cq.exporters.export(box, "box.step")
```

Selektoren:
- `">Z"`: oberste Fläche, `"<Z"`: unterste Fläche
- `"|Z"`: Kanten parallel zu Z
- `"#Z"`: Kanten senkrecht zu Z

## Fallstricke
- Rundungen nach dem Bohren können fehlschlagen. Reihenfolge: Grundkörper → Rundungen/Fasen → Löcher. Ist ein Radius zu groß für die Kante, wirft OCC einen Fehler: dann kleiner wählen.
- `shell` vor Löchern ausführen.
- `hole()` bohrt entgegen der Normalen der Arbeitsebene. `workplane(invert=True)` auf einer Außenfläche bohrt deshalb vom Teil weg ins Leere: kein Fehler, aber keine Löcher. Das fällt nur in der Vorschau oder an der Auflagefläche in `check.mjs` auf.
- Export immer prüfen (`check.mjs`). STL-Toleranz bei Bedarf feiner: `export_stl(teil, "x.stl", tolerance=0.01, angular_tolerance=0.1)`.
