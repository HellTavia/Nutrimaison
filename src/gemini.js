// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Les auteurs de NutriMaison
/* ---------------------------------------------------------------- */
/* GEMINI — choix automatique du modèle                              */
/* Google retire régulièrement des modèles (gemini-2.0-flash a été   */
/* arrêté le 1er juin 2026). On demande donc la liste des modèles    */
/* disponibles pour la clé et on prend le meilleur « flash ».        */
/* ---------------------------------------------------------------- */
export function clearGeminiModelCache() { try { localStorage.removeItem("geminiModel"); } catch (e) {} }
export function geminiErrorText(err) {
  const msg = (err && err.message) || "";
  const reason = (err && err.details && err.details.find((d) => d.reason)?.reason) || err?.status || "";
  if (/API_KEY_INVALID|API key not valid/i.test(msg + reason)) return "clé refusée par Google (vérifie qu'elle est copiée en entier, sans espace)";
  if (/PERMISSION_DENIED/i.test(reason) || err?.code === 403) return "accès refusé (API Gemini non activée pour cette clé, ou restriction d'application)";
  if (/RESOURCE_EXHAUSTED/i.test(reason) || err?.code === 429) return "quota gratuit dépassé pour le moment, réessaie plus tard";
  if (err?.code === 503 || /UNAVAILABLE/i.test(reason) || /overload|high demand/i.test(msg)) return "serveurs Gemini saturés en ce moment (tous les modèles essayés), réessaie dans quelques minutes";
  if (/FAILED_PRECONDITION/i.test(reason) && /location|region/i.test(msg)) return "service non disponible dans ta région";
  return msg || "erreur " + (err?.code || "");
}
/** fetch avec délai maximum : sans ça, une requête sans réponse fait tourner l'app indéfiniment. */
export async function fetchWithTimeout(url, opts = {}, ms = 30000, outerSignal) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new DOMException("timeout", "TimeoutError")), ms);
  const onOuter = () => ctrl.abort(new DOMException("annulé", "AbortError"));
  if (outerSignal) { if (outerSignal.aborted) onOuter(); else outerSignal.addEventListener("abort", onOuter, { once: true }); }
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } catch (e) {
    if (outerSignal?.aborted) throw Object.assign(new Error("analyse annulée"), { cancelled: true });
    if (ctrl.signal.aborted) throw Object.assign(new Error("pas de réponse de Google (délai dépassé)"), { timeout: true });
    throw Object.assign(new Error("pas de connexion internet"), { network: true });
  } finally {
    clearTimeout(timer);
    outerSignal?.removeEventListener?.("abort", onOuter);
  }
}

