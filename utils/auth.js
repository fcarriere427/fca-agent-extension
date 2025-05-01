// FCA-Agent - Utilitaire d'authentification simplifié avec clé API fixe

// Import de la clé API depuis le fichier de configuration séparé
// Ce fichier de configuration doit être exclu de Git (.gitignore)
import { API_KEY } from '../config/api-key.js';
import { createModuleLogger } from './logger.js';

const logger = createModuleLogger('AUTH');

/**
 * Récupère les en-têtes d'authentification pour les requêtes API
 * @returns {Object} - En-têtes HTTP pour l'authentification
 */
function getAuthHeaders() {
  logger.debug('Génération des en-têtes d\'authentification');
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
  logger.debug('Vérification d\'authentification locale');
  return true; // Avec une clé API fixe, on est toujours authentifié localement
}

/**
 * Vérifie l'authentification côté serveur (connexion au serveur)
 * @param {string} apiBaseUrl - URL de base de l'API
 * @returns {Promise<boolean>} - True si la connexion au serveur fonctionne
 */
async function checkServerAuthentication(apiBaseUrl) {
  try {
    logger.debug(`Vérification de l'authentification serveur: ${apiBaseUrl}/auth/check`);
    
    const response = await fetch(`${apiBaseUrl}/auth/check`, {
      method: 'GET',
      headers: getAuthHeaders()
    });
    
    if (!response.ok) {
      logger.warn(`Erreur lors de la vérification de l'authentification: ${response.status}`);
      return false;
    }
    
    const data = await response.json();
    logger.debug(`Résultat de la vérification d'authentification: ${data.authenticated}`);
    return data.authenticated === true;
  } catch (error) {
    logger.error(`Erreur lors de la vérification de l'authentification: ${error.message}`);
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
