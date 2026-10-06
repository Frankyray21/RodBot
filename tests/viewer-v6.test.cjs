const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { test } = require('node:test');

/* Atelier 3D : moteur three.js (3d/js/viewer-v6.js) sur le modèle neuf (3d/eclate).
   Le modèle se construit dans un navigateur (textures dessinées sur canevas) : ici on
   vérifie les articulations (rig.js, exécuté avec le three.js du dépôt) et les contrats
   entre le moteur, les exercices, les repères et les ensembles. */
const racine = path.join(__dirname, '..');
const lire = (f) => fs.readFileSync(path.join(racine, f), 'utf8');
const ASM = fs.readdirSync(path.join(racine, '3d/eclate/asm')).filter(f => f.endsWith('.js')).map(f => lire('3d/eclate/asm/' + f)).join('\n');
const VIEWER = lire('3d/js/viewer-v6.js');

async function chargerRig() {
  const three = pathToFileURL(path.join(racine, '3d/vendor/three/three.module.min.js')).href;
  const src = lire('3d/eclate/rig.js').replace("from 'three'", `from '${three}'`);
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rig-')), 'rig.mjs');
  fs.writeFileSync(tmp, src);
  const [rig, THREE] = await Promise.all([import(pathToFileURL(tmp).href), import(three)]);
  return { buildRig: rig.buildRig, THREE };
}
const proche = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);

test('les articulations suivent leur pivot, leur axe et leur parent', async () => {
  const { buildRig, THREE } = await chargerRig();
  const node = (type, meta, kids = [], p = [0, 0, 0]) => { const g = new THREE.Group(); g.userData = { type, ...meta }; g.position.set(...p); kids.forEach(k => g.add(k)); return g; };
  const marque = () => new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.01));
  assert.deepEqual(buildRig(new THREE.Group()).drives(), []);
  const root2 = new THREE.Group();
  const tip2 = node('part', { id: 'tip' }, [marque()], [3, 1, 0]);
  root2.add(node('asm', { id: 'base', joint: { id: 'turret', type: 'rot', pivot: [1, 0, 0], axis: [0, 1, 0] } }, [marque()]),
    node('asm', { id: 'boom', joint: { id: 'arm', type: 'rot', pivot: [1, 1, 0], axis: [0, 0, 1], parent: 'turret' } }, [tip2]));
  const R = buildRig(root2);
  assert.ok(R.has('turret') && R.has('arm'));
  const w = () => tip2.getWorldPosition(new THREE.Vector3());
  R.set('arm', 90); R.update();             // la pointe (à 2 m du pivot J2) monte à la verticale
  proche(w().x, 1); proche(w().y, 3);
  R.set('arm', 0); R.set('turret', 90); R.update();   // la tourelle emporte la flèche autour de x = 1
  proche(w().x, 1); proche(w().z, -2);
});

test('un vérin vise son point de bout et sa tige garde la longueur', async () => {
  const { buildRig, THREE } = await chargerRig();
  const g = (meta, kids = [], p) => { const o = new THREE.Group(); if (meta) o.userData = meta; if (p) o.position.set(...p); kids.forEach(k => o.add(k)); return o; };
  const rod = g({ type: 'seg', seg: 'rod' }, [new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.01))]);
  const cyl = g({ type: 'part', id: 'cyl', cyl: { end: 'arm', A: [0, 0, 0], B: [1, 0, 0] } }, [rod]);
  const arm = g({ type: 'part', id: 'arm', joint: { id: 'arm', type: 'rot', pivot: [2, 0, 0], axis: [0, 0, 1] } }, [new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.01))]);
  const root = g(null, [cyl, arm]);
  const R = buildRig(root);
  R.set('arm', 90); R.update();      // B (1,0,0) tourne autour de (2,0,0) : il passe en (2,-1,0)
  const dir = new THREE.Vector3(1, 0, 0).transformDirection(cyl.matrixWorld);
  proche(dir.x, 2 / Math.sqrt(5)); proche(dir.y, -1 / Math.sqrt(5));
  proche(rod.position.length(), Math.sqrt(5) - 1);   // longueur 1 -> racine de 5 : la tige sort de 1,236
});

test('un canal pilote toutes ses articulations (mâchoires, stabilisateurs)', async () => {
  const { buildRig, THREE } = await chargerRig();
  const root = new THREE.Group();
  const segs = [0, 1, 2, 3].map(i => { const s = new THREE.Group(); s.userData = { type: 'seg', seg: 'rod', joint: { id: 'jacks', type: 'slide', axis: [0, -1, 0], scale: 0.002 } }; s.position.x = i; s.add(new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.01))); root.add(s); return s; });
  const R = buildRig(root);
  R.set('jacks', 100); R.update();
  for (const s of segs) proche(s.getWorldPosition(new THREE.Vector3()).y, -0.2);
  assert.equal(R.set('inconnu', 1), false);
});

