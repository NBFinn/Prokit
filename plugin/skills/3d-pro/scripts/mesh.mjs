// Lädt STL (binär/ASCII) und OBJ als Dreiecksliste und berechnet Kennzahlen für die Druckbarkeit.

import { readFileSync } from "node:fs";
import { extname } from "node:path";

export function loadMesh(path) {
  const buf = readFileSync(path);
  const ext = extname(path).toLowerCase();
  if (ext === ".obj") return parseObj(buf.toString("utf8"));
  if (ext === ".stl") return parseStl(buf);
  throw new Error(`Nicht unterstütztes Format: ${ext} (STL oder OBJ exportieren)`);
}

// Dreiecke als Float64Array mit 9 Werten pro Dreieck (x0 y0 z0 x1 y1 z1 x2 y2 z2).
function parseStl(buf) {
  if (buf.length >= 84) {
    const n = buf.readUInt32LE(80);
    if (84 + n * 50 === buf.length) {
      const tris = new Float64Array(n * 9);
      for (let i = 0; i < n; i++) {
        const o = 84 + i * 50 + 12;
        for (let k = 0; k < 9; k++) tris[i * 9 + k] = buf.readFloatLE(o + k * 4);
      }
      return tris;
    }
  }
  const nums = [];
  for (const m of buf.toString("utf8").matchAll(/vertex\s+(\S+)\s+(\S+)\s+(\S+)/g)) nums.push(+m[1], +m[2], +m[3]);
  if (!nums.length || nums.length % 9) throw new Error("STL konnte nicht gelesen werden");
  return Float64Array.from(nums);
}

function parseObj(text) {
  const v = [];
  const out = [];
  for (const line of text.split("\n")) {
    const p = line.trim().split(/\s+/);
    if (p[0] === "v") v.push([+p[1], +p[2], +p[3]]);
    else if (p[0] === "f") {
      const idx = p.slice(1).map((t) => {
        const i = parseInt(t.split("/")[0], 10);
        return i < 0 ? v.length + i : i - 1;
      });
      for (let k = 1; k + 1 < idx.length; k++) out.push(...v[idx[0]], ...v[idx[k]], ...v[idx[k + 1]]);
    }
  }
  if (!out.length) throw new Error("OBJ enthält keine Flächen");
  return Float64Array.from(out);
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const tri = (t, i) => [
  [t[i * 9], t[i * 9 + 1], t[i * 9 + 2]],
  [t[i * 9 + 3], t[i * 9 + 4], t[i * 9 + 5]],
  [t[i * 9 + 6], t[i * 9 + 7], t[i * 9 + 8]],
];

export function bounds(t) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < t.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      if (t[i + k] < min[k]) min[k] = t[i + k];
      if (t[i + k] > max[k]) max[k] = t[i + k];
    }
  }
  return { min, max, size: max.map((v, k) => v - min[k]) };
}

