# Harmonie — spécification fonctionnelle

Version décrite : dépôt `/Users/mc/harmonie`, branche `main`. Ce document décrit le comportement de l'application. Les valeurs citées proviennent de `engine.js`, `app.js` et `index.html` ; les points non vérifiés sont signalés « à confirmer » et repris en section 15.

## 1. Objet et périmètre

Harmonie génère une suite d'accords et de modes, avec basse, mélodie et batterie, pour un morceau donné. On choisit une famille et un style, une tonalité, une mesure et une ambiance ; l'application produit une grille complète, que l'on retouche accord par accord, puis que l'on écoute et exporte.

- Application locale, sans compilation ni dépendance : `index.html` (page et styles), `engine.js` (moteur musical sans DOM, utilisable dans Node), `app.js` (interface, synthèse Web Audio, motifs, vues, export MIDI).
- Aucune requête réseau : les scripts et les styles sont locaux.
- Stockage dans le navigateur uniquement, sans partage entre appareils :
  - `localStorage`, clé `harmonie.v1` : l'état complet (réglages généraux, réglages des quatre instruments, grille, pont, vue affichée, vue des notes). Enregistré à chaque modification. Les anciennes sauvegardes à un seul panneau sont converties à la lecture, et les anciens noms de style sont remappés.
  - `localStorage`, clé `harmonie.look` : l'habillage (`studio` par défaut).
- Valeurs au premier lancement : style Jazz (132 bpm), tonalité Do majeur, ambiance Neutre, mesure 4/4, brillance 50, pont « Aucun », motifs propres activés, vue des notes « Piano ».

## 2. Réglages généraux

Le panneau **Général** regroupe les réglages qui concernent le morceau entier.

| Réglage | Libellé | Comportement |
|---|---|---|
| Famille | boutons (9) | Choisir une famille passe à son premier style et génère une nouvelle grille. |
| Style | boutons (dans la famille) | Génère une nouvelle grille. Pose la mesure naturelle du style (4/4 si le style n'en déclare pas), pose le tempo (tempo du style × facteur de l'ambiance courante). Pour les styles à grille de blues, fixe les accords à 12 mesures. |
| Tonalité | liste (12 valeurs) | Ne régénère pas : les accords sont relatifs à la tonique, la grille est transposée. |
| Mode | « Majeur » / « Mineur » | Génère une nouvelle grille. La tonique garde sa hauteur (Do majeur devient Do mineur). |
| Mesure | liste (8 signatures) | Génère une nouvelle grille. Voir section 8. |
| motifs propres | case à cocher | Active par défaut. Disponible seulement pour 3/4, 6/8, 7/8 et 12/8. Voir section 8. |
| Tempo | nombre, 50 à 220 | Valeur hors plage ramenée à la limite ; vide ou non numérique : 120. |
| Ambiance | liste groupée | Pose les réglages de l'ambiance (section 6) et génère une nouvelle grille. |
| Brillance | curseur 0 à 100 (défaut 50) | Ne régénère pas. Filtre passe-bas de tous les timbres sauf la basse : fréquence de coupure = coupure du timbre × (0,5 + brillance). |
| Pont | liste (Aucun et 7 types) | Refait le pont sans toucher à la grille. Voir ci-dessous. |
| Longueur du pont | 4 ou 8 mesures | Refait le pont. Désactivé sans pont. |
| Forme | « Forme A B » / « Forme A A B A » | Ne régénère pas : change l'ordre de lecture. |
| ↻ (pont) | bouton | Tire un autre pont, sans toucher à la grille. |

**Ordre de lecture.** Forme A B : grille, puis pont. Forme A A B A : grille, grille, pont, grille. Sans pont : grille seule.

**Pont.** Section contrastante dans une tonalité voisine, marquée `sec: 'B'`, générée avec le même style, la même ambiance, la même mesure et la même couleur que la grille.

| Type (libellé) | Tonalité du pont |
|---|---|
| Demi-ton au-dessus | tonique + 1 demi-ton, même mode |
| Un ton au-dessus | tonique + 2 demi-tons, même mode |
| Tierce mineure au-dessus | tonique + 3 demi-tons, même mode |
| Relatif majeur / Relatif mineur | majeur → mineur relatif (+9) ; mineur → majeur relatif (+3). Libellé selon le mode courant. |
| Homonyme majeur / Homonyme mineur | même tonique, mode inversé |
| Ton de la sous-dominante | tonique + 5 demi-tons, même mode |
| Ton de la dominante | tonique + 7 demi-tons, même mode |

Le pont a 4 ou 8 mesures. Ses derniers accords, pour au moins une mesure, sont remplacés par la dominante (V) du ton principal, qui ramène à la grille. Cet accord porte la durée retirée. Un pont d'une seule mesure n'a pas ce retour.

## 3. Génération de la grille

### Principe

La grille est une marche pondérée sur les degrés (I, ii, IV, V, vi, emprunts…), dans le mode de la tonalité. Le moteur génère ensuite des enrichissements (section ci-dessous), puis choisit une qualité (accord parfait, septième, neuvième…) pour chaque degré.

