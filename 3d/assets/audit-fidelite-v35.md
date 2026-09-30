# V35 : six retours hydrauliques sous le bras

La V35 corrige les deux écarts identifiés sur les photos et la vidéo : le faisceau trop extérieur devant le vérin et les retournements trop serrés sous les raccords. Seuls les six retours inférieurs V22 changent. Les 2 742 autres objets existants, les raccords visibles, le support près de la bague télescopique et les proportions sont conservés.

## Références et changements

La vidéo originale `20260717_133540 (1).mp4` a été examinée notamment à 05:32, 06:05, 06:11, 09:25 et 09:30. Les photos 58739, 58727, 58721 et 58719 complètent ces vues. La séquence 05:32 montre les courbes sous les sertissages ; 06:05 et 09:30 montrent le passage intérieur derrière le corps noir du vérin.

Les six parcours se rapprochent progressivement du centre du bras, derrière le vérin gauche. Les retours sous la platine sont arrondis et séparés. Les croisements géométriques détectés dans la V34 sont corrigés.

Les départs sur les raccords, les rayons des tuyaux et les six arrivées supérieures ne changent pas. Trois terminaisons cachées, déjà estimées dans la reconstruction, sont remontées de 30 mm pour supprimer leur chevauchement hérité. Elles ne représentent pas des positions de ports mesurées sur la machine réelle.

La répartition de déformation est recalée sur chaque nouveau parcours. Les parties sous le bras suivent son articulation ; les portions près du pied rejoignent progressivement la base. Les 53 contrôles, 36 animations, 41 repères et 14 composants déformables sont conservés.

## Vérifications de la source Blender

143 contrôles indépendants passent sur la source finale. Les extrémités sont mesurées sur les faces terminales du maillage évalué. Les six parcours complets sont examinés, sans exemption de leurs extrémités cachées.

- Séparation minimale entre retours : environ 2,43 mm dans le modèle.
- Dégagement minimal aux obstacles rigides examinés : environ 1,37 mm.
- Rayons locaux des courbes : environ 37,6 à 81,1 mm aux minima mesurés, contre environ 10 mm dans la V34.
- Élévations relatives de 0°, 15° et 30° : pas de recouvrement détecté dans les contrôles effectués et départs maintenus sur les raccords.

Ces valeurs décrivent le maillage, pas les cotes réelles de l’équipement. La vérification porte sur les retours, les boyaux voisins du vérin gauche et les obstacles sélectionnés : tube du bras, vérins, bagues, fourches, goussets et chapes. Elle n’est pas une simulation physique complète de tous les contacts possibles.

Source : `Equipement_RodBot_V35.blend`.
SHA-256 : `7b08bd8da744a10b241697a0563c20f9a4f98a56fcef7ce314d90a65db05d808`.

## Vérification du fichier web

Le GLB final est réimporté et rendu depuis sa géométrie compressée. L’écart maximal de position source/compression mesuré est de 0,0164 mm. La réévaluation des poids de déformation par le format web entraîne un écart maximal mesuré de 0,190 mm à 15° et 0,370 mm à 30°. Les poids des anneaux terminaux restent identiques. En tenant compte de ces écarts, les bornes de séparation contrôlées restent positives.

GLB : `rodbot-v35-ca2825d8.glb`, 45 640 500 octets. SHA-256 : `ca2825d84889961b5ffc355f1c26dbb9304433df17f0c3ac2bee28a259e061fb`.

## Limites

Les caméras et postures des références diffèrent. Les parcours occultés, les longueurs réelles et les rayons minimaux prescrits par le fabricant ne sont pas connus. La souplesse est une déformation visuelle ; elle ne modélise pas la pression ou le comportement physique du caoutchouc.

L’ensemble de raccordement reste partiel : les quatre traversées hydrauliques et deux passages auxiliaires déjà modélisés sont conservés. La V35 améliore les six retours existants ; elle ne certifie ni une réplique à 100 %, ni un circuit destiné à la fabrication. Les exercices et fonctionnalités du coffret sont conservés.
