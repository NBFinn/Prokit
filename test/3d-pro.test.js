import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const plugin = new URL("../plugin/", import.meta.url);
const scripts = fileURLToPath(new URL("skills/3d-pro/scripts/", plugin));
const { analyze, loadMesh } = await import(pathToFileURL(join(scripts, "mesh.mjs")).href);
const { render } = await import(pathToFileURL(join(scripts, "render.mjs")).href);

// Achsparalleler Quader mit nach außen zeigenden Normalen (gegen den Uhrzeigersinn von außen gesehen).
const quad = (a, b, c, d) => [[a, b, c], [a, c, d]];
function box(x0, y0, z0, x1, y1, z1) {
  const p = (x, y, z) => [x ? x1 : x0, y ? y1 : y0, z ? z1 : z0];
  return [
    ...quad(p(0, 0, 0), p(0, 1, 0), p(1, 1, 0), p(1, 0, 0)),
    ...quad(p(0, 0, 1), p(1, 0, 1), p(1, 1, 1), p(0, 1, 1)),
    ...quad(p(0, 0, 0), p(1, 0, 0), p(1, 0, 1), p(0, 0, 1)),
    ...quad(p(0, 1, 0), p(0, 1, 1), p(1, 1, 1), p(1, 1, 0)),
    ...quad(p(0, 0, 0), p(0, 0, 1), p(0, 1, 1), p(0, 1, 0)),
    ...quad(p(1, 0, 0), p(1, 1, 0), p(1, 1, 1), p(1, 0, 1)),
  ];
}
const dir = mkdtempSync(join(tmpdir(), "3d-"));
function binaryStl(name, tris) {
  const b = Buffer.alloc(84 + tris.length * 50);
  b.writeUInt32LE(tris.length, 80);
  tris.forEach((t, i) => t.flat().forEach((v, k) => b.writeFloatLE(v, 84 + i * 50 + 12 + k * 4)));
  writeFileSync(join(dir, name), b);
  return join(dir, name);
}
function asciiStl(name, tris) {
  writeFileSync(join(dir, name), "solid t\n" + tris.map((t) => "facet normal 0 0 0\nouter loop\n" + t.map((v) => `vertex ${v.join(" ")}`).join("\n") + "\nendloop\nendfacet").join("\n") + "\nendsolid t\n");
  return join(dir, name);
}

test("Manifest verweist auf den Skill", () => {
  const manifest = JSON.parse(readFileSync(new URL(".codex-plugin/plugin.json", plugin), "utf8"));
  assert.ok(existsSync(new URL(manifest.skills, plugin)));
  assert.ok(manifest.interface.defaultPrompt.every((p) => p.length <= 128));
});

test("Würfel: Maße, Volumen, dicht, Auflage", () => {
  const r = analyze(loadMesh(binaryStl("cube.stl", box(0, 0, 0, 20, 20, 20))));
  assert.deepEqual(r.size_mm, [20, 20, 20]);
  assert.equal(r.volume_cm3, 8);
  assert.equal(r.watertight, true);
  assert.equal(r.shells, 1);
  assert.equal(r.bed_contact_mm2, 400);
  assert.equal(r.overhang_percent, 0);
  assert.equal(r.weight_solid_g, 9.9);
  assert.deepEqual(r.warnings, []);
});

test("ASCII-STL und OBJ werden gelesen", () => {
  const tris = box(0, 0, 0, 10, 10, 10);
  assert.equal(analyze(loadMesh(asciiStl("a.stl", tris))).volume_cm3, 1);
  const obj = "v 0 0 0\nv 10 0 0\nv 10 10 0\nv 0 10 0\nv 0 0 10\nv 10 0 10\nv 10 10 10\nv 0 10 10\n" +
    "f 1 4 3 2\nf 5 6 7 8\nf 1 2 6 5\nf 4 8 7 3\nf 1 5 8 4\nf 2 3 7 6\n";
  writeFileSync(join(dir, "c.obj"), obj);
  const r = analyze(loadMesh(join(dir, "c.obj")));
  assert.equal(r.volume_cm3, 1);
  assert.equal(r.watertight, true);
});

