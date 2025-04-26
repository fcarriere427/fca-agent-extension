// FCA-Agent - Module de communication avec le serveur (version simplifiée avec clé API fixe)

import { getApiUrl } from './config.js';
import { getAuthHeaders, isAuthConfigured } from './auth-headers.js';
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

// Vérifie si le serveur est en ligne
export async function checkServerOnline() {
  const apiUrl = getApiUrl();
  serverLog(`Vérification si le serveur est en ligne: ${apiUrl}/status`);
  
  try {
    // Récupérer les headers d'authentification (avec la clé API fixe)
    const headers = { 
      'Content-Type': 'application/json',
      ...getAuthHeaders()  // Inclure la clé API
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
    // Vérification simple avec le serveur (clé API fixe)
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
          serverLog('Message serverStatusChanged non délivré (normal au démarrage)', 'warn');
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
    
    // Sauvegarder l'état déconnecté dans le stockage
    try {
      chrome.storage.local.set({ 'serverStatus': { isConnected: false, error: true } });
    } catch (e) { /* Ignorer */ }
    
    return false;
  }
}

// Exécute une tâche sur le serveur
export async function executeTaskOnServer(taskType, taskData) {
  const apiUrl = getApiUrl();
  serverLog(`Exécution de la tâche ${taskType} sur le serveur: ${apiUrl}/tasks`);
  
  // Vérifier que la clé API est configurée
  if (!isAuthConfigured()) {
    serverLog('ERREUR: Clé API non configurée', 'error');
    throw new Error('Clé API non configurée pour cette action');
  }
  
  try {
    // Utiliser la clé API pour l'authentification
    const headers = {
      'Content-Type': 'application/json',
      ...getAuthHeaders() // Inclure la clé API dans les en-têtes
    };
    
    serverLog(`Headers complets pour requête: ${JSON.stringify(headers)}`, 'debug');
    
    const response = await fetch(`${apiUrl}/tasks`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ type: taskType, data: taskData }),
      credentials: 'omit' // Ne pas utiliser de cookies
    });
    
    // Si le serveur répond, c'est qu'il est connecté
    setServerStatus(true);
    
    serverLog(`Réponse du serveur: status=${response.status}`);
    
    if (response.status === 401) {
      // Authentification échouée (clé API invalide)
      serverLog('Authentification échouée - clé API invalide ou non acceptée', 'error');
      throw new Error('Clé API invalide ou non acceptée par le serveur');
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
