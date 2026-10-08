// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Les auteurs de NutriMaison
/* Profil : objectifs, rappels, Health Connect, sauvegarde, mises à jour */
import React, { useState, useEffect } from "react";
import { Calculator, Download, Eye, EyeOff, Flame, Scale, Sparkles, Upload } from "lucide-react";
import { autoBackupAvailable, buildBackup, loadAutoBackup, restoreBackup, saveAutoBackup, writeBackupFile } from "../backup.js";
import { REPO_URL, checkForUpdate, loadUpdateState, openExternal, saveUpdateState } from "../updates.js";
import { clearGeminiModelCache, resolveGeminiModel } from "../gemini.js";
import { applyTheme, loadThemePref, C, NumInput, SectionTitle, Tag, bmrMifflin, inputStyle, round, stepsKcal } from "../shared.jsx";
import { Toggle, plannedWeeklySportKcal } from "../Sport.jsx";
import { HealthConnectCard } from "../HealthConnectCard.jsx";
import { ensureNotifPermission, loadReminders, remindersAvailable, saveReminders, syncReminders, testReminder } from "../reminders.js";
import { CIQUAL_CITATION } from "../ciqualDb.js";
import { APP_VERSION } from "../version.js";

/* ---------------------------------------------------------------- */
/* PROFIL / OBJECTIFS                                                 */
/* ---------------------------------------------------------------- */
/**
 * Calcul des besoins.
 *  - mode "simple"   : métabolisme de base × niveau d'activité (formule classique)
 *  - mode "detaille" : base × 1,2 (vie quotidienne) + tes pas au-delà de 3 500/jour + ton sport prévu.
 *    Évite de compter deux fois les pas et le sport.
 * Si une mesure de masse grasse existe, le métabolisme de base utilise Katch-McArdle (masse maigre).
 */
export function computeGoalsFromProfile(info, extras = {}) {
  const { sexe, poids, taille, objectif } = info;
  const mode = info.calcMode || "detaille";
  const lean = extras.bodyFat ? poids * (1 - extras.bodyFat / 100) : null;
  const bmr = lean ? 370 + 21.6 * lean : bmrMifflin(info);
  let maintenance, detail;
  if (mode === "simple") {
    maintenance = bmr * info.activite;
    detail = { bmr, activityKcal: maintenance - bmr };
  } else {
    const daily = bmr * 1.2;
    const stepsExtra = stepsKcal(Math.max(0, (extras.habitualSteps || 0) - 3500), poids, taille);
    const sport = (extras.weeklySportKcal || 0) / 7;
    maintenance = daily + stepsExtra + sport;
    detail = { bmr, daily, stepsExtra, sport };
  }
  let kcal = maintenance;
  if (objectif === "perte") kcal -= Math.min(500, maintenance * 0.2);
  if (objectif === "prise") kcal += 300;
  const floor = Math.max(sexe === "homme" ? 1500 : 1200, bmr * 0.95);
  kcal = Math.round(Math.max(floor, kcal));
  // Protéines : sur la masse maigre si connue, sinon sur un poids de référence plafonné (IMC 27)
  const refKg = Math.min(poids, 27 * Math.pow(taille / 100, 2));
  const prot = Math.round(lean ? lean * 2.2 : refKg * 1.8);
  const fat = Math.round((kcal * 0.25) / 9);
  const carbs = Math.max(0, Math.round((kcal - prot * 4 - fat * 9) / 4));
  const water = Math.round(poids * 30);
  return { kcal, prot, carbs, fat, water, _maintenance: Math.round(maintenance), _detail: detail, _katch: !!lean };
}

