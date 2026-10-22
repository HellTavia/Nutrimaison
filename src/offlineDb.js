// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Les auteurs de NutriMaison
/* ================================================================== */
/* BASES D'ALIMENTS HORS LIGNE                                         */
/*  - intégrée à l'APK : les produits Open Food Facts les plus scannés */
/*    en France (src/data/off-top.json) et les aliments génériques     */
/*    américains traduits (src/data/usda-fr.json) ;                    */
/*  - complète, en option : toute la base française d'Open Food Facts, */
/*    téléchargée depuis la Release « db » du dépôt, découpée en       */
/*    morceaux avec un index (mots → produits, code-barres → produit) :*/
/*    on ne lit que les morceaux utiles, jamais toute la base.         */
/* Fabriquées par scripts/build-food-db.mjs.                            */
/* ================================================================== */
import { useEffect, useState } from "react";
import { Capacitor, CapacitorHttp } from "@capacitor/core";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { loadJSON, saveJSON } from "./shared.jsx";

export const DB_BASE = "https://github.com/HellTavia/Nutrimaison/releases/download/db/";
const STATE_KEY = "offlineDbState";

/* ---------------- mots (même découpage que le script) ---------------- */
const STOP = new Set(["de", "du", "des", "la", "le", "les", "l", "d", "au", "aux", "a", "en", "et", "un", "une", "avec", "sans", "pour", "sur", "par", "ou", "g", "kg", "ml", "cl", "x"]);
export const normWord = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
export function wordsOf(s) {
  const out = new Set();
  for (let w of normWord(s).split(/[^a-z0-9]+/)) {
    if (w.length < 2 || STOP.has(w) || /^\d+$/.test(w)) continue;
    if (w.length > 3 && w.endsWith("s")) w = w.slice(0, -1);
    out.add(w);
  }
  return [...out];
}

/* ---------------- lignes → aliments de l'appli ---------------- */
/** Ligne Open Food Facts [code, nom, marque, kcal, prot, gluc, lip, sucres, fibres, sel, sat, portion] → aliment. */
export function offRowToFood(r, from) {
  const [code, name, brand, kcal, prot, carbs, fat, sugar, fiber, salt, satfat, portion] = r;
  return {
    id: "off_" + code, barcode: code, name: name + (brand ? " – " + brand : ""), brand: true, offline: from,
    kcal, prot, carbs, fat,
    ...(sugar != null ? { sugar } : {}), ...(fiber != null ? { fiber } : {}), ...(salt != null ? { salt } : {}),
    ...(satfat != null ? { satfat } : {}), ...(portion ? { portion } : {}),
  };
}
/** Ligne USDA [id, nom, kcal, prot, gluc, lip, sucres, fibres, sel, sat, eau] → aliment générique. */
export function usdaRowToFood(r) {
  const [id, name, kcal, prot, carbs, fat, sugar, fiber, salt, satfat, water] = r;
  return {
    id: "us_" + id, name, group: "USDA (traduit)", kcal, prot, carbs, fat, usda: true,
    ...(sugar != null ? { sugar } : {}), ...(fiber != null ? { fiber } : {}), ...(salt != null ? { salt } : {}),
    ...(satfat != null ? { satfat } : {}), ...(water != null ? { water100: water } : {}),
  };
}

/* ---------------- base intégrée ---------------- */
let emb = null, embLoading = null;
export function loadEmbedded() {
  if (emb) return Promise.resolve(emb);
  if (!embLoading) {
    embLoading = Promise.all([
      import("./data/off-top.json").then((m) => m.default || m).catch(() => ({ rows: [] })),
      import("./data/usda-fr.json").then((m) => m.default || m).catch(() => ({ rows: [] })),
    ]).then(([off, usda]) => {
      const offRows = off.rows || [], usdaRows = usda.rows || [];
      emb = {
        off: offRows, offDate: off.date || null,
        offKey: offRows.map((r) => normWord(r[1] + " " + (r[2] || ""))),
        byCode: new Map(offRows.map((r, i) => [String(r[0]), i])),
        usda: usdaRows, usdaKey: usdaRows.map((r) => normWord(r[1])),
      };
      return emb;
    });
  }
  return embLoading;
}
/** Hook : vrai dès que la base intégrée est chargée (relance le rendu). Chargée seulement quand
 *  « enabled » devient vrai (écran Ajouter), pour ne pas ralentir le démarrage de l'appli. */
