const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

// Exercise the adapter against its public browser/model-viewer contract.
const path = join(__dirname, '..', '3d', 'js', 'viewer-v5.js');
const source = readFileSync(path, 'utf8')
  .replace(/^import .*from '\.\/motion\.js';\n/m, '')
  .replace(/^import .*from '\.\/model-assets\.js';\n/m, "const MODEL_URL = 'https://example.github.io/RodBot/3d/assets/rodbot-training-v6.glb';\n")
  .replaceAll('export default RodbotViewer;', '')
  .replaceAll('export ', '')
  .replaceAll('import.meta.url', "'https://example.github.io/RodBot/3d/js/viewer-v5.js'")
  .replace("import('../vendor/model-viewer-4.3.1.min.js')", 'Promise.resolve(mockModule)');
const motion = readFileSync(join(__dirname, '..', '3d', 'js', 'motion.js'), 'utf8').replaceAll('export ', '');
const event = (type, detail) => { const e = new Event(type); e.detail = detail; return e; };

class Element extends EventTarget {
  constructor(name = 'span') {
    super(); this.localName = name; this.children = []; this.dataset = {}; this.style = {}; this.attributes = new Map();
    this.classes = new Set(); this.classList = { toggle: (name, on) => on ? this.classes.add(name) : this.classes.delete(name) };
  }
  append(...elements) { for (const el of elements) { this.children.push(el); el.parentElement = this; } }
  remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(el => el !== this); }
  setAttribute(name, value) { this.attributes.set(name, value); }
  removeAttribute(name) { this.attributes.delete(name); }
  getBoundingClientRect() { return { width: 1200, height: 800, left: 0, top: 0 }; }
}
class Model extends Element {
  constructor() {
    super('model-viewer'); this.appended = []; this.updated = []; this.requests = []; this.paused = true;
    this.availableAnimations = ['Presentation_360', 'Rotation_tourelle', 'Elevation_bras', 'Inclinaison_pince', 'Rotation_pince', 'Ouverture_pince', 'Stabilisateurs'];
    this.orbit = { theta: -.5, phi: 1, radius: 6.5 }; this.target = { x: 0, y: 1.25, z: 0 }; this.currentTime = 0;
  }
  set src(value) { this.requests.push(value); queueMicrotask(() => { this.loaded = true; this.dispatchEvent(event('load')); }); }
  getCameraOrbit() { return { ...this.orbit }; }
  getCameraTarget() { return { ...this.target }; }
  jumpCameraToGoal() {
    const values = this.cameraOrbit?.split(' ').map(parseFloat);
    if (values?.every(Number.isFinite)) this.orbit = { theta: values[0] * Math.PI / 180, phi: values[1] * Math.PI / 180, radius: values[2] };
    const target = this.cameraTarget?.split(' ').map(parseFloat);
    if (target?.every(Number.isFinite)) this.target = { x: target[0], y: target[1], z: target[2] };
  }
  appendAnimation(name, options) { this.appended.push({ name, ...options }); this.paused = false; }
  pause() { this.paused = true; }
  updateHotspot(config) { this.updated.push(config); }
  queryHotspot(name) { return this.children.some(el => el.slot === name) ? { canvasPosition: { x: 200, y: 150, z: .5 }, facingCamera: true } : null; }
}
async function harness(t, { controls = false, buttons = false, access = false, sourceSelector = false } = {}) {
  const model = new Model(), overlay = new Element('div'), document = new Element('document'), media = new Element('media');
  if (controls) model.availableAnimations.push(
    ...Array.from({ length: 7 }, (_, index) => 'SIM_front' + String(index + 1).padStart(2, '0')),
    ...Array.from({ length: 5 }, (_, index) => 'SIM_side' + String(index + 1).padStart(2, '0')),
    'SIM_js1x', 'SIM_js1y', 'SIM_js2', 'SIM_js3x', 'SIM_js3y'
  );
  document.hidden = false; document.createElement = name => new Element(name); media.matches = false;
  if (buttons) model.availableAnimations.push(...['u1','u2','u3','u4','grip','rearm','start','mode_linear','mode_direct','mode_standby'].map(key=>'SIM_press_'+key));
  if (access) model.availableAnimations.push('Ouvrir_panneau');
  if (sourceSelector) model.availableAnimations.push('Selection_commande');
  let now = 0, next = 0; const frames = new Map();
  const module = { ModelViewerElement: {} };
  const context = vm.createContext({
    document, model, overlay, mockModule: module, URL, URLSearchParams, Event, console,
    location: { search: '' }, screen: { width: 1200, height: 800 }, navigator: {},
    matchMedia: () => media, performance: { now: () => now },
    requestAnimationFrame: fn => { frames.set(++next, fn); return next; }, cancelAnimationFrame: id => frames.delete(id),
    ResizeObserver: class { observe() {} disconnect() {} }, IntersectionObserver: class { observe() {} disconnect() {} }
  });
  vm.runInContext(motion + '\n' + source + '\nglobalThis.adapter = RodbotViewer;', context);
  const viewer = await context.adapter.create({ canvas: model, overlay });
  await viewer.ready;
  const step = async (ms = 16) => { now += ms; const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(fn => fn(now)); await Promise.resolve(); };
  const settle = async () => { for (let i = 0; i < 20; i++) await step(); };
  await settle();
  t.after(() => viewer.destroy());
  return { viewer, model, overlay, document, media, module, step, settle };
}

