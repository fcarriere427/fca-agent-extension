// FCA-Agent - Module de gestion des messages simplifié avec clé API fixe

import { getApiUrl, setApiUrl } from './config.js';
import { getAuthHeaders, isAuthConfigured } from './auth-headers.js';
import { getServerStatus, checkServerOnline, executeTaskOnServer, forceServerCheck } from './server-simplified.js';
import { handlerLog } from './handlers-logger.js';

// Gestionnaire principal de messages
export function setupMessageHandlers() {
  handlerLog('Configuration des gestionnaires de messages (version simplifiée)');
  
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const source = sender.tab ? 'content script' : 'popup';
    handlerLog(`Message reçu: action=${message.action}, de=${source}`);
    
    // Gestion des messages par type d'action
    switch (message.action) {
      case 'getStatus':
        handleGetStatus(sendResponse);
        break;
        
      case 'getAuthStatus':
        // Désormais, on réutilise simplement le statut du serveur pour éviter la duplication
        const serverStatus = getServerStatus();
        const authStatus = {
          isAuthenticated: serverStatus.authValid === true,
          serverStatus: serverStatus // Inclure le statut complet du serveur
        };
        handlerLog(`getAuthStatus => ${JSON.stringify(authStatus)}`);
        sendResponse(authStatus);
        break;
        
      case 'getServerStatus':
        handlerLog(`getServerStatus => ${JSON.stringify(getServerStatus())}`);
        sendResponse(getServerStatus());
        break;
      
      case 'checkServerOnline':
        handleCheckServerOnline(sendResponse);
        break;
        
      case 'forceServerCheck':
        handleForceServerCheck(sendResponse);
        break;
        
      case 'executeTask':
        handleExecuteTask(message.task, message.data, sendResponse);
        break;
        
      case 'login':
        // Simuler login pour rétrocompatibilité (clé API fixe, toujours authentifié)
        handlerLog(`Login automatique avec clé API fixe`);
        sendResponse({ 
          success: true, 
          message: 'Authentification réussie avec clé API fixe'
        });
        break;
        
      case 'logout':
        // Simuler logout pour rétrocompatibilité (ne fait rien)
        handlerLog(`Déconnexion simulée (n'a aucun effet avec une clé API fixe)`);
        sendResponse({ success: true, message: 'Déconnexion simulée' });
        break;
        
      case 'checkAuthentication':
        // Avec une clé API fixe, l'authentification est toujours valide
        handlerLog('Vérification d\'authentification (clé API fixe)');
        sendResponse({ authenticated: isAuthConfigured() });
        break;
        
      case 'updateApiUrl':
        handlerLog(`Mise à jour de l'URL API: ${message.url}`);
        setApiUrl(message.url);
        sendResponse({ success: true });
        break;
        
      case 'getApiUrl':
        const url = getApiUrl();
        handlerLog(`getApiUrl => ${url}`);
        sendResponse({ url });
        break;
        
      case 'getAuthAndServerStatus':
        // Renvoyer simplement le statut complet du serveur qui inclut désormais l'authentification
        const fullServerStatus = getServerStatus();
        handlerLog(`getAuthAndServerStatus => ${JSON.stringify(fullServerStatus)}`);
        sendResponse(fullServerStatus);
        break;
        
      default:
        handlerLog(`Action non reconnue: ${message.action}`, 'warn');
        sendResponse({ success: false, error: 'Action non reconnue' });
    }
    
    return true; // Indique que la réponse sera envoyée de manière asynchrone
  });
}

// Fonctions de gestion des messages
async function handleGetStatus(sendResponse) {
  handlerLog('handleGetStatus appelé');
  
  try {
    // Vérification complète du serveur et de la clé API
    await checkServerOnline();
    
    // Récupérer le statut complet du serveur
    const fullStatus = getServerStatus();
    
    // Formater la réponse pour la compatibilité avec l'ancien format
    const response = { 
      status: fullStatus.isConnected ? 'connected' : 'disconnected',
      authenticated: fullStatus.authValid === true,
      authValid: fullStatus.authValid,  // Ajouter nouvelle propriété
      statusCode: fullStatus.statusCode,  // Ajouter code de statut
      lastCheck: fullStatus.lastCheck  // Ajouter timestamp
    };
    
    handlerLog(`handleGetStatus => ${JSON.stringify(response)}`);
    sendResponse(response);
  } catch (error) {
    handlerLog(`Erreur lors de la vérification du statut: ${error.message}`, 'error');
    sendResponse({ 
      status: 'disconnected', 
      authenticated: false,
      authValid: null,
      error: error.message 
    });
  }
}

async function handleExecuteTask(taskType, taskData, sendResponse) {
  handlerLog(`handleExecuteTask: type=${taskType}`);
  
  try {
    // Vérifier si la clé API est configurée (comme authentification simplifiée)
    if (!isAuthConfigured()) {
      handlerLog(`Tâche ${taskType} impossible: clé API non configurée`, 'error');
      throw new Error('Clé API non configurée');
    }
    
    // Exécuter la tâche sur le serveur
    handlerLog(`Exécution de la tâche ${taskType} sur le serveur...`);
    const result = await executeTaskOnServer(taskType, taskData);
    handlerLog(`Tâche ${taskType} exécutée avec succès`);
    sendResponse({ success: true, result });
  } catch (error) {
    handlerLog(`Erreur lors de l'exécution de la tâche ${taskType}: ${error.message}`, 'error');
    sendResponse({ success: false, error: error.message });
  }
}

async function handleCheckServerOnline(sendResponse) {
  handlerLog('handleCheckServerOnline appelé');
  
  try {
    const isOnline = await checkServerOnline();
    handlerLog(`Serveur en ligne: ${isOnline}`);
    sendResponse({ isConnected: isOnline });
  } catch (error) {
    handlerLog(`Erreur lors de la vérification du serveur: ${error.message}`, 'error');
    sendResponse({ isConnected: false, error: error.message });
  }
}

async function handleForceServerCheck(sendResponse) {
  handlerLog('handleForceServerCheck appelé');
  
  try {
    const isOnline = await forceServerCheck();
    handlerLog(`Force check: Serveur en ligne: ${isOnline}`);
    sendResponse({ isConnected: isOnline, forced: true });
  } catch (error) {
    handlerLog(`Erreur lors de la vérification forcée: ${error.message}`, 'error');
    sendResponse({ isConnected: false, error: error.message });
  }
}
