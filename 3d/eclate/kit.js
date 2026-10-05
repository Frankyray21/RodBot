/* RodBot LP, vue éclatée : boîte à outils de modélisation procédurale.
 * Unités : mètres. Axe Y vers le haut. X = longueur (socle à -X, bac à +X).
 * Z = largeur (panneau 24 V du côté -Z, leviers de déplacement du côté +Z).
 * Chaque pièce est une géométrie générée par code d'après les dessins du
 * manuel de pièces PM10654. Aucune donnée n'est reprise du modèle V40.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export { THREE };
export const IN = 0.0254;
export const MM = 0.001;
export const DEG = Math.PI / 180;

/* ------------------------------------------------------------------ */
/* Textures procédurales (canvas), partagées                           */
/* ------------------------------------------------------------------ */
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
function heightField(size, seed, blobs, rMin, rMax, soft = true) {
  const h = new Float32Array(size * size);
  const r = rng(seed);
  for (let b = 0; b < blobs; b++) {
    const cx = r() * size, cy = r() * size, rad = rMin + r() * (rMax - rMin), amp = (r() - 0.5) * 2;
    const ir = Math.ceil(rad);
    for (let y = -ir; y <= ir; y++) for (let x = -ir; x <= ir; x++) {
      const d = Math.sqrt(x * x + y * y) / rad; if (d >= 1) continue;
      const px = ((Math.floor(cx) + x) % size + size) % size, py = ((Math.floor(cy) + y) % size + size) % size;
      const f = soft ? (1 - d * d) * (1 - d * d) : 1;
      h[py * size + px] += amp * f;
    }
  }
  return h;
}
function normalFromHeight(h, size, strength) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const ctx = c.getContext('2d'); const img = ctx.createImageData(size, size);
  const at = (x, y) => h[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * strength, dy = (at(x, y + 1) - at(x, y - 1)) * strength;
    const l = Math.hypot(dx, dy, 1), i = (y * size + x) * 4;
    img.data[i] = (-dx / l * 0.5 + 0.5) * 255; img.data[i + 1] = (-dy / l * 0.5 + 0.5) * 255;
    img.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0); return c;
}
function greyFromHeight(h, size, lo, hi) {
  let mn = Infinity, mx = -Infinity; for (const v of h) { if (v < mn) mn = v; if (v > mx) mx = v; }
  const c = document.createElement('canvas'); c.width = c.height = size;
  const ctx = c.getContext('2d'); const img = ctx.createImageData(size, size);
  for (let i = 0; i < h.length; i++) { const t = (h[i] - mn) / (mx - mn || 1); const g = (lo + (hi - lo) * t) * 255; img.data[4 * i] = img.data[4 * i + 1] = img.data[4 * i + 2] = g; img.data[4 * i + 3] = 255; }
  ctx.putImageData(img, 0, 0); return c;
}
const TEX = {};
function tex(key, make, repeat, srgb = false) {
  if (TEX[key]) return TEX[key];
  const t = new THREE.CanvasTexture(make());
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat);
  t.anisotropy = 4; if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return (TEX[key] = t);
}
const T = {
  peel: () => tex('peel', () => normalFromHeight(heightField(256, 7, 2600, 1.5, 4.5), 256, 0.9), 2),
  rough: () => tex('rough', () => greyFromHeight(heightField(256, 11, 700, 4, 22), 256, 0.72, 1.0), 0.5),
  grain: () => tex('grain', () => normalFromHeight(heightField(256, 23, 5200, 0.8, 2.2, false), 256, 0.35), 3),
  cast: () => tex('cast', () => normalFromHeight(heightField(256, 31, 3800, 1, 3.5), 256, 1.6), 3),
  brush: () => tex('brush', () => {
    const s = 256, c = document.createElement('canvas'); c.width = c.height = s; const ctx = c.getContext('2d');
    const r = rng(5); ctx.fillStyle = '#c8c8c8'; ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 1400; i++) { const y = r() * s, g = 150 + r() * 105; ctx.strokeStyle = `rgb(${g},${g},${g})`; ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(s, y + (r() - 0.5) * 2); ctx.stroke(); }
    return c;
  }, 3),
};

