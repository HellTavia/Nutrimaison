// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Les auteurs de NutriMaison
/* Écran « Aujourd'hui » : anneau, eau, activité, repas, édition d'un aliment */
import React, { useState } from "react";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Droplet, Flame, Footprints, Minus, MoreHorizontal, Pencil, Plus, Scale, Trash2 } from "lucide-react";
import { MealActions } from "../MealTools.jsx";
import { CalendarSheet } from "../Calendar.jsx";
import { openExternal } from "../updates.js";
import { C, MONO, Ring, addDays, frDate, frShort, inputStyle, loadJSON, round, saveJSON, todayISO } from "../shared.jsx";
import { originLabel } from "../healthconnect.js";
import { MEAL_LABELS, MEAL_ORDER, dayFoodWaterMl, norm } from "../foodData.js";
import { APP_VERSION } from "../version.js";

/* ---------------------------------------------------------------- */
/* PETITS COMPOSANTS UI                                              */
/* ---------------------------------------------------------------- */
export function MacroBar({ label, value, goal, color, bg }) {
  const pct = goal > 0 ? Math.min(100, (value / goal) * 100) : 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontFamily: "'Work Sans',sans-serif", fontSize: 13, color: C.inkSoft }}>{label}</span>
        <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, color: C.ink }}>
          {round(value)}g <span style={{ color: C.inkSoft }}>/ {goal}g</span>
        </span>
      </div>
      <div style={{ height: 8, borderRadius: 999, background: bg, overflow: "hidden" }}>
        <div style={{ width: pct + "%", height: "100%", background: color, borderRadius: 999, transition: "width 0.4s ease" }} />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* APP                                                                */
/* ---------------------------------------------------------------- */


