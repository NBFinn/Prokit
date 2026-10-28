# OpenSCAD

## Befehle
```bash
openscad -o teil.stl --export-format binstl teil.scad          # STL binär
openscad -o teil.3mf teil.scad                                # 3MF
openscad -o teil.stl -D 'breite=60' -D 'loecher=4' teil.scad   # Parameter überschreiben
openscad -o vorschau.png --imgsize=800,600 --viewall --autocenter teil.scad
```
Neuere Versionen (ab 2024er Snapshots) mit `--backend=manifold` rechnen CSG um ein Vielfaches schneller. Wenn verfügbar, immer nutzen.

## Grundgerüst
```openscad
// ---- Parameter (mm) ----
breite = 60;
tiefe = 40;
hoehe = 25;
wand = 1.8;           // 4 Linien bei 0,45 mm
radius = 3;
spiel = 0.2;          // Passungsspiel pro Seite
schraube_d = 3.4;     // M3 Durchgang
fase = 0.5;           // gegen Elefantenfuß

$fa = 1; $fs = 0.4;   // Auflösung: statt hohem $fn global
eps = 0.01;           // gegen koplanare Flächen

// ---- Module ----
module abgerundete_box(size, r) {
  hull() for (x = [r, size.x - r], y = [r, size.y - r])
    translate([x, y, 0]) cylinder(r = r, h = size.z);
}

module gehaeuse() {
  difference() {
    abgerundete_box([breite, tiefe, hoehe], radius);
    translate([wand, wand, wand])
      abgerundete_box([breite - 2 * wand, tiefe - 2 * wand, hoehe], max(radius - wand, 0.5));
    // Löcher immer durch die Fläche hinaus (eps), sonst Z-Fighting/Restflächen
    for (x = [10, breite - 10])
      translate([x, tiefe / 2, -eps]) cylinder(d = schraube_d, h = wand + 2 * eps);
  }
}

gehaeuse();
```

## Idiome
- **Abgerundete Formen:** `hull()` über Zylinder/Kugeln ist schnell. `minkowski()` ist sehr langsam, nur für einfache Körper.
- **Fase unten:** unteren Körper mit `linear_extrude(height=fase, scale=…)` oder `hull()` aus zwei leicht versetzten Profilen.
- **2D → 3D:** Profile in 2D bauen (`square`, `circle`, `offset(r=…)`, `polygon`), dann `linear_extrude` oder `rotate_extrude`. Das ist schneller und sauberer als 3D-CSG.
- **`offset(delta=spiel)`** auf 2D-Profile für passende Gegenstücke.
- **Tropfenloch (waagerecht):** `rotate([90,0,0]) linear_extrude(l) hull() { circle(d=d); rotate(45) square(d/2); }`
- **Sechskant-Mutter:** `cylinder(d = sw / cos(30), h = h, $fn = 6)` mit Schlüsselweite `sw`.
- **Muster:** `for (i = [0:n-1]) translate([i * abstand, 0, 0]) …`
- **Texte:** `linear_extrude(0.8) text("ABC", size = 8, font = "Liberation Sans:style=Bold", halign = "center");`
- **Mehrteilige Drucke:** jedes Teil als Modul, unten `teil = "deckel";` und per `-D 'teil="boden"'` einzeln exportieren.

## Fallstricke
- Alles, was gedruckt wird, in einem gemeinsamen `union()`: Top-Level-Objekte werden zwar vereinigt, Teile in `for` innerhalb von `difference()` aber nur, wenn sie richtig verschachtelt sind.
- `$fn` hoch für kleine Löcher ist ok, global hoch macht das Rendern extrem langsam. Besser `$fa/$fs`.
- Kein Objekt unter Z = 0: am Ende `check.mjs` prüfen lassen.
- Rendern bricht mit „CGAL error“ ab: meist koplanare Flächen oder nicht-manifolde Berührungen (zwei Würfel, die sich nur an einer Kante berühren). Mit `eps` überlappen lassen.