export let runHcSyncRef = { current: null };
export function ProfileView({ goals, onSave, personalInfo, onSavePersonalInfo, sportSettings, onSaveSportSettings, bodyFat, weightStats, onOpenBody }) {
  const [local, setLocal] = useState(goals);
  const [saved, setSaved] = useState(false);
  const [info, setInfo] = useState(personalInfo);
  const [computed, setComputed] = useState(null);
  const [showKey, setShowKey] = useState(false);
  const [keySaved, setKeySaved] = useState(false);
  useEffect(() => setLocal(goals), [goals]);
  useEffect(() => setInfo(personalInfo), [personalInfo]);

  const [keyTest, setKeyTest] = useState(null);
  function saveGeminiKey() {
    const cleaned = { ...info, geminiApiKey: (info.geminiApiKey || "").replace(/\s+/g, "") };
    setInfo(cleaned);
    onSavePersonalInfo(cleaned);
    clearGeminiModelCache();
    setKeySaved(true); setTimeout(() => setKeySaved(false), 1800);
  }
  async function testGeminiKey() {
    const key = (info.geminiApiKey || "").replace(/\s+/g, "");
    if (!key) { setKeyTest({ ok: false, text: "Colle d'abord ta clé." }); return; }
    setKeyTest({ loading: true });
    try {
      clearGeminiModelCache();
      const model = await resolveGeminiModel(key);
      setKeyTest({ ok: true, text: "Clé valide ✓ — modèle utilisé : " + model });
    } catch (e) {
      setKeyTest({ ok: false, text: "Échec : " + e.message });
    }
  }

  function field(key, label, unit) {
    return (
      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 12, color: C.inkSoft }}>{label}</label>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
          <NumInput min={0} value={local[key]} onChange={(v) => setLocal({ ...local, [key]: v })}
            style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: `1px solid ${C.line}`, fontFamily: "'IBM Plex Mono',monospace", fontSize: 14 }} />
          <span style={{ fontSize: 12, color: C.inkSoft, width: 26 }}>{unit}</span>
        </div>
      </div>
    );
  }

  const extras = {
    habitualSteps: sportSettings.habitualSteps,
    weeklySportKcal: plannedWeeklySportKcal(sportSettings, info.poids),
    bodyFat: bodyFat?.bf,
  };
  function runCalculation() {
    onSavePersonalInfo(info);
    setComputed(computeGoalsFromProfile(info, extras));
  }
  function applyComputed() {
    if (!computed) return;
    const { _maintenance, _detail, _katch, ...g0 } = computed;
    const g = { ...g0, foodWater: local.foodWater };
    setLocal(g);
    onSave(g);
    setSaved(true); setTimeout(() => setSaved(false), 1800);
  }

  const activityOptions = [
    [1.2, "Sédentaire (peu ou pas de sport)"],
    [1.375, "Légèrement actif (1-3x/semaine)"],
    [1.55, "Modérément actif (3-5x/semaine)"],
    [1.725, "Très actif (6-7x/semaine)"],
    [1.9, "Extrêmement actif (sport intense quotidien)"],
  ];
  const objectifOptions = [
    ["perte", "Perte de poids"],
    ["maintien", "Maintien"],
    ["prise", "Prise de masse"],
  ];

  return (
    <div style={{ padding: "28px 20px 8px" }}>
      <SectionTitle sub="Personnalise tes objectifs quotidiens.">Profil</SectionTitle>

      <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: 18, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <Calculator size={16} color={C.herb} />
          <p style={{ margin: 0, fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: 15.5 }}>Calculer mes besoins</p>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {["homme", "femme"].map((s) => (
            <button key={s} onClick={() => setInfo({ ...info, sexe: s })} style={{
              flex: 1, padding: "9px 0", borderRadius: 10, border: `1px solid ${info.sexe === s ? C.herb : C.line}`,
              background: info.sexe === s ? C.herb : C.card, color: info.sexe === s ? C.onAccent : C.ink, fontSize: 13, fontWeight: 600, textTransform: "capitalize",
            }}>{s}</button>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
          <div>
            <label style={{ fontSize: 11, color: C.inkSoft }}>Poids (kg)</label>
            <NumInput min={25} max={350} value={info.poids} onChange={(v) => setInfo({ ...info, poids: v })}
              style={{ width: "100%", padding: "8px 8px", borderRadius: 8, border: `1px solid ${C.line}`, fontFamily: "'IBM Plex Mono',monospace", fontSize: 13, marginTop: 3 }} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: C.inkSoft }}>Taille (cm)</label>
            <NumInput min={100} max={250} decimals={false} value={info.taille} onChange={(v) => setInfo({ ...info, taille: v })}
              style={{ width: "100%", padding: "8px 8px", borderRadius: 8, border: `1px solid ${C.line}`, fontFamily: "'IBM Plex Mono',monospace", fontSize: 13, marginTop: 3 }} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: C.inkSoft }}>Âge</label>
            <NumInput min={10} max={110} decimals={false} value={info.age} onChange={(v) => setInfo({ ...info, age: v })}
              style={{ width: "100%", padding: "8px 8px", borderRadius: 8, border: `1px solid ${C.line}`, fontFamily: "'IBM Plex Mono',monospace", fontSize: 13, marginTop: 3 }} />
          </div>
        </div>

        <label style={{ fontSize: 11, color: C.inkSoft }}>Mode de calcul</label>
        <div style={{ display: "flex", gap: 6, marginTop: 3, marginBottom: 10 }}>
          {[["detaille", "Détaillé (pas + sport)"], ["simple", "Simple (niveau d'activité)"]].map(([v, l]) => (
            <button key={v} onClick={() => setInfo({ ...info, calcMode: v })} style={{
              flex: 1, padding: "8px 4px", borderRadius: 9, border: `1px solid ${(info.calcMode || "detaille") === v ? C.herb : C.line}`,
              background: (info.calcMode || "detaille") === v ? C.herb : C.card, color: (info.calcMode || "detaille") === v ? C.onAccent : C.ink, fontSize: 11.5, fontWeight: 600,
            }}>{l}</button>
          ))}
        </div>
        {(info.calcMode || "detaille") === "simple" ? (
          <>
            <label style={{ fontSize: 11, color: C.inkSoft }}>Niveau d'activité</label>
            <select value={info.activite} onChange={(e) => setInfo({ ...info, activite: Number(e.target.value) })}
              style={{ width: "100%", padding: "9px 8px", borderRadius: 8, border: `1px solid ${C.line}`, fontSize: 12.5, marginTop: 3, marginBottom: 12, background: C.card }}>
              {activityOptions.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </>
        ) : (
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: C.inkSoft }}>Pas habituels par jour</label>
            <NumInput min={0} decimals={false} value={sportSettings.habitualSteps} onChange={(v) => onSaveSportSettings({ ...sportSettings, habitualSteps: v })}
              style={{ width: "100%", padding: "8px 8px", borderRadius: 8, border: `1px solid ${C.line}`, fontFamily: "'IBM Plex Mono',monospace", fontSize: 13, marginTop: 3 }} />
            <p style={{ fontSize: 11, color: C.inkSoft, margin: "6px 0 0", lineHeight: 1.45 }}>
              Sport prévu : ≈ {Math.round(extras.weeklySportKcal)} kcal / semaine d'après ton programme (onglet Sport).
              {bodyFat ? ` Masse grasse ${round(bodyFat.bf)} % : métabolisme calculé sur ta masse maigre.` : " Ajoute tes mensurations pour un calcul basé sur ta masse maigre."}
            </p>
          </div>
        )}

        <label style={{ fontSize: 11, color: C.inkSoft }}>Objectif</label>
        <div style={{ display: "flex", gap: 6, marginTop: 3, marginBottom: 14 }}>
          {objectifOptions.map(([v, l]) => (
            <button key={v} onClick={() => setInfo({ ...info, objectif: v })} style={{
              flex: 1, padding: "8px 4px", borderRadius: 9, border: `1px solid ${info.objectif === v ? C.herb : C.line}`,
              background: info.objectif === v ? C.herb : C.card, color: info.objectif === v ? C.onAccent : C.ink, fontSize: 11.5, fontWeight: 600,
            }}>{l}</button>
          ))}
        </div>

        <button onClick={runCalculation} style={{
          width: "100%", padding: "11px 0", borderRadius: 10, border: `1.5px solid ${C.herb}`, background: "transparent",
          color: C.herb, fontWeight: 600, fontSize: 13,
        }}>Calculer</button>

        {computed && (
          <div style={{ marginTop: 14, background: C.sage, borderRadius: 12, padding: 14 }}>
            <p style={{ margin: "0 0 4px", fontSize: 12.5, color: C.herbLight }}>Maintien estimé : <strong>{computed._maintenance} kcal</strong></p>
            {computed._detail.daily != null ? (
              <p style={{ margin: "0 0 8px", fontSize: 11.5, color: C.herbLight, lineHeight: 1.5, fontFamily: "'IBM Plex Mono',monospace" }}>
                Base {Math.round(computed._detail.bmr)}{computed._katch ? " (masse maigre)" : ""} × 1,2 = {Math.round(computed._detail.daily)}
                {" "}+ pas {Math.round(computed._detail.stepsExtra)} + sport {Math.round(computed._detail.sport)}
              </p>
            ) : (
              <p style={{ margin: "0 0 8px", fontSize: 11.5, color: C.herbLight, fontFamily: "'IBM Plex Mono',monospace" }}>Base {Math.round(computed._detail.bmr)} + activité {Math.round(computed._detail.activityKcal)}</p>
            )}
            {weightStats?.adaptive?.ok && Math.abs(weightStats.adaptive.tdee - computed._maintenance) > 150 && (
              <p style={{ margin: "0 0 8px", fontSize: 11.5, color: C.berry, lineHeight: 1.45 }}>
                D'après ton poids réel et tes repas notés, ton besoin mesuré est plutôt de {weightStats.adaptive.tdee} kcal. Il est plus fiable que la formule : utilise « Besoin réel » (Corps &amp; progrès) pour fixer ton objectif.
              </p>
            )}
            <p style={{ margin: "0 0 8px", fontSize: 12.5, color: C.herbLight }}>Objectif par jour</p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
              <Tag color={C.herb} bg={C.card}>{computed.kcal} kcal</Tag>
              <Tag color={C.berry} bg={C.berryLight}>P {computed.prot}g</Tag>
              <Tag color={C.ochre} bg={C.ochreLight}>G {computed.carbs}g</Tag>
              <Tag color={C.olive} bg={C.oliveLight}>L {computed.fat}g</Tag>
              <Tag color={C.herb} bg={C.card}>Eau {computed.water}ml</Tag>
            </div>
            <button onClick={applyComputed} style={{
              width: "100%", padding: "10px 0", borderRadius: 9, border: "none", background: C.herb, color: C.onAccent, fontWeight: 600, fontSize: 13,
            }}>Appliquer à mes objectifs</button>
          </div>
        )}
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: 18, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <Scale size={16} color={C.herb} />
          <p style={{ margin: 0, fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: 15.5 }}>Corps & progrès</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => onOpenBody("poids")} style={profileLinkBtn}>Poids</button>
          <button onClick={() => onOpenBody("mesures")} style={profileLinkBtn}>Masse grasse</button>
          <button onClick={() => onOpenBody("besoin")} style={profileLinkBtn}>Besoin réel</button>
        </div>
        {weightStats?.adaptive?.ok && (
          <p style={{ fontSize: 12, color: C.inkSoft, margin: "10px 0 0" }}>D'après tes données, ton besoin réel est d'environ <strong>{weightStats.adaptive.tdee} kcal</strong>.</p>
        )}
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: 18, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <Flame size={16} color={C.herb} />
          <p style={{ margin: 0, fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: 15.5 }}>Calories du sport</p>
        </div>
        <p style={{ fontSize: 12, color: C.inkSoft, lineHeight: 1.5, margin: "0 0 10px" }}>
          Faut-il « remanger » les calories dépensées en plus de l'habituel (séances non prévues, journée à 15 000 pas) ?
          Les estimations de dépense sont souvent trop optimistes : les remanger en totalité est une cause fréquente de stagnation.
        </p>
        <div style={{ display: "flex", gap: 6 }}>
          {[[0, "Non (conseillé)"], [0.5, "La moitié"], [1, "En totalité"]].map(([v, l]) => (
            <button key={v} onClick={() => onSaveSportSettings({ ...sportSettings, eatBack: v })} style={{
              flex: 1, padding: "8px 4px", borderRadius: 9, border: `1px solid ${sportSettings.eatBack === v ? C.herb : C.line}`,
              background: sportSettings.eatBack === v ? C.herb : C.card, color: sportSettings.eatBack === v ? C.onAccent : C.ink, fontSize: 11.5, fontWeight: 600,
            }}>{l}</button>
          ))}
        </div>
      </div>

      <ThemeCard />

      <RemindersCard />

      <HealthConnectCard onSync={() => runHcSyncRef.current && runHcSyncRef.current("full")} />

      <BackupCard />

      <UpdateCard />

      <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: 18, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <Sparkles size={16} color={C.herb} />
          <p style={{ margin: 0, fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: 15.5 }}>Détection photo par IA (optionnel)</p>
        </div>
        <p style={{ fontSize: 12, color: C.inkSoft, lineHeight: 1.5, margin: "0 0 12px" }}>
          Sans clé, l'onglet Photo utilise une détection locale limitée (gratuite, hors-ligne). Colle
          ici une clé Gemini gratuite pour une reconnaissance bien plus précise — obtenue en 2 minutes
          sur <strong>aistudio.google.com</strong>, sans carte bancaire. Tant que tu n'actives pas la
          facturation sur ce projet Google, l'usage ne peut jamais te coûter d'argent : au-delà du
          quota gratuit, les requêtes échouent simplement, elles ne sont jamais facturées.
        </p>
        <div style={{ position: "relative", marginBottom: 10 }}>
          <input
            type={showKey ? "text" : "password"} value={info.geminiApiKey || ""} placeholder="Colle ta clé Gemini ici"
            onChange={(e) => setInfo({ ...info, geminiApiKey: e.target.value })}
            style={{ width: "100%", padding: "10px 40px 10px 12px", borderRadius: 10, border: `1px solid ${C.line}`, fontSize: 13, fontFamily: "'IBM Plex Mono',monospace" }}
          />
          <button onClick={() => setShowKey(!showKey)} style={{ position: "absolute", right: 8, top: 8, background: "none", border: "none", color: C.inkSoft, padding: 4 }}>
            {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <button onClick={saveGeminiKey} style={{
          width: "100%", padding: "11px 0", borderRadius: 10, border: "none", background: C.herb, color: C.onAccent, fontWeight: 600, fontSize: 13,
        }}>
          {keySaved ? "Clé enregistrée ✓" : "Enregistrer la clé"}
        </button>
        <button onClick={testGeminiKey} style={{
          width: "100%", padding: "10px 0", borderRadius: 10, border: `1.5px solid ${C.herb}`, background: "transparent", color: C.herb, fontWeight: 600, fontSize: 13, marginTop: 8,
        }}>{keyTest?.loading ? "Test en cours…" : "Tester la clé"}</button>
        {keyTest && !keyTest.loading && (
          <p style={{ fontSize: 12, margin: "8px 0 0", color: keyTest.ok ? C.herb : C.berry, lineHeight: 1.45 }}>{keyTest.text}</p>
        )}
        <p style={{ fontSize: 11, color: C.inkSoft, margin: "10px 0 0", lineHeight: 1.5 }}>
          Cette clé reste uniquement sur ton téléphone, dans le stockage local de l'app — elle n'est
          jamais envoyée à un serveur autre que Google (pour l'analyse photo elle-même).
        </p>
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: 18 }}>
        <p style={{ margin: "0 0 12px", fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: 15.5 }}>Mes objectifs</p>
        {field("kcal", "Objectif calories", "kcal")}
        {field("prot", "Objectif protéines", "g")}
        {field("carbs", "Objectif glucides", "g")}
        {field("fat", "Objectif lipides", "g")}
        {field("water", "Objectif hydratation", "ml")}
        <div style={{ margin: "-4px 0 14px" }}>
          <Toggle checked={local.foodWater !== false} onChange={(v) => setLocal({ ...local, foodWater: v })}
            label="Compter l'eau des aliments"
            sub="L'eau contenue dans ce que tu manges (fruits, légumes, soupes, laitages…) est estimée et ajoutée à ce que tu bois. Seule l'eau bue est envoyée à Health Connect." />
        </div>
        <button onClick={() => { onSave(local); setSaved(true); setTimeout(() => setSaved(false), 1800); }} style={{
          width: "100%", padding: "13px 0", borderRadius: 12, border: "none", background: C.herb, color: C.onAccent, fontWeight: 600, fontSize: 14, marginTop: 6,
        }}>
          {saved ? "Objectifs enregistrés ✓" : "Enregistrer"}
        </button>
      </div>
      <p style={{ fontSize: 11.5, color: C.inkSoft, marginTop: 16, lineHeight: 1.5 }}>
        NutriMaison enregistre tout localement — repas, recettes et objectifs — sans compte, sans abonnement, sans fonctionnalité verrouillée.
        <span style={{ display: "block", marginTop: 10 }}>
          <strong>Sources des données</strong> — Aliments de base : {CIQUAL_CITATION} (Licence Ouverte Etalab).
          Produits de marque et codes-barres : Open Food Facts (licence ODbL). Recettes en ligne : TheMealDB.
        </span>
        <span style={{ display: "block", marginTop: 10 }}>
          <strong>Version {APP_VERSION}</strong><br />
          <strong>Licence</strong> — NutriMaison est un logiciel libre © 2026 les auteurs de NutriMaison, distribué sous licence GNU GPL version 3,
          SANS AUCUNE GARANTIE. Vous pouvez le redistribuer et le modifier selon les termes de cette licence.
        </span>
      </p>
    </div>
  );
}

