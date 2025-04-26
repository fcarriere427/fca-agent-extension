// FCA-Agent - Module de logging spécialisé pour la messagerie UI

import { createModuleLogger } from '../../utils/logger.js';

// Création d'une instance de logger spécifique pour la messagerie UI
const messagingLogger = createModuleLogger('messaging.js');

/**
 * Fonction de logging pour le module de messagerie
 * @param {string} message - Message à journaliser
 * @param {string} [level='info'] - Niveau de log (info, debug, warn, error)
 */
export function messagingLog(message, level = 'info') {
  switch(level) {
    case 'error':
      messagingLogger.error(message);
      break;
    case 'warn':
      messagingLogger.warn(message);
      break;
    case 'debug':
      messagingLogger.log(`DEBUG: ${message}`);
      break;
    default:
      messagingLogger.log(message);
  }
}