/* ---------------------------------------------------------------- */
/* DASHBOARD                                                         */
/* ---------------------------------------------------------------- */
export function Dashboard({ currentDate, setCurrentDate, dayData, totals, goals, onOpenAdd, onDeleteEntry, onChangeWater, onEditEntry,
  yesterday, onCopyMeal, favorites, onToggleFavorite,
  allDays, weights, update, onDismissUpdate, mealTemplates, planned, onLogPlanned, onCopyIn, onCopyTo, onSaveTemplate, onDeleteTemplate, onAddTemplate, onClearMeal, onScaleMeal,
  activity, sportSettings, onSetSteps, weightStats, bodyFat, onOpenSport, onOpenBody, onOpenBilan }) {
  const isToday = currentDate === todayISO();
  const [editing, setEditing] = useState(null); // "meal:id"
  const [mealMenu, setMealMenu] = useState(null);
  const [calOpen, setCalOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => loadJSON("collapsedMeals", {}));
  const toggleCollapsed = (m) => { const n = { ...collapsed, [m]: !collapsed[m] }; setCollapsed(n); saveJSON("collapsedMeals", n); };
  const [waterOpen, setWaterOpen] = useState(false);
  const [waterQuick, setWaterQuick] = useState(() => loadJSON("waterQuick", 250));
  const budget = goals.kcal + (activity?.bonus || 0);
  const foodWater = Math.round(dayFoodWaterMl(dayData) / 10) * 10;
  const left = Math.round(budget - totals.kcal);
  return (
    <div style={{ padding: "28px 20px 8px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
        <button onClick={() => setCurrentDate(addDays(currentDate, -1))} style={{ background: "none", border: "none", padding: 8, color: C.herb }}>
          <ChevronLeft size={20} />
        </button>
        <button onClick={() => setCalOpen(true)} aria-label="Ouvrir le calendrier" style={{ textAlign: "center", background: "none", border: "none", padding: "2px 8px", color: C.ink }}>
          <p style={{ margin: 0, fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: 17, color: C.ink, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
            {isToday ? "Aujourd'hui" : frDate(currentDate)} <ChevronDown size={15} color={C.inkSoft} />
          </p>
          {isToday ? <p style={{ margin: 0, fontSize: 12, color: C.inkSoft }}>{frDate(currentDate)}</p>
            : <p style={{ margin: 0, fontSize: 11.5, color: C.herb, fontWeight: 600 }}>Calendrier · revenir à aujourd'hui</p>}
        </button>
        <button onClick={() => setCurrentDate(addDays(currentDate, 1))} style={{ background: "none", border: "none", padding: 8, color: C.herb }}>
          <ChevronRight size={20} />
        </button>
      </div>

      {update && (
        <div style={{ background: C.ochreLight, border: `1.5px solid ${C.ochre}`, borderRadius: 14, padding: "10px 12px", margin: "-8px 0 16px" }}>
          <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600 }}>🎉 NutriMaison {update.version} est disponible</p>
          <p style={{ margin: "2px 0 8px", fontSize: 11.5, color: C.inkSoft }}>Tu as la {APP_VERSION}. Installe la nouvelle par-dessus : tes données sont conservées.</p>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => openExternal(update.apkUrl || update.url)} style={{ flex: 2, padding: "9px 0", borderRadius: 10, border: "none", background: C.herb, color: C.onAccent, fontWeight: 600, fontSize: 12.5 }}>
              {update.apkUrl ? "Télécharger l'APK" : "Voir la version"}
            </button>
            <button onClick={onDismissUpdate} style={{ flex: 1, padding: "9px 0", borderRadius: 10, border: `1px solid ${C.line}`, background: C.card, color: C.inkSoft, fontSize: 12.5 }}>Plus tard</button>
          </div>
        </div>
      )}

      {/* Anneau calories */}
      <div style={{
        background: C.card, borderRadius: 20, padding: "22px 20px", border: `1px solid ${C.line}`,
        display: "flex", alignItems: "center", gap: 20, marginBottom: 16,
      }}>
        <div style={{ position: "relative", flexShrink: 0 }}>
          <Ring value={totals.kcal} goal={budget} color={totals.kcal > budget ? C.berry : C.herb} />
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontWeight: 600, fontSize: 24, color: C.ink }}>{Math.round(totals.kcal)}</span>
            <span style={{ fontSize: 11, color: C.inkSoft }}>/ {budget} kcal</span>
            <span style={{ fontSize: 10.5, color: left < 0 ? C.berry : C.herbLight, fontWeight: 600, marginTop: 2 }}>
              {left >= 0 ? `reste ${left}` : `+${-left} au-delà`}
            </span>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <MacroBar label="Protéines" value={totals.prot} goal={goals.prot} color={C.berry} bg={C.berryLight} />
          <MacroBar label="Glucides" value={totals.carbs} goal={goals.carbs} color={C.ochre} bg={C.ochreLight} />
          <MacroBar label="Lipides" value={totals.fat} goal={goals.fat} color={C.olive} bg={C.oliveLight} />
        </div>
      </div>

      {/* Eau */}
      <div style={{
        background: C.hero, borderRadius: 20, padding: "16px 20px", marginBottom: 16,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Droplet size={22} color="#BEEAD4" fill="#BEEAD4" />
          <div>
            <p style={{ margin: 0, fontFamily: "'IBM Plex Mono',monospace", color: C.onHero, fontSize: 16, fontWeight: 600 }}>
              {(dayData.water + (goals.foodWater !== false ? foodWater : 0)).toLocaleString("fr-FR")} <span style={{ color: "#BFD3C6", fontWeight: 500, fontSize: 12 }}>/ {goals.water.toLocaleString("fr-FR")} ml</span>
            </p>
            <p style={{ margin: 0, color: "#BFD3C6", fontSize: 11 }}>
              {goals.foodWater !== false
                ? <>Bu {dayData.water.toLocaleString("fr-FR")} + aliments ~{foodWater.toLocaleString("fr-FR")} ml</>
                : "Hydratation du jour (eau bue)"}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => onChangeWater(-waterQuick)} aria-label={`Retirer ${waterQuick} ml`} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 999, width: 30, height: 30, color: C.onHero, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Minus size={14} />
          </button>
          <button onClick={() => onChangeWater(waterQuick)} style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: 999, padding: "0 12px", color: C.onHero, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>
            +{waterQuick} ml
          </button>
          <button onClick={() => setWaterOpen(!waterOpen)} aria-label="Choisir une quantité" style={{ background: C.onHero, border: "none", borderRadius: 999, width: 30, height: 30, color: C.hero, display: "flex", alignItems: "center", justifyContent: "center", transform: waterOpen ? "rotate(45deg)" : "none", transition: "transform .2s" }}>
            <Plus size={14} />
          </button>
        </div>
      </div>
      {waterOpen && (
        <WaterPicker quick={waterQuick}
          onPick={(ml, keepOpen) => { onChangeWater(ml); if (ml > 0) { setWaterQuick(ml); saveJSON("waterQuick", ml); } if (!keepOpen) setWaterOpen(false); }} />
      )}

      {/* Activité du jour */}
      <ActivityCard activity={activity} sportSettings={sportSettings} onSetSteps={onSetSteps} onOpenSport={onOpenSport} goals={goals} />

      {/* Poids / corps */}
      <div onClick={() => onOpenBody("poids")} style={{
        background: C.card, borderRadius: 20, padding: "14px 18px", border: `1px solid ${C.line}`, marginBottom: 22,
        display: "flex", alignItems: "center", gap: 12, cursor: "pointer",
      }}>
        <Scale size={22} color={C.herb} />
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: 12, color: C.inkSoft }}>Poids · tendance</p>
          <p style={{ margin: 0, fontFamily: MONO, fontWeight: 600, fontSize: 15 }}>
            {weightStats?.latestTrend ? `${round(weightStats.latestTrend)} kg` : "Pas encore de pesée"}
            {weightStats?.change7 != null && (
              <span style={{ fontSize: 12, marginLeft: 8, color: weightStats.change7 > 0.15 ? C.berry : weightStats.change7 < -0.15 ? C.olive : C.inkSoft }}>
                {weightStats.change7 > 0 ? "+" : ""}{round(weightStats.change7)} kg / 7 j
              </span>
            )}
          </p>
          {bodyFat && <p style={{ margin: 0, fontSize: 11.5, color: C.inkSoft }}>Masse grasse : {round(bodyFat.bf)} %</p>}
        </div>
        <span style={{ fontSize: 12, color: C.herb, fontWeight: 600 }}>{weightStats?.latestTrend ? "Détails" : "Se peser"} ›</span>
      </div>

      <button onClick={onOpenBilan} style={{
        width: "100%", marginTop: -10, marginBottom: 22, padding: "12px 18px", borderRadius: 16, border: `1px solid ${C.line}`, background: C.card,
        display: "flex", alignItems: "center", justifyContent: "space-between", color: C.ink,
      }}>
        <span style={{ fontSize: 13.5, fontWeight: 600 }}>📊 Bilan de la semaine</span>
        <span style={{ fontSize: 12, color: C.herb, fontWeight: 600 }}>Voir ›</span>
      </button>

      {/* Repas : un bloc par repas (en-tête avec totaux, repliable, menu ⋯) */}
      {MEAL_ORDER.map((meal) => {
        const items = dayData.meals[meal];
        const sum = items.reduce((t, e) => ({ kcal: t.kcal + (e.kcal || 0), prot: t.prot + (e.prot || 0), carbs: t.carbs + (e.carbs || 0), fat: t.fat + (e.fat || 0) }), { kcal: 0, prot: 0, carbs: 0, fat: 0 });
        const isCollapsed = !!collapsed[meal] && items.length > 0;
        const yList = yesterday?.meals?.[meal] || [];
        return (
          <div key={meal} style={{ marginBottom: 14, background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 10px 10px 14px" }}>
              <button onClick={() => items.length && toggleCollapsed(meal)} aria-expanded={!isCollapsed} style={{ flex: 1, minWidth: 0, textAlign: "left", background: "none", border: "none", padding: 0, color: C.ink }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: 16 }}>{MEAL_LABELS[meal]}</span>
                  {items.length > 0 && <ChevronDown size={15} color={C.inkSoft} style={{ transform: isCollapsed ? "rotate(-90deg)" : "none", transition: "transform .15s" }} />}
                </span>
                {items.length > 0 && (
                  <span style={{ display: "block", fontFamily: "'IBM Plex Mono',monospace", fontSize: 11.5, color: C.inkSoft, marginTop: 1 }}>
                    <b style={{ color: C.herb }}>{Math.round(sum.kcal)} kcal</b> · P{Math.round(sum.prot)} G{Math.round(sum.carbs)} L{Math.round(sum.fat)} · {items.length} aliment{items.length > 1 ? "s" : ""}
                  </span>
                )}
              </button>
              <button onClick={() => setMealMenu(meal)} aria-label={`Options ${MEAL_LABELS[meal]}`} style={{
                background: "none", border: `1px solid ${C.line}`, borderRadius: 999, width: 30, height: 30,
                display: "flex", alignItems: "center", justifyContent: "center", color: C.inkSoft, flexShrink: 0,
              }}><MoreHorizontal size={16} /></button>
              <button onClick={() => onOpenAdd(meal)} aria-label={`Ajouter au ${MEAL_LABELS[meal]}`} style={{
                background: C.sage, border: "none", borderRadius: 999, width: 30, height: 30,
                display: "flex", alignItems: "center", justifyContent: "center", color: C.herb, flexShrink: 0,
              }}><Plus size={16} /></button>
            </div>
            {(planned?.[meal] || []).filter((p) => !p.done).map((p) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 10px 8px", padding: "7px 10px", borderRadius: 10, border: `1px dashed ${C.herb}`, background: C.sage }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: C.ink }}>
                  📅 Prévu : <b>{p.name}</b>{p.kind === "recipe" && p.servings !== 1 ? ` ×${String(p.servings).replace(".", ",")}` : ""}
                  <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: C.inkSoft }}> · {Math.round(p.kcal)} kcal</span>
                </span>
                <button onClick={() => onLogPlanned(meal, p)} style={{ padding: "5px 10px", borderRadius: 999, border: "none", background: C.herb, color: C.onAccent, fontSize: 11.5, fontWeight: 600, flexShrink: 0 }}>Noter</button>
              </div>
            ))}
            {items.length === 0 ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "0 14px 12px", flexWrap: "wrap" }}>
                <p style={{ margin: 0, fontSize: 12.5, color: C.inkSoft, fontStyle: "italic" }}>Aucun aliment ajouté.</p>
                {yList.length > 0 ? (
                  <button onClick={() => onCopyMeal(meal)} style={{
                    background: "transparent", border: `1px dashed ${C.herb}`, borderRadius: 999, padding: "5px 10px",
                    color: C.herb, fontSize: 11.5, fontWeight: 600, whiteSpace: "nowrap",
                  }}>
                    ↺ Comme la veille ({yList.length} · {Math.round(yList.reduce((a, e) => a + (e.kcal || 0), 0))} kcal)
                  </button>
                ) : (
                  <button onClick={() => setMealMenu(meal)} style={{
                    background: "transparent", border: `1px dashed ${C.line}`, borderRadius: 999, padding: "5px 10px",
                    color: C.inkSoft, fontSize: 11.5, fontWeight: 600, whiteSpace: "nowrap",
                  }}>↺ Copier un repas…</button>
                )}
              </div>
            ) : isCollapsed ? (
              <p onClick={() => toggleCollapsed(meal)} style={{ margin: 0, padding: "0 14px 12px", fontSize: 12, color: C.inkSoft, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "pointer" }}>
                {items.map((e) => e.name).join(" · ")}
              </p>
            ) : (
              <div style={{ borderTop: `1px solid ${C.line}` }}>
                {items.map((e, idx) => (
                  editing === meal + ":" + e.id ? (
                    <div key={e.id} style={{ padding: 8, borderTop: idx ? `1px solid ${C.line}` : "none" }}>
                      <EntryEditor entry={e} meal={meal} currentDate={currentDate}
                        isFavorite={(favorites || []).some((f) => f.key === norm(e.name))} onToggleFavorite={() => onToggleFavorite(e)}
                        onCancel={() => setEditing(null)}
                        onDelete={() => { onDeleteEntry(meal, e.id); setEditing(null); }}
                        onSave={(patch) => { onEditEntry(meal, e.id, patch); setEditing(null); }} />
                    </div>
                  ) : (
                  <div key={e.id} onClick={() => setEditing(meal + ":" + e.id)} style={{
                    padding: "9px 14px", borderTop: idx ? `1px solid ${C.line}` : "none",
                    display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", gap: 8,
                  }}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 13.5, fontWeight: 500 }}>{e.name}</p>
                      <p style={{ margin: 0, fontSize: 11, color: C.inkSoft, fontFamily: "'IBM Plex Mono',monospace" }}>
                        {e.grams ? `${e.grams} g · ` : ""}{Math.round(e.kcal)} kcal · P{round(e.prot)} G{round(e.carbs)} L{round(e.fat)}
                      </p>
                    </div>
                    <Pencil size={14} color={C.inkSoft} style={{ flexShrink: 0 }} />
                  </div>
                  )
                ))}
              </div>
            )}
          </div>
        );
      })}
      {calOpen && (
        <CalendarSheet currentDate={currentDate} allDays={allDays} weights={weights} goalKcal={goals.kcal}
          onPick={setCurrentDate} onClose={() => setCalOpen(false)} />
      )}
      {mealMenu && (
        <MealActions meal={mealMenu} items={dayData.meals[mealMenu]} currentDate={currentDate} allDays={allDays}
          labels={MEAL_LABELS} order={MEAL_ORDER} templates={mealTemplates}
          onClose={() => setMealMenu(null)}
          onCopyIn={(list) => onCopyIn(mealMenu, list)}
          onCopyTo={onCopyTo}
          onSaveTemplate={onSaveTemplate} onDeleteTemplate={onDeleteTemplate}
          onAddTemplate={(t) => onAddTemplate(mealMenu, t)}
          onClear={() => onClearMeal(mealMenu)}
          onScale={(f) => onScaleMeal(mealMenu, f)} />
      )}
    </div>
  );
}

