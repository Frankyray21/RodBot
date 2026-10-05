/* LP RodBot, vue éclatée 3D.
 * Modèle construit par code (dossier asm/) d'après les dessins du manuel de pièces PM10654 R0.
 * Navigation : la machine (repères de la p. 8), puis chaque ensemble ouvert en détail
 * (repères de sa propre nomenclature). Seuls les enfants du niveau ouvert s'écartent.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { finalize } from './kit.js';
import { ASSEMBLIES } from './asm/index.js';
import { BY_NUM } from './bom.js';

const HDR_URL = new URL('../assets/warehouse-v5.hdr', import.meta.url).href;
const MANUAL_DIR = new URL('./manuel/', import.meta.url).href;
const $ = (s) => document.querySelector(s);

/* ---------------- Textes ---------------- */
const TXT = {
  fr: {
    training: 'Formation', replica: 'Réplique 3D', eyebrow: 'Version à vérifier, non publiée', h1: 'Vue éclatée',
    intro: 'Chaque pièce porte le numéro du manuel de pièces. Touche une pièce pour voir sa nomenclature.',
    explode: 'Éclater', play: 'Éclater', gather: 'Rassembler', loading: 'Construction du modèle 3D',
    legend: 'Ensembles', parts: 'Pièces et sous-ensembles', options: 'Affichage', quality: 'Rendu réaliste', spin: 'Rotation lente',
    source: 'ℹ️ Modèle neuf, construit d\'après les dessins du manuel de pièces PM10654 R0 (MEDATECH Borterra). Les formes cachées ou non cotées sont estimées. ⚠️ Pièce de rechange critique (p. 85).',
    close: 'Fermer', machine: 'Machine', balloonsTip: 'Afficher ou cacher les repères', homeTip: 'Recentrer la vue',
    machineTitle: 'LP RodBot complet', machineLede: '👉 Touche un ensemble pour voir sa nomenclature. Ouvre-le pour voir ses pièces.',
    detailLede: '👉 Touche une pièce. Glisse le curseur pour écarter les pièces.',
    item: 'Repère', pn: 'N° de pièce', qty: 'Quantité', section: 'Section', page: 'Page du manuel', desc: 'Description (manuel)',
    open: 'Voir en détail', manual: 'Voir la page du manuel', spare: '⚠️ Rechange critique', approx: 'Forme estimée',
    bomOf: 'Nomenclature', noBom: 'Pas de tableau dans le manuel pour cet élément.', loadingMod: 'Ensemble', missing: 'manquant',
    pageShort: 'p.', ready: 'Prêt', hint3d: 'Glisse pour tourner. Pince ou molette pour zoomer.', notInBom: 'Hors nomenclature',
    loadError: 'Le modèle 3D ne peut pas s\'afficher. Recharge la page.', backTo: 'Retour',
  },
  en: {
    training: 'Training', replica: '3D replica', eyebrow: 'Review version, not published', h1: 'Exploded view',
    intro: 'Each part carries its parts manual number. Tap a part to see its bill of materials.',
    explode: 'Explode', play: 'Explode', gather: 'Assemble', loading: 'Building the 3D model',
    legend: 'Assemblies', parts: 'Parts and sub-assemblies', options: 'Display', quality: 'Realistic rendering', spin: 'Slow spin',
    source: 'ℹ️ New model built from the drawings of parts manual PM10654 R0 (MEDATECH Borterra). Hidden or undimensioned shapes are estimated. ⚠️ Critical spare part (p. 85).',
    close: 'Close', machine: 'Machine', balloonsTip: 'Show or hide the callouts', homeTip: 'Reset the view',
    machineTitle: 'Complete LP RodBot', machineLede: '👉 Tap an assembly to see its parts list. Open it to see its parts.',
    detailLede: '👉 Tap a part. Move the slider to spread the parts.',
    item: 'Item', pn: 'Part number', qty: 'Quantity', section: 'Section', page: 'Manual page', desc: 'Description (manual)',
    open: 'Open in detail', manual: 'Show the manual page', spare: '⚠️ Critical spare', approx: 'Estimated shape',
    bomOf: 'Bill of materials', noBom: 'No table in the manual for this item.', loadingMod: 'Assembly', missing: 'missing',
    pageShort: 'p.', ready: 'Ready', hint3d: 'Drag to rotate. Pinch or scroll to zoom.', notInBom: 'Not in the BOM',
    loadError: 'The 3D model cannot be displayed. Reload the page.', backTo: 'Back',
  },
};
let lang = 'fr';
try { const s = localStorage.getItem('eclate-lang'); if (s === 'en' || s === 'fr') lang = s; } catch (e) { /* stockage indisponible */ }
const t = (k) => TXT[lang][k] ?? TXT.fr[k] ?? k;

