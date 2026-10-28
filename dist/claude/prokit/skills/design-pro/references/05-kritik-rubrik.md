# 05 – Kritik-Rubrik

Bewerte jedes Design in 8 Kategorien mit 1–5 Punkten. Gesamt = Summe × 2.5 (max. 100).

| # | Kategorie | 1 – schwach | 3 – solide | 5 – exzellent |
|---|---|---|---|---|
| 1 | **Hierarchie & Fokus** | Alles gleich laut, kein Einstieg | Hauptaktion erkennbar | Squint-Test sofort klar, perfekte Lesereihenfolge |
| 2 | **Layout & Raster** | Willkürliche Positionen | Raster erkennbar, kleine Abweichungen | Alles fluchtet, bewusster Rhythmus, gezielte Asymmetrie |
| 3 | **Abstände & Weißraum** | Gedrängt oder zufällig | Skala größtenteils eingehalten | Großzügig, Nähe-Gesetz perfekt angewendet |
| 4 | **Typografie** | Zu viele Größen/Fonts, schlechte Zeilenlänge | Klare Skala, gut lesbar | Charaktervolles Pairing, feine Details (Tracking, Balance, Ziffern) |
| 5 | **Farbe** | Unkontrolliert, Kontrastfehler | Konsistente Palette, AA erfüllt | Präziser Akzenteinsatz, getönte Neutrale, starker Dark Mode |
| 6 | **Konsistenz & System** | Jede Komponente anders | Wiederkehrende Muster | Token-basiert, ein Radius, eine Sprache |
| 7 | **Usability & Zustände** | Unklare Aktionen, fehlende Zustände | Standard-Zustände vorhanden | Alle Zustände gestaltet, Fehler vermeiden statt melden |
| 8 | **Charakter & Inhalt** | Generisch, KI-Klischees, Floskeln | Ordentlich, aber austauschbar | Eigenständig, merkbar, konkrete Inhalte |

## Ausgabeformat für /kritik
```
**Gesamt: 64/100**: [ein Satz Urteil]

| Kategorie | Punkte | Kurzbegründung |
...

### Top-5-Fixes (nach Wirkung)
1. **[Problem]** → [konkreter Fix mit Wert, z. B. "Abstand Hero→Logos von 24 auf 96px"]
...

### Was schon gut ist
- …

### Verbesserte Version
[vollständiger Code]
```

## Priorisierung der Fixes
Wirkung absteigend: (1) Barrierefreiheit-Blocker → (2) Hierarchie/Fokus → (3) Abstände → (4) Typografie → (5) Konsistenz → (6) Farbe → (7) Politur.
Ein Fix muss messbar formuliert sein: Wert vorher → Wert nachher.

## Heuristiken (Nielsen) als Zusatz-Check
Systemstatus sichtbar · Sprache der Nutzer · Kontrolle & Rückgängig · Konsistenz · Fehlervermeidung · Wiedererkennen statt Erinnern · Effizienz für Profis · Minimalismus · Hilfreiche Fehlermeldungen · Hilfe.
