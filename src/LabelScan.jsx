// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Les auteurs de NutriMaison
/* ---------------------------------------------------------------- */
/* SCANNER UNE ÉTIQUETTE NUTRITIONNELLE                              */
/* Photo → cadre à ajuster sur le tableau → lecture par l'IA →       */
/* valeurs pour 100 g et par portion, modifiables → produit          */
/* enregistré dans « mes produits » et ajouté au repas.              */
/* ---------------------------------------------------------------- */
import React, { useRef, useState } from "react";
import { Camera, Image as ImageIcon, Loader2, Scissors, Sparkles, X } from "lucide-react";
import { C, MONO, inputStyle, round } from "./shared.jsx";
import { geminiGenerate, parseJSONLoose, aiProviderLabel } from "./gemini.js";

const ROWS = [
  ["kcal", "Calories (kcal)"], ["prot", "Protéines (g)"], ["fat", "Lipides (g)"], ["satfat", "dont saturés (g)", true],
  ["carbs", "Glucides (g)"], ["sugar", "dont sucres (g)", true], ["fiber", "Fibres (g)"], ["salt", "Sel (g)"],
];
const KEYS = ROWS.map((r) => r[0]);
const MIN = 0.06; // taille mini du cadre (fraction de l'image)

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const num = (v) => (v == null || v === "" || Number.isNaN(Number(String(v).replace(",", "."))) ? null : Number(String(v).replace(",", ".")));
const fmt = (v) => (v == null ? "" : String(round(v)).replace(".", ","));

/** Découpe la zone choisie et la réduit (côté max 1600 px) avant l'envoi. */
async function cropToJpeg(src, rect) {
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  const sx = rect.x * img.naturalWidth, sy = rect.y * img.naturalHeight;
  const sw = rect.w * img.naturalWidth, sh = rect.h * img.naturalHeight;
  const scale = Math.min(1, 1600 / Math.max(sw, sh));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(sw * scale)); c.height = Math.max(1, Math.round(sh * scale));
  c.getContext("2d").drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
  return { base64: c.toDataURL("image/jpeg", 0.88).split(",")[1], w: c.width, h: c.height };
}

export async function readNutritionLabel(apiKey, base64, { onStatus, onModel, signal } = {}) {
  const text = await geminiGenerate(apiKey, [
    { text:
`Photo du tableau des valeurs nutritionnelles d'un emballage alimentaire (la langue peut être étrangère).
Lis les valeurs POUR 100 g (ou 100 ml). Si l'étiquette ne donne que des valeurs par portion, recopie-les dans "perPortion" avec le poids de la portion, et laisse "per100" à null.
Si l'énergie n'est donnée qu'en kJ, convertis en kcal (÷ 4,184). Le sodium se convertit en sel (× 2,5).
Réponds UNIQUEMENT en JSON :
{"name":"nom du produit et marque si visibles, sinon vide","unit":"g ou ml",
 "per100":{"kcal":0,"prot":0,"fat":0,"satfat":0,"carbs":0,"sugar":0,"fiber":0,"salt":0},
 "portion":{"grams":null,"label":"ex. 1 biscuit (12 g)"},
 "perPortion":{"kcal":null,"prot":null,"fat":null,"satfat":null,"carbs":null,"sugar":null,"fiber":null,"salt":null},
 "note":"une phrase en français si quelque chose est douteux ou illisible, sinon vide"}
Une valeur illisible ou absente = null. N'invente rien.` },
    { inline_data: { mime_type: "image/jpeg", data: base64 } },
  ], { onStatus, onModel, temperature: 0.1, signal, timeoutMs: 45000 });
  const r = parseJSONLoose(text) || {};
  const per100 = {}, perP = {};
  KEYS.forEach((k) => { per100[k] = num(r.per100?.[k]); perP[k] = num(r.perPortion?.[k]); });
  const pg = num(r.portion?.grams);
  // seulement des valeurs par portion : on les ramène à 100 g
  if (pg > 0) KEYS.forEach((k) => { if (per100[k] == null && perP[k] != null) per100[k] = perP[k] * 100 / pg; });
  if (per100.kcal == null && per100.prot != null && per100.carbs != null && per100.fat != null) {
    per100.kcal = per100.prot * 4 + per100.carbs * 4 + per100.fat * 9; // à défaut, recalculé depuis les macros
  }
  return { name: String(r.name || "").slice(0, 80), unit: r.unit === "ml" ? "ml" : "g", per100, portion: pg || null, portionLabel: String(r.portion?.label || ""), note: String(r.note || "") };
}

