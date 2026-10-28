# Selbst-Review vor dem Abschluss

`git diff` lesen und jede Frage ehrlich beantworten. Gefundenes fixen, bevor du fertig meldest.

## Korrektheit
- [ ] Macht der Code genau das Verlangte, inkl. Randfälle (leer, null, 0, sehr groß, Unicode, Zeitzonen)?
- [ ] Fehlerpfade: Was passiert bei Exception, Timeout, ungültiger Eingabe? Wird nichts still verschluckt?
- [ ] Nebenläufigkeit: Race Conditions, fehlende `await`, geteilter Zustand?
- [ ] Off-by-one, falsche Vergleichsoperatoren, invertierte Bedingungen?
- [ ] Ressourcen geschlossen (Dateien, Verbindungen, Listener, Timer)?
- [ ] Alle Aufrufer der geänderten Funktion noch korrekt? (`rg -n "name\("`)

## C#-spezifisch
- [ ] Keine Nullable-Warnungen; kein `!` (Null-Forgiving) ohne Begründung.
- [ ] Async durchgängig, `CancellationToken` weitergereicht, kein `.Result`/`.Wait()`/`async void`.
- [ ] `IDisposable`/`IAsyncDisposable` mit `using`/`await using` entsorgt.
- [ ] Parsen/Formatieren von Daten mit `CultureInfo.InvariantCulture`; String-Vergleiche mit `StringComparison`.
- [ ] Zeit über `TimeProvider`, `HttpClient` über `IHttpClientFactory`.
- [ ] Logging strukturiert mit Platzhaltern, keine Secrets im Log.
- [ ] Neue öffentliche Typen `sealed`, Collections nach außen `IReadOnlyList`/`IReadOnlyCollection`.
- [ ] `dotnet build` ohne Warnungen, `dotnet format --verify-no-changes` sauber.

## Sicherheit
- [ ] Eingaben validiert; keine SQL-/Shell-/Pfad-Injection (Parameter statt String-Verkettung).
- [ ] Keine Secrets, Tokens oder persönlichen Daten im Code oder in Logs.
- [ ] Ausgaben im Web escaped (XSS); Berechtigungsprüfung serverseitig.

## Passung
- [ ] Stil, Benennung und Muster wie im umgebenden Code.
- [ ] Keine toten Reste: Debug-Ausgaben, auskommentierter Code, ungenutzte Imports/Variablen.
- [ ] Keine unnötige Abstraktion, keine Änderungen außerhalb des Auftrags.
- [ ] Öffentliche API/Schema geändert? Dann Aufrufer, Doku und Migration mitgezogen.

## Verifikation
- [ ] Betroffene Tests ausgeführt und grün; neuer Test für neues Verhalten.
- [ ] Typecheck/Lint sauber.
- [ ] Was nicht verifiziert werden konnte, steht im Bericht.

## Abschlussbericht (max. 5 Zeilen)
```
Geändert: <was, wo>
Geprüft: <welche Tests/Checks, Ergebnis>
Offen: <falls etwas nicht verifiziert oder bewusst ausgelassen wurde>
```
