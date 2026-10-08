// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Les auteurs de NutriMaison
import React, { useState, useMemo } from "react";
import { Scale, Ruler, TrendingDown, TrendingUp, Minus as MinusIcon, Trash2, Check, Info, Gauge } from "lucide-react";
import {
  C, MONO, SERIF, Card, Btn, Chip, Tag, SectionTitle, BackHeader, inputStyle,
  todayISO, addDays, daysBetween, frShort, frDate, round, dayKcal, bmrMifflin, bmi,
} from "./shared.jsx";
import { Label, Toggle } from "./Sport.jsx";

/* ================================================================== */
/* CALCULS                                                             */
/* ================================================================== */
export const KCAL_PER_KG = 7700; // énergie approximative d'1 kg de masse corporelle perdue/prise

/** Masse grasse — méthode US Navy (mesures en cm). Homme : cou + taille au nombril. Femme : cou + taille + hanches. */
export function navyBodyFat({ sexe, taille: heightCm }, m) {
  const neck = Number(m.cou), waist = Number(m.taille), hip = Number(m.hanches);
  if (!heightCm || !neck || !waist) return null;
  let v;
  if (sexe === "homme") {
    if (waist - neck <= 0) return null;
    v = 495 / (1.0324 - 0.19077 * Math.log10(waist - neck) + 0.15456 * Math.log10(heightCm)) - 450;
  } else {
    if (!hip || waist + hip - neck <= 0) return null;
    v = 495 / (1.29579 - 0.35004 * Math.log10(waist + hip - neck) + 0.221 * Math.log10(heightCm)) - 450;
  }
  return isFinite(v) ? Math.max(2, Math.min(70, v)) : null;
}

/** Masse grasse — méthode Armée US 2023 (un seul tour de taille au nombril + poids). */
export function armyBodyFat({ sexe }, m, kg) {
  const waist = Number(m.taille);
  if (!waist || !kg) return null;
  const lb = kg * 2.20462, inch = waist / 2.54;
  const v = sexe === "homme" ? -26.97 - 0.12 * lb + 1.99 * inch : -9.15 - 0.015 * lb + 1.27 * inch;
  return isFinite(v) ? Math.max(2, Math.min(70, v)) : null;
}

export function bodyFatCategory(sexe, bf) {
  const t = sexe === "homme" ? [6, 14, 18, 25] : [14, 21, 25, 32];
  if (bf < t[0]) return ["Très bas", C.ochre];
  if (bf < t[1]) return ["Athlétique", C.olive];
  if (bf < t[2]) return ["En forme", C.herb];
  if (bf < t[3]) return ["Moyenne", C.ochre];
  return ["Élevée", C.berry];
}

function weightNear(weights, date) {
  if (weights[date]) return weights[date];
  const dates = Object.keys(weights).sort();
  let best = null, bestD = 1e9;
  dates.forEach((d) => { const dd = Math.abs(daysBetween(d, date)); if (dd < bestD) { bestD = dd; best = weights[d]; } });
  return bestD <= 14 ? best : null;
}

/** Dernière mesure de masse grasse disponible (méthode préférée de l'utilisateur). */
export function latestBodyFat(measures, weights, info, method = "navy") {
  const sorted = [...(measures || [])].sort((a, b) => b.date.localeCompare(a.date));
  for (const m of sorted) {
    const kg = weightNear(weights, m.date) || info.poids;
    const bf = method === "army" ? armyBodyFat(info, m, kg) : navyBodyFat(info, m);
    if (bf != null) return { bf, date: m.date, kg };
  }
  return null;
}

/** Tendance lissée (moyenne mobile exponentielle, comme « The Hacker's Diet ») jour par jour. */
function trendSeries(weights) {
  const dates = Object.keys(weights).sort();
  if (!dates.length) return [];
  const out = [];
  let t = weights[dates[0]];
  for (let d = dates[0]; d <= dates[dates.length - 1]; d = addDays(d, 1)) {
    const w = weights[d];
    if (w) t = t + 0.15 * (w - t);
    out.push({ date: d, weight: w || null, trend: t });
  }
  return out;
}

