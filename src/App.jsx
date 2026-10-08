// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Les auteurs de NutriMaison
import React, { useState, useEffect, useMemo, useRef } from "react";
import { BookOpen, Dumbbell, Home, Loader2, Plus, User } from "lucide-react";
import { maybeAutoBackup } from "./backup.js";
import { checkForUpdate, loadUpdateState, saveUpdateState } from "./updates.js";
import { addToShopping } from "./Fridge.jsx";
import { loadPlan, savePlan, planItemToEntries } from "./planning.js";
import { PlanningView } from "./views/Planning.jsx";
import { decodeImageFile, startLiveScan } from "./scanner.js";
import { geminiGenerate, parseJSONLoose, shrinkImage } from "./gemini.js";
import { C, addDays, loadAllDays, loadJSON, round, saveJSON, stepsKcal, storage, todayISO, uid } from "./shared.jsx";
import { SPORT_DEFAULTS, SportView, workoutsKcalOn } from "./Sport.jsx";
import { WeightView, armyBodyFat, latestBodyFat, navyBodyFat, useWeightStats } from "./Weight.jsx";
import { BilanView } from "./Bilan.jsx";
import { syncReminders } from "./reminders.js";
import { searchCiqual, useCiqualReady } from "./ciqualDb.js";
import { hcSync, isNativeAndroid, loadHC } from "./healthconnect.js";
import { BRAND_DB, COCO_FOOD_LABELS, FOOD_DB, MEAL_ORDER, MOBILENET_FOOD_KEYWORDS, PANTRY_EN, RECIPES, STAPLES_RE, STAPLE_IDS, calcFromFood, emptyDay, fileToBase64, foodById, fridgeMatchers, ingredientData, matchesQuery, norm, offTextSearch, queryTokens, recipeTotals, recipeWaterPerServing, scoreMatch } from "./foodData.js";
import { Dashboard, scaleEntry } from "./views/Dashboard.jsx";
import { AddView } from "./views/AddView.jsx";
import { RecipeBuilder, RecipeDetail, RecipesView } from "./views/Recipes.jsx";
import { ProfileView, runHcSyncRef } from "./views/Profile.jsx";
import { APP_VERSION } from "./version.js";

const FONT_IMPORT =
  "@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Work+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap');";

