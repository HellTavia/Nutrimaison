// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Les auteurs de NutriMaison
/* ---------------------------------------------------------------- */
/* MÉTABOLISME DE BASE dans le temps                                 */
/*  - valeurs des applis (Withings, Fitbit…) lues dans Health Connect */
/*  - valeur calculée : avec la masse maigre (Katch-McArdle) quand    */
/*    la balance donne la composition, sinon d'après le poids         */
/*    (Mifflin-St Jeor)                                               */
/* ---------------------------------------------------------------- */
import React, { useMemo, useState } from "react";
import { C, MONO, Card, Chip, todayISO, addDays, frShort, frDate, round, bmrMifflin, loadJSON } from "./shared.jsx";
import { originLabel } from "./healthconnect.js";

const PALETTE = [C.herb, C.ochre, C.berry, C.olive];
const RANGES = [[7, "7 j"], [30, "30 j"], [90, "90 j"], [365, "1 an"]];
const fmt = (v) => (v == null ? "—" : Math.round(v).toLocaleString("fr-FR"));
const sign = (v) => (v > 0 ? "+" : v < 0 ? "−" : "±") + Math.abs(Math.round(v)).toLocaleString("fr-FR");

/** Toutes les séries jour par jour : { dates, series: [{ key, label, color, values: {date: kcal} }], comp } */
export function buildBmrSeries(info, weights, bmrHistory, bodyComp) {
  const origins = new Set();
  Object.values(bmrHistory || {}).forEach((o) => Object.keys(o).forEach((k) => origins.add(k)));
  // Withings en premier (balance = référence), puis les autres
  const list = [...origins].sort((a, b) => (/withings/i.test(b) - /withings/i.test(a)) || a.localeCompare(b));
  const series = list.map((o, i) => ({
    key: o, label: originLabel(o), color: PALETTE[i % PALETTE.length],
    values: Object.fromEntries(Object.entries(bmrHistory).filter(([, v]) => v[o] != null).map(([d, v]) => [d, v[o]])),
  }));
  // calculé : masse maigre (balance) reportée jusqu'à 30 jours, sinon formule au poids
  const comp = bodyComp || {};
  const compDates = Object.keys(comp).sort();
  const leanAt = (d, kg) => {
    for (let i = compDates.length - 1; i >= 0; i--) {
      const cd = compDates[i];
      if (cd > d) continue;
      if ((new Date(d) - new Date(cd)) / 86400000 > 30) break;
      const c = comp[cd];
      if (c.lean != null) return c.lean;
      if (c.fat != null && kg) return kg * (1 - c.fat / 100);
    }
    return null;
  };
  const calc = {}; let usedLean = false;
  Object.entries(weights || {}).forEach(([d, kg]) => {
    const lean = leanAt(d, kg);
    if (lean) { calc[d] = 370 + 21.6 * lean; usedLean = true; }
    else if (info?.taille && info?.age) calc[d] = bmrMifflin({ ...info, poids: kg });
  });
  // le calcul n'est affiché que si aucune appli ne donne son métabolisme (les formules s'écartent beaucoup des
  // balances pour les fortes corpulences, deux courbes à 500 kcal d'écart embrouilleraient plus qu'autre chose)
  if (!series.length && Object.keys(calc).length) {
    series.push({ key: "calc", label: usedLean ? "Calculé (masse maigre)" : "Calculé (poids)", color: C.inkSoft, dashed: true, values: calc });
  }
  return { series, comp };
}