/** Pente (kg/jour) par moindres carrés sur une fenêtre. */
function slope(points) {
  if (points.length < 2) return 0;
  const n = points.length;
  const mx = points.reduce((a, p) => a + p.x, 0) / n;
  const my = points.reduce((a, p) => a + p.y, 0) / n;
  let num = 0, den = 0;
  points.forEach((p) => { num += (p.x - mx) * (p.y - my); den += (p.x - mx) ** 2; });
  return den ? num / den : 0;
}

/**
 * Besoin réel estimé à partir de TES données :
 * besoin = apport moyen noté − (variation de poids × 7700) / jours
 * Il corrige automatiquement les oublis réguliers de saisie et les erreurs de formule.
 */
function adaptiveTDEE(weights, days, windowDays = 28) {
  const end = todayISO();
  const start = addDays(end, -(windowDays - 1));
  const pts = Object.entries(weights)
    .filter(([d]) => d >= start && d <= end)
    .map(([d, w]) => ({ x: daysBetween(start, d), y: w, d }))
    .sort((a, b) => a.x - b.x);
  if (pts.length < 6) return { ok: false, reason: `Il faut au moins 6 pesées sur les ${windowDays} derniers jours (tu en as ${pts.length}).`, weighIns: pts.length };
  const span = pts[pts.length - 1].x - pts[0].x;
  if (span < 13) return { ok: false, reason: "Il faut au moins 2 semaines entre ta première et ta dernière pesée de la période.", weighIns: pts.length };

  const from = pts[0].d;
  const logged = [];
  for (let d = from; d <= end; d = addDays(d, 1)) {
    const k = dayKcal(days[d]);
    if (k >= 600) logged.push(k); // journée considérée comme renseignée
  }
  const totalDays = daysBetween(from, end) + 1;
  if (logged.length < Math.max(10, totalDays * 0.6)) {
    return { ok: false, reason: `Il faut que tes repas soient notés au moins 6 jours sur 10 (${logged.length} jours notés sur ${totalDays}).`, weighIns: pts.length };
  }
  const avgIntake = logged.reduce((a, b) => a + b, 0) / logged.length;
  const kgPerDay = slope(pts);
  const tdee = avgIntake - kgPerDay * KCAL_PER_KG;
  const confidence = logged.length / totalDays > 0.85 && pts.length >= 12 && span >= 20 ? "bonne" : "moyenne";
  return { ok: true, tdee: Math.round(tdee), avgIntake: Math.round(avgIntake), kgPerWeek: kgPerDay * 7, loggedDays: logged.length, totalDays, weighIns: pts.length, confidence };
}

export function useWeightStats(weights, days) {
  return useMemo(() => {
    const series = trendSeries(weights);
    const last = series[series.length - 1];
    const at = (n) => { const d = addDays(last?.date || todayISO(), -n); return series.find((p) => p.date === d); };
    const p7 = at(7), p30 = at(30);
    return {
      series,
      latestTrend: last ? last.trend : null,
      latestWeight: (() => { const ds = Object.keys(weights).sort(); return ds.length ? weights[ds[ds.length - 1]] : null; })(),
      change7: last && p7 ? last.trend - p7.trend : null,
      change30: last && p30 ? last.trend - p30.trend : null,
      adaptive: adaptiveTDEE(weights, days),
    };
  }, [weights, days]);
}

