// FCA-Agent - Module de logging spécialisé pour le script principal du popup

import { createModuleLogger } from '../../utils/logger.js';

// Création d'une instance de logger spécifique pour le script principal
const mainLogger = createModuleLogger('main.js');

/**
 * Fonction de logging pour le script principal du popup
 * @param {string} message - Message à journaliser
 * @param {string} [level='info'] - Niveau de log (info, debug, warn, error)
 */
export function mainLog(message, level = 'info') {
  switch(level) {
    case 'error':
      mainLogger.error(message);
      break;
    case 'warn':
      mainLogger.warn(message);
      break;
    case 'debug':
      mainLogger.log(`DEBUG: ${message}`);
      break;
    default:
      mainLogger.log(message);
  }
}