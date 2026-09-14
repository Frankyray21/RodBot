/* Garde-fous sur les banques de questions QUIZ2 (FR) et QUIZ2_EN.
   Les deux littéraux tiennent chacun sur une seule ligne d'app.js : on les
   relit ici comme du JSON pour vérifier ce que la relecture humaine laisse
   passer (symétrie des deux langues, type du champ correct, style imposé). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SOURCE = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

/* Lit le littéral objet qui suit un marqueur, en respectant les chaînes. */
function litteralApres(marqueur) {
  const depart = SOURCE.indexOf('{', SOURCE.indexOf(marqueur));
  let profondeur = 0, i = depart, dansChaine = false, echappe = false, guillemet = '';
  for (; i < SOURCE.length; i++) {
    const c = SOURCE[i];
    if (dansChaine) {
      if (echappe) echappe = false;
      else if (c === '\\') echappe = true;
      else if (c === guillemet) dansChaine = false;
      continue;
    }
    if (c === '"' || c === "'") { dansChaine = true; guillemet = c; continue; }
    if (c === '{' || c === '[') profondeur++;
    else if (c === '}' || c === ']') { profondeur--; if (profondeur === 0) { i++; break; } }
  }
  return JSON.parse(SOURCE.slice(depart, i));
}

const QUIZ_FR = litteralApres('/*__QUIZ2__*/');
const QUIZ_EN = litteralApres('var QUIZ2_EN');
const MODULES = Object.keys(QUIZ_FR);

function toutesLesQuestions() {
  const sortie = [];
  for (const langue of [['fr', QUIZ_FR], ['en', QUIZ_EN]]) {
    for (const module of Object.keys(langue[1])) {
      langue[1][module].forEach((q, i) => sortie.push({ langue: langue[0], module, i, q }));
    }
  }
  return sortie;
}

test('les deux banques couvrent les mêmes modules et le même nombre de questions', () => {
  assert.deepEqual(Object.keys(QUIZ_EN), MODULES);
  for (const module of MODULES) {
    assert.equal(QUIZ_EN[module].length, QUIZ_FR[module].length, 'module ' + module);
    assert.equal(QUIZ_FR[module].length, 5, 'module ' + module + ' : 5 questions attendues');
  }
});

test('chaque question anglaise est la jumelle exacte de la française', () => {
  for (const module of MODULES) {
    QUIZ_FR[module].forEach((fr, i) => {
      const en = QUIZ_EN[module][i];
      const ou = 'module ' + module + ' question ' + (i + 1);
      assert.equal(en.type, fr.type, ou + ' : même type');
      assert.equal(en.page, fr.page, ou + ' : la page reste celle du manuel FR');
      assert.deepEqual(en.correct, fr.correct, ou + ' : même index correct');
      assert.equal(en.options.length, fr.options.length, ou + ' : même nombre d\'options');
    });
  }
});

test('le champ correct est toujours numérique, jamais une chaîne', () => {
  /* app.js corrige avec une égalité stricte (sel === q.correct) : une chaîne
     rendrait la question impossible à réussir. */
  for (const { langue, module, i, q } of toutesLesQuestions()) {
    const ou = langue + ' module ' + module + ' question ' + (i + 1);
    const valeurs = Array.isArray(q.correct) ? q.correct : [q.correct];
    for (const v of valeurs) {
      assert.equal(typeof v, 'number', ou + ' : index numérique attendu');
      assert.ok(v >= 0 && v < q.options.length, ou + ' : index hors des options');
    }
    if (Array.isArray(q.correct)) assert.ok(q.correct.length > 0, ou + ' : aucune bonne réponse');
  }
});

test('chaque question cite une page du manuel FR qui existe', () => {
  for (const { langue, module, i, q } of toutesLesQuestions()) {
    const ou = langue + ' module ' + module + ' question ' + (i + 1);
    assert.equal(typeof q.page, 'number', ou + ' : page manquante');
    assert.ok(q.page >= 1 && q.page <= 87, ou + ' : page hors du manuel');
  }
});

test('aucun tiret long dans les questions, les options ou les rétroactions', () => {
  for (const { langue, module, i, q } of toutesLesQuestions()) {
    const texte = [q.text, q.fb || ''].concat(q.options).join(' ');
    assert.ok(!/[—–]/.test(texte),
      langue + ' module ' + module + ' question ' + (i + 1) + ' : tiret long interdit');
  }
});

test('aucune question ne demande un repère avant, arrière, droite ou gauche du châssis', () => {
  /* Retour terrain : le manuel ne définit nulle part l'avant du châssis, donc
     une question qui l'exige mesure une convention non écrite. */
  const pieges = /(avant|arri[eè]re)\s+(droit|gauche)|(front|rear)\s+(right|left)/i;
  for (const { langue, module, i, q } of toutesLesQuestions()) {
    const texte = [q.text, q.fb || ''].concat(q.options).join(' ');
    assert.ok(!pieges.test(texte),
      langue + ' module ' + module + ' question ' + (i + 1) + ' : repère d\'orientation non prouvé');
  }
});

test('les options du module 02 ne donnent pas la réponse d\'une autre question du module', () => {
  /* Règle du projet : une notion, une seule question par module. La règle des
     capots sous tension appartient à Q1, elle ne doit plus apparaître en Q4. */
  for (const banque of [QUIZ_FR, QUIZ_EN]) {
    const module = banque['1'];
    const q1 = module[0];
    assert.match(q1.text + ' ' + q1.options.join(' '), /capot|cover/i);
    module.slice(1).forEach((q, i) => {
      assert.ok(!/capot|cover/i.test(q.options.join(' ')),
        'module 02 question ' + (i + 2) + ' : la notion des capots appartient à Q1');
    });
  }
});

test('la pagination anglaise pointe sur les pages qui portent vraiment la preuve', () => {
  /* Le manuel anglais compte 82 pages. Les sections 2.3 et 2.4, citées par le
     module 02, tiennent toutes les deux sur sa page 11 ; sa page 12 est blanche. */
  const carte = SOURCE.match(/var PAGE_MAP_EN = \{([^}]+)\}/);
  assert.ok(carte, 'PAGE_MAP_EN introuvable');
  const paires = {};
  for (const morceau of carte[1].split(',')) {
    const [fr, en] = morceau.split(':').map(Number);
    paires[fr] = en;
  }
  assert.equal(paires[10], 10, 'page 10 FR : section 2 Safety');
  assert.equal(paires[11], 11, 'page 11 FR : puces de la section 2.3');
  assert.equal(paires[12], 11, 'page 12 FR : la section 2.4 commence page 11 EN');
  assert.equal(paires[13], 13, 'page 13 FR : section 3');
});
