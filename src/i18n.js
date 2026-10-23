// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Les auteurs de NutriMaison
/*
 * Langue de l'interface : français (langue d'origine) ou anglais.
 *
 * L'appli est écrite en français. En anglais, une couche de traduction remplace à l'affichage
 * les textes français par leur traduction (src/i18n/en.json) : textes, champs de saisie, infobulles,
 * boîtes de dialogue. Les données enregistrées (repas, recettes, réglages) ne changent jamais
 * de langue, seul l'affichage est traduit. Les dates et nombres passent au format anglais,
 * et l'IA reçoit la consigne de répondre en anglais.
 *
 * Changer de langue recharge l'appli (les textes fixes sont lus au démarrage).
 */
import EN from "./i18n/en.json";

const PREF_KEY = "language"; // "auto" | "fr" | "en"

export function langPref() {
  try { const v = localStorage.getItem(PREF_KEY); return v === "fr" || v === "en" ? v : "auto"; } catch (e) { return "auto"; }
}
function systemLang() {
  const l = (navigator.languages && navigator.languages[0]) || navigator.language || "fr";
  return /^fr/i.test(l) ? "fr" : "en";
}
/** Langue en cours pour cette ouverture de l'appli. */
export const LANG = langPref() === "auto" ? systemLang() : langPref();
export const isEnglish = LANG === "en";

/** Jours de la semaine, du lundi au dimanche. */
export const DOW_LETTERS = isEnglish ? ["M", "T", "W", "T", "F", "S", "S"] : ["L", "M", "M", "J", "V", "S", "D"];
export const DOW_SHORT = isEnglish ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] : ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

export function setLangPref(v) {
  try { if (v === "auto") localStorage.removeItem(PREF_KEY); else localStorage.setItem(PREF_KEY, v); } catch (e) {}
  location.reload();
}

/** Consigne ajoutée aux demandes faites à l'IA quand l'appli est en anglais. */
export function aiLanguageNote() {
  return isEnglish
    ? "\n\nIMPORTANT: write every human-readable text value of your answer (food names, dish names, advice, explanations, exercise names) in English. Keep the JSON keys exactly as requested."
    : "";
}

