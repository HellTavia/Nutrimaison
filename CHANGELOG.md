# Historique des versions

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
