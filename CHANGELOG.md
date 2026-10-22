# Historique des versions

## 2.29.0 — bases d'aliments hors ligne
- **Base intégrée** : les produits de marque les plus scannés en France (100 000 par défaut, Open Food Facts) et des aliments génériques américains traduits en français (USDA), en plus de la table Ciqual. Recherche et **scan de code-barres sans réseau**.
- **Base complète en option** (Moi → Base hors ligne) : tous les produits vendus en France sur Open Food Facts, téléchargés depuis la Release « db » du dépôt (taille et date affichées, Wi-Fi conseillé). Découpée en morceaux avec un index (code-barres → produit, mots → produits) : l'appli ne lit que les morceaux utiles. Mise à jour et suppression d'un bouton ; chaque partie est vérifiée (SHA-256).
- Ordre de recherche : tes produits, Ciqual, base intégrée, base complète, puis Open Food Facts en ligne. Un code-barres connu hors ligne s'ouvre instantanément ; inconnu et sans réseau, l'appli propose de créer le produit.
- Les aliments USDA apparaissent après Ciqual dans « Aliments de base », marqués « USDA (traduit) ».
- `scripts/build-food-db.mjs` fabrique les bases (export Open Food Facts lu en flux, sans stockage ; traduction USDA par Gemini, faite une seule fois et reprise possible). Il lit le nouveau format de nutrition d'Open Food Facts (2026) comme l'ancien, affiche pourquoi des produits sont écartés, et ne publie rien si trop peu de produits sont retenus. `.github/workflows/food-db.yml` la relance chaque mois et publie le résultat ; `build-apk.sh` récupère la dernière base intégrée avant de compiler.

## 2.28.0 — interface épurée
Toutes les fonctions sont conservées, rangées autrement.
- **Accueil**
  - un seul bloc de résumé : anneau des calories, macros et eau (−, +250 ml, choix de la quantité) ;
  - les **repas** remontent juste dessous, une ligne compacte par repas (aperçu des aliments, kcal, +) ; toucher la ligne la déplie (aliments modifiables, « Comme la veille », menu copier / repas type / portions) ; le plat prévu au planning s'affiche avec « Noter » ;
  - **Activité & corps** : une ligne « Dépense ≈ … kcal · pas · séances » qui ouvre la feuille **Activité du jour** (pas, sport, dépense par appli, corrections des séances, métabolisme), une ligne Poids avec mini-courbe, une ligne Bilan de la semaine ;
  - les longues explications sont repliées derrière « ⓘ Comment c'est calculé ».
- **Ajouter** : les 5 onglets sont remplacés par une barre de recherche et **6 actions** (Code-barres, Étiquette, Photo du plat, Texte IA, Recette, Repas type), avec Favoris / Récents / Repas types dessous ; le choix du repas devient un sélecteur compact. Le code-barres a son écran (scan, photo, saisie du code) avec un raccourci « Pas de code-barres ? Scanne l'étiquette ».
- **Moi** (ex-Profil) : bandeau de l'objectif (« Modifier » ouvre Objectifs : objectifs, calcul des besoins, calories du sport), 4 tuiles **Corps & progrès** (Poids, Masse grasse, Besoin réel, Métabolisme), et **Réglages** en sous-pages avec leur état en un coup d'œil : Health Connect, Intelligence artificielle, Rappels, Sauvegarde, Apparence, Mises à jour, À propos.
- **Health Connect** : synchro et autorisations en haut, puis « NutriMaison envoie », « NutriMaison lit » et « Avancé » (compléter les séances, diagnostic) ; explications derrière ⓘ.
- Corps & progrès ouvert depuis Moi revient à Moi.

## 2.27.0
- **Graphique du métabolisme de base** (Corps & progrès → Métabolisme, ou « 📈 Métabolisme de base dans le temps » sous la dépense du jour) :
  - une courbe par appli (Withings, Fitbit…) sur 7 j, 30 j, 90 j ou 1 an ; touche le graphique ou une ligne du tableau pour voir un jour précis (métabolisme, poids, masse grasse, masse maigre) ;
  - comparaison début → fin de période (ex. « 23 sept. 2 713 → 21 oct. 2 689 kcal (−24) ») et évolution de la masse maigre ;
  - tableau jour par jour ;
  - tout l'historique présent dans Health Connect est récupéré (jusqu'à 400 jours), pas seulement depuis l'installation ;
  - sans appli qui envoie son métabolisme, NutriMaison le calcule (masse maigre de la balance, sinon poids/taille/âge).
