// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Les auteurs de NutriMaison
/* Écran « Ajouter » : recherche, favoris, scanner, photo, texte IA, recettes */
import React, { useState, useEffect, useRef } from "react";
import { Camera, ChevronLeft, Loader2, Plus, ScanLine, Search, ShoppingBag, Sparkles, Trash2, X } from "lucide-react";
import { NewProductForm, Per100Fields } from "../MealTools.jsx";
import { openCamera } from "../scanner.js";
import { C, NumInput, Tag, inputStyle, round } from "../shared.jsx";
import { AiTextMeal, aiFoodPer100 } from "../AiMeal.jsx";
import { MEAL_LABELS, MEAL_ORDER, calcFromFood } from "../foodData.js";

/* ---------------------------------------------------------------- */
/* AJOUTER UN ALIMENT                                                 */
/* ---------------------------------------------------------------- */
/** Caméra intégrée à l'app pour photographier un repas (ne dépend pas de l'appareil photo d'Android). */
export function MealCamera({ onCapture, onCancel }) {
  const videoRef = useRef(null);
  const camRef = useRef(null);
  const [error, setError] = useState(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    openCamera(videoRef.current).then((cam) => {
      if (!alive) { cam.stop(); return; }
      camRef.current = cam; setReady(true);
    }).catch((e) => setError(e && e.name === "NotAllowedError"
      ? "Accès à la caméra refusé. Autorise la caméra pour NutriMaison dans les paramètres Android."
      : "Impossible d'ouvrir la caméra."));
    return () => { alive = false; try { camRef.current?.stop(); } catch (e) {} };
  }, []);
  async function shoot() {
    if (!camRef.current) return;
    try { navigator.vibrate && navigator.vibrate(60); } catch (e) {}
    const file = await camRef.current.snap();
    camRef.current.stop();
    onCapture(file);
  }
  return (
    <div>
      <div style={{ position: "relative", borderRadius: 16, overflow: "hidden", background: "#000", marginBottom: 10 }}>
        <video ref={videoRef} muted playsInline autoPlay style={{ width: "100%", height: 320, objectFit: "cover", display: "block" }} />
        {!ready && !error && <p style={{ position: "absolute", inset: 0, margin: 0, display: "flex", alignItems: "center", justifyContent: "center", color: C.onAccent, fontSize: 13 }}>Ouverture de la caméra…</p>}
      </div>
      {error && <p style={{ color: C.berry, fontSize: 12.5, margin: "0 0 10px" }}>{error}</p>}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button onClick={onCancel} style={{ flex: 1, padding: "12px 0", borderRadius: 12, border: `1px solid ${C.line}`, background: C.card, color: C.inkSoft, fontSize: 13 }}>Annuler</button>
        <button onClick={shoot} disabled={!ready} aria-label="Prendre la photo" style={{
          width: 64, height: 64, borderRadius: 999, border: `4px solid ${C.sage}`, background: C.herb, opacity: ready ? 1 : 0.5, flexShrink: 0,
        }} />
        <div style={{ flex: 1 }} />
      </div>
      <p style={{ fontSize: 11.5, color: C.inkSoft, margin: "8px 0 0", lineHeight: 1.45 }}>Cadre l'assiette entière, vue de dessus, avec un bon éclairage.</p>
    </div>
  );
}

