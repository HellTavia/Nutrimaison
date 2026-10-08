// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Les auteurs de NutriMaison
import React, { useState, useMemo, useRef } from "react";
import { Sparkles, Loader2, X, Plus, Minus, Check } from "lucide-react";
import { C, MONO, round, uid, NumInput } from "./shared.jsx";
import { geminiGenerate, parseJSONLoose } from "./gemini.js";

const EXAMPLES = [
  "2 tortillas de blé, 150 g de poulet grillé, 30 g de cheddar, salade, 1 c. à soupe de sauce blanche",
  "Assiette de pâtes bolognaise et un yaourt nature",
  "Recette : 500 g de pâtes, 400 g de bœuf haché 5 %, 1 pot de sauce tomate, 1 oignon, 50 g de parmesan",
];

/** Demande à Gemini les valeurs nutritionnelles d'une liste d'aliments décrite en texte libre. */
export async function aiEstimateItems(apiKey, text, onStatus, signal) {
  const out = await geminiGenerate(apiKey, [{ text:
`Tu es diététicien. Voici ce qu'une personne a mangé ou cuisiné (en français) :
« ${text.trim()} »

Pour CHAQUE aliment ou ingrédient :
- si la quantité n'est pas donnée, estime une portion standard française (1 tortilla de blé ≈ 40 g, 1 c. à soupe ≈ 15 g, 1 yaourt ≈ 125 g, 1 œuf ≈ 50 g…) ;
- donne le poids en grammes et les valeurs POUR CE POIDS : kcal, protéines, glucides, lipides (valeurs réalistes type table Ciqual, aliments cuits si c'est ainsi qu'on les mange, sauf précision contraire).
Réponds UNIQUEMENT avec un tableau JSON : [{"name":"...","grams":0,"kcal":0,"prot":0,"carbs":0,"fat":0}]` }],
    { onStatus, temperature: 0.2, signal, timeoutMs: 40000 });
  const parsed = parseJSONLoose(out);
  const list = Array.isArray(parsed) ? parsed : (parsed?.items || parsed?.aliments || []);
  return list.filter((x) => x && x.name).map((x) => {
    const g = Math.max(1, Number(x.grams) || 100);
    return {
      id: uid(), name: String(x.name).slice(0, 80), grams: Math.round(g),
      // valeurs pour 100 g gardées pour pouvoir changer le poids proprement
      k100: (Number(x.kcal) || 0) / g * 100, p100: (Number(x.prot) || 0) / g * 100,
      c100: (Number(x.carbs) || 0) / g * 100, f100: (Number(x.fat) || 0) / g * 100,
    };
  });
}

/** Valeurs pour 100 g d'un aliment (bouton « estimer avec l'IA » de la recherche manuelle). */
export async function aiFoodPer100(apiKey, name, onStatus) {
  const out = await geminiGenerate(apiKey, [{ text:
`Donne les valeurs nutritionnelles moyennes POUR 100 g de : « ${name.trim()} » (aliment tel qu'on le mange en France, valeurs réalistes type Ciqual ou produit courant du commerce).
Réponds UNIQUEMENT en JSON : {"name":"nom précis en français","kcal":0,"prot":0,"carbs":0,"fat":0}` }], { onStatus, temperature: 0.1 });
  const x = parseJSONLoose(out);
  if (!x || x.kcal == null) throw new Error("réponse inattendue");
  return {
    id: "ia_" + uid(), name: String(x.name || name).slice(0, 80) + " (estimé IA)", brand: true, ai: true,
    kcal: Number(x.kcal) || 0, prot: Number(x.prot) || 0, carbs: Number(x.carbs) || 0, fat: Number(x.fat) || 0,
  };
}

const vals = (it) => ({
  kcal: round(it.k100 * it.grams / 100), prot: round(it.p100 * it.grams / 100),
  carbs: round(it.c100 * it.grams / 100), fat: round(it.f100 * it.grams / 100),
});

