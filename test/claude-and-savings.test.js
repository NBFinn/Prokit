import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { PLUGIN_FILE, buildClaude } from "../scripts/build-claude.js";
import { zipDirectory } from "../scripts/zip.js";

const repo = fileURLToPath(new URL("../", import.meta.url));
const hosts = { codex: join(repo, "plugin"), claude: join(repo, "dist/claude/prokit") };

const tree = (dir) => {
  const out = new Map();
  const walk = (d) => {
    for (const e of readdirSync(d)) {
      const f = join(d, e);
      if (statSync(f).isDirectory()) walk(f);
      else out.set(relative(dir, f), readFileSync(f).toString("base64"));
    }
  };
  walk(dir);
  return out;
};

test("ProKit für Claude und prokit.plugin sind aktuell (sonst: npm run build)", () => {
  const fresh = tree(buildClaude(mkdtempSync(join(tmpdir(), "claude-op-"))));
  const committed = tree(hosts.claude);
  assert.deepEqual([...committed.keys()].sort(), [...fresh.keys()].sort());
  for (const [f, c] of fresh) assert.equal(committed.get(f), c, f);
  assert.ok(zipDirectory(hosts.claude).equals(readFileSync(PLUGIN_FILE)), "dist/prokit.plugin ist veraltet");
});

test("ProKit für Claude: Manifest, Hooks mit CLAUDE_PLUGIN_ROOT, CLAUDE.md statt AGENTS.md", () => {
  const p = hosts.claude;
  const m = JSON.parse(readFileSync(join(p, ".claude-plugin/plugin.json"), "utf8"));
  assert.equal(m.name, "prokit");
  assert.ok(!("$schema" in m), "$schema bricht die Synchronisierung in der Claude-App");
  const hooks = JSON.parse(readFileSync(join(p, "hooks/hooks.json"), "utf8")).hooks;
  assert.deepEqual(Object.keys(hooks).sort(), ["SessionStart", "Stop"]);
  for (const h of [...hooks.SessionStart, ...hooks.Stop]) assert.match(h.hooks[0].command, /\$\{CLAUDE_PLUGIN_ROOT\}/);
  assert.ok(!existsSync(join(p, ".mcp.json")), "kein MCP-Server: seine Werkzeugbeschreibungen kosten in jedem Aufruf Tokens");
  const skill = readFileSync(join(p, "skills/code-pro/SKILL.md"), "utf8");
  assert.ok(skill.includes("`CLAUDE.md`") && !skill.includes("`AGENTS.md`"));
  assert.match(readFileSync(join(p, "skills/code-pro/scripts/agents-md.mjs"), "utf8"), /MEMORY_FILE = "CLAUDE\.md"/);
  const market = JSON.parse(readFileSync(join(repo, ".claude-plugin/marketplace.json"), "utf8"));
  assert.equal(market.plugins[0].source, "./dist/claude/prokit");
  assert.equal(market.name, "nbfinn-prokit");
});

// Sitzungsprotokolle wie sie Codex (token_count) und Claude Code (assistant.usage) schreiben.
const transcripts = {
  codex: (calls, skillText) => [
    ...(skillText ? [{ timestamp: new Date(calls[0].at - 1).toISOString(), type: "response_item", payload: { type: "function_call_output", output: skillText } }] : []),
    ...calls.map((c, i) => ({ timestamp: new Date(c.at).toISOString(), type: "event_msg", payload: { type: "token_count", info: { total_token_usage: { total_tokens: i + 1 }, last_token_usage: { input_tokens: c.input, cached_input_tokens: 0, output_tokens: c.output } } } })),
  ],
  claude: (calls, skillText) => [
    ...(skillText ? [{ timestamp: new Date(calls[0].at - 1).toISOString(), type: "user", message: { content: skillText } }] : []),
    // Claude Code schreibt eine Antwort in mehreren Zeilen mit gleicher message.id und gleicher usage
    ...calls.flatMap((c, i) => [0, 1].map(() => ({ timestamp: new Date(c.at).toISOString(), type: "assistant", message: { id: `m${i}`, usage: { input_tokens: c.input, cache_read_input_tokens: 0, output_tokens: c.output } } }))),
  ],
};

