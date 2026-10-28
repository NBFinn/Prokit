#!/usr/bin/env node
// Rendert ein Mesh als PNG mit vier Ansichten (2×2), damit das Ergebnis angesehen werden kann:
// oben links Iso, oben rechts Vorne (-Y), unten links Rechts (+X), unten rechts Oben (+Z).
// Rückseiten von Flächen erscheinen rot: Hinweis auf gekippte Normalen oder Löcher.
//
//   node render.mjs <modell.stl|obj> [ausgabe.png] [--size 1000] [--view iso|front|right|top|all]

import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { deflateSync } from "node:zlib";
import { bounds, loadMesh } from "./mesh.mjs";

const VIEWS = {
  iso: { az: -45, el: 30 },
  front: { az: 0, el: 0 },
  right: { az: -90, el: 0 },
  top: { az: 0, el: 90 },
};

// Kamera-Basis für Z-oben: az dreht um Z (0 = Blick von -Y nach +Y), el hebt die Kamera an.
function basis({ az, el }) {
  const a = (az * Math.PI) / 180;
  const e = (Math.min(el, 89.999) * Math.PI) / 180;
  const fwd = [Math.sin(a) * Math.cos(e), Math.cos(a) * Math.cos(e), -Math.sin(e)]; // Blickrichtung
  const right = [Math.cos(a), -Math.sin(a), 0];
  const up = [
    right[1] * fwd[2] - right[2] * fwd[1],
    right[2] * fwd[0] - right[0] * fwd[2],
    right[0] * fwd[1] - right[1] * fwd[0],
  ];
  return { fwd, right, up };
}

