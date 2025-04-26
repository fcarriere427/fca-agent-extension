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

// Création d'une instance de logger unique et globale
const logger = {
  /**
   * Journalise un message standard
   * @param {string} fileName - Nom du fichier source
   * @param {string} message - Message à journaliser
   * @param {Object} [data] - Données supplémentaires
   */
  log: function(fileName, message, data = null) {
    const timestamp = getTimestamp();
    let fullMessage = `${timestamp} INFO [${fileName}]: ${message}`;
    
    console.log(fullMessage);
    if (data !== null) {
      console.log(formatObject(data));
    }
  },
  
  /**
   * Journalise un avertissement
   * @param {string} fileName - Nom du fichier source
   * @param {string} message - Message d'avertissement
   * @param {Object} [data] - Données supplémentaires
   */
  warn: function(fileName, message, data = null) {
    const timestamp = getTimestamp();
    let fullMessage = `${timestamp} WARN [${fileName}]: ${message}`;
    
    console.warn(fullMessage);
    if (data !== null) {
      console.warn(formatObject(data));
    }
  },
  
  /**
   * Journalise une erreur
   * @param {string} fileName - Nom du fichier source
   * @param {string} message - Message d'erreur
   * @param {Object} [data] - Données supplémentaires
   */
  error: function(fileName, message, data = null) {
    const timestamp = getTimestamp();
    let fullMessage = `${timestamp} ERROR [${fileName}]: ${message}`;
    
    console.error(fullMessage);
    if (data !== null) {
      console.error(formatObject(data));
    }
  },
  
  // Pour compatibilité avec l'ancien code
  info: function(fileName, message, data = null) {
    this.log(fileName, message, data);
  }
};

// Exports en format ES modules
export { logger };
export default logger;
