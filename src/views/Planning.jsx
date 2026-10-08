// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Les auteurs de NutriMaison
/* Planning de la semaine : recettes et repas types placés sur les jours, courses de la semaine. */
import React, { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Plus, X, Search, Check, ShoppingBag } from "lucide-react";
import { C, addDays, todayISO, weekStart, frShort, inputStyle } from "../shared.jsx";
import { Sheet } from "../MealTools.jsx";
import { MEAL_LABELS, MEAL_ORDER, norm, recipeTotals } from "../foodData.js";
import { planItemFromRecipe, planItemFromTemplate, dayPlannedKcal, shoppingFromPlan } from "../planning.js";

const MONO = "'IBM Plex Mono',monospace";
const DOW = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const chip = (active) => ({
  padding: "6px 11px", borderRadius: 999, fontSize: 12, fontWeight: 600, border: `1px solid ${active ? C.herb : C.line}`,
  background: active ? C.herb : C.card, color: active ? C.onAccent : C.ink, whiteSpace: "nowrap",
});
const fmtS = (s) => String(s).replace(".", ",");

function Servings({ value, onChange }) {
  const b = { width: 30, height: 30, borderRadius: 999, border: `1px solid ${C.line}`, background: C.card, color: C.ink, fontSize: 16, lineHeight: 1 };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ fontSize: 12.5, color: C.inkSoft }}>Portions</span>
      <button onClick={() => onChange(Math.max(0.5, value - 0.5))} style={b} aria-label="Moins">−</button>
      <span style={{ fontFamily: MONO, fontWeight: 600, minWidth: 28, textAlign: "center" }}>{fmtS(value)}</span>
      <button onClick={() => onChange(value + 0.5)} style={b} aria-label="Plus">+</button>
    </div>
  );
}

/** Choix d'une recette ou d'un repas type pour un jour. */
function PlanPicker({ date, recipes, templates, onPick, onClose }) {
  const [meal, setMeal] = useState("dejeuner");
  const [servings, setServings] = useState(1);
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const t = norm(q).trim();
    return recipes.filter((r) => !r.noNutrition && (!t || norm(r.name).includes(t))).slice(0, 40);
  }, [recipes, q]);
  const tpls = (templates || []).filter((t) => !q || norm(t.name).includes(norm(q)));
  return (
    <Sheet title={`Planifier · ${frShort(date)}`} onClose={onClose}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
        {MEAL_ORDER.map((m) => <button key={m} onClick={() => setMeal(m)} style={chip(meal === m)}>{MEAL_LABELS[m]}</button>)}
      </div>
      <Servings value={servings} onChange={setServings} />
      <div style={{ position: "relative", margin: "12px 0 10px" }}>
        <Search size={15} color={C.inkSoft} style={{ position: "absolute", left: 10, top: 11 }} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher une recette" style={{ ...inputStyle, paddingLeft: 32, fontFamily: "'Work Sans',sans-serif" }} />
      </div>
      {tpls.length > 0 && (
        <>
          <p style={{ fontSize: 11.5, fontWeight: 600, color: C.inkSoft, textTransform: "uppercase", letterSpacing: 0.4, margin: "0 0 6px" }}>Mes repas types</p>
          {tpls.map((t) => (
            <button key={t.id} onClick={() => onPick(meal, planItemFromTemplate(t))} style={{ width: "100%", textAlign: "left", background: C.sage, border: "none", borderRadius: 12, padding: "9px 12px", marginBottom: 6, color: C.ink }}>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: C.herb }}>★ {t.name}</span>
              <span style={{ fontFamily: MONO, fontSize: 11, color: C.inkSoft }}> · {Math.round(t.items.reduce((a, e) => a + (e.kcal || 0), 0))} kcal</span>
            </button>
          ))}
        </>
      )}
      <p style={{ fontSize: 11.5, fontWeight: 600, color: C.inkSoft, textTransform: "uppercase", letterSpacing: 0.4, margin: "8px 0 6px" }}>Recettes</p>
      {list.map((r) => {
        const per = recipeTotals(r).kcal / (r.servings || 1);
        return (
          <button key={r.id} onClick={() => onPick(meal, planItemFromRecipe(r, servings))} style={{
            width: "100%", textAlign: "left", background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: "9px 12px", marginBottom: 6,
            display: "flex", justifyContent: "space-between", gap: 8, color: C.ink,
          }}>
            <span style={{ fontSize: 13.5 }}>{r.name}</span>
            <span style={{ fontFamily: MONO, fontSize: 11, color: C.inkSoft, flexShrink: 0 }}>{Math.round(per * servings)} kcal</span>
          </button>
        );
      })}
      {list.length === 0 && <p style={{ fontSize: 12.5, color: C.inkSoft, fontStyle: "italic" }}>Aucune recette.</p>}
    </Sheet>
  );
}

