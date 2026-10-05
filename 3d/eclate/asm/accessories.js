/* RodBot LP, vue éclatée : accessoires et charge (module « accessories », préfixe acc-).
 * Sources :
 *  - Manuel de pièces PM10654, p. 7 et 8 : machine complète (repères 3, 6, 8 à 13, 18).
 *  - Manuel opérateur p. 7 (vue CAO annotée) et p. 79 (vue de côté cotée, 3,244 mm par pixel).
 *  - Manuel de pièces p. 35 (autocollant LP RODBOT), p. 36 (télécommande), p. 37 (raccords), p. 84 (trépied).
 *  - Photo de la télécommande réelle (3d/assets/photos/manette.jpg).
 * Ensembles de 1er niveau rendus : tub, rods, decalLP, decals, rcTripod, radioRemote, tether, cableKit.
 */
import { THREE, G, m, grp, aim, between, asm, part, bolt, coupler, estopButton, decal, mat, IN } from '../kit.js';
import { L } from '../layout.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const D2R = Math.PI / 180;
const lerp = (a, b, t) => a + (b - a) * t;

/* ------------------------------------------------------------------ */
/* Outils propres au module                                            */
/* ------------------------------------------------------------------ */
/** Arrondit les coins d'un polygone [[x, y, r?], ...] (r par coin, sinon r par défaut). */
function roundPoly(pts, r, n = 3) {
  const out = []; const N = pts.length;
  for (let i = 0; i < N; i++) {
    const p = pts[i], a = pts[(i - 1 + N) % N], b = pts[(i + 1) % N];
    const rc = p[2] ?? r;
    if (!rc) { out.push([p[0], p[1]]); continue; }
    const v1 = [a[0] - p[0], a[1] - p[1]], v2 = [b[0] - p[0], b[1] - p[1]];
    const l1 = Math.hypot(v1[0], v1[1]), l2 = Math.hypot(v2[0], v2[1]);
    const u1 = [v1[0] / l1, v1[1] / l1], u2 = [v2[0] / l2, v2[1] / l2];
    const ang = Math.acos(Math.max(-1, Math.min(1, u1[0] * u2[0] + u1[1] * u2[1])));
    const half = Math.tan(ang / 2);
    const d = Math.min(rc / half, Math.min(l1, l2) * 0.45);
    const s = [p[0] + u1[0] * d, p[1] + u1[1] * d], e = [p[0] + u2[0] * d, p[1] + u2[1] * d];
    for (let k = 0; k <= n; k++) {
      const t = k / n, w0 = (1 - t) * (1 - t), w1 = 2 * (1 - t) * t, w2 = t * t;
      out.push([w0 * s[0] + w1 * p[0] + w2 * e[0], w0 * s[1] + w1 * p[1] + w2 * e[1]]);
    }
  }
  return out;
}
/** Bande d'épaisseur t au-dessus d'une ligne brisée (normale à gauche du sens de parcours), raccords en onglet. */
function offsetStrip(path, t) {
  const n = path.length, nor = [];
  for (let i = 0; i < n - 1; i++) {
    const dx = path[i + 1][0] - path[i][0], dy = path[i + 1][1] - path[i][1], l = Math.hypot(dx, dy);
    nor.push([dy / l, -dx / l]);
  }
  const off = path.map((p, i) => {
    let nx, ny;
    if (i === 0) [nx, ny] = nor[0]; else if (i === n - 1) [nx, ny] = nor[n - 2];
    else {
      const a = nor[i - 1], b = nor[i]; let sx = a[0] + b[0], sy = a[1] + b[1]; const sl = Math.hypot(sx, sy);
      sx /= sl; sy /= sl; const k = 1 / (sx * a[0] + sy * a[1]); nx = sx * k; ny = sy * k;
    }
    return [p[0] + nx * t, p[1] + ny * t];
  });
  return path.concat(off.reverse());
}
/** Oriente obj : +Y local selon yDir, +Z local au plus près de zHint. */
function orient(obj, pos, yDir, zHint) {
  const y = yDir.clone().normalize();
  const z = zHint.clone().sub(y.clone().multiplyScalar(zHint.dot(y))).normalize();
  const x = new THREE.Vector3().crossVectors(y, z);
  obj.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  obj.position.copy(pos); return obj;
}
/** Cordon de soudure droit (cylindre à 6 pans) de a à b. */
function bead(a, b, r = 0.0025, mk = 'white') {
  const A = V(...a), B = V(...b), len = A.distanceTo(B);
  const g = grp([m(G.cyl(r, len, 6), mk, { p: [0, len / 2, 0] })]);
  between(g, A, B); return g;
}
/** Pavé arrondi de a à b (section w x d), +Z local au plus près de zHint. */
function barBetween(a, b, w, d, mk, r = 0.003, zHint = V(0, 0, 1)) {
  const A = V(...a), B = V(...b), len = A.distanceTo(B);
  const g = grp([m(G.box(w, len, d, r), mk, { p: [0, len / 2, 0] })]);
  return orient(g, A, B.clone().sub(A), zHint);
}
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }

/* ------------------------------------------------------------------ */
/* 1. Bac à tiges 276983                                               */
/* ------------------------------------------------------------------ */
/* Cotes relevées sur la vue cotée p. 79 (x = (489,5 - px) x 3,244 mm ; y = (643 - py) x 3,244 mm). */
const TB = {
  x0: -0.705, x1: 1.345,           // faces extérieures des parois perforées (corps du bac)
  rim0: L.tub.xMin, rim1: L.tub.xMax, // rebord supérieur des bouts, plié vers l'extérieur
  zo: 0.672, T: 0.005,             // face extérieure des flancs ; tôle 3/16 po
  yb: 0.683,                       // bas des flancs et des parois
  yt: L.tub.topY - 0.006,          // dessus des tôles, sous le rebord de 6 mm
  yLow: 0.856,                     // creux du flanc (partie basse au milieu)
  floorTop: 0.702, floorT: 0.006,  // fond à lattes
  bottom: L.tub.bottomY, pw: 0.21, ph: 0.083, // fourreaux 7,5 x 2,5 po (intérieur), tube de 10 mm
  pockets: [0.331 + L.tub.pocketPitch / 2, 0.331 - L.tub.pocketPitch / 2], // 0,788 et -0,126 (36 po d'entraxe)
};

