// SPDX-License-Identifier: GPL-3.0-only
// Copyright (C) 2026 Les auteurs de NutriMaison
/* ================================================================== */
/* DONNÉES SPORT — exercices, chaînes de progression, programmes,      */
/* activités libres. Tout est local, modifiable, sans serveur.         */
/* ================================================================== */

export const EQUIPMENT = {
  aucun: "Sans matériel",
  halteres: "Haltères",
  elastique: "Élastiques",
  traction: "Barre de traction",
  banc: "Banc / chaise solide",
  salle: "Salle de sport",
};

export const GROUPS = {
  jambes: "Jambes",
  fessiers: "Fessiers",
  pecs: "Pectoraux",
  dos: "Dos",
  epaules: "Épaules",
  bras: "Bras",
  abdos: "Abdos / gainage",
  cardio: "Cardio",
  mobilite: "Mobilité",
};

/*
 * kind : "reps" (répétitions) ou "time" (secondes)
 * met  : intensité (Compendium of Physical Activities, valeurs arrondies)
 * impact : "fort" = sauts / chocs → remplacé automatiquement en mode faible impact
 * chain + lvl : place dans une chaîne de progression (0 = plus facile)
 * perSide : à faire de chaque côté
 * weighted : on note une charge en kg
 */
export const EXERCISES = [
  /* ---- Pompes : du plus facile au plus dur ---- */
  { id: "pompes_mur", name: "Pompes contre un mur", group: "pecs", equip: ["aucun"], kind: "reps", met: 3, chain: "pompes", lvl: 0,
    cue: "Mains sur le mur à hauteur d'épaules, pieds à un grand pas du mur. Corps droit, descends la poitrine vers le mur, pousse. Recule les pieds pour rendre plus dur." },
  { id: "pompes_plan", name: "Pompes sur plan de travail", group: "pecs", equip: ["aucun"], kind: "reps", met: 3.5, chain: "pompes", lvl: 1,
    cue: "Mains sur un plan de travail ou une table stable. Corps gainé de la tête aux talons, coudes à 45° du corps." },
  { id: "pompes_banc", name: "Pompes sur chaise / banc", group: "pecs", equip: ["banc"], kind: "reps", met: 3.8, chain: "pompes", lvl: 2,
    cue: "Mains sur une chaise calée contre un mur ou un banc. Plus l'appui est bas, plus c'est difficile." },
  { id: "pompes_genoux", name: "Pompes sur les genoux", group: "pecs", equip: ["aucun"], kind: "reps", met: 3.8, chain: "pompes", lvl: 3,
    cue: "Genoux au sol (sur une serviette), ligne droite genoux-épaules. Poitrine jusqu'à quelques cm du sol." },
  { id: "pompes_neg", name: "Pompes négatives (descente lente)", group: "pecs", equip: ["aucun"], kind: "reps", met: 4, chain: "pompes", lvl: 4,
    cue: "Position de pompe classique, descends en 3 à 5 secondes jusqu'au sol, pose les genoux pour remonter. Construit la force pour la pompe complète." },
  { id: "pompes", name: "Pompes classiques", group: "pecs", equip: ["aucun"], kind: "reps", met: 4.5, chain: "pompes", lvl: 5,
    cue: "Mains un peu plus larges que les épaules, corps gainé, poitrine près du sol, pousse sans creuser le dos." },
  { id: "pompes_decl", name: "Pompes pieds surélevés", group: "pecs", equip: ["banc"], kind: "reps", met: 5, chain: "pompes", lvl: 6,
    cue: "Pieds sur une chaise ou un banc, mains au sol. Davantage de travail sur le haut des pectoraux et les épaules." },

  /* ---- Squat ---- */
  { id: "assis_debout", name: "Assis-debout sur chaise", group: "jambes", equip: ["banc"], kind: "reps", met: 3, chain: "squat", lvl: 0,
    cue: "Assieds-toi lentement sur une chaise puis relève-toi sans t'aider des mains. Pieds largeur de hanches." },
  { id: "squat", name: "Squat au poids du corps", group: "jambes", equip: ["aucun"], kind: "reps", met: 4, chain: "squat", lvl: 1,
    cue: "Pieds largeur d'épaules, pousse les fesses en arrière, genoux dans l'axe des pieds, talons au sol. Descends aussi bas que confortable." },
  { id: "squat_pause", name: "Squat avec pause en bas", group: "jambes", equip: ["aucun"], kind: "reps", met: 4.5, chain: "squat", lvl: 2,
    cue: "Même squat, mais tiens 2 secondes en position basse avant de remonter." },
  { id: "squat_bulgare", name: "Squat bulgare", group: "jambes", equip: ["banc"], kind: "reps", met: 5, chain: "squat", lvl: 3, perSide: true,
    cue: "Pied arrière posé sur une chaise, descends verticalement sur la jambe avant. Garde le buste droit." },
  { id: "squat_saute", name: "Squats sautés", group: "jambes", equip: ["aucun"], kind: "reps", met: 8, impact: "fort", lowImpactAlt: "squat_pause",
    cue: "Squat puis saut explosif, réception souple genoux fléchis." },

  /* ---- Fentes ---- */
  { id: "fente_statique", name: "Fente statique (avec appui)", group: "jambes", equip: ["aucun"], kind: "reps", met: 3.5, chain: "fente", lvl: 0, perSide: true,
    cue: "Un pied devant, un derrière, main sur un mur si besoin. Descends le genou arrière vers le sol et remonte, sans bouger les pieds." },
  { id: "fente", name: "Fentes alternées", group: "jambes", equip: ["aucun"], kind: "reps", met: 4, chain: "fente", lvl: 1, perSide: true,
    cue: "Grand pas en avant, genou arrière proche du sol, repousse pour revenir. Alterne les jambes." },
  { id: "fente_arr", name: "Fentes arrière", group: "jambes", equip: ["aucun"], kind: "reps", met: 4, chain: "fente", lvl: 2, perSide: true,
    cue: "Recule une jambe, plus doux pour les genoux que la fente avant." },
  { id: "fente_halt", name: "Fentes avec haltères", group: "jambes", equip: ["halteres"], kind: "reps", met: 5, chain: "fente", lvl: 3, perSide: true, weighted: true,
    cue: "Un haltère dans chaque main, bras tendus le long du corps." },

  /* ---- Fessiers / chaîne postérieure ---- */
  { id: "pont", name: "Pont fessier", group: "fessiers", equip: ["aucun"], kind: "reps", met: 3, chain: "pont", lvl: 0,
    cue: "Allongé sur le dos, pieds à plat, monte le bassin en serrant les fessiers, pause 1 s en haut." },
  { id: "pont_unijambe", name: "Pont fessier sur une jambe", group: "fessiers", equip: ["aucun"], kind: "reps", met: 3.5, chain: "pont", lvl: 1, perSide: true,
    cue: "Même mouvement avec une jambe tendue en l'air." },
  { id: "hip_thrust", name: "Hip thrust épaules sur banc", group: "fessiers", equip: ["banc"], kind: "reps", met: 4, chain: "pont", lvl: 2, weighted: true,
    cue: "Haut du dos contre un canapé ou un banc, charge éventuelle sur les hanches. Monte jusqu'à l'alignement épaules-genoux." },
  { id: "sdt_halt", name: "Soulevé de terre jambes tendues (haltères)", group: "fessiers", equip: ["halteres"], kind: "reps", met: 4.5, weighted: true,
    cue: "Genoux légèrement fléchis, dos plat, pousse les hanches en arrière en descendant les haltères le long des cuisses. Remonte en serrant les fessiers." },
  { id: "mollets", name: "Extensions des mollets", group: "jambes", equip: ["aucun"], kind: "reps", met: 3,
    cue: "Debout sur une marche, talons dans le vide, monte sur la pointe des pieds puis redescends lentement." },
  { id: "chaise", name: "Chaise contre le mur", group: "jambes", equip: ["aucun"], kind: "time", met: 3.5,
    cue: "Dos au mur, cuisses parallèles au sol (ou plus haut si difficile), tiens la position." },
  { id: "step_up", name: "Montées sur marche", group: "jambes", equip: ["banc"], kind: "reps", met: 5, perSide: true,
    cue: "Monte sur une marche ou une chaise basse en poussant sur le talon de la jambe du dessus." },

  /* ---- Dos ---- */
  { id: "superman", name: "Superman", group: "dos", equip: ["aucun"], kind: "reps", met: 3,
    cue: "Allongé sur le ventre, décolle bras et jambes du sol, pause 2 s, redescends." },
  { id: "rowing_serviette", name: "Rowing avec serviette (porte)", group: "dos", equip: ["aucun"], kind: "reps", met: 3.5,
    cue: "Une serviette passée autour d'une poignée de porte solide (porte fermée), penche-toi en arrière et tire ta poitrine vers la porte." },
  { id: "rowing_halt", name: "Rowing haltère un bras", group: "dos", equip: ["halteres"], kind: "reps", met: 4, perSide: true, weighted: true,
    cue: "Une main et un genou sur un banc ou une chaise, tire l'haltère vers la hanche, coude près du corps." },
  { id: "tirage_elast", name: "Tirage élastique (rowing)", group: "dos", equip: ["elastique"], kind: "reps", met: 3.5,
    cue: "Élastique fixé devant toi, tire les poignées vers le ventre en serrant les omoplates." },
  { id: "ecarte_arr_elast", name: "Écartés arrière à l'élastique", group: "epaules", equip: ["elastique"], kind: "reps", met: 3,
    cue: "Bras tendus devant toi, écarte l'élastique jusqu'à ce qu'il touche la poitrine. Excellent pour la posture." },
  { id: "suspension", name: "Suspension active à la barre", group: "dos", equip: ["traction"], kind: "time", met: 3, chain: "traction", lvl: 0,
    cue: "Suspends-toi bras tendus, épaules abaissées (loin des oreilles)." },
  { id: "traction_neg", name: "Tractions négatives", group: "dos", equip: ["traction"], kind: "reps", met: 5, chain: "traction", lvl: 1,
    cue: "Monte menton au-dessus de la barre (avec une chaise) puis redescends en 4 à 5 secondes." },
  { id: "traction_elast", name: "Tractions assistées élastique", group: "dos", equip: ["traction", "elastique"], kind: "reps", met: 5, chain: "traction", lvl: 2,
    cue: "Élastique accroché à la barre sous un genou ou un pied pour t'aider à monter." },
  { id: "traction", name: "Tractions", group: "dos", equip: ["traction"], kind: "reps", met: 6, chain: "traction", lvl: 3,
    cue: "Prise un peu plus large que les épaules, tire jusqu'à passer le menton au-dessus de la barre." },

  /* ---- Épaules / bras ---- */
  { id: "pike", name: "Pompes piquées (épaules)", group: "epaules", equip: ["aucun"], kind: "reps", met: 4,
    cue: "En V inversé, fesses vers le haut, descends le haut de la tête vers le sol entre tes mains." },
  { id: "dev_epaules", name: "Développé épaules haltères", group: "epaules", equip: ["halteres"], kind: "reps", met: 4, weighted: true,
    cue: "Assis ou debout, pousse les haltères au-dessus de la tête sans cambrer le dos." },
  { id: "elev_lat", name: "Élévations latérales", group: "epaules", equip: ["halteres"], kind: "reps", met: 3.5, weighted: true,
    cue: "Bras légèrement fléchis, monte les haltères sur les côtés jusqu'à hauteur d'épaules." },
  { id: "floor_press", name: "Développé couché au sol (haltères)", group: "pecs", equip: ["halteres"], kind: "reps", met: 4, weighted: true,
    cue: "Allongé au sol, pousse les haltères au-dessus de la poitrine, coudes qui touchent légèrement le sol en bas." },
  { id: "dips_chaise", name: "Dips sur chaise", group: "bras", equip: ["banc"], kind: "reps", met: 4,
    cue: "Mains sur le bord d'une chaise stable derrière toi, plie les coudes vers l'arrière. Genoux fléchis pour faciliter." },
  { id: "curl", name: "Curl biceps", group: "bras", equip: ["halteres"], kind: "reps", met: 3.5, weighted: true,
    cue: "Coudes collés au corps, monte les haltères sans balancer le buste." },
  { id: "ext_triceps", name: "Extension triceps au-dessus de la tête", group: "bras", equip: ["halteres"], kind: "reps", met: 3.5, weighted: true,
    cue: "Un haltère à deux mains derrière la tête, tends les bras vers le plafond." },
  { id: "curl_elast", name: "Curl à l'élastique", group: "bras", equip: ["elastique"], kind: "reps", met: 3.5,
    cue: "Pieds sur l'élastique, monte les poignées vers les épaules." },

  /* ---- Gainage / abdos ---- */
  { id: "gainage_genoux", name: "Gainage sur les genoux", group: "abdos", equip: ["aucun"], kind: "time", met: 3, chain: "gainage", lvl: 0,
    cue: "Avant-bras et genoux au sol, ligne droite épaules-genoux, rentre le nombril." },
  { id: "gainage", name: "Gainage planche", group: "abdos", equip: ["aucun"], kind: "time", met: 3.5, chain: "gainage", lvl: 1,
    cue: "Sur les avant-bras et les pointes de pieds, corps droit, fessiers serrés, respire normalement." },
  { id: "gainage_epaules", name: "Gainage avec touches d'épaules", group: "abdos", equip: ["aucun"], kind: "time", met: 4.5, chain: "gainage", lvl: 2,
    cue: "En position de pompe, touche l'épaule opposée en alternant, sans faire tourner le bassin." },
  { id: "gainage_lat", name: "Gainage latéral", group: "abdos", equip: ["aucun"], kind: "time", met: 3.5, perSide: true,
    cue: "Sur un avant-bras, corps aligné de profil. Genou inférieur au sol pour faciliter." },
  { id: "dead_bug", name: "Dead bug", group: "abdos", equip: ["aucun"], kind: "reps", met: 3, perSide: true,
    cue: "Sur le dos, bras vers le plafond, genoux à 90°. Allonge bras et jambe opposés en gardant le bas du dos collé au sol." },
  { id: "bird_dog", name: "Bird dog", group: "abdos", equip: ["aucun"], kind: "reps", met: 2.8, perSide: true,
    cue: "À quatre pattes, tends bras et jambe opposés, pause 2 s. Dos neutre." },
  { id: "releve_genoux", name: "Relevés de genoux suspendu", group: "abdos", equip: ["traction"], kind: "reps", met: 4,
    cue: "Suspendu à la barre, monte les genoux vers la poitrine sans balancer." },

  /* ---- Cardio ---- */
  { id: "marche_genoux", name: "Marche genoux hauts", group: "cardio", equip: ["aucun"], kind: "time", met: 4.5,
    cue: "Sur place, monte les genoux à hauteur de hanches en marchant énergiquement, bras actifs." },
  { id: "montee_genoux", name: "Montées de genoux (course sur place)", group: "cardio", equip: ["aucun"], kind: "time", met: 8, impact: "fort", lowImpactAlt: "marche_genoux",
    cue: "Cours sur place en montant les genoux, reste sur l'avant des pieds." },
  { id: "pas_chasses", name: "Jumping jacks sans saut", group: "cardio", equip: ["aucun"], kind: "time", met: 4.5,
    cue: "Écarte une jambe sur le côté en levant les bras, reviens, alterne. Aucun impact." },
  { id: "jumping", name: "Jumping jacks", group: "cardio", equip: ["aucun"], kind: "time", met: 8, impact: "fort", lowImpactAlt: "pas_chasses",
    cue: "Saute en écartant bras et jambes, puis reviens." },
  { id: "mountain", name: "Mountain climbers", group: "cardio", equip: ["aucun"], kind: "time", met: 8,
    cue: "En position de pompe, ramène les genoux vers la poitrine en alternant. Version lente pour débuter, mains sur une chaise pour faciliter." },
  { id: "burpee_lent", name: "Burpees sans saut", group: "cardio", equip: ["aucun"], kind: "reps", met: 6,
    cue: "Mains au sol, recule un pied puis l'autre, reviens, relève-toi. Aucun saut." },
  { id: "burpee", name: "Burpees", group: "cardio", equip: ["aucun"], kind: "reps", met: 8, impact: "fort", lowImpactAlt: "burpee_lent",
    cue: "Squat, mains au sol, pieds en arrière, retour, saut bras en l'air." },
  { id: "corde", name: "Corde à sauter", group: "cardio", equip: ["aucun"], kind: "time", met: 11, impact: "fort", lowImpactAlt: "pas_chasses",
    cue: "Petits sauts sur l'avant des pieds, poignets qui tournent." },
  { id: "boxe_air", name: "Shadow boxing", group: "cardio", equip: ["aucun"], kind: "time", met: 5.5,
    cue: "Enchaîne directs et crochets dans le vide en restant mobile sur tes appuis." },

  /* ---- Salle ---- */
  { id: "presse", name: "Presse à cuisses", group: "jambes", equip: ["salle"], kind: "reps", met: 5, weighted: true,
    cue: "Pieds largeur d'épaules au milieu du plateau, descends jusqu'à 90° de genou, pousse sans verrouiller les genoux." },
  { id: "squat_barre", name: "Squat à la barre", group: "jambes", equip: ["salle"], kind: "reps", met: 5.5, weighted: true,
    cue: "Barre sur les trapèzes, dos gainé, descends hanches en arrière. Commence léger pour la technique." },
  { id: "goblet", name: "Goblet squat", group: "jambes", equip: ["halteres"], kind: "reps", met: 5, weighted: true,
    cue: "Un haltère tenu contre la poitrine, squat profond, coudes entre les genoux." },
  { id: "leg_curl", name: "Leg curl (ischios)", group: "jambes", equip: ["salle"], kind: "reps", met: 4, weighted: true,
    cue: "Ramène le boudin vers les fessiers lentement, contrôle le retour." },
  { id: "leg_ext", name: "Leg extension", group: "jambes", equip: ["salle"], kind: "reps", met: 4, weighted: true,
    cue: "Tends les jambes sans à-coup, pause 1 s en haut." },
  { id: "sdt", name: "Soulevé de terre roumain (barre)", group: "fessiers", equip: ["salle"], kind: "reps", met: 5.5, weighted: true,
    cue: "Barre près des jambes, dos plat, charnière de hanche. Léger au début." },
  { id: "dev_couche", name: "Développé couché", group: "pecs", equip: ["salle"], kind: "reps", met: 5, weighted: true,
    cue: "Omoplates serrées, barre descend au bas des pectoraux, pousse en ligne droite." },
  { id: "dev_couche_machine", name: "Développé pectoraux machine", group: "pecs", equip: ["salle"], kind: "reps", met: 4.5, weighted: true,
    cue: "Poignées à hauteur de poitrine, pousse sans décoller le dos du dossier." },
  { id: "tirage_vert", name: "Tirage vertical (poulie haute)", group: "dos", equip: ["salle"], kind: "reps", met: 4.5, weighted: true,
    cue: "Tire la barre vers le haut de la poitrine, coudes vers le bas, sans balancer." },
  { id: "tirage_horiz", name: "Tirage horizontal assis", group: "dos", equip: ["salle"], kind: "reps", met: 4.5, weighted: true,
    cue: "Dos droit, tire la poignée vers le ventre en serrant les omoplates." },
  { id: "dev_epaules_machine", name: "Développé épaules machine", group: "epaules", equip: ["salle"], kind: "reps", met: 4.5, weighted: true,
    cue: "Pousse au-dessus de la tête, dos collé au dossier." },
  { id: "face_pull", name: "Face pull (poulie)", group: "epaules", equip: ["salle"], kind: "reps", met: 3.5, weighted: true,
    cue: "Corde à hauteur de visage, tire vers le front en écartant les mains." },
  { id: "tapis_marche", name: "Tapis — marche inclinée", group: "cardio", equip: ["salle"], kind: "time", met: 5.5,
    cue: "Inclinaison 8-12 %, 4,5-5,5 km/h, sans te tenir aux barres. Très efficace et doux pour les articulations." },
  { id: "velo_salle", name: "Vélo stationnaire", group: "cardio", equip: ["salle"], kind: "time", met: 6.8,
    cue: "Résistance modérée, tu dois pouvoir parler en phrases courtes." },
  { id: "rameur", name: "Rameur", group: "cardio", equip: ["salle"], kind: "time", met: 7,
    cue: "Pousse d'abord avec les jambes, puis bascule le buste, puis tire les bras." },
  { id: "elliptique", name: "Elliptique", group: "cardio", equip: ["salle"], kind: "time", met: 5,
    cue: "Rythme régulier, pousse et tire avec les bras." },

  /* ---- Mobilité ---- */
  { id: "etirements", name: "Étirements globaux", group: "mobilite", equip: ["aucun"], kind: "time", met: 2.3,
    cue: "Ischios, quadriceps, pectoraux, épaules : 30 s chacun, sans à-coups, respiration lente." },
  { id: "chat_vache", name: "Chat-vache", group: "mobilite", equip: ["aucun"], kind: "reps", met: 2.3,
    cue: "À quatre pattes, arrondis puis creuse le dos lentement au rythme de la respiration." },
  { id: "rotation_thor", name: "Rotations thoraciques", group: "mobilite", equip: ["aucun"], kind: "reps", met: 2.3, perSide: true,
    cue: "À quatre pattes, une main derrière la tête, ouvre le coude vers le plafond." },
];

