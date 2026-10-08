#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Les auteurs de NutriMaison
/**
 * Prépare le projet Android pour Health Connect (et la caméra).
 * À lancer depuis le dossier du projet, APRÈS `npx cap add android` :
 *     node scripts/patch-android.mjs
 * Le script peut être relancé sans risque : il ne modifie que ce qui manque.
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const A = path.join(root, "android");
const capConfig = JSON.parse(fs.readFileSync(path.join(root, "capacitor.config.json"), "utf8"));
const appPkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const pkg = capConfig.appId;
const javaDir = path.join(A, "app", "src", "main", "java", ...pkg.split("."));
const log = (m) => console.log("  " + m);
const fail = (m) => { console.error("\n❌ " + m); process.exit(1); };

if (!fs.existsSync(A)) fail("Dossier android/ introuvable. Lance d'abord : npx cap add android");
{
  // Le dossier android/ doit avoir été généré avec le même identifiant d'app que capacitor.config.json
  const g = fs.readFileSync(path.join(A, "app", "build.gradle"), "utf8");
  const m = g.match(/applicationId\s+["']([^"']+)["']/);
  if (m && m[1] !== pkg) {
    fail(`Le dossier android/ a été créé pour « ${m[1]} » mais l'identifiant de l'app est maintenant « ${pkg} ».\n` +
      "   Supprime le dossier android (rmdir /s /q android  sous Windows) puis relance setup.bat.");
  }
}

function edit(file, fn) {
  const p = path.join(A, file);
  if (!fs.existsSync(p)) fail("Fichier introuvable : android/" + file);
  const before = fs.readFileSync(p, "utf8");
  const after = fn(before);
  if (after !== before) { fs.writeFileSync(p, after); log("modifié : android/" + file); }
  else log("déjà à jour : android/" + file);
}

console.log("\n🔧 Préparation d'Android pour Health Connect\n");

/* 1. Fichiers Kotlin du plugin */
fs.mkdirSync(javaDir, { recursive: true });
for (const f of ["HealthBridgePlugin.kt", "PermissionsRationaleActivity.kt"]) {
  const src = fs.readFileSync(path.join(root, "native", "android", f), "utf8");
  fs.writeFileSync(path.join(javaDir, f), src.replace(/^package\s+[\w.]+/m, `package ${pkg}`));
  log("copié : " + f);
}

/* 1 bis. Logo, icônes adaptatives et écran de démarrage */
const resSrc = path.join(root, "native", "android", "res");
const resDst = path.join(A, "app", "src", "main", "res");
function copyDir(src, dst) {
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) { fs.mkdirSync(d, { recursive: true }); copyDir(s, d); }
    else fs.copyFileSync(s, d);
  }
}
if (fs.existsSync(resSrc)) {
  // évite les doublons de ressources si le modèle contenait des icônes en .webp
  for (const dir of fs.readdirSync(resDst)) {
    if (!dir.startsWith("mipmap")) continue;
    for (const f of fs.readdirSync(path.join(resDst, dir))) {
      if (/^ic_launcher.*\.webp$/.test(f)) fs.unlinkSync(path.join(resDst, dir, f));
    }
  }
  copyDir(resSrc, resDst);
  log("copié : logo NutriMaison (icônes + écran de démarrage)");
}

/* 2. MainActivity : enregistrer le plugin */
const mainJava = path.join(javaDir, "MainActivity.java");
const mainKt = path.join(javaDir, "MainActivity.kt");
if (fs.existsSync(mainKt)) fail("MainActivity.kt trouvé : ce script attend MainActivity.java (projet Capacitor standard).");
fs.writeFileSync(mainJava, `package ${pkg};

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(HealthBridgePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
`);
log("écrit : MainActivity.java (plugin HealthBridge enregistré)");

