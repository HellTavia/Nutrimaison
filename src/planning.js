// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Les auteurs de NutriMaison
/* ================================================================== */
/* PLANNING DE LA SEMAINE                                              */
/* mealPlan = { "AAAA-MM-JJ": { petitdej: [item], dejeuner: [...] } }  */
/* Un item garde une « photo » des valeurs : si la recette est         */
/* modifiée ou supprimée ensuite, le planning reste juste.             */
/* ================================================================== */
import { loadJSON, saveJSON, round, uid } from "./shared.jsx";
import { recipeTotals, ingredientData, recipeWaterPerServing, norm, STAPLES_RE, fridgeMatchers } from "./foodData.js";

const KEY = "mealPlan";
export function loadPlan() { return loadJSON(KEY, {}); }
export function savePlan(p) {
  // on oublie les jours de plus de 60 jours
  const limit = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10);
  const clean = Object.fromEntries(Object.entries(p).filter(([d]) => d >= limit));
  saveJSON(KEY, clean);
  return clean;
}

export function planItemFromRecipe(recipe, servings) {
  const tot = recipeTotals(recipe);
  const f = servings / (recipe.servings || 1);
  const wps = recipeWaterPerServing(recipe);
  return {
    id: uid(), kind: "recipe", recipeId: recipe.id, name: recipe.name, servings,
    kcal: round(tot.kcal * f), prot: round(tot.prot * f), carbs: round(tot.carbs * f), fat: round(tot.fat * f),
    ...(wps != null ? { water: Math.round(wps * servings) } : {}),
    ingredients: (recipe.ingredients || []).map((ing) => { const d = ingredientData(ing); return { name: d.name, grams: Math.round((Number(d.grams) || 0) * f) }; }),
    done: false,
  };
}

export function planItemFromTemplate(t) {
  const sum = (k) => round(t.items.reduce((a, e) => a + (Number(e[k]) || 0), 0));
  return {
    id: uid(), kind: "template", name: t.name, kcal: sum("kcal"), prot: sum("prot"), carbs: sum("carbs"), fat: sum("fat"),
    entries: t.items, ingredients: t.items.map((e) => ({ name: e.name, grams: Number(e.grams) || 0 })), done: false,
  };
}

/** Ce qui sera noté dans le journal pour cet item. */
export function planItemToEntries(item) {
  if (item.kind === "template") return item.entries.map(({ id, ...e }) => ({ ...e, id: uid(), source: "planning" }));
  const s = item.servings;
  return [{
    id: uid(), name: item.name + (s !== 1 ? ` (${String(s).replace(".", ",")} portions)` : " (1 portion)"), grams: null,
    kcal: item.kcal, prot: item.prot, carbs: item.carbs, fat: item.fat, source: "planning",
    ...(item.water != null ? { water: item.water } : {}),
  }];
}

export const dayItems = (plan, d) => Object.values(plan?.[d] || {}).flat();
export const dayPlannedKcal = (plan, d) => Math.round(dayItems(plan, d).reduce((a, i) => a + (i.kcal || 0), 0));

/**
 * Liste de courses des jours donnés : ingrédients additionnés, sans les produits de placard
 * (sel, huile…) ni ce qui est déjà dans « Mon frigo ».
 */
export function shoppingFromPlan(plan, dates, haveNames) {
  const tests = fridgeMatchers(haveNames || []);
  const agg = {};
  dates.forEach((d) => dayItems(plan, d).filter((i) => !i.done).forEach((i) => (i.ingredients || []).forEach((g) => {
    const n = norm(g.name || "");
    if (!n || STAPLES_RE.test(n) || tests.some((t) => t.test(n))) return;
    if (!agg[n]) agg[n] = { name: g.name, grams: 0, dishes: new Set() };
    agg[n].grams += g.grams || 0;
    agg[n].dishes.add(i.name);
  })));
  return Object.values(agg).sort((a, b) => a.name.localeCompare(b.name, "fr"))
    .map((a) => ({ label: a.grams > 0 ? `${a.name} (${a.grams >= 1000 ? (a.grams / 1000).toFixed(1).replace(".", ",") + " kg" : a.grams + " g"})` : a.name, from: [...a.dishes].slice(0, 2).join(", ") }));
}
