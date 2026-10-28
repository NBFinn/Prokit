# Leise und gezielte Befehle

Grundsatz: erst den kleinsten aussagekräftigen Befehl, dann breiter. Alles über `node scripts/run.mjs -- …` oder mit `| tail -n 40`.

## Suchen
| Zweck | Befehl |
|---|---|
| Dateien mit Treffer | `rg -l "muster"` |
| Treffer mit Zeile | `rg -n "muster" -g '!**/dist/**' \| head -40` |
| Definition finden | `rg -n "(function\|class\|def\|fn\|func) Name\b"` |
| Nur bestimmte Sprache | `rg -n "muster" -t ts` / `-t py` / `-t cs` |
| Aufrufer zählen | `rg -c "Name\(" \| sort -t: -k2 -nr \| head` |
| Geänderte Dateien | `git status --short`, `git diff --stat` |
| Wer hat das geändert | `git log -L 120,140:datei --oneline \| head -60` |

## JavaScript / TypeScript
| Zweck | Befehl |
|---|---|
| Einzelner Test (Vitest) | `npx vitest run pfad/datei.test.ts -t "name" --reporter=dot` |
| Einzelner Test (Jest) | `npx jest pfad -t "name" --silent` |
| node:test | `node --test --test-reporter=dot pfad` |
| Typecheck | `npx tsc --noEmit --pretty false` |
| Lint nur geänderte | `npx eslint $(git diff --name-only -- '*.ts' '*.tsx') --quiet` |
| Install | `npm ci --no-audit --no-fund --loglevel=error` |

## Python
| Zweck | Befehl |
|---|---|
| Einzelner Test | `pytest -q -x pfad::test_name --no-header -p no:cacheprovider` |
| Nur fehlgeschlagene | `pytest -q --lf` |
| Typecheck | `mypy --no-error-summary pfad` / `pyright pfad` |
| Lint | `ruff check --quiet pfad` |

## C# / .NET
| Zweck | Befehl |
|---|---|
| Build (nur Fehler, ohne Doppelungen) | `dotnet build --nologo -v q -clp:ErrorsOnly` |
| Tests (knapp, aber mit Erwartet/Ist und Zeile) | `dotnet test --nologo -v q --logger "console;verbosity=minimal"` |
| Einzelner Test | `… --filter "FullyQualifiedName~Klasse.Methode"` |
| Nur eine Kategorie | `… --filter "Category=Unit"` |
| Formatierung prüfen | `dotnet format --verify-no-changes -v q` |
| Veraltete Pakete | `dotnet package list --outdated` |
| Unsichere Pakete | `dotnet package list --vulnerable --include-transitive` |
| Skript/Tool ohne Projekt | `dotnet run tool.cs` |
| Neue Lösung | `dotnet new sln -n Name` (erzeugt `.slnx`), `dotnet new classlib/console/webapi/xunit -o src/…`, `dotnet sln add …` |

Achtung: `dotnet test -v q` **ohne** Logger-Option verschluckt Fehlermeldung, Erwartet/Ist und Stack. Dann ist ein zweiter Lauf nötig.

## Go / Rust / Java
| Zweck | Befehl |
|---|---|
| Go Test | `go test ./pkg/... -run 'TestName' 2>&1 \| tail -40` |
| Go Vet | `go vet ./...` |
| Rust Test | `cargo test -q name` |
| Rust Check | `cargo check -q --message-format=short` |
| Maven | `mvn -q -Dtest=Klasse#methode test` |
| Gradle | `./gradlew test --tests 'Klasse' -q` |

## Allgemein
- Lange Ausgaben: `… 2>&1 | tail -n 40` oder `run.mjs`.
- JSON gezielt: `jq '.feld'` statt ganze Dateien lesen.
- Logs: `rg -n "ERROR|WARN" app.log | tail -30`.
- Abschnitt lesen: `sed -n '120,190p' datei` (PowerShell: `Get-Content datei | Select-Object -Skip 119 -First 71`).
