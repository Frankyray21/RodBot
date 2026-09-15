/* Option « App Android (APK) » : carte de téléchargement, code QR, fenêtre
   d'explication. Ces tests protègent le lien de téléchargement (une adresse
   fausse donne un code QR qui ne mène nulle part) et la symétrie FR / EN. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const racine = path.join(__dirname, '..');
const lire = (f) => fs.readFileSync(path.join(racine, f), 'utf8');
const APP = lire('app.js');
const HTML = lire('index.html');
const SW = lire('sw.js');

/* Adresse attendue : lien stable de la Release, remplacé à chaque version
   par GitHub Actions (.github/workflows/android-apk.yml). */
const URL_APK = 'https://github.com/Frankyray21/RodBot/releases/download/apk-latest/RodBot-LP.apk';

test("l'adresse de téléchargement de l'APK est celle publiée par GitHub Actions", () => {
  assert.ok(APP.includes(`var APK_URL = "${URL_APK}";`), 'APK_URL doit viser le lien stable');
  const wf = lire('.github/workflows/android-apk.yml');
  assert.ok(wf.includes('releases/download/apk-latest/RodBot-LP.apk'),
    'le workflow doit publier le fichier sous ce nom');
  assert.ok(wf.includes('RodBot-LP.apk#RodBot-LP.apk (lien stable)'),
    "le fichier au nom stable doit être envoyé dans la Release");
});

test('le code QR existe, est un vrai QR et vise la même adresse que le bouton', () => {
  for (const f of ['qr-apk-android.svg', 'qr-apk-android.png']) {
    assert.ok(fs.existsSync(path.join(racine, f)), f + ' doit exister');
  }
  // Le script de génération est la source de vérité du contenu encodé.
  const gen = lire('apk/scripts/generer-qr.py');
  assert.ok(gen.includes(`URL = "${URL_APK}"`), 'le script du QR doit encoder la même adresse');
  const svg = lire('qr-apk-android.svg');
  assert.ok(svg.includes('class="segno"'), 'le SVG doit venir du générateur');
  // Version 5 (80 caractères, correction M) : 37 modules + 4 de marge de chaque côté.
  assert.match(svg, /width="1080" height="1080"/, 'taille attendue du QR (45 modules × 24)');
});

test('le code QR et son image restent lisibles hors ligne', () => {
  for (const f of ['./qr-apk-android.svg', './qr-apk-android.png']) {
    assert.ok(SW.includes(`'${f}'`), f + ' doit être précaché par le service worker');
  }
});

test("la carte et la fenêtre de l'app Android sont dans les deux gabarits", () => {
  // Deux gabarits : rb-template (FR) et rb-template-en (EN).
  for (const marque of ['{{ apk.ouvert }}', '{{ apk.qr }}', '{{ apk.blocChemin }}', '{{ apk.blocSamsung }}',
                        '{{ apk.btnQr }}', '{{ apk.etapes }}',
                        '{{ apk.quoi1 }}', '{{ apk.reseau }}', '{{ apk.iosNote }}']) {
    assert.equal(HTML.split(marque).length - 1, 2, marque + ' doit apparaître en FR et en EN');
  }
  // La visibilité pilote la carte ET le bouton du menu, dans les deux langues.
  assert.equal(HTML.split('{{ apk.montrer }}').length - 1, 4, 'carte et bouton du menu, en FR et en EN');
  // Bouton de téléchargement : sur la carte ET dans la fenêtre, donc deux fois par langue.
  assert.equal(HTML.split('{{ apk.btnDl }}').length - 1, 4, 'carte et fenêtre, dans les deux langues');
  // Le même lien mène toujours au fichier : carte, fenêtre et adresse écrite en clair.
  assert.equal(HTML.split('{{ apk.url }}').length - 1, 6, 'carte, bouton de la fenêtre et adresse copiable');
  // La fenêtre se ferme au clic sur le fond et par le bouton.
  assert.equal(HTML.split('data-rb-dialog="apkqr"').length - 1, 2);
  assert.equal(HTML.split('{{ apk.close }}').length - 1, 4, 'fond + bouton, dans les deux langues');
});

test("l'app Android se ferme comme les autres fenêtres (retour, Échap)", () => {
  assert.ok(APP.includes('if(S.apkQr) d += 1;'), 'le bouton RETOUR doit fermer la fenêtre');
  assert.ok(APP.includes("if(S.apkQr){ this.setState({ apkQr:false }); return; }"),
    'navBackOne doit fermer la fenêtre avant de quitter');
  assert.ok(APP.includes("if(COMP.state.apkQr){ if(e.key==='Escape') COMP.closeApkQr(); return; }"),
    'la touche Échap doit fermer la fenêtre');
});

