// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Les auteurs de NutriMaison
import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Plus, Droplet, ChevronLeft, ChevronRight, Search, X, Check, Camera,
  Trash2, BookOpen, User, Home, Loader2, Minus, ChefHat, Wallet, Salad, ShoppingBag, Calculator, ScanLine, Eye, EyeOff, Sparkles, Dumbbell, Scale, Footprints, Flame, Download, Upload, Pencil, MoreHorizontal, ChevronDown
} from "lucide-react";
import { MealActions, NewProductForm, Per100Fields } from "./MealTools.jsx";
import { FridgeInput, FridgeAi, ShoppingList, addToShopping } from "./Fridge.jsx";
import { startLiveScan, decodeImageFile, openCamera } from "./scanner.js";
import { geminiGenerate, parseJSONLoose, clearGeminiModelCache, resolveGeminiModel, shrinkImage } from "./gemini.js";
import {
  storage, C, todayISO, addDays, frDate, frShort, round, uid, Ring, Tag, SectionTitle, NumInput,
  loadJSON, saveJSON, loadAllDays, stepsKcal, bmrMifflin, bmi, weekStart, MONO, SERIF, inputStyle,
} from "./shared.jsx";
import { SportView, SPORT_DEFAULTS, workoutsKcalOn, plannedWeeklySportKcal, Toggle } from "./Sport.jsx";
import { WeightView, useWeightStats, latestBodyFat, navyBodyFat, armyBodyFat } from "./Weight.jsx";
import { HealthConnectCard } from "./HealthConnectCard.jsx";
import { AiTextMeal, aiFoodPer100 } from "./AiMeal.jsx";
import { BilanView } from "./Bilan.jsx";
import pkgInfo from "../package.json";
const APP_VERSION = pkgInfo.version;
import { loadReminders, saveReminders, syncReminders, ensureNotifPermission, remindersAvailable, testReminder } from "./reminders.js";
import { searchCiqual, useCiqualReady, CIQUAL_CITATION } from "./ciqualDb.js";
import { hcSync, loadHC, isNativeAndroid, originLabel } from "./healthconnect.js";

const FONT_IMPORT =
  "@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Work+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap');";

const MEAL_LABELS = {
  petitdej: "Petit-déjeuner",
  dejeuner: "Déjeuner",
  diner: "Dîner",
  collation: "Collations",
};
const MEAL_ORDER = ["petitdej", "dejeuner", "diner", "collation"];

/* ---------------------------------------------------------------- */
/* BASE DE DONNÉES ALIMENTS (valeurs pour 100 g)                     */
/* ---------------------------------------------------------------- */
const FOOD_DB = [
  { id: "riz_blanc", name: "Riz blanc cuit", kcal: 130, prot: 2.7, carbs: 28, fat: 0.3 },
  { id: "riz_complet", name: "Riz complet cuit", kcal: 111, prot: 2.6, carbs: 23, fat: 0.9 },
  { id: "pates", name: "Pâtes cuites", kcal: 131, prot: 5, carbs: 25, fat: 1.1 },
  { id: "pain_blanc", name: "Pain blanc", kcal: 265, prot: 9, carbs: 49, fat: 3.2 },
  { id: "pain_complet", name: "Pain complet", kcal: 247, prot: 13, carbs: 41, fat: 3.4 },
  { id: "pomme_de_terre", name: "Pomme de terre cuite", kcal: 87, prot: 2, carbs: 20, fat: 0.1 },
  { id: "lentilles", name: "Lentilles cuites", kcal: 116, prot: 9, carbs: 20, fat: 0.4 },
  { id: "pois_chiches", name: "Pois chiches cuits", kcal: 164, prot: 8.9, carbs: 27, fat: 2.6 },
  { id: "haricots_rouges", name: "Haricots rouges cuits", kcal: 127, prot: 8.7, carbs: 22.8, fat: 0.5 },
  { id: "quinoa", name: "Quinoa cuit", kcal: 120, prot: 4.4, carbs: 21.3, fat: 1.9 },
  { id: "avoine", name: "Flocons d'avoine", kcal: 389, prot: 16.9, carbs: 66, fat: 6.9 },
  { id: "oeuf", name: "Œuf entier", kcal: 155, prot: 13, carbs: 1.1, fat: 11 },
  { id: "lait", name: "Lait demi-écrémé", kcal: 46, prot: 3.3, carbs: 4.8, fat: 1.6 },
  { id: "yaourt", name: "Yaourt nature", kcal: 61, prot: 3.5, carbs: 4.7, fat: 3.3 },
  { id: "fromage_blanc", name: "Fromage blanc 20%", kcal: 78, prot: 8, carbs: 4, fat: 3 },
  { id: "fromage_rape", name: "Fromage râpé (emmental)", kcal: 380, prot: 28, carbs: 0.5, fat: 29 },
  { id: "poulet", name: "Blanc de poulet cuit", kcal: 165, prot: 31, carbs: 0, fat: 3.6 },
  { id: "boeuf_hache", name: "Bœuf haché 5% MG", kcal: 137, prot: 21, carbs: 0, fat: 5 },
  { id: "porc_filet", name: "Filet de porc", kcal: 143, prot: 26, carbs: 0, fat: 3.5 },
  { id: "saumon", name: "Saumon cru", kcal: 208, prot: 20, carbs: 0, fat: 13 },
  { id: "thon", name: "Thon en boîte au naturel", kcal: 116, prot: 26, carbs: 0, fat: 1 },
  { id: "cabillaud", name: "Cabillaud", kcal: 82, prot: 18, carbs: 0, fat: 0.7 },
  { id: "jambon", name: "Jambon blanc", kcal: 145, prot: 20, carbs: 1, fat: 6 },
  { id: "tofu", name: "Tofu nature", kcal: 76, prot: 8, carbs: 1.9, fat: 4.8 },
  { id: "huile_olive", name: "Huile d'olive", kcal: 884, prot: 0, carbs: 0, fat: 100 },
  { id: "beurre", name: "Beurre", kcal: 717, prot: 0.9, carbs: 0.1, fat: 81 },
  { id: "tomate", name: "Tomate", kcal: 18, prot: 0.9, carbs: 3.9, fat: 0.2 },
  { id: "oignon", name: "Oignon", kcal: 40, prot: 1.1, carbs: 9.3, fat: 0.1 },
  { id: "carotte", name: "Carotte", kcal: 41, prot: 0.9, carbs: 10, fat: 0.2 },
  { id: "courgette", name: "Courgette", kcal: 17, prot: 1.2, carbs: 3.1, fat: 0.3 },
  { id: "brocoli", name: "Brocoli", kcal: 34, prot: 2.8, carbs: 7, fat: 0.4 },
  { id: "epinards", name: "Épinards", kcal: 23, prot: 2.9, carbs: 3.6, fat: 0.4 },
  { id: "poivron", name: "Poivron", kcal: 31, prot: 1, carbs: 6, fat: 0.3 },
  { id: "champignon", name: "Champignon de Paris", kcal: 22, prot: 3.1, carbs: 3.3, fat: 0.3 },
  { id: "salade", name: "Salade verte", kcal: 15, prot: 1.4, carbs: 2.9, fat: 0.2 },
  { id: "concombre", name: "Concombre", kcal: 15, prot: 0.7, carbs: 3.6, fat: 0.1 },
  { id: "ail", name: "Ail", kcal: 149, prot: 6.4, carbs: 33, fat: 0.5 },
  { id: "banane", name: "Banane", kcal: 89, prot: 1.1, carbs: 23, fat: 0.3 },
  { id: "pomme", name: "Pomme", kcal: 52, prot: 0.3, carbs: 14, fat: 0.2 },
  { id: "orange", name: "Orange", kcal: 47, prot: 0.9, carbs: 12, fat: 0.1 },
  { id: "fraise", name: "Fraise", kcal: 32, prot: 0.7, carbs: 7.7, fat: 0.3 },
  { id: "avocat", name: "Avocat", kcal: 160, prot: 2, carbs: 8.5, fat: 15 },
  { id: "amandes", name: "Amandes", kcal: 579, prot: 21, carbs: 22, fat: 50 },
  { id: "noix", name: "Noix", kcal: 654, prot: 15, carbs: 14, fat: 65 },
  { id: "miel", name: "Miel", kcal: 304, prot: 0.3, carbs: 82, fat: 0 },
  { id: "sucre", name: "Sucre blanc", kcal: 387, prot: 0, carbs: 100, fat: 0 },
  { id: "chocolat_noir", name: "Chocolat noir 70%", kcal: 598, prot: 7.8, carbs: 46, fat: 43 },
  { id: "creme_fraiche", name: "Crème fraîche", kcal: 292, prot: 2.5, carbs: 3.3, fat: 30 },
  { id: "mozzarella", name: "Mozzarella", kcal: 280, prot: 18, carbs: 2.2, fat: 22 },
  { id: "pate_a_tartiner", name: "Pâte à tartiner", kcal: 539, prot: 6.3, carbs: 57, fat: 31 },
  { id: "farine", name: "Farine de blé", kcal: 364, prot: 10, carbs: 76, fat: 1 },
  { id: "lait_coco", name: "Lait de coco", kcal: 230, prot: 2.3, carbs: 6, fat: 24 },
  { id: "curry", name: "Curry en poudre", kcal: 325, prot: 14, carbs: 58, fat: 14 },
  { id: "sauce_soja", name: "Sauce soja", kcal: 53, prot: 8, carbs: 5, fat: 0.1 },
  { id: "moutarde", name: "Moutarde", kcal: 66, prot: 4, carbs: 5, fat: 3.3 },
  { id: "pois_verts", name: "Petits pois", kcal: 81, prot: 5.4, carbs: 14, fat: 0.4 },
  { id: "mais", name: "Maïs doux", kcal: 86, prot: 3.3, carbs: 19, fat: 1.2 },
  { id: "betterave", name: "Betterave cuite", kcal: 44, prot: 1.7, carbs: 10, fat: 0.2 },
  { id: "citron", name: "Citron", kcal: 29, prot: 1.1, carbs: 9.3, fat: 0.3 },
  { id: "pate_tomate", name: "Concentré de tomate", kcal: 82, prot: 4.3, carbs: 19, fat: 0.5 },
  { id: "feta", name: "Feta", kcal: 264, prot: 14, carbs: 4, fat: 21 },
  { id: "houmous", name: "Houmous", kcal: 166, prot: 7.9, carbs: 14, fat: 9.6 },
  { id: "yaourt_grec", name: "Yaourt grec", kcal: 133, prot: 9, carbs: 4, fat: 7 },
  { id: "pain_pita", name: "Pain pita", kcal: 275, prot: 9, carbs: 55, fat: 2 },
  { id: "olives", name: "Olives", kcal: 115, prot: 0.8, carbs: 6, fat: 10.7 },
  { id: "semoule", name: "Semoule cuite", kcal: 112, prot: 3.8, carbs: 23, fat: 0.2 },
  { id: "crevettes", name: "Crevettes cuites", kcal: 99, prot: 24, carbs: 0.2, fat: 0.3 },
];
FOOD_DB.push(
  { id: "x_tortilla_ble", name: "Tortilla / wrap de blé", kcal: 310, prot: 8.5, carbs: 51, fat: 7.5 },
  { id: "x_pain_pita", name: "Pain pita", kcal: 275, prot: 9, carbs: 55, fat: 1.2 },
  { id: "x_pain_burger", name: "Pain à burger", kcal: 280, prot: 9, carbs: 49, fat: 4.5 },
  { id: "x_galette_sarrasin", name: "Galette de sarrasin (crêpe salée)", kcal: 175, prot: 5.5, carbs: 33, fat: 1.5 },
  { id: "x_cheddar", name: "Cheddar", kcal: 403, prot: 25, carbs: 1.3, fat: 33 },
  { id: "x_mozzarella", name: "Mozzarella", kcal: 250, prot: 18, carbs: 1, fat: 19 },
  { id: "x_creme_fraiche", name: "Crème fraîche épaisse 30 %", kcal: 292, prot: 2.4, carbs: 3, fat: 30 },
  { id: "x_creme_legere", name: "Crème fraîche légère 15 %", kcal: 160, prot: 3, carbs: 4, fat: 15 },
  { id: "x_guacamole", name: "Guacamole", kcal: 155, prot: 2, carbs: 8.5, fat: 13 },
  { id: "x_houmous", name: "Houmous", kcal: 300, prot: 7.5, carbs: 14, fat: 24 },
  { id: "x_ketchup", name: "Ketchup", kcal: 110, prot: 1.2, carbs: 25, fat: 0.2 },
  { id: "x_mayonnaise", name: "Mayonnaise", kcal: 700, prot: 1.3, carbs: 1.5, fat: 77 },
  { id: "x_sauce_blanche", name: "Sauce blanche (kebab)", kcal: 380, prot: 1.5, carbs: 6, fat: 39 },
  { id: "x_semoule", name: "Semoule cuite", kcal: 112, prot: 3.8, carbs: 23, fat: 0.2 },
  { id: "x_quinoa", name: "Quinoa cuit", kcal: 120, prot: 4.4, carbs: 21, fat: 1.9 },
  { id: "x_lentilles", name: "Lentilles cuites", kcal: 116, prot: 9, carbs: 17, fat: 0.4 },
  { id: "x_pois_chiches", name: "Pois chiches cuits", kcal: 140, prot: 7.5, carbs: 20, fat: 2.5 },
  { id: "x_haricots_rouges", name: "Haricots rouges cuits", kcal: 115, prot: 8, carbs: 16, fat: 0.5 },
);
const foodById = Object.fromEntries(FOOD_DB.map((f) => [f.id, f]));

/* ---- Recherche tolérante : sans accents, mot à mot ("tortilla de ble" trouve "Tortilla / wrap de blé") ---- */
const STOP = new Set(["de", "du", "des", "la", "le", "les", "l", "d", "au", "aux", "a", "en", "et", "un", "une", "avec", "sans"]);
function norm(s) { return String(s || "").replace(/œ/gi, "oe").replace(/æ/gi, "ae").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }
function queryTokens(q) { return norm(q).split(/[^a-z0-9]+/).filter((t) => t && !STOP.has(t)); }
function matchesQuery(name, tokens) {
  if (!tokens.length) return true;
  const n = norm(name);
  // tolère le pluriel simple (tortillas ↔ tortilla)
  return tokens.every((t) => n.includes(t) || (t.endsWith("s") && n.includes(t.slice(0, -1))));
}
function scoreMatch(name, q) { const n = norm(name), nq = norm(q).trim(); return n.startsWith(nq) ? 0 : n.includes(nq) ? 1 : 2; }