export default function App() {
  const [ready, setReady] = useState(false);
  const [view, setView] = useState("dashboard");
  const [currentDate, setCurrentDate] = useState(todayISO());
  const [dayData, setDayData] = useState(emptyDay());
  const [goals, setGoals] = useState({ kcal: 2000, prot: 110, carbs: 250, fat: 65, water: 2000 });
  const [customRecipes, setCustomRecipes] = useState([]);
  const [customFoods, setCustomFoods] = useState([]);
  const [personalInfo, setPersonalInfo] = useState({ sexe: "homme", poids: 70, taille: 175, age: 30, activite: 1.375, objectif: "maintien", geminiApiKey: "" });

  const [addMeal, setAddMeal] = useState("dejeuner");
  const [addTab, setAddTab] = useState("manuel");

  const [searchQ, setSearchQ] = useState("");
  const [selectedFood, setSelectedFood] = useState(null);
  const [grams, setGrams] = useState(100);
  const [offResults, setOffResults] = useState([]);
  const [offLoading, setOffLoading] = useState(false);
  const [offError, setOffError] = useState(null);

  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState(null);
  const [scanMissing, setScanMissing] = useState(null); // { barcode, name } : produit inconnu à ajouter
  const videoRef = useRef(null);
  const codeReaderRef = useRef(null);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [scanBusy, setScanBusy] = useState(false);

  const [photoDetecting, setPhotoDetecting] = useState(false);
  const [photoDetections, setPhotoDetections] = useState([]);
  const [photoAiResults, setPhotoAiResults] = useState(null);
  const [photoError, setPhotoError] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const photoInputRef = useRef(null);

  const [extLoading, setExtLoading] = useState(false);
  const [extResults, setExtResults] = useState([]);
  const [extError, setExtError] = useState(null);

  const [recipeTab, setRecipeTab] = useState("toutes");
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [recipeIsCustom, setRecipeIsCustom] = useState(false);
  const [servingsToAdd, setServingsToAdd] = useState(1);
  const [pantry, setPantryState] = useState(() => new Set(loadJSON("pantry", [])));
  function setPantry(next) { setPantryState(next); saveJSON("pantry", [...next]); }
  const [fridgeExtras, setFridgeExtrasState] = useState(() => loadJSON("fridgeExtras", []));
  function setFridgeExtras(next) { setFridgeExtrasState(next); saveJSON("fridgeExtras", next); }
  const [shopping, setShoppingState] = useState(() => loadJSON("shoppingList", []));
  function setShopping(next) { setShoppingState(next); saveJSON("shoppingList", next); }

  const [showBuilder, setShowBuilder] = useState(false);
  const [builderName, setBuilderName] = useState("");
  const [builderServings, setBuilderServings] = useState(2);
  const [builderPasCher, setBuilderPasCher] = useState(false);
  const [builderIngredients, setBuilderIngredients] = useState([]);

  /* ---- Sport, poids, mensurations ---- */
  const [workouts, setWorkouts] = useState(() => loadJSON("workouts", []));
  const [sportSettings, setSportSettings] = useState(() => ({ ...SPORT_DEFAULTS, ...loadJSON("sportSettings", {}) }));
  const [weights, setWeights] = useState(() => loadJSON("weights", {}));
  const [measures, setMeasures] = useState(() => loadJSON("measures", []));
  const [daysVersion, setDaysVersion] = useState(0);
  const allDays = useMemo(() => loadAllDays(), [daysVersion]);
  const weightStats = useWeightStats(weights, allDays);
  const bodyFat = useMemo(() => latestBodyFat(measures, weights, personalInfo, personalInfo.bfMethod), [measures, weights, personalInfo]);
  const [bodyTab, setBodyTab] = useState("poids");
  function saveWorkouts(next) { setWorkouts(next); saveJSON("workouts", next); scheduleHcWrite(); }
  function saveSportSettings(next) { setSportSettings(next); saveJSON("sportSettings", next); }
  const [weightSources, setWeightSources] = useState(() => loadJSON("weightSources", {}));
  /** Une pesée tapée ou modifiée dans l'app devient « manuelle » ; une pesée importée supprimée n'est plus réimportée. */
  function saveWeights(next) {
    const src = { ...loadJSON("weightSources", {}) };
    const ignored = new Set(loadJSON("weightIgnored", []));
    Object.keys(next).forEach((d) => { if (next[d] !== weights[d]) { src[d] = "manuel"; ignored.delete(d); } });
    Object.keys(weights).forEach((d) => {
      if (!(d in next)) { if (src[d] && src[d] !== "manuel") ignored.add(d); delete src[d]; }
    });
    setWeights(next); saveJSON("weights", next);
    setWeightSources(src); saveJSON("weightSources", src);
    saveJSON("weightIgnored", [...ignored]);
    scheduleHcWrite();
  }
  function saveMeasures(next) { setMeasures(next); saveJSON("measures", next); scheduleHcWrite(); }
  function applyKcalGoal(kcal) {
    const fat = Math.round((kcal * 0.25) / 9);
    const carbs = Math.max(0, Math.round((kcal - goals.prot * 4 - fat * 9) / 4));
    saveGoals({ ...goals, kcal, fat, carbs });
  }
  function setSteps(steps) {
    // une saisie manuelle prend la main sur Health Connect pour ce jour ; vider le champ rend la main à Health Connect
    saveDay({ ...dayData, steps: steps == null ? null : Math.max(0, Math.round(steps)), stepsSource: steps == null ? undefined : "manuel" });
  }

  /* ---- Health Connect ---- */
  const [hcVersion, setHcVersion] = useState(0);
  const hcCtxRef = useRef(null);
  hcCtxRef.current = () => ({
    days: loadAllDays(), workouts: loadJSON("workouts", []), weights: loadJSON("weights", {}),
    weightSources: loadJSON("weightSources", {}),
    measures: loadJSON("measures", []).map((m) => {
      const kg = loadJSON("weights", {})[m.date] || personalInfo.poids;
      const bf = personalInfo.bfMethod === "army" ? armyBodyFat(personalInfo, m, kg) : navyBodyFat(personalInfo, m);
      return { date: m.date, bf };
    }),
  });
  const hcTimer = useRef(null);
  function reloadAfterHc() {
    setWeights(loadJSON("weights", {}));
    setWeightSources(loadJSON("weightSources", {}));
    setDayData(loadJSON("day:" + currentDateRef.current, null) || emptyDay());
    setDaysVersion((v) => v + 1);
    setHcVersion((v) => v + 1);
  }
  runHcSyncRef.current = (m) => runHcSync(m);
  async function runHcSync(mode = "full") {
    if (!isNativeAndroid() || !loadHC().enabled) return null;
    const res = await hcSync(hcCtxRef.current(), mode);
    if (res && !res.skipped) reloadAfterHc();
    return res;
  }
  const remTimer = useRef(null);
  function scheduleHcWrite() {
    // les rappels du jour s'annulent dès qu'un repas ou une pesée est noté
    clearTimeout(remTimer.current);
    remTimer.current = setTimeout(() => { syncReminders(); }, 1500);
    if (!isNativeAndroid()) return;
    clearTimeout(hcTimer.current);
    hcTimer.current = setTimeout(() => runHcSync("write"), 4000);
  }
  const currentDateRef = useRef(currentDate);
  currentDateRef.current = currentDate;
  /* ---- Copie de sécurité automatique et nouvelles versions (au démarrage, sans bloquer) ---- */
  const [update, setUpdate] = useState(null);
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => {
      maybeAutoBackup();
      checkForUpdate(APP_VERSION).then(setUpdate).catch(() => {});
    }, 2500);
    return () => clearTimeout(t);
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    syncReminders();
    runHcSync("full");
    let last = Date.now();
    const onVis = () => {
      if (document.visibilityState === "visible" && Date.now() - last > 60000) { last = Date.now(); runHcSync("full"); }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [ready]);

  /* ---- Chargement initial ---- */
  useEffect(() => {
    (async () => {
      try {
        const g = await storage.get("goals");
        if (g && g.value) setGoals(JSON.parse(g.value));
      } catch (e) {}
      try {
        const cr = await storage.get("customRecipes");
        if (cr && cr.value) setCustomRecipes(JSON.parse(cr.value));
      } catch (e) {}
      try {
        const cf = await storage.get("customFoods");
        if (cf && cf.value) setCustomFoods(JSON.parse(cf.value));
      } catch (e) {}
      try {
        const pi = await storage.get("personalInfo");
        if (pi && pi.value) setPersonalInfo(JSON.parse(pi.value));
      } catch (e) {}
      setReady(true);
    })();
  }, []);

  /* ---- Chargement du jour ---- */
  useEffect(() => {
    (async () => {
      try {
        const d = await storage.get("day:" + currentDate);
        setDayData(d && d.value ? JSON.parse(d.value) : emptyDay());
      } catch (e) {
        setDayData(emptyDay());
      }
    })();
  }, [currentDate]);

  /* ---- Recherche de produits de marque : base locale + Open Food Facts en direct ---- */
  useEffect(() => {
    const q = searchQ.trim().toLowerCase();
    if (q.length < 2) { setOffResults([]); setOffError(null); setOffLoading(false); return; }
    const tokens = queryTokens(q);
    const staticMatches = [...customFoods, ...BRAND_DB].filter((f) => matchesQuery(f.name, tokens));
    setOffResults(staticMatches);
    setOffError(null);
    setOffLoading(true);
    const handle = setTimeout(async () => {
      const products = await offTextSearch(q, 20);
      setOffResults((prev) => {
        const ids = new Set(prev.map((p) => p.id));
        return [...prev, ...products.filter((p) => !ids.has(p.id))].slice(0, 30);
      });
      setOffLoading(false);
    }, 450);
    return () => clearTimeout(handle);
  }, [searchQ, customFoods]);

  async function saveDay(next) {
    setDayData(next);
    try { await storage.set("day:" + currentDate, JSON.stringify(next), false); } catch (e) {}
    setDaysVersion((v) => v + 1);
    scheduleHcWrite();
  }
  async function saveGoals(next) {
    setGoals(next);
    try { await storage.set("goals", JSON.stringify(next), false); } catch (e) {}
  }
  async function saveCustomRecipes(next) {
    setCustomRecipes(next);
    try { await storage.set("customRecipes", JSON.stringify(next), false); } catch (e) {}
  }
  async function saveCustomFoods(next) {
    setCustomFoods(next);
    try { await storage.set("customFoods", JSON.stringify(next), false); } catch (e) {}
  }
  async function savePersonalInfo(next) {
    setPersonalInfo(next);
    try { await storage.set("personalInfo", JSON.stringify(next), false); } catch (e) {}
  }
  function addCustomFood(food) {
    const entry = { id: "custom_" + uid(), name: food.name, kcal: food.kcal, prot: food.prot, carbs: food.carbs, fat: food.fat, brand: true, mine: true,
      ...(food.barcode ? { barcode: String(food.barcode) } : {}) };
    // même nom (ou même code-barres) : on remplace l'ancienne version plutôt que de créer un doublon
    const k = norm(food.name);
    saveCustomFoods([...customFoods.filter((f) => norm(f.name) !== k && !(food.barcode && f.barcode === String(food.barcode))), entry]);
    return entry;
  }

  /* ---- Favoris & récents ---- */
  const [favorites, setFavorites] = useState(() => loadJSON("favorites", []));
  function saveFavorites(next) { setFavorites(next); saveJSON("favorites", next); }
  const favKey = (name) => norm(name);
  function snapshot(e) {
    return { key: favKey(e.name), name: e.name, grams: e.grams || null, kcal: e.kcal, prot: e.prot, carbs: e.carbs, fat: e.fat, ...(e.water != null ? { water: e.water } : {}) };
  }
  function toggleFavorite(e) {
    const k = favKey(e.name);
    saveFavorites(favorites.some((f) => f.key === k) ? favorites.filter((f) => f.key !== k) : [snapshot(e), ...favorites].slice(0, 40));
  }
  /** Aliments notés ces 45 derniers jours, les plus fréquents d'abord (dernière quantité retenue). */
  const recents = useMemo(() => {
    const from = addDays(todayISO(), -45);
    const map = {};
    Object.entries(allDays).forEach(([d, day]) => {
      if (d < from || !day?.meals) return;
      Object.values(day.meals).forEach((list) => (list || []).forEach((e) => {
        if (!e?.name) return;
        const k = favKey(e.name);
        const cur = map[k];
        if (!cur) map[k] = { ...snapshot(e), count: 1, last: d };
        else { cur.count++; if (d >= cur.last) Object.assign(cur, snapshot(e), { count: cur.count, last: d }); }
      }));
    });
    return Object.values(map).sort((a, b) => b.count - a.count || b.last.localeCompare(a.last)).slice(0, 15);
  }, [allDays]);
  function quickAdd(item, meal) {
    const { key, count, last, ...vals } = item;
    addEntry(meal, { id: uid(), ...vals, source: "recent" });
  }
  /** Ouvre un récent/favori dans le sélecteur de quantité (valeurs ramenées à 100 g). */
  function pickRecent(item) {
    if (!item.grams) return false;
    const f = 100 / item.grams;
    setSelectedFood({
      id: "rec_" + item.key, name: item.name, kcal: round(item.kcal * f), prot: round(item.prot * f), carbs: round(item.carbs * f), fat: round(item.fat * f),
      ...(item.water != null ? { water100: item.water * f } : {}),
    });
    setGrams(item.grams);
    return true;
  }
  /** Copie un repas d'un autre jour (nouveaux identifiants, donc envoyé proprement à Health Connect). */
  function copyMealFrom(date, meal) {
    const src = loadJSON("day:" + date, null);
    const list = src?.meals?.[meal] || [];
    if (!list.length) return;
    addEntries(meal, list.map((e) => ({ ...e, id: uid(), source: "copie" })));
  }

  const clone = (e) => ({ ...e, id: uid(), source: "copie" });
  /** Ajoute dans le repas affiché une copie d'aliments venant d'un autre jour ou d'un repas type. */
  function copyEntriesIn(meal, list) {
    if (list?.length) addEntries(meal, list.map(clone));
  }
  /** Copie des aliments du jour affiché vers un autre jour / repas (l'original reste en place). */
  function copyEntriesTo(list, toDate, toMeal) {
    if (!list?.length) return;
    if (toDate === currentDate) { addEntries(toMeal, list.map(clone)); return; }
    const other = loadJSON("day:" + toDate, null) || emptyDay();
    other.meals = { ...emptyDay().meals, ...(other.meals || {}) };
    other.meals[toMeal] = [...other.meals[toMeal], ...list.map(clone)];
    saveJSON("day:" + toDate, other);
    setDaysVersion((v) => v + 1);
    scheduleHcWrite();
  }
  /** « Je n'en ai mangé que la moitié » : applique une fraction à tout un repas. */
  function scaleMeal(meal, f) {
    if (!(f > 0) || f === 1) return;
    saveDay({ ...dayData, meals: { ...dayData.meals, [meal]: dayData.meals[meal].map((e) => scaleEntry(e, f)) } });
  }
  function clearMeal(meal) {
    saveDay({ ...dayData, meals: { ...dayData.meals, [meal]: [] } });
  }

  /* ---- Repas types (ex. « mon petit-déj habituel ») ---- */
  const [mealTemplates, setMealTemplates] = useState(() => loadJSON("mealTemplates", []));
  function saveTemplates(next) { setMealTemplates(next); saveJSON("mealTemplates", next); }
  function saveMealTemplate(name, items) {
    const clean = items.map(({ id, source, hcId, ...rest }) => ({ ...rest }));
    saveTemplates([{ id: uid(), name, items: clean }, ...mealTemplates.filter((t) => t.name !== name)].slice(0, 30));
  }
  function deleteMealTemplate(id) { saveTemplates(mealTemplates.filter((t) => t.id !== id)); }
  function addMealTemplate(meal, t) { copyEntriesIn(meal, t.items); }

  /* ---- Planning de la semaine ---- */
  const [mealPlan, setMealPlan] = useState(loadPlan);
  function changePlan(next) { setMealPlan(savePlan(next)); }
  function planAdd(date, meal, item) {
    const day = mealPlan[date] || {};
    changePlan({ ...mealPlan, [date]: { ...day, [meal]: [...(day[meal] || []), item] } });
  }
  /** Note un plat prévu dans le journal du jour concerné, et le marque comme fait. */
  function logPlanned(date, meal, item) {
    const entries = planItemToEntries(item);
    if (date === currentDate) addEntries(meal, entries);
    else {
      const other = loadJSON("day:" + date, null) || emptyDay();
      other.meals = { ...emptyDay().meals, ...(other.meals || {}) };
      other.meals[meal] = [...other.meals[meal], ...entries];
      saveJSON("day:" + date, other);
      setDaysVersion((v) => v + 1);
      scheduleHcWrite();
    }
    const day = mealPlan[date] || {};
    changePlan({ ...mealPlan, [date]: { ...day, [meal]: (day[meal] || []).map((i) => (i.id === item.id ? { ...i, done: true } : i)) } });
  }
  function addShoppingItems(names, from) {
    const r = addToShopping(shopping, names, from);
    setShopping(r.next);
    return r.added;
  }

  function addEntries(meal, entries) {
    const next = { ...dayData, meals: { ...dayData.meals, [meal]: [...dayData.meals[meal], ...entries] } };
    saveDay(next);
  }
  /** Ajoute plusieurs aliments perso d'un coup (sans doublon de nom). */
  function addCustomFoodsBulk(list) {
    const known = new Set([...customFoods, ...FOOD_DB].map((f) => norm(f.name)));
    const add = list.filter((f) => f.name && !known.has(norm(f.name))).map((f) => ({
      id: "custom_" + uid(), name: f.name, kcal: f.kcal, prot: f.prot, carbs: f.carbs, fat: f.fat, brand: true, mine: true,
    }));
    if (add.length) saveCustomFoods([...customFoods, ...add]);
  }
  function addEntry(meal, entry) {
    const next = { ...dayData, meals: { ...dayData.meals, [meal]: [...dayData.meals[meal], entry] } };
    saveDay(next);
  }
  function deleteEntry(meal, id) {
    const next = { ...dayData, meals: { ...dayData.meals, [meal]: dayData.meals[meal].filter((e) => e.id !== id) } };
    saveDay(next);
  }
  /**
   * Modifie un aliment du journal : quantité (macros recalculées), repas, et/ou jour.
   * patch = { factor, grams, toMeal, toDate }
   */
  async function editEntry(meal, id, patch) {
    const e = dayData.meals[meal].find((x) => x.id === id);
    if (!e) return;
    const f = patch.factor != null ? patch.factor : 1;
    const scaled = scaleEntry(e, f);
    const toMeal = patch.toMeal || meal;
    const toDate = patch.toDate || currentDate;
    const without = { ...dayData, meals: { ...dayData.meals, [meal]: dayData.meals[meal].filter((x) => x.id !== id) } };
    if (toDate === currentDate) {
      const list = toMeal === meal
        ? dayData.meals[meal].map((x) => (x.id === id ? scaled : x))
        : [...without.meals[toMeal], scaled];
      saveDay({ ...without, meals: { ...without.meals, [toMeal]: list } });
    } else {
      // déplacement vers un autre jour : on retire ici et on ajoute dans l'autre jour
      const other = loadJSON("day:" + toDate, null) || emptyDay();
      other.meals = { ...emptyDay().meals, ...(other.meals || {}) };
      other.meals[toMeal] = [...other.meals[toMeal], scaled];
      saveJSON("day:" + toDate, other);
      await saveDay(without);
    }
  }
  function changeWater(delta) {
    const next = { ...dayData, water: Math.max(0, dayData.water + delta) };
    saveDay(next);
  }

  const totals = useMemo(() => {
    const t = { kcal: 0, prot: 0, carbs: 0, fat: 0 };
    MEAL_ORDER.forEach((m) => dayData.meals[m].forEach((e) => {
      t.kcal += e.kcal; t.prot += e.prot; t.carbs += e.carbs; t.fat += e.fat;
    }));
    return t;
  }, [dayData]);

  const activity = useMemo(() => {
    const kg = personalInfo.poids || 70;
    const sportKcal = workoutsKcalOn(workouts, currentDate);
    const steps = dayData.steps;
    const stepsK = steps != null ? stepsKcal(steps, kg, personalInfo.taille) : null;
    const habitualK = stepsKcal(sportSettings.habitualSteps || 0, kg, personalInfo.taille);
    // Les pas habituels sont déjà dans le besoin calculé : seul l'écart du jour est un « bonus » (ou un malus).
    const stepsDelta = stepsK != null ? stepsK - habitualK : 0;
    const eat = sportSettings.eatBack || 0;
    const bonus = Math.round(eat * (sportKcal + stepsDelta));
    return {
      sportKcal, steps, stepsK, stepsDelta, bonus, list: workouts.filter((w) => w.date === currentDate),
      stepsFromHc: dayData.stepsSource === "hc", hc: dayData.hc || null, hcOn: isNativeAndroid() && loadHC().enabled,
    };
  }, [workouts, currentDate, dayData.steps, dayData.stepsSource, dayData.hc, personalInfo, sportSettings, hcVersion]);

  const ciqualReady = useCiqualReady();
  const filteredFoods = useMemo(() => {
    if (!searchQ.trim()) return FOOD_DB.slice(0, 12);
    if (ciqualReady) {
      // Table Ciqual d'abord (valeurs officielles), puis nos quelques aliments maison absents de Ciqual
      const cq = searchCiqual(searchQ, 25);
      const extra = FOOD_DB.filter((f) => f.id.startsWith("x_") && matchesQuery(f.name, queryTokens(searchQ)));
      return [...cq, ...extra].slice(0, 30);
    }
    const tokens = queryTokens(searchQ);
    return FOOD_DB.filter((f) => matchesQuery(f.name, tokens)).sort((a, b) => scoreMatch(a.name, searchQ) - scoreMatch(b.name, searchQ)).slice(0, 20);
  }, [searchQ, ciqualReady]);

  const allRecipes = useMemo(() => [
    ...RECIPES.map((r) => ({ ...r, custom: false })),
    ...customRecipes.map((r) => ({ ...r, custom: true })),
  ], [customRecipes]);

  const visibleRecipes = useMemo(() => {
    if (recipeTab === "pasCher") return allRecipes.filter((r) => r.pasCher);
    if (recipeTab === "mesrecettes") return allRecipes.filter((r) => r.custom);
    if (recipeTab === "ingredients") {
      if (pantry.size === 0) return [];
      return allRecipes
        .map((r) => {
          const ids = r.ingredients.map((ing) => (Array.isArray(ing) ? ing[0] : ing.foodId)).filter(Boolean);
          const match = ids.filter((id) => pantry.has(id)).length;
          return { ...r, matchPct: r.ingredients.length ? match / r.ingredients.length : 0 };
        })
        .filter((r) => r.matchPct >= 0.5)
        .sort((a, b) => b.matchPct - a.matchPct);
    }
    if (recipeTab === "frigo") {
      if (pantry.size === 0 && fridgeExtras.length === 0) return [];
      const tests = fridgeMatchers([...[...pantry].map((id) => foodById[id]?.name), ...fridgeExtras].filter(Boolean));
      return allRecipes
        .filter((r) => !r.noNutrition && r.ingredients.length)
        .map((r) => {
          // pondération par le poids : 10 g de miel ne font pas un bol de fruits
          let have = 0, need = 0, mainOk = false; const missing = [], using = [];
          const ings = r.ingredients.map((ing) => {
            const id = Array.isArray(ing) ? ing[0] : ing.foodId;
            const d = ingredientData(ing);
            return { id, name: d.name || "", n: norm(d.name || ""), g: Number(d.grams) || 50 };
          });
          const counted = ings.filter((x) => !STAPLES_RE.test(x.n) && !(x.id && STAPLE_IDS.has(x.id)));
          const total = counted.reduce((a, x) => a + x.g, 0) || 1;
          counted.forEach((x) => {
            const ok = (x.id && pantry.has(x.id)) || tests.some((t) => t.test(x.n));
            need += x.g;
            if (ok) { have += x.g; using.push(x.name); if (x.g / total >= 0.2) mainOk = true; }
            else missing.push(x.name);
          });
          return { ...r, matchPct: need ? have / need : 0, missing, using, mainOk };
        })
        .filter((r) => r.mainOk && (r.matchPct >= 0.5 ? r.missing.length <= 3 : r.matchPct >= 0.35 && r.missing.length <= 2))
        .sort((a, b) => a.missing.length - b.missing.length || b.matchPct - a.matchPct)
        .slice(0, 12);
    }
    return allRecipes;
  }, [recipeTab, allRecipes, pantry, fridgeExtras]);

  function openAdd(meal) { setAddMeal(meal); setAddTab("manuel"); setSelectedFood(null); setPhotoDetections([]); setPhotoAiResults(null); setCapturedImage(null); setPhotoError(null); setView("add"); }

  function confirmManualAdd() {
    if (!selectedFood) return;
    const m = calcFromFood(selectedFood, grams);
    const entry = { id: uid(), name: selectedFood.name, grams, ...m, source: selectedFood.edited ? "modifie" : selectedFood.ai ? "ia-texte" : selectedFood.ciqual ? "ciqual" : "manuel" };
    if (selectedFood.water100 != null) entry.water = Math.round(selectedFood.water100 * grams / 100); // eau réelle (Ciqual)
    addEntry(addMeal, entry);
    // un aliment estimé par l'IA est gardé dans les aliments perso : trouvé directement la prochaine fois
    if (selectedFood.edited && selectedFood.remember && selectedFood.name.trim()) addCustomFood({ ...selectedFood, name: selectedFood.name.trim() });
    else if (selectedFood.ai) addCustomFoodsBulk([{ name: selectedFood.name, kcal: selectedFood.kcal, prot: selectedFood.prot, carbs: selectedFood.carbs, fat: selectedFood.fat }]);
    setSelectedFood(null); setSearchQ(""); setGrams(100);
    setView("dashboard");
  }

  async function startScan() {
    setScanError(null); setScanMissing(null); setScanning(true); setTorchOn(false);
    // attendre que la balise <video> soit affichée
    await new Promise((r) => setTimeout(r, 50));
    try {
      const controls = await startLiveScan(videoRef.current, async (code) => {
        setScanning(false); setTorchAvailable(false);
        await lookupBarcode(code);
      });
      codeReaderRef.current = controls;
      setTorchAvailable(controls.hasTorch);
    } catch (e) {
      setScanning(false);
      setScanError(e && e.name === "NotAllowedError"
        ? "Accès à la caméra refusé. Autorise la caméra pour NutriMaison dans les paramètres Android."
        : "Impossible d'ouvrir la caméra (" + (e && (e.name || e.message)) + ").");
    }
  }
  function stopScan() {
    try { codeReaderRef.current?.stop(); } catch (e) {}
    setScanning(false); setTorchAvailable(false); setTorchOn(false);
  }
  async function toggleTorch() {
    const next = !torchOn;
    const ok = await codeReaderRef.current?.setTorch(next);
    if (ok) setTorchOn(next);
  }
  async function scanFromPhoto(file) {
    if (!file) return;
    stopScan();
    setScanError(null); setScanMissing(null); setScanBusy(true);
    try {
      const code = await decodeImageFile(file);
      if (code) await lookupBarcode(code);
      else setScanError("Aucun code-barres lisible sur la photo. Rapproche-toi (le code doit remplir le cadre), évite les reflets, ou tape les chiffres ci-dessous.");
    } catch (e) {
      setScanError("Lecture de la photo impossible.");
    }
    setScanBusy(false);
  }
  async function scanManualCode(code) {
    const c = String(code || "").replace(/\D/g, "");
    if (c.length < 8) { setScanError("Un code-barres fait 8 ou 13 chiffres."); return; }
    setScanError(null); setScanBusy(true);
    await lookupBarcode(c);
    setScanBusy(false);
  }
  useEffect(() => () => { try { codeReaderRef.current?.stop(); } catch (e) {} }, []);
  useEffect(() => { if (view !== "add" || addTab !== "scanner") { try { codeReaderRef.current?.stop(); } catch (e) {} setScanning(false); } }, [view, addTab]);
  async function lookupBarcode(barcode) {
    setScanMissing(null);
    // produit déjà ajouté par l'utilisateur pour ce code-barres
    const mine = customFoods.find((f) => f.barcode === String(barcode));
    if (mine) { setAddTab("manuel"); setSelectedFood(mine); setGrams(100); return; }
    try {
      const res = await fetch("https://world.openfoodfacts.org/api/v2/product/" + barcode + ".json?fields=product_name,brands,nutriments,image_small_url");
      const data = await res.json();
      if (data.status === 1 && data.product) {
        const p = data.product;
        const n = p.nutriments || {};
        if (n["energy-kcal_100g"] == null) {
          setScanError("Ce produit n'a pas de valeurs nutritionnelles sur Open Food Facts.");
          setScanMissing({ barcode: String(barcode), name: (p.product_name || "") + (p.brands ? " – " + p.brands.split(",")[0].trim() : "") });
          return;
        }
        const food = {
          id: "off_" + barcode,
          name: (p.product_name || "Produit scanné") + (p.brands ? " – " + p.brands.split(",")[0].trim() : ""),
          image: p.image_small_url || null, brand: true,
          kcal: Number(n["energy-kcal_100g"]) || 0, prot: Number(n["proteins_100g"]) || 0,
          carbs: Number(n["carbohydrates_100g"]) || 0, fat: Number(n["fat_100g"]) || 0,
        };
        setAddTab("manuel");
        setSelectedFood(food);
        setGrams(100);
      } else {
        setScanError("Produit introuvable dans Open Food Facts.");
        setScanMissing({ barcode: String(barcode), name: "" });
      }
    } catch (e) {
      setScanError("Recherche impossible — vérifie ta connexion internet.");
    }
  }

  async function analyzeWithGemini(file, apiKey, onStatus, signal) {
    const small = await shrinkImage(file);
    const base64 = small ? small.base64 : await fileToBase64(file);
    const mime = small ? small.mime : (file.type || "image/jpeg");
    const text = await geminiGenerate(apiKey, [
      { text: "Tu es un expert en nutrition. Identifie chaque aliment visible sur cette photo de repas, estime sa quantité en grammes et calcule ses calories et macronutriments (protéines, glucides, lipides). Réponds UNIQUEMENT avec un tableau JSON valide, sans texte avant ni après, au format exact : [{\"name\":\"...\",\"grams\":0,\"kcal\":0,\"prot\":0,\"carbs\":0,\"fat\":0}]. Noms des aliments en français." },
      { inline_data: { mime_type: mime, data: base64 } },
    ], { onStatus, temperature: 0.2, signal });
    const parsed = parseJSONLoose(text);
    return Array.isArray(parsed) ? parsed : (parsed?.items || parsed?.aliments || []);
  }

  async function analyzeLocally(img) {
    const cocoSsd = await import("@tensorflow-models/coco-ssd");
    const mobilenet = await import("@tensorflow-models/mobilenet");
    const results = [];

    try {
      const cocoModel = await cocoSsd.load();
      const predictions = await cocoModel.detect(img);
      predictions
        .filter((p) => COCO_FOOD_LABELS[p.class] && p.score > 0.5)
        .forEach((p) => results.push({ label: COCO_FOOD_LABELS[p.class].fr, foodId: COCO_FOOD_LABELS[p.class].foodId, score: p.score }));
    } catch (e) { /* modèle COCO-SSD indisponible, on continue avec MobileNet */ }

    try {
      const mnModel = await mobilenet.load();
      const predictions = await mnModel.classify(img);
      predictions.forEach((p) => {
        if (p.probability < 0.15) return;
        const cn = p.className.toLowerCase();
        const match = MOBILENET_FOOD_KEYWORDS.find((k) => cn.includes(k.kw));
        if (match) results.push({ label: match.fr, foodId: match.foodId, score: p.probability });
      });
    } catch (e) { /* modèle MobileNet indisponible, on garde ce qu'on a de COCO-SSD */ }

    // Déduplique par label, garde le meilleur score
    const byLabel = {};
    results.forEach((r) => {
      if (!byLabel[r.label] || byLabel[r.label].score < r.score) byLabel[r.label] = r;
    });
    return Object.values(byLabel).sort((a, b) => b.score - a.score).slice(0, 8);
  }

  const photoAbort = useRef(null);
  function cancelPhoto() {
    try { photoAbort.current?.abort(); } catch (e) {}
    setPhotoDetecting(false); setPhotoError("Analyse annulée.");
  }
  async function analyzePhoto(file) {
    if (!file) return;
    try { photoAbort.current?.abort(); } catch (e) {}
    const ctrl = new AbortController(); photoAbort.current = ctrl;
    setPhotoDetecting(true); setPhotoError(null); setPhotoDetections([]); setPhotoAiResults(null);
    const url = URL.createObjectURL(file);
    setCapturedImage(url);

    const geminiKey = (personalInfo.geminiApiKey || "").trim();
    if (geminiKey) {
      try {
        const results = await analyzeWithGemini(file, geminiKey, (t) => setPhotoError(t), ctrl.signal);
        if (ctrl.signal.aborted) return;
        setPhotoError(null);
        setPhotoAiResults(Array.isArray(results) ? results.map((r) => ({ ...r, id: uid() })) : []);
        setPhotoDetecting(false);
        return;
      } catch (e) {
        if (e.cancelled || ctrl.signal.aborted) return;
        setPhotoError("Gemini : " + (e.message || "erreur inconnue") + " — détection locale utilisée à la place.");
      }
    }

    try {
      const img = new Image();
      img.src = url;
      await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; });
      // la détection locale télécharge ses modèles la 1re fois : on borne aussi son temps
      const mapped = await Promise.race([
        analyzeLocally(img),
        new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 30000)),
      ]);
      if (ctrl.signal.aborted) return;
      if (mapped.length === 0) {
        setPhotoError("Aucun aliment reconnu sur cette photo (la détection locale couvre un nombre limité d'aliments). Utilise la recherche manuelle.");
      }
      setPhotoDetections(mapped);
    } catch (e) {
      if (ctrl.signal.aborted) return;
      setPhotoError(e?.message === "timeout"
        ? "La détection locale met trop de temps (connexion lente ?). Utilise la recherche manuelle ou l'onglet Texte IA."
        : "Détection indisponible sur cet appareil. Utilise la recherche manuelle.");
    }
    if (!ctrl.signal.aborted) setPhotoDetecting(false);
  }

  function pickPhotoDetection(det) {
    if (det.foodId && foodById[det.foodId]) {
      setSelectedFood(foodById[det.foodId]);
      setGrams(100);
    } else {
      setSearchQ(det.label);
    }
    setAddTab("manuel");
  }

  function addAiPhotoResultsToJournal() {
    if (!photoAiResults) return;
    const next = { ...dayData, meals: { ...dayData.meals, [addMeal]: [...dayData.meals[addMeal], ...photoAiResults.map((p) => ({
      id: uid(), name: p.name, grams: p.grams, kcal: round(p.kcal), prot: round(p.prot), carbs: round(p.carbs), fat: round(p.fat), source: "photo-ia",
    }))] } };
    saveDay(next);
    setPhotoAiResults(null); setCapturedImage(null);
    setView("dashboard");
  }
  function removeAiPhotoResult(id) {
    setPhotoAiResults(photoAiResults.filter((p) => p.id !== id));
  }

  async function searchExternalRecipes() {
    if (pantry.size === 0) return;
    setExtLoading(true); setExtError(null); setExtResults([]);
    try {
      const ids = [...pantry];
      const primaryEn = PANTRY_EN[ids[0]];
      if (!primaryEn) { setExtError("Choisis au moins un ingrédient courant (viande, féculent, légume...)."); setExtLoading(false); return; }
      const filterRes = await fetch("https://www.themealdb.com/api/json/v1/1/filter.php?i=" + encodeURIComponent(primaryEn));
      const filterData = await filterRes.json();
      const candidates = (filterData.meals || []).slice(0, 8);
      if (candidates.length === 0) {
        setExtError("Aucune recette trouvée en ligne pour cet ingrédient.");
        setExtLoading(false);
        return;
      }
      const otherTerms = ids.slice(1).map((id) => PANTRY_EN[id]).filter(Boolean).map((t) => t.replace(/_/g, " "));
      const detailed = await Promise.all(candidates.map(async (c) => {
        try {
          const r = await fetch("https://www.themealdb.com/api/json/v1/1/lookup.php?i=" + c.idMeal);
          const d = await r.json();
          return d.meals ? d.meals[0] : null;
        } catch (e) { return null; }
      }));
      const scored = detailed.filter(Boolean).map((m) => {
        const allText = Array.from({ length: 20 }, (_, i) => m["strIngredient" + (i + 1)] || "").join(" ").toLowerCase();
        const matchCount = 1 + otherTerms.filter((t) => allText.includes(t.toLowerCase())).length;
        return { meal: m, matchCount };
      }).sort((a, b) => b.matchCount - a.matchCount);
      setExtResults(scored.slice(0, 5));
    } catch (e) {
      setExtError("Recherche en ligne indisponible — vérifie ta connexion.");
    }
    setExtLoading(false);
  }

  function mealIngredientsText(m) {
    const list = [];
    for (let i = 1; i <= 20; i++) {
      const ing = m["strIngredient" + i];
      const measure = m["strMeasure" + i];
      if (ing && ing.trim()) list.push((measure && measure.trim() ? measure.trim() + " " : "") + ing.trim());
    }
    return list;
  }
  function saveExternalRecipe(m) {
    const recipe = {
      id: uid(), name: m.strMeal, categorie: "Recette en ligne (TheMealDB)", pasCher: false, servings: 2,
      ingredients: [], aiIngredientsText: mealIngredientsText(m),
      steps: (m.strInstructions || "").split(/\r?\n/).map((s) => s.trim()).filter(Boolean),
      noNutrition: true, image: m.strMealThumb || null,
    };
    saveCustomRecipes([...customRecipes, recipe]);
    setRecipeTab("mesrecettes");
  }

  function addRecipeToJournal(recipe) {
    const tot = recipeTotals(recipe);
    const per = { kcal: tot.kcal / recipe.servings, prot: tot.prot / recipe.servings, carbs: tot.carbs / recipe.servings, fat: tot.fat / recipe.servings };
    const entry = {
      id: uid(), name: recipe.name + (servingsToAdd !== 1 ? ` (${servingsToAdd} portions)` : " (1 portion)"),
      grams: null, kcal: round(per.kcal * servingsToAdd), prot: round(per.prot * servingsToAdd),
      carbs: round(per.carbs * servingsToAdd), fat: round(per.fat * servingsToAdd), source: "recette",
    };
    const wps = recipeWaterPerServing(recipe);
    if (wps != null) entry.water = Math.round(wps * servingsToAdd);
    addEntry(addMeal, entry);
    setSelectedRecipe(null);
    setServingsToAdd(1);
    setView("dashboard");
  }

  function addBuilderIngredient() {
    const f = FOOD_DB[0];
    setBuilderIngredients([...builderIngredients, {
      key: uid(), foodId: f.id, name: f.name, kcal100: f.kcal, prot100: f.prot, carbs100: f.carbs, fat100: f.fat, grams: 100, brand: false,
    }]);
  }
  function saveCustomRecipe() {
    if (!builderName.trim() || builderIngredients.length === 0) return;
    const recipe = {
      id: uid(), name: builderName.trim(), categorie: "Ma recette", pasCher: builderPasCher,
      servings: builderServings,
      ingredients: builderIngredients.map((i) => ({
        foodId: i.foodId || null, name: i.name, kcal100: i.kcal100, prot100: i.prot100, carbs100: i.carbs100, fat100: i.fat100,
        grams: Number(i.grams) || 0, brand: !!i.brand,
      })),
      steps: [],
    };
    saveCustomRecipes([...customRecipes, recipe]);
    setShowBuilder(false); setBuilderName(""); setBuilderServings(2); setBuilderIngredients([]); setBuilderPasCher(false);
  }
  function deleteCustomRecipe(id) {
    saveCustomRecipes(customRecipes.filter((r) => r.id !== id));
    setSelectedRecipe(null);
  }

  if (!ready) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: C.paper }}>
        <Loader2 size={28} color={C.herb} className="spin" style={{ animation: "spin 1s linear infinite" }} />
        <style>{"@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}"}</style>
      </div>
    );
  }

  const navView = view === "recipeDetailFromAdd" || (view === "recipes" && (selectedRecipe || showBuilder)) ? "recipes" : (view === "body" || view === "bilan") ? "dashboard" : view;

  return (
    <div style={{
      fontFamily: "'Work Sans',sans-serif", background: C.paper, minHeight: "100vh",
      display: "flex", justifyContent: "center", color: C.ink,
    }}>
      <style>{FONT_IMPORT}{`
        * { box-sizing: border-box; }
        input, select { font-family: 'Work Sans',sans-serif; }
        button { cursor:pointer; font-family:'Work Sans',sans-serif; }
        ::-webkit-scrollbar { width: 6px; height:6px; }
        .scrollx::-webkit-scrollbar { display:none; }
        /* rangées de pastilles : passent à la ligne plutôt que de cacher la fin hors de l'écran */
        .scrollx { flex-wrap: wrap !important; overflow-x: visible !important; }
      `}</style>
      <div style={{ width: "100%", maxWidth: 480, minHeight: "100vh", background: C.paper, position: "relative", paddingBottom: 92 }}>

        {view === "dashboard" && (
          <Dashboard
            currentDate={currentDate} setCurrentDate={setCurrentDate}
            dayData={dayData} totals={totals} goals={goals}
            onOpenAdd={openAdd} onDeleteEntry={deleteEntry} onChangeWater={changeWater} onEditEntry={editEntry}
            yesterday={allDays[addDays(currentDate, -1)]} onCopyMeal={(meal) => copyMealFrom(addDays(currentDate, -1), meal)}
            favorites={favorites} onToggleFavorite={toggleFavorite}
            allDays={allDays} weights={weights} mealTemplates={mealTemplates}
            planned={mealPlan[currentDate] || {}} onLogPlanned={(meal, item) => logPlanned(currentDate, meal, item)}
            update={update && loadUpdateState().dismissed !== update.version ? update : null}
            onDismissUpdate={() => { saveUpdateState({ ...loadUpdateState(), dismissed: update?.version }); setUpdate(null); }}
            onCopyIn={copyEntriesIn} onCopyTo={copyEntriesTo} onClearMeal={clearMeal} onScaleMeal={scaleMeal}
            onSaveTemplate={saveMealTemplate} onDeleteTemplate={deleteMealTemplate} onAddTemplate={addMealTemplate}
            activity={activity} sportSettings={sportSettings} onSetSteps={setSteps}
            weightStats={weightStats} bodyFat={bodyFat}
            onOpenSport={() => setView("sport")} onOpenBody={(t) => { setBodyTab(t || "poids"); setView("body"); }}
            onOpenBilan={() => setView("bilan")}
          />
        )}

        {view === "add" && (
          <AddView
            addMeal={addMeal} setAddMeal={setAddMeal} addTab={addTab} setAddTab={setAddTab}
            onBack={() => setView("dashboard")}
            searchQ={searchQ} setSearchQ={setSearchQ} filteredFoods={filteredFoods}
            favorites={favorites} recents={recents} onToggleFavorite={toggleFavorite}
            onQuickAdd={(item) => quickAdd(item, addMeal)} onPickRecent={pickRecent}
            offResults={offResults} offLoading={offLoading} offError={offError}
            onAddCustomFood={addCustomFood}
            selectedFood={selectedFood} setSelectedFood={setSelectedFood}
            grams={grams} setGrams={setGrams} onConfirmManual={confirmManualAdd}
            scanning={scanning} scanError={scanError} videoRef={videoRef}
            scanMissing={scanMissing} onCancelMissing={() => setScanMissing(null)}
            onSaveNewProduct={(food) => { const e = addCustomFood(food); setScanMissing(null); setScanError(null); setAddTab("manuel"); setSelectedFood(e); setGrams(100); }}
            mealTemplates={mealTemplates} onAddTemplate={(t) => addMealTemplate(addMeal, t)} onDeleteTemplate={deleteMealTemplate}
            onStartScan={startScan} onStopScan={stopScan}
            torchAvailable={torchAvailable} torchOn={torchOn} onToggleTorch={toggleTorch}
            scanBusy={scanBusy} onScanPhoto={scanFromPhoto} onScanManual={scanManualCode}
            photoDetecting={photoDetecting} photoDetections={photoDetections} photoAiResults={photoAiResults} photoError={photoError} capturedImage={capturedImage}
            photoInputRef={photoInputRef} onPickPhoto={() => photoInputRef.current?.click()}
            onPhotoFileChange={(e) => analyzePhoto(e.target.files[0])} onPickPhotoDetection={pickPhotoDetection}
            onPhotoFile={(f) => analyzePhoto(f)} onCancelPhoto={cancelPhoto}
            onAddAiPhotoResults={addAiPhotoResultsToJournal} onRemoveAiPhotoResult={removeAiPhotoResult}
            hasGeminiKey={!!(personalInfo.geminiApiKey || "").trim()}
            geminiKey={(personalInfo.geminiApiKey || "").trim()}
            onAddEntries={(entries) => addEntries(addMeal, entries)}
            onSaveFoods={addCustomFoodsBulk}
            onSaveAiRecipe={(r) => saveCustomRecipes([...customRecipes, r])}
            allRecipes={allRecipes}
            onPickRecipeFromAdd={(r, isCustom) => { setSelectedRecipe(r); setRecipeIsCustom(isCustom); setServingsToAdd(1); setView("recipeDetailFromAdd"); }}
          />
        )}

        {view === "recipeDetailFromAdd" && selectedRecipe && (
          <RecipeDetail
            recipe={selectedRecipe} isCustom={recipeIsCustom}
            servingsToAdd={servingsToAdd} setServingsToAdd={setServingsToAdd}
            onBack={() => setView("add")}
            onAdd={() => addRecipeToJournal(selectedRecipe)}
            onDelete={recipeIsCustom ? () => deleteCustomRecipe(selectedRecipe.id) : null}
            showAddMealPicker={false} addMeal={addMeal} setAddMeal={setAddMeal} onPlan={planAdd}
          />
        )}

        {view === "recipes" && !selectedRecipe && !showBuilder && (
          <RecipesView
            recipeTab={recipeTab} setRecipeTab={setRecipeTab}
            recipes={visibleRecipes} pantry={pantry} setPantry={setPantry}
            fridgeExtras={fridgeExtras} setFridgeExtras={setFridgeExtras}
            shopping={shopping} setShopping={setShopping}
            onAddShopping={addShoppingItems}
            planningView={
              <PlanningView plan={mealPlan} onChangePlan={changePlan} recipes={allRecipes} templates={mealTemplates}
                goalKcal={goals.kcal} haveNames={[...[...pantry].map((id) => foodById[id]?.name).filter(Boolean), ...fridgeExtras]}
                onAddShopping={addShoppingItems} onLog={logPlanned} />
            }
            geminiKey={(personalInfo.geminiApiKey || "").trim()}
            fridgeCtx={{ objectif: personalInfo.objectif, kcalLeft: currentDate === todayISO() ? goals.kcal - totals.kcal : goals.kcal }}
            onSaveRecipe={(r) => saveCustomRecipes([...customRecipes, r])}
            onSelect={(r, isCustom) => { setSelectedRecipe(r); setRecipeIsCustom(isCustom); setServingsToAdd(1); }}
            onNewRecipe={() => setShowBuilder(true)}
            extLoading={extLoading} extResults={extResults} extError={extError}
            onSearchExternal={searchExternalRecipes} onSaveExternalRecipe={saveExternalRecipe}
          />
        )}

        {view === "recipes" && selectedRecipe && (
          <RecipeDetail
            recipe={selectedRecipe} isCustom={recipeIsCustom}
            servingsToAdd={servingsToAdd} setServingsToAdd={setServingsToAdd}
            onBack={() => setSelectedRecipe(null)}
            onAdd={() => addRecipeToJournal(selectedRecipe)}
            onDelete={recipeIsCustom ? () => deleteCustomRecipe(selectedRecipe.id) : null}
            showAddMealPicker addMeal={addMeal} setAddMeal={setAddMeal} onPlan={planAdd}
          />
        )}

        {view === "recipes" && showBuilder && (
          <RecipeBuilder
            name={builderName} setName={setBuilderName}
            servings={builderServings} setServings={setBuilderServings}
            pasCher={builderPasCher} setPasCher={setBuilderPasCher}
            ingredients={builderIngredients} setIngredients={setBuilderIngredients}
            onAddIngredient={addBuilderIngredient}
            onSave={saveCustomRecipe}
            customFoods={customFoods}
            onCancel={() => { setShowBuilder(false); setBuilderIngredients([]); setBuilderName(""); }}
          />
        )}

        {view === "bilan" && (
          <BilanView days={allDays} goals={goals} workouts={workouts} weightStats={weightStats} onBack={() => setView("dashboard")} />
        )}

        {view === "sport" && (
          <SportView personalInfo={personalInfo} workouts={workouts} onSaveWorkouts={saveWorkouts}
            settings={sportSettings} onSaveSettings={saveSportSettings} />
        )}

        {view === "body" && (
          <WeightView key={bodyTab} initialTab={bodyTab} weights={weights} onSaveWeights={saveWeights} measures={measures} onSaveMeasures={saveMeasures}
            personalInfo={personalInfo} onSavePersonalInfo={savePersonalInfo} days={allDays} goals={goals}
            onApplyKcal={applyKcalGoal} onBack={() => setView("dashboard")} />
        )}

        {view === "profile" && (
          <ProfileView goals={goals} onSave={saveGoals} personalInfo={personalInfo} onSavePersonalInfo={savePersonalInfo}
            sportSettings={sportSettings} onSaveSportSettings={saveSportSettings} bodyFat={bodyFat}
            weightStats={weightStats} onOpenBody={(t) => { setBodyTab(t || "poids"); setView("body"); }} />
        )}

        <BottomNav view={navView}
          onNav={(v) => { setSelectedRecipe(null); setShowBuilder(false); if (v === "add") openAdd(addMeal); else setView(v); }} />
      </div>
    </div>
  );
}


