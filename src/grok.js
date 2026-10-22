// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Les auteurs de NutriMaison
/* ---------------------------------------------------------------- */
/* GROK (xAI) — autre fournisseur d'IA possible, à la place de       */
/* Gemini. API compatible OpenAI : https://api.x.ai/v1               */
/* Même logique que Gemini : modèle automatique ou choisi, liste     */
/* actualisable, bascule sur un autre modèle s'il est saturé.        */
/* ---------------------------------------------------------------- */
import { httpRequest } from "./net.js";

const API = "https://api.x.ai/v1";

export function getGrokModelPref() { try { return localStorage.getItem("grokModelPref") || "auto"; } catch (e) { return "auto"; } }
export function setGrokModelPref(v) { try { if (!v || v === "auto") localStorage.removeItem("grokModelPref"); else localStorage.setItem("grokModelPref", v); } catch (e) {} }

export function grokErrorText(status, data) {
  const msg = (data && (data.error?.message || data.error || data.message)) || "";
  const m = typeof msg === "string" ? msg : JSON.stringify(msg);
  if (status === 401 || status === 400 && /api key|unauthorized|incorrect/i.test(m)) return "clé refusée par xAI (vérifie qu'elle est copiée en entier)";
  if (status === 403 && /credit|billing|spend|permission/i.test(m)) return "compte xAI sans crédit ou accès refusé (console.x.ai → Billing)";
  if (status === 403) return "accès refusé par xAI";
  if (status === 429) return "quota ou limite xAI atteint, réessaie plus tard";
  if (status >= 500) return "serveurs Grok saturés en ce moment, réessaie dans quelques minutes";
  return m || "erreur " + status;
}

/** Liste des modèles de la clé, avec ce qu'ils acceptent (texte, image). */
export async function listGrokModels(apiKey) {
  const h = { Authorization: "Bearer " + apiKey };
  let r = await httpRequest(API + "/language-models", { headers: h, timeoutMs: 15000 });
  let list = [];
  if (r.status === 200 && Array.isArray(r.data?.models)) {
    list = r.data.models.map((m) => ({ id: m.id, image: (m.input_modalities || []).includes("image"), aliases: m.aliases || [] }));
  } else {
    r = await httpRequest(API + "/models", { headers: h, timeoutMs: 15000 });
    if (r.status !== 200) throw new Error(grokErrorText(r.status, r.data));
    list = (r.data?.data || []).map((m) => ({ id: m.id, image: /vision|grok-4/i.test(m.id) }));
  }
  // seulement les modèles qui répondent en texte (pas de génération d'image ni de vidéo)
  return list.filter((m) => m.id && !/image|imagine|video|embed|tts|audio/i.test(m.id));
}

/** Ordre automatique : rapide d'abord (« fast », sans réflexion), puis le plus récent. */
export function rankGrokModels(models, needImage) {
  const version = (n) => { const m = n.match(/grok-(\d+(?:[.-]\d+)?)/); return m ? parseFloat(m[1].replace("-", ".")) : 0; };
  const score = (m) => (/fast/.test(m.id) ? 100 : 0) + (/non-reasoning/.test(m.id) ? 20 : 0) - (/code/.test(m.id) ? 200 : 0)
    + version(m.id) * 10 - (/mini/.test(m.id) ? 3 : 0) - (/beta|preview/.test(m.id) ? 2 : 0) + (/latest/.test(m.id) ? 1 : 0);
  return models.filter((m) => !needImage || m.image).sort((a, b) => score(b) - score(a)).map((m) => m.id);
}

