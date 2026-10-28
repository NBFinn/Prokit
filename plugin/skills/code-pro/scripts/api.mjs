#!/usr/bin/env node
// Echte .NET-API statt Erinnerung: sucht Typen und Member in den XML-Dokumentationen, die auf dem Rechner liegen,
// und zeigt Signatur und Kurzdoku. Quellen: die Pakete des Projekts (obj/project.assets.json, auch transitive) und
// die Referenzpakete des SDK (.NET-Basisbibliothek, ASP.NET Core, unter Windows WPF/WinForms). Offline, kostet
// nur Tokens, wenn es aufgerufen wird.
//
//   node api.mjs <Typ|Typ.Member|Member> [projektordner] [--max 12]
//   Beispiele: api JsonSerializer.Deserialize · api Enumerable.Chunk · api XLWorkbook.SaveAs

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { homedir, platform } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

// Bevorzugte Zielplattformen je Paket (neueste zuerst)
const TFM = ["net10.0", "net9.0", "net8.0", "net7.0", "net6.0", "net5.0", "netcoreapp3.1", "netstandard2.1", "netstandard2.0", "net48", "net472", "net462", "netstandard1.3"];
const tfmRank = (t) => { const i = TFM.findIndex((x) => t.toLowerCase().startsWith(x)); return i === -1 ? 99 : i; };
const versionKey = (v) => v.split(/[.-]/).map((p) => (/^\d+$/.test(p) ? p.padStart(6, "0") : p)).join(".");

function dotnetRoot() {
  if (process.env.DOTNET_ROOT && existsSync(process.env.DOTNET_ROOT)) return process.env.DOTNET_ROOT;
  try {
    const cmd = platform() === "win32" ? "where" : "which";
    const exe = execFileSync(cmd, ["dotnet"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).split(/\r?\n/)[0].trim();
    if (exe) return dirname(realpathSync(exe));
  } catch {}
  for (const d of ["C:\\Program Files\\dotnet", "/usr/share/dotnet", "/usr/lib/dotnet", "/usr/local/share/dotnet", join(homedir(), ".dotnet")]) if (existsSync(join(d, "packs"))) return d;
  return null;
}

// XML-Dateien der SDK-Referenzpakete (neueste Version, beste Zielplattform)
function sdkSources() {
  const root = dotnetRoot();
  if (!root) return [];
  const out = [];
  for (const pack of ["Microsoft.NETCore.App.Ref", "Microsoft.AspNetCore.App.Ref", "Microsoft.WindowsDesktop.App.Ref"]) {
    const dir = join(root, "packs", pack);
    if (!existsSync(dir)) continue;
    const ver = readdirSync(dir).sort((a, b) => versionKey(b).localeCompare(versionKey(a)))[0];
    const ref = join(dir, ver, "ref");
    if (!existsSync(ref)) continue;
    const tfm = readdirSync(ref).sort((a, b) => tfmRank(a) - tfmRank(b))[0];
    const label = `${pack.replace(/^Microsoft\.|\.Ref$/g, "")} ${ver}`;
    for (const f of readdirSync(join(ref, tfm))) if (f.endsWith(".xml")) out.push({ file: join(ref, tfm, f), label });
  }
  return out;
}

// Pakete des Projekts aus obj/project.assets.json (nach dotnet restore vorhanden), inkl. transitiver Pakete
function projectSources(dir) {
  const assets = [];
  const walk = (d, depth) => {
    let entries = [];
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (!e.isDirectory() || /^(\.|node_modules$|bin$)/.test(e.name)) continue;
      const p = join(d, e.name);
      if (e.name === "obj" && existsSync(join(p, "project.assets.json"))) assets.push(join(p, "project.assets.json"));
      else if (depth < 4) walk(p, depth + 1);
    }
  };
  walk(dir, 0);
  const seen = new Map();
  for (const a of assets) {
    let j;
    try { j = JSON.parse(readFileSync(a, "utf8")); } catch { continue; }
    const folders = Object.keys(j.packageFolders ?? {});
    for (const [key, lib] of Object.entries(j.libraries ?? {})) {
      if (lib.type !== "package" || seen.has(key)) continue;
      const xml = (lib.files ?? []).filter((f) => /^lib\/[^/]+\/[^/]+\.xml$/i.test(f));
      if (!xml.length) continue;
      const best = xml.sort((x, y) => tfmRank(x.split("/")[1]) - tfmRank(y.split("/")[1]));
      const tfm = best[0].split("/")[1];
      for (const folder of folders) {
        const files = best.filter((f) => f.split("/")[1] === tfm).map((f) => join(folder, lib.path, f)).filter(existsSync);
        if (files.length) { seen.set(key, files.map((file) => ({ file, label: key.replace("/", " ") }))); break; }
      }
    }
  }
  return [...seen.values()].flat();
}

