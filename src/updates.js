// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Les auteurs de NutriMaison
/* ================================================================== */
/* NOUVELLES VERSIONS                                                  */
/* L'app lit la dernière « Release » publiée sur GitHub (une fois par  */
/* jour au plus) et prévient si elle est plus récente que celle-ci.   */
/* Rien n'est envoyé : simple lecture publique de la page du dépôt.   */
/* ================================================================== */
import { Capacitor } from "@capacitor/core";
import { loadJSON, saveJSON } from "./shared.jsx";

export const REPO = "HellTavia/Nutrimaison";
export const REPO_URL = `https://github.com/${REPO}`;
const API = `https://api.github.com/repos/${REPO}/releases/latest`;
const KEY = "updateCheck";

/** « v2.11.0 », « NutriMaison 2.11 » → [2, 11, 0] */
export function parseVersion(s) {
  const m = String(s || "").match(/(\d+)\.(\d+)(?:\.(\d+))?/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3] || 0)] : null;
}
export function isNewer(a, b) {
  const x = parseVersion(a), y = parseVersion(b);
  if (!x || !y) return false;
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i];
  return false;
}

export function loadUpdateState() { return { on: true, lastCheck: 0, latest: null, dismissed: null, ...loadJSON(KEY, {}) }; }
export function saveUpdateState(s) { saveJSON(KEY, s); }

/** Interroge GitHub. Renvoie { version, url, apkUrl, notes, date } ou lève une erreur. */
export async function fetchLatestRelease() {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 12000);
  try {
    const res = await fetch(API, { headers: { Accept: "application/vnd.github+json" }, signal: ctl.signal });
    if (res.status === 404) throw new Error("aucune version publiée pour l'instant");
    if (!res.ok) throw new Error("GitHub indisponible (" + res.status + ")");
    const r = await res.json();
    const apk = (r.assets || []).find((a) => /\.apk$/i.test(a.name || ""));
    const version = parseVersion(r.tag_name) ? r.tag_name : r.name;
    return {
      version: (parseVersion(version) || []).join("."), tag: r.tag_name, url: r.html_url || `${REPO_URL}/releases/latest`,
      apkUrl: apk?.browser_download_url || null, notes: String(r.body || "").slice(0, 1500), date: r.published_at || null,
    };
  } finally { clearTimeout(t); }
}

/**
 * Vérifie (au plus une fois par jour, sauf force) et renvoie la release si elle est plus récente
 * que la version installée, sinon null.
 */
export async function checkForUpdate(currentVersion, { force = false } = {}) {
  const s = loadUpdateState();
  if (!s.on && !force) return null;
  if (!force && Date.now() - (s.lastCheck || 0) < 20 * 3600 * 1000) {
    return s.latest && isNewer(s.latest.version, currentVersion) ? s.latest : null;
  }
  const latest = await fetchLatestRelease();
  saveUpdateState({ ...loadUpdateState(), lastCheck: Date.now(), latest });
  return isNewer(latest.version, currentVersion) ? latest : null;
}

/** Ouvre un lien dans le navigateur du téléphone (dans l'app Android, Capacitor redirige vers Chrome). */
export function openExternal(url) {
  if (!url) return;
  let native = false;
  try { native = Capacitor.isNativePlatform(); } catch (e) {}
  if (native) window.location.href = url;
  else window.open(url, "_blank", "noopener");
}
