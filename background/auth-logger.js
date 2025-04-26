// FCA-Agent - Module de logging spécialisé pour l'authentification

import { createModuleLogger } from '../utils/logger.js';

// Création d'une instance de logger spécifique pour l'authentification
const authLogger = createModuleLogger('auth-api.js');

/**
 * Fonction de logging pour le module d'authentification
 * @param {string} message - Message à journaliser
 * @param {string} [level='info'] - Niveau de log (info, debug, warn, error)
 */
export function authLog(message, level = 'info') {
  switch(level) {
    case 'error':
      authLogger.error(message);
      break;
    case 'warn':
      authLogger.warn(message);
      break;
    case 'debug':
      authLogger.log(`DEBUG: ${message}`);
      break;
    default:
      authLogger.log(message);
  }
}