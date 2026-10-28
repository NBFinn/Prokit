#!/usr/bin/env node
// Zeigt, welche Funktionen/Klassen eine Änderung betrifft, statt den ganzen Diff auszugeben.
// Für Selbst-Review, PR-Beschreibungen und um große Diffs gezielt zu lesen.
//
//   node diff-outline.mjs                 Arbeitsverzeichnis + Staging gegen HEAD
//   node diff-outline.mjs --base main     aktueller Stand gegen main (merge-base)
//   node diff-outline.mjs --staged        nur Gestagtes

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { symbols } from "./outline.mjs";
import { record } from "./savings.mjs";

const git = (args, cwd) => execFileSync("git", args, { cwd, encoding: "utf8", maxBuffer: 256 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });

// Geänderte Zeilenbereiche je Datei aus `git diff -U0` (Zeilennummern der neuen Fassung).
export function parseHunks(diff) {
  const files = new Map();
  let current = null;
  for (const line of diff.split("\n")) {
    const f = line.match(/^\+\+\+ (?:b\/)?(.+)$/);
    if (f) {
      current = f[1] === "/dev/null" ? null : f[1];
      if (current && !files.has(current)) files.set(current, []);
      continue;
    }
    const h = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
    if (h && current) {
      const start = Number(h[1]);
      const count = h[2] === undefined ? 1 : Number(h[2]);
      // count 0 = reine Löschung: Stelle liegt hinter Zeile start
      files.get(current).push({ start: Math.max(start, 1), end: Math.max(start + count - 1, start) });
    }
  }
  return files;
}

// Ordnet jeden Bereich der letzten Definition davor zu, plus allen Definitionen, die im Bereich selbst beginnen.
export function symbolsForRanges(syms, ranges) {
  const hit = new Set();
  for (const r of ranges) {
    const before = syms.filter((s) => s.line <= r.end);
    if (!before.length) { hit.add("(Dateianfang)"); continue; }
    // Definitionen innerhalb des Bereichs selbst (neu hinzugefügte Methoden)
    for (const s of before) if (s.line >= r.start) hit.add(s.sig);
    hit.add(before.at(-1).sig);
  }
  return [...hit];
}

export function diffOutline(cwd = ".", { base, staged } = {}) {
  const range = base ? [git(["merge-base", base, "HEAD"], cwd).trim()] : staged ? ["--cached"] : ["HEAD"];
  const numstat = git(["diff", "--numstat", "-M", ...range], cwd);
  const hunks = parseHunks(git(["diff", "-U0", "-M", "--no-color", ...range], cwd));
  const untracked = base || staged ? [] : git(["ls-files", "--others", "--exclude-standard"], cwd).split("\n").filter(Boolean);
  const rows = [];
  let add = 0;
  let del = 0;
  for (const line of numstat.split("\n").filter(Boolean)) {
    const [a, d, ...rest] = line.split("\t");
    let file = rest.join("\t");
    const rename = file.match(/^(.*)\{(.*) => (.*)\}(.*)$/) ?? file.match(/^()(.*) => (.*)()$/);
    if (rename) file = `${rename[1]}${rename[3]}${rename[4]}`;
    const binary = a === "-";
    add += binary ? 0 : Number(a);
    del += binary ? 0 : Number(d);
    const full = join(cwd, file);
    let where = "";
    if (binary) where = "Binärdatei";
    else if (!existsSync(full)) where = "gelöscht";
    else {
      const syms = symbols(readFileSync(full, "utf8"), file);
      if (syms) where = symbolsForRanges(syms, hunks.get(file) ?? []).join(" · ");
    }
    rows.push(`${file} (+${binary ? "?" : a} −${binary ? "?" : d})${rename ? " [umbenannt]" : ""}${where ? `: ${where}` : ""}`);
  }
  for (const f of untracked) {
    const full = join(cwd, f);
    if (/\.(png|jpe?g|gif|webp|ico|pdf|zip|gz|woff2?|ttf|exe|dll|so|dylib|bin|stl|3mf|glb)$/i.test(f) || statSync(full).size > 1_000_000) {
      rows.push(`${f} (neu, binär/groß)`);
      continue;
    }
    const text = readFileSync(full, "utf8");
    const n = text.split("\n").length;
    add += n;
    const syms = symbols(text, f);
    rows.push(`${f} (neu, ${n} Z.)${syms?.length ? `: ${syms.filter((s) => s.indent <= 4).slice(0, 8).map((s) => s.sig).join(" · ")}` : ""}`);
  }
  const text = [...rows, `── ${rows.length} Dateien · +${add} −${del}`].join("\n");
  // Ohne Werkzeug: der vollständige Diff plus neue Dateien.
  let raw = 0;
  try { raw = git(["diff", "-M", "--no-color", ...range], cwd).length + untracked.reduce((s, f) => s + (statSync(join(cwd, f)).size || 0), 0); } catch {}
  return { text, raw };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const bi = args.indexOf("--base");
  try {
    const { text, raw } = diffOutline(".", { base: bi === -1 ? undefined : args[bi + 1], staged: args.includes("--staged") });
    console.log(text);
    record("diff-outline", raw, text.length);
  } catch (e) {
    console.error(e.stderr?.toString().trim() || e.message);
    process.exit(2);
  }
}
