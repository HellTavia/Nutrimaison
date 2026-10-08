// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Les auteurs de NutriMaison
/* ================================================================== */
/* TABLE CIQUAL (Anses) — 3 341 aliments génériques, hors ligne         */
/* Source : Anses. 2025. Table de composition nutritionnelle des       */
/* aliments Ciqual. Licence Ouverte Etalab.                            */
/* Chargée à la demande (fichier séparé) pour ne pas ralentir le       */
/* démarrage de l'app.                                                  */
/* ================================================================== */
export const CIQUAL_CITATION = "Anses. 2025. Table de composition nutritionnelle des aliments Ciqual.";

let cache = null;
let loading = null;

function norm(s) { return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }
const COMPOSITE = /sandwich|plats|pizza|salades composees|soupes|quiches|feuilletes|desserts|viennois/;
const STOP = new Set(["de", "du", "des", "la", "le", "les", "l", "d", "au", "aux", "a", "en", "et", "un", "une", "avec", "sans"]);

export function loadCiqual() {
  if (cache) return Promise.resolve(cache);
  if (!loading) {
    loading = import("./ciqual.json").then((mod) => {
      const d = mod.default || mod;
      const idx = Object.fromEntries(d.fields.map((f, i) => [f, i]));
      cache = d.foods.map((r) => ({
        id: "cq_" + r[idx.code],
        name: r[idx.name],
        group: d.groups[r[idx.group]],
        kcal: r[idx.kcal] || 0,
        prot: r[idx.prot] || 0,
        carbs: r[idx.carbs] || 0,
        fat: r[idx.fat] || 0,
        sugar: r[idx.sugar], fiber: r[idx.fiber], satfat: r[idx.satfat], salt: r[idx.salt],
        water100: r[idx.water],
        ciqual: true,
        _n: norm(r[idx.name]),
        _g: norm(d.groups[r[idx.group]]),
      }));
      return cache;
    });
  }
  return loading;
}

/** Recherche mot à mot, sans accents ; les noms qui commencent par le premier mot passent devant. */
export function searchCiqual(q, limit = 25) {
  if (!cache) return [];
  const tokens = norm(q).split(/[^a-z0-9]+/).filter((t) => t && !STOP.has(t));
  if (!tokens.length) return [];
  const hits = [];
  for (const f of cache) {
    let ok = true;
    for (const t of tokens) {
      if (!(f._n.includes(t) || (t.length > 3 && t.endsWith("s") && f._n.includes(t.slice(0, -1))))) { ok = false; break; }
    }
    if (!ok) continue;
    const first = tokens[0];
    // le mot cherché tôt dans le nom = aliment de base (« Pain, baguette » avant « Sandwich baguette … »)
    const pos = f._n.indexOf(first);
    let score = (pos === 0 ? 0 : 500) + pos * 8 + f._n.length;
    // plats composés (sandwichs, pizzas…) après les aliments simples, sauf si on les cherche
    if (COMPOSITE.test(f._g) && !tokens.some((t) => f._g.includes(t))) score += 400;
    hits.push([score, f]);
  }
  hits.sort((a, b) => a[0] - b[0]);
  return hits.slice(0, limit).map((h) => h[1]);
}

import { useEffect, useState } from "react";
/** Hook : vaut true dès que la table est chargée (relance le rendu). */
export function useCiqualReady() {
  const [ready, setReady] = useState(!!cache);
  useEffect(() => { if (!cache) loadCiqual().then(() => setReady(true)).catch(() => {}); }, []);
  return ready;
}
