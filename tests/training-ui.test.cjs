const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

// DOM event-wiring tests with the real simulation state. This does not test GPU rendering.
const uiSource = fs.readFileSync(path.join(__dirname, '../3d/js/training-ui.js'), 'utf8')
  .replace(/^import .*simulation-state\.js';\r?\n/m, '').replaceAll('export ', '');
const stateSource = fs.readFileSync(path.join(__dirname, '../3d/js/simulation-state.js'), 'utf8').replaceAll('export ', '');
const event = (type, values = {}) => Object.assign(new Event(type, { cancelable: true }), values);

function harness() {
  const elements = [], callbacks = new Map(), viewerEvents = new Map();
  let now = 0, sequence = 0, focused = null;
  class Element extends EventTarget {
    constructor() { super(); this.children = []; this.dataset = {}; this.style = {}; this.hidden = false; this.open=false;this.isConnected=true; this.attributes = new Map(); this.classes = new Set(); elements.push(this); this.classList = { add: name => this.classes.add(name), remove: name => this.classes.delete(name), toggle: (name, active) => active ? this.classes.add(name) : this.classes.delete(name) }; }
    set innerHTML(html) {
      this.children = [];
      for (const match of html.matchAll(/<([a-z][\w-]*)\b([^>]*)>/g)) {
        const element = new Element();
        for (const attribute of match[2].matchAll(/([\w-]+)="([^"]*)"/g)) {
          const [, key, value] = attribute;
          if (key === 'id') element.id = value;
          else if (key.startsWith('data-')) element.dataset[key.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
          else element[key] = value;
        }
        this.children.push(element);
      }
    }
    querySelector(selector) { return elements.find(element => element.id === selector.slice(1)) || null; }
    querySelectorAll(selector) {
      const key = /^\[data-([\w-]+)\]$/.exec(selector)?.[1]?.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      return key ? elements.filter(element => key in element.dataset) : [];
    }
    append(...nodes) { this.children.push(...nodes); }
    replaceChildren(...nodes) { this.children = nodes; }
    setAttribute(key, value) { this.attributes.set(key, value); }
    setPointerCapture() {}
    showModal() {this.open=true;}
    close() {this.open=false;this.dispatchEvent(event('close'));}
    focus() { if (focused && focused !== this) focused.dispatchEvent(event('blur')); focused = this; }
  }
  const document = new EventTarget(), window = new EventTarget(), container = new Element();
  document.hidden = false; document.createElement = () => new Element();
  Object.defineProperty(document,'activeElement',{get:()=>focused});
  const poseCalls = [], controlCalls = [], buttonCalls = [], accessCalls=[], hotspotCalls=[];
  const accessPose={panel:0,source:0}, flyCalls=[];
  const viewer = {
    on: (name, callback) => viewerEvents.set(name, callback),
    setPose: pose => poseCalls.push({ ...pose }), setControlPose: pose => controlCalls.push({ ...pose }),
    availableControlKeys:['front01','front02','front03','front04','front05','front06','front07','side01','side02','side03','side04','side05','js1x','js1y','js2','js3x','js3y'],
    availableButtonKeys:['u1','u2','u3','u4','grip','rearm','start','mode_direct','mode_standby'],
    setButtonPose:pose=>buttonCalls.push({...pose}),
    availableAccessKeys:['panel','source'],setAccessPose:pose=>{Object.assign(accessPose,pose);accessCalls.push({...accessPose});},
    resetPose() {}, setAutoRotate() {}, setHotspots:points=>hotspotCalls.push(Array.from(points,h=>h.id)), setHotspotsVisible() {},
    home: () => Promise.resolve(true), flyTo: view => {flyCalls.push({...view});return Promise.resolve(true);}
  };
  const context = vm.createContext({ document, window, console, performance: { now: () => now },
    requestAnimationFrame: callback => { callbacks.set(++sequence, callback); return sequence; },
    cancelAnimationFrame: id => callbacks.delete(id)
  });
  vm.runInContext(stateSource + '\n' + uiSource + '\nglobalThis.mount = mountTraining;', context);
  const controls = ['js1', 'js2', 'js3', 'grip-enable', 'horn', 'source-selector', 'rearm', 'front-levers', 'side-levers','panel-door','receiver','ppu','panel-terminals','rear-hmi'].map(id => ({ id, label: id, view: {id} }));
  const emergencies = ['u1', 'u2', 'u3', 'u4'].map(id => ({ id, label: 'Arrêt d\'urgence : ' + id, view: {} }));
  const manualCalls=[];
  const training = context.mount({ container, viewer, controls, emergencies, onActivate() {}, onDeactivate() {}, onManual(page) {manualCalls.push({page,dialogOpen:container.querySelector('#simSelected').open,focus:document.activeElement});} });
  const byId = id => container.querySelector('#' + id);
  const byData = (key, value) => elements.find(element => element.dataset[key] === value);
  const click = element => element.dispatchEvent(event('click'));
  const press = name => byData('hold', name).dispatchEvent(event('pointerdown', { pointerId: 1 }));
  const release = name => byData('hold', name).dispatchEvent(event('pointerup', { pointerId: 1 }));
  const step = (count = 1) => { for (let i = 0; i < count; i++) { now += 50; const frames = [...callbacks.values()]; callbacks.clear(); frames.forEach(callback => callback(now)); } };
  const ready = exercise => {
    training.activate(exercise); byId('simClear').checked = true; byId('simClear').dispatchEvent(event('change'));
    click(byData('source', 'REMOTE')); click(byId('simRearm')); click(byData('mode', 'DIRECT')); step();
  };
  return { training, byId, byData, click, press, release, step, ready, viewerEvents, window, document, poseCalls, controlCalls, buttonCalls,accessCalls,hotspotCalls,flyCalls,manualCalls };
}

test('manual commands replacing the demo release its held arm command first', () => {
  const h = harness(); h.ready('stop'); h.click(h.byId('simDemoStart')); h.step(20);
  assert.equal(h.training.getState().held.js1_up, true);
  h.press('js3_up'); h.step(2); h.release('js3_up');
  assert.deepEqual(JSON.parse(JSON.stringify(h.training.getState().held)), {});
  const arm = h.training.getState().pose.arm; h.step(20);
  assert.equal(h.training.getState().pose.arm, arm, 'no former demo input survives manual release');
  h.training.deactivate();
});

test('pointer cancellation, focus loss and viewer invisibility release held movement', () => {
  for (const interrupt of [
    h => h.byData('hold', 'js1_up').dispatchEvent(event('pointercancel')),
    h => h.byData('hold', 'js1_up').dispatchEvent(event('blur')),
    h => h.viewerEvents.get('visibility')(false),
    h => h.window.dispatchEvent(event('blur'))
  ]) {
    const h = harness(); h.ready('direct'); h.press('js1_up'); h.step(3); interrupt(h);
    const arm = h.training.getState().pose.arm; h.step(10);
    assert.equal(h.training.getState().pose.arm, arm);
    assert.deepEqual(JSON.parse(JSON.stringify(h.training.getState().held)), {});
    h.training.deactivate();
  }
});

test('simulation callbacks address the public joystick keys and update the opening timer', () => {
  const h = harness(); h.ready('grip'); h.press('grip_enable,js2_up'); h.step(10);
  assert.equal(h.controlCalls.at(-1).js2, 1);
  assert(h.byId('simGripDelay').value > .3 && h.byId('simGripDelay').value < 1);
  h.release('grip_enable,js2_up');
  assert.equal(h.controlCalls.at(-1).js2, 0); assert.equal(h.byId('simGripDelay').value, 0);
  h.training.deactivate();
});

test('selecting a physical stop interrupts the demo without automatic restart after unlocking', () => {
  const h = harness(); h.ready('stop'); h.click(h.byId('simDemoStart')); h.step(10);
  h.training.select('u3'); const state = h.training.getState();
  assert.equal(state.estops.u3, true); assert.equal(state.armed, false);
  const arm = state.pose.arm;
  h.click(h.byId('simInfoClose'));
  h.click(h.byId('simRelease-u3')); h.click(h.byId('simRearm')); h.step(20);
  assert.equal(h.training.getState().pose.arm, arm);
  assert.deepEqual(JSON.parse(JSON.stringify(h.training.getState().held)), {});
  h.training.deactivate();
});

test('physical button feedback keeps a stop depressed across blur and releases spring buttons', () => {
  const h=harness();h.ready('stop');h.click(h.byId('simDemoStart'));h.step(2);h.training.select('u1');
  assert.equal(h.buttonCalls.at(-1).u1,1);
  h.click(h.byId('simInfoClose'));
  h.window.dispatchEvent(event('blur'));assert.equal(h.buttonCalls.at(-1).u1,1);
  h.click(h.byId('simRelease-u1'));assert.equal(h.buttonCalls.at(-1).u1,0);
  h.click(h.byId('simRearm'));assert.equal(h.buttonCalls.at(-1).rearm,1);h.step(6);assert.equal(h.buttonCalls.at(-1).rearm,0);
  h.press('grip_enable');assert.equal(h.buttonCalls.at(-1).grip,1);h.release('grip_enable');assert.equal(h.buttonCalls.at(-1).grip,0);
  h.training.deactivate();
});

test('LOCAL and VEILLE move physical controls without enabling hydraulic motion', () => {
  for(const source of ['LOCAL','REMOTE']) {
    const h=harness();h.training.activate('free');
    if(source==='REMOTE'){
      h.click(h.byData('source','REMOTE'));
      h.byId('simClear').checked=true;h.byId('simClear').dispatchEvent(event('change'));
      h.click(h.byId('simRearm'));
    }
    h.press('js1_up');h.step(10);
    assert.equal(h.controlCalls.at(-1).js1y,1);
    assert.equal(h.training.getState().pose.arm,0);
    assert.deepEqual(JSON.parse(JSON.stringify(h.training.getState().held)),{});
    assert.equal(h.training.getState().feedback.code,source==='LOCAL'?'LOCAL_RADIO_IGNORED':'STANDBY_NO_MOTION');
    h.release('js1_up');assert.equal(h.controlCalls.at(-1).js1y,0);
    h.press('grip_enable,js2_up');h.step(25);
    assert.equal(h.controlCalls.at(-1).js2,1);assert.equal(h.buttonCalls.at(-1).grip,1);
    assert.equal(h.training.getState().pose.grip,0);
    assert.equal(h.training.getState().gripHoldSeconds,0);
    h.release('grip_enable,js2_up');
    assert.equal(h.controlCalls.at(-1).js2,0);assert.equal(h.buttonCalls.at(-1).grip,0);
    h.training.deactivate();
  }
});

test('focus loss and safety transitions clear denied physical inputs without restarting them', () => {
  for(const stop of [
    h=>h.window.dispatchEvent(event('blur')),
    h=>h.viewerEvents.get('visibility')(false),
    h=>h.click(h.byId('simRearm')),
    h=>h.click(h.byData('source','REMOTE'))
  ]) {
    const h=harness();h.training.activate('free');h.press('grip_enable,js2_up');
    assert.equal(h.buttonCalls.at(-1).grip,1);stop(h);h.step(3);
    assert.equal(h.controlCalls.at(-1).js2,0);assert.equal(h.buttonCalls.at(-1).grip,0);
    assert.equal(h.training.getState().pose.grip,0);
    h.training.deactivate();
  }
});

test('cabinet opens independently and only reveals internal hotspots after the door clears them', () => {
  const h=harness();h.training.activate('panel');
  assert.deepEqual(h.hotspotCalls.at(-1),['panel-door']);
  h.click(h.byId('simPanelToggle'));h.step(7);
  assert(h.accessCalls.at(-1).panel>0&&h.accessCalls.at(-1).panel<.85);
  assert.deepEqual(h.hotspotCalls.at(-1),['panel-door']);
  h.step(30);assert.equal(h.accessCalls.at(-1).panel,1);
  assert.deepEqual(h.hotspotCalls.at(-1),['panel-door','receiver','ppu','panel-terminals','rear-hmi']);
  assert.equal(h.training.getState().armed,false);assert.equal(h.training.getState().pose.arm,0);
  h.click(h.byId('simPanelToggle'));h.step(30);assert.equal(h.accessCalls.at(-1).panel,0);
  assert.deepEqual(h.hotspotCalls.at(-1),['panel-door']);h.training.deactivate();
});

test('leaving the viewer pauses a moving cabinet door', () => {
  const h=harness();h.training.activate('panel');h.click(h.byId('simPanelToggle'));h.step(7);
  const opening=h.accessCalls.at(-1).panel;
  h.viewerEvents.get('visibility')(false);h.step(30);
  assert.equal(h.accessCalls.at(-1).panel,opening);
  assert.equal(h.byId('simPanelState').textContent,'Porte en pause');
  assert.equal(h.byId('simPanelToggle').textContent,'Ouvrir le coffret');
  h.training.deactivate();
});

test('the physical selector follows LOCAL and REMOTE without opening the door', () => {
  const h=harness();h.training.activate('source');assert.equal(h.accessCalls.at(-1).source,0);
  h.click(h.byData('source','REMOTE'));assert.equal(h.accessCalls.at(-1).source,1);
  assert.equal(h.accessCalls.at(-1).panel,0);assert.equal(h.training.getState().armed,false);
  h.click(h.byData('source','LOCAL'));assert.equal(h.accessCalls.at(-1).source,0);h.training.deactivate();
});

test('an internal reference opens the cabinet before flying to its interior component', () => {
  const h=harness();h.training.activate('panel');
  const before=h.flyCalls.length;
  h.click(h.byData('target','receiver'));h.step(5);
  assert.equal(h.flyCalls.length,before,'no camera visit through the still-closed door');
  h.step(30);
  assert.equal(h.accessCalls.at(-1).panel,1);
  assert.equal(h.flyCalls.at(-1).id,'receiver');
  assert.equal(h.byId('simSelectedTitle').textContent,'Récepteur radio');
  h.training.deactivate();
});

test('interrupting an interior visit pauses the door and cancels its pending camera movement', () => {
  const h=harness();h.training.activate('panel');
  h.click(h.byData('target','ppu'));h.step(5);
  const count=h.flyCalls.length,opening=h.accessCalls.at(-1).panel;
  h.viewerEvents.get('visibility')(false);h.step(30);
  assert.equal(h.accessCalls.at(-1).panel,opening);assert.equal(h.flyCalls.length,count);
  h.viewerEvents.get('visibility')(true);h.click(h.byId('simPanelToggle'));h.step(30);
  assert.equal(h.accessCalls.at(-1).panel,1);
  assert.equal(h.flyCalls.length,count+1,'explicitly reopening frames the door once');
  assert.equal(h.flyCalls.at(-1).id,'panel-door','the cancelled interior visit never resumes');
  h.training.deactivate();
});

test('information opens only on an explicit selection and returns focus when closed', () => {
  const h=harness();h.training.activate('radio-points');
  const dialog=h.byId('simSelected');assert.equal(dialog.open,false);
  h.training.select('js1',false,{popup:false});assert.equal(dialog.open,false);
  const trigger=h.byData('target','js1');h.click(trigger);
  assert.equal(dialog.open,true);assert.equal(h.document.activeElement,h.byId('simInfoClose'));
  assert.equal(h.byId('simSelectedTitle').textContent,'JS1 · Manette gauche');
  h.click(h.byId('simInfoClose'));assert.equal(dialog.open,false);assert.equal(h.document.activeElement,trigger);
  h.click(h.byId('simHint'));assert.equal(dialog.open,true,'the explicit hint can show information');
  dialog.dispatchEvent(event('cancel'));assert.equal(dialog.open,false);
  assert.equal(h.document.activeElement,h.byId('simHint'));
  h.training.deactivate();
});

test('opening information releases held movement and closing never resumes it', () => {
  const h=harness();h.ready('direct');h.press('js1_up');h.step(5);
  h.click(h.byData('focus','js1'));
  assert.equal(h.byId('simSelected').open,true);
  assert.deepEqual(JSON.parse(JSON.stringify(h.training.getState().held)),{});
  assert.equal(h.controlCalls.at(-1).js1y,0);
  const arm=h.training.getState().pose.arm;h.step(15);h.training.closeInfo();h.step(15);
  assert.equal(h.training.getState().pose.arm,arm);
  h.training.deactivate();
});

test('the popup closes before cabinet motion and explicit opening frames the door after layout', () => {
  const h=harness();h.training.activate('panel');
  assert.equal(h.flyCalls.length,0,'initial framing waits for the panel layout');h.step(2);
  assert.equal(h.flyCalls.at(-1).id,'panel-door');
  h.training.select('panel-door');assert.equal(h.byId('simSelected').open,true);
  h.click(h.byId('simSelectedActions').children[0]);
  assert.equal(h.byId('simSelected').open,false);
  h.step(3);assert.equal(h.flyCalls.at(-1).id,'panel-door');
  assert(h.accessCalls.at(-1).panel>0);
  h.training.deactivate();
});

test('a manual action closes the popup and restores its trigger before opening the photo', () => {
  const h=harness();h.training.activate('radio-points');
  const trigger=h.byData('target','js1');h.click(trigger);
  h.click(h.byId('simSelectedActions').children.at(-1));
  assert.equal(h.manualCalls.length,1);assert.equal(h.manualCalls[0].page,22);
  assert.equal(h.manualCalls[0].dialogOpen,false);assert.equal(h.manualCalls[0].focus,trigger);
  h.training.deactivate();
});

test('manual lever manipulation remains outside the popup so the model stays visible', () => {
  const h=harness();h.training.activate('manual-levers');h.click(h.byData('target','front-levers'));
  assert.equal(h.byId('simSelectedActions').children.length,2,'short popup has practice and manual actions');
  h.click(h.byId('simSelectedActions').children[0]);
  assert.equal(h.byId('simSelected').open,false);assert.equal(h.byId('simLeverPractice').hidden,false);
  const rows=h.byId('simLeverControls').children;assert.equal(rows.length,7);
  const plus=rows[0].children[2];plus.dispatchEvent(event('pointerdown',{pointerId:1}));
  assert.equal(h.controlCalls.at(-1).front01,1);
  plus.dispatchEvent(event('pointerup',{pointerId:1}));assert.equal(h.controlCalls.at(-1).front01,0);
  h.training.deactivate();
});