/* ------------------------------------------------------------------ */
/* Matériaux                                                           */
/* ------------------------------------------------------------------ */
const MAT = {};
function def(key, params, maps = {}) {
  MAT[key] = { params, maps };
}
// Peintures
def('red', { color: '#a8121a', roughness: 0.4, metalness: 0, clearcoat: 0.55, clearcoatRoughness: 0.28 }, { normal: 'peel', normalScale: 0.12, rough: 'rough' });
def('redDark', { color: '#7e1015', roughness: 0.5, clearcoat: 0.4, clearcoatRoughness: 0.35 }, { normal: 'peel', normalScale: 0.1, rough: 'rough' });
def('white', { color: '#e4e5e1', roughness: 0.55, clearcoat: 0.2, clearcoatRoughness: 0.5 }, { normal: 'peel', normalScale: 0.18, rough: 'rough' });
def('grey', { color: '#c4c7c9', roughness: 0.42, clearcoat: 0.3, clearcoatRoughness: 0.4 }, { normal: 'peel', normalScale: 0.1, rough: 'rough' });
def('black', { color: '#1d1e20', roughness: 0.5, clearcoat: 0.3, clearcoatRoughness: 0.45 }, { normal: 'peel', normalScale: 0.12, rough: 'rough' });
def('blackCast', { color: '#232427', roughness: 0.72 }, { normal: 'cast', normalScale: 0.5 });
def('yellow', { color: '#efb000', roughness: 0.42, clearcoat: 0.4, clearcoatRoughness: 0.3 }, { normal: 'peel', normalScale: 0.1 });
def('blue', { color: '#1f4fa3', roughness: 0.45, clearcoat: 0.3 });
def('green', { color: '#1f8a3a', roughness: 0.45 });
// Métaux
def('steel', { color: '#7f8489', metalness: 1, roughness: 0.42 }, { rough: 'rough' });
def('machined', { color: '#b7bbbf', metalness: 1, roughness: 0.27 }, { rough: 'brush' });
def('zinc', { color: '#cdc6b1', metalness: 1, roughness: 0.32 }, { rough: 'rough' });
def('zincClear', { color: '#c3c8cd', metalness: 1, roughness: 0.3 }, { rough: 'rough' });
def('blackOxide', { color: '#2a2b2d', metalness: 0.9, roughness: 0.42 });
def('chrome', { color: '#f2f4f6', metalness: 1, roughness: 0.06 });
def('alu', { color: '#c8ccd0', metalness: 1, roughness: 0.38 }, { rough: 'brush' });
def('brass', { color: '#b98f3e', metalness: 1, roughness: 0.3 });
def('bronze', { color: '#9c6b35', metalness: 1, roughness: 0.38 });
def('copper', { color: '#b8693c', metalness: 1, roughness: 0.32 });
// Élastomères, plastiques
def('rubber', { color: '#141414', roughness: 0.9 }, { normal: 'grain', normalScale: 0.6 });
def('hose', { color: '#151516', roughness: 0.55, clearcoat: 0.15, clearcoatRoughness: 0.6 }, { normal: 'grain', normalScale: 0.25 });
def('polymer', { color: '#1f2022', roughness: 0.62 }, { normal: 'grain', normalScale: 0.2 });
def('plastic', { color: '#2b2c2e', roughness: 0.5 });
def('plasticGrey', { color: '#8a8e92', roughness: 0.5 });
def('plasticLight', { color: '#d9d9d4', roughness: 0.45 });
def('orange', { color: '#f07a12', roughness: 0.45 });
def('cableYellow', { color: '#e3b90c', roughness: 0.5 });
def('cableGrey', { color: '#5e6266', roughness: 0.55 });
def('cableBlack', { color: '#18191a', roughness: 0.55 });
def('textile', { color: '#4a4339', roughness: 0.95 }, { normal: 'grain', normalScale: 1 });
// Verres, voyants
def('glass', { color: '#ffffff', roughness: 0.05, transmission: 0.95, thickness: 0.004, ior: 1.5 });
def('amber', { color: '#ff9c12', roughness: 0.15, transmission: 0.55, thickness: 0.01, ior: 1.49, emissive: '#ff7a00', emissiveIntensity: 0.25 });
def('redLens', { color: '#e0121c', roughness: 0.15, transmission: 0.45, thickness: 0.006, emissive: '#c00010', emissiveIntensity: 0.3 });
def('violet', { color: '#b7a6e8', roughness: 0.2, transmission: 0.6, thickness: 0.004 });
def('screen', { color: '#0b0d10', roughness: 0.08, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05, emissive: '#18222e', emissiveIntensity: 0.6 });
def('ledWhite', { color: '#f5f7ff', roughness: 0.2, emissive: '#e8eeff', emissiveIntensity: 0.6 });

const BUILT = {};
export function mat(key) {
  if (key && key.isMaterial) return key;
  if (BUILT[key]) return BUILT[key];
  const d = MAT[key]; if (!d) throw new Error('Matériau inconnu : ' + key);
  const m = new THREE.MeshPhysicalMaterial(d.params);
  if (d.maps.normal) { m.normalMap = T[d.maps.normal](); m.normalScale.set(d.maps.normalScale, d.maps.normalScale); }
  if (d.maps.rough) m.roughnessMap = T[d.maps.rough]();
  if (m.transmission > 0) { m.depthWrite = true; }
  m.userData.key = key; m.name = key;
  return (BUILT[key] = m);
}
export const MATERIAL_KEYS = () => Object.keys(MAT);

