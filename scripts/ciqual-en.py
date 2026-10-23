#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-3.0-only
# Copyright (C) 2026 Les auteurs de NutriMaison
"""
Noms anglais officiels de la table Ciqual, pour l'appli en anglais.

L'Anses publie la table en français et en anglais (mêmes codes d'aliments). Ce script lit la
version anglaise et écrit src/data/ciqual-en.json : nom français → nom anglais, et groupes.
Les données enregistrées restent en français ; seul l'affichage (et la recherche) passent en anglais.

Usage :
    pip install openpyxl
    python scripts/ciqual-en.py Table_Ciqual_2025_ENG.xlsx

Le fichier anglais se télécharge sur https://ciqual.anses.fr (rubrique Téléchargement,
« Table Ciqual 2025 » en anglais, format Excel). Licence Ouverte Etalab.
"""
import json, os, sys
import openpyxl

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = sys.argv[1] if len(sys.argv) > 1 else sys.exit(__doc__)
dst = sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, "src", "data", "ciqual-en.json")

fr = json.load(open(os.path.join(ROOT, "src", "ciqual.json"), encoding="utf-8"))
idx = {f: i for i, f in enumerate(fr["fields"])}
fr_by_code = {str(r[idx["code"]]): r for r in fr["foods"]}

ws = openpyxl.load_workbook(src, read_only=True).worksheets[0]
rows = ws.iter_rows(values_only=True)
head = [str(h or "").strip().lower() for h in next(rows)]
def col(*names):
    for n in names:
        if n in head: return head.index(n)
    sys.exit(f"colonne introuvable ({' / '.join(names)}) : vérifie que c'est bien la table Ciqual en anglais")
c_code = col("alim_code")
c_name = col("alim_nom_eng", "alim_nom_en", "alim_name_eng")
c_grp = col("alim_grp_nom_eng", "alim_grp_nom_en")
c_ssgrp = col("alim_ssgrp_nom_eng", "alim_ssgrp_nom_en")

names, groups, found = {}, {}, 0
for r in rows:
    code = str(r[c_code] or "").strip()
    if code not in fr_by_code: continue
    en = str(r[c_name] or "").strip()
    if not en: continue
    frow = fr_by_code[code]
    names[frow[idx["name"]]] = en
    g_fr = fr["groups"][frow[idx["group"]]]
    g_en = r[c_ssgrp] if r[c_ssgrp] and r[c_ssgrp] != "-" else r[c_grp]
    if g_en and g_fr not in groups: groups[g_fr] = str(g_en).strip()
    found += 1

json.dump({"v": 1, "source": "Anses. Ciqual French food composition table (English names). Etalab Open Licence.",
           "names": names, "groups": groups}, open(dst, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print(f"{found} aliments sur {len(fr_by_code)} ont un nom anglais, {len(groups)} groupes → {os.path.relpath(dst)}")
