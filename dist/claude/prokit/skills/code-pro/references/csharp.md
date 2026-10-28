# C# / .NET auf Profi-Niveau

Zielplattform: **.NET 10 (LTS) mit C# 14** für Neues. In bestehenden Projekten gilt das `TargetFramework`/`LangVersion` des Projekts. Features oberhalb davon nicht verwenden.

## Projekt-Grundlage (neue Lösungen)
`Directory.Build.props` im Lösungsordner:
```xml
<Project>
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <TreatWarningsAsErrors>true</TreatWarningsAsErrors>
    <AnalysisLevel>latest-recommended</AnalysisLevel>
    <EnforceCodeStyleInBuild>true</EnforceCodeStyleInBuild>
    <InvariantGlobalization>true</InvariantGlobalization> <!-- nur wenn keine Kultur-abhängige Formatierung gebraucht wird -->
  </PropertyGroup>
</Project>
```
- Paketversionen zentral in `Directory.Packages.props` (`<ManagePackageVersionsCentrally>true</ManagePackageVersionsCentrally>`).
- `.editorconfig` mit Stilregeln; `dotnet format` muss sauber laufen.
- Struktur: `src/<Projekt>/`, `tests/<Projekt>.Tests/`, Lösung als `.slnx`.
- Kleine Tools und Skripte als Datei-App: `dotnet run tool.cs` mit Direktiven `#:package Name@Version` und `#:property Nullable=enable`. Kein Projekt nötig. Datei-Apps sind standardmäßig Native-AOT (`PublishAot=true`): reflection-lastige APIs lösen Trimming-Warnungen aus. Dann AOT-taugliche Alternativen nutzen oder `#:property PublishAot=false` setzen.

## Moderne Sprache (verwenden)
```csharp
// Primary Constructor + DI, sealed als Standard
public sealed class OrderService(IOrderRepository repo, TimeProvider clock, ILogger<OrderService> log)
{
    public async Task<Order?> GetAsync(OrderId id, CancellationToken ct) => await repo.FindAsync(id, ct);
}

// Records für Werte/DTOs, readonly record struct für kleine Werttypen (stark typisierte IDs)
public readonly record struct OrderId(Guid Value);
public sealed record OrderDto(OrderId Id, string Customer, decimal Total);

// required + init, field-Keyword (C# 14) für Validierung ohne Backing-Field
public sealed class Customer
{
    public required string Name { get; init => field = value.Trim(); }
}

// Collection Expressions, Pattern Matching, Switch-Ausdrücke
int[] primes = [2, 3, 5, 7];
string Describe(Shape s) => s switch
{
    Circle { Radius: > 10 } => "groß",
    Circle c => $"Kreis {c.Radius}",
    Rect(var w, var h) when w == h => "Quadrat",
    _ => "unbekannt",
};

// Extension Members (C# 14)
public static class StringExtensions
{
    extension(string s)
    {
        public bool IsBlank => string.IsNullOrWhiteSpace(s);
    }
}

// Guard Clauses aus der BCL
ArgumentNullException.ThrowIfNull(input);
ArgumentOutOfRangeException.ThrowIfNegativeOrZero(count);
ArgumentException.ThrowIfNullOrWhiteSpace(name);
```

## Async richtig
- Async durchgängig: kein `.Result`, kein `.Wait()`, kein `async void` (außer Event-Handler).
- Jede async-API nimmt `CancellationToken ct` als letzten Parameter und reicht ihn weiter.
- `ConfigureAwait(false)` in Bibliotheken; in ASP.NET-Core-Apps nicht nötig.
- Parallel unabhängige Arbeit: `await Task.WhenAll(a, b)`. Begrenzte Parallelität: `Parallel.ForEachAsync(items, new ParallelOptions { MaxDegreeOfParallelism = 4, CancellationToken = ct }, …)`.
- `ValueTask` nur bei heißen Pfaden, die meist synchron fertig sind. Sonst `Task`.
- Hintergrundarbeit: `BackgroundService` + `PeriodicTimer`, kein `Task.Run` ohne Besitzer.
- Producer/Consumer: `System.Threading.Channels`.

## Fehlerbehandlung
- Exceptions für Unerwartetes. Erwartbare Fachfehler (Validierung, nicht gefunden) als Rückgabewert (`Result<T>`, `bool TryX(out …)`, `null` bei `Find`).
- Nie `catch (Exception)` ohne Logging und Weiterwerfen oder bewusste Behandlung. Nie leer fangen.
- Neu werfen mit `throw;`, nicht `throw ex;`.
- ASP.NET Core: `ProblemDetails` (`builder.Services.AddProblemDetails()`, `app.UseExceptionHandler()`), `TypedResults` in Minimal APIs.

