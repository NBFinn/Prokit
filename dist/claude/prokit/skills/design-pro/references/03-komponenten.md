# 03 – Komponenten und Muster

Für jede Komponente gilt: Zustände default · hover · focus-visible · active · disabled (· loading · error, wo sinnvoll).

## Buttons
- Hierarchie: **Primary** (gefüllt, Akzent; max. 1 pro Bereich) · **Secondary** (Rahmen oder Neutral-Fläche) · **Ghost** (nur Text, Hover-Fläche) · **Destructive** (Rot, nur bei Zerstörung).
- Größen: sm 32px · md 40px · lg 48px Höhe. Padding horizontal ≈ 1.5–2× vertikal.
- Label: Verb + Objekt ("Projekt anlegen", nicht "OK"/"Absenden").
- Loading: Spinner ersetzt Icon, Breite bleibt gleich, `aria-busy="true"`, Button deaktiviert.
- Fokus: `focus-visible:ring-2 ring-offset-2 ring-[--ring]`.
- Tailwind-Basis: `inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50`.

## Formulare
- Label immer sichtbar über dem Feld (Placeholder ist kein Label).
- Höhe 40–44px, Radius wie Buttons, Rahmen Neutral-300, Fokus = Akzent-Ring.
- Fehler: roter Rahmen + Icon + Text unter dem Feld, erst nach Verlassen (onBlur) oder Absenden validieren. Fehlermeldung sagt, wie man es behebt.
- Hilfstext unter dem Feld, Neutral-500, 13–14px.
- Einspaltig ist schneller auszufüllen als mehrspaltig. Zusammengehöriges (PLZ + Ort) darf nebeneinander.
- Pflichtfelder: lieber optionale markieren ("optional"), wenn die meisten Pflicht sind.
- Passende `type`, `inputmode`, `autocomplete` setzen.

## Karten
- Padding 20–24px, Radius lg, entweder Rahmen ODER Schatten (in Light Mode), nicht beides stark.
- Ganze Karte klickbar → Hover hebt leicht an (`translateY(-2px)` + Schatten) und ein Link umfasst den Titel (`after:absolute inset-0`).
- Inhalt: Medium → Titel → Beschreibung (max. 2–3 Zeilen, `line-clamp`) → Meta/Aktion unten bündig (`mt-auto`).

## Navigation
- Top-Nav: Logo links, 4–6 Links, eine CTA rechts. Höhe 56–64px. Sticky mit `backdrop-blur` + halbtransparentem Hintergrund + 1px-Rahmen beim Scrollen.
- Sidebar (Apps): 240–280px, Gruppen mit Eyebrow-Labels, aktiver Eintrag = Fläche + Akzent-Text, Icons 16–20px. Einklappbar auf 64px.
- Mobile: Bottom-Tab-Bar (3–5 Ziele) für Apps; Hamburger-Sheet für Websites.
- Breadcrumbs ab Tiefe 3.

## Tabellen & Daten
- Zahlen rechtsbündig + `tabular-nums`, Text linksbündig.
- Zeilenhöhe 44–52px (komfortabel) / 36px (dicht). Zebra-Streifen nur bei sehr breiten Tabellen; sonst feine Trennlinien.
- Kopfzeile sticky, 12–13px, Neutral-500, medium.
- Leerer Zustand: Illustration/Icon + Satz was fehlt + Primär-Aktion.
- Loading: Skeleton-Zeilen in Form der echten Daten.

## Dashboards / KPI
- Oben 3–4 KPI-Karten: Label (klein, gedämpft) → Wert (groß, tabular) → Trend (+12,4 % grün mit Pfeil, Zeitraum).
- Diagramme: max. 5–6 Farben, Achsen und Gitter dezent (Neutral-200), direkte Beschriftung statt Legende wenn möglich.
- Wichtigste Information oben links.

## Modals & Overlays
- Breite 400–560px, Padding 24px, Titel + Beschreibung + Aktionen rechts unten (Primär ganz rechts).
- Schließen per Esc, Klick auf Backdrop, X-Button. Fokus wird im Modal gefangen und kehrt danach zurück.
- Destruktive Bestätigung: Aktion im Button-Text wiederholen ("Projekt löschen").
- Mobile: Bottom-Sheet statt zentriertem Modal.

## Feedback
- Toast: unten rechts (Desktop) / oben (Mobile), 4–6 s, mit "Rückgängig" statt Bestätigungsdialog bei reversiblen Aktionen.
- Inline-Alerts: Icon + Titel + Text, getönter Hintergrund (Farbe-50) + Text (Farbe-800).
- Optimistische UI: Änderung sofort zeigen, bei Fehler zurückrollen.

## Leere Zustände, Loading, Fehler
- **Empty**: Erkläre den Wert und biete die erste Aktion an. Kein trauriger Smiley ohne Weg nach vorn.
- **Loading**: < 300ms nichts zeigen; bis 2s Skeleton; > 2s Fortschritt mit Text.
- **Error**: Was ist passiert (ohne Fehlercode-Jargon), was kann ich tun, Button "Erneut versuchen".

## Landingpage-Struktur (bewährt)
1. Nav · 2. Hero (Headline mit Nutzen, Subline mit Wie, 1 Primär- + 1 Sekundär-CTA, Produktbild) · 3. Social Proof (Logos) · 4. Problem → Lösung · 5. Features als Bento-Grid mit echten UI-Ausschnitten · 6. Kennzahlen/Testimonial · 7. Preise (3 Stufen, mittlere hervorgehoben) · 8. FAQ · 9. Abschluss-CTA · 10. Footer.

## Preis-Tabellen
- 3 Stufen, empfohlene in der Mitte mit Akzent-Rahmen und Badge.
- Preis groß + tabular, Zeitraum klein daneben. Jahres/Monats-Toggle mit Ersparnis ("2 Monate gratis").
- Feature-Liste mit Check-Icons, Unterschiede zuerst.

## Mobile-spezifisch
- Daumen-Zone: Hauptaktionen unten.
- Touch-Ziele ≥ 44×44px, Abstand ≥ 8px.
- Safe-Areas: `padding-bottom: env(safe-area-inset-bottom)`.
- Inputs mind. 16px Schrift (sonst zoomt iOS).
