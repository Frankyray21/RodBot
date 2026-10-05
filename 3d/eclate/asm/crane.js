/* RodBot LP, vue éclatée : grue inférieure 276919 (section 10 du manuel de pièces PM10654, p. 45 à 57).
 * Couronne d'orientation (10.1) posée sur le socle, base de levage (10.2), 2 vérins de levage 278117,
 * flèche télescopique (10.3) : flèche extérieure (10.3.2), flèche intérieure, vérin 36 po,
 * chaîne porte-câbles (10.3.1), patte de bout de flèche (10.3.3), codeur de levage (10.3.4).
 * Pose : vue de côté p. 79 du manuel opérateur, flèche ramenée à l'horizontale autour de l'axe J2.
 * La flèche est un tube carré posé sur la pointe (section en losange, coupe A-A p. 52).
 * Cotes relevées sur op79 (3,244 mm/px), p. 49 (vue de dessus) et p. 51 (vue de côté).
 */
import { THREE, G, m, grp, aim, between, bolt, nut, washer, greaseNipple, fitting, elbow, weld, asm, part, IN } from '../kit.js';
import { L } from '../layout.js';

const D2R = Math.PI / 180;
const S2 = Math.SQRT2;
const V = (x, y, z) => new THREE.Vector3(x, y, z);

/* ------------------------------------------------------------------ */
/* Cotes                                                               */
/* ------------------------------------------------------------------ */
const SX = L.slew.x, SZ = L.slew.z;              // axe de la couronne
const Y0 = L.pedestal.topY;                      // dessus du socle (1,40)
const Y1 = L.slew.topY;                          // dessus de la couronne (1,47)
const [J2X, J2Y] = L.hoistBase.pivot;            // axe de levage J2
const [LBX, LBY] = L.liftCylinder.base;          // pied des vérins de levage
const [LRX, LRY] = L.liftCylinder.rod;           // tête des vérins de levage
const LZ = L.liftCylinder.zHalf;                 // vérins en z = ±0,15
const TIP = L.boom.tip;                          // face d'appui de la patte (x = 0,24)

const AY = J2Y + 0.150;          // axe de la flèche (J2 est 0,15 sous l'axe, p. 51)
const SO = 0.175, HO = SO / S2;  // flèche extérieure : côté, demi-diagonale
const WO = 0.25 * IN;            // paroi
const SI = 0.148, HI = SI / S2;  // flèche intérieure
const XFF = -0.010;              // face avant de la bride de la flèche extérieure
const XFT = 0.5 * IN;            // épaisseur de bride
const XR = -1.293;               // arrière du tube extérieur
const XLF = TIP[0];              // face d'appui de la patte (0,24)
const XLP = XLF - 1 * IN;        // arrière de la plaque de patte
const XIFF = XLP - 1 * IN;       // face avant de la bride intérieure (entretoises de 1 po)
const XIF = XIFF - 0.5 * IN;     // bout du tube intérieur
const LI = 1.376;                // longueur du tube intérieur (p. 49 : 1,105 x tube extérieur)
const XIR = XIF - LI;            // arrière du tube intérieur
const YT = AY - 0.024;           // axe du vérin télescopique (œil arrière p. 51)
const XTB = -1.330;              // axe du pied du vérin télescopique
const XTR = XIF - 0.035;         // axe de l'œil de tige (dans la flèche intérieure)
const EZ0 = -0.20;               // plan de la chaîne porte-câbles (côté -Z)
const WY = 1.452, WZ = 0.205;    // axe de la vis sans fin de la couronne (selon X, côté +Z, op07)
const WX0 = SX - 0.150, WX1 = SX + 0.100;   // bouts du carter de la vis
const ZE1 = [0.1134, 0.1293], ZE2 = [0.1707, 0.1866];   // joues de chape des vérins (côté +Z), 5/8 po

/* ------------------------------------------------------------------ */
/* Petits outils                                                       */
/* ------------------------------------------------------------------ */
const alongX = (g) => { g.rotateZ(-Math.PI / 2); return g; };
const alongZ = (g) => { g.rotateX(Math.PI / 2); return g; };
const tr = (g, x, y, z) => { g.translate(x, y, z); return g; };
/** Plaque dans le plan YZ (épaisseur selon X) : contour en (z, y). */
function plateYZ(outline, t, opts) { const g = G.plate(outline, t, opts); g.rotateY(-Math.PI / 2); return g; }
/** Plaque dans le plan XZ (épaisseur selon Y) : contour en (x, z). */
function plateXZ(outline, t, opts) { const g = G.plate(outline, t, opts); g.rotateX(Math.PI / 2); return g; }
/** Tube carré posé sur la pointe, le long de X. */
function diamond(side, wall, x0, x1, y = AY, r = 0.008) {
  const g = G.rectTube(side, side, x1 - x0, wall, r);
  g.rotateY(Math.PI / 4); alongX(g); return tr(g, (x0 + x1) / 2, y, 0);
}
/** Groupe orienté : X local -> ax, Y local -> ay. */
function frame(children, pos, ax, ay) {
  const g = grp(children); const X = V(...ax).normalize(), Y = V(...ay).normalize(), Z = V().crossVectors(X, Y);
  g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z)); g.position.set(...pos); return g;
}
/** Boulon avec rondelle : rondelle posée sur la surface p, normale n (vers l'extérieur). */
function bw(p, n, d, Lb, o = {}) {
  const N = V(...n).normalize(); const P = V(...p).addScaledVector(N, o.washer === false ? 0 : 0.12 * d);
  return aim(bolt({ d, L: Lb, washer: o.washer !== false, head: o.head || 'hex', mat: o.mat || 'zinc' }), P, N);
}
/** Écrou et rondelle posés sur la surface p, normale n. */
function nw(p, n, d, o = {}) { return aim(grp([washer({ d }), grp([nut({ d, lock: !!o.lock })], { p: [0, 0.12 * d, 0] })]), V(...p), V(...n)); }
/** Oreille de chape : base droite x0..x1 à yb, bossage rond (cx, cy, R) au-dessus ou au-dessous. */
function earShape(x0, x1, yb, cx, cy, R) {
  const s = new THREE.Shape(), e = 0.15;
  if (cy > yb) { s.moveTo(x0, yb); s.lineTo(x1, yb); s.lineTo(cx + R * Math.cos(-e), cy + R * Math.sin(-e)); s.absarc(cx, cy, R, -e, Math.PI + e, false); }
  else { s.moveTo(x1, yb); s.lineTo(x0, yb); s.lineTo(cx + R * Math.cos(Math.PI - e), cy + R * Math.sin(Math.PI - e)); s.absarc(cx, cy, R, Math.PI - e, 2 * Math.PI + e, false); }
  s.closePath(); return s;
}
function circ(cx, cy, r) { const p = new THREE.Path(); p.absarc(cx, cy, r, 0, Math.PI * 2, true); return p; }
/** Contour oblong entre deux points (rayon r). */
function slotShape([x1, y1], [x2, y2], r) {
  const s = new THREE.Shape(), a = Math.atan2(y2 - y1, x2 - x1);
  s.absarc(x2, y2, r, a - Math.PI / 2, a + Math.PI / 2, false); s.absarc(x1, y1, r, a + Math.PI / 2, a + 3 * Math.PI / 2, false); s.closePath(); return s;
}
/** Révolution à arêtes nettes : points ajoutés près des angles pour que les normales restent justes. */
function lath(profile, seg = 40) {
  const out = [];
  for (let i = 0; i < profile.length; i++) {
    const [r, y] = profile[i]; out.push([r, y]);
    if (i < profile.length - 1) {
      const [r2, y2] = profile[i + 1], d = Math.hypot(r2 - r, y2 - y);
      if (d > 0.003) { const e = 0.0005 / d; out.push([r + (r2 - r) * e, y + (y2 - y) * e], [r2 - (r2 - r) * e, y2 - (y2 - y) * e]); }
    }
  }
  return G.lathe(out, seg);
}
function ring(ro, ri, h, seg = 32) { const c = Math.min(0.0008, h / 4), y0 = -h / 2, y1 = h / 2; return lath([[ri + c, y0], [ro - c, y0], [ro, y0 + c], [ro, y1 - c], [ro - c, y1], [ri + c, y1], [ri, y1 - c], [ri, y0 + c], [ri + c, y0]], seg); }
function discR(r, h, seg = 40) { const c = Math.min(0.001, h / 3, r / 3); return lath([[0, -h / 2], [r - c, -h / 2], [r, -h / 2 + c], [r, h / 2 - c], [r - c, h / 2], [0, h / 2]], seg); }
function octa(w, h, c) { return [[-w / 2 + c, -h / 2], [w / 2 - c, -h / 2], [w / 2, -h / 2 + c], [w / 2, h / 2 - c], [w / 2 - c, h / 2], [-w / 2 + c, h / 2], [-w / 2, h / 2 - c], [-w / 2, -h / 2 + c]]; }

/* Vérin de levage 278117 le long de +Y (pied en 0, tête en Lp), axes des œils selon Z local.
 * Pied : bloc à 2 orifices (p. 45, op79) ; tête : œil à rotule ; tube rigide le long du fût vers la tête.
 * up = signe de X local qui pointe vers le haut (pour garder le tube sur le dessus). */