/* Déplacements des ensembles de 1er niveau (machine), en mètres à 100 %. Rien ne descend sous le sol. */
const EX1 = {
  frame: [0, 0, 0], tub: [0.35, 0.75, 0], rods: [0.35, 1.25, 0], pedestal: [-0.55, 0.55, 0],
  lowerCrane: [-0.55, 1.3, 0], gripper: [0.75, 1.35, 0], panel24: [-0.55, 0.55, -0.75], panelMount: [-0.55, 0.55, -0.42],
  flexCover: [-0.55, 0.85, -1.05], decals: [-0.55, 0.55, -0.2], powerSupply: [0, 0, 0.55], tetherBulkhead: [0, 0, 0.55],
  cableKit: [0, 0, 0.55], rcTripod: [-0.45, 0, 0.5], radioRemote: [-0.45, 0.5, 0.5], tether: [-0.7, 0, -0.35],
};

/* ---------------- Rendu ---------------- */
const view = $('#view'), canvas = $('#c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene(); scene.background = new THREE.Color('#e3e4e1');
const camera = new THREE.PerspectiveCamera(32, 1, 0.02, 80);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = 0.09; controls.minDistance = 0.2; controls.maxDistance = 16;
controls.maxPolarAngle = Math.PI * 0.495; controls.autoRotateSpeed = 0.6;
const key = new THREE.DirectionalLight('#ffffff', 2.1); key.position.set(-3.2, 6.5, 4.2); key.castShadow = true;
key.shadow.bias = -0.0003; key.shadow.normalBias = 0.02; scene.add(key); scene.add(key.target);
const fill = new THREE.DirectionalLight('#dfe8ff', 0.45); fill.position.set(4, 3, -5); scene.add(fill);
const ground = new THREE.Mesh(new THREE.CircleGeometry(30, 72), new THREE.ShadowMaterial({ opacity: 0.26 }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

const mobile = matchMedia('(max-width: 820px)').matches || (navigator.maxTouchPoints > 0 && Math.min(screen.width, screen.height) < 820);
const qualityBox = $('#oQuality'); qualityBox.checked = !mobile;
let composer = null, gtao = null;
function buildComposer() {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
  composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  gtao = new GTAOPass(scene, camera, size.x, size.y);
  gtao.updateGtaoMaterial({ radius: 0.18, distanceExponent: 1.4, thickness: 1.2, scale: 1.0, samples: 12 });
  gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
  gtao.blendIntensity = 0.9;
  composer.addPass(gtao); composer.addPass(new OutputPass());
}

/* ---------------- État ---------------- */
const root = new THREE.Group(); scene.add(root);
let nodes = [], tops = [];
let focus = null, sel = null;
let tCur = 0, tGoal = 0, tFrom = 0, tStart = 0, tDur = 0;
let showBalloons = true, dirty = true, manualOK = false;
let camTween = null;
const highlightCache = new Map();

const isNode = (o) => o && o.userData && (o.userData.type === 'asm' || o.userData.type === 'part');
function nameOf(n, l = lang) {
  const u = n.userData; const s = u.sec && u.type === 'asm' ? BY_NUM[u.sec] : null;
  return (l === 'en' ? (u.en || (s && s.en)) : (u.fr || (s && s.fr))) || u.fr || u.en || u.pn || u.id;
}
function kidsOf(f) { return f ? f.userData.kids : tops; }
function sortKids(list) {
  const k = (n) => { const v = parseFloat(n.userData.item); return Number.isFinite(v) ? v : 999; };
  return list.slice().sort((a, b) => k(a) - k(b) || nameOf(a).localeCompare(nameOf(b)));
}
function exOf(n) {
  const v = n.userData.parentNode ? n.userData.explode : (EX1[n.userData.id] || n.userData.explode);
  return v ? new THREE.Vector3(...v) : new THREE.Vector3();
}
function ancestors(n) { const a = []; let p = n.userData.parentNode; while (p) { a.unshift(p); p = p.userData.parentNode; } return a; }
function within(n, f) { let p = n; while (p) { if (p === f) return true; p = p.userData.parentNode; } return false; }

/* ---------------- Chargement ---------------- */
async function load() {
  const bar = $('#loadBar'), txt = $('#loadTxt');
  const missing = [];
  const only = new URLSearchParams(location.search).get('asm');
  const LIST = only ? only.split(',') : ASSEMBLIES;
  for (let i = 0; i < LIST.length; i++) {
    const name = LIST[i];
    txt.textContent = `${t('loadingMod')} ${i + 1} / ${LIST.length}`;
    bar.value = Math.round(100 * i / (LIST.length + 1));
    await new Promise(r => setTimeout(r, 0));
    try {
      const mod = await import(`./asm/${name}.js`);
      [].concat(mod.build()).forEach(o => root.add(o));
    } catch (e) { console.error('Ensemble', name, e); missing.push(name); }
  }
  txt.textContent = '…'; bar.value = 92; await new Promise(r => setTimeout(r, 0));
  const st = finalize(root);
  root.updateMatrixWorld(true);
  // arbre
  root.traverse(o => { if (isNode(o)) nodes.push(o); });
  for (const n of nodes) {
    let p = n.parent; while (p && !isNode(p)) p = p.parent;
    n.userData.parentNode = isNode(p) ? p : null; n.userData.kids = [];
  }
  for (const n of nodes) if (n.userData.parentNode) n.userData.parentNode.userData.kids.push(n);
  tops = nodes.filter(n => !n.userData.parentNode);
  for (const n of nodes) {
    n.userData.kids = sortKids(n.userData.kids);
    n.userData.base = n.position.clone();
    const b = new THREE.Box3().setFromObject(n); n.userData.box0 = b;
    const c = n.userData.anchor ? n.localToWorld(new THREE.Vector3(...n.userData.anchor)) : b.getCenter(new THREE.Vector3());
    n.userData.anchorLocal = n.worldToLocal(c.clone());
  }
  tops = sortKids(tops);
  root.traverse(o => { if (o.isMesh) { o.userData.baseMat = o.material; } });
  const all = new THREE.Box3().setFromObject(root);
  const sz = all.getSize(new THREE.Vector3()).length();
  Object.assign(key.shadow.camera, { left: -sz, right: sz, top: sz, bottom: -sz, near: 0.5, far: 30 });
  key.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
  window.__eclate = { ready: true, stats: st, missing, setFocus: (id) => setFocus(id ? nodes.find(n => n.userData.id === id) : null), setT: (v) => { tCur = tGoal = v; tDur = 0; apply(); syncSlider(v); dirty = true; }, select: (id) => select(nodes.find(n => n.userData.id === id) || null), nodes: () => nodes.map(n => ({ id: n.userData.id, sec: n.userData.sec, item: n.userData.item, pn: n.userData.pn, depth: ancestors(n).length, kids: n.userData.kids.length })) };
  $('#loading').hidden = true;
  setFocus(null, true);
}

/* ---------------- Éclatement ---------------- */
const tmpQ = new THREE.Quaternion();
function worldVec(n, v) { const p = n.parent; if (!p) return v.clone(); p.getWorldQuaternion(tmpQ); return v.clone().applyQuaternion(tmpQ); }
function localVec(n, wv) { const p = n.parent; if (!p) return wv.clone(); p.getWorldQuaternion(tmpQ); return wv.clone().applyQuaternion(tmpQ.invert()); }
function liftFor(f) {
  // remonte l'ensemble ouvert pour que ses pièces éclatées restent au-dessus du sol
  if (!f) return 0; let minY = Infinity;
  for (const k of f.userData.kids) { const w = worldVec(k, exOf(k)); minY = Math.min(minY, k.userData.box0.min.y + w.y); }
  minY = Math.min(minY, f.userData.box0.min.y);
  return Math.max(0, 0.03 - minY);
}
function apply() {
  for (const n of nodes) n.position.copy(n.userData.base);
  const kids = kidsOf(focus);
  for (const k of kids) k.position.addScaledVector(exOf(k), tCur);
  if (focus) { const lift = focus.userData.lift * tCur; focus.position.add(localVec(focus, new THREE.Vector3(0, lift, 0))); }
  root.updateMatrixWorld(true);
}
const CORE = new Set(['frame', 'pedestal', 'tub', 'rods', 'lowerCrane', 'gripper', 'panel24', 'panelMount', 'flexCover', 'decals', 'decalLP']);
function targetBox(f, tt, forCamera = false) {
  const box = new THREE.Box3(); let kids = kidsOf(f);
  if (!f && forCamera && kids.some(k => CORE.has(k.userData.id))) kids = kids.filter(k => CORE.has(k.userData.id));
  const lift = f ? f.userData.lift * tt : 0;
  for (const k of kids) {
    const w = worldVec(k, exOf(k)).multiplyScalar(tt); w.y += lift;
    const b = k.userData.box0.clone(); b.min.add(w); b.max.add(w); box.union(b);
  }
  if (f && !kids.length) box.copy(f.userData.box0);
  return box;
}
function animateT(goal, ms = 900) { tFrom = tCur; tGoal = goal; tStart = performance.now(); tDur = ms; syncSlider(goal); }

/* ---------------- Caméra ---------------- */
function frame(box, ms = 800, dirOverride) {
  // distance minimale pour que les 8 coins de la boîte tiennent dans l'image (marges pour les barres)
  const c = box.getCenter(new THREE.Vector3());
  const dir = dirOverride ? dirOverride.clone().normalize() : camera.position.clone().sub(controls.target).normalize();
  const corners = []; for (let i = 0; i < 8; i++) corners.push(new THREE.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z));
  const cam = camera.clone(); const mx = 0.9, myTop = 0.78, myBot = 0.7;
  const fits = (d) => { cam.position.copy(c).addScaledVector(dir, d); cam.lookAt(c); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
    for (const k of corners) { const p = k.clone().project(cam); if (p.z > 1 || Math.abs(p.x) > mx || p.y > myTop || p.y < -myBot) return false; } return true; };
  let lo = 0.1, hi = 40; for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; if (fits(mid)) hi = mid; else lo = mid; }
  camTween = { p0: camera.position.clone(), t0: controls.target.clone(), p1: c.clone().addScaledVector(dir, hi), t1: c, s: performance.now(), d: ms };
  if (ms === 0) { camera.position.copy(camTween.p1); controls.target.copy(camTween.t1); camTween = null; }
}
const HOME_DIR = new THREE.Vector3(0.62, 0.48, -0.62); // comme la vue CAO p. 7 : côté bac et panneau 24 V

/* ---------------- Sélection et visibilité ---------------- */
function hiMat(m) {
  if (!highlightCache.has(m)) { const h = m.clone(); h.emissive = new THREE.Color('#ff2030'); h.emissiveIntensity = 0.32; highlightCache.set(m, h); }
  return highlightCache.get(m);
}
function refreshMeshes() {
  root.traverse(o => {
    if (!o.isMesh) return; const own = o.userData.owner;
    o.visible = !focus || within(own, focus);
    o.material = sel && within(own, sel) ? hiMat(o.userData.baseMat) : o.userData.baseMat;
  });
  dirty = true;
}
function setFocus(n, instant = false) {
  if (n && !n.userData.kids.length) { select(n); return; }
  focus = n; sel = null;
  if (focus && focus.userData.lift === undefined) focus.userData.lift = liftFor(focus);
  refreshMeshes(); buildBalloons(); renderPanel();
  const goal = focus ? (tGoal > 0.05 ? tGoal : 1) : tGoal;
  if (instant) { tCur = goal; apply(); frame(targetBox(focus, goal, true), 0, HOME_DIR); syncSlider(goal); }
  else { animateT(goal, 900); frame(targetBox(focus, goal, true), 900); }
}
function select(n) {
  sel = n; refreshMeshes(); renderPanel(); updateBalloonState();
}

/* ---------------- Repères (bulles) ---------------- */
const balloonsEl = $('#balloons'), leadersEl = $('#leaders');
let balloons = [];
function buildBalloons() {
  balloonsEl.textContent = ''; leadersEl.textContent = ''; balloons = [];
  for (const k of kidsOf(focus)) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'balloon';
    b.textContent = k.userData.item ?? '•'; b.setAttribute('aria-label', `${k.userData.item ? t('item') + ' ' + k.userData.item + ', ' : ''}${nameOf(k)}`);
    b.title = nameOf(k);
    b.addEventListener('click', () => select(k));
    b.addEventListener('dblclick', () => setFocus(k));
    balloonsEl.appendChild(b);
    const ln = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle'); dot.setAttribute('r', '2.6');
    leadersEl.append(ln, dot);
    balloons.push({ node: k, el: b, ln, dot, x: null, y: null });
  }
  updateBalloonState();
}
function updateBalloonState() { for (const b of balloons) { b.el.setAttribute('aria-pressed', String(b.node === sel)); b.el.classList.toggle('dim', !!sel && b.node !== sel); } }
const v3 = new THREE.Vector3();
function layoutBalloons() {
  const W = view.clientWidth, H = view.clientHeight;
  balloonsEl.hidden = false; leadersEl.style.display = '';
  if (!showBalloons || !balloons.length) { balloonsEl.hidden = true; leadersEl.style.display = 'none'; return; }
  const top = 58, bottom = 78, side = 22, R = mobile ? 44 : 64, minD = mobile ? 30 : 36;
  const box = targetBox(focus, tCur); const cw = box.getCenter(new THREE.Vector3()).project(camera);
  const cx = (cw.x + 1) / 2 * W, cy = (1 - cw.y) / 2 * H;
  const pts = balloons.map(b => {
    const a = b.node.localToWorld(v3.copy(b.node.userData.anchorLocal)).project(camera);
    const ax = (a.x + 1) / 2 * W, ay = (1 - a.y) / 2 * H, behind = a.z > 1;
    let dx = ax - cx, dy = ay - cy; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    return { b, ax, ay, behind, x: ax + dx * R, y: ay + dy * R, dx, dy };
  });
  for (let it = 0; it < 14; it++) {
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
      const p = pts[i], q = pts[j]; let dx = q.x - p.x, dy = q.y - p.y; const d = Math.hypot(dx, dy) || 0.01;
      if (d < minD) { const push = (minD - d) / 2; dx /= d; dy /= d; p.x -= dx * push; p.y -= dy * push; q.x += dx * push; q.y += dy * push; }
    }
    for (const p of pts) { p.x += (p.ax + p.dx * R - p.x) * 0.08; p.y += (p.ay + p.dy * R - p.y) * 0.08; p.x = Math.min(W - side, Math.max(side, p.x)); p.y = Math.min(H - bottom, Math.max(top, p.y)); }
  }
  for (const p of pts) {
    const b = p.b; const hide = p.behind || p.ax < -40 || p.ax > W + 40 || p.ay < -40 || p.ay > H + 40;
    b.el.hidden = hide; b.ln.style.display = b.dot.style.display = hide ? 'none' : '';
    if (hide) continue;
    b.x = b.x == null ? p.x : b.x + (p.x - b.x) * 0.5; b.y = b.y == null ? p.y : b.y + (p.y - b.y) * 0.5;
    b.el.style.transform = `translate(${b.x}px, ${b.y}px) translate(-50%, -50%)`;
    const dx = b.x - p.ax, dy = b.y - p.ay, d = Math.hypot(dx, dy) || 1, rr = 15;
    b.ln.setAttribute('x1', p.ax.toFixed(1)); b.ln.setAttribute('y1', p.ay.toFixed(1));
    b.ln.setAttribute('x2', (b.x - dx / d * rr).toFixed(1)); b.ln.setAttribute('y2', (b.y - dy / d * rr).toFixed(1));
    b.dot.setAttribute('cx', p.ax.toFixed(1)); b.dot.setAttribute('cy', p.ay.toFixed(1));
  }
}

