// Deterministische Design-Werkzeuge. Jede Funktion ist rein und gibt JSON-serialisierbare Daten zurück,
// damit sie direkt als MCP-Tool-Ergebnis zurückgegeben werden kann.

import { contrastRatio, formatOklch, hexToOklch, oklchToHex, parseHex, toHex } from "./color.js";

const round = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

// ---------- Kontrast ----------

export function checkContrast({ foreground, background }) {
  const ratio = contrastRatio(foreground, background);
  const result = {
    foreground: toHex(parseHex(foreground)),
    background: toHex(parseHex(background)),
    ratio: round(ratio),
    wcag: {
      AA_normal_text: ratio >= 4.5,
      AA_large_text: ratio >= 3,
      AAA_normal_text: ratio >= 7,
      AAA_large_text: ratio >= 4.5,
      ui_components: ratio >= 3,
    },
  };
  if (ratio < 4.5) result.suggestion = suggestAccessibleColor(foreground, background, 4.5);
  return result;
}

// Verschiebt nur die Lightness (OKLCH) der Vordergrundfarbe, bis das Ziel erreicht ist –
// so bleibt der Farbton der Marke erhalten.
export function suggestAccessibleColor(foreground, background, target = 4.5) {
  const fg = hexToOklch(foreground);
  const candidates = [];
  for (const dir of [-1, 1]) {
    for (let step = 1; step <= 100; step++) {
      const l = fg.l + dir * step * 0.01;
      if (l < 0 || l > 1) break;
      const hex = oklchToHex({ ...fg, l });
      const ratio = contrastRatio(hex, background);
      if (ratio >= target) {
        candidates.push({ hex, ratio: round(ratio), lightness_shift: round(dir * step * 0.01) });
        break;
      }
    }
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => Math.abs(a.lightness_shift) - Math.abs(b.lightness_shift));
  return { target_ratio: target, ...candidates[0] };
}

// ---------- Farbpaletten ----------

const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
// Ziel-Lightness je Stufe (OKLCH), angelehnt an die Verteilung moderner Systeme (Tailwind v4, Radix).
const LIGHTNESS = [0.975, 0.94, 0.88, 0.8, 0.71, 0.62, 0.53, 0.45, 0.37, 0.29, 0.21];
// Chroma-Kurve: an den Rändern gedämpft, damit helle/dunkle Stufen nicht grell wirken.
const CHROMA_FACTOR = [0.12, 0.25, 0.45, 0.7, 0.9, 1, 0.95, 0.85, 0.72, 0.58, 0.45];

export function generatePalette({ base, name = "brand" }) {
  const src = hexToOklch(base);
  const chroma = Math.max(src.c, 0.02);
  const scale = STEPS.map((step, i) => {
    const lch = { l: LIGHTNESS[i], c: chroma * CHROMA_FACTOR[i], h: src.h };
    const hex = oklchToHex(lch);
    return {
      step,
      hex,
      oklch: formatOklch(hexToOklch(hex)),
      contrast_on_white: round(contrastRatio(hex, "#ffffff")),
      contrast_on_black: round(contrastRatio(hex, "#000000")),
      text_safe_on_white: contrastRatio(hex, "#ffffff") >= 4.5,
    };
  });
  // Stufe, die dem Original am nächsten liegt – dort sitzt die Markenfarbe.
  const closest = scale.reduce((best, s, i) =>
    Math.abs(LIGHTNESS[i] - src.l) < Math.abs(LIGHTNESS[STEPS.indexOf(best.step)] - src.l) ? s : best
  );
  return {
    name,
    base: toHex(parseHex(base)),
    base_oklch: formatOklch(src),
    base_matches_step: closest.step,
    scale,
    usage: {
      background_subtle: `${name}-50`,
      background_hover: `${name}-100`,
      border: `${name}-200`,
      solid_fill: `${name}-600`,
      solid_fill_hover: `${name}-700`,
      text_on_light: `${name}-700`,
      text_on_dark: `${name}-200`,
    },
  };
}

export function generateHarmony({ base, scheme = "complementary" }) {
  const src = hexToOklch(base);
  const offsets = {
    complementary: [0, 180],
    analogous: [-30, 0, 30],
    triadic: [0, 120, 240],
    split_complementary: [0, 150, 210],
    tetradic: [0, 90, 180, 270],
  }[scheme];
  if (!offsets) throw new Error(`Unbekanntes Schema: ${scheme}`);
  return {
    scheme,
    colors: offsets.map((o) => {
      const hex = oklchToHex({ ...src, h: (src.h + o + 360) % 360 });
      return { hue_offset: o, hex, oklch: formatOklch(hexToOklch(hex)) };
    }),
    tip: "Eine Farbe dominiert (~60 %), eine unterstützt (~30 %), Akzente sparsam (~10 %).",
  };
}