/* 3. Outils de build : Health Connect 1.1.0 exige Android Gradle Plugin >= 8.9.1 et compileSdk 36 */
const AGP = "8.9.1", GRADLE = "8.11.1", KOTLIN = "2.1.21";
const older = (a, b) => {
  const x = a.split(".").map(Number), y = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) < (y[i] || 0); }
  return false;
};
edit("build.gradle", (s) => {
  s = s.replace(/(classpath\s+['"]com\.android\.tools\.build:gradle:)([\d.]+)(['"])/, (m, a, v, c) => (older(v, AGP) ? a + AGP + c : m));
  if (s.includes("kotlin-gradle-plugin")) {
    s = s.replace(/(kotlin-gradle-plugin:)([\d.]+)/, (m, a, v) => (older(v, KOTLIN) ? a + KOTLIN : m));
  } else {
    s = s.replace(/(classpath\s+['"]com\.android\.tools\.build:gradle:[^'"]+['"])/,
      `$1\n        classpath 'org.jetbrains.kotlin:kotlin-gradle-plugin:${KOTLIN}'`);
  }
  return s;
});
edit(path.join("gradle", "wrapper", "gradle-wrapper.properties"), (s) =>
  s.replace(/gradle-([\d.]+)-(all|bin)\.zip/, (m, v, t) => (older(v, GRADLE) ? `gradle-${GRADLE}-${t}.zip` : m)));

edit(path.join("app", "build.gradle"), (s) => {
  if (!s.includes("kotlin-android")) {
    s = s.replace(/(apply plugin:\s*['"]com\.android\.application['"])/, `$1\napply plugin: 'kotlin-android'`);
  }
  if (!s.includes("kotlinOptions")) {
    s = s.replace(/android\s*\{/, `android {
    compileOptions {
        sourceCompatibility JavaVersion.VERSION_17
        targetCompatibility JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = '17'
    }`);
  }
  if (!s.includes("connect-client")) {
    s = s.replace(/dependencies\s*\{/, `dependencies {
    implementation "androidx.health.connect:connect-client:1.1.0"
    implementation "org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0"`);
  }
  return s;
});

/* 3 bis. Numéro de version affiché par Android = celui de package.json
   versionCode (entier qui doit toujours augmenter) : 2.8.0 → 20800 */
{
  const [ma, mi, pa] = String(appPkg.version || "1.0.0").split(".").map((n) => parseInt(n, 10) || 0);
  const code = ma * 10000 + mi * 100 + pa;
  edit(path.join("app", "build.gradle"), (s) => s
    .replace(/versionCode\s+\d+/, `versionCode ${code}`)
    .replace(/versionName\s+["'][^"']*["']/, `versionName "${appPkg.version}"`));
  log(`version : ${appPkg.version} (code ${code})`);
}

/* 4. Versions SDK (Health Connect demande un compileSdk récent) */
edit("variables.gradle", (s) => s
  .replace(/compileSdkVersion\s*=\s*(\d+)/, (m, v) => (Number(v) < 36 ? "compileSdkVersion = 36" : m))
  .replace(/minSdkVersion\s*=\s*(\d+)/, (m, v) => (Number(v) < 26 ? "minSdkVersion = 26" : m)));

// (ancienne version du script) on retire l'option devenue inutile
edit("gradle.properties", (s) => s.replace(/\n?android\.suppressUnsupportedCompileSdk=\d+\n?/, "\n"));

/* 4 bis. JDK de Gradle : Gradle 8.11 n'accepte que Java 8 à 23.
   Si un Java plus récent (ex. 25) est installé par défaut, Android Studio le choisit et la synchro échoue.
   On fixe donc le JDK embarqué d'Android Studio (JBR 21), s'il est trouvé, dans android/gradle.properties. */
{
  const candidates = [
    process.env.NUTRIMAISON_JDK,
    "C:/Program Files/Android/Android Studio/jbr",
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Programs", "Android Studio", "jbr"),
    "/Applications/Android Studio.app/Contents/jbr/Contents/Home",
    "/opt/android-studio/jbr",
    process.env.HOME && path.join(process.env.HOME, "android-studio", "jbr"),
  ].filter(Boolean);
  const jdk = candidates.find((p) => fs.existsSync(path.join(p, "bin", process.platform === "win32" ? "java.exe" : "java")));
  if (jdk) {
    edit("gradle.properties", (s) => s.includes("org.gradle.java.home")
      ? s
      : s.replace(/\s*$/, `\n# JDK utilisé par Gradle (ajouté par scripts/patch-android.mjs)\norg.gradle.java.home=${jdk.replace(/\\/g, "/")}\n`));
  } else {
    log("JDK d'Android Studio introuvable : choisis JDK 17 ou 21 dans Android Studio (Settings → Gradle → Gradle JDK), ou définis NUTRIMAISON_JDK.");
  }
}

/* 4 ter. Thème Android « DayNight » : la page web sait alors si le téléphone est en mode sombre
   (option « Comme le téléphone » de Profil → Apparence). */
{
  const st = path.join(A, "app", "src", "main", "res", "values", "styles.xml");
  if (fs.existsSync(st)) edit(path.join("app", "src", "main", "res", "values", "styles.xml"), (s) => s.replace(/Theme\.AppCompat\.Light\./g, "Theme.AppCompat.DayNight."));
}

/* 5. Manifeste : permissions Health Connect, caméra, page de confidentialité */
edit(path.join("app", "src", "main", "AndroidManifest.xml"), (s) => {
  const perms = [
    "android.permission.CAMERA",
    "android.permission.POST_NOTIFICATIONS",
    "android.permission.health.READ_STEPS",
    "android.permission.health.READ_WEIGHT",
    "android.permission.health.WRITE_WEIGHT",
    "android.permission.health.WRITE_BODY_FAT",
    "android.permission.health.WRITE_NUTRITION",
    "android.permission.health.WRITE_HYDRATION",
    "android.permission.health.READ_EXERCISE",
    "android.permission.health.WRITE_EXERCISE",
    "android.permission.health.READ_ACTIVE_CALORIES_BURNED",
    "android.permission.health.WRITE_ACTIVE_CALORIES_BURNED",
    "android.permission.health.READ_TOTAL_CALORIES_BURNED",
  ];
  let add = "";
  perms.forEach((p) => { if (!s.includes(`"${p}"`)) add += `    <uses-permission android:name="${p}" />\n`; });
  // copie automatique dans Documents : autorisation utile seulement jusqu'à Android 10
  if (!s.includes("android.permission.WRITE_EXTERNAL_STORAGE")) {
    add += `    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="29" />\n`;
  }
  if (!s.includes("com.google.android.apps.healthdata")) {
    add += `    <queries>
        <package android:name="com.google.android.apps.healthdata" />
        <intent>
            <action android:name="android.media.action.IMAGE_CAPTURE" />
        </intent>
    </queries>\n`;
  }
  if (add) s = s.replace(/(\s*)<application/, `\n${add}$1<application`);

  if (!s.includes("PermissionsRationaleActivity")) {
    s = s.replace(/<\/application>/, `
        <!-- Health Connect : page de confidentialité (Android 13 et moins) -->
        <activity
            android:name=".PermissionsRationaleActivity"
            android:exported="true">
            <intent-filter>
                <action android:name="androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE" />
            </intent-filter>
        </activity>

        <!-- Health Connect : page de confidentialité (Android 14 et plus) -->
        <activity-alias
            android:name="ViewPermissionUsageActivity"
            android:exported="true"
            android:targetActivity=".PermissionsRationaleActivity"
            android:permission="android.permission.START_VIEW_PERMISSION_USAGE">
            <intent-filter>
                <action android:name="android.intent.action.VIEW_PERMISSION_USAGE" />
                <category android:name="android.intent.category.HEALTH_PERMISSIONS" />
            </intent-filter>
        </activity-alias>
    </application>`);
  }
  return s;
});

console.log("\n✅ Terminé. Ensuite : npx cap sync  puis  npx cap open android  (ou gradlew.bat assembleDebug)\n");
