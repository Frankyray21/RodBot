# Réplique RodBot V16 : sources et vérifications

24 septembre 2026 · Application 1.103.0

La V16 réunit les retouches Blender des versions V12 à V16. Elle conserve les dimensions nominales et les interactions de la version publiée 1.102.0.

## Retouches locales

- Télécommande : flèches moulées autour du bouton STOP, d’après le manuel p. 21.
- Mât : retour du porte-câbles et ouverture arrière du capot, d’après le scan et la vidéo.
- Pied du mât : couronne noire, bride rouge, joues, axes, raidisseurs et raccords, d’après les photos 58547 et 58548.
- Vérin : attache basse repositionnée avec sa chape. Les animations ont été recalculées pour cette position.
- Zone de la photo 58551 : arceau latéral, perforations du panier blanc, étiquettes des cinq leviers et patte du coffret, d’après la vidéo vers 08:20.

Les axes principaux et le recalage global sont conservés. Seule l’attache basse du vérin et les contrôles hydrauliques associés suivent la correction locale du pied.

## Vérifications de l’export

Le GLB final comprend 53 contrôles, 36 animations et 41 repères cliquables recalculés sur la géométrie compressée. Les vues de détail restent accessibles. La porte du panneau, les commandes de formation et le zoom de précision sont conservés.

Le modèle compressé a été réimporté dans Blender. Les rendus de contrôle couvrent l’ensemble, le profil, la télécommande, le vérin et le coffret ouvert.

## Précision des références

Le [relevé précédent des cotes et interprétations](audit-fidelite-v11.md) reste applicable. Le scan Gaussian Splatting sert à comparer les proportions. Son échelle et les détails reconstruits sur images restent estimés.

Les épaisseurs de petites tôles, soudures, visserie et raccordements masqués ne sont pas entièrement mesurés. Les flexibles suivent leur articulation sans simulation élastique complète. Cette réplique visuelle ne constitue pas un plan de fabrication ni une validation du fonctionnement réel.
