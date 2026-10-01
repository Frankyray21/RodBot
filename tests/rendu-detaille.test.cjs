const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

const lire = (...bouts) => readFileSync(join(__dirname, '..', ...bouts), 'utf8');

/* On isole chooseQuality du reste du module : la fonction décide, à elle
   seule, du rendu servi à l'opérateur. */
function qualite(contexte, valeur) {
  const source = lire('3d', 'js', 'viewer-v5.js');
  const bloc = source.slice(source.indexOf('function chooseQuality'));
  const corps = bloc.slice(0, bloc.indexOf('\n}\n') + 3);
  const vmContexte = vm.createContext(Object.assign({ URLSearchParams }, contexte));
  vm.runInContext(corps + '\nglobalThis.choisir = chooseQuality;', vmContexte);
  return vmContexte.choisir(valeur);
}
const TELEPHONE = {
  location: { search: '' }, screen: { width: 390, height: 780 },
  navigator: { saveData: true, connection: { saveData: true }, deviceMemory: 2 }
};
const ORDINATEUR = { location: { search: '' }, screen: { width: 1600, height: 900 }, navigator: {} };

test('le rendu détaillé est servi partout, téléphone compris', () => {
  assert.equal(qualite(ORDINATEUR), 'hq');
  assert.equal(qualite(TELEPHONE), 'hq', 'un petit écran ne doit plus basculer en rendu fluide');
  assert.equal(qualite(Object.assign({}, ORDINATEUR, { location: { search: '?q=hq' } })), 'hq');
});

test('le rendu fluide ne reste qu’un dépannage, jamais un choix offert', () => {
  // Forcer ?q=mobile ou appeler setQuality('mobile') reste possible : c'est la
  // soupape pour un appareil qui peine, pas une option dans l'écran.
  assert.equal(qualite(ORDINATEUR, 'mobile'), 'mobile');
  assert.equal(qualite(Object.assign({}, ORDINATEUR, { location: { search: '?q=mobile' } })), 'mobile');
});

test('plus aucun choix de rendu dans la page 3D', () => {
  const html = lire('3d', 'index.html');
  for (const trace of ['qualitySelect', 'quality-choice', '>Fluide<', 'Rendu <select']) {
    assert.ok(!html.includes(trace), 'reste une trace du choix de rendu : ' + trace);
  }
  assert.ok(html.includes('Réplique articulée · Détails'), 'l’état dit le rendu servi');
  for (const css of ['viewer.css', 'training.css']) {
    assert.ok(!lire('3d', 'css', css).includes('quality-choice'), 'style mort dans ' + css);
  }
});