/** Depuis le détail d'une recette : choisir le jour et le repas. */
export function PlanRecipeSheet({ recipe, servings: s0, onPlan, onClose }) {
  const today = todayISO();
  const [date, setDate] = useState(today);
  const [meal, setMeal] = useState("dejeuner");
  const [servings, setServings] = useState(s0 || 1);
  const days = Array.from({ length: 8 }, (_, i) => addDays(today, i));
  return (
    <Sheet title={`Planifier « ${recipe.name} »`} onClose={onClose}>
      <p style={{ fontSize: 12, color: C.inkSoft, margin: "0 0 6px" }}>Jour</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
        {days.map((d, i) => (
          <button key={d} onClick={() => setDate(d)} style={chip(date === d)}>
            {i === 0 ? "Aujourd'hui" : i === 1 ? "Demain" : `${DOW[(new Date(d + "T12:00").getDay() + 6) % 7]} ${Number(d.slice(8))}`}
          </button>
        ))}
      </div>
      <p style={{ fontSize: 12, color: C.inkSoft, margin: "0 0 6px" }}>Repas</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
        {MEAL_ORDER.map((m) => <button key={m} onClick={() => setMeal(m)} style={chip(meal === m)}>{MEAL_LABELS[m]}</button>)}
      </div>
      <Servings value={servings} onChange={setServings} />
      <button onClick={() => { onPlan(date, meal, planItemFromRecipe(recipe, servings)); onClose(); }} style={{
        width: "100%", marginTop: 14, padding: "12px 0", borderRadius: 12, border: "none", background: C.herb, color: C.onAccent, fontWeight: 600, fontSize: 14,
      }}>Ajouter au planning</button>
    </Sheet>
  );
}