/* Étiquettes / autocollants : texture canvas propre à chaque libellé. */
export function labelMat({ text = '', lines, w = 0.2, h = 0.05, bg = '#ffffff', fg = '#111111', font = 'bold', border = null, align = 'center', px = 512, draw, key }) {
  const c = document.createElement('canvas'); const ratio = w / h;
  c.width = px; c.height = Math.max(16, Math.round(px / ratio));
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, c.width, c.height);
  if (border) { ctx.strokeStyle = border; ctx.lineWidth = c.height * 0.06; ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, c.width - ctx.lineWidth, c.height - ctx.lineWidth); }
  if (draw) draw(ctx, c.width, c.height);
  const L = lines || [text];
  const fs = Math.min(c.height * 0.8 / L.length, c.width * 1.6 / Math.max(...L.map(s => s.length || 1)));
  ctx.fillStyle = fg; ctx.font = `${font} ${fs}px "Arial Narrow", Arial, sans-serif`; ctx.textBaseline = 'middle';
  ctx.textAlign = align; const x = align === 'center' ? c.width / 2 : c.width * 0.05;
  L.forEach((s, i) => ctx.fillText(s, x, c.height * (i + 0.5) / L.length));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  const m = new THREE.MeshPhysicalMaterial({ map: t, roughness: 0.45, clearcoat: 0.3, polygonOffset: true, polygonOffsetFactor: -2 });
  // key : à donner aux autocollants dessinés (draw) d'un même nœud, sinon ils partagent une texture à la fusion
  m.userData.key = 'label:' + (key || (L.join('|') + ':' + bg)); m.userData.keepUV = true; m.name = 'label';
  return m;
}

/* ------------------------------------------------------------------ */
/* Géométries                                                          */
/* ------------------------------------------------------------------ */
export const G = {
  /** Boîte arrondie centrée. r = rayon des arêtes. */
  box(w, h, d, r = 0.003, seg = 2) {
    const rr = Math.min(r, Math.min(w, h, d) / 2 - 1e-5);
    return rr > 0.0002 ? new RoundedBoxGeometry(w, h, d, seg, rr) : new THREE.BoxGeometry(w, h, d);
  },
  /** Cylindre plein selon Y, centré. */
  cyl(r, h, seg = 32, rTop = r, open = false) { return new THREE.CylinderGeometry(rTop, r, h, seg, 1, open); },
  /** Révolution : profil [[r, y], ...] autour de Y. */
  lathe(profile, seg = 40) { return new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(Math.max(r, 0), y)), seg); },
  /** Tube creux selon Y, centré, chanfreins c. */
  tube(ro, ri, h, seg = 40, c = 0.0008) {
    const y0 = -h / 2, y1 = h / 2;
    return G.lathe([[ri + c, y0], [ro - c, y0], [ro, y0 + c], [ro, y1 - c], [ro - c, y1], [ri + c, y1], [ri, y1 - c], [ri, y0 + c], [ri + c, y0]], seg);
  },
  /** Disque plein avec chanfreins (meilleur rendu que CylinderGeometry). */
  disc(r, h, seg = 40, c = 0.001) {
    const y0 = -h / 2, y1 = h / 2; c = Math.min(c, h / 3, r / 3);
    return G.lathe([[0, y0], [r - c, y0], [r, y0 + c], [r, y1 - c], [r - c, y1], [0, y1]], seg);
  },
  /** Prisme hexagonal selon Y (af = sur plats), chanfreiné. */
  hex(af, h, hole = 0) {
    const R = af / Math.sqrt(3); const s = new THREE.Shape();
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + Math.PI / 6; const x = R * Math.cos(a), y = R * Math.sin(a); i ? s.lineTo(x, y) : s.moveTo(x, y); }
    s.closePath();
    if (hole > 0) { const p = new THREE.Path(); p.absarc(0, 0, hole, 0, Math.PI * 2, true); s.holes.push(p); }
    const b = Math.min(af * 0.06, h * 0.15);
    const g = new THREE.ExtrudeGeometry(s, { depth: h - 2 * b, bevelEnabled: true, bevelSize: b, bevelThickness: b, bevelSegments: 1, curveSegments: 16 });
    g.translate(0, 0, -(h - 2 * b) / 2); g.rotateX(-Math.PI / 2); return g;
  },
  /** Plaque extrudée. outline : [[x,y],...] ou THREE.Shape, dans le plan XY ; épaisseur t selon Z (centrée).
   *  holes : [{c:[x,y], r}] ou [{pts:[[x,y],...]}] ou [{slot:[x1,y1,x2,y2], r}] */
  plate(outline, t, { holes = [], bevel = null, curve = 12 } = {}) {
    const s = outline instanceof THREE.Shape ? outline : shapeOf(outline);
    for (const h of holes) s.holes.push(holePath(h));
    const b = bevel ?? Math.min(0.0012, t * 0.18);
    const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(t - 2 * b, 1e-5), bevelEnabled: b > 0, bevelSize: b, bevelThickness: b, bevelSegments: 1, curveSegments: curve });
    g.translate(0, 0, -(t - 2 * b) / 2); return g;
  },
  /** Rectangle arrondi (contour pour plate). */
  rrect(w, h, r = 0, cx = 0, cy = 0) {
    const s = new THREE.Shape(); const x = cx - w / 2, y = cy - h / 2; r = Math.min(r, w / 2, h / 2);
    if (r <= 0) { s.moveTo(x, y); s.lineTo(x + w, y); s.lineTo(x + w, y + h); s.lineTo(x, y + h); s.closePath(); return s; }
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r);
    s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s;
  },
  /** Stade (rectangle à bouts ronds exacts), centré. */
  stadium(L, H, cx = 0, cy = 0) {
    const R = H / 2, a = L / 2 - R, s = new THREE.Shape();
    s.moveTo(cx - a, cy - R); s.lineTo(cx + a, cy - R); s.absarc(cx + a, cy, R, -Math.PI / 2, Math.PI / 2, false);
    s.lineTo(cx - a, cy + R); s.absarc(cx - a, cy, R, Math.PI / 2, 3 * Math.PI / 2, false); return s;
  },
  /** Tube (boyau, câble, tige courbée) le long de points 3D. */
  sweep(points, r, { seg = null, radial = 12, closed = false, tension = 0.5, type = 'catmullrom' } = {}) {
    const v = points.map(p => p.isVector3 ? p : new THREE.Vector3(...p));
    const curve = new THREE.CatmullRomCurve3(v, closed, type, tension);
    const n = seg ?? Math.max(8, Math.ceil(curve.getLength() / 0.012));
    return new THREE.TubeGeometry(curve, n, r, radial, closed);
  },
  sphere(r, seg = 24) { return new THREE.SphereGeometry(r, seg, Math.max(8, seg / 2)); },
  torus(R, r, arc = Math.PI * 2, rs = 12, ts = 48) { return new THREE.TorusGeometry(R, r, rs, ts, arc); },
  /** Tube rectangulaire creux (profilé) le long de Y, centré. */
  rectTube(w, d, h, t, r = 0.004) {
    const s = G.rrect(w, d, r); const hole = G.rrect(w - 2 * t, d - 2 * t, Math.max(r - t, 0.0005));
    s.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 6 });
    g.translate(0, 0, -h / 2); g.rotateX(-Math.PI / 2); return g;
  },
};
function shapeOf(pts) {
  const s = new THREE.Shape(); pts.forEach(([x, y], i) => i ? s.lineTo(x, y) : s.moveTo(x, y)); s.closePath(); return s;
}
function holePath(h) {
  const p = new THREE.Path();
  if (h.pts) { h.pts.forEach(([x, y], i) => i ? p.lineTo(x, y) : p.moveTo(x, y)); p.closePath(); return p; }
  if (h.slot) {
    const [x1, y1, x2, y2] = h.slot, r = h.r; const a = Math.atan2(y2 - y1, x2 - x1);
    p.absarc(x2, y2, r, a - Math.PI / 2, a + Math.PI / 2, false); p.absarc(x1, y1, r, a + Math.PI / 2, a + 3 * Math.PI / 2, false); p.closePath(); return p;
  }
  if (h.rect) { const [cx, cy, w, hh, rr = 0] = h.rect; return G.rrect(w, hh, rr, cx, cy); }
  p.absarc(h.c[0], h.c[1], h.r, 0, Math.PI * 2, true); return p;
}

