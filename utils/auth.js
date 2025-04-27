// FCA-Agent - Utilitaire d'authentification simplifié avec clé API fixe

// Import de la clé API depuis le fichier de configuration séparé
// Ce fichier de configuration doit être exclu de Git (.gitignore)
import { API_KEY } from '../config/api-key.js';

/**
 * Récupère les en-têtes d'authentification pour les requêtes API
 * @returns {Object} - En-têtes HTTP pour l'authentification
 */
function getAuthHeaders() {
  return {
    'Authorization': `Bearer ${API_KEY}`,
    'API-Key': API_KEY
  };
}

/**
 * Vérifie si l'utilisateur est authentifié (avec clé API fixe, toujours vrai)
 * @returns {Promise<boolean>} - Toujours vrai avec une clé API fixe
 */
async function isAuthenticated() {
  return true; // Avec une clé API fixe, on est toujours authentifié localement
}

/**
 * Vérifie l'authentification côté serveur (connexion au serveur)
 * @param {string} apiBaseUrl - URL de base de l'API
 * @returns {Promise<boolean>} - True si la connexion au serveur fonctionne
 */
async function checkServerAuthentication(apiBaseUrl) {
  try {
    const response = await fetch(`${apiBaseUrl}/auth/check`, {
      method: 'GET',
      headers: getAuthHeaders()
    });
    
    if (!response.ok) {
      console.warn('Erreur lors de la vérification de l\'authentification:', response.status);
      return false;
    }
    
    const data = await response.json();
    return data.authenticated === true;
  } catch (error) {
    console.error('Erreur lors de la vérification de l\'authentification:', error);
    return false;
  }
}

// Exporter les fonctions et la clé API pour compatibilité
export {
  API_KEY,
  getAuthHeaders,
  isAuthenticated,
  checkServerAuthentication
};
