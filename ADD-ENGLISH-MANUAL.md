# Où ajouter le manuel anglais / Where to add the English manual

## 🇫🇷 Le plus simple
1. Dépose le **PDF anglais** à la racine du dépôt, nommé :
   ```
   manual-en.pdf
   ```
2. Dis-le-moi (ou relance l'agent). Je génère automatiquement, à partir de ce PDF :
   - les pages du visionneur → `img/manual-en/p01.jpg … p87.jpg`
   - les figures des leçons → `img/fig-en/pNN.jpg`
   et je bascule le lien « MANUAL ↗ » sur le PDF anglais (`MANUAL_EN` dans `app.js`).

En attendant, la version anglaise du site fonctionne : le visionneur affiche
la planche **française** correspondante (repli automatique), donc aucun lien mort.

## Emplacements exacts dans git
| Élément | Chemin dans le dépôt |
|---|---|
| PDF anglais complet | `manual-en.pdf` (racine) |
| Pages du visionneur (EN) | `img/manual-en/p01.jpg` … `p87.jpg` |
| Figures des leçons (EN) | `img/fig-en/pNN.jpg` |

## 🇬🇧 In short
Drop the English PDF at the repo root as **`manual-en.pdf`**. Everything else
(page images, lesson figures, PDF link) is generated/wired from it. Until then,
the English site falls back to the French plates automatically.
