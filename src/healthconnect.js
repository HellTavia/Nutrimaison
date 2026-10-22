// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Les auteurs de NutriMaison
/* ================================================================== */
/* SYNCHRONISATION HEALTH CONNECT                                      */
/*                                                                     */
/* Règle d'or anti-doublon : chaque donnée n'a qu'UNE source.          */
/*  - NutriMaison ÉCRIT : repas, hydratation, ses séances, les pesées  */
/*    tapées à la main, la masse grasse.                               */
/*  - NutriMaison LIT : pas, poids des autres applis (Withings),       */
/*    calories mesurées, séances des autres applis.                    */
/*  - Ce qui est lu n'est jamais réécrit ; ce qui est écrit porte un   */
/*    identifiant stable (clientRecordId) → mise à jour, pas doublon.  */
/* ================================================================== */
import { Capacitor, registerPlugin } from "@capacitor/core";
import { loadJSON, saveJSON, addDays, todayISO, netKcal } from "./shared.jsx";

const HealthBridge = registerPlugin("HealthBridge");
const KEY = "healthConnect";
const MEAL_TIMES = { petitdej: [8, 0], dejeuner: [12, 30], collation: [16, 0], diner: [19, 30] };

export const HC_DEFAULTS = {
  enabled: false,
  write: { nutrition: true, hydration: true, exercise: true, exerciseCalories: false, weight: true, bodyFat: true },
  read: { steps: true, weight: true, calories: true, exercise: true },
  // sources de calories écartées de la moyenne (Fitbit a tendance à surestimer)
  calExclude: ["com.fitbit.FitbitMobile"],
  granted: { read: [], write: [] },
  sent: {},
  lastSync: null,
  lastError: null,
};

