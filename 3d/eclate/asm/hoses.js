/* RodBot LP, vue éclatée : boyaux hydrauliques (dessinés pour référence).
 * Le manuel de pièces ne les détaille pas (« cables and hoses are included in this drawing as reference only », p. 10) :
 * aucun numéro de pièce, tracés estimés. Chaque boyau part d'un raccord existant d'un autre module et arrive sur un raccord.
 * Sources des tracés : vues CAO du manuel opérateur (p. 7 et 79), dessins du manuel de pièces (p. 10, 11, 21, 45, 49, 51, 53,
 * 58, 59, 69, 72, 77), positions des raccords relevées dans frame.js, pedestal.js, crane.js et gripper.js.
 * Passages utilisés : lumière oblongue de la poutre avant du socle, tunnel sous l'axe J2 de la base de levage, brides en P et
 * collier Stauff sous la flèche, chaîne porte-câbles, trou oblong du support en U de la pince, trous d'allègement des longerons.
 * Rayons de courbure >= 5 fois le diamètre nominal (contrôlés à la construction).
 */
import { THREE, G, m, grp, aim, asm, part, IN, DEG } from '../kit.js';

/* ------------------------------------------------------------------ */
/* Outils                                                              */
/* ------------------------------------------------------------------ */
const v3 = (a) => (a.isVector3 ? a.clone() : new THREE.Vector3(a[0], a[1], a[2]));
const D38 = 0.375 * IN, D12 = 0.5 * IN, D14 = 0.25 * IN;
const HR = (d) => d / 2 + 0.003;                 // rayon extérieur du boyau (tresse + gaine)
const NUT = (d) => d * 1.45 + 0.004;             // six pans de l'écrou tournant JIC
const DEBUG = { lines: [], warn: [] };
export { DEBUG };
const dbg = (typeof location !== 'undefined') && /hosedebug/.test(location.search || '');

/** Tube à partir d'une suite de points, repères transportés (pas de torsion). Extrémités ouvertes (cachées par les embouts). */
function tubeGeo(pts, r, radial) {
  const n = pts.length, T = [];
  for (let i = 0; i < n; i++) { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)]; T.push(b.clone().sub(a).normalize()); }
  const N = Math.abs(T[0].y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  N.addScaledVector(T[0], -N.dot(T[0])).normalize();
  const pos = new Float32Array(n * (radial + 1) * 3), nor = new Float32Array(n * (radial + 1) * 3), idx = [];
  const B = new THREE.Vector3(), ax = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    if (i > 0) {
      ax.crossVectors(T[i - 1], T[i]); const s = ax.length();
      if (s > 1e-7) N.applyAxisAngle(ax.divideScalar(s), Math.atan2(s, T[i - 1].dot(T[i])));
      N.addScaledVector(T[i], -N.dot(T[i])).normalize();
    }
    B.crossVectors(T[i], N);
    for (let j = 0; j <= radial; j++) {
      const a = j / radial * Math.PI * 2, c = Math.cos(a), s = Math.sin(a), k = (i * (radial + 1) + j) * 3;
      const nx = N.x * c + B.x * s, ny = N.y * c + B.y * s, nz = N.z * c + B.z * s;
      pos[k] = pts[i].x + r * nx; pos[k + 1] = pts[i].y + r * ny; pos[k + 2] = pts[i].z + r * nz;
      nor[k] = nx; nor[k + 1] = ny; nor[k + 2] = nz;
    }
  }
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < radial; j++) {
    const a = i * (radial + 1) + j, b = a + radial + 1;
    idx.push(a, a + 1, b, b, a + 1, b + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setIndex(idx); return g;
}

/** Ligne brisée -> chemin à congés circulaires. R : rayon commun ou tableau (un par point). Les longueurs de tangente
 *  sont partagées entre deux congés voisins au prorata de leur besoin ; le rayon est réduit si un segment est trop court. */
function fillet(P, R) {
  const n = P.length, th = new Array(n).fill(0), dem = new Array(n).fill(0), d = [], len = [];
  for (let i = 0; i < n - 1; i++) { const v = P[i + 1].clone().sub(P[i]); len.push(v.length()); d.push(v.normalize()); }
  const Ri = (i) => (Array.isArray(R) ? (R[i] ?? R[R.length - 1]) : R);
  for (let i = 1; i < n - 1; i++) {
    if (len[i - 1] < 1e-6 || len[i] < 1e-6) continue;
    th[i] = Math.acos(THREE.MathUtils.clamp(d[i - 1].dot(d[i]), -1, 1));
    if (th[i] > 0.01) dem[i] = Ri(i) * Math.tan(Math.min(th[i], 3.05) / 2);
  }
  const out = [P[0].clone()]; let rmin = Infinity, rminAt = null;
  for (let i = 1; i < n - 1; i++) {
    if (dem[i] === 0) { out.push(P[i].clone()); continue; }
    const avail = (s, a, b) => (dem[a] + dem[b] <= len[s] * 0.98 ? dem[i] : len[s] * 0.98 * dem[i] / (dem[a] + dem[b]));
    const t = Math.min(dem[i], avail(i - 1, i - 1, i), avail(i, i, i + 1));
    const r = t / Math.tan(th[i] / 2); if (r < rmin) { rmin = r; rminAt = [i, ...P[i].toArray().map((v) => +v.toFixed(3))]; }
    const d1 = d[i - 1], d2 = d[i], P1 = P[i].clone().addScaledVector(d1, -t);
    const axis = new THREE.Vector3().crossVectors(d1, d2).normalize();
    const nrm = new THREE.Vector3().crossVectors(axis, d1), O = P1.clone().addScaledVector(nrm, r), v0 = P1.clone().sub(O);
    const segs = Math.max(2, Math.ceil(th[i] / (13 * DEG))), q = new THREE.Quaternion();
    for (let k = 0; k <= segs; k++) { q.setFromAxisAngle(axis, th[i] * k / segs); out.push(O.clone().add(v0.clone().applyQuaternion(q))); }
  }
  out.push(P[n - 1].clone());
  const pts = [out[0]];
  for (let i = 1; i < out.length; i++) if (out[i].distanceTo(pts[pts.length - 1]) > 1e-5) pts.push(out[i]);
  const dense = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const L = pts[i].distanceTo(pts[i - 1]), k = Math.min(4, Math.floor(L / 0.35));
    for (let s2 = 1; s2 <= k; s2++) dense.push(pts[i - 1].clone().lerp(pts[i], s2 / (k + 1)));
    dense.push(pts[i]);
  }
  return { pts: dense, rmin, rminAt };
}

/* Embouts sertis --------------------------------------------------- */
function ferrule(d) {
  const r = HR(d);
  return G.lathe([[r * 0.96, 0], [r * 1.24, 0], [r * 1.26, 0.003], [r * 1.26, 0.026], [r * 1.12, 0.031], [r * 0.98, 0.033]], 16);
}
function hexAt(p, dir, af, h, mk = 'zincClear') { const g = G.hex(af, h); g.translate(0, h / 2, 0); return aim(m(g, mk), p, dir); }
function cylAt(p, dir, r, h, mk = 'zincClear', seg = 14) { const g = G.cyl(r, h, seg); g.translate(0, h / 2, 0); return aim(m(g, mk), p, dir); }
/**
 * Embout d'un boyau sur un raccord. e = { tip, dir, cover, nut, elbow, drop, rb }
 * tip : bout du raccord mâle ; dir : sens qui s'éloigne du raccord ; cover : longueur du nez recouverte par l'écrou ;
 * nut:false si le raccord porte déjà son écrou ; elbow : direction de sortie d'un embout coudé à 90°.
 * Renvoie { meshes, start, dir } : départ du boyau (dans la douille).
 */
