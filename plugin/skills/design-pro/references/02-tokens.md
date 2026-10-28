# 02 – Geprüfte Design-Tokens

Alle Werte wurden mit den Design-Pro-Tools berechnet (OKLCH-Skalen, WCAG-Kontrast). Nutze sie, wenn die Tools nicht erreichbar sind.

## Farbskalen

### blue (Basis #2563eb)

| Stufe | Hex | Kontrast auf Weiß | Text auf Weiß ok |
|---|---|---|---|
| 50 | `#f3f7ff` | 1.07:1 | nein |
| 100 | `#e1ecff` | 1.19:1 | nein |
| 200 | `#c3d8ff` | 1.44:1 | nein |
| 300 | `#9bbeff` | 1.87:1 | nein |
| 400 | `#6e9fff` | 2.6:1 | nein |
| 500 | `#3f7dff` | 3.76:1 | nein |
| 600 | `#2560df` | 5.5:1 | ja |
| 700 | `#184ab8` | 7.75:1 | ja |
| 800 | `#0d3690` | 10.78:1 | ja |
| 900 | `#052368` | 14.52:1 | ja |
| 950 | `#011244` | 17.93:1 | ja |

### violet (Basis #7c3aed)

| Stufe | Hex | Kontrast auf Weiß | Text auf Weiß ok |
|---|---|---|---|
| 50 | `#f7f5ff` | 1.08:1 | nein |
| 100 | `#ebe8ff` | 1.2:1 | nein |
| 200 | `#d8d0ff` | 1.46:1 | nein |
| 300 | `#c0b0ff` | 1.93:1 | nein |
| 400 | `#a78aff` | 2.72:1 | nein |
| 500 | `#905eff` | 4.01:1 | nein |
| 600 | `#783ce3` | 5.91:1 | ja |
| 700 | `#6029bb` | 8.29:1 | ja |
| 800 | `#491a92` | 11.38:1 | ja |
| 900 | `#320d6a` | 14.99:1 | ja |
| 950 | `#1d0245` | 18.31:1 | ja |

### emerald (Basis #059669)

| Stufe | Hex | Kontrast auf Weiß | Text auf Weiß ok |
|---|---|---|---|
| 50 | `#eefaf4` | 1.07:1 | nein |
| 100 | `#d9f2e5` | 1.18:1 | nein |
| 200 | `#b6e4cd` | 1.4:1 | nein |
| 300 | `#86d0ae` | 1.8:1 | nein |
| 400 | `#53b88d` | 2.44:1 | nein |
| 500 | `#1a9d70` | 3.44:1 | nein |
| 600 | `#008059` | 4.96:1 | ja |
| 700 | `#006646` | 7.03:1 | ja |
| 800 | `#004c33` | 10.09:1 | ja |
| 900 | `#003522` | 13.7:1 | ja |
| 950 | `#001f12` | 17.43:1 | ja |

### rose (Basis #e11d48)

| Stufe | Hex | Kontrast auf Weiß | Text auf Weiß ok |
|---|---|---|---|
| 50 | `#fff4f4` | 1.08:1 | nein |
| 100 | `#ffe4e4` | 1.2:1 | nein |
| 200 | `#ffc7c8` | 1.47:1 | nein |
| 300 | `#ff9fa2` | 1.96:1 | nein |
| 400 | `#ff6876` | 2.8:1 | nein |
| 500 | `#ee2f52` | 4.07:1 | nein |
| 600 | `#c9033b` | 5.9:1 | ja |
| 700 | `#a1002d` | 8.22:1 | ja |
| 800 | `#7b0020` | 11.27:1 | ja |
| 900 | `#570014` | 14.84:1 | ja |
| 950 | `#360009` | 18.09:1 | ja |

### amber (Basis #d97706)

