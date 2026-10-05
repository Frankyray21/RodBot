/* RodBot LP, vue éclatée : socle (piédestal) 278249.
 * Manuel de pièces PM10654, section 14, p. 69 à 82 (dessins p. 69, 71, 72-73, 74, 75, 76, 77-78, 79, 80, 81, 82).
 * Repère monde (mètres) : Y vers le haut, socle à -X, panneau 24 V côté -Z, leviers de déplacement côté +Z.
 * Les sous-ensembles ne sont pas tournés, sauf le banc de valves 14.2.1 (tourné de -90° autour de Y) :
 * ses éclatements de niveau 4 sont donnés dans son repère local (z local = vers l'opérateur, donc -X monde).
 */
import { THREE, G, m, grp, aim, bolt, nut, washer, lever, weld, decal, labelMat, asm, part, IN, DEG } from '../kit.js';
import { L } from '../layout.js';

/* ------------------------------------------------------------------ */
/* Cotes du caisson                                                     */
/* ------------------------------------------------------------------ */
const X0 = L.pedestal.xMin;          // -1.47 : face avant de la poutre haute
const XF = -1.355;                   // face avant des montants (bas du caisson, en retrait de 115 mm, op. p. 79)
const XB = L.pedestal.xMax;          // -0.76 : face arrière (pattes de la rampe de garde du châssis)
const TBK = 0.0095;                  // plaque arrière 3/8 po
const ZW = L.pedestal.coreHalfWidth; // 0.45 : faces extérieures des flancs
const TW = 0.0127;                   // tôles 1/2 po (passe-fil 280957 : « pour tôle 1/2 po »)
const ZI = ZW - TW;                  // faces intérieures des flancs
const Y0 = L.pedestal.baseY;         // 0.658 : dessous de la semelle (dessus du châssis)
const YB = Y0 + 0.019;               // dessus de la semelle
const YT = L.pedestal.topY;          // 1.40 : dessus (couronne d'orientation)
const YTi = YT - 0.019;              // dessous de la plaque du dessus
const YBM = 1.22;                    // dessous de la poutre avant
const SX = L.slew.x, SZ = L.slew.z, SR = 0.19;  // cercle des 15 boulons (trous de la semelle de couronne, module grue)
const SLEW_TOP = YT + 0.015;         // têtes des boulons 15 sur la semelle de 15 mm de la couronne
const WIN = 0.27;                    // demi-largeur de l'ouverture avant
const PG = 69;
const DL_BY = 1.25;                  // vis du bloc de délestage (au-dessus de la barre de la rampe de garde)

/* Boulons de semelle (12 x 5/8) : alignés sur les 12 trous du plateau du châssis (module frame). */
const BASE_BOLTS = [[-1.11, -0.228], [-1.0, -0.228], [-0.89, -0.228], [-0.785, -0.228], [-1.11, 0.228], [-1.0, 0.228], [-0.89, 0.228], [-0.785, 0.228],
  [-1.11, -0.076], [-1.11, 0.076], [-0.785, -0.076], [-0.785, 0.076]];
/* Vis du support du panneau 24 V (module electrical) taraudées dans le flanc -Z. */
const P24_BOLTS = [-1.298, -1.078, -0.858].flatMap((x) => [[x, 0.8937], [x, 1.2583]]);

/* ------------------------------------------------------------------ */
/* Outils locaux                                                        */
/* ------------------------------------------------------------------ */
const v3 = (a) => (a.isVector3 ? a.clone() : new THREE.Vector3(...a));
const add = (a, b, s = 1) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
function bx(x0, x1, y0, y1, z0, z1, mk, r = 0.002, seg = 2) {
  return m(G.box(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0), r, seg), mk, { p: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2] });
}
function cylA(p, dir, r, h, mk, seg = 24, rTop = r) { const g = G.cyl(r, h, seg, rTop); g.translate(0, h / 2, 0); return aim(m(g, mk), p, dir); }
function hexA(p, dir, af, h, mk, hole = 0) { const g = G.hex(af, h, hole); g.translate(0, h / 2, 0); return aim(m(g, mk), p, dir); }
function lathA(p, dir, prof, mk, seg = 28) { return aim(m(G.lathe(prof, seg), mk), p, dir); }
function discA(p, dir, r, h, mk, seg = 32) { const g = G.disc(r, h, seg); g.translate(0, h / 2, 0); return aim(m(g, mk), p, dir); }
/** Oriente obj : +Y local vers yDir, +X local vers xDir (orthogonalisé). */
function frameAt(obj, p, yDir, xDir) {
  const Y = v3(yDir).normalize(); const X = v3(xDir); X.addScaledVector(Y, -X.dot(Y)).normalize();
  const Z = new THREE.Vector3().crossVectors(X, Y);
  obj.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z)); obj.position.copy(v3(p)); return obj;
}
/** Contour polygonal à coins arrondis (r nombre ou tableau). */
function rpoly(pts, r) {
  const s = new THREE.Shape(), n = pts.length;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], rr = Array.isArray(r) ? r[i] : r;
    const d1 = [p0[0] - p1[0], p0[1] - p1[1]], d2 = [p2[0] - p1[0], p2[1] - p1[1]];
    const l1 = Math.hypot(...d1), l2 = Math.hypot(...d2), k = Math.min(rr, l1 / 2.01, l2 / 2.01);
    const a = [p1[0] + d1[0] / l1 * k, p1[1] + d1[1] / l1 * k], b = [p1[0] + d2[0] / l2 * k, p1[1] + d2[1] / l2 * k];
    if (i === 0) s.moveTo(a[0], a[1]); else s.lineTo(a[0], a[1]);
    if (k > 0) s.quadraticCurveTo(p1[0], p1[1], b[0], b[1]);
  }
  s.closePath(); return s;
}
/* Plaques : contour 2D en coordonnées monde. */
function plXY(outline, z0, z1, mk, holes = []) { return m(G.plate(outline, z1 - z0, { holes }), mk, { p: [0, 0, (z0 + z1) / 2] }); }
function plZY(outline, x0, x1, mk, holes = []) { const g = G.plate(outline, x1 - x0, { holes }); g.rotateY(-Math.PI / 2); return m(g, mk, { p: [(x0 + x1) / 2, 0, 0] }); }
function plXZ(outline, y0, y1, mk, holes = []) { const g = G.plate(outline, y1 - y0, { holes }); g.rotateX(Math.PI / 2); return m(g, mk, { p: [0, (y0 + y1) / 2, 0] }); }
/* Visserie : p = surface d'appui, dir = côté de la tête. */
function bAt(p, dir, o = {}) { const d = o.d ?? 0.5 * IN; const D = v3(dir).normalize(); return aim(bolt(o), v3(p).addScaledVector(D, o.washer ? 0.12 * d : 0), D); }
function nAt(p, dir, o = {}) { return aim(nut(o), v3(p), v3(dir).normalize()); }
function wAt(p, dir, o = {}) { return aim(washer(o), v3(p), v3(dir).normalize()); }
/** Écrou + rondelle côté opposé. */
function nutStack(p, dir, d, lock = false) { const D = v3(dir).normalize(); return [wAt(p, D, { d }), nAt(v3(p).addScaledVector(D, 0.12 * d), D, { d, lock })]; }

/* Raccords hydrauliques (dash = taille JIC en 1/16 po). */
function fitDims(dash) {
  const d = dash / 16 * IN;
  return { d, af: d * 1.25 + 0.010, hH: 0.006 + d * 0.35, Ln: 0.010 + d * 0.9, rn: d * 0.5 + 0.0015 };
}
const jicLen = (dash) => { const f = fitDims(dash); return f.hH + f.Ln; };
/** Raccord droit ORB-JIC mâle, le long de dir depuis la face du port p. */
function jic(dash, p, dir, mk = 'zinc') {
  const { af, hH, Ln, rn } = fitDims(dash);
  const g = grp([
    m(G.hex(af, hH), mk, { p: [0, hH / 2, 0] }),
    m(G.lathe([[0, hH], [rn * 0.9, hH], [rn * 0.9, hH + Ln * 0.25], [rn, hH + Ln * 0.3], [rn, hH + Ln * 0.85], [rn * 0.8, hH + Ln], [0, hH + Ln]], 20), mk),
  ]);
  return aim(g, v3(p), v3(dir));
}
/** Coude (90° ou 45°) : entrée selon yDir depuis p, sortie vers xDir. Renvoie { g, tip, dir }. */
function elbowFit(dash, p, yDir, xDir, { ang = 90, mk = 'zinc', fem = false } = {}) {
  const { d, af, hH, Ln, rn } = fitDims(dash);
  const rb = af * 0.42, yb = hH + d * 0.9 + 0.006;
  const a = ang * DEG, od = [Math.sin(a), Math.cos(a), 0]; // direction de sortie dans le plan local XY
  const parts = [
    m(G.hex(af, hH), mk, { p: [0, hH / 2, 0] }),
    m(G.lathe([[0, hH], [rb, hH], [rb, yb + rb * 0.25], [rb * 0.72, yb + rb * 0.85], [0, yb + rb]], 20), mk),
  ];
  const boss = m(G.cyl(rb * 0.86, rb + 0.004, 18), mk); boss.position.set(od[0] * (rb + 0.004) / 2, yb + od[1] * (rb + 0.004) / 2, 0);
  boss.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v3(od)); parts.push(boss);
  const s0 = rb + 0.004;
  const nose = fem
    ? m(G.hex(af * 0.95, Ln * 0.8), mk)
    : m(G.lathe([[0, 0], [rn * 0.9, 0], [rn, Ln * 0.2], [rn, Ln * 0.85], [rn * 0.8, Ln], [0, Ln]], 20), mk);
  if (fem) nose.geometry.translate(0, Ln * 0.4, 0);
  nose.position.set(od[0] * s0, yb + od[1] * s0, 0); nose.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v3(od)); parts.push(nose);
  const g = frameAt(grp(parts), p, yDir, xDir);
  g.updateMatrixWorld(true);
  const loc = (q) => v3(q).applyQuaternion(g.quaternion).add(g.position);
  const tipL = [od[0] * (s0 + (fem ? Ln * 0.8 : Ln)), yb + od[1] * (s0 + (fem ? Ln * 0.8 : Ln)), 0];
  const tip = loc(tipL); const dir = v3(od).applyQuaternion(g.quaternion);
  return { g, tip: tip.toArray(), dir: dir.toArray() };
}
/** Boyau (ou tube rigide) le long de points ; embouts sertis aux bouts (le dernier point = bout du raccord). */
function hoseP(pts, { d = 0.375 * IN, mk = 'hose', tube = false, radial = 12, ends = [true, true] } = {}) {
  const r = tube ? d / 2 : d / 2 + 0.003;
  const P = pts.map(v3);
  const curve = new THREE.CatmullRomCurve3(P, false, 'centripetal');
  const n = Math.max(10, Math.ceil(curve.getLength() / 0.01));
  const out = [m(new THREE.TubeGeometry(curve, n, r, radial, false), mk)];
  const endPt = [[P[0], curve.getTangent(0).negate()], [P[P.length - 1], curve.getTangent(1)]];
  endPt.forEach(([a, dir], i) => {
    if (!ends[i]) return;
    const f = tube
      ? grp([m(G.hex(r * 2.9, 0.016), 'zinc', { p: [0, 0.008, 0] }), m(G.cyl(r * 1.15, 0.01, 16), 'zinc', { p: [0, -0.004, 0] })])
      : grp([m(G.lathe([[0, 0], [r * 1.22, 0], [r * 1.22, 0.026], [r * 1.05, 0.031], [0, 0.031]], 18), 'zincClear'), m(G.hex(r * 2.3, 0.014), 'zincClear', { p: [0, 0.038, 0] })]);
    aim(f, a.clone().addScaledVector(dir, tube ? -0.016 : -0.045), dir); out.push(f);
  });
  return out;
}
/** Matériau d'étiquette avec clé unique (sinon finalize fusionnerait deux étiquettes de même fond). */
function lblMat(key, o) { const mt = labelMat(o); mt.userData.key = 'label:ped:' + key; return mt; }
function lbl(key, o) { const d = decal(o); d.material.userData.key = 'label:ped:' + key; return d; }
function roundLbl(key, r, p, rot, draw, bg = '#ffffff') {
  const o = new THREE.Mesh(new THREE.CircleGeometry(r, 40), lblMat(key, { text: '', w: 1, h: 1, bg, draw, px: 512 }));
  o.position.copy(v3(p)); o.rotation.set(rot[0] * DEG, rot[1] * DEG, rot[2] * DEG); return o;
}
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
/** Grille de pictogrammes (commandes hydrauliques), fond blanc, cases noires. */
function pictos(rows, cols, kind) {
  return (ctx, W, H) => {
    ctx.fillStyle = '#f2f2ee'; ctx.fillRect(0, 0, W, H);
    const pad = H * 0.04, cw = (W - 2 * pad) / cols, ch = (H - 2 * pad) / rows;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const x = pad + i * cw + cw * 0.05, y = pad + j * ch + ch * 0.05, w = cw * 0.9, h = ch * 0.9;
      ctx.fillStyle = '#121212'; rr(ctx, x, y, w, h, w * 0.12); ctx.fill();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(2, w * 0.07); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath();
      if (kind === 'crane') { // mât et pince
        ctx.moveTo(x + w * 0.22, y + h * 0.86); ctx.lineTo(x + w * 0.22, y + h * 0.32); ctx.lineTo(x + w * 0.74, y + h * 0.32); ctx.lineTo(x + w * 0.74, y + h * 0.56);
        ctx.moveTo(x + w * 0.62, y + h * 0.78); ctx.lineTo(x + w * 0.74, y + h * 0.58); ctx.lineTo(x + w * 0.86, y + h * 0.78);
      } else { // chenille / stabilisateur
        ctx.moveTo(x + w * 0.2, y + h * 0.62); ctx.lineTo(x + w * 0.8, y + h * 0.62); ctx.arc(x + w * 0.8, y + h * 0.72, h * 0.1, -Math.PI / 2, Math.PI / 2); ctx.lineTo(x + w * 0.2, y + h * 0.82); ctx.arc(x + w * 0.2, y + h * 0.72, h * 0.1, Math.PI / 2, Math.PI * 1.5);
      }
      ctx.stroke();
      // flèche de mouvement (différente selon la case)
      const ax = x + w * (0.3 + 0.08 * (i % 4)), ay = y + h * (j === 0 ? 0.18 : 0.2), s = j === 0 ? 1 : -1;
      ctx.beginPath(); ctx.moveTo(ax - w * 0.14, ay); ctx.lineTo(ax + w * 0.14, ay); ctx.moveTo(ax + s * w * 0.14, ay); ctx.lineTo(ax + s * w * 0.06, ay - h * 0.06); ctx.moveTo(ax + s * w * 0.14, ay); ctx.lineTo(ax + s * w * 0.06, ay + h * 0.06); ctx.stroke();
    }
  };
}