/* ---- Open Food Facts : recherche plein texte (l'API v2 ne cherche pas par texte) ---- */
function mapOffProduct(p) {
  const n = p.nutriments || {};
  const kcal = n["energy-kcal_100g"] ?? (n["energy_100g"] != null ? n["energy_100g"] / 4.184 : null);
  const name = p.product_name_fr || p.product_name;
  if (!name || kcal == null) return null;
  const brand = Array.isArray(p.brands) ? p.brands[0] : (p.brands || "").split(",")[0].trim();
  return {
    id: "off_" + p.code, name: name + (brand ? " – " + brand : ""), brand: true, image: p.image_small_url || null,
    kcal: Number(kcal) || 0, prot: Number(n["proteins_100g"]) || 0,
    carbs: Number(n["carbohydrates_100g"]) || 0, fat: Number(n["fat_100g"]) || 0,
  };
}
async function offTextSearch(q, size = 20) {
  const fields = "code,product_name,product_name_fr,brands,nutriments,image_small_url";
  const enc = encodeURIComponent(q);
  const attempts = [
    // moteur de recherche récent d'Open Food Facts (meilleure pertinence)
    async () => (await (await fetch(`https://search.openfoodfacts.org/search?q=${enc}&langs=fr&page_size=${size}&fields=${fields}`)).json()).hits,
    // ancien moteur plein texte (search.pl), en secours
    async () => (await (await fetch(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${enc}&search_simple=1&action=process&json=1&lc=fr&page_size=${size}&fields=${fields}`)).json()).products,
  ];
  for (const run of attempts) {
    try {
      const list = (await run()) || [];
      const mapped = list.map(mapOffProduct).filter(Boolean);
      if (mapped.length) return mapped;
    } catch (e) { /* on essaie le moteur suivant */ }
  }
  return [];
}

/* Produits de marque courants (valeurs approximatives pour 100 g / 100 ml) —
   disponibles hors-ligne, en complément de la recherche Open Food Facts en direct. */
const BRAND_DB = [
  { id: "brand_jambon_poulet_fm", name: "Jambon de poulet – Fleury Michon", kcal: 97, prot: 18, carbs: 1, fat: 2.5 },
  { id: "brand_jambon_sup_fm", name: "Jambon supérieur – Fleury Michon", kcal: 107, prot: 20, carbs: 0.5, fat: 3 },
  { id: "brand_cordon_bleu_fm", name: "Cordon bleu de poulet – Fleury Michon", kcal: 196, prot: 14, carbs: 12, fat: 10 },
  { id: "brand_quiche_lorraine_fm", name: "Quiche lorraine – Fleury Michon", kcal: 275, prot: 9, carbs: 17, fat: 19 },
  { id: "brand_knacki_herta", name: "Knacki – Herta", kcal: 259, prot: 11, carbs: 2, fat: 23 },
  { id: "brand_strasbourg_herta", name: "Saucisse de Strasbourg – Herta", kcal: 273, prot: 12, carbs: 1, fat: 24 },
  { id: "brand_steak15_charal", name: "Steak haché 15% – Charal", kcal: 215, prot: 18, carbs: 0, fat: 15 },
  { id: "brand_steak5_charal", name: "Steak haché 5% – Charal", kcal: 139, prot: 20, carbs: 0, fat: 5 },
  { id: "brand_petitsuisse_danone", name: "Petit Suisse nature – Danone", kcal: 108, prot: 8, carbs: 4, fat: 6.5 },
  { id: "brand_danette_choc", name: "Danette chocolat – Danone", kcal: 132, prot: 3.4, carbs: 19.5, fat: 4.7 },
  { id: "brand_activia_nature", name: "Activia nature – Danone", kcal: 68, prot: 3.9, carbs: 4.7, fat: 3.7 },
  { id: "brand_actimel_nature", name: "Actimel nature – Danone", kcal: 74, prot: 2.9, carbs: 12.5, fat: 1.5 },
  { id: "brand_nutella", name: "Pâte à tartiner – Nutella (Ferrero)", kcal: 539, prot: 6.3, carbs: 57.5, fat: 30.9 },
  { id: "brand_pates_barilla", name: "Pâtes cuites – Barilla", kcal: 158, prot: 5.7, carbs: 31, fat: 1.1 },
  { id: "brand_riz_taureau", name: "Riz cuit – Taureau Ailé", kcal: 130, prot: 2.6, carbs: 28.6, fat: 0.3 },
  { id: "brand_sauce_tomate_panzani", name: "Sauce tomate cuisinée – Panzani", kcal: 58, prot: 1.5, carbs: 8, fat: 2 },
  { id: "brand_compote_andros", name: "Compote pomme sans sucre ajouté – Andros", kcal: 55, prot: 0.3, carbs: 13, fat: 0.1 },
  { id: "brand_petit_ecolier", name: "Petit Écolier chocolat au lait – LU", kcal: 481, prot: 6.6, carbs: 62, fat: 22 },
  { id: "brand_prince", name: "Prince chocolat – LU", kcal: 468, prot: 6.5, carbs: 65, fat: 19 },
  { id: "brand_miel_pops", name: "Miel Pops – Kellogg's", kcal: 376, prot: 5, carbs: 86, fat: 1 },
  { id: "brand_chocapic", name: "Chocapic – Nestlé", kcal: 393, prot: 7, carbs: 76, fat: 5.5 },
  { id: "brand_lait_lactel", name: "Lait demi-écrémé – Lactel", kcal: 46, prot: 3.2, carbs: 4.8, fat: 1.6 },
  { id: "brand_camembert_president", name: "Camembert – Président", kcal: 291, prot: 20, carbs: 0.5, fat: 23 },
  { id: "brand_vache_qui_rit", name: "La Vache qui rit", kcal: 267, prot: 10, carbs: 3, fat: 24 },
  { id: "brand_beurre_president", name: "Beurre doux – Président", kcal: 726, prot: 0.7, carbs: 0.5, fat: 82 },
  { id: "brand_pizza_buitoni", name: "Pizza Royale – Buitoni", kcal: 245, prot: 11, carbs: 26, fat: 10.5 },
  { id: "brand_poelee_bonduelle", name: "Poêlée provençale – Bonduelle", kcal: 45, prot: 1.5, carbs: 6, fat: 1.2 },
  { id: "brand_petitpois_bonduelle", name: "Petits pois carottes – Bonduelle", kcal: 58, prot: 3.3, carbs: 8.5, fat: 0.5 },
  { id: "brand_thon_petitnavire", name: "Thon au naturel – Petit Navire", kcal: 106, prot: 24, carbs: 0, fat: 0.8 },
  { id: "brand_sardines_connetable", name: "Sardines à l'huile – Connétable", kcal: 210, prot: 20, carbs: 0, fat: 14 },
  { id: "brand_chips_lays", name: "Chips nature – Lay's", kcal: 536, prot: 6.5, carbs: 52, fat: 34 },
  { id: "brand_coca", name: "Coca-Cola (100 ml)", kcal: 42, prot: 0, carbs: 10.6, fat: 0 },
  { id: "brand_bounty", name: "Bounty", kcal: 471, prot: 4.6, carbs: 58, fat: 24 },
  { id: "brand_kinder_bueno", name: "Kinder Bueno", kcal: 570, prot: 7.5, carbs: 53, fat: 37 },
  { id: "brand_emmental_president", name: "Emmental râpé – Président", kcal: 380, prot: 27, carbs: 0.5, fat: 29 },
  { id: "brand_jambon_cru_aoste", name: "Jambon cru – Aoste", kcal: 195, prot: 29, carbs: 0, fat: 9 },
  { id: "brand_poulet_marie", name: "Poulet rôti – Marie", kcal: 155, prot: 25, carbs: 1, fat: 5.5 },
  { id: "brand_saumon_labeyrie", name: "Saumon fumé – Labeyrie", kcal: 184, prot: 22, carbs: 0, fat: 10 },
  { id: "brand_pain_harrys", name: "Pain de mie complet – Harrys", kcal: 231, prot: 10, carbs: 38, fat: 3.7 },
].map((f) => ({ ...f, brand: true }));

const PANTRY_ITEMS = [
  "riz_blanc", "pates", "pomme_de_terre", "lentilles", "pois_chiches",
  "haricots_rouges", "oeuf", "lait", "fromage_rape", "poulet", "boeuf_hache",
  "thon", "tofu", "huile_olive", "beurre", "tomate", "oignon", "carotte",
  "courgette", "poivron", "champignon", "salade", "ail", "banane",
  "avoine", "creme_fraiche", "lait_coco", "curry", "pate_tomate", "mais",
];

/* Correspondance anglais → français pour les objets détectables par COCO-SSD (détection
   photo 100% locale, gratuite, sans clé — modèle TensorFlow.js téléchargé une seule fois). */
const COCO_FOOD_LABELS = {
  banana: { fr: "Banane", foodId: "banane" },
  apple: { fr: "Pomme", foodId: "pomme" },
  orange: { fr: "Orange", foodId: "orange" },
  carrot: { fr: "Carotte", foodId: "carotte" },
  broccoli: { fr: "Brocoli", foodId: "brocoli" },
  sandwich: { fr: "Sandwich", foodId: null },
  pizza: { fr: "Pizza", foodId: null },
  "hot dog": { fr: "Hot-dog", foodId: null },
  donut: { fr: "Donut", foodId: null },
  cake: { fr: "Gâteau", foodId: null },
};

/* Mots-clés MobileNet (classification ImageNet ~1000 classes) → français. Complète COCO-SSD
   avec beaucoup plus de plats préparés reconnaissables. Correspondance par sous-chaîne car
   MobileNet renvoie parfois plusieurs synonymes dans un seul label (ex: "French loaf, French bread"). */
const MOBILENET_FOOD_KEYWORDS = [
  { kw: "cheeseburger", fr: "Cheeseburger", foodId: null },
  { kw: "hotdog", fr: "Hot-dog", foodId: null },
  { kw: "hot dog", fr: "Hot-dog", foodId: null },
  { kw: "pizza", fr: "Pizza", foodId: null },
  { kw: "ice cream", fr: "Glace", foodId: null },
  { kw: "ice lolly", fr: "Glace à l'eau", foodId: null },
  { kw: "guacamole", fr: "Guacamole", foodId: "avocat" },
  { kw: "pretzel", fr: "Bretzel", foodId: null },
  { kw: "bagel", fr: "Bagel", foodId: null },
  { kw: "meat loaf", fr: "Pain de viande", foodId: null },
  { kw: "burrito", fr: "Burrito", foodId: null },
  { kw: "red wine", fr: "Vin rouge", foodId: null },
  { kw: "espresso", fr: "Café espresso", foodId: null },
  { kw: "french loaf", fr: "Pain", foodId: "pain_blanc" },
  { kw: "trifle", fr: "Trifle (dessert)", foodId: null },
  { kw: "potpie", fr: "Tourte", foodId: null },
  { kw: "mashed potato", fr: "Purée de pommes de terre", foodId: "pomme_de_terre" },
  { kw: "broccoli", fr: "Brocoli", foodId: "brocoli" },
  { kw: "cauliflower", fr: "Chou-fleur", foodId: null },
  { kw: "mushroom", fr: "Champignon", foodId: "champignon" },
  { kw: "ear of corn", fr: "Maïs", foodId: "mais" },
  { kw: "cucumber", fr: "Concombre", foodId: "concombre" },
  { kw: "bell pepper", fr: "Poivron", foodId: "poivron" },
  { kw: "zucchini", fr: "Courgette", foodId: "courgette" },
  { kw: "orange", fr: "Orange", foodId: "orange" },
  { kw: "lemon", fr: "Citron", foodId: "citron" },
  { kw: "fig", fr: "Figue", foodId: null },
  { kw: "pineapple", fr: "Ananas", foodId: null },
  { kw: "banana", fr: "Banane", foodId: "banane" },
  { kw: "pomegranate", fr: "Grenade", foodId: null },
  { kw: "strawberry", fr: "Fraise", foodId: "fraise" },
  { kw: "artichoke", fr: "Artichaut", foodId: null },
  { kw: "head cabbage", fr: "Chou", foodId: null },
  { kw: "butternut squash", fr: "Courge butternut", foodId: null },
  { kw: "acorn squash", fr: "Courge poivrée", foodId: null },
  { kw: "chocolate sauce", fr: "Sauce chocolat", foodId: "chocolat_noir" },
];

/* Correspondance français → anglais pour les ingrédients du placard, utilisée pour
   interroger TheMealDB (API publique gratuite, clé de démo partagée "1", aucun compte requis). */
const PANTRY_EN = {
  riz_blanc: "rice", pates: "pasta", pomme_de_terre: "potato", lentilles: "lentils",
  pois_chiches: "chickpeas", haricots_rouges: "kidney_beans", oeuf: "egg", lait: "milk",
  fromage_rape: "cheese", poulet: "chicken", boeuf_hache: "beef", thon: "tuna",
  tofu: "tofu", huile_olive: "olive_oil", beurre: "butter", tomate: "tomato",
  oignon: "onion", carotte: "carrot", courgette: "zucchini", poivron: "pepper",
  champignon: "mushroom", salade: "lettuce", ail: "garlic", banane: "banana",
  avoine: "oats", creme_fraiche: "cream", lait_coco: "coconut_milk", curry: "curry",
  pate_tomate: "tomato_paste", mais: "sweetcorn",
};

/* ---------------------------------------------------------------- */
/* RECETTES                                                          */
/* ---------------------------------------------------------------- */
const RECIPES = [
  { id: "r1", name: "Riz cantonais maison", categorie: "Plat", pasCher: true, servings: 2,
    ingredients: [["riz_blanc",300],["oeuf",100],["jambon",80],["pois_verts",80],["mais",60],["huile_olive",10],["sauce_soja",15]],
    steps: ["Faire chauffer l'huile dans un wok.", "Battre les œufs et les cuire en petits morceaux.", "Ajouter le riz, le jambon, les petits pois et le maïs.", "Assaisonner à la sauce soja et servir chaud."] },
  { id: "r2", name: "Dahl de lentilles", categorie: "Plat", pasCher: true, servings: 2,
    ingredients: [["lentilles",400],["oignon",80],["ail",10],["lait_coco",100],["curry",5],["huile_olive",10],["tomate",100]],
    steps: ["Faire revenir l'oignon et l'ail dans l'huile.", "Ajouter le curry, la tomate puis les lentilles.", "Verser le lait de coco et laisser mijoter 15 min."] },
  { id: "r3", name: "Chili sin carne", categorie: "Plat", pasCher: true, servings: 2,
    ingredients: [["haricots_rouges",300],["pois_chiches",150],["oignon",100],["poivron",100],["pate_tomate",60],["mais",80],["curry",5]],
    steps: ["Faire revenir l'oignon et le poivron.", "Ajouter le concentré de tomate et les épices.", "Incorporer les haricots, pois chiches et maïs, mijoter 20 min."] },
  { id: "r4", name: "Omelette aux champignons", categorie: "Petit-déjeuner", pasCher: true, servings: 1,
    ingredients: [["oeuf",150],["champignon",100],["beurre",10],["fromage_rape",30]],
    steps: ["Faire revenir les champignons dans le beurre.", "Battre les œufs, verser sur les champignons.", "Ajouter le fromage et plier l'omelette."] },
  { id: "r5", name: "Poulet rôti et légumes", categorie: "Plat", pasCher: false, servings: 2,
    ingredients: [["poulet",300],["pomme_de_terre",300],["carotte",150],["huile_olive",15]],
    steps: ["Préchauffer le four à 200°C.", "Disposer le poulet et les légumes avec l'huile.", "Cuire 35-40 minutes en retournant à mi-cuisson."] },
  { id: "r6", name: "Saumon vapeur, quinoa et brocoli", categorie: "Plat", pasCher: false, servings: 2,
    ingredients: [["saumon",250],["quinoa",200],["brocoli",150],["citron",20],["huile_olive",10]],
    steps: ["Cuire le quinoa selon les instructions.", "Cuire le saumon et le brocoli à la vapeur 10-12 min.", "Assaisonner d'un filet d'huile d'olive et de citron."] },
  { id: "r7", name: "Salade de thon", categorie: "Plat", pasCher: true, servings: 2,
    ingredients: [["thon",160],["salade",100],["tomate",100],["concombre",100],["oeuf",50],["huile_olive",10]],
    steps: ["Mélanger la salade, tomate et concombre.", "Ajouter le thon égoutté et l'œuf dur en quartiers.", "Assaisonner d'huile d'olive."] },
  { id: "r8", name: "Pâtes à la carbonara maison", categorie: "Plat", pasCher: true, servings: 2,
    ingredients: [["pates",400],["jambon",100],["oeuf",100],["creme_fraiche",60],["fromage_rape",40]],
    steps: ["Cuire les pâtes al dente.", "Mélanger œufs, crème et fromage hors du feu.", "Ajouter le jambon poêlé et les pâtes égouttées, bien mélanger."] },
  { id: "r9", name: "Curry de tofu", categorie: "Plat", pasCher: true, servings: 2,
    ingredients: [["tofu",250],["lait_coco",200],["curry",8],["poivron",100],["oignon",80],["riz_blanc",300]],
    steps: ["Faire dorer le tofu coupé en cubes.", "Ajouter oignon, poivron et curry, faire revenir.", "Verser le lait de coco, mijoter 10 min, servir avec le riz."] },
  { id: "r10", name: "Porridge banane-miel", categorie: "Petit-déjeuner", pasCher: true, servings: 1,
    ingredients: [["avoine",80],["lait",250],["banane",100],["miel",15]],
    steps: ["Chauffer le lait avec les flocons d'avoine 5 min.", "Verser dans un bol, ajouter la banane en rondelles.", "Terminer avec un filet de miel."] },
  { id: "r11", name: "Bowl fromage blanc et fruits", categorie: "Petit-déjeuner", pasCher: true, servings: 1,
    ingredients: [["fromage_blanc",200],["fraise",100],["banane",80],["amandes",15],["miel",10]],
    steps: ["Verser le fromage blanc dans un bol.", "Ajouter les fruits coupés et les amandes.", "Terminer avec un filet de miel."] },
  { id: "r12", name: "Steak haché, purée maison", categorie: "Plat", pasCher: true, servings: 2,
    ingredients: [["boeuf_hache",200],["pomme_de_terre",400],["beurre",20],["lait",50]],
    steps: ["Cuire les pommes de terre à l'eau puis les écraser.", "Ajouter beurre et lait à la purée.", "Cuire le steak haché à la poêle et servir ensemble."] },
  { id: "r13", name: "Ratatouille maison", categorie: "Plat", pasCher: true, servings: 2,
    ingredients: [["courgette",200],["poivron",150],["tomate",300],["oignon",100],["ail",10],["huile_olive",20]],
    steps: ["Faire revenir l'oignon et l'ail dans l'huile.", "Ajouter tous les légumes coupés en dés.", "Laisser mijoter 30 minutes à couvert."] },
  { id: "r14", name: "Wrap poulet crudités", categorie: "Plat", pasCher: true, servings: 1,
    ingredients: [["poulet",150],["salade",50],["tomate",80],["fromage_rape",30],["pain_blanc",100]],
    steps: ["Faire chauffer légèrement la galette ou le pain plat.", "Garnir de poulet, crudités et fromage.", "Rouler fermement et couper en deux."] },
  { id: "r15", name: "Gratin de courgettes", categorie: "Plat", pasCher: true, servings: 2,
    ingredients: [["courgette",400],["creme_fraiche",100],["fromage_rape",80],["ail",10],["huile_olive",10]],
    steps: ["Couper les courgettes en rondelles et les faire suer.", "Mélanger avec la crème et l'ail.", "Couvrir de fromage et gratiner 20 min au four à 200°C."] },
  { id: "r16", name: "Mousse chocolat-avocat", categorie: "Dessert", pasCher: false, servings: 2,
    ingredients: [["avocat",200],["chocolat_noir",60],["miel",30],["lait_coco",50]],
    steps: ["Faire fondre le chocolat.", "Mixer l'avocat, le chocolat fondu, le miel et le lait de coco.", "Répartir dans des verrines et réfrigérer 1h."] },
  { id: "r17", name: "Soupe de légumes maison", categorie: "Soupe", pasCher: true, servings: 2,
    ingredients: [["carotte",300],["pomme_de_terre",200],["oignon",100],["huile_olive",10]],
    steps: ["Faire revenir l'oignon dans l'huile.", "Ajouter les légumes coupés et couvrir d'eau.", "Cuire 25 min puis mixer."] },
  { id: "r18", name: "Velouté de courgettes", categorie: "Soupe", pasCher: true, servings: 2,
    ingredients: [["courgette",400],["pomme_de_terre",100],["creme_fraiche",50],["ail",5]],
    steps: ["Cuire les courgettes, la pomme de terre et l'ail à l'eau 20 min.", "Mixer avec la crème fraîche.", "Rectifier l'assaisonnement et servir chaud."] },
  { id: "r19", name: "Salade grecque", categorie: "Plat", pasCher: true, servings: 2,
    ingredients: [["tomate",150],["concombre",150],["feta",100],["olives",30],["huile_olive",15]],
    steps: ["Couper tomate et concombre en dés.", "Ajouter la feta en cubes et les olives.", "Assaisonner d'huile d'olive."] },
  { id: "r20", name: "Houmous maison et pain pita", categorie: "Snack", pasCher: true, servings: 2,
    ingredients: [["houmous",200],["pain_pita",100]],
    steps: ["Tartiner le houmous dans une assiette.", "Réchauffer légèrement le pain pita.", "Découper en triangles et servir."] },
  { id: "r21", name: "Bowl crevettes, avocat et quinoa", categorie: "Plat", pasCher: false, servings: 2,
    ingredients: [["crevettes",200],["avocat",150],["quinoa",200],["citron",20]],
    steps: ["Cuire le quinoa selon les instructions.", "Répartir quinoa, crevettes et avocat en bowl.", "Arroser de jus de citron."] },
  { id: "r22", name: "Taboulé de semoule", categorie: "Plat", pasCher: true, servings: 2,
    ingredients: [["semoule",200],["tomate",150],["concombre",100],["citron",20],["huile_olive",15],["salade",50]],
    steps: ["Préparer la semoule selon les instructions et laisser refroidir.", "Ajouter les légumes coupés en petits dés.", "Assaisonner d'huile d'olive et de citron."] },
  { id: "r23", name: "Yaourt grec, miel et noix", categorie: "Petit-déjeuner", pasCher: true, servings: 1,
    ingredients: [["yaourt_grec",200],["miel",20],["noix",20]],
    steps: ["Verser le yaourt grec dans un bol.", "Ajouter les noix concassées.", "Terminer avec un filet de miel."] },
  { id: "r24", name: "Pancakes maison", categorie: "Petit-déjeuner", pasCher: true, servings: 3,
    ingredients: [["farine",150],["oeuf",100],["lait",200],["beurre",20],["sucre",20]],
    steps: ["Mélanger farine, sucre, œufs et lait pour obtenir une pâte lisse.", "Cuire des petites louches de pâte à la poêle beurrée.", "Retourner dès l'apparition de bulles et dorer l'autre face."] },
  { id: "r25", name: "Crêpes maison", categorie: "Petit-déjeuner", pasCher: true, servings: 4,
    ingredients: [["farine",250],["oeuf",150],["lait",500],["beurre",30]],
    steps: ["Mélanger la farine avec les œufs puis délayer avec le lait.", "Laisser reposer la pâte 30 min.", "Cuire les crêpes dans une poêle beurrée bien chaude."] },
  { id: "r26", name: "Tartine avocat-œuf", categorie: "Petit-déjeuner", pasCher: true, servings: 1,
    ingredients: [["pain_complet",80],["avocat",100],["oeuf",100]],
    steps: ["Griller le pain complet.", "Écraser l'avocat dessus.", "Ajouter un œuf poché ou dur en tranches."] },
  { id: "r27", name: "Poêlée de tofu et légumes", categorie: "Plat", pasCher: true, servings: 2,
    ingredients: [["tofu",200],["courgette",150],["poivron",150],["carotte",100],["sauce_soja",15],["huile_olive",10]],
    steps: ["Faire dorer le tofu coupé en cubes dans l'huile.", "Ajouter les légumes émincés et faire sauter 8-10 min.", "Assaisonner à la sauce soja."] },
  { id: "r28", name: "Riz sauté végétarien", categorie: "Plat", pasCher: true, servings: 2,
    ingredients: [["riz_blanc",300],["carotte",100],["pois_verts",80],["oeuf",100],["sauce_soja",15],["huile_olive",10]],
    steps: ["Faire chauffer l'huile dans un wok.", "Ajouter carotte et petits pois, faire revenir.", "Pousser sur le côté, cuire l'œuf brouillé, puis mélanger avec le riz et la sauce soja."] },
  { id: "r29", name: "Salade de pois chiches", categorie: "Plat", pasCher: true, servings: 2,
    ingredients: [["pois_chiches",300],["tomate",150],["oignon",50],["citron",15],["huile_olive",15],["salade",50]],
    steps: ["Mélanger pois chiches, tomate et oignon émincé.", "Ajouter la salade.", "Assaisonner d'huile d'olive et de citron."] },
  { id: "r30", name: "Wrap thon crudités", categorie: "Plat", pasCher: true, servings: 1,
    ingredients: [["thon",160],["salade",50],["tomate",80],["pain_blanc",100],["fromage_blanc",30]],
    steps: ["Tartiner le pain plat de fromage blanc.", "Garnir de thon égoutté et de crudités.", "Rouler fermement et couper en deux."] },
  { id: "r31", name: "Barres énergétiques maison", categorie: "Snack", pasCher: true, servings: 6,
    ingredients: [["avoine",150],["miel",80],["amandes",80],["chocolat_noir",40]],
    steps: ["Faire tiédir le miel et y mélanger l'avoine et les amandes concassées.", "Presser fermement dans un moule rectangulaire.", "Réfrigérer 1h, napper de chocolat fondu, puis découper en barres."] },
  { id: "r32", name: "Smoothie banane-avoine", categorie: "Petit-déjeuner", pasCher: true, servings: 1,
    ingredients: [["banane",150],["avoine",40],["lait",200],["miel",10]],
    steps: ["Mixer tous les ingrédients ensemble.", "Ajuster la texture avec un peu de lait si besoin.", "Servir frais."] },
  { id: "r33", name: "Fraises et chantilly", categorie: "Dessert", pasCher: false, servings: 2,
    ingredients: [["fraise",250],["creme_fraiche",100],["sucre",20]],
    steps: ["Laver et équeuter les fraises.", "Fouetter la crème avec le sucre jusqu'à consistance ferme.", "Servir les fraises nappées de chantilly."] },
  { id: "r34", name: "Compote de pommes maison", categorie: "Dessert", pasCher: true, servings: 3,
    ingredients: [["pomme",400],["sucre",20],["citron",10]],
    steps: ["Éplucher et couper les pommes en morceaux.", "Cuire à couvert avec un peu d'eau et le jus de citron 15 min.", "Écraser à la fourchette ou mixer selon la texture souhaitée."] },
  { id: "r35", name: "Salade de fruits frais", categorie: "Dessert", pasCher: true, servings: 2,
    ingredients: [["banane",100],["pomme",100],["orange",100],["fraise",100],["miel",10]],
    steps: ["Couper tous les fruits en morceaux.", "Mélanger dans un saladier.", "Arroser d'un filet de miel."] },
  { id: "r36", name: "Gratin dauphinois léger", categorie: "Plat", pasCher: true, servings: 2,
    ingredients: [["pomme_de_terre",500],["lait",200],["creme_fraiche",50],["ail",5],["fromage_rape",40]],
    steps: ["Couper les pommes de terre en fines rondelles.", "Disposer en couches dans un plat avec lait, crème et ail.", "Couvrir de fromage et cuire 45 min à 180°C."] },
];

/* ---------------------------------------------------------------- */
/* HELPERS                                                           */
/* ---------------------------------------------------------------- */
function macrosFromGrams(foodId, grams) {
  const f = foodById[foodId];
  if (!f) return { kcal: 0, prot: 0, carbs: 0, fat: 0 };
  const m = grams / 100;
  return { kcal: round(f.kcal * m), prot: round(f.prot * m), carbs: round(f.carbs * m), fat: round(f.fat * m) };
}
function calcFromFood(food, grams) {
  const m = grams / 100;
  return { kcal: round(food.kcal * m), prot: round(food.prot * m), carbs: round(food.carbs * m), fat: round(food.fat * m) };
}
function ingredientData(ing) {
  // Format "recette prête" : [foodId, grammes] -> résolu via la base locale
  if (Array.isArray(ing)) {
    const [id, g] = ing;
    const f = foodById[id];
    return { name: f ? f.name : id, grams: g, brand: false, ...macrosFromGrams(id, g) };
  }
  // Format "recette maison" : valeurs pour 100g intégrées (aliment local ou produit de marque)
  const g = Number(ing.grams) || 0;
  const m = g / 100;
  return {
    name: ing.name, grams: g, brand: !!ing.brand,
    kcal: round(ing.kcal100 * m), prot: round(ing.prot100 * m), carbs: round(ing.carbs100 * m), fat: round(ing.fat100 * m),
  };
}
function recipeTotals(recipe) {
  if (recipe.noNutrition) return { kcal: 0, prot: 0, carbs: 0, fat: 0 };
  if (recipe.aiTotals) return recipe.aiTotals;
  return recipe.ingredients.reduce(
    (acc, ing) => {
      const d = ingredientData(ing);
      return { kcal: acc.kcal + d.kcal, prot: acc.prot + d.prot, carbs: acc.carbs + d.carbs, fat: acc.fat + d.fat };
    },
    { kcal: 0, prot: 0, carbs: 0, fat: 0 }
  );
}
/**
 * Eau apportée par un aliment, estimée depuis ses macros : poids − protéines − glucides − lipides − ~2 % (fibres, minéraux).
 * Ex. 150 g de concombre ≈ 143 ml, 100 g de pâtes sèches ≈ 10 ml, huile ≈ 0.
 */
function entryWaterMl(e) {
  if (!e) return 0;
  if (e.water != null) return Math.max(0, Number(e.water) || 0);
  const g = Number(e.grams);
  if (!g) return 0;
  const dry = (Number(e.prot) || 0) + (Number(e.carbs) || 0) + (Number(e.fat) || 0);
  return Math.max(0, g - dry - g * 0.02);
}
function dayFoodWaterMl(day) {
  if (!day || !day.meals) return 0;
  return Object.values(day.meals).reduce((s, list) => s + (list || []).reduce((a, e) => a + entryWaterMl(e), 0), 0);
}
function recipeWaterPerServing(recipe) {
  if (recipe.noNutrition || recipe.aiTotals || !recipe.ingredients?.length) return null;
  const tot = recipe.ingredients.reduce((acc, ing) => {
    const d = ingredientData(ing);
    return acc + Math.max(0, d.grams - d.prot - d.carbs - d.fat - d.grams * 0.02);
  }, 0);
  return tot / (recipe.servings || 1);
}

function emptyDay() {
  return { meals: { petitdej: [], dejeuner: [], diner: [], collation: [] }, water: 0 };
}
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result.split(",")[1]);
    r.onerror = () => reject(new Error("Lecture du fichier impossible"));
    r.readAsDataURL(file);
  });
}
/* ---------------------------------------------------------------- */
/* PETITS COMPOSANTS UI                                              */
/* ---------------------------------------------------------------- */
function MacroBar({ label, value, goal, color, bg }) {
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
/* ---- « Mon frigo » : reconnaître ce que j'ai dans les ingrédients des recettes ---- */
const STAPLES_RE = /^(sel|poivre|eau|huile|epices?|herbes|vinaigre|ail|persil|ciboulette|sucre|bouillon|curry|paprika|cumin|moutarde|jus de citron)\b/;
const STAPLE_IDS = new Set(["huile_olive", "ail", "curry"]);
/** Familles : « fromage » reconnaît emmental, feta…, « tortilla » reconnaît wrap… */
const FRIDGE_FAMILIES = [
  [/^fromages?$/, /\b(fromage(?! (blanc|frais))|emmental|mozzarella|feta|cheddar|parmesan|comte|chevre|gruyere|raclette|reblochon|camembert|brie|roquefort|ricotta)/],
  [/^(oeufs?|oeuf entier)$/, /\boeufs?\b/],
  [/^(tortillas?|wraps?|galettes? de ble)$/, /\b(tortillas?|wraps?)\b/],
  [/^pates?$/, /\b(pates?|spaghettis?|penne|tagliatelles?|macaronis?|coquillettes?|fusillis?|nouilles?)\b/],
  [/^(viande hachee|steak hache|boeuf hache)$/, /\b(hache|boeuf)/],
  [/^yaourts?$/, /\b(yaourts?|skyr|fromage blanc)\b/],
  [/^jambons?$/, /\bjambon/],
  [/^pains?$/, /\b(pain|baguette)/],
  [/^salade$/, /\b(salade|laitue|mache|roquette)\b/],
];
function fridgeMatchers(names) {
  const out = [];
  names.forEach((raw) => {
    const n = norm(raw).replace(/\(.*?\)/g, "").trim();
    if (!n) return;
    let fam = false;
    FRIDGE_FAMILIES.forEach(([k, re]) => { if (k.test(n)) { out.push(re); fam = true; } });
    if (fam) return; // la famille suffit (et évite « fromage » → « fromage blanc »)
    // mot principal (« Fromage râpé (emmental) » → fromage, « Poulet, blanc » → poulet), pluriel toléré
    const w = n.split(/[\s,/]+/).find((x) => x.length >= 3 && !/^(de|du|des|aux?|la|le|les)$/.test(x));
    if (w) out.push(new RegExp("\\b" + w.replace(/s$/, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(s|x)?\\b"));
  });
  return out;
}

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
            allDays={allDays} mealTemplates={mealTemplates}
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
            showAddMealPicker={false} addMeal={addMeal} setAddMeal={setAddMeal}
          />
        )}

        {view === "recipes" && !selectedRecipe && !showBuilder && (
          <RecipesView
            recipeTab={recipeTab} setRecipeTab={setRecipeTab}
            recipes={visibleRecipes} pantry={pantry} setPantry={setPantry}
            fridgeExtras={fridgeExtras} setFridgeExtras={setFridgeExtras}
            shopping={shopping} setShopping={setShopping}
            onAddShopping={(names, from) => setShopping(addToShopping(shopping, names, from).next)}
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
            showAddMealPicker addMeal={addMeal} setAddMeal={setAddMeal}
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
/* DASHBOARD                                                         */
/* ---------------------------------------------------------------- */
function Dashboard({ currentDate, setCurrentDate, dayData, totals, goals, onOpenAdd, onDeleteEntry, onChangeWater, onEditEntry,
  yesterday, onCopyMeal, favorites, onToggleFavorite,
  allDays, mealTemplates, onCopyIn, onCopyTo, onSaveTemplate, onDeleteTemplate, onAddTemplate, onClearMeal, onScaleMeal,
  activity, sportSettings, onSetSteps, weightStats, bodyFat, onOpenSport, onOpenBody, onOpenBilan }) {
  const isToday = currentDate === todayISO();
  const [editing, setEditing] = useState(null); // "meal:id"
  const [mealMenu, setMealMenu] = useState(null);
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
        <div style={{ textAlign: "center" }}>
          <p style={{ margin: 0, fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: 17, color: C.ink }}>
            {isToday ? "Aujourd'hui" : frDate(currentDate)}
          </p>
          {isToday && <p style={{ margin: 0, fontSize: 12, color: C.inkSoft }}>{frDate(currentDate)}</p>}
        </div>
        <button onClick={() => setCurrentDate(addDays(currentDate, 1))} style={{ background: "none", border: "none", padding: 8, color: C.herb }}>
          <ChevronRight size={20} />
        </button>
      </div>

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
        background: C.herb, borderRadius: 20, padding: "16px 20px", marginBottom: 16,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Droplet size={22} color="#BEEAD4" fill="#BEEAD4" />
          <div>
            <p style={{ margin: 0, fontFamily: "'IBM Plex Mono',monospace", color: "#fff", fontSize: 16, fontWeight: 600 }}>
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
          <button onClick={() => onChangeWater(-waterQuick)} aria-label={`Retirer ${waterQuick} ml`} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 999, width: 30, height: 30, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Minus size={14} />
          </button>
          <button onClick={() => onChangeWater(waterQuick)} style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: 999, padding: "0 12px", color: "#fff", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>
            +{waterQuick} ml
          </button>
          <button onClick={() => setWaterOpen(!waterOpen)} aria-label="Choisir une quantité" style={{ background: "#fff", border: "none", borderRadius: 999, width: 30, height: 30, color: C.herb, display: "flex", alignItems: "center", justifyContent: "center", transform: waterOpen ? "rotate(45deg)" : "none", transition: "transform .2s" }}>
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
function scaleEntry(e, f) {
  if (f === 1) return e;
  return {
    ...e,
    grams: e.grams ? Math.round(e.grams * f) : null,
    kcal: round(e.kcal * f), prot: round(e.prot * f), carbs: round(e.carbs * f), fat: round(e.fat * f),
    ...(e.water != null ? { water: Math.round(e.water * f) } : {}),
    ...(e.portions != null || !e.grams ? { portions: Math.round((e.portions || 1) * f * 100) / 100 } : {}),
  };
}
const FRACTIONS = [[0.25, "¼"], [1 / 3, "⅓"], [0.5, "½"], [2 / 3, "⅔"], [0.75, "¾"]];

/** Édition d'un aliment du journal : quantité, repas, jour. */
function EntryEditor({ entry, meal, currentDate, onSave, onCancel, onDelete, isFavorite, onToggleFavorite }) {
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
    background: active ? C.herb : C.card, color: active ? "#fff" : C.ink, whiteSpace: "nowrap",
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
          <button onClick={onDelete} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", background: C.berry, color: "#fff", fontWeight: 600, fontSize: 13 }}>Supprimer ?</button>
        ) : (
          <button onClick={() => setConfirmDel(true)} style={{ padding: "10px 12px", borderRadius: 10, border: "none", background: C.berryLight, color: C.berry }} aria-label="Supprimer"><Trash2 size={15} /></button>
        )}
        <button onClick={onCancel} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: `1px solid ${C.line}`, background: "transparent", color: C.inkSoft, fontSize: 13 }}>Annuler</button>
        <button disabled={!(factor > 0)} onClick={() => onSave({ factor, toMeal, toDate })} style={{ flex: 2, padding: "10px 0", borderRadius: 10, border: "none", background: C.herb, color: "#fff", fontWeight: 600, fontSize: 13 }}>
          {toDate !== currentDate ? `Déplacer au ${frShort(toDate)}` : "Enregistrer"}
        </button>
      </div>
    </div>
  );
}

/** Choix de la quantité d'eau : contenants courants + quantité libre, ajout ou retrait. */
const WATER_SIZES = [
  [100, "Petit verre"], [150, "Tasse"], [200, "Verre"], [250, "Mug"],
  [330, "Canette"], [500, "Bouteille 50 cl"], [750, "Gourde"], [1000, "1 litre"], [1500, "Bouteille 1,5 L"],
];
function WaterPicker({ quick, onPick }) {
  const [remove, setRemove] = useState(false);
  const [custom, setCustom] = useState("");
  const sign = remove ? -1 : 1;
  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: 12, margin: "-8px 0 16px" }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        {[[false, "Ajouter"], [true, "Retirer"]].map(([v, l]) => (
          <button key={l} onClick={() => setRemove(v)} style={{
            flex: 1, padding: "7px 0", borderRadius: 999, border: "none", fontSize: 12.5, fontWeight: 600,
            background: remove === v ? (v ? C.berry : C.herb) : C.paperDark, color: remove === v ? "#fff" : C.inkSoft,
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
          padding: "0 14px", borderRadius: 10, border: "none", background: remove ? C.berry : C.herb, color: "#fff", fontWeight: 600, fontSize: 13,
          opacity: Number(custom) > 0 ? 1 : 0.5,
        }}>OK</button>
      </div>
      <p style={{ fontSize: 10.5, color: C.inkSoft, margin: "6px 0 0" }}>La dernière quantité ajoutée devient le bouton rapide.</p>
    </div>
  );
}

function ActivityCard({ activity, sportSettings, onSetSteps, onOpenSport, goals }) {
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
              <button onClick={() => { onSetSteps(val === "" ? null : Number(val)); setEditing(false); }} style={{ background: C.herb, color: "#fff", border: "none", borderRadius: 9, padding: "0 12px" }}><Check size={15} /></button>
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
        <button onClick={onOpenSport} style={{ background: C.herb, color: "#fff", border: "none", borderRadius: 999, padding: "7px 12px", fontSize: 12, fontWeight: 600 }}>Sport ›</button>
      </div>
      <p style={{ margin: "10px 0 0", fontSize: 11, color: C.inkSoft, lineHeight: 1.45 }}>
        {eat > 0
          ? `Objectif ajusté : ${goals.kcal} ${activity.bonus >= 0 ? "+" : "−"} ${Math.abs(activity.bonus)} kcal (${Math.round(eat * 100)} % de l'activité du jour au-delà de l'habituel).`
          : "Tes pas habituels et ton sport prévu sont déjà inclus dans ton objectif : les calories dépensées ne sont pas rajoutées (réglable dans Profil)."}
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* AJOUTER UN ALIMENT                                                 */
/* ---------------------------------------------------------------- */
/** Caméra intégrée à l'app pour photographier un repas (ne dépend pas de l'appareil photo d'Android). */
function MealCamera({ onCapture, onCancel }) {
  const videoRef = useRef(null);
  const camRef = useRef(null);
  const [error, setError] = useState(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    openCamera(videoRef.current).then((cam) => {
      if (!alive) { cam.stop(); return; }
      camRef.current = cam; setReady(true);
    }).catch((e) => setError(e && e.name === "NotAllowedError"
      ? "Accès à la caméra refusé. Autorise la caméra pour NutriMaison dans les paramètres Android."
      : "Impossible d'ouvrir la caméra."));
    return () => { alive = false; try { camRef.current?.stop(); } catch (e) {} };
  }, []);
  async function shoot() {
    if (!camRef.current) return;
    try { navigator.vibrate && navigator.vibrate(60); } catch (e) {}
    const file = await camRef.current.snap();
    camRef.current.stop();
    onCapture(file);
  }
  return (
    <div>
      <div style={{ position: "relative", borderRadius: 16, overflow: "hidden", background: "#000", marginBottom: 10 }}>
        <video ref={videoRef} muted playsInline autoPlay style={{ width: "100%", height: 320, objectFit: "cover", display: "block" }} />
        {!ready && !error && <p style={{ position: "absolute", inset: 0, margin: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13 }}>Ouverture de la caméra…</p>}
      </div>
      {error && <p style={{ color: C.berry, fontSize: 12.5, margin: "0 0 10px" }}>{error}</p>}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button onClick={onCancel} style={{ flex: 1, padding: "12px 0", borderRadius: 12, border: `1px solid ${C.line}`, background: C.card, color: C.inkSoft, fontSize: 13 }}>Annuler</button>
        <button onClick={shoot} disabled={!ready} aria-label="Prendre la photo" style={{
          width: 64, height: 64, borderRadius: 999, border: `4px solid ${C.sage}`, background: C.herb, opacity: ready ? 1 : 0.5, flexShrink: 0,
        }} />
        <div style={{ flex: 1 }} />
      </div>
      <p style={{ fontSize: 11.5, color: C.inkSoft, margin: "8px 0 0", lineHeight: 1.45 }}>Cadre l'assiette entière, vue de dessus, avec un bon éclairage.</p>
    </div>
  );
}

/** Favoris et aliments récents : un appui sur « + » ajoute la même quantité que la dernière fois. */
function QuickLists({ favorites, recents, onToggleFavorite, onQuickAdd, onPick, templates, onAddTemplate, onDeleteTemplate }) {
  const [tab, setTab] = useState(favorites?.length ? "fav" : "rec");
  const favKeys = new Set((favorites || []).map((f) => f.key));
  const list = tab === "fav" ? favorites || [] : recents || [];
  if (!(favorites || []).length && !(recents || []).length && !(templates || []).length) return null;
  const pill = (active) => ({ padding: "5px 12px", borderRadius: 999, border: "none", fontSize: 12, fontWeight: 600, background: active ? C.herb : C.paperDark, color: active ? "#fff" : C.inkSoft });
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        <button onClick={() => setTab("fav")} style={pill(tab === "fav")}>★ Favoris{favorites?.length ? ` (${favorites.length})` : ""}</button>
        <button onClick={() => setTab("rec")} style={pill(tab === "rec")}>Récents</button>
        <button onClick={() => setTab("tpl")} style={pill(tab === "tpl")}>Repas{templates?.length ? ` (${templates.length})` : ""}</button>
      </div>
      {tab === "tpl" ? (
        (templates || []).length === 0 ? (
          <p style={{ fontSize: 12, color: C.inkSoft, fontStyle: "italic", margin: 0 }}>
            Aucun repas type. Sur l'accueil, touche ⋯ à côté d'un repas → « Enregistrer comme repas type ».
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {templates.map((t) => (
              <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 6, background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: "6px 6px 6px 10px" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 13.5, fontWeight: 600 }}>★ {t.name}</span>
                  <span style={{ display: "block", fontSize: 11, color: C.inkSoft, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {Math.round(t.items.reduce((a, e) => a + (e.kcal || 0), 0))} kcal · {t.items.map((e) => e.name).join(", ")}
                  </span>
                </div>
                <button onClick={() => onDeleteTemplate(t.id)} aria-label="Supprimer" style={{ background: "none", border: "none", color: C.inkSoft, padding: 4 }}><Trash2 size={14} /></button>
                <button onClick={() => onAddTemplate(t)} aria-label="Ajouter le repas" style={{
                  background: C.sage, border: "none", borderRadius: 999, width: 32, height: 32, color: C.herb, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}><Plus size={16} /></button>
              </div>
            ))}
          </div>
        )
      ) : list.length === 0 ? (
        <p style={{ fontSize: 12, color: C.inkSoft, fontStyle: "italic", margin: 0 }}>
          {tab === "fav" ? "Aucun favori : touche ☆ sur un récent, ou sur un aliment du journal." : "Les aliments que tu notes apparaîtront ici."}
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {list.slice(0, 12).map((it) => (
            <div key={it.key} style={{ display: "flex", alignItems: "center", gap: 6, background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: "6px 6px 6px 10px" }}>
              <button onClick={() => onToggleFavorite(it)} aria-label="Favori" style={{ background: "none", border: "none", color: favKeys.has(it.key) ? C.ochre : C.line, fontSize: 17, padding: 2, lineHeight: 1 }}>
                {favKeys.has(it.key) ? "★" : "☆"}
              </button>
              <button onClick={() => { if (!onPick(it)) onQuickAdd(it); }} style={{ flex: 1, minWidth: 0, textAlign: "left", background: "none", border: "none", padding: "2px 0" }}>
                <span style={{ display: "block", fontSize: 13.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</span>
                <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: C.inkSoft }}>
                  {it.grams ? `${it.grams} g · ` : ""}{Math.round(it.kcal)} kcal{it.count > 1 ? ` · ${it.count}×` : ""}
                </span>
              </button>
              <button onClick={() => onQuickAdd(it)} aria-label="Ajouter tel quel" style={{
                background: C.sage, border: "none", borderRadius: 999, width: 32, height: 32, color: C.herb, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}><Plus size={16} /></button>
            </div>
          ))}
        </div>
      )}
      <p style={{ fontSize: 10.5, color: C.inkSoft, margin: "6px 0 0" }}>{tab === "tpl" ? "« + » ajoute tous les aliments du repas type d'un coup." : "« + » ajoute la même quantité que la dernière fois · touche le nom pour changer la quantité."}</p>
    </div>
  );
}

function ManualBarcode({ onSubmit, busy }) {
  const [code, setCode] = useState("");
  return (
    <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
      <input type="number" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Ou tape les chiffres du code"
        style={{ ...inputStyle, flex: 1, fontSize: 13.5 }} />
      <button disabled={busy || code.length < 8} onClick={() => onSubmit(code)} style={{
        background: C.herb, color: "#fff", border: "none", borderRadius: 10, padding: "0 14px", fontWeight: 600, fontSize: 13, opacity: busy || code.length < 8 ? 0.5 : 1,
      }}>OK</button>
    </div>
  );
}

function AddView(props) {
  const {
    addMeal, setAddMeal, addTab, setAddTab, onBack,
    searchQ, setSearchQ, filteredFoods, offResults, offLoading, offError, onAddCustomFood,
    favorites, recents, onToggleFavorite, onQuickAdd, onPickRecent,
    selectedFood, setSelectedFood, grams, setGrams, onConfirmManual,
    scanning, scanError, videoRef, onStartScan, onStopScan,
    scanMissing, onCancelMissing, onSaveNewProduct, mealTemplates, onAddTemplate, onDeleteTemplate,
    torchAvailable, torchOn, onToggleTorch, scanBusy, onScanPhoto, onScanManual,
    photoDetecting, photoDetections, photoAiResults, photoError, capturedImage, photoInputRef, onPickPhoto, onPhotoFileChange, onPickPhotoDetection, onPhotoFile, onCancelPhoto,
    onAddAiPhotoResults, onRemoveAiPhotoResult, hasGeminiKey, geminiKey, onAddEntries, onSaveFoods, onSaveAiRecipe,
    allRecipes, onPickRecipeFromAdd,
  } = props;

  const [customFormOpen, setCustomFormOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [aiLookup, setAiLookup] = useState(null);
  const [quickMsg, setQuickMsg] = useState(null);
  const [cfName, setCfName] = useState("");
  const [cfKcal, setCfKcal] = useState("");
  const [cfProt, setCfProt] = useState("");
  const [cfCarbs, setCfCarbs] = useState("");
  const [cfFat, setCfFat] = useState("");

  function submitCustomFood() {
    if (!cfName.trim() || cfKcal === "") return;
    const food = onAddCustomFood({
      name: cfName.trim(), kcal: Number(cfKcal) || 0, prot: Number(cfProt) || 0, carbs: Number(cfCarbs) || 0, fat: Number(cfFat) || 0,
    });
    setSelectedFood(food); setGrams(100);
    setCustomFormOpen(false); setCfName(""); setCfKcal(""); setCfProt(""); setCfCarbs(""); setCfFat("");
  }

  const previewMacros = selectedFood ? calcFromFood(selectedFood, grams) : null;
  const [editVals, setEditVals] = useState(false);
  useEffect(() => { if (!selectedFood?.edited) setEditVals(false); }, [selectedFood?.id]);
  const patchFood = (p) => setSelectedFood({ ...selectedFood, ...p, edited: true });

  return (
    <div style={{ padding: "24px 20px 8px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: C.herb, padding: 6 }}>
          <ChevronLeft size={20} />
        </button>
        <h2 style={{ margin: 0, fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: 20 }}>Ajouter un aliment</h2>
      </div>

      <div style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 12, color: C.inkSoft, marginBottom: 6 }}>Repas</p>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {MEAL_ORDER.map((m) => (
            <button key={m} onClick={() => setAddMeal(m)} style={{
              flexShrink: 0, padding: "7px 12px", borderRadius: 999, border: `1px solid ${addMeal === m ? C.herb : C.line}`,
              background: addMeal === m ? C.herb : C.card, color: addMeal === m ? "#fff" : C.ink, fontSize: 12.5, fontWeight: 500,
            }}>{MEAL_LABELS[m]}</button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 18, background: C.paperDark, borderRadius: 12, padding: 4 }}>
        {[["manuel", "Manuel"], ["scanner", "Scanner"], ["photo", "Photo"], ["ia", "Texte IA"], ["recette", "Recette"]].map(([k, label]) => (
          <button key={k} onClick={() => setAddTab(k)} style={{
            flex: 1, padding: "8px 0", borderRadius: 9, border: "none", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap",
            background: addTab === k ? C.card : "transparent", color: addTab === k ? C.herb : C.inkSoft,
          }}>{label}</button>
        ))}
      </div>

      {addTab === "manuel" && (
        <div>
          <div style={{ position: "relative", marginBottom: 14 }}>
            <Search size={16} color={C.inkSoft} style={{ position: "absolute", left: 12, top: 12 }} />
            <input
              value={searchQ} onChange={(e) => setSearchQ(e.target.value)} placeholder="Rechercher un aliment…"
              style={{ width: "100%", padding: "11px 12px 11px 36px", borderRadius: 12, border: `1px solid ${C.line}`, background: C.card, fontSize: 14, outline: "none" }}
            />
          </div>

          {!selectedFood ? (
            <div>
              {!searchQ.trim() && (
                <QuickLists favorites={favorites} recents={recents} onToggleFavorite={onToggleFavorite}
                  templates={mealTemplates} onDeleteTemplate={onDeleteTemplate}
                  onAddTemplate={(t) => { onAddTemplate(t); setQuickMsg(`${t.name} ajouté ✓`); setTimeout(() => setQuickMsg(null), 1800); }}
                  onQuickAdd={(it) => { onQuickAdd(it); setQuickMsg(`${it.name} ajouté ✓`); setTimeout(() => setQuickMsg(null), 1800); }}
                  onPick={onPickRecent} />
              )}
              {quickMsg && <p style={{ position: "sticky", top: 8, zIndex: 2, background: C.herb, color: "#fff", borderRadius: 10, padding: "8px 12px", fontSize: 12.5, margin: "0 0 10px", textAlign: "center" }}>{quickMsg}</p>}
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", margin: "0 0 6px", gap: 8 }}>
                <p style={{ fontSize: 11.5, fontWeight: 600, color: C.inkSoft, textTransform: "uppercase", letterSpacing: 0.4, margin: 0 }}>Aliments de base</p>
                {searchQ.trim() && <span style={{ fontSize: 10, color: C.inkSoft }}>Source : Anses, Ciqual 2025</span>}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 18 }}>
                {filteredFoods.map((f) => (
                  <button key={f.id} onClick={() => { setSelectedFood(f); setGrams(100); }} style={{
                    textAlign: "left", background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: "10px 12px",
                    display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
                  }}>
                    <span style={{ fontSize: 13.5, minWidth: 0 }}>
                      {f.name}
                      {f.group && <span style={{ display: "block", fontSize: 10.5, color: C.inkSoft }}>{f.group}</span>}
                    </span>
                    <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: C.inkSoft, flexShrink: 0 }}>{Math.round(f.kcal)} kcal/100g</span>
                  </button>
                ))}
                {filteredFoods.length === 0 && <p style={{ fontSize: 13, color: C.inkSoft, fontStyle: "italic" }}>Aucun résultat.</p>}
              </div>

              {searchQ.trim().length >= 2 && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "0 0 6px" }}>
                    <ShoppingBag size={12} color={C.inkSoft} />
                    <p style={{ fontSize: 11.5, fontWeight: 600, color: C.inkSoft, textTransform: "uppercase", letterSpacing: 0.4, margin: 0 }}>Produits de marque</p>
                    {offLoading && <Loader2 size={12} color={C.inkSoft} style={{ animation: "spin 1s linear infinite" }} />}
                  </div>
                  {offError && <p style={{ fontSize: 12, color: C.inkSoft, fontStyle: "italic" }}>{offError}</p>}
                  {!offError && !offLoading && offResults.length === 0 && (
                    <p style={{ fontSize: 12, color: C.inkSoft, fontStyle: "italic" }}>Aucun produit de marque trouvé.</p>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {offResults.map((f) => (
                      <button key={f.id} onClick={() => { setSelectedFood(f); setGrams(100); }} style={{
                        textAlign: "left", background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: "8px 12px",
                        display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                          {f.image ? (
                            <img src={f.image} alt="" style={{ width: 30, height: 30, borderRadius: 6, objectFit: "cover", flexShrink: 0, border: `1px solid ${C.line}` }} />
                          ) : (
                            <div style={{ width: 30, height: 30, borderRadius: 6, background: C.sage, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              <ShoppingBag size={13} color={C.herb} />
                            </div>
                          )}
                          <span style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                        </div>
                        <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: C.inkSoft, flexShrink: 0 }}>{Math.round(f.kcal)} kcal/100g</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {hasGeminiKey && searchQ.trim().length >= 2 && !offLoading && (
                <div style={{ marginTop: 10 }}>
                  <button onClick={async () => {
                    setAiLookup({ busy: true });
                    try { const f = await aiFoodPer100(geminiKey, searchQ, (t) => setAiLookup({ busy: true, status: t })); setAiLookup(null); setSelectedFood(f); setGrams(100); }
                    catch (e) { setAiLookup({ error: e.message || "erreur" }); }
                  }} disabled={aiLookup?.busy} style={{
                    width: "100%", padding: "9px 10px", borderRadius: 10, border: `1.5px solid ${C.ochre}`, background: C.ochreLight, color: C.ink,
                    fontSize: 12.5, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  }}>
                    {aiLookup?.busy ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Sparkles size={14} />}
                    {aiLookup?.busy ? (aiLookup.status || "Estimation…") : `Pas trouvé ? Estimer « ${searchQ.trim().slice(0, 30)} » avec l'IA`}
                  </button>
                  {aiLookup?.error && <p style={{ fontSize: 11.5, color: C.berry, margin: "4px 0 0" }}>IA : {aiLookup.error}</p>}
                </div>
              )}
              {!customFormOpen ? (
                <button onClick={() => setCustomFormOpen(true)} style={{
                  width: "100%", marginTop: 16, padding: "10px 0", borderRadius: 10, border: `1.5px dashed ${C.line}`, background: "transparent",
                  color: C.herb, fontSize: 12.5, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                }}>
                  <Plus size={14} /> Créer un aliment / produit personnalisé
                </button>
              ) : (
                <div style={{ marginTop: 16, background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: 14 }}>
                  <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 600 }}>Nouvel aliment (valeurs pour 100 g)</p>
                  <input value={cfName} onChange={(e) => setCfName(e.target.value)} placeholder="Nom (ex : Jambon de dinde – marque locale)"
                    style={{ width: "100%", padding: "9px 10px", borderRadius: 9, border: `1px solid ${C.line}`, fontSize: 13, marginBottom: 8 }} />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                    <input value={cfKcal} onChange={(e) => setCfKcal(e.target.value)} type="number" placeholder="Kcal"
                      style={{ padding: "9px 10px", borderRadius: 9, border: `1px solid ${C.line}`, fontSize: 13, fontFamily: "'IBM Plex Mono',monospace" }} />
                    <input value={cfProt} onChange={(e) => setCfProt(e.target.value)} type="number" placeholder="Protéines (g)"
                      style={{ padding: "9px 10px", borderRadius: 9, border: `1px solid ${C.line}`, fontSize: 13, fontFamily: "'IBM Plex Mono',monospace" }} />
                    <input value={cfCarbs} onChange={(e) => setCfCarbs(e.target.value)} type="number" placeholder="Glucides (g)"
                      style={{ padding: "9px 10px", borderRadius: 9, border: `1px solid ${C.line}`, fontSize: 13, fontFamily: "'IBM Plex Mono',monospace" }} />
                    <input value={cfFat} onChange={(e) => setCfFat(e.target.value)} type="number" placeholder="Lipides (g)"
                      style={{ padding: "9px 10px", borderRadius: 9, border: `1px solid ${C.line}`, fontSize: 13, fontFamily: "'IBM Plex Mono',monospace" }} />
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => setCustomFormOpen(false)} style={{ flex: 1, padding: "10px 0", borderRadius: 9, border: `1px solid ${C.line}`, background: "transparent", color: C.inkSoft, fontSize: 13 }}>
                      Annuler
                    </button>
                    <button onClick={submitCustomFood} style={{ flex: 2, padding: "10px 0", borderRadius: 9, border: "none", background: C.herb, color: "#fff", fontWeight: 600, fontSize: 13 }}>
                      Enregistrer et utiliser
                    </button>
                  </div>
                  <p style={{ fontSize: 11, color: C.inkSoft, margin: "8px 0 0" }}>Il sera ensuite disponible dans toutes tes recherches, y compris pour tes recettes.</p>
                </div>
              )}
            </div>
          ) : (
            <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  {selectedFood.image && (
                    <img src={selectedFood.image} alt="" style={{ width: 38, height: 38, borderRadius: 8, objectFit: "cover", border: `1px solid ${C.line}`, flexShrink: 0 }} />
                  )}
                  <p style={{ margin: 0, fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: 16 }}>{selectedFood.name}</p>
                </div>
                <button onClick={() => setSelectedFood(null)} style={{ background: "none", border: "none", color: C.inkSoft, flexShrink: 0 }}><X size={16} /></button>
              </div>
              {!editVals ? (
                <button onClick={() => setEditVals(true)} style={{
                  background: "none", border: "none", padding: 0, margin: "-6px 0 12px", color: C.herb, fontSize: 12.5, fontWeight: 600, textDecoration: "underline",
                }}>✎ Modifier les valeurs ({Math.round(selectedFood.kcal)} kcal · P{round(selectedFood.prot)} G{round(selectedFood.carbs)} L{round(selectedFood.fat)} / 100 g)</button>
              ) : (
                <div style={{ background: C.paperDark, borderRadius: 12, padding: 12, margin: "-4px 0 14px" }}>
                  <p style={{ margin: "0 0 8px", fontSize: 12.5, fontWeight: 600 }}>Valeurs pour 100 g <span style={{ fontWeight: 400, color: C.inkSoft }}>(recopie celles de ton emballage)</span></p>
                  <Per100Fields values={selectedFood} onChange={(v) => patchFood({ kcal: v.kcal ?? 0, prot: v.prot ?? 0, carbs: v.carbs ?? 0, fat: v.fat ?? 0, ciqual: false })} />
                  <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, fontSize: 12.5 }}>
                    <input type="checkbox" checked={!!selectedFood.remember} onChange={(e) => patchFood({ remember: e.target.checked })} style={{ width: 18, height: 18, accentColor: C.herb }} />
                    Mémoriser comme mon aliment
                  </label>
                  {selectedFood.remember && (
                    <input value={selectedFood.name} onChange={(e) => patchFood({ name: e.target.value })} placeholder="Nom de ton aliment"
                      style={{ ...inputStyle, width: "100%", marginTop: 8, fontSize: 13 }} />
                  )}
                  <p style={{ fontSize: 11, color: C.inkSoft, margin: "6px 0 0" }}>
                    {selectedFood.remember ? "Il sera proposé dans tes recherches (remplace un aliment perso du même nom)." : "Les valeurs modifiées ne servent que pour cet ajout."}
                  </p>
                </div>
              )}
              <label style={{ fontSize: 12, color: C.inkSoft }}>Quantité (g)</label>
              <NumInput
                value={grams} onChange={(v) => setGrams(v)} min={0}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${C.line}`, marginTop: 4, marginBottom: 14, fontFamily: "'IBM Plex Mono',monospace", fontSize: 15 }}
              />
              {selectedFood.ciqual && (
                <p style={{ margin: "-6px 0 10px", fontSize: 11.5, color: C.inkSoft, lineHeight: 1.5 }}>
                  Pour {grams} g : {[
                    selectedFood.sugar != null && `sucres ${round(selectedFood.sugar * grams / 100)} g`,
                    selectedFood.fiber != null && `fibres ${round(selectedFood.fiber * grams / 100)} g`,
                    selectedFood.satfat != null && `AG saturés ${round(selectedFood.satfat * grams / 100)} g`,
                    selectedFood.salt != null && `sel ${round(selectedFood.salt * grams / 100)} g`,
                    selectedFood.water100 != null && `eau ${Math.round(selectedFood.water100 * grams / 100)} ml`,
                  ].filter(Boolean).join(" · ")}
                  <span style={{ display: "block", fontSize: 10.5 }}>Valeurs : Anses, table Ciqual 2025</span>
                </p>
              )}
              {previewMacros && (
                <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                  <Tag color={C.herb} bg={C.sage}>{Math.round(previewMacros.kcal)} kcal</Tag>
                  <Tag color={C.berry} bg={C.berryLight}>P {previewMacros.prot}g</Tag>
                  <Tag color={C.ochre} bg={C.ochreLight}>G {previewMacros.carbs}g</Tag>
                  <Tag color={C.olive} bg={C.oliveLight}>L {previewMacros.fat}g</Tag>
                </div>
              )}
              <button onClick={onConfirmManual} style={{
                width: "100%", padding: "13px 0", borderRadius: 12, border: "none", background: C.herb, color: "#fff", fontWeight: 600, fontSize: 14,
              }}>Ajouter au journal</button>
            </div>
          )}
        </div>
      )}

      {addTab === "scanner" && (
        <div>
          <p style={{ fontSize: 12.5, color: C.inkSoft, margin: "0 0 12px" }}>
            Scanne le code-barres d'un produit emballé : ses valeurs nutritionnelles sont récupérées automatiquement depuis Open Food Facts.
          </p>

          <div style={{
            position: "relative", borderRadius: 16, overflow: "hidden", border: `1px solid ${C.line}`,
            marginBottom: 10, background: scanning ? "#000" : "transparent", minHeight: scanning ? 260 : 0,
          }}>
            <video ref={videoRef} style={{ width: "100%", display: scanning ? "block" : "none", height: 280, objectFit: "cover" }} muted playsInline autoPlay />
            {scanning && (
              <>
                <div style={{ position: "absolute", left: "10%", right: "10%", top: "25%", bottom: "25%", border: "2.5px solid rgba(255,255,255,0.85)", borderRadius: 12, boxShadow: "0 0 0 2000px rgba(0,0,0,0.25)", pointerEvents: "none" }} />
                <div style={{ position: "absolute", left: 0, right: 0, bottom: 8, textAlign: "center", color: "#fff", fontSize: 12, textShadow: "0 1px 3px #000" }}>
                  Place le code-barres dans le cadre, à 10-15 cm
                </div>
                {torchAvailable && (
                  <button onClick={onToggleTorch} style={{ position: "absolute", top: 10, right: 10, background: torchOn ? "#fff" : "rgba(0,0,0,0.5)", color: torchOn ? C.herb : "#fff", border: "none", borderRadius: 999, padding: "6px 12px", fontSize: 12, fontWeight: 600 }}>
                    {torchOn ? "Lampe ON" : "Lampe"}
                  </button>
                )}
              </>
            )}
          </div>

          {!scanning ? (
            <button onClick={onStartScan} disabled={scanBusy} style={{
              width: "100%", padding: "28px 0", borderRadius: 16, border: `1.5px dashed ${C.herb}`, background: C.sage,
              display: "flex", flexDirection: "column", alignItems: "center", gap: 10, color: C.herb,
            }}>
              {scanBusy ? <Loader2 size={26} style={{ animation: "spin 1s linear infinite" }} /> : <ScanLine size={26} />}
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>{scanBusy ? "Recherche du produit…" : "Scanner un code-barres"}</span>
            </button>
          ) : (
            <button onClick={onStopScan} style={{
              width: "100%", padding: "11px 0", borderRadius: 12, border: `1px solid ${C.line}`, background: C.card, color: C.inkSoft, fontSize: 13,
            }}>Annuler le scan</button>
          )}
          <style>{"@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}"}</style>

          {scanError && <p style={{ color: C.berry, fontSize: 13, marginTop: 10, marginBottom: 0 }}>{scanError}</p>}
          {scanMissing && !scanning && (
            <NewProductForm key={scanMissing.barcode} barcode={scanMissing.barcode} initialName={scanMissing.name}
              geminiKey={hasGeminiKey ? geminiKey : ""} onSave={onSaveNewProduct} onCancel={onCancelMissing} />
          )}

          <label style={{
            marginTop: 10, width: "100%", padding: "11px 0", borderRadius: 12, border: `1.5px solid ${C.herb}`, color: C.herb,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}>
            <Camera size={16} /> Prendre le code-barres en photo
            <input type="file" accept="image/*" capture="environment" style={{ display: "none" }}
              onChange={(e) => { onScanPhoto(e.target.files[0]); e.target.value = ""; }} />
          </label>
          <p style={{ fontSize: 11.5, color: C.inkSoft, margin: "6px 0 0", lineHeight: 1.45 }}>
            Plan B si le scan en direct n'accroche pas : l'appareil photo d'Android fait une meilleure mise au point.
          </p>

          <ManualBarcode onSubmit={onScanManual} busy={scanBusy} />

          <p style={{ fontSize: 11.5, color: C.inkSoft, marginTop: 14, lineHeight: 1.5 }}>
            Pas de code-barres sous la main ? Utilise l'onglet <strong>Manuel</strong> pour rechercher le produit par son nom.
          </p>
        </div>
      )}

      {addTab === "photo" && (
        <div>
          <p style={{ fontSize: 12.5, color: C.inkSoft, margin: "0 0 12px" }}>
            {hasGeminiKey
              ? "Reconnaissance IA précise via ta clé Gemini personnelle (gratuite, jamais partagée)."
              : "Détection locale et gratuite (aucune donnée envoyée nulle part). Reconnaît un nombre limité d'aliments — ajoute ta clé Gemini gratuite dans Profil pour une précision bien meilleure."}
          </p>
          <input ref={photoInputRef} type="file" accept="image/*" style={{ display: "none" }}
            onChange={(e) => { onPhotoFileChange(e); e.target.value = ""; }} />

          {cameraOpen ? (
            <MealCamera onCapture={(file) => { setCameraOpen(false); onPhotoFile(file); }} onCancel={() => setCameraOpen(false)} />
          ) : !capturedImage ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button onClick={() => setCameraOpen(true)} style={{
                width: "100%", padding: "30px 0", borderRadius: 16, border: `1.5px dashed ${C.herb}`, background: C.sage,
                display: "flex", flexDirection: "column", alignItems: "center", gap: 10, color: C.herb,
              }}>
                <Camera size={26} />
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>Prendre une photo</span>
              </button>
              <button onClick={onPickPhoto} style={{
                width: "100%", padding: "12px 0", borderRadius: 12, border: `1.5px solid ${C.herb}`, background: "transparent", color: C.herb, fontSize: 13, fontWeight: 600,
              }}>Choisir dans la galerie</button>
            </div>
          ) : (
            <div>
              <img src={capturedImage} alt="" style={{ width: "100%", borderRadius: 14, marginBottom: 10, maxHeight: 220, objectFit: "cover" }} />
              {photoDetecting && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <Loader2 size={15} color={C.herb} style={{ animation: "spin 1s linear infinite" }} />
                  <span style={{ fontSize: 12.5, color: C.inkSoft, flex: 1 }}>Analyse de la photo…</span>
                  <button onClick={onCancelPhoto} style={{ background: "none", border: `1px solid ${C.line}`, borderRadius: 999, padding: "4px 10px", fontSize: 12, color: C.inkSoft }}>Annuler</button>
                  <style>{"@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}"}</style>
                </div>
              )}

              {!photoDetecting && photoAiResults && photoAiResults.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <p style={{ fontSize: 12.5, color: C.inkSoft, margin: "0 0 10px" }}>Aliments détectés — vérifie avant d'ajouter :</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
                    {photoAiResults.map((p) => (
                      <div key={p.id} style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <p style={{ margin: 0, fontSize: 13.5, fontWeight: 500 }}>{p.name}</p>
                          <p style={{ margin: 0, fontSize: 11, color: C.inkSoft, fontFamily: "'IBM Plex Mono',monospace" }}>
                            {p.grams} g · {Math.round(p.kcal)} kcal · P{round(p.prot)} G{round(p.carbs)} L{round(p.fat)}
                          </p>
                        </div>
                        <button onClick={() => onRemoveAiPhotoResult(p.id)} style={{ background: "none", border: "none", color: C.berry, padding: 4 }}><X size={15} /></button>
                      </div>
                    ))}
                  </div>
                  <button onClick={onAddAiPhotoResults} style={{ width: "100%", padding: "13px 0", borderRadius: 12, border: "none", background: C.herb, color: "#fff", fontWeight: 600, fontSize: 14, marginBottom: 10 }}>
                    Ajouter au journal
                  </button>
                </div>
              )}

              {!photoDetecting && !photoAiResults && photoDetections.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <p style={{ fontSize: 12, color: C.inkSoft, margin: "0 0 8px" }}>Aliments repérés — touche pour préremplir la recherche :</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {photoDetections.map((d, i) => (
                      <button key={i} onClick={() => onPickPhotoDetection(d)} style={{
                        padding: "7px 12px", borderRadius: 999, border: `1px solid ${C.herb}`, background: C.sage, color: C.herb, fontSize: 12.5, fontWeight: 600,
                      }}>{d.label} · {Math.round(d.score * 100)}%</button>
                    ))}
                  </div>
                </div>
              )}

              {photoError && <p style={{ color: C.berry, fontSize: 12.5, marginBottom: 10 }}>{photoError}</p>}
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setCameraOpen(true)} style={{
                  flex: 1, padding: "11px 0", borderRadius: 12, border: `1px solid ${C.line}`, background: C.card, color: C.inkSoft, fontSize: 13,
                }}>Reprendre une photo</button>
                <button onClick={onPickPhoto} style={{
                  flex: 1, padding: "11px 0", borderRadius: 12, border: `1px solid ${C.line}`, background: C.card, color: C.inkSoft, fontSize: 13,
                }}>Galerie</button>
              </div>
            </div>
          )}
        </div>
      )}

      {addTab === "ia" && (
        <AiTextMeal apiKey={geminiKey} mealLabel={MEAL_LABELS[addMeal]} onAddEntries={onAddEntries} onSaveRecipe={onSaveAiRecipe} onSaveFoods={onSaveFoods} />
      )}

      {addTab === "recette" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {allRecipes.map((r) => (
            <button key={r.id} onClick={() => onPickRecipeFromAdd(r, r.custom)} style={{
              textAlign: "left", background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: "11px 12px",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <span style={{ fontSize: 13.5 }}>{r.name}</span>
              {r.pasCher && <Tag color={C.olive} bg={C.oliveLight}>Pas cher</Tag>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* RECETTES                                                           */
/* ---------------------------------------------------------------- */
function RecipesView({ recipeTab, setRecipeTab, recipes, pantry, setPantry, onSelect, onNewRecipe, extLoading, extResults, extError, onSearchExternal, onSaveExternalRecipe,
  fridgeExtras, setFridgeExtras, shopping, setShopping, onAddShopping, geminiKey, fridgeCtx, onSaveRecipe }) {
  const [shopMsg, setShopMsg] = useState(null);
  const shopCount = (shopping || []).filter((i) => !i.done).length;
  const tabs = [
    ["toutes", "Toutes", ChefHat],
    ["pasCher", "Pas chères", Wallet],
    ["ingredients", "Par ingrédients", Salad],
    ["frigo", "Mon frigo" + (shopCount ? ` · 🛒${shopCount}` : ""), ShoppingBag],
    ["mesrecettes", "Mes recettes", BookOpen],
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
            color: recipeTab === k ? "#fff" : C.ink, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap",
          }}>
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

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
                      flexShrink: 0, padding: "7px 10px", borderRadius: 9, border: "none", background: C.herb, color: "#fff", fontSize: 11.5, fontWeight: 600,
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
      {shopMsg && <p style={{ position: "sticky", top: 8, zIndex: 2, background: C.herb, color: "#fff", borderRadius: 10, padding: "8px 12px", fontSize: 12.5, margin: "0 0 10px", textAlign: "center" }}>{shopMsg}</p>}

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
    </div>
  );
}

function RecipeDetail({ recipe, isCustom, servingsToAdd, setServingsToAdd, onBack, onAdd, onDelete, showAddMealPicker, addMeal, setAddMeal }) {
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
                background: addMeal === m ? C.herb : C.card, color: addMeal === m ? "#fff" : C.ink, fontSize: 12.5, fontWeight: 500,
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

          <button onClick={onAdd} style={{ width: "100%", padding: "13px 0", borderRadius: 12, border: "none", background: C.herb, color: "#fff", fontWeight: 600, fontSize: 14 }}>
            Ajouter au journal
          </button>
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

function RecipeBuilder({ name, setName, servings, setServings, pasCher, setPasCher, ingredients, setIngredients, onAddIngredient, onSave, onCancel, customFoods }) {
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
                color: pickerKey === ing.key ? "#fff" : C.herb, display: "flex",
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

      <button onClick={onSave} style={{ width: "100%", padding: "13px 0", borderRadius: 12, border: "none", background: C.herb, color: "#fff", fontWeight: 600, fontSize: 14 }}>
        Enregistrer la recette
      </button>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* PROFIL / OBJECTIFS                                                 */
/* ---------------------------------------------------------------- */
/**
 * Calcul des besoins.
 *  - mode "simple"   : métabolisme de base × niveau d'activité (formule classique)
 *  - mode "detaille" : base × 1,2 (vie quotidienne) + tes pas au-delà de 3 500/jour + ton sport prévu.
 *    Évite de compter deux fois les pas et le sport.
 * Si une mesure de masse grasse existe, le métabolisme de base utilise Katch-McArdle (masse maigre).
 */
function computeGoalsFromProfile(info, extras = {}) {
  const { sexe, poids, taille, objectif } = info;
  const mode = info.calcMode || "detaille";
  const lean = extras.bodyFat ? poids * (1 - extras.bodyFat / 100) : null;
  const bmr = lean ? 370 + 21.6 * lean : bmrMifflin(info);
  let maintenance, detail;
  if (mode === "simple") {
    maintenance = bmr * info.activite;
    detail = { bmr, activityKcal: maintenance - bmr };
  } else {
    const daily = bmr * 1.2;
    const stepsExtra = stepsKcal(Math.max(0, (extras.habitualSteps || 0) - 3500), poids, taille);
    const sport = (extras.weeklySportKcal || 0) / 7;
    maintenance = daily + stepsExtra + sport;
    detail = { bmr, daily, stepsExtra, sport };
  }
  let kcal = maintenance;
  if (objectif === "perte") kcal -= Math.min(500, maintenance * 0.2);
  if (objectif === "prise") kcal += 300;
  const floor = Math.max(sexe === "homme" ? 1500 : 1200, bmr * 0.95);
  kcal = Math.round(Math.max(floor, kcal));
  // Protéines : sur la masse maigre si connue, sinon sur un poids de référence plafonné (IMC 27)
  const refKg = Math.min(poids, 27 * Math.pow(taille / 100, 2));
  const prot = Math.round(lean ? lean * 2.2 : refKg * 1.8);
  const fat = Math.round((kcal * 0.25) / 9);
  const carbs = Math.max(0, Math.round((kcal - prot * 4 - fat * 9) / 4));
  const water = Math.round(poids * 30);
  return { kcal, prot, carbs, fat, water, _maintenance: Math.round(maintenance), _detail: detail, _katch: !!lean };
}

let runHcSyncRef = { current: null };
function ProfileView({ goals, onSave, personalInfo, onSavePersonalInfo, sportSettings, onSaveSportSettings, bodyFat, weightStats, onOpenBody }) {
  const [local, setLocal] = useState(goals);
  const [saved, setSaved] = useState(false);
  const [info, setInfo] = useState(personalInfo);
  const [computed, setComputed] = useState(null);
  const [showKey, setShowKey] = useState(false);
  const [keySaved, setKeySaved] = useState(false);
  useEffect(() => setLocal(goals), [goals]);
  useEffect(() => setInfo(personalInfo), [personalInfo]);

  const [keyTest, setKeyTest] = useState(null);
  function saveGeminiKey() {
    const cleaned = { ...info, geminiApiKey: (info.geminiApiKey || "").replace(/\s+/g, "") };
    setInfo(cleaned);
    onSavePersonalInfo(cleaned);
    clearGeminiModelCache();
    setKeySaved(true); setTimeout(() => setKeySaved(false), 1800);
  }
  async function testGeminiKey() {
    const key = (info.geminiApiKey || "").replace(/\s+/g, "");
    if (!key) { setKeyTest({ ok: false, text: "Colle d'abord ta clé." }); return; }
    setKeyTest({ loading: true });
    try {
      clearGeminiModelCache();
      const model = await resolveGeminiModel(key);
      setKeyTest({ ok: true, text: "Clé valide ✓ — modèle utilisé : " + model });
    } catch (e) {
      setKeyTest({ ok: false, text: "Échec : " + e.message });
    }
  }

  function field(key, label, unit) {
    return (
      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 12, color: C.inkSoft }}>{label}</label>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
          <NumInput min={0} value={local[key]} onChange={(v) => setLocal({ ...local, [key]: v })}
            style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: `1px solid ${C.line}`, fontFamily: "'IBM Plex Mono',monospace", fontSize: 14 }} />
          <span style={{ fontSize: 12, color: C.inkSoft, width: 26 }}>{unit}</span>
        </div>
      </div>
    );
  }

  const extras = {
    habitualSteps: sportSettings.habitualSteps,
    weeklySportKcal: plannedWeeklySportKcal(sportSettings, info.poids),
    bodyFat: bodyFat?.bf,
  };
  function runCalculation() {
    onSavePersonalInfo(info);
    setComputed(computeGoalsFromProfile(info, extras));
  }
  function applyComputed() {
    if (!computed) return;
    const { _maintenance, _detail, _katch, ...g0 } = computed;
    const g = { ...g0, foodWater: local.foodWater };
    setLocal(g);
    onSave(g);
    setSaved(true); setTimeout(() => setSaved(false), 1800);
  }

  const activityOptions = [
    [1.2, "Sédentaire (peu ou pas de sport)"],
    [1.375, "Légèrement actif (1-3x/semaine)"],
    [1.55, "Modérément actif (3-5x/semaine)"],
    [1.725, "Très actif (6-7x/semaine)"],
    [1.9, "Extrêmement actif (sport intense quotidien)"],
  ];
  const objectifOptions = [
    ["perte", "Perte de poids"],
    ["maintien", "Maintien"],
    ["prise", "Prise de masse"],
  ];

  return (
    <div style={{ padding: "28px 20px 8px" }}>
      <SectionTitle sub="Personnalise tes objectifs quotidiens.">Profil</SectionTitle>

      <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: 18, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <Calculator size={16} color={C.herb} />
          <p style={{ margin: 0, fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: 15.5 }}>Calculer mes besoins</p>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {["homme", "femme"].map((s) => (
            <button key={s} onClick={() => setInfo({ ...info, sexe: s })} style={{
              flex: 1, padding: "9px 0", borderRadius: 10, border: `1px solid ${info.sexe === s ? C.herb : C.line}`,
              background: info.sexe === s ? C.herb : C.card, color: info.sexe === s ? "#fff" : C.ink, fontSize: 13, fontWeight: 600, textTransform: "capitalize",
            }}>{s}</button>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
          <div>
            <label style={{ fontSize: 11, color: C.inkSoft }}>Poids (kg)</label>
            <NumInput min={25} max={350} value={info.poids} onChange={(v) => setInfo({ ...info, poids: v })}
              style={{ width: "100%", padding: "8px 8px", borderRadius: 8, border: `1px solid ${C.line}`, fontFamily: "'IBM Plex Mono',monospace", fontSize: 13, marginTop: 3 }} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: C.inkSoft }}>Taille (cm)</label>
            <NumInput min={100} max={250} decimals={false} value={info.taille} onChange={(v) => setInfo({ ...info, taille: v })}
              style={{ width: "100%", padding: "8px 8px", borderRadius: 8, border: `1px solid ${C.line}`, fontFamily: "'IBM Plex Mono',monospace", fontSize: 13, marginTop: 3 }} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: C.inkSoft }}>Âge</label>
            <NumInput min={10} max={110} decimals={false} value={info.age} onChange={(v) => setInfo({ ...info, age: v })}
              style={{ width: "100%", padding: "8px 8px", borderRadius: 8, border: `1px solid ${C.line}`, fontFamily: "'IBM Plex Mono',monospace", fontSize: 13, marginTop: 3 }} />
          </div>
        </div>

        <label style={{ fontSize: 11, color: C.inkSoft }}>Mode de calcul</label>
        <div style={{ display: "flex", gap: 6, marginTop: 3, marginBottom: 10 }}>
          {[["detaille", "Détaillé (pas + sport)"], ["simple", "Simple (niveau d'activité)"]].map(([v, l]) => (
            <button key={v} onClick={() => setInfo({ ...info, calcMode: v })} style={{
              flex: 1, padding: "8px 4px", borderRadius: 9, border: `1px solid ${(info.calcMode || "detaille") === v ? C.herb : C.line}`,
              background: (info.calcMode || "detaille") === v ? C.herb : C.card, color: (info.calcMode || "detaille") === v ? "#fff" : C.ink, fontSize: 11.5, fontWeight: 600,
            }}>{l}</button>
          ))}
        </div>
        {(info.calcMode || "detaille") === "simple" ? (
          <>
            <label style={{ fontSize: 11, color: C.inkSoft }}>Niveau d'activité</label>
            <select value={info.activite} onChange={(e) => setInfo({ ...info, activite: Number(e.target.value) })}
              style={{ width: "100%", padding: "9px 8px", borderRadius: 8, border: `1px solid ${C.line}`, fontSize: 12.5, marginTop: 3, marginBottom: 12, background: C.card }}>
              {activityOptions.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </>
        ) : (
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: C.inkSoft }}>Pas habituels par jour</label>
            <NumInput min={0} decimals={false} value={sportSettings.habitualSteps} onChange={(v) => onSaveSportSettings({ ...sportSettings, habitualSteps: v })}
              style={{ width: "100%", padding: "8px 8px", borderRadius: 8, border: `1px solid ${C.line}`, fontFamily: "'IBM Plex Mono',monospace", fontSize: 13, marginTop: 3 }} />
            <p style={{ fontSize: 11, color: C.inkSoft, margin: "6px 0 0", lineHeight: 1.45 }}>
              Sport prévu : ≈ {Math.round(extras.weeklySportKcal)} kcal / semaine d'après ton programme (onglet Sport).
              {bodyFat ? ` Masse grasse ${round(bodyFat.bf)} % : métabolisme calculé sur ta masse maigre.` : " Ajoute tes mensurations pour un calcul basé sur ta masse maigre."}
            </p>
          </div>
        )}

        <label style={{ fontSize: 11, color: C.inkSoft }}>Objectif</label>
        <div style={{ display: "flex", gap: 6, marginTop: 3, marginBottom: 14 }}>
          {objectifOptions.map(([v, l]) => (
            <button key={v} onClick={() => setInfo({ ...info, objectif: v })} style={{
              flex: 1, padding: "8px 4px", borderRadius: 9, border: `1px solid ${info.objectif === v ? C.herb : C.line}`,
              background: info.objectif === v ? C.herb : C.card, color: info.objectif === v ? "#fff" : C.ink, fontSize: 11.5, fontWeight: 600,
            }}>{l}</button>
          ))}
        </div>

        <button onClick={runCalculation} style={{
          width: "100%", padding: "11px 0", borderRadius: 10, border: `1.5px solid ${C.herb}`, background: "transparent",
          color: C.herb, fontWeight: 600, fontSize: 13,
        }}>Calculer</button>

        {computed && (
          <div style={{ marginTop: 14, background: C.sage, borderRadius: 12, padding: 14 }}>
            <p style={{ margin: "0 0 4px", fontSize: 12.5, color: C.herbLight }}>Maintien estimé : <strong>{computed._maintenance} kcal</strong></p>
            {computed._detail.daily != null ? (
              <p style={{ margin: "0 0 8px", fontSize: 11.5, color: C.herbLight, lineHeight: 1.5, fontFamily: "'IBM Plex Mono',monospace" }}>
                Base {Math.round(computed._detail.bmr)}{computed._katch ? " (masse maigre)" : ""} × 1,2 = {Math.round(computed._detail.daily)}
                {" "}+ pas {Math.round(computed._detail.stepsExtra)} + sport {Math.round(computed._detail.sport)}
              </p>
            ) : (
              <p style={{ margin: "0 0 8px", fontSize: 11.5, color: C.herbLight, fontFamily: "'IBM Plex Mono',monospace" }}>Base {Math.round(computed._detail.bmr)} + activité {Math.round(computed._detail.activityKcal)}</p>
            )}
            {weightStats?.adaptive?.ok && Math.abs(weightStats.adaptive.tdee - computed._maintenance) > 150 && (
              <p style={{ margin: "0 0 8px", fontSize: 11.5, color: C.berry, lineHeight: 1.45 }}>
                D'après ton poids réel et tes repas notés, ton besoin mesuré est plutôt de {weightStats.adaptive.tdee} kcal. Il est plus fiable que la formule : utilise « Besoin réel » (Corps &amp; progrès) pour fixer ton objectif.
              </p>
            )}
            <p style={{ margin: "0 0 8px", fontSize: 12.5, color: C.herbLight }}>Objectif par jour</p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
              <Tag color={C.herb} bg="#fff">{computed.kcal} kcal</Tag>
              <Tag color={C.berry} bg={C.berryLight}>P {computed.prot}g</Tag>
              <Tag color={C.ochre} bg={C.ochreLight}>G {computed.carbs}g</Tag>
              <Tag color={C.olive} bg={C.oliveLight}>L {computed.fat}g</Tag>
              <Tag color={C.herb} bg="#fff">Eau {computed.water}ml</Tag>
            </div>
            <button onClick={applyComputed} style={{
              width: "100%", padding: "10px 0", borderRadius: 9, border: "none", background: C.herb, color: "#fff", fontWeight: 600, fontSize: 13,
            }}>Appliquer à mes objectifs</button>
          </div>
        )}
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: 18, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <Scale size={16} color={C.herb} />
          <p style={{ margin: 0, fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: 15.5 }}>Corps & progrès</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => onOpenBody("poids")} style={profileLinkBtn}>Poids</button>
          <button onClick={() => onOpenBody("mesures")} style={profileLinkBtn}>Masse grasse</button>
          <button onClick={() => onOpenBody("besoin")} style={profileLinkBtn}>Besoin réel</button>
        </div>
        {weightStats?.adaptive?.ok && (
          <p style={{ fontSize: 12, color: C.inkSoft, margin: "10px 0 0" }}>D'après tes données, ton besoin réel est d'environ <strong>{weightStats.adaptive.tdee} kcal</strong>.</p>
        )}
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: 18, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <Flame size={16} color={C.herb} />
          <p style={{ margin: 0, fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: 15.5 }}>Calories du sport</p>
        </div>
        <p style={{ fontSize: 12, color: C.inkSoft, lineHeight: 1.5, margin: "0 0 10px" }}>
          Faut-il « remanger » les calories dépensées en plus de l'habituel (séances non prévues, journée à 15 000 pas) ?
          Les estimations de dépense sont souvent trop optimistes : les remanger en totalité est une cause fréquente de stagnation.
        </p>
        <div style={{ display: "flex", gap: 6 }}>
          {[[0, "Non (conseillé)"], [0.5, "La moitié"], [1, "En totalité"]].map(([v, l]) => (
            <button key={v} onClick={() => onSaveSportSettings({ ...sportSettings, eatBack: v })} style={{
              flex: 1, padding: "8px 4px", borderRadius: 9, border: `1px solid ${sportSettings.eatBack === v ? C.herb : C.line}`,
              background: sportSettings.eatBack === v ? C.herb : C.card, color: sportSettings.eatBack === v ? "#fff" : C.ink, fontSize: 11.5, fontWeight: 600,
            }}>{l}</button>
          ))}
        </div>
      </div>

      <RemindersCard />

      <HealthConnectCard onSync={() => runHcSyncRef.current && runHcSyncRef.current("full")} />

      <BackupCard />

      <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: 18, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <Sparkles size={16} color={C.herb} />
          <p style={{ margin: 0, fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: 15.5 }}>Détection photo par IA (optionnel)</p>
        </div>
        <p style={{ fontSize: 12, color: C.inkSoft, lineHeight: 1.5, margin: "0 0 12px" }}>
          Sans clé, l'onglet Photo utilise une détection locale limitée (gratuite, hors-ligne). Colle
          ici une clé Gemini gratuite pour une reconnaissance bien plus précise — obtenue en 2 minutes
          sur <strong>aistudio.google.com</strong>, sans carte bancaire. Tant que tu n'actives pas la
          facturation sur ce projet Google, l'usage ne peut jamais te coûter d'argent : au-delà du
          quota gratuit, les requêtes échouent simplement, elles ne sont jamais facturées.
        </p>
        <div style={{ position: "relative", marginBottom: 10 }}>
          <input
            type={showKey ? "text" : "password"} value={info.geminiApiKey || ""} placeholder="Colle ta clé Gemini ici"
            onChange={(e) => setInfo({ ...info, geminiApiKey: e.target.value })}
            style={{ width: "100%", padding: "10px 40px 10px 12px", borderRadius: 10, border: `1px solid ${C.line}`, fontSize: 13, fontFamily: "'IBM Plex Mono',monospace" }}
          />
          <button onClick={() => setShowKey(!showKey)} style={{ position: "absolute", right: 8, top: 8, background: "none", border: "none", color: C.inkSoft, padding: 4 }}>
            {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <button onClick={saveGeminiKey} style={{
          width: "100%", padding: "11px 0", borderRadius: 10, border: "none", background: C.herb, color: "#fff", fontWeight: 600, fontSize: 13,
        }}>
          {keySaved ? "Clé enregistrée ✓" : "Enregistrer la clé"}
        </button>
        <button onClick={testGeminiKey} style={{
          width: "100%", padding: "10px 0", borderRadius: 10, border: `1.5px solid ${C.herb}`, background: "transparent", color: C.herb, fontWeight: 600, fontSize: 13, marginTop: 8,
        }}>{keyTest?.loading ? "Test en cours…" : "Tester la clé"}</button>
        {keyTest && !keyTest.loading && (
          <p style={{ fontSize: 12, margin: "8px 0 0", color: keyTest.ok ? C.herb : C.berry, lineHeight: 1.45 }}>{keyTest.text}</p>
        )}
        <p style={{ fontSize: 11, color: C.inkSoft, margin: "10px 0 0", lineHeight: 1.5 }}>
          Cette clé reste uniquement sur ton téléphone, dans le stockage local de l'app — elle n'est
          jamais envoyée à un serveur autre que Google (pour l'analyse photo elle-même).
        </p>
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: 18 }}>
        <p style={{ margin: "0 0 12px", fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: 15.5 }}>Mes objectifs</p>
        {field("kcal", "Objectif calories", "kcal")}
        {field("prot", "Objectif protéines", "g")}
        {field("carbs", "Objectif glucides", "g")}
        {field("fat", "Objectif lipides", "g")}
        {field("water", "Objectif hydratation", "ml")}
        <div style={{ margin: "-4px 0 14px" }}>
          <Toggle checked={local.foodWater !== false} onChange={(v) => setLocal({ ...local, foodWater: v })}
            label="Compter l'eau des aliments"
            sub="L'eau contenue dans ce que tu manges (fruits, légumes, soupes, laitages…) est estimée et ajoutée à ce que tu bois. Seule l'eau bue est envoyée à Health Connect." />
        </div>
        <button onClick={() => { onSave(local); setSaved(true); setTimeout(() => setSaved(false), 1800); }} style={{
          width: "100%", padding: "13px 0", borderRadius: 12, border: "none", background: C.herb, color: "#fff", fontWeight: 600, fontSize: 14, marginTop: 6,
        }}>
          {saved ? "Objectifs enregistrés ✓" : "Enregistrer"}
        </button>
      </div>
      <p style={{ fontSize: 11.5, color: C.inkSoft, marginTop: 16, lineHeight: 1.5 }}>
        NutriMaison enregistre tout localement — repas, recettes et objectifs — sans compte, sans abonnement, sans fonctionnalité verrouillée.
        <span style={{ display: "block", marginTop: 10 }}>
          <strong>Sources des données</strong> — Aliments de base : {CIQUAL_CITATION} (Licence Ouverte Etalab).
          Produits de marque et codes-barres : Open Food Facts (licence ODbL). Recettes en ligne : TheMealDB.
        </span>
        <span style={{ display: "block", marginTop: 10 }}>
          <strong>Version {APP_VERSION}</strong><br />
          <strong>Licence</strong> — NutriMaison est un logiciel libre © 2026 les auteurs de NutriMaison, distribué sous licence GNU GPL version 3,
          SANS AUCUNE GARANTIE. Vous pouvez le redistribuer et le modifier selon les termes de cette licence.
        </span>
      </p>
    </div>
  );
}

const profileLinkBtn = {
  flex: 1, padding: "9px 10px", borderRadius: 10, border: "none", background: C.sage, color: C.herb, fontWeight: 600, fontSize: 12.5,
};

/** Rappels du soir (si rien n'est noté) et du matin (pesée). */
function RemindersCard() {
  const [r, setR] = useState(loadReminders());
  const [msg, setMsg] = useState(null);
  const available = remindersAvailable();
  async function update(next) {
    if ((next.evening.on && !r.evening.on) || (next.morning.on && !r.morning.on)) {
      const ok = await ensureNotifPermission();
      if (!ok) { setMsg("Notifications refusées : autorise-les dans les paramètres Android de NutriMaison."); return; }
    }
    setR(next); saveReminders(next); setMsg(null);
    const res = await syncReminders();
    if (res?.error) setMsg("Erreur : " + res.error);
  }
  const row = (key, label, sub) => (
    <div style={{ marginBottom: 12 }}>
      <Toggle checked={r[key].on} onChange={(v) => update({ ...r, [key]: { ...r[key], on: v } })} label={label} sub={sub} />
      {r[key].on && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "6px 0 0 54px" }}>
          <span style={{ fontSize: 12, color: C.inkSoft }}>à</span>
          <input type="time" value={r[key].time} onChange={(e) => e.target.value && update({ ...r, [key]: { ...r[key], time: e.target.value } })}
            style={{ ...inputStyle, width: 110, padding: "6px 8px", fontSize: 13 }} />
        </div>
      )}
    </div>
  );
  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: 18, marginBottom: 16 }}>
      <p style={{ margin: "0 0 10px", fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: 15.5 }}>🔔 Rappels</p>
      {!available ? (
        <p style={{ fontSize: 12, color: C.inkSoft, margin: 0 }}>Disponible uniquement dans l'application Android.</p>
      ) : (
        <>
          {row("evening", "Le soir, si rien n'est noté", "Seulement les jours où ton journal est encore vide.")}
          {row("morning", "Le matin, pour la pesée", "Seulement si tu ne t'es pas encore pesé ce jour-là (pesée Withings comprise).")}
          <button onClick={async () => setMsg((await testReminder()) ? "Notification de test dans 5 secondes…" : "Notifications refusées.")} style={{ ...profileLinkBtn, width: "100%" }}>
            Tester une notification
          </button>
          {msg && <p style={{ fontSize: 12, color: /refus|Erreur/.test(msg) ? C.berry : C.herb, margin: "8px 0 0" }}>{msg}</p>}
          <p style={{ fontSize: 11, color: C.inkSoft, margin: "8px 0 0", lineHeight: 1.45 }}>
            Les rappels sont préparés pour 7 jours et mis à jour à chaque ouverture : ouvre l'app au moins une fois par semaine pour qu'ils continuent.
          </p>
        </>
      )}
    </div>
  );
}

/** Sauvegarde / restauration de toutes les données (utile avant de réinstaller l'APK ou de changer de téléphone). */
function BackupCard() {
  const [mode, setMode] = useState(null);
  const [text, setText] = useState("");
  const [msg, setMsg] = useState("");
  function exportData() {
    const data = {};
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      data[k] = window.localStorage.getItem(k);
    }
    const json = JSON.stringify({ app: "NutriMaison", version: 2, date: new Date().toISOString(), data });
    setText(json); setMode("export"); setMsg("");
    try { navigator.clipboard && navigator.clipboard.writeText(json).then(() => setMsg("Copié dans le presse-papiers ✓ — colle-le dans une note, un mail à toi-même ou un fichier."), () => {}); } catch (e) {}
  }
  function importData() {
    try {
      const obj = JSON.parse(text.trim());
      if (!obj || obj.app !== "NutriMaison" || !obj.data) throw new Error();
      Object.entries(obj.data).forEach(([k, v]) => window.localStorage.setItem(k, v));
      // Health Connect : la sauvegarde peut venir d'une autre installation (ou de l'ancien identifiant d'app).
      // On oublie ce qui avait été « envoyé » pour que tout soit renvoyé proprement par cette installation.
      try {
        const hc = JSON.parse(window.localStorage.getItem("healthConnect") || "null");
        if (hc) { hc.sent = {}; hc.lastSync = null; window.localStorage.setItem("healthConnect", JSON.stringify(hc)); }
      } catch (e) {}
      setMsg("Données restaurées ✓ — l'app va redémarrer.");
      setTimeout(() => window.location.reload(), 900);
    } catch (e) { setMsg("Texte de sauvegarde invalide."); }
  }
  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: 18, marginBottom: 16 }}>
      <p style={{ margin: "0 0 6px", fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: 15.5 }}>Sauvegarde des données</p>
      <p style={{ fontSize: 12, color: C.inkSoft, lineHeight: 1.5, margin: "0 0 10px" }}>
        Tout est stocké sur ce téléphone. Fais une sauvegarde avant de réinstaller l'app ou de changer d'appareil.
      </p>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={exportData} style={profileLinkBtn}><Download size={14} style={{ verticalAlign: -2 }} /> Exporter</button>
        <button onClick={() => { setMode("import"); setText(""); setMsg(""); }} style={profileLinkBtn}><Upload size={14} style={{ verticalAlign: -2 }} /> Restaurer</button>
      </div>
      {mode && (
        <div style={{ marginTop: 10 }}>
          <textarea value={text} onChange={(e) => setText(e.target.value)} readOnly={mode === "export"} rows={5}
            placeholder="Colle ici le texte de sauvegarde"
            onFocus={(e) => mode === "export" && e.target.select()}
            style={{ ...inputStyle, fontSize: 11, resize: "vertical" }} />
          {mode === "import" && (
            <button onClick={importData} disabled={!text.trim()} style={{ ...profileLinkBtn, width: "100%", marginTop: 8, background: C.herb, color: "#fff" }}>Restaurer ces données</button>
          )}
        </div>
      )}
      {msg && <p style={{ fontSize: 12, color: C.herb, margin: "8px 0 0" }}>{msg}</p>}
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
              <Icon size={19} color={isFab ? "#fff" : (active ? C.herb : C.inkSoft)} strokeWidth={active ? 2.4 : 2} />
            </div>
            <span style={{ fontSize: 10.5, fontWeight: active ? 600 : 500 }}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
