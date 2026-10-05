/* RodBot LP, vue éclatée : 11. 276676 FRAME ASSY (châssis complet).
 * Manuel de pièces PM10654 : p. 58 (vues éclatée et assemblée), p. 59 (vue de dessus, coupe A-A, détail B),
 * p. 60 (nomenclature), p. 61 (11.1 chariot), p. 62 (11.2 valve d'équilibrage), p. 63 (11.3 stabilisateur),
 * p. 64 (11.4 arrêt d'urgence), p. 65 (11.5 phare encastré).
 * Cotes relevées : vue de dessus p. 59 (2,64 mm/px à 220 ppp), coupe A-A p. 59 (2,09 mm/px),
 * vue de côté p. 79 du manuel opérateur (3,244 mm/px), vue d'ensemble p. 7 du manuel opérateur.
 * Bout +X : côté bac, compartiment de rangement, arrêt d'urgence au coin +Z.
 * Bout -X : côté socle (plaque de montage du piédestal), rampe de garde entre le socle et le bac.
 */
import { THREE, G, m, grp, aim, bolt, nut, washer, fitting, elbow, greaseNipple, rubberTrack, weld, asm, part, seg, IN, DEG } from '../kit.js';
import { L } from '../layout.js';

/* ------------------------------------------------------------------ */
/* Cotes                                                               */
/* ------------------------------------------------------------------ */
const Y0 = L.frame.deckY;           // 0,658 : dessus du châssis (le bac et le socle s'y posent)
const B = 0.0012;                   // débord du biseau de G.plate (tôles de 8 mm et plus)
const ZW = L.frame.halfWidth;       // 0,70 : face extérieure des flancs
const ZN = 0.276;                   // demi-largeur du col aux deux bouts (vue de dessus p. 59)
const CH = [-0.131, 0.783];         // creux transversaux où se logent les fourreaux du bac (p. 59, p. 79)
const CF = 0.5955;                  // dessous des creux
const FP = 0.457;                   // fourreaux de fourche du châssis, 36 po d'entraxe (manuel opérateur p. 79)
const FPY = 0.59;                   // hauteur de leur axe (p. 79)
const YB = 0.366;                   // dessous des longerons intérieurs (coupe A-A)
const YS = 0.49;                    // bas des flancs, au-dessus des crampons de chenille
const ZI = [0.284, 0.416];          // âmes des longerons intérieurs (axe des tôles)
const XI = { p: 1.165, n: -1.145 }; // faces intérieures des poutres d'extrémité
const XC = { p: [0.906, 1.048], n: [-0.615, -0.758] }; // pans coupés du plateau (à |z| = 0,70 puis 0,276)
const EB = { D: 0.22, y0: 0.29, ch: 0.08, zs: 0.595, ts: 0.0127 }; // poutres d'extrémité (compartiments)
const TR = { R: L.track.height / 2, XS: 0.8965, Z: L.track.gaugeHalf }; // chenilles
const ST = { x: L.stabilizer.x, z: L.stabilizer.z };
const ES = [1.095, 0.520, 0.4305];  // origine de l'arrêt d'urgence (bas de la patte, face avant du dos)
const ZPL = { web: 0.50, tab: 0.493, x0: -1.140, x1: -0.808 }; // plaques pliées 18 et 19 (vue de dessus p. 59)

/* ------------------------------------------------------------------ */
/* Outils locaux                                                       */
/* ------------------------------------------------------------------ */
const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const pXY = (pts, t, z, mk = 'red', holes = []) => m(G.plate(pts, t, { holes }), mk, { p: [0, 0, z] });
const pYZ = (pts, t, x, mk = 'red', holes = []) => m(G.plate(pts, t, { holes }), mk, { p: [x, 0, 0], r: [0, -90, 0] }); // pts [z, y]
const pXZ = (pts, t, y, mk = 'red', holes = []) => m(G.plate(pts, t, { holes }), mk, { p: [0, y, 0], r: [90, 0, 0] });  // pts [x, z]
const zAx = (geo, mk, p, extra = {}) => m(geo, mk, { p, r: [90, 0, 0], ...extra }); // axe Y de la géométrie vers +Z
const xAx = (geo, mk, p) => m(geo, mk, { p, r: [0, 0, -90] });                          // axe Y vers +X

/** Plaque verticale entre deux points (x, z) du plan. */
function wallBetween(a, b, y0, y1, t, mk = 'red') {
  const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz);
  return m(G.box(len, y1 - y0, t, 0.002), mk, { p: [(a[0] + b[0]) / 2, (y0 + y1) / 2, (a[1] + b[1]) / 2], r: [0, Math.atan2(-dz, dx) / DEG, 0] });
}
/** Oriente obj : axe X local vers X, axe Y local vers Yv (Z = X x Y). */
function orient(obj, X, Yv, p) {
  const x = new THREE.Vector3(...X).normalize(), y = new THREE.Vector3(...Yv).normalize(), z = new THREE.Vector3().crossVectors(x, y);
  obj.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  if (p) obj.position.set(...p);
  return obj;
}
/** Boulon complet. Repère : y = 0 sur la face d'appui côté tête, tête vers +Y ; face d'appui côté écrou à y = -grip. */
function fastener({ d, len, grip, head = 'hex', hw = true, nw = false, nk = null, mk = 'zinc', wt = null, wod = null }) {
  const tw = wt ?? 0.12 * d, g = [];
  if (hw) g.push(washer({ d, t: tw, od: wod, mat: mk }));
  g.push(grp([bolt({ d, L: len, head, mat: mk })], { p: [0, hw ? tw : 0, 0] }));
  let y = -grip;
  if (nw) { g.push(grp([washer({ d, t: tw, od: wod, mat: mk })], { p: [0, y - tw, 0] })); y -= tw; }
  if (nk) g.push(grp([nut({ d, lock: nk === 'lock', mat: mk })], { p: [0, y, 0], r: [180, 0, 0] }));
  return grp(g);
}
const place = (o, p, dir) => aim(grp([o]), p, dir);
/** Chemin à coins arrondis (lignes + raccords quadratiques). */
function roundedPath(pts, R) {
  const path = new THREE.CurvePath(); let prev = pts[0];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1], b = pts[i], c = pts[i + 1];
    const p1 = b.clone().addScaledVector(b.clone().sub(a).normalize(), -R), p2 = b.clone().addScaledVector(c.clone().sub(b).normalize(), R);
    path.add(new THREE.LineCurve3(prev, p1)); path.add(new THREE.QuadraticBezierCurve3(p1, b.clone(), p2)); prev = p2;
  }
  path.add(new THREE.LineCurve3(prev, pts[pts.length - 1]));
  return path;
}
/** Contour denté (barbotin), plan XY. */
function gear(n, ro, rr, rh) {
  const s = new THREE.Shape();
  for (let i = 0; i < n; i++) {
    const a = i * 2 * Math.PI / n, w = Math.PI / n;
    [[rr, a - w * 0.62], [ro, a - w * 0.3], [ro, a + w * 0.3], [rr, a + w * 0.62]].forEach(([r, t], k) => {
      const x = r * Math.cos(t), y = r * Math.sin(t); (i === 0 && k === 0) ? s.moveTo(x, y) : s.lineTo(x, y);
    });
  }
  s.closePath();
  if (rh) { const h = new THREE.Path(); h.absarc(0, 0, rh, 0, Math.PI * 2, true); s.holes.push(h); }
  return s;
}
/** Cordon de soudure fermé autour d'un rectangle (plan XY, à z). */
function weldRect(cx, cy, hw, hh, z, r = 0.0026) {
  const c = 0.006, pts = [[cx - hw + c, cy - hh], [cx + hw - c, cy - hh], [cx + hw, cy - hh + c], [cx + hw, cy + hh - c], [cx + hw - c, cy + hh], [cx - hw + c, cy + hh], [cx - hw, cy + hh - c], [cx - hw, cy - hh + c], [cx - hw + c, cy - hh]];
  return weld(pts.map(([x, y]) => [x, y, z]), r);
}

