/**
 * FCA-Agent - Configuration spécifique à l'API
 * 
 * Ce module gère les configurations liées à l'API et au serveur
 */

import { getConfig, updateConfig, getApiUrl, setApiUrl, getApiKey, setApiKey } from './index.js';
import { createLogger } from '../utils/logger.js';

// Initialiser le logger
const logger = createLogger('CONFIG:API');

/**
 * Récupère la configuration complète de l'API
 * @returns {Promise<Object>} Configuration de l'API
 */
export async function getAPIConfig() {
  return {
    baseUrl: await getApiUrl(),
    apiKey: await getApiKey()
  };
}

/**
 * Vérifie si les paramètres API sont configurés
 * @returns {Promise<boolean>} True si l'API est configurée
 */
export async function isAPIConfigured() {
  const config = await getAPIConfig();
  return !!(config.baseUrl && config.apiKey);
}

/**
 * Génère les en-têtes d'authentification pour les requêtes API
 * @returns {Promise<Object>} En-têtes d'authentification
 */
export async function getAuthHeaders() {
  const apiKey = await getApiKey();
  
  return {
    'Authorization': `Bearer ${apiKey}`,
    'API-Key': apiKey,
    'Content-Type': 'application/json'
  };
}

/**
 * Construit une URL complète en combinant l'URL de base et le chemin
 * @param {string} path - Chemin de l'API (sans slash initial)
 * @returns {Promise<string>} URL complète
 */
export async function buildApiUrl(path) {
  const baseUrl = await getApiUrl();
  
  // S'assurer que le chemin n'a pas de slash au début
  const cleanPath = path.startsWith('/') ? path.substring(1) : path;
  
  // S'assurer que l'URL de base se termine par un slash
  const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  
  return `${cleanBaseUrl}${cleanPath}`;
}

/**
 * Configure l'API avec une nouvelle URL et clé API
 * @param {string} baseUrl - URL de base de l'API
 * @param {string} apiKey - Clé API pour l'authentification
 * @returns {Promise<void>}
 */
export async function configureAPI(baseUrl, apiKey) {
  logger.info('Configuration de l\'API', { baseUrl });
  
  // Valider l'URL
  if (!baseUrl || !baseUrl.startsWith('http')) {
    throw new Error('URL de base invalide. Doit commencer par http:// ou https://');
  }
  
  // Valider la clé API
  if (!apiKey || apiKey.length < 8) {
    throw new Error('Clé API invalide. Doit contenir au moins 8 caractères');
  }
  
  // Mettre à jour la configuration
  await setApiUrl(baseUrl);
  await setApiKey(apiKey);
  
  logger.info('Configuration de l\'API terminée');
}

/**
 * Teste la connexion à l'API avec les paramètres actuels
 * @returns {Promise<Object>} Résultat du test
 */
export async function testAPIConnection() {
  try {
    logger.info('Test de connexion à l\'API');
    
    if (!await isAPIConfigured()) {
      return {
        success: false,
        message: 'Configuration API incomplète'
      };
    }
    
    const checkUrl = await buildApiUrl('auth/check');
    const headers = await getAuthHeaders();
    
    logger.debug('Envoi de la requête de test', { url: checkUrl });
    
    const response = await fetch(checkUrl, {
      method: 'GET',
      headers: headers
    });
    
    const data = await response.json();
    
    if (response.ok && data.authenticated) {
      logger.info('Test de connexion réussi');
      return {
        success: true,
        message: 'Connexion établie avec succès'
      };
    } else {
      logger.warn('Échec du test de connexion', { status: response.status, data });
      return {
        success: false,
        message: data.message || 'Échec de l\'authentification'
      };
    }
  } catch (error) {
    logger.error('Erreur lors du test de connexion', error);
    return {
      success: false,
      message: `Erreur de connexion: ${error.message}`
    };
  }
}

export default {
  getAPIConfig,
  isAPIConfigured,
  getAuthHeaders,
  buildApiUrl,
  configureAPI,
  testAPIConnection
};