export const profileLinkBtn = {
  flex: 1, padding: "9px 10px", borderRadius: 10, border: "none", background: C.sage, color: C.herb, fontWeight: 600, fontSize: 12.5,
};

/** Rappels du soir (si rien n'est noté) et du matin (pesée). */
export function RemindersCard() {
  const [r, setR] = useState(loadReminders());
  const [msg, setMsg] = useState(null);
  const available = remindersAvailable();
  async function update(next) {
    if ((next.evening.on && !r.evening.on) || (next.morning.on && !r.morning.on)) {
      const ok = await ensureNotifPermission();
      if (!ok) { setMsg("Notifications refusées : autorise-les dans les paramètres Android de NutriMaison."); return; }
    }
    setR(next); saveReminders(next); setMsg(null);
    const res = await syncReminders();
    if (res?.error) setMsg("Erreur : " + res.error);
  }
  const row = (key, label, sub) => (
    <div style={{ marginBottom: 12 }}>
      <Toggle checked={r[key].on} onChange={(v) => update({ ...r, [key]: { ...r[key], on: v } })} label={label} sub={sub} />
      {r[key].on && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "6px 0 0 54px" }}>
          <span style={{ fontSize: 12, color: C.inkSoft }}>à</span>
          <input type="time" value={r[key].time} onChange={(e) => e.target.value && update({ ...r, [key]: { ...r[key], time: e.target.value } })}
            style={{ ...inputStyle, width: 110, padding: "6px 8px", fontSize: 13 }} />
        </div>
      )}
    </div>
  );
  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: 18, marginBottom: 16 }}>
      <p style={{ margin: "0 0 10px", fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: 15.5 }}>🔔 Rappels</p>
      {!available ? (
        <p style={{ fontSize: 12, color: C.inkSoft, margin: 0 }}>Disponible uniquement dans l'application Android.</p>
      ) : (
        <>
          {row("evening", "Le soir, si rien n'est noté", "Seulement les jours où ton journal est encore vide.")}
          {row("morning", "Le matin, pour la pesée", "Seulement si tu ne t'es pas encore pesé ce jour-là (pesée Withings comprise).")}
          <button onClick={async () => setMsg((await testReminder()) ? "Notification de test dans 5 secondes…" : "Notifications refusées.")} style={{ ...profileLinkBtn, width: "100%" }}>
            Tester une notification
          </button>
          {msg && <p style={{ fontSize: 12, color: /refus|Erreur/.test(msg) ? C.berry : C.herb, margin: "8px 0 0" }}>{msg}</p>}
          <p style={{ fontSize: 11, color: C.inkSoft, margin: "8px 0 0", lineHeight: 1.45 }}>
            Les rappels sont préparés pour 7 jours et mis à jour à chaque ouverture : ouvre l'app au moins une fois par semaine pour qu'ils continuent.
          </p>
        </>
      )}
    </div>
  );
}

