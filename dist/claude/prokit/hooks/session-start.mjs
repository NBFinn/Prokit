// SessionStart-Hook von ProKit: Codex/Claude übernehmen stdout als Kontext. Bewusst kurz, da er in jeder Sitzung
// Tokens kostet; die Details laden die Skills erst bei Bedarf.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Geschlossene Ausgabe (z. B. Host bricht ab) darf den Hook nicht abstürzen lassen.
process.stdout.on("error", () => {});

const scripts = fileURLToPath(new URL("../skills/code-pro/scripts/", import.meta.url));

// Eingabe des Hosts (Codex/Claude Code): JSON mit session_id und cwd auf stdin.
let input = {};
try { if (!process.stdin.isTTY) input = JSON.parse(readFileSync(0, "utf8") || "{}"); } catch {}

// Alles Ausgegebene mitzählen: das sind die Kosten des Plugins in dieser Sitzung.
let written = 0;
const write = process.stdout.write.bind(process.stdout);
process.stdout.write = (chunk, ...rest) => { written += String(chunk).length; return write(chunk, ...rest); };

process.stdout.write(`ProKit: Jede Runde schickt den ganzen Kontext erneut, darum Runden sparen: unabhängige Lese-, Such- und Testbefehle in EINEM Schritt bündeln; Änderung (Edit/Write) und zugehörigen Test im selben Schritt senden, keine eigene Prüfrunde; Dateien bis ca. 800 Zeilen direkt ganz lesen. Neues in C# (.NET 10), bestehende Projekte in ihrer Sprache.
node "${scripts}<name>.mjs": find <regex> [pfad] [-i] statt grep+lesen (Treffer samt ganzer Methode mit Zeilennummern, spart eine Runde) · api <Paket|Typ|Typ.Member> echte .NET-/NuGet-API (Signaturen+Doku, auch interne Pakete) statt XML/Quellen zu suchen oder zu raten · pkg search|versions <x> · outline <datei> nur für sehr große Dateien · run -- <befehl> für lange Ausgaben · secrets vor Commit
Neues Ergebnis zum Ansehen (Lösung, HTML-Seite, Bild, 3D-Modell): open <pfad> im selben Schritt wie das Schreiben bzw. den letzten Test senden, nie als eigene Runde; öffnet es beim Nutzer (.slnx/.sln in Visual Studio, HTML im Browser).
`);

// Projektsteckbrief: erspart die Erkundungsrunde am Anfang jeder Aufgabe. Darf den Start nie verhindern.
try {
  const { projectBrief } = await import(new URL("../skills/code-pro/scripts/brief.mjs", import.meta.url));
  const brief = projectBrief(input.cwd || process.cwd());
  if (brief) process.stdout.write(`${brief}\n`);
} catch {}

try {
  const { heartbeat, startSession } = await import(new URL("../skills/code-pro/scripts/savings.mjs", import.meta.url));
  heartbeat("sessionStart");
  if (input.session_id) startSession(input.session_id, input.cwd, written);
} catch {}
