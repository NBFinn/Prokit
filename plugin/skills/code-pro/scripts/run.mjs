#!/usr/bin/env node
// Führt einen Befehl aus und gibt eine verdichtete Ausgabe zurück: Fehler und Kontext bleiben,
// Fortschrittsbalken, Wiederholungen und Füllzeilen fallen weg. Exit-Code wird durchgereicht.
//
//   node run.mjs [--max 80] [--timeout 600] -- <befehl ...>

import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import { record } from "./savings.mjs";

const args = process.argv.slice(2);
const sep = args.indexOf("--");
const opts = sep === -1 ? [] : args.slice(0, sep);
const cmd = (sep === -1 ? args : args.slice(sep + 1)).join(" ");
const opt = (name, def) => {
  const i = opts.indexOf(`--${name}`);
  return i === -1 ? def : Number(opts[i + 1]);
};
const MAX = opt("max", 80);
const TIMEOUT = opt("timeout", 600) * 1000;

const IMPORTANT =
  /\bnot ok\b|\b(error|errors|fail(ed|ure|ing)?|panic|exception|traceback|assert(ion)?|expected|received|cannot|unable|undefined|not found|denied|fatal|warn(ing)?|segfault)\b|✗|✖|×|FAIL|ERR!|^\s*at\s|^\s*-->|^\s*\^+\s*$|:\d+:\d+/i;
const NOISE = /^\s*(\d+%|[\s=#>.\-|/\\]+$|npm (notice|fund)|added \d+ packages|up to date|audited \d+)/i;
// Stack-Frames aus Laufzeit und Test-Frameworks helfen nie bei der Fehlersuche im eigenen Code.
const FRAMEWORK_FRAME = /^\s*at (System\.|Microsoft\.|Xunit\.|NUnit\.|MSTest\.|.*\(node:internal|node:internal|.*node_modules[\\/])/;

export function condense(raw, max = MAX) {
  const lines = raw
    .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "")
    .split("\n")
    .map((l) => l.split("\r").filter(Boolean).pop() ?? "")
    .map((l) => l.trimEnd())
    .filter((l) => !NOISE.test(l) && !FRAMEWORK_FRAME.test(l));

  // Leerzeilen-Läufe und gleichartige Zeilen (bis auf Zahlen) zusammenfassen.
  const out = [];
  // Von jeder Reihe gleichartiger Zeilen bleiben die erste und die letzte erhalten.
  let prevKey = null;
  let repeat = 0;
  let lastSuppressed = null;
  const flush = () => {
    if (repeat > 1) out.push(`  … (+${repeat - 1} ähnliche Zeilen)`);
    if (repeat > 0 && lastSuppressed !== out.at(-1)) out.push(lastSuppressed);
    repeat = 0;
  };
  for (const l of lines) {
    const key = l.replace(/\d+/g, "#");
    if (key === prevKey && (l === "" || !IMPORTANT.test(l) || l === out.at(-1))) {
      if (l !== "") {
        repeat++;
        lastSuppressed = l;
      }
      continue;
    }
    flush();
    prevKey = key;
    out.push(l.length > 300 ? `${l.slice(0, 300)}…(+${l.length - 300})` : l);
  }
  flush();
  while (out.length && out[0] === "") out.shift();
  while (out.length && out.at(-1) === "") out.pop();
  if (out.length <= max) return { text: out.join("\n"), total: lines.length, shown: out.length };

  // Zu lang: Kopf, Ende und wichtige Zeilen mit Kontext behalten.
  const keep = new Set();
  const head = Math.min(8, Math.floor(max * 0.1));
  const tail = Math.floor(max * 0.3);
  for (let i = 0; i < head; i++) keep.add(i);
  for (let i = out.length - tail; i < out.length; i++) keep.add(i);
  for (let i = 0; i < out.length && keep.size < max; i++) {
    if (IMPORTANT.test(out[i])) for (let j = i - 1; j <= i + 2 && keep.size < max; j++) if (j >= 0 && j < out.length) keep.add(j);
  }
  const sorted = [...keep].sort((a, b) => a - b);
  const result = [];
  let last = -1;
  for (const i of sorted) {
    if (i > last + 1) result.push(`  … [${i - last - 1} Zeilen ausgelassen]`);
    result.push(out[i]);
    last = i;
  }
  if (last < out.length - 1) result.push(`  … [${out.length - 1 - last} Zeilen ausgelassen]`);
  return { text: result.join("\n"), total: lines.length, shown: sorted.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!cmd) {
    console.error("Aufruf: node run.mjs [--max N] [--timeout SEK] -- <befehl>");
    process.exit(2);
  }
  const started = Date.now();
  const child = spawn(cmd, { shell: true, env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1", CI: process.env.CI ?? "1" } });
  const chunks = [];
  child.stdout.on("data", (c) => chunks.push(c));
  child.stderr.on("data", (c) => chunks.push(c));
  const timer = setTimeout(() => child.kill("SIGTERM"), TIMEOUT);
  child.on("close", (code, signal) => {
    clearTimeout(timer);
    const raw = Buffer.concat(chunks).toString("utf8");
    const { text, total, shown } = condense(raw);
    const status = signal ? `abgebrochen (${signal})` : `exit=${code}`;
    const footer = `── ${status} · ${total}→${shown} Zeilen · ${((Date.now() - started) / 1000).toFixed(1)}s`;
    if (text) console.log(text);
    console.log(footer);
    record("run", raw.length, text.length + footer.length);
    process.exit(code ?? 1);
  });
}
