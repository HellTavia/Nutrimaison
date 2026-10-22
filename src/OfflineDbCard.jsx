// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Les auteurs de NutriMaison
/* Réglages → Base hors ligne : ce qui est intégré, et la base complète à télécharger en option. */
import React, { useEffect, useRef, useState } from "react";
import { Download, Loader2, Trash2 } from "lucide-react";
import { C, MONO } from "./shared.jsx";
import { embeddedInfo, fetchFullDbManifest, fullDbState, installFullDb, loadEmbedded, removeFullDb } from "./offlineDb.js";

const mb = (b) => (b / 1048576).toFixed(0).replace(".", ",") + " Mo";
const n = (v) => (v || 0).toLocaleString("fr-FR");
const frDate = (d) => (d ? new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "—");

export function OfflineDbCard() {
  const [emb, setEmb] = useState(embeddedInfo());
  const [state, setState] = useState(fullDbState());
  const [remote, setRemote] = useState(null); // manifeste en ligne, ou { error }
  const [busy, setBusy] = useState(null);     // { text, done, total }
  const [err, setErr] = useState(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const abortRef = useRef(null);

  useEffect(() => {
    loadEmbedded().then(() => setEmb(embeddedInfo())).catch(() => {});
    fetchFullDbManifest().then(setRemote).catch((e) => setRemote({ error: e.message }));
  }, []);

  async function install() {
    setErr(null); setBusy({ text: "Préparation…" });
    const ctrl = new AbortController(); abortRef.current = ctrl;
    try { setState(await installFullDb(setBusy, ctrl.signal)); }
    catch (e) { if (!e.cancelled) setErr(e.message || "erreur"); }
    finally { setBusy(null); }
  }
  async function remove() { await removeFullDb(); setState(null); setConfirmDel(false); }

  const card = { background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: 16, marginBottom: 12 };
  const small = { fontSize: 12, color: C.inkSoft, lineHeight: 1.5, margin: "4px 0 0" };
  const btn = (primary) => ({
    width: "100%", marginTop: 10, padding: "12px 0", borderRadius: 12, border: primary ? "none" : `1.5px solid ${C.herb}`,
    background: primary ? C.herb : "transparent", color: primary ? C.onAccent : C.herb, fontWeight: 700, fontSize: 13.5,
    display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
  });
  const newer = remote && !remote.error && state && remote.date > state.date;
  const remoteSize = remote && !remote.error ? remote.parts.reduce((a, p) => a + p.bytes, 0) : 0;

  return (
    <div>
      <div style={card}>
        <p style={{ margin: 0, fontSize: 14.5, fontWeight: 700 }}>Intégrée à l'appli</p>
        <p style={small}>Toujours disponible, même sans réseau.</p>
        <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.7 }}>
          <div>🇫🇷 Aliments de base (Ciqual) : <b style={{ fontFamily: MONO }}>3 341</b></div>
          <div>🛒 Produits de marque les plus scannés : <b style={{ fontFamily: MONO }}>{n(emb?.off)}</b>{emb?.offDate ? <span style={small}> · {frDate(emb.offDate)}</span> : null}</div>
          <div>🌎 Aliments génériques traduits (USDA) : <b style={{ fontFamily: MONO }}>{n(emb?.usda)}</b></div>
        </div>
        {emb && !emb.off && <p style={{ ...small, color: C.ochre }}>Cette version a été compilée sans la liste de produits : relance build-apk.sh avec une connexion internet pour l'inclure.</p>}
      </div>

      <div style={card}>
        <p style={{ margin: 0, fontSize: 14.5, fontWeight: 700 }}>Base complète (optionnelle)</p>
        <p style={small}>
          Tous les produits vendus en France présents sur Open Food Facts, pour scanner et chercher n'importe quel produit sans réseau.
          Seuls les morceaux utiles sont lus : l'appli ne ralentit pas.
        </p>
        {state ? (
          <div style={{ marginTop: 10, padding: "10px 12px", background: C.sage, borderRadius: 10, fontSize: 13, lineHeight: 1.6 }}>
            ✓ Installée : <b style={{ fontFamily: MONO }}>{n(state.count)}</b> produits, version du {frDate(state.date)}
            {newer && <div style={{ color: C.herb, fontWeight: 700 }}>Nouvelle version disponible : {frDate(remote.date)}</div>}
          </div>
        ) : remote?.error ? (
          <p style={{ ...small, color: C.inkSoft }}>Base complète pas encore publiée ou hors connexion ({remote.error}).</p>
        ) : remote ? (
          <p style={{ ...small, marginTop: 8 }}>
            En ligne : <b style={{ fontFamily: MONO }}>{n(remote.count)}</b> produits, version du {frDate(remote.date)}, <b>{mb(remoteSize)}</b> à télécharger
            (environ le double une fois installée). Wi-Fi conseillé.
          </p>
        ) : <p style={small}>Recherche de la version en ligne…</p>}

        {busy ? (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: C.inkSoft }}>
              <Loader2 size={15} color={C.herb} style={{ animation: "spin 1s linear infinite" }} /><span style={{ flex: 1 }}>{busy.text}</span>
              <button onClick={() => abortRef.current?.abort()} style={{ background: "none", border: `1px solid ${C.line}`, borderRadius: 999, padding: "4px 10px", fontSize: 12, color: C.inkSoft }}>Annuler</button>
            </div>
            {busy.total > 0 && (
              <div style={{ height: 7, borderRadius: 9, background: C.paperDark, marginTop: 8, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.round((busy.done / busy.total) * 100)}%`, background: C.herb, transition: "width .3s" }} />
              </div>
            )}
            <style>{"@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}"}</style>
          </div>
        ) : (
          <>
            {remote && !remote.error && (!state || newer) && (
              <button onClick={install} style={btn(true)}><Download size={16} /> {state ? "Mettre à jour" : "Télécharger"} ({mb(remoteSize)})</button>
            )}
            {state && (confirmDel ? (
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button onClick={() => setConfirmDel(false)} style={{ ...btn(false), marginTop: 0, flex: 1, borderColor: C.line, color: C.inkSoft }}>Garder</button>
                <button onClick={remove} style={{ ...btn(true), marginTop: 0, flex: 1, background: C.berry }}>Supprimer</button>
              </div>
            ) : (
              <button onClick={() => setConfirmDel(true)} style={{ ...btn(false), borderColor: C.line, color: C.inkSoft }}><Trash2 size={15} /> Supprimer la base complète</button>
            ))}
          </>
        )}
        {err && <p style={{ ...small, color: C.berry }}>Échec : {err}</p>}
      </div>
      <p style={{ ...small, fontSize: 11 }}>
        Ordre de recherche : tes produits, Ciqual, la base intégrée, la base complète, puis Open Food Facts en ligne s'il y a du réseau.
        Données : Open Food Facts (licence ODbL), Ciqual (Anses, Licence Ouverte), USDA FoodData Central (domaine public, noms traduits automatiquement).
      </p>
    </div>
  );
}
