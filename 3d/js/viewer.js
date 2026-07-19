/* ============================================================
   RodbotViewer — viewer 3D gaussian splatting (PlayCanvas)
   RodBot (manipulateur de tiges robotisé) — Machines Roger International
   API :
     const v = await RodbotViewer.create({ canvas, overlay, quality })
     v.flyTo({yaw,pitch,dist,target:[x,y,z]}, ms)
     v.setHotspots([{id,label,pos:[x,y,z],view:{...}}])
     v.on('select', id => …) ; v.on('ready'|'progress', …)
     v.setAutoRotate(bool) ; v.probe(x,y,z) (dev)
   ============================================================ */
import * as pc from 'https://cdn.jsdelivr.net/npm/playcanvas@2.13.3/build/playcanvas.mjs';

const ASSET_BASE = (() => {
  // pages à la racine du site → assets/ ; pages dans un sous-dossier → ../assets/
  const p = location.pathname;
  return /\/(site|pages)\//.test(p) ? '../assets/' : 'assets/';
})();

const FILES = {
  mobile: ASSET_BASE + 'rodbot_mobile.sog',
  hq: ASSET_BASE + 'rodbot_hq.sog'
};

/* rotation du modèle (euler xyz, degrés) — le scan est exporté y vers le bas,
   180° autour de Z le remet à l'endroit : (x,y,z) -> (-x,-y,z) */
const MODEL_ROT = [0, 0, 180];

function pickQuality(pref) {
  if (pref === 'mobile' || pref === 'hq') return pref;
  const q = new URLSearchParams(location.search).get('q');
  if (q === 'mobile' || q === 'hq') return q;
  const small = Math.min(screen.width, screen.height) < 700;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const lowMem = navigator.deviceMemory && navigator.deviceMemory <= 4;
  return (small || (coarse && lowMem)) ? 'mobile' : 'hq';
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const easeInOut = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export const RodbotViewer = {
  async create(opts = {}) {
    const canvas = typeof opts.canvas === 'string' ? document.querySelector(opts.canvas) : opts.canvas;
    const overlay = typeof opts.overlay === 'string' ? document.querySelector(opts.overlay) : opts.overlay;
    if (!canvas) throw new Error('RodbotViewer: canvas requis');

    const listeners = {};
    const emit = (ev, ...args) => (listeners[ev] || []).forEach(f => f(...args));

    // --- application ---
    // ?pdb=1 : preserveDrawingBuffer pour la capture d'écran en dev
    const pdb = new URLSearchParams(location.search).get('pdb') === '1';
    const app = new pc.Application(canvas, {
      mouse: new pc.Mouse(canvas),
      touch: new pc.TouchDevice(canvas),
      graphicsDeviceOptions: { antialias: false, alpha: false, preserveDrawingBuffer: pdb }
    });
    const dprCap = matchMedia('(pointer: coarse)').matches ? 1.25 : 1.5;
    app.graphicsDevice.maxPixelRatio = Math.min(window.devicePixelRatio || 1, dprCap);
    app.setCanvasFillMode(pc.FILLMODE_NONE);
    app.setCanvasResolution(pc.RESOLUTION_AUTO);

    const fit = () => {
      const r = canvas.parentElement.getBoundingClientRect();
      app.resizeCanvas(r.width, r.height);
    };
    new ResizeObserver(fit).observe(canvas.parentElement);
    fit();
    app.start();

    // --- caméra ---
    const cam = new pc.Entity('cam');
    cam.addComponent('camera', {
      clearColor: new pc.Color(0.039, 0.055, 0.09), // #0a0e17
      fov: 55, nearClip: 0.06, farClip: 120
    });
    app.root.addChild(cam);

    // --- état orbital ---
    // bornes du scan après rotation : x [-2.15, 1.6], y [-2.65, 1.6], z [-4.3, 2.75]
    // plancher ≈ y -2.65 ; vues calibrées visuellement (captures vue_a..d)
    const HOME = { yaw: 305, pitch: 16, dist: 5.6, target: [-0.3, -0.9, -0.8] };
    const LIM = { distMin: 0.9, distMax: 12, pitchMin: -8, pitchMax: 70, box: { x: [-3.1, 2.6], y: [-2.9, 2.3], z: [-5.2, 3.7] } };
    const st = { yaw: HOME.yaw, pitch: HOME.pitch, dist: HOME.dist, target: new pc.Vec3(...HOME.target) };
    const vel = { yaw: 0, pitch: 0 };
    let fly = null, autoRotate = !!opts.autoRotate, lastInteract = 0;

    function applyCam() {
      const yr = st.yaw * Math.PI / 180, pr = st.pitch * Math.PI / 180, cp = Math.cos(pr);
      cam.setPosition(
        st.target.x + st.dist * cp * Math.sin(yr),
        st.target.y + st.dist * Math.sin(pr),
        st.target.z + st.dist * cp * Math.cos(yr)
      );
      cam.lookAt(st.target);
    }

    // --- entrées ---
    let drag = null, pinch = null;
    const pointers = new Map();
    canvas.addEventListener('pointerdown', (e) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) drag = { x: e.clientX, y: e.clientY, b: e.button };
      else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) };
        drag = null;
      }
      canvas.setPointerCapture(e.pointerId);
      lastInteract = performance.now(); fly = null;
    });
    canvas.addEventListener('pointermove', (e) => {
      const p = pointers.get(e.pointerId);
      if (!p) return;
      p.x = e.clientX; p.y = e.clientY;
      if (pinch && pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        st.dist = clamp(st.dist * (pinch.d / d), LIM.distMin, LIM.distMax);
        pinch.d = d; applyCam(); return;
      }
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      drag.x = e.clientX; drag.y = e.clientY;
      if (drag.b === 2 || drag.b === 1) {
        const right = cam.right.clone().mulScalar(-dx * st.dist * 0.0014);
        const up = cam.up.clone().mulScalar(dy * st.dist * 0.0014);
        st.target.add(right).add(up);
        st.target.x = clamp(st.target.x, ...LIM.box.x);
        st.target.y = clamp(st.target.y, ...LIM.box.y);
        st.target.z = clamp(st.target.z, ...LIM.box.z);
      } else {
        vel.yaw = -dx * 0.28; vel.pitch = -dy * 0.28;
        st.yaw += vel.yaw; st.pitch = clamp(st.pitch + vel.pitch, LIM.pitchMin, LIM.pitchMax);
      }
      lastInteract = performance.now();
      applyCam();
    });
    const endPointer = (e) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
      if (pointers.size === 0) drag = null;
    };
    canvas.addEventListener('pointerup', endPointer);
    canvas.addEventListener('pointercancel', endPointer);
    canvas.addEventListener('wheel', (e) => {
      st.dist = clamp(st.dist * (e.deltaY > 0 ? 1.1 : 0.9), LIM.distMin, LIM.distMax);
      lastInteract = performance.now(); fly = null;
      applyCam(); e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('dblclick', () => api.flyTo(HOME, 900));

    // --- boucle : inertie, auto-rotation, vols de caméra, hotspots ---
    app.on('update', (dt) => {
      if (fly) {
        const t = clamp((performance.now() - fly.t0) / fly.ms, 0, 1);
        const k = easeInOut(t);
        st.yaw = fly.from.yaw + (fly.to.yaw - fly.from.yaw) * k;
        st.pitch = fly.from.pitch + (fly.to.pitch - fly.from.pitch) * k;
        st.dist = fly.from.dist + (fly.to.dist - fly.from.dist) * k;
        st.target.lerp(fly.fromT, fly.toT, k);
        if (t >= 1) { const done = fly.done; fly = null; done && done(); }
        applyCam();
      } else if (!drag && !pinch) {
        // inertie
        if (Math.abs(vel.yaw) > 0.01 || Math.abs(vel.pitch) > 0.01) {
          vel.yaw *= 0.92; vel.pitch *= 0.92;
          st.yaw += vel.yaw; st.pitch = clamp(st.pitch + vel.pitch, LIM.pitchMin, LIM.pitchMax);
          applyCam();
        } else if (autoRotate && performance.now() - lastInteract > 4000) {
          st.yaw += dt * 4; applyCam();
        }
      }
      projectHotspots();
    });

    // pause hors écran / onglet caché
    let visible = true;
    const io = new IntersectionObserver(([en]) => {
      visible = en.isIntersecting;
      app.timeScale = visible ? 1 : 0;
      app.autoRender = visible;
    });
    io.observe(canvas);
    document.addEventListener('visibilitychange', () => {
      app.autoRender = !document.hidden && visible;
    });

    // --- hotspots ---
    let hotspots = [];
    const hsEls = new Map();
    function setHotspots(list) {
      hotspots = list || [];
      hsEls.forEach(el => el.remove());
      hsEls.clear();
      if (!overlay) return;
      for (const h of hotspots) {
        const el = document.createElement('button');
        el.className = 'hs';
        el.dataset.id = h.id;
        el.setAttribute('aria-label', h.label);
        el.innerHTML = `<span class="hs-dot"><span class="hs-n">${h.num ?? ''}</span></span><span class="hs-lb">${h.label}</span>`;
        el.addEventListener('click', (e) => { e.stopPropagation(); emit('select', h.id, h); });
        overlay.appendChild(el);
        hsEls.set(h.id, el);
      }
    }
    const v3 = new pc.Vec3();
    function projectHotspots() {
      if (!overlay || !hotspots.length) return;
      const dev = app.graphicsDevice;
      const w = dev.width / dev.maxPixelRatio, hgt = dev.height / dev.maxPixelRatio;
      const camPos = cam.getPosition();
      for (const h of hotspots) {
        const el = hsEls.get(h.id);
        if (!el) continue;
        cam.camera.worldToScreen(new pc.Vec3(...h.pos), v3);
        const behind = v3.z < 0;
        const sx = v3.x / dev.maxPixelRatio, sy = v3.y / dev.maxPixelRatio;
        const out = behind || sx < -40 || sx > w + 40 || sy < -40 || sy > hgt + 40;
        el.style.opacity = out ? '0' : '1';
        el.style.pointerEvents = out ? 'none' : 'auto';
        if (!out) {
          el.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px)`;
          const d = camPos.distance(new pc.Vec3(...h.pos));
          el.style.zIndex = String(1000 - Math.round(d * 10));
        }
      }
    }

    // --- sonde dev ---
    let probeEnt = null;
    function probe(x, y, z) {
      if (!probeEnt) {
        probeEnt = new pc.Entity('probe');
        probeEnt.addComponent('render', { type: 'sphere' });
        const m = new pc.StandardMaterial();
        m.emissive = new pc.Color(1, 0.1, 0.1); m.update();
        probeEnt.render.material = m;
        probeEnt.setLocalScale(0.07, 0.07, 0.07);
        app.root.addChild(probeEnt);
      }
      probeEnt.enabled = true;
      probeEnt.setPosition(x, y, z);
      return 'ok';
    }

    // --- disque de sol : comble les trous du plancher scanné ---
    // texture radiale : gravier sombre au centre, fondu vers la couleur de fond
    if (opts.ground !== false) {
      const gc = document.createElement('canvas');
      gc.width = gc.height = 512;
      const gctx = gc.getContext('2d');
      const grad = gctx.createRadialGradient(256, 256, 0, 256, 256, 256);
      grad.addColorStop(0, 'rgb(64,60,53)');
      grad.addColorStop(0.45, 'rgb(46,43,38)');
      grad.addColorStop(0.78, 'rgb(20,22,28)');
      grad.addColorStop(1, 'rgb(10,14,23)'); // #0a0e17
      gctx.fillStyle = grad;
      gctx.fillRect(0, 0, 512, 512);
      const gtex = new pc.Texture(app.graphicsDevice, { width: 512, height: 512, format: pc.PIXELFORMAT_RGBA8 });
      gtex.setSource(gc);
      const gmat = new pc.StandardMaterial();
      gmat.diffuse = new pc.Color(0, 0, 0);
      gmat.emissiveMap = gtex;
      gmat.emissive = new pc.Color(1, 1, 1);
      gmat.update();
      const ground = new pc.Entity('ground');
      ground.addComponent('render', { type: 'plane' });
      ground.render.meshInstances.forEach(mi => { mi.material = gmat; });
      ground.setLocalScale(13, 1, 13);
      ground.setPosition(-0.3, -2.74, -0.8);
      app.root.addChild(ground);
    }

    // --- chargement du splat ---
    const quality = pickQuality(opts.quality);
    const url = opts.src || FILES[quality];
    const asset = new pc.Asset('rodbot', 'gsplat', { url });
    app.assets.add(asset);
    const ready = new Promise((resolve, reject) => {
      asset.on('progress', (rec, tot) => emit('progress', tot ? rec / tot : 0));
      asset.on('load', () => {
        const ent = new pc.Entity('rodbot');
        ent.addComponent('gsplat', { asset });
        ent.setEulerAngles(...MODEL_ROT);
        app.root.addChild(ent);
        emit('ready');
        resolve();
      });
      asset.on('error', (err) => { emit('error', err); reject(new Error(String(err))); });
    });
    app.assets.load(asset);

    applyCam();

    // --- API publique ---
    const api = {
      app, camera: cam, quality,
      ready,
      on(ev, f) { (listeners[ev] = listeners[ev] || []).push(f); return api; },
      flyTo(view, ms = 1100) {
        return new Promise((resolve) => {
          // chemin yaw le plus court
          let toYaw = view.yaw ?? st.yaw;
          const dy = ((toYaw - st.yaw) % 360 + 540) % 360 - 180;
          toYaw = st.yaw + dy;
          fly = {
            t0: performance.now(), ms,
            from: { yaw: st.yaw, pitch: st.pitch, dist: st.dist },
            to: { yaw: toYaw, pitch: view.pitch ?? st.pitch, dist: view.dist ?? st.dist },
            fromT: st.target.clone(),
            toT: view.target ? new pc.Vec3(...view.target) : st.target.clone(),
            done: resolve
          };
        });
      },
      home(ms = 900) { return api.flyTo(HOME, ms); },
      setHotspots,
      setAutoRotate(b) { autoRotate = b; },
      getView() { return { yaw: +st.yaw.toFixed(1), pitch: +st.pitch.toFixed(1), dist: +st.dist.toFixed(2), target: [+st.target.x.toFixed(2), +st.target.y.toFixed(2), +st.target.z.toFixed(2)] }; },
      probe, probeOff() { if (probeEnt) probeEnt.enabled = false; },
      destroy() { io.disconnect(); app.destroy(); }
    };
    return api;
  }
};
export default RodbotViewer;
