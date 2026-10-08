// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Les auteurs de NutriMaison
import React, { useState, useMemo } from "react";
import { Play, Check, RefreshCw, Sparkles, Pencil, Loader2, Clock } from "lucide-react";
import { C, MONO, SERIF, Card, Btn, Chip, BackHeader, inputStyle, uid, bmi } from "./shared.jsx";
import { GROUPS, EQUIPMENT } from "./sportData.js";
import { Label, Toggle, resolveExercise, hasEquip, estimateSessionSeconds } from "./Sport.jsx";
import { geminiGenerate, parseJSONLoose } from "./gemini.js";

/* ================================================================== */
/* SÉANCE SUR MESURE (hors-ligne)                                      */
/* ================================================================== */
const GOALS = {
  bruler: { label: "Brûler des calories", sub: "circuit cardio + renfo" },
  renfo: { label: "Renforcement", sub: "séries et répétitions" },
  boxe: { label: "Boxe", sub: "rounds de shadow / sac" },
  abdos: { label: "Abdos & gainage", sub: "sangle abdominale" },
  mobilite: { label: "Mobilité / étirements", sub: "souplesse, récupération" },
};
const ZONES = {
  full: { label: "Tout le corps", groups: ["jambes", "fessiers", "pecs", "dos", "epaules", "bras", "abdos"] },
  haut: { label: "Haut du corps", groups: ["pecs", "dos", "epaules", "bras"] },
  bas: { label: "Bas du corps", groups: ["jambes", "fessiers"] },
};
const INTENS = {
  douce: { label: "Douce", work: 30, rest: 30, sets: 2, restSets: 75, round: 60, roundRest: 45 },
  normale: { label: "Normale", work: 40, rest: 20, sets: 3, restSets: 60, round: 120, roundRest: 45 },
  intense: { label: "Intense", work: 45, rest: 15, sets: 4, restSets: 45, round: 180, roundRest: 60 },
};
const WARMUPS = ["marche_place", "step_touch", "cercles_bras", "pas_chasses", "marche_genoux", "box_garde"];
const COOLDOWNS = ["etir_ischios", "etir_psoas", "etir_pecs", "enfant", "respiration", "chien_bas"];

