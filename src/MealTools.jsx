// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Les auteurs de NutriMaison
/* ================================================================== */
/* Outils « repas » : copier un repas (ou une partie) d'un autre jour, */
/* copier vers un autre jour, repas types, ajout d'un produit inconnu  */
/* au scan, modification des valeurs d'un aliment à la volée.          */
/* ================================================================== */
import React, { useState, useMemo } from "react";
import { X, Loader2, Sparkles, Trash2 } from "lucide-react";
import { C, addDays, frShort, round, NumInput, inputStyle } from "./shared.jsx";
import { geminiGenerate, parseJSONLoose, shrinkImage } from "./gemini.js";

const MONO = "'IBM Plex Mono',monospace";
const sumKcal = (list) => Math.round((list || []).reduce((s, e) => s + (e.kcal || 0), 0));

const chip = (active) => ({
  padding: "6px 11px", borderRadius: 999, fontSize: 12, fontWeight: 600, border: `1px solid ${active ? C.herb : C.line}`,
  background: active ? C.herb : C.card, color: active ? "#fff" : C.ink, whiteSpace: "nowrap", flexShrink: 0,
});
const primary = (disabled) => ({
  width: "100%", padding: "12px 0", borderRadius: 12, border: "none", background: C.herb, color: "#fff",
  fontWeight: 600, fontSize: 14, opacity: disabled ? 0.5 : 1,
});

function dayLabel(d, ref) {
  if (d === addDays(ref, -1)) return "Hier";
  if (d === addDays(ref, 1)) return "Demain";
  if (d === ref) return "Ce jour";
  return frShort(d);
}

/** Fenêtre qui monte du bas de l'écran. */
export function Sheet({ title, onClose, children }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(20,30,20,0.45)", zIndex: 60, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title} style={{
        background: C.paper, width: "100%", maxWidth: 480, maxHeight: "86vh", overflowY: "auto",
        borderRadius: "20px 20px 0 0", padding: "16px 18px 26px",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 8 }}>
          <h3 style={{ margin: 0, fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: 17 }}>{title}</h3>
          <button onClick={onClose} aria-label="Fermer" style={{ background: "none", border: "none", color: C.inkSoft, padding: 4 }}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Menu d'un repas                                                     */
