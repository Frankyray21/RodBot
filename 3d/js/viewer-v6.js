/* Atelier 3D : moteur three.js du modèle neuf (construit d'après le manuel de pièces PM10654).
   Même contrat que viewer-v5.js (model-viewer + GLB V40) : la page, les fiches, la visite
   guidée (tour.js) et les exercices (training-ui.js) l'utilisent sans changement.
   Le modèle est construit dans le navigateur (3d/eclate/asm), puis articulé (3d/eclate/rig.js). */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildModel } from '../eclate/model.js';
import { buildRig } from '../eclate/rig.js';
import { clamp, ease, nearestYaw, framingScale } from './motion.js';

const ENV_URL = new URL('../assets/warehouse-v5.hdr', import.meta.url).href;
/* Articles livrés à part, posés au sol dans la vue éclatée : absents de l'atelier. */
export const KIT_ITEMS = ['powerSupply', 'tetherBulkhead', 'cableKit', 'acc-remote-charger', 'acc-remote-battery-2', 'acc-remote-battery-3',
  'acc-remote-battery-4', 'acc-remote-receiver', 'acc-remote-strap'];

/* Mouvements de la machine : mêmes clés et bornes que V5, plus l'inclinaison de la pince. */
export const V6_MOTIONS = [
  { id: 'turret', drive: 'turret', min: -35, max: 35, initial: 0 },
  { id: 'arm', drive: 'arm', min: 0, max: 15, initial: 0 },
  { id: 'wrist', drive: 'wrist', min: -10, max: 10, initial: 3 },
  { id: 'tool', drive: 'tool', min: -35, max: 35, initial: 0 },
  { id: 'grip', drive: 'grip', min: 0, max: 100, initial: 0 },
  { id: 'jacks', drive: 'jacks', min: 0, max: 100, initial: 100 },
  { id: 'tilt', drive: 'tilt', min: -20, max: 20, initial: 0 }
];
export const CONTROL_KEYS = [
  ...Array.from({ length: 7 }, (_, i) => 'front' + String(i + 1).padStart(2, '0')),
  ...Array.from({ length: 5 }, (_, i) => 'side' + String(i + 1).padStart(2, '0')),
  'js1x', 'js1y', 'js2', 'js3x', 'js3y'
];
export const BUTTON_KEYS = ['u1', 'u2', 'u3', 'u4', 'grip', 'rearm', 'start', 'mode_linear', 'mode_direct', 'mode_standby'];
export const ACCESS_KEYS = ['panel', 'source'];
const initialPose = () => Object.fromEntries(V6_MOTIONS.map(m => [m.id, m.initial]));
const zeros = keys => Object.fromEntries(keys.map(k => [k, 0]));
const DEG = Math.PI / 180;
const HOME = { yaw: -35, pitch: 20, dist: 6.5 };
const LIMITS = { minDist: .35, maxDist: 18, minPitch: 0, maxPitch: 85 };
const vector = (value, fallback = [0, 0, 0]) => Array.isArray(value) && value.length === 3 && value.every(Number.isFinite) ? [...value] : [...fallback];

function chooseQuality(value) {
  const choice = value || new URLSearchParams(location.search).get('q');
  if (choice === 'mobile' || choice === 'hq') return choice;
  return Math.min(screen.width, screen.height) < 700 || navigator.connection?.saveData ||
    (navigator.deviceMemory && navigator.deviceMemory <= 4) ? 'mobile' : 'hq';
}