export function useOfflineReady(enabled = true) {
  const [ready, setReady] = useState(!!emb);
  useEffect(() => { if (enabled && !emb) loadEmbedded().then(() => setReady(true)).catch(() => {}); }, [enabled]);
  return ready;
}
export function embeddedInfo() { return emb ? { off: emb.off.length, offDate: emb.offDate, usda: emb.usda.length } : null; }

function matchKeys(keys, q, limit) {
  const toks = wordsOf(q);
  if (!toks.length) return [];
  const first = toks[0];
  const hits = [];
  for (let i = 0; i < keys.length && hits.length < limit * 4; i++) {
    const k = keys[i];
    if (toks.every((t) => k.includes(t))) hits.push([(k.startsWith(first) ? 0 : 1) * 1e6 + i, i]);
  }
  return hits.sort((a, b) => a[0] - b[0]).slice(0, limit).map((h) => h[1]);
}
/** Recherche synchrone dans les aliments génériques USDA traduits (après chargement). */
export function searchUsda(q, limit = 8) {
  if (!emb) return [];
  return matchKeys(emb.usdaKey, q, limit).map((i) => usdaRowToFood(emb.usda[i]));
}
function searchEmbeddedOff(q, limit) {
  if (!emb) return [];
  return matchKeys(emb.offKey, q, limit).map((i) => offRowToFood(emb.off[i], "intégrée"));
}

/* ---------------- base complète (fichiers dans l'appli) ---------------- */
export function fullDbState() { return loadJSON(STATE_KEY, null); }
const cache = new Map(); // morceaux récemment lus
async function readShard(p) {
  const st = fullDbState();
  if (!st?.dir) return null;
  const key = st.dir + "/" + p;
  if (cache.has(key)) { const v = cache.get(key); cache.delete(key); cache.set(key, v); return v; }
  let data = null;
  try {
    const r = await Filesystem.readFile({ path: key, directory: Directory.Data, encoding: Encoding.UTF8 });
    data = JSON.parse(r.data);
  } catch (e) { data = null; } // morceau absent = aucun produit pour ce préfixe
  cache.set(key, data);
  while (cache.size > 40) cache.delete(cache.keys().next().value);
  return data;
}
async function rowsById(ids, chunk) {
  const groups = new Map();
  ids.forEach((id) => { const c = Math.floor(id / chunk); if (!groups.has(c)) groups.set(c, []); groups.get(c).push(id); });
  const out = new Map();
  for (const [c, list] of groups) {
    const rows = await readShard(`p/${c}.json`);
    if (rows) list.forEach((id) => { if (rows[id % chunk]) out.set(id, rows[id % chunk]); });
  }
  return ids.map((id) => out.get(id)).filter(Boolean);
}
async function searchFull(q, limit) {
  const st = fullDbState();
  if (!st?.dir) return [];
  const toks = wordsOf(q).slice(0, 4);
  if (!toks.length) return [];
  let ids = null;
  for (const t of toks) {
    const shard = await readShard(`w/${t.slice(0, 2)}.json`);
    const set = new Set();
    if (shard) for (const w in shard) if (w.startsWith(t)) for (const id of shard[w]) set.add(id);
    ids = ids ? ids.filter((id) => set.has(id)) : [...set];
    if (!ids.length) return [];
  }
  ids.sort((a, b) => a - b); // rang croissant = les plus scannés d'abord
  return (await rowsById(ids.slice(0, limit), st.chunk || 2000)).map((r) => offRowToFood(r, "complète"));
}

/** Produits de marque hors ligne : base intégrée, puis base complète si elle est installée. */
export async function searchOfflineProducts(q, limit = 20) {
  await loadEmbedded().catch(() => {});
  const a = searchEmbeddedOff(q, limit);
  let b = [];
  try { b = await searchFull(q, limit); } catch (e) {}
  const seen = new Set(a.map((f) => f.id));
  return [...a, ...b.filter((f) => !seen.has(f.id))].slice(0, limit);
}
/** Code-barres hors ligne : base intégrée, puis base complète. */
export async function lookupOfflineBarcode(code) {
  const c = String(code).replace(/\D/g, "");
  await loadEmbedded().catch(() => {});
  if (emb?.byCode.has(c)) return offRowToFood(emb.off[emb.byCode.get(c)], "intégrée");
  const st = fullDbState();
  if (!st?.dir) return null;
  const map = await readShard(`c/${c.slice(0, 3)}.json`);
  if (!map || map[c] == null) return null;
  const [row] = await rowsById([map[c]], st.chunk || 2000);
  return row ? offRowToFood(row, "complète") : null;
}

