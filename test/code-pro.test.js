import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repo = new URL("../", import.meta.url);
const plugin = new URL("plugin/", repo);
const scripts = fileURLToPath(new URL("skills/code-pro/scripts/", plugin));
const { condense } = await import(new URL("run.mjs", `file://${scripts}`));
const { outline } = await import(new URL("outline.mjs", `file://${scripts}`));
const { repoMap } = await import(new URL("map.mjs", `file://${scripts}`));

test("condense: kurze Ausgabe bleibt unverändert", () => {
  assert.equal(condense("a\nb\n", 80).text, "a\nb");
});

test("condense: Fortschritt, ANSI und Wiederholungen fallen weg", () => {
  const raw = "\x1b[32mstart\x1b[0m\n" + Array.from({ length: 50 }, (_, i) => `Downloading pkg ${i}/50`).join("\n") + "\n10%\r50%\r100%\nfertig";
  const { text } = condense(raw, 80);
  assert.match(text, /^start\nDownloading pkg 0\/50\n  … \(\+48 ähnliche Zeilen\)\nDownloading pkg 49\/50\nfertig$/);
});

test("condense: bei langer Ausgabe bleiben Fehler mit Kontext erhalten", () => {
  const words = ["alpha", "beta", "gamma", "delta", "epsilon"];
  const raw = [...Array.from({ length: 300 }, (_, i) => `ok - ${words[i % 5]} ${i} passed`), "not ok - kaputt", "  Expected: 3", "  Received: 2", "  at foo.js:12:5", ...Array.from({ length: 50 }, (_, i) => `tail ${words[i % 5]} ${i}`)].join("\n");
  const { text, shown } = condense(raw, 40);
  assert.ok(shown <= 40);
  for (const s of ["not ok - kaputt", "Expected: 3", "Received: 2", "foo.js:12:5", "tail epsilon 49"]) assert.ok(text.includes(s), s);
  assert.match(text, /Zeilen ausgelassen/);
});

test("run.mjs reicht den Exit-Code durch", () => {
  const r = spawnSync("node", [join(scripts, "run.mjs"), "--", "node", "-e", "\"console.error('boom'); process.exit(3)\""], { encoding: "utf8" });
  assert.equal(r.status, 3);
  assert.match(r.stdout, /boom/);
  assert.match(r.stdout, /exit=3/);
});

test("outline findet Definitionen in mehreren Sprachen", () => {
  const dir = mkdtempSync(join(tmpdir(), "outline-"));
  const files = {
    "a.ts": "export class Foo {\n  async bar(x: number): Promise<void> {\n    if (x) {\n    }\n  }\n}\nexport const baz = async () => 1;\ninterface Q {}\n",
    "b.py": "class A:\n    def m(self):\n        pass\nasync def f():\n    pass\n",
    "c.cs": "public class Svc\n{\n    public async Task<int> RunAsync(string id)\n    {\n        if (id == null) return 0;\n    }\n}\n",
    "d.go": "package x\ntype S struct{}\nfunc (s *S) Do() error {\n\treturn nil\n}\n",
  };
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
  const ts = outline(join(dir, "a.ts"));
  for (const s of ["1  export class Foo", "2    async bar(x: number)", "7  export const baz", "8  interface Q"]) assert.ok(ts.includes(s), `${s}\n${ts}`);
  assert.ok(!ts.includes("if (x)"));
  assert.match(outline(join(dir, "b.py")), /class A[\s\S]*def m[\s\S]*async def f/);
  const cs = outline(join(dir, "c.cs"));
  assert.match(cs, /public class Svc[\s\S]*RunAsync/);
  assert.ok(!cs.includes("if (id"));
  assert.match(outline(join(dir, "d.go")), /type S struct[\s\S]*func \(s \*S\) Do/);
});

test("map fasst ein Repo zusammen und überspringt Ballast", () => {
  const out = repoMap(fileURLToPath(repo));
  assert.match(out, /^\d+ Dateien, \d+ Zeilen/);
  assert.ok(!out.includes("package-lock.json"));
  assert.ok(out.split("\n").length <= 121);
});

test("SessionStart-Hook nennt die Skript-Pfade", () => {
  const out = execFileSync("node", [fileURLToPath(new URL("hooks/session-start.mjs", plugin))], { encoding: "utf8" });
  assert.ok(out.includes(scripts), out);
});

