# Druckgerecht konstruieren (FDM, Düse 0,4 mm)

## Wände und Details
| Merkmal | Wert |
|---|---|
| Linienbreite | ~0,45 mm |
| Wandstärke | Vielfache der Linienbreite: 0,9 / 1,35 / 1,8 mm; Minimum 0,8 mm, tragend ≥ 1,6–2,4 mm |
| Boden/Deckel | ≥ 4–5 Schichten (bei 0,2 mm Schicht: ≥ 0,8–1,0 mm) |
| Kleinste Details | ≥ 0,8 mm breit (zwei Linien) |
| Text (erhaben/vertieft) | Strichstärke ≥ 0,6 mm, Höhe/Tiefe ≥ 0,6 mm, Schrift ≥ 6 mm, fette serifenlose Schrift |
| Rippen | Dicke 0,5–0,8 × Wandstärke, Höhe ≤ 3 × Wandstärke |

## Überhänge und Brücken
- Überhänge bis 45° von der Senkrechten drucken ohne Stützen. Flacher heißt Stütze, Fase oder Umorientieren.
- Brücken bis ~10–20 mm sind meist ok. Darüber besser Stützen oder Bögen.
- Untere Kanten am Bett: **Fase 0,4–0,6 mm** statt Rundung. Das gleicht den Elefantenfuß aus, und Rundungen werden unten zum Überhang.
- Obere Kanten dürfen gerundet sein.
- Waagerechte Löcher als **Tropfenform** (Spitze nach oben, 45°) oder mit flachem Dach, sonst sacken sie oben ein.
- Selbsttragende Formen bevorzugen: Fasen 45°, Kegel, gestufte Absätze.

## Löcher, Passungen, Toleranzen (Richtwerte, mit Testdruck kalibrieren)
| Zweck | Spiel |
|---|---|
| Senkrechtes Loch | Durchmesser +0,2–0,4 mm |
| Presspassung | 0–0,1 mm pro Seite |
| Gleitpassung (Deckel, Schieber) | 0,15–0,25 mm pro Seite |
| Lose Passung (Scharnier, Drehung) | 0,3–0,5 mm pro Seite |
| Druck-in-Place-Gelenke | ≥ 0,4–0,5 mm Abstand |

Schrauben (metrisch):
| Verbindung | Loch-Ø |
|---|---|
| M3 Durchgang | 3,4 mm |
| M3 Kopfsenkung | Ø 6,0 mm × 3,2 mm tief |
| M3 selbstschneidend in Kunststoff | 2,5–2,8 mm |
| M3 Gewindeeinsatz (Einschmelzmutter) | laut Datenblatt, typisch 4,0–4,2 mm, Tiefe = Einsatzlänge + 1 mm |
| M3 Mutter-Falle (Sechskant) | Schlüsselweite 5,5 + 0,3 mm |
| M4 Durchgang | 4,5 mm |
| M5 Durchgang | 5,5 mm |

Gedruckte Gewinde erst ab ~M8, mit Spiel 0,2–0,3 mm. Darunter sind Einsätze oder selbstschneidende Schrauben besser.

## Festigkeit und Ausrichtung
- Schichten sind die Schwachstelle. Bauteil so drehen, dass die Hauptlast **entlang** der Schichten wirkt, nicht zwischen ihnen. Beispiel: Haken liegend drucken.
- Größte flache Fläche aufs Bett.
- Innenecken mit Radius ≥ 1 mm (Kerbwirkung).
- Mehr Wände (3–4) bringen mehr Festigkeit als mehr Infill.
- Schnapphaken: lang und dünn statt kurz und dick, Dehnung ≤ 2–3 % (PLA spröde, PETG zäher).

## Materialien
| Material | Dichte g/cm³ | Eigenschaften |
|---|---|---|
| PLA | 1,24 | leicht zu drucken, steif, spröde, ab ~55 °C weich (nicht ins Auto) |
| PETG | 1,27 | zäh, chemikalien- und wärmebeständiger (~75 °C), etwas fädig |
| ABS / ASA | 1,04 / 1,07 | wärmebeständig (~95 °C), ASA UV-fest; Gehäuse/Einhausung nötig, schrumpft ~0,5–0,8 % |
| TPU | 1,21 | flexibel; Wände dicker, keine feinen Passungen |
| PA/CF | ~1,1–1,2 | sehr fest, trocken lagern, gehärtete Düse |

## Slicer-Startwerte
- Schicht 0,2 mm (Detail 0,12)
- 3 Wände
- Infill 15–20 % (Gyroid), tragende Teile 30–50 %
- Stützen nur „auf Druckbett“, wenn möglich
- Brim bei kleiner Auflagefläche oder hohen schlanken Teilen

## Häufige Druckbett-Größen (X×Y×Z mm)
| Drucker | Bauraum |
|---|---|
| Creality Ender-3 (V2/V3) | 220×220×250 |
| Creality K1 | 220×220×250 |
| Creality K1 Max | 300×300×300 |
| Creality K2 Plus | 350×350×350 |
| Bambu Lab A1 mini | 180×180×180 |
| Bambu Lab A1 / P1S / X1C | 256×256×256 |
| Prusa MK4 | 250×210×220 |
| Prusa MINI | 180×180×180 |

Druckbett bei `check.mjs` mit `--bed` angeben.