/** Cadre déplaçable / redimensionnable posé sur la photo. */
function CropBox({ src, rect, setRect }) {
  const boxRef = useRef(null);
  const drag = useRef(null);
  const pos = (e) => {
    const b = boxRef.current.getBoundingClientRect();
    return { x: clamp((e.clientX - b.left) / b.width, 0, 1), y: clamp((e.clientY - b.top) / b.height, 0, 1) };
  };
  function down(e, mode) {
    e.preventDefault(); e.stopPropagation();
    const p = pos(e);
    drag.current = { mode, start: p, rect: { ...rect } };
    if (mode === "new") setRect({ x: p.x, y: p.y, w: MIN, h: MIN });
    boxRef.current.setPointerCapture?.(e.pointerId);
  }
  function move(e) {
    const d = drag.current; if (!d) return;
    const p = pos(e), dx = p.x - d.start.x, dy = p.y - d.start.y, r = d.rect;
    if (d.mode === "move") setRect({ ...r, x: clamp(r.x + dx, 0, 1 - r.w), y: clamp(r.y + dy, 0, 1 - r.h) });
    else if (d.mode === "new") {
      const x = Math.min(d.start.x, p.x), y = Math.min(d.start.y, p.y);
      setRect({ x, y, w: Math.max(MIN, Math.abs(p.x - d.start.x)), h: Math.max(MIN, Math.abs(p.y - d.start.y)) });
    } else {
      let { x, y, w, h } = r;
      if (d.mode.includes("l")) { const nx = clamp(r.x + dx, 0, r.x + r.w - MIN); w = r.w + (r.x - nx); x = nx; }
      if (d.mode.includes("r")) w = clamp(r.w + dx, MIN, 1 - r.x);
      if (d.mode.includes("t")) { const ny = clamp(r.y + dy, 0, r.y + r.h - MIN); h = r.h + (r.y - ny); y = ny; }
      if (d.mode.includes("b")) h = clamp(r.h + dy, MIN, 1 - r.y);
      setRect({ x, y, w, h });
    }
  }
  const up = () => { drag.current = null; };
  const pct = (v) => (v * 100) + "%";
  const corner = (mode, style) => (
    <span onPointerDown={(e) => down(e, mode)} style={{
      position: "absolute", width: 26, height: 26, margin: -13, borderRadius: 999, background: "#fff", border: `3px solid ${C.herb}`, touchAction: "none", ...style,
    }} />
  );
  return (
    <div ref={boxRef} onPointerDown={(e) => down(e, "new")} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
      style={{ position: "relative", touchAction: "none", userSelect: "none", borderRadius: 12, overflow: "hidden", background: "#000" }}>
      <img src={src} alt="" draggable={false} style={{ width: "100%", display: "block", pointerEvents: "none" }} />
      <div onPointerDown={(e) => down(e, "move")} style={{
        position: "absolute", left: pct(rect.x), top: pct(rect.y), width: pct(rect.w), height: pct(rect.h),
        border: `2.5px solid ${C.herb}`, boxShadow: "0 0 0 4000px rgba(0,0,0,0.45)", touchAction: "none", cursor: "move",
      }}>
        {corner("tl", { left: 0, top: 0 })}{corner("tr", { right: 0, top: 0, margin: "-13px -13px 0 0" })}
        {corner("bl", { left: 0, bottom: 0, margin: "0 0 -13px -13px" })}{corner("br", { right: 0, bottom: 0, margin: "0 -13px -13px 0" })}
      </div>
    </div>
  );
}