const LC = { od: 3 * IN, rodD: 1.5 * IN, eyeR: 0.032, eyeW: 1.5 * IN, yB: 0.040, yF: 0.115, yG: 0.375, ports: [[-0.016, 0.070], [0.016, 0.088]] };
function liftCylinder(Lp, up) {
  const { od, rodD, eyeR, eyeW, yB, yF, yG } = LC, mk = 'grey', pr = 0.625 * IN + 0.0006, g = [];
  const eye = earShape(-0.029, 0.029, yB + 0.002, 0, 0, eyeR); eye.holes.push(circ(0, 0, pr));
  g.push(m(G.plate(eye, eyeW, { curve: 20 }), mk));
  g.push(m(G.box(0.066, yF - yB, 0.056, 0.005), mk, { p: [0, (yB + yF) / 2, 0] }));
  g.push(m(lath([[0, yF - 0.003], [od / 2 - 0.002, yF - 0.003], [od / 2, yF - 0.001], [od / 2, yG], [0, yG]], 36), mk));
  g.push(m(lath([[0, yG - 0.001], [0.044, yG - 0.001], [0.044, yG + 0.014], [rodD / 2 + 0.003, yG + 0.018], [rodD / 2 + 0.001, yG + 0.018], [rodD / 2 + 0.001, yG - 0.001]], 36), mk));
  const yE = Lp - eyeR * 0.8;
  g.push(m(G.cyl(rodD / 2, yE - yG - 0.012, 28), 'chrome', { p: [0, (yE + yG + 0.012) / 2, 0] }));
  g.push(m(G.cyl(rodD * 0.6, eyeR * 0.7, 24), mk, { p: [0, Lp - eyeR * 0.8, 0] }));
  g.push(m(alongZ(ring(eyeR, 0.0205, eyeW)), mk, { p: [0, Lp, 0] }));
  g.push(m(G.sphere(0.0205, 20), 'machined', { p: [0, Lp, 0], s: [1, 1, 0.62] }));
  for (const [px, py] of LC.ports) g.push(m(alongZ(G.cyl(0.010, 0.006, 16)), mk, { p: [px, py, 0.031] }));
  // tube rigide vers la chambre de tige
  const tx = up * (od / 2 + 0.009);
  g.push(m(G.sweep([[up * 0.033, yF - 0.012, 0], [tx, yF + 0.006, 0], [tx, yG - 0.02, 0], [up * 0.042, yG + 0.006, 0]], 0.0048, { radial: 10 }), 'zincClear'));
  g.push(m(G.box(0.016, 0.014, 0.016, 0.003), mk, { p: [up * 0.040, yG + 0.006, 0] }));
  return grp(g);
}
/** Axe 1 1/4 x 3 po avec languette soudée, entre les joues ZE1..ZE2 du côté s ; vis d'arrêt en (x+0,0243, y+dy). */
function cylPin(x, y, s, dy) {
  const z0 = s * (ZE1[0] - 0.0015), z1 = s * (ZE2[1] + 0.0015), zc = (z0 + z1) / 2, Lp = Math.abs(z1 - z0);
  const a = Math.atan2(dy, 0.0243);
  return grp([
    m(alongZ(lath([[0, -Lp / 2], [0.0153, -Lp / 2], [0.0159, -Lp / 2 + 0.001], [0.0159, Lp / 2], [0, Lp / 2]], 28)), 'machined', { p: [x, y, zc] }),
    m(tr(G.plate(slotShape([0, 0], [0.0243, dy], 0.0145), 0.006, { holes: [{ c: [0.0243, dy], r: 0.0068 }] }), x, y, s * (ZE2[1] + 0.003)), 'machined'),
  ]);
}

/* ------------------------------------------------------------------ */
/* 10.1 Couronne d'orientation 277524 (p. 46) et codeur J1 (p. 47)      */
/* ------------------------------------------------------------------ */
function buildSlew() {
  const holes15 = []; for (let i = 0; i < 15; i++) { const a = (i + 0.5) * 2 * Math.PI / 15; holes15.push({ c: [0.19 * Math.cos(a), 0.19 * Math.sin(a)], r: 0.0085 }); }
  const sole = new THREE.Shape(); sole.absarc(0, 0, 0.21, 0, Math.PI * 2, false); sole.holes.push(circ(0, 0, 0.09));
  const H = [
    m(tr(plateXZ(sole, 0.015, { holes: holes15, curve: 48 }), SX, Y0 + 0.0075, SZ), 'blackCast'),
    m(lath([[0.1065, Y0 + 0.015], [0.172, Y0 + 0.015], [0.172, 1.452], [0.168, 1.456], [0.16, 1.456], [0.16, 1.4575], [0.1065, 1.4575], [0.1065, Y0 + 0.015]], 64), 'blackCast', { p: [SX, 0, SZ] }),
    // carter de la vis sans fin, tangent côté +Z (op07), moteur au bout +X, codeur au bout -X
    m(G.box(WX1 - WX0, 0.066, 0.095, 0.012), 'blackCast', { p: [(WX0 + WX1) / 2, Y0 + 0.034, 0.1975] }),
    m(G.cyl(0.045, WX1 - WX0 - 0.012, 32), 'blackCast', { p: [(WX0 + WX1) / 2, WY, WZ], r: [0, 0, 90] }),
    m(discR(0.047, 0.008, 32), 'blackCast', { p: [WX0 + 0.004, WY, WZ], r: [0, 0, 90] }),
    m(discR(0.047, 0.008, 32), 'blackCast', { p: [WX1 - 0.004, WY, WZ], r: [0, 0, 90] }),
    // bague tournante (reçoit la bride de la base de levage)
    m(lath([[0.092, 1.430], [0.105, 1.430], [0.105, 1.4578], [0.156, 1.4578], [0.157, 1.459], [0.157, Y1 - 0.0008], [0.156, Y1], [0.092, Y1], [0.092, 1.430]], 64), 'black', { p: [SX, 0, SZ] }),
  ];
  const drive = part({ id: 'crane-slew-drive', sec: '10.1', item: '1', pn: '276947', fr: 'Couronne à vis sans fin', en: 'Slew drive', qty: '1', page: 46, explode: [0, 0, 0], approx: true, note: 'Diamètres relevés sur op07 et op79 (semelle 0,42 m, corps 0,344 m). Les 15 vis de semelle sont du socle (B354).' }, H);

  // Moteur hydraulique 278096 au bout +X de la vis : bride, bloc, corps, couvercle à 7 vis.
  const mx = WX1;
  const M = [
    m(G.box(0.012, 0.104, 0.106, 0.005), 'black', { p: [mx + 0.006, WY + 0.002, WZ] }),
    m(G.box(0.040, 0.066, 0.07, 0.006), 'grey', { p: [mx + 0.032, WY, WZ] }),
    m(lath([[0, 0], [0.047, 0], [0.050, 0.004], [0.050, 0.075], [0.047, 0.079], [0.040, 0.082], [0, 0.082]], 40), 'grey', { p: [mx + 0.052, WY, WZ], r: [0, 0, -90] }),
    m(lath([[0, 0], [0.046, 0], [0.046, 0.016], [0.042, 0.020], [0.012, 0.020], [0.012, 0.024], [0, 0.024]], 40), 'black', { p: [mx + 0.134, WY, WZ], r: [0, 0, -90] }),
  ];
  for (let i = 0; i < 7; i++) { const a = i * 2 * Math.PI / 7; M.push(aim(bolt({ d: 0.3125 * IN, L: 0.4 * IN, mat: 'zinc' }), V(mx + 0.150, WY + 0.033 * Math.cos(a), WZ + 0.033 * Math.sin(a)), V(1, 0, 0))); }
  const motor = part({ id: 'crane-slew-motor', sec: '10.1', item: '8', pn: '278096', fr: 'Moteur hydraulique', en: 'Hydraulic motor', qty: '1', page: 46, explode: [0.24, 0, 0], spare: true, approx: true, note: 'Moteur 127,5 cm3 en bout de vis sans fin, côté +X et +Z (relevé op07).' }, M);

  const fit = [0, 1].map(i => part({ id: `crane-slew-fit-${i + 1}`, sec: '10.1', item: '6', pn: '202702-10-6', fr: 'Raccord droit', en: 'Straight fitting', qty: '2', page: 46, explode: [0.24, 0.07, 0] },
    [aim(fitting({ d: 0.625 * IN, L: 0.032 }), V(mx + 0.022 + i * 0.022, WY + 0.033, WZ), V(0, 1, 0))]));

  // Butée interne 277515 dans l'alésage de la bague tournante
  const stop = part({ id: 'crane-slew-stop', sec: '10.1', item: '4', pn: '277515', fr: 'Butée interne', en: 'Internal slew stop', qty: '1', page: 46, explode: [0, 0.12, 0], approx: true },
    [m(G.box(0.014, 0.030, 0.07, 0.002), 'steel', { p: [SX + 0.085, 1.451, SZ] })]);

  // Graisseur : mamelon 1,5 po + graisseur femelle, sur le corps côté -X/-Z
  const ga = 205 * D2R, gp = V(SX + 0.171 * Math.cos(ga), 1.437, SZ + 0.171 * Math.sin(ga)), gn = V(Math.cos(ga), 0.25, Math.sin(ga)).normalize();
  const nip = part({ id: 'crane-slew-nipple', sec: '10.1', item: '11', pn: '277430', fr: 'Mamelon de graisseur', en: 'Grease nipple extension', qty: '1', page: 46, explode: [-0.06, 0.02, -0.03] },
    [aim(grp([m(G.cyl(0.0052, 1.5 * IN, 16), 'steel', { p: [0, 0.75 * IN, 0] }), m(G.hex(0.011, 0.006), 'steel', { p: [0, 0.004, 0] })]), gp, gn)]);
  const grease = part({ id: 'crane-slew-grease', sec: '10.1', item: '10', pn: '259844', fr: 'Graisseur', en: 'Grease fitting', qty: '1', page: 46, explode: [-0.09, 0.03, -0.045] },
    [aim(greaseNipple('brass'), gp.clone().addScaledVector(gn, 1.5 * IN), gn)]);

  // Visserie : vis du moteur (3) + Nordlock (7), vis plates de la butée (5), bouchons (9)
  const hw = [];
  for (const s of [-1, 1]) hw.push(bw([mx + 0.012, WY + 0.040, WZ + s * 0.042], [1, 0, 0], 0.5 * IN, 1.5 * IN, { head: 'shcs' }));
  for (const s of [-1, 1]) hw.push(aim(bolt({ d: 0.625 * IN, L: 1.25 * IN, head: 'fhcs', mat: 'zinc' }), V(SX + 0.078, 1.451, SZ + s * 0.018), V(-1, 0, 0)));
  for (const a of [100, 300]) { const r = a * D2R; hw.push(aim(grp([m(G.cyl(0.0058, 0.004, 16), 'steel', { p: [0, 0.002, 0] }), m(G.hex(0.005, 0.0012), 'blackOxide', { p: [0, 0.0042, 0] })]), V(SX + 0.171 * Math.cos(r), 1.435, SZ + 0.171 * Math.sin(r)), V(Math.cos(r), 0, Math.sin(r)))); }
  const shw = part({ id: 'crane-slew-hw', sec: '10.1', item: '3', pn: 'C296', fr: 'Visserie', en: 'Hardware', qty: '-', page: 46, explode: [0.10, 0.05, 0], note: 'Repères 3 (C296 x2), 5 (277609 x2), 7 (117753 x2), 9 (266876 x2).' }, hw);

  return asm({ id: 'crane-slew', sec: '10.1', item: '4', pn: '277524', fr: "Couronne d'orientation", en: 'Slew drive assembly', qty: '1', page: 46, explode: [0, 0, 0] },
    [drive, motor, ...fit, stop, nip, grease, shw, buildJ1()]);
}