/* ------------------------------------------------------------------ */
/* 7. Châssis soudé 276685                                             */
/* ------------------------------------------------------------------ */
/** Poutre d'extrémité (compartiment de rangement). Repère local : u = 0 face intérieure, u = D face extérieure. */
function endBeam(stabU, lugTip, topHoles = []) {
  const { D, y0, ch, zs, ts } = EB, yc = Y0 - ch, zi = zs - ts, g = [];
  // flasques latérales : appui des brides des stabilisateurs (8 trous taraudés)
  const sh = []; for (const du of [-0.08, 0.08]) for (const y of [0.31, 0.386, 0.464, 0.542]) sh.push({ c: [stabU + du, y], r: 0.0066 });
  const prof = [[0.0026, y0 + B], [D - B, y0 + B], [D - B, yc], [D - ch, Y0 - B], [0.0026, Y0 - B]];
  for (const s of [-1, 1]) g.push(pXY(prof, ts, s * (zs - ts / 2), 'red', sh));
  // tôle intérieure, dessus, fond
  g.push(pYZ(rect(-zi + B, y0 + 0.008 + B, zi - B, Y0 - 0.008 - B), 0.008, 0.004));
  g.push(pXZ(rect(0.0026, -zi + B, D - ch - 0.002, zi - B), 0.008, Y0 - 0.004, 'red', topHoles));
  g.push(pXZ(rect(0.0026, -zi + B, D - B, zi - B), 0.008, y0 + 0.004));
  // face extérieure : porte du compartiment, trous des feux de position
  const door = { rect: [0, 0.4375, 0.386, 0.201, 0.01] };
  g.push(pYZ(rect(-zi + B, y0 + 0.008 + B, zi - B, yc - 0.001), 0.008, D - 0.004, 'red', [door, { c: [-0.40, 0.455], r: 0.0335 }, { c: [0.40, 0.455], r: 0.0335 }]));
  // pan coupé à 45° : découpes des phares encastrés et trous de leurs vis
  const lc = ch * Math.SQRT2, sc = lc / 2, cut = [];
  for (const z of [-0.40, 0.40]) cut.push({ rect: [z, sc, 0.172, 0.046, 0.02] }, { c: [z - 0.088, sc], r: 0.003 }, { c: [z + 0.088, sc], r: 0.003 });
  const k = 0.004 * Math.SQRT1_2;
  g.push(grp([m(G.plate(rect(-zi + B, 0.004, zi - B, lc - 0.002), 0.008, { holes: cut }), 'red', { r: [0, -90, 0] })], { p: [D - ch - k, Y0 - k, 0], r: [0, 0, -135] }));
  // porte (affleurante, jeu de 2 à 3 mm) et charnières
  g.push(pYZ(G.rrect(0.376, 0.191, 0.008, 0, 0.4375), 0.005, D - 0.002, 'red'));
  for (const y of [0.372, 0.503]) {
    g.push(m(G.cyl(0.0055, 0.032, 16), 'zinc', { p: [D + 0.004, y, -0.2] }));
    g.push(m(G.box(0.004, 0.026, 0.016, 0.001), 'zinc', { p: [D + 0.002, y, -0.19] }));
  }
  // pattes de levage (2), soudées sur la face et le pan coupé
  const cx = lugTip - 0.044, cy = 0.509, R = 0.044;
  const lug = [[D - 0.006, 0.375]];
  for (let a = -80; a <= 80; a += 10) lug.push([cx + R * Math.cos(a * DEG), cy + R * Math.sin(a * DEG)]);
  lug.push([D - ch + 0.01, 0.640], [D - 0.006, yc + 0.001]);
  for (const z of [-0.233, 0.233]) {
    g.push(pXY(lug, 0.025, z, 'red', [{ c: [cx, cy], r: 0.0165 }]));
    for (const dz of [-0.0145, 0.0145]) g.push(weld([[D + 0.001, 0.38, z + dz], [D + 0.001, yc - 0.004, z + dz]], 0.0028));
  }
  return g;
}

