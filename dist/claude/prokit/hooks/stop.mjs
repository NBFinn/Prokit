// Stop-Hook: meldet am Ende einer Antwort den gemessenen Verbrauch, die Plugin-Kosten und die Ersparnis.
// Ausgabe als {"systemMessage": …}, das zeigt der Host (Codex/Claude Code) dem Nutzer an. Blockiert nie.

import { readFileSync } from "node:fs";

// Geschlossene Ausgabe (z. B. Host bricht ab) darf den Hook nicht abstürzen lassen.
process.stdout.on("error", () => {});

try {
  const input = process.stdin.isTTY ? {} : JSON.parse(readFileSync(0, "utf8") || "{}");
  const { heartbeat, turnReport } = await import(new URL("../skills/code-pro/scripts/savings.mjs", import.meta.url));
  heartbeat("stop");
  if (input.session_id) {
    const message = turnReport(input.session_id, input.cwd, input.transcript_path);
    if (message) process.stdout.write(JSON.stringify({ systemMessage: message }));
  }
} catch {}
