/* RodBot LP, vue éclatée : pince V2.0 (277179), section 5 du manuel de pièces PM10654
 * (pages PDF 10 à 34 : sections 5.1 à 5.9).
 * Repère local de la pince (G) : origine sur l'axe de l'actionneur de poignet, axes du modèle.
 * Échelles relevées : vue de côté p. 11 = 0,886 mm/px à 220 ppp, vues p. 10 = 1,08 mm/px.
 * La plaque de poignet soudée à 30° (276360) est tournée de PHI pour que sa bride soit verticale,
 * face contre la patte de bout de flèche (L.gripper.mountAt, centre du trou de passage des boyaux).
 * Le corps de l'actionneur de poignet tourne avec elle ; le support en U et tout le bas pendent.
 * Le bas (bras d'inclinaison et bloc de serrage) est tourné de 90° autour de Y par l'actionneur
 * de rotation, comme sur la vue de côté p. 79 du manuel opérateur (mâchoires vues de bout).
 */
import { THREE, G, m, grp, aim, between, bolt, nut, washer, greaseNipple, fitting, hose, weld, decal, asm, part, IN, DEG } from '../kit.js';
import { L } from '../layout.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const VA = (a) => (a && a.isVector3) ? a.clone() : new THREE.Vector3(...a);

/* ------------------------------------------------------------------ */
/* Cotes principales (mètres, repère G)                                 */
/* ------------------------------------------------------------------ */
const PHI = 29.7;                 // rotation de la plaque de poignet (bride verticale)
const TH_A = 58.7;                // repère A du corps de l'actionneur (rotation autour de Z)
const FACE = [-0.212, 0.122];     // centre du trou de la bride (face extérieure), relatif à l'axe du poignet
const WRIST = [L.gripper.mountAt[0] - FACE[0], L.gripper.mountAt[1] - FACE[1], 0];
const PIV = -0.609;               // axe d'inclinaison (bas du bras d'inclinaison), sous l'axe du poignet
const CF = { p: [0, PIV, 0], r: [0, 90, 0] }; // repère C (bas de la pince) : X_C = axe long du bloc de serrage
const C2G = ([x, y, z]) => [z, y, -x];        // direction C -> G (rotation de 90° autour de Y)

/* ------------------------------------------------------------------ */
/* Petits outils locaux                                                */
/* ------------------------------------------------------------------ */
const AX = { x: [0, 0, -90], y: undefined, z: [90, 0, 0] };
const cyl = (r, h, mk, p, ax = 'y', seg = 32) => m(G.cyl(r, h, seg), mk, { p, r: AX[ax] });
const disc = (r, h, mk, p, ax = 'y', seg = 40) => m(G.disc(r, h, seg), mk, { p, r: AX[ax] });
const ring = (ro, ri, h, mk, p, ax = 'y', seg = 40) => m(G.tube(ro, ri, h, seg), mk, { p, r: AX[ax] });
const lathe = (prof, mk, p, ax = 'y', seg = 40) => m(G.lathe(prof, seg), mk, { p, r: AX[ax] });
const box = (w, h, d, mk, p, r = 0.003, rot) => m(G.box(w, h, d, r), mk, { p, r: rot });
// plaques : 'xy' épaisseur selon Z ; 'zy' épaisseur selon X (x local = Z) ; 'xz' épaisseur selon Y (y local = -Z)
const PL = { xy: undefined, zy: [0, -90, 0], xz: [-90, 0, 0] };
const plate = (shape, t, mk, p, pl = 'xy', holes = []) => m(G.plate(shape, t, { holes }), mk, { p, r: PL[pl] });

function rshape(pts, r = 0) {
  const s = new THREE.Shape(); const n = pts.length;
  const rr = Array.isArray(r) ? r : pts.map(() => r);
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], R = rr[i] || 0;
    if (!R) { i ? s.lineTo(p1[0], p1[1]) : s.moveTo(p1[0], p1[1]); continue; }
    const d1 = [p0[0] - p1[0], p0[1] - p1[1]], d2 = [p2[0] - p1[0], p2[1] - p1[1]];
    const l1 = Math.hypot(...d1), l2 = Math.hypot(...d2), t = Math.min(R, l1 / 2.05, l2 / 2.05);
    const a = [p1[0] + d1[0] / l1 * t, p1[1] + d1[1] / l1 * t], b = [p1[0] + d2[0] / l2 * t, p1[1] + d2[1] / l2 * t];
    i ? s.lineTo(a[0], a[1]) : s.moveTo(a[0], a[1]);
    s.quadraticCurveTo(p1[0], p1[1], b[0], b[1]);
  }
  s.closePath(); return s;
}
const arcPts = (cx, cy, r, a0, a1, n = 10) => Array.from({ length: n + 1 }, (_, i) => { const a = (a0 + (a1 - a0) * i / n) * DEG; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; });
const rect = (w, h, r = 0, cx = 0, cy = 0) => G.rrect(w, h, r, cx, cy);
function circleShape(r, cx = 0, cy = 0) { const s = new THREE.Shape(); s.absarc(cx, cy, r, 0, Math.PI * 2, false); return s; }

/* Visserie : p = surface d'appui, dir = côté de la tête (vers l'extérieur). */
function boltAt(p, dir, o = {}) {
  const d = o.d || 0.5 * IN, w = o.washer ? 0.12 * d : 0;
  return aim(bolt(o), VA(p).addScaledVector(VA(dir).normalize(), w), dir);
}
function nutAt(p, dir, o = {}) {
  const d = o.d || 0.5 * IN, mk = o.mat || 'zinc', g = []; let off = 0;
  if (o.washer) { g.push(aim(washer({ d, mat: o.wmat || mk }), VA(p), dir)); off = 0.12 * d; }
  const P = VA(p).addScaledVector(VA(dir).normalize(), off);
  g.push(aim(nut({ d, mat: mk }), P, dir));
  if (o.lock) g.push(aim(m(G.lathe([[0.5 * d, 0], [0.68 * d, 0], [0.62 * d, 0.22 * d], [0.5 * d, 0.26 * d]], 20), mk), P.clone().addScaledVector(VA(dir).normalize(), 0.86 * d), dir));
  return grp(g);
}
function washerAt(p, dir, d, mk = 'zincClear', od = null, t = null) { return aim(washer({ d, mat: mk, od, t }), VA(p), dir); }

/* Tube hydraulique rigide cintré avec écrous JIC aux deux bouts. */
function bentPts(pts, R = 0.015) {
  const P = pts.map(VA), out = [P[0]];
  for (let i = 1; i < P.length - 1; i++) {
    const a = P[i - 1], b = P[i], c = P[i + 1];
    const d1 = b.clone().sub(a).normalize(), d2 = c.clone().sub(b).normalize();
    const r = Math.min(R, a.distanceTo(b) / 2.2, b.distanceTo(c) / 2.2);
    const p1 = b.clone().addScaledVector(d1, -r), p2 = b.clone().addScaledVector(d2, r);
    for (let k = 0; k <= 6; k++) { const t = k / 6; out.push(p1.clone().multiplyScalar((1 - t) ** 2).add(b.clone().multiplyScalar(2 * t * (1 - t))).add(p2.clone().multiplyScalar(t * t))); }
  }
  out.push(P[P.length - 1]); return out;
}
function steelTube(pts, { d = 0.375 * IN, R = 0.014, mk = 'zincClear' } = {}) {
  const P = bentPts(pts, R);
  const g = [m(G.sweep(P, d / 2, { radial: 10 }), mk)];
  for (const [a, b] of [[P[0], P[1]], [P[P.length - 1], P[P.length - 2]]]) {
    const dir = a.clone().sub(b).normalize();
    g.push(aim(m(G.hex(d * 2.0, 0.013), mk), a.clone().addScaledVector(dir, -0.0065), dir));
  }
  return grp(g);
}
/* Codeur rotatif : axe selon +Y local, bride à l'origine, corps vers +Y. */
function encoder({ r = 0.0185, len = 0.042, conn = 'side' } = {}) {
  const g = [
    disc(0.025, 0.003, 'alu', [0, 0.0015, 0]),
    lathe([[0, 0.003], [r, 0.003], [r, len - 0.004], [r - 0.002, len], [0, len]], 'alu', [0, 0, 0], 'y', 36),
    disc(r - 0.0015, 0.006, 'plastic', [0, len + 0.003, 0]),
    cyl(0.003, 0.012, 'zincClear', [0, -0.006, 0], 'y', 12),
  ];
  for (const a of [0, 180]) g.push(cyl(0.0025, 0.0035, 'zincClear', [0.0205 * Math.cos(a * DEG), 0.0045, 0.0205 * Math.sin(a * DEG)], 'y', 10));
  if (conn === 'side') g.push(grp([cyl(0.006, 0.014, 'zincClear', [0, 0.007, 0], 'y', 16), m(G.hex(0.0135, 0.008), 'zincClear', { p: [0, 0.016, 0] })], { p: [r, len * 0.62, 0], r: [0, 0, -90] }));
  else g.push(cyl(0.006, 0.016, 'zincClear', [0, len + 0.014, 0], 'y', 16), m(G.hex(0.0135, 0.008), 'zincClear', { p: [0, len + 0.025, 0] }));
  return grp(g);
}

/* ================================================================== */
/* 6 : plaque de poignet soudée 30° (276360), repère G (bride verticale) */
/* ================================================================== */
const FLX = -0.212, FT = 0.0127, FYB = -0.0525, FYT = 0.2768, FHW = 0.145;   // bride
const FLB = [0.2121, 0.1703, 0.0200, -0.0298];                                // rangées de boulons (y)
const GZ = 0.098;                                                             // goussets à z = ±0,098
const AP = { ax0: -0.144, ax1: 0.140, ay: 0.0997, t: 0.0127 };                // plaque d'appui (repère A)
const GP = { P1: [-0.1993, 0.236], P2: [-0.0232, 0.1780], P3: [-0.1709, -0.0646], P4: [-0.1993, -0.0525], hole: [-0.1265, 0.1359] };

function buildWristMount() {
  const ch = [];
  // bride (contour en (z, y), z local = -Z après rotation, pièce symétrique)
  const tabW = 0.034;
  const out = [[-FHW, FYB], [FHW, FYB], [FHW, FYT], [tabW, FYT], ...arcPts(0, FYT + 0.002, tabW, 0, 180, 10).slice(0), [-tabW, FYT], [-FHW, FYT]];
  const rr = out.map((_, i) => (i === 0 || i === 1 || i === 2 || i === out.length - 1) ? 0.012 : 0);
  const holes = [{ c: [0, FACE[1]], r: 0.031 }, { c: [0, FYT + 0.002], r: 0.009 }];
  for (const y of FLB) for (const z of [-0.12, 0.12]) holes.push({ c: [z, y], r: 0.0071 });
  ch.push(m(G.plate(rshape(out, rr), FT, { holes }), 'red', { p: [FLX + FT / 2, 0, 0], r: [0, 90, 0] }));
  // goussets (2), trou du passe-fil côté -Z
  for (const s of [-1, 1]) {
    ch.push(plate(rshape([GP.P1, GP.P2, GP.P3, GP.P4], [0.006, 0.01, 0.004, 0]), FT, 'red', [0, 0, s * GZ], 'xy', [{ c: GP.hole, r: 0.034 }]));
    const zf = s * (GZ + FT / 2 + 0.0025);
    ch.push(weld([[FLX + FT + 0.0025, FYB + 0.006, zf], [FLX + FT + 0.0025, GP.P1[1] - 0.004, zf]], 0.0035));
    const zw = s * (GZ - FT / 2 - 0.0025);
    ch.push(weld([[FLX + FT + 0.0025, FYB + 0.006, zw], [FLX + FT + 0.0025, GP.P1[1] - 0.004, zw]], 0.0035));
  }
  // plaque d'appui de l'actionneur (repère A), 4 trous M20 et 2 trous du support de codeur
  const apHoles = [];
  for (const ax of [-0.084, 0.084]) for (const z of [-0.072, 0.072]) apHoles.push({ c: [ax, -z], r: 0.011 });
  for (const ax of [0.085, 0.115]) apHoles.push({ c: [ax, -0.13], r: 0.0055 });
  const ap = m(G.plate(rshape([[AP.ax0, -FHW], [AP.ax1, -FHW], [AP.ax1, FHW], [AP.ax0, FHW]], 0.008), AP.t, { holes: apHoles }), 'red', { p: [0, AP.ay + AP.t / 2, 0], r: [-90, 0, 0] });
  const apW = [];
  for (const s of [-1, 1]) for (const zo of [GZ + FT / 2 + 0.0025, GZ - FT / 2 - 0.0025]) apW.push(weld([[AP.ax0 + 0.006, AP.ay + AP.t + 0.0025, s * zo], [AP.ax1 - 0.006, AP.ay + AP.t + 0.0025, s * zo]], 0.0035));
  ch.push(grp([ap, ...apW], { r: [0, 0, TH_A] }));
  return part({ id: 'grip-wristmount', sec: '5', item: '6', pn: '276360', fr: 'Plaque de poignet soudée 30°', en: 'Wrist mount weldment, 30 deg', qty: '1', page: 10,
    explode: [-0.12, 0.40, 0], note: "Bride verticale boulonnée sur la patte de bout de flèche. La plaque d'appui reçoit l'actionneur de poignet, à 30° de la bride. Cotes relevées p. 10 et 11." }, ch, { r: [0, 0, 0] });
}

