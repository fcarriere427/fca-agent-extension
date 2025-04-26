// FCA-Agent - Configuration de la clé API fixe 

// Clé API fixe pour l'authentification avec le serveur
// Cette clé doit correspondre exactement à celle configurée dans le fichier .env du serveur
export const API_KEY = 'test pour git';

// Fonction utilitaire pour récupérer la clé API
export function getApiKey() {
  return API_KEY;
}
