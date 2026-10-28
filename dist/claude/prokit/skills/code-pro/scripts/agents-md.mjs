#!/usr/bin/env node
// Erkennt Stack, Befehle, Konventionen und CI eines Repos und erzeugt daraus einen kompakten Abschnitt
// für AGENTS.md. Codex liest AGENTS.md bei jedem Start; künftige Sitzungen müssen das Projekt dann
// nicht erneut erkunden.
//
//   node agents-md.mjs [dir]            Vorschlag ausgeben
//   node agents-md.mjs [dir] --write    in AGENTS.md eintragen (nur der markierte Abschnitt wird ersetzt)

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join, posix } from "node:path";
import { pathToFileURL } from "node:url";
import { record } from "./savings.mjs";

// Datei, die der Host bei jedem Start liest: Codex AGENTS.md, Claude Code CLAUDE.md (die Claude-Fassung
// des Plugins wird mit CLAUDE.md gebaut). Überschreibbar mit --file.
export const MEMORY_FILE = "CLAUDE.md";
const START = "<!-- code-pro:auto:start -->";
const END = "<!-- code-pro:auto:end -->";

function files(root) {
  try {
    return execFileSync("git", ["ls-files", "-co", "--exclude-standard"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64 * 1024 * 1024 })
      .split("\n").filter(Boolean).filter((f) => !/(^|\/)(node_modules|bin|obj|dist|build|target|\.venv|venv)\//.test(f));
  } catch {
    const out = [];
    const walk = (d, rel) => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        if (/^(node_modules|\.git|bin|obj|dist|build|target|\.venv|venv)$/.test(e.name)) continue;
        const r = rel ? `${rel}/${e.name}` : e.name;
        if (e.isDirectory()) walk(join(d, e.name), r); else out.push(r);
      }
    };
    walk(root, "");
    return out;
  }
}

// Gelesene Zeichen zählen: so viel hätte Codex ohne das Werkzeug selbst lesen müssen.
let readChars = 0;
const read = (root, f) => { try { const t = readFileSync(join(root, f), "utf8"); readChars += t.length; return t; } catch { return ""; } };
const prop = (xml, name) => xml.match(new RegExp(`<${name}>([^<]+)</${name}>`))?.[1];