for (const [host, root] of Object.entries(hosts)) {
  test(`${host}: Stop meldet gemessenen Verbrauch, Plugin-Kosten und Ersparnis ehrlich`, () => {
    const home = mkdtempSync(join(tmpdir(), "savings-"));
    const work = mkdtempSync(join(tmpdir(), "work-"));
    const big = Array.from({ length: 400 }, (_, i) => (i % 40 === 0 ? `public sealed class C${i}\n{` : `    // Zeile ${i} mit etwas Inhalt, der ohne Outline gelesen werden müsste`)).join("\n");
    writeFileSync(join(work, "Big.cs"), big);
    const env = { ...process.env, CODE_PRO_HOME: home, CLAUDE_PLUGIN_ROOT: root, PLUGIN_ROOT: root };
    const hook = (name, payload) => execFileSync("node", [join(root, "hooks", name)], { env, cwd: work, input: JSON.stringify(payload), encoding: "utf8" });
    const stop = (id, calls, skillText) => {
      const path = join(work, `${id}.jsonl`);
      if (calls) writeFileSync(path, transcripts[host](calls, skillText).map((l) => JSON.stringify(l)).join("\n") + "\n");
      return JSON.parse(hook("stop.mjs", { session_id: id, cwd: work, hook_event_name: "Stop", ...(calls ? { transcript_path: path } : {}) })).systemMessage;
    };
    const later = (n) => Array.from({ length: n }, (_, i) => ({ at: Date.now() + 1000 + i, input: 10_000, output: 200 }));

    // Werkzeug genutzt, danach 3 Modellaufrufe: Ersparnis zählt je folgendem Aufruf
    hook("session-start.mjs", { session_id: `a-${host}`, cwd: work, hook_event_name: "SessionStart" });
    execFileSync("node", [join(root, "skills/code-pro/scripts/outline.mjs"), "Big.cs"], { env, cwd: work });
    const a = stop(`a-${host}`, later(3));
    assert.match(a, /^Token-Bilanz \(gemessen\): diese Antwort 30\.600 Tokens in 3 Modellaufrufen · Sitzung 30\.600 in 3/);
    assert.match(a, /ProKit-Kontext ca\. [\d.]+, Werkzeuge sparten ca\. [1-9][\d.]+ → netto ca\. [\d.]+ gespart/);

    // Ohne Werkzeuge, aber mit geladenem Skill: ehrlich als Mehrverbrauch ausweisen
    hook("session-start.mjs", { session_id: `b-${host}`, cwd: work, hook_event_name: "SessionStart" });
    const b = stop(`b-${host}`, later(5), "# Code Pro\n\nJeder Modellaufruf …");
    assert.match(b, /Werkzeuge sparten ca\. 0 → netto ca\. [1-9][\d.]+ Mehrverbrauch durch ProKit/);
    const withSkill = Number(b.match(/ProKit-Kontext ca\. ([\d.]+)/)[1].replaceAll(".", ""));
    hook("session-start.mjs", { session_id: `c-${host}`, cwd: work, hook_event_name: "SessionStart" });
    const c = stop(`c-${host}`, later(5));
    assert.ok(withSkill > Number(c.match(/ProKit-Kontext ca\. ([\d.]+)/)[1].replaceAll(".", "")), "geladener Skill zählt als Kosten");

    // Ohne Sitzungsprotokoll: Schätzung, als solche gekennzeichnet
    assert.match(stop(`a-${host}`), /^Token-Bilanz \(geschätzt\): diese Antwort keine messbare Einsparung/);

    const overview = execFileSync("node", [join(root, "skills/code-pro/scripts/savings.mjs")], { env, encoding: "utf8" });
    assert.match(overview, /outline: 1×/);
  });
}

test("Stop-Hook ist robust: kaputte Eingabe, keine Sitzung", () => {
  const root = hosts.claude;
  const env = { ...process.env, CODE_PRO_HOME: mkdtempSync(join(tmpdir(), "savings-")) };
  for (const input of ["", "kein json", "{}"]) {
    const r = spawnSync("node", [join(root, "hooks/stop.mjs")], { env, input, encoding: "utf8" });
    assert.equal(r.status, 0);
    assert.equal(r.stdout, "");
  }
});

test("savings --analyze schlüsselt Modellaufrufe auf und markiert ProKit-Schritte", () => {
  const dir = mkdtempSync(join(tmpdir(), "analyze-"));
  const file = join(dir, "rollout.jsonl");
  const tc = (n, input) => ({ type: "event_msg", payload: { type: "token_count", info: { total_token_usage: { total_tokens: n }, last_token_usage: { input_tokens: input, cached_input_tokens: 0, output_tokens: 10 } } } });
  const call = (cmd) => ({ type: "response_item", payload: { type: "function_call", name: "shell", arguments: JSON.stringify({ command: ["bash", "-lc", cmd] }) } });
  writeFileSync(file, [tc(1, 1000), call("cat /p/skills/design-pro/SKILL.md"), tc(2, 1500), tc(2, 1500), call("rg Brush"), tc(3, 2000)].map((l) => JSON.stringify(l)).join("\n"));
  const out = execFileSync("node", [join(hosts.codex, "skills/code-pro/scripts/savings.mjs"), "--analyze", file], { encoding: "utf8" });
  assert.match(out, /^3 Modellaufrufe, 4\.530 Tokens/);
  assert.match(out, /★ shell: cat \/p\/skills\/design-pro\/SKILL\.md/);
  assert.match(out, /· shell: rg Brush/);
});

test("Code Pro und Design Pro laden nur auf ausdrücklichen Aufruf (jeder Skill-Ladevorgang kostet einen Modellaufruf)", () => {
  for (const s of ["code-pro", "design-pro"]) {
    assert.match(readFileSync(join(hosts.codex, `skills/${s}/agents/openai.yaml`), "utf8"), /allow_implicit_invocation: false/);
    assert.match(readFileSync(join(hosts.claude, `skills/${s}/SKILL.md`), "utf8"), /^disable-model-invocation: true$/m);
  }
});