/* ------------------------------------------------------------------ */
export function MealActions({
  meal, items, currentDate, allDays, labels, order, templates,
  onClose, onCopyIn, onCopyTo, onSaveTemplate, onDeleteTemplate, onAddTemplate, onClear, onScale,
}) {
  const [mode, setMode] = useState(items.length ? "menu" : "from");
  const title = labels[meal];

  if (mode === "from") {
    return (
      <Sheet title={`${title} : copier un repas`} onClose={onClose}>
        <CopyFrom meal={meal} currentDate={currentDate} allDays={allDays} labels={labels} order={order}
          templates={templates} onDeleteTemplate={onDeleteTemplate}
          onCopy={(list) => { onCopyIn(list); onClose(); }}
          onAddTemplate={(t) => { onAddTemplate(t); onClose(); }} />
      </Sheet>
    );
  }
  if (mode === "to") {
    return (
      <Sheet title={`Copier « ${title} » vers…`} onClose={onClose}>
        <CopyTo meal={meal} items={items} currentDate={currentDate} labels={labels} order={order}
          onCopy={(list, d, m) => { onCopyTo(list, d, m); onClose(); }} />
      </Sheet>
    );
  }
  if (mode === "template") {
    return (
      <Sheet title="Enregistrer comme repas type" onClose={onClose}>
        <SaveTemplate meal={meal} items={items} labels={labels} onSave={(name, list) => { onSaveTemplate(name, list); onClose(); }} />
      </Sheet>
    );
  }
  if (mode === "scale") {
    return (
      <Sheet title={`${title} : j'en ai mangé…`} onClose={onClose}>
        <p style={{ fontSize: 12.5, color: C.inkSoft, marginTop: 0 }}>Toutes les quantités du repas ({sumKcal(items)} kcal) sont multipliées par la fraction choisie.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
          {[[0.25, "¼"], [1 / 3, "⅓"], [0.5, "la moitié"], [2 / 3, "⅔"], [0.75, "¾"], [1.5, "×1,5"]].map(([f, l]) => (
            <button key={l} onClick={() => { onScale(f); onClose(); }} style={{
              padding: "12px 4px", borderRadius: 12, border: `1.5px solid ${f === 0.5 ? C.herb : C.line}`, background: f === 0.5 ? C.sage : C.card,
              display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
            }}>
              <span style={{ fontSize: 16, fontWeight: 600 }}>{l}</span>
              <span style={{ fontFamily: MONO, fontSize: 11, color: C.inkSoft }}>{Math.round(sumKcal(items) * f)} kcal</span>
            </button>
          ))}
        </div>
        <p style={{ fontSize: 11, color: C.inkSoft, margin: "8px 0 0" }}>Pour un seul aliment : touche-le dans le repas, puis « J'en ai mangé : ½ ».</p>
      </Sheet>
    );
  }
  if (mode === "clear") {
    return (
      <Sheet title={`Vider « ${title} » ?`} onClose={onClose}>
        <p style={{ fontSize: 13, color: C.inkSoft, marginTop: 0 }}>Les {items.length} aliments ({sumKcal(items)} kcal) seront retirés de ce jour.</p>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setMode("menu")} style={{ flex: 1, padding: "11px 0", borderRadius: 12, border: `1px solid ${C.line}`, background: C.card, fontSize: 13 }}>Annuler</button>
          <button onClick={() => { onClear(); onClose(); }} style={{ flex: 1, padding: "11px 0", borderRadius: 12, border: "none", background: C.berry, color: "#fff", fontWeight: 600, fontSize: 13 }}>Vider</button>
        </div>
      </Sheet>
    );
  }
  const row = { width: "100%", textAlign: "left", background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: "12px 14px", fontSize: 14, marginBottom: 8 };
  return (
    <Sheet title={title} onClose={onClose}>
      <button style={row} onClick={() => setMode("from")}>↺ Copier depuis un autre jour / un repas type
        <span style={{ display: "block", fontSize: 11.5, color: C.inkSoft }}>Tout le repas ou seulement certains aliments</span></button>
      {items.length > 0 && <button style={row} onClick={() => setMode("scale")}>½ Je n'en ai mangé qu'une partie
        <span style={{ display: "block", fontSize: 11.5, color: C.inkSoft }}>Divise tout le repas : moitié, tiers, trois quarts…</span></button>}
      {items.length > 0 && <button style={row} onClick={() => setMode("to")}>⇢ Copier ce repas vers un autre jour</button>}
      {items.length > 0 && <button style={row} onClick={() => setMode("template")}>★ Enregistrer comme repas type
        <span style={{ display: "block", fontSize: 11.5, color: C.inkSoft }}>Ex. « Mon petit-déj habituel », à ajouter en 1 geste</span></button>}
      {items.length > 0 && <button style={{ ...row, color: C.berry }} onClick={() => setMode("clear")}>Vider ce repas</button>}
    </Sheet>
  );
}

