#!/usr/bin/env node
// ProKit-Diagnose: prüft, ob alles läuft, was die Plugins brauchen, und sagt bei Problemen, was zu tun ist.
//
//   node doctor.mjs

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pluginRoot = join(here, "..", "..", "..");

export async function diagnose() {
  const rows = [];
  const add = (ok, what, detail, fix) => rows.push({ ok, what, detail, fix });

  const major = Number(process.versions.node.split(".")[0]);
  add(major >= 20, "Node.js", process.versions.node, major >= 20 ? null : "Node.js 20 oder neuer installieren (https://nodejs.org)");

  let git = null;
  try { git = execFileSync("git", ["--version"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch {}
  add(!!git, "Git", git ?? "nicht gefunden", git ? null : "Git installieren; map, diff-outline und secrets brauchen es");

  const skills = existsSync(join(pluginRoot, "skills")) ? readdirSync(join(pluginRoot, "skills")) : [];
  add(skills.length > 0, "Skills", skills.join(", ") || "keine gefunden", skills.length ? null : "Plugin neu installieren");

  const hooks = join(pluginRoot, "hooks", "hooks.json");
  if (existsSync(hooks)) {
    const events = Object.keys(JSON.parse(readFileSync(hooks, "utf8")).hooks ?? {});
    add(events.includes("SessionStart"), "Hooks", events.join(", "), events.includes("Stop") ? null : "Ohne Stop-Hook keine Token-Bilanz");
  }

  const calc = join(pluginRoot, "skills", "design-pro", "scripts", "design.mjs");
  if (existsSync(calc)) {
    let out = "";
    try { out = execFileSync("node", [calc, "contrast", "#000", "#fff"], { encoding: "utf8", timeout: 10000 }); } catch {}
    const ok = /21:1/.test(out);
    add(ok, "Design-Rechner", ok ? "21:1 (Schwarz/Weiß)" : "keine Ausgabe", ok ? null : "Mit `node skills/design-pro/scripts/design.mjs contrast #000 #fff` im Plugin-Ordner testen");
  }

  // Schreibrecht für die Token-Bilanz
  for (const [what, dir] of [["Protokoll Token-Bilanz", process.env.CODE_PRO_HOME || join(homedir(), ".code-pro")]]) {
    let ok = false;
    try { mkdirSync(dir, { recursive: true }); const f = join(dir, ".schreibtest"); writeFileSync(f, "x"); rmSync(f); ok = true; } catch {}
    add(ok, what, dir, ok ? null : "Ordner ist nicht beschreibbar");
  }

  const savings = join(here, "savings.mjs");
  if (existsSync(savings)) {
    const { lastHeartbeats, overview } = await import(pathToFileURL(savings).href);
    const beats = lastHeartbeats();
    const when = (iso) => (iso ? new Date(iso).toLocaleString("de-DE") : "noch nie");
    const ran = beats.sessionStart && beats.stop;
    add(!!ran, "Hooks zuletzt ausgeführt", `Start: ${when(beats.sessionStart)} · Ende (Token-Bilanz): ${when(beats.stop)}`,
      ran ? null : "Hooks laufen nicht: in Codex die Hooks von ProKit freigeben (nach jedem Update erneut nötig), App neu starten, eine Antwort abwarten und erneut prüfen");
    add(true, "Token-Bilanz", overview().split("\n")[1], null);
  }
  return rows;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const rows = await diagnose();
  console.log(`ProKit-Diagnose (${pluginRoot})`);
  for (const r of rows) {
    console.log(`${r.ok ? "✓" : "✗"} ${r.what}: ${r.detail}`);
    if (r.fix) console.log(`  → ${r.fix}`);
  }
  const bad = rows.filter((r) => !r.ok).length;
  console.log(bad ? `── ${bad} Problem(e)` : "── alles in Ordnung");
  process.exit(bad ? 1 : 0);
}
