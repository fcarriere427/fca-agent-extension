// FCA-Agent - Module de gestion des indicateurs de statut

let authIndicator;
let serverIndicator;

/**
 * Initialise les indicateurs de statut
 * @param {HTMLElement} authIndicatorElement - Élément DOM de l'indicateur d'authentification
 * @param {HTMLElement} serverIndicatorElement - Élément DOM de l'indicateur de connexion au serveur
 */
export function initStatusIndicators(authIndicatorElement, serverIndicatorElement) {
  authIndicator = authIndicatorElement;
  serverIndicator = serverIndicatorElement;
  
  // S'assurer que les indicateurs sont rouges par défaut
  resetIndicators();
  
  // Surveiller les messages de mise à jour des statuts
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'authStatusChanged') {
      updateAuthIndicator(message.status);
    } else if (message.action === 'serverStatusChanged') {
      updateServerIndicator(message.status);
    }
  });
  
  // Rafraîchir les statuts au démarrage
  requestStatusUpdates();
  
  // Ajouter des tooltips plus informatifs aux indicateurs
  authIndicator.title = "État d'authentification";
  serverIndicator.title = "État de connexion au serveur";
  
  // Ajouter des gestionnaires de clic pour forcer une mise à jour
  authIndicator.addEventListener('click', () => {
    console.log('Demande de mise à jour du statut d\'authentification...');
    chrome.runtime.sendMessage({ action: 'checkAuthentication' });
  });
  
  serverIndicator.addEventListener('click', () => {
    console.log('Demande de mise à jour du statut du serveur...');
    chrome.runtime.sendMessage({ action: 'checkServerOnline' });
  });
}

/**
 * Remet les indicateurs à l'état déconnecté par défaut
 */
function resetIndicators() {
  if (authIndicator) {
    authIndicator.classList.remove('status-connected');
    authIndicator.classList.add('status-disconnected');
  }
  
  if (serverIndicator) {
    serverIndicator.classList.remove('status-connected');
    serverIndicator.classList.add('status-disconnected');
  }
}

/**
 * Met à jour l'indicateur d'authentification
 * @param {Object} status - Statut d'authentification
 */
function updateAuthIndicator(status) {
  if (!authIndicator) return;
  
  if (status && (status.isAuthenticated || status.authenticated)) {
    authIndicator.classList.remove('status-disconnected');
    authIndicator.classList.add('status-connected');
    authIndicator.title = "Authentifié";
  } else {
    authIndicator.classList.remove('status-connected');
    authIndicator.classList.add('status-disconnected');
    authIndicator.title = "Non authentifié";
  }
}

/**
 * Met à jour l'indicateur de connexion au serveur
 * @param {Object} status - Statut de connexion au serveur
 */
function updateServerIndicator(status) {
  if (!serverIndicator) return;
  
  if (status && status.isConnected) {
    serverIndicator.classList.remove('status-disconnected');
    serverIndicator.classList.add('status-connected');
    serverIndicator.title = "Serveur connecté";
  } else {
    serverIndicator.classList.remove('status-connected');
    serverIndicator.classList.add('status-disconnected');
    serverIndicator.title = "Serveur déconnecté";
  }
}

/**
 * Demande une mise à jour des statuts au background script
 */
function requestStatusUpdates() {
  // Demander le statut d'authentification
  chrome.runtime.sendMessage({ action: 'getAuthStatus' }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Erreur lors de la demande du statut d\'authentification:', chrome.runtime.lastError);
      return;
    }
    
    if (response) {
      updateAuthIndicator(response);
    }
  });
  
  // Demander le statut du serveur
  chrome.runtime.sendMessage({ action: 'getServerStatus' }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Erreur lors de la demande du statut du serveur:', chrome.runtime.lastError);
      return;
    }
    
    if (response) {
      updateServerIndicator(response);
    }
  });
}
