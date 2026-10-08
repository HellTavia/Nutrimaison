// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Les auteurs de NutriMaison
import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Dumbbell, Play, Pause, SkipForward, Check, Plus, Minus, Trash2, Timer, History, Settings, BookOpen,
  ChevronRight, ArrowDown, ArrowUp, Flame, Footprints, Search, X, Pencil, Trophy, Sparkles, Activity,
} from "lucide-react";
import {
  C, MONO, SERIF, Card, Btn, Chip, Tag, SectionTitle, BackHeader, inputStyle,
  todayISO, frDate, frShort, weekStart, addDays, uid, round, fmtDuration, netKcal, bmi, NumInput,
} from "./shared.jsx";
import {
  EXERCISES, PROGRAMS, ACTIVITIES, INTENSITY, EQUIPMENT, GROUPS, CHAIN_NAMES, STEP_MET,
} from "./sportData.js";
import { SessionGenerator, AICoach } from "./SportGen.jsx";

/* ================================================================== */
/* RÉGLAGES PAR DÉFAUT                                                 */
/* ================================================================== */
export const SPORT_DEFAULTS = {
  configured: false,
  equip: ["aucun"],
  level: "debutant",
  perWeek: 3,
  lowImpact: false,
  eatBack: 0,              // part des calories d'entraînement rajoutée à l'objectif : 0, 0.5 ou 1
  habitualSteps: 10000,    // pas habituels par jour (servent au calcul du besoin)
  activeProgram: null,
  cardioProgram: null,
  programPos: {},          // programId -> index de la prochaine séance
  runWeek: {},             // programId -> index de semaine
  variants: {},            // chaîne -> id de l'exercice choisi (ex. pompes -> pompes_genoux)
  repsBonus: {},           // exId -> répétitions/secondes ajoutées par la progression
  customExercises: [],
  customSessions: [],
};

/* ================================================================== */
/* OUTILS                                                              */
/* ================================================================== */
function useExerciseIndex(settings) {
  return useMemo(() => {
    const all = [...EXERCISES, ...(settings.customExercises || [])];
    const byId = Object.fromEntries(all.map((e) => [e.id, e]));
    const chains = {};
    EXERCISES.forEach((e) => { if (e.chain) (chains[e.chain] = chains[e.chain] || []).push(e); });
    Object.values(chains).forEach((l) => l.sort((a, b) => a.lvl - b.lvl));
    return { all, byId, chains };
  }, [settings.customExercises]);
}

/** Exercice réellement fait pour un exercice de programme : variante choisie + mode faible impact. */
export function resolveExercise(exId, settings, idx) {
  let ex = idx.byId[exId];
  if (!ex) return null;
  if (ex.chain && settings.variants?.[ex.chain] && idx.byId[settings.variants[ex.chain]]) ex = idx.byId[settings.variants[ex.chain]];
  if (settings.lowImpact && ex.impact === "fort" && ex.lowImpactAlt && idx.byId[ex.lowImpactAlt]) ex = idx.byId[ex.lowImpactAlt];
  return ex;
}

export function hasEquip(settings, needed) {
  const have = new Set(["aucun", ...(settings.equip || [])]);
  return (needed || []).every((n) => have.has(n));
}

function allPrograms(settings) {
  const custom = (settings.customSessions || []).map((s) => ({
    id: s.id, name: s.name, type: "force", level: "perso", equip: [], perWeek: null, minutes: null, custom: true,
    desc: "Séance personnalisée", sessions: [{ name: s.name, items: s.items }],
  }));
  return [...custom, ...PROGRAMS];
}

function lastSetsFor(workouts, exId) {
  for (let i = workouts.length - 1; i >= 0; i--) {
    const w = workouts[i];
    const e = (w.exercises || []).find((x) => x.exId === exId);
    if (e && e.sets.length) return { date: w.date, sets: e.sets };
  }
  return null;
}

function beep(freq = 880, ms = 160) {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    window.__nmAudio = window.__nmAudio || new Ctx();
    const ctx = window.__nmAudio;
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.frequency.value = freq; o.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(0.25, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + ms / 1000);
    o.start(); o.stop(ctx.currentTime + ms / 1000);
  } catch (e) {}
}
function buzz(pattern = 200) { try { navigator.vibrate && navigator.vibrate(pattern); } catch (e) {} }
function signal(kind) {
  if (kind === "end") { beep(660, 180); setTimeout(() => beep(990, 260), 220); buzz([200, 100, 300]); }
  else if (kind === "tick") { beep(520, 90); }
  else { beep(880, 200); buzz(250); }
}

/** Garde l'écran allumé pendant une séance (si l'appareil le permet). */
function useWakeLock(active) {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    let lock = null; let cancelled = false;
    const req = async () => { try { lock = await navigator.wakeLock.request("screen"); } catch (e) {} };
    req();
    const onVis = () => { if (document.visibilityState === "visible" && !cancelled) req(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { cancelled = true; document.removeEventListener("visibilitychange", onVis); try { lock && lock.release(); } catch (e) {} };
  }, [active]);
}

