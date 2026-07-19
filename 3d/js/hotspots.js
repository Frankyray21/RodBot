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

export const VUES = {
  home:     { yaw: 305, pitch: 16, dist: 5.6, target: [-0.3, -0.9, -0.8] },
  profil:   { yaw: 255, pitch: 16, dist: 5.4, target: [-0.3, -0.9, -0.8] },
  avant:    { yaw: 155, pitch: 16, dist: 5.4, target: [-0.3, -0.9, -0.8] },
  arriere:  { yaw: 205, pitch: 16, dist: 5.4, target: [-0.3, -0.9, -0.8] },
  pince:    { yaw: 300, pitch: 22, dist: 3.4, target: [0.15, 0.15, -0.75] }
};

export const hotspotById = (id) => HOTSPOTS.find(h => h.id === id);