export function PlanningView({ plan, onChangePlan, recipes, templates, goalKcal, haveNames, onAddShopping, onLog }) {
  const today = todayISO();
  const [ws, setWs] = useState(() => weekStart(today));
  const [picker, setPicker] = useState(null);
  const [msg, setMsg] = useState(null);
  const dates = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  const flash = (t) => { setMsg(t); setTimeout(() => setMsg(null), 2200); };

  function add(date, meal, item) {
    const day = plan[date] || {};
    onChangePlan({ ...plan, [date]: { ...day, [meal]: [...(day[meal] || []), item] } });
  }
  function remove(date, meal, id) {
    const day = plan[date] || {};
    onChangePlan({ ...plan, [date]: { ...day, [meal]: (day[meal] || []).filter((i) => i.id !== id) } });
  }
  function shopping() {
    const from = dates.filter((d) => d >= today);
    const items = shoppingFromPlan(plan, from, haveNames);
    if (!items.length) { flash("Rien à acheter (ou tout est déjà dans ton frigo)."); return; }
    const n = onAddShopping(items.map((i) => i.label), "planning de la semaine");
    flash(`${n} article${n > 1 ? "s" : ""} ajouté${n > 1 ? "s" : ""} à la liste de courses ✓`);
  }
  function copyPrevWeek() {
    const next = { ...plan };
    dates.forEach((d) => {
      const src = plan[addDays(d, -7)];
      if (!src) return;
      const day = { ...(next[d] || {}) };
      MEAL_ORDER.forEach((m) => { if ((src[m] || []).length) day[m] = [...(day[m] || []), ...src[m].map((i) => ({ ...i, id: Math.random().toString(36).slice(2, 10), done: false }))]; });
      next[d] = day;
    });
    onChangePlan(next); flash("Semaine précédente recopiée ✓");
  }
  const weekHas = dates.some((d) => dayPlannedKcal(plan, d) > 0);
  const prevHas = dates.some((d) => dayPlannedKcal(plan, addDays(d, -7)) > 0);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <button onClick={() => setWs(addDays(ws, -7))} aria-label="Semaine précédente" style={{ background: "none", border: "none", color: C.herb, padding: 6 }}><ChevronLeft size={20} /></button>
        <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>Semaine du {frShort(ws)}</p>
        <button onClick={() => setWs(addDays(ws, 7))} aria-label="Semaine suivante" style={{ background: "none", border: "none", color: C.herb, padding: 6 }}><ChevronRight size={20} /></button>
      </div>
      {msg && <p style={{ position: "sticky", top: 8, zIndex: 2, background: C.herb, color: C.onAccent, borderRadius: 10, padding: "8px 12px", fontSize: 12.5, margin: "0 0 10px", textAlign: "center" }}>{msg}</p>}

      {dates.map((d, i) => {
        const day = plan[d] || {};
        const k = dayPlannedKcal(plan, d);
        const past = d < today;
        return (
          <div key={d} style={{ background: C.card, border: `1px solid ${d === today ? C.herb : C.line}`, borderRadius: 14, padding: "10px 12px", marginBottom: 8, opacity: past ? 0.7 : 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <p style={{ margin: 0, flex: 1, fontWeight: 600, fontSize: 14 }}>
                {DOW[i]} {Number(d.slice(8))}{d === today && <span style={{ color: C.herb, fontSize: 12 }}> · aujourd'hui</span>}
              </p>
              {k > 0 && (
                <span style={{ fontFamily: MONO, fontSize: 11.5, color: goalKcal && k > goalKcal * 1.05 ? C.berry : C.inkSoft }}>
                  {k} kcal{goalKcal ? ` / ${goalKcal}` : ""}
                </span>
              )}
              <button onClick={() => setPicker(d)} aria-label={`Planifier le ${d}`} style={{
                background: C.sage, border: "none", borderRadius: 999, width: 28, height: 28, color: C.herb, display: "flex", alignItems: "center", justifyContent: "center",
              }}><Plus size={15} /></button>
            </div>
            {MEAL_ORDER.filter((m) => (day[m] || []).length).map((m) => (
              <div key={m} style={{ marginTop: 6 }}>
                <p style={{ margin: "0 0 2px", fontSize: 11, color: C.inkSoft, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.3 }}>{MEAL_LABELS[m]}</p>
                {day[m].map((it) => (
                  <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 0" }}>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 13, textDecoration: it.done ? "line-through" : "none", color: it.done ? C.inkSoft : C.ink }}>
                      {it.kind === "template" ? "★ " : ""}{it.name}{it.kind === "recipe" && it.servings !== 1 ? ` ×${fmtS(it.servings)}` : ""}
                      <span style={{ fontFamily: MONO, fontSize: 11, color: C.inkSoft }}> · {Math.round(it.kcal)} kcal</span>
                    </span>
                    {it.done ? <Check size={15} color={C.herb} /> : (
                      <button onClick={() => { onLog(d, m, it); flash(`${it.name} noté dans le journal ✓`); }} style={{
                        padding: "4px 9px", borderRadius: 999, border: `1px solid ${C.herb}`, background: C.card, color: C.herb, fontSize: 11.5, fontWeight: 600,
                      }}>Noter</button>
                    )}
                    <button onClick={() => remove(d, m, it.id)} aria-label={`Retirer ${it.name}`} style={{ background: "none", border: "none", color: C.inkSoft, padding: 3 }}><X size={14} /></button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        );
      })}

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
        <button onClick={shopping} disabled={!weekHas} style={{
          padding: "12px 0", borderRadius: 12, border: "none", background: C.herb, color: C.onAccent, fontWeight: 600, fontSize: 13.5, opacity: weekHas ? 1 : 0.5,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
        }}><ShoppingBag size={15} /> Courses pour la semaine</button>
        {prevHas && (
          <button onClick={copyPrevWeek} style={{ padding: "10px 0", borderRadius: 12, border: `1px solid ${C.line}`, background: C.card, color: C.ink, fontSize: 13 }}>
            Recopier la semaine précédente
          </button>
        )}
      </div>
      <p style={{ fontSize: 11, color: C.inkSoft, margin: "8px 0 0", lineHeight: 1.5 }}>
        Les courses additionnent les ingrédients des plats pas encore notés (à partir d'aujourd'hui), sans ce qui est dans « Mon frigo » ni le sel, l'huile, les épices… Le jour venu, « Noter » ajoute le plat au journal ; il apparaît aussi directement dans le repas sur l'accueil.
      </p>

      {picker && <PlanPicker date={picker} recipes={recipes} templates={templates} onClose={() => setPicker(null)}
        onPick={(meal, item) => { add(picker, meal, item); setPicker(null); flash(`${item.name} planifié ✓`); }} />}
    </div>
  );
}