test("Fehler werden erkannt: invertiert, offen, getrennt, Überhang, Druckbett, Einheit", () => {
  const inv = analyze(loadMesh(asciiStl("inv.stl", box(0, 0, 0, 20, 20, 20).map((t) => [t[0], t[2], t[1]]))));
  assert.equal(inv.normals_inverted, true);
  const open = analyze(loadMesh(asciiStl("open.stl", box(0, 0, 0, 20, 20, 20).slice(2))));
  assert.equal(open.watertight, false);
  assert.equal(open.open_edges, 4);
  const tee = analyze(loadMesh(binaryStl("tee.stl", [...box(20, 0, 0, 30, 10, 30), ...box(0, 0, 30, 50, 10, 35)])));
  assert.equal(tee.shells, 2);
  assert.ok(tee.overhang_percent > 10);
  const big = analyze(loadMesh(binaryStl("big.stl", box(0, 0, 0, 300, 20, 20))), { bed: [220, 220, 250] });
  assert.equal(big.fits_bed, false);
  const meters = analyze(loadMesh(binaryStl("m.stl", box(0, 0, 0, 0.05, 0.05, 0.05))));
  assert.ok(meters.warnings.some((w) => w.includes("Einheit")));
});

test("Rendern: gültiges PNG, Vorderseiten nicht rot, invertiert rot", () => {
  const ok = render(loadMesh(join(dir, "cube.stl")), { size: 200, view: "iso" });
  assert.deepEqual([...ok.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  // Mittleren Pixel der Iso-Ansicht aus dem PNG lesen.
  const center = (buf) => {
    const idat = [];
    for (let o = 8; o < buf.length; ) {
      const len = buf.readUInt32BE(o);
      const type = buf.toString("ascii", o + 4, o + 8);
      if (type === "IDAT") idat.push(buf.subarray(o + 8, o + 8 + len));
      o += 12 + len;
    }
    return import("node:zlib").then(({ inflateSync }) => {
      const raw = inflateSync(Buffer.concat(idat));
      const w = buf.readUInt32BE(16);
      const y = Math.floor(w / 2);
      const o = y * (w * 3 + 1) + 1 + Math.floor(w / 2) * 3;
      return [raw[o], raw[o + 1], raw[o + 2]];
    });
  };
  return Promise.all([center(ok), center(render(loadMesh(join(dir, "inv.stl")), { size: 200, view: "iso" }))]).then(([good, bad]) => {
    assert.ok(good[2] > good[0], `Vorderseite soll bläulich sein: ${good}`);
    assert.ok(bad[0] > bad[2] + 60, `Rückseite soll rot sein: ${bad}`);
  });
});

test("CLI: check-Exit-Code und render-Ausgabe", () => {
  const c = spawnSync("node", [join(scripts, "check.mjs"), join(dir, "open.stl")], { encoding: "utf8" });
  assert.equal(c.status, 1);
  assert.match(c.stdout, /Dicht: NEIN/);
  const out = join(dir, "v.png");
  const r = spawnSync("node", [join(scripts, "render.mjs"), join(dir, "cube.stl"), out, "--size", "300"], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  assert.ok(existsSync(out));
});

test("Wandstärke und Spalt: Konstruktionswerte werden gemessen, Probleme gewarnt", async () => {
  const { measureWalls } = await import(pathToFileURL(join(scripts, "mesh.mjs")).href);
  // Hohlbox 40×30×20 mit 2 mm Wand, oben offen: aus 5 Quadern (Boden + 4 Wände)
  const hollow = [
    ...box(0, 0, 0, 40, 30, 2), ...box(0, 0, 2, 2, 30, 20), ...box(38, 0, 2, 40, 30, 20),
    ...box(2, 0, 2, 38, 2, 20), ...box(2, 28, 2, 38, 30, 20),
  ];
  const w = measureWalls(Float64Array.from(hollow.flat(2)));
  assert.equal(w.wall_median_mm, 2);

  const thin = measureWalls(loadMesh(binaryStl("thin.stl", box(0, 0, 0, 30, 30, 0.4))));
  assert.equal(thin.wall_min_mm, 0.4);
  assert.ok(thin.thin_percent > 90);

  const twoParts = measureWalls(loadMesh(binaryStl("gap.stl", [...box(0, 0, 0, 10, 10, 10), ...box(10.1, 0, 0, 20, 10, 10)])));
  assert.equal(twoParts.gap_min_mm, 0.1);

  const c = spawnSync("node", [join(scripts, "check.mjs"), join(dir, "thin.stl")], { encoding: "utf8" });
  assert.match(c.stdout, /Wandstärke < 0\.8 mm/);
  const g = spawnSync("node", [join(scripts, "check.mjs"), join(dir, "gap.stl")], { encoding: "utf8" });
  assert.match(g.stdout, /Spalt von nur 0\.1 mm/);
  const ok = spawnSync("node", [join(scripts, "check.mjs"), join(dir, "cube.stl")], { encoding: "utf8" });
  assert.match(ok.stdout, /Keine Warnungen/);
});
