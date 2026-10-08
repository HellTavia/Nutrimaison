// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Les auteurs de NutriMaison
import React, { useState, useEffect, useRef } from "react";

/* ---------------------------------------------------------------- */
/* STOCKAGE LOCAL (100% hors-ligne, aucun serveur, aucune clé)       */
/* ---------------------------------------------------------------- */
export const storage = {
  async get(key) {
    try {
      const v = window.localStorage.getItem(key);
      return v === null ? null : { key, value: v };
    } catch (e) { return null; }
  },
  async set(key, value) {
    try { window.localStorage.setItem(key, value); return { key, value }; } catch (e) { return null; }
  },
  async delete(key) {
    try { window.localStorage.removeItem(key); return { key, deleted: true }; } catch (e) { return null; }
  },
};

export function loadJSON(key, fallback) {
  try {
    const v = window.localStorage.getItem(key);
    return v === null ? fallback : JSON.parse(v);
  } catch (e) { return fallback; }
}
export function saveJSON(key, value) {
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
}

/** Tous les jours enregistrés : { "2026-10-06": {meals, water, steps}, ... } */
export function loadAllDays() {
  const out = {};
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith("day:")) {
        try { out[k.slice(4)] = JSON.parse(window.localStorage.getItem(k)); } catch (e) {}
      }
    }
  } catch (e) {}
  return out;
}

export function dayKcal(day) {
  if (!day || !day.meals) return 0;
  return Object.values(day.meals).reduce((s, list) => s + (list || []).reduce((a, e) => a + (Number(e.kcal) || 0), 0), 0);
}

/* ---------------------------------------------------------------- */
/* TOKENS                                                            */
/* ---------------------------------------------------------------- */
/* Couleurs : clair et sombre. Les composants utilisent C.xxx, qui pointe vers une variable CSS :
   le thème change donc partout d'un coup, sans recharger. */
export const THEME_LIGHT = {
  paper: "#F6F1E6", paperDark: "#EFE7D6", ink: "#20291F", inkSoft: "#5B6459",
  herb: "#2F4A3C", herbLight: "#3F614F", sage: "#DEE6D6",
  ochre: "#C1922B", ochreLight: "#F1E1B8", berry: "#8C3A42", berryLight: "#F2DEDD",
  olive: "#6E7A3D", oliveLight: "#E7EAD3", card: "#FFFDF8", line: "#DCD2BC",
  onAccent: "#FFFFFF",            // texte posé sur un bouton/pastille de couleur
  hero: "#2F4A3C", onHero: "#FFFFFF", // grands bandeaux verts (eau, bilan, séance)
};
export const THEME_DARK = {
  paper: "#121813", paperDark: "#1B231D", ink: "#E6ECE3", inkSoft: "#A2AD9E",
  herb: "#8CC5A3", herbLight: "#A9D6BB", sage: "#22342A",
  ochre: "#E2B55A", ochreLight: "#3A301C", berry: "#EE959B", berryLight: "#3E2427",
  olive: "#BCC77E", oliveLight: "#2A2F1C", card: "#1C251F", line: "#334036",
  onAccent: "#0E1510",
  hero: "#22392D", onHero: "#FFFFFF",
};
export const C = Object.fromEntries(Object.keys(THEME_LIGHT).map((k) => [k, `var(--nm-${k})`]));

const vars = (t) => Object.entries(t).map(([k, v]) => `--nm-${k}:${v};`).join("");
/** Feuille de style des thèmes : clair par défaut, sombre si choisi, ou si « automatique » et Android est en sombre. */
export const THEME_CSS = `:root{${vars(THEME_LIGHT)}color-scheme:light;}
:root[data-theme="dark"]{${vars(THEME_DARK)}color-scheme:dark;}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){${vars(THEME_DARK)}color-scheme:dark;}}
html,body{background:var(--nm-paper);color:var(--nm-ink);}
input,textarea,select{background-color:var(--nm-card);color:var(--nm-ink);border-color:var(--nm-line);}
input::placeholder,textarea::placeholder{color:var(--nm-inkSoft);opacity:.8;}`;