export function detect(root = ".") {
  const all = files(root);
  const has = (re) => all.filter((f) => re.test(f));
  const out = { stacks: [], commands: [], conventions: [], ci: [], structure: [] };

  // .NET
  const projects = has(/\.csproj$/);
  if (projects.length) {
    const solution = has(/\.(slnx|sln)$/)[0];
    const props = read(root, "Directory.Build.props");
    const frameworks = new Set();
    const tests = [];
    for (const p of projects) {
      const xml = read(root, p);
      (prop(xml, "TargetFramework") ?? prop(xml, "TargetFrameworks") ?? prop(props, "TargetFramework") ?? "").split(";").filter(Boolean).forEach((f) => frameworks.add(f));
      if (/Microsoft\.NET\.Test\.Sdk|xunit|NUnit|MSTest|TUnit/i.test(xml)) tests.push(p);
    }
    // Testprojekte ohne Test-Framework (Konsolen-Prüfprogramme) erkennt man am Namen
    const consoleChecks = projects.filter((p) => !tests.includes(p) && /(test|check|spec)s?[^/]*\.csproj$/i.test(p) && /<OutputType>Exe</i.test(read(root, p)));
    // Ohne Lösung und mit mehreren Projekten scheitert ein nacktes "dotnet build" (MSB1011/MSB1003). Dann das Projekt
    // nehmen, das von keinem anderen eingebunden wird (meist Test-/Prüfprojekt bzw. App), es baut die übrigen mit.
    const referenced = new Set(projects.flatMap((p) => [...read(root, p).matchAll(/ProjectReference\s+Include="([^"]+)"/g)]
      .map((m) => posix.normalize(posix.join(posix.dirname(p), m[1].replaceAll("\\", "/"))))));
    const roots = projects.filter((p) => !referenced.has(p));
    const targets = solution ? [solution] : projects.length === 1 ? projects : roots.length ? roots.slice(0, 3) : projects.slice(0, 3);
    const target = targets[0];
    out.stacks.push(`.NET (${[...frameworks].join(", ") || "Framework unbekannt"}), ${projects.length} Projekte${solution ? `, Lösung ${solution}` : ""}`);
    for (const t of targets) out.commands.push(`Build: \`dotnet build ${t} --nologo -v q -clp:ErrorsOnly\``);
    if (tests.length) {
      out.commands.push(`Test: \`dotnet test ${solution ?? (tests.length === 1 ? tests[0] : target)} --nologo -v q --logger "console;verbosity=minimal"\``.replace("  ", " "));
      out.commands.push(`Einzeltest: \`… --filter "FullyQualifiedName~Klasse.Methode"\` (Testprojekte: ${tests.join(", ")})`);
    }
    for (const p of consoleChecks) out.commands.push(`Prüfprogramm: \`dotnet run --project ${p.slice(0, p.lastIndexOf("/")) || p}\``);
    // Direkt eingebundene Pakete: zeigt dem Agenten, welche Bibliotheken bereitstehen (Details per api <Paket>)
    const pkgs = new Map();
    for (const p of projects) for (const m of read(root, p).matchAll(/<PackageReference\s+Include="([^"]+)"(?:\s+Version="([^"]+)")?/g)) pkgs.set(m[1], m[2] ?? "");
    const central = read(root, "Directory.Packages.props");
    for (const m of central.matchAll(/<PackageVersion\s+Include="([^"]+)"\s+Version="([^"]+)"/g)) if (pkgs.has(m[1]) && !pkgs.get(m[1])) pkgs.set(m[1], m[2]);
    const shown = [...pkgs].filter(([id]) => !/^(Microsoft\.NET\.Test\.Sdk|coverlet\.|xunit\.runner|MSTest\.Test(Adapter|Framework)|NUnit3TestAdapter)/i.test(id));
    if (shown.length) out.stacks.push(`Pakete: ${shown.slice(0, 12).map(([id, v]) => (v ? `${id} ${v}` : id)).join(", ")}${shown.length > 12 ? ` (+${shown.length - 12})` : ""}`);
    const all2 = props + projects.map((p) => read(root, p)).join("\n");
    const conv = [];
    if (/<Nullable>enable<\/Nullable>/.test(all2)) conv.push("Nullable aktiv");
    if (/<TreatWarningsAsErrors>true/.test(all2)) conv.push("Warnungen sind Fehler");
    if (/<ImplicitUsings>enable/.test(all2)) conv.push("ImplicitUsings");
    if (existsSync(join(root, "Directory.Packages.props"))) conv.push("zentrale Paketversionen (Directory.Packages.props)");
    if (conv.length) out.conventions.push(`C#: ${conv.join(", ")}`);
  }

  // Node / TypeScript, auch in Unterordnern (Monorepos, server/, web/ …)
  for (const pkgFile of has(/(^|\/)package\.json$/).filter((f) => f.split("/").length <= 3)) {
    const dir = pkgFile.includes("/") ? pkgFile.slice(0, pkgFile.lastIndexOf("/")) : "";
    const inDir = (f) => all.includes(dir ? `${dir}/${f}` : f) || all.includes(f);
    let pkg = {};
    try { pkg = JSON.parse(read(root, pkgFile)); } catch {}
    const pm = inDir("pnpm-lock.yaml") ? "pnpm" : inDir("yarn.lock") ? "yarn" : inDir("bun.lockb") || inDir("bun.lock") ? "bun" : "npm";
    const where = dir ? ` in \`${dir}/\`` : "";
    out.stacks.push(`Node/${all.some((f) => f.startsWith(dir) && /tsconfig.*\.json$/.test(f)) ? "TypeScript" : "JavaScript"} (${pm})${where}`);
    out.commands.push(`Install${where}: \`${pm === "npm" ? "npm ci --no-audit --no-fund" : `${pm} install --frozen-lockfile`}\``);
    for (const [name, cmd] of Object.entries(pkg.scripts ?? {})) {
      if (!/^(build|test|lint|typecheck|check|format|start|dev)$|^(build|test):/.test(name)) continue;
      const run = pm === "npm" ? (name === "test" || name === "start" ? `npm ${name}` : `npm run ${name}`) : `${pm} ${name}`;
      out.commands.push(`${name}${where}: \`${run}\` → \`${cmd.length > 70 ? cmd.slice(0, 70) + "…" : cmd}\``);
    }
  }

  // Python
  if (all.some((f) => /(^|\/)(pyproject\.toml|requirements.*\.txt|setup\.py)$/.test(f))) {
    const py = read(root, "pyproject.toml");
    out.stacks.push(`Python${/\[tool\.poetry\]/.test(py) ? " (Poetry)" : /\[tool\.uv\]|uv\.lock/.test(py + all.join()) ? " (uv)" : ""}`);
    if (/pytest/.test(py) || all.some((f) => /(^|\/)(test_[^/]+|[^/]+_test)\.py$/.test(f))) out.commands.push("Test: `pytest -q -x`");
    if (/ruff/.test(py)) out.commands.push("Lint: `ruff check --quiet .`");
    if (/mypy/.test(py)) out.commands.push("Typecheck: `mypy .`");
  }
  if (all.includes("go.mod")) { out.stacks.push("Go"); out.commands.push("Test: `go test ./...`", "Vet: `go vet ./...`"); }
  if (all.includes("Cargo.toml")) { out.stacks.push("Rust"); out.commands.push("Test: `cargo test -q`", "Check: `cargo clippy -q`"); }

  // Befehle, die das README selbst nennt (in Backticks), z. B. "Tests: `dotnet run --project …`"
  const readme = all.find((f) => /^readme\.md$/i.test(f));
  if (readme) {
    const cmds = [...read(root, readme).matchAll(/`((?:dotnet|npm|pnpm|yarn|npx|node|python|pytest|uv|cargo|go|make|gradle|mvn|\.\/)[^`\n]{2,100})`/g)].map((m) => m[1]);
    for (const c of [...new Set(cmds)].slice(0, 4)) if (!out.commands.some((x) => x.includes(c))) out.commands.push(`README: \`${c}\``);
  }

  if (all.includes(".editorconfig")) out.conventions.push("Stil: .editorconfig beachten");
  for (const f of ["CONTRIBUTING.md", "docs/CONTRIBUTING.md"]) if (all.includes(f)) out.conventions.push(`Beiträge: siehe ${f}`);

  // CI: ausgeführte Befehle aus GitHub-Workflows
  for (const wf of has(/^\.github\/workflows\/.+\.ya?ml$/)) {
    const runs = [...read(root, wf).matchAll(/^\s*(?:-\s*)?run:\s*(?:\|\s*\n((?:\s{6,}.+\n?)+)|(.+))$/gm)]
      .flatMap((m) => (m[1] ?? m[2]).split("\n").map((l) => l.trim()).filter(Boolean))
      .filter((l) => !/^(echo|cd|ls|cat)\b/.test(l));
    if (runs.length) out.ci.push(`${basename(wf)}: ${runs.slice(0, 5).map((r) => `\`${r.length > 90 ? r.slice(0, 90) + "…" : r}\``).join(", ")}`);
  }

  // Struktur: oberste Ordner mit Dateizahl
  const top = new Map();
  for (const f of all) if (f.includes("/")) { const d = f.split("/")[0]; if (!d.startsWith(".")) top.set(d, (top.get(d) ?? 0) + 1); }
  out.structure = [...top].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([d, n]) => `${d}/ (${n})`);
  return out;
}

export function render(info) {
  const sec = (title, items) => (items.length ? [`### ${title}`, ...items.map((i) => `- ${i}`), ""] : []);
  return [
    START,
    "## Projekt (automatisch erkannt, mit `agents-md.mjs --write` aktualisieren)",
    "",
    ...sec("Stack", info.stacks.length ? info.stacks : ["nicht erkannt"]),
    ...sec("Befehle", info.commands),
    ...sec("Konventionen", info.conventions),
    ...sec("CI", info.ci),
    ...sec("Struktur", info.structure.length ? [info.structure.join(" · ")] : []),
    END,
  ].join("\n");
}

// Ersetzt nur den markierten Abschnitt; eigene Notizen außerhalb bleiben unangetastet.
export function merge(existing, section, file = MEMORY_FILE) {
  if (!existing.trim())
    return `# ${file}\n\n${section}\n\n## Erkenntnisse\n\n<!-- Hier hält der Agent Stolperfallen und Entscheidungen fest, die nicht im Code stehen. -->\n`;
  const s = existing.indexOf(START);
  const e = existing.indexOf(END);
  if (s !== -1 && e > s) return existing.slice(0, s) + section + existing.slice(e + END.length);
  return `${existing.trimEnd()}\n\n${section}\n`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const root = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--file") ?? ".";
  const section = render(detect(root));
  record("agents-md", readChars, section.length, root);
  if (args.includes("--write")) {
    const fi = args.indexOf("--file");
    const file = fi === -1 ? MEMORY_FILE : args[fi + 1];
    const path = join(root, file);
    writeFileSync(path, merge(read(root, file), section, file));
    console.log(`${path} aktualisiert (${section.split("\n").length} Zeilen im automatischen Abschnitt)`);
  } else {
    console.log(section);
  }
}