export const CHAIN_NAMES = {
  pompes: "Pompes", squat: "Squat", fente: "Fentes", pont: "Pont fessier", traction: "Tractions", gainage: "Gainage",
};

/* ------------------------------------------------------------------ */
/* PROGRAMMES                                                          */
/* items : { ex, sets, reps | sec, rest }                              */
/* ------------------------------------------------------------------ */
export const PROGRAMS = [
  {
    id: "reprise_maison", name: "Reprise en douceur", type: "force", level: "debutant", equip: ["aucun"], perWeek: 3, minutes: 30, met: 3.8,
    desc: "Full body sans matériel pour reprendre. Les pompes commencent au mur : l'app te fera monter de niveau quand tu réussis toutes tes séries.",
    sessions: [
      { name: "Séance A", items: [
        { ex: "marche_genoux", sets: 1, sec: 180, rest: 30 },
        { ex: "squat", sets: 3, reps: 10, rest: 75 },
        { ex: "pompes_mur", sets: 3, reps: 10, rest: 75 },
        { ex: "pont", sets: 3, reps: 12, rest: 60 },
        { ex: "rowing_serviette", sets: 3, reps: 10, rest: 60 },
        { ex: "gainage_genoux", sets: 3, sec: 25, rest: 45 },
      ]},
      { name: "Séance B", items: [
        { ex: "pas_chasses", sets: 1, sec: 180, rest: 30 },
        { ex: "fente_statique", sets: 3, reps: 8, rest: 75 },
        { ex: "pompes_mur", sets: 3, reps: 10, rest: 75 },
        { ex: "superman", sets: 3, reps: 10, rest: 60 },
        { ex: "chaise", sets: 3, sec: 25, rest: 60 },
        { ex: "dead_bug", sets: 3, reps: 6, rest: 45 },
      ]},
    ],
  },
  {
    id: "maison_progression", name: "Renfo maison progressif", type: "force", level: "intermediaire", equip: ["aucun"], perWeek: 3, minutes: 40, met: 4.3,
    desc: "Le niveau suivant, toujours sans matériel. Chaque exercice suit ta propre progression (tu peux descendre d'un cran à tout moment).",
    sessions: [
      { name: "Haut du corps", items: [
        { ex: "pas_chasses", sets: 1, sec: 180, rest: 30 },
        { ex: "pompes_genoux", sets: 4, reps: 10, rest: 90 },
        { ex: "rowing_serviette", sets: 4, reps: 12, rest: 75 },
        { ex: "pike", sets: 3, reps: 8, rest: 75 },
        { ex: "superman", sets: 3, reps: 12, rest: 60 },
        { ex: "gainage", sets: 3, sec: 35, rest: 45 },
      ]},
      { name: "Bas du corps", items: [
        { ex: "marche_genoux", sets: 1, sec: 180, rest: 30 },
        { ex: "squat_pause", sets: 4, reps: 10, rest: 90 },
        { ex: "fente_arr", sets: 3, reps: 10, rest: 75 },
        { ex: "pont_unijambe", sets: 3, reps: 10, rest: 60 },
        { ex: "mollets", sets: 3, reps: 15, rest: 45 },
        { ex: "gainage_lat", sets: 2, sec: 25, rest: 30 },
      ]},
      { name: "Circuit complet", items: [
        { ex: "squat", sets: 3, reps: 15, rest: 20 },
        { ex: "pompes_genoux", sets: 3, reps: 8, rest: 20 },
        { ex: "mountain", sets: 3, sec: 30, rest: 20 },
        { ex: "fente", sets: 3, reps: 8, rest: 20 },
        { ex: "burpee_lent", sets: 3, reps: 8, rest: 60 },
      ]},
    ],
  },
  {
    id: "circuit_express", name: "Circuit brûle-calories 20 min", type: "force", level: "intermediaire", equip: ["aucun"], perWeek: 2, minutes: 20, met: 6,
    desc: "Court et intense, en complément d'un programme de force. Version sans saut automatique si tu actives le mode faible impact.",
    sessions: [
      { name: "Circuit", items: [
        { ex: "jumping", sets: 4, sec: 40, rest: 20 },
        { ex: "squat", sets: 4, reps: 15, rest: 15 },
        { ex: "mountain", sets: 4, sec: 30, rest: 15 },
        { ex: "pompes_genoux", sets: 4, reps: 8, rest: 15 },
        { ex: "burpee", sets: 4, reps: 6, rest: 60 },
      ]},
    ],
  },
  {
    id: "halteres_full", name: "Full body haltères", type: "force", level: "debutant", equip: ["halteres"], perWeek: 3, minutes: 45, met: 4.5,
    desc: "Maison avec une paire d'haltères réglables. Augmente la charge quand toutes les séries sont réussies.",
    sessions: [
      { name: "Séance A", items: [
        { ex: "pas_chasses", sets: 1, sec: 180, rest: 30 },
        { ex: "goblet", sets: 3, reps: 10, rest: 90 },
        { ex: "floor_press", sets: 3, reps: 10, rest: 90 },
        { ex: "rowing_halt", sets: 3, reps: 10, rest: 75 },
        { ex: "sdt_halt", sets: 3, reps: 10, rest: 90 },
        { ex: "gainage", sets: 3, sec: 30, rest: 45 },
      ]},
      { name: "Séance B", items: [
        { ex: "marche_genoux", sets: 1, sec: 180, rest: 30 },
        { ex: "fente_halt", sets: 3, reps: 8, rest: 90 },
        { ex: "dev_epaules", sets: 3, reps: 10, rest: 75 },
        { ex: "rowing_halt", sets: 3, reps: 12, rest: 75 },
        { ex: "pont", sets: 3, reps: 15, rest: 60 },
        { ex: "curl", sets: 2, reps: 12, rest: 45 },
        { ex: "ext_triceps", sets: 2, reps: 12, rest: 45 },
      ]},
    ],
  },
  {
    id: "salle_debutant", name: "Salle — full body débutant", type: "force", level: "debutant", equip: ["salle"], perWeek: 3, minutes: 55, met: 4.5,
    desc: "Machines et charges guidées pour apprendre en sécurité, finition cardio en marche inclinée.",
    sessions: [
      { name: "Séance A", items: [
        { ex: "velo_salle", sets: 1, sec: 300, rest: 30 },
        { ex: "presse", sets: 3, reps: 12, rest: 90 },
        { ex: "dev_couche_machine", sets: 3, reps: 10, rest: 90 },
        { ex: "tirage_vert", sets: 3, reps: 10, rest: 90 },
        { ex: "leg_curl", sets: 3, reps: 12, rest: 60 },
        { ex: "gainage", sets: 3, sec: 30, rest: 45 },
        { ex: "tapis_marche", sets: 1, sec: 900, rest: 0 },
      ]},
      { name: "Séance B", items: [
        { ex: "rameur", sets: 1, sec: 300, rest: 30 },
        { ex: "goblet", sets: 3, reps: 10, rest: 90 },
        { ex: "tirage_horiz", sets: 3, reps: 10, rest: 90 },
        { ex: "dev_epaules_machine", sets: 3, reps: 10, rest: 90 },
        { ex: "sdt", sets: 3, reps: 10, rest: 90 },
        { ex: "face_pull", sets: 2, reps: 15, rest: 45 },
        { ex: "tapis_marche", sets: 1, sec: 900, rest: 0 },
      ]},
    ],
  },
  {
    id: "salle_haut_bas", name: "Salle — haut / bas", type: "force", level: "intermediaire", equip: ["salle"], perWeek: 4, minutes: 60, met: 5,
    desc: "4 séances : 2 haut du corps, 2 bas du corps. Pour quand le full body devient facile.",
    sessions: [
      { name: "Haut 1", items: [
        { ex: "dev_couche", sets: 4, reps: 8, rest: 120 },
        { ex: "tirage_horiz", sets: 4, reps: 10, rest: 90 },
        { ex: "dev_epaules", sets: 3, reps: 10, rest: 90 },
        { ex: "tirage_vert", sets: 3, reps: 10, rest: 90 },
        { ex: "curl", sets: 3, reps: 12, rest: 60 },
        { ex: "ext_triceps", sets: 3, reps: 12, rest: 60 },
      ]},
      { name: "Bas 1", items: [
        { ex: "squat_barre", sets: 4, reps: 8, rest: 150 },
        { ex: "sdt", sets: 3, reps: 10, rest: 120 },
        { ex: "fente_halt", sets: 3, reps: 10, rest: 90 },
        { ex: "leg_curl", sets: 3, reps: 12, rest: 60 },
        { ex: "mollets", sets: 3, reps: 15, rest: 45 },
      ]},
      { name: "Haut 2", items: [
        { ex: "dev_couche_machine", sets: 3, reps: 12, rest: 90 },
        { ex: "rowing_halt", sets: 4, reps: 10, rest: 90 },
        { ex: "elev_lat", sets: 3, reps: 15, rest: 60 },
        { ex: "face_pull", sets: 3, reps: 15, rest: 60 },
        { ex: "pompes", sets: 2, reps: 10, rest: 60 },
      ]},
      { name: "Bas 2", items: [
        { ex: "presse", sets: 4, reps: 12, rest: 120 },
        { ex: "hip_thrust", sets: 3, reps: 10, rest: 90 },
        { ex: "leg_ext", sets: 3, reps: 12, rest: 60 },
        { ex: "gainage", sets: 3, sec: 45, rest: 45 },
        { ex: "tapis_marche", sets: 1, sec: 900, rest: 0 },
      ]},
    ],
  },
  {
    id: "elastiques_full", name: "Full body élastiques", type: "force", level: "debutant", equip: ["elastique"], perWeek: 3, minutes: 35, met: 4,
    desc: "Un kit d'élastiques et une porte suffisent. Idéal en voyage.",
    sessions: [
      { name: "Séance", items: [
        { ex: "pas_chasses", sets: 1, sec: 180, rest: 30 },
        { ex: "squat", sets: 3, reps: 15, rest: 60 },
        { ex: "tirage_elast", sets: 3, reps: 12, rest: 60 },
        { ex: "pompes_genoux", sets: 3, reps: 8, rest: 75 },
        { ex: "ecarte_arr_elast", sets: 3, reps: 15, rest: 45 },
        { ex: "pont", sets: 3, reps: 15, rest: 45 },
        { ex: "curl_elast", sets: 2, reps: 12, rest: 45 },
        { ex: "dead_bug", sets: 2, reps: 8, rest: 30 },
      ]},
    ],
  },
  {
    id: "marche_course", name: "De la marche à 30 min de course", type: "intervalle", level: "debutant", equip: ["aucun"], perWeek: 3, minutes: 30,
    desc: "8 semaines, 3 sorties par semaine. Alternance course lente / marche, guidée par bips et vibrations. Refais une semaine si elle était trop dure.",
    weeks: buildRunWeeks(),
  },
  {
    id: "marche_active", name: "Marche active", type: "intervalle", level: "debutant", equip: ["aucun"], perWeek: 3, minutes: 40,
    desc: "Marche rapide avec accélérations. Tes pas sont déjà comptés à part : seule l'intensité en plus est ajoutée.",
    weeks: [
      { label: "Niveau 1", steps: intervals([{ l: "Marche normale", s: 300, k: "walk" }], [{ l: "Marche rapide", s: 180, k: "brisk" }, { l: "Marche normale", s: 120, k: "walk" }], 5, [{ l: "Retour au calme", s: 300, k: "walk" }]) },
      { label: "Niveau 2", steps: intervals([{ l: "Marche normale", s: 300, k: "walk" }], [{ l: "Marche très rapide", s: 240, k: "brisk" }, { l: "Marche normale", s: 60, k: "walk" }], 7, [{ l: "Retour au calme", s: 300, k: "walk" }]) },
      { label: "Niveau 3 (côtes)", steps: intervals([{ l: "Marche normale", s: 300, k: "walk" }], [{ l: "Montée / escaliers", s: 120, k: "hill" }, { l: "Marche rapide", s: 180, k: "brisk" }], 7, [{ l: "Retour au calme", s: 300, k: "walk" }]) },
    ],
  },
];

