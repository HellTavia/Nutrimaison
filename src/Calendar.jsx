// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Les auteurs de NutriMaison
/* Calendrier du mois : aller directement à un jour, voir d'un coup d'œil les jours notés. */
import React, { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { C, todayISO, dayKcal } from "./shared.jsx";
import { Sheet } from "./MealTools.jsx";

const MONO = "'IBM Plex Mono',monospace";
const pad = (n) => String(n).padStart(2, "0");
const iso = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
const DOW = ["L", "M", "M", "J", "V", "S", "D"];

export function CalendarSheet({ currentDate, allDays, weights, goalKcal, onPick, onClose }) {
  const [ym, setYm] = useState(() => { const [y, m] = currentDate.split("-").map(Number); return { y, m: m - 1 }; });
  const today = todayISO();
  const first = new Date(ym.y, ym.m, 1);
  const offset = (first.getDay() + 6) % 7; // lundi en premier
  const nDays = new Date(ym.y, ym.m + 1, 0).getDate();
  const cells = [...Array(offset).fill(null), ...Array.from({ length: nDays }, (_, i) => i + 1)];
  const title = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(first);
  const move = (k) => setYm(({ y, m }) => { const d = new Date(y, m + k, 1); return { y: d.getFullYear(), m: d.getMonth() }; });

  // résumé du mois
  let logged = 0, sum = 0;
  for (let d = 1; d <= nDays; d++) {
    const k = dayKcal(allDays?.[iso(ym.y, ym.m, d)]);
    if (k > 0 && iso(ym.y, ym.m, d) < today) { logged++; sum += k; }
  }

  function status(k) {
    if (!(k > 0)) return null;
    const r = k / (goalKcal || 2000);
    if (r < 0.6) return { c: C.line, t: "partiel" };          // journée sans doute incomplète
    if (r <= 1.05) return { c: C.herb, t: "dans l'objectif" };
    if (r <= 1.15) return { c: C.ochre, t: "un peu au-dessus" };
    return { c: C.berry, t: "au-dessus" };
  }

  return (
    <Sheet title="Aller à un jour" onClose={onClose}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <button onClick={() => move(-1)} aria-label="Mois précédent" style={{ background: "none", border: "none", color: C.herb, padding: 6 }}><ChevronLeft size={20} /></button>
        <p style={{ margin: 0, fontWeight: 600, fontSize: 15, textTransform: "capitalize" }}>{title}</p>
        <button onClick={() => move(1)} aria-label="Mois suivant" style={{ background: "none", border: "none", color: C.herb, padding: 6 }}><ChevronRight size={20} /></button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, textAlign: "center" }}>
        {DOW.map((d, i) => <span key={i} style={{ fontSize: 11, color: C.inkSoft, fontWeight: 600, paddingBottom: 4 }}>{d}</span>)}
        {cells.map((d, i) => {
          if (!d) return <span key={"e" + i} />;
          const key = iso(ym.y, ym.m, d);
          const k = dayKcal(allDays?.[key]);
          const st = status(k);
          const sel = key === currentDate, isT = key === today;
          return (
            <button key={key} onClick={() => { onPick(key); onClose(); }} aria-label={key} style={{
              aspectRatio: "1 / 1.1", borderRadius: 10, padding: "4px 0 3px",
              border: `1.5px solid ${sel ? C.herb : isT ? C.ochre : "transparent"}`,
              background: sel ? C.sage : C.card, color: key > today ? C.inkSoft : C.ink,
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between",
            }}>
              <span style={{ fontSize: 13.5, fontWeight: isT || sel ? 700 : 500 }}>{d}</span>
              <span style={{ display: "flex", gap: 2, alignItems: "center", height: 8 }}>
                {st && <span title={st.t} style={{ width: 7, height: 7, borderRadius: 999, background: st.c }} />}
                {weights?.[key] != null && <span title="pesée" style={{ fontSize: 8, lineHeight: 1, color: C.olive }}>⚖</span>}
              </span>
            </button>
          );
        })}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", marginTop: 10, fontSize: 11, color: C.inkSoft }}>
        {[[C.herb, "dans l'objectif"], [C.ochre, "un peu au-dessus"], [C.berry, "au-dessus (+15 %)"], [C.line, "journée partielle"]].map(([c, t]) => (
          <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><span style={{ width: 7, height: 7, borderRadius: 999, background: c }} />{t}</span>
        ))}
        <span>⚖ pesée</span>
      </div>
      {logged > 0 && (
        <p style={{ margin: "10px 0 0", fontSize: 12, color: C.inkSoft }}>
          Ce mois : <b style={{ color: C.ink }}>{logged} jour{logged > 1 ? "s" : ""} noté{logged > 1 ? "s" : ""}</b> · moyenne <span style={{ fontFamily: MONO }}>{Math.round(sum / logged)} kcal</span>
        </p>
      )}
      <button onClick={() => { onPick(today); onClose(); }} style={{
        width: "100%", marginTop: 12, padding: "11px 0", borderRadius: 12, border: "none", background: C.herb, color: "#fff", fontWeight: 600, fontSize: 14,
      }}>Revenir à aujourd'hui</button>
    </Sheet>
  );
}