/** Favoris et aliments récents : un appui sur « + » ajoute la même quantité que la dernière fois. */
export function QuickLists({ favorites, recents, onToggleFavorite, onQuickAdd, onPick, templates, onAddTemplate, onDeleteTemplate }) {
  const [tab, setTab] = useState(favorites?.length ? "fav" : "rec");
  const favKeys = new Set((favorites || []).map((f) => f.key));
  const list = tab === "fav" ? favorites || [] : recents || [];
  if (!(favorites || []).length && !(recents || []).length && !(templates || []).length) return null;
  const pill = (active) => ({ padding: "5px 12px", borderRadius: 999, border: "none", fontSize: 12, fontWeight: 600, background: active ? C.herb : C.paperDark, color: active ? C.onAccent : C.inkSoft });
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        <button onClick={() => setTab("fav")} style={pill(tab === "fav")}>★ Favoris{favorites?.length ? ` (${favorites.length})` : ""}</button>
        <button onClick={() => setTab("rec")} style={pill(tab === "rec")}>Récents</button>
        <button onClick={() => setTab("tpl")} style={pill(tab === "tpl")}>Repas{templates?.length ? ` (${templates.length})` : ""}</button>
      </div>
      {tab === "tpl" ? (
        (templates || []).length === 0 ? (
          <p style={{ fontSize: 12, color: C.inkSoft, fontStyle: "italic", margin: 0 }}>
            Aucun repas type. Sur l'accueil, touche ⋯ à côté d'un repas → « Enregistrer comme repas type ».
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {templates.map((t) => (
              <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 6, background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: "6px 6px 6px 10px" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 13.5, fontWeight: 600 }}>★ {t.name}</span>
                  <span style={{ display: "block", fontSize: 11, color: C.inkSoft, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {Math.round(t.items.reduce((a, e) => a + (e.kcal || 0), 0))} kcal · {t.items.map((e) => e.name).join(", ")}
                  </span>
                </div>
                <button onClick={() => onDeleteTemplate(t.id)} aria-label="Supprimer" style={{ background: "none", border: "none", color: C.inkSoft, padding: 4 }}><Trash2 size={14} /></button>
                <button onClick={() => onAddTemplate(t)} aria-label="Ajouter le repas" style={{
                  background: C.sage, border: "none", borderRadius: 999, width: 32, height: 32, color: C.herb, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}><Plus size={16} /></button>
              </div>
            ))}
          </div>
        )
      ) : list.length === 0 ? (
        <p style={{ fontSize: 12, color: C.inkSoft, fontStyle: "italic", margin: 0 }}>
          {tab === "fav" ? "Aucun favori : touche ☆ sur un récent, ou sur un aliment du journal." : "Les aliments que tu notes apparaîtront ici."}
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {list.slice(0, 12).map((it) => (
            <div key={it.key} style={{ display: "flex", alignItems: "center", gap: 6, background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: "6px 6px 6px 10px" }}>
              <button onClick={() => onToggleFavorite(it)} aria-label="Favori" style={{ background: "none", border: "none", color: favKeys.has(it.key) ? C.ochre : C.line, fontSize: 17, padding: 2, lineHeight: 1 }}>
                {favKeys.has(it.key) ? "★" : "☆"}
              </button>
              <button onClick={() => { if (!onPick(it)) onQuickAdd(it); }} style={{ flex: 1, minWidth: 0, textAlign: "left", background: "none", border: "none", padding: "2px 0" }}>
                <span style={{ display: "block", fontSize: 13.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</span>
                <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: C.inkSoft }}>
                  {it.grams ? `${it.grams} g · ` : ""}{Math.round(it.kcal)} kcal{it.count > 1 ? ` · ${it.count}×` : ""}
                </span>
              </button>
              <button onClick={() => onQuickAdd(it)} aria-label="Ajouter tel quel" style={{
                background: C.sage, border: "none", borderRadius: 999, width: 32, height: 32, color: C.herb, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}><Plus size={16} /></button>
            </div>
          ))}
        </div>
      )}
      <p style={{ fontSize: 10.5, color: C.inkSoft, margin: "6px 0 0" }}>{tab === "tpl" ? "« + » ajoute tous les aliments du repas type d'un coup." : "« + » ajoute la même quantité que la dernière fois · touche le nom pour changer la quantité."}</p>
    </div>
  );
}

export function ManualBarcode({ onSubmit, busy }) {
  const [code, setCode] = useState("");
  return (
    <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
      <input type="number" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Ou tape les chiffres du code"
        style={{ ...inputStyle, flex: 1, fontSize: 13.5 }} />
      <button disabled={busy || code.length < 8} onClick={() => onSubmit(code)} style={{
        background: C.herb, color: C.onAccent, border: "none", borderRadius: 10, padding: "0 14px", fontWeight: 600, fontSize: 13, opacity: busy || code.length < 8 ? 0.5 : 1,
      }}>OK</button>
    </div>
  );
}

export function AddView(props) {
  const {
    addMeal, setAddMeal, addTab, setAddTab, onBack,
    searchQ, setSearchQ, filteredFoods, offResults, offLoading, offError, onAddCustomFood,
    favorites, recents, onToggleFavorite, onQuickAdd, onPickRecent,
    selectedFood, setSelectedFood, grams, setGrams, onConfirmManual,
    scanning, scanError, videoRef, onStartScan, onStopScan,
    scanMissing, onCancelMissing, onSaveNewProduct, mealTemplates, onAddTemplate, onDeleteTemplate,
    torchAvailable, torchOn, onToggleTorch, scanBusy, onScanPhoto, onScanManual,
    photoDetecting, photoDetections, photoAiResults, photoError, capturedImage, photoInputRef, onPickPhoto, onPhotoFileChange, onPickPhotoDetection, onPhotoFile, onCancelPhoto,
    onAddAiPhotoResults, onRemoveAiPhotoResult, hasGeminiKey, geminiKey, onAddEntries, onSaveFoods, onSaveAiRecipe,
    allRecipes, onPickRecipeFromAdd,
  } = props;

  const [customFormOpen, setCustomFormOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [aiLookup, setAiLookup] = useState(null);
  const [quickMsg, setQuickMsg] = useState(null);
  const [cfName, setCfName] = useState("");
  const [cfKcal, setCfKcal] = useState("");
  const [cfProt, setCfProt] = useState("");
  const [cfCarbs, setCfCarbs] = useState("");
  const [cfFat, setCfFat] = useState("");

  function submitCustomFood() {
    if (!cfName.trim() || cfKcal === "") return;
    const food = onAddCustomFood({
      name: cfName.trim(), kcal: Number(cfKcal) || 0, prot: Number(cfProt) || 0, carbs: Number(cfCarbs) || 0, fat: Number(cfFat) || 0,
    });
    setSelectedFood(food); setGrams(100);
    setCustomFormOpen(false); setCfName(""); setCfKcal(""); setCfProt(""); setCfCarbs(""); setCfFat("");
  }

  const previewMacros = selectedFood ? calcFromFood(selectedFood, grams) : null;
  const [editVals, setEditVals] = useState(false);
  useEffect(() => { if (!selectedFood?.edited) setEditVals(false); }, [selectedFood?.id]);
  const patchFood = (p) => setSelectedFood({ ...selectedFood, ...p, edited: true });

  return (
    <div style={{ padding: "24px 20px 8px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: C.herb, padding: 6 }}>
          <ChevronLeft size={20} />
        </button>
        <h2 style={{ margin: 0, fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: 20 }}>Ajouter un aliment</h2>
      </div>

      <div style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 12, color: C.inkSoft, marginBottom: 6 }}>Repas</p>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {MEAL_ORDER.map((m) => (
            <button key={m} onClick={() => setAddMeal(m)} style={{
              flexShrink: 0, padding: "7px 12px", borderRadius: 999, border: `1px solid ${addMeal === m ? C.herb : C.line}`,
              background: addMeal === m ? C.herb : C.card, color: addMeal === m ? C.onAccent : C.ink, fontSize: 12.5, fontWeight: 500,
            }}>{MEAL_LABELS[m]}</button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 18, background: C.paperDark, borderRadius: 12, padding: 4 }}>
        {[["manuel", "Manuel"], ["scanner", "Scanner"], ["photo", "Photo"], ["ia", "Texte IA"], ["recette", "Recette"]].map(([k, label]) => (
          <button key={k} onClick={() => setAddTab(k)} style={{
            flex: 1, padding: "8px 0", borderRadius: 9, border: "none", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap",
            background: addTab === k ? C.card : "transparent", color: addTab === k ? C.herb : C.inkSoft,
          }}>{label}</button>
        ))}
      </div>

      {addTab === "manuel" && (
        <div>
          <div style={{ position: "relative", marginBottom: 14 }}>
            <Search size={16} color={C.inkSoft} style={{ position: "absolute", left: 12, top: 12 }} />
            <input
              value={searchQ} onChange={(e) => setSearchQ(e.target.value)} placeholder="Rechercher un aliment…"
              style={{ width: "100%", padding: "11px 12px 11px 36px", borderRadius: 12, border: `1px solid ${C.line}`, background: C.card, fontSize: 14, outline: "none" }}
            />
          </div>

          {!selectedFood ? (
            <div>
              {!searchQ.trim() && (
                <QuickLists favorites={favorites} recents={recents} onToggleFavorite={onToggleFavorite}
                  templates={mealTemplates} onDeleteTemplate={onDeleteTemplate}
                  onAddTemplate={(t) => { onAddTemplate(t); setQuickMsg(`${t.name} ajouté ✓`); setTimeout(() => setQuickMsg(null), 1800); }}
                  onQuickAdd={(it) => { onQuickAdd(it); setQuickMsg(`${it.name} ajouté ✓`); setTimeout(() => setQuickMsg(null), 1800); }}
                  onPick={onPickRecent} />
              )}
              {quickMsg && <p style={{ position: "sticky", top: 8, zIndex: 2, background: C.herb, color: C.onAccent, borderRadius: 10, padding: "8px 12px", fontSize: 12.5, margin: "0 0 10px", textAlign: "center" }}>{quickMsg}</p>}
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", margin: "0 0 6px", gap: 8 }}>
                <p style={{ fontSize: 11.5, fontWeight: 600, color: C.inkSoft, textTransform: "uppercase", letterSpacing: 0.4, margin: 0 }}>Aliments de base</p>
                {searchQ.trim() && <span style={{ fontSize: 10, color: C.inkSoft }}>Source : Anses, Ciqual 2025</span>}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 18 }}>
                {filteredFoods.map((f) => (
                  <button key={f.id} onClick={() => { setSelectedFood(f); setGrams(100); }} style={{
                    textAlign: "left", background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: "10px 12px",
                    display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
                  }}>
                    <span style={{ fontSize: 13.5, minWidth: 0 }}>
                      {f.name}
                      {f.group && <span style={{ display: "block", fontSize: 10.5, color: C.inkSoft }}>{f.group}</span>}
                    </span>
                    <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: C.inkSoft, flexShrink: 0 }}>{Math.round(f.kcal)} kcal/100g</span>
                  </button>
                ))}
                {filteredFoods.length === 0 && <p style={{ fontSize: 13, color: C.inkSoft, fontStyle: "italic" }}>Aucun résultat.</p>}
              </div>

              {searchQ.trim().length >= 2 && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "0 0 6px" }}>
                    <ShoppingBag size={12} color={C.inkSoft} />
                    <p style={{ fontSize: 11.5, fontWeight: 600, color: C.inkSoft, textTransform: "uppercase", letterSpacing: 0.4, margin: 0 }}>Produits de marque</p>
                    {offLoading && <Loader2 size={12} color={C.inkSoft} style={{ animation: "spin 1s linear infinite" }} />}
                  </div>
                  {offError && <p style={{ fontSize: 12, color: C.inkSoft, fontStyle: "italic" }}>{offError}</p>}
                  {!offError && !offLoading && offResults.length === 0 && (
                    <p style={{ fontSize: 12, color: C.inkSoft, fontStyle: "italic" }}>Aucun produit de marque trouvé.</p>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {offResults.map((f) => (
                      <button key={f.id} onClick={() => { setSelectedFood(f); setGrams(100); }} style={{
                        textAlign: "left", background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: "8px 12px",
                        display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                          {f.image ? (
                            <img src={f.image} alt="" style={{ width: 30, height: 30, borderRadius: 6, objectFit: "cover", flexShrink: 0, border: `1px solid ${C.line}` }} />
                          ) : (
                            <div style={{ width: 30, height: 30, borderRadius: 6, background: C.sage, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              <ShoppingBag size={13} color={C.herb} />
                            </div>
                          )}
                          <span style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                        </div>
                        <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: C.inkSoft, flexShrink: 0 }}>{Math.round(f.kcal)} kcal/100g</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {hasGeminiKey && searchQ.trim().length >= 2 && !offLoading && (
                <div style={{ marginTop: 10 }}>
                  <button onClick={async () => {
                    setAiLookup({ busy: true });
                    try { const f = await aiFoodPer100(geminiKey, searchQ, (t) => setAiLookup({ busy: true, status: t })); setAiLookup(null); setSelectedFood(f); setGrams(100); }
                    catch (e) { setAiLookup({ error: e.message || "erreur" }); }
                  }} disabled={aiLookup?.busy} style={{
                    width: "100%", padding: "9px 10px", borderRadius: 10, border: `1.5px solid ${C.ochre}`, background: C.ochreLight, color: C.ink,
                    fontSize: 12.5, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  }}>
                    {aiLookup?.busy ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Sparkles size={14} />}
                    {aiLookup?.busy ? (aiLookup.status || "Estimation…") : `Pas trouvé ? Estimer « ${searchQ.trim().slice(0, 30)} » avec l'IA`}
                  </button>
                  {aiLookup?.error && <p style={{ fontSize: 11.5, color: C.berry, margin: "4px 0 0" }}>IA : {aiLookup.error}</p>}
                </div>
              )}
              {!customFormOpen ? (
                <button onClick={() => setCustomFormOpen(true)} style={{
                  width: "100%", marginTop: 16, padding: "10px 0", borderRadius: 10, border: `1.5px dashed ${C.line}`, background: "transparent",
                  color: C.herb, fontSize: 12.5, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                }}>
                  <Plus size={14} /> Créer un aliment / produit personnalisé
                </button>
              ) : (
                <div style={{ marginTop: 16, background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: 14 }}>
                  <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 600 }}>Nouvel aliment (valeurs pour 100 g)</p>
                  <input value={cfName} onChange={(e) => setCfName(e.target.value)} placeholder="Nom (ex : Jambon de dinde – marque locale)"
                    style={{ width: "100%", padding: "9px 10px", borderRadius: 9, border: `1px solid ${C.line}`, fontSize: 13, marginBottom: 8 }} />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                    <input value={cfKcal} onChange={(e) => setCfKcal(e.target.value)} type="number" placeholder="Kcal"
                      style={{ padding: "9px 10px", borderRadius: 9, border: `1px solid ${C.line}`, fontSize: 13, fontFamily: "'IBM Plex Mono',monospace" }} />
                    <input value={cfProt} onChange={(e) => setCfProt(e.target.value)} type="number" placeholder="Protéines (g)"
                      style={{ padding: "9px 10px", borderRadius: 9, border: `1px solid ${C.line}`, fontSize: 13, fontFamily: "'IBM Plex Mono',monospace" }} />
                    <input value={cfCarbs} onChange={(e) => setCfCarbs(e.target.value)} type="number" placeholder="Glucides (g)"
                      style={{ padding: "9px 10px", borderRadius: 9, border: `1px solid ${C.line}`, fontSize: 13, fontFamily: "'IBM Plex Mono',monospace" }} />
                    <input value={cfFat} onChange={(e) => setCfFat(e.target.value)} type="number" placeholder="Lipides (g)"
                      style={{ padding: "9px 10px", borderRadius: 9, border: `1px solid ${C.line}`, fontSize: 13, fontFamily: "'IBM Plex Mono',monospace" }} />
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => setCustomFormOpen(false)} style={{ flex: 1, padding: "10px 0", borderRadius: 9, border: `1px solid ${C.line}`, background: "transparent", color: C.inkSoft, fontSize: 13 }}>
                      Annuler
                    </button>
                    <button onClick={submitCustomFood} style={{ flex: 2, padding: "10px 0", borderRadius: 9, border: "none", background: C.herb, color: C.onAccent, fontWeight: 600, fontSize: 13 }}>
                      Enregistrer et utiliser
                    </button>
                  </div>
                  <p style={{ fontSize: 11, color: C.inkSoft, margin: "8px 0 0" }}>Il sera ensuite disponible dans toutes tes recherches, y compris pour tes recettes.</p>
                </div>
              )}
            </div>
          ) : (
            <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  {selectedFood.image && (
                    <img src={selectedFood.image} alt="" style={{ width: 38, height: 38, borderRadius: 8, objectFit: "cover", border: `1px solid ${C.line}`, flexShrink: 0 }} />
                  )}
                  <p style={{ margin: 0, fontFamily: "'Fraunces',serif", fontWeight: 600, fontSize: 16 }}>{selectedFood.name}</p>
                </div>
                <button onClick={() => setSelectedFood(null)} style={{ background: "none", border: "none", color: C.inkSoft, flexShrink: 0 }}><X size={16} /></button>
              </div>
              {!editVals ? (
                <button onClick={() => setEditVals(true)} style={{
                  background: "none", border: "none", padding: 0, margin: "-6px 0 12px", color: C.herb, fontSize: 12.5, fontWeight: 600, textDecoration: "underline",
                }}>✎ Modifier les valeurs ({Math.round(selectedFood.kcal)} kcal · P{round(selectedFood.prot)} G{round(selectedFood.carbs)} L{round(selectedFood.fat)} / 100 g)</button>
              ) : (
                <div style={{ background: C.paperDark, borderRadius: 12, padding: 12, margin: "-4px 0 14px" }}>
                  <p style={{ margin: "0 0 8px", fontSize: 12.5, fontWeight: 600 }}>Valeurs pour 100 g <span style={{ fontWeight: 400, color: C.inkSoft }}>(recopie celles de ton emballage)</span></p>
                  <Per100Fields values={selectedFood} onChange={(v) => patchFood({ kcal: v.kcal ?? 0, prot: v.prot ?? 0, carbs: v.carbs ?? 0, fat: v.fat ?? 0, ciqual: false })} />
                  <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, fontSize: 12.5 }}>
                    <input type="checkbox" checked={!!selectedFood.remember} onChange={(e) => patchFood({ remember: e.target.checked })} style={{ width: 18, height: 18, accentColor: C.herb }} />
                    Mémoriser comme mon aliment
                  </label>
                  {selectedFood.remember && (
                    <input value={selectedFood.name} onChange={(e) => patchFood({ name: e.target.value })} placeholder="Nom de ton aliment"
                      style={{ ...inputStyle, width: "100%", marginTop: 8, fontSize: 13 }} />
                  )}
                  <p style={{ fontSize: 11, color: C.inkSoft, margin: "6px 0 0" }}>
                    {selectedFood.remember ? "Il sera proposé dans tes recherches (remplace un aliment perso du même nom)." : "Les valeurs modifiées ne servent que pour cet ajout."}
                  </p>
                </div>
              )}
              <label style={{ fontSize: 12, color: C.inkSoft }}>Quantité (g)</label>
              <NumInput
                value={grams} onChange={(v) => setGrams(v)} min={0}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${C.line}`, marginTop: 4, marginBottom: 14, fontFamily: "'IBM Plex Mono',monospace", fontSize: 15 }}
              />
              {selectedFood.ciqual && (
                <p style={{ margin: "-6px 0 10px", fontSize: 11.5, color: C.inkSoft, lineHeight: 1.5 }}>
                  Pour {grams} g : {[
                    selectedFood.sugar != null && `sucres ${round(selectedFood.sugar * grams / 100)} g`,
                    selectedFood.fiber != null && `fibres ${round(selectedFood.fiber * grams / 100)} g`,
                    selectedFood.satfat != null && `AG saturés ${round(selectedFood.satfat * grams / 100)} g`,
                    selectedFood.salt != null && `sel ${round(selectedFood.salt * grams / 100)} g`,
                    selectedFood.water100 != null && `eau ${Math.round(selectedFood.water100 * grams / 100)} ml`,
                  ].filter(Boolean).join(" · ")}
                  <span style={{ display: "block", fontSize: 10.5 }}>Valeurs : Anses, table Ciqual 2025</span>
                </p>
              )}
              {previewMacros && (
                <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                  <Tag color={C.herb} bg={C.sage}>{Math.round(previewMacros.kcal)} kcal</Tag>
                  <Tag color={C.berry} bg={C.berryLight}>P {previewMacros.prot}g</Tag>
                  <Tag color={C.ochre} bg={C.ochreLight}>G {previewMacros.carbs}g</Tag>
                  <Tag color={C.olive} bg={C.oliveLight}>L {previewMacros.fat}g</Tag>
                </div>
              )}
              <button onClick={onConfirmManual} style={{
                width: "100%", padding: "13px 0", borderRadius: 12, border: "none", background: C.herb, color: C.onAccent, fontWeight: 600, fontSize: 14,
              }}>Ajouter au journal</button>
            </div>
          )}
        </div>
      )}

      {addTab === "scanner" && (
        <div>
          <p style={{ fontSize: 12.5, color: C.inkSoft, margin: "0 0 12px" }}>
            Scanne le code-barres d'un produit emballé : ses valeurs nutritionnelles sont récupérées automatiquement depuis Open Food Facts.
          </p>

          <div style={{
            position: "relative", borderRadius: 16, overflow: "hidden", border: `1px solid ${C.line}`,
            marginBottom: 10, background: scanning ? "#000" : "transparent", minHeight: scanning ? 260 : 0,
          }}>
            <video ref={videoRef} style={{ width: "100%", display: scanning ? "block" : "none", height: 280, objectFit: "cover" }} muted playsInline autoPlay />
            {scanning && (
              <>
                <div style={{ position: "absolute", left: "10%", right: "10%", top: "25%", bottom: "25%", border: "2.5px solid rgba(255,255,255,0.85)", borderRadius: 12, boxShadow: "0 0 0 2000px rgba(0,0,0,0.25)", pointerEvents: "none" }} />
                <div style={{ position: "absolute", left: 0, right: 0, bottom: 8, textAlign: "center", color: C.onAccent, fontSize: 12, textShadow: "0 1px 3px #000" }}>
                  Place le code-barres dans le cadre, à 10-15 cm
                </div>
                {torchAvailable && (
                  <button onClick={onToggleTorch} style={{ position: "absolute", top: 10, right: 10, background: torchOn ? "#fff" : "rgba(0,0,0,0.5)", color: torchOn ? C.herb : "#fff", border: "none", borderRadius: 999, padding: "6px 12px", fontSize: 12, fontWeight: 600 }}>
                    {torchOn ? "Lampe ON" : "Lampe"}
                  </button>
                )}
              </>
            )}
          </div>

          {!scanning ? (
            <button onClick={onStartScan} disabled={scanBusy} style={{
              width: "100%", padding: "28px 0", borderRadius: 16, border: `1.5px dashed ${C.herb}`, background: C.sage,
              display: "flex", flexDirection: "column", alignItems: "center", gap: 10, color: C.herb,
            }}>
              {scanBusy ? <Loader2 size={26} style={{ animation: "spin 1s linear infinite" }} /> : <ScanLine size={26} />}
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>{scanBusy ? "Recherche du produit…" : "Scanner un code-barres"}</span>
            </button>
          ) : (
            <button onClick={onStopScan} style={{
              width: "100%", padding: "11px 0", borderRadius: 12, border: `1px solid ${C.line}`, background: C.card, color: C.inkSoft, fontSize: 13,
            }}>Annuler le scan</button>
          )}
          <style>{"@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}"}</style>

          {scanError && <p style={{ color: C.berry, fontSize: 13, marginTop: 10, marginBottom: 0 }}>{scanError}</p>}
          {scanMissing && !scanning && (
            <NewProductForm key={scanMissing.barcode} barcode={scanMissing.barcode} initialName={scanMissing.name}
              geminiKey={hasGeminiKey ? geminiKey : ""} onSave={onSaveNewProduct} onCancel={onCancelMissing} />
          )}

          <label style={{
            marginTop: 10, width: "100%", padding: "11px 0", borderRadius: 12, border: `1.5px solid ${C.herb}`, color: C.herb,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}>
            <Camera size={16} /> Prendre le code-barres en photo
            <input type="file" accept="image/*" capture="environment" style={{ display: "none" }}
              onChange={(e) => { onScanPhoto(e.target.files[0]); e.target.value = ""; }} />
          </label>
          <p style={{ fontSize: 11.5, color: C.inkSoft, margin: "6px 0 0", lineHeight: 1.45 }}>
            Plan B si le scan en direct n'accroche pas : l'appareil photo d'Android fait une meilleure mise au point.
          </p>

          <ManualBarcode onSubmit={onScanManual} busy={scanBusy} />

          <p style={{ fontSize: 11.5, color: C.inkSoft, marginTop: 14, lineHeight: 1.5 }}>
            Pas de code-barres sous la main ? Utilise l'onglet <strong>Manuel</strong> pour rechercher le produit par son nom.
          </p>
        </div>
      )}

      {addTab === "photo" && (
        <div>
          <p style={{ fontSize: 12.5, color: C.inkSoft, margin: "0 0 12px" }}>
            {hasGeminiKey
              ? "Reconnaissance IA précise via ta clé Gemini personnelle (gratuite, jamais partagée)."
              : "Détection locale et gratuite (aucune donnée envoyée nulle part). Reconnaît un nombre limité d'aliments — ajoute ta clé Gemini gratuite dans Profil pour une précision bien meilleure."}
          </p>
          <input ref={photoInputRef} type="file" accept="image/*" style={{ display: "none" }}
            onChange={(e) => { onPhotoFileChange(e); e.target.value = ""; }} />

          {cameraOpen ? (
            <MealCamera onCapture={(file) => { setCameraOpen(false); onPhotoFile(file); }} onCancel={() => setCameraOpen(false)} />
          ) : !capturedImage ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button onClick={() => setCameraOpen(true)} style={{
                width: "100%", padding: "30px 0", borderRadius: 16, border: `1.5px dashed ${C.herb}`, background: C.sage,
                display: "flex", flexDirection: "column", alignItems: "center", gap: 10, color: C.herb,
              }}>
                <Camera size={26} />
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>Prendre une photo</span>
              </button>
              <button onClick={onPickPhoto} style={{
                width: "100%", padding: "12px 0", borderRadius: 12, border: `1.5px solid ${C.herb}`, background: "transparent", color: C.herb, fontSize: 13, fontWeight: 600,
              }}>Choisir dans la galerie</button>
            </div>
          ) : (
            <div>
              <img src={capturedImage} alt="" style={{ width: "100%", borderRadius: 14, marginBottom: 10, maxHeight: 220, objectFit: "cover" }} />
              {photoDetecting && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <Loader2 size={15} color={C.herb} style={{ animation: "spin 1s linear infinite" }} />
                  <span style={{ fontSize: 12.5, color: C.inkSoft, flex: 1 }}>Analyse de la photo…</span>
                  <button onClick={onCancelPhoto} style={{ background: "none", border: `1px solid ${C.line}`, borderRadius: 999, padding: "4px 10px", fontSize: 12, color: C.inkSoft }}>Annuler</button>
                  <style>{"@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}"}</style>
                </div>
              )}

              {!photoDetecting && photoAiResults && photoAiResults.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <p style={{ fontSize: 12.5, color: C.inkSoft, margin: "0 0 10px" }}>Aliments détectés — vérifie avant d'ajouter :</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
                    {photoAiResults.map((p) => (
                      <div key={p.id} style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <p style={{ margin: 0, fontSize: 13.5, fontWeight: 500 }}>{p.name}</p>
                          <p style={{ margin: 0, fontSize: 11, color: C.inkSoft, fontFamily: "'IBM Plex Mono',monospace" }}>
                            {p.grams} g · {Math.round(p.kcal)} kcal · P{round(p.prot)} G{round(p.carbs)} L{round(p.fat)}
                          </p>
                        </div>
                        <button onClick={() => onRemoveAiPhotoResult(p.id)} style={{ background: "none", border: "none", color: C.berry, padding: 4 }}><X size={15} /></button>
                      </div>
                    ))}
                  </div>
                  <button onClick={onAddAiPhotoResults} style={{ width: "100%", padding: "13px 0", borderRadius: 12, border: "none", background: C.herb, color: C.onAccent, fontWeight: 600, fontSize: 14, marginBottom: 10 }}>
                    Ajouter au journal
                  </button>
                </div>
              )}

              {!photoDetecting && !photoAiResults && photoDetections.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <p style={{ fontSize: 12, color: C.inkSoft, margin: "0 0 8px" }}>Aliments repérés — touche pour préremplir la recherche :</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {photoDetections.map((d, i) => (
                      <button key={i} onClick={() => onPickPhotoDetection(d)} style={{
                        padding: "7px 12px", borderRadius: 999, border: `1px solid ${C.herb}`, background: C.sage, color: C.herb, fontSize: 12.5, fontWeight: 600,
                      }}>{d.label} · {Math.round(d.score * 100)}%</button>
                    ))}
                  </div>
                </div>
              )}

              {photoError && <p style={{ color: C.berry, fontSize: 12.5, marginBottom: 10 }}>{photoError}</p>}
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setCameraOpen(true)} style={{
                  flex: 1, padding: "11px 0", borderRadius: 12, border: `1px solid ${C.line}`, background: C.card, color: C.inkSoft, fontSize: 13,
                }}>Reprendre une photo</button>
                <button onClick={onPickPhoto} style={{
                  flex: 1, padding: "11px 0", borderRadius: 12, border: `1px solid ${C.line}`, background: C.card, color: C.inkSoft, fontSize: 13,
                }}>Galerie</button>
              </div>
            </div>
          )}
        </div>
      )}

      {addTab === "ia" && (
        <AiTextMeal apiKey={geminiKey} mealLabel={MEAL_LABELS[addMeal]} onAddEntries={onAddEntries} onSaveRecipe={onSaveAiRecipe} onSaveFoods={onSaveFoods} />
      )}

      {addTab === "recette" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {allRecipes.map((r) => (
            <button key={r.id} onClick={() => onPickRecipeFromAdd(r, r.custom)} style={{
              textAlign: "left", background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: "11px 12px",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <span style={{ fontSize: 13.5 }}>{r.name}</span>
              {r.pasCher && <Tag color={C.olive} bg={C.oliveLight}>Pas cher</Tag>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
