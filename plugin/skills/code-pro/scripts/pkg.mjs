#!/usr/bin/env node
// NuGet ohne Raten: passende Pakete finden und die aktuelle Version prüfen, kompakt.
//
//   node pkg.mjs search <begriff>    beste Treffer mit Version, Downloads, Kurzbeschreibung
//   node pkg.mjs versions <paket-id> neueste stabile Version und die letzten Versionen
//
// Danach: dotnet add package <id> (nimmt die neueste stabile Version), dann api <Typ.Member> für die echte API.

import { pathToFileURL } from "node:url";

const INDEX = "https://api.nuget.org/v3/index.json";
const fmt = (n) => (n >= 1e9 ? `${(n / 1e9).toFixed(1)} Mrd.` : n >= 1e6 ? `${(n / 1e6).toFixed(1)} Mio.` : n >= 1e3 ? `${Math.round(n / 1e3)} Tsd.` : String(n));

async function get(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { "User-Agent": "prokit" } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}

export async function search(term, take = 8, http = get) {
  const index = await http(INDEX);
  const urls = index.resources.filter((r) => String(r["@type"]).startsWith("SearchQueryService")).map((r) => r["@id"]);
  let last;
  for (const url of [...new Set(urls)]) {
    try {
      const res = await http(`${url}?q=${encodeURIComponent(term)}&take=${take}&prerelease=false&semVerLevel=2.0.0`);
      if (!res.data?.length) return `Keine Pakete für "${term}".`;
      return res.data.map((p) => `${p.id} ${p.version} · ${fmt(p.totalDownloads ?? 0)} Downloads${p.verified ? " · geprüfter Herausgeber" : ""}\n    ${String(p.description ?? "").replace(/\s+/g, " ").slice(0, 110)}`).join("\n");
    } catch (e) { last = e; }
  }
  throw last ?? new Error("kein Suchdienst erreichbar");
}

export async function versions(id, http = get) {
  const res = await http(`https://api.nuget.org/v3-flatcontainer/${id.toLowerCase()}/index.json`);
  const all = res.versions ?? [];
  const stable = all.filter((v) => !v.includes("-"));
  return `${id}: neueste stabile ${stable.at(-1) ?? "–"}${all.at(-1) !== stable.at(-1) ? ` · neueste Vorabversion ${all.at(-1)}` : ""} · zuletzt: ${all.slice(-6).reverse().join(", ")}`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [cmd, ...rest] = process.argv.slice(2).filter((a) => a !== "pkg");
  try {
    if (cmd === "search" && rest.length) console.log(await search(rest.join(" ")));
    else if (cmd === "versions" && rest[0]) console.log(await versions(rest[0]));
    else { console.error("Aufruf: node pkg.mjs search <begriff> | versions <paket-id>"); process.exit(2); }
  } catch (e) {
    console.log(`NuGet nicht erreichbar (${e.message}). Ohne Netz: api <Typ.Member> durchsucht installierte Pakete.`);
    process.exit(1);
  }
}
