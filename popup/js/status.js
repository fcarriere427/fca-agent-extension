// FCA-Agent - Module de gestion des indicateurs de statut

import { statusLog } from './status-logger.js';

// Un seul indicateur de serveur (l'ancien indicateur auth ne sera plus utilisé)
let serverIndicator;

/**
 * Initialise l'indicateur de statut
 */
export function initStatusIndicators(authIndicatorElement, serverIndicatorElement) {
  statusLog(`Initialisation de l'indicateur: server=${!!serverIndicatorElement}`);
  
  // On garde la référence à l'indicateur de serveur uniquement
  serverIndicator = serverIndicatorElement;
  
  // Si l'ancien indicateur auth est fourni, le cacher
  if (authIndicatorElement) {
    authIndicatorElement.style.display = 'none';
  }
  
  // S'assurer que l'indicateur est dans l'état "déconnecté" par défaut
  resetIndicators();
  
  // Mode proactif : vérification directe du statut serveur
  updateServerIndicator();
  
  // Surveiller les messages de mise à jour des statuts (mode réactif)
  chrome.runtime.onMessage.addListener((message) => {
    statusLog(`Message reçu: ${JSON.stringify(message)}`);
    
    if (message.action === 'serverStatusChanged') {
      statusLog(`Mise à jour du statut serveur: ${JSON.stringify(message.status)}`);
      updateServerIndicatorWithStatus(message.status);
    }
    // L'action 'authStatusChanged' n'est plus traitée car l'indicateur auth est supprimé
  });
  
  // Ajouter un tooltip et gestionnaire de clic pour l'indicateur
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
}

/**
 * Remet l'indicateur à l'état déconnecté par défaut
 */
function resetIndicators() {
  statusLog('Réinitialisation de l\'indicateur - Statut déconnecté (rouge) par défaut');
  
  if (serverIndicator) {
    // On force l'indicateur à être rouge dès le démarrage (par sécurité)
    serverIndicator.className = 'status-indicator status-disconnected';
    serverIndicator.title = "Vérification du statut du serveur...";
  }
}

/**
 * Met à jour l'indicateur serveur en interrogeant directement le background script
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
      if (status.authValid === true) {
        // Serveur connecté ET clé API valide (VERT)
        serverIndicator.classList.add('status-connected');
        serverIndicator.title = "Serveur connecté, clé API valide";
        statusLog('Indicateur de serveur -> VERT');
      } else if (status.authValid === false) {
        // Serveur connecté MAIS clé API invalide (ORANGE)
        serverIndicator.classList.add('status-warning');
        serverIndicator.title = "Serveur connecté, mais clé API invalide";
        statusLog('Indicateur de serveur -> ORANGE');
      } else {
        // Serveur connecté, mais statut de clé API inconnu (ROUGE par défaut pour être prudent)
        serverIndicator.classList.add('status-disconnected');
        serverIndicator.title = "Serveur connecté, statut d'authentification incertain";
        statusLog('Indicateur de serveur -> ROUGE (statut incertain)');
      }
    } else {
      // Serveur déconnecté (ROUGE)
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
