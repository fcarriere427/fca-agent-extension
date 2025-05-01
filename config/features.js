/**
 * FCA-Agent - Configuration spécifique aux fonctionnalités
 * 
 * Ce module gère l'activation et la configuration des fonctionnalités de l'extension
 */

import { getConfig, updateConfig } from './index.js';
import { createLogger } from '../utils/logger.js';

// Initialiser le logger
const logger = createLogger('CONFIG:FEATURES');

/**
 * Récupère la configuration des fonctionnalités
 * @returns {Object} Configuration des fonctionnalités
 */
export function getFeaturesConfig() {
  return getConfig('enabledFeatures') || {};
}

/**
 * Vérifie si une fonctionnalité est activée
 * @param {string} feature - Nom de la fonctionnalité
 * @returns {boolean} True si la fonctionnalité est activée
 */
export function isFeatureEnabled(feature) {
  const features = getFeaturesConfig();
  return features[feature] === true;
}

/**
 * Active ou désactive une fonctionnalité
 * @param {string} feature - Nom de la fonctionnalité
 * @param {boolean} enabled - Activer la fonctionnalité
 * @returns {Promise<void>}
 */
export async function setFeatureEnabled(feature, enabled) {
  logger.info(`${enabled ? 'Activation' : 'Désactivation'} de la fonctionnalité: ${feature}`);
  
  const features = getFeaturesConfig();
  features[feature] = enabled;
  
  await updateConfig('enabledFeatures', features);
}

/**
 * Active ou désactive plusieurs fonctionnalités à la fois
 * @param {Object} featuresState - État des fonctionnalités { feature: enabled }
 * @returns {Promise<void>}
 */
export async function setMultipleFeatures(featuresState) {
  logger.info('Mise à jour multiple des fonctionnalités', featuresState);
  
  const features = getFeaturesConfig();
  const updatedFeatures = { ...features, ...featuresState };
  
  await updateConfig('enabledFeatures', updatedFeatures);
}

/**
 * Liste toutes les fonctionnalités disponibles avec leur état
 * @returns {Object} Liste des fonctionnalités { feature: enabled }
 */
export function listAllFeatures() {
  return {
    // Email
    gmail: isFeatureEnabled('gmail'),
    
    // Documents
    docs: isFeatureEnabled('docs'),
    sheets: isFeatureEnabled('sheets'),
    
    // Autres fonctionnalités potentielles
    slack: isFeatureEnabled('slack'),
    teams: isFeatureEnabled('teams')
  };
}

export default {
  getFeaturesConfig,
  isFeatureEnabled,
  setFeatureEnabled,
  setMultipleFeatures,
  listAllFeatures
};
