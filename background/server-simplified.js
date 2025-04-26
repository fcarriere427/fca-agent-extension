// FCA-Agent - Module de communication avec le serveur (version simplifiée avec clé API fixe)

import { getApiUrl } from './config.js';
import { getAuthHeaders, isAuthConfigured } from './auth-headers.js';
import { serverLog } from './server-logger.js';

// État du serveur - inclut connexion et authentification
let serverStatus = {
  isConnected: false,  // Serveur accessible (par défaut: non connecté)
  authValid: null,     // Clé API valide (null si inconnu)
  statusCode: null,    // Code HTTP pour diagnostic
  lastCheck: null,     // Horodatage de la dernière vérification
  timeout: false       // Indique si la dernière requête a expiré
};

// Méthodes d'accès à l'état du serveur
export function getServerStatus() {
  serverLog(`getServerStatus() => ${JSON.stringify(serverStatus)}`);
  return { ...serverStatus };
}

// Mise à jour de l'état du serveur
export function setServerStatus(newStatus) {
  // Créer une copie de l'ancien statut pour la comparaison
  const previousStatus = { ...serverStatus };
  
  // Mettre à jour les champs fournis et l'horodatage
  serverStatus = {
    ...serverStatus,
    ...newStatus,
    lastCheck: Date.now()
  };
  
  serverLog(`setServerStatus() - Ancien: ${JSON.stringify(previousStatus)}, Nouveau: ${JSON.stringify(serverStatus)}`);
  
  // Vérifier s'il y a eu un changement significatif
  const hasChanged = (
    // Changement d'état de connexion
    previousStatus.isConnected !== serverStatus.isConnected ||
    // Changement de validité d'authentification seulement s'il est définitif (true/false mais pas null)
    ((previousStatus.authValid !== serverStatus.authValid) && 
      (serverStatus.authValid !== null || previousStatus.authValid !== null)) ||
    // Changement de code de statut
    previousStatus.statusCode !== serverStatus.statusCode ||
    // Changement dans l'état d'erreur ou de timeout
    (serverStatus.error !== previousStatus.error) ||
    (serverStatus.timeout !== previousStatus.timeout)
  );
  
  // Si changement de statut, notifier les composants
  if (hasChanged) {
    serverLog(`Diffusion du changement de statut: ${JSON.stringify(serverStatus)}`);
    
    try {
      chrome.runtime.sendMessage({ 
        action: 'serverStatusChanged', 
        status: { ...serverStatus }
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

// Vérifie si le serveur est en ligne et si la clé API est valide
export async function checkServerOnline() {
  const apiUrl = getApiUrl();
  serverLog(`Vérification du serveur et de la clé API: ${apiUrl}/status`);
  
  try {
    // Récupérer les headers d'authentification (avec la clé API fixe)
    const headers = { 
      'Content-Type': 'application/json',
      ...getAuthHeaders()  // Inclure la clé API
    };
    
    serverLog(`Headers pour vérification: ${JSON.stringify(headers)}`, 'debug');
    
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
      
      // Mettre à jour le statut en fonction du code de réponse
      if (response.ok) {
        // Code 200: Serveur en ligne et clé API valide
        serverLog('Serveur connecté avec clé API valide');
        setServerStatus({
          isConnected: true,
          authValid: true,
          statusCode: response.status
        });
        return true;
      } else if (response.status === 401 || response.status === 403) {
        // Codes 401/403: Serveur en ligne mais clé API invalide
        serverLog('Serveur connecté mais clé API invalide ou non acceptée');
        setServerStatus({
          isConnected: true,
          authValid: false,
          statusCode: response.status
        });
        return true; // Le serveur est en ligne même si auth échouée
      } else {
        // Autre code d'erreur: problème avec le serveur
        serverLog(`Serveur accessible mais code d'erreur inattendu: ${response.status}`);
        setServerStatus({
          isConnected: true,
          authValid: null, // Inconnu
          statusCode: response.status
        });
        return true;
      }
    } catch (fetchError) {
      // Annuler le timeout en cas d'erreur fetch
      clearTimeout(timeoutId);
      
      // Vérifier si l'erreur est due au timeout
      if (fetchError.name === 'AbortError') {
        serverLog('Timeout lors de la connexion au serveur', 'error');
        // Marquer explicitement le timeout
        setServerStatus({
          isConnected: false,
          authValid: null,
          statusCode: null,
          timeout: true
        });
      } else {
        serverLog(`Erreur réseau lors de la vérification: ${fetchError.message}`, 'error');
        // Erreur réseau générique
        setServerStatus({
          isConnected: false,
          authValid: null,
          statusCode: null,
          timeout: false
        });
      }
      return false;
    }
  } catch (error) {
    serverLog(`Exception générale lors de la vérification: ${error.message}`, 'error');
    setServerStatus({
      isConnected: false,
      authValid: null,
      statusCode: null,
      error: true,  // Marquer qu'il y a eu une erreur
      timeout: false
    });
    return false;
  }
}

// Force une vérification et une diffusion du statut du serveur
export async function forceServerCheck() {
  serverLog('Vérification forcée du statut serveur et de la clé API');
  
  try {
    // Vérification complète avec le serveur (clé API fixe)
    const isReachable = await checkServerOnline();
    
    // Journaliser le résultat détaillé
    if (isReachable) {
      if (serverStatus.authValid === true) {
        serverLog('Serveur en ligne avec clé API valide');
      } else if (serverStatus.authValid === false) {
        serverLog('Serveur en ligne mais clé API invalide', 'warn');
      } else {
        serverLog(`Serveur en ligne avec statut d'authentification inconnu: ${serverStatus.statusCode}`);
      }
    } else {
      serverLog('Serveur déconnecté ou inaccessible', 'error');
    }
    
    // Diffuser à nouveau l'état complet, même s'il n'a pas changé
    const broadcastMessage = () => {
      chrome.runtime.sendMessage({ 
        action: 'serverStatusChanged', 
        status: { ...serverStatus }
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
    
    // Sauvegarder le statut complet dans le stockage local comme mécanisme de secours
    chrome.storage.local.set({ 'serverStatus': { ...serverStatus } }, () => {
      if (chrome.runtime.lastError) {
        serverLog(`Impossible de sauvegarder le statut serveur: ${chrome.runtime.lastError.message}`, 'warn');
      } else {
        serverLog('Statut serveur sauvegardé dans le stockage local');
      }
    });
    
    return isReachable;
  } catch (error) {
    serverLog(`Erreur lors de la vérification forcée: ${error.message}`, 'error');
    
    // Sauvegarder l'état déconnecté dans le stockage
    try {
      chrome.storage.local.set({ 'serverStatus': { 
        isConnected: false, 
        authValid: null, 
        statusCode: null,
        error: true,
        lastCheck: Date.now() 
      }});
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
    
    // Le serveur a répondu, mettre à jour son statut en fonction du code de réponse
    serverLog(`Réponse du serveur: status=${response.status}`);
    
    if (response.ok) {
      // Serveur connecté avec authentification valide
      setServerStatus({
        isConnected: true,
        authValid: true,
        statusCode: response.status
      });
    } else if (response.status === 401 || response.status === 403) {
      // Authentification échouée (clé API invalide)
      serverLog('Authentification échouée - clé API invalide ou non acceptée', 'error');
      setServerStatus({
        isConnected: true,
        authValid: false,
        statusCode: response.status
      });
      throw new Error('Clé API invalide ou non acceptée par le serveur');
    } else {
      // Autre code d'erreur
      setServerStatus({
        isConnected: true,
        authValid: null,
        statusCode: response.status
      });
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
      setServerStatus({
        isConnected: false,
        authValid: null,
        statusCode: null,
        error: true,
        timeout: error.message.includes('timeout') || error.message.includes('Timeout')
      });
    }
    
    throw error;
  }
}
