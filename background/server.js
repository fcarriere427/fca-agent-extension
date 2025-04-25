// FCA-Agent - Module de communication avec le serveur

import { getApiUrl } from './config.js';
import { getAuthHeaders, setAuthenticated } from './auth.js';

// État de connexion au serveur
let isServerConnected = false;

// Logger spécifique au module serveur
function serverLog(message, level = 'info') {
  const prefix = '[EXT:SERVER]';
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

// Méthodes d'accès à l'état de connexion
export function getServerStatus() {
  serverLog(`getServerStatus() => isConnected=${isServerConnected}`);
  return { isConnected: isServerConnected };
}

// Mise à jour de l'état de connexion
export function setServerStatus(status) {
  const previousStatus = isServerConnected;
  isServerConnected = status;
  
  serverLog(`setServerStatus(${status}) - Précédent: ${previousStatus}`);
  
  // Si changement de statut, notifier les composants
  if (previousStatus !== isServerConnected) {
    serverLog(`Diffusion du changement de statut: ${isServerConnected}`);
    
    try {
      chrome.runtime.sendMessage({ 
        action: 'serverStatusChanged', 
        status: { isConnected: isServerConnected } 
      }, () => {
        // Ignorer toute erreur (comme "Receiving end does not exist")
        if (chrome.runtime.lastError) {
          serverLog('Message serverStatusChanged non délivré (normal au démarrage)', 'warn');
        }
      });
    } catch (error) {
      serverLog(`Erreur lors de la diffusion du statut: ${error.message}`, 'error');
    }
  }
}

// Vérifie si le serveur est en ligne
export async function checkServerOnline() {
  const apiUrl = getApiUrl();
  serverLog(`Vérification si le serveur est en ligne: ${apiUrl}/status`);
  
  try {
    // Utiliser une requête simple pour vérifier si le serveur est en ligne
    const response = await fetch(`${apiUrl}/status`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-cache', // IMPORTANT: Pas de cache
      credentials: 'include' // Inclure les cookies pour la vérification d'auth
    });
    
    serverLog(`Réponse du serveur: status=${response.status}`);
    
    // Si on reçoit une réponse, le serveur est en ligne
    const isOnline = response.ok || response.status === 304;
    setServerStatus(isOnline);
    
    // Si authentification OK, on considère que le serveur est en ligne
    if (response.status === 401) {
      serverLog('Serveur en ligne mais authentification requise');
      setServerStatus(true); // Le serveur est en ligne même si auth échouée
    }
    
    return isOnline;
  } catch (error) {
    serverLog(`Erreur lors de la vérification: ${error.message}`, 'error');
    setServerStatus(false);
    return false;
  }
}

// Force une vérification et une diffusion du statut
export async function forceServerCheck() {
  serverLog('Vérification forcée du statut serveur');
  const isOnline = await checkServerOnline();
  
  // Diffuser à nouveau l'état, même s'il n'a pas changé
  chrome.runtime.sendMessage({ 
    action: 'serverStatusChanged', 
    status: { isConnected: isOnline } 
  }, () => {
    if (chrome.runtime.lastError) {
      serverLog('Diffusion forcée non délivrée', 'warn');
    }
  });
  
  return isOnline;
}

// Exécute une tâche sur le serveur
export async function executeTaskOnServer(taskType, taskData) {
  const apiUrl = getApiUrl();
  const authHeaders = getAuthHeaders();
  
  serverLog(`Exécution de la tâche ${taskType} sur le serveur: ${apiUrl}/tasks`);
  
  try {
    const response = await fetch(`${apiUrl}/tasks`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        ...authHeaders
      },
      body: JSON.stringify({ type: taskType, data: taskData }),
      credentials: 'include'
    });
    
    // Si le serveur répond, c'est qu'il est connecté
    setServerStatus(true);
    
    serverLog(`Réponse du serveur: status=${response.status}`);
    
    if (response.status === 401) {
      // Authentification expirée
      serverLog('Authentification expirée, déconnexion forcée', 'warn');
      setAuthenticated(false);
      throw new Error('Session expirée, veuillez vous reconnecter');
    }
    
    if (!response.ok) {
      throw new Error(`Erreur API: ${response.status}`);
    }
    
    const result = await response.json();
    serverLog('Tâche exécutée avec succès');
    return result;
  } catch (error) {
    serverLog(`Erreur lors de l'exécution de la tâche: ${error.message}`, 'error');
    
    // Si erreur de connexion, marquer le serveur comme déconnecté
    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      serverLog('Erreur de connexion détectée, serveur marqué comme déconnecté', 'warn');
      setServerStatus(false);
    }
    
    throw error;
  }
}
