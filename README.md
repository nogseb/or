# Vendre mon or à Toulouse

Page d'aide à la décision publiée sous **https://nogues.app/or/** : quand vendre des bijoux en or (analyse du cours dans le temps) et où les vendre à Toulouse (comparatif des comptoirs de rachat au poids).

## Contenu

| Section | Ce qu'elle contient |
| --- | --- |
| En bref | Synthèse et recommandation (vente en deux tranches) |
| Quand vendre | Graphique 10 ans et 13 mois, lecture de tendance, prévisions publiées, stratégies, seuils de décision réglables, estimation des bijoux, leviers de prix |
| Où vendre | Barème d'une bonne offre, repères de prix publiés, comparatif des comptoirs toulousains, parcours conseillé, script d'appel, comparateur de devis, check-list, fiscalité et obligations légales |
| Sources | 31 références datées |

Les saisies (bijoux, seuils, devis, check-list) restent dans le navigateur du visiteur (`localStorage`). La page est marquée `noindex`.

Le décor animé est purement vectoriel (SVG et CSS, environ 6 Ko) ; il se fige si l'appareil demande de réduire les animations.

## Arborescence

```
site/                 fichiers publiés
  index.html
  assets/style.css
  assets/app.js       calculs, graphique SVG, outils (sans dépendance)
  assets/decor.js     décor animé : courbe du cours et anneaux (bandeau), guillochés et paillettes (fond)
  data/cours.json     cours de référence, remplacé à chaque publication
scripts/build.py      copie site/ vers dist/ et relève le cours du jour
.github/workflows/deploy.yml
```

## Publication

Le workflow **Publier le site or** génère `dist/` puis l'envoie en SFTP vers `www/or` sur l'hébergement OVHcloud de nogues.app.

- Déclencheurs : push sur `main`, lancement manuel (onglet Actions), et deux fois par jour ouvré pour rafraîchir le cours.
- Secrets du dépôt : `OVH_SFTP_HOST`, `OVH_SFTP_USER`, `OVH_SFTP_PASSWORD`.
- Variable facultative : `OVH_TARGET_DIR` (par défaut `www/or`).
- Sans secrets, le site est généré mais rien n'est envoyé. Rien n'est supprimé sur le serveur.

Cours du jour : once d'or en dollars ([gold-api.com](https://gold-api.com)) convertie au taux de référence BCE ([Frankfurter](https://frankfurter.dev)). Si une source ne répond pas, le cours de référence de `site/data/cours.json` est conservé.

GitHub suspend les tâches planifiées d'un dépôt resté 60 jours sans activité : un push ou un lancement manuel les réactive.

## Mise à jour des données

Les historiques (moyennes annuelles et mensuelles), le record et les repères de prix sont en tête de `site/assets/app.js`. Les textes et le comparatif des enseignes sont dans `site/index.html`.

Test local : `python3 scripts/build.py` puis `python3 -m http.server -d dist 8000`.