function weldment() {
  const g = [], t = 0.008, zw = ZW - B;
  /* Plateau : trois panneaux au niveau Y0, séparés par deux creux. */
  const holesA = [{ rect: [-0.931, 0, 0.243, 0.306, 0.035] }, { rect: [-0.634, 0, 0.16, 0.25, 0.03] }];
  for (const x of [-1.11, -1.0, -0.89, -0.785]) for (const z of [-0.228, 0.228]) holesA.push({ c: [x, z], r: 0.009 });
  for (const x of [-1.11, -0.785]) for (const z of [-0.076, 0.076]) holesA.push({ c: [x, z], r: 0.009 });
  for (const s of [-1, 1]) for (const dz of [-0.03, 0.03]) holesA.push({ c: [XR, s * ZP + dz], r: 0.0056 });
  for (const z of [-0.159, 0.159]) holesA.push({ c: [-0.7575, z], r: 0.0087 }); // boulons de semelle du socle (pedestal.js)
  g.push(pXZ([[XI.n + 0.0026, -ZN], [XC.n[1], -ZN], [XC.n[0], -zw], [CH[0] - 0.119, -zw], [CH[0] - 0.119, zw], [XC.n[0], zw], [XC.n[1], ZN], [XI.n + 0.0026, ZN]], t, Y0 - t / 2, 'red', holesA));
  g.push(pXZ(rect(CH[0] + 0.119, -zw, CH[1] - 0.119, zw), t, Y0 - t / 2, 'red', [
    { rect: [0.16, -0.462, 0.30, 0.30, 0.045] }, { rect: [0.16, 0, 0.30, 0.33, 0.045] }, { rect: [0.16, 0.462, 0.30, 0.30, 0.045] }]));
  g.push(pXZ([[CH[1] + 0.119, -zw], [XC.p[0], -zw], [XC.p[1], -ZN], [XI.p - 0.0026, -ZN], [XI.p - 0.0026, ZN], [XC.p[1], ZN], [XC.p[0], zw], [CH[1] + 0.119, zw]], t, Y0 - t / 2, 'red',
    [{ rect: [1.01, 0, 0.16, 0.30, 0.035] }]));
  /* Creux en U (tôle pliée), sur toute la largeur. */
  for (const xc of CH) {
    const o = 0.1138, i = 0.1082;
    g.push(m(G.plate([[xc - o, Y0 - B], [xc - o, CF + B], [xc + o, CF + B], [xc + o, Y0 - B], [xc + i, Y0 - B], [xc + i, CF + t - B], [xc - i, CF + t - B], [xc - i, Y0 - B]], 2 * ZW), 'red'));
  }
  /* Flancs : fourreaux de fourche traversants et encoches des creux. */
  const fph = [{ rect: [-FP, FPY, 0.2145, 0.0845, 0.009] }, { rect: [FP, FPY, 0.2145, 0.0845, 0.009] }];
  const yt = Y0 - t - B, nb = CF - B - 0.0005;
  const notch = (x0, x1) => [[x0, yt], [x0, nb], [x1, nb], [x1, yt]];
  const sw = [[XC.n[0], YS + B], [XC.p[0], YS + B], [XC.p[0], yt], [CH[1] + 0.117, yt], ...notch(CH[1] + 0.117, CH[1] - 0.117).slice(1, 3), [CH[1] - 0.117, yt], [CH[0] + 0.117, yt], ...notch(CH[0] + 0.117, CH[0] - 0.117).slice(1, 3), [CH[0] - 0.117, yt], [XC.n[0], yt]];
  for (const s of [-1, 1]) {
    g.push(pXY(sw, t, s * (ZW - t / 2), 'red', fph));
    for (const x of [-FP, FP]) g.push(weldRect(x, FPY, 0.1065, 0.0415, s * (ZW + 0.0012)));
  }
  /* Pans coupés (4). */
  const xAt = (xs, z) => xs[0] + (xs[1] - xs[0]) * (ZW - z) / (ZW - ZN);
  for (const s of [-1, 1]) {
    g.push(wallBetween([XC.n[0], s * (ZW - 0.006)], [xAt(XC.n, 0.424), s * 0.424], YS, Y0 - t, t));
    g.push(wallBetween([XC.p[0], s * (ZW - 0.006)], [xAt(XC.p, 0.424), s * 0.424], YS, Y0 - t, t));
  }
  /* Fourreaux de fourche (tubes 8 x 3 po, intérieur 7,5 x 2,5 po). */
  for (const x of [-FP, FP]) g.push(m(G.rectTube(0.21, 0.08, 2 * ZW + 0.006, 0.0064, 0.008), 'red', { p: [x, FPY, 0], r: [90, 0, 0] }));
  /* Longerons intérieurs (2 caissons) : trous d'allègement, lumières, appuis du chariot. */
  const x0 = XI.n + 0.0026, x1 = XI.p - 0.0026;
  const ib = [[x0, YB + 0.008 + B], [x1, YB + 0.008 + B], [x1, yt], [CH[1] + 0.117, yt], [CH[1] + 0.117, nb], [CH[1] - 0.117, nb], [CH[1] - 0.117, yt], [CH[0] + 0.117, yt], [CH[0] + 0.117, nb], [CH[0] - 0.117, nb], [CH[0] - 0.117, yt], [x0, yt]];
  const ibh = [...fph];
  for (const x of [-1.03, -0.853, 0.662, 1.018]) ibh.push({ c: [x, 0.515], r: 0.0525 });
  for (const x of [-0.74, -0.175, 0.165, 0.795]) ibh.push({ rect: [x, 0.49, 0.009, 0.17, 0.004] });
  for (const s of [-1, 1]) {
    for (const z of ZI) g.push(pXY(ib, t, s * z, 'red', ibh));
    const bh = []; for (const x of [-FP, FP]) for (const dx of [-0.05, 0.05]) for (const dz of [-0.035, 0.035]) bh.push({ c: [x + dx, s * 0.35 + dz], r: 0.0105 });
    g.push(pXZ(rect(x0, s * 0.2765, x1, s * 0.4235), t, YB + 0.004, 'red', bh));
    for (const z of [ZI[0] - 0.005, ZI[1] + 0.005]) g.push(weld([[x0 + 0.01, YB + 0.0088, s * z], [x1 - 0.01, YB + 0.0088, s * z]], 0.0024));
    // couvercles des caissons dans les cols (en retrait de 8 mm sous le plateau)
    g.push(pXZ([[xAt(XC.p, 0.4115) - 0.012, s * 0.4115], [x1, s * 0.4115], [x1, s * 0.2885], [xAt(XC.p, 0.2885) - 0.012, s * 0.2885]], t, Y0 - 0.012));
    g.push(pXZ([[ZPL.x1 + 0.004, s * 0.4115], [xAt(XC.n, 0.4115) + 0.012, s * 0.4115], [xAt(XC.n, 0.2885) + 0.012, s * 0.2885], [ZPL.x1 + 0.004, s * 0.2885]], t, Y0 - 0.012));
  }
  /* Poutres d'extrémité : +X (côté bac) et -X (côté socle, tournée de 180°). */
  g.push(grp(endBeam(ST.x[1] - XI.p, L.frame.lugTipX[1] - XI.p), { p: [XI.p, 0, 0] }));
  // trous des boulons de semelle du socle (pedestal.js) qui tombent sur le dessus de la poutre -X
  g.push(grp(endBeam(XI.n - ST.x[0], XI.n - L.frame.lugTipX[0], [-0.4775, 0.4775].map(z => ({ c: [XI.n + 1.174, z], r: 0.0087 }))), { p: [XI.n, 0, 0], r: [0, 180, 0] }));
  /* Patte de l'arrêt d'urgence (coin +X +Z), soudée sur le caisson +Z. */
  g.push(pXZ(rect(ES[0] - 0.06, 0.4215, ES[0] + 0.06, 0.53), t, ES[1] - 0.004, 'red', [{ c: [ES[0] - 0.045, ES[2] + 0.045], r: 0.0052 }, { c: [ES[0] + 0.045, ES[2] + 0.045], r: 0.0052 }]));
  g.push(weld([[ES[0] - 0.058, ES[1] - 0.0085, 0.4225], [ES[0] + 0.058, ES[1] - 0.0085, 0.4225]], 0.0024));
  /* Pattes taraudées des plaques pliées 18 et 19 (côté socle) : sur la poutre -X et sur une équerre du caisson. */
  for (const s of [-1, 1]) {
    g.push(pXY(rect(x0, 0.52, -1.10, 0.62), t, s * ZPL.tab));
    g.push(pXY(rect(-0.845, 0.52, -0.808, 0.62), t, s * ZPL.tab));
    g.push(m(G.box(t, 0.10, ZPL.tab - 0.004 - ZI[1] - 0.004, 0.002), 'red', { p: [-0.8265, 0.57, s * (ZI[1] + 0.004 + (ZPL.tab - 0.004 - ZI[1] - 0.004) / 2)] }));
  }
  return part({ id: 'frame-weldment', sec: '11', item: '7', pn: '276685', fr: 'Châssis soudé', en: 'Frame weldment', qty: '1', page: 58, explode: [0, 0, 0],
    note: "Plateau du bac et plaque du socle au même niveau. Deux fourreaux de fourche 7,5 x 2,5 po à 36 po d'entraxe (manuel opérateur p. 79). Compartiment de rangement avec porte à chaque bout (manuel opérateur p. 7). Portes et charnières dessinées avec le châssis (pas de repère au manuel). Caissons intérieurs estimés d'après la coupe A-A p. 59." }, g);
}