/** Applique un facteur (½, ¾, ×2…) à un aliment noté : quantité et valeurs recalculées. */
export function scaleEntry(e, f) {
  if (f === 1) return e;
  return {
    ...e,
    grams: e.grams ? Math.round(e.grams * f) : null,
    kcal: round(e.kcal * f), prot: round(e.prot * f), carbs: round(e.carbs * f), fat: round(e.fat * f),
    ...(e.water != null ? { water: Math.round(e.water * f) } : {}),
    ...(e.portions != null || !e.grams ? { portions: Math.round((e.portions || 1) * f * 100) / 100 } : {}),
  };
}
export const FRACTIONS = [[0.25, "¼"], [1 / 3, "⅓"], [0.5, "½"], [2 / 3, "⅔"], [0.75, "¾"]];

/** Édition d'un aliment du journal : quantité, repas, jour. */
export function EntryEditor({ entry, meal, currentDate, onSave, onCancel, onDelete, isFavorite, onToggleFavorite }) {
  const hasGrams = !!entry.grams;
  const [grams, setGrams] = useState(entry.grams || 100);
  const [portions, setPortions] = useState(1);
  const [toMeal, setToMeal] = useState(meal);
  const [toDate, setToDate] = useState(currentDate);
  const [confirmDel, setConfirmDel] = useState(false);
  const factor = hasGrams ? (Number(grams) || 0) / entry.grams : portions;
  const k = Math.round(entry.kcal * factor);
  const chip = (active) => ({
    padding: "6px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, border: `1px solid ${active ? C.herb : C.line}`,
    background: active ? C.herb : C.card, color: active ? C.onAccent : C.ink, whiteSpace: "nowrap",
  });
  const small = { background: C.sage, border: "none", borderRadius: 9, width: 34, height: 34, color: C.herb, display: "flex", alignItems: "center", justifyContent: "center" };
  return (
    <div style={{ background: C.card, borderRadius: 12, padding: 12, border: `1.5px solid ${C.herb}` }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 10 }}>
        <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, flex: 1 }}>{entry.name}</p>
        <button onClick={onToggleFavorite} aria-label="Favori" style={{
          background: isFavorite ? C.ochreLight : "transparent", border: `1px solid ${isFavorite ? C.ochre : C.line}`, borderRadius: 999,
          padding: "4px 10px", fontSize: 12, fontWeight: 600, color: isFavorite ? C.ink : C.inkSoft, whiteSpace: "nowrap",
        }}>{isFavorite ? "★ Favori" : "☆ Favori"}</button>
      </div>

      <p style={{ margin: "0 0 4px", fontSize: 11.5, color: C.inkSoft, fontWeight: 600 }}>{hasGrams ? "Quantité" : "Portions (par rapport à la saisie)"}</p>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        {hasGrams ? (
          <>
            <input type="number" inputMode="decimal" value={grams} onChange={(ev) => setGrams(ev.target.value)}
              style={{ ...inputStyle, flex: 1, padding: "8px 10px" }} />
            <span style={{ fontSize: 12, color: C.inkSoft }}>g</span>
          </>
        ) : (
          <>
            <button onClick={() => setPortions(Math.max(0.25, portions - 0.25))} style={small}><Minus size={14} /></button>
            <span style={{ fontFamily: MONO, fontWeight: 600, minWidth: 50, textAlign: "center" }}>× {String(round(portions)).replace(".", ",")}</span>
            <button onClick={() => setPortions(portions + 0.25)} style={small}><Plus size={14} /></button>
          </>
        )}
      </div>
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", margin: "6px 0 6px" }}>
        <span style={{ fontSize: 11.5, color: C.inkSoft, alignSelf: "center", marginRight: 2 }}>J'en ai mangé :</span>
        {[...FRACTIONS, [1, "tout"], [1.5, "×1,5"], [2, "×2"]].map(([f, l]) => {
          const active = Math.abs(factor - f) < 0.01;
          return (
            <button key={l} onClick={() => (hasGrams ? setGrams(Math.round(entry.grams * f)) : setPortions(round(f * 100) / 100))}
              style={{ ...chip(active), padding: "5px 9px", fontSize: l.length === 1 ? 14 : 12 }}>{l}</button>
          );
        })}
      </div>
      <p style={{ margin: "0 0 10px", fontSize: 11.5, color: C.inkSoft, fontFamily: MONO }}>
        {k} kcal · P{round(entry.prot * factor)} G{round(entry.carbs * factor)} L{round(entry.fat * factor)}
      </p>

      <p style={{ margin: "0 0 4px", fontSize: 11.5, color: C.inkSoft, fontWeight: 600 }}>Repas</p>
      <div className="scrollx" style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 10 }}>
        {MEAL_ORDER.map((m) => <button key={m} onClick={() => setToMeal(m)} style={chip(toMeal === m)}>{MEAL_LABELS[m]}</button>)}
      </div>

      <p style={{ margin: "0 0 4px", fontSize: 11.5, color: C.inkSoft, fontWeight: 600 }}>Jour</p>
      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        <button onClick={() => setToDate(addDays(currentDate, -1))} style={chip(toDate === addDays(currentDate, -1))}>Veille</button>
        <button onClick={() => setToDate(currentDate)} style={chip(toDate === currentDate)}>Ce jour</button>
        <button onClick={() => setToDate(addDays(currentDate, 1))} style={chip(toDate === addDays(currentDate, 1))}>Lendemain</button>
        <input type="date" value={toDate} onChange={(ev) => ev.target.value && setToDate(ev.target.value)}
          style={{ ...inputStyle, width: 140, padding: "5px 8px", fontSize: 12 }} />
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        {confirmDel ? (
          <button onClick={onDelete} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", background: C.berry, color: C.onAccent, fontWeight: 600, fontSize: 13 }}>Supprimer ?</button>
        ) : (
          <button onClick={() => setConfirmDel(true)} style={{ padding: "10px 12px", borderRadius: 10, border: "none", background: C.berryLight, color: C.berry }} aria-label="Supprimer"><Trash2 size={15} /></button>
        )}
        <button onClick={onCancel} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: `1px solid ${C.line}`, background: "transparent", color: C.inkSoft, fontSize: 13 }}>Annuler</button>
        <button disabled={!(factor > 0)} onClick={() => onSave({ factor, toMeal, toDate })} style={{ flex: 2, padding: "10px 0", borderRadius: 10, border: "none", background: C.herb, color: C.onAccent, fontWeight: 600, fontSize: 13 }}>
          {toDate !== currentDate ? `Déplacer au ${frShort(toDate)}` : "Enregistrer"}
        </button>
      </div>
    </div>
  );
}

