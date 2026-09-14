# Clé de signature de développement

`rodbot-dev.keystore` signe l'APK construit par GitHub Actions quand aucun
secret de dépôt n'est défini. Elle est **publique** (dépôt public) : elle sert
seulement à installer et mettre à jour l'app sur ses propres appareils.
Elle ne convient pas au Play Store.

Pour passer à une clé privée : créer les secrets `ANDROID_KEYSTORE_B64`
(fichier .keystore encodé en base64), `ANDROID_KEYSTORE_PASSWORD`,
`ANDROID_KEY_ALIAS` et `ANDROID_KEY_PASSWORD` dans Settings → Secrets → Actions.
Le workflow les utilise automatiquement. Une app signée avec l'ancienne clé
doit être désinstallée une fois avant d'installer la nouvelle.
