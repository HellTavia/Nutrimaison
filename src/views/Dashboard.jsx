// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Les auteurs de NutriMaison
/* Écran « Aujourd'hui » : anneau, eau, activité, repas, édition d'un aliment */
import React, { useState } from "react";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Droplet, Flame, Footprints, Minus, MoreHorizontal, Pencil, Plus, Scale, Trash2 } from "lucide-react";
import { MealActions, Sheet } from "../MealTools.jsx";
import { CalendarSheet } from "../Calendar.jsx";
import { openExternal } from "../updates.js";
import { C, MONO, Ring, addDays, frDate, frShort, inputStyle, loadJSON, round, saveJSON, todayISO } from "../shared.jsx";
import { originLabel, groupSessions, loadHC, saveHC, sessionMet, SESSION_MET, findSessionFix, setSessionFix } from "../healthconnect.js";
import { MEAL_LABELS, MEAL_ORDER, dayFoodWaterMl, norm } from "../foodData.js";
import { APP_VERSION } from "../version.js";
import { tr } from "../i18n.js";

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
export function Dashboard({ currentDate, setCurrentDate, dayData, totals, goals, onToggleCalSource, onOpenAdd, onDeleteEntry, onChangeWater, onEditEntry,
  yesterday, onCopyMeal, favorites, onToggleFavorite,
  allDays, weights, update, onDismissUpdate, mealTemplates, planned, onLogPlanned, onCopyIn, onCopyTo, onSaveTemplate, onDeleteTemplate, onAddTemplate, onClearMeal, onScaleMeal,
  activity, sportSettings, onSetSteps, weightStats, bodyFat, onOpenSport, onOpenBody, onOpenBilan }) {
  const isToday = currentDate === todayISO();
  const [editing, setEditing] = useState(null); // "meal:id"
  const [mealMenu, setMealMenu] = useState(null);
  const [calOpen, setCalOpen] = useState(false);
  const [openMeals, setOpenMeals] = useState(() => loadJSON("openMeals", {}));
  const toggleMeal = (m) => { const n = { ...openMeals, [m]: !openMeals[m] }; setOpenMeals(n); saveJSON("openMeals", n); };
  const [actOpen, setActOpen] = useState(false);
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

      {/* Résumé du jour : calories, macros et eau dans un seul bloc */}
      <div style={{ background: C.card, borderRadius: 20, padding: "18px 18px 14px", border: `1px solid ${C.line}`, marginBottom: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>        <div style={{ position: "relative", flexShrink: 0 }}>
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

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.line}` }}>
          <Droplet size={20} color="#5AA7C9" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontFamily: MONO, fontSize: 15, fontWeight: 600 }}>
              {(dayData.water + (goals.foodWater !== false ? foodWater : 0)).toLocaleString("fr-FR")} <span style={{ color: C.inkSoft, fontWeight: 500, fontSize: 12 }}>/ {goals.water.toLocaleString("fr-FR")} ml</span>
            </p>
            <p style={{ margin: 0, color: C.inkSoft, fontSize: 11 }}>
              {goals.foodWater !== false
                ? <>Bu {dayData.water.toLocaleString("fr-FR")} + aliments ~{foodWater.toLocaleString("fr-FR")} ml</>
                : "Eau bue"}
            </p>
          </div>
          <button onClick={() => onChangeWater(-waterQuick)} aria-label={`Retirer ${waterQuick} ml`} style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 999, width: 30, height: 30, color: C.ink, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Minus size={14} />
          </button>
          <button onClick={() => onChangeWater(waterQuick)} style={{ background: C.herb, border: "none", borderRadius: 999, padding: "0 12px", height: 30, color: C.onAccent, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>
            +{waterQuick} ml
          </button>
          <button onClick={() => setWaterOpen(!waterOpen)} aria-label="Choisir une quantité" style={{ background: C.sage, border: "none", borderRadius: 999, width: 30, height: 30, color: C.herb, display: "flex", alignItems: "center", justifyContent: "center", transform: waterOpen ? "rotate(45deg)" : "none", transition: "transform .2s" }}>
            <Plus size={14} />
          </button>
        </div>
      </div>
      {waterOpen && (
        <WaterPicker quick={waterQuick}
          onPick={(ml, keepOpen) => { onChangeWater(ml); if (ml > 0) { setWaterQuick(ml); saveJSON("waterQuick", ml); } if (!keepOpen) setWaterOpen(false); }} />
      )}

      {/* Repas : une ligne compacte par repas, qui se déplie au toucher */}
      <p style={LBL}>Repas</p>
      <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 18, overflow: "hidden", marginBottom: 6 }}>
      {MEAL_ORDER.map((meal, mi) => {
        const items = dayData.meals[meal];
        const sum = items.reduce((t, e) => ({ kcal: t.kcal + (e.kcal || 0), prot: t.prot + (e.prot || 0), carbs: t.carbs + (e.carbs || 0), fat: t.fat + (e.fat || 0) }), { kcal: 0, prot: 0, carbs: 0, fat: 0 });
        const isOpen = !!openMeals[meal];
        const yList = yesterday?.meals?.[meal] || [];
        const plans = (planned?.[meal] || []).filter((p) => !p.done);
        return (
          <div key={meal} style={{ borderTop: mi ? `1px solid ${C.line}` : "none" }}>
            <div onClick={() => toggleMeal(meal)} role="button" aria-expanded={isOpen} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 12px 12px 16px", cursor: "pointer" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>{MEAL_LABELS[meal]}</span>
                  <ChevronDown size={14} color={C.inkSoft} style={{ transform: isOpen ? "none" : "rotate(-90deg)", transition: "transform .15s" }} />
                </span>
                {items.length > 0 ? (
                  <span style={{ display: "block", fontSize: 12, color: C.inkSoft, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{items.map((e) => tr(e.name)).join(", ")}</span>
                ) : !plans.length && <span style={{ display: "block", fontSize: 12, color: C.inkSoft, fontStyle: "italic" }}>Rien pour l'instant</span>}
                {plans.map((p) => (
                  <span key={p.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.ochre, fontWeight: 600, marginTop: 1 }}>
                    <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      📅 Prévu : {p.name}{p.kind === "recipe" && p.servings !== 1 ? ` ×${String(p.servings).replace(".", ",")}` : ""} · {Math.round(p.kcal)} kcal
                    </span>
                    <button onClick={(ev) => { ev.stopPropagation(); onLogPlanned(meal, p); }} style={{ padding: "3px 9px", borderRadius: 999, border: "none", background: C.ochreLight, color: C.ochre, fontSize: 11, fontWeight: 700, flexShrink: 0 }}>Noter</button>
                  </span>
                ))}
              </div>
              {items.length > 0 && <span style={{ fontFamily: MONO, fontSize: 13.5, color: C.inkSoft }}>{Math.round(sum.kcal)}</span>}
              <button onClick={(ev) => { ev.stopPropagation(); onOpenAdd(meal); }} aria-label={`Ajouter au ${MEAL_LABELS[meal]}`} style={{
                background: C.sage, border: "none", borderRadius: 999, width: 32, height: 32,
                display: "flex", alignItems: "center", justifyContent: "center", color: C.herb, flexShrink: 0,
              }}><Plus size={16} /></button>
            </div>
            {isOpen && (
              <div style={{ background: C.paper, borderTop: `1px solid ${C.line}` }}>
                {items.length > 0 && (
                  <p style={{ margin: 0, padding: "7px 16px 0", fontFamily: MONO, fontSize: 11.5, color: C.inkSoft }}>
                    <b style={{ color: C.herb }}>{Math.round(sum.kcal)} kcal</b> · P{Math.round(sum.prot)} G{Math.round(sum.carbs)} L{Math.round(sum.fat)} · {items.length} aliment{items.length > 1 ? "s" : ""}
                  </p>
                )}
                {items.map((e) => (
                  editing === meal + ":" + e.id ? (
                    <div key={e.id} style={{ padding: 8 }}>
                      <EntryEditor entry={e} meal={meal} currentDate={currentDate}
                        isFavorite={(favorites || []).some((f) => f.key === norm(e.name))} onToggleFavorite={() => onToggleFavorite(e)}
                        onCancel={() => setEditing(null)}
                        onDelete={() => { onDeleteEntry(meal, e.id); setEditing(null); }}
                        onSave={(patch) => { onEditEntry(meal, e.id, patch); setEditing(null); }} />
                    </div>
                  ) : (
                  <div key={e.id} onClick={() => setEditing(meal + ":" + e.id)} style={{
                    padding: "8px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", gap: 8,
                  }}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 13.5, fontWeight: 500 }}>{e.name}</p>
                      <p style={{ margin: 0, fontSize: 11, color: C.inkSoft, fontFamily: MONO }}>
                        {e.grams ? `${e.grams} g · ` : ""}{Math.round(e.kcal)} kcal · P{round(e.prot)} G{round(e.carbs)} L{round(e.fat)}
                      </p>
                    </div>
                    <Pencil size={14} color={C.inkSoft} style={{ flexShrink: 0 }} />
                  </div>
                  )
                ))}
                <div style={{ display: "flex", gap: 8, padding: "6px 12px 12px", flexWrap: "wrap" }}>
                  {items.length === 0 && yList.length > 0 && (
                    <button onClick={() => onCopyMeal(meal)} style={{ background: "transparent", border: `1px dashed ${C.herb}`, borderRadius: 999, padding: "6px 11px", color: C.herb, fontSize: 12, fontWeight: 600 }}>
                      ↺ Comme la veille ({yList.length} · {Math.round(yList.reduce((a, e) => a + (e.kcal || 0), 0))} kcal)
                    </button>
                  )}
                  <button onClick={() => setMealMenu(meal)} style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 999, padding: "6px 11px", color: C.inkSoft, fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}>
                    <MoreHorizontal size={14} /> Copier, repas type, portions…
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
      </div>

      {/* Activité et corps : une ligne chacun, le détail s'ouvre en feuille */}
      <p style={LBL}>Activité & corps</p>
      {activity && (() => {
        const sess = groupSessions(activity.hc?.sessions, loadHC());
        const bits = [
          activity.steps != null ? `${activity.steps.toLocaleString("fr-FR")} pas` : null,
          ...activity.list.map((w) => `${w.title} ${Math.round(w.durationMin || 0)} min`),
          ...sess.map((g) => `${g.label} ${Math.round(g.minutes)} min`),
        ].filter(Boolean);
        const avg = activity.cal?.avg;
        return (
          <button onClick={() => setActOpen(true)} style={ROW}>
            <span style={TICO}><Flame size={17} /></span>
            <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
              <b style={{ display: "block", fontSize: 14.5 }}>{avg ? `Dépense ≈ ${avg.toLocaleString("fr-FR")} kcal` : "Activité du jour"}</b>
              <span style={{ display: "block", fontSize: 12, color: C.inkSoft, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{bits.join(" · ") || "Pas et sport : rien pour l'instant"}</span>
            </span>
            <ChevronRight size={17} color={C.inkSoft} />
          </button>
        );
      })()}
      <button onClick={() => onOpenBody("poids")} style={ROW}>
        <span style={TICO}><Scale size={17} /></span>
        <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
          <b style={{ display: "block", fontSize: 14.5, fontFamily: MONO }}>
            {weightStats?.latestTrend ? `${String(round(weightStats.latestTrend)).replace(".", ",")} kg` : "Se peser"}
            {weightStats?.change7 != null && (
              <span style={{ fontSize: 12, marginLeft: 6, fontWeight: 500, color: weightStats.change7 > 0.15 ? C.berry : weightStats.change7 < -0.15 ? C.olive : C.inkSoft }}>
                {weightStats.change7 > 0 ? "+" : ""}{String(round(weightStats.change7)).replace(".", ",")} kg / 7 j
              </span>
            )}
          </b>
          <span style={{ display: "block", fontSize: 12, color: C.inkSoft }}>{bodyFat ? `Masse grasse ${String(round(bodyFat.bf)).replace(".", ",")} % · ` : ""}poids, métabolisme, besoin réel</span>
        </span>
        <Sparkline weights={weights} />
        <ChevronRight size={17} color={C.inkSoft} />
      </button>
      <button onClick={onOpenBilan} style={{ ...ROW, padding: "11px 16px" }}>
        <span style={{ flex: 1, textAlign: "left", fontSize: 13.5, fontWeight: 600 }}>📊 Bilan de la semaine</span>
        <ChevronRight size={17} color={C.inkSoft} />
      </button>

      {actOpen && (
        <Sheet title="Activité du jour" onClose={() => setActOpen(false)}>
          <ActivityCard activity={activity} sportSettings={sportSettings} onSetSteps={onSetSteps} onOpenSport={() => { setActOpen(false); onOpenSport(); }} goals={goals}
            weightStats={weightStats} isToday={isToday} onToggleCalSource={onToggleCalSource} onOpenMetab={() => { setActOpen(false); onOpenBody("metab"); }} />
        </Sheet>
      )}
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

const LBL = { fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: C.inkSoft, margin: "16px 4px 8px" };
const ROW = { width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", marginBottom: 8, background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, color: C.ink, cursor: "pointer" };
const TICO = { width: 34, height: 34, borderRadius: 10, background: C.sage, color: C.herb, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 };

/** Petite courbe des dernières pesées (tendance visuelle sur la ligne Poids de l'accueil). */
function Sparkline({ weights }) {
  const pts = Object.entries(weights || {}).sort((a, b) => a[0].localeCompare(b[0])).slice(-14).map(([, v]) => Number(v)).filter(Boolean);
  if (pts.length < 3) return null;
  const min = Math.min(...pts), max = Math.max(...pts), r = max - min || 1;
  const d = pts.map((v, i) => `${i ? "L" : "M"}${(i / (pts.length - 1)) * 60},${3 + (1 - (v - min) / r) * 18}`).join(" ");
  return <svg width="60" height="24" viewBox="0 0 60 24" style={{ flexShrink: 0 }}><path d={d} fill="none" stroke={C.herb} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
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

export function ActivityCard({ activity, sportSettings, onSetSteps, onOpenSport, goals, weightStats, isToday, onToggleCalSource, onOpenMetab }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState("");
  const [info, setInfo] = useState(false); // explications repliées derrière ⓘ
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
          {groupSessions(activity.hc?.sessions, loadHC()).map((g) => (
            <p key={g.key} style={{ margin: 0, fontSize: 13, fontWeight: 500 }}>{g.label} <span style={{ fontFamily: MONO, fontSize: 11.5, color: C.inkSoft }}>· {g.count > 1 ? `${g.count} fois · ` : ""}{Math.round(g.minutes)} min · via {originLabel(g.origin)}</span></p>
          ))}
          {!activity.list.length && !(activity.hc?.sessions || []).length && <p style={{ margin: 0, fontSize: 13, color: C.inkSoft, fontStyle: "italic" }}>Rien pour l'instant</p>}
          {!(activity.cal?.rows || []).length && activity.hc?.activeKcal != null && (
            <p style={{ margin: "3px 0 0", fontSize: 11.5, color: C.inkSoft }}>
              Dépense mesurée (Health Connect) : <strong style={{ fontFamily: MONO }}>{activity.hc.activeKcal} kcal</strong> actives{activity.hc.totalKcal ? ` · ${activity.hc.totalKcal} kcal au total` : ""}
            </p>
          )}
        </div>
        <button onClick={onOpenSport} style={{ background: C.herb, color: C.onAccent, border: "none", borderRadius: 999, padding: "7px 12px", fontSize: 12, fontWeight: 600 }}>Sport ›</button>
      </div>
      {(activity.cal?.rows || []).length > 0 && <SpendBlock cal={activity.cal} week={activity.calWeek} adaptive={weightStats?.adaptive} isToday={isToday} onToggle={onToggleCalSource} onOpenMetab={onOpenMetab} info={info} />}

      <button onClick={() => setInfo(!info)} style={{ marginTop: 10, background: "none", border: "none", padding: 0, color: C.inkSoft, fontSize: 12, fontWeight: 600 }}>
        ⓘ {info ? "Masquer les explications" : "Comment c'est calculé"}
      </button>
      {info && <p style={{ margin: "6px 0 0", fontSize: 11, color: C.inkSoft, lineHeight: 1.45 }}>
        {eat > 0
          ? `Objectif ajusté : ${goals.kcal} ${activity.bonus >= 0 ? "+" : "−"} ${Math.abs(activity.bonus)} kcal (${Math.round(eat * 100)} % de l'activité du jour au-delà de l'habituel).`
          : "Tes pas habituels et ton sport prévu sont déjà inclus dans ton objectif : les calories dépensées ne sont pas rajoutées (réglable dans Moi → Objectifs)."}
      </p>}
    </div>
  );
}

/** Dépense du jour : une ligne par appli, moyenne des sources retenues, comparaison au besoin réel. */
function SpendBlock({ cal, week, adaptive, isToday, onToggle, onOpenMetab, info }) {
  const [editing, setEditing] = useState(null);
  const [showFill, setShowFill] = useState({});
  const hhmm = cal.asOf ? new Date(cal.asOf).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : null;
  const real = adaptive?.ok ? adaptive.tdee : null;
  let verdict = null;
  if (week && real) {
    const d = week.avg - real;
    verdict = Math.abs(d) <= 150
      ? { c: C.olive, t: `Les montres sont cohérentes avec ton poids (écart ${d > 0 ? "+" : ""}${d} kcal).` }
      : d > 0
        ? { c: C.berry, t: `Les montres surestiment d'environ ${d} kcal/jour : fie-toi plutôt au besoin réel.` }
        : { c: C.ochre, t: `Les montres sous-estiment d'environ ${-d} kcal/jour : fie-toi plutôt au besoin réel.` };
  }
  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.line}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <p style={{ margin: 0, fontSize: 12, color: C.inkSoft }}>Dépense du jour, selon tes applis</p>
        {isToday && hhmm && <span style={{ fontSize: 10.5, color: C.inkSoft }}>jusqu'à {hhmm}</span>}
      </div>
      {cal.rows.map((r) => (
        <React.Fragment key={r.origin}>
        <button onClick={() => r.totalKcal && onToggle && onToggle(r.origin)} style={{
          width: "100%", display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", padding: "5px 0", textAlign: "left", color: C.ink,
          opacity: r.included ? 1 : 0.55,
        }}>
          <span style={{
            width: 16, height: 16, borderRadius: 4, flexShrink: 0, border: `1.5px solid ${r.included ? C.herb : C.line}`, background: r.included ? C.herb : "transparent",
            color: C.onAccent, fontSize: 11, lineHeight: "13px", textAlign: "center", fontWeight: 700,
          }}>{r.included ? "✓" : ""}</span>
          <span style={{ flex: 1, fontSize: 13, fontWeight: 500, textDecoration: r.included || !r.totalKcal ? "none" : "line-through" }}>{r.label}</span>
          <span style={{ fontFamily: MONO, fontSize: 12, color: C.inkSoft, textAlign: "right" }}>
            {r.totalKcal ? `${r.totalKcal.toLocaleString("fr-FR")} kcal` : "—"}
            {r.rebuilt && r.basal
              ? <span style={{ display: "block", fontSize: 10.5 }}>{r.basal.toLocaleString("fr-FR")} métab. + {r.active || 0} actives{r.fill ? ` + ${r.fill} séances*` : ""}</span>
              : r.active ? <span style={{ display: "block", fontSize: 10.5 }}>dont {r.active} actives</span> : null}
            {r.fillDetail && (
              <span role="button" onClick={(e) => { e.stopPropagation(); setShowFill({ ...showFill, [r.origin]: !showFill[r.origin] }); }}
                style={{ display: "block", fontSize: 10.5, color: C.herb, fontWeight: 600 }}>
                * {r.fillDetail.length} séance{r.fillDetail.length > 1 ? "s" : ""} · {showFill[r.origin] ? "masquer ▴" : "détail et correction ▾"}
              </span>
            )}
            {r.activeRaw != null && r.active != null && r.activeRaw - r.active >= 20 && (
              <span style={{ display: "block", fontSize: 10.5, color: C.ochre }}>écrit {r.activeRaw} actives, Health Connect en compte {r.active}</span>
            )}
            {isToday && r.lastAt && (() => {
              const late = cal.asOf && cal.asOf - r.lastAt > 45 * 60000;
              return <span style={{ display: "block", fontSize: 10.5, color: late ? C.ochre : C.inkSoft }}>
                reçues à {new Date(r.lastAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}{late ? " · en retard" : ""}
              </span>;
            })()}
          </span>
        </button>
        {r.fillDetail && showFill[r.origin] && (
          <div style={{ margin: "0 0 6px 24px", padding: "6px 10px", background: C.sage, borderRadius: 8 }}>
            <div style={{ display: "flex", fontSize: 10.5, color: C.inkSoft, paddingBottom: 3 }}>
              <span style={{ flex: 1 }}>Séance (touche pour corriger)</span><span style={{ fontFamily: MONO }}>estimé − reçu = ajouté</span>
            </div>
            {r.fillDetail.map((q, i) => (
              <div key={i} role="button" onClick={() => q.id && setEditing({ ...q, app: r.label })}
                style={{ display: "flex", alignItems: "baseline", gap: 6, padding: "4px 0", borderTop: `1px solid ${C.line}`, fontSize: 12, color: C.ink }}>
                <span style={{ flex: 1 }}>
                  {q.label} <span style={{ color: C.inkSoft }}>{q.start ? new Date(q.start).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) + " · " : ""}{q.min} min</span>
                  {q.manual && <span style={{ color: C.herb, fontSize: 10.5 }}> · {q.manual === "séance" ? "corrigée" : "réglée"}</span>}
                </span>
                <span style={{ fontFamily: MONO, fontSize: 11.5, color: q.manual ? C.herb : C.inkSoft }}>{q.est} − {q.rec} = <b style={{ color: C.ink }}>+{q.add}</b> ✎</span>
              </div>
            ))}
          </div>
        )}
        </React.Fragment>
      ))}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 4, padding: "8px 10px", background: C.sage, borderRadius: 10 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: C.herb }}>Moyenne{cal.n > 1 ? ` de ${cal.n} applis` : ""}</span>
        <span style={{ fontFamily: MONO, fontSize: 15, fontWeight: 700, color: C.herb }}>{cal.avg ? `${cal.avg.toLocaleString("fr-FR")} kcal` : "—"}</span>
      </div>
      {(week || real) && (
        <div style={{ marginTop: 8, fontSize: 11.5, color: C.inkSoft, lineHeight: 1.5 }}>
          {week && <div>Montres, moyenne sur {week.days} jour{week.days > 1 ? "s" : ""} : <b style={{ fontFamily: MONO, color: C.ink }}>{week.avg.toLocaleString("fr-FR")} kcal</b></div>}
          {real && <div>Ton besoin réel (d'après ton poids et tes repas) : <b style={{ fontFamily: MONO, color: C.ink }}>{real.toLocaleString("fr-FR")} kcal</b></div>}
          {verdict && <div style={{ color: verdict.c, fontWeight: 600, marginTop: 2 }}>{verdict.t}</div>}
        </div>
      )}
      {info && <p style={{ margin: "6px 0 0", fontSize: 10.5, color: C.inkSoft }}>
        Touche une appli pour l'inclure ou l'exclure de la moyenne.{isToday ? " En cours de journée, les calories actives sont celles déjà envoyées par chaque appli." : ""}
        {cal.rows.some((r) => r.fill) && " * Séances : l'appli a envoyé la séance mais presque pas ses calories ; NutriMaison estime la dépense de la séance (type, durée, ton poids) et ajoute ce qui manque. Touche « détail et correction » puis une séance pour saisir les calories affichées par ta montre (option dans Moi → Health Connect)."}
        {isToday && cal.rows.some((r) => r.lastAt && cal.asOf - r.lastAt > 45 * 60000) && " « En retard » : l'appli n'a pas encore envoyé ses dernières activités à Health Connect, le total se complétera plus tard (regarde la veille pour comparer)."}
        {cal.rows.length === 1 && " Une seule appli envoie des calories à Health Connect : pour comparer, autorise aussi Fitbit ou Fit à écrire leurs calories (voir Health Connect)."}
      </p>}
      {onOpenMetab && cal.rows.some((r) => r.basal) && (
        <button onClick={onOpenMetab} style={{ marginTop: 8, background: "none", border: "none", padding: 0, color: C.herb, fontSize: 12, fontWeight: 600 }}>
          📈 Métabolisme de base dans le temps ›
        </button>
      )}
      {editing && <SessionKcalSheet q={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); onToggle && onToggle(null); }} />}
    </div>
  );
}

