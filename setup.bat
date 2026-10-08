@echo off
REM Prepare le projet NutriMaison en une seule commande :
REM installe les dependances, build le web, genere et synchronise le projet Android.
REM
REM Utilisation : ouvre une invite de commande dans le dossier nutrimaison-app, puis :
REM   setup.bat

setlocal

echo 1/5 - Installation des dependances (npm install)...
call npm install
if errorlevel 1 goto :error

echo 2/5 - Build de l'app web (npm run build)...
call npm run build
if errorlevel 1 goto :error

if exist "android" goto :skip_android

echo 3/5 - Creation du projet Android : npx cap add android
call npx cap add android
if errorlevel 1 goto :error
goto :after_android

:skip_android
echo 3/5 - Dossier android deja present, on le garde.

:after_android
echo 4/5 - Preparation Android (Health Connect, camera) : node scripts\patch-android.mjs
call node scripts\patch-android.mjs
if errorlevel 1 goto :error

echo 5/5 - Synchronisation Capacitor : npx cap sync
call npx cap sync
if errorlevel 1 goto :error

echo.
echo Tout est pret.
echo Il ne reste plus qu'a ouvrir le projet dans Android Studio :
echo.
echo    npx cap open android
echo.
echo Puis dans Android Studio : Build - Generate App Bundles or APKs - Build APK(s)
echo.
echo Permissions camera et Health Connect : deja ajoutees automatiquement.
goto :eof

:error
echo.
echo Une etape a echoue - regarde le message d'erreur ci-dessus.
exit /b 1
