# Consignes pour travailler sur Harmonie

Voir `docs/README.md` pour la présentation de l'outil et `docs/SPECIFICATIONS.md` pour la spécification fonctionnelle détaillée. Ce fichier réunit les décisions prises avec l'utilisateur, à respecter dans toute modification. Toute la documentation vit dans `docs/` ; le `CLAUDE.md` de la racine ne fait que l'importer.

Quand un comportement change, mettre à jour `docs/SPECIFICATIONS.md` dans le même commit.

## Décisions de conception

- **Pas d'étape de compilation** : trois fichiers principaux, `index.html`, `engine.js`, `app.js`, en JavaScript simple et sans dépendance. Les traductions sont dans `i18n.js` + un fichier `i18n-<code>.js` par langue (10 langues), tous chargés par `index.html`.
- **Commentaires du code en français.** L'interface est multilingue (voir section 16 de `SPECIFICATIONS.md`) ; l'anglais est la langue par défaut, et tout texte visible passe par `window.i18n.t('clé')` (ou `data-i18n="clé"` pour les éléments statiques).
- **Moteur à base de règles de théorie musicale**, pas de statistiques sur un corpus.
- **Génération et retouche** : on génère une grille complète, puis on la retouche accord par accord grâce aux suggestions.
- **Organisation de l'interface** : une zone Général, puis un panneau par instrument (accords, basse, mélodie, batterie). Chaque panneau a les mêmes réglages : activation, mesures, couleur, jeu, variation, volume, dynamique, régénérer.
- **Catalogue de styles** : c'est la liste de référence de l'utilisateur (9 familles, 111 styles). Chaque style = un archétype harmonique (`ARCH`) + des retouches (`CATALOG`) dans `engine.js`, et il désigne un motif d'accompagnement (`PATTERNS`) et un kit de batterie (`DRUMS`) définis dans `app.js`.
- **Ambiances** : ce sont des préréglages. Choisir une ambiance pose des réglages visibles et modifiables (mode, tempo, brillance, réglages des instruments) et oriente l'harmonie. Aucun modificateur caché n'agit sur le jeu.
- **Basse** : « Jeu » (quelles notes) et « Rythme » (quand) restent deux réglages distincts.
- **Mesures** : 2/4 à 12/8.
  - Les motifs 4/4 sont redistribués sur la mesure (`toMeter`, `compPos`). Pour 3/4, 6/8, 7/8 et 12/8, des motifs propres optionnels existent (`METER_COMPS`, `METER_KITS`).
  - Un style peut déclarer sa mesure naturelle (`meter`) ; choisir un style la pose.
- **Habillage** : « Classique » par défaut (panneaux de fond, bordures arrondies, boutons à fond plein) ; « Studio » (minimal, filets très fins, une seule couleur d'accent) reste disponible derrière un sélecteur.
- **Doigtés** : les vues basse et guitare sont toutes deux horizontales, corde aiguë en haut et sillet à gauche, par souci de cohérence demandé par l'utilisateur.

## Règles techniques

- **Moteur testable seul** : `engine.js` ne touche pas au DOM et doit rester testable dans Node.
- **Accords relatifs** : ils sont stockés par rapport à la tonique (degré, demi-tons, lettre), donc changer de tonalité transpose sans rien régénérer. L'accord d'un pont porte `sec: 'B'`, et `up` / `km` pour sa tonalité locale ; il se lit avec `keyOf`.
- **Durées** : `beats` est en noires et peut être demi-entier (mesures en croches) ; la grille de jeu se compte en croches.
- **Lecture et export MIDI** passent tous deux par `stepEvents` dans `app.js`, pour que le fichier corresponde exactement à ce qu'on entend. Ne pas créer de second chemin.
- **Tirages reproductibles** : tout aléatoire musical passe par des graines (`rngFrom`, `rand`), pour que les boucles se répètent à l'identique et que l'export redonne la lecture.
- **Avant de modifier** : d'autres sessions travaillent aussi sur ce projet. Vérifier l'état des fichiers et `git log` d'abord.

## Vérifier une modification

- **Moteur** : générer en masse dans Node sur tous les styles, ambiances et mesures, puis vérifier :
  - longueurs des grilles et des ponts ;
  - notes d'accord comprises dans le mode ;
  - absence de chevauchement pour la basse et la mélodie ;
  - une note de basse à chaque changement d'accord.
- **Application** : servir le dossier (`python3 -m http.server`), puis contrôler dans le navigateur :
  - l'absence d'erreur dans la console ;
  - la lecture ;
  - l'export MIDI, analysé note par note (chaque note ouverte est fermée, rien ne dépasse la fin).
- **Cache** : `index.html` recharge ses scripts avec un horodatage, mais la page elle-même peut rester en cache dans un navigateur d'aperçu ; la recharger depuis le réseau.
