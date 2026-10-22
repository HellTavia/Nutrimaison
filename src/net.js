// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Les auteurs de NutriMaison
/* ---------------------------------------------------------------- */
/* Requêtes réseau qui passent outre le CORS                        */
/* Dans l'appli Android, les requêtes passent par le client HTTP     */
/* natif de Capacitor : pas de blocage CORS (api.x.ai, pages         */
/* Instagram ou de blogs). Dans un navigateur, fetch classique.      */
/* ---------------------------------------------------------------- */
import { Capacitor, CapacitorHttp } from "@capacitor/core";

const native = () => { try { return Capacitor.isNativePlatform() && !!CapacitorHttp; } catch (e) { return false; } };

/**
 * opts : { method, headers, body (objet → JSON, ou texte), timeoutMs, signal, text (réponse brute) }
 * Renvoie { status, data } (data = objet JSON, ou texte si opts.text / réponse non JSON).
 */
export async function httpRequest(url, opts = {}) {
  const { method = "GET", headers = {}, body, timeoutMs = 30000, signal, text = false } = opts;
  if (signal?.aborted) throw Object.assign(new Error("annulé"), { cancelled: true });
  const timeoutErr = () => Object.assign(new Error("pas de réponse (délai dépassé)"), { timeout: true });

  if (native()) {
    const isObj = body != null && typeof body === "object";
    const req = CapacitorHttp.request({
      url, method, headers: isObj ? { "Content-Type": "application/json", ...headers } : headers,
      data: body, connectTimeout: Math.min(timeoutMs, 20000), readTimeout: timeoutMs,
      responseType: text ? "text" : "json",
    });
    let timer;
    const res = await Promise.race([
      req,
      new Promise((_, rej) => { timer = setTimeout(() => rej(timeoutErr()), timeoutMs + 2000); }),
      ...(signal ? [new Promise((_, rej) => signal.addEventListener("abort", () => rej(Object.assign(new Error("annulé"), { cancelled: true })), { once: true }))] : []),
    ]).finally(() => clearTimeout(timer));
    let data = res.data;
    if (!text && typeof data === "string") { try { data = JSON.parse(data); } catch (e) {} }
    return { status: res.status, data };
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const onAbort = () => ctrl.abort();
  signal?.addEventListener("abort", onAbort, { once: true });
  try {
    const isObj = body != null && typeof body === "object";
    const res = await fetch(url, {
      method, signal: ctrl.signal,
      headers: isObj ? { "Content-Type": "application/json", ...headers } : headers,
      body: isObj ? JSON.stringify(body) : body,
    });
    const raw = await res.text();
    let data = raw;
    if (!text) { try { data = JSON.parse(raw); } catch (e) {} }
    return { status: res.status, data };
  } catch (e) {
    if (signal?.aborted) throw Object.assign(new Error("annulé"), { cancelled: true });
    if (ctrl.signal.aborted) throw timeoutErr();
    throw Object.assign(new Error("pas de connexion internet (ou site injoignable)"), { network: true });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}
