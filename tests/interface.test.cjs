const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { searchLessons, normalize } = require('../interface.js');

const modules = [
  { title: 'Commandes', short: 'Télécommande', sections: [
    { title: 'Arrêt et sécurité', page: 18, content: 'Texte non indexé' },
    { title: 'Les freins', page: 20 }
  ], quiz: [{ question: 'Question secrète', options: ['Réponse secrète'] }] },
  { title: 'Entretien', sections: [{ title: 'Inspection quotidienne', page: 62 }] }
];

test('la recherche ignore accents, casse et ponctuation', () => {
  assert.equal(normalize(' TÉLÉCOMMANDE : arrêt! '), 'telecommande arret');
  assert.equal(searchLessons(modules, 'TELECOMMANDE arrêt')[0].lesson, 0);
  assert.equal(searchLessons(modules, 'telecommande').length, 2);
});

test('tous les mots doivent correspondre à la même leçon', () => {
  assert.equal(searchLessons(modules, 'freins commandes').length, 1);
  assert.deepEqual(searchLessons(modules, 'freins inspection'), []);
});

test('les titres et pages sont indexés, jamais les questions ni réponses', () => {
  assert.equal(searchLessons(modules, 'page 18')[0].title, 'Arrêt et sécurité');
  for (const query of ['secrète', 'question', 'réponse', 'non indexé', 'undefined']) {
    assert.deepEqual(searchLessons(modules, query), []);
  }
});

test('une recherche vide ou sans résultat retourne une liste vide', () => {
  for (const query of ['', '   ', '!!!', 'inexistant']) assert.deepEqual(searchLessons(modules, query), []);
});

test('les pages affichées suivent le manuel traduit', () => {
  const en = [{ title: 'Controls', sections: [{ title: 'Emergency stop', page: 18 }] }];
  assert.deepEqual(searchLessons(en, 'page 21', page => page + 3), [
    { module: 0, lesson: 0, title: 'Emergency stop', moduleTitle: 'Controls', page: 21 }
  ]);
  assert.deepEqual(searchLessons(en, 'page 18', page => page + 3), []);
});

test('les résultats ne modifient pas les modules', () => {
  const before = JSON.stringify(modules);
  searchLessons(modules, 'arret');
  assert.equal(JSON.stringify(modules), before);
});

test('les ressources d’interface et la version sont cohérentes', () => {
  const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
  const version = read('app.js').match(/var APP_VERSION = '([^']+)'/)[1];
  const html = read('index.html'), sw = read('sw.js');
  for (const file of ['app.js', 'pdf.js', 'interface.js', 'interface.css']) {
    assert.ok(html.includes(file + '?v=' + version), file + ' versionné');
    assert.ok(sw.includes("'./" + file + "'"), file + ' précaché');
  }
  assert.ok(sw.includes('rodbot-formation-v' + version));
});

test('le générateur PDF est chargé avant app.js', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.ok(html.indexOf('pdf.js?v=') < html.indexOf('src="app.js?v='),
            'pdf.js doit être défini avant app.js');
});

test("l'attestation PDF se fabrique sans réseau et se lit", () => {
  const sandbox = { window: {} };
  const code = fs.readFileSync(path.join(__dirname, '..', 'pdf.js'), 'utf8');
  new Function('window', code)(sandbox.window);
  const P = sandbox.window.RodbotPdf;
  assert.equal(typeof P.attestation, 'function');
  const bytes = P.attestation({
    name: 'Éric Côté', date: '11 septembre 2026', heure: '08 h 12',
    phrase: 'a suivi et validé la formation.',
    cles: [{ k: 'SCORE GLOBAL', v: '88 %', rouge: true }],
    modules: [{ num: '01', title: 'Connaître le RodBot', score: '100 %', passed: true,
                lues: '5/5', allRead: true, lecture: '4 min', quiz: '2 min' }],
    totaux: { score: '88 %', lues: '5/5', lecture: '4 min', quiz: '2 min' },
    strokes: [[{ x: 10, y: 10 }, { x: 300, y: 120 }]],
    notes: ['Seuil de réussite : 70 % par module.'],
    labels: { titre: 'ATTESTATION DE FORMATION' }
  });
  assert.ok(bytes instanceof Uint8Array);
  const txt = Buffer.from(bytes).toString('latin1');
  assert.ok(txt.startsWith('%PDF-1.4'), 'en-tête PDF');
  assert.ok(txt.trimEnd().endsWith('%%EOF'), 'fin de fichier PDF');
  // La table xref doit pointer sur de vrais objets, sinon le lecteur refuse.
  const startxref = Number(txt.match(/startxref\s+(\d+)/)[1]);
  assert.ok(txt.slice(startxref, startxref + 4) === 'xref', 'startxref juste');
  const lignes = txt.slice(startxref).split('\n');
  const nb = Number(lignes[1].split(' ')[1]);
  for (let i = 1; i < nb; i++) {
    const pos = Number(lignes[2 + i].slice(0, 10));
    assert.equal(txt.slice(pos, pos + String(i).length + 6), i + ' 0 obj', 'objet ' + i + ' bien placé');
  }
  // Les accents passent en WinAnsi, jamais en octets bruts.
  assert.ok(txt.includes('\\311ric C\\364t\\351'), 'accents encodés en WinAnsi');
  assert.ok(!/[\u0080-\uffff]/.test(txt.slice(0, startxref)), 'le corps reste en ASCII');
});
