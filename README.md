# Formation opérateur — RodBot LP

Site de formation interactif à l'exploitation du système robotisé de manutention
de tiges de forage **Borterra RodBot LP**, bâti à partir du manuel de l'opérateur
**OM 10667 · R0** (référence BM260024).

Ce dépôt est la version **code** d'un design créé dans Claude Design. Il a été
converti en site **100 % statique, sans aucun framework** (HTML / CSS / JavaScript pur).

## Contenu

- **Accueil** — présentation, fiche machine, essentiel sécurité, accès aux documents.
- **8 modules de formation** — leçons dépliables (paragraphes, listes, étapes,
  fiches techniques, avertissements) et **quiz** noté (70 % requis pour valider),
  avec progression sauvegardée dans le navigateur (`localStorage`).
- **3 simulateurs interactifs** :
  - la télécommande radio (pastilles cliquables, arrêt d'urgence) ;
  - le mât articulé J1–J6 (curseurs pilotant un schéma SVG en direct) ;
  - les modes de fonctionnement (voyant ambre, klaxon, valves d'isolement).
- **Attestation** de fin de parcours personnalisable.

## Réplique 3D v1.128.0

La V38 reprend les six retours de boyaux sous le bras. Leur retournement se rapproche de la platine, avec des fonds arrondis. Ils se regroupent plus tôt et suivent un passage inférieur plus régulier. Les parties arrière des trajets, les raccordements et les éléments rigides sont conservés. La chaîne et les proportions générales restent inchangées. Les trajets masqués et le comportement physique sur toute la plage de mouvement restent à confirmer. Les écarts visuels restants sont décrits dans le bilan de fidélité.

La V37 réoriente les parties supérieures des quatre raccords hydrauliques vers l’entrée de chaîne. Les cinq arrivées forment des arches continues et suivent un ordre de voies revu. Leurs sorties rejoignent les mêmes points sur le poignet. Les six retours descendent plus près de la platine, puis retrouvent leur passage sous le bras. La chaîne, les commandes et les proportions générales sont conservées. Les courbures sans cote et les destinations masquées restent estimées. L’assemblage conserve quatre traversées hydrauliques et deux passages auxiliaires ; les huit traversées du manuel ne sont pas toutes reconstruites.

La V36 remet la rangée de la platine et des raccords transversalement, parallèle aux traverses de la chaîne. Elle corrige l’orientation longitudinale des versions précédentes. Les cinq flexibles de flèche restent dans les rails sur leur portion guidée ; leurs sections libres rejoignent la platine et le poignet. Les six retours et la ligne auxiliaire sont raccordés au nouvel assemblage, et le support est remis en appui. La silhouette générale et les commandes sont conservées. Les dimensions non cotées et destinations masquées restent estimées. La portion conserve quatre traversées hydrauliques et deux passages auxiliaires.

La V35 avait arrondi et séparé les six retours. La V36 adapte ces parcours aux ports de la rangée transversale. Les destinations masquées restent des estimations visuelles.

La V34 avait rapproché le support de la bague télescopique et de l’attache avant de chaîne. La V36 corrige son orientation et remet ses appuis et raccordements en cohérence avec la rangée transversale.

La V33 avait tourné la rangée dans la longueur du mât. Cette orientation était erronée ; la V36 la corrige.

La V32 avait détaillé les tôles, leurs coins arrondis et leurs fixations. Ces pièces suivent le placement V36.

La V31 avait abaissé les six boucles. La V34 reprend leur parcours sous le bras. Les destinations cachées restent estimées.

La V30 avait repris le porte-boyaux. La V34 adapte les arrivées au support près de la bague télescopique.

La V29 ajoute le creux oblong visible sur les flancs des maillons, selon le manuel de pièces p. 50. Le parcours, les dimensions extérieures et les boyaux sont conservés. La profondeur non cotée reste estimée.

La V28 détaille la bride Stauff 277747 selon les pages 51 et 55 du manuel de pièces. Les quatre blocs doubles, deux plaques et deux vis remplacent le bloc simplifié. Les dimensions non cotées et les portions cachées restent estimées.

La V27 applique les cotes du manuel de pièces BM260024_PM10654_R0 aux deux vérins. Les tiges mesurent 38,1mm de diamètre. Les axes mesurent 31,75×76,2mm. Les rondelles de butée et retenues correspondent aux vues éclatées. Les positions non cotées restent estimées. Les proportions générales, boyaux et commandes sont conservés.

La V26 ajoute le vérin latéral gauche et corrige les attaches des deux vérins. Chaque vérin porte deux retours de boyaux lisses. Les proportions générales et les interactions de formation sont conservées. Les petites dimensions et les extrémités cachées restent estimées.

La V25 affine le côté gauche du mât : logo MEDATECH, capuchon rouge aplati, raccords satinés et porte-câbles détaillé. Les proportions, articulations et interactions sont conservées. Les petits reliefs et épaisseurs restent estimés.

Le coffret utilise une petite icône de porte ancrée au modèle. Son libellé apparaît au survol ou au focus clavier. La cible tactile reste large. Un clic ouvre ou ferme la porte. L’icône et son libellé suivent aussi les commandes de l’exercice.

La V24 arrondit les contours des mâchoires et détaille leurs fixations extérieures. Les rondelles sont remises en appui. Les pointes, portées, pivots et interactions restent conservés. L’assemblage central à lumière reste à reconstruire.

La V23 remet le gyrophare et le tube violet en appui. Elle corrige la tête noire, les deux boyaux du rotateur et des détails de commande. Les proportions générales et les interactions sont conservées. Les limites restantes sont documentées.

La V22 détaille le faisceau au pied du mât depuis la photo réelle : platine, longs sertissages, coudes, unions et connecteur à repères jaunes. Six retours suivent les articulations existantes. Les entrées cachées restent estimées.

La V21 corrige la protection tubulaire côté IHM. Le montant est droit, avec deux petits coudes et des retours transversaux. La vidéo réelle fournit la référence visible ; les raccordements masqués restent estimés.

La [réplique détaillée](3d/replique.html) accompagne l'atelier guidé de la [page 3D](3d/). Elle comprend la télécommande, le trépied, le logo Machines Roger et les détails mécaniques affinés avec la vidéo. Les vues rapprochées, la présentation à 360° et les six réglages d'articulation sont disponibles en français et en anglais.

Le modèle, le moteur d'affichage et les décodeurs sont servis depuis ce dépôt. Aucun compte ChatGPT n'est requis. Le fichier 3D est chargé uniquement lors de l'ouverture de cette page. Les quiz, les fiches du scan et les attestations conservent leur fonctionnement.

La V20 affine les protections, manchons et brides des boyaux. Les boyaux suivent les articulations existantes. Les raccordements masqués et leur déformation restent des approximations visuelles.

[Application de formation](https://frankyray21.github.io/RodBot/) · [Réplique interactive](https://frankyray21.github.io/RodBot/3d/replique.html) · [Modèle GLB](3d/assets/rodbot-v38-b054412f.glb) · [Sources et limites](3d/assets/audit-fidelite-v38.md)

## Lancer en local

Aucune dépendance, aucune étape de build. Ouvrez simplement `index.html` dans un
navigateur, ou servez le dossier :

```bash
python3 -m http.server 8000
# puis http://localhost:8000
```

## Architecture

| Fichier       | Rôle                                                                 |
|---------------|----------------------------------------------------------------------|
| `index.html`  | Coquille de page + gabarit déclaratif d'origine (dans un `<script type="text/html">`). |
| `styles.css`  | Styles de base et polices.                                           |
| `interface.css` | Accueil, navigation mobile, recherche et contrôles accessibles. |
| `interface.js` | Recherche locale dans les titres et pages, gestion du focus et des modales. |
| `app.js`      | Petit moteur de rendu (~150 lignes) qui interprète le gabarit (`{{ }}`, `<sc-if>`, `<sc-for>`, `onClick`, `onInput`, `style-hover`) **+** la logique applicative (données des 8 modules, quiz, simulateurs). |

Le moteur fait un rendu complet à chaque action (clic) et une mise à jour « douce »
en place pendant la saisie continue (curseurs), pour un glissement fluide.

## Exploration 3D v1.61.1

- Scan réel conservé, cadrage adapté au téléphone et rendu détaillé ou fluide.
- Zoom progressif, rotation avec inertie et déplacements de caméra adoucis.
- Visite des composants et arrêts d'urgence avec pause, reprise et navigation.
- Repères corrigés sur les écrans haute densité, plein écran et commandes clavier.
- Animation interrompue pendant la manipulation et respect du mouvement réduit.
- Les animations déplacent la caméra. Le scan ne contient pas de pièces articulées.
- Modules de la visite disponibles hors ligne après installation.
- Photos agrandissables même lorsque le scan ou le moteur 3D ne charge pas.

Validation : `node --test tests/*.test.cjs`.

## Plein écran de l'atelier 3D (1.93.0)

Le bouton ⛶ du visualiseur passe en plein écran natif. Depuis la 1.93.0 le
modèle occupe **toute** la hauteur de l'écran, au lieu de 62 % avec le titre
et la barre de modes au-dessus.

- L'en-tête, le titre, la barre de modes et le pied de page s'effacent.
- Les commandes et les repères restent, posés par-dessus le modèle.
- La visite guidée se superpose en bas ; les commandes se placent au-dessus
  d'elle, quelle que soit sa hauteur (variable `--tour-h`).
- Plus rien ne défile : le modèle est le seul écran.
- Sur un téléphone tenu debout, la rotation en paysage est demandée
  (`screen.orientation.lock`) : la machine est large, elle y paraît deux fois
  plus grande. L'appareil qui refuse garde son orientation, sans erreur.
- On sort par le bouton ⛶ ou par la touche Échap.
- **Le bouton ne dépend plus de l'API du navigateur** (1.94.0). Quand
  `requestFullscreen` manque (iPhone) ou est refusée, la page passe en plein
  écran par la seule mise en page. Le modèle occupe l'écran dans les deux cas ;
  seules les barres du téléphone restent visibles dans ce mode de repli.
- Les hauteurs ont un repli `100vh` avant `100svh`, pour les navigateurs
  d'avant 2022.

## Interface v1.60.0

- Accès direct aux modules, à la pratique, au suivi et aux documents.
- Recherche bilingue dans les titres de leçons et les pages du manuel.
  Les questions et réponses des quiz ne sont pas indexées.
- Navigation entre leçons, clavier et fenêtres accessibles.
- Tour guidé à la demande, sans interruption à la première visite.
- Cache hors ligne isolé des autres sites du même domaine.

Voir la section « Hors ligne » ci-dessous pour ce qui fonctionne sans réseau.

## Hors ligne (version 1.88.0)

Le site est conçu pour la mine, sans réseau :

- Le service worker (`sw.js`) télécharge tout le contenu en arrière-plan à la
  première visite : leçons, images du manuel FR et EN, figures, PDF **et le
  modèle 3D articulé** (environ 122 Mo au total). Depuis la 1.95.0 il n'y a
  plus rien à demander séparément : l'atelier 3D marche sous terre comme le
  reste.
- La carte **« Hors ligne »** (accueil, section Documents) montre l'avancement
  (fichiers prêts / total) et dit **« Prêt pour le terrain »** quand tout est
  sur l'appareil. Bouton « Tout télécharger » pour relancer.
- Le stockage persistant est demandé au navigateur : Android ne purge pas le
  contenu quand la place manque.
- Les polices (Heebo, Barlow) sont dans `fonts/` : aucune ressource externe.
- Les attestations et les avis envoyés sans réseau sont gardés sur l'appareil
  (`rodbot_outbox_v1`) et partent tout seuls au retour du réseau.
- L'attestation PDF est générée sur l'appareil (`pdf.js` maison, sans réseau).

Seuls l'envoi vers Airtable, les suggestions de noms et l'historique de suivi
demandent une connexion.

## Installer l'app sur l'appareil (PWA)

Une bannière rouge et noire s'affiche en haut de l'accueil : **« Installez
l'app sur cet appareil »**, avec le bouton **Installer maintenant**. Elle
déclenche l'invite du navigateur, ou explique la marche à suivre si le
navigateur ne la propose pas.

La bannière disparaît d'elle-même une fois l'app installée (mode plein
écran), dans l'APK Android, et quand l'opérateur la ferme avec le ✕ (son
choix est gardé dans `rodbot_pwa_ferme`).

Rien à télécharger : l'adresse du site est le lien d'installation.

## Application Android (APK)

Le dossier `apk/` contient une enveloppe [Capacitor](https://capacitorjs.com)
qui embarque **tout le site et tout son contenu** (environ 125 Mo) dans une
application Android. Elle fonctionne à 100 % sans réseau dès l'installation.

- **Téléchargement** : à chaque push sur `main`, GitHub Actions
  (`.github/workflows/android-apk.yml`) construit et signe l'APK, puis le
  publie dans la Release `apk-latest`. Lien stable :
  `https://github.com/Frankyray21/RodBot/releases/download/apk-latest/RodBot-LP.apk`
- **Depuis le site** : bouton **« Android ↓ »** dans le menu du haut, ou
  section *Documents* → carte **« App Android (APK) »**.
  Bouton **Télécharger** (lien direct) et bouton **Code QR**, qui ouvre une
  fenêtre expliquant ce qu'est un APK, avec les 4 étapes d'installation et le
  code à scanner avec la tablette. Le code QR (`qr-apk-android.svg`) pointe
  vers le lien stable et reste lisible hors ligne. Pour le regénérer :
  `pip install segno && python3 apk/scripts/generer-qr.py`.
- **Installation** : ouvrir le fichier sur la tablette, accepter les « sources
  inconnues ». Une nouvelle version s'installe par-dessus l'ancienne, sans
  désinstaller (le `versionCode` suit `APP_VERSION`).
- **Dans l'app** : pas de service worker ni de téléchargement ; les PDF
  s'ouvrent avec le lecteur du téléphone ; l'attestation PDF aussi.
- **Signature** : clé de développement publique dans `apk/android/keystore/`
  (voir son README pour passer à une clé privée via les secrets du dépôt).
- **Construire soi-même** (Android SDK requis) :

```bash
cd apk && npm ci && npm run apk
# -> apk/android/app/build/outputs/apk/release/app-release-signed.apk
```

## Tests locaux

Avec Node.js installé, lancer `node --test tests/*.test.cjs`.
Les tests utilisent des réponses simulées et n'écrivent rien dans le registre des travailleurs.

## Fichiers à ajouter manuellement

Ces fichiers dépassaient la limite de taille de l'export automatique. Le site
fonctionne sans eux (images remplacées par un cadre, liens PDF inactifs), mais
pour un rendu complet, déposez-les depuis votre projet Claude Design :

- `img/p21-0.png` et `img/p13-0.png` — voir [`img/README.md`](img/README.md).
- `manuel-operateur.pdf` — le manuel de l'opérateur (lié depuis toutes les leçons).
- `evaluation-risques.pdf` — l'évaluation des risques.

## Déploiement (GitHub Pages)

Le site est du HTML statique servi directement depuis la branche. Dans
**Settings → Pages** :

1. **Source** : « Deploy from a branch ».
2. **Branch** : `main`, dossier `/ (root)`. La branche par défaut historique n'est pas la branche publiée.
3. **Save**.

Le fichier `.nojekyll` garantit que GitHub sert les fichiers tels quels (sans
traitement Jekyll). Le site apparaît ensuite sur `https://<utilisateur>.github.io/RodBot/`.

Le site étant entièrement statique, il peut aussi être déposé tel quel sur Netlify,
Vercel, Cloudflare Pages, etc.
