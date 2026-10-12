// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Les auteurs de NutriMaison
/* Recettes : liste, Mon frigo, détail, création */
import React, { useState, useEffect, useMemo } from "react";
import { CalendarDays, BookOpen, ChefHat, ChevronLeft, Loader2, Minus, Plus, Salad, Search, ShoppingBag, Trash2, Wallet, X } from "lucide-react";
import { PlanRecipeSheet } from "./Planning.jsx";
import { FridgeAi, FridgeInput, ShoppingList } from "../Fridge.jsx";
import { C, NumInput, SectionTitle, Tag, round } from "../shared.jsx";
import { searchCiqual, useCiqualReady } from "../ciqualDb.js";
import { BRAND_DB, FOOD_DB, MEAL_LABELS, MEAL_ORDER, PANTRY_ITEMS, foodById, ingredientData, matchesQuery, offTextSearch, queryTokens, recipeTotals, recipeCat, recipeOrigin, RECIPE_CATS, recipeMeals, defaultMealsForCat } from "../foodData.js";
import { CatPicker, MealsPicker } from "../CatPicker.jsx";

/* ---------------------------------------------------------------- */
/* RECETTES : 3 onglets — Mes recettes · Idées · Semaine              */
/* ---------------------------------------------------------------- */
const RMONO = "'IBM Plex Mono',monospace";
const nrm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const shortCat = (c) => (/^Idée du frigo/.test(c) ? "Idée du frigo" : /^Recette en ligne/.test(c) ? "En ligne" : c === "Ma recette" ? "Perso" : c);

function ago(d) {
  if (!d) return null;
  const days = Math.round((new Date(new Date().toDateString()) - new Date(d + "T00:00:00")) / 86400000);
  return days <= 0 ? "aujourd'hui" : days === 1 ? "hier" : `il y a ${days} j`;
}

function chipStyle(active) {
  return {
    padding: "6px 11px", borderRadius: 999, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap",
    border: `1px solid ${active ? C.herb : C.line}`, background: active ? C.herb : C.card, color: active ? C.onAccent : C.ink,
  };
}

