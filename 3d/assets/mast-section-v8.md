# Mât à section carrée, V8

Correction fondée sur les quatre captures rapprochées partagées le
21 septembre 2026. Le défaut était la section du mât, pas la pose du bras.

- Tubes extérieur et intérieur à section carrée, tournés de 45° autour de
  leur axe longitudinal. Une arête se trouve en haut.
- Collier de guidage, marquages LP RodBot, patins et fixations alignés sur
  les nouvelles faces.
- Porte-câbles décalé pour dégager l'arête. Ses supports et les cinq
  flexibles associés suivent ce déplacement.
- Pose et animations des articulations rétablies à celles de la V6.
  La correction de tourelle de -12° et de levée de +6° de la V7 était
  une mauvaise interprétation de la demande ; elle est annulée.
- Dimensions des tiges et matériaux des coffrets de la V7 conservés.

Le principe de la section carrée tournée est confirmé par les gros plans.
Les côtés retenus, 370 mm et 280 mm, restent des estimations issues de
la géométrie existante, pas des cotes mesurées sur la machine.

## Fichiers

`rodbot-v8-mast.gltf` contient les corrections de section et référence le
binaire immuable `rodbot-v6-c9499d45.glb`. Les deux doivent rester ensemble.
Les 36 animations, les indices de triangles et les repères interactifs sont
conservés. Les déformations de section restent actives pendant les animations.

Reconstruction sans nouvelle dépendance :

```sh
python scripts/refine-photo-model.py
node scripts/refine-mast-section.cjs
```

Le script utilise le décodeur Draco déjà livré avec le site. Les captures
d'origine ne sont pas publiées dans le dépôt.