/** Compte à rebours basé sur l'horloge (reste juste même si l'app passe en arrière-plan). */
function useCountdown(endAt, paused, onEnd) {
  const [now, setNow] = useState(Date.now());
  const endedRef = useRef(false);
  useEffect(() => { endedRef.current = false; }, [endAt]);
  useEffect(() => {
    if (!endAt || paused) return;
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, [endAt, paused]);
  const remaining = endAt ? Math.max(0, (endAt - now) / 1000) : 0;
  useEffect(() => {
    if (endAt && !paused && remaining <= 0 && !endedRef.current) { endedRef.current = true; onEnd && onEnd(); }
  }, [remaining, endAt, paused]);
  return remaining;
}

export function workoutsKcalOn(workouts, date) {
  return (workouts || []).filter((w) => w.date === date).reduce((s, w) => s + (w.kcal || 0), 0);
}

/** Estimation de la dépense sportive hebdomadaire prévue (pour le calcul du besoin). */
export function plannedWeeklySportKcal(settings, kg) {
  const prog = PROGRAMS.find((p) => p.id === settings.activeProgram);
  const cardio = PROGRAMS.find((p) => p.id === settings.cardioProgram);
  let total = 0;
  if (prog && prog.type === "force") total += netKcal(prog.met || 4, kg, prog.minutes || 40) * (settings.perWeek || prog.perWeek || 3);
  if (cardio) total += netKcal(cardio.id === "marche_course" ? 6.5 : 4.5, kg, cardio.minutes || 30) * (cardio.perWeek || 3);
  return total;
}

/* ================================================================== */
/* VUE PRINCIPALE                                                      */
/* ================================================================== */
export function SportView({ personalInfo, workouts, onSaveWorkouts, settings, onSaveSettings, startScreen }) {
  const s = { ...SPORT_DEFAULTS, ...settings };
  const idx = useExerciseIndex(s);
  const kg = personalInfo.poids || 70;
  const [screen, setScreen] = useState(startScreen || (s.configured ? "home" : "setup"));
  const [ctx, setCtx] = useState({});           // données de l'écran courant
  const [summary, setSummary] = useState(null);  // résultat de la dernière séance

  function go(next, data = {}) { setCtx(data); setScreen(next); window.scrollTo && window.scrollTo(0, 0); }
  function update(patch) { onSaveSettings({ ...s, ...patch }); }

  function saveWorkout(w) {
    onSaveWorkouts([...workouts, w]);
    // avance dans le programme
    if (w.programId && w.sessionIndex != null) {
      const p = allPrograms(s).find((x) => x.id === w.programId);
      if (p && p.sessions) {
        update({ programPos: { ...s.programPos, [p.id]: (w.sessionIndex + 1) % p.sessions.length } });
      }
    }
    setSummary({ workout: w, suggestions: w.kind === "force" ? computeSuggestions(w, workouts, s, idx) : [] });
    go("summary");
  }
  function deleteWorkout(id) { onSaveWorkouts(workouts.filter((w) => w.id !== id)); }

  const wrap = (child) => <div style={{ padding: "28px 20px 8px" }}>{child}</div>;

  switch (screen) {
    case "setup":
      return wrap(<SetupWizard s={s} personalInfo={personalInfo} idx={idx}
        onDone={(patch) => { onSaveSettings({ ...s, ...patch, configured: true }); go("home"); }}
        onCancel={s.configured ? () => go("home") : null} />);
    case "programs":
      return wrap(<ProgramsList s={s} onBack={() => go("home")} onOpen={(p) => go("program", { program: p })} onNewSession={() => go("builder", {})} />);
    case "program":
      return wrap(<ProgramDetail s={s} idx={idx} program={ctx.program} kg={kg}
        onBack={() => go("programs")}
        onChoose={(p) => { update(p.type === "intervalle" ? { cardioProgram: p.id } : { activeProgram: p.id }); }}
        onStart={(p, i) => go(p.type === "intervalle" ? "interval" : "run", { program: p, index: i })}
        onEditCustom={(p) => go("builder", { edit: s.customSessions.find((c) => c.id === p.id) })}
        onSetWeek={(p, wi) => update({ runWeek: { ...s.runWeek, [p.id]: wi } })} />);
    case "run":
      return <SessionRunner s={s} idx={idx} kg={kg} workouts={workouts} program={ctx.program} sessionIndex={ctx.index}
        onUpdateSettings={update} onCancel={() => go("home")} onFinish={saveWorkout} />;
    case "interval":
      return <IntervalRunner program={ctx.program} weekIndex={ctx.index} kg={kg}
        onCancel={() => go("home")} onFinish={saveWorkout} />;
    case "summary":
      return wrap(<Summary summary={summary} s={s} idx={idx} onApply={(patch) => update(patch)} onClose={() => go("home")} />);
    case "free":
      return wrap(<FreeActivity kg={kg} onBack={() => go("home")} onSave={saveWorkout} />);
    case "exercises":
      return wrap(<ExerciseLibrary s={s} idx={idx} onBack={() => go("home")} onUpdate={update} />);
    case "builder":
      return wrap(<SessionBuilder s={s} idx={idx} edit={ctx.edit} onBack={() => go("programs")}
        onSave={(sess) => {
          const others = s.customSessions.filter((c) => c.id !== sess.id);
          update({ customSessions: [...others, sess] });
          go("programs");
        }}
        onDelete={(id) => { update({ customSessions: s.customSessions.filter((c) => c.id !== id) }); go("programs"); }} />);
    case "generator":
      return wrap(<SessionGenerator s={s} idx={idx} onBack={() => go("home")} onUpdateSettings={update}
        onStart={(sess) => go("run", { program: { id: sess.id, name: sess.name, custom: true, sessions: [{ name: sess.name, items: sess.items }] }, index: 0 })}
        onSave={(sess) => update({ customSessions: [...s.customSessions, sess] })}
        onEdit={(sess) => go("builder", { edit: sess })} />);
    case "coach":
      return wrap(<AICoach s={s} idx={idx} personalInfo={personalInfo} onBack={() => go("home")} onUpdateSettings={update}
        onStart={(sess) => go("run", { program: { id: sess.id, name: sess.name, custom: true, sessions: [{ name: sess.name, items: sess.items }] }, index: 0 })}
        onSave={(sess, newEx) => update({ customSessions: [...s.customSessions, sess], customExercises: [...(s.customExercises || []), ...(newEx || [])] })}
        onEdit={(sess) => go("builder", { edit: sess })} />);
    case "history":
      return wrap(<HistoryView workouts={workouts} idx={idx} onBack={() => go("home")} onDelete={deleteWorkout} />);
    default:
      return wrap(<SportHome s={s} idx={idx} kg={kg} workouts={workouts} go={go} personalInfo={personalInfo} />);
  }
}

/* ================================================================== */
/* ACCUEIL SPORT                                                       */
/* ================================================================== */
function SportHome({ s, idx, kg, workouts, go, personalInfo }) {
  const today = todayISO();
  const ws = weekStart(today);
  const weekW = workouts.filter((w) => w.date >= ws && w.date <= addDays(ws, 6));
  const weekKcal = weekW.reduce((a, w) => a + (w.kcal || 0), 0);
  const weekMin = weekW.reduce((a, w) => a + (w.durationMin || 0), 0);
  const programs = allPrograms(s);
  const prog = programs.find((p) => p.id === s.activeProgram);
  const cardio = programs.find((p) => p.id === s.cardioProgram);
  const nextIdx = prog ? (s.programPos[prog.id] || 0) % prog.sessions.length : 0;
  const runIdx = cardio ? (s.runWeek[cardio.id] || 0) : 0;
  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  const strengthThisWeek = weekW.filter((w) => w.kind === "force").length;

  return (
    <div>
      <SectionTitle sub="Programmes, séances guidées et activités.">Sport</SectionTitle>

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
          <p style={{ margin: 0, fontFamily: SERIF, fontWeight: 600, fontSize: 15.5 }}>Cette semaine</p>
          <span style={{ fontFamily: MONO, fontSize: 12, color: C.inkSoft }}>{strengthThisWeek}/{s.perWeek} séances</span>
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          {days.map((d) => {
            const n = workouts.filter((w) => w.date === d).length;
            const isT = d === today;
            return (
              <div key={d} style={{ flex: 1, textAlign: "center" }}>
                <div style={{
                  height: 34, borderRadius: 9, background: n ? C.herb : C.paperDark, color: n ? "#fff" : C.inkSoft,
                  display: "flex", alignItems: "center", justifyContent: "center", border: isT ? `2px solid ${C.ochre}` : "2px solid transparent",
                }}>{n ? <Check size={15} /> : null}</div>
                <span style={{ fontSize: 10.5, color: C.inkSoft }}>{"LMMJVSD"[days.indexOf(d)]}</span>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <Tag color={C.berry} bg={C.berryLight}>{Math.round(weekKcal)} kcal nettes</Tag>
          <Tag color={C.herb} bg={C.sage}>{Math.round(weekMin)} min</Tag>
        </div>
      </Card>

      {prog ? (
        <Card style={{ background: C.herb, border: "none", color: "#fff" }}>
          <p style={{ margin: 0, fontSize: 11.5, color: "#BFD3C6", textTransform: "uppercase", letterSpacing: 0.6 }}>Prochaine séance</p>
          <p style={{ margin: "4px 0 2px", fontFamily: SERIF, fontWeight: 600, fontSize: 19 }}>{prog.sessions[nextIdx].name}</p>
          <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "#DCE8E0" }}>
            {prog.name} · {prog.sessions[nextIdx].items.length} exercices{prog.minutes ? ` · ~${prog.minutes} min` : ""}
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn kind="soft" onClick={() => go("run", { program: prog, index: nextIdx })} style={{ flex: 1, background: "#fff" }}>
              <Play size={15} /> Démarrer
            </Btn>
            <Btn kind="ghost" onClick={() => go("program", { program: prog })} style={{ color: "#fff", borderColor: "rgba(255,255,255,0.5)" }}>Voir</Btn>
          </div>
        </Card>
      ) : (
        <Card onClick={() => go("programs")}>
          <p style={{ margin: 0, fontWeight: 600 }}>Aucun programme choisi</p>
          <p style={{ margin: "2px 0 0", fontSize: 12.5, color: C.inkSoft }}>Choisis un programme ou crée ta propre séance.</p>
        </Card>
      )}

      {cardio && (
        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Footprints size={20} color={C.herb} />
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>{cardio.name}</p>
              <p style={{ margin: 0, fontSize: 12, color: C.inkSoft }}>{cardio.weeks[runIdx]?.label}</p>
            </div>
            <Btn kind="soft" onClick={() => go("interval", { program: cardio, index: runIdx })}><Play size={14} /> Go</Btn>
          </div>
        </Card>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
        <HomeTile icon={Timer} label="Séance sur mesure" sub="selon ton temps dispo" onClick={() => go("generator")} accent />
        <HomeTile icon={Sparkles} label="Coach IA" sub="décris ta séance" onClick={() => go("coach")} accent />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
        <HomeTile icon={Activity} label="Activité libre" sub="vélo, natation, foot…" onClick={() => go("free")} />
        <HomeTile icon={BookOpen} label="Programmes" sub={`${PROGRAMS.length} programmes + les tiens`} onClick={() => go("programs")} />
        <HomeTile icon={Dumbbell} label="Exercices" sub={`${EXERCISES.length} exercices + perso`} onClick={() => go("exercises")} />
        <HomeTile icon={History} label="Historique" sub={`${workouts.length} séance${workouts.length > 1 ? "s" : ""}`} onClick={() => go("history")} />
      </div>
      <Btn kind="ghost" onClick={() => go("setup")} style={{ width: "100%" }}><Settings size={15} /> Personnaliser (matériel, niveau, pas)</Btn>
    </div>
  );
}

function HomeTile({ icon: Icon, label, sub, onClick, accent }) {
  return (
    <button onClick={onClick} style={{
      background: accent ? C.sage : C.card, border: `1px solid ${accent ? C.sage : C.line}`, borderRadius: 14, padding: "14px 12px", textAlign: "left",
      display: "flex", flexDirection: "column", gap: 6, color: C.ink,
    }}>
      <Icon size={19} color={C.herb} />
      <span style={{ fontWeight: 600, fontSize: 13.5 }}>{label}</span>
      <span style={{ fontSize: 11.5, color: C.inkSoft }}>{sub}</span>
    </button>
  );
}

/* ================================================================== */
/* ASSISTANT DE PERSONNALISATION                                       */
/* ================================================================== */
function SetupWizard({ s, personalInfo, idx, onDone, onCancel }) {
  const [equip, setEquip] = useState(s.equip || ["aucun"]);
  const [level, setLevel] = useState(s.level || "debutant");
  const [perWeek, setPerWeek] = useState(s.perWeek || 3);
  const [steps, setSteps] = useState(s.habitualSteps ?? 10000);
  const imc = bmi(personalInfo.poids, personalInfo.taille);
  const [lowImpact, setLowImpact] = useState(s.configured ? s.lowImpact : imc >= 30);
  const [variants, setVariants] = useState(() => {
    if (s.configured) return s.variants || {};
    return level === "debutant" ? { pompes: "pompes_mur", gainage: "gainage_genoux", squat: "squat", fente: "fente_statique", traction: "suspension" }
      : { pompes: "pompes_genoux", gainage: "gainage", squat: "squat", fente: "fente", traction: "traction_neg" };
  });
  const [cardio, setCardio] = useState(s.configured ? s.cardioProgram : (imc >= 30 ? "marche_active" : null));

  const toggle = (k) => setEquip(equip.includes(k) ? equip.filter((e) => e !== k) : [...equip, k]);
  const reco = recommendProgram({ equip, level, perWeek });

  return (
    <div>
      {onCancel ? <BackHeader title="Personnaliser" onBack={onCancel} /> : <SectionTitle sub="Quelques réglages pour adapter les séances à toi.">Bienvenue dans Sport</SectionTitle>}

      <Card>
        <Label>Ton matériel</Label>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {Object.entries(EQUIPMENT).filter(([k]) => k !== "aucun").map(([k, l]) => (
            <Chip key={k} active={equip.includes(k)} onClick={() => toggle(k)}>{l}</Chip>
          ))}
        </div>
        <p style={hint}>Rien de coché = programmes sans matériel uniquement.</p>
      </Card>

      <Card>
        <Label>Ton niveau actuel</Label>
        <div style={{ display: "flex", gap: 6 }}>
          <Chip active={level === "debutant"} onClick={() => setLevel("debutant")} style={{ flex: 1 }}>Je (re)commence</Chip>
          <Chip active={level === "intermediaire"} onClick={() => setLevel("intermediaire")} style={{ flex: 1 }}>Je m'entraîne déjà</Chip>
        </div>
        <Label style={{ marginTop: 14 }}>Séances de renforcement par semaine</Label>
        <Stepper value={perWeek} min={1} max={6} onChange={setPerWeek} unit="/ sem." />
      </Card>

      <Card>
        <Label>Ton niveau sur chaque mouvement</Label>
        <p style={{ ...hint, marginTop: 0, marginBottom: 10 }}>
          Choisis la version que tu arrives à faire proprement 8 à 10 fois. L'app te proposera de passer au niveau supérieur quand tu réussis toutes tes séries deux fois de suite.
        </p>
        {Object.entries(idx.chains).map(([chain, list]) => (
          <div key={chain} style={{ marginBottom: 10 }}>
            <span style={{ fontSize: 12.5, fontWeight: 600 }}>{CHAIN_NAMES[chain]}</span>
            <select value={variants[chain] || list[0].id} onChange={(e) => setVariants({ ...variants, [chain]: e.target.value })}
              style={{ ...inputStyle, fontFamily: "'Work Sans',sans-serif", fontSize: 13, marginTop: 4, padding: "9px 10px" }}>
              {list.map((e) => <option key={e.id} value={e.id}>{e.lvl + 1}. {e.name}</option>)}
            </select>
          </div>
        ))}
      </Card>

      <Card>
        <Toggle checked={lowImpact} onChange={setLowImpact} label="Mode faible impact (sans sauts)"
          sub={imc >= 30 ? "Conseillé d'après ta taille et ton poids : protège genoux et chevilles. Les sauts sont remplacés par des équivalents sans impact." : "Remplace sauts et chocs par des équivalents sans impact."} />
      </Card>

      <Card>
        <Label>Tes pas habituels par jour</Label>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <NumInput min={0} decimals={false} value={steps} onChange={(v) => setSteps(v)} style={{ ...inputStyle, flex: 1 }} />
          <span style={{ fontSize: 12, color: C.inkSoft }}>pas</span>
        </div>
        <p style={hint}>
          Utilisé dans le calcul de ton besoin (Profil → mode détaillé). Tes pas sont comptés une seule fois : ne les ajoute pas aussi en « activité libre ».
        </p>
      </Card>

      <Card>
        <Label>Cardio en plus (optionnel)</Label>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <Chip active={!cardio} onClick={() => setCardio(null)}>Aucun</Chip>
          <Chip active={cardio === "marche_active"} onClick={() => setCardio("marche_active")}>Marche active</Chip>
          <Chip active={cardio === "marche_course"} onClick={() => setCardio("marche_course")}>Marche → course</Chip>
        </div>
      </Card>

      <Card style={{ background: C.sage, border: "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <Sparkles size={15} color={C.herb} />
          <span style={{ fontWeight: 600, fontSize: 13.5, color: C.herb }}>Programme conseillé</span>
        </div>
        <p style={{ margin: 0, fontFamily: SERIF, fontWeight: 600, fontSize: 17 }}>{reco.name}</p>
        <p style={{ margin: "2px 0 0", fontSize: 12.5, color: C.herbLight }}>{reco.desc}</p>
      </Card>

      <Btn onClick={() => onDone({ equip, level, perWeek, lowImpact, variants, habitualSteps: steps, activeProgram: reco.id, cardioProgram: cardio })} style={{ width: "100%" }}>
        <Check size={15} /> Enregistrer et utiliser ce programme
      </Btn>
    </div>
  );
}

function recommendProgram({ equip, level, perWeek }) {
  const has = (k) => equip.includes(k);
  let id;
  if (has("salle")) id = level === "intermediaire" && perWeek >= 4 ? "salle_haut_bas" : "salle_debutant";
  else if (has("halteres")) id = "halteres_full";
  else if (has("elastique") && level === "debutant") id = "elastiques_full";
  else id = level === "debutant" ? "reprise_maison" : "maison_progression";
  return PROGRAMS.find((p) => p.id === id);
}

/* ================================================================== */
/* PROGRAMMES                                                          */
/* ================================================================== */
function programCategory(p) {
  if (/boxe/.test(p.id)) return "boxe";
  if (/mobilite|dos_posture/.test(p.id)) return "mobilite";
  if (p.type === "intervalle" || /circuit|express/.test(p.id)) return "cardio";
  return "renfo";
}
const PROG_CATS = { tous: "Tous", renfo: "Renforcement", boxe: "Boxe", cardio: "Cardio", mobilite: "Mobilité" };

function ProgramsList({ s, onBack, onOpen, onNewSession }) {
  const [cat, setCat] = useState("tous");
  const progs = allPrograms(s).filter((p) => p.custom || cat === "tous" || programCategory(p) === cat);
  const mine = progs.filter((p) => p.custom);
  const ok = progs.filter((p) => !p.custom && hasEquip(s, p.equip));
  const ko = progs.filter((p) => !p.custom && !hasEquip(s, p.equip));
  const row = (p, dim) => (
    <Card key={p.id} onClick={() => onOpen(p)} style={{ opacity: dim ? 0.55 : 1, padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 600, fontSize: 14.5 }}>{p.name}</span>
            {(s.activeProgram === p.id || s.cardioProgram === p.id) && <Tag color="#fff" bg={C.herb}>Actif</Tag>}
          </div>
          <p style={{ margin: "3px 0 0", fontSize: 12, color: C.inkSoft }}>
            {p.custom ? `${p.sessions[0].items.length} exercices` : [
              p.level === "debutant" ? "Débutant" : "Intermédiaire",
              p.perWeek && `${p.perWeek}×/sem.`,
              p.minutes && `~${p.minutes} min`,
              dim && "matériel manquant",
            ].filter(Boolean).join(" · ")}
          </p>
        </div>
        <ChevronRight size={18} color={C.inkSoft} />
      </div>
    </Card>
  );
  return (
    <div>
      <BackHeader title="Programmes" onBack={onBack} />
      <Btn kind="soft" onClick={onNewSession} style={{ width: "100%", marginBottom: 12 }}><Plus size={15} /> Créer ma séance</Btn>
      <div className="scrollx" style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 12 }}>
        {Object.entries(PROG_CATS).map(([k, l]) => <Chip key={k} active={cat === k} onClick={() => setCat(k)}>{l}</Chip>)}
      </div>
      {mine.length > 0 && <><Label>Mes séances</Label>{mine.map((p) => row(p))}</>}
      <Label>Adaptés à ton matériel</Label>
      {ok.map((p) => row(p))}
      {ko.length > 0 && <><Label>Autres programmes</Label>{ko.map((p) => row(p, true))}</>}
    </div>
  );
}

function ProgramDetail({ s, idx, program: p, kg, onBack, onChoose, onStart, onEditCustom, onSetWeek }) {
  const active = s.activeProgram === p.id || s.cardioProgram === p.id;
  return (
    <div>
      <BackHeader title={p.name} onBack={onBack} right={p.custom && <button onClick={() => onEditCustom(p)} style={iconBtn}><Pencil size={16} /></button>} />
      <p style={{ fontSize: 13, color: C.inkSoft, lineHeight: 1.5, marginTop: -6 }}>{p.desc}</p>
      {!p.custom && !active && (
        <Btn onClick={() => onChoose(p)} style={{ width: "100%", marginBottom: 14 }}><Check size={15} /> Choisir ce programme</Btn>
      )}
      {p.type === "intervalle" ? (
        p.weeks.map((w, wi) => {
          const total = w.steps.reduce((a, x) => a + x.s, 0);
          const kcal = w.steps.reduce((a, x) => a + netKcal(STEP_MET[x.k] || 3.5, kg, x.s / 60), 0);
          const cur = (s.runWeek[p.id] || 0) === wi;
          return (
            <Card key={wi} style={{ padding: 14, borderColor: cur ? C.herb : C.line }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 600 }}>{w.label}</span>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: C.inkSoft }}>{describeSteps(w.steps)}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 11.5, color: C.inkSoft, fontFamily: MONO }}>{Math.round(total / 60)} min · ~{Math.round(kcal)} kcal</p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <Btn kind="soft" onClick={() => { onSetWeek(p, wi); onStart(p, wi); }} style={{ padding: "8px 12px" }}><Play size={14} /></Btn>
                  {!cur && <button onClick={() => onSetWeek(p, wi)} style={{ ...iconBtn, fontSize: 11 }}>Ma semaine</button>}
                </div>
              </div>
            </Card>
          );
        })
      ) : (
        p.sessions.map((sess, si) => (
          <Card key={si} style={{ padding: 14 }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
              <span style={{ flex: 1, fontFamily: SERIF, fontWeight: 600, fontSize: 15.5 }}>
                {sess.name}
                <span style={{ display: "block", fontFamily: MONO, fontSize: 11.5, color: C.inkSoft, fontWeight: 500 }}>≈ {Math.round(estimateSessionSeconds(sess.items, idx) / 60)} min</span>
              </span>
              <Btn kind="soft" onClick={() => onStart(p, si)} style={{ padding: "8px 12px" }}><Play size={14} /> Démarrer</Btn>
            </div>
            {sess.items.map((it, ii) => {
              const ex = resolveExercise(it.ex, s, idx);
              if (!ex) return null;
              const bonus = s.repsBonus[ex.id] || 0;
              return (
                <div key={ii} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "5px 0", borderTop: ii ? `1px dashed ${C.line}` : "none" }}>
                  <span>{ex.name}{ex.id !== it.ex && <span style={{ color: C.olive, fontSize: 11 }}> · ton niveau</span>}</span>
                  <span style={{ fontFamily: MONO, color: C.inkSoft, fontSize: 12, whiteSpace: "nowrap", marginLeft: 8 }}>
                    {it.sets}×{targetLabel(ex, it, bonus)}
                  </span>
                </div>
              );
            })}
          </Card>
        ))
      )}
    </div>
  );
}

