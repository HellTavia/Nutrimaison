#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-only
# Copyright (C) 2026 Les auteurs de NutriMaison
#
# Génère l'APK SIGNÉ de NutriMaison sous Linux, sans Android Studio.
#
#   ./build-apk.sh /chemin/vers/ma-cle.jks [alias]
#
# Ce que fait le script :
#   1. vérifie Node, npm et Java (JDK 17 ou plus) ;
#   2. installe le SDK Android en ligne de commande dans ~/Android/Sdk s'il n'existe pas
#      (outils officiels de Google, environ 600 Mo, une seule fois) ;
#   3. build l'appli web, prépare le projet Android (setup + patch) et compile l'APK release ;
#   4. signe l'APK avec ta clé (apksigner) et le range dans release/nutrimaison-vX.Y.Z.apk.
#
# Le mot de passe est demandé au clavier (rien ne s'affiche) et n'est jamais écrit sur le disque
# ni passé en argument de commande. Pour un usage automatisé, il peut venir des variables
# d'environnement NM_KS_PASS (magasin) et NM_KEY_PASS (clé, si différent).
#
# Autres variables possibles :
#   NM_KEYSTORE   chemin de la clé (à la place du 1er argument)
#   NM_KEY_ALIAS  alias de la clé (sinon détecté automatiquement)
#   ANDROID_HOME  SDK Android déjà installé ailleurs

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

# Versions utilisées par Capacitor 6 (compileSdk 34) et le plugin Gradle mis par patch-android.mjs
PLATFORM="android-34"
BUILD_TOOLS="35.0.0"   # celle qu'attend le plugin Android Gradle 8.9 (et apksigner)
# Outils en ligne de commande de Google (page « Command line tools only » de developer.android.com)
CMDLINE_URL="https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip"

