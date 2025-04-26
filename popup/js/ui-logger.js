// FCA-Agent - Module de logging spécialisé pour l'interface utilisateur

import { createModuleLogger } from '../../utils/logger.js';

// Création d'une instance de logger spécifique pour l'interface utilisateur
const uiLogger = createModuleLogger('ui.js');

/**
 * Fonction de logging pour le module d'interface utilisateur
 * @param {string} message - Message à journaliser
 * @param {string} [level='info'] - Niveau de log (info, debug, warn, error)
 */
export function uiLog(message, level = 'info') {
  switch(level) {
    case 'error':
      uiLogger.error(message);
      break;
    case 'warn':
      uiLogger.warn(message);
      break;
    case 'debug':
      uiLogger.log(`DEBUG: ${message}`);
      break;
    default:
      uiLogger.log(message);
  }
}