// Rückfallebene: alle Pakete im lokalen NuGet-Cache (jeweils neueste Version), z. B. aus anderen Projekten
function cacheSources() {
  const root = process.env.NUGET_PACKAGES || join(homedir(), ".nuget", "packages");
  const out = [];
  let ids = [];
  try { ids = readdirSync(root); } catch { return out; }
  for (const id of ids) {
    let vers = [];
    try { vers = readdirSync(join(root, id)).filter((v) => !/[-]/.test(v)); } catch { continue; }
    const ver = vers.sort((a, b) => versionKey(b).localeCompare(versionKey(a)))[0];
    const lib = join(root, id, ver ?? "", "lib");
    if (!ver || !existsSync(lib)) continue;
    const tfm = readdirSync(lib).sort((a, b) => tfmRank(a) - tfmRank(b))[0];
    try { for (const f of readdirSync(join(lib, tfm))) if (f.endsWith(".xml")) out.push({ file: join(lib, tfm, f), label: `${id} ${ver}, im NuGet-Cache, nicht im Projekt` }); } catch {}
  }
  return out;
}

const ALIAS = { "System.Int32": "int", "System.Int64": "long", "System.String": "string", "System.Boolean": "bool", "System.Double": "double", "System.Single": "float", "System.Decimal": "decimal", "System.Object": "object", "System.Byte": "byte", "System.Char": "char", "System.Void": "void", "System.Int16": "short", "System.UInt32": "uint", "System.UInt64": "ulong" };

// Typname aus der Doku-ID lesbar machen: System.Collections.Generic.IEnumerable{``0} → IEnumerable<T>
function prettyType(t, methodTypeParams, typeTypeParams) {
  return t
    .replace(/``(\d+)/g, (_, i) => methodTypeParams[i] ?? `T${i}`)
    .replace(/`(\d+)/g, (_, i) => typeTypeParams[i] ?? `T${i}`)
    .replace(/[\w.]+/g, (n) => ALIAS[n] ?? n.split(".").pop())
    .replace(/\{/g, "<").replace(/\}/g, ">").replace(/@$/, "").replace(/@/g, "");
}

function splitParams(s) {
  const out = [];
  let depth = 0, cur = "";
  for (const ch of s) {
    if (ch === "{" || ch === "[") depth++;
    if (ch === "}" || ch === "]") depth--;
    if (ch === "," && depth === 0) { out.push(cur); cur = ""; } else cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

const text = (xml) => xml.replace(/<see\s+(?:cref|langword|href)="(?:\w:)?([^"]+)"\s*\/>/g, (_, r) => r.split(".").pop().replace(/`\d+/, "")).replace(/<paramref name="([^"]+)"\s*\/>/g, "$1").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
// erster Satz; Abkürzungen wie "z. B." beenden keinen Satz
const first = (s, n = 150) => { const t = s.split(/(?<=[a-zäöüß0-9)]{3}[.!?])\s+(?=[A-ZÄÖÜ])/)[0]; return t.length > n ? `${t.slice(0, n)}…` : t; };

