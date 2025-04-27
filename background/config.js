// FCA-Agent - Module de configuration
// Ce module gère la configuration globale de l'extension

import { createLogger } from '../utils/logger.js';

// Création d'un logger dédié au module de configuration
const logger = createLogger('config');

// Configuration globale
let API_BASE_URL = 'https://fca-agent.letsq.xyz/api';

/**
 * Récupère l'URL de base de l'API
 * @returns {string} URL de base de l'API
 */
export async function getApiUrl() {
  try {
    logger.debug('Récupération de l\'URL de l\'API');
    return API_BASE_URL;
  } catch (error) {
    logger.error('Erreur lors de la récupération de l\'URL de l\'API', null, error);
    return API_BASE_URL; // Retourne la valeur par défaut en cas d'erreur
  }
}

/**
 * Définit une nouvelle URL de base pour l'API
 * @param {string} url - Nouvelle URL de base
 * @returns {Promise<void>}
 */
export async function setApiUrl(url) {
  try {
    if (!url) {
      logger.warn('Tentative de définition d\'une URL vide');
      return;
    }

    logger.info('Modification de l\'URL de l\'API', { 
      oldUrl: API_BASE_URL,
      newUrl: url
    });
    
    API_BASE_URL = url;
    
    await new Promise((resolve, reject) => {
      chrome.storage.local.set({ 'apiBaseUrl': API_BASE_URL }, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        }
        resolve();
      });
    });
    
    logger.debug('URL API sauvegardée dans le stockage local');
  } catch (error) {
    logger.error('Échec de la modification de l\'URL de l\'API', { url }, error);
    throw new Error(`Impossible de modifier l'URL de l'API: ${error.message}`);
  }
}

/**
 * Charge la configuration initiale depuis le stockage local
 * @returns {Promise<void>}
 */
export async function loadInitialConfig() {
  try {
    logger.info('Chargement de la configuration initiale');
    
    const result = await new Promise((resolve, reject) => {
      chrome.storage.local.get(['apiBaseUrl'], (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        }
        resolve(result);
      });
    });
    
    if (result.apiBaseUrl) {
      API_BASE_URL = result.apiBaseUrl;
      logger.info('URL API chargée depuis le stockage local', { url: API_BASE_URL });
    } else {
      logger.debug('Aucune URL API trouvée dans le stockage local, utilisation de la valeur par défaut');
    }
  } catch (error) {
    logger.error('Erreur lors du chargement de la configuration initiale', null, error);
    // Ne pas propager l'erreur pour éviter de bloquer le démarrage
  }
}

/**
 * Définit la configuration par défaut lors de l'installation/mise à jour
 * @returns {Promise<void>}
 */
export async function setDefaultConfig() {
  try {
    logger.info('Vérification et application de la configuration par défaut');
    
    const result = await new Promise((resolve, reject) => {
      chrome.storage.local.get(['apiBaseUrl'], (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        }
        resolve(result);
      });
    });
    
    if (!result.apiBaseUrl) {
      // Configuration par défaut
      const defaultApiUrl = 'http://fca-agent.letsq.xyz/api';
      API_BASE_URL = defaultApiUrl;
      
      await new Promise((resolve, reject) => {
        chrome.storage.local.set({ 'apiBaseUrl': API_BASE_URL }, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          }
          resolve();
        });
      });
      
      logger.info('Configuration par défaut appliquée', { apiUrl: API_BASE_URL });
    } else {
      logger.debug('Configuration existante conservée', { apiUrl: result.apiBaseUrl });
    }
  } catch (error) {
    logger.error('Erreur lors de la définition de la configuration par défaut', null, error);
    // Ne pas propager l'erreur pour éviter de bloquer le démarrage
  }
}

export default {
  getApiUrl,
  setApiUrl,
  loadInitialConfig,
  setDefaultConfig
};
