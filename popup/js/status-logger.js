// FCA-Agent - Module de logging spécialisé pour les statuts

import { createModuleLogger } from '../../utils/logger.js';

// Création d'une instance de logger spécifique pour les statuts
const statusLogger = createModuleLogger('status.js');

/**
 * Fonction de logging pour le module de gestion des indicateurs de statut
 * @param {string} message - Message à journaliser
 * @param {string} [level='info'] - Niveau de log (info, debug, warn, error)
 */
export function statusLog(message, level = 'info') {
  switch(level) {
    case 'error':
      statusLogger.error(message);
      break;
    case 'warn':
      statusLogger.warn(message);
      break;
    case 'debug':
      statusLogger.log(`DEBUG: ${message}`);
      break;
    default:
      statusLogger.log(message);
  }
}