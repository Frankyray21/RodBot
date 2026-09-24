# Audit de fidélité du RodBot — modèle V11

21 septembre 2026

Le modèle V11 reprend les améliorations présentes dans la version **1.100** : section carrée du bras, baie arrière ouverte, distributeurs, connecteurs, supports du vérin et détails du mât. La publication **1.102.0** conserve également les corrections arrivées dans la **1.101.0** : paire de boyaux du vérin et zoom de précision. Ces éléments sont réunis dans une source Blender modifiable. Les corrections portent sur les proportions, les assemblages et l’aspect des surfaces.

L’audit croise les cinq photos initiales, la vidéo de dix minutes, les gros plans supplémentaires, le manuel opérateur et l’ancien scan Gaussian Splatting. Le scan a été redressé et mis à l’échelle à partir des fourreaux et de la longueur nominale de la machine. Son incertitude pratique est estimée à **±3 %** ; les différences de pose du bras et de hauteur sur stabilisateurs sont prises en compte. Il sert de référence de proportions, sans constituer un relevé métrologique.

**Cotes documentées et interprétations.** Les valeurs suivantes proviennent du manuel ; leur application au modèle reste distincte des dimensions estimées sur les images.

| Élément | Valeur retenue | Statut |
|---|---:|---|
| Largeur d’une bande de chenille | 12 po — 304,8 mm | Cote documentée |
| Course des stabilisateurs | 10,5 po — 266,7 mm | Course conservée dans l’animation |
| Garde au sol sous les traverses porteuses | 10 po — 254 mm | Référence documentée |
| Passage des fourches du panier | 7,5 × 2,5 po — 190,5 × 63,5 mm | Ouvertures traversantes vérifiées |
| Entraxe des fourreaux | 36 po — 914,4 mm | Référence du dessin p. 79 |
| Tiges nominales | Ø 5 po × 6 pi — Ø 127 × 1 828,8 mm | Format nominal adopté ; toutes les tiges filmées ne sont pas identifiables avec certitude |

Les **71 po** des chenilles sont interprétés comme une portion droite ou un entraxe, et non comme leur enveloppe complète : le dessin et le scan convergent vers **2,23 à 2,34 m hors tout**. L’enveloppe du modèle, proche de **2,263 m**, est conservée. Les **46 po** sont interprétés comme un entraxe des bandes. La posture correspondant à la hauteur minimale de **90 po** reste à confirmer ; cette cote n’est pas imposée au bras levé.

**Proportions corrigées d’après les références.** Le principal écart du V6 était l’empilement trop haut du panier et des coffrets. Les ajustements sont appliqués par ensemble, sans écraser globalement la machine.

| Comparaison | Ancien V6 | Cible V11 estimée |
|---|---:|---:|
| Hauteur propre du panneau latéral blanc | 675 mm | 500 mm |
| Haut de ce panneau au-dessus du sol des chenilles | 1 664 mm | 1 180 mm |
| Hauteur du coffret IHM | 650 mm | 520 mm |
| Coffret secondaire : largeur × hauteur | 490 × 500 mm | 440 × 320 mm |

Le panier reste blanc peint. Le piédestal et le bras sont abaissés ensemble de 200 mm ; les niveaux du plateau, les supports, les câbles et l’écartement des stabilisateurs sont recalés. Ces déplacements sont des corrections visuelles étayées par le scan, le manuel et la vidéo, pas de nouvelles cotes constructeur.

**Détails mécaniques et hydrauliques.** Les carters de chenilles, réducteurs, vis et bouchons sont repris d’après la photo du manuel p. 78 et la vidéo. La pince reçoit des traverses visuellement plus pleines et les parties noires observées. Les joues percées et raidisseurs relient désormais visiblement l’attache haute du vérin au bras. Coudes, sertissages, boucles, colliers, distributeurs et presse-étoupes suivent leur ensemble mécanique. Les axes du vérin ont été vérifiés pendant l’animation : leur écart numérique reste inférieur à 0,01 mm dans le modèle. Cela vérifie la continuité de l’animation, sans valider la résistance d’un assemblage réel.

Les boulons et optiques superposés ont été remplacés. De petits vides entre presse-étoupes et coffret, ainsi qu’entre réflecteurs et boîtiers, sont fermés. Les matières distinguent peinture, caoutchouc, polymère, acier usiné et raccords zingués ; les logos et marquages existants sont préservés.

Les quatre flexibles d’alimentation avant rejoignent leurs sertissages après le recalage. La gaine au sol partage une extrémité et une tangente continues avec le faisceau. Les pieds des deux garde-corps sont remis en contact avec les supports rouges existants. Les petits flexibles des stabilisateurs continuent derrière les traverses ; leur raccordement caché n’est pas prétendu vérifié.

**Limites.** Les faces masquées, les raccordements internes et certaines terminaisons de flexibles restent partiellement inconnus. Les petites dimensions de visserie, les soudures, l’usure et une partie du cheminement des câbles sont estimés. Les flexibles accompagnent leurs articulations sans simulation élastique complète. Le modèle est une reconstruction visuelle destinée à la formation : il ne garantit ni une fidélité de 100 %, ni une certification, ni l’exactitude d’un plan de fabrication ou d’un schéma hydraulique.