test("outline C#: Namespace, Records, Konstruktoren, =>-Member, Properties; Felder nicht", () => {
  const dir = mkdtempSync(join(tmpdir(), "outline-cs-"));
  const file = join(dir, "Svc.cs");
  writeFileSync(file, [
    "namespace Shop.Orders;",
    "public sealed record OrderDto(Guid Id, decimal Total);",
    "public readonly record struct OrderId(Guid Value);",
    "internal sealed class OrderService(IRepo repo) : IOrderService",
    "{",
    "    private readonly List<int> _items = new();",
    "    private static readonly Regex Rx = new(\"x\");",
    "    public required string Name { get; init; }",
    "    public int Count => _items.Count;",
    "    public OrderService() : this(null!) { }",
    "    public async Task<OrderDto?> GetAsync(OrderId id, CancellationToken ct)",
    "    {",
    "        if (id == default) return null;",
    "        return await repo.Find(id, ct);",
    "    }",
    "    private static int Twice(int x) => x * 2;",
    "    public static implicit operator int(OrderService s) => s.Count;",
    "}",
  ].join("\n"));
  const out = outline(file);
  for (const s of ["namespace Shop.Orders", "record OrderDto", "record struct OrderId", "class OrderService", "required string Name", "int Count =>", "public OrderService()", "GetAsync(", "Twice(", "implicit operator int"]) assert.ok(out.includes(s), `${s}\n${out}`);
  for (const s of ["List<int> _items", "Regex Rx", "if (id"]) assert.ok(!out.includes(s), `${s} soll fehlen\n${out}`);
});

test("condense: Stack-Frames aus Laufzeit und Frameworks fallen weg", () => {
  const raw = [
    "Assert.Equal() Failure: Values differ",
    "   at Calc.Tests.CalcTests.Fails(Int32 a) in /src/UnitTest1.cs:line 11",
    "   at System.Reflection.MethodBaseInvoker.InterpretedInvoke_Method(Object obj, IntPtr* args)",
    "   at Xunit.Sdk.TestInvoker`1.CallTestMethod(Object testClassInstance)",
    "    at TestContext.<anonymous> (file:///app/a.test.js:3:29)",
    "    at Test.runInAsyncScope (node:async_hooks:214:14)",
    "    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)",
  ].join("\n");
  const { text } = condense(raw, 80);
  assert.match(text, /UnitTest1\.cs:line 11/);
  assert.match(text, /a\.test\.js:3:29/);
  assert.ok(!/System\.Reflection|Xunit\.Sdk|node:internal/.test(text), text);
});

test("Skill macht C# zur Standardsprache und verweist auf die C#-Referenz", () => {
  const skill = readFileSync(new URL("skills/code-pro/SKILL.md", plugin), "utf8");
  assert.match(skill, /Neues in C#/);
  assert.ok(skill.length < 2500, "Skill bleibt schlank, er steckt nach dem Laden in jedem Modellaufruf");
  assert.ok(existsSync(new URL("skills/code-pro/references/csharp.md", plugin)));
});

test("lint-cs findet Anti-Patterns und ignoriert Kommentare, Strings und korrekte Aufrufe", async () => {
  const { lintSource } = await import(new URL("lint-cs.mjs", `file://${scripts}`));
  const bad = [
    /* 1*/ "public sealed class Bad(ILogger<Bad> logger)",
    /* 2*/ "{",
    /* 3*/ "    public List<int> Items { get; set; } = [];",
    /* 4*/ "    public async void Fire() { await Task.Delay(1); }",
    /* 5*/ "    public async Task<int> LoadAsync(string id)",
    /* 6*/ "    {",
    /* 7*/ "        Thread.Sleep(10);",
    /* 8*/ "        var c = new HttpClient();",
    /* 9*/ "        var v = double.Parse(id);",
    /*10*/ "        logger.LogInformation($\"Lade {id}\");",
    /*11*/ "        if (id.ToLower() == \"x\") return 0;",
    /*12*/ "        Task.Run(() => Work());",
    /*13*/ "        try { Work(); }",
    /*14*/ "        catch (Exception ex) { throw ex; }",
    /*15*/ "        try { Work(); } catch { }",
    /*16*/ "        var n = DateTime.Now;",
    /*17*/ "        var r = GetAsync().Result;",
    /*18*/ "        db.Database.ExecuteSqlRaw(\"DELETE FROM T WHERE Id = \" + id);",
    /*19*/ "        return 1;",
    /*20*/ "    }",
    /*21*/ "}",
  ].join("\n");
  const ids = lintSource(bad).map((f) => `${f.line}:${f.id}`);
  for (const want of ["3:public-mutable-list", "4:async-void", "5:async-no-ct", "7:thread-sleep", "8:new-httpclient", "9:parse-culture", "10:log-interpolation", "11:case-compare", "12:fire-and-forget", "14:throw-ex", "15:empty-catch", "16:datetime-now", "17:blocking-wait", "18:sql-concat"]) {
    assert.ok(ids.includes(want), `${want} fehlt in ${ids.join(", ")}`);
  }

  const good = [
    "// var c = new HttpClient(); DateTime.Now; async void X()",
    "/* double.Parse(s) */",
    "var msg = \"DateTime.Now and new HttpClient() in a string\";",
    "var raw = \"\"\"",
    "  SELECT * FROM T -- double.Parse(x) .Result",
    "  \"\"\";",
    "var a = double.Parse(s, CultureInfo.InvariantCulture);",
    "var b = DateTime.Parse(s, inv, DateTimeStyles.AssumeUniversal);",
    "var ok = double.TryParse(s, NumberStyles.Float, inv, out var d);",
    "logger.LogInformation(\"Lade {Id}\", id);",
    "private async void OnClick(object? sender, EventArgs e) { await Task.Yield(); }",
    "public async Task InitializeAsync() { await Task.Yield(); }",
    "var result = validationResult.IsValid;",
  ].join("\n");
  assert.deepEqual(lintSource(good), []);
});

test("lint-cs CLI: Exit-Code 1 bei Fehlern", () => {
  const dir = mkdtempSync(join(tmpdir(), "lint-cs-"));
  writeFileSync(join(dir, "A.cs"), "class A { async void X() { } }\n");
  const r = spawnSync("node", [join(scripts, "lint-cs.mjs"), dir], { encoding: "utf8" });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /async-void/);
});

