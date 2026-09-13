const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

/* On charge scene3d.js dans un faux « window » : le module ne touche au DOM
   qu'au moment du montage, donc la trajectoire de la camera est verifiable
   sans navigateur. C'est elle qui fait le tour, le zoom et la rotation. */
function charger() {
  const faux = { matchMedia: () => ({ matches: false, addEventListener() {} }) };
  const code = fs.readFileSync(path.join(__dirname, '..', 'scene3d.js'), 'utf8');
  new Function('window', 'document', 'navigator', code)(faux, { addEventListener() {} }, {});
  return faux.RBScene3D;
}
const lire = s => {
  const m = s.match(/^(-?[\d.]+)deg (-?[\d.]+)deg ([\d.]+)%$/);
  assert.ok(m, 'orbite mal formée : ' + s);
  return { theta: +m[1], phi: +m[2], dist: +m[3] };
};

test('la scène 3D expose sa trajectoire de caméra', () => {
  const S = charger();
  assert.equal(typeof S.monter, 'function');
  assert.equal(typeof S._orbite, 'function');
});

test('la caméra fait le tour complet de la machine', () => {
  const S = charger();
  const debut = lire(S._orbite(0));
  const quart = lire(S._orbite(S._TOUR_S / 4));
  const fin = lire(S._orbite(S._TOUR_S * 0.999));
  assert.equal(debut.theta, -180, 'départ derrière la machine');
  assert.ok(Math.abs(quart.theta - (-90)) < 0.1, 'quart de tour à -90 deg, obtenu ' + quart.theta);
  assert.ok(fin.theta > 179, 'tour presque bouclé, obtenu ' + fin.theta);
  // Le tour recommence : on repasse par le point de départ.
  assert.equal(lire(S._orbite(S._TOUR_S)).theta, -180);
});

test('la caméra se rapproche puis recule', () => {
  const S = charger();
  let mini = Infinity, maxi = -Infinity;
  for (let t = 0; t <= S._RESPIRE_S; t += 0.25) {
    const d = lire(S._orbite(t)).dist;
    if (d < mini) mini = d;
    if (d > maxi) maxi = d;
  }
  assert.ok(Math.abs(maxi - 96) < 0.2, 'recul maximal à 96 %, obtenu ' + maxi);
  assert.ok(Math.abs(mini - 70) < 0.2, 'approche maximale à 70 %, obtenu ' + mini);
  // Départ au plus loin, mi-parcours au plus près : c'est un aller-retour.
  assert.ok(lire(S._orbite(0)).dist > lire(S._orbite(S._RESPIRE_S / 2)).dist);
});

test('la hauteur de vue reste lisible, jamais au ras du sol ni à la verticale', () => {
  const S = charger();
  for (let t = 0; t < 600; t += 0.5) {
    const o = lire(S._orbite(t));
    assert.ok(o.phi >= 62 && o.phi <= 82, 'hauteur hors plage à t=' + t + ' : ' + o.phi);
    assert.ok(o.dist >= 69 && o.dist <= 97, 'distance hors plage à t=' + t + ' : ' + o.dist);
    assert.ok(o.theta >= -180 && o.theta <= 180, 'angle hors plage à t=' + t + ' : ' + o.theta);
  }
});

test('la scène est précachée et chargée par la page', () => {
  const lireF = n => fs.readFileSync(path.join(__dirname, '..', n), 'utf8');
  const version = lireF('app.js').match(/var APP_VERSION = '([^']+)'/)[1];
  const html = lireF('index.html'), sw = lireF('sw.js');
  assert.ok(html.includes('scene3d.js?v=' + version), 'scene3d.js versionné');
  assert.ok(sw.includes("'./scene3d.js'"), 'scene3d.js précaché');
  // Deux gabarits, donc deux emplacements : un par langue.
  assert.equal((html.match(/data-rb-scene3d/g) || []).length, 2);
  assert.ok(sw.includes("'./3d/vendor/model-viewer-4.3.1.min.js'"), 'moteur 3D précaché');
});
