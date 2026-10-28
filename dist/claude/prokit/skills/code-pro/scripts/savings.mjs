#!/usr/bin/env node
// Token-Bilanz: Werkzeuge protokollieren, wie groß die Ausgabe ohne sie gewesen wäre (raw) und wie groß sie
// mit ihnen war (out). Der Stop-Hook stellt das dem gemessenen Verbrauch und den Plugin-Kosten gegenüber.
// Plugin-Kosten und Einsparungen: ca. 4 Zeichen pro Token.
//
//   node savings.mjs            Übersicht: heute, 7 Tage, gesamt, je Werkzeug
//   node savings.mjs --reset    Protokoll löschen
//   node savings.mjs --analyze <sitzungsprotokoll.jsonl>   Aufrufe einer Sitzung aufschlüsseln
//        Codex: %USERPROFILE%\\.codex\\sessions\\JJJJ\\MM\\TT\\rollout-….jsonl · Claude Code: ~/.claude/projects/…/<id>.jsonl

import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const DIR = process.env.CODE_PRO_HOME || join(homedir(), ".code-pro");
const LEDGER = join(DIR, "savings.jsonl");
const SESSIONS = join(DIR, "sessions");
export const CHARS_PER_TOKEN = 4;
export const tokens = (chars) => Math.round(chars / CHARS_PER_TOKEN);
const fmt = (n) => n.toLocaleString("de-DE");

// Darf nie einen Werkzeugaufruf stören: Fehler beim Protokollieren werden verschluckt.
export function record(tool, rawChars, outChars, cwd = process.cwd()) {
  try {
    if (!(rawChars > outChars)) return;
    mkdirSync(DIR, { recursive: true });
    appendFileSync(LEDGER, JSON.stringify({ ts: Date.now(), tool, raw: Math.round(rawChars), out: Math.round(outChars), cwd: resolve(cwd) }) + "\n");
  } catch {}
}

function entries() {
  if (!existsSync(LEDGER)) return [];
  return readFileSync(LEDGER, "utf8").split("\n").filter(Boolean).flatMap((l) => { try { return [JSON.parse(l)]; } catch { return []; } });
}

const within = (entryCwd, sessionCwd) => {
  if (!sessionCwd) return true;
  const a = resolve(entryCwd).toLowerCase();
  const b = resolve(sessionCwd).toLowerCase();
  return a === b || a.startsWith(b + "/") || a.startsWith(b + "\\");
};

const sessionFile = (id) => join(SESSIONS, `${String(id).replace(/[^\w.-]/g, "_")}.json`);

// Feste Kosten je Sitzung: Name + Beschreibung jedes Skills stehen immer im Kontext.
export function skillDescriptionChars(skillsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..")) {
  let chars = 0;
  try {
    for (const d of readdirSync(skillsDir)) {
      const md = readFileSync(join(skillsDir, d, "SKILL.md"), "utf8");
      const front = md.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
      chars += (front.match(/^name:\s*(.+)$/m)?.[1].length ?? 0) + (front.match(/^description:\s*(.+)$/m)?.[1].length ?? 0) + 20;
    }
  } catch {}
  return chars;
}

// Lebenszeichen der Hooks: zeigt in doctor.mjs, ob und wann Codex/Claude sie zuletzt ausgeführt hat.
export function heartbeat(hook) {
  try {
    mkdirSync(DIR, { recursive: true });
    const file = join(DIR, "hooks.json");
    let data = {};
    try { data = JSON.parse(readFileSync(file, "utf8")); } catch {}
    data[hook] = new Date().toISOString();
    writeFileSync(file, JSON.stringify(data, null, 2));
  } catch {}
}

export function lastHeartbeats() {
  try { return JSON.parse(readFileSync(join(DIR, "hooks.json"), "utf8")); } catch { return {}; }
}