function makeEnd(e, d) {
  const P = v3(e.tip), D = v3(e.dir).normalize(), r = HR(d), out = [];
  let s = 0;
  if (e.nut !== false) { const c = e.cover ?? 0.010; out.push(hexAt(P.clone().addScaledVector(D, -c), D, NUT(d), 0.017)); s = 0.017 - c; }
  if (!e.elbow) {
    out.push(aim(m(ferrule(d), 'zincClear'), P.clone().addScaledVector(D, s), D));
    return { meshes: out, start: P.clone().addScaledVector(D, s + 0.026), dir: D };
  }
  // embout coudé à 90° : tige droite (drop), coude de rayon rb, douille
  const D2 = v3(e.elbow).normalize(), rs = d * 0.42 + 0.0015, rb = e.rb ?? Math.max(0.012, d * 1.3), drop = e.drop ?? 0;
  const S = P.clone().addScaledVector(D, s), S1 = S.clone().addScaledVector(D, drop + 0.002);
  const E = S1.clone().addScaledVector(D, rb).addScaledVector(D2, rb);
  const arc = fillet([S, S1.clone().addScaledVector(D, rb), E.clone().addScaledVector(D2, 0.004)], rb).pts;
  out.push(m(tubeGeo(arc, rs, 10), 'zincClear'));
  out.push(aim(m(ferrule(d), 'zincClear'), E, D2));
  return { meshes: out, start: E.clone().addScaledVector(D2, 0.026), dir: D2 };
}

/* Boyau complet ------------------------------------------------------ */
function hoseLine(id, { a, b, via = [], d = D38, R = null, lead = 0.010, bands = [] }) {
  const ea = makeEnd(a, d), eb = makeEnd(b, d);
  const R0 = R ?? 5.6 * d;
  const vp = via.map((v) => (Array.isArray(v) || v.isVector3 ? v3(v) : v3(v.p))), vr = via.map((v) => (Array.isArray(v) || v.isVector3 ? R0 : v.r));
  const P = [ea.start, ea.start.clone().addScaledVector(ea.dir, lead), ...vp, eb.start.clone().addScaledVector(eb.dir, lead), eb.start];
  const { pts, rmin, rminAt } = fillet(P, [R0, R0, ...vr, R0, R0]);
  const r = HR(d), radial = d > 0.011 ? 12 : 10;
  const meshes = [m(tubeGeo(pts, r, radial), 'hose'), ...ea.meshes, ...eb.meshes];
  // bagues de repérage jaunes
  if (bands.length) {
    const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
    const Ltot = cum[cum.length - 1];
    for (const f of bands) {
      const L = f * Ltot; let i = 1; while (i < pts.length - 1 && cum[i] < L) i++;
      const t = (L - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1]);
      const p = pts[i - 1].clone().lerp(pts[i], t), dir = pts[i].clone().sub(pts[i - 1]).normalize();
      const g = G.lathe([[r * 1.02, -0.007], [r * 1.12, -0.006], [r * 1.12, 0.006], [r * 1.02, 0.007]], 16);
      meshes.push(aim(m(g, 'yellow'), p, dir));
    }
  }
  DEBUG.lines.push({ id, pts, r, d, rmin, rminAt });
  if (rmin < 4.6 * d) DEBUG.warn.push(`${id} rayon ${(rmin * 1000).toFixed(0)} mm < 5d @${rminAt}`);
  return meshes;
}
/** Collier de serrage (attache) autour d'un faisceau : anneau ovale. c centre, axis direction du faisceau. */
function tie(c, axis, rw, rh = rw, roll = 0) {
  const pts = [];
  for (let k = 0; k <= 24; k++) { const a = k / 24 * Math.PI * 2; pts.push(new THREE.Vector3(rw * Math.cos(a), 0, rh * Math.sin(a))); }
  const curve = new THREE.CatmullRomCurve3(pts, true);
  const g = new THREE.TubeGeometry(curve, 24, 0.0018, 5, true);
  const o = m(g, 'polymer'); aim(o, c, axis, roll); return o;
}
/** Passe-fil caoutchouc dans une tôle (normale n). */
function grommet(c, n, r) {
  const g = G.lathe([[r + 0.0004, -0.0055], [r + 0.0045, -0.0055], [r + 0.0045, -0.0035], [r + 0.0028, -0.003], [r + 0.0028, 0.003], [r + 0.0045, 0.0035], [r + 0.0045, 0.0055], [r + 0.0004, 0.0055]], 18);
  return aim(m(g, 'rubber'), c, n);
}
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/* ------------------------------------------------------------------ */
/* Raccords des autres modules (positions relevées, repère monde)      */
/* ------------------------------------------------------------------ */
// Socle : banc 14.2.1 (ports A en haut, B en bas, vers +X), raccords tournants 14.6, lumière de la poutre avant.
const BANK = { x6: -1.2421, x8: -1.2381, yA: 1.103, yB: 1.048, z: (k) => -0.178 + 0.0243 + 0.0486 * k };
const bankPort = (k, ab) => ({ tip: [k >= 5 ? BANK.x8 : BANK.x6, ab === 'A' ? BANK.yA : BANK.yB, BANK.z(k)], dir: [1, 0, 0], cover: 0.012 });
const SWX = { F: -1.185, M: -1.15, R: -1.115 }, SW_TOP = 0.9375, SW_BOT = 0.79;
const swTop = (row, z) => ({ tip: [SWX[row], SW_TOP, z], dir: [0, 1, 0], cover: 0.012 });
const SLOT = { x: -1.47, y: 1.289 };
// Grue : couronne, vérins de levage, vérin télescopique, brides en P, collier Stauff, plaque de raccords, chaîne.
const SLEW_FIT = [[-1.033, 1.535, 0.205], [-1.011, 1.535, 0.205]];
const LIFT_U = [-0.9668, -0.2555, 0];
const LIFT_EL = { 1: [-1.0716, 1.6480, 0.205], 2: [-1.0460, 1.6217, 0.205], 3: [-1.0635, 1.6171, -0.205], 4: [-1.0542, 1.6526, -0.205] };
const TELE_FIT = [[-1.269, 1.932, 0], [-1.233, 1.932, 0]];
const PCLAMP = [[-1.302, 1.6852, -0.038], [-1.330, 1.6852, -0.008], [-1.358, 1.6852, 0.022]];
const STAUFF = { x: -0.6787, y: [1.723, 1.691], z: [-0.0485, -0.0165, 0.0165, 0.0485] };
const BH = { x: [-0.230, -0.200, -0.170, -0.140], z: [-0.088, -0.128], yBot: 1.6836, yTip: 1.7348 };
const CH = { xfe: -0.4197, xme: 0.0, yl: 1.887, yu: 2.032, R: 0.0725, z: -0.20, xc: -0.97347 };
// Pince : actionneur de poignet, raccords tournants 5.7.1, trou oblong du support en U, support de boyaux, vérin d'inclinaison, valve.
const WRIST_FIT = [[0.2942, 1.7220, -0.03], [0.2942, 1.7220, 0.03]], WRIST_DIR = [0.5195, 0.8545, 0];
const GSW = { 2: [0.1785, 1.584, 0.0135], 3: [0.1785, 1.584, -0.0135] };
const SLOTG = { c: [0.192, 1.5435, -0.1153], n: [0, 0.5563, 0.8310] };
const TILT_EL = [[0.097, 1.3239, -0.1422], [0.097, 1.3068, -0.1784]], TILT_DIR = [0, -0.4277, -0.9039];
const ADAPT29 = [0.254, 1.239, -0.137];
const VALVE_B = [0.237, 1.180, -0.115];   // 2e orifice de la valve de pince (adaptateur ajouté ici)
// Châssis et socle : valves de déplacement, moteurs, valves d'équilibrage, tés, stabilisateurs.
const TRAM_X = [-1.073, -1.0264, -0.9798, -0.9332, -0.8866];
const tramPort = (k, ab) => { const big = (ab === 'A' && k < 3) || (ab === 'B' && k === 0); return { tip: [TRAM_X[k], ab === 'A' ? 0.942 : 0.887, big ? 0.6232 : 0.6311], dir: [0, 0, -1], cover: 0.012 }; };
const DANGLE = (k) => [TRAM_X[k], 0.728, 0.572];        // bouts des boyaux ped-dv-hoses (écrou vers le bas)
const MOT = { p: [-0.9315, -0.8615], n: [0.8615, 0.9315], y: 0.2085, z: 0.3742 };
const CBV = { x: 0.02, yTop: 0.6029, yBot: 0.4371, zEl: 0.2356, yC: [0.545, 0.495], xC: { n: 0.092, p: -0.052 }, zC: 0.2635 };
const TEE = { x: 1.1525, y: 0.42, z: 0.52, xb: 1.1285 };
const STAB = { y: 0.626, z: 0.751, x: { 1: [1.307, 1.263], 2: [1.263, 1.307], 3: [-1.233, -1.277], 4: [-1.277, -1.233] } };
// Trous d'allègement des longerons (y = 0,515, r = 52,5 mm), âmes à |z| = 0,416 et 0,284.
const HOLE = { y: 0.515, xA: -1.03, xB: -0.853, xF: 1.018, zo: 0.416, zi: 0.284 };
const HA = [[-0.021, 0.012], [-0.011, -0.012], [0, 0.012], [0.011, -0.012], [0.021, 0.012]];       // trou A : 5 places triées en x
const HB = [[-0.034, 0.010], [-0.022, -0.012], [-0.010, 0.010], [0.002, -0.012], [0.012, 0.010]];  // trou B (équerre du châssis à x = -0,83)
const hA = (k) => [HOLE.xA + HA[k][0], HOLE.y + HA[k][1]], hB = (k) => [HOLE.xB + HB[k][0], HOLE.y + HB[k][1]];
const WEB = 0.50;                                                         // âme des plaques pliées 18 et 19
const GROM = [[-0.9798, 0.598], [-0.9565, 0.548], [-0.9332, 0.598], [-0.9099, 0.548], [-0.8633, 0.598]]; // passe-fils de la plaque 19 (groupe B), sous les ports
/* ------------------------------------------------------------------ */
/* 1. Socle : banc de valves vers raccords tournants (intérieur)        */
/* ------------------------------------------------------------------ */
const BANK_TO_SW = [
  // [section, port, rangée, z du raccord tournant]
  [0, 'A', 'R', -0.084], [1, 'A', 'R', -0.042], [0, 'B', 'M', -0.063], [2, 'A', 'M', -0.021], [2, 'B', 'F', -0.042],
  [3, 'A', 'M', 0.021], [4, 'A', 'R', 0.042], [4, 'B', 'F', 0.042], [5, 'A', 'R', 0.084],
];
function pedCircuit() {
  const hs = [];
  for (const [k, ab, row, z] of BANK_TO_SW) {
    const a = bankPort(k, ab), b = swTop(row, z), d = k >= 5 ? D12 : D38;
    const yv = ab === 'A' ? BANK.yA + 0.004 + (row === 'R' ? 0.008 : 0) : BANK.yB;
    hs.push(...hoseLine(`ped-${k}${ab}`, { a, b, d, via: [[SWX[row], yv, z]], R: ab === 'A' ? 5.2 * d : 0.022 }));
  }
  // raccord tournant libre (réserve) : bouchons
  const cap = [];
  for (const [y, s] of [[SW_TOP, 1], [SW_BOT, -1]]) {
    cap.push(hexAt([SWX.M, y - s * 0.012, 0.063], [0, s, 0], NUT(D38), 0.017));
    cap.push(cylAt([SWX.M, y + s * 0.005, 0.063], [0, s, 0], 0.0065, 0.004));
  }
  return asm({ id: 'hose-ped', sec: '14', fr: 'Boyaux internes du socle', en: 'Pedestal internal hoses', qty: '9', page: 69, approx: true, attachTo: 'pedestal',
    explode: [-0.30, 0.10, 0], note: 'Banc de valves à 10 leviers vers la plaque de raccords tournants (14.6). Tracé estimé. Les 3 boyaux ped-hoses du module socle complètent le banc.' }, [
    part({ id: 'hose-ped-bank', sec: '14', fr: 'Boyaux banc vers raccords tournants', en: 'Valve bank to swivel hoses', qty: '9', page: 69, approx: true, explode: [0, 0.10, 0],
      note: '9 boyaux 3/8 po (1/2 po pour le levage). Ports A et B du banc vers le dessus des raccords tournants.' }, hs),
    part({ id: 'hose-ped-caps', sec: '14', fr: 'Bouchons du raccord tournant de réserve', en: 'Spare swivel caps', qty: '2', page: 69, approx: true, explode: [0, 0.16, 0] }, cap),
  ]);
}