/** Carte d'une recette (liste). */
export function RecipeCard({ r, usage, onSelect, extra }) {
  const per = r.noNutrition ? null : Math.round(recipeTotals(r).kcal / (r.servings || 1));
  const u = usage?.[r.name];
  return (
    <button onClick={() => onSelect(r, r.custom)} style={{
      textAlign: "left", background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: "12px 14px", color: C.ink, width: "100%",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <p style={{ margin: 0, fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: 15 }}>{r.name}</p>
        <span style={{ fontFamily: RMONO, fontSize: 11.5, color: C.inkSoft, flexShrink: 0 }}>{per != null ? `${per} kcal` : "sans macros"}</span>
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap", alignItems: "center" }}>
        <Tag color={C.herbLight} bg={C.sage}>{recipeCat(r)}</Tag>
        {r.custom && <Tag color={C.inkSoft} bg={C.paperDark}>{recipeOrigin(r)}</Tag>}
        {r.custom && <span style={{ fontSize: 11, color: C.inkSoft }}>{recipeMeals(r).map((m) => MEAL_LABELS[m].replace("Petit-déjeuner", "Petit-déj")).join(" · ")}</span>}
        {r.pasCher && <Tag color={C.olive} bg={C.oliveLight}>Pas cher</Tag>}
        {u && <span style={{ fontSize: 11, color: C.inkSoft }}>· notée {u.count}× · {ago(u.last)}</span>}
      </div>
      {extra}
    </button>
  );
}

export function RecipesView({ recipeTab, setRecipeTab, allRecipes, frigoRecipes, usage, pantry, setPantry, onSelect, onNewRecipe,
  extLoading, extResults, extError, onSearchExternal, onSaveExternalRecipe,
  fridgeExtras, setFridgeExtras, shopping, setShopping, onAddShopping, geminiKey, fridgeCtx, onSaveRecipe, planningView, onAddToMeal }) {
  const tab = ["mes", "idees", "semaine"].includes(recipeTab) ? recipeTab : "idees";
  const [q, setQ] = useState("");
  const [mineCat, setMineCat] = useState("Toutes");
  const [ideaCat, setIdeaCat] = useState("Toutes");
  const [withFridge, setWithFridge] = useState(false);
  const [fridgeOpen, setFridgeOpen] = useState(true);
  const [shopMsg, setShopMsg] = useState(null);
  const shopCount = (shopping || []).filter((i) => !i.done).length;
  const haveCount = pantry.size + (fridgeExtras || []).length;

  const mine = useMemo(() => allRecipes.filter((r) => r.custom).sort((a, b) =>
    (usage?.[b.name]?.count || 0) - (usage?.[a.name]?.count || 0) || (usage?.[b.name]?.last || "").localeCompare(usage?.[a.name]?.last || "") || a.name.localeCompare(b.name, "fr")), [allRecipes, usage]);
  const copiedIds = useMemo(() => new Set(allRecipes.filter((r) => r.custom && r.fromId).map((r) => r.fromId)), [allRecipes]);
  const builtin = useMemo(() => allRecipes.filter((r) => !r.custom), [allRecipes]);
  const mineCats = ["Toutes", ...MEAL_ORDER.filter((m) => mine.some((r) => recipeMeals(r).includes(m))).map((m) => MEAL_LABELS[m])];
  const mealOfLabel = Object.fromEntries(MEAL_ORDER.map((m) => [MEAL_LABELS[m], m]));
  const ideaCats = ["Toutes", "Pas chères", ...new Set(builtin.map((r) => r.categorie))];

  const tabs = [["mes", `Mes recettes${mine.length ? ` (${mine.length})` : ""}`, BookOpen], ["idees", "Idées", ChefHat], ["semaine", `Semaine${shopCount ? ` · 🛒${shopCount}` : ""}`, CalendarDays]];
  const t = nrm(q).trim();
  const flash = (m) => { setShopMsg(m); setTimeout(() => setShopMsg(null), 1600); };

  return (
    <div style={{ padding: "24px 20px 8px" }}>
      <SectionTitle sub="Tes recettes, des idées, et ta semaine de repas.">Recettes</SectionTitle>

      <div style={{ position: "relative", marginBottom: 12 }}>
        <Search size={16} color={C.inkSoft} style={{ position: "absolute", left: 12, top: 12 }} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher dans toutes les recettes…"
          style={{ width: "100%", padding: "11px 34px 11px 36px", borderRadius: 12, border: `1px solid ${C.line}`, background: C.card, fontSize: 14, outline: "none", color: C.ink }} />
        {q && <button onClick={() => setQ("")} aria-label="Effacer" style={{ position: "absolute", right: 8, top: 8, background: "none", border: "none", color: C.inkSoft, padding: 4 }}><X size={16} /></button>}
      </div>

      {t ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {(() => {
            const found = [...mine, ...builtin].filter((r) => nrm(r.name).includes(t) || nrm(recipeCat(r)).includes(t));
            return found.length ? found.map((r) => <RecipeCard key={r.id} r={r} usage={usage} onSelect={onSelect} />)
              : <p style={{ fontSize: 13, color: C.inkSoft, fontStyle: "italic" }}>Aucune recette ne correspond.</p>;
          })()}
        </div>
      ) : (<>
        <div style={{ display: "flex", gap: 4, background: C.paperDark, borderRadius: 12, padding: 4, marginBottom: 14 }}>
          {tabs.map(([k, label, Icon]) => (
            <button key={k} onClick={() => setRecipeTab(k)} style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "8px 4px", borderRadius: 9, border: "none",
              background: tab === k ? C.card : "transparent", color: tab === k ? C.herb : C.inkSoft, fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap",
            }}><Icon size={14} /> {label}</button>
          ))}
        </div>
        {shopMsg && <p style={{ position: "sticky", top: 8, zIndex: 2, background: C.herb, color: C.onAccent, borderRadius: 10, padding: "8px 12px", fontSize: 12.5, margin: "0 0 10px", textAlign: "center" }}>{shopMsg}</p>}

        {tab === "mes" && (
          <div>
            <button onClick={onNewRecipe} style={{
              width: "100%", padding: "11px 0", borderRadius: 12, border: `1.5px dashed ${C.herb}`, background: C.sage,
              color: C.herb, fontWeight: 600, fontSize: 13.5, marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}><Plus size={16} /> Créer une recette</button>
            {mineCats.length > 1 && mine.length > 1 && (
              <div className="scrollx" style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                {mineCats.map((c) => <button key={c} onClick={() => setMineCat(c)} style={chipStyle(mineCat === c)}>{c}</button>)}
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {mine.filter((r) => mineCat === "Toutes" || recipeMeals(r).includes(mealOfLabel[mineCat])).map((r) => <RecipeCard key={r.id} r={r} usage={usage} onSelect={onSelect} />)}
            </div>
            {mine.length === 0 && (
              <p style={{ fontSize: 12.5, color: C.inkSoft, lineHeight: 1.5 }}>
                Pas encore de recette perso. Crée-la ici, ou enregistre-la depuis Ajouter → Texte IA, ou depuis une idée du frigo dans « Idées ».
              </p>
            )}
            {mine.length > 0 && <p style={{ fontSize: 11, color: C.inkSoft, margin: "10px 0 0" }}>Les plus notées dans ton journal en premier.</p>}
          </div>
        )}

        {tab === "idees" && (
          <div>
            <button onClick={() => setWithFridge(!withFridge)} style={{
              width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12, marginBottom: 12, textAlign: "left",
              border: `1.5px solid ${withFridge ? C.olive : C.line}`, background: withFridge ? C.oliveLight : C.card, color: C.ink,
            }}>
              <span style={{ width: 38, height: 22, borderRadius: 999, background: withFridge ? C.olive : C.line, position: "relative", flexShrink: 0 }}>
                <span style={{ position: "absolute", top: 3, left: withFridge ? 19 : 3, width: 16, height: 16, borderRadius: 999, background: C.onHero, transition: "left .2s" }} />
              </span>
              <span style={{ flex: 1 }}>
                <span style={{ display: "block", fontSize: 13.5, fontWeight: 600 }}>Avec ce que j'ai dans mon frigo</span>
                <span style={{ display: "block", fontSize: 11.5, color: C.inkSoft }}>{haveCount ? `${haveCount} aliment${haveCount > 1 ? "s" : ""} noté${haveCount > 1 ? "s" : ""}` : "Coche ce que tu as : les recettes faisables d'abord"}</span>
              </span>
            </button>

            {!withFridge && (<>
              <div className="scrollx" style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                {ideaCats.map((c) => <button key={c} onClick={() => setIdeaCat(c)} style={chipStyle(ideaCat === c)}>{c}</button>)}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {builtin.filter((r) => ideaCat === "Toutes" || (ideaCat === "Pas chères" ? r.pasCher : r.categorie === ideaCat))
                  .map((r) => <RecipeCard key={r.id} r={r} usage={usage} onSelect={onSelect} />)}
              </div>
            </>)}

            {withFridge && (<>
              <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: "10px 12px", marginBottom: 12 }}>
                <button onClick={() => setFridgeOpen(!fridgeOpen)} style={{ width: "100%", display: "flex", justifyContent: "space-between", background: "none", border: "none", padding: 0, color: C.ink }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>Mon frigo ({haveCount})</span>
                  <span style={{ fontSize: 12, color: C.herb, fontWeight: 600 }}>{fridgeOpen ? "Replier" : "Modifier"}</span>
                </button>
                {fridgeOpen && (
                  <div style={{ marginTop: 8 }}>
                    <FridgeInput items={PANTRY_ITEMS.map((id) => ({ id, name: foodById[id].name }))}
                      pantry={pantry} setPantry={setPantry} extras={fridgeExtras} setExtras={setFridgeExtras} />
                  </div>
                )}
              </div>
              <FridgeAi geminiKey={geminiKey} ctx={fridgeCtx} onAddShopping={(n, f) => { onAddShopping(n, f); flash("Ajouté à la liste de courses (onglet Semaine) ✓"); }} onSaveRecipe={onSaveRecipe}
                onAddToMeal={(meal, entries) => { onAddToMeal(meal, entries); flash("Ajouté au journal ✓"); }}
                have={[...[...pantry].map((id) => foodById[id]?.name).filter(Boolean), ...fridgeExtras]} />
              {haveCount === 0 && <p style={{ fontSize: 13, color: C.inkSoft, fontStyle: "italic" }}>Coche au moins un aliment pour voir les recettes faisables.</p>}
              {haveCount > 0 && frigoRecipes.length === 0 && (
                <p style={{ fontSize: 13, color: C.inkSoft, fontStyle: "italic" }}>Aucune recette de l'appli ne colle : ajoute quelques aliments{geminiKey ? " ou demande des idées à l'IA" : ""}.</p>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {frigoRecipes.map((r) => (
                  <RecipeCard key={r.id} r={r} usage={usage} onSelect={onSelect} extra={<>
                    <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                      <Tag color={C.ochre} bg={C.ochreLight}>{!r.missing?.length ? "Tu as tout ✓" : `${Math.round(r.matchPct * 100)} % du plat`}</Tag>
                    </div>
                    {r.using?.length > 0 && <p style={{ margin: "6px 0 0", fontSize: 12, color: C.inkSoft }}><span style={{ color: C.olive, fontWeight: 600 }}>Avec ton frigo : </span>{r.using.join(", ")}</p>}
                    {r.missing?.length > 0 && (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                        <p style={{ margin: 0, flex: 1, fontSize: 12, color: C.inkSoft }}><span style={{ color: C.berry, fontWeight: 600 }}>À acheter : </span>{r.missing.join(", ")}</p>
                        <span role="button" tabIndex={0} onClick={(ev) => { ev.stopPropagation(); onAddShopping(r.missing, r.name); flash("Ajouté à la liste de courses (onglet Semaine) ✓"); }}
                          style={{ flexShrink: 0, padding: "6px 10px", borderRadius: 9, border: `1px solid ${C.herb}`, color: C.herb, fontSize: 11.5, fontWeight: 600, background: C.card }}>+ 🛒</span>
                      </div>
                    )}
                  </>} />
                ))}
              </div>
              {pantry.size > 0 && (
                <button onClick={onSearchExternal} disabled={extLoading} style={{
                  width: "100%", padding: "11px 0", borderRadius: 12, border: `1.5px solid ${C.herb}`, background: "transparent", marginTop: 12,
                  color: C.herb, fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                }}>
                  {extLoading ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> : <Search size={15} />}
                  {extLoading ? "Recherche en cours…" : "Plus d'idées en ligne (TheMealDB, gratuit)"}
                  <style>{"@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}"}</style>
                </button>
              )}
              {extError && <p style={{ fontSize: 12.5, color: C.berry, margin: "8px 0" }}>{extError}</p>}
              {extResults.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: C.inkSoft, textTransform: "uppercase", letterSpacing: 0.3, margin: 0 }}>Trouvées en ligne (en anglais, sans macros)</p>
                  {extResults.map(({ meal, matchCount }) => (
                    <div key={meal.idMeal} style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: 10, display: "flex", gap: 10, alignItems: "center" }}>
                      {meal.strMealThumb && <img src={meal.strMealThumb} alt="" style={{ width: 48, height: 48, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{meal.strMeal}</p>
                        <p style={{ margin: 0, fontSize: 11, color: C.inkSoft }}>{matchCount} ingrédient{matchCount > 1 ? "s" : ""} en commun</p>
                      </div>
                      <button onClick={() => onSaveExternalRecipe(meal)} style={{ flexShrink: 0, padding: "7px 10px", borderRadius: 9, border: "none", background: C.herb, color: C.onAccent, fontSize: 11.5, fontWeight: 600 }}>Enregistrer</button>
                    </div>
                  ))}
                </div>
              )}
            </>)}
          </div>
        )}

        {tab === "semaine" && (
          <div>
            {planningView}
            <div style={{ marginTop: 16 }}><ShoppingList list={shopping} setList={setShopping} /></div>
          </div>
        )}
      </>)}
    </div>
  );
}