/* ------------------------------------------------------------------ */
/* 11.1 Chariot 276973                                                 */
/* ------------------------------------------------------------------ */
// Repère local d'un train : axe de la chenille en z = 0, côté intérieur (vers le centre de la machine) en +z,
// moteur de translation en +x. Le train +Z est tourné de 180° : son moteur est côté -X (comme p. 58 et p. 79).
function motorGeo() {
  const g = [], c = [TR.XS, TR.R];
  g.push(m(G.plate(gear(14, 0.172, 0.150, 0.088), 0.045), 'steel', { p: [c[0], c[1], 0] }));          // barbotin
  g.push(zAx(G.cyl(0.09, 0.046, 32), 'blackCast', [c[0], c[1], 0]));
  g.push(zAx(G.cyl(0.112, 0.0925, 40), 'blackCast', [c[0], c[1], -0.06875]));                          // carter tournant (extérieur)
  g.push(zAx(G.disc(0.086, 0.012, 40), 'blackCast', [c[0], c[1], -0.121]));
  g.push(zAx(G.cyl(0.012, 0.006, 16), 'steel', [c[0] + 0.035, c[1] + 0.02, -0.13]));
  for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; g.push(place(bolt({ d: 0.5 * IN, L: 0.02, mat: 'zinc' }), [c[0] + 0.131 * Math.cos(a), c[1] + 0.131 * Math.sin(a), -0.0225], [0, 0, -1])); }
  for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + 0.3; g.push(place(bolt({ d: 0.375 * IN, L: 0.015, mat: 'zinc' }), [c[0] + 0.07 * Math.cos(a), c[1] + 0.07 * Math.sin(a), -0.127], [0, 0, -1])); }
  g.push(zAx(G.cyl(0.105, 0.1475, 40), 'blackCast', [c[0], c[1], 0.09625]));                          // partie fixe (orifices)
  g.push(zAx(G.disc(0.125, 0.012, 40), 'blackCast', [c[0], c[1], 0.094]));
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + 0.39; g.push(place(bolt({ d: 0.5 * IN, L: 0.03, mat: 'zinc' }), [c[0] + 0.117 * Math.cos(a), c[1] + 0.117 * Math.sin(a), 0.112], [0, 0, 1])); }
  return g;
}
function idlerGeo() {
  const g = [], c = [-TR.XS, TR.R];
  const prof = [[0.03, -0.085], [0.165, -0.085], [0.172, -0.078], [0.172, -0.03], [0.158, -0.02], [0.158, 0.02], [0.172, 0.03], [0.172, 0.078], [0.165, 0.085], [0.03, 0.085]];
  g.push(zAx(G.lathe(prof, 48), 'steel', [c[0], c[1], 0]));
  g.push(zAx(G.cyl(0.02, 0.212, 20), 'steel', [c[0], c[1], 0]));
  const yoke = G.rrect(0.23, 0.08, 0.035, -0.815, TR.R);
  for (const z of [-0.096, 0.096]) {
    g.push(pXY(yoke, 0.008, z, 'black', [{ c: [c[0], c[1]], r: 0.0205 }]));
    g.push(zAx(G.disc(0.045, 0.007, 32), 'black', [c[0], c[1], z + Math.sign(z) * 0.0075]));
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.78; g.push(place(bolt({ d: 0.3125 * IN, L: 0.012, mat: 'zinc' }), [c[0] + 0.03 * Math.cos(a), c[1] + 0.03 * Math.sin(a), z + Math.sign(z) * 0.011], [0, 0, Math.sign(z)])); }
  }
  // tendeur : vérin à graisse dans le longeron, valve de graissage sur la face extérieure
  g.push(m(G.box(0.06, 0.05, 0.012, 0.003), 'black', { p: [-0.66, 0.30, -0.106] }));
  g.push(place(greaseNipple('zinc'), [-0.66, 0.30, -0.112], [0, 0, -1]));
  for (const dx of [-0.022, 0.022]) g.push(place(bolt({ d: 0.25 * IN, L: 0.012, mat: 'zinc' }), [-0.66 + dx, 0.315, -0.112], [0, 0, -1]));
  return g;
}
function rollerGeo() {
  const g = [], prof = [[0.012, -0.085], [0.046, -0.085], [0.05, -0.081], [0.05, -0.05], [0.045, -0.044], [0.045, 0.044], [0.05, 0.05], [0.05, 0.081], [0.046, 0.085], [0.012, 0.085]];
  for (let i = 0; i < 6; i++) {
    const x = -0.572 + i * 0.2344, y = 0.111;
    g.push(zAx(G.lathe(prof, 32), 'steel', [x, y, 0]));
    for (const z of [-0.093, 0.093]) {
      g.push(m(G.box(0.032, 0.062, 0.012, 0.003), 'black', { p: [x, 0.136, z] }));
      g.push(zAx(G.cyl(0.011, 0.006, 6), 'steel', [x, y, z + Math.sign(z) * 0.009]));
    }
  }
  return g;
}
function trackFrameGeo() {
  const g = [];
  g.push(m(G.box(1.44, 0.235, 0.20, 0.006), 'black', { p: [0, 0.2825, 0] }));
  g.push(m(G.box(1.32, 0.19, 0.004, 0.002), 'black', { p: [0, 0.28, -0.1015] }));            // couvercle extérieur
  for (let i = 0; i < 9; i++) for (const y of [0.198, 0.362]) g.push(place(bolt({ d: 0.375 * IN, L: 0.012, mat: 'zinc' }), [-0.62 + i * 0.155, y, -0.1035], [0, 0, -1]));
  // support du moteur (côté intérieur) : contour arrondi autour du moteur
  const sh = new THREE.Shape(); sh.moveTo(0.65, TR.R - 0.13); sh.lineTo(TR.XS, TR.R - 0.13); sh.absarc(TR.XS, TR.R, 0.13, -Math.PI / 2, Math.PI / 2, false); sh.lineTo(0.65, TR.R + 0.13); sh.closePath();
  g.push(pXY(sh, 0.012, 0.106, 'black', [{ c: [TR.XS, TR.R], r: 0.106 }]));
  // appuis des traverses (côté intérieur)
  for (const x of [-FP, FP]) g.push(m(G.box(0.21, 0.11, 0.008, 0.002), 'black', { p: [x, 0.304, 0.104] }));
  return g;
}
function trackUnit(n, side, label) {
  const sec = '11.1', item = '1', pn = '276854', page = 61, approx = true;
  const note = 'Fait partie de 276854 (ligne unique au manuel). Forme estimée.';
  const kids = [
    part({ id: `frame-trk${n}-belt`, sec, item, pn, fr: 'Chenille caoutchouc', en: 'Rubber track', qty: '1', page, approx, note, explode: [0, 0, -0.30] },
      [m(rubberTrack({ length: L.track.length - 0.044, height: L.track.height - 0.044, width: L.track.width, thick: 0.035, pitch: 0.09, lug: 0.022 }), 'rubber', { p: [0, TR.R, 0] })]),
    part({ id: `frame-trk${n}-motor`, sec, item, pn, fr: 'Moteur de translation et barbotin', en: 'Drive motor and sprocket', qty: '1', page, approx, note, explode: [0, 0, 0.10] }, motorGeo()),
    part({ id: `frame-trk${n}-idler`, sec, item, pn, fr: 'Roue folle et tendeur', en: 'Idler and track adjuster', qty: '1', page, approx, note, explode: [-0.12, 0, 0] }, idlerGeo()),
    part({ id: `frame-trk${n}-rollers`, sec, item, pn, fr: 'Galets (6)', en: 'Track rollers (6)', qty: '6', page, approx, note, explode: [0, -0.10, 0] }, rollerGeo()),
    part({ id: `frame-trk${n}-frame`, sec, item, pn, fr: 'Longeron de chenille', en: 'Track frame', qty: '1', page, approx, note, explode: [0, 0, 0] }, trackFrameGeo()),
  ];
  return asm({ id: `frame-trk${n}`, sec, item, pn, fr: `Train de chenille ${label}`, en: `Track unit ${side > 0 ? 'right' : 'left'}`, qty: '2', page, approx, note: `Côté ${side > 0 ? '+Z (leviers)' : '-Z (écran)'}. Moteur côté ${side > 0 ? '-X' : '+X'}.`, explode: [0, 0, side * 0.30] },
    kids, { p: [0, 0, side * TR.Z], r: [0, side > 0 ? 180 : 0, 0] });
}
function carriage() {
  const sec = '11.1', page = 61, kids = [];
  // 276854 : bâti soudé des chenilles (traverses + deux trains)
  const cross = [];
  for (const x of [-FP, FP]) {
    const o = 0.1, i = 0.09, yt = 0.354, yb = L.frame.clearanceY;
    cross.push(m(G.plate([[x - o + B, yt - B], [x + o - B, yt - B], [x + o - B, yb + B], [x + i + B, yb + B], [x + i + B, yt - 0.010 - B], [x - i - B, yt - 0.010 - B], [x - i - B, yb + B], [x - o + B, yb + B]], 2 * (TR.Z - 0.10)), 'black'));
  }
  const weldt = asm({ id: 'frame-trkweldt', sec, item: '1', pn: '276854', fr: 'Bâti de chenilles', en: 'Track frame weldment', qty: '1', page, explode: [0, 0, 0], approx: true,
    note: "Deux trains de chenille reliés par deux traverses en U sous les fourreaux du châssis. Garde au sol de 10 po sous les traverses." }, [
    part({ id: 'frame-trkcross', sec, item: '1', pn: '276854', fr: 'Traverses', en: 'Cross members', qty: '2', page, explode: [0, 0, 0], approx: true }, cross),
    trackUnit(1, -1, 'gauche'), trackUnit(2, 1, 'droit'),
  ]);
  kids.push(weldt);
  // 7 : plaques d'appui (4) sous les caissons du châssis
  let k = 0;
  for (const x of [-FP, FP]) for (const s of [-1, 1]) {
    const z = s * 0.35, h = []; for (const dx of [-0.05, 0.05]) for (const dz of [-0.035, 0.035]) h.push({ c: [x + dx, z + dz], r: 0.0105 });
    kids.push(part({ id: `frame-cplate-${++k}`, sec, item: '7', pn: '281342', fr: "Plaque d'appui", en: 'Mounting plate', qty: '4', page, explode: [0, 0.10, 0] },
      [pXZ(G.rrect(0.21, 0.15, 0.006, x, z), 0.012, 0.360, 'black', h)]));
  }
  // 2, 3, 4 : boulons 3/4 po (16), rondelles (32), contre-écrous (16)
  const hw = [];
  for (const x of [-FP, FP]) for (const s of [-1, 1]) for (const dx of [-0.05, 0.05]) for (const dz of [-0.035, 0.035])
    hw.push(place(fastener({ d: 0.75 * IN, len: 3.25 * IN, grip: 0.030, nw: true, nk: 'hex', wt: 0.004, wod: 0.0373 }), [x + dx, YB + 0.008, s * 0.35 + dz], [0, 1, 0]));
  kids.push(part({ id: 'frame-carriage-hw', sec, item: '2, 3, 4', pn: 'W008, N065, B423', fr: 'Visserie', en: 'Hardware', qty: '64', page, explode: [0, 0.20, 0],
    note: 'Items 2 (32 rondelles 3/4 po W008), 3 (16 contre-écrous N065) et 4 (16 vis 3/4-10 x 3,25 po B423). Tête dans le caisson du châssis.' }, hw));
  // 5, 6 : adaptateurs des moteurs (détail B p. 61) : 2 de chaque par moteur, côté intérieur
  const ports = (big) => {
    const g = [];
    for (const side of [-1, 1]) {
      const cx = side < 0 ? TR.XS : -TR.XS, z = side * (TR.Z - 0.17), sx = side < 0 ? 1 : -1;
      for (const dx of [-0.035, 0.035]) g.push(place(fitting({ d: (big ? 0.5 : 0.375) * IN, L: big ? 0.04 : 0.034 }), [cx + sx * dx, TR.R + (big ? -0.03 : 0.045), z], [0, 0, -side]));
    }
    return g;
  };
  kids.push(part({ id: 'frame-adapt10', sec, item: '5', pn: '9005ES-10-08', fr: 'Adaptateur #10 JIC', en: 'Adapter #10 JIC to 1/2 BSPP', qty: '4', page, explode: [0, 0, 0], note: 'Deux par moteur de translation (orifices de travail).' }, ports(true)));
  kids.push(part({ id: 'frame-adapt6', sec, item: '6', pn: '9005ES-06-04', fr: 'Adaptateur #6 JIC', en: 'Adapter #6 JIC to 1/4 BSPP', qty: '4', page, explode: [0, 0, 0], note: 'Deux par moteur (TANK et Ps, détail B p. 61).' }, ports(false)));
  return asm({ id: 'frame-carriage', sec, item: '9', pn: '276973', fr: 'Chenilles et chariot', en: 'Track carriage', qty: '1', page, explode: [0, -0.35, 0] }, kids);
}

