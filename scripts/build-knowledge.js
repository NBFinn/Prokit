// Erzeugt plugin/skills/design-pro/references/02-tokens.md aus den Design-Tools, damit die Werte im Wissen exakt stimmen.
// Aufruf: npm run build:knowledge

import { writeFileSync } from "node:fs";
import * as d from "../design-server/src/design.js";

const palette = (name, base) => {
  const p = d.generatePalette({ base, name });
  return (
    `### ${name} (Basis ${p.base})\n\n| Stufe | Hex | Kontrast auf Weiß | Text auf Weiß ok |\n|---|---|---|---|\n` +
    p.scale.map((s) => `| ${s.step} | \`${s.hex}\` | ${s.contrast_on_white}:1 | ${s.text_safe_on_white ? "ja" : "nein"} |`).join("\n")
  );
};
const type = d.generateTypeScale({});
const spacing = d.generateSpacingScale({ base: 4 });
const tokens = d.generateDesignTokens({ brand: "#2563eb" });

let out = `# 02 – Geprüfte Design-Tokens\n\nAlle Werte wurden mit den Design-Pro-Tools berechnet (OKLCH-Skalen, WCAG-Kontrast). Nutze sie, wenn die Tools nicht erreichbar sind.\n\n## Farbskalen\n\n`;
for (const [n, b] of [["blue", "#2563eb"], ["violet", "#7c3aed"], ["emerald", "#059669"], ["rose", "#e11d48"], ["amber", "#d97706"], ["slate", "#64748b"]])
  out += palette(n, b) + "\n\n";
out += `Faustregeln: Text auf Weiß ab Stufe 600 (meist), Text auf Dunkel bis Stufe 300. Flächen-Hintergründe 50–100, Rahmen 200–300, Buttons 600, Hover 700.\n\n`;
out +=
  `## Typografie-Skala (16px, Major Third 1.25, fluid 360→1280px)\n\n| Name | Desktop px | Mobile px | CSS | line-height | letter-spacing |\n|---|---|---|---|---|---|\n` +
  type.sizes.map((s) => `| ${s.name} | ${s.px} | ${s.mobile_px} | \`${s.fluid}\` | ${s.line_height} | ${s.letter_spacing} |`).join("\n") +
  "\n\n";
out += `Weitere Ratios: 1.125 (dichte Apps, Dashboards), 1.2 (Produkt-UI), 1.25 (Allround), 1.333 (Marketing), 1.5+ (editorial, große Headlines).\n\n`;
out +=
  `## Abstände (4px-Raster)\n\n` +
  spacing.scale.map((s) => `\`${s.px}px\``).join(" · ") +
  `\n\nTypisch: Icon↔Text 8 · Button-Padding 10×16 · Input-Höhe 40 · Karten-Padding 24 · Abstand Elemente in Karte 12–16 · zwischen Karten 24 · zwischen Sektionen 96–128 (Desktop) / 64 (Mobile).\n\n`;
out += `## Radius, Schatten, Motion\n\n- Radius: 0 (brutalistisch/editorial) · 4–6 (technisch, dicht) · 8 (Standard) · 12–16 (freundlich, Consumer) · 9999 (Pills, Avatare). Verschachtelt: innerer Radius = äußerer − Padding.\n`;
out += `- Schatten sm: \`${tokens.shared["shadow-sm"]}\`\n- Schatten md: \`${tokens.shared.shadow}\`\n- Schatten lg: \`${tokens.shared["shadow-lg"]}\`\n- Easing: \`${tokens.shared["ease-out"]}\` · Dauer 120ms (Hover) / 200ms (Panels) / 300ms (Modals)\n\n`;
out += `## Beispiel: komplettes Token-Set (Marke #2563eb)\n\nKontrastprüfung: ${tokens.contrast_checks.map((c) => `${c.pair} ${c.ratio}:1`).join(" · ")}\n\n\`\`\`css\n${tokens.output}\n\`\`\`\n`;

writeFileSync(new URL("../plugin/skills/design-pro/references/02-tokens.md", import.meta.url), out);
console.log("plugin/skills/design-pro/references/02-tokens.md geschrieben");