/* ---------------- Panneau ---------------- */
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c])); }
function sectionOf(n) { const u = n.userData; return u.type === 'asm' && u.sec && BY_NUM[u.sec] ? BY_NUM[u.sec] : null; }
function parentSection(n) { let p = n.userData.parentNode; while (p) { const s = sectionOf(p); if (s) return s; p = p.userData.parentNode; } return BY_NUM['3']; }
function bomRowFor(n) {
  const s = parentSection(n); if (!s || !n.userData.item) return null;
  return s.items.find(r => r.i === String(n.userData.item) && (!n.userData.pn || r.pn === n.userData.pn)) || s.items.find(r => r.i === String(n.userData.item)) || null;
}
const SPARES = new Set((BY_NUM['17']?.items || []).map(r => r.pn));
function renderCrumbs() {
  const el = $('#crumbs'); el.textContent = '';
  const chain = [null, ...(focus ? [...ancestors(focus), focus] : [])];
  chain.forEach((n, i) => {
    if (i) { const s = document.createElement('span'); s.className = 'sep'; s.textContent = '›'; el.appendChild(s); }
    const b = document.createElement('button'); b.type = 'button'; b.textContent = n ? nameOf(n) : t('machine');
    if (n === focus) b.setAttribute('aria-current', 'true');
    b.addEventListener('click', () => setFocus(n)); el.appendChild(b);
  });
}
function renderPanel() {
  renderCrumbs();
  const f = focus, s = f ? sectionOf(f) : BY_NUM['3'];
  $('#pTitle').textContent = f ? nameOf(f) : t('machineTitle');
  const bits = [];
  if (s) bits.push(`${t('section')} ${s.num}`, s.pn, `${t('pageShort')} ${s.page}`);
  $('#pLede').textContent = (bits.length ? bits.join(' · ') + '. ' : '') + (f ? t('detailLede') : t('machineLede'));
  $('#legendTitle').textContent = f ? t('parts') : t('legend');
  const ul = $('#legend'); ul.textContent = '';
  for (const k of kidsOf(f)) {
    const li = document.createElement('li');
    const row = document.createElement('button'); row.type = 'button'; row.className = 'row'; row.setAttribute('aria-pressed', String(k === sel));
    const u = k.userData; const meta = [u.pn, u.qty && u.qty !== '1' ? `x${u.qty}` : ''].filter(Boolean).join(' · ') || (u.note || '');
    row.innerHTML = `<span class="num">${esc(u.item ?? '•')}</span><span><span class="rname">${esc(nameOf(k))}</span><span class="rmeta">${esc(meta)}</span></span><span class="qty">${SPARES.has(u.pn) || u.spare ? '⚠️' : ''}</span>`;
    row.addEventListener('click', () => select(k));
    row.addEventListener('dblclick', () => setFocus(k));
    li.appendChild(row);
    if (k.userData.kids.length) { const o = document.createElement('button'); o.type = 'button'; o.className = 'open'; o.textContent = '›'; o.title = t('open'); o.setAttribute('aria-label', `${t('open')} : ${nameOf(k)}`); o.addEventListener('click', () => setFocus(k)); li.appendChild(o); }
    ul.appendChild(li);
  }
  renderCard();
}
function renderCard() {
  const card = $('#card');
  const n = sel || focus; if (!n) { card.hidden = true; return; }
  card.hidden = false;
  const u = n.userData; const row = bomRowFor(n); const s = sectionOf(n);
  const other = nameOf(n, lang === 'fr' ? 'en' : 'fr');
  const spare = SPARES.has(u.pn) || u.spare; const page = s ? s.page : (u.page || parentSection(n)?.page);
  let h = `<div><div class="title">${esc(nameOf(n))}</div><div class="sub">${esc(other)}</div></div>`;
  const chips = []; if (spare) chips.push(`<span class="chip spare">${t('spare')}</span>`); if (u.approx) chips.push(`<span class="chip approx">${t('approx')}</span>`);
  if (!u.pn && !row && !s) chips.push(`<span class="chip approx">${t('notInBom')}</span>`);
  if (chips.length) h += `<div class="chips">${chips.join('')}</div>`;
  h += '<dl class="facts">';
  if (u.item) h += `<dt>${t('item')}</dt><dd>${esc(u.item)}</dd>`;
  if (u.pn) h += `<dt>${t('pn')}</dt><dd>${esc(u.pn)}</dd>`;
  const q = row ? row.q : u.qty; if (q) h += `<dt>${t('qty')}</dt><dd>${esc(q)}</dd>`;
  if (row) h += `<dt>${t('desc')}</dt><dd>${esc(row.d)}</dd>`; else if (s) h += `<dt>${t('desc')}</dt><dd>${esc(s.title)}</dd>`;
  if (s) h += `<dt>${t('section')}</dt><dd>${esc(s.num)}</dd>`;
  if (page) h += `<dt>${t('page')}</dt><dd>${esc(page)}</dd>`;
  if (u.note) h += `<dt>ℹ️</dt><dd>${esc(u.note)}</dd>`;
  h += '</dl><div class="actions">';
  if (n !== focus && u.kids.length) h += `<button class="btn primary" type="button" data-act="open">${t('open')} ›</button>`;
  if (manualOK && page) h += `<button class="btn" type="button" data-act="manual">${t('manual')}</button>`;
  h += '</div>';
  const table = s || (n === sel ? null : null);
  if (table) {
    const kidItems = new Set(u.kids.map(k => String(k.userData.item)));
    h += `<div><h3>${t('bomOf')} ${esc(table.num)} · ${esc(table.pn)}</h3><div class="bom"><table><thead><tr><th>#</th><th>${t('pn')}</th><th>Description</th><th>${t('qty')}</th></tr></thead><tbody>`;
    for (const r of table.items) h += `<tr class="${kidItems.has(r.i) ? '' : ''}${SPARES.has(r.pn) ? ' spare' : ''}"><td>${esc(r.i)}</td><td class="pn">${esc(r.pn)}</td><td>${esc(r.d)}</td><td>${esc(r.q)}</td></tr>`;
    h += '</tbody></table></div></div>';
  } else if (row) {
    const ps = parentSection(n);
    h += `<div><h3>${t('bomOf')} ${esc(ps.num)} · ${esc(ps.pn)}</h3><div class="bom"><table><thead><tr><th>#</th><th>${t('pn')}</th><th>Description</th><th>${t('qty')}</th></tr></thead><tbody>`;
    for (const r of ps.items) h += `<tr class="${r === row ? 'hit' : ''}${SPARES.has(r.pn) ? ' spare' : ''}"><td>${esc(r.i)}</td><td class="pn">${esc(r.pn)}</td><td>${esc(r.d)}</td><td>${esc(r.q)}</td></tr>`;
    h += '</tbody></table></div></div>';
  }
  card.innerHTML = h;
  card.querySelector('[data-act=open]')?.addEventListener('click', () => setFocus(n));
  card.querySelector('[data-act=manual]')?.addEventListener('click', () => openManual(n));
}

