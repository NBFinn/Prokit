// Bündelt die Design-Berechnungen (design-server/src) als Skript in plugin/skills/design-pro/scripts/design.mjs,
// damit das Plugin ohne npm install läuft.
// Aufruf: npm run build:design

import { build } from "esbuild";

const root = new URL("../", import.meta.url);

await build({
  entryPoints: [new URL("design-server/src/cli.js", root).pathname],
  outfile: new URL("plugin/skills/design-pro/scripts/design.mjs", root).pathname,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  minify: true,
  legalComments: "none",
  banner: { js: "// Erzeugt aus design-server/src (npm run build:design), nicht von Hand ändern." },
});

console.log("plugin/skills/design-pro/scripts/design.mjs gebaut");