/* Codeur J1 277409 : étrier en U sur le bout -X de la vis, goujon d'entraînement. */
function buildJ1() {
  const x1 = WX0, t = 0.005, w = 0.078, h = 0.070, gap = 0.058;
  const U = [
    m(G.box(t, h, w, 0.002), 'zinc', { p: [x1 - t / 2, WY, WZ] }),
    m(G.box(t, h * 0.85, w, 0.002), 'zinc', { p: [x1 - gap - t / 2, WY - h * 0.075, WZ] }),
    m(G.box(gap + t, h * 0.85, t, 0.002), 'zinc', { p: [x1 - gap / 2 - t / 2, WY - h * 0.075, WZ + w / 2 - t / 2] }),
  ];
  const plate = part({ id: 'crane-j1-plate', sec: '10.1.1', item: '2', pn: '277564', fr: 'Étrier du codeur', en: 'Encoder plate', qty: '1', page: 47, explode: [0, 0, 0], approx: true }, U);
  const enc = part({ id: 'crane-j1-encoder', sec: '10.1.1', item: '1', pn: '269901', fr: 'Codeur rotatif J1', en: 'Rotary encoder J1', qty: '1', page: 47, explode: [-0.07, 0, 0], spare: true },
    [m(G.cyl(0.021, 0.030, 32), 'alu', { p: [x1 - 0.024, WY, WZ], r: [0, 0, 90] }),
     m(discR(0.024, 0.004, 32), 'alu', { p: [x1 - 0.008, WY, WZ], r: [0, 0, 90] }),
     m(G.cyl(0.0075, 0.018, 16), 'zinc', { p: [x1 - 0.026, WY, WZ - 0.028], r: [90, 0, 0] }),
     m(G.hex(0.017, 0.006), 'zinc', { p: [x1 - 0.026, WY, WZ - 0.021], r: [90, 0, 0] })]);
  const stud = part({ id: 'crane-j1-stud', sec: '10.1.1', item: '7', pn: '277425', fr: "Goujon d'entraînement", en: 'Drive stud', qty: '1', page: 47, explode: [-0.03, 0, 0] },
    [m(G.cyl(0.006, 0.026, 16), 'machined', { p: [x1 - 0.004, WY, WZ], r: [0, 0, 90] })]);
  const hw = [];
  for (const s of [-1, 1]) hw.push(bw([x1 - t, WY + 0.022, WZ + s * 0.026], [-1, 0, 0], 0.5 * IN, 1 * IN));
  for (const s of [-1, 1]) hw.push(nw([x1 - gap - t, WY - 0.02, WZ + s * 0.027], [-1, 0, 0], 0.138 * IN, { lock: true }));
  const jhw = part({ id: 'crane-j1-hw', sec: '10.1.1', item: '6', pn: 'B265', fr: 'Visserie', en: 'Hardware', qty: '-', page: 47, explode: [-0.10, 0.03, 0], note: 'Repères 3 (236667 x2), 4 (248143 x2), 5 (117753 x2), 6 (B265 x2).' }, hw);
  return asm({ id: 'crane-j1', sec: '10.1.1', item: '2', pn: '277409', fr: 'Codeur de rotation J1', en: 'J1 slew encoder', qty: '1', page: 47, explode: [-0.20, 0, 0] }, [plate, enc, stud, jhw]);
}

/* ------------------------------------------------------------------ */
/* 10.2 Base de levage 277068 (p. 48)                                   */
/* ------------------------------------------------------------------ */
function buildHoist() {
  const yF0 = Y1, yF1 = Y1 + 0.025;            // bride ronde 0,315 m (op79)
  const fl = new THREE.Shape(); fl.absarc(0, 0, 0.1575, 0, Math.PI * 2, false);
  const h12 = []; for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; h12.push({ c: [0.14 * Math.cos(a), 0.14 * Math.sin(a)], r: 0.0088 }); }
  const B = [m(tr(plateXZ(fl, 0.025, { holes: h12, curve: 48 }), SX, (yF0 + yF1) / 2, SZ), 'red')];
  // Flasques J2 (2) : z de ±0,0802 à ±0,1056 ; profil relevé sur op79
  const tw = 0.0254, zi = 0.0802;
  const prof = new THREE.Shape();
  prof.moveTo(-1.292, yF1); prof.lineTo(-1.0985, yF1); prof.lineTo(-1.098, 1.535); prof.lineTo(J2X + 0.056, J2Y - 0.02);
  prof.absarc(J2X, J2Y, 0.057, -0.36, Math.PI + 0.35, false); prof.lineTo(-1.292, yF1);
  prof.holes.push(circ(J2X, J2Y, 0.75 * IN + 0.0006));
  for (const s of [-1, 1]) B.push(m(tr(G.plate(prof, tw, { curve: 24 }), 0, 0, s * (zi + tw / 2)), 'red'));
  // Caisson entre flasques : âme avant inclinée, âme arrière, dessus
  B.push(m(G.box(0.012, 0.13, 2 * zi, 0.002), 'red', { p: [-1.104, yF1 + 0.065, 0], r: [0, 0, 8] }));
  B.push(m(G.box(0.012, 0.12, 2 * zi, 0.002), 'red', { p: [-1.276, yF1 + 0.06, 0], r: [0, 0, -12] }));
  B.push(m(G.box(0.17, 0.012, 2 * zi, 0.002), 'red', { p: [-1.19, 1.627, 0] }));
  // Chapes des pieds de vérins : traverse + 4 joues
  B.push(m(G.box(0.112, 0.025, 2 * ZE2[1], 0.003), 'red', { p: [LBX, 1.5275, 0] }));
  const ear = earShape(LBX - 0.05, LBX + 0.045, 1.515, LBX, LBY, 0.032);
  ear.holes.push(circ(LBX, LBY, 0.625 * IN + 0.0006), circ(LBX + 0.0243, LBY - 0.0223, 0.0068));
  for (const s of [-1, 1]) for (const [a, b] of [ZE1, ZE2]) B.push(m(tr(G.plate(ear, b - a, { curve: 20 }), 0, 0, s * (a + b) / 2), 'red'));
  for (const s of [-1, 1]) {
    B.push(weld([[-1.288, yF1 + 0.003, s * (zi - 0.002)], [-1.10, yF1 + 0.003, s * (zi - 0.002)]], 0.004));
    B.push(weld([[-1.288, yF1 + 0.003, s * (zi + tw + 0.002)], [-1.10, yF1 + 0.003, s * (zi + tw + 0.002)]], 0.004));
    B.push(weld([[LBX - 0.05, 1.5418, s * (ZE1[0] - 0.002)], [LBX + 0.045, 1.5418, s * (ZE1[0] - 0.002)]], 0.0035));
    B.push(weld([[LBX - 0.05, 1.5418, s * (ZE2[1] + 0.002)], [LBX + 0.045, 1.5418, s * (ZE2[1] + 0.002)]], 0.0035));
  }
  const base = part({ id: 'crane-hoist-base', sec: '10.2', item: '1', pn: '277067', fr: 'Base de levage usinée', en: 'Hoist base, machined', qty: '1', page: 48, explode: [0, 0, 0], approx: true, note: 'Profil des flasques relevé sur op79 ; caisson intérieur estimé.' }, B);

  const pinJ2 = part({ id: 'crane-hoist-pinj2', sec: '10.2', item: '7', pn: '277742', fr: 'Axe de levage J2', en: 'Hoist pin J2', qty: '1', page: 48, explode: [0, 0, -0.30] },
    [m(alongZ(lath([[0, -0.1125], [0.0185, -0.1125], [0.01905, -0.1115], [0.01905, 0.1095], [0.0185, 0.1105], [0, 0.1105]], 32)), 'machined', { p: [J2X, J2Y, 0] })]);
  const ret = part({ id: 'crane-hoist-plate', sec: '10.2', item: '8', pn: '277421', fr: "Plaque d'arrêt d'axe", en: 'Pin retaining plate', qty: '1', page: 48, explode: [0, 0, -0.36] },
    [m(G.box(0.022, 0.075, 0.006, 0.002), 'zinc', { p: [J2X - 0.030, J2Y, -0.1056 - 0.003] })]);
  const pins = [-1, 1].map((s, i) => part({ id: `crane-hoist-pin-${i + 1}`, sec: '10.2', item: '2', pn: '277266', fr: 'Axe de pied de vérin', en: 'Cylinder base pin', qty: '2', page: 48, explode: [0, 0, s * 0.22] },
    [cylPin(LBX, LBY, s, -0.0223)]));
  const hw = [];
  for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; hw.push(bw([SX + 0.14 * Math.cos(a), yF1, SZ + 0.14 * Math.sin(a)], [0, 1, 0], 0.625 * IN, 1.5 * IN)); }
  for (const s of [-1, 1]) hw.push(bw([LBX + 0.0243, LBY - 0.0223, s * (ZE2[1] + 0.006)], [0, 0, s], 0.5 * IN, 0.75 * IN));
  for (const dy of [-0.025, 0.025]) hw.push(bw([J2X - 0.030, J2Y + dy, -0.1056 - 0.006], [0, 0, -1], 0.375 * IN, 0.75 * IN));
  for (const s of [-1, 1]) hw.push(m(alongZ(ring(1 * IN, 0.76 * IN, 0.125 * IN)), 'bronze', { p: [J2X, J2Y, s * (0.077 + 0.0016)] }));
  for (const s of [-1, 1]) for (const zz of [ZE1[1] + 0.0008, ZE2[0] - 0.0008]) hw.push(m(alongZ(ring(1 * IN, 0.635 * IN, 0.0625 * IN)), 'bronze', { p: [LBX, LBY, s * zz] }));
  const hhw = part({ id: 'crane-hoist-hw', sec: '10.2', item: '12', pn: 'B343', fr: 'Visserie', en: 'Hardware', qty: '-', page: 48, explode: [0, 0.07, 0], note: 'Repères 3 (B263 x2), 4 (216795 x12), 5 (117753 x2), 6 (224166 x2), 9 (B140 x2), 10 (277428 x4), 11 (277431 x2), 12 (B343 x12, serrer à 216 lb-pi).' }, hw);
  return asm({ id: 'crane-hoist', sec: '10.2', item: '2', pn: '277068', fr: 'Base de levage', en: 'Hoist base', qty: '1', page: 48, explode: [0, 0.26, 0] }, [base, pinJ2, ret, ...pins, hhw]);
}

