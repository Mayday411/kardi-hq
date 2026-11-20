#!/usr/bin/env node
// Refresh data/*.json from Compass before a build.
//
// Compass (the editor at claude-cms) publishes every collection on the
// Kardinal Offishall site through one public endpoint. This script pulls it
// and writes the list parts of each data file, leaving the hand-written parts
// (notes, intros, formats, the goods cards, now_playing…) untouched. The site
// itself stays static: Vercel runs this as the build command, so a publish in
// Compass becomes a fresh deploy with new JSON.
//
//   COMPASS_CONTENT_URL=https://<compass>/api/public/sites/kardinal-offishall/content node tools/pull-content.mjs
//
// No URL → nothing happens and the committed data ships as is (exit 0).
// Fetch fails → same, with a warning, unless --strict is passed.
// --dry-run prints what would change without writing.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyLayout, applyHero } from "./layout.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, "data");
const strict = process.argv.includes("--strict");
const dryRun = process.argv.includes("--dry-run");
const url = process.env.COMPASS_CONTENT_URL;

// Section order and visibility come from data/sections.json (refreshed from
// Compass below when it can be reached). The page itself is rewritten only
// on Vercel or with --layout, so a local pull never reorders the tracked
// index.html by accident.
const doLayout = !!process.env.VERCEL || process.argv.includes("--layout");
function layout() {
  const file = path.join(dataDir, "sections.json");
  if (!fs.existsSync(file)) return;
  const { sections } = JSON.parse(fs.readFileSync(file, "utf8"));
  const page = path.join(root, "index.html");
  const laid = applyLayout(fs.readFileSync(page, "utf8"), sections);
  console.log(`layout: ${laid.report}${doLayout && !dryRun ? "" : " (not applied: needs Vercel or --layout)"}`);
  // The hero's words and sticker, from data/hero.json (the Compass Hero record).
  const heroFile = path.join(dataDir, "hero.json");
  const hero = fs.existsSync(heroFile) ? JSON.parse(fs.readFileSync(heroFile, "utf8")).hero : null;
  const { html, report } = applyHero(laid.html, hero);
  console.log(`hero: ${report}`);
  if (doLayout && !dryRun) fs.writeFileSync(page, html);
}

if (!url) {
  console.log("pull-content: COMPASS_CONTENT_URL not set, keeping the committed data files.");
  layout();
  process.exit(0);
}

// collection key → [data file, key inside the file]
const LISTS = {
  moments: ["moments.json", "moments"],
  releases: ["releases.json", "releases"],
  shows: ["shows.json", "shows"],
  products: ["store.json", "products"],
  awards: ["awards.json", "awards"],
  "speaking-dates": ["speaking.json", "dates"],
  "dj-sets": ["dj.json", "sets"],
  ticker: ["links.json", "ticker"],
};

const read = (file) => JSON.parse(fs.readFileSync(path.join(dataDir, file), "utf8"));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const or = (v, fallback = null) => (v === undefined || v === "" ? fallback : v);

function write(file, obj) {
  const text = JSON.stringify(obj, null, 2) + "\n";
  if (!dryRun) fs.writeFileSync(path.join(dataDir, file), text);
}