// Sitzungsstart: Zeitpunkt und die Größe des eingespielten Plugin-Kontexts (Kosten) merken.
export function startSession(id, cwd, hookChars) {
  try {
    mkdirSync(SESSIONS, { recursive: true });
    const now = Date.now();
    writeFileSync(sessionFile(id), JSON.stringify({ start: now, last: now, cwd: cwd ? resolve(cwd) : null, cost: hookChars + skillDescriptionChars() }));
    // alte Sitzungen und Protokolleinträge (> 30 Tage) aufräumen
    const cutoff = now - 30 * 864e5;
    const keep = entries().filter((e) => e.ts >= cutoff);
    if (existsSync(LEDGER) && keep.length < entries().length) writeFileSync(LEDGER, keep.map((e) => JSON.stringify(e)).join("\n") + (keep.length ? "\n" : ""));
  } catch {}
}

const summarize = (list) => {
  const byTool = new Map();
  let saved = 0;
  for (const e of list) {
    const s = e.raw - e.out;
    saved += s;
    const t = byTool.get(e.tool) ?? { n: 0, saved: 0 };
    t.n++;
    t.saved += s;
    byTool.set(e.tool, t);
  }
  return { saved, byTool };
};

// Gemessener Verbrauch aus dem Sitzungsprotokoll des Hosts (transcript_path im Hook-Input).
// Codex: event_msg/token_count mit last_token_usage je Modellaufruf. Claude Code: assistant-Zeilen mit
// message.usage (mehrere Zeilen je Antwort möglich, daher nach message.id entdoppelt).
// Dazu, wann ein ProKit-Skill geladen wurde: sein Text steckt ab dann in jedem weiteren Aufruf.
const SKILL_MARKERS = { "code-pro": "# Code Pro\\n", "design-pro": "# Design Pro\\n", "3d-pro": "# 3D Pro\\n" };

