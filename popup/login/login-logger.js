// FCA-Agent - Module de logging spécialisé pour le serveur

import { createModuleLogger } from '../../utils/logger.js';

// Création d'une instance de logger spécifique pour le serveur
const loginLogger = createModuleLogger('login.js');

/**
 * Fonction de logging pour le module serveur
 * @param {string} message - Message à journaliser
 * @param {string} [level='info'] - Niveau de log (info, debug, warn, error)
 */
export function loginLog(message, level = 'info') {
  switch(level) {
    case 'error':
      loginLogger.error(message);
      break;
    case 'warn':
      loginLogger.warn(message);
      break;
    case 'debug':
      loginLogger.log(`DEBUG: ${message}`);
      break;
    default:
      loginLogger.log(message);
  }
}