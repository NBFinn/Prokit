#!/usr/bin/env node
// Prüft ein Mesh auf Druckbarkeit: Maße, Volumen, Gewicht, Dichtheit, Überhänge, Auflage, Druckbett.
//
//   node check.mjs <modell.stl|obj> [--bed 220x220x250] [--overhang 45] [--density 1.24] [--min-wall 0.8] [--min-gap 0.3] [--no-walls] [--json]

import { pathToFileURL } from "node:url";
import { analyze, loadMesh, measureWalls } from "./mesh.mjs";

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const opt = (name) => {
    const i = args.indexOf(`--${name}`);
    return i === -1 ? undefined : args[i + 1];
  };
  const file = args.find((a, i) => !a.startsWith("--") && !args[i - 1]?.match(/^--(bed|overhang|density|min-wall|min-gap)$/));
  if (!file) {
    console.error("Aufruf: node check.mjs <modell.stl|obj> [--bed 220x220x250] [--overhang 45] [--density 1.24] [--min-wall 0.8] [--min-gap 0.3] [--no-walls] [--json]");
    process.exit(2);
  }
  const tris = loadMesh(file);
  const r = analyze(tris, {
    bed: opt("bed")?.split(/x/i).map(Number),
    overhangDeg: opt("overhang") ? Number(opt("overhang")) : undefined,
    density: opt("density") ? Number(opt("density")) : undefined,
  });
  if (!args.includes("--no-walls")) {
    const w = measureWalls(tris, {
      minWall: opt("min-wall") ? Number(opt("min-wall")) : undefined,
      minGap: opt("min-gap") ? Number(opt("min-gap")) : undefined,
    });
    if (w) {
      r.walls = w;
      // Einzelne dünne Messpunkte an Kanten/Fasen sind normal; erst ein relevanter Flächenanteil zählt.
      if (w.thin_percent >= 2)
        r.warnings.push(`${w.thin_percent} % der Oberfläche haben Wandstärke < ${w.min_wall_mm} mm (dünnste ${w.wall_min_mm} mm bei ${w.thinnest_at.join("/")}): wird löchrig oder bricht → Wand verstärken.`);
      if (w.gap_min_mm !== null && w.gap_min_mm < w.min_gap_mm)
        r.warnings.push(`Spalt von nur ${w.gap_min_mm} mm bei ${w.gap_at.join("/")}: verschmilzt beim Druck (Print-in-Place braucht ≥ 0,3–0,5 mm).`);
    }
  }
  if (args.includes("--json")) {
    console.log(JSON.stringify(r, null, 2));
  } else {
    console.log(
      [
        `${file}: ${r.triangles} Dreiecke`,
        `Maße: ${r.size_mm.join(" × ")} mm (X×Y×Z), min ${r.min.join("/")}, max ${r.max.join("/")}`,
        `Volumen: ${r.volume_cm3} cm³ · Oberfläche: ${r.surface_cm2} cm² · Gewicht massiv ${r.weight_solid_g} g, gedruckt ca. ${r.weight_print_est_g} g`,
        `Dicht: ${r.watertight ? "ja" : "NEIN"} · Teile: ${r.shells} · Überhänge: ${r.overhang_percent} % · Auflage: ${r.bed_contact_mm2} mm² · Druckbett: ${r.fits_bed ? "passt" : "PASST NICHT"}`,
        r.walls ? `Wandstärke: min ${r.walls.wall_min_mm} · 5 % ${r.walls.wall_p5_mm} · Median ${r.walls.wall_median_mm} mm (dünn: ${r.walls.thin_percent} %) · kleinster Spalt: ${r.walls.gap_min_mm ?? "–"} mm` : "",
        r.warnings.length ? "Warnungen:\n" + r.warnings.map((w) => `- ${w}`).join("\n") : "Keine Warnungen.",
      ].filter(Boolean).join("\n")
    );
  }
  process.exit(r.watertight && !r.normals_inverted ? 0 : 1);
}
