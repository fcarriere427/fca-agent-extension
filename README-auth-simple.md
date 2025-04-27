# Simplification du système d'authentification - Extension FCA-Agent

## Présentation

Ce document explique la simplification du système d'authentification de l'extension FCA-Agent. La version actuelle était inutilement complexe pour un système utilisant simplement une clé API fixe.

## Changements effectués

### 1. Fichiers créés
- `utils/auth-simple.js` : Gestion centralisée de l'authentification par clé API
- `utils/api-simple.js` : Client API simplifié utilisant la nouvelle authentification
- `background/auth-headers-simple.js` : Générateur d'en-têtes simplifié
- `background-simple.js` : Version simplifiée du background script

### 2. Avantages des changements
- Réduction du code (de plus de 600 lignes à environ 250 lignes)
- Élimination du code inutilisé "maintenu par compatibilité"
- Simplification de l'initialisation et des vérifications
- Centralisation de la clé API dans un seul fichier

## Migration

Pour adopter cette version simplifiée, vous pouvez suivre ces étapes :

1. Renommez vos fichiers actuels pour sauvegarder :
   ```
   background.js → background.js.old
   utils/auth.js → utils/auth.js.old
   utils/api.js → utils/api.js.old
   ```

2. Renommez les nouveaux fichiers :
   ```
   background-simple.js → background.js
   utils/auth-simple.js → utils/auth.js
   utils/api-simple.js → utils/api.js
   background/auth-headers-simple.js → background/auth-headers.js
   ```

3. Mettez à jour les imports dans vos autres fichiers si nécessaire.

4. Supprimez les fichiers obsolètes :
   ```
   background/api-key.js
   background/auth-api.js
   background/auth-storage.js
   background/auth.js
   ```

## Configuration requise

Le nouveau système utilise une clé API codée en dur dans `utils/auth-simple.js`. Cette clé doit correspondre exactement à la variable d'environnement `API_KEY` configurée dans le fichier `.env` du serveur.

## Sécurité

Pour une meilleure sécurité, un stockage plus sécurisé de la clé API peut être implémenté dans une prochaine étape avec chrome.storage.local. Le stockage actuel en code source est maintenu pour simplifier cette première phase de refactoring.

## Comparaison avec l'ancien système

| Aspect | Ancien système | Nouveau système |
|--------|---------------|----------------|
| Fichiers dédiés | 7+ | 4 |
| Lignes de code | 600+ | ~250 |
| Fonctionnalités | Nombreuses inutilisées | Uniquement l'essentiel |
| Maintenance | Complexe | Simple et centralisée |
