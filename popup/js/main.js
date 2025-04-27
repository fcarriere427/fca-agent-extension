// FCA-Agent - Script principal pour le popup

import { checkAuthOnce, handleLogout } from './auth.js';
import { initStatusIndicators } from './status.js';
import { setupMessageHandlers } from '../../background/handlers.js';
import { setupTaskHandlers } from './task-handlers.js';
import { initUI } from './ui.js';
import { mainLog } from './main-logger.js';

document.addEventListener('DOMContentLoaded', () => {
  mainLog('Initialisation du popup UI...');
  
  // Référence aux éléments UI principaux
  const serverIndicator = document.getElementById('server-indicator');
  
  // Vérification de l'authentification avant d'initialiser l'UI
  checkAuthOnce(() => {
    mainLog('Authentification principale: OK, initialisation popup');
    
    // Initialiser les gestionnaires de messages
    setupMessageHandlers();
    
    // Initialiser l'indicateur de statut
    if (serverIndicator) {
      initStatusIndicators(null, serverIndicator);
      mainLog('Indicateur de statut initialisé');
    } else {
      mainLog('Indicateur de statut non trouvé dans le DOM', 'error');
    }
    
    // Initialiser l'interface utilisateur générale
    initUI();
    
    // Initialiser les gestionnaires de tâches
    setupTaskHandlers();
    
    // Rechercher le bouton de déconnexion (s'il existe)
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', handleLogout);
      mainLog('Gestionnaire de déconnexion initialisé');
    } else {
      mainLog('Bouton de déconnexion non trouvé dans le DOM (normal s\'il n\'existe pas)', 'warn');
    }
    
    // FORCE: Vérifier à nouveau le statut du serveur après 1 seconde
    setTimeout(() => {
      mainLog('Vérification forcée du statut du serveur après 1s');
      chrome.runtime.sendMessage({ action: 'checkServerOnline' });
    }, 1000);
  });
});