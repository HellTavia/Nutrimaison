// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Les auteurs de NutriMaison
package app.nutrimaison

import android.app.Activity
import android.os.Bundle
import android.widget.ScrollView
import android.widget.TextView

/**
 * Page « confidentialité » exigée par Health Connect : elle s'affiche quand on touche
 * « Règles de confidentialité » dans l'écran des autorisations. Sans elle, Android 14+
 * refuse d'afficher la demande de permission.
 */
class PermissionsRationaleActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val pad = (20 * resources.displayMetrics.density).toInt()
        val text = TextView(this).apply {
            setPadding(pad, pad, pad, pad)
            textSize = 16f
            text = """
                NutriMaison — Confidentialité et Health Connect

                NutriMaison fonctionne entièrement sur ton téléphone. Aucune donnée n'est envoyée à un serveur NutriMaison (il n'y en a pas).

                Ce que l'app ÉCRIT dans Health Connect (si tu l'autorises) : tes repas (calories, protéines, glucides, lipides), ton hydratation, les séances faites dans l'app, tes pesées saisies à la main et ton pourcentage de masse grasse.

                Ce que l'app LIT (si tu l'autorises) : tes pas, ton poids (balance connectée), tes calories dépensées et les séances enregistrées par d'autres applis, pour les afficher et ajuster tes objectifs.

                Ces données restent dans Health Connect et dans le stockage local de l'app. Tu peux retirer ces autorisations à tout moment dans Paramètres → Health Connect.
            """.trimIndent()
        }
        setContentView(ScrollView(this).apply { addView(text) })
    }
}
