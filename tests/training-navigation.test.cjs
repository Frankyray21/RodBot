const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Execute the page's actual event wiring. Native inert/focus and GPU behaviour
// are checked separately in the browser; these tests protect transition order.
const html = fs.readFileSync(path.join(__dirname, '../3d/index.html'), 'utf8');

test('a component card leaves the exercise before opening its component view', () => {
  const start = html.indexOf("      document.querySelectorAll('.eq-3d').forEach");
  const end = html.indexOf("      const { mountTraining }", start);
  assert(start >= 0 && end > start);
  for (const target of ['bras', 'home']) {
    const calls = [];
    let click;
    const card = { dataset: { cible: target }, addEventListener: (_, handler) => { click = handler; } };
    const training = { active: true };
    vm.runInNewContext(html.slice(start, end), {
      document: { querySelectorAll: () => [card], getElementById: () => ({ scrollIntoView() {} }) },
      training,
      reglerMode(mode) { calls.push('mode:' + mode); training.active = false; },
      arreterVisite: () => calls.push('stop-tour'), reglerRotation() {},
      hotspotById: id => id === 'bras', FLY: 900,
      ouvrirFiche: id => calls.push('fiche:' + id), v: { home: () => calls.push('home') }
    });
    click();
    assert.equal(training.active, false);
    assert.equal(calls[0], 'mode:composants');
    assert.equal(calls.at(-1), target === 'home' ? 'home' : 'fiche:bras');
  }
});

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
