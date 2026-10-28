# 06 – Rezepte und Code-Bausteine

## Ästhetische Richtungen (wähle bewusst eine)
| Richtung | Schrift | Farbe | Form | Passt zu |
|---|---|---|---|---|
| **Technisch-präzise** (Linear, Vercel) | Geist / Inter Display, Mono-Akzente | Fast-Schwarz + 1 Neon-Akzent, Dark first | Radius 6–8, 1px-Rahmen, feine Gitter | Dev-Tools, SaaS |
| **Editorial** | Instrument Serif / Fraunces + Grotesk | Papier-Off-White, Tinte, 1 Akzent | Große Typo, Spalten, Linien, Radius 0 | Medien, Agenturen, Portfolios |
| **Warm-organisch** | DM Sans / Plus Jakarta + weiche Serif | Erdtöne, Creme, Salbei, Terracotta | Radius 16–24, weiche Schatten | Wellness, Food, Lifestyle |
| **Luxuriös-ruhig** | Cormorant / Didone + feine Grotesk | Schwarz, Elfenbein, Gold sparsam | Viel Raum, dünne Linien, kein Radius | Mode, Hotels, Premium |
| **Brutalistisch** | Space Grotesk / Archivo Black, Mono | Hoher Kontrast, Primärfarben | Harte Schatten (4px 4px 0 #000), dicke Rahmen | Kreative, Events, Gen Z |
| **Verspielt** | Rundliche Grotesk (Nunito, Recoleta) | Pastell + kräftiger Akzent | Radius groß, Illustrationen, Bounce | Consumer-Apps, Kinder, Lernen |
| **Swiss/Minimal** | Neue-Haas-Alternative (Inter Tight) | Weiß, Schwarz, 1 Signalfarbe | Strenges Raster, linksbündig | Architektur, Corporate |

## Hero-Muster
```html
<section class="relative overflow-hidden">
  <div class="mx-auto max-w-6xl px-6 pt-24 pb-20 md:pt-32 grid md:grid-cols-12 gap-12 items-center">
    <div class="md:col-span-6">
      <p class="text-sm font-medium tracking-wide uppercase text-[--primary]">Neu: Version 2.0</p>
      <h1 class="mt-4 text-5xl md:text-6xl font-semibold tracking-tight leading-[1.05] text-balance">
        Rechnungen in <em class="font-serif italic font-normal">30 Sekunden</em> statt 30 Minuten.
      </h1>
      <p class="mt-6 text-lg text-[--text-muted] max-w-[52ch] text-pretty">Konkreter Nutzen in einem Satz, mit dem Wie.</p>
      <div class="mt-8 flex flex-wrap gap-3">
        <a href="#" class="h-11 px-5 inline-flex items-center rounded-lg bg-[--primary] text-[--primary-foreground] font-medium shadow-sm hover:bg-[--primary-hover] transition-colors">Kostenlos starten</a>
        <a href="#" class="h-11 px-5 inline-flex items-center rounded-lg font-medium hover:bg-[--surface] transition-colors">Demo ansehen →</a>
      </div>
      <p class="mt-4 text-sm text-[--text-subtle]">Keine Kreditkarte · 14 Tage testen</p>
    </div>
    <div class="md:col-span-6 md:translate-x-8">
      <!-- echter Produkt-Screenshot, rounded-xl, ring-1 ring-black/5, shadow-2xl -->
    </div>
  </div>
</section>
```

## Bento-Grid statt 3 Feature-Karten
```html
<div class="grid grid-cols-1 md:grid-cols-6 gap-4">
  <div class="md:col-span-4 md:row-span-2 rounded-2xl bg-[--surface] p-8">Hauptfeature mit UI-Ausschnitt</div>
  <div class="md:col-span-2 rounded-2xl bg-[--surface] p-6">Kennzahl groß</div>
  <div class="md:col-span-2 rounded-2xl bg-[--surface] p-6">Integration-Logos</div>
  <div class="md:col-span-3 rounded-2xl bg-[--surface] p-6">Feature</div>
  <div class="md:col-span-3 rounded-2xl bg-[--surface] p-6">Feature</div>
</div>
```

## Hochwertige Details
```css
/* Feines Rauschen gegen "flache" Flächen */
.noise { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='.8'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.04'/%3E%3C/svg%3E"); }

/* Licht-Glow hinter einem Element */
.glow::before { content:""; position:absolute; inset:-20%; background: radial-gradient(closest-side, color-mix(in oklch, var(--primary) 35%, transparent), transparent); filter: blur(40px); z-index:-1; }

/* Gitterhintergrund (technisch) */
.grid-bg { background-image: linear-gradient(to right, rgb(0 0 0 / .05) 1px, transparent 1px), linear-gradient(to bottom, rgb(0 0 0 / .05) 1px, transparent 1px); background-size: 48px 48px; mask-image: radial-gradient(ellipse at top, #000 40%, transparent 75%); }

/* Premium-Button-Glanz */
.btn-primary { box-shadow: inset 0 1px 0 rgb(255 255 255 / .2), 0 1px 2px rgb(0 0 0 / .1); }

/* Gradient-Rahmen */
.gradient-border { border: 1px solid transparent; background: linear-gradient(var(--surface), var(--surface)) padding-box, linear-gradient(135deg, var(--primary), transparent 60%) border-box; }
```

## Motion-Rezepte
```css
/* Eintritt beim Scrollen, ohne JS */
@keyframes rise { from { opacity: 0; transform: translateY(12px); } }
.reveal { animation: rise .6s cubic-bezier(.16,1,.3,1) both; animation-timeline: view(); animation-range: entry 0% cover 25%; }

/* Gestaffelt */
.stagger > * { animation: rise .5s cubic-bezier(.16,1,.3,1) both; }
.stagger > *:nth-child(2) { animation-delay: 60ms; } .stagger > *:nth-child(3) { animation-delay: 120ms; }

/* Taktiles Drücken */
.pressable:active { transform: scale(.98); }
```
Framer Motion: `initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{type:"spring",stiffness:300,damping:30}}`.

## Dashboard-Grundgerüst
- Layout: Sidebar 260px + Header 56px + Content mit `max-w-7xl`, Padding 24–32.
- Reihenfolge: Seitentitel + Datumsfilter + Primäraktion → KPI-Reihe (4) → Hauptdiagramm (8 Spalten) + Nebenliste (4 Spalten) → Tabelle.
- Dichte: Text 14px, Tabellenzeilen 44px, Karten-Padding 20px.

## Mobile-App-Screen
- Großer Titel (34px, fett) der beim Scrollen in die Nav-Bar schrumpft.
- Listen mit 56–72px Zeilen, Swipe-Aktionen.
- Bottom-Tabs 5 max., aktive mit gefülltem Icon.
- Primäraktion als fixierter Button unten in der Daumenzone, volle Breite, 52px.

## UX-Texte (Kurzregeln)
- Buttons: Verb zuerst, konkret ("Rechnung senden").
- Fehler: Was + Warum + Lösung, ohne Schuldzuweisung ("Die Karte wurde abgelehnt. Prüfe das Ablaufdatum oder nutze eine andere Karte.").
- Empty States: Nutzen + Aktion ("Noch keine Projekte. Lege dein erstes an. Das dauert 1 Minute.").
- Headlines: Nutzen statt Feature, Zahl statt Adjektiv.
- Satzanfang groß, Rest klein (Sentence case) in Buttons und Titeln.