/* ================================================================== */
/* VUE « CORPS »                                                       */
/* ================================================================== */
export function WeightView({ weights, onSaveWeights, measures, onSaveMeasures, personalInfo, onSavePersonalInfo, days, goals, onApplyKcal, onBack, initialTab }) {
  const [tab, setTab] = useState(initialTab || "poids");
  const stats = useWeightStats(weights, days);
  return (
    <div style={{ padding: "28px 20px 8px" }}>
      {onBack ? <BackHeader title="Corps & progrès" onBack={onBack} /> : <SectionTitle>Corps & progrès</SectionTitle>}
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        <Chip active={tab === "poids"} onClick={() => setTab("poids")}>Poids</Chip>
        <Chip active={tab === "mesures"} onClick={() => setTab("mesures")}>Masse grasse</Chip>
        <Chip active={tab === "besoin"} onClick={() => setTab("besoin")}>Besoin réel</Chip>
      </div>
      {tab === "poids" && <WeightTab weights={weights} onSave={onSaveWeights} stats={stats} personalInfo={personalInfo} onSavePersonalInfo={onSavePersonalInfo} />}
      {tab === "mesures" && <MeasuresTab measures={measures} onSave={onSaveMeasures} weights={weights} info={personalInfo} onSavePersonalInfo={onSavePersonalInfo} />}
      {tab === "besoin" && <AdaptiveTab stats={stats} goals={goals} personalInfo={personalInfo} onApplyKcal={onApplyKcal} />}
    </div>
  );
}

/* ---------------- Poids ---------------- */
function WeightTab({ weights, onSave, stats, personalInfo, onSavePersonalInfo }) {
  const [date, setDate] = useState(todayISO());
  const [val, setVal] = useState(weights[todayISO()] || stats.latestWeight || personalInfo.poids || "");
  const [range, setRange] = useState(90);
  const [saved, setSaved] = useState(false);
  const entries = Object.entries(weights).sort((a, b) => b[0].localeCompare(a[0]));

  function save() {
    const kg = Number(String(val).replace(",", "."));
    if (!kg || kg < 25 || kg > 350) return;
    const next = { ...weights, [date]: round(kg) };
    onSave(next);
    // le poids du profil suit la dernière pesée (sert aux calculs de calories)
    const latest = Object.keys(next).sort().pop();
    if (latest === date) onSavePersonalInfo({ ...personalInfo, poids: round(kg) });
    setSaved(true); setTimeout(() => setSaved(false), 1500);
  }

  const imc = bmi(stats.latestWeight || personalInfo.poids, personalInfo.taille);
  return (
    <div>
      <Card>
        <Label>Pesée</Label>
        <div style={{ display: "flex", gap: 8 }}>
          <input type="number" inputMode="decimal" step="0.1" value={val} onChange={(e) => setVal(e.target.value)} style={{ ...inputStyle, flex: 1, fontSize: 18, fontWeight: 600 }} />
          <input type="date" value={date} onChange={(e) => { setDate(e.target.value); if (weights[e.target.value]) setVal(weights[e.target.value]); }} style={{ ...inputStyle, width: 150, fontSize: 13 }} />
        </div>
        <Btn onClick={save} style={{ width: "100%", marginTop: 10 }}>{saved ? "Enregistré ✓" : <><Check size={15} /> Enregistrer</>}</Btn>
        <p style={hint}>Pèse-toi le matin, après les toilettes, avant de manger. Idéalement tous les jours : c'est la moyenne qui compte, pas la pesée du jour.</p>
      </Card>

      {stats.series.length > 0 && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
            <MiniStat label="Tendance" value={stats.latestTrend ? `${round(stats.latestTrend)} kg` : "–"} />
            <MiniStat label="7 jours" value={fmtDelta(stats.change7)} color={deltaColor(stats.change7)} />
            <MiniStat label="30 jours" value={fmtDelta(stats.change30)} color={deltaColor(stats.change30)} />
          </div>
          <Card style={{ padding: 12 }}>
            <div style={{ display: "flex", gap: 6, marginBottom: 8, justifyContent: "flex-end" }}>
              {[30, 90, 365].map((r) => <Chip key={r} active={range === r} onClick={() => setRange(r)} style={{ padding: "4px 10px", fontSize: 11.5 }}>{r === 365 ? "1 an" : `${r} j`}</Chip>)}
            </div>
            <WeightChart series={stats.series.slice(-range)} />
            <div style={{ display: "flex", gap: 14, fontSize: 11, color: C.inkSoft, marginTop: 6 }}>
              <span><span style={{ color: C.inkSoft }}>●</span> pesées</span>
              <span><span style={{ color: C.herb, fontWeight: 700 }}>—</span> tendance lissée</span>
            </div>
          </Card>
          <Card style={{ background: C.sage, border: "none", padding: 13 }}>
            <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.55, color: C.herb }}>
              La balance varie de 1 à 2 kg d'un jour à l'autre (eau, sel, digestion). En reprenant le sport, les muscles stockent aussi de l'eau les premières semaines : la tendance et le tour de taille sont plus fiables que la pesée du jour.
            </p>
          </Card>
        </>
      )}

      {imc > 0 && (
        <p style={{ ...hint, marginBottom: 12 }}>IMC actuel : <strong style={{ fontFamily: MONO }}>{round(imc)}</strong> (indicateur grossier qui ne distingue pas muscle et graisse — le % de masse grasse est plus parlant).</p>
      )}

      {entries.length > 0 && <Label>Historique</Label>}
      {entries.slice(0, 60).map(([d, w]) => (
        <div key={d} style={row}>
          <span style={{ fontSize: 13 }}>{frDate(d)}</span>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontFamily: MONO, fontSize: 13 }}>{w} kg</span>
            <button onClick={() => { const n = { ...weights }; delete n[d]; onSave(n); }} style={iconBtn}><Trash2 size={14} /></button>
          </span>
        </div>
      ))}
    </div>
  );
}