/* MET des étapes d'intervalle */
export const STEP_MET = { walk: 3.5, brisk: 4.8, hill: 6.5, run: 8.3, rest: 1.5 };

function intervals(warm, block, repeat, cool) {
  const out = [...warm];
  for (let i = 0; i < repeat; i++) out.push(...block);
  out.push(...cool);
  return out;
}
function buildRunWeeks() {
  const W = { l: "Échauffement marche", s: 300, k: "walk" };
  const CD = { l: "Retour au calme marche", s: 300, k: "walk" };
  const run = (s) => ({ l: "Course lente", s, k: "run" });
  const walk = (s) => ({ l: "Marche", s, k: "walk" });
  return [
    { label: "Semaine 1", steps: intervals([W], [run(60), walk(90)], 8, [CD]) },
    { label: "Semaine 2", steps: intervals([W], [run(120), walk(120)], 6, [CD]) },
    { label: "Semaine 3", steps: intervals([W], [run(180), walk(90)], 5, [CD]) },
    { label: "Semaine 4", steps: intervals([W], [run(300), walk(150)], 4, [CD]) },
    { label: "Semaine 5", steps: intervals([W], [run(480), walk(120)], 3, [CD]) },
    { label: "Semaine 6", steps: intervals([W], [run(720), walk(120)], 2, [CD]) },
    { label: "Semaine 7", steps: [W, run(1200), walk(120), run(300), CD] },
    { label: "Semaine 8", steps: [W, run(1800), CD] },
  ];
}

