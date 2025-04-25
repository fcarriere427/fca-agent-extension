// FCA-Agent - Module de gestion des messages

import { getApiUrl, setApiUrl } from './config.js';
import { getAuthStatus, loginToServer, logoutFromServer, checkAuthWithServer } from './auth.js';
import { getServerStatus, checkServerOnline, executeTaskOnServer } from './server.js';

// Gestionnaire principal de messages
export function setupMessageHandlers() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Message reçu dans le background script:', message, 'De:', sender.tab ? 'content script' : 'popup');
    
    // Gestion des messages par type d'action
    switch (message.action) {
      case 'getStatus':
        handleGetStatus(sendResponse);
        break;
        
      case 'getAuthStatus':
        sendResponse(getAuthStatus());
        break;
        
      case 'getServerStatus':
        sendResponse(getServerStatus());
        break;
      
      case 'checkServerOnline':
        handleCheckServerOnline(sendResponse);
        break;
        
      case 'executeTask':
        handleExecuteTask(message.task, message.data, sendResponse);
        break;
        
      case 'login':
        handleLogin(message.password, sendResponse);
        break;
        
      case 'logout':
        handleLogout(sendResponse);
        break;
        
      case 'checkAuthentication':
        handleCheckAuthentication(sendResponse);
        break;
        
      case 'checkServerConnection':
        handleCheckServerConnection(sendResponse);
        break;
        
      case 'updateApiUrl':
        setApiUrl(message.url);
        sendResponse({ success: true });
        break;
        
      case 'getApiUrl':
        sendResponse({ url: getApiUrl() });
        break;
        
      case 'getAuthAndServerStatus':
        // Combine les deux statuts en une seule réponse
        sendResponse({
          auth: getAuthStatus(),
          server: getServerStatus()
        });
        break;
        
      default:
        console.warn('Action non reconnue:', message.action);
        sendResponse({ success: false, error: 'Action non reconnue' });
    }
    
    return true; // Indique que la réponse sera envoyée de manière asynchrone
  });
}

// Fonctions de gestion des messages
async function handleGetStatus(sendResponse) {
  try {
    // Vérification du serveur
    const isOnline = await checkServerOnline();
    const authStatus = getAuthStatus();
    
    sendResponse({ 
      status: isOnline ? 'connected' : 'disconnected',
      authenticated: authStatus.isAuthenticated
    });
  } catch (error) {
    console.error('Erreur lors de la vérification du statut:', error);
    sendResponse({ 
      status: 'disconnected', 
      authenticated: false,
      error: error.message 
    });
  }
}

async function handleExecuteTask(taskType, taskData, sendResponse) {
  try {
    // Vérifier l'authentification pour les tâches sécurisées
    const requiresAuth = ['processUserInput', 'email-summary', 'teams-summary', 'draft-email'];
    const authStatus = getAuthStatus();
    
    if (requiresAuth.includes(taskType) && !authStatus.isAuthenticated) {
      throw new Error('Authentification requise pour cette action');
    }
    
    // Exécuter la tâche sur le serveur
    const result = await executeTaskOnServer(taskType, taskData);
    sendResponse({ success: true, result });
  } catch (error) {
    console.error('Erreur lors de l\'exécution de la tâche:', error);
    sendResponse({ success: false, error: error.message });
  }
}

async function handleLogin(password, sendResponse) {
  try {
    const loginResult = await loginToServer(password);
    sendResponse(loginResult);
  } catch (error) {
    console.error('Erreur lors de la connexion:', error);
    sendResponse({ success: false, error: error.message || 'Erreur de connexion' });
  }
}

async function handleLogout(sendResponse) {
  try {
    // Tentative de déconnexion du serveur (mais on poursuit même en cas d'échec)
    try {
      await logoutFromServer();
    } catch (logoutError) {
      console.warn('Erreur lors de la déconnexion du serveur:', logoutError);
      // On continue malgré l'erreur car nous avons déjà supprimé les données locales
    }
    
    sendResponse({ success: true });
  } catch (error) {
    console.error('Erreur lors de la déconnexion:', error);
    sendResponse({ success: false, error: error.message });
  }
}

async function handleCheckAuthentication(sendResponse) {
  try {
    // Réponse immédiate basée sur l'état local
    const authStatus = getAuthStatus();
    sendResponse({ authenticated: authStatus.isAuthenticated });
    
    // Vérification optionnelle auprès du serveur en arrière-plan
    // (ne bloque pas la réponse)
    checkAuthWithServer().catch(error => {
      console.warn('Erreur lors de la vérification d\'authentification avec le serveur:', error);
    });
  } catch (error) {
    console.error('Erreur lors de la vérification d\'authentification:', error);
    sendResponse({ authenticated: false, error: error.message });
  }
}

async function handleCheckServerConnection(sendResponse) {
  try {
    const isOnline = await checkServerOnline();
    sendResponse({ connected: isOnline });
  } catch (error) {
    console.error('Erreur lors de la vérification du serveur:', error);
    sendResponse({ connected: false, error: error.message });
  }
}

async function handleCheckServerOnline(sendResponse) {
  try {
    const isOnline = await checkServerOnline();
    sendResponse({ isConnected: isOnline });
  } catch (error) {
    console.error('Erreur lors de la vérification du serveur:', error);
    sendResponse({ isConnected: false, error: error.message });
  }
}