/* ------------------------------------------------------------------ */
/* 10.3.2 Flèche extérieure 276527 (p. 51, 52)                          */
/* ------------------------------------------------------------------ */
// faces du losange : normales (0, y, z)
const FACES = [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([a, b]) => V(0, a, b).normalize());
const faceName = ['dessus +Z', 'dessus -Z', 'dessous -Z', 'dessous +Z'];
const PU = [-0.012, 0.012, -0.012, 0.012];   // décalage des patins le long de la face
const PS = [0.060, -0.060, 0.060, -0.060];   // décalage des butées (vers une arête)
const XPT = -0.070, XPM = -0.506;            // patins : bout avant et mi-longueur (p. 51)
const across = (n) => V().crossVectors(V(1, 0, 0), n);
function onFace(f, x, r, u = 0) { return V(x, AY, 0).addScaledVector(FACES[f], r).addScaledVector(across(FACES[f]), u); }

function buildOuterBoom() {
  const B = [];
  B.push(m(diamond(SO, WO, XR, XFF - XFT), 'red'));
  // Bride avant carrée, ouverture en losange (passage de la flèche intérieure)
  const fl = G.rrect(0.29, 0.30, 0.02, 0, AY), hd = HO - WO * S2 + 0.001;
  const hole = new THREE.Path(); hole.moveTo(0, AY - hd); hole.lineTo(hd, AY); hole.lineTo(0, AY + hd); hole.lineTo(-hd, AY); hole.closePath(); fl.holes.push(hole);
  B.push(m(tr(plateYZ(fl, XFT, { curve: 8 }), XFF - XFT / 2, 0, 0), 'red'));
  const xw = XFF - XFT - 0.003, hw0 = HO + 0.003;
  B.push(weld([[xw, AY - hw0, 0], [xw, AY, hw0], [xw, AY + hw0, 0], [xw, AY, -hw0], [xw, AY - hw0, 0]], 0.0035));
  // Bossages des patins (8) : manchons soudés sur les faces
  for (let f = 0; f < 4; f++) for (const x of [XPT, XPM]) B.push(aim(m(ring(0.035, 0.0255, 0.0185, 32), 'red'), onFace(f, x, SO / 2 + 0.00825, PU[f]), FACES[f]));
  // Semelles + joues des pattes de tête des vérins de levage (z = ±0,15)
  for (const s of [-1, 1]) {
    B.push(m(plateXZ(G.stadium(0.32, 0.093), 0.02, { curve: 16 }), 'red', { p: [LRX - 0.01, AY - 0.025, s * 0.1515] }));
    const ear = earShape(LRX - 0.115, LRX + 0.17, AY - 0.035, LRX, LRY, 0.032);
    ear.holes.push(circ(LRX, LRY, 0.625 * IN + 0.0006), circ(LRX + 0.0243, LRY + 0.0223, 0.0068));
    for (const [a, b] of [ZE1, ZE2]) B.push(m(tr(G.plate(ear, b - a, { curve: 20 }), 0, 0, s * (a + b) / 2), 'red'));
    B.push(weld([[LRX - 0.16, AY - 0.0105, s * 0.1155], [LRX + 0.14, AY - 0.0105, s * 0.1155]], 0.0055));
  }
  // Pivot J2 : 2 goussets (z = ±0,0675), tube transversal, traverse basse
  const gz = 0.0675, gt = 0.019, gTop = AY - HO + gz;
  const gus = new THREE.Shape();
  gus.moveTo(-0.946, gTop); gus.lineTo(XR - 0.002, gTop); gus.lineTo(-1.362, 1.775); gus.lineTo(-1.398, 1.724);
  gus.lineTo(-1.372, 1.700); gus.lineTo(J2X - 0.030, 1.700); gus.absarc(J2X, J2Y, 0.044, -Math.PI / 2 - 0.75, 0.25, false);
  gus.lineTo(-1.006, 1.810); gus.closePath();
  gus.holes.push(circ(J2X, J2Y, 0.0362));
  for (const s of [-1, 1]) {
    B.push(m(tr(G.plate(gus, gt, { curve: 24 }), 0, 0, s * gz), 'red'));
    B.push(weld([[-0.95, gTop + 0.0045, s * (gz + gt / 2 + 0.0025)], [XR + 0.004, gTop + 0.0045, s * (gz + gt / 2 + 0.0025)]], 0.0055));
  }
  B.push(m(alongZ(ring(0.0365, 0.0223, 0.154, 36)), 'red', { p: [J2X, J2Y, 0] }));
  for (const s of [-1, 1]) B.push(m(G.torus(0.0372, 0.003, Math.PI * 2, 6, 40), 'red', { p: [J2X, J2Y, s * (gz - gt / 2 - 0.001)] }));
  B.push(m(G.box(0.085, 0.008, 2 * (gz - gt / 2), 0.002), 'red', { p: [-1.33, 1.704, 0] }));
  // Languette arrière (œil du pied du vérin télescopique) et 2 bras en V (vue de dessus p. 49)
  const tg = new THREE.Shape(); tg.moveTo(XR + 0.004, AY - 0.075); tg.lineTo(XTB, AY - 0.075); tg.lineTo(XTB, YT - 0.034);
  tg.absarc(XTB, YT, 0.034, -Math.PI / 2, Math.PI / 2, true); tg.lineTo(XR + 0.004, YT + 0.034); tg.closePath();
  tg.holes.push(circ(XTB, YT, 0.0205));
  B.push(m(tr(G.plate(tg, 0.019, { curve: 24 }), 0, 0, 0), 'red'));
  for (const s of [-1, 1]) {
    const a = V(XR - 0.002, AY - 0.064, s * 0.042), b = V(XTB + 0.012, AY - 0.064, s * 0.0095), d = b.clone().sub(a);
    B.push(frame([m(G.box(d.length(), 0.020, 0.008, 0.002), 'red')], a.clone().add(b).multiplyScalar(0.5).toArray(), d.toArray(), [0, 1, 0]));
  }
  // Cales soudées sous la flèche : pattes du bac de chaîne (2), plaque de raccords, colliers Stauff
  const vblock = (x0, x1, zA, zB, yb) => m(tr(plateYZ([[zA, yb], [zB, yb], [zB, AY - HO + Math.abs(zB) + 0.002], [0, AY - HO + 0.002], [zA, AY - HO + Math.abs(zA) + 0.002]], x1 - x0, { curve: 2 }), (x0 + x1) / 2, 0, 0), 'red');
  for (const xb of [-0.377, -0.867]) B.push(m(tr(plateYZ([[-0.141, AY - 0.088], [-0.105, AY - 0.088], [-0.105, AY - HO + 0.105 + 0.002], [-HO - 0.004, AY + 0.004], [-0.141, AY - 0.006]], 0.05, { curve: 2 }), xb, 0, 0), 'red'));
  B.push(vblock(-0.215, -0.155, -0.040, 0.020, AY - HO - 0.020));
  B.push(vblock(-0.685, -0.635, -0.066, 0.066, 1.745));
  const outer = part({ id: 'crane-outer-tube', sec: '10.3.2', item: '1', pn: '276535', fr: 'Flèche extérieure usinée', en: 'Outer boom, machined', qty: '1', page: 51, explode: [0, 0, 0], approx: true, note: 'Tube carré de 175 mm posé sur la pointe (coupe A-A p. 52). Longueur, pivot et pattes relevés p. 51 et op79.' }, B);

  const kids = [outer];
  [-1, 1].forEach((s, i) => kids.push(part({ id: `crane-outer-pin-${i + 1}`, sec: '10.3.2', item: '2', pn: '277266', fr: 'Axe de tête de vérin', en: 'Cylinder rod pin', qty: '2', page: 51, explode: [0, 0, s * 0.16] }, [cylPin(LRX, LRY, s, 0.0223)])));
  kids.push(part({ id: 'crane-outer-bearing', sec: '10.3.2', item: '5', pn: '227884', fr: 'Rotule 1 po', en: 'Spherical bearing 1 in', qty: '1', page: 52, explode: [0, 0.12, 0] },
    [m(alongZ(ring(0.0204, 0.0128, 0.0175)), 'steel', { p: [XTB, YT, 0] }), m(G.sphere(0.0165, 24), 'machined', { p: [XTB, YT, 0], s: [1, 1, 0.6] })]));
  kids.push(part({ id: 'crane-outer-pin1', sec: '10.3.2', item: '12', pn: '277585', fr: 'Axe 1 po', en: 'Pin 1 in', qty: '1', page: 52, explode: [0, 0, 0.16] },
    [m(alongZ(lath([[0, -0.0255], [0.0122, -0.0255], [0.0127, -0.0245], [0.0127, 0.0245], [0.0122, 0.0255], [0, 0.0255]], 24)), 'machined', { p: [XTB, YT, 0] })]));
  kids.push(part({ id: 'crane-outer-spacer', sec: '10.3.2', item: '14', pn: '277058', fr: 'Entretoise 1,75 po', en: 'Spacer 1.75 in', qty: '1', page: 52, explode: [0, -0.16, 0] },
    [m(alongZ(ring(0.0222, 0.0195, 0.0768)), 'steel', { p: [J2X, J2Y, 0] })]));
  [-1, 1].forEach((s, i) => kids.push(part({ id: `crane-outer-iglide-${i + 1}`, sec: '10.3.2', item: '16', pn: '280138', fr: 'Coussinet iglide', en: 'iglide sleeve bearing', qty: '2', page: 52, explode: [0, 0, s * 0.24] },
    [m(alongZ(ring(0.0222, 0.01915, 0.0381)), 'yellow', { p: [J2X, J2Y, s * (0.077 - 0.01905)] })])));
  for (let f = 0; f < 4; f++) {
    const n = FACES[f], c = onFace(f, -0.050, SO / 2 + 0.006, PS[f]);
    const blk = frame([m(G.plate(octa(0.064, 0.034, 0.008), 0.012), 'steel', { r: [90, 0, 0] })], c.toArray(), [1, 0, 0], n.toArray());
    kids.push(part({ id: `crane-outer-stopper-${f + 1}`, sec: '10.3.2', item: '17', pn: '277717', fr: 'Butée de flèche', en: 'Boom stopper', qty: '4', page: 51, explode: n.clone().multiplyScalar(0.05).add(V(0.05, 0, 0)).toArray().map(v => +v.toFixed(3)) }, [blk]));
  }
  let k = 0;
  for (const x of [XPT, XPM]) for (let f = 0; f < 4; f++) kids.push(buildPuck(++k, f, x));
  kids.push(buildStauff(), buildBulkhead());
  const hw = [];
  for (let f = 0; f < 4; f++) for (const dx of [-0.020, 0.020]) hw.push(bw(onFace(f, -0.050 + dx, SO / 2 + 0.012, PS[f]).toArray(), FACES[f].toArray(), 0.375 * IN, 0.75 * IN));
  for (const s of [-1, 1]) hw.push(bw([LRX + 0.0243, LRY + 0.0223, s * (ZE2[1] + 0.006)], [0, 0, s], 0.5 * IN, 1 * IN));
  for (const s of [-1, 1]) for (const zz of [ZE1[1] + 0.0008, ZE2[0] - 0.0008]) hw.push(m(alongZ(ring(1 * IN, 0.635 * IN, 0.0625 * IN)), 'bronze', { p: [LRX, LRY, s * zz] }));
  for (const s of [-1, 1]) hw.push(m(alongZ(ring(0.0150, 0.0127, 0.0012)), 'blackOxide', { p: [XTB, YT, s * 0.0215] }));
  for (let i = 0; i < 3; i++) { // brides en P 252433 (3) sous la traverse arrière, avec vis (10), rondelles (9), écrous (11)
    const x = -1.302 - i * 0.028, z = (i - 1) * 0.030 - 0.008;
    kids.push(part({ id: `crane-outer-pclamp-${i + 1}`, sec: '10.3.2', item: '8', pn: '252433', fr: 'Bride en P', en: 'P-clamp', qty: '3', page: 51, explode: [0, -0.10, 0] },
      [m(G.torus(0.0125, 0.0018, Math.PI * 1.65, 8, 24), 'zinc', { p: [x, 1.6852, z], r: [0, 90, 139] }),
       m(G.box(0.012, 0.0016, 0.024, 0.0005), 'zinc', { p: [x, 1.6992, z + 0.012] })]));
    hw.push(bw([x, 1.708, z + 0.016], [0, 1, 0], 0.25 * IN, 1.375 * IN));
    hw.push(nw([x, 1.6984, z + 0.016], [0, -1, 0], 0.25 * IN, { lock: true }));
  }
  kids.push(part({ id: 'crane-outer-hw', sec: '10.3.2', item: '7', pn: 'B140', fr: 'Visserie', en: 'Hardware', qty: '-', page: 52, explode: [0, -0.06, 0], approx: true, note: 'Repères 3 (224166 x10), 4 (B265 x2), 6 (277428 x4), 7 (B140 x8), 9 (W001 x6), 10 (B047 x3), 11 (262114 x3), 13 (277586 x2).' }, hw));
  return asm({ id: 'crane-outer', sec: '10.3.2', item: '1', pn: '276527', fr: 'Flèche extérieure', en: 'Outer boom', qty: '1', page: 51, explode: [0, 0, 0] }, kids);
}