export function analyze(t, { overhangDeg = 45, bed = [220, 220, 250], density = 1.24 } = {}) {
  const n = t.length / 9;
  const b = bounds(t);
  const eps = Math.max(...b.size) * 1e-6 || 1e-9;

  // Punkte verschweißen, um Kanten zu zählen (dicht = jede Kante genau zweimal, gegenläufig).
  const ids = new Map();
  const vid = (p) => {
    const key = `${Math.round(p[0] / eps)},${Math.round(p[1] / eps)},${Math.round(p[2] / eps)}`;
    let id = ids.get(key);
    if (id === undefined) ids.set(key, (id = ids.size));
    return id;
  };
  const edges = new Map();
  const parent = [];
  const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  const union = (a, b) => (parent[find(a)] = find(b));

  let volume = 0;
  let area = 0;
  let degenerate = 0;
  let overhangArea = 0;
  let bedArea = 0;
  const cosLimit = Math.cos(((90 - overhangDeg) * Math.PI) / 180);
  const bedTol = Math.max(b.size[2] * 1e-4, 1e-3);

  for (let i = 0; i < n; i++) {
    const [a, c, d] = tri(t, i);
    const nrm = cross(sub(c, a), sub(d, a));
    const twiceArea = len(nrm);
    const ids3 = [vid(a), vid(c), vid(d)];
    for (const id of ids3) if (parent[id] === undefined) parent[id] = id;
    if (twiceArea < eps * eps || ids3[0] === ids3[1] || ids3[1] === ids3[2] || ids3[0] === ids3[2]) {
      degenerate++;
      continue;
    }
    area += twiceArea / 2;
    volume += (a[0] * (c[1] * d[2] - c[2] * d[1]) - a[1] * (c[0] * d[2] - c[2] * d[0]) + a[2] * (c[0] * d[1] - c[1] * d[0])) / 6;
    union(ids3[0], ids3[1]);
    union(ids3[1], ids3[2]);
    for (let k = 0; k < 3; k++) {
      const u = ids3[k];
      const w = ids3[(k + 1) % 3];
      const key = u < w ? `${u},${w}` : `${w},${u}`;
      const e = edges.get(key) ?? { count: 0, fwd: 0 };
      e.count++;
      if (u < w) e.fwd++;
      edges.set(key, e);
    }
    const nz = nrm[2] / twiceArea;
    const onBed = [a, c, d].every((p) => p[2] - b.min[2] < bedTol);
    if (onBed && nz < -0.99) bedArea += twiceArea / 2;
    else if (nz < -cosLimit) overhangArea += twiceArea / 2;
  }

  let open = 0;
  let nonManifold = 0;
  let flipped = 0;
  for (const e of edges.values()) {
    if (e.count === 1) open++;
    else if (e.count > 2) nonManifold++;
    else if (e.fwd !== 1) flipped++;
  }
  const shells = new Set([...parent.keys()].filter((i) => parent[i] !== undefined).map(find)).size;
  const watertight = open === 0 && nonManifold === 0 && flipped === 0;
  const absVol = Math.abs(volume);

  // Grobe Gewichtsschätzung für FDM: Hülle ~1.2 mm massiv, Rest mit 15 % Infill.
  const shellVol = Math.min(absVol, area * 1.2);
  const printedVol = shellVol + (absVol - shellVol) * 0.15;

  const fits = (() => {
    const s = [...b.size].slice(0, 2).sort((x, y) => y - x);
    const bedXY = [...bed].slice(0, 2).sort((x, y) => y - x);
    return s[0] <= bedXY[0] && s[1] <= bedXY[1] && b.size[2] <= bed[2];
  })();

  const warnings = [];
  if (!watertight) warnings.push(`Nicht dicht: ${open} offene Kanten, ${nonManifold} Non-Manifold-Kanten, ${flipped} Kanten mit gekippter Orientierung. Slicer können Fehler machen; Modell reparieren.`);
  if (volume < 0) warnings.push("Normalen zeigen nach innen (Volumen negativ): Flächenorientierung umdrehen.");
  if (degenerate) warnings.push(`${degenerate} degenerierte Dreiecke (Fläche ~0).`);
  if (shells > 1) warnings.push(`${shells} getrennte Teile. Gewollt? Sonst schweben Teile oder Bauteile berühren sich nicht.`);
  if (b.min[2] !== 0 && Math.abs(b.min[2]) > 1e-6) warnings.push(`Unterseite liegt bei Z=${b.min[2].toFixed(3)} statt 0.`);
  if (bedArea < area * 0.01 && bedArea < 50) warnings.push(`Kleine Auflagefläche (${bedArea.toFixed(1)} mm²): Haftung prüfen, ggf. drehen oder Brim.`);
  if (overhangArea > area * 0.05) warnings.push(`${((overhangArea / area) * 100).toFixed(1)} % der Oberfläche sind Überhänge > ${overhangDeg}°: Stützmaterial nötig oder Ausrichtung/Fasen ändern.`);
  if (!fits) warnings.push(`Passt nicht aufs Druckbett ${bed.join("×")} mm.`);
  if (Math.max(...b.size) < 1) warnings.push("Modell ist < 1 mm groß: Einheit vermutlich Meter oder Zoll statt Millimeter.");
  if (Math.max(...b.size) > 5000) warnings.push("Modell ist > 5 m groß: Einheit prüfen.");

  const r = (x, d = 2) => Math.round(x * 10 ** d) / 10 ** d;
  return {
    triangles: n,
    size_mm: b.size.map((x) => r(x)),
    min: b.min.map((x) => r(x, 3)),
    max: b.max.map((x) => r(x, 3)),
    volume_cm3: r(absVol / 1000, 3),
    surface_cm2: r(area / 100),
    watertight,
    shells,
    open_edges: open,
    non_manifold_edges: nonManifold,
    flipped_edges: flipped,
    degenerate_triangles: degenerate,
    normals_inverted: volume < 0,
    overhang_percent: r((overhangArea / (area || 1)) * 100, 1),
    bed_contact_mm2: r(bedArea, 1),
    fits_bed: fits,
    weight_solid_g: r((absVol / 1000) * density, 1),
    weight_print_est_g: r((printedVol / 1000) * density, 1),
    warnings,
  };
}