/* ---------------------------------------------------------------- */
/* NAVIGATION                                                         */
/* ---------------------------------------------------------------- */
function BottomNav({ view, onNav }) {
  const items = [
    ["dashboard", "Aujourd'hui", Home],
    ["recipes", "Recettes", BookOpen],
    ["add", "Ajouter", Plus],
    ["sport", "Sport", Dumbbell],
    ["profile", "Profil", User],
  ];
  return (
    <div style={{
      position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480,
      background: C.card, borderTop: `1px solid ${C.line}`, display: "flex", justifyContent: "space-around",
      padding: "10px 8px calc(10px + env(safe-area-inset-bottom))",
    }}>
      {items.map(([k, label, Icon]) => {
        const active = view === k;
        const isFab = k === "add";
        return (
          <button key={k} onClick={() => onNav(k)} style={{
            background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
            color: active ? C.herb : C.inkSoft, padding: 4,
          }}>
            <div style={isFab ? {
              background: C.herb, width: 40, height: 40, borderRadius: 999, display: "flex", alignItems: "center",
              justifyContent: "center", marginTop: -20, boxShadow: "0 4px 10px rgba(47,74,60,0.35)",
            } : {}}>
              <Icon size={19} color={isFab ? C.onAccent : (active ? C.herb : C.inkSoft)} strokeWidth={active ? 2.4 : 2} />
            </div>
            <span style={{ fontSize: 10.5, fontWeight: active ? 600 : 500 }}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
