// FCA-Agent - Module de logging spécialisé pour les handlers

import { createModuleLogger } from '../utils/logger.js';

// Création d'une instance de logger spécifique pour les handlers
const handlersLogger = createModuleLogger('handlers.js');

/**
 * Fonction de logging pour le module de gestion des messages
 * @param {string} message - Message à journaliser
 * @param {string} [level='info'] - Niveau de log (info, debug, warn, error)
 */
export function handlerLog(message, level = 'info') {
  switch(level) {
    case 'error':
      handlersLogger.error(message);
      break;
    case 'warn':
      handlersLogger.warn(message);
      break;
    case 'debug':
      handlersLogger.log(`DEBUG: ${message}`);
      break;
    default:
      handlersLogger.log(message);
  }
}