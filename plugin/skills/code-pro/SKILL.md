---
name: code-pro
description: C#/.NET auf Profi-Niveau mit wenig Tokens; C# ist die Standardsprache für Neues. Nutzen bei Programmieraufgaben, vor allem in C#, in großen Dateien oder Repos, bei langen Test-/Build-Ausgaben, für ein Projektgedächtnis (AGENTS.md) oder eine C#-Fehlerprüfung.
metadata:
  short-description: C#-Profi, weniger Tokens
---

# Code Pro

Jeder Modellaufruf schickt den ganzen bisherigen Kontext erneut. Darum zählen zwei Dinge: wenig in den Kontext holen und wenige Schritte machen. Werkzeuge nur einsetzen, wenn sie einen Schritt ersetzen, nie zusätzlich.

## Sprache

- Neues in C# (.NET 10, C# 14); kleine Skripte als Datei-App (`dotnet run tool.cs`).
- Bestehende Projekte bleiben in ihrer Sprache und bei ihrem `TargetFramework` und Stil.
- `references/csharp.md` (moderne Sprache, Async, DI, EF Core, Tests, Anti-Patterns) nur lesen, wenn der Nutzer Review oder Architektur verlangt.

## Werkzeuge (`scripts/`, je `node scripts/<name>.mjs`)

| Statt … | Werkzeug |
|---|---|
| große Datei ganz lesen | `outline <datei>`, dann nur den Abschnitt (`sed -n 'a,bp'`) |
| viele `ls`/`find` im fremden Repo | `map [dir]` |
| lange Test-/Build-Ausgabe | `run -- <befehl>` (nur Fehler mit Kontext, Exit-Code bleibt) |
| großen Diff lesen | `diff-outline [--base main]` |
| Befehle jedes Mal neu suchen | `agents-md --write` einmal pro Repo, danach Befehle aus `AGENTS.md` |

Dazu: `lint-cs [pfade]` (typische C#-Fehler), `secrets` (vor Commits), `savings` (Token-Bilanz), `doctor` (Installation prüfen).

## Arbeitsweise

- Bugs erst reproduzieren, dann minimal ändern, im Stil des umgebenden Codes.
- Gezielt testen; nicht Ausgeführtes nie als „funktioniert“ melden.
- Nie Lockfiles, `node_modules`, `bin`/`obj`/`dist` oder generierten Code lesen; nach eigenem Edit nicht neu lesen.
- Unabhängige Lese- und Suchbefehle in einem Schritt bündeln.
- Antworten ohne Vorrede, keine Diffs im Chat, Abschluss in wenigen Zeilen.

Referenzen bei Bedarf: `references/commands.md` (leise Befehle je Sprache), `debugging.md`, `review.md`.