/* ------------------------------------------------------------------ */
/* 11.2 Valve d'équilibrage 277923 (x 2)                               */
/* ------------------------------------------------------------------ */
// Repère local : dos du bloc en z = 0 contre l'âme intérieure du caisson, face avant en +z (vers le centre).
function cbvAsm(n, s) {
  const sec = '11.2', page = 62, d10 = 0.5 * IN, zc = 0.0165;
  const block = [m(G.box(0.06, 0.11, 0.033, 0.0025), 'alu', { p: [0, 0, zc] })];
  for (const y of [-0.028, 0.028]) {
    block.push(xAx(G.cyl(0.0085, 0.008, 20), 'zinc', [-0.034, y, zc]));
    block.push(m(G.hex(0.022, 0.010), 'zinc', { p: [-0.0425, y, zc], r: [0, 0, 90] }));
  }
  for (const y of [-0.025, 0.025]) block.push(xAx(G.cyl(0.011, 0.002, 24), 'zinc', [0.031, y, zc]));
  const top = grp([elbow({ d: d10 })], { p: [0, 0.055, zc], r: [0, -90, 0] });
  const bot = grp([grp([elbow({ d: d10 })], { r: [180, 0, 0] })], { p: [0, -0.055, zc], r: [0, -90, 0] });
  const straight = [-0.025, 0.025].map(y => place(fitting({ d: d10, L: 0.04 }), [0.032, y, zc], [1, 0, 0]));
  const hw = [-0.045, 0.045].map(y => place(fastener({ d: 0.3125 * IN, len: 1.75 * IN, grip: 0.041, wt: 0.0022, wod: 0.0165 }), [0.012, y, 0.033], [0, 0, 1]));
  return asm({ id: `frame-cbv-${n}`, sec, item: '13', pn: '277923', fr: "Valve d'équilibrage", en: 'Counterbalance valve', qty: '2', page, explode: [0, 0.40, -s * 0.07],
    note: `Sur l'âme intérieure du caisson ${s < 0 ? '-Z' : '+Z'}, à mi-longueur (coupe A-A p. 59). Position de la 2e valve estimée (symétrique).`, approx: s > 0 }, [
    part({ id: `frame-cbv-${n}-block`, sec, item: '1', pn: '277913', fr: 'Bloc double 10:1', en: 'Dual counterbalance block', qty: '1', page, explode: [0, 0, 0] }, block),
    part({ id: `frame-cbv-${n}-elb1`, sec, item: '2', pn: '2062-10-10S', fr: 'Coude', en: 'Elbow fitting', qty: '2', page, explode: [0, 0.06, 0] }, [top]),
    part({ id: `frame-cbv-${n}-elb2`, sec, item: '2', pn: '2062-10-10S', fr: 'Coude', en: 'Elbow fitting', qty: '2', page, explode: [0, -0.06, 0] }, [bot]),
    part({ id: `frame-cbv-${n}-fit`, sec, item: '5', pn: '202702-10-10S', fr: 'Raccords droits', en: 'Straight fittings', qty: '2', page, explode: [0.07, 0, 0] }, straight),
    part({ id: `frame-cbv-${n}-hw`, sec, item: '3, 4', pn: 'B083, 231470', fr: 'Visserie', en: 'Hardware', qty: '4', page, explode: [0, 0, 0.08], note: 'Items 3 (2 vis 5/16-18 x 1,75 po) et 4 (2 rondelles Nord-Lock).' }, hw),
  ], { p: [0.02, 0.52, s * (ZI[0] - 0.004)], r: [0, s > 0 ? 180 : 0, 0] });
}

