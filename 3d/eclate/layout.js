/* RodBot LP, vue éclatée : cotes communes à tous les ensembles (mètres).
 * Sources :
 *  - Manuel opérateur OM 10667 R0, p. 8 et 9 : 116 x 60 x 90 po, chenilles 71 / 46 / 12 po,
 *    garde au sol 10 po, course des stabilisateurs 10,5 po, tiges 5 po x 6 pi.
 *  - Manuel opérateur p. 79 : vue de côté cotée (fourreaux à 36 po d'entraxe). Échelle relevée :
 *    3,244 mm par pixel à 200 ppp. Les autres cotes ci-dessous sont mesurées sur cette vue.
 *  - Manuel de pièces PM10654 : proportions des dessins de chaque ensemble.
 * Repère : Y vers le haut, sol à 0. X = longueur, socle (piédestal) à -X, bout du bac à +X.
 * Z = largeur : panneau 24 V (écran) du côté -Z, leviers de déplacement du côté +Z.
 * Ces valeurs sont des interfaces : chaque ensemble doit s'y raccorder.
 */
export const IN = 0.0254;

export const L = {
  overall: { length: 116 * IN, width: 60 * IN, minHeight: 90 * IN },

  /* Chenilles (276973, CARRIAGE ASSY) : deux trains en stade. */
  track: {
    length: 2.27,          // enveloppe extérieure relevée p. 79 (71 po = partie droite au sol)
    height: 0.477,         // relevé p. 79
    width: 12 * IN,        // 0,305
    gaugeHalf: 23 * IN,    // 46 po d'entraxe : centres à z = ±0,584
    centerX: 0.0,
  },

  /* Châssis soudé (276685, FRAME WELDMENT, CRAWLER). */
  frame: {
    deckY: 0.658,          // dessus du châssis, sous le bac (relevé p. 79)
    sideBottomY: 0.43,     // bas des flancs rouges au-dessus des chenilles
    clearanceY: 10 * IN,   // 0,254 : dessous des traverses
    xMin: -1.36, xMax: 1.38,
    halfWidth: 0.70,
    lugTipX: [-1.49, 1.49], // pointes des pattes de levage (bout à bout ≈ 116 po)
  },

  /* Stabilisateurs (277131) aux 4 coins. */
  stabilizer: { x: [-1.255, 1.285], z: 0.66, stroke: 10.5 * IN, footRetractedY: 0.20 },

  /* Bac à tiges (276983, TUB WELDT, 6 FT RODS). */
  tub: { xMin: -0.73, xMax: 1.377, halfWidth: 0.675, bottomY: 0.658, topY: 1.20, pocketPitch: 36 * IN },

  /* Socle (278249, PEDESTAL) : caisson avant sous la tourelle (PIPE HANDLER MNT 276769).
   * Face avant (x = xMin) : panneau à 10 leviers (14.2). Côté +Z bas : 5 leviers de déplacement (14.5).
   * Côté +Z haut : boîte chargeur et télécommande (14.7). Côté -Z : panneau 24 V (ensemble 15 du 1er niveau). */
  pedestal: { xMin: -1.47, xMax: -0.76, coreHalfWidth: 0.45, baseY: 0.658, topY: 1.40 },
  chargerBox: { x: [-1.30, -0.85], y: [0.80, 1.30], z: [0.515, 0.735] },
  driveLevers: { x: [-1.25, -0.88], y: 0.76, plateZ: 0.75, knobZ: 0.95 },
  beacon: { pos: [-1.31, 1.40, -0.40] },

  /* Panneau 24 V (279182) sur le flanc -Z du socle, porte et écran vers -Z. Boîte : z de -0.735 à -0.515. */
  panel24: { cx: -1.078, cy: 1.075, w: 0.51, h: 0.62, d: 0.22, faceZ: -0.735 },

  /* Grue inférieure (276919). */
  slew: { x: -1.20, z: 0, topY: 1.47, ringOD: 0.46 },     // couronne d'orientation (277524)
  hoistBase: { pivot: [-1.18, 1.74, 0] },                   // axe de levage J2 (277068)
  liftCylinder: { base: [-1.115, 1.62], rod: [-0.661, 1.74], zHalf: 0.15 }, // 2 x 278117
  boom: {
    // flèche dans la pose de la p. 79 : presque horizontale vers +X
    outerFrom: [-1.36, 1.86], outerTo: [-0.05, 1.86],     // flèche extérieure (276527)
    innerTo: [0.20, 1.80],                                 // bout de la flèche intérieure (276502)
    // INTERFACE flèche / pince : centre de la face de la patte de bout de flèche (278122).
    // Recalé à x = -0,02 par superposition de la pince sur la p. 79 (axe du poignet à x ≈ 0,19).
    tip: [-0.02, 1.83, 0],
    outerSection: [0.20, 0.24],                            // largeur Z x hauteur Y (estimation)
    innerSection: [0.15, 0.18],
  },
  /* Pince V2.0 (277179) : actionneur de poignet au bout de flèche, pince pendante. */
  // La plaque de poignet à 30° (276360) se boulonne sur la patte de bout de flèche (L.boom.tip).
  gripper: { mountAt: [-0.02, 1.83, 0], wristAxis: [0.19, 1.70, 0], rotateY: 1.40, jawTipY: 0.91, cx: 0.27 },

  /* Articles livrés à part (dessin p. 7 du manuel de pièces : repères 7, 11, 12, 14, 17 dessinés hors machine).
   * Zone au sol devant le flanc +Z. Chaque module y pose ses articles sans chevauchement :
   * électrique : x de -0.20 à 0.55 ; accessoires : x de 0.60 à 1.45. */
  kitZone: { x: [-0.20, 1.45], z: [1.05, 1.75], y: 0 },

  /* Accessoires au sol. */
  remoteStation: { pos: [-2.25, 0, 1.45] },   // trépied (279200) + télécommande (278245)
  tether: { from: [-1.50, 0.45, 0.20], coil: [-2.9, 0, -0.6] }, // ombilical 10 m (278232)
};

/* Facteur d'éclatement : déplacement des ensembles de 1er niveau à 100 %. */
export const EXPLODE = {
  frame: [0, -0.15, 0],
  carriage: [0, -0.55, 0],
  tub: [0.35, 0.95, 0],
  pedestal: [-0.55, 0.05, 0],
  lowerCrane: [-0.35, 0.85, 0],
  gripper: [0.95, 0.9, 0],
  panel24: [0, 0.1, -0.75],
  remote: [-0.45, 0.25, 0.45],
};
