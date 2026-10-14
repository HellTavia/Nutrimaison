// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Les auteurs de NutriMaison
import React, { useEffect, useState } from "react";
import { Activity, RefreshCw, Settings, ShieldCheck } from "lucide-react";
import { C, MONO } from "./shared.jsx";
import { Toggle } from "./Sport.jsx";
import {
  loadHC, saveHC, hcAvailability, hcRequestPermissions, hcRefreshGranted, hcOpenSettings, isNativeAndroid, debugCaloriesDay,
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
  r: { steps: ["steps"], weight: ["weight"], calories: ["activeCalories", "totalCalories", "basal"], exercise: ["exercise"] },
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
              {hc.read.calories && (
                <div style={{ marginTop: 4 }}>
                  <Toggle checked={hc.fillSessions !== false} onChange={(v) => update({ fillSessions: v })}
                    label="Compléter les séances sans calories"
                    sub="Withings envoie tes séances (boxe, vélo…) mais presque pas leurs calories. NutriMaison estime la séance d'après son type, sa durée et ton poids et ajoute ce qui manque à la dépense de l'appli. Marche et course ne sont pas touchées (déjà comptées par les pas)." />
                </div>
              )}
              {hc.read.calories && <CaloriesDebug />}
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

/* Diagnostic : ce que chaque appli a vraiment écrit dans Health Connect, et ce que Health Connect en compte. */
const isoDay = (k) => { const d = new Date(); d.setDate(d.getDate() - k); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
const hm = (t) => new Date(t).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
function CaloriesDebug() {
  const [open, setOpen] = useState(false);
  const [back, setBack] = useState(0);
  const [res, setRes] = useState(null);
  const [showList, setShowList] = useState({});
  async function run(k = back) {
    setBack(k); setRes({ loading: true });
    try { setRes(await debugCaloriesDay(isoDay(k))); }
    catch (e) { setRes({ error: (e && e.message) || String(e) }); }
  }
  const chip = (on) => ({ padding: "5px 10px", borderRadius: 999, fontSize: 12, border: `1px solid ${on ? C.herb : C.line}`, background: on ? C.sage : "transparent", color: on ? C.herb : C.inkSoft, fontWeight: 600 });
  if (!open) return (
    <button onClick={() => { setOpen(true); run(0); }} style={{ marginTop: 10, background: "none", border: "none", padding: 0, color: C.herb, fontSize: 12, fontWeight: 600, textDecoration: "underline" }}>
      Diagnostic des calories
    </button>
  );
  return (
    <div style={{ marginTop: 10, border: `1px solid ${C.line}`, borderRadius: 10, padding: 10 }}>
      <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, flex: 1 }}>Diagnostic des calories</span>
        <button onClick={() => run(0)} style={chip(back === 0)}>Aujourd'hui</button>
        <button onClick={() => run(1)} style={chip(back === 1)}>Hier</button>
        <button onClick={() => setOpen(false)} style={{ ...chip(false), padding: "5px 8px" }}>✕</button>
      </div>
      {res?.loading && <p style={{ fontSize: 12, color: C.inkSoft, margin: 0 }}>Lecture de Health Connect…</p>}
      {res?.error && <p style={{ fontSize: 12, color: C.berry, margin: 0 }}>Erreur : {res.error}</p>}
      {res?.sources && (
        <>
          <p style={{ fontSize: 11, color: C.inkSoft, margin: "0 0 6px" }}>{res.iso}{back === 0 ? ` · jusqu'à ${hm(res.end)}` : ""} · « brut » = somme de tout ce que l'appli a écrit ; « compté » = ce que Health Connect en retient.</p>
          {res.sources.length === 0 && <p style={{ fontSize: 12, margin: 0 }}>Aucune donnée de calories ce jour-là.</p>}
          {res.sources.map((o) => {
            const a = o.agg || {};
            const lost = a.active != null && o.activeSum - a.active >= 20;
            return (
              <div key={o.origin} style={{ padding: "7px 0", borderTop: `1px solid ${C.line}` }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{o.label}</p>
                <div style={{ fontFamily: MONO, fontSize: 11.5, lineHeight: 1.6, color: C.ink }}>
                  <div>actives brut {o.activeSum} · compté {a.active != null ? Math.round(a.active) : "—"} · {o.active.length} enreg.{o.active.length ? ` (${hm(o.active[0].start)}→${hm(Math.max(...o.active.map((r) => r.end)))})` : ""}</div>
                  <div>total brut {o.totalSum} · compté {a.total != null ? Math.round(a.total) : "—"} · {o.total.length} enreg.</div>
                  <div>métabolisme {a.basal != null ? Math.round(a.basal) : "—"}</div>
                  {Object.entries(o.overlap).map(([k, v]) => <div key={k} style={{ color: C.ochre }}>chevauche {k} : {v} kcal</div>)}
                  {lost && <div style={{ color: C.berry, fontWeight: 700 }}>Health Connect écarte {o.activeSum - Math.round(a.active)} kcal actives</div>}
                </div>
                {o.active.length > 0 && (
                  <button onClick={() => setShowList({ ...showList, [o.origin]: !showList[o.origin] })} style={{ background: "none", border: "none", padding: "2px 0", color: C.herb, fontSize: 11.5, fontWeight: 600 }}>
                    {showList[o.origin] ? "Masquer" : "Voir"} le détail des calories actives
                  </button>
                )}
                {showList[o.origin] && (
                  <div style={{ fontFamily: MONO, fontSize: 11, color: C.inkSoft, maxHeight: 220, overflowY: "auto" }}>
                    {o.active.map((r, i) => <div key={i}>{hm(r.start)}–{hm(r.end)} · {Math.round(r.kcal * 10) / 10} kcal</div>)}
                  </div>
                )}
              </div>
            );
          })}
          {res.sessions?.length > 0 && (
            <div style={{ padding: "7px 0", borderTop: `1px solid ${C.line}` }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>Séances reçues</p>
              <div style={{ fontFamily: MONO, fontSize: 11.5, lineHeight: 1.6 }}>
                {res.sessions.map((x) => (
                  <div key={x.id} style={{ color: x.duplicate ? C.berry : C.ink, textDecoration: x.duplicate ? "line-through" : "none" }}>
                    {hm(x.start)}–{hm(x.end)} · {x.label} · {x.app}{x.duplicate ? " · doublon ignoré" : ""}
                  </div>
                ))}
              </div>
            </div>
          )}
          <p style={{ fontSize: 11, color: C.inkSoft, margin: "6px 0 0" }}>Fais une capture de cet écran pour l'analyse.</p>
        </>
      )}
    </div>
  );
}
