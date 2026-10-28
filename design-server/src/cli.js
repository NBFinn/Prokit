// Kommandozeile für die exakten Design-Berechnungen. Ersetzt den früheren MCP-Server: ein Skript kostet nur
// Tokens, wenn es aufgerufen wird, MCP-Werkzeugbeschreibungen dagegen in jedem Modellaufruf.
// Aufruf: node design.mjs <befehl> …   (ohne Befehl: Hilfe)

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { auditCss, checkContrast, generateDesignTokens, generateHarmony, generatePalette, generateSpacingScale, generateTypeScale } from "./design.js";

const HELP = `node design.mjs contrast <vorne> <hinten> [<vorne> <hinten> …]  WCAG-Kontrast, mehrere Paare in einem Aufruf, bei Fehler Vorschlag
node design.mjs palette <hex>                            Skala 50–950 (Hover, Rahmen, Hintergründe)
node design.mjs harmony <hex> [complementary|analogous|triadic|split_complementary|tetradic]
node design.mjs type [basis-px] [verhältnis]             Typo-Skala mit clamp()
node design.mjs spacing [basis-px]                       Abstands-Skala
node design.mjs tokens <markenfarbe> [css|tailwind|json] Token-Set Light/Dark, kontrastgeprüft
node design.mjs audit <datei.css>                        CSS-Audit (Kontrast, Raster, Fokus, Motion)`;

const num = (v) => (v === undefined ? undefined : Number.isNaN(Number(v)) ? v : Number(v));

export function runCli([cmd, a, b, ...rest]) {
  switch (cmd) {
    case "contrast": {
      // Alle Paare in einem Aufruf: jede weitere Runde schickt den ganzen Kontext des Agenten erneut.
      const colors = [a, b, ...rest];
      if (colors.length < 2 || colors.length % 2) throw new Error("contrast braucht Paare: <vorne> <hinten> [<vorne> <hinten> …]");
      const lines = [];
      for (let i = 0; i < colors.length; i += 2) {
        const r = checkContrast({ foreground: colors[i], background: colors[i + 1] });
        const grade = r.ratio >= 7 ? "AAA" : r.ratio >= 4.5 ? "AA" : r.ratio >= 3 ? "nur groß/UI" : "ungenügend";
        lines.push(`${r.foreground} auf ${r.background}: ${r.ratio}:1 ${grade}` + (r.suggestion ? ` → Vorschlag ${r.suggestion.hex} (${r.suggestion.ratio}:1)` : ""));
      }
      return lines.join("\n");
    }
    case "palette": return generatePalette({ base: a }).scale.map((s) => `${s.step} ${s.hex}`).join("\n");
    case "harmony": return JSON.stringify(generateHarmony({ base: a, scheme: b }));
    case "type": return generateTypeScale({ base: num(a), ratio: num(b) }).sizes.map((s) => `${s.name} ${s.px}px ${s.fluid ?? ""}`.trim()).join("\n");
    case "spacing": return JSON.stringify(generateSpacingScale({ base: num(a) }));
    case "tokens": return generateDesignTokens({ brand: a, format: b }).output;
    case "audit": {
      const r = auditCss({ css: readFileSync(a, "utf8") });
      return [`Score ${r.score}/100`, ...r.issues.map((i) => `- ${i.rule}: ${i.message ?? ""}`)].join("\n");
    }
    default: return HELP;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    console.log(runCli(process.argv.slice(2)));
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