/* ------------------------------------------------------------------ */
/* 11.3 Stabilisateur 277131 (x 4)                                     */
/* ------------------------------------------------------------------ */
// Repère local : axe du vérin en x = z = 0 ; brides contre le châssis en +z (face d'appui à z = 0,065).
function stabCylGeo() {
  const g = [];
  const bp = [[-0.105, 0.289], [0.105, 0.289], [0.105, 0.545], [0.089, 0.561], [-0.089, 0.561], [-0.105, 0.545]];
  const holes = []; for (const x of [-0.08, 0.08]) for (const y of [0.31, 0.386, 0.464, 0.542]) holes.push({ c: [x, y], r: 0.0068 });
  g.push(pXY(bp, 0.019, 0.0555, 'red', holes));
  for (const x of [-0.052, 0.052]) for (const y of [0.33, 0.43, 0.53]) g.push(m(G.box(0.012, 0.03, 0.012, 0.002), 'red', { p: [x, y, 0.041] })); // pattes de soudure
  g.push(m(G.cyl(0.046, 0.607 - 0.225, 40), 'red', { p: [0, (0.607 + 0.225) / 2, 0] }));
  g.push(m(G.cyl(0.040, 0.006, 32), 'zinc', { p: [0, 0.222, 0] }));
  // tige et patin mobiles (atelier) : la tige se prolonge, cachée, dans le fût. 100 % = patin au sol.
  g.push(seg({ seg: 'rod', joint: { id: 'jacks', type: 'slide', axis: [0, -1, 0], scale: (L.stabilizer.footRetractedY - 0.005) / 100 } }, [
    m(G.cyl(0.0255, 0.240, 24), 'chrome', { p: [0, 0.209 + 0.120, 0] }),
    m(G.lathe([[0, L.stabilizer.footRetractedY - 0.005], [0.086, 0.195], [0.089, 0.198], [0.089, 0.205], [0.084, 0.209], [0.036, 0.211], [0.031, 0.214], [0, 0.214]], 48), 'red'),
  ]));
  const a = 0.059, c = 0.018;
  g.push(m(G.plate([[a - c, -a], [a, -a + c], [a, a - c], [a - c, a], [-a + c, a], [-a, a - c], [-a, -a + c], [-a + c, -a]], 0.052), 'red', { p: [0, 0.626, 0], r: [90, 0, 0] }));
  // tube extérieur vers le fond du vérin (côté +x local)
  g.push(m(G.sweep([[0.062, 0.634, -0.012], [0.058, 0.62, -0.012], [0.056, 0.58, -0.012], [0.056, 0.30, -0.012], [0.053, 0.266, -0.012]], 0.0048, { radial: 10 }), 'red'));
  g.push(m(G.box(0.014, 0.016, 0.018, 0.002), 'zinc', { p: [0.064, 0.634, -0.012] }));
  g.push(m(G.box(0.016, 0.024, 0.02, 0.003), 'red', { p: [0.05, 0.255, -0.012] }));
  g.push(m(G.hex(0.013, 0.008), 'zinc', { p: [0.053, 0.27, -0.012] }));
  return g;
}
function stabAsm(n, x, s, note) {
  const sec = '11.3', page = 63;
  const fits = [-0.022, 0.022].map(dx => place(fitting({ d: 0.375 * IN, L: 0.032 }), [dx, 0.626, -0.059], [0, 0, -1]));
  const plugs = [-0.02, 0.02].map(dz => place(grp([m(G.hex(0.0175, 0.006), 'zinc', { p: [0, 0.004, 0] }), m(G.cyl(0.0075, 0.002, 20), 'zinc', { p: [0, 0.0005, 0] })]), [-0.059, 0.626, dz], [-1, 0, 0]));
  const hw = []; for (const dx of [-0.08, 0.08]) for (const y of [0.31, 0.386, 0.464, 0.542]) hw.push(place(fastener({ d: 0.5 * IN, len: 1.25 * IN, grip: 0.0317, wt: 0.0025, wod: 0.0254 }), [dx, y, 0.046], [0, 0, -1]));
  return asm({ id: `frame-stab-${n}`, sec, item: '11', pn: '277131', fr: 'Stabilisateur', en: 'Stabilizer', qty: '4', page, explode: [0, 0, s * 0.32], note }, [
    part({ id: `frame-stab-${n}-cyl`, sec, item: '1', pn: '276978', fr: 'Vérin de stabilisateur', en: 'Outrigger cylinder', qty: '1', page, explode: [0, 0, 0], note: 'Pose rentrée : patin à 0,195 m du sol.' }, stabCylGeo()),
    part({ id: `frame-stab-${n}-fit`, sec, item: '4', pn: '202702-6-6', fr: 'Raccords droits', en: 'Straight fittings', qty: '2', page, explode: [0, 0, -0.08] }, fits),
    part({ id: `frame-stab-${n}-plug`, sec, item: '5', pn: 'FF2138-06', fr: 'Bouchons', en: 'Plugs', qty: '2', page, explode: [-0.08, 0, 0] }, plugs),
    part({ id: `frame-stab-${n}-hw`, sec, item: '2, 3', pn: 'W005, B267', fr: 'Visserie', en: 'Hardware', qty: '16', page, explode: [0, 0, -0.14], note: 'Items 2 (8 rondelles 1/2 po) et 3 (8 vis 1/2-13 x 1,25 po) dans la flasque taraudée du châssis.' }, hw),
  ], { p: [x, 0, s * ST.z], r: [0, s > 0 ? 180 : 0, 0] });
}

/* ------------------------------------------------------------------ */
/* 11.4 Arrêt d'urgence 276914                                         */
/* ------------------------------------------------------------------ */
// Repère local (aligné sur le monde) : bouton vers +Z, dos du support en z = 0, bas de la patte inférieure en y = 0.
function estopAsm() {
  const sec = '11.4', page = 64;
  const plate = [
    pXY(rect(-0.06, 0, 0.06, 0.092), 0.005, -0.0025, 'red', [{ c: [-0.026, 0.045], r: 0.0023 }, { c: [0.026, 0.045], r: 0.0023 }]),
    pXZ(rect(-0.06, 0.0005, 0.06, 0.088), 0.005, 0.0025, 'red', [{ c: [-0.045, 0.045], r: 0.0052 }, { c: [0.045, 0.045], r: 0.0052 }]),
    pXZ(rect(-0.045, 0.0005, 0.045, 0.072), 0.005, 0.0895, 'red', [{ c: [-0.02, 0.05], r: 0.004 }, { c: [0.02, 0.05], r: 0.004 }]),
  ];
  const box = [
    m(G.box(0.07, 0.074, 0.058, 0.005), 'yellow', { p: [0, 0.043, 0.0295] }),
    zAx(G.tube(0.027, 0.015, 0.006, 40), 'yellow', [0, 0.043, 0.0615]),
    seg({ seg: 'cap', joint: { id: 'btn:u3', type: 'slide', axis: [0, 0, -1], scale: 0.006 } }, [
      zAx(G.cyl(0.0135, 0.008, 32), 'plastic', [0, 0.043, 0.068]),
      zAx(G.lathe([[0, 0], [0.013, 0], [0.013, 0.004], [0.02, 0.007], [0.0205, 0.013], [0.018, 0.018], [0.008, 0.0205], [0, 0.021]], 40), 'red', [0, 0.043, 0.0715]),
    ]),
    xAx(G.cyl(0.0062, 0.016, 20), 'zincClear', [-0.043, 0.024, 0.03]),
    xAx(G.cyl(0.0085, 0.008, 6), 'plastic', [-0.047, 0.024, 0.03]),
  ];
  const m4 = [-0.026, 0.026].map(x => place(fastener({ d: 0.004, len: 0.012, grip: 0.008, head: 'shcs', hw: false, nw: true, nk: 'hex', mk: 'zincClear', wt: 0.0008, wod: 0.009 }), [x, 0.045, 0.0035], [0, 0, 1]));
  const b38 = [-0.045, 0.045].map(x => place(fastener({ d: 0.375 * IN, len: 1 * IN, grip: 0.013 }), [x, -0.008, 0.045], [0, -1, 0]));
  return asm({ id: 'frame-estop', sec, item: '8', pn: '276914', fr: "Arrêt d'urgence", en: 'Emergency stop', qty: '1', page, explode: [0, 0, 0.38],
    note: "Coin inférieur avant droit du châssis : bout +X (côté bac), côté +Z, dans l'encoche du coin, devant le stabilisateur avant droit. Bouton tourné vers l'extérieur (+Z)." }, [
    part({ id: 'frame-estop-plate', sec, item: '2', pn: '276915', fr: 'Support en C', en: 'E-stop mount plate', qty: '1', page, explode: [0, 0, 0], approx: true, note: 'Patte supérieure dessinée vers l\'avant (garde du bouton).' }, plate),
    part({ id: 'frame-estop-box', sec, item: '1', pn: '271707', fr: "Bouton d'arrêt d'urgence", en: 'E-stop with enclosure', qty: '1', page, explode: [0, 0, 0.12], note: 'Boîtier Murr, connecteur M12 4 broches.' }, box),
    part({ id: 'frame-estop-m4', sec, item: '3, 4, 5', pn: '258244, 232679, 232680', fr: 'Visserie M4', en: 'M4 hardware', qty: '6', page, explode: [0, 0, 0.06], note: 'Items 3 (2 rondelles M4), 4 (2 écrous M4) et 5 (2 vis CHC M4 x 12).' }, m4),
    part({ id: 'frame-estop-hw', sec, item: '6, 7', pn: 'W003, B142', fr: 'Visserie 3/8 po', en: '3/8 in hardware', qty: '4', page, explode: [0, -0.10, 0], note: 'Items 6 (2 rondelles 3/8 po) et 7 (2 vis 3/8-16 x 1 po) sous la patte du châssis.' }, b38),
  ], { p: ES });
}