test("CLI: erster Pfad wird ausgewertet, mit und ohne --max", () => {
  const dir = mkdtempSync(join(tmpdir(), "cli-"));
  writeFileSync(join(dir, "Only.cs"), "class Only { }\n");
  for (const extra of [[], ["--max", "50"]]) {
    const m = spawnSync("node", [join(scripts, "map.mjs"), dir, ...extra], { encoding: "utf8", cwd: tmpdir() });
    assert.match(m.stdout, /^1 Dateien/, m.stdout);
    const l = spawnSync("node", [join(scripts, "lint-cs.mjs"), dir, ...extra], { encoding: "utf8", cwd: tmpdir() });
    assert.match(l.stdout, /1 Dateien/, l.stdout);
  }
});

test("brief: Projektsteckbrief mit Stack, Befehlen aus Projekt und README, Git-Stand und Dateien; leer außerhalb von Projekten", async () => {
  const { projectBrief } = await import(new URL("brief.mjs", `file://${scripts}`));
  const dir = mkdtempSync(join(tmpdir(), "brief-"));
  mkdirSync(join(dir, "src/App"), { recursive: true });
  mkdirSync(join(dir, "tests/App.Checks"), { recursive: true });
  writeFileSync(join(dir, "src/App/App.csproj"), "<Project><PropertyGroup><TargetFramework>net10.0</TargetFramework></PropertyGroup></Project>");
  writeFileSync(join(dir, "tests/App.Checks/App.Checks.csproj"), "<Project><PropertyGroup><OutputType>Exe</OutputType></PropertyGroup></Project>");
  writeFileSync(join(dir, "README.md"), "# App\n\nStarten: `dotnet run --project src/App`\n");
  execFileSync("git", ["init", "-q"], { cwd: dir });
  const b = projectBrief(dir);
  assert.match(b, /^PROJEKT \(von ProKit beim Start erkannt/);
  assert.match(b, /Stack: \.NET \(net10\.0\), 2 Projekte/);
  assert.match(b, /Prüfprogramm: `dotnet run --project tests\/App\.Checks`/);
  assert.match(b, /README: `dotnet run --project src\/App`/);
  assert.match(b, /Git: \S+, 3 geänderte\/neue Dateien/);
  assert.match(b, /src\/App\/: App\.csproj 1/);
  assert.ok(b.length <= 2002);
  assert.equal(projectBrief(mkdtempSync(join(tmpdir(), "leer-"))), "");
});

test("find: Treffer samt umschließender Methode und Doku-Kommentar, ein Block je Methode", async () => {
  const { find } = await import(new URL("find.mjs", `file://${scripts}`));
  const dir = mkdtempSync(join(tmpdir(), "find-"));
  const filler = Array.from({ length: 30 }, (_, i) => `    public int F${i}(int a)\n    {\n        return a + ${i};\n    }\n`).join("\n");
  writeFileSync(join(dir, "Svc.cs"), `namespace X;\n\npublic sealed class Svc\n{\n${filler}\n    /// <summary>Entscheidet, ob bevorzugt geliefert wird.</summary>\n    public bool IsExpedited(decimal value)\n    {\n        if (value > 10m) return true;\n        return false;\n    }\n}\n`);
  writeFileSync(join(dir, "app.py"), "def other():\n    return 1\n\ndef expedite(x):\n    y = x * 2\n    return y\n\nz = 3\n");
  const { text } = find("bevorzugt|IsExpedited|expedite", [dir], { ignoreCase: true });
  const blocks = text.split("── ").filter(Boolean);
  assert.equal(blocks.length, 2, text);
  const cs = blocks.find((b) => b.includes("Svc.cs")) ?? "";
  const py = blocks.find((b) => b.includes("app.py")) ?? "";
  assert.match(cs, /Svc\.cs:\d+-\d+ {2}public bool IsExpedited\(decimal value\)/);
  assert.match(cs, /\/\/\/ <summary>Entscheidet/);
  assert.match(cs, /return false;\n\s+\d+ {2}    \}/);
  assert.ok(!/F29/.test(cs), "nur die eine Methode");
  assert.match(py, /app\.py:4-6 {2}def expedite\(x\)/);
  assert.match(find("gibtsnicht", [dir]).text, /Keine Treffer/);
});