- **Composition corporelle de la balance** lue dans Health Connect : masse grasse (%) et masse maigre (kg) de Withings (réglage « Poids et composition »). Après la mise à jour, touche « Autoriser l'accès » dans Profil → Health Connect pour accorder ces deux lectures.

## 2.26.0
- **Scanner une étiquette nutritionnelle** (Ajouter → Scanner → « Sans code-barres »), pour un produit sans code-barres, introuvable ou étranger :
  - photo (ou galerie), **cadre à ajuster** sur le tableau : on le déplace, on tire ses coins, ou on en redessine un en glissant ; « Tout sélectionner » ;
  - seule la zone choisie est envoyée à l'IA (plus précis, plus rapide) ; kJ convertis en kcal, sodium en sel, étiquette par portion ramenée à 100 g ;
  - tableau **/100 g et /portion** (calories, protéines, lipides dont saturés, glucides dont sucres, fibres, sel), modifiable, avec la remarque de l'IA si quelque chose est douteux ;
  - « Enregistrer et ajouter au repas » (quantité = la portion) ou « Enregistrer seulement ».
  - La création d'un produit inconnu après un scan de code-barres reste disponible comme avant.
- **Importer une recette** (Recettes → Mes recettes → « Importer (Insta, lien…) ») :
  - **Texte** : colle la description d'un post ;
  - **Lien** : post Instagram public (légende complète via la page publique du post), TikTok, blog ou site de cuisine (recette structurée de la page) ; le texte trouvé est modifiable avant conversion ;
  - **Vidéo** : quand la description ne contient pas la recette, choisis la vidéo enregistrée sur le téléphone : Gemini lit les sous-titres incrustés, écoute la voix et repère les ingrédients montrés (jusqu'à 19 Mo, clé Gemini nécessaire) ;
  - l'IA traduit et convertit tout en grammes (cup, tbsp, sachet, œufs…), garde la quantité d'origine, propose les étapes et la catégorie ;
  - chaque ingrédient est **relié à la table Ciqual** quand le nom et les calories concordent, sinon il garde l'estimation de l'IA (signalée) ;
  - écran **« Vérifier la recette »** : créateur, lien du post, ingrédients (quantité d'origine affichée, 🔍 pour relier à un autre aliment), étapes modifiables, catégorie. La source s'affiche ensuite dans la recette (« voir le post »).
- **Grok (xAI) en option** à côté de Gemini : Profil → Intelligence artificielle → Gemini / Grok. Clé xAI, modèle automatique ou choisi, liste actualisable, bascule si un modèle est saturé. Toutes les fonctions IA utilisent le fournisseur choisi, sauf la lecture de vidéo (Gemini uniquement).
- Dans l'appli Android, les appels à Grok et la lecture des pages web passent par le client HTTP natif (pas de blocage CORS).

## 2.25.0
- **Toutes les séances importées sont complétées et corrigeables**, marche comprise : Withings n'envoie pas non plus toutes les calories de ses marches. Pour chaque séance : estimation − ce que l'appli a envoyé pendant la séance = ce qui est ajouté (jamais négatif ; une appli qui envoie bien ses calories n'est donc pas gonflée).
- **Dépense du jour → « * N séances · détail et correction ▾ »** : tableau des séances (heure, durée, estimé − reçu = ajouté). Touche une séance pour saisir les calories affichées par ta montre (pour ce type de séance ou pour cette séance seulement), ou l'ignorer si c'est un doublon.
- **Les corrections suivent la séance quand Withings la réécrit** (modification, resynchro) : elles sont rangées par créneau horaire et plus par identifiant. Les corrections de la 2.24 restent valables.
- Intensités par défaut : marche 3 MET, randonnée 4,5, course 8, vélo 2,9.
- **`build-apk.sh`** : APK signé sous Linux sans Android Studio (SDK en ligne de commande installé automatiquement, signature apksigner, mot de passe demandé au clavier).

## 2.24.1
- **Doublons de séances mieux détectés** : deux séances du même sport venant de la même appli sont fusionnées dès qu'elles se recouvrent (1 min suffit) ou commencent à moins de 5 min d'écart (avant : il fallait 50 % de recouvrement).
- **« C'est un doublon : ignorer cette séance »** dans la fenêtre de correction d'une séance : elle disparaît du sport du jour et de la dépense. Pour la rétablir : Profil → Health Connect → Diagnostic des calories → toucher la séance barrée.

## 2.24.0
- **Corriger les calories d'une séance** : touche la ligne « * Vélo 20 min ≈ 266 ✎ » sous l'appli, saisis ce que ta montre affiche pour la séance, puis choisis :
  - **Ajuster toutes mes séances de vélo** (par défaut) : NutriMaison en déduit l'intensité (MET) et l'utilise pour toutes les séances de ce type, passées et futures ;
  - **Cette séance seulement**.
  - « Revenir à l'estimation automatique » annule la correction.
- Vélo moins surestimé par défaut : 5 MET (balade / trajet) au lieu de 7, vélo d'appartement 5,5 au lieu de 6,8.
- L'estimation des séances est recalculée à l'affichage : une correction ou l'option « Compléter les séances » s'applique tout de suite, sans resynchroniser.

## 2.23.1
- **Séance comptée deux fois** : quand une appli (Withings) renvoie la même séance sous un nouvel enregistrement (séance modifiée ou resynchronisée), NutriMaison n'en garde qu'une (même appli, même type, créneaux qui se recouvrent à plus de 50 %). Corrige « Boxe · 2 fois » et la double estimation de calories.
- Diagnostic des calories : liste des séances reçues avec leurs horaires ; les doublons ignorés sont barrés.

## 2.23.0
- **Séances sans calories complétées** : Withings envoie à Health Connect tes séances (boxe, vélo, renforcement…) mais seulement les calories de mouvement mesurées pendant ce temps (ex. 38 kcal pour 15 min de boxe), alors que son appli compte la séance entière. NutriMaison estime maintenant la séance (type, durée, ton poids) et ajoute ce qui manque à la dépense de l'appli : « 2 693 métab. + 439 actives + 190 séance* », avec le détail par séance.
  - Marche, course et randonnée ne sont pas touchées (déjà comptées par les pas).
  - Désactivable : Profil → Health Connect → « Compléter les séances sans calories ».

## 2.22.0
- **Diagnostic des calories** (Profil → Health Connect, sous « Synchroniser ») : pour aujourd'hui ou hier, ce que chaque appli a réellement écrit dans Health Connect (« brut ») comparé à ce que Health Connect en retient (« compté »), les chevauchements entre applis et le détail heure par heure des calories actives.
- Dépense du jour : si une appli a écrit plus de calories actives que Health Connect n'en compte, la ligne l'indique (« écrit 647 actives, Health Connect en compte 438 »).

## 2.21.0
- **Dépense du jour** : sous chaque appli, l'heure de la dernière donnée de calories actives reçue par Health Connect (« reçues à 21:10 »). Si elle date de plus de 45 min, la ligne passe en « en retard » : l'appli (souvent Withings) n'a pas encore envoyé ses dernières activités, le total se complétera plus tard.
- La carte de la clé Gemini s'appelle maintenant **Intelligence artificielle Gemini** (elle sert à la photo, aux étiquettes, au frigo, au Texte IA et au coach).

## 2.20.0
- **Choix du modèle Gemini** (Profil → Détection photo par IA) : « Automatique (recommandé) » ou un modèle précis de la liste.
  - Bouton « Actualiser la liste des modèles » : interroge Google pour ta clé et n'affiche que les modèles utiles (texte et photo ; pas de voix, d'image ni d'embedding). Le nombre de modèles et la date de la liste sont affichés.
  - Un modèle choisi est utilisé en priorité. S'il est saturé ou retiré par Google, l'appli bascule sur un modèle automatique et le dit ; ce secours ne change pas ton choix.
  - « Tester la clé » indique le modèle qui sera vraiment utilisé.

## 2.19.1
- Ajouter → Recette : « Mes recettes pour le dîner » et « Récemment notées » se replient et se déplient comme les catégories (le choix est mémorisé). Chaque section montre 5 recettes puis « Voir les N autres ».
- « Récemment notées » ne répète plus les recettes déjà affichées pour le repas choisi.
- Quand tu as des recettes pour le repas choisi, les catégories restent repliées pour garder l'écran court.

## 2.19.0
- **« ★ Ajouter à mes recettes »** sur les recettes de l'appli (ex. Dahl de lentilles) : tu choisis pour quels repas la garder (petit-déjeuner, déjeuner, dîner, collations). La recette passe dans Mes recettes et n'apparaît plus en double.
- Chaque recette perso a ses **repas** (plusieurs possibles), modifiables dans son détail (« À me proposer pour »). Par défaut : Plat → déjeuner et dîner, Petit-déjeuner → petit-déjeuner, Snack → collations, Soupe → dîner.
- **Ajouter → Recette** : en tête, « Mes recettes pour le dîner » (ou le repas choisi).
- Mes recettes : filtre par repas (Petit-déjeuner, Déjeuner, Dîner, Collations) et repas affichés sur chaque carte.

## 2.18.0
- **Catégories pour tes recettes** : Petit-déjeuner, Plat (déjeuner / dîner), Soupe, Dessert, Snack (collation).
  - Choix de la catégorie en créant une recette, en l'enregistrant depuis le Texte IA, et modifiable à tout moment dans le détail de la recette (« Ranger cette recette dans »).
  - Les idées du frigo de l'IA arrivent déjà classées ; ajoutées à un petit-déjeuner ou une collation, elles sont rangées dans la catégorie correspondante.
  - Les anciennes recettes sont classées automatiquement d'après leur nom (modifiable).
- **Ajouter → Recette** : tes recettes sont rangées avec celles de l'appli dans chaque catégorie (★ en premier, « ★ 1 à toi »), et la catégorie du repas choisi s'ouvre d'office (Dîner → Plat, Collations → Snack…).
- Mes recettes : filtres par catégorie, étiquette de provenance (Perso, Texte IA, Idée du frigo, En ligne).

## 2.17.1
- Idées de plats de l'IA (« Avec mon frigo ») : bouton **🍽 Ajouter à un repas** — choix du repas (petit-déjeuner, déjeuner, dîner, collations) et des portions, ajout direct au journal. La recette est enregistrée en même temps dans Mes recettes et apparaît ensuite dans « Récemment notées ».

## 2.17.0
- **Recettes réorganisées** : 3 onglets au lieu de 6, et une recherche dans toutes les recettes.
  - **Mes recettes** : bouton Créer, filtre par type (Perso, Idée du frigo…), les plus notées dans le journal en premier (« notée 3× · hier »).
  - **Idées** : recettes de l'appli avec filtres (Pas chères, Plat, Petit-déjeuner, Dessert, Soupe, Snack) et l'interrupteur **« Avec ce que j'ai dans mon frigo »**, qui réunit « Par ingrédients » et « Mon frigo » (recettes faisables, à acheter, idées IA, recherche TheMealDB).
  - **Semaine** : planning et liste de courses au même endroit (nombre d'articles sur l'onglet).
- **Ajouter → Recette** : recherche, « Récemment notées », « Mes recettes », puis les recettes de l'appli rangées par catégorie (repliées).

## 2.16.0
- Ajouter → onglet Recette : recherche, **Mes recettes** en premier (★, kcal par portion), puis les recettes de l'appli.
- Ajouter → Manuel : tes recettes apparaissent aussi dans la recherche d'aliments (« Mes recettes », au-dessus des aliments de base).

## 2.15.2
- Dépense par appli : pour Withings, le total utilisait encore celui recalculé par Health Connect (métabolisme compté seulement jusqu'à maintenant). Il est maintenant toujours « métabolisme de la journée entière + calories actives », comme dans l'appli Withings.
- Correction de l'affichage « dont undefined actives » pour une appli qui n'envoie qu'un total (Fitbit).

## 2.15.1
- Dépense par appli : le métabolisme de base est compté sur la journée entière, comme dans l'appli Withings (avant : seulement jusqu'à l'heure actuelle, d'où un total trop bas en journée). Détail affiché : « 2 698 métab. + 399 actives ».
- Si une seule appli envoie des calories à Health Connect, la carte explique comment en ajouter une autre pour comparer.

## 2.15.0
- **Dépense du jour, selon tes applis** (accueil) : une ligne par appli qui a envoyé des calories ce jour-là dans Health Connect, avec son total (reconstruit avec métabolisme de base + calories actives si l'appli n'envoie pas de total, cas de Withings).
- Moyenne des applis retenues : touche une appli pour l'inclure ou l'exclure (Fitbit exclu par défaut). Les applis absentes n'apparaissent pas.
- Comparaison : moyenne des montres sur les 7 derniers jours complets ↔ besoin réel calculé d'après le poids et les repas, avec un verdict (cohérent, surestime, sous-estime). L'objectif du jour ne change pas.
- Séances lues dans Health Connect regroupées par type avec leur vrai nom : « Marche · 7 fois · 133 min · via Withings ».
- Nouvelle autorisation de lecture « Métabolisme de base » : relancer `node scripts/patch-android.mjs`, puis Profil → Health Connect → Autoriser l'accès.

## 2.14.0
- **Mode sombre** : Profil → Apparence, « Comme le téléphone », « Clair » ou « Sombre ». Toutes les couleurs passent par un seul jeu de variables.
- **Planning de la semaine** (Recettes → Semaine) : placer des recettes (avec le nombre de portions) ou des repas types sur les jours, total prévu par jour comparé à l'objectif, « Noter » pour l'ajouter au journal, « Recopier la semaine précédente ».
- Le plat prévu apparaît dans le repas concerné sur l'accueil, avec un bouton « Noter ».
- « Courses pour la semaine » : ingrédients des plats prévus additionnés (en grammes), sans le sel/huile/épices ni ce qui est déjà dans « Mon frigo ».
- Détail d'une recette : bouton « Planifier un autre jour ».
- Android : thème « DayNight » (relancer `node scripts/patch-android.mjs`) pour que « Comme le téléphone » suive le mode sombre d'Android.

## 2.13.0
- Code réorganisé : le fichier principal (3 500 lignes) est découpé en écrans (`src/views/`) et en données (`src/foodData.js`). Aucun changement visible, base plus sûre pour le mode sombre et le planning.
- Première version qui déclenche l'alerte « nouvelle version » chez ceux qui ont la 2.12.0.

## 2.12.0
- Copie de sécurité automatique dans **Documents/NutriMaison** (chaque semaine ou chaque jour, les 4 dernières gardées). Elle survit à « Effacer les données » et à la désinstallation. Bouton « Sauvegarder maintenant ».
- Restauration depuis un fichier .json (en plus du copier-coller).
- Nouvelles versions : l'app vérifie une fois par jour les Releases GitHub et affiche un bandeau « NutriMaison X.Y.Z est disponible » avec téléchargement direct de l'APK. Carte **Profil → Mises à jour** (désactivable, vérification manuelle, notes de version).
- Nouvelle dépendance `@capacitor/filesystem` : relancer `setup.bat` (ou `npm install` puis `npx cap sync`) une fois.

## 2.11.0
- Calendrier : toucher « Aujourd'hui » (ou la date affichée) ouvre le mois. Chaque jour noté a une pastille (dans l'objectif, un peu au-dessus, au-dessus, journée partielle), ⚖ marque les pesées, moyenne du mois, bouton « Revenir à aujourd'hui ».

## 2.10.2
- Onglets des recettes (et autres rangées de choix : repas, catégories du sport…) : tous visibles, ils passent à la ligne au lieu de dépasser de l'écran.

## 2.10.1
- Mon frigo, plus pertinent : chaque ingrédient compte selon son poids dans le plat (10 g de miel ne suffisent plus à proposer un bol de fruits) ; un ingrédient principal du plat doit venir du frigo ; au plus 3 choses à acheter.
- Familles reconnues : « fromage » = emmental, feta, mozzarella… (mais pas le fromage blanc), « tortilla » = wrap, « pâtes » = spaghetti, penne…
- Chaque recette affiche « Avec ton frigo : … » et « À acheter : … ».
- IA : plats construits autour de tes ingrédients, associations logiques uniquement.

## 2.10.0
- Portions : « J'en ai mangé ¼ ⅓ ½ ⅔ ¾ / ×1,5 / ×2 » sur chaque aliment noté, et « Je n'en ai mangé qu'une partie » dans le menu ⋯ d'un repas (divise tout le repas).
- Recettes → nouvel onglet **Mon frigo** (« Par ingrédients » reste disponible, inchangé ; les deux partagent les aliments cochés) : aliments courants + saisie libre (« feta, épinards… »), mémorisés.
- Recettes de l'appli faisables avec le frigo, triées par nombre d'ingrédients manquants, avec « Il manque : … » et ajout à la liste de courses.
- Idées de plats par l'IA selon le frigo et l'objectif (perte, maintien, prise) : ce que tu as, ce qu'il faut acheter, kcal et macros par portion, enregistrement dans Mes recettes.
- Liste de courses : ajout manuel, cases à cocher, partage (SMS, WhatsApp…) ou copie.

## 2.9.0
- Accueil : chaque repas forme un seul bloc (total kcal et macros en en-tête), repliable d'un appui sur son nom.
- Menu ⋯ sur chaque repas : copier depuis un autre jour (14 derniers jours, tout le repas ou seulement certains aliments), copier vers un autre jour/repas, enregistrer comme **repas type**, vider le repas.
- Repas types : onglet « Repas » dans Ajouter, ajout de tout le repas en un appui.
- Scanner : produit inconnu → formulaire pour l'ajouter (option : photo de l'étiquette lue par l'IA). Le scan suivant le retrouve directement.
- Aliment choisi dans la liste : « Modifier les valeurs » pour 100 g à la volée, avec option « Mémoriser comme mon aliment ».
- Champs numériques (poids, taille, âge, quantités…) : le contenu est sélectionné à l'appui, la saisie le remplace (plus de « 0193 »).

## 2.8.1
- IA (photo, texte, coach) : plus de chargement sans fin. Délai maximum par requête (40-45 s) et au total, bascule vers un autre modèle si Google ne répond pas, bouton Annuler.
- « Réflexion » des modèles Gemini réduite au minimum : réponses plus rapides (retirée automatiquement si un modèle ne la prend pas en charge).
- Photos réduites à 1280 px avant envoi (une photo de plusieurs Mo part en ~200 Ko).
- La détection locale de secours est elle aussi limitée dans le temps.

## 2.8.0
- Nouvel identifiant de l'app : `app.nutrimaison`. ⚠️ S'installe comme une nouvelle app : exporter les données de l'ancienne puis les restaurer.
- La vraie version s'affiche dans Android (Infos de l'appli) et dans Profil.
- Restaurer une sauvegarde renvoie toutes les données récentes vers Health Connect.
- Licence GNU GPL v3.

## 2.7.1
- Hydratation : choix de la quantité (100 ml à 1,5 L, ou libre), ajout ou retrait ; le bouton rapide retient la dernière quantité.

## 2.7.0
- Favoris et aliments récents (ajout en un appui), « Comme la veille » sur un repas vide.
- Bilan de la semaine.
- Rappels : le soir si rien n'est noté, le matin pour la pesée.

## 2.6.0
- Logo, icônes adaptatives et monochromes, écran de démarrage.

## 2.5.0
- Modification d'un aliment du journal : quantité, repas, jour.

## 2.4.0
- Table Ciqual 2025 intégrée (3 341 aliments, hors ligne), eau réelle des aliments.

## 2.3.0
- Onglet « Texte IA » (repas ou recette décrits en texte libre).
- Recherche corrigée : sans accents, mot à mot, recherche plein texte Open Food Facts, estimation IA d'un aliment introuvable.

## 2.2.x
- Health Connect (Fitbit, Withings…) sans doublon, via un plugin Kotlin maison.
- Eau contenue dans les aliments.
- Passage à AGP 8.9.1, Gradle 8.11.1, compileSdk 36.

## 2.1.0
- Sport enrichi : boxe, kettlebell, abdos, mobilité, 142 exercices, 20 programmes.
- Séance sur mesure et coach IA.

## 2.0.x
- Onglet Sport : programmes, séances guidées, progression par niveaux, activités libres.
- Suivi du poids avec tendance, masse grasse (US Navy / Armée US), besoin réel adaptatif.
- Scanner de codes-barres refait (détecteur natif, lampe, photo, saisie manuelle).
- Gemini : choix automatique du modèle, nouvel essai et bascule en cas de saturation.
- Caméra intégrée pour la photo de repas.

## 1.0.0
- Journal des repas, macros, eau, recettes, Open Food Facts, scanner, photo IA, calcul des besoins.
