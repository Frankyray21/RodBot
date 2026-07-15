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
| `app.js`      | Petit moteur de rendu (~150 lignes) qui interprète le gabarit (`{{ }}`, `<sc-if>`, `<sc-for>`, `onClick`, `onInput`, `style-hover`) **+** la logique applicative (données des 8 modules, quiz, simulateurs). |

Le moteur fait un rendu complet à chaque action (clic) et une mise à jour « douce »
en place pendant la saisie continue (curseurs), pour un glissement fluide.

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
2. **Branch** : `claude/slash-command-iv5yzl`, dossier `/ (root)`.
3. **Save**.

Le fichier `.nojekyll` garantit que GitHub sert les fichiers tels quels (sans
traitement Jekyll). Le site apparaît ensuite sur `https://<utilisateur>.github.io/RodBot/`.

Le site étant entièrement statique, il peut aussi être déposé tel quel sur Netlify,
Vercel, Cloudflare Pages, etc.