/* ---------------- Pages du manuel (aperçu privé seulement) ---------------- */
function pagesFor(n) {
  const s = sectionOf(n) || parentSection(n); const ps = new Set();
  if (s) { ps.add(s.page); (s.tp || []).forEach(p => ps.add(p)); }
  else if (n.userData.page) ps.add(n.userData.page);
  return [...ps].sort((a, b) => a - b);
}
function openManual(n) {
  const pages = pagesFor(n); if (!pages.length) return;
  const show = (p) => { $('#sheetImg').src = `${MANUAL_DIR}p${String(p).padStart(3, '0')}.jpg`; $('#sheetImg').alt = `PM10654 ${t('pageShort')} ${p}`; $('#sheetTitle').textContent = `PM10654 · ${t('pageShort')} ${p}`; [...$('#sheetPages').children].forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.p === p))); };
  const pg = $('#sheetPages'); pg.textContent = '';
  pages.forEach(p => { const b = document.createElement('button'); b.type = 'button'; b.className = 'tool'; b.dataset.p = p; b.textContent = p; b.addEventListener('click', () => show(p)); pg.appendChild(b); });
  show(pages[0]); $('#sheet').hidden = false; $('#sheetClose').focus();
}
$('#sheetClose').addEventListener('click', () => { $('#sheet').hidden = true; });
$('#sheet').addEventListener('click', (e) => { if (e.target.id === 'sheet') $('#sheet').hidden = true; });