/** Durée estimée d'une séance (secondes) : effort + repos. */
export function estimateSessionSeconds(items, idx) {
  return (items || []).reduce((tot, it) => {
    const ex = idx ? idx.byId[it.ex] : null;
    const timed = (ex && ex.kind === "time") || it.timed || (!ex && it.sec);
    const sideMul = ex && ex.perSide ? 2 : 1;
    const work = timed ? (it.sec || 30) : (it.reps || 10) * 3.2 * sideMul + 5;
    return tot + it.sets * work + Math.max(0, it.sets - 1) * (it.rest || 0) + (it.rest || 0) + 15;
  }, 0);
}

function describeSteps(steps) {
  const runs = steps.filter((x) => EFFORT_KINDS.includes(x.k));
  if (!runs.length) return "";
  const first = runs[0];
  const same = runs.every((r) => r.s === first.s);
  const lbl = { run: "course", hill: "montée", box: "round", bike: "rapide", sprint: "sprint" }[first.k] || "rapide";
  return same ? `${runs.length} × ${fmtMin(first.s)} ${lbl}` : runs.map((r) => fmtMin(r.s)).join(" + ") + " " + lbl;
}
const EFFORT_KINDS = ["run", "brisk", "hill", "box", "bike", "sprint"];
function fmtMin(sec) { return sec % 60 === 0 ? `${sec / 60} min` : `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`; }
function targetLabel(ex, it, bonus = 0) {
  if (ex.kind === "time" || it.timed) { const sec = (it.sec || 30) + (ex.kind === "time" ? bonus : 0); return sec >= 60 ? fmtMin(sec) : sec + " s"; }
  return ((it.reps || 10) + bonus) + (ex.perSide ? "/côté" : "");
}