/* ------------------------------------------------------------------ */
/* Banc de valves HAWE (sections empilées, tiroirs verticaux).          */
/* Repère local : x = empilage, y = haut, z = vers l'opérateur.          */
/* Corps en z ∈ [-depth, 0] ; leviers en haut, vers +z ; ports à l'arrière. */
/* ------------------------------------------------------------------ */
function haweBank({ n, pitch, yTop, depth = 0.085, wi = 0.07, we = 0.026, levers = [], leverL = 0.12, coverH = 0.12, rearAux = false }) {
  const steel = [], blk = [], misc = [];
  const y = (dy) => yTop + dy;
  // section d'entrée (x de -wi à 0), plus haute vers le bas
  steel.push(bx(-wi + 0.0006, -0.0006, y(-0.17 - coverH - 0.02), y(-0.012), -depth - 0.005, 0, 'steel', 0.003));
  const cx = -wi / 2, cz = -depth * 0.5;
  misc.push(hexA([cx, y(-0.012), cz], [0, 1, 0], 0.024, 0.012, 'zinc'));
  misc.push(cylA([cx, y(0), cz], [0, 1, 0], 0.0095, 0.03, 'zinc', 20));
  misc.push(hexA([cx, y(0.03), cz], [0, 1, 0], 0.017, 0.007, 'zinc'));
  misc.push(cylA([cx, y(0.037), cz], [0, 1, 0], 0.004, 0.014, 'machined', 12));
  for (let k = 0; k < n; k++) {
    const xc = (k + 0.5) * pitch, hw = pitch / 2 - 0.0007;
    steel.push(bx(xc - hw, xc + hw, y(-0.17), y(-0.045), -depth, 0, 'steel', 0.0025));                     // bloc des ports
    blk.push(bx(xc - 0.0175, xc + 0.0175, y(-0.044), y(-0.004), -0.032, 0.024, 'black', 0.004));          // boîtier de levier
    blk.push(bx(xc - 0.0185, xc + 0.0185, y(-0.044), y(0), -depth + 0.003, -0.036, 'black', 0.004));      // capot arrière
    steel.push(bx(xc - 0.0165, xc + 0.0165, y(-0.17 - coverH), y(-0.17), -depth + 0.012, -0.012, 'steel', 0.004)); // couvercle bas
    for (const sx of [-0.009, 0.009]) misc.push(cylA([xc + sx, y(0), -depth * 0.7], [0, 1, 0], 0.0026, 0.002, 'blackOxide', 10));
    misc.push(cylA([xc - 0.0178, y(-0.024), 0.012], [1, 0, 0], 0.0035, 0.0356, 'machined', 12));           // axe du levier
  }
  const xe = n * pitch;
  steel.push(bx(xe + 0.0006, xe + we, y(-0.17 - coverH - 0.01), y(-0.02), -depth, 0, 'steel', 0.003));
  blk.push(bx(xe + we, xe + we + 0.02, y(-0.2), y(-0.15), -0.068, -0.02, 'plastic', 0.003));              // connecteur
  for (const [dy, dz] of [[-0.05, -0.02], [-0.05, -0.065], [-0.24, -0.02], [-0.24, -0.065]]) misc.push(hexA([xe + we, y(dy), dz], [1, 0, 0], 0.013, 0.008, 'zinc'));
  const lv = [];
  for (const o of levers) {
    const xc = (o.k + 0.5) * pitch + (o.dx || 0), a = (o.tilt || 0) * DEG;
    lv.push(aim(lever({ L: o.L || leverL, knob: 0.021 }), [xc, y(-0.024), 0.012], [0, Math.sin(a), Math.cos(a)]));
  }
  const ports = { work: [] };
  for (let k = 0; k < n; k++) { const xc = (k + 0.5) * pitch; ports.work.push({ k, p: [xc, y(-0.085), -depth], dir: [0, 0, -1] }, { k, p: [xc, y(-0.14), -depth], dir: [0, 0, -1] }); }
  ports.P = { p: [-wi * 0.73, y(-0.17 - coverH + 0.007), -depth - 0.005], dir: [0, 0, -1] };
  ports.T = { p: [-wi * 0.19, y(-0.17 - coverH + 0.007), -depth - 0.005], dir: [0, 0, -1] };
  ports.G = rearAux ? { p: [-wi * 0.5, y(-0.035), -depth - 0.005], dir: [0, 0, -1] } : { p: [-wi, y(-0.088), -depth * 0.5], dir: [-1, 0, 0] };
  ports.LS = rearAux ? { p: [-wi * 0.5, y(-0.085), -depth - 0.005], dir: [0, 0, -1] } : { p: [-wi, y(-0.2), -depth * 0.5], dir: [-1, 0, 0] };
  return { meshes: [...steel, ...blk, ...misc, ...lv], ports };
}

/* ------------------------------------------------------------------ */
/* 4 : caisson mécano-soudé 276769                                      */
/* ------------------------------------------------------------------ */
function weldment() {
  const red = [];
  const baseOutline = rpoly([[-1.41, -0.505], [XB, -0.505], [XB, 0.505], [-1.41, 0.505], [-1.41, 0.15], [-1.475, 0.15], [-1.475, -0.15], [-1.41, -0.15]],
    [0.012, 0.012, 0.012, 0.012, 0.008, 0.012, 0.012, 0.008]);
  const baseHoles = BASE_BOLTS.map(([x, z]) => ({ c: [x, z], r: 0.0087 }))
    .concat(TETHER_BOLTS.map(([x, z]) => ({ c: [x, z], r: 0.0048 })));
  red.push(plXZ(baseOutline, Y0, YB, 'red', baseHoles));
  // flancs ±Z : bas en retrait, haut en porte-à-faux vers l'avant (poutre)
  const wallPts = [[XF, YB], [XB, YB], [XB, YTi], [X0, YTi], [X0, YBM], [XF, YBM]];
  const wallR = [0.001, 0.001, 0.003, 0.004, 0.004, 0.03];
  red.push(plXY(rpoly(wallPts, wallR), -ZW, -ZI, 'red', [
    { c: [-1.432, 1.245], r: 0.0095 },                                           // passe-fil 26
    { c: [-1.415, 1.262], r: 0.0025 }, { c: [-1.385, 1.262], r: 0.0025 }, { c: [-1.40, 1.328], r: 0.0025 }, // support de gyrophare
    ...P24_BOLTS.map((c) => ({ c, r: 0.0048 })),
  ]));
  red.push(plXY(rpoly(wallPts, wallR), ZI, ZW, 'red', [
    { c: [-1.10, 0.97], r: 0.012 }, { c: [-0.94, 0.97], r: 0.012 },              // passages de câbles
  ]));
  // plaque arrière avec grande fenêtre
  red.push(plZY(G.rrect(2 * ZI, YTi - YB, 0.001, 0, (YB + YTi) / 2), XB - TBK, XB, 'red', [{ rect: [0, 0.93, 0.30, 0.38, 0.03] },
    { c: [-0.375, DL_BY], r: 0.0045 }, { c: [-0.305, DL_BY], r: 0.0045 },
    ...[-0.18, 0.18].flatMap((z) => [{ c: [z, 0.968], r: 0.0055 }, { c: [z, 0.992], r: 0.0055 }])]));
  // montants avant (de part et d'autre de l'ouverture du panneau)
  for (const s of [-1, 1]) {
    const holes = [{ c: [s * 0.285, 0.897], r: 0.0048 }, { c: [s * 0.285, 1.11], r: 0.0048 }];
    if (s > 0) holes.push({ c: [0.345, 1.0], r: 0.0035 }, { c: [0.375, 1.0], r: 0.0035 });
    red.push(plZY(G.rrect(ZI - WIN, YBM - YB, 0.002, s * (ZI + WIN) / 2, (YB + YBM) / 2), XF, XF + TW, 'red', holes));
  }
  // poutre avant : dessous et face avant (lumière oblongue)
  red.push(plXZ(G.rrect(XF + TW - X0, 2 * ZI, 0.001, (X0 + XF + TW) / 2, 0), YBM, YBM + 0.0127, 'red'));
  red.push(plZY(G.rrect(2 * ZI, YTi - YBM - 0.0127, 0.001, 0, (YBM + 0.0127 + YTi) / 2), X0, X0 + TW, 'red', [{ slot: [-0.19, 1.305, 0.19, 1.305], r: 0.036 }]));
  // plaque du dessus : trou central (boyaux) et 15 trous de la couronne
  const topHoles = [{ c: [SX, SZ], r: 0.10 }];
  for (let i = 0; i < 15; i++) { const a = (i + 0.5) * 2 * Math.PI / 15; topHoles.push({ c: [SX + SR * Math.cos(a), SZ + SR * Math.sin(a)], r: 0.0087 }); }
  red.push(plXZ(G.rrect(XB - X0, 2 * ZW, 0.004, (X0 + XB) / 2, 0), YTi, YT, 'red', topHoles));
  // anneau usiné sous la plaque du dessus : reçoit les 15 vis de la couronne (taraudage)
  red.push(m(G.tube(0.232, 0.112, YTi - 1.31, 64, 0.002), 'red', { p: [SX, (YTi + 1.31) / 2, SZ] }));
  red.push(weld([[SX + 0.2335, YTi - 0.003, SZ]].concat(Array.from({ length: 48 }, (_, i) => { const a = (i + 1) / 48 * 2 * Math.PI; return [SX + 0.2335 * Math.cos(a), YTi - 0.003, SZ + 0.2335 * Math.sin(a)]; })), 0.0035));
  // traverse intérieure (support de la plaque de raccords tournants)
  red.push(bx(-1.17, -1.13, 0.845, 0.857, -ZI, ZI, 'red', 0.002));
  // cordons de soudure visibles
  const wr = 0.0045, o = wr * 0.55;
  red.push(weld([[XF, YB + o, -ZW - o], [XB, YB + o, -ZW - o]], wr));
  red.push(weld([[XF, YB + o, ZW + o], [XB, YB + o, ZW + o]], wr));
  red.push(weld([[XF + TW, YB + o, -ZI + o], [XB - TBK, YB + o, -ZI + o]], wr));
  red.push(weld([[XF + TW, YB + o, ZI - o], [XB - TBK, YB + o, ZI - o]], wr));
  red.push(weld([[XB - TBK - o, YB + o, -ZI], [XB - TBK - o, YB + o, ZI]], wr));
  for (const s of [-1, 1]) red.push(weld([[XF - o, YB + o, s * WIN], [XF - o, YB + o, s * ZW]], wr));
  for (const s of [-1, 1]) red.push(weld([[X0 + TW + o, YBM + 0.0127 + o, s * (ZI - 0.002)], [XF, YBM + 0.0127 + o, s * (ZI - 0.002)]], 0.003));
  return part({ id: 'ped-weldment', sec: '14', item: '4', pn: '276769', fr: 'Caisson du socle (mécano-soudé)', en: 'Pedestal weldment', qty: '1', page: PG, explode: [0, 0, 0],
    note: 'PIPE HANDLER MNT MACH. Semelle, flancs, poutre avant à lumière oblongue, dessus percé pour la couronne. Largeur selon layout (le dessin p. 69 donne un caisson plus étroit). Trous des pattes de la rampe de garde (châssis) dans la plaque arrière.' }, red);
}

