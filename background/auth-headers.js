// FCA-Agent - Générateur d'en-têtes d'authentification avec clé API
// Ce module gère la génération des en-têtes HTTP pour l'authentification

import { getApiKey } from './api-key.js';
import { createLogger } from '../utils/logger.js';

// Création d'une instance de logger spécifique pour ce module
const logger = createLogger('auth-headers');

/**
 * Retourne les en-têtes d'authentification avec la clé API
 * @param {Object} [options] - Options supplémentaires pour la génération des en-têtes
 * @param {boolean} [options.includeBasic=false] - Inclure également l'authentification Basic
 * @returns {Promise<Object>} En-têtes HTTP pour l'authentification
 * @throws {Error} Si la récupération de la clé API échoue
 */
export async function getAuthHeaders(options = {}) {
  try {
    logger.debug('Génération des en-têtes d'authentification');
    
    const apiKey = await getApiKey();
    
    if (!apiKey) {
      logger.warn('Tentative de génération d'en-têtes avec une clé API non définie');
      throw new Error('Clé API non définie');
    }
    
    const headers = { 
      'Authorization': `Bearer ${apiKey}`,
      'API-Key': apiKey, // En-tête supplémentaire spécifique aux API keys
      'X-Request-Time': new Date().toISOString()
    };
    
    // Ajouter l'authentification Basic si demandée
    if (options.includeBasic) {
      const basicAuth = btoa('api:' + apiKey);
      headers['X-Basic-Auth'] = `Basic ${basicAuth}`;
    }
    
    logger.info('En-têtes d'authentification générés avec succès');
    logger.debug('Structure des en-têtes', { headerNames: Object.keys(headers) });
    
    return headers;
  } catch (error) {
    logger.error('Erreur lors de la génération des en-têtes d'authentification', null, error);
    throw new Error(`Impossible de générer les en-têtes: ${error.message}`);
  }
}

/**
 * Vérifie si l'authentification est configurée correctement
 * @returns {Promise<boolean>} Vrai si la clé API est définie et valide
 */
export async function isAuthConfigured() {
  try {
    const apiKey = await getApiKey();
    const isConfigured = !!apiKey && apiKey.length > 0;
    
    logger.debug('Vérification de la configuration d'authentification', { 
      isConfigured,
      keyDefined: !!apiKey
    });
    
    return isConfigured;
  } catch (error) {
    logger.error('Erreur lors de la vérification de la configuration d'authentification', null, error);
    return false;
  }
}

/**
 * Extrait et valide la clé API à partir des en-têtes de requête
 * @param {Object} headers - En-têtes HTTP de la requête
 * @returns {Promise<string|null>} La clé API si elle est présente et valide, null sinon
 */
export async function extractApiKeyFromHeaders(headers) {
  try {
    if (!headers) {
      logger.warn('Tentative d'extraction de clé API à partir d'en-têtes non définis');
      return null;
    }
    
    logger.debug('Extraction de la clé API depuis les en-têtes');
    
    // Essayer d'extraire depuis l'en-tête Authorization
    let apiKey = null;
    
    if (headers.Authorization && headers.Authorization.startsWith('Bearer ')) {
      apiKey = headers.Authorization.substring(7); // Enlève 'Bearer '
    } 
    // Essayer d'extraire depuis l'en-tête API-Key
    else if (headers['API-Key']) {
      apiKey = headers['API-Key'];
    }
    
    if (apiKey) {
      logger.info('Clé API extraite avec succès des en-têtes');
      logger.debug('Détails de la clé extraite', { keyLength: apiKey.length });
    } else {
      logger.warn('Aucune clé API trouvée dans les en-têtes');
    }
    
    return apiKey;
  } catch (error) {
    logger.error('Erreur lors de l'extraction de la clé API depuis les en-têtes', null, error);
    return null;
  }
}

export default {
  getAuthHeaders,
  isAuthConfigured,
  extractApiKeyFromHeaders
};