/* 10.3.2.2 Patin d'usure 277656 (p. 54). Repère local : Y = normale de la face, origine sur l'axe de la flèche. */
const LOBES = [0, 1, 2].map(i => { const a = i * 2 * Math.PI / 3; return [0.031 * Math.cos(a), 0.031 * Math.sin(a)]; });
let PUCK_GEO = null;
function puckPlateGeo() {
  if (PUCK_GEO) return PUCK_GEO;
  const s = new THREE.Shape(), N = 96;
  for (let i = 0; i <= N; i++) {
    const a = i / N * 2 * Math.PI; let r = 0.029;
    for (const [lx, ly] of LOBES) { const d = a - Math.atan2(ly, lx); const sd = 0.031 * Math.sin(d); if (Math.abs(sd) < 0.0145) r = Math.max(r, 0.031 * Math.cos(d) + Math.sqrt(0.0145 ** 2 - sd ** 2)); }
    const px = r * Math.cos(a), py = r * Math.sin(a); i ? s.lineTo(px, py) : s.moveTo(px, py);
  }
  return (PUCK_GEO = G.plate(s, 0.012, { holes: [{ c: [0, 0], r: 0.0098 }, ...LOBES.map(c => ({ c, r: 0.0052 }))], curve: 16 }));
}
function buildPuck(k, f, x) {
  const n = FACES[f], rb = SO / 2 + 0.018;     // dessus du bossage soudé
  const plate = part({ id: `crane-puck-${k}-plate`, sec: '10.3.2.2', item: '7', pn: '277668', fr: 'Couvercle trilobé', en: 'Puck cover plate', qty: '1', page: 54, explode: [0, 0.06, 0] },
    [m(puckPlateGeo(), 'redDark', { p: [0, rb + 0.0065, 0], r: [90, 0, 0] })]);
  const puck = part({ id: `crane-puck-${k}-puck`, sec: '10.3.2.2', item: '2', pn: '277658', fr: "Patin d'usure", en: 'Wear puck', qty: '1', page: 54, explode: [0, 0, 0], spare: true },
    [m(lath([[0, 0], [0.0232, 0], [0.024, 0.001], [0.024, 0.014], [0.0222, 0.0155], [0.0222, 0.0175], [0.024, 0.019], [0.024, 0.0230], [0.0232, 0.024], [0, 0.024]], 32), 'polymer', { p: [0, SI / 2 + 0.0035, 0] })]);
  const disc = part({ id: `crane-puck-${k}-disc`, sec: '10.3.2.2', item: '1', pn: '277654', fr: 'Rondelle de poussée', en: 'Puck plate', qty: '1', page: 54, explode: [0, 0.03, 0] },
    [m(discR(0.0235, 0.003, 32), 'steel', { p: [0, SI / 2 + 0.0035 + 0.0255, 0] })]);
  const yTop = rb + 0.0125;
  const jam = grp([nut({ d: 0.75 * IN })], { p: [0, yTop, 0], s: [1, 0.5, 1] });
  const hw = [jam, aim(bolt({ d: 0.75 * IN, L: yTop + 0.0082 - (SI / 2 + 0.0035 + 0.027) }), V(0, yTop + 0.0082, 0), V(0, 1, 0))];
  for (const [lx, ly] of LOBES) hw.push(bw([lx, yTop, ly], [0, 1, 0], 0.375 * IN, 1.25 * IN));
  const vis = part({ id: `crane-puck-${k}-hw`, sec: '10.3.2.2', item: '4', pn: 'B414', fr: 'Visserie', en: 'Hardware', qty: '-', page: 54, explode: [0, 0.10, 0], note: 'Repères 3 (contre-écrou mince 3/4), 4 (B414), 5 (224166 x3), 6 (B146 x3).' }, hw);
  const a = asm({ id: `crane-puck-${k}`, sec: '10.3.2.2', item: '15', pn: '277656', fr: `Patin de flèche (${x === XPT ? 'avant' : 'milieu'}, ${faceName[f]})`, en: 'Boom wear puck', qty: '8', page: 54, explode: (n.y > 0 ? n.clone().multiplyScalar(0.11) : n.clone().multiplyScalar(0.05).add(V(0, -0.08, 0))).toArray().map(v => +v.toFixed(3)) }, [plate, puck, disc, vis]);
  a.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(V(1, 0, 0), n, across(n)));
  a.position.copy(V(x, AY, 0).addScaledVector(across(n), PU[f]));
  return a;
}

