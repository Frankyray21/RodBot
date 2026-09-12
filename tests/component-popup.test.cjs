const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

// Real page controller and event wiring; native top-layer layout is checked in the browser.
const html = fs.readFileSync(path.join(__dirname, '../3d/index.html'), 'utf8');
const controller = html.slice(html.indexOf('    function createComponentPopup('), html.indexOf('    /* End component popup controller. */'));
assert(controller.includes('function createComponentPopup('));
const event = (type, values = {}) => Object.assign(new Event(type, { cancelable: true }), values);

function harness() {
  const document = {}, queuedCloses = [], calls = [];
  class Element extends EventTarget {
    constructor(name) {
      super(); this.name = name; this.children = []; this.parentNode = null; this.isConnected = true;
      this.hidden = false; this.open = false; this.style = {}; this.classes = new Set();
      this.classList = { add: key => this.classes.add(key), remove: key => this.classes.delete(key) };
    }
    remove() { if (this.parentNode) this.parentNode.children.splice(this.parentNode.children.indexOf(this), 1); }
    append(node) { node.remove(); node.parentNode = this; this.children.push(node); }
    before(node) { node.remove(); node.parentNode = this.parentNode; this.parentNode.children.splice(this.parentNode.children.indexOf(this), 0, node); }
    after(node) { node.remove(); node.parentNode = this.parentNode; this.parentNode.children.splice(this.parentNode.children.indexOf(this) + 1, 0, node); }
    focus() { document.activeElement = this; calls.push('focus:' + this.name); }
    showModal() { this.open = true; calls.push('show-modal'); }
    close() { this.open = false; queuedCloses.push(() => this.dispatchEvent(event('close'))); }
    getBoundingClientRect() { return { left: 100, top: 100, right: 500, bottom: 500 }; }
  }
  const body = new Element('body'), dialog = new Element('dialog'), closeButton = new Element('close');
  const launcher = new Element('launcher'), hotspot = new Element('hotspot'), next = new Element('next');
  const tourPlayer = new Element('tour-player'), tourSlot = new Element('tour-slot'), tourButton = new Element('tour-button');
  body.append(launcher); body.append(tourPlayer); body.append(dialog);
  dialog.append(closeButton); dialog.append(next); dialog.append(tourSlot); tourPlayer.append(tourButton);
  body.style.overflow = 'auto';
  document.body = body; document.activeElement = launcher;
  document.createComment = () => new Element('tour-home');
  const context = vm.createContext({ document });
  vm.runInContext(controller, context);
  const popup = context.createComponentPopup({
    dialog, closeButton, tourPlayer, tourSlot, fallbackFocus: () => hotspot,
    onDismiss: () => calls.push('dismiss'), onClosed: () => calls.push('closed')
  });
  const click = node => node.dispatchEvent(event('click'));
  const flushClose = () => { for (const close of queuedCloses.splice(0)) close(); };
  return { document, body, dialog, closeButton, launcher, hotspot, next, tourPlayer, tourSlot, tourButton, popup, calls, click, flushClose };
}

test('opening is modal and keyboard close returns to the original launcher', () => {
  const h = harness(); h.popup.open();
  assert.equal(h.dialog.open, true);
  assert.equal(h.document.activeElement, h.closeButton);
  assert.equal(h.body.style.overflow, 'hidden');
  const cancel = event('cancel'); h.dialog.dispatchEvent(cancel);
  assert.equal(cancel.defaultPrevented, true);
  assert.equal(h.dialog.open, false);
  assert.equal(h.document.activeElement, h.launcher);
  assert.equal(h.body.style.overflow, 'auto');
  h.flushClose();
  assert.equal(h.calls.filter(call => call === 'closed').length, 1, 'queued native close does not restore focus twice');
});

test('changing components preserves focus and the initial return target', () => {
  const h = harness(); h.popup.open(); h.next.focus(); h.popup.open();
  assert.equal(h.document.activeElement, h.next, 'component changes must not interrupt keyboard navigation');
  assert.equal(h.calls.filter(call => call === 'show-modal').length, 1);
  h.click(h.closeButton);
  assert.equal(h.document.activeElement, h.launcher);
});

