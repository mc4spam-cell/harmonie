(() => {
  'use strict';
  const H = Harmony;
  const $ = s => document.querySelector(s);
  const pretty = s => s.replace(/b/g, '♭').replace(/#/g, '♯');
  const FN = { T: 'Tonique', SD: 'Sous-dominante', D: 'Dominante' };
  const STORE = 'harmonie.v1';

  // ---------- État ----------
  // Réglages généraux à plat ; un bloc par instrument dans S.parts :
  //   on, bars (mesures), color, play (façon de jouer), vari (variation), vol, dyn (dynamique), seed (changée par « Régénérer »).

  const PART_IDS = ['chords', 'bass', 'mel', 'drums'];
  const newSeed = () => (Math.random() * 1e9) | 0;
  const defaultParts = () => ({
    chords: { on: true, bars: 8, color: .5, play: 'style', rate: 2, dens: .5, reg: 0, vari: .15, vol: .8, dyn: .5, seed: newSeed() },
    bass: { on: true, bars: 0, color: .5, play: 'style', rhythm: 'auto', vari: .15, vol: .8, dyn: .5, seed: newSeed() },
    mel: { on: false, bars: 0, color: .5, play: 'mid', air: .25, octave: 0, contour: 'free', vari: .3, vol: .8, dyn: .5, seed: newSeed() },
    drums: { on: true, bars: 4, color: .5, play: 'mid', vari: .15, vol: .8, dyn: .5, seed: newSeed() },
  });

  // bridge : pont (type 'none' = pas de pont), sa longueur, et la forme jouée (AB ou AABA).
  const S = Object.assign({ tonic: 'C', minor: false, style: 'jazz', tempo: H.STYLES.jazz.tempo, mood: 'neutre', chords: [] }, load());
  S.bridge = Object.assign({ type: 'none', bars: 4, form: 'AB' }, S.bridge);
  if (!H.METERS[S.meter]) S.meter = '4/4'; // signature rythmique
  if (S.meterOwn == null) S.meterOwn = true; // motifs écrits pour la mesure (valse, 6/8, 7/8, 12/8 blues) plutôt que dérivés du 4/4
  if (!S.instrView) S.instrView = 'piano'; // vue des notes de l'accord : piano, basse ou guitare
  migrate();
  if (!H.STYLES[S.style]) {
    S.style = { jazz: 'jazz', bossa: 'bossa-nova', rock: 'rock-classique', electro: 'electro', hiphop: 'boom-bap', downtempo: 'downtempo',
      frenchtouch: 'house', metal: 'heavy-metal', punk: 'punk', sludge: 'sludge', stoner: 'stoner-rock' }[S.style] || 'rock-classique';
  }

  // Reprend les réglages enregistrés par les versions à un seul panneau.
  function migrate() {
    const d = defaultParts(), old = S;
    if (!S.parts) {
      if (old.color != null) d.chords.color = old.color;
      if (old.bars) d.chords.bars = old.bars;
      if (old.comp) d.chords.play = old.comp;
      if (old.rate) d.chords.rate = old.rate;
      if (old.bass === 'off') d.bass.on = false; else if (old.bass) d.bass.play = old.bass;
      if (old.bassSeed) d.bass.seed = old.bassSeed;
      if (old.mel != null) d.mel.on = !!old.mel;
      if (old.melDensity) d.mel.play = old.melDensity;
      if (old.melSeed) d.mel.seed = old.melSeed;
      if (old.drums != null) d.drums.on = !!old.drums;
      S.parts = d;
      for (const k of ['color', 'bars', 'comp', 'rate', 'bass', 'bassSeed', 'mel', 'melDensity', 'melSeed', 'drums']) delete S[k];
    } else for (const id of PART_IDS) S.parts[id] = Object.assign(d[id], S.parts[id]);
  }

  // bright : brillance générale du son (0..1). Les anciens réglages « selon l'ambiance » deviennent explicites.
  if (S.bright == null) S.bright = .5;
  if (S.parts.bass.play === 'third') S.parts.bass.play = 'arp'; // « Fondamentale et tierces » est devenu « Arpège »
  if (!H.MOODS[S.mood]) S.mood = 'neutre';
  if (S.parts.drums.play === 'auto') S.parts.drums.play = H.moodPreset(S.mood).drums.play;
  const moodTempo = () => Math.round(H.STYLES[S.style].tempo * H.moodPreset(S.mood).tempo);

  // Choisir une ambiance pose ses réglages (mode, tempo, brillance, instruments) ; ils restent modifiables ensuite.
  function applyMood(id) {
    const M = H.moodPreset(id);
    S.mood = id;
    S.bright = M.bright;
    for (const part of PART_IDS) Object.assign(S.parts[part], M[part]);
    if (M.minor != null && M.minor !== S.minor) {
      const pc = key().pc;
      S.minor = M.minor;
      S.tonic = H.TONICS[S.minor ? 'minor' : 'major'].find(t => H.makeKey(t).pc === pc);
    }
    S.tempo = moodTempo();
  }

  let sel = -1, playingIdx = -1, repl = [], next = [];
  const undoStack = [];

  function load() {
    try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch (e) { return {}; }
  }
  function save() {
    try { localStorage.setItem(STORE, JSON.stringify(S)); } catch (e) { /* stockage indisponible */ }
  }
  const key = () => H.makeKey(S.tonic, S.minor);
  const keyFor = ch => H.keyOf(S, ch); // tonalité de l'accord : celle du morceau, ou celle du pont
  const info = ch => H.chordInfo(ch, keyFor(ch));
  // Ce que le moteur harmonique attend : la couleur et la longueur sont celles du panneau Accords.
  const meter = () => H.meterInfo(S.meter);
  const hstate = () => ({ tonic: S.tonic, minor: S.minor, style: S.style, mood: S.mood, meter: S.meter, color: S.parts.chords.color, bars: S.parts.chords.bars, chords: S.chords });

  function pushUndo() {
    undoStack.push(JSON.stringify(S));
    if (undoStack.length > 60) undoStack.shift();
  }
  function undo() {
    if (!undoStack.length) return;
    Object.assign(S, JSON.parse(undoStack.pop()));
    sel = Math.min(sel, S.chords.length - 1);
    Player.volumes();
    changed(true);
  }

  // Les accords sont rangés grille d'abord, pont ensuite (marqués sec: 'B').
  const gridChords = () => S.chords.filter(c => c.sec !== 'B');
  const newBridge = () => (S.bridge.type === 'none' ? [] : H.bridge(hstate(), { type: S.bridge.type, bars: S.bridge.bars }));

  // Ordre de jeu, en indices dans S.chords : la grille seule, ou la forme choisie avec le pont.
  function playOrder() {
    const A = [], B = [];
    S.chords.forEach((c, i) => (c.sec === 'B' ? B : A).push(i));
    if (!B.length) return A;
    return S.bridge.form === 'AABA' ? A.concat(A, B, A) : A.concat(B);
  }
  // Pour la basse et la mélodie : les accords tels qu'ils défilent.
  const pstate = () => Object.assign(hstate(), { chords: playOrder().map(i => S.chords[i]) });

  function generate() {
    if (S.chords.length) pushUndo();
    S.chords = H.generate(hstate()).chords;
    S.chords = S.chords.concat(newBridge());
    sel = 0;
    changed(true);
  }
  // Refait (ou retire) le pont sans toucher à la grille.
  function regenBridge() {
    pushUndo();
    S.chords = gridChords();
    S.chords = S.chords.concat(newBridge());
    sel = Math.min(sel, S.chords.length - 1);
    changed(true);
  }

  // « Régénérer » d'un instrument : nouvelle grille pour les accords, nouvelle graine pour les autres.
  function regenPart(id) {
    if (id === 'chords') return generate();
    pushUndo();
    S.parts[id].seed = newSeed();
    S.parts[id].on = true;
    save();
    renderControls();
    toast(PART_UI[id].name + ' : nouvelle version');
  }
  function regenAll() {
    pushUndo();
    for (const id of PART_IDS) S.parts[id].seed = newSeed();
    S.chords = [];
    generate();
  }

  function changed(controls) {
    save();
    if (controls) renderControls();
    renderGrid();
    renderDisc();
    renderMap();
    renderDetail();
  }

  // ---------- Rendu ----------

  const BARS_MOTIF = [[0, 'Toute la grille'], [1, 'Motif de 1 mesure'], [2, 'Motif de 2 mesures'], [4, 'Motif de 4 mesures'], [8, 'Motif de 8 mesures']];
  const PART_UI = {
    chords: {
      name: 'Accords', regen: 'Nouvelle grille d’accords (G)',
      plays: [['style', 'Motif du style'], ['block', 'Plaqués'], ['up', 'Arpège montant'], ['down', 'Arpège descendant'], ['updown', 'Arpège aller-retour'], ['random', 'Arpège aléatoire']],
      bars: [[4, '4 mesures'], [8, '8 mesures'], [12, '12 mesures'], [16, '16 mesures']],
      extra: [
        { k: 'reg', label: 'Registre', hint: 'Hauteur des accords', options: [[-1, 'Grave'], [0, 'Médium'], [1, 'Aigu']] },
        { k: 'dens', label: 'Densité', hint: 'De l’accord tenu au motif chargé (jeu « Motif du style »)', range: true },
      ],
      hint: { bars: 'Longueur de la grille (en génère une nouvelle)', color: 'Richesse des accords, à la prochaine grille', vari: 'Coups ajoutés ou retirés, arpèges retournés ou décalés' },
    },
    bass: {
      name: 'Basse', regen: 'Nouvelle ligne de basse',
      plays: [['style', 'Motif du style'], ['root', 'Fondamentale'], ['fifth', 'Fondamentale et quinte'], ['octave', 'Fondamentale et octave'], ['arp', 'Arpège'],
        ['walk', 'Walking bass'], ['pedal', 'Pédale'], ['riff', 'Riff'], ['line', 'Ligne chantante'], ['random', 'Aléatoire']],
      bars: BARS_MOTIF,
      extra: [{ k: 'rhythm', label: 'Rythme', hint: 'Quand la basse joue. Sans effet avec le jeu « Motif du style » : choisis un autre jeu', show: P => P.play !== 'style',
        options: [['auto', 'Selon le jeu'], ['whole', 'Rondes'], ['half', 'Blanches'], ['quarter', 'Noires'], ['eighth', 'Croches'], ['triplet', 'Triolets'], ['sixteenth', 'Doubles croches'], ['synco', 'Syncopé (3+3+2)'],
          ['pump', 'Pompe (temps 1 et 3)'], ['antic', 'Anticipé'], ['ghost', 'Avec notes fantômes'], ['kick', 'Calé sur la grosse caisse']] }],
      hint: { bars: 'Longueur du motif, rejoué sur les accords suivants', color: 'Des notes sûres aux approches chromatiques', vari: 'Notes redoublées ou écourtées, reprises renouvelées' },
    },
    mel: {
      name: 'Mélodie', regen: 'Nouvelle mélodie (N)',
      plays: [['slow', 'Notes longues'], ['mid', 'Durées mêlées'], ['fast', 'Notes vives']],
      bars: BARS_MOTIF,
      extra: [
        { k: 'octave', label: 'Octave', hint: 'Registre de la mélodie', options: [[-2, 'Très grave (−2)'], [-1, 'Grave (−1)'], [0, 'Médium'], [1, 'Aigu (+1)'], [2, 'Très aigu (+2)']] },
        { k: 'contour', label: 'Contour', hint: 'Pente générale des phrases', options: [['free', 'Libre'], ['up', 'Montant'], ['down', 'Descendant']] },
        { k: 'air', label: 'Respiration', hint: 'De la phrase continue à la mélodie très aérée', range: true },
      ],
      hint: { bars: 'Longueur de la phrase, rejouée sur les accords suivants', color: 'Des notes de l’accord aux notes du mode, intervalles plus larges', vari: 'Rythmes et reprises renouvelés' },
    },
    drums: {
      name: 'Batterie', regen: 'Nouvelles variations',
      plays: [['soft', 'Feutrée'], ['mid', 'Posée'], ['high', 'Énergique']],
      barsLabel: 'Fills',
      bars: [[1, 'Sans fill'], [2, 'Toutes les 2 mesures'], [4, 'Toutes les 4 mesures'], [8, 'Toutes les 8 mesures'], [16, 'Toutes les 16 mesures']],
      hint: { bars: 'Un fill en fin de cycle ; les variations se répètent aussi sur ce cycle', color: 'Du kit dépouillé aux notes fantômes et charleys ouverts', vari: 'Coups ajoutés ou retirés d’une mesure à l’autre', dyn: 'Contraste des accents ; tout en haut, frappe appuyée et charley ouvert' },
    },
  };
  const SLIDERS = [['color', 'Couleur'], ['vari', 'Variation'], ['vol', 'Volume'], ['dyn', 'Dynamique']];
  const RATES = [[2, 'Croches'], [3, 'Triolets'], [4, 'Doubles croches']];
  const options = (list, cur) => list.map(([v, l]) => `<option value="${v}" ${String(v) === String(cur) ? 'selected' : ''}>${l}</option>`).join('');

  function renderParts() {
    $('#parts').innerHTML = PART_IDS.map(id => {
      const P = S.parts[id], U = PART_UI[id];
      const slider = (k, l, hint) => `<label title="${hint}">${l}</label>
        <div class="row"><input type="range" min="0" max="100" value="${Math.round(P[k] * 100)}" data-k="${k}" aria-label="${l} — ${U.name}" title="${hint}"><output>${Math.round(P[k] * 100)}</output></div>`;
      const rate = id === 'chords' && isArp() ? `<label>Débit</label><select data-k="rate">${options(RATES, P.rate)}</select>` : '';
      return `<section class="part${P.on ? '' : ' off'}" data-part="${id}">
        <header>
          <button class="switch" role="switch" aria-checked="${P.on}" aria-label="${U.name}" data-k="on"><i></i></button>
          <h3>${U.name}</h3>
          <button class="regen" data-k="regen" title="${U.regen}">↻ Régénérer</button>
        </header>
        <div class="rows">
          <label>Jeu</label><select data-k="play">${options(U.plays, P.play)}</select>${rate}
          <label title="${U.hint.bars}">${U.barsLabel || 'Mesures'}</label><select data-k="bars" title="${U.hint.bars}">${options(U.bars, P.bars)}</select>
          ${(U.extra || []).map(x => (x.range ? slider(x.k, x.label, x.hint) : `<label title="${x.hint}">${x.label}</label><select data-k="${x.k}" title="${x.hint}" ${x.show && !x.show(P) ? 'disabled' : ''}>${options(x.options, P[x.k])}</select>`)).join('')}
          ${SLIDERS.map(([k, l]) => slider(k, l, U.hint[k] || '')).join('')}
        </div>
      </section>`;
    }).join('');
  }

  function renderControls() {
    const fam = H.STYLES[S.style].family;
    $('#family').innerHTML = H.FAMILIES.map(([k, l]) => `<button data-v="${k}" class="${k === fam ? 'on' : ''}">${l}</button>`).join('');
    $('#style').innerHTML = Object.keys(H.STYLES).filter(k => H.STYLES[k].family === fam).map(k =>
      `<button data-v="${k}" class="${k === S.style ? 'on' : ''}">${H.STYLES[k].label}</button>`).join('');
    $('#tonic').innerHTML = H.TONICS[S.minor ? 'minor' : 'major'].map(t =>
      `<option value="${t}" ${t === S.tonic ? 'selected' : ''}>${pretty(t)}</option>`).join('');
    for (const b of $('#mode').children) b.classList.toggle('on', (b.dataset.v === '1') === S.minor);
    $('#tempo').value = S.tempo;
    if (!$('#meter').options.length) $('#meter').innerHTML = Object.keys(H.METERS).map(k => `<option value="${k}">${k}</option>`).join('');
    $('#meter').value = S.meter;
    $('#meterOwn').checked = S.meterOwn;
    $('#meterOwn').disabled = !METER_KITS[S.meter];
    $('#meterOwnLbl').title = METER_COMPS[S.meter] ? `Motifs écrits pour la mesure : ${METER_COMPS[S.meter].label}` : 'Pas de motif propre à cette mesure : les motifs du style sont adaptés';
    if (!$('#mood').options.length) {
      $('#mood').innerHTML = '<option value="neutre">Neutre</option>' + H.MOOD_GROUPS.map(([g, l]) => `<optgroup label="${l}">${
        Object.keys(H.MOODS).filter(k => H.MOODS[k].group === g).map(k => `<option value="${k}">${H.MOODS[k].label}</option>`).join('')}</optgroup>`).join('');
    }
    $('#mood').value = S.mood;
    $('#bright').value = Math.round(S.bright * 100);
    const other = S.minor ? 'majeur' : 'mineur';
    $('#bridgeType').innerHTML = options([['none', 'Aucun']].concat(Object.keys(H.BRIDGES).map(k =>
      [k, k === 'rel' ? 'Relatif ' + other : k === 'par' ? 'Homonyme ' + other : H.BRIDGES[k].label])), S.bridge.type);
    $('#bridgeBars').value = S.bridge.bars;
    $('#bridgeForm').value = S.bridge.form;
    $('#bridgeBars').disabled = $('#bridgeForm').disabled = $('#bridgeNew').disabled = S.bridge.type === 'none';
    $('#undo').disabled = !undoStack.length;
    renderParts();
  }

  function renderGrid() {
    const hasBridge = S.chords.some(c => c.sec === 'B'), keyName = k => `${pretty(k.tonic)} ${k.minor ? 'mineur' : 'majeur'}`;
    let inBridge = false;
    const L = meter().L;
    $('#grid').style.setProperty('--cols', 4 * L);
    $('#grid').style.setProperty('--cols-narrow', 2 * L);
    $('#grid').innerHTML = S.chords.map((ch, i) => {
      const c = info(ch);
      let head = '';
      if (hasBridge && i === 0) head = `<div class="sect">A · ${keyName(key())}</div>`;
      if (ch.sec === 'B' && !inBridge) {
        inBridge = true;
        head = `<div class="sect">Pont (B) · ${keyName(keyFor(ch))} · forme ${S.bridge.form === 'AABA' ? 'A A B A' : 'A B'}</div>`;
      }
      return `${head}<button class="card fn-${ch.func}${ch.beats * 2 < L ? ' narrow' : ''}${i === sel ? ' sel' : ''}${i === playingIdx ? ' playing' : ''}"
        style="grid-column: span ${Math.min(2 * L, Math.round(ch.beats * 2))}" data-i="${i}" title="${ch.why}">
        <span class="roman">${ch.roman}</span><span class="name">${pretty(c.name)}</span>
        <span class="mode">${pretty(c.root)} ${c.mode}</span></button>`;
    }).join('');
  }

  // ---------- Disque harmonique ----------
  // Le morceau sur le cycle des quintes, tonique en haut : accords majeurs et dominantes sur l'anneau extérieur,
  // accords mineurs sur l'anneau intérieur (à la place de leur relatif majeur). La taille d'un point suit la durée
  // passée sur l'accord, les flèches suivent l'ordre de jeu.

  const FIFTHS_MAJ = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'Db', 'Ab', 'Eb', 'Bb', 'F'];
  const FIFTHS_MIN = ['Am', 'Em', 'Bm', 'F#m', 'C#m', 'G#m', 'Ebm', 'Bbm', 'Fm', 'Cm', 'Gm', 'Dm'];
  const fifthIdx = pc => (pc * 7) % 12;
  function discNode(ch) {
    const pc = info(ch).rootPc, minor = ['m', 'mt', 'ø', 'o'].includes(ch.t);
    return (minor ? 1 : 0) + '-' + fifthIdx(minor ? (pc + 3) % 12 : pc);
  }

  function renderDisc() {
    const el = $('#disc');
    el.hidden = S.view !== 'disc';
    $('#grid').hidden = !!S.view && S.view !== 'grid';
    for (const b of $('#view').children) b.classList.toggle('on', b.dataset.v === (S.view || 'grid'));
    if (el.hidden) return;

    const home = key(), homeIdx = fifthIdx(home.minor ? (home.pc + 3) % 12 : home.pc);
    const C = 210, R = [160, 104];
    const at = (ring, idx, r) => {
      const a = ((idx - homeIdx) * 30 - 90) * Math.PI / 180;
      return [C + (r || R[ring]) * Math.cos(a), C + (r || R[ring]) * Math.sin(a)];
    };
    const f = x => x.toFixed(1);

    // points : un par case du disque occupée
    const nodes = new Map();
    let total = 0;
    S.chords.forEach((ch, i) => {
      const id = discNode(ch);
      if (!nodes.has(id)) nodes.set(id, { id, ring: +id[0], idx: +id.slice(2), beats: 0, fn: {}, names: new Set(), first: i, bridgeOnly: true });
      const N = nodes.get(id);
      N.beats += ch.beats;
      N.fn[ch.func] = (N.fn[ch.func] || 0) + ch.beats;
      N.names.add(pretty(info(ch).name));
      if (ch.sec !== 'B') N.bridgeOnly = false;
      total += ch.beats;
    });
    for (const N of nodes.values()) {
      N.r = 15 + 13 * Math.sqrt(N.beats / total);
      N.main = Object.keys(N.fn).sort((a, b) => N.fn[b] - N.fn[a])[0];
      [N.x, N.y] = at(N.ring, N.idx);
    }

    // flèches : enchaînements dans l'ordre de jeu, retour au début compris
    const order = playOrder(), edges = new Map(), share = { T: 0, SD: 0, D: 0 };
    order.forEach((i, k) => {
      const j = order[(k + 1) % order.length], a = discNode(S.chords[i]), b = discNode(S.chords[j]);
      share[S.chords[i].func] += S.chords[i].beats;
      if (a === b) return;
      const id = a + '>' + b;
      if (!edges.has(id)) edges.set(id, { a: nodes.get(a), b: nodes.get(b), n: 0, bridge: S.chords[i].sec === 'B' || S.chords[j].sec === 'B' });
      edges.get(id).n++;
    });
    const arrows = Array.from(edges.values()).map(e => {
      const mx = (e.a.x + e.b.x) / 2, my = (e.a.y + e.b.y) / 2, cx = mx + (C - mx) * .35, cy = my + (C - my) * .35;
      const trim = (P, r) => { const dx = cx - P.x, dy = cy - P.y, d = Math.hypot(dx, dy) || 1; return [P.x + dx / d * r, P.y + dy / d * r]; };
      const [x1, y1] = trim(e.a, e.a.r + 2), [x2, y2] = trim(e.b, e.b.r + 6);
      return `<path class="edge${e.bridge ? ' bridge' : ''}" d="M${f(x1)} ${f(y1)} Q${f(cx)} ${f(cy)} ${f(x2)} ${f(y2)}" stroke-width="${Math.min(4, .8 + e.n * .7)}" marker-end="url(#arrow)"/>`;
    }).join('');

    // secteur des accords de la tonalité : IV, I, V et leurs relatifs
    const wedge = (r1, r2) => {
      const p = (deg, r) => { const a = deg * Math.PI / 180; return f(C + r * Math.cos(a)) + ' ' + f(C + r * Math.sin(a)); };
      return `M${p(-135, r2)} A${r2} ${r2} 0 0 1 ${p(-45, r2)} L${p(-45, r1)} A${r1} ${r1} 0 0 0 ${p(-135, r1)} Z`;
    };
    const labels = [0, 1].map(ring => (ring ? FIFTHS_MIN : FIFTHS_MAJ).map((name, idx) => {
      if (nodes.has(ring + '-' + idx)) return '';
      const [x, y] = at(ring, idx);
      return `<text class="lbl" x="${f(x)}" y="${f(y)}">${pretty(name)}</text>`;
    }).join('')).join('');
    const dots = Array.from(nodes.values()).map(N => {
      const label = pretty((N.ring ? FIFTHS_MIN : FIFTHS_MAJ)[N.idx]), here = S.chords[sel] && discNode(S.chords[sel]) === N.id;
      return `<g class="node fn-${N.main}${N.bridgeOnly ? ' bridge' : ''}${here ? ' sel' : ''}${playingIdx >= 0 && discNode(S.chords[playingIdx]) === N.id ? ' playing' : ''}" data-node="${N.id}" data-i="${N.first}">
        <title>${Array.from(N.names).join(', ')} — ${N.beats} temps</title>
        <circle cx="${f(N.x)}" cy="${f(N.y)}" r="${f(N.r)}"/><text x="${f(N.x)}" y="${f(N.y)}">${label}</text></g>`;
    }).join('');

    const tot = share.T + share.SD + share.D || 1, pct = k => Math.round(share[k] * 100 / tot);
    const names = new Set(S.chords.map(ch => info(ch).name)), second = S.chords.filter(ch => ch.kind !== 'deg').length;
    const B = S.chords.find(c => c.sec === 'B'), keyName = k => `${pretty(k.tonic)} ${k.minor ? 'mineur' : 'majeur'}`;
    el.innerHTML = `
      <svg viewBox="0 0 420 420" role="img" aria-label="Disque harmonique du morceau">
        <defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z"/></marker></defs>
        <path class="wedge" d="${wedge(74, 192)}"/>
        <circle class="ring" cx="${C}" cy="${C}" r="${R[0]}"/><circle class="ring" cx="${C}" cy="${C}" r="${R[1]}"/>
        ${labels}${arrows}${dots}
      </svg>
      <div class="disc-info">
        <div class="d-name">${keyName(home)}</div>
        <p class="why">${H.STYLES[S.style].label} · ${S.tempo} bpm${B ? ` · pont en ${keyName(keyFor(B))}` : ''}</p>
        <div class="share">${['T', 'SD', 'D'].map(k => `<i class="fn-${k}" style="flex:${share[k] || .001}"></i>`).join('')}</div>
        <div class="legend">${['T', 'SD', 'D'].map(k => `<span class="fn-${k}">${FN[k]} ${pct(k)} %</span>`).join('')}</div>
        <p class="hint">${names.size} accords distincts sur ${nodes.size} positions du disque${second ? ` · ${second} dominante${second > 1 ? 's' : ''} secondaire${second > 1 ? 's' : ''} ou accord${second > 1 ? 's' : ''} de passage` : ''}.</p>
        <p class="hint">La tonique est en haut ; la zone teintée réunit les accords de la tonalité. Plus un point est gros, plus on y reste ; ce qui sort de la zone est un emprunt ou une modulation. Les traits pointillés passent par le pont. Clique un point pour sélectionner l'accord.</p>
      </div>`;
  }

  // ---------- Carte harmonique ----------
  // Tous les accords de la tonalité rangés par fonction (tonique → sous-dominante → dominante), les emprunts
  // en dessous, les dominantes secondaires accrochées à l'accord qu'elles visent. Les flèches de l'accord survolé
  // donnent la probabilité de chaque suite selon le style ; le chemin du morceau est tracé par-dessus.

  let mapFocus = null, mapPin = null, mapClick = 'listen', mapAll = false, mapData = null, mapPrev = null;
  const mapId = ch => (ch.kind === 'deg' ? ch.deg : ch.kind + ':' + ch.target);
  const secOf = ch => (ch && ch.sec === 'B' ? 'B' : 'A');
  const MAP_COLS = {
    major: { T: [['I', 'iii', 'vi'], ['bIII']], SD: [['ii', 'IV'], ['iv', 'bVI', 'bVII', 'bII', '#ivø']], D: [['V'], ['v']] },
    minor: { T: [['i', 'bIII'], []], SD: [['iiø', 'iv', 'bVI'], ['IV', 'bII']], D: [['V', 'v', 'bVII'], ['bV']] },
  };
  const MAP_X = { T: 175, SD: 495, D: 815 }, MAP_ROW = 104, MAP_TOP = 92;
  const FN_HINT = { T: 'repos', SD: 'départ', D: 'tension' };

  function mapLayout() {
    const cur = S.chords[sel], section = secOf(cur);
    const ref = section === 'B' ? S.chords.find(c => c.sec === 'B') : {};
    const M = H.harmonyMap(hstate(), ref), cols = MAP_COLS[M.minor ? 'minor' : 'major'];
    const nodes = new Map();
    for (const n of M.nodes) nodes.set(n.id, { id: n.id, ch: n.ch, fn: n.ch.func, borrowed: n.borrowed, sat: false, beats: 0, pos: [] });

    // degrés : bande diatonique centrée, puis emprunts sur deux sous-colonnes
    const diaRows = Math.max(...Object.values(cols).map(c => c[0].length));
    const borRows = Math.max(...Object.values(cols).map(c => Math.ceil(c[1].length / 2)));
    const borTop = MAP_TOP + diaRows * MAP_ROW + 40;
    for (const fn in cols) {
      const [dia, bor] = cols[fn], x = MAP_X[fn];
      dia.forEach((id, k) => Object.assign(nodes.get(id), { x, y: MAP_TOP + 50 + (k + (diaRows - dia.length) / 2) * MAP_ROW, r: 40 }));
      bor.forEach((id, k) => {
        const two = bor.length > 1, cx = two ? x + (k % 2 ? 72 : -72) : x;
        Object.assign(nodes.get(id), { x: cx, y: borTop + 46 + Math.floor(k / 2) * (MAP_ROW - 10) + (two && k % 2 ? 40 : 0), r: 33 });
      });
    }

    // morceau : la section de l'accord sélectionné, dans l'ordre de jeu
    const order = [];
    S.chords.forEach((c, i) => { if (secOf(c) === section) order.push(i); });
    const satCh = M.sec.slice();
    order.forEach(i => { const c = S.chords[i]; if (c.kind !== 'deg') satCh.push(c); });
    for (const c of satCh) {
      const id = mapId(c);
      if (nodes.has(id) || !nodes.has(c.target)) continue;
      nodes.set(id, { id, ch: c, fn: c.func, sat: true, target: c.target, beats: 0, pos: [] });
    }
    order.forEach((i, k) => {
      const N = nodes.get(mapId(S.chords[i]));
      if (N) { N.beats += S.chords[i].beats; N.pos.push(k + 1); }
    });
    // satellites : ceux du morceau, plus tous ceux de l'accord observé ou si l'on montre tout ;
    // empilés à gauche de leur cible
    const focus = mapFocus || mapPin || (cur ? mapId(cur) : null);
    const near = focus && focus.includes(':') ? focus.split(':')[1] : focus;
    for (const [id, Nd] of nodes) if (Nd.sat && !Nd.beats && !mapAll && Nd.target !== near) nodes.delete(id);
    const stack = {};
    for (const Nd of nodes.values()) if (Nd.sat) (stack[Nd.target] = stack[Nd.target] || []).push(Nd);
    for (const t in stack) stack[t].forEach((Nd, k, all) => {
      const T = nodes.get(t);
      Object.assign(Nd, { x: T.x - T.r - 48, y: T.y + (k - (all.length - 1) / 2) * 38, r: 0, w: 64, h: 34 });
    });
    const path = new Map();
    if (order.length > 1) order.forEach((i, k) => {
      const a = mapId(S.chords[i]), b = mapId(S.chords[order[(k + 1) % order.length]]);
      if (a === b || !nodes.has(a) || !nodes.has(b)) return;
      const e = path.get(a + '>' + b) || { a, b, n: 0 };
      e.n++;
      path.set(a + '>' + b, e);
    });
    const height = borTop + 46 + Math.max(1, borRows) * (MAP_ROW - 10) + 30;
    return { M, nodes, path, order, section, height, borTop, ref };
  }

  // Courbe de a vers b, décalée sur le côté : l'aller et le retour ne se superposent pas.
  function mapCurve(A, B, bend) {
    const dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy) || 1, nx = dy / d, ny = -dx / d;
    const k = (bend == null ? .16 : bend) * Math.min(d, 380);
    const cx = (A.x + B.x) / 2 + nx * k, cy = (A.y + B.y) / 2 + ny * k;
    const ext = (N, r) => { const ux = cx - N.x, uy = cy - N.y, u = Math.hypot(ux, uy) || 1; return [N.x + ux / u * r, N.y + uy / u * r]; };
    const rad = N => (N.sat ? 22 : N.r);
    const [x1, y1] = ext(A, rad(A) + 3), [x2, y2] = ext(B, rad(B) + 7);
    const at = t => [(1 - t) * (1 - t) * x1 + 2 * t * (1 - t) * cx + t * t * x2, (1 - t) * (1 - t) * y1 + 2 * t * (1 - t) * cy + t * t * y2];
    return { d: `M${x1.toFixed(1)} ${y1.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`, at };
  }

  function renderMap() {
    const el = $('#map');
    el.hidden = S.view !== 'map';
    if (el.hidden) return;
    const L = mapData = mapLayout(), N = L.nodes, f = x => x.toFixed(1);
    if (mapPin && !N.has(mapPin)) mapPin = null;
    const selId = S.chords[sel] ? mapId(S.chords[sel]) : null;
    const focus = mapFocus || mapPin || selId;
    const name = ch => pretty(H.chordInfo(ch, keyFor(L.section === 'B' ? L.ref : {})).name);

    // flèches : toutes (en option, très légères), celles du morceau, et celles de l'accord observé
    let html = '';
    const colBg = ['T', 'SD', 'D'].map(fn => `<g class="fn-${fn}"><rect class="col" x="${MAP_X[fn] - 150}" y="18" width="300" height="${L.height - 30}" rx="16"/>
      <text class="colh" x="${MAP_X[fn]}" y="44">${FN[fn]}</text><text class="colsub" x="${MAP_X[fn]}" y="64">${FN_HINT[fn]}</text></g>`).join('');
    html += colBg + `<line class="sep" x1="30" x2="950" y1="${L.borTop}" y2="${L.borTop}"/><text class="seph" x="36" y="${L.borTop + 16}">Emprunts</text>`;

    if (mapAll) for (const e of L.M.edges) {
      if (e.from === e.to) continue;
      const c = mapCurve(N.get(e.from), N.get(e.to));
      html += `<path class="e-all" d="${c.d}" stroke-width="${f(.5 + 3 * e.p)}" style="opacity:${f(.08 + .5 * e.p)}"/>`;
    }
    for (const Nd of N.values()) if (Nd.sat) {
      const c = mapCurve(Nd, N.get(Nd.target), .05);
      html += `<path class="e-res" d="${c.d}" marker-end="url(#mArrowRes)"/>`;
    }
    for (const [id, e] of L.path) {
      const c = mapCurve(N.get(e.a), N.get(e.b));
      html += `<path class="e-song" data-e="${id}" d="${c.d}" stroke-width="${f(Math.min(6, 2 + e.n))}" marker-end="url(#mArrowSong)"/>`;
    }
    let labels = '';
    const F = N.get(focus);
    if (F) {
      const outs = F.sat ? [{ to: F.target, p: 1 }] : L.M.edges.filter(e => e.from === focus && e.to !== focus);
      outs.sort((a, b) => a.p - b.p);
      for (const e of outs) {
        const T = N.get(e.to), c = mapCurve(F, T), [lx, ly] = c.at(.78);
        html += `<path class="e-focus fn-${T.fn}" d="${c.d}" stroke-width="${f(1.2 + 7 * e.p)}" marker-end="url(#mArrow-${T.fn})"/>`;
        if (e.p >= .03) labels += `<g class="pct fn-${T.fn}"><rect x="${f(lx - 19)}" y="${f(ly - 10)}" width="38" height="20" rx="10"/><text x="${f(lx)}" y="${f(ly)}">${Math.round(e.p * 100)}%</text></g>`;
      }
    }

    const nodesHtml = Array.from(N.values()).map(Nd => {
      const used = Nd.beats > 0, cls = `mnode fn-${Nd.fn}${Nd.borrowed ? ' bor' : ''}${Nd.sat ? ' sat' : ''}${used ? ' used' : ''}${Nd.id === selId ? ' sel' : ''}${Nd.id === focus ? ' focus' : ''}`;
      const tip = `${name(Nd.ch)} (${Nd.ch.roman}) — ${Nd.ch.why}`;
      const pos = used ? `<text class="pos" x="${f(Nd.x)}" y="${f(Nd.y + (Nd.sat ? 27 : Nd.r + 14))}">${Nd.pos.slice(0, 6).join(' · ')}${Nd.pos.length > 6 ? '…' : ''}</text>` : '';
      const shape = Nd.sat
        ? `<rect x="${f(Nd.x - Nd.w / 2)}" y="${f(Nd.y - Nd.h / 2)}" width="${Nd.w}" height="${Nd.h}" rx="10"/>`
        : `<circle cx="${f(Nd.x)}" cy="${f(Nd.y)}" r="${Nd.r}"/>`;
      return `<g class="${cls}" data-id="${Nd.id}"><title>${tip}</title>${shape}
        <text class="ro" x="${f(Nd.x)}" y="${f(Nd.y - (Nd.sat ? 7 : 10))}">${Nd.ch.roman}</text>
        <text class="nm" x="${f(Nd.x)}" y="${f(Nd.y + (Nd.sat ? 8 : 9))}"${name(Nd.ch).length > (Nd.sat ? 6 : 7) ? ' style="font-size:' + (Nd.sat ? 10.5 : 12) + 'px"' : ''}>${name(Nd.ch)}</text>${pos}</g>`;
    }).join('');

    const hasB = S.chords.some(c => c.sec === 'B'), k = keyFor(L.section === 'B' ? L.ref : {});
    const arrow = (id, cls) => `<marker id="${id}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4.5" markerHeight="4.5" orient="auto-start-reverse"><path class="${cls}" d="M0 0L10 5L0 10z"/></marker>`;
    el.innerHTML = `
      <div class="map-bar">
        ${hasB ? `<div class="seg" id="mapSec"><button data-v="A" class="${L.section === 'A' ? 'on' : ''}">Grille A</button><button data-v="B" class="${L.section === 'B' ? 'on' : ''}">Pont B</button></div>` : ''}
        <span class="hint">${pretty(k.tonic)} ${k.minor ? 'mineur' : 'majeur'} · ${H.STYLES[S.style].label}</span>
        <span class="spacer"></span>
        <div class="seg" id="mapClick" title="Que fait un clic sur un accord de la carte">${[['listen', 'Écouter'], ['insert', 'Insérer après'], ['replace', 'Remplacer']].map(([v, l]) => `<button data-v="${v}" class="${mapClick === v ? 'on' : ''}">${l}</button>`).join('')}</div>
        <button id="mapAll" class="toggle${mapAll ? ' on' : ''}" title="Afficher toutes les transitions possibles dans ce style">Toutes les transitions</button>
      </div>
      <div class="map-wrap">
        <div class="map-scroll"><svg viewBox="0 0 980 ${L.height}" role="img" aria-label="Carte harmonique de la tonalité">
          <defs>${arrow('mArrowSong', 'a-song')}${arrow('mArrowRes', 'a-res')}${['T', 'SD', 'D'].map(fn => arrow('mArrow-' + fn, 'a-' + fn)).join('')}</defs>
          ${html}${nodesHtml}${labels}
        </svg></div>
        <span class="hs-arrow hs-left" aria-hidden="true">‹</span>
        <span class="hs-arrow hs-right" aria-hidden="true">›</span>
      </div>
      <div class="map-foot">
        <div class="map-cap" id="mapCap">${mapCaption(F, L)}</div>
        <div class="legend"><span class="l-song">chemin du morceau (numéros = ordre)</span><span class="l-bor">emprunt</span><span class="l-sat">dominante secondaire → sa cible</span></div>
      </div>`;
    markMap(playingIdx);
  }

  function mapCaption(F, L) {
    if (!F) return '';
    const c = H.chordInfo(F.ch, keyFor(L.section === 'B' ? L.ref : {}));
    const outs = F.sat ? [] : L.M.edges.filter(e => e.from === F.id && e.to !== F.id).sort((a, b) => b.p - a.p).slice(0, 4);
    const sug = outs.map(e => `${L.nodes.get(e.to).ch.roman} ${Math.round(e.p * 100)} %`).join(' · ');
    return `<b>${pretty(c.name)}</b> <span class="fn-${F.fn} rt">${F.ch.roman} · ${FN[F.fn]}</span> — ${F.ch.why}
      ${F.beats ? `<br><span class="hint">Dans le morceau : position${F.pos.length > 1 ? 's' : ''} ${F.pos.join(', ')} · ${F.beats} temps</span>` : ''}
      ${sug ? `<br><span class="hint">Suites les plus naturelles : ${sug}</span>` : ''}`;
  }

  // Pendant la lecture : l'accord joué s'allume, le dernier enchaînement s'anime.
  function markMap(i) {
    const svg = document.querySelector('#map svg');
    if (!svg || !mapData) return;
    const ch = i >= 0 ? S.chords[i] : null, id = ch && secOf(ch) === mapData.section ? mapId(ch) : null;
    svg.querySelectorAll('.mnode').forEach(el => el.classList.toggle('playing', el.dataset.id === id));
    svg.querySelectorAll('.e-song').forEach(el => el.classList.toggle('live', !!id && el.dataset.e === mapPrev + '>' + id));
    mapPrev = id;
  }

  function mapNodeClick(id) {
    const Nd = mapData.nodes.get(id);
    if (!Nd) return;
    const cur = S.chords[sel];
    const fresh = () => JSON.parse(JSON.stringify(Nd.ch));
    if (mapClick === 'insert' && cur) {
      pushUndo();
      S.chords.splice(sel + 1, 0, Object.assign(fresh(), { beats: meter().L / 2 }));
      sel++;
      mapPin = null;
      changed(true);
    } else if (mapClick === 'replace' && cur) {
      pushUndo();
      S.chords[sel] = Object.assign(fresh(), { beats: cur.beats });
      mapPin = null;
      changed(true);
    } else {
      const k = mapData.order.find(i => mapId(S.chords[i]) === id);
      if (k != null) { mapPin = null; select(k, false); } else { mapPin = id; renderMap(); }
    }
    if (!Player.playing()) Player.chord(Nd.ch);
  }

  function keyboard(c) {
    const cls = pc => (pc === c.rootPc ? 'root' : c.pcs.includes(pc) ? 'ct' : c.scalePcs.includes(pc) ? 'st' : '');
    const white = [0, 2, 4, 5, 7, 9, 11].map(pc => `<i class="w ${cls(pc)}"></i>`).join('');
    const black = [[1, 1], [3, 2], [6, 4], [8, 5], [10, 6]].map(([pc, k]) =>
      `<i class="b ${cls(pc)}" style="left:calc(${(k * 100 / 7).toFixed(3)}% - 4.5%)"></i>`).join('');
    return `<div class="kb">${white}${black}</div>
      <div class="legend"><span class="l-root">fondamentale</span><span class="l-ct">notes de l'accord</span><span class="l-st">notes du mode</span></div>`;
  }

  // ---------- Vues instrument : guitare et basse avec doigtés ----------
  // Doigts de la main gauche : 1 index, 2 majeur, 3 annulaire, 4 auriculaire ; 0 = corde à vide.

  const GUITAR = [40, 45, 50, 55, 59, 64]; // mi la ré sol si mi, du grave à l'aigu
  const BASS4 = [28, 33, 38, 43];          // mi la ré sol
  const PC_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
  const shapeCache = new Map();

  // Doigts pour une position (frets[i] : case jouée sur la corde i, 0 à vide, -1 étouffée).
  // Jusqu'à quatre cases : un doigt chacune, de la plus basse à la plus haute. Au-delà : barré de l'index sur la plus basse.
  function fingersFor(frets) {
    const fretted = frets.map((f, i) => ({ f, i })).filter(x => x.f > 0).sort((a, b) => a.f - b.f || a.i - b.i);
    const fingers = frets.map(f => (f > 0 ? 0 : null));
    if (fretted.length <= 4) {
      fretted.forEach((x, k) => { fingers[x.i] = k + 1; });
      return { fingers, barre: null, used: fretted.length };
    }
    const minF = fretted[0].f, atMin = fretted.filter(x => x.f === minF), rest = fretted.filter(x => x.f > minF);
    if (atMin.length < 2 || rest.length > 3) return null;
    const from = Math.min(...atMin.map(x => x.i)), to = frets.reduce((hi, f, i) => (f >= 0 ? i : hi), 0);
    for (let i = from; i <= to; i++) if (frets[i] === 0) return null; // pas de corde à vide sous un barré
    atMin.forEach(x => { fingers[x.i] = 1; });
    // si rien ne tombe juste au-dessus du barré, on garde le majeur libre (forme de mi mineur barrée : 1 3 4 1 1 1)
    const first = rest.length <= 2 && rest.length && rest[0].f >= minF + 2 ? 3 : 2;
    rest.forEach((x, k) => { fingers[x.i] = k + first; });
    return { fingers, barre: { fret: minF, from, to }, used: 1 + rest.length };
  }

  // Meilleure position de l'accord sur le manche : fondamentale à la basse, cordes jouées sans trou, tierce (ou sus)
  // et septième présentes, écart de quatre cases au plus ; on préfère les positions basses, les cordes à vide et les accords complets.
  function guitarShape(c, iv) {
    const id = c.rootPc + ':' + iv.join(',');
    if (shapeCache.has(id)) return shapeCache.get(id);
    const want = new Set(c.pcs), root = c.rootPc, ivm = iv.map(x => x % 12);
    const third = ivm.find(x => x >= 2 && x <= 5), seventh = ivm.find(x => x === 10 || x === 11);
    const ess = [0, third, seventh].filter(x => x != null).map(x => (root + x) % 12);
    const minStrings = Math.min(4, want.size + 1);
    let best = null, bestScore = -Infinity;
    const evaluate = frets => {
      const sounding = [];
      frets.forEach((f, i) => { if (f >= 0) sounding.push(i); });
      if (sounding.length < minStrings || sounding[sounding.length - 1] - sounding[0] + 1 !== sounding.length) return;
      if ((GUITAR[sounding[0]] + frets[sounding[0]]) % 12 !== root) return;
      const got = new Set(sounding.map(i => (GUITAR[i] + frets[i]) % 12));
      if (ess.some(pc => !got.has(pc))) return;
      const fretted = frets.filter(f => f > 0), lo = fretted.length ? Math.min(...fretted) : 0, hi = fretted.length ? Math.max(...fretted) : 0;
      if (hi - lo > 3) return;
      const fg = fingersFor(frets);
      if (!fg) return;
      // cordes à vide appréciées en première position seulement ; plus haut, elles donnent des doigtés inhabituels
      const perString = want.size <= 2 && sounding.length > 3 ? -1 : 1.5; // accord de puissance : deux ou trois cordes
      const score = got.size * 3 + sounding.length * perString - (hi - lo) * 1.2 - lo * .35 + frets.filter(f => f === 0).length * (lo <= 3 ? .4 : -.6) - fg.used * .25 - (fg.barre ? .3 : 0);
      if (score > bestScore) { bestScore = score; best = { frets: frets.slice(), fingers: fg.fingers, barre: fg.barre }; }
    };
    for (let start = 0; start <= 9; start++) {
      const opts = GUITAR.map(open => {
        const o = [-1];
        if (want.has(open % 12)) o.push(0);
        for (let f = Math.max(1, start); f <= start + 3; f++) if (want.has((open + f) % 12)) o.push(f);
        return o;
      });
      const cur = [];
      const rec = si => { if (si === 6) return evaluate(cur); for (const f of opts[si]) { cur[si] = f; rec(si + 1); } };
      rec(0);
    }
    shapeCache.set(id, best);
    return best;
  }

  const noteName = (c, pc) => {
    const k = c.pcs.indexOf(pc);
    if (k >= 0) return pretty(c.notes[k]);
    const j = c.scalePcs.indexOf(pc);
    return pretty(j >= 0 ? c.scaleNotes[j] : PC_NAMES[pc]);
  };
  const DEGREE = { 0: '1', 1: '♭9', 2: '9', 3: '♭3', 4: '3', 5: '4', 6: '♭5', 7: '5', 8: '♯5', 9: '6', 10: '♭7', 11: '7' };

  // Diagramme horizontal, comme pour la basse : mi aigu en haut, mi grave en bas, sillet à gauche.
  function guitarView(c, iv) {
    const sh = guitarShape(c, iv);
    if (!sh) return '<p class="hint">Pas de position confortable trouvée pour cet accord à la guitare.</p>';
    const fretted = sh.frets.filter(f => f > 0), top = fretted.length ? Math.max(...fretted) : 0;
    const base = top <= 5 ? 1 : Math.min(...fretted), NUT = 40, W = 44, Y = s => 16 + (5 - s) * 20, cx = f => NUT + (f - base + .5) * W;
    let g = '';
    for (let s = 0; s < 6; s++) g += `<line class="string" x1="${NUT}" x2="${NUT + 5 * W}" y1="${Y(s)}" y2="${Y(s)}"/>`;
    g += `<line class="fret${base === 1 ? ' nut' : ''}" x1="${NUT}" x2="${NUT}" y1="${Y(5)}" y2="${Y(0)}"/>`;
    for (let k = 1; k <= 5; k++) {
      g += `<line class="fret" x1="${NUT + k * W}" x2="${NUT + k * W}" y1="${Y(5)}" y2="${Y(0)}"/>`;
      g += `<text class="fr" x="${NUT + (k - .5) * W}" y="${Y(0) + 20}">${base + k - 1}</text>`;
    }
    if (sh.barre) {
      const y1 = Y(sh.barre.to), y2 = Y(sh.barre.from);
      g += `<rect class="barre" x="${cx(sh.barre.fret) - 9}" y="${y1 - 9}" width="18" height="${y2 - y1 + 18}" rx="9"/>`;
    }
    sh.frets.forEach((f, s) => {
      const pc = (GUITAR[s] + Math.max(0, f)) % 12, deg = DEGREE[(pc - c.rootPc + 12) % 12];
      if (f < 0) g += `<text class="mark" x="${NUT - 18}" y="${Y(s)}">×</text>`;
      else if (f === 0) g += `<circle class="open${pc === c.rootPc ? ' root' : ''}" cx="${NUT - 18}" cy="${Y(s)}" r="5"><title>${noteName(c, pc)} (${deg}) à vide</title></circle>`;
      else if (!(sh.barre && f === sh.barre.fret && sh.fingers[s] === 1 && s !== sh.barre.to)) {
        g += `<g class="dot${pc === c.rootPc ? ' root' : ''}"><title>${noteName(c, pc)} (${deg}) — doigt ${sh.fingers[s]}</title><circle cx="${cx(f)}" cy="${Y(s)}" r="9"/><text x="${cx(f)}" y="${Y(s)}">${sh.fingers[s]}</text></g>`;
      }
      if (f >= 0) g += `<text class="nn" x="${NUT + 5 * W + 16}" y="${Y(s)}">${noteName(c, pc)}</text><text class="dg" x="${NUT + 5 * W + 40}" y="${Y(s)}">${deg}</text>`;
    });
    for (let s = 0; s < 6; s++) g += `<text class="sn" x="10" y="${Y(s)}">${['E', 'A', 'D', 'G', 'B', 'e'][s]}</text>`;
    const tab = sh.frets.map(f => (f < 0 ? 'x' : f)).join(' ');
    return `<div class="fretboard"><svg viewBox="0 0 320 146" class="gtr" role="img" aria-label="Diagramme guitare">${g}</svg>
      <div class="fb-info"><div class="tab">${tab}</div><p class="hint">Mi aigu en haut, mi grave en bas ; cases numérotées sous le manche.${base > 1 ? ` Position en ${base}<sup>e</sup> case.` : ''}${sh.barre ? ' Barré de l\'index.' : ''}</p></div></div>`;
  }

  // Basse : une case par doigt autour de la fondamentale (sur la corde de mi, ou de la si elle tombe trop haut).
  function bassView(c, iv) {
    let s0 = 0, rf = (c.rootPc - 4 + 12) % 12;
    if (rf > 7) { s0 = 1; rf = (c.rootPc - 9 + 12) % 12; }
    // accord mineur : fondamentale à l'index (la tierce mineure tombe dans la case) ; sinon au majeur, l'index restant libre pour la tierce
    const minor3 = iv.some(x => x % 12 === 3) && !iv.some(x => x % 12 === 4);
    const base = Math.max(1, minor3 ? rf : rf - 1), frets = [0, base, base + 1, base + 2, base + 3];
    const tones = new Set(iv.map(x => (c.rootPc + x) % 12)), X = k => 30 + k * 48, Y = s => 22 + (3 - s) * 24;
    let g = '';
    for (let s = 0; s < 4; s++) g += `<line class="string" x1="${X(0)}" x2="${X(4) + 24}" y1="${Y(s)}" y2="${Y(s)}"/><text class="sn" x="12" y="${Y(s)}">${['E', 'A', 'D', 'G'][s]}</text>`;
    g += `<line class="fret nut" x1="${X(0) + 24}" x2="${X(0) + 24}" y1="${Y(3)}" y2="${Y(0)}"/>`;
    for (let k = 1; k <= 4; k++) g += `<line class="fret" x1="${X(k) + 24}" x2="${X(k) + 24}" y1="${Y(3)}" y2="${Y(0)}"/><text class="fr" x="${X(k)}" y="${Y(0) + 22}">${frets[k]}</text>`;
    const order = [];
    for (let s = 0; s < 4; s++) frets.forEach((f, k) => {
      if (k === 0 && base > 1) return; // corde à vide seulement en première position
      const pc = (BASS4[s] + f) % 12;
      if (!tones.has(pc)) return;
      const finger = f === 0 ? 0 : f - base + 1, deg = DEGREE[(pc - c.rootPc + 12) % 12], isRoot = pc === c.rootPc;
      if (s >= s0) order.push({ s, f, deg, isRoot });
      g += `<g class="dot${isRoot ? ' root' : ''}${f === 0 ? ' open' : ''}"><title>${noteName(c, pc)} (${deg}) — ${f === 0 ? 'corde à vide' : 'doigt ' + finger}</title>
        <circle cx="${X(k)}" cy="${Y(s)}" r="9"/><text x="${X(k)}" y="${Y(s)}">${finger}</text></g>`;
    });
    // arpège conseillé : depuis la fondamentale, en montant
    const path = order.filter(o => o.s > s0 || (o.s === s0 && o.f >= rf)).sort((a, b) => a.s - b.s || a.f - b.f).slice(0, 5).map(o => o.deg).join(' – ');
    return `<div class="fretboard"><svg viewBox="0 0 270 118" class="bass" role="img" aria-label="Manche de basse">${g}</svg>
      <div class="fb-info"><p class="hint">Une case par doigt à partir de la ${base}<sup>${base === 1 ? 're' : 'e'}</sup> case, fondamentale sur la corde de ${s0 ? 'la' : 'mi'}.</p>
      <p class="hint">Arpège : ${path}</p></div></div>`;
  }

  // Sélecteur Piano/Basse/Guitare, renvoyé séparément pour pouvoir l'ancrer à côté du nom de l'accord sur mobile.
  function instrumentSelector() {
    return `<div class="seg" id="instrView">${[['piano', 'Piano'], ['bass', 'Basse'], ['guitar', 'Guitare']].map(([v, l]) =>
      `<button data-v="${v}" class="${v === S.instrView ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  }
  function instrumentDiagram(c, ch) {
    const iv = H.Q[ch.q].iv;
    const view = S.instrView === 'guitar' ? guitarView(c, iv) : S.instrView === 'bass' ? bassView(c, iv) : keyboard(c);
    const legend = S.instrView === 'piano' ? '' : '<div class="legend"><span class="l-root">fondamentale</span><span class="l-ct">notes de l\'accord</span><span class="l-fg">chiffres : doigts (1 index … 4 auriculaire), 0 ou o : à vide, × : étouffée</span></div>';
    return view + legend;
  }

  function chip(s, i, kind) {
    const c = info(s.ch);
    return `<button class="chip fn-${s.ch.func}" data-${kind}="${i}" title="${s.ch.why}"><b>${pretty(c.name)}</b><small>${s.ch.roman}</small></button>`;
  }

  function groups(list, field, order, kind) {
    return order.filter(g => list.some(s => s[field] === g)).map(g =>
      `<div class="group"><div class="gl">${g}</div><div class="chips">${
        list.map((s, i) => (s[field] === g ? chip(s, i, kind) : '')).join('')}</div></div>`).join('');
  }

  // Durées proposées pour un accord, en noires : demi-mesure (coupée sur un temps), une mesure, deux mesures.
  function durations() {
    const m = meter();
    return [[m.split / 2, m.split * 2 === m.L ? 'Demi-mesure' : 'Début de mesure'], [m.L / 2, '1 mesure'], [m.L, '2 mesures']];
  }

  function renderDetail() {
    const ch = S.chords[sel];
    if (!ch) { $('#detail').innerHTML = ''; return; }
    const c = info(ch);
    repl = H.suggestReplace(hstate(), sel);
    next = H.suggestNext(hstate(), sel);
    $('#detail').innerHTML = `
      <div class="d-top">
        <div>
          <div class="d-head">
            <div class="d-name">${pretty(c.name)}</div>
            <div class="d-meta fn-${ch.func}"><span class="badge">${ch.roman}</span><span class="badge">${FN[ch.func]}</span></div>
            ${instrumentSelector()}
          </div>
          <p class="why">${ch.why}</p>
          <div class="row" style="flex-wrap:wrap">
            <span class="hint">Durée</span>
            <div class="seg" id="beats">${durations().map(([b, l]) => `<button data-v="${b}" class="${b === ch.beats ? 'on' : ''}">${l}</button>`).join('')}</div>
            <button id="listen">Écouter</button>
            <button id="del" ${ch.sec !== 'B' && gridChords().length < 2 ? 'disabled' : ''}>Supprimer</button>
          </div>
        </div>
        <div>
          <h4>Notes de l'accord</h4>
          <div class="notes">${c.notes.map(pretty).join('  ')}</div>
          ${instrumentDiagram(c, ch)}
          <h4>Mode conseillé</h4>
          <div class="modeline">${pretty(c.root)} ${c.mode}</div>
          <div class="notes">${c.scaleNotes.map(pretty).join('  ')}</div>
        </div>
      </div>
      <div class="d-sug">
        <div><h4>Remplacer par</h4>${groups(repl, 'group', ['Autre couleur', 'Même fonction', 'Vers l’accord suivant'], 'repl') || '<p class="hint">Pas d’alternative évidente à cet endroit.</p>'}</div>
        <div><h4>Continuer avec</h4>${groups(next, 'tier', ['attendu', 'coloré', 'surprenant'], 'next')}</div>
      </div>`;
  }

  function select(i, sound) {
    sel = Math.max(0, Math.min(S.chords.length - 1, i));
    renderGrid();
    renderDisc();
    renderMap();
    renderDetail();
    if (sound && !Player.playing()) Player.chord(S.chords[sel]);
  }

  // ---------- Arpèges ----------

  const isArp = () => S.parts.chords.play !== 'style' && S.parts.chords.play !== 'block';

  // Notes de l'arpège : le voicing prolongé à l'octave, parcouru selon le sens choisi.
  function arpCycle(v) {
    const n = Math.max(4, v.notes.length + 1), play = S.parts.chords.play;
    const asc = v.notes.concat(v.notes.map(m => m + 12)).slice(0, n);
    if (play === 'down') return asc.reverse();
    if (play === 'updown') return asc.concat(asc.slice(1, -1).reverse());
    return asc;
  }
  // q : croche dans la boucle. Tous les tirages en dépendent, pour que l'export MIDI redonne ce qu'on entend.
  // Variation : certaines mesures retournent l'arpège ou le font partir d'une autre note.
  function arpNote(v, k, q) {
    const C = S.parts.chords, bar = Math.floor(q / meter().L);
    let cyc = arpCycle(v);
    if (H.rand(C.seed, bar, 31) < C.vari * .5) cyc = cyc.slice().reverse();
    if (C.play === 'random') return cyc[Math.floor(H.rand(C.seed, q, k + 40) * cyc.length)];
    const shift = H.rand(C.seed, bar, 33) < C.vari * .4 ? Math.floor(H.rand(C.seed, bar, 32) * cyc.length) : 0;
    return cyc[(k + shift) % cyc.length];
  }

  // ---------- Mélodie et basse écrites ----------
  // Recalculées seulement quand la grille, la tonalité ou leurs réglages changent : elles restent les mêmes d'une boucle à l'autre.

  const gridSig = () => [playOrder().map(i => S.chords[i]).map(c => [c.semis, c.q, c.mode, c.beats, c.up, c.km]), S.tonic, S.minor];
  function cached(cache, sig, make) {
    const k = JSON.stringify(sig);
    if (cache.key !== k) {
      const list = make();
      const byStep = new Map(); // croche -> notes qui y commencent (les triolets tombent entre les doubles)
      for (const n of list) { const q = Math.floor(n.t / 2 + 1e-6); if (!byStep.has(q)) byStep.set(q, []); byStep.get(q).push(n); }
      Object.assign(cache, { key: k, list, byStep });
    }
    return cache;
  }
  const melCache = { key: '' }, bassCache = { key: '' };
  function melNotes() {
    const M = S.parts.mel;
    return cached(melCache, [gridSig(), M.seed, M.play, M.bars, M.color, M.vari, M.air, M.octave, M.contour],
      () => H.melody(pstate(), { seed: M.seed, density: M.play, bars: M.bars, color: M.color, vari: M.vari, air: M.air, octave: M.octave, contour: M.contour }));
  }
  // 'style' : la basse vient du motif d'accompagnement ; sinon une ligne écrite par le moteur.
  const bassWritten = () => S.parts.bass.play !== 'style';
  function bassNotes() {
    const B = S.parts.bass;
    // calée sur la grosse caisse, la ligne dépend aussi de tout ce qui façonne la batterie
    const D = S.parts.drums, drumSig = B.rhythm === 'kick' ? [S.style, D.play, D.bars, D.color, D.vari, D.dyn, D.seed] : 0;
    return cached(bassCache, [gridSig(), B.seed, B.play, B.rhythm, B.bars, B.color, B.vari, drumSig],
      () => H.bassLine(pstate(), { seed: B.seed, variant: B.play, rhythm: B.rhythm, bars: B.bars, color: B.color, vari: B.vari, kick: bar => drumBar(bar).k }));
  }

  // Dynamique : 0 = tout au même niveau ; plus haut, les temps forts ressortent, les notes en l'air s'effacent,
  // et les accents déjà écrits dans les motifs sont creusés. pos16 : double croche dans la boucle.
  function dynVel(part, base, pos16) {
    const P = S.parts[part];
    const m = meter(), b = pos16 % m.B16; // accent selon la place dans la mesure : premier temps, autres temps, croches, doubles
    const a = (b === 0 ? .25 : m.starts16.includes(b) ? .08 : pos16 % 2 === 0 ? -.1 : -.2) + (H.rand(P.seed, pos16, 70) - .5) * .3;
    return Math.max(.1, Math.min(1.25, (.7 + (base - .7) * P.dyn * 2) * (1 + P.dyn * a)));
  }

  // ---------- Audio ----------

  const TIMBRES = {
    keys: { oscs: [['sine', 0, 1], ['triangle', 0, .45], ['sine', 12, .1]], a: .006, d: .9, s: .25, r: .25, cut: 2600 },
    guitar: { oscs: [['sawtooth', 0, .45], ['square', 0, .2]], a: .004, d: .35, s: .3, r: .1, cut: 1900 },
    pad: { oscs: [['sawtooth', -.07, .4], ['sawtooth', .07, .4]], a: .03, d: .5, s: .6, r: .3, cut: 1500 },
    dist: { oscs: [['sawtooth', 0, .5], ['square', 0, .3], ['sawtooth', -12, .3]], a: .004, d: .5, s: .6, r: .08, cut: 2600 },
    lead: { oscs: [['triangle', 0, .8], ['sine', 12, .2], ['sawtooth', 0, .12]], a: .01, d: .6, s: .7, r: .15, cut: 3200 },
    synth: { oscs: [['sawtooth', 0, .5], ['square', -12, .2]], a: .005, d: .3, s: .4, r: .12, cut: 2400 },
    strings: { oscs: [['sawtooth', -.05, .35], ['sawtooth', .05, .35], ['triangle', 0, .3]], a: .08, d: .6, s: .8, r: .35, cut: 2200 },
    pluck: { oscs: [['sawtooth', 0, .4], ['triangle', 12, .2]], a: .003, d: .25, s: .15, r: .15, cut: 3000 },
    organ: { oscs: [['square', 0, .3], ['sine', 12, .3], ['triangle', 0, .3]], a: .02, d: .4, s: .8, r: .1, cut: 2600 },
    // harmoniques et attaque marquée : la basse doit rester lisible sur de petits haut-parleurs, notes répétées comprises
    bass: { oscs: [['sine', 0, 1], ['triangle', 0, .4], ['sawtooth', 0, .18], ['sine', 12, .15]], a: .004, d: .22, s: .45, r: .06, cut: 1100 },
  };

  // Motifs sur 8 croches : c = [vélocité, durée en croches] pour l'accord, b = [note, vélocité, durée] pour la basse.
  const PATTERNS = {
    jazz: { timbre: 'keys', swing: .33, c: { 0: [.8, 2.6], 3: [.6, 1] }, b: { 0: ['r', .9, 1.9], 2: ['3', .8, 1.9], 4: ['5', .85, 1.9], 6: ['3', .8, 1.9] } },
    bossa: { timbre: 'keys', swing: 0, c: { 0: [.7, 2], 3: [.6, 2], 6: [.6, 1.6] }, b: { 0: ['r', .9, 2.6], 3: ['r', .5, .8], 4: ['5', .85, 2.6], 7: ['5', .5, .8] } },
    rock: { timbre: 'guitar', swing: 0, c: { 0: [.8, .9], 1: [.5, .9], 2: [.6, .9], 3: [.5, .9], 4: [.8, .9], 5: [.5, .9], 6: [.6, .9], 7: [.5, .9] },
      b: { 0: ['r', .9, .9], 1: ['r', .7, .9], 2: ['r', .8, .9], 3: ['r', .7, .9], 4: ['r', .9, .9], 5: ['r', .7, .9], 6: ['r', .8, .9], 7: ['r', .7, .9] } },
    electro: { timbre: 'pad', swing: 0, c: { 0: [.7, 2.8], 3: [.6, 2.8], 6: [.6, 1.8] }, b: { 0: ['r', .9, 1.5], 3: ['r', .8, 1.5], 6: ['r', .8, 1.2] } },
    downtempo: { timbre: 'keys', swing: .1, c: { 0: [.7, 6], 6: [.45, 2] }, b: { 0: ['r', .9, 3], 5: ['r', .6, 1], 6: ['5', .7, 1.8] } },
    disco: { timbre: 'keys', swing: 0, c: { 0: [.7, 1], 3: [.6, 1], 5: [.5, .8], 6: [.65, 1.5] },
      b: { 0: ['r', .9, .9], 1: ['8', .7, .9], 2: ['r', .8, .9], 3: ['8', .7, .9], 4: ['r', .9, .9], 5: ['8', .7, .9], 6: ['r', .8, .9], 7: ['8', .7, .9] } },
    metal: { timbre: 'dist', swing: 0, c: { 0: [.8, .7], 1: [.55, .7], 2: [.55, .7], 3: [.55, .7], 4: [.8, .7], 5: [.55, .7], 6: [.55, .7], 7: [.55, .7] }, b: { 0: ['r', .9, .7], 1: ['r', .7, .7], 2: ['r', .7, .7], 3: ['r', .7, .7], 4: ['r', .9, .7], 5: ['r', .7, .7], 6: ['r', .7, .7], 7: ['r', .7, .7] } },
    punk: { timbre: 'dist', swing: 0, c: { 0: [.85, .9], 1: [.7, .9], 2: [.7, .9], 3: [.7, .9], 4: [.85, .9], 5: [.7, .9], 6: [.7, .9], 7: [.7, .9] }, b: { 0: ['r', .9, .9], 1: ['r', .7, .9], 2: ['r', .7, .9], 3: ['r', .7, .9], 4: ['r', .9, .9], 5: ['r', .7, .9], 6: ['r', .7, .9], 7: ['r', .7, .9] } },
    sludge: { timbre: 'dist', swing: 0, c: { 0: [.9, 3.8], 4: [.7, 2], 6: [.6, 1.8] }, b: { 0: ['r', .95, 3.8], 4: ['r', .8, 2], 6: ['r', .7, 1.8] } },
    stoner: { timbre: 'dist', swing: .2, c: { 0: [.85, 2.6], 3: [.6, .9], 4: [.75, 1.8], 6: [.6, .9], 7: [.5, .9] },
      b: { 0: ['r', .95, 2.6], 3: ['r', .7, .9], 4: ['r', .85, 1.8], 6: ['5', .7, .9], 7: ['r', .6, .9] } },
    pop: { timbre: 'keys', swing: 0, c: { 0: [.75, 2.8], 3: [.55, 1], 4: [.7, 1.8], 6: [.55, 1.6] }, b: { 0: ['r', .9, 2.8], 3: ['r', .6, .9], 4: ['r', .85, 2], 6: ['5', .7, 1.6] } },
    ballad: { timbre: 'pad', swing: 0, c: { 0: [.7, 7.6] }, b: { 0: ['r', .9, 7.6] } },
    hymn: { timbre: 'keys', swing: 0, c: { 0: [.75, 3.8], 4: [.6, 3.8] }, b: { 0: ['r', .9, 7.6] } },
    baroque: { timbre: 'pluck', swing: 0, c: { 0: [.75, 1.8], 2: [.55, 1.8], 4: [.7, 1.8], 6: [.55, 1.8] }, b: { 0: ['r', .9, 1.9], 2: ['3', .75, 1.9], 4: ['5', .8, 1.9], 6: ['3', .75, 1.9] } },
    folk: { timbre: 'guitar', swing: 0, c: { 0: [.8, 1.8], 2: [.6, .9], 3: [.5, .9], 4: [.75, .9], 5: [.5, .9], 6: [.6, .9], 7: [.5, .9] }, b: { 0: ['r', .9, 3.5], 4: ['5', .8, 3.5] } },
    country: { timbre: 'guitar', swing: 0, offbeat: true, c: { 2: [.7, .9], 6: [.7, .9] }, b: { 0: ['r', .95, 1.8], 4: ['5', .85, 1.8] } },
    boogie: { timbre: 'keys', swing: .33, c: { 0: [.7, 1.6], 3: [.6, 1], 4: [.7, 1.6], 7: [.6, 1] },
      b: { 0: ['r', .9, .9], 1: ['r', .7, .9], 2: ['3', .85, .9], 3: ['3', .7, .9], 4: ['5', .9, .9], 5: ['5', .7, .9], 6: ['3', .85, .9], 7: ['3', .7, .9] } },
    manouche: { timbre: 'guitar', swing: .33, c: { 0: [.6, .9], 2: [.85, .5], 4: [.6, .9], 6: [.85, .5] }, b: { 0: ['r', .9, 1.8], 4: ['5', .85, 1.8] } },
    reggae: { timbre: 'guitar', swing: .12, offbeat: true, c: { 2: [.75, .7], 6: [.75, .7] }, b: { 0: ['r', .9, 1.5], 3: ['r', .7, .9], 4: ['5', .8, 1.4], 7: ['r', .6, .8] } },
    ska: { timbre: 'guitar', swing: 0, offbeat: true, c: { 1: [.7, .5], 3: [.7, .5], 5: [.7, .5], 7: [.7, .5] }, b: { 0: ['r', .9, 1.8], 2: ['3', .8, 1.8], 4: ['5', .85, 1.8], 6: ['3', .8, 1.8] } },
    funk: { timbre: 'guitar', swing: 0, c: { 0: [.8, .6], 2: [.5, .4], 3: [.7, .6], 5: [.6, .5], 6: [.5, .4] },
      b: { 0: ['r', .95, 1.2], 2: ['r', .6, .5], 3: ['8', .8, .8], 5: ['r', .7, .8], 6: ['5', .8, .8], 7: ['r', .6, .6] } },
    montuno: { timbre: 'keys', swing: 0, c: { 0: [.7, .9], 2: [.6, .9], 3: [.7, .9], 5: [.65, .9], 6: [.6, .9], 7: [.6, .9] }, b: { 0: ['r', .8, 2.5], 3: ['5', .9, 2.6], 6: ['r', .9, 1.8] } },
    tango: { timbre: 'keys', swing: 0, c: { 0: [.9, .8], 2: [.7, .8], 4: [.8, .8], 6: [.7, .8], 7: [.5, .5] }, b: { 0: ['r', .95, 1.6], 2: ['r', .7, 1.6], 4: ['5', .85, 1.6], 6: ['r', .7, 1.6] } },
    trance: { timbre: 'synth', swing: 0, offbeat: true, c: { 1: [.6, .7], 3: [.6, .7], 5: [.6, .7], 7: [.6, .7] }, b: { 1: ['r', .85, .8], 3: ['r', .85, .8], 5: ['r', .85, .8], 7: ['r', .85, .8] } },
    stab: { timbre: 'keys', swing: 0, offbeat: true, c: { 3: [.65, .7], 6: [.55, .7] }, b: { 0: ['r', .9, 1.4], 3: ['r', .7, .8], 5: ['8', .6, .6], 6: ['r', .8, 1.2] } },
    trap: { timbre: 'keys', swing: 0, c: { 0: [.7, 7.6] }, b: { 0: ['r', 1, 3.5], 5: ['r', .8, 1], 6: ['8', .7, 1.5] } },
    djent: { timbre: 'dist', swing: 0, c: { 0: [.9, .6], 3: [.8, .6], 6: [.8, .6], 7: [.6, .5] }, b: { 0: ['r', .95, .6], 3: ['r', .85, .6], 6: ['r', .85, .6], 7: ['r', .7, .5] } },
    hiphop: { timbre: 'keys', swing: .18, c: { 0: [.75, 4.6], 5: [.5, 2.6] }, b: { 0: ['r', .95, 2.6], 3: ['r', .6, .8], 6: ['5', .7, 1.4] } },
  };

  // Le style nomme son motif d'accompagnement et son kit ; il peut remplacer le timbre du motif.
  // Timbre réellement joué par les accords : hors motif du style, un pad devient un piano électrique (plaqués, arpèges).
  // La lecture et le programme MIDI de la piste Accords s'en servent tous les deux.
  const chordTimbre = () => { const P = pattern(); return S.parts.chords.play !== 'style' && P.timbre === 'pad' ? 'keys' : P.timbre; };

  // Si l'option est active et que la mesure a ses propres motifs, ils remplacent ceux du style (le timbre reste celui du style).
  const ownMeter = () => S.meterOwn && !!METER_KITS[S.meter];
  const pattern = () => {
    const st = H.STYLES[S.style], P = PATTERNS[st.comp], timbre = st.timbre || P.timbre;
    if (ownMeter()) return Object.assign({}, METER_COMPS[S.meter], { timbre });
    return st.timbre ? Object.assign({}, P, { timbre: st.timbre }) : P;
  };
  const kit = () => (ownMeter() ? METER_KITS[S.meter] : DRUMS[H.STYLES[S.style].drums]);

  // ---------- Motifs propres à certaines mesures ----------
  // Accompagnement : positions en croches dans la mesure (0 .. L-1). Batterie : lignes de B16 doubles croches par mesure.
  const allEighths = (L, beat, off, len) => { const o = {}; for (let e = 0; e < L; e++) o[e] = [e % 3 ? off : beat, len]; return o; };
  const METER_COMPS = {
    '3/4': { swing: 0, offbeat: true, label: 'Valse', c: { 2: [.7, 1.6], 4: [.7, 1.6] }, b: { 0: ['r', .95, 1.8] } },
    '6/8': { swing: 0, label: 'Ballade en 6/8', c: { 0: [.75, 1.8], 2: [.5, .9], 3: [.65, 1.8], 5: [.5, .9] }, b: { 0: ['r', .9, 2.8], 3: ['5', .8, 2.8] } },
    '7/8': { swing: 0, label: '7/8 (2+2+3)', c: { 0: [.8, 1.6], 2: [.6, 1.6], 4: [.7, 2.6] }, b: { 0: ['r', .95, 1.8], 2: ['5', .8, 1.8], 4: ['r', .9, 2.8] } },
    '12/8': { swing: 0, label: 'Blues en 12/8', c: allEighths(12, .7, .45, .9), b: { 0: ['r', .95, 2.6], 3: ['3', .8, 2.6], 6: ['5', .85, 2.6], 9: ['3', .8, 2.6] } },
  };
  const METER_KITS = {
    '3/4': { // valse : grosse caisse sur le 1, caisse claire sur le 2 et le 3
      kick: [120, 45, .25],
      soft: { k: 'x...........', b: '....x...x...' },
      mid: { k: 'x...........', s: '....o...o...', h: 'x...x...x...' },
      high: { k: 'x.......x...', s: '....x...x...', h: 'x.x.x.x.x.x.', fill: { s: '....x.x.xxxx' } },
    },
    '6/8': { // deux temps de trois croches : grosse caisse sur le 1, caisse claire sur le 2
      kick: [130, 45, .3],
      soft: { k: 'x...........', h: 'o.o.o.o.o.o.' },
      mid: { k: 'x...........', s: '......x.....', h: 'x.x.x.x.x.x.' },
      high: { k: 'x...x.x.....', s: '......x.....', h: 'x.x.x.x.x.x.', o: '..........x.', fill: { s: '......x.x.xx' } },
    },
    '7/8': { // 2+2+3 : grosse caisse sur les temps 1 et 3, caisse claire sur le 2 et l'en-l'air du 3
      kick: [140, 45, .25],
      soft: { k: 'x.......x.....', r: '....x.........', h: 'x.x.x.x.x.x.x.' },
      mid: { k: 'x.......x.....', s: '....x.......x.', h: 'x.x.x.x.x.x.x.' },
      high: { k: 'x.x.....x.x...', s: '....x.......x.', h: 'x.xxx.xxx.xxx.', fill: { s: '....x...x.x.xx' } },
    },
    '12/8': { // blues lent : quatre temps de trois croches, shuffle sur le charley
      kick: [130, 45, .3],
      soft: { k: 'x...........x...........', r: '......x...........x.....', h: 'o.o.o.o.o.o.o.o.o.o.o.o.' },
      mid: { k: 'x...........x.........x.', s: '......x...........x.....', h: 'x.x.x.x.x.x.x.x.x.x.x.x.' },
      high: { k: 'x.....x.....x.....x...x.', s: '......x...........x.x.x.', h: 'x...x.x...x.x...x.x...x.', o: '....................x...',
        fill: { s: '......x...........xxx.xx' } },
    },
  };

  // ---------- Batterie ----------
  // Une ligne par instrument, 16 doubles croches par mesure (32 = motif sur deux mesures).
  // X accent, x normal, o note fantôme. k grosse caisse, s caisse claire, r rimshot, h charley fermé,
  // o charley ouvert, d ride, b balais, c clap, a shaker. fill : lignes remplacées toutes les 4 mesures.
  // kick : [fréquence de départ, d'arrivée, durée].
  const CLAVE = 'x.....x.....x.......x.....x.....';
  const DRUMS = {
    jazz: {
      kick: [110, 50, .16],
      soft: { b: 'x...x...x...x...', h: '....o.......o...', k: 'o.......o.......' },
      mid: { d: 'x...x.o.x...x.o.', h: '....x.......x...', k: 'o...o...o...o...', s: '..............o.................' },
      high: { d: 'X...x.x.X...x.x.', h: '....x.......x...', k: 'x.....o...x.....o.......x.....o.', s: '......o.......x...o.......x.....',
        fill: { s: '....x.x.x.x.X.x.', k: 'x...........x...' } },
    },
    bossa: {
      kick: [120, 48, .2],
      soft: { a: 'o.o.o.o.o.o.o.o.', r: CLAVE, k: 'o.......o.......' },
      mid: { h: 'x.o.x.o.x.o.x.o.', r: CLAVE, k: 'x.....o.x.....o.' },
      high: { h: 'x.x.x.x.x.x.x.x.', a: 'oooooooooooooooo', r: CLAVE, k: 'x.....x.x.....x.',
        fill: { r: 'x..x..x..x..x.x.' } },
    },
    rock: {
      kick: [150, 45, .28],
      soft: { h: 'o.o.o.o.o.o.o.o.', r: '....x.......x...', k: 'x.......x.x.....' },
      mid: { h: 'x.o.x.o.x.o.x.o.', s: '....x.......x...', k: 'x.......x.x.....' },
      high: { h: 'X.x.X.x.X.x.X.x.', o: '..............x.', s: '....X.......X...', k: 'x.....x.x.x...x.',
        fill: { s: '....X.....x.xxxx', k: 'x.......x.......', o: '................' } },
    },
    electro: {
      kick: [170, 42, .34],
      soft: { k: 'x...x...x...x...', h: '..o...o...o...o.' },
      mid: { k: 'x...x...x...x...', c: '....x.......x...', h: 'o...o...o...o...', o: '..x...x...x...x.' },
      high: { k: 'X...X...X...X.x.', c: '....x.......x...', h: 'ooxoooxoooxoooxo', o: '..x...x...x...x.',
        fill: { c: '....x.......xxxx', k: 'X...X...X.......' } },
    },
    hiphop: {
      kick: [140, 40, .4],
      soft: { k: 'x.........x.....', r: '....x.......x...', h: 'o.o.o.o.o.o.o.o.' },
      mid: { k: 'x......o..x..x..', s: '....x.......x...', h: 'x.o.x.o.x.o.x.o.' },
      high: { k: 'x..x..x...x..x..', s: '....X.......X..o', h: 'x.xxx.x.x.xxx.xx', o: '......x.........',
        fill: { s: '....X.....o.X.xx', k: 'x..x......x.....' } },
    },
  };
  Object.assign(DRUMS, {
    downtempo: {
      kick: [130, 40, .38],
      soft: { k: 'x.........x.....', r: '....x.......x...', h: 'o.o.o.o.o.o.o.o.' },
      mid: { k: 'x.........xx....', s: '....x.......x...', h: 'x.o.x.o.x.o.x.o.', o: '......x.........' },
      high: { k: 'x..x......x..x..', s: '....x..o....x...', h: 'x.xxx.xxx.xxx.xx',
        fill: { s: '....x.......x.xx' } },
    },
    disco: {
      kick: [170, 42, .32],
      soft: { k: 'x...x...x...x...', h: '..o...o...o...o.' },
      mid: { k: 'x...x...x...x...', c: '....x.......x...', h: 'oo.ooo.ooo.ooo.o', o: '..x...x...x...x.' },
      high: { k: 'X...X...X...X...', c: '....x..o....x...', h: 'xo.oxo.oxo.oxo.o', o: '..x...x...x...x.', a: 'oooooooooooooooo',
        fill: { c: '....x.......x.xx' } },
    },
    metal: {
      kick: [160, 50, .14],
      soft: { k: 'x.....x.x.......', s: '........x.......', h: 'x.x.x.x.x.x.x.x.' },
      mid: { k: 'x.x...x.x.x...x.', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
      high: { k: 'xxxxxxxxxxxxxxxx', s: '....X.......X...', o: 'x...x...x...x...',
        fill: { s: '....X...x.x.xxxx' } },
    },
    punk: {
      kick: [150, 48, .16],
      soft: { k: 'x.......x.x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
      mid: { k: 'x.....x.x.x.....', s: '....x.......x...', h: 'X.x.X.x.X.x.X.x.' },
      high: { k: 'x...x...x...x...', s: '..x...x...x...x.', o: 'x...x...x...x...',
        fill: { s: 'x.x.x.x.x.x.xxxx' } },
    },
    sludge: {
      kick: [130, 40, .4],
      soft: { k: 'x...............', s: '........x.......', h: 'o...o...o...o...' },
      mid: { k: 'x.....x...x.....', s: '........x.......', o: 'x...x...x...x...' },
      high: { k: 'x..x..x...x..x..', s: '........X.....o.', o: 'X...x...X...x...',
        fill: { s: '........X...x.xx', k: 'x.....x.........' } },
    },
    stoner: {
      kick: [140, 42, .3],
      soft: { k: 'x.......x.x.....', s: '....x.......x...', h: 'o.o.o.o.o.o.o.o.' },
      mid: { k: 'x.....x.x.x.....', s: '....x.......x...', h: 'X.x.X.x.X.x.X.x.' },
      high: { k: 'x..x..x.x.x..x..', s: '....X..o....X...', o: 'x...x...x...x...', h: '..x...x...x...x.',
        fill: { s: '....X.....x.xxxx' } },
    },
  });
  const SON = 'x.....x.....x.......x...x.......'; // clave de son 3-2
  Object.assign(DRUMS, {
    trap: {
      kick: [150, 35, .5],
      soft: { k: 'x.........x.....', c: '........x.......', h: 'x.x.x.x.x.x.x.x.' },
      mid: { k: 'x......x..x.....', c: '........x.......', h: 'x.x.x.xxx.x.x.x.' },
      high: { k: 'x..x...x..x..x..', c: '........x.......', h: 'xxxxxxxxx.xxxxxx', o: '..............x.',
        fill: { c: '........x...xxxx' } },
    },
    drill: {
      kick: [150, 35, .5],
      soft: { k: 'x.........x.....', c: '......x.......x.', h: 'x..x..x.x..x..x.' },
      mid: { k: 'x.....x......x..', c: '......x.......x.', h: 'x..x..x.x..x..x.' },
      high: { k: 'x..x..x......x.x', c: '......x.......x.', h: 'x.xx.xx.x.xx.xxx', o: '..........x.....',
        fill: { c: '......x.....x.xx' } },
    },
    halftime: {
      kick: [140, 38, .45],
      soft: { k: 'x...............', s: '........x.......', h: 'o...o...o...o...' },
      mid: { k: 'x.....x.........', s: '........x.......', h: 'x.x.x.x.x.x.x.x.' },
      high: { k: 'x..x..x...x.....', s: '........X.....o.', h: 'x.xxx.x.x.xxx.x.', o: '......x.........',
        fill: { s: '........X...x.xx' } },
    },
    dnb: {
      kick: [160, 45, .2],
      soft: { k: 'x.........x.....', r: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
      mid: { k: 'x.........x.....', s: '....x..o.o..x...', h: 'x.x.x.x.x.x.x.x.' },
      high: { k: 'x.x.......xx....', s: '....x..x.x..x..x', h: 'x.x.x.x.x.x.x.x.', o: '......x.......x.',
        fill: { s: '....x..x.x..xxxx' } },
    },
    breaks: {
      kick: [150, 45, .25],
      soft: { k: 'x.........x.....', r: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
      mid: { k: 'x......x..x.....', s: '....x.......x...', h: 'x.xxx.xxx.xxx.xx' },
      high: { k: 'x..x...x..x...x.', s: '....x..o.o..x...', h: 'x.xxx.xxx.xxx.xx', o: '......x.........',
        fill: { s: '....x..x.x..x.xx' } },
    },
    techno: {
      kick: [180, 45, .3],
      soft: { k: 'x...x...x...x...', h: '..o...o...o...o.' },
      mid: { k: 'X...X...X...X...', o: '..x...x...x...x.', c: '....o.......o...', a: 'oooooooooooooooo' },
      high: { k: 'X...X...X...X...', o: '..x...x...x...x.', c: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', r: '..x..x....x..x..',
        fill: { c: '....x.......xxxx' } },
    },
    funk: {
      kick: [150, 45, .25],
      soft: { k: 'x.....x...x.....', r: '....x.......x...', h: 'x.o.x.o.x.o.x.o.' },
      mid: { k: 'x..x......x..x..', s: '....x..o.o..x...', h: 'x.xxx.xxx.xxx.xx' },
      high: { k: 'x..x..x...x..x.x', s: '....X..o.o..X..o', h: 'xxxxxxxxxxxxxxxx', o: '......x.......x.',
        fill: { s: '....X..o.o.xX.xx' } },
    },
    shuffle: {
      kick: [140, 45, .25],
      soft: { h: 'o.o.o.o.o.o.o.o.', k: 'x.......x.......', r: '....x.......x...' },
      mid: { h: 'x.o.x.o.x.o.x.o.', k: 'x.......x.x.....', s: '....x.......x...' },
      high: { d: 'X.x.X.x.X.x.X.x.', k: 'x.....x.x.....x.', s: '....X.o.....X.o.',
        fill: { s: '....X...x.x.x.x.' } },
    },
    reggae: {
      kick: [120, 42, .35],
      soft: { k: '........x.......', r: '........x.......', h: 'o.o.o.o.o.o.o.o.' },
      mid: { k: '........x.......', r: '........x.......', h: 'x.o.x.o.x.o.x.o.' },
      high: { k: 'x...x...x...x...', s: '........x.......', h: 'x.x.x.x.x.x.x.x.', o: '..x...........x.',
        fill: { s: '........x.x.x.xx' } },
    },
    ska: {
      kick: [150, 48, .2],
      soft: { k: 'x.......x.......', r: '....x.......x...', h: '..o...o...o...o.' },
      mid: { k: 'x.......x.......', s: '....x.......x...', h: '..x...x...x...x.' },
      high: { k: 'x...x...x...x...', s: '....x.......x...', h: '..x...x...x...x.', o: '..............x.',
        fill: { s: '....x...x.x.x.xx' } },
    },
    dembow: {
      kick: [150, 42, .3],
      soft: { k: 'x.......x.......', r: '...x..x....x..x.' },
      mid: { k: 'x...x...x...x...', s: '...x..x....x..x.', h: 'x.x.x.x.x.x.x.x.' },
      high: { k: 'x...x...x...x...', s: '...x..x....x..x.', h: 'x.x.x.x.x.x.x.x.', a: 'oooooooooooooooo',
        fill: { s: '...x..x....xx.xx' } },
    },
    latin: {
      kick: [130, 48, .2],
      soft: { a: 'o.o.o.o.o.o.o.o.', r: SON },
      mid: { d: 'x.x.x.x.x.x.x.x.', r: SON, k: '......x.....x...', a: 'oooooooooooooooo' },
      high: { d: 'x.x.xx.xx.xx.x.x', r: SON, k: '......x.....x...', a: 'oooooooooooooooo', s: '..o.......o.....',
        fill: { s: '..o.....x.x.xx.x' } },
    },
    afrobeat: {
      kick: [140, 45, .22],
      soft: { k: 'x.......x.x.....', a: 'x.o.x.o.x.o.x.o.', r: '....x.......x...' },
      mid: { k: 'x..x....x.x.....', s: '....x..o......x.', h: 'x.xxx.xxx.xxx.xx', a: 'oooooooooooooooo' },
      high: { k: 'x..x..x.x.x..x..', s: '....x..x......x.', h: 'x.xxx.xxx.xxx.xx', a: 'oooooooooooooooo', o: '......x.......x.',
        fill: { s: '....x..x.x.x..xx' } },
    },
    cumbia: {
      kick: [130, 48, .22],
      soft: { a: 'x.xxx.xxx.xxx.xx', k: 'x.......x.......' },
      mid: { a: 'x.xxx.xxx.xxx.xx', k: 'x...x...x...x...', r: '..x...x...x...x.' },
      high: { a: 'x.xxx.xxx.xxx.xx', k: 'x...x...x...x...', r: '..x...x...x...x.', d: 'x...x...x...x...',
        fill: { s: '........x.x.xx.x' } },
    },
    world: {
      kick: [110, 50, .25],
      soft: { a: 'x.o.x.o.x.o.x.o.' },
      mid: { a: 'x.xxx.xxx.xxx.xx', k: 'x.......x.......' },
      high: { a: 'x.xxx.xxx.xxx.xx', k: 'x.....x.x.......', r: '..x..x....x..x..',
        fill: { r: '..x..x..x.x.x.xx' } },
    },
    acoustic: {
      kick: [120, 50, .22],
      soft: { a: 'o.o.o.o.o.o.o.o.' },
      mid: { k: 'x.......x.......', r: '....x.......x...', a: 'o.o.o.o.o.o.o.o.' },
      high: { k: 'x.....x.x.......', s: '....x.......x...', a: 'x.o.x.o.x.o.x.o.',
        fill: { s: '....x.....x.x.xx' } },
    },
    orch: { // peu ou pas de batterie : silence, puis grosse caisse et cymbale façon timbales
      kick: [90, 45, .5],
      soft: {},
      mid: { k: 'o...............' },
      high: { k: 'x.......o.......', o: 'x...............' },
    },
    blast: {
      kick: [160, 50, .12],
      soft: { k: 'x.x...x.x.x...x.', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
      mid: { k: 'xxxxxxxxxxxxxxxx', s: '....X.......X...', o: 'x...x...x...x...' },
      high: { k: 'xxxxxxxxxxxxxxxx', s: 'x.x.x.x.x.x.x.x.', o: 'x...x...x...x...',
        fill: { s: 'x.x.x.x.xxxxxxxx' } },
    },
    djent: {
      kick: [160, 50, .14],
      soft: { k: 'x..x..x.........', s: '........x.......', h: 'x.x.x.x.x.x.x.x.' },
      mid: { k: 'x..x..x..x.x..x.', s: '........x.......', o: 'x...x...x...x...' },
      high: { k: 'x.xx.xx.x.xx.x.x', s: '....X.......X...', o: 'x...x...x...x...',
        fill: { s: '....X...x.x.xxxx' } },
    },
  });
  const DRUM_VEL = { X: 1, x: .75, o: .35 };
  const GM_DRUM = { k: 36, s: 38, r: 37, h: 42, o: 46, d: 51, c: 39, a: 70, b: 40 }; // balais : faute d'équivalent GM, caisse claire douce (40)

  const mapLine = (line, fn, W) => Array.from(line || '.'.repeat(W || 16), fn).join('');

  // Fills de caisse claire par niveau de jeu ; en swing, rien sur les doubles croches impaires.
  const FILLS = {
    straight: {
      soft: ['............o.x.', '..........o...xx', '............x.x.'],
      mid: ['........x.x.xxxx', '....x.....x.xxxx', '..........xxx.xx'],
      high: ['....X...x.x.xxxx', 'x.x.x.x.xxxxxxxx', '......xxx.xxxxXX'],
    },
    jazz: {
      soft: ['............o.x.', '..........o.o.x.'],
      mid: ['........x.x.x.x.', '..........x.x.X.'],
      high: ['....x.x.x.x.X.x.', 'x...x.x.x.x.x.X.'],
    },
  };

  function drumBar(bar) {
    const D = S.parts.drums, level = D.play, M = kit()[level], pat = {}, N = D.bars, jazz = pattern().swing >= .3; // jazz : kits en swing ternaire
    // own : motif écrit pour la mesure (W doubles croches) ; sinon motif 4/4 (16), redistribué ensuite par toMeter
    const m = meter(), own = ownMeter(), W = own ? m.B16 : 16, beatAt = new Set(own ? m.starts16 : [0, 4, 8, 12]);
    const ml = (line, fn) => mapLine(line, fn, W);
    for (const inst in M) if (inst !== 'fill') pat[inst] = M[inst].substr((bar * W) % M[inst].length, W);
    // fill en fin de cycle, tiré parmi ceux du style et du niveau de jeu ; charley ouvert pour relancer la mesure suivante
    if (N > 1 && bar % N === N - 1) {
      let pool;
      if (own) { // roulement sur le dernier temps, ou le fill écrit pour la mesure
        const last = m.starts16[m.starts16.length - 1];
        pool = [{ s: ml('', (c, i) => (i >= last && i % 2 === 0 ? 'x' : '.')) }].concat(M.fill ? [M.fill] : []);
      } else pool = FILLS[jazz ? 'jazz' : 'straight'][level].map(sn => ({ s: sn })).concat(M.fill ? [M.fill] : []);
      Object.assign(pat, pool[Math.floor(H.rand(D.seed, Math.floor(bar / N), 80) * pool.length)]);
      delete pat.r;
    } else if (N > 1 && bar % N === 0 && level !== 'soft' && !jazz && pat.h) pat.o = ml(pat.o, (c, i) => (i === 0 ? 'X' : c));
    if (D.color < .2) for (const inst of ['h', 'a']) // couleur très basse : charley et shaker réduits aux temps
      if (pat[inst]) pat[inst] = ml(pat[inst], (c, i) => (beatAt.has(i) ? c : '.'));
    // couleur basse : kit dépouillé, sans charley ouvert ni shaker ni notes fantômes de caisses
    if (D.color < .33) {
      delete pat.o; delete pat.a;
      for (const inst of ['k', 's']) if (pat[inst]) pat[inst] = ml(pat[inst], c => (c === 'o' ? '.' : c));
    }
    // notes fantômes (couleur haute) : doubles de charley, ou caisse claire sur les croches en l'air en swing
    const rich = D.color > .66;
    if (rich && jazz) pat.s = ml(pat.s, (c, i) => (c === '.' && i % 4 === 2 ? 'o' : c));
    else if (rich && pat.h) pat.h = ml(pat.h, c => (c === '.' ? 'o' : c));
    if (rich && !jazz && !pat.o && pat.h) { pat.o = ml('', (c, i) => (i === W - 2 ? 'x' : '.')); pat.h = ml(pat.h, (c, i) => (i === W - 2 ? '.' : c)); }
    // dynamique très haute : charley ouvert sur les temps, puis tout est appuyé
    if (D.dyn > .92 && level === 'high' && !jazz && pat.h) {
      const h = pat.h;
      pat.o = ml(pat.o, (c, i) => (beatAt.has(i) && h[i] !== '.' ? 'x' : c));
      pat.h = ml(h, (c, i) => (beatAt.has(i) ? '.' : c));
    }
    if (D.dyn > .85) for (const inst in pat) pat[inst] = ml(pat[inst], c => (c === 'x' ? 'X' : c === 'o' ? 'x' : c));
    // variation : tirée par mesure du cycle, donc la même à chaque tour
    if (D.vari > 0) {
      const r = (i, salt) => H.rand(D.seed, (bar % N) * W + i, salt), keeper = pat.h ? 'h' : pat.d ? 'd' : pat.a ? 'a' : null;
      if (keeper) pat[keeper] = ml(pat[keeper], (c, i) => (c !== '.' && !beatAt.has(i) && r(i, 51) < D.vari * .2 ? '.' : c));
      if (pat.k) pat.k = ml(pat.k, (c, i) => (c === '.' && i && i % 2 === 0 && r(i, 52) < D.vari * .1 ? 'o' : c));
      if (pat.s) pat.s = ml(pat.s, (c, i) => (c === '.' && (jazz ? i % 4 === 2 : !beatAt.has(i)) && r(i, 53) < D.vari * .08 ? 'o' : c));
    }
    return own ? pat : toMeter(pat);
  }

  // Les motifs sont écrits en 4/4 (quatre temps de 4 doubles croches). Pour une autre mesure, chaque temps reprend un temps
  // du motif d'origine (meter.map). Un temps ternaire (noire pointée, 6 doubles) garde son appui et sa croche en l'air ;
  // les instruments qui marquent la pulsation (charleys, ride, shaker, balais) y jouent les trois croches.
  const PULSE = new Set(['h', 'd', 'a', 'b']);
  function toMeter(pat) {
    const m = meter();
    if (m.id === '4/4') return pat;
    const out = {};
    for (const inst in pat) {
      out[inst] = m.groups.map((g, k) => {
        const src = pat[inst].substr(m.map[k] * 4, 4);
        if (g === 2) return src;
        return PULSE.has(inst) ? src[0] + '.' + src[2] + '.' + src[2] + '.' : src[0] + '..' + src[2] + '..';
      }).join('');
    }
    return out;
  }

  // Position dans le motif d'accompagnement (écrit en 8 croches de 4/4) qui correspond à la croche pos de la mesure.
  function compPos(pos) {
    const m = meter();
    if (m.id === '4/4') return pos;
    let k = 0;
    while (k + 1 < m.starts.length && m.starts[k + 1] <= pos) k++;
    const o = pos - m.starts[k], src = m.map[k] * 2;
    if (m.groups[k] === 2) return src + o;
    return o === 0 ? src : o === 2 ? src + 1 : -1; // temps ternaire : appui, puis la croche en l'air sur la troisième
  }

  // ---------- Partition ----------
  // Une entrée par croche : quel accord sonne, et s'il commence là.
  function timeline() {
    const tl = [];
    for (const i of playOrder()) for (let k = 0; k < S.chords[i].beats * 2; k++) tl.push({ i, k, start: k === 0 });
    return tl;
  }

  // Tout ce qui sonne à la croche q de la boucle. Source unique pour la lecture et pour l'export MIDI.
  // off et dur sont en croches (off inclut le swing) ; strum, en secondes, égrène légèrement les accords à l'écoute.
  // track est l'identifiant de l'instrument (chords, bass, mel, drums).
  function stepEvents(q, tl) {
    const e = tl[q], ch = S.chords[e.i], P = pattern(), ev = [];
    const C = S.parts.chords, B = S.parts.bass, D = S.parts.drums;
    const m = meter(), sw = q % 2 && !m.compound ? P.swing : 0, pos = q % m.L, cp = ownMeter() ? pos : compPos(pos), v = H.voicing(ch, keyFor(ch), 59 + 7 * S.parts.chords.reg);
    const add = (track, m, off, dur, vel, timbre, strum) =>
      ev.push({ track, m, off, dur, vel: dynVel(track, vel, Math.round((q + off - sw) * 2)), timbre, strum });
    const written = (track, lookup, timbre) => {
      // le swing ne déplace que les notes posées sur la grille des doubles croches
      for (const nt of lookup.byStep.get(q) || []) add(track, nt.m, (Number.isInteger(nt.t) ? sw : 0) + (nt.t - q * 2) / 2, nt.d / 2 * (nt.g ? .45 : track === 'bass' ? (nt.d <= 2 ? .7 : .85) : .95), nt.g ? .3 : .9, timbre); // basse détachée, pour entendre chaque note ; notes fantômes brèves et faibles
    };

    if (D.on) {
      const pat = drumBar(Math.floor(q / m.L));
      for (let sub = 0; sub < 2; sub++) for (const inst in pat) {
        const base = DRUM_VEL[pat[inst][pos * 2 + sub]];
        if (!base) continue;
        const vel = (.7 + (base - .7) * D.dyn * 2) * (1 + D.dyn * (H.rand(D.seed, q * 2 + sub, inst.charCodeAt(0)) - .5) * .25);
        ev.push({ track: 'drums', inst, off: sw + sub / 2, vel: Math.max(.12, Math.min(1.2, vel)) });
      }
    }
    if (B.on && bassWritten()) written('bass', bassNotes(), 'bass');
    if (S.parts.mel.on) written('mel', melNotes(), 'lead');

    if (C.play !== 'style') {
      const timbre = chordTimbre();
      if (e.start) {
        if (B.on && !bassWritten()) add('bass', v.bass, 0, Math.min(ch.beats, 4) * 2 * .95, .9, 'bass');
        if (C.on && C.play === 'block') v.notes.forEach((m, k) => add('chords', m, 0, ch.beats * 2 * .95, .7, timbre, k * .008));
      }
      if (C.on && C.play !== 'block') {
        // rate = notes par temps ; les triolets se placent sur les temps (croches paires de l'accord). Une croche restée seule
        // en fin d'accord (mesures à nombre impair de croches) reçoit une seule note. Chaque note s'arrête avant l'accord suivant.
        const r = C.rate, len8 = Math.round(ch.beats * 2), alone = r === 3 && e.k + 1 >= len8;
        const per = r === 3 ? (e.k % 2 ? 0 : alone ? 1 : 3) : r / 2, gap = alone ? 1 : 2 / r;
        for (let j = 0; j < per; j++) {
          const off = (r === 2 ? sw : 0) + j * gap, room = len8 - e.k - off; // place restante avant l'accord suivant, swing compris
          add('chords', arpNote(v, e.k * r / 2 + j, q), off, Math.min(gap * 1.7, room * .97), .7, timbre);
        }
      }
      return ev;
    }

    let c = P.c[cp] || (e.start && !P.offbeat ? [.7, 1.5] : null), b = e.start ? ['r', .95, (P.b[cp] || [0, 0, 1.5])[2]] : P.b[cp];
    if (C.dens < .33) { // densité basse : un accord tenu par mesure ou par changement, basse sur les temps forts
      c = P.offbeat ? c : e.start || pos === 0 ? [.7, Math.min(ch.beats * 2 - e.k, m.L - pos) * .95] : null;
      if (!e.start && pos !== m.split) b = null;
    } else {
      if (C.dens > .66 && !c) c = [.4, .8]; // densité haute : toutes les croches
      // variation : un coup du motif saute, ou un coup léger s'ajoute
      const r = H.rand(C.seed, q, 61);
      if (c && !e.start && r < C.vari * .3) c = null;
      else if (!c && r < C.vari * .25) c = [.45, .8];
    }
    if (c && C.on) v.notes.forEach((m, k) => add('chords', m, sw, c[1], c[0], P.timbre, k * .006));
    if (b && B.on && !bassWritten()) add('bass', v.bass + (b[0] === '5' ? v.fifth : b[0] === '3' ? v.third : b[0] === '8' ? 12 : 0), sw, b[2], b[1], 'bass');
    return ev;
  }

  const Player = (() => {
    let ctx, out, noiseBuf, timer = null, step = 0, nextT = 0;
    const bus = {};

    function init() {
      if (!ctx) {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        const comp = ctx.createDynamicsCompressor();
        out = ctx.createGain();
        out.gain.value = .75;
        out.connect(comp);
        comp.connect(ctx.destination);
        for (const id of PART_IDS) { bus[id] = ctx.createGain(); bus[id].connect(out); }
        volumes();
        noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      if (ctx.state === 'suspended') ctx.resume();
    }

    // 80 % = niveau nominal ; la courbe est quadratique pour que le bas du curseur reste utilisable
    function volumes() {
      if (ctx) for (const id of PART_IDS) bus[id].gain.value = Math.pow(S.parts[id].vol / .8, 2);
    }

    function note(midi, t, dur, vel, timbre, part) {
      const T = TIMBRES[timbre], g = ctx.createGain(), f = ctx.createBiquadFilter();
      const peak = vel * .2, end = t + dur + T.r * 2;
      f.type = 'lowpass';
      f.frequency.value = T.cut * (timbre === 'bass' ? 1 : .5 + S.bright);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(peak, t + T.a);
      g.gain.setTargetAtTime(peak * T.s, t + T.a, T.d / 3);
      g.gain.setTargetAtTime(0, t + dur, T.r / 3);
      for (const [type, semi, lvl] of T.oscs) {
        const o = ctx.createOscillator(), og = ctx.createGain();
        o.type = type;
        o.frequency.value = 440 * Math.pow(2, (midi + semi - 69) / 12);
        og.gain.value = lvl;
        o.connect(og); og.connect(f);
        o.start(t); o.stop(end);
      }
      f.connect(g); g.connect(bus[part] || out);
    }

    function env(t, peak, a, d) {
      const g = ctx.createGain();
      g.gain.setValueAtTime(.0001, t);
      g.gain.linearRampToValueAtTime(peak, t + a);
      g.gain.exponentialRampToValueAtTime(.0001, t + a + d);
      g.connect(bus.drums);
      return g;
    }
    function noiseHit(t, peak, a, d, type, freq, q) {
      const src = ctx.createBufferSource(), f = ctx.createBiquadFilter();
      src.buffer = noiseBuf;
      src.loop = true;
      f.type = type;
      f.frequency.value = freq;
      if (q) f.Q.value = q;
      src.connect(f); f.connect(env(t, peak, a, d));
      src.start(t, Math.random() * .5);
      src.stop(t + a + d + .05);
    }
    function toneHit(t, peak, d, type, f0, f1) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f0, t);
      if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + d * .6);
      o.connect(env(t, peak, .002, d));
      o.start(t); o.stop(t + d + .05);
    }

    function drum(inst, t, v) {
      const K = kit().kick;
      if (inst === 'k') toneHit(t, .8 * v, K[2], 'sine', K[0], K[1]);
      else if (inst === 's') { noiseHit(t, .42 * v, .002, .17, 'bandpass', 2400, .6); toneHit(t, .3 * v, .09, 'triangle', 200, 140); }
      else if (inst === 'r') { toneHit(t, .3 * v, .035, 'triangle', 1650, 1500); noiseHit(t, .15 * v, .001, .02, 'bandpass', 2800, 2); }
      else if (inst === 'h') noiseHit(t, .16 * v, .001, .045, 'highpass', 7500);
      else if (inst === 'o') noiseHit(t, .15 * v, .002, .3, 'highpass', 6500);
      else if (inst === 'd') { noiseHit(t, .09 * v, .002, .5, 'highpass', 5500); toneHit(t, .035 * v, .3, 'triangle', 4300); }
      else if (inst === 'b') noiseHit(t, .1 * v, .035, .2, 'bandpass', 2600, .5);
      else if (inst === 'c') [0, .011, .022].forEach(dt => noiseHit(t + dt, .3 * v, .001, dt === .022 ? .16 : .02, 'bandpass', 1300, .9));
      else if (inst === 'a') noiseHit(t, .09 * v, .012, .05, 'highpass', 5500);
    }

    function chord(ch) {
      init();
      const v = H.voicing(ch, keyFor(ch), 59 + 7 * S.parts.chords.reg), t = ctx.currentTime + .03;
      if (S.parts.bass.on) note(v.bass, t, 1.3, .9, 'bass', 'bass');
      if (isArp()) arpCycle(v).slice(0, 8).forEach((n, i) => note(n, t + i * .11, .5, .7, 'keys', 'chords'));
      else v.notes.forEach((n, i) => note(n, t + i * .018, 1.3, .7, 'keys', 'chords'));
    }

    function schedule(n, t0) {
      const tl = timeline();
      if (!tl.length) return;
      const q = n % tl.length, sd = 30 / S.tempo;
      if (tl[q].start) setTimeout(() => { if (timer) mark(tl[q].i); }, Math.max(0, (t0 - ctx.currentTime) * 1000));
      for (const ev of stepEvents(q, tl)) {
        const t = t0 + ev.off * sd + (ev.strum || 0);
        if (ev.track === 'drums') drum(ev.inst, t, ev.vel);
        else note(ev.m, t, ev.dur * sd, ev.vel, ev.timbre, ev.track);
      }
    }

    function tick() {
      while (nextT < ctx.currentTime + .12) {
        schedule(step, nextT);
        step++;
        nextT += 30 / S.tempo;
      }
    }

    function mark(i) {
      playingIdx = i;
      document.querySelectorAll('.card').forEach((el, k) => el.classList.toggle('playing', k === i));
      const node = i >= 0 && S.chords[i] ? discNode(S.chords[i]) : null;
      document.querySelectorAll('#disc .node').forEach(el => el.classList.toggle('playing', el.dataset.node === node));
      markMap(i);
    }

    function start() {
      init();
      step = 0;
      nextT = ctx.currentTime + .08;
      timer = setInterval(tick, 25);
      tick();
      $('#play').textContent = '■ Stop';
    }
    function stop() {
      clearInterval(timer);
      timer = null;
      mark(-1);
      $('#play').textContent = '▶ Lecture';
    }

    return { chord, volumes, toggle: () => (timer ? stop() : start()), playing: () => !!timer };
  })();

  // ---------- Export ----------

  function gridText() {
    const line = list => {
      const L = meter().L;
      let out = '|', e8 = 0; // en croches
      list.forEach((ch, j) => {
        out += ' ' + pretty(info(ch).name) + (ch.beats * 2 === 2 * L ? ' | %' : '');
        e8 += ch.beats * 2;
        if (e8 % L === 0) out += e8 % (4 * L) === 0 && j < list.length - 1 ? ' |\n|' : ' |';
      });
      return out;
    };
    const keyName = k => `${pretty(k.tonic)} ${k.minor ? 'mineur' : 'majeur'}`, B = S.chords.filter(c => c.sec === 'B');
    let out = `${keyName(key())} — ${H.STYLES[S.style].label} — ${S.meter} — ${S.tempo} bpm\n` + line(gridChords());
    if (B.length) out += `\nPont (${keyName(keyFor(B[0]))}), forme ${S.bridge.form === 'AABA' ? 'A A B A' : 'A B'}\n` + line(B);
    return out;
  }

  function vlq(n) {
    const b = [n & 0x7f];
    while ((n >>= 7)) b.unshift((n & 0x7f) | 0x80);
    return b;
  }
  const u32 = n => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
  const ascii = s => Array.from(s.replace(/°/g, 'dim').normalize('NFD').replace(/[\u0300-\u036f]/g, '')).map(c => (c.charCodeAt(0) < 128 ? c.charCodeAt(0) : 63));
  const meta = (type, bytes) => [0xff, type].concat(vlq(bytes.length), bytes);

  function midiTrack(events) { // [tick, ordre, octets]
    events.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    let data = [], last = 0;
    for (const [tick, , bytes] of events) { data = data.concat(vlq(tick - last), bytes); last = tick; }
    data = data.concat([0, 0xff, 0x2f, 0]);
    return [0x4d, 0x54, 0x72, 0x6b].concat(u32(data.length), data);
  }

  // L'export rejoue la boucle croche par croche avec stepEvents : le fichier contient exactement ce qu'on entend
  // (motif d'accompagnement, arpèges, basse, mélodie, batterie, swing), une piste par partie activée.
  const GM_PROGRAM = { keys: 4, guitar: 27, pad: 89, dist: 29, synth: 81, strings: 48, pluck: 24, organ: 21 }; // piano électrique, guitare claire, pad, guitare saturée, lead, cordes, guitare nylon, accordéon
  const MIDI_PARTS = [
    { track: 'chords', name: 'Accords', chan: 0 },
    { track: 'bass', name: 'Basse', chan: 1, program: 33 },
    { track: 'mel', name: 'Melodie', chan: 2, program: 80 },
    { track: 'drums', name: 'Batterie', chan: 9 },
  ];

  function buildMidi() {
    const PPQ = 480, us = Math.round(60e6 / S.tempo), tl = timeline(), end = tl.length * PPQ / 2;
    const cond = [[0, 0, meta(0x03, ascii('Harmonie'))], [0, 0, meta(0x51, [(us >> 16) & 255, (us >> 8) & 255, us & 255])], [0, 0, meta(0x58, [meter().num, Math.log2(meter().den), meter().den === 8 ? 12 : 24, 8])]];
    let tick = 0;
    for (const i of playOrder()) { const ch = S.chords[i]; cond.push([tick, 0, meta(0x06, ascii(info(ch).name))]); tick += ch.beats * PPQ; }

    const notes = { chords: [], bass: [], mel: [], drums: [] };
    for (let q = 0; q < tl.length; q++) for (const ev of stepEvents(q, tl)) {
      const on = Math.round((q + ev.off) * PPQ / 2);
      if (ev.track === 'drums') notes.drums.push({ on, off: on + 60, m: GM_DRUM[ev.inst], vel: ev.inst === 'b' ? 45 : Math.round(40 + ev.vel * 70) });
      else notes[ev.track].push({ on, off: on + Math.max(30, Math.round(ev.dur * PPQ / 2)), m: ev.m, vel: Math.min(127, Math.round(ev.vel * 110)) });
    }

    const tracks = [cond], summary = [];
    for (const part of MIDI_PARTS) {
      const list = notes[part.track].sort((a, b) => a.on - b.on);
      if (!list.length) continue;
      // une note rejouée coupe la précédente de même hauteur ; rien ne dépasse la fin de la boucle
      const last = {};
      for (const n of list) {
        if (last[n.m] && last[n.m].off > n.on) last[n.m].off = n.on;
        last[n.m] = n;
        n.off = Math.min(n.off, end);
      }
      const program = part.program != null ? part.program : part.track === 'chords' ? GM_PROGRAM[chordTimbre()] : null;
      const evs = [[0, 0, meta(0x03, ascii(part.name))]];
      if (program != null) evs.push([0, 0, [0xc0 | part.chan, program]]);
      evs.push([0, 0, [0xb0 | part.chan, 7, Math.min(127, Math.round(100 * S.parts[part.track].vol / .8))]]); // volume de piste
      for (const n of list) if (n.off > n.on) evs.push([n.on, 1, [0x90 | part.chan, n.m, n.vel]], [n.off, 0, [0x80 | part.chan, n.m, 0]]);
      tracks.push(evs);
      summary.push(`${part.name} ${list.length}`);
    }
    const bytes = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 1, 0, tracks.length, PPQ >> 8, PPQ & 255].concat(...tracks.map(midiTrack));
    return { bytes, summary };
  }

  function exportMidi() {
    const { bytes, summary } = buildMidi();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'audio/midi' }));
    a.download = `harmonie-${S.style}-${S.tonic.replace('#', 's')}${S.minor ? 'm' : ''}-${S.tempo}bpm.mid`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('MIDI : ' + summary.join(' · ') + ' notes');
  }

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(toast.h);
    toast.h = setTimeout(() => t.classList.remove('on'), 1600);
  }

  // ---------- Événements ----------

  function setStyle(v) {
    if (!v || v === S.style) return;
    pushUndo();
    S.style = v;
    S.meter = H.STYLES[v].meter || '4/4'; // chaque style part de sa mesure naturelle
    S.tempo = moodTempo();
    if (H.STYLES[v].form === 'blues') S.parts.chords.bars = 12; // pour obtenir la grille de blues
    S.chords = [];
    generate();
  }
  $('#style').addEventListener('click', e => setStyle(e.target.dataset.v));
  // Choisir une famille passe à son premier style.
  $('#family').addEventListener('click', e => {
    const f = e.target.dataset.v;
    if (f && f !== H.STYLES[S.style].family) setStyle(Object.keys(H.STYLES).find(k => H.STYLES[k].family === f));
  });
  $('#mode').addEventListener('click', e => {
    const v = e.target.dataset.v;
    if (v == null || (v === '1') === S.minor) return;
    pushUndo();
    const pc = key().pc;
    S.minor = v === '1';
    S.tonic = H.TONICS[S.minor ? 'minor' : 'major'].find(t => H.makeKey(t).pc === pc);
    S.chords = [];
    generate();
  });
  $('#tonic').addEventListener('change', e => { pushUndo(); S.tonic = e.target.value; changed(true); });
  $('#meterOwn').addEventListener('change', e => { S.meterOwn = e.target.checked; save(); });
  $('#meter').addEventListener('change', e => {
    pushUndo();
    S.meter = e.target.value;
    S.chords = [];
    generate();
    toast(`Mesure ${S.meter} : nouvelle grille`);
  });
  $('#tempo').addEventListener('change', e => { S.tempo = Math.max(50, Math.min(220, +e.target.value || 120)); changed(true); });
  $('#mood').addEventListener('change', e => {
    pushUndo();
    applyMood(e.target.value);
    Player.volumes();
    S.chords = [];
    generate();
    toast(`Ambiance « ${H.MOODS[S.mood].label} » : réglages posés, modifiables`);
  });
  $('#bright').addEventListener('input', e => { S.bright = e.target.value / 100; save(); });
  $('#bridgeType').addEventListener('change', e => { S.bridge.type = e.target.value; regenBridge(); });
  $('#bridgeBars').addEventListener('change', e => { S.bridge.bars = +e.target.value; regenBridge(); });
  $('#bridgeForm').addEventListener('change', e => { pushUndo(); S.bridge.form = e.target.value; changed(true); });
  $('#bridgeNew').addEventListener('click', regenBridge);
  $('#play').addEventListener('click', Player.toggle);
  $('#regenAll').addEventListener('click', regenAll);
  $('#undo').addEventListener('click', undo);
  $('#midi').addEventListener('click', exportMidi);
  $('#copy').addEventListener('click', () => {
    const text = gridText();
    (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(
      () => toast('Grille copiée'),
      () => window.prompt('Copier la grille :', text));
  });

  // Panneaux d'instruments : un seul jeu d'écouteurs, l'instrument et le réglage sont lus sur l'élément.
  const partOf = el => el.closest('.part').dataset.part;
  const togglePart = id => { S.parts[id].on = !S.parts[id].on; save(); renderParts(); };
  $('#parts').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.k === 'on') togglePart(partOf(b));
    else if (b.dataset.k === 'regen') regenPart(partOf(b));
  });
  $('#parts').addEventListener('input', e => { // curseurs : mise à jour en direct, sans reconstruire le panneau
    if (e.target.type !== 'range') return;
    S.parts[partOf(e.target)][e.target.dataset.k] = e.target.value / 100;
    e.target.nextElementSibling.textContent = e.target.value;
    if (e.target.dataset.k === 'vol') Player.volumes();
    save();
  });
  $('#parts').addEventListener('change', e => {
    const id = partOf(e.target), k = e.target.dataset.k;
    if (e.target.type === 'range') { if (id === 'chords' && k === 'color') renderDetail(); return; }
    S.parts[id][k] = isNaN(+e.target.value) ? e.target.value : +e.target.value;
    if (id === 'chords' && k === 'bars') return generate();
    save();
    renderParts();
  });

  $('#view').addEventListener('click', e => {
    if (!e.target.dataset.v) return;
    S.view = e.target.dataset.v;
    save();
    renderDisc();
    renderMap();
  });
  $('#disc').addEventListener('click', e => {
    const node = e.target.closest('.node');
    if (node) select(+node.dataset.i, true);
  });
  $('#map').addEventListener('click', e => {
    const n = e.target.closest('.mnode');
    if (n) return mapNodeClick(n.dataset.id);
    const b = e.target.closest('button');
    if (!b) return;
    if (b.id === 'mapAll') { mapAll = !mapAll; return renderMap(); }
    if (b.parentElement.id === 'mapClick') { mapClick = b.dataset.v; return renderMap(); }
    if (b.parentElement.id === 'mapSec') {
      const i = S.chords.findIndex(c => secOf(c) === b.dataset.v);
      if (i >= 0) { mapPin = null; select(i, false); }
    }
  });
  // Survol : les flèches suivent l'accord pointé ; on ne redessine que si l'accord change.
  $('#map').addEventListener('mouseover', e => {
    const n = e.target.closest('.mnode'), id = n ? n.dataset.id : null;
    if (id && id !== mapFocus) { mapFocus = id; renderMap(); }
  });
  $('#map').addEventListener('mouseleave', () => { if (mapFocus) { mapFocus = null; renderMap(); } });
  $('#grid').addEventListener('click', e => {
    const card = e.target.closest('.card');
    if (card) select(+card.dataset.i, true);
  });

  $('#detail').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.id === 'listen') return Player.chord(S.chords[sel]);
    if (b.id === 'del') return removeSelected();
    if (b.parentElement.id === 'instrView') { S.instrView = b.dataset.v; save(); return renderDetail(); }
    if (b.parentElement.id === 'beats') { pushUndo(); S.chords[sel].beats = +b.dataset.v; return changed(true); }
    if (b.dataset.repl != null) {
      pushUndo();
      S.chords[sel] = repl[+b.dataset.repl].ch;
    } else if (b.dataset.next != null) {
      pushUndo();
      S.chords.splice(sel + 1, 0, next[+b.dataset.next].ch);
      sel++;
    } else return;
    changed(true);
    if (!Player.playing()) Player.chord(S.chords[sel]);
  });

  function removeSelected() {
    const ch = S.chords[sel];
    if (!ch || (ch.sec !== 'B' && gridChords().length < 2)) return; // la grille garde au moins un accord
    pushUndo();
    S.chords.splice(sel, 1);
    sel = Math.min(sel, S.chords.length - 1);
    changed(true);
  }

  document.addEventListener('keydown', e => {
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
    if (document.getElementById('shortcuts')?.open) return; // fenêtre des raccourcis ouverte
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); return undo(); }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === ' ') { e.preventDefault(); Player.toggle(); }
    else if (e.key.toLowerCase() === 'g') generate();
    else if (e.key.toLowerCase() === 'b') togglePart('drums');
    else if (e.key.toLowerCase() === 'm') togglePart('mel');
    else if (e.key.toLowerCase() === 'n') regenPart('mel');
    else if (e.key === 'ArrowRight') select(sel + 1, true);
    else if (e.key === 'ArrowLeft') select(sel - 1, true);
    else if (e.key === 'Delete' || e.key === 'Backspace') removeSelected();
  });

  window.harmonieMidi = () => buildMidi(); // pour vérifier l'export sans télécharger

  // ---------- Démarrage ----------

  if (S.chords.length) { sel = 0; changed(true); } else generate();
})();
