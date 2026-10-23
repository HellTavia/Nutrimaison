#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Les auteurs de NutriMaison
/*
 * Fabrique les bases d'aliments hors ligne de NutriMaison. Aucune dépendance : Node 18 ou plus.
 *
 *  1) Produits de marque (Open Food Facts, licence ODbL)
 *       node scripts/build-food-db.mjs off [--source URL|fichier.jsonl.gz] [--country france] [--top 100000] [--out build-db] [--limit N]
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
 *       GEMINI_API_KEY=… node scripts/build-food-db.mjs usda [--zip fichier.zip] [--model gemma-3-27b-it] [--rpm 20]
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
/* Valeurs pour 100 g. Depuis 2026, Open Food Facts range la nutrition dans nutrition.aggregated_set.nutrients
   (unités normalisées : g, kcal pour energy-kcal, kJ pour energy) ; l'ancien champ « nutriments » n'est plus
   présent pour la plupart des produits. On lit le nouveau format, puis l'ancien en secours. */
const AGG_KEYS = { kcal: ["energy-kcal"], kj: ["energy", "energy-kj"], prot: ["proteins"], carbs: ["carbohydrates"], fat: ["fat"],
  sugar: ["sugars"], fiber: ["fiber", "fibers"], salt: ["salt"], sodium: ["sodium"], satfat: ["saturated-fat"] };
const OLD_KEYS = { kcal: ["energy-kcal_100g"], kj: ["energy_100g", "energy-kj_100g"], prot: ["proteins_100g"], carbs: ["carbohydrates_100g"],
  fat: ["fat_100g"], sugar: ["sugars_100g"], fiber: ["fiber_100g"], salt: ["salt_100g"], sodium: ["sodium_100g"], satfat: ["saturated-fat_100g"] };
export function nutrientsOf(p) {
  const out = {};
  const agg = p.nutrition?.aggregated_set;
  const aggOk = agg && agg.nutrients && (!agg.per || /^100\s*(g|ml)$/i.test(agg.per)) && (!agg.preparation || agg.preparation === "as_sold");
  const old = p.nutriments || {};
  for (const k of Object.keys(AGG_KEYS)) {
    let v = null;
    if (aggOk) for (const key of AGG_KEYS[k]) { const e = agg.nutrients[key]; v = num(e && typeof e === "object" ? (e.value ?? e.value_computed) : e); if (v != null) break; }
    if (v == null) for (const key of OLD_KEYS[k]) { v = num(old[key]); if (v != null) break; }
    out[k] = v;
  }
  if (out.kcal == null && out.kj != null) out.kcal = out.kj / 4.184;
  if (out.salt == null && out.sodium != null) out.salt = out.sodium * 2.5;
  return out;
}

export const rejects = {}; // raison → nombre, pour le bilan affiché en fin de lecture
const reject = (why) => { rejects[why] = (rejects[why] || 0) + 1; return null; };