/* ------------------------------------------------------------------ */
/* 11.5 Phare encastré 277128 (x 4)                                    */
/* ------------------------------------------------------------------ */
// Repère local : collerette dans le plan XZ (y de -0,004 à 0), lentille vers -Y (extérieur), ailettes vers +Y.
function lampGeo() {
  const g = [];
  g.push(m(G.plate(G.stadium(0.20, 0.06), 0.004, { holes: [{ c: [-0.088, 0], r: 0.003 }, { c: [0.088, 0], r: 0.003 }] }), 'black', { p: [0, -0.002, 0], r: [90, 0, 0] }));
  const bez = G.stadium(0.172, 0.05); bez.holes.push(new THREE.Path(G.stadium(0.158, 0.042).getPoints(24).reverse()));
  g.push(m(G.plate(bez, 0.003), 'black', { p: [0, -0.0055, 0], r: [90, 0, 0] }));
  g.push(m(G.plate(G.stadium(0.15, 0.034), 0.002), 'ledWhite', { p: [0, -0.005, 0], r: [90, 0, 0] }));
  g.push(m(G.box(0.164, 0.012, 0.034, 0.002), 'black', { p: [0, 0.006, 0] }));
  for (let k = 0; k < 16; k++) {
    const x = -0.075 + k * 0.01, h = 0.026 + 0.012 * (1 - Math.abs(x) / 0.08);
    g.push(m(G.box(0.0035, h, 0.034, 0), 'black', { p: [x, 0.011 + h / 2, 0] }));
  }
  return g;
}
function lightAsm(n, p, X, Yv, ex, note) {
  const sec = '11.5', page = 65, d = 0.216 * IN;
  const vis = [-0.088, 0.088].map(x => place(fastener({ d, len: 0.75 * IN, grip: 0.012, head: 'bhcs', hw: false, mk: 'zincClear' }), [x, -0.004, 0], [0, -1, 0]));
  const ecr = [-0.088, 0.088].map(x => grp([washer({ d, t: 0.0012 }), grp([nut({ d })], { p: [0, 0.0012, 0] })], { p: [x, 0.008, 0] }));
  return orient(asm({ id: `frame-light-${n}`, sec, item: '10', pn: '277128', fr: 'Phare encastré', en: 'Recessed work light', qty: '4', page, explode: ex, note }, [
    part({ id: `frame-light-${n}-lamp`, sec, item: '1', pn: '242736', fr: 'Phare', en: 'Recessed light', qty: '1', page, explode: [0, 0, 0] }, lampGeo()),
    part({ id: `frame-light-${n}-vis`, sec, item: '4', pn: '231029', fr: 'Vis', en: 'Screws', qty: '2', page, explode: [0, -0.07, 0], note: 'Vis à tête ronde #12-24 x 3/4 po.' }, vis),
    part({ id: `frame-light-${n}-ecr`, sec, item: '2, 3', pn: 'W027, 210909', fr: 'Rondelles et écrous', en: 'Washers and nuts', qty: '4', page, explode: [0, 0.075, 0], note: 'Items 2 (2 rondelles #12) et 3 (2 écrous #12-24), dans la poutre.' }, ecr),
  ]), X, Yv, p);
}