/** Liste des repas des 14 derniers jours (+ repas types), avec choix des aliments à copier. */
function CopyFrom({ meal, currentDate, allDays, labels, order, templates, onCopy, onAddTemplate, onDeleteTemplate }) {
  const [onlySame, setOnlySame] = useState(true);
  const [open, setOpen] = useState(null);
  const [picked, setPicked] = useState({});
  const sources = useMemo(() => {
    const out = [];
    for (let i = 1; i <= 14; i++) {
      const d = addDays(currentDate, -i);
      const day = allDays?.[d];
      if (!day?.meals) continue;
      (onlySame ? [meal] : order).forEach((m) => {
        const list = day.meals[m] || [];
        if (list.length) out.push({ key: d + ":" + m, date: d, meal: m, list });
      });
    }
    return out;
  }, [allDays, currentDate, meal, onlySame, order]);

  function toggleOpen(s) {
    if (open === s.key) { setOpen(null); return; }
    setOpen(s.key);
    setPicked(Object.fromEntries(s.list.map((e) => [e.id, true])));
  }

  return (
    <div>
      {(templates || []).length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <p style={{ fontSize: 11.5, fontWeight: 600, color: C.inkSoft, textTransform: "uppercase", letterSpacing: 0.4, margin: "0 0 6px" }}>Mes repas types</p>
          {templates.map((t) => (
            <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <button onClick={() => onAddTemplate(t)} style={{ flex: 1, textAlign: "left", background: C.sage, border: "none", borderRadius: 12, padding: "9px 12px", minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: C.herb }}>★ {t.name}</span>
                <span style={{ display: "block", fontSize: 11, color: C.inkSoft, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {t.items.length} aliments · {sumKcal(t.items)} kcal · {t.items.map((e) => e.name).join(", ")}
                </span>
              </button>
              <button onClick={() => onDeleteTemplate(t.id)} aria-label="Supprimer le repas type" style={{ background: "none", border: "none", color: C.inkSoft, padding: 6 }}><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        <button onClick={() => setOnlySame(true)} style={chip(onlySame)}>{labels[meal]} seulement</button>
        <button onClick={() => setOnlySame(false)} style={chip(!onlySame)}>Tous les repas</button>
      </div>
      {sources.length === 0 && <p style={{ fontSize: 13, color: C.inkSoft, fontStyle: "italic" }}>Rien de noté ces 14 derniers jours{onlySame ? " pour ce repas" : ""}.</p>}
      {sources.map((s) => {
        const isOpen = open === s.key;
        const n = s.list.filter((e) => picked[e.id]).length;
        return (
          <div key={s.key} style={{ background: C.card, border: `1px solid ${isOpen ? C.herb : C.line}`, borderRadius: 12, marginBottom: 8, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 8px 8px 12px" }}>
              <button onClick={() => toggleOpen(s)} style={{ flex: 1, minWidth: 0, textAlign: "left", background: "none", border: "none", padding: 0 }}>
                <span style={{ display: "block", fontSize: 13.5, fontWeight: 600 }}>{dayLabel(s.date, currentDate)} · {labels[s.meal]}
                  <span style={{ fontFamily: MONO, fontSize: 11, color: C.inkSoft, fontWeight: 500 }}> · {sumKcal(s.list)} kcal</span></span>
                <span style={{ display: "block", fontSize: 11.5, color: C.inkSoft, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: isOpen ? "normal" : "nowrap" }}>
                  {isOpen ? "Choisis les aliments à copier :" : s.list.map((e) => e.name).join(", ")}
                </span>
              </button>
              {!isOpen && (
                <button onClick={() => onCopy(s.list)} style={{ background: C.herb, color: "#fff", border: "none", borderRadius: 999, padding: "7px 12px", fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
                  Tout copier
                </button>
              )}
            </div>
            {isOpen && (
              <div style={{ padding: "0 12px 12px" }}>
                {s.list.map((e) => (
                  <label key={e.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderTop: `1px solid ${C.line}`, fontSize: 13 }}>
                    <input type="checkbox" checked={!!picked[e.id]} onChange={() => setPicked((p) => ({ ...p, [e.id]: !p[e.id] }))} style={{ width: 18, height: 18, accentColor: C.herb }} />
                    <span style={{ flex: 1, minWidth: 0 }}>{e.name}</span>
                    <span style={{ fontFamily: MONO, fontSize: 11, color: C.inkSoft }}>{e.grams ? `${e.grams} g · ` : ""}{Math.round(e.kcal)} kcal</span>
                  </label>
                ))}
                <button disabled={!n} onClick={() => onCopy(s.list.filter((e) => picked[e.id]))} style={{ ...primary(!n), marginTop: 6 }}>
                  Copier {n} aliment{n > 1 ? "s" : ""} ({sumKcal(s.list.filter((e) => picked[e.id]))} kcal)
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function CopyTo({ meal, items, currentDate, labels, order, onCopy }) {
  const [date, setDate] = useState(addDays(currentDate, 1));
  const [toMeal, setToMeal] = useState(meal);
  const [picked, setPicked] = useState(() => Object.fromEntries(items.map((e) => [e.id, true])));
  const list = items.filter((e) => picked[e.id]);
  const same = date === currentDate && toMeal === meal;
  return (
    <div>
      <p style={{ fontSize: 12, color: C.inkSoft, margin: "0 0 6px" }}>Jour</p>
      <div className="scrollx" style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 8 }}>
        {[1, 2, 0, -1].map((k) => { const d = addDays(currentDate, k); return <button key={k} onClick={() => setDate(d)} style={chip(date === d)}>{dayLabel(d, currentDate)}</button>; })}
        <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} style={{ ...inputStyle, padding: "5px 8px", fontSize: 12, width: "auto" }} />
      </div>
      <p style={{ fontSize: 12, color: C.inkSoft, margin: "8px 0 6px" }}>Repas</p>
      <div className="scrollx" style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 12 }}>
        {order.map((m) => <button key={m} onClick={() => setToMeal(m)} style={chip(toMeal === m)}>{labels[m]}</button>)}
      </div>
      {items.map((e) => (
        <label key={e.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderTop: `1px solid ${C.line}`, fontSize: 13 }}>
          <input type="checkbox" checked={!!picked[e.id]} onChange={() => setPicked((p) => ({ ...p, [e.id]: !p[e.id] }))} style={{ width: 18, height: 18, accentColor: C.herb }} />
          <span style={{ flex: 1, minWidth: 0 }}>{e.name}</span>
          <span style={{ fontFamily: MONO, fontSize: 11, color: C.inkSoft }}>{Math.round(e.kcal)} kcal</span>
        </label>
      ))}
      <button disabled={!list.length || same} onClick={() => onCopy(list, date, toMeal)} style={{ ...primary(!list.length || same), marginTop: 10 }}>
        Copier {list.length} aliment{list.length > 1 ? "s" : ""} → {dayLabel(date, currentDate)}, {labels[toMeal].toLowerCase()}
      </button>
      <p style={{ fontSize: 11, color: C.inkSoft, margin: "6px 0 0" }}>Le repas d'origine reste en place (c'est une copie).</p>
    </div>
  );
}

function SaveTemplate({ meal, items, labels, onSave }) {
  const [name, setName] = useState(meal === "petitdej" ? "Mon petit-déj habituel" : `Mon ${labels[meal].toLowerCase()} type`);
  return (
    <div>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom du repas type" style={{ ...inputStyle, width: "100%", marginBottom: 10 }} />
      <p style={{ fontSize: 12, color: C.inkSoft, margin: "0 0 12px" }}>{items.length} aliments · {sumKcal(items)} kcal : {items.map((e) => e.name).join(", ")}</p>
      <button disabled={!name.trim()} onClick={() => onSave(name.trim(), items)} style={primary(!name.trim())}>Enregistrer</button>
      <p style={{ fontSize: 11, color: C.inkSoft, margin: "6px 0 0" }}>Tu le retrouveras dans « Ajouter » → onglet Repas, et dans le menu ⋯ de chaque repas.</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Valeurs pour 100 g : saisie (nouveau produit) ou correction          */
/* ------------------------------------------------------------------ */
export function Per100Fields({ values, onChange }) {
  const f = (k, label) => (
    <label style={{ fontSize: 11, color: C.inkSoft }}>{label}
      <NumInput value={values[k]} min={0} max={k === "kcal" ? 950 : 100} onChange={(v) => onChange({ ...values, [k]: v })}
        style={{ ...inputStyle, width: "100%", marginTop: 3, fontFamily: MONO, fontSize: 14 }} />
    </label>
  );
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
      {f("kcal", "Kcal / 100 g")}{f("prot", "Protéines (g)")}{f("carbs", "Glucides (g)")}{f("fat", "Lipides (g)")}
    </div>
  );
}

/** Lit l'étiquette nutritionnelle d'un emballage avec Gemini. */
async function readLabelWithAi(apiKey, file, onStatus) {
  const small = await shrinkImage(file);
  if (!small) throw new Error("photo illisible");
  const text = await geminiGenerate(apiKey, [
    { text: "Photo d'un emballage alimentaire. Lis le tableau des valeurs nutritionnelles POUR 100 g (ou 100 ml) et le nom du produit. Réponds UNIQUEMENT en JSON : {\"name\":\"nom du produit et marque\",\"kcal\":0,\"prot\":0,\"carbs\":0,\"fat\":0}. Si une valeur n'est pas lisible, mets null." },
    { inline_data: { mime_type: small.mime, data: small.base64 } },
  ], { onStatus, temperature: 0.1 });
  const r = parseJSONLoose(text) || {};
  const num = (v) => (v == null || Number.isNaN(Number(v)) ? null : round(Number(v)));
  return { name: r.name ? String(r.name) : "", kcal: num(r.kcal), prot: num(r.prot), carbs: num(r.carbs), fat: num(r.fat) };
}

/** Produit inconnu au scan : on propose de le créer (option : lecture de l'étiquette par l'IA). */
export function NewProductForm({ barcode, initialName, geminiKey, onSave, onCancel }) {
  const [name, setName] = useState(initialName || "");
  const [vals, setVals] = useState({ kcal: null, prot: null, carbs: null, fat: null });
  const [ai, setAi] = useState(null);
  const ok = name.trim() && vals.kcal != null;
  async function onPhoto(file) {
    if (!file) return;
    setAi({ busy: true });
    try {
      const r = await readLabelWithAi(geminiKey, file, (t) => setAi({ busy: true, status: t }));
      if (r.name && !name.trim()) setName(r.name);
      setVals((v) => ({ kcal: r.kcal ?? v.kcal, prot: r.prot ?? v.prot, carbs: r.carbs ?? v.carbs, fat: r.fat ?? v.fat }));
      setAi({ done: true });
    } catch (e) { setAi({ error: e.message || "erreur" }); }
  }
  return (
    <div style={{ marginTop: 12, background: C.card, border: `1.5px solid ${C.herb}`, borderRadius: 16, padding: 14 }}>
      <p style={{ margin: "0 0 2px", fontSize: 14, fontWeight: 600 }}>Produit inconnu : ajoute-le !</p>
      <p style={{ margin: "0 0 10px", fontSize: 11.5, color: C.inkSoft }}>Code {barcode}. Recopie le tableau nutritionnel de l'emballage (pour 100 g). La prochaine fois, le scan le trouvera directement.</p>
      {geminiKey && (
        <label style={{
          width: "100%", padding: "10px 0", borderRadius: 10, border: `1.5px solid ${C.ochre}`, background: C.ochreLight, color: C.ink, marginBottom: 10,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
        }}>
          {ai?.busy ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Sparkles size={14} />}
          {ai?.busy ? (ai.status || "Lecture de l'étiquette…") : "Photographier l'étiquette (remplissage par l'IA)"}
          <input type="file" accept="image/*" capture="environment" style={{ display: "none" }} disabled={ai?.busy}
            onChange={(e) => { onPhoto(e.target.files[0]); e.target.value = ""; }} />
        </label>
      )}
      {ai?.done && <p style={{ fontSize: 11.5, color: C.herb, margin: "-4px 0 8px" }}>✓ Valeurs lues : vérifie-les avant d'enregistrer.</p>}
      {ai?.error && <p style={{ fontSize: 11.5, color: C.berry, margin: "-4px 0 8px" }}>IA : {ai.error}</p>}
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom (ex : Yaourt grec – Marque)" style={{ ...inputStyle, width: "100%", marginBottom: 8 }} />
      <Per100Fields values={vals} onChange={setVals} />
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button onClick={onCancel} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: `1px solid ${C.line}`, background: "transparent", color: C.inkSoft, fontSize: 13 }}>Annuler</button>
        <button disabled={!ok} onClick={() => onSave({ name: name.trim(), barcode, kcal: vals.kcal || 0, prot: vals.prot || 0, carbs: vals.carbs || 0, fat: vals.fat || 0 })}
          style={{ flex: 2, padding: "10px 0", borderRadius: 10, border: "none", background: C.herb, color: "#fff", fontWeight: 600, fontSize: 13, opacity: ok ? 1 : 0.5 }}>
          Enregistrer et utiliser
        </button>
      </div>
    </div>
  );
}

