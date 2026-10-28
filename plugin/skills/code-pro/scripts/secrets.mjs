#!/usr/bin/env node
// Sucht vor dem Commit nach Zugangsdaten (API-Keys, Tokens, private Schlüssel, Passwörter in
// Verbindungszeichenfolgen). Treffer werden maskiert ausgegeben, damit sie nicht im Verlauf landen.
//
//   node secrets.mjs                geänderte und neue Dateien (git)
//   node secrets.mjs <pfad ...>     bestimmte Dateien/Ordner
//   node secrets.mjs --all          alle versionierten Dateien

import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export const PATTERNS = [
  { id: "private-key", re: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY(?: BLOCK)?-----/ },
  { id: "aws-access-key", re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/ },
  { id: "github-token", re: /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{60,})\b/ },
  { id: "anthropic-key", re: /\bsk-ant-[A-Za-z0-9_-]{20,}/ },
  { id: "openai-key", re: /\bsk-(?:proj-|svcacct-|admin-)?[A-Za-z0-9_-]{32,}/ },
  { id: "google-api-key", re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { id: "slack-token", re: /\bxox[abposr]-[A-Za-z0-9-]{10,}/ },
  { id: "stripe-live-key", re: /\b(?:sk|rk)_live_[A-Za-z0-9]{20,}/ },
  { id: "azure-storage-key", re: /AccountKey=[A-Za-z0-9+/]{60,}={0,2}/ },
  { id: "jwt", re: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ },
  // Nur echte Verbindungszeichenfolgen (Server=…;…Password=…), keine Zuweisungen im Code wie options.Password = x
  { id: "connection-password", re: /\b(?:Server|Host|Data Source|Address|Endpoint)\s*=[^;"']*;[^"']*\b(?:Password|Pwd)\s*=\s*(?!\{|\$\{|%|<|\*{3})[^;"'\s]{4,}/i },
  { id: "url-credentials", re: /\b[a-z][a-z0-9+.-]*:\/\/[^\s:/@]+:(?!\$\{|\{)[^\s@/]{4,}@[^\s/]+/i },
  {
    id: "hardcoded-secret",
    re: /\b(?:api[_-]?key|secret|client[_-]?secret|access[_-]?token|auth[_-]?token|password|passwd)\b["']?\s*[:=]\s*["'](?!\$\{|\{\{|<|your|xxx|changeme|example|dummy|test|placeholder)[^"'\s]{8,}["']/i,
  },
];

const SKIP = /(^|\/)(node_modules|\.git|bin|obj|dist|build|vendor)\/|\.(png|jpe?g|gif|webp|ico|pdf|zip|gz|woff2?|ttf|exe|dll|so|dylib|bin|stl|3mf|glb|lock)$|(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|\.min\.js)$/i;

const mask = (s) => (s.length <= 8 ? "****" : `${s.slice(0, 4)}…${s.slice(-2)} (${s.length} Zeichen)`);

export function scanText(text) {
  const hits = [];
  text.split("\n").forEach((line, i) => {
    if (/secrets\.mjs:\s*ignore|gitleaks:allow|pragma: allowlist secret/i.test(line)) return;
    for (const p of PATTERNS) {
      const m = line.match(p.re);
      if (m) {
        hits.push({ line: i + 1, id: p.id, match: mask(m[0]) });
        break;
      }
    }
  });
  return hits;
}

const git = (args) => execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).split("\n").filter(Boolean);

function targets(args) {
  if (args.includes("--all")) return git(["ls-files"]);
  const paths = args.filter((a) => !a.startsWith("--"));
  if (!paths.length) {
    let changed = [];
    try { changed = git(["diff", "--name-only", "HEAD"]); } catch { changed = git(["diff", "--name-only", "--cached"]); }
    return [...new Set([...changed, ...git(["ls-files", "--others", "--exclude-standard"])])];
  }
  const out = [];
  const walk = (p) => {
    const st = statSync(p, { throwIfNoEntry: false });
    if (!st) return;
    if (st.isDirectory()) for (const e of readdirSync(p)) walk(join(p, e));
    else out.push(p);
  };
  paths.forEach(walk);
  return out;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let files;
  try {
    files = targets(process.argv.slice(2));
  } catch {
    console.error("Kein Git-Repository: Pfade angeben, z. B. node secrets.mjs src");
    process.exit(2);
  }
  let total = 0;
  for (const f of files.filter((f) => !SKIP.test(f.replaceAll("\\", "/")))) {
    const st = statSync(f, { throwIfNoEntry: false });
    if (!st?.isFile() || st.size > 2_000_000) continue;
    for (const h of scanText(readFileSync(f, "utf8"))) {
      console.log(`${f}:${h.line}  ${h.id}  ${h.match}`);
      total++;
    }
  }
  console.log(total ? `── ${total} mögliche Secrets in ${files.length} Dateien: entfernen, rotieren und über Umgebungsvariablen/User Secrets laden` : `── keine Secrets gefunden (${files.length} Dateien)`);
  process.exit(total ? 1 : 0);
}
