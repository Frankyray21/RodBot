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

## Réplique 3D v1.69.0

La [réplique détaillée](3d/replique.html) complète le scan photographique existant. Elle comprend la télécommande, le trépied, le logo Machines Roger et les détails mécaniques affinés avec la vidéo. Les vues rapprochées, la présentation à 360° et les six réglages d'articulation sont disponibles en français et en anglais.

Le modèle, le moteur d'affichage et les décodeurs sont servis depuis ce dépôt. Aucun compte ChatGPT n'est requis. Le fichier 3D est chargé uniquement lors de l'ouverture de cette page. Les quiz, les fiches du scan et les attestations conservent leur fonctionnement.

[Application de formation](https://frankyray21.github.io/RodBot/) · [Réplique interactive](https://frankyray21.github.io/RodBot/3d/replique.html) · [Modèle GLB](3d/assets/rodbot-v5.glb) · [Sources et limites](3d/assets/RODBOT-V5.md)

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

## Interface v1.60.0

- Accès direct aux modules, à la pratique, au suivi et aux documents.
- Recherche bilingue dans les titres de leçons et les pages du manuel.
  Les questions et réponses des quiz ne sont pas indexées.
- Navigation entre leçons, clavier et fenêtres accessibles.
- Tour guidé à la demande, sans interruption à la première visite.
- Cache hors ligne isolé des autres sites du même domaine.

Les images et PDF doivent être consultés en ligne avant utilisation hors ligne.
L'envoi des résultats et leur récupération nécessitent une connexion.
Les procédures, les questions et le seuil de réussite sont conservés.

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
