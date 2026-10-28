#!/usr/bin/env node
// Projektsteckbrief für den Sitzungsstart: Stack, Build-/Testbefehle, Git-Stand und Dateiübersicht in wenigen
// Zeilen. Spart die Erkundungsrunde (ls, find, git status, README), mit der ein Agent sonst jede Aufgabe beginnt;
// jede gesparte Runde spart den ganzen Kontext einmal.
//
//   node brief.mjs [dir]

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, parse, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { detect } from "./agents-md.mjs";
import { repoMap } from "./map.mjs";

const MARKERS = /\.(csproj|sln|slnx|fsproj)$|^(package\.json|pyproject\.toml|requirements\.txt|go\.mod|Cargo\.toml|pom\.xml|build\.gradle(\.kts)?|CMakeLists\.txt|Makefile)$/;
const MAX = 2000;

function isProject(dir) {
  const d = resolve(dir);
  if (d === resolve(homedir()) || d === parse(d).root) return false;
  if (existsSync(join(d, ".git"))) return true;
  try {
    const top = readdirSync(d, { withFileTypes: true });
    if (top.some((e) => e.isFile() && MARKERS.test(e.name))) return true;
    return top.filter((e) => e.isDirectory() && !e.name.startsWith(".")).slice(0, 20)
      .some((e) => { try { return readdirSync(join(d, e.name)).some((f) => MARKERS.test(f)); } catch { return false; } });
  } catch { return false; }
}

function gitState(dir) {
  try {
    const out = execFileSync("git", ["status", "--porcelain", "--branch"], { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 3000 });
    const [head, ...changes] = out.split("\n").filter(Boolean);
    const branch = head.replace(/^## (No commits yet on )?/, "").replace(/\.\.\..*/, "");
    return `Git: ${branch}, ${changes.length ? `${changes.length} geänderte/neue Dateien` : "keine Änderungen"}`;
  } catch { return null; }
}

export function projectBrief(dir = process.cwd()) {
  if (!isProject(dir)) return "";
  const info = detect(dir);
  const lines = ["PROJEKT (von ProKit beim Start erkannt, aktuell; nicht erneut mit ls/find/git status/README erkunden):"];
  if (info.stacks.length) lines.push(`Stack: ${info.stacks.join(" · ")}`);
  if (info.commands.length) lines.push(`Befehle: ${info.commands.join(" · ")}`);
  const git = gitState(dir);
  if (git) lines.push(git);
  let map = repoMap(dir, 14).split("\n");
  if (map.length > 15 || map.join("\n").length > 1200) map = [map[0], ...(info.structure.length ? [`Ordner: ${info.structure.join(" · ")}`] : [])];
  lines.push(`Dateien: ${map[0]}`, ...map.slice(1));
  const text = lines.join("\n");
  return text.length > MAX ? `${text.slice(0, MAX)} …` : text;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(projectBrief(process.argv[2] ?? ".") || "Kein Projektordner erkannt.");
}