test('V5 uses local assets and evaluates the six validated initial poses', async t => {
  const { viewer, model, module } = await harness(t);
  assert.equal(module.ModelViewerElement.dracoDecoderLocation, 'https://example.github.io/RodBot/3d/vendor/draco/');
  assert.equal(model.requests[0], 'https://example.github.io/RodBot/3d/assets/rodbot-training-v6.glb');
  assert.equal(viewer.canArticulate, true);
  assert.deepEqual(model.appended.slice(-6).map(a => a.time), [.5, 1, .65, .5, 0, 1]);
  assert(model.appended.every(a => a.timeScale === 0 && a.weight === 1 && a.fade === false && a.repetitions === '1'));
  assert.equal(model.autoRotate, false); assert.equal(model.paused, true);
});

test('camera visits resolve at arrival and interruptions resolve false', async t => {
  const { viewer, step, settle } = await harness(t);
  let arrived = false;
  const first = viewer.flyTo({ yaw: 40, pitch: 35, dist: 3, target: [1, 2, 3] }, 100).then(value => { arrived = value; return value; });
  await step(50); assert.equal(arrived, false);
  await step(50); assert.equal(arrived, false, 'sending the final goal is not arrival');
  await step(); assert.equal(await first, true);
  assert.equal(Math.round(viewer.getView().yaw), 40);
  const interrupted = viewer.flyTo({ yaw: -60 }, 1000);
  const replacement = viewer.flyTo({ yaw: 60 }, 0);
  assert.equal(await interrupted, false);
  await settle(); assert.equal(await replacement, true);
  const cancelled = viewer.flyTo({ yaw: -40 }, 1000); viewer.cancelFlight();
  assert.equal(await cancelled, false);
});

test('camera rotation and quality preserve independent poses and never play the root clip', async t => {
  const { viewer, model, settle } = await harness(t);
  viewer.setPose({ arm: 12, grip: 75, turret: 100, wrist: NaN });
  await settle(); const before = JSON.stringify(viewer.getPose()); const yaw = viewer.getView().yaw;
  viewer.setAutoRotate(true); await settle(); viewer.setAutoRotate(false);
  assert(viewer.getView().yaw > yaw);
  assert.equal(model.currentTime, 0); assert.equal(model.autoRotate, false);
  await viewer.setQuality('mobile'); assert.equal(model.shadowIntensity, 0);
  await viewer.setQuality('hq'); assert.equal(model.shadowIntensity, 1);
  assert.equal(JSON.stringify(viewer.getPose()), before); assert.equal(model.requests.length, 1);
  assert.equal(viewer.getPose().turret, 35); assert.equal(viewer.getPose().wrist, 3);
  assert(model.appended.every(animation => animation.name !== 'Presentation_360'));
  viewer.resetPose(); await settle();
  assert.deepEqual(JSON.parse(JSON.stringify(viewer.getPose())), { turret: 0, arm: 0, wrist: 3, tool: 0, grip: 0, jacks: 100 });
});

test('visibility cancels a flight, freezes joints and reapplies stored poses on return', async t => {
  const { viewer, model, document, settle } = await harness(t);
  const seen = []; viewer.on('visibility', value => seen.push(value));
  const pending = viewer.flyTo({ yaw: 60 }, 2000);
  document.hidden = true; document.dispatchEvent(event('visibilitychange'));
  assert.equal(await pending, false); assert.equal(model.paused, true);
  const count = model.appended.length;
  viewer.setPose({ arm: 7 }); assert.equal(model.appended.length, count);
  document.hidden = false; document.dispatchEvent(event('visibilitychange')); await settle();
  assert.deepEqual(seen, [false, true]); assert.equal(viewer.getPose().arm, 7);
  assert(model.appended.length > count); assert.equal(model.paused, true);
});

