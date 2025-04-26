// FCA-Agent - Générateur d'en-têtes d'authentification avec clé API fixe

import { getApiKey } from './api-key.js';
import { createModuleLogger } from '../utils/logger.js';

// Création d'une instance de logger spécifique pour ce module
const logger = createModuleLogger('auth-headers.js');

/**
 * Retourne les en-têtes d'authentification avec la clé API fixe
 * @returns {Object} En-têtes HTTP pour l'authentification
 */
export function getAuthHeaders() {
  const apiKey = getApiKey();
  logger.log(`Génération des en-têtes d'authentification avec clé API fixe`);
  
  // Utilisation de la clé API comme Bearer token pour compatibilité avec l'ancien système
  return { 
    'Authorization': `Bearer ${apiKey}`,
    'API-Key': apiKey // En-tête supplémentaire spécifique aux API keys
  };
}

/**
 * Vérifie si l'authentification est configurée correctement
 * @returns {boolean} Vrai si la clé API est définie
 */
export function isAuthConfigured() {
  const apiKey = getApiKey();
  return !!apiKey && apiKey.length > 0;
}