/* ------------------------------------------------------------------ */
/* ACTIVITÉS LIBRES (MET, Compendium of Physical Activities)           */
/* ------------------------------------------------------------------ */
export const ACTIVITIES = [
  { id: "marche_rapide", name: "Marche rapide (hors pas comptés)", met: 4.3, walk: true },
  { id: "randonnee", name: "Randonnée", met: 6, walk: true },
  { id: "course_8", name: "Course lente (8 km/h)", met: 8.3 },
  { id: "course_10", name: "Course (10 km/h)", met: 9.8 },
  { id: "course_12", name: "Course rapide (12 km/h)", met: 11.5 },
  { id: "velo_balade", name: "Vélo balade", met: 4 },
  { id: "velo_sport", name: "Vélo sportif", met: 8 },
  { id: "velo_appart", name: "Vélo d'appartement modéré", met: 6.8 },
  { id: "natation", name: "Natation modérée", met: 5.8 },
  { id: "aquagym", name: "Aquagym", met: 5.3 },
  { id: "elliptique", name: "Elliptique", met: 5 },
  { id: "rameur", name: "Rameur", met: 7 },
  { id: "muscu", name: "Musculation (séance libre)", met: 5 },
  { id: "hiit", name: "HIIT / cross-training", met: 8 },
  { id: "corde", name: "Corde à sauter", met: 11 },
  { id: "yoga", name: "Yoga", met: 2.5 },
  { id: "pilates", name: "Pilates", met: 3 },
  { id: "etirements", name: "Étirements / mobilité", met: 2.3 },
  { id: "danse", name: "Danse", met: 5 },
  { id: "football", name: "Football", met: 7 },
  { id: "basket", name: "Basket", met: 6.5 },
  { id: "tennis", name: "Tennis", met: 7.3 },
  { id: "badminton", name: "Badminton", met: 5.5 },
  { id: "padel", name: "Padel", met: 6 },
  { id: "boxe", name: "Boxe (sac / entraînement)", met: 7.8 },
  { id: "escalade", name: "Escalade", met: 7.5 },
  { id: "jardinage", name: "Jardinage", met: 3.8 },
  { id: "bricolage", name: "Bricolage / déménagement", met: 4.5 },
  { id: "menage", name: "Ménage énergique", met: 3.3 },
];
export const INTENSITY = { leger: 0.8, modere: 1, intense: 1.2 };