/* ------------------------------------------------------------------ */
/* 2. Socle vers grue : raccords tournants -> lumière avant -> tourelle  */
/* ------------------------------------------------------------------ */
// Départs sous la plaque (embouts coudés vers ±Z) : [rangée, z, niveau, z de montée, x de montée, fonction]
// Une même rangée : le raccord le plus à l'extérieur part le plus haut et monte le plus près du centre (pas de croisement).
const SW_BOTTOM = [
  ['M', -0.021, 0.735, -0.355, -1.098, 'boom'], ['M', -0.063, 0.756, -0.330, -1.098, 'boom'],
  ['R', -0.042, 0.735, -0.290, -1.115, 'boom'], ['R', -0.084, 0.756, -0.265, -1.115, 'boom'],
  ['F', 0.000, 0.714, -0.240, -1.185, 'boom'], ['F', -0.042, 0.735, -0.215, -1.185, 'boom'], ['F', -0.084, 0.756, -0.190, -1.185, 'boom'],
  ['F', 0.084, 0.756, 0.190, -1.185, 'hoist'], ['F', 0.042, 0.735, 0.215, -1.185, 'tele'],
  ['R', 0.084, 0.756, 0.240, -1.115, 'hoist'], ['R', 0.042, 0.735, 0.265, -1.115, 'tele'],
  ['M', 0.021, 0.735, 0.300, -1.098, 'boom'],
];
const slotZ = (i) => -0.195 + 0.030 * i;   // 14 boyaux dans la lumière de la poutre avant
const XL = -1.60;                          // montée de la boucle de service, devant le socle
function mastCircuit() {
  const out = { boom: [], tele: [], hoist: [], slew: [] };
  const rise = [];   // { zr, a, via, d, fn }
  SW_BOTTOM.forEach(([row, z, lvl, zr, xr, fn]) => {
    const sg = z > 0 ? 1 : -1;
    const a = { tip: [SWX[row], SW_BOT, z], dir: [0, -1, 0], cover: 0.012, elbow: [0, 0, sg], drop: Math.max(0, 0.768 - lvl), rb: 0.015 };
    const via = row === 'M' ? [[SWX.M, lvl, zr - sg * 0.022], [xr, lvl, zr]] : [[xr, lvl, zr]];
    via.push([xr, SLOT.y, zr]);
    rise.push({ zr, xr, a, via, d: fn === 'hoist' ? D12 : D38, fn });
  });
  // rotation (section 7) : directement du banc, montée à l'intérieur du rideau +Z
  [['A', 0.138, -1.130], ['B', 0.160, -1.100]].forEach(([ab, zr, xr]) => {
    const y0 = ab === 'A' ? BANK.yA : BANK.yB;
    rise.push({ zr, xr, a: bankPort(6, ab), via: [[xr, y0, zr], [xr, SLOT.y, zr]], d: D12, fn: 'slew' });
  });
  // ordre dans la lumière = ordre des z de montée (convergence sans croisement)
  rise.sort((p, q) => p.zr - q.zr).forEach((l, i) => {
    l.zs = slotZ(i);
    l.via.push([-1.27, SLOT.y, l.zr], [-1.43, SLOT.y, l.zs], [-1.50, SLOT.y, l.zs], [XL, SLOT.y, l.zs]);
  });
  // flèche : 8 boyaux -> brides en P et tunnel sous J2 -> collier Stauff -> dessous de la plaque de raccords
  const TUN = { up: { y: 1.685, z: [-0.068, -0.038, -0.008, 0.022] }, lo: { y: 1.663, z: [-0.053, -0.023, 0.007, 0.037] } };
  const XS = [-0.62, -0.52, -0.42, -0.32];   // interpolation synchronisée Stauff -> plaque
  rise.filter((l) => l.fn === 'boom').sort((p, q) => p.zs - q.zs).forEach((l, k) => {
    const lay = k % 2 === 0 ? 'up' : 'lo', j = k >> 1, ty = TUN[lay].y, tz = TUN[lay].z[j];
    const sy = lay === 'up' ? STAUFF.y[0] : STAUFF.y[1], sz = STAUFF.z[j];
    // grille Stauff (4 z x 2 y) tournée de 90° vers la grille de la plaque (4 colonnes x 2 rangées)
    const zrow = lay === 'up' ? BH.z[0] : BH.z[1], lvl = 1.580 - 0.018 * j, bx = BH.x[j];
    const pS = [XS[0], sy, sz], pB = [XS[3], lvl, zrow];
    l.b = { tip: [bx, BH.yBot, zrow], dir: [0, -1, 0], cover: 0 };
    l.via = [...l.via, [XL, ty, l.zs], [-1.50, ty, tz], [-1.40, ty, tz], [-1.105, ty, tz], [-0.95, ty + 0.012, tz * 0.6 + sz * 0.4],
      [STAUFF.x - 0.07, sy, sz], [STAUFF.x + 0.03, sy, sz], pS, lerp3(pS, pB, 1 / 3), lerp3(pS, pB, 2 / 3), pB, [bx, lvl, zrow]];
    l.R = 0.052;
    out.boom.push(...hoseLine(`mast-boom-${k + 1}`, l));
  });
  // vérin télescopique : remontée verticale devant le socle, entrée par l'arrière de la flèche (embouts coudés)
  rise.filter((l) => l.fn === 'tele').sort((p, q) => p.zs - q.zs).forEach((l, k) => {
    const yh = k === 0 ? 1.950 : 1.970, zv = k === 0 ? -0.012 : 0.012;
    l.b = { tip: TELE_FIT[k], dir: [0, 1, 0], nut: false, elbow: [-1, 0, 0], drop: k === 0 ? 0.0 : 0.020, rb: 0.016 };
    l.via = [...l.via, [XL, 1.72, l.zs], [XL, 1.86, zv], [XL, yh, zv], [-1.42, yh, zv], [-1.34, yh, 0.0]];
    l.R = 0.06;
    out.tele.push(...hoseLine(`mast-tele-${k + 1}`, l));
  });
  // levage : vers les tés montés sur les coudes du vérin +Z
  const teeRun = (n) => v3(LIFT_EL[n]).addScaledVector(v3(LIFT_U), 0.046).toArray();
  rise.filter((l) => l.fn === 'hoist').sort((p, q) => p.zs - q.zs).forEach((l, k) => {
    const tr = teeRun(k === 0 ? 2 : 1), yh = tr[1];
    l.b = { tip: tr, dir: LIFT_U, cover: 0.010 };
    l.via = [...l.via, [XL, yh, l.zs], [-1.46, yh, 0.205], [-1.20, yh + 0.004, 0.205]];
    l.R = 0.07;
    out.hoist.push(...hoseLine(`mast-hoist-${k + 1}`, l));
  });
  // rotation : par-dessus le socle, côté +Z, jusqu'au moteur de la couronne (embouts coudés vers +Z)
  rise.filter((l) => l.fn === 'slew').sort((p, q) => p.zs - q.zs).forEach((l, k) => {
    const f = SLEW_FIT[k], lane = k === 0 ? 0.355 : 0.385, y = 1.553;
    l.b = { tip: f, dir: [0, 1, 0], nut: false, elbow: [0, 0, 1], drop: 0.0, rb: 0.016 };
    // diagonale vers les voies : coins décalés pour garder 30 mm entre axes (virages concentriques)
    const c1 = k === 0 ? { p: [-1.502, y, l.zs], r: 0.08 } : { p: [-1.525, y, l.zs], r: 0.05 };
    const c2 = k === 0 ? { p: [-1.407, y, lane], r: 0.05 } : { p: [-1.43, y, lane], r: 0.08 };
    l.via = [...l.via, [XL, y, l.zs], c1, c2, { p: [f[0], y, lane], r: k === 0 ? 0.075 : 0.105 }];
    l.R = 0.07;
    out.slew.push(...hoseLine(`mast-slew-${k + 1}`, l));
  });
  // 2 attaches sur la montée de la boucle de service (14 boyaux en nappe devant le socle)
  const ties = [1.40, 1.46].map((y) => tie([XL, y, 0], [0, 1, 0], HR(D12) + 0.003, -slotZ(0) + HR(D12) + 0.003));
  const kids = [
    part({ id: 'hose-mast-ties', sec: '10', fr: 'Attaches de la boucle de service', en: 'Service loop ties', qty: '2', page: 45, approx: true, explode: [-0.08, 0, 0] }, ties),
    part({ id: 'hose-mast-boom', sec: '10', fr: 'Boyaux du socle vers la flèche', en: 'Pedestal to boom hoses', qty: '8', page: 45, approx: true, explode: [0, 0.10, -0.10],
      note: 'Lumière avant du socle, boucle de service, brides en P et tunnel sous l\'axe J2, collier Stauff, dessous de la plaque de raccords de flèche.' }, out.boom),
    part({ id: 'hose-mast-tele', sec: '10', fr: 'Boyaux du vérin télescopique', en: 'Telescopic cylinder hoses', qty: '2', page: 49, approx: true, explode: [0, 0.18, 0],
      note: 'Entrée par l\'arrière de la flèche, embouts coudés sur les raccords du bloc de valve.' }, out.tele),
    part({ id: 'hose-mast-hoist', sec: '10', fr: 'Boyaux de levage', en: 'Hoist hoses', qty: '2', page: 45, approx: true, explode: [0, 0.08, 0.12], note: 'Boyaux 1/2 po vers les tés du vérin de levage +Z.' }, out.hoist),
    part({ id: 'hose-mast-slew', sec: '10.1', fr: 'Boyaux du moteur de rotation', en: 'Slew motor hoses', qty: '2', page: 46, approx: true, explode: [0, 0.06, 0.20], note: 'Le moteur est fixe (côté socle de la couronne) : pas de raccord tournant.' }, out.slew),
  ];
  return asm({ id: 'hose-mast', sec: '10', fr: 'Boyaux du socle vers la grue', en: 'Pedestal to crane hoses', qty: '14', page: 45, approx: true,
    explode: [-0.45, 0.25, 0], note: 'Relie le socle à la grue : masqué quand la machine est éclatée.' }, kids);
}