export function LabelScan({ apiKey, onSave, onClose }) {
  const [src, setSrc] = useState(null);
  const [rect, setRect] = useState({ x: 0.08, y: 0.15, w: 0.84, h: 0.7 });
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState(null);
  const [res, setRes] = useState(null); // { name, unit, per100, portion, note, meta }
  const [saved, setSaved] = useState(null);
  const abortRef = useRef(null);

  function onFile(file) {
    if (!file) return;
    if (src) URL.revokeObjectURL(src);
    setSrc(URL.createObjectURL(file)); setRes(null); setErr(null); setSaved(null);
    setRect({ x: 0.08, y: 0.15, w: 0.84, h: 0.7 });
  }
  async function analyze() {
    setErr(null); setBusy("Lecture de l'étiquette…");
    const ctrl = new AbortController(); abortRef.current = ctrl;
    const t0 = Date.now();
    let model = null;
    try {
      const crop = await cropToJpeg(src, rect);
      const r = await readNutritionLabel(apiKey, crop.base64, { onStatus: setBusy, onModel: (m) => { model = m; }, signal: ctrl.signal });
      if (Object.values(r.per100).every((v) => v == null)) throw new Error("aucune valeur lue : resserre le cadre sur le tableau nutritionnel");
      setRes({ ...r, meta: `${model || aiProviderLabel()} · ${((Date.now() - t0) / 1000).toFixed(1).replace(".", ",")} s · zone envoyée ${crop.w}×${crop.h} px` });
    } catch (e) {
      if (!e.cancelled) setErr(e.message || "erreur");
    } finally { setBusy(null); }
  }
  const setVal = (k, v) => setRes({ ...res, per100: { ...res.per100, [k]: num(v) } });
  const portion = res?.portion || null;
  const ok = res && res.name.trim() && res.per100.kcal != null;
  function save(addToMeal) {
    const p = res.per100;
    onSave({
      name: res.name.trim(), kcal: round(p.kcal || 0), prot: round(p.prot || 0), carbs: round(p.carbs || 0), fat: round(p.fat || 0),
      ...(p.sugar != null ? { sugar: round(p.sugar) } : {}), ...(p.fiber != null ? { fiber: round(p.fiber) } : {}),
      ...(p.satfat != null ? { satfat: round(p.satfat) } : {}), ...(p.salt != null ? { salt: round(p.salt) } : {}),
      ...(portion ? { portion } : {}),
    }, addToMeal ? (portion || 100) : null);
    if (!addToMeal) { setSaved(res.name.trim()); setRes(null); if (src) URL.revokeObjectURL(src); setSrc(null); }
  }

  const card = { background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: 14, marginBottom: 12 };
  const pickBtn = (primary) => ({
    flex: 1, padding: primary ? "22px 0" : "12px 0", borderRadius: 14, border: `1.5px ${primary ? "dashed" : "solid"} ${C.herb}`, background: primary ? C.sage : "transparent",
    color: C.herb, display: "flex", flexDirection: primary ? "column" : "row", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
  });

  return (
    <div style={{ ...card, border: `1.5px solid ${C.herb}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <Sparkles size={16} color={C.herb} />
        <p style={{ margin: 0, fontSize: 14.5, fontWeight: 700, flex: 1 }}>Scanner une étiquette nutritionnelle</p>
        {onClose && <button onClick={onClose} aria-label="Fermer" style={{ background: "none", border: "none", color: C.inkSoft, padding: 4 }}><X size={16} /></button>}
      </div>
      {!apiKey && (
        <p style={{ fontSize: 12.5, color: C.berry, margin: 0, lineHeight: 1.5 }}>
          Cette fonction lit l'étiquette avec l'IA : ajoute une clé Gemini (gratuite) ou Grok dans Moi → Intelligence artificielle.
        </p>
      )}
      {saved && !src && <p style={{ fontSize: 12.5, color: C.herb, margin: "0 0 10px" }}>✓ « {saved} » est enregistré dans tes produits : retrouve-le dans la recherche Manuel.</p>}
      {apiKey && !src && (
        <>
          <p style={{ fontSize: 12, color: C.inkSoft, margin: "0 0 10px", lineHeight: 1.5 }}>
            Pour un produit sans code-barres, introuvable, ou étranger : photographie le tableau des valeurs, ajuste le cadre, et le produit est ajouté à tes produits.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={pickBtn(true)}>
              <Camera size={24} /> Photographier l'étiquette
              <input type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={(e) => { onFile(e.target.files[0]); e.target.value = ""; }} />
            </label>
            <label style={pickBtn(false)}>
              <ImageIcon size={16} /> Choisir dans la galerie
              <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { onFile(e.target.files[0]); e.target.value = ""; }} />
            </label>
          </div>
        </>
      )}
      {apiKey && src && !res && (
        <>
          <CropBox src={src} rect={rect} setRect={setRect} />
          <p style={{ fontSize: 12, color: C.inkSoft, margin: "8px 0", lineHeight: 1.5 }}>
            <Scissors size={12} style={{ verticalAlign: -1 }} /> Déplace le cadre ou tire ses coins pour entourer le tableau nutritionnel. Tu peux aussi redessiner un cadre en glissant sur la photo.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setRect({ x: 0, y: 0, w: 1, h: 1 })} disabled={!!busy} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: `1px solid ${C.line}`, background: C.card, color: C.ink, fontSize: 12.5, fontWeight: 600 }}>Tout sélectionner</button>
            <label style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: `1px solid ${C.line}`, background: C.card, color: C.ink, fontSize: 12.5, fontWeight: 600, textAlign: "center", cursor: "pointer" }}>
              Autre photo
              <input type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={(e) => { onFile(e.target.files[0]); e.target.value = ""; }} />
            </label>
          </div>
          {busy ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
              <Loader2 size={15} color={C.herb} style={{ animation: "spin 1s linear infinite" }} />
              <span style={{ fontSize: 12.5, color: C.inkSoft, flex: 1 }}>{busy}</span>
              <button onClick={() => abortRef.current?.abort()} style={{ background: "none", border: `1px solid ${C.line}`, borderRadius: 999, padding: "4px 10px", fontSize: 12, color: C.inkSoft }}>Annuler</button>
            </div>
          ) : (
            <button onClick={analyze} style={{ width: "100%", marginTop: 10, padding: "12px 0", borderRadius: 12, border: "none", background: C.herb, color: C.onAccent, fontWeight: 600, fontSize: 14 }}>Analyser la zone</button>
          )}
          {err && <p style={{ color: C.berry, fontSize: 12.5, margin: "8px 0 0" }}>{err}</p>}
          <style>{"@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}"}</style>
        </>
      )}
      {res && (
        <>
          <input value={res.name} onChange={(e) => setRes({ ...res, name: e.target.value })} placeholder="Nom du produit (ex : Pain de mie complet – Marque)"
            style={{ ...inputStyle, width: "100%", marginBottom: 8, fontSize: 14, fontWeight: 600 }} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 78px 64px", alignItems: "center", fontSize: 13 }}>
            <span />
            <span style={{ textAlign: "right", color: C.inkSoft, fontSize: 11.5, padding: "4px 0" }}>/100 {res.unit}</span>
            <span style={{ textAlign: "right", color: C.inkSoft, fontSize: 11.5 }}>/portion</span>
            {ROWS.map(([k, label, sub]) => (
              <React.Fragment key={k}>
                <span style={{ padding: "7px 0", borderTop: `1px solid ${C.line}`, paddingLeft: sub ? 10 : 0, color: sub ? C.inkSoft : C.ink }}>{label}</span>
                <span style={{ borderTop: `1px solid ${C.line}`, padding: "3px 0", textAlign: "right" }}>
                  <input inputMode="decimal" value={fmt(res.per100[k])} onChange={(e) => setVal(k, e.target.value)} placeholder="—" aria-label={label}
                    style={{ width: 70, padding: "5px 6px", borderRadius: 7, border: `1px solid ${C.line}`, background: C.paper, color: C.ink, textAlign: "right", fontFamily: MONO, fontSize: 13 }} />
                </span>
                <span style={{ borderTop: `1px solid ${C.line}`, padding: "7px 0", textAlign: "right", fontFamily: MONO, color: C.inkSoft }}>
                  {portion && res.per100[k] != null ? fmt(res.per100[k] * portion / 100) : "—"}
                </span>
              </React.Fragment>
            ))}
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, fontSize: 12.5, color: C.inkSoft }}>
            Portion
            <input inputMode="decimal" value={portion ? fmt(portion) : ""} placeholder="—" onChange={(e) => setRes({ ...res, portion: num(e.target.value) || null })}
              style={{ width: 70, padding: "5px 6px", borderRadius: 7, border: `1px solid ${C.line}`, background: C.paper, color: C.ink, textAlign: "right", fontFamily: MONO, fontSize: 13 }} />
            {res.unit}{res.portionLabel ? <span style={{ fontSize: 11.5 }}> · {res.portionLabel}</span> : null}
          </label>
          {res.note && <p style={{ fontSize: 12, color: C.ochre, margin: "10px 0 0", lineHeight: 1.45 }}>⚠️ {res.note}</p>}
          <p style={{ fontSize: 11, color: C.inkSoft, margin: "8px 0 0", fontFamily: MONO }}>{res.meta}</p>
          <button disabled={!ok} onClick={() => save(true)} style={{
            width: "100%", marginTop: 12, padding: "12px 0", borderRadius: 12, border: "none", background: C.herb, color: C.onAccent, fontWeight: 600, fontSize: 14, opacity: ok ? 1 : 0.5,
          }}>Enregistrer et ajouter au repas</button>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button disabled={!ok} onClick={() => save(false)} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: `1.5px solid ${C.herb}`, background: "transparent", color: C.herb, fontWeight: 600, fontSize: 12.5, opacity: ok ? 1 : 0.5 }}>Enregistrer seulement</button>
            <button onClick={() => setRes(null)} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: `1px solid ${C.line}`, background: C.card, color: C.inkSoft, fontSize: 12.5 }}>Recadrer</button>
          </div>
          {!res.name.trim() && <p style={{ fontSize: 11.5, color: C.inkSoft, margin: "6px 0 0" }}>Donne un nom au produit pour l'enregistrer.</p>}
        </>
      )}
    </div>
  );
}