/* ================================================================== */
/* EXTENSION v2.1 — boxe, kettlebell, abdos, mobilité, cardio doux…    */
/* ================================================================== */
Object.assign(EQUIPMENT, {
  kettlebell: "Kettlebell",
  sac: "Sac de frappe",
  velo: "Vélo d'appartement",
  corde: "Corde à sauter",
});
Object.assign(GROUPS, { boxe: "Boxe" });

EXERCISES.push(
  /* ---- Boxe ---- */
  { id: "box_garde", name: "Garde et déplacements", group: "boxe", equip: ["aucun"], kind: "time", met: 5,
    cue: "Pieds décalés (gaucher : pied droit devant), genoux souples, poings au menton, coudes serrés. Déplace-toi par petits pas glissés avant/arrière/côtés sans croiser les pieds." },
  { id: "box_jab", name: "Jab (direct bras avant)", group: "boxe", equip: ["aucun"], kind: "time", met: 6,
    cue: "Lance le poing avant en ligne droite, poing qui tourne en fin de mouvement, ramène-le aussitôt au menton. L'autre main reste en garde. Expire à chaque coup." },
  { id: "box_12", name: "Jab-direct (1-2)", group: "boxe", equip: ["aucun"], kind: "time", met: 7,
    cue: "Jab puis direct du bras arrière en pivotant la hanche et le pied arrière. Bras tendus sans verrouiller le coude." },
  { id: "box_crochets", name: "Crochets alternés", group: "boxe", equip: ["aucun"], kind: "time", met: 7,
    cue: "Coude plié à 90°, à hauteur d'épaule, la rotation vient des hanches et du pied. Alterne gauche/droite sans baisser la garde." },
  { id: "box_uppercuts", name: "Uppercuts alternés", group: "boxe", equip: ["aucun"], kind: "time", met: 7,
    cue: "Fléchis légèrement les genoux, remonte le poing de bas en haut en poussant avec les jambes. Le poing finit à hauteur du menton." },
  { id: "box_123", name: "Combo jab-direct-crochet (1-2-3)", group: "boxe", equip: ["aucun"], kind: "time", met: 7.5,
    cue: "Enchaîne jab, direct, crochet avant. Reviens en garde après chaque combo, puis repars. Qualité avant vitesse." },
  { id: "box_1234", name: "Combo 1-2-3-2 + esquive", group: "boxe", equip: ["aucun"], kind: "time", met: 8,
    cue: "Jab, direct, crochet avant, direct, puis esquive rotative (descente en fléchissant les genoux en U). Intermédiaire." },
  { id: "box_esquives", name: "Esquives rotatives", group: "boxe", equip: ["aucun"], kind: "time", met: 6,
    cue: "En garde, fléchis les genoux et passe la tête en dessous d'une ligne imaginaire en dessinant un U. Dos droit, regard devant." },
  { id: "box_speed", name: "Frappes rapides en continu", group: "boxe", equip: ["aucun"], kind: "time", met: 8,
    cue: "Directs courts et rapides en alternance, sans t'arrêter, en restant sur l'avant des pieds. Garde les épaules relâchées." },
  { id: "box_squat_punch", name: "Squat + 2 directs", group: "boxe", equip: ["aucun"], kind: "time", met: 6.5,
    cue: "Un squat, en remontant enchaîne deux directs, puis recommence. Excellent brûle-calories sans impact." },
  { id: "box_front_kick", name: "Coups de pied de face", group: "boxe", equip: ["aucun"], kind: "time", met: 7, perSide: true,
    cue: "Monte le genou puis pousse le talon vers l'avant, garde haute. Reviens en garde. Version kickboxing." },
  { id: "box_genoux", name: "Coups de genou", group: "boxe", equip: ["aucun"], kind: "time", met: 7,
    cue: "Mains devant comme si tu tenais une nuque, monte un genou en tirant les mains vers le bas, alterne." },
  { id: "box_sac", name: "Round au sac (technique)", group: "boxe", equip: ["sac"], kind: "time", met: 7.8,
    cue: "Travaille tes combinaisons au sac en tournant autour. Bandes ou gants obligatoires. Frappe avec les deux premières phalanges." },
  { id: "box_sac_power", name: "Round au sac (puissance)", group: "boxe", equip: ["sac"], kind: "time", met: 9,
    cue: "Séries de 3-4 coups appuyés, rotation complète des hanches, puis 5 s de déplacement. Expire fort à chaque frappe." },
  { id: "box_sac_rafale", name: "Rafales au sac", group: "boxe", equip: ["sac"], kind: "time", met: 10,
    cue: "20 s de frappes rapides en continu / 10 s de garde, en boucle sur la durée." },
  { id: "sprawl_lent", name: "Sprawls sans saut", group: "boxe", equip: ["aucun"], kind: "reps", met: 6,
    cue: "Mains au sol, recule un pied puis l'autre, descends les hanches vers le sol, reviens en garde." },
  { id: "sprawl", name: "Sprawls", group: "boxe", equip: ["aucun"], kind: "reps", met: 8, impact: "fort", lowImpactAlt: "sprawl_lent",
    cue: "Défense de lutte : projette les jambes en arrière, hanches au sol, et reviens en garde d'un mouvement explosif." },

  /* ---- Kettlebell ---- */
  { id: "kb_swing", name: "Swing kettlebell", group: "fessiers", equip: ["kettlebell"], kind: "reps", met: 9.8, weighted: true,
    cue: "Charnière de hanche (pas un squat) : pousse les hanches en arrière, puis projette-les vers l'avant pour faire monter la kettlebell à hauteur de poitrine. Bras relâchés, dos plat." },
  { id: "kb_goblet", name: "Goblet squat kettlebell", group: "jambes", equip: ["kettlebell"], kind: "reps", met: 5, weighted: true,
    cue: "Kettlebell tenue par les cornes contre la poitrine, squat profond, coudes entre les genoux." },
  { id: "kb_deadlift", name: "Soulevé de terre kettlebell", group: "fessiers", equip: ["kettlebell"], kind: "reps", met: 5, weighted: true,
    cue: "Kettlebell entre les pieds, dos plat, saisis-la et relève-toi en poussant le sol avec les pieds." },
  { id: "kb_row", name: "Rowing kettlebell", group: "dos", equip: ["kettlebell"], kind: "reps", met: 4, perSide: true, weighted: true,
    cue: "Buste penché dos plat, tire la kettlebell vers la hanche." },
  { id: "kb_press", name: "Développé kettlebell un bras", group: "epaules", equip: ["kettlebell"], kind: "reps", met: 4.5, perSide: true, weighted: true,
    cue: "Kettlebell en position rack (contre l'épaule), pousse au-dessus de la tête, fessiers et abdos serrés." },
  { id: "kb_clean", name: "Épaulé kettlebell", group: "epaules", equip: ["kettlebell"], kind: "reps", met: 6, perSide: true, weighted: true,
    cue: "Petit swing puis ramène la kettlebell en position rack en gardant le coude près du corps : elle doit tourner autour du poignet sans le frapper." },
  { id: "kb_halo", name: "Halo kettlebell", group: "mobilite", equip: ["kettlebell"], kind: "reps", met: 3.5, weighted: true,
    cue: "Kettlebell tenue à l'envers, fais-la tourner lentement autour de la tête. Alterne les sens." },
  { id: "kb_getup", name: "Relevé turc (Turkish get-up)", group: "abdos", equip: ["kettlebell"], kind: "reps", met: 5, perSide: true, weighted: true,
    cue: "Mouvement technique : apprends-le d'abord sans charge (ou avec une chaussure en équilibre sur le poing). Bras tendu vers le plafond tout le long." },

  /* ---- Abdos ---- */
  { id: "crunch", name: "Crunch", group: "abdos", equip: ["aucun"], kind: "reps", met: 3.5,
    cue: "Sur le dos, genoux pliés, enroule le haut du dos en décollant les omoplates, menton rentré. Ne tire pas sur la nuque." },
  { id: "crunch_velo", name: "Crunch vélo", group: "abdos", equip: ["aucun"], kind: "reps", met: 4, perSide: true,
    cue: "Coude vers le genou opposé en pédalant lentement, bas du dos au sol." },
  { id: "releve_jambes", name: "Relevés de jambes au sol", group: "abdos", equip: ["aucun"], kind: "reps", met: 3.8,
    cue: "Sur le dos, mains sous les fesses, monte les jambes tendues (ou pliées pour faciliter) sans creuser le dos." },
  { id: "hollow", name: "Barque (hollow hold)", group: "abdos", equip: ["aucun"], kind: "time", met: 3.8,
    cue: "Sur le dos, décolle épaules et jambes, bas du dos plaqué au sol. Genoux pliés pour faciliter." },
  { id: "russian_twist", name: "Russian twist", group: "abdos", equip: ["aucun"], kind: "reps", met: 4, perSide: true,
    cue: "Assis buste incliné en arrière, pieds au sol (ou décollés), tourne les épaules d'un côté à l'autre." },
  { id: "planche_updown", name: "Planche montée-descente", group: "abdos", equip: ["aucun"], kind: "time", met: 5,
    cue: "Passe de la planche sur avant-bras à la planche sur mains, une main après l'autre, en alternant le bras qui commence." },
  { id: "flutter", name: "Battements de jambes", group: "abdos", equip: ["aucun"], kind: "time", met: 4,
    cue: "Sur le dos, jambes tendues légèrement décollées, petits battements alternés. Bas du dos au sol." },

  /* ---- Cardio doux / dynamique ---- */
  { id: "marche_place", name: "Marche rapide sur place", group: "cardio", equip: ["aucun"], kind: "time", met: 4,
    cue: "Marche dynamique sur place, bras qui balancent. Parfait pour s'échauffer." },
  { id: "step_touch", name: "Pas chassés latéraux", group: "cardio", equip: ["aucun"], kind: "time", met: 4.5,
    cue: "Deux pas sur le côté, deux pas de l'autre côté, genoux souples, bras actifs." },
  { id: "patineur_lent", name: "Patineur sans saut", group: "cardio", equip: ["aucun"], kind: "time", met: 5,
    cue: "Grand pas en diagonale arrière en fléchissant la jambe d'appui, alterne les côtés." },
  { id: "patineur", name: "Patineur sauté", group: "cardio", equip: ["aucun"], kind: "time", met: 7.5, impact: "fort", lowImpactAlt: "patineur_lent",
    cue: "Bonds latéraux d'une jambe sur l'autre, réception souple." },
  { id: "talons_marche", name: "Talons-fesses marchés", group: "cardio", equip: ["aucun"], kind: "time", met: 4,
    cue: "En marchant sur place, ramène les talons vers les fesses en alternance." },
  { id: "talons_fesses", name: "Talons-fesses", group: "cardio", equip: ["aucun"], kind: "time", met: 7, impact: "fort", lowImpactAlt: "talons_marche",
    cue: "Course sur place en ramenant les talons aux fesses." },
  { id: "escaliers", name: "Montées d'escaliers", group: "cardio", equip: ["aucun"], kind: "time", met: 8,
    cue: "Monte les escaliers d'un pas soutenu, redescends tranquillement en te tenant à la rampe." },
  { id: "velo_appart", name: "Vélo d'appartement", group: "cardio", equip: ["velo"], kind: "time", met: 6.8,
    cue: "Selle à hauteur de hanche, résistance modérée : tu dois pouvoir parler en phrases courtes." },
  { id: "velo_sprint", name: "Vélo — sprints", group: "cardio", equip: ["velo"], kind: "time", met: 10,
    cue: "Résistance élevée, pédale à fond sur la durée, puis récupère tranquillement pendant le repos." },
  { id: "corde_douce", name: "Corde à sauter (pas alternés)", group: "cardio", equip: ["corde"], kind: "time", met: 8,
    cue: "Petits pas de course alternés sur l'avant des pieds, plus doux que les sauts pieds joints." },
  { id: "tapis_course", name: "Tapis — course", group: "cardio", equip: ["salle"], kind: "time", met: 8.3,
    cue: "Vitesse à laquelle tu peux encore parler par phrases courtes. Inclinaison 1 % pour simuler l'extérieur." },

  /* ---- Jambes / fessiers ---- */
  { id: "squat_sumo", name: "Squat sumo", group: "jambes", equip: ["aucun"], kind: "reps", met: 4,
    cue: "Pieds très écartés, pointes vers l'extérieur, descends en gardant le buste droit." },
  { id: "fente_lat", name: "Fentes latérales", group: "jambes", equip: ["aucun"], kind: "reps", met: 4.5, perSide: true,
    cue: "Grand pas sur le côté, fléchis la jambe qui avance, l'autre reste tendue. Fesses en arrière." },
  { id: "abduction", name: "Abductions allongé sur le côté", group: "fessiers", equip: ["aucun"], kind: "reps", met: 3, perSide: true,
    cue: "Allongé sur le côté, monte la jambe du dessus tendue sans basculer le bassin vers l'arrière." },
  { id: "donkey", name: "Donkey kicks", group: "fessiers", equip: ["aucun"], kind: "reps", met: 3, perSide: true,
    cue: "À quatre pattes, pousse un talon vers le plafond, genou plié à 90°, sans cambrer." },
  { id: "good_morning", name: "Good morning", group: "fessiers", equip: ["aucun"], kind: "reps", met: 3.5,
    cue: "Mains derrière la tête, genoux légèrement fléchis, penche le buste dos plat en poussant les hanches en arrière." },

  /* ---- Haut du corps ---- */
  { id: "pompes_larges", name: "Pompes larges", group: "pecs", equip: ["aucun"], kind: "reps", met: 4.5,
    cue: "Mains bien plus larges que les épaules. Sur les genoux si besoin." },
  { id: "pompes_diamant", name: "Pompes serrées (triceps)", group: "bras", equip: ["aucun"], kind: "reps", met: 5,
    cue: "Mains rapprochées sous la poitrine, coudes le long du corps. Sur les genoux ou mains surélevées pour faciliter." },
  { id: "y_raise", name: "Y-raise au sol", group: "dos", equip: ["aucun"], kind: "reps", met: 3,
    cue: "Allongé sur le ventre, bras en Y, pouces vers le haut, décolle les bras en serrant le bas des omoplates. Excellent pour la posture." },
  { id: "tirage_vert_elast", name: "Tirage vertical à l'élastique", group: "dos", equip: ["elastique"], kind: "reps", met: 3.5,
    cue: "Élastique accroché en hauteur, tire les mains vers les épaules, coudes vers les côtes." },
  { id: "dev_epaules_elast", name: "Développé épaules à l'élastique", group: "epaules", equip: ["elastique"], kind: "reps", met: 3.5,
    cue: "Pieds sur l'élastique, pousse les poignées au-dessus de la tête." },
  { id: "curl_marteau", name: "Curl marteau", group: "bras", equip: ["halteres"], kind: "reps", met: 3.5, weighted: true,
    cue: "Pouces vers le haut, monte les haltères sans balancer." },
  { id: "oiseau", name: "Oiseau (élévations arrière)", group: "epaules", equip: ["halteres"], kind: "reps", met: 3.5, weighted: true,
    cue: "Buste penché dos plat, écarte les bras sur les côtés, petits haltères." },
  { id: "pullover", name: "Pull-over haltère", group: "dos", equip: ["halteres"], kind: "reps", met: 3.5, weighted: true,
    cue: "Allongé, un haltère à deux mains au-dessus de la poitrine, descends-le derrière la tête bras légèrement fléchis." },
  { id: "dips_barres", name: "Dips aux barres parallèles", group: "bras", equip: ["salle"], kind: "reps", met: 6,
    cue: "Descends jusqu'à 90° de coude, buste légèrement penché. Version assistée à la machine si besoin." },
  { id: "rowing_haltere_2", name: "Rowing deux haltères buste penché", group: "dos", equip: ["halteres"], kind: "reps", met: 4.5, weighted: true,
    cue: "Buste à 45°, dos plat, tire les deux haltères vers les hanches." },

  /* ---- Mobilité / yoga / retour au calme ---- */
  { id: "salut_soleil", name: "Salutation au soleil", group: "mobilite", equip: ["aucun"], kind: "time", met: 3.3,
    cue: "Enchaîne lentement : bras en l'air, flexion avant, planche, chien tête en haut, chien tête en bas, retour debout. Une respiration par mouvement." },
  { id: "chien_bas", name: "Chien tête en bas", group: "mobilite", equip: ["aucun"], kind: "time", met: 2.5,
    cue: "En V inversé, pousse le sol avec les mains, talons vers le sol (genoux fléchis si besoin)." },
  { id: "pigeon", name: "Posture du pigeon (hanches)", group: "mobilite", equip: ["aucun"], kind: "time", met: 2.3, perSide: true,
    cue: "Une jambe pliée devant, l'autre tendue derrière, descends doucement le buste. Version assise sur chaise : cheville sur le genou opposé." },
  { id: "etir_ischios", name: "Étirement ischio-jambiers", group: "mobilite", equip: ["aucun"], kind: "time", met: 2.3, perSide: true,
    cue: "Talon sur une marche, jambe tendue, penche le buste dos plat jusqu'à sentir l'arrière de la cuisse." },
  { id: "etir_psoas", name: "Étirement fléchisseurs de hanche", group: "mobilite", equip: ["aucun"], kind: "time", met: 2.3, perSide: true,
    cue: "Genou au sol, l'autre pied devant, avance le bassin en serrant le fessier de la jambe arrière. Idéal si tu es souvent assis." },
  { id: "etir_pecs", name: "Étirement pectoraux au mur", group: "mobilite", equip: ["aucun"], kind: "time", met: 2.3, perSide: true,
    cue: "Avant-bras contre un encadrement de porte, tourne doucement le buste à l'opposé." },
  { id: "cercles_bras", name: "Cercles de bras et épaules", group: "mobilite", equip: ["aucun"], kind: "time", met: 2.8,
    cue: "Grands cercles de bras vers l'avant puis vers l'arrière, puis rotations d'épaules." },
  { id: "enfant", name: "Posture de l'enfant", group: "mobilite", equip: ["aucun"], kind: "time", met: 1.8,
    cue: "À genoux, fesses sur les talons, bras allongés devant, front au sol. Respire lentement dans le dos." },
  { id: "respiration", name: "Respiration lente", group: "mobilite", equip: ["aucun"], kind: "time", met: 1.3,
    cue: "Inspire 4 s par le nez, expire 6 s par la bouche. Fait redescendre le cœur et le stress." },
);

