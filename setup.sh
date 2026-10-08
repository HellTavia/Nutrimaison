#!/bin/bash
# Prépare le projet NutriMaison en une seule commande :
# installe les dépendances, build le web, génère et synchronise le projet Android.
#
# Utilisation : ouvre un terminal dans le dossier nutrimaison-app, puis :
#   chmod +x setup.sh
#   ./setup.sh

set -e

echo "📦 1/4 — Installation des dépendances (npm install)…"
npm install

echo "🏗️  2/4 — Build de l'app web (npm run build)…"
npm run build

if [ -d "android" ]; then
  echo "📱 3/4 — Dossier android/ déjà présent, on le garde."
else
  echo "📱 3/4 — Création du projet Android (npx cap add android)…"
  npx cap add android
fi

echo "🔧 Préparation Android (Health Connect, caméra)…"
node scripts/patch-android.mjs

echo "🔄 4/4 — Synchronisation Capacitor (npx cap sync)…"
npx cap sync

echo ""
echo "✅ Tout est prêt."
echo "Il ne reste plus qu'à ouvrir le projet dans Android Studio :"
echo ""
echo "   npx cap open android"
echo ""
echo "Puis dans Android Studio : Build → Generate App Bundles or APKs → Build APK(s)"
echo ""
echo "⚠️  N'oublie pas d'ajouter la permission caméra si ce n'est pas déjà fait :"
echo "   Dans android/app/src/main/AndroidManifest.xml, juste avant <application ...> :"
echo '   <uses-permission android:name="android.permission.CAMERA" />'
