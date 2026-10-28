// Leitet ProKit für Claude (dist/claude/prokit) aus dem Codex-Plugin in plugin/ ab: gleiche Skills, Werkzeuge
// und Hooks, angepasst an Claude Code (.claude-plugin/plugin.json, ${CLAUDE_PLUGIN_ROOT},
// CLAUDE.md statt AGENTS.md). Packt zusätzlich dist/prokit.plugin für die Claude-App.
// Aufruf: npm run build:claude [-- <zielordner>]   (Zielordner nur für Tests; dann ohne .plugin-Datei)

import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { zipDirectory } from "./zip.js";

const repo = fileURLToPath(new URL("../", import.meta.url));
const source = join(repo, "plugin");
// Eine Versionsnummer (package.json) für beide Fassungen; bei jeder inhaltlichen Änderung erhöhen,
// denn Codex und Claude Code legen Plugins nach Version im Cache ab.
export const VERSION = JSON.parse(readFileSync(join(repo, "package.json"), "utf8")).version;
export const PLUGIN_FILE = join(repo, "dist/prokit.plugin");

// Texte für Claude Code umschreiben; Code bleibt bis auf die Gedächtnisdatei unverändert.
function adapt(text, file) {
  let t = text;
  if (file.endsWith("agents-md.mjs")) t = t.replace('export const MEMORY_FILE = "AGENTS.md";', 'export const MEMORY_FILE = "CLAUDE.md";');
  // Wie in Codex (allow_implicit_invocation: false): Code Pro und Design Pro nur auf ausdrücklichen Aufruf laden.
  // Jeder automatisch geladene Skill kostet einen Modellaufruf und steckt danach in jedem weiteren.
  if (/(code|design)-pro[\\/]SKILL\.md$/.test(file)) t = t.replace(/^(name: .+)$/m, "$1\ndisable-model-invocation: true");
  if (/\.(md|mjs|yaml)$/.test(file)) {
    t = t
      .replaceAll("`AGENTS.md`", "`CLAUDE.md`")
      .replaceAll("AGENTS.md mit Projektabschnitt", "CLAUDE.md mit Projektabschnitt")
      .replaceAll("Codex übernimmt", "Claude Code übernimmt");
  }
  return t;
}

function copyAdapted(from, to) {
  if (statSync(from).isDirectory()) {
    mkdirSync(to, { recursive: true });
    for (const e of readdirSync(from)) copyAdapted(join(from, e), join(to, e));
    return;
  }
  if (/\.(md|mjs|yaml|json)$/.test(from) && statSync(from).size < 500_000) writeFileSync(to, adapt(readFileSync(from, "utf8"), from));
  else cpSync(from, to);
}

export function buildClaude(target = join(repo, "dist/claude/prokit")) {
  rmSync(target, { recursive: true, force: true });
  const out = (p) => join(target, p);
  mkdirSync(out(".claude-plugin"), { recursive: true });

  copyAdapted(join(source, "skills"), out("skills"));

  // Hook-Skripte übernehmen; nur die Hook-Liste (hooks.json) ist im Claude-Format anders.
  mkdirSync(out("hooks"), { recursive: true });
  for (const f of readdirSync(join(source, "hooks")).filter((f) => f !== "hooks.json")) copyAdapted(join(source, "hooks", f), out(`hooks/${f}`));

  const hook = (script, timeout) => ({ hooks: [{ type: "command", command: `node "\${CLAUDE_PLUGIN_ROOT}/hooks/${script}"`, timeout }] });
  writeFileSync(out("hooks/hooks.json"), JSON.stringify({
    description: "ProKit: Kurzregeln beim Start jeder Sitzung, Token-Bilanz am Ende jeder Antwort.",
    hooks: { SessionStart: [hook("session-start.mjs", 30)], Stop: [hook("stop.mjs", 10)] },
  }, null, 2) + "\n");

  // Kein $schema: die Claude-App bricht das Synchronisieren ab, wenn die Schema-Adresse nicht abrufbar ist.
  writeFileSync(out(".claude-plugin/plugin.json"), JSON.stringify({
    name: "prokit",
    version: VERSION,
    description:
      "ProKit: schlanker C#-Profi mit Token-Sparwerkzeugen, Projektgedächtnis (CLAUDE.md) und ehrlicher Token-Bilanz, Farbrechner, 3D-Konstrukteur mit Mesh-Prüfung und Vorschau.",
    author: { name: "NBFinn" },
    homepage: "https://github.com/NBFinn/prokit",
    repository: "https://github.com/NBFinn/prokit",
    keywords: ["csharp", "dotnet", "tokens", "design", "3d", "3d-druck"],
  }, null, 2) + "\n");

  writeFileSync(out("README.md"), `# ProKit für Claude

Abgeleitet aus dem Codex-Plugin in \`plugin/\` (\`npm run build:claude\`).

Installieren in Claude Code:

\`\`\`
/plugin install prokit --marketplace NBFinn/prokit
\`\`\`

- **Code Pro:** C# als Standardsprache, Senior-Engineer-Ablauf, Token-Sparwerkzeuge (map, outline, run, diff-outline, lint-cs, secrets), Projektgedächtnis in \`CLAUDE.md\`.
- **Design Pro:** Farb- und Kontrastrechner als Skript (nur auf Aufruf).
- **3D Pro:** druckgerechte Konstruktion, Mesh-Prüfung (Dichtheit, Wandstärke, Überhänge) und PNG-Vorschau.
- **Token-Bilanz:** Am Ende jeder Antwort meldet der Stop-Hook den gemessenen Verbrauch, die Plugin-Kosten und die Ersparnis der Werkzeuge.

Benötigt Node.js ≥ 20.
`);
  return target;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const target = buildClaude(process.argv[2]);
  console.log(`${target} gebaut`);
  if (!process.argv[2]) {
    writeFileSync(PLUGIN_FILE, zipDirectory(target));
    console.log(`${PLUGIN_FILE} gepackt`);
  }
}