/** Produit Open Food Facts → ligne compacte, ou null s'il est incomplet ou incohérent. */
export function offRow(p, country) {
  if (!p) return null;
  const tags = p.countries_tags || p.countries_hierarchy;
  if (!Array.isArray(tags) || !tags.includes("en:" + country)) return null; // hors pays : pas compté
  const code = String(p.code || p._id || "").replace(/\D/g, "");
  if (code.length < 8 || code.length > 14) return reject("code-barres invalide");
  const n = nutrientsOf(p);
  const { kcal, prot, carbs, fat } = n;
  if ([kcal, prot, carbs, fat].some((v) => v == null)) return reject("valeurs nutritionnelles manquantes");
  if (kcal < 0 || kcal > 950 || [prot, carbs, fat].some((v) => v < 0 || v > 100) || prot + carbs + fat > 105) return reject("valeurs incohérentes");
  const name = clean(p.product_name_fr || (p.lang === "fr" && p.product_name) || p.product_name || p.generic_name_fr, 90);
  if (name.length < 2) return reject("sans nom");
  const brand = clean(String(p.brands || "").split(",")[0], 40);
  const opt1 = (v) => (v == null || v < 0 || v > 100 ? null : r1(v));
  const portion = num(p.serving_quantity);
  return {
    code, scans: Number(p.unique_scans_n) || 0, compl: Number(p.completeness) || 0,
    row: [code, name, brand, Math.round(kcal), r1(prot), r1(carbs), r1(fat), opt1(n.sugar), opt1(n.fiber), opt1(n.salt),
      opt1(n.satfat), portion > 0 && portion <= 1000 ? Math.round(portion) : null],
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
  let lines = 0, bad = 0, inCountry = 0, sample = null;
  const limit = Number(opt("limit", 0)); // pour un essai rapide : s'arrête après N lignes
  const t0 = Date.now();
  for await (const line of rl) {
    lines++;
    if (lines % 200000 === 0) log(`  ${lines.toLocaleString("fr-FR")} produits lus, ${byCode.size.toLocaleString("fr-FR")} retenus (${Math.round((Date.now() - t0) / 1000)} s)`);
    if (limit && lines >= limit) break;
    if (!line.includes(`"en:${country}"`)) continue; // tri rapide avant de lire le JSON
    let p; try { p = JSON.parse(line); } catch (e) { bad++; continue; }
    if (limit && lines >= limit) break;
    const tags = p.countries_tags || p.countries_hierarchy;
    if (!Array.isArray(tags) || !tags.includes("en:" + country)) continue;
    inCountry++;
    const r = offRow(p, country);
    if (!r) { if (!sample && (p.unique_scans_n || 0) > 20) sample = p; continue; } // exemple pour le diagnostic
    const prev = byCode.get(r.code);
    if (!prev || r.scans > prev.scans) byCode.set(r.code, r);
  }
  const fr = (v) => v.toLocaleString("fr-FR");
  log(`Lecture terminée : ${fr(lines)} produits, dont ${fr(inCountry)} vendus en « ${country} », ${fr(byCode.size)} retenus${bad ? `, ${bad} lignes illisibles` : ""}.`);
  const why = Object.entries(rejects).sort((a, b) => b[1] - a[1]);
  if (why.length) log("Écartés : " + why.map(([k, v]) => `${k} ${fr(v)}`).join(", "));
  if (sample) {
    const short = (o) => JSON.stringify(o, null, 0)?.slice(0, 1500);
    log(`Exemple d'un produit écarté (${sample.code}) :\n  clés : ${Object.keys(sample).filter((k) => /nutri|energy|serving|countries|product_name$/.test(k)).join(", ")}` +
      `\n  nutriments : ${short(sample.nutriments)}\n  nutrition : ${short(sample.nutrition)}`);
  }
  if (!byCode.size) die("aucun produit retenu : vérifie le pays (--country) et la source");
  const min = Number(opt("min", limit ? 0 : 5000));
  if (byCode.size < min) die(`seulement ${fr(byCode.size)} produits retenus (minimum ${fr(min)}) : le format d'Open Food Facts a sans doute changé, rien n'est publié.`);

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
export const USDA_FIELDS = ["id", "name", "kcal", "prot", "carbs", "fat", "sugar", "fiber", "salt", "satfat", "water", "en"]; // en : nom américain d'origine (appli en anglais)
/** Aliment de marque (mot en majuscules de 4 lettres ou plus : KELLOGG'S, MCDONALD'S…) : inutile en France. */
// Produits de marque (BURGER KING, McDONALD'S…) : quatre majuscules à la suite, sauf « USDA ».
export const isBranded = (d) => /[A-Z]{4,}/.test(String(d).replace(/\bUSDA\b/g, "")) || /\b[A-Z][A-Z'&.-]{3,}\b/.test(d);
/** Nom affiché : complet s'il est court, sinon coupé à la dernière virgule avant la limite. */
export function shortName(s, max = 110) {
  s = clean(s, 400);
  if (s.length <= max) return s;
  const cut = s.lastIndexOf(",", max);
  return cut > 20 ? s.slice(0, cut) : s.slice(0, max).replace(/\s+\S*$/, "");
}

// unzip sous Linux/macOS ; sinon tar (bsdtar, fourni avec Windows 10 et 11), qui lit aussi les zip.
function zipTool() {
  for (const t of ["unzip", "tar"]) {
    try { execFileSync(t, t === "unzip" ? ["-v"] : ["--version"], { stdio: "ignore" }); return t; } catch {}
  }
  die("ni unzip ni tar trouvés pour ouvrir le zip USDA");
}
function readZipCsv(zip, name) {
  const t = zipTool();
  const list = execFileSync(t, t === "unzip" ? ["-Z1", zip] : ["-tf", zip], { encoding: "utf8", maxBuffer: 1 << 26 }).split(/\r?\n/);
  const entry = list.find((l) => l.endsWith("/" + name) || l === name);
  if (!entry) die(`${name} absent du zip`);
  return execFileSync(t, t === "unzip" ? ["-p", zip, entry] : ["-xOf", zip, entry], { encoding: "utf8", maxBuffer: 1 << 30 });
}

// Modèles essayés dans l'ordre : Gemma a le plus gros quota gratuit (environ 30 requêtes/min, 14 400/jour),
// les Gemini Flash sont bien plus limités. --model force un modèle précis.
const USDA_MODELS = ["gemma-3-27b-it", "gemini-flash-lite-latest", "gemini-flash-latest"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function translateBatch(key, model, items) {
  const prompt = `Traduis en français ces noms d'aliments de la base nutritionnelle américaine USDA, dans le style de la table française Ciqual :
nom de l'aliment d'abord, puis les précisions séparées par des virgules (« Poulet, blanc, sans peau, rôti »), vocabulaire courant en France,
unités et marques américaines retirées si elles n'aident pas. Garde EXACTEMENT le même ordre et le même nombre d'éléments.
Réponds UNIQUEMENT avec un tableau JSON de chaînes, sans aucun autre texte.
${JSON.stringify(items.map((x) => x.desc))}`;
  const generationConfig = { temperature: 0.1 };
  if (!model.startsWith("gemma")) generationConfig.responseMimeType = "application/json"; // Gemma refuse ce mode
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
      const m = text.match(/\[[\s\S]*\]/);
      let arr; try { arr = JSON.parse(m ? m[0] : text); } catch (e) { arr = null; }
      if (Array.isArray(arr) && arr.length === items.length) return arr.map((s) => clean(s, 400));
      log("  réponse incomplète, nouvel essai…");
      continue;
    }
    const msg = data.error?.message || String(res.status);
    if (res.status === 404 || (res.status === 400 && /not found|not supported/i.test(msg))) return { unavailable: msg };
    if (res.status === 429) {
      // Quota du jour épuisé : inutile d'insister, on s'arrête proprement (reprise demain).
      const perDay = JSON.stringify(data.error || {}).match(/PerDay/i);
      if (perDay) return { daily: msg };
      const delay = JSON.stringify(data.error || {}).match(/"retryDelay":"(\d+)s"/);
      const wait = (delay ? Number(delay[1]) + 2 : 65) * 1000;
      log(`  limite par minute atteinte, pause de ${Math.round(wait / 1000)} s…`);
      await sleep(wait);
      continue;
    }
    if (res.status >= 500) { log(`  Gemini indisponible (${res.status}), pause de 30 s…`); await sleep(30000); continue; }
    die("Gemini : " + msg);
  }
  die("Gemini ne répond pas correctement, relance plus tard (les traductions déjà faites sont gardées)");
}

async function buildUsda() {
  const key = process.env.GEMINI_API_KEY;
  let models = opt("model", null) ? [opt("model", null)] : USDA_MODELS.slice();
  const rpm = Number(opt("rpm", 0)); // requêtes par minute ; 0 = selon le modèle
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
  if (!cache.__v) { // 1re version : traductions coupées à 90 caractères, on refait seulement celles-là
    let n = 0; for (const [k, v] of Object.entries(cache)) if (String(v).length >= 89) { delete cache[k]; n++; }
    if (n) log(`${n} traductions coupées trop court : elles vont être refaites.`);
    cache.__v = 2;
  }
  const todo = list.filter((x) => !cache[x.id]);
  if (todo.length) {
    if (!key) die(`${todo.length} noms à traduire : lance avec GEMINI_API_KEY=ta_clé (clé gratuite de aistudio.google.com)`);
    const gap = (m) => 60000 / (rpm || (m.startsWith("gemma") ? 20 : 4)) ; // marge sous les limites gratuites
    log(`Traduction de ${todo.length} noms par lots de 120 (reprise possible), modèle ${models[0]}…`);
    for (let i = 0; i < todo.length; ) {
      const batch = todo.slice(i, i + 120);
      const t0 = Date.now();
      const fr = await translateBatch(key, models[0], batch);
      if (fr.unavailable) {
        log(`  ${models[0]} indisponible (${fr.unavailable})`);
        models.shift();
        if (!models.length) die("aucun modèle disponible : relance avec --model nom_du_modèle (voir aistudio.google.com)");
        log(`  → essai avec ${models[0]}`);
        continue;
      }
      if (fr.daily) die(`quota du jour épuisé pour ${models[0]} (${fr.daily}).\n  ${i} noms traduits ici, ils sont gardés : relance la même commande demain (le quota repart vers 9 h, heure de Paris), ou avec --model un_autre_modèle.`);
      batch.forEach((x, k) => { cache[x.id] = fr[k]; });
      fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 0));
      i += batch.length;
      log(`  ${i} / ${todo.length}`);
      if (i < todo.length) await sleep(Math.max(0, gap(models[0]) - (Date.now() - t0)));
    }
  }
  const rows = list.filter((x) => cache[x.id]).map((x) => [
    Number(x.id), shortName(cache[x.id]), Math.round(x.v.kcal), r1(x.v.prot), r1(x.v.carbs), r1(x.v.fat),
    x.v.sugar != null ? r1(x.v.sugar) : null, x.v.fiber != null ? r1(x.v.fiber) : null,
    x.v.sodium != null ? Math.round(x.v.sodium * 2.5 / 100) / 10 : null, x.v.satfat != null ? r1(x.v.satfat) : null,
    x.v.water != null ? r1(x.v.water) : null,
    shortName(x.desc),
  ]).sort((a, b) => a[1].localeCompare(b[1], "fr"));
  const outFile = path.join(ROOT, "src", "data", "usda-fr.json");
  fs.writeFileSync(outFile, JSON.stringify({ v: 1, source: "USDA FoodData Central, SR Legacy (domaine public), noms traduits", date: new Date().toISOString().slice(0, 10), fields: USDA_FIELDS, rows }));
  log(`✓ ${rows.length.toLocaleString("fr-FR")} aliments → ${path.relative(process.cwd(), outFile)} (${fmtMB(fs.statSync(outFile).size)})`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (cmd === "off") await buildOff();
  else if (cmd === "usda") await buildUsda();
  else {
    log("Utilisation :\n  node scripts/build-food-db.mjs off  [--source URL|fichier] [--country france] [--top 100000] [--out build-db] [--limit N]\n  GEMINI_API_KEY=… node scripts/build-food-db.mjs usda [--zip fichier.zip] [--model gemma-3-27b-it] [--rpm 20]");
    process.exit(cmd ? 1 : 0);
  }
}
