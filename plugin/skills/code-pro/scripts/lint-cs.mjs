#!/usr/bin/env node
// Schneller C#-Check auf typische Fehler und Anti-Patterns (ohne Build, ohne Abhängigkeiten).
// Prüft .cs sowie den C#-Anteil von .razor (Blazor) und .cshtml (Razor Pages/MVC): @code-, @functions- und
// @{ }-Blöcke, @( )-Ausdrücke und @-Attributwerte wie @onclick="…". Zeilennummern beziehen sich auf die Originaldatei.
// Ergänzt Compiler und Analyzer, ersetzt sie nicht. Treffer sind Hinweise zum Prüfen, keine Beweise.
//
//   node lint-cs.mjs [pfad ...] [--json] [--max 60]     ohne Pfad: das ganze Projekt

import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";

// level: error = fast sicher ein Fehler · warn = meist ein Fehler · info = Verbesserung
export const RULES = [
  {
    id: "async-void",
    level: "error",
    test: (l) => /\basync\s+void\s+\w+\s*\(/.test(l) && !/EventArgs\b/.test(l),
    msg: "async void: Exceptions gehen verloren, Aufrufer kann nicht warten → async Task",
  },
  {
    id: "blocking-wait",
    level: "warn",
    test: (l) => /\.(Wait\(\s*\)|GetAwaiter\(\)\.GetResult\(\))|\bTask\.WaitAll\(|\.Result\b(?!\s*[=(])/.test(l) && !/\b(ValidationResult|Results?\s*\.|TypedResults)\b/.test(l),
    msg: "Blockierendes Warten (.Result/.Wait()): Deadlock- und Thread-Pool-Risiko → await",
  },
  {
    id: "new-httpclient",
    level: "warn",
    test: (l) => /\bnew\s+HttpClient\s*\(/.test(l),
    msg: "new HttpClient(): Socket-Erschöpfung/DNS-Probleme → IHttpClientFactory bzw. AddHttpClient<T>()",
  },
  {
    id: "datetime-now",
    level: "info",
    test: (l) => /\bDateTime(Offset)?\.(Now|UtcNow|Today)\b/.test(l),
    msg: "Direkte Systemzeit: schwer testbar → TimeProvider (GetUtcNow)",
  },
  {
    id: "parse-culture",
    level: "warn",
    test: (l) => parseWithoutCulture(l) || /\bConvert\.To(Double|Single|Decimal|DateTime)\s*\(\s*[^,()]+\)/.test(l),
    msg: "Parsen ohne Kultur: \"1,5\" vs \"1.5\" hängt von der Systemsprache ab → CultureInfo.InvariantCulture",
  },
  {
    id: "format-culture",
    level: "info",
    test: (l) => /\.ToString\(\s*"[^"]*[NFCEGP0#.][^"]*"\s*\)/.test(l),
    msg: "Zahlenformat ohne Kultur: für Dateien/Protokolle CultureInfo.InvariantCulture angeben",
  },
  {
    id: "throw-ex",
    level: "error",
    test: (l, ctx) => ctx.catchVar && new RegExp(`\\bthrow\\s+${ctx.catchVar}\\s*;`).test(l),
    msg: "throw ex; verliert den Original-Stacktrace → throw;",
  },
  {
    id: "log-interpolation",
    level: "warn",
    test: (l) => /\.Log(Trace|Debug|Information|Warning|Error|Critical)\s*\(\s*(\w+\s*,\s*)?\$"/.test(l),
    msg: "Logging mit $-Interpolation: kein strukturiertes Logging, kostet auch bei aus-geschaltetem Level → Platzhalter {Name}",
  },
  {
    id: "case-compare",
    level: "warn",
    test: (l) => /\.To(Lower|Upper)(Invariant)?\(\)\s*(==|!=|\.Equals\()|(==|!=)\s*[\w.]+\.To(Lower|Upper)(Invariant)?\(\)/.test(l),
    msg: "Vergleich über ToLower/ToUpper: Allokation und Kultur-Fallen (türkisches i) → string.Equals(a, b, StringComparison.OrdinalIgnoreCase)",
  },
  {
    id: "fire-and-forget",
    level: "warn",
    test: (l) => /^\s*(_\s*=\s*)?Task\.(Run|Factory\.StartNew)\s*\(/.test(l),
    msg: "Task ohne await/Besitzer: Fehler verschwinden still → awaiten oder BackgroundService/Channel",
  },
  {
    id: "thread-sleep",
    level: "info",
    test: (l, ctx) => ctx.inAsync && /\bThread\.Sleep\s*\(/.test(l),
    msg: "Thread.Sleep in async-Methode blockiert einen Thread → await Task.Delay(…, ct)",
  },
  {
    id: "gc-collect",
    level: "warn",
    test: (l) => /\bGC\.Collect\s*\(/.test(l),
    msg: "GC.Collect(): kaschiert Allokationsprobleme und bremst → Ursache beheben",
  },
  {
    id: "public-mutable-list",
    level: "info",
    test: (l) => /\bpublic\s+(List|Dictionary|HashSet)<[^;{]+>\s+\w+\s*\{\s*get;\s*set;\s*\}/.test(l),
    msg: "Öffentlich veränderbare Collection: Aufrufer können den Zustand umgehen → IReadOnlyList/IReadOnlyDictionary nach außen",
  },
  {
    id: "async-no-ct",
    level: "info",
    // Signaturen aus Interfaces/Frameworks (override, IAsyncLifetime, IAsyncDisposable) sind fest vorgegeben.
    test: (l) => /\bpublic\s+(virtual\s+|static\s+)*async\s+(Task|ValueTask)\b[^(]*\s\w+Async\s*\(([^)]*)\)/.test(l) && !/CancellationToken|\b(InitializeAsync|DisposeAsync)\s*\(/.test(l),
    msg: "Öffentliche async-Methode ohne CancellationToken → letzten Parameter CancellationToken ct = default ergänzen",
  },
  {
    id: "process-start-string",
    level: "warn",
    test: (l) => /Process\.Start\s*\(\s*[^,)]+,\s*\$?"[^"]*\{/.test(l) || /Arguments\s*=\s*\$"/.test(l),
    msg: "Prozess-Argumente per String zusammengesetzt: Injection-Risiko → ProcessStartInfo.ArgumentList",
  },
  {
    id: "sql-concat",
    level: "error",
    test: (l) => /(FromSqlRaw|ExecuteSqlRaw|CommandText\s*=|new\s+(Sql|Npgsql|MySql|Sqlite)Command\s*\()\s*\(?\s*(\$"|"[^"]*"\s*\+)/.test(l),
    msg: "SQL per String-Verkettung/Interpolation: SQL-Injection → Parameter bzw. FromSql($\"…\") (parametrisiert)",
  },
  {
    id: "binaryformatter",
    level: "error",
    test: (l) => /\bBinaryFormatter\b/.test(l),
    msg: "BinaryFormatter ist unsicher und in .NET 9+ entfernt → System.Text.Json",
  },
];

// Zahlen/Datum aus Text ohne Kulturangabe: Argumente des Aufrufs zählen statt Variablennamen zu raten.
// Treffer: Parse(s), Parse(s, NumberStyles.X), TryParse(s, out x), TryParse(s, NumberStyles.X, out x).
function parseWithoutCulture(line) {
  for (const m of line.matchAll(/\b(double|float|decimal|DateTime|DateTimeOffset|TimeSpan)\.(Try)?Parse(Exact)?\s*\(/g)) {
    if (m[3]) continue; // ParseExact verlangt ohnehin einen Provider
    const args = [];
    let depth = 0;
    let cur = "";
    for (let i = m.index + m[0].length; i < line.length; i++) {
      const c = line[i];
      if (c === "(" || c === "[" || c === "{") depth++;
      if (c === ")" || c === "]" || c === "}") {
        if (depth === 0) { args.push(cur.trim()); break; }
        depth--;
      }
      if (c === "," && depth === 0) { args.push(cur.trim()); cur = ""; } else cur += c;
    }
    const rest = args.filter((a) => a && !/^out\b/.test(a));
    if (rest.length === 1) return true;
    if (rest.length === 2 && /^(System\.Globalization\.)?(NumberStyles|DateTimeStyles)\./.test(rest[1])) return true;
  }
  return false;
}

// Kommentare und Stringinhalte entfernen, damit Text in Strings/Kommentaren keine Treffer erzeugt.
// Interpolierte Strings bleiben als $"…" erhalten (Inhalt geleert), weil Regeln darauf prüfen.
export function stripLine(line, state) {
  let out = "";
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (state.raw) {
      if (line.startsWith('"""', i)) { state.raw = false; out += '"""'; i += 2; }
      continue;
    }
    if (state.block) {
      if (c === "*" && line[i + 1] === "/") { state.block = false; i++; }
      continue;
    }
    if (state.verbatim) {
      if (c === '"' && line[i + 1] === '"') { i++; continue; }
      if (c === '"') { state.verbatim = false; out += '"'; }
      continue;
    }
    if (c === "/" && line[i + 1] === "/") break;
    if (line.startsWith('"""', i) || (c === "$" && /^\$+"""/.test(line.slice(i)))) {
      while (line[i] === "$") out += line[i++];
      out += '"""';
      const end = line.indexOf('"""', i + 3);
      if (end === -1) { state.raw = true; break; }
      out += '"""';
      i = end + 2;
      continue;
    }
    if (c === "/" && line[i + 1] === "*") { state.block = true; i++; continue; }
    if (c === '"' || (c === "@" && line[i + 1] === '"') || (c === "$" && (line[i + 1] === '"' || line[i + 1] === "@"))) {
      const verbatim = c === "@" || line.slice(i, i + 3).includes("@");
      while (line[i] !== '"') out += line[i++];
      out += '"';
      if (verbatim) { state.verbatim = true; continue; }
      for (i++; i < line.length && line[i] !== '"'; i++) if (line[i] === "\\") i++;
      out += '"';
      continue;
    }
    if (c === "'") {
      const end = line.indexOf("'", i + (line[i + 1] === "\\" ? 3 : 2));
      if (end !== -1 && end - i <= 8) { out += "' '"; i = end; continue; }
    }
    out += c;
  }
  return out;
}

export function lintSource(source) {
  const findings = [];
  const state = { block: false, verbatim: false, raw: false };
  const ctx = { catchVar: null, inAsync: false, depth: 0, asyncDepth: -1, catchDepth: -1 };
  const lines = source.split("\n");
  const code = lines.map((l) => stripLine(l, state));

  // Leere catch-Blöcke über mehrere Zeilen erkennen.
  const joined = code.join("\n");
  for (const m of joined.matchAll(/\bcatch\s*(\([^)]*\))?\s*(when\s*\([^)]*\)\s*)?\{\s*\}/g)) {
    const line = joined.slice(0, m.index).split("\n").length;
    findings.push({ line, id: "empty-catch", level: "error", msg: "Leerer catch-Block verschluckt Fehler → loggen und behandeln oder weiterwerfen" });
  }

  code.forEach((l, i) => {
    if (/\basync\b[^=;]*\(/.test(l) && !/=>.*;\s*$/.test(l)) { ctx.inAsync = true; ctx.asyncDepth = ctx.depth; }
    const cm = l.match(/\bcatch\s*\(\s*[\w.<>]+\s+(\w+)\s*\)/);
    if (cm) { ctx.catchVar = cm[1]; ctx.catchDepth = ctx.depth; }
    for (const rule of RULES) if (rule.test(l, ctx)) findings.push({ line: i + 1, id: rule.id, level: rule.level, msg: rule.msg });
    for (const ch of l) {
      if (ch === "{") ctx.depth++;
      else if (ch === "}") {
        ctx.depth--;
        if (ctx.inAsync && ctx.depth <= ctx.asyncDepth) ctx.inAsync = false;
        if (ctx.catchVar && ctx.depth <= ctx.catchDepth) ctx.catchVar = null;
      }
    }
  });
  return findings.sort((a, b) => a.line - b.line);
}

// Razor/Blazor: nur den C#-Anteil behalten, alles andere durch Leerzeichen ersetzen (Zeilen bleiben erhalten).
export function razorToCs(source) {
  const out = source.replace(/[^\n]/g, " ").split("");
  const keep = (from, to) => { for (let i = from; i < to; i++) out[i] = source[i]; };
  // Ende des Klammerblocks ab der öffnenden Klammer; Strings, Zeichen und Kommentare überspringen
  const close = (i, open = "{", shut = "}") => {
    let depth = 0;
    for (let k = i; k < source.length; k++) {
      const c = source[k];
      if (c === '"' || c === "'") { const q = c; k++; while (k < source.length && source[k] !== q && source[k] !== "\n") { if (source[k] === "\\") k++; k++; } continue; }
      if (c === "/" && source[k + 1] === "/") { while (k < source.length && source[k] !== "\n") k++; continue; }
      if (c === "/" && source[k + 1] === "*") { k = source.indexOf("*/", k + 2); if (k === -1) return source.length; k++; continue; }
      if (c === open) depth++;
      else if (c === shut && --depth === 0) return k;
    }
    return source.length;
  };
  const blocks = /@(?:code|functions)\s*\{|@\{/g;
  for (let m; (m = blocks.exec(source)); ) {
    const open = m.index + m[0].length - 1;
    const end = close(open);
    keep(open + 1, end);
    blocks.lastIndex = end;
  }
  // @( Ausdruck ) und Attributwerte "@…" im Markup
  for (const m of source.matchAll(/@\(/g)) keep(m.index + 2, close(m.index + 1, "(", ")"));
  // Blazor-Direktiven (@onclick="…", @bind-Value="…") und Werte der Form attr="@…"
  for (const m of source.matchAll(/(@[\w:.-]+\s*=\s*"|=\s*"@)([^"]*)"/g)) { const start = m.index + m[1].length; keep(start, start + m[2].length); }
  return out.join("");
}

export const isRazor = (f) => /\.(razor|cshtml)$/i.test(f);

const SKIP = /(^|[\\/])(bin|obj|node_modules|\.git|Migrations)([\\/]|$)|\.(g|designer|generated)\.cs$|AssemblyInfo\.cs$/i;
const CS_FILE = /\.(cs|razor|cshtml)$/i;

function csFiles(paths) {
  const files = [];
  for (const p of paths) {
    const st = statSync(p, { throwIfNoEntry: false });
    if (!st) continue;
    if (st.isFile()) { if (CS_FILE.test(p)) files.push(p); continue; }
    try {
      const out = execFileSync("git", ["ls-files", "-co", "--exclude-standard", "--", "*.cs", "*.razor", "*.cshtml"], { cwd: p, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
      files.push(...out.split("\n").filter(Boolean).map((f) => join(p, f)));
    } catch {
      const walk = (d) => {
        for (const e of readdirSync(d, { withFileTypes: true })) {
          const f = join(d, e.name);
          if (e.isDirectory()) { if (!SKIP.test(f + "/")) walk(f); } else if (CS_FILE.test(e.name)) files.push(f);
        }
      };
      walk(p);
    }
  }
  return files.filter((f) => !SKIP.test(f));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const mi = args.indexOf("--max");
  const max = mi === -1 ? 60 : Number(args[mi + 1]);
  const paths = args.filter((a, i) => !a.startsWith("--") && (mi === -1 || i !== mi + 1));
  const files = csFiles(paths.length ? paths : ["."]);
  const all = [];
  for (const f of files) {
    const text = readFileSync(f, "utf8");
    for (const x of lintSource(isRazor(f) ? razorToCs(text) : text)) all.push({ file: relative(".", f) || f, ...x });
  }
  const order = { error: 0, warn: 1, info: 2 };
  all.sort((a, b) => order[a.level] - order[b.level] || a.file.localeCompare(b.file) || a.line - b.line);
  if (args.includes("--json")) {
    console.log(JSON.stringify(all, null, 2));
  } else {
    const shown = all.slice(0, max);
    // Meldungstext nur beim ersten Auftreten einer Regel, danach nur die ID: spart Tokens.
    const seen = new Set();
    for (const x of shown) {
      console.log(`${x.file}:${x.line}  ${x.level}  ${x.id}${seen.has(x.id) ? "" : `  ${x.msg}`}`);
      seen.add(x.id);
    }
    const counts = ["error", "warn", "info"].map((k) => [k, all.filter((x) => x.level === k).length]).filter(([, n]) => n).map(([k, n]) => `${n} ${k}`).join(", ");
    // Was geprüft wurde, damit "keine Treffer" nachvollziehbar ist
    const kinds = Object.entries(files.reduce((m, f) => { const e = f.slice(f.lastIndexOf(".")).toLowerCase(); m[e] = (m[e] ?? 0) + 1; return m; }, {})).map(([e, n]) => `${n} ${e}`).join(", ");
    console.log(`── ${files.length} Dateien geprüft${kinds ? ` (${kinds})` : ""} · ${all.length ? counts : "keine Treffer"}${all.length > max ? ` · ${all.length - max} weitere (--max)` : ""}`);
  }
  process.exit(all.some((x) => x.level === "error") ? 1 : 0);
}
