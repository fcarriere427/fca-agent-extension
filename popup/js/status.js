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
  
  // Forcer une vérification immédiate
  requestStatusUpdates();
  
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
  
  // Ajouter des tooltips plus informatifs aux indicateurs
  if (authIndicator) {
    authIndicator.title = "État d'authentification (cliquer pour vérifier)";
    
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
    serverIndicator.title = "État de connexion au serveur (cliquer pour vérifier)";
    
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
  
  // Mettre en place une vérification périodique pour s'assurer que les indicateurs sont à jour
  setInterval(() => {
    statusLog('Vérification périodique des statuts');
    requestStatusUpdates();
  }, 10000); // Vérifier toutes les 10 secondes
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
  
  // Méthode plus directe pour modifier les classes
  try {
    // IMPORTANT: Reset complet des classes
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
    
    // Vérifier que les styles sont appliqués
    statusLog(`Classes finales: ${authIndicator.className}`);
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
  
  // Méthode plus directe pour modifier les classes
  try {
    // IMPORTANT: Reset complet des classes
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
    
    // Vérifier que les styles sont appliqués
    statusLog(`Classes finales: ${serverIndicator.className}`);
  } catch (error) {
    statusLog(`Erreur lors de la modification des classes: ${error.message}`, 'error');
  }
}

/**
 * Demande une mise à jour des statuts au background script
 */
function requestStatusUpdates() {
  statusLog('Demande de mise à jour des statuts');
  
  // VÉRIFICATION COMPLÈTE DU SERVEUR D'ABORD
  chrome.runtime.sendMessage({ action: 'checkServerOnline' }, (response) => {
    if (chrome.runtime.lastError) {
      statusLog(`Erreur lors de la vérification du serveur: ${chrome.runtime.lastError.message}`, 'error');
      return;
    }
    
    statusLog(`Statut serveur: ${JSON.stringify(response)}`);
    // Mise à jour immédiate de l'indicateur
    if (response) {
      updateServerIndicator(response);
    }
    
    // PUIS VÉRIFICATION DE L'AUTHENTIFICATION
    chrome.runtime.sendMessage({ action: 'checkAuthentication' }, (authResponse) => {
      if (chrome.runtime.lastError) {
        statusLog(`Erreur lors de la vérification d'auth: ${chrome.runtime.lastError.message}`, 'error');
        return;
      }
      
      statusLog(`Statut authentification: ${JSON.stringify(authResponse)}`);
      // Mise à jour immédiate de l'indicateur
      if (authResponse) {
        updateAuthIndicator({ authenticated: authResponse.authenticated });
      }
    });
  });
}