function sidePanelGeo() {
  const { x0, x1, yb, yt, yLow, bottom, ph } = TB;
  const [pa, pb] = TB.pockets; const hw = TB.pw / 2 + 0.002, yn = bottom + ph + 0.002;
  const out = [[x0, yb, 0.004], [pb - hw, yb, 0.003], [pb - hw, yn, 0.004], [pb + hw, yn, 0.004], [pb + hw, yb, 0.003],
    [pa - hw, yb, 0.003], [pa - hw, yn, 0.004], [pa + hw, yn, 0.004], [pa + hw, yb, 0.003], [x1, yb, 0.004],
    [x1, yt, 0], [1.028, yt, 0], [0.858, yLow, 0], [-0.196, yLow, 0], [-0.358, yt, 0], [x0, yt, 0]];
  // grandes fenêtres des parties hautes (p. 79)
  const w1 = roundPoly([[1.244, 1.113], [1.055, 1.113], [0.962, 0.795], [1.244, 0.795]], 0.03, 4);
  const w2 = roundPoly([[-0.383, 1.113], [-0.589, 1.113], [-0.589, 0.795], [-0.294, 0.795]], 0.03, 4);
  return G.plate(roundPoly(out, 0.004, 2), TB.T, { holes: [{ pts: w1 }, { pts: w2 }] });
}
function tubSide(sgn) { // sgn -1 : côté -Z (panneau 24 V)
  const { x0, x1, yt, yLow, zo, T } = TB;
  const kids = [m(sidePanelGeo(), 'white', { p: [0, 0, sgn * (zo - T / 2)] })];
  const path = [[x1 - 0.035, yt], [1.028, yt], [0.858, yLow], [-0.196, yLow], [-0.358, yt], [x0 + 0.035, yt]];
  kids.push(m(G.plate(offsetStrip(path, 0.006), 0.035, { bevel: 0.0008 }), 'white', { p: [0, 0, sgn * (zo - 0.0175)] }));
  return kids;
}
let END_GEO = null;
function endWallGeo() {
  if (END_GEO) return END_GEO;
  const zi = TB.zo - TB.T, y0 = TB.yb, y1 = TB.yt;
  const cols = 16, rows = 5, mx = 0.05, myTop = 0.045, myBot = 0.075, web = 0.012, g = web / 2;
  const cw = (2 * zi - 2 * mx) / cols, ch = (y1 - y0 - myTop - myBot) / rows;
  const holes = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const u0 = -zi + mx + i * cw + g, u1 = u0 + cw - web, v0 = y0 + myBot + j * ch + g, v1 = v0 + ch - web;
    const a = u1 - u0, b = v1 - v0, c = Math.hypot(a, b);
    holes.push({ pts: roundPoly([[u0, v1], [u0, v0 + g * c / a], [u1 - g * c / b, v1]], 0.004, 2) });
    holes.push({ pts: roundPoly([[u1, v0], [u1, v1 - g * c / a], [u0 + g * c / b, v0]], 0.004, 2) });
  }
  END_GEO = G.plate(G.rrect(2 * zi, y1 - y0, 0.003, 0, (y0 + y1) / 2), TB.T, { holes, curve: 4 });
  return END_GEO;
}
function tubEnd(sgnX) { // +1 : bout du bac (+X) ; -1 : côté socle
  const { x0, x1, zo, T, yb, yt } = TB;
  const xFace = sgnX > 0 ? x1 : x0, xc = xFace - sgnX * T / 2;
  const kids = [m(endWallGeo(), 'white', { p: [xc, 0, 0], r: [0, -90, 0] })];
  const xo = sgnX > 0 ? TB.rim1 : TB.rim0, xi = xFace - sgnX * 0.035, len = Math.abs(xo - xi);
  kids.push(m(G.box(len, 0.006, 2 * zo, 0.002), 'white', { p: [(xo + xi) / 2, yt + 0.003, 0] }));
  kids.push(m(G.box(0.004, 0.016, 2 * zo, 0.0015), 'white', { p: [xo - sgnX * 0.002, yt - 0.008, 0] }));
  for (const s of [-1, 1]) {
    const x = xFace - sgnX * (T + 0.0016), z = s * (zo - T - 0.0016);
    kids.push(bead([x, yb + 0.03, z], [x, yt - 0.005, z]));
  }
  return kids;
}
function floorGeo(xa, xb) {
  const zi = TB.zo - TB.T, len = xb - xa, cx = (xa + xb) / 2;
  const holes = [-0.5, -0.1667, 0.1667, 0.5].map(zc => ({ rect: [cx, zc, len * 0.62, 0.15, 0.035] }));
  return G.plate(G.rrect(len, 2 * zi, 0.002, cx, 0), TB.floorT, { holes });
}
function floorSections() {
  const [pa, pb] = TB.pockets, h = TB.pw / 2;
  return [[pa + h, TB.x1 - TB.T], [pb + h, pa - h], [TB.x0 + TB.T, pb - h]];
}
function tubPocket(xc) {
  const { bottom, ph, zo, floorTop } = TB; const yc = bottom + ph / 2;
  const kids = [m(G.rectTube(TB.pw, ph, 2 * zo, 0.01, 0.006), 'white', { p: [xc, yc, 0], r: [90, 0, 0] })];
  const ring = G.plate(G.rrect(0.235, 0.1035, 0.008, 0, 0.01175), 0.003, { holes: [{ rect: [0, 0, 0.19, 0.063, 0.004] }] });
  for (const s of [-1, 1]) kids.push(m(ring, 'white', { p: [xc, yc, s * (zo + 0.0015)] }));
  for (const s of [-1, 1]) kids.push(bead([xc + s * (TB.pw / 2 + 0.0016), floorTop + 0.0012, -0.66], [xc + s * (TB.pw / 2 + 0.0016), floorTop + 0.0012, 0.66]));
  return kids;
}
function drawPlate(ctx, W, H) {
  ctx.fillStyle = '#ecece8'; ctx.fillRect(0, 0, W, H);
  ctx.lineWidth = H * 0.07; ctx.strokeStyle = '#1b1b1b'; rr(ctx, H * 0.08, H * 0.08, W - H * 0.16, H * 0.84, H * 0.3); ctx.stroke();
  ctx.fillStyle = '#151515'; ctx.font = `bold ${H * 0.62}px "Arial Narrow", Arial, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('38x5"x6\'', W / 2, H * 0.55);
}
function buildTub() {
  const [pa, pb] = TB.pockets;
  const note = 'Pièce de la mécano-soudure 276983 (sans numéro dans le manuel).';
  const kids = [
    part({ id: 'acc-tub-sideN', fr: 'Flanc côté panneau 24 V', en: 'Side wall, 24 V panel side', note, explode: [0, 0, -0.45] }, tubSide(-1)),
    part({ id: 'acc-tub-sideP', fr: 'Flanc côté leviers', en: 'Side wall, lever side', note, explode: [0, 0, 0.45] }, tubSide(1)),
    part({ id: 'acc-tub-endFar', fr: 'Paroi perforée du bout', en: 'Perforated end wall (far end)', note, explode: [0.42, 0, 0] }, tubEnd(1)),
    part({ id: 'acc-tub-endPed', fr: 'Paroi perforée côté socle', en: 'Perforated end wall (pedestal side)', note, explode: [-0.42, 0, 0] }, tubEnd(-1)),
    part({ id: 'acc-tub-floor', fr: 'Fond à lattes', en: 'Slatted floor', note, explode: [0, 0.12, 0] },
      floorSections().map(([xa, xb]) => m(floorGeo(xa, xb), 'white', { p: [0, TB.floorTop - TB.floorT / 2, 0], r: [90, 0, 0] }))),
    part({ id: 'acc-tub-strips', fr: 'Bandes d\'usure du fond', en: 'Floor wear strips', note, explode: [0, 0.3, 0] },
      floorSections().flatMap(([xa, xb]) => [-0.3335, 0, 0.3335].map(z => m(G.box(xb - xa - 0.012, 0.01, 0.04, 0.003), 'white', { p: [(xa + xb) / 2, TB.floorTop + 0.005, z] })))),
    part({ id: 'acc-tub-pocket-1', fr: 'Fourreau de fourche 7,5 x 2,5 po', en: 'Fork pocket 7.5 x 2.5 in', qty: '2', note: note + ' Entraxe 36 po (p. 79).', explode: [0, -0.16, 0] }, tubPocket(pa)),
    part({ id: 'acc-tub-pocket-2', fr: 'Fourreau de fourche 7,5 x 2,5 po', en: 'Fork pocket 7.5 x 2.5 in', qty: '2', note: note + ' Entraxe 36 po (p. 79).', explode: [0, -0.16, 0] }, tubPocket(pb)),
    part({ id: 'acc-tub-plate', fr: 'Plaque « 38x5"x6\' » (38 tiges)', en: 'Plate "38x5"x6\'" (38 rods)', note: 'Plaque de capacité vue p. 79 et p. 7 : 38 tiges de 5 po x 6 pi.', explode: [0, 0, -0.62] }, [
      m(G.plate(G.rrect(0.308, 0.073, 0.022), 0.003), 'white', { p: [0.331, 0.769, -(TB.zo + 0.0015)] }),
      decal({ text: '', w: 0.28, h: 0.058, px: 512, draw: drawPlate, p: [0.331, 0.769, -(TB.zo + 0.0036)], r: [0, 180, 0] }),
    ]),
  ];
  return asm({ id: 'tub', sec: '3', item: '3', pn: '276983', fr: 'Bac à tiges', en: 'Rod tub', qty: '1', page: 7, explode: [0, 0, 0],
    note: 'Mécano-soudure blanche. Cotes de la vue p. 79 du manuel opérateur.' }, kids);
}

/* ------------------------------------------------------------------ */
/* 2. Tiges de forage 5 po x 6 pi (charge, hors nomenclature)          */
/* ------------------------------------------------------------------ */
const ROD = { R: 0.0635, L: 1.829, pitch: 0.131 };
let ROD_MAT = null;
/** Acier de tige : gris foncé, un peu rugueux (calamine). Matériau propre au module. */
function rodSteel() {
  if (ROD_MAT) return ROD_MAT;
  ROD_MAT = mat('steel').clone(); ROD_MAT.color.set('#44474b'); ROD_MAT.roughness = 0.52; ROD_MAT.metalness = 0.85;
  ROD_MAT.userData = { key: 'acc-rodSteel' }; ROD_MAT.name = 'acc-rodSteel'; return ROD_MAT;
}
const ROD_GEO = {};
function rodGeos() {
  if (ROD_GEO.body) return ROD_GEO;
  const R = ROD.R, Lr = ROD.L, Lp = Lr - 0.08;
  // corps (bout femelle à y = 0, épaulement du bout mâle à y = Lp)
  ROD_GEO.body = G.lathe([[0.033, Lp - 0.005], [0.033, 0.11], [0.040, 0.10], [0.050, 0.092], [0.050, 0.006], [0.054, 0], [0.0612, 0], [R, 0.0025],
    [R, 0.15], [R + 0.0008, 0.153], [R + 0.0008, 0.175], [R, 0.178], [R, Lp - 0.178], [R + 0.0008, Lp - 0.175], [R + 0.0008, Lp - 0.153], [R, Lp - 0.15],
    [R, Lp - 0.003], [0.0605, Lp], [0.050, Lp]], 32);
  // bout mâle fileté (conique)
  const th = [[0.0505, Lp - 0.001]];
  const n = 9, y0 = Lp + 0.006, y1 = Lp + 0.07, r0 = 0.0535, r1 = 0.0465, dep = 0.0028;
  for (let k = 0; k <= 2 * n; k++) { const t = k / (2 * n); th.push([lerp(r0, r1, t) - (k % 2 === 0 ? dep : 0), lerp(y0, y1, t)]); }
  th.push([0.0445, Lr - 0.004], [0.040, Lr], [0.033, Lr], [0.033, Lp - 0.006]);
  ROD_GEO.pin = G.lathe(th, 32);
  // protecteur de filet (capuchon) et bouchon du bout femelle
  ROD_GEO.cap = G.lathe([[0.0555, Lp + 0.002], [0.060, Lp + 0.002], [0.060, Lp + 0.012], [0.0585, Lp + 0.016], [0.0585, Lp + 0.03], [0.0598, Lp + 0.033], [0.0598, Lp + 0.042], [0.0585, Lp + 0.045],
    [0.0585, Lr - 0.004], [0.0555, Lr + 0.004], [0.050, Lr + 0.008], [0, Lr + 0.008]], 32);
  ROD_GEO.plug = G.lathe([[0, -0.022], [0.018, -0.022], [0.02, -0.013], [0.056, -0.013], [0.0605, -0.010], [0.0605, -0.001], [0.049, -0.001], [0.049, 0.02]], 32);
  return ROD_GEO;
}
function rodMeshes(xc, y, z, flip, bare) {
  const g = rodGeos(); const r = [0, 0, flip ? 90 : -90];
  const p = [xc + (flip ? 1 : -1) * ROD.L / 2, y, z];
  const out = [m(g.body, rodSteel(), { p, r }), m(g.pin, 'machined', { p, r }), m(g.plug, 'blue', { p, r })];
  if (!bare) out.push(m(g.cap, 'blue', { p, r }));
  return out;
}
function buildRods() {
  const xc = 0.32, y1 = TB.bottom + TB.ph + ROD.R + 0.0005, y2 = y1 + Math.sqrt(0.129 * 0.129 - (ROD.pitch / 2) ** 2);
  const row1 = [], row2 = [];
  const dx = [0.02, -0.025, 0.01, -0.015, 0.03, -0.02, 0, 0.025, -0.01];
  for (let k = -4; k <= 4; k++) row1.push(...rodMeshes(xc + dx[k + 4], y1, k * ROD.pitch, k % 2 !== 0, k === -1 || k === 2 || k === 4));
  [-3.5, -2.5, 2.5, 3.5].forEach((k, i) => row2.push(...rodMeshes(xc + (i % 2 ? 0.035 : -0.03), y2, k * ROD.pitch, i % 2 === 0, i === 1)));
  return asm({ id: 'rods', fr: 'Tiges de forage (charge)', en: 'Drill rods (load)', explode: [0, 0, 0], note: 'Hors nomenclature. Tiges 5 po x 6 pi, couchées sur les fourreaux du bac. Protecteurs de filet bleus.' }, [
    part({ id: 'acc-rods-row1', fr: 'Tiges, rangée du bas (9)', en: 'Rods, bottom row (9)', qty: '9', note: 'Hors nomenclature.', explode: [0, 0, 0] }, row1),
    part({ id: 'acc-rods-row2', fr: 'Tiges, rangée du haut (4)', en: 'Rods, top row (4)', qty: '4', note: 'Hors nomenclature. Le milieu reste libre sous la pince.', explode: [0, 0.32, 0] }, row2),
  ]);
}

/* ------------------------------------------------------------------ */
/* 3. Autocollants 279235 (repère 13) et 281303 (repère 18)            */
/* ------------------------------------------------------------------ */
function drawLP(ctx, W, H) {
  ctx.fillStyle = '#e7e8e9'; ctx.fillRect(0, 0, W, H);
  ctx.lineWidth = H * 0.06; ctx.strokeStyle = '#3b3c3f'; rr(ctx, H * 0.05, H * 0.05, W - H * 0.1, H * 0.9, H * 0.18); ctx.stroke();
  ctx.strokeStyle = '#1f3f93'; ctx.lineCap = 'round';
  for (let k = 0; k < 3; k++) {
    ctx.lineWidth = H * (0.09 - k * 0.012); ctx.beginPath();
    ctx.moveTo(W * 0.025, H * (0.34 + 0.16 * k)); ctx.quadraticCurveTo(W * 0.07, H * (0.24 + 0.16 * k), W * 0.135, H * (0.31 + 0.16 * k)); ctx.stroke();
  }
  ctx.fillStyle = '#c3161d'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  let x = W * 0.17; const big = H * 0.66, small = H * 0.5;
  for (const [s, f] of [['LP ', big], ['R', big], ['OD', small], ['B', big], ['OT', small]]) {
    ctx.font = `italic 900 ${f}px Arial, sans-serif`; ctx.fillText(s, x, H * 0.54 + (f === small ? H * 0.06 : 0)); x += ctx.measureText(s).width;
  }
}
function drawRoger(ctx, W, H) {
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#141414';
  ctx.font = `bold ${H * 0.13}px "Arial Narrow", Arial, sans-serif`; ctx.fillText('MACHINES', W / 2, H * 0.13);
  ctx.font = `900 ${H * 0.36}px Arial, sans-serif`;
  const wR = ctx.measureText('R').width, wG = ctx.measureText('GER').width, d = H * 0.3, gap = H * 0.02;
  let x = (W - (wR + d + wG + 2 * gap)) / 2; const y = H * 0.45;
  ctx.textAlign = 'left'; ctx.fillText('R', x, y); x += wR + gap;
  ctx.fillStyle = '#d4141c'; ctx.beginPath(); ctx.arc(x + d / 2, y, d / 2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffffff'; for (const [dx, dy] of [[-0.18, 0.12], [0, -0.08], [0.18, 0.12]]) { ctx.beginPath(); ctx.arc(x + d / 2 + dx * d, y + dy * d, d * 0.1, 0, Math.PI * 2); ctx.fill(); }
  x += d + gap; ctx.fillStyle = '#141414'; ctx.fillText('GER', x, y);
  ctx.textAlign = 'center'; ctx.font = `bold ${H * 0.1}px "Arial Narrow", Arial, sans-serif`; ctx.fillText('INTERNATIONAL', W / 2, H * 0.7);
  ctx.fillStyle = '#d4141c'; ctx.fillRect(W * 0.1, H * 0.79, W * 0.8, H * 0.025);
  ctx.font = `bold ${H * 0.12}px Arial, sans-serif`; ctx.fillText('40 ANS', W / 2, H * 0.9);
}
function buildDecalLP() {
  // Flanc -Z du châssis (garde-corps rouge), entre les fourreaux, sous le bac (vue CAO p. 7, repère 13 p. 7).
  return part({ id: 'decalLP', sec: '3', item: '13', pn: '279235', fr: 'Autocollant LP RODBOT 24 x 3 po', en: 'LP RODBOT decal 24 x 3 in', qty: '1', page: 7, explode: [0, 0, 0],
    note: 'Collé sur le flanc -Z du châssis, sous le bac, entre les fourreaux (vue CAO du manuel opérateur p. 7). Placé sous l\'encoche du creux du bac.' }, [
    decal({ text: '', w: 24 * IN, h: 3 * IN, px: 1024, draw: drawLP, p: [0.015, 0.545, -(L.frame.halfWidth + 0.0015)], r: [0, 180, 0] }),
  ]);
}
function buildDecals() {
  // Vu p. 79 sous le panneau 24 V (x de -1,105 à -0,856 ; y de 0,61 à 0,756). La face rouge pleine la plus proche, visible côté -Z,
  // est l'âme de la plaque pliée 18 du châssis (frame.js, frame-plate18) : z = -0,503, x de -1,14 à -0,808, y de 0,50 à 0,645.
  // L'autocollant y est collé entre les deux colonnes de vis (x = -1,122 et -0,826), à 1 mm de la face.
  return asm({ id: 'decals', sec: '3', item: '18', fr: 'Autocollant du socle', en: 'Pedestal decal', page: 7, explode: [0, 0, 0] }, [
    part({ id: 'acc-decal-roger', sec: '3', item: '18', pn: '281303', fr: 'Autocollant Machines Roger 40e', en: 'Machines Roger 40th decal', qty: '1', page: 7, explode: [0, 0, -0.15],
      approx: true, note: 'Vu p. 79 sous le panneau 24 V. Collé sur la plaque pliée 18 du châssis (face rouge la plus proche), donc environ 10 cm plus bas que sur le dessin.' }, [
      decal({ text: '', w: 0.24, h: 0.138, px: 512, draw: drawRoger, p: [-0.974, 0.573, -0.504], r: [0, 180, 0] }),
    ]),
  ]);
}

/* ------------------------------------------------------------------ */
/* 4. Trépied 279200 et télécommande 278245                            */
/* ------------------------------------------------------------------ */
const ST = (() => {
  const P = L.remoteStation.pos;
  const to = V(0.3 - P[0], 0, -P[2]).normalize();          // l'opérateur regarde vers le bac
  return { P, yaw: Math.atan2(-to.x, -to.z) / D2R, crY: 0.97 }; // +Z local = côté opérateur
})();
function tripodLeg(az) {
  const u = V(Math.sin(az * D2R), 0, Math.cos(az * D2R));
  const Hp = u.clone().multiplyScalar(0.088).setY(0.928), Fp = u.clone().multiplyScalar(0.52).setY(0.0015);
  const Ll = Hp.distanceTo(Fp), k = [];
  k.push(m(G.box(0.05, 0.05, 0.034, 0.004), 'yellow', { p: [0, -0.02, 0.006] }));                 // tête de jambe
  k.push(m(G.cyl(0.0055, 0.064, 16), 'zinc', { p: [0, -0.006, -0.004], r: [0, 0, 90] }));            // axe d'articulation
  k.push(m(G.hex(0.014, 0.006), 'zinc', { p: [0.034, -0.006, -0.004], r: [0, 0, 90] }));
  k.push(m(G.lathe([[0, 0], [0.012, 0], [0.013, 0.004], [0.006, 0.012], [0, 0.012]], 16), 'black', { p: [-0.033, -0.006, -0.004], r: [0, 0, 90] }));
  k.push(m(G.box(0.044, 0.56, 0.03, 0.004), 'yellow', { p: [0, -0.32, 0] }));                       // jambe haute
  k.push(m(G.box(0.006, 0.5, 0.002, 0.0008), 'black', { p: [0, -0.32, 0.0155] }));                  // rainure
  k.push(m(G.box(0.054, 0.05, 0.04, 0.005), 'black', { p: [0, -0.605, 0] }));                       // collier de blocage
  k.push(grp([m(G.box(0.014, 0.075, 0.008, 0.003), 'black', { p: [0, 0.0375, 0] })], { p: [0, -0.625, 0.025], r: [-8, 0, 0] })); // levier
  k.push(m(G.cyl(0.004, 0.06, 12), 'zinc', { p: [0, -0.625, 0.022], r: [0, 0, 90] }));
  k.push(m(G.box(0.03, Ll - 0.57, 0.022, 0.003), 'alu', { p: [0, -(0.5 + Ll - 0.07) / 2, 0] }));    // jambe basse
  k.push(m(G.box(0.004, Ll - 0.66, 0.0015, 0.0006), 'steel', { p: [0, -(0.63 + Ll - 0.07) / 2, 0.0115] }));
  k.push(m(G.box(0.038, 0.06, 0.03, 0.005), 'blackCast', { p: [0, -(Ll - 0.06), 0] }));          // sabot
  k.push(grp([m(G.box(0.036, 0.008, 0.05, 0.002), 'blackOxide', { p: [0, 0, 0.025] }),
    ...[0, 1, 2, 3].map(i => m(G.box(0.034, 0.004, 0.003, 0.001), 'blackOxide', { p: [0, 0.005, 0.01 + i * 0.011] }))], { p: [0, -(Ll - 0.055), 0.015], r: [-25, 0, 0] })); // appui-pied
  k.push(m(G.cyl(0.0015, 0.032, 12, 0.011), 'steel', { p: [0, -(Ll - 0.016), 0] }));             // pointe
  if (Math.abs(az) > 170) k.push(m(G.box(0.05, 0.032, 0.036, 0.004), 'black', { p: [0, -0.4, 0] })); // sangle de jambe
  return orient(grp(k), Hp, Hp.clone().sub(Fp), u);
}
function cradleRing(ow, od, t, h, flare, r) {
  const g = G.plate(G.rrect(ow, od, r), h, { holes: [{ rect: [0, 0, ow - 2 * t, od - 2 * t, Math.max(r - t, 0.002)] }], bevel: 0.001 });
  g.rotateX(-Math.PI / 2); g.translate(0, h / 2, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const k = p.getY(i) / h; p.setX(i, p.getX(i) * (1 + flare * k / (ow / 2))); p.setZ(i, p.getZ(i) * (1 + flare * k / (od / 2))); }
  g.computeVertexNormals(); return g;
}
function drawLogo(ctx, W, H) {
  ctx.fillStyle = '#efb000'; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#141414'; ctx.lineWidth = H * 0.14; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(W * 0.18, H * 0.8); ctx.quadraticCurveTo(W * 0.3, H * 0.15, W * 0.45, H * 0.3); ctx.lineTo(W * 0.55, H * 0.62);
  ctx.quadraticCurveTo(W * 0.65, H * 0.15, W * 0.8, H * 0.3); ctx.lineTo(W * 0.86, H * 0.8); ctx.stroke();
}
function buildTripod() {
  const { P, yaw, crY } = ST;
  const stand = [
    m(G.lathe([[0, 0.902], [0.04, 0.902], [0.046, 0.91], [0.068, 0.914], [0.07, 0.94], [0.062, 0.948], [0.03, 0.95], [0, 0.95]], 32), 'blackCast'),
    m(G.lathe([[0, 0.85], [0.016, 0.85], [0.018, 0.856], [0.018, 0.902], [0, 0.902]], 20), 'blackCast'),
    ...[180, 60, -60].map(tripodLeg),
  ];
  for (const az of [180, 60, -60]) { // chapes de la tête
    const u = V(Math.sin(az * D2R), 0, Math.cos(az * D2R)), t = V(u.z, 0, -u.x);
    for (const s of [-1, 1]) stand.push(orient(grp([m(G.box(0.006, 0.03, 0.03, 0.002), 'blackCast')]), u.clone().multiplyScalar(0.08).add(t.clone().multiplyScalar(s * 0.029)).setY(0.925), V(0, 1, 0), u));
  }
  const ow = 0.412, od = 0.247, h = 0.078, fl = h * Math.tan(14 * D2R);
  const sx = 1 + fl / (ow / 2), sz = 1 + fl / (od / 2);
  const topO = [ow * sx, od * sz], topI = [(ow - 0.012) * sx, (od - 0.012) * sz];
  const cradle = [
    m(G.box(0.12, 0.012, 0.12, 0.003), 'black', { p: [0, 0.956, 0] }),
    ...[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([a, b]) => grp([bolt({ d: 0.25 * IN, L: 0.012, head: 'bhcs', mat: 'zinc' })], { p: [a * 0.045, crY + 0.0002, b * 0.045] })),
    m(G.plate(G.rrect(ow - 0.008, od - 0.008, 0.026), 0.008), 'yellow', { p: [0, crY - 0.004, 0], r: [90, 0, 0] }),
    m(cradleRing(ow, od, 0.006, h, fl, 0.03), 'yellow', { p: [0, crY - 0.008, 0] }),
    m(G.plate(G.rrect(topO[0] + 0.024, topO[1] + 0.024, 0.04), 0.006, { holes: [{ rect: [0, 0, topI[0], topI[1], 0.03] }] }), 'yellow', { p: [0, crY - 0.008 + h + 0.003, 0], r: [90, 0, 0] }),
    ...[-0.16, -0.09, 0.09, 0.16].map(x => m(G.box(0.012, 0.012, od - 0.02, 0.003), 'yellow', { p: [x, crY - 0.014, 0] })), // nervures
    ...[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([a, b]) => m(G.box(0.03, 0.004, 0.03, 0.0015), 'rubber', { p: [a * 0.15, crY + 0.002, b * 0.07] })), // patins
    decal({ text: '', w: 0.07, h: 0.045, px: 256, draw: drawLogo, p: [0.11, crY + 0.034, od / 2 + fl * 0.53 + 0.0015], r: [14, 0, 0] }),
  ];
  return asm({ id: 'rcTripod', sec: '16', item: '8', pn: '279200', fr: 'Trépied de télécommande', en: 'Remote control tripod', qty: '1', page: 84, explode: [0, 0, 0] }, [
    part({ id: 'acc-tripod-stand', sec: '16', item: '1', pn: '271785', fr: 'Trépied', en: 'Tripod', qty: '1', page: 84, explode: [0, 0, 0] }, [grp(stand, { p: P, r: [0, yaw, 0] })]),
    part({ id: 'acc-tripod-cradle', sec: '16', item: '2', pn: '280557', fr: 'Berceau de la télécommande', en: 'Remote cradle', qty: '1', page: 84, explode: [0, 0.22, 0] }, [grp(cradle, { p: P, r: [0, yaw, 0] })]),
  ]);
}

/* Télécommande 279174 : repère local, origine au fond du berceau, +Z = côté opérateur, X = largeur.
 * Disposition relevée sur la photo annotée du manuel opérateur (p. 21) et la photo de la machine :
 * 3 manettes (JS1 inclinaison, JS2 bascule de la pince, JS3 rotation), 8 interrupteurs,
 * bouton jaune TRAJ, arrêt d'urgence au centre, bouton vert PINCE, voyant d'état, écran d'état,
 * 4 boutons sur le côté gauche (COMMENCER et 3 modes) et 3 boutons de mode à droite. */
const RM = { w: 0.38, h: 0.085, d: 0.19 };
const RC = {           // positions sur la face (x, z), face à y = RM.h
  js1: [-0.118, -0.012], js2: [0, -0.024], js3: [0.118, -0.012],
  pts: [-0.052, -0.004], enr: [0.052, -0.004],
  tgl: [-0.142, -0.108, -0.074, 0.074, 0.108, 0.142], tglZ: 0.052,
  traj: [-0.042, 0.05], estop: [0, 0.038], grip: [0.042, 0.05], led: [0, 0.067],
};
function loopPt(th) {
  const c = Math.cos(th), s = Math.sin(th);
  return V(0.2 * Math.sign(c) * Math.abs(c) ** 0.55, 0.145 - 0.045 * s, 0.117 * Math.sign(s) * Math.abs(s) ** 0.55);
}
function drawFace(ctx, W, H) {
  const X = (x) => (x / 0.33 + 0.5) * W, Z = (z) => (z / 0.15 + 0.5) * H, S = W / 0.33;
  ctx.fillStyle = '#17181a'; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#3a3c40'; ctx.lineWidth = 3; rr(ctx, 4, 4, W - 8, H - 8, 14); ctx.stroke();
  const tag = (x, z, w, h, col, txt, fg = '#ffffff', size = 0.62) => {
    ctx.fillStyle = col; rr(ctx, X(x - w / 2), Z(z - h / 2), w * S, h * S, 4); ctx.fill();
    if (txt) { ctx.fillStyle = fg; ctx.font = `bold ${h * S * size}px "Arial Narrow", Arial, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(txt, X(x), Z(z), w * S * 0.92); }
  };
  const txt = (x, z, s, col = '#f2f2f2', size = 0.0046, maxW = 0.034) => { ctx.fillStyle = col; ctx.font = `bold ${size * S}px "Arial Narrow", Arial, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(s, X(x), Z(z), maxW * S); };
  // zone verte de JS2 (bascule de la pince)
  tag(RC.js2[0], RC.js2[1] + 0.002, 0.05, 0.05, '#62b34f'); tag(RC.js2[0], RC.js2[1] + 0.022, 0.044, 0.008, '#3f8a30', 'PINCE OUVRIR', '#ffffff', 0.7);
  // étiquettes de couleur autour de JS1 (inclinaison, linéaire) et de JS3 (poignet, linéaire)
  const [j1x, j1z] = RC.js1, [j3x, j3z] = RC.js3;
  tag(j1x + 0.034, j1z - 0.036, 0.04, 0.011, '#e5862b', 'LINÉAIRE');
  tag(j1x - 0.04, j1z, 0.011, 0.04, '#e5862b'); tag(j1x + 0.04, j1z + 0.006, 0.011, 0.034, '#e5862b');
  tag(j1x - 0.02, j1z + 0.034, 0.04, 0.01, '#2d6fd2', 'HAUT INCLIN.'); tag(j1x + 0.024, j1z + 0.034, 0.044, 0.01, '#e5862b', 'HAUT LINÉAIRE');
  tag(j3x - 0.022, j3z - 0.036, 0.04, 0.011, '#2d6fd2', 'POIGNET'); tag(j3x + 0.034, j3z - 0.026, 0.022, 0.011, '#e5862b', 'MAG');
  tag(j3x - 0.04, j3z + 0.004, 0.011, 0.036, '#e5862b'); tag(j3x + 0.04, j3z + 0.004, 0.011, 0.036, '#d6402b');
  tag(j3x, j3z + 0.034, 0.05, 0.01, '#2d6fd2', 'POIGNET HAUT');
  ctx.save(); for (const [x, z, s] of [[j1x - 0.04, j1z, 'LINÉAIRE G'], [j1x + 0.04, j1z + 0.006, 'LINÉAIRE D'], [j3x - 0.04, j3z + 0.004, 'LIN. RENT.'], [j3x + 0.04, j3z + 0.004, 'LIN. SORT.']]) {
    ctx.save(); ctx.translate(X(x), Z(z)); ctx.rotate(-Math.PI / 2); ctx.fillStyle = '#ffffff'; ctx.font = `bold ${0.0068 * S}px "Arial Narrow", Arial, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(s, 0, 0, 0.034 * S); ctx.restore();
  } ctx.restore();
  // interrupteurs : texte au-dessus (vers l'écran) et au-dessous (vers l'opérateur)
  const up = ['SOUS TENSION', 'RAPIDE', 'KLAXON', 'AUX 1', 'TRAVAIL AV', 'DÉP. LENTE'], dn = ['ARRÊT AIMANT', 'LENT', 'GYROPHARE', 'AUX 2', 'TRAVAIL AR', 'MÂT'];
  RC.tgl.forEach((x, i) => { txt(x, RC.tglZ - 0.0135, up[i]); txt(x, RC.tglZ + 0.016, dn[i]); });
  txt(RC.pts[0], RC.pts[1] - 0.016, 'PTS AUTO'); txt(RC.pts[0] + 0.012, RC.pts[1] - 0.004, '⇧', '#f2f2f2', 0.008); txt(RC.pts[0] + 0.012, RC.pts[1] + 0.008, '⇩', '#f2f2f2', 0.008);
  txt(RC.enr[0], RC.enr[1] - 0.016, 'ENR'); txt(RC.enr[0], RC.enr[1] + 0.017, 'SUPPRIMER');
  // boutons ronds et arrêt d'urgence
  ctx.strokeStyle = '#efb000'; ctx.lineWidth = 0.0016 * S; ctx.beginPath(); ctx.arc(X(RC.traj[0]), Z(RC.traj[1]), 0.0175 * S, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = '#62b34f'; ctx.beginPath(); ctx.arc(X(RC.grip[0]), Z(RC.grip[1]), 0.0175 * S, 0, Math.PI * 2); ctx.stroke();
  tag(RC.traj[0], RC.traj[1] + 0.023, 0.026, 0.008, '#efb000', 'TRAJ', '#101010');
  tag(RC.grip[0], RC.grip[1] + 0.023, 0.026, 0.008, '#62b34f', 'PINCE', '#101010');
  txt(RC.estop[0] - 0.03, RC.estop[1] - 0.023, 'GSS', '#efb000', 0.0062); txt(RC.estop[0] + 0.03, RC.estop[1] - 0.023, 'GSS', '#efb000', 0.0062);
}
function drawCap(lines, bg, fg, letters) {
  return (ctx, W, H) => {
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = fg; ctx.lineWidth = W * 0.035;
    ctx.beginPath(); ctx.arc(W / 2, H / 2, W * 0.4, -2.6, -0.55); ctx.stroke(); ctx.beginPath(); ctx.arc(W / 2, H / 2, W * 0.4, 0.55, 2.6); ctx.stroke();
    ctx.fillStyle = fg; ctx.font = `bold ${H * 0.16}px "Arial Narrow", Arial, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    lines.forEach((s, i) => ctx.fillText(s, W / 2, H * (0.42 + 0.18 * i)));
    if (letters) { ctx.font = `bold ${H * 0.12}px "Arial Narrow", Arial, sans-serif`; ctx.fillText(letters[0], W * 0.27, H * 0.16); ctx.fillText(letters[1], W * 0.73, H * 0.16); }
  };
}
function drawScreen(ctx, W, H) {
  ctx.fillStyle = '#0d1114'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#9aa3aa'; ctx.font = `bold ${H * 0.075}px "Arial Narrow", Arial, sans-serif`; ctx.textBaseline = 'middle';
  ctx.textAlign = 'left'; ['AIMANT', 'TRAJ', 'LINÉAIRE'].forEach((s, i) => ctx.fillText(s, W * 0.04, H * (0.26 + 0.17 * i)));
  ctx.textAlign = 'right'; ['DIRECT', 'STABS', 'DÉP. LENTE'].forEach((s, i) => ctx.fillText(s, W * 0.96, H * (0.26 + 0.17 * i)));
  ctx.fillStyle = '#d6b400'; ctx.fillRect(W * 0.04, H * 0.86, W * 0.05, H * 0.06); ctx.fillRect(W * 0.86, H * 0.86, W * 0.08, H * 0.06);
}
function toggle(x, z) {
  return grp([
    m(G.hex(0.014, 0.004), 'chrome', { p: [0, 0.002, 0] }),
    m(G.cyl(0.0058, 0.006, 16), 'chrome', { p: [0, 0.007, 0] }),
    grp([m(G.cyl(0.0019, 0.017, 10, 0.0026), 'chrome', { p: [0, 0.0085, 0] }), m(G.sphere(0.0032, 10), 'chrome', { p: [0, 0.018, 0] })], { p: [0, 0.009, 0], r: [16, 0, 0] }),
  ], { p: [x, RM.h, z] });
}
function pushButton(mk) {
  return [m(G.tube(0.0145, 0.0112, 0.006, 24), 'black', { p: [0, 0.003, 0] }), m(G.disc(0.011, 0.009, 24, 0.002), mk, { p: [0, 0.0045, 0] })];
}
/** Manette à pommeau rond (JS1, JS3), pommeau incliné vers l'opérateur. */
function joystick(cap) {
  const k = [
    m(G.lathe([[0.028, 0], [0.026, 0.006], [0.02, 0.009], [0.024, 0.014], [0.017, 0.018], [0.02, 0.023], [0.013, 0.027], [0.015, 0.031], [0.009, 0.036], [0, 0.037]], 28), 'rubber'),
    m(G.cyl(0.0065, 0.032, 16), 'black', { p: [0, 0.052, 0] }),
  ];
  const top = [
    m(G.lathe([[0, 0], [0.0225, 0], [0.024, 0.003], [0.024, 0.024], [0.0225, 0.026], [0, 0.026]], 32), cap.mat),
    m(G.disc(0.0205, 0.003, 32), cap.ring, { p: [0, 0.0275, 0] }),
    decal({ text: '', w: 0.029, h: 0.029, px: 256, bg: cap.bg, key: 'cap:' + cap.lines.join(' '), draw: drawCap(cap.lines, cap.bg, cap.fg, cap.letters), p: [0, 0.0296, 0], r: [-90, 0, 0] }),
  ];
  k.push(grp(top, { p: [0, 0.058, 0], r: [24, 0, 0] }));
  return k;
}
/** Bascule JS2 : palette noire au-dessus de la zone verte. */
function paddle() {
  const k = [
    m(G.lathe([[0.02, 0], [0.018, 0.005], [0.013, 0.008], [0.016, 0.012], [0.011, 0.016], [0.0075, 0.02], [0, 0.021]], 24), 'rubber'),
    m(G.cyl(0.0055, 0.022, 14), 'black', { p: [0, 0.028, 0] }),
    m(G.box(0.03, 0.062, 0.014, 0.006, 3), 'rubber', { p: [0, 0.066, 0] }),
  ];
  for (const y of [0.05, 0.062, 0.074]) k.push(m(G.box(0.031, 0.003, 0.0155, 0.001), 'black', { p: [0, y, 0] }));
  return k;
}
/** Bouton de côté : touche rectangulaire dans la paroi, normale (sx, 0,4, 0). */
function sideKey(sx, z, mk) {
  const n = V(sx, 0.4, 0).normalize();
  return aim(grp([m(G.box(0.022, 0.004, 0.016, 0.0015), 'black', { p: [0, 0.002, 0] }), m(G.box(0.017, 0.004, 0.011, 0.0015), mk, { p: [0, 0.005, 0] })]), V(sx * (RM.w / 2 - 0.004), 0.062, z), n);
}
/** Étiquette d'un bouton de côté, sur la bande plate du dessus, le long du bord (texte selon Z). */
function sideLabel(sx, z, text, bg, fg = '#ffffff') {
  return decal({ text, w: 0.024, h: 0.0085, px: 256, bg, fg, p: [sx * 0.1705, RM.h + 0.0008, z], r: [-90, 0, sx * 90] });
}
/** Pièces de la télécommande (repère local de la télécommande). */
function remoteParts() {
  const P = (id, fr, en, kids, o = {}) => part({ id, sec: '7', item: '4', pn: '279174', fr, en, qty: '1', page: 36, explode: o.explode || [0, 0.08, 0], ...o.meta }, kids);
  const body = [
    m(G.box(RM.w, RM.h, RM.d, 0.015, 3), 'plastic', { p: [0, RM.h / 2, 0] }),
    m(G.box(RM.w + 0.004, 0.012, RM.d + 0.004, 0.005), 'polymer', { p: [0, 0.028, 0] }), // joint de boîtier
    decal({ text: '', w: 0.33, h: 0.15, px: 1024, bg: '#17181a', key: 'remote-face', draw: drawFace, p: [0, RM.h + 0.0008, 0], r: [-90, 0, 0] }),
    m(G.cyl(0.0032, 0.003, 16), 'green', { p: [RC.led[0], RM.h + 0.0015, RC.led[1]] }),   // voyant d'état
    m(G.tube(0.025, 0.0125, 0.007, 36), 'black', { p: [RC.estop[0], RM.h + 0.0035, RC.estop[1]] }),   // collerette de l'arrêt d'urgence
  ];
  // cadre de protection en caoutchouc (anse)
  const lp = []; for (let i = 0; i < 48; i++) lp.push(loopPt(i / 48 * Math.PI * 2));
  body.push(m(G.sweep(lp, 0.013, { closed: true, radial: 12, seg: 120 }), 'rubber'));
  for (const th of [35, 145, 215, 325]) {
    const Pq = loopPt(th * D2R), B = V(Pq.x * 0.86, RM.h - 0.004, Pq.z * 0.72);
    body.push(barBetween(B.toArray(), Pq.toArray(), 0.026, 0.018, 'rubber', 0.005, V(Pq.x, 0, Pq.z)));
  }
  for (const s of [-1, 1]) body.push(m(G.box(0.05, 0.01, 0.014, 0.004), 'yellow', { p: [s * 0.085, 0.092, 0.116] })); // patins jaunes
  // anneaux de bandoulière (arrière) et prise de charge (dos)
  for (const s of [-1, 1]) body.push(m(G.torus(0.011, 0.0028, Math.PI * 2, 8, 20), 'zinc', { p: [s * (RM.w / 2 + 0.008), 0.03, -0.075], r: [0, 90, 0] }));
  body.push(m(G.cyl(0.0095, 0.012, 20), 'zinc', { p: [0.12, 0.042, -RM.d / 2 - 0.006], r: [90, 0, 0] }), m(G.disc(0.0105, 0.006, 20), 'plastic', { p: [0.12, 0.042, -RM.d / 2 - 0.014], r: [90, 0, 0] }));
  // étiquettes des boutons de côté
  body.push(sideLabel(-1, -0.05, 'DÉP. LENTE', '#2d6fd2'), sideLabel(-1, -0.022, 'STABS', '#2b2c2e'), sideLabel(-1, 0.006, 'BALAYAGE', '#2b2c2e'), sideLabel(-1, 0.045, 'COMMENCER', '#3f8a30'));
  body.push(sideLabel(1, -0.05, 'ATTENTE', '#2b2c2e'), sideLabel(1, -0.022, 'DIRECT', '#2d6fd2'), sideLabel(1, 0.006, 'LINÉAIRE', '#e5862b'));
  // écran d'état (non tactile), incliné vers l'opérateur, deux touches sur le dessus
  const screen = grp([m(G.box(0.16, 0.1, 0.028, 0.006), 'plastic'),
    decal({ text: '', w: 0.13, h: 0.072, px: 512, bg: '#0d1114', key: 'remote-screen', draw: drawScreen, p: [0, 0.006, 0.0145] }),
    m(G.box(0.006, 0.006, 0.002, 0.001), 'ledWhite', { p: [0.07, -0.042, 0.0145] }),
    m(G.box(0.014, 0.004, 0.008, 0.0015), 'plasticGrey', { p: [-0.062, 0.051, 0] }), m(G.box(0.014, 0.004, 0.008, 0.0015), 'plasticGrey', { p: [0.062, 0.051, 0] })],
  { p: [0, RM.h + 0.046, -0.07], r: [-18, 0, 0] });
  const tg = (x, z) => toggle(x, z);
  const [j1x, j1z] = RC.js1, [j2x, j2z] = RC.js2, [j3x, j3z] = RC.js3;
  const jy = RM.h + 0.008;
  const at = (kids, x, z) => grp(kids, { p: [x, RM.h, z] });
  return [
    P('acc-remote-body', 'Boîtier et anse de la télécommande', 'Remote housing and guard', body, { explode: [0, 0, 0] }),
    P('acc-remote-screen', "Écran d'état (non tactile)", 'Status display', [screen], { explode: [0, 0.07, -0.05], meta: { note: 'Témoins de mode et de batterie faible. Touches luminosité et aide (photo du manuel p. 21).' } }),
    P('acc-remote-js1', 'Manette JS1 (gauche) : inclinaison de la pince', 'JS1 joystick (left): gripper tilt', [at(joystick({ mat: 'plastic', ring: 'plasticLight', bg: '#d9d9d4', fg: '#1a1a1a', lines: ['INCL', 'PINCE'], letters: ['G', 'D'] }), j1x, j1z)],
      { explode: [0, 0.12, 0], meta: { joints: [{ id: 'ctl:js1x', type: 'rot', pivot: [j1x, jy, j1z], axis: [0, 0, -1], scale: 18 }, { id: 'ctl:js1y', type: 'rot', pivot: [j1x, jy, j1z], axis: [-1, 0, 0], scale: 18 }] } }),
    P('acc-remote-js2', 'Manette JS2 (centre) : bascule de la pince', 'JS2 paddle (centre): gripper open and close', [at(paddle(), j2x, j2z)],
      { explode: [0, 0.12, 0], meta: { note: 'Avec le bouton vert PINCE maintenu (manuel opérateur p. 55).', joint: { id: 'ctl:js2', type: 'rot', pivot: [j2x, RM.h + 0.006, j2z], axis: [-1, 0, 0], scale: 18 } } }),
    P('acc-remote-js3', 'Manette JS3 (droite) : rotation de la pince', 'JS3 joystick (right): gripper rotation', [at(joystick({ mat: 'plastic', ring: 'plastic', bg: '#2b2c2e', fg: '#e6e6e6', lines: ['ROTATION', 'PINCE'], letters: ['B', 'H'] }), j3x, j3z)],
      { explode: [0, 0.12, 0], meta: { joints: [{ id: 'ctl:js3x', type: 'rot', pivot: [j3x, jy, j3z], axis: [0, 0, -1], scale: 18 }, { id: 'ctl:js3y', type: 'rot', pivot: [j3x, jy, j3z], axis: [-1, 0, 0], scale: 18 }] } }),
    P('acc-remote-estop', "Arrêt d'urgence de la télécommande", 'Remote e-stop', [at([m(G.cyl(0.0115, 0.014, 24), 'plastic', { p: [0, 0.009, 0] }), m(G.lathe([[0, 0], [0.021, 0], [0.0218, 0.006], [0.0195, 0.014], [0, 0.0165]], 36), 'redLens', { p: [0, 0.015, 0] })], RC.estop[0], RC.estop[1])],
      { explode: [0, 0.1, 0.03], meta: { note: 'Actif seulement en mode À DISTANCE (manuel opérateur p. 12).', joint: { id: 'btn:u2', type: 'slide', axis: [0, -1, 0], scale: 0.006 } } }),
    P('acc-remote-grip', 'Bouton vert PINCE', 'Green GRIP button', [at(pushButton('green'), RC.grip[0], RC.grip[1])],
      { explode: [0, 0.08, 0.03], meta: { joint: { id: 'btn:grip', type: 'slide', axis: [0, -1, 0], scale: 0.003 } } }),
    P('acc-remote-traj', 'Bouton jaune TRAJECTOIRE', 'Yellow PATH button', [at(pushButton('yellow'), RC.traj[0], RC.traj[1])],
      { explode: [0, 0.08, 0.03], meta: { joint: { id: 'btn:traj', type: 'slide', axis: [0, -1, 0], scale: 0.003 } } }),
    P('acc-remote-horn', 'Interrupteur KLAXON / GYROPHARE', 'HORN / BEACON switch', [tg(RC.tgl[2], RC.tglZ)], { explode: [0, 0.06, 0.03] }),
    P('acc-remote-toggles', 'Interrupteurs (aimant, vitesse, trajectoire, AUX, travail, mât)', 'Switches (magnet, speed, path, AUX, work, mast)',
      [tg(RC.tgl[0], RC.tglZ), tg(RC.tgl[1], RC.tglZ), tg(RC.tgl[3], RC.tglZ), tg(RC.tgl[4], RC.tglZ), tg(RC.tgl[5], RC.tglZ), tg(RC.pts[0], RC.pts[1]), tg(RC.enr[0], RC.enr[1])],
      { explode: [0, 0.06, 0], meta: { note: '7 interrupteurs : sous tension / arrêt aimant, rapide / lent, AUX, travail AV / AR, déplacement lent / mât, PTS AUTO, ENR / SUPPRIMER.' } }),
    P('acc-remote-start', 'Bouton COMMENCER (côté gauche)', 'START button (left side)', [sideKey(-1, 0.045, 'green')],
      { explode: [-0.06, 0, 0], meta: { joint: { id: 'btn:start', type: 'slide', axis: [1, 0, 0], scale: 0.003 } } }),
    P('acc-remote-modes-left', 'Boutons de mode MARCHE, STABS, BALAYAGE', 'Mode buttons: drive, outriggers, sweep', [sideKey(-1, -0.05, 'blue'), sideKey(-1, -0.022, 'plasticLight'), sideKey(-1, 0.006, 'plasticLight')],
      { explode: [-0.06, 0, 0] }),
    P('acc-remote-mode-standby', 'Bouton de mode ATTENTE (veille)', 'STANDBY mode button', [sideKey(1, -0.05, 'plasticLight')],
      { explode: [0.06, 0, 0], meta: { joint: { id: 'btn:mode_standby', type: 'slide', axis: [-1, 0, 0], scale: 0.003 } } }),
    P('acc-remote-mode-direct', 'Bouton de mode DIRECT', 'DIRECT mode button', [sideKey(1, -0.022, 'blue')],
      { explode: [0.06, 0, 0], meta: { joint: { id: 'btn:mode_direct', type: 'slide', axis: [-1, 0, 0], scale: 0.003 } } }),
    P('acc-remote-mode-linear', 'Bouton de mode LINÉAIRE', 'LINEAR mode button', [sideKey(1, 0.006, 'orange')],
      { explode: [0.06, 0, 0], meta: { joint: { id: 'btn:mode_linear', type: 'slide', axis: [-1, 0, 0], scale: 0.003 } } }),
  ];
}
/* Batterie Autec 264305 : repère local, posée à plat, longueur selon X. */
function battery() {
  return [m(G.box(0.1, 0.032, 0.06, 0.004), 'plastic', { p: [0, 0.016, 0] }), m(G.box(0.06, 0.0012, 0.04, 0.0004), 'plasticLight', { p: [0.008, 0.0326, 0] }),
    ...[-0.012, 0, 0.012].map(z => m(G.box(0.0016, 0.006, 0.006, 0.0005), 'brass', { p: [-0.0508, 0.016, z] }))];
}
function buildRemote() {
  const { P, yaw, crY } = ST;
  const q = new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), yaw * D2R);
  const back = V(0, 0, -1).applyQuaternion(q);
  const KZ = L.kitZone;
  const strapPts = new THREE.CatmullRomCurve3([V(0.64, 0, 1.6), V(0.73, 0, 1.67), V(0.83, 0, 1.63), V(0.93, 0, 1.69), V(1.02, 0, 1.66), V(1.055, 0, 1.6)]).getSpacedPoints(26);
  // sangle : tube aplati (section 34 x 3,2 mm) le long d'une courbe posée au sol
  const strap = [m(G.sweep(strapPts.map(q => q.clone().setY(0)), 0.017, { radial: 12, seg: 60 }), 'polymer', { p: [0, 0.0017, 0], s: [1, 0.0032 / 0.034, 1] })];
  const mid = strapPts[13], dir = strapPts[16].clone().sub(strapPts[10]);
  strap.push(orient(grp([m(G.box(0.058, 0.17, 0.012, 0.005), 'rubber')]), mid.clone().setY(0.0062), dir, V(0, 1, 0)));
  for (const [i, j] of [[0, 1], [strapPts.length - 1, strapPts.length - 2]]) {
    const a = strapPts[i], d = a.clone().sub(strapPts[j]).normalize();
    strap.push(orient(grp([m(G.torus(0.012, 0.0025, Math.PI * 1.6, 8, 18), 'zinc', { p: [0, 0.022, 0] }), m(G.box(0.02, 0.012, 0.004, 0.0015), 'plastic', { p: [0, 0.004, 0] })]), a.clone().setY(0.0025), d, V(0, 1, 0)));
  }
  const charger = [
    m(G.box(0.2, 0.07, 0.12, 0.008), 'plastic', { p: [0, 0.035, 0] }),
    m(G.box(0.118, 0.004, 0.072, 0.002), 'plasticGrey', { p: [0.02, 0.0705, 0] }),
    m(G.box(0.006, 0.006, 0.002, 0.001), 'green', { p: [-0.07, 0.05, 0.0605] }), m(G.box(0.006, 0.006, 0.002, 0.001), 'redLens', { p: [-0.055, 0.05, 0.0605] }),
    m(G.box(0.08, 0.016, 0.0015, 0.0005), 'plasticGrey', { p: [0.03, 0.03, 0.0603] }),
    m(G.cyl(0.006, 0.016, 16), 'plastic', { p: [-0.106, 0.025, 0], r: [0, 0, 90] }),
  ];
  const receiver = [
    m(G.box(0.24, 0.06, 0.16, 0.006), 'plasticGrey', { p: [0, 0.03, 0] }),
    m(G.box(0.246, 0.018, 0.166, 0.006), 'plasticLight', { p: [0, 0.069, 0] }),
    m(G.box(0.05, 0.0012, 0.03, 0.0004), 'plastic', { p: [0.06, 0.0784, -0.03] }),
    ...[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([a, b]) => grp([bolt({ d: 0.16 * IN, L: 0.01, head: 'bhcs', mat: 'zincClear' })], { p: [a * 0.108, 0.0782, b * 0.068] })),
    ...[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([a, b]) => m(G.box(0.024, 0.006, 0.02, 0.002), 'plasticGrey', { p: [a * 0.128, 0.003, b * 0.06] })),
  ];
  [-0.07, 0, 0.07].forEach((x, i) => {
    receiver.push(m(G.lathe([[0, 0], [0.011, 0], [0.011, 0.008], [0.0125, 0.008], [0.0125, 0.02], [0.009, 0.022], [0, 0.022]], 24), 'zincClear', { p: [x, 0.032, 0.08], r: [90, 0, 0] }));
    receiver.push(m(G.lathe([[0, 0], [0.0135, 0], [0.0135, 0.014], [0.012, 0.016], [0, 0.016]], 24), i === 1 ? 'redDark' : 'plastic', { p: [x, 0.032, 0.093], r: [90, 0, 0] }));
  });
  const kidsAt = (arr, x, z, ry = 0) => [grp(arr, { p: [x, KZ.y, z], r: [0, ry, 0] })];
  const remote = grp(remoteParts(), { p: [P[0], crY + 0.004, P[2]], r: [0, yaw, 0] }); // posée sur 4 patins de 4 mm
  const bat1 = grp([grp(battery(), { p: [0, 0, -0.05], r: [0, 90, 0] })], { p: [P[0], crY + 0.008, P[2]], r: [0, yaw, 0] });
  return asm({ id: 'radioRemote', sec: '7', item: '12', pn: '278245', fr: 'Télécommande radio', en: 'Radio remote kit', qty: '1', page: 36, explode: [0, 0, 0],
    note: 'Télécommande posée sur le trépied. Chargeur, batteries, récepteur et bandoulière posés au sol avec les articles livrés à part.' }, [
    asm({ id: 'acc-remote-unit', sec: '7', item: '4', pn: '279174', fr: 'Télécommande (française)', en: 'Remote control (French)', qty: '1', page: 36, explode: [0, 0.32, 0],
      note: 'Trois manettes (JS1, JS2, JS3), 8 interrupteurs, arrêt d\'urgence au centre en bas, 7 boutons de côté (photo annotée du manuel opérateur p. 21).' }, [remote]),
    part({ id: 'acc-remote-battery-1', sec: '7', item: '3', pn: '264305', fr: 'Batterie (dans la télécommande)', en: 'Battery (in the remote)', qty: '4', page: 36, approx: true,
      explode: back.clone().multiplyScalar(0.16).add(V(0, 0.32, 0)).toArray() }, [bat1]),
    part({ id: 'acc-remote-charger', sec: '7', item: '1', pn: '264306', fr: 'Chargeur de batterie', en: 'Battery charger', qty: '1', page: 36, approx: true, explode: [0, 0, 0] }, kidsAt(charger, 0.72, 1.22)),
    part({ id: 'acc-remote-battery-2', sec: '7', item: '3', pn: '264305', fr: 'Batterie (dans le chargeur)', en: 'Battery (in the charger)', qty: '4', page: 36, explode: [0, 0.12, 0] }, kidsAt(battery(), 0.74, 1.22).map(g => { g.position.y = 0.06; return g; })),
    part({ id: 'acc-remote-battery-3', sec: '7', item: '3', pn: '264305', fr: 'Batterie de rechange', en: 'Spare battery', qty: '4', page: 36, explode: [0, 0, 0] }, kidsAt(battery(), 0.68, 1.43, 8)),
    part({ id: 'acc-remote-battery-4', sec: '7', item: '3', pn: '264305', fr: 'Batterie de rechange', en: 'Spare battery', qty: '4', page: 36, explode: [0, 0, 0] }, kidsAt(battery(), 0.81, 1.44, -5)),
    part({ id: 'acc-remote-receiver', sec: '7', item: '5', pn: '263580', fr: 'Récepteur radio', en: 'Radio receiver', qty: '1', page: 36, approx: true, explode: [0, 0, 0],
      note: 'Livré à part. Son emplacement sur la machine n\'est pas montré.' }, kidsAt(receiver, 0.95, 1.255)),
    part({ id: 'acc-remote-strap', sec: '7', item: '2', pn: '264307', fr: 'Bandoulière', en: 'Shoulder strap', qty: '1', page: 36, approx: true, explode: [0, 0, 0] }, strap),
  ]);
}

/* ------------------------------------------------------------------ */
/* 5. Ombilical 10 m 278232 (4 boyaux gainés)                          */
/* ------------------------------------------------------------------ */
/* Ports de l'ombilical sur la face avant du bloc du socle (pedestal.js, nœud ped-tb) :
 * bouts des raccords JIC à x = -1,505, y = 0,719 ; P et T (taille 12) à z = -0,075 et -0,02 ; Dr et LS (taille 6) à z = 0,045 et 0,095. */
const TPORT = { x: -1.505, y: 0.719 };
function buildTether() {
  const C = L.tether.coil, PX = TPORT.x, PY = TPORT.y;
  const HO = [
    { n: 'P', r: 0.0155, d: 0.75 * IN, z: -0.075, off: [0.014, -0.012], lat: -0.066 },
    { n: 'T', r: 0.0155, d: 0.75 * IN, z: -0.02, off: [-0.014, -0.012], lat: -0.02 },
    { n: 'Dr', r: 0.0095, d: 0.375 * IN, z: 0.045, off: [0.012, 0.016], lat: 0.024 },
    { n: 'LS', r: 0.0095, d: 0.375 * IN, z: 0.095, off: [-0.012, 0.016], lat: 0.062 },
  ];
  // axe du faisceau : descente devant le socle, puis rouleau de 3,15 tours au sol
  const pts = [V(-1.86, 0.62, 0.01), V(-1.93, 0.48, 0.0), V(-1.99, 0.30, -0.02), V(-2.05, 0.13, -0.04), V(-2.14, 0.055, -0.08),
    V(-2.32, 0.046, -0.16), V(-2.55, 0.046, -0.25)];
  const a0 = 100, turns = 3.15, R0 = 0.37, pitch = 0.095, aEnd = a0 + turns * 360;
  const at = (a, r, y) => V(C[0] + r * Math.cos(a * D2R), y, C[2] + r * Math.sin(a * D2R));
  for (let a = a0; a <= aEnd + 1e-6; a += 15) pts.push(at(a, R0 + 0.01 * Math.sin(a * D2R * 2.3), 0.046 + (a - a0) / 360 * pitch));
  const yTop = 0.046 + turns * pitch;
  for (const [da, r, y] of [[20, 0.45, yTop - 0.01], [42, 0.56, yTop - 0.09], [60, 0.69, 0.13], [72, 0.82, 0.05], [82, 0.95, 0.041]]) pts.push(at(aEnd + da, r, y));
  const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
  const Lt = curve.getLength();
  const sample = (ua, ub, step) => { const n = Math.max(2, Math.ceil((ub - ua) * Lt / step)); const o = []; for (let i = 0; i <= n; i++) o.push(curve.getPointAt(ua + (ub - ua) * i / n)); return o; };
  const us = 6.0 / Lt;
  const w1 = sample(0, us, 0.035), w2 = sample(us - 0.04 / Lt, 1, 0.035);
  const wrap45 = [m(G.sweep(w1, 0.046, { radial: 12, seg: w1.length }), 'polymer')];
  const wrap35 = [m(G.sweep(w2, 0.041, { radial: 12, seg: w2.length }), 'polymer')];
  // boyaux dans le faisceau (repère de Frenet le long de l'axe), avec légère torsion ;
  // phase choisie pour que les gros boyaux (P, T) entrent côté -Z, comme leurs ports
  const N = Math.ceil(Lt / 0.05), fr = curve.computeFrenetFrames(N, false);
  const tau0 = Math.atan2(-fr.normals[0].z, fr.binormals[0].z);
  const E = curve.getPointAt(1), TE = curve.getTangentAt(1), TEh = V(TE.x, 0, TE.z).normalize(), side = V(-TEh.z, 0, TEh.x);
  const ferrule = (h) => grp([m(G.lathe([[0, 0], [h.r * 1.25, 0], [h.r * 1.25, 0.03], [h.r * 1.05, 0.036], [0, 0.036]], 20), 'zincClear')]);
  const hoses = [];
  HO.forEach((h, idx) => {
    const cR = h.d * 1.25 + 0.004; // rayon hors tout du coupleur (coins de l'hexagone) : il repose au sol
    const offAt = (i) => { const s = i / N * Lt, tau = tau0 + 0.35 * s, [a, c] = h.off; return fr.normals[i].clone().multiplyScalar(a * Math.cos(tau) - c * Math.sin(tau)).add(fr.binormals[i].clone().multiplyScalar(a * Math.sin(tau) + c * Math.cos(tau))); };
    const o0 = curve.getPointAt(0).add(offAt(0));
    const hp = [V(PX - 0.135, PY, h.z), V(PX - 0.19, PY - 0.002, lerp(h.z, o0.z, 0.25)), V(PX - 0.25, PY - 0.016, lerp(h.z, o0.z, 0.55)), V(PX - 0.30, PY - 0.05, lerp(h.z, o0.z, 0.85))];
    for (let i = 0; i <= N; i++) hp.push(curve.getPointAt(i / N).add(offAt(i)));
    const o1 = offAt(N), L1 = 0.3 + idx * 0.02;
    for (const s of [0.06, 0.13, 0.2, L1 - 0.03, L1]) {
      const t = Math.min(1, s / 0.2), p = E.clone().addScaledVector(TEh, s).addScaledVector(o1, 1 - t).addScaledVector(side, h.lat * t);
      p.y = lerp(E.y + o1.y, s >= L1 - 0.031 ? cR : h.r, t); hp.push(p);
    }
    hp.forEach(q => { q.y = Math.max(q.y, h.r + 0.002); });
    hoses.push(m(G.sweep(hp, h.r, { radial: 7, seg: Math.ceil(hp.length * 1.4) }), 'hose'));
    // côté socle : paire de coupleurs accouplée, vissée sur le raccord JIC du port (axe vers -X), puis virole sertie
    hoses.push(aim(coupler({ d: h.d, male: true }), [PX - 0.016, PY, h.z], [-1, 0, 0]));
    hoses.push(aim(ferrule(h), [PX - 0.128, PY, h.z], [-1, 0, 0]));
    // bout libre : virole, coupleur mâle et bouchon anti-poussière
    const tip = E.clone().addScaledVector(TEh, L1).addScaledVector(side, h.lat); tip.y = cR;
    hoses.push(aim(ferrule(h), tip.clone(), TEh.clone().negate()));
    const cp = grp([coupler({ d: h.d, male: true }), m(G.lathe([[0, 0.07], [h.d * 0.9 * 0.72, 0.07], [h.d * 0.9 * 0.72, 0.118], [h.d * 0.9 * 0.6, 0.122], [0, 0.122]], 20), 'plastic')]);
    hoses.push(aim(cp, tip.clone().addScaledVector(TEh, 0.017), TEh));
  });
  return asm({ id: 'tether', sec: '3', item: '11', pn: '278232', fr: 'Ombilical 10 m (4 boyaux gainés)', en: '10 m tether (4 wrapped hoses)', qty: '1', page: 7, explode: [0, 0, 0],
    note: `Branché sur les ports P, T, Dr et LS du bloc de l'ombilical (avant du socle), puis enroulé au sol. Longueur modélisée : ${(Lt + 0.65).toFixed(1)} m.` }, [
    part({ id: 'acc-tether-hoses', fr: 'Boyaux (4) et coupleurs', en: 'Hoses (4) and couplers', approx: true, explode: [0, 0, 0],
      note: 'Pièces de l\'ombilical 278232 sans repère. Boyaux taille 12 (P, T) et taille 6 (Dr, LS), comme les ports du bloc 277898 (p. 75). La plaque 278240 (p. 37) montre un #16 : écart possible.' }, hoses),
    part({ id: 'acc-tether-wrap45', sec: '3', item: '9', pn: '245568', fr: 'Gaine 4-1/2 po x 25 pi', en: 'Hose wrap 4-1/2 in x 25 ft', qty: '1', page: 7, approx: true, explode: [0, 0.2, 0],
      note: 'Non dessinée p. 7. Placée sur la partie côté machine (estimation).' }, wrap45),
    part({ id: 'acc-tether-wrap35', sec: '3', item: '10', pn: '245567', fr: 'Gaine 3-1/2 po x 25 pi', en: 'Hose wrap 3-1/2 in x 25 ft', qty: '1', page: 7, approx: true, explode: [0, 0.2, 0],
      note: 'Non dessinée p. 7. Placée sur la partie du bout libre (estimation).' }, wrap35),
  ]);
}