/* ------------------------------------------------------------------ */
/* Objets                                                              */
/* ------------------------------------------------------------------ */
const V3 = (a) => (a && a.isVector3) ? a : new THREE.Vector3(...(a || [0, 0, 0]));
/** Mesh positionné. r en degrés [x,y,z] (ordre XYZ). */
export function m(geo, matKey, { p, r, s, name } = {}) {
  const o = new THREE.Mesh(geo, mat(matKey));
  if (p) o.position.copy(V3(p));
  if (r) o.rotation.set(r[0] * DEG, r[1] * DEG, r[2] * DEG);
  if (s) (typeof s === 'number') ? o.scale.setScalar(s) : o.scale.set(...s);
  if (name) o.name = name;
  return o;
}
/** Groupe positionné. */
export function grp(children = [], { p, r, s, name } = {}) {
  const g = new THREE.Group();
  for (const c of children.flat(Infinity)) if (c) g.add(c);
  if (p) g.position.copy(V3(p));
  if (r) g.rotation.set(r[0] * DEG, r[1] * DEG, r[2] * DEG);
  if (s) (typeof s === 'number') ? g.scale.setScalar(s) : g.scale.set(...s);
  if (name) g.name = name;
  return g;
}
/** Oriente l'axe +Y local de obj vers dir (vecteur), à la position p. */
export function aim(obj, p, dir, roll = 0) {
  obj.position.copy(V3(p));
  const d = V3(dir).clone().normalize();
  obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
  if (roll) obj.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), roll * DEG));
  return obj;
}
/** Place obj entre a et b : +Y local de a vers b ; renvoie la longueur. */
export function between(obj, a, b, roll = 0) {
  const A = V3(a), B = V3(b); aim(obj, A, B.clone().sub(A), roll); return A.distanceTo(B);
}

/* Visserie (dimensions nominales en pouces converties) ----------------
 * Convention : tête à l'origine, dessus de tête vers +Y, tige vers -Y. */
