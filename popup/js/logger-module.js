// FCA-Agent - Module centralisé pour les loggers du popup
// Remplace tous les fichiers *-logger.js individuels

import { createModuleLogger } from '../../utils/logger.js';

// Création d'instances de logger pour chaque module
export const authLogger = createModuleLogger('auth.js');
export const mainLogger = createModuleLogger('main.js');
export const messagingLogger = createModuleLogger('messaging.js');
export const statusLogger = createModuleLogger('status.js');
export const taskHandlersLogger = createModuleLogger('task-handlers.js');
export const uiLogger = createModuleLogger('ui.js');

// Fonctions wrapper pour maintenir la compatibilité avec le code existant
export function authUiLog(message, level = 'info') {
  logWithLevel(authLogger, message, level);
}

export function mainLog(message, level = 'info') {
  logWithLevel(mainLogger, message, level);
}

export function messagingLog(message, level = 'info') {
  logWithLevel(messagingLogger, message, level);
}

export function statusLog(message, level = 'info') {
  logWithLevel(statusLogger, message, level);
}

export function taskHandlersLog(message, level = 'info') {
  logWithLevel(taskHandlersLogger, message, level);
}

export function uiLog(message, level = 'info') {
  logWithLevel(uiLogger, message, level);
}

// Fonction utilitaire commune pour gérer les différents niveaux de log
function logWithLevel(logger, message, level) {
  switch(level) {
    case 'error':
      logger.error(message);
      break;
    case 'warn':
      logger.warn(message);
      break;
    case 'debug':
      logger.debug(message);
      break;
    default:
      logger.info(message);
  }
}

// Fonction utilitaire pour créer un logger spécifique à une tâche
export function createTaskLogger(taskName) {
  const taskLogger = createModuleLogger(`task-${taskName}.js`);
  
  return {
    log: (message, level = 'info') => logWithLevel(taskLogger, message, level)
  };
}