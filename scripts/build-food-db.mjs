#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Les auteurs de NutriMaison
/*
 * Fabrique les bases d'aliments hors ligne de NutriMaison. Aucune dépendance : Node 18 ou plus.
 *
 *  1) Produits de marque (Open Food Facts, licence ODbL)
 *       node scripts/build-food-db.mjs off [--source URL|fichier.jsonl.gz] [--country france] [--top 100000] [--out build-db]
 *     Lit l'export JSONL complet d'Open Food Facts AU FIL DE L'EAU (rien n'est stocké sur le disque,
 *     environ 7 à 8 Go sont téléchargés), garde les produits vendus dans le pays choisi avec des valeurs
 *     nutritionnelles complètes, les classe par popularité (nombre de scans) et écrit :
 *       build-db/off-top.json            les N plus populaires → base intégrée à l'APK (src/data/off-top.json)
 *       build-db/nutrimaison-db.json     manifeste de la base complète (version, nombre, parties)
 *       build-db/nutrimaison-db-AAAAMMJJ-K.gz  base complète découpée en parties d'environ 8 Mo
 *     La base complète contient trois sortes de morceaux, lus un par un par l'appli :
 *       p/<n>.json   les produits, par paquets de 2 000 (rang de popularité)
 *       c/<abc>.json code-barres → rang, rangés par les 3 premiers chiffres
 *       w/<ab>.json  index des mots (sans accents) → rangs des produits, rangés par les 2 premières lettres
 *
 *  2) Aliments génériques américains traduits (USDA FoodData Central « SR Legacy », domaine public)
 *       GEMINI_API_KEY=… node scripts/build-food-db.mjs usda [--zip fichier.zip] [--model gemini-flash-latest]
 *     Télécharge (ou lit) le zip CSV SR Legacy, garde les aliments génériques (sans marque), traduit les
 *     noms en français avec Gemini (une seule fois : les traductions sont gardées dans
 *     scripts/usda-translations.json, on peut interrompre et relancer) et écrit src/data/usda-fr.json.
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import readline from "node:readline";
import crypto from "node:crypto";
import { Readable } from "node:stream";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OFF_URL = "https://static.openfoodfacts.org/data/openfoodfacts-products.jsonl.gz";
const USDA_URL = "https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip";

const args = process.argv.slice(2);
const cmd = args[0];
const opt = (name, def) => { const i = args.indexOf("--" + name); return i > 0 && args[i + 1] ? args[i + 1] : def; };
const log = (...a) => console.log(...a);
const die = (m) => { console.error("\n✗ " + m); process.exit(1); };

/* ---------------- outils communs ---------------- */
export const normWord = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const STOP = new Set(["de", "du", "des", "la", "le", "les", "l", "d", "au", "aux", "a", "en", "et", "un", "une", "avec", "sans", "pour", "sur", "par", "ou", "g", "kg", "ml", "cl", "x"]);
/** Mots indexés : sans accents, sans mots vides, pluriels simples ramenés au singulier. */
export function wordsOf(s) {
  const out = new Set();
  for (let w of normWord(s).split(/[^a-z0-9]+/)) {
    if (w.length < 2 || STOP.has(w) || /^\d+$/.test(w)) continue;
    if (w.length > 3 && w.endsWith("s")) w = w.slice(0, -1);
    out.add(w);
  }
  return [...out].slice(0, 10);
}
const r1 = (v) => Math.round(v * 10) / 10;
const num = (v) => { const n = typeof v === "string" ? Number(v.replace(",", ".")) : Number(v); return Number.isFinite(n) ? n : null; };
const clean = (s, max) => String(s || "").replace(/\s+/g, " ").replace(/^[\s,;.-]+|[\s,;.-]+$/g, "").slice(0, max).trim();
const sha256 = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const fmtMB = (b) => (b / 1048576).toFixed(1) + " Mo";

async function openStream(source) {
  if (/^https?:\/\//.test(source)) {
    log("Téléchargement en flux de " + source);
    const res = await fetch(source);
    if (!res.ok) die("téléchargement impossible : HTTP " + res.status);
    return Readable.fromWeb(res.body);
  }
  if (!fs.existsSync(source)) die("fichier introuvable : " + source);
  return fs.createReadStream(source);
}

