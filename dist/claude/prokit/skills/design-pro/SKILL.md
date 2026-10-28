---
name: design-pro
disable-model-invocation: true
description: Exakte Farbwerte für UI-Arbeit. Nutzen, wenn WCAG-Kontraste geprüft, Farbabstufungen (Hover, Disabled), ein Token-Set, eine Typo- oder Abstandsskala berechnet oder CSS auf Designfehler geprüft werden soll.
metadata:
  short-description: Exakte Farb- und Kontrastwerte
---

# Design Pro

Gestalte mit deinem eigenen Urteil. Dieser Skill liefert nur exakte Rechenwerte statt Schätzungen.

## Rechner

`node scripts/design.mjs contrast <vorne> <hinten> [<vorne> <hinten> …]` prüft alle Paare in **einem** Aufruf, bei Fehlern mit Vorschlag im gleichen Farbton.

Weitere Befehle: `palette <hex>` (Stufen 50–950 für Hover/Disabled), `tokens <markenfarbe> [css|tailwind|json]`, `type`, `spacing`, `harmony <hex>`, `audit <datei.css>`.

Jeder zusätzliche Aufruf schickt den ganzen Kontext erneut: Prüfungen bündeln, nur neue Farbkombinationen prüfen.

## Referenzen (nur auf Wunsch)

In `references/`: Prinzipien, Komponenten, Barrierefreiheit (WCAG 2.2), Kritik-Schema, Rezepte. Nur lesen, wenn der Nutzer ausdrücklich Kritik, ein Audit oder Barrierefreiheit verlangt.
