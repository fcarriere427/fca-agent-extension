// FCA-Agent - Module de communication avec le serveur

import { getApiUrl } from './config.js';
import { getAuthHeaders, setAuthenticated, getAuthStatus, checkAuthWithServer, resetAuthentication, setToken } from './auth.js';
import { serverLog } from './server-logger.js';

// État de connexion au serveur
let isServerConnected = false;

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

// Méthode pour récupérer le token de sauvegarde de manière sécurisée
async function getBackupToken() {
  return new Promise((resolve) => {
    chrome.storage.session.get(['authTokenBackup'], (result) => {
      const backupToken = result.authTokenBackup || null;
      serverLog(`Récupération du token de sauvegarde: ${backupToken ? 'Token trouvé' : 'Aucun token'}`, 'debug');
      resolve(backupToken);
    });
  });
}

// Vérifie si le serveur est en ligne
export async function checkServerOnline() {
  const apiUrl = getApiUrl();
  serverLog(`Vérification si le serveur est en ligne: ${apiUrl}/status`);
  
  try {
    // Récupérer les headers d'authentification de manière asynchrone
    let auth;
    try {
      auth = await getAuthHeaders();
    } catch (authError) {
      serverLog(`Erreur lors de la récupération des headers d'authentification: ${authError.message}`, 'error');
      auth = {}; // Utiliser un objet vide en cas d'erreur
    }
    
    serverLog(`Headers d'authentification: ${JSON.stringify(auth)}`, 'debug');
    
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
    
    // Ajouter un timeout pour éviter les attentes trop longues
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 secondes de timeout
    
    try {
      const response = await fetch(`${apiUrl}/status`, {
        method: 'GET',
        headers: headers,
        cache: 'no-cache', // IMPORTANT: Pas de cache
        credentials: 'omit',  // Ne plus utiliser les cookies
        signal: controller.signal // Ajouter le signal pour le timeout
      });
      
      // Annuler le timeout car la requête a réussi
      clearTimeout(timeoutId);
      
      serverLog(`Réponse du serveur: status=${response.status}`);
      
      // Si erreur 401 mais avec un token, c'est que le token est probablement expiré
      if (response.status === 401 && auth.Authorization) {
        serverLog('Erreur 401 avec token présent, possible token expiré ou invalide', 'warn');
        
        // Vérification de l'authentification
        try {
          await checkAuthWithServer();
        } catch (authCheckError) {
          serverLog(`Erreur lors de la vérification d'authentification: ${authCheckError.message}`, 'error');
        }
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
    } catch (fetchError) {
      // Annuler le timeout en cas d'erreur fetch
      clearTimeout(timeoutId);
      
      // Vérifier si l'erreur est due au timeout
      if (fetchError.name === 'AbortError') {
        serverLog('Timeout lors de la connexion au serveur', 'error');
      } else {
        serverLog(`Erreur réseau lors de la vérification: ${fetchError.message}`, 'error');
      }
      
      setServerStatus(false);
      return false;
    }
  } catch (error) {
    serverLog(`Exception générale lors de la vérification: ${error.message}`, 'error');
    setServerStatus(false);
    return false;
  }
}

// Force une vérification et une diffusion du statut
export async function forceServerCheck() {
  serverLog('Vérification forcée du statut serveur');
  
  try {
    // Récupérer le statut d'authentification avant de vérifier le serveur
    const authStatus = getAuthStatus();
    serverLog(`État d'authentification avant vérification: ${JSON.stringify(authStatus)}`);
    
    // Si on est supposé être authentifié mais qu'on n'a pas de token, tentative de récupération
    if (authStatus.isAuthenticated && !authStatus.hasToken) {
      serverLog('Incohérence détectée: authentifié sans token - récupération d\'urgence');
      try {
        await handleTokenInconsistency();
      } catch (recoveryError) {
        serverLog(`Erreur de récupération: ${recoveryError.message}`, 'error');
      }
    }
    
    // Vérification avec le serveur
    const isOnline = await checkServerOnline();
    serverLog(`Résultat de la vérification: serveur ${isOnline ? 'en ligne' : 'déconnecté'}`);
    
    // Diffuser à nouveau l'état, même s'il n'a pas changé
    const broadcastMessage = () => {
      chrome.runtime.sendMessage({ 
        action: 'serverStatusChanged', 
        status: { isConnected: isOnline } 
      }, () => {
        if (chrome.runtime.lastError) {
          // Ne pas traiter comme critique - normal au démarrage
          if (chrome.runtime.lastError.message.includes('Receiving end does not exist')) {
            serverLog('Aucun récepteur pour le message (normal si popup fermé)', 'warn');
          } else {
            serverLog(`Diffusion forcée non délivrée: ${chrome.runtime.lastError.message}`, 'warn');
          }
        } else {
          serverLog('Diffusion forcée délivrée avec succès');
        }
      });
    };
    
    // Appel immédiat puis second appel décalé pour augmenter les chances de réception
    broadcastMessage();
    setTimeout(broadcastMessage, 500); // Second envoi après 500ms
    
    // Sauvegarder le statut dans le stockage local comme mécanisme de secours
    chrome.storage.local.set({ 'serverStatus': { isConnected: isOnline } }, () => {
      if (chrome.runtime.lastError) {
        serverLog(`Impossible de sauvegarder le statut serveur: ${chrome.runtime.lastError.message}`, 'warn');
      } else {
        serverLog('Statut serveur sauvegardé dans le stockage local');
      }
    });
    
    return isOnline;
  } catch (error) {
    serverLog(`Erreur lors de la vérification forcée: ${error.message}`, 'error');
    
    // Journaliser la stack trace pour le débogage
    if (error.stack) {
      serverLog(`Stack trace: ${error.stack}`, 'debug');
    }
    
    // Tentative de récupération par la méthode standard
    try {
      serverLog('Tentative de récupération d\'urgence du token...');
      const backupToken = await getBackupToken();
      
      if (backupToken) {
        // Récupération avec le token de sauvegarde
        await setToken(backupToken);
        serverLog('Token récupéré depuis la sauvegarde', 'warn');
        
        // Attendre un court instant pour s'assurer que le token est défini
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Réessayer la vérification
        const retryOnline = await checkServerOnline();
        
        // Notification avancée avec tentative multiple
        const notifyRecovery = () => {
          chrome.runtime.sendMessage({ 
            action: 'serverStatusChanged', 
            status: { 
              isConnected: retryOnline, 
              recoveryAttempted: true 
            } 
          }, () => {
            if (chrome.runtime.lastError) {
              serverLog('Diffusion après récupération non délivrée', 'warn');
            }
          });
        };
        
        // Double tentative de notification
        notifyRecovery();
        setTimeout(notifyRecovery, 300);
        
        // Sauvegarder également dans le stockage
        chrome.storage.local.set({
          'serverStatus': { isConnected: retryOnline, recoveryAttempted: true }
        });
        
        return retryOnline;
      } else {
        // Pas de token de sauvegarde
        await resetAuthentication();
        serverLog('Aucun token de sauvegarde, réinitialisation', 'error');
        return false;
      }
    } catch (recoveryError) {
      serverLog(`Erreur complète de récupération: ${recoveryError.message}`, 'error');
      
      // Sauvegarder l'état déconnecté dans le stockage
      try {
        chrome.storage.local.set({ 'serverStatus': { isConnected: false, error: true } });
      } catch (e) { /* Ignorer */ }
      
      return false;
    }
  }
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
    const authStatus = getAuthStatus();
    if (authStatus.isAuthenticated) {
      serverLog('Incohérence: authentifié sans token disponible, tentative de récupération', 'warn');
      
      // Tenter une récupération d'urgence
      const backupToken = await getBackupToken();
      
      if (backupToken) {
        // Récupération manuelle depuis la sauvegarde
        await setToken(backupToken);
        serverLog('Token récupéré depuis la sauvegarde d\'urgence', 'warn');
      } else {
        // Pas de token de sauvegarde
        await resetAuthentication();
        serverLog('Aucun token de sauvegarde disponible, réinitialisation', 'error');
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
      
      // Déconnexion et notification
      await resetAuthentication();
      
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
