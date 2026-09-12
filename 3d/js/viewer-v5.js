/* GLB training renderer (V6, derived from V5). Public model-viewer 4.3.1 APIs only.
   Existing page controls, component cards and camera tours keep their contract. */
import { clamp, ease, nearestYaw, framingScale } from './motion.js';
import { MODEL_URL } from './model-assets.js';

export const V5_MOTIONS = [
  { id: 'turret', clip: 'Rotation_tourelle', min: -35, max: 35, initial: 0 },
  { id: 'arm', clip: 'Elevation_bras', min: 0, max: 15, initial: 0, reverse: true },
  { id: 'wrist', clip: 'Inclinaison_pince', min: -10, max: 10, initial: 3 },
  { id: 'tool', clip: 'Rotation_pince', min: -35, max: 35, initial: 0 },
  { id: 'grip', clip: 'Ouverture_pince', min: 0, max: 100, initial: 0 },
  { id: 'jacks', clip: 'Stabilisateurs', min: 0, max: 100, initial: 100 }
];
const initialPose = () => Object.fromEntries(V5_MOTIONS.map(m => [m.id, m.initial]));
export const CONTROL_CLIPS = Object.fromEntries([
  ...Array.from({ length: 7 }, (_, index) => 'front' + String(index + 1).padStart(2, '0')),
  ...Array.from({ length: 5 }, (_, index) => 'side' + String(index + 1).padStart(2, '0')),
  'js1x', 'js1y', 'js2', 'js3x', 'js3y'
].map(key => [key, 'SIM_' + key]));
const initialControls = () => Object.fromEntries(Object.keys(CONTROL_CLIPS).map(key => [key, 0]));
export const BUTTON_CLIPS = Object.fromEntries(['u1','u2','u3','u4','grip','rearm','start','mode_linear','mode_direct','mode_standby'].map(key => [key, 'SIM_press_' + key]));
const initialButtons = () => Object.fromEntries(Object.keys(BUTTON_CLIPS).map(key => [key, 0]));
export const ACCESS_CLIPS = { panel: 'Ouvrir_panneau', source: 'Selection_commande' };
const initialAccess = () => Object.fromEntries(Object.keys(ACCESS_CLIPS).map(key => [key, 0]));
const radians = Math.PI / 180;
const HOME = { yaw: -35, pitch: 20, dist: 6.5 };
const LIMITS = { minDist: .35, maxDist: 18, minPitch: 0, maxPitch: 85 };
const vector = (value, fallback = [0, 0, 0]) => Array.isArray(value) && value.length === 3 && value.every(Number.isFinite) ? [...value] : [...fallback];
const vectorString = value => typeof value === 'string' ? value : vector(value).map(v => `${v}m`).join(' ');
const components = value => [value.x, value.y, value.z];
export const motionTime = (motion, value) => {
  const fraction = (clamp(value, motion.min, motion.max) - motion.min) / (motion.max - motion.min);
  return motion.reverse ? 1 - fraction : fraction;
};
export const cameraArrived = (actual, expected) => Math.abs(nearestYaw(expected.yaw, actual.yaw) - expected.yaw) < .06 &&
  Math.abs(actual.pitch - expected.pitch) < .06 && Math.abs(actual.dist - expected.dist) < .002 &&
  actual.target.every((value, index) => Math.abs(value - expected.target[index]) < .002);

function chooseQuality(value) {
  const choice = value || new URLSearchParams(location.search).get('q');
  if (choice === 'mobile' || choice === 'hq') return choice;
  return Math.min(screen.width, screen.height) < 700 || navigator.connection?.saveData ||
    (navigator.deviceMemory && navigator.deviceMemory <= 4) ? 'mobile' : 'hq';
}

