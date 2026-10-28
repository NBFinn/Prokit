# ProKit für Claude

Abgeleitet aus dem Codex-Plugin in `plugin/` (`npm run build:claude`).

Installieren in Claude Code:

```
/plugin install prokit --marketplace NBFinn/prokit
```

- **Code Pro:** C# als Standardsprache, Senior-Engineer-Ablauf, Token-Sparwerkzeuge (map, outline, run, diff-outline, lint-cs, secrets), Projektgedächtnis in `CLAUDE.md`.
- **Design Pro:** Farb- und Kontrastrechner als Skript (nur auf Aufruf).
- **3D Pro:** druckgerechte Konstruktion, Mesh-Prüfung (Dichtheit, Wandstärke, Überhänge) und PNG-Vorschau.
- **Token-Bilanz:** Am Ende jeder Antwort meldet der Stop-Hook den gemessenen Verbrauch, die Plugin-Kosten und die Ersparnis der Werkzeuge.

Benötigt Node.js ≥ 20.
