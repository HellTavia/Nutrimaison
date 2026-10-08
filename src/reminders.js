// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Les auteurs de NutriMaison
/* ================================================================== */
/* RAPPELS (notifications locales, aucun serveur)                      */
/*  - le soir : seulement si rien n'a été noté ce jour-là              */
/*  - le matin : seulement si la pesée du jour n'est pas faite          */
/* Android ne peut pas « vérifier » au moment de sonner : on programme  */
/* donc un rappel par jour pour les 7 prochains jours, et on annule     */
/* celui du jour dès que le repas / la pesée est noté. La liste est     */
/* reconstruite à chaque ouverture de l'app et après chaque saisie.     */
/* ================================================================== */
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { loadJSON, saveJSON, addDays, todayISO, dayKcal } from "./shared.jsx";

const KEY = "reminders";
export const REMINDER_DEFAULTS = {
  evening: { on: false, time: "20:30" },
  morning: { on: false, time: "07:30" },
};
const EVENING = 1, MORNING = 2;
const idFor = (type, iso) => type * 100000000 + Number(iso.replace(/-/g, "")); // ex. 120261006

export function loadReminders() {
  const s = loadJSON(KEY, {});
  return { evening: { ...REMINDER_DEFAULTS.evening, ...(s.evening || {}) }, morning: { ...REMINDER_DEFAULTS.morning, ...(s.morning || {}) } };
}
export function saveReminders(s) { saveJSON(KEY, s); }
export function remindersAvailable() {
  try { return Capacitor.isNativePlatform(); } catch (e) { return false; }
}

export async function ensureNotifPermission() {
  if (!remindersAvailable()) return false;
  try {
    let p = await LocalNotifications.checkPermissions();
    if (p.display !== "granted") p = await LocalNotifications.requestPermissions();
    return p.display === "granted";
  } catch (e) { return false; }
}

const EVENING_TEXTS = [
  "Rien n'est encore noté aujourd'hui. 1 minute pour ton journal ?",
  "Tes repas du jour ne sont pas encore notés. Les « récents » vont vite !",
  "Pense à noter ta journée : c'est ce qui rend ton « besoin réel » fiable.",
];

/** Reconstruit les rappels des 7 prochains jours selon les réglages et les saisies. */
export async function syncReminders() {
  if (!remindersAvailable()) return { skipped: true };
  const s = loadReminders();
  try {
    const pending = await LocalNotifications.getPending();
    const ours = (pending.notifications || []).filter((n) => n.id >= 100000000 && n.id < 300000000);
    if (ours.length) await LocalNotifications.cancel({ notifications: ours.map((n) => ({ id: n.id })) });
    if (!s.evening.on && !s.morning.on) return { scheduled: 0 };
    const p = await LocalNotifications.checkPermissions();
    if (p.display !== "granted") return { scheduled: 0, noPermission: true };

    const now = Date.now();
    const weights = loadJSON("weights", {});
    const list = [];
    for (let i = 0; i < 7; i++) {
      const d = addDays(todayISO(), i);
      if (s.evening.on) {
        const at = new Date(`${d}T${s.evening.time}:00`);
        const day = loadJSON("day:" + d, null);
        if (at.getTime() > now + 30000 && dayKcal(day) <= 0) {
          list.push({ id: idFor(EVENING, d), title: "NutriMaison 🍽️", body: EVENING_TEXTS[i % EVENING_TEXTS.length], schedule: { at, allowWhileIdle: true } });
        }
      }
      if (s.morning.on) {
        const at = new Date(`${d}T${s.morning.time}:00`);
        if (at.getTime() > now + 30000 && !weights[d]) {
          list.push({ id: idFor(MORNING, d), title: "Pesée du matin ⚖️", body: "Avant le petit-déjeuner, après les toilettes : c'est la pesée la plus fiable.", schedule: { at, allowWhileIdle: true } });
        }
      }
    }
    if (list.length) await LocalNotifications.schedule({ notifications: list });
    return { scheduled: list.length };
  } catch (e) {
    return { error: String(e?.message || e) };
  }
}

/** Notification de test, 5 secondes plus tard. */
export async function testReminder() {
  if (!(await ensureNotifPermission())) return false;
  await LocalNotifications.schedule({ notifications: [{ id: 99, title: "NutriMaison", body: "Les rappels fonctionnent ✓", schedule: { at: new Date(Date.now() + 5000) } }] });
  return true;
}