/* ================================================================== */
/* 5.9 : actionneur de poignet (276573), repère A                       */
/* ================================================================== */
function buildWristActuator() {
  const body = [];
  body.push(cyl(0.066, 0.200, 'black', [0, 0, 0], 'z', 48));
  for (const s of [-1, 1]) body.push(ring(0.069, 0.060, 0.012, 'black', [0, 0, s * 0.094], 'z', 48));
  for (const s of [-1, 1]) body.push(box(0.208, 0.0695, 0.048, 'black', [0, 0.06475, s * 0.076], 0.004));    // pattes d'appui
  body.push(box(0.070, 0.050, 0.124, 'black', [0, -0.075, 0], 0.003));                                          // bloc de valve
  for (const s of [-1, 1]) for (const xa of [-0.0235, 0.0235]) body.push(box(0.022, 0.026, 0.016, 'black', [xa, -0.087, s * 0.070], 0.002)); // oreilles fendues
  for (const s of [-1, 1]) body.push(m(G.hex(0.014, 0.006), 'black', { p: [0.040 * s, -0.066 * 0.6, 0.03], r: [0, 0, s * 52] }));
  body.push(disc(0.006, 0.003, 'machined', [0, -0.1, -0.035], 'y', 16), disc(0.006, 0.003, 'machined', [0, -0.1, 0.035], 'y', 16));
  for (const s of [-1, 1]) body.push(disc(0.074, 0.0225, 'steel', [0, 0, s * 0.11225], 'z', 56));             // brides tournantes
  body.push(cyl(0.044, 0.310, 'machined', [0, 0, 0], 'z', 40));                                                  // moyeu de l'arbre
  const act = part({ id: 'grip-wristact-body', sec: '5.9', item: '1', pn: '275146', fr: 'Actionneur hydraulique 10:1', en: 'Hydraulic actuator 10:1 CB', qty: '1', page: 34,
    explode: [0, 0, 0], note: "Corps fixe sur la plaque de poignet. Les deux brides d'extrémité tournent avec le support en U." }, body);
  const hw = [];
  for (const ax of [-0.084, 0.084]) for (const z of [-0.072, 0.072]) {
    hw.push(aim(washer({ d: 0.020, mat: 'zincClear', od: 0.037, t: 0.0025 }), V(ax, 0.030, z), V(0, -1, 0)));
    hw.push(boltAt([ax, 0.0275, z], [0, -1, 0], { d: 0.020, L: 0.110, mat: 'blackOxide' }));
    hw.push(aim(washer({ d: 0.020, mat: 'zincClear', od: 0.037, t: 0.0025 }), V(ax, AP.ay + AP.t, z), V(0, 1, 0)));
    hw.push(aim(nut({ d: 0.020, mat: 'blackOxide' }), V(ax, AP.ay + AP.t + 0.0025, z), V(0, 1, 0)));
  }
  for (const z of [-0.03, 0.03]) hw.push(aim(fitting({ d: 0.375 * IN, L: 0.03, mat: 'zincClear' }), V(0.035, -0.080, z), V(1, 0, 0)));
  const vis = part({ id: 'grip-wristact-hw', sec: '5.9', item: '2', pn: 'B117M', fr: 'Visserie et adaptateurs', en: 'Hardware and adapters', qty: '-', page: 34,
    explode: [0, 0.10, 0], note: 'Repères 2 (B117M M20 x 110 x4), 3 (250619 x8), 4 (N008M x4), 5 (GG106-NP06-04 x2).' }, hw);
  return asm({ id: 'grip-wristact', sec: '5.9', item: '7', pn: '276573', fr: 'Actionneur de poignet', en: 'Wrist actuator', qty: '1', page: 34,
    explode: [0, 0.22, 0] }, [act, vis], { r: [0, 0, TH_A] });
}

/* ================================================================== */
/* 5.5 : support du codeur de poignet (276671) et codeur 269907, repère A */
/* ================================================================== */
const EZ = 0.188;  // face intérieure du bras du support de codeur
function buildEncoderMount() {
  const t = 0.003, ch = [];
  ch.push(box(0.055, t, 0.079, 'zincClear', [0.100, AP.ay + AP.t + t / 2, 0.1515], 0.001));                 // aile haute (sur la plaque)
  const face = rshape([[-0.025, -0.025], [0.1275, -0.025], [0.1275, AP.ay + AP.t + t], [0.0725, AP.ay + AP.t + t], [0.0725, 0.025], [-0.025, 0.025]], [0.012, 0.004, 0.002, 0.002, 0.008, 0.012]);
  ch.push(plate(face, t, 'zincClear', [0, 0, EZ + t / 2], 'xy', [{ c: [0, 0], r: 0.007 }, { c: [-0.0205, 0], r: 0.0019 }, { c: [0.0205, 0], r: 0.0019 }]));
  const pl = part({ id: 'grip-encmount-plate', sec: '5.5', item: '1', pn: '276672', fr: 'Plaque pliée du codeur', en: 'Encoder mount plate', qty: '1', page: 20, explode: [0, 0, 0], approx: true,
    note: "Forme pliée d'après p. 20, adaptée pour contourner les têtes de vis du support en U." }, ch);
  const hw = [];
  for (const ax of [0.085, 0.115]) {
    hw.push(boltAt([ax, AP.ay + AP.t + t, 0.13], [0, 1, 0], { d: 0.375 * IN, L: 1.125 * IN, washer: true }));
    hw.push(nutAt([ax, AP.ay, 0.13], [0, -1, 0], { d: 0.375 * IN, washer: true }));
  }
  for (const ax of [-0.0205, 0.0205]) { hw.push(boltAt([ax, 0, EZ + t + 0.003], [0, 0, 1], { d: 0.138 * IN, L: 0.5 * IN, head: 'shcs', washer: true })); hw.push(nutAt([ax, 0, EZ], [0, 0, -1], { d: 0.138 * IN, washer: true, lock: true })); }
  const vis = part({ id: 'grip-encmount-hw', sec: '5.5', item: '6', pn: 'B143', fr: 'Visserie', en: 'Hardware', qty: '-', page: 20, explode: [0, 0.06, 0.03],
    note: 'Repères 2 (245089 x2), 3 (236666 x4), 4 (236667 x2), 5 (259704 x4), 6 (B143 x2), 7 (N017 x2).' }, hw);
  return asm({ id: 'grip-encmount', sec: '5.5', item: '8', pn: '276671', fr: 'Support du codeur de poignet', en: 'Encoder wrist mount', qty: '1', page: 20,
    explode: [-0.12, 0.40, 0.20] }, [pl, vis], { r: [0, 0, TH_A] });
}
function buildWristEncoder() {
  const e = grp([encoder({ conn: 'back' })], { p: [0, 0, EZ + 0.003], r: [90, 0, 0] });
  return part({ id: 'grip-enc-wrist', sec: '5', item: '4', pn: '269907', fr: 'Codeur du poignet (programmé)', en: 'Wrist rotary encoder', qty: '1', page: 10, spare: true,
    explode: [-0.12, 0.40, 0.32] }, [e], { r: [0, 0, TH_A] });
}
/* 5.4.1 : aimant de codeur (281633) sur le bout de l'arbre (tourne avec le support en U). */
function buildMagnet() {
  const pot = part({ id: 'grip-magnet-pot', sec: '5.4.1', item: '1', pn: '255906', fr: 'Aimant enrobé 75 lb', en: 'Encased magnet, 75 lb', qty: '1', page: 19, spare: true, explode: [0, 0, 0] },
    [lathe([[0, 0], [0.0225, 0], [0.024, 0.0015], [0.024, 0.0105], [0.0225, 0.012], [0, 0.012]], 'rubber', [0, 0, 0.1555], 'z', 40), cyl(0.0032, 0.010, 'zinc', [0, 0, 0.1725], 'z', 12)]);
  const stud = part({ id: 'grip-magnet-stud', sec: '5.4.1', item: '2', pn: '281634', fr: 'Goujon 12 mm', en: 'Stud, 12 mm', qty: '1', page: 19, explode: [0, 0, 0.03] },
    [cyl(0.006, 0.0175, 'zinc', [0, 0, 0.1675 + 0.00875], 'z', 20), box(0.0125, 0.003, 0.0012, 'zinc', [0, 0, 0.1852], 0.0003)]);
  return asm({ id: 'grip-magnet', sec: '5.4.1', item: '16', pn: '281633', fr: 'Aimant de codeur', en: 'Magnet encoder attachment', qty: '1', page: 19, spare: true,
    explode: [0, 0.22, 0.10], note: "Section K-K p. 10 : au bout de l'arbre de l'actionneur de poignet, sous le codeur 269907." }, [pot, stud]);
}

/* ================================================================== */
/* 5.7 : support en U du poignet (277180) et plaque à raccords 5.7.1    */
/* ================================================================== */
const SP = { zi: 0.125, t: 0.030, r: 0.098, yb: -0.130, bc: 0.064 };
const BASE = { y0: -0.222, y1: -0.200, hx: 0.098, hz: 0.105 };
const BKC = 0.062;  // cercle des 10 boulons de la plaque à raccords
function buildStraddle() {
  const ch = [];
  for (const s of [-1, 1]) {
    const sh = new THREE.Shape(); sh.moveTo(SP.r, SP.yb); sh.lineTo(SP.r, 0); sh.absarc(0, 0, SP.r, 0, Math.PI, false); sh.lineTo(-SP.r, SP.yb); sh.closePath();
    const holes = [{ c: [0, 0], r: 0.046 }, { slot: [-0.045, -0.104, 0.045, -0.104], r: 0.0065 }];
    for (let k = 0; k < 12; k++) { const a = k * 30 * DEG; holes.push({ c: [SP.bc * Math.cos(a), SP.bc * Math.sin(a)], r: s > 0 ? 0.0068 : 0.0088 }); }
    ch.push(plate(sh, SP.t, 'red', [0, 0, s * (SP.zi + SP.t / 2)], 'xy', holes));
    ch.push(ring(0.082, 0.046, 0.006, 'red', [0, 0, s * (SP.zi + SP.t + 0.003)], 'z', 56));
    // paroi inclinée vers le fond (trou oblong côté -Z)
    const wl = 0.105, wh = [];
    if (s < 0) wh.push({ slot: [-0.026, 0, 0.026, 0], r: 0.017 });
    const w = m(G.plate(rshape([[-SP.r, -wl / 2], [SP.r, -wl / 2], [SP.r, wl / 2], [-SP.r, wl / 2]], 0.002), 0.025, { holes: wh }), 'red', { p: [0, -0.1645, s * 0.1153], r: [s * 33.8, 0, 0] });
    ch.push(w);
  }
  const bh = [{ c: [0, 0], r: 0.035 }];
  for (let k = 0; k < 10; k++) { const a = k * 36 * DEG; bh.push({ c: [BKC * Math.cos(a), -BKC * Math.sin(a)], r: 0.0072 }); }
  for (const s of [-1, 1]) for (const x of [-0.085, -0.065]) bh.push({ c: [x, -s * 0.062], r: 0.0034 });
  ch.push(plate(rshape([[-BASE.hx, -BASE.hz], [BASE.hx, -BASE.hz], [BASE.hx, BASE.hz], [-BASE.hx, BASE.hz]], 0.01), BASE.y1 - BASE.y0, 'red', [0, (BASE.y0 + BASE.y1) / 2, 0], 'xz', bh));
  const body = part({ id: 'grip-straddle-body', sec: '5.7', item: '8', pn: '277181', fr: 'Support en U usiné', en: 'Machined wrist straddle mount', qty: '1', page: 31, explode: [0, 0, 0],
    note: "Les deux joues serrent les brides de l'actionneur de poignet (12 vis M16 côté -Z, 12 vis M12 côté +Z)." }, ch);
  // plaques de montage 277619 (x2) avec colliers
  const mp = [];
  [-1, 1].forEach((s, i) => {
    mp.push(part({ id: `grip-straddle-mountplate-${i + 1}`, sec: '5.7', item: '10', pn: '277619', fr: 'Plaque de montage', en: 'Mount plate', qty: '2', page: 31, explode: [0, 0.05, s * 0.05], approx: true },
      [box(0.042, 0.005, 0.022, 'zincClear', [-0.075, BASE.y1 + 0.0025, s * 0.062], 0.0012)]));
  });
  // visserie et colliers
  const hp = [], hn = [], hw = [];
  for (let k = 0; k < 12; k++) {
    const a = k * 30 * DEG, x = SP.bc * Math.cos(a), y = SP.bc * Math.sin(a);
    hp.push(boltAt([x, y, SP.zi + SP.t + 0.006], [0, 0, 1], { d: 0.012, L: 0.030, washer: true, mat: 'blackOxide' }));
    hn.push(boltAt([x, y, -(SP.zi + SP.t + 0.006)], [0, 0, -1], { d: 0.016, L: 0.035, head: 'shcs', washer: true, mat: 'blackOxide' }));
  }
  for (const s of [-1, 1]) for (const x of [-0.085, -0.065]) {
    hw.push(boltAt([x, BASE.y1 + 0.005, s * 0.062], [0, 1, 0], { d: 0.25 * IN, L: 0.75 * IN, washer: true }));
    hw.push(nutAt([x, BASE.y0, s * 0.062], [0, -1, 0], { d: 0.25 * IN }));
    hw.push(m(G.torus(0.0085, 0.0018, Math.PI * 1.6, 8, 20), 'zinc', { p: [x, BASE.y1 + 0.005 + 0.0095, s * 0.062], r: [0, 90, 0] }));
  }
  const visP = part({ id: 'grip-straddle-hw-m12', sec: '5.7', item: '12', pn: 'B055M', fr: 'Vis M12 (côté +Z)', en: 'M12 bolts (+Z side)', qty: '12', page: 31, explode: [0, 0, 0.09],
    note: 'Repères 12 (B055M x12) et 7 (260182 x12) : joue +Z vers la bride de l\'actionneur.' }, hp);
  const visN = part({ id: 'grip-straddle-hw-m16', sec: '5.7', item: '15', pn: 'C109M', fr: 'Vis M16 (côté -Z)', en: 'M16 screws (-Z side)', qty: '12', page: 31, explode: [0, 0, -0.09],
    note: 'Repères 15 (C109M x12) et 1 (116139 x12) : joue -Z vers la bride de l\'actionneur.' }, hn);
  const vis = part({ id: 'grip-straddle-hw', sec: '5.7', item: '13', pn: 'B142', fr: 'Visserie et colliers', en: 'Hardware and P-clamps', qty: '-', page: 31, explode: [0, 0.04, 0],
    note: 'Repères 3 (224166 x12), 4 (233614 x2), 5 (252433 x2), 6 (258780 x4), 11 (B042 x2), 13 (B142 x6), 16 (N015 x2), 17 (N017 x6). Colliers simplifiés.' }, hw);
  return asm({ id: 'grip-straddle', sec: '5.7', item: '13', pn: '277180', fr: 'Support en U du poignet', en: 'Wrist straddle mount', qty: '1', page: 31, explode: [0, 0, 0] },
    [body, buildBulkhead(), ...mp, visP, visN, vis]);
}
function buildBulkhead() {
  const yb = BASE.y1, t = 0.008;
  const holes = [];
  for (let k = 0; k < 10; k++) { const a = k * 36 * DEG; holes.push({ c: [BKC * Math.cos(a), -BKC * Math.sin(a)], r: 0.0072 }); }
  for (let k = 0; k < 5; k++) { const a = (18 + k * 72) * DEG; holes.push({ c: [0.043 * Math.cos(a), -0.043 * Math.sin(a)], r: 0.0075 }); }
  const SW = [[0.0135, 0.0135], [-0.0135, 0.0135], [-0.0135, -0.0135], [0.0135, -0.0135]];
  const ch = [plate(circleShape(0.075), t, 'red', [0, yb + t / 2, 0], 'xz', holes),
    lathe([[0.0, yb + t], [0.031, yb + t], [0.031, yb + t + 0.011], [0.029, yb + t + 0.012], [0, yb + t + 0.012]], 'red', [0, 0, 0], 'y', 40)];
  const plateP = part({ id: 'grip-bulkhead-plate', sec: '5.7.1', item: '1', pn: '277951', fr: 'Plaque à raccords soudée', en: 'Bulkhead weldment', qty: '1', page: 32, explode: [0, 0, 0] }, ch);
  const yTop = yb + t + 0.012;
  const sw = SW.map(([x, z], i) => part({ id: `grip-bulkhead-swivel-${i + 1}`, sec: '5.7.1', item: '2', pn: '122097', fr: 'Raccord tournant JIC', en: 'Live swivel, JIC bulkhead', qty: '4', page: 32,
    explode: [x * 1.5, 0.05 + i * 0.008, z * 1.5] }, [grp([
      m(G.hex(0.022, 0.012), 'zincClear', { p: [0, 0.006, 0] }),
      cyl(0.0115, 0.022, 'zincClear', [0, 0.023, 0], 'y', 24),
      m(G.hex(0.0006 + 0.019, 0.008), 'zincClear', { p: [0, 0.038, 0] }),
      lathe([[0, 0.042], [0.0075, 0.042], [0.0075, 0.052], [0.0055, 0.056], [0, 0.056]], 'zincClear', [0, 0, 0], 'y', 20),
      cyl(0.0024, 0.006, 'zincClear', [0.0118, 0.022, 0], 'x', 10),
      cyl(0.0075, 0.042, 'zincClear', [0, -0.021, 0], 'y', 20),
      m(G.hex(0.019, 0.007), 'zincClear', { p: [0, BASE.y0 - yTop - 0.0035, 0] }),
      lathe([[0, -0.052], [0.0075, -0.052], [0.0075, -0.044], [0.0055, -0.040], [0, -0.040]].map(([r, y]) => [r, y - 0.004]), 'zincClear', [0, 0, 0], 'y', 20),
    ], { p: [x, yTop, z] })]));
  const hw = [];
  for (let k = 0; k < 10; k++) { const a = k * 36 * DEG; hw.push(boltAt([BKC * Math.cos(a), yb + t, BKC * Math.sin(a)], [0, 1, 0], { d: 0.5 * IN, L: 1.625 * IN, washer: true })); }
  const vis = part({ id: 'grip-bulkhead-hw', sec: '5.7', item: '14', pn: 'B270', fr: 'Boulons de la plaque à raccords', en: 'Bulkhead bolts', qty: '10', page: 31, explode: [0, 0.10, 0],
    note: 'Repères 14 (B270 x10) et 2 (117753 x10) du support en U : ils traversent la plaque à raccords et le fond du support et se vissent dans la couronne.' }, hw);
  return asm({ id: 'grip-bulkhead', sec: '5.7.1', item: '9', pn: '277220', fr: 'Plaque à raccords tournants', en: 'Bulkhead assembly', qty: '1', page: 32, explode: [0, 0.07, 0] }, [plateP, ...sw, vis]);
}