export function bolt({ d = 0.5 * IN, L = 1.5 * IN, head = 'hex', mat: mk = 'zinc', washer = false, nut = false, grip = null } = {}) {
  const parts = [];
  if (head === 'hex') parts.push(m(G.hex(1.5 * d, 0.64 * d), mk, { p: [0, 0.32 * d, 0] }));
  else if (head === 'shcs') {
    const hh = d; parts.push(m(G.lathe([[0, 0.25 * hh], [0.42 * d, 0.25 * hh], [0.42 * d, 0], [0.75 * d, 0], [0.75 * d, hh * 0.9], [0.7 * d, hh], [0.45 * d, hh], [0.45 * d, 0.35 * hh], [0, 0.35 * hh]], 24), mk === 'zinc' ? 'blackOxide' : mk));
  } else if (head === 'bhcs') parts.push(m(G.lathe([[0, 0], [0.95 * d, 0], [0.9 * d, 0.2 * d], [0.6 * d, 0.5 * d], [0, 0.55 * d]], 24), mk));
  else if (head === 'fhcs') parts.push(m(G.lathe([[0, -0.55 * d], [0.5 * d, -0.55 * d], [d, 0], [0, 0]], 24), mk));
  parts.push(m(G.cyl(d * 0.48, L, 16), mk, { p: [0, -L / 2, 0] }));
  parts.push(m(G.cyl(d * 0.4, 0.06 * d, 16), mk, { p: [0, -L - 0.03 * d, 0] }));
  if (washer) parts.push(m(G.tube(d, d * 0.53, 0.12 * d, 24), mk, { p: [0, -0.06 * d, 0] }));
  if (nut) { const g = grip ?? L * 0.7; parts.push(m(G.hex(1.5 * d, 0.86 * d, d * 0.5), mk, { p: [0, -g - 0.43 * d, 0] })); }
  return grp(parts);
}
export function nut({ d = 0.5 * IN, mat: mk = 'zinc', lock = false } = {}) {
  const h = lock ? 1.1 * d : 0.86 * d;
  const g = [m(G.hex(1.5 * d, h, d * 0.5), mk, { p: [0, h / 2, 0] })];
  if (lock) g.push(m(G.tube(0.68 * d, d * 0.5, 0.25 * d, 24), 'blue', { p: [0, h * 0.86, 0] }));
  return grp(g);
}
export function washer({ d = 0.5 * IN, od = null, t = null, mat: mk = 'zinc' } = {}) {
  const o = od ?? 2.1 * d, th = t ?? 0.12 * d;
  return m(G.tube(o / 2, d * 0.54, th, 28, th * 0.15), mk, { p: [0, th / 2, 0] });
}
/** Rangée de boulons : positions [[x,y,z],...], direction de tête dir. */
export function bolts(positions, dir, opts) {
  return grp(positions.map(p => aim(bolt(opts), p, dir)));
}
/** Cercle de boulons dans le plan XZ (axe Y). */
export function boltCircle(n, R, y, opts, phase = 0) {
  const ps = []; for (let i = 0; i < n; i++) { const a = phase + i * 2 * Math.PI / n; ps.push([R * Math.cos(a), y, R * Math.sin(a)]); }
  return bolts(ps, [0, 1, 0], opts);
}
/** Goupille / axe selon Y, avec tête optionnelle. */
export function pin({ d = 1 * IN, L = 3 * IN, head = true, mat: mk = 'machined' } = {}) {
  const g = [m(G.lathe([[0, -L / 2], [d / 2 - 0.0015, -L / 2], [d / 2, -L / 2 + 0.0015], [d / 2, L / 2], [0, L / 2]], 32), mk)];
  if (head) g.push(m(G.disc(d * 0.8, d * 0.18, 32), mk, { p: [0, L / 2 + d * 0.09, 0] }));
  return grp(g);
}
/** Graisseur. */
export function greaseNipple(mk = 'brass') {
  return grp([m(G.hex(0.011, 0.007), mk, { p: [0, 0.0035, 0] }), m(G.cyl(0.003, 0.008, 12), mk, { p: [0, 0.011, 0] }), m(G.sphere(0.0034, 12), mk, { p: [0, 0.0155, 0] })]);
}

/* Hydraulique -------------------------------------------------------- */
/** Raccord droit JIC/ORB le long de +Y : corps hexagonal + écrou. */
export function fitting({ d = 0.375 * IN, L = 0.035, mat: mk = 'zinc' } = {}) {
  return grp([
    m(G.cyl(d * 0.55, L * 0.35, 16), mk, { p: [0, L * 0.175, 0] }),
    m(G.hex(d * 1.6, L * 0.25), mk, { p: [0, L * 0.45, 0] }),
    m(G.cyl(d * 0.5, L * 0.2, 16), mk, { p: [0, L * 0.68, 0] }),
    m(G.hex(d * 1.8, L * 0.25), mk, { p: [0, L * 0.88, 0] }),
  ]);
}
/** Coude 90° : branche 1 le long de +Y depuis l'origine, branche 2 sortant selon +X. */
export function elbow({ d = 0.375 * IN, R = null, mat: mk = 'zinc' } = {}) {
  const r = R ?? d * 1.3, h = d * 0.9;
  const t = m(G.torus(r, d * 0.5, Math.PI / 2, 12, 16), mk);
  t.rotation.z = Math.PI / 2; t.position.set(r, h, 0);
  return grp([
    m(G.hex(d * 1.7, h), mk, { p: [0, h / 2, 0] }),
    t,
    m(G.hex(d * 1.7, h), mk, { p: [r + h / 2, h + r, 0], r: [0, 0, -90] }),
  ]);
}
/** Boyau hydraulique avec embouts sertis aux deux extrémités. */
export function hose(points, { d = 0.5 * IN, mat: mk = 'hose', ends = true, radial = 14 } = {}) {
  const r = d / 2 + 0.003;
  const pts = points.map(V3);
  const g = [m(G.sweep(pts, r, { radial }), mk)];
  if (ends) {
    for (const [a, b] of [[pts[0], pts[1]], [pts[pts.length - 1], pts[pts.length - 2]]]) {
      const dir = a.clone().sub(b).normalize();
      const ferrule = m(G.lathe([[0, 0], [r * 1.25, 0], [r * 1.25, 0.03], [r * 1.05, 0.036], [0, 0.036]], 20), 'zincClear');
      const nutH = m(G.hex(r * 2.4, 0.016), 'zincClear');
      const f = grp([ferrule, grp([nutH], { p: [0, 0.044, 0] })]);
      aim(f, a.clone().addScaledVector(dir, -0.03), dir); g.push(f);
    }
  }
  return grp(g);
}
/** Vérin hydraulique le long de +Y : œil de fond à l'origine, œil de tige à L.
 *  ext : 0 = rentré, 1 = sorti. */
