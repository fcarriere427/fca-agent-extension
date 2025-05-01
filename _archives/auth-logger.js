// FCA-Agent - Module de logging spécialisé pour l'authentification UI

import { createModuleLogger } from '../../utils/logger.js';

// Création d'une instance de logger spécifique pour l'authentification UI
const authUiLogger = createModuleLogger('auth-ui.js');

/**
 * Fonction de logging pour le module d'authentification UI
 * @param {string} message - Message à journaliser
 * @param {string} [level='info'] - Niveau de log (info, debug, warn, error)
 */
export function authUiLog(message, level = 'info') {
  switch(level) {
    case 'error':
      authUiLogger.error(message);
      break;
    case 'warn':
      authUiLogger.warn(message);
      break;
    case 'debug':
      authUiLogger.log(`DEBUG: ${message}`);
      break;
    default:
      authUiLogger.log(message);
  }
}