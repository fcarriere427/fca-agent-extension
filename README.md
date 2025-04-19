# Extension FCA-Agent

Cette extension Chrome/Edge permet d'interagir avec les applications web professionnelles et de communiquer avec le serveur FCA-Agent.

## Structure

- `manifest.json` - Configuration de l'extension
- `background.js` - Service worker d'arrière-plan
- `content.js` - Script injecté dans les pages web
- `popup/` - Interface utilisateur de l'extension
- `utils/` - Fonctions utilitaires
- `assets/` - Ressources graphiques

## Installation en mode développement

1. Ouvrez Chrome/Edge et accédez à `chrome://extensions` ou `edge://extensions`
2. Activez le "Mode développeur"
3. Cliquez sur "Charger l'extension non empaquetée"
4. Sélectionnez le dossier `extension` de ce projet

## Connexion au serveur

Par défaut, l'extension tente de se connecter au serveur sur `http://localhost:3000`. Pour modifier cette configuration, éditez la variable `API_BASE_URL` dans le fichier `background.js`.

## Fonctionnalités

- Synthèse d'emails
- Résumé des conversations Teams
- Rédaction d'emails
- Analyse de pages web