/* ================================================================== */
/* 5.4 : actionneur de rotation (277382) et codeur 269909                */
/* ================================================================== */
const WY = -0.2735, WZ = -0.150;  // axe de la vis sans fin
function buildRotateActuator() {
  const s = [];
  s.push(lathe([[0.048, -0.250], [0.048, -0.222], [0.146, -0.222], [0.150, -0.226], [0.150, -0.284], [0.146, -0.288], [0.104, -0.288], [0.104, -0.250], [0.048, -0.250]], 'black', [0, 0, 0], 'y', 64));
  for (let k = 0; k < 8; k++) { const a = (22.5 + k * 45) * DEG; s.push(disc(0.0062, 0.0012, 'black', [0.128 * Math.cos(a), -0.2214, 0.128 * Math.sin(a)], 'y', 14)); }
  s.push(lathe([[0.050, -0.250], [0.102, -0.250], [0.102, -0.303], [0.099, -0.305], [0.053, -0.305], [0.050, -0.302], [0.050, -0.250]], 'machined', [0, 0, 0], 'y', 56));
  s.push(box(0.210, 0.094, 0.085, 'black', [0, WY, WZ], 0.008));
  for (const sx of [-1, 1]) { s.push(box(0.065, 0.100, 0.092, 'black', [sx * 0.1325, WY, WZ], 0.010)); s.push(disc(0.042, 0.007, 'black', [sx * 0.1685, WY, WZ], 'x', 40)); }
  for (const x of [-0.06, 0, 0.06]) s.push(disc(0.0045, 0.002, 'black', [x, WY, WZ - 0.0425 - 0.0008], 'z', 14));
  s.push(decal({ text: 'ROTARY MASTER', w: 0.10, h: 0.012, bg: '#1d1e20', fg: '#c9c9c9', font: 'bold', p: [0, WY - 0.035, WZ - 0.0428], r: [0, 180, 0] }));
  const slew = part({ id: 'grip-rotact-slew', sec: '5.4', item: '7', pn: '276729', fr: "Couronne d'orientation à vis sans fin", en: 'Slew drive', qty: '1', page: 18, explode: [0, 0, 0],
    note: "Carter fixe boulonné sous le support en U ; la bague intérieure tourne avec le bras d'inclinaison." }, s);
  // moteur hydraulique (bout +X)
  const mo = [box(0.020, 0.100, 0.100, 'grey', [0.182, WY, WZ], 0.012), cyl(0.052, 0.083, 'grey', [0.2335, WY, WZ], 'x', 40), cyl(0.055, 0.025, 'grey', [0.2875, WY, WZ], 'x', 40)];
  for (const x of [0.214, 0.258]) mo.push(ring(0.0535, 0.050, 0.004, 'black', [x, WY, WZ], 'x', 40));
  for (let k = 0; k < 7; k++) { const a = k * 360 / 7 * DEG; mo.push(m(G.cyl(0.0045, 0.006, 12), 'black', { p: [0.3030, WY + 0.040 * Math.cos(a), WZ + 0.040 * Math.sin(a)], r: [0, 0, -90] })); }
  mo.push(disc(0.012, 0.004, 'grey', [0.302, WY, WZ], 'x', 24));
  for (const y of [WY + 0.0245, WY - 0.0245]) mo.push(box(0.026, 0.020, 0.012, 'grey', [0.215, y, WZ + 0.050], 0.002));
  const motor = part({ id: 'grip-rotact-motor', sec: '5.4', item: '15', pn: '278096', fr: 'Moteur hydraulique 127,5 cc', en: 'Hydraulic motor, 127.5 cc', qty: '1', page: 18, explode: [0.12, 0, 0] }, mo);
  // couvercle du codeur (bout -X)
  const eb = part({ id: 'grip-rotact-encbox', sec: '5.4', item: '11', pn: '277910', fr: 'Support du codeur de rotation', en: 'Encoder mount', qty: '1', page: 18, explode: [-0.12, 0, 0], approx: true,
    note: 'Ensemble sans section dans le manuel : boîtier simplifié.' }, [box(0.043, 0.088, 0.088, 'zincClear', [-0.1935, WY, WZ], 0.004)]);
  const spl = part({ id: 'grip-rotact-splineplug', sec: '5.4', item: '9', pn: '278218', fr: 'Bouchon cannelé', en: 'Spline plug', qty: '1', page: 18, explode: [-0.03, 0, 0], approx: true },
    [cyl(0.011, 0.010, 'machined', [-0.177, WY, WZ], 'x', 6)]);
  const m52 = asm({ id: 'grip-magnet52', sec: '5.2', item: '-', pn: '277438', fr: 'Aimant de codeur (néodyme)', en: 'Magnet encoder attachment (neodymium)', qty: '1', page: 16, explode: [-0.06, 0.05, 0], approx: true,
    note: "Absent des nomenclatures 5 et 5.4 (le repère 16 est 281633). Placé par hypothèse sur le bouchon cannelé de la vis sans fin, sous le codeur de rotation, dans le boîtier 277910." }, [
    part({ id: 'grip-magnet52-disc', sec: '5.2', item: '1', pn: '277437', fr: 'Aimant néodyme enrobé époxy', en: 'Neodymium magnet, epoxy coated', qty: '1', page: 16, explode: [0, 0, 0] },
      [lathe([[0.0045, -0.004], [0.0185, -0.004], [0.019, -0.0035], [0.019, 0.0035], [0.0185, 0.004], [0.0028, 0.004], [0.0045, 0.0015], [0.0045, -0.004]], 'blackOxide', [-0.186, WY, WZ], 'x', 36)]),
    part({ id: 'grip-magnet52-stud', sec: '5.2', item: '2', pn: '277439', fr: 'Goujon 12 mm', en: 'Stud, 12 mm', qty: '1', page: 16, explode: [-0.035, 0, 0] }, [cyl(0.006, 0.016, 'zinc', [-0.198, WY, WZ], 'x', 20)]),
    part({ id: 'grip-magnet52-screw', sec: '5.2', item: '3', pn: '277440', fr: 'Vis à tête fraisée no 12', en: 'Flat head cap screw #12-24', qty: '1', page: 16, explode: [-0.065, 0, 0] },
      [grp([bolt({ d: 0.216 * IN, L: 0.75 * IN, head: 'fhcs', mat: 'zinc' })], { p: [-0.1895, WY, WZ], r: [0, 0, 90] })]),
  ]);
  const stop = part({ id: 'grip-rotact-stop', sec: '5.4', item: '10', pn: '277475', fr: 'Plaque de butée intérieure', en: 'Internal wrist stop plate', qty: '1', page: 18, explode: [0, -0.06, 0], approx: true },
    [box(0.070, 0.010, 0.036, 'steel', [0, -0.255, 0.0], 0.002)]);
  const sm = [cyl(0.0053, 0.038, 'zinc', [0, WY - 0.050 - 0.019, WZ], 'y', 12), aim(greaseNipple('zinc'), V(0, WY - 0.050 - 0.038, WZ), V(0, -1, 0))];
  for (const a of [60, 240]) sm.push(m(G.hex(0.010, 0.005), 'zinc', { p: [0.116 * Math.cos(a * DEG), -0.2905, 0.116 * Math.sin(a * DEG)] }));
  const small = part({ id: 'grip-rotact-grease', sec: '5.4', item: '5', pn: '259844', fr: 'Graisseur, mamelon et bouchons', en: 'Grease nipple, pipe nipple and plugs', qty: '-', page: 18, explode: [0, -0.05, -0.03],
    note: 'Repères 5 (259844), 6 (266876 x2) et 8 (277430).' }, sm);
  const ft = [];
  for (const y of [WY + 0.0245, WY - 0.0245]) ft.push(aim(fitting({ d: 0.375 * IN, L: 0.035, mat: 'zincClear' }), V(0.215, y, WZ + 0.056), V(0, 0, 1)));
  const fit = part({ id: 'grip-rotact-fittings', sec: '5.4', item: '2', pn: '202702-10-6', fr: 'Raccords du moteur', en: 'Motor fittings', qty: '2', page: 18, explode: [0.12, 0, 0.05] }, ft);
  const hs = [];
  hs.push(hose([[0.215, WY + 0.0245, WZ + 0.091], [0.215, WY + 0.0245, WZ + 0.125], [0.19, -0.21, -0.005], [0.15, -0.14, 0.0], [0.09, -0.098, -0.006], [0.0135, -0.085, -0.0135], [0.0135, -0.107, -0.0135]], { d: 0.375 * IN }));
  hs.push(hose([[0.215, WY - 0.0245, WZ + 0.091], [0.215, WY - 0.0245, WZ + 0.140], [0.20, -0.25, 0.022], [0.16, -0.15, 0.024], [0.09, -0.100, 0.02], [0.0135, -0.085, 0.0135], [0.0135, -0.107, 0.0135]], { d: 0.375 * IN }));
  const hoses = part({ id: 'grip-rotact-hoses', sec: '5', item: '-', pn: '-', fr: 'Boyaux du moteur (référence)', en: 'Motor hoses (reference)', qty: '2', page: 10, explode: [0.10, 0.06, 0.08], approx: true,
    note: 'Boyaux montrés pour référence seulement (note du dessin p. 10). Hors nomenclature.' }, hs);
  const hw = [];
  for (const y of [WY + 0.035, WY - 0.035]) hw.push(boltAt([0.192, y, WZ + 0.035 * (y > WY ? 1 : -1)], [1, 0, 0], { d: 0.5 * IN, L: 1.5 * IN, head: 'shcs', washer: true }));
  for (const y of [WY + 0.030, WY - 0.030]) hw.push(boltAt([-0.215, y, WZ + 0.028], [-1, 0, 0], { d: 0.5 * IN, L: 1 * IN, washer: true }));
  for (const a of [45, 135, 225, 315]) hw.push(nutAt([-0.218, WY + 0.0205 * Math.sin(a * DEG), WZ + 0.0205 * Math.cos(a * DEG)], [-1, 0, 0], { d: 0.138 * IN, washer: true, lock: true }));
  for (let k = 0; k < 3; k++) { const a = (90 + k * 120) * DEG; hw.push(boltAt([0.030 * Math.cos(a), -0.260, 0.018 * Math.sin(a)], [0, -1, 0], { d: 0.5 * IN, L: 1.5 * IN, washer: true })); }
  const vis = part({ id: 'grip-rotact-hw', sec: '5.4', item: '12', pn: 'B265', fr: 'Visserie', en: 'Hardware', qty: '-', page: 18, explode: [0, -0.03, -0.06],
    note: 'Repères 1 (117753 x7), 3 (236667 x4), 4 (248143 x4), 12 (B265 x2), 13 (B269 x3, plaque de butée), 14 (C296 x2, moteur).' }, hw);
  return asm({ id: 'grip-rotact', sec: '5.4', item: '15', pn: '277382', fr: 'Actionneur de rotation', en: 'Rotate actuator', qty: '1', page: 18, explode: [0, -0.22, 0] },
    [slew, motor, eb, spl, m52, stop, small, fit, hoses, vis]);
}
function buildRotateEncoder() {
  const e = grp([encoder({ conn: 'side' })], { p: [-0.215, WY, WZ], r: [0, 0, 90] });
  return part({ id: 'grip-enc-rotate', sec: '5', item: '5', pn: '269909', fr: 'Codeur de rotation (programmé)', en: 'Rotate rotary encoder', qty: '1', page: 10, spare: true,
    explode: [-0.20, -0.22, 0] }, [e]);
}

