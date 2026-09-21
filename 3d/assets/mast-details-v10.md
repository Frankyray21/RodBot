# Mât du RodBot, détails V10

Référence : huit photos du propriétaire reçues le 21 septembre 2026.
Elles montrent les renforts du vérin, raccords coudés, boucles de boyaux,
capteur près du pivot, filetages, soudures et fixations à la base.

Cette passe ajoute ces éléments au modèle V9. La section carrée tournée du
mât, les détails de l'arrière, les surfaces interactives et les 36 animations
sont conservés. Les détails du vérin suivent le corps du vérin, ceux du tube
suivent le bras, et le capteur suit la tourelle.

Les dimensions restent estimées. Les photos ne permettent pas de certifier
les raccordements cachés ni la géométrie complète du côté opposé. Le petit
pictogramme de risque d'écrasement est une reconstruction graphique visuelle.

Pour affiner une prochaine passe

- Vue complète du côté opposé du mât.
- Vue de dessus montrant le porte-câbles et ses attaches.
- Gros plan du bout du mât, de l'articulation et de la pince.
- Largeur du tube carré et une photo avec une règle pour fixer l'échelle.

Reproduction depuis la racine du dépôt

```sh
python scripts/refine-photo-model.py
node scripts/refine-mast-section.cjs
node scripts/refine-rear-details.cjs
node scripts/refine-mast-details.cjs
node --test tests/mast-details.test.cjs tests/photo-model.test.cjs
```

Fichiers nécessaires : `rodbot-v10-mast-details.gltf`,
`rodbot-v10-mast-details.bin`, `rodbot-v9-rear.bin` et
`rodbot-v6-c9499d45.glb`. Les nouveaux détails sont regroupés par matériau
et assemblage pour limiter le nombre d'appels de rendu.