export const RodbotViewer = {
  async create(opts = {}) {
    const canvas = typeof opts.canvas === 'string' ? document.querySelector(opts.canvas) : opts.canvas;
    const overlay = typeof opts.overlay === 'string' ? document.querySelector(opts.overlay) : opts.overlay;
    if (!canvas || canvas.localName !== 'canvas') throw new Error('Élément canvas absent');
    const homeView = {
      yaw: Number.isFinite(opts.home?.yaw) ? opts.home.yaw : HOME.yaw,
      pitch: Number.isFinite(opts.home?.pitch) ? clamp(opts.home.pitch, LIMITS.minPitch, LIMITS.maxPitch) : HOME.pitch,
      dist: Number.isFinite(opts.home?.dist) ? clamp(opts.home.dist, LIMITS.minDist, LIMITS.maxDist) : HOME.dist
    };
    let homeTarget = vector(opts.home?.target, [-0.4, 1.2, 0.3]);
    const events = new Map(), cleanup = [], media = matchMedia('(prefers-reduced-motion: reduce)');
    let destroyed = false, loaded = false, visible = !document.hidden, intersecting = true;
    let reduced = media.matches, quality = chooseQuality(opts.quality), autoRotate = false;
    let pose = initialPose(), controlPose = zeros(CONTROL_KEYS), buttonPose = zeros(BUTTON_KEYS), accessPose = zeros(ACCESS_KEYS);
    let availableControlKeys = [], availableButtonKeys = [], availableAccessKeys = [], canArticulate = false;
    let frame = null, lastFrame = 0, flight = null, dirty = true, projectionUntil = 0;
    let points = [], showPoints = true, framing = 1, width = 1, height = 1;
    let rig = null, model = null;
    const restInverse = new Map();
    const emit = (name, ...args) => events.get(name)?.forEach(fn => fn(...args));
    const listen = (node, name, fn, options) => { node.addEventListener(name, fn, options); cleanup.push(() => node.removeEventListener(name, fn, options)); };

    /* ---------- rendu ---------- */
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x000000, 0);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.02, 80);
    const key = new THREE.DirectionalLight('#ffffff', 2.1); key.position.set(-1.6, 8, 2.4); key.castShadow = true;
    key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
    Object.assign(key.shadow.camera, { left: -4.5, right: 4.5, top: 4.5, bottom: -4.5, near: 0.5, far: 25 });
    scene.add(key, key.target);
    const fill = new THREE.DirectionalLight('#dfe8ff', 0.6); fill.position.set(-5, 3, 4); scene.add(fill);   // côté opérateur et télécommande
    const ground = new THREE.Mesh(new THREE.CircleGeometry(20, 72), new THREE.ShadowMaterial({ opacity: 0.3 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
    const pmrem = new THREE.PMREMGenerator(renderer);
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true; controls.dampingFactor = 0.12;
    controls.minPolarAngle = (90 - LIMITS.maxPitch) * DEG; controls.maxPolarAngle = (90 - LIMITS.minPitch) * DEG;
    controls.zoomSpeed = 0.9; controls.rotateSpeed = 0.8;
    // OrbitControls bloque le défilement tactile : on rend la main au CSS (pan-y, ou none en plein écran)
    canvas.style.touchAction = '';

    function applyQuality() {
      const dpr = window.devicePixelRatio || 1;
      renderer.setPixelRatio(quality === 'hq' ? Math.min(dpr, 2) : Math.min(dpr, 1.25));
      renderer.shadowMap.enabled = quality === 'hq';
      key.shadow.mapSize.set(2048, 2048);
      ground.visible = quality === 'hq';
      if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; }
      scene.traverse(o => { if (o.material) o.material.needsUpdate = true; });
      fit(); dirty = true;
    }

    /* ---------- caméra ---------- */
    function getView() {
      const off = camera.position.clone().sub(controls.target), r = off.length() || 1;
      return { yaw: Math.atan2(off.x, off.z) / DEG, pitch: Math.asin(clamp(off.y / r, -1, 1)) / DEG, dist: r / framing, target: controls.target.toArray() };
    }
    function renderView(view) {
      const r = view.dist * framing, y = view.yaw * DEG, p = view.pitch * DEG;
      controls.target.set(...view.target);
      camera.position.set(view.target[0] + r * Math.cos(p) * Math.sin(y), view.target[1] + r * Math.sin(p), view.target[2] + r * Math.cos(p) * Math.cos(y));
      camera.lookAt(controls.target); controls.update(); dirty = true;
    }
    function requestFrame() { if (!destroyed && visible && frame === null) frame = requestAnimationFrame(tick); }
    function queueProjection() { projectionUntil = performance.now() + 180; dirty = true; requestFrame(); }
    function cancelFlight() { if (flight) { const previous = flight; flight = null; previous.resolve(false); } }
    function setAutoRotate(value) {
      autoRotate = Boolean(value) && !reduced && visible && loaded && !destroyed;
      if (autoRotate) { cancelFlight(); lastFrame = 0; requestFrame(); }
      emit('autorotate', autoRotate);
    }
    function interact() { cancelFlight(); setAutoRotate(false); emit('interaction'); queueProjection(); }
    function flyTo(view = {}, duration = 1100) {
      if (destroyed || !loaded || !visible) return Promise.resolve(false);
      cancelFlight(); setAutoRotate(false);
      const from = getView();
      const to = {
        yaw: nearestYaw(from.yaw, Number.isFinite(view.yaw) ? view.yaw : from.yaw),
        pitch: clamp(Number.isFinite(view.pitch) ? view.pitch : from.pitch, LIMITS.minPitch, LIMITS.maxPitch),
        dist: clamp(Number.isFinite(view.dist) ? view.dist : from.dist, LIMITS.minDist, LIMITS.maxDist),
        target: vector(view.target, from.target)
      };
      return new Promise(resolve => {
        flight = { from, to, started: performance.now(), duration: reduced ? 0 : Math.max(0, Number(duration) || 0), resolve };
        requestFrame();
      });
    }
    function zoom(factor) {
      if (!loaded || !Number.isFinite(factor) || factor <= 0) return;
      const v = getView(); void flyTo({ ...v, dist: v.dist * factor }, 160);
    }

    /* ---------- repères ---------- */
    const tmp = new THREE.Vector3(), tmpN = new THREE.Vector3(), camDir = new THREE.Vector3();
    function anchorOf(data) {
      const node = data.node ? model.nodes.get(data.node) : null;
      const world = new THREE.Vector3(...vector(data.pos));
      const normal = new THREE.Vector3(...vector(data.normal, [0, 1, 0])).normalize();
      if (!node) return { node: null, local: world, normal };
      const inv = restInverse.get(node) || new THREE.Matrix4().copy(node.matrixWorld).invert();
      return { node, local: world.applyMatrix4(inv), normal: normal.transformDirection(inv) };
    }
    function anchorWorld(a, out, outN) {
      out.copy(a.local); if (a.node) out.applyMatrix4(a.node.matrixWorld);
      if (outN) { outN.copy(a.normal); if (a.node) outN.transformDirection(a.node.matrixWorld); }
      return out;
    }
    /** Position à l'écran d'un repère ({ pos, normal, node }) : px dans le canevas. */
    function project(data) {
      if (!loaded) return null;
      const a = data.__anchor || (data.__anchor = anchorOf(data));
      anchorWorld(a, tmp, tmpN);
      const facing = camDir.copy(camera.position).sub(tmp).dot(tmpN) > 0;
      tmp.project(camera);
      return { x: (tmp.x + 1) / 2 * width, y: (1 - tmp.y) / 2 * height, z: tmp.z, facingCamera: facing };
    }
    function projectHotspots() {
      if (!overlay || !loaded || destroyed) return;
      const box = canvas.getBoundingClientRect(), obox = overlay.getBoundingClientRect();
      for (const point of points) {
        const pr = project(point.data), el = point.el;
        if (!pr) { el.hidden = true; continue; }
        const x = pr.x + box.left - obox.left, y = pr.y + box.top - obox.top;
        const outside = !showPoints || !Number.isFinite(pr.z) || pr.z < -1 || pr.z > 1 || x < 18 || x > width - 18 || y < 18 || y > height - 18;
        el.hidden = outside;
        el.classList.toggle('is-occluded', !pr.facingCamera && !outside);
        if (!outside) {
          el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;
          el.style.zIndex = String((pr.facingCamera ? 1000 : 500) - Math.round((pr.z + 1) * 100));
        }
      }
      emit('projection');
    }
    function setHotspots(list = []) {
      for (const point of points) point.el.remove();
      points = [];
      if (!overlay || destroyed) return;
      const seen = new Set();
      for (const data of list) {
        if (!data?.id || seen.has(data.id)) continue;
        seen.add(data.id);
        const el = document.createElement('button');
        el.type = 'button'; el.className = 'hs' + (data.classe ? ' ' + data.classe : ''); el.dataset.id = data.id;
        el.setAttribute('aria-label', data.label || data.id); el.hidden = true;
        const dot = document.createElement('span'), num = document.createElement('span'), label = document.createElement('span');
        dot.className = data.encercle ? 'hs-ring' : 'hs-dot';
        num.className = data.encercle ? 'hs-ring-tag' : 'hs-n'; num.textContent = data.num ?? '';
        label.className = 'hs-lb'; label.textContent = data.label || data.id;
        dot.append(num); el.append(dot, label);
        const point = { data, el };
        el.addEventListener('pointerdown', event => event.stopPropagation());
        el.addEventListener('click', event => { event.stopPropagation(); emit('select', point.data.id, point.data); });
        points.push(point); overlay.append(el);
      }
      queueProjection();
    }
    function updateHotspots(updates) {
      const changed = new Map((Array.isArray(updates) ? updates : []).map(h => [h.id, h]));
      for (const point of points) if (changed.has(point.data.id)) point.data = { ...point.data, ...changed.get(point.data.id), __anchor: null };
      queueProjection();
    }

    /* ---------- articulations ---------- */
    function applyRig() {
      if (!rig) return;
      for (const m of V6_MOTIONS) rig.set(m.drive, pose[m.id]);
      for (const k of availableControlKeys) rig.set('ctl:' + k, controlPose[k]);
      for (const k of availableButtonKeys) rig.set('btn:' + k, buttonPose[k]);
      for (const k of availableAccessKeys) rig.set('acc:' + k, accessPose[k]);
      // le couvercle souple en vinyle se relève pour ouvrir la porte du coffret
      const vinyl = model?.nodes.get('elec-fc-guard'); if (vinyl) vinyl.visible = accessPose.panel < 0.02;
      rig.update(); queueProjection();
    }
    function setPose(partial = {}) {
      if (destroyed) return { ...pose };
      for (const m of V6_MOTIONS) if (Number.isFinite(partial[m.id])) pose[m.id] = clamp(partial[m.id], m.min, m.max);
      applyRig(); emit('pose', { ...pose });
      return { ...pose };
    }
    function resetPose() {
      if (destroyed) return { ...pose };
      pose = initialPose(); controlPose = zeros(CONTROL_KEYS); buttonPose = zeros(BUTTON_KEYS); accessPose = zeros(ACCESS_KEYS);
      applyRig(); emit('pose', { ...pose }); emit('controlpose', { ...controlPose }); emit('accesspose', { ...accessPose });
      return { ...pose };
    }
    function setControlPose(partial = {}) {
      if (destroyed) return { ...controlPose };
      for (const k of CONTROL_KEYS) if (Number.isFinite(partial[k])) controlPose[k] = clamp(partial[k], -1, 1);
      applyRig(); emit('controlpose', { ...controlPose });
      return { ...controlPose };
    }
    function setButtonPose(partial = {}) {
      if (destroyed) return { ...buttonPose };
      let changed = false;
      for (const k of BUTTON_KEYS) {
        if (!Number.isFinite(partial[k])) continue;
        const value = clamp(partial[k], 0, 1);
        if (value !== buttonPose[k]) { buttonPose[k] = value; changed = true; }
      }
      if (changed) { applyRig(); emit('buttonpose', { ...buttonPose }); }
      return { ...buttonPose };
    }
    function setAccessPose(partial = {}) {
      if (destroyed) return { ...accessPose };
      let changed = false;
      for (const k of ACCESS_KEYS) {
        if (!Number.isFinite(partial[k])) continue;
        const value = clamp(partial[k], 0, 1);
        if (value !== accessPose[k]) { accessPose[k] = value; changed = true; }
      }
      if (changed) { applyRig(); emit('accesspose', { ...accessPose }); }
      return { ...accessPose };
    }

    /* ---------- boucle ---------- */
    function tick(now) {
      frame = null;
      if (destroyed || !visible) return;
      const dt = lastFrame ? clamp((now - lastFrame) / 1000, 0, .1) : 0;
      lastFrame = now;
      let moving = false;
      if (flight && loaded) {
        const f = flight, k = f.duration ? ease(clamp((now - f.started) / f.duration, 0, 1)) : 1;
        renderView({
          yaw: f.from.yaw + (f.to.yaw - f.from.yaw) * k, pitch: f.from.pitch + (f.to.pitch - f.from.pitch) * k,
          dist: f.from.dist + (f.to.dist - f.from.dist) * k, target: f.from.target.map((v, i) => v + (f.to.target[i] - v) * k)
        });
        if (k >= 1) { flight = null; f.resolve(true); projectionUntil = now + 100; } else moving = true;
      } else if (autoRotate && loaded) {
        const v = getView(); renderView({ ...v, yaw: v.yaw + 3 * dt }); moving = true;
      }
      if (controls.update()) { dirty = true; moving = true; }
      if (dirty && loaded) { renderer.render(scene, camera); dirty = false; projectHotspots(); }
      if (moving || flight || autoRotate || now < projectionUntil) requestFrame();
    }
    function fit() {
      if (destroyed) return;
      const box = canvas.getBoundingClientRect();
      if (!box.width || !box.height) return;
      const before = loaded ? getView() : null;
      width = box.width; height = box.height;
      renderer.setSize(width, height, false);
      camera.aspect = width / height; camera.updateProjectionMatrix();
      framing = framingScale(width, height) / 1.15;
      controls.minDistance = LIMITS.minDist * framing; controls.maxDistance = LIMITS.maxDist * framing;
      if (before) renderView(before);
      queueProjection();
    }
    function updateVisibility() {
      const next = intersecting && !document.hidden;
      if (next === visible) return;
      visible = next;
      if (!visible) {
        cancelFlight(); setAutoRotate(false);
        controlPose = zeros(CONTROL_KEYS); applyRig(); emit('controlpose', { ...controlPose });
        if (frame !== null) cancelAnimationFrame(frame); frame = null;
      } else { lastFrame = 0; queueProjection(); }
      emit('visibility', visible);
    }
    const resize = new ResizeObserver(fit); resize.observe(canvas);
    const intersection = new IntersectionObserver(([entry]) => { intersecting = entry.isIntersecting; updateVisibility(); }); intersection.observe(canvas);
    listen(document, 'visibilitychange', updateVisibility);
    listen(media, 'change', event => { reduced = event.matches; if (reduced) { cancelFlight(); setAutoRotate(false); } emit('reducedmotion', reduced); });
    controls.addEventListener('start', interact);
    controls.addEventListener('change', () => { dirty = true; requestFrame(); });
    listen(canvas, 'keydown', event => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === 'Home') { event.preventDefault(); interact(); void flyTo({ ...homeView, target: homeTarget }, 900); }
    });
    listen(canvas, 'webglcontextlost', event => { event.preventDefault(); emit('error', new Error('Contexte WebGL perdu')); });

    async function loadEnv() {
      const use = (buf) => {
        const tex = new HDRLoader().parse(buf);
        const t = new THREE.DataTexture(tex.data, tex.width, tex.height, THREE.RGBAFormat, tex.type);
        t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.LinearSRGBColorSpace;
        t.minFilter = t.magFilter = THREE.LinearFilter; t.generateMipmaps = false; t.flipY = true; t.needsUpdate = true;
        scene.environment = pmrem.fromEquirectangular(t).texture; scene.environmentIntensity = 0.9; t.dispose();
      };
      try { const r = await fetch(opts.environment || ENV_URL); if (!r.ok) throw new Error(String(r.status)); use(await r.arrayBuffer()); }
      catch (_) { scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.8; }
    }

    const api = {
      canvas, get quality() { return quality; }, get reducedMotion() { return reduced; },
      get canArticulate() { return canArticulate; }, get loaded() { return loaded; },
      get availableControlKeys() { return [...availableControlKeys]; },
      get availableButtonKeys() { return [...availableButtonKeys]; },
      get availableAccessKeys() { return [...availableAccessKeys]; },
      on(name, fn) { if (!events.has(name)) events.set(name, new Set()); events.get(name).add(fn); return api; },
      flyTo, home: (duration = 900) => flyTo({ ...homeView, target: homeTarget }, duration), cancelFlight,
      zoom, setAutoRotate, setHotspots, updateHotspots, project,
      async setQuality(value) { if (destroyed) return false; quality = chooseQuality(value); applyQuality(); emit('quality', quality); return true; },
      setHotspotsVisible(value) { showPoints = Boolean(value); queueProjection(); },
      get visible() { return visible; },
      getView, setPose, getPose: () => ({ ...pose }), resetPose,
      setControlPose, getControlPose: () => ({ ...controlPose }),
      setButtonPose, getButtonPose: () => ({ ...buttonPose }),
      setAccessPose, getAccessPose: () => ({ ...accessPose }),
      /** Rendu immédiat (vignettes, tests). */
      render() { if (loaded) { renderer.render(scene, camera); projectHotspots(); } },
      get three() { return { THREE, scene, camera, renderer, controls, model, rig }; },
      destroy() {
        if (destroyed) return;
        destroyed = true; cancelFlight();
        if (frame !== null) cancelAnimationFrame(frame); frame = null;
        resize.disconnect(); intersection.disconnect(); cleanup.forEach(fn => fn()); controls.dispose();
        for (const point of points) point.el.remove();
        points = []; events.clear(); renderer.dispose(); pmrem.dispose();
      }
    };
    applyQuality();
    renderView({ ...homeView, target: homeTarget });
    api.ready = (async () => {
      emit('loading', quality); emit('progress', 0);
      await new Promise(r => setTimeout(r, 0));
      const env = loadEnv();
      const built = await buildModel({ onProgress: f => emit('progress', 0.9 * f) });
      if (destroyed) return false;
      await env;
      const root = built.root;
      const hide = new Set(opts.hide || KIT_ITEMS);
      root.traverse(o => { if (o.userData && hide.has(o.userData.id)) o.visible = false; });
      scene.add(root);
      root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      const nodes = new Map();
      root.traverse(o => { const u = o.userData; if (u && (u.type === 'asm' || u.type === 'part') && u.id && !nodes.has(u.id)) nodes.set(u.id, o); });
      root.updateMatrixWorld(true);
      for (const n of nodes.values()) restInverse.set(n, new THREE.Matrix4().copy(n.matrixWorld).invert());
      rig = buildRig(root);
      model = { root, nodes, stats: built.stats, missing: built.missing };
      canArticulate = V6_MOTIONS.every(m => rig.has(m.drive));
      availableControlKeys = CONTROL_KEYS.filter(k => rig.has('ctl:' + k));
      availableButtonKeys = BUTTON_KEYS.filter(k => rig.has('btn:' + k));
      availableAccessKeys = ACCESS_KEYS.filter(k => rig.has('acc:' + k));
      // ombre portée cadrée sur la machine
      const box = new THREE.Box3().setFromObject(root), c = box.getCenter(new THREE.Vector3());
      key.target.position.copy(c); key.position.copy(c).add(new THREE.Vector3(-1.6, 8, 2.4));   // presque au zénith : ombre sous la machine, vue de partout
      loaded = true;
      applyRig(); fit(); renderView({ ...homeView, target: homeTarget });
      renderer.compile(scene, camera);
      if (opts.autoRotate && !reduced) setAutoRotate(true);
      emit('progress', 1); emit('ready');
      queueProjection();
      return true;
    })();
    api.ready.catch(error => { if (!destroyed) emit('error', error); });
    return api;
  }
};
export default RodbotViewer;