/* 10 : support de boyaux soudé (276806), sur le fond du support en U, côté -X. */
function buildHoseSupport() {
  const ch = [box(0.030, 0.005, 0.030, 'black', [-0.084, BASE.y1 + 0.0025, 0], 0.0012)];
  const bar = [[-0.072, BASE.y1 + 0.0055, 0], [-0.232, BASE.y1 + 0.0055, 0], [-0.232, -0.335, 0], [-0.212, -0.350, 0]];
  ch.push(m(G.sweep(bentPts(bar, 0.02), 0.005, { radial: 10 }), 'black'));
  ch.push(m(G.sphere(0.0055, 12), 'black', { p: bar[3] }));
  const sup = part({ id: 'grip-hosesup', sec: '5', item: '10', pn: '276806', fr: 'Support de boyaux soudé', en: 'Hose support weldment', qty: '1', page: 11, explode: [-0.14, 0.02, 0], approx: true,
    note: "Tige pliée vue p. 11, à droite du boîtier du codeur de rotation. Fixée par le boulon 26 (B042), l'écrou 25 et les rondelles 27." }, ch);
  return sup;
}

/* ================================================================== */
/* 5.8 : bras d'inclinaison (277210), repère C                          */
/* ================================================================== */
const LEGZ = 0.145, LEGT = 0.014;
function buildTiltArm() {
  const ch = [];
  const rp = [];
  for (let k = 0; k < 6; k++) { const a = (30 + k * 60) * DEG; rp.push({ c: [0.075 * Math.cos(a), 0.075 * Math.sin(a)], r: 0.0072 }); }
  ch.push(plate(circleShape(0.130), 0.018, 'red', [0, 0.295, 0], 'xz', rp));
  ch.push(box(0.05, 0.03, 0.05, 'red', [0, 0.318, 0], 0.004));
  for (const s of [-1, 1]) {
    const leg = rshape([[-0.057, 0.276], [0.057, 0.276], [0.035, 0.03], ...arcPts(0, 0, 0.035, 0, -180, 14).slice(1, -1), [-0.035, 0.03]], [0.004, 0.004, 0]);
    ch.push(plate(leg, LEGT, 'red', [0, 0, s * LEGZ], 'xy', [{ c: [0, 0], r: 0.0135 }]));
    ch.push(box(0.114, 0.016, 0.036, 'red', [0, 0.280, s * 0.133], 0.004));
    ch.push(weld([[-0.054, 0.2705, s * (LEGZ - LEGT / 2 - 0.0025)], [0.054, 0.2705, s * (LEGZ - LEGT / 2 - 0.0025)]], 0.003));
    ch.push(box(0.090, 0.152, 0.010, 'red', [0, 0.196, s * 0.065], 0.003));
  }
  ch.push(box(0.090, 0.014, 0.14, 'red', [0, 0.279, 0], 0.003));
  const mount = part({ id: 'grip-tiltarm-mount', sec: '5.8', item: '3', pn: '277211', fr: "Fourche d'inclinaison", en: 'Tilt mount assembly', qty: '1', page: 33, explode: [0, 0, 0],
    note: "Plaque ronde boulonnée sous la couronne, deux jambes jusqu'aux axes d'inclinaison, cadre intérieur pour le support du vérin." }, ch);
  // support du vérin d'inclinaison 277275 (côté -Z du cadre intérieur)
  const cm = [box(0.075, 0.10, 0.010, 'red', [0.0075, 0.20, -0.075], 0.003),
    plate(rshape([[-0.006, 0.150], [0.046, 0.150], [0.046, 0.215], [-0.006, 0.215]], 0.006), 0.008, 'red', [0, 0, -0.121], 'xy', [{ c: [0.02, 0.17], r: 0.0129 }]),
    box(0.052, 0.012, 0.046, 'red', [0.02, 0.221, -0.1025], 0.003)];
  const cmount = part({ id: 'grip-tiltarm-cylmount', sec: '5.8', item: '4', pn: '277275', fr: "Support du vérin d'inclinaison", en: 'Tilt cylinder mount', qty: '1', page: 33, explode: [0, 0, -0.07], approx: true }, cm);
  const pin = part({ id: 'grip-tiltarm-pin', sec: '5.8', item: '5', pn: '277287', fr: 'Axe de 1 po', en: 'Pin, 1 in', qty: '1', page: 33, explode: [0, 0, -0.16] },
    [cyl(0.0127, 0.053, 'machined', [0.02, 0.17, -0.0985], 'z', 28)]);
  const ret = part({ id: 'grip-tiltarm-retainer', sec: '5.8', item: '6', pn: '277289', fr: "Plaque de retenue de l'axe", en: 'Pin retainer plate', qty: '1', page: 33, explode: [0, 0, -0.20] },
    [plate(rshape([[-0.006, 0.152], [0.046, 0.152], [0.046, 0.21], [-0.006, 0.21]], 0.006), 0.004, 'zincClear', [0, 0, -0.127], 'xy', [{ c: [0.0, 0.198], r: 0.0034 }, { c: [0.04, 0.198], r: 0.0034 }])]);
  const stud = part({ id: 'grip-tiltarm-stud', sec: '5.8', item: '7', pn: '277311', fr: 'Goujon fileté 1/4-20', en: 'Threaded stud, 1/4-20', qty: '1', page: 33, explode: [0, 0, -0.04] },
    [cyl(0.0032, 0.019, 'zinc', [0, 0.0455, LEGZ - LEGT / 2 - 0.0095], 'z', 12)]);
  const hw = [];
  for (let k = 0; k < 6; k++) { const a = (30 + k * 60) * DEG; hw.push(boltAt([0.075 * Math.cos(a), 0.286, 0.075 * Math.sin(a)], [0, -1, 0], { d: 0.5 * IN, L: 1.5 * IN, washer: true })); }
  for (const x of [-0.018, 0.040]) for (const y of [0.200, 0.240]) hw.push(boltAt([x, y, -0.060], [0, 0, 1], { d: 0.5 * IN, L: 1 * IN, washer: true }));
  for (const x of [0.0, 0.04]) hw.push(boltAt([x, 0.198, -0.129], [0, 0, -1], { d: 0.25 * IN, L: 0.75 * IN, head: 'shcs', washer: true }));
  const vis = part({ id: 'grip-tiltarm-hw', sec: '5.8', item: '9', pn: 'B269', fr: 'Visserie', en: 'Hardware', qty: '-', page: 33, explode: [0, 0.05, 0],
    note: 'Repères 1 (116142 x2), 2 (117753 x10), 8 (B265 x4), 9 (B269 x6), 10 (C008 x2).' }, hw);
  return asm({ id: 'grip-tiltarm', sec: '5.8', item: '14', pn: '277210', fr: "Bras d'inclinaison", en: 'Gripper tilt arm V2.0', qty: '1', page: 33, explode: [0, -0.46, 0] },
    [mount, cmount, pin, ret, stud, vis], CF);
}

/* ================================================================== */
/* 5.3 : vérin d'inclinaison (278189), repère C                         */
/* ================================================================== */
const TC = { A: [0.02, 0.17, -0.095], B: [0.225, 0.073, -0.095] };
function buildTiltCylinder() {
  const A = VA(TC.A), B = VA(TC.B), len = A.distanceTo(B);
  const c = [ring(0.0185, 0.0128, 0.028, 'black', [0, 0, 0], 'z', 28), box(0.030, 0.026, 0.028, 'black', [0, 0.025, 0], 0.003),
    cyl(0.024, 0.105, 'black', [0, 0.0875, 0], 'y', 36), ring(0.0255, 0.020, 0.008, 'black', [0, 0.040, 0], 'y', 36), ring(0.0255, 0.020, 0.010, 'black', [0, 0.135, 0], 'y', 36),
    cyl(0.0225, 0.012, 'black', [0, 0.146, 0], 'y', 32), cyl(0.0111, len - 0.035 - 0.152, 'chrome', [0, (0.152 + len - 0.035) / 2, 0], 'y', 28),
    cyl(0.012, 0.016, 'black', [0, len - 0.027, 0], 'y', 24), ring(0.017, 0.0096, 0.026, 'black', [0, len, 0], 'z', 28),
    box(0.040, 0.075, 0.050, 'alu', [-0.044, 0.095, 0], 0.003)];
  for (const y of [0.075, 0.115]) c.push(disc(0.0075, 0.002, 'alu', [-0.0645, y, 0], 'x', 16));
  const cy = part({ id: 'grip-tiltcyl-cyl', sec: '5.3', item: '3', pn: '276784', fr: 'Vérin 1-1/2 po x 2-3/4 po', en: 'Hydraulic cylinder, 1-1/2 in bore', qty: '1', page: 17, spare: true, explode: [0, 0, 0] },
    [grp(c, { name: 'tiltcyl' })]);
  between(cy.children[0], A, B);
  const fit = grp([...[0.075, 0.115].map(y => grp([fitting({ d: 0.25 * IN, L: 0.026, mat: 'zincClear' }), m(G.torus(0.012, 0.0045, Math.PI / 2, 8, 12), 'zincClear', { p: [0.012, 0.026, 0], r: [0, 0, 90] })], { p: [-0.064, y, 0], r: [0, 0, 90] })),
    aim(greaseNipple('zincClear'), V(0, 0.0185, 0), V(0, 1, 0)), aim(greaseNipple('zincClear'), V(0, len + 0.017, 0), V(0, 1, 0))]);
  between(fit, A, B);
  const fits = part({ id: 'grip-tiltcyl-fittings', sec: '5.3', item: '1', pn: '2062-4-4', fr: 'Raccords coudés et graisseurs', en: '90 deg fittings and grease nipples', qty: '2', page: 17, explode: [-0.05, 0.05, 0] }, [fit]);
  const rt = grp([box(0.003, 0.070, 0.054, 'zincClear', [-0.0665, 0.095, 0], 0.001), box(0.016, 0.003, 0.054, 'zincClear', [-0.0735, 0.0585, 0], 0.001)]);
  between(rt, A, B);
  const ret = part({ id: 'grip-tiltcyl-retainer', sec: '5.3', item: '4', pn: '278172', fr: 'Plaque de retenue des raccords', en: 'Formed fitting retainer plate', qty: '1', page: 17, explode: [-0.09, 0.09, 0], approx: true }, [rt]);
  const hw = grp([boltAt([-0.068, 0.095, 0.020], [-1, 0, 0], { d: 0.3125 * IN, L: 0.625 * IN, washer: true }), boltAt([-0.068, 0.095, -0.020], [-1, 0, 0], { d: 0.3125 * IN, L: 0.625 * IN, washer: true })]);
  between(hw, A, B);
  const vis = part({ id: 'grip-tiltcyl-hw', sec: '5.3', item: '5', pn: 'B074', fr: 'Visserie', en: 'Hardware', qty: '-', page: 17, explode: [-0.13, 0.13, 0], note: 'Repères 2 (224212 x2) et 5 (B074 x2).' }, [hw]);
  return asm({ id: 'grip-tiltcyl', sec: '5.3', item: '18', pn: '278189', fr: "Vérin d'inclinaison", en: 'Tilt cylinder assembly', qty: '1', page: 17, explode: [-0.32, -0.70, 0] },
    [cy, fits, ret, vis], CF);
}