1. **Marche.** Le premier degré est tiré dans la table de départ du style (par mode). Chaque pas tire le degré suivant avec un poids = poids de base × biais du style × biais de l'ambiance × facteur des emprunts. Un degré rare (bV en mineur) n'apparaît que si le style ou l'ambiance le demande.
2. **Choix de la meilleure marche.** Sur 60 marches tirées, on garde celle qui obtient le meilleur score : la boucle se referme (dernier accord vers le premier), peu de degrés différents (cible = min(longueur, arrondi de 3 + 3 × couleur)), pas de retour à l'accord de deux rangs plus tôt (pénalité), pour les styles en accords de puissance pas de deux accords de même fondamentale qui se suivent (pénalité), tonique au milieu (bonus à partir de 8 mesures), cadence vers la dominante en fin de phrase (bonus proportionnel au goût de cadence du style). Un bruit aléatoire départage.
3. **Enrichissements** (fonction `decorate`), pour chaque paire accord courant / accord suivant :
   - **Diminué de passage** : si le suivant est un ton au-dessus, avec la probabilité `pDim`. Il est inséré entre les deux.
   - **Dominante secondaire** (V/x) : si le suivant est un degré cible (ii, iii, IV, V, vi en majeur ; iv, V, bVI, bVII, bIII, v en mineur), avec la probabilité `pSec`, et si l'accord courant n'est pas déjà une dominante qui résout sur lui. Elle peut être remplacée par une **substitution tritonique** (♭II/x) avec la probabilité `pTri`. Les probabilités `pSec`, `pTri`, `pRel` et `pDim` dépendent de la couleur (section suivante).
   - **ii relatif** : placé devant la dominante secondaire, avec la probabilité `pRel` (seulement si la couleur est supérieure à 0,35), et seulement si l'enrichissement précédent ne l'a pas déjà utilisé.
   - **Substitution tritonique de V vers I** : avec la probabilité `pTri`.
   - Les accords insérés coupent la mesure en deux demi-mesures (la première demi-mesure va jusqu'au temps le plus proche du milieu).
4. **Qualités.** Pour chaque degré, on tire une qualité dans le répertoire du style (poids gaussien centré sur le niveau de couleur, écart 0,28). Une qualité n'est retenue que si toutes ses notes sont dans le mode qu'elle implique. Un même degré garde la même qualité partout dans la grille.

### Curseur de couleur

Le curseur **Couleur** du panneau Accords (0 à 100, défaut 50) s'applique à la **prochaine grille** (sa bulle le précise). La couleur effective est la couleur du curseur plus le décalage propre au style (`cshift`), bornée entre 0 et 1.

| Effet | Formule ou règle |
|---|---|
| Poids des emprunts | `max(0,15 + 1,7 × couleur ; plancher du style) × facteur de l'ambiance` |
| Dominantes secondaires | `(base + pente × couleur) × facteur de l'ambiance` |
| Substitution tritonique | `probabilité du style × couleur` |
| Diminué de passage | `probabilité du style × couleur` |
| ii relatif | `probabilité du style`, si couleur > 0,35 |
| Qualités | niveau de couleur de chaque qualité, plus le décalage de l'ambiance par famille (M, m, D) |
| Nombre de degrés distincts | arrondi de 3 + 3 × couleur |

### Longueurs et boucles

- Longueurs proposées : 4, 8, 12, 16 mesures. Le moteur accepte d'autres valeurs.
- **Styles en boucle** (81 styles sur 111, `loop` vrai dans l'archétype ou la retouche) : pour 8 mesures ou plus, une phrase de 4 mesures est tirée, puis reprise. La reprise suit la séquence : phrase, variante d'une mesure, phrase, variante de deux mesures, etc. Les reprises ont les mêmes enrichissements (même graine).
- **Styles sans boucle, 16 mesures** : une phrase de 8 mesures, puis une variante de ses 2 dernières mesures.
- **Grille de blues, 12 mesures** (styles à `form: 'blues'` : Blues, Rockabilly, Boogie-woogie) : gabarit fixe.
  - Majeur : I, I (IV si couleur > 0,45), I, I, IV, IV, I, I, V (ii si couleur > 0,7), IV (V si couleur > 0,7), I, V.
  - Mineur : i, i, i, i, iv, iv, i, i, bVI, V, i, V.
  - Les enrichissements s'y appliquent aussi.
- Les accords sont stockés **relativement à la tonique** : degré, demi-tons, lettre, qualité, mode, durée (en noires, `beats`), fonction (T, SD, D), libellé romain et raison. Un pont porte en plus `sec: 'B'`, `up` (demi-tons au-dessus de la tonique) et `km` (mode mineur du pont). Changer de tonalité transpose donc sans régénérer.
- La durée d'un accord est un nombre de noires, éventuellement demi-entier (mesures en croches).

## 4. Retouche d'un accord

Un clic sur une carte de la grille sélectionne l'accord, le joue, et affiche le panneau de détail. Les flèches ← et → passent à l'accord précédent ou suivant (voir section 13).

- **Durée** : trois valeurs proposées, toutes en noires : « Demi-mesure » (ou « Début de mesure » quand la mesure ne se coupe pas en deux moitiés égales), « 1 mesure », « 2 mesures ». Aucune régénération.
- **Écouter** : joue l'accord (basse et accord, ou arpège, selon les réglages).
- **Supprimer** : retire l'accord. Désactivé quand la grille ne compte qu'un accord (un accord de pont peut toujours être retiré).

### Remplacer par

Alternatives de même durée que l'accord courant, regroupées :

| Groupe | Contenu |
|---|---|
| Autre couleur | même degré, autres qualités qui tiennent dans le mode |
| Même fonction | autres degrés de même fonction (T, SD ou D) ; pour un enrichissement, sa cible : dominante secondaire, substitution tritonique, diminué de passage |
| Vers l’accord suivant | dominante secondaire, et, pour les styles jazzy, substitution tritonique, diminué de passage et ii relatif, de l'accord suivant de la même section |

Sans alternative : « Pas d’alternative évidente à cet endroit. »

### Continuer avec

Accords qui peuvent suivre l'accord courant, insérés après lui. Liste de 12 au plus, classée par poids et répartie en trois paliers selon la probabilité (somme des poids normalisée) :

| Palier | Probabilité |
|---|---|
| attendu | 16 % et plus |
| coloré | de 6 % à 16 % |
| surprenant | moins de 6 % |

- Après un degré : les degrés accessibles selon le style, l'ambiance et la couleur ; les dominantes secondaires vers les cibles ; pour les styles jazzy, les substitutions tritoniques, les diminués de passage (un ton au-dessus).
- Après un enrichissement : sa résolution (poids fort), ou son évitement (poids très faible).
- Les accords insérés durent une mesure. Ils héritent de la tonalité et de la section de l'accord courant.

### Annulation

Une pile de 60 états au plus. Enregistrent un état : générer une grille, changer de style, de famille, de mode, d'ambiance, de mesure (par le sélecteur de mesure), de tonalité ; régénérer le pont, un instrument ou tout ; changer la forme du pont ; changer la durée, remplacer, insérer ou supprimer un accord ; insérer ou remplacer depuis la carte. **Annuler** (bouton ou ⌘Z / Ctrl+Z) restaure le dernier état. Le bouton est désactivé quand la pile est vide. Les réglages de tempo, de couleur, de volume et l'activation d'un instrument n'enregistrent pas d'état.

## 5. Styles

### Familles

| Famille (libellé) | Nombre de styles |
|---|---|
| Rock | 15 |
| Metal | 15 |
| Pop | 10 |
| Électronique | 20 |
| Hip-hop / R&B | 10 |
| Jazz / Blues | 11 |
| Musiques du monde | 16 |
| Folk / Country | 7 |
| Classique / Orchestral | 7 |
| **Total** | **111** |

Le libellé « Prog » désigne deux styles différents : le rock progressif (famille Rock) et le metal progressif (famille Metal).

### Principe

Un style est la combinaison de :

- un **archétype** (`ARCH`, 22 au total : jazz, bossa, rock, pop, chanson, classical, folk, blues, latin, reggae, funk, soul, hiphop, trap, electro, house, downtempo, ambient, metal, punk, sludge, stoner). L'archétype fixe :
  - les **biais** par degré, en majeur et en mineur ;
  - la **table de départ** ;
  - les **enrichissements** (probabilités des dominantes secondaires, du ii relatif, des substitutions tritoniques et des diminués) ;
  - les **répertoires de qualités** par type d'accord (majeur, mineur, dominante, etc.) ;
  - des indicateurs : style jazzy (♭VII et IV mineur traités comme dominantes), boucle, goût de cadence, plancher des emprunts, grille de blues ;
- des **retouches** (`CATALOG`), qui remplacent ou complètent les champs de l'archétype : biais, probabilités, répertoires, décalage de couleur, plancher des emprunts, boucle, timbre des accords, mesure naturelle, tempo ;
- un **motif d'accompagnement** (`PATTERNS`, 28 motifs) ;
- un **kit de batterie** (`DRUMS`, 29 kits, plus 4 kits propres aux mesures 3/4, 6/8, 7/8 et 12/8).

### Ce qu'un style détermine

Vocabulaire harmonique (biais, départ, enrichissements, qualités), boucle ou non, timbre des accords, mesure naturelle (8 styles : Prog, Prog et Musique balkanique en 7/8 ; Blues et Gospel en 12/8 ; Musique celtique et Gnawa en 6/8 ; Musette en 3/4), tempo par défaut (de 60 à 200 bpm), motif d'accompagnement, kit de batterie, forme en blues.

Un style ne pose ni le mode ni l'ambiance ; ceux-ci restent en place.

## 6. Ambiances

Une ambiance pose des **réglages visibles** (mode, tempo, brillance, réglages des instruments) et **oriente l'harmonie** (emprunts, dominantes secondaires, décalage de couleur par famille, biais par degré). Aucun modificateur caché n'agit sur le jeu. Choisir une ambiance génère une nouvelle grille.

**Ce qu'une ambiance pose.** Pour chaque instrument, les valeurs qu'elle précise ; les autres prennent les valeurs neutres : accords (couleur 0,5, densité 0,5, dynamique 0,5, volume 0,8, registre médium, variation 0,15), basse (couleur 0,5, dynamique 0,5, volume 0,8), mélodie (jeu « Durées mêlées », respiration 0,25, octave 0, contour libre, couleur 0,5, dynamique 0,5, variation 0,3), batterie (jeu « Posée », couleur 0,5, variation 0,15, dynamique 0,5, volume 0,8). Une ambiance ne modifie ni les mesures (longueur des motifs, fills), ni le jeu des accords ou de la basse, ni les instruments activés.

**Ce qu'une ambiance oriente.** Les colonnes « Harmonie » du tableau ci-dessous : facteur sur les emprunts, facteur sur les dominantes secondaires, décalage de couleur (M = accords majeurs, m = mineurs, D = dominantes), et facteurs par degré (biais), en majeur et en mineur. Les tempos sont des facteurs sur le tempo du style. « inchangé » : l'ambiance ne touche pas au mode, ni à la brillance.

| Groupe | Ambiance | Mode | Tempo (× style) | Brillance | Réglages d'instruments posés | Harmonie orientée |
|---|---|---|---|---|---|---|
| — | Neutre | inchangé | 1 | inchangé | aucun (valeurs neutres) | aucune |
| Lumineuses | Joyeuse | majeur | 1,08 | 0,7 | Accords : couleur 0,4, densité 0,6, dynamique 0,6 ; Mélodie : respiration 0,2, contour montant ; Batterie : couleur 0,55, dynamique 0,6 | emprunts ×0,4 ; majeur : IV ×1,4, V ×1,4, ii ×1,1, vi ×0,8 |
| Lumineuses | Espiègle | majeur | 1,12 | 0,75 | Accords : couleur 0,55, densité 0,7, dynamique 0,75, variation 0,5 ; Mélodie : vive, respiration 0,45, octave +1, variation 0,6 ; Batterie : couleur 0,7, variation 0,5, dynamique 0,6 | dominantes secondaires ×1,4 ; majeur : ii ×1,3, bVII ×1,2, #ivø ×1,5 |
| Lumineuses | Triomphante | majeur | 1 | 0,85 | Accords : couleur 0,3, densité 0,6, dynamique 0,8, volume 0,9 ; Mélodie : lente, respiration 0,2, octave +1, contour montant, dynamique 0,8 ; Batterie : énergique, dynamique 0,85, volume 0,9 | majeur : IV ×1,6, V ×1,6, bVII ×1,4, bVI ×1,3 |
| Lumineuses | Festive | majeur | 1,15 | 0,8 | Accords : couleur 0,45, densité 0,85, dynamique 0,7 ; Mélodie : vive ; Batterie : énergique, couleur 0,8, variation 0,4, dynamique 0,7 | emprunts ×0,6 ; majeur : IV ×1,4, V ×1,4 |
| Paisibles | Calme | inchangé | 0,86 | 0,4 | Accords : couleur 0,4, densité 0,15, dynamique 0,3 ; Mélodie : lente, respiration 0,4, dynamique 0,3 ; Batterie : feutrée, couleur 0,35, dynamique 0,35, volume 0,65 | emprunts ×0,5 ; dominantes secondaires ×0,5 ; couleur D −0,1 ; majeur : IV ×1,3, vi ×1,2, V ×0,8 ; mineur : bIII ×1,3, bVII ×1,2, V ×0,7 |
| Paisibles | Sereine | majeur | 0,82 | inchangé | Accords : densité 0,1, dynamique 0,25 ; Mélodie : lente, respiration 0,5, dynamique 0,3 ; Batterie : feutrée, couleur 0,2, dynamique 0,3, volume 0,55 | emprunts ×0,3 ; dominantes secondaires ×0,3 ; couleur M +0,1 ; majeur : IV ×1,8, iii ×1,2, V ×0,6 |
| Paisibles | Rêveuse | inchangé | 0,8 | 0,45 | Accords : couleur 0,7, densité 0,1, dynamique 0,3, registre aigu ; Mélodie : lente, respiration 0,55, octave +1, dynamique 0,3 ; Batterie : feutrée, couleur 0,3, volume 0,5 | emprunts ×1,3 ; dominantes secondaires ×0,4 ; couleur M +0,25, m +0,15 ; majeur : IV ×1,6, bVII ×1,4, iii ×1,4, V ×0,4, bVI ×1,3 ; mineur : bVI ×1,6, bIII ×1,4, V ×0,3 |
| Paisibles | Contemplative | inchangé | 0,72 | 0,4 | Accords : couleur 0,6, densité 0, dynamique 0,2 ; Mélodie : lente, respiration 0,7, dynamique 0,25 ; Batterie : feutrée, couleur 0,1, dynamique 0,3, volume 0,4 | dominantes secondaires ×0,2 ; majeur : IV ×1,6, vi ×1,4, V ×0,4 ; mineur : bVI ×1,5, iv ×1,3, V ×0,3 |
| Tendres | Romantique | inchangé | 0,84 | 0,45 | Accords : couleur 0,6, densité 0,35, dynamique 0,45 ; Mélodie : respiration 0,3, dynamique 0,55 ; Batterie : feutrée, couleur 0,4, volume 0,65 | couleur D +0,1, M +0,05 ; majeur : iv ×2, vi ×1,3, iii ×1,3, bVI ×1,3, ii ×1,2 ; mineur : iv ×1,3, bVI ×1,4, V ×1,2, bIII ×1,2 |
| Tendres | Poétique | inchangé | 0,8 | inchangé | Accords : couleur 0,65, densité 0,1, dynamique 0,35 ; Mélodie : lente, respiration 0,5, octave +1 ; Batterie : feutrée, couleur 0,15, volume 0,5 | emprunts ×1,2 ; dominantes secondaires ×0,6 ; couleur M +0,2, m +0,1 ; majeur : IV ×1,4, iii ×1,5, bVII ×1,3, bIII ×1,3, bVI ×1,4, V ×0,6 ; mineur : bVI ×1,4, bIII ×1,3, IV ×1,6, v ×1,3, V ×0,6 |
| Tendres | Tendre | majeur | 0,8 | 0,4 | Accords : densité 0,2, dynamique 0,3 ; Mélodie : lente, respiration 0,4, dynamique 0,35 ; Batterie : feutrée, couleur 0,2, volume 0,5 | emprunts ×0,6 ; couleur M +0,1 ; majeur : IV ×1,5, vi ×1,3, iii ×1,3, ii ×1,2, V ×0,8 |
| Tendres | Sensuelle | inchangé | 0,78 | 0,35 | Accords : couleur 0,75, densité 0,4, registre grave ; Mélodie : respiration 0,45 ; Batterie : feutrée, couleur 0,7, variation 0,3, volume 0,7 | dominantes secondaires ×1,2 ; couleur D +0,2, m +0,15 ; majeur : ii ×1,4, iv ×1,5, bVII ×1,2 ; mineur : iv ×1,5, IV ×1,5, bVI ×1,3 |
| Tristes | Mélancolique | mineur | 0,78 | 0,3 | Accords : couleur 0,55, densité 0,1, dynamique 0,3 ; Mélodie : lente, respiration 0,45, contour descendant, dynamique 0,35 ; Batterie : feutrée, couleur 0,15, volume 0,6 | dominantes secondaires ×0,8 ; couleur m +0,15 ; majeur : vi ×1,8, iv ×2, iii ×1,4, bVI ×1,5, V ×0,8 ; mineur : iv ×1,5, bVI ×1,4, v ×1,3 |
| Tristes | Nostalgique | inchangé | 0,82 | 0,4 | Accords : couleur 0,6, densité 0,3, dynamique 0,4 ; Mélodie : respiration 0,4, contour descendant ; Batterie : feutrée, couleur 0,35, volume 0,6 | emprunts ×1,1 ; couleur M +0,15 ; majeur : iv ×2,2, vi ×1,4, iii ×1,3, IV ×1,3 ; mineur : bIII ×1,5, bVI ×1,4, iv ×1,3, IV ×1,2 |
| Tristes | Triste | mineur | 0,72 | 0,25 | Accords : couleur 0,3, densité 0,05, dynamique 0,25 ; Mélodie : lente, respiration 0,5, contour descendant, dynamique 0,3 ; Batterie : feutrée, couleur 0,1, volume 0,5 | emprunts ×0,5 ; dominantes secondaires ×0,4 ; mineur : iv ×1,6, bVI ×1,5, v ×1,4, V ×0,6, bVII ×0,8 ; majeur : vi ×2, iv ×1,8, iii ×1,4 |
| Tristes | Désolée | mineur | 0,62 | 0,2 | Accords : couleur 0,35, densité 0, dynamique 0,15, registre grave ; Mélodie : lente, respiration 0,75, octave −1, contour descendant, dynamique 0,2 ; Batterie : feutrée, couleur 0, dynamique 0,2, volume 0,3 | dominantes secondaires ×0,2 ; mineur : iv ×1,6, bVI ×1,6, bII ×1,5, v ×1,3, V ×0,3 ; majeur : vi ×2, iv ×2, bVI ×1,6 |
| Tristes | Funèbre | mineur | 0,58 | 0,2 | Accords : couleur 0,1, densité 0,1, dynamique 0,4, registre grave ; Mélodie : lente, respiration 0,6, octave −1, contour descendant ; Batterie : feutrée, couleur 0, volume 0,6 | emprunts ×0,7 ; couleur m −0,2, M −0,2 ; mineur : iv ×1,8, V ×1,4, bVI ×1,2, bII ×1,3 ; majeur : vi ×1,8, iv ×2 |
| Sombres | Sombre | mineur | 0,9 | 0,2 | Accords : couleur 0,45, densité 0,4, registre grave ; Mélodie : respiration 0,4, octave −1, contour descendant ; Batterie : couleur 0,3, volume 0,75 | emprunts ×1,6 ; dominantes secondaires ×0,7 ; mineur : bII ×6, bVI ×1,8, v ×1,4, iv ×1,3, V ×0,7 ; majeur : bVI ×2,5, bII ×5, bIII ×1,8, iv ×2 |
| Sombres | Mystérieuse | inchangé | 0,85 | 0,35 | Accords : couleur 0,8, densité 0,15, dynamique 0,3 ; Mélodie : lente, respiration 0,6 ; Batterie : feutrée, variation 0,5, volume 0,5 | emprunts ×1,8 ; dominantes secondaires ×0,5 ; couleur M +0,35, D +0,2 ; majeur : bVI ×1,8, bII ×1,6, #ivø ×2, IV ×1,4, V ×0,3, bIII ×1,4 ; mineur : bII ×1,8, bVI ×1,5, IV ×1,6, V ×0,3 |
| Sombres | Inquiète | mineur | 1,05 | inchangé | Accords : couleur 0,75, densité 0,6, dynamique 0,6, variation 0,6 ; Mélodie : vive, respiration 0,5, variation 0,7 ; Batterie : couleur 0,6, variation 0,7 | emprunts ×1,4 ; dominantes secondaires ×1,6 ; couleur D +0,4 ; mineur : iiø ×1,8, V ×1,6, bII ×1,6, bVI ×1,2 ; majeur : bII ×1,6, iv ×1,6, #ivø ×2 |
| Sombres | Menaçante | mineur | 0,88 | 0,3 | Accords : couleur 0,4, densité 0,7, dynamique 0,75, volume 0,9, registre grave ; Mélodie : lente, respiration 0,5, octave −1, contour descendant ; Batterie : énergique, couleur 0,3, dynamique 0,8, volume 0,9 | emprunts ×2 ; couleur D +0,35 ; mineur : bII ×8, bV ×8, bVI ×1,5, v ×1,3 ; majeur : bII ×8, bVI ×2, bIII ×1,8 |
| Intenses | Animée | inchangé | 1,08 | 0,6 | Accords : couleur 0,6, densité 0,8, dynamique 0,55, variation 0,4 ; Mélodie : vive, respiration 0,2 ; Batterie : énergique, couleur 0,75, variation 0,4 | dominantes secondaires ×1,5 ; majeur : ii ×1,2, V ×1,2 ; mineur : iiø ×1,2, V ×1,2 |
| Intenses | Énergique | inchangé | 1,12 | 0,75 | Accords : couleur 0,45, densité 0,7, dynamique 0,7, volume 0,85 ; Mélodie : respiration 0,2, dynamique 0,7 ; Batterie : énergique, dynamique 0,7, volume 0,9 | majeur : V ×1,2, IV ×1,2, bVII ×1,3 ; mineur : bVII ×1,3, V ×1,2 |
| Intenses | En colère | mineur | 1,2 | 1 | Accords : couleur 0,4, densité 0,9, dynamique 0,9, volume 0,95 ; Mélodie : vive, respiration 0,3, dynamique 0,85 ; Batterie : énergique, couleur 0,4, dynamique 0,95, volume 1 | emprunts ×1,6 ; dominantes secondaires ×0,8 ; couleur D +0,35 ; majeur : bII ×3, bVI ×1,8, bIII ×1,8, bVII ×1,5, v ×1,5 ; mineur : bII ×3, v ×1,3, bVI ×1,3, V ×1,2 |
| Intenses | Épique | mineur | 1 | 0,7 | Accords : couleur 0,4, densité 0,65, dynamique 0,8, volume 0,9 ; Mélodie : lente, octave +1, contour montant, dynamique 0,8 ; Batterie : énergique, dynamique 0,85, volume 0,9 | emprunts ×1,4 ; mineur : bVI ×2, bVII ×1,8, bIII ×1,6, iv ×1,2 ; majeur : bVI ×1,8, bVII ×1,8, IV ×1,4 |
| Intenses | Euphorique | majeur | 1,2 | 0,9 | Accords : densité 0,9, dynamique 0,75 ; Mélodie : vive, respiration 0,15, octave +1, contour montant, dynamique 0,75 ; Batterie : énergique, couleur 0,8, dynamique 0,8, volume 0,95 | emprunts ×0,6 ; majeur : IV ×1,6, V ×1,3, vi ×1,4 |

Dans ce tableau, « inchangé » signifie que l'ambiance ne pose pas la valeur : le mode garde sa valeur courante, la brillance aussi. Un réglage d'instrument non listé prend la valeur neutre indiquée plus haut.

## 7. Instruments

Quatre panneaux : **Accords**, **Basse**, **Mélodie**, **Batterie**. Chacun a l'interrupteur d'activation (l'instrument coupé n'est ni joué ni exporté), le bouton **↻ Régénérer**, puis les réglages du tableau ci-dessous.

### Valeurs par défaut

| Partie | Activée | Mesures (ou fills) | Jeu | Autres réglages par défaut |
|---|---|---|---|---|
| Accords | oui | 8 | Motif du style | Couleur 0,50 ; densité 0,50 ; registre médium ; variation 0,15 ; volume 0,80 ; dynamique 0,50 |
| Basse | oui | Toute la grille | Motif du style | Rythme « Selon le jeu » ; couleur 0,50 ; variation 0,15 ; volume 0,80 ; dynamique 0,50 |
| Mélodie | non | Toute la grille | Durées mêlées | Respiration 0,25 ; octave 0 ; contour libre ; couleur 0,50 ; variation 0,30 ; volume 0,80 ; dynamique 0,50 |
| Batterie | oui | 4 (fill toutes les 4 mesures) | Posée | Couleur 0,50 ; variation 0,15 ; volume 0,80 ; dynamique 0,50 |

### Réglages communs

| Réglage | Libellé | Valeurs | Effet |
|---|---|---|---|
| Activation | interrupteur | activée / coupée | Coupe la partie à la lecture et à l'export. Raccourcis M (mélodie) et B (batterie). |
| Jeu | liste | selon l'instrument | Façon de jouer (voir ci-dessous). |
| Débit | liste | Croches, Triolets, Doubles croches | Notes par temps, pour les arpèges des accords seulement. |
| Mesures | liste | Accords : 4, 8, 12, 16 ; basse et mélodie : Toute la grille, 1, 2, 4, 8 ; batterie : Fills (1, 2, 4, 8, 16) | Longueur de la grille (accords), du motif (basse, mélodie), ou période des fills (batterie). Accords : une nouvelle grille. |
| Registre | liste | Grave (−1), Médium (0), Aigu (+1) | Décale les accords de 7 demi-tons par cran. |
| Densité | curseur 0 à 100 | voir ci-dessous | Densité de l'accompagnement du motif du style. |
| Rythme | liste | voir ci-dessous | Basse seulement. Désactivé quand le jeu est « Motif du style ». |
| Octave | liste | Très grave (−2) à Très aigu (+2) | Mélodie : décale la tessiture de 12 demi-tons par cran. |
| Contour | liste | Libre, Montant, Descendant | Mélodie : pente générale des phrases. |
| Respiration | curseur | 0 à 100 | Mélodie : silences et souffle en fin de phrase. |
| Couleur | curseur | 0 à 100 | Richesse des notes (détail par instrument). |
| Variation | curseur | 0 à 100 | Coups ajoutés ou retirés, reprises renouvelées. |
| Volume | curseur | 0 à 100 | Gain de la partie : (volume / 0,8)², 80 étant le niveau nominal. Mis à jour en direct. |
| Dynamique | curseur | 0 à 100 | Contraste des accents, par la place dans la mesure. |
| ↻ Régénérer | bouton | | Accords : nouvelle grille (et nouveau pont). Autres : nouvelle graine, sans toucher à la grille. Active la partie. |

Certaines valeurs (couleur des accords, accords de la grille) ne prennent effet qu'à la prochaine génération de grille. Les autres sont appliquées à la lecture.

### Accords

- **Jeu** : Motif du style, Plaqués (accord complet à chaque changement, égrené de 8 ms par note à l'écoute), Arpège montant, Arpège descendant, Arpège aller-retour, Arpège aléatoire.
- **Motif du style** :
  - densité sous 0,33 : un accord tenu par changement d'accord ou par mesure ; la basse joue au changement d'accord et à la mi-mesure ;
  - densité entre 0,33 et 0,66 : le motif du style ;
  - densité au-dessus de 0,66 : toutes les croches.
  - La variation supprime des coups du motif ou en ajoute.
- **Arpèges** : notes de l'accord, prolongées d'une octave, parcourues dans le sens choisi. Les notes sont réparties par mesure, avec une inversion ou un décalage de départ tirés selon la variation.
  - Croches : une note par croche ; doubles croches : deux. Triolets : trois notes sur chaque paire de croches de l'accord ; une croche restée seule en fin d'accord (accord d'un nombre impair de croches, en 6/8, 7/8, 9/8…) reçoit une seule note.
  - Chaque note dure 1,7 fois l'écart entre deux notes, mais s'arrête avant le changement d'accord (swing compris) : aucune note d'arpège ne déborde sur l'accord suivant.
- **Timbre des accords plaqués et arpégés** : un style au timbre pad est joué au piano électrique (keys) dès que le jeu n'est plus « Motif du style ». L'export MIDI écrit le programme du timbre réellement joué.
- **Basse avec un accord joué en arpège ou en plaqué** (basse en « Motif du style ») : la fondamentale tient au début de chaque accord, jusqu'à quatre temps.
- Registre : le centre de l'accord est à 52 (grave), 59 (médium) ou 66 (aigu) en numéro de note MIDI.

### Basse

Le jeu (quelles notes) et le rythme (quand) sont deux réglages distincts.

**Jeu** :

| Jeu | Comportement |
|---|---|
| Motif du style | motif d'accompagnement du style (la basse n'est pas écrite) |
| Fondamentale | fondamentale seule |
| Fondamentale et quinte | alternance fondamentale / quinte |
| Fondamentale et octave | alternance fondamentale / octave |
| Arpège | notes de l'accord, en montant ; en aller-retour au-delà de la couleur 0,6 |
| Walking bass | une note par temps, mouvement conjoint, approche chromatique ou diatonique de la fondamentale suivante |
| Pédale | tonique du morceau, tenue sous tous les accords |
| Riff | court motif tiré une fois pour tout le morceau, transposé sur chaque accord |
| Ligne chantante | mouvement conjoint, rythme libre |
| Aléatoire | notes de l'accord tirées au hasard |

**Rythme** :

| Rythme | Comportement |
|---|---|
| Selon le jeu | valeur naturelle du jeu : fondamentale = blanche ; quinte, arpège, walking = noire ; octave = croche ; pédale = ronde. Riff, ligne et aléatoire : rythme propre. |
| Rondes, Blanches, Noires, Croches | valeur fixe |
| Triolets, Doubles croches | valeur fixe |
| Syncopé (3+3+2) | dans chaque blanche (8 doubles croches), notes aux positions 0, 3 et 6, plus le début de chaque accord |
| Pompe (temps 1 et 3) | une note au premier et au troisième temps de la mesure, plus le début de chaque accord |
| Anticipé | syncopé, la dernière note de l'accord arrive une croche avant le changement, sur la fondamentale suivante |
| Avec notes fantômes | noires, avec des notes étouffées après chaque temps (probabilités de 30 % et de 60 %) |
| Calé sur la grosse caisse | une note à chaque coup de grosse caisse du motif de batterie |

Les longueurs de motif (1 à 8 mesures) s'appliquent à la ligne de basse, rejouée sur les accords suivants.

### Mélodie

- **Jeu** (durée des notes) : *Notes longues* (surtout blanches et noires) ; *Durées mêlées* (croches à blanches) ; *Notes vives* (doubles croches à noires, avec des croches).
- **Phrasé** : le rythme est tiré pour chaque mesure parmi trois cellules, enchaînées sur quatre mesures selon le motif A B A C. Une mesure peut recevoir une cellule propre, avec la probabilité variation × 0,6.
- **Accents** : les appuis (début d'accord, temps forts, notes d'une noire ou plus) sont sur les notes de l'accord. Les autres notes sont tirées dans le mode avec une probabilité de 0,15 + 0,85 × couleur, sinon dans l'accord. Aux couleurs basses (sous 0,3), les appuis ne prennent que les trois premières notes de l'accord.
- **Intervalles** : au plus 5 + 7 × couleur demi-tons ; petits intervalles favorisés ; retour vers le centre de la tessiture.
- **Tessiture** : numéros de note MIDI 60 à 84, centre 72, décalés par l'octave (±12 par cran).
- **Respiration** : un silence est tiré pour chaque durée (probabilité 0,03 + 0,5 × respiration). À la fin de la deuxième mesure de chaque phrase de deux mesures, les dernières round(10 × respiration) doubles croches sont silencieuses.
- **Contour** : « Montant » ou « Descendant » favorisent la pente dans chaque phrase.
- Une note peut déborder sur l'accord suivant seulement si elle appartient aussi à son mode (probabilité 0,6). Sinon elle est tronquée au changement d'accord.

### Batterie

- **Jeu** : *Feutrée* (niveau bas), *Posée* (niveau moyen), *Énergique* (niveau haut). Chaque kit a ses motifs pour chaque niveau.
- **Fills** : un fill est joué à la dernière mesure de chaque cycle (1 mesure = pas de fill ; 2, 4, 8, 16 mesures). Le fill est tiré parmi ceux du style et du niveau de jeu, avec la graine de la batterie : il est donc le même à chaque tour du cycle. Hors feutré et hors swing, le premier temps du cycle reçoit un charley ouvert accentué.
- **Couleur** :
  - en dessous de 0,20 : charleys et shakers réduits aux temps ;
  - en dessous de 0,33 : pas de charleys ouverts ni de shakers, pas de notes fantômes sur grosse caisse et caisse claire ;
  - au-dessus de 0,66 : notes fantômes (charleys, ou caisse claire sur les croches en swing) ; charleys ouverts en fin de mesure en mode non swing.
- **Dynamique** : au-delà de 0,85, les coups accentués (X) deviennent plus forts encore, et les coups normaux de charley ouvert (o) deviennent des coups normaux (x). Au-delà de 0,92, en niveau énergique et hors jazz, le charley ouvert remplace le charley fermé sur les temps.
- **Variation** : tirée par mesure et répétée à chaque tour du cycle. Elle retire des coups de la ride ou du charley, ajoute des notes fantômes à la grosse caisse et à la caisse claire.
- Les motifs 4/4 sont redistribués sur les autres mesures (section 8).

## 8. Mesures

| Signature | Découpage en temps (en noires) | Remarque |
|---|---|---|
| 2/4 | 2 temps | adapté des motifs 4/4 |
| 3/4 | 3 temps | motifs propres si la case est cochée (« Valse ») |
| 4/4 | 4 temps | motifs de référence |
| 5/4 | 5 temps | adapté, répartition des motifs 1, 2, 3, 2, 4 |
| 6/8 | 2 temps ternaires (noire pointée) | motifs propres (« Ballade en 6/8 ») |
| 7/8 | 2 + 2 + 3 (croches) | motifs propres (« 7/8 (2+2+3) ») |
| 9/8 | 3 temps ternaires | adapté |
| 12/8 | 4 temps ternaires | motifs propres (« Blues en 12/8 ») |

**Motifs adaptés** (mesures sans motifs propres, ou case décochée) : chaque temps reprend le temps correspondant du motif 4/4 d'origine (table `map`). Un temps ternaire garde l'appui et la croche en l'air ; les instruments qui marquent la pulsation (charleys, ride, shaker, balais) y jouent les trois croches.

**Motifs propres** (case cochée, mesure concernée) : motifs écrits pour la mesure, avec leur propre kit de batterie (`METER_KITS`) et leur propre motif d'accompagnement (`METER_COMPS`) à la place de ceux du style. Le timbre reste celui du style. Pour la batterie, le fill est un roulement sur le dernier temps, plus le fill écrit s'il existe.

**Swing.** Le swing décale les croches à contretemps. Ses valeurs par motif : Jazz, Boogie-woogie et Manouche 0,33 ; Hip-hop 0,18 ; Stoner 0,20 ; Reggae 0,12 ; Downtempo 0,10 ; les autres 0. En mesure ternaire (6/8, 7/8, 9/8, 12/8), le swing est supprimé. En 3/4, il s'applique au motif du style, mais le motif propre de valse est écrit sans swing.

## 9. Vues du morceau

Trois vues, sélectionnées par le bouton segmenté **Grille / Disque / Carte** (dans le titre du panneau Morceau). La vue choisie est mémorisée.

### Grille

Une carte par accord, dans l'ordre de jeu, en colonnes proportionnelles à la durée. Chaque carte affiche le chiffrage romain, le nom de l'accord, la fondamentale et le mode conseillé. La couleur de la carte suit la fonction (T, SD, D). Les en-têtes « A · tonalité » et « Pont (B) · tonalité · forme » séparent les sections. La bulle de chaque carte donne la raison harmonique de l'accord.

- Clic : sélectionne l'accord et le joue.
- L'accord en lecture est surligné.

### Disque

Les accords sur le cycle des quintes, tonique en haut, par pas de 30°.

- Anneau extérieur : accords majeurs et dominantes ; anneau intérieur : accords mineurs, demi-diminués et diminués de passage. Un accord de ces types est placé à la position de son relatif majeur (tierce au-dessus de sa fondamentale).
- Le secteur teinté réunit I, IV, V et leurs relatifs (autour de la tonique).
- Taille de chaque point proportionnelle à la racine carrée de la durée passée sur la position.
- Flèches : enchaînements dans l'ordre de jeu, y compris le retour au début ; épaisseur selon le nombre de passages ; pointillés pour les enchaînements qui passent par le pont.
- Informations : tonalité, style, tempo, tonalité du pont, répartition du temps entre T, SD et D (en %), nombre d'accords distincts et de positions, nombre d'accords non diatoniques.
- Clic sur un point : sélectionne le premier accord de la position et le joue.

### Carte

Tous les degrés de la tonalité (ou du pont, si le pont est sélectionné), par fonction : colonnes **Tonique** (repos), **Sous-dominante** (départ), **Dominante** (tension). Les emprunts sont sous la ligne « Emprunts ». La répartition des degrés dans les colonnes est fixée par la table `MAP_COLS`.

- Les **dominantes secondaires** sont des satellites accrochés à leur cible. Elles sont affichées si elles figurent dans le morceau, si leur cible est survolée ou sélectionnée, ou avec le bouton **Toutes les transitions**.
- **Survol** d'un accord : ses flèches sortantes, avec la probabilité de chaque suite (3 % et plus), selon le style, l'ambiance et la couleur. Sous la carte, les quatre suites les plus probables.
- **Chemin du morceau** : flèches courbes entre accords successifs, numérotées par position dans l'ordre de jeu. Pendant la lecture, l'accord joué s'allume et le dernier enchaînement s'anime.
- **Clic** selon le mode choisi dans la barre (**Clic** : Écouter, Insérer après, Remplacer) :
  - Écouter : sélectionne la première occurrence de l'accord dans la section ; si l'accord n'est pas dans le morceau, il reste épinglé (en évidence avec ses suites) ;
  - Insérer après : insère l'accord après l'accord sélectionné, durée d'une mesure ;
  - Remplacer : remplace l'accord sélectionné en gardant sa durée.
  - Dans tous les cas, l'accord est joué si la lecture est arrêtée.
- Le bouton **Grille A / Pont B** change de section quand il y a un pont.

## 10. Notes de l'accord

Le panneau détail affiche les **notes de l'accord** (orthographe de la tonalité), puis la vue choisie, puis le **mode conseillé** (nom du mode et notes de la gamme). Le choix de la vue (**Piano / Basse / Guitare**) est mémorisé.

### Piano

Un clavier d'une octave (7 touches blanches). Trois classes de touches : fondamentale, notes de l'accord, notes du mode.

### Conventions des doigtés

- Chiffres : doigts de la main gauche (1 index, 2 majeur, 3 annulaire, 4 auriculaire) ; 0 ou o : corde à vide ; × : corde étouffée (en tablature, x).
- Les notes sont indiquées par leur nom et leur degré (1, ♭3, 3, 5, ♭7…).
- Les deux vues (basse et guitare) sont **horizontales** : sillet à gauche, corde aiguë en haut (mi aigu en haut, mi grave en bas). Les numéros de cases sont sous le manche.

### Guitare

- Accordage : mi la ré sol si mi, du grave à l'aigu. Diagramme de six cordes.
- Position recherchée : une position par accord, qui satisfait les contraintes suivantes :
  - la fondamentale est à la basse (corde la plus grave jouée) ;
  - la fondamentale, la tierce (ou la seconde ou la quarte, pour un accord suspendu) et la septième, quand l'accord en a une, sont présentes ;
  - les cordes jouées forment un ensemble continu, d'au moins quatre cordes, ou de trois pour un accord de deux notes ;
  - l'écart entre cases jouées est de 3 cases au plus ;
  - les doigtés sont possibles : au plus quatre cases, un doigt par case ; au-delà, un barré de l'index sur la case la plus basse, avec au plus trois autres cases au-dessus, et pas de corde à vide sous le barré.
- Choix : parmi les positions valides, on préfère les accords qui couvrent le plus de notes de l'accord, peu de doigts, les positions basses, les cordes à vide en première position, et les accords complets. Le résultat est mis en cache par accord.
- Affichage : première case en 1, ou la case la plus basse si l'accord est plus haut ; le numéro de position est indiqué si elle dépasse la première case. La tablature (par exemple `x 3 2 0 1 0`) est affichée sous le diagramme.

### Basse

- Quatre cordes, mi la ré sol, en vue horizontale.
- Position : la fondamentale est sur la corde de mi si elle tombe entre les cases 0 et 7, sinon sur la corde de la.
- Une case par doigt, à partir de la case de base. Accord majeur : la case de base est celle qui précède la fondamentale, de sorte que la fondamentale tombe sous le majeur et que l'index reste libre pour la tierce. Accord mineur : la case de base est celle de la fondamentale, sous l'index, et la tierce mineure tombe trois cases plus haut, sous l'auriculaire. Quatre cases consécutives au plus ; la corde à vide n'est proposée qu'en première position.
- Arpège conseillé : les notes de l'accord, en montant depuis la fondamentale, cinq au plus.

## 11. Lecture audio

- **Bouton ▶ Lecture / ■ Stop** ; raccourci Espace.
- La lecture boucle sur toute la grille, dans l'ordre de jeu (pont compris). Elle ne s'arrête que sur demande.
- **Tempo** : noire = 60 / tempo secondes. La pulsation de référence est la croche.
- **Ordonnancement** : une tâche toutes les 25 ms, avec une anticipation de 0,12 s. Le départ est décalé de 0,08 s.
- **Surbrillance** : au début de chaque accord, la carte de la grille, le point du disque et le nœud de la carte prennent la classe « lecture » (surbrillance). La flèche du chemin de la carte s'anime.
- **Synthèse** : les notes sont des oscillateurs (plusieurs formes d'onde, décalages d'octave ou de demi-ton) avec une enveloppe (attaque, décroissance, tenue, relâchement) et un filtre passe-bas. Niveau de crête = vélocité × 0,2 ; la vélocité, bornée entre 0,1 et 1,25, dépend de la dynamique et de la place dans la mesure.

### Timbres

| Timbre | Oscillateurs (forme, décalage en demi-tons, niveau) | Coupure du filtre (Hz) |
|---|---|---|
| keys | sinus 0 (1) ; triangle 0 (0,45) ; sinus +12 (0,1) | 2600 × (0,5 + brillance) |
| guitar | dent de scie 0 (0,45) ; carré 0 (0,2) | 1900 × (0,5 + brillance) |
| pad | dent de scie −0,07 (0,4) ; dent de scie +0,07 (0,4) | 1500 × (0,5 + brillance) |
| dist | dent de scie 0 (0,5) ; carré 0 (0,3) ; dent de scie −12 (0,3) | 2600 × (0,5 + brillance) |
| lead | triangle 0 (0,8) ; sinus +12 (0,2) ; dent de scie 0 (0,12) | 3200 × (0,5 + brillance) |
| synth | dent de scie 0 (0,5) ; carré −12 (0,2) | 2400 × (0,5 + brillance) |
| strings | dent de scie −0,05 (0,35) ; dent de scie +0,05 (0,35) ; triangle 0 (0,3) | 2200 × (0,5 + brillance) |
| pluck | dent de scie 0 (0,4) ; triangle +12 (0,2) | 3000 × (0,5 + brillance) |
| organ | carré 0 (0,3) ; sinus +12 (0,3) ; triangle 0 (0,3) | 2600 × (0,5 + brillance) |
| bass | sinus 0 (1) ; triangle 0 (0,4) ; dent de scie 0 (0,18) ; sinus +12 (0,15) | 1100 (fixe, sans brillance) |

Les timbres des styles sont ceux du motif d'accompagnement ou du style (par exemple `guitar` pour le rock, `dist` pour le metal, `keys` pour le jazz, `pad` pour l'électro).

### Batterie

Chaque instrument est synthétisé, sans échantillon :

| Code | Instrument | Synthèse |
|---|---|---|
| k | grosse caisse | sinus dont la fréquence descend (début et fin du kit, durée propres au kit) |
| s | caisse claire | bruit filtré passe-bande à 2400 Hz, plus triangle de 200 à 140 Hz |
| r | rimshot | triangle de 1650 à 1500 Hz, plus bruit passe-bande à 2800 Hz |
| h | charley fermé | bruit passe-haut à 7500 Hz, 45 ms |
| o | charley ouvert | bruit passe-haut à 6500 Hz, 300 ms |
| d | ride | bruit passe-haut à 5500 Hz, 500 ms, plus triangle à 4300 Hz |
| b | balai | bruit passe-bande à 2600 Hz, 200 ms |
| c | clap | trois salves de bruit passe-bande à 1300 Hz, espacées de 11 ms |
| a | shaker | bruit passe-haut à 5500 Hz, 50 ms |

Niveaux : X (accent) = 1, x = 0,75, o (fantôme) = 0,35.

### Swing à l'écoute

Voir section 8. Le décalage s'applique aux motifs de l'accompagnement et à la batterie. Pour la basse et la mélodie écrites, les notes posées sur une double croche entière suivent le même décalage (les triolets n'en reçoivent pas).

## 12. Export

### Export MIDI

Bouton **Exporter MIDI**. Fichier `harmonie-<style>-<tonique>[m]-<tempo>bpm.mid` (le dièse est écrit `s`, les mineurs ont un `m`). Le message de confirmation donne le nombre de notes par partie.

- Format 1, 480 ticks par noire.
- **Piste de tête** : nom « Harmonie », tempo (µs par noire), signature (numérateur, puissance de deux du dénominateur, 24 horloges par temps — 12 pour une mesure en 8 —, 8 triples croches par noire), puis un **marqueur par accord** (nom de l'accord, à son début, dans l'ordre de jeu).
- **Pistes** (uniquement celles qui ont des notes) :

| Piste | Partie | Canal | Programme |
|---|---|---|---|
| 1 | Accords | 1 | selon le timbre réellement joué (un pad en plaqués ou en arpège devient keys) : piano électrique (keys, 4), guitare claire (guitar, 27), pad (pad, 89), guitare saturée (dist, 29), synthé (synth, 81), cordes (strings, 48), guitare nylon (pluck, 24), accordéon (organ, 21) |
| 2 | Basse | 2 | 33 |
| 3 | Mélodie | 3 | 80 |
| 4 | Batterie | 10 | batterie (canal 10) |

- Programmes écrits tels quels dans le fichier, numérotés à partir de 0 (voir section 15).
- **Textes** (noms de piste, marqueurs) : ASCII strict. Le symbole ° devient « dim » (`B°7` → `Bdim7`), les accents sont retirés, tout autre caractère non ASCII devient « ? ».
- **Volume** : contrôleur 7 de chaque piste = 100 × volume / 0,8, borné à 127.
- Batterie : hauteurs GM (k 36, s 38, r 37, h 42, o 46, d 51, c 39, a 70, b 40 — les balais sont remplacés par la caisse claire douce, 40) ; vélocité 40 + 70 × vélocité interne, fixée à 45 pour les balais.
- Notes : vélocité = 110 × vélocité interne ; durée minimale 30 ticks ; une note répétée à la même hauteur coupe la précédente ; rien ne dépasse la fin de la boucle.

**Correspondance avec la lecture.** Le fichier est produit par le même chemin que la lecture (`stepEvents`) : chaque croche de la boucle donne les mêmes notes, au même instant (croche × 240 ticks + décalage de swing). Les différences connues sont listées en section 15.

### Copie de la grille en texte

Bouton **Copier la grille** (presse-papiers ; à défaut, une fenêtre de saisie). Format :

- première ligne : `<tonalité> majeur|mineur — <style> — <mesure> — <tempo> bpm` ;
- une ligne par groupe de quatre mesures, mesures séparées par `|` ;
- un accord de deux mesures est suivi de `| %` ;
- si le pont existe : une ligne `Pont (<tonalité>), forme A B` (ou `A A B A`), puis ses mesures.

Le message « Grille copiée » s'affiche après la copie.

## 13. Raccourcis clavier

Les raccourcis sont inactifs quand le focus est sur un champ de saisie (liste, champ de nombre, zone de texte) et quand la fenêtre des raccourcis est ouverte. La fenêtre s'ouvre avec le bouton « i » de l'en-tête.

| Touche | Action |
|---|---|
| Espace | lecture / arrêt |
| G | nouvelle grille (comme le bouton Régénérer des accords) |
| N | nouvelle mélodie (active la mélodie) |
| M | active ou coupe la mélodie |
| B | active ou coupe la batterie |
| ← / → | accord précédent / suivant (sélection et écoute) |
| Suppr ou ⌫ | retire l'accord sélectionné |
| ⌘Z / Ctrl+Z | annuler |

Le clic sur le fond de la fenêtre des raccourcis la ferme.

## 14. Habillages

Deux habillages, choisis par le sélecteur **Classique / Studio** de l'en-tête. Le choix est mémorisé (`harmonie.look`) et appliqué avant l'affichage, pour éviter un clignotement.

- **Studio** (par défaut) : filets très fins, sans fond des panneaux, typographie légère, une seule couleur d'accent (sable). Boutons en texte, sélecteurs soulignés, curseurs en trait fin. Les titres de zone sont posés sur la bordure.
- **Classique** : l'habillage de base de la feuille de style, avec des panneaux de fond (`--panel`), des bordures arrondies et des boutons à fond plein pour l'accent.

Les deux habillages affichent les mêmes fonctions et les mêmes libellés. Les couleurs de fonction (T, SD, D) sont définies sur `:root` et ne sont pas redéfinies par « Studio » : elles s'affichent donc dans les deux.

## 15. Version mobile

Sous un écran étroit (≤ 760 px de large), l'interface passe en mode à onglets pour éviter les grands scrolls.

- Une barre d'onglets collante en haut de l'écran propose cinq sections, dans cet ordre : **Général**, **Instruments**, **Grille**, **Carte**, **Disque**.
  - **Général** et **Instruments** affichent leur zone (la zone Instruments contient toujours les quatre panneaux empilés).
  - **Grille**, **Carte** et **Disque** affichent la zone Morceau en forçant la vue correspondante du sélecteur interne (`#view`), lequel est alors masqué puisqu'il devient redondant avec les onglets.
- L'onglet choisi est mémorisé (`harmonie.tab`) et réappliqué au chargement suivant. Une valeur mémorisée inconnue retombe sur **Général**.
- Une barre d'actions fixée en bas de l'écran est toujours visible et contient **Lecture** (miroir de `#play`, suit son état ▶ / ■) et **Tout régénérer** (miroir de `#regenAll`).
- Les bandes **Famille** et **Style** passent en défilement horizontal sans enroulage.
- Au-dessus du breakpoint, aucun des éléments ci-dessus n'est visible : le `data-tab` posé sur `<body>` n'a plus d'effet et la mise en page reste celle du desktop.

## 16. Points à confirmer et écarts relevés

1. **Numérotation des programmes** : les valeurs écrites (33 pour la basse, 80 pour la mélodie, et celles de la table de la section 12) sont des octets de changement de programme, donc comptées à partir de 0. Les noms de la section 12 reprennent les commentaires de `GM_PROGRAM` dans `app.js` ; à confirmer dans un logiciel de séquençage.
2. **Strum** : la lecture égrène les notes des accords de 6 ms (motif) ou 8 ms (plaqués). L'export les place au même instant.
3. **Durées** : la lecture garde la durée exacte des notes ; l'export applique une durée minimale de 30 ticks et tronque les notes à la fin de la boucle. Les notes courtes peuvent donc durer un peu plus dans le fichier.
4. **Vélocité et volume** : la vélocité MIDI est une transposition linéaire de la vélocité interne, et le volume est linéaire (CC7). La lecture utilise un gain quadratique (`(vol / 0,8)²`). Les hauteurs, les instants et les durées sont identiques ; les niveaux ne le sont pas.
5. **Motif propre de valse (3/4)** : il est écrit sans swing ; le motif du style, en 3/4 sans motif propre, garde le swing de son style. Conforme au code ; à confirmer comme intention.
6. **Libellés en double** : « Prog » désigne deux styles (rock et metal), d'où la nécessité de regarder la famille dans le menu.
7. **Probabilités et rendu sonore** : les seuils et poids décrits viennent du code. Leur effet à l'écoute n'a pas été vérifié ; ce document décrit le comportement du code, pas le rendu sonore.
8. **Diminués de passage dans « Continuer avec »** : ils n'y sont proposés que pour les styles jazzy. Dans la génération, ils dépendent de la couleur pour tous les styles dont la probabilité de diminué est non nulle.