PROGRAMS.push(
  {
    id: "boxe_initiation", name: "Boxe — initiation (shadow)", type: "force", level: "debutant", equip: ["aucun"], perWeek: 3, minutes: 30, met: 6.5,
    desc: "Apprendre la garde et les coups de base sans matériel, en rounds chronométrés. Très bon cardio, sans impact.",
    sessions: [
      { name: "Bases", items: [
        { ex: "cercles_bras", sets: 1, sec: 60, rest: 10 },
        { ex: "box_garde", sets: 2, sec: 90, rest: 30 },
        { ex: "box_jab", sets: 3, sec: 60, rest: 30 },
        { ex: "box_12", sets: 3, sec: 60, rest: 30 },
        { ex: "box_esquives", sets: 2, sec: 45, rest: 30 },
        { ex: "gainage", sets: 2, sec: 30, rest: 30 },
        { ex: "etir_pecs", sets: 1, sec: 30, rest: 0 },
      ]},
      { name: "Crochets & uppercuts", items: [
        { ex: "marche_place", sets: 1, sec: 120, rest: 10 },
        { ex: "box_12", sets: 2, sec: 60, rest: 30 },
        { ex: "box_crochets", sets: 3, sec: 60, rest: 30 },
        { ex: "box_uppercuts", sets: 3, sec: 60, rest: 30 },
        { ex: "box_123", sets: 3, sec: 60, rest: 30 },
        { ex: "box_squat_punch", sets: 2, sec: 45, rest: 30 },
        { ex: "russian_twist", sets: 2, reps: 12, rest: 30 },
      ]},
    ],
  },
  {
    id: "boxe_cardio", name: "Cardio boxe 25 min", type: "force", level: "intermediaire", equip: ["aucun"], perWeek: 3, minutes: 25, met: 7.5,
    desc: "Rounds de 3 min façon cours de boxe fitness : combos, esquives, gainage. Ça transpire !",
    sessions: [
      { name: "Rounds", items: [
        { ex: "step_touch", sets: 1, sec: 120, rest: 15 },
        { ex: "box_123", sets: 1, sec: 180, rest: 45 },
        { ex: "box_speed", sets: 1, sec: 120, rest: 45 },
        { ex: "box_1234", sets: 1, sec: 180, rest: 45 },
        { ex: "sprawl", sets: 3, reps: 8, rest: 30 },
        { ex: "box_front_kick", sets: 1, sec: 120, rest: 45 },
        { ex: "box_speed", sets: 1, sec: 120, rest: 45 },
        { ex: "planche_updown", sets: 2, sec: 30, rest: 30 },
        { ex: "respiration", sets: 1, sec: 60, rest: 0 },
      ]},
    ],
  },
  {
    id: "boxe_sac", name: "Boxe au sac", type: "force", level: "intermediaire", equip: ["sac"], perWeek: 3, minutes: 40, met: 8,
    desc: "Rounds de 3 min au sac, 1 min de repos, avec travail physique de boxeur entre les rounds. Bandes ou gants obligatoires.",
    sessions: [
      { name: "Technique", items: [
        { ex: "corde", sets: 3, sec: 120, rest: 30 },
        { ex: "box_sac", sets: 5, sec: 180, rest: 60 },
        { ex: "pompes_genoux", sets: 3, reps: 10, rest: 45 },
        { ex: "gainage", sets: 3, sec: 40, rest: 30 },
      ]},
      { name: "Puissance & rafales", items: [
        { ex: "box_garde", sets: 1, sec: 180, rest: 30 },
        { ex: "box_sac_power", sets: 4, sec: 180, rest: 60 },
        { ex: "box_sac_rafale", sets: 2, sec: 120, rest: 60 },
        { ex: "sprawl", sets: 3, reps: 10, rest: 30 },
        { ex: "russian_twist", sets: 3, reps: 15, rest: 30 },
      ]},
    ],
  },
  {
    id: "boxe_rounds", name: "Minuteur de rounds de boxe", type: "intervalle", level: "debutant", equip: ["aucun"], perWeek: 3, minutes: 30,
    desc: "Un minuteur de rounds comme en club : bip de début, alerte 10 s avant la fin, repos. Fais ce que tu veux pendant le round (shadow, sac, corde…).",
    weeks: [
      { label: "4 rounds de 2 min", steps: boxRounds(4, 120, 60) },
      { label: "6 rounds de 3 min", steps: boxRounds(6, 180, 60) },
      { label: "8 rounds de 3 min", steps: boxRounds(8, 180, 60) },
      { label: "12 rounds de 3 min", steps: boxRounds(12, 180, 60) },
      { label: "Tabata boxe 20 s / 10 s × 16", steps: boxRounds(16, 20, 10, true) },
    ],
  },
  {
    id: "express_10", name: "Express 10 min", type: "force", level: "debutant", equip: ["aucun"], perWeek: 5, minutes: 10, met: 5.5,
    desc: "Quand tu n'as vraiment pas le temps : 10 minutes, tout le corps, sans matériel. Mieux que rien, et à faire tous les jours si tu veux.",
    sessions: [
      { name: "Express", items: [
        { ex: "marche_place", sets: 1, sec: 60, rest: 10 },
        { ex: "squat", sets: 2, sec: 40, rest: 15, timed: true },
        { ex: "pompes_genoux", sets: 2, sec: 30, rest: 15, timed: true },
        { ex: "box_squat_punch", sets: 2, sec: 40, rest: 15 },
        { ex: "gainage", sets: 2, sec: 30, rest: 15 },
        { ex: "step_touch", sets: 1, sec: 60, rest: 0 },
      ]},
    ],
  },
  {
    id: "abdos_15", name: "Abdos & gainage 15 min", type: "force", level: "debutant", equip: ["aucun"], perWeek: 3, minutes: 15, met: 4,
    desc: "Ceinture abdominale complète, sans douleur au dos. À ajouter après une autre séance ou seul.",
    sessions: [
      { name: "Sangle abdominale", items: [
        { ex: "dead_bug", sets: 3, reps: 8, rest: 30 },
        { ex: "gainage", sets: 3, sec: 30, rest: 30 },
        { ex: "crunch_velo", sets: 3, reps: 10, rest: 30 },
        { ex: "gainage_lat", sets: 2, sec: 25, rest: 20 },
        { ex: "hollow", sets: 3, sec: 20, rest: 30 },
        { ex: "bird_dog", sets: 2, reps: 8, rest: 20 },
      ]},
    ],
  },
  {
    id: "jambes_fessiers", name: "Jambes & fessiers maison", type: "force", level: "debutant", equip: ["aucun"], perWeek: 2, minutes: 30, met: 4.3,
    desc: "Bas du corps sans matériel ni sauts, en complément d'une séance haut du corps ou de boxe.",
    sessions: [
      { name: "Bas du corps", items: [
        { ex: "step_touch", sets: 1, sec: 120, rest: 15 },
        { ex: "squat", sets: 3, reps: 15, rest: 60 },
        { ex: "fente_arr", sets: 3, reps: 10, rest: 60 },
        { ex: "squat_sumo", sets: 3, reps: 12, rest: 45 },
        { ex: "pont", sets: 3, reps: 15, rest: 45 },
        { ex: "fente_lat", sets: 2, reps: 8, rest: 45 },
        { ex: "abduction", sets: 2, reps: 15, rest: 30 },
        { ex: "chaise", sets: 2, sec: 40, rest: 30 },
      ]},
    ],
  },
  {
    id: "dos_posture", name: "Dos & posture (anti-bureau)", type: "force", level: "debutant", equip: ["aucun"], perWeek: 3, minutes: 20, met: 3,
    desc: "Pour ceux qui passent la journée assis ou sur un écran : renforce le haut du dos, ouvre les hanches et les épaules.",
    sessions: [
      { name: "Posture", items: [
        { ex: "cercles_bras", sets: 1, sec: 60, rest: 10 },
        { ex: "chat_vache", sets: 2, reps: 10, rest: 15 },
        { ex: "y_raise", sets: 3, reps: 10, rest: 30 },
        { ex: "superman", sets: 3, reps: 10, rest: 30 },
        { ex: "bird_dog", sets: 2, reps: 8, rest: 20 },
        { ex: "rotation_thor", sets: 2, reps: 8, rest: 15 },
        { ex: "etir_psoas", sets: 1, sec: 40, rest: 10 },
        { ex: "etir_pecs", sets: 1, sec: 40, rest: 10 },
        { ex: "enfant", sets: 1, sec: 60, rest: 0 },
      ]},
    ],
  },
  {
    id: "mobilite_yoga", name: "Mobilité & yoga 20 min", type: "force", level: "debutant", equip: ["aucun"], perWeek: 2, minutes: 20, met: 2.6,
    desc: "Souplesse, récupération et détente. Idéal les jours de repos ou le soir.",
    sessions: [
      { name: "Flow", items: [
        { ex: "respiration", sets: 1, sec: 60, rest: 0 },
        { ex: "chat_vache", sets: 1, reps: 10, rest: 10 },
        { ex: "salut_soleil", sets: 3, sec: 60, rest: 10 },
        { ex: "chien_bas", sets: 2, sec: 40, rest: 10 },
        { ex: "pigeon", sets: 1, sec: 45, rest: 10 },
        { ex: "etir_ischios", sets: 1, sec: 40, rest: 10 },
        { ex: "etir_psoas", sets: 1, sec: 40, rest: 10 },
        { ex: "rotation_thor", sets: 1, reps: 8, rest: 10 },
        { ex: "enfant", sets: 1, sec: 90, rest: 0 },
      ]},
    ],
  },
  {
    id: "kettlebell_full", name: "Kettlebell full body", type: "force", level: "debutant", equip: ["kettlebell"], perWeek: 3, minutes: 35, met: 6,
    desc: "Une seule kettlebell (8-16 kg pour débuter). Le swing est l'un des meilleurs exercices pour brûler des calories.",
    sessions: [
      { name: "Séance A", items: [
        { ex: "kb_halo", sets: 1, reps: 10, rest: 20 },
        { ex: "kb_deadlift", sets: 3, reps: 10, rest: 60 },
        { ex: "kb_goblet", sets: 3, reps: 10, rest: 75 },
        { ex: "kb_row", sets: 3, reps: 10, rest: 60 },
        { ex: "kb_swing", sets: 4, reps: 15, rest: 60 },
        { ex: "gainage", sets: 2, sec: 30, rest: 30 },
      ]},
      { name: "Séance B", items: [
        { ex: "kb_halo", sets: 1, reps: 10, rest: 20 },
        { ex: "kb_clean", sets: 3, reps: 6, rest: 60 },
        { ex: "kb_press", sets: 3, reps: 8, rest: 60 },
        { ex: "fente_arr", sets: 3, reps: 10, rest: 60 },
        { ex: "kb_swing", sets: 5, reps: 12, rest: 45 },
        { ex: "kb_getup", sets: 2, reps: 2, rest: 60 },
      ]},
    ],
  },
  {
    id: "velo_intervalles", name: "Vélo d'appartement — fractionné", type: "intervalle", level: "debutant", equip: ["velo"], perWeek: 3, minutes: 30,
    desc: "Fractionné sur vélo : brûle beaucoup sans aucun impact sur les genoux.",
    weeks: [
      { label: "Niveau 1 — 6 × 1 min", steps: intervals([{ l: "Échauffement facile", s: 300, k: "walk" }], [{ l: "Rapide", s: 60, k: "bike" }, { l: "Facile", s: 120, k: "walk" }], 6, [{ l: "Retour au calme", s: 240, k: "walk" }]) },
      { label: "Niveau 2 — 8 × 1 min 30", steps: intervals([{ l: "Échauffement facile", s: 300, k: "walk" }], [{ l: "Rapide", s: 90, k: "bike" }, { l: "Facile", s: 90, k: "walk" }], 8, [{ l: "Retour au calme", s: 240, k: "walk" }]) },
      { label: "Niveau 3 — 10 × 30 s sprint", steps: intervals([{ l: "Échauffement facile", s: 360, k: "walk" }], [{ l: "Sprint", s: 30, k: "sprint" }, { l: "Facile", s: 90, k: "walk" }], 10, [{ l: "Retour au calme", s: 300, k: "walk" }]) },
    ],
  },
);