/* ------------------------------------------------------------------ */
/* 6. Câbles 281921 (repère 6) : rangée posée au sol                   */
/* ------------------------------------------------------------------ */
function buildCableKit() {
  const k = [];
  const lens = [0.56, 0.38, 0.48, 0.3, 0.52, 0.42, 0.34, 0.58, 0.44, 0.36, 0.5, 0.4];
  const z0 = 1.1;
  lens.forEach((len, i) => {
    const x = 1.115 + i * 0.027, big = i % 4 === 3;
    const rc = big ? 0.0048 : 0.0033, rk = big ? 0.0105 : 0.0082;
    const mk = ['cableYellow', 'cableGrey', 'cableBlack'][i % 3];
    const pts = [];
    for (let j = 0; j <= 8; j++) { const t = j / 8; pts.push([x + 0.004 * Math.sin(t * 7 + i), j === 0 || j === 8 ? rk : rc + 0.0003, z0 + 0.04 + t * (len - 0.08)]); }
    k.push(m(G.sweep(pts, rc, { radial: 6, seg: 22 }), mk));
    for (const [zz, s] of [[z0, 1], [z0 + len, -1]]) {
      k.push(m(G.cyl(rk * 0.82, 0.03, 16), big ? 'yellow' : 'plastic', { p: [x, rk, zz + s * 0.028], r: [90, 0, 0] }));
      k.push(m(G.cyl(rk, 0.013, 16), 'zinc', { p: [x, rk, zz + s * 0.0065], r: [90, 0, 0] }));
    }
  });
  return asm({ id: 'cableKit', sec: '3', item: '6', pn: '281921', fr: 'Câbles Machines Roger', en: 'Machines Roger cable set', qty: '1', page: 7, approx: true, explode: [0, 0, 0],
    note: 'Dessiné p. 7 comme une longue rangée de câbles. Ici 12 câbles représentatifs, longueurs estimées.' }, [
    part({ id: 'acc-cables', fr: 'Câbles avec connecteurs', en: 'Cables with connectors', approx: true, explode: [0, 0, 0] }, k),
  ]);
}

export function build() {
  return [buildTub(), buildRods(), buildDecalLP(), buildDecals(), buildTripod(), buildRemote(), buildTether(), buildCableKit()];
}
