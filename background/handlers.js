      case 'serverStatusChanged':
        // Gestion passive des notifications de changement d'état
        // Ce message est normalement utilisé pour la notification et n'attend pas de réponse
        handlerLog(`Action de notification serverStatusChanged reçue et acceptée silencieusement`);
        // On peut optionnellement envoyer une réponse vide pour éviter les warnings
        sendResponse({acknowledged: true});
        break;
        
      case 'authStatusChanged':
        // Gestion passive des notifications de changement d'état d'authentification
        handlerLog(`Action de notification authStatusChanged reçue et acceptée silencieusement`);
        // On peut optionnellement envoyer une réponse vide pour éviter les warnings
        sendResponse({acknowledged: true});
        break;// FCA-Agent - Module de gestion des messages

import { getApiUrl, setApiUrl } from './config.js';
import { getAuthStatus, loginToServer, logoutFromServer, checkAuthWithServer } from './auth.js';
import { getServerStatus, checkServerOnline, executeTaskOnServer, forceServerCheck } from './server.js';
import { handlerLog } from './handlers-logger.js';

// Gestionnaire principal de messages
export function setupMessageHandlers() {
  handlerLog('Configuration des gestionnaires de messages');
  
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const source = sender.tab ? 'content script' : 'popup';
    handlerLog(`Message reçu: action=${message.action}, de=${source}`);
    
    // Gestion des messages par type d'action
    switch (message.action) {
      case 'getStatus':
        handleGetStatus(sendResponse);
        break;
        
      case 'getAuthStatus':
        handlerLog(`getAuthStatus => ${JSON.stringify(getAuthStatus())}`);
        sendResponse(getAuthStatus());
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
        handleLogin(message.password, sendResponse);
        break;
        
      case 'logout':
        handleLogout(sendResponse);
        break;
        
      case 'checkAuthentication':
        handleCheckAuthentication(sendResponse);
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
        // Combine les deux statuts en une seule réponse
        const combinedStatus = {
          auth: getAuthStatus(),
          server: getServerStatus()
        };
        handlerLog(`getAuthAndServerStatus => ${JSON.stringify(combinedStatus)}`);
        sendResponse(combinedStatus);
        break;
        
      case 'serverStatusChanged':
        // Gestion passive des notifications de changement d'état
        // Ce message est normalement utilisé pour la notification et n'attend pas de réponse
        handlerLog(`Action de notification serverStatusChanged reçue et acceptée silencieusement`);
        // On peut optionnellement envoyer une réponse vide pour éviter les warnings
        sendResponse({acknowledged: true});
        break;
        
      case 'authStatusChanged':
        // Gestion passive des notifications de changement d'état d'authentification
        handlerLog(`Action de notification authStatusChanged reçue et acceptée silencieusement`);
        // On peut optionnellement envoyer une réponse vide pour éviter les warnings
        sendResponse({acknowledged: true});
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
    // Vérification du serveur
    const isOnline = await checkServerOnline();
    const authStatus = getAuthStatus();
    
    const response = { 
      status: isOnline ? 'connected' : 'disconnected',
      authenticated: authStatus.isAuthenticated
    };
    
    handlerLog(`handleGetStatus => ${JSON.stringify(response)}`);
    sendResponse(response);
  } catch (error) {
    handlerLog(`Erreur lors de la vérification du statut: ${error.message}`, 'error');
    sendResponse({ 
      status: 'disconnected', 
      authenticated: false,
      error: error.message 
    });
  }
}

async function handleExecuteTask(taskType, taskData, sendResponse) {
  handlerLog(`handleExecuteTask: type=${taskType}`);
  
  try {
    // Vérifier l'authentification pour les tâches sécurisées
    const requiresAuth = ['processUserInput', 'email-summary', 'teams-summary', 'draft-email'];
    const authStatus = getAuthStatus();
    
    if (requiresAuth.includes(taskType) && !authStatus.isAuthenticated) {
      handlerLog(`Tâche ${taskType} nécessite authentification mais non authentifié`, 'error');
      throw new Error('Authentification requise pour cette action');
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

async function handleLogin(password, sendResponse) {
  handlerLog(`handleLogin: tentative avec mot de passe ${password === 'debug' ? 'debug' : '********'}`);
  
  try {
    const loginResult = await loginToServer(password);
    handlerLog(`Résultat de la connexion: ${JSON.stringify(loginResult)}`);
    
    // Force une mise à jour du statut serveur après connexion réussie
    if (loginResult.success) {
      await forceServerCheck();
    }
    
    sendResponse(loginResult);
  } catch (error) {
    handlerLog(`Erreur lors de la connexion: ${error.message}`, 'error');
    sendResponse({ success: false, error: error.message || 'Erreur de connexion' });
  }
}

async function handleLogout(sendResponse) {
  handlerLog('handleLogout appelé');
  
  try {
    // Tentative de déconnexion du serveur
    try {
      await logoutFromServer();
      handlerLog('Déconnexion du serveur réussie');
    } catch (logoutError) {
      handlerLog(`Erreur lors de la déconnexion du serveur: ${logoutError.message}`, 'warn');
      // On continue malgré l'erreur car nous avons déjà supprimé les données locales
    }
    
    sendResponse({ success: true });
  } catch (error) {
    handlerLog(`Erreur lors de la déconnexion: ${error.message}`, 'error');
    sendResponse({ success: false, error: error.message });
  }
}

async function handleCheckAuthentication(sendResponse) {
  handlerLog('handleCheckAuthentication appelé');
  
  try {
    // Réponse immédiate basée sur l'état local
    const authStatus = getAuthStatus();
    handlerLog(`État local d'authentification: ${JSON.stringify(authStatus)}`);
    
    // Envoyer immédiatement la réponse basée sur l'état local
    sendResponse({ authenticated: authStatus.isAuthenticated });
    
    // Vérification optionnelle auprès du serveur en arrière-plan
    // (ne bloque pas la réponse)
    if (authStatus.isAuthenticated) {
      try {
        const serverAuthResult = await checkAuthWithServer();
        handlerLog(`Vérification serveur complétée: ${JSON.stringify(serverAuthResult)}`);
        
        // Si le serveur invalide l'authentification
        if (!serverAuthResult) {
          await import('./auth.js').then(authModule => {
            authModule.handleTokenInconsistency()
              .then(() => handlerLog('Récupération de token tentée'))
              .catch(recoveryError => {
                handlerLog(`Erreur de récupération de token: ${recoveryError.message}`, 'error');
              });
          });
        }
      } catch (error) {
        handlerLog(`Erreur lors de la vérification avec le serveur: ${error.message}`, 'warn');
        
        // Tenter une récupération d'urgence
        await import('./auth.js').then(authModule => {
          authModule.handleTokenInconsistency()
            .then(() => handlerLog('Récupération de token tentée'))
            .catch(recoveryError => {
              handlerLog(`Erreur de récupération de token: ${recoveryError.message}`, 'error');
            });
        });
      }
    }
  } catch (error) {
    handlerLog(`Erreur lors de la vérification d'authentification: ${error.message}`, 'error');
    sendResponse({ authenticated: false, error: error.message });
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
