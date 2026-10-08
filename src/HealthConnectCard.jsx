// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Les auteurs de NutriMaison
import React, { useEffect, useState } from "react";
import { Activity, RefreshCw, Settings, ShieldCheck } from "lucide-react";
import { C, MONO } from "./shared.jsx";
import { Toggle } from "./Sport.jsx";
import {
  loadHC, saveHC, hcAvailability, hcRequestPermissions, hcRefreshGranted, hcOpenSettings, isNativeAndroid,
} from "./healthconnect.js";

const WRITE_ITEMS = [
  ["nutrition", "Repas (calories et macros)", "Fitbit et les autres applis voient ce que tu as mangé. Ne note plus tes repas dans Fitbit, sinon ils seraient comptés deux fois."],
  ["hydration", "Hydratation", null],
  ["exercise", "Séances faites dans NutriMaison", "La séance apparaît dans ton historique Health Connect (type, durée)."],
  ["exerciseCalories", "… avec leurs calories estimées", "Désactivé par défaut : ta montre mesure déjà ta dépense, l'ajouter ferait un doublon de calories."],
  ["weight", "Pesées tapées à la main", "Seulement celles saisies dans l'app. Les pesées venant de Withings ne sont jamais renvoyées."],
  ["bodyFat", "Masse grasse (mensurations)", "Si ta balance Withings mesure aussi la masse grasse, désactive pour garder une seule source."],
];
const READ_ITEMS = [
  ["steps", "Pas", "Remplissent automatiquement tes pas du jour (total dédoublonné par Health Connect)."],
  ["weight", "Poids (balance Withings…)", "Importe ta première pesée de chaque jour dans le suivi du poids."],
  ["calories", "Calories dépensées mesurées", "Affichées sur l'accueil, à titre d'information."],
  ["exercise", "Séances des autres applis", "Affichées dans « Sport du jour »."],
];
const PERM_OF = {
  w: { nutrition: ["nutrition"], hydration: ["hydration"], exercise: ["exercise"], exerciseCalories: ["activeCalories"], weight: ["weight"], bodyFat: ["bodyFat"] },
  r: { steps: ["steps"], weight: ["weight"], calories: ["activeCalories", "totalCalories"], exercise: ["exercise"] },
};

