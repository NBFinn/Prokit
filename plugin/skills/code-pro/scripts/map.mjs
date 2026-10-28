#!/usr/bin/env node
// Kompakte Repo-Übersicht: Verzeichnisse mit Dateien und Zeilenzahlen in wenigen Zeilen,
// ohne Abhängigkeiten, Build-Ausgaben, Lockfiles und Binärdateien.
//
//   node map.mjs [verzeichnis] [--max 120]

import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { record } from "./savings.mjs";

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", "out", "target", "bin", "obj", ".next", ".nuxt", ".venv", "venv", "__pycache__", ".cache", "coverage", "vendor", ".idea", ".vscode", ".gradle", ".turbo", ".svelte-kit"]);
const SKIP_FILE = /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb|Cargo\.lock|poetry\.lock|Gemfile\.lock|composer\.lock|go\.sum|.*\.min\.(js|css)|.*\.map|.*\.snap)$/;
const BINARY = /\.(png|jpe?g|gif|webp|ico|svg|pdf|zip|gz|tar|woff2?|ttf|otf|eot|mp[34]|mov|webm|wasm|exe|dll|so|dylib|jar|class|pyc|o|a|bin|db|sqlite)$/i;

function listFiles(root) {
  try {
    const out = execFileSync("git", ["ls-files", "-co", "--exclude-standard"], { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] });
    return out.split("\n").filter(Boolean);
  } catch {
    const files = [];
    const walk = (dir) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        if (e.isDirectory()) {
          if (!SKIP_DIRS.has(e.name) && !e.name.startsWith(".")) walk(join(dir, e.name));
        } else files.push(relative(root, join(dir, e.name)).split(sep).join("/"));
      }
    };
    walk(root);
    return files;
  }
}

function countLines(path) {
  const st = statSync(path, { throwIfNoEntry: false });
  if (!st || !st.isFile()) return null;
  if (st.size > 2_000_000) return `${Math.round(st.size / 1024)}KB`;
  const buf = readFileSync(path);
  let n = buf.length && buf[buf.length - 1] !== 10 ? 1 : 0;
  for (const b of buf) if (b === 10) n++;
  return n;
}

export function repoMap(root = ".", max = 120) {
  const files = listFiles(root).filter((f) => !BINARY.test(f) && !SKIP_FILE.test(f) && !f.split("/").some((p) => SKIP_DIRS.has(p)));
  const entries = files.map((f) => ({ path: f, lines: countLines(join(root, f)) })).filter((e) => e.lines !== null);
  const totalLines = entries.reduce((s, e) => s + (typeof e.lines === "number" ? e.lines : 0), 0);

  // Tiefe so lange reduzieren, bis die Übersicht in max Zeilen passt; tiefere Ebenen werden zu Summen.
  const maxDepth = Math.max(1, ...entries.map((e) => e.path.split("/").length - 1));
  let rendered;
  for (let depth = maxDepth; depth >= 0; depth--) {
    const groups = new Map();
    for (const e of entries) {
      const parts = e.path.split("/");
      const dirParts = parts.slice(0, -1);
      const key = dirParts.slice(0, depth).join("/") || ".";
      if (!groups.has(key)) groups.set(key, { files: [], nested: new Map() });
      const g = groups.get(key);
      if (dirParts.length <= depth) g.files.push(`${parts.at(-1)} ${e.lines}`);
      else {
        const sub = dirParts[depth];
        const n = g.nested.get(sub) ?? { files: 0, lines: 0 };
        n.files++;
        n.lines += typeof e.lines === "number" ? e.lines : 0;
        g.nested.set(sub, n);
      }
    }
    const lines = [...groups.keys()].sort().map((key) => {
      const g = groups.get(key);
      const nested = [...g.nested].map(([d, n]) => `${d}/** (${n.files} Dateien, ${n.lines} Z.)`);
      return `${key}/: ${[...g.files.sort(), ...nested].join(" · ")}`;
    });
    rendered = lines;
    if (lines.length <= max && lines.every((l) => l.length <= 600)) break;
  }
  return [`${entries.length} Dateien, ${totalLines} Zeilen (Zahl = Zeilen)`, ...rendered.map((l) => (l.length > 600 ? `${l.slice(0, 600)} …` : l))].join("\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const i = args.indexOf("--max");
  const max = i === -1 ? 120 : Number(args[i + 1]);
  const dir = args.find((a, idx) => !a.startsWith("--") && (i === -1 || idx !== i + 1)) ?? ".";
  const out = repoMap(dir, max);
  console.log(out);
  // Ohne Werkzeug: vollständige Dateiliste (wie git ls-files/find) plus Zeilenzahlen je Datei.
  let listing = 0;
  try { listing = listFiles(dir).reduce((s, f) => s + f.length + 8, 0); } catch {}
  record("map", listing, out.length, dir);
}
