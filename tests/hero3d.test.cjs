const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const lire = (nom) => fs.readFileSync(path.join(__dirname, '..', nom), 'utf8');

/* Extrait un littéral de tableau JS du code source, sans exécuter le fichier :
   les deux modules touchent au DOM et ne peuvent pas être importés ici. */
function tableau(source, nom) {
  const debut = source.indexOf(nom);
  assert.notEqual(debut, -1, 'liste ' + nom + ' introuvable');
  const ouvrante = source.indexOf('[', debut);
  let profondeur = 0, fin = ouvrante;
  for (; fin < source.length; fin++) {
    if (source[fin] === '[') profondeur++;
    else if (source[fin] === ']' && --profondeur === 0) break;
  }
  return new Function('return ' + source.slice(ouvrante, fin + 1))();
}

const hero = lire('hero3d.js');
const replique = lire('3d/js/replique.js');

test('la pose de départ du héros suit celle de la page 3D', () => {
  const cles = ['id', 'clip', 'min', 'max', 'initial', 'reverse'];
  const garder = (liste) => liste.map((m) => Object.fromEntries(cles.map((c) => [c, m[c]])));
  const attendus = tableau(replique, 'export const MOTIONS');
  assert.equal(attendus.length, 6);
  assert.deepEqual(garder(tableau(hero, 'var MOUVEMENTS')), garder(attendus));
});

test('le héros affiche la réplique détaillée, sans autre choix de modèle', () => {
  assert.ok(hero.includes("'3d/assets/rodbot-v5.glb'"), 'même modèle que la page 3D');
  assert.ok(replique.includes('rodbot-v5.glb'));
  for (const autre of ['rodbot_mobile.sog', 'rodbot_hq.sog', 'quality', 'qualite']) {
    assert.ok(!hero.includes(autre), 'aucun choix de rendu : ' + autre);
  }
});

test('le décodeur et la visionneuse sont locaux (utile hors ligne)', () => {
  assert.ok(hero.includes("'3d/vendor/draco/'"), 'décodeur Draco local');
  assert.ok(hero.includes("'3d/vendor/model-viewer-4.3.1.min.js'"), 'visionneuse locale');
  assert.ok(!/https?:\/\//.test(hero), 'aucune adresse externe');
  // Le décodeur doit être imposé APRÈS la création de l'élément : la créer
  // remet model-viewer sur le décodeur distant de Google.
  const creation = hero.indexOf("document.createElement('model-viewer')");
  const reglage = hero.indexOf('dracoDecoderLocation');
  assert.ok(creation !== -1 && reglage > creation, 'décodeur réglé après la création');
});

test('les textes du héros existent en français et en anglais, sans tiret long', () => {
  const textes = new Function('return ' + hero.slice(hero.indexOf('{', hero.indexOf('var TEXTES')),
    hero.indexOf('\n  };', hero.indexOf('var TEXTES')) + 4).replace(/;$/, ''))();
  assert.deepEqual(Object.keys(textes.fr).sort(), Object.keys(textes.en).sort());
  for (const langue of ['fr', 'en']) {
    for (const [cle, valeur] of Object.entries(textes[langue])) {
      assert.equal(typeof valeur, 'string');
      assert.ok(valeur.length > 0 || cle === 'unite', cle + ' non vide');
      assert.ok(!/[—–]/.test(valeur), 'aucun tiret long dans ' + langue + '.' + cle);
    }
  }
});

test('l’accueil accueille la scène 3D dans les deux langues', () => {
  const html = lire('index.html');
  for (const langue of ['fr', 'en']) {
    assert.ok(html.includes('data-rb-hero3d="' + langue + '"'), 'point de montage ' + langue);
  }
  assert.equal(html.split('class="rb-hero3d-stage"').length - 1, 2);
  // La photo reste dans le gabarit : elle couvre le chargement et les pannes.
  assert.equal(html.split('img/hero-machine-photo.webp').length - 1, 3);
  const css = lire('interface.css');
  for (const regle of ['.rb-hero3d-stage', '.rb-hero3d-layer', '.rb-hero3d-hint', '.rb-hero3d-zoom']) {
    assert.ok(css.includes(regle), 'style ' + regle);
  }
});
