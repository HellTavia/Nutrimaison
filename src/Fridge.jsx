// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Les auteurs de NutriMaison
/* ================================================================== */
/* « Mon frigo » : ce que j'ai sous la main → idées de plats (recettes */
/* intégrées + IA), ce qu'il manque, et liste de courses.              */
/* ================================================================== */
import React, { useState, useRef } from "react";
import { Plus, X, Loader2, Sparkles, Trash2, ShoppingBag, Check } from "lucide-react";
import { C, round, uid, inputStyle } from "./shared.jsx";
import { geminiGenerate, parseJSONLoose } from "./gemini.js";

const MONO = "'IBM Plex Mono',monospace";
const norm = (s) => String(s || "").replace(/œ/gi, "oe").replace(/æ/gi, "ae").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const capital = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Ajoute des articles à la liste de courses (sans doublon). */
export function addToShopping(list, names, from) {
  const have = new Set(list.map((i) => norm(i.name)));
  const add = [];
  names.forEach((n) => {
    const k = norm(n);
    if (k && !have.has(k)) { have.add(k); add.push({ id: uid(), name: capital(String(n).trim()), done: false, ...(from ? { from } : {}) }); }
  });
  return { next: [...list, ...add], added: add.length };
}

/* ------------------------------------------------------------------ */
/* Saisie du frigo : aliments courants + « autre chose » en texte libre */
/* ------------------------------------------------------------------ */
export function FridgeInput({ items, pantry, setPantry, extras, setExtras }) {
  const [txt, setTxt] = useState("");
  const toggle = (id) => { const n = new Set(pantry); n.has(id) ? n.delete(id) : n.add(id); setPantry(n); };
  function addExtras() {
    const parts = txt.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
    if (!parts.length) return;
    const known = new Set(extras.map(norm));
    setExtras([...extras, ...parts.filter((p) => !known.has(norm(p)))]);
    setTxt("");
  }
  const n = pantry.size + extras.length;
  return (
    <div style={{ marginBottom: 14 }}>
      <p style={{ fontSize: 12.5, color: C.inkSoft, margin: "0 0 8px" }}>Touche ce que tu as dans ton frigo et tes placards :</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
        {items.map(({ id, name }) => (
          <button key={id} onClick={() => toggle(id)} style={{
            padding: "6px 11px", borderRadius: 999, fontSize: 12, fontWeight: 500,
            border: `1px solid ${pantry.has(id) ? C.olive : C.line}`,
            background: pantry.has(id) ? C.oliveLight : C.card, color: pantry.has(id) ? C.olive : C.inkSoft,
          }}>{name}</button>
        ))}
        {extras.map((e) => (
          <span key={e} style={{
            padding: "6px 6px 6px 11px", borderRadius: 999, fontSize: 12, fontWeight: 500, border: `1px solid ${C.olive}`,
            background: C.oliveLight, color: C.olive, display: "inline-flex", alignItems: "center", gap: 4,
          }}>{e}
            <button onClick={() => setExtras(extras.filter((x) => x !== e))} aria-label={`Retirer ${e}`} style={{ background: "none", border: "none", color: C.olive, padding: 0, display: "flex" }}><X size={13} /></button>
          </span>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <input value={txt} onChange={(e) => setTxt(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addExtras()}
          placeholder="Autre chose ? ex : feta, épinards, restes de rôti"
          style={{ ...inputStyle, flex: 1, fontSize: 13, padding: "9px 10px" }} />
        <button onClick={addExtras} disabled={!txt.trim()} aria-label="Ajouter au frigo" style={{
          background: C.herb, color: "#fff", border: "none", borderRadius: 10, width: 40, display: "flex", alignItems: "center", justifyContent: "center", opacity: txt.trim() ? 1 : 0.5,
        }}><Plus size={17} /></button>
      </div>
      {n > 0 && (
        <button onClick={() => { setPantry(new Set()); setExtras([]); }} style={{ background: "none", border: "none", color: C.inkSoft, fontSize: 11.5, padding: "6px 0 0", textDecoration: "underline" }}>
          Vider mon frigo ({n})
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Idées de plats par l'IA                                             */
/* ------------------------------------------------------------------ */
async function aiFridgeIdeas(apiKey, have, ctx, onStatus, signal) {
  const goal = ctx.objectif === "perte" ? "perdre du poids (plats rassasiants, riches en protéines, modérés en calories)"
    : ctx.objectif === "prise" ? "prendre de la masse (plats riches en protéines et en énergie)" : "garder son poids (plats équilibrés)";
  const prompt = `Tu es un cuisinier et diététicien français. Voici ce que j'ai chez moi : ${have.join(", ")}.
Je considère que j'ai aussi : sel, poivre, eau, huile, épices courantes.
Mon objectif : ${goal}.${ctx.kcalLeft > 0 ? ` Il me reste environ ${Math.round(ctx.kcalLeft)} kcal pour aujourd'hui.` : ""}
Propose 4 plats simples (cuisine familiale, moins de 45 min) : d'abord ceux qui n'utilisent QUE ce que j'ai, puis ceux où il manque au plus 3 ingrédients faciles à acheter.
Chaque plat doit être construit AUTOUR de mes ingrédients (ils en sont la base, pas un simple assaisonnement ou une décoration) et utiliser au moins 2 d'entre eux quand c'est possible. Des associations logiques et appétissantes : n'utilise pas un ingrédient s'il ne va pas avec le plat.
Quantités en grammes POUR TOUTES les portions. Pour chaque ingrédient, valeurs pour 100 g (crues, table Ciqual si possible) et "dispo": true si je l'ai, false s'il faut l'acheter.
Réponds UNIQUEMENT en JSON :
{"plats":[{"nom":"...","portions":2,"minutes":20,"ingredients":[{"nom":"...","grammes":0,"kcal100":0,"prot100":0,"gluc100":0,"lip100":0,"dispo":true}],"etapes":["..."]}]}`;
  const text = await geminiGenerate(apiKey, [{ text: prompt }], { onStatus, temperature: 0.6, signal });
  const r = parseJSONLoose(text) || {};
  const list = Array.isArray(r) ? r : r.plats || r.dishes || [];
  const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  return list.map((p) => {
    const ings = (p.ingredients || []).map((i) => ({
      name: capital(String(i.nom || i.name || "").trim()), grams: Math.max(0, Math.round(num(i.grammes ?? i.grams))),
      kcal100: num(i.kcal100), prot100: num(i.prot100), carbs100: num(i.gluc100 ?? i.carbs100), fat100: num(i.lip100 ?? i.fat100),
      have: i.dispo !== false,
    })).filter((i) => i.name);
    const servings = Math.max(1, Math.round(num(p.portions) || 2));
    const tot = ings.reduce((a, i) => ({
      kcal: a.kcal + i.kcal100 * i.grams / 100, prot: a.prot + i.prot100 * i.grams / 100,
      carbs: a.carbs + i.carbs100 * i.grams / 100, fat: a.fat + i.fat100 * i.grams / 100,
    }), { kcal: 0, prot: 0, carbs: 0, fat: 0 });
    return {
      id: uid(), name: String(p.nom || p.name || "Plat").trim(), servings, minutes: num(p.minutes) || null,
      ingredients: ings, steps: (p.etapes || p.steps || []).map(String),
      per: { kcal: tot.kcal / servings, prot: tot.prot / servings, carbs: tot.carbs / servings, fat: tot.fat / servings },
      missing: ings.filter((i) => !i.have).map((i) => i.name),
    };
  }).filter((p) => p.ingredients.length)
    .sort((a, b) => a.missing.length - b.missing.length);
}

export function FridgeAi({ geminiKey, have, ctx, onAddShopping, onSaveRecipe }) {
  const [state, setState] = useState(null); // {busy,status} | {error} | {ideas}
  const [saved, setSaved] = useState({});
  const [shopped, setShopped] = useState({});
  const abort = useRef(null);
  if (!geminiKey) {
    return <p style={{ fontSize: 11.5, color: C.inkSoft, margin: "0 0 14px" }}>Astuce : avec une clé Gemini (Profil), l'IA peut aussi inventer des plats avec ce que tu as et te dire quoi acheter.</p>;
  }
  async function run() {
    abort.current?.abort();
    const ctl = new AbortController(); abort.current = ctl;
    setState({ busy: true }); setSaved({}); setShopped({});
    try {
      const ideas = await aiFridgeIdeas(geminiKey, have, ctx, (t) => setState({ busy: true, status: t }), ctl.signal);
      setState(ideas.length ? { ideas } : { error: "aucune idée reçue, réessaie" });
    } catch (e) {
      if (ctl.signal.aborted) setState(null); else setState({ error: e.message || "erreur" });
    }
  }
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={run} disabled={!have.length || state?.busy} style={{
          flex: 1, padding: "11px 10px", borderRadius: 12, border: `1.5px solid ${C.ochre}`, background: C.ochreLight, color: C.ink,
          fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, opacity: have.length ? 1 : 0.5,
        }}>
          {state?.busy ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> : <Sparkles size={15} />}
          {state?.busy ? (state.status || "L'IA cuisine…") : state?.ideas ? "Autres idées avec l'IA" : "Idées de plats avec l'IA"}
        </button>
        {state?.busy && <button onClick={() => abort.current?.abort()} style={{ padding: "0 12px", borderRadius: 12, border: `1px solid ${C.line}`, background: C.card, fontSize: 12.5 }}>Annuler</button>}
      </div>
      {!have.length && <p style={{ fontSize: 11.5, color: C.inkSoft, margin: "6px 0 0" }}>Choisis d'abord quelques aliments ci-dessus.</p>}
      {state?.error && <p style={{ fontSize: 12, color: C.berry, margin: "6px 0 0" }}>IA : {state.error}</p>}
      {state?.ideas && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
          {state.ideas.map((p) => (
            <div key={p.id} style={{ background: C.card, border: `1px solid ${p.missing.length ? C.line : C.olive}`, borderRadius: 14, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <p style={{ margin: 0, fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: 15 }}>{p.name}</p>
                <span style={{ fontFamily: MONO, fontSize: 11.5, color: C.inkSoft, flexShrink: 0 }}>{Math.round(p.per.kcal)} kcal/portion</span>
              </div>
              <p style={{ margin: "2px 0 6px", fontSize: 11.5, color: C.inkSoft, fontFamily: MONO }}>
                P{Math.round(p.per.prot)} G{Math.round(p.per.carbs)} L{Math.round(p.per.fat)} · {p.servings} portion{p.servings > 1 ? "s" : ""}{p.minutes ? ` · ${p.minutes} min` : ""}
              </p>
              <p style={{ margin: "0 0 4px", fontSize: 12.5 }}>
                <span style={{ color: C.olive, fontWeight: 600 }}>✓ Tu as : </span>{p.ingredients.filter((i) => i.have).map((i) => i.name).join(", ") || "—"}
              </p>
              {p.missing.length > 0
                ? <p style={{ margin: "0 0 8px", fontSize: 12.5 }}><span style={{ color: C.berry, fontWeight: 600 }}>À acheter : </span>{p.missing.join(", ")}</p>
                : <p style={{ margin: "0 0 8px", fontSize: 12.5, color: C.olive, fontWeight: 600 }}>Rien à acheter 👌</p>}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {p.missing.length > 0 && (
                  <button disabled={shopped[p.id]} onClick={() => { onAddShopping(p.missing, p.name); setShopped((s) => ({ ...s, [p.id]: true })); }} style={{
                    padding: "7px 10px", borderRadius: 9, border: `1px solid ${C.herb}`, background: shopped[p.id] ? C.sage : C.card, color: C.herb, fontSize: 12, fontWeight: 600,
                    display: "flex", alignItems: "center", gap: 5,
                  }}>{shopped[p.id] ? <><Check size={13} /> Dans la liste</> : <><ShoppingBag size={13} /> + Liste de courses</>}</button>
                )}
                <button disabled={saved[p.id]} onClick={() => {
                  onSaveRecipe({
                    id: uid(), name: p.name, categorie: "Idée du frigo (IA)", pasCher: false, servings: p.servings,
                    ingredients: p.ingredients.map((i) => ({ foodId: null, name: i.name, grams: i.grams, kcal100: round(i.kcal100), prot100: round(i.prot100), carbs100: round(i.carbs100), fat100: round(i.fat100), brand: true })),
                    steps: p.steps,
                  });
                  setSaved((s) => ({ ...s, [p.id]: true }));
                }} style={{
                  padding: "7px 10px", borderRadius: 9, border: "none", background: saved[p.id] ? C.sage : C.herb, color: saved[p.id] ? C.herb : "#fff", fontSize: 12, fontWeight: 600,
                }}>{saved[p.id] ? "✓ Dans Mes recettes" : "Enregistrer la recette"}</button>
              </div>
              {p.steps.length > 0 && (
                <details style={{ marginTop: 8 }}>
                  <summary style={{ fontSize: 12, color: C.herb, fontWeight: 600, cursor: "pointer" }}>Voir la recette</summary>
                  <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 12.5, lineHeight: 1.5 }}>
                    {p.ingredients.map((i) => <li key={i.name}>{i.name} : {i.grams} g{i.have ? "" : " (à acheter)"}</li>)}
                  </ul>
                  <ol style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 12.5, lineHeight: 1.5 }}>
                    {p.steps.map((s, k) => <li key={k}>{s}</li>)}
                  </ol>
                </details>
              )}
            </div>
          ))}
          <p style={{ fontSize: 10.5, color: C.inkSoft, margin: 0 }}>Valeurs estimées par l'IA : vérifie-les si besoin dans la recette enregistrée.</p>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Liste de courses                                                    */
/* ------------------------------------------------------------------ */
export function ShoppingList({ list, setList }) {
  const [txt, setTxt] = useState("");
  const [msg, setMsg] = useState(null);
  const todo = list.filter((i) => !i.done);
  const done = list.filter((i) => i.done);
  function add() {
    const parts = txt.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
    if (!parts.length) return;
    setList(addToShopping(list, parts).next); setTxt("");
  }
  async function share() {
    const text = "Liste de courses :\n" + todo.map((i) => "• " + i.name).join("\n");
    try {
      if (navigator.share) { await navigator.share({ title: "Liste de courses", text }); return; }
    } catch (e) { if (e?.name === "AbortError") return; }
    try { await navigator.clipboard.writeText(text); setMsg("Liste copiée ✓"); } catch (e) { setMsg("Copie impossible"); }
    setTimeout(() => setMsg(null), 1800);
  }
  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: 14, marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
        <p style={{ margin: 0, fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: 15.5, display: "flex", alignItems: "center", gap: 7 }}>
          <ShoppingBag size={16} color={C.herb} /> Liste de courses {todo.length > 0 && <span style={{ fontFamily: MONO, fontSize: 12, color: C.inkSoft }}>({todo.length})</span>}
        </p>
        {todo.length > 0 && <button onClick={share} style={{ background: C.sage, border: "none", borderRadius: 999, padding: "5px 11px", color: C.herb, fontSize: 12, fontWeight: 600 }}>Partager</button>}
      </div>
      {msg && <p style={{ fontSize: 12, color: C.herb, margin: "0 0 6px" }}>{msg}</p>}
      {list.length === 0 && <p style={{ fontSize: 12, color: C.inkSoft, fontStyle: "italic", margin: "0 0 8px" }}>Vide. Les ingrédients manquants des recettes s'ajoutent d'un appui.</p>}
      {[...todo, ...done].map((i) => (
        <div key={i.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderTop: `1px solid ${C.line}` }}>
          <input type="checkbox" checked={i.done} onChange={() => setList(list.map((x) => (x.id === i.id ? { ...x, done: !x.done } : x)))}
            aria-label={`Acheté : ${i.name}`} style={{ width: 18, height: 18, accentColor: C.herb }} />
          <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, textDecoration: i.done ? "line-through" : "none", color: i.done ? C.inkSoft : C.ink }}>
            {i.name}{i.from && <span style={{ display: "block", fontSize: 10.5, color: C.inkSoft, textDecoration: "none" }}>pour {i.from}</span>}
          </span>
          <button onClick={() => setList(list.filter((x) => x.id !== i.id))} aria-label={`Retirer ${i.name}`} style={{ background: "none", border: "none", color: C.inkSoft, padding: 4 }}><X size={14} /></button>
        </div>
      ))}
      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        <input value={txt} onChange={(e) => setTxt(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="Ajouter un article"
          style={{ ...inputStyle, flex: 1, fontSize: 13, padding: "8px 10px" }} />
        <button onClick={add} disabled={!txt.trim()} aria-label="Ajouter à la liste" style={{ background: C.herb, color: "#fff", border: "none", borderRadius: 10, width: 38, display: "flex", alignItems: "center", justifyContent: "center", opacity: txt.trim() ? 1 : 0.5 }}><Plus size={16} /></button>
      </div>
      {done.length > 0 && (
        <button onClick={() => setList(todo)} style={{ background: "none", border: "none", color: C.inkSoft, fontSize: 11.5, padding: "8px 0 0", display: "flex", alignItems: "center", gap: 4 }}>
          <Trash2 size={12} /> Retirer les {done.length} article{done.length > 1 ? "s" : ""} acheté{done.length > 1 ? "s" : ""}
        </button>
      )}
    </div>
  );
}