bold() { printf '\033[1m%s\033[0m\n' "$*"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$*"; }
die()  { printf '\n\033[31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

# ------------------------------------------------------------------
# 0. Clé de signature
# ------------------------------------------------------------------
KEYSTORE="${1:-${NM_KEYSTORE:-}}"
ALIAS="${2:-${NM_KEY_ALIAS:-}}"
[ -n "$KEYSTORE" ] || die "Indique ta clé : ./build-apk.sh /chemin/vers/ma-cle.jks [alias]"
[ -f "$KEYSTORE" ] || die "Clé introuvable : $KEYSTORE"
KEYSTORE="$(cd "$(dirname "$KEYSTORE")" && pwd)/$(basename "$KEYSTORE")"
case "$KEYSTORE" in
  "$ROOT"/*) warn "Ta clé est DANS le dossier du projet. Elle est ignorée par git (.gitignore), mais range-la plutôt ailleurs et garde-en une copie de secours." ;;
esac

VERSION="$(node -p "require('./package.json').version")"
bold "NutriMaison $VERSION — APK signé"

# ------------------------------------------------------------------
# 1. Outils
# ------------------------------------------------------------------
bold "1/5 Vérification des outils"
command -v node >/dev/null || die "Node.js manquant (version 18 ou plus) : https://nodejs.org ou « sudo apt install nodejs npm »"
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -ge 18 ] || die "Node.js $NODE_MAJOR trop ancien : il faut la version 18 ou plus."
command -v npm >/dev/null || die "npm manquant (« sudo apt install npm »)."
ok "Node $(node -v)"

# Il faut un JDK COMPLET (avec le compilateur javac), pas seulement le JRE : on cherche le bon,
# d'abord JAVA_HOME, puis celui du « java » par défaut, puis tous ceux de /usr/lib/jvm.
jdk_version() { "$1/bin/java" -version 2>&1 | sed -n 's/.*version "\([0-9]*\).*/\1/p' | head -1; }
JDK=""
CANDIDATES=()
[ -n "${JAVA_HOME:-}" ] && CANDIDATES+=("$JAVA_HOME")
command -v java >/dev/null && CANDIDATES+=("$(dirname "$(dirname "$(readlink -f "$(command -v java)")")")")
for d in /usr/lib/jvm/*/ /usr/java/*/ "$HOME"/.jdks/*/; do [ -d "$d" ] && CANDIDATES+=("${d%/}"); done
JRE_ONLY=""
for d in "${CANDIDATES[@]}"; do
  [ -x "$d/bin/java" ] || continue
  v="$(jdk_version "$d")"; [ "${v:-0}" -ge 17 ] || continue
  if [ -x "$d/bin/javac" ]; then JDK="$d"; JAVA_MAJOR="$v"; break; else JRE_ONLY="$d (Java $v)"; fi
done
if [ -z "$JDK" ]; then
  if [ -n "$JRE_ONLY" ]; then
    die "Java est installé mais sans compilateur (JRE seul : $JRE_ONLY).
   Installe le JDK complet, puis relance :
     Debian / Ubuntu / MX : sudo apt install openjdk-21-jdk-headless   (ou openjdk-17-jdk-headless)
     Fedora               : sudo dnf install java-17-openjdk-devel"
  fi
  die "Java (JDK 17 ou plus) manquant. Installe-le, puis relance :
     Debian / Ubuntu / MX : sudo apt install openjdk-21-jdk-headless   (ou openjdk-17-jdk-headless)
     Fedora               : sudo dnf install java-17-openjdk-devel"
fi
export JAVA_HOME="$JDK"
export PATH="$JDK/bin:$PATH"
KEYTOOL="$JDK/bin/keytool"
[ -x "$KEYTOOL" ] || KEYTOOL="$(command -v keytool || true)"
[ -n "$KEYTOOL" ] || die "keytool introuvable dans $JDK"
ok "Java $JAVA_MAJOR ($JAVA_HOME)"
command -v unzip >/dev/null || die "unzip manquant (« sudo apt install unzip »)."

# ------------------------------------------------------------------
# 2. SDK Android (ligne de commande)
# ------------------------------------------------------------------
bold "2/5 SDK Android"
SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Android/Sdk}}"
SDKMANAGER="$SDK/cmdline-tools/latest/bin/sdkmanager"
if [ ! -x "$SDKMANAGER" ]; then
  warn "Outils Android absents : téléchargement dans $SDK (une seule fois)…"
  mkdir -p "$SDK/cmdline-tools"
  TMPZIP="$(mktemp --suffix=.zip)"
  if command -v curl >/dev/null; then curl -fL --progress-bar -o "$TMPZIP" "$CMDLINE_URL"; else wget -q --show-progress -O "$TMPZIP" "$CMDLINE_URL"; fi
  rm -rf "$SDK/cmdline-tools/latest" "$SDK/cmdline-tools/cmdline-tools"
  unzip -q "$TMPZIP" -d "$SDK/cmdline-tools"
  mv "$SDK/cmdline-tools/cmdline-tools" "$SDK/cmdline-tools/latest"
  rm -f "$TMPZIP"
fi
export ANDROID_HOME="$SDK" ANDROID_SDK_ROOT="$SDK"
if [ ! -d "$SDK/platforms/$PLATFORM" ] || [ ! -x "$SDK/build-tools/$BUILD_TOOLS/apksigner" ]; then
  warn "Installation de $PLATFORM et build-tools $BUILD_TOOLS (licences acceptées automatiquement)…"
  yes | "$SDKMANAGER" --sdk_root="$SDK" --licenses >/dev/null || true
  "$SDKMANAGER" --sdk_root="$SDK" "platform-tools" "platforms;$PLATFORM" "build-tools;$BUILD_TOOLS" >/dev/null
fi
BT="$SDK/build-tools/$BUILD_TOOLS"
[ -x "$BT/apksigner" ] || die "apksigner introuvable dans $BT"
ok "SDK prêt ($SDK)"

# ------------------------------------------------------------------
# 3. Mot de passe et alias (vérifiés AVANT de compiler, pour ne pas attendre pour rien)
# ------------------------------------------------------------------
bold "3/5 Clé de signature"
if [ -z "${NM_KS_PASS:-}" ]; then
  read -r -s -p "  Mot de passe de la clé ($(basename "$KEYSTORE")) : " NM_KS_PASS; echo
fi
export NM_KS_PASS
LIST="$("$KEYTOOL" -list -keystore "$KEYSTORE" -storepass:env NM_KS_PASS 2>&1)" \
  || die "Mot de passe refusé ou fichier illisible : $(echo "$LIST" | tail -1)"
if [ -z "$ALIAS" ]; then
  mapfile -t ALIASES < <(echo "$LIST" | grep -i "PrivateKeyEntry" | sed 's/,.*//')
  [ "${#ALIASES[@]}" -ge 1 ] || die "Aucune clé privée dans $KEYSTORE"
  if [ "${#ALIASES[@]}" -gt 1 ]; then
    die "Plusieurs clés dans ce fichier (${ALIASES[*]}) : indique laquelle en 2e argument."
  fi
  ALIAS="${ALIASES[0]}"
fi
echo "$LIST" | grep -qi "^$ALIAS," || die "Alias « $ALIAS » absent de $KEYSTORE"
export NM_KEY_PASS="${NM_KEY_PASS:-$NM_KS_PASS}"
ok "Clé « $ALIAS »"

# ------------------------------------------------------------------
# 4. Build web + projet Android + APK release (non signé)
# ------------------------------------------------------------------
bold "4/5 Compilation (quelques minutes la première fois)"
if [ ! -d node_modules ] || [ package.json -nt node_modules ]; then npm install --no-fund --no-audit; fi
# Base de produits intégrée : la dernière version publiée dans la Release « db » (fabriquée chaque mois
# par GitHub Actions). Sans réseau, ou si elle n'est pas encore publiée, on garde celle du dossier.
if [ "${NM_SKIP_DB:-}" != "1" ]; then
  DBTMP="$(mktemp)"
  if curl -fsSL --max-time 120 "https://github.com/HellTavia/Nutrimaison/releases/download/db/off-top.json.gz" -o "$DBTMP" 2>/dev/null \
     && gunzip -c "$DBTMP" > "$DBTMP.json" 2>/dev/null && node -e "JSON.parse(require('fs').readFileSync(process.argv[1]))" "$DBTMP.json" 2>/dev/null; then
    mv "$DBTMP.json" src/data/off-top.json
    ok "Base de produits intégrée : $(node -p "require('./src/data/off-top.json').rows.length") produits"
  else
    warn "Base de produits intégrée non téléchargée (pas encore publiée ou hors ligne) : on garde celle du dossier ($(node -p "require('./src/data/off-top.json').rows.length") produits)."
  fi
  rm -f "$DBTMP" "$DBTMP.json"
fi
npm run build
[ -d android ] || npx cap add android
node scripts/patch-android.mjs
npx cap sync android
echo "sdk.dir=$SDK" > android/local.properties
(cd android && chmod +x gradlew && ./gradlew --no-daemon -q -Dorg.gradle.java.home="$JDK" -Porg.gradle.java.installations.paths="$JDK" -Porg.gradle.java.installations.auto-detect=false assembleRelease)
UNSIGNED="$(ls android/app/build/outputs/apk/release/*.apk 2>/dev/null | head -1 || true)"
[ -n "$UNSIGNED" ] || die "APK release introuvable après la compilation."
ok "APK compilé"

# ------------------------------------------------------------------
# 5. Alignement + signature
# ------------------------------------------------------------------
bold "5/5 Signature"
mkdir -p release
OUT="release/nutrimaison-v$VERSION.apk"
ALIGNED="$(mktemp --suffix=.apk)"
"$BT/zipalign" -p -f 4 "$UNSIGNED" "$ALIGNED"
if ! "$BT/apksigner" sign --ks "$KEYSTORE" --ks-key-alias "$ALIAS" \
      --ks-pass env:NM_KS_PASS --key-pass env:NM_KEY_PASS --out "$OUT" "$ALIGNED" 2>/dev/null; then
  # la clé a peut-être son propre mot de passe
  read -r -s -p "  Mot de passe de la clé « $ALIAS » (différent du fichier) : " NM_KEY_PASS; echo
  export NM_KEY_PASS
  "$BT/apksigner" sign --ks "$KEYSTORE" --ks-key-alias "$ALIAS" \
    --ks-pass env:NM_KS_PASS --key-pass env:NM_KEY_PASS --out "$OUT" "$ALIGNED" || die "Signature impossible."
fi
rm -f "$ALIGNED" "$OUT.idsig"
unset NM_KS_PASS NM_KEY_PASS

"$BT/apksigner" verify "$OUT" || die "La vérification de la signature a échoué."
CERT="$("$BT/apksigner" verify --print-certs "$OUT" | sed -n 's/.*certificate SHA-256 digest: //p' | head -1)"
SUM="$(sha256sum "$OUT" | cut -d' ' -f1)"
echo "$SUM  $(basename "$OUT")" > "$OUT.sha256"

echo
bold "✅ $OUT ($(du -h "$OUT" | cut -f1))"
echo "   Empreinte du certificat (SHA-256) : $CERT"
echo "   Somme de contrôle de l'APK        : $SUM  (aussi dans $OUT.sha256)"
echo
echo "   À joindre à la Release GitHub v$VERSION."
echo "   Rappel : le premier APK signé avec cette clé ne s'installe pas par-dessus une version"
echo "   « debug » → Profil → Sauvegarder maintenant, désinstaller, installer, restaurer."
echo "   Les mises à jour suivantes signées avec la même clé s'installeront normalement."