function rng(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function shuffle(arr, rand) { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

/** Exercices utilisables par l'utilisateur : son matériel, son niveau dans chaque chaîne, faible impact. */
function userPool(s, idx) {
  const seen = new Set();
  const out = [];
  idx.all.forEach((e) => {
    const r = resolveExercise(e.id, s, idx);
    if (!r || seen.has(r.id)) return;
    if (!hasEquip(s, r.equip)) return;
    if (s.lowImpact && r.impact === "fort") return;
    seen.add(r.id);
    out.push(r);
  });
  return out;
}

export function generateSession({ minutes, goal, zone, intensity }, s, idx, seed) {
  const rand = rng(seed);
  const I = INTENS[intensity];
  const pool = userPool(s, idx);
  const byIds = (ids) => ids.map((id) => resolveExercise(id, s, idx)).filter((e) => e && pool.some((p) => p.id === e.id));
  const total = minutes * 60;
  const items = [];
  const used = new Set();
  const push = (ex, it) => { used.add(ex.id); items.push({ ex: ex.id, ...it }); };
  const est = () => estimateSessionSeconds(items, idx);

  const doWarm = goal !== "mobilite";
  const warmSec = doWarm ? (minutes >= 15 ? 180 : 60) : 0;
  const coolSec = goal === "mobilite" ? 0 : minutes >= 20 ? 120 : minutes >= 15 ? 60 : 0;

  if (doWarm) {
    const w = shuffle(byIds(WARMUPS.filter((id) => goal === "boxe" || id !== "box_garde")), rand);
    if (w[0]) push(w[0], { sets: 1, sec: warmSec >= 120 ? Math.round(warmSec / 2) : warmSec, rest: 10 });
    if (w[1] && warmSec >= 120) push(w[1], { sets: 1, sec: Math.round(warmSec / 2), rest: 15 });
  }
  const budget = total - coolSec;

  // Sélection pondérée : le matériel que l'utilisateur possède passe avant le poids du corps
  const pick = (cands, n) => {
    const scored = shuffle(cands.filter((e) => !used.has(e.id)), rand)
      .map((e) => ({ e, w: (e.equip || []).some((q) => q !== "aucun") ? 2 + rand() : 1 + rand() }))
      .sort((a, b) => b.w - a.w);
    return scored.slice(0, n).map((x) => x.e);
  };

  if (goal === "bruler") {
    const groups = [...ZONES[zone].groups, "cardio", "cardio", "boxe"];
    const chosen = [];
    shuffle(groups, rand).forEach((g) => {
      const c = pick(pool.filter((e) => e.group === g && !chosen.includes(e)), 1)[0];
      if (c && chosen.length < 7) { chosen.push(c); used.add(c.id); }
    });
    const per = I.work + I.rest;
    const left = budget - est();
    const n = Math.max(3, Math.min(chosen.length, Math.round(left / (per * 3 + 30))));
    const list = chosen.slice(0, n);
    const rounds = Math.max(1, Math.floor(left / (list.length * per + 30)));
    list.forEach((e) => items.push({ ex: e.id, sets: rounds, sec: I.work, rest: I.rest, timed: e.kind !== "time" }));
  } else if (goal === "renfo") {
    const groups = ZONES[zone].groups;
    let gi = 0, guard = 0;
    const order = shuffle(groups, rand);
    while (est() < budget - 90 && guard++ < 40) {
      const g = order[gi++ % order.length];
      const c = pick(pool.filter((e) => e.group === g && e.group !== "cardio"), 1)[0];
      if (!c) continue;
      const it = c.kind === "time"
        ? { sets: I.sets, sec: intensity === "douce" ? 25 : intensity === "normale" ? 35 : 45, rest: Math.round(I.restSets * 0.7) }
        : { sets: I.sets, reps: c.weighted ? (intensity === "intense" ? 8 : 10) : intensity === "douce" ? 10 : intensity === "normale" ? 12 : 15, rest: I.restSets };
      const trial = [...items, { ex: c.id, ...it }];
      if (estimateSessionSeconds(trial, idx) > budget + 60) { used.add(c.id); if (items.length > 3) break; continue; }
      push(c, it);
    }
  } else if (goal === "boxe") {
    const boxing = pool.filter((e) => e.group === "boxe" && e.kind === "time" && e.id !== "box_garde");
    const physical = pool.filter((e) => ["sprawl", "sprawl_lent", "russian_twist", "gainage", "planche_updown", "pompes_genoux", "squat", "mountain", "corde"].includes(e.id) || (s.variants?.pompes && e.id === s.variants.pompes));
    let r = 0, guard = 0;
    const orderBox = shuffle(boxing, rand);
    const roundSec = Math.min(I.round, Math.max(45, Math.round((budget - est()) / 5 / 15) * 15));
    while (est() + roundSec + I.roundRest + 15 <= budget && guard++ < 30) {
      const b = orderBox[r % orderBox.length];
      items.push({ ex: b.id, sets: 1, sec: roundSec, rest: I.roundRest });
      r++;
      if (r % 3 === 0 && physical.length && est() + 120 <= budget) {
        const p = physical[Math.floor(rand() * physical.length)];
        items.push(p.kind === "time" ? { ex: p.id, sets: 2, sec: 30, rest: 20 } : { ex: p.id, sets: 2, reps: 10, rest: 20 });
      }
    }
  } else if (goal === "abdos") {
    const abs = shuffle(pool.filter((e) => e.group === "abdos"), rand);
    let k = 0, guard = 0;
    while (est() < budget - 60 && guard++ < 30 && abs.length) {
      const a = abs[k++ % abs.length];
      items.push(a.kind === "time" ? { ex: a.id, sets: Math.min(3, I.sets), sec: Math.round(I.work * 0.8), rest: 25 } : { ex: a.id, sets: Math.min(3, I.sets), reps: 12, rest: 25 });
    }
  } else if (goal === "mobilite") {
    const mob = shuffle(pool.filter((e) => e.group === "mobilite"), rand);
    const first = mob.find((e) => e.id === "respiration");
    const ordered = [first, ...mob.filter((e) => e !== first && e.id !== "enfant"), mob.find((e) => e.id === "enfant")].filter(Boolean);
    // chaque posture une fois, tenue plus longtemps si on a plus de temps
    const hold = Math.min(150, Math.max(intensity === "douce" ? 50 : 40, Math.round((budget / Math.max(1, ordered.length) - 40) / 5) * 5));
    let k = 0, guard = 0;
    while (est() < budget - 45 && guard++ < 40 && ordered.length) {
      const m = ordered[k++ % ordered.length];
      items.push(m.kind === "time" ? { ex: m.id, sets: 1, sec: hold, rest: 10 } : { ex: m.id, sets: 1, reps: 10, rest: 10 });
    }
  }

  if (coolSec > 0) {
    const c = shuffle(byIds(COOLDOWNS), rand).slice(0, Math.max(1, Math.round(coolSec / 45)));
    c.forEach((e) => items.push({ ex: e.id, sets: 1, sec: 40, rest: 5 }));
  }
  return { id: "gen_" + uid(), name: `Sur mesure — ${minutes} min ${GOALS[goal].label.toLowerCase()}`, items };
}

export function SessionGenerator({ s, idx, onBack, onStart, onSave, onEdit, onUpdateSettings }) {
  const [minutes, setMinutes] = useState(s.genPrefs?.minutes || 20);
  const [goal, setGoal] = useState(s.genPrefs?.goal || "bruler");
  const [zone, setZone] = useState(s.genPrefs?.zone || "full");
  const [intensity, setIntensity] = useState(s.genPrefs?.intensity || "normale");
  const [seed, setSeed] = useState(() => Date.now() % 100000);
  const [saved, setSaved] = useState(false);
  const session = useMemo(() => generateSession({ minutes, goal, zone, intensity }, s, idx, seed), [minutes, goal, zone, intensity, seed, s, idx]);

  function remember() { onUpdateSettings({ genPrefs: { minutes, goal, zone, intensity } }); }

  return (
    <div>
      <BackHeader title="Séance sur mesure" onBack={onBack} />
      <Card>
        <Label>Temps disponible</Label>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
          {[10, 15, 20, 30, 45, 60].map((m) => <Chip key={m} active={minutes === m} onClick={() => { setMinutes(m); setSaved(false); }}>{m} min</Chip>)}
        </div>
        <Label style={{ marginTop: 10 }}>Objectif</Label>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {Object.entries(GOALS).map(([k, g]) => <Chip key={k} active={goal === k} onClick={() => { setGoal(k); setSaved(false); }}>{g.label}</Chip>)}
        </div>
        {(goal === "bruler" || goal === "renfo") && (
          <>
            <Label style={{ marginTop: 12 }}>Zone</Label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {Object.entries(ZONES).map(([k, z]) => <Chip key={k} active={zone === k} onClick={() => { setZone(k); setSaved(false); }}>{z.label}</Chip>)}
            </div>
          </>
        )}
        <Label style={{ marginTop: 12 }}>Intensité</Label>
        <div style={{ display: "flex", gap: 6 }}>
          {Object.entries(INTENS).map(([k, v]) => <Chip key={k} active={intensity === k} onClick={() => { setIntensity(k); setSaved(false); }} style={{ flex: 1 }}>{v.label}</Chip>)}
        </div>
        <p style={hint}>
          Utilise ton matériel ({["aucun", ...(s.equip || [])].filter((e, i, a) => a.indexOf(e) === i).map((e) => EQUIPMENT[e]).join(", ")}), ton niveau sur chaque mouvement{s.lowImpact ? " et le mode faible impact" : ""}.
        </p>
      </Card>

      <SessionPreview session={session} idx={idx} s={s} />

      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <Btn onClick={() => { remember(); onStart(session); }} style={{ flex: 1 }}><Play size={15} /> Démarrer</Btn>
        <Btn kind="ghost" onClick={() => { setSeed(seed + 1); setSaved(false); }}><RefreshCw size={15} /> Autre</Btn>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <Btn kind="soft" disabled={saved} onClick={() => { remember(); onSave({ ...session, id: "seance_" + uid() }); setSaved(true); }} style={{ flex: 1 }}>
          {saved ? "Enregistrée ✓" : <><Check size={15} /> Garder dans mes séances</>}
        </Btn>
        <Btn kind="soft" onClick={() => onEdit({ ...session, id: "seance_" + uid() })}><Pencil size={15} /></Btn>
      </div>
    </div>
  );
}

export function SessionPreview({ session, idx, s, notes }) {
  const total = Math.round(estimateSessionSeconds(session.items, idx) / 60);
  return (
    <Card style={{ padding: 14 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 8 }}>
        <span style={{ flex: 1, fontFamily: SERIF, fontWeight: 600, fontSize: 16 }}>{session.name}</span>
        <span style={{ fontFamily: MONO, fontSize: 12, color: C.inkSoft, display: "inline-flex", alignItems: "center", gap: 4 }}><Clock size={12} />≈ {total} min</span>
      </div>
      {notes && <p style={{ fontSize: 12.5, color: C.herbLight, background: C.sage, borderRadius: 10, padding: 10, margin: "0 0 10px", lineHeight: 1.5 }}>{notes}</p>}
      {session.items.map((it, k) => {
        const ex = resolveExercise(it.ex, s, idx) || idx.byId[it.ex];
        if (!ex) return null;
        const timed = ex.kind === "time" || it.timed;
        return (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "5px 0", borderTop: k ? `1px dashed ${C.line}` : "none", gap: 8 }}>
            <span>{ex.name}{ex.custom ? <span style={{ color: C.ochre, fontSize: 11 }}> · perso</span> : null}</span>
            <span style={{ fontFamily: MONO, color: C.inkSoft, fontSize: 12, whiteSpace: "nowrap" }}>
              {it.sets}×{timed ? (it.sec >= 60 ? `${Math.floor(it.sec / 60)}:${String(it.sec % 60).padStart(2, "0")}` : `${it.sec}s`) : `${it.reps}${ex.perSide ? "/côté" : ""}`}
              {it.rest ? ` · ${it.rest}s` : ""}
            </span>
          </div>
        );
      })}
    </Card>
  );
}

