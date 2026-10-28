# ProKit

**Codex-Plugin** für C#, Design und 3D. Es ist bewusst schlank: Es liefert nur, was das Modell nicht selbst kann (exakte Rechnungen, Projektbefehle, Mesh-Prüfung), und Werkzeuge, die einen teuren Schritt ersetzen. Eine abgeleitete Fassung läuft auch in Claude.

| Teil | Was es kann |
|---|---|
| **Code Pro** | Programmiert standardmäßig in modernem C# (.NET 10) nach dem Ablauf eines erfahrenen Entwicklers: verstehen, reproduzieren, minimal ändern, testen, selbst prüfen. Werkzeuge sparen Tokens, ein Projektgedächtnis speichert Befehle und Konventionen jedes Repos. |
| **Design Pro** | Farbrechner als Skript: WCAG-Kontraste (mehrere Paare in einem Aufruf), Farbabstufungen, Token-Sets, Typo- und Abstandsskalen, CSS-Audit. Gestaltet wird mit dem eigenen Urteil des Modells. |
| **3D Pro** | Konstruiert druckfertige 3D-Modelle, prüft sie (Dichtheit, Wandstärke, Überhänge, Druckbett) und rendert eine Vorschau, damit das Ergebnis angesehen wird. |

Am Ende jeder Antwort meldet ProKit den **gemessenen Verbrauch** und ob es netto Tokens gespart oder gekostet hat.

## Installieren in Codex

In der App: **Plugins → Marketplace hinzufügen**

| Feld | Wert |
|---|---|
| Quelle | `NBFinn/prokit` |
| Git-Ref | `main` |
| Sparse-Pfade | leer |

Dann **ProKit** installieren, die App neu starten und die Hooks freigeben.

Im Terminal:
```bash
codex plugin marketplace add NBFinn/prokit
```
```bash
codex plugin add prokit@nbfinn-prokit
```