export function RecipeDetail({ recipe, isCustom, servingsToAdd, setServingsToAdd, onBack, onAdd, onDelete, showAddMealPicker, addMeal, setAddMeal, onPlan, onChangeCat,
  onChangeMeals, onCopyToMine, alreadyMine }) {
  const [planOpen, setPlanOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyMeals, setCopyMeals] = useState(() => recipeMeals(recipe));
  const [copied, setCopied] = useState(false);
  const tot = recipeTotals(recipe);
  const per = { kcal: tot.kcal / recipe.servings, prot: tot.prot / recipe.servings, carbs: tot.carbs / recipe.servings, fat: tot.fat / recipe.servings };
  return (
    <div style={{ padding: "24px 20px 8px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: C.herb, padding: 6, display: "flex" }}>
          <ChevronLeft size={20} />
        </button>
        {isCustom && onDelete && (
          <button onClick={onDelete} style={{ background: "none", border: "none", color: C.berry, padding: 6 }}><Trash2 size={17} /></button>
        )}
      </div>
      <h2 style={{ fontFamily: "'Fraunces',serif", fontWeight: 700, fontSize: 22, margin: "0 0 6px" }}>{recipe.name}</h2>
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        <Tag color={C.herbLight} bg={C.sage}>{recipeCat(recipe)}</Tag>
        {recipe.pasCher && <Tag color={C.olive} bg={C.oliveLight}>Pas cher</Tag>}
        <Tag color={C.inkSoft} bg={C.paperDark}>{recipe.servings} portion{recipe.servings > 1 ? "s" : ""}</Tag>
      </div>

      {onChangeCat && <CatPicker value={recipeCat(recipe)} onChange={(c) => { onChangeCat(c); if (!Array.isArray(recipe.repas) && onChangeMeals) onChangeMeals(defaultMealsForCat(c)); }} label="Ranger cette recette dans" />}
      {onChangeMeals && <MealsPicker value={recipeMeals(recipe)} onChange={onChangeMeals} />}
      {!isCustom && onCopyToMine && (
        alreadyMine || copied ? (
          <p style={{ margin: "0 0 14px", fontSize: 12.5, color: C.herb, fontWeight: 600 }}>★ Dans Mes recettes</p>
        ) : !copyOpen ? (
          <button onClick={() => setCopyOpen(true)} style={{
            width: "100%", padding: "10px 0", borderRadius: 12, border: `1.5px solid ${C.herb}`, background: "transparent", color: C.herb, fontWeight: 600, fontSize: 13.5, marginBottom: 14,
          }}>★ Ajouter à mes recettes</button>
        ) : (
          <div style={{ background: C.card, border: `1px solid ${C.herb}`, borderRadius: 14, padding: 12, marginBottom: 14 }}>
            <MealsPicker value={copyMeals} onChange={setCopyMeals} label="La garder dans mes recettes pour" />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setCopyOpen(false)} style={{ flex: 1, padding: "9px 0", borderRadius: 10, border: `1px solid ${C.line}`, background: C.card, color: C.inkSoft, fontSize: 13 }}>Annuler</button>
              <button onClick={() => { onCopyToMine(recipe, copyMeals); setCopied(true); setCopyOpen(false); }} style={{ flex: 2, padding: "9px 0", borderRadius: 10, border: "none", background: C.herb, color: C.onAccent, fontWeight: 600, fontSize: 13 }}>Ajouter à mes recettes</button>
            </div>
          </div>
        )
      )}
      {recipe.image && (
        <img src={recipe.image} alt="" style={{ width: "100%", borderRadius: 14, marginBottom: 16, border: `1px solid ${C.line}` }} />
      )}

      <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: 16, marginBottom: 18 }}>
        {recipe.noNutrition ? (
          <p style={{ margin: 0, fontSize: 12.5, color: C.inkSoft, fontStyle: "italic" }}>
            Valeurs nutritionnelles non disponibles pour cette recette (source externe, sans macros fournies).
          </p>
        ) : (
          <>
            <p style={{ margin: "0 0 10px", fontSize: 12.5, color: C.inkSoft }}>Par portion</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Tag color={C.herb} bg={C.sage}>{Math.round(per.kcal)} kcal</Tag>
              <Tag color={C.berry} bg={C.berryLight}>P {round(per.prot)}g</Tag>
              <Tag color={C.ochre} bg={C.ochreLight}>G {round(per.carbs)}g</Tag>
              <Tag color={C.olive} bg={C.oliveLight}>L {round(per.fat)}g</Tag>
            </div>
          </>
        )}
      </div>

      <p style={{ fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: 15, margin: "0 0 8px" }}>Ingrédients</p>
      <div style={{ marginBottom: 18 }}>
        {recipe.aiIngredientsText ? (
          recipe.aiIngredientsText.map((txt, i) => (
            <p key={i} style={{ margin: "0 0 5px", fontSize: 13.5 }}>• {txt}</p>
          ))
        ) : (
          recipe.ingredients.map((ing, i) => {
            const d = ingredientData(ing);
            return (
              <p key={i} style={{ margin: "0 0 5px", fontSize: 13.5, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ color: C.inkSoft, fontFamily: "'IBM Plex Mono',monospace", fontSize: 12 }}>{d.grams}g</span> — {d.name}
                {d.brand && <ShoppingBag size={11} color={C.inkSoft} />}
              </p>
            );
          })
        )}
      </div>

      {recipe.steps && recipe.steps.length > 0 && (
        <>
          <p style={{ fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: 15, margin: "0 0 8px" }}>Préparation</p>
          <ol style={{ margin: "0 0 18px", paddingLeft: 18 }}>
            {recipe.steps.map((s, i) => <li key={i} style={{ fontSize: 13.5, marginBottom: 6, color: C.ink }}>{s}</li>)}
          </ol>
        </>
      )}

      {showAddMealPicker && (
        <div style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 12, color: C.inkSoft, marginBottom: 6 }}>Repas</p>
          <div className="scrollx" style={{ display: "flex", gap: 8, overflowX: "auto" }}>
            {MEAL_ORDER.map((m) => (
              <button key={m} onClick={() => setAddMeal(m)} style={{
                flexShrink: 0, padding: "7px 14px", borderRadius: 999, border: `1px solid ${addMeal === m ? C.herb : C.line}`,
                background: addMeal === m ? C.herb : C.card, color: addMeal === m ? C.onAccent : C.ink, fontSize: 12.5, fontWeight: 500,
              }}>{MEAL_LABELS[m]}</button>
            ))}
          </div>
        </div>
      )}

      {!recipe.noNutrition && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <span style={{ fontSize: 13, color: C.inkSoft }}>Portions à ajouter</span>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: "auto" }}>
              <button onClick={() => setServingsToAdd(Math.max(0.5, servingsToAdd - 0.5))} style={{ width: 28, height: 28, borderRadius: 999, border: `1px solid ${C.line}`, background: C.card }}><Minus size={13} /></button>
              <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontWeight: 600, minWidth: 24, textAlign: "center" }}>{servingsToAdd}</span>
              <button onClick={() => setServingsToAdd(servingsToAdd + 0.5)} style={{ width: 28, height: 28, borderRadius: 999, border: `1px solid ${C.line}`, background: C.card }}><Plus size={13} /></button>
            </div>
          </div>

          <button onClick={onAdd} style={{ width: "100%", padding: "13px 0", borderRadius: 12, border: "none", background: C.herb, color: C.onAccent, fontWeight: 600, fontSize: 14 }}>
            Ajouter au journal
          </button>
          {onPlan && (
            <button onClick={() => setPlanOpen(true)} style={{ width: "100%", marginTop: 8, padding: "11px 0", borderRadius: 12, border: `1.5px solid ${C.herb}`, background: "transparent", color: C.herb, fontWeight: 600, fontSize: 13.5 }}>
              📅 Planifier un autre jour
            </button>
          )}
          {planOpen && <PlanRecipeSheet recipe={recipe} servings={servingsToAdd} onPlan={onPlan} onClose={() => setPlanOpen(false)} />}
        </>
      )}
      {recipe.noNutrition && (
        <p style={{ fontSize: 11.5, color: C.inkSoft, fontStyle: "italic", margin: 0 }}>
          Cette recette vient d'une source externe (TheMealDB) sans valeurs nutritionnelles — elle n'est donc pas ajoutable directement au journal. Utilise-la comme inspiration, ou ajoute ses ingrédients un par un via la saisie manuelle.
        </p>
      )}
    </div>
  );
}

