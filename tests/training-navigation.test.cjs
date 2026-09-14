const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Execute the page's actual event wiring. Native inert/focus and GPU behaviour
// are checked separately in the browser; these tests protect transition order.
const html = fs.readFileSync(path.join(__dirname, '../3d/index.html'), 'utf8');

// La section « L'équipement : en un coup d'œil » et ses boutons « Voir sur le
// modèle 3D » ont été retirés de la page 3D : la même galerie de figures vit
// déjà dans l'app de formation. Le test qui exécutait leur gestionnaire est
// parti avec le code qu'il gardait.

test('manual and photo entry points stop training before opening their modal', () => {
  const manual = /onManual\(page\) \{([\s\S]*?)\r?\n\s*\}\r?\n\s*\}\);/.exec(html);
  const pause = /photoPause = \(\) => \{([^]*?)\};/.exec(html);
  assert(manual && pause);
  const calls = [];
  const context = vm.createContext({
    training: { releaseAll: () => calls.push('neutral'),closeInfo:()=>calls.push('close-info') },
    ouvrirPhoto: photo => calls.push(photo.src), pauserVisite: () => calls.push('pause-tour'),fermerFiche:()=>calls.push('close-card')
  });
  vm.runInContext('(function(page){' + manual[1] + '})(55);', context);
  assert.deepEqual(calls, ['neutral', '../img/manual/p55.jpg']);
  calls.length = 0;
  vm.runInContext('(function(){' + pause[1] + '})();', context);
  assert.deepEqual(calls, ['pause-tour', 'neutral','close-card','close-info']);
});

test('photo modal makes background controls inert and restores their prior state', () => {
  const start = html.indexOf('    let photoReturnFocus = null;');
  const end = html.indexOf("    pbFermer.addEventListener('click'", start);
  assert(start >= 0 && end > start);
  const classes = new Set(), calls = [];
  const photobox = { inert: false, contains: node => node === photobox,
    classList: { contains: key => classes.has(key), add: key => classes.add(key), remove: key => classes.delete(key) } };
  const content = { inert: false, contains: () => false }, alreadyInert = { inert: true, contains: () => false };
  const trigger = { isConnected: true, focus: () => calls.push('return-focus') };
  const context = vm.createContext({
    document: { body: { children: [content, alreadyInert, photobox], style: {} }, activeElement: trigger },
    photoPause: () => calls.push('neutral'), photobox,
    pbVues: { children: [] }, pbTitre: {}, pbImg: {}, pbPoints: {}, pbBascule: { style: {} },
    pbFermer: { focus: () => calls.push('modal-focus') }
  });
  vm.runInContext(html.slice(start, end), context);
  vm.runInContext("ouvrirPhoto({titre:'Manuel',src:'p55.jpg'});", context);
  assert.equal(content.inert, true, 'native keyboard navigation cannot reach the controls behind the modal');
  assert.equal(photobox.inert, false);
  assert.deepEqual(calls, ['neutral', 'modal-focus']);
  context.document.activeElement = context.pbFermer;
  vm.runInContext("ouvrirPhoto({titre:'Manuel',src:'p56.jpg'});fermerPhoto();", context);
  assert.equal(content.inert, false);
  assert.equal(alreadyInert.inert, true, 'previously inert regions stay inert');
  assert.equal(calls.at(-1), 'return-focus', 'the initial trigger is restored after changing the photo');
});

test('the electrical component card exposes a direct entry into the cabinet exercise', () => {
  assert.match(html, /<button[^>]*id="fichePanel"[^>]*hidden>Explorer le coffret<\/button>/);
  const visibility = /document\.getElementById\('fichePanel'\)\.hidden = [^;]+;/.exec(html)?.[0];
  const start = html.indexOf("      document.getElementById('fichePanel').addEventListener");
  const end = html.indexOf("      simButton.addEventListener", start);
  assert(visibility && start >= 0 && end > start);
  const calls=[];
  let click;
  const button={hidden:true,addEventListener:(_,handler)=>{click=handler;}};
  const context=vm.createContext({
    id:'elec',REDUIT:true,training:{activate:id=>calls.push(id)},
    document:{getElementById:id=>id==='fichePanel'?button:{scrollIntoView:()=>calls.push('scroll')}}
  });
  vm.runInContext(visibility,context);assert.equal(button.hidden,false);
  context.id='pince';vm.runInContext(visibility,context);assert.equal(button.hidden,true);
  vm.runInContext(html.slice(start,end),context);click();
  assert.deepEqual(calls,['panel','scroll']);
});