function parse(id, body) {
  const kind = { T: "Typ", M: "Methode", P: "Property", F: "Feld", E: "Event" }[id[0]] ?? id[0];
  let name = id.slice(2);
  let params = "";
  const pi = name.indexOf("(");
  if (pi !== -1) { params = name.slice(pi + 1, -1); name = name.slice(0, pi); }
  const tparams = [...body.matchAll(/<typeparam name="([^"]+)"/g)].map((m) => m[1]);
  const typeTp = name.match(/`(\d+)/) ? Array.from({ length: Number(name.match(/`(\d+)/)[1]) }, (_, i) => `T${i}`) : [];
  const pnames = [...body.matchAll(/<param name="([^"]+)"/g)].map((m) => m[1]);
  const clean = name.replace(/``\d+$/, "").replace(/`\d+/g, "").replace("#ctor", "ctor");
  const generic = name.match(/``(\d+)$/) ? `<${(tparams.length ? tparams : Array.from({ length: Number(name.match(/``(\d+)$/)[1]) }, (_, i) => `T${i}`)).join(", ")}>` : "";
  const parts = clean.split(".");
  const member = parts.at(-1);
  const sig = `${member}${generic}${params ? `(${splitParams(params).map((p, i) => `${prettyType(p, tparams, typeTp)}${pnames[i] ? ` ${pnames[i]}` : ""}`).join(", ")})` : kind === "Methode" ? "()" : ""}`;
  return {
    kind, sig, full: clean,
    summary: first(text(body.match(/<summary>([\s\S]*?)<\/summary>/)?.[1] ?? ""), 140),
    returns: first(text(body.match(/<returns>([\s\S]*?)<\/returns>/)?.[1] ?? ""), 100),
  };
}

export function api(query, dir = ".", { max = 12 } = {}) {
  const q = query.replace(/\(.*$/, "").toLowerCase();
  const sources = [...projectSources(dir), ...sdkSources()];
  if (!sources.length) return "Keine .NET-Dokumentation gefunden (dotnet SDK installiert? Projekt mit dotnet restore wiederhergestellt?)";
  // Gruppen je Member (Überladungen zusammen), doppelte IDs aus mehreren Referenzpaketen nur einmal
  const groups = new Map();
  const seen = new Set();
  const needle = q.split(".").pop();
  const scan = (list) => { for (const src of list) scanFile(src); };
  const scanFile = ({ file, label }) => {
    let xml;
    try { if (statSync(file).size > 60_000_000) return; xml = readFileSync(file, "utf8"); } catch { return; }
    if (!xml.toLowerCase().includes(needle)) return;
    for (const m of xml.matchAll(/<member name="([^"]+)">([\s\S]*?)<\/member>/g)) {
      const id = m[1];
      const bare = id.slice(2).replace(/\(.*$/, "").replace(/`+\d+/g, "").toLowerCase();
      if (!(bare === q || bare.endsWith(`.${q}`)) || seen.has(id)) continue;
      seen.add(id);
      const h = parse(id, m[2]);
      const key = `${h.kind} ${h.full}`;
      if (!groups.has(key)) groups.set(key, { label, items: [] });
      groups.get(key).items.push(h);
      // Bei einem Typ gleich seine Member auflisten (eine Zeile): spart die Folgefrage "was gibt es?"
      if (id[0] === "T") {
        const prefix = id.slice(2) + ".";
        const names = new Set();
        const sigs = [];
        for (const mm of xml.matchAll(/<member name="(([MPEF]):([^"(]+)[^"]*)">([\s\S]*?)<\/member>/g)) {
          if (!mm[3].startsWith(prefix)) continue;
          const rest = mm[3].slice(prefix.length);
          if (rest.includes(".") && !rest.startsWith("#")) continue;
          names.add(rest.replace(/`+\d+/g, "").replace("#ctor", "ctor"));
          const h = parse(mm[1], mm[4]);
          sigs.push(`  ${h.kind === "Property" ? "Property " : h.kind === "Feld" ? "Feld " : h.kind === "Event" ? "Event " : ""}${h.sig}${h.returns ? ` → ${h.returns}` : ""}${h.summary ? ` — ${h.summary.slice(0, 90)}` : ""}`);
        }
        groups.get(key).members = [...names];
        // überschaubare Typen: Signaturen gleich mit, sonst müsste der Agent je Member nachfragen (eine Runde je Frage)
        if (sigs.length <= 15) groups.get(key).sigs = sigs;
      }
    }
  };
  scan(sources);
  if (!groups.size) scan(cacheSources());
  if (!groups.size) {
    // Paket- oder Namespace-Name: Typen darin auflisten (der Einstieg, wenn nur der Paketname bekannt ist)
    const types = new Map();
    for (const { file, label } of sources) {
      let xml;
      try { xml = readFileSync(file, "utf8"); } catch { continue; }
      for (const m of xml.matchAll(/<member name="T:([^"]+)">([\s\S]*?)<\/member>/g)) {
        const full = m[1].replace(/`\d+/g, "");
        if (!full.toLowerCase().startsWith(`${q}.`) || types.has(full)) continue;
        types.set(full, { line: `${full.slice(q.length + 1)}${m[2].includes("<summary>") ? ` — ${first(text(m[2].match(/<summary>([\s\S]*?)<\/summary>/)?.[1] ?? ""), 90)}` : ""}  (${label})`, id: m[1], xml });
      }
    }
    // kleine Pakete: Member mit Signatur gleich dazu, das spart den nächsten Aufruf
    const small = types.size <= 8;
    for (const t of types.values()) {
      if (!small) { t.text = t.line; continue; }
      const sigs = [];
      for (const mm of t.xml.matchAll(/<member name="([MPEF]:([^"(]+)[^"]*)">([\s\S]*?)<\/member>/g)) {
        if (!mm[2].startsWith(`${t.id}.`) || mm[2].slice(t.id.length + 1).includes(".")) continue;
        const h = parse(mm[1], mm[3]);
        sigs.push(`    ${h.kind === "Property" ? "Property " : ""}${h.sig}${h.returns ? ` → ${h.returns}` : ""}${h.summary ? ` — ${h.summary.slice(0, 100)}` : ""}`);
      }
      t.text = [t.line, ...sigs.slice(0, 12)].join("\n");
    }
    if (types.size) return [`Typen in ${query} (${types.size}), Details: api <Typ>`, ...[...types.values()].slice(0, 40).map((t) => `  ${t.text}`), ...(types.size > 40 ? [`  … ${types.size - 40} weitere`] : [])].join("\n");
  }
  if (!groups.size) return `Nichts gefunden für "${query}". Schreibweise prüfen (Typ.Member), Paket hinzufügen (pkg search …) oder dotnet restore ausführen.`;
  // Zeilenbudget fair auf die Gruppen verteilen, damit z. B. System.Text.Json und Newtonsoft beide sichtbar sind
  const list = [...groups].slice(0, 6);
  const per = Math.max(2, Math.floor(max / list.length));
  const out = [];
  for (const [key, g] of list) {
    const items = g.items;
    out.push(`${key}  (${g.label})${items.length > 1 ? `, ${items.length} Überladungen` : ""}${items[0].summary ? `: ${items[0].summary}` : ""}`);
    if (g.sigs?.length) out.push(...g.sigs);
    else if (g.members?.length) out.push(`  Member (${g.members.length}): ${g.members.slice(0, 60).join(", ")}${g.members.length > 60 ? ", …" : ""}`);
    for (const h of items.slice(0, per)) {
      if (h.kind === "Typ") continue;
      const extra = h.summary && h.summary !== items[0].summary ? ` — ${h.summary.slice(0, 90)}` : "";
      out.push(`  ${h.sig}${h.returns && items.length === 1 ? ` → ${h.returns}` : ""}${extra}`);
    }
    if (items.length > per && items[0].kind !== "Typ") out.push(`  … ${items.length - per} weitere (--max erhöhen)`);
  }
  if (groups.size > list.length) out.push(`… ${groups.size - list.length} weitere Typen/Member mit diesem Namen, genauer suchen (Namespace.Typ.Member)`);
  return out.join("\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2).filter((a) => a !== "api");
  const mi = args.indexOf("--max");
  const max = mi === -1 ? 12 : Number(args[mi + 1]);
  const rest = args.filter((a, i) => a !== "--max" && (mi === -1 || i !== mi + 1));
  if (!rest.length) { console.error("Aufruf: node api.mjs <Typ|Typ.Member> [projektordner] [--max 12]"); process.exit(2); }
  console.log(api(rest[0], rest[1] ?? ".", { max }));
}