export function AiTextMeal({ apiKey, mealLabel, onAddEntries, onSaveRecipe, onSaveFoods }) {
  const [text, setText] = useState("");
  const [mode, setMode] = useState("repas"); // "repas" | "recette"
  const [items, setItems] = useState(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [servings, setServings] = useState(4);
  const [eaten, setEaten] = useState(1);
  const [recipeName, setRecipeName] = useState("");
  const [rememberFoods, setRememberFoods] = useState(true);
  const [done, setDone] = useState(null);
  const abortRef = useRef(null);

  const total = useMemo(() => (items || []).reduce((a, it) => {
    const v = vals(it); return { kcal: a.kcal + v.kcal, prot: a.prot + v.prot, carbs: a.carbs + v.carbs, fat: a.fat + v.fat, grams: a.grams + it.grams };
  }, { kcal: 0, prot: 0, carbs: 0, fat: 0, grams: 0 }), [items]);

  async function analyze() {
    setBusy(true); setError(null); setStatus(null); setItems(null); setDone(null);
    const ctrl = new AbortController(); abortRef.current = ctrl;
    try {
      const res = await aiEstimateItems(apiKey, text, setStatus, ctrl.signal);
      if (!res.length) throw new Error("aucun aliment reconnu, précise ta description");
      setItems(res);
      if (/^\s*recette/i.test(text)) setMode("recette");
    } catch (e) { if (!e.cancelled) setError(e.message || "erreur"); }
    setBusy(false); setStatus(null);
  }
  const setGrams = (id, g) => setItems(items.map((it) => (it.id === id ? { ...it, grams: Math.max(0, Math.round(g) || 0) } : it)));

  function foodsToRemember() {
    return items.map((it) => ({ name: it.name, kcal: round(it.k100), prot: round(it.p100), carbs: round(it.c100), fat: round(it.f100) }));
  }
  function add() {
    if (!items?.length) return;
    if (mode === "repas") {
      onAddEntries(items.filter((it) => it.grams > 0).map((it) => ({ id: uid(), name: it.name, grams: it.grams, ...vals(it), source: "ia-texte" })));
    } else {
      const f = eaten / Math.max(1, servings);
      const water = items.reduce((a, it) => { const v = vals(it); return a + Math.max(0, it.grams - v.prot - v.carbs - v.fat - it.grams * 0.02); }, 0) * f;
      onAddEntries([{
        id: uid(), name: (recipeName.trim() || "Recette") + ` (${eaten} portion${eaten > 1 ? "s" : ""})`, grams: null,
        kcal: round(total.kcal * f), prot: round(total.prot * f), carbs: round(total.carbs * f), fat: round(total.fat * f),
        water: Math.round(water), source: "ia-texte",
      }]);
    }
    if (rememberFoods) onSaveFoods(foodsToRemember());
    setDone("added");
  }
  function saveRecipe() {
    onSaveRecipe({
      id: uid(), name: recipeName.trim() || "Ma recette IA", categorie: "Ma recette", pasCher: false, servings: Math.max(1, servings),
      ingredients: items.filter((it) => it.grams > 0).map((it) => ({
        foodId: null, name: it.name, kcal100: round(it.k100), prot100: round(it.p100), carbs100: round(it.c100), fat100: round(it.f100), grams: it.grams, brand: true,
      })),
      steps: [],
    });
    if (rememberFoods) onSaveFoods(foodsToRemember());
    setDone(done === "added" ? "both" : "recipe");
  }

  const box = { background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: 14, marginBottom: 12 };
  const small = { fontSize: 11.5, color: C.inkSoft, lineHeight: 1.5, margin: "6px 0 0" };
  const chip = (active) => ({ flex: 1, padding: "8px 6px", borderRadius: 10, border: `1px solid ${active ? C.herb : C.line}`, background: active ? C.herb : C.card, color: active ? C.onAccent : C.ink, fontSize: 12.5, fontWeight: 600 });
  const stepBtn = { width: 32, height: 32, borderRadius: 9, border: "none", background: C.sage, color: C.herb, display: "flex", alignItems: "center", justifyContent: "center" };

  if (!apiKey) {
    return (
      <div style={box}>
        <p style={{ margin: "0 0 6px", fontWeight: 600 }}>Clé Gemini nécessaire</p>
        <p style={{ ...small, marginTop: 0 }}>Cet onglet utilise ta clé Gemini gratuite (Profil → Détection photo par IA). Sans clé, utilise Manuel ou Scanner.</p>
      </div>
    );
  }

  return (
    <div>
      <p style={{ fontSize: 12.5, color: C.inkSoft, margin: "0 0 10px" }}>
        Décris ce que tu as mangé ou liste les ingrédients d'une recette : l'IA estime les quantités et les valeurs, tu vérifies puis tu ajoutes.
      </p>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4}
        placeholder="ex : 2 tortillas de blé, 150 g de poulet, 30 g de cheddar, salade, sauce blanche"
        style={{ width: "100%", padding: "11px 12px", borderRadius: 12, border: `1px solid ${C.line}`, background: C.card, fontSize: 14, resize: "vertical", fontFamily: "'Work Sans',sans-serif" }} />
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "8px 0 12px" }}>
        {EXAMPLES.map((ex) => (
          <button key={ex} onClick={() => setText(ex)} style={{ background: C.paperDark, border: "none", borderRadius: 999, padding: "5px 10px", fontSize: 11, color: C.ink, textAlign: "left" }}>{ex.length > 48 ? ex.slice(0, 46) + "…" : ex}</button>
        ))}
      </div>
      <button onClick={analyze} disabled={busy || text.trim().length < 3} style={{
        width: "100%", padding: "12px 0", borderRadius: 12, border: "none", background: C.herb, color: C.onAccent, fontWeight: 600, fontSize: 14,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: busy || text.trim().length < 3 ? 0.6 : 1,
      }}>
        {busy ? <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Analyse…</> : <><Sparkles size={16} /> Analyser</>}
      </button>
      <style>{"@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}"}</style>
      {busy && (
        <button onClick={() => abortRef.current?.abort()} style={{ width: "100%", marginTop: 6, padding: "8px 0", borderRadius: 10, border: `1px solid ${C.line}`, background: "transparent", color: C.inkSoft, fontSize: 12.5 }}>
          Annuler
        </button>
      )}
      {status && <p style={{ ...small, color: C.ochre }}>{status}</p>}
      {error && <p style={{ ...small, color: C.berry }}>IA : {error}</p>}

      {items && (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            <button onClick={() => setMode("repas")} style={chip(mode === "repas")}>J'ai mangé tout ça</button>
            <button onClick={() => setMode("recette")} style={chip(mode === "recette")}>C'est une recette</button>
          </div>

          <div style={box}>
            <p style={{ margin: "0 0 8px", fontSize: 12, color: C.inkSoft }}>Vérifie et ajuste les quantités (les valeurs suivent) :</p>
            {items.map((it) => {
              const v = vals(it);
              return (
                <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderTop: `1px dashed ${C.line}` }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13.5, fontWeight: 500 }}>{it.name}</p>
                    <p style={{ margin: 0, fontSize: 11, color: C.inkSoft, fontFamily: MONO }}>{Math.round(v.kcal)} kcal · P{v.prot} G{v.carbs} L{v.fat}</p>
                  </div>
                  <NumInput decimals={false} min={0} value={it.grams} onChange={(v) => setGrams(it.id, v)}
                    style={{ width: 66, padding: "6px 6px", borderRadius: 8, border: `1px solid ${C.line}`, fontFamily: MONO, fontSize: 13, textAlign: "right" }} />
                  <span style={{ fontSize: 11, color: C.inkSoft }}>g</span>
                  <button onClick={() => setItems(items.filter((x) => x.id !== it.id))} style={{ background: "none", border: "none", color: C.berry, padding: 4 }}><X size={15} /></button>
                </div>
              );
            })}
            <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 8, marginTop: 4, display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <strong>Total{mode === "recette" ? " de la recette" : ""}</strong>
              <span style={{ fontFamily: MONO }}>{Math.round(total.kcal)} kcal · P{round(total.prot)} G{round(total.carbs)} L{round(total.fat)}</span>
            </div>
          </div>

          {mode === "recette" && (
            <div style={box}>
              <input value={recipeName} onChange={(e) => setRecipeName(e.target.value)} placeholder="Nom de la recette (ex : Bolognaise maison)"
                style={{ width: "100%", padding: "9px 10px", borderRadius: 9, border: `1px solid ${C.line}`, fontSize: 13.5, marginBottom: 10 }} />
              {[["Portions dans la recette", servings, setServings], ["Portions mangées", eaten, setEaten]].map(([l, v, set]) => (
                <div key={l} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ flex: 1, fontSize: 13 }}>{l}</span>
                  <button onClick={() => set(Math.max(l.startsWith("Portions m") ? 0.5 : 1, v - (l.startsWith("Portions m") ? 0.5 : 1)))} style={stepBtn}><Minus size={14} /></button>
                  <span style={{ fontFamily: MONO, fontWeight: 600, minWidth: 30, textAlign: "center" }}>{v}</span>
                  <button onClick={() => set(v + (l.startsWith("Portions m") ? 0.5 : 1))} style={stepBtn}><Plus size={14} /></button>
                </div>
              ))}
              <p style={{ margin: "4px 0 0", fontSize: 13 }}>
                Ta part : <strong style={{ fontFamily: MONO }}>{Math.round(total.kcal * eaten / Math.max(1, servings))} kcal</strong>
                <span style={{ color: C.inkSoft, fontSize: 12 }}> ({Math.round(total.kcal / Math.max(1, servings))} kcal / portion)</span>
              </p>
            </div>
          )}

          <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12.5, color: C.ink, marginBottom: 12, cursor: "pointer" }}>
            <input type="checkbox" checked={rememberFoods} onChange={(e) => setRememberFoods(e.target.checked)} style={{ marginTop: 2 }} />
            <span>Ajouter ces aliments à mes aliments perso<span style={{ display: "block", fontSize: 11, color: C.inkSoft }}>Ils seront trouvés directement dans la recherche Manuel la prochaine fois, sans IA.</span></span>
          </label>

          <button onClick={add} disabled={done === "added" || done === "both"} style={{
            width: "100%", padding: "13px 0", borderRadius: 12, border: "none", background: C.herb, color: C.onAccent, fontWeight: 600, fontSize: 14, marginBottom: 8,
            opacity: done === "added" || done === "both" ? 0.6 : 1,
          }}>{done === "added" || done === "both" ? <><Check size={15} style={{ verticalAlign: -2 }} /> Ajouté ({mealLabel})</> : `Ajouter au journal · ${mealLabel}`}</button>
          {mode === "recette" && (
            <button onClick={saveRecipe} disabled={done === "recipe" || done === "both"} style={{
              width: "100%", padding: "11px 0", borderRadius: 12, border: `1.5px solid ${C.herb}`, background: "transparent", color: C.herb, fontWeight: 600, fontSize: 13,
            }}>{done === "recipe" || done === "both" ? "Recette enregistrée ✓" : "Enregistrer dans mes recettes"}</button>
          )}
          <p style={small}>Estimations de l'IA : vérifie surtout les quantités, c'est là que l'erreur est la plus fréquente.</p>
        </div>
      )}
    </div>
  );
}