function renderView(tris, view, W, H, img, ox, oy) {
  const { fwd, right, up } = basis(view);
  const dot = (p, v) => p[0] * v[0] + p[1] * v[1] + p[2] * v[2];
  const n = tris.length / 9;
  const proj = new Float64Array(n * 9);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < n * 3; i++) {
    const p = [tris[i * 3], tris[i * 3 + 1], tris[i * 3 + 2]];
    const x = dot(p, right), y = dot(p, up), z = dot(p, fwd);
    proj[i * 3] = x; proj[i * 3 + 1] = y; proj[i * 3 + 2] = z;
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  const margin = 0.08;
  const scale = Math.min((W * (1 - 2 * margin)) / (maxX - minX || 1), (H * (1 - 2 * margin)) / (maxY - minY || 1));
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const zbuf = new Float64Array(W * H).fill(Infinity);
  const light = [0.35, 0.55, 0.76];

  for (let t = 0; t < n; t++) {
    const P = [0, 1, 2].map((k) => [
      W / 2 + (proj[t * 9 + k * 3] - cx) * scale,
      H / 2 - (proj[t * 9 + k * 3 + 1] - cy) * scale,
      proj[t * 9 + k * 3 + 2],
    ]);
    const area = (P[1][0] - P[0][0]) * (P[2][1] - P[0][1]) - (P[2][0] - P[0][0]) * (P[1][1] - P[0][1]);
    if (Math.abs(area) < 1e-12) continue;
    // Bildschirm-y zeigt nach unten: negative Fläche = zur Kamera gewandt (gegen den Uhrzeigersinn im Raum).
    const front = area < 0;
    const w = [0, 1, 2].map((k) => [tris[t * 9 + k * 3], tris[t * 9 + k * 3 + 1], tris[t * 9 + k * 3 + 2]]);
    const e1 = [w[1][0] - w[0][0], w[1][1] - w[0][1], w[1][2] - w[0][2]];
    const e2 = [w[2][0] - w[0][0], w[2][1] - w[0][1], w[2][2] - w[0][2]];
    let nr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const nl = Math.hypot(...nr) || 1;
    nr = nr.map((v) => (front ? v : -v) / nl);
    // Licht relativ zur Kamera, damit jede Ansicht gut ausgeleuchtet ist.
    const L = [0, 1, 2].map((k) => light[0] * right[k] + light[1] * up[k] - light[2] * fwd[k]);
    const shade = 0.25 + 0.75 * Math.max(0, nr[0] * L[0] + nr[1] * L[1] + nr[2] * L[2]);
    const color = front ? [110 + 120 * shade, 140 + 105 * shade, 170 + 85 * shade] : [200 * shade + 55, 40, 40];

    const x0 = Math.max(0, Math.floor(Math.min(P[0][0], P[1][0], P[2][0])));
    const x1 = Math.min(W - 1, Math.ceil(Math.max(P[0][0], P[1][0], P[2][0])));
    const y0 = Math.max(0, Math.floor(Math.min(P[0][1], P[1][1], P[2][1])));
    const y1 = Math.min(H - 1, Math.ceil(Math.max(P[0][1], P[1][1], P[2][1])));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const px = x + 0.5, py = y + 0.5;
        const b0 = ((P[1][0] - px) * (P[2][1] - py) - (P[2][0] - px) * (P[1][1] - py)) / area;
        const b1 = ((P[2][0] - px) * (P[0][1] - py) - (P[0][0] - px) * (P[2][1] - py)) / area;
        const b2 = 1 - b0 - b1;
        if (b0 < -1e-9 || b1 < -1e-9 || b2 < -1e-9) continue;
        const z = b0 * P[0][2] + b1 * P[1][2] + b2 * P[2][2];
        const i = y * W + x;
        if (z >= zbuf[i]) continue;
        zbuf[i] = z;
        const o = ((oy + y) * img.width + ox + x) * 3;
        img.data[o] = color[0]; img.data[o + 1] = color[1]; img.data[o + 2] = color[2];
      }
    }
  }
  // Silhouette dunkel nachzeichnen für klarere Kanten.
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      if (zbuf[i] === Infinity) continue;
      const depth = zbuf[i];
      const edge = [i - 1, i + 1, i - W, i + W].some((j) => zbuf[j] === Infinity || Math.abs(zbuf[j] - depth) * scale > 3);
      if (edge) {
        const o = ((oy + y) * img.width + ox + x) * 3;
        img.data[o] = 30; img.data[o + 1] = 35; img.data[o + 2] = 45;
      }
    }
  }
}

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function png({ width, height, data }) {
  const chunk = (type, body) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(body.length);
    const td = Buffer.concat([Buffer.from(type), body]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) data.copy(raw, y * (width * 3 + 1) + 1, y * width * 3, (y + 1) * width * 3);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

export function render(tris, { size = 1000, view = "all" } = {}) {
  const views = view === "all" ? ["iso", "front", "right", "top"] : [view];
  const grid = views.length === 1 ? 1 : 2;
  const cell = Math.floor(size / grid);
  const img = { width: cell * grid, height: cell * grid, data: Buffer.alloc(cell * grid * cell * grid * 3, 245) };
  views.forEach((v, i) => {
    if (!VIEWS[v]) throw new Error(`Unbekannte Ansicht: ${v}`);
    renderView(tris, VIEWS[v], cell, cell, img, (i % grid) * cell, Math.floor(i / grid) * cell);
  });
  if (grid === 2) {
    for (let k = 0; k < img.width; k++) {
      for (const [x, y] of [[k, cell], [cell, k]]) {
        const o = (y * img.width + x) * 3;
        img.data[o] = img.data[o + 1] = img.data[o + 2] = 200;
      }
    }
  }
  return png(img);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const opt = (name) => {
    const i = args.indexOf(`--${name}`);
    return i === -1 ? undefined : args[i + 1];
  };
  const pos = args.filter((a, i) => !a.startsWith("--") && !args[i - 1]?.match(/^--(size|view)$/));
  if (!pos[0]) {
    console.error("Aufruf: node render.mjs <modell.stl|obj> [ausgabe.png] [--size 1000] [--view iso|front|right|top|all]");
    process.exit(2);
  }
  const out = pos[1] ?? pos[0].replace(/\.(stl|obj)$/i, "") + ".preview.png";
  const tris = loadMesh(pos[0]);
  const view = opt("view") ?? "all";
  writeFileSync(out, render(tris, { size: Number(opt("size") ?? 1000), view }));
  const b = bounds(tris);
  console.log(`${out} geschrieben (${view === "all" ? "oben links Iso, oben rechts Vorne, unten links Rechts, unten rechts Oben" : view}); Maße ${b.size.map((v) => v.toFixed(2)).join(" × ")} mm. Rot = Rückseiten (Normalen/Löcher prüfen).`);
}