/* ------------------------------------------------------------------ */
/* 14.2 : panneau de commande à leviers 276788 (+ banc 14.2.1)          */
/* ------------------------------------------------------------------ */
const PX1 = XF, PX0 = XF - 0.00635; // plaque 1/4 po contre les montants
const PFZ = PX0 - 0.0007;            // plan des étiquettes
const BK = { zStart: -0.178, yTop: 1.188, pitch: 0.0486, n: 7, depth: 0.085 };
const toW2 = ([x, y, z]) => [XF - z, y, BK.zStart + x];
const dirW2 = ([x, y, z]) => [-z, y, x];
const GAUGE = { z: 0, y: 0.850 }, ESTOP = { z: -0.144, y: 0.867 }, SWITCH = { z: 0.138, y: 0.870 };

function panelOutline() {
  const pts = [[-0.30, 1.14], [-0.30, 0.870], [-0.183, 0.823], [-0.0372, 0.823]];
  const a0 = Math.atan2(0.823 - GAUGE.y, -0.0372), a1 = Math.atan2(0.823 - GAUGE.y, 0.0372);
  for (let i = 1; i < 10; i++) { const a = a0 + (a1 - a0) * i / 10; pts.push([0.046 * Math.cos(a), GAUGE.y + 0.046 * Math.sin(a)]); }
  pts.push([0.0372, 0.823], [0.183, 0.823], [0.30, 0.870], [0.30, 1.14]);
  const n = pts.length;
  return rpoly(pts, pts.map((p, i) => (i === 0 || i === n - 1) ? 0.012 : (i === 1 || i === 2 || i === n - 2 || i === n - 3) ? 0.02 : 0));
}

function bankValveMount() {
  const levers = [{ k: 0, tilt: 17, dx: -0.009 }, { k: 0 }, { k: 0, tilt: -17, dx: 0.009 }, { k: 1 }, { k: 2 }, { k: 3 }, { k: 4 }, { k: 5 }, { k: 6, dx: -0.006 }, { k: 6, tilt: 21, dx: 0.007, L: 0.15 }];
  const b = haweBank({ n: BK.n, pitch: BK.pitch, yTop: BK.yTop, depth: BK.depth, levers, leverL: 0.12 });
  const W = b.ports.work;
  const f66 = [], f88 = [];
  W.forEach((w) => (w.k >= 5 ? f88 : f66).push(jic(w.k >= 5 ? 8 : 6, w.p, w.dir)));
  const kids = [
    part({ id: 'ped-vb7-bank', sec: '14.2.1', item: '1', pn: '276877', fr: 'Banc de valves HAWE à 7 sections', en: 'HAWE 7-section valve bank', qty: '1', page: 74, explode: [0, 0, 0],
      note: '10 leviers sur 7 sections (3 sur la 1re, 2 sur la 7e), comme p. 72 et 74. Ports A et B à l\'arrière.' }, b.meshes),
    part({ id: 'ped-vb7-fit-8-12', sec: '14.2.1', item: '2', pn: '202702-8-12', fr: 'Raccords 8 ORB - 12 JIC (P et T)', en: 'Fittings 8ORB-12JIC (P, T)', qty: '2', page: 74, explode: [0, 0, -0.06] },
      [jic(12, b.ports.P.p, b.ports.P.dir), jic(12, b.ports.T.p, b.ports.T.dir)]),
    part({ id: 'ped-vb7-fit-4-6', sec: '14.2.1', item: '3', pn: '202702-4-6', fr: 'Raccord 4 ORB - 6 JIC (manomètre)', en: 'Fitting 4ORB-6JIC (gauge)', qty: '1', page: 74, explode: [-0.05, 0, 0] },
      [jic(6, b.ports.G.p, b.ports.G.dir)]),
    part({ id: 'ped-vb7-fit-6-6', sec: '14.2.1', item: '4', pn: '202702-6-6', fr: 'Raccords 6 ORB - 6 JIC (ports A et B)', en: 'Fittings 6ORB-6JIC (A, B ports)', qty: '10', page: 74, explode: [0, 0, -0.06] }, f66),
    part({ id: 'ped-vb7-fit-8-8', sec: '14.2.1', item: '5', pn: '202702-8-8', fr: 'Raccords 8 ORB - 8 JIC (ports A et B)', en: 'Fittings 8ORB-8JIC (A, B ports)', qty: '4', page: 74, explode: [0, 0, -0.06] }, f88),
  ];
  const a = asm({ id: 'ped-vb7', sec: '14.2.1', item: '8', pn: '276878', fr: 'Banc de valves hydrauliques', en: 'Hydraulic valve bank', qty: '1', page: 74, explode: [0, 0, 0] },
    kids, { p: [XF, 0, BK.zStart], r: [0, -90, 0] });
  return { a, ports: b.ports };
}

