#!/usr/bin/env node
// Code finden UND lesen in einem Schritt: sucht ein Muster und zeigt zu jedem Treffer die umschließende
// Methode/Funktion mit Zeilennummern (samt Doku-Kommentar darüber). Ersetzt "grep, dann Datei lesen",
// also eine ganze Runde, in der der Agent den gesamten Kontext erneut sendet.
//
//   node find.mjs <regex> [pfad …] [-i] [--max 6]

import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { symbols } from "./outline.mjs";
import { record } from "./savings.mjs";

const SKIP = /(^|\/)(node_modules|\.git|bin|obj|dist|build|out|target|vendor|coverage|\.venv|venv|__pycache__)\//;
const BINARY = /\.(png|jpe?g|gif|webp|ico|pdf|zip|gz|tar|woff2?|ttf|otf|mp[34]|mov|wasm|exe|dll|so|dylib|jar|class|pyc|o|a|bin|db|sqlite|lock|min\.js|map)$/i;
const BRACES = new Set([".cs", ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".java", ".kt", ".go", ".rs", ".c", ".h", ".cpp", ".hpp", ".cc", ".php", ".swift", ".dart", ".scala", ".css", ".scss"]);
const MAX_BLOCK = 80;

function listFiles(root) {
  try {
    if (statSync(root).isFile()) return [root];
    return execFileSync("git", ["ls-files", "-co", "--exclude-standard"], { cwd: root, encoding: "utf8", maxBuffer: 64 << 20, stdio: ["ignore", "pipe", "ignore"] })
      .split("\n").filter(Boolean).sort().map((f) => join(root, f));
  } catch {
    const out = [];
    const walk = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) { if (!SKIP.test(`${p.split(sep).join("/")}/`)) walk(p); } else out.push(p); } };
    walk(root);
    return out.sort(); // gleiche Reihenfolge auf allen Systemen (Windows liefert anders sortiert)
  }
}

// Ende des Blocks ab Zeile start (0-basiert): Klammern zählen bzw. Einrückung (Python, YAML …).
function blockEnd(lines, start, ext) {
  if (BRACES.has(ext)) {
    let depth = 0, opened = false;
    for (let i = start; i < lines.length && i < start + 400; i++) {
      for (const ch of lines[i].replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\/\/.*$/g, "")) {
        if (ch === "{") { depth++; opened = true; } else if (ch === "}") depth--;
      }
      if (opened && depth <= 0) return i;
      if (!opened && /;\s*$/.test(lines[i]) && i > start) return i; // Einzeiler / Ausdruckskörper
      if (!opened && /=>.*;\s*$/.test(lines[i])) return i;
    }
    return Math.min(lines.length - 1, start + MAX_BLOCK);
  }
  const indent = (l) => l.length - l.trimStart().length;
  const base = indent(lines[start]);
  let end = start;
  for (let i = start + 1; i < lines.length; i++) { if (lines[i].trim() === "") continue; if (indent(lines[i]) <= base) break; end = i; }
  return end;
}

export function find(pattern, paths = ["."], { ignoreCase = false, max = 6 } = {}) {
  // (?i) wie bei grep/rg/.NET verstehen: JavaScript kennt den Inline-Schalter nicht
  if (/^\(\?i\)/.test(pattern)) { pattern = pattern.slice(4); ignoreCase = true; }
  pattern = pattern.replace(/\(\?i\)/g, "");
  let re;
  try { re = new RegExp(pattern, ignoreCase ? "i" : ""); } catch { re = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), ignoreCase ? "i" : ""); }
  const blocks = [];
  const extra = [];
  let rawChars = 0;
  for (const root of paths) for (const file of listFiles(root)) {
    const r = relative(".", file);
    const rel = (r.startsWith("..") ? file : r).split(sep).join("/") || file;
    if (SKIP.test(rel) || BINARY.test(rel)) continue;
    let text;
    try { if (statSync(file).size > 1_500_000) continue; text = readFileSync(file, "utf8"); } catch { continue; }
    if (text.includes("\u0000") || !re.test(text)) continue;
    rawChars += text.length;
    const lines = text.split("\n");
    const syms = symbols(text, file) ?? [];
    const seen = new Set();
    lines.forEach((line, i) => {
      if (!re.test(line)) return;
      // innerstes Symbol, das den Treffer umschließt
      let owner = null;
      for (const s of syms) {
        if (s.line - 1 > i) break;
        const end = blockEnd(lines, s.line - 1, extname(file).toLowerCase());
        if (end >= i && (!owner || s.line > owner.start + 1)) owner = { start: s.line - 1, end, sig: s.sig };
      }
      // Treffer im Doku-Kommentar/Attribut direkt über einer Definition gehört zu dieser Definition
      {
        const next = syms.find((s) => s.line - 1 > i && s.line - 1 - i <= 6);
        if (next && lines.slice(i, next.line - 1).every((l) => /^\s*(\/\/\/?|\*|\/\*\*|#|\[|@|$)/.test(l)))
          owner = { start: next.line - 1, end: blockEnd(lines, next.line - 1, extname(file).toLowerCase()), sig: next.sig };
      }
      const key = owner ? `${owner.start}` : `L${i}`;
      if (seen.has(key)) return;
      seen.add(key);
      if (blocks.length >= max) { extra.push(`${rel}:${i + 1}: ${line.trim().slice(0, 100)}`); return; }
      let from = owner ? owner.start : Math.max(0, i - 3);
      const to = owner ? Math.min(owner.end, owner.start + MAX_BLOCK) : Math.min(lines.length - 1, i + 3);
      while (from > 0 && from > (owner?.start ?? from) - 6 && /^\s*(\/\/\/?|\*|\/\*\*|#|\[|@)/.test(lines[from - 1])) from--; // Doku/Attribute
      const body = lines.slice(from, to + 1).map((l, k) => `${String(from + k + 1).padStart(5)}${re.test(l) ? ">" : " "} ${l}`);
      if (owner && owner.end > to) body.push(`      … (bis Zeile ${owner.end + 1})`);
      blocks.push(`── ${rel}:${from + 1}-${to + 1}${owner ? `  ${owner.sig}` : ""}\n${body.join("\n")}`);
    });
  }
  const out = [
    ...blocks,
    ...(extra.length ? [`── weitere Treffer (${extra.length}):`, ...extra.slice(0, 30), ...(extra.length > 30 ? [`… und ${extra.length - 30} mehr, Muster verfeinern`] : [])] : []),
  ].join("\n");
  return { text: out || `Keine Treffer für /${pattern}/`, rawChars };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args[0] === "find" && args.length > 1) args.shift(); // "find.mjs find <muster>" ebenfalls verstehen
  const mi = args.indexOf("--max");
  const max = mi === -1 ? 6 : Number(args[mi + 1]);
  const rest = args.filter((a, i) => a !== "-i" && a !== "--max" && (mi === -1 || i !== mi + 1));
  if (!rest.length) { console.error("Aufruf: node find.mjs <regex> [pfad …] [-i] [--max 6]"); process.exit(2); }
  const { text, rawChars } = find(rest[0], rest.length > 1 ? rest.slice(1) : ["."], { ignoreCase: args.includes("-i"), max });
  console.log(text);
  // Ohne Werkzeug: Suche plus die Dateien mit Treffern lesen.
  record("find", rawChars, text.length);
}