/** Thème choisi : "auto" (suit Android), "light" ou "dark". */
export function loadThemePref() {
  try { return localStorage.getItem("theme") || "auto"; } catch (e) { return "auto"; }
}
export function applyTheme(pref) {
  const p = pref === "light" || pref === "dark" ? pref : "auto";
  try { localStorage.setItem("theme", p); } catch (e) {}
  const root = document.documentElement;
  if (p === "auto") root.removeAttribute("data-theme"); else root.setAttribute("data-theme", p);
  const dark = p === "dark" || (p === "auto" && window.matchMedia?.("(prefers-color-scheme: dark)").matches);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", dark ? THEME_DARK.paper : THEME_LIGHT.herb);
}
export function installTheme() {
  if (!document.getElementById("nm-theme")) {
    const st = document.createElement("style"); st.id = "nm-theme"; st.textContent = THEME_CSS;
    document.head.appendChild(st);
  }
  applyTheme(loadThemePref());
  try { window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => applyTheme(loadThemePref())); } catch (e) {}
}

export const MONO = "'IBM Plex Mono',monospace";
export const SERIF = "'Fraunces',serif";

/* ---------------------------------------------------------------- */
/* DATES (en heure locale — pas d'UTC, sinon décalage d'un jour)     */
/* ---------------------------------------------------------------- */
function isoLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
export function todayISO() { return isoLocal(new Date()); }
export function addDays(iso, n) {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  return isoLocal(d);
}
export function daysBetween(a, b) {
  return Math.round((new Date(b + "T12:00:00") - new Date(a + "T12:00:00")) / 86400000);
}
export function frDate(iso) {
  const d = new Date(iso + "T12:00:00");
  const s = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" }).format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
}
export function frShort(iso) {
  const d = new Date(iso + "T12:00:00");
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(d);
}
/** Lundi de la semaine contenant iso */
export function weekStart(iso) {
  const d = new Date(iso + "T12:00:00");
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  return isoLocal(d);
}

export function round(n) { return Math.round(n * 10) / 10; }
export function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
export function fmtDuration(sec) {
  sec = Math.max(0, Math.round(sec));
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/* ---------------------------------------------------------------- */
/* ÉNERGIE                                                           */
/* ---------------------------------------------------------------- */
/** Dépense NETTE (au-delà du repos) d'une activité : (MET − 1) × kg × heures.
 *  On retire le métabolisme de repos, déjà compté dans le besoin de base. */
export function netKcal(met, kg, minutes) {
  return Math.max(0, (met - 1) * (kg || 70) * (minutes / 60));
}
/** Longueur de pas estimée depuis la taille (≈ 0,415 × taille). */
export function strideMeters(heightCm) { return ((heightCm || 170) * 0.415) / 100; }
/** Calories nettes des pas : ≈ 0,5 kcal par kg et par km parcouru en marchant. */
export function stepsKcal(steps, kg, heightCm) {
  const km = ((steps || 0) * strideMeters(heightCm)) / 1000;
  return 0.5 * (kg || 70) * km;
}
export function bmrMifflin({ sexe, poids, taille, age }) {
  return sexe === "homme"
    ? 10 * poids + 6.25 * taille - 5 * age + 5
    : 10 * poids + 6.25 * taille - 5 * age - 161;
}
export function bmi(kg, cm) { return cm > 0 ? kg / Math.pow(cm / 100, 2) : 0; }

/* ---------------------------------------------------------------- */
/* PETITS COMPOSANTS UI                                              */
/* ---------------------------------------------------------------- */
export function Ring({ value, goal, size = 132, stroke = 12, color }) {
  const pct = goal > 0 ? Math.min(1, value / goal) : 0;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.paperDark} strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={c} strokeDashoffset={c * (1 - pct)} strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.5s ease" }}
      />
    </svg>
  );
}

export function Tag({ children, color, bg }) {
  return (
    <span style={{
      fontFamily: "'Work Sans',sans-serif", fontSize: 11, fontWeight: 600, color, background: bg,
      padding: "3px 9px", borderRadius: 999, letterSpacing: 0.2, whiteSpace: "nowrap",
    }}>{children}</span>
  );
}

