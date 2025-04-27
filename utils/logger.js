// FCA-Agent - Module de journalisation unifié pour l'extension
// Ce module remplace tous les fichiers de logging spécifiques et propose
// une interface unique avec un système de préfixes pour distinguer les sources

/**
 * Niveaux de log disponibles
 * @enum {string}
 */
export const LogLevel = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error'
};

/**
 * Configuration globale du logger
 * Peut être modifiée dynamiquement pendant l'exécution
 */
export const logConfig = {
  // Niveau minimum des logs qui seront affichés
  level: LogLevel.INFO,
  
  // Si true, affiche les logs dans la console du navigateur
  consoleOutput: true,
  
  // Si true, ajoute un timestamp aux logs
  showTimestamp: true,
  
  // Si true, affiche la trace des erreurs
  showStackTrace: true,
  
  // Active ou désactive les logs pour certains modules
  modules: {
    // Par défaut, tous les modules sont activés
    '*': true,
    // Exemples de désactivation spécifique:
    // 'auth': false, // Désactive les logs du module d'authentification
    // 'server': false // Désactive les logs liés au serveur
  }
};

/**
 * Génère un timestamp formaté
 * @returns {string} Timestamp au format YYYY-MM-DD HH:mm:ss
 */
function getTimestamp() {
  const now = new Date();
  return now.toISOString().replace('T', ' ').substring(0, 19);
}

/**
 * Formate un objet pour l'affichage dans les logs
 * @param {any} obj - Objet à formater
 * @returns {string} - Représentation texte de l'objet
 */
function formatObject(obj) {
  if (obj === null || obj === undefined) {
    return String(obj);
  }
  if (typeof obj === 'object') {
    try {
      return JSON.stringify(obj, null, 2);
    } catch (e) {
      return '[Objet non sérialisable]';
    }
  }
  return String(obj);
}

/**
 * Détermine si un niveau de log est suffisant pour être affiché
 * @param {string} level - Niveau du message de log
 * @returns {boolean} True si le message doit être affiché
 */
function shouldLog(level, module) {
  // Vérifier si le niveau est suffisant
  const levels = Object.values(LogLevel);
  const configLevelIndex = levels.indexOf(logConfig.level);
  const messageLevelIndex = levels.indexOf(level);
  
  if (messageLevelIndex < configLevelIndex) {
    return false;
  }
  
  // Vérifier si le module est activé
  if (logConfig.modules[module] === false) {
    return false;
  }
  
  // Si le module n'est pas explicitement mentionné, utiliser la configuration '*'
  if (module && !Object.prototype.hasOwnProperty.call(logConfig.modules, module)) {
    return logConfig.modules['*'];
  }
  
  return true;
}

/**
 * Crée l'objet logger principal
 */
const coreLogger = {
  /**
   * Journalise un message
   * @param {string} level - Niveau de log (debug, info, warn, error)
   * @param {string} module - Nom du module source
   * @param {string} message - Message à journaliser
   * @param {Object} [data] - Données supplémentaires
   * @param {Error} [error] - Objet d'erreur (pour les logs d'erreur)
   */
  log: function(level, module, message, data = null, error = null) {
    if (!shouldLog(level, module)) {
      return;
    }
    
    // Construction du message de log
    const timestamp = logConfig.showTimestamp ? getTimestamp() + ' ' : '';
    const prefix = `${timestamp}${level.toUpperCase()} [${module}]: `;
    let fullMessage = `${prefix}${message}`;
    
    // Sélection de la méthode de console selon le niveau
    let consoleMethod;
    switch(level) {
      case LogLevel.DEBUG:
        consoleMethod = console.debug || console.log;
        break;
      case LogLevel.WARN:
        consoleMethod = console.warn;
        break;
      case LogLevel.ERROR:
        consoleMethod = console.error;
        break;
      default:
        consoleMethod = console.log;
    }
    
    // Affichage dans la console si activé
    if (logConfig.consoleOutput) {
      consoleMethod(fullMessage);
      
      // Affichage des données supplémentaires s'il y en a
      if (data !== null) {
        consoleMethod(`${prefix}Data:`, formatObject(data));
      }
      
      // Affichage de la stack trace pour les erreurs si activé
      if (error && error.stack && logConfig.showStackTrace) {
        consoleMethod(`${prefix}Stack: ${error.stack}`);
      }
    }
    
    // Extension possible : envoi des logs à un service externe, stockage local, etc.
  }
};

/**
 * Classe Logger - Représente un logger avec un module spécifique
 */
class Logger {
  /**
   * Crée une nouvelle instance de Logger
   * @param {string} module - Nom du module associé à ce logger
   */
  constructor(module) {
    this.module = module;
  }
  
  /**
   * Log de niveau debug
   * @param {string} message - Message à journaliser 
   * @param {Object} [data] - Données supplémentaires
   */
  debug(message, data = null) {
    coreLogger.log(LogLevel.DEBUG, this.module, message, data);
  }
  
  /**
   * Log de niveau info
   * @param {string} message - Message à journaliser
   * @param {Object} [data] - Données supplémentaires
   */
  info(message, data = null) {
    coreLogger.log(LogLevel.INFO, this.module, message, data);
  }
  
  /**
   * Log de niveau warn
   * @param {string} message - Message à journaliser
   * @param {Object} [data] - Données supplémentaires
   */
  warn(message, data = null) {
    coreLogger.log(LogLevel.WARN, this.module, message, data);
  }
  
  /**
   * Log de niveau error
   * @param {string} message - Message d'erreur
   * @param {Object} [data] - Données supplémentaires
   * @param {Error} [error] - Objet d'erreur
   */
  error(message, data = null, error = null) {
    coreLogger.log(LogLevel.ERROR, this.module, message, data, error);
  }
  
  // Méthodes de compatibilité avec l'ancien logger
  log(message, data = null) {
    this.info(message, data);
  }
}

/**
 * Crée un logger pour un module spécifique
 * @param {string} module - Nom du module
 * @returns {Logger} - Instance de Logger configurée pour le module
 */
export function createLogger(module) {
  return new Logger(module);
}

// Logger par défaut pour les cas où aucun module n'est spécifié
const defaultLogger = createLogger('default');

// Exports pour compatibilité avec l'ancien code
export const logger = {
  log: (module, message, data = null) => {
    createLogger(module).info(message, data);
  },
  info: (module, message, data = null) => {
    createLogger(module).info(message, data);
  },
  warn: (module, message, data = null) => {
    createLogger(module).warn(message, data);
  },
  error: (module, message, data = null, error = null) => {
    createLogger(module).error(message, data, error);
  }
};

// Fonction utilitaire pour simplifier la création d'un logger spécifique à un module
export const createModuleLogger = createLogger;

// Export par défaut
export default defaultLogger;