export async function listGeminiModels(apiKey) {
  const res = await fetchWithTimeout("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", { headers: { "x-goog-api-key": apiKey } }, 15000);
  const data = await res.json().catch(() => ({}));
  if (data.error) throw new Error(geminiErrorText(data.error));
  return (data.models || []).filter((m) => (m.supportedGenerationMethods || []).includes("generateContent"));
}
export function rankGeminiModels(models) {
  const names = models.map((m) => m.name.replace(/^models\//, ""));
  const usable = names.filter((n) => /flash/i.test(n) && !/image|tts|audio|live|embedding|thinking|robotics|computer|native/i.test(n));
  const version = (n) => { const m = n.match(/gemini-(\d+(?:\.\d+)?)/); return m ? parseFloat(m[1]) : 0; };
  const score = (n) => (n === "gemini-flash-latest" ? 1000 : n === "gemini-flash-lite-latest" ? 990 : 0)
    + version(n) * 10 - (/lite/.test(n) ? 3 : 0) - (/preview|exp/.test(n) ? 2 : 0) - (/-\d{3}$/.test(n) ? 0.5 : 0);
  const ranked = [...new Set(usable)].sort((a, b) => score(b) - score(a));
  // on alterne volontairement : meilleur modèle, puis un « lite » (souvent moins saturé), puis les autres
  const firstLite = ranked.find((n) => /lite/.test(n));
  const order = [ranked[0], firstLite, ...ranked].filter(Boolean);
  return [...new Set(order)].slice(0, 4);
}
export function pickGeminiModel(models) { return rankGeminiModels(models)[0] || null; }
export async function resolveGeminiModels(apiKey) {
  try {
    const cached = JSON.parse(localStorage.getItem("geminiModel") || "null");
    if (cached && cached.key === apiKey.slice(-6) && Date.now() - cached.at < 7 * 86400000 && Array.isArray(cached.models) && cached.models.length) {
      return cached.models;
    }
  } catch (e) {}
  const models = rankGeminiModels(await listGeminiModels(apiKey));
  if (!models.length) throw new Error("aucun modèle Gemini compatible pour cette clé");
  try { localStorage.setItem("geminiModel", JSON.stringify({ models, key: apiKey.slice(-6), at: Date.now() })); } catch (e) {}
  return models;
}
export async function resolveGeminiModel(apiKey) { return (await resolveGeminiModels(apiKey))[0]; }
/** Le modèle qui vient de répondre passe en tête pour la prochaine fois. */
export function rememberGoodModel(apiKey, model) {
  try {
    const cached = JSON.parse(localStorage.getItem("geminiModel") || "null");
    if (!cached || !Array.isArray(cached.models)) return;
    cached.models = [model, ...cached.models.filter((m) => m !== model)];
    cached.key = apiKey.slice(-6);
    localStorage.setItem("geminiModel", JSON.stringify(cached));
  } catch (e) {}
}

/**
 * Appel générique à Gemini avec nouvel essai et bascule de modèle si saturé.
 * parts : contenu (texte, images). Renvoie le texte de la réponse.
 */
/* Modèles qui refusent le réglage de « réflexion » (mémorisés pour ne plus l'envoyer). */
function noThinkSet() { try { return new Set(JSON.parse(localStorage.getItem("geminiNoThink") || "[]")); } catch (e) { return new Set(); } }
function markNoThink(model) { try { const s = noThinkSet(); s.add(model); localStorage.setItem("geminiNoThink", JSON.stringify([...s])); } catch (e) {} }

/**
 * Appel générique à Gemini, borné dans le temps :
 *  - chaque requête a un délai maximum (timeoutMs), l'ensemble aussi (totalMs) ;
 *  - « réflexion » réduite au minimum (réponses bien plus rapides), retirée si le modèle la refuse ;
 *  - nouvel essai puis bascule de modèle si saturé ou trop lent ;
 *  - signal : permet d'annuler depuis l'interface.
 */
export async function geminiGenerate(apiKey, parts, { onStatus, json = true, temperature = 0.3, timeoutMs = 45000, totalMs = 110000, signal } = {}) {
  const started = Date.now();
  const models = await resolveGeminiModels(apiKey);
  let lastErr = null;
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const left = totalMs - (Date.now() - started);
      if (left < 5000) { lastErr = { message: "délai dépassé, Google répond trop lentement en ce moment" }; break; }
      if (attempt > 0) { onStatus && onStatus("Serveurs Gemini chargés, nouvel essai…"); await new Promise((r) => setTimeout(r, 2000)); }
      const think = !noThinkSet().has(model);
      const body = JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          ...(json ? { responseMimeType: "application/json" } : {}), temperature,
          ...(think ? { thinkingConfig: { thinkingLevel: "low" } } : {}),
        },
      });
      let data;
      try {
        const res = await fetchWithTimeout("https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent", {
          method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey }, body,
        }, Math.min(timeoutMs, left), signal);
        data = await res.json().catch(() => ({ error: { code: res.status, message: "réponse illisible" } }));
      } catch (e) {
        if (e.cancelled) throw e;
        lastErr = { message: e.message };
        if (e.timeout) { onStatus && onStatus("Le modèle met trop de temps, essai avec un autre…"); break; }
        throw new Error(e.message); // pas de réseau : inutile d'essayer d'autres modèles
      }
      if (!data.error) {
        rememberGoodModel(apiKey, model);
        const cand = data.candidates?.[0];
        const text = (cand?.content?.parts || []).filter((p) => !p.thought).map((p) => p.text || "").join("");
        if (!text.trim()) {
          lastErr = { message: cand?.finishReason === "SAFETY" ? "contenu refusé par le filtre de Google" : "réponse vide de Gemini" };
          break;
        }
        return text;
      }
      lastErr = data.error;
      const code = data.error.code, msg = data.error.message || "";
      // le modèle ne connaît pas le réglage de réflexion : on le retire et on réessaie tout de suite
      if (think && code === 400 && /think/i.test(msg)) { markNoThink(model); attempt--; continue; }
      const busy = code === 503 || code === 500 || code === 429 || /overload|high demand|unavailable|exhausted/i.test(msg);
      const gone = code === 404 || /not found|not supported/i.test(msg);
      if (gone) break;
      if (!busy) throw new Error(geminiErrorText(data.error));
      if (attempt === 1) onStatus && onStatus("Modèle saturé, essai avec un autre modèle…");
    }
  }
  clearGeminiModelCache();
  throw new Error(geminiErrorText(lastErr));
}

/** Réduit une photo avant envoi (1280 px, JPEG) : une photo de 5 Mo devient ~200 Ko. */
export async function shrinkImage(file, maxSide = 1280, quality = 0.85) {
  try {
    const url = URL.createObjectURL(file);
    const img = await new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = url; });
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(url);
    const dataUrl = c.toDataURL("image/jpeg", quality);
    return { mime: "image/jpeg", base64: dataUrl.split(",")[1] };
  } catch (e) {
    return null;
  }
}

export function parseJSONLoose(text) {
  const clean = String(text || "").replace(/```json|```/g, "").trim();
  try { return JSON.parse(clean); } catch (e) {}
  const m = clean.match(/[\[{][\s\S]*[\]}]/);
  return m ? JSON.parse(m[0]) : null;
}
