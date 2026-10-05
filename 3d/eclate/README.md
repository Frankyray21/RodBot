# Vue éclatée 3D du LP RodBot

Page : `3d/eclate.html`, publiée en 1.131.0. Liens depuis l'accueil (section 3D), l'atelier 3D
et la réplique. Elle est dans le cache hors ligne (CORE de `sw.js`).

## Principe

- Modèle **neuf**, construit par code d'après les dessins CAO du manuel de pièces
  PM10654 R0 (MEDATECH Borterra, BM260024). Il ne reprend rien des GLB de `3d/assets/`.
- Niveau 1 : les ensembles de la nomenclature générale (p. 8). Chaque ensemble s'ouvre en
  détail, avec les repères de sa propre nomenclature (sections 4 à 16).
- Seuls les enfants du niveau ouvert s'écartent. Le curseur règle l'écart de 0 à 100 %.
- Chaque nœud porte : section, repère, numéro de pièce, quantité, page du manuel.

## Fichiers

| Fichier | Rôle |
|---|---|
| `kit.js` | Matériaux réalistes, géométries, visserie, hydraulique, fusion par matériau. |
| `layout.js` | Cotes communes et interfaces entre ensembles (sources citées). |
| `bom.js` | 64 nomenclatures extraites du PDF puis vérifiées ligne par ligne. |
| `asm/*.js` | Un module par ensemble (châssis, socle, grue, pince, électrique, accessoires). |
| `main.js` | Visionneuse : éclatement, repères, fiche, FR/EN. |
| `dev.html` | Banc de rendu d'un ensemble (`dev.html?asm=gripper`). |

## Limites connues

- Les formes cachées ou non cotées sont estimées (`approx` dans les métadonnées).
- La pose de la grue suit la vue de côté p. 79 du manuel opérateur.
- Les pages du manuel de pièces ne sont pas versionnées ici (document du fabricant).
  Si des images `manuel/pNNN.jpg` sont ajoutées, le bouton « Voir la page du manuel » apparaît.
- Les boyaux hydrauliques (`asm/hoses.js`) sont dessinés pour référence : tracés estimés.
