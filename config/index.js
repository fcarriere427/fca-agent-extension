/**
 * FCA-Agent - Module de configuration centralisé pour l'extension
 * 
 * Ce module gère toute la configuration de l'extension avec:
 * - Valeurs par défaut
 * - Variables stockées (chrome.storage)
 * - Clé API importée du fichier dédié
 */

import { createLogger } from '../utils/logger.js';
import { API_KEY } from './api-key.js';

// Initialiser le logger
const logger = createLogger('CONFIG');

// Configuration par défaut
const defaultConfig = {
  // API et connexion au serveur
  apiBaseUrl: 'https://fca-agent.letsq.xyz/api',
  apiKey: API_KEY,
  
  // Options de l'interface utilisateur
  theme: 'light', // 'light' ou 'dark'
  popupWidth: 400,
  popupHeight: 600,
  showNotifications: true,
  
  // Fonctionnalités
  enabledFeatures: {
    gmail: true,
    docs: false,
    sheets: false
  },
  
  // Clés et valeurs en cache
  storedValues: {}
};

// Configuration actuelle (initialisée avec les valeurs par défaut)
let currentConfig = { ...defaultConfig };

/**
 * Charge la configuration depuis le stockage local de Chrome
 * @returns {Promise<Object>} Configuration chargée
 */
export async function loadConfig() {
  try {
    logger.info('Chargement de la configuration...');
    
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(null, (result) => {
        if (chrome.runtime.lastError) {
          logger.error('Erreur lors du chargement de la configuration', chrome.runtime.lastError);
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        
        // Mettre à jour la configuration avec les valeurs stockées
        if (result.apiBaseUrl) {
          currentConfig.apiBaseUrl = result.apiBaseUrl;
        }
        
        // Si une clé API est stockée, elle a priorité sur celle du fichier
        if (result.apiKey) {
          currentConfig.apiKey = result.apiKey;
        }
        
        // Options UI
        if (result.theme) {
          currentConfig.theme = result.theme;
        }
        
        if (result.showNotifications !== undefined) {
          currentConfig.showNotifications = result.showNotifications;
        }
        
        // Fonctionnalités activées
        if (result.enabledFeatures) {
          currentConfig.enabledFeatures = {
            ...currentConfig.enabledFeatures,
            ...result.enabledFeatures
          };
        }
        
        // Valeurs stockées
        if (result.storedValues) {
          currentConfig.storedValues = result.storedValues;
        }
        
        logger.info('Configuration chargée avec succès');
        resolve(currentConfig);
      });
    });
  } catch (error) {
    logger.error('Erreur lors du chargement de la configuration', error);
    return { ...currentConfig }; // Retourne une copie de la configuration actuelle en cas d'erreur
  }
}

/**
 * Enregistre la configuration dans le stockage local
 * @param {Object} newConfig - Nouvelle configuration à enregistrer
 * @returns {Promise<void>}
 */