test("la carte est cachée dans l'application Android elle-même", () => {
  assert.ok(APP.includes('montrer:!IS_NATIVE,'),
    "inutile de proposer l'app quand on est déjà dedans");
});

test('les textes de la carte et de la fenêtre suivent les règles du site', () => {
  // Bloc base.apk = { ... } : extrait borné pour ne lire que ces textes.
  const debut = APP.indexOf('base.apk = {');
  assert.ok(debut > 0, 'bloc base.apk introuvable');
  const bloc = APP.slice(debut, APP.indexOf('\n    };', debut));
  assert.ok(!/[—–]/.test(bloc), 'jamais de tiret long (— ou –) dans les textes du site');
  // Chaque texte affiché reste court : les opérateurs lisent sur une tablette.
  for (const [, texte] of bloc.matchAll(/this\.tr\("([^"]+)"/g)) {
    const mots = texte.split(/\s+/).length;
    assert.ok(mots <= 16, `phrase trop longue (${mots} mots) : ${texte}`);
  }
});

test('les quatre étapes sont numérotées et jumelles FR / EN', () => {
  const debut = APP.indexOf('etapes:[');
  const bloc = APP.slice(debut, APP.indexOf('],', debut));
  const numeros = [...bloc.matchAll(/\{ n:"(\d)"/g)].map((m) => m[1]);
  assert.deepEqual(numeros, ['1', '2', '3', '4']);
  assert.equal([...bloc.matchAll(/this\.tr\(/g)].length, 4, 'chaque étape a sa version anglaise');
});

test("le menu du haut donne accès à l'app Android", () => {
  // Cinquième entrée de la barre de navigation, après « Rechercher ».
  assert.equal(HTML.split('class="rb-nav-apk"').length - 1, 2, 'un bouton par langue');
  for (const nav of HTML.match(/<nav class="rb-quick-nav"[\s\S]*?<\/nav>/g) || []) {
    assert.ok(nav.includes('rb-nav-apk'), 'le bouton doit être dans la barre de navigation');
    assert.ok(nav.indexOf('data-rb-search-trigger') < nav.indexOf('rb-nav-apk'),
      'il vient après « Rechercher »');
    assert.ok(nav.includes('{{ apk.open }}'), 'il ouvre la fenêtre du code QR');
    assert.ok(nav.includes('{{ apk.navTitre }}'), 'une infobulle dit ce que fait le bouton');
  }
  assert.ok(APP.includes('nav:this.tr("Android ↓","Android ↓"),'), 'libellé court et bilingue');
});

test("la barre de navigation garde des colonnes égales avec 4 ou 5 entrées", () => {
  const css = lire('interface.css');
  const bloc = css.slice(css.indexOf('.rb-quick-nav {'), css.indexOf('.rb-quick-nav button:hover'));
  assert.ok(/display: flex/.test(bloc), 'flex : la largeur suit le nombre de boutons');
  assert.ok(/flex: 1 1 0/.test(bloc), 'chaque bouton prend la même largeur');
  assert.ok(!/repeat\(4/.test(bloc), 'plus de grille figée à quatre colonnes');
  // Sur téléphone, cinq entrées tiennent grâce à un texte plus serré.
  assert.ok(css.includes('.rb-quick-nav:has(.rb-nav-apk) button'), 'règle téléphone pour cinq entrées');
});

test("la fenêtre dit quoi faire quand Android refuse l'installation", () => {
  // Cas vécu sur un Samsung : Play Protect éteint, mais le « Bloqueur automatique » bloque.
  assert.ok(APP.includes('Bloqueur automatique'), 'le blocage Samsung doit être nommé');
  assert.ok(APP.includes('Auto Blocker'), 'et sa version anglaise');
  assert.ok(APP.includes('Paramètres → Sécurité et confidentialité → Bloqueur automatique.'),
    'le chemin exact des réglages doit être donné');
  assert.ok(/Play Protect est éteint/.test(APP),
    'préciser que désactiver Play Protect ne suffit pas');
  assert.equal(HTML.split('{{ apk.blocTitre }}').length - 1, 2, 'affiché en FR et en EN');
  // Le bloc se lit avant l'avertissement réseau, plus bas dans la fenêtre.
  for (const f of HTML.match(/<div data-rb-dialog="apkqr"[\s\S]*?<\/sc-if>/g) || []) {
    assert.ok(f.indexOf('apk.blocTitre') < f.indexOf('apk.reseau'), 'le déblocage vient avant la note réseau');
  }
});