export function isNativeAndroid() {
  try { return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android"; } catch (e) { return false; }
}
export function loadHC() {
  const s = loadJSON(KEY, {});
  return { ...HC_DEFAULTS, ...s, write: { ...HC_DEFAULTS.write, ...(s.write || {}) }, read: { ...HC_DEFAULTS.read, ...(s.read || {}) }, sent: s.sent || {} };
}
export function saveHC(s) { saveJSON(KEY, s); }

export async function hcAvailability() {
  if (!isNativeAndroid()) return "web";
  try { return (await HealthBridge.availability()).status; } catch (e) { return "error"; }
}

/** Permissions à demander selon les réglages. */
function wantedPermissions(s) {
  const read = [], write = [];
  if (s.read.steps) read.push("steps");
  if (s.read.weight) read.push("weight", "bodyFat", "leanMass"); // + composition de la balance (masse grasse, masse maigre)
  if (s.read.calories) read.push("activeCalories", "totalCalories", "basal");
  if (s.read.exercise) read.push("exercise");
  if (s.write.nutrition) write.push("nutrition");
  if (s.write.hydration) write.push("hydration");
  if (s.write.exercise) write.push("exercise");
  if (s.write.exerciseCalories) write.push("activeCalories");
  if (s.write.weight) write.push("weight");
  if (s.write.bodyFat) write.push("bodyFat");
  return { read, write };
}

export async function hcRequestPermissions() {
  const s = loadHC();
  const granted = await HealthBridge.requestAuthorization(wantedPermissions(s));
  saveHC({ ...loadHC(), granted });
  return granted;
}
export async function hcRefreshGranted() {
  if (!isNativeAndroid()) return null;
  try {
    const granted = await HealthBridge.getGranted();
    saveHC({ ...loadHC(), granted });
    return granted;
  } catch (e) { return null; }
}
export async function hcOpenSettings() { try { await HealthBridge.openSettings(); } catch (e) {} }

/* ---------------------------------------------------------------- */
/* Outils                                                            */
/* ---------------------------------------------------------------- */
function dayStart(iso) { return new Date(iso + "T00:00:00").getTime(); }
function at(iso, h, m) { return new Date(`${iso}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`).getTime(); }
function sig(o) { return JSON.stringify(o); }
const r1 = (n) => Math.round(n * 10) / 10;

function exerciseTypeFor(w) {
  const t = `${w.programId || ""} ${w.activityId || ""} ${w.title || ""}`.toLowerCase();
  if (/boxe|box|kickbox|muay/.test(t)) return "boxing";
  if (/arts_martiaux|judo|karat/.test(t)) return "martial_arts";
  if (/course|trail|running/.test(t)) return "running";
  if (/marche|randonn/.test(t)) return /randonn/.test(t) ? "hiking" : "walking";
  if (/velo_appart|vélo d'appart|velo_intervalles|spinning/.test(t)) return "biking_stationary";
  if (/velo|vélo/.test(t)) return "biking";
  if (/natation|aqua/.test(t)) return "swimming";
  if (/yoga|mobilite/.test(t)) return "yoga";
  if (/pilates/.test(t)) return "pilates";
  if (/etirement|étirement/.test(t)) return "stretching";
  if (/hiit|circuit|crossfit|express/.test(t)) return "hiit";
  if (/elliptique/.test(t)) return "elliptical";
  if (/rameur/.test(t)) return "rowing";
  if (/danse|zumba/.test(t)) return "dancing";
  if (/football/.test(t)) return "soccer";
  if (/basket/.test(t)) return "basketball";
  if (/tennis|padel/.test(t)) return "tennis";
  if (/badminton/.test(t)) return "badminton";
  if (/squash/.test(t)) return "squash";
  if (/escalade/.test(t)) return "climbing";
  if (w.kind === "force") return "strength";
  return "other";
}

/* ---------------------------------------------------------------- */
/* Écriture : calcule ce qui doit exister côté Health Connect,       */
/* envoie seulement les différences, supprime ce qui a disparu.      */
/* ---------------------------------------------------------------- */
function desiredRecords(s, days, workouts, weights, weightSources, measures, fromDate) {
  const want = { nutrition: {}, hydration: {}, exercise: {}, activeCalories: {}, weight: {}, bodyFat: {} };
  const now = Date.now();
  Object.entries(days).forEach(([d, day]) => {
    if (d < fromDate || !day) return;
    if (s.write.nutrition) {
      Object.entries(day.meals || {}).forEach(([meal, list]) => {
        (list || []).forEach((e, k) => {
          if (!e || !e.id) return;
          const [h, m] = MEAL_TIMES[meal] || [12, 0];
          const start = Math.min(at(d, h, m) + k * 60000, now - 60000);
          const rec = { cid: "nm_food_" + e.id, start, end: start + 60000, name: e.name, meal, kcal: r1(e.kcal || 0), prot: r1(e.prot || 0), carbs: r1(e.carbs || 0), fat: r1(e.fat || 0) };
          want.nutrition[rec.cid] = { d, rec };
        });
      });
    }
    if (s.write.hydration && day.water > 0) {
      const start = dayStart(d);
      const end = Math.min(at(d, 23, 59), now);
      if (end > start) {
        const rec = { cid: "nm_water_" + d, start, end, ml: day.water };
        want.hydration[rec.cid] = { d, rec, sigOnly: { ml: day.water } };
      }
    }
  });
  if (s.write.exercise) {
    (workouts || []).forEach((w) => {
      if (!w || w.date < fromDate || w.source === "hc") return;
      const dur = Math.max(1, Math.round((w.durationMin || 1) * 60000));
      const start = w.startedAt || Math.min(at(w.date, 18, 0), now - dur);
      const rec = { cid: "nm_workout_" + w.id, start, end: start + dur, title: w.title, type: exerciseTypeFor(w) };
      want.exercise[rec.cid] = { d: w.date, rec };
      if (s.write.exerciseCalories && w.kcal > 0) {
        const kr = { cid: "nm_kcal_" + w.id, start, end: start + dur, kcal: w.kcal };
        want.activeCalories[kr.cid] = { d: w.date, rec: kr };
      }
    });
  }
  if (s.write.weight) {
    Object.entries(weights || {}).forEach(([d, kg]) => {
      if (d < fromDate || !kg) return;
      if ((weightSources || {})[d] && weightSources[d] !== "manuel") return; // pesée importée : on ne la renvoie pas
      const rec = { cid: "nm_weight_" + d, time: Math.min(at(d, 7, 30), now), kg };
      want.weight[rec.cid] = { d, rec };
    });
  }
  if (s.write.bodyFat) {
    (measures || []).forEach((m) => {
      if (!m || m.date < fromDate || m.bf == null) return;
      const rec = { cid: "nm_bf_" + m.date, time: Math.min(at(m.date, 7, 35), now), percent: r1(m.bf) };
      want.bodyFat[rec.cid] = { d: m.date, rec };
    });
  }
  return want;
}

async function pushWrites(s, ctx, log) {
  const fromDate = addDays(todayISO(), -30);
  const want = desiredRecords(s, ctx.days, ctx.workouts, ctx.weights, ctx.weightSources, ctx.measures, fromDate);
  const canWrite = new Set(s.granted.write || []);
  const sent = { ...s.sent };
  for (const kind of Object.keys(want)) {
    if (!canWrite.has(kind)) continue;
    const prev = sent[kind] || {};
    const next = { ...prev };
    const toUpsert = [];
    Object.entries(want[kind]).forEach(([cid, { d, rec }]) => {
      const { cid: _c, start, end, time, ...content } = rec;
      // le jour fait partie de la signature : un aliment déplacé à un autre jour est renvoyé avec sa nouvelle date
      const sg = sig(kind === "hydration" ? { ml: rec.ml } : { ...content, d });
      if (!prev[cid] || prev[cid].s !== sg) {
        const v = Date.now() + toUpsert.length; // version croissante → Health Connect remplace l'ancienne valeur
        toUpsert.push({ ...rec, version: v });
        next[cid] = { s: sg, v, d };
      }
    });
    // ce qui a été envoyé (dans la fenêtre) mais n'existe plus dans l'app → à supprimer
    const toDelete = Object.entries(prev).filter(([cid, info]) => info.d >= fromDate && !want[kind][cid]).map(([cid]) => cid);
    if (toUpsert.length) { await HealthBridge.upsert({ kind, records: toUpsert }); log.written += toUpsert.length; }
    if (toDelete.length) { await HealthBridge.deleteByClientIds({ kind, cids: toDelete }); toDelete.forEach((c) => delete next[c]); log.deleted += toDelete.length; }
    // on oublie ce qui est sorti de la fenêtre (il reste dans Health Connect, on ne le touche plus)
    Object.keys(next).forEach((c) => { if (next[c].d < fromDate) delete next[c]; });
    sent[kind] = next;
  }
  return sent;
}


/* ---------------------------------------------------------------- */
/* Séances sans calories                                             */
/* Certaines applis (Withings) envoient la séance (boxe, vélo…) mais  */
/* seulement les calories « de mouvement » mesurées pendant ce temps, */
/* bien moins que ce que leur appli affiche. On estime la séance      */
/* (MET × poids × durée) et on ajoute ce qui manque.                  */
/* Marche et course comprises : Withings ne les envoie pas en entier */
/* non plus. Une appli qui envoie bien ses calories n'est pas gonflée */
/* (on n'ajoute que la différence avec ce qu'elle a envoyé).          */
/* ---------------------------------------------------------------- */
export const SESSION_MET = {
  79: 3, 37: 4.5, 56: 8, 57: 8,
  0: 5, 2: 5.5, 8: 2.9, 9: 5.5, 10: 8, 11: 7.8, 13: 4, 16: 5, 25: 5, 26: 6, 32: 4.8, 36: 8, 44: 7.8,
  48: 3, 51: 8, 53: 7, 54: 7, 61: 7, 64: 7, 66: 7.3, 68: 8, 69: 8, 70: 5, 71: 2.3, 73: 5.8, 74: 5.8,
  75: 4, 76: 7.3, 81: 5, 83: 2.5,
};
function latestKg() {
  const w = loadJSON("weights", {});
  const last = Object.keys(w).sort().pop();
  return (last && Number(w[last])) || Number(loadJSON("personalInfo", {}).poids) || 70;
}
async function addSessionFill(bySource, sessions, kg) {
  // on mémorise les séances et ce que l'appli a envoyé pendant ; l'estimation est faite à l'affichage
  // (elle dépend des corrections de l'utilisateur, modifiables à tout moment)
  for (const x of bySource) {
    const mine = sessions.filter((z) => z.origin === x.origin && SESSION_MET[z.type] && z.end > z.start);
    if (!mine.length || !(x.basal > 0)) continue;
    const list = [];
    for (const z of mine) {
      let rec = 0;
      const r = await HealthBridge.debugCalories({ start: z.start, end: z.end });
      (r.records || []).filter((y) => y.kind === "active" && y.origin === x.origin && y.end > y.start).forEach((y) => {
        const ov = Math.min(y.end, z.end) - Math.max(y.start, z.start);
        if (ov > 0) rec += y.kcal * ov / (y.end - y.start);
      });
      list.push({ id: z.id, origin: z.origin, start: z.start, end: z.end, type: z.type, label: exerciseLabel(z), min: Math.round((z.end - z.start) / 60000), rec: Math.round(rec), kg });
    }
    x.sessions = list;
  }
}
/** MET retenu pour un type de séance : réglage de l'utilisateur, sinon barème. */
export function sessionMet(type, prefs) { return Number(prefs?.sessionMet?.[type]) || SESSION_MET[type]; }
/**
 * Correction (calories saisies ou séance ignorée) qui s'applique à une séance.
 * Rangée par créneau horaire et non par identifiant : quand Withings réécrit une séance (modification,
 * resynchro), elle change d'identifiant mais garde à peu près son créneau → la correction suit.
 */
export function findSessionFix(q, prefs) {
  const fixes = prefs?.sessionFix || [];
  if (q.start != null) {
    const f = fixes.find((x) => x.origin === q.origin && x.type === q.type
      && Math.min(x.end, q.end) - Math.max(x.start, q.start) >= 0.5 * Math.min(x.end - x.start, q.end - q.start));
    if (f) return f;
  }
  // anciennes corrections (2.24.0) rangées par identifiant
  if (prefs?.sessionIgnore?.[q.id]) return { ignore: true };
  if (prefs?.sessionKcal?.[q.id] != null) return { kcal: prefs.sessionKcal[q.id] };
  return null;
}
/** Enregistre (ou retire avec fix = null) la correction d'une séance. Renvoie les réglages modifiés. */
export function setSessionFix(prefs, q, fix) {
  const same = (x) => x.origin === q.origin && x.type === q.type
    && Math.min(x.end, q.end) - Math.max(x.start, q.start) >= 0.5 * Math.min(x.end - x.start, q.end - q.start);
  const limit = Date.now() - 60 * 86400000;
  const list = (prefs.sessionFix || []).filter((x) => x.end > limit && !(q.start != null && same(x)));
  if (fix && q.start != null) list.push({ origin: q.origin, type: q.type, start: q.start, end: q.end, ...fix });
  const sk = { ...(prefs.sessionKcal || {}) }; delete sk[q.id];
  const si = { ...(prefs.sessionIgnore || {}) }; delete si[q.id];
  if (fix && q.start == null) { if (fix.ignore) si[q.id] = true; else sk[q.id] = fix.kcal; }
  return { ...prefs, sessionFix: list, sessionKcal: sk, sessionIgnore: si };
}
export function isSessionIgnored(q, prefs) { return !!findSessionFix(q, prefs)?.ignore; }
/** Calories estimées d'une séance : valeur saisie pour cette séance, sinon MET × poids × durée. */
export function sessionEstimate(q, prefs) {
  const fix = findSessionFix(q, prefs);
  if (fix?.kcal != null) return { est: Math.round(fix.kcal), manual: "séance" };
  const custom = prefs?.sessionMet?.[q.type] != null;
  return { est: Math.round(netKcal(sessionMet(q.type, prefs), q.kg, q.min)), manual: custom ? "type" : null };
}
/** Complément des séances pour une source, d'après ses séances mémorisées et les corrections. */
function withFill(x, prefs) {
  if (!Array.isArray(x.sessions)) return x; // ancienne synchro : on garde ce qui était calculé
  const detail = x.sessions.filter((q) => !isSessionIgnored(q, prefs))
    .map((q) => { const e = sessionEstimate(q, prefs); return { ...q, ...e, add: Math.max(0, e.est - q.rec) }; });
  const fill = detail.reduce((a, q) => a + q.add, 0);
  return { ...x, fill: fill || undefined, fillDetail: detail.length ? detail : undefined };
}

/* ---------------------------------------------------------------- */
/* Lecture                                                           */
/* ---------------------------------------------------------------- */
async function pullReads(s, log) {
  const canRead = new Set(s.granted.read || []);
  const today = todayISO();
  const days = 7;
  // Pas + calories : totaux dédoublonnés par Health Connect, jour par jour
  const metrics = [];
  if (s.read.steps && canRead.has("steps")) metrics.push("steps");
  if (s.read.calories && canRead.has("activeCalories")) metrics.push("activeCalories");
  if (s.read.calories && canRead.has("totalCalories")) metrics.push("totalCalories");
  const exercisesByDay = {};
  if (s.read.exercise && canRead.has("exercise")) {
    const res = await HealthBridge.readExercises({ start: dayStart(addDays(today, -(days - 1))), end: Date.now() });
    (res.records || []).forEach((x) => {
      const d = isoOf(x.start);
      (exercisesByDay[d] = exercisesByDay[d] || []).push({
        id: x.id, start: x.start, end: x.end, title: x.title || "", type: x.type, origin: x.origin,
        durationMin: Math.round((x.end - x.start) / 60000),
      });
    });
    Object.keys(exercisesByDay).forEach((d) => { exercisesByDay[d] = dedupeSessions(exercisesByDay[d]); });
  }
  for (let i = 0; i < days; i++) {
    const d = addDays(today, -i);
    const start = dayStart(d);
    const end = d === today ? Date.now() : dayStart(addDays(d, 1));
    let agg = {};
    if (metrics.length) agg = await HealthBridge.aggregate({ start, end, metrics });
    const key = "day:" + d;
    const day = loadJSON(key, null) || { meals: { petitdej: [], dejeuner: [], diner: [], collation: [] }, water: 0 };
    let changed = false;
    if (agg.steps != null && day.stepsSource !== "manuel") {
      if (day.steps !== agg.steps || day.stepsSource !== "hc") { day.steps = agg.steps; day.stepsSource = "hc"; changed = true; }
    }
    // calories app par app (pour la moyenne) — absent sur une ancienne version du pont natif
    let bySource;
    if (s.read.calories) {
      try {
        // métabolisme de base compté sur la journée entière (comme l'appli Withings), activité jusqu'à maintenant
        const r = await HealthBridge.caloriesBySource({ start, end, basalEnd: dayStart(addDays(d, 1)) });
        const k = (v) => (v != null && v > 0 ? Math.round(v) : undefined);
        bySource = (r.sources || []).map((x) => ({ origin: x.origin, active: k(x.active), total: k(x.total), basal: k(x.basal), ...(x.lastActiveAt ? { lastAt: x.lastActiveAt } : {}), ...(x.activeRaw != null ? { activeRaw: Math.round(x.activeRaw) } : {}) }))
          .filter((x) => x.active || x.total || x.basal);
      } catch (e) { bySource = undefined; }
      if (bySource) {
        try { await addSessionFill(bySource, exercisesByDay[d] || [], latestKg()); } catch (e) {}
      }
    }
    const hc = {
      ...(bySource ? { bySource, asOf: end } : {}),
      activeKcal: agg.activeCalories != null ? Math.round(agg.activeCalories) : undefined,
      totalKcal: agg.totalCalories != null ? Math.round(agg.totalCalories) : undefined,
      sessions: exercisesByDay[d] || [],
      origins: agg.origins || [],
    };
    if (sig(hc) !== sig(day.hc || {})) { day.hc = hc; changed = true; }
    if (changed) { saveJSON(key, day); log.daysUpdated++; }
  }

  // Poids des autres applis (balance Withings…) : la première pesée de chaque jour
  if (s.read.weight && canRead.has("weight")) {
    const res = await HealthBridge.readWeights({ start: dayStart(addDays(today, -30)), end: Date.now() });
    const firstOfDay = {};
    (res.records || []).sort((a, b) => a.time - b.time).forEach((x) => { const d = isoOf(x.time); if (!firstOfDay[d]) firstOfDay[d] = x; });
    const weights = loadJSON("weights", {});
    const sources = loadJSON("weightSources", {});
    const ignored = new Set(loadJSON("weightIgnored", []));
    let n = 0;
    Object.entries(firstOfDay).forEach(([d, x]) => {
      if (sources[d] === "manuel" || ignored.has(d)) return; // la saisie manuelle ou une suppression volontaire gagne
      const kg = r1(x.kg);
      if (weights[d] !== kg) { weights[d] = kg; n++; }
      sources[d] = "hc:" + x.origin;
    });
    saveJSON("weights", weights);
    saveJSON("weightSources", sources);
    log.weightsImported = n;
  }

  // Historique du métabolisme de base (une valeur par jour et par appli) : sert au graphique « Métabolisme »
  if (canRead.has("basal") && HealthBridge.readBasal) {
    try {
      const res = await HealthBridge.readBasal({ start: dayStart(addDays(today, -400)), end: Date.now() });
      const hist = loadJSON("bmrHistory", {});
      (res.records || []).sort((a, b) => a.time - b.time).forEach((x) => {
        if (!(x.kcalDay > 500 && x.kcalDay < 6000)) return;
        const d = isoOf(x.time);
        hist[d] = { ...(hist[d] || {}), [x.origin]: Math.round(x.kcalDay) }; // la dernière mesure du jour gagne
      });
      saveJSON("bmrHistory", hist);
    } catch (e) { /* ancienne version du pont natif */ }
  }
  // Composition corporelle de la balance (masse grasse %, masse maigre kg)
  if ((canRead.has("bodyFat") || canRead.has("leanMass")) && HealthBridge.readBodyComp) {
    try {
      const res = await HealthBridge.readBodyComp({ start: dayStart(addDays(today, -400)), end: Date.now() });
      const comp = loadJSON("bodyComp", {});
      const put = (list, key, val) => (list || []).sort((a, b) => a.time - b.time).forEach((x) => {
        const d = isoOf(x.time);
        if (comp[d]?.[key] != null && comp[d][key + "Src"] === x.origin) return; // première mesure du jour
        comp[d] = { ...(comp[d] || {}), [key]: val(x), [key + "Src"]: x.origin };
      });
      put(res.fat, "fat", (x) => Math.round(x.percent * 10) / 10);
      put(res.lean, "lean", (x) => Math.round(x.kg * 10) / 10);
      saveJSON("bodyComp", comp);
    } catch (e) {}
  }
}

function isoOf(ms) {
  const dt = new Date(ms);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

/**
 * Synchronisation complète. ctx = { days, workouts, weights, weightSources, measures }
 * mode "write" : seulement l'envoi (après une modification) ; "full" : envoi + lecture.
 */
let running = null;
export async function hcSync(ctx, mode = "full") {
  if (!isNativeAndroid()) return { skipped: "web" };
  const s0 = loadHC();
  if (!s0.enabled) return { skipped: "off" };
  if (running) return running;
  running = (async () => {
    const log = { written: 0, deleted: 0, daysUpdated: 0, weightsImported: 0 };
    try {
      const granted = await HealthBridge.getGranted();
      let s = { ...loadHC(), granted };
      s.sent = await pushWrites(s, ctx, log);
      if (mode === "full") await pullReads(s, log);
      s = { ...loadHC(), granted, sent: s.sent, lastSync: Date.now(), lastError: null, lastLog: log };
      saveHC(s);
      return log;
    } catch (e) {
      saveHC({ ...loadHC(), lastError: String(e && e.message || e), lastSync: Date.now() });
      return { error: String(e && e.message || e) };
    } finally {
      running = null;
    }
  })();
  return running;
}

/** Libellé lisible d'une appli source. */
/* ---------------------------------------------------------------- */
/* Calories : une valeur par appli, moyenne des sources retenues     */
/* ---------------------------------------------------------------- */
/** Total de la journée pour une source : son total, sinon métabolisme de base + calories actives. */
export function sourceTotal(x) {
  // Priorité au métabolisme de base de la journée entière + activité (même calcul que l'appli Withings).
  // Le « total » renvoyé par Health Connect pour une appli qui n'écrit pas de total est recalculé par Health Connect
  // avec le métabolisme compté seulement jusqu'à maintenant : trop bas en journée.
  if (x.basal > 0 && x.active != null) return { kcal: x.basal + x.active + (x.fill || 0), rebuilt: true };
  if (x.total > 0) return { kcal: x.total, rebuilt: false };
  if (x.basal > 0) return { kcal: x.basal, rebuilt: true };
  return null;
}
export function calorieSummary(hc, exclude, prefs) {
  const ex = new Set(exclude || []);
  const p = prefs || loadHC();
  const rows = (hc?.bySource || []).map((x0) => {
    const x = p.fillSessions === false ? { ...x0, fill: undefined, fillDetail: undefined } : withFill(x0, p);
    const t = sourceTotal(x);
    return { ...x, label: originLabel(x.origin), totalKcal: t?.kcal ?? null, rebuilt: !!t?.rebuilt, included: !ex.has(x.origin) && !!t };
  }).sort((a, b) => (b.totalKcal || 0) - (a.totalKcal || 0));
  const inc = rows.filter((r) => r.included);
  const avg = inc.length ? Math.round(inc.reduce((a, r) => a + r.totalKcal, 0) / inc.length) : null;
  return { rows, avg, n: inc.length, asOf: hc?.asOf || null };
}

/** Nom lisible d'une séance d'après son type Health Connect. */
const EXERCISE_TYPES = {
  0: "Entraînement", 2: "Badminton", 8: "Vélo", 9: "Vélo d'appartement", 10: "Bootcamp", 11: "Boxe", 13: "Gymnastique au sol",
  16: "Danse", 25: "Elliptique", 26: "Cours collectif", 32: "Golf", 36: "HIIT", 37: "Randonnée", 44: "Arts martiaux",
  48: "Pilates", 51: "Escalade", 53: "Aviron", 54: "Rameur", 56: "Course à pied", 57: "Course sur tapis", 61: "Ski",
  64: "Football", 66: "Squash", 68: "Escaliers", 69: "Stepper", 70: "Renforcement musculaire", 71: "Étirements",
  73: "Nage en eau libre", 74: "Natation", 75: "Tennis de table", 76: "Tennis", 79: "Marche", 81: "Musculation", 83: "Yoga",
};
export function exerciseLabel(x) {
  if (x.title && x.title.trim()) return x.title.trim();
  return EXERCISE_TYPES[x.type] || "Séance";
}
/** Regroupe les séances de même type et de même appli : « Marche · 8 fois · 157 min ». */
/**
 * Une même appli envoie parfois la même séance deux fois (séance modifiée ou resynchronisée = nouvel enregistrement).
 * Même appli + même type + créneaux qui se recouvrent (ou départs à moins de 5 min) → une seule séance, la plus longue.
 */
export function dedupeSessions(list) {
  const out = [];
  [...(list || [])].sort((a, b) => (b.end - b.start) - (a.end - a.start)).forEach((x) => {
    // une appli ne fait pas deux séances du même sport en même temps : le moindre recouvrement (1 min) ou un départ
    // à moins de 5 min d'écart = la même séance envoyée deux fois
    const dup = out.find((y) => y.origin === x.origin && y.type === x.type
      && (Math.min(x.end, y.end) - Math.max(x.start, y.start) >= 60000 || Math.abs(x.start - y.start) <= 5 * 60000));
    if (!dup) out.push(x);
  });
  return out.sort((a, b) => a.start - b.start);
}
export function groupSessions(list, prefs) {
  const g = {};
  dedupeSessions(list).filter((x) => !isSessionIgnored(x, prefs)).forEach((x) => {
    const label = exerciseLabel(x);
    const k = label + "|" + x.origin;
    if (!g[k]) g[k] = { key: k, label, origin: x.origin, count: 0, minutes: 0, first: x.start };
    g[k].count++; g[k].minutes += x.durationMin || 0; g[k].first = Math.min(g[k].first, x.start);
  });
  return Object.values(g).sort((a, b) => a.first - b.first);
}

/**
 * Diagnostic calories d'un jour : enregistrements bruts (toutes applis, sans dédoublonnage)
 * comparés aux totaux dédoublonnés que Health Connect renvoie pour chaque appli.
 */
export async function debugCaloriesDay(iso) {
  const start = dayStart(iso);
  const isToday = iso === new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const end = isToday ? Date.now() : start + 86400000;
  const [raw, agg, ex] = await Promise.all([
    HealthBridge.debugCalories({ start, end }),
    HealthBridge.caloriesBySource({ start, end, basalEnd: start + 86400000 }).catch(() => ({ sources: [] })),
    HealthBridge.readExercises({ start, end }).catch(() => ({ records: [] })),
  ]);
  const rawSessions = (ex.records || []).sort((a, b) => a.start - b.start);
  const kept = new Set(dedupeSessions(rawSessions).map((x) => x.id));
  const prefs = loadHC();
  const sessions = rawSessions.map((x) => ({ ...x, label: exerciseLabel(x), app: originLabel(x.origin), duplicate: !kept.has(x.id), ignored: isSessionIgnored(x, prefs) }));
  const by = {};
  (raw.records || []).forEach((r) => {
    const o = (by[r.origin] = by[r.origin] || { origin: r.origin, label: originLabel(r.origin), active: [], total: [] });
    (o[r.kind] || (o[r.kind] = [])).push(r);
  });
  (agg.sources || []).forEach((a) => {
    const o = (by[a.origin] = by[a.origin] || { origin: a.origin, label: originLabel(a.origin), active: [], total: [] });
    o.agg = a;
  });
  const sum = (l) => Math.round(l.reduce((t, r) => t + r.kcal, 0));
  // chevauchements entre applis : la part des calories actives d'une appli qui tombe sur un créneau d'une autre
  const all = Object.values(by);
  all.forEach((o) => {
    o.activeSum = sum(o.active); o.totalSum = sum(o.total);
    o.active.sort((a, b) => a.start - b.start);
    o.overlap = {};
    all.filter((x) => x !== o).forEach((x) => {
      let k = 0;
      o.active.forEach((r) => x.active.forEach((y) => {
        const ov = Math.min(r.end, y.end) - Math.max(r.start, y.start);
        if (ov > 0 && r.end > r.start) k += r.kcal * ov / (r.end - r.start);
      }));
      if (k >= 1) o.overlap[x.label] = Math.round(k);
    });
  });
  return { iso, end, sessions, sources: all.sort((a, b) => b.activeSum - a.activeSum) };
}

export function originLabel(pkg) {
  const map = {
    "com.fitbit.FitbitMobile": "Fitbit",
    "com.withings.wiscale2": "Withings",
    "com.google.android.apps.fitness": "Google Fit",
    "com.google.android.apps.healthdata": "Health Connect",
    "com.samsung.android.app.shealth": "Samsung Health",
    "com.google.android.apps.wear.companion": "Pixel Watch",
    "com.garmin.android.apps.connectmobile": "Garmin",
    "com.strava": "Strava",
    "app.nutrimaison": "NutriMaison",
  };
  if (!pkg) return "autre appli";
  return map[pkg] || (pkg === "android" ? "Téléphone" : pkg.split(".").slice(-1)[0]);
}