/* ------------------------------------------------------------------ */
/* Pièces directes de la nomenclature p. 60                            */
/* ------------------------------------------------------------------ */
// Rampe de garde : dans le jeu entre le socle (semelle jusqu'à x = -0,74 dans pedestal.js) et le corps du bac (x = -0,705),
// sous le rebord du bac (y >= 1,178). Tube de 1 po.
const XR = -0.7255, ZP = 0.27, YT = 1.16, YM = 1.0, RR = 0.0127, XT = -0.7595;
function railPart() {
  const P = (z, y) => new THREE.Vector3(XR, y, z), yr = 0.80, zo = 0.57;
  const path = roundedPath([P(-ZP - 0.008, yr), P(-zo, yr), P(-zo, YT), P(zo, YT), P(zo, yr), P(ZP + 0.008, yr)], 0.06);
  const g = [m(new THREE.TubeGeometry(path, 240, RR, 14, false), 'red')];
  g.push(m(G.cyl(RR, 2 * ZP, 20), 'red', { p: [XR, YM, 0], r: [90, 0, 0] }));
  for (const s of [-1, 1]) {
    g.push(m(G.cyl(RR, YT - (Y0 + 0.006), 20), 'red', { p: [XR, (YT + Y0 + 0.006) / 2, s * ZP] }));
    g.push(m(G.box(0.026, 0.006, 0.084, 0.0015), 'red', { p: [XR + 0.0005, Y0 + 0.0033, s * ZP] }));
    // patte pliée en L : rabat soudé sous la barre du milieu, aile verticale contre la face +X du socle
    const zt = s * 0.18, tab = new THREE.Shape(), yb = YM - RR;
    tab.moveTo(zt - 0.022, yb); tab.lineTo(zt + 0.022, yb); tab.lineTo(zt + 0.022, yb - 0.054); tab.absarc(zt, yb - 0.054, 0.022, 0, -Math.PI, true); tab.closePath();
    g.push(pYZ(tab, 0.006, XT + 0.003, 'red', [{ c: [zt, yb - 0.020], r: 0.0055 }, { c: [zt, yb - 0.044], r: 0.0055 }]));
    g.push(m(G.box(XR - XT, 0.006, 0.044, 0.0015), 'red', { p: [(XR + XT) / 2, yb - 0.003, zt] }));
  }
  return part({ id: 'frame-rail', sec: '11', item: '12', pn: '277535', fr: 'Rampe de garde', en: 'Guard rail', qty: '1', page: 58, explode: [0, 0.40, 0],
    note: "Entre le socle et le bac. Deux semelles boulonnées sur le plateau, deux pattes boulonnées sur la face +X du socle." }, g);
}
function railHw() {
  const g = [], o = { d: 0.375 * IN, grip: 0.014, nw: true, nk: 'hex', wt: 0.0025, wod: 0.0235 };
  for (const s of [-1, 1]) for (const dz of [-0.03, 0.03]) g.push(place(fastener({ ...o, len: 1.25 * IN }), [XR, Y0 + 0.0063, s * ZP + dz], [0, 1, 0]));
  for (const s of [-1, 1]) for (const y of [YM - RR - 0.020, YM - RR - 0.044]) g.push(place(fastener({ ...o, len: 1.5 * IN }), [XT + 0.006, y, s * 0.18], [1, 0, 0]));
  return part({ id: 'frame-rail-hw', sec: '11', item: '2, 15, 16, 17', pn: '218153, B144, B146, N017', fr: 'Visserie de la rampe', en: 'Guard rail hardware', qty: '24', page: 58, explode: [0, 0.22, 0],
    note: "Items 15 (4 vis 3/8 x 1,25 po, semelles), 16 (4 vis 3/8 x 1,5 po, pattes du socle), 17 (8 écrous) et 2 (16 rondelles Nord-Lock). Écrous des pattes derrière la tôle du socle." }, g);
}
/** Feux de position rouges (3), brides (14) et visserie (4, 5) sur les faces des poutres d'extrémité. */
function markers() {
  const out = []; let n = 0;
  for (const [xo, sx] of [[XI.p + EB.D, 1], [XI.n - EB.D, -1]]) for (const z of [0.40, -0.40]) {
    n++;
    const p = [xo, 0.455, z], dir = [sx, 0, 0];
    const lamp = [m(G.lathe([[0, 0.021], [0.022, 0.0198], [0.0285, 0.0155], [0.0305, 0.0105], [0.0305, 0.0085], [0, 0.0085]], 40), 'redLens'),
      m(G.lathe([[0.0275, -0.036], [0.0275, 0.0055], [0.0315, 0.0055], [0.0315, 0.009], [0.0255, 0.009], [0.0255, -0.036]], 32), 'black')];
    const flange = [m(G.lathe([[0.0325, 0], [0.0472, 0], [0.048, 0.0008], [0.048, 0.0042], [0.0472, 0.005], [0.036, 0.005], [0.0345, 0.0078], [0.0325, 0.0078], [0.0325, 0]], 48), 'black')];
    const hw = [];
    for (let i = 0; i < 3; i++) {
      const a = Math.PI / 2 + i * 2 * Math.PI / 3, q = [0.042 * Math.cos(a), 0.005, 0.042 * Math.sin(a)];
      hw.push(place(fastener({ d: 0.19 * IN, len: 0.75 * IN, grip: 0.013, head: 'bhcs', hw: false, nk: 'lock', mk: 'zincClear' }), q, [0, 1, 0]));
    }
    const note = `Bout ${sx > 0 ? '+X (côté bac)' : '-X (côté socle)'}, côté ${z * sx > 0 ? '+Z' : '-Z'}${n === 1 ? '. Détail B p. 59.' : '.'}`;
    out.push(aim(part({ id: `frame-marker-${n}`, sec: '11', item: '3', pn: '227757', fr: 'Feu de position rouge', en: 'Red marker light', qty: '4', page: 59, explode: [sx * 0.32, 0, 0], note }, lamp), p, dir));
    out.push(aim(part({ id: `frame-mflange-${n}`, sec: '11', item: '14', pn: '279435', fr: 'Bride de feu', en: 'Light flange', qty: '4', page: 59, explode: [sx * 0.20, 0, 0] }, flange), p, dir));
    out.push(aim(part({ id: `frame-mhw-${n}`, sec: '11', item: '4, 5', pn: '266564, 268634', fr: 'Visserie du feu', en: 'Marker light hardware', qty: '6', page: 59, explode: [sx * 0.11, 0, 0],
      note: '3 vis #10-32 x 3/4 po inox (item 4) et 3 écrous Nylstop (item 5) par feu. Nomenclature : 12 vis mais 11 écrous.' }, hw), p, dir));
  }
  return out;
}
function latches() {
  const geo = () => [
    m(G.plate(G.rrect(0.052, 0.102, 0.006), 0.003), 'black', { p: [0, 0.0015, 0], r: [90, 0, 0] }),
    m(G.box(0.040, 0.026, 0.088, 0.004), 'black', { p: [0, -0.012, 0] }),
    m(G.cyl(0.0085, 0.006, 24), 'chrome', { p: [0, 0.006, -0.03] }),
    m(G.cyl(0.0055, 0.068, 16), 'chrome', { p: [0, 0.0085, 0.003], r: [90, 0, 0] }),
    m(G.box(0.03, 0.009, 0.012, 0.004), 'chrome', { p: [0, 0.009, 0.036] }),
  ];
  const D = EB.D + 0.0005;
  return [
    orient(part({ id: 'frame-latch-1', sec: '11', item: '6', pn: '271386', fr: 'Loquet en T', en: 'T-handle latch', qty: '2', page: 58, explode: [0.15, 0, 0], note: 'Porte du compartiment, bout +X.' }, geo()), [0, 0, -1], [1, 0, 0], [XI.p + D, 0.4375, 0.13]),
    orient(part({ id: 'frame-latch-2', sec: '11', item: '6', pn: '271386', fr: 'Loquet en T', en: 'T-handle latch', qty: '2', page: 58, explode: [-0.15, 0, 0], note: 'Porte du compartiment, bout -X.' }, geo()), [0, 0, 1], [-1, 0, 0], [XI.n - D, 0.4375, -0.13]),
  ];
}
function tees() {
  const geo = () => [
    m(G.box(0.024, 0.024, 0.02, 0.003), 'zinc'),
    ...[-1, 1].map(s => grp([m(G.hex(0.019, 0.008), 'zinc', { p: [0, 0.016, 0] }), m(G.cyl(0.0068, 0.012, 16), 'zinc', { p: [0, 0.026, 0] })], { r: [0, 0, s * 90] })),
    m(G.hex(0.019, 0.012), 'zinc', { p: [0, 0.018, 0] }),
  ];
  return [-1, 1].map((s, i) => orient(part({ id: `frame-tee-${i + 1}`, sec: '11', item: '1', pn: '203102-6-6', fr: 'Té hydraulique', en: 'Run tee fitting', qty: '2', page: 58, explode: [-0.12, 0.05, 0], approx: true,
    note: 'Position estimée : face intérieure de la poutre +X, vers les stabilisateurs avant.' }, geo()), [0, 0, 1], [-1, 0, 0], [XI.p - 0.0125, 0.42, s * 0.52]));
}
function formedPlates() {
  // Capots pliés en L de chaque côté de la plaque du socle : âme verticale à |z| = 0,50, rabat supérieur sur le caisson.
  const out = [], { web, x0, x1 } = ZPL, bx = [x0 + 0.018, x1 - 0.018], by = [0.545, 0.595];
  for (const [s, item, pn, n] of [[-1, '18', '281037', 18], [1, '19', '281347', 19]]) {
    const holes = []; for (const x of bx) for (const y of by) holes.push({ c: [x, y], r: 0.0056 });
    const g = [pXY(rect(x0, 0.50, x1, 0.6505), 0.006, s * web, 'red', holes),
      pXZ(rect(x0, s * 0.283, x1, s * (web - 0.002)), 0.006, 0.653, 'red', [{ c: [-0.966, s * 0.4775], r: 0.0087 }]), // trou d'un boulon de semelle du socle
      m(G.cyl(0.006, x1 - x0, 12), 'red', { p: [(x0 + x1) / 2, 0.6505, s * (web - 0.0005)], r: [0, 0, 90] })];
    out.push(part({ id: `frame-plate${n}`, sec: '11', item, pn, fr: 'Plaque pliée', en: 'Formed plate', qty: '1', page: 58, explode: [0, 0, s * 0.28], approx: true,
      note: `Capot en L à côté de la plaque du socle, côté ${s < 0 ? '-Z (écran)' : '+Z (leviers)'}. Forme estimée (vue éclatée p. 58, vue de dessus p. 59).` }, g));
    const hw = []; for (const x of bx) for (const y of by) hw.push(place(fastener({ d: 0.375 * IN, len: 1 * IN, grip: 0.014 }), [x, y, s * (web + 0.003)], [0, 0, s]));
    out.push(part({ id: `frame-plate${n}-hw`, sec: '11', item: '20, 21', pn: 'B142, W003', fr: 'Visserie', en: 'Hardware', qty: '8', page: 58, explode: [0, 0, s * 0.42],
      note: `Items 20 (4 vis 3/8-16 x 1 po) et 21 (4 rondelles 3/8 po) de la plaque ${n}, dans des pattes taraudées.` }, hw));
  }
  return out;
}

/* ------------------------------------------------------------------ */
export function build() {
  const kids = [weldment(), carriage()];
  // stabilisateurs : 1 avant droit (+X +Z), 2 avant gauche (+X -Z), 3 arrière droit (-X +Z), 4 arrière gauche (-X -Z)
  kids.push(stabAsm(1, ST.x[1], 1, 'Coin +X +Z.'), stabAsm(2, ST.x[1], -1, 'Coin +X -Z.'), stabAsm(3, ST.x[0], 1, 'Coin -X +Z.'), stabAsm(4, ST.x[0], -1, 'Coin -X -Z.'));
  kids.push(cbvAsm(1, -1), cbvAsm(2, 1));
  kids.push(estopAsm());
  const c = Math.SQRT1_2, ul = EB.D - EB.ch / 2, yl = Y0 - EB.ch / 2;
  kids.push(lightAsm(1, [XI.p + ul, yl, 0.40], [0, 0, 1], [-c, -c, 0], [0.20, 0.14, 0], 'Bout +X, côté +Z.'));
  kids.push(lightAsm(2, [XI.p + ul, yl, -0.40], [0, 0, 1], [-c, -c, 0], [0.20, 0.14, 0], 'Bout +X, côté -Z.'));
  kids.push(lightAsm(3, [XI.n - ul, yl, 0.40], [0, 0, -1], [c, -c, 0], [-0.22, 0.05, 0], 'Bout -X, côté +Z.'));
  kids.push(lightAsm(4, [XI.n - ul, yl, -0.40], [0, 0, -1], [c, -c, 0], [-0.22, 0.05, 0], 'Bout -X, côté -Z.'));
  kids.push(railPart(), railHw(), ...markers(), ...latches(), ...tees(), ...formedPlates());
  return asm({ id: 'frame', sec: '11', item: '1', pn: '276676', fr: 'Châssis complet', en: 'Frame assembly', qty: '1', page: 58, explode: [0, 0, 0] }, kids);
}
