import { test } from "node:test";
import assert from "node:assert/strict";
import { contrastRatio, hexToOklch, oklchToHex } from "../design-server/src/color.js";
import { auditCss, checkContrast, generateDesignTokens, generatePalette, generateTypeScale } from "../design-server/src/design.js";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const repo = new URL("../", import.meta.url);
const plugin = new URL("plugin/", repo);
const readJson = (url) => JSON.parse(readFileSync(url, "utf8"));

test("Kein Standard-Design im Plugin: Start-Hook ohne Design-Teil, keine Hausdesign-Auswertung", () => {
  const out = execFileSync("node", [fileURLToPath(new URL("hooks/session-start.mjs", plugin))], { encoding: "utf8", input: "{}" });
  assert.ok(!/HAUSDESIGN|Hausdesign|Design Pro ist aktiv/.test(out), out);
  assert.ok(!existsSync(new URL("skills/design-pro/scripts/house-design.mjs", plugin)));
  assert.ok(!existsSync(new URL("hooks/design-start.mjs", plugin)));
});

test("Gebündelter Design-Rechner läuft als Skript im Plugin", () => {
  const cli = fileURLToPath(new URL("skills/design-pro/scripts/design.mjs", plugin));
  const run = (...args) => execFileSync("node", [cli, ...args], { encoding: "utf8" });
  assert.match(run("contrast", "#000", "#fff"), /21:1/);
  // mehrere Paare in einem Aufruf
  const both = run("contrast", "#60a5fa", "#ffffff", "#ffffff", "#0b5394").trim().split("\n");
  assert.equal(both.length, 2);
  assert.match(both[0], /ungenügend → Vorschlag #[0-9a-f]{6}/);
  assert.match(both[1], /AA/);
  assert.equal(spawnSync("node", [cli, "contrast", "#fff"]).status, 1);
  assert.equal(run("palette", "#7c3aed").trim().split("\n").length, 11);
  assert.match(run("tokens", "#2563eb", "tailwind"), /@theme \{/);
  assert.match(run(), /contrast <vorne> <hinten> \[<vorne> <hinten> …\]/);
  assert.equal(spawnSync("node", [cli, "contrast", "kein", "hex"]).status, 1);
});

test("Kein MCP-Server mehr im Plugin", () => {
  assert.ok(!existsSync(new URL(".mcp.json", plugin)));
  assert.ok(!("mcpServers" in readJson(new URL(".codex-plugin/plugin.json", plugin))));
});

test("Kontrast Schwarz/Weiß ist 21:1", () => {
  assert.equal(Math.round(contrastRatio("#000", "#fff") * 100) / 100, 21);
});

test("OKLCH-Roundtrip ist stabil", () => {
  for (const hex of ["#3b82f6", "#ef4444", "#10b981", "#777777", "#000000", "#ffffff"]) {
    assert.equal(oklchToHex(hexToOklch(hex)), hex);
  }
});

test("Kontrastvorschlag besteht AA und behält den Farbton", () => {
  const r = checkContrast({ foreground: "#60a5fa", background: "#ffffff" });
  assert.equal(r.wcag.AA_normal_text, false);
  assert.ok(r.suggestion.ratio >= 4.5);
  assert.ok(Math.abs(hexToOklch(r.suggestion.hex).h - hexToOklch("#60a5fa").h) < 5);
});

test("Palette ist monoton von hell nach dunkel", () => {
  const p = generatePalette({ base: "#7c3aed" });
  assert.equal(p.scale.length, 11);
  const ls = p.scale.map((s) => hexToOklch(s.hex).l);
  for (let i = 1; i < ls.length; i++) assert.ok(ls[i] < ls[i - 1]);
});

test("Design-Tokens bestehen alle Kontrastprüfungen", () => {
  for (const brand of ["#2563eb", "#facc15", "#e11d48", "#0d9488"]) {
    const t = generateDesignTokens({ brand });
    for (const c of t.contrast_checks) assert.ok(c.passes_AA, `${brand}: ${c.pair} = ${c.ratio}`);
  }
});

test("Tailwind-Ausgabe enthält @theme", () => {
  assert.match(generateDesignTokens({ brand: "#2563eb", format: "tailwind" }).output, /@theme \{/);
});

test("Typo-Skala liefert fluide Werte", () => {
  const s = generateTypeScale({ ratio: "perfect_fourth" });
  assert.equal(s.sizes.find((x) => x.name === "base").px, 16);
  assert.match(s.sizes.at(-1).fluid, /^clamp\(/);
});

test("CSS-Audit findet typische Fehler", () => {
  const r = auditCss({
    css: `.btn{color:#999;background:#fff;padding:13px;outline:none;font-size:10px;transition:all .2s}`,
  });
  const rules = r.issues.map((i) => i.rule);
  for (const rule of ["low-contrast", "off-scale-spacing", "focus-removed", "tiny-text", "reduced-motion"]) assert.ok(rules.includes(rule), rule);
  assert.ok(r.score < 60);
});
