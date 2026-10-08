// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Les auteurs de NutriMaison
/* Recettes : liste, Mon frigo, détail, création */
import React, { useState, useEffect, useMemo } from "react";
import { CalendarDays, BookOpen, ChefHat, ChevronLeft, Loader2, Minus, Plus, Salad, Search, ShoppingBag, Trash2, Wallet, X } from "lucide-react";
import { PlanRecipeSheet } from "./Planning.jsx";
import { FridgeAi, FridgeInput, ShoppingList } from "../Fridge.jsx";
import { C, NumInput, SectionTitle, Tag, round } from "../shared.jsx";
import { searchCiqual, useCiqualReady } from "../ciqualDb.js";
import { BRAND_DB, FOOD_DB, MEAL_LABELS, MEAL_ORDER, PANTRY_ITEMS, foodById, ingredientData, matchesQuery, offTextSearch, queryTokens, recipeTotals } from "../foodData.js";

/* ---------------------------------------------------------------- */
/* RECETTES                                                           */
/* ---------------------------------------------------------------- */
export function RecipesView({ recipeTab, setRecipeTab, recipes, pantry, setPantry, onSelect, onNewRecipe, extLoading, extResults, extError, onSearchExternal, onSaveExternalRecipe,
  fridgeExtras, setFridgeExtras, shopping, setShopping, onAddShopping, geminiKey, fridgeCtx, onSaveRecipe, planningView }) {
  const [shopMsg, setShopMsg] = useState(null);
  const shopCount = (shopping || []).filter((i) => !i.done).length;
  const tabs = [
    ["toutes", "Toutes", ChefHat],
    ["pasCher", "Pas chères", Wallet],
    ["ingredients", "Par ingrédients", Salad],
    ["frigo", "Mon frigo" + (shopCount ? ` · 🛒${shopCount}` : ""), ShoppingBag],
    ["mesrecettes", "Mes recettes", BookOpen],
    ["planning", "Semaine", CalendarDays],
  ];
  function togglePantry(id) {
    const next = new Set(pantry);
    next.has(id) ? next.delete(id) : next.add(id);
    setPantry(next);
  }
  return (
    <div style={{ padding: "24px 20px 8px" }}>
      <SectionTitle sub="Repas prêts, économiques, ou selon ce que tu as sous la main.">Recettes</SectionTitle>

      {/* tous les onglets visibles : ils passent sur 2 lignes si l'écran est étroit */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
        {tabs.map(([k, label, Icon]) => (
          <button key={k} onClick={() => setRecipeTab(k)} style={{
            display: "flex", alignItems: "center", gap: 5, padding: "7px 11px", borderRadius: 999,
            border: `1px solid ${recipeTab === k ? C.herb : C.line}`, background: recipeTab === k ? C.herb : C.card,
            color: recipeTab === k ? C.onAccent : C.ink, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap",
          }}>
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {recipeTab === "planning" && planningView}
      {recipeTab !== "planning" && (<>
      {recipeTab === "frigo" && (
        <div style={{ marginBottom: 16 }}>
          <FridgeInput items={PANTRY_ITEMS.map((id) => ({ id, name: foodById[id].name }))}
            pantry={pantry} setPantry={setPantry} extras={fridgeExtras} setExtras={setFridgeExtras} />
          <FridgeAi geminiKey={geminiKey} ctx={fridgeCtx} onAddShopping={onAddShopping} onSaveRecipe={onSaveRecipe}
            have={[...[...pantry].map((id) => foodById[id]?.name).filter(Boolean), ...fridgeExtras]} />
          <ShoppingList list={shopping} setList={setShopping} />
          <p style={{ fontSize: 12, color: C.inkSoft, fontStyle: "italic", marginBottom: 14 }}>
            Recettes de l'appli dont l'essentiel (en poids) vient de ton frigo, avec au plus 3 choses à acheter. Sel, poivre, huile, ail, épices sont supposés dans le placard.
          </p>
        </div>
      )}

      {recipeTab === "ingredients" && (
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 12.5, color: C.inkSoft, marginBottom: 8 }}>Sélectionne ce que tu as dans ton placard :</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
            {PANTRY_ITEMS.map((id) => (
              <button key={id} onClick={() => togglePantry(id)} style={{
                padding: "6px 11px", borderRadius: 999, fontSize: 12,
                border: `1px solid ${pantry.has(id) ? C.olive : C.line}`,
                background: pantry.has(id) ? C.oliveLight : C.card, color: pantry.has(id) ? C.olive : C.inkSoft, fontWeight: 500,
              }}>{foodById[id].name}</button>
            ))}
          </div>

          <p style={{ fontSize: 12, color: C.inkSoft, fontStyle: "italic", marginBottom: 14 }}>
            Les recettes ci-dessous sont triées selon le pourcentage d'ingrédients que tu as déjà.
          </p>

          {pantry.size > 0 && (
            <button onClick={onSearchExternal} disabled={extLoading} style={{
              width: "100%", padding: "12px 0", borderRadius: 12, border: `1.5px solid ${C.herb}`, background: "transparent",
              color: C.herb, fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, marginBottom: 10,
            }}>
              {extLoading ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> : <Search size={15} />}
              {extLoading ? "Recherche en cours…" : "Chercher des idées en ligne (TheMealDB, gratuit)"}
              <style>{"@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}"}</style>
            </button>
          )}
          {extError && <p style={{ fontSize: 12.5, color: C.berry, marginBottom: 10 }}>{extError}</p>}

          {extResults.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: C.inkSoft, textTransform: "uppercase", letterSpacing: 0.3, margin: "0 0 8px" }}>
                Trouvées en ligne (en anglais, sans macros)
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {extResults.map(({ meal, matchCount }) => (
                  <div key={meal.idMeal} style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: 10, display: "flex", gap: 10, alignItems: "center" }}>
                    {meal.strMealThumb && <img src={meal.strMealThumb} alt="" style={{ width: 48, height: 48, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{meal.strMeal}</p>
                      <p style={{ margin: 0, fontSize: 11, color: C.inkSoft }}>{matchCount} ingrédient{matchCount > 1 ? "s" : ""} en commun</p>
                    </div>
                    <button onClick={() => onSaveExternalRecipe(meal)} style={{
                      flexShrink: 0, padding: "7px 10px", borderRadius: 9, border: "none", background: C.herb, color: C.onAccent, fontSize: 11.5, fontWeight: 600,
                    }}>Enregistrer</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {recipeTab === "mesrecettes" && (
        <button onClick={onNewRecipe} style={{
          width: "100%", padding: "12px 0", borderRadius: 12, border: `1.5px dashed ${C.herb}`, background: C.sage,
          color: C.herb, fontWeight: 600, fontSize: 13.5, marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        }}>
          <Plus size={16} /> Créer une recette
        </button>
      )}

      {recipeTab === "ingredients" && pantry.size === 0 && (
        <p style={{ fontSize: 13, color: C.inkSoft, fontStyle: "italic" }}>Sélectionne au moins un ingrédient pour voir des suggestions.</p>
      )}
      {recipeTab === "frigo" && pantry.size === 0 && !fridgeExtras.length && (
        <p style={{ fontSize: 13, color: C.inkSoft, fontStyle: "italic" }}>Sélectionne au moins un ingrédient pour voir des suggestions.</p>
      )}
      {recipeTab === "frigo" && (pantry.size > 0 || fridgeExtras.length > 0) && recipes.length === 0 && (
        <p style={{ fontSize: 13, color: C.inkSoft, fontStyle: "italic" }}>Aucune recette de l'appli ne colle : ajoute quelques aliments{geminiKey ? " ou demande des idées à l'IA" : ""}.</p>
      )}
      {shopMsg && <p style={{ position: "sticky", top: 8, zIndex: 2, background: C.herb, color: C.onAccent, borderRadius: 10, padding: "8px 12px", fontSize: 12.5, margin: "0 0 10px", textAlign: "center" }}>{shopMsg}</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {recipes.map((r) => {
          const tot = recipeTotals(r);
          const per = tot.kcal / r.servings;
          return (
            <button key={r.id} onClick={() => onSelect(r, r.custom)} style={{
              textAlign: "left", background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: 14,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <p style={{ margin: 0, fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: 15.5 }}>{r.name}</p>
                <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, color: C.inkSoft, flexShrink: 0, marginLeft: 8 }}>
                  {r.noNutrition ? "Sans macros" : Math.round(per) + " kcal/portion"}
                </span>
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                <Tag color={C.herbLight} bg={C.sage}>{r.categorie}</Tag>
                {r.pasCher && <Tag color={C.olive} bg={C.oliveLight}>Pas cher</Tag>}
                {(recipeTab === "ingredients" || recipeTab === "frigo") && r.matchPct !== undefined && (
                  <Tag color={C.ochre} bg={C.ochreLight}>{recipeTab === "frigo" ? (!r.missing?.length ? "Tu as tout ✓" : `${Math.round(r.matchPct * 100)} % du plat`) : `${Math.round(r.matchPct * 100)} % des ingrédients`}</Tag>
                )}
              </div>
              {recipeTab === "frigo" && r.using?.length > 0 && (
                <p style={{ margin: "8px 0 0", fontSize: 12, color: C.inkSoft }}><span style={{ color: C.olive, fontWeight: 600 }}>Avec ton frigo : </span>{r.using.join(", ")}</p>
              )}
              {recipeTab === "frigo" && r.missing?.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                  <p style={{ margin: 0, flex: 1, fontSize: 12, color: C.inkSoft }}><span style={{ color: C.berry, fontWeight: 600 }}>À acheter : </span>{r.missing.join(", ")}</p>
                  <span role="button" tabIndex={0} onClick={(ev) => {
                    ev.stopPropagation(); onAddShopping(r.missing, r.name);
                    setShopMsg(`Ajouté à la liste de courses ✓`); setTimeout(() => setShopMsg(null), 1600);
                  }} style={{ flexShrink: 0, padding: "6px 10px", borderRadius: 9, border: `1px solid ${C.herb}`, color: C.herb, fontSize: 11.5, fontWeight: 600, background: C.card }}>+ 🛒</span>
                </div>
              )}
            </button>
          );
        })}
        {recipes.length === 0 && recipeTab !== "ingredients" && recipeTab !== "frigo" && (
          <p style={{ fontSize: 13, color: C.inkSoft, fontStyle: "italic" }}>Aucune recette pour l'instant.</p>
        )}
      </div>
      </>)}
    </div>
  );
}

export function RecipeDetail({ recipe, isCustom, servingsToAdd, setServingsToAdd, onBack, onAdd, onDelete, showAddMealPicker, addMeal, setAddMeal, onPlan }) {
  const [planOpen, setPlanOpen] = useState(false);
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
        <Tag color={C.herbLight} bg={C.sage}>{recipe.categorie}</Tag>
        {recipe.pasCher && <Tag color={C.olive} bg={C.oliveLight}>Pas cher</Tag>}
        <Tag color={C.inkSoft} bg={C.paperDark}>{recipe.servings} portion{recipe.servings > 1 ? "s" : ""}</Tag>
      </div>

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

export function RecipeBuilder({ name, setName, servings, setServings, pasCher, setPasCher, ingredients, setIngredients, onAddIngredient, onSave, onCancel, customFoods }) {
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

      <button onClick={onSave} style={{ width: "100%", padding: "13px 0", borderRadius: 12, border: "none", background: C.herb, color: C.onAccent, fontWeight: 600, fontSize: 14 }}>
        Enregistrer la recette
      </button>
    </div>
  );
}