/* 10.3.2.3 Collier Stauff 277747 (p. 55) : pile suspendue sous la flèche, trous des boyaux selon X. */
let HALF_CLAMP = null;
function halfClampGeo() { // demi-coquille d'un collier deux lignes (encoches demi-rondes)
  if (HALF_CLAMP) return HALF_CLAMP;
  const cw = 0.064, hh = 0.0152, rh = 0.0105, g0 = 0.0004, s = new THREE.Shape();
  s.moveTo(-cw / 2, g0); for (const zc of [-0.016, 0.016]) { s.lineTo(zc - rh, g0); s.absarc(zc, g0, rh, Math.PI, 0, true); }
  s.lineTo(cw / 2, g0); s.lineTo(cw / 2, hh); s.lineTo(-cw / 2, hh); s.closePath();
  const g = G.plate(s, 0.032, { curve: 12 }); g.rotateY(Math.PI / 2); return (HALF_CLAMP = g);
}
function buildStauff() {
  const xc = -0.660, yTop = 1.745, lh = 0.032;
  const clamps = []; let k = 0;
  for (let layer = 0; layer < 2; layer++) for (const zc of [-0.0325, 0.0325]) {
    const yc = yTop - 0.006 - lh / 2 - layer * lh;
    const up = m(halfClampGeo(), 'polymer', { p: [xc, yc, zc] }), dn = m(halfClampGeo(), 'polymer', { p: [xc, yc, zc], r: [180, 0, 0] });
    clamps.push(part({ id: `crane-stauff-clamp-${++k}`, sec: '10.3.2.3', item: '1', pn: '249977', fr: 'Collier deux lignes', en: 'Two-line routing clamp', qty: '4', page: 55, explode: [0, -0.03 - layer * 0.035, 0] }, [up, dn]));
  }
  const plates = [yTop - 0.003, yTop - 0.006 - 2 * lh - 0.003].map((y, i) => part({ id: `crane-stauff-plate-${i + 1}`, sec: '10.3.2.3', item: '2', pn: '277746', fr: 'Plaque de collier', en: 'Clamp plate', qty: '2', page: 55, explode: [0, i ? -0.11 : 0, 0] },
    [m(G.box(0.034, 0.006, 0.132, 0.0025), 'zinc', { p: [xc, y, 0] })]));
  const yb = yTop - 0.012 - 2 * lh;
  const vis = part({ id: 'crane-stauff-hw', sec: '10.3.2.3', item: '3', pn: 'B089', fr: 'Visserie', en: 'Hardware', qty: '-', page: 55, explode: [0, -0.15, 0], note: 'Repères 3 (B089 x2), 4 (W002 x2).' },
    [-0.0325, 0.0325].map(z => bw([xc, yb, z], [0, -1, 0], 0.3125 * IN, 3 * IN)));
  return asm({ id: 'crane-stauff', sec: '10.3.2.3', item: '18', pn: '277747', fr: 'Collier de boyaux', en: 'Stauff clamp stack', qty: '1', page: 55, explode: [0, -0.12, 0] }, [...clamps, ...plates, vis]);
}

/* 10.3.2.1 Plaque de raccords 278120 (p. 53) sous le bout de la flèche, côté -Z. */
function buildBulkhead() {
  const x0 = -0.245, x1 = -0.125, yP = 1.703, z0 = -0.200, z1 = -0.046, t8 = 0.0064;
  const fx = [-0.230, -0.200, -0.170, -0.140], fz = [-0.088, -0.128], gx = [-0.230, -0.205, -0.180, -0.155], tie = [[-0.236, -0.108], [-0.134, -0.108]];
  const fh = fx.flatMap(x => fz.map(z => ({ c: [x, z], r: 0.0105 }))), th = tie.map(c => ({ c, r: 0.0035 }));
  const p8 = [m(tr(plateXZ(G.rrect(x1 - x0, z1 - z0, 0.006, (x0 + x1) / 2, (z0 + z1) / 2), t8, { holes: [...fh, ...th, ...gx.map(x => ({ c: [x, -0.180], r: 0.008 }))] }), 0, yP - t8 / 2, 0), 'zinc'),
    m(G.box(0.06, 1.795 - yP + t8, t8, 0.002), 'zinc', { p: [-0.185, (1.795 + yP - t8) / 2, -0.040 - t8 / 2] })];
  const plate = part({ id: 'crane-bh-plate', sec: '10.3.2.1', item: '8', pn: '277882', fr: 'Plaque de raccords', en: 'Bulkhead plate', qty: '1', page: 53, explode: [0, 0, 0], approx: true }, p8);
  const ribGeo = (y) => m(tr(plateXZ(G.rrect(0.112, 0.068, 0.004, -0.185, -0.108), 0.005, { holes: [...fh, ...th] }), 0, y, 0), 'zinc');
  const rib4 = part({ id: 'crane-bh-rib-a', sec: '10.3.2.1', item: '4', pn: '277955', fr: 'Plaque de renfort', en: 'Bulkhead rib plate', qty: '1', page: 53, explode: [0, 0.04, 0] }, [ribGeo(yP + 0.0025)]);
  const rib5 = part({ id: 'crane-bh-rib-b', sec: '10.3.2.1', item: '5', pn: '277957', fr: 'Plaque de renfort', en: 'Bulkhead rib plate', qty: '1', page: 53, explode: [0, -0.04, 0] }, [ribGeo(yP - t8 - 0.0025)]);
  const fits = []; let k = 0;
  for (const x of fx) for (const z of fz) {
    const g = grp([
      m(G.hex(0.022, 0.008), 'zinc', { p: [0, -t8 - 0.005 - 0.004, 0] }),
      m(G.cyl(0.0088, 0.030, 16), 'zinc', { p: [0, -0.002, 0] }),
      m(G.hex(0.022, 0.007), 'zinc', { p: [0, 0.0085, 0] }),
      grp([m(G.cyl(0.0078, 0.022, 16), 'zinc', { p: [0, 0.011, 0] }), m(G.hex(0.019, 0.008), 'zinc', { p: [0, 0.024, 0] })], { p: [0, 0.012, 0], r: [0, 0, -45] }),
    ], { p: [x, yP, z] });
    fits.push(part({ id: `crane-bh-fit-${++k}`, sec: '10.3.2.1', item: '3', pn: '2042-6-6', fr: 'Raccord de traversée 45°', en: '#6 JIC bulkhead 45°', qty: '8', page: 53, explode: [0, 0.08, 0] }, [g]));
  }
  const hw = [];
  for (const dx of [-0.017, 0.017]) hw.push(bw([-0.185 + dx, 1.775, -0.040 - t8], [0, 0, -1], 0.4375 * IN, 0.75 * IN));
  for (const [x, z] of tie) { hw.push(bw([x, yP + 0.005, z], [0, 1, 0], 0.25 * IN, 1 * IN)); hw.push(nw([x, yP - t8 - 0.005, z], [0, -1, 0], 0.25 * IN)); }
  for (const x of gx) hw.push(m(lath([[0.0048, -0.0045], [0.010, -0.0045], [0.010, -0.0032], [0.0082, -0.0032], [0.0082, 0.0032], [0.010, 0.0032], [0.010, 0.0045], [0.0048, 0.0045], [0.0048, -0.0045]], 20), 'rubber', { p: [x, yP - t8 / 2, -0.180] }));
  const vis = part({ id: 'crane-bh-hw', sec: '10.3.2.1', item: '2', pn: 'B203', fr: 'Visserie et passe-fils', en: 'Hardware and grommets', qty: '-', page: 53, explode: [0, -0.05, -0.05], note: 'Repères 1 (218014 x6), 2 (B203 x2), 6 (B044 x2), 7 (N015 x2), 9 (280159 x3), 10 (280160 x1).' }, hw);
  return asm({ id: 'crane-bulkhead', sec: '10.3.2.1', item: '19', pn: '278120', fr: 'Plaque de raccords de flèche', en: 'Boom bulkhead', qty: '1', page: 53, explode: [0, -0.16, -0.10] }, [plate, rib4, rib5, ...fits, vis]);
}

/* ------------------------------------------------------------------ */
/* 10.3 Flèche télescopique : intérieure, vérin 36 po, codeur, chaîne, patte */
/* ------------------------------------------------------------------ */
const LUGB = [30, 90, 150, 210, 270, 330].map(a => [0.065 * Math.cos(a * D2R), 0.065 * Math.sin(a * D2R)]); // (z, y)
const LPIN = [0.065 * Math.cos(240 * D2R), 0.065 * Math.sin(240 * D2R)], LLOCK = [0.044 * Math.cos(240 * D2R), 0.044 * Math.sin(240 * D2R)];

function buildInner() {
  const [, ty, tz] = TIP;
  const g = [m(diamond(SI, WO, XIR, XIF), 'red')];
  const fl = G.rrect(0.27, 0.27, 0.016, 0, AY);
  fl.holes.push(circ(0, AY, 0.03), circ(tz + LPIN[0], ty + LPIN[1], 0.0162));
  g.push(m(tr(plateYZ(fl, 0.5 * IN, { curve: 10 }), (XIF + XIFF) / 2, 0, 0), 'red'));
  const xw = XIF - 0.003, h = HI + 0.003;
  g.push(weld([[xw, AY - h, 0], [xw, AY, h], [xw, AY + h, 0], [xw, AY, -h], [xw, AY - h, 0]], 0.0035));
  for (let f = 0; f < 4; f++) { // bandes d'usure (vertes dans la CAO) sur les 4 faces
    const n = FACES[f], st = m(G.box(LI - 0.05, 0.003, 0.098, 0.001), 'green');
    st.position.copy(V((XIR + XIF) / 2 - 0.01, AY, 0).addScaledVector(n, SI / 2 + 0.0017));
    st.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(V(1, 0, 0), n, across(n)));
    g.push(st);
  }
  for (const s of [-1, 1]) g.push(m(G.box(0.07, 0.07, 0.012, 0.003), 'red', { p: [XTR + 0.005, YT, s * 0.026] }));
  g.push(m(alongZ(G.cyl(0.0127, 0.064, 20)), 'machined', { p: [XTR, YT, 0] }));
  return part({ id: 'crane-inner', sec: '10.3', item: '2', pn: '276502', fr: 'Flèche intérieure usinée', en: 'Inner boom, machined', qty: '1', page: 49, explode: [1.25, 0, 0], approx: true, note: "Tube carré de 148 mm sur la pointe ; bandes d'usure vertes (p. 49, op07) ; oreilles de l'œil de tige estimées." }, g);
}