test("open: wählt Lösung (.slnx vor .sln), sonst index.html; öffnet ohne Bildschirm nicht", async () => {
  const { pick, open } = await import(new URL("open.mjs", `file://${scripts}`));
  const dir = mkdtempSync(join(tmpdir(), "open-"));
  writeFileSync(join(dir, "App.sln"), "");
  writeFileSync(join(dir, "App.slnx"), "");
  assert.equal(pick(dir), join(dir, "App.slnx"));
  const web = mkdtempSync(join(tmpdir(), "web-"));
  mkdirSync(join(web, "dist"));
  writeFileSync(join(web, "dist/index.html"), "");
  assert.equal(pick(web), join(web, "dist/index.html"));
  assert.equal(pick("https://example.com"), "https://example.com");
  assert.equal(pick(join(dir, "fehlt")), null);
  process.env.PROKIT_NO_OPEN = "1";
  try { assert.match(open(web), /nicht geöffnet \(kein weiterer Versuch nötig\): .*index\.html/); } finally { delete process.env.PROKIT_NO_OPEN; }
  const cli = (...a) => execFileSync("node", [join(scripts, "open.mjs"), ...a], { encoding: "utf8", env: { ...process.env, PROKIT_FAKE_OPEN: "1" } });
  assert.match(cli("open", web), /^Geöffnet: .*index\.html/, "Werkzeugname doppelt angegeben");
});

test("agents-md: ohne Lösung bei mehreren Projekten das Projekt bauen, das die anderen einbindet", async () => {
  const { detect } = await import(new URL("agents-md.mjs", `file://${scripts}`));
  const dir = mkdtempSync(join(tmpdir(), "multi-"));
  mkdirSync(join(dir, "src/Lib"), { recursive: true });
  mkdirSync(join(dir, "tests/Lib.Tests"), { recursive: true });
  writeFileSync(join(dir, "src/Lib/Lib.csproj"), "<Project><PropertyGroup><TargetFramework>net10.0</TargetFramework></PropertyGroup></Project>");
  writeFileSync(join(dir, "tests/Lib.Tests/Lib.Tests.csproj"), '<Project><ItemGroup><PackageReference Include="xunit" /><ProjectReference Include="..\\..\\src\\Lib\\Lib.csproj" /></ItemGroup></Project>');
  const cmds = detect(dir).commands.join("\n");
  assert.match(cmds, /Build: `dotnet build tests\/Lib\.Tests\/Lib\.Tests\.csproj /);
  assert.match(cmds, /Test: `dotnet test tests\/Lib\.Tests\/Lib\.Tests\.csproj /);
  assert.ok(!/dotnet build --nologo/.test(cmds), "nacktes dotnet build scheitert bei mehreren Projekten");
});