/* ================================================================== */
/* SÉANCE GUIDÉE (renforcement)                                        */
/* ================================================================== */
function SessionRunner({ s, idx, kg, workouts, program, sessionIndex, onUpdateSettings, onCancel, onFinish }) {
  const session = program.sessions[sessionIndex];
  const [startedAt] = useState(Date.now());
  const [i, setI] = useState(0);                // exercice courant
  const [overrides, setOverrides] = useState({}); // index -> exId (variante changée pendant la séance)
  const [done, setDone] = useState({});         // index -> [{reps, kg, sec}]
  const [restEnd, setRestEnd] = useState(null);
  const [holdEnd, setHoldEnd] = useState(null);
  const [reps, setReps] = useState(10);
  const [load, setLoad] = useState(0);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const [showCue, setShowCue] = useState(false);
  useWakeLock(true);

  const item = session.items[i];
  const baseEx = item ? resolveExercise(item.ex, s, idx) : null;
  const ex = item ? (overrides[i] ? idx.byId[overrides[i]] : baseEx) : null;
  const bonus = ex ? (s.repsBonus[ex.id] || 0) : 0;
  const timed = !!ex && (ex.kind === "time" || !!item?.timed);
  const targetReps = (item?.reps || 10) + bonus;
  const targetSec = (item?.sec || 30) + (ex && ex.kind === "time" ? bonus : 0);
  const setsDone = (done[i] || []).length;
  const last = ex ? lastSetsFor(workouts, ex.id) : null;

  useEffect(() => {
    if (!ex) return;
    setReps(targetReps);
    const lastKg = last?.sets?.find((x) => x.kg)?.kg;
    setLoad(lastKg || 0);
    setShowCue(false);
  }, [i, ex?.id]);

  const restLeft = useCountdown(restEnd, false, () => { setRestEnd(null); signal("go"); });
  const holdLeft = useCountdown(holdEnd, false, () => { setHoldEnd(null); signal("end"); recordSet({ sec: targetSec }); });
  const lastTick = useRef(0);
  useEffect(() => {
    const left = Math.ceil(holdEnd ? holdLeft : restEnd ? restLeft : 0);
    if (left > 0 && left <= 3 && left !== lastTick.current) { lastTick.current = left; signal("tick"); }
    if (left === 0) lastTick.current = 0;
  }, [holdLeft, restLeft]);

  function recordSet(data) {
    const entry = { ...data, kg: ex.weighted && load ? Number(load) : undefined };
    const list = [...(done[i] || []), entry];
    const nextDone = { ...done, [i]: list };
    setDone(nextDone);
    if (list.length >= item.sets) {
      if (i + 1 < session.items.length) {
        if (item.rest) setRestEnd(Date.now() + item.rest * 1000);
        setI(i + 1);
      } else {
        finish(nextDone);
      }
    } else if (item.rest) {
      setRestEnd(Date.now() + item.rest * 1000);
    }
  }

  function changeLevel(dir) {
    if (!ex.chain) return;
    const chain = idx.chains[ex.chain];
    const pos = chain.findIndex((e) => e.id === ex.id);
    const next = chain[pos + dir];
    if (!next) return;
    setOverrides({ ...overrides, [i]: next.id });
    onUpdateSettings({ variants: { ...s.variants, [ex.chain]: next.id } });
  }

  function finish(finalDone = done) {
    const minutes = (Date.now() - startedAt) / 60000;
    const exercises = session.items.map((it, k) => {
      const e = overrides[k] ? idx.byId[overrides[k]] : resolveExercise(it.ex, s, idx);
      const b = s.repsBonus[e.id] || 0;
      const isTimed = e.kind === "time" || !!it.timed;
      return { exId: e.id, name: e.name, met: e.met, kind: isTimed ? "time" : "reps", target: { sets: it.sets, reps: (it.reps || 10) + b, sec: (it.sec || 30) + (e.kind === "time" ? b : 0) }, sets: finalDone[k] || [] };
    }).filter((e) => e.sets.length);
    const totalSets = exercises.reduce((a, e) => a + e.sets.length, 0) || 1;
    const avgMet = exercises.reduce((a, e) => a + e.met * e.sets.length, 0) / totalSets || program.met || 4;
    onFinish({
      id: uid(), date: todayISO(), startedAt, kind: "force", title: program.custom ? program.name : `${program.name} — ${session.name}`,
      programId: program.id, sessionIndex, durationMin: round(minutes), kcal: Math.round(netKcal(avgMet, kg, minutes)), exercises,
    });
  }

  const progress = (i + setsDone / (item?.sets || 1)) / session.items.length;
  const resting = !!restEnd;
  const holding = !!holdEnd;
  const nextItem = session.items[i + (setsDone >= (item?.sets || 0) ? 1 : 0)];

  return (
    <div style={{ padding: "22px 20px 8px", minHeight: "calc(100vh - 92px)", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <button onClick={() => setConfirmQuit(true)} style={iconBtn}><X size={18} /></button>
        <div style={{ flex: 1, height: 6, borderRadius: 999, background: C.paperDark, overflow: "hidden" }}>
          <div style={{ width: `${progress * 100}%`, height: "100%", background: C.herb, transition: "width .3s" }} />
        </div>
        <span style={{ fontFamily: MONO, fontSize: 12, color: C.inkSoft }}>{i + 1}/{session.items.length}</span>
      </div>

      {confirmQuit && (
        <Card style={{ background: C.berryLight, border: "none" }}>
          <p style={{ margin: "0 0 10px", fontSize: 13.5 }}>Terminer la séance maintenant ?</p>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn onClick={() => finish()} style={{ flex: 1 }} disabled={!Object.keys(done).length}>Enregistrer ce qui est fait</Btn>
            <Btn kind="danger" onClick={onCancel}>Abandonner</Btn>
            <Btn kind="ghost" onClick={() => setConfirmQuit(false)}>Continuer</Btn>
          </div>
        </Card>
      )}

      {resting ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: 13, color: C.inkSoft, textTransform: "uppercase", letterSpacing: 1 }}>Repos</p>
          <p style={{ margin: "6px 0", fontFamily: MONO, fontSize: 64, fontWeight: 600, color: C.herb }}>{fmtDuration(Math.ceil(restLeft))}</p>
          {nextItem && <p style={{ margin: "0 0 18px", fontSize: 13.5 }}>Ensuite : <strong>{(resolveExercise(nextItem.ex, s, idx) || {}).name}</strong></p>}
          <div style={{ display: "flex", gap: 8 }}>
            <Btn kind="soft" onClick={() => setRestEnd(restEnd + 15000)}>+15 s</Btn>
            <Btn onClick={() => { setRestEnd(null); }}><SkipForward size={15} /> Passer</Btn>
          </div>
        </div>
      ) : ex ? (
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: 12, color: C.olive, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.6 }}>{GROUPS[ex.group] || ex.group}</p>
          <h2 style={{ fontFamily: SERIF, fontSize: 25, margin: "4px 0 6px" }}>{ex.name}</h2>
          <button onClick={() => setShowCue(!showCue)} style={{ ...iconBtn, padding: 0, fontSize: 12.5, color: C.herb, fontWeight: 600 }}>
            {showCue ? "Masquer les consignes" : "Comment faire ?"}
          </button>
          {showCue && <p style={{ fontSize: 13, lineHeight: 1.55, color: C.inkSoft, background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: 12, marginTop: 8 }}>{ex.cue}</p>}

          {ex.chain && (
            <div style={{ display: "flex", gap: 8, margin: "12px 0" }}>
              <Btn kind="ghost" onClick={() => changeLevel(-1)} disabled={idx.chains[ex.chain][0].id === ex.id} style={{ flex: 1, padding: "8px 10px", fontSize: 12.5 }}>
                <ArrowDown size={14} /> Plus facile
              </Btn>
              <Btn kind="ghost" onClick={() => changeLevel(1)} disabled={idx.chains[ex.chain].slice(-1)[0].id === ex.id} style={{ flex: 1, padding: "8px 10px", fontSize: 12.5 }}>
                <ArrowUp size={14} /> Plus dur
              </Btn>
            </div>
          )}

          <Card style={{ marginTop: 12, textAlign: "center" }}>
            <p style={{ margin: 0, fontSize: 12.5, color: C.inkSoft }}>Série {Math.min(setsDone + 1, item.sets)} sur {item.sets}</p>
            <p style={{ margin: "4px 0 2px", fontFamily: MONO, fontSize: 38, fontWeight: 600 }}>
              {timed ? (holding ? fmtDuration(Math.ceil(holdLeft)) : fmtDuration(targetSec)) : `${targetReps}`}
              {!timed && <span style={{ fontSize: 15, color: C.inkSoft }}> reps{ex.perSide ? " / côté" : ""}</span>}
            </p>
            {last && (
              <p style={{ margin: "0 0 10px", fontSize: 11.5, color: C.inkSoft }}>
                Dernière fois ({frShort(last.date)}) : {last.sets.map((x) => x.sec ? `${x.sec}s` : `${x.reps}${x.kg ? `×${x.kg}kg` : ""}`).join(" · ")}
              </p>
            )}

            {timed ? (
              holding ? (
                <Btn kind="ghost" onClick={() => { setHoldEnd(null); recordSet({ sec: Math.round(targetSec - holdLeft) }); }} style={{ width: "100%" }}>J'arrête ici</Btn>
              ) : (
                <Btn onClick={() => { signal("go"); setHoldEnd(Date.now() + targetSec * 1000); }} style={{ width: "100%" }}><Timer size={15} /> Lancer le chrono</Btn>
              )
            ) : (
              <>
                <Label style={{ textAlign: "left" }}>Répétitions réussies</Label>
                <Stepper value={reps} min={0} max={200} onChange={setReps} />
                {ex.weighted && (
                  <>
                    <Label style={{ textAlign: "left", marginTop: 10 }}>Charge</Label>
                    <Stepper value={load} min={0} max={500} step={0.5} onChange={setLoad} unit="kg" />
                  </>
                )}
                <Btn onClick={() => recordSet({ reps })} style={{ width: "100%", marginTop: 12 }}><Check size={15} /> Série faite</Btn>
              </>
            )}
          </Card>

          {(done[i] || []).length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
              {done[i].map((x, k) => <Tag key={k} color={C.herb} bg={C.sage}>S{k + 1} : {x.sec ? `${x.sec}s` : `${x.reps}${x.kg ? `×${x.kg}kg` : ""}`}</Tag>)}
            </div>
          )}
          <button onClick={() => { if (i + 1 < session.items.length) setI(i + 1); else finish(); }} style={{ ...iconBtn, fontSize: 12.5, color: C.inkSoft }}>
            Passer cet exercice →
          </button>
        </div>
      ) : null}
    </div>
  );
}