| Stufe | Hex | Kontrast auf Weiß | Text auf Weiß ok |
|---|---|---|---|
| 50 | `#fff5ed` | 1.07:1 | nein |
| 100 | `#ffe6d3` | 1.2:1 | nein |
| 200 | `#fccdaa` | 1.45:1 | nein |
| 300 | `#f3ac74` | 1.92:1 | nein |
| 400 | `#e2893a` | 2.67:1 | nein |
| 500 | `#c66b00` | 3.82:1 | nein |
| 600 | `#a05600` | 5.49:1 | ja |
| 700 | `#804300` | 7.72:1 | ja |
| 800 | `#613200` | 10.69:1 | ja |
| 900 | `#442100` | 14.35:1 | ja |
| 950 | `#291100` | 17.88:1 | ja |

### slate (Basis #64748b)

| Stufe | Hex | Kontrast auf Weiß | Text auf Weiß ok |
|---|---|---|---|
| 50 | `#f5f7fa` | 1.07:1 | nein |
| 100 | `#e7ebf2` | 1.2:1 | nein |
| 200 | `#d0d8e4` | 1.44:1 | nein |
| 300 | `#b2bfd0` | 1.87:1 | nein |
| 400 | `#93a3b9` | 2.57:1 | nein |
| 500 | `#77879f` | 3.65:1 | nein |
| 600 | `#5e6d82` | 5.27:1 | ja |
| 700 | `#495669` | 7.45:1 | ja |
| 800 | `#36404f` | 10.48:1 | ja |
| 900 | `#242c37` | 14.09:1 | ja |
| 950 | `#131921` | 17.67:1 | ja |

Faustregeln: Text auf Weiß ab Stufe 600 (meist), Text auf Dunkel bis Stufe 300. Flächen-Hintergründe 50–100, Rahmen 200–300, Buttons 600, Hover 700.

## Typografie-Skala (16px, Major Third 1.25, fluid 360→1280px)

| Name | Desktop px | Mobile px | CSS | line-height | letter-spacing |
|---|---|---|---|---|---|
| xs | 10.2 | 11.7 | `clamp(0.731rem, 0.766rem + -0.157vw, 0.64rem)` | 1.6 | 0 |
| sm | 12.8 | 13.7 | `clamp(0.855rem, 0.876rem + -0.095vw, 0.8rem)` | 1.6 | 0 |
| base | 16 | 16 | `1rem` | 1.6 | 0 |
| lg | 20 | 18.7 | `clamp(1.17rem, 1.139rem + 0.139vw, 1.25rem)` | 1.45 | 0 |
| xl | 25 | 21.9 | `clamp(1.369rem, 1.293rem + 0.337vw, 1.563rem)` | 1.25 | -0.01em |
| 2xl | 31.3 | 25.6 | `clamp(1.602rem, 1.464rem + 0.611vw, 1.953rem)` | 1.25 | -0.01em |
| 3xl | 39.1 | 30 | `clamp(1.874rem, 1.652rem + 0.987vw, 2.441rem)` | 1.1 | -0.02em |
| 4xl | 48.8 | 35.1 | `clamp(2.192rem, 1.856rem + 1.494vw, 3.052rem)` | 1.1 | -0.02em |
| 5xl | 61 | 41 | `clamp(2.565rem, 2.076rem + 2.173vw, 3.815rem)` | 1.1 | -0.02em |
| 6xl | 76.3 | 48 | `clamp(3.001rem, 2.31rem + 3.073vw, 4.768rem)` | 1.1 | -0.02em |

Weitere Ratios: 1.125 (dichte Apps, Dashboards), 1.2 (Produkt-UI), 1.25 (Allround), 1.333 (Marketing), 1.5+ (editorial, große Headlines).

## Abstände (4px-Raster)

`0px` · `2px` · `4px` · `6px` · `8px` · `12px` · `16px` · `20px` · `24px` · `32px` · `40px` · `48px` · `64px` · `80px` · `96px` · `128px`

Typisch: Icon↔Text 8 · Button-Padding 10×16 · Input-Höhe 40 · Karten-Padding 24 · Abstand Elemente in Karte 12–16 · zwischen Karten 24 · zwischen Sektionen 96–128 (Desktop) / 64 (Mobile).

## Radius, Schatten, Motion