export function hydCylinder({ bore = 2.5 * IN, rod = 1.5 * IN, stroke = 8 * IN, closed = null, ext = 0, eye = 'clevis', rodEye = 'eye', pin: pd = 1 * IN, mat: mk = 'black', ports = true, name } = {}) {
  const wall = 0.25 * IN, od = bore + 2 * wall;
  const closedL = closed ?? stroke + 6 * IN;
  const barrelL = closedL - 2.6 * IN;
  const g = [];
  // fond (chape ou œil)
  if (eye === 'clevis') {
    for (const s of [-1, 1]) g.push(m(G.plate([[-od * 0.38, 0], [od * 0.38, 0], [od * 0.38, 0.9 * IN], [0, 1.4 * IN], [-od * 0.38, 0.9 * IN]], 0.3 * IN, { holes: [{ c: [0, 0.75 * IN], r: pd / 2 }] }), mk, { p: [0, 0.75 * IN, s * (pd * 0.9)], r: [0, 0, 180] }));
    g.push(m(G.box(od * 0.8, 0.35 * IN, pd * 2.1, 0.002), mk, { p: [0, 0.6 * IN, 0] }));
  } else g.push(m(G.disc(0.85 * IN, 0.9 * IN, 32), mk, { p: [0, 0, 0], r: [90, 0, 0] }), m(G.box(od * 0.55, 1.2 * IN, 0.9 * IN, 0.002), mk, { p: [0, 0.6 * IN, 0] }));
  // tube
  g.push(m(G.lathe([[0, 0.75 * IN], [od / 2 + 0.002, 0.75 * IN], [od / 2 + 0.002, 1.15 * IN], [od / 2, 1.2 * IN], [od / 2, 0.75 * IN + barrelL - 0.3 * IN], [od / 2 + 0.003, 0.75 * IN + barrelL - 0.25 * IN], [od / 2 + 0.003, 0.75 * IN + barrelL], [rod / 2 + 0.003, 0.75 * IN + barrelL + 0.2 * IN], [0, 0.75 * IN + barrelL + 0.2 * IN]], 36), mk));
  if (ports) for (const y of [1.6 * IN, 0.75 * IN + barrelL - 0.8 * IN]) {
    g.push(m(G.box(0.9 * IN, 0.8 * IN, 0.5 * IN, 0.002), mk, { p: [0, y, od / 2 + 0.2 * IN] }));
    g.push(aim(fitting({ d: 0.375 * IN }), [0, y, od / 2 + 0.45 * IN], [0, 0, 1]));
  }
  // tige
  const rodL = barrelL + stroke * ext + 1.1 * IN;
  const rodY0 = 0.75 * IN + barrelL + 0.2 * IN - (barrelL - 0.6 * IN);
  const rodG = grp([
    m(G.cyl(rod / 2, rodL, 32), 'chrome', { p: [0, rodY0 + rodL / 2, 0] }),
  ], { name: 'rod' });
  const tipY = rodY0 + rodL;
  if (rodEye === 'eye') rodG.add(m(G.disc(0.8 * IN, 0.95 * IN, 32), mk, { p: [0, tipY + 0.55 * IN, 0], r: [90, 0, 0] }), m(G.cyl(rod * 0.6, 0.5 * IN, 24), mk, { p: [0, tipY + 0.05 * IN, 0] }));
  else rodG.add(m(G.box(rod * 1.1, 1.3 * IN, rod * 1.1, 0.003), mk, { p: [0, tipY + 0.4 * IN, 0] }));
  g.push(rodG);
  const out = grp(g, { name });
  out.userData.pinToPin = tipY + 0.55 * IN;
  return out;
}
/** Coupleur rapide (paire mâle + femelle) le long de +Y. */
export function coupler({ d = 0.5 * IN, mat: mk = 'zincClear', male = true } = {}) {
  const r = d * 0.9;
  const g = [m(G.lathe([[0, 0], [r * 1.05, 0], [r * 1.05, 0.012], [r * 1.25, 0.016], [r * 1.25, 0.05], [r * 1.05, 0.056], [r * 1.05, 0.07], [r * 0.7, 0.075], [0, 0.075]], 28), mk)];
  g.push(m(G.hex(r * 2.4, 0.016), mk, { p: [0, -0.008, 0] }));
  if (male) g.push(m(G.lathe([[0, 0.075], [r * 0.62, 0.075], [r * 0.62, 0.105], [r * 0.5, 0.11], [0, 0.11]], 24), mk));
  return grp(g);
}