/* Suggestions de progression après une séance */
function computeSuggestions(w, history, s, idx) {
  const out = [];
  (w.exercises || []).forEach((e) => {
    const ex = idx.byId[e.exId];
    if (!ex || ex.group === "cardio" || ex.group === "mobilite" || ex.group === "boxe") return; // échauffement, cardio, rounds : pas de progression auto
    if (e.kind === "time" && ex.kind !== "time") return; // exercice à répétitions fait au chrono (circuit)
    const isTime = ex.kind === "time";
    const target = isTime ? e.target.sec : e.target.reps;
    const vals = e.sets.map((x) => (isTime ? x.sec || 0 : x.reps || 0));
    if (!vals.length || !target) return;
    const allOk = vals.length >= e.target.sets && vals.every((v) => v >= target);
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    const prev = [...history].reverse().find((h) => (h.exercises || []).some((x) => x.exId === e.exId));
    const prevE = prev && prev.exercises.find((x) => x.exId === e.exId);
    const prevOk = prevE && prevE.sets.length >= prevE.target.sets &&
      prevE.sets.every((x) => (isTime ? x.sec || 0 : x.reps || 0) >= (isTime ? prevE.target.sec : prevE.target.reps));

    const chain = ex.chain ? idx.chains[ex.chain] : null;
    const pos = chain ? chain.findIndex((c) => c.id === ex.id) : -1;
    if (allOk && prevOk) {
      if (chain && pos < chain.length - 1) {
        out.push({ text: `${ex.name} : réussi 2 fois de suite. Passer à « ${chain[pos + 1].name} » ?`, patch: { variants: { [ex.chain]: chain[pos + 1].id } }, up: true });
      } else if (ex.weighted) {
        out.push({ text: `${ex.name} : toutes les séries réussies 2 fois. Augmente la charge d'environ 5 % la prochaine fois.`, up: true });
      } else {
        const add = isTime ? 10 : 2;
        out.push({ text: `${ex.name} : bravo ! Passer à ${target + add}${isTime ? " s" : " répétitions"} ?`, patch: { repsBonus: { [ex.id]: (s.repsBonus[ex.id] || 0) + add } }, up: true });
      }
    } else if (allOk) {
      out.push({ text: `${ex.name} : toutes les séries réussies. Encore une fois et tu montes de niveau.`, info: true });
    } else if (avg < target * 0.6) {
      if (chain && pos > 0) out.push({ text: `${ex.name} : c'était dur. Revenir à « ${chain[pos - 1].name} » pour progresser proprement ?`, patch: { variants: { [ex.chain]: chain[pos - 1].id } } });
      else if (!ex.weighted) {
        const sub = isTime ? 5 : 2;
        if (target - sub > 0) out.push({ text: `${ex.name} : objectif trop haut. Le baisser à ${target - sub}${isTime ? " s" : " répétitions"} ?`, patch: { repsBonus: { [ex.id]: (s.repsBonus[ex.id] || 0) - sub } } });
      } else out.push({ text: `${ex.name} : allège un peu la charge la prochaine fois.` });
    }
  });
  return out;
}