/** Sauvegarde / restauration de toutes les données (utile avant de réinstaller l'APK ou de changer de téléphone). */
export function BackupCard() {
  const [mode, setMode] = useState(null);
  const [text, setText] = useState("");
  const [msg, setMsg] = useState("");
  const [auto, setAuto] = useState(loadAutoBackup);
  const [busy, setBusy] = useState(false);
  const native = autoBackupAvailable();
  const updAuto = (n) => { setAuto(n); saveAutoBackup(n); };
  function exportData() {
    const json = buildBackup();
    setText(json); setMode("export"); setMsg("");
    try { navigator.clipboard && navigator.clipboard.writeText(json).then(() => setMsg("Copié dans le presse-papiers ✓ — colle-le dans une note, un mail à toi-même ou un fichier."), () => {}); } catch (e) {}
  }
  function doRestore(t) {
    try {
      restoreBackup(t);
      setMsg("Données restaurées ✓ — l'app va redémarrer.");
      setTimeout(() => window.location.reload(), 900);
    } catch (e) { setMsg(e?.message && !/JSON/.test(e.message) ? e.message : "Sauvegarde illisible."); }
  }
  async function saveNow() {
    setBusy(true); setMsg("");
    try {
      const file = await writeBackupFile();
      updAuto({ ...loadAutoBackup(), last: new Date().toISOString(), lastFile: file, lastError: null });
      setMsg("Sauvegardé ✓ " + file);
    } catch (e) {
      updAuto({ ...loadAutoBackup(), lastError: String(e?.message || e) });
      setMsg("Échec : " + (e?.message || e));
    }
    setBusy(false);
  }
  const lastTxt = auto.last ? new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(auto.last)) : null;
  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: 18, marginBottom: 16 }}>
      <p style={{ margin: "0 0 6px", fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: 15.5 }}>Sauvegarde des données</p>
      <p style={{ fontSize: 12, color: C.inkSoft, lineHeight: 1.5, margin: "0 0 10px" }}>
        Tout est stocké sur ce téléphone. {native ? "Une copie automatique est rangée dans le dossier Documents/NutriMaison : elle reste même si l'app est désinstallée." : "Fais une sauvegarde avant de réinstaller l'app ou de changer d'appareil."}
      </p>
      {native && (
        <div style={{ background: C.paperDark, borderRadius: 12, padding: "10px 12px", marginBottom: 10 }}>
          <Toggle checked={auto.on} onChange={(v) => updAuto({ ...auto, on: v })} label="Copie automatique"
            sub="Au démarrage de l'app, les 4 dernières sont gardées." />
          {auto.on && (
            <div style={{ display: "flex", gap: 6, margin: "8px 0 4px" }}>
              {[[1, "Chaque jour"], [7, "Chaque semaine"]].map(([d, l]) => (
                <button key={d} onClick={() => updAuto({ ...auto, everyDays: d })} style={{
                  flex: 1, padding: "7px 0", borderRadius: 9, fontSize: 12, fontWeight: 600, border: `1px solid ${auto.everyDays === d ? C.herb : C.line}`,
                  background: auto.everyDays === d ? C.herb : C.card, color: auto.everyDays === d ? C.onAccent : C.ink,
                }}>{l}</button>
              ))}
            </div>
          )}
          <p style={{ fontSize: 11, color: auto.lastError ? C.berry : C.inkSoft, margin: "6px 0 0", lineHeight: 1.45 }}>
            {auto.lastError ? `Dernier essai raté : ${auto.lastError}` : lastTxt ? `Dernière copie : ${lastTxt} — ${auto.lastFile}` : "Aucune copie pour l'instant."}
          </p>
          <button onClick={saveNow} disabled={busy} style={{ ...profileLinkBtn, width: "100%", marginTop: 8, background: C.card, border: `1px solid ${C.herb}` }}>
            {busy ? "Sauvegarde…" : "Sauvegarder maintenant"}
          </button>
        </div>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={exportData} style={profileLinkBtn}><Download size={14} style={{ verticalAlign: -2 }} /> Exporter</button>
        <button onClick={() => { setMode(mode === "import" ? null : "import"); setText(""); setMsg(""); }} style={profileLinkBtn}><Upload size={14} style={{ verticalAlign: -2 }} /> Restaurer</button>
      </div>
      {mode === "import" && (
        <div style={{ marginTop: 10 }}>
          <label style={{ ...profileLinkBtn, display: "block", textAlign: "center", background: C.herb, color: C.onAccent, cursor: "pointer" }}>
            Choisir un fichier de sauvegarde (.json)
            <input type="file" accept="application/json,.json,text/plain" style={{ display: "none" }}
              onChange={async (e) => { const f = e.target.files[0]; e.target.value = ""; if (f) doRestore(await f.text()); }} />
          </label>
          <p style={{ fontSize: 11, color: C.inkSoft, margin: "6px 0" }}>{native ? "Les copies automatiques sont dans Documents › NutriMaison. " : ""}Ou colle le texte d'une sauvegarde :</p>
        </div>
      )}
      {mode && (
        <div style={{ marginTop: mode === "export" ? 10 : 0 }}>
          <textarea value={text} onChange={(e) => setText(e.target.value)} readOnly={mode === "export"} rows={mode === "export" ? 5 : 3}
            placeholder="Colle ici le texte de sauvegarde"
            onFocus={(e) => mode === "export" && e.target.select()}
            style={{ ...inputStyle, fontSize: 11, resize: "vertical" }} />
          {mode === "import" && (
            <button onClick={() => doRestore(text)} disabled={!text.trim()} style={{ ...profileLinkBtn, width: "100%", marginTop: 8, background: C.herb, color: C.onAccent, opacity: text.trim() ? 1 : 0.5 }}>Restaurer ce texte</button>
          )}
        </div>
      )}
      {msg && <p style={{ fontSize: 12, color: /Échec|illisible|n'est pas/.test(msg) ? C.berry : C.herb, margin: "8px 0 0", wordBreak: "break-word" }}>{msg}</p>}
    </div>
  );
}

/** Apparence : clair, sombre, ou comme Android. */
export function ThemeCard() {
  const [pref, setPref] = useState(loadThemePref);
  const opts = [["auto", "Comme le téléphone"], ["light", "Clair"], ["dark", "Sombre"]];
  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: 18, marginBottom: 16 }}>
      <p style={{ margin: "0 0 10px", fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: 15.5 }}>Apparence</p>
      <div style={{ display: "flex", gap: 6 }}>
        {opts.map(([v, l]) => (
          <button key={v} onClick={() => { applyTheme(v); setPref(v); }} style={{
            flex: 1, padding: "9px 4px", borderRadius: 10, fontSize: 12, fontWeight: 600, border: `1px solid ${pref === v ? C.herb : C.line}`,
            background: pref === v ? C.herb : C.card, color: pref === v ? C.onAccent : C.ink,
          }}>{l}</button>
        ))}
      </div>
    </div>
  );
}