async function main() {
  // The endpoint is edge-cached for a few minutes; a fresh query string skips that.
  const sep = url.includes("?") ? "&" : "?";
  const res = await fetch(`${url}${sep}ts=${Date.now()}`, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} from ${url}`);
  const payload = await res.json();
  const cols = payload.collections ?? {};
  console.log(`pull-content: ${payload.site?.name ?? "site"} content as of ${payload.updatedAt ?? "unknown"}`);

  const changed = [];
  const touched = new Map(); // file → object, so two collections in one file share a write

  const fileObj = (file) => {
    if (!touched.has(file)) touched.set(file, read(file));
    return touched.get(file);
  };

  for (const [key, [file, prop]] of Object.entries(LISTS)) {
    if (!Array.isArray(cols[key])) { console.log(`  ${key}: not in the payload, left alone`); continue; }
    const obj = fileObj(file);
    if (same(obj[prop], cols[key])) { console.log(`  ${key}: unchanged (${cols[key].length})`); continue; }
    obj[prop] = cols[key];
    changed.push(`${file}:${prop}`);
    console.log(`  ${key}: ${cols[key].length} entries → ${file}`);
  }

  // The party is one record in Compass but three blocks in party.json.
  const party = cols.party;
  if (party && typeof party === "object") {
    const obj = fileObj("party.json");
    const ty = { ...(obj.this_year ?? {}) };
    ty.edition = Number(or(party.edition, ty.edition));
    ty.year = Number(or(party.year, ty.year));
    for (const k of ["date", "venue", "city", "beneficiary", "beneficiary_url", "donate_url", "tickets_url"]) ty[k] = or(party[k]);
    ty.bring = Array.isArray(party.bring) ? party.bring : ty.bring ?? [];
    const tk = { ...(obj.tickets ?? {}) };
    tk.on_sale = party.tickets_on_sale === true;
    tk.url = or(party.tickets_url);
    tk.doors = or(party.doors);
    tk.age = or(party.age);
    const lu = { ...(obj.lineup ?? {}) };
    lu.acts = (Array.isArray(party.lineup) ? party.lineup : []).map((s) => {
      const [name, role] = String(s).split(" · ");
      return role ? { name: name.trim(), role: role.trim() } : { name: name.trim() };
    });
    const next = { ...obj, this_year: ty, tickets: tk, lineup: lu };
    if (!same(obj, next)) { touched.set("party.json", next); changed.push("party.json"); console.log("  party: updated"); }
    else console.log("  party: unchanged");
  } else if (party === null) {
    console.log("  party: nothing published, left alone");
  }

  // The hero record: roles line, blurb and the announcement sticker. Unpublished means "keep the source wording".
  {
    const h = cols.hero && typeof cols.hero === "object" ? cols.hero : null;
    const next = {
      _note: "The hero's roles line, blurb and announcement sticker, edited in Compass (Hero). The build applies it to index.html; see applyHero in tools/layout.mjs.",
      hero: h ? { roles: h.roles ?? "", blurb: h.blurb ?? "", sticker_show: h.sticker_show !== false, sticker_line1: h.sticker_line1 ?? "", sticker_line2: h.sticker_line2 ?? "", sticker_url: h.sticker_url ?? "" } : null,
    };
    const file = path.join(dataDir, "hero.json");
    const before = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null;
    if (!same(before?.hero, next.hero)) {
      changed.push("hero.json");
      if (!dryRun) fs.writeFileSync(file, JSON.stringify(next, null, 2) + "\n");
      console.log(`  hero: ${next.hero ? "updated" : "not published, source wording kept"} → hero.json`);
    } else console.log("  hero: unchanged");
  }

  // Section order and visibility: {id, label, hidden} per section, in the order Compass holds them.
  if (Array.isArray(cols.sections)) {
    const next = {
      _note: "Section order and visibility, edited in Compass (Sections). The build applies it to index.html; see tools/layout.mjs.",
      sections: cols.sections.map((s) => ({ id: s.id, label: s.label ?? s.id, hidden: s.hidden === true })),
    };
    const file = path.join(dataDir, "sections.json");
    const before = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null;
    if (!same(before?.sections, next.sections)) {
      changed.push("sections.json");
      if (!dryRun) fs.writeFileSync(file, JSON.stringify(next, null, 2) + "\n");
      console.log(`  sections: ${next.sections.length} → sections.json`);
    } else console.log(`  sections: unchanged (${next.sections.length})`);
  }

  for (const [file, obj] of touched) if (changed.some((c) => c.startsWith(file))) write(file, obj);

  if (!changed.length) console.log("pull-content: everything already matched.");
  else console.log(`pull-content: ${dryRun ? "would write" : "wrote"} ${[...new Set(changed.map((c) => c.split(":")[0]))].join(", ")}`);
}

main().catch((err) => {
  console.error(`pull-content: ${err.message}`);
  if (strict) process.exit(1);
  console.warn("pull-content: keeping the committed data files.");
}).finally(layout);
