// FCA-Agent - Module de gestion des indicateurs de statut

let authIndicator;
let serverIndicator;

// Logger spécifique aux statuts
function statusLog(message, level = 'info') {
  const prefix = '[UI:STATUS]';
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

/**
 * Initialise les indicateurs de statut
 */
export function initStatusIndicators(authIndicatorElement, serverIndicatorElement) {
  statusLog(`Initialisation des indicateurs: auth=${!!authIndicatorElement}, server=${!!serverIndicatorElement}`);
  
  authIndicator = authIndicatorElement;
  serverIndicator = serverIndicatorElement;
  
  // S'assurer que les indicateurs sont rouges par défaut
  resetIndicators();
  
  // Surveiller les messages de mise à jour des statuts
  chrome.runtime.onMessage.addListener((message) => {
    statusLog(`Message reçu: ${JSON.stringify(message)}`);
    
    if (message.action === 'authStatusChanged') {
      statusLog(`Mise à jour du statut d'authentification: ${JSON.stringify(message.status)}`);
      updateAuthIndicator(message.status);
    } else if (message.action === 'serverStatusChanged') {
      statusLog(`Mise à jour du statut de serveur: ${JSON.stringify(message.status)}`);
      updateServerIndicator(message.status);
    }
  });
  
  // Rafraîchir les statuts au démarrage
  requestStatusUpdates();
  
  // Ajouter des tooltips plus informatifs aux indicateurs
  if (authIndicator) {
    authIndicator.title = "État d'authentification";
    
    // Ajouter un gestionnaire de clic pour forcer une mise à jour
    authIndicator.addEventListener('click', () => {
      statusLog('Demande manuelle de mise à jour du statut d\'authentification');
      
      chrome.runtime.sendMessage({ action: 'checkAuthentication' }, (response) => {
        if (chrome.runtime.lastError) {
          statusLog(`Erreur: ${chrome.runtime.lastError.message}`, 'error');
          return;
        }
        
        statusLog(`Réponse: ${JSON.stringify(response)}`);
        if (response) {
          updateAuthIndicator({ authenticated: response.authenticated });
        }
      });
    });
  }
  
  if (serverIndicator) {
    serverIndicator.title = "État de connexion au serveur";
    
    // Ajouter un gestionnaire de clic pour forcer une mise à jour
    serverIndicator.addEventListener('click', () => {
      statusLog('Demande manuelle de mise à jour du statut du serveur');
      
      chrome.runtime.sendMessage({ action: 'checkServerOnline' }, (response) => {
        if (chrome.runtime.lastError) {
          statusLog(`Erreur: ${chrome.runtime.lastError.message}`, 'error');
          return;
        }
        
        statusLog(`Réponse: ${JSON.stringify(response)}`);
        if (response) {
          updateServerIndicator(response);
        }
      });
    });
  }
}

/**
 * Remet les indicateurs à l'état déconnecté par défaut
 */
function resetIndicators() {
  statusLog('Réinitialisation des indicateurs');
  
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
 */
function updateAuthIndicator(status) {
  if (!authIndicator) {
    statusLog('Indicateur d\'authentification non défini', 'error');
    return;
  }
  
  statusLog(`Mise à jour de l'indicateur d'authentification: ${JSON.stringify(status)}`);
  
  // Méthode plus directe et fiable pour modifier les classes
  try {
    authIndicator.className = 'status-indicator';
    
    if (status && (status.isAuthenticated || status.authenticated)) {
      authIndicator.classList.add('status-connected');
      authIndicator.title = "Authentifié";
      statusLog('Indicateur d\'auth -> VERT');
    } else {
      authIndicator.classList.add('status-disconnected');
      authIndicator.title = "Non authentifié";
      statusLog('Indicateur d\'auth -> ROUGE');
    }
  } catch (error) {
    statusLog(`Erreur lors de la modification des classes: ${error.message}`, 'error');
  }
}

/**
 * Met à jour l'indicateur de connexion au serveur
 */
function updateServerIndicator(status) {
  if (!serverIndicator) {
    statusLog('Indicateur de serveur non défini', 'error');
    return;
  }
  
  statusLog(`Mise à jour de l'indicateur de serveur: ${JSON.stringify(status)}`);
  
  // Méthode plus directe et fiable pour modifier les classes
  try {
    serverIndicator.className = 'status-indicator';
    
    if (status && status.isConnected) {
      serverIndicator.classList.add('status-connected');
      serverIndicator.title = "Serveur connecté";
      statusLog('Indicateur de serveur -> VERT');
    } else {
      serverIndicator.classList.add('status-disconnected');
      serverIndicator.title = "Serveur déconnecté";
      statusLog('Indicateur de serveur -> ROUGE');
    }
  } catch (error) {
    statusLog(`Erreur lors de la modification des classes: ${error.message}`, 'error');
  }
}

/**
 * Demande une mise à jour des statuts au background script
 */
function requestStatusUpdates() {
  statusLog('Demande de mise à jour des statuts');
  
  // Demander l'état actuel d'authentification et de serveur en une seule requête
  chrome.runtime.sendMessage({ action: 'getAuthAndServerStatus' }, (response) => {
    if (chrome.runtime.lastError) {
      statusLog(`Erreur lors de la requête: ${chrome.runtime.lastError.message}`, 'error');
      return;
    }
    
    statusLog(`Réponse complète: ${JSON.stringify(response)}`);
    
    if (response) {
      // Mettre à jour les indicateurs avec les états actuels
      if (response.auth) {
        updateAuthIndicator(response.auth);
      }
      
      if (response.server) {
        updateServerIndicator(response.server);
      }
    }
  });
  
  // Ensuite, demander des vérifications fraîches qui déclencheront des mises à jour
  chrome.runtime.sendMessage({ action: 'checkAuthentication' });
  chrome.runtime.sendMessage({ action: 'checkServerOnline' });
}