export function HealthConnectCard({ onSync }) {
  const [hc, setHc] = useState(loadHC());
  const [status, setStatus] = useState(isNativeAndroid() ? "…" : "web");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    hcAvailability().then(setStatus);
    hcRefreshGranted().then(() => setHc(loadHC()));
  }, []);

  function update(patch) { const next = { ...loadHC(), ...patch }; saveHC(next); setHc(next); }
  const granted = (kind, items) => items.every((p) => (hc.granted?.[kind === "w" ? "write" : "read"] || []).includes(p));
  const anyMissing = hc.enabled && (
    WRITE_ITEMS.some(([k]) => hc.write[k] && !granted("w", PERM_OF.w[k])) ||
    READ_ITEMS.some(([k]) => hc.read[k] && !granted("r", PERM_OF.r[k])));

  async function authorize() {
    setBusy(true); setMsg(null);
    try { await hcRequestPermissions(); setHc(loadHC()); setMsg("Autorisations mises à jour."); }
    catch (e) { setMsg("Impossible d'ouvrir les autorisations : " + (e.message || e)); }
    setBusy(false);
  }
  async function syncNow() {
    setBusy(true); setMsg(null);
    const res = await onSync();
    const h = loadHC(); setHc(h);
    if (res && res.error) setMsg("Erreur : " + res.error);
    else if (res && !res.skipped) setMsg(`Synchronisé ✓ — ${res.written} envoi(s), ${res.deleted} suppression(s), ${res.weightsImported} pesée(s) importée(s).`);
    setBusy(false);
  }

  const card = { background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: 18, marginBottom: 16 };
  const btn = { flex: 1, padding: "10px 8px", borderRadius: 10, border: "none", background: C.sage, color: C.herb, fontWeight: 600, fontSize: 12.5, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 };
  const sub = { fontSize: 11.5, color: C.inkSoft, lineHeight: 1.5, margin: "6px 0 0" };

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <Activity size={16} color={C.herb} />
        <p style={{ margin: 0, fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: 15.5 }}>Health Connect</p>
      </div>

      {status === "web" ? (
        <p style={{ ...sub, marginTop: 0 }}>Disponible uniquement dans l'application Android (APK).</p>
      ) : status !== "available" && status !== "…" ? (
        <p style={{ ...sub, marginTop: 0, color: C.berry }}>
          {status === "update_required" ? "Health Connect doit être mis à jour (Play Store)." : "Health Connect n'est pas disponible sur cet appareil."}
        </p>
      ) : (
        <>
          <Toggle checked={hc.enabled} onChange={(v) => update({ enabled: v })} label="Synchroniser avec Health Connect"
            sub="Échange avec Fitbit, Withings et les autres applis reliées, sans doublon : chaque donnée n'a qu'une seule source." />

          {hc.enabled && (
            <>
              <p style={{ margin: "14px 0 4px", fontSize: 12, fontWeight: 600, color: C.inkSoft }}>NutriMaison envoie</p>
              {WRITE_ITEMS.map(([k, l, d]) => (
                <div key={k} style={{ marginBottom: 4 }}>
                  <Toggle checked={!!hc.write[k]} onChange={(v) => update({ write: { ...hc.write, [k]: v } })}
                    label={<>{l}{hc.write[k] && !granted("w", PERM_OF.w[k]) && <span style={{ color: C.berry, fontSize: 11 }}> · non autorisé</span>}</>} sub={d} />
                </div>
              ))}
              <p style={{ margin: "14px 0 4px", fontSize: 12, fontWeight: 600, color: C.inkSoft }}>NutriMaison lit</p>
              {READ_ITEMS.map(([k, l, d]) => (
                <div key={k} style={{ marginBottom: 4 }}>
                  <Toggle checked={!!hc.read[k]} onChange={(v) => update({ read: { ...hc.read, [k]: v } })}
                    label={<>{l}{hc.read[k] && !granted("r", PERM_OF.r[k]) && <span style={{ color: C.berry, fontSize: 11 }}> · non autorisé</span>}</>} sub={d} />
                </div>
              ))}

              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button onClick={authorize} disabled={busy} style={{ ...btn, background: anyMissing ? C.herb : C.sage, color: anyMissing ? C.onAccent : C.herb }}>
                  <ShieldCheck size={14} /> {anyMissing ? "Autoriser l'accès" : "Autorisations"}
                </button>
                <button onClick={syncNow} disabled={busy} style={btn}><RefreshCw size={14} /> Synchroniser</button>
                <button onClick={hcOpenSettings} style={{ ...btn, flex: "0 0 44px" }} aria-label="Réglages Health Connect"><Settings size={14} /></button>
              </div>
              {msg && <p style={{ ...sub, color: /Erreur|Impossible/.test(msg) ? C.berry : C.herb }}>{msg}</p>}
              {hc.lastSync && (
                <p style={sub}>
                  Dernière synchro : <span style={{ fontFamily: MONO }}>{new Date(hc.lastSync).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</span>
                  {hc.lastError && <span style={{ color: C.berry }}> — {hc.lastError}</span>}
                </p>
              )}
              <div style={{ background: C.sage, borderRadius: 10, padding: 10, marginTop: 10 }}>
                <p style={{ margin: 0, fontSize: 11.5, color: C.herb, lineHeight: 1.55 }}>
                  <strong>Pour zéro doublon :</strong> note tes repas uniquement dans NutriMaison ; pèse-toi sur la balance (ne retape pas la pesée) ; dans Health Connect → Données et accès, mets ta montre en tête des sources pour les pas et l'activité. La synchro se fait à l'ouverture de l'app et quelques secondes après chaque modification.
                </p>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