export async function saveConfig(newConfig = null) {
  try {
    const configToSave = newConfig || currentConfig;
    logger.info('Enregistrement de la configuration...');
    
    return new Promise((resolve, reject) => {
      chrome.storage.local.set(configToSave, () => {
        if (chrome.runtime.lastError) {
          logger.error('Erreur lors de l\'enregistrement de la configuration', chrome.runtime.lastError);
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        
        // Mettre à jour la configuration actuelle
        if (newConfig) {
          currentConfig = { ...currentConfig, ...newConfig };
        }
        
        logger.info('Configuration enregistrée avec succès');
        resolve();
      });
    });
  } catch (error) {
    logger.error('Erreur lors de l\'enregistrement de la configuration', error);
    throw error;
  }
}

/**
 * Récupère une valeur de configuration
 * @param {string} key - Clé de configuration
 * @returns {any} Valeur de configuration
 */
export function getConfig(key) {
  return currentConfig[key];
}

/**
 * Récupère toute la configuration actuelle
 * @returns {Object} Configuration complète
 */
export function getAllConfig() {
  return { ...currentConfig };
}

/**
 * Met à jour une valeur de configuration
 * @param {string} key - Clé de configuration
 * @param {any} value - Nouvelle valeur
 * @param {boolean} [save=true] - Enregistrer immédiatement dans le stockage
 * @returns {Promise<void>}
 */
export async function updateConfig(key, value, save = true) {
  logger.info(`Mise à jour de la configuration: ${key}`, { oldValue: currentConfig[key], newValue: value });
  
  // Mettre à jour la configuration en mémoire
  currentConfig[key] = value;
  
  // Enregistrer si demandé
  if (save) {
    const saveObject = {};
    saveObject[key] = value;
    return saveConfig(saveObject);
  }
}

/**
 * Met à jour plusieurs valeurs de configuration à la fois
 * @param {Object} updates - Objet avec les mises à jour { key: value }
 * @returns {Promise<void>}
 */
export async function updateMultipleConfig(updates) {
  logger.info('Mise à jour multiple de la configuration', updates);
  
  // Mettre à jour la configuration en mémoire
  Object.entries(updates).forEach(([key, value]) => {
    currentConfig[key] = value;
  });
  
  // Enregistrer les modifications
  return saveConfig(updates);
}

/**
 * Stocke une valeur dans le cache interne de configuration
 * @param {string} key - Clé de la valeur
 * @param {any} value - Valeur à stocker
 * @param {boolean} [save=true] - Enregistrer immédiatement dans le stockage
 * @returns {Promise<void>}
 */
export async function storeValue(key, value, save = true) {
  logger.debug(`Stockage de valeur: ${key}`);
  
  // Mettre à jour dans la configuration
  currentConfig.storedValues[key] = value;
  
  // Enregistrer si demandé
  if (save) {
    return saveConfig({
      storedValues: currentConfig.storedValues
    });
  }
}

/**
 * Récupère une valeur stockée
 * @param {string} key - Clé de la valeur
 * @returns {any} Valeur stockée ou undefined si non trouvée
 */
export function getStoredValue(key) {
  return currentConfig.storedValues[key];
}

/**
 * Réinitialise la configuration aux valeurs par défaut
 * @returns {Promise<void>}
 */
export async function resetConfig() {
  logger.info('Réinitialisation de la configuration aux valeurs par défaut');
  
  currentConfig = { ...defaultConfig };
  
  // Enregistrer la configuration par défaut
  return new Promise((resolve, reject) => {
    chrome.storage.local.clear(() => {
      if (chrome.runtime.lastError) {
        logger.error('Erreur lors de la réinitialisation de la configuration', chrome.runtime.lastError);
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      
      saveConfig(currentConfig)
        .then(resolve)
        .catch(reject);
    });
  });
}

// Initialisation automatique lors de l'import
loadConfig().catch(error => {
  logger.error('Erreur lors de l\'initialisation de la configuration', error);
});

// Exporter les fonctions spécifiques concernant l'API pour compatibilité avec le code existant
export async function getApiUrl() {
  return getConfig('apiBaseUrl');
}

export async function setApiUrl(url) {
  return updateConfig('apiBaseUrl', url);
}

export async function getApiKey() {
  return getConfig('apiKey');
}

export async function setApiKey(key) {
  return updateConfig('apiKey', key);
}

export async function loadInitialConfig() {
  return loadConfig();
}

export async function setDefaultConfig() {
  // Vérifier si la configuration existe déjà
  const config = await loadConfig();
  
  // Si aucune URL API n'est configurée, utiliser la valeur par défaut
  if (!config.apiBaseUrl) {
    await updateConfig('apiBaseUrl', defaultConfig.apiBaseUrl);
  }
}

// Exporter un objet avec toutes les fonctions pour compatibilité avec l'ancien code
export default {
  getApiUrl,
  setApiUrl,
  getApiKey,
  setApiKey,
  loadInitialConfig,
  setDefaultConfig,
  loadConfig,
  saveConfig,
  getConfig,
  getAllConfig,
  updateConfig,
  updateMultipleConfig,
  storeValue,
  getStoredValue,
  resetConfig
};
