/* ============================================================
   Hotspots et vues caméra — LP RodBot, Machines Roger Intl
   Scène : scan du RodBot (manipulateur de tiges robotisé),
   y vers le haut après rotation Z 180°, plancher ≈ y -2.65.
   Positions triangulées par rayons (screenToWorld, 2 vues)
   puis vérifiées visuellement par sondes colorées.
   ============================================================ */

export const HOTSPOTS = [
  {
    id: 'bras', num: 1,
    label: 'Mât (bras robotisé)',
    pos: [-0.21, 0.88, -0.12],
    view: { yaw: 300, pitch: 22, dist: 3.4, target: [-0.1, 0.5, -0.2] }
  },
  {
    id: 'pince', num: 2,
    label: 'Grappin (pince)',
    pos: [0.18, 0.31, 1.14],
    view: { yaw: 335, pitch: 18, dist: 2.8, target: [0.18, 0.31, 1.14] }
  },
  {
    id: 'panier', num: 3,
    label: 'Bac à tiges',
    pos: [-0.44, -0.72, 1.45],
    view: { yaw: 290, pitch: 32, dist: 3.2, target: [-0.44, -0.9, 1.3] }
  },
  {
    id: 'chenille', num: 4,
    label: 'Chenilles',
    pos: [-1.6, -1.4, 0.6],
    view: { yaw: 255, pitch: 8, dist: 3.6, target: [-1.2, -1.5, 0.4] }
  },
  {
    id: 'stab', num: 5,
    label: 'Vérins de stabilisation',
    pos: [-0.86, -1.4, 2.32],
    view: { yaw: 290, pitch: 14, dist: 2.6, target: [-0.86, -1.5, 2.2] }
  },
  {
    id: 'boyaux', num: 6,
    label: 'Ombilicaux',
    pos: [-1.3, -2.05, -1.6],
    view: { yaw: 280, pitch: 38, dist: 2.8, target: [-1.2, -2.1, -1.5] }
  },
  {
    id: 'elec', num: 7,
    label: 'Panneau électrique 24 V',
    pos: [-0.74, -0.29, -0.42],
    view: { yaw: 285, pitch: 12, dist: 2.4, target: [-0.74, -0.35, -0.45] }
  },
  {
    id: 'remote', num: 8,
    label: 'Télécommande radio',
    pos: [-0.08, -0.4, -3.04],
    view: { yaw: 330, pitch: 12, dist: 2.6, target: [-0.08, -0.6, -3.0] }
  }
];

/* Les quatre arrêts d'urgence (manuel §2.4, p. 12) — pastilles « danger »
   Positions calées sur le scan (champignon orange sous l'IHM, manette radio,
   bouton du coin avant-droit du châssis, champignon jaune du poste manuel). */
export const URGENCES = [
  {
    id: 'u1', num: 'U', classe: 'hs-urgence', encercle: true,
    label: 'Arrêt d\'urgence : panneau',
    pos: [-0.85, -0.88, -0.72], normal: [1, 0, 0],
    view: { yaw: 98, pitch: 8, dist: 1.8, target: [-0.85, -0.8, -0.5] }
  },
  {
    id: 'u2', num: 'U', classe: 'hs-urgence', encercle: true,
    label: 'Arrêt d\'urgence : télécommande',
    pos: [-0.10, -0.51, -2.99], normal: [0.05, 0.18, -0.98],
    view: { yaw: 165, pitch: 14, dist: 1.35, target: [-0.09, -0.46, -2.98] }
  },
  {
    id: 'u3', num: 'U', classe: 'hs-urgence', encercle: true,
    label: 'Arrêt d\'urgence : châssis',
    pos: [-0.48, -1.05, 2.19], normal: [-0.81, 0, 0.58],
    view: { yaw: 306, pitch: 9, dist: 1.8, target: [-0.5, -1.15, 1.7] }
  },
  {
    id: 'u4', num: 'U', classe: 'hs-urgence', encercle: true,
    label: 'Arrêt d\'urgence : leviers du mât',
    pos: [-0.21, -0.70, -1.06], normal: [0, 0, -1],
    view: { yaw: 186, pitch: 6, dist: 1.6, target: [-0.16, -0.62, -1.02] }
  }
];

export const VUES = {
  home:     { yaw: 305, pitch: 16, dist: 5.6, target: [-0.3, -0.9, -0.8] },
  profil:   { yaw: 255, pitch: 16, dist: 5.4, target: [-0.3, -0.9, -0.8] },
  avant:    { yaw: 155, pitch: 16, dist: 5.4, target: [-0.3, -0.9, -0.8] },
  arriere:  { yaw: 205, pitch: 16, dist: 5.4, target: [-0.3, -0.9, -0.8] },
  pince:    { yaw: 300, pitch: 22, dist: 3.4, target: [0.15, 0.15, -0.75] }
};

export const hotspotById = (id) => HOTSPOTS.find(h => h.id === id) || URGENCES.find(h => h.id === id);
