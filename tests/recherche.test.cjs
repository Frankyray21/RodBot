const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');

const lire = (...bouts) => readFileSync(join(__dirname, '..', ...bouts), 'utf8');

/* recherche.js ne touche au DOM qu'au montage : la recherche se vérifie donc
   sans navigateur, exactement comme la trajectoire de la scène 3D. */
function charger() {
  const faux = {};
  new Function('window', 'document', 'navigator', lire('recherche.js'))(faux, { addEventListener() {} }, {});
  return faux.RBRecherche;
}
const R = charger();
const titres = (requete, en) => R._chercherAteliers(requete, en).map(a => (en ? a.en : a.fr));

test('le mot du terrain trouve le bon atelier', () => {
  assert.deepEqual(titres('coffret'), ['Ouvrir le coffret IHM']);
  assert.deepEqual(titres('arrêt d’urgence'), ['Trouver les quatre arrêts d’urgence']);
  assert.deepEqual(titres('estop'), ['Trouver les quatre arrêts d’urgence']);
  assert.deepEqual(titres('js2'), ['Repérer les commandes radio']);
  assert.deepEqual(titres('levier'), ['Observer les leviers manuels']);
  assert.deepEqual(titres('grappin'), ['Explorer les composants']);
});

test('la page du manuel et la langue mènent au même atelier', () => {
  assert.deepEqual(titres('page 14'), ['Ouvrir le coffret IHM']);
  assert.deepEqual(titres('page 14', true), ['Open the HMI cabinet']);
  assert.deepEqual(titres('gripper', true), ['Explore the components']);
});

test('tous les mots tapés doivent coller, et une recherche vide ne donne rien', () => {
  assert.deepEqual(titres('coffret urgence'), []);
  for (const vide of ['', '   ', '!!!']) assert.deepEqual(titres(vide), []);
  assert.deepEqual(titres('xyz'), []);
  assert.equal(R._chercherAteliers('3d').length, R._ateliers.length, 'taper 3d montre tous les ateliers');
});

test('chaque atelier garde son exercice, sa page et ses deux langues', () => {
  const connus = ['panel', 'emergency-points', 'radio-points', 'manual-levers', ''];
  const html3d = lire('3d', 'index.html') + lire('3d', 'js', 'training-ui.js');
  for (const a of R._ateliers) {
    assert.ok(connus.includes(a.ex), 'exercice inconnu : ' + a.ex);
    if (a.ex) assert.ok(html3d.includes(a.ex), a.ex + ' n’existe pas dans la page 3D');
    for (const champ of ['fr', 'en', 'motsFr', 'motsEn', 'ic']) {
      assert.ok(a[champ] && a[champ].length, champ + ' manquant sur ' + a.ex);
    }
    assert.ok(!/[—–]/.test(a.fr + a.en), 'aucun tiret long');
  }
});

test('la grille de cartes a laissé la place au champ de recherche', () => {
  const html = lire('index.html');
  for (const mort of ['rb-3d-carte', 'rb-3d-grid', 'rb-3d-note', 'Ouvrir, toucher, essayer']) {
    assert.ok(!html.includes(mort), 'reste une trace de l’ancienne section : ' + mort);
  }
  assert.ok(!lire('interface.css').includes('rb-3d-'), 'styles morts des cartes 3D');
  // Un emplacement par langue, et la section porte un nom dans les deux.
  assert.equal((html.match(/data-rb-recherche/g) || []).length, 2);
  assert.equal((html.match(/data-rb-scroll-section="trouver"/g) || []).length, 2);
  assert.ok(html.includes('02 : TROUVER UN MOT') && html.includes('02 : FIND A WORD'));
  // Le sommaire de la base de connaissances suit la nouvelle section.
  const app = lire('app.js');
  assert.ok(app.includes('["trouver","02"'), 'sommaire mis à jour');
  assert.ok(!app.includes('"machine3d"'), 'ancienne entrée de sommaire');
  assert.ok(app.includes('window.RBRecherche.monter(ROOT)'), 'le bloc est redéposé après chaque rendu');
});

test('la recherche est versionnée, précachée et sans adresse externe', () => {
  const version = lire('app.js').match(/var APP_VERSION = '([^']+)'/)[1];
  assert.ok(lire('index.html').includes('recherche.js?v=' + version), 'recherche.js versionné');
  assert.ok(lire('sw.js').includes("'./recherche.js'"), 'recherche.js précaché');
  assert.ok(!/https?:\/\//.test(lire('recherche.js')), 'aucune adresse externe : la recherche marche hors ligne');
});
