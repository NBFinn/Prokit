#!/usr/bin/env node
// Öffnet ein Ergebnis direkt auf dem Rechner des Nutzers: .slnx/.sln/.csproj in Visual Studio (neueste Version
// per vswhere, sonst Standard-App), HTML im Browser, URLs im Browser, sonst die Standard-App (Bilder, PDF, STL …).
// Ohne Pfad: sucht im aktuellen Ordner eine Lösung (.slnx vor .sln), sonst index.html.
// Öffnet dieselbe Datei innerhalb von 8 Stunden nicht erneut (kein zweites Visual Studio), außer mit --force.
//
//   node open.mjs [pfad|url] [--force]

import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { extname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const STATE = join(process.env.CODE_PRO_HOME || join(homedir(), ".code-pro"), "opened.json");
const SOLUTION = /\.(slnx|sln)$/i;
const VS = /\.(slnx|sln|csproj|vbproj|fsproj)$/i;

// Was soll geöffnet werden? Ordner → Lösung, sonst index.html (auch in dist/, build/, wwwroot/, public/).
export function pick(target = ".") {
  if (/^https?:\/\//i.test(target)) return target;
  const p = resolve(target);
  if (!existsSync(p)) return null;
  if (!statSync(p).isDirectory()) return p;
  const names = readdirSync(p);
  const sln = names.filter((n) => SOLUTION.test(n)).sort((a, b) => Number(/\.slnx$/i.test(b)) - Number(/\.slnx$/i.test(a)))[0];
  if (sln) return join(p, sln);
  for (const d of ["", "dist", "build", "wwwroot", "public", "src"]) if (existsSync(join(p, d, "index.html"))) return join(p, d, "index.html");
  const proj = names.find((n) => VS.test(n));
  return proj ? join(p, proj) : p;
}

function visualStudio() {
  if (platform() !== "win32") return null;
  const vswhere = join(process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)", "Microsoft Visual Studio", "Installer", "vswhere.exe");
  try {
    const path = execFileSync(vswhere, ["-latest", "-prerelease", "-property", "productPath"], { encoding: "utf8", timeout: 5000 }).trim();
    return path && existsSync(path) ? path : null;
  } catch { return null; }
}

// Befehl zum Öffnen, ohne ihn auszuführen (für Tests und die Ausgabe).
export function command(item) {
  const os = platform();
  if (VS.test(item)) { const vs = visualStudio(); if (vs) return [vs, [item]]; }
  if (os === "win32") return ["cmd.exe", ["/c", "start", '""', `"${item}"`]];
  if (os === "darwin") return ["open", [item]];
  return ["xdg-open", [item]];
}

const canShow = () => platform() === "win32" || platform() === "darwin" || !!(process.env.DISPLAY || process.env.WAYLAND_DISPLAY);

export function open(target, { force = false } = {}) {
  const item = pick(target);
  if (!item) return `Nicht gefunden: ${target}`;
  let state = {};
  try { state = JSON.parse(readFileSync(STATE, "utf8")); } catch {}
  if (!force && state[item] && Date.now() - state[item] < 8 * 3600e3) return `Bereits geöffnet: ${item} (erneut mit --force)`;
  if (process.env.PROKIT_FAKE_OPEN) return `Geöffnet: ${item}`; // Messläufe ohne Bildschirm verhalten sich wie beim Nutzer
  if (process.env.PROKIT_NO_OPEN || !canShow()) return `Kein Bildschirm in dieser Umgebung, nicht geöffnet (kein weiterer Versuch nötig): ${item}`;
  const [cmd, args] = command(item);
  try {
    spawn(cmd, args, { detached: true, stdio: "ignore", windowsHide: false, windowsVerbatimArguments: cmd === "cmd.exe" }).unref();
  } catch (e) { return `Öffnen fehlgeschlagen (${e.message}): ${item}`; }
  try { mkdirSync(join(STATE, ".."), { recursive: true }); state[item] = Date.now(); writeFileSync(STATE, JSON.stringify(state)); } catch {}
  return `Geöffnet: ${item}${VS.test(item) && cmd !== "cmd.exe" ? " (Visual Studio)" : ""}`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  // "open.mjs open <pfad>" (Werkzeugname doppelt) ebenfalls verstehen, statt eine Runde mit "nicht gefunden" zu kosten
  const target = args.filter((a) => !a.startsWith("--")).find((a, i, all) => !(a === "open" && all.length > 1 && i === 0)) ?? ".";
  console.log(open(target, { force: args.includes("--force") }));
}