// ---------- Typografie ----------

const RATIOS = {
  minor_second: 1.067,
  major_second: 1.125,
  minor_third: 1.2,
  major_third: 1.25,
  perfect_fourth: 1.333,
  augmented_fourth: 1.414,
  perfect_fifth: 1.5,
  golden_ratio: 1.618,
};
const TYPE_NAMES = ["xs", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl", "5xl", "6xl"];

export function generateTypeScale({ base = 16, ratio = "major_third", mobile_ratio, steps_down = 2, steps_up = 7 }) {
  const r = typeof ratio === "number" ? ratio : RATIOS[ratio];
  if (!r) throw new Error(`Unbekannte Ratio: ${ratio}. Erlaubt: ${Object.keys(RATIOS).join(", ")} oder eine Zahl`);
  const mr = mobile_ratio ? (typeof mobile_ratio === "number" ? mobile_ratio : RATIOS[mobile_ratio]) : Math.max(1.125, r - 0.08);
  const minVw = 360;
  const maxVw = 1280;
  const sizes = [];
  for (let i = -steps_down; i <= steps_up; i++) {
    const desktop = base * r ** i;
    const mobile = base * mr ** i;
    const name = TYPE_NAMES[i + 2] ?? `step-${i}`;
    // Große Schrift braucht weniger Zeilenabstand, kleine mehr.
    const lineHeight = desktop <= 18 ? 1.6 : desktop <= 24 ? 1.45 : desktop <= 36 ? 1.25 : 1.1;
    const letterSpacing = desktop >= 36 ? "-0.02em" : desktop >= 24 ? "-0.01em" : "0";
    const slope = (desktop - mobile) / (maxVw - minVw);
    const intercept = mobile - slope * minVw;
    const fluid =
      Math.abs(desktop - mobile) < 0.5
        ? `${round(desktop / 16, 3)}rem`
        : `clamp(${round(mobile / 16, 3)}rem, ${round(intercept / 16, 3)}rem + ${round(slope * 100, 3)}vw, ${round(desktop / 16, 3)}rem)`;
    sizes.push({ name, px: round(desktop, 1), rem: round(desktop / 16, 3), mobile_px: round(mobile, 1), fluid, line_height: lineHeight, letter_spacing: letterSpacing });
  }
  return {
    base_px: base,
    ratio: r,
    mobile_ratio: round(mr, 3),
    sizes,
    rules: [
      "Fließtext: 16–18px, Zeilenlänge 45–75 Zeichen (max-width: 65ch).",
      "Maximal 2 Schriftfamilien, 3–4 Gewichte.",
      "Hierarchie über Größe UND Gewicht UND Farbe – nicht nur Größe.",
    ],
  };
}

// ---------- Abstände ----------

export function generateSpacingScale({ base = 4 }) {
  const multipliers = [0, 0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 32];
  return {
    base_px: base,
    scale: multipliers.map((m) => ({ token: `space-${String(m).replace(".", "_")}`, px: m * base, rem: round((m * base) / 16, 3) })),
    rules: [
      "Innerhalb einer Gruppe kleinere Abstände als zwischen Gruppen (Gesetz der Nähe).",
      "Nur Werte aus der Skala verwenden – keine 13px oder 22px.",
      "Touch-Ziele mindestens 44×44px (WCAG 2.5.8 verlangt min. 24×24px).",
    ],
  };
}

// ---------- Komplettes Token-Set ----------

export function generateDesignTokens({
  brand,
  neutral_tint = true,
  font_sans = "Inter, ui-sans-serif, system-ui, sans-serif",
  font_display,
  radius = "md",
  format = "css",
}) {
  const primary = generatePalette({ base: brand, name: "primary" });
  const brandLch = hexToOklch(brand);
  // Neutrale Grautöne leicht in Richtung Markenfarbe getönt – wirkt hochwertiger als reines Grau.
  const neutralBase = oklchToHex({ l: 0.55, c: neutral_tint ? 0.015 : 0, h: brandLch.h });
  const neutral = generatePalette({ base: neutralBase, name: "neutral" });
  const p = Object.fromEntries(primary.scale.map((s) => [s.step, s.hex]));
  const n = Object.fromEntries(neutral.scale.map((s) => [s.step, s.hex]));
  const radii = { none: 0, sm: 4, md: 8, lg: 12, xl: 16 }[radius] ?? 8;

  const light = {
    background: "#ffffff",
    surface: n[50],
    "surface-raised": "#ffffff",
    border: n[200],
    "border-strong": n[300],
    text: n[950],
    "text-muted": n[600],
    "text-subtle": n[500],
    primary: p[600],
    "primary-hover": p[700],
    "primary-foreground": pickForeground(p[600]),
    "primary-subtle": p[50],
    "primary-subtle-foreground": p[700],
    ring: p[500],
    danger: "#dc2626",
    success: "#16a34a",
    warning: "#d97706",
  };
  const dark = {
    background: n[950],
    surface: n[900],
    "surface-raised": n[800],
    border: n[800],
    "border-strong": n[700],
    text: n[50],
    "text-muted": n[400],
    "text-subtle": n[500],
    primary: p[400],
    "primary-hover": p[300],
    "primary-foreground": pickForeground(p[400]),
    "primary-subtle": p[950],
    "primary-subtle-foreground": p[200],
    ring: p[400],
    danger: "#f87171",
    success: "#4ade80",
    warning: "#fbbf24",
  };

  const checks = [
    ["light text/background", light.text, light.background],
    ["light text-muted/background", light["text-muted"], light.background],
    ["light primary-foreground/primary", light["primary-foreground"], light.primary],
    ["dark text/background", dark.text, dark.background],
    ["dark text-muted/background", dark["text-muted"], dark.background],
    ["dark primary-foreground/primary", dark["primary-foreground"], dark.primary],
  ].map(([pair, fg, bg]) => ({ pair, ratio: round(contrastRatio(fg, bg)), passes_AA: contrastRatio(fg, bg) >= 4.5 }));

  const type = generateTypeScale({});
  const shared = {
    "font-sans": font_sans,
    "font-display": font_display ?? font_sans,
    "radius-sm": `${Math.max(radii / 2, 2)}px`,
    radius: `${radii}px`,
    "radius-lg": `${radii * 1.5}px`,
    "shadow-sm": "0 1px 2px 0 rgb(0 0 0 / 0.05)",
    shadow: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
    "shadow-lg": "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
    "ease-out": "cubic-bezier(0.16, 1, 0.3, 1)",
    "duration-fast": "120ms",
    "duration-base": "200ms",
    ...Object.fromEntries(type.sizes.map((s) => [`text-${s.name}`, s.fluid])),
  };

  const tokens = { primary: p, neutral: n, light, dark, shared, contrast_checks: checks };
  return { ...tokens, output: renderTokens(tokens, format) };
}

function pickForeground(bg) {
  return contrastRatio("#ffffff", bg) >= contrastRatio("#0a0a0a", bg) ? "#ffffff" : "#0a0a0a";
}

function renderTokens({ primary, neutral, light, dark, shared }, format) {
  const scaleVars = (name, s) => Object.entries(s).map(([k, v]) => `  --${name}-${k}: ${v};`);
  const semVars = (o) => Object.entries(o).map(([k, v]) => `  --${k}: ${v};`);
  if (format === "json") return JSON.stringify({ primary, neutral, light, dark, shared }, null, 2);
  if (format === "tailwind") {
    return [
      '@import "tailwindcss";',
      "",
      "@theme {",
      ...scaleVars("color-primary", primary),
      ...scaleVars("color-neutral", neutral),
      ...Object.keys(light).map((k) => `  --color-${k}: var(--${k});`),
      ...Object.entries(shared).map(([k, v]) => `  --${k}: ${v};`),
      "}",
      "",
      ":root {",
      ...semVars(light),
      "}",
      "",
      "@media (prefers-color-scheme: dark) {",
      "  :root {",
      ...semVars(dark).map((l) => "  " + l),
      "  }",
      "}",
    ].join("\n");
  }
  return [
    ":root {",
    ...scaleVars("primary", primary),
    ...scaleVars("neutral", neutral),
    ...Object.entries(shared).map(([k, v]) => `  --${k}: ${v};`),
    ...semVars(light),
    "  color-scheme: light dark;",
    "}",
    "",
    "@media (prefers-color-scheme: dark) {",
    "  :root {",
    ...semVars(dark).map((l) => "  " + l),
    "  }",
    "}",
  ].join("\n");
}

// ---------- CSS-Audit ----------

export function auditCss({ css, spacing_base = 4 }) {
  const issues = [];
  const add = (severity, rule, message, sample) => issues.push({ severity, rule, message, ...(sample ? { sample } : {}) });

  const hexes = [...css.matchAll(/#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g)].map((m) => m[0].toLowerCase());
  const uniqueColors = [...new Set(hexes)];
  if (uniqueColors.length > 12) add("warning", "color-sprawl", `${uniqueColors.length} verschiedene Hex-Farben – auf eine Palette mit Tokens reduzieren.`);
  const hardcoded = [...css.matchAll(/(?<![\w-])(?:color|background(?:-color)?|border(?:-color)?|fill|stroke)\s*:\s*(#[0-9a-fA-F]{3,8})/g)];
  if (hardcoded.length) add("info", "hardcoded-color", `${hardcoded.length} Farben direkt statt über var(--token) gesetzt.`, hardcoded[0][0]);

  const fontSizes = [...new Set([...css.matchAll(/font-size\s*:\s*([^;}\n]+)/g)].map((m) => m[1].trim()))];
  if (fontSizes.length > 8) add("warning", "type-sprawl", `${fontSizes.length} verschiedene Schriftgrößen – eine Typo-Skala nutzen.`, fontSizes.slice(0, 10).join(", "));
  const tiny = fontSizes.filter((s) => /^(\d+(\.\d+)?)px$/.test(s) && parseFloat(s) < 12);
  if (tiny.length) add("error", "tiny-text", `Schriftgröße unter 12px: ${tiny.join(", ")}`);

  const offScale = new Set();
  for (const m of css.matchAll(/(?:margin|padding|gap|row-gap|column-gap|inset|top|left|right|bottom)(?:-[a-z]+)?\s*:\s*([^;}\n]+)/g)) {
    for (const v of m[1].matchAll(/(-?\d+(?:\.\d+)?)px/g)) {
      const px = Math.abs(parseFloat(v[1]));
      if (px > 1 && px % spacing_base !== 0) offScale.add(`${px}px`);
    }
  }
  if (offScale.size) add("warning", "off-scale-spacing", `Abstände außerhalb des ${spacing_base}px-Rasters: ${[...offScale].slice(0, 12).join(", ")}`);

  if (/outline\s*:\s*(none|0)\b/.test(css) && !/:focus-visible/.test(css))
    add("error", "focus-removed", "outline wird entfernt, aber kein :focus-visible-Stil definiert – Tastaturnutzer verlieren den Fokus.");

  if (!/prefers-reduced-motion/.test(css) && /(animation|transition)\s*:/.test(css))
    add("info", "reduced-motion", "Animationen ohne @media (prefers-reduced-motion: reduce)-Fallback.");

  const importantCount = (css.match(/!important/g) || []).length;
  if (importantCount > 3) add("warning", "important-overuse", `${importantCount}× !important – deutet auf Spezifitätsprobleme hin.`);

  const zIndexes = [...new Set([...css.matchAll(/z-index\s*:\s*(-?\d+)/g)].map((m) => +m[1]))];
  if (zIndexes.some((z) => z > 100) || zIndexes.length > 6) add("info", "z-index-chaos", `z-index-Werte: ${zIndexes.join(", ")} – eine feste Ebenen-Skala definieren.`);

  // Kontrast innerhalb einzelner Regeln mit color + background.
  for (const block of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const fg = block[2].match(/(?:^|;|\s)color\s*:\s*(#[0-9a-fA-F]{3,8})/);
    const bg = block[2].match(/background(?:-color)?\s*:\s*(#[0-9a-fA-F]{3,8})/);
    if (fg && bg) {
      const ratio = contrastRatio(fg[1], bg[1]);
      if (ratio < 4.5)
        add(ratio < 3 ? "error" : "warning", "low-contrast", `${block[1].trim()}: Kontrast ${round(ratio)}:1 (AA verlangt 4.5:1)`, `${fg[1]} auf ${bg[1]}`);
    }
  }

  const score = Math.max(0, 100 - issues.reduce((s, i) => s + ({ error: 15, warning: 7, info: 2 })[i.severity], 0));
  return { score, unique_colors: uniqueColors.length, unique_font_sizes: fontSizes.length, issues };
}
