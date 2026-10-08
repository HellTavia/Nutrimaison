// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Les auteurs de NutriMaison
/* ================================================================== */
/* SAUVEGARDES                                                         */
/*  - export / restauration (texte ou fichier .json)                   */
/*  - copie automatique dans Documents/NutriMaison du téléphone :      */
/*    elle survit à « Effacer les données » et à la désinstallation.   */
/*    On garde les 4 dernières.                                        */
/* ================================================================== */
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { loadJSON, saveJSON } from "./shared.jsx";

const DIR = "NutriMaison";
const KEEP = 4;
const SETTINGS = "autoBackup";
export const AUTO_BACKUP_DEFAULTS = { on: true, everyDays: 7, last: null, lastFile: null, lastError: null };

/** Clés qui ne doivent pas voyager d'une installation à l'autre. */
const SKIP = new Set([SETTINGS, "updateCheck"]);

export function buildBackup() {
  const data = {};
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    if (!SKIP.has(k)) data[k] = window.localStorage.getItem(k);
  }
  return JSON.stringify({ app: "NutriMaison", version: 2, date: new Date().toISOString(), data });
}

/** Restaure une sauvegarde (texte JSON). Renvoie le nombre de clés restaurées, ou lève une erreur. */
export function restoreBackup(text) {
  const obj = JSON.parse(String(text || "").trim());
  if (!obj || obj.app !== "NutriMaison" || !obj.data) throw new Error("Ce n'est pas une sauvegarde NutriMaison.");
  const entries = Object.entries(obj.data).filter(([k]) => !SKIP.has(k));
  entries.forEach(([k, v]) => window.localStorage.setItem(k, v));
  // Health Connect : la sauvegarde peut venir d'une autre installation (ou de l'ancien identifiant d'app).
  // On oublie ce qui avait été « envoyé » pour que tout soit renvoyé proprement par cette installation.
  try {
    const hc = JSON.parse(window.localStorage.getItem("healthConnect") || "null");
    if (hc) { hc.sent = {}; hc.lastSync = null; window.localStorage.setItem("healthConnect", JSON.stringify(hc)); }
  } catch (e) {}
  return entries.length;
}

export function loadAutoBackup() { return { ...AUTO_BACKUP_DEFAULTS, ...loadJSON(SETTINGS, {}) }; }
export function saveAutoBackup(s) { saveJSON(SETTINGS, s); }
export function autoBackupAvailable() {
  try { return Capacitor.isNativePlatform(); } catch (e) { return false; }
}

const stamp = () => {
  const d = new Date(), p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}h${p(d.getMinutes())}-${p(d.getSeconds())}`;
};

async function ensurePermission() {
  // Android 10 et moins : il faut l'autorisation de stockage. Android 11+ : rien à demander pour Documents.
  try {
    const p = await Filesystem.checkPermissions();
    if (p.publicStorage === "granted") return true;
    const r = await Filesystem.requestPermissions();
    return r.publicStorage === "granted";
  } catch (e) { return true; }
}

/** Écrit une sauvegarde dans Documents/NutriMaison et supprime les plus anciennes. */
export async function writeBackupFile() {
  if (!autoBackupAvailable()) throw new Error("disponible seulement dans l'app Android");
  await ensurePermission();
  const name = `nutrimaison-${stamp()}.json`;
  await Filesystem.writeFile({ path: `${DIR}/${name}`, data: buildBackup(), directory: Directory.Documents, encoding: Encoding.UTF8, recursive: true });
  try {
    const { files } = await Filesystem.readdir({ path: DIR, directory: Directory.Documents });
    const ours = (files || []).map((f) => (typeof f === "string" ? f : f.name)).filter((n) => /^nutrimaison-.*\.json$/.test(n)).sort();
    for (const old of ours.slice(0, Math.max(0, ours.length - KEEP))) {
      try { await Filesystem.deleteFile({ path: `${DIR}/${old}`, directory: Directory.Documents }); } catch (e) {}
    }
  } catch (e) {}
  return `Documents/${DIR}/${name}`;
}

/** Au démarrage : sauvegarde si la dernière date de plus de « everyDays » jours. */
export async function maybeAutoBackup() {
  const s = loadAutoBackup();
  if (!s.on || !autoBackupAvailable()) return null;
  const due = !s.last || Date.now() - new Date(s.last).getTime() >= s.everyDays * 86400000 - 3600000;
  if (!due) return null;
  // rien à sauver tant qu'aucun jour n'est noté
  const hasData = Object.keys(window.localStorage).some((k) => k.startsWith("day:"));
  if (!hasData) return null;
  try {
    const file = await writeBackupFile();
    saveAutoBackup({ ...s, last: new Date().toISOString(), lastFile: file, lastError: null });
    return file;
  } catch (e) {
    saveAutoBackup({ ...s, lastError: String(e?.message || e) });
    return null;
  }
}