/* ------------------------------------------------------------------ */
/* 3. Grue : tés et boyaux de liaison des 2 vérins de levage            */
/* ------------------------------------------------------------------ */
function teeOn(n, branch) {
  const T = v3(LIFT_EL[n]), U = v3(LIFT_U), Bd = v3(branch).normalize(), g = [];
  g.push(hexAt(T.clone().addScaledVector(U, -0.004), U, NUT(D38), 0.016));
  const c = T.clone().addScaledVector(U, 0.024);
  const body = m(G.box(0.022, 0.022, 0.022, 0.003), 'zincClear'); body.position.copy(c);
  body.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(U, new THREE.Vector3().crossVectors(Bd, U), Bd)); g.push(body);
  g.push(cylAt(c.clone().addScaledVector(U, 0.010), U, 0.0075, 0.012));
  g.push(cylAt(c.clone().addScaledVector(Bd, 0.010), Bd, 0.0075, 0.016));
  return { meshes: g, branchTip: c.clone().addScaledVector(Bd, 0.026).toArray() };
}
function liftCircuit() {
  const t2 = teeOn(2, [0, 0, 1]), t1 = teeOn(1, [0, 0, 1]), hs = [];
  // té du coude 1 (haut, +Z) -> coude 3 (bas, -Z) ; té du coude 2 (bas, +Z) -> coude 4 (haut, -Z). Passage derrière la base de levage.
  const b1 = t1.branchTip, b2 = t2.branchTip;
  hs.push(...hoseLine('lift-cross-1', { a: { tip: b1, dir: [0, 0, 1], cover: 0.010 }, b: { tip: LIFT_EL[3], dir: LIFT_U, cover: 0.0 }, d: D38, R: 0.05,
    via: [[b1[0], b1[1], 0.33], [-1.37, 1.58, 0.33], [-1.37, 1.58, -0.33], [-1.26, 1.616, -0.33], [-1.17, 1.616, -0.205]] }));
  hs.push(...hoseLine('lift-cross-2', { a: { tip: b2, dir: [0, 0, 1], cover: 0.010 }, b: { tip: LIFT_EL[4], dir: LIFT_U, cover: 0.0 }, d: D38, R: 0.05,
    via: [[b2[0], b2[1], 0.30], [-1.34, 1.58, 0.30], [-1.34, 1.58, -0.21], [-1.30, 1.655, -0.30], [-1.17, 1.655, -0.205]] }));
  return asm({ id: 'hose-lift', sec: '10', fr: 'Boyaux de liaison des vérins de levage', en: 'Lift cylinder cross-over hoses', qty: '2', page: 45, approx: true, attachTo: 'lowerCrane',
    explode: [-0.20, 0.45, 0], note: 'Deux tés sur les coudes du vérin +Z ; les boyaux passent derrière la base de levage vers le vérin -Z.' }, [
    part({ id: 'hose-lift-tees', sec: '10', fr: 'Tés de raccordement', en: 'Run tees', qty: '2', page: 45, approx: true, explode: [0, 0.05, 0.08] }, [...t1.meshes, ...t2.meshes]),
    part({ id: 'hose-lift-cross', sec: '10', fr: 'Boyaux de liaison', en: 'Cross-over hoses', qty: '2', page: 45, approx: true, explode: [-0.10, 0.10, 0] }, hs),
  ]);
}