function Summary({ summary, s, onApply, onClose }) {
  const [applied, setApplied] = useState({});
  if (!summary) return null;
  const w = summary.workout;
  return (
    <div>
      <div style={{ textAlign: "center", padding: "10px 0 18px" }}>
        <Trophy size={40} color={C.ochre} />
        <h2 style={{ fontFamily: SERIF, margin: "8px 0 2px" }}>Séance terminée</h2>
        <p style={{ margin: 0, color: C.inkSoft, fontSize: 13 }}>{w.title}</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
        <Stat label="Durée" value={`${Math.round(w.durationMin)} min`} />
        <Stat label="Dépense nette" value={`${w.kcal} kcal`} />
      </div>
      {summary.suggestions.length > 0 && (
        <>
          <Label>Progression</Label>
          {summary.suggestions.map((sg, k) => (
            <Card key={k} style={{ padding: 13 }}>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>{sg.up ? "⬆ " : sg.info ? "✓ " : "⬇ "}{sg.text}</p>
              {sg.patch && (
                <Btn kind={applied[k] ? "soft" : "ghost"} disabled={applied[k]} style={{ marginTop: 8, padding: "7px 12px", fontSize: 12.5 }}
                  onClick={() => {
                    const patch = {};
                    if (sg.patch.variants) patch.variants = { ...s.variants, ...sg.patch.variants };
                    if (sg.patch.repsBonus) patch.repsBonus = { ...s.repsBonus, ...sg.patch.repsBonus };
                    onApply(patch); setApplied({ ...applied, [k]: true });
                  }}>{applied[k] ? "Appliqué ✓" : "Appliquer"}</Btn>
              )}
            </Card>
          ))}
        </>
      )}
      <p style={hint}>
        « Dépense nette » = calories au-delà de ce que tu brûles au repos, estimées d'après ton poids. Les montres et applis comptent souvent la dépense brute, plus élevée.
      </p>
      <Btn onClick={onClose} style={{ width: "100%", marginTop: 8 }}>Terminé</Btn>
    </div>
  );
}

