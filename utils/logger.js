// FCA-Agent - Module de journalisation simplifié (3 niveaux: info, warn, error)

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
 * Crée un logger dédié à un module spécifique
 * @param {string} moduleName - Nom du module pour identification dans les logs
 * @returns {Object} - Logger configuré pour le module
 */
export function createModuleLogger(moduleName) {
  return {
    log: function(message, data = null) {
      logger.log(moduleName, message, data);
    },
    warn: function(message, data = null) {
      logger.warn(moduleName, message, data);
    },
    error: function(message, data = null) {
      logger.error(moduleName, message, data);
    },
    info: function(message, data = null) {
      logger.log(moduleName, message, data);
    }
  };
}

// Création d'une instance de logger unique et globale
const logger = {
  /**
   * Journalise un message standard
   * @param {string} moduleName - Nom du module source
   * @param {string} message - Message à journaliser
   * @param {Object} [data] - Données supplémentaires
   */
  log: function(moduleName, message, data = null) {
    const timestamp = getTimestamp();
    let fullMessage = `${timestamp} INFO [${moduleName}]: ${message}`;
    
    console.log(fullMessage);
    if (data !== null) {
      console.log(formatObject(data));
    }
  },
  
  /**
   * Journalise un avertissement
   * @param {string} moduleName - Nom du module source
   * @param {string} message - Message d'avertissement
   * @param {Object} [data] - Données supplémentaires
   */
  warn: function(moduleName, message, data = null) {
    const timestamp = getTimestamp();
    let fullMessage = `${timestamp} WARN [${moduleName}]: ${message}`;
    
    console.warn(fullMessage);
    if (data !== null) {
      console.warn(formatObject(data));
    }
  },
  
  /**
   * Journalise une erreur
   * @param {string} moduleName - Nom du module source
   * @param {string} message - Message d'erreur
   * @param {Object} [data] - Données supplémentaires
   */
  error: function(moduleName, message, data = null) {
    const timestamp = getTimestamp();
    let fullMessage = `${timestamp} ERROR [${moduleName}]: ${message}`;
    
    console.error(fullMessage);
    if (data !== null) {
      console.error(formatObject(data));
    }
  },
  
  // Pour compatibilité avec l'ancien code
  info: function(moduleName, message, data = null) {
    this.log(moduleName, message, data);
  }
};

// Exports en format ES modules
export { logger };
export default logger;