// Wandstärke und Spalte per Strahl: Von flächengewichteten Stichproben aus wird senkrecht ins Material
// (Wand) bzw. nach außen (Spalt zum nächsten Bereich) gemessen. Grobe Prüfung, kein FEM.
export function measureWalls(t, { samples = 1500, minWall = 0.8, minGap = 0.3, budget = 4e7 } = {}) {
  const n = t.length / 9;
  const count = Math.max(50, Math.min(samples, Math.floor(budget / Math.max(n, 1))));
  const areas = new Float64Array(n);
  const normals = new Float64Array(n * 3);
  let total = 0;
  for (let i = 0; i < n; i++) {
    const [a, b, c] = tri(t, i);
    const nr = cross(sub(b, a), sub(c, a));
    const l = len(nr);
    areas[i] = l / 2;
    total += l / 2;
    if (l > 0) for (let k = 0; k < 3; k++) normals[i * 3 + k] = nr[k] / l;
  }
  if (!total) return null;

  // Deterministische, flächengewichtete Auswahl (gleiche Eingabe = gleiches Ergebnis).
  const picks = [];
  const step = total / count;
  let acc = 0;
  let next = step / 2;
  for (let i = 0; i < n && picks.length < count; i++) {
    acc += areas[i];
    while (acc >= next && picks.length < count) {
      picks.push(i);
      next += step;
    }
  }

  const cast = (o, d, skip, wantBack) => {
    let best = Infinity;
    for (let j = 0; j < n; j++) {
      if (j === skip) continue;
      const facing = normals[j * 3] * d[0] + normals[j * 3 + 1] * d[1] + normals[j * 3 + 2] * d[2];
      if (wantBack ? facing <= 0 : facing >= 0) continue;
      const o9 = j * 9;
      const e1 = [t[o9 + 3] - t[o9], t[o9 + 4] - t[o9 + 1], t[o9 + 5] - t[o9 + 2]];
      const e2 = [t[o9 + 6] - t[o9], t[o9 + 7] - t[o9 + 1], t[o9 + 8] - t[o9 + 2]];
      const p = cross(d, e2);
      const det = e1[0] * p[0] + e1[1] * p[1] + e1[2] * p[2];
      if (Math.abs(det) < 1e-12) continue;
      const inv = 1 / det;
      const s = [o[0] - t[o9], o[1] - t[o9 + 1], o[2] - t[o9 + 2]];
      const u = (s[0] * p[0] + s[1] * p[1] + s[2] * p[2]) * inv;
      if (u < 0 || u > 1) continue;
      const q = cross(s, e1);
      const v = (d[0] * q[0] + d[1] * q[1] + d[2] * q[2]) * inv;
      if (v < 0 || u + v > 1) continue;
      const dist = (e2[0] * q[0] + e2[1] * q[1] + e2[2] * q[2]) * inv;
      if (dist > 1e-6 && dist < best) best = dist;
    }
    return best;
  };

  const walls = [];
  const gaps = [];
  let thinArea = 0;
  let thinnest = null;
  let narrowest = null;
  for (const i of picks) {
    const [a, b, c] = tri(t, i);
    const centroid = [0, 1, 2].map((k) => (a[k] + b[k] + c[k]) / 3);
    const nrm = [normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2]];
    // Wand: nach innen, Austritt durch eine Fläche, deren Normale in Strahlrichtung zeigt.
    const w = cast(centroid, nrm.map((v) => -v), i, true);
    if (Number.isFinite(w)) {
      walls.push(w);
      if (w < minWall) thinArea++;
      if (!thinnest || w < thinnest.mm) thinnest = { mm: w, at: centroid };
    }
    // Spalt: nach außen bis zur nächsten Fläche, die dem Strahl zugewandt ist.
    const g = cast(centroid, nrm, i, false);
    if (Number.isFinite(g) && (!narrowest || g < narrowest.mm)) narrowest = { mm: g, at: centroid };
    if (Number.isFinite(g)) gaps.push(g);
  }
  walls.sort((x, y) => x - y);
  const r = (x) => Math.round(x * 100) / 100;
  const pct = (arr, p) => (arr.length ? r(arr[Math.min(arr.length - 1, Math.floor(arr.length * p))]) : null);
  return {
    samples: picks.length,
    wall_min_mm: walls.length ? r(walls[0]) : null,
    wall_p5_mm: pct(walls, 0.05),
    wall_median_mm: pct(walls, 0.5),
    thin_percent: walls.length ? r((thinArea / walls.length) * 100) : 0,
    thinnest_at: thinnest ? thinnest.at.map(r) : null,
    gap_min_mm: narrowest ? r(narrowest.mm) : null,
    gap_at: narrowest ? narrowest.at.map(r) : null,
    min_wall_mm: minWall,
    min_gap_mm: minGap,
  };
}
