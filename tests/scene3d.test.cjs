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
  // Deux gabarits (FR et EN), et dans chacun DEUX emplacements : l'écran de
  // choix et la base de connaissances. Les deux vivent dans des sc-if
  // exclusifs, donc un seul existe à la fois et la scène, unique, s'y dépose.
  assert.equal((html.match(/data-rb-scene3d/g) || []).length, 4);
  assert.equal((html.match(/homeChoix/g) || []).length, 2, 'un écran de choix par langue');
  assert.equal((html.match(/homeSavoir/g) || []).length, 2, 'une base de connaissances par langue');
  assert.ok(sw.includes("'./3d/vendor/model-viewer-4.3.1.min.js'"), 'moteur 3D précaché');
});

/* Contrôle INVERSE du précache. Les tests qui relisent CORE et PRECACHE pour
   vérifier que chaque entrée existe restent verts quand on RETIRE une entrée.
   Ils ne voient donc pas le trou dangereux : un fichier que le code charge et
   que personne n'a listé. Ici on part du CODE et on remonte vers les listes. */
test('chaque asset cité par le code 3D existe sur disque', () => {
  const lire = n => fs.readFileSync(path.join(__dirname, '..', n), 'utf8');
  const racine = path.join(__dirname, '..');
  // 3d/js/model-assets.js : les URL sont relatives à 3d/js/
  const assets = lire('3d/js/model-assets.js');
  const urls = [...assets.matchAll(/new URL\('\.\.\/([^']+)'/g)].map(m => m[1]);
  assert.ok(urls.length >= 4, 'model-assets.js doit déclarer au moins 4 URL');
  for (const u of urls) {
    const abs = path.join(racine, '3d', u);
    assert.ok(fs.existsSync(abs), '3d/' + u + ' est cité par model-assets.js mais absent du dépôt');
  }
  // scene3d.js : les chemins sont relatifs à la racine du site
  const scene = lire('scene3d.js');
  const chemins = [...scene.matchAll(/'(\.\/3d\/[^']+)'/g)].map(m => m[1]);
  assert.ok(chemins.length >= 4, 'scene3d.js doit citer au moins 4 chemins 3D');
  for (const c of chemins) {
    const abs = path.join(racine, c.replace(/^\.\//, ''));
    assert.ok(fs.existsSync(abs), c + ' est cité par scene3d.js mais absent du dépôt');
  }
});

test('les listes du service worker ne citent que des fichiers qui existent', () => {
  const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
  const racine = path.join(__dirname, '..');
  const bloc = (nom) => {
    const m = sw.match(new RegExp('const ' + nom + ' = \\[([\\s\\S]*?)\\];'));
    assert.ok(m, nom + ' introuvable dans sw.js');
    return [...m[1].matchAll(/'\.\/([^']+)'/g)].map(x => x[1]);
  };
  const manquants = [];
  for (const nom of ['CORE', 'PRECACHE']) {
    for (const f of bloc(nom)) {
      const propre = f.split('?')[0];
      if (!propre) continue;
      if (!fs.existsSync(path.join(racine, propre))) manquants.push(nom + ' : ' + f);
    }
  }
  // CORE est installé par cache.addAll, qui est tout ou rien : une seule entrée
  // absente casse l'installation hors ligne de TOUTE l'application.
  assert.deepEqual(manquants, [], 'fichiers listés dans sw.js mais absents du dépôt');
});

test("l'ancien moteur 3D a bien disparu", () => {
  const racine = path.join(__dirname, '..');
  for (const mort of ['3d/js/viewer.js', '3d/js/hotspots.js', '3d/js/hero-embed.js',
                      '3d/assets/rodbot_hq.sog', '3d/assets/rodbot_mobile.sog',
                      '3d/assets/rodbot-v5.glb', '3d/assets/rodbot-v5-poster.jpg']) {
    assert.equal(fs.existsSync(path.join(racine, mort)), false, mort + ' devrait être supprimé');
  }
  const sw = fs.readFileSync(path.join(racine, 'sw.js'), 'utf8');
  assert.ok(!sw.includes('cdn.jsdelivr.net'), "plus aucune origine CDN de code : le moteur 3D est local");
});
