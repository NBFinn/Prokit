# Systematische Fehlersuche

## Grundablauf
1. **Reproduzieren:** kleinster Befehl, der den Fehler zeigt. Ohne Reproduktion kein Fix.
2. **Fehlermeldung wörtlich nehmen:** Datei:Zeile im Stacktrace ist der Startpunkt, nicht die eigene Vermutung.
3. **Hypothese → Beleg:** eine Ursache benennen, mit einem gezielten Check bestätigen (Log, Test, `rg`), erst dann ändern.
4. **Eingrenzen statt raten:**
   - Letzte funktionierende Version: `git log --oneline -15`, `git bisect run <testbefehl>`.
   - Bei Daten: Eingabe halbieren, bis der minimale Fall übrig bleibt.
5. **Ursache fixen, nicht Symptom:** kein `try/catch` zum Verstecken, kein Test-Skip, keine Sleep-Zeilen gegen Race Conditions.
6. **Regressionstest:** Test schreiben, der vorher fehlschlägt und nachher besteht.

## Häufige Ursachen nach Symptom
| Symptom | Zuerst prüfen |
|---|---|
| `undefined`/`null`-Zugriff | Datenfluss rückwärts verfolgen: woher kommt der Wert, wann fehlt er? |
| Test lokal grün, CI rot | Zeitzonen, Locale, Dateipfade (Groß/Klein, `\` vs `/`), Reihenfolge-Abhängigkeit, fehlende Env-Variablen, andere Tool-Versionen |
| Sporadisch rot | Geteilter Zustand zwischen Tests, Zeit/Zufall, ungewartete Promises/Tasks, Ports |
| Funktioniert nach Neustart | Cache, veralteter Build-Output, Hot-Reload-Zustand |
| Typfehler nach Update | Changelog/Breaking Changes der Abhängigkeit, doppelte Versionen im Lockfile |
| Langsam | Messen statt raten: Profiler oder Zeitstempel; N+1-Abfragen, Schleifen mit I/O, fehlende Indizes, unnötiges Re-Rendering |
| Build bricht ohne Codeänderung | Lockfile, Node-/SDK-Version, Cache leeren |

## CI-Fehler
1. Ersten Fehler im Log suchen, nicht den letzten: `rg -n -m5 "error|FAIL" log.txt`.
2. Gleichen Befehl wie CI lokal ausführen (Workflow-Datei lesen: `.github/workflows/*.yml`).
3. Prüfen, ob der Basis-Branch auch rot ist. Dann liegt es nicht an der Änderung.

## Performance
- Erst messen, Ziel festlegen, dann den teuersten Teil optimieren, erneut messen.
- Algorithmische Komplexität vor Mikro-Optimierung.
- Ergebnis mit Zahlen berichten (vorher → nachher).