Voraussetzung: [Node.js](https://nodejs.org) ab Version 20. Ob alles läuft, prüft Codex auf die Frage *„Prüfe ProKit“*.

**Umstieg von der Vorgängerversion** (Repo `chat`, Plugin `op` oder die Einzel-Plugins `code-pro`, `design-pro`, `3d-pro`):
1. Die alten Plugins deinstallieren.
2. Den alten Marketplace `nbfinn` entfernen.
3. ProKit wie oben neu hinzufügen.

ProKit enthält alles aus den bisherigen Plugins.

## Auch in Claude

Gleiche Skills, Werkzeuge und Hooks. Das Projektgedächtnis schreibt hier in `CLAUDE.md`.

- **Claude-App:** Marketplace hinzufügen → `NBFinn/prokit` → Synchronisieren, dann ProKit installieren. Ohne Marketplace: [`dist/prokit.plugin`](https://github.com/NBFinn/prokit/raw/main/dist/prokit.plugin) hochladen.
- **Claude Code:**
  ```
  /plugin marketplace add NBFinn/prokit
  ```
  ```
  /plugin install prokit@nbfinn-prokit
  ```

## Gemessen: mit und ohne ProKit

Gleiche Aufgabe, gleiches Modell, frische Sitzung, je 2–3 Läufe (Claude Code, Version 2.6, echte Tokenzähler). Alle Läufe haben ihre Aufgabe gelöst.

| Aufgabe | Ohne ProKit | Mit ProKit | Zeit ohne → mit |
|---|---:|---:|---:|
| Internes NuGet-Paket nutzen (API unbekannt) | 332.000 | **151.000 (−55 %)** | 51 s → 26 s |
| Versteckter Fehler in Projekt mit 25 Dateien | 180.000 | **109.000 (−39 %)** | 36 s → 20 s |
| Bekannte Bibliothek einbauen (Cache mit BitFaster.Caching) | 165.000 | **110.000 (−33 %)** | 31 s → 31 s |
| Frage zu großem Projekt (5.800 Zeilen) | 139.000 | **71.000–107.000 (−23 bis −49 %)** | 17 s → 15 s |
| C#-Fehler beheben (2 fehlschlagende Prüfungen) | 154.000 | **124.000 (−20 %)** | 24 s → 21 s |
| Feature über mehrere Stellen inkl. neuer Prüfungen | 155.000 | **125.000 (−19 %)** | 29 s → 26 s |
| Einstellungsseite als HTML bauen | 84.000 | 84.000 (±0) | 67 s → 58 s |

Woher das kommt:
- **Projektsteckbrief beim Start** (Stack, NuGet-Pakete, korrekte Build- und Testbefehle, Git-Stand, Dateien mit Zeilenzahl) ersetzt die Erkundungsrunde.
- **`api`** liefert die echte API eines Pakets (auch interner Firmenpakete) mit Signaturen und Doku in einem Aufruf, statt XML-Dateien zu durchsuchen oder Methoden zu raten.
- **`find`** zeigt Suchtreffer samt ganzer Methode: Suchen und Lesen in einer Runde.
- **Runden-Regeln:** Lesen, Suchen und Testen bündeln, Änderung und Test im selben Schritt.

Jede gesparte Runde spart den ganzen Kontext einmal. Die Werkzeuge kosten nur etwas, wenn sie aufgerufen werden.

## Code Pro

**C# ist die Standardsprache** für alles Neue: Projekte, Dienste, Tools, Skripte. Bestehende Projekte bleiben in ihrer Sprache. `references/csharp.md` enthält das Profiwissen. Jedes Code-Beispiel darin ist mit dem .NET-10-SDK kompiliert und ausgeführt.

| Werkzeug | Zweck |
|---|---|
| `map.mjs` | Repo-Übersicht mit Zeilenzahlen in wenigen Zeilen |
| `find.mjs` | Suchtreffer samt umschließender Methode mit Zeilennummern: Suchen und Lesen in einem Schritt |
| `api.mjs` | Echte .NET-/NuGet-API: `api JsonSerializer.Deserialize`, `api Acme.Pricing` (alle Typen eines Pakets). Quellen: Projektpakete inkl. transitiver, .NET-Basisbibliothek, ASP.NET Core, unter Windows WPF/WinForms, lokaler NuGet-Cache. Offline |
| `pkg.mjs` | NuGet: `pkg search <begriff>` (passende Pakete mit Version und Downloads), `pkg versions <id>` |
| `brief.mjs` | Projektsteckbrief (läuft automatisch beim Start) |
| `open.mjs` | Ergebnis beim Nutzer öffnen: `.slnx`/`.sln` in Visual Studio (neueste Version), HTML im Browser, sonst Standard-App |
| `outline.mjs` | Klassen/Methoden mit Zeilennummern (C#, TS/JS, Python, Java, Go, Rust, C/C++ …), dann nur Abschnitte lesen |
| `run.mjs` | Test- und Build-Ausgaben verdichten, Fehler mit Kontext behalten (z. B. 276 → 30 Zeilen) |
| `diff-outline.mjs` | Welche Methoden eine Änderung betrifft, statt den ganzen Diff zu lesen |
| `lint-cs.mjs` | Schneller C#-Check: async void, .Result, leere catch, throw ex, Parsen ohne Kultur, SQL-Verkettung … |
| `secrets.mjs` | API-Keys, Tokens, private Schlüssel vor dem Commit finden (maskiert) |
| `agents-md.mjs` | **Projektgedächtnis:** Stack, Befehle, Konventionen, CI → `AGENTS.md` |
| `savings.mjs` | Token-Bilanz heute, 7 Tage, gesamt und je Werkzeug |
| `doctor.mjs` | Prüft die Installation und nennt bei Problemen die Lösung |

Die Werkzeuge sind Skripte statt MCP-Tools. Sie kosten deshalb keine Grund-Tokens und laufen in der Sandbox von Codex.

## Design Pro

Farbrechner (nur bei Bedarf, kein MCP-Server, keine Regeln im Startkontext):
```bash
node "<Plugin-Ordner>/skills/design-pro/scripts/design.mjs" contrast "#ffffff" "#1d4ed8" "#60a5fa" "#ffffff"
```
Prüft alle Paare in einem Aufruf und schlägt bei zu wenig Kontrast eine Farbe im gleichen Farbton vor. Weitere Befehle: `palette`, `tokens`, `type`, `spacing`, `harmony`, `audit`. Die Design-Referenzen (Prinzipien, Komponenten, Barrierefreiheit, Kritik) liest der Skill nur auf ausdrücklichen Wunsch.

## 3D Pro

Ablauf eines Konstrukteurs: Anforderungen in Zahlen, parametrisch modellieren, druckgerecht konstruieren, exportieren, **prüfen und ansehen**.

- `check.mjs` prüft STL/OBJ:
  - Maße, Volumen, Gewicht
  - Dichtheit, Normalen, getrennte Teile
  - Überhänge, Auflage, Druckbett, Einheitenfehler
  - Wandstärke und kleinster Spalt, jeweils mit Koordinate
- `render.mjs` erzeugt eine PNG-Vorschau mit 4 Ansichten. Rückseiten erscheinen rot.
- **Referenzen:**
  - FDM-Regeln: Wandstärken, Toleranzen, Schraubenlöcher, Materialien, Druckbetten
  - OpenSCAD, build123d/CadQuery, Blender, Three.js
  - Die Code-Beispiele sind ausgeführt und mit den Werkzeugen geprüft.

## Token-Bilanz

Beispiel (Zahlen erfunden):

> Token-Bilanz (gemessen): diese Antwort 41.200 Tokens in 4 Modellaufrufen · Sitzung 96.500 in 9 · ProKit-Kontext ca. 5.100, Werkzeuge sparten ca. 18.400 → netto ca. 13.300 gespart

- **Gemessen:** Verbrauch und Zahl der Modellaufrufe stammen aus dem Sitzungsprotokoll von Codex bzw. Claude.
- **Kosten:** ProKit-Kontext (Startregeln, Skill-Beschreibungen, geladene Skills) **je Modellaufruf**, denn jeder Aufruf schickt ihn erneut.
- **Ersparnis:** je Werkzeugaufruf die Größe ohne Werkzeug gegenüber dem Ergebnis, ebenfalls je folgendem Modellaufruf. Beispiele:
  - ganze Datei gegenüber Outline
  - volle gegenüber verdichteter Ausgabe
- **Netto negativ** wird als „Mehrverbrauch durch ProKit“ angezeigt.
- **Nicht messbar:** wie viele Schritte ein Agent ohne Plugin gebraucht hätte. Für einen echten Vergleich dieselbe Aufgabe in zwei frischen Chats laufen lassen.
- Protokoll: `~/.code-pro/savings.jsonl` (30 Tage).
- **Woher kommt ein Mehrverbrauch?** Ein Sitzungsprotokoll aufschlüsseln (je Modellaufruf Größe und auslösende Schritte, ★ = ProKit beteiligt):
  ```bash
  node "<Plugin-Ordner>/skills/code-pro/scripts/savings.mjs" --analyze "<Protokoll>.jsonl"
  ```
  Codex legt die Protokolle unter `%USERPROFILE%\.codex\sessions\JJJJ\MM\TT\rollout-….jsonl` ab.

### Warum so schlank (Version 2.1)

Ein Vergleich derselben Aufgabe (Kamera-Einstellungsseite) ergab mit Version 2.0 **215.860 statt 45.689 Tokens** und ein schlechter aussehendes Ergebnis. Die Ursachen:
- 8 MCP-Werkzeugbeschreibungen in jedem Aufruf
- Pflichtschritte: Leitfaden laden, jede Farbe einzeln prüfen, Design-Dateien ganz lesen
- allgemeine Design-Regeln, die das Modell in eine Schablone drückten

Ab Version 2.1 ist das alles entfernt. Seit 2.2 laden Code Pro und Design Pro außerdem nur noch auf ausdrücklichen Aufruf (`$code-pro`, `$design-pro`); Startregeln und Werkzeuge wirken trotzdem in jeder Sitzung. Seit 2.3 enthält ProKit kein Standard-Design mehr. Im Einzelnen:
- feste Kosten je Aufruf rund 80 % kleiner (geschätzt ca. 550 statt 2.800 Tokens, ~4 Zeichen/Token)
- Skills ein Drittel so groß
- keine Pflichtschritte mehr

## Aufbau

```
plugin/             Das Codex-Plugin (Quelle von allem)
  .codex-plugin/      Manifest
  skills/             code-pro, design-pro, 3d-pro (mit Werkzeugen und Referenzen)
  hooks/              Start (Kurzregeln), Stop (Token-Bilanz)
dist/               erzeugt, nicht von Hand ändern
  claude/prokit/      Claude-Fassung
  prokit.plugin       Claude-Fassung als Datei
design-server/      Quellcode des Farbrechners (wird nach skills/design-pro/scripts/design.mjs gebündelt)
scripts/            Build-Skripte
test/               Tests, laufen per GitHub Actions unter Windows und Linux
.agents/plugins/    Marketplace für Codex
.claude-plugin/     Marketplace für Claude
```

## Entwicklung

```bash
npm install
```
```bash
npm run build
```
```bash
npm test
```

`npm run build` erzeugt:
- die Design-Token-Referenz
- den gebündelten Farbrechner
- die Claude-Fassung samt `dist/prokit.plugin`

Die Tests schlagen fehl, wenn etwas davon nicht aktuell ist.

**Version:** eine Nummer in `package.json`, gilt auch für `plugin/.codex-plugin/plugin.json`. Bei jeder inhaltlichen Änderung beide erhöhen, denn Codex und Claude speichern Plugins nach Version.
