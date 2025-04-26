// FCA-Agent - Module de logging spécialisé pour les gestionnaires de tâches

import { createModuleLogger } from '../../utils/logger.js';

// Création d'une instance de logger spécifique pour les gestionnaires de tâches
const taskLogger = createModuleLogger('task-handlers.js');

/**
 * Fonction de logging pour le module de gestionnaires de tâches
 * @param {string} message - Message à journaliser
 * @param {string} [level='info'] - Niveau de log (info, debug, warn, error)
 */
export function taskLog(message, level = 'info') {
  switch(level) {
    case 'error':
      taskLogger.error(message);
      break;
    case 'warn':
      taskLogger.warn(message);
      break;
    case 'debug':
      taskLogger.log(`DEBUG: ${message}`);
      break;
    default:
      taskLogger.log(message);
  }
}