function Chart({ dates, series, selected, onSelect }) {
  const W = 340, H = 180, P = { l: 40, r: 10, t: 10, b: 22 };
  const vals = series.flatMap((s) => dates.map((d) => s.values[d]).filter((v) => v != null));
  if (!vals.length) return <p style={{ fontSize: 12.5, color: C.inkSoft, margin: "20px 0", textAlign: "center" }}>Pas encore de valeur sur cette période.</p>;
  let min = Math.min(...vals), max = Math.max(...vals);
  if (max - min < 60) { const m = (max + min) / 2; min = m - 30; max = m + 30; }
  const pad = (max - min) * 0.12; min -= pad; max += pad;
  const n = dates.length;
  const x = (i) => P.l + (n <= 1 ? (W - P.l - P.r) / 2 : (i / (n - 1)) * (W - P.l - P.r));
  const y = (v) => P.t + (1 - (v - min) / (max - min)) * (H - P.t - P.b);
  const ticks = [min + pad, (min + max) / 2, max - pad];
  const labelIdx = n > 1 ? [0, Math.floor((n - 1) / 2), n - 1] : [0];
  const selIdx = dates.indexOf(selected);
  function click(e) {
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width * W;
    const i = Math.round(((px - P.l) / (W - P.l - P.r)) * (n - 1));
    const idx = Math.max(0, Math.min(n - 1, i));
    // jour le plus proche qui a une valeur
    let best = null;
    for (let k = 0; k < n; k++) {
      if (!series.some((s) => s.values[dates[k]] != null)) continue;
      if (best == null || Math.abs(k - idx) < Math.abs(best - idx)) best = k;
    }
    if (best != null) onSelect(dates[best]);
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} onClick={click} style={{ width: "100%", height: "auto", display: "block", cursor: "pointer" }} role="img" aria-label="Courbe du métabolisme de base">
      {ticks.map((t, k) => (
        <g key={k}>
          <line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} stroke={C.line} strokeDasharray="3 4" />
          <text x={P.l - 5} y={y(t) + 3.5} textAnchor="end" fontSize="9.5" fill={C.inkSoft} fontFamily="IBM Plex Mono, monospace">{Math.round(t)}</text>
        </g>
      ))}
      {selIdx >= 0 && <line x1={x(selIdx)} x2={x(selIdx)} y1={P.t} y2={H - P.b} stroke={C.ink} strokeOpacity="0.35" strokeWidth="1" />}
      {series.map((s) => {
        const pts = dates.map((d, i) => (s.values[d] != null ? [x(i), y(s.values[d])] : null)).filter(Boolean);
        if (!pts.length) return null;
        const path = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
        return (
          <g key={s.key}>
            <path d={path} fill="none" stroke={s.color} strokeWidth="2.2" strokeDasharray={s.dashed ? "5 4" : undefined} strokeLinejoin="round" strokeLinecap="round" />
            {pts.length <= 45 && pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="2.6" fill={s.color} />)}
            {selIdx >= 0 && s.values[dates[selIdx]] != null && <circle cx={x(selIdx)} cy={y(s.values[dates[selIdx]])} r="4.5" fill={C.card} stroke={s.color} strokeWidth="2.2" />}
          </g>
        );
      })}
      {labelIdx.map((i) => (
        <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} fontSize="9.5" fill={C.inkSoft}>{frShort(dates[i])}</text>
      ))}
    </svg>
  );
}