export function getCachedGrokModelList(apiKey) {
  try {
    const c = JSON.parse(localStorage.getItem("grokModelList") || "null");
    if (c && Array.isArray(c.models) && (!apiKey || c.key === apiKey.slice(-6))) return c;
  } catch (e) {}
  return null;
}
export async function refreshGrokModelList(apiKey) {
  const models = await listGrokModels(apiKey);
  if (!models.length) throw new Error("aucun modèle Grok disponible pour cette clé");
  const entry = { models: rankGrokModels(models, false), details: models, key: apiKey.slice(-6), at: Date.now() };
  try { localStorage.setItem("grokModelList", JSON.stringify(entry)); } catch (e) {}
  return entry;
}
/** Modèles à essayer, dans l'ordre (le choix de l'utilisateur d'abord). */
export async function grokModelOrder(apiKey, needImage) {
  let c = getCachedGrokModelList(apiKey);
  if (!c || Date.now() - c.at > 7 * 86400000) { try { c = await refreshGrokModelList(apiKey); } catch (e) { if (!c) throw e; } }
  const auto = rankGrokModels(c.details || c.models.map((id) => ({ id, image: /vision|grok-4/i.test(id) })), needImage).slice(0, 4);
  const pref = getGrokModelPref();
  if (pref === "auto") return auto;
  return [pref, ...auto.filter((m) => m !== pref)];
}

/** Parties au format Gemini ({text} / {inline_data}) → message au format OpenAI. */
function toContent(parts) {
  return parts.map((p) => {
    if (p.text != null) return { type: "text", text: p.text };
    const d = p.inline_data || p.inlineData;
    if (d && /^image\//.test(d.mime_type || d.mimeType)) return { type: "image_url", image_url: { url: `data:${d.mime_type || d.mimeType};base64,${d.data}`, detail: "high" } };
    if (d) throw new Error("Grok ne lit pas les vidéos : il faut une clé Gemini pour cette fonction");
    return null;
  }).filter(Boolean);
}

export async function grokGenerate(apiKey, parts, { onStatus, onModel, json = true, temperature = 0.3, timeoutMs = 45000, totalMs = 110000, signal } = {}) {
  const started = Date.now();
  const needImage = parts.some((p) => p.inline_data || p.inlineData);
  const content = toContent(parts);
  const models = await grokModelOrder(apiKey, needImage);
  if (!models.length) throw new Error(needImage ? "aucun modèle Grok de ta clé ne lit les images" : "aucun modèle Grok disponible");
  const pref = getGrokModelPref();
  let last = null;
  for (const model of models) {
    if (pref !== "auto" && model !== pref && model === models[1]) onStatus && onStatus(pref + " indisponible, bascule sur " + model + "…");
    const left = totalMs - (Date.now() - started);
    if (left < 5000) break;
    const body = {
      model, temperature,
      messages: [{ role: "user", content: needImage ? content : content.map((c) => c.text).join("\n") }],
      ...(json ? { response_format: { type: "json_object" } } : {}),
    };
    let r;
    try {
      r = await httpRequest(API + "/chat/completions", { method: "POST", headers: { Authorization: "Bearer " + apiKey }, body, timeoutMs: Math.min(timeoutMs, left), signal });
    } catch (e) {
      if (e.cancelled) throw Object.assign(new Error("analyse annulée"), { cancelled: true });
      last = e.message;
      if (e.timeout) { onStatus && onStatus("Le modèle met trop de temps, essai avec un autre…"); continue; }
      throw e;
    }
    if (r.status === 200) {
      const text = r.data?.choices?.[0]?.message?.content;
      if (!text || !String(text).trim()) { last = "réponse vide de Grok"; continue; }
      onModel && onModel(model);
      return String(text);
    }
    last = grokErrorText(r.status, r.data);
    // le modèle refuse response_format ou n'existe plus : on passe au suivant
    if (r.status === 429 || r.status >= 500 || r.status === 404 || (r.status === 400 && /model|response_format/i.test(JSON.stringify(r.data || "")))) {
      onStatus && onStatus("Modèle Grok indisponible, essai avec un autre…");
      continue;
    }
    throw new Error(last);
  }
  throw new Error(last || "Grok n'a pas répondu");
}
