// ajout d'un outil de log qui écrit dans un fichier, pour mieux débugger plutôt que dans la console
class Logger {
    constructor() {
      this.logs = [];
    }
  
    log(prefix, message) {
      // Vérifier si prefix est fourni, sinon utiliser 'UNKNOWN'
      const logPrefix = prefix || 'UNKNOWN';
      const logEntry = `${new Date().toISOString()} [${logPrefix}]: ${message}`;
      this.logs.push(logEntry);
      
      // Optionnel : limite la taille du fichier
      if (this.logs.length > 100) {
        this.writeLogs();
      }
    }
  
    writeLogs() {
      const logContent = this.logs.join('\n');
      const blob = new Blob([logContent], {type: 'text/plain'});
      
      chrome.downloads.download({
        url: URL.createObjectURL(blob),
        filename: 'extension_logs.txt',
        saveAs: false
      });
  
      // Réinitialise les logs après l'écriture
      this.logs = [];
    }
  }

  // Créer une instance unique exportée
const logger = new Logger();
export default logger;