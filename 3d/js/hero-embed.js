/* ============================================================
   Héros 3D interactif — page d'accueil de la formation RodBot
   Rejoue en temps réel la même trajectoire de caméra que la
   vidéo hero_rodbot (mêmes keyframes), et devient contrôlable :
   glisser = tourner, pincer = zoomer. Après 6 s d'inactivité,
   la visite guidée reprend en douceur.
   La vidéo de fond sert de couverture pendant le chargement du
   scan, puis s'efface en fondu, synchronisée au même instant.
   ============================================================ */
import * as pc from 'https://cdn.jsdelivr.net/npm/playcanvas@2.13.3/build/playcanvas.mjs';

const SOG_URL = '3d/assets/rodbot_mobile.sog';
const FOND = [0x14 / 255, 0x14 / 255, 0x13 / 255]; // #141413 (fond du héros formation)
const DUREE = 52; // secondes, boucle parfaite

/* visite complète (identique à la vidéo hero_rodbot) :
   tour 360° de la machine, puis zoom sur chaque composante —
   grappin, mât, bac, chenilles, stabilisateur, panneau électrique,
   boyaux, télécommande — et recul final. La yaw progresse en continu
   (fin ≡ début mod 360) pour une boucle sans couture. */
const KEYS = [
  { t: 0,  yaw: 305, pitch: 16, dist: 5.6, target: [-0.3, -0.9, -0.8] },   // vue d'ensemble
  { t: 6,  yaw: 485, pitch: 24, dist: 6.4, target: [-0.3, -0.9, -0.8] },   // orbite — face arrière
  { t: 12, yaw: 665, pitch: 16, dist: 5.6, target: [-0.3, -0.9, -0.8] },   // tour complet 360°
  { t: 16, yaw: 695, pitch: 18, dist: 2.9, target: [0.18, 0.31, 1.14] },   // grappin (pince)
  { t: 19, yaw: 712, pitch: 21, dist: 2.7, target: [0.18, 0.31, 1.14] },   // grappin — micro-orbite
  { t: 23, yaw: 660, pitch: 22, dist: 3.4, target: [-0.2, 0.6, -0.2] },    // mât (bras robotisé)
  { t: 27, yaw: 650, pitch: 33, dist: 3.2, target: [-0.44, -0.9, 1.3] },   // bac à tiges — plongée
  { t: 31, yaw: 615, pitch: 10, dist: 3.6, target: [-1.2, -1.5, 0.4] },    // chenilles — profil bas
  { t: 35, yaw: 650, pitch: 14, dist: 2.8, target: [-0.86, -1.5, 2.2] },   // vérin de stabilisation
  { t: 39, yaw: 645, pitch: 15, dist: 2.6, target: [-0.74, -0.35, -0.45] },// panneau électrique
  { t: 42, yaw: 640, pitch: 38, dist: 3.0, target: [-1.2, -2.1, -1.5] },   // boyaux — plongée
  { t: 46, yaw: 690, pitch: 12, dist: 2.8, target: [-0.08, -0.6, -3.0] },  // télécommande
  { t: 52, yaw: 665, pitch: 16, dist: 5.6, target: [-0.3, -0.9, -0.8] }    // recul = départ (mod 360)
];

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const lerpYaw = (a, b, k) => { const d = ((b - a) % 360 + 540) % 360 - 180; return a + d * k; };

function viewAt(ts) {
  ts = ((ts % DUREE) + DUREE) % DUREE;
  let i = 0;
  while (i < KEYS.length - 2 && ts > KEYS[i + 1].t) i++;
  const A = KEYS[i], B = KEYS[i + 1];
  const k = ease(clamp((ts - A.t) / (B.t - A.t), 0, 1));
  return {
    yaw: lerpYaw(A.yaw, B.yaw, k),
    pitch: A.pitch + (B.pitch - A.pitch) * k,
    dist: A.dist + (B.dist - A.dist) * k,
    target: A.target.map((v, j) => v + (B.target[j] - v) * k)
  };
}

let app = null, cam = null, canvas = null, hint = null, pret = false;

function monterDans(bg) {
  // le canvas s'insère SOUS le voile dégradé (le voile garde le texte lisible
  // et laisse passer les clics via pointer-events:none)
  const scrim = bg.querySelector('.rb-hero-bg-scrim');
  if (canvas) { // déjà créé (retour à l'accueil ou changement de langue) : on replace
    if (canvas.parentElement !== bg) {
      bg.insertBefore(canvas, scrim || null);
      if (hint) bg.appendChild(hint);
    }
    if (pret) bg.classList.add('rb-3d-live');
    return;
  }
  canvas = document.createElement('canvas');
  canvas.setAttribute('aria-label', 'Vue 3D interactive du RodBot — glisser pour tourner');
  bg.insertBefore(canvas, scrim || null);
  hint = document.createElement('span');
  hint.className = 'rb-hero-3d-hint';
  hint.textContent = '🖐 Glisse pour tourner la machine';
  bg.appendChild(hint);

  app = new pc.Application(canvas, {
    mouse: new pc.Mouse(canvas),
    touch: new pc.TouchDevice(canvas),
    graphicsDeviceOptions: { antialias: false, alpha: false }
  });
  const dprCap = matchMedia('(pointer: coarse)').matches ? 1.25 : 1.5;
  app.graphicsDevice.maxPixelRatio = Math.min(window.devicePixelRatio || 1, dprCap);
  app.setCanvasFillMode(pc.FILLMODE_NONE);
  app.setCanvasResolution(pc.RESOLUTION_AUTO);
  const fit = () => {
    const parent = canvas.parentElement;
    if (!parent) return;
    const r = parent.getBoundingClientRect();
    if (r.width && r.height) app.resizeCanvas(r.width, r.height);
  };
  new ResizeObserver(fit).observe(bg);
  fit();
  app.start();

  cam = new pc.Entity('cam');
  cam.addComponent('camera', {
    clearColor: new pc.Color(...FOND),
    fov: 55, nearClip: 0.06, farClip: 120
  });
  app.root.addChild(cam);

  // disque de sol : texture gravier bakée dans Blender, assombrie, fondue vers #141413 ;
  // repli : dégradé radial si la texture ne charge pas
  const gc = document.createElement('canvas');
  gc.width = gc.height = 1024;
  const gctx = gc.getContext('2d');
  const gtex = new pc.Texture(app.graphicsDevice, { width: 1024, height: 1024, format: pc.PIXELFORMAT_RGBA8 });
  const peindreSol = (imgSol) => {
    if (imgSol) {
      // harmonisation avec le plancher scanné : +6 % de luminosité, légère chaleur
      gctx.filter = 'brightness(106%)';
      gctx.drawImage(imgSol, 0, 0, 1024, 1024);
      gctx.filter = 'none';
      gctx.globalCompositeOperation = 'multiply';
      gctx.fillStyle = 'rgb(255,252,244)';
      gctx.fillRect(0, 0, 1024, 1024);
      gctx.globalCompositeOperation = 'source-over';
    } else {
      const grad = gctx.createRadialGradient(512, 512, 0, 512, 512, 512);
      grad.addColorStop(0, 'rgb(64,60,53)');
      grad.addColorStop(0.45, 'rgb(46,43,38)');
      grad.addColorStop(0.78, 'rgb(26,26,24)');
      grad.addColorStop(1, 'rgb(20,20,19)');
      gctx.fillStyle = grad;
      gctx.fillRect(0, 0, 1024, 1024);
    }
    const fondu = gctx.createRadialGradient(512, 512, 355, 512, 512, 512);
    fondu.addColorStop(0, 'rgba(20,20,19,0)');
    fondu.addColorStop(1, 'rgb(20,20,19)');
    gctx.fillStyle = fondu;
    gctx.fillRect(0, 0, 1024, 1024);
    gtex.setSource(gc);
  };
  peindreSol(null);
  const imgSol = new Image();
  imgSol.onload = () => peindreSol(imgSol);
  imgSol.src = '3d/assets/textures/sol_gravier.jpg';
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

  // --- état caméra : visite guidée / contrôle libre / retour à la visite ---
  const st = { ...viewAt(0), target: [...viewAt(0).target] };
  const LIM = { distMin: 1.8, distMax: 10, pitchMin: -8, pitchMax: 70 };
  let mode = 'tour';       // 'tour' | 'libre' | 'retour'
  let tourTime = 0;        // position dans la visite (s)
  let lastInteract = 0;
  let retour = null;       // { t0, dur, from, to }

  function applyCam() {
    const yr = st.yaw * Math.PI / 180, pr = st.pitch * Math.PI / 180, cp = Math.cos(pr);
    cam.setPosition(
      st.target[0] + st.dist * cp * Math.sin(yr),
      st.target[1] + st.dist * Math.sin(pr),
      st.target[2] + st.dist * cp * Math.cos(yr)
    );
    cam.lookAt(new pc.Vec3(...st.target));
  }

  // --- entrées : glisser = tourner, pincer = zoomer (la molette laisse défiler la page) ---
  canvas.style.touchAction = 'pan-y'; // un doigt vertical = défilement normal de la page
  let drag = null, pinch = null;
  const pointers = new Map();
  canvas.addEventListener('pointerdown', (e) => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) drag = { x: e.clientX, y: e.clientY };
    else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) };
      drag = null;
    }
    mode = 'libre'; retour = null;
    lastInteract = performance.now();
    if (hint) hint.classList.add('rb-hint-vue');
    try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* pointeur synthétique */ }
  });
  canvas.addEventListener('pointermove', (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    p.x = e.clientX; p.y = e.clientY;
    if (pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      st.dist = clamp(st.dist * (pinch.d / d), LIM.distMin, LIM.distMax);
      pinch.d = d; lastInteract = performance.now(); applyCam(); return;
    }
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.x = e.clientX; drag.y = e.clientY;
    st.yaw -= dx * 0.28;
    st.pitch = clamp(st.pitch - dy * 0.28, LIM.pitchMin, LIM.pitchMax);
    lastInteract = performance.now();
    applyCam();
  });
  const finPointeur = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (pointers.size === 0) drag = null;
  };
  canvas.addEventListener('pointerup', finPointeur);
  canvas.addEventListener('pointercancel', finPointeur);
  canvas.addEventListener('dblclick', () => { // double-clic : reprendre la visite tout de suite
    mode = 'retour';
    retour = { t0: performance.now(), dur: 1000, from: { yaw: st.yaw, pitch: st.pitch, dist: st.dist, target: [...st.target] }, to: viewAt(tourTime + 1) };
  });

  // --- boucle : visite guidée interruptible ---
  app.on('update', (dt) => {
    if (mode === 'tour') {
      tourTime += dt;
      const v = viewAt(tourTime);
      st.yaw = v.yaw; st.pitch = v.pitch; st.dist = v.dist; st.target = v.target;
      applyCam();
    } else if (mode === 'libre') {
      if (!drag && !pinch && performance.now() - lastInteract > 6000) {
        mode = 'retour';
        retour = { t0: performance.now(), dur: 1400, from: { yaw: st.yaw, pitch: st.pitch, dist: st.dist, target: [...st.target] }, to: viewAt(tourTime + 1.5) };
      }
    } else if (mode === 'retour' && retour) {
      const k = ease(clamp((performance.now() - retour.t0) / retour.dur, 0, 1));
      st.yaw = lerpYaw(retour.from.yaw, retour.to.yaw, k);
      st.pitch = retour.from.pitch + (retour.to.pitch - retour.from.pitch) * k;
      st.dist = retour.from.dist + (retour.to.dist - retour.from.dist) * k;
      st.target = retour.from.target.map((v, j) => v + (retour.to.target[j] - v) * k);
      applyCam();
      if (k >= 1) { tourTime += retour.dur / 1000 + 0.1; mode = 'tour'; retour = null; }
    }
  });

  // pause hors écran / onglet caché (page longue : le héros sort vite du viewport)
  let visible = true;
  const io = new IntersectionObserver(([en]) => {
    visible = en.isIntersecting;
    app.autoRender = visible && !document.hidden;
    app.timeScale = visible ? 1 : 0;
  });
  io.observe(canvas);
  document.addEventListener('visibilitychange', () => { app.autoRender = !document.hidden && visible; });

  // rotation du modèle : le scan est y-vers-le-bas → 180° autour de Z
  const asset = new pc.Asset('rodbot-hero', 'gsplat', { url: SOG_URL });
  app.assets.add(asset);
  asset.on('load', () => {
    const ent = new pc.Entity('rodbot');
    ent.addComponent('gsplat', { asset });
    ent.setEulerAngles(0, 0, 180);
    app.root.addChild(ent);
    // synchroniser la visite sur l'instant de la vidéo, puis fondu vidéo → 3D
    const video = document.querySelector('.rb-hero-bg video');
    tourTime = video && video.currentTime ? video.currentTime % DUREE : 0;
    pret = true;
    const bgActuel = canvas.parentElement;
    if (bgActuel) bgActuel.classList.add('rb-3d-live');
    setTimeout(() => { if (video) video.pause(); }, 1000);
  });
  asset.on('error', () => { /* le repli vidéo reste en place */ });
  app.assets.load(asset);

  applyCam();
}

/* ---------- montage : le héros est rendu par la SPA (FR/EN, retours accueil) ---------- */
if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const attacher = () => {
    const bg = document.querySelector('.rb-hero-bg');
    if (!bg) return;
    if (canvas && canvas.parentElement === bg) return;
    try { monterDans(bg); } catch (e) { console.error('Héros 3D indisponible :', e); }
  };
  new MutationObserver(attacher).observe(document.body, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attacher);
  else attacher();
}