/* 3, 11, 26, 28 : axe épaulé du vérin d'inclinaison (sur le support 16 du bloc de serrage). */
function buildTiltPin() {
  const [x, y] = [TC.B[0], TC.B[1]], zh = -0.1241;
  const sb = grp([lathe([[0, 0], [0.0143, 0], [0.0143, 0.0190], [0.0120, 0.0195], [0, 0.0195]], 'blackOxide', [0, 0, 0], 'y', 24),
    cyl(0.0095, 0.0762, 'blackOxide', [0, -0.0381, 0], 'y', 20), cyl(0.0079, 0.019, 'blackOxide', [0, -0.0857, 0], 'y', 16)]);
  const bolt3 = part({ id: 'grip-pivot3', sec: '5', item: '3', pn: '236263', fr: "Boulon épaulé 3/4 x 3 po (vérin d'inclinaison)", en: 'Shoulder bolt, 3/4 x 3 in', qty: '1', page: 10, explode: [-0.48, -0.74, 0] },
    [aim(sb, V(x, y, zh), V(0, 0, -1))], CF);
  const hw = [];
  for (const z of [zh, -0.1145, -0.0771]) hw.push(aim(washer({ d: 0.75 * IN, od: 0.032, t: 0.0016, mat: 'zincClear' }), V(x, y, z), V(0, 0, 1)));
  hw.push(nutAt([x, y, -0.0479], [0, 0, 1], { d: 0.625 * IN, washer: true, lock: true }));
  const vis = part({ id: 'grip-hw-pivot', sec: '5', item: '11', pn: '276913', fr: "Rondelles et écrou de l'axe épaulé", en: 'Shoulder bolt washers and nut', qty: '-', page: 10, explode: [-0.41, -0.74, 0],
    note: 'Repères 11 (276913 x3), 26 (N064 x1) et 28 (W007 x1).' }, hw, CF);
  return [bolt3, vis];
}

/* ================================================================== */
/* 5.1 : codeur d'inclinaison (280896) et biellette 5.1.1, repère C      */
/* ================================================================== */
const TE = { z: 0.075, yl: 0.043 };
function buildTiltEncoder() {
  const z0 = TE.z, ch = [];
  const enc = part({ id: 'grip-tiltenc-enc', sec: '5.1', item: '7', pn: '277177', fr: "Codeur J6 d'inclinaison (programmé)", en: 'Rotary encoder J6 (tilt)', qty: '1', page: 14, spare: true, explode: [0, 0.07, 0] },
    [grp([encoder({ len: 0.034, conn: 'side' })], { p: [0, 0.058, z0], r: [0, 90, 0] })]);
  const t = 0.0025;
  const cov = [box(0.056, t, 0.05, 'zincClear', [0, 0.1005, z0], 0.0008)];
  for (const s of [-1, 1]) { cov.push(box(t, 0.068, 0.05, 'zincClear', [s * 0.0265, 0.0665, z0], 0.0008)); cov.push(box(0.027, t, 0.05, 'zincClear', [s * 0.0405, 0.029 + t / 2, z0], 0.0008)); }
  const cover = part({ id: 'grip-tiltenc-cover', sec: '5.1', item: '10', pn: '280047', fr: 'Plaque pliée de protection', en: 'Formed plate', qty: '1', page: 14, explode: [0, 0.16, 0] }, cov);
  const mnt = part({ id: 'grip-tiltenc-mount', sec: '5.1', item: '9', pn: '280946', fr: 'Plaque pliée du codeur', en: 'Formed encoder mount plate', qty: '1', page: 14, explode: [0, 0.10, 0.03], approx: true },
    [box(0.050, 0.002, 0.030, 'zincClear', [0, 0.057, z0 + 0.008], 0.0006), box(0.002, 0.012, 0.030, 'zincClear', [0.023, 0.0505, z0 + 0.008], 0.0006)]);
  // biellette 5.1.1 : axe, plaque fendue, rondelle, vis
  const lp = rshape([[-0.010, -0.009], [0.058, -0.009], [0.058, 0.009], [-0.010, 0.009]], 0.008);
  const lpin = part({ id: 'grip-tiltenc-link-pin', sec: '5.1.1', item: '1', pn: '277332', fr: 'Axe usiné', en: 'Machined pin', qty: '1', page: 15, explode: [0, 0.035, 0] }, [cyl(0.006, 0.010, 'machined', [0, TE.yl + 0.010, z0], 'y', 20)]);
  const lplate = part({ id: 'grip-tiltenc-link-plate', sec: '5.1.1', item: '2', pn: '277295', fr: 'Plaque usinée fendue', en: 'Machined slotted plate', qty: '1', page: 15, explode: [0, 0, 0] },
    [m(G.plate(lp, 0.005, { holes: [{ slot: [0.030, 0, 0.050, 0], r: 0.0042 }, { rect: [0, 0, 0.007, 0.007, 0.0005] }] }), 'zincClear', { p: [0, TE.yl + 0.0025, z0], r: [-90, 0, -90] })]);
  const lhw = part({ id: 'grip-tiltenc-link-hw', sec: '5.1.1', item: '4', pn: '118399', fr: 'Vis et rondelle', en: 'Screw and washer', qty: '-', page: 15, explode: [0, -0.025, 0], note: 'Repères 3 (258780) et 4 (118399 BHCS 1/4-20 x 1/2).' },
    [boltAt([0, TE.yl, z0], [0, -1, 0], { d: 0.25 * IN, L: 0.5 * IN, head: 'bhcs', washer: true, mat: 'blackOxide' })]);
  const link = asm({ id: 'grip-tiltenc-link', sec: '5.1.1', item: '8', pn: '277333', fr: 'Biellette du codeur', en: 'Encoder linkage', qty: '1', page: 15, explode: [0, 0.02, 0] }, [lpin, lplate, lhw]);
  const hw = [];
  for (const s of [-1, 1]) { hw.push(boltAt([s * 0.043, 0.013, z0], [0, -1, 0], { d: 0.25 * IN, L: 0.75 * IN, washer: true })); hw.push(nutAt([s * 0.043, 0.029 + t, z0], [0, 1, 0], { d: 0.25 * IN, washer: true, lock: true })); }
  for (const x of [-0.018, 0.018]) hw.push(boltAt([x, 0.056, z0 + 0.008], [0, -1, 0], { d: 0.138 * IN, L: 0.5 * IN, head: 'shcs' }));
  const vis = part({ id: 'grip-tiltenc-hw', sec: '5.1', item: '6', pn: 'B042', fr: 'Visserie', en: 'Hardware', qty: '-', page: 14, explode: [0, 0.12, 0],
    note: 'Repères 1 (236666 x2), 2 (245089 x2), 3 (236667 x2), 4 (W001 x4), 5 (N058 x2), 6 (B042 x2).' }, hw);
  return asm({ id: 'grip-tiltenc', sec: '5.1', item: '12', pn: '280896', fr: "Codeur d'inclinaison", en: 'Tilt encoder assembly', qty: '1', page: 14, explode: [0.28, -0.70, 0], approx: true,
    note: "Position estimée : sur le dessus du bloc de serrage, entre les jambes du bras. La biellette s'engage sur le goujon 277311 de la jambe." },
    [enc, cover, mnt, link, vis], CF);
}

/* ================================================================== */
/* 5.6 : bloc de serrage (277553), repère C                             */
/* ================================================================== */
const FR = { hx: 0.2575, hz: 0.135, y0: 0.013, y1: 0.029, yb: -0.045, t: 0.012 };
const CYX = 0.170;    // vérins de pince à x = ±0,17
const JP = { z: 0.077, y: -0.118, off: 0.028, t: 0.025 };  // pivots des mâchoires
const TB = { y: -0.058 };                                  // barre en T des tiges

function buildFrame() {
  const holes = [];
  for (const x of [-CYX, CYX]) { holes.push({ c: [x, 0], r: 0.016 }); for (const z of [-0.030, 0.030]) holes.push({ rect: [x, z, 0.066, 0.0105, 0.002] }); }
  for (const x of [-0.048, 0.048]) for (const z of [-0.03, 0.03]) holes.push({ c: [x, z], r: 0.0072 });
  for (const x of [-0.235, 0.235]) for (const z of [-0.11, 0.11]) holes.push({ c: [x, z], r: 0.0055 });
  const ch = [plate(rshape([[-FR.hx, -FR.hz], [FR.hx, -FR.hz], [FR.hx, FR.hz], [-FR.hx, FR.hz]], 0.012), FR.y1 - FR.y0, 'red', [0, (FR.y0 + FR.y1) / 2, 0], 'xz', holes)];
  const hS = FR.y0 - FR.yb;
  for (const s of [-1, 1]) {
    ch.push(box(2 * FR.hx - 0.004, hS, FR.t, 'red', [0, (FR.y0 + FR.yb) / 2, s * (FR.hz - FR.t / 2)], 0.003));
    ch.push(box(FR.t, hS, 2 * FR.hz - 2 * FR.t, 'red', [s * (FR.hx - FR.t / 2), (FR.y0 + FR.yb) / 2, 0], 0.003));
  }
  return part({ id: 'grip-clamp-frame', sec: '5.6', item: '15', pn: '277190', fr: 'Cadre usiné de la pince', en: 'Gripper frame, machined', qty: '1', page: 21, explode: [0, 0, 0], approx: true,
    note: "Plaque supérieure et jupes. Les jambes du bras d'inclinaison s'articulent sur les jupes longues (boulons épaulés 10)." }, ch);
}

