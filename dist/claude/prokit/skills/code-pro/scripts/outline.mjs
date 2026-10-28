#!/usr/bin/env node
// Struktur einer oder mehrerer Dateien (Klassen, Funktionen, Typen, Überschriften) mit Zeilennummern,
// damit nur die relevanten Abschnitte gelesen werden müssen.
//
//   node outline.mjs <datei> [datei ...]

import { readFileSync } from "node:fs";
import { extname } from "node:path";
import { pathToFileURL } from "node:url";
import { record } from "./savings.mjs";

const CONTROL = /^\s*(if|for|while|switch|catch|return|else|do|try|with|foreach|using|lock|synchronized)\b/;

const PATTERNS = {
  js: [
    /^\s*(export\s+)?(default\s+)?(async\s+)?function\*?\s+[\w$]+/,
    /^\s*(export\s+)?(default\s+)?(abstract\s+)?class\s+[\w$]+/,
    /^\s*(export\s+)?(declare\s+)?(interface|type|enum|namespace)\s+[\w$]+/,
    /^\s*(export\s+)?(const|let|var)\s+[\w$]+\s*(:[^=]+)?=\s*(async\s+)?(function\b|\([^)]*\)\s*(:[^=]+)?=>|[\w$]+\s*=>)/,
    /^\s{2,}(public\s+|private\s+|protected\s+|static\s+|readonly\s+|async\s+|get\s+|set\s+|override\s+)*#?[\w$]+\s*(<[^>]*>)?\([^)]*\)?\s*(:\s*[^{;]+)?\{?\s*$/,
  ],
  py: [/^\s*(async\s+)?def\s+\w+/, /^\s*class\s+\w+/],
  go: [/^func\s/, /^type\s+\w+\s+(struct|interface)/],
  rs: [/^\s*(pub(\([\w:]+\))?\s+)?(async\s+|const\s+|unsafe\s+)*(fn|struct|enum|trait|impl|mod|type|macro_rules!)\b/],
  java: [
    /^\s*(public|private|protected|internal|static|abstract|sealed|final|partial|data|open)?\s*(public\s+|private\s+|protected\s+|internal\s+|static\s+|abstract\s+|sealed\s+|final\s+|partial\s+|data\s+|open\s+)*(class|interface|enum|record|struct|object)\s+\w+/,
    /^\s*(public|private|protected|internal|static|override|abstract|virtual|async|final|suspend|open)\s[^=;]*\w+\s*(<[^>]*>)?\s*\([^;]*$/,
    /^\s*(fun|func|def)\s+[\w<>.`]+/,
  ],
  cs: [
    /^\s*(file\s+)?namespace\s+[\w.]+/,
    /^\s*((public|private|protected|internal|static|abstract|sealed|partial|readonly|ref|file|unsafe|new)\s+)*(class|interface|enum|struct|record(\s+(struct|class))?|delegate)\s+\w+/,
    // Methoden, Konstruktoren, Operatoren (auch => und mehrzeilige Parameter); kein "=" vor der Klammer, damit Felder mit new() rausfallen
    /^\s*((public|private|protected|internal|static|override|abstract|virtual|async|sealed|extern|unsafe|new|partial|readonly|implicit|explicit)\s+)+[^=;(]*?\b(\w+|operator\s*\S+)\s*(<[^>]*>)?\s*\(/,
    // Properties und Indexer
    /^\s*((public|private|protected|internal|static|override|abstract|virtual|sealed|new|required|readonly)\s+)+[^=;(]+\b(\w+|this\[[^\]]*\])\s*(\{\s*(get|set|init)\b|=>)/,
    /^\s*extension\s*(<[^>]*>)?\s*\(/,
  ],
  c: [/^[A-Za-z_][\w\s*&:<>,]*[\s*&]+[\w:~]+\s*\([^;]*$/, /^\s*(typedef\s+)?(struct|class|enum|union|namespace)\s+\w+\s*\{?\s*$/],
  rb: [/^\s*(def|class|module)\s/],
  php: [/^\s*(abstract\s+|final\s+)?(class|interface|trait|enum)\s+\w+/, /^\s*(public|private|protected)?\s*(static\s+)?function\s+\w+/],
  sh: [/^\s*(function\s+)?[\w-]+\s*\(\)\s*\{?/],
  md: [/^#{1,4}\s/],
  sql: [/^\s*create\s+(or\s+replace\s+)?(table|view|function|procedure|index|trigger)\b/i],
  css: [/^[^\s{][^{]*\{\s*$/, /^@(media|layer|supports|keyframes)/],
};

const LANG = {
  ".js": "js", ".jsx": "js", ".ts": "js", ".tsx": "js", ".mjs": "js", ".cjs": "js", ".vue": "js", ".svelte": "js",
  ".py": "py", ".go": "go", ".rs": "rs",
  ".java": "java", ".cs": "cs", ".kt": "java", ".kts": "java", ".scala": "java", ".swift": "java", ".dart": "java",
  ".c": "c", ".h": "c", ".cc": "c", ".cpp": "c", ".hpp": "c", ".cxx": "c",
  ".rb": "rb", ".php": "php", ".sh": "sh", ".bash": "sh", ".zsh": "sh",
  ".md": "md", ".mdx": "md", ".sql": "sql", ".css": "css", ".scss": "css",
};

// Definitionen als Daten ({ line, indent, sig }); null, wenn der Dateityp nicht unterstützt wird.
export function symbols(text, path) {
  const patterns = PATTERNS[LANG[extname(path).toLowerCase()]];
  if (!patterns) return null;
  const found = [];
  text.split("\n").forEach((line, i) => {
    if (CONTROL.test(line) || !patterns.some((p) => p.test(line))) return;
    let sig = line.trim().replace(/\s*\{\s*$/, "");
    if (sig.length > 110) sig = sig.slice(0, 110) + "…";
    found.push({ line: i + 1, indent: Math.min(line.length - line.trimStart().length, 8), sig });
  });
  return found;
}

export function outline(path) {
  const text = readFileSync(path, "utf8");
  const header = `${path} (${text.split("\n").length} Z.)`;
  const found = symbols(text, path);
  if (!found) return `${header}: keine Outline für diesen Dateityp, gezielt mit rg suchen`;
  return found.length
    ? `${header}\n${found.map((s) => `${String(s.line).padStart(5)}  ${" ".repeat(s.indent)}${s.sig}`).join("\n")}`
    : `${header}: keine Definitionen gefunden`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const files = process.argv.slice(2);
  if (!files.length) {
    console.error("Aufruf: node outline.mjs <datei> [datei ...]");
    process.exit(2);
  }
  console.log(files.map((f) => {
    try {
      const out = outline(f);
      // Ohne Werkzeug: die ganze Datei lesen.
      record("outline", readFileSync(f, "utf8").length, out.length);
      return out;
    } catch (e) {
      return `${f}: ${e.code ?? e.message}`;
    }
  }).join("\n\n"));
}
