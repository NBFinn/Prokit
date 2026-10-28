# 04 – Barrierefreiheit (WCAG 2.2 AA)

## Kontrast
| Element | Minimum (AA) | Ideal (AAA) |
|---|---|---|
| Fließtext (< 24px bzw. < 18.66px fett) | 4.5:1 | 7:1 |
| Großer Text (≥ 24px oder ≥ 18.66px fett) | 3:1 | 4.5:1 |
| UI-Komponenten, Fokusring, Icons mit Bedeutung | 3:1 | – |
| Deaktivierte Elemente, Deko | keine Pflicht | – |

Immer mit `check_contrast` prüfen. Häufige Falle: grauer Placeholder/Hilfstext (#9ca3af auf Weiß = 2.5:1, durchgefallen; #6b7280 = 4.8:1, bestanden).

## Tastatur
- Alles Bedienbare per Tab erreichbar, Reihenfolge = visuelle Reihenfolge.
- **Fokus sichtbar** (2.4.7) und **nicht verdeckt** (2.4.11, neu in 2.2, z. B. durch Sticky-Header: `scroll-padding-top` setzen).
- Nie `outline: none` ohne Ersatz. Standard: `:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }`.
- Skip-Link "Zum Inhalt springen" als erstes Element.
- Modals: Fokus fangen, Esc schließt, Fokus zurück zum Auslöser.

## Zielgrößen (2.5.8, neu)
- Minimum 24×24px (AA), empfohlen 44×44px. Kleine Icons durch Padding vergrößern.

## Semantik
- Echte Elemente: `<button>` für Aktionen, `<a href>` für Navigation. Nie `<div onclick>`.
- Eine `<h1>` pro Seite, Überschriften ohne Sprünge.
- Landmarks: `<header> <nav> <main> <aside> <footer>`.
- Jedes Input hat ein `<label for>`; Gruppen in `<fieldset><legend>`.
- Icon-Buttons: `aria-label="Menü öffnen"`; dekorative Icons `aria-hidden="true"`.
- Bilder: aussagekräftiges `alt`; dekorativ `alt=""`.
- Dynamische Meldungen: `role="status"` (höflich) bzw. `role="alert"` (dringend).
- `lang`-Attribut auf `<html>`.

## Formulare
- Fehler mit `aria-invalid="true"` und `aria-describedby` auf die Fehlermeldung.
- Nicht nur Farbe: Icon + Text.
- `autocomplete` für persönliche Daten (1.3.5). Keine Wiedereingabe bereits gegebener Infos (3.3.7, neu).
- Kein kognitiver Test beim Login ohne Alternative (3.3.8, neu): Passwort-Manager und Einfügen erlauben.

## Bewegung
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; scroll-behavior: auto !important; }
}
```
- Nichts blinkt mehr als 3× pro Sekunde. Autoplay-Inhalte > 5 s brauchen Pause.

## Zoom & Reflow
- Bei 200 % Zoom und 320px Breite kein horizontales Scrollen (1.4.10).
- Schriftgrößen in rem, Container nicht mit fester Höhe für Text.
- Text-Abstände anpassbar (1.4.12): keine abgeschnittenen Texte bei größerer line-height.

## Schnell-Audit-Checkliste
□ Kontraste geprüft □ Fokus sichtbar & nicht verdeckt □ Tab-Reihenfolge logisch □ Alle Inputs gelabelt □ Icon-Buttons benannt □ Alt-Texte □ Überschriften-Hierarchie □ Fehler textuell □ reduced-motion □ 320px ohne H-Scroll □ Zielgrößen ≥ 24px
