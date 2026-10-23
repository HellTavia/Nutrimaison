// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Les auteurs de NutriMaison
/*
 * Liste les textes français de l'interface qui n'ont pas encore de traduction anglaise.
 *
 *   node scripts/i18n-check.mjs            → affiche les textes manquants
 *   node scripts/i18n-check.mjs --tsv f    → les écrit dans f (une ligne par texte : « français<TAB> »),
 *                                            à compléter puis à fusionner avec --merge
 *   node scripts/i18n-check.mjs --merge f  → ajoute les traductions du fichier f dans src/i18n/en.json
 *
 * Utilise @babel/parser, déjà installé avec Vite (npm install). Les textes avec une partie variable
 * (`${x} kcal`) deviennent des modèles « {} kcal » ; dans en.json, {#} remplace {} quand la partie variable
 * est forcément un nombre (utile pour les modèles très courts). Les consignes envoyées à l'IA sont ignorées.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "@babel/parser";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src");
const EN_FILE = path.join(SRC, "i18n", "en.json");
const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf("--" + k); return i >= 0 ? args[i + 1] : null; };

function writeEn(d) {
  const j = JSON.stringify;
  fs.writeFileSync(EN_FILE, "{\n\"//\": " + j(d["//"]) + ",\n\"s\": {\n" + Object.entries(d.s).map(([k, v]) => j(k) + ": " + j(v)).join(",\n") +
    "\n},\n\"p\": [\n" + d.p.map((x) => j(x)).join(",\n") + "\n]\n}\n");
}

if (opt("merge")) {
  const d = JSON.parse(fs.readFileSync(EN_FILE, "utf8"));
  let n = 0;
  for (const l of fs.readFileSync(opt("merge"), "utf8").split("\n")) {
    const [fr0, en] = l.split("\t");
    if (!fr0 || !en || !en.trim()) continue;
    const fr = fr0.replace(/\s+/g, " ").trim();
    if (/\{#?\}/.test(fr)) { d.p = d.p.filter((x) => x[0] !== fr); d.p.push([fr, en.trim()]); } else d.s[fr] = en.trim();
    n++;
  }
  writeEn(d);
  console.log(`${n} traductions ajoutées dans src/i18n/en.json`);
  process.exit(0);
}

const ACCENT = /[àâçéèêëîïôûùüÿœ]/i;
const FR_WORD = /\b(le|la|les|des|du|de|et|ton|tes|ta|pour|avec|sans|une|un|est|pas|au|aux|sur|dans|ce|cette|tu|ou|par|ajouter|voir|mes|mon|ma)\b/i;
/** Vrai si le texte ressemble à du français affiché (et pas à un identifiant, du CSS, une URL…). */
function looksFrench(t) {
  if (t.length < 2 || !/[a-zà-ÿ]/i.test(t)) return false;
  if (/^(https?:|\/|#|data:|[a-z]+:\/\/)/.test(t)) return false;
  if (/[{};]|=>|var\(|rgba?\(|\dpx\b|calc\(/.test(t.replace(/\{\}/g, ""))) return false;
  if (/JSON|Réponds|^Tu es /.test(t)) return false; // consignes pour l'IA
  if (/sans-serif|monospace|^Bearer$/.test(t)) return false; // polices, en-têtes
  if (/^[a-z0-9_.\-/:]+$/i.test(t) && !ACCENT.test(t)) return /^[A-ZÀ-Ý][a-zà-ÿ]{2,}$/.test(t); // mot isolé avec majuscule : libellé
  return ACCENT.test(t) || FR_WORD.test(t) || /^[A-ZÀ-Ý]/.test(t);
}

const files = [];
(function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) { if (!/^(data|i18n)$/.test(f)) walk(p); }
    else if (/\.(jsx?|mjs)$/.test(f) && !/^(version|i18n)\.js$/.test(f)) files.push(p);
  }
})(SRC);

const found = new Map();
const add = (t, file) => { t = t.replace(/\s+/g, " ").trim(); if (looksFrench(t)) { if (!found.has(t)) found.set(t, new Set()); found.get(t).add(path.relative(SRC, file)); } };
for (const file of files) {
  const ast = parse(fs.readFileSync(file, "utf8"), { sourceType: "module", plugins: ["jsx"], errorRecovery: true });
  (function visit(n, parent) {
    if (!n || typeof n.type !== "string") return;
    if (n.type === "ImportDeclaration" || n.type === "ExportAllDeclaration") return;
    if (n.type === "JSXText") add(n.value, file);
    else if (n.type === "StringLiteral" && !(parent && parent.type === "ObjectProperty" && parent.key === n)) add(n.value, file);
    else if (n.type === "TemplateLiteral") add(n.quasis.map((q) => q.value.cooked).join("{}"), file);
    for (const k in n) {
      if (k === "loc" || k === "start" || k === "end") continue;
      const v = n[k];
      if (Array.isArray(v)) v.forEach((c) => visit(c, n)); else if (v && typeof v === "object") visit(v, n);
    }
  })(ast.program, null);
}

const en = JSON.parse(fs.readFileSync(EN_FILE, "utf8"));
const known = new Set([...Object.keys(en.s), ...en.p.map((x) => x[0].replace(/\{#\}/g, "{}"))]);
const missing = [...found.entries()].filter(([t]) => !known.has(t)).sort((a, b) => [...a[1]][0].localeCompare([...b[1]][0]));
if (opt("tsv")) {
  fs.writeFileSync(opt("tsv"), missing.map(([t]) => t + "\t").join("\n") + "\n");
  console.log(`${missing.length} textes à traduire écrits dans ${opt("tsv")} (complète la 2e colonne, puis --merge).`);
} else {
  for (const [t, f] of missing) console.log(`${[...f].join(", ")}\t${t}`);
  console.log(`\n${missing.length} textes sans traduction (sur ${found.size}). Certains sont des identifiants internes : à ignorer.`);
}