/* mâchoire 277368 : contour en (z, y) ; s = +1 mâchoire du côté +Z, s = -1 côté -Z (miroir explicite) */
function jawShape(s) {
  const pts = [[-0.016, -0.078], [-0.026, -0.058], [-0.016, -0.038], [0.006, -0.034], [0.058, -0.080], [0.088, -0.098], [0.130, -0.098], [0.140, -0.108],
    [0.146, -0.150], [0.140, -0.168], [0.128, -0.166], [0.112, -0.141], [0.100, -0.132], ...arcPts(JP.z, JP.y, 0.022, -20, -160, 7), [0.040, -0.104]];
  const rr = pts.map((_, i) => (i <= 3 ? 0.007 : (i >= 13 && i <= 20 ? 0 : 0.004)));
  return rshape(pts.map(([z, y]) => [s * z, y]), rr);
}
function jawHoles(s) { return [{ c: [s * JP.z, JP.y], r: 0.0127 }, { slot: [-0.006 * s, -0.0566, 0.006 * s, -0.0594], r: 0.0115 }]; }
function buildJawAssembly(s, idx) {
  // s = +1 : mâchoires du côté +Z (dehors, x = ±(0,17 + 0,028)) ; s = -1 : côté -Z (dedans, x = ±0,142)
  const parts = [];
  [-1, 1].forEach((e, k) => {
    const x = e * (CYX + (s > 0 ? JP.off : -JP.off));
    const j = m(G.plate(jawShape(s), JP.t, { holes: jawHoles(s) }), 'red', { p: [x, 0, 0], r: [0, -90, 0] });
    parts.push(part({ id: `grip-jaw${idx}-${k + 1}`, sec: '5.6.2.1', item: '2', pn: '277368', fr: 'Mâchoire usinée', en: 'Grapple jaw, machined', qty: '2', page: 26, spare: true,
      explode: [e * 0.03, -0.03, s * 0.10] }, [j]));
    const bush = lathe([[0.0095, -JP.t / 2], [0.0127, -JP.t / 2], [0.0127, JP.t / 2 - 0.0016], [0.0160, JP.t / 2 - 0.0016], [0.0160, JP.t / 2], [0.0095, JP.t / 2], [0.0095, -JP.t / 2]], 'bronze', [0, 0, 0], 'y', 28);
    const bg = grp([bush], { p: [x, JP.y, s * JP.z], r: [0, 0, -90] });
    parts.push(part({ id: `grip-jaw${idx}-bush-${k + 1}`, sec: '5.6.2.1', item: '4', pn: '276909', fr: 'Bague bronze 3/4 x 1 po', en: 'Bushing, 3/4 x 1 in bronze', qty: '2', page: 26, spare: true,
      explode: [e * (s > 0 ? 0.10 : -0.10), -0.03, s * 0.10] }, [bg]));
  });
  const xo = CYX + (s > 0 ? JP.off : -JP.off);
  const bar = part({ id: `grip-jaw${idx}-bar`, sec: '5.6.2.1', item: '3', pn: '277373', fr: 'Barre percée usinée', en: 'Bar, drilled and machined', qty: '1', page: 26, explode: [0, 0.03, s * 0.10] },
    [box(2 * xo + 0.034, 0.018, 0.030, 'red', [0, -0.089, s * 0.113], 0.003)]);
  const hw = [];
  for (const e of [-1, 1]) for (const z of [0.106, 0.121]) hw.push(boltAt([e * xo, -0.080, s * z], [0, 1, 0], { d: 0.375 * IN, L: 1 * IN, washer: true }));
  const vis = part({ id: `grip-jaw${idx}-hw`, sec: '5.6.2.1', item: '5', pn: 'B142', fr: 'Vis de la barre', en: 'Bar screws', qty: '4', page: 26, explode: [0, 0.07, s * 0.10], note: 'Repères 1 (224166 x4) et 5 (B142 x4).' }, hw);
  return asm({ id: `grip-jaw${idx}`, sec: '5.6.2.1', item: '3', pn: '277374', fr: `Mâchoires pour tuyau 5 po (${s > 0 ? 'côté +' : 'côté -'})`, en: 'Jaw assembly for 5 in pipe', qty: '2', page: 26,
    explode: [0, -0.04, s * 0.06] }, [...parts, bar, vis]);
}
function buildJawMounts() {
  const out = [];
  [-1, 1].forEach((e, i) => {
    const x = e * CYX, ch = [];
    ch.push(box(0.12, FR.y0, 0.21, 'red', [x, FR.y0 / 2, 0], 0.003));
    ch.push(box(0.09, 0.030, 0.176, 'red', [x, -0.015, 0], 0.004));
    for (const s of [-1, 1]) {
      ch.push(plate(rshape([[-0.032, 0], [0.032, 0], [0.032, 0.165], [-0.032, 0.165]], [0, 0, 0.008, 0.008]), 0.010, 'red', [x, 0, s * 0.030], 'xy', [{ c: [0, 0.075], r: 0.0055 }, { c: [0, 0.145], r: 0.0055 }]));
      const lugPts = [[0.058, -0.028], [0.096, -0.028], [0.096, JP.y], ...arcPts(JP.z, JP.y, 0.019, 0, -180, 10).slice(1, -1), [0.058, JP.y]].map(([z, y]) => [s * z, y]);
      ch.push(m(G.plate(rshape(lugPts, [0.004, 0.004, 0]), 0.020, { holes: [{ c: [s * JP.z, JP.y], r: 0.0096 }] }), 'red', { p: [x, 0, 0], r: [0, -90, 0] }));
    }
    out.push(part({ id: `grip-jawmount-${e < 0 ? 'lhs' : 'rhs'}`, sec: '5.6.2', item: e < 0 ? '1' : '2', pn: e < 0 ? '277844' : '277197',
      fr: `Support usiné vérin et mâchoires (${e < 0 ? 'gauche' : 'droit'})`, en: `Grapple/cylinder mount (${e < 0 ? 'LHS' : 'RHS'})`, qty: '1', page: 25, explode: [e * 0.02, 0.0, 0],
      note: 'Plaques verticales autour du cylindre du vérin, pattes basses des pivots des mâchoires.' }, ch));
  });
  return out;
}
function buildGrappleClamp() {
  const hw = [];
  for (const e of [-1, 1]) for (const s of [-1, 1]) {
    // boulon épaulé 4 selon X, tête côté de la mâchoire, rondelle 5 + écrou 6 de l'autre côté de la patte
    const xj = e * (CYX + (s > 0 ? JP.off : -JP.off)), side = (s > 0 ? e : -e);
    const xh = xj + side * (JP.t / 2 + 0.0016);
    const p = [xh, JP.y, s * JP.z];
    const sb = grp([lathe([[0, 0], [0.0143, 0], [0.0143, 0.0127], [0.012, 0.0135], [0, 0.0135]], 'blackOxide', [0, 0, 0], 'y', 24),
      cyl(0.0095, 0.0572, 'blackOxide', [0, -0.0286, 0], 'y', 20), cyl(0.0079, 0.019, 'blackOxide', [0, -0.0667, 0], 'y', 16)]);
    hw.push(aim(sb, V(...p), V(side, 0, 0)));
    for (const xw of [xj + side * JP.t / 2, xj - side * JP.t / 2]) hw.push(aim(washer({ d: 0.75 * IN, od: 0.032, t: 0.0016, mat: 'zincClear' }), V(xw, JP.y, s * JP.z), V(side, 0, 0)));
    hw.push(nutAt([e * CYX - side * 0.010, JP.y, s * JP.z], [-side, 0, 0], { d: 0.625 * IN, washer: true, lock: true }));
  }
  const vis = part({ id: 'grip-clampjaw-hw', sec: '5.6.2', item: '4', pn: '249855', fr: 'Boulons épaulés des mâchoires', en: 'Jaw shoulder bolts', qty: '4', page: 25, explode: [0, -0.02, 0],
    note: 'Repères 4 (249855 x4), 5 (W007 x4), 6 (N064 x4), 7 (276913 x8).' }, hw);
  return asm({ id: 'grip-clampjaw', sec: '5.6.2', item: '33', pn: '280898', fr: 'Supports et mâchoires', en: 'Grapple clamp (jaws)', qty: '1', page: 25, explode: [0, -0.18, 0] },
    [...buildJawMounts(), buildJawAssembly(1, 1), buildJawAssembly(-1, 2), vis]);
}

/* 5.6.3 / 5.6.4 : vérins de pince, avec tige 5.6.3.2 et kit de joints 5.6.3.1 */
function buildSealKit(cid, e) {
  const R = [
    ['1', '276942', 'Racleur', 'Wiper seal', 0.0127, 0.0172, 0.005, 0.0335, 'rubber'],
    ['5', '276941', 'Joint de tige', 'Rod seal', 0.0127, 0.0175, 0.006, 0.040, 'blue'],
    ['4', '276940', 'Joint de tige à pression', 'Rod pressure seal', 0.0127, 0.0178, 0.006, 0.047, 'blue'],
    ['3', '276933', "Bague d'usure 1,25 po", 'Wear ring 1.25 in', 0.0127, 0.0159, 0.0254, 0.0640, 'orange'],
    ['2', '276937', "Bague d'usure 1-1/2 po", 'Wear ring 1-1/2 in', 0.0159, 0.0190, 0.0127, 0.1585, 'orange'],
    ['2', '276937', "Bague d'usure 1-1/2 po", 'Wear ring 1-1/2 in', 0.0159, 0.0190, 0.0127, 0.1735, 'orange'],
    ['6', '277510', 'Anneau en X', 'X-ring', 0.0166, 0.0189, 0.0026, 0.1655, 'rubber'],
    ['6', '277510', 'Anneau en X', 'X-ring', 0.0166, 0.0189, 0.0026, 0.1665 - 0.0026 * 0 + 0.003, 'rubber'],
    ['8', '277507', "Anneau d'appui", 'Back-up ring', 0.0094, 0.0115, 0.0012, 0.1805, 'plasticLight'],
    ['7', '277505', 'Joint torique 2-018', 'O-ring 2-018', 0.0094, 0.0114, 0.0018, 0.1822, 'rubber'],
    ['8', '277507', "Anneau d'appui", 'Back-up ring', 0.0094, 0.0115, 0.0012, 0.1839, 'plasticLight'],
  ];
  const cnt = {};
  const kids = R.map(([it, pn, fr, en, ri, ro, h, y, mk], i) => {
    cnt[it] = (cnt[it] || 0) + 1;
    const mesh = (mk === 'rubber' && h < 0.004) ? m(G.torus((ri + ro) / 2, (ro - ri) / 2, Math.PI * 2, 8, 32), mk, { p: [0, y, 0], r: [90, 0, 0] }) : ring(ro, ri, h, mk, [0, y, 0], 'y', 32);
    return part({ id: `${cid}-seal-${i + 1}`, sec: '5.6.3.1', item: it, pn, fr, en, qty: (it === '2' || it === '6' || it === '8') ? '2' : '1', page: 28, explode: [0, (y - 0.11) * 1.6, 0] }, [mesh]);
  });
  return asm({ id: `${cid}-seals`, sec: '5.6.3.1', item: '3', pn: '277517', fr: 'Kit de joints du vérin', en: 'Seal kit, grapple cylinder', qty: '1', page: 28, explode: [0, 0.02, 0.22],
    note: "Joints dans le fourreau et sur le piston (cachés à l'assemblage)." }, kids);
}
function buildRod(cid, e, item) {
  const piston = part({ id: `${cid}-rod-piston`, sec: '5.6.3.2', item: '4', pn: '276007', fr: 'Piston', en: 'Piston', qty: '1', page: 29, explode: [0, 0.10, 0] },
    [lathe([[0, 0.152], [0.0182, 0.152], [0.0185, 0.1535], [0.0185, 0.1785], [0.0182, 0.180], [0, 0.180]], 'machined', [0, 0, 0], 'y', 32)]);
  const rodL = 0.165 - TB.y;
  const rod = part({ id: `${cid}-rod-rod`, sec: '5.6.3.2', item: '7', pn: '277557', fr: 'Tige usinée', en: 'Cylinder rod, machined', qty: '1', page: 29, explode: [0, 0.0, 0] },
    [cyl(0.0127, rodL - 0.0105, 'chrome', [0, TB.y + 0.0105 + (rodL - 0.0105) / 2, 0], 'y', 28), cyl(0.0094, 0.012, 'chrome', [0, 0.171, 0], 'y', 20)]);
  const bar = part({ id: `${cid}-rod-bar`, sec: '5.6.3.2', item: '3', pn: '275968', fr: 'Barre en T usinée', en: 'Bar, machined', qty: '1', page: 29, explode: [0, -0.04, 0] },
    [cyl(0.0105, 0.096, 'machined', [0, TB.y, 0], 'x', 24), box(0.030, 0.012, 0.024, 'machined', [0, TB.y + 0.004, 0], 0.003)]);
  const kids = [piston, rod, bar];
  [[-0.034, 0], [-0.022, 1], [0.022, 2], [0.034, 3]].forEach(([dx, k]) => kids.push(part({ id: `${cid}-rod-bush-${k + 1}`, sec: '5.6.3.2', item: '10', pn: '281609', fr: 'Bague', en: 'Bushing', qty: '4', page: 29, spare: true,
    explode: [+(Math.sign(dx) * (0.035 + Math.abs(dx) * 1.2)).toFixed(3), -0.04, 0] }, [ring(0.0115, 0.0105, 0.0122, 'bronze', [dx, TB.y, 0], 'x', 24)])));
  [-1, 1].forEach((sx, k) => kids.push(part({ id: `${cid}-rod-retwasher-${k + 1}`, sec: '5.6.3.2', item: '5', pn: '276925', fr: 'Rondelle de retenue usinée', en: 'Retaining washer, machined', qty: '2', page: 29,
    explode: [sx * 0.10, -0.04, 0] }, [disc(0.016, 0.004, 'machined', [sx * 0.0425, TB.y, 0], 'x', 28)])));
  const hw = [boltAt([-0.0445, TB.y, 0], [-1, 0, 0], { d: 0.375 * IN, L: 0.625 * IN, washer: true }), boltAt([0.0445, TB.y, 0], [1, 0, 0], { d: 0.375 * IN, L: 0.625 * IN, washer: true }),
    boltAt([0, TB.y - 0.0105, 0], [0, -1, 0], { d: 0.5 * IN, L: 1.75 * IN, washer: true }), cyl(0.0024, 0.006, 'blackOxide', [0.0170, 0.167, 0], 'x', 10)];
  kids.push(part({ id: `${cid}-rod-hw`, sec: '5.6.3.2', item: '8', pn: 'B139', fr: 'Visserie de la tige', en: 'Rod hardware', qty: '-', page: 29, explode: [0, -0.07, 0],
    note: 'Repères 1 (117753), 2 (224166 x2), 6 (277504 vis de pression), 8 (B139 x2), 9 (B271).' }, hw));
  return asm({ id: `${cid}-rod`, sec: '5.6.3.2', item, pn: '277556', fr: 'Tige de vérin avec barre en T', en: 'Rod assembly', qty: '1', page: 29, explode: [0, -0.12, 0] }, kids);
}
function buildGrappleCylinder(e) {
  const no = e < 0 ? 1 : 2, cid = `grip-cyl${no}`;
  const pn = e < 0 ? '277550' : '277682', pnB = e < 0 ? '277551' : '277683', page = e < 0 ? 30 : 27, sec = e < 0 ? '5.6.4' : '5.6.3';
  const it = e < 0 ? { gland: '2', barrel: '4', rod: '5', cap: '6' } : { gland: '2', barrel: '6', rod: '4', cap: '5' };
  const xin = -e * 0.0375;  // face intérieure (vers le centre)
  const gland = part({ id: `${cid}-gland`, sec, item: it.gland, pn: '275983', fr: 'Fond de guidage', en: 'Gland', qty: '1', page, explode: [0, -0.07, 0] }, [box(0.075, 0.022, 0.050, 'black', [0, 0.040, 0], 0.003)]);
  const b = [box(0.075, 0.130, 0.050, 'black', [0, 0.116, 0], 0.003)];
  for (const y of [0.065, 0.165]) b.push(disc(0.0085, 0.003, 'black', [xin + Math.sign(xin) * 0.0015, y, 0], 'x', 20));
  for (const y of [0.075, 0.145]) for (const s of [-1, 1]) b.push(disc(0.0065, 0.001, 'black', [0, y, s * 0.0252], 'z', 16));
  const barrel = part({ id: `${cid}-barrel`, sec, item: it.barrel, pn: pnB, fr: `Fourreau no ${no}`, en: `Cylinder barrel #${no}`, qty: '1', page, explode: [0, 0, 0] }, b);
  const cap = part({ id: `${cid}-cap`, sec, item: it.cap, pn: '277567', fr: 'Chapeau du vérin', en: 'Cylinder cap, top', qty: '1', page, explode: [0, 0.10, 0] }, [box(0.080, 0.020, 0.056, 'black', [0, 0.191, 0], 0.003)]);
  const hw = [];
  for (const x of [-0.028, 0.028]) for (const z of [-0.016, 0.016]) { hw.push(boltAt([x, 0.201, z], [0, 1, 0], { d: 0.4375 * IN, L: 1.125 * IN, washer: true })); hw.push(boltAt([x, 0.029 + 0.0, z], [0, -1, 0], { d: 0.4375 * IN, L: 1.5 * IN, head: 'shcs', mat: 'blackOxide' })); }
  const np = e < 0 ? 4 : 6;
  for (let k = 0; k < np; k++) hw.push(disc(0.0036, 0.0015, 'zinc', [-xin + Math.sign(-xin) * 0.0007, 0.08 + k * 0.016, 0.012], 'x', 12));
  const vis = part({ id: `${cid}-hw`, sec, item: '8', pn: 'B206', fr: 'Visserie et bouchons', en: 'Hardware and plugs', qty: '-', page, explode: [0, 0.08, -0.12],
    note: `Repères 1 (218014 x4), 7 (278170 x${np}), 8 (B206 x4), 9 (C215 x4, vis du fond, têtes noyées).` }, hw);
  return asm({ id: cid, sec, item: e < 0 ? '18' : '23', pn, fr: `Vérin de pince no ${no}`, en: `Grapple cylinder #${no}`, qty: '1', page, spare: true, explode: [0, 0.16, 0] },
    [gland, barrel, cap, buildRod(cid, e, it.rod), buildSealKit(cid, e), vis], { p: [e * CYX, 0, 0] });
}