export function MetabolismTab({ personalInfo, weights }) {
  const [range, setRange] = useState(30);
  const data = useMemo(() => buildBmrSeries(personalInfo, weights, loadJSON("bmrHistory", {}), loadJSON("bodyComp", {})), [personalInfo, weights]);
  const today = todayISO();
  const dates = useMemo(() => Array.from({ length: range }, (_, i) => addDays(today, i - range + 1)), [range, today]);
  const withData = dates.filter((d) => data.series.some((s) => s.values[d] != null));
  const [selected, setSelected] = useState(null);
  const main = data.series.find((s) => dates.some((d) => s.values[d] != null));
  const mainDates = main ? dates.filter((d) => main.values[d] != null) : [];
  const sel = selected && dates.includes(selected) ? selected : (mainDates[mainDates.length - 1] || withData[withData.length - 1]);
  const showLean = dates.some((d) => data.comp[d]?.lean != null);
  const first = mainDates[0], last = mainDates[mainDates.length - 1];
  const comp = (d) => data.comp[d] || {};

  if (!data.series.length) {
    return (
      <Card>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55 }}>
          Pas encore de données. Le graphique se remplit avec le <strong>métabolisme de base</strong> envoyé par tes applis
          (Withings, Fitbit…) via Health Connect, et avec une valeur calculée d'après tes pesées. Active la lecture des
          calories et du poids dans Moi → Health Connect, ou renseigne ta taille et ton âge dans Moi → Objectifs.
        </p>
      </Card>
    );
  }
  return (
    <div>
      <Card style={{ padding: 12 }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 8, justifyContent: "flex-end" }}>
          {RANGES.map(([r, l]) => <Chip key={r} active={range === r} onClick={() => { setRange(r); setSelected(null); }} style={{ padding: "4px 10px", fontSize: 11.5 }}>{l}</Chip>)}
        </div>
        <Chart dates={dates} series={data.series} selected={sel} onSelect={setSelected} />
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", fontSize: 11, color: C.inkSoft, marginTop: 6 }}>
          {data.series.map((s) => (
            <span key={s.key} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <svg width="18" height="6"><line x1="0" x2="18" y1="3" y2="3" stroke={s.color} strokeWidth="2.4" strokeDasharray={s.dashed ? "4 3" : undefined} /></svg>{s.label}
            </span>
          ))}
        </div>
        {sel && (
          <div style={{ marginTop: 10, padding: "9px 11px", background: C.sage, borderRadius: 10 }}>
            <p style={{ margin: "0 0 4px", fontSize: 12.5, fontWeight: 700, color: C.herb, textTransform: "capitalize" }}>{frDate(sel)}</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 14px", fontSize: 12.5 }}>
              {data.series.map((s) => s.values[sel] != null && (
                <span key={s.key}>{s.label} : <b style={{ fontFamily: MONO }}>{fmt(s.values[sel])} kcal</b></span>
              ))}
              {comp(sel).fat != null && <span>Masse grasse : <b style={{ fontFamily: MONO }}>{String(comp(sel).fat).replace(".", ",")} %</b></span>}
              {comp(sel).lean != null && <span>Masse maigre : <b style={{ fontFamily: MONO }}>{String(comp(sel).lean).replace(".", ",")} kg</b></span>}
              {weights?.[sel] != null && <span>Poids : <b style={{ fontFamily: MONO }}>{String(weights[sel]).replace(".", ",")} kg</b></span>}
            </div>
            <p style={{ margin: "4px 0 0", fontSize: 10.5, color: C.inkSoft }}>Touche le graphique pour voir un autre jour.</p>
          </div>
        )}
      </Card>

      {first && last && first !== last && (
        <Card>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55 }}>
            <strong>{main.label}</strong> : {frShort(first)} <b style={{ fontFamily: MONO }}>{fmt(main.values[first])}</b> → {frShort(last)}{" "}
            <b style={{ fontFamily: MONO }}>{fmt(main.values[last])} kcal</b>{" "}
            <span style={{ fontFamily: MONO, color: C.inkSoft }}>({sign(main.values[last] - main.values[first])})</span>
          </p>
          {(() => {
            const cd = dates.filter((d) => data.comp[d]?.lean != null);
            if (cd.length < 2) return null;
            const a = data.comp[cd[0]].lean, z = data.comp[cd[cd.length - 1]].lean, dl = round(z - a);
            return (
              <p style={{ margin: "4px 0 0", fontSize: 13 }}>
                Masse maigre : <b style={{ fontFamily: MONO }}>{String(a).replace(".", ",")}</b> → <b style={{ fontFamily: MONO }}>{String(z).replace(".", ",")} kg</b>{" "}
                <span style={{ fontFamily: MONO, color: dl < -0.5 ? C.berry : C.inkSoft }}>({dl > 0 ? "+" : ""}{String(dl).replace(".", ",")} kg)</span>
              </p>
            );
          })()}
          <p style={{ margin: "6px 0 0", fontSize: 11.5, color: C.inkSoft, lineHeight: 1.5 }}>
            Le métabolisme de base baisse un peu quand on perd du poids (environ 10 à 20 kcal par kg) : c'est normal.
            Ce qui compte, c'est de garder la masse maigre : si elle reste stable pendant que le poids baisse, la perte vient bien de la graisse.
          </p>
        </Card>
      )}

      <p style={{ fontSize: 10.5, fontWeight: 700, color: C.inkSoft, textTransform: "uppercase", letterSpacing: 0.5, margin: "4px 0 6px" }}>Jour par jour</p>
      <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, overflow: "hidden", marginBottom: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: `1.2fr repeat(${data.series.length}, 1fr)${showLean ? " 1fr" : ""} 0.9fr`, fontSize: 11, color: C.inkSoft, padding: "7px 10px", borderBottom: `1px solid ${C.line}` }}>
          <span>Jour</span>{data.series.map((s) => <span key={s.key} style={{ textAlign: "right", color: s.color, fontWeight: 600 }}>{s.label.replace("Calculé ", "Calc. ")}</span>)}{showLean && <span style={{ textAlign: "right" }}>Maigre</span>}<span style={{ textAlign: "right" }}>MG</span>
        </div>
        {[...withData].reverse().slice(0, 120).map((d) => (
          <div key={d} onClick={() => setSelected(d)} style={{
            display: "grid", gridTemplateColumns: `1.2fr repeat(${data.series.length}, 1fr)${showLean ? " 1fr" : ""} 0.9fr`, fontSize: 12.5, padding: "7px 10px",
            borderBottom: `1px solid ${C.line}`, background: d === sel ? C.sage : "transparent", cursor: "pointer",
          }}>
            <span>{frShort(d)}</span>
            {data.series.map((s) => <span key={s.key} style={{ textAlign: "right", fontFamily: MONO }}>{fmt(s.values[d])}</span>)}
            {showLean && <span style={{ textAlign: "right", fontFamily: MONO, color: C.inkSoft }}>{comp(d).lean != null ? String(comp(d).lean).replace(".", ",") : "—"}</span>}
            <span style={{ textAlign: "right", fontFamily: MONO, color: C.inkSoft }}>{comp(d).fat != null ? String(comp(d).fat).replace(".", ",") + "%" : "—"}</span>
          </div>
        ))}
      </div>
      <p style={{ fontSize: 11, color: C.inkSoft, lineHeight: 1.5, margin: "0 0 14px" }}>
        Valeurs des applis : celles qu'elles envoient à Health Connect (Withings en calcule une par jour d'après ta balance).
        Sans appli qui l'envoie, NutriMaison le calcule : avec la masse maigre de ta balance (Katch-McArdle) quand elle est connue, sinon d'après le poids, la taille et l'âge (Mifflin-St Jeor).
        Masse grasse et masse maigre : celles de ta balance, lues dans Health Connect.
      </p>
    </div>
  );
}
