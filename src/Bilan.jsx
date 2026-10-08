// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Les auteurs de NutriMaison
import React, { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { C, MONO, SERIF, Card, BackHeader, Tag, addDays, weekStart, todayISO, frShort, round, dayKcal } from "./shared.jsx";
import { KCAL_PER_KG } from "./Weight.jsx";

const DAYS = ["L", "M", "M", "J", "V", "S", "D"];

function dayTotals(day) {
  const t = { kcal: 0, prot: 0, carbs: 0, fat: 0 };
  Object.values(day?.meals || {}).forEach((l) => (l || []).forEach((e) => {
    t.kcal += Number(e.kcal) || 0; t.prot += Number(e.prot) || 0; t.carbs += Number(e.carbs) || 0; t.fat += Number(e.fat) || 0;
  }));
  return t;
}

/** Bilan de la semaine (lundi → dimanche) : est-ce que la stratégie marche ? */
export function BilanView({ days, goals, workouts, weightStats, onBack }) {
  const [ws, setWs] = useState(weekStart(todayISO()));
  const today = todayISO();
  const dates = Array.from({ length: 7 }, (_, i) => addDays(ws, i));

  const data = useMemo(() => {
    const perDay = dates.map((d) => {
      const day = days[d];
      const t = dayTotals(day);
      // la journée en cours n'est pas comptée dans les moyennes (elle est encore incomplète)
      return { d, ...t, logged: dayKcal(day) >= 600 && d < today, water: day?.water || 0, steps: day?.steps ?? null, future: d >= today };
    });
    const logged = perDay.filter((x) => x.logged);
    const avg = (k) => (logged.length ? logged.reduce((a, x) => a + x[k], 0) / logged.length : null);
    const stepsDays = perDay.filter((x) => x.steps != null);
    const wk = (workouts || []).filter((w) => w.date >= dates[0] && w.date <= dates[6]);
    // tendance du poids : début (veille du lundi) → fin de semaine (ou aujourd'hui)
    const series = weightStats?.series || [];
    const at = (d) => { let best = null; series.forEach((p) => { if (p.date <= d) best = p; }); return best; };
    const endD = dates[6] < today ? dates[6] : today;
    const tStart = at(addDays(dates[0], -1)), tEnd = at(endD);
    const weightChange = tStart && tEnd && tEnd.date > tStart.date ? tEnd.trend - tStart.trend : null;
    return {
      perDay, loggedDays: logged.length, elapsed: perDay.filter((x) => !x.future).length,
      avgKcal: avg("kcal"), avgProt: avg("prot"), avgCarbs: avg("carbs"), avgFat: avg("fat"),
      avgWater: perDay.filter((x) => !x.future && x.water > 0).reduce((a, x, _, arr) => a + x.water / arr.length, 0),
      avgSteps: stepsDays.length ? stepsDays.reduce((a, x) => a + x.steps, 0) / stepsDays.length : null,
      sessions: wk.length, sportMin: wk.reduce((a, w) => a + (w.durationMin || 0), 0), sportKcal: wk.reduce((a, w) => a + (w.kcal || 0), 0),
      weightChange, tEnd,
    };
  }, [ws, days, workouts, weightStats, goals]);

  const ad = weightStats?.adaptive;
  const gap = data.avgKcal != null ? data.avgKcal - goals.kcal : null;
  const projected = data.avgKcal != null && ad?.ok ? ((data.avgKcal - ad.tdee) * 7) / KCAL_PER_KG : null;

  // graphique des calories par jour
  const W = 340, H = 150, P = { l: 8, r: 8, t: 14, b: 22 };
  const maxV = Math.max(goals.kcal * 1.3, ...data.perDay.map((x) => x.kcal));
  const bw = (W - P.l - P.r) / 7;
  const y = (v) => P.t + (1 - v / maxV) * (H - P.t - P.b);

  const verdict = (() => {
    if (!data.loggedDays) return "Aucun jour noté cette semaine.";
    const parts = [];
    if (gap != null) parts.push(gap > 50 ? `${Math.round(gap)} kcal au-dessus de ton objectif par jour noté` : gap < -50 ? `${Math.round(-gap)} kcal sous ton objectif par jour noté` : "Pile dans ton objectif");
    if (projected != null) parts.push(`à ce rythme ≈ ${projected > 0 ? "+" : ""}${round(projected)} kg/semaine (d'après ton besoin réel de ${ad.tdee} kcal)`);
    if (data.loggedDays < data.elapsed) parts.push(`${data.elapsed - data.loggedDays} jour(s) non noté(s) : le bilan est incomplet`);
    return parts.join(" · ");
  })();

  const isCurrent = ws === weekStart(today);
  return (
    <div style={{ padding: "28px 20px 8px" }}>
      <BackHeader title="Bilan de la semaine" onBack={onBack} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <button onClick={() => setWs(addDays(ws, -7))} style={navBtn}><ChevronLeft size={18} /></button>
        <span style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 15 }}>
          {isCurrent ? "Cette semaine" : `Semaine du ${frShort(dates[0])}`}
          <span style={{ display: "block", textAlign: "center", fontFamily: "'Work Sans',sans-serif", fontSize: 11.5, color: C.inkSoft, fontWeight: 400 }}>{frShort(dates[0])} → {frShort(dates[6])}</span>
        </span>
        <button onClick={() => !isCurrent && setWs(addDays(ws, 7))} style={{ ...navBtn, opacity: isCurrent ? 0.3 : 1 }}><ChevronRight size={18} /></button>
      </div>

      <Card style={{ background: C.hero, border: "none", color: C.onHero }}>
        <p style={{ margin: 0, fontSize: 11.5, color: "#BFD3C6", textTransform: "uppercase", letterSpacing: 0.6 }}>En résumé</p>
        <p style={{ margin: "6px 0 0", fontSize: 14, lineHeight: 1.55 }}>{verdict}</p>
      </Card>

      <Card style={{ padding: 12 }}>
        <p style={{ margin: "0 0 6px", fontSize: 12, color: C.inkSoft, fontWeight: 600 }}>Calories par jour</p>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Calories par jour">
          <line x1={P.l} x2={W - P.r} y1={y(goals.kcal)} y2={y(goals.kcal)} stroke={C.ochre} strokeDasharray="4 4" strokeWidth="1.5" />
          <text x={W - P.r} y={y(goals.kcal) - 4} textAnchor="end" fontSize="9.5" fill={C.ochre} fontFamily="IBM Plex Mono, monospace">objectif {goals.kcal}</text>
          {data.perDay.map((x, i) => {
            const h = x.kcal ? (H - P.b) - y(x.kcal) : 0;
            const over = x.kcal > goals.kcal * 1.05;
            return (
              <g key={x.d}>
                {x.kcal > 0 && <rect x={P.l + i * bw + bw * 0.18} y={y(x.kcal)} width={bw * 0.64} height={Math.max(2, h)} rx="4"
                  fill={x.d === today ? C.sage : !x.logged ? C.line : over ? C.berry : C.herb} />}
                {x.kcal > 0 && <text x={P.l + i * bw + bw / 2} y={y(x.kcal) - 3} textAnchor="middle" fontSize="8.5" fill={C.inkSoft} fontFamily="IBM Plex Mono, monospace">{Math.round(x.kcal)}</text>}
                <text x={P.l + i * bw + bw / 2} y={H - 6} textAnchor="middle" fontSize="10" fill={x.d === today ? C.ink : C.inkSoft} fontWeight={x.d === today ? 700 : 400}>{DAYS[i]}</text>
              </g>
            );
          })}
        </svg>
        <p style={{ margin: "4px 0 0", fontSize: 10.5, color: C.inkSoft }}>Vert : dans l'objectif · rouge : au-dessus · gris : journée peu remplie (moins de 600 kcal) · vert clair : aujourd'hui, pas encore compté.</p>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
        <Stat label="Moyenne / jour noté" value={data.avgKcal != null ? `${Math.round(data.avgKcal)} kcal` : "–"} sub={`objectif ${goals.kcal}`} color={gap != null && gap > 50 ? C.berry : null} />
        <Stat label="Jours notés" value={`${data.loggedDays} / ${data.elapsed}`} sub={data.loggedDays >= data.elapsed ? "parfait 👌" : "note tout, même les écarts"} />
        <Stat label="Protéines / jour" value={data.avgProt != null ? `${Math.round(data.avgProt)} g` : "–"} sub={`objectif ${goals.prot} g`} color={data.avgProt != null && data.avgProt < goals.prot * 0.8 ? C.ochre : null} />
        <Stat label="Poids (tendance)" value={data.weightChange != null ? `${data.weightChange > 0 ? "+" : ""}${round(data.weightChange)} kg` : "–"}
          sub={data.tEnd ? `${round(data.tEnd.trend)} kg` : "pas de pesée"} color={data.weightChange != null ? (data.weightChange > 0.1 ? C.berry : data.weightChange < -0.1 ? C.olive : null) : null} />
        <Stat label="Sport" value={`${data.sessions} séance${data.sessions > 1 ? "s" : ""}`} sub={`${Math.round(data.sportMin)} min · ${Math.round(data.sportKcal)} kcal`} />
        <Stat label="Pas / jour" value={data.avgSteps != null ? Math.round(data.avgSteps).toLocaleString("fr-FR") : "–"} sub={data.avgWater ? `eau bue ${Math.round(data.avgWater / 100) / 10} L/j` : ""} />
      </div>

      {data.avgKcal != null && (
        <Card style={{ padding: 13 }}>
          <p style={{ margin: "0 0 6px", fontSize: 12, color: C.inkSoft, fontWeight: 600 }}>Répartition moyenne</p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <Tag color={C.berry} bg={C.berryLight}>P {Math.round(data.avgProt)} g</Tag>
            <Tag color={C.ochre} bg={C.ochreLight}>G {Math.round(data.avgCarbs)} g</Tag>
            <Tag color={C.olive} bg={C.oliveLight}>L {Math.round(data.avgFat)} g</Tag>
          </div>
        </Card>
      )}
      <p style={{ fontSize: 11, color: C.inkSoft, lineHeight: 1.5 }}>
        Les moyennes ne comptent que les jours terminés et réellement notés. Le poids suit la tendance lissée, pas la pesée du jour.
      </p>
    </div>
  );
}

function Stat({ label, value, sub, color }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: "12px 12px" }}>
      <p style={{ margin: 0, fontSize: 11, color: C.inkSoft }}>{label}</p>
      <p style={{ margin: "3px 0 1px", fontFamily: MONO, fontSize: 17, fontWeight: 600, color: color || C.ink }}>{value}</p>
      {sub && <p style={{ margin: 0, fontSize: 10.5, color: C.inkSoft }}>{sub}</p>}
    </div>
  );
}
const navBtn = { background: C.card, border: `1px solid ${C.line}`, borderRadius: 999, width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", color: C.herb };