/* ---------------- traduction d'un texte ---------------- */
const S = EN.s || {};
// {} = n'importe quel texte, {#} = un nombre (pour les modèles courts, qui pourraient sinon toucher autre chose)
const PATTERNS = (EN.p || []).map(([fr, en]) => {
  const re = fr.split(/(\{#?\})/).map((x) => (x === "{}" ? "(.+?)" : x === "{#}" ? "(\\d[\\d\\s.,\u202f\u00a0]*)" : x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))).join("");
  return { re: new RegExp("^" + re + "$"), en: en.replace(/\{#\}/g, "{}") };
});
const memo = new Map();

function fixNumbers(s) {
  // décimales à la française écrites à la main (« 1,5 kg ») → « 1.5 kg » ; les milliers (1,234) ne bougent pas
  return s.replace(/(\d),(\d{1,2})(?!\d)/g, "$1.$2").replace(/«\s?/g, "\u201c").replace(/\s?»/g, "\u201d");
}
function lookup(core) {
  if (Object.prototype.hasOwnProperty.call(S, core)) return S[core];
  for (const { re, en } of PATTERNS) {
    const m = core.match(re);
    if (m) { let k = 1; return en.replace(/\{\}/g, () => { const v = m[k++]; return lookup(v.trim()) ?? v; }); }
  }
  return null;
}
/** Texte français → anglais (ou null si inconnu). Garde les espaces, la ponctuation et les symboles autour. */
function translateCore(core) {
  let r = lookup(core);
  if (r != null) return r;
  // symboles ou ponctuation autour : « ✓ Installée : », « (estimé IA) », « Poids : »
  const m = core.match(/^([^A-Za-zÀ-ÿ]*)(.*?)([\s:.,;!?…)»"]*)$/);
  if (m && m[2] && (m[1] || m[3])) {
    r = lookup(m[2]);
    if (r != null) return m[1] + r + m[3].replace(/\s+(?=[:;!?])/g, "");
  }
  // morceaux séparés par « · » ou « — »
  for (const sep of [" · ", " — ", " / "]) {
    if (core.includes(sep)) {
      const bits = core.split(sep);
      const tr = bits.map((b) => (b.trim() ? translateCore(b.trim()) : null));
      if (tr.some((x) => x != null)) return bits.map((b, i) => tr[i] ?? b).join(sep);
    }
  }
  // listes « a, b, c » : seulement si chaque élément est connu (sinon une phrase serait coupée)
  if (core.includes(", ")) {
    const bits = core.split(", ");
    const trb = bits.map((b) => lookup(b.trim()));
    if (trb.every((x) => x != null)) return trb.join(", ");
  }
  return null;
}
export function tr(text) {
  if (!isEnglish || text == null) return text;
  const s = String(text);
  if (!/[A-Za-zÀ-ÿ]/.test(s)) return fixNumbers(s);
  if (memo.has(s)) return memo.get(s);
  const lead = s.match(/^\s*/)[0], trail = s.match(/\s*$/)[0];
  const core = s.trim().replace(/\s+/g, " ");
  const r = translateCore(core);
  const out = r == null ? fixNumbers(s) : lead + fixNumbers(r) + trail;
  if (memo.size > 5000) memo.clear();
  memo.set(s, out);
  return out;
}

/** Ajoute des traductions (ex. noms d'aliments) ; les textes déjà affichés sont mis à jour. */
export function addTranslations(map) {
  if (!isEnglish || !map) return;
  let n = 0;
  for (const k in map) if (map[k] && !Object.prototype.hasOwnProperty.call(S, k)) { S[k] = map[k]; n++; }
  if (n) { memo.clear(); if (document.body) fixTree(document.body); }
}
/** Traduction exacte d'un nom (sans découpage), ou null. */
export function exactEn(name) {
  return isEnglish && Object.prototype.hasOwnProperty.call(S, name) ? S[name] : null;
}

/** Noms anglais des aliments des bases (Ciqual officiel, USDA d'origine), chargés en anglais seulement. */
export const foodNamesReady = !isEnglish ? Promise.resolve() : Promise.all([
  import("./data/ciqual-en.json").then((m) => {
    const d = m.default || m;
    addTranslations(d.names);
    addTranslations(d.groups);
  }).catch(() => {}),
  import("./data/usda-fr.json").then((m) => {
    const d = m.default || m;
    const k = (d.fields || []).indexOf("en");
    if (k < 0) return;
    const map = {};
    for (const r of d.rows || []) if (r[k]) map[r[1]] = r[k];
    addTranslations(map);
    addTranslations({ "USDA (traduit)": "USDA" });
  }).catch(() => {}),
]);

/* ---------------- branchement sur l'affichage ---------------- */
const ATTRS = ["placeholder", "title", "aria-label", "alt"];
const SKIP = new Set(["SCRIPT", "STYLE", "TEXTAREA", "CODE", "PRE"]);

function skipped(el) {
  for (let e = el; e; e = e.parentElement) { if (SKIP.has(e.tagName) || e.hasAttribute?.("data-notr")) return true; }
  return false;
}
function fixText(node) {
  const v = node.nodeValue;
  if (!v || !v.trim() || skipped(node.parentElement)) return;
  const r = tr(v);
  if (r !== v) node.nodeValue = r;
}
function fixAttrs(el) {
  for (const a of ATTRS) {
    const v = el.getAttribute(a);
    if (v) { const r = tr(v); if (r !== v) el.setAttribute(a, r); }
  }
}
function fixTree(root) {
  if (root.nodeType === 3) return fixText(root);
  if (root.nodeType !== 1 || skipped(root)) return;
  fixAttrs(root);
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let n = w.nextNode(); n; n = w.nextNode()) { if (n.nodeType === 3) fixText(n); else fixAttrs(n); }
}

/** À appeler une fois avant le premier affichage. Ne fait rien en français. */
export function installI18n() {
  document.documentElement.lang = LANG;
  if (!isEnglish) return;

  // dates et nombres : les appels écrits pour « fr-FR » passent au format anglais (jour/mois, 24 h)
  const loc = (l) => (l == null || /^fr/i.test(String(l)) ? "en-GB" : l);
  for (const [proto, names] of [[Date.prototype, ["toLocaleDateString", "toLocaleTimeString", "toLocaleString"]], [Number.prototype, ["toLocaleString"]]]) {
    for (const n of names) { const orig = proto[n]; proto[n] = function (l, o) { return orig.call(this, loc(l), o); }; }
  }
  for (const k of ["DateTimeFormat", "NumberFormat", "RelativeTimeFormat", "PluralRules"]) {
    const Orig = Intl[k];
    if (!Orig) continue;
    const Wrapped = function (l, o) { return new Orig(loc(l), o); };
    Wrapped.prototype = Orig.prototype;
    Wrapped.supportedLocalesOf = Orig.supportedLocalesOf;
    Intl[k] = Wrapped;
  }

  // boîtes de dialogue du navigateur
  for (const k of ["alert", "confirm", "prompt"]) {
    const orig = window[k];
    if (orig) window[k] = (msg, ...rest) => orig.call(window, tr(msg), ...rest);
  }

  // textes affichés : traduits dès qu'ils apparaissent ou changent
  const start = () => {
    fixTree(document.body);
    new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.type === "characterData") fixText(m.target);
        else if (m.type === "attributes") fixAttrs(m.target);
        else m.addedNodes.forEach(fixTree);
      }
    }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    const t = document.querySelector("title");
    if (t) document.title = tr(document.title);
  };
  if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);
}