export function SectionTitle({ children, sub }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <h2 style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 22, color: C.ink, margin: 0 }}>{children}</h2>
      {sub && <p style={{ fontFamily: "'Work Sans',sans-serif", fontSize: 13, color: C.inkSoft, margin: "2px 0 0" }}>{sub}</p>}
    </div>
  );
}

export function Card({ children, style, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: 16, marginBottom: 14,
      cursor: onClick ? "pointer" : undefined, ...style,
    }}>{children}</div>
  );
}

export function Btn({ children, onClick, kind = "primary", style, disabled }) {
  const kinds = {
    primary: { background: C.herb, color: C.onAccent, border: "none" },
    ghost: { background: "transparent", color: C.herb, border: `1.5px solid ${C.herb}` },
    soft: { background: C.sage, color: C.herb, border: "none" },
    danger: { background: C.berryLight, color: C.berry, border: "none" },
  };
  return (
    <button disabled={disabled} onClick={onClick} style={{
      padding: "11px 14px", borderRadius: 11, fontWeight: 600, fontSize: 13.5,
      display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
      opacity: disabled ? 0.5 : 1, ...kinds[kind], ...style,
    }}>{children}</button>
  );
}

export function Chip({ active, children, onClick, style }) {
  return (
    <button onClick={onClick} style={{
      padding: "7px 12px", borderRadius: 999, fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap",
      border: `1px solid ${active ? C.herb : C.line}`, background: active ? C.herb : C.card,
      color: active ? C.onAccent : C.ink, ...style,
    }}>{children}</button>
  );
}

export const inputStyle = {
  width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${C.line}`,
  fontFamily: MONO, fontSize: 14, background: C.card, color: C.ink,
};

export function BackHeader({ title, onBack, right }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
      <button onClick={onBack} style={{ background: "none", border: "none", padding: 6, color: C.herb, fontSize: 20, lineHeight: 1 }} aria-label="Retour">‹</button>
      <h2 style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 20, margin: 0, flex: 1 }}>{title}</h2>
      {right}
    </div>
  );
}

/**
 * Champ numérique agréable sur mobile :
 *  - peut être vide pendant la saisie (plus de « 0 » qui se colle devant : 0193) ;
 *  - tout le contenu est sélectionné au toucher, on tape directement la nouvelle valeur ;
 *  - accepte la virgule comme séparateur décimal ;
 *  - min / max appliqués quand on quitte le champ.
 */
export function NumInput({ value, onChange, min, max, decimals = true, style, placeholder, ...rest }) {
  const show = (v) => (v == null || v === "" || Number.isNaN(v) ? "" : String(v).replace(".", ","));
  const [text, setText] = useState(show(value));
  const focused = useRef(false);
  const fresh = useRef(false); // vient de prendre le focus : tout le texte est sélectionné, la 1re frappe remplace
  useEffect(() => { if (!focused.current) setText(show(value)); }, [value]);
  const clamp = (n) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n));
  return (
    <input
      {...rest}
      type="text"
      inputMode={decimals ? "decimal" : "numeric"}
      value={text}
      placeholder={placeholder}
      style={style}
      onFocus={(e) => { focused.current = true; fresh.current = true; const el = e.target; try { el.select(); } catch (err) {} setTimeout(() => { try { if (fresh.current) el.select(); } catch (err) {} }, 0); }}
      onMouseUp={(e) => { if (fresh.current) { e.preventDefault(); try { e.target.select(); } catch (err) {} } fresh.current = false; }}
      onKeyDown={() => { fresh.current = false; }}
      onChange={(e) => {
        let t = e.target.value.replace(/\s/g, "").replace(",", ".");
        if (!(decimals ? /^\d*\.?\d*$/ : /^\d*$/).test(t)) return; // ignore les caractères non numériques
        t = t.replace(/^0+(?=\d)/, ""); // pas de zéro devant
        setText(t.replace(".", ","));
        if (t !== "" && t !== ".") onChange(Number(t));
      }}
      onBlur={() => {
        focused.current = false;
        const t = text.replace(",", ".");
        if (t === "" || t === ".") { setText(show(value)); return; } // champ laissé vide : on garde la valeur précédente
        const n = clamp(Number(t));
        if (n !== Number(t)) onChange(n);
        setText(show(n));
      }}
    />
  );
}