/* ------------------------------------------------------------------ */
/* 4. Flèche vers pince : plaque de raccords -> chaîne -> pince          */
/* ------------------------------------------------------------------ */
// voies de la chaîne : 4 en z ; couche 0 = extérieur de la boucle (dessous du brin bas, dessus du brin haut)
const LANE = [-0.2255, -0.2085, -0.1915, -0.1745], LAYER = [0.009, -0.009];
function chainVia(z, rho, short) {
  const xl = CH.xc - (CH.R + rho), rr = CH.R + rho;
  const v = [[CH.xfe + 0.035, CH.yl - rho, z], { p: [xl, CH.yl - rho, z], r: rr }, { p: [xl, CH.yu + rho, z], r: rr }, [CH.xme - 0.02, CH.yu + rho, z]];
  if (!short) v.push([CH.xme + 0.02, CH.yu + rho, z]);
  return v;
}
function gripCircuit() {
  const parts = { wrist: [], rotate: [], tilt: [], clamp: [] }, extra = [];
  // côté pince, par case de sortie [couche][voie]
  const DEST = [['rotate3', 'rotate2', 'wrist0', 'wrist1'], ['clamp29', 'clampB', 'tiltE2', 'tiltE1']];
  for (let col = 0; col < 4; col++) for (let row = 0; row < 2; row++) {
    // rangée -0,128 : groupe bas (couche 0) ; rangée -0,088 : groupe haut (couche 1), qui passe par-dessus
    const fx = BH.x[col], fz = BH.z[row], ly = row === 1 ? 0 : 1, ln = 3 - col;
    const lvl = ly === 0 ? 1.792 + 0.017 * col : 1.862 + 0.017 * col;
    const zr = ly === 0 ? -0.180 - 0.010 * col : -0.150 - 0.020 * col;
    const z = LANE[ln], rho = LAYER[ly];
    const a = { tip: [fx + 0.0198, BH.yTip, fz], dir: [0.7071, 0.7071, 0], nut: false };
    // nez à 45° : virage vers -Z (montée faible), puis recul vers l'entrée fixe de la chaîne
    const entry = [[fx + 0.042, ly === 0 ? 1.788 : 1.806, fz - 0.03], [fx + 0.028, lvl, zr], [fx - 0.03, lvl, zr - 0.004],
      [Math.min(fx - 0.08, -0.25), lvl, zr], [-0.33, CH.yl - rho, z]];
    const yc = CH.yu + rho, dst = DEST[ly][ln];
    let b, tail;
    if (dst.startsWith('wrist')) {
      const f = WRIST_FIT[+dst[5]];
      b = { tip: f, dir: WRIST_DIR, nut: false };
      tail = [[0.08, yc - 0.004, z + 0.012 + 0.012 * (+dst[5])], [0.21, 1.990 - 0.010 * (+dst[5]), f[2] * 0.6 - 0.035], [0.37, 1.875, f[2]], [0.345, 1.80, f[2]]];
    } else if (dst.startsWith('rotate')) {
      const n = +dst[6], sw = GSW[n], xs = n === 2 ? 0.200 : 0.160, zo = n === 2 ? -0.238 : -0.258;
      b = { tip: sw, dir: [0, 1, 0], cover: 0.014, elbow: [0, 0, -1], drop: n === 2 ? 0.020 : 0.0, rb: 0.014 };
      const hn = v3(SLOTG.n), hc = v3(SLOTG.c); hc.x = xs;
      const pl = hc.clone().addScaledVector(hn, (zo - SLOTG.c[2]) / hn.z);
      const pout = hc.clone().addScaledVector(hn, -0.05), pin = hc.clone().addScaledVector(hn, 0.03);
      tail = [[0.08, yc, z], [xs - 0.04, 1.96, zo], [xs, 1.80, zo], { p: pl.toArray(), r: 0.05 }, pout.toArray(), pin.toArray(), [sw[0], sw[1] + 0.019 + (n === 2 ? 0.020 : 0), n === 2 ? -0.075 : -0.085]];
    } else {
      // descente immédiate devant la bride, passage sous la plaque de poignet, long de la tige du support de boyaux (côté -X)
      const zrod = [-0.027, -0.009, 0.009, 0.027][ln];
      const zs = -0.20 + (ln - 1.5) * 0.026;
      // sortie de chaîne : virage vers le bas ; puis nappe étagée en y sous la plaque de poignet (virages concentriques), puis long de la tige
      const yh = 1.625 - 0.022 * (3 - ln);
      const top = [{ p: [0.052, yc, z], r: 0.050 }, [0.052, 1.80, zs], { p: [0.046, yh, zs], r: 0.048 + 0.022 * (3 - ln) },
        { p: [-0.056, yh, zrod], r: 0.048 + 0.020 * ln }, [-0.056, 1.40, zrod], { p: [-0.060, 1.345 - 0.020 * ln, zrod], r: 0.05 }];
      // bas de la tige : le boyau le plus à -Z sort le premier (le plus haut), les valves de pince au-dessus du vérin
      if (dst === 'tiltE2' || dst === 'tiltE1') {
        const e = TILT_EL[dst === 'tiltE1' ? 0 : 1], k = dst === 'tiltE1' ? 1 : 0;
        b = { tip: e, dir: TILT_DIR, cover: 0.0 };
        tail = [...top, [0.0, k ? 1.282 : 1.300, -0.090 - 0.022 * (1 - k)], [0.065, k ? 1.280 : 1.296, -0.262 + 0.020 * k]];
      } else if (dst === 'clamp29') {
        b = { tip: ADAPT29, dir: [0, 1, 0], cover: 0.0 };
        tail = [...top, [0.02, 1.345, -0.085], [0.19, 1.345, -0.105], [ADAPT29[0], 1.345, ADAPT29[2]]];
      } else {
        const tipB = [VALVE_B[0], VALVE_B[1], VALVE_B[2] - 0.020];
        b = { tip: tipB, dir: [0, 0, -1], cover: 0.010, elbow: [0, 1, 0], drop: 0.0, rb: 0.016 };
        tail = [...top, [0.02, 1.325, -0.105], [0.15, 1.326, -0.20], [tipB[0], 1.31, -0.165]];
        extra.push(hexAt(VALVE_B, [0, 0, -1], 0.019, 0.008), cylAt(v3(VALVE_B).add(new THREE.Vector3(0, 0, -0.008)), [0, 0, -1], 0.0068, 0.012));
      }
    }
    const fn = dst.startsWith('clamp') ? 'clamp' : dst.replace(/[0-9A-Z].*$/, '');
    parts[fn].push(...hoseLine(`grip-${dst}`, { a, b, via: [...entry, ...chainVia(z, rho, ly === 1), ...tail], d: D38, R: 0.05 }));
  }
  // attaches du faisceau sur le support de boyaux (tige pliée)
  extra.push(tie([-0.049, 1.43, 0], [0, 1, 0], 0.017, 0.038), tie([-0.049, 1.48, 0], [0, 1, 0], 0.017, 0.038));
  const kids = [
    part({ id: 'hose-grip-wrist', sec: '5', fr: 'Boyaux de l\'actionneur de poignet', en: 'Wrist actuator hoses', qty: '2', page: 10, approx: true, explode: [0.10, 0.12, 0.10] }, parts.wrist),
    part({ id: 'hose-grip-rotate', sec: '5', fr: 'Boyaux de rotation (vers raccords tournants)', en: 'Rotate hoses (to live swivels)', qty: '2', page: 10, approx: true, explode: [0.05, 0.05, -0.12],
      note: 'Passent par le trou oblong du support en U et arrivent sur les raccords tournants 2 et 3 (5.7.1).' }, parts.rotate),
    part({ id: 'hose-grip-tilt', sec: '5', fr: 'Boyaux du vérin d\'inclinaison', en: 'Tilt cylinder hoses', qty: '2', page: 10, approx: true, explode: [-0.08, -0.05, -0.08] }, parts.tilt),
    part({ id: 'hose-grip-clamp', sec: '5', fr: 'Boyaux de la valve de pince', en: 'Gripper valve hoses', qty: '2', page: 21, approx: true, explode: [-0.08, -0.10, -0.12] }, parts.clamp),
    part({ id: 'hose-grip-misc', sec: '5', fr: 'Attaches et adaptateur de valve', en: 'Ties and valve adapter', qty: '-', page: 21, approx: true, explode: [-0.06, 0, 0],
      note: 'Adaptateur droit ajouté sur le 2e orifice de la valve de maintien (non dessiné au module pince).' }, extra),
  ];
  return asm({ id: 'hose-grip', sec: '10.3.1', fr: 'Boyaux de la flèche vers la pince', en: 'Boom to gripper hoses', qty: '8', page: 50, approx: true,
    explode: [0.45, 0.30, 0], note: 'Du dessus de la plaque de raccords de flèche (10.3.2.1) à la pince, par la chaîne porte-câbles. Relie la grue à la pince.' }, kids);
}