/* ---------------- téléchargement de la base complète ---------------- */
async function getText(url) {
  if (Capacitor.isNativePlatform()) {
    const r = await CapacitorHttp.request({ url, method: "GET", responseType: "text", readTimeout: 30000, connectTimeout: 20000 });
    if (r.status !== 200) throw new Error("HTTP " + r.status);
    return typeof r.data === "string" ? r.data : JSON.stringify(r.data);
  }
  const r = await fetch(url);
  if (!r.ok) throw new Error("HTTP " + r.status);
  return r.text();
}
async function getBytes(url) {
  if (Capacitor.isNativePlatform()) {
    // le client HTTP natif renvoie les fichiers binaires en base64 (et ignore le CORS de GitHub)
    const r = await CapacitorHttp.request({ url, method: "GET", responseType: "blob", readTimeout: 120000, connectTimeout: 20000 });
    if (r.status !== 200) throw new Error("HTTP " + r.status);
    const bin = atob(r.data);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  const r = await fetch(url);
  if (!r.ok) throw new Error("HTTP " + r.status);
  return new Uint8Array(await r.arrayBuffer());
}
async function sha256hex(bytes) {
  const h = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Version disponible en ligne (manifeste), ou erreur si pas encore publiée. */
export async function fetchFullDbManifest() {
  const m = JSON.parse(await getText(DB_BASE + "nutrimaison-db.json"));
  if (!m || m.v !== 1 || !Array.isArray(m.parts)) throw new Error("manifeste illisible");
  return m;
}

/**
 * Télécharge et installe la base complète. onProgress({ step, done, total, text }).
 * Chaque partie est vérifiée (SHA-256), décompressée en flux et découpée en fichiers.
 * L'ancienne version reste utilisable jusqu'à la fin, puis elle est supprimée.
 */
export async function installFullDb(onProgress, signal) {
  const m = await fetchFullDbManifest();
  const dir = "offdb/" + m.date + "-" + Date.now().toString(36);
  const total = m.parts.reduce((a, p) => a + p.bytes, 0);
  let doneBytes = 0, files = 0;
  for (const [k, part] of m.parts.entries()) {
    if (signal?.aborted) throw Object.assign(new Error("annulé"), { cancelled: true });
    onProgress?.({ done: doneBytes, total, text: `Téléchargement ${k + 1}/${m.parts.length}…` });
    const bytes = await getBytes(DB_BASE + part.name);
    if (part.sha256 && (await sha256hex(bytes)) !== part.sha256) throw new Error(`partie ${k + 1} abîmée pendant le téléchargement, réessaie`);
    doneBytes += part.bytes;
    onProgress?.({ done: doneBytes, total, text: `Installation ${k + 1}/${m.parts.length}…` });
    const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip")).pipeThrough(new TextDecoderStream()).getReader();
    let buf = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (value) buf += value;
      let nl;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl); buf = buf.slice(nl + 1);
        const tab = line.indexOf("\t");
        if (tab > 0) {
          await Filesystem.writeFile({ path: dir + "/" + line.slice(0, tab), data: line.slice(tab + 1), directory: Directory.Data, encoding: Encoding.UTF8, recursive: true });
          files++;
        }
      }
      if (done) break;
    }
  }
  const old = fullDbState();
  saveJSON(STATE_KEY, { dir, date: m.date, count: m.count, chunk: m.chunk, files, bytes: total, installedAt: Date.now() });
  cache.clear();
  if (old?.dir) { try { await Filesystem.rmdir({ path: old.dir, directory: Directory.Data, recursive: true }); } catch (e) {} }
  return fullDbState();
}
export async function removeFullDb() {
  const st = fullDbState();
  if (st?.dir) { try { await Filesystem.rmdir({ path: "offdb", directory: Directory.Data, recursive: true }); } catch (e) {} }
  saveJSON(STATE_KEY, null);
  cache.clear();
}
