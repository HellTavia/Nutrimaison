// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Les auteurs de NutriMaison
/* Choix de la catégorie d'une recette : Petit-déjeuner, Plat (déjeuner / dîner), Soupe, Dessert, Snack. */
import React from "react";
import { C } from "./shared.jsx";
import { RECIPE_CATS, RECIPE_CAT_HINT, MEAL_LABELS, MEAL_ORDER } from "./foodData.js";

export function CatPicker({ value, onChange, label = "Ranger dans" }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <p style={{ fontSize: 12, color: C.inkSoft, margin: "0 0 6px" }}>{label}</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {RECIPE_CATS.map((c) => (
          <button key={c} onClick={() => onChange(c)} style={{
            padding: "6px 11px", borderRadius: 999, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap",
            border: `1px solid ${value === c ? C.herb : C.line}`, background: value === c ? C.herb : C.card, color: value === c ? C.onAccent : C.ink,
          }}>{c}<span style={{ fontWeight: 400, opacity: 0.75 }}> · {RECIPE_CAT_HINT[c]}</span></button>
        ))}
      </div>
    </div>
  );
}

/** Repas pour lesquels la recette est proposée (plusieurs choix possibles). */
export function MealsPicker({ value, onChange, label = "À me proposer pour" }) {
  const set = new Set(value || []);
  return (
    <div style={{ marginBottom: 12 }}>
      <p style={{ fontSize: 12, color: C.inkSoft, margin: "0 0 6px" }}>{label}</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {MEAL_ORDER.map((m) => {
          const on = set.has(m);
          return (
            <button key={m} onClick={() => { const n = new Set(set); on ? n.delete(m) : n.add(m); if (n.size) onChange(MEAL_ORDER.filter((x) => n.has(x))); }} style={{
              padding: "6px 11px", borderRadius: 999, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap",
              border: `1px solid ${on ? C.herb : C.line}`, background: on ? C.herb : C.card, color: on ? C.onAccent : C.ink,
            }}>{on ? "✓ " : ""}{MEAL_LABELS[m]}</button>
          );
        })}
      </div>
    </div>
  );
}