/* Commandes, signalisation ------------------------------------------- */
/** Levier de valve le long de +Y avec pommeau. */
export function lever({ L = 0.16, knob = 0.022, mat: mk = 'black' } = {}) {
  return grp([
    m(G.cyl(0.0055, L, 12), 'machined', { p: [0, L / 2, 0] }),
    m(G.lathe([[0, 0], [knob * 0.45, 0], [knob * 0.55, knob * 0.3], [knob * 0.5, knob * 1.1], [knob * 0.3, knob * 1.35], [0, knob * 1.4]], 20), mk, { p: [0, L - 0.004, 0] }),
  ]);
}
/** Bouton d'arrêt d'urgence (champignon rouge sur collerette jaune), axe +Y. */
export function estopButton({ D = 0.04 } = {}) {
  return grp([
    m(G.disc(D * 0.85, 0.004, 32), 'yellow', { p: [0, 0.002, 0] }),
    m(G.cyl(D * 0.3, 0.018, 24), 'plastic', { p: [0, 0.012, 0] }),
    m(G.lathe([[0, 0], [D * 0.5, 0], [D * 0.52, 0.006], [D * 0.45, 0.014], [0, 0.016]], 32), 'redLens', { p: [0, 0.02, 0] }),
  ]);
}
/** Panneau perforé de triangles (bac à tiges). Plan XY, épaisseur selon Z. */
export function triPerforated(w, h, t, { cell = 0.07, margin = 0.04, gap = 0.012, rows = null, cols = null } = {}) {
  const s = G.rrect(w, h, 0.004);
  const nx = cols ?? Math.floor((w - 2 * margin) / (cell * 0.5 + gap * 0.6)) - 1;
  const ny = rows ?? Math.floor((h - 2 * margin) / (cell + gap));
  const ch = (h - 2 * margin - (ny - 1) * gap) / ny;
  const cw = (w - 2 * margin) / ((nx + 1) / 2);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const up = (i + j) % 2 === 0;
    const x0 = -w / 2 + margin + i * cw / 2, y0 = -h / 2 + margin + j * (ch + gap);
    const g2 = gap * 0.55;
    const pts = up ? [[x0 + g2, y0], [x0 + cw - g2, y0], [x0 + cw / 2, y0 + ch]] : [[x0 + cw / 2, y0], [x0 + cw - g2, y0 + ch], [x0 + g2, y0 + ch]];
    s.holes.push(holePath({ pts }));
  }
  return G.plate(s, t, { bevel: Math.min(0.0008, t * 0.2), curve: 4 });
}
/** Train de chenille : bande caoutchouc à crampons sur parcours en stade, plan XY, largeur selon Z. */
export function rubberTrack({ length = 2.27, height = 0.477, width = 0.305, thick = 0.035, pitch = 0.09, lug = 0.022 } = {}) {
  const R = height / 2, straight = length - 2 * R;
  const per = 2 * straight + 2 * Math.PI * R;
  const pt = (s) => { // s ∈ [0, per) → point + normale extérieure
    if (s < straight) return [[-straight / 2 + s, -R], [0, -1]];
    s -= straight; if (s < Math.PI * R) { const a = -Math.PI / 2 + s / R; return [[straight / 2 + R * Math.cos(a), R * Math.sin(a)], [Math.cos(a), Math.sin(a)]]; }
    s -= Math.PI * R; if (s < straight) return [[straight / 2 - s, R], [0, 1]];
    s -= straight; const a = Math.PI / 2 + s / R; return [[-straight / 2 + R * Math.cos(a), R * Math.sin(a)], [Math.cos(a), Math.sin(a)]];
  };
  // bande : contour extérieur et intérieur
  const outer = G.stadium(length, height); const inner = G.stadium(length - 2 * thick, height - 2 * thick);
  outer.holes.push(new THREE.Path(inner.getPoints(48)));
  const band = new THREE.ExtrudeGeometry(outer, { depth: width - 0.01, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.005, bevelSegments: 2, curveSegments: 48 });
  band.translate(0, 0, -(width - 0.01) / 2);
  const geos = [band];
  const n = Math.round(per / pitch);
  for (let i = 0; i < n; i++) {
    const s = i * per / n; const [[x, y], [nx, ny]] = pt(s);
    for (const half of [-1, 1]) { // crampons en chevron
      const lg = G.box(0.03, lug, width * 0.46, 0.004, 1);
      const q = new THREE.Matrix4().makeRotationZ(Math.atan2(ny, nx) - Math.PI / 2);
      const sk = new THREE.Matrix4().makeRotationY(half * 0.22);
      const tr = new THREE.Matrix4().makeTranslation(x + nx * lug / 2, y + ny * lug / 2, half * width * 0.24);
      lg.applyMatrix4(sk).applyMatrix4(q).applyMatrix4(tr); geos.push(lg);
    }
  }
  return mergeGeometries(geos.map(g => g.index ? g.toNonIndexed() : g).map(stripAttrs), false);
}