/* 5.6.1 : lumière avec support (278695) x2, sous les bouts du cadre */
function buildLight(e, i) {
  const s = e;              // lumière 1 : bout +X côté +Z ; lumière 2 : bout -X côté -Z
  const x0 = e * 0.236;
  const ch = [box(0.003, 0.040, 0.044, 'red', [e * (FR.hx + 0.0015), -0.025, s * 0.112], 0.001), box(0.012, 0.003, 0.044, 'red', [e * (FR.hx - 0.004), -0.0465, s * 0.112], 0.001)];
  const cr = grp([box(0.042, 0.003, 0.050, 'red', [0, 0.018, 0], 0.001), box(0.042, 0.032, 0.003, 'red', [0, 0.003, 0.0265], 0.001), box(0.042, 0.032, 0.003, 'red', [0, 0.003, -0.0265], 0.001)],
    { p: [x0, -0.072, s * 0.115], r: [s * 45, 0, 0] });
  ch.push(cr);
  const mount = part({ id: `grip-light${i}-mount`, sec: '5.6.1', item: '1', pn: '278690', fr: 'Support soudé de la lumière', en: 'Light mount weldment', qty: '1', page: 24, explode: [0, 0, 0], approx: true }, ch);
  const lamp = grp([box(0.038, 0.030, 0.048, 'black', [0, 0, 0], 0.004), box(0.034, 0.002, 0.044, 'glass', [0, -0.0155, 0], 0.001),
    ...[-0.012, 0, 0.012].map(z => box(0.026, 0.001, 0.006, 'ledWhite', [0, -0.0142, z], 0.0003)),
    cyl(0.005, 0.016, 'black', [0, 0.020, 0], 'y', 14)], { p: [x0, -0.072, s * 0.115], r: [s * 45, 0, 0] });
  const lp = part({ id: `grip-light${i}-lamp`, sec: '5.6.1', item: '2', pn: '280912', fr: 'Lumière de la pince', en: 'Gripper light', qty: '1', page: 24, spare: true, explode: [0, -0.06, s * 0.05] }, [lamp]);
  const hw = [];
  for (const y of [-0.015, -0.033]) hw.push(boltAt([e * (FR.hx + 0.003), y, s * 0.112], [e, 0, 0], { d: 0.3125 * IN, L: 0.875 * IN, washer: true }));
  const vis = part({ id: `grip-light${i}-hw`, sec: '5.6.1', item: '3', pn: 'B076', fr: 'Vis du support', en: 'Mount screws', qty: '2', page: 24, explode: [e * 0.06, 0, 0], note: 'Repères 3 (B076 x2) et 4 (231470 x2).' }, hw);
  const gr = part({ id: `grip-light${i}-grommet`, sec: '5.6.1', item: '5', pn: '256145', fr: 'Passe-fil 1/4 po', en: 'Grommet 1/4 x 1/4', qty: '1', page: 24, explode: [0, -0.03, s * 0.02] },
    [grp([ring(0.006, 0.0032, 0.004, 'rubber', [0, 0.0195, 0], 'y', 16)], { p: [x0, -0.072, s * 0.115], r: [s * 45, 0, 0] })]);
  return asm({ id: `grip-light${i}`, sec: '5.6.1', item: '32', pn: '278695', fr: `Lumière avec support (${i})`, en: 'Light with mount', qty: '2', page: 24,
    explode: [e * 0.10, -0.10, s * 0.10], approx: true, note: 'Lumières aux coins bas du cadre, inclinées vers les mâchoires (vue de bout p. 10).' }, [mount, lp, vis, gr]);
}

/* 5.6 : ensemble du bloc de serrage */
function buildClamp() {
  const kids = [buildFrame(), buildGrappleClamp(), buildGrappleCylinder(-1), buildGrappleCylinder(1), buildLight(1, 1), buildLight(-1, 2)];
  // support de vérin 16 (chape) sous l'axe épaulé 3
  const [bx, by] = [TC.B[0], TC.B[1]], bz = TC.B[2];
  const ch16 = [box(0.050, 0.012, 0.060, 'red', [bx, FR.y1 + 0.006, bz], 0.003)];
  const y0 = FR.y1 + 0.012;
  for (const dz of [-0.0235, 0.0235]) ch16.push(plate(rshape([[-0.020, y0], [0.020, y0], ...arcPts(0, by, 0.020, 0, 180, 12)], [0.002, 0.002]), 0.008, 'red', [bx, 0, bz + dz], 'xy', [{ c: [0, by], r: 0.0097 }]));
  kids.push(part({ id: 'grip-clamp-cylbracket', sec: '5.6', item: '16', pn: '277402', fr: 'Chape du vérin usinée', en: 'Cylinder mounting bracket', qty: '1', page: 21, explode: [0.06, 0.10, -0.08] }, ch16));
  // accumulateur 17
  const ac = [cyl(0.032, 0.090, 'black', [-0.090, 0.077, 0.030], 'z', 36), m(G.sphere(0.032, 28), 'black', { p: [-0.090, 0.077, 0.075], s: [1, 1, 0.45] }), m(G.sphere(0.032, 28), 'black', { p: [-0.090, 0.077, -0.015], s: [1, 1, 0.45] }),
    m(G.hex(0.022, 0.012), 'zincClear', { p: [-0.090, 0.077, -0.0355], r: [90, 0, 0] })];
  for (const z of [0.005, 0.055]) ac.push(m(G.torus(0.0335, 0.0022, Math.PI, 8, 24), 'zincClear', { p: [-0.090, 0.077, z] }), box(0.074, 0.016, 0.012, 'zincClear', [-0.090, FR.y1 + 0.008, z], 0.002));
  kids.push(part({ id: 'grip-clamp-accu', sec: '5.6', item: '17', pn: '277521', fr: 'Accumulateur', en: 'Accumulator assembly', qty: '1', page: 21, explode: [-0.05, 0.14, 0.12] }, ac));
  // valve de maintien de charge 8 sur son support soudé 25
  const vx = 0.090, vz = 0.045;
  kids.push(part({ id: 'grip-clamp-valvemount', sec: '5.6', item: '25', pn: '277736', fr: 'Support soudé de la valve', en: 'Load holding mount weldment', qty: '1', page: 21, explode: [0.03, 0.12, 0.06] },
    [box(0.058, 0.008, 0.086, 'red', [vx, FR.y1 + 0.004, vz], 0.002), box(0.040, 0.033, 0.060, 'red', [vx, FR.y1 + 0.008 + 0.0165, vz], 0.003)]));
  const va = [box(0.050, 0.060, 0.070, 'alu', [vx, 0.100, vz], 0.003)];
  for (const z of [vz - 0.018, vz + 0.018]) va.push(m(G.hex(0.019, 0.012), 'zinc', { p: [vx, 0.136, z] }), cyl(0.007, 0.010, 'zinc', [vx, 0.147, z], 'y', 16));
  kids.push(part({ id: 'grip-clamp-valve', sec: '5.6', item: '8', pn: '242556', fr: 'Valve de maintien de charge double', en: 'Load check valve, dual', qty: '1', page: 21, explode: [0.03, 0.20, 0.08] }, va));
  // tubes hydrauliques 19, 20, 21, 22, 26
  const xc2 = CYX - 0.0375 - 0.003, xc1 = -xc2;
  const T = [
    ['19', '277620', 1, [[0.080, 0.115, vz - 0.035], [0.080, 0.115, -0.010], [0.080, 0.165, -0.010], [xc2, 0.165, -0.010]]],
    ['20', '277675', 2, [[vx - 0.025, 0.085, 0.025], [0.050, 0.085, 0.025], [0.050, 0.125, 0.025], [-0.110, 0.125, 0.025], [-0.110, 0.165, 0.0], [xc1, 0.165, 0.0]]],
    ['21', '277677', 3, [[0.100, 0.085, vz - 0.035], [0.100, 0.085, -0.020], [0.100, 0.065, -0.020], [xc2, 0.065, -0.020]]],
    ['22', '277680', 4, [[vx - 0.025, 0.070, 0.025], [0.056, 0.070, 0.025], [0.056, 0.070, -0.112], [0.056, 0.046, -0.112], [-0.115, 0.046, -0.112], [-0.115, 0.065, -0.112], [-0.115, 0.065, 0.0], [xc1, 0.065, 0.0]]],
    ['26', '277786', 5, [[0.070, 0.130, vz], [0.070, 0.145, vz], [-0.090, 0.145, vz], [-0.090, 0.145, -0.050], [-0.090, 0.077, -0.050], [-0.090, 0.077, -0.0415]]],
  ];
  for (const [it, pn, n, pts] of T) kids.push(part({ id: `grip-clamp-tube-${n}`, sec: '5.6', item: it, pn, fr: `Tube hydraulique no ${n}`, en: `Hydraulic tube #${n}`, qty: '1', page: 21,
    explode: [0, 0.10 + n * 0.01, 0.03], approx: true, note: 'Parcours simplifié entre la valve et les vérins.' }, [steelTube(pts)]));
  // raccords 2, 3, 4
  const ft = [];
  for (const e of [-1, 1]) for (const y of [0.065, 0.165]) ft.push(aim(fitting({ d: 0.375 * IN, L: 0.012, mat: 'zincClear' }), V(e * (CYX - 0.0375) - e * 0.0, y, 0), V(-e, 0, 0)));
  for (const [p, d] of [[[0.080, 0.115, vz - 0.035], [0, 0, -1]], [[0.100, 0.085, vz - 0.035], [0, 0, -1]], [[vx - 0.025, 0.085, 0.025], [-1, 0, 0]], [[vx - 0.025, 0.070, 0.025], [-1, 0, 0]], [[0.070, 0.130, vz], [0, 1, 0]]]) ft.push(aim(fitting({ d: 0.25 * IN, L: 0.010, mat: 'zincClear' }), VA(p).addScaledVector(VA(d), -0.010), d));
  kids.push(part({ id: 'grip-clamp-fittings', sec: '5.6', item: '3', pn: '202702-6-6', fr: 'Raccords des vérins et de la valve', en: 'Cylinder and valve fittings', qty: '-', page: 21, explode: [0, 0.09, 0.02],
    note: 'Repères 2 (202702-4-6 x2), 3 (202702-6-6 x5), 4 (2062-6-6 x4). Positions simplifiées.' }, ft));
  // aimant 12 V (31), sabots (12), plaque de retenue des boulons (13), retenue en caoutchouc (24), bride usinée (27)
  kids.push(part({ id: 'grip-clamp-magnet', sec: '5.6', item: '31', pn: '281188', fr: 'Aimant 12 V avec connecteur', en: '12 V magnet with connector', qty: '1', page: 21, explode: [0, -0.18, -0.24] },
    [box(0.200, 0.090, 0.080, 'black', [0, -0.110, 0], 0.006), decal({ text: '12 VDC', w: 0.07, h: 0.022, bg: '#1d1e20', fg: '#f2f2f2', p: [0, -0.105, 0.0406] }),
      cyl(0.008, 0.016, 'zincClear', [0.070, -0.057, 0.020], 'y', 18), m(G.hex(0.018, 0.008), 'zincClear', { p: [0.070, -0.062, 0.020] })]));
  [1, -1].forEach((s, k) => {
    const pts = [[0.004, -0.155], [0.052, -0.155], [0.052, -0.168], [0.045, -0.182], [0.030, -0.177], [0.016, -0.171], [0.004, -0.167]];
    const sh = rshape(s > 0 ? pts : pts.map(([z, y]) => [-z, y]).reverse(), 0.0015);
    kids.push(part({ id: `grip-clamp-shoe-${k + 1}`, sec: '5.6', item: '12', pn: '276899', fr: "Sabot de l'aimant", en: 'Magnet shoe', qty: '2', page: 21, explode: [0, -0.28, -0.24 + s * 0.03] },
      [m(G.plate(sh, 0.200, {}), 'machined', { p: [0, 0, 0], r: [0, -90, 0] })]));
  });
  kids.push(part({ id: 'grip-clamp-boltplate', sec: '5.6', item: '13', pn: '276901', fr: 'Plaque de retenue des boulons', en: 'Bolt retaining plate', qty: '1', page: 21, explode: [0, 0.10, -0.02] },
    [box(0.116, 0.008, 0.080, 'zincClear', [0, FR.y1 + 0.004, 0], 0.002)]));
  kids.push(part({ id: 'grip-clamp-retclamp', sec: '5.6', item: '27', pn: '277864', fr: 'Bride de retenue usinée', en: 'Retaining clamp, machined', qty: '1', page: 21, explode: [0, -0.10, 0], approx: true,
    note: "Bloc sous la plaque du cadre : reçoit les boulons épaulés 10 de l'inclinaison (cales 14 de part et d'autre)." },
    [box(0.080, 0.026, 0.244, 'steel', [0, 0.0, 0], 0.003)]));
  kids.push(part({ id: 'grip-clamp-tuberet', sec: '5.6', item: '24', pn: '277706', fr: 'Retenue de tubes en caoutchouc', en: 'Rubber tube retainer', qty: '1', page: 22, spare: true, explode: [0, 0.08, -0.06] },
    [box(0.030, 0.024, 0.024, 'rubber', [-0.045, FR.y1 + 0.012, -0.112], 0.006)]));
  // boulons épaulés 10 de l'inclinaison
  [1, -1].forEach((s, k) => kids.push(part({ id: `grip-clamp-pivotbolt-${k + 1}`, sec: '5.6', item: '10', pn: '256107', fr: "Boulon épaulé 1 po x 2,5 po (inclinaison)", en: 'Shoulder bolt 1 x 2.5 in (tilt)', qty: '2', page: 21, explode: [0, 0, s * 0.16] },
    [grp([lathe([[0, 0], [0.019, 0], [0.019, 0.016], [0.016, 0.017], [0, 0.017]], 'blackOxide', [0, 0, 0], 'y', 28), cyl(0.0127, 0.0635, 'blackOxide', [0, -0.03175, 0], 'y', 24), cyl(0.0095, 0.015, 'blackOxide', [0, -0.071, 0], 'y', 20)],
      { p: [0, 0, s * (LEGZ + LEGT / 2 + 0.0016)], r: [s * 90, 0, 0] })])));
  // gardes 28 (x2), 29, 30
  const gw = 0.003, gy0 = 0.045, gy1 = 0.185;
  const sideWall = (x0, x1, z) => plate(rshape([[x0, gy0], [x1, gy0], [x1, gy1], [x0, gy1]], x0 < 0 ? [0.002, 0.002, 0.03, 0.002] : [0.002, 0.002, 0.002, 0.03]), gw, 'red', [0, 0, z], 'xy');
  kids.push(part({ id: 'grip-clamp-guard3', sec: '5.6', item: '30', pn: '278150', fr: 'Garde no 3 (vérin no 1)', en: 'Guard #3 weldment', qty: '1', page: 21, explode: [-0.16, 0.16, 0], approx: true },
    [sideWall(-0.238, -0.120, 0.0655), sideWall(-0.238, -0.120, -0.0655), m(G.plate(rshape([[-0.0670, gy0], [0.0670, gy0], [0.0670, gy1], [-0.0670, gy1]], 0.003), gw, { holes: [{ c: [0.03, 0.12], r: 0.014 }] }), 'red', { p: [-0.2395, 0, 0], r: [0, -90, 0] }),
      ...[-0.05, 0.05].map(z => box(0.012, 0.016, 0.006, 'red', [-0.232, FR.y1 + 0.008, z], 0.001))]));
  kids.push(part({ id: 'grip-clamp-guard1-1', sec: '5.6', item: '28', pn: '277869', fr: 'Garde no 1 (vérin no 2)', en: 'Guard #1 weldment', qty: '2', page: 21, explode: [0.14, 0.16, 0], approx: true },
    [sideWall(0.120, 0.232, 0.0655), sideWall(0.120, 0.232, -0.0655), box(0.016, gw, 0.134, 'red', [0.224, gy1 - gw / 2, 0], 0.001), ...[-0.0655, 0.0655].map(z => box(0.012, 0.016, 0.004, 'red', [0.15, FR.y1 + 0.008, z], 0.001))]));
  kids.push(part({ id: 'grip-clamp-guard2', sec: '5.6', item: '29', pn: '277883', fr: 'Garde no 2 (bout droit)', en: 'Guard #2 weldment', qty: '1', page: 21, explode: [0.28, 0.12, 0], approx: true },
    [m(G.plate(rshape([[-0.067, gy0], [0.067, gy0], [0.067, gy1], [-0.067, gy1]], [0.002, 0.002, 0.02, 0.02]), gw, {}), 'red', { p: [0.2435, 0, 0], r: [0, -90, 0] }), box(0.016, gw, 0.080, 'red', [0.236, FR.y1 + gw / 2, 0], 0.001), box(0.003, 0.016, 0.080, 'red', [0.2435, FR.y1 + 0.008, 0], 0.001)]));
  kids.push(part({ id: 'grip-clamp-guard1-2', sec: '5.6', item: '28', pn: '277869', fr: 'Garde no 1 (centre, sur la valve)', en: 'Guard #1 weldment (centre)', qty: '2', page: 21, explode: [0.03, 0.24, 0.10], approx: true },
    [box(0.066, gw, 0.100, 'red', [vx, 0.162, vz], 0.001), box(0.066, 0.1335, gw, 'red', [vx, FR.y1 + 0.0665, vz + 0.0485], 0.001), box(0.066, gw, 0.012, 'red', [vx, FR.y1 + gw / 2, vz + 0.0485 - 0.006], 0.001)]));
  // visserie du bloc de serrage
  const hw = [];
  for (const s of [-1, 1]) { hw.push(aim(washer({ d: 1 * IN, od: 0.040, t: 0.0016, mat: 'bronze' }), V(0, 0, s * (LEGZ + LEGT / 2)), V(0, 0, s))); hw.push(aim(washer({ d: 1 * IN, od: 0.040, t: 0.0016, mat: 'bronze' }), V(0, 0, s * FR.hz), V(0, 0, s))); }
  for (const e of [-1, 1]) for (const y of [0.075, 0.145]) { hw.push(boltAt([e * CYX, y, -0.035], [0, 0, -1], { d: 0.375 * IN, L: 3.25 * IN, washer: true })); hw.push(nutAt([e * CYX, y, 0.035], [0, 0, 1], { d: 0.375 * IN })); }
  for (const e of [-1, 1]) for (const x of [-0.045, 0.045]) for (const z of [-0.088, 0.088]) if (!(e > 0 && x > 0 && z < 0)) hw.push(boltAt([e * CYX + x, FR.y1, z], [0, 1, 0], { d: 0.375 * IN, L: 1 * IN, washer: true }));
  for (const x of [-0.048, 0.048]) for (const z of [-0.03, 0.03]) {
    hw.push(cyl(0.0064, 0.112, 'zinc', [x, -0.019, z], 'y', 14));
    hw.push(ring(0.0095, 0.0064, 0.0032, 'rubber', [x, FR.y1 + 0.008 + 0.0016, z], 'y', 16), ring(0.0095, 0.0064, 0.0032, 'rubber', [x, -0.065 + 0.0016, z], 'y', 16));
  }
  for (const x of [-0.035, 0.035]) hw.push(boltAt([x, FR.y1 + 0.008, 0.0], [0, 1, 0], { d: 0.375 * IN, L: 0.625 * IN, washer: true }));
  for (const z of [-0.10, 0.10]) hw.push(boltAt([0, FR.y1, z], [0, 1, 0], { d: 0.3125 * IN, L: 2.5 * IN, head: 'shcs', mat: 'blackOxide' }));
  for (const x of [-0.07, 0.07]) for (const z of [0.047, -0.047]) hw.push(boltAt([x, -0.1805, z], [0, -1, 0], { d: 0.375 * IN, L: 0.75 * IN, head: 'bhcs', mat: 'blackOxide' }));
  hw.push(boltAt([bx - 0.015, FR.y1 + 0.012, bz - 0.020], [0, 1, 0], { d: 0.375 * IN, L: 1.125 * IN, washer: true }), boltAt([bx + 0.015, FR.y1 + 0.012, bz + 0.020], [0, 1, 0], { d: 0.375 * IN, L: 1.625 * IN, washer: true }));
  for (const [x, z] of [[vx - 0.020, vz - 0.034], [vx + 0.020, vz + 0.034]]) hw.push(boltAt([x, FR.y1 + 0.008, z], [0, 1, 0], { d: 0.3125 * IN, L: 0.75 * IN, washer: true }));
  hw.push(boltAt([0.236, FR.y1 + gw, 0.03], [0, 1, 0], { d: 0.375 * IN, L: 1 * IN, washer: true }), boltAt([0.236, FR.y1 + gw, -0.03], [0, 1, 0], { d: 0.375 * IN, L: 1 * IN, washer: true }));
  kids.push(part({ id: 'grip-clamp-hw', sec: '5.6', item: '37', pn: 'B142', fr: 'Visserie du bloc de serrage', en: 'Clamp hardware', qty: '-', page: 23, explode: [0, 0.05, 0], approx: true,
    note: 'Repères 1 (120831 x4), 5, 6 (224166 x29), 7, 9 (250778 x4), 11, 14 (276962 x12, cales), 34 à 40, 41 (281325 x4, boulons modifiés), 42 (C079 x2), 43 (N017 x4), 44, 45, 46 (281061 x8), 47 (281327 x4). Positions des petites vis simplifiées.' }, hw));
  return asm({ id: 'grip-clamp', sec: '5.6', item: '17', pn: '277553', fr: 'Bloc de serrage', en: 'Grapple clamp', qty: '1', page: 21, explode: [0, -0.96, 0] }, kids, CF);
}