/** Version installée et vérification des nouvelles versions sur GitHub. */
export function UpdateCard() {
  const [st, setSt] = useState(loadUpdateState);
  const [res, setRes] = useState(null); // {busy} | {latest} | {upToDate} | {error}
  async function check() {
    setRes({ busy: true });
    try {
      const latest = await checkForUpdate(APP_VERSION, { force: true });
      setSt(loadUpdateState());
      setRes(latest ? { latest } : { upToDate: true, v: loadUpdateState().latest?.version });
    } catch (e) { setRes({ error: e?.message || "erreur" }); }
  }
  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: 18, marginBottom: 16 }}>
      <p style={{ margin: "0 0 6px", fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: 15.5 }}>Mises à jour</p>
      <p style={{ fontSize: 12, color: C.inkSoft, lineHeight: 1.5, margin: "0 0 8px" }}>
        Version installée : <b style={{ color: C.ink }}>{APP_VERSION}</b>. Les nouvelles versions sont publiées sur GitHub.
      </p>
      <Toggle checked={st.on} onChange={(v) => { const n = { ...loadUpdateState(), on: v }; saveUpdateState(n); setSt(n); }}
        label="Me prévenir des nouvelles versions" sub="Vérifie une fois par jour (lecture de la page publique du projet, rien n'est envoyé)." />
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button onClick={check} disabled={res?.busy} style={profileLinkBtn}>{res?.busy ? "Vérification…" : "Vérifier maintenant"}</button>
        <button onClick={() => openExternal(REPO_URL + "/releases")} style={profileLinkBtn}>Toutes les versions</button>
      </div>
      {res?.upToDate && <p style={{ fontSize: 12, color: C.herb, margin: "8px 0 0" }}>✓ Tu as la dernière version{res.v ? ` (dernière publiée : ${res.v})` : ""}.</p>}
      {res?.error && <p style={{ fontSize: 12, color: C.berry, margin: "8px 0 0" }}>Vérification impossible : {res.error}</p>}
      {res?.latest && (
        <div style={{ marginTop: 10, background: C.ochreLight, borderRadius: 12, padding: 10 }}>
          <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 600 }}>Version {res.latest.version} disponible</p>
          {res.latest.notes && <p style={{ margin: "0 0 8px", fontSize: 11.5, color: C.inkSoft, whiteSpace: "pre-wrap", maxHeight: 140, overflow: "auto" }}>{res.latest.notes}</p>}
          <button onClick={() => openExternal(res.latest.apkUrl || res.latest.url)} style={{ ...profileLinkBtn, width: "100%", background: C.herb, color: C.onAccent }}>
            {res.latest.apkUrl ? "Télécharger l'APK" : "Ouvrir la page de la version"}
          </button>
        </div>
      )}
    </div>
  );
}
