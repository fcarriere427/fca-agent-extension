// FCA-Agent - Module de logging spécialisé pour le serveur

import { createModuleLogger } from '../utils/logger.js';

// Création d'une instance de logger spécifique pour le serveur
const serverLogger = createModuleLogger('server.js');

/**
 * Fonction de logging pour le module serveur
 * @param {string} message - Message à journaliser
 * @param {string} [level='info'] - Niveau de log (info, debug, warn, error)
 */
export function serverLog(message, level = 'info') {
  switch(level) {
    case 'error':
      serverLogger.error(message);
      break;
    case 'warn':
      serverLogger.warn(message);
      break;
    case 'debug':
      serverLogger.log(`DEBUG: ${message}`);
      break;
    default:
      serverLogger.log(message);
  }
}