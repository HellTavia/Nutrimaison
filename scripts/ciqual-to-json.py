#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
# Copyright (C) 2026 Les auteurs de NutriMaison
"""
Convertit la table Ciqual (fichier Excel de l'Anses) en base compacte pour l'app.

Usage :
    pip install openpyxl
    python scripts/ciqual-to-json.py Table_Ciqual_2025_FR.xlsx src/ciqual.json

Source : Anses. Table de composition nutritionnelle des aliments Ciqual (https://ciqual.anses.fr).
Licence Ouverte Etalab. Colonnes conservées : énergie (kcal), eau, protéines, glucides,
lipides, sucres, fibres, AG saturés, sel. "< x" devient x/2, "traces" devient 0, "-" devient vide.
Si l'Anses change l'ordre des colonnes, vérifier les index dans COLS.
"""
import openpyxl, json, sys, re
src, dst = sys.argv[1], sys.argv[2]
wb = openpyxl.load_workbook(src, read_only=True)
ws = wb.worksheets[0]
COLS = {"kcal": 10, "water": 13, "prot": 14, "carbs": 16, "fat": 17, "sugar": 18, "fiber": 26, "satfat": 31, "salt": 49}
def num(v):
    if v is None: return None
    s = str(v).strip().replace(",", ".")
    if s in ("-", ""): return None
    if s.lower().startswith("traces"): return 0.0
    m = re.match(r"^<\s*([\d.]+)", s)
    if m: return round(float(m.group(1)) / 2, 3)   # "< 0,5" → moitié du seuil (convention usuelle)
    try: return float(s)
    except ValueError: return None
groups, gi, rows, skipped = [], {}, [], 0
for i, r in enumerate(ws.iter_rows(values_only=True)):
    if i == 0: continue
    code, name = r[6], (r[7] or "").strip()
    kcal = num(r[COLS["kcal"]])
    if not name or kcal is None: skipped += 1; continue
    g = (r[4] if r[4] and r[4] != "-" else r[3]) or "divers"
    if g not in gi: gi[g] = len(groups); groups.append(g)
    vals = [num(r[c]) for c in COLS.values()]
    vals = [None if v is None else (round(v) if k == "kcal" else round(v, 2)) for k, v in zip(COLS, vals)]
    rows.append([str(code), name, gi[g]] + vals)
out = {"source": "Anses. Table de composition nutritionnelle des aliments Ciqual.", "fields": ["code", "name", "group"] + list(COLS), "groups": groups, "foods": rows}
json.dump(out, open(dst, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print("foods", len(rows), "skipped", skipped, "groups", len(groups))
