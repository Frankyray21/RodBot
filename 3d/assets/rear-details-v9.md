# Arrière du RodBot, révision V9

Référence : six gros plans fournis par le propriétaire le 21 septembre 2026.
Les photos servent à reconstruire l'aspect visible. Les dimensions et les
raccordements cachés restent estimés, sans prétendre décrire le circuit réel.

Changements

- Dégagement derrière les commandes et sous les coffrets. Les blocs pleins
  deviennent une paroi de fond et un plateau, avec montants et boulonnerie.
- Raccords hexagonaux étagés, collecteur, départs de boyaux et soufflets des leviers.
- Prises sous les coffrets, bague moletée, câbles jaunes et gris, connecteur bleu.
- Faisceaux avec gaines spiralées, repères jaunes et colliers d'identification.
- Réflecteurs, relief des lentilles, vis des feux et deux lampes rondes rouges.
- La section carrée tournée du mât et les 36 animations sont conservées.

Le vocabulaire `FRONT` existant dans le rig est conservé pour compatibilité.
Il désigne ici la face du pupitre que le propriétaire appelle l'arrière.

Reproduction depuis la racine du dépôt

```sh
python scripts/refine-photo-model.py
node scripts/refine-mast-section.cjs
node scripts/refine-rear-details.cjs
node --test tests/rear-details.test.cjs tests/mast-section.test.cjs tests/photo-model.test.cjs
```

Fichiers à conserver ensemble : `rodbot-v9-rear.gltf`, `rodbot-v9-rear.bin`
et `rodbot-v6-c9499d45.glb`. Le GLB V6 reste le tampon binaire immuable des
maillages et textures d'origine. Les ajouts sont regroupés par matériau pour
limiter les appels de rendu. Les indices des surfaces interactives restent intacts.