/* Soudure (cordon) le long de points. */
export function weld(points, r = 0.003, mk = 'red') {
  return m(G.sweep(points, r, { radial: 6, tension: 0 }), mk);
}
/** Autocollant / étiquette plane. Normale +Z. */
export function decal(opts) {
  const g = new THREE.PlaneGeometry(opts.w || 0.2, opts.h || 0.05);
  const o = new THREE.Mesh(g, labelMat(opts));
  if (opts.p) o.position.copy(V3(opts.p)); if (opts.r) o.rotation.set(opts.r[0] * DEG, opts.r[1] * DEG, opts.r[2] * DEG);
  return o;
}

/* ------------------------------------------------------------------ */
/* Structure : ensembles et pièces                                     */
/* ------------------------------------------------------------------ */
/** Ensemble (assemblage du manuel). meta : { id, sec, item, pn, fr, en, qty, page, explode:[dx,dy,dz], anchor:[x,y,z], approx, note } */
export function asm(meta, children = [], tf = {}) {
  const g = grp(children, tf); g.name = meta.id || meta.pn || 'asm';
  g.userData = { type: 'asm', ...meta }; return g;
}
/** Pièce (ligne de nomenclature). */
export function part(meta, children = [], tf = {}) {
  const g = grp(children, tf); g.name = meta.id || meta.pn || 'part';
  g.userData = { type: 'part', ...meta }; return g;
}
/** Segment mobile d'une pièce (tige de vérin, champignon d'arrêt...) : fusionné à part,
 *  sans ligne de nomenclature. La pièce qui le contient reste la pièce choisie au clic.
 *  meta : { seg: 'rod', joint: {...} } (voir rig.js). */
export function seg(meta, children = [], tf = {}) {
  const g = grp(children, tf); g.name = meta.seg || 'seg';
  g.userData = { type: 'seg', ...meta }; return g;
}

/* ------------------------------------------------------------------ */
/* Finalisation : fusion par matériau, UV en projection cubique         */
/* ------------------------------------------------------------------ */
function stripAttrs(g) {
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  g.morphAttributes = {};
  return g;
}
/** UV par projection cubique (densité constante : 1 unité UV = 0,25 m). */
export function boxUV(g, scale = 4) {
  const p = g.attributes.position, n = g.attributes.normal; const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let u, v; if (ax >= ay && ax >= az) { u = p.getZ(i); v = p.getY(i); } else if (ay >= az) { u = p.getX(i); v = p.getZ(i); } else { u = p.getX(i); v = p.getY(i); }
    uv[2 * i] = u * scale; uv[2 * i + 1] = v * scale;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); return g;
}
/** Fusionne, dans chaque pièce, les meshes par matériau. Les sous-ensembles et pièces imbriqués restent séparés.
 *  Les meshes posés directement dans un ensemble deviennent une pièce implicite. Renvoie des statistiques. */
export function finalize(root) {
  const stats = { parts: 0, meshes: 0, tris: 0 };
  root.updateMatrixWorld(true);
  const isNode = (o) => o.userData && (o.userData.type === 'asm' || o.userData.type === 'part' || o.userData.type === 'seg');
  // un segment appartient à la pièce qui le contient (clic, contour, transparence)
  const ownerOf = (n) => { let p = n; while (p && !(p.userData && (p.userData.type === 'asm' || p.userData.type === 'part'))) p = p.parent; return p || n; };
  const process = (node) => {
    // collecter les meshes appartenant directement à ce nœud (sans traverser les nœuds asm/part enfants)
    const meshes = []; const subNodes = [];
    const walk = (o) => { for (const c of o.children) { if (isNode(c)) subNodes.push(c); else if (c.isMesh) meshes.push(c); else walk(c); } };
    walk(node);
    if (meshes.length) {
      const inv = new THREE.Matrix4().copy(node.matrixWorld).invert();
      const byMat = new Map();
      for (const ms of meshes) {
        const k = ms.material.userData.key || ms.material.uuid;
        if (!byMat.has(k)) byMat.set(k, { mat: ms.material, geos: [] });
        const g = ms.geometry.clone(); g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, ms.matrixWorld));
        const ng = stripAttrs(g.index ? g.toNonIndexed() : g);
        if (!ms.material.userData.keepUV) boxUV(ng);
        byMat.get(k).geos.push(ng);
      }
      // rattacher au nœud les sous-ensembles imbriqués dans des groupes ordinaires, puis retirer ces groupes
      for (const sn of subNodes) if (sn.parent !== node) node.attach(sn);
      const keep = node.children.filter(isNode);
      node.children.slice().forEach(c => { if (!isNode(c)) node.remove(c); });
      for (const { mat: mt, geos } of byMat.values()) {
        const merged = mergeGeometries(geos, false); if (!merged) continue;
        const mesh = new THREE.Mesh(merged, mt); mesh.castShadow = true; mesh.receiveShadow = true;
        mesh.userData.owner = ownerOf(node); node.add(mesh); stats.meshes++; stats.tris += merged.attributes.position.count / 3;
      }
      keep.forEach(k => { if (k.parent !== node) node.add(k); });
      stats.parts++;
    }
    subNodes.forEach(process);
  };
  process(root);
  return stats;
}