test('surface hotspots keep compatible overlay buttons and update without losing active state', async t => {
  const { viewer, model, overlay, settle } = await harness(t);
  viewer.setHotspots([{ id: 'pince', label: 'Grappin', num: 2, pos: [1, 2, 3], normal: [0, 1, 0], surface: '4 0 1 2 3 .2 .3 .5' }]);
  await settle(); const button = overlay.children[0];
  assert.equal(button.dataset.id, 'pince'); assert.equal(button.className, 'hs'); assert.equal(button.hidden, false);
  assert.equal(button.style.transform, 'translate(200.0px,150.0px)');
  assert.equal(model.children[0].slot, 'hotspot-pince');
  assert.equal(model.children[0].dataset.surface, '4 0 1 2 3 .2 .3 .5');
  button.classList.toggle('is-active', true);
  viewer.updateHotspots([{ id: 'pince', surface: '5 0 1 2 3 .1 .4 .5' }]); await settle();
  assert(button.classes.has('is-active')); assert.equal(model.updated.at(-1).surface, '5 0 1 2 3 .1 .4 .5');
  let selected; viewer.on('select', id => { selected = id; }); button.dispatchEvent(event('click'));
  assert.equal(selected, 'pince');
  viewer.setHotspotsVisible(false); await settle(); assert.equal(button.hidden, true);
  viewer.setHotspots([]); assert.equal(overlay.children.length, 0); assert.equal(model.children.length, 0);
});

test('destroy resolves pending camera work and disables future visits', async t => {
  const { viewer, model } = await harness(t);
  const pending = viewer.flyTo({ yaw: 90 }, 500);
  viewer.destroy(); assert.equal(await pending, false);
  assert.equal(await viewer.home(), false); assert.equal(model.paused, true);
});

test('optional lever and joystick clips are independent, bounded and released while hidden', async t => {
  const { viewer, model, document, settle } = await harness(t, { controls: true });
  assert.equal(viewer.availableControlKeys.length, 17);
  viewer.setPose({ arm: 9, grip: 60 });
  viewer.setControlPose({ front01: 9, side05: -2, js1x: .5, js3y: -.3, unknown: 1 });
  await settle();
  const clips = new Map(model.appended.slice(-23).map(clip => [clip.name, clip]));
  assert.equal(clips.get('SIM_front01').time, 1);
  assert.equal(clips.get('SIM_side05').time, 0);
  assert.equal(clips.get('SIM_js1x').time, .75);
  assert.equal(clips.get('SIM_js3y').time, .35);
  assert.equal(clips.get('SIM_js2').time, .5);
  assert([...clips.values()].every(clip => clip.repetitions === '1' && !('repetitionCount' in clip)));
  assert.equal(viewer.getPose().arm, 9); assert.equal(viewer.getPose().grip, 60);
  assert.equal(viewer.getControlPose().unknown, undefined);
  document.hidden = true; document.dispatchEvent(event('visibilitychange'));
  assert(Object.values(viewer.getControlPose()).every(value => value === 0));
  assert.equal(viewer.getPose().arm, 9, 'the equipment stays in its pose when controls spring back');
  document.hidden = false; document.dispatchEvent(event('visibilitychange')); await settle();
  assert(model.appended.slice(-17).every(clip => clip.name.startsWith('SIM_') && clip.time === .5));
});

test('button clips start released and remain latched independently of spring-return joysticks', async t => {
  const { viewer, model, document, settle } = await harness(t, { controls: true, buttons: true });
  assert.equal(viewer.availableButtonKeys.length, 10);
  assert(model.appended.filter(clip=>clip.name.startsWith('SIM_press_')).every(clip=>clip.time===0));
  viewer.setControlPose({js1y:1}); viewer.setButtonPose({u1:9,grip:1,rearm:-1}); await settle();
  const clips=new Map(model.appended.slice(-33).map(clip=>[clip.name,clip]));
  assert.equal(clips.get('SIM_press_u1').time,1); assert.equal(clips.get('SIM_press_grip').time,1);
  assert.equal(clips.get('SIM_press_rearm').time,0); assert.equal(clips.get('SIM_js1y').time,1);
  document.hidden=true; document.dispatchEvent(event('visibilitychange'));
  assert.equal(viewer.getControlPose().js1y,0); assert.equal(viewer.getButtonPose().u1,1);
  viewer.resetPose(); assert.equal(viewer.getButtonPose().u1,0);
});

