# Vérins et fixations selon le manuel de pièces

Modèle V27, application 1.117.0.

Source : **BM260024_PM10654_Parts Manual_R0**, 85 pages, fourni par l'utilisateur. Cette passe porte sur l'ensemble des deux vérins de levage. Les vues éclatées servent à identifier les pièces et leur montage, pas à déduire leurs positions assemblées par simple mesure de l'image.

## Cotes documentées

| Pièce | Référence et page | Donnée du manuel |
| --- | --- | --- |
| Deux vérins de levage | 278117, p.45, repère3 | Tige Ø1½po =38,1mm ; course8½po =215,9mm ; alésage2½po =63,5mm |
| Deux axes inférieurs | 277266, p.48, repère2 | Ø1¼po ×3po =31,75 ×76,2mm |
| Deux axes supérieurs | 277266, p.52, repère2 | Ø1¼po ×3po =31,75 ×76,2mm |
| Rondelles de butée | 277428, p.48/p.52 | Øintérieur31,75mm, Øextérieur50,8mm, épaisseur1,5875mm ; deux par axe |
| Retenues d'axes | p.48 et p.51/p.52 | Patte excentrée retenue par une vis ; vis½-13 aux fixations concernées |

La course et l’alésage sont relevés comme références ; ils ne constituent pas une validation de la course simulée ni du volume intérieur du vérin.

Les tiges chromées étaient trop épaisses dans la V26. Leur diamètre est corrigé. Les guides de tige, les axes, les rondelles et les retenues sont adaptés à ces cotes.

L'alésage de63,5mm désigne le diamètre intérieur du vérin. Il ne donne pas son diamètre extérieur : le corps noir n'est donc pas ramené arbitrairement à cette valeur.

## Ce qui reste estimé

Les quatre centres de fixation, la longueur fermée des vérins, l'épaisseur des joues et les portions cachées ne sont pas cotés dans ces vues. Les positions d'ensemble restent celles de la reconstruction, ajustées auparavant sur le scan et la vidéo. Les détails du montage sont adaptés aux axes documentés, sans déplacer les pivots du modèle.

Le parcours des boyaux, le rack, les proportions générales du mât et les commandes sont conservés. Les joues du pied sont ajustées localement pour recevoir les axes documentés. Leur épaisseur et les transitions de tôle restent estimées. Un collier rigide est déplacé le long du faisceau pour dégager une retenue, sans changer le parcours des boyaux. Le manuel précise les pièces mécaniques mais ne fournit pas tous les cheminements hydrauliques cachés.

## Écarts repérés pour les prochaines pièces

- **Bride Stauff277747, p.55** : quatre blocs doubles, huit passages, deux plaques et deux vis. Le bridage simplifié actuel reste à remplacer.
- **Traversée278120, p.53** : huit raccords JIC traversants à45°, en deux rangées, et quatre passe-fils. La platine actuelle reste incomplète.
- **Porte-câbles279066, p.50** : empreintes oblongues des flancs et fixations terminales à préciser, en conservant le parcours.

Ces éléments ne sont pas présentés comme corrigés par la V27. Les dimensions absentes du manuel restent à confirmer par d'autres vues ou mesures.

## Vérifications réalisées

- Mesures dans Blender : deux tiges, quatre axes et huit rondelles conformes aux cotes nominales indiquées.
- Contacts et alignement des attaches vérifiés sur trois positions du bras.
- Export réimporté et contrôlé visuellement des deux côtés.
- 53 contrôles, 36 animations, 41 repères et 14 composants souples conservés.
- 187 tests réussis. Dans le navigateur : mouvement du bras, ouverture/fermeture du coffret, placement du bouton sur ordinateur et mobile, aucune erreur relevée.

SHA256 du modèle Blender : e0acfed13d2a7ea12128bf9b53ae87865caa52a24fe9b0f2570e53a8b722abdc.

SHA256 du GLB publié : 6a36e65df90a53f03bfc717e78897a6d816f83ff9c4a56920a50aaac6b95c6bd.