/* ================================================================== */
/* COACH IA (Gemini, avec la clé de l'utilisateur)                     */
/* ================================================================== */
const COACH_EXAMPLES = [
  "30 min de boxe sans matériel, je veux transpirer",
  "15 min le matin avant le travail",
  "45 min en salle, haut du corps, j'ai du mal avec les pompes",
  "Séance douce, j'ai un peu mal au genou droit",
  "20 min de cardio sans sauts pour ne pas déranger les voisins",
];

export function AICoach({ s, idx, personalInfo, onBack, onStart, onSave, onEdit, onUpdateSettings }) {
  const apiKey = (personalInfo.geminiApiKey || "").trim();
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null); // { session, notes, newExercises }
  const [saved, setSaved] = useState(false);

  async function ask() {
    setBusy(true); setError(null); setStatus(null); setResult(null); setSaved(false);
    try {
      const pool = userPool(s, idx);
      const list = pool.map((e) => `${e.id}|${e.name}|${e.group}|${e.kind === "time" ? "durée" : "reps"}${e.perSide ? "|par côté" : ""}`).join("\n");
      const imc = bmi(personalInfo.poids, personalInfo.taille);
      const profile = [
        `${personalInfo.sexe}, ${personalInfo.age} ans, ${personalInfo.taille} cm, ${personalInfo.poids} kg (IMC ${imc.toFixed(1)})`,
        `niveau : ${s.level === "debutant" ? "débutant / reprise" : "intermédiaire"}`,
        `matériel : ${["aucun", ...(s.equip || [])].map((e) => EQUIPMENT[e]).join(", ")}`,
        s.lowImpact ? "mode faible impact : AUCUN saut" : "",
        `marche environ ${s.habitualSteps || 0} pas par jour`,
        `objectif : ${personalInfo.objectif === "perte" ? "perte de poids" : personalInfo.objectif === "prise" ? "prise de masse" : "maintien"}`,
      ].filter(Boolean).join(" ; ");
      const text = await geminiGenerate(apiKey, [{ text:
`Tu es un coach sportif diplômé et prudent. Crée UNE séance d'entraînement à faire maintenant, en français.

Profil : ${profile}.
Demande de la personne : « ${prompt.trim()} »

Règles :
- Respecte la durée demandée (sinon 30 min), échauffement et retour au calme compris.
- Utilise EN PRIORITÉ les exercices de la liste ci-dessous, par leur id exact (ils sont déjà adaptés à son matériel et à son niveau).
- Si un exercice vraiment nécessaire manque, invente-le dans "nouveaux" (id commençant par "new_").
- Exercices "durée" : donne "secondes". Exercices "reps" : donne "reps" (tu peux aussi donner "secondes" pour les faire au chrono).
- Si une douleur est mentionnée, évite tout ce qui la sollicite et rappelle dans "conseils" de consulter si elle persiste.
- Réponds UNIQUEMENT en JSON :
{"nom":"...","conseils":"2 à 3 phrases utiles","items":[{"id":"...","series":3,"reps":10,"repos":60}],"nouveaux":[{"id":"new_1","nom":"...","groupe":"${Object.keys(GROUPS).join("|")}","type":"reps|durée","met":5,"consignes":"..."}]}

Exercices disponibles (id|nom|groupe|type) :
${list}` }], { onStatus: setStatus, temperature: 0.6 });
      const data = parseJSONLoose(text);
      if (!data || !Array.isArray(data.items)) throw new Error("réponse inattendue de l'IA, réessaie");

      const newEx = {};
      (data.nouveaux || []).forEach((n) => {
        if (!n || !n.nom) return;
        newEx[n.id] = {
          id: "perso_ia_" + uid(), name: String(n.nom).slice(0, 60), custom: true, ai: true,
          group: GROUPS[n.groupe] ? n.groupe : "cardio", kind: /dur|time|sec/i.test(n.type || "") ? "time" : "reps",
          met: Math.min(12, Math.max(2, Number(n.met) || 4)), equip: ["aucun"], cue: String(n.consignes || "").slice(0, 500),
        };
      });
      const clamp = (v, a, b, d) => { const n = Math.round(Number(v)); return isFinite(n) && n > 0 ? Math.min(b, Math.max(a, n)) : d; };
      const items = data.items.map((it) => {
        const ex = idx.byId[it.id] || newEx[it.id];
        if (!ex) return null;
        const exId = ex.id;
        const sec = it.secondes ?? it.sec;
        const timed = ex.kind === "time" || sec != null;
        return timed
          ? { ex: exId, sets: clamp(it.series ?? it.sets, 1, 12, 2), sec: clamp(sec, 10, 900, 40), rest: clamp(it.repos ?? it.rest, 0, 300, 30), ...(ex.kind !== "time" ? { timed: true } : {}) }
          : { ex: exId, sets: clamp(it.series ?? it.sets, 1, 12, 3), reps: clamp(it.reps, 1, 100, 10), rest: clamp(it.repos ?? it.rest, 0, 300, 60) };
      }).filter(Boolean);
      if (!items.length) throw new Error("l'IA n'a proposé aucun exercice reconnu, reformule ta demande");
      setResult({
        session: { id: "ia_" + uid(), name: String(data.nom || "Séance du coach").slice(0, 60), items },
        notes: data.conseils ? String(data.conseils).slice(0, 600) : null,
        newExercises: Object.values(newEx),
      });
    } catch (e) {
      setError(e.message || "erreur");
    }
    setBusy(false); setStatus(null);
  }

  // l'index doit connaître les nouveaux exercices pour l'aperçu
  const previewIdx = useMemo(() => {
    if (!result?.newExercises?.length) return idx;
    const byId = { ...idx.byId };
    result.newExercises.forEach((e) => { byId[e.id] = e; });
    return { ...idx, byId, all: [...idx.all, ...result.newExercises] };
  }, [idx, result]);

  function withNewExercises(extra = {}) {
    const add = (result?.newExercises || []).filter((e) => !(s.customExercises || []).some((x) => x.id === e.id));
    onUpdateSettings({ customExercises: [...(s.customExercises || []), ...add], ...extra });
  }

  if (!apiKey) {
    return (
      <div>
        <BackHeader title="Coach IA" onBack={onBack} />
        <Card>
          <p style={{ margin: "0 0 8px", fontWeight: 600 }}>Clé Gemini nécessaire</p>
          <p style={{ margin: 0, fontSize: 13, color: C.inkSoft, lineHeight: 1.55 }}>
            Le coach utilise ta clé Gemini gratuite (la même que pour la photo des repas). Ajoute-la dans Profil → Détection photo par IA. En attendant, la <strong>Séance sur mesure</strong> fonctionne sans clé et hors-ligne.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <BackHeader title="Coach IA" onBack={onBack} />
      <Card>
        <Label>Décris la séance que tu veux</Label>
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} placeholder="ex. 30 min de boxe, pas de sauts, j'ai mal à l'épaule gauche"
          style={{ ...inputStyle, fontFamily: "'Work Sans',sans-serif", fontSize: 13.5, resize: "vertical" }} />
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
          {COACH_EXAMPLES.map((ex) => (
            <button key={ex} onClick={() => setPrompt(ex)} style={{ background: C.paperDark, border: "none", borderRadius: 999, padding: "5px 10px", fontSize: 11.5, color: C.ink }}>{ex}</button>
          ))}
        </div>
        <Btn onClick={ask} disabled={busy || prompt.trim().length < 4} style={{ width: "100%", marginTop: 12 }}>
          {busy ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> Le coach réfléchit…</> : <><Sparkles size={15} /> Créer ma séance</>}
        </Btn>
        <style>{"@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}"}</style>
        {status && <p style={{ ...hint, color: C.ochre }}>{status}</p>}
        {error && <p style={{ ...hint, color: C.berry }}>Coach IA : {error}</p>}
        <p style={hint}>Le coach connaît ton profil, ton matériel et ton niveau. Il propose ; tu restes juge : arrête un exercice qui fait mal.</p>
      </Card>

      {result && (
        <>
          <SessionPreview session={result.session} idx={previewIdx} s={s} notes={result.notes} />
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <Btn onClick={() => { withNewExercises(); onStart(result.session); }} style={{ flex: 1 }}><Play size={15} /> Démarrer</Btn>
            <Btn kind="ghost" onClick={ask} disabled={busy}><RefreshCw size={15} /> Autre</Btn>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn kind="soft" disabled={saved} style={{ flex: 1 }} onClick={() => {
              const sess = { ...result.session, id: "seance_" + uid() };
              const add = (result.newExercises || []).filter((e) => !(s.customExercises || []).some((x) => x.id === e.id));
              onSave(sess, add); setSaved(true);
            }}>{saved ? "Enregistrée ✓" : <><Check size={15} /> Garder dans mes séances</>}</Btn>
            <Btn kind="soft" onClick={() => { withNewExercises(); onEdit({ ...result.session, id: "seance_" + uid() }); }}><Pencil size={15} /></Btn>
          </div>
        </>
      )}
    </div>
  );
}

const hint = { fontSize: 11.5, color: C.inkSoft, lineHeight: 1.5, margin: "8px 0 0" };