export const RodbotViewer = {
  async create(opts = {}) {
    const model = typeof opts.canvas === 'string' ? document.querySelector(opts.canvas) : opts.canvas;
    const overlay = typeof opts.overlay === 'string' ? document.querySelector(opts.overlay) : opts.overlay;
    if (!model || model.localName !== 'model-viewer') throw new Error('Élément model-viewer absent');
    const events = new Map(), cleanup = [], media = matchMedia('(prefers-reduced-motion: reduce)');
    let destroyed = false, loaded = false, visible = !document.hidden, intersecting = true;
    let reduced = media.matches, quality = chooseQuality(opts.quality), autoRotate = false;
    let pose = initialPose(), controlPose = initialControls(), poseGeneration = 0, canArticulate = false;
    let availableControlKeys = [], availableButtonKeys = [], buttonPose = initialButtons();
    let availableAccessKeys = [], accessPose = initialAccess();
    let frame = null, lastFrame = 0, projectionUntil = 0, flight = null;
    let points = [], showPoints = true, framing = 1, width = 1, height = 1;
    let homeTarget = [0, 1.25, 0], loadingReject = null;
    const emit = (name, ...args) => events.get(name)?.forEach(fn => fn(...args));
    const listen = (node, name, fn, options) => {
      node.addEventListener(name, fn, options);
      cleanup.push(() => node.removeEventListener(name, fn, options));
    };
    function getView() {
      if (!loaded) return { ...HOME, target: [...homeTarget] };
      const orbit = model.getCameraOrbit();
      return { yaw: orbit.theta / radians, pitch: 90 - orbit.phi / radians,
        dist: orbit.radius / framing, target: components(model.getCameraTarget()) };
    }
    function renderView(view) {
      model.cameraOrbit = `${view.yaw}deg ${90 - view.pitch}deg ${view.dist * framing}m`;
      model.cameraTarget = vectorString(view.target);
      // Lit applies the public camera properties on its next update.
      model.jumpCameraToGoal();
    }
    function queueProjection() {
      projectionUntil = performance.now() + 180;
      requestFrame();
    }
    function requestFrame() {
      if (!destroyed && visible && frame === null) frame = requestAnimationFrame(tick);
    }
    function cancelFlight() {
      if (flight) { const previous = flight; flight = null; previous.resolve(false); }
    }
    function setAutoRotate(value) {
      autoRotate = Boolean(value) && !reduced && visible && loaded && !destroyed;
      // model-viewer's autoRotate rotates its turntable, not the camera.
      model.autoRotate = false;
      if (autoRotate) { cancelFlight(); lastFrame = 0; requestFrame(); }
      emit('autorotate', autoRotate);
    }
    function interact() {
      cancelFlight(); setAutoRotate(false); emit('interaction'); queueProjection();
    }
    function projectHotspots() {
      if (!overlay || !loaded || destroyed) return;
      const modelBox = model.getBoundingClientRect(), overlayBox = overlay.getBoundingClientRect();
      for (const point of points) {
        const data = model.queryHotspot(point.anchor.slot), el = point.el;
        if (!data) { el.hidden = true; continue; }
        const position = data.canvasPosition;
        const x = position.x + modelBox.left - overlayBox.left;
        const y = position.y + modelBox.top - overlayBox.top;
        const outside = !showPoints || !Number.isFinite(position.z) || position.z < -1 || position.z > 1 ||
          x < 18 || x > width - 18 || y < 18 || y > height - 18;
        el.hidden = outside;
        el.classList.toggle('is-occluded', !data.facingCamera && !outside);
        if (!outside) {
          el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;
          el.style.zIndex = String((data.facingCamera ? 1000 : 500) - Math.round((position.z + 1) * 100));
        }
      }
    }
    function tick(now) {
      frame = null;
      if (destroyed || !visible) return;
      const dt = lastFrame ? clamp((now - lastFrame) / 1000, 0, .1) : 0;
      lastFrame = now;
      if (flight && loaded) {
        const current = flight;
        const progress = current.duration ? clamp((now - current.started) / current.duration, 0, 1) : 1;
        if (progress < 1) {
          const k = ease(progress);
          renderView({
            yaw: current.from.yaw + (current.to.yaw - current.from.yaw) * k,
            pitch: current.from.pitch + (current.to.pitch - current.from.pitch) * k,
            dist: current.from.dist + (current.to.dist - current.from.dist) * k,
            target: current.from.target.map((value, i) => value + (current.to.target[i] - value) * k)
          });
        } else if (!current.finalSent) {
          current.finalSent = true;
          renderView(current.to);
        } else if (cameraArrived(getView(), current.to)) {
          flight = null;
          current.resolve(true);
          projectionUntil = now + 100;
        } else if (now - current.started > current.duration + 2500) {
          // A constrained or lost camera must pause its tour instead of claiming arrival.
          flight = null;
          current.resolve(false);
        }
      } else if (autoRotate && loaded) {
        const current = getView();
        renderView({ ...current, yaw: current.yaw + 3 * dt });
      }
      projectHotspots();
      if (flight || autoRotate || now < projectionUntil) requestFrame();
    }
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
        flight = { from, to, started: performance.now(), duration: reduced ? 0 : Math.max(0, Number(duration) || 0), finalSent: false, resolve };
        requestFrame();
      });
    }
    function zoom(factor) {
      if (!loaded || !Number.isFinite(factor) || factor <= 0) return;
      const current = getView(); interact();
      void flyTo({ ...current, dist: current.dist * factor }, 220);
    }
    function applyPose() {
      if (!loaded || !canArticulate || destroyed || !visible) return;
      model.timeScale = 0;
      model.animationCrossfadeDuration = 0;
      for (const motion of V5_MOTIONS) {
        // 4.3.1's runtime accepts numeric strings; its number validator warns on valid 1.
        model.appendAnimation(motion.clip, { time: motionTime(motion, pose[motion.id]), timeScale: 0, weight: 1, fade: false, repetitions: '1' });
      }
      for (const key of availableControlKeys) {
        model.appendAnimation(CONTROL_CLIPS[key], { time: (controlPose[key] + 1) / 2, timeScale: 0, weight: 1, fade: false, repetitions: '1' });
      }
      for (const key of availableButtonKeys) {
        model.appendAnimation(BUTTON_CLIPS[key], { time: buttonPose[key], timeScale: 0, weight: 1, fade: false, repetitions: '1' });
      }
      for (const key of availableAccessKeys) {
        model.appendAnimation(ACCESS_CLIPS[key], { time: accessPose[key], timeScale: 0, weight: 1, fade: false, repetitions: '1' });
      }
      const generation = ++poseGeneration;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (!destroyed && generation === poseGeneration) { model.pause(); queueProjection(); }
      }));
      queueProjection();
    }
    function setPose(partial = {}) {
      if (destroyed) return { ...pose };
      for (const motion of V5_MOTIONS) {
        if (Number.isFinite(partial[motion.id])) pose[motion.id] = clamp(partial[motion.id], motion.min, motion.max);
      }
      applyPose(); emit('pose', { ...pose });
      return { ...pose };
    }
    function resetPose() {
      if (destroyed) return { ...pose };
      poseGeneration++;
      if (loaded) { model.pause(); model.currentTime = 0; }
      pose = initialPose(); controlPose = initialControls(); buttonPose = initialButtons(); accessPose = initialAccess(); applyPose();
      emit('pose', { ...pose }); emit('controlpose', { ...controlPose });
      emit('accesspose', { ...accessPose });
      return { ...pose };
    }
    function setControlPose(partial = {}) {
      if (destroyed) return { ...controlPose };
      for (const key of Object.keys(CONTROL_CLIPS)) {
        if (Number.isFinite(partial[key])) controlPose[key] = clamp(partial[key], -1, 1);
      }
      applyPose(); emit('controlpose', { ...controlPose });
      return { ...controlPose };
    }
    function setButtonPose(partial = {}) {
      if (destroyed) return { ...buttonPose };
      let changed = false;
      for (const key of Object.keys(BUTTON_CLIPS)) {
        if (!Number.isFinite(partial[key])) continue;
        const value = clamp(partial[key], 0, 1);
        if (value !== buttonPose[key]) { buttonPose[key] = value; changed = true; }
      }
      if (changed) { applyPose(); emit('buttonpose', { ...buttonPose }); }
      return { ...buttonPose };
    }
    function setAccessPose(partial = {}) {
      if (destroyed) return { ...accessPose };
      let changed = false;
      for (const key of Object.keys(ACCESS_CLIPS)) {
        if (!Number.isFinite(partial[key])) continue;
        const value = clamp(partial[key], 0, 1);
        if (value !== accessPose[key]) { accessPose[key] = value; changed = true; }
      }
      if (changed) { applyPose(); emit('accesspose', { ...accessPose }); }
      return { ...accessPose };
    }
    function updateAnchor(point) {
      const h = point.data;
      const config = { name: point.anchor.slot, position: vectorString(h.pos),
        normal: vectorString(h.normal || [0, 1, 0]), surface: h.surface || undefined };
      point.anchor.dataset.position = config.position;
      point.anchor.dataset.normal = config.normal;
      if (h.surface) point.anchor.dataset.surface = h.surface;
      else delete point.anchor.dataset.surface;
      if (Number.isInteger(h.modelIndex)) { config.modelIndex = h.modelIndex; point.anchor.dataset.modelIndex = String(h.modelIndex); }
      if (loaded) model.updateHotspot(config);
    }
    function updateHotspots(updates) {
      const changed = new Map((Array.isArray(updates) ? updates : []).map(h => [h.id, h]));
      for (const point of points) {
        if (changed.has(point.data.id)) point.data = { ...point.data, ...changed.get(point.data.id) };
        updateAnchor(point);
      }
      queueProjection();
    }
    function setHotspots(list = []) {
      for (const point of points) { point.el.remove(); point.anchor.remove(); }
      points = [];
      if (!overlay || destroyed) return;
      const seen = new Set();
      for (const data of list) {
        if (!data?.id || seen.has(data.id)) continue;
        seen.add(data.id);
        const anchor = document.createElement('span');
        anchor.slot = 'hotspot-' + data.id;
        anchor.setAttribute('aria-hidden', 'true');
        anchor.style.cssText = 'width:0;height:0;opacity:0;pointer-events:none;padding:0;border:0;';
        const el = document.createElement('button');
        el.type = 'button'; el.className = 'hs' + (data.classe ? ' ' + data.classe : ''); el.dataset.id = data.id;
        el.setAttribute('aria-label', data.label || data.id); el.hidden = true;
        const dot = document.createElement('span'), num = document.createElement('span'), label = document.createElement('span');
        dot.className = data.encercle ? 'hs-ring' : 'hs-dot';
        num.className = data.encercle ? 'hs-ring-tag' : 'hs-n'; num.textContent = data.num ?? '';
        label.className = 'hs-lb'; label.textContent = data.label || data.id;
        dot.append(num); el.append(dot, label);
        const point = { data, anchor, el }; updateAnchor(point);
        el.addEventListener('pointerdown', event => event.stopPropagation());
        el.addEventListener('click', event => { event.stopPropagation(); emit('select', point.data.id, point.data); });
        points.push(point); model.append(anchor); overlay.append(el);
      }
      // The public slot observer registers newly appended anchors asynchronously.
      requestAnimationFrame(() => { if (!destroyed) updateHotspots(); });
      queueProjection();
    }
    async function setQuality(value) {
      if (destroyed) return false;
      quality = chooseQuality(value);
      // Preserve the GLB, poses and camera. Fluide disables the dynamic floor shadow.
      model.shadowIntensity = quality === 'hq' ? 1 : 0;
      model.shadowSoftness = .8;
      emit('quality', quality); queueProjection();
      return true;
    }
    function updateVisibility() {
      const next = intersecting && !document.hidden;
      if (next === visible) return;
      visible = next;
      if (!visible) {
        cancelFlight(); setAutoRotate(false); poseGeneration++;
        controlPose = initialControls(); emit('controlpose', { ...controlPose });
        if (loaded) model.pause();
        if (frame !== null) cancelAnimationFrame(frame);
        frame = null;
      } else { lastFrame = 0; applyPose(); queueProjection(); }
      emit('visibility', visible);
    }
    function fit() {
      if (destroyed) return;
      const box = model.getBoundingClientRect();
      if (!box.width || !box.height) return;
      const before = getView(); width = box.width; height = box.height;
      framing = framingScale(width, height) / 1.15;
      if (loaded) { cancelFlight(); renderView(before); }
      queueProjection();
    }
    const resize = new ResizeObserver(fit); resize.observe(model);
    const intersection = new IntersectionObserver(([entry]) => { intersecting = entry.isIntersecting; updateVisibility(); }); intersection.observe(model);
    listen(document, 'visibilitychange', updateVisibility);
    listen(model, 'model-visibility', event => { intersecting = Boolean(event.detail?.visible); updateVisibility(); });
    listen(media, 'change', event => {
      reduced = event.matches;
      if (reduced) { cancelFlight(); setAutoRotate(false); }
      emit('reducedmotion', reduced);
    });
    listen(model, 'camera-change', event => {
      if (event.detail?.source === 'user-interaction') interact();
      queueProjection();
    });
    listen(model, 'pointerdown', interact);
    listen(model, 'wheel', interact, { passive: true });
    listen(model, 'keydown', event => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === 'Home') { event.preventDefault(); interact(); void flyTo({ ...HOME, target: homeTarget }, 900); }
      else if (['+', '=', '-', '_'].includes(event.key)) {
        event.preventDefault(); event.stopPropagation(); zoom(event.key === '-' || event.key === '_' ? 1.2 : 1 / 1.2);
      } else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) interact();
    }, true);
    listen(model, 'progress', event => emit('progress', clamp(event.detail?.totalProgress || 0, 0, 1)));
    listen(model, 'error', event => {
      cancelFlight(); setAutoRotate(false); poseGeneration++;
      if (loaded) model.pause();
      const error = new Error(event.detail?.type || 'Affichage 3D interrompu');
      loadingReject?.(error); loadingReject = null; emit('error', error); emit('visibility', false);
    });

    const api = {
      model, get quality() { return quality; }, get reducedMotion() { return reduced; },
      get canArticulate() { return canArticulate; }, get loaded() { return loaded; },
      get availableControlKeys() { return [...availableControlKeys]; },
      get availableButtonKeys() { return [...availableButtonKeys]; },
      get availableAccessKeys() { return [...availableAccessKeys]; },
      on(name, fn) { if (!events.has(name)) events.set(name, new Set()); events.get(name).add(fn); return api; },
      flyTo, home: (duration = 900) => flyTo({ ...HOME, target: homeTarget }, duration), cancelFlight,
      zoom, setAutoRotate, setQuality, setHotspots, updateHotspots,
      setHotspotsVisible(value) { showPoints = Boolean(value); queueProjection(); },
      getView, setPose, getPose: () => ({ ...pose }), resetPose,
      setControlPose, getControlPose: () => ({ ...controlPose }),
      setButtonPose, getButtonPose: () => ({ ...buttonPose }),
      setAccessPose, getAccessPose: () => ({ ...accessPose }),
      destroy() {
        if (destroyed) return;
        destroyed = true; cancelFlight(); poseGeneration++;
        if (frame !== null) cancelAnimationFrame(frame); frame = null;
        if (loaded) model.pause(); model.autoRotate = false;
        loadingReject?.(new Error('Viewer destroyed')); loadingReject = null;
        resize.disconnect(); intersection.disconnect(); cleanup.forEach(fn => fn());
        for (const point of points) { point.el.remove(); point.anchor.remove(); }
        points = []; events.clear(); model.removeAttribute('src');
      }
    };
    fit();
    api.ready = (async () => {
      const { ModelViewerElement } = await import('../vendor/model-viewer-4.3.1.min.js');
      if (destroyed) return false;
      ModelViewerElement.dracoDecoderLocation = new URL('../vendor/draco/', import.meta.url).href;
      model.cameraControls = true; model.autoRotate = false; model.autoplay = false;
      model.animationName = 'Presentation_360'; model.animationCrossfadeDuration = 0;
      model.timeScale = 0; model.interpolationDecay = 50;
      model.interactionPrompt = 'none'; model.touchAction = 'pan-y';
      model.minCameraOrbit = 'auto 5deg 0.35m'; model.maxCameraOrbit = 'auto 90deg 45m';
      model.fieldOfView = '30deg'; model.cameraTarget = 'auto auto auto';
      model.cameraOrbit = `${HOME.yaw}deg ${90 - HOME.pitch}deg ${HOME.dist * framing}m`;
      model.environmentImage = new URL('../assets/warehouse-v5.hdr', import.meta.url).href;
      model.setAttribute('tone-mapping', 'agx'); model.exposure = 1;
      model.poster = new URL('../assets/rodbot-v5-poster.jpg', import.meta.url).href;
      model.loading = 'eager'; model.reveal = 'auto';
      await setQuality(quality);
      emit('loading', quality); emit('progress', 0);
      await new Promise((resolve, reject) => {
        loadingReject = reject;
        listen(model, 'load', () => { loadingReject = null; resolve(true); }, { once: true });
        model.src = opts.src || MODEL_URL;
      });
      if (destroyed) return false;
      loaded = true; homeTarget = components(model.getCameraTarget());
      canArticulate = V5_MOTIONS.every(motion => model.availableAnimations.includes(motion.clip));
      availableControlKeys = Object.keys(CONTROL_CLIPS).filter(key => model.availableAnimations.includes(CONTROL_CLIPS[key]));
      availableButtonKeys = Object.keys(BUTTON_CLIPS).filter(key => model.availableAnimations.includes(BUTTON_CLIPS[key]));
      availableAccessKeys = Object.keys(ACCESS_CLIPS).filter(key => model.availableAnimations.includes(ACCESS_CLIPS[key]));
      model.pause(); model.currentTime = 0;
      applyPose(); updateHotspots(); queueProjection();
      if (opts.autoRotate && !reduced) setAutoRotate(true);
      emit('progress', 1); emit('ready');
      return true;
    })();
    // Consumers may attach to ready in a later microtask. Keep the original rejection observable.
    api.ready.catch(error => { if (!destroyed) emit('error', error); });
    return api;
  }
};
export default RodbotViewer;