test('the optional inspection door composes independently with joints, controls and buttons', async t => {
  const { viewer, model, settle } = await harness(t, { controls:true, buttons:true, access:true });
  assert.deepEqual(Array.from(viewer.availableAccessKeys), ['panel']);
  assert.equal(viewer.getAccessPose().panel, 0);
  const snapshots=[];viewer.on('accesspose',value=>snapshots.push(value));
  viewer.setPose({arm:9,grip:60});viewer.setControlPose({js1y:1});viewer.setButtonPose({u1:1});
  viewer.setAccessPose({panel:.65,unknown:1});await settle();
  const clips=new Map(model.appended.slice(-34).map(clip=>[clip.name,clip]));
  assert.equal(clips.size,34);
  assert.equal(clips.get('Ouvrir_panneau').time,.65);
  assert.equal(clips.get('Elevation_bras').time,.4);
  assert.equal(clips.get('Ouverture_pince').time,.6);
  assert.equal(clips.get('SIM_js1y').time,1);
  assert.equal(clips.get('SIM_press_u1').time,1);
  assert.equal(viewer.getAccessPose().unknown,undefined);
  snapshots.at(-1).panel=0;const copy=viewer.getAccessPose();copy.panel=0;
  assert.equal(viewer.getAccessPose().panel,.65,'event snapshots and getters do not expose internal pose');
  viewer.setAccessPose({panel:Infinity});assert.equal(viewer.getAccessPose().panel,.65);
  viewer.setAccessPose({panel:9});assert.equal(viewer.getAccessPose().panel,1);
  viewer.setAccessPose({panel:-1});assert.equal(viewer.getAccessPose().panel,0);
});

test('inspection door stays open through quality and visibility changes until an explicit reset', async t => {
  const { viewer, model, document, settle } = await harness(t, { access:true });
  viewer.setAccessPose({panel:.8});await settle();
  await viewer.setQuality('mobile');await viewer.setQuality('hq');
  assert.equal(viewer.getAccessPose().panel,.8);assert.equal(model.requests.length,1);
  document.hidden=true;document.dispatchEvent(event('visibilitychange'));
  const count=model.appended.length;await settle();
  assert.equal(viewer.getAccessPose().panel,.8,'hiding the scene never closes the door');
  assert.equal(model.appended.length,count,'no pose is rendered while hidden');
  assert.equal(model.paused,true);
  document.hidden=false;document.dispatchEvent(event('visibilitychange'));await settle();
  assert.equal(model.appended.at(-1).name,'Ouvrir_panneau');assert.equal(model.appended.at(-1).time,.8);
  viewer.resetPose();await settle();
  assert.equal(viewer.getAccessPose().panel,0);assert.equal(model.appended.at(-1).time,0);
});

test('models without the optional door do not advertise or append its clip', async t => {
  const { viewer, model, settle } = await harness(t);
  assert.equal(viewer.availableAccessKeys.length,0);
  viewer.setAccessPose({panel:1});await settle();
  assert(model.appended.every(clip=>clip.name!=='Ouvrir_panneau'));
});

test('door and source selector compose independently with buttons and preserve their separate poses', async t => {
  const {viewer,model,document,settle}=await harness(t,{controls:true,buttons:true,access:true,sourceSelector:true});
  assert.deepEqual(Array.from(viewer.availableAccessKeys),['panel','source']);
  viewer.setAccessPose({panel:.7,source:1});viewer.setButtonPose({u1:1});await settle();
  let clips=new Map(model.appended.slice(-35).map(clip=>[clip.name,clip]));
  assert.equal(clips.size,35);
  assert.equal(clips.get('Ouvrir_panneau').time,.7);
  assert.equal(clips.get('Selection_commande').time,1);
  assert.equal(clips.get('SIM_press_u1').time,1);
  viewer.setAccessPose({source:0});await settle();
  assert.equal(viewer.getAccessPose().panel,.7);
  await viewer.setQuality('mobile');
  document.hidden=true;document.dispatchEvent(event('visibilitychange'));
  assert.equal(viewer.getAccessPose().panel,.7);assert.equal(viewer.getAccessPose().source,0);
  document.hidden=false;document.dispatchEvent(event('visibilitychange'));await settle();
  clips=new Map(model.appended.slice(-35).map(clip=>[clip.name,clip]));
  assert.equal(clips.get('Ouvrir_panneau').time,.7);assert.equal(clips.get('Selection_commande').time,0);
  assert.equal(clips.get('SIM_press_u1').time,1);
});