test("le moteur offre tout ce que les exercices et la page de l'atelier appellent", () => {
  const usages = new Set();
  for (const src of [lire('3d/js/training-ui.js'), lire('3d/index.html')]) {
    for (const m of src.matchAll(/(?<![\w/.-])(?:viewer|v)\.(\w+)/g)) usages.add(m[1]);
  }
  for (const nom of ['canvas', 'model', 'getBoundingClientRect']) usages.delete(nom);
  const api = VIEWER.slice(VIEWER.indexOf('const api = {'));
  const manquants = [...usages].filter(n => !new RegExp(`\\b${n}\\b`).test(api));
  assert.deepEqual(manquants, [], 'méthodes absentes de viewer-v6.js : ' + manquants.join(', '));
  assert.ok(!/v\.model\./.test(lire('3d/index.html')), "plus d'appel à model-viewer dans l'atelier");
});

test('chaque mouvement, levier, bouton et accès du moteur est décrit dans un ensemble', () => {
  const ids = new Set([...ASM.matchAll(/id: '([^']+)'/g)].map(m => m[1]));
  const drives = new Set([...ASM.matchAll(/drive: '([^']+)'/g)].map(m => m[1]));
  const modeles = [...ASM.matchAll(/id: `([^`]+)`/g)].map(m => new RegExp('^' + m[1].replace(/\$\{[^}]+\}/g, '.+') + '$'));
  const existe = (id) => ids.has(id) || drives.has(id) || modeles.some(r => r.test(id));
  const motions = [...VIEWER.matchAll(/drive: '([^']+)'/g)].map(m => m[1]);
  assert.equal(motions.length, 7);
  const attendus = [...motions,
    ...Array.from({ length: 7 }, (_, i) => 'ctl:front0' + (i + 1)), ...Array.from({ length: 5 }, (_, i) => 'ctl:side0' + (i + 1)),
    'ctl:js1x', 'ctl:js1y', 'ctl:js2', 'ctl:js3x', 'ctl:js3y',
    'btn:u1', 'btn:u2', 'btn:u3', 'btn:u4', 'btn:grip', 'btn:rearm', 'btn:start', 'btn:mode_linear', 'btn:mode_direct', 'btn:mode_standby',
    'acc:panel', 'acc:source'];
  assert.deepEqual(attendus.filter(id => !existe(id)), []);
});

test('les repères visent des pièces du modèle et couvrent exercices et fiches', async () => {
  const H = await import(pathToFileURL(path.join(racine, '3d/js/hotspots-v41.js')).href);
  const tous = [...H.HOTSPOTS, ...H.URGENCES, ...H.CONTROLS, ...H.LEVERS];
  assert.equal(tous.length, 41);
  const ids = new Set([...ASM.matchAll(/(?:id: |\bP\()'([^']+)'/g)].map(m => m[1]));
  const modeles = [...ASM.matchAll(/id: `([^`]+)`/g)].map(m => new RegExp('^' + m[1].replace(/\$\{[^}]+\}/g, '.+') + '$'));
  for (const h of tous) {
    assert.ok(ids.has(h.node) || modeles.some(r => r.test(h.node)), h.id + ' vise une pièce inconnue : ' + h.node);
    assert.ok(h.pos.every(Number.isFinite) && h.view && h.view.target.every(Number.isFinite), h.id + ' sans position ni vue');
  }
  const ui = lire('3d/js/training-ui.js');
  const cibles = [...ui.matchAll(/targets:\[([^\]]*)\]/g)].flatMap(m => [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]));
  assert.ok(cibles.length >= 15);
  for (const id of cibles) assert.ok(H.hotspotById(id), 'repère absent pour la cible ' + id);
  const page = lire('3d/index.html');
  for (const id of ['bras', 'pince', 'panier', 'stab', 'boyaux', 'elec', 'remote', 'u1', 'u2', 'u3', 'u4']) {
    assert.ok(page.includes(`"id": "${id}"`), 'fiche absente : ' + id);
    assert.ok(H.hotspotById(id), 'repère absent : ' + id);
  }
  for (const vue of [...page.matchAll(/VUES\.(\w+)/g)].map(m => m[1])) assert.ok(H.VUES[vue], 'vue absente : ' + vue);
});

test("l'atelier charge le moteur neuf et sa carte d'import three.js", () => {
  const page = lire('3d/index.html');
  assert.ok(page.includes("import('./js/viewer-v6.js?v=' + VER)"));
  assert.ok(page.includes("import('./js/hotspots-v41.js?v=' + VER)"));
  const carte = JSON.parse(page.match(/<script type="importmap">(.*?)<\/script>/)[1]).imports;
  assert.ok(fs.existsSync(path.join(racine, '3d', carte.three)), 'three.js absent');
  assert.ok(fs.existsSync(path.join(racine, '3d', carte['three/addons/'], 'controls/OrbitControls.js')), 'addons absents');
  for (const m of VIEWER.matchAll(/from '(\.[^']+)'/g)) assert.ok(fs.existsSync(path.join(racine, '3d/js', m[1])), 'import absent : ' + m[1]);
  for (const m of VIEWER.matchAll(/from 'three\/addons\/([^']+)'/g)) assert.ok(fs.existsSync(path.join(racine, '3d/vendor/three/addons', m[1])), 'addon absent : ' + m[1]);
  // les anciennes pages renvoient vers l'atelier
  for (const f of ['3d/atelier.html', '3d/replique.html']) assert.ok(lire(f).includes("location.replace('./index.html'"), f + ' doit renvoyer vers l\'atelier');
});
