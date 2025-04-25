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
  
  // S'assurer que les indicateurs sont dans l'état "déconnecté" par défaut
  resetIndicators();
  
  // Mode proactif : vérification directe des statuts
  updateServerIndicator();
  updateAuthIndicator();
  
  // Surveiller les messages de mise à jour des statuts (mode réactif)
  chrome.runtime.onMessage.addListener((message) => {
    statusLog(`Message reçu: ${JSON.stringify(message)}`);
    
    if (message.action === 'authStatusChanged') {
      statusLog(`Mise à jour du statut d'authentification: ${JSON.stringify(message.status)}`);
      updateAuthIndicatorWithStatus(message.status);
    } else if (message.action === 'serverStatusChanged') {
      statusLog(`Mise à jour du statut de serveur: ${JSON.stringify(message.status)}`);
      updateServerIndicatorWithStatus(message.status);
    }
  });
  
  // Ajouter des tooltips et gestionnaires de clic pour les indicateurs
  if (authIndicator) {
    authIndicator.title = "État d'authentification (cliquer pour vérifier)";
    
    // Ajouter un gestionnaire de clic pour forcer une mise à jour
    authIndicator.addEventListener('click', (e) => {
      e.stopPropagation();
      statusLog('Demande manuelle de mise à jour du statut d\'authentification');
      updateAuthIndicator();
    });
  }
  
  if (serverIndicator) {
    serverIndicator.title = "État de connexion au serveur (cliquer pour vérifier)";
    
    // Ajouter un gestionnaire de clic pour forcer une mise à jour
    serverIndicator.addEventListener('click', (e) => {
      e.stopPropagation();
      statusLog('Demande manuelle de mise à jour du statut du serveur');
      updateServerIndicator();
    });
  }
  
  // Mettre en place une vérification périodique pour garantir des statuts à jour
  setInterval(updateServerIndicator, 30000); // Vérifier le serveur toutes les 30 secondes
  setInterval(updateAuthIndicator, 60000);   // Vérifier l'authentification toutes les 60 secondes
}

/**
 * Remet les indicateurs à l'état déconnecté par défaut
 */
function resetIndicators() {
  statusLog('Réinitialisation des indicateurs');
  
  if (authIndicator) {
    authIndicator.className = 'status-indicator status-disconnected';
  }
  
  if (serverIndicator) {
    serverIndicator.className = 'status-indicator status-disconnected';
  }
}

/**
 * Met à jour l'indicateur d'authentification en interrogeant directement le background script
 */
function updateAuthIndicator() {
  statusLog('Mise à jour directe de l\'indicateur d\'authentification');
  
  if (!authIndicator) {
    statusLog('Indicateur d\'authentification non défini', 'error');
    return;
  }
  
  chrome.runtime.sendMessage({ action: 'getAuthStatus' }, (response) => {
    if (chrome.runtime.lastError) {
      statusLog(`Erreur: ${chrome.runtime.lastError.message}`, 'error');
      return;
    }
    
    statusLog(`Réponse directe: ${JSON.stringify(response)}`);
    updateAuthIndicatorWithStatus(response);
  });
}

/**
 * Met à jour l'indicateur d'authentification avec un statut donné
 */
function updateAuthIndicatorWithStatus(status) {
  if (!authIndicator) {
    statusLog('Indicateur d\'authentification non défini', 'error');
    return;
  }
  
  statusLog(`Mise à jour de l'indicateur d'authentification: ${JSON.stringify(status)}`);
  
  // Méthode plus fiable pour modifier les classes
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
 * Met à jour l'indicateur de serveur en interrogeant directement le background script
 */
function updateServerIndicator() {
  statusLog('Mise à jour directe de l\'indicateur de serveur');
  
  if (!serverIndicator) {
    statusLog('Indicateur de serveur non défini', 'error');
    return;
  }
  
  chrome.runtime.sendMessage({ action: 'getServerStatus' }, (response) => {
    if (chrome.runtime.lastError) {
      statusLog(`Erreur: ${chrome.runtime.lastError.message}`, 'error');
      return;
    }
    
    statusLog(`Réponse directe: ${JSON.stringify(response)}`);
    updateServerIndicatorWithStatus(response);
  });
}

/**
 * Met à jour l'indicateur de serveur avec un statut donné
 */
function updateServerIndicatorWithStatus(status) {
  if (!serverIndicator) {
    statusLog('Indicateur de serveur non défini', 'error');
    return;
  }
  
  statusLog(`Mise à jour de l'indicateur de serveur: ${JSON.stringify(status)}`);
  
  // Méthode plus fiable pour modifier les classes
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