/** Choix de la quantité d'eau : contenants courants + quantité libre, ajout ou retrait. */
export const WATER_SIZES = [
  [100, "Petit verre"], [150, "Tasse"], [200, "Verre"], [250, "Mug"],
  [330, "Canette"], [500, "Bouteille 50 cl"], [750, "Gourde"], [1000, "1 litre"], [1500, "Bouteille 1,5 L"],
];
export function WaterPicker({ quick, onPick }) {
  const [remove, setRemove] = useState(false);
  const [custom, setCustom] = useState("");
  const sign = remove ? -1 : 1;
  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: 12, margin: "-8px 0 16px" }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        {[[false, "Ajouter"], [true, "Retirer"]].map(([v, l]) => (
          <button key={l} onClick={() => setRemove(v)} style={{
            flex: 1, padding: "7px 0", borderRadius: 999, border: "none", fontSize: 12.5, fontWeight: 600,
            background: remove === v ? (v ? C.berry : C.herb) : C.paperDark, color: remove === v ? C.onAccent : C.inkSoft,
          }}>{l}</button>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
        {WATER_SIZES.map(([ml, label]) => (
          <button key={ml} onClick={() => onPick(sign * ml)} style={{
            padding: "8px 4px", borderRadius: 12, border: `1.5px solid ${ml === quick ? C.herb : C.line}`,
            background: ml === quick ? C.sage : C.card, color: C.ink, display: "flex", flexDirection: "column", alignItems: "center", gap: 1,
          }}>
            <span style={{ fontFamily: MONO, fontWeight: 600, fontSize: 13.5 }}>{remove ? "−" : "+"}{ml >= 1000 ? `${ml / 1000} L`.replace(".", ",") : `${ml} ml`}</span>
            <span style={{ fontSize: 10.5, color: C.inkSoft }}>{label}</span>
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        <input type="number" inputMode="numeric" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Autre quantité (ml)"
          style={{ ...inputStyle, flex: 1, padding: "8px 10px", fontSize: 13 }} />
        <button disabled={!(Number(custom) > 0)} onClick={() => { onPick(sign * Math.round(Number(custom))); setCustom(""); }} style={{
          padding: "0 14px", borderRadius: 10, border: "none", background: remove ? C.berry : C.herb, color: C.onAccent, fontWeight: 600, fontSize: 13,
          opacity: Number(custom) > 0 ? 1 : 0.5,
        }}>OK</button>
      </div>
      <p style={{ fontSize: 10.5, color: C.inkSoft, margin: "6px 0 0" }}>La dernière quantité ajoutée devient le bouton rapide.</p>
    </div>
  );
}

export function ActivityCard({ activity, sportSettings, onSetSteps, onOpenSport, goals }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState("");
  if (!activity) return null;
  const habitual = sportSettings.habitualSteps || 0;
  const eat = sportSettings.eatBack || 0;
  return (
    <div style={{ background: C.card, borderRadius: 20, padding: "14px 18px", border: `1px solid ${C.line}`, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Footprints size={22} color={C.olive} />
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: 12, color: C.inkSoft }}>Pas du jour</p>
          {editing ? (
            <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
              <input autoFocus type="number" inputMode="numeric" value={val} onChange={(e) => setVal(e.target.value)} placeholder={String(habitual)}
                style={{ ...inputStyle, padding: "7px 10px", fontSize: 14 }} />
              <button onClick={() => { onSetSteps(val === "" ? null : Number(val)); setEditing(false); }} style={{ background: C.herb, color: C.onAccent, border: "none", borderRadius: 9, padding: "0 12px" }}><Check size={15} /></button>
            </div>
          ) : (
            <p style={{ margin: 0, fontFamily: MONO, fontWeight: 600, fontSize: 15 }}>
              {activity.steps != null ? activity.steps.toLocaleString("fr-FR") : "—"}
              <span style={{ fontSize: 11.5, color: C.inkSoft, fontWeight: 500 }}> / {habitual.toLocaleString("fr-FR")} habituels</span>
              {activity.stepsFromHc && <span style={{ fontSize: 10.5, color: C.olive, fontWeight: 600, fontFamily: "'Work Sans',sans-serif" }}> · Health Connect</span>}
            </p>
          )}
          {activity.stepsK != null && !editing && (
            <p style={{ margin: 0, fontSize: 11, color: C.inkSoft }}>≈ {Math.round(activity.stepsK)} kcal nettes{Math.abs(activity.stepsDelta) >= 15 ? ` (${activity.stepsDelta > 0 ? "+" : ""}${Math.round(activity.stepsDelta)} vs habituel)` : ""}</p>
          )}
        </div>
        {!editing && (
          <div style={{ display: "flex", gap: 6 }}>
            {activity.steps == null && habitual > 0 && !activity.hcOn && (
              <button onClick={() => onSetSteps(habitual)} style={{ background: C.sage, color: C.herb, border: "none", borderRadius: 999, padding: "6px 10px", fontSize: 11.5, fontWeight: 600 }}>Habituel</button>
            )}
            <button onClick={() => { setVal(activity.steps ?? ""); setEditing(true); }} style={{ background: C.sage, color: C.herb, border: "none", borderRadius: 999, padding: "6px 10px", fontSize: 11.5, fontWeight: 600 }}>Saisir</button>
          </div>
        )}
      </div>

      <div style={{ height: 1, background: C.line, margin: "12px 0" }} />

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Flame size={22} color={C.berry} />
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: 12, color: C.inkSoft }}>Sport du jour</p>
          {activity.list.length ? activity.list.map((w) => (
            <p key={w.id} style={{ margin: 0, fontSize: 13, fontWeight: 500 }}>{w.title} <span style={{ fontFamily: MONO, fontSize: 11.5, color: C.inkSoft }}>· {Math.round(w.durationMin || 0)} min · {w.kcal} kcal</span></p>
          )) : null}
          {(activity.hc?.sessions || []).map((x) => (
            <p key={x.id} style={{ margin: 0, fontSize: 13, fontWeight: 500 }}>{x.title} <span style={{ fontFamily: MONO, fontSize: 11.5, color: C.inkSoft }}>· {x.durationMin} min · via {originLabel(x.origin)}</span></p>
          ))}
          {!activity.list.length && !(activity.hc?.sessions || []).length && <p style={{ margin: 0, fontSize: 13, color: C.inkSoft, fontStyle: "italic" }}>Rien pour l'instant</p>}
          {activity.hc?.activeKcal != null && (
            <p style={{ margin: "3px 0 0", fontSize: 11.5, color: C.inkSoft }}>
              Dépense mesurée (Health Connect) : <strong style={{ fontFamily: MONO }}>{activity.hc.activeKcal} kcal</strong> actives{activity.hc.totalKcal ? ` · ${activity.hc.totalKcal} kcal au total` : ""}
            </p>
          )}
        </div>
        <button onClick={onOpenSport} style={{ background: C.herb, color: C.onAccent, border: "none", borderRadius: 999, padding: "7px 12px", fontSize: 12, fontWeight: 600 }}>Sport ›</button>
      </div>
      <p style={{ margin: "10px 0 0", fontSize: 11, color: C.inkSoft, lineHeight: 1.45 }}>
        {eat > 0
          ? `Objectif ajusté : ${goals.kcal} ${activity.bonus >= 0 ? "+" : "−"} ${Math.abs(activity.bonus)} kcal (${Math.round(eat * 100)} % de l'activité du jour au-delà de l'habituel).`
          : "Tes pas habituels et ton sport prévu sont déjà inclus dans ton objectif : les calories dépensées ne sont pas rajoutées (réglable dans Profil)."}
      </p>
    </div>
  );
}