function boxRounds(n, work, rest, tabata) {
  const out = [{ l: "Prépare-toi", s: 10, k: "rest" }];
  for (let i = 1; i <= n; i++) {
    out.push({ l: tabata ? `Frappe ! (${i}/${n})` : `Round ${i}`, s: work, k: "box", warn10: !tabata });
    if (i < n) out.push({ l: "Repos", s: rest, k: "rest" });
  }
  return out;
}

Object.assign(STEP_MET, { box: 7.8, bike: 8.5, sprint: 11 });

ACTIVITIES.push(
  { id: "boxe_cours", name: "Boxe anglaise (cours)", met: 9 },
  { id: "boxe_sparring", name: "Boxe — sparring / combat", met: 10 },
  { id: "kickboxing", name: "Kickboxing / Muay thaï", met: 10 },
  { id: "arts_martiaux", name: "Arts martiaux (judo, karaté, JJB)", met: 10.3 },
  { id: "marche_nordique", name: "Marche nordique", met: 6.8, walk: true },
  { id: "trail", name: "Trail / course en montagne", met: 9.5 },
  { id: "spinning", name: "Spinning / RPM", met: 8.5 },
  { id: "zumba", name: "Zumba / danse fitness", met: 6.5 },
  { id: "body_pump", name: "Cours collectif renfo (body pump…)", met: 5.5 },
  { id: "crossfit", name: "CrossFit", met: 8 },
  { id: "muscu_intense", name: "Musculation intense", met: 6 },
  { id: "aquabike", name: "Aquabike", met: 6 },
  { id: "squash", name: "Squash", met: 7.3 },
  { id: "volley", name: "Volley-ball", met: 4 },
  { id: "handball", name: "Handball", met: 8 },
  { id: "rugby", name: "Rugby", met: 8.3 },
  { id: "golf", name: "Golf (en marchant)", met: 4.8 },
  { id: "roller", name: "Roller / skate", met: 7 },
  { id: "ski", name: "Ski alpin", met: 6 },
  { id: "ski_fond", name: "Ski de fond", met: 9 },
  { id: "paddle", name: "Stand-up paddle", met: 6 },
  { id: "kayak", name: "Kayak / canoë", met: 5 },
  { id: "equitation", name: "Équitation", met: 5.5 },
  { id: "peche", name: "Pêche (debout, active)", met: 3.5 },
  { id: "jeux_enfants", name: "Jouer activement avec les enfants", met: 4 },
);