/* ================================================================ */
/* 1. OPEN FOOD FACTS                                                */
/* ================================================================ */
/** Produit Open Food Facts → ligne compacte, ou null s'il est incomplet ou incohérent. */
export function offRow(p, country) {
  if (!p || !Array.isArray(p.countries_tags) || !p.countries_tags.includes("en:" + country)) return null;
  const code = String(p.code || p._id || "").replace(/\D/g, "");
  if (code.length < 8 || code.length > 14) return null;
  const n = p.nutriments || {};
  let kcal = num(n["energy-kcal_100g"]);
  if (kcal == null && num(n.energy_100g) != null) kcal = num(n.energy_100g) / 4.184;
  const prot = num(n.proteins_100g), carbs = num(n.carbohydrates_100g), fat = num(n.fat_100g);
  if ([kcal, prot, carbs, fat].some((v) => v == null)) return null;
  if (kcal < 0 || kcal > 950 || [prot, carbs, fat].some((v) => v < 0 || v > 100) || prot + carbs + fat > 105) return null;
  const name = clean(p.product_name_fr || (p.lang === "fr" && p.product_name) || p.product_name || p.generic_name_fr, 90);
  if (name.length < 2) return null;
  const brand = clean(String(p.brands || "").split(",")[0], 40);
  const opt1 = (k) => { const v = num(n[k]); return v == null || v < 0 || v > 100 ? null : r1(v); };
  const portion = num(p.serving_quantity);
  return {
    code, scans: Number(p.unique_scans_n) || 0, compl: Number(p.completeness) || 0,
    row: [code, name, brand, Math.round(kcal), r1(prot), r1(carbs), r1(fat), opt1("sugars_100g"), opt1("fiber_100g"), opt1("salt_100g"),
      opt1("saturated-fat_100g"), portion > 0 && portion <= 1000 ? Math.round(portion) : null],
  };
}
export const OFF_FIELDS = ["code", "name", "brand", "kcal", "prot", "carbs", "fat", "sugar", "fiber", "salt", "satfat", "portion"];

