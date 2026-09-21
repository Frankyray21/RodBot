# Correction depuis la capture du 21 septembre 2026

La V7 reprend les géométries V6 et ses 36 animations. Elle est utilisée par
l'accueil, l'atelier de formation et la page de réplique.

- Tourelle réorientée de 12° vers le côté du coffret gris visible sur la capture.
- Bras relevé de 6° supplémentaires. Ces deux angles sont estimés visuellement,
  pas mesurés sur la machine.
- Pince compensée de -6° pour rester orientée vers le bas dans la pose initiale.
- Orientation et longueur apparente du vérin recalculées sur chaque image clé
  du mouvement de levée. Les deux ancrages restent raccordés.
- Sept ensembles de tiges à 1 828,8 mm, fûts ramenés de 140 à 127 mm,
  selon le manuel p.8. Les couches sont repositionnées pour conserver l'appui.
- Coffrets gris plus froids ; tiges en acier plus clair et plus réfléchissant.

Le bras se lève depuis la tourelle vers le panier, légèrement déporté sur le côté.
La capture sert au réglage de la pose. Elle ne permet pas de
certifier les angles, les pièces cachées ni toutes les proportions.

## Reconstruction

Exécuter `python scripts/refine-photo-model.py` depuis le dépôt.
Le fichier `rodbot-v7-photo.gltf` référence le binaire immuable
`rodbot-v6-c9499d45.glb` et contient les nouvelles données d'animation.
Les deux fichiers doivent être distribués ensemble, y compris hors ligne.
Les surfaces Draco, les indices des repères et les textures sont conservés.
Le diamètre des colliers, les dégagements mécaniques et la longueur globale
de la machine restent à confirmer sur des vues supplémentaires.
