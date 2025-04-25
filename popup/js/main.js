// FCA-Agent - Script principal pour le popup

import { checkAuthOnce, handleLogout } from './auth.js';
import { initStatusIndicators } from './status.js';
import { setupMessageHandlers } from './messaging.js';
import { initUi } from './ui.js';
import { setupTaskHandlers } from './tasks/task-handlers.js';

// Logger spécifique au script principal
function mainLog(message, level = 'info') {
  const prefix = '[UI:MAIN]';
  switch(level) {
    case 'error':
      console.error(`${prefix} ${message}`);
      break;
    case 'warn':
      console.warn(`${prefix} ${message}`);
      break;
    default:
      console.log(`${prefix} ${message}`);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  mainLog('Initialisation du popup UI...');
  
  // Référence aux éléments UI principaux
  const logoutBtn = document.getElementById('logout-btn');
  const authIndicator = document.getElementById('auth-indicator');
  const serverIndicator = document.getElementById('server-indicator');
  
  // Vérification de l'authentification avant d'initialiser l'UI
  checkAuthOnce(() => {
    mainLog('Authentification principale: OK, initialisation popup');
    
    // Initialiser les gestionnaires de messages
    setupMessageHandlers();
    
    // Initialiser les indicateurs de statut
    if (authIndicator && serverIndicator) {
      initStatusIndicators(authIndicator, serverIndicator);
      mainLog('Indicateurs de statut initialisés');
    } else {
      mainLog('Indicateurs de statut non trouvés dans le DOM', 'error');
    }
    
    // Initialiser l'interface utilisateur générale
    initUi();
    
    // Initialiser les gestionnaires de tâches
    setupTaskHandlers();
    
    // Gestionnaire pour le bouton de déconnexion
    if (logoutBtn) {
      logoutBtn.addEventListener('click', handleLogout);
      mainLog('Gestionnaire de déconnexion initialisé');
    } else {
      mainLog('Bouton de déconnexion non trouvé dans le DOM', 'error');
    }
    
    // FORCE: Vérifier à nouveau le statut du serveur après 1 seconde
    setTimeout(() => {
      mainLog('Vérification forcée du statut du serveur après 1s');
      chrome.runtime.sendMessage({ action: 'checkServerOnline' });
    }, 1000);
  });
});