/* ---------------- Interactions ---------------- */
const ex = $('#ex'), exOut = $('#exOut'), exPlay = $('#exPlay');
function syncSlider(v) { ex.value = Math.round(v * 100); exOut.textContent = `${Math.round(v * 100)} %`; exPlay.textContent = v > 0.5 ? t('gather') : t('play'); }
ex.addEventListener('input', () => { tCur = tGoal = ex.value / 100; tDur = 0; apply(); exOut.textContent = `${ex.value} %`; exPlay.textContent = tGoal > 0.5 ? t('gather') : t('play'); dirty = true; });
exPlay.addEventListener('click', () => animateT(tGoal > 0.5 ? 0 : 1));
$('#tBalloons').addEventListener('click', (e) => { showBalloons = !showBalloons; e.currentTarget.setAttribute('aria-pressed', String(showBalloons)); dirty = true; });
$('#tHome').addEventListener('click', () => frame(targetBox(focus, tGoal, true), 700, HOME_DIR));
qualityBox.addEventListener('change', () => { dirty = true; });
$('#oSpin').addEventListener('change', (e) => { controls.autoRotate = e.target.checked; });
const ray = new THREE.Raycaster(); let down = null;
canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, time: performance.now() }; });
let lastTap = { n: null, time: 0 };
canvas.addEventListener('pointerup', (e) => {
  if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) { down = null; return; } down = null;
  const r = canvas.getBoundingClientRect();
  ray.setFromCamera(new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1), camera);
  const hits = ray.intersectObjects(root.children, true).filter(h => h.object.visible && h.object.isMesh);
  if (!hits.length) { select(null); return; }
  let n = hits[0].object.userData.owner; while (n && n.userData.parentNode !== focus) n = n.userData.parentNode;
  if (!n) return;
  const now = performance.now();
  if (lastTap.n === n && now - lastTap.time < 380 && n.userData.kids.length) { setFocus(n); lastTap = { n: null, time: 0 }; return; }
  lastTap = { n, time: now }; select(n);
});
addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!$('#sheet').hidden) { $('#sheet').hidden = true; return; }
  if (sel) { select(null); return; }
  if (focus) setFocus(focus.userData.parentNode);
});
controls.addEventListener('change', () => { dirty = true; });

/* Langue */
function applyLang() {
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = t(el.dataset.i18nTitle); el.setAttribute('aria-label', t(el.dataset.i18nTitle)); });
  document.querySelectorAll('[data-lang]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
  canvas.setAttribute('aria-label', t('hint3d'));
  syncSlider(tGoal);
  if (nodes.length) { renderPanel(); buildBalloons(); }
}
document.querySelectorAll('[data-lang]').forEach(b => b.addEventListener('click', () => { lang = b.dataset.lang; try { localStorage.setItem('eclate-lang', lang); } catch (e) { /* stockage indisponible */ } applyLang(); }));

/* ---------------- Boucle ---------------- */
function resize() {
  const w = view.clientWidth, h = view.clientHeight; if (!w || !h) return;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  if (composer) { composer.setSize(w, h); } dirty = true;
}
new ResizeObserver(resize).observe(view);
const ease = (x) => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
function loop(now) {
  requestAnimationFrame(loop);
  if (tDur > 0) { const k = Math.min(1, (now - tStart) / tDur); tCur = tFrom + (tGoal - tFrom) * ease(k); apply(); dirty = true; if (k >= 1) tDur = 0; }
  if (camTween) { const k = Math.min(1, (now - camTween.s) / camTween.d), e = ease(k); camera.position.lerpVectors(camTween.p0, camTween.p1, e); controls.target.lerpVectors(camTween.t0, camTween.t1, e); dirty = true; if (k >= 1) camTween = null; }
  if (controls.update()) dirty = true;
  if (controls.autoRotate) dirty = true;
  if (!dirty) return; dirty = false;
  if (qualityBox.checked) { if (!composer) { buildComposer(); resize(); } composer.render(); } else renderer.render(scene, camera);
  layoutBalloons();
}

/* ---------------- Démarrage ---------------- */
applyLang(); resize();
fetch(`${MANUAL_DIR}p010.jpg`, { method: 'HEAD' }).then(r => { manualOK = r.ok; if (nodes.length) renderCard(); }).catch(() => { manualOK = false; });
const pmrem = new THREE.PMREMGenerator(renderer);
new HDRLoader().load(HDR_URL, (hdr) => { scene.environment = pmrem.fromEquirectangular(hdr).texture; scene.environmentIntensity = 0.9; hdr.dispose(); dirty = true; }, undefined, () => { scene.environment = null; });
requestAnimationFrame(loop);
load().catch((e) => { console.error(e); $('#loadTxt').textContent = t('loadError'); });
