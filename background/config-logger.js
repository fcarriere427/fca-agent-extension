// FCA-Agent - Module de logging spécialisé pour la configuration

import { createModuleLogger } from '../utils/logger.js';

// Création d'une instance de logger spécifique pour la configuration
const configLogger = createModuleLogger('config.js');

/**
 * Fonction de logging pour le module de configuration
 * @param {string} message - Message à journaliser
 * @param {string} [level='info'] - Niveau de log (info, debug, warn, error)
 */
export function configLog(message, level = 'info') {
  switch(level) {
    case 'error':
      configLogger.error(message);
      break;
    case 'warn':
      configLogger.warn(message);
      break;
    case 'debug':
      configLogger.log(`DEBUG: ${message}`);
      break;
    default:
      configLogger.log(message);
  }
}