/* ================================================================== */
/* INTERVALLES (marche / course)                                       */
/* ================================================================== */
function IntervalRunner({ program, weekIndex, kg, onCancel, onFinish }) {
  const week = program.weeks[weekIndex] || program.weeks[0];
  const steps = week.steps;
  const [started, setStarted] = useState(false);
  const [k, setK] = useState(0);
  const [endAt, setEndAt] = useState(null);
  const [pausedLeft, setPausedLeft] = useState(null);
  const [elapsed, setElapsed] = useState([]); // secondes effectives par étape
  const [startedAt, setStartedAt] = useState(null);
  useWakeLock(started);

  const left = useCountdown(pausedLeft == null ? endAt : null, false, () => next());
  const lastTick = useRef(0);
  useEffect(() => {
    const l = Math.ceil(left);
    if (started && l > 0 && l <= 3 && l !== lastTick.current) { lastTick.current = l; signal("tick"); }
    if (started && steps[k]?.warn10 && l === 10 && lastTick.current !== 10) { lastTick.current = 10; beep(1200, 120); setTimeout(() => beep(1200, 120), 180); buzz([80, 60, 80]); }
  }, [left]);

  function begin() {
    setStarted(true); setStartedAt(Date.now()); setK(0);
    setEndAt(Date.now() + steps[0].s * 1000); signal("go");
  }
  function next(skipped) {
    const spent = skipped ? steps[k].s - (pausedLeft ?? left) : steps[k].s;
    const el = [...elapsed, Math.max(0, spent)];
    setElapsed(el);
    lastTick.current = 0;
    if (k + 1 >= steps.length) { signal("end"); save(el); return; }
    setK(k + 1); setPausedLeft(null);
    setEndAt(Date.now() + steps[k + 1].s * 1000);
    signal(EFFORT_KINDS.includes(steps[k + 1].k) ? "end" : "go");
  }
  function togglePause() {
    if (pausedLeft == null) { setPausedLeft(left); }
    else { setEndAt(Date.now() + pausedLeft * 1000); setPausedLeft(null); }
  }
  function save(el) {
    const kcal = el.reduce((a, sec, j) => a + netKcal(STEP_MET[steps[j].k] || 3.5, kg, sec / 60), 0);
    const minutes = el.reduce((a, b) => a + b, 0) / 60;
    onFinish({ id: uid(), date: todayISO(), startedAt, kind: "intervalle", title: `${program.name} — ${week.label}`, programId: program.id, durationMin: round(minutes), kcal: Math.round(kcal) });
  }

  const cur = steps[k];
  const colors = { run: C.berry, hill: C.ochre, brisk: C.olive, walk: C.herb, rest: C.inkSoft, box: C.berry, bike: C.ochre, sprint: C.berry };
  const shown = pausedLeft != null ? pausedLeft : left;
  const totalLeft = (endAt ? shown : 0) + steps.slice(k + 1).reduce((a, x) => a + x.s, 0);

  return (
    <div style={{ padding: "22px 20px", minHeight: "calc(100vh - 92px)", display: "flex", flexDirection: "column" }}>
      <BackHeader title={week.label} onBack={() => {
        if (started && elapsed.length) save([...elapsed, steps[k].s - shown]); else onCancel();
      }} />
      {!started ? (
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 13, color: C.inkSoft }}>{program.name}</p>
          {steps.map((x, j) => (
            <div key={j} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px dashed ${C.line}`, fontSize: 13 }}>
              <span style={{ color: colors[x.k] }}>{x.l}</span><span style={{ fontFamily: MONO }}>{fmtMin(x.s)}</span>
            </div>
          ))}
          <p style={hint}>Le téléphone bipe et vibre à chaque changement. Garde l'écran allumé ou l'app ouverte pour être sûr d'entendre les signaux.</p>
          <Btn onClick={begin} style={{ width: "100%", marginTop: 10 }}><Play size={15} /> Démarrer</Btn>
        </div>
      ) : (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: 13, color: C.inkSoft }}>Étape {k + 1} / {steps.length}</p>
          <p style={{ margin: "8px 0", fontFamily: SERIF, fontSize: 30, fontWeight: 600, color: colors[cur.k] }}>{cur.l}</p>
          <p style={{ margin: 0, fontFamily: MONO, fontSize: 72, fontWeight: 600 }}>{fmtDuration(Math.ceil(shown))}</p>
          <p style={{ margin: "6px 0 22px", fontSize: 12.5, color: C.inkSoft }}>Reste {fmtDuration(totalLeft)} au total{steps[k + 1] ? ` · ensuite : ${steps[k + 1].l}` : ""}</p>
          <div style={{ display: "flex", gap: 10 }}>
            <Btn onClick={togglePause} style={{ minWidth: 120 }}>{pausedLeft != null ? <><Play size={15} /> Reprendre</> : <><Pause size={15} /> Pause</>}</Btn>
            <Btn kind="ghost" onClick={() => next(true)}><SkipForward size={15} /> Étape suivante</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/* ACTIVITÉ LIBRE                                                      */
/* ================================================================== */
function FreeActivity({ kg, onBack, onSave }) {
  const [q, setQ] = useState("");
  const [act, setAct] = useState(null);
  const [minutes, setMinutes] = useState(30);
  const [intensity, setIntensity] = useState("modere");
  const [date, setDate] = useState(todayISO());
  const [customName, setCustomName] = useState("");
  const [customKcal, setCustomKcal] = useState("");
  const list = ACTIVITIES.filter((a) => a.name.toLowerCase().includes(q.toLowerCase()));
  const kcal = act ? Math.round(netKcal(act.met * INTENSITY[intensity], kg, minutes)) : 0;

  return (
    <div>
      <BackHeader title="Activité libre" onBack={act ? () => setAct(null) : onBack} />
      {!act ? (
        <>
          <div style={{ position: "relative", marginBottom: 12 }}>
            <Search size={16} color={C.inkSoft} style={{ position: "absolute", left: 12, top: 12 }} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher une activité" style={{ ...inputStyle, paddingLeft: 36, fontFamily: "'Work Sans',sans-serif" }} />
          </div>
          {list.map((a) => (
            <button key={a.id} onClick={() => setAct(a)} style={rowBtn}>
              <span>{a.name}</span><ChevronRight size={16} color={C.inkSoft} />
            </button>
          ))}
          <Card style={{ marginTop: 14 }}>
            <Label>Autre activité (calories connues)</Label>
            <input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="Nom" style={{ ...inputStyle, fontFamily: "'Work Sans',sans-serif", marginBottom: 8 }} />
            <div style={{ display: "flex", gap: 8 }}>
              <input type="number" value={customKcal} onChange={(e) => setCustomKcal(e.target.value)} placeholder="kcal" style={{ ...inputStyle, flex: 1 }} />
              <NumInput min={1} decimals={false} value={minutes} onChange={(v) => setMinutes(v)} placeholder="min" style={{ ...inputStyle, width: 90 }} />
            </div>
            <Btn disabled={!customName.trim() || !Number(customKcal)} style={{ width: "100%", marginTop: 10 }}
              onClick={() => onSave({ id: uid(), date, kind: "libre", title: customName.trim(), durationMin: minutes, kcal: Math.round(Number(customKcal)) })}>
              Enregistrer
            </Btn>
          </Card>
        </>
      ) : (
        <Card>
          <p style={{ margin: "0 0 12px", fontFamily: SERIF, fontWeight: 600, fontSize: 18 }}>{act.name}</p>
          {act.walk && <p style={{ ...hint, marginTop: 0, background: C.ochreLight, padding: 10, borderRadius: 10, color: C.ink }}>Si ces pas sont déjà comptés dans ton total de pas du jour, n'enregistre pas cette activité : elle serait comptée deux fois.</p>}
          <Label>Durée</Label>
          <Stepper value={minutes} min={5} max={600} step={5} onChange={setMinutes} unit="min" />
          <Label style={{ marginTop: 12 }}>Intensité</Label>
          <div style={{ display: "flex", gap: 6 }}>
            {[["leger", "Légère"], ["modere", "Modérée"], ["intense", "Intense"]].map(([k, l]) => <Chip key={k} active={intensity === k} onClick={() => setIntensity(k)} style={{ flex: 1 }}>{l}</Chip>)}
          </div>
          <Label style={{ marginTop: 12 }}>Date</Label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} />
          <div style={{ textAlign: "center", margin: "16px 0 8px" }}>
            <span style={{ fontFamily: MONO, fontSize: 30, fontWeight: 600 }}>{kcal}</span>
            <span style={{ fontSize: 13, color: C.inkSoft }}> kcal nettes estimées</span>
          </div>
          <Btn onClick={() => onSave({ id: uid(), date, kind: "libre", activityId: act.id, title: act.name, durationMin: minutes, kcal })} style={{ width: "100%" }}>
            <Check size={15} /> Enregistrer
          </Btn>
        </Card>
      )}
    </div>
  );
}

/* ================================================================== */
/* BIBLIOTHÈQUE D'EXERCICES + EXERCICES PERSO                          */
/* ================================================================== */
function ExerciseLibrary({ s, idx, onBack, onUpdate }) {
  const [group, setGroup] = useState("tous");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(null);
  const [form, setForm] = useState(null);
  const list = idx.all.filter((e) => (group === "tous" || e.group === group) && e.name.toLowerCase().includes(q.toLowerCase()));

  if (form) {
    return <CustomExerciseForm initial={form} onCancel={() => setForm(null)}
      onDelete={form.id ? () => { onUpdate({ customExercises: s.customExercises.filter((e) => e.id !== form.id) }); setForm(null); setOpen(null); } : null}
      onSave={(e) => {
        const others = (s.customExercises || []).filter((x) => x.id !== e.id);
        onUpdate({ customExercises: [...others, e] }); setForm(null); setOpen(null);
      }} />;
  }

  if (open) {
    const ex = open;
    const chain = ex.chain ? idx.chains[ex.chain] : null;
    const current = chain ? (s.variants[ex.chain] || chain[0].id) : null;
    return (
      <div>
        <BackHeader title={ex.name} onBack={() => setOpen(null)} right={ex.custom && <button onClick={() => setForm(ex)} style={iconBtn}><Pencil size={16} /></button>} />
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          <Tag color={C.olive} bg={C.oliveLight}>{GROUPS[ex.group]}</Tag>
          {(ex.equip || []).filter((e) => e !== "aucun").map((e) => <Tag key={e} color={C.herb} bg={C.sage}>{EQUIPMENT[e]}</Tag>)}
          {ex.impact === "fort" && <Tag color={C.berry} bg={C.berryLight}>Avec impact</Tag>}
          {ex.custom && <Tag color={C.ochre} bg={C.ochreLight}>Perso</Tag>}
        </div>
        <Card><p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6 }}>{ex.cue || "Pas de consigne."}</p></Card>
        {chain && (
          <>
            <Label>Progression — {CHAIN_NAMES[ex.chain]}</Label>
            {chain.map((c) => (
              <button key={c.id} onClick={() => onUpdate({ variants: { ...s.variants, [ex.chain]: c.id } })} style={{ ...rowBtn, borderColor: current === c.id ? C.herb : C.line }}>
                <span><span style={{ fontFamily: MONO, color: C.inkSoft }}>{c.lvl + 1}.</span> {c.name}</span>
                {current === c.id ? <Tag color="#fff" bg={C.herb}>Mon niveau</Tag> : <span style={{ fontSize: 11.5, color: C.inkSoft }}>choisir</span>}
              </button>
            ))}
            <p style={hint}>Ton niveau remplace automatiquement cet exercice dans tous les programmes.</p>
          </>
        )}
      </div>
    );
  }

  return (
    <div>
      <BackHeader title="Exercices" onBack={onBack} />
      <Btn kind="soft" onClick={() => setForm({})} style={{ width: "100%", marginBottom: 12 }}><Plus size={15} /> Créer un exercice</Btn>
      <div style={{ position: "relative", marginBottom: 10 }}>
        <Search size={16} color={C.inkSoft} style={{ position: "absolute", left: 12, top: 12 }} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher" style={{ ...inputStyle, paddingLeft: 36, fontFamily: "'Work Sans',sans-serif" }} />
      </div>
      <div className="scrollx" style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 12, paddingBottom: 2 }}>
        <Chip active={group === "tous"} onClick={() => setGroup("tous")}>Tous</Chip>
        {Object.entries(GROUPS).map(([k, l]) => <Chip key={k} active={group === k} onClick={() => setGroup(k)}>{l}</Chip>)}
      </div>
      {list.map((e) => (
        <button key={e.id} onClick={() => setOpen(e)} style={rowBtn}>
          <span style={{ textAlign: "left" }}>
            {e.name}
            <span style={{ display: "block", fontSize: 11, color: C.inkSoft }}>
              {[GROUPS[e.group], e.custom && "perso", e.chain && s.variants[e.chain] === e.id && "mon niveau", !hasEquip(s, e.equip) && "matériel manquant"].filter(Boolean).join(" · ")}
            </span>
          </span>
          <ChevronRight size={16} color={C.inkSoft} />
        </button>
      ))}
    </div>
  );
}

function CustomExerciseForm({ initial, onSave, onCancel, onDelete }) {
  const [f, setF] = useState({ name: "", group: "jambes", kind: "reps", met: 4, cue: "", equip: ["aucun"], weighted: false, perSide: false, ...initial });
  const intens = [[3, "Légère"], [4, "Modérée"], [6, "Soutenue"], [8, "Très intense"]];
  return (
    <div>
      <BackHeader title={initial.id ? "Modifier l'exercice" : "Nouvel exercice"} onBack={onCancel} />
      <Card>
        <Label>Nom</Label>
        <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} style={{ ...inputStyle, fontFamily: "'Work Sans',sans-serif" }} placeholder="ex. Pompes sur le rebord de la baignoire" />
        <Label style={{ marginTop: 12 }}>Groupe musculaire</Label>
        <select value={f.group} onChange={(e) => setF({ ...f, group: e.target.value })} style={{ ...inputStyle, fontFamily: "'Work Sans',sans-serif" }}>
          {Object.entries(GROUPS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <Label style={{ marginTop: 12 }}>Type</Label>
        <div style={{ display: "flex", gap: 6 }}>
          <Chip active={f.kind === "reps"} onClick={() => setF({ ...f, kind: "reps" })} style={{ flex: 1 }}>Répétitions</Chip>
          <Chip active={f.kind === "time"} onClick={() => setF({ ...f, kind: "time" })} style={{ flex: 1 }}>Durée</Chip>
        </div>
        <Label style={{ marginTop: 12 }}>Intensité (pour les calories)</Label>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {intens.map(([m, l]) => <Chip key={m} active={f.met === m} onClick={() => setF({ ...f, met: m })}>{l}</Chip>)}
        </div>
        <div style={{ marginTop: 12 }}>
          <Toggle checked={f.weighted} onChange={(v) => setF({ ...f, weighted: v })} label="Avec charge (noter les kg)" />
          <Toggle checked={f.perSide} onChange={(v) => setF({ ...f, perSide: v })} label="À faire de chaque côté" />
        </div>
        <Label style={{ marginTop: 12 }}>Consignes / notes</Label>
        <textarea value={f.cue} onChange={(e) => setF({ ...f, cue: e.target.value })} rows={4} style={{ ...inputStyle, fontFamily: "'Work Sans',sans-serif", resize: "vertical" }} />
      </Card>
      <Btn disabled={!f.name.trim()} onClick={() => onSave({ ...f, name: f.name.trim(), id: f.id || "perso_" + uid(), custom: true })} style={{ width: "100%" }}><Check size={15} /> Enregistrer</Btn>
      {onDelete && <Btn kind="danger" onClick={onDelete} style={{ width: "100%", marginTop: 8 }}><Trash2 size={15} /> Supprimer</Btn>}
    </div>
  );
}

/* ================================================================== */
/* CRÉATEUR DE SÉANCE                                                  */
/* ================================================================== */
function SessionBuilder({ s, idx, edit, onBack, onSave, onDelete }) {
  const [name, setName] = useState(edit?.name || "");
  const [items, setItems] = useState(edit?.items || []);
  const [picking, setPicking] = useState(false);
  const [q, setQ] = useState("");

  function add(ex) {
    setItems([...items, ex.kind === "time" ? { ex: ex.id, sets: 3, sec: 30, rest: 45 } : { ex: ex.id, sets: 3, reps: 10, rest: 60 }]);
    setPicking(false); setQ("");
  }
  function patch(k, p) { setItems(items.map((it, j) => (j === k ? { ...it, ...p } : it))); }
  function move(k, d) {
    const j = k + d; if (j < 0 || j >= items.length) return;
    const n = [...items]; [n[k], n[j]] = [n[j], n[k]]; setItems(n);
  }

  if (picking) {
    const list = idx.all.filter((e) => e.name.toLowerCase().includes(q.toLowerCase()));
    return (
      <div>
        <BackHeader title="Ajouter un exercice" onBack={() => setPicking(false)} />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher" style={{ ...inputStyle, fontFamily: "'Work Sans',sans-serif", marginBottom: 10 }} />
        {list.map((e) => (
          <button key={e.id} onClick={() => add(e)} style={rowBtn}>
            <span style={{ textAlign: "left" }}>{e.name}<span style={{ display: "block", fontSize: 11, color: C.inkSoft }}>{GROUPS[e.group]}{e.custom ? " · perso" : ""}</span></span>
            <Plus size={16} color={C.herb} />
          </button>
        ))}
      </div>
    );
  }

  return (
    <div>
      <BackHeader title={edit ? "Modifier ma séance" : "Ma séance"} onBack={onBack} />
      <Card>
        <Label>Nom de la séance</Label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex. Séance du midi" style={{ ...inputStyle, fontFamily: "'Work Sans',sans-serif" }} />
      </Card>
      {items.map((it, k) => {
        const ex = idx.byId[it.ex];
        if (!ex) return null;
        return (
          <Card key={k} style={{ padding: 13 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <span style={{ flex: 1, fontWeight: 600, fontSize: 13.5 }}>{k + 1}. {ex.name}</span>
              <button onClick={() => move(k, -1)} style={iconBtn}><ArrowUp size={14} /></button>
              <button onClick={() => move(k, 1)} style={iconBtn}><ArrowDown size={14} /></button>
              <button onClick={() => setItems(items.filter((_, j) => j !== k))} style={{ ...iconBtn, color: C.berry }}><Trash2 size={14} /></button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              <MiniNum label="Séries" value={it.sets} onChange={(v) => patch(k, { sets: Math.max(1, v) })} />
              {ex.kind === "time"
                ? <MiniNum label="Secondes" value={it.sec} onChange={(v) => patch(k, { sec: Math.max(5, v) })} />
                : <MiniNum label="Reps" value={it.reps} onChange={(v) => patch(k, { reps: Math.max(1, v) })} />}
              <MiniNum label="Repos (s)" value={it.rest} onChange={(v) => patch(k, { rest: Math.max(0, v) })} />
            </div>
          </Card>
        );
      })}
      <Btn kind="soft" onClick={() => setPicking(true)} style={{ width: "100%", marginBottom: 12 }}><Plus size={15} /> Ajouter un exercice</Btn>
      <Btn disabled={!name.trim() || !items.length} onClick={() => onSave({ id: edit?.id || "seance_" + uid(), name: name.trim(), items })} style={{ width: "100%" }}>
        <Check size={15} /> Enregistrer la séance
      </Btn>
      {edit && <Btn kind="danger" onClick={() => onDelete(edit.id)} style={{ width: "100%", marginTop: 8 }}><Trash2 size={15} /> Supprimer</Btn>}
    </div>
  );
}

/* ================================================================== */
/* HISTORIQUE                                                          */
/* ================================================================== */
function HistoryView({ workouts, idx, onBack, onDelete }) {
  const [tab, setTab] = useState("seances");
  const sorted = [...workouts].sort((a, b) => (b.date + (b.startedAt || 0)).localeCompare(a.date + (a.startedAt || 0)));
  const records = useMemo(() => {
    const r = {};
    workouts.forEach((w) => (w.exercises || []).forEach((e) => e.sets.forEach((st) => {
      const cur = r[e.exId] || { name: e.name, best: 0, unit: "", date: w.date };
      const score = st.kg ? st.kg : st.sec ? st.sec : st.reps || 0;
      const unit = st.kg ? "kg" : st.sec ? "s" : "reps";
      if (score > cur.best) r[e.exId] = { name: e.name, best: score, unit, extra: st.kg ? `× ${st.reps}` : "", date: w.date };
    })));
    return Object.values(r).sort((a, b) => a.name.localeCompare(b.name));
  }, [workouts]);
  const [confirm, setConfirm] = useState(null);

  return (
    <div>
      <BackHeader title="Historique" onBack={onBack} />
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        <Chip active={tab === "seances"} onClick={() => setTab("seances")}>Séances</Chip>
        <Chip active={tab === "records"} onClick={() => setTab("records")}>Records</Chip>
      </div>
      {tab === "seances" ? (
        sorted.length === 0 ? <p style={hint}>Aucune séance pour l'instant.</p> : sorted.map((w) => (
          <Card key={w.id} style={{ padding: 13 }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 11.5, color: C.inkSoft }}>{frDate(w.date)}</p>
                <p style={{ margin: "2px 0", fontWeight: 600, fontSize: 13.5 }}>{w.title}</p>
                <p style={{ margin: 0, fontFamily: MONO, fontSize: 11.5, color: C.inkSoft }}>{Math.round(w.durationMin || 0)} min · {w.kcal} kcal</p>
              </div>
              {confirm === w.id
                ? <Btn kind="danger" onClick={() => { onDelete(w.id); setConfirm(null); }} style={{ padding: "6px 10px", fontSize: 12 }}>Supprimer ?</Btn>
                : <button onClick={() => setConfirm(w.id)} style={{ ...iconBtn, color: C.berry }}><Trash2 size={15} /></button>}
            </div>
            {(w.exercises || []).length > 0 && (
              <div style={{ marginTop: 8, fontSize: 12, color: C.inkSoft, lineHeight: 1.6 }}>
                {w.exercises.map((e) => (
                  <div key={e.exId}>{e.name} : {e.sets.map((x) => x.sec ? `${x.sec}s` : `${x.reps}${x.kg ? `×${x.kg}kg` : ""}`).join(" · ")}</div>
                ))}
              </div>
            )}
          </Card>
        ))
      ) : (
        records.length === 0 ? <p style={hint}>Les records apparaîtront après tes premières séances guidées.</p> : records.map((r) => (
          <div key={r.name} style={{ ...rowBtn, cursor: "default" }}>
            <span>{r.name}</span>
            <span style={{ fontFamily: MONO, fontSize: 12.5 }}>{r.best} {r.unit} {r.extra}</span>
          </div>
        ))
      )}
    </div>
  );
}

/* ================================================================== */
/* PETITS ÉLÉMENTS                                                     */
/* ================================================================== */
const hint = { fontSize: 11.5, color: C.inkSoft, lineHeight: 1.5, margin: "8px 0 0" };
const iconBtn = { background: "none", border: "none", padding: 6, color: C.herb, display: "inline-flex", alignItems: "center" };
const rowBtn = {
  width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10,
  background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: "12px 13px", marginBottom: 7,
  fontSize: 13.5, color: C.ink, textAlign: "left",
};

export function Label({ children, style }) {
  return <p style={{ margin: "0 0 6px", fontSize: 12, color: C.inkSoft, fontWeight: 600, ...style }}>{children}</p>;
}
export function Stepper({ value, onChange, min = 0, max = 999, step = 1, unit }) {
  const set = (v) => onChange(Math.min(max, Math.max(min, Math.round(v * 100) / 100)));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <button onClick={() => set(value - step)} style={stepBtn}><Minus size={16} /></button>
      <NumInput min={min} max={max} value={value} onChange={(v) => onChange(v)} style={{ ...inputStyle, textAlign: "center", flex: 1, fontSize: 18, fontWeight: 600 }} />
      <button onClick={() => set(value + step)} style={stepBtn}><Plus size={16} /></button>
      {unit && <span style={{ fontSize: 12, color: C.inkSoft, minWidth: 28 }}>{unit}</span>}
    </div>
  );
}
const stepBtn = { width: 42, height: 42, borderRadius: 11, border: "none", background: C.sage, color: C.herb, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 };

export function Toggle({ checked, onChange, label, sub }) {
  return (
    <div onClick={() => onChange(!checked)} style={{ display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer", padding: "4px 0" }}>
      <div style={{ width: 42, height: 24, borderRadius: 999, background: checked ? C.herb : C.line, position: "relative", flexShrink: 0, transition: "background .2s", marginTop: 1 }}>
        <div style={{ width: 18, height: 18, borderRadius: 999, background: "#fff", position: "absolute", top: 3, left: checked ? 21 : 3, transition: "left .2s" }} />
      </div>
      <div>
        <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600 }}>{label}</p>
        {sub && <p style={{ margin: "2px 0 0", fontSize: 11.5, color: C.inkSoft, lineHeight: 1.45 }}>{sub}</p>}
      </div>
    </div>
  );
}
function MiniNum({ label, value, onChange }) {
  return (
    <div>
      <span style={{ fontSize: 10.5, color: C.inkSoft }}>{label}</span>
      <NumInput decimals={false} value={value} onChange={(v) => onChange(v)} style={{ ...inputStyle, padding: "7px 8px", fontSize: 13, marginTop: 2 }} />
    </div>
  );
}
function Stat({ label, value }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: 14, textAlign: "center" }}>
      <p style={{ margin: 0, fontSize: 11.5, color: C.inkSoft }}>{label}</p>
      <p style={{ margin: "4px 0 0", fontFamily: MONO, fontSize: 20, fontWeight: 600 }}>{value}</p>
    </div>
  );
}