test('backdrop dismisses only when the pointer starts and ends outside the panel', () => {
  const h = harness(); h.popup.open();
  const down = (x, y) => h.dialog.dispatchEvent(event('pointerdown', { clientX: x, clientY: y }));
  const click = (x, y) => h.dialog.dispatchEvent(event('click', { clientX: x, clientY: y }));
  down(120, 120); click(120, 120); assert.equal(h.dialog.open, true, 'dialog padding is inside');
  down(120, 120); click(50, 50); assert.equal(h.dialog.open, true, 'dragging outside does not dismiss');
  down(50, 50); h.dialog.dispatchEvent(event('pointercancel')); click(50, 50); assert.equal(h.dialog.open, true);
  down(50, 50); click(50, 50); assert.equal(h.dialog.open, false);
  assert.equal(h.calls.filter(call => call === 'dismiss').length, 1);
});

test('the active guided tour keeps its original controls inside the modal', () => {
  const h = harness(); h.tourButton.focus(); h.popup.setTourActive(true); h.popup.open();
  assert.equal(h.tourPlayer.parentNode, h.tourSlot);
  assert.equal(h.tourPlayer.hidden, false);
  h.popup.setTourActive(false); assert.equal(h.tourPlayer.hidden, true, 'an idle tour is not duplicated in the component sheet');
  h.popup.setTourActive(true); assert.equal(h.tourPlayer.hidden, false);
  h.popup.close();
  assert.equal(h.tourPlayer.parentNode, h.body);
  assert.equal(h.tourPlayer.hidden, false);
  assert.equal(h.document.activeElement, h.tourButton, 'the restored tour control receives focus outside the closed dialog');
});

test('photo handoff closes synchronously and its later close event cannot steal focus', () => {
  const h = harness(); h.popup.open(); h.popup.close();
  assert.equal(h.dialog.open, false);
  const photoClose = { focus() { h.document.activeElement = this; } };
  photoClose.focus(); h.flushClose();
  assert.equal(h.document.activeElement, photoClose);
  h.popup.open(); h.popup.close(); h.popup.open(); h.flushClose();
  assert.equal(h.dialog.open, true, 'a rapid reopen survives an older queued close event');
  assert.equal(h.document.activeElement, h.closeButton);
});

test('a disconnected launcher has an available component fallback', () => {
  const h = harness(); h.popup.open(); h.launcher.isConnected = false; h.popup.close();
  assert.equal(h.document.activeElement, h.hotspot);
});

test('previous and next preserve a running tour and otherwise browse components', () => {
  const start = html.indexOf("      document.getElementById('fichePrev').addEventListener");
  const end = html.indexOf("      fichePhoto.addEventListener", start);
  assert(start >= 0 && end > start);
  const handlers = {}, calls = [];
  let status = 'playing';
  vm.runInNewContext(html.slice(start, end), {
    document: { getElementById: id => ({ addEventListener: (_, callback) => { handlers[id] = callback; } }) },
    tour: { getState: () => ({ status }), previous: () => calls.push('tour-previous'), next: () => calls.push('tour-next') },
    voisin: step => calls.push(step)
  });
  handlers.fichePrev(); handlers.ficheNext(); status = 'idle'; handlers.fichePrev(); handlers.ficheNext();
  assert.deepEqual(calls, ['tour-previous', 'tour-next', -1, 1]);
});

test('component entry preserves explicit photo, manual, cabinet and accessible dialog controls', () => {
  assert.match(html, /<dialog[^>]+id="fiche"[^>]+aria-labelledby="ficheTitle"[^>]+aria-describedby="ficheDesc"/);
  assert.match(html, /component-popup\.css\?v=1\.70\.0/);
  assert(!html.includes('PHOTOS[id].autoOuvrir'), 'photo data must not automatically cover a newly opened component');
  assert.match(html, /fichePhoto\.addEventListener\('click', \(\) => \{ if \(courant\) ouvrirPhoto\(PHOTOS\[courant\]\); \}\)/);
  assert.match(html, /ficheManuelBtn\.onclick = \(\) =>/);
  assert.match(html, /training\.activate\('panel'\)/);
  const pause = /photoPause = \(\) => \{([^]*?)\};/.exec(html);
  const calls = [];
  vm.runInNewContext('(function(){' + pause[1] + '})();', {
    pauserVisite: () => calls.push('pause'), fermerFiche: () => calls.push('component-close'),
    training: { releaseAll: () => calls.push('neutral'), closeInfo: () => calls.push('training-close') }
  });
  assert.deepEqual(calls, ['pause', 'neutral', 'component-close', 'training-close']);
});