/* ------------------------------------------------------------------ */
/* 5. Déplacement : valves 14.5 vers moteurs et valves d'équilibrage    */
/* ------------------------------------------------------------------ */
function union(k) {
  const p = DANGLE(k), g = [];
  g.push(cylAt([p[0], p[1] + 0.006, p[2]], [0, -1, 0], 0.0072, 0.008));
  g.push(hexAt([p[0], p[1] - 0.002, p[2]], [0, -1, 0], NUT(D38) * 1.02, 0.012));
  g.push(cylAt([p[0], p[1] - 0.014, p[2]], [0, -1, 0], 0.0072, 0.012));
  return { meshes: g, tip: [p[0], p[1] - 0.026, p[2]] };
}
/** Descente entre le flanc +Z du socle et la plaque des valves. Les ports A descendent entre les boyaux existants (x + 0,0233). */
function descent(s, k, ab, zd) {
  const t = s.tip;
  if (s.dir[1] < 0) return { x: t[0], via: [[t[0], 0.645, zd]] };                      // sous un raccord union
  const x = ab === 'A' ? t[0] + 0.0233 : t[0], zv = Math.min(zd, 0.548);
  return { x, via: [[x, t[1] - 0.004, zv], [x, 0.70, zv], [x, 0.63, zd]] };
}
function driveCircuit() {
  const mot = [], cbv = [], ret = [], uni = [], grm = [];
  const U = {}; for (const k of [0, 1, 3, 4]) { U[k] = union(k); uni.push(...U[k].meshes); }
  const src = (k, ab) => ((ab === 'B' && U[k]) ? { tip: U[k].tip, dir: [0, -1, 0], cover: 0.010 } : tramPort(k, ab));
  // Groupe A (trou A du longeron +Z) : passage sous l'âme de la plaque pliée 19 (la chenille est basse à cet endroit).
  // [section, port, place du trou, x du port moteur, côté du moteur, voie (y, z) dans le châssis]
  [[0, 'B', 1, MOT.p[0], 1, [0.0, 0.198]], [0, 'A', 2, MOT.p[1], 1, [0.0, 0.173]], [1, 'B', 3, MOT.n[0], -1, [0.392, 0.070]], [1, 'A', 4, MOT.n[1], -1, [0.418, 0.100]]].forEach(([k, ab, h, xm, side, lane], i) => {
    const s = src(k, ab), dsc = descent(s, k, ab, 0.572), hp = hA(h), up = h % 2 === 0;
    const yw = up ? 0.485 : 0.462;   // sous l'âme (bas à y = 0,50) : deux rangs parallèles
    const via = [...dsc.via, [dsc.x, yw, 0.572], [hp[0], yw, 0.47], [hp[0], hp[1], HOLE.zo + 0.022], [hp[0], hp[1], HOLE.zi - 0.022]];
    const tip = [xm, MOT.y, side * MOT.z];
    if (side > 0) via.push([hp[0], hp[1], lane[1]], [hp[0], MOT.y, lane[1]], [xm, MOT.y, lane[1]]);
    else via.push([hp[0] + 0.07, lane[0], lane[1]], [0.78, lane[0], lane[1]], [xm, lane[0] - 0.06, lane[1] * 0.5 - 0.06], [xm, MOT.y, -0.20]);
    mot.push(...hoseLine(`drive-motor-${i + 1}`, { a: s, b: { tip, dir: [0, 0, -side], nut: false }, via, d: D12, R: 0.064 }));
  });
  // Groupe B (trou B) : passe-fils dans l'âme de la plaque 19, puis voies du centre du châssis.
  // [section, port, passe-fil/place, destination, voie (y, z)]
  const cbvEl = (top, side) => ({ tip: [CBV.x, top ? CBV.yTop : CBV.yBot, side * CBV.zEl], dir: [0, 0, -side], nut: false });
  [[2, 'B', 0, cbvEl(true, -1), [0.50, -0.150]], [2, 'A', 1, cbvEl(false, -1), [0.452, -0.150]], [3, 'B', 2, 'tee2', [0.47, 0.0]],
    [3, 'A', 3, cbvEl(false, 1), [0.452, 0.150]], [4, 'A', 4, cbvEl(true, 1), [0.50, 0.150]]].forEach(([k, ab, g, b, lane], i) => {
    const s = src(k, ab), dsc = descent(s, k, ab, 0.556), gp = GROM[g], hp = hB(g);
    const via = [...dsc.via, [gp[0], gp[1], 0.556], [gp[0], gp[1], WEB - 0.03], [hp[0], hp[1], HOLE.zo + 0.022], [hp[0], hp[1], HOLE.zi - 0.022],
      [hp[0], hp[1], lane[1]], [hp[0] + 0.07, lane[0], lane[1]]];
    grm.push(grommet([gp[0], gp[1], WEB], [0, 0, 1], HR(D38)));
    if (b === 'tee2') {
      const hf = [HOLE.xF + 0.017, 0.485];
      via.push([0.90, lane[0], lane[1]], [hf[0], hf[1], 0.20], [hf[0], hf[1], HOLE.zi - 0.022], [hf[0], hf[1], HOLE.zo + 0.022], [1.045, 0.45, 0.48], [1.07, TEE.y, TEE.z]);
      ret.push(...hoseLine('drive-tee2', { a: s, b: { tip: [TEE.xb, TEE.y, TEE.z], dir: [-1, 0, 0], cover: 0.010 }, via, d: D38, R: 0.05 }));
    } else {
      const zt = b.tip[2], top = b.tip[1] > 0.5;
      via.push([-0.08, lane[0], lane[1]], [CBV.x, lane[0], lane[1]]);
      if (top) via.push([CBV.x, b.tip[1], lane[1]]);
      cbv.push(...hoseLine(`drive-cbv-${i + 1}`, { a: s, b, via, d: D38, R: 0.05 }));
      void zt;
    }
  });
  // section 4 port B -> stabilisateur 3 (arrière +Z), rentrée
  {
    const s = src(4, 'B'), f = [STAB.x[3][0], STAB.y, STAB.z];
    ret.push(...hoseLine('drive-stab3-ret', { a: s, b: { tip: f, dir: [0, 0, 1], nut: false }, d: D38, R: 0.05,
      via: [[s.tip[0], 0.605, 0.572], [s.tip[0] - 0.04, 0.615, 0.632], [-1.12, 0.645, 0.632], [-1.17, 0.64, 0.84], { p: [f[0], 0.626, 0.84], r: 0.045 }] }));
  }
  return asm({ id: 'hose-drive', sec: '14.5', fr: 'Boyaux de déplacement et des stabilisateurs', en: 'Drive and outrigger supply hoses', qty: '10', page: 77, approx: true,
    explode: [0, -0.25, 0.45], note: 'Des valves de déplacement (14.5) vers les moteurs de chenilles, les valves d\'équilibrage et les tés. Raccords union sous les boyaux du module socle. Relie le socle au châssis.' }, [
    part({ id: 'hose-drive-motors', sec: '11.1', fr: 'Boyaux des moteurs de chenilles', en: 'Track motor hoses', qty: '4', page: 61, approx: true, explode: [0, -0.10, 0.05], note: 'Boyaux 1/2 po.' }, mot),
    part({ id: 'hose-drive-cbv', sec: '11.2', fr: 'Boyaux vers les valves d\'équilibrage', en: 'Hoses to counterbalance valves', qty: '4', page: 62, approx: true, explode: [0, -0.06, 0.08] }, cbv),
    part({ id: 'hose-drive-retract', sec: '11.3', fr: 'Boyaux de rentrée des stabilisateurs', en: 'Outrigger retract supply hoses', qty: '2', page: 63, approx: true, explode: [0, -0.04, 0.12] }, ret),
    part({ id: 'hose-drive-unions', sec: '14.5', fr: 'Raccords union', en: 'Union fittings', qty: '4', page: 77, approx: true, explode: [0, 0.06, 0.10],
      note: 'Sous les 4 boyaux ped-dv-hoses du module socle.' }, uni),
    part({ id: 'hose-drive-grommets', sec: '11', fr: 'Passe-fils de la plaque pliée 19', en: 'Grommets in formed plate 19', qty: '5', page: 58, approx: true, explode: [0, 0, 0.15],
      note: 'Trous non dessinés dans le module châssis.' }, grm),
  ]);
}