function valveMount() {
  const { a: bank, ports } = bankValveMount();
  const out = [bank];
  const plateHoles = [
    { c: [ESTOP.z, ESTOP.y], r: 0.0112 }, { c: [SWITCH.z, SWITCH.y], r: 0.0112 }, { c: [GAUGE.z, GAUGE.y], r: 0.0318 },
    ...[[-0.285, 0.897], [0.285, 0.897], [-0.285, 1.11], [0.285, 1.11]].map((c) => ({ c, r: 0.0056 })),
    ...[[-0.207, 1.115], [-0.207, 1.065], [0.175, 1.115], [0.175, 1.065]].map((c) => ({ c, r: 0.0045 })),
  ];
  const plateDX = -0.28; // la plaque avance devant le banc à l'éclatement
  out.push(part({ id: 'ped-vm-plate', sec: '14.2', item: '7', pn: '276789', fr: 'Plaque du panneau à leviers', en: 'Control panel plate', qty: '1', page: 72, explode: [plateDX, 0, 0] },
    [plZY(panelOutline(), PX0, PX1, 'red', plateHoles)]));
  // étiquettes
  out.push(part({ id: 'ped-vm-decal', sec: '14.2', item: '9', pn: '278712', fr: 'Autocollant des commandes hydrauliques (2 x 7)', en: 'Hydraulic controls decal (2 x 7)', qty: '1', page: 72, explode: [plateDX - 0.02, 0, 0] },
    [lbl('vm-decal', { text: '', w: 0.34, h: 0.094, bg: '#f2f2ee', px: 1400, draw: pictos(2, 7, 'crane'), p: [PFZ, 1.075, -0.008], r: [0, -90, 0] })]));
  out.push(part({ id: 'ped-vm-magnets', sec: '14.2', item: '3', pn: '260234', fr: 'Autocollant AIMANTS arrêt / marche', en: 'MAGNETS on/off decal', qty: '1', page: 72, explode: [plateDX - 0.02, 0, 0] },
    [lbl('vm-mag', { lines: ['MAGNETS', 'OFF     ON'], w: 0.06, h: 0.03, bg: '#141414', fg: '#ffffff', p: [PFZ, 0.904, SWITCH.z], r: [0, -90, 0] })]));
  const estopDraw = (ctx, W, H) => {
    ctx.fillStyle = '#f2c200'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#111'; ctx.font = `bold ${W * 0.1}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const R = W * 0.39;
    [['EMERGENCY', -Math.PI / 2, 0.2, 1], ['STOP', Math.PI / 2, 0.24, -1]].forEach(([t, mid, step, s]) => {
      for (let i = 0; i < t.length; i++) { const a = mid + s * (i - (t.length - 1) / 2) * step; ctx.save(); ctx.translate(W / 2 + Math.cos(a) * R, H / 2 + Math.sin(a) * R); ctx.rotate(a + s * Math.PI / 2); ctx.fillText(t[i], 0, 0); ctx.restore(); }
    });
  };
  out.push(part({ id: 'ped-vm-estop-label', sec: '14.2', item: '1', pn: '108461', fr: 'Étiquette d\'arrêt d\'urgence 22 mm', en: 'E-stop label 22 mm', qty: '1', page: 72, explode: [plateDX - 0.02, 0, 0] },
    [roundLbl('estop', 0.031, [PFZ, ESTOP.y, ESTOP.z], [0, -90, 0], estopDraw, '#f2c200')]));
  // arrêt d'urgence
  const E = [PX0, ESTOP.y, ESTOP.z];
  out.push(part({ id: 'ped-vm-estop', sec: '14.2', item: '5', pn: '269897', fr: 'Arrêt d\'urgence 22 mm', en: 'E-stop 22 mm', qty: '1', page: 72, explode: [plateDX - 0.08, 0, 0] }, [
    discA(add(E, [-0.0008, 0, 0]), [-1, 0, 0], 0.0165, 0.006, 'black'),
    lathA(add(E, [-0.0068, 0, 0]), [-1, 0, 0], [[0, 0], [0.012, 0], [0.012, 0.008], [0.019, 0.009], [0.0205, 0.013], [0.018, 0.019], [0.01, 0.0215], [0, 0.022]], 'redLens'),
    bx(PX1, PX1 + 0.05, ESTOP.y - 0.016, ESTOP.y + 0.016, ESTOP.z - 0.016, ESTOP.z + 0.016, 'plasticGrey', 0.003),
    cylA([PX1 + 0.05, ESTOP.y, ESTOP.z], [1, 0, 0], 0.0075, 0.016, 'machined', 16),
  ]));
  // sélecteur AIMANTS
  const S = [PX0, SWITCH.y, SWITCH.z];
  out.push(part({ id: 'ped-vm-switch', sec: '14.2', item: '4', pn: '269894', fr: 'Sélecteur 22 mm 2 positions (aimants)', en: 'Selector switch 22 mm (magnets)', qty: '1', page: 72, explode: [plateDX - 0.08, 0, 0] }, [
    lathA(add(S, [-0.0008, 0, 0]), [-1, 0, 0], [[0, 0], [0.0145, 0], [0.0145, 0.004], [0.0125, 0.0065], [0, 0.0065]], 'chrome'),
    lathA(add(S, [-0.0072, 0, 0]), [-1, 0, 0], [[0, 0], [0.0105, 0], [0.0105, 0.005], [0, 0.005]], 'plastic'),
    bx(PX0 - 0.026, PX0 - 0.012, SWITCH.y - 0.0125, SWITCH.y + 0.0125, SWITCH.z - 0.0045, SWITCH.z + 0.0045, 'plastic', 0.003),
    bx(PX1, PX1 + 0.048, SWITCH.y - 0.016, SWITCH.y + 0.016, SWITCH.z - 0.016, SWITCH.z + 0.016, 'plasticGrey', 0.003),
    cylA([PX1 + 0.048, SWITCH.y, SWITCH.z], [1, 0, 0], 0.0075, 0.016, 'machined', 16),
  ]));
  // manomètre 2,5 po
  const dial = (ctx, W, H) => {
    ctx.fillStyle = '#f6f6f2'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#111'; ctx.lineCap = 'butt';
    for (let i = 0; i <= 50; i++) { const a = Math.PI * 0.75 + i / 50 * Math.PI * 1.5; ctx.lineWidth = i % 10 ? W * 0.008 : W * 0.016; const r0 = W * 0.44, r1 = i % 10 === 0 ? W * 0.34 : i % 5 === 0 ? W * 0.37 : W * 0.4; ctx.beginPath(); ctx.moveTo(W / 2 + Math.cos(a) * r0, H / 2 + Math.sin(a) * r0); ctx.lineTo(W / 2 + Math.cos(a) * r1, H / 2 + Math.sin(a) * r1); ctx.stroke(); }
    ctx.fillStyle = '#111'; ctx.font = `bold ${W * 0.085}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let i = 0; i <= 5; i++) { const a = Math.PI * 0.75 + i / 5 * Math.PI * 1.5; ctx.fillText(String(i), W / 2 + Math.cos(a) * W * 0.27, H / 2 + Math.sin(a) * W * 0.27); }
    ctx.font = `${W * 0.06}px Arial`; ctx.fillText('PSI x 1000', W / 2, H * 0.7);
    ctx.strokeStyle = '#c4141c'; ctx.lineWidth = W * 0.022; const a = Math.PI * 1.32; ctx.beginPath(); ctx.moveTo(W / 2, H / 2); ctx.lineTo(W / 2 + Math.cos(a) * W * 0.4, H / 2 + Math.sin(a) * W * 0.4); ctx.stroke();
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(W / 2, H / 2, W * 0.045, 0, 7); ctx.fill();
  };
  const Gp = [PX0, GAUGE.y, GAUGE.z];
  out.push(part({ id: 'ped-vm-gauge', sec: '14.2', item: '2', pn: '240328', fr: 'Manomètre de panneau 0 à 5000 psi', en: 'Panel pressure gauge 0-5000 psi', qty: '1', page: 72, explode: [plateDX - 0.07, 0, 0] }, [
    lathA(Gp, [-1, 0, 0], [[0.0312, 0], [0.042, 0], [0.042, 0.003], [0.039, 0.0065], [0.033, 0.0072], [0.0322, 0.0045], [0.0312, 0.0045], [0.0312, 0]], 'chrome', 40),
    discA(add(Gp, [-0.0047, 0, 0]), [-1, 0, 0], 0.0322, 0.0015, 'glass'),
    roundLbl('gauge-dial', 0.0305, add(Gp, [-0.0013, 0, 0]), [0, -90, 0], dial, '#f6f6f2'),
    cylA(Gp, [1, 0, 0], 0.031, 0.036, 'machined', 32),
    cylA([PX1 + 0.0296, GAUGE.y, GAUGE.z], [1, 0, 0], 0.0065, 0.008, 'brass', 12),
  ]));
  // bride en U du manomètre (derrière la plaque)
  const ux = PX1 + 0.016, uR = 0.0335;
  const uArc = m(G.torus(uR, 0.0022, Math.PI, 8, 24), 'zinc', { p: [ux, GAUGE.y, GAUGE.z], r: [0, 90, 0] });
  out.push(part({ id: 'ped-vm-ubolt', sec: '14.2', item: '6', pn: '269989', fr: 'Bride en U du manomètre 2,5 po', en: 'U-bolt, 2.5 in gauge', qty: '1', page: 73, explode: [plateDX + 0.04, 0, 0] }, [
    uArc,
    ...[-1, 1].map((s) => cylA([ux, GAUGE.y, GAUGE.z + s * uR], [0, -1, 0], 0.0022, 0.028, 'zinc', 10)),
    bx(ux - 0.004, ux + 0.004, GAUGE.y - 0.034, GAUGE.y - 0.028, GAUGE.z - 0.044, GAUGE.z + 0.044, 'zinc', 0.0015),
    ...[-1, 1].map((s) => nAt([ux, GAUGE.y - 0.034, GAUGE.z + s * uR], [0, -1, 0], { d: 0.19 * IN })),
  ]));
  // raccord 45° du manomètre
  const g45 = elbowFit(6, [PX1 + 0.0376, GAUGE.y, GAUGE.z], [1, 0, 0], [0, 1, 0], { ang: 45 });
  out.push(part({ id: 'ped-vm-fit45', sec: '14.2', item: '14', pn: '2044-04-06S', fr: 'Raccord 1/4 NPT - 6 JIC à 45°', en: 'Fitting 1/4 NPT to -6 JIC 45°', qty: '1', page: 73, explode: [plateDX - 0.07, 0, 0] }, [g45.g]));
  // visserie de la plaque et du banc
  const hw = [];
  for (const [z, y] of [[-0.285, 0.897], [0.285, 0.897], [-0.285, 1.11], [0.285, 1.11]]) hw.push(bAt([PX0, y, z], [-1, 0, 0], { d: 0.375 * IN, L: 0.875 * IN, washer: true }));
  for (const [z, y] of [[-0.207, 1.115], [-0.207, 1.065], [0.175, 1.115], [0.175, 1.065]]) hw.push(bAt([PX0, y, z], [-1, 0, 0], { d: 0.008, L: 0.016, washer: true }));
  out.push(part({ id: 'ped-vm-hw', sec: '14.2', item: '10, 11, 12, 13', pn: 'B025M, B141, W003, W003M', fr: 'Visserie du panneau à leviers', en: 'Control panel hardware', qty: '16', page: 72, explode: [plateDX - 0.05, 0, 0],
    note: 'Items 10 et 13 : 4 vis M8 x 16 et rondelles (banc). Items 11 et 12 : 4 vis 3/8-16 x 7/8 et rondelles (plaque).' }, hw));
  // boyau du manomètre (estimé)
  const gTip = toW2(add(ports.G.p, ports.G.dir, jicLen(6)));
  out.push(part({ id: 'ped-vm-hose', sec: '14.2', item: '', pn: '', fr: 'Boyau du manomètre (tracé estimé)', en: 'Gauge hose (estimated route)', qty: '1', page: 73, explode: [0, 0, 0], approx: true,
    note: 'Non listé dans la nomenclature 14.2 ; relie le raccord 45° au port du banc.' },
    hoseP([g45.tip, add(g45.tip, g45.dir, 0.02), [-1.27, 0.90, -0.03], [-1.245, 0.99, -0.12], [-1.255, 1.07, -0.25], [-1.29, 1.095, -0.30], [gTip[0], gTip[1], gTip[2] - 0.03], gTip], { d: 0.25 * IN })));
  const a = asm({ id: 'ped-vm', sec: '14.2', item: '5', pn: '276788', fr: 'Panneau de commande à leviers', en: 'Lever control panel', qty: '1', page: 72, explode: [-0.45, 0, 0] }, out);
  return { a, ports };
}

/* ------------------------------------------------------------------ */
/* 14.3 : bloc de l'ombilical 277898                                    */
/* ------------------------------------------------------------------ */
const TB = { x0: -1.465, x1: -1.375, y0: YB + 0.002, y1: YB + 0.082, z0: -0.14, z1: 0.14 };
const TETHER_BOLTS = [[-1.452, -0.127], [-1.452, 0.127], [-1.388, -0.127], [-1.388, 0.127]];
const TB_ELB = [[-1.425, -0.12], [-1.425, -0.07]]; // PB, TB (sorties vers +X, vers le banc)
function tetherBlock() {
  const ym = (TB.y0 + TB.y1) / 2;
  const body = [bx(TB.x0, TB.x1, TB.y0, TB.y1, TB.z0, TB.z1, 'alu', 0.002)];
  // portées usinées autour des ports avant
  for (const z of [-0.075, -0.02, 0.045, 0.095]) body.push(discA([TB.x0, ym, z], [-1, 0, 0], z < 0 ? 0.021 : 0.014, 0.0006, 'machined'));
  // deux électrovalves à cartouche à l'extrémité -Z
  const sol = [];
  for (const [x, y] of [[-1.445, TB.y0 + 0.026], [-1.395, TB.y0 + 0.058]]) {
    sol.push(hexA([x, y, TB.z0], [0, 0, -1], 0.027, 0.012, 'zinc'));
    sol.push(cylA([x, y, TB.z0 - 0.012], [0, 0, -1], 0.0085, 0.075, 'zincClear', 18));
    sol.push(cylA([x, y, TB.z0 - 0.018], [0, 0, -1], 0.019, 0.046, 'black', 28));
    sol.push(lathA([x, y, TB.z0 - 0.064], [0, 0, -1], [[0, 0], [0.012, 0], [0.012, 0.012], [0.009, 0.014], [0, 0.014]], 'plastic', 20));
    sol.push(bx(x - 0.013, x + 0.013, y + 0.017, y + 0.045, TB.z0 - 0.058, TB.z0 - 0.024, 'plastic', 0.003));
  }
  const f66 = [], f1212 = [], e66 = [], e1212 = [];
  // face avant (-X) : P, T, Dr, LS de l'ombilical
  f1212.push(jic(12, [TB.x0, ym, -0.075], [-1, 0, 0]), jic(12, [TB.x0, ym, -0.02], [-1, 0, 0]));
  f66.push(jic(6, [TB.x0, ym, 0.045], [-1, 0, 0]), jic(6, [TB.x0, ym, 0.095], [-1, 0, 0]));
  // face arrière (+X) : vers l'intérieur du caisson
  f1212.push(jic(12, [TB.x1, ym, -0.03], [1, 0, 0]), jic(12, [TB.x1, ym, 0.0], [1, 0, 0]));
  f66.push(jic(6, [TB.x1, ym, 0.03], [1, 0, 0]), jic(6, [TB.x1, ym, 0.07], [1, 0, 0]), jic(6, [TB.x1, ym, 0.11], [1, 0, 0]));
  // dessus : PB, TB (coudes 12) ; PG (droit 6) ; CDB, LSB (coudes 6) ; bout +Z : coude 6
  const elb = TB_ELB.map(([x, z]) => elbowFit(12, [x, TB.y1, z], [0, 1, 0], [1, 0, 0]));
  elb.forEach((e) => e1212.push(e.g));
  f66.push(jic(6, [-1.425, TB.y1, 0.0], [0, 1, 0]));
  e66.push(elbowFit(6, [-1.44, TB.y1, 0.06], [0, 1, 0], [0, 0, 1]).g, elbowFit(6, [-1.44, TB.y1, 0.11], [0, 1, 0], [0, 0, 1]).g);
  const endElb = elbowFit(6, [-1.42, ym, TB.z1], [0, 0, 1], [0, 1, 0]);
  e66.push(endElb.g);
  // visserie : 4 vis verticales à travers le bloc
  const hw = TETHER_BOLTS.map(([x, z]) => bAt([x, TB.y1, z], [0, 1, 0], { d: 0.375 * IN, L: 4.75 * IN, washer: true }));
  const kids = [
    part({ id: 'ped-tb-manifold', sec: '14.3', item: '1', pn: '279026', fr: 'Bloc de distribution de l\'ombilical', en: 'Tether manifold', qty: '1', page: 75, explode: [0, 0, 0],
      note: 'Ports de l\'ombilical P, T, Dr, LS à l\'avant. Deux électrovalves à cartouche au bout côté -Z.' }, [...body, ...sol]),
    part({ id: 'ped-tb-fit-6-6', sec: '14.3', item: '2', pn: '202702-6-6', fr: 'Raccords 6 ORB - 6 JIC', en: 'Fittings 6ORB-6JIC', qty: '6', page: 75, explode: [-0.04, 0.02, 0] }, f66),
    part({ id: 'ped-tb-fit-12-12', sec: '14.3', item: '3', pn: '202702-12-12', fr: 'Raccords 12 ORB - 12 JIC', en: 'Fittings 12ORB-12JIC', qty: '4', page: 75, explode: [-0.05, 0, 0] }, f1212),
    part({ id: 'ped-tb-elb-6-6', sec: '14.3', item: '4', pn: '2062-6-6', fr: 'Coudes 90° ORB - JIC taille 6', en: '90° elbows ORB-JIC size 6', qty: '3', page: 75, explode: [0, 0.05, 0.02] }, e66),
    part({ id: 'ped-tb-elb-12-12', sec: '14.3', item: '5', pn: '2062-12-12S', fr: 'Adaptateurs 90° ORB - JIC taille 12', en: '90° adapters ORB-JIC size 12', qty: '2', page: 75, explode: [0, 0.06, 0] }, e1212),
    part({ id: 'ped-tb-hw', sec: '14.3', item: '6, 7', pn: 'B161, 224166', fr: 'Vis 3/8-16 x 4 3/4 et rondelles Nord-Lock', en: 'HHCS 3/8-16 x 4.75 and Nord-Lock washers', qty: '8', page: 75, explode: [0, 0.16, 0] }, hw),
  ];
  const a = asm({ id: 'ped-tb', sec: '14.3', item: '9', pn: '277898', fr: 'Bloc de l\'ombilical', en: 'Tether block', qty: '1', page: 75, explode: [-0.62, -0.12, 0] }, kids);
  return { a, elb, endElb };
}

/* ------------------------------------------------------------------ */
/* 14.4 : crochet de valve de pince 276799                              */
/* ------------------------------------------------------------------ */
function gripperHook() {
  const z0 = 0.33, z1 = 0.39, zc = (z0 + z1) / 2, t = 0.0048;
  // plaque de fixation pliée en L : jambe verticale contre le montant, aile vers l'avant
  const mount = [
    plZY(rpoly([[z0, 0.958], [z1, 0.958], [z1, 1.03], [z0, 1.03]], 0.004), XF - t, XF, 'red', [{ c: [0.345, 1.0], r: 0.0035 }, { c: [0.375, 1.0], r: 0.0035 }]),
    plXZ(rpoly([[XF - 0.05, z0], [XF - t, z0], [XF - t, z1], [XF - 0.05, z1]], 0.004), 0.958, 0.958 + t, 'red', [{ c: [XF - 0.03, zc], r: 0.0035 }]),
  ];
  // crochet : languette horizontale sous l'aile (vis verticale 5) prolongée par un J
  const hook = [plXZ(rpoly([[XF - 0.047, zc - 0.014], [XF - 0.014, zc - 0.014], [XF - 0.014, zc + 0.014], [XF - 0.047, zc + 0.014]], 0.004), 0.958 - t, 0.958, 'red', [{ c: [XF - 0.026, zc], r: 0.0035 }])];
  const J = [[XF - 0.047, 0.958 - t], [XF - 0.041, 0.958 - t], [XF - 0.041, 0.93], [XF - 0.044, 0.905], [XF - 0.054, 0.89], [XF - 0.07, 0.888], [XF - 0.082, 0.898], [XF - 0.084, 0.915], [XF - 0.077, 0.916], [XF - 0.075, 0.902], [XF - 0.067, 0.896], [XF - 0.056, 0.899], [XF - 0.049, 0.91], [XF - 0.047, 0.93]];
  hook.push(plXY(rpoly(J, [0.001, 0.001, 0.006, 0.01, 0.01, 0.01, 0.006, 0.002, 0.002, 0.004, 0.006, 0.006, 0.006, 0.004]), zc - t / 2, zc + t / 2, 'red'));
  const hw = [
    bAt([XF - t, 1.0, 0.345], [-1, 0, 0], { d: 0.25 * IN, L: 1 * IN, washer: true }), bAt([XF - t, 1.0, 0.375], [-1, 0, 0], { d: 0.25 * IN, L: 1 * IN, washer: true }),
    ...nutStack([XF + TW, 1.0, 0.345], [1, 0, 0], 0.25 * IN, true), ...nutStack([XF + TW, 1.0, 0.375], [1, 0, 0], 0.25 * IN, true),
    bAt([XF - 0.026, 0.958 - t, zc], [0, -1, 0], { d: 0.25 * IN, L: 0.75 * IN, washer: true }),
    ...nutStack([XF - 0.026, 0.958 + t, zc], [0, 1, 0], 0.25 * IN, true),
  ];
  const kids = [
    part({ id: 'ped-hook-mount', sec: '14.4', item: '1', pn: '276798', fr: 'Plaque de fixation du crochet', en: 'Hook mount plate', qty: '1', page: 76, explode: [0, 0, 0] }, mount),
    part({ id: 'ped-hook-plate', sec: '14.4', item: '2', pn: '276800', fr: 'Crochet', en: 'Hook plate', qty: '1', page: 76, explode: [0, -0.05, 0] }, hook),
    part({ id: 'ped-hook-hw', sec: '14.4', item: '3, 4, 5, 6', pn: 'W001, 237505, B042, B044', fr: 'Visserie du crochet', en: 'Hook hardware', qty: '12', page: 76, explode: [-0.04, 0, 0],
      note: '3 vis 1/4-20 (1 x 3/4 po, 2 x 1 po), 3 écrous Nylock, 6 rondelles.' }, hw),
  ];
  return asm({ id: 'ped-hook', sec: '14.4', item: '6', pn: '276799', fr: 'Crochet de valve de pince', en: 'Gripper valve hook', qty: '1', page: 76, explode: [-0.25, 0, 0.18], approx: true,
    note: 'Emplacement estimé (montant avant côté +Z) d\'après la p. 69.' }, kids);
}

/* ------------------------------------------------------------------ */
/* 14.5 : valves de déplacement 276887 (+ 14.5.1, 14.5.2)               */
/* ------------------------------------------------------------------ */
const DV = { x0: -1.35, x1: -0.775, y0: 0.705, ySide: 0.812, yTop: 0.971, zIn: 0.744, zOut: 0.750, zFoot: ZW, t: 0.006 };
const TR = { pitch: 0.0466, n: 5, xStart: -1.0963, yTop: 1.027, depth: 0.085 };
const DIV = { x: -1.277, y: 0.8435, z0: DV.zIn - 0.06, z1: DV.zIn, s: 0.05 };
const FOOT_Y = [0.868, 0.906, 0.944], FOOT_XTRA_Y = 0.83;
const FOOT_X = [DV.x0 + 0.022, DV.x1 - 0.022];
const DV_M8 = [[TR.xStart - 0.055, 0.86], [TR.xStart - 0.055, 0.93], [TR.xStart + 5 * TR.pitch + 0.013, 0.86], [TR.xStart + 5 * TR.pitch + 0.013, 0.93]];

function tramBank() {
  const levers = [0, 1, 2, 3, 4].map((k) => ({ k }));
  const b = haweBank({ n: TR.n, pitch: TR.pitch, yTop: TR.yTop, depth: TR.depth, levers, leverL: 0.17, coverH: 0.1, rearAux: true });
  const W = b.ports.work;
  const f66 = [], f810 = [];
  W.forEach((w, i) => ((i % 2 === 0 && w.k < 3) || (i % 2 === 1 && w.k === 0) ? f810 : f66).push(jic((i % 2 === 0 && w.k < 3) || (i % 2 === 1 && w.k === 0) ? 10 : 6, w.p, w.dir)));
  const e1 = elbowFit(6, b.ports.G.p, b.ports.G.dir, [0, -1, 0], { fem: true });
  const e2 = elbowFit(6, b.ports.LS.p, b.ports.LS.dir, [0, -1, 0], { fem: true });
  const kids = [
    part({ id: 'ped-tram-bank', sec: '14.5.1', item: '1', pn: '276876', fr: 'Banc de valves HAWE à 5 sections', en: 'HAWE 5-section valve bank', qty: '1', page: 79, explode: [0, 0, 0],
      note: '5 leviers à pommeau, ports A et B vers le caisson (p. 77, vues de dessus et de dessous).' }, b.meshes),
    part({ id: 'ped-tram-fit-6-6', sec: '14.5.1', item: '2', pn: '202702-6-6', fr: 'Raccords 6 ORB - 6 JIC', en: 'Fittings 6ORB-6JIC', qty: '6', page: 79, explode: [0, 0, -0.05] }, f66),
    part({ id: 'ped-tram-fit-8-10', sec: '14.5.1', item: '3', pn: '202702-8-10', fr: 'Raccords 8 ORB - 10 JIC', en: 'Fittings 8ORB-10JIC', qty: '4', page: 79, explode: [0, 0, -0.05] }, f810),
    part({ id: 'ped-tram-elb-6-6', sec: '14.5.1', item: '4', pn: '2062-6-6', fr: 'Coudes 90° ORB - JIC femelle taille 6', en: '90° elbows MORB-FJIC size 6', qty: '2', page: 79, explode: [-0.05, 0, 0] }, [e1.g, e2.g]),
    part({ id: 'ped-tram-fit-8-12', sec: '14.5.1', item: '5', pn: '202702-8-12S', fr: 'Raccords 8 ORB - 12 JIC (P et T)', en: 'Fittings 8ORB-12JIC (P, T)', qty: '2', page: 79, explode: [0, 0, -0.06] },
      [jic(12, b.ports.P.p, b.ports.P.dir), jic(12, b.ports.T.p, b.ports.T.dir)]),
  ];
  const a = asm({ id: 'ped-tram', sec: '14.5.1', item: '6', pn: '277709', fr: 'Bloc de valves à 5 leviers (chenilles et vérins)', en: '5-lever tram valve bank', qty: '1', page: 79, explode: [0, 0, 0] },
    kids, { p: [TR.xStart, 0, DV.zIn] });
  return { a, ports: b.ports };
}

function diverter() {
  const { x, y, z0, z1, s } = DIV;
  const body = [bx(x - s, x + s, y - s, y + s, z0, z1, 'steel', 0.003)];
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) body.push(hexA([x + dx * s, y + dy * s, (z0 + z1) / 2], [dx, dy, 0], 0.03, 0.008, 'steel'));
  // sélecteur rotatif côté caisson : disque à encoche, carré d'entraînement, goupille de butée
  body.push(discA([x, y, z0], [0, 0, -1], 0.03, 0.006, 'black'));
  body.push(bx(x - 0.007, x + 0.007, y - 0.007, y + 0.007, z0 - 0.018, z0 - 0.006, 'machined', 0.0015));
  body.push(cylA([x - 0.034, y, z0], [0, 0, -1], 0.003, 0.012, 'machined', 10));
  const top = elbowFit(6, [x, y + s + 0.008, (z0 + z1) / 2], [0, 1, 0], [1, 0, 0]);
  const side = elbowFit(6, [x + s + 0.008, y, (z0 + z1) / 2], [1, 0, 0], [0, 0, -1]);
  const botTip = add([x, y - s - 0.008, (z0 + z1) / 2], [0, -1, 0], jicLen(6));
  const kids = [
    part({ id: 'ped-div-valve', sec: '14.5.2', item: '1', pn: '277981', fr: 'Valve de dérivation manuelle 3/8 NPT', en: 'Manual diverter valve 3/8 NPT', qty: '1', page: 80, explode: [0, 0, 0] }, body),
    part({ id: 'ped-div-elb', sec: '14.5.2', item: '2', pn: '2024-6-6S', fr: 'Coudes 90° 3/8 NPT - 6 JIC', en: '90° fittings 3/8 NPT to -6 JIC', qty: '2', page: 80, explode: [0.03, 0.03, 0] }, [top.g, side.g]),
    part({ id: 'ped-div-fit', sec: '14.5.2', item: '3', pn: '2021-6-6', fr: 'Raccord droit 3/8 NPT - 6 JIC', en: 'Straight fitting 3/8 NPT to -6 JIC', qty: '1', page: 80, explode: [0, -0.04, 0] },
      [jic(6, [x, y - s - 0.008, (z0 + z1) / 2], [0, -1, 0])]),
  ];
  const a = asm({ id: 'ped-div', sec: '14.5.2', item: '7', pn: '277979', fr: 'Valve de dérivation manuelle', en: 'Manual diverter', qty: '1', page: 80, explode: [0, 0, -0.08] }, kids);
  return { a, side, botTip };
}

function driveValves(tether) {
  const { x0, x1, y0, ySide, yTop, zIn, zOut, zFoot, t } = DV;
  const out = [];
  // plaque en U : face extérieure chanfreinée (trous) + deux jambes à pattes repliées vers l'intérieur
  const holes = [];
  for (const dx of [-1, 1]) for (const dy of [-1, 1]) holes.push({ c: [DIV.x + dx * 0.0405, DIV.y + dy * 0.0405], r: 0.0035 });
  for (const [hx, hy] of DV_M8) holes.push({ c: [hx, hy], r: 0.0045 });
  const plate = [plXY(rpoly([[x0, yTop], [x0, ySide], [x0 + 0.07, y0], [x1 - 0.038, y0], [x1, ySide], [x1, yTop]], [0.004, 0.012, 0.015, 0.015, 0.012, 0.004]), zIn, zOut, 'red', holes)];
  const zj = zIn - 0.0002;
  plate.push(plXZ(rpoly([[x0, zFoot], [x0 + 0.038, zFoot], [x0 + 0.038, zFoot + t], [x0 + t, zFoot + t], [x0 + t, zj], [x0, zj]], [0.006, 0.001, 0.001, 0.003, 0, 0]), ySide, yTop, 'red'));
  plate.push(plXZ(rpoly([[x1, zFoot], [x1, zj], [x1 - t, zj], [x1 - t, zFoot + t], [x1 - 0.038, zFoot + t], [x1 - 0.038, zFoot]], [0.006, 0, 0, 0.003, 0.001, 0.001]), ySide, yTop, 'red'));
  out.push(part({ id: 'ped-dv-plate', sec: '14.5', item: '1', pn: '276886', fr: 'Plaque en U des valves de déplacement', en: 'Drive valve U-plate', qty: '1', page: 77, explode: [0, 0, 0.12],
    note: 'Pattes repliées vers l\'intérieur, 3 vis par patte (p. 77). Fixée sur le flanc +Z du caisson.' }, plate));
  out.push(part({ id: 'ped-dv-decal', sec: '14.5', item: '11', pn: '281654', fr: 'Autocollant des commandes hydrauliques (2 x 5)', en: 'Hydraulic controls decal (2 x 5)', qty: '1', page: 78, explode: [0, 0, 0.15] },
    [lbl('dv-decal', { text: '', w: 0.23, h: 0.089, bg: '#f2f2ee', px: 1100, draw: pictos(2, 5, 'track'), p: [-0.975, 0.9065, zOut + 0.0007] })]));
  const { a: tram, ports: tp } = tramBank();
  out.push(tram);
  const div = diverter();
  out.push(div.a);
  // visserie propre à 14.5
  const hw = [];
  for (const fx of FOOT_X) for (const fy of FOOT_Y) hw.push(bAt([fx, fy, zFoot + t], [0, 0, 1], { d: 0.375 * IN, L: 1 * IN, washer: true }));
  for (const [hx, hy] of DV_M8) hw.push(bAt([hx, hy, zOut], [0, 0, 1], { d: 0.008, L: 0.016, washer: true }));
  for (const dx of [-1, 1]) for (const dy of [-1, 1]) {
    const hx = DIV.x + dx * 0.0405, hy = DIV.y + dy * 0.0405;
    hw.push(bAt([hx, hy, zOut], [0, 0, 1], { d: 0.25 * IN, L: 2.75 * IN, washer: true }));
    hw.push(...nutStack([hx, hy, DIV.z0], [0, 0, -1], 0.25 * IN));
  }
  out.push(part({ id: 'ped-dv-hw', sec: '14.5', item: '2, 3, 4, 5, 8, 9, 10', pn: 'W003, B142, 231470, B025M, B055, 258780, N015', fr: 'Visserie des valves de déplacement', en: 'Drive valve hardware', qty: '36', page: 77, explode: [0, 0, 0.18],
    note: 'Pattes : 6 vis 3/8-16 x 1 et rondelles. Banc : 4 vis M8 et Nord-Lock 5/16. Dérivation : 4 vis 1/4-20 x 2 3/4, 8 Nord-Lock 1/4, 4 écrous.' }, hw));
  // boyaux internes (estimés) : dérivation vers l'entrée du banc, ports de travail vers le châssis
  const toW5 = (p) => [TR.xStart + p[0], p[1], DV.zIn + p[2]];
  const pTip = toW5(add(tp.P.p, tp.P.dir, jicLen(12)));
  const hoses = [];
  hoses.push(...hoseP([div.side.tip, add(div.side.tip, div.side.dir, 0.025), [-1.20, 0.81, 0.60], [-1.17, 0.77, 0.575], [pTip[0], pTip[1] - 0.004, pTip[2] - 0.035], pTip], { d: 0.5 * IN }));
  for (const k of [0, 1, 3, 4]) {
    const w = tp.work[2 * k + 1], dash = (k === 0) ? 10 : 6;
    const tip = toW5(add(w.p, w.dir, jicLen(dash)));
    hoses.push(...hoseP([tip, [tip[0], tip[1] - 0.004, tip[2] - 0.035], [tip[0], tip[1] - 0.06, 0.578], [tip[0], 0.77, 0.572], [tip[0], 0.728, 0.572]], { d: 0.375 * IN }));
  }
  out.push(part({ id: 'ped-dv-hoses', sec: '14.5', item: '', pn: '', fr: 'Boyaux des valves de déplacement (tracé estimé)', en: 'Drive valve hoses (estimated route)', qty: '5', page: 77, explode: [0, 0, 0], approx: true,
    note: 'Non listés dans la nomenclature 14.5. Vers les moteurs de chenilles et les vérins (autre ensemble).' }, hoses));
  return asm({ id: 'ped-dv', sec: '14.5', item: '7', pn: '276887', fr: 'Valves de déplacement', en: 'Drive valve assembly', qty: '1', page: 77, explode: [0, -0.02, 0.40] }, out);
}

/* ------------------------------------------------------------------ */
/* 14.6 : plaque de raccords tournants 277764                           */
/* ------------------------------------------------------------------ */
const BH = { xc: -1.15, y0: 0.857, t: 0.0095 };
const SWIVELS = (() => {
  const out = [];
  [-0.084, -0.042, 0, 0.042, 0.084].forEach((z) => out.push([BH.xc - 0.035, z]));
  [-0.063, -0.021, 0.021, 0.063].forEach((z) => out.push([BH.xc, z]));
  [-0.084, -0.042, 0.042, 0.084].forEach((z) => out.push([BH.xc + 0.035, z]));
  return out; // 13
})();
const SW_TOP = BH.y0 + BH.t + 0.071, SW_BOT = BH.y0 - 0.067;
function bulkhead() {
  const { xc, y0, t } = BH, y1 = y0 + t;
  const outline = rpoly([[xc - 0.055, -0.11], [xc - 0.02, -0.11], [xc - 0.02, -0.165], [xc + 0.02, -0.165], [xc + 0.02, -0.11], [xc + 0.055, -0.11], [xc + 0.055, 0.11], [xc + 0.02, 0.11], [xc + 0.02, 0.165], [xc - 0.02, 0.165], [xc - 0.02, 0.11], [xc - 0.055, 0.11]],
    [0.01, 0.004, 0.012, 0.012, 0.004, 0.01, 0.01, 0.004, 0.012, 0.012, 0.004, 0.01]);
  const holes = SWIVELS.map(([x, z]) => ({ c: [x, z], r: 0.0105 })).concat([{ c: [xc, -0.145], r: 0.0055 }, { c: [xc, 0.145], r: 0.0055 }]);
  const sw = [];
  for (const [x, z] of SWIVELS) {
    sw.push(m(G.lathe([[0, SW_BOT], [0.0062, SW_BOT], [0.0074, SW_BOT + 0.004], [0.0074, SW_BOT + 0.016], [0.0095, SW_BOT + 0.018], [0.0095, y1 + 0.004], [0, y1 + 0.004]], 18), 'zinc', { p: [x, 0, z] }));
    sw.push(m(G.hex(0.025, 0.009), 'zinc', { p: [x, y0 - 0.0045, z] }));                    // contre-écrou sous la plaque
    sw.push(m(G.hex(0.027, 0.011), 'zinc', { p: [x, y1 + 0.0055, z] }));                    // six pans de cloison
    sw.push(m(G.lathe([[0, y1 + 0.011], [0.0115, y1 + 0.011], [0.0115, y1 + 0.045], [0.009, y1 + 0.047], [0, y1 + 0.047]], 20), 'zincClear', { p: [x, 0, z] })); // corps tournant
    sw.push(m(G.hex(0.022, 0.009), 'zinc', { p: [x, y1 + 0.0515, z] }));
    sw.push(m(G.lathe([[0, y1 + 0.056], [0.0068, y1 + 0.056], [0.0074, y1 + 0.059], [0.0074, SW_TOP - 0.004], [0.0062, SW_TOP], [0, SW_TOP]], 18), 'zinc', { p: [x, 0, z] }));
  }
  const kids = [
    part({ id: 'ped-bh-plate', sec: '14.6', item: '1', pn: '280726', fr: 'Plaque de cloison (mécano-soudée)', en: 'Bulkhead weldment', qty: '1', page: 81, explode: [0, 0, 0] }, [plXZ(outline, y0, y1, 'red', holes)]),
    part({ id: 'ped-bh-swivels', sec: '14.6', item: '2', pn: '122097', fr: 'Raccords tournants de cloison JIC mâle', en: 'Live swivel bulkhead fittings MJIC', qty: '13', page: 81, explode: [0, 0.12, 0] }, sw),
  ];
  return asm({ id: 'ped-bh', sec: '14.6', item: '8', pn: '277764', fr: 'Plaque de raccords tournants', en: 'Bulkhead with live swivels', qty: '1', page: 81, explode: [0.70, 0, 0], approx: true,
    note: 'Position estimée : sur la traverse intérieure, sous l\'axe de la couronne.' }, kids);
}

/* ------------------------------------------------------------------ */
/* 14.1 : bloc de délestage de charge 281015                            */
/* ------------------------------------------------------------------ */
const DL = { x0: XB - TBK - 0.0327, x1: XB - TBK, y0: 1.235, y1: 1.301, z0: -0.39, z1: -0.29 };
function dumpLoad() {
  const { x0, x1, y0, y1, z0, z1 } = DL, xc = (x0 + x1) / 2;
  const body = [bx(x0, x1, y0, y1, z0, z1, 'alu', 0.0015)];
  const valves = [-0.36, -0.32].map((z, i) => part({ id: `ped-dl-valve-${i + 1}`, sec: '14.1', item: '2', pn: '281016', fr: 'Valve d\'équilibrage 4,5:1, 1800 psi', en: 'Counterbalance valve 4.5:1, 1800 psi', qty: '2', page: 71, explode: [0, 0.07, 0] }, [
    hexA([xc, y1, z], [0, 1, 0], 0.026, 0.014, 'zinc'),
    cylA([xc, y1 + 0.014, z], [0, 1, 0], 0.0105, 0.02, 'zincClear', 20),
    hexA([xc, y1 + 0.034, z], [0, 1, 0], 0.018, 0.006, 'zinc'),
    cylA([xc, y1 + 0.04, z], [0, 1, 0], 0.004, 0.012, 'machined', 12),
  ]));
  const ym = y0 + 0.042;
  const fits = [jic(6, [xc, ym, z0], [0, 0, -1]), jic(6, [xc, ym, z1], [0, 0, 1]), jic(6, [xc, y0, -0.362], [0, -1, 0]), jic(6, [xc, y0, -0.318], [0, -1, 0])];
  const d = 0.3125 * IN, hw = [];
  for (const z of [-0.375, -0.305]) { hw.push(bAt([XB, DL_BY, z], [1, 0, 0], { d, L: 2.25 * IN, washer: true })); hw.push(...nutStack([x0, DL_BY, z], [-1, 0, 0], d)); }
  const kids = [
    part({ id: 'ped-dl-manifold', sec: '14.1', item: '1', pn: '269264', fr: 'Bloc à pilotage croisé', en: 'Cross pilot manifold', qty: '1', page: 71, explode: [0, 0, 0], note: 'Ports V1, V2 (côtés) et C1, C2 (dessous).' }, body),
    ...valves,
    part({ id: 'ped-dl-fit', sec: '14.1', item: '6', pn: '202702-6-6', fr: 'Raccords 6 ORB - 6 JIC', en: 'Fittings 6ORB-6JIC', qty: '4', page: 71, explode: [0, -0.04, 0] }, fits),
    part({ id: 'ped-dl-hw', sec: '14.1', item: '3, 4, 5', pn: 'W002, B086, N016', fr: 'Vis 5/16-18 x 2 1/4, rondelles et écrous', en: 'HHCS 5/16-18 x 2.25, washers, nuts', qty: '8', page: 71, explode: [0.07, 0, 0] }, hw),
  ];
  return asm({ id: 'ped-dl', sec: '14.1', item: '27', pn: '281015', fr: 'Bloc de délestage de charge', en: 'Dump load control', qty: '1', page: 71, explode: [0.40, 0.10, 0], approx: true,
    note: 'Position estimée : intérieur de la plaque arrière, en haut côté -Z (repère 27, p. 69).' }, kids);
}

/* ------------------------------------------------------------------ */
/* 14.7 : boîte du chargeur et de la télécommande 278733                */
/* ------------------------------------------------------------------ */
const CB = { x0: L.chargerBox.x[0], x1: L.chargerBox.x[1], y0: 1.085, y1: 1.395, z0: ZW + 0.001, z1: L.chargerBox.z[1] - 0.01, t: 0.0025 };
function chargerBox() {
  const { x0, x1, y0, y1, z0, z1, t } = CB;
  const grey = [
    bx(x0, x0 + t, y0, y1, z0, z1, 'grey', 0.0012), bx(x1 - t, x1, y0, y1, z0, z1, 'grey', 0.0012),
    bx(x0 + t, x1 - t, y1 - t, y1, z0, z1, 'grey', 0.0012), bx(x0 + t, x1 - t, y0, y0 + t, z0, z1, 'grey', 0.0012),
    bx(x0 + t, x1 - t, y0 + t, y1 - t, z0, z0 + t, 'grey', 0.0012),
  ];
  // porte (charnière en haut) et son rebord
  const dz0 = z1 + 0.0005, dz1 = z1 + 0.0035;
  const door = [bx(x0 - 0.002, x1 + 0.002, y0 - 0.002, y1 + 0.002, dz0, dz1, 'grey', 0.0012)];
  door.push(bx(x0 - 0.002, x0 - 0.0005, y0 - 0.002, y1 + 0.002, dz0 - 0.008, dz0, 'grey', 0.0006), bx(x1 + 0.0005, x1 + 0.002, y0 - 0.002, y1 + 0.002, dz0 - 0.008, dz0, 'grey', 0.0006));
  door.push(bx(x0 - 0.0005, x1 + 0.0005, y0 - 0.002, y0 - 0.0005, dz0 - 0.008, dz0, 'grey', 0.0006));
  // pattes de fixation avec lumières
  for (const [xa, xb] of [[x0 - 0.03, x0], [x1, x1 + 0.03]]) for (const [ya, yb] of [[1.10, 1.135], [1.345, 1.38]]) {
    const xm = (xa + xb) / 2, ym = (ya + yb) / 2;
    grey.push(plXY(rpoly([[xa, ya], [xb, ya], [xb, yb], [xa, yb]], 0.003), z0, z0 + 0.0025, 'grey', [{ slot: [xm, ym - 0.007, xm, ym + 0.007], r: 0.0055 }]));
  }
  door.push(cylA([x0 + 0.01, y1 + 0.0015, dz1 - 0.0005], [1, 0, 0], 0.0035, x1 - x0 - 0.02, 'steel', 12));
  for (const xl of [x0 + 0.1, x1 - 0.1]) { door.push(cylA([xl, y0 + 0.02, dz1], [0, 0, 1], 0.0085, 0.012, 'plastic', 20)); door.push(lathA([xl, y0 + 0.02, dz1 + 0.012], [0, 0, 1], [[0, 0], [0.013, 0], [0.013, 0.006], [0.01, 0.01], [0, 0.011]], 'plastic', 24)); }
  // mousses intérieures (3 feuilles)
  const fz0 = z0 + t, foams = [
    bx(x0 + t + 0.002, x1 - t - 0.002, y0 + t + 0.002, y1 - t - 0.002, fz0, fz0 + 0.0127, 'polymer', 0.003),
    bx(x0 + t, x0 + t + 0.0127, y0 + t + 0.002, y1 - t - 0.002, fz0 + 0.0135, z1 - 0.01, 'polymer', 0.003),
    bx(x1 - t - 0.0127, x1 - t, y0 + t + 0.002, y1 - t - 0.002, fz0 + 0.0135, z1 - 0.01, 'polymer', 0.003),
  ];
  const cx = (x0 + x1) / 2, rx = x1 - 0.05, rz = z0 + 0.05;
  const kids = [
    part({ id: 'ped-cb-enclosure', sec: '14.7', item: '1', pn: '279852', fr: 'Boîtier du chargeur et de la télécommande', en: 'Charger and remote box enclosure', qty: '1', page: 82, explode: [0, 0, 0],
      note: 'Caisson et 4 pattes de fixation.' }, grey),
    part({ id: 'ped-cb-door', sec: '14.7', item: '1', pn: '279852', fr: 'Porte du boîtier (fait partie de 279852)', en: 'Box door (part of 279852)', qty: '1', page: 82, explode: [0, 0, 0.45],
      note: 'Charnière en haut, 2 loquets en bas (photo p. 44 du manuel opérateur).' }, door),
    part({ id: 'ped-cb-screw', sec: '14.7', item: '2', pn: '224833', fr: 'Vis CHC M4 x 15', en: 'SHCS M4 x 15', qty: '1', page: 82, explode: [0, 0.05, 0], approx: true, note: 'Non repérée sur le dessin ; placée sur le fond, près de la prise.' },
      [bAt([rx - 0.03, y0 + t, rz], [0, 1, 0], { d: 0.004, L: 0.015, head: 'shcs' })]),
    ...foams.map((f, i) => part({ id: `ped-cb-foam-${i + 1}`, sec: '14.7', item: '3', pn: '250393', fr: 'Feuille de mousse néoprène 1/2 po', en: 'Neoprene foam sheet 1/2 in', qty: '3', page: 82, explode: i === 0 ? [0, 0, 0.29] : [i === 1 ? -0.035 : 0.035, 0, 0.36] }, [f])),
    part({ id: 'ped-cb-label24', sec: '14.7', item: '4', pn: '245858', fr: 'Étiquette +24 VOLTS réfléchissante', en: '+24 VOLTS reflective label', qty: '1', page: 82, explode: [0, 0, 0.45] },
      [lbl('cb-24v', { lines: ['+24', 'VOLTS'], w: 0.07, h: 0.045, bg: '#f5a400', fg: '#111111', p: [cx, 1.285, dz1 + 0.0007] })]),
    part({ id: 'ped-cb-decal-1', sec: '14.7', item: '5', pn: '250795', fr: 'Autocollant chargeur et télécommande (porte)', en: 'Charger and remote decal (door)', qty: '2', page: 82, explode: [0, 0, 0.45] },
      [lbl('cb-dec1', { lines: ['CHARGEUR DE BATTERIE', 'ET TÉLÉCOMMANDE'], w: 0.15, h: 0.03, bg: '#111111', fg: '#ffffff', p: [cx, 1.235, dz1 + 0.0007] })]),
    part({ id: 'ped-cb-decal-2', sec: '14.7', item: '5', pn: '250795', fr: 'Autocollant chargeur et télécommande (côté)', en: 'Charger and remote decal (side)', qty: '2', page: 82, explode: [-0.06, 0, 0] },
      [lbl('cb-dec2', { lines: ['CHARGEUR DE BATTERIE', 'ET TÉLÉCOMMANDE'], w: 0.15, h: 0.03, bg: '#111111', fg: '#ffffff', p: [x0 - 0.0007, 1.25, (z0 + z1) / 2], r: [0, -90, 0] })]),
    part({ id: 'ped-cb-receptacle', sec: '14.7', item: '6', pn: '279842', fr: 'Prise mâle 7/8 Minifast', en: '7/8 Minifast male receptacle', qty: '1', page: 82, explode: [0, -0.07, 0] }, [
      hexA([rx, y0, rz], [0, -1, 0], 0.032, 0.006, 'machined'),
      cylA([rx, y0 - 0.006, rz], [0, -1, 0], 0.0125, 0.02, 'machined', 24),
      cylA([rx, y0 - 0.026, rz], [0, -1, 0], 0.0105, 0.01, 'machined', 24),
      discA([rx, y0 - 0.036, rz], [0, -1, 0], 0.0085, 0.0015, 'plastic', 20),
    ]),
  ];
  return asm({ id: 'ped-cb', sec: '14.7', item: '12', pn: '278733', fr: 'Boîte du chargeur et de la télécommande', en: 'Battery charger and remote box', qty: '1', page: 82, explode: [0, 0.08, 0.55] }, kids);
}

/* ------------------------------------------------------------------ */
/* Pièces directes de la section 14                                     */
/* ------------------------------------------------------------------ */
function rootParts(vm, tb) {
  const out = [];
  // 12 boulons de semelle + 15 boulons de couronne, rondelles Nord-Lock (item 1 : 27 = 12 + 15)
  out.push(part({ id: 'ped-hw-base', sec: '14', item: '1, 14', pn: '216795, B345', fr: 'Boulons de semelle 5/8-11 x 1 3/4 et Nord-Lock', en: 'Base bolts 5/8-11 x 1.75 and Nord-Lock', qty: '24', page: PG, explode: [0, 0.16, 0], note: 'Alignés sur les 12 trous du plateau du châssis, à l\'intérieur du caisson.' },
    BASE_BOLTS.flatMap(([x, z]) => [wAt([x, YB, z], [0, 1, 0], { d: 0.625 * IN, od: 1.0 * IN, t: 0.0034 }), bAt([x, YB + 0.0034, z], [0, 1, 0], { d: 0.625 * IN, L: 1.75 * IN })])));
  const sb = [];
  for (let i = 0; i < 15; i++) { const a = (i + 0.5) * 2 * Math.PI / 15; sb.push(bAt([SX + SR * Math.cos(a), SLEW_TOP, SZ + SR * Math.sin(a)], [0, 1, 0], { d: 0.625 * IN, L: 3.75 * IN, washer: true })); }
  out.push(part({ id: 'ped-hw-slew', sec: '14', item: '1, 15', pn: '216795, B354', fr: 'Boulons de couronne 5/8-11 x 3 3/4 et Nord-Lock', en: 'Slew ring bolts 5/8-11 x 3.75 and Nord-Lock', qty: '30', page: PG, explode: [0, 0.42, 0],
    note: '15 boulons sur un cercle de 0,41 m centré sous la couronne ; têtes posées à y = L.slew.topY.' }, sb));
  // tubes hydrauliques 10 et 11 : du bloc de l'ombilical (coudes PB, TB) à l'entrée du banc (P, T)
  const pT = toW2(add(vm.ports.P.p, vm.ports.P.dir, jicLen(12))), tT = toW2(add(vm.ports.T.p, vm.ports.T.dir, jicLen(12)));
  const tubes = [[tb.elb[0], pT, -0.15], [tb.elb[1], tT, -0.10]].map(([e, tip, zm]) => hoseP([
    e.tip, add(e.tip, e.dir, 0.03), [-1.30, e.tip[1] - 0.004, (e.tip[2] + zm) / 2], [-1.245, e.tip[1] + 0.006, zm - 0.04], [-1.212, 0.84, tip[2]], [-1.205, tip[1] - 0.03, tip[2]], [tip[0] + 0.022, tip[1], tip[2]], tip,
  ], { d: 0.75 * IN, mk: 'zincClear', tube: true, radial: 14 }));
  out.push(part({ id: 'ped-tube-10', sec: '14', item: '10', pn: '277952', fr: 'Tube hydraulique (pression)', en: 'Hydraulic tube (pressure)', qty: '1', page: PG, explode: [-0.45, 0, 0], approx: true, note: 'Tracé estimé : coude PB du bloc de l\'ombilical vers le port P du banc.' }, tubes[0]));
  out.push(part({ id: 'ped-tube-11', sec: '14', item: '11', pn: '277954', fr: 'Tube hydraulique (retour)', en: 'Hydraulic tube (return)', qty: '1', page: PG, explode: [-0.45, 0, 0], approx: true, note: 'Tracé estimé : coude TB du bloc de l\'ombilical vers le port T du banc.' }, tubes[1]));
  // gyrophare : support latéral 19 + tour TL50 24 (flanc -Z, coin avant haut)
  const bxc = -1.40, bzc = -ZW - 0.047, by = 1.29;
  out.push(part({ id: 'ped-beacon-mount', sec: '14', item: '19', pn: '265573', fr: 'Support latéral du gyrophare', en: 'Stack light side mount', qty: '1', page: PG, explode: [0, 0.20, -0.18] }, [
    plXY(G.rrect(0.05, 0.085, 0.006, bxc, 1.295), -ZW - 0.005, -ZW, 'black', [{ c: [-1.415, 1.262], r: 0.0028 }, { c: [-1.385, 1.262], r: 0.0028 }, { c: [-1.40, 1.328], r: 0.0028 }]),
    m(G.sweep([[bxc, by, -ZW - 0.004], [bxc, by, -ZW - 0.024], [bxc, by + 0.016, bzc + 0.004], [bxc, by + 0.04, bzc], [bxc, 1.338, bzc]], 0.011, { radial: 16 }), 'black'),
    cylA([bxc, 1.335, bzc], [0, 1, 0], 0.022, 0.018, 'black', 28),
  ]));
  out.push(part({ id: 'ped-beacon', sec: '14', item: '24', pn: '279329', fr: 'Tour lumineuse et avertisseur TL50 (gyrophare)', en: 'TL50 tower light and buzzer (beacon)', qty: '1', page: PG, explode: [0, 0.36, -0.18],
    note: 'Dôme ambré sur socle noir, comme le voyant lumineux de la p. 7 du manuel opérateur.' }, [
    cylA([bxc, 1.353, bzc], [0, 1, 0], 0.025, 0.028, 'plastic', 32),
    cylA([bxc, 1.381, bzc], [0, 1, 0], 0.0255, 0.004, 'plasticGrey', 32),
    lathA([bxc, 1.385, bzc], [0, 1, 0], [[0, 0], [0.024, 0], [0.024, 0.036], [0.021, 0.046], [0.012, 0.053], [0, 0.055]], 'amber', 36),
  ]));
  out.push(part({ id: 'ped-hw-beacon', sec: '14', item: '22, 23', pn: 'C1077, W026', fr: 'Vis CHC #10-24 x 1 et rondelles (gyrophare)', en: 'SHCS #10-24 x 1 and washers (beacon)', qty: '6', page: PG, explode: [0, 0.20, -0.26] },
    [[-1.415, 1.262], [-1.385, 1.262], [-1.40, 1.328]].map(([x, y]) => bAt([x, y, -ZW - 0.005], [0, 0, -1], { d: 0.19 * IN, L: 1 * IN, head: 'shcs', washer: true }))));
  // câble du gyrophare (2) et passe-fil (26)
  const cable = [m(G.sweep([[bxc, by - 0.014, -ZW - 0.02], [bxc - 0.012, 1.262, -ZW - 0.012], [-1.432, 1.245, -ZW - 0.008], [-1.432, 1.245, -ZI + 0.004], [-1.40, 1.252, -0.40], [-1.30, 1.24, -0.40], [-1.17, 1.19, -0.405], [-1.10, 1.13, -0.41]], 0.003, { radial: 8 }), 'cableBlack'),
    cylA([-1.10, 1.13, -0.41], [0.6, -0.8, 0], 0.0075, 0.03, 'machined', 16)];
  out.push(part({ id: 'ped-beacon-cable', sec: '14', item: '2', pn: '252203', fr: 'Câble du gyrophare vers le panneau 24 V', en: 'Beacon to 24 V panel cable', qty: '1', page: PG, explode: [0, 0.12, -0.12], approx: true, note: 'Tracé estimé : passe-fil 26 puis intérieur du flanc -Z.' }, cable));
  out.push(part({ id: 'ped-grommet', sec: '14', item: '26', pn: '280957', fr: 'Passe-fil 3/8 po pour tôle 1/2 po', en: 'Grommet 3/8 in for 1/2 in plate', qty: '1', page: PG, explode: [0, 0, -0.08] },
    [lathA([-1.432, 1.245, -ZW - 0.0035], [0, 0, 1], [[0.0045, 0], [0.0105, 0], [0.0105, 0.0028], [0.0074, 0.0035], [0.0074, 0.0163], [0.0102, 0.0168], [0.0102, 0.0195], [0.0045, 0.0195], [0.0045, 0]], 'rubber', 20)]));
  // automate Turck (25) : bas du flanc -Z, côté arrière (sous la zone du panneau 24 V)
  const plc = { x0: -0.98, x1: -0.80, y0: 0.69, y1: 0.762, z0: -ZW - 0.0375, z1: -ZW - 0.0005 };
  const plcM = [bx(plc.x0, plc.x1, plc.y0, plc.y1, plc.z0, plc.z1, 'plastic', 0.004)];
  const plcC = [];
  for (const yy of [0.709, 0.743]) {
    for (let i = 0; i < 5; i++) plcC.push(cylA([-0.935 + i * 0.024, yy, plc.z0], [0, 0, -1], 0.0068, 0.013, 'machined', 16));
    plcC.push(cylA([-0.963, yy, plc.z0], [0, 0, -1], 0.0105, 0.016, 'machined', 20));
  }
  const plcL = [bx(-0.835, -0.808, 0.70, 0.752, plc.z0 - 0.0008, plc.z0, 'plasticLight', 0.0004)];
  out.push(part({ id: 'ped-plc', sec: '14', item: '25', pn: '279303', fr: 'Automate compact Turck', en: 'Turck compact PLC', qty: '1', page: PG, explode: [0, 0, -0.30] }, [...plcM, ...plcC, ...plcL]));
  out.push(part({ id: 'ped-hw-plc', sec: '14', item: '20, 21', pn: '236405, 236404', fr: 'Vis CHC #12-24 x 1 et rondelles (automate)', en: 'SHCS #12-24 x 1 and washers (PLC)', qty: '8', page: PG, explode: [0, 0, -0.38] },
    [[-0.972, 0.697], [-0.808, 0.697], [-0.972, 0.755], [-0.808, 0.755]].map(([x, y]) => bAt([x, y, plc.z0], [0, 0, -1], { d: 0.216 * IN, L: 1 * IN, head: 'shcs', washer: true }))));
  // module E/S (18) et télématique (28) : face intérieure du flanc +Z
  const io = [bx(-1.09, -1.03, 0.98, 1.14, ZI - 0.03, ZI, 'plastic', 0.004)];
  const ioC = [];
  for (const xx of [-1.075, -1.045]) for (const yy of [1.0, 1.04, 1.08, 1.12]) ioC.push(cylA([xx, yy, ZI - 0.03], [0, 0, -1], 0.0068, 0.012, 'machined', 16));
  ioC.push(bx(-1.088, -1.032, 1.128, 1.137, ZI - 0.0308, ZI - 0.03, 'plasticLight', 0.0003));
  out.push(part({ id: 'ped-io', sec: '14', item: '18', pn: '279302', fr: 'Module d\'entrées et sorties compact', en: 'Compact I/O module', qty: '1', page: PG, explode: [0.50, 0.05, -0.10], approx: true, note: 'Fixation non listée ; face intérieure du flanc +Z.' }, [...io, ...ioC]));
  const tel = [bx(-1.125, -0.995, 0.76, 0.86, ZI - 0.032, ZI, 'blackCast', 0.006)];
  for (let i = 0; i < 6; i++) tel.push(bx(-1.12, -1.0, 0.768 + i * 0.016, 0.772 + i * 0.016, ZI - 0.042, ZI - 0.032, 'blackCast', 0.0012));
  for (const [x, y] of [[-1.135, 0.77], [-0.985, 0.77], [-1.135, 0.85], [-0.985, 0.85]]) tel.push(bx(x - 0.01, x + 0.01, y - 0.009, y + 0.009, ZI - 0.007, ZI, 'blackCast', 0.002));
  const telC = [cylA([-1.09, 0.86, ZI - 0.016], [0, 1, 0], 0.006, 0.014, 'machined', 16), cylA([-1.03, 0.86, ZI - 0.016], [0, 1, 0], 0.006, 0.014, 'machined', 16)];
  out.push(part({ id: 'ped-telematics', sec: '14', item: '28', pn: '274863', fr: 'Unité télématique 4 canaux', en: 'Telematics unit, 4 channel', qty: '1', page: PG, explode: [0.50, -0.05, -0.10], approx: true }, [...tel, ...telC]));
  const th = [];
  for (const [x, y] of [[-1.135, 0.77], [-0.985, 0.77], [-1.135, 0.85], [-0.985, 0.85]]) { th.push(bAt([x, y, ZI - 0.007], [0, 0, -1], { d: 0.25 * IN, L: 1.5 * IN, washer: true })); th.push(...nutStack([x, y, ZW], [0, 0, 1], 0.25 * IN, true)); }
  out.push(part({ id: 'ped-hw-telem', sec: '14', item: '29, 30, 31', pn: 'W001, 237505, B048', fr: 'Vis 1/4-20 x 1 1/2, rondelles et Nylock (télématique)', en: 'HHCS 1/4-20 x 1.5, washers, Nylock (telematics)', qty: '16', page: PG, explode: [0.6, -0.05, -0.10],
    note: 'Le manuel décrit l\'item 30 « NYLOCK, 1/2-13 » : écrou 1/4-20 retenu (voir 14.4).' }, th));
  // visserie de la boîte (13, 17) et des valves de déplacement (13, 3, 16)
  const hb = [];
  for (const xm of [CB.x0 - 0.015, CB.x1 + 0.015]) for (const ym of [1.1175, 1.3625]) hb.push(bAt([xm, ym, CB.z0 + 0.0025], [0, 0, 1], { d: 0.375 * IN, L: 1 * IN, washer: true }));
  out.push(part({ id: 'ped-hw-box', sec: '14', item: '13, 17', pn: 'B142, W003', fr: 'Vis 3/8-16 x 1 et rondelles (boîte du chargeur)', en: 'HHCS 3/8-16 x 1 and washers (charger box)', qty: '8', page: PG, explode: [0, 0.08, 0.66] }, hb));
  const hd = [];
  for (const fx of FOOT_X) { hd.push(bAt([fx, FOOT_XTRA_Y, DV.zFoot + DV.t], [0, 0, 1], { d: 0.375 * IN, L: 1 * IN })); hd.push(wAt([fx, FOOT_XTRA_Y, DV.zFoot + DV.t], [0, 0, 1], { d: 0.375 * IN, od: 0.9 * IN, t: 0.003 })); hd.push(...nutStack([fx, FOOT_XTRA_Y, ZI], [0, 0, -1], 0.375 * IN)); }
  out.push(part({ id: 'ped-hw-drive', sec: '14', item: '13, 3, 16', pn: 'B142, 259704, N017', fr: 'Vis 3/8-16 x 1, rondelles Wedge-Lock et écrous (valves de déplacement)', en: 'HHCS 3/8-16 x 1, wedge-lock washers, nuts (drive valves)', qty: '8', page: PG, explode: [0, -0.02, 0.48], approx: true,
    note: 'Position estimée : 4e trou du bas de chaque patte, boulonné à travers le flanc.' }, hd));
  return out;
}

/* Boyaux entre sous-ensembles (non listés, tracé estimé). */
function linkHoses(vm, tb, dv) {
  const out = [];
  // banc 14.2.1, ports B -> raccords tournants (rangée avant)
  const pairs = [[1, -0.084], [3, 0], [5, 0.084]];
  for (const [k, zs] of pairs) {
    const w = vm.ports.work[2 * k + 1], dash = k >= 5 ? 8 : 6;
    const tip = toW2(add(w.p, w.dir, jicLen(dash)));
    const st = [BH.xc - 0.035, SW_TOP, zs];
    out.push(...hoseP([tip, [tip[0] + 0.025, tip[1] + 0.002, tip[2]], [-1.192, tip[1] - 0.03, (tip[2] + zs) / 2], [st[0], st[1] + 0.04, zs], st], { d: 0.375 * IN }));
  }
  // bloc de l'ombilical (arrière) -> bloc de délestage (C1, C2)
  const ym = (TB.y0 + TB.y1) / 2, xt = TB.x1 + jicLen(6);
  const c1 = [(DL.x0 + DL.x1) / 2, DL.y0 - jicLen(6), -0.362], c2 = [(DL.x0 + DL.x1) / 2, DL.y0 - jicLen(6), -0.318];
  out.push(...hoseP([[xt, ym, 0.03], [xt + 0.04, ym - 0.006, 0.025], [-1.10, 0.712, -0.12], [-0.90, 0.714, -0.31], [-0.83, 0.78, -0.355], [c1[0], 1.0, c1[2]], [c1[0], c1[1] - 0.03, c1[2]], c1], { d: 0.375 * IN }));
  out.push(...hoseP([[xt, ym, 0.07], [xt + 0.04, ym - 0.006, 0.068], [-1.10, 0.712, -0.08], [-0.88, 0.714, -0.27], [-0.835, 0.78, -0.31], [c2[0], 1.0, c2[2]], [c2[0], c2[1] - 0.03, c2[2]], c2], { d: 0.375 * IN }));
  return part({ id: 'ped-hoses', sec: '14', item: '', pn: '', fr: 'Boyaux entre valves et raccords (tracé estimé)', en: 'Hoses between valves and fittings (estimated route)', qty: '5', page: PG, explode: [0, 0, 0], approx: true,
    note: 'Boyaux non listés dans la nomenclature 14. Banc vers raccords tournants, ombilical vers bloc de délestage.' }, out);
}

/* ------------------------------------------------------------------ */
export function build() {
  const vm = valveMount();
  const tb = tetherBlock();
  const dvA = driveValves(tb);
  // la dérivation est dans 14.5 : récupérer son raccord du bas pour le boyau de liaison
  const dv = { botTip: add([DIV.x, DIV.y - DIV.s - 0.008, (DIV.z0 + DIV.z1) / 2], [0, -1, 0], jicLen(6)) };
  const kids = [
    weldment(),
    vm.a,
    tb.a,
    gripperHook(),
    dvA,
    bulkhead(),
    dumpLoad(),
    chargerBox(),
    ...rootParts(vm, tb),
    linkHoses(vm, tb, dv),
  ];
  return asm({ id: 'pedestal', sec: '14', item: '2', pn: '278249', fr: 'Socle (piédestal)', en: 'Pedestal', qty: '1', page: 69, explode: [0, 0, 0] }, kids);
}