function buildTele() {
  const Lp = XTR - XTB, g = [];
  for (const s of [-1, 1]) { const e = m(G.plate(earShape(-0.022, 0.022, 0.044, 0, 0, 0.022), 0.010, { holes: [{ c: [0, 0], r: 0.0128 }] }), 'black'); e.position.z = s * 0.0155; g.push(e); }
  g.push(m(G.box(0.044, 0.008, 0.041, 0.002), 'black', { p: [0, 0.040, 0] }));
  g.push(m(G.box(0.072, 0.07, 0.064, 0.005), 'alu', { p: [0, 0.079, 0] }));
  const od = 2.5 * IN, y0 = 0.114, y1 = y0 + 1.016;
  g.push(m(lath([[0, y0], [od / 2 + 0.002, y0], [od / 2 + 0.002, y0 + 0.02], [od / 2, y0 + 0.024], [od / 2, y1 - 0.004], [od / 2 + 0.0025, y1], [od / 2 + 0.0025, y1 + 0.02], [0.0175, y1 + 0.024], [0.0162, y1 + 0.024]], 32), 'black'));
  g.push(m(G.cyl(0.625 * IN, Lp - 0.022 - (y1 + 0.02), 28), 'chrome', { p: [0, (Lp - 0.022 + y1 + 0.02) / 2, 0] }));
  g.push(m(G.cyl(0.012, 0.022, 20), 'black', { p: [0, Lp - 0.020, 0] }));
  g.push(m(alongZ(ring(0.025, 0.0128, 0.032)), 'black', { p: [0, Lp, 0] }));
  g.push(m(G.sweep([[-0.036, 0.105, 0], [-0.0395, 0.13, 0], [-0.0395, 1.10, 0], [-0.034, 1.128, 0]], 0.005, { radial: 8 }), 'black'));
  const c = grp(g); between(c, [XTB, YT, 0], [XTR, YT, 0], 0);
  return part({ id: 'crane-tele', sec: '10.3', item: '3', pn: '278118', fr: 'Vérin télescopique 36 po', en: 'Telescopic cylinder 36 in', qty: '1', page: 49, explode: [0.35, 0.26, 0], approx: true, note: 'Course 36 po, alésage 2 po, tige 1 1/4 po. Sorti de 0,19 m dans cette pose ; bloc de valve au pied (p. 49).' }, [c]);
}

/* 10.3.4 Codeur de levage 277383 (p. 57), coaxial à l'axe J2, côté +Z. Support plié vissé sur le gousset. */
function buildHoistEncoder() {
  const zb = 0.1185, t = 0.003, xt = -1.276, yt = 1.800;
  const zm = (zb + 0.0802) / 2;
  const arm0 = V(J2X - 0.018, J2Y + 0.026, zb + t / 2), arm1 = V(xt, yt - 0.006, zb + t / 2), d = arm1.clone().sub(arm0);
  const P = [
    m(G.box(0.058, 0.058, t, 0.002), 'zinc', { p: [J2X, J2Y, zb + t / 2] }),
    frame([m(G.box(d.length() + 0.02, 0.026, t, 0.0012), 'zinc')], arm0.clone().add(arm1).multiplyScalar(0.5).toArray(), d.toArray(), [-d.y, d.x, 0]),
    m(G.box(0.05, t, zb + t - 0.077, 0.0012), 'zinc', { p: [xt, yt + t / 2, (zb + t + 0.077) / 2] }),
    m(G.box(0.05, 0.046, t, 0.0012), 'zinc', { p: [xt, yt - 0.023 + t, 0.077 + t / 2] }),
  ];
  const plate = part({ id: 'crane-henc-plate', sec: '10.3.4', item: '1', pn: '277379', fr: 'Support plié', en: 'Formed plate', qty: '1', page: 57, explode: [0, 0, 0], approx: true, note: `Plié en Z, vissé sur le gousset du pivot (z = ${zm.toFixed(3)} env.).` }, P);
  const ze = zb + t;
  const enc = part({ id: 'crane-henc-encoder', sec: '10.3.4', item: '2', pn: '269903', fr: 'Codeur rotatif J2', en: 'Rotary encoder J2', qty: '1', page: 57, explode: [0, 0, 0.06], spare: true },
    [m(alongZ(discR(0.022, 0.006, 32)), 'black', { p: [J2X, J2Y, ze + 0.003] }),
     m(G.box(0.040, 0.040, 0.034, 0.004), 'black', { p: [J2X, J2Y, ze + 0.006 + 0.017] }),
     m(G.cyl(0.0075, 0.018, 16), 'zinc', { p: [J2X + 0.028, J2Y + 0.008, ze + 0.024], r: [0, 0, 90] }),
     m(G.cyl(0.0075, 0.018, 16), 'zinc', { p: [J2X + 0.028, J2Y - 0.010, ze + 0.024], r: [0, 0, 90] })]);
  const stud = part({ id: 'crane-henc-stud', sec: '10.3.4', item: '6', pn: '269940', fr: "Goujon d'entraînement", en: 'Drive stud', qty: '1', page: 57, explode: [0, 0, 0.025] },
    [m(alongZ(G.cyl(0.006, 0.020, 16)), 'machined', { p: [J2X, J2Y, 0.1105 + 0.010] })]);
  const hw = [];
  for (const dx of [-0.016, 0.016]) hw.push(bw([xt + dx, yt - 0.022, 0.077 + t], [0, 0, 1], 0.25 * IN, 0.75 * IN));
  for (const s of [-1, 1]) hw.push(bw([J2X + s * 0.021, J2Y - s * 0.021, ze], [0, 0, 1], 0.138 * IN, 0.4375 * IN, { head: 'shcs' }));
  const vis = part({ id: 'crane-henc-hw', sec: '10.3.4', item: '7', pn: 'B042', fr: 'Visserie', en: 'Hardware', qty: '-', page: 57, explode: [0, 0.04, 0.03], note: 'Repères 3 (236667 x2), 4 (248143 x4), 5 (253708 x2), 7 (B042 x2), 8 (116142 x2).' }, hw);
  return asm({ id: 'crane-henc', sec: '10.3.4', item: '4', pn: '277383', fr: 'Codeur de levage J2', en: 'Hoist encoder J2', qty: '1', page: 57, explode: [0, 0.10, 0.20] }, [plate, enc, stud, vis]);
}