/* ------------------------------------------------------------------ */
/* 6. Châssis : valves d'équilibrage et tés vers les stabilisateurs     */
/* ------------------------------------------------------------------ */
function stabCircuit() {
  const ext = [], ret = [], caps = [];
  const stabEnd = (n, j) => { const s = n === 1 || n === 3 ? 1 : -1; return { tip: [STAB.x[n][j], STAB.y, s * STAB.z], dir: [0, 0, s], nut: false }; };
  const cbvC = (side, j) => ({ tip: [side > 0 ? CBV.xC.p : CBV.xC.n, CBV.yC[j], side * CBV.zC], dir: [side > 0 ? -1 : 1, 0, 0], nut: false });
  // sortie arrière : du trou A vers l'arrière du compartiment, sous l'âme de la plaque pliée (x = -1,10), puis vers le stabilisateur
  // sortie du trou en +Z, diagonale douce vers le dessous de l'âme de la plaque pliée (y = 0,474), puis montée vers le stabilisateur
  const outRear = (s, hp, zf, x0, yo = 0.60, dx = [0.01, 0.04]) => [[hp[0], hp[1], s * (HOLE.zi - 0.022)], [hp[0], hp[1], s * 0.428], [x0, 0.474, s * 0.50],
    [x0, 0.474, s * 0.54], [x0 - dx[0], yo, s * 0.60], [x0 - dx[1], yo + 0.01, s * zf]];
  // cbv-2 (+Z) C2 (bas) -> stab 3 (arrière +Z)
  {
    const hp = [HOLE.xA - 0.021, 0.552], b = stabEnd(3, 1);   // haut du trou A, au-dessus des boyaux de moteurs
    ext.push(...hoseLine('stab-3-ext', { a: cbvC(1, 1), b, d: D38, R: 0.05,
      via: [[-0.12, 0.495, 0.2635], [-0.30, 0.38, 0.250], [-0.90, 0.38, 0.215], { p: [-0.96, 0.38, 0.215], r: 0.045 }, { p: [-0.96, hp[1], 0.215], r: 0.045 }, { p: [hp[0], hp[1], 0.215], r: 0.045 },
        ...outRear(1, hp, 0.88, -1.108, 0.60).slice(1), [b.tip[0], 0.62, 0.88]] }));
  }
  // cbv-2 C1 (haut) -> stab 1 (avant +Z) : demi-tour par le haut, trou avant du longeron +Z (sous l'arrêt d'urgence)
  {
    const hf = [HOLE.xF - 0.006, 0.485], b = stabEnd(1, 0);
    ext.push(...hoseLine('stab-1-ext', { a: cbvC(1, 0), b, d: D38, R: 0.05,
      via: [[-0.12, 0.545, 0.2635], [-0.12, 0.575, 0.19], [0.10, 0.575, 0.19], [0.32, 0.52, 0.19], [0.92, hf[1], 0.20], [hf[0], hf[1], HOLE.zi - 0.022], [hf[0], hf[1], HOLE.zo + 0.022],
        [1.06, 0.49, 0.50], [1.11, 0.49, 0.585], [1.14, 0.56, 0.66], [1.15, 0.62, 0.86], [b.tip[0], 0.66, 0.86]] }));
  }
  // cbv-1 (-Z) C1 (haut) -> stab 2 (avant -Z)
  {
    const hf = [HOLE.xF + 0.017, 0.527], b = stabEnd(2, 1);
    ext.push(...hoseLine('stab-2-ext', { a: cbvC(-1, 0), b, d: D38, R: 0.05,
      via: [[0.32, 0.535, -0.215], [0.92, hf[1], -0.215], [hf[0], hf[1], -(HOLE.zi - 0.022)], [hf[0], hf[1], -(HOLE.zo + 0.022)],
        [1.06, 0.55, -0.50], [1.11, 0.56, -0.585], [1.14, 0.58, -0.66], [1.15, 0.62, -0.86], [b.tip[0], 0.66, -0.86]] }));
  }
  // cbv-1 C2 (bas) -> stab 4 (arrière -Z) : demi-tour, trou A du longeron -Z, sous la plaque pliée 18
  {
    const hp = [HOLE.xA + 0.012, HOLE.y], b = stabEnd(4, 0);
    ext.push(...hoseLine('stab-4-ext', { a: cbvC(-1, 1), b, d: D38, R: 0.05,
      via: [[0.18, 0.495, -0.2635], [0.18, 0.465, -0.19], [-0.30, 0.465, -0.19], [-0.96, 0.465, -0.19], [hp[0], hp[1], -0.22], ...outRear(-1, hp, 0.88, -1.100, 0.61, [0, 0]), [b.tip[0], 0.66, -0.88]] }));
  }
  // tés : sortie extérieure -> rentrée des stabilisateurs avant ; liaison des tés sous les longerons ; té 1 -> rentrée du stabilisateur 4
  const teeOut = (s) => ({ tip: [TEE.x, TEE.y, s * 0.552], dir: [0, 0, s], cover: 0.010 });
  const teeIn = (s) => ({ tip: [TEE.x, TEE.y, s * 0.488], dir: [0, 0, -s], cover: 0.010, elbow: [0, -1, 0], drop: 0, rb: 0.014 });
  ret.push(...hoseLine('stab-1-ret', { a: teeOut(1), b: stabEnd(1, 1), d: D38, R: 0.05, via: [[TEE.x, TEE.y, 0.66], [1.18, 0.50, 0.82], [1.21, 0.60, 0.84], { p: [STAB.x[1][1], 0.626, 0.84], r: 0.045 }] }));
  ret.push(...hoseLine('stab-2-ret', { a: teeOut(-1), b: stabEnd(2, 0), d: D38, R: 0.05, via: [[TEE.x, TEE.y, -0.66], [1.18, 0.50, -0.82], [1.21, 0.60, -0.84], { p: [STAB.x[2][0], 0.626, -0.84], r: 0.045 }] }));
  ret.push(...hoseLine('stab-tee-link', { a: teeIn(1), b: teeIn(-1), d: D38, R: 0.05, via: [[TEE.x, 0.30, 0.465], [TEE.x, 0.30, -0.465]] }));
  {
    const hf = [HOLE.xF - 0.006, 0.49], hp = [HOLE.xA - 0.012, HOLE.y], b = stabEnd(4, 1);
    ret.push(...hoseLine('stab-4-ret', { a: { tip: [TEE.xb, TEE.y, -TEE.z], dir: [-1, 0, 0], cover: 0.010 }, b, d: D38, R: 0.05,
      via: [[1.06, 0.44, -0.52], [1.03, 0.47, -0.49], [hf[0], hf[1], -(HOLE.zo + 0.022)], [hf[0], hf[1], -(HOLE.zi - 0.022)], [0.92, 0.38, -0.10], [-0.90, 0.38, -0.10],
        [hp[0], 0.42, -0.20], [hp[0], hp[1], -0.23], ...outRear(-1, hp, 0.84, -1.133, 0.63, [-0.004, 0.0]), { p: [b.tip[0], 0.626, -0.84], r: 0.045 }] }));
  }
  return asm({ id: 'hose-stab', sec: '11', fr: 'Boyaux des stabilisateurs', en: 'Outrigger hoses', qty: '8', page: 58, approx: true, attachTo: 'frame',
    explode: [0, -0.35, 0], note: 'Dans le châssis : valves d\'équilibrage (11.2) et tés vers les 4 stabilisateurs (11.3). Affectation des fonctions estimée.' }, [
    part({ id: 'hose-stab-extend', sec: '11.2', fr: 'Boyaux de sortie des stabilisateurs', en: 'Outrigger extend hoses', qty: '4', page: 62, approx: true, explode: [0, -0.08, 0] }, ext),
    part({ id: 'hose-stab-retract', sec: '11.3', fr: 'Boyaux de rentrée et liaison des tés', en: 'Retract and tee link hoses', qty: '4', page: 63, approx: true, explode: [0, -0.04, 0.06] }, [...ret, ...caps]),
  ]);
}

/* ------------------------------------------------------------------ */
export function build() {
  DEBUG.lines.length = 0; DEBUG.warn.length = 0;
  const kids = [pedCircuit(), mastCircuit(), liftCircuit(), gripCircuit(), driveCircuit(), stabCircuit()];
  if (dbg && DEBUG.warn.length) console.warn('hoses: ' + DEBUG.warn.join(' ; '));
  return asm({ id: 'hoses', fr: 'Boyaux hydrauliques', en: 'Hydraulic hoses', approx: true,
    note: 'Dessinés pour référence : le manuel ne les détaille pas. Tracés estimés.', explode: [0, 0, 0] }, kids);
}
