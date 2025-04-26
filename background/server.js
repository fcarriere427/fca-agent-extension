// FCA-Agent - Module de communication avec le serveur

import { getApiUrl } from './config.js';
import { getAuthHeaders, setAuthenticated } from './auth.js';

// État de connexion au serveur
let isServerConnected = false;

// Logger spécifique au module serveur avec améliorations
function serverLog(message, level = 'info') {
  const prefix = '[EXT:SERVER]';
  const isDebug = true; // Activer pour plus de détails
  
  // Ajouter un timestamp pour faciliter le suivi
  const now = new Date();
  const timestamp = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}`;
  
  switch(level) {
    case 'error':
      console.error(`${prefix} [${timestamp}] ${message}`);
      break;
    case 'warn':
      console.warn(`${prefix} [${timestamp}] ${message}`);
      break;
    case 'debug':
      if (isDebug) {
        console.debug(`${prefix} [${timestamp}] DEBUG: ${message}`);
      }
      break;
    default:
      console.log(`${prefix} [${timestamp}] ${message}`);
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
  const auth = getAuthHeaders();
  serverLog(`Vérification si le serveur est en ligne: ${apiUrl}/status`);
  serverLog(`Headers d'authentification: ${JSON.stringify(auth)}`, 'debug');
  
  try {
    // Vérification que l'authentification est marquée comme active si un token est présent
    if (auth.Authorization && !isServerConnected) {
      serverLog('Token présent mais statut serveur déconnecté, possible incohérence', 'warn');
    }
    
    // Utiliser une requête simple pour vérifier si le serveur est en ligne
    // IMPORTANT: Utiliser les headers d'authentification si disponibles
    const headers = { 
      'Content-Type': 'application/json',
      ...auth  // Inclure les headers d'authentification si présents
    };
    
    serverLog(`Headers complets pour vérification serveur: ${JSON.stringify(headers)}`, 'debug');
    
    const response = await fetch(`${apiUrl}/status`, {
      method: 'GET',
      headers: headers,
      cache: 'no-cache', // IMPORTANT: Pas de cache
      credentials: 'omit'  // Ne plus utiliser les cookies
    });
    
    serverLog(`Réponse du serveur: status=${response.status}`);
    
    // Tenter de lire le corps de la réponse pour le débogage
    let responseText = '';
    let responseData = null;
    try {
      responseData = await response.json();
      responseText = JSON.stringify(responseData);
      serverLog(`Corps de la réponse: ${responseText}`, 'debug');
    } catch (e) {
      // Ignorer les erreurs de parsing
      serverLog('Pas de contenu JSON dans la réponse', 'debug');
    }
    
    // Si erreur 401 mais avec un token, c'est que le token est probablement expiré
    if (response.status === 401 && auth.Authorization) {
      serverLog('Erreur 401 avec token présent, possible token expiré ou invalide', 'warn');
      
      // Notifier le module d'auth pour vérification
      import('./auth.js').then(authModule => {
        authModule.checkAuthWithServer().catch(() => {});
      });
    }
    
    // Si on reçoit une réponse, le serveur est en ligne
    const isOnline = response.ok || response.status === 304;
    setServerStatus(isOnline);
    
    // Si authentification requise, on considère que le serveur est en ligne
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
  serverLog(`Headers d'authentification: ${JSON.stringify(authHeaders)}`, 'debug');
  
  // Vérifier explicitement si des headers d'auth sont présents pour des tâches protégées
  const securedTasks = ['processUserInput', 'email-summary', 'teams-summary', 'draft-email'];
  if (securedTasks.includes(taskType) && !authHeaders.Authorization) {
    serverLog('ERREUR CRITIQUE: Tentative d\'exécution de tâche sécurisée sans token!', 'error');
    
    // Vérifier si l'authentification est marquée comme active mais sans token
    const authModule = await import('./auth.js');
    if (authModule.getAuthStatus().isAuthenticated) {
      serverLog('Incohérence: authentifié sans token disponible, tentative de récupération', 'warn');
      
      // Tenter une récupération d'urgence
      try {
        const backupToken = window.sessionStorage.getItem('authTokenBackup');
        if (backupToken) {
          // Récupération manuelle depuis la sauvegarde
          authModule.setToken(backupToken);
          serverLog('Token récupéré depuis la sauvegarde d\'urgence', 'warn');
        } else {
          throw new Error('Aucun token de sauvegarde disponible');
        }
      } catch (e) {
        serverLog(`Impossible de récupérer un token: ${e.message}`, 'error');
        throw new Error('Authentification requise pour cette action');
      }
    } else {
      throw new Error('Authentification requise pour cette action');
    }
  }
  
  try {
    // Récupérer les headers à nouveau au cas où ils auraient été mis à jour
    const headers = {
      'Content-Type': 'application/json',
      ...getAuthHeaders() // Utiliser getAuthHeaders() directement pour obtenir la dernière version
    };
    
    serverLog(`Headers complets pour requête: ${JSON.stringify(headers)}`, 'debug');
    
    const response = await fetch(`${apiUrl}/tasks`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ type: taskType, data: taskData }),
      credentials: 'omit' // Utiliser uniquement les tokens, pas les cookies
    });
    
    // Si le serveur répond, c'est qu'il est connecté
    setServerStatus(true);
    
    serverLog(`Réponse du serveur: status=${response.status}`);
    
    if (response.status === 401) {
      // Authentification échouée ou token manquant/invalide
      serverLog('Authentification échouée, déconnexion forcée', 'warn');
      
      // Utiliser import() pour éviter les dépendances circulaires
      const authModule = await import('./auth.js');
      authModule.resetAuthentication();
      
      throw new Error('Session expirée ou invalide, veuillez vous reconnecter');
    }
    
    if (!response.ok) {
      let errorMessage = `Erreur API: ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage += ` - ${JSON.stringify(errorData)}`;
        serverLog(`Détails de l'erreur: ${errorMessage}`, 'error');
      } catch (e) {
        // Ignorer les erreurs de parsing
      }
      throw new Error(errorMessage);
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