/* 10.3.1 Chaîne porte-câbles 279066 (p. 50) : plan vertical z = EZ0, brin bas dans le bac, boucle à l'arrière. */
function buildEchain() {
  const p = 0.060, hl = 0.056, wc = 0.085, tp = 0.0045, R = 0.0725;
  const yTray = AY - 0.032, yl = yTray + hl / 2 + 0.001, yu = yl + 2 * R;
  const xfe = -0.360, xme = 0.150, Ltot = 1.755, arc = Math.PI * R;
  const xc = (xme + xfe + arc - Ltot) / 2, Llow = xfe - xc;
  const at = (s) => {
    if (s < Llow) return [[xfe - s, yl], [-1, 0]];
    s -= Llow; if (s < arc) { const ph = s / R; return [[xc - R * Math.sin(ph), yl + R - R * Math.cos(ph)], [-Math.cos(ph), Math.sin(ph)]]; }
    s -= arc; return [[xc + s, yu], [1, 0]];
  };
  const sideGeo = G.plate(G.stadium(p * 1.22, hl), tp, { holes: [{ c: [p * 0.42, 0], r: 0.0065 }, { slot: [-0.012, 0, 0.004, 0], r: 0.0045 }], curve: 10 });
  const barGeo = G.box(0.014, 0.007, wc - 4 * tp - 0.002, 0.002, 1);
  const n = Math.round(Ltot / p), links = [];
  for (let i = 0; i < n; i++) {
    const [[x, y], [tx, ty]] = at((i + 0.5) * Ltot / n);
    const zo = wc / 2 - tp / 2 - (i % 2 ? tp + 0.0005 : 0);
    links.push(frame([m(sideGeo, 'plastic', { p: [0, 0, zo] }), m(sideGeo, 'plastic', { p: [0, 0, -zo] }),
      m(barGeo, 'plastic', { p: [0, hl / 2 - 0.006, 0] }), m(barGeo, 'plastic', { p: [0, -hl / 2 + 0.006, 0] })], [x, y, EZ0], [tx, ty, 0], [-ty, tx, 0]));
  }
  links.push(m(G.box(0.040, hl * 0.9, wc, 0.004), 'plastic', { p: [xfe + 0.016, yl, EZ0] }));
  links.push(m(G.box(0.040, hl * 0.9, wc, 0.004), 'plastic', { p: [xme - 0.016, yu, EZ0] }));
  const chain = part({ id: 'crane-echain-chain', sec: '10.3.1', item: '2', pn: '279067', fr: 'Chaîne porte-câbles', en: 'Cable chain PKK 241/75', qty: '1', page: 50, explode: [0, 0.07, 0], note: `1755 mm, ${n} maillons au pas de 60 mm, rayon 72,5 mm (relevé op79).` }, links);
  const xt0 = -1.020, xt1 = -0.320, xm = (xt0 + xt1) / 2;
  const T = [m(G.box(xt1 - xt0, 0.004, 0.107, 0.0015), 'zincClear', { p: [xm, yTray - 0.002, -0.1985] }),
    m(G.box(xt1 - xt0, 0.034, 0.004, 0.0015), 'zincClear', { p: [xm, yTray + 0.013, -0.250] }),
    m(G.box(xt1 - xt0, 0.018, 0.004, 0.0015), 'zincClear', { p: [xm, yTray + 0.005, -0.147] })];
  for (const xb of [-0.377, -0.867]) T.push(m(G.box(0.05, yTray - (AY - 0.088), 0.006, 0.002), 'zincClear', { p: [xb, (yTray + AY - 0.088) / 2, -0.144] }));
  const tray = part({ id: 'crane-echain-tray', sec: '10.3.1', item: '1', pn: '277946', fr: 'Bac de chaîne soudé', en: 'E-chain tray weldment', qty: '1', page: 50, explode: [0, 0, 0], approx: true }, T);
  const ym = yu - hl / 2 - 0.0005, xr = XIF - 0.0002;
  const F = [m(G.box(xr - (xme - 0.08), 0.004, 0.105, 0.0015), 'zinc', { p: [(xr + xme - 0.08) / 2, ym - 0.002, EZ0] }),
    m(G.box(0.004, ym - 1.95, 0.15, 0.0015), 'zinc', { p: [xr - 0.002, (ym + 1.95) / 2, -0.177] })];
  const formed = part({ id: 'crane-echain-plate', sec: '10.3.1', item: '6', pn: '279076', fr: 'Support plié', en: 'Formed plate', qty: '1', page: 50, explode: [0.05, 0.11, 0], approx: true }, F);
  const hw = [];
  for (const xb of [-0.377, -0.867]) for (const dy of [-0.014, 0.014]) hw.push(bw([xb, AY - 0.060 + dy, -0.147], [0, 0, -1], 0.4375 * IN, 0.75 * IN));
  for (const [xe, ye, yb] of [[xme - 0.016, yu, ym - 0.004], [xfe + 0.016, yl, yTray - 0.004]]) for (const dz of [-0.03, 0, 0.03]) {
    hw.push(bw([xe, ye + hl * 0.45, EZ0 + dz], [0, 1, 0], 0.005, 0.080));
    hw.push(nw([xe, yb, EZ0 + dz], [0, -1, 0], 0.005, { lock: true }));
  }
  const vis = part({ id: 'crane-echain-hw', sec: '10.3.1', item: '7', pn: '279078', fr: 'Visserie', en: 'Hardware', qty: '-', page: 50, explode: [0, 0.15, 0], note: 'Repères 3 (W001M x12), 4 (218014 x4), 5 (B203 x4), 7 (279078 M5x80 x6), 8 (241318 x6).' }, hw);
  return asm({ id: 'crane-echain', sec: '10.3.1', item: '5', pn: '279066', fr: 'Chaîne porte-câbles', en: 'E-chain assembly', qty: '1', page: 50, explode: [0, 0.30, -0.16] }, [tray, chain, formed, vis]);
}

/* 10.3.3 Patte de bout de flèche 278122 (p. 56) : face d'appui plane à x = TIP[0], centre (TIP[1], TIP[2]).
 * Têtes des 6 vis noyées (lamages) pour laisser la face libre à la plaque de poignet de la pince. */
function buildLug() {
  const [, ty, tz] = TIP, hs = 0.0825, c = 0.026, tf = 0.012;
  const at = ([z, y]) => [tz + z, ty + y];
  const outline = [[-hs + c, -hs], [hs - c, -hs], [hs, -hs + c], [hs, hs - c], [hs - c, hs], [-hs + c, hs], [-hs, hs - c], [-hs, -hs + c]].map(at);
  const front = m(tr(plateYZ(outline, tf, { holes: [{ c: at([0, 0]), r: 0.028 }, ...LUGB.map(b => ({ c: at(b), r: 0.0128 })), { slot: [...at(LPIN), ...at(LLOCK)], r: 0.0135 }] }), XLF - tf / 2, 0, 0), 'red');
  const back = m(tr(plateYZ(outline, XLF - tf - XLP, { holes: [{ c: at([0, 0]), r: 0.028 }, ...LUGB.map(b => ({ c: at(b), r: 0.0050 })), { c: at(LPIN), r: 0.0162 }, { c: at(LLOCK), r: 0.0050 }] }), (XLP + XLF - tf) / 2, 0, 0), 'red');
  const plate = part({ id: 'crane-lug-plate', sec: '10.3.3', item: '1', pn: '277349', fr: 'Plaque de patte usinée', en: 'Machined boom lug', qty: '1', page: 56, explode: [0, 0, 0], approx: true, note: "Face d'appui plane de la pince (L.boom.tip) ; contour et 6 vis d'après p. 56 ; vis noyées (estimé)." }, [front, back]);
  const [pz, py] = at(LPIN), xTab = XLF - tf;
  const pinw = part({ id: 'crane-lug-pin', sec: '10.3.3', item: '6', pn: '277365', fr: 'Axe soudé', en: 'Welded pin', qty: '1', page: 56, explode: [0.10, -0.03, 0] },
    [m(G.cyl(0.0159, 3.125 * IN, 28), 'machined', { p: [xTab - 3.125 * IN / 2, py, pz], r: [0, 0, 90] }),
     m(tr(plateYZ(slotShape(at(LPIN), at(LLOCK), 0.013), 0.003, { holes: [{ c: at(LLOCK), r: 0.0052 }] }), xTab + 0.0015, 0, 0), 'machined')]);
  const hw = [];
  for (const b of LUGB) {
    const [z, y] = at(b);
    hw.push(aim(grp([bolt({ d: 0.375 * IN, L: 2.25 * IN }), grp([washer({ d: 0.375 * IN, od: 0.024, t: 0.0024 })], { p: [0, -0.0024, 0] })]), V(xTab + 0.0024, y, z), V(1, 0, 0)));
    hw.push(m(alongX(ring(0.375 * IN, 0.0049, 1 * IN, 24)), 'zinc', { p: [XIFF + 0.5 * IN, y, z] }));
  }
  { const [z, y] = at(LLOCK); hw.push(bw([xTab + 0.003, y, z], [1, 0, 0], 0.375 * IN, 0.75 * IN)); }
  const vis = part({ id: 'crane-lug-hw', sec: '10.3.3', item: '2', pn: 'B151', fr: 'Visserie et entretoises', en: 'Hardware and spacers', qty: '-', page: 56, explode: [0.16, 0, 0], note: 'Repères 2 (B151 x6), 3 (B140 x1), 4 (218153 x6), 5 (224166 x1), 7 (entretoises 281190 x6).' }, hw);
  return asm({ id: 'crane-lug', sec: '10.3.3', item: '6', pn: '278122', fr: 'Patte de bout de flèche', en: 'Boom tip lug', qty: '1', page: 56, explode: [1.47, 0, 0] }, [plate, pinw, vis]);
}

function buildBoom() {
  return asm({ id: 'crane-boom', sec: '10.3', item: '1', pn: '276476', fr: 'Flèche télescopique', en: 'Telescopic boom', qty: '1', page: 49, explode: [0, 0.68, 0] },
    [buildOuterBoom(), buildInner(), buildTele(), buildHoistEncoder(), buildEchain(), buildLug()]);
}

/* ------------------------------------------------------------------ */
/* Vérins de levage 278117 (x2), coudes (repère 5) et raccords (repère 6) */
/* ------------------------------------------------------------------ */
function buildLiftCylinders() {
  const out = [];
  [1, -1].forEach((s, i) => {
    const a = [LBX, LBY, s * LZ], b = [LRX, LRY, s * LZ], Lp = V(...a).distanceTo(V(...b)), roll = s > 0 ? 0 : 180;
    const c = liftCylinder(Lp, -s); between(c, a, b, roll);
    out.push(part({ id: `crane-lift-${i + 1}`, sec: '10', item: '3', pn: '278117', fr: 'Vérin de levage', en: 'Lift cylinder', qty: '2', page: 45, explode: [0.04, 0.40, s * 0.42], approx: true, note: 'Course 8 1/2 po, alésage 2 1/2 po, tige 1 1/2 po. Pied à bloc à 2 orifices, tête à rotule (p. 45).' }, [c]));
    LC.ports.forEach(([px, py], j) => {
      const e = grp([aim(elbow({ d: 0.375 * IN }), V(px, py, 0.034), V(0, 0, 1), -90)]);
      between(e, a, b, roll);
      out.push(part({ id: `crane-elbow-${2 * i + j + 1}`, sec: '10', item: '5', pn: 'FA01052-06', fr: 'Coude 90° ORB-JIC', en: '90° elbow adapter', qty: '4', page: 45, explode: [0.04, 0.40, s * 0.50] }, [e]));
    });
  });
  return out;
}
function buildFittings6() { // raccords 6ORBM-6JICM (x2) sur le bloc de valve du vérin télescopique
  return [0, 1].map(i => part({ id: `crane-fit6-${i + 1}`, sec: '10', item: '6', pn: '202702-6-6', fr: 'Raccord droit', en: 'Straight fitting', qty: '2', page: 45, explode: [0.35, 0.68 + 0.26 + 0.06, 0] },
    [aim(fitting({ d: 0.375 * IN, L: 0.03 }), V(XTB + 0.079 + (i ? 0.018 : -0.018), YT + 0.036, 0), V(0, 1, 0))]));
}

export function build() {
  return asm({ id: 'lowerCrane', sec: '10', item: '4', pn: '276919', fr: 'Grue (mât)', en: 'Lower crane', qty: '1', page: 45, explode: [0, 0, 0] },
    [buildSlew(), buildHoist(), ...buildLiftCylinders(), ...buildFittings6(), buildBoom()]);
}
