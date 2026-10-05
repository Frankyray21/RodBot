/* RodBot LP, vue éclatée : ensembles électriques.
 * Sources : manuel de pièces PM10654, p. 7 (vue d'ensemble), 9 (panneau d'alimentation), 37 (plaque de raccords
 * rapides), 38 à 44 (panneau 24 V, PPU, borniers, cadre d'écran), 35 (autocollants FR), 66 (trousse de câbles),
 * 68 (couvercle souple), 83 (support du panneau), 85 (pièces critiques). Manuel opérateur p. 14 (photo de la porte
 * et de l'intérieur), p. 11 (arrêt d'urgence sous l'écran) et p. 79 (vue de côté cotée).
 * Repère : Y vers le haut, X = longueur (socle à -X), Z = largeur (porte du panneau 24 V vers -Z).
 */
import { THREE, G, m, grp, aim, bolt, nut, washer, asm, part, IN } from '../kit.js';
import { L } from '../layout.js';

/* ------------------------------------------------------------------ */
/* Outils locaux                                                       */
/* ------------------------------------------------------------------ */
const V = (a) => (a && a.isVector3) ? a : new THREE.Vector3(...a);
const LM = {};
/** Matériau propre au module (clé unique pour la fusion par matériau). */
function lmat(key, params) {
  if (LM[key]) return LM[key];
  const mm = new THREE.MeshPhysicalMaterial(params); mm.userData.key = 'elec:' + key; mm.name = key;
  return (LM[key] = mm);
}
const MT = {
  cyan: () => lmat('cyan', { color: '#2b9fd0', roughness: 0.42, clearcoat: 0.2 }),
  sky: () => lmat('sky', { color: '#3fa9e6', roughness: 0.3, clearcoat: 0.5 }),
  redPl: () => lmat('redPl', { color: '#c41d1d', roughness: 0.45 }),
  yellowPl: () => lmat('yellowPl', { color: '#e8bd16', roughness: 0.45, clearcoat: 0.15 }),
  duct: () => lmat('duct', { color: '#b9bcbc', roughness: 0.62 }),
  wireBlue: () => lmat('wireBlue', { color: '#2b58ad', roughness: 0.5 }),
  wireWhite: () => lmat('wireWhite', { color: '#dcdcd6', roughness: 0.5 }),
  ledGreen: () => lmat('ledGreen', { color: '#39d353', roughness: 0.2, emissive: '#22c040', emissiveIntensity: 0.9 }),
  vinyl: () => lmat('vinyl', { color: '#f2f7f8', roughness: 0.08, metalness: 0, clearcoat: 0.6, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide }),
  greenPl: () => lmat('greenPl', { color: '#2f9b46', roughness: 0.5 }),
  profinet: () => lmat('profinet', { color: '#2e8a3e', roughness: 0.55 }),
  devnet: () => lmat('devnet', { color: '#8c8f93', roughness: 0.55 }),
};
/** Matériau à texture canvas (autocollant, écran). */
function cmat(key, pw, ph, draw, { alpha = false, emissive = 0, rough = 0.42, clear = 0.35 } = {}) {
  if (LM[key]) return LM[key];
  const c = document.createElement('canvas'); c.width = pw; c.height = ph;
  const ctx = c.getContext('2d'); draw(ctx, pw, ph);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  const p = { map: t, roughness: rough, clearcoat: clear, clearcoatRoughness: 0.2, polygonOffset: true, polygonOffsetFactor: -2 };
  if (alpha) p.alphaTest = 0.5;
  if (emissive) { p.emissive = new THREE.Color('#ffffff'); p.emissiveMap = t; p.emissiveIntensity = emissive; }
  const mm = new THREE.MeshPhysicalMaterial(p); mm.userData.key = 'elec:' + key; mm.userData.keepUV = true; mm.name = key;
  return (LM[key] = mm);
}
/** Applique une base locale (ex, ey ; ez = ex × ey) et une position à une géométrie. */
function orient(geo, ex, ey, p = [0, 0, 0]) {
  const X = V(ex).clone().normalize(), Y = V(ey).clone().normalize(), Z = new THREE.Vector3().crossVectors(X, Y);
  const mx = new THREE.Matrix4().makeBasis(X, Y, Z); mx.setPosition(V(p)); return geo.applyMatrix4(mx);
}
function shapeOf(pts) { const s = new THREE.Shape(); pts.forEach(([x, y], i) => i ? s.lineTo(x, y) : s.moveTo(x, y)); s.closePath(); return s; }
/** Bande mince (épaisseur t) le long d'une ligne brisée 2D, renvoie un contour fermé. */
function stripShape(pts, t) {
  const n = pts.length, A = [], B = [];
  const nrm = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return [-dy / l, dx / l]; };
  for (let i = 0; i < n; i++) {
    let nx, ny, k = 1;
    if (i === 0) [nx, ny] = nrm(pts[0], pts[1]);
    else if (i === n - 1) [nx, ny] = nrm(pts[n - 2], pts[n - 1]);
    else {
      const n1 = nrm(pts[i - 1], pts[i]), n2 = nrm(pts[i], pts[i + 1]);
      nx = n1[0] + n2[0]; ny = n1[1] + n2[1]; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
      k = 1 / Math.max(0.3, nx * n1[0] + ny * n1[1]);
    }
    A.push([pts[i][0] + nx * t / 2 * k, pts[i][1] + ny * t / 2 * k]);
    B.push([pts[i][0] - nx * t / 2 * k, pts[i][1] - ny * t / 2 * k]);
  }
  return shapeOf([...A, ...B.reverse()]);
}
function arc(cx, cy, r, a0, a1, n) { const o = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; o.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } return o; }
/** Profilé mince : ligne brisée (x local = axe ex, y local = axe ey), extrudé sur len selon ex × ey, centré. */
function profile(pts, t, len, ex, ey, p) {
  const g = new THREE.ExtrudeGeometry(stripShape(pts, t), { depth: len, bevelEnabled: false, curveSegments: 4 });
  g.translate(0, 0, -len / 2); return orient(g, ex, ey, p);
}
/** Quadrilatères à normales plates (double face si both). */
function quadGeo(quads, both = false) {
  const pos = [];
  for (const [a, b, c, d] of quads) {
    pos.push(...a, ...b, ...c, ...a, ...c, ...d);
    if (both) pos.push(...a, ...c, ...b, ...a, ...d, ...c);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(pos.length / 3 * 2), 2));
  g.computeVertexNormals(); return g;
}
/** Plan texturé : ex = droite du texte, ey = haut du texte (la normale = ex × ey). */
function plane(w, h, mt, ex, ey, p) { return new THREE.Mesh(orient(new THREE.PlaneGeometry(w, h), ex, ey, p), mt); }
const box = (w, h, d, mk, p, r = 0.0005, seg = 1) => m(G.box(w, h, d, r, seg), mk, { p });
const cylAxis = (r, h, mk, p, dir, seg = 20) => aim(m(G.cyl(r, h, seg), mk), p, dir);
function rrectPath(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
const FONT = '"Arial Narrow", "Liberation Sans Narrow", Arial, "Liberation Sans", sans-serif';
function txt(ctx, s, x, y, size, { color = '#000', weight = 'bold', align = 'center', maxW = null } = {}) {
  ctx.fillStyle = color; ctx.font = `${weight} ${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'middle';
  if (maxW) ctx.fillText(s, x, y, maxW); else ctx.fillText(s, x, y);
}

/* ------------------------------------------------------------------ */
/* Cotes du panneau 24 V (279182)                                      */
/* ------------------------------------------------------------------ */
const P24 = L.panel24;
const CX = P24.cx, CY = P24.cy;
const BW = 0.508, BH = 0.508;            // boîtier 20 x 20 po (279593, 20X20X08)
const ZB = -0.515;                        // face arrière du boîtier (côté socle)
const ZF = -0.718;                        // bord avant du corps (8 po de profondeur)
const ZD = P24.faceZ;                     // face avant de la porte (-0,735)
const TW = 0.0019;                        // tôle 14 ga
const BPZ = -0.530;                       // face avant du fond de montage
/* Repère de la porte : u vers la droite de l'opérateur (vers -X), v vers le haut. */
const D = (u, v, z) => [CX - u, CY + v, z];
/* Repère du fond de montage : d = saillie vers la porte (vers -Z). */
const BP = (u, v, d) => [CX - u, CY + v, BPZ - d];
const bpBox = (wu, hv, dd, u, v, d0, mk, r = 0.0005) => box(wu, hv, dd, mk, BP(u, v, d0 + dd / 2), r);
const OUT = [0, 0, -1];                   // normale de la porte

/* Implantation de la porte (photo du manuel opérateur p. 14, dessin p. 38). */
const DOOR = {
  hmi: [0, 0.048], flange: [0.340, 0.262], bezel: [0.285, 0.198], active: [0.224, 0.134],
  pb: [-0.077, -0.142], sel: [0.082, -0.137], estop: [0, -0.169],
  lbl24: [0, -0.110, 0.076, 0.044], pm: [-0.176, -0.157, 0.100, 0.142], warn: [0.160, -0.1985, 0.140, 0.064],
};

/* ------------------------------------------------------------------ */
/* Autocollants et écran (textures canvas)                             */
/* ------------------------------------------------------------------ */
function drawHMI(ctx, W, H) {
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#16202b'); g.addColorStop(1, '#0c1117');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#1f2c3a'; ctx.fillRect(0, 0, W, 54);
  txt(ctx, '2026-10-05', 190, 27, 22, { color: '#9fb0c2', weight: 'normal' });
  ctx.strokeStyle = '#7d93ab'; ctx.lineWidth = 2; rrectPath(ctx, 380, 8, 280, 38, 6); ctx.stroke();
  txt(ctx, 'Standby', 520, 28, 24, { color: '#ffffff' });
  txt(ctx, '08:42', 960, 27, 22, { color: '#9fb0c2', weight: 'normal' });
  const menu = ['Settings', 'Diagnostics', 'Alarms', 'Calibration', 'Login', 'Path View'];
  menu.forEach((s, i) => {
    const y = 66 + i * 86; ctx.strokeStyle = '#4c6178'; ctx.lineWidth = 2; rrectPath(ctx, 12, y, 128, 78, 6); ctx.stroke();
    ctx.strokeStyle = '#c8d4e0'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(76, y + 30, 16, 0, Math.PI * 2); ctx.stroke();
    txt(ctx, s, 76, y + 64, 16, { color: '#c8d4e0', weight: 'normal' });
  });
  // Silhouette de la machine (vue de côté simplifiée)
  ctx.fillStyle = '#8fa2b6';
  rrectPath(ctx, 300, 420, 440, 74, 37); ctx.fill();
  ctx.fillStyle = '#1a2330'; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(340 + i * 72, 457, 20, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#a9b9ca'; ctx.fillRect(290, 392, 470, 26);
  ctx.beginPath(); ctx.moveTo(330, 392); ctx.lineTo(300, 300); ctx.lineTo(620, 300); ctx.lineTo(600, 392); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#1a2330'; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(340 + i * 54, 380); ctx.lineTo(366 + i * 54, 316); ctx.lineTo(392 + i * 54, 380); ctx.closePath(); ctx.fill(); }
  ctx.fillStyle = '#b8c6d4'; ctx.fillRect(630, 250, 110, 142);
  ctx.fillStyle = '#c2cfdc'; ctx.fillRect(660, 222, 60, 30);
  ctx.save(); ctx.translate(690, 226); ctx.rotate(-0.08); ctx.fillRect(-400, -14, 410, 28); ctx.restore();
  ctx.fillRect(282, 210, 26, 70); ctx.fillRect(268, 278, 54, 46);
  // Icône radio et batterie
  ctx.strokeStyle = '#5fd17a'; ctx.lineWidth = 4; for (let i = 1; i <= 3; i++) { ctx.beginPath(); ctx.arc(860, 150, i * 12, -2.3, -0.84); ctx.stroke(); }
  ctx.strokeStyle = '#c8d4e0'; ctx.lineWidth = 3; ctx.strokeRect(910, 128, 64, 30); ctx.fillStyle = '#5fd17a'; ctx.fillRect(914, 132, 44, 22);
  txt(ctx, 'MEDATECH', 690, 548, 26, { color: '#dfe7ef' });
  txt(ctx, 'BORTERRA', 860, 548, 30, { color: '#e33a3a' });
}
function drawLabel24(ctx, W, H) {
  ctx.fillStyle = '#f5a51c'; ctx.fillRect(0, 0, W, H);
  txt(ctx, '+24', W / 2, H * 0.3, H * 0.42); txt(ctx, 'VOLTS', W / 2, H * 0.74, H * 0.44);
}
function tagDraw(lines, small) {
  return (ctx, W, H) => {
    // étiquette noire : haut droit arrondi, bas en demi-cercle, trou du bouton
    const r = W / 2, cyB = H - r;
    ctx.fillStyle = '#121212'; ctx.beginPath(); ctx.moveTo(0, W * 0.12); ctx.arcTo(0, 0, W, 0, W * 0.12); ctx.arcTo(W, 0, W, H, W * 0.12);
    ctx.lineTo(W, cyB); ctx.arc(r, cyB, r, 0, Math.PI, false); ctx.closePath(); ctx.fill();
    txt(ctx, lines[0], W / 2, H * 0.10, H * 0.085, { color: '#fff', maxW: W * 0.92 });
    txt(ctx, lines[1], W / 2, H * 0.205, H * 0.085, { color: '#fff', maxW: W * 0.92 });
    if (small) { txt(ctx, small[0], W * 0.2, H * 0.33, H * 0.04, { color: '#fff', maxW: W * 0.36 }); txt(ctx, small[1], W * 0.84, H * 0.33, H * 0.04, { color: '#fff', maxW: W * 0.3 }); }
    ctx.globalCompositeOperation = 'destination-out'; ctx.beginPath(); ctx.arc(r, cyB, W * 0.2, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  };
}
function drawPM(ctx, W, H) {
  ctx.fillStyle = '#000'; rrectPath(ctx, 0, 0, W, H, 26); ctx.fill();
  ctx.fillStyle = '#fafaf7'; rrectPath(ctx, 9, 9, W - 18, H - 18, 20); ctx.fill();
  ctx.fillStyle = '#111'; ctx.beginPath(); ctx.moveTo(34, 98); ctx.lineTo(64, 46); ctx.lineTo(84, 76); ctx.lineTo(104, 46); ctx.lineTo(134, 98); ctx.lineTo(116, 98); ctx.lineTo(104, 76); ctx.lineTo(84, 104); ctx.lineTo(64, 76); ctx.lineTo(52, 98); ctx.closePath(); ctx.fill();
  txt(ctx, 'MEDATECH', 300, 74, 60, { color: '#111', maxW: 330 });
  txt(ctx, '35 Sandford Fleming Drive, Collingwood, ON L9Y 5A6', W / 2, 122, 17, { color: '#222', weight: 'normal', maxW: W - 50 });
  ctx.strokeStyle = '#111'; ctx.lineWidth = 4; rrectPath(ctx, 26, 140, W - 52, 86, 14); ctx.stroke();
  txt(ctx, 'BORTERRA ROD HANDLER', 40, 168, 26, { align: 'left', maxW: W - 80 }); txt(ctx, 'MODÈLE : LP RODBOT', 40, 204, 26, { align: 'left', maxW: W - 80 });
  txt(ctx, 'QUOTIDIEN / HEBDOMADAIRE', W / 2, 252, 27, { maxW: W - 60 }); txt(ctx, 'ENTRETIEN PRÉVENTIF', W / 2, 284, 27, { maxW: W - 60 });
  const L1 = ['QUOTIDIEN :', '- VÉRIFIER L\'ABSENCE DE DOMMAGES OU DE', '  FUITES SUR LES COMPOSANTS HYDRAULIQUES.', '- VÉRIFIER L\'ABSENCE DE DOMMAGES SUR LES', '  COMPOSANTS ÉLECTRIQUES.', '- FAIRE L\'ESSAI DE LA MACHINE SANS TIGE', '  POUR S\'ASSURER QU\'ELLE SE DÉPLACE', '  COMME PRÉVU.', '', 'HEBDOMADAIRE :', '- GRAISSER LES VÉRINS AINSI QUE LES', '  COURONNES DE ROTATION ET D\'ORIENTATION.', '- INSPECTER LE MÂT POUR DÉCELER TOUTE', '  FISSURE OU DOMMAGE.', '- TESTER L\'ARRÊT D\'URGENCE SUR LE PANNEAU', '  ET LA TÉLÉCOMMANDE POUR S\'ASSURER', '  QU\'ILS ARRÊTENT LE ROBOT ET LA FOREUSE.'];
  L1.forEach((s, i) => txt(ctx, s, 30, 324 + i * 24.5, 17, { align: 'left', weight: s.endsWith(':') ? 'bold' : 'normal', color: '#111', maxW: W - 56 }));
}
function drawWarn(ctx, W, H) {
  ctx.fillStyle = '#000'; rrectPath(ctx, 0, 0, W, H, 22); ctx.fill();
  ctx.fillStyle = '#f3c614'; rrectPath(ctx, 8, 8, W - 16, H * 0.38, 16); ctx.fill(); ctx.fillRect(8, H * 0.2, W - 16, H * 0.22);
  ctx.fillStyle = '#fafaf7'; rrectPath(ctx, 8, H * 0.44, W - 16, H * 0.56 - 8, 16); ctx.fill(); ctx.fillRect(8, H * 0.44, W - 16, 30);
  ctx.fillStyle = '#000'; ctx.beginPath(); ctx.moveTo(70, H * 0.36); ctx.lineTo(112, H * 0.06); ctx.lineTo(154, H * 0.36); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#f3c614'; ctx.beginPath(); ctx.moveTo(84, H * 0.33); ctx.lineTo(112, H * 0.12); ctx.lineTo(140, H * 0.33); ctx.closePath(); ctx.fill();
  txt(ctx, '!', 112, H * 0.255, H * 0.17);
  txt(ctx, 'AVERTISSEMENT', 600, H * 0.215, H * 0.25, { maxW: 820 });
  ['L\'AIMANT PERD SON ALIMENTATION', 'LORS D\'UN ARRÊT D\'URGENCE.', 'S\'ASSURER QUE LA PINCE EST FERMÉE', 'AVANT DE DÉPLACER UNE CHARGE'].forEach((s, i) => txt(ctx, s, 40, H * (0.53 + i * 0.12), H * 0.095, { align: 'left', weight: 'normal', maxW: W - 80 }));
}
function drawStrip(labels, extra = null) {
  return (ctx, W, H) => {
    ctx.fillStyle = '#111'; rrectPath(ctx, 0, 0, W, H, H * 0.3); ctx.fill();
    labels.forEach(([s, f]) => txt(ctx, s, f * W, H * 0.52, H * 0.62, { color: '#f2f2f2', maxW: W * 0.07 }));
    if (extra) extra(ctx, W, H);
  };
}
function drawEmergency(ctx, W, H) {
  ctx.fillStyle = '#f2c20f'; ctx.beginPath(); ctx.arc(W / 2, H / 2, W / 2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#7a5a00'; ctx.font = `bold ${W * 0.085}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const s = 'EMERGENCY', R = W * 0.41, a0 = -Math.PI / 2 - 0.62;
  for (let i = 0; i < s.length; i++) { const a = a0 + i * 0.155; ctx.save(); ctx.translate(W / 2 + R * Math.cos(a), H / 2 + R * Math.sin(a)); ctx.rotate(a + Math.PI / 2); ctx.fillText(s[i], 0, 0); ctx.restore(); }
  ctx.strokeStyle = '#7a5a00'; ctx.lineWidth = W * 0.012; for (const a of [Math.PI * 0.9, Math.PI * 0.1]) { ctx.beginPath(); ctx.arc(W / 2 + R * Math.cos(a), H / 2 + R * Math.sin(a), W * 0.04, 0, Math.PI * 2); ctx.stroke(); }
}

/* ------------------------------------------------------------------ */
/* Composants de rail DIN (dimensions des fabricants, en m)            */
/* ------------------------------------------------------------------ */
/** Rail DIN 35 x 7,5 le long de u, au niveau v, posé sur le fond (d = 0). */
function dinRail(u0, u1, v, bpf = BP) {
  const mm = 0.001, pr = [[-12.5, 0], [12.5, 0], [12.5, 6.5], [17.5, 6.5], [17.5, 7.5], [11.5, 7.5], [11.5, 1], [-11.5, 1], [-11.5, 7.5], [-17.5, 7.5], [-17.5, 6.5], [-12.5, 6.5]].map(([a, b]) => [a * mm, b * mm]);
  const g = G.plate(pr, Math.abs(u1 - u0), { bevel: 0.0002 });
  return m(orient(g, [0, 1, 0], [0, 0, -1], bpf((u0 + u1) / 2, v, 0)), 'zinc');
}
const RAIL_TOP = 0.0075;
/** Borne 3 étages (PT 2.5-3L) : corps et poussoirs orange. */
function terminal(u, v, w, body, push, out, bpb = bpBox) {
  const d0 = RAIL_TOP, ww = w - 0.0003;
  out.body.push(bpb(ww, 0.088, 0.030, u, v, d0, body), bpb(ww, 0.060, 0.012, u, v, d0 + 0.030, body), bpb(ww, 0.032, 0.010, u, v, d0 + 0.042, body));
  for (const [hh, dd] of [[0.088, 0.030], [0.060, 0.042], [0.032, 0.052]]) for (const s of [-1, 1]) out.push.push(bpb(ww - 0.0012, 0.0045, 0.0022, u, v + s * (hh / 2 - 0.0055), d0 + dd, push, 0));
}
/** Couvercle de fin ou plaque mince de même profil. */
function endCover(u, v, w, mk, bpb = bpBox) { return [bpb(w, 0.088, 0.030, u, v, RAIL_TOP, mk), bpb(w, 0.060, 0.022, u, v, RAIL_TOP + 0.030, mk)]; }
/** Butée de fin (E/UK) avec vis. */
function endStop(u, v, w, bpb = bpBox) { return [bpb(w, 0.046, 0.026, u, v, RAIL_TOP, 'plasticGrey'), bpb(w * 0.8, 0.02, 0.006, u, v + 0.012, RAIL_TOP + 0.026, 'plasticGrey')]; }

/* ------------------------------------------------------------------ */
/* Prises de panneau (sous le boîtier)                                 */
/* ------------------------------------------------------------------ */
/** Prise à travers la paroi du bas : origine au nu extérieur, axe vers -Y. size 'm12' ou '78'. */
function receptacle(u, z, size, kind = 'f') {
  const s = size === '78' ? 1.75 : 1, y0 = CY - BH / 2;
  const x = CX - u, body = [], ins = [];
  const af = 0.0175 * s, rb = 0.0062 * s;
  body.push(m(G.hex(af, 0.0035 * s), 'zincClear', { p: [x, y0 - 0.0018 * s, z] }));
  body.push(m(G.cyl(rb, 0.014 * s, 20), 'zincClear', { p: [x, y0 - 0.0035 * s - 0.007 * s, z] }));
  for (let i = 0; i < 3; i++) body.push(m(G.cyl(rb + 0.0005, 0.0012, 20), 'zincClear', { p: [x, y0 - 0.006 * s - i * 0.0035 * s, z] }));
  body.push(m(G.hex(af, 0.0045 * s), 'zincClear', { p: [x, y0 + TW + 0.0023 * s, z] }));      // contre-écrou intérieur
  body.push(m(G.cyl(rb * 0.95, 0.016 * s, 16), 'zincClear', { p: [x, y0 + TW + 0.012 * s, z] }));
  if (kind === 'f') ins.push(m(G.tube(rb * 0.8, rb * 0.45, 0.002, 20), 'plastic', { p: [x, y0 - 0.0175 * s - 0.0005, z] }), m(G.cyl(rb * 0.45, 0.004, 16), 'plastic', { p: [x, y0 - 0.0165 * s, z] }));
  else ins.push(m(G.cyl(rb * 0.78, 0.003, 20), 'plastic', { p: [x, y0 - 0.0168 * s, z] }), ...[0, 1, 2, 3].map(i => m(G.cyl(0.0006, 0.004, 6), 'zincClear', { p: [x + Math.cos(i * 1.57 + 0.78) * rb * 0.45, y0 - 0.0195 * s, z + Math.sin(i * 1.57 + 0.78) * rb * 0.45] })));
  return [...body, ...ins];
}

/* ------------------------------------------------------------------ */
/* 9.1 PPU                                                             */
/* ------------------------------------------------------------------ */
function buildPPU() {
  const uc = 0.1375, vc = 0.097;
  const unit = [], mount = [], hw = [];
  mount.push(m(orient(G.plate(G.rrect(0.147, 0.150, 0.004), 0.002, { holes: [-1, 1].flatMap(s => [{ slot: [s * 0.0655, 0.03, s * 0.0655, 0.05], r: 0.0035 }, { slot: [s * 0.0655, -0.05, s * 0.0655, -0.03], r: 0.0035 }, { c: [s * 0.0655, 0.0], r: 0.0028 }]) }), [-1, 0, 0], [0, 1, 0], BP(uc, vc, 0.001)), 'zincClear'));
  unit.push(bpBox(0.116, 0.170, 0.048, uc, vc, 0.002, 'copper', 0.003));
  for (let i = 0; i < 23; i++) unit.push(bpBox(0.0018, 0.164, 0.014, uc - 0.0528 + i * 0.0048, vc, 0.049, 'copper', 0.0006));
  for (const s of [-1, 1]) unit.push(bpBox(0.118, 0.006, 0.064, uc, vc + s * 0.088, 0.0015, 'blackOxide', 0.0015));
  for (let i = 0; i < 3; i++) unit.push(bpBox(0.012, 0.0015, 0.007, uc - 0.035 + i * 0.022, vc - 0.0915, 0.02, 'blackOxide', 0));
  for (const s of [-1, 1]) for (const t of [-1, 1]) {
    const p = BP(uc + s * 0.0655, vc + t * 0.04, 0.002);
    hw.push(aim(washer({ d: 0.19 * IN, mat: 'zincClear' }), p, OUT), aim(bolt({ d: 0.19 * IN, L: 0.375 * IN, head: 'bhcs', mat: 'zincClear' }), [p[0], p[1], p[2] - 0.0006], OUT));
  }
  return asm({ id: 'elec-ppu', sec: '9.1', item: '15', pn: '278796', fr: 'Ordinateur PPU et support', en: 'PPU computer and mount', qty: '1', page: 41, explode: [0, 0, -0.30] }, [
    part({ id: 'elec-ppu-unit', sec: '9.1', item: '1', pn: '278799', fr: 'Ordinateur PPU', en: 'PPU computer', qty: '1', page: 41, spare: true, explode: [0, 0, -0.08], note: 'Pièce de rechange critique (p. 85). Boîtier à ailettes.' }, unit),
    part({ id: 'elec-ppu-mount', sec: '9.1', item: '2', pn: '243136', fr: 'Support du PPU', en: 'PPU mount', qty: '1', page: 41, explode: [0, 0, 0] }, mount),
    part({ id: 'elec-ppu-hw', sec: '9.1', item: '3, 4', pn: '253530', fr: 'Visserie du PPU', en: 'PPU hardware', qty: '4', page: 41, explode: [0, 0, -0.16], note: 'Repères 3 (rondelles #10, 4) et 4 (vis #10-32 x 3/8 po, 4).' }, hw),
  ]);
}

/* ------------------------------------------------------------------ */
/* 9.2 Bornier 2 (disjoncteurs)                                         */
/* ------------------------------------------------------------------ */
const TB2V = 0.097, TB1V = -0.116;
function buildTB2(extra) {
  const v = TB2V, W5 = 0.0052;
  let u = -0.189;
  const stops = [], holders = { body: [], screw: [], led: [] }, brk = { 13: [], 11: [], 14: [], 12: [], 10: [] }, jumper = [], relay = { y: [], k: [] };
  const tbP = { body: [], push: [] }, tbG = { body: [], push: [] }, covers = [], br4 = [], br2 = [], hw = [], rail = [];
  stops.push(...endStop(u + 0.004, v, 0.008)); u += 0.008;
  const fw = 0.0084, order = [13, 13, 11, 14, 14, 12, 12, 10, 10, 10];
  const holderU = [];
  for (let i = 0; i < 10; i++) {
    const c = u + fw / 2; holderU.push(c);
    holders.body.push(bpBox(fw - 0.0003, 0.090, 0.030, c, v, RAIL_TOP, 'plastic'), bpBox(fw - 0.0003, 0.052, 0.010, c, v, RAIL_TOP + 0.030, 'plastic'));
    for (const s of [-1, 1]) holders.screw.push(m(G.cyl(0.0024, 0.0012, 16), 'plastic', { p: BP(c, v + s * 0.037, RAIL_TOP + 0.0306), r: [90, 0, 0] }));
    holders.led.push(bpBox(0.002, 0.003, 0.001, c, v + 0.021, RAIL_TOP + 0.040, MT.ledGreen(), 0));
    const k = order[i], tall = k === 14;
    brk[k].push(bpBox(fw - 0.0008, tall ? 0.030 : 0.034, tall ? 0.030 : 0.026, c, v - 0.002, RAIL_TOP + 0.040, MT.cyan(), 0.0007));
    brk[k].push(m(G.cyl(0.0021, 0.003, 12), MT.cyan(), { p: BP(c, v + 0.006, RAIL_TOP + 0.040 + (tall ? 0.031 : 0.027)), r: [90, 0, 0] }));
    u += fw;
  }
  jumper.push(bpBox(10 * fw - 0.001, 0.0035, 0.003, (holderU[0] + holderU[9]) / 2, v - 0.029, RAIL_TOP + 0.030, MT.redPl(), 0));
  extra.cbDecal = { u: (holderU[0] + holderU[9]) / 2, v: v + 0.0305, w: 10 * fw - 0.001 };
  extra.diodeU = [1, 3, 5, 7, 8].map(i => holderU[i]); extra.diodeV = v + 0.041;
  const ru = u + 0.0112;
  relay.y.push(bpBox(0.0222, 0.108, 0.064, ru, v, RAIL_TOP, MT.yellowPl(), 0.0012));
  for (const s of [-1, 1]) relay.k.push(bpBox(0.0205, 0.012, 0.016, ru, v + s * 0.046, RAIL_TOP + 0.064, 'plastic', 0.0008));
  relay.k.push(bpBox(0.010, 0.008, 0.0012, ru, v + 0.012, RAIL_TOP + 0.064, 'plastic', 0));
  u += 0.0225;
  covers.push(...endCover(u + 0.0011, v, 0.0022, 'plasticGrey')); u += 0.0022;
  const pU = [], gU = [];
  for (let i = 0; i < 9; i++) { terminal(u + W5 / 2, v, W5, 'plasticGrey', 'orange', tbP); pU.push(u + W5 / 2); u += W5; }
  for (let i = 0; i < 8; i++) { terminal(u + W5 / 2, v, W5, MT.greenPl(), 'orange', tbG); gU.push(u + W5 / 2); u += W5; }
  covers.push(...endCover(u + 0.0011, v, 0.0022, 'plasticGrey')); u += 0.0022;
  stops.push(...endStop(u + 0.004, v, 0.008)); u += 0.008;
  rail.push(dinRail(-0.191, u + 0.002, v));
  for (const uu of [-0.183, -0.06, u - 0.003]) { const p = BP(uu, v, 0.001); hw.push(aim(washer({ d: 0.19 * IN, mat: 'zincClear' }), p, OUT), aim(bolt({ d: 0.19 * IN, L: 0.375 * IN, head: 'bhcs', mat: 'zincClear' }), [p[0], p[1], p[2] - 0.0006], OUT)); }
  // ponts : 6 x 4 pos. et 10 x 2 pos. dans les puits du milieu
  const allU = [...pU, ...gU];
  const bridge = (arr, i0, n, dv, d0) => { const a = allU[i0], b = allU[i0 + n - 1]; arr.push(bpBox(b - a + W5 - 0.001, 0.0035, 0.004, (a + b) / 2, v + dv, RAIL_TOP + d0, MT.redPl(), 0)); };
  for (const i0 of [0, 4, 9, 13]) bridge(br4, i0, 4, 0.007, 0.050);
  for (const i0 of [0, 9]) bridge(br4, i0, 4, -0.007, 0.050);
  for (const i0 of [4, 6, 13, 15]) bridge(br2, i0, 2, -0.007, 0.050);
  for (const i0 of [0, 2, 9, 11]) bridge(br2, i0, 2, 0.022, 0.0475);
  for (const i0 of [0, 9]) bridge(br2, i0, 2, -0.022, 0.0475);
  const pp = (o) => [...o.body, ...o.push];
  const S = '9.2', pg = 42;
  return asm({ id: 'elec-tb2', sec: S, item: '19', pn: '279601', fr: 'Bornier 2, disjoncteurs', en: 'Terminal block 2 (breakers)', qty: '1', page: pg, explode: [0, 0, -0.22] }, [
    part({ id: 'elec-tb2-holder', sec: S, item: '1', pn: '261791', fr: 'Porte-disjoncteurs à DEL', en: 'LED breaker holders', qty: '10', page: pg, explode: [0, 0, -0.02] }, [holders.body, holders.screw, holders.led]),
    part({ id: 'elec-tb2-cb2', sec: S, item: '13', pn: '232675', fr: 'Disjoncteurs 2 A', en: '2 A breakers', qty: '2', page: pg, explode: [0, 0, -0.08] }, brk[13]),
    part({ id: 'elec-tb2-cb8', sec: S, item: '11', pn: '232674', fr: 'Disjoncteur 8 A', en: '8 A breaker', qty: '1', page: pg, explode: [0, 0, -0.08] }, brk[11]),
    part({ id: 'elec-tb2-cb4b', sec: S, item: '14', pn: '279928', fr: 'Disjoncteurs 4 A (modèle 2)', en: '4 A breakers (type 2)', qty: '2', page: pg, explode: [0, 0, -0.08], note: 'Les deux disjoncteurs sans marquage du dessin.' }, brk[14]),
    part({ id: 'elec-tb2-cb10', sec: S, item: '12', pn: '232676', fr: 'Disjoncteurs 10 A', en: '10 A breakers', qty: '2', page: pg, explode: [0, 0, -0.08] }, brk[12]),
    part({ id: 'elec-tb2-cb4', sec: S, item: '10', pn: '232672', fr: 'Disjoncteurs 4 A', en: '4 A breakers', qty: '3', page: pg, explode: [0, 0, -0.08] }, brk[10]),
    part({ id: 'elec-tb2-jumper', sec: S, item: '9', pn: '274931', fr: 'Barrette de pontage 10 pos.', en: '10-pos jumper bar', qty: '1', page: pg, explode: [0, 0, -0.05] }, jumper),
    part({ id: 'elec-tb2-safety', sec: S, item: '15', pn: '279073', fr: 'Relais de sécurité', en: 'Safety relay', qty: '1', page: pg, explode: [0, 0, -0.05] }, [relay.y, relay.k]),
    part({ id: 'elec-tb2-tb', sec: S, item: '2', pn: '254027', fr: 'Bornes 3 étages', en: '3-level terminal blocks', qty: '9', page: pg, explode: [0, 0, -0.02] }, pp(tbP)),
    part({ id: 'elec-tb2-gnd', sec: S, item: '3', pn: '254028', fr: 'Bornes de mise à la terre', en: 'Ground terminal blocks', qty: '8', page: pg, explode: [0, 0, -0.02] }, pp(tbG)),
    part({ id: 'elec-tb2-cover', sec: S, item: '4', pn: '255667', fr: 'Couvercles de fin', en: 'End covers', qty: '2', page: pg, explode: [0, 0, -0.02] }, covers),
    part({ id: 'elec-tb2-stop', sec: S, item: '6', pn: '111622', fr: 'Butées de fin', en: 'End stops', qty: '2', page: pg, explode: [0, 0, -0.02] }, stops),
    part({ id: 'elec-tb2-br4', sec: S, item: '16', pn: '231913', fr: 'Ponts 4 pos.', en: '4-pos bridges', qty: '6', page: pg, explode: [0, 0, -0.07] }, br4),
    part({ id: 'elec-tb2-br2', sec: S, item: '17', pn: '231914', fr: 'Ponts 2 pos.', en: '2-pos bridges', qty: '10', page: pg, explode: [0, 0, -0.07] }, br2),
    part({ id: 'elec-tb2-rail', sec: S, item: '5', pn: '274015', fr: 'Rail DIN', en: 'DIN rail', qty: '8', page: pg, explode: [0, 0, 0], note: 'Quantité imprimée 8 : longueur en pouces.' }, rail),
    part({ id: 'elec-tb2-hw', sec: S, item: '7, 8', pn: '253530', fr: 'Visserie du rail', en: 'Rail hardware', qty: '3', page: pg, explode: [0, 0, -0.11], note: 'Repères 7 (vis #10-32, 3) et 8 (rondelles #10, 3).' }, hw),
  ]);
}

/* ------------------------------------------------------------------ */
/* 9.3 Bornier 1 (modules et relais)                                    */
/* ------------------------------------------------------------------ */
function buildTB1() {
  const v = TB1V, W5 = 0.0052;
  let u = -0.192;
  const brk = [], endPl = [], dout = [], din = [], gw = { a: [], b: [] }, sw = { a: [], b: [] }, covers = [], tb = { body: [], push: [] };
  const rel = [], ssr = [], plug = [], fg = { y: [], k: [] }, stop = [], jmp = [], br5 = [], hw = [], rail = [];
  const bracket = (c) => [bpBox(0.0085, 0.062, 0.040, c, v, RAIL_TOP, 'plastic', 0.001), bpBox(0.006, 0.02, 0.006, c, v + 0.02, RAIL_TOP + 0.04, 'plastic', 0)];
  brk.push(...bracket(u + 0.00425)); u += 0.0085;
  endPl.push(bpBox(0.0019, 0.126, 0.068, u + 0.001, v, RAIL_TOP, 'plasticGrey', 0.0004)); u += 0.002;
  const bl20 = (c, arr) => { arr.push(bpBox(0.0123, 0.128, 0.066, c, v, RAIL_TOP, 'plasticLight', 0.0008), bpBox(0.0105, 0.050, 0.006, c, v + 0.034, RAIL_TOP + 0.066, 'plasticLight', 0.0006)); for (let i = 0; i < 8; i++) arr.push(bpBox(0.0035, 0.0028, 0.0015, c - 0.002, v + 0.014 + i * 0.0052, RAIL_TOP + 0.072, 'plasticLight', 0)); };
  bl20(u + 0.0063, dout); u += 0.0126;
  bl20(u + 0.0063, din); u += 0.0126; bl20(u + 0.0063, din); u += 0.0126;
  const gc = u + 0.017;
  gw.a.push(bpBox(0.0335, 0.128, 0.070, gc, v, RAIL_TOP, 'plasticLight', 0.001), bpBox(0.028, 0.050, 0.008, gc, v - 0.03, RAIL_TOP + 0.070, 'plasticLight', 0.001));
  gw.b.push(bpBox(0.020, 0.012, 0.0015, gc, v + 0.035, RAIL_TOP + 0.0705, 'plastic', 0));
  for (let i = 0; i < 2; i++) gw.b.push(bpBox(0.012, 0.010, 0.002, gc - 0.008 + i * 0.016, v - 0.03, RAIL_TOP + 0.0775, 'plastic', 0));
  u += 0.034;
  endPl.push(bpBox(0.0019, 0.126, 0.068, u + 0.001, v, RAIL_TOP, 'plasticGrey', 0.0004)); u += 0.002;
  brk.push(...bracket(u + 0.00425)); u += 0.0085;
  const sc = u + 0.01125;
  sw.a.push(bpBox(0.0222, 0.112, 0.070, sc, v, RAIL_TOP, 'plasticGrey', 0.001));
  for (let i = 0; i < 5; i++) sw.b.push(bpBox(0.0125, 0.010, 0.0018, sc, v + 0.035 - i * 0.0155, RAIL_TOP + 0.0703, 'plastic', 0));
  sw.b.push(bpBox(0.008, 0.012, 0.0015, sc, v - 0.046, RAIL_TOP + 0.0703, 'plastic', 0));
  u += 0.0225;
  covers.push(...endCover(u + 0.0011, v, 0.0022, 'plasticGrey')); u += 0.0022;
  const tU = [];
  for (let i = 0; i < 16; i++) { terminal(u + W5 / 2, v, W5, 'plasticGrey', 'orange', tb); tU.push(u + W5 / 2); u += W5; }
  covers.push(...endCover(u + 0.0011, v, 0.0022, 'plasticGrey')); u += 0.0022;
  for (const [i0, dv] of [[0, 0.007], [5, 0.007], [10, 0.007], [0, -0.007], [5, -0.007]]) { const a = tU[i0], b = tU[i0 + 4]; br5.push(bpBox(b - a + W5 - 0.001, 0.0035, 0.004, (a + b) / 2, v + dv, RAIL_TOP + 0.050, MT.redPl(), 0)); }
  for (const dv of [0.034, -0.034]) for (const i0 of [0, 3, 6, 9, 12]) { const a = tU[i0], b = tU[i0 + 2]; jmp.push(bpBox(b - a + W5 - 0.0015, 0.003, 0.0025, (a + b) / 2, v + dv, RAIL_TOP + 0.030, MT.redPl(), 0)); }
  const thin = (c, k, arr) => { arr.push(bpBox(0.0059, 0.090, 0.050, c, v, RAIL_TOP, k, 0.0006), bpBox(0.0057, 0.030, 0.022, c, v + 0.012, RAIL_TOP + 0.050, k, 0.0006)); };
  const thinU = [];
  for (let i = 0; i < 9; i++) { const c = u + 0.0031; thinU.push(c); thin(c, i < 4 ? 'plasticLight' : 'plasticGrey', i < 4 ? rel : ssr); u += 0.0062; }
  plug.push(bpBox(thinU[8] - thinU[0] + 0.005, 0.004, 0.003, (thinU[0] + thinU[8]) / 2, v - 0.030, RAIL_TOP + 0.050, 'plastic', 0));
  for (let i = 0; i < 6; i++) {
    const c = u + 0.00875;
    fg.y.push(bpBox(0.0172, 0.072, 0.074, c, v, RAIL_TOP, MT.yellowPl(), 0.001));
    for (const s of [-1, 1]) { fg.k.push(bpBox(0.0172, 0.010, 0.050, c, v + s * 0.041, RAIL_TOP, 'plastic', 0.0008)); for (const t of [-1, 1]) fg.k.push(m(G.cyl(0.0028, 0.0015, 12), 'plastic', { p: BP(c + t * 0.0043, v + s * 0.041, RAIL_TOP + 0.0505), r: [90, 0, 0] })); }
    u += 0.0175;
  }
  stop.push(...endStop(u + 0.0032, v, 0.0064)); u += 0.0064;
  rail.push(dinRail(-0.194, u + 0.002, v));
  for (const uu of [-0.186, -0.11, -0.03, 0.06, u - 0.003]) { const p = BP(uu, v, 0.001); hw.push(aim(washer({ d: 0.19 * IN, mat: 'zincClear' }), p, OUT), aim(bolt({ d: 0.19 * IN, L: 0.375 * IN, head: 'bhcs', mat: 'zincClear' }), [p[0], p[1], p[2] - 0.0006], OUT)); }
  const S = '9.3', pg = 43;
  return asm({ id: 'elec-tb1', sec: S, item: '18', pn: '279600', fr: 'Bornier 1, modules et relais', en: 'Terminal block 1 (I/O, relays)', qty: '1', page: pg, explode: [0, 0, -0.22] }, [
    part({ id: 'elec-tb1-gw', sec: S, item: '14', pn: '279504', fr: 'Passerelle BL20', en: 'BL20 gateway', qty: '1', page: pg, explode: [0, 0, -0.06] }, [gw.a, gw.b]),
    part({ id: 'elec-tb1-do', sec: S, item: '7', pn: '279505', fr: 'Module 8 sorties', en: '8-output module', qty: '1', page: pg, explode: [0, 0, -0.06] }, dout),
    part({ id: 'elec-tb1-di', sec: S, item: '8', pn: '279506', fr: 'Modules 8 entrées', en: '8-input modules', qty: '2', page: pg, explode: [0, 0, -0.06] }, din),
    part({ id: 'elec-tb1-endpl', sec: S, item: '9', pn: '279508', fr: 'Plaques de fin BL20', en: 'BL20 end plates', qty: '2', page: pg, explode: [0, 0, -0.03] }, endPl),
    part({ id: 'elec-tb1-bracket', sec: S, item: '10', pn: '279507', fr: 'Arrêts de rail noirs', en: 'Black end brackets', qty: '2', page: pg, explode: [0, 0, -0.03] }, brk),
    part({ id: 'elec-tb1-switch', sec: S, item: '11', pn: '279461', fr: 'Commutateur Ethernet', en: 'Ethernet switch', qty: '1', page: pg, explode: [0, 0, -0.06] }, [sw.a, sw.b]),
    part({ id: 'elec-tb1-tb', sec: S, item: '6', pn: '254026', fr: 'Bornes 3 étages', en: '3-level terminal blocks', qty: '16', page: pg, explode: [0, 0, -0.02] }, [tb.body, tb.push]),
    part({ id: 'elec-tb1-cover', sec: S, item: '5', pn: '255667', fr: 'Couvercles de fin', en: 'End covers', qty: '2', page: pg, explode: [0, 0, -0.02] }, covers),
    part({ id: 'elec-tb1-jmp', sec: S, item: '15', pn: '236782', fr: 'Cavaliers 3 pos.', en: '3-pos jumpers', qty: '10', page: pg, explode: [0, 0, -0.07] }, jmp),
    part({ id: 'elec-tb1-br5', sec: S, item: '16', pn: '231912', fr: 'Ponts 5 pos.', en: '5-pos bridges', qty: '5', page: pg, explode: [0, 0, -0.07] }, br5),
    part({ id: 'elec-tb1-relay', sec: S, item: '18', pn: '273879', fr: 'Relais 24 V', en: '24 V relays', qty: '4', page: pg, explode: [0, 0, -0.04] }, rel),
    part({ id: 'elec-tb1-ssr', sec: S, item: '4', pn: '279301', fr: 'Relais statiques', en: 'Solid state relays', qty: '5', page: pg, explode: [0, 0, -0.04] }, ssr),
    part({ id: 'elec-tb1-plug', sec: S, item: '17', pn: '279930', fr: 'Pont enfichable des relais', en: 'Relay plug bridge', qty: '1', page: pg, explode: [0, 0, -0.09] }, plug),
    part({ id: 'elec-tb1-fg', sec: S, item: '1', pn: '279167', fr: 'Relais à contacts guidés', en: 'Forcibly guided relays', qty: '6', page: pg, explode: [0, 0, -0.04] }, [fg.y, fg.k]),
    part({ id: 'elec-tb1-stop', sec: S, item: '3', pn: '111622', fr: 'Butée de fin', en: 'End stop', qty: '1', page: pg, explode: [0, 0, -0.02] }, stop),
    part({ id: 'elec-tb1-rail', sec: S, item: '2', pn: '274015', fr: 'Rail DIN', en: 'DIN rail', qty: '14', page: pg, explode: [0, 0, 0], note: 'Quantité imprimée 14 : longueur en pouces.' }, rail),
    part({ id: 'elec-tb1-hw', sec: S, item: '12, 13', pn: '253530', fr: 'Visserie du rail', en: 'Rail hardware', qty: '5', page: pg, explode: [0, 0, -0.11], note: 'Repères 12 (vis #10-32, 5) et 13 (rondelles #10, 5).' }, hw),
  ]);
}

/* ------------------------------------------------------------------ */
/* Porte : écran, cadre 9.4, boutons, autocollants                      */
/* ------------------------------------------------------------------ */
const ZDB = ZD + TW;  // dos de la tôle avant de la porte
function buildDoor() {
  const [hu, hv] = DOOR.hmi;
  // --- tôle de porte (281 ... partie de l'item 17)
  const holes = [
    { rect: [-hu, hv, 0.292, 0.206, 0.004] },
    { c: [-DOOR.pb[0], DOOR.pb[1]], r: 0.0112 }, { c: [-DOOR.sel[0], DOOR.sel[1]], r: 0.0112 }, { c: [-DOOR.estop[0], DOOR.estop[1]], r: 0.0112 },
  ];
  const door = [m(G.plate(G.rrect(0.462, 0.462, 0.004), TW, { holes }), 'grey', { p: [CX, CY, ZD + TW / 2] })];
  const a = 0.231, b = 0.254, z0 = ZD + 0.0009, z1 = -0.7240;
  const c = (u, v, z) => [CX - u, CY + v, z];
  door.push(m(quadGeo([
    [c(-a, a, z0), c(a, a, z0), c(b, b, z1), c(-b, b, z1)], [c(a, -a, z0), c(-a, -a, z0), c(-b, -b, z1), c(b, -b, z1)],
    [c(a, a, z0), c(a, -a, z0), c(b, -b, z1), c(b, b, z1)], [c(-a, -a, z0), c(-a, a, z0), c(-b, b, z1), c(-b, -b, z1)],
  ], true), 'grey'));
  door.push(aim(m(G.rectTube(0.508, 0.508, 0.0052, TW, 0.003), 'grey'), [CX, CY, -0.7213], [0, 0, 1]));
  door.push(m(G.plate(G.rrect(0.504, 0.504, 0.003), TW, { holes: [{ rect: [0, 0, 0.470, 0.470, 0.003] }] }), 'grey', { p: [CX, CY, -0.7231] }));
  const gasket = [m(G.plate(G.rrect(0.492, 0.492, 0.004), 0.003, { holes: [{ rect: [0, 0, 0.474, 0.474, 0.003] }] }), 'rubber', { p: [CX, CY, -0.7205] })];
  // --- écran IHM (41)
  const hmi = [];
  const zb = ZD - 0.0045;  // face arrière du cadre 9.4 (joint 1,5 + plaque 3)
  hmi.push(m(G.plate(G.rrect(DOOR.bezel[0], DOOR.bezel[1], 0.006), 0.007, { holes: [{ rect: [0, 0, 0.230, 0.140, 0.002] }], bevel: 0.0015 }), 'plastic', { p: D(hu, hv, zb - 0.0035) }));
  hmi.push(box(0.236, 0.146, 0.004, 'plastic', D(hu, hv, zb - 0.0012), 0.001));
  hmi.push(plane(DOOR.active[0], DOOR.active[1], cmat('hmi', 1024, 600, drawHMI, { emissive: 0.85, rough: 0.12, clear: 1 }), [-1, 0, 0], [0, 1, 0], D(hu, hv, zb - 0.0038)));
  hmi.push(box(0.272, 0.186, 0.044, 'plastic', D(hu, hv, ZDB + 0.022 + 0.0005), 0.004, 2));
  hmi.push(box(0.150, 0.040, 0.008, 'plastic', D(hu - 0.01, hv - 0.06, ZDB + 0.048), 0.002));
  hmi.push(box(0.012, 0.010, 0.010, 'plastic', D(hu - 0.075, hv - 0.06, ZDB + 0.056), 0.001));
  for (const [cu, cv] of [[-0.06, 0.093], [0.06, 0.093], [-0.06, -0.093], [0.06, -0.093], [-0.136, 0], [0.136, 0]]) hmi.push(box(0.010, 0.008, 0.012, 'plastic', D(hu + cu, hv + cv, ZDB + 0.008), 0.001));
  // --- 9.4 cadre de l'écran
  const [fw, fh] = DOOR.flange, studs = [];
  for (const su of [-0.155, -0.052, 0.052, 0.155]) for (const sv of [-0.112, 0.112]) studs.push([su, sv]);
  for (const su of [-0.155, 0.155]) for (const sv of [-0.037, 0.037]) studs.push([su, sv]);
  const weld = [m(G.plate(G.rrect(fw, fh, 0.008), 0.003, { holes: [{ rect: [0, 0, 0.290, 0.203, 0.003] }] }), 'grey', { p: D(hu, hv, ZD - 0.0015 - 0.0015) })];
  const gk = [m(G.plate(G.rrect(fw - 0.004, fh - 0.004, 0.007), 0.0015, { holes: [{ rect: [0, 0, 0.294, 0.207, 0.003] }, ...studs.map(([su, sv]) => ({ c: [-su, sv], r: 0.004 }))] }), 'rubber', { p: D(hu, hv, ZD - 0.00075) })];
  const nuts = [];
  for (const [su, sv] of studs) {
    weld.push(cylAxis(0.0031, 0.024, 'zinc', D(hu + su, hv + sv, ZD - 0.0015 + 0.012), [0, 0, 1], 14));
    nuts.push(aim(nut({ d: 0.25 * IN }), D(hu + su, hv + sv, ZDB), [0, 0, 1]));
  }
  // --- boutons (axe vers -Z)
  const pb = [], sel = [], es = [], cb = { a: [], b: [], c: [] };
  const [pu, pv] = DOOR.pb, [su0, sv0] = DOOR.sel, [eu, ev] = DOOR.estop;
  pb.push(aim(m(G.lathe([[0.0112, 0], [0.0152, 0], [0.0152, 0.0085], [0.0142, 0.011], [0.0112, 0.012]], 32), 'plastic'), D(pu, pv, ZD - 0.0007), OUT));
  pb.push(aim(m(G.lathe([[0, 0.006], [0.0105, 0.006], [0.0108, 0.0115], [0.0098, 0.0135], [0, 0.0138]], 32), MT.sky()), D(pu, pv, ZD - 0.0007), OUT));
  pb.push(cylAxis(0.0145, 0.016, 'plastic', D(pu, pv, ZDB + 0.008), [0, 0, 1], 24));
  sel.push(aim(m(G.lathe([[0.0112, 0], [0.0152, 0], [0.0152, 0.007], [0.014, 0.0095], [0.0112, 0.0095]], 32), 'plastic'), D(su0, sv0, ZD - 0.0007), OUT));
  const knob = grp([m(G.cyl(0.0112, 0.006, 28), 'plastic', { p: [0, 0.009, 0] }), m(G.box(0.0075, 0.016, 0.026, 0.002), 'plastic', { p: [0, 0.019, 0], r: [90, 0, 0] }), m(G.box(0.0016, 0.0005, 0.018, 0), 'plasticLight', { p: [0, 0.0272, 0] })]);
  sel.push(aim(knob, D(su0, sv0, ZD - 0.0007), OUT, 30));
  sel.push(cylAxis(0.0145, 0.016, 'plastic', D(su0, sv0, ZDB + 0.008), [0, 0, 1], 24));
  es.push(aim(m(G.disc(0.0323, 0.0035, 40), 'yellow'), D(eu, ev, ZD - 0.0007 - 0.00175), OUT));
  es.push(new THREE.Mesh(orient(new THREE.RingGeometry(0.0115, 0.0322, 48), [-1, 0, 0], [0, 1, 0], D(eu, ev, ZD - 0.0007 - 0.0041)), cmat('emergency', 256, 256, drawEmergency, { rough: 0.4, clear: 0.4 })));
  es.push(aim(m(G.cyl(0.0115, 0.017, 28), 'plastic'), D(eu, ev, ZD - 0.0035 - 0.0085), OUT));
  es.push(aim(m(G.lathe([[0, 0], [0.0182, 0], [0.019, 0.004], [0.0188, 0.009], [0.0165, 0.0135], [0, 0.0152]], 40), 'redLens'), D(eu, ev, ZD - 0.0205), OUT));
  es.push(box(0.040, 0.040, 0.020, 'plastic', D(eu, ev, ZDB + 0.010), 0.004, 2));
  es.push(box(0.030, 0.012, 0.022, 'plastic', D(eu, ev + 0.012, ZDB + 0.031), 0.001), box(0.030, 0.012, 0.022, 'plastic', D(eu, ev - 0.012, ZDB + 0.031), 0.001));
  const cblock = (u, v, z) => [box(0.0095, 0.031, 0.040, 'plasticGrey', D(u, v, z), 0.001), m(G.cyl(0.003, 0.0015, 12), 'plasticGrey', { p: D(u, v + 0.0105, z + 0.0207), r: [90, 0, 0] }), m(G.cyl(0.003, 0.0015, 12), 'plasticGrey', { p: D(u, v - 0.0105, z + 0.0207), r: [90, 0, 0] })];
  cb.a.push(...cblock(su0 - 0.0052, sv0, ZDB + 0.036)); cb.c.push(...cblock(su0 + 0.0052, sv0, ZDB + 0.036)); cb.b.push(...cblock(pu, pv, ZDB + 0.036));
  // --- autocollants (face de porte, normale -Z)
  const dz = ZD - 0.0006, EX = [-1, 0, 0], EY = [0, 1, 0];
  const [lu, lv, lw, lh] = DOOR.lbl24, [mu, mv, mw, mh] = DOOR.pm, [wu, wv, ww, wh] = DOOR.warn;
  const tagW = 0.057, tagH = 0.072, tagV = (vb) => vb + (tagH - tagW / 2) - tagH / 2;
  const decals = {
    l24: plane(lw, lh, cmat('lbl24', 384, 222, drawLabel24, { rough: 0.25, clear: 0.6 }), EX, EY, D(lu, lv, dz)),
    reset: plane(tagW, tagH, cmat('tagReset', 285, 360, tagDraw(['RÉARMEMENT', 'DE SÉCURITÉ']), { alpha: true }), EX, EY, D(pu, tagV(pv), dz)),
    mode: plane(tagW, tagH, cmat('tagMode', 285, 360, tagDraw(['COMMANDE', 'OPÉRATEUR'], ['TÉLÉCOMMANDE', 'LOCAL']), { alpha: true }), EX, EY, D(su0, tagV(sv0), dz)),
    pm: plane(mw, mh, cmat('pm', 512, 728, drawPM, { alpha: true }), EX, EY, D(mu, mv, dz)),
    warn: plane(ww, wh, cmat('warn', 1024, 468, drawWarn, { alpha: true }), EX, EY, D(wu, wv, dz)),
  };
  const S = '9', pg = 38;
  const flange = asm({ id: 'elec-hmiflange', sec: '9.4', item: '39', pn: '281873', fr: "Cadre de l'écran tactile", en: 'HMI screen flange', qty: '1', page: 44, explode: [0, 0, -0.07] }, [
    part({ id: 'elec-hmiflange-weld', sec: '9.4', item: '1', pn: '281871', fr: "Cadre soudé de l'écran", en: 'HMI adapter weldment', qty: '1', page: 44, explode: [0, 0, -0.03], note: '12 goujons soudés.' }, weld),
    part({ id: 'elec-hmiflange-gasket', sec: '9.4', item: '2', pn: '281872', fr: 'Joint du cadre', en: 'Flange gasket', qty: '1', page: 44, explode: [0, 0, -0.01], note: 'Aussi repère 40 du panneau 24 V (même pièce).' }, gk),
    part({ id: 'elec-hmiflange-nuts', sec: '9.4', item: '3', pn: 'N058', fr: 'Écrous autobloquants 1/4 po', en: '1/4 in locknuts', qty: '13', page: 44, explode: [0, 0, 0.11], note: '13 au tableau, 12 goujons dessinés.' }, nuts),
  ]);
  return part({ id: 'elec-p24-door', sec: S, item: '17', pn: '279593', fr: 'Porte du panneau 24 V', en: '24 V panel door', qty: '1', page: pg, explode: [0, 0, -0.44], note: "Porte du boîtier 20 x 20 x 8 po (repère 17). Charnière à droite, quatre brides de fermeture." }, [
    door, gasket,
    part({ id: 'elec-p24-hmi', sec: S, item: '41', pn: '281869', fr: 'Écran tactile 10,2 po', en: '10.2 in touch screen', qty: '1', page: pg, explode: [0, 0, -0.17] }, hmi),
    flange,
    part({ id: 'elec-p24-pb', sec: S, item: '6', pn: '250320', fr: 'Bouton de réarmement bleu', en: 'Blue reset push button', qty: '1', page: pg, explode: [0, 0, -0.07] }, pb),
    part({ id: 'elec-p24-estop', sec: S, item: '22', pn: '279757', fr: "Arrêt d'urgence", en: 'E-stop button', qty: '1', page: pg, explode: [0, 0, -0.08], note: "Juste sous l'écran (manuel opérateur p. 11)." }, es),
    part({ id: 'elec-p24-sel', sec: S, item: '38', pn: '246314', fr: 'Sélecteur local / télécommande', en: 'Local / remote selector', qty: '1', page: pg, explode: [0, 0, -0.07] }, sel),
    part({ id: 'elec-p24-cbno-1', sec: S, item: '36', pn: '247152', fr: 'Bloc de contact NO', en: 'N/O contact block', qty: '2', page: pg, explode: [0, 0, 0.05], note: 'Exemplaire 1 sur 2 (sélecteur).' }, cb.a),
    part({ id: 'elec-p24-cbno-2', sec: S, item: '36', pn: '247152', fr: 'Bloc de contact NO', en: 'N/O contact block', qty: '2', page: pg, explode: [0, 0, 0.05], note: 'Exemplaire 2 sur 2 (bouton bleu).' }, cb.b),
    part({ id: 'elec-p24-cbnc', sec: S, item: '37', pn: '247153', fr: 'Bloc de contact NF', en: 'N/C contact block', qty: '1', page: pg, explode: [0, 0, 0.05] }, cb.c),
    part({ id: 'elec-p24-lbl24', sec: S, item: '4', pn: '245858', fr: 'Étiquette +24 VOLTS', en: '+24 VOLTS label', qty: '1', page: pg, explode: [0, 0, -0.02] }, [decals.l24]),
    part({ id: 'elec-decal-reset', sec: '6', item: '4', pn: '280344', fr: 'Autocollant RÉARMEMENT DE SÉCURITÉ', en: 'SAFETY RESET decal', qty: '1', page: 35, explode: [0, 0, -0.025] }, [decals.reset]),
    part({ id: 'elec-decal-mode', sec: '6', item: '5', pn: '281775', fr: 'Autocollant COMMANDE OPÉRATEUR', en: 'LOCAL / REMOTE decal', qty: '1', page: 35, explode: [0, 0, -0.025] }, [decals.mode]),
    part({ id: 'elec-decal-pm', sec: '6', item: '13', pn: '280347', fr: 'Autocollant entretien préventif', en: 'Daily PM decal', qty: '1', page: 35, explode: [0, 0, -0.02], note: 'Position relevée sur la photo du manuel opérateur p. 14.' }, [decals.pm]),
    part({ id: 'elec-decal-magnet', sec: '6', item: '9', pn: '280348', fr: 'Avertissement aimant', en: 'Magnet warning decal', qty: '1', page: 35, explode: [0, 0, -0.02], note: 'Position relevée sur la photo du manuel opérateur p. 14.' }, [decals.warn]),
  ]);
}

/* ------------------------------------------------------------------ */
/* Corps du boîtier, intérieur                                          */
/* ------------------------------------------------------------------ */
function buildBody() {
  const shell = [], zc = [], white = [];
  const depth = ZB - ZF;  // 0,203
  shell.push(aim(m(G.rectTube(BW, BH, depth, TW, 0.006), 'grey'), [CX, CY, (ZB + ZF) / 2], [0, 0, 1]));
  shell.push(m(G.box(BW - 0.003, BH - 0.003, TW, 0.001), 'grey', { p: [CX, CY, ZB - TW / 2] }));
  shell.push(m(G.plate(G.rrect(BW - 0.0004, BH - 0.0004, 0.006), TW, { holes: [{ rect: [0, 0, 0.468, 0.468, 0.004] }] }), 'grey', { p: [CX, CY, ZF + TW / 2] }));
  // pattes de fixation (dos), haut et bas
  for (const s of [-1, 1]) for (const t of [-1, 1]) {
    const tab = G.plate(G.rrect(0.045, 0.042, 0.005), 0.0027, { holes: [{ c: [0, t * 0.007], r: 0.0056 }] });
    shell.push(m(tab, 'grey', { p: [CX + s * 0.18, CY + t * (BH / 2 + 0.009), ZB - 0.00135] }));
  }
  // brides de fermeture (haut, bas, côté +X) : vis à tête cruciforme vers l'avant
  const clamp = (u, v, nu, nv) => {
    const g = [];
    const ax = (o) => [CX - (u + nu * o), CY + v + nv * o];
    const tang = nu ? [0, 1] : [1, 0];
    const bw = 0.024;
    const sz = (along, across, dz) => nu ? [across, along, dz] : [along, across, dz];
    let [x, y] = ax(0.0055); g.push(m(G.box(...sz(bw, 0.010, 0.024), 0.0015), 'zincClear', { p: [x, y, -0.717] }));
    [x, y] = ax(0.0012); g.push(m(G.box(...sz(bw, 0.0175, 0.002), 0.0008), 'zincClear', { p: [x, y, -0.7306] }));
    [x, y] = ax(0.0035); g.push(m(G.lathe([[0, 0], [0.0046, 0], [0.0046, 0.0012], [0.0036, 0.0028], [0, 0.003]], 20), 'zincClear', { p: [x, y, -0.7316], r: [-90, 0, 0] }));
    return g;
  };
  zc.push(...clamp(0, BH / 2, 0, 1), ...clamp(0, -BH / 2, 0, -1), ...clamp(-BW / 2, 0.165, -1, 0), ...clamp(-BW / 2, -0.165, -1, 0));
  // charnière continue côté -X (droite de l'opérateur)
  const hx = CX - BW / 2 - 0.004, hz = -0.7224;
  for (let i = 0; i < 9; i++) zc.push(m(G.cyl(0.0042, 0.0465, 16), 'zincClear', { p: [hx, CY - 0.2205 + 0.0245 + i * 0.049, hz] }));
  zc.push(m(G.cyl(0.0016, 0.444, 8), 'zincClear', { p: [hx, CY, hz] }));
  zc.push(m(G.box(0.0013, 0.444, 0.018, 0.0004), 'zincClear', { p: [CX - BW / 2 - 0.00075, CY, -0.7125] }));
  // fond de montage blanc et entretoises
  white.push(m(G.plate(G.rrect(0.432, 0.432, 0.004), 0.0027, { holes: [{ slot: [0.19, 0.19, 0.19, 0.198], r: 0.0045 }, { slot: [-0.19, 0.19, -0.19, 0.198], r: 0.0045 }, { c: [0.19, -0.195], r: 0.0045 }, { c: [-0.19, -0.195], r: 0.0045 }] }), 'white', { p: [CX, CY, BPZ + 0.00135] }));
  for (const s of [-1, 1]) for (const t of [-1, 1]) zc.push(cylAxis(0.0045, 0.0104, 'zincClear', [CX + s * 0.19, CY + t * 0.1945, (ZB - TW + BPZ + 0.0027) / 2], [0, 0, 1], 12));
  return part({ id: 'elec-p24-box', sec: '9', item: '17', pn: '279593', fr: 'Boîtier 20 x 20 x 8 po', en: '20 x 20 x 8 in enclosure', qty: '1', page: 38, explode: [0, 0, 0], note: 'Corps usiné avec fond de montage blanc. La porte est un nœud séparé.' }, [shell, zc, white]);
}

/** Goulottes 1 x 3 po (5 tronçons), dessin p. 39. */
function buildDucts() {
  const g = [];
  const DW = 0.032, DD = 0.076, FW = 0.0055, PITCH = 0.0105;
  const duct = (u0, u1, v0, v1) => {
    const horiz = Math.abs(u1 - u0) > Math.abs(v1 - v0);
    const len = horiz ? Math.abs(u1 - u0) : Math.abs(v1 - v0), uc = (u0 + u1) / 2, vc = (v0 + v1) / 2;
    const dim = (al, ac, d) => horiz ? [al, ac, d] : [ac, al, d];
    g.push(bpBox(...dim(len, DW, 0.002), uc, vc, 0, MT.duct(), 0));
    for (const s of [-1, 1]) {
      const off = s * (DW / 2 - 0.0009);
      g.push(bpBox(...dim(len, 0.0018, 0.012), horiz ? uc : uc + off, horiz ? vc + off : vc, 0.002, MT.duct(), 0));
      const n = Math.floor(len / PITCH);
      for (let i = 0; i < n; i++) {
        const t = -len / 2 + (i + 0.5) * len / n;
        g.push(bpBox(...dim(FW, 0.0018, DD - 0.016), horiz ? uc + t : uc + off, horiz ? vc + off : vc + t, 0.014, MT.duct(), 0));
      }
    }
    g.push(bpBox(...dim(len, DW + 0.003, 0.0028), uc, vc, DD - 0.0028, MT.duct(), 0.0006));
  };
  duct(-0.181, 0.025, 0.200, 0.200);
  duct(0.0465, 0.0465, 0.0105, 0.216);
  duct(-0.162, 0.183, -0.0305, -0.0305);
  duct(0.2005, 0.2005, -0.193, -0.014);
  duct(-0.002, 0.185, -0.183, -0.183);
  return g;
}

/** Câblage simplifié des borniers vers les goulottes (repère 13, tableau de câblage). */
function buildWires() {
  const blue = [], white = [];
  const W5 = 0.0052;
  const wire = (arr, pts) => arr.push(m(G.sweep(pts.map(([u, v, d]) => BP(u, v, d)), 0.0011, { radial: 5, seg: 8 }), arr === blue ? MT.wireBlue() : MT.wireWhite()));
  // bornier 2 : vers la goulotte du haut et celle du milieu
  for (let i = 0; i < 17; i++) {
    const u = -0.0665 + i * W5 + (i > 8 ? 0.0022 : 0);
    wire(i % 3 ? blue : white, [[u, TB2V + 0.0445, 0.022], [u, TB2V + 0.062, 0.032], [u, 0.186, 0.040]]);
    wire(i % 2 ? white : blue, [[u, TB2V - 0.0445, 0.022], [u, TB2V - 0.062, 0.030], [u, -0.0155, 0.040]]);
  }
  for (let i = 0; i < 10; i++) { const u = -0.177 + i * 0.0084; wire(blue, [[u, TB2V + 0.046, 0.028], [u, TB2V + 0.065, 0.034], [u, 0.186, 0.042]]); }
  // bornier 1 : vers la goulotte du milieu
  for (let i = 0; i < 16; i++) { const u = -0.075 + i * W5; wire(i % 2 ? blue : white, [[u, TB1V + 0.0445, 0.022], [u, TB1V + 0.060, 0.032], [u, -0.046, 0.040]]); }
  for (let i = 0; i < 6; i++) { const u = 0.0745 + i * 0.0175; wire(i % 2 ? white : blue, [[u, TB1V + 0.046, 0.045], [u, TB1V + 0.060, 0.050], [u, -0.046, 0.045]]); wire(blue, [[u, TB1V - 0.046, 0.045], [u, TB1V - 0.058, 0.050], [u, -0.168, 0.045]]); }
  return [blue, white];
}

/* ------------------------------------------------------------------ */
/* Panneau 24 V (279182), ensemble de 1er niveau                        */
/* ------------------------------------------------------------------ */
function buildPanel24() {
  const extra = {};
  const tb2 = buildTB2(extra);
  const S = '9', pg = 38;
  // récepteur radio (11) sur la plaque de côté (21), paroi +X intérieure
  const xw = CX + BW / 2 - TW - 0.0006;     // nu de la plaque côté paroi
  const plate21 = [m(G.box(0.003, 0.430, 0.180, 0.003), 'zincClear', { p: [xw - 0.0015, CY, -0.615] })];
  const rx = [], rxl = [];
  const prof = shapeOf([[0, 0.085], [0.036, 0.085], [0.067, -0.085], [0, -0.085]]);
  const rg = new THREE.ExtrudeGeometry(prof, { depth: 0.150, bevelEnabled: true, bevelSize: 0.003, bevelThickness: 0.003, bevelSegments: 2 });
  rg.translate(0, 0, -0.075);
  rx.push(m(orient(rg, [-1, 0, 0], [0, 1, 0], [xw - 0.0033, CY + 0.05, -0.628]), 'plastic'));
  rxl.push(plane(0.030, 0.012, 'plasticLight', [0, 0, 1], [0.179, 0.984, 0], [xw - 0.003 - 0.0575, CY + 0.06, -0.66]));
  rxl[0].material = cmat('rxLabel', 256, 100, (c, w, h) => { c.fillStyle = '#e8e8e2'; c.fillRect(0, 0, w, h); txt(c, 'RX  868 MHz', w / 2, h / 2, h * 0.4, { color: '#222' }); });
  const plugs = { a: [], b: [] };
  for (const [k, zz] of [['a', -0.585], ['b', -0.625]]) {
    const top = CY + 0.05 - 0.088;
    plugs[k].push(m(G.cyl(0.0085, 0.010, 20), 'plastic', { p: [xw - 0.03, top - 0.005, zz] }), m(G.cyl(0.0080, 0.040, 20), 'plastic', { p: [xw - 0.03, top - 0.030, zz] }), m(G.cyl(0.0055, 0.012, 16), 'plastic', { p: [xw - 0.03, top - 0.056, zz] }));
  }
  // coaxial vers la prise TNC (3) et antenne extérieure
  const ant = [];
  const tz = -0.665, tu = -0.211, y0 = CY - BH / 2;
  ant.push(m(G.sweep([[xw - 0.04, CY + 0.05 - 0.08, -0.66], [xw - 0.05, CY - 0.06, -0.668], [CX - tu, y0 + 0.06, tz], [CX - tu, y0 + 0.012, tz]], 0.0025, { radial: 8 }), 'plastic'));
  ant.push(m(G.hex(0.016, 0.004), 'zincClear', { p: [CX - tu, y0 + TW + 0.002, tz] }), m(G.cyl(0.0065, 0.012, 16), 'zincClear', { p: [CX - tu, y0 - 0.006, tz] }));
  ant.push(m(G.cyl(0.0058, 0.018, 16), 'plastic', { p: [CX - tu, y0 - 0.021, tz] }), m(G.lathe([[0, 0], [0.0062, 0], [0.0062, 0.010], [0.0050, 0.020], [0.0048, 0.090], [0.0035, 0.10], [0, 0.102]], 18), 'plastic', { p: [CX - tu, y0 - 0.030, tz], r: [180, 0, 0] }));
  // prises sous le boîtier (dessin p. 39), u relevés, rangée 1 près de la porte
  const R1 = -0.665, R2 = -0.599;
  const rec = (list) => list.flatMap(([u, z, s, k]) => receptacle(u, z, s, k));
  const recs = {
    r25: rec([[-0.160, R1, 'm12', 'f'], ...[-0.207, -0.162, -0.118, -0.073, -0.028, 0.016, 0.061].map(u => [u, R2, 'm12', 'f'])]),
    r14: rec([[-0.108, R1, 'm12', 'f']]), r20: rec([[-0.061, R1, 'm12', 'f'], [-0.010, R1, 'm12', 'f']]),
    r27: rec([[0.043, R1, '78', 'f'], [0.095, R1, '78', 'f']]), r34: rec([[0.146, R1, '78', 'f']]), r23: rec([[0.197, R1, '78', 'm']]),
    r26: rec([[0.106, R2, 'm12', 'f'], [0.150, R2, 'm12', 'f']]), r24: rec([[0.197, R2, 'm12', 'm']]),
  };
  // bandes « PANEL CONNECTIONS » (autocollants 16 et 17 du kit FR) sous le boîtier
  const ys = y0 - 0.0006;
  const cn1 = [['ANT', -0.211], ['RESERVE', -0.160], ['TELE', -0.108], ['CN36', -0.061], ['CN35', -0.010], ['CN8', 0.043], ['CN7', 0.095], ['CN6', 0.146], ['CN2', 0.197]];
  const cn2 = [['RESERVE', -0.207], ['CN12', -0.162], ['CN14', -0.118], ['CN13', -0.073], ['CN11', -0.028], ['CN10', 0.016], ['CN5', 0.061], ['RESERVE', 0.106], ['CN9', 0.150], ['CN4', 0.197]];
  const strip = (lab, key) => cmat(key, 1536, 40, drawStrip(lab.map(([s, u]) => [s, (u + 0.23) / 0.46])));
  const d16 = [plane(0.46, 0.012, strip(cn1, 'cn1'), [-1, 0, 0], [0, 0, -1], [CX, ys, -0.6935])];
  const d17 = [plane(0.46, 0.012, strip(cn2, 'cn2'), [-1, 0, 0], [0, 0, -1], [CX, ys, -0.628])];
  // décalque des numéros de disjoncteurs (16) et diodes (1) sur le bornier 2
  const cbL = Array.from({ length: 10 }, (_, i) => [`CB${i + 1}`, (i + 0.5) / 10]);
  const dcb = [plane(extra.cbDecal.w, 0.009, cmat('cbnum', 512, 48, drawStrip(cbL)), [-1, 0, 0], [0, 1, 0], BP(extra.cbDecal.u, extra.cbDecal.v, RAIL_TOP + 0.0406))];
  const diodes = extra.diodeU.flatMap(u => [bpBox(0.0035, 0.007, 0.0035, u, extra.diodeV, RAIL_TOP + 0.0302, 'plastic', 0.0006)]);
  // visserie : vis des goulottes (7, 2), plaque de côté (9, 10, 30, 32, 33), contre-écrous (35)
  const hw = [];
  const dsc = [[-0.15, 0.2], [-0.08, 0.2], [-0.01, 0.2], [0.0465, 0.18], [0.0465, 0.11], [0.0465, 0.04], [-0.13, -0.0305], [0.0, -0.0305], [0.13, -0.0305], [0.2005, -0.04], [0.2005, -0.10], [0.2005, -0.165], [0.02, -0.183], [0.08, -0.183], [0.14, -0.183], [0.175, -0.183]];
  for (const [u, v] of dsc) { const p = BP(u, v, 0.002); hw.push(aim(washer({ d: 0.19 * IN, mat: 'zincClear' }), p, OUT), aim(bolt({ d: 0.19 * IN, L: 0.375 * IN, head: 'bhcs', mat: 'zincClear' }), [p[0], p[1], p[2] - 0.0006], OUT)); }
  for (const t of [-1, 1]) for (const zz of [-0.546, -0.687]) {
    const yy = CY + t * 0.195, xo = CX + BW / 2;
    hw.push(aim(washer({ d: 0.25 * IN, od: 0.75 * IN }), [xo, yy, zz], [1, 0, 0]), aim(bolt({ d: 0.25 * IN, L: 1 * IN }), [xo + 0.0016, yy, zz], [1, 0, 0]));
    hw.push(aim(washer({ d: 0.25 * IN }), [xw - 0.003, yy, zz], [-1, 0, 0]), aim(nut({ d: 0.25 * IN }), [xw - 0.0034, yy, zz], [-1, 0, 0]));
  }
  for (const u of [0.043, 0.095]) hw.push(m(G.hex(0.033, 0.004), 'zincClear', { p: [CX - u, y0 + TW + 0.010, R1] }));
  const rxhw = [];
  for (const t of [-1, 1]) for (const zz of [-0.562, -0.694]) rxhw.push(aim(bolt({ d: 0.19 * IN, L: 0.5 * IN, head: 'shcs', mat: 'blackOxide' }), [xw - 0.004 - (t > 0 ? 0.037 : 0.067), CY + 0.05 + t * 0.080, zz], [-1, 0, 0]));
  const [wb, ww] = buildWires();
  return asm({ id: 'panel24', sec: S, item: '15', pn: '279182', fr: 'Panneau électrique 24 V', en: '24 V panel', qty: '1', page: pg, explode: [0, 0, 0], note: 'Boîtier 20 x 20 x 8 po sur le flanc -Z du socle. Porte vers -Z.' }, [
    buildBody(),
    buildDoor(),
    buildPPU(),
    tb2,
    buildTB1(),
    part({ id: 'elec-p24-ducts', sec: S, item: '12', pn: '264365', fr: 'Goulottes 1 x 3 po', en: '1 x 3 in wiring ducts', qty: '5', page: 39, explode: [0, 0, -0.13] }, buildDucts()),
    part({ id: 'elec-p24-wiring', sec: S, item: '13', pn: '268738', fr: 'Câblage du panneau', en: 'Panel wiring', qty: '1', page: 40, approx: true, explode: [0, 0, -0.17], note: 'Repère 13 : tableau de câblage. Fils simplifiés (non dessinés au manuel).' }, [wb, ww]),
    part({ id: 'elec-p24-plate', sec: S, item: '21', pn: '279741', fr: 'Plaque de côté', en: 'Side plate', qty: '1', page: 39, explode: [0, 0, -0.30] }, plate21),
    part({ id: 'elec-p24-radio', sec: S, item: '11', pn: '263580', fr: 'Récepteur radio', en: 'Radio receiver', qty: '1', page: 39, explode: [-0.05, 0, -0.30] }, [rx, rxl]),
    part({ id: 'elec-p24-plug8', sec: S, item: '29', pn: '279932', fr: 'Fiche M12 8 broches', en: 'M12 8-pin plug', qty: '1', page: 39, explode: [-0.05, -0.04, -0.30] }, plugs.a),
    part({ id: 'elec-p24-plug5', sec: S, item: '28', pn: '279931', fr: 'Fiche M12 5 broches', en: 'M12 5-pin plug', qty: '1', page: 39, explode: [-0.05, -0.04, -0.30] }, plugs.b),
    part({ id: 'elec-p24-rxhw', sec: S, item: '31, 33', pn: 'C1084', fr: 'Vis du récepteur', en: 'Receiver screws', qty: '4', page: 39, explode: [-0.10, 0, -0.30], note: 'Repères 31 (vis #10-24, 4) et 33 (rondelles #10).' }, rxhw),
    part({ id: 'elec-p24-antenna', sec: S, item: '3', pn: '243171', fr: 'Câble coaxial et antenne', en: 'Coax cable and antenna', qty: '1', page: 38, explode: [0, -0.12, 0], note: "Antenne en bas à gauche (dessin p. 38, sans repère)." }, ant),
    part({ id: 'elec-p24-r25', sec: S, item: '25', pn: '279922', fr: 'Prises M12 4 broches', en: 'M12 4-pin receptacles', qty: '8', page: 39, explode: [0, -0.07, 0] }, recs.r25),
    part({ id: 'elec-p24-r14', sec: S, item: '14', pn: '271839', fr: 'Adaptateur M12 8 broches', en: 'M12 8-pin adapter', qty: '1', page: 39, explode: [0, -0.07, 0] }, recs.r14),
    part({ id: 'elec-p24-r20', sec: S, item: '20', pn: '279624', fr: 'Prises M12 vers RJ45', en: 'M12 to RJ45 receptacles', qty: '2', page: 39, explode: [0, -0.07, 0] }, recs.r20),
    part({ id: 'elec-p24-r27', sec: S, item: '27', pn: '279926', fr: 'Prises 7/8 po 5 broches', en: '7/8 in 5-pin receptacles', qty: '2', page: 39, explode: [0, -0.07, 0] }, recs.r27),
    part({ id: 'elec-p24-r34', sec: S, item: '34', pn: '280690', fr: 'Prise 7/8 po Minifast', en: '7/8 in Minifast receptacle', qty: '1', page: 39, explode: [0, -0.07, 0] }, recs.r34),
    part({ id: 'elec-p24-r23', sec: S, item: '23', pn: '279913', fr: 'Prise 7/8 po 3 broches mâle', en: '7/8 in 3-pin male receptacle', qty: '1', page: 39, explode: [0, -0.07, 0], note: "Prise du câble 24 V de l'ombilical (manuel opérateur p. 45)." }, recs.r23),
    part({ id: 'elec-p24-r26', sec: S, item: '26', pn: '279925', fr: 'Prises DeviceNet M12', en: 'M12 DeviceNet receptacles', qty: '2', page: 39, explode: [0, -0.07, 0] }, recs.r26),
    part({ id: 'elec-p24-r24', sec: S, item: '24', pn: '279919', fr: 'Prise M12 8 broches mâle', en: 'M12 8-pin male receptacle', qty: '1', page: 39, explode: [0, -0.07, 0] }, recs.r24),
    part({ id: 'elec-decal-cn1', sec: '6', item: '16', pn: '280788', fr: 'Bande des connexions (1 de 2)', en: 'Panel connections decal 1', qty: '1', page: 35, explode: [0, -0.02, 0], approx: true, note: 'Placée sous le boîtier, le long de la rangée 1 (ANT sous l\'antenne).' }, d16),
    part({ id: 'elec-decal-cn2', sec: '6', item: '17', pn: '280789', fr: 'Bande des connexions (2 de 2)', en: 'Panel connections decal 2', qty: '1', page: 35, explode: [0, -0.02, 0], approx: true, note: 'Placée sous le boîtier, le long de la rangée 2.' }, d17),
    part({ id: 'elec-p24-cbdecal', sec: S, item: '16', pn: '278970', fr: 'Numéros des disjoncteurs', en: 'CB numbers decal', qty: '1', page: 39, explode: [0, 0, -0.27] }, dcb),
    part({ id: 'elec-p24-diodes', sec: S, item: '1', pn: '118662', fr: 'Diodes', en: 'Diodes', qty: '5', page: 39, explode: [0, 0, -0.25] }, diodes),
    part({ id: 'elec-p24-hw', sec: S, item: '2, 7, 9, 10, 30, 32, 33, 35', pn: '253530', fr: 'Visserie du panneau', en: 'Panel hardware', qty: '1', page: 40, explode: [0, 0, -0.06], note: 'Vis #10-32 et rondelles des goulottes (7, 2), boulons 1/4 po de la plaque de côté (30, 32, 9, 10, 33), contre-écrous NPSL (35).' }, hw),
  ]);
}

/* ------------------------------------------------------------------ */
/* Couvercle souple (281371), p. 68                                      */
/* ------------------------------------------------------------------ */
const COV = { zf: -0.772, zb: -0.4710, yTopF: 1.360, yTopB: 1.383, yFlap: 1.335, yBot: 0.700, w: 0.56, r: 0.012, t: 0.0025 };
function buildCover() {
  const { zf, zb, yTopF, yTopB, yFlap, yBot, w, r, t } = COV;
  const sl = (yTopB - yTopF) / ((zb - r) - (zf + r)), a = Math.atan(sl);
  // profil (x local = z monde, y local = y monde)
  const pts = [[zb, yFlap], [zb, yTopB], ...arc(zb - r, yTopB, r, 0, Math.PI / 2 + a, 6).slice(1), ...arc(zf + r, yTopF, r, Math.PI / 2 + a, Math.PI, 6), [zf, 1.300]];
  const guard = [profile(pts, t, w, [0, 0, 1], [0, 1, 0], [CX, 0, 0])];
  const fh = 1.300 - yBot, eu = DOOR.estop[0], ev = CY + DOOR.estop[1];
  const face = G.plate(shapeOf([[-w / 2, fh / 2], ...arc(-w / 2 + 0.01, -fh / 2 + 0.01, 0.01, Math.PI, Math.PI * 1.5, 4), ...arc(w / 2 - 0.01, -fh / 2 + 0.01, 0.01, Math.PI * 1.5, Math.PI * 2, 4), [w / 2, fh / 2]]), t, { holes: [{ slot: [-eu, ev - (1.300 + yBot) / 2 - 0.020, -eu, ev - (1.300 + yBot) / 2 + 0.020], r: 0.0425 }], bevel: 0.0004, curve: 16 });
  guard.push(new THREE.Mesh(face.translate(CX, (1.300 + yBot) / 2, zf), MT.vinyl()));
  guard[0] = new THREE.Mesh(guard[0], MT.vinyl());
  // plaques 1 (extérieure) et 6 (intérieure), boulons 3, rondelles 4, écrous 5
  const yc = (yFlap + yTopB) / 2 - 0.003;
  const p1 = [m(G.box(0.52, 0.036, 0.003, 0.0012), 'zincClear', { p: [CX, yc, zb - t / 2 - 0.0003 - 0.0015] })];
  const z6 = zb + t / 2 + 0.0003 + 0.0015, y6t = L.pedestal.topY + 0.003;
  const p6 = [m(G.box(0.52, y6t - (yc - 0.018), 0.003, 0.0012), 'zincClear', { p: [CX, (y6t + yc - 0.018) / 2, z6] }),
    m(G.box(0.36, 0.003, -0.425 - (z6 - 0.0015), 0.0012), 'zincClear', { p: [CX, y6t - 0.0015, (-0.425 + z6 - 0.0015) / 2] })];
  const bh = [], nh = [];
  for (const du of [-0.227, -0.076, 0.076, 0.227]) {
    const x = CX + du, zo = zb - t / 2 - 0.0033;
    bh.push(aim(bolt({ d: 0.25 * IN, L: 1 * IN, washer: true }), [x, yc, zo - 0.25 * IN * 0.12], [0, 0, -1]));
    const zi = zb + t / 2 + 0.0033;
    nh.push(aim(washer({ d: 0.25 * IN }), [x, yc, zi], [0, 0, 1]), aim(nut({ d: 0.25 * IN }), [x, yc, zi + 0.0008], [0, 0, 1]));
  }
  const S = '13', pg = 68;
  return asm({ id: 'flexCover', sec: S, item: '19', pn: '281371', fr: 'Couvercle souple du panneau 24 V', en: '24 V panel flexible cover', qty: '1', page: pg, explode: [0, 0, 0], approx: true, note: "Capot en U renversé, transparent, devant la porte. Ouverture ovale devant l'arrêt d'urgence. Fixation au socle estimée." }, [
    part({ id: 'elec-fc-guard', sec: S, item: '2', pn: '281369', fr: 'Capot de protection souple', en: 'Spraydown guard', qty: '1', page: pg, explode: [0, 0.75, -0.04], approx: true, note: 'Matière transparente estimée (rendu du manuel opérateur p. 7).' }, guard),
    part({ id: 'elec-fc-plate1', sec: S, item: '1', pn: '281359', fr: 'Plaque extérieure', en: 'Outer plate', qty: '1', page: pg, explode: [0, 0, -0.05], approx: true }, p1),
    part({ id: 'elec-fc-plate6', sec: S, item: '6', pn: '281488', fr: 'Plaque intérieure', en: 'Inner plate', qty: '1', page: pg, explode: [0, 0, 0], approx: true, note: 'Cornière estimée : appui sur le dessus du socle (y = 1,40).' }, p6),
    part({ id: 'elec-fc-bolts', sec: S, item: '3, 4', pn: 'B044', fr: 'Boulons et rondelles', en: 'Bolts and washers', qty: '4', page: pg, explode: [0, 0, -0.11], note: 'Repères 3 (HHCS 1/4-20 x 1, 4) et 4 (rondelles, côté tête).' }, bh),
    part({ id: 'elec-fc-nuts', sec: S, item: '5, 4', pn: '237505', fr: 'Écrous autobloquants', en: 'Nylock nuts', qty: '4', page: pg, explode: [0, 0, 0.012], note: 'Repères 5 (écrous, 4) et 4 (rondelles, côté écrou). Le tableau dit 1/2-13, mais les boulons sont 1/4-20.' }, nh),
  ]);
}

/* ------------------------------------------------------------------ */
/* Support du panneau (277082), p. 83                                    */
/* ------------------------------------------------------------------ */
function buildMount() {
  const t = 0.0048, len = 0.56;
  const rails = [], hw = [];
  const zf2 = ZB + t / 2, zf1 = -0.45 - t / 2;
  for (const [k, yF2a, yF2b, yWeb, yF1] of [['up', 1.372, 1.2996, 1.2996, 1.225], ['dn', 0.780, 0.8544, 0.8544, 0.925]]) {
    const pts = [[zf2, yF2a], [zf2, yWeb], [zf1, yWeb], [zf1, yF1]];
    rails.push([m(profile(pts, t, len, [0, 0, 1], [0, 1, 0], [CX, 0, 0]), 'red')]);
    const ytab = k === 'up' ? CY + BH / 2 + 0.016 : CY - BH / 2 - 0.016;
    for (const s of [-1, 1]) {
      const x = CX + s * 0.18, zt = ZB - 0.0027;
      hw.push(aim(bolt({ d: 0.375 * IN, L: 1.25 * IN, washer: true }), [x, ytab, zt - 0.375 * IN * 0.12], [0, 0, -1]));
      hw.push(aim(washer({ d: 0.375 * IN }), [x, ytab, ZB + t], [0, 0, 1]), aim(nut({ d: 0.375 * IN }), [x, ytab, ZB + t + 0.0012], [0, 0, 1]));
    }
    const yb = (yWeb + yF1) / 2 + (k === 'up' ? -0.004 : 0.004);
    for (const du of [-0.22, 0, 0.22]) hw.push(aim(bolt({ d: 0.375 * IN, L: 1 * IN, washer: true }), [CX + du, yb, -0.45 - t - 0.375 * IN * 0.12], [0, 0, -1]));
  }
  const S = '15', pg = 83;
  return asm({ id: 'panelMount', sec: S, item: '16', pn: '277082', fr: 'Support du panneau électrique', en: 'Electrical panel mount', qty: '1', page: pg, explode: [0, 0, 0], note: 'Deux rails en Z entre le dos du panneau 24 V (z = -0,515) et le flanc du socle (z = -0,45).' }, [
    part({ id: 'elec-pm-rail-1', sec: S, item: '1', pn: '276791', fr: 'Rail de montage du haut', en: 'Upper mount plate', qty: '2', page: pg, approx: true, explode: [0, 0.05, -0.02], note: 'Exemplaire 1 sur 2. Profil en Z estimé, peint rouge (estimé).' }, rails[0]),
    part({ id: 'elec-pm-rail-2', sec: S, item: '1', pn: '276791', fr: 'Rail de montage du bas', en: 'Lower mount plate', qty: '2', page: pg, approx: true, explode: [0, -0.05, -0.02], note: 'Exemplaire 2 sur 2.' }, rails[1]),
    part({ id: 'elec-pm-hw', sec: S, item: '2, 3, 4, 5', pn: 'B144', fr: 'Visserie du support', en: 'Mount hardware', qty: '1', page: pg, explode: [0, 0, -0.08], note: 'Repères 4 (HHCS 3/8 x 1,25, 4) avec 3 (écrous) et 2 (rondelles) aux pattes ; 5 (HHCS 3/8 x 1, 6) dans le socle.' }, hw),
  ]);
}

/* ------------------------------------------------------------------ */
/* Articles livrés à part (zone au sol, côté +Z) : p. 7, 9, 37, 66       */
/* ------------------------------------------------------------------ */
const KZ = L.kitZone;
/** Panneau d'alimentation (280142), debout, face vers +Z. */
function buildPowerSupply() {
  const W = 0.240, H = 0.295, Dp = 0.160, x0 = -0.03, yb = 0.024, zb = KZ.z[0] + 0.05;
  const yc = yb + H / 2, zf = zb + Dp;
  const Q = (u, v, d) => [x0 + u, yc + v, zb + 0.012 + d];     // fond de montage, d vers +Z
  const qBox = (wu, hv, dd, u, v, d0, mk, r = 0.0005) => box(wu, hv, dd, mk, Q(u, v, d0 + dd / 2), r);
  const shell = [], zc = [], white = [], doorM = [], doorG = [];
  shell.push(aim(m(G.rectTube(W, H, Dp, TW, 0.006), 'grey'), [x0, yc, zb + Dp / 2], [0, 0, 1]));
  shell.push(m(G.box(W - 0.003, H - 0.003, TW, 0.001), 'grey', { p: [x0, yc, zb + TW / 2] }));
  shell.push(m(G.plate(G.rrect(W - 0.0004, H - 0.0004, 0.006), TW, { holes: [{ rect: [0, 0, W - 0.036, H - 0.036, 0.004] }] }), 'grey', { p: [x0, yc, zf - TW / 2] }));
  for (const s of [-1, 1]) for (const t of [-1, 1]) {
    const ear = G.plate(shapeOf([[-0.022, -0.012], [0.022, -0.012], [0.022, 0.006], [0.012, 0.016], [-0.012, 0.016], [-0.022, 0.006]]), 0.0027, { holes: [{ c: [0, 0.002], r: 0.004 }] });
    if (t < 0) ear.rotateZ(Math.PI);
    shell.push(m(ear, 'grey', { p: [x0 + s * (W / 2 - 0.035), yc + t * (H / 2 + 0.008), zb + 0.00135] }));
  }
  white.push(m(G.box(W - 0.030, H - 0.030, 0.0025, 0.002), 'white', { p: [x0, yc, zb + 0.0105] }));
  for (const s of [-1, 1]) for (const t of [-1, 1]) zc.push(cylAxis(0.004, 0.0075, 'zincClear', [x0 + s * (W / 2 - 0.03), yc + t * (H / 2 - 0.03), zb + 0.0057], [0, 0, 1], 12));
  // charnière côté -X (gauche, vue de face +Z)
  for (let i = 0; i < 6; i++) zc.push(m(G.cyl(0.0038, 0.040, 16), 'zincClear', { p: [x0 - W / 2 - 0.0038, yc - 0.1125 + i * 0.045, zf + 0.004] }));
  zc.push(m(G.box(0.0013, 0.27, 0.014, 0.0004), 'zincClear', { p: [x0 - W / 2 - 0.0007, yc, zf - 0.006] }));
  for (const t of [-1, 1]) zc.push(m(G.box(0.008, 0.022, 0.016, 0.0015), 'zincClear', { p: [x0 + W / 2 + 0.004, yc + t * 0.08, zf] }));
  // porte
  doorM.push(m(G.box(W, H, 0.0019, 0.003), 'grey', { p: [x0, yc, zf + 0.0105] }));
  doorM.push(aim(m(G.rectTube(W, H, 0.009, TW, 0.003), 'grey'), [x0, yc, zf + 0.005], [0, 0, 1]));
  doorG.push(m(G.plate(G.rrect(W - 0.012, H - 0.012, 0.004), 0.003, { holes: [{ rect: [0, 0, W - 0.03, H - 0.03, 0.003] }] }), 'rubber', { p: [x0, yc, zf + 0.0019] }));
  // rails, bornes, alimentation 20 A
  const pr = (u0, u1, v) => dinRail(u0, u1, v, (u, vv, d) => Q(u, vv, d));
  const rail = [pr(-0.050, 0.052, 0.081), pr(-0.105, 0.103, -0.049)];
  const qb = (wu, hv, dd, u, v, d0, mk, r) => qBox(wu, hv, dd, u, v, d0, mk, r);
  const flip = (fn) => (wu, hv, dd, u, v, d0, mk, r) => fn(wu, hv, dd, -u, v, d0, mk, r);
  const q2 = flip(qb);
  const tP = { body: [], push: [] }, tG = { body: [], push: [] }, tS = { body: [], push: [] }, stops = [], covers = [];
  let u = -0.033;
  const W5 = 0.0052;
  const st = (c) => stops.push(...endStop(c, 0.081, 0.0064, q2));
  st(u + 0.0032); u += 0.0064;
  for (let i = 0; i < 2; i++) { terminal(u + W5 / 2, 0.081, W5, 'plasticGrey', 'orange', tP, q2); u += W5; }
  covers.push(...endCover(u + 0.0011, 0.081, 0.0022, 'plasticGrey', q2)); u += 0.0022; st(u + 0.0032); u += 0.0064;
  for (let i = 0; i < 3; i++) { terminal(u + W5 / 2, 0.081, W5, MT.greenPl(), 'orange', tG, q2); u += W5; }
  covers.push(...endCover(u + 0.0011, 0.081, 0.0022, 'plasticGrey', q2)); u += 0.0022; st(u + 0.0032); u += 0.0064;
  for (let i = 0; i < 4; i++) { terminal(u + W5 / 2, 0.081, W5, 'plasticGrey', 'orange', tS, q2); u += W5; }
  covers.push(...endCover(u + 0.0011, 0.081, 0.0022, 'plasticGrey', q2)); u += 0.0022; st(u + 0.0032);
  const psu = { a: [], b: [] };
  psu.a.push(qBox(0.178, 0.124, 0.105, 0, -0.049, RAIL_TOP, 'alu', 0.003));
  for (let i = 0; i < 14; i++) psu.a.push(qBox(0.170, 0.0022, 0.006, 0, -0.049 + 0.054 - i * 0.0075, RAIL_TOP + 0.105, 'alu', 0.0006));
  psu.b.push(qBox(0.040, 0.012, 0.012, -0.055, -0.049 - 0.055, RAIL_TOP + 0.095, 'plasticGrey', 0.001), qBox(0.050, 0.012, 0.012, 0.050, -0.049 - 0.055, RAIL_TOP + 0.095, 'plasticGrey', 0.001));
  psu.b.push(plane(0.06, 0.03, cmat('psuLbl', 256, 128, (c, w, h) => { c.fillStyle = '#e9ebec'; c.fillRect(0, 0, w, h); txt(c, '24 V DC  20 A', w / 2, h * 0.38, h * 0.26, { color: '#1a3d7a' }); txt(c, 'POWER SUPPLY', w / 2, h * 0.72, h * 0.18, { color: '#333', weight: 'normal' }); }), [1, 0, 0], [0, 1, 0], Q(-0.03, -0.035, RAIL_TOP + 0.1056 + 0.006)));
  const hw = [];
  for (const [uu, vv] of [[-0.045, 0.081], [0.047, 0.081], [-0.100, -0.049], [0.0, -0.049], [0.098, -0.049]]) { const p = Q(uu, vv, 0.001); hw.push(aim(washer({ d: 0.19 * IN, mat: 'zincClear' }), p, [0, 0, 1]), aim(bolt({ d: 0.19 * IN, L: 0.375 * IN, head: 'bhcs', mat: 'zincClear' }), [p[0], p[1], p[2] + 0.0006], [0, 0, 1])); }
  // prises sous le boîtier : M12 8 broches (2) et 7/8 po 3 broches (3)
  const rcp = (u, z, s) => {
    const k = s === '78' ? 1.6 : 1, x = x0 + u, y0 = yb, o = [];
    const hh = 0.0035 * k, bl = 0.008 * k;  // six pans, fût fileté, capuchon (le bas reste au-dessus du sol)
    o.push(m(G.hex(0.0175 * k, hh), 'zincClear', { p: [x, y0 - hh / 2, z] }), m(G.cyl(0.0062 * k, bl, 20), 'zincClear', { p: [x, y0 - hh - bl / 2, z] }));
    o.push(m(G.cyl(0.0070 * k, 0.003, 20), 'zincClear', { p: [x, y0 - hh - bl - 0.0015, z] }), m(G.hex(0.0175 * k, 0.0045 * k), 'zincClear', { p: [x, y0 + TW + 0.0023 * k, z] }));
    return o;
  };
  const S = '4', pg = 9;
  const pp = (o) => [...o.body, ...o.push];
  return asm({ id: 'powerSupply', sec: S, item: '17', pn: '280142', fr: "Panneau d'alimentation", en: 'Power supply panel', qty: '1', page: pg, explode: [0, 0, 0], approx: true, note: "Livré à part (p. 7) : se monte sur la foreuse mère (manuel opérateur p. 45). Posé au sol, face vers +Z. Profondeur estimée." }, [
    part({ id: 'elec-ps-box', sec: S, item: '12', pn: '280152', fr: 'Boîtier usiné', en: 'Machined enclosure', qty: '1', page: pg, explode: [0, 0, 0] }, [shell, zc, white]),
    part({ id: 'elec-ps-door', sec: S, item: '12', pn: '280152', fr: 'Porte du boîtier', en: 'Enclosure door', qty: '1', page: pg, explode: [0, 0.04, 0.27], note: 'Porte du repère 12, charnière à gauche.' }, [doorM, doorG]),
    part({ id: 'elec-ps-psu', sec: S, item: '4', pn: '279621', fr: 'Alimentation 24 V CC 20 A', en: '20 A 24 V DC power supply', qty: '1', page: pg, explode: [0, 0, 0.17] }, [psu.a, psu.b]),
    part({ id: 'elec-ps-tbp', sec: S, item: '5', pn: '254027', fr: 'Bornes 3 étages 1 potentiel', en: '1-potential terminal blocks', qty: '2', page: pg, explode: [0, 0, 0.12] }, pp(tP)),
    part({ id: 'elec-ps-tbg', sec: S, item: '6', pn: '254028', fr: 'Bornes de mise à la terre', en: 'Ground terminal blocks', qty: '3', page: pg, explode: [0, 0, 0.12] }, pp(tG)),
    part({ id: 'elec-ps-tb', sec: S, item: '7', pn: '254026', fr: 'Bornes 3 étages', en: '3-level terminal blocks', qty: '4', page: pg, explode: [0, 0, 0.12] }, pp(tS)),
    part({ id: 'elec-ps-stop', sec: S, item: '8', pn: '111622', fr: 'Butées de fin', en: 'End stops', qty: '4', page: pg, explode: [0, 0, 0.12] }, stops),
    part({ id: 'elec-ps-cover', sec: S, item: '9', pn: '255667', fr: 'Couvercles de fin', en: 'End covers', qty: '3', page: pg, explode: [0, 0, 0.12] }, covers),
    part({ id: 'elec-ps-rail', sec: S, item: '1', pn: '274015', fr: 'Rails DIN', en: 'DIN rails', qty: '12', page: pg, explode: [0, 0, 0.05], note: 'Quantité imprimée 12 : longueur en pouces, deux tronçons.' }, rail),
    part({ id: 'elec-ps-m12', sec: S, item: '2', pn: '279921', fr: 'Prise M12 8 broches', en: 'M12 8-pin receptacle', qty: '1', page: pg, explode: [0, 0, 0.09], note: "Prise du câble d'arrêt d'urgence." }, rcp(-0.054, zb + 0.08, 'm12')),
    part({ id: 'elec-ps-78', sec: S, item: '3', pn: '279914', fr: 'Prise 7/8 po 3 broches', en: '7/8 in 3-pin receptacle', qty: '1', page: pg, explode: [0, 0, 0.09], note: 'Prise du câble 24 V.' }, rcp(0.043, zb + 0.08, '78')),
    part({ id: 'elec-ps-hw', sec: S, item: '10, 11', pn: '253530', fr: 'Visserie des rails', en: 'Rail hardware', qty: '5', page: pg, explode: [0, 0, 0.21], note: 'Repères 10 (rondelles #10, 5) et 11 (vis #10-32, 5).' }, hw),
  ]);
}

/** Moitiés de coupleur rapide le long de +Z. Femelle : manchon cannelé ; mâle : nez + six pans + filet ORB. */
function qdFemale(D, p, inv = false) {
  const r = D / 2, g = [];
  g.push(m(G.hex(D * 0.95, D * 0.42), 'zincClear', { p: [0, D * 0.21, 0] }));
  g.push(m(G.lathe([[r * 0.62, D * 0.40], [r * 0.98, D * 0.40], [r, D * 0.46], [r, D * 1.05], [r * 1.04, D * 1.1], [r * 1.04, D * 1.22], [r, D * 1.27], [r, D * 1.62], [r * 0.9, D * 1.7], [r * 0.62, D * 1.7]], 30), 'zincClear'));
  g.push(m(G.torus(r * 1.01, D * 0.025, Math.PI * 2, 6, 30), 'zincClear', { p: [0, D * 0.75, 0], r: [90, 0, 0] }));
  return aim(grp(g), p, [0, 0, inv ? -1 : 1]);
}
function qdMale(D, p, inv = false) {
  const r = D / 2, g = [];
  g.push(m(G.lathe([[0, 0], [r * 0.6, 0], [r * 0.6, D * 0.5], [r * 0.72, D * 0.55], [r * 0.72, D * 0.62], [0, D * 0.62]], 24), 'zincClear'));
  g.push(m(G.hex(D * 0.82, D * 0.55), 'zincClear', { p: [0, D * 0.9, 0] }));
  g.push(m(G.lathe([[0, D * 1.17], [r * 0.62, D * 1.17], [r * 0.62, D * 1.55], [r * 0.5, D * 1.6], [0, D * 1.6]], 24), 'zincClear'));
  return aim(grp(g), p, [0, 0, inv ? -1 : 1]);
}
/** Plaque de raccords rapides (278240), debout, face vers +Z. */
function buildTether() {
  const x0 = 0.36, zp = KZ.z[0] + 0.25, th = 0.25 * IN, W = 0.230, H = 0.225, ylift = 0.021;
  const yc = ylift + th + H / 2;
  const outline = [[-W / 2, -H / 2], [W / 2, -H / 2], ...arc(W / 2 - 0.03, H / 2 - 0.03, 0.03, 0, Math.PI / 2, 8), ...arc(-W / 2 + 0.03, H / 2 - 0.03, 0.03, Math.PI / 2, Math.PI, 8)];
  const pos = { s6a: [-0.058, 0.062], s6b: [0.058, 0.062], s12: [-0.055, -0.048], s16: [0.058, -0.052] };
  const sz = { s6a: 0.026, s6b: 0.026, s12: 0.040, s16: 0.050 };
  const plate = [m(G.plate(shapeOf(outline), th, { holes: Object.keys(pos).map(k => ({ c: pos[k], r: sz[k] * 0.36 })), curve: 8 }), 'red', { p: [x0, yc, zp] })];
  // pied replié vers l'arrière (-Z), côté droit, deux trous
  const footPts = [[0.0, 0], [W / 2, 0], [W / 2 - 0.01, -0.10], [W / 2 - 0.03, -0.12], [0.03, -0.12], [0.0, -0.09]];
  plate.push(m(orient(G.plate(shapeOf(footPts), th, { holes: [{ c: [0.06, -0.05], r: 0.0055 }, { c: [0.06, -0.095], r: 0.0055 }] }), [1, 0, 0], [0, 0, 1], [x0, ylift + th / 2, zp - th / 2]), 'red'));
  // pli à 90° entre la face et le pied (quart de tube le long de X)
  const bend = new THREE.CylinderGeometry(th, th, W / 2, 10, 1, false, Math.PI * 1.5, Math.PI / 2); bend.rotateZ(Math.PI / 2);
  plate.push(m(bend, 'red', { p: [x0 + W / 4, ylift + th, zp - th / 2] }));
  const nodes = {};
  const zfr = zp + th / 2;
  const add = (k, o) => { (nodes[k] = nodes[k] || []).push(o); };
  // raccords de cloison 8, 9, 10 : six pans + contre-écrou derrière, nez JIC
  for (const k of Object.keys(pos)) {
    const D = sz[k], [u, v] = pos[k], x = x0 + u, y = yc + v;
    const key = k === 's12' ? 'f12' : k === 's16' ? 'f16' : 'f6';
    add(key, m(G.hex(D * 0.75, D * 0.22), 'zinc', { p: [x, y, zfr + D * 0.11], r: [90, 0, 0] }));
    add(key, m(G.hex(D * 0.75, D * 0.2), 'zinc', { p: [x, y, zp - th / 2 - D * 0.1], r: [90, 0, 0] }));
    add(key, m(G.lathe([[0, 0], [D * 0.3, 0], [D * 0.3, D * 0.5], [D * 0.22, D * 0.62], [0, D * 0.62]], 20), 'zinc', { p: [x, y, zp - th / 2 - D * 0.2], r: [-90, 0, 0] }));
  }
  // paires de coupleurs : femelle ou mâle côté plaque (mâles et femelles inversés, note du dessin)
  const pair = (k, Dq, plateSide, idF, idM) => {
    const [u, v] = pos[k], x = x0 + u, y = yc + v, z0 = zfr + Dq * 0.22;
    if (plateSide === 'f') {
      add(idF, qdFemale(Dq, [x, y, z0]));                                   // manchon vers l'avant
      add(idM, qdMale(Dq, [x, y, z0 + Dq * 1.7 - Dq * 0.55]));             // nez dans le manchon, filet ORB vers l'avant
    } else {
      const tip = z0 + Dq * 1.6;                                            // filet ORB à la plaque, nez vers l'avant
      add(idM, qdMale(Dq, [x, y, tip], true));
      add(idF, qdFemale(Dq, [x, y, tip - Dq * 0.55 + Dq * 1.7], true));    // manchon tourné vers la plaque
    }
  };
  pair('s6a', 0.030, 'm', 'qd6f1', 'qd6m1'); pair('s6b', 0.030, 'f', 'qd6f2', 'qd6m2'); pair('s12', 0.046, 'm', 'qd12f', 'qd12m'); pair('s16', 0.056, 'm', 'qd16f', 'qd16m');
  // visserie 11, 12, 13 : boulons verticaux dans le pied, écrous dessous (au sol)
  const hw = [];
  for (const dz of [-0.05, -0.095]) {
    const x = x0 + 0.06, z = zp - th / 2 + dz;
    hw.push(aim(bolt({ d: 0.375 * IN, L: 1.25 * IN }), [x, ylift + th + 0.0045, z], [0, 1, 0]));
    hw.push(m(G.tube(0.0095, 0.005, 0.0045, 20), 'zinc', { p: [x, ylift + th + 0.00225, z] }), m(G.tube(0.0095, 0.005, 0.0045, 20), 'zinc', { p: [x, ylift - 0.00225 + 0.0045 - 0.0045, z] }));
    hw.push(m(G.hex(0.0143, 0.0075, 0.005), 'zinc', { p: [x, ylift - 0.0045 - 0.00375, z] }));
  }
  const S = '8', pg = 37;
  return asm({ id: 'tetherBulkhead', sec: S, item: '7', pn: '278240', fr: 'Plaque de raccords rapides', en: 'Tether bulkhead plate', qty: '1', page: pg, explode: [0, 0, 0], note: "Livrée à part (p. 7) : reçoit l'ombilical 4 boyaux. Posée au sol, face vers +Z." }, [
    part({ id: 'elec-tb-plate', sec: S, item: '7', pn: '278241', fr: 'Plaque de cloison', en: 'Bulkhead plate', qty: '1', page: pg, approx: true, explode: [0, 0, 0], note: 'Couleur estimée (rouge). Pied replié vers l\'arrière.' }, plate),
    part({ id: 'elec-tb-qd6m-1', sec: S, item: '2', pn: '241911', fr: 'Coupleur mâle #6', en: '#6 male coupler', qty: '2', page: pg, explode: [0, 0, 0.05], note: 'Exemplaire 1 sur 2 (côté plaque, en haut à gauche).' }, nodes.qd6m1),
    part({ id: 'elec-tb-qd6f-1', sec: S, item: '1', pn: '241910', fr: 'Coupleur femelle #6', en: '#6 female coupler', qty: '2', page: pg, explode: [0, 0, 0.16], note: 'Exemplaire 1 sur 2 (bout libre, en haut à gauche).' }, nodes.qd6f1),
    part({ id: 'elec-tb-qd6f-2', sec: S, item: '1', pn: '241910', fr: 'Coupleur femelle #6', en: '#6 female coupler', qty: '2', page: pg, explode: [0, 0, 0.05], note: 'Exemplaire 2 sur 2 (côté plaque, en haut à droite) : mâle et femelle inversés (note du dessin).' }, nodes.qd6f2),
    part({ id: 'elec-tb-qd6m-2', sec: S, item: '2', pn: '241911', fr: 'Coupleur mâle #6', en: '#6 male coupler', qty: '2', page: pg, explode: [0, 0, 0.16], note: 'Exemplaire 2 sur 2 (bout libre, en haut à droite).' }, nodes.qd6m2),
    part({ id: 'elec-tb-qd12m', sec: S, item: '4', pn: '241913', fr: 'Coupleur mâle #12', en: '#12 male coupler', qty: '1', page: pg, explode: [0, 0, 0.05] }, nodes.qd12m),
    part({ id: 'elec-tb-qd12f', sec: S, item: '3', pn: '241912', fr: 'Coupleur femelle #12', en: '#12 female coupler', qty: '1', page: pg, explode: [0, 0, 0.18] }, nodes.qd12f),
    part({ id: 'elec-tb-qd16m', sec: S, item: '6', pn: '241915', fr: 'Coupleur mâle #16', en: '#16 male coupler', qty: '1', page: pg, explode: [0, 0, 0.05] }, nodes.qd16m),
    part({ id: 'elec-tb-qd16f', sec: S, item: '5', pn: '241914', fr: 'Coupleur femelle #16', en: '#16 female coupler', qty: '1', page: pg, explode: [0, 0, 0.20] }, nodes.qd16f),
    part({ id: 'elec-tb-fit6', sec: S, item: '8', pn: 'S3843-06-06', fr: 'Raccords de cloison #6', en: '#6 bulkhead fittings', qty: '2', page: pg, explode: [0, 0, -0.07] }, nodes.f6),
    part({ id: 'elec-tb-fit12', sec: S, item: '9', pn: 'S3843-12-12', fr: 'Raccord de cloison #12', en: '#12 bulkhead fitting', qty: '1', page: pg, explode: [0, 0, -0.07] }, nodes.f12),
    part({ id: 'elec-tb-fit16', sec: S, item: '10', pn: 'S3843-16-16', fr: 'Raccord de cloison #16', en: '#16 bulkhead fitting', qty: '1', page: pg, explode: [0, 0, -0.07] }, nodes.f16),
    part({ id: 'elec-tb-hw', sec: S, item: '11, 12, 13', pn: 'SH00012-1.250', fr: 'Boulons du pied', en: 'Foot bolts', qty: '2', page: pg, explode: [0, 0.08, 0], note: 'Repères 11 (boulons 3/8 x 1,25, 2), 12 (rondelles Nord-Lock, 4) et 13 (écrous, 2).' }, hw),
  ]);
}

/** Trousse de câbles (278226) : rouleaux posés au sol (approximatif, allégé). */
function buildCableKit() {
  const y = KZ.y;
  /** Rouleau à plat : hélice basse (une épaisseur de câble par tour), deux bouts tangents avec connecteurs M12.
   *  turns en demi-tours (k + 0,5) : les deux bouts partent vers -Z (ph = 0) ou vers +Z (ph = 1). */
  const coil = (cx, cz, R, turns, rC, mk, conn, ph = 0) => {
    const pts = [], n = Math.round(turns * 32), a0 = ph ? Math.PI : 0;
    for (let i = 0; i <= n; i++) {
      const f = i / n, a = a0 + f * turns * Math.PI * 2, rr = R * (1 + 0.035 * Math.sin(a * 3 + R * 50));
      pts.push([cx + rr * Math.cos(a), y + rC + 1.9 * rC * f * (turns - 0.5), cz + rr * Math.sin(a)]);
    }
    const g = [m(G.sweep(pts, rC, { radial: 8 }), mk)];
    for (const k of [0, 1]) {
      const a = a0 + (k ? turns * Math.PI * 2 : 0), p = pts[k ? n : 0], sg = k ? 1 : -1;
      const dir = [-Math.sin(a) * sg, 0, Math.cos(a) * sg];
      const tip = [p[0] + dir[0] * 0.03, y + rC, p[2] + dir[2] * 0.03];
      g.push(m(G.sweep([p, [(p[0] + tip[0]) / 2, (p[1] + tip[1]) / 2, (p[2] + tip[2]) / 2], tip], rC, { radial: 8 }), mk));
      g.push(aim(grp([m(G.cyl(rC * 1.5, 0.032, 16), mk, { p: [0, 0.016, 0] }), m(G.cyl(rC * 1.75, 0.012, 16), conn, { p: [0, 0.038, 0] })]), [tip[0], y + rC * 1.75, tip[2]], dir));
    }
    return g;
  };
  const S = '12', pg = 66;
  const zA = 1.535, zB = 1.665;
  return asm({ id: 'cableKit', sec: S, pn: '278226', fr: 'Trousse de câbles', en: 'Cable kit', qty: '1', page: pg, explode: [0, 0, 0], approx: true, note: "Livrée à part (p. 7). Rouleaux simplifiés, posés au sol." }, [
    part({ id: 'elec-ck-misc', sec: S, item: '1 à 8, 10 à 13, 15, 17 à 21', pn: '279832', fr: 'Cordons M12 et réseau', en: 'M12 and network cordsets', qty: '1', page: pg, approx: true, explode: [0, 0.03, 0], note: 'Regroupe 18 repères de la p. 67 (cordons capteurs, DeviceNet, Ethernet).' }, [coil(-0.11, zA, 0.08, 3.5, 0.0032, 'cableBlack', 'zincClear'), coil(0.06, zA, 0.065, 2.5, 0.003, MT.devnet(), 'zincClear')]),
    part({ id: 'elec-ck-279723', sec: S, item: '16', pn: '279723', fr: 'Cordon Profinet 4 broches', en: 'Profinet cordset', qty: '4', page: pg, spare: true, approx: true, explode: [0, 0.06, 0], note: 'Pièce de rechange critique (p. 85).' }, coil(0.03, zB, 0.055, 2.5, 0.003, MT.profinet(), 'zincClear', 1)),
    part({ id: 'elec-ck-279834', sec: S, item: '9', pn: '279834', fr: 'Cordon 5 m 4 broches', en: '5 m 4-pin cordset', qty: '2', page: pg, spare: true, approx: true, explode: [0, 0.06, 0], note: 'Pièce de rechange critique (p. 85).' }, coil(0.20, zB - 0.005, 0.05, 3.5, 0.0028, 'cableYellow', 'zincClear', 1)),
    part({ id: 'elec-ck-279356', sec: S, item: '14', pn: '279356', fr: 'Cordon 2 m 4 broches', en: '2 m 4-pin cordset', qty: '4', page: pg, spare: true, approx: true, explode: [0, 0.06, 0], note: 'Pièce de rechange critique (p. 85).' }, coil(-0.12, zB, 0.045, 2.5, 0.0028, 'cableBlack', 'zincClear', 1)),
  ]);
}

/* ------------------------------------------------------------------ */
export function build() {
  return [buildPanel24(), buildCover(), buildMount(), buildPowerSupply(), buildTether(), buildCableKit()];
}
