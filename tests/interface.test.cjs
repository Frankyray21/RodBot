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
  for (const file of ['app.js', 'interface.js', 'interface.css']) {
    assert.ok(html.includes(file + '?v=' + version), file + ' versionné');
    assert.ok(sw.includes("'./" + file + "'"), file + ' précaché');
  }
  assert.ok(sw.includes('rodbot-formation-v' + version));
});
