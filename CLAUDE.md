# RodBot LP : formation opérateur (règles du projet)

Site statique GitHub Pages (racine du dépôt), bilingue FR/EN, pour des
travailleurs de terrain (certains peu à l'aise en lecture) sur tablette et
téléphone. Le Worker Cloudflare `attestations-rodbot` (dossier `worker/`,
redéployé à chaque push) relie le site à Airtable (base « Formations »).

## Règles permanentes

- **Toujours** : déployer après chaque changement, partager les trois liens
  (site github.io, dépôt GitHub, artifact), et incrémenter `APP_VERSION`
  (app.js) + `CACHE` (sw.js) + `app.js?v=` (index.html) à CHAQUE changement.
- Répondre à l'utilisateur en français.
- Texte du site : phrases courtes (≈15 mots max), mots simples, **jamais de
  tiret long (— ou –)**, gras + rouge `##...##` pour l'emphase (via `sc-html`),
  pictogrammes ℹ️👉📊🛑⚠️, listes hiérarchisées si trop de points.

## Règles de conception des quiz (QUIZ2 / QUIZ2_EN dans app.js)

1. **Une notion = une seule question par module.** Jamais deux questions qui
   mesurent le même fait ; jamais une option ou une rétroaction (fb) qui donne
   la réponse d'une autre question du même module.
2. But des quiz (critère validé par l'utilisateur) : **évaluer la formation et
   la lecture du manuel, sans être trop technique. Prioriser ce qui améliore
   les opérations et prévient les accidents.**
   - Chaque question met l'opérateur devant la machine : geste, bouton,
     décision, dépannage. Les limites de sécurité chiffrées (charges, pentes)
     sont bonnes, idéalement posées en décision (« franchir ou pas »).
   - Les opérateurs font l'**entretien de base** : les questions d'entretien
     (vérifications quotidiennes, précautions) sont pertinentes.
   - EXCLUS : premiers soins, règles administratives (qui a le droit de...),
     vocabulaire/pictogrammes, nomenclature (numéros de joints, anatomie du
     mât), fonctionnement interne (valves, circuits), trivia de specs.
   - L'équipement est utilisé **sous terre** : aucune question sur
     l'utilisation en surface ou en extérieur (météo, orage, vent).
   - Toute nouvelle question ou remplacement doit être **proposé à
     l'utilisateur pour validation avant** la mise en ligne.
3. Distracteurs = erreurs de terrain crédibles, exactement fausses selon le
   manuel. La bonne réponse jamais repérable à sa forme (pas la plus longue).
4. FR et EN jumelles : mêmes options, même ordre, même index `correct` ;
   le champ `page` reste la page du manuel FR (remappée à l'affichage EN).
5. Chaque question cite la page exacte du manuel FR qui prouve la réponse
   (source de vérité : `manual_fr_text.json` du scratchpad, clés "1".."87").
6. Difficulté : impossible de réussir sans avoir lu le manuel, mais pensé
   pour des opérateurs, pas des ingénieurs. Seuil 70 %, 5 questions/module.

## Pièges connus

- Une session parallèle peut pousser sur la même branche : `git fetch` +
  rebase avant chaque push.
- Les littéraux `QUIZ2`/`QUIZ2_EN`/`ENRICH` sont sur UNE ligne ; des
  surcharges tardives (`ENRICH["0-0"] = {...}`) existent après le littéral
  principal : modifier les surcharges aussi, pas seulement le littéral.
- Le bac à sable ne peut pas joindre workers.dev ni github.io (proxy) : tester
  via Playwright local (`/opt/pw-browsers/chromium`) et vérifier les builds
  Pages via l'API GitHub (sortie volumineuse : parser le fichier sauvegardé).
