# Attestations RodBot → Airtable (déploiement en 5 minutes)

Même mécanique que les sites **Prévention TMS** et **Procédures de forage** :
le site envoie l'attestation à un **Worker Cloudflare** qui l'enregistre dans
Airtable (base **« Formations »**, table **« Attestations RodBot (web) »**,
`tbla1k6GBJMr2afmH`) et la relie automatiquement à l'employé
(« Liste employé (registre formation) »).

## Ce qui est déjà fait
- ✅ Table Airtable **« Attestations RodBot (web) »** créée dans la base Formations
  (Nom, Statut Reçu/À relier/Traité, Employé lié, Formation, Date, Score global,
  Détail modules, Langue, Source, Version app).
- ✅ Code du Worker : `worker/worker.js` (+ `worker/wrangler.toml`).
- ✅ Site câblé : bouton **« Enregistrer mon attestation »**
  + suggestions de noms tirées du registre des employés.
  Endpoint attendu : `https://attestations-rodbot.frankyray-21.workers.dev`
- ✅ **Une attestation PAR MODULE** : offerte sur l'écran de résultat, après
  **chaque quiz réussi** (champ « Module », ex. « 02 · Travailler en sécurité »),
  puis une attestation **« Formation complète (8/8) »** à la toute fin.

## Les 2 étapes manuelles (tableau de bord Cloudflare)
1. **Créer le Worker connecté au dépôt** (comme `attestations-procedures`) :
   Cloudflare → Workers & Pages → Create → **Import a repository** →
   `Frankyray21/RodBot` → Root directory = `worker` → nom : **attestations-rodbot**.
   Chaque push sur la branche le redéploie automatiquement.
   *(Alternative CLI : `cd worker && npx wrangler deploy`.)*
2. **Ajouter le secret** : Worker → Settings → Variables and Secrets →
   `AIRTABLE_TOKEN` = ton jeton Airtable (celui des Workers TMS / procédures
   convient tel quel : il a déjà accès à la base Formations).

## Vérifier
- `https://attestations-rodbot.frankyray-21.workers.dev` → `{"ok":true,...}`
- Compléter la formation sur le site → écrire son nom → « Enregistrer mon
  attestation » → la ligne apparaît dans **Attestations RodBot (web)**
  (Statut « Reçu » si le nom correspond à un employé, sinon « À relier »).

Tant que le Worker n'est pas déployé, le site reste fonctionnel : le bouton
affiche « Service injoignable » et le travailleur peut réessayer plus tard.