export function readTranscript(path) {
  const calls = [];
  const loads = {};
  let text;
  try { text = readFileSync(path, "utf8"); } catch { return null; }
  const seen = new Set();
  let lastTotal = null;
  for (const line of text.split("\n")) {
    if (!line) continue;
    let o;
    try { o = JSON.parse(line); } catch { continue; }
    const ts = Date.parse(o.timestamp ?? "") || 0;
    const info = o.type === "event_msg" && o.payload?.type === "token_count" ? o.payload.info : null;
    if (info?.last_token_usage) {
      const key = JSON.stringify(info.total_token_usage ?? null);
      if (key !== lastTotal) {
        lastTotal = key;
        const u = info.last_token_usage;
        calls.push({ ts, input: u.input_tokens ?? 0, cached: u.cached_input_tokens ?? 0, output: u.output_tokens ?? 0 });
      }
      continue;
    }
    const u = o.type === "assistant" ? o.message?.usage : null;
    if (u) {
      const id = o.message.id ?? o.uuid;
      if (seen.has(id)) continue;
      seen.add(id);
      const cached = u.cache_read_input_tokens ?? 0;
      calls.push({ ts, input: (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + cached, cached, output: u.output_tokens ?? 0 });
      continue;
    }
    if (o.type === "assistant" || o.payload?.role === "assistant") continue;
    for (const [skill, marker] of Object.entries(SKILL_MARKERS)) if (!(skill in loads) && line.includes(marker)) loads[skill] = ts;
  }
  return { calls, loads };
}

const skillsDir = () => join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const skillChars = (skill) => { try { return readFileSync(join(skillsDir(), skill, "SKILL.md"), "utf8").length; } catch { return 0; } };

// Bilanz seit der letzten Meldung dieser Sitzung (= diese Antwort) und seit Sitzungsbeginn.
// Mit Sitzungsprotokoll: echte Tokenzahlen, und Kosten wie Ersparnis werden je folgendem Modellaufruf gezählt,
// denn was einmal im Kontext steht (Plugin-Regeln, geladener Skill, eingesparte Dateiinhalte), wird bei jedem
// weiteren Aufruf erneut gesendet.
export function turnReport(id, cwd, transcriptPath) {
  let session = null;
  try { session = JSON.parse(readFileSync(sessionFile(id), "utf8")); } catch {}
  const now = Date.now();
  const start = session?.start ?? now - 6 * 3600e3;
  const last = session?.last ?? start;
  const where = cwd ?? session?.cwd;
  const all = entries().filter((e) => e.ts >= start && within(e.cwd, where));
  const turn = summarize(all.filter((e) => e.ts > last));
  const total = summarize(all);
  const fixed = session?.cost ?? 0;
  try { mkdirSync(SESSIONS, { recursive: true }); writeFileSync(sessionFile(id), JSON.stringify({ ...(session ?? { start, cwd: where }), cost: fixed, last: now })); } catch {}

  const t = transcriptPath ? readTranscript(transcriptPath) : null;
  if (t?.calls.length) {
    const { calls, loads } = t;
    const after = (ts) => calls.filter((c) => c.ts > ts).length;
    const loaded = Object.entries(loads).map(([skill, ts]) => ({ chars: skillChars(skill), n: after(ts) }));
    const cost = tokens(fixed * calls.length + loaded.reduce((s, l) => s + l.chars * l.n, 0));
    const saved = tokens(all.reduce((s, e) => s + (e.raw - e.out) * Math.max(1, after(e.ts)), 0));
    const used = calls.reduce((s, c) => s + c.input + c.output, 0);
    const turnCalls = calls.filter((c) => c.ts > last);
    const turnUsed = turnCalls.reduce((s, c) => s + c.input + c.output, 0);
    const net = saved - cost;
    const verdict = net >= 0 ? `netto ca. ${fmt(net)} gespart` : `netto ca. ${fmt(-net)} Mehrverbrauch durch ProKit`;
    return `Token-Bilanz (gemessen): diese Antwort ${fmt(turnUsed)} Tokens in ${turnCalls.length} Modellaufrufen · Sitzung ${fmt(used)} in ${calls.length} · ProKit-Kontext ca. ${fmt(cost)}, Werkzeuge sparten ca. ${fmt(saved)} → ${verdict}.`;
  }

  // Ohne Sitzungsprotokoll: nur die Werkzeug-Einsparung gegen die einmaligen Plugin-Kosten (Schätzung).
  const thisTurn = turn.saved > 0
    ? `diese Antwort ca. ${fmt(tokens(turn.saved))} Tokens gespart (${[...turn.byTool].sort((a, b) => b[1].saved - a[1].saved).map(([t, v]) => `${t} ${v.n}×`).join(", ")})`
    : "diese Antwort keine messbare Einsparung (keine ProKit-Werkzeuge genutzt)";
  return `Token-Bilanz (geschätzt): ${thisTurn} · Sitzung: ${fmt(tokens(total.saved))} gespart − ${fmt(tokens(fixed))} Plugin-Kosten je Modellaufruf, Zahl der Aufrufe unbekannt.`;
}

// Aufschlüsselung eines Sitzungsprotokolls: je Modellaufruf die Größe und welche Werkzeugaufrufe ihn ausgelöst
// haben. Zeigt, woher ein Mehrverbrauch kommt (z. B. zusätzliche Schritte). ★ = Schritt betrifft ProKit.
const PROKIT = /skills[\\/](code|design|3d)-pro|SKILL\.md/i;
const short = (t) => String(t).replace(/\s+/g, " ").slice(0, 110);

function describe(o) {
  const p = o.payload ?? {};
  if (o.type === "response_item") {
    if (p.type === "function_call") {
      let args = p.arguments;
      try { const j = JSON.parse(args); args = Array.isArray(j.command) ? j.command.at(-1) : j.command ?? j.cmd ?? args; } catch {}
      return `${p.name}: ${short(args)}`;
    }
    if (p.type === "custom_tool_call") return `${p.name}: ${short(p.input)}`;
    if (p.type === "local_shell_call") return `shell: ${short([].concat(p.action?.command ?? []).at(-1))}`;
  }
  if (o.type === "assistant") {
    return (o.message?.content ?? []).filter((c) => c.type === "tool_use").map((c) => `${c.name}: ${short(c.input?.command ?? c.input?.file_path ?? c.input?.skill ?? JSON.stringify(c.input))}`).join(" | ") || null;
  }
  return null;
}

export function analyze(path) {
  const text = readFileSync(path, "utf8");
  const rows = [];
  let pending = [];
  const seen = new Set();
  let lastTotal = null;
  for (const line of text.split("\n")) {
    if (!line) continue;
    let o;
    try { o = JSON.parse(line); } catch { continue; }
    // Codex: Werkzeugaufrufe einer Antwort stehen vor ihrem token_count
    const info = o.type === "event_msg" && o.payload?.type === "token_count" ? o.payload.info : null;
    if (info?.last_token_usage) {
      const key = JSON.stringify(info.total_token_usage ?? null);
      if (key === lastTotal) continue;
      lastTotal = key;
      const u = info.last_token_usage;
      rows.push({ input: u.input_tokens ?? 0, cached: u.cached_input_tokens ?? 0, output: u.output_tokens ?? 0, tools: pending });
      pending = [];
      continue;
    }
    const d = describe(o);
    // Claude Code: Werkzeugaufrufe stehen in der Antwort selbst (mehrere Zeilen mit gleicher message.id)
    if (o.type === "assistant" && o.message?.usage) {
      const id = o.message.id ?? o.uuid;
      if (!seen.has(id)) {
        seen.add(id);
        const u = o.message.usage;
        const cached = u.cache_read_input_tokens ?? 0;
        rows.push({ input: (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + cached, cached, output: u.output_tokens ?? 0, tools: [] });
      }
      if (d) rows.at(-1).tools.push(d);
      continue;
    }
    if (d) pending.push(d);
  }
  const total = rows.reduce((s, r) => s + r.input + r.output, 0);
  const out = [`${rows.length} Modellaufrufe, ${fmt(total)} Tokens gesamt (★ = ProKit beteiligt; → = in diesem Aufruf angestoßen)`];
  rows.forEach((r, i) => {
    out.push(`#${i + 1} Eingabe ${fmt(r.input)} (Cache ${fmt(r.cached)}) Ausgabe ${fmt(r.output)}`);
    for (const a of r.tools) out.push(`  → ${PROKIT.test(a) ? "★" : "·"} ${a}`);
  });
  for (const a of pending) out.push(`  → ${PROKIT.test(a) ? "★" : "·"} ${a}`);
  return out.join("\n");
}

export function overview(now = Date.now()) {
  const all = entries();
  const span = (ms) => summarize(all.filter((e) => e.ts >= now - ms));
  const day = span(864e5);
  const week = span(7 * 864e5);
  const total = summarize(all);
  const lines = [
    `Token-Bilanz (ca. ${CHARS_PER_TOKEN} Zeichen/Token, nur gemessene Werkzeug-Einsparungen)`,
    `Heute: ${fmt(tokens(day.saved))} · 7 Tage: ${fmt(tokens(week.saved))} · gesamt (30 Tage): ${fmt(tokens(total.saved))} Tokens gespart`,
  ];
  for (const [t, v] of [...total.byTool].sort((a, b) => b[1].saved - a[1].saved)) lines.push(`- ${t}: ${v.n}× · ${fmt(tokens(v.saved))} Tokens`);
  return lines.join("\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const ai = process.argv.indexOf("--analyze");
  if (ai > 0) {
    console.log(analyze(process.argv[ai + 1]));
  } else if (process.argv.includes("--reset")) {
    rmSync(LEDGER, { force: true });
    console.log("Protokoll gelöscht.");
  } else {
    console.log(overview());
  }
}