async function buildOff() {
  const source = opt("source", OFF_URL);
  const country = opt("country", "france");
  const top = Number(opt("top", "100000"));
  const out = path.resolve(opt("out", "build-db"));
  const chunk = 2000;
  fs.mkdirSync(out, { recursive: true });

  const stream = (await openStream(source)).pipe(zlib.createGunzip());
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  const byCode = new Map();
  let lines = 0, bad = 0;
  const t0 = Date.now();
  for await (const line of rl) {
    lines++;
    if (lines % 200000 === 0) log(`  ${lines.toLocaleString("fr-FR")} produits lus, ${byCode.size.toLocaleString("fr-FR")} retenus (${Math.round((Date.now() - t0) / 1000)} s)`);
    if (!line.includes(`"en:${country}"`)) continue; // tri rapide avant de lire le JSON
    let p; try { p = JSON.parse(line); } catch (e) { bad++; continue; }
    const r = offRow(p, country);
    if (!r) continue;
    const prev = byCode.get(r.code);
    if (!prev || r.scans > prev.scans) byCode.set(r.code, r);
  }
  log(`Lecture terminée : ${lines.toLocaleString("fr-FR")} produits, ${byCode.size.toLocaleString("fr-FR")} retenus pour « ${country} »${bad ? `, ${bad} lignes illisibles` : ""}.`);
  if (!byCode.size) die("aucun produit retenu : vérifie le pays (--country) et la source");

  const all = [...byCode.values()].sort((a, b) => b.scans - a.scans || b.compl - a.compl || a.code.localeCompare(b.code));
  const date = new Date().toISOString().slice(0, 10);

  // --- base intégrée : les plus populaires ---
  const emb = { v: 1, source: "Open Food Facts (ODbL)", country, date, fields: OFF_FIELDS, rows: all.slice(0, top).map((x) => x.row) };
  fs.writeFileSync(path.join(out, "off-top.json"), JSON.stringify(emb));
  log(`Base intégrée : ${emb.rows.length.toLocaleString("fr-FR")} produits, ${fmtMB(fs.statSync(path.join(out, "off-top.json")).size)}`);

  // --- base complète : morceaux + index ---
  const shards = new Map(); // chemin → objet ou tableau
  const put = (p, fn) => { if (!shards.has(p)) shards.set(p, fn()); return shards.get(p); };
  const MAX_POSTINGS = 3000;
  all.forEach((x, id) => {
    put(`p/${Math.floor(id / chunk)}.json`, () => []).push(x.row);
    put(`c/${x.code.slice(0, 3)}.json`, () => ({}))[x.code] = id;
    for (const w of wordsOf(x.row[1] + " " + x.row[2])) {
      const shard = put(`w/${w.slice(0, 2)}.json`, () => ({}));
      const list = shard[w] || (shard[w] = []);
      if (list.length < MAX_POSTINGS) list.push(id); // rangs croissants = plus populaires d'abord
    }
  });

  // parties d'environ 8 Mo compressés (≈ 24 Mo de texte)
  for (const f of fs.readdirSync(out)) if (/^nutrimaison-db/.test(f)) fs.unlinkSync(path.join(out, f));
  const parts = [];
  let gz = null, raw = 0, k = 0;
  const open = () => { k++; const name = `nutrimaison-db-${date.replace(/-/g, "")}-${k}.gz`; gz = { name, z: zlib.createGzip({ level: 9 }), file: fs.createWriteStream(path.join(out, name)) }; gz.z.pipe(gz.file); raw = 0; };
  const close = () => new Promise((res) => { gz.file.on("close", res); gz.z.end(); });
  open();
  for (const [p, data] of [...shards.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const line = p + "\t" + JSON.stringify(data) + "\n";
    if (raw > 24e6) { await close(); parts.push(gz.name); open(); }
    gz.z.write(line); raw += line.length;
  }
  await close(); parts.push(gz.name);
  const manifest = {
    v: 1, source: "Open Food Facts (ODbL)", country, date, count: all.length, chunk, codePrefix: 3, wordPrefix: 2,
    fields: OFF_FIELDS, shards: shards.size,
    parts: parts.map((name) => ({ name, bytes: fs.statSync(path.join(out, name)).size, sha256: sha256(path.join(out, name)) })),
  };
  fs.writeFileSync(path.join(out, "nutrimaison-db.json"), JSON.stringify(manifest, null, 1));
  const total = manifest.parts.reduce((a, p) => a + p.bytes, 0);
  log(`Base complète : ${all.length.toLocaleString("fr-FR")} produits, ${shards.size} morceaux, ${parts.length} parties, ${fmtMB(total)}`);
  log(`\nÀ faire ensuite :\n  cp ${path.join(out, "off-top.json")} src/data/off-top.json   (base intégrée)\n  publier ${out}/nutrimaison-db* dans la Release « db » du dépôt (base complète)`);
}

/* ================================================================ */
/* 2. USDA (SR Legacy) TRADUIT                                       */
/* ================================================================ */
/** Lecteur CSV minimal (guillemets, virgules et retours à la ligne dans les champs). */
export function parseCSV(text) {
  const rows = []; let row = [], f = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n") { row.push(f); rows.push(row); row = []; f = ""; }
    else if (c !== "\r") f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows;
}
const NUTR = { 1008: "kcal", 1003: "prot", 1005: "carbs", 1004: "fat", 2000: "sugar", 1079: "fiber", 1093: "sodium", 1258: "satfat", 1051: "water" };
export const USDA_FIELDS = ["id", "name", "kcal", "prot", "carbs", "fat", "sugar", "fiber", "salt", "satfat", "water"];
/** Aliment de marque (mot en majuscules de 4 lettres ou plus : KELLOGG'S, MCDONALD'S…) : inutile en France. */
export const isBranded = (d) => /\b[A-Z][A-Z'&.-]{3,}\b/.test(d);

function readZipCsv(zip, name) {
  const list = execFileSync("unzip", ["-Z1", zip], { encoding: "utf8" }).split("\n");
  const entry = list.find((l) => l.endsWith("/" + name) || l === name);
  if (!entry) die(`${name} absent du zip`);
  return execFileSync("unzip", ["-p", zip, entry], { encoding: "utf8", maxBuffer: 1 << 30 });
}

async function translateBatch(key, model, items) {
  const prompt = `Traduis en français ces noms d'aliments de la base nutritionnelle américaine USDA, dans le style de la table française Ciqual :
nom de l'aliment d'abord, puis les précisions séparées par des virgules (« Poulet, blanc, sans peau, rôti »), vocabulaire courant en France,
unités et marques américaines retirées si elles n'aident pas. Garde EXACTEMENT le même ordre et le même nombre d'éléments.
Réponds UNIQUEMENT avec un tableau JSON de chaînes.
${JSON.stringify(items.map((x) => x.desc))}`;
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json", temperature: 0.1 } }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
      let arr; try { arr = JSON.parse(text.replace(/```json|```/g, "")); } catch (e) { arr = null; }
      if (Array.isArray(arr) && arr.length === items.length) return arr.map((s) => clean(s, 90));
      log("  réponse incomplète, nouvel essai…");
    } else {
      const wait = res.status === 429 || res.status >= 500 ? 20000 * (attempt + 1) : 0;
      if (!wait) die("Gemini : " + (data.error?.message || res.status));
      log(`  Gemini saturé (${res.status}), pause de ${wait / 1000} s…`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  die("Gemini ne répond pas correctement, relance plus tard (les traductions déjà faites sont gardées)");
}

async function buildUsda() {
  const key = process.env.GEMINI_API_KEY;
  const model = opt("model", "gemini-flash-latest");
  let zip = opt("zip", null);
  if (!zip) {
    zip = path.join(ROOT, "build-db", "usda-sr-legacy.zip");
    if (!fs.existsSync(zip)) {
      fs.mkdirSync(path.dirname(zip), { recursive: true });
      log("Téléchargement de " + USDA_URL);
      const res = await fetch(USDA_URL);
      if (!res.ok) die(`téléchargement impossible (HTTP ${res.status}). Télécharge le zip « SR Legacy » (CSV) sur https://fdc.nal.usda.gov/download-datasets et relance avec --zip fichier.zip`);
      fs.writeFileSync(zip, Buffer.from(await res.arrayBuffer()));
    }
  }
  const foods = parseCSV(readZipCsv(zip, "food.csv"));
  const head = foods.shift();
  const iId = head.indexOf("fdc_id"), iDesc = head.indexOf("description"), iCat = head.indexOf("food_category_id");
  const nut = parseCSV(readZipCsv(zip, "food_nutrient.csv"));
  const nh = nut.shift();
  const jId = nh.indexOf("fdc_id"), jN = nh.indexOf("nutrient_id"), jA = nh.indexOf("amount");
  const vals = new Map();
  for (const r of nut) {
    const k = NUTR[r[jN]]; if (!k) continue;
    const m = vals.get(r[jId]) || {}; m[k] = Number(r[jA]); vals.set(r[jId], m);
  }
  const list = foods.filter((f) => f[iDesc] && f[iCat] !== "3" && !isBranded(f[iDesc])) // 3 = aliments pour bébés
    .map((f) => ({ id: f[iId], desc: f[iDesc], v: vals.get(f[iId]) || {} }))
    .filter((x) => x.v.kcal != null && x.v.prot != null && x.v.carbs != null && x.v.fat != null);
  log(`${list.length.toLocaleString("fr-FR")} aliments génériques USDA retenus (sur ${foods.length.toLocaleString("fr-FR")}).`);

  const cacheFile = path.join(ROOT, "scripts", "usda-translations.json");
  const cache = fs.existsSync(cacheFile) ? JSON.parse(fs.readFileSync(cacheFile, "utf8")) : {};
  const todo = list.filter((x) => !cache[x.id]);
  if (todo.length) {
    if (!key) die(`${todo.length} noms à traduire : lance avec GEMINI_API_KEY=ta_clé (clé gratuite de aistudio.google.com)`);
    log(`Traduction de ${todo.length} noms avec ${model} (par lots de 120, reprise possible)…`);
    for (let i = 0; i < todo.length; i += 120) {
      const batch = todo.slice(i, i + 120);
      const fr = await translateBatch(key, model, batch);
      batch.forEach((x, k) => { cache[x.id] = fr[k]; });
      fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 0));
      log(`  ${Math.min(i + 120, todo.length)} / ${todo.length}`);
      await new Promise((r) => setTimeout(r, 4500)); // reste sous la limite gratuite (requêtes par minute)
    }
  }
  const rows = list.filter((x) => cache[x.id]).map((x) => [
    Number(x.id), cache[x.id], Math.round(x.v.kcal), r1(x.v.prot), r1(x.v.carbs), r1(x.v.fat),
    x.v.sugar != null ? r1(x.v.sugar) : null, x.v.fiber != null ? r1(x.v.fiber) : null,
    x.v.sodium != null ? Math.round(x.v.sodium * 2.5 / 100) / 10 : null, x.v.satfat != null ? r1(x.v.satfat) : null,
    x.v.water != null ? r1(x.v.water) : null,
  ]).sort((a, b) => a[1].localeCompare(b[1], "fr"));
  const outFile = path.join(ROOT, "src", "data", "usda-fr.json");
  fs.writeFileSync(outFile, JSON.stringify({ v: 1, source: "USDA FoodData Central, SR Legacy (domaine public), noms traduits", date: new Date().toISOString().slice(0, 10), fields: USDA_FIELDS, rows }));
  log(`✓ ${rows.length.toLocaleString("fr-FR")} aliments → ${path.relative(process.cwd(), outFile)} (${fmtMB(fs.statSync(outFile).size)})`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (cmd === "off") await buildOff();
  else if (cmd === "usda") await buildUsda();
  else {
    log("Utilisation :\n  node scripts/build-food-db.mjs off  [--source URL|fichier] [--country france] [--top 100000] [--out build-db]\n  GEMINI_API_KEY=… node scripts/build-food-db.mjs usda [--zip fichier.zip] [--model gemini-flash-latest]");
    process.exit(cmd ? 1 : 0);
  }
}