export function RecipeBuilder({ name, setName, servings, setServings, pasCher, setPasCher, ingredients, setIngredients, onAddIngredient, onSave, onCancel, customFoods, cat, setCat }) {
  const [pickerKey, setPickerKey] = useState(null);
  const [pickerQuery, setPickerQuery] = useState("");
  const [pickerOffResults, setPickerOffResults] = useState([]);
  const [pickerOffLoading, setPickerOffLoading] = useState(false);

  useEffect(() => {
    const q = pickerQuery.trim().toLowerCase();
    if (q.length < 2) { setPickerOffResults([]); setPickerOffLoading(false); return; }
    const tokens = queryTokens(q);
    const staticMatches = [...(customFoods || []), ...BRAND_DB].filter((f) => matchesQuery(f.name, tokens));
    setPickerOffResults(staticMatches);
    setPickerOffLoading(true);
    const handle = setTimeout(async () => {
      const products = await offTextSearch(q, 12);
      setPickerOffResults((prev) => {
        const ids = new Set(prev.map((p) => p.id));
        return [...prev, ...products.filter((p) => !ids.has(p.id))].slice(0, 20);
      });
      setPickerOffLoading(false);
    }, 450);
    return () => clearTimeout(handle);
  }, [pickerQuery, customFoods]);

  const ciqualReady = useCiqualReady();
  const localMatches = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    if (q && ciqualReady) return [...searchCiqual(q, 15), ...FOOD_DB.filter((f) => f.id.startsWith("x_") && matchesQuery(f.name, queryTokens(q)))].slice(0, 20);
    return (q ? FOOD_DB.filter((f) => matchesQuery(f.name, queryTokens(q))) : FOOD_DB).slice(0, 8);
  }, [pickerQuery, ciqualReady]);

  function updateGrams(key, value) {
    setIngredients(ingredients.map((i) => (i.key === key ? { ...i, grams: value } : i)));
  }
  function removeIng(key) { setIngredients(ingredients.filter((i) => i.key !== key)); }
  function togglePicker(key) {
    setPickerKey(pickerKey === key ? null : key);
    setPickerQuery("");
    setPickerOffResults([]);
  }
  function pickFood(key, food) {
    const isBrand = !foodById[food.id];
    setIngredients(ingredients.map((i) => (i.key === key ? {
      ...i, foodId: isBrand ? null : food.id, name: food.name,
      kcal100: food.kcal, prot100: food.prot, carbs100: food.carbs, fat100: food.fat, brand: isBrand,
    } : i)));
    setPickerKey(null); setPickerQuery(""); setPickerOffResults([]);
  }

  return (
    <div style={{ padding: "24px 20px 8px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <button onClick={onCancel} style={{ background: "none", border: "none", color: C.herb, padding: 6 }}><ChevronLeft size={20} /></button>
        <h2 style={{ margin: 0, fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: 20 }}>Nouvelle recette</h2>
      </div>

      <label style={{ fontSize: 12, color: C.inkSoft }}>Nom de la recette</label>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex : Poêlée maison"
        style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${C.line}`, marginTop: 4, marginBottom: 14, fontSize: 14 }} />

      <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 12, color: C.inkSoft }}>Portions</label>
          <NumInput min={1} decimals={false} value={servings} onChange={(v) => setServings(v)}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${C.line}`, marginTop: 4, fontFamily: "'IBM Plex Mono',monospace" }} />
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 20 }}>
          <input type="checkbox" checked={pasCher} onChange={(e) => setPasCher(e.target.checked)} />
          <span style={{ fontSize: 13 }}>Recette pas chère</span>
        </label>
      </div>

      <p style={{ fontSize: 12, color: C.inkSoft, marginBottom: 8 }}>Ingrédients</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
        {ingredients.map((ing) => (
          <div key={ing.key} style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ing.name}</p>
                <p style={{ margin: 0, fontSize: 11, color: C.inkSoft, fontFamily: "'IBM Plex Mono',monospace" }}>
                  {Math.round(ing.kcal100)} kcal/100g{ing.brand ? " · marque" : ""}
                </p>
              </div>
              <input type="number" value={ing.grams} onChange={(e) => updateGrams(ing.key, e.target.value)}
                style={{ width: 58, padding: "7px 6px", borderRadius: 8, border: `1px solid ${C.line}`, fontFamily: "'IBM Plex Mono',monospace", fontSize: 12 }} />
              <span style={{ fontSize: 11, color: C.inkSoft }}>g</span>
              <button onClick={() => togglePicker(ing.key)} style={{
                background: pickerKey === ing.key ? C.herb : C.sage, border: "none", borderRadius: 8, padding: "7px 8px",
                color: pickerKey === ing.key ? C.onAccent : C.herb, display: "flex",
              }}><Search size={13} /></button>
              <button onClick={() => removeIng(ing.key)} style={{ background: "none", border: "none", color: C.berry }}><X size={15} /></button>
            </div>

            {pickerKey === ing.key && (
              <div style={{ marginTop: 10, borderTop: `1px solid ${C.line}`, paddingTop: 10 }}>
                <input
                  value={pickerQuery} onChange={(e) => setPickerQuery(e.target.value)} autoFocus
                  placeholder="Rechercher un aliment ou une marque…"
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${C.line}`, fontSize: 12.5, marginBottom: 8 }}
                />
                <p style={{ fontSize: 10.5, fontWeight: 600, color: C.inkSoft, textTransform: "uppercase", letterSpacing: 0.3, margin: "0 0 4px" }}>Aliments de base</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8, maxHeight: 130, overflowY: "auto" }}>
                  {localMatches.map((f) => (
                    <button key={f.id} onClick={() => pickFood(ing.key, f)} style={{
                      textAlign: "left", background: C.paper, border: "none", borderRadius: 6, padding: "6px 8px", fontSize: 12,
                    }}>{f.name}</button>
                  ))}
                  {localMatches.length === 0 && <p style={{ fontSize: 11, color: C.inkSoft, fontStyle: "italic", margin: 0 }}>Aucun résultat.</p>}
                </div>
                {pickerQuery.trim().length >= 2 && (
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, margin: "0 0 4px" }}>
                      <ShoppingBag size={11} color={C.inkSoft} />
                      <p style={{ fontSize: 10.5, fontWeight: 600, color: C.inkSoft, textTransform: "uppercase", letterSpacing: 0.3, margin: 0 }}>Produits de marque</p>
                      {pickerOffLoading && <Loader2 size={11} color={C.inkSoft} style={{ animation: "spin 1s linear infinite" }} />}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 140, overflowY: "auto" }}>
                      {pickerOffResults.map((f) => (
                        <button key={f.id} onClick={() => pickFood(ing.key, f)} style={{
                          textAlign: "left", background: C.paper, border: "none", borderRadius: 6, padding: "6px 8px", fontSize: 12,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>{f.name}</button>
                      ))}
                      {!pickerOffLoading && pickerOffResults.length === 0 && (
                        <p style={{ fontSize: 11, color: C.inkSoft, fontStyle: "italic", margin: 0 }}>Aucun produit trouvé.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      <button onClick={onAddIngredient} style={{
        width: "100%", padding: "10px 0", borderRadius: 10, border: `1.5px dashed ${C.line}`, background: "transparent",
        color: C.herb, fontSize: 12.5, fontWeight: 600, marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
      }}>
        <Plus size={14} /> Ajouter un ingrédient
      </button>

      {setCat && <CatPicker value={cat} onChange={setCat} />}
      <button onClick={onSave} style={{ width: "100%", padding: "13px 0", borderRadius: 12, border: "none", background: C.herb, color: C.onAccent, fontWeight: 600, fontSize: 14 }}>
        Enregistrer la recette
      </button>
    </div>
  );
}