test('un lien direct vers le coffret ouvre la porte, les autres exercices non', () => {
  const start = html.indexOf('      const requestedExercise = new URLSearchParams');
  const end = html.indexOf('      window.rodbotTraining = training;', start);
  assert(start >= 0 && end > start);
  const code = html.slice(start, end);
  for (const [demande, ouverture] of [['panel', true], ['grip', false], ['emergency-points', false]]) {
    const appels = [];
    vm.runInNewContext(code, {
      location: { search: '?exercise=' + demande },
      URLSearchParams,
      training: { activate: (id, opts) => appels.push([id, !!(opts && opts.ouvrirCoffret)]) },
      document: { getElementById: () => ({ scrollIntoView() {} }) }
    });
    assert.deepEqual(appels, [[demande, ouverture]],
      demande === 'panel' ? 'la carte « Ouvrir le coffret » promet une porte qui s’ouvre'
                          : demande + ' ne doit pas ouvrir la porte');
  }
});

test('le logo ramène à l’accueil de la formation, pas à la page 3D', () => {
  const logo = /<a class="brand-logo" href="([^"]+)"/.exec(html);
  assert(logo, 'logo introuvable');
  assert.equal(logo[1], '../', 'le logo doit remonter à la racine du site, où vit l’écran des deux chemins');
});

test("l'atelier n'offre plus que les exercices de repérage", () => {
  const src = fs.readFileSync(path.join(__dirname, '../3d/js/training-ui.js'), 'utf8');
  const bloc = /export const EXERCISES = \[([\s\S]*?)\n\];/.exec(src);
  assert(bloc, 'liste des exercices introuvable');
  const ids = [...bloc[1].matchAll(/id:'([a-z-]+)'/g)].map(m => m[1]);
  assert.deepEqual(ids, ['emergency-points', 'radio-points', 'panel', 'manual-levers']);
  // Chaque exercice restant a des cibles à toucher : aucun ne fait manipuler
  // les manettes. Le bloc de commandes est donc toujours masqué.
  const sansCible = [...bloc[1].matchAll(/id:'([a-z-]+)'[\s\S]*?targets:\[([^\]]*)\]/g)]
    .filter(m => m[2].trim() === '').map(m => m[1]);
  assert.deepEqual(sansCible, [], 'un exercice sans cible ferait réapparaître le simulateur de commandes');

  // Les cartes de l'app ne doivent mener qu'à des exercices qui existent.
  const app = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const liens = [...app.matchAll(/3d\/\?exercise=([a-z-]+)/g)].map(m => m[1]);
  assert(liens.length > 0, 'aucune carte vers un exercice');
  for (const l of liens) assert.ok(ids.includes(l), 'carte vers un exercice retiré : ' + l);
});

test('le renvoi au manuel montre la page en vignette cliquable', () => {
  // La vignette remplace le bouton « Voir la page » : l'opérateur voit où il va.
  assert.match(html, /<button class="fm-vignette" id="ficheManuelBtn" type="button">/);
  assert.match(html, /<img id="ficheManuelImg"/);
  assert.ok(!/id="ficheManuelBtn"[^>]*>Voir la page</.test(html), 'le bouton texte ne doit plus exister');
  // Un repli reste prévu si l'image de la page manque.
  assert.match(html, /class="fm-repli">Voir la page</);
  assert.match(html, /ficheManuelImg\.onerror[\s\S]{0,80}sans-image/);

  // Chaque page citée par une fiche doit avoir son image dans le dépôt,
  // sinon la vignette tombe en repli sans que personne ne le voie.
  const pages = [...html.matchAll(/"manuel"\s*:\s*\{[^}]*?"page"\s*:\s*(\d+)/g)].map(m => m[1]);
  assert.ok(pages.length >= 5, 'trop peu de renvois au manuel : ' + pages.length);
  for (const n of new Set(pages)) {
    const f = path.join(__dirname, '..', '3d', 'assets', 'manuel', 'p' + n + '.jpg');
    assert.ok(fs.existsSync(f), 'page ' + n + ' citée par une fiche mais absente de 3d/assets/manuel/');
  }
});

test("l'ouverture du coffret est annoncée, et le renvoi au manuel est une vignette", () => {
  const src = fs.readFileSync(path.join(__dirname, '..', '3d', 'js', 'training-ui.js'), 'utf8');
  // Le bloc du coffret ne dépend plus de l'exercice choisi : la porte s'ouvre
  // dans tous les exercices, rien ne le disait à l'opérateur.
  assert.match(src, /simPanelAccess'\)\.hidden\s*=\s*!\(viewer\.availableAccessKeys/);
  assert.ok(!/simPanelAccess'\)\.hidden\s*=\s*exercise\.id/.test(src), "le bloc ne doit plus être réservé à un exercice");
  assert.match(src, /sim-panel-titre/, 'un titre annonce que le coffret s’ouvre');
  // Le renvoi au manuel montre la page au lieu de la nommer.
  assert.match(src, /function vignetteManuel\(/);
  assert.ok(!/action\('Manuel · p\./.test(src), 'plus de bouton texte pour le manuel');
  assert.match(src, /const pageManuel = manualSrc \|\|/, 'un repli garde le module utilisable seul');
  // La page hôte fournit le chemin des images du manuel.
  const html = fs.readFileSync(path.join(__dirname, '..', '3d', 'index.html'), 'utf8');
  assert.match(html, /manualSrc:\s*\(page\)\s*=>/);
});
