# Simplification du système d'authentification - Extension FCA-Agent

## Présentation

Ce document explique la simplification du système d'authentification de l'extension FCA-Agent. La version actuelle était inutilement complexe pour un système utilisant simplement une clé API fixe.

## Changements effectués

### 1. Fichiers créés
- `config/api-key.js` : Fichier isolé contenant uniquement la clé API (exclu de Git)
- `config/api-key.example.js` : Exemple de configuration de la clé API
- `utils/auth-simple.js` : Gestion centralisée de l'authentification
- `utils/api-simple.js` : Client API simplifié utilisant la nouvelle authentification
- `background/auth-headers-simple.js` : Générateur d'en-têtes simplifié
- `background-simple.js` : Version simplifiée du background script

### 2. Avantages des changements
- Réduction du code (de plus de 600 lignes à environ 250 lignes)
- Élimination du code inutilisé "maintenu par compatibilité"
- Simplification de l'initialisation et des vérifications
- Isolation de la clé API dans un fichier séparé exclu de Git

## Configuration initiale

Avant d'utiliser l'extension, vous devez configurer la clé API:

1. Copiez le fichier `config/api-key.example.js` vers `config/api-key.js`
2. Ouvrez `config/api-key.js` et remplacez la valeur par votre clé API
3. Assurez-vous que cette clé correspond exactement à celle définie dans le fichier `.env` du serveur

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

3. Créez le fichier `config/api-key.js` avec votre clé API.

4. Mettez à jour les imports dans vos autres fichiers si nécessaire.

5. Supprimez les fichiers obsolètes :
   ```
   background/api-key.js
   background/auth-api.js
   background/auth-storage.js
   background/auth.js
   ```

## Sécurité

La clé API est désormais stockée dans un fichier séparé qui est exclu du dépôt Git via `.gitignore`. Cela garantit que la clé n'est pas exposée dans le code source public. Chaque développeur doit configurer manuellement ce fichier sur sa machine de développement.

## Comparaison avec l'ancien système

| Aspect | Ancien système | Nouveau système |
|--------|---------------|----------------|
| Fichiers dédiés | 7+ | 5 |
| Lignes de code | 600+ | ~250 |
| Fonctionnalités | Nombreuses inutilisées | Uniquement l'essentiel |
| Maintenance | Complexe | Simple et centralisée |
| Sécurité de la clé | Codée en dur dans le code | Isolée dans un fichier exclu de Git |
