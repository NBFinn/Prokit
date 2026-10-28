import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repo = fileURLToPath(new URL("../", import.meta.url));
const bundle = join(repo, "plugin");
const scripts = join(bundle, "skills/code-pro/scripts");
const load = (name) => import(pathToFileURL(join(scripts, name)).href);

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

test("Codex-Plugin: Manifest, Marketplace, ein Start-Hook mit Code- und Design-Kontext", () => {
  const op = bundle;
  const m = JSON.parse(readFileSync(join(op, ".codex-plugin/plugin.json"), "utf8"));
  for (const k of ["skills", "hooks"]) assert.ok(existsSync(join(op, m[k])), k);
  assert.deepEqual(readdirSync(join(op, "skills")).sort(), ["3d-pro", "code-pro", "design-pro"]);
  assert.equal(m.name, "prokit");
  const market = JSON.parse(readFileSync(join(repo, ".agents/plugins/marketplace.json"), "utf8"));
  assert.equal(market.name, "nbfinn-prokit");
  assert.deepEqual(market.plugins.map((x) => [x.name, x.source.path]), [["prokit", "./plugin"]]);
  assert.equal(m.version, JSON.parse(readFileSync(join(repo, "package.json"), "utf8")).version);
  assert.ok(m.interface.defaultPrompt.every((p) => p.length <= 128));
  // außerhalb eines Projekts: nur die Kurzregeln (der Projektsteckbrief hat einen eigenen Test)
  const out = execFileSync("node", [join(op, "hooks/session-start.mjs")], { encoding: "utf8", cwd: mkdtempSync(join(tmpdir(), "kein-projekt-")) });
  assert.match(out, /ProKit: Jede Runde schickt den ganzen Kontext erneut/);
  assert.ok(!/PROJEKT/.test(out));
  assert.ok(!/Design Pro ist aktiv|get_design_guide/.test(out), "keine allgemeinen Design-Regeln im Startkontext");
  assert.ok(out.includes(join(op, "skills/code-pro/scripts")));
  // Länge ohne Installationspfad prüfen (der ist je nach Rechner verschieden lang).
  const ownText = out.replaceAll(join(op, "skills/code-pro/scripts"), "").length;
  assert.ok(ownText < 1000, `Hook zu lang: ${ownText} Zeichen; er kostet in jeder Sitzung Tokens`);
});

test("secrets: findet echte Muster maskiert, ignoriert Code-Zuweisungen und Platzhalter", async () => {
  const { scanText } = await load("secrets.mjs");
  // Zur Laufzeit zusammengesetzt, damit diese Testdatei selbst keine Secrets enthält.
  const fake = {
    gh: "ghp_" + "a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8",
    aws: "AKIA" + "IOSFODNN7EXAMPLE",
    ant: "sk-ant-" + "api03-" + "x".repeat(40),
    key: "-----BEGIN " + "OPENSSH PRIVATE KEY-----",
  };
  const text = [
    `token = "${fake.gh}"`,
    `aws_key = ${fake.aws}`,
    `ANTHROPIC_API_KEY=${fake.ant}`,
    fake.key,
    `"Default": "Server=db;Database=app;User Id=sa;Password=Sup3rGeheim!;"`,
    `const apiKey = "AbCdEf123456789xyz";`,
    `options.Password = credentials[(colon + 1)..];`,
    `"Password": "\${DB_PASSWORD}"`,
    `api_key = "your-api-key-here"`,
    `Server=db;Password={0};`,
  ].join("\n");
  const ids = scanText(text).map((h) => `${h.line}:${h.id}`);
  assert.deepEqual(ids, ["1:github-token", "2:aws-access-key", "3:anthropic-key", "4:private-key", "5:connection-password", "6:hardcoded-secret"]);
  for (const h of scanText(text)) assert.ok(!text.includes(h.match) || h.match === "****", `nicht maskiert: ${h.match}`);
});

