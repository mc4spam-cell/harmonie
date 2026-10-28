# Harmonie

Générateur de suites d'accords et de modes, avec basse, mélodie et batterie, pour composer dans de nombreux styles. Tout tourne dans le navigateur, sans installation ni compilation. La spécification fonctionnelle détaillée est dans [SPECIFICATIONS.md](SPECIFICATIONS.md).

## Lancer l'application

Sur la machine où se trouve le dossier, il suffit d'ouvrir `index.html` dans un navigateur.

Pour y accéder depuis une autre machine du réseau local, servir le dossier :

```bash
python3 -m http.server 8080 --bind 0.0.0.0 --directory /chemin/vers/harmonie
```

puis ouvrir `http://<adresse-de-la-machine>:8080`.

Les réglages et la grille en cours sont enregistrés dans le navigateur de chaque machine ; ils ne se partagent pas entre appareils.

## Ce que fait l'outil

- **Grille d'accords** générée par un moteur de théorie musicale à base de règles (fonctions tonales, emprunts, dominantes secondaires, substitutions tritoniques, ii–V, diminués de passage). Chaque accord est présenté avec son degré, sa fonction et le mode conseillé.
- **Retouche accord par accord** : remplacements (autre couleur, même fonction, accord qui amène le suivant) et suites possibles, classées de l'attendu au surprenant.
- **Styles** : 111 styles répartis en 9 familles (Rock, Metal, Pop, Électronique, Hip-hop / R&B, Jazz / Blues, Musiques du monde, Folk / Country, Classique / Orchestral). Chaque style a son vocabulaire harmonique, son accompagnement et sa batterie, et certains ont leur mesure naturelle.
- **Ambiances** : 26 ambiances (lumineuses, paisibles, tendres, tristes, sombres, intenses). Choisir une ambiance pose un ensemble de réglages visibles, qui restent modifiables, et oriente l'harmonie.
- **Mesures** : 2/4, 3/4, 4/4, 5/4, 6/8, 7/8, 9/8 et 12/8, avec des motifs propres pour la valse, le 6/8, le 7/8 et le blues en 12/8.
- **Pont** : section contrastante dans une tonalité voisine (demi-ton, ton, tierce mineure, relatif, homonyme, sous-dominante, dominante), jouée en forme A B ou A A B A.
- **Instruments** : accords, basse, mélodie et batterie ont chacun leur panneau. On y règle l'activation, la longueur du motif, la couleur, la façon de jouer, la variation, le volume et la dynamique, et on peut régénérer chaque partie séparément.
  - La basse sépare le choix des notes (fondamentale, quinte, octave, arpège, walking, pédale, riff, ligne chantante…) de celui du rythme (valeurs de notes, syncopé, pompe, anticipé, notes fantômes, calé sur la grosse caisse).
  - La mélodie se règle en densité, respiration, octave et contour.
- **Trois vues du morceau** :
  - la grille ;
  - le disque, sur le cycle des quintes ;
  - la carte, qui place chaque accord selon sa fonction harmonique.
- **Notes de l'accord** en vue piano, basse ou guitare, avec doigtés pour la basse et la guitare.
- **Export MIDI** de ce qu'on entend : une piste par instrument (accords, basse, mélodie, batterie sur le canal 10), avec tempo, mesure et un marqueur par accord. La grille peut aussi être copiée en texte.
- **Deux habillages** : « Classique » (par défaut) et « Studio ».

## Raccourcis

| Touche | Action |
|---|---|
| Espace | lecture / arrêt |
| G | nouvelle grille |
| N | nouvelle mélodie |
| M | mélodie activée / coupée |
| B | batterie activée / coupée |
| ← → | accord précédent / suivant |
| Suppr | retirer l'accord sélectionné |
| ⌘Z / Ctrl+Z | annuler |

## Organisation du code

| Fichier | Rôle |
|---|---|
| `index.html` | page, styles des deux habillages, chargement des scripts |
| `engine.js` | moteur musical sans interface : styles, ambiances, mesures, génération des grilles, pont, suggestions, mélodie, basse |
| `app.js` | interface, synthèse sonore (Web Audio), motifs d'accompagnement et de batterie, vues, export MIDI |
| `docs/` | cette présentation, la spécification fonctionnelle (`SPECIFICATIONS.md`) et les consignes de développement (`CLAUDE.md`) |

Le moteur peut s'utiliser seul dans Node, depuis la racine du dépôt :

```js
const H = require('./engine.js');
const g = H.generate({ tonic: 'C', minor: false, style: 'jazz', mood: 'neutre', meter: '4/4', color: .5, bars: 8 });
```
