# 01 – Design-Prinzipien

## 1. Visuelle Hierarchie
Das Auge braucht eine Reihenfolge. Lege sie fest, bevor du gestaltest:
1. **Primär** (1 Element): Headline oder Hauptaktion. Größte Größe ODER stärkster Kontrast ODER einzige Akzentfarbe.
2. **Sekundär** (2–4 Elemente): Unterüberschriften, wichtige Werte.
3. **Tertiär** (alles andere): Metadaten, Labels, Hilfetexte, gedämpft (Neutral-500/600), nicht kleiner als 12px.

Hebel in dieser Reihenfolge der Wirksamkeit: **Kontrast/Farbe → Gewicht → Größe → Position → Abstand**.
Ein häufiger Fehler: Alles betonen. Wenn alles fett ist, ist nichts fett. Betone durch *Zurücknehmen* des Rests.

**Test:** Bildschirm unscharf ansehen (Squint-Test). Sieht man sofort, wo man hinschauen und klicken soll?

## 2. Gestaltgesetze im UI
- **Nähe**: Zusammengehöriges nah, Getrenntes weit. Label 4–8px über Input, Gruppen 24–32px auseinander. Wichtigster Hebel überhaupt, oft ersetzt er Rahmen und Trennlinien.
- **Ähnlichkeit**: Gleiche Funktion = gleiches Aussehen. Nie zwei verschiedene Stile für gleichrangige Buttons.
- **Geschlossenheit/gemeinsame Region**: Hintergrundfläche gruppiert stärker als Linien. Bevorzuge subtile Flächen (Neutral-50) vor Rahmen.
- **Fluchtlinien**: Jedes Element sollte an mindestens einer Kante mit einem anderen fluchten. Linksbündig ist fast immer ruhiger als zentriert.

## 3. Layout
- **Raster**: 12 Spalten Desktop, 4–6 Tablet, 4 Mobile. Content-Breite 1120–1280px, Lesetext max. 65ch.
- **Asymmetrie** wirkt hochwertiger als Symmetrie: z. B. 5/7-Teilung statt 6/6, Headline links + Visual rechts überlappend.
- **Weißraum ist Inhalt**: Premium-Interfaces haben 30–50 % mehr Raum als man instinktiv gibt. Im Zweifel: verdoppeln.
- **Rhythmus**: Sektionsabstände konstant (z. B. 128px), Inhaltsabstände aus der Skala. Unregelmäßigkeit nur als bewusster Akzent.
- **F- und Z-Muster**: Text-lastige Seiten werden F-förmig gescannt (wichtiges links/oben), visuelle Landingpages Z-förmig (Logo → Nav → Headline → CTA).

## 4. Typografie
- **Pairing**: Kontrast in einer Achse, Gemeinsamkeit in anderen. Serif-Display + Grotesk-Text (Fraunces + Inter), oder eine Familie mit vielen Gewichten (Geist, Satoshi).
- **Bewährte Kombinationen**:
  - Technisch/SaaS: Geist + Geist Mono · Inter Display + JetBrains Mono
  - Editorial: Instrument Serif + Inter · Fraunces + Söhne-Alternative (General Sans)
  - Freundlich: Plus Jakarta Sans · DM Sans + DM Serif Display
  - Luxuriös: Cormorant Garamond + Manrope · Playfair (sparsam) + Karla
  - Brutalistisch: Space Grotesk + Space Mono · Archivo Black + Archivo
- Headlines: `font-weight 600–700`, `letter-spacing -0.02em`, `line-height 1.1`, `text-wrap: balance`.
- Fließtext: `text-wrap: pretty`, keine Blocksatz-Ausrichtung im Web.
- Großbuchstaben nur für kurze Labels/Eyebrows, dann `letter-spacing 0.06–0.1em` und kleiner (12–13px).
- Zahlen: `tabular-nums` in Tabellen, Preisen, Timern.

## 5. Farbe
- **60-30-10**: 60 % Neutral (Hintergrund), 30 % Sekundär (Flächen, Text), 10 % Akzent (Aktionen).
- **Getönte Neutrale**: Grau mit 1–2 % Chroma der Markenfarbe wirkt bewusster als reines Grau.
- **Dark Mode** ist kein invertiertes Light Mode: Hintergrund nicht #000 sondern Neutral-950; Akzentfarbe eine Stufe heller (400 statt 600); Schatten durch hellere Flächen ersetzen (Elevation = Helligkeit); Sättigung leicht reduzieren.
- **Semantik**: Rot = Fehler/Zerstörung, Grün = Erfolg, Gelb/Amber = Warnung, Blau = Info. Nie allein über Farbe kommunizieren: immer Icon oder Text dazu.
- Verläufe: subtil (2 benachbarte Farbtöne, z. B. ±20° Hue) oder als Licht-Effekt (radialer Blur hinter Elementen), nie als knalliger Hintergrund für Text.

## 6. Tiefe und Oberflächen
- Ebenen-Modell: Hintergrund → Fläche → erhöhte Fläche → Overlay (Dropdown, Modal) → Toast. Jede Ebene klar unterscheidbar.
- Light Mode: Tiefe über Schatten. Dark Mode: Tiefe über Helligkeit + 1px-Rahmen mit `rgb(255 255 255 / 0.08)`.
- Hochwertige Schatten sind mehrschichtig, weich und farbig getönt: `0 1px 2px rgb(15 23 42 / .06), 0 8px 24px -4px rgb(15 23 42 / .08)`.
- "Innerer Glanz" für Premium-Buttons: `box-shadow: inset 0 1px 0 rgb(255 255 255 / .15)`.

## 7. Was "Premium" konkret ausmacht
1. Konsequenz: Ein Radius, ein Raster, eine Akzentfarbe, überall.
2. Details: optische Ausrichtung von Icons, ausgeglichene Ziffern, korrekte Anführungszeichen („…" bzw. “…”), Gedankenstrich – statt Bindestrich.
3. Zustände: Hover/Focus/Loading sind gestaltet, nicht Browser-Standard.
4. Echte Inhalte: konkrete Zahlen ("Spart 6,5 h pro Woche") statt Floskeln ("Steigern Sie Ihre Produktivität").
5. Zurückhaltung: Weniger Elemente, mehr Raum, ein mutiges Detail.

## 8. Anti-Generik-Liste (KI-Klischees)
| Klischee | Besser |
|---|---|
| Lila→Blau-Verlauf-Hero | Neutraler Grund + ein präziser Akzent, oder Foto/Produkt-Screenshot |
| Alles zentriert | Linksbündig, asymmetrisches Raster |
| 3 Feature-Karten mit Icon oben | Bento-Grid mit unterschiedlichen Größen, echte UI-Ausschnitte |
| Emojis als Icons | Lucide/Phosphor in einheitlicher Strichstärke (1.5–2px) |
| "Revolutionize your workflow" | Konkreter Nutzen mit Zahl |
| Glassmorphism überall | Solide Flächen; Blur nur für Overlays über Inhalt |
| Riesige fette Headline + kleiner grauer Text | Bewusster Größensprung, Serif-Akzent oder kursives Wort |
| Gleicher Abstand überall | Rhythmus: eng in Gruppen, weit zwischen Gruppen |
| Generische Testimonials mit Stock-Avatar | Logo-Leiste, Zitat mit Name + Rolle + Firma, oder Kennzahl |