/** Corriger les calories d'une séance reçue d'une autre appli (valeur affichée par l'appli de la montre). */
function SessionKcalSheet({ q, onClose, onSaved }) {
  const hc = loadHC();
  const cur = findSessionFix(q, hc)?.kcal;
  const [val, setVal] = useState(cur != null ? String(cur) : "");
  const [scope, setScope] = useState("type");
  const h = q.min / 60;
  const kcal = Number(String(val).replace(",", "."));
  const ok = kcal > 0 && kcal < 5000;
  const newMet = ok && q.kg && h ? Math.round((kcal / (q.kg * h) + 1) * 10) / 10 : null;
  const defMet = SESSION_MET[q.type];
  const curMet = sessionMet(q.type, hc);
  function save() {
    let next = loadHC();
    if (scope === "seance") next = setSessionFix(next, q, { kcal: Math.round(kcal) });
    else {
      next = setSessionFix(next, q, null);
      next = { ...next, sessionMet: { ...(next.sessionMet || {}), [q.type]: Math.min(15, Math.max(1.5, newMet)) } };
    }
    saveHC(next);
    onSaved();
  }
  function ignore() { saveHC(setSessionFix(loadHC(), q, { ignore: true })); onSaved(); }
  function reset() {
    let next = setSessionFix(loadHC(), q, null);
    if (scope === "type") { const sm = { ...(next.sessionMet || {}) }; delete sm[q.type]; next = { ...next, sessionMet: sm }; }
    saveHC(next);
    onSaved();
  }
  const opt = (k, title, sub) => (
    <button onClick={() => setScope(k)} style={{
      width: "100%", textAlign: "left", padding: "10px 12px", borderRadius: 10, marginBottom: 6,
      border: `1.5px solid ${scope === k ? C.herb : C.line}`, background: scope === k ? C.sage : "transparent", color: C.ink,
    }}>
      <span style={{ display: "block", fontSize: 13.5, fontWeight: 600 }}>{title}</span>
      <span style={{ display: "block", fontSize: 11.5, color: C.inkSoft, marginTop: 2 }}>{sub}</span>
    </button>
  );
  return (
    <Sheet title={`${q.label} · ${q.min} min`} onClose={onClose}>
      <p style={{ margin: "0 0 10px", fontSize: 12.5, color: C.inkSoft, lineHeight: 1.5 }}>
        Estimation actuelle : <b style={{ color: C.ink }}>{q.est} kcal</b>{q.manual === "séance" ? " (saisie pour cette séance)" : ` (intensité ${String(curMet).replace(".", ",")} MET${curMet !== defMet ? ", ajustée" : ""})`}.
        {" "}{q.app} n'en a envoyé que {q.rec} à Health Connect.
      </p>
      <label style={{ fontSize: 12, color: C.inkSoft, fontWeight: 600 }}>Calories de la séance affichées par {q.app}</label>
      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "4px 0 12px" }}>
        <input inputMode="numeric" value={val} onChange={(e) => setVal(e.target.value)} placeholder="ex. 140" autoFocus
          style={{ ...inputStyle, flex: 1, padding: "10px 12px", borderRadius: 10, border: `1px solid ${C.line}`, fontFamily: MONO, fontSize: 15 }} />
        <span style={{ fontSize: 13, color: C.inkSoft }}>kcal</span>
      </div>
      {opt("type", `Ajuster toutes mes séances de ${q.label.toLowerCase()}`,
        newMet ? `L'intensité passe de ${String(curMet).replace(".", ",")} à ${String(newMet).replace(".", ",")} MET : les prochaines séances (et celles des 7 derniers jours) sont recalculées.` : "L'intensité est déduite de ta valeur et réutilisée pour les autres séances de ce type.")}
      {opt("seance", "Cette séance seulement", "Les autres séances gardent l'estimation automatique.")}
      <button onClick={save} disabled={!ok} style={{
        width: "100%", marginTop: 6, padding: "12px 0", borderRadius: 12, border: "none", background: ok ? C.herb : C.line, color: C.onAccent, fontWeight: 600, fontSize: 14,
      }}>Enregistrer</button>
      {(q.manual || curMet !== defMet) && (
        <button onClick={reset} style={{ width: "100%", marginTop: 8, padding: "10px 0", borderRadius: 12, border: `1.5px solid ${C.line}`, background: "transparent", color: C.inkSoft, fontWeight: 600, fontSize: 13 }}>
          Revenir à l'estimation automatique{scope === "type" ? ` (${q.label.toLowerCase()})` : ""}
        </button>
      )}
      <button onClick={ignore} style={{ width: "100%", marginTop: 8, padding: "10px 0", borderRadius: 12, border: `1.5px solid ${C.berry}`, background: "transparent", color: C.berry, fontWeight: 600, fontSize: 13 }}>
        C'est un doublon : ignorer cette séance
      </button>
    </Sheet>
  );
}