- Radius: 0 (brutalistisch/editorial) · 4–6 (technisch, dicht) · 8 (Standard) · 12–16 (freundlich, Consumer) · 9999 (Pills, Avatare). Verschachtelt: innerer Radius = äußerer − Padding.
- Schatten sm: `0 1px 2px 0 rgb(0 0 0 / 0.05)`
- Schatten md: `0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)`
- Schatten lg: `0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)`
- Easing: `cubic-bezier(0.16, 1, 0.3, 1)` · Dauer 120ms (Hover) / 200ms (Panels) / 300ms (Modals)

## Beispiel: komplettes Token-Set (Marke #2563eb)

Kontrastprüfung: light text/background 17.76:1 · light text-muted/background 5.28:1 · light primary-foreground/primary 5.5:1 · dark text/background 16.56:1 · dark text-muted/background 6.91:1 · dark primary-foreground/primary 7.6:1

```css
:root {
  --primary-50: #f3f7ff;
  --primary-100: #e1ecff;
  --primary-200: #c3d8ff;
  --primary-300: #9bbeff;
  --primary-400: #6e9fff;
  --primary-500: #3f7dff;
  --primary-600: #2560df;
  --primary-700: #184ab8;
  --primary-800: #0d3690;
  --primary-900: #052368;
  --primary-950: #011244;
  --neutral-50: #f6f7f8;
  --neutral-100: #e9ebef;
  --neutral-200: #d4d8de;
  --neutral-300: #b9bec7;
  --neutral-400: #9ba2ad;
  --neutral-500: #808693;
  --neutral-600: #666c77;
  --neutral-700: #50555f;
  --neutral-800: #3c4048;
  --neutral-900: #282b31;
  --neutral-950: #16181d;
  --font-sans: Inter, ui-sans-serif, system-ui, sans-serif;
  --font-display: Inter, ui-sans-serif, system-ui, sans-serif;
  --radius-sm: 4px;
  --radius: 8px;
  --radius-lg: 12px;
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --duration-fast: 120ms;
  --duration-base: 200ms;
  --text-xs: clamp(0.731rem, 0.766rem + -0.157vw, 0.64rem);
  --text-sm: clamp(0.855rem, 0.876rem + -0.095vw, 0.8rem);
  --text-base: 1rem;
  --text-lg: clamp(1.17rem, 1.139rem + 0.139vw, 1.25rem);
  --text-xl: clamp(1.369rem, 1.293rem + 0.337vw, 1.563rem);
  --text-2xl: clamp(1.602rem, 1.464rem + 0.611vw, 1.953rem);
  --text-3xl: clamp(1.874rem, 1.652rem + 0.987vw, 2.441rem);
  --text-4xl: clamp(2.192rem, 1.856rem + 1.494vw, 3.052rem);
  --text-5xl: clamp(2.565rem, 2.076rem + 2.173vw, 3.815rem);
  --text-6xl: clamp(3.001rem, 2.31rem + 3.073vw, 4.768rem);
  --background: #ffffff;
  --surface: #f6f7f8;
  --surface-raised: #ffffff;
  --border: #d4d8de;
  --border-strong: #b9bec7;
  --text: #16181d;
  --text-muted: #666c77;
  --text-subtle: #808693;
  --primary: #2560df;
  --primary-hover: #184ab8;
  --primary-foreground: #ffffff;
  --primary-subtle: #f3f7ff;
  --primary-subtle-foreground: #184ab8;
  --ring: #3f7dff;
  --danger: #dc2626;
  --success: #16a34a;
  --warning: #d97706;
  color-scheme: light dark;
}

@media (prefers-color-scheme: dark) {
  :root {
    --background: #16181d;
    --surface: #282b31;
    --surface-raised: #3c4048;
    --border: #3c4048;
    --border-strong: #50555f;
    --text: #f6f7f8;
    --text-muted: #9ba2ad;
    --text-subtle: #808693;
    --primary: #6e9fff;
    --primary-hover: #9bbeff;
    --primary-foreground: #0a0a0a;
    --primary-subtle: #011244;
    --primary-subtle-foreground: #c3d8ff;
    --ring: #6e9fff;
    --danger: #f87171;
    --success: #4ade80;
    --warning: #fbbf24;
  }
}
```