## Dependency Injection, Konfiguration, Logging
- Konstruktor-Injektion, keine Service-Locator-Aufrufe (`GetService` in Fachcode).
- Lebensdauern: zustandslos → Singleton; pro Request (DbContext) → Scoped; nie Scoped in Singleton injizieren.
- Optionen typisiert und beim Start validiert:
```csharp
builder.Services.AddOptions<SmtpOptions>()
    .BindConfiguration("Smtp")
    .ValidateDataAnnotations()
    .ValidateOnStart();

// AOT/Trimming-tauglich (statt ValidateDataAnnotations): Validator per Source-Generator
[OptionsValidator]
public sealed partial class SmtpOptionsValidator : IValidateOptions<SmtpOptions>;
// builder.Services.AddSingleton<IValidateOptions<SmtpOptions>, SmtpOptionsValidator>();
```
- `HttpClient` nur über `IHttpClientFactory` (`AddHttpClient<TClient>()`), Resilienz mit `Microsoft.Extensions.Http.Resilience` (`.AddStandardResilienceHandler()`).
- Strukturiertes Logging mit Platzhaltern, nie String-Interpolation. Heiße Pfade per Source-Generator:
```csharp
static partial class Log
{
    [LoggerMessage(Level = LogLevel.Warning, Message = "Tag {TagPath} ungültig: {Reason}")]
    public static partial void InvalidTag(this ILogger logger, string tagPath, string reason);
}
```
- Zeit über `TimeProvider` (testbar mit `FakeTimeProvider`), nie `DateTime.Now`. Zeitpunkte als `DateTimeOffset`/UTC.

## Daten und Text
- Parsen/Formatieren maschinenlesbarer Daten (CSV, JSON, Protokolle) immer mit `CultureInfo.InvariantCulture`, sonst wird `1,5` je nach Systemsprache falsch gelesen.
- String-Vergleiche explizit: `StringComparison.Ordinal`/`OrdinalIgnoreCase` (Schlüssel, Pfade, IDs), `CurrentCulture` nur für Anzeige/Sortierung.
- `System.Text.Json` mit Source-Generator (`JsonSerializerContext`) für Performance und AOT. Optionen einmal anlegen und wiederverwenden.
- Regex mit `[GeneratedRegex]`.
- Unveränderliche Nachschlagetabellen: `FrozenDictionary`/`FrozenSet`. Suche nach Zeichenmengen: `SearchValues<char>`.

## EF Core
- Lesen: `AsNoTracking()` und Projektion auf DTO (`Select`) statt ganzer Entitäten.
- N+1 vermeiden: `Include` gezielt oder Projektion; keine Abfragen in Schleifen.
- `async`-Varianten mit `ct`; Massenänderungen mit `ExecuteUpdateAsync`/`ExecuteDeleteAsync`.
- Migrationen versioniert, nie `EnsureCreated` in Produktion.
- Rohes SQL nur parametrisiert (`FromSql($"… {wert}")` ist parametrisiert, `FromSqlRaw` mit Verkettung nicht).

## Performance (erst messen: BenchmarkDotNet, `dotnet-counters`, `dotnet-trace`)
- Allokationen vermeiden in heißen Pfaden: `Span<T>`/`ReadOnlySpan<char>`, `stackalloc` für kleine Puffer, `ArrayPool<T>.Shared`, `StringBuilder` statt `+` in Schleifen.
- LINQ ist in normalem Code gut. In sehr heißen Schleifen stattdessen `foreach`/`for`.
- `sealed` Klassen, `static` Lambdas, `CollectionsMarshal.AsSpan` für `List<T>`.
- Größen vorab setzen: `new List<T>(capacity)`, `new Dictionary<K,V>(capacity)`.

## Tests
- Bestehendes Framework des Projekts verwenden. Für neue Projekte: xUnit (`xunit.v3`), Assertions mit `Assert` oder Shouldly/AwesomeAssertions. FluentAssertions ab v8 ist kommerziell lizenziert.
- Benennung `Methode_Zustand_Erwartung`, Aufbau Arrange/Act/Assert, ein Verhalten pro Test.
- `[Theory]` + `[InlineData]` für Varianten und Randfälle.
- Keine echten Zeit-, Zufalls- oder Netzabhängigkeiten: `TimeProvider`, Seeds, `HttpMessageHandler`-Fakes. Integrationstests für ASP.NET Core mit `WebApplicationFactory<Program>`, Datenbanken mit Testcontainers.
- Mocks sparsam (NSubstitute). Lieber kleine echte Implementierungen (In-Memory-Repository).

## Sicherheit
- Secrets nie im Code oder in `appsettings.json` im Repo: User Secrets (lokal), Umgebungsvariablen/Key Vault (Prod).
- Eingaben validieren; Pfade gegen Basisordner prüfen (`Path.GetFullPath` + `StartsWith(basis, StringComparison.Ordinal)`).
- Kein `BinaryFormatter`, kein `Process.Start` mit zusammengesetzten Argumenten (stattdessen `ArgumentList`).
- Abhängigkeiten prüfen: `dotnet package list --vulnerable`.

## Anti-Patterns (immer korrigieren)
| Falsch | Richtig |
|---|---|
| `async void Foo()` | `async Task Foo()` |
| `task.Result`, `.Wait()` | `await task` |
| `new HttpClient()` pro Aufruf | `IHttpClientFactory` |
| `DateTime.Now` | `TimeProvider.GetUtcNow()` |
| `double.Parse(text)` | `double.Parse(text, CultureInfo.InvariantCulture)` |
| `str1.ToLower() == str2.ToLower()` | `string.Equals(a, b, StringComparison.OrdinalIgnoreCase)` |
| `catch (Exception) { }` | gezielt fangen, loggen, weiterwerfen |
| `throw ex;` | `throw;` |
| `$"…{x}…"` in `logger.LogX` | Platzhalter `"… {X} …", x` |
| `public List<T> Items { get; set; }` | `IReadOnlyList<T>` nach außen, Liste intern |
| Statische veränderliche Felder | DI-Singleton mit klarer Thread-Sicherheit |
| `lock` über `await` | `SemaphoreSlim.WaitAsync` |
| `GC.Collect()` | Ursache der Allokationen beheben |