test("agents-md: erkennt .NET, Node im Unterordner und CI; merge erhält eigene Notizen", async () => {
  const { detect, render, merge } = await load("agents-md.mjs");
  const dir = mkdtempSync(join(tmpdir(), "agents-"));
  mkdirSync(join(dir, "src/App"), { recursive: true });
  mkdirSync(join(dir, "tests/App.Tests"), { recursive: true });
  mkdirSync(join(dir, "web"), { recursive: true });
  mkdirSync(join(dir, ".github/workflows"), { recursive: true });
  writeFileSync(join(dir, "App.slnx"), "<Solution />");
  writeFileSync(join(dir, "Directory.Build.props"), "<Project><PropertyGroup><TargetFramework>net10.0</TargetFramework><Nullable>enable</Nullable><TreatWarningsAsErrors>true</TreatWarningsAsErrors></PropertyGroup></Project>");
  writeFileSync(join(dir, "src/App/App.csproj"), "<Project Sdk=\"Microsoft.NET.Sdk\" />");
  writeFileSync(join(dir, "tests/App.Tests/App.Tests.csproj"), "<Project><ItemGroup><PackageReference Include=\"xunit.v3\" /></ItemGroup></Project>");
  writeFileSync(join(dir, "web/package.json"), JSON.stringify({ scripts: { build: "vite build", test: "vitest run", dev: "vite" } }));
  writeFileSync(join(dir, "web/pnpm-lock.yaml"), "");
  writeFileSync(join(dir, ".github/workflows/ci.yml"), "jobs:\n  b:\n    steps:\n      - run: dotnet test --nologo\n      - run: |\n          cd web\n          pnpm build\n");
  const section = render(detect(dir));
  for (const s of ["net10.0", "Lösung App.slnx", "dotnet build App.slnx", "dotnet test App.slnx", "tests/App.Tests/App.Tests.csproj", "Nullable aktiv", "Warnungen sind Fehler", "Node/JavaScript (pnpm) in `web/`", "`pnpm test` → `vitest run`", "ci.yml: `dotnet test --nologo`, `pnpm build`"]) {
    assert.ok(section.includes(s), `${s}\n${section}`);
  }
  const own = "# AGENTS.md\n\nEigene Regel: nie main pushen.\n";
  const once = merge(own, section);
  const twice = merge(once, section.replace("net10.0", "net11.0"));
  assert.ok(twice.includes("Eigene Regel: nie main pushen."));
  assert.equal(twice.split("code-pro:auto:start").length, 2, "Abschnitt doppelt");
  assert.ok(twice.includes("net11.0") && !twice.includes("net10.0"));
});

test("diff-outline: ordnet Änderungen Methoden zu und listet neue Dateien", async () => {
  const dir = mkdtempSync(join(tmpdir(), "diff-"));
  const g = (...a) => execFileSync("git", a, { cwd: dir, stdio: "ignore" });
  g("init", "-q");
  g("config", "user.email", "t@t");
  g("config", "user.name", "t");
  const cs = ["namespace N;", "public sealed class Svc", "{", "    public int A()", "    {", "        return 1;", "    }", "", "    public int B()", "    {", "        return 2;", "    }", "}", ""];
  writeFileSync(join(dir, "Svc.cs"), cs.join("\n"));
  g("add", ".");
  g("commit", "-qm", "init");
  cs[10] = "        return 3;";
  writeFileSync(join(dir, "Svc.cs"), cs.join("\n"));
  writeFileSync(join(dir, "New.cs"), "public sealed class Neu\n{\n    public void Run() { }\n}\n");
  const r = spawnSync("node", [join(scripts, "diff-outline.mjs")], { cwd: dir, encoding: "utf8" });
  assert.match(r.stdout, /Svc\.cs \(\+1 −1\): public int B\(\)/, r.stdout);
  assert.ok(!/public int A\(\)/.test(r.stdout), r.stdout);
  assert.match(r.stdout, /New\.cs \(neu, 5 Z\.\): public sealed class Neu · public void Run/);
  assert.match(r.stdout, /── 2 Dateien/);
});

test("doctor: prüft das Bündel und meldet Probleme mit Lösung", () => {
  const env = { ...process.env, CODE_PRO_HOME: mkdtempSync(join(tmpdir(), "doc-")) };
  const r = spawnSync("node", [join(bundle, "skills/code-pro/scripts/doctor.mjs")], { env, encoding: "utf8" });
  assert.match(r.stdout, /✓ Design-Rechner: 21:1/);
  assert.match(r.stdout, /✓ Hooks: SessionStart, Stop/);
  assert.ok(!/Hausdesign/.test(r.stdout));
});
