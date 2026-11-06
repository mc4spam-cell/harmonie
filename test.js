// Tests d'invariants du moteur. Exécution : `node test.js`.
// Vérifie ce que `docs/CLAUDE.md` liste comme contrôles manuels.

const assert = require('node:assert/strict');
const H = require('./engine.js');

const STYLES = Object.keys(H.STYLES);
const METERS = Object.keys(H.METERS);
const MOODS = ['neutre', 'sombre', 'lumineux'].filter(m => H.MOODS[m]);
const TONICS = ['C', 'G', 'A'];

let checks = 0, fails = 0;
const check = (cond, msg) => { checks++; if (!cond) { fails++; console.error('FAIL', msg); } };

// 1. Génération pour chaque combinaison : grille non vide, longueurs cohérentes.
for (const style of STYLES) {
  for (const meter of METERS) {
    const g = H.generate({ tonic: 'C', minor: false, style, mood: 'neutre', meter, color: .5, bars: 4 });
    check(g.chords.length > 0, `generate ${style} ${meter} : grille vide`);
    for (const ch of g.chords) check(ch.beats > 0, `generate ${style} ${meter} : accord sans beats`);
  }
}

// 2. Mélodie et basse : notes dans la plage MIDI, pas de chevauchement sur une même piste.
for (const meter of METERS) {
  for (const mood of MOODS) for (const tonic of TONICS) {
    const grid = H.generate({ tonic, minor: false, style: 'jazz', mood, meter, color: .5, bars: 4 });
    const state = { tonic, minor: false, chords: grid.chords, meter };

    for (const vari of [0, 1]) {
      const mel = H.melody(state, { seed: 1, bars: 2, color: .5, vari });
      for (const n of mel) {
        check(n.m >= 0 && n.m <= 127, `mel pitch hors MIDI (${n.m}) @ ${meter} ${mood} ${tonic} vari=${vari}`);
        check(n.d > 0, `mel durée <= 0 @ ${meter}`);
      }
      // Pas de chevauchement (fin de n <= début du suivant).
      const sorted = mel.slice().sort((a, b) => a.t - b.t);
      for (let i = 1; i < sorted.length; i++) {
        check(sorted[i].t >= sorted[i - 1].t + sorted[i - 1].d - 1e-6,
          `mel chevauchement ${meter} ${mood} vari=${vari} : t=${sorted[i].t} après fin ${sorted[i - 1].t + sorted[i - 1].d}`);
      }

      const bl = H.bassLine(state, { seed: 1, variant: 'walk', rhythm: 'auto', bars: 2, color: .5, vari });
      for (const n of bl) check(n.m >= 0 && n.m <= 127, `bass pitch hors MIDI (${n.m}) @ ${meter}`);
      const bs = bl.slice().sort((a, b) => a.t - b.t);
      for (let i = 1; i < bs.length; i++) {
        check(bs[i].t >= bs[i - 1].t + bs[i - 1].d - 1e-6, `bass chevauchement ${meter} vari=${vari}`);
      }

      // Une note de basse au début de chaque changement d'accord (t en doubles croches, ch.beats en noires → ×4).
      let t = 0;
      for (const ch of grid.chords.slice(0, 2)) {
        const start = t;
        check(bl.some(n => Math.abs(n.t - start) < 2), `bass absente au changement d'accord @ t=${start} ${meter}`);
        t += ch.beats * 4;
      }
    }
  }
}

// 3. voicing : notes dans 0..127, bass sous les notes.
for (const meter of METERS) {
  const grid = H.generate({ tonic: 'C', minor: false, style: 'jazz', mood: 'neutre', meter, color: .5, bars: 2 });
  const state = { tonic: 'C', minor: false, chords: grid.chords, meter };
  for (const ch of grid.chords) {
    const v = H.voicing(ch, H.keyOf(state, ch));
    check(v.bass >= 0 && v.bass <= 127, `voicing bass hors MIDI ${v.bass}`);
    for (const n of v.notes) check(n >= 0 && n <= 127, `voicing note hors MIDI ${n}`);
    check(v.notes.length > 0, `voicing sans notes`);
  }
}

console.log(`${checks} vérifications, ${fails} échec(s)`);
process.exit(fails ? 1 : 0);
