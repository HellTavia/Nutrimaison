// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Les auteurs de NutriMaison
/* Données et calculs : aliments, recettes, recherche, eau, « Mon frigo » */
import React from "react";
import { C, round } from "./shared.jsx";

export const MEAL_LABELS = {
  petitdej: "Petit-déjeuner",
  dejeuner: "Déjeuner",
  diner: "Dîner",
  collation: "Collations",
};
export const MEAL_ORDER = ["petitdej", "dejeuner", "diner", "collation"];

/* ---------------------------------------------------------------- */
/* BASE DE DONNÉES ALIMENTS (valeurs pour 100 g)                     */
/* ---------------------------------------------------------------- */
export const FOOD_DB = [
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
export const foodById = Object.fromEntries(FOOD_DB.map((f) => [f.id, f]));

/* ---- Recherche tolérante : sans accents, mot à mot ("tortilla de ble" trouve "Tortilla / wrap de blé") ---- */
export const STOP = new Set(["de", "du", "des", "la", "le", "les", "l", "d", "au", "aux", "a", "en", "et", "un", "une", "avec", "sans"]);
export function norm(s) { return String(s || "").replace(/œ/gi, "oe").replace(/æ/gi, "ae").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }
export function queryTokens(q) { return norm(q).split(/[^a-z0-9]+/).filter((t) => t && !STOP.has(t)); }
export function matchesQuery(name, tokens) {
  if (!tokens.length) return true;
  const n = norm(name);
  // tolère le pluriel simple (tortillas ↔ tortilla)
  return tokens.every((t) => n.includes(t) || (t.endsWith("s") && n.includes(t.slice(0, -1))));
}
export function scoreMatch(name, q) { const n = norm(name), nq = norm(q).trim(); return n.startsWith(nq) ? 0 : n.includes(nq) ? 1 : 2; }

/* ---- Open Food Facts : recherche plein texte (l'API v2 ne cherche pas par texte) ---- */
export function mapOffProduct(p) {
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
export async function offTextSearch(q, size = 20) {
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
export const BRAND_DB = [
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

export const PANTRY_ITEMS = [
  "riz_blanc", "pates", "pomme_de_terre", "lentilles", "pois_chiches",
  "haricots_rouges", "oeuf", "lait", "fromage_rape", "poulet", "boeuf_hache",
  "thon", "tofu", "huile_olive", "beurre", "tomate", "oignon", "carotte",
  "courgette", "poivron", "champignon", "salade", "ail", "banane",
  "avoine", "creme_fraiche", "lait_coco", "curry", "pate_tomate", "mais",
];

/* Correspondance anglais → français pour les objets détectables par COCO-SSD (détection
   photo 100% locale, gratuite, sans clé — modèle TensorFlow.js téléchargé une seule fois). */
export const COCO_FOOD_LABELS = {
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
export const MOBILENET_FOOD_KEYWORDS = [
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
export const PANTRY_EN = {
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
export const RECIPES = [
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
export function macrosFromGrams(foodId, grams) {
  const f = foodById[foodId];
  if (!f) return { kcal: 0, prot: 0, carbs: 0, fat: 0 };
  const m = grams / 100;
  return { kcal: round(f.kcal * m), prot: round(f.prot * m), carbs: round(f.carbs * m), fat: round(f.fat * m) };
}
export function calcFromFood(food, grams) {
  const m = grams / 100;
  return { kcal: round(food.kcal * m), prot: round(food.prot * m), carbs: round(food.carbs * m), fat: round(food.fat * m) };
}
export function ingredientData(ing) {
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
export function recipeTotals(recipe) {
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
export function entryWaterMl(e) {
  if (!e) return 0;
  if (e.water != null) return Math.max(0, Number(e.water) || 0);
  const g = Number(e.grams);
  if (!g) return 0;
  const dry = (Number(e.prot) || 0) + (Number(e.carbs) || 0) + (Number(e.fat) || 0);
  return Math.max(0, g - dry - g * 0.02);
}
export function dayFoodWaterMl(day) {
  if (!day || !day.meals) return 0;
  return Object.values(day.meals).reduce((s, list) => s + (list || []).reduce((a, e) => a + entryWaterMl(e), 0), 0);
}
export function recipeWaterPerServing(recipe) {
  if (recipe.noNutrition || recipe.aiTotals || !recipe.ingredients?.length) return null;
  const tot = recipe.ingredients.reduce((acc, ing) => {
    const d = ingredientData(ing);
    return acc + Math.max(0, d.grams - d.prot - d.carbs - d.fat - d.grams * 0.02);
  }, 0);
  return tot / (recipe.servings || 1);
}

export function emptyDay() {
  return { meals: { petitdej: [], dejeuner: [], diner: [], collation: [] }, water: 0 };
}
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result.split(",")[1]);
    r.onerror = () => reject(new Error("Lecture du fichier impossible"));
    r.readAsDataURL(file);
  });
}

/* ---- « Mon frigo » : reconnaître ce que j'ai dans les ingrédients des recettes ---- */
export const STAPLES_RE = /^(sel|poivre|eau|huile|epices?|herbes|vinaigre|ail|persil|ciboulette|sucre|bouillon|curry|paprika|cumin|moutarde|jus de citron)\b/;
export const STAPLE_IDS = new Set(["huile_olive", "ail", "curry"]);
/** Familles : « fromage » reconnaît emmental, feta…, « tortilla » reconnaît wrap… */
export const FRIDGE_FAMILIES = [
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
export function fridgeMatchers(names) {
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