function WeightChart({ series }) {
  const W = 340, H = 170, P = { l: 34, r: 8, t: 8, b: 20 };
  const vals = series.flatMap((p) => [p.weight, p.trend]).filter(Boolean);
  if (!vals.length) return null;
  let min = Math.min(...vals), max = Math.max(...vals);
  if (max - min < 2) { const m = (max + min) / 2; min = m - 1; max = m + 1; }
  const pad = (max - min) * 0.1; min -= pad; max += pad;
  const x = (i) => P.l + (series.length <= 1 ? 0 : (i / (series.length - 1)) * (W - P.l - P.r));
  const y = (v) => P.t + (1 - (v - min) / (max - min)) * (H - P.t - P.b);
  const path = series.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.trend).toFixed(1)}`).join(" ");
  const ticks = [min + pad, (min + max) / 2, max - pad];
  const labelIdx = series.length > 1 ? [0, Math.floor(series.length / 2), series.length - 1] : [0];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Courbe de poids">
      {ticks.map((t, k) => (
        <g key={k}>
          <line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} stroke={C.line} strokeDasharray="3 4" />
          <text x={P.l - 5} y={y(t) + 3.5} textAnchor="end" fontSize="9.5" fill={C.inkSoft} fontFamily="IBM Plex Mono, monospace">{round(t)}</text>
        </g>
      ))}
      {series.map((p, i) => p.weight ? <circle key={i} cx={x(i)} cy={y(p.weight)} r="2.4" fill={C.inkSoft} opacity="0.55" /> : null)}
      <path d={path} fill="none" stroke={C.herb} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
      {labelIdx.map((i) => (
        <text key={i} x={x(i)} y={H - 5} textAnchor={i === 0 ? "start" : i === series.length - 1 ? "end" : "middle"} fontSize="9.5" fill={C.inkSoft}>{frShort(series[i].date)}</text>
      ))}
    </svg>
  );
}

/* ---------------- Mensurations + masse grasse ---------------- */
function MeasuresTab({ measures, onSave, weights, info, onSavePersonalInfo }) {
  const femme = info.sexe !== "homme";
  const lastM = [...(measures || [])].sort((a, b) => b.date.localeCompare(a.date))[0];
  const [m, setM] = useState({ date: todayISO(), cou: lastM?.cou || "", taille: "", hanches: lastM?.hanches || "", poitrine: "", bras: "", cuisse: "" });
  const [method, setMethod] = useState(info.bfMethod || "navy");
  const [showHow, setShowHow] = useState(false);
  const kg = weightNear(weights, m.date) || info.poids;
  const navy = navyBodyFat(info, m);
  const army = armyBodyFat(info, m, kg);
  const chosen = method === "army" ? army : navy;

  function save() {
    const entry = { ...m };
    ["cou", "taille", "hanches", "poitrine", "bras", "cuisse"].forEach((k) => { entry[k] = entry[k] === "" ? null : Number(String(entry[k]).replace(",", ".")); });
    const others = (measures || []).filter((x) => x.date !== entry.date);
    onSave([...others, entry]);
    if (method !== info.bfMethod) onSavePersonalInfo({ ...info, bfMethod: method });
  }

  const fields = [
    ["cou", "Tour de cou", true],
    ["taille", femme ? "Tour de taille (au plus fin)" : "Tour de taille (au nombril)", true],
    ...(femme ? [["hanches", "Tour de hanches (au plus large)", true]] : []),
    ["poitrine", "Tour de poitrine", false],
    ["bras", "Tour de bras", false],
    ["cuisse", "Tour de cuisse", false],
  ];
  const history = [...(measures || [])].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div>
      <Card>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <Label style={{ margin: 0 }}>Mensurations (cm)</Label>
          <input type="date" value={m.date} onChange={(e) => setM({ ...m, date: e.target.value })} style={{ ...inputStyle, width: 150, fontSize: 12.5, padding: "6px 8px" }} />
        </div>
        {fields.map(([k, l, req]) => (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ flex: 1, fontSize: 13 }}>{l}{req && <span style={{ color: C.berry }}> *</span>}</span>
            <input type="number" inputMode="decimal" step="0.5" value={m[k] ?? ""} onChange={(e) => setM({ ...m, [k]: e.target.value })} style={{ ...inputStyle, width: 96, textAlign: "right" }} />
          </div>
        ))}
        <p style={hint}>* nécessaires au calcul. Taille utilisée : {info.taille} cm, poids : {kg} kg (modifiables dans Profil / Poids).</p>
        <button onClick={() => setShowHow(!showHow)} style={{ ...iconBtn, padding: "8px 0 0", fontSize: 12.5, fontWeight: 600 }}><Info size={14} />&nbsp;Comment bien mesurer ?</button>
        {showHow && (
          <div style={{ fontSize: 12.5, lineHeight: 1.6, color: C.inkSoft, marginTop: 6 }}>
            Mètre ruban souple, bien à plat sur la peau sans serrer, en fin d'expiration normale, le matin. <strong>Cou</strong> : juste sous la pomme d'Adam, ruban légèrement incliné vers l'avant. <strong>Taille</strong> : {femme ? "au point le plus fin du ventre (Navy) ; pour la méthode Armée, mesure au nombril" : "à hauteur du nombril, ventre relâché (ne le rentre pas)"}. {femme && <><strong>Hanches</strong> : au point le plus large des fesses, pieds joints. </>}Fais 2-3 mesures et garde la moyenne. Toujours dans les mêmes conditions pour comparer d'une semaine à l'autre.
          </div>
        )}
      </Card>

      <Card>
        <Label>Méthode</Label>
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          <Chip active={method === "navy"} onClick={() => setMethod("navy")} style={{ flex: 1 }}>US Navy</Chip>
          <Chip active={method === "army"} onClick={() => setMethod("army")} style={{ flex: 1 }}>Armée US 2023</Chip>
        </div>
        <p style={{ ...hint, marginTop: 0, marginBottom: 12 }}>
          {method === "navy"
            ? (femme ? "Cou, taille et hanches + ta taille. La plus utilisée." : "Cou et taille + ta taille. La plus utilisée.")
            : "Méthode adoptée par l'Armée américaine en 2023 : un seul tour de taille au nombril + le poids. Plus simple, souvent plus juste pour les personnes musclées du cou."}
        </p>
        {chosen != null ? (
          <BodyFatResult bf={chosen} kg={kg} sexe={info.sexe} other={method === "army" ? navy : army} otherLabel={method === "army" ? "Navy" : "Armée"} />
        ) : (
          <p style={{ margin: 0, fontSize: 13, color: C.inkSoft }}>Renseigne les mesures marquées * pour voir ton résultat.</p>
        )}
      </Card>
      <Btn onClick={save} disabled={!m.taille} style={{ width: "100%", marginBottom: 16 }}><Check size={15} /> Enregistrer ces mesures</Btn>

      {history.length > 0 && <Label>Historique</Label>}
      {history.map((h) => {
        const hk = weightNear(weights, h.date) || info.poids;
        const bf = method === "army" ? armyBodyFat(info, h, hk) : navyBodyFat(info, h);
        return (
          <div key={h.date} style={{ ...row, alignItems: "flex-start" }}>
            <div>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{frDate(h.date)}</span>
              <p style={{ margin: "2px 0 0", fontSize: 11.5, color: C.inkSoft, fontFamily: MONO }}>
                {[["taille", "T"], ["cou", "C"], ["hanches", "H"], ["poitrine", "P"], ["bras", "B"], ["cuisse", "Cu"]].filter(([k]) => h[k]).map(([k, l]) => `${l} ${h[k]}`).join(" · ")}
              </p>
            </div>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {bf != null && <Tag color={C.herb} bg={C.sage}>{round(bf)} %</Tag>}
              <button onClick={() => onSave(measures.filter((x) => x.date !== h.date))} style={iconBtn}><Trash2 size={14} /></button>
            </span>
          </div>
        );
      })}
    </div>
  );
}

function BodyFatResult({ bf, kg, sexe, other, otherLabel }) {
  const [cat, color] = bodyFatCategory(sexe, bf);
  const fatKg = (kg * bf) / 100;
  const lean = kg - fatKg;
  const katch = 370 + 21.6 * lean;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10 }}>
        <span style={{ fontFamily: MONO, fontSize: 36, fontWeight: 600 }}>{round(bf)}%</span>
        <Tag color="#fff" bg={color}>{cat}</Tag>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <MiniStat label="Masse grasse" value={`${round(fatKg)} kg`} />
        <MiniStat label="Masse maigre" value={`${round(lean)} kg`} />
      </div>
      <p style={{ ...hint, marginTop: 10 }}>
        Métabolisme de base d'après ta masse maigre (Katch-McArdle) : <strong style={{ fontFamily: MONO }}>{Math.round(katch)} kcal</strong>. Il est utilisé automatiquement dans le calcul du Profil.
        {other != null && <> Méthode {otherLabel} : {round(other)} %.</>} Précision de ces formules : environ ± 3 à 4 points. Suis surtout l'évolution.
      </p>
    </div>
  );
}

/* ---------------- Besoin réel ---------------- */
function AdaptiveTab({ stats, goals, personalInfo, onApplyKcal }) {
  const a = stats.adaptive;
  const [deficit, setDeficit] = useState(400);
  const [applied, setApplied] = useState(false);
  const floor = Math.max(personalInfo.sexe === "homme" ? 1500 : 1200, Math.round(bmrMifflin(personalInfo) * 0.95));
  const proposal = a.ok ? Math.max(floor, a.tdee - deficit) : null;

  return (
    <div>
      <Card style={{ background: C.sage, border: "none" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
          <Gauge size={17} color={C.herb} />
          <span style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 15.5, color: C.herb }}>Comment ça marche</span>
        </div>
        <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6, color: C.herbLight }}>
          Les formules donnent une estimation qui peut se tromper de 300 kcal ou plus. Ici l'app compare <strong>ce que tu notes</strong> à <strong>l'évolution réelle de ton poids</strong> sur 4 semaines. Si tu reprends du poids en mangeant « ton objectif », c'est que ton vrai besoin (ou ce qui est réellement mangé) est plus bas : ce calcul le corrige, y compris les petits oublis réguliers de saisie (huile, sauces, boissons, grignotage).
        </p>
      </Card>

      {!a.ok ? (
        <Card>
          <p style={{ margin: "0 0 6px", fontWeight: 600 }}>Pas encore assez de données</p>
          <p style={{ margin: 0, fontSize: 13, color: C.inkSoft, lineHeight: 1.55 }}>{a.reason}</p>
          <p style={hint}>Continue à te peser (idéalement chaque matin) et à noter tous tes repas, même les jours d'écart : c'est indispensable pour que le résultat soit juste.</p>
        </Card>
      ) : (
        <>
          <Card>
            <p style={{ margin: 0, fontSize: 12, color: C.inkSoft }}>Ton besoin réel estimé</p>
            <p style={{ margin: "2px 0 8px", fontFamily: MONO, fontSize: 34, fontWeight: 600 }}>{a.tdee} <span style={{ fontSize: 14, color: C.inkSoft }}>kcal / jour</span></p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <Tag color={C.herb} bg={C.sage}>Apport moyen noté {a.avgIntake} kcal</Tag>
              <Tag color={a.kgPerWeek > 0.05 ? C.berry : C.olive} bg={a.kgPerWeek > 0.05 ? C.berryLight : C.oliveLight}>
                {a.kgPerWeek > 0 ? "+" : ""}{round(a.kgPerWeek)} kg / semaine
              </Tag>
              <Tag color={C.inkSoft} bg={C.paperDark}>Fiabilité {a.confidence}</Tag>
            </div>
            <p style={hint}>Basé sur {a.weighIns} pesées et {a.loggedDays} jours de repas notés sur {a.totalDays}. Ton objectif actuel : {goals.kcal} kcal.</p>
          </Card>

          <Card>
            <Label>Rythme de perte souhaité</Label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
              {[[250, "Doux ≈ 0,25 kg/sem"], [400, "Modéré ≈ 0,35 kg/sem"], [550, "Soutenu ≈ 0,5 kg/sem"], [0, "Stabiliser"]].map(([d, l]) => (
                <Chip key={d} active={deficit === d} onClick={() => setDeficit(d)}>{l}</Chip>
              ))}
            </div>
            <p style={{ margin: "0 0 10px", fontSize: 13.5 }}>Nouvel objectif proposé : <strong style={{ fontFamily: MONO, fontSize: 16 }}>{proposal} kcal</strong></p>
            {proposal === floor && a.tdee - deficit < floor && (
              <p style={{ ...hint, marginTop: 0, marginBottom: 10, color: C.berry }}>Plafonné à {floor} kcal : descendre plus bas n'est pas conseillé sans suivi médical. Mieux vaut augmenter un peu l'activité.</p>
            )}
            <Btn onClick={() => { onApplyKcal(proposal); setApplied(true); }} style={{ width: "100%" }}>{applied ? "Objectif mis à jour ✓" : "Appliquer à mon objectif"}</Btn>
            <p style={hint}>Les protéines restent inchangées, glucides et lipides sont ajustés. Refais le point toutes les 2 à 4 semaines.</p>
          </Card>
        </>
      )}
    </div>
  );
}

/* ---------------- éléments ---------------- */
function fmtDelta(v) { return v == null ? "–" : `${v > 0 ? "+" : ""}${round(v)} kg`; }
function deltaColor(v) { return v == null ? C.ink : v > 0.15 ? C.berry : v < -0.15 ? C.olive : C.ink; }
function MiniStat({ label, value, color }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: "10px 8px", textAlign: "center" }}>
      <p style={{ margin: 0, fontSize: 11, color: C.inkSoft }}>{label}</p>
      <p style={{ margin: "3px 0 0", fontFamily: MONO, fontSize: 15, fontWeight: 600, color: color || C.ink }}>{value}</p>
    </div>
  );
}
const hint = { fontSize: 11.5, color: C.inkSoft, lineHeight: 1.5, margin: "8px 0 0" };
const iconBtn = { background: "none", border: "none", padding: 4, color: C.herb, display: "inline-flex", alignItems: "center" };
const row = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: C.card, border: `1px solid ${C.line}`, borderRadius: 11, marginBottom: 6 };
