// Moteur harmonique : accords stockés en relatif (degré / demi-tons depuis la tonique),
// donc changer de tonalité transpose toute la grille sans rien régénérer.
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Harmony = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------- Notes et orthographe ----------

  const LETTERS = 'CDEFGAB';
  const LETTER_PC = [0, 2, 4, 5, 7, 9, 11];
  const FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
  const TONICS = {
    major: ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'],
    minor: ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B'],
  };

  function makeKey(tonic, minor) {
    const letter = LETTERS.indexOf(tonic[0]);
    const acc = tonic[1] === 'b' ? -1 : tonic[1] === '#' ? 1 : 0;
    return { tonic, minor: !!minor, letter, pc: (LETTER_PC[letter] + acc + 12) % 12 };
  }

  // Tonalité dans laquelle se lit un accord : celle du morceau, ou celle du pont s'il porte un décalage
  // (up : demi-tons au-dessus de la tonique principale ; km : mode mineur du pont).
  function keyOf(state, ch) {
    const home = makeKey(state.tonic, state.minor);
    if (!ch || (ch.up == null && ch.km == null)) return home;
    const minor = ch.km == null ? home.minor : ch.km, pc = (home.pc + (ch.up || 0)) % 12;
    return makeKey(TONICS[minor ? 'minor' : 'major'].find(t => makeKey(t).pc === pc), minor);
  }

  // Orthographie par degré (lettre imposée), repli enharmonique si double altération.
  function spell(letter0, pc0, semis, step) {
    const letter = (letter0 + step) % 7;
    const pc = (pc0 + semis) % 12;
    const acc = ((pc - LETTER_PC[letter] + 18) % 12) - 6;
    if (Math.abs(acc) > 1) {
      const name = FLAT[pc];
      return { name, letter: LETTERS.indexOf(name[0]), pc };
    }
    return { name: LETTERS[letter] + (acc === 1 ? '#' : acc === -1 ? 'b' : ''), letter, pc };
  }

  // Intervalle en demi-tons -> écart de lettre (tierce = 2 lettres, etc.)
  const STEP_OF = { 0: 0, 2: 1, 3: 2, 4: 2, 5: 3, 6: 4, 7: 4, 8: 4, 9: 5, 10: 6, 11: 6, 13: 1, 14: 1, 15: 2, 17: 3, 18: 3, 20: 5, 21: 5 };

  // ---------- Accords et modes ----------

  const Q = {
    '': { iv: [0, 4, 7], sym: '' },
    'm': { iv: [0, 3, 7], sym: 'm' },
    '5': { iv: [0, 7], sym: '5' },
    'sus2': { iv: [0, 2, 7], sym: 'sus2' },
    'sus4': { iv: [0, 5, 7], sym: 'sus4' },
    'add9': { iv: [0, 4, 7, 14], sym: 'add9' },
    'madd9': { iv: [0, 3, 7, 14], sym: 'm(add9)' },
    '6': { iv: [0, 4, 7, 9], sym: '6' },
    '69': { iv: [0, 4, 7, 9, 14], sym: '6/9' },
    'maj7': { iv: [0, 4, 7, 11], sym: 'maj7' },
    'maj9': { iv: [0, 4, 7, 11, 14], sym: 'maj9' },
    'maj13': { iv: [0, 4, 11, 14, 21], sym: 'maj13' },
    'maj7#11': { iv: [0, 4, 7, 11, 18], sym: 'maj7#11' },
    'maj9#11': { iv: [0, 4, 11, 14, 18], sym: 'maj9#11' },
    'maj7#5': { iv: [0, 4, 8, 11], sym: 'maj7#5' },
    'm7': { iv: [0, 3, 7, 10], sym: 'm7' },
    'm9': { iv: [0, 3, 7, 10, 14], sym: 'm9' },
    'm11': { iv: [0, 3, 10, 14, 17], sym: 'm11' },
    'm13': { iv: [0, 3, 10, 14, 21], sym: 'm13' },
    'm6': { iv: [0, 3, 7, 9], sym: 'm6' },
    'm69': { iv: [0, 3, 7, 9, 14], sym: 'm6/9' },
    'mMaj9': { iv: [0, 3, 7, 11, 14], sym: 'm(maj9)' },
    'mMaj7': { iv: [0, 3, 7, 11], sym: 'm(maj7)' },
    '7': { iv: [0, 4, 7, 10], sym: '7' },
    '9': { iv: [0, 4, 7, 10, 14], sym: '9' },
    '13': { iv: [0, 4, 10, 14, 21], sym: '13' },
    '7b9': { iv: [0, 4, 7, 10, 13], sym: '7b9' },
    '7#9': { iv: [0, 4, 10, 15], sym: '7#9' },
    '7alt': { iv: [0, 4, 10, 15, 20], sym: '7alt' },
    '7#11': { iv: [0, 4, 10, 14, 18], sym: '7#11' },
    '13#11': { iv: [0, 4, 10, 14, 18, 21], sym: '13#11' },
    '13b9': { iv: [0, 4, 10, 13, 21], sym: '13b9' },
    '7b13': { iv: [0, 4, 10, 20], sym: '7b13' },
    '7#5': { iv: [0, 4, 8, 10], sym: '7#5' },
    '7sus4': { iv: [0, 5, 7, 10], sym: '7sus4' },
    '13sus4': { iv: [0, 5, 10, 14, 21], sym: '13sus4' },
    '7sus4b9': { iv: [0, 5, 7, 10, 13], sym: '7sus4b9' },
    '9sus4': { iv: [0, 5, 7, 10, 14], sym: '9sus4' },
    'm7b5': { iv: [0, 3, 6, 10], sym: 'm7b5' },
    'm9b5': { iv: [0, 3, 6, 10, 14], sym: 'm9b5' },
    'dim7': { iv: [0, 3, 6, 9], sym: '°7' },
  };

  const SCALES = {
    ion: { name: 'ionien (majeur)', iv: [0, 2, 4, 5, 7, 9, 11] },
    dor: { name: 'dorien', iv: [0, 2, 3, 5, 7, 9, 10] },
    phr: { name: 'phrygien', iv: [0, 1, 3, 5, 7, 8, 10] },
    lyd: { name: 'lydien', iv: [0, 2, 4, 6, 7, 9, 11] },
    mixo: { name: 'mixolydien', iv: [0, 2, 4, 5, 7, 9, 10] },
    aeo: { name: 'éolien (mineur naturel)', iv: [0, 2, 3, 5, 7, 8, 10] },
    loc: { name: 'locrien', iv: [0, 1, 3, 5, 6, 8, 10] },
    mel: { name: 'mineur mélodique', iv: [0, 2, 3, 5, 7, 9, 11] },
    lyddom: { name: 'lydien ♭7', iv: [0, 2, 4, 6, 7, 9, 10] },
    alt: { name: 'altéré', iv: [0, 1, 3, 4, 6, 8, 10] },
    phrdom: { name: 'mixolydien ♭9 ♭13', iv: [0, 1, 4, 5, 7, 8, 10] },
    loc2: { name: 'locrien ♮2', iv: [0, 2, 3, 5, 6, 8, 10] },
    lydaug: { name: 'lydien augmenté', iv: [0, 2, 4, 6, 8, 9, 11] },
    mixob6: { name: 'mixolydien ♭13', iv: [0, 2, 4, 5, 7, 8, 10] },
    wt: { name: 'par tons', iv: [0, 2, 4, 6, 8, 10] },
    hw: { name: 'diminué demi-ton/ton', iv: [0, 1, 3, 4, 6, 7, 9, 10] },
    wh: { name: 'diminué ton/demi-ton', iv: [0, 2, 3, 5, 6, 8, 9, 11] },
  };

  // ---------- Degrés ----------
  // t : type d'accord (M majeur, m mineur, mt tonique mineure, D dominante, Dm dominante vers mineur,
  //     Dl dominante lydienne non résolutive, ø demi-diminué). tj : type dans les styles « jazzy ».
  // f : fonction (T, SD, D). b : emprunt (pondéré par le curseur de couleur).

  const DEG = {
    major: {
      'I': { semis: 0, step: 0, t: 'M', f: 'T', mode: 'ion', why: 'Tonique — le point de repos.' },
      'ii': { semis: 2, step: 1, t: 'm', f: 'SD', mode: 'dor', why: 'Sous-dominante (ii) — prépare la dominante.' },
      'iii': { semis: 4, step: 2, t: 'm', f: 'T', mode: 'phr', why: 'Tonique de substitution (iii) — plus fragile que I.' },
      'IV': { semis: 5, step: 3, t: 'M', f: 'SD', mode: 'lyd', why: 'Sous-dominante (IV) — ouvre, éloigne de la tonique.' },
      'V': { semis: 7, step: 4, t: 'D', f: 'D', mode: 'mixo', why: 'Dominante — tension qui appelle la tonique.' },
      'vi': { semis: 9, step: 5, t: 'm', f: 'T', mode: 'aeo', why: 'Relatif mineur (vi) — tonique de substitution, plus sombre.' },
      'bVII': { semis: 10, step: 6, t: 'M', tj: 'Dl', f: 'SD', mode: 'lyd', b: 1, why: 'Emprunt au mixolydien (♭VII) — couleur rock, ou cadence « backdoor » vers I.' },
      'bVI': { semis: 8, step: 5, t: 'M', f: 'SD', mode: 'lyd', b: 1, why: 'Emprunt au mineur parallèle (♭VI) — assombrit soudainement.' },
      'bIII': { semis: 3, step: 2, t: 'M', f: 'T', mode: 'lyd', b: 1, why: 'Emprunt au mineur parallèle (♭III).' },
      'iv': { semis: 5, step: 3, t: 'mt', f: 'SD', mode: 'dor', b: 1, why: 'Sous-dominante mineure (iv) — emprunt très expressif, retombe sur I.' },
      'bII': { semis: 1, step: 1, t: 'M', f: 'SD', mode: 'lyd', b: 1, why: 'Accord napolitain (♭II) — glisse d’un demi-ton vers I.' },
      'v': { semis: 7, step: 4, t: 'm', f: 'D', mode: 'dor', b: 1, why: 'Dominante mineure (v) — couleur mixolydienne, sans sensible.' },
      '#ivø': { semis: 6, step: 3, t: 'ø', f: 'SD', mode: 'loc', b: 1, why: '♯iv demi-diminué — descend chromatiquement vers IV ou iv.' },
    },
    minor: {
      'i': { semis: 0, step: 0, t: 'mt', f: 'T', mode: 'aeo', why: 'Tonique mineure — le point de repos.' },
      'iiø': { semis: 2, step: 1, t: 'ø', f: 'SD', mode: 'loc', why: 'Sous-dominante (iiø) — prépare la dominante.' },
      'bIII': { semis: 3, step: 2, t: 'M', f: 'T', mode: 'ion', why: 'Relatif majeur (♭III) — éclaircit.' },
      'iv': { semis: 5, step: 3, t: 'm', f: 'SD', mode: 'dor', why: 'Sous-dominante (iv).' },
      'v': { semis: 7, step: 4, t: 'm', f: 'D', mode: 'phr', why: 'Dominante mineure (v) — modale, sans sensible.' },
      'V': { semis: 7, step: 4, t: 'Dm', f: 'D', mode: 'phrdom', why: 'Dominante (V) — sensible empruntée au mineur harmonique.' },
      'bVI': { semis: 8, step: 5, t: 'M', f: 'SD', mode: 'lyd', why: 'Sous-dominante (♭VI) — ampleur, lyrisme.' },
      'bVII': { semis: 10, step: 6, t: 'M', tj: 'D', f: 'D', mode: 'mixo', why: 'Sous-tonique (♭VII) — mouvement éolien, ou dominante du relatif majeur.' },
      'IV': { semis: 5, step: 3, t: 'M', tj: 'Dl', f: 'SD', mode: 'mixo', b: 1, why: 'IV majeur — couleur dorienne.' },
      'bII': { semis: 1, step: 1, t: 'M', f: 'SD', mode: 'lyd', b: 1, why: 'Napolitain (♭II) — couleur phrygienne.' },
      'bV': { semis: 6, step: 4, t: 'M', f: 'D', mode: 'lyd', b: 1, rare: 1, why: 'Triton (♭V) — le « diabolus in musica », tension maximale.' },
    },
  };

  function parseTable(obj) {
    const out = {};
    for (const k in obj) out[k] = obj[k].split(' ').map(s => { const p = s.split(':'); return [p[0], +p[1]]; });
    return out;
  }

  // Poids de transition « de base » entre degrés ; les styles les modulent.
  const BASE = {
    major: parseTable({
      'I': 'ii:4 IV:4 vi:4 V:3 iii:2 bVII:2 bVI:1 iv:1 bIII:1 bII:.4 #ivø:.5 v:.6',
      'ii': 'V:8 iii:1 IV:1 bII:1 I:1 iv:1 bVII:1',
      'iii': 'vi:5 IV:3 ii:2 bIII:1',
      'IV': 'V:5 I:4 ii:2 iv:3 vi:2 bVII:2 iii:1 #ivø:.5',
      'V': 'I:7 vi:3 IV:2 iii:1 bVI:1',
      'vi': 'ii:5 IV:4 V:2 iii:1 I:1 bVI:.5',
      'bVII': 'I:5 IV:4 bVI:2 vi:1',
      'bVI': 'bVII:5 V:4 I:2 iv:1 bII:1',
      'bIII': 'IV:3 bVI:3 ii:2 bVII:2 bII:1',
      'iv': 'I:6 V:2 bVII:3 iii:1',
      'bII': 'I:6 V:2',
      'v': 'IV:4 I:3 bVII:2',
      '#ivø': 'iv:4 V:3 IV:2',
    }),
    minor: parseTable({
      'i': 'iv:4 bVI:4 bVII:4 iiø:3 v:2 bIII:3 V:2 IV:1.5 bII:.5 bV:.3',
      'iiø': 'V:9 bII:1',
      'bIII': 'bVI:4 iv:3 bVII:3 iiø:1 i:1',
      'iv': 'V:4 i:4 bVII:4 v:2 iiø:1 bVI:2 bIII:1',
      'v': 'i:5 bVI:3 iv:3 bVII:1',
      'V': 'i:8 bVI:2 iv:.5',
      'bVI': 'bVII:5 V:4 i:3 iv:2 iiø:2 bIII:2 bII:1',
      'bVII': 'i:5 bIII:4 bVI:3 iv:1 v:1',
      'IV': 'i:4 bVII:3 bVI:1 V:1',
      'bII': 'i:5 V:3 bV:.3',
      'bV': 'i:5 iv:3 bII:2',
    }),
  };

  const SEC_TARGETS = {
    major: ['ii', 'iii', 'IV', 'V', 'vi'],
    minor: ['iv', 'V', 'bVI', 'bVII', 'bIII', 'v'],
  };

  // ---------- Styles ----------
  // Un style = un archétype harmonique (ARCH) + des retouches, un motif d'accompagnement et un kit de batterie
  // (ces deux derniers sont définis dans app.js et désignés ici par leur nom).
  //
  // Archétype — jazzy : ♭VII et IV mineur traités en dominantes. loop : phrases de 4 mesures reprises et variées.
  // cad : goût pour la cadence finale. minBorrow : plancher du poids des emprunts, quel que soit le curseur.
  // bias : degrés favorisés. p : probabilités des enrichissements (sec = [base, pente × couleur]).
  // pools : [qualité, niveau de couleur 0..1] — le curseur tire vers les qualités de niveau proche.
  // blues : I et IV en accords de septième ; form 'blues' : grille de blues quand on demande 12 mesures.
  // cshift : décalage du curseur de couleur propre au style. meter : mesure naturelle (4/4 sinon), posée quand on choisit le style.

  const MINOR_START = { 'i': .85, 'bVI': .1, 'iv': .05 };
  const TONIC_START = { major: { 'I': .8, 'vi': .1, 'IV': .1 }, minor: MINOR_START };
  const NO_ENRICH = { sec: [0, 0], rel: 0, tri: 0, dim: 0 };
  const DL_POOL = [['7', .15], ['9', .4], ['7#11', .7], ['13#11', .95]];
  const HALF_POOL = [['m7b5', .3], ['m9b5', .95]];

  const ARCH = {
    jazz: {
      jazzy: true, loop: false, cad: 1,
      bias: {
        major: { 'ii': 1.6, 'V': 1.5, 'iii': 1.2, 'vi': 1.1, 'bVII': .6, 'bIII': .6, 'v': 0, 'bVI': .8, 'iv': 1.2, 'bII': .8 },
        minor: { 'iiø': 2, 'V': 2, 'v': .2, 'bVII': .7, 'IV': .8, 'bII': .6 },
      },
      start: { major: { 'I': .7, 'ii': .15, 'IV': .05, 'vi': .1 }, minor: MINOR_START },
      p: { sec: [.1, .5], rel: .5, tri: .4, dim: .2 },
      pools: {
        M: [['6', .1], ['maj7', .3], ['69', .5], ['maj9', .6], ['maj13', .75], ['maj7#11', .9], ['maj9#11', 1], ['maj7#5', 1.1]],
        m: [['m7', .3], ['m9', .55], ['m11', .75], ['m13', .95]],
        mt: [['m7', .2], ['m6', .45], ['m9', .55], ['m69', .7], ['mMaj7', .9], ['mMaj9', 1.05]],
        D: [['7', .1], ['9', .35], ['13', .5], ['13sus4', .6], ['7b9', .7], ['13b9', .8], ['7#5', .9], ['7alt', 1]],
        Dm: [['7', .05], ['7b13', .3], ['7b9', .45], ['7sus4b9', .65], ['7alt', .9]],
        Dl: DL_POOL, 'ø': HALF_POOL,
      },
    },
    bossa: {
      jazzy: true, loop: false, cad: 1,
      bias: {
        major: { 'ii': 1.6, 'V': 1.4, 'iii': 1.1, 'iv': 1.5, 'bVII': .5, 'bIII': .5, 'v': 0, 'bII': 1.2, '#ivø': .8 },
        minor: { 'iiø': 2, 'V': 2, 'v': .2, 'bVII': .6, 'IV': .6, 'bII': .8 },
      },
      start: { major: { 'I': .75, 'ii': .15, 'vi': .1 }, minor: MINOR_START },
      p: { sec: [.1, .45], rel: .4, tri: .3, dim: .4 },
      pools: {
        M: [['maj7', .2], ['6', .3], ['69', .5], ['maj9', .7], ['maj13', .85], ['maj7#11', 1]],
        m: [['m7', .3], ['m9', .6], ['m11', .9]],
        mt: [['m7', .2], ['m6', .45], ['m9', .6], ['m69', .8], ['mMaj7', 1]],
        D: [['7', .1], ['9', .35], ['13', .5], ['7b9', .7], ['13b9', .85], ['7#5', 1]],
        Dm: [['7', .05], ['7b13', .3], ['7b9', .45], ['7alt', .9]],
        Dl: DL_POOL, 'ø': HALF_POOL,
      },
    },
    rock: {
      jazzy: false, loop: true, cad: .3,
      bias: {
        major: { 'bVII': 2.2, 'IV': 1.6, 'bVI': 1.5, 'bIII': 1.5, 'ii': .5, 'iii': .5, 'iv': .6, 'bII': .1, '#ivø': 0 },
        minor: { 'bVII': 2, 'bVI': 1.5, 'bIII': 1.5, 'iiø': .1, 'IV': 1.3, 'bII': .3 },
      },
      start: { major: { 'I': .75, 'vi': .15, 'IV': .1 }, minor: MINOR_START },
      p: { sec: [0, .2], rel: 0, tri: 0, dim: 0 },
      pools: {
        M: [['5', 0], ['', .25], ['sus2', .5], ['add9', .65], ['6', .8], ['maj7', 1]],
        m: [['5', 0], ['m', .25], ['madd9', .6], ['m7', .8], ['m9', 1]],
        D: [['5', 0], ['', .25], ['sus4', .5], ['7', .75], ['7sus4', .9]],
      },
    },
    pop: {
      jazzy: false, loop: true, cad: .5,
      bias: {
        major: { 'IV': 1.6, 'V': 1.4, 'vi': 1.5, 'iii': .8, 'bVII': .7, 'iv': .8, 'bVI': .6, 'bIII': .4, 'bII': .1, '#ivø': 0, 'v': .2 },
        minor: { 'bVI': 1.6, 'bVII': 1.5, 'bIII': 1.4, 'iv': 1.1, 'V': .8, 'iiø': .2, 'IV': .6, 'bII': .2 },
      },
      start: { major: { 'I': .6, 'vi': .25, 'IV': .15 }, minor: MINOR_START },
      p: { sec: [.02, .2], rel: 0, tri: 0, dim: 0 },
      pools: {
        M: [['', .2], ['add9', .5], ['sus2', .55], ['maj7', .8], ['maj9', 1.05]],
        m: [['m', .2], ['m7', .6], ['madd9', .65], ['m9', .95]],
        D: [['', .2], ['sus4', .45], ['7', .7], ['7sus4', .9]],
      },
    },
    chanson: {
      jazzy: false, loop: false, cad: 1,
      bias: {
        major: { 'ii': 1.4, 'V': 1.5, 'vi': 1.3, 'IV': 1.2, 'bVII': .3, 'bIII': .3, 'v': .1, '#ivø': .3 },
        minor: { 'V': 1.8, 'iv': 1.5, 'iiø': 1.2, 'bVI': 1.2, 'bVII': .9, 'v': .3, 'IV': .4 },
      },
      start: { major: { 'I': .75, 'vi': .15, 'ii': .1 }, minor: MINOR_START },
      p: { sec: [.1, .4], rel: .15, tri: 0, dim: .2 },
      pools: {
        M: [['', .2], ['6', .4], ['maj7', .6], ['maj9', .9]],
        m: [['m', .2], ['m7', .5], ['m9', .9]],
        mt: [['m', .2], ['m7', .5], ['m6', .7], ['m9', .9]],
        D: [['7', .2], ['9', .6], ['7b9', .85]],
        Dm: [['7', .2], ['7b9', .6], ['7b13', .85]],
      },
    },
    classical: {
      jazzy: false, loop: false, cad: 1.2,
      bias: {
        major: { 'ii': 1.3, 'V': 1.6, 'IV': 1.3, 'vi': 1.2, 'iii': .6, 'bVII': 0, 'bVI': .5, 'iv': .8, 'bII': .8, 'bIII': .2, 'v': 0, '#ivø': .3 },
        minor: { 'V': 2, 'iv': 1.4, 'iiø': 1.3, 'bVI': 1.3, 'bIII': 1.1, 'bVII': .5, 'v': .2, 'bII': 1.2, 'IV': .3 },
      },
      start: { major: { 'I': .9, 'vi': .1 }, minor: { 'i': 1 } },
      p: { sec: [.1, .45], rel: 0, tri: 0, dim: .3 },
      pools: {
        M: [['', .3], ['add9', .95], ['maj7', 1.15]],
        m: [['m', .3], ['m7', .95]],
        D: [['', .15], ['7', .5], ['7b9', 1.1]],
        Dm: [['', .1], ['7', .45], ['7b9', .9]],
      },
    },
    folk: {
      jazzy: false, loop: false, cad: .6,
      bias: {
        major: { 'IV': 1.8, 'V': 1.5, 'vi': 1.2, 'ii': .8, 'iii': .5, 'bVII': 1.2, 'bVI': .4, 'bIII': .4, 'iv': .4, 'bII': 0, '#ivø': 0, 'v': .5 },
        minor: { 'bVII': 1.8, 'bVI': 1.4, 'bIII': 1.5, 'iv': 1.2, 'v': 1.2, 'V': .5, 'iiø': 0, 'IV': 1.2, 'bII': .1 },
      },
      start: { major: { 'I': .85, 'vi': .1, 'IV': .05 }, minor: MINOR_START },
      p: { sec: [0, .15], rel: 0, tri: 0, dim: 0 },
      pools: {
        M: [['', .3], ['sus2', .65], ['add9', .75], ['maj7', 1.1]],
        m: [['m', .3], ['m7', .8]],
        D: [['', .3], ['sus4', .55], ['7', .75]],
      },
    },
    blues: {
      jazzy: false, loop: false, cad: .8, blues: true, form: 'blues',
      bias: {
        major: { 'IV': 2, 'V': 1.5, 'ii': .6, 'vi': .5, 'iii': .3, 'bVII': .8, 'bIII': .8, 'bVI': .5, 'iv': .6, 'bII': .2, '#ivø': .3, 'v': .2 },
        minor: { 'iv': 2, 'V': 1.6, 'bVI': 1.3, 'bVII': .8, 'bIII': .8, 'v': .6, 'iiø': .5 },
      },
      start: { major: { 'I': 1 }, minor: { 'i': 1 } },
      p: { sec: [.02, .25], rel: .1, tri: .15, dim: .2 },
      pools: {
        M: [['', .1], ['6', .3], ['maj7', .9]],
        m: [['m', .15], ['m7', .4], ['m6', .6], ['m9', .85]],
        D: [['7', .25], ['9', .55], ['13', .75], ['7#9', .95]],
        Dm: [['7', .25], ['7#9', .6], ['7b9', .85]],
      },
    },
    latin: {
      jazzy: false, loop: true, cad: 1,
      bias: {
        major: { 'V': 1.8, 'IV': 1.4, 'ii': 1.3, 'bVII': .4, 'bIII': .3, 'v': .1, '#ivø': 0 },
        minor: { 'V': 2.2, 'iv': 1.6, 'bVI': 1.2, 'iiø': .8, 'bII': .8, 'v': .2, 'IV': .5 },
      },
      start: TONIC_START,
      p: { sec: [.03, .3], rel: .1, tri: 0, dim: .15 },
      pools: {
        M: [['', .2], ['6', .4], ['maj7', .7], ['69', .95]],
        m: [['m', .2], ['m7', .6], ['m9', 1]],
        mt: [['m', .2], ['m6', .5], ['m7', .65]],
        D: [['', .05], ['7', .3], ['9', .65], ['7b9', .85]],
        Dm: [['7', .2], ['7b9', .55], ['7b13', .85]],
      },
    },
    reggae: {
      jazzy: false, loop: true, cad: .3,
      bias: {
        major: { 'IV': 1.8, 'V': 1.3, 'ii': 1.4, 'vi': 1.2, 'iii': .6, 'bVII': .8, 'bVI': .3, 'bIII': .3, 'iv': .4, 'bII': 0, '#ivø': 0, 'v': .6 },
        minor: { 'iv': 1.8, 'v': 1.6, 'bVII': 1.5, 'V': .4, 'iiø': .1, 'IV': .6, 'bII': .2 },
      },
      start: TONIC_START,
      p: NO_ENRICH,
      pools: {
        M: [['', .3], ['6', .65], ['maj7', .85]],
        m: [['m', .3], ['m7', .65], ['m9', 1.05]],
        D: [['', .3], ['7', .7]],
      },
    },
    funk: {
      jazzy: true, loop: true, cad: .3, minBorrow: .8,
      bias: {
        major: { 'IV': 1.5, 'ii': 1.4, 'V': 1.2, 'bVII': 1.5, 'iii': .8, '#ivø': .1, 'v': .5, 'bII': .3 },
        minor: { 'IV': 2.5, 'bVII': 1.5, 'iv': 1.2, 'v': 1.2, 'V': .7, 'iiø': .3, 'bII': .4 },
      },
      start: TONIC_START,
      p: { sec: [.02, .25], rel: .15, tri: .15, dim: 0 },
      pools: {
        M: [['6', .25], ['maj7', .35], ['maj9', .7]],
        m: [['m7', .2], ['m9', .5], ['m11', .8]],
        D: [['7', .15], ['9', .35], ['9sus4', .5], ['13', .65], ['7#9', .85]],
        Dl: [['7', .15], ['9', .35], ['13', .6], ['13#11', .95]],
      },
    },
    soul: {
      jazzy: true, loop: true, cad: .7,
      bias: {
        major: { 'IV': 1.6, 'ii': 1.3, 'V': 1.3, 'vi': 1.2, 'iii': 1.2, 'iv': 1.3, 'bVII': .9, '#ivø': .3, 'v': .3 },
        minor: { 'iv': 1.5, 'bVI': 1.3, 'V': 1.2, 'iiø': .9, 'IV': .9 },
      },
      start: { major: { 'I': .6, 'ii': .1, 'IV': .2, 'vi': .1 }, minor: MINOR_START },
      p: { sec: [.08, .4], rel: .3, tri: .15, dim: .3 },
      pools: {
        M: [['6', .2], ['maj7', .3], ['69', .5], ['maj9', .65], ['maj13', .9]],
        m: [['m7', .2], ['m9', .5], ['m11', .8]],
        mt: [['m7', .2], ['m9', .5], ['m6', .6], ['m11', .8]],
        D: [['7', .15], ['9', .35], ['9sus4', .5], ['13', .6], ['13sus4', .7], ['7b9', .85]],
        Dm: [['7', .1], ['7b13', .3], ['7#9', .5], ['7b9', .65], ['7alt', .95]],
        Dl: DL_POOL, 'ø': HALF_POOL,
      },
    },
    hiphop: {
      jazzy: true, loop: true, cad: .5,
      bias: {
        major: { 'ii': 1.3, 'iii': 1.3, 'IV': 1.5, 'iv': 1.4, 'vi': 1.2, '#ivø': .3, 'v': .3, 'bII': .7 },
        minor: { 'iv': 1.5, 'bVI': 1.3, 'v': 1.3, 'iiø': .8, 'IV': .8 },
      },
      start: { major: { 'I': .5, 'ii': .15, 'IV': .2, 'vi': .15 }, minor: MINOR_START },
      p: { sec: [.02, .35], rel: .35, tri: .3, dim: .1 },
      pools: {
        M: [['maj7', .2], ['6', .3], ['69', .5], ['maj9', .6], ['maj13', .8], ['maj7#11', .95]],
        m: [['m7', .2], ['m9', .5], ['m11', .75], ['m13', .95]],
        mt: [['m7', .2], ['m9', .5], ['m6', .6], ['m11', .75], ['m69', .9]],
        D: [['7', .15], ['9', .35], ['9sus4', .5], ['13', .6], ['13sus4', .7], ['7#9', .85], ['13b9', .95]],
        Dm: [['7', .1], ['7b13', .3], ['7#9', .5], ['7b9', .65], ['7alt', .95]],
        Dl: DL_POOL, 'ø': HALF_POOL,
      },
    },
    trap: {
      jazzy: false, loop: true, cad: .2, minBorrow: .6,
      bias: {
        major: { 'vi': 1.8, 'IV': 1.4, 'iii': 1.2, 'V': .6, 'ii': .7, 'bVI': 1.2, 'bII': .6, '#ivø': 0 },
        minor: { 'bVI': 1.8, 'bII': 1.5, 'iv': 1.3, 'v': 1.3, 'bIII': .9, 'V': .6, 'iiø': .3, 'IV': .3 },
      },
      start: { major: { 'vi': .5, 'I': .35, 'IV': .15 }, minor: MINOR_START },
      p: NO_ENRICH,
      pools: {
        M: [['', .2], ['add9', .5], ['maj7', .65], ['maj9', 1]],
        m: [['m', .2], ['madd9', .45], ['m7', .6], ['m9', .9]],
        D: [['', .2], ['sus4', .4], ['7', .7]],
      },
    },
    electro: {
      jazzy: false, loop: true, cad: .1,
      bias: {
        major: { 'vi': 1.8, 'IV': 1.5, 'bVII': .8, 'bVI': .8, 'ii': .7, '#ivø': 0, 'bII': .1, 'v': .6, 'iv': .6, 'bIII': .6 },
        minor: { 'bVI': 1.5, 'bVII': 1.5, 'bIII': 1.3, 'v': 1.6, 'V': .4, 'iiø': .1, 'bII': .2, 'IV': .7 },
      },
      start: { major: { 'I': .45, 'vi': .4, 'IV': .15 }, minor: MINOR_START },
      p: { sec: [0, .12], rel: 0, tri: 0, dim: 0 },
      pools: {
        M: [['', .1], ['sus2', .35], ['add9', .45], ['6', .55], ['maj7', .7], ['maj9', .85], ['maj7#11', 1]],
        m: [['m', .1], ['madd9', .4], ['m7', .5], ['m9', .75], ['m11', .95]],
        D: [['', .1], ['sus4', .35], ['7sus4', .6], ['9sus4', .8], ['7', .9]],
      },
    },
    house: {
      jazzy: true, loop: true, cad: .3,
      bias: {
        major: { 'ii': 1.5, 'IV': 1.5, 'iii': 1.4, 'vi': 1.4, 'iv': .8, '#ivø': .2, 'v': .3 },
        minor: { 'IV': 2, 'iv': 1.2, 'bVII': 1.4, 'bVI': 1.3, 'bIII': 1.2, 'v': 1.2, 'V': .6, 'iiø': .3 },
      },
      start: { major: { 'I': .4, 'ii': .25, 'IV': .2, 'vi': .15 }, minor: MINOR_START },
      p: { sec: [.02, .25], rel: .2, tri: .1, dim: 0 },
      pools: {
        M: [['maj7', .2], ['6', .35], ['maj9', .5], ['69', .6], ['maj13', .9]],
        m: [['m7', .2], ['m9', .5], ['m11', .8]],
        mt: [['m7', .2], ['m9', .5], ['m6', .65], ['m11', .8]],
        D: [['7', .2], ['7sus4', .3], ['9', .4], ['9sus4', .5], ['13', .7]],
      },
    },
    downtempo: {
      jazzy: false, loop: true, cad: .1,
      bias: {
        major: { 'vi': 1.6, 'IV': 1.5, 'iii': 1.3, 'ii': 1.2, 'V': .6, '#ivø': 0, 'bII': .3 },
        minor: { 'bVI': 1.5, 'iv': 1.4, 'v': 1.4, 'bVII': 1.2, 'bIII': 1.2, 'V': .4, 'iiø': .1, 'IV': 1.2, 'bII': .5 },
      },
      start: { major: { 'I': .45, 'vi': .35, 'IV': .2 }, minor: MINOR_START },
      p: { sec: [0, .1], rel: 0, tri: 0, dim: 0 },
      pools: {
        M: [['maj7', .2], ['add9', .35], ['6', .4], ['maj9', .55], ['maj7#11', .9]],
        m: [['m7', .2], ['madd9', .35], ['m9', .55], ['m11', .85]],
        D: [['sus4', .15], ['7sus4', .3], ['9sus4', .55], ['7', .75]],
      },
    },
    ambient: {
      jazzy: false, loop: true, cad: 0, minBorrow: .7,
      bias: {
        major: { 'IV': 1.8, 'vi': 1.6, 'iii': 1.3, 'ii': 1.1, 'V': .5, 'bVII': 1.2, 'bVI': 1.2, 'bII': .3, '#ivø': 0, 'v': .8, 'iv': .9 },
        minor: { 'bVI': 1.7, 'bIII': 1.4, 'bVII': 1.4, 'iv': 1.2, 'v': 1.2, 'V': .1, 'iiø': .1, 'IV': 1.2, 'bII': .5 },
      },
      start: { major: { 'I': .5, 'vi': .3, 'IV': .2 }, minor: MINOR_START },
      p: NO_ENRICH,
      pools: {
        M: [['', .05], ['sus2', .2], ['add9', .3], ['maj7', .5], ['maj9', .7], ['maj7#11', .9]],
        m: [['m', .05], ['madd9', .3], ['m7', .4], ['m9', .6], ['m11', .85]],
        D: [['', .05], ['sus4', .2], ['7sus4', .5], ['9sus4', .7]],
      },
    },
    metal: {
      jazzy: false, loop: true, cad: .2, minBorrow: 1,
      bias: {
        major: { 'bVII': 2, 'bVI': 2, 'bIII': 2, 'bII': 1.5, 'v': 1.3, 'IV': 1.3, 'ii': .3, 'iii': .5, '#ivø': 0 },
        minor: { 'bII': 5, 'bV': 10, 'bVI': 1.6, 'bVII': 1.5, 'v': 1.5, 'iv': 1.2, 'V': .7, 'iiø': 0, 'bIII': 1.2, 'IV': .6 },
      },
      start: TONIC_START,
      p: NO_ENRICH,
      pools: {
        M: [['5', .2], ['', .75], ['add9', 1.1]],
        m: [['5', .2], ['m', .7], ['madd9', 1]],
        D: [['5', .2], ['', .7], ['7', 1.1]],
      },
    },
    punk: {
      jazzy: false, loop: true, cad: .5,
      bias: {
        major: { 'IV': 1.8, 'V': 1.6, 'vi': 1.2, 'bVII': 1.2, 'ii': .4, 'iii': .5, 'bVI': .8, 'bIII': .8, 'iv': .3, 'bII': .1, '#ivø': 0, 'v': .3 },
        minor: { 'bVII': 1.8, 'bVI': 1.6, 'bIII': 1.5, 'V': .8, 'iiø': 0, 'bII': .3 },
      },
      start: TONIC_START,
      p: NO_ENRICH,
      pools: {
        M: [['5', .15], ['', .5], ['sus4', 1.1]],
        m: [['5', .15], ['m', .5], ['m7', 1.1]],
        D: [['5', .15], ['', .5], ['7', 1]],
      },
    },
    sludge: {
      jazzy: false, loop: true, cad: .1, minBorrow: 1,
      bias: {
        major: { 'bIII': 2.2, 'bVII': 2, 'bVI': 1.8, 'bII': 1.5, 'IV': 1.3, 'ii': .3, 'iii': .3, 'vi': .7, '#ivø': 0 },
        minor: { 'bII': 5, 'bV': 9, 'bVI': 1.5, 'bIII': 1.5, 'bVII': 1.2, 'iv': 1.2, 'V': .3, 'iiø': 0 },
      },
      start: TONIC_START,
      p: NO_ENRICH,
      pools: {
        M: [['5', .25], ['', .8], ['sus2', 1.1]],
        m: [['5', .25], ['m', .8], ['m7', 1.1]],
        D: [['5', .25], ['', .8], ['7', 1.1]],
      },
    },
    stoner: {
      jazzy: false, loop: true, cad: .2, minBorrow: .9,
      bias: {
        major: { 'bVII': 2.5, 'bIII': 2, 'IV': 1.8, 'bVI': 1.2, 'v': 1.2, 'V': .8, 'ii': .4, 'iii': .3, 'vi': .7, 'bII': .2, '#ivø': 0, 'iv': .5 },
        minor: { 'IV': 2.2, 'bVII': 2, 'bIII': 1.8, 'bVI': 1.2, 'V': .4, 'iiø': 0, 'bII': .6, 'bV': 1.5 },
      },
      start: TONIC_START,
      p: NO_ENRICH,
      pools: {
        M: [['5', .15], ['', .5], ['7', .85], ['add9', 1.1]],
        m: [['5', .15], ['m', .5], ['m7', .85]],
        D: [['5', .15], ['', .5], ['7', .8], ['7#9', 1.1]],
      },
    },
  };

  const FAMILIES = [
    ['rock', 'Rock'], ['metal', 'Metal'], ['pop', 'Pop'], ['electro', 'Électronique'], ['hiphop', 'Hip-hop / R&B'],
    ['jazz', 'Jazz / Blues'], ['world', 'Musiques du monde'], ['folk', 'Folk / Country'], ['classique', 'Classique / Orchestral'],
  ];

  // [clé, nom, archétype, accompagnement, batterie, tempo, retouches]
  // Retouches : champs de l'archétype à remplacer ; bias, p et pools se fusionnent ; timbre remplace celui de l'accompagnement.
  const CATALOG = {
    rock: [
      ['rock-classique', 'Rock classique', 'rock', 'rock', 'rock', 120],
      ['hard-rock', 'Hard rock', 'stoner', 'punk', 'rock', 132],
      ['punk', 'Punk', 'punk', 'punk', 'punk', 176],
      ['post-punk', 'Post-punk', 'rock', 'rock', 'rock', 148, { bias: { major: { 'vi': 1.6, 'iii': 1.2, 'bVII': 1.2 }, minor: { 'bVI': 2, 'bII': .8 } } }],
      ['new-wave', 'New wave', 'pop', 'rock', 'rock', 136, { timbre: 'synth' }],
      ['grunge', 'Grunge', 'stoner', 'rock', 'rock', 116, { timbre: 'dist', bias: { major: { 'bVI': 1.8, 'bIII': 2, 'bII': .8 }, minor: { 'bII': 1.5, 'bVI': 1.8 } } }],
      ['indie', 'Indie', 'pop', 'rock', 'rock', 124, { cshift: .1 }],
      ['rock-alternatif', 'Rock alternatif', 'rock', 'rock', 'rock', 126, { timbre: 'dist', bias: { major: { 'bVI': 1.8, 'iv': 1 }, minor: { 'bII': .8 } } }],
      ['shoegaze', 'Shoegaze', 'ambient', 'rock', 'rock', 110, { timbre: 'pad', cshift: .1 }],
      ['post-rock', 'Post-rock', 'ambient', 'ballad', 'rock', 100, { timbre: 'guitar', loop: false }],
      ['prog-rock', 'Prog', 'rock', 'pop', 'rock', 118, { meter: '7/8', loop: false, minBorrow: 1.2, cshift: .15, p: { sec: [.05, .3] } }],
      ['psychedelique', 'Psychédélique', 'rock', 'pop', 'rock', 104, { timbre: 'guitar', minBorrow: 1.2, bias: { major: { 'bVII': 2.8, 'v': 1.5 }, minor: { 'IV': 2 } } }],
      ['garage', 'Garage', 'punk', 'punk', 'rock', 150],
      ['stoner-rock', 'Stoner rock', 'stoner', 'stoner', 'stoner', 96],
      ['rockabilly', 'Rockabilly', 'blues', 'boogie', 'shuffle', 168, { timbre: 'guitar' }],
    ],
    metal: [
      ['heavy-metal', 'Heavy metal', 'metal', 'metal', 'metal', 140, { bias: { minor: { 'bV': 2, 'bII': 2, 'bVI': 2, 'bVII': 2 } } }],
      ['power-metal', 'Power metal', 'metal', 'metal', 'metal', 170, { bias: { minor: { 'bV': 0, 'bII': .8, 'bVI': 2.2, 'bVII': 2.2, 'bIII': 1.6, 'V': 1.2 } } }],
      ['thrash', 'Thrash', 'metal', 'metal', 'punk', 190],
      ['death-metal', 'Death metal', 'metal', 'metal', 'blast', 200, { bias: { minor: { 'bV': 12, 'bII': 6 } } }],
      ['black-metal', 'Black metal', 'metal', 'metal', 'blast', 180, { pools: { m: [['5', .1], ['m', .3], ['madd9', .9]] }, bias: { minor: { 'bVI': 2.2, 'iv': 1.6 } } }],
      ['doom', 'Doom', 'sludge', 'sludge', 'sludge', 60],
      ['sludge', 'Sludge', 'sludge', 'sludge', 'sludge', 68],
      ['stoner-metal', 'Stoner metal', 'stoner', 'stoner', 'stoner', 84],
      ['prog-metal', 'Prog', 'metal', 'djent', 'djent', 130, { meter: '7/8', loop: false, minBorrow: 1.3, cshift: .25, bias: { minor: { 'bV': 3, 'bII': 2.5 } } }],
      ['djent', 'Djent', 'metal', 'djent', 'djent', 120, { bias: { minor: { 'bII': 6, 'bV': 6 } } }],
      ['pagan-metal', 'Pagan metal', 'metal', 'metal', 'metal', 150, { bias: { minor: { 'bV': 0, 'bII': .5, 'bVII': 2.5, 'bVI': 2, 'bIII': 2, 'iv': 1.5 } } }],
      ['folk-metal', 'Folk metal', 'metal', 'metal', 'punk', 160, { bias: { minor: { 'bV': 0, 'bII': .5, 'bVII': 2.5, 'bVI': 2, 'bIII': 2, 'iv': 1.5 } } }],
      ['nu-metal', 'Nu metal', 'sludge', 'djent', 'djent', 100],
      ['metalcore', 'Metalcore', 'metal', 'djent', 'djent', 150],
      ['industrial-metal', 'Industrial metal', 'metal', 'metal', 'techno', 125],
    ],
    pop: [
      ['pop', 'Pop', 'pop', 'pop', 'rock', 112],
      ['synthpop', 'Synthpop', 'pop', 'pop', 'electro', 118, { timbre: 'synth' }],
      ['dream-pop', 'Dream pop', 'ambient', 'ballad', 'rock', 92, { timbre: 'pad' }],
      ['electropop', 'Électropop', 'pop', 'electro', 'electro', 124],
      ['k-pop', 'K-pop', 'pop', 'pop', 'electro', 120, { timbre: 'synth', cshift: .15, p: { sec: [.05, .3] } }],
      ['j-pop', 'J-pop', 'chanson', 'pop', 'rock', 132, { loop: true, bias: { major: { 'IV': 1.8, 'iii': 1.6, 'vi': 1.6 } } }],
      ['variete-francaise', 'Variété française', 'chanson', 'pop', 'rock', 104],
      ['chanson', 'Chanson', 'chanson', 'folk', 'acoustic', 96, { timbre: 'pluck' }],
      ['yeye', 'Yéyé', 'pop', 'rock', 'rock', 138, { bias: { major: { 'vi': 1.6, 'V': 1.6, 'bVII': .2 } } }],
      ['disco', 'Disco', 'house', 'disco', 'disco', 120],
    ],
    electro: [
      ['house', 'House', 'house', 'disco', 'disco', 124],
      ['deep-house', 'Deep house', 'house', 'stab', 'disco', 120, { cshift: .15 }],
      ['acid-house', 'Acid house', 'electro', 'trance', 'techno', 126, { timbre: 'synth' }],
      ['progressive-house', 'Progressive house', 'ambient', 'electro', 'electro', 126],
      ['techno', 'Techno', 'electro', 'stab', 'techno', 132, { timbre: 'synth', cshift: -.15 }],
      ['trance', 'Trance', 'pop', 'trance', 'electro', 138, { timbre: 'synth' }],
      ['drum-and-bass', 'Drum & bass', 'downtempo', 'ballad', 'dnb', 172, { timbre: 'pad' }],
      ['jungle', 'Jungle', 'downtempo', 'stab', 'dnb', 165],
      ['dubstep', 'Dubstep', 'trap', 'ballad', 'halftime', 140, { timbre: 'synth' }],
      ['ambient', 'Ambient', 'ambient', 'ballad', 'orch', 70, { timbre: 'pad' }],
      ['idm', 'IDM', 'ambient', 'stab', 'breaks', 110, { minBorrow: 1.2, cshift: .1 }],
      ['electro', 'Electro', 'electro', 'electro', 'electro', 122],
      ['hardstyle', 'Hardstyle', 'electro', 'trance', 'techno', 150, { timbre: 'synth' }],
      ['uk-garage', 'UK garage', 'house', 'stab', 'breaks', 132],
      ['synthwave', 'Synthwave', 'pop', 'rock', 'electro', 100, { timbre: 'synth' }],
      ['trip-hop', 'Trip-hop', 'downtempo', 'downtempo', 'downtempo', 80],
      ['downtempo', 'Downtempo', 'downtempo', 'downtempo', 'downtempo', 88],
      ['breakbeat', 'Breakbeat', 'house', 'stab', 'breaks', 130],
      ['ebm', 'EBM', 'electro', 'rock', 'techno', 124, { timbre: 'synth', cshift: -.15 }],
      ['industrial', 'Industrial', 'sludge', 'rock', 'techno', 118, { timbre: 'dist' }],
    ],
    hiphop: [
      ['rap', 'Rap', 'hiphop', 'hiphop', 'hiphop', 92],
      ['trap', 'Trap', 'trap', 'trap', 'trap', 140],
      ['boom-bap', 'Boom bap', 'hiphop', 'hiphop', 'hiphop', 90],
      ['drill', 'Drill', 'trap', 'trap', 'drill', 142, { bias: { minor: { 'bII': 2.5 } } }],
      ['lofi-hip-hop', 'Lo-fi hip-hop', 'hiphop', 'downtempo', 'downtempo', 78, { cshift: .1 }],
      ['rap-conscient', 'Rap conscient', 'soul', 'hiphop', 'hiphop', 88],
      ['rnb', 'R&B', 'soul', 'pop', 'hiphop', 96, { timbre: 'keys' }],
      ['soul', 'Soul', 'soul', 'pop', 'funk', 104, { timbre: 'keys' }],
      ['neo-soul', 'Néo-soul', 'hiphop', 'hiphop', 'hiphop', 84, { cshift: .15 }],
      ['funk', 'Funk', 'funk', 'funk', 'funk', 108],
    ],
    jazz: [
      ['jazz', 'Jazz', 'jazz', 'jazz', 'jazz', 132],
      ['bebop', 'Bebop', 'jazz', 'jazz', 'jazz', 200, { cshift: .15, p: { sec: [.2, .6] } }],
      ['swing', 'Swing', 'jazz', 'manouche', 'jazz', 160, { timbre: 'keys', cshift: -.15 }],
      ['cool-jazz', 'Cool jazz', 'jazz', 'jazz', 'jazz', 112, { cshift: .05 }],
      ['jazz-fusion', 'Jazz fusion', 'funk', 'funk', 'funk', 116, { timbre: 'keys', cshift: .2 }],
      ['free-jazz', 'Free jazz', 'jazz', 'jazz', 'jazz', 150, { minBorrow: 2, cshift: .3, cad: 0 }],
      ['acid-jazz', 'Acid jazz', 'funk', 'funk', 'breaks', 104, { timbre: 'keys' }],
      ['jazz-manouche', 'Jazz manouche', 'jazz', 'manouche', 'jazz', 190, { cshift: -.1, p: { dim: .5, tri: .1 },
        pools: { M: [['6', .2], ['69', .5], ['maj7', .7]], mt: [['m6', .25], ['m69', .6], ['m7', .7]] } }],
      ['blues', 'Blues', 'blues', 'boogie', 'shuffle', 96, { timbre: 'guitar', meter: '12/8' }],
      ['gospel', 'Gospel', 'soul', 'pop', 'rock', 100, { timbre: 'keys', meter: '12/8', p: { sec: [.15, .45], dim: .4 } }],
      ['boogie-woogie', 'Boogie-woogie', 'blues', 'boogie', 'shuffle', 160],
    ],
    world: [
      ['reggae', 'Reggae', 'reggae', 'reggae', 'reggae', 76],
      ['dub', 'Dub', 'reggae', 'reggae', 'reggae', 70],
      ['ska', 'Ska', 'reggae', 'ska', 'ska', 150],
      ['dancehall', 'Dancehall', 'reggae', 'stab', 'dembow', 96],
      ['afrobeat', 'Afrobeat', 'funk', 'funk', 'afrobeat', 112],
      ['salsa', 'Salsa', 'latin', 'montuno', 'latin', 170],
      ['bossa-nova', 'Bossa nova', 'bossa', 'bossa', 'bossa', 126],
      ['flamenco', 'Flamenco', 'latin', 'folk', 'world', 120, { timbre: 'pluck', minBorrow: 1, bias: { minor: { 'bVII': 2, 'bVI': 2.2, 'bII': 3, 'iv': 1 } } }],
      ['rumba', 'Rumba', 'latin', 'folk', 'latin', 110, { timbre: 'pluck' }],
      ['rai', 'Raï', 'pop', 'pop', 'world', 100, { timbre: 'synth', bias: { minor: { 'bII': 1.5, 'V': 1.4 } } }],
      ['fado', 'Fado', 'chanson', 'folk', 'orch', 84, { timbre: 'pluck' }],
      ['cumbia', 'Cumbia', 'latin', 'ska', 'cumbia', 96, { cshift: -.15 }],
      ['tango', 'Tango', 'latin', 'tango', 'orch', 120, { loop: false, p: { sec: [.1, .4], dim: .3 } }],
      ['celtique', 'Musique celtique', 'folk', 'folk', 'acoustic', 116, { timbre: 'pluck', meter: '6/8' }],
      ['gnawa', 'Gnawa', 'folk', 'stoner', 'world', 100, { timbre: 'guitar', meter: '6/8', loop: true, bias: { minor: { 'bVII': 2.5, 'iv': 1.5, 'IV': 1.5 } } }],
      ['balkanique', 'Musique balkanique', 'latin', 'ska', 'ska', 150, { meter: '7/8', minBorrow: 1, bias: { minor: { 'bII': 2.5, 'bVII': 1.5, 'bVI': 1.6 } } }],
    ],
    folk: [
      ['folk', 'Folk', 'folk', 'folk', 'acoustic', 104, { timbre: 'pluck' }],
      ['country', 'Country', 'folk', 'country', 'acoustic', 116, { timbre: 'guitar', bias: { major: { 'bVII': .5 } }, pools: { D: [['', .2], ['7', .5]] } }],
      ['bluegrass', 'Bluegrass', 'folk', 'country', 'orch', 150, { timbre: 'pluck' }],
      ['americana', 'Americana', 'folk', 'folk', 'rock', 100, { timbre: 'guitar' }],
      ['musette', 'Musette', 'chanson', 'tango', 'acoustic', 132, { timbre: 'organ', meter: '3/4' }],
      ['chanson-a-texte', 'Chanson à texte', 'chanson', 'folk', 'orch', 88, { timbre: 'pluck' }],
      ['neo-folk', 'Néo-folk', 'folk', 'ballad', 'acoustic', 84, { timbre: 'pluck', cshift: .1 }],
    ],
    classique: [
      ['baroque', 'Baroque', 'classical', 'baroque', 'orch', 96, { timbre: 'pluck', p: { sec: [.2, .5] } }],
      ['classique', 'Classique', 'classical', 'hymn', 'orch', 108],
      ['romantique', 'Romantique', 'classical', 'hymn', 'orch', 76, { cshift: .2, minBorrow: 1 }],
      ['opera', 'Opéra', 'classical', 'hymn', 'orch', 84, { timbre: 'strings' }],
      ['contemporaine', 'Musique contemporaine', 'jazz', 'hymn', 'orch', 72, { timbre: 'strings', minBorrow: 2, cshift: .35, cad: 0 }],
      ['minimalisme', 'Minimalisme', 'ambient', 'rock', 'orch', 120, { timbre: 'keys', cshift: -.1 }],
      ['bande-originale', 'Bande originale', 'ambient', 'hymn', 'orch', 90, { timbre: 'strings', bias: { minor: { 'bVI': 2, 'bVII': 1.6, 'V': .8 } } }],
    ],
  };

  const STYLES = {};
  for (const fam in CATALOG) for (const [key, label, arch, comp, drums, tempo, over] of CATALOG[fam]) {
    const A = ARCH[arch], o = over || {};
    STYLES[key] = Object.assign({}, A, o, {
      label, family: fam, arch, comp, drums, tempo,
      bias: { major: Object.assign({}, A.bias.major, (o.bias || {}).major), minor: Object.assign({}, A.bias.minor, (o.bias || {}).minor) },
      p: Object.assign({}, A.p, o.p),
      pools: Object.assign({}, A.pools, o.pools),
    });
  }

  // ---------- Ambiances ----------
  // Une ambiance fait deux choses :
  //  - elle pose un ensemble de réglages visibles (set), que l'utilisateur peut ensuite modifier : mode, tempo, brillance
  //    et réglages des instruments. Chaque set complète les valeurs neutres de MOOD_BASE ;
  //  - elle oriente l'harmonie, comme le fait un style : borrow (poids des emprunts), sec (fréquence des dominantes
  //    secondaires), bias (degrés favorisés), q (décalage de couleur par famille d'accord : M, m, D).
  // set — minor : mode proposé. tempo : facteur sur le tempo du style. bright : brillance du son (0..1).
  //   chords : color, dens (densité de l'accompagnement), dyn, vol, reg (registre −1/0/1), vari.
  //   mel : play (slow/mid/fast), air, octave, contour (up/down/free), color, dyn, vari.
  //   drums : play (soft/mid/high), color, vari, dyn, vol. bass : color, dyn, vol.

  const MOOD_BASE = {
    tempo: 1, bright: .5,
    chords: { color: .5, dens: .5, dyn: .5, vol: .8, reg: 0, vari: .15 },
    bass: { color: .5, dyn: .5, vol: .8 },
    mel: { play: 'mid', air: .25, octave: 0, contour: 'free', color: .5, dyn: .5, vari: .3 },
    drums: { play: 'mid', color: .5, vari: .15, dyn: .5, vol: .8 },
  };
  const MOOD_GROUPS = [['lum', 'Lumineuses'], ['paix', 'Paisibles'], ['tendre', 'Tendres'], ['triste', 'Tristes'], ['sombre', 'Sombres'], ['intense', 'Intenses']];

  const MOODS = {
    neutre: { label: 'Neutre', set: {} },

    joyeuse: { label: 'Joyeuse', group: 'lum', borrow: .4,
      bias: { major: { 'IV': 1.4, 'V': 1.4, 'ii': 1.1, 'vi': .8 } },
      set: { minor: false, tempo: 1.08, bright: .7, chords: { color: .4, dens: .6, dyn: .6 }, mel: { air: .2, contour: 'up' }, drums: { color: .55, dyn: .6 } } },
    espiegle: { label: 'Espiègle', group: 'lum', sec: 1.4,
      bias: { major: { 'ii': 1.3, 'bVII': 1.2, '#ivø': 1.5 } },
      set: { minor: false, tempo: 1.12, bright: .75, chords: { color: .55, dens: .7, dyn: .75, vari: .5 }, mel: { play: 'fast', air: .45, octave: 1, vari: .6 }, drums: { color: .7, vari: .5, dyn: .6 } } },
    triomphante: { label: 'Triomphante', group: 'lum',
      bias: { major: { 'IV': 1.6, 'V': 1.6, 'bVII': 1.4, 'bVI': 1.3 } },
      set: { minor: false, bright: .85, chords: { color: .3, dens: .6, dyn: .8, vol: .9 }, mel: { play: 'slow', air: .2, octave: 1, contour: 'up', dyn: .8 }, drums: { play: 'high', dyn: .85, vol: .9 } } },
    festive: { label: 'Festive', group: 'lum', borrow: .6,
      bias: { major: { 'IV': 1.4, 'V': 1.4 } },
      set: { minor: false, tempo: 1.15, bright: .8, chords: { color: .45, dens: .85, dyn: .7 }, mel: { play: 'fast' }, drums: { play: 'high', color: .8, vari: .4, dyn: .7 } } },

    calme: { label: 'Calme', group: 'paix', borrow: .5, sec: .5, q: { D: -.1 },
      bias: { major: { 'IV': 1.3, 'vi': 1.2, 'V': .8 }, minor: { 'bIII': 1.3, 'bVII': 1.2, 'V': .7 } },
      set: { tempo: .86, bright: .4, chords: { color: .4, dens: .15, dyn: .3 }, mel: { play: 'slow', air: .4, dyn: .3 }, drums: { play: 'soft', color: .35, dyn: .35, vol: .65 } } },
    sereine: { label: 'Sereine', group: 'paix', borrow: .3, sec: .3, q: { M: .1 },
      bias: { major: { 'IV': 1.8, 'iii': 1.2, 'V': .6 } },
      set: { minor: false, tempo: .82, chords: { dens: .1, dyn: .25 }, mel: { play: 'slow', air: .5, dyn: .3 }, drums: { play: 'soft', color: .2, dyn: .3, vol: .55 } } },
    reveuse: { label: 'Rêveuse', group: 'paix', borrow: 1.3, sec: .4, q: { M: .25, m: .15 },
      bias: { major: { 'IV': 1.6, 'bVII': 1.4, 'iii': 1.4, 'V': .4, 'bVI': 1.3 }, minor: { 'bVI': 1.6, 'bIII': 1.4, 'V': .3 } },
      set: { tempo: .8, bright: .45, chords: { color: .7, dens: .1, dyn: .3, reg: 1 }, mel: { play: 'slow', air: .55, octave: 1, dyn: .3 }, drums: { play: 'soft', color: .3, vol: .5 } } },
    contemplative: { label: 'Contemplative', group: 'paix', sec: .2,
      bias: { major: { 'IV': 1.6, 'vi': 1.4, 'V': .4 }, minor: { 'bVI': 1.5, 'iv': 1.3, 'V': .3 } },
      set: { tempo: .72, bright: .4, chords: { color: .6, dens: 0, dyn: .2 }, mel: { play: 'slow', air: .7, dyn: .25 }, drums: { play: 'soft', color: .1, dyn: .3, vol: .4 } } },

    romantique: { label: 'Romantique', group: 'tendre', q: { D: .1, M: .05 },
      bias: { major: { 'iv': 2, 'vi': 1.3, 'iii': 1.3, 'bVI': 1.3, 'ii': 1.2 }, minor: { 'iv': 1.3, 'bVI': 1.4, 'V': 1.2, 'bIII': 1.2 } },
      set: { tempo: .84, bright: .45, chords: { color: .6, dens: .35, dyn: .45 }, mel: { air: .3, dyn: .55 }, drums: { play: 'soft', color: .4, vol: .65 } } },
    poetique: { label: 'Poétique', group: 'tendre', borrow: 1.2, sec: .6, q: { M: .2, m: .1 },
      bias: { major: { 'IV': 1.4, 'iii': 1.5, 'bVII': 1.3, 'bIII': 1.3, 'bVI': 1.4, 'V': .6 }, minor: { 'bVI': 1.4, 'bIII': 1.3, 'IV': 1.6, 'v': 1.3, 'V': .6 } },
      set: { tempo: .8, chords: { color: .65, dens: .1, dyn: .35 }, mel: { play: 'slow', air: .5, octave: 1 }, drums: { play: 'soft', color: .15, vol: .5 } } },
    tendre: { label: 'Tendre', group: 'tendre', borrow: .6, q: { M: .1 },
      bias: { major: { 'IV': 1.5, 'vi': 1.3, 'iii': 1.3, 'ii': 1.2, 'V': .8 } },
      set: { minor: false, tempo: .8, bright: .4, chords: { dens: .2, dyn: .3 }, mel: { play: 'slow', air: .4, dyn: .35 }, drums: { play: 'soft', color: .2, vol: .5 } } },
    sensuelle: { label: 'Sensuelle', group: 'tendre', sec: 1.2, q: { D: .2, m: .15 },
      bias: { major: { 'ii': 1.4, 'iv': 1.5, 'bVII': 1.2 }, minor: { 'iv': 1.5, 'IV': 1.5, 'bVI': 1.3 } },
      set: { tempo: .78, bright: .35, chords: { color: .75, dens: .4, reg: -1 }, mel: { air: .45 }, drums: { play: 'soft', color: .7, vari: .3, vol: .7 } } },

    melancolique: { label: 'Mélancolique', group: 'triste', sec: .8, q: { m: .15 },
      bias: { major: { 'vi': 1.8, 'iv': 2, 'iii': 1.4, 'bVI': 1.5, 'V': .8 }, minor: { 'iv': 1.5, 'bVI': 1.4, 'v': 1.3 } },
      set: { minor: true, tempo: .78, bright: .3, chords: { color: .55, dens: .1, dyn: .3 }, mel: { play: 'slow', air: .45, contour: 'down', dyn: .35 }, drums: { play: 'soft', color: .15, vol: .6 } } },
    nostalgique: { label: 'Nostalgique', group: 'triste', borrow: 1.1, q: { M: .15 },
      bias: { major: { 'iv': 2.2, 'vi': 1.4, 'iii': 1.3, 'IV': 1.3 }, minor: { 'bIII': 1.5, 'bVI': 1.4, 'iv': 1.3, 'IV': 1.2 } },
      set: { tempo: .82, bright: .4, chords: { color: .6, dens: .3, dyn: .4 }, mel: { air: .4, contour: 'down' }, drums: { play: 'soft', color: .35, vol: .6 } } },
    triste: { label: 'Triste', group: 'triste', borrow: .5, sec: .4,
      bias: { minor: { 'iv': 1.6, 'bVI': 1.5, 'v': 1.4, 'V': .6, 'bVII': .8 }, major: { 'vi': 2, 'iv': 1.8, 'iii': 1.4 } },
      set: { minor: true, tempo: .72, bright: .25, chords: { color: .3, dens: .05, dyn: .25 }, mel: { play: 'slow', air: .5, contour: 'down', dyn: .3 }, drums: { play: 'soft', color: .1, vol: .5 } } },
    desolee: { label: 'Désolée', group: 'triste', sec: .2,
      bias: { minor: { 'iv': 1.6, 'bVI': 1.6, 'bII': 1.5, 'v': 1.3, 'V': .3 }, major: { 'vi': 2, 'iv': 2, 'bVI': 1.6 } },
      set: { minor: true, tempo: .62, bright: .2, chords: { color: .35, dens: 0, dyn: .15, reg: -1 }, mel: { play: 'slow', air: .75, octave: -1, contour: 'down', dyn: .2 }, drums: { play: 'soft', color: 0, dyn: .2, vol: .3 } } },
    funebre: { label: 'Funèbre', group: 'triste', borrow: .7, q: { m: -.2, M: -.2 },
      bias: { minor: { 'iv': 1.8, 'V': 1.4, 'bVI': 1.2, 'bII': 1.3 }, major: { 'vi': 1.8, 'iv': 2 } },
      set: { minor: true, tempo: .58, bright: .2, chords: { color: .1, dens: .1, dyn: .4, reg: -1 }, mel: { play: 'slow', air: .6, octave: -1, contour: 'down' }, drums: { play: 'soft', color: 0, vol: .6 } } },

    sombre: { label: 'Sombre', group: 'sombre', borrow: 1.6, sec: .7,
      bias: { minor: { 'bII': 6, 'bVI': 1.8, 'v': 1.4, 'iv': 1.3, 'V': .7 }, major: { 'bVI': 2.5, 'bII': 5, 'bIII': 1.8, 'iv': 2 } },
      set: { minor: true, tempo: .9, bright: .2, chords: { color: .45, dens: .4, reg: -1 }, mel: { air: .4, octave: -1, contour: 'down' }, drums: { color: .3, vol: .75 } } },
    mysterieuse: { label: 'Mystérieuse', group: 'sombre', borrow: 1.8, sec: .5, q: { M: .35, D: .2 },
      bias: { major: { 'bVI': 1.8, 'bII': 1.6, '#ivø': 2, 'IV': 1.4, 'V': .3, 'bIII': 1.4 }, minor: { 'bII': 1.8, 'bVI': 1.5, 'IV': 1.6, 'V': .3 } },
      set: { tempo: .85, bright: .35, chords: { color: .8, dens: .15, dyn: .3 }, mel: { play: 'slow', air: .6 }, drums: { play: 'soft', vari: .5, vol: .5 } } },
    inquiete: { label: 'Inquiète', group: 'sombre', borrow: 1.4, sec: 1.6, q: { D: .4 },
      bias: { minor: { 'iiø': 1.8, 'V': 1.6, 'bII': 1.6, 'bVI': 1.2 }, major: { 'bII': 1.6, 'iv': 1.6, '#ivø': 2 } },
      set: { minor: true, tempo: 1.05, chords: { color: .75, dens: .6, dyn: .6, vari: .6 }, mel: { play: 'fast', air: .5, vari: .7 }, drums: { color: .6, vari: .7 } } },
    menacante: { label: 'Menaçante', group: 'sombre', borrow: 2, q: { D: .35 },
      bias: { minor: { 'bII': 8, 'bV': 8, 'bVI': 1.5, 'v': 1.3 }, major: { 'bII': 8, 'bVI': 2, 'bIII': 1.8 } },
      set: { minor: true, tempo: .88, bright: .3, chords: { color: .4, dens: .7, dyn: .75, vol: .9, reg: -1 }, mel: { play: 'slow', air: .5, octave: -1, contour: 'down' }, drums: { play: 'high', color: .3, dyn: .8, vol: .9 } } },

    anime: { label: 'Animée', group: 'intense', sec: 1.5,
      bias: { major: { 'ii': 1.2, 'V': 1.2 }, minor: { 'iiø': 1.2, 'V': 1.2 } },
      set: { tempo: 1.08, bright: .6, chords: { color: .6, dens: .8, dyn: .55, vari: .4 }, mel: { play: 'fast', air: .2 }, drums: { play: 'high', color: .75, vari: .4 } } },
    energique: { label: 'Énergique', group: 'intense',
      bias: { major: { 'V': 1.2, 'IV': 1.2, 'bVII': 1.3 }, minor: { 'bVII': 1.3, 'V': 1.2 } },
      set: { tempo: 1.12, bright: .75, chords: { color: .45, dens: .7, dyn: .7, vol: .85 }, mel: { air: .2, dyn: .7 }, drums: { play: 'high', dyn: .7, vol: .9 } } },
    colere: { label: 'En colère', group: 'intense', borrow: 1.6, sec: .8, q: { D: .35 },
      bias: { major: { 'bII': 3, 'bVI': 1.8, 'bIII': 1.8, 'bVII': 1.5, 'v': 1.5 }, minor: { 'bII': 3, 'v': 1.3, 'bVI': 1.3, 'V': 1.2 } },
      set: { minor: true, tempo: 1.2, bright: 1, chords: { color: .4, dens: .9, dyn: .9, vol: .95 }, mel: { play: 'fast', air: .3, dyn: .85 }, drums: { play: 'high', color: .4, dyn: .95, vol: 1 } } },
    epique: { label: 'Épique', group: 'intense', borrow: 1.4,
      bias: { minor: { 'bVI': 2, 'bVII': 1.8, 'bIII': 1.6, 'iv': 1.2 }, major: { 'bVI': 1.8, 'bVII': 1.8, 'IV': 1.4 } },
      set: { minor: true, bright: .7, chords: { color: .4, dens: .65, dyn: .8, vol: .9 }, mel: { play: 'slow', octave: 1, contour: 'up', dyn: .8 }, drums: { play: 'high', dyn: .85, vol: .9 } } },
    euphorique: { label: 'Euphorique', group: 'intense', borrow: .6,
      bias: { major: { 'IV': 1.6, 'V': 1.3, 'vi': 1.4 } },
      set: { minor: false, tempo: 1.2, bright: .9, chords: { dens: .9, dyn: .75 }, mel: { play: 'fast', air: .15, octave: 1, contour: 'up', dyn: .75 }, drums: { play: 'high', color: .8, dyn: .8, vol: .95 } } },
  };

  // Les réglages complets qu'une ambiance pose : ceux de MOOD_BASE, remplacés par les siens.
  function moodPreset(id) {
    const set = (MOODS[id] || MOODS.neutre).set, out = { minor: set.minor, tempo: set.tempo || MOOD_BASE.tempo, bright: set.bright == null ? MOOD_BASE.bright : set.bright };
    for (const part of ['chords', 'bass', 'mel', 'drums']) out[part] = Object.assign({}, MOOD_BASE[part], set[part]);
    return out;
  }

  // ---------- Signatures rythmiques ----------
  // groups : la mesure découpée en temps, comptés en croches (2 = noire, 3 = noire pointée).
  // map : pour chaque temps, le temps d'une mesure à 4/4 dont on reprend les motifs de batterie et d'accompagnement.
  const METERS = {
    '2/4': { label: '2/4', groups: [2, 2], map: [0, 1] },
    '3/4': { label: '3/4', groups: [2, 2, 2], map: [0, 1, 3] },
    '4/4': { label: '4/4', groups: [2, 2, 2, 2], map: [0, 1, 2, 3] },
    '5/4': { label: '5/4', groups: [2, 2, 2, 2, 2], map: [0, 1, 2, 1, 3] },
    '6/8': { label: '6/8', groups: [3, 3], map: [0, 1] },
    '7/8': { label: '7/8', groups: [2, 2, 3], map: [0, 1, 3] },
    '9/8': { label: '9/8', groups: [3, 3, 3], map: [0, 1, 3] },
    '12/8': { label: '12/8', groups: [3, 3, 3, 3], map: [0, 1, 2, 3] },
  };
  // L : croches par mesure ; B16 : doubles croches par mesure ; starts : début de chaque temps (en croches) ;
  // split : où se coupe une demi-mesure (sur un temps) ; compound : mesure à temps ternaires, sans swing.
  function meterInfo(id) {
    const M = METERS[id] || METERS['4/4'], starts = [];
    let L = 0;
    for (const g of M.groups) { starts.push(L); L += g; }
    let split = 0;
    for (const g of M.groups) { if (split * 2 >= L) break; split += g; }
    const [num, den] = (METERS[id] ? id : '4/4').split('/').map(Number);
    return Object.assign({ id: METERS[id] ? id : '4/4', num, den, L, B16: 2 * L, starts, starts16: starts.map(x => x * 2), split, compound: M.groups.includes(3) }, M);
  }

  // ---------- Utilitaires ----------

  function rngFrom(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pickWeighted(rng, items) { // items : [valeur, poids]
    let sum = 0;
    for (const it of items) sum += it[1];
    let r = rng() * sum;
    for (const it of items) { r -= it[1]; if (r <= 0) return it[0]; }
    return items[items.length - 1][0];
  }

  const R = id => id.replace(/b/g, '♭').replace('#', '♯');
  const modeName = G => (G.key.minor ? 'minor' : 'major');
  const D = (G, id) => DEG[modeName(G)][id];
  const typeOf = (G, id) => {
    const d = D(G, id), S = STYLES[G.style];
    if (S.blues && !G.key.minor && (id === 'I' || id === 'IV')) return 'D'; // blues : I7 et IV7
    return (S.jazzy && d.tj) || d.t;
  };
  const isMinorType = t => t === 'm' || t === 'mt' || t === 'ø';
  const isDomType = t => t === 'D' || t === 'Dm' || t === 'Dl';
  const isTonic = id => id === 'I' || id === 'i';
  const colorFactor = c => .15 + 1.7 * c;

  function makeG(o, rng) {
    const mood = MOODS[o.mood] || MOODS.neutre;
    const mt = meterInfo(o.meter);
    return { key: makeKey(o.tonic, o.minor), style: o.style, mood, mt, barBeats: mt.L / 2, c: Math.max(0, Math.min(1, o.color + (STYLES[o.style].cshift || 0))), rng: rng || Math.random };
  }

  // ---------- Habillage (qualité + mode) ----------

  function poolFor(style, t) {
    const P = STYLES[style].pools;
    return P[t] || (isDomType(t) ? P.D : t === 'mt' ? P.m : null);
  }

  // Une qualité n'est retenue que si toutes ses notes tiennent dans le mode qu'elle implique.
  function fits(ch, q, key) {
    const sc = SCALES[modeOf(Object.assign({}, ch, { q }), key)].iv;
    return Q[q].iv.every(x => sc.includes(x % 12));
  }

  function pickQ(G, ch) {
    let pool = poolFor(G.style, ch.t);
    if (!pool) return ch.t === 'ø' ? 'm7b5' : 'dim7';
    const ok = pool.filter(p => fits(ch, p[0], G.key));
    if (ok.length) pool = ok;
    const c = G.c + ((G.mood.q || {})[isDomType(ch.t) ? 'D' : ch.t === 'M' ? 'M' : 'm'] || 0);
    return pickWeighted(G.qrng || G.rng, pool.map(p => [p[0], Math.exp(-Math.pow((c - p[1]) / .28, 2)) + .005]));
  }

  function modeOf(ch, key) {
    const q = ch.q, t = ch.t;
    if (q === '7alt' || q === '7#9') return 'alt';
    if (q === '7#11' || q === '13#11') return 'lyddom';
    if (q === '7b9') return ch.toMinor || t === 'Dm' ? 'phrdom' : 'hw';
    if (q === '13b9') return 'hw';
    if (q === '7b13') return ch.toMinor || t === 'Dm' ? 'phrdom' : 'mixob6';
    if (q === '7#5') return 'wt';
    if (q === '7sus4b9') return 'phr';
    if (q === 'dim7') return 'wh';
    if (q === 'm9b5') return 'loc2';
    if (q === 'maj7#11' || q === 'maj9#11') return 'lyd';
    if (q === 'maj7#5') return 'lydaug';
    if (q === 'mMaj7' || q === 'mMaj9') return 'mel';
    if (t === 'Dl') return 'lyddom';
    if (t === 'Dm') return 'phrdom';
    if (t === 'D') return 'mixo';
    if (q === 'm6' || q === 'm69') return ch.deg === 'iv' && !key.minor ? 'mel' : 'dor';
    return ch.dmode || 'ion';
  }

  function finish(G, ch) {
    const ck = ch.kind + ':' + (ch.deg || ch.target);
    let q = G.cache ? G.cache[ck] : undefined;
    if (q === undefined) { // '' est une qualité valide (accord parfait majeur)
      q = pickQ(G, ch);
      if (G.cache) G.cache[ck] = q;
    }
    ch.q = q;
    ch.mode = modeOf(ch, G.key);
    return ch;
  }

  function degChord(G, id) {
    const d = D(G, id);
    return finish(G, {
      kind: 'deg', deg: id, semis: d.semis, step: d.step, t: typeOf(G, id), func: d.f,
      roman: R(id), why: d.why, dmode: d.mode, beats: G.barBeats,
    });
  }

  function secDom(G, id) {
    if (isTonic(id)) return degChord(G, 'V');
    const d = D(G, id), toMinor = isMinorType(typeOf(G, id));
    return finish(G, {
      kind: 'secdom', target: id, semis: (d.semis + 7) % 12, step: (d.step + 4) % 7, toMinor,
      t: toMinor ? 'Dm' : 'D', func: 'D', roman: 'V/' + R(id), beats: G.barBeats,
      why: 'Dominante secondaire — crée une tension qui se résout sur ' + R(id) + '.',
    });
  }

  function subV(G, id) {
    const d = D(G, id), ton = isTonic(id);
    return finish(G, {
      kind: 'subv', target: id, semis: (d.semis + 1) % 12, step: (d.step + 1) % 7,
      toMinor: isMinorType(typeOf(G, id)), t: 'Dl', func: 'D', roman: ton ? 'subV' : 'subV/' + R(id), beats: G.barBeats,
      why: 'Substitution tritonique — remplace ' + (ton ? 'V' : 'V/' + R(id)) + ' ; la basse descend d’un demi-ton vers ' + R(id) + '.',
    });
  }

  function relII(G, id) {
    const d = D(G, id), toMinor = isMinorType(typeOf(G, id));
    return finish(G, {
      kind: 'relii', target: id, semis: (d.semis + 2) % 12, step: (d.step + 1) % 7, toMinor,
      t: toMinor ? 'ø' : 'm', dmode: toMinor ? 'loc' : 'dor', func: 'SD', roman: 'ii/' + R(id), beats: G.barBeats,
      why: 'ii relatif — forme un ii–V qui vise ' + R(id) + '.',
    });
  }

  function passDim(G, id) {
    const d = D(G, id);
    return finish(G, {
      kind: 'dim', target: id, semis: (d.semis + 11) % 12, step: (d.step + 6) % 7,
      toMinor: isMinorType(typeOf(G, id)), t: 'o', func: 'D', roman: 'vii°/' + R(id), beats: G.barBeats,
      why: 'Diminué de passage — monte chromatiquement vers ' + R(id) + '.',
    });
  }

  // ---------- Squelette : marche pondérée sur les degrés ----------

  function trans(G, from, floor) {
    // minBorrow : styles où les emprunts font partie du vocabulaire, quel que soit le curseur
    const bias = STYLES[G.style].bias[modeName(G)], cf = Math.max(colorFactor(G.c), STYLES[G.style].minBorrow || 0) * (G.mood.borrow || 1);
    const mb = (G.mood.bias || {})[modeName(G)] || {};
    return (BASE[modeName(G)][from] || []).map(e => {
      // un degré rare n'apparaît que si le style ou l'ambiance le réclame
      const b = (bias[e[0]] == null ? (D(G, e[0]).rare && !mb[e[0]] ? 0 : 1) : bias[e[0]]) * (mb[e[0]] || 1);
      return [e[0], e[1] * Math.max(b, floor || 0) * (D(G, e[0]).b ? cf : 1)];
    }).filter(e => e[1] > 0);
  }

  function weight(G, from, to) {
    for (const e of trans(G, from)) if (e[0] === to) return e[1];
    return 0;
  }

  function walk(G, start, n) {
    const seq = [start];
    while (seq.length < n) {
      const opts = trans(G, seq[seq.length - 1]);
      seq.push(opts.length ? pickWeighted(G.rng, opts) : (G.key.minor ? 'i' : 'I'));
    }
    return seq;
  }

  function best(G, n) {
    const S = STYLES[G.style];
    const starts = Object.entries(S.start[modeName(G)]);
    const target = Math.min(n, Math.round(3 + G.c * 3));
    let top = null, topScore = -Infinity;
    for (let k = 0; k < 60; k++) {
      const seq = walk(G, pickWeighted(G.rng, starts), n);
      let s = 2 * Math.log(weight(G, seq[n - 1], seq[0]) + .02); // la boucle doit bien se refermer
      s += .8 * Math.min(new Set(seq).size, target);
      for (let i = 2; i < n; i++) if (seq[i] === seq[i - 2]) s -= .6;
      // en accords de puissance, IV→iv ou v→V sonneraient comme une simple répétition
      if (S.pools.M[0][0] === '5') for (let i = 0; i < n; i++) if (D(G, seq[i]).semis === D(G, seq[(i + 1) % n]).semis) s -= 3;
      if (n >= 8 && D(G, seq[n >> 1]).f === 'T') s += .5;
      if (n >= 2 && D(G, seq[n - 1]).f === 'D') s += S.cad * (1 + (n >= 3 && D(G, seq[n - 2]).f === 'SD' ? .5 : 0));
      s += G.rng() * 1.5;
      if (s > topScore) { topScore = s; top = seq; }
    }
    return top;
  }

  // Reprend une phrase en renouvelant ses k dernières mesures.
  function variant(G, u, k) {
    const n = u.length, head = u.slice(0, n - k), tail = u.slice(n - k).join(' ');
    let top = u, topScore = -Infinity;
    for (let j = 0; j < 30; j++) {
      const seq = walk(G, head[head.length - 1], k + 1).slice(1);
      let s = 2 * Math.log(weight(G, seq[k - 1], u[0]) + .02) + G.rng() * 1.5;
      if (seq.join(' ') === tail) s -= 3;
      if (STYLES[G.style].pools.M[0][0] === '5') {
        const all = head.slice(-1).concat(seq, u[0]);
        for (let i = 1; i < all.length; i++) if (D(G, all[i]).semis === D(G, all[i - 1]).semis) s -= 3;
      }
      if (s > topScore) { topScore = s; top = head.concat(seq); }
    }
    return top;
  }

  // ---------- Enrichissement : dominantes secondaires, ii–V, tritons, diminués ----------

  // une mesure partagée en deux : la première part va jusqu'au temps le plus proche du milieu
  function half(G, ch, second) { ch.beats = (second ? G.mt.L - G.mt.split : G.mt.split) / 2; return ch; }

  function decorate(G, ids) {
    const S = STYLES[G.style], c = G.c, n = ids.length, out = [];
    const pSec = (S.p.sec[0] + S.p.sec[1] * c) * (G.mood.sec || 1), pTri = S.p.tri * c, pDim = S.p.dim * c;
    const pRel = c > .35 ? S.p.rel : 0;
    const targets = SEC_TARGETS[modeName(G)];
    let prevLed = false;
    for (let i = 0; i < n; i++) {
      const a = ids[i], x = ids[(i + 1) % n];
      const A = degChord(G, a), dA = D(G, a), dX = D(G, x);
      const r1 = G.rng(), r2 = G.rng(), r3 = G.rng();
      let led = false;
      if (a !== x) {
        const up2 = (dX.semis - dA.semis + 12) % 12 === 2;
        const alreadyDom = isDomType(A.t) && (dX.semis + 7) % 12 === dA.semis;
        if (up2 && r1 < pDim) {
          out.push(half(G, A), half(G, passDim(G, x), 1)); led = true;
        } else if (targets.includes(x) && r1 < pSec && !alreadyDom) {
          const dom = r2 < pTri ? subV(G, x) : secDom(G, x);
          if (r3 < pRel && i > 0 && !prevLed) out.push(half(G, relII(G, x)), half(G, dom, 1));
          else out.push(half(G, A), half(G, dom, 1));
          led = true;
        } else if (isTonic(x) && a === 'V' && r2 < pTri) {
          out.push(subV(G, x)); led = true;
        } else out.push(A);
      } else out.push(A);
      prevLed = led;
    }
    return out;
  }

  // ---------- API : génération ----------

  function generate(o) {
    const seed = o.seed != null ? o.seed >>> 0 : (Math.random() * 4294967296) >>> 0;
    const rng = rngFrom(seed);
    const G = makeG(o, rng);
    G.qrng = rngFrom(seed ^ 0x9e3779b9);
    G.cache = {};
    const S = STYLES[o.style], n = o.bars;
    let units;
    if (S.form === 'blues' && n === 12) { // grille de blues ; « quick change » et ii–V final quand la couleur monte
      units = [G.key.minor
        ? ['i', 'i', 'i', 'i', 'iv', 'iv', 'i', 'i', 'bVI', 'V', 'i', 'V']
        : ['I', G.c > .45 ? 'IV' : 'I', 'I', 'I', 'IV', 'IV', 'I', 'I', G.c > .7 ? 'ii' : 'V', G.c > .7 ? 'V' : 'IV', 'I', 'V']];
    } else if (S.loop && n >= 8) {
      const u = best(G, 4);
      units = [u];
      for (let k = 1; k < n / 4; k++) units.push(k % 2 ? variant(G, u, k === 3 ? 2 : 1) : u);
    } else if (!S.loop && n === 16) {
      const u = best(G, 8);
      units = [u, variant(G, u, 2)];
    } else units = [best(G, n)];
    // Même graine d'enrichissement pour chaque phrase : les reprises restent identiques.
    const dseed = (rng() * 4294967296) >>> 0;
    const chords = [];
    for (const u of units) { G.rng = rngFrom(dseed); chords.push.apply(chords, decorate(G, u)); }
    return { tonic: o.tonic, minor: !!o.minor, style: o.style, color: G.c, bars: n, seed, chords };
  }

  // ---------- API : pont ----------
  // Une section contrastante dans une tonalité voisine ; sa dernière mesure est la dominante du ton principal, pour revenir.

  const BRIDGES = {
    half: { label: 'Demi-ton au-dessus', up: 1 },
    tone: { label: 'Un ton au-dessus', up: 2 },
    m3: { label: 'Tierce mineure au-dessus', up: 3 },
    rel: { label: 'Ton relatif', rel: true },
    par: { label: 'Ton homonyme', flip: true },
    sub: { label: 'Ton de la sous-dominante', up: 5 },
    dom: { label: 'Ton de la dominante', up: 7 },
  };

  function bridge(state, o) {
    const B = BRIDGES[o.type], home = makeKey(state.tonic, state.minor);
    let up = B.up || 0, km = home.minor;
    if (B.rel) { up = home.minor ? 3 : 9; km = !home.minor; }
    if (B.flip) km = !home.minor;
    const local = keyOf(state, { up, km });
    const g = generate({ tonic: local.tonic, minor: km, style: state.style, mood: state.mood, meter: state.meter, color: state.color, bars: o.bars, seed: o.seed });
    const chords = g.chords.map(c => Object.assign(c, { sec: 'B', up, km }));
    if (o.bars >= 2) {
      let beats = 0;
      while (chords.length && beats < meterInfo(state.meter).L / 2) beats += chords.pop().beats;
      const V = degChord(makeG(state, rngFrom(g.seed ^ 77)), 'V');
      chords.push(Object.assign(V, { sec: 'B', beats, why: 'Dominante du ton principal — ramène à la grille.' }));
    }
    return chords;
  }

  // ---------- API : suggestions ----------

  const idOf = ch => ch.kind + ':' + (ch.deg || ch.target);

  // Les suggestions se font dans la tonalité de l'accord (grille ou pont), reprennent les couleurs
  // déjà présentes dans cette section, et héritent de ses marques.
  function suggestG(state, cur) {
    const k = keyOf(state, cur);
    const G = makeG(Object.assign({}, state, { tonic: k.tonic, minor: k.minor }));
    G.cache = {};
    for (const ch of state.chords) if (ch.up === cur.up && ch.km === cur.km) G.cache[idOf(ch)] = ch.q;
    G.tag = ch => {
      if (cur.sec) ch.sec = cur.sec;
      if (cur.up != null) ch.up = cur.up;
      if (cur.km != null) ch.km = cur.km;
      return ch;
    };
    return G;
  }

  // Suites possibles après l'accord i, de la plus attendue à la plus surprenante.
  function suggestNext(state, i) {
    const cur = state.chords[i], G = suggestG(state, cur), S = STYLES[G.style];
    const found = new Map();
    const add = (ch, w) => {
      const k = idOf(ch);
      if (w > 0 && (!found.has(k) || found.get(k).w < w)) found.set(k, { ch, w });
    };
    let from = cur.deg, scale = 1;
    if (cur.kind === 'relii') {
      add(secDom(G, cur.target), 10);
      if (S.jazzy) add(subV(G, cur.target), 3);
    } else if (cur.kind !== 'deg') {
      add(degChord(G, cur.target), 10); // la résolution
      from = cur.target; scale = .08; // … ou l'esquiver
    }
    if (from) {
      const targets = SEC_TARGETS[modeName(G)], dA = cur;
      for (const e of trans(G, from, .15)) {
        const to = e[0], w = e[1] * scale;
        if (cur.kind !== 'deg' && to === cur.target) continue;
        add(degChord(G, to), w);
        if (cur.kind !== 'deg') continue;
        if (targets.includes(to)) {
          add(secDom(G, to), w * .35);
          if (S.jazzy) add(subV(G, to), w * .15);
        }
        if (S.jazzy && (D(G, to).semis - dA.semis + 12) % 12 === 2) add(passDim(G, to), w * .2);
      }
    }
    const list = Array.from(found.values()).sort((a, b) => b.w - a.w).slice(0, 12);
    const sum = list.reduce((s, x) => s + x.w, 0) || 1;
    return list.map(x => {
      const p = x.w / sum;
      return { ch: G.tag(x.ch), p, tier: p >= .16 ? 'attendu' : p >= .06 ? 'coloré' : 'surprenant' };
    });
  }

  // Alternatives pour l'accord i, à durée égale.
  function suggestReplace(state, i) {
    const chords = state.chords, cur = chords[i], G = suggestG(state, cur), S = STYLES[G.style];
    const out = [], seen = new Set([idOf(cur)]);
    const keep = (ch, group) => { ch.beats = cur.beats; out.push({ ch: G.tag(ch), group }); };

    const pool = poolFor(G.style, cur.t);
    if (pool) for (const p of pool) if (p[0] !== cur.q && fits(cur, p[0], G.key)) keep(setQuality(state, cur, p[0]), 'Autre couleur');

    const add = (ch, group) => { const k = idOf(ch); if (!seen.has(k)) { seen.add(k); keep(ch, group); } };
    if (cur.kind === 'deg') {
      const table = DEG[modeName(G)];
      for (const id in table) if (table[id].f === cur.func) add(degChord(G, id), 'Même fonction');
    } else if (cur.kind !== 'relii') {
      add(secDom(G, cur.target), 'Même fonction');
      add(subV(G, cur.target), 'Même fonction');
      if (!isTonic(cur.target)) add(passDim(G, cur.target), 'Même fonction');
    }
    const next = chords.length > 1 ? chords[(i + 1) % chords.length] : null;
    if (next && next.kind === 'deg' && next.up === cur.up && next.km === cur.km) {
      const g = 'Vers l’accord suivant';
      add(secDom(G, next.deg), g);
      if (S.jazzy) {
        add(subV(G, next.deg), g);
        if (!isTonic(next.deg)) add(passDim(G, next.deg), g);
        add(relII(G, next.deg), g);
      }
    }
    return out;
  }

  function setQuality(state, ch, q) {
    const c = Object.assign({}, ch, { q });
    c.mode = modeOf(c, keyOf(state, ch));
    return c;
  }

  // ---------- API : carte harmonique ----------
  // Tous les degrés de la tonalité de ref (morceau ou pont), leurs dominantes secondaires, et les enchaînements
  // possibles pondérés par le style, l'ambiance et la couleur : p = probabilité de chaque suite depuis un degré.

  function harmonyMap(state, ref) {
    const G = suggestG(state, ref || {}), m = modeName(G), table = DEG[m];
    G.rng = rngFrom(1);
    const nodes = Object.keys(table).map(id => ({ id, ch: G.tag(degChord(G, id)), borrowed: !!table[id].b, rare: !!table[id].rare }));
    const edges = [];
    for (const n of nodes) {
      const out = trans(G, n.id, .1), sum = out.reduce((s, e) => s + e[1], 0) || 1;
      for (const e of out) edges.push({ from: n.id, to: e[0], p: e[1] / sum });
    }
    const sec = SEC_TARGETS[m].map(t => G.tag(secDom(G, t)));
    if (STYLES[G.style].jazzy) for (const t of SEC_TARGETS[m]) sec.push(G.tag(subV(G, t)));
    return { minor: m === 'minor', nodes, edges, sec };
  }

  // ---------- API : lecture d'un accord dans une tonalité ----------

  function chordInfo(ch, key) {
    const r = spell(key.letter, key.pc, ch.semis, ch.step);
    const q = Q[ch.q], sc = SCALES[ch.mode];
    return {
      root: r.name, rootPc: r.pc, name: r.name + q.sym,
      notes: q.iv.map(x => spell(r.letter, r.pc, x % 12, STEP_OF[x]).name),
      pcs: q.iv.map(x => (r.pc + x) % 12),
      mode: sc.name,
      scaleNotes: sc.iv.map((x, i) => (sc.iv.length === 7 ? spell(r.letter, r.pc, x, i).name : FLAT[(r.pc + x) % 12])),
      scalePcs: sc.iv.map(x => (r.pc + x) % 12),
    };
  }

  // Voicing dans une fenêtre fixe d'une octave : la conduite des voix reste naturellement serrée.
  // Sans fondamentale à partir de 5 sons (la basse la joue).
  function voicing(ch, key, center) {
    center = center || 59;
    const rootPc = (key.pc + ch.semis) % 12, iv = Q[ch.q].iv, lo = center - 6;
    const tones = iv.length >= 5 ? iv.filter(x => x !== 0) : iv;
    const set = new Set(tones.map(x => lo + (((rootPc + x - lo) % 12) + 12) % 12));
    if (ch.q === '5') set.add(lo + ((rootPc - lo) % 12 + 12) % 12 + 12);
    let bass = 36 + rootPc;
    if (bass < 40) bass += 12;
    return { bass, notes: Array.from(set).sort((a, b) => a - b), fifth: iv.includes(6) && !iv.includes(7) ? 6 : 7, third: iv.includes(3) ? 3 : iv.includes(4) ? 4 : 7 };
  }

  // ---------- API : mélodie et basse ----------
  // Positions et durées en doubles croches. Options communes :
  //   seed  : graine ; bars : longueur du motif en mesures (0 = toute la grille) — le motif est rejoué, adapté aux accords ;
  //   color : 0 = notes les plus sûres, 1 = toutes les couleurs ; vari : 0 = reprises identiques, 1 = toujours renouvelé.

  // Tirage reproductible à partir d'une graine et de deux indices.
  function mix(seed, a, b) {
    return ((seed >>> 0) ^ Math.imul((a | 0) + 1, 374761393) ^ Math.imul((b | 0) + 1, 668265263)) >>> 0;
  }
  const rand = (seed, a, b) => rngFrom(mix(seed, a, b))();

  const MEL_DUR = {
    slow: [[4, 3], [6, 2], [8, 3], [12, 1], [2, 1]],
    mid: [[2, 4], [4, 4], [6, 2], [3, 1], [8, 1]],
    fast: [[1, 2], [2, 6], [3, 2], [4, 3], [6, 1]],
  };

  // Le rythme est tiré par mesure puis repris (A B A C) pour donner un motif ;
  // les notes d'accord tombent sur les appuis, les notes du mode font le lien.
  function melody(state, o) {
    const seed = o.seed >>> 0;
    const color = o.color == null ? .5 : o.color, vari = o.vari || 0;
    // air : 0 = phrase continue, 1 = très aérée (silences plus fréquents, souffle en fin de phrase de deux mesures)
    const air = o.air == null ? .25 : o.air, durs = MEL_DUR[o.density] || MEL_DUR.mid, pRest = .03 + air * .5, breath = Math.round(air * 10);
    const segs = [];
    let total = 0;
    for (const ch of state.chords) {
      const inf = chordInfo(ch, keyOf(state, ch));
      segs.push({ from: total, to: total + ch.beats * 4, pcs: inf.pcs, scale: inf.scalePcs });
      total += ch.beats * 4;
    }
    const mt = meterInfo(state.meter), B16 = mt.B16, strongAt = new Set(mt.starts16.filter((x, k) => k % 2 === 0));
    const N = o.bars > 0 ? o.bars : Math.ceil(total / B16);
    const cells = {};
    const cellFor = bar => {
      const p = bar % N;
      // variation : la mesure reçoit un rythme qui n'appartient qu'à elle
      const id = rand(seed, bar, 11) < vari * .6 ? 100 + bar : p % 2 === 0 ? 1 : p % 4 === 1 ? 2 : 3;
      if (!cells[id]) {
        const rng = rngFrom(mix(seed, id, 10)), list = [];
        for (let pos = 0; pos < B16;) {
          let d = Math.min(pickWeighted(rng, durs), B16 - pos);
          if (pos % 2 && d > 1) d = 1; // une double isolée se recale sur la croche
          list.push({ d, rest: pos > 0 && rng() < pRest });
          pos += d;
        }
        cells[id] = list;
      }
      return cells[id];
    };

    const oct = 12 * (o.octave || 0), LO = 60 + oct, HI = 84 + oct, MID = 72 + oct, maxLeap = Math.round(5 + color * 7);
    // contour : 'up' ou 'down' font pencher chaque phrase, qui repart alors du grave ou de l'aigu
    const lean = o.contour === 'up' ? 1 : o.contour === 'down' ? -1 : 0;
    let rng, prev = null, dir = 1;
    const pitch = allowed => {
      const cands = [];
      for (let m = LO; m <= HI; m++) {
        if (!allowed.includes(m % 12)) continue;
        if (prev == null) { cands.push([m, Math.exp(-Math.abs(m - (MID - lean * 6)) / 5)]); continue; }
        const iv = m - prev, a = Math.abs(iv);
        if (a > maxLeap) continue;
        let w = Math.exp(-a / 2.5) * Math.exp(-Math.abs(m - MID) / 9); // petits intervalles, retour vers le centre
        if (a === 0) w *= .25;
        if (Math.sign(iv) === dir) w *= 1.5;
        if (lean) w *= Math.sign(iv) === lean ? 2.4 : .5;
        cands.push([m, w]);
      }
      const m = cands.length ? pickWeighted(rng, cands) : prev;
      if (prev != null && m !== prev) dir = Math.sign(m - prev);
      if (rng() < .2) dir = -dir;
      return (prev = m);
    };

    const notes = [];
    let si = 0;
    for (let bar = 0; bar * B16 < total; bar++) {
      const p = bar % N, varied = bar >= N && rand(seed, bar, 12) < vari;
      rng = rngFrom(mix(seed, varied ? 5000 + bar : p, 13)); // mêmes tirages à chaque reprise du motif
      if (p === 0) { prev = null; dir = rng() < .5 ? 1 : -1; }
      let pos = bar * B16;
      for (const c of cellFor(bar)) {
        const start = pos;
        pos += c.d;
        if (start >= total) break;
        if (c.rest || (p % 2 === 1 && start > bar * B16 && start - bar * B16 >= B16 - breath)) continue;
        while (segs[si].to <= start) si++;
        const seg = segs[si];
        let d = Math.min(c.d, total - start);
        const strong = start === seg.from || strongAt.has(start % B16) || d >= 4;
        // couleur : appuis sur fondamentale-tierce-quinte, puis sur tout l'accord ; notes du mode de plus en plus présentes ailleurs
        const allowed = strong ? (color < .3 ? seg.pcs.slice(0, 3) : seg.pcs) : rng() < .15 + .85 * color ? seg.scale : seg.pcs;
        const m = pitch(allowed);
        if (m == null) continue;
        // une note ne déborde sur l'accord suivant que si elle appartient aussi à son mode
        if (start + d > seg.to) {
          const nx = segs[si + 1];
          if (!(nx && nx.scale.includes(m % 12) && rng() < .6)) d = seg.to - start;
        }
        notes.push({ t: start, d, m });
      }
    }
    return notes;
  }

  // variant (quelles notes) — root : fondamentale. fifth : fondamentale et quinte. octave : rebond à l'octave.
  // arp : notes de l'accord. walk : mouvement conjoint puis approche de la fondamentale suivante.
  // pedal : tonique du morceau tenue sous tous les accords. riff : court motif tiré une fois, transposé sur chaque accord.
  // line : ligne chantante, conjointe, au rythme libre. random : notes de l'accord au hasard.
  // rhythm (quand) — whole, half, quarter, eighth, triplet, sixteenth, synco (3+3+2), pump (temps 1 et 3),
  // antic (la fondamentale suivante arrive une croche avant le changement), ghost (noires + notes étouffées, marquées g),
  // kick (calé sur la grosse caisse : o.kick(mesure) rend sa ligne de 16 doubles croches), ou auto : le rythme naturel du jeu.
  // Les triolets donnent des positions fractionnaires.
  const BASS_STEP = { whole: 16, half: 8, quarter: 4, eighth: 2, triplet: 4 / 3, sixteenth: 1 };
  const BASS_NATURAL = { root: 'half', fifth: 'quarter', octave: 'eighth', arp: 'quarter', walk: 'quarter', pedal: 'whole' };
  const round4 = x => Math.round(x * 1e4) / 1e4;

  function rhythmSlots(rhythm, t0, len, B16) {
    const slots = [];
    if (rhythm === 'synco') {
      const at = [];
      for (let p = 0; p < len; p++) if (!p || [0, 3, 6].includes(((t0 + p) % B16) % 8)) at.push(p); // 3+3+2 compté depuis la mesure, et toujours une note au changement d'accord
      at.forEach((p, j) => slots.push({ t: t0 + p, d: (j + 1 < at.length ? at[j + 1] : len) - p }));
    } else {
      const step = BASS_STEP[rhythm];
      for (let j = 0; j * step < len - 1e-6; j++) slots.push({ t: round4(t0 + j * step), d: round4(Math.min(step, len - j * step)) });
    }
    return slots;
  }

  function bassLine(state, o) {
    const seed = o.seed >>> 0, variant = o.variant, out = [], home = makeKey(state.tonic, state.minor);
    const color = o.color == null ? .5 : o.color, vari = o.vari || 0;
    const rhythm = o.rhythm && o.rhythm !== 'auto' ? o.rhythm : BASS_NATURAL[variant];
    const LO = 36, HI = 57;
    const near = (pc, ref) => {
      let best = null;
      for (let m = LO; m <= HI; m++) if (m % 12 === pc && (best == null || Math.abs(m - ref) < Math.abs(best - ref))) best = m;
      return best;
    };
    const infos = state.chords.map(ch => {
      const key = keyOf(state, ch), v = voicing(ch, key), inf = chordInfo(ch, key);
      return { root: v.bass, third: v.third, fifth: v.fifth, iv: Q[ch.q].iv, pcs: inf.pcs, scale: inf.scalePcs, len: ch.beats * 4 };
    });
    const mt = meterInfo(state.meter), B16 = mt.B16, pumpAt = new Set(mt.starts16.filter((x, k) => k % 2 === 0));
    const total = infos.reduce((a, c) => a + c.len, 0), N = o.bars > 0 ? o.bars : Math.ceil(total / B16);
    const pedal = near(home.pc, 43);

    // grosse caisse : une ligne par mesure, demandée une seule fois
    const kickLines = {};
    const kickAt = abs => {
      const bar = Math.floor(abs / B16);
      if (!(bar in kickLines)) kickLines[bar] = (o.kick && o.kick(bar)) || '';
      const c = kickLines[bar][abs % B16];
      return !!c && c !== '.';
    };

    // riff : un motif d'une mesure (positions, durées, degrés), le même pour tout le morceau
    const DEGS = color < .33 ? ['r', 'r', '5', '8'] : color < .66 ? ['r', 'r', '5', '8', '7', '3'] : ['r', '5', '8', '7', '3', '7', '3'];
    const riff = [];
    if (variant === 'riff') {
      const rng = rngFrom(mix(seed, 0, 90));
      for (let pos = 0; pos < B16;) {
        let d = Math.min(pickWeighted(rng, [[2, 4], [3, 2], [4, 3], [1, 1], [6, 1]]), B16 - pos);
        if (pos % 2 && d > 1) d = 1;
        const deg = pos ? DEGS[Math.floor(rng() * DEGS.length)] : 'r';
        if (!pos || rng() > .15) riff.push({ p: pos, d, deg });
        pos += d;
      }
    }
    const riffDeg = pos => { let deg = 'r'; for (const e of riff) if (e.p <= pos) deg = e.deg; return deg; };
    const degPitch = (c, deg) => c.root + (deg === '5' ? c.fifth : deg === '8' ? 12 : deg === '3' ? c.third
      : deg === '7' ? (c.iv.includes(10) ? 10 : c.iv.includes(11) ? 11 : c.scale.includes((c.root + 10) % 12) ? 10 : c.fifth) : 0);

    let t = 0, prev = null;
    infos.forEach((c, i) => {
      const nx = infos[(i + 1) % infos.length], n = Math.ceil(c.len / 4 - 1e-6); // temps (noires) couverts par l'accord
      const bar = Math.floor(t / B16), varied = bar >= N && rand(seed, bar, 21) < vari;
      const rng = rngFrom(mix(seed, varied ? 5000 + bar : bar % N, 22 + (t % B16)));
      if (bar % N === 0 && t % B16 === 0) prev = null;

      // pas conjoint vers la cible : notes du mode, notes d'accord favorisées (surtout quand la couleur est basse)
      const step = (cur, target, reach) => {
        let cands = [];
        for (let x = Math.max(LO, cur - reach); x <= Math.min(HI, cur + reach); x++) {
          if (x === cur || !c.scale.includes(x % 12)) continue;
          const toward = target === cur || Math.sign(x - cur) === Math.sign(target - cur), tone = c.pcs.includes(x % 12);
          cands.push([x, (tone ? 3.5 - 3 * color : 1) * Math.exp(-Math.abs(x - cur) / 3) * (toward ? 2 : 1), tone]);
        }
        if (color < .25 && cands.some(x => x[2])) cands = cands.filter(x => x[2]);
        return cands.length ? pickWeighted(rng, cands) : cur;
      };

      // walking : une hauteur par temps
      const beatPitch = [];
      if (variant === 'walk') {
        let cur = near(c.root % 12, prev == null ? 43 : prev);
        beatPitch.push(cur);
        const target = near(nx.root % 12, cur);
        for (let k = 1; k < n; k++) {
          let m;
          if (k === n - 1) { // approche : demi-ton chromatique (d'autant plus que la couleur monte) ou degré voisin du mode
            const side = cur < target ? -1 : cur > target ? 1 : rng() < .5 ? -1 : 1;
            const diat = [1, 2].map(x => target + side * x).find(x => c.scale.includes(x % 12));
            m = diat != null && rng() > .15 + .7 * color ? diat : target + side;
            if (m === cur || m < LO - 2 || m > HI + 2) m = target - side; // pas de note répétée avant l'arrivée
          } else m = step(cur, target, 5);
          beatPitch.push(m);
          cur = m;
        }
        prev = cur;
      }

      // les durées
      let slots = [];
      if (rhythm === 'kick') {
        const at = [];
        for (let p = 0; p < c.len; p++) if (!p || kickAt(t + p)) at.push(p);
        if (at.length > 1 || kickAt(t)) at.forEach((p, k) => slots.push({ t: t + p, d: Math.min(4, (k + 1 < at.length ? at[k + 1] : c.len) - p) }));
        else slots = rhythmSlots('half', t, c.len, B16); // kit sans grosse caisse
      } else if (rhythm === 'pump') { // un temps fort sur deux de la mesure
        for (let p = 0; p < c.len; p++) if (!p || pumpAt.has((t + p) % B16)) slots.push({ t: t + p, d: Math.min(4, c.len - p) });
      } else if (rhythm === 'antic') {
        slots = rhythmSlots('synco', t, c.len, B16);
        const last = slots[slots.length - 1];
        if (slots.length > 1 && last.d === 2) last.ant = true;
      } else if (rhythm === 'ghost') {
        for (let p = 0; p < c.len; p += 4) {
          slots.push({ t: t + p, d: Math.min(2, c.len - p) });
          if (rng() < .3 && p + 2 < c.len) slots.push({ t: t + p + 2, d: 1, g: true });
          if (rng() < .6 && p + 3 < c.len) slots.push({ t: t + p + 3, d: 1, g: true });
        }
      } else if (rhythm) slots = rhythmSlots(rhythm, t, c.len, B16);
      else if (variant === 'riff') {
        for (let b0 = Math.floor(t / B16) * B16; b0 < t + c.len; b0 += B16) {
          for (const e of riff) if (b0 + e.p >= t && b0 + e.p < t + c.len) slots.push({ t: b0 + e.p, d: Math.min(e.d, t + c.len - b0 - e.p), deg: e.deg });
        }
        if (!slots.length || slots[0].t > t) slots.unshift({ t, d: (slots.length ? slots[0].t : t + c.len) - t, deg: 'r' });
        slots[0].deg = 'r';
      } else { // ligne chantante ou aléatoire : rythme tiré au hasard
        const durs = variant === 'line' ? [[2, 2], [4, 4], [6, 2], [8, 2]] : [[2, 2], [4, 4], [8, 1]];
        for (let p = 0; p < c.len;) {
          const d = Math.min(pickWeighted(rng, durs), c.len - p);
          slots.push({ t: t + p, d });
          p += d;
        }
      }

      // une hauteur pour chaque durée
      const all = Array.from(new Set(c.iv.map(x => x % 12)));
      const tones = (color < .33 ? [0, c.fifth] : color < .66 ? all.slice(0, 3) : all).concat(12);
      const up = all.slice(0, 4).sort((a, b) => a - b), arp = color > .6 && up.length > 2 ? up.concat(up.slice(1, -1).reverse()) : up;
      let k = 0, cur = null;
      const lineTarget = near(nx.root % 12, c.root);
      const notes = slots.map((sl, j) => {
        let m;
        if (sl.ant) m = nx.root;
        else if (sl.g) m = cur == null ? c.root : cur; // note étouffée : même hauteur que la précédente
        else {
          if (variant === 'fifth') m = c.root + (k % 2 ? (c.root >= 46 ? c.fifth - 12 : c.fifth) : 0);
          else if (variant === 'octave') m = c.root + (k % 2 ? 12 : 0);
          else if (variant === 'arp') m = c.root + arp[k % arp.length];
          else if (variant === 'walk') m = beatPitch[Math.min(n - 1, Math.floor((sl.t - t) / 4 + 1e-6))];
          else if (variant === 'pedal') m = pedal; // la tonique du morceau, quel que soit l'accord
          else if (variant === 'riff') m = degPitch(c, sl.deg || riffDeg(Math.floor(sl.t) % B16));
          else if (variant === 'line') m = k === 0 ? near(c.root % 12, prev == null ? 43 : prev) : step(cur, lineTarget, j === slots.length - 1 ? 3 : 4);
          else if (variant === 'random') m = c.root + (k ? tones[Math.floor(rng() * tones.length)] : 0);
          else m = c.root;
          k++;
        }
        cur = m;
        return { t: sl.t, d: sl.d, m, g: sl.g, ant: sl.ant };
      });
      if (variant === 'line') prev = cur;

      // couleur (lignes simples) : levée vers l'accord suivant — quinte, ou approche chromatique quand la couleur est haute
      const last = notes[notes.length - 1];
      if (['root', 'fifth', 'octave'].includes(variant) && !last.g && !last.ant && Number.isInteger(last.d) && last.d >= 4 && rng() < color - .4) {
        last.d -= 2;
        const target = near(nx.root % 12, last.m);
        notes.push({ t: last.t + last.d, d: 2, m: color > .75 && rng() < .5 ? target + (last.m <= target ? -1 : 1) : c.root + c.fifth });
      }
      // variation : notes redoublées (parfois à l'octave) ou écourtées
      for (const nt of notes) {
        out.push(nt);
        if (nt.t === t || nt.d < 4 || !Number.isInteger(nt.d) || nt.g || nt.ant) continue;
        const r = rng();
        if (r < vari * .3) {
          nt.d /= 2;
          out.push({ t: nt.t + nt.d, d: nt.d, m: nt.m + (nt.m + 12 <= HI + 4 && rng() < .4 ? 12 : 0) });
        } else if (r < vari * .45) nt.d /= 2;
      }
      t += c.len;
    });
    return out;
  }

  return { METERS, meterInfo, rand, harmonyMap, keyOf, bridge, BRIDGES, FAMILIES, MOOD_GROUPS, moodPreset, TONICS, STYLES, MOODS, melody, bassLine, Q, SCALES, makeKey, generate, suggestNext, suggestReplace, setQuality, chordInfo, voicing, rngFrom };
});