/* 29 : adaptateur coudé ORFS / ORB sur la valve (repère C). */
function buildAdapter29() {
  const g = grp([m(G.hex(0.019, 0.010), 'zincClear', { p: [0.005, 0, 0], r: [0, 0, -90] }), m(G.torus(0.012, 0.0055, Math.PI / 2, 8, 12), 'zincClear', { p: [0.010, 0.012, 0], r: [0, 0, -90] }),
    m(G.hex(0.019, 0.010), 'zincClear', { p: [0.022, 0.017, 0] })], { p: [0.115, 0.118, 0.062] });
  return part({ id: 'grip-adapter29', sec: '5', item: '29', pn: 'FF1868T-0606S', fr: 'Adaptateur coudé no 6 ORFS / ORB', en: 'Adapter, #6 ORFS to #6 ORB, 90 deg', qty: '1', page: 10, explode: [0.10, -0.76, -0.12], approx: true,
    note: 'Près de la valve du bloc de serrage (vue de côté p. 10).' }, [g], CF);
}

/* Visserie de la plaque de poignet (repères 1, 2, 20 à 24) et passe-fil 9. */
function buildWristHardware() {
  const hw = [], xi = FLX + FT;
  FLB.forEach((y, r) => [-0.12, 0.12].forEach((z, c) => {
    const long = (r === 3 && c === 1);
    hw.push(aim(washer({ d: 0.5 * IN, mat: 'zincClear', od: r === 0 ? 0.032 : 0.025, t: 0.0025 }), V(xi, y, z), V(1, 0, 0)));
    hw.push(boltAt([xi + 0.0025, y, z], [1, 0, 0], { d: 0.5 * IN, L: (long ? 1.75 : 1.5) * IN }));
    if (r < 3) hw.push(nutAt([FLX, y, z], [-1, 0, 0], { d: 0.5 * IN }));
  }));
  hw.push(boltAt([FLX + FT, 0.252, 0.0], [1, 0, 0], { d: 0.5 * IN, L: 1.25 * IN, washer: true }));
  for (const z of [-0.035, 0.035]) hw.push(nutAt([FLX + FT, FYT - 0.012, z], [1, 0, 0], { d: 0.19 * IN }));
  return part({ id: 'grip-hw-wrist', sec: '5', item: '21', pn: 'B269', fr: 'Visserie de la plaque de poignet', en: 'Wrist mount hardware', qty: '-', page: 10, explode: [-0.26, 0.40, 0], approx: true,
    note: "Repères 1 (117753), 2 (228318 x4), 20 (B267), 21 (B269 x8), 22 (B271), 23 (N019 x6, sur la face côté flèche, hors de la patte 278122), 24 (N029 x2)." }, hw);
}
function buildGrommet() {
  const prof = [[0.029, -0.0105], [0.040, -0.0105], [0.040, -0.0075], [0.0345, -0.0067], [0.0345, 0.0067], [0.040, 0.0075], [0.040, 0.0105], [0.029, 0.0105], [0.029, -0.0105]];
  return part({ id: 'grip-grommet', sec: '5', item: '9', pn: '276803', fr: 'Passe-fil 2,5 po en caoutchouc', en: 'Grommet, 2.5 x 3/8 in rubber', qty: '1', page: 11, explode: [-0.12, 0.40, -0.14] },
    [lathe(prof, 'rubber', [GP.hole[0], GP.hole[1], -GZ], 'z', 40)]);
}
function buildEncoderHardware() {
  // repères 25 (N058), 26 (B042), 27 (W001 x2) : fixation du support de boyaux 10
  const hw = [boltAt([-0.084, BASE.y1 + 0.005, 0], [0, 1, 0], { d: 0.25 * IN, L: 0.75 * IN, washer: true }), nutAt([-0.084, BASE.y0, 0], [0, -1, 0], { d: 0.25 * IN, washer: true, lock: true })];
  return part({ id: 'grip-hw-hosesup', sec: '5', item: '26', pn: 'B042', fr: 'Vis du support de boyaux', en: 'Hose support screw', qty: '-', page: 10, explode: [-0.14, 0.08, 0], approx: true,
    note: 'Repères 25 (N058), 26 (B042) et 27 (W001 x2).' }, hw);
}

/* ================================================================== */
export function build() {
  const kids = [
    buildWristMount(), buildGrommet(), buildWristHardware(),
    buildWristActuator(), buildEncoderMount(), buildWristEncoder(), buildMagnet(),
    buildStraddle(), buildHoseSupport(), buildEncoderHardware(),
    buildRotateActuator(), buildRotateEncoder(),
    buildTiltArm(), buildTiltCylinder(), ...buildTiltPin(), buildTiltEncoder(), buildAdapter29(),
    buildClamp(),
  ];
  return asm({ id: 'gripper', sec: '5', item: '5', pn: '277179', fr: 'Pince V2.0', en: 'Gripper V2.0', qty: '1', page: 10, explode: [0, 0, 0],
    note: "Pince pendante sous le bout de flèche (pose de la p. 79 du manuel opérateur). Face de bride à L.gripper.mountAt." }, kids, { p: WRIST });
}
