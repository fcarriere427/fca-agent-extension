// FCA-Agent - Background Service Worker (version simplifiée et robuste)

// Configuration et état
let API_BASE_URL = 'http://fca-agent.letsq.xyz/api'; 
let authToken = null;
let isAuthenticated = false;

// Chargement initial de l'état d'authentification depuis le stockage local
chrome.storage.local.get(['authToken', 'apiBaseUrl'], (result) => {
  if (result.authToken) {
    authToken = result.authToken;
    isAuthenticated = true;
    console.log('Session authentifiée chargée depuis le stockage local');
  }
  
  if (result.apiBaseUrl) {
    API_BASE_URL = result.apiBaseUrl;
    console.log('URL API chargée:', API_BASE_URL);
  }
});

// Gestionnaire de messages depuis le popup ou les content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Message reçu dans le background script:', message, 'De:', sender.tab ? 'content script' : 'popup');
  
  // Gestion des messages par type d'action
  switch (message.action) {
    case 'getStatus':
      handleGetStatus(sendResponse);
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
      API_BASE_URL = message.url;
      chrome.storage.local.set({ 'apiBaseUrl': API_BASE_URL });
      sendResponse({ success: true });
      break;
      
    case 'getApiUrl':
      sendResponse({ url: API_BASE_URL });
      break;
      
    case 'authenticationUpdated':
      isAuthenticated = message.authenticated;
      if (isAuthenticated) {
        authToken = 'auth_token_' + Date.now(); // Token simplifié
        chrome.storage.local.set({ 'authToken': authToken });
      } else {
        chrome.storage.local.remove('authToken');
      }
      sendResponse({ success: true });
      break;
      
    default:
      console.warn('Action non reconnue:', message.action);
      sendResponse({ success: false, error: 'Action non reconnue' });
  }
  
  return true; // Indique que la réponse sera envoyée de manière asynchrone
});

// Fonctions de gestion des messages
async function handleGetStatus(sendResponse) {
  try {
    // Vérification simplifiée - juste un ping au serveur
    const isOnline = await checkServerOnline();
    sendResponse({ status: isOnline ? 'connected' : 'disconnected' });
  } catch (error) {
    console.error('Erreur lors de la vérification du statut:', error);
    sendResponse({ status: 'disconnected', error: error.message });
  }
}

async function handleExecuteTask(taskType, taskData, sendResponse) {
  try {
    // Vérifier l'authentification pour les tâches sécurisées
    const requiresAuth = ['processUserInput', 'email-summary', 'teams-summary', 'draft-email'];
    
    if (requiresAuth.includes(taskType) && !isAuthenticated) {
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
    
    if (loginResult.success) {
      // Enregistrement de l'authentification réussie
      isAuthenticated = true;
      authToken = loginResult.token || 'auth_token_' + Date.now();
      chrome.storage.local.set({ 'authToken': authToken });
    }
    
    sendResponse(loginResult);
  } catch (error) {
    console.error('Erreur lors de la connexion:', error);
    sendResponse({ success: false, error: error.message || 'Erreur de connexion' });
  }
}

async function handleLogout(sendResponse) {
  try {
    // Suppression locale des données d'authentification
    isAuthenticated = false;
    authToken = null;
    chrome.storage.local.remove('authToken');
    
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
    sendResponse({ authenticated: isAuthenticated });
    
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

// Fonctions d'interaction avec le serveur

// Vérifie si le serveur est en ligne
async function checkServerOnline() {
  try {
    // Utiliser une requête simple pour vérifier si le serveur est en ligne
    const response = await fetch(`${API_BASE_URL}/status`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      // Pas de credentials ici pour simplifier
      mode: 'no-cors' // Contournement CORS pour un simple test de connectivité
    });
    
    // Mode no-cors retourne toujours un statut opaque, donc on assume que le serveur est en ligne
    // si la requête ne génère pas d'exception
    return true;
  } catch (error) {
    console.error('Erreur lors de la vérification du serveur:', error);
    return false;
  }
}

// Login au serveur
async function loginToServer(password) {
  try {
    // Tenter une connexion avec différentes approches - première tentative
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
        credentials: 'include'
      });
      
      // Si succès, on retourne le résultat
      if (response.ok) {
        const data = await response.json();
        return { 
          success: true, 
          token: 'server_auth_' + Date.now() // Simulation de token
        };
      }
      
      // Si échec mais réponse reçue, on tente d'extraire le message d'erreur
      try {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erreur d\'authentification');
      } catch (jsonError) {
        throw new Error(`Erreur ${response.status}: ${response.statusText}`);
      }
    } catch (networkError) {
      // On peut tenter une autre approche si la première échoue
      console.warn('Première tentative de connexion échouée, tentative alternative');
      
      // Mode développement/debug : si mot de passe spécial "debug", on simule une connexion réussie
      if (password === 'debug') {
        console.log('Mode debug activé, simulation de connexion réussie');
        return { success: true, token: 'debug_auth_' + Date.now() };
      }
      
      // Sinon, on renvoie l'erreur
      throw networkError;
    }
  } catch (error) {
    console.error('Erreur globale de connexion:', error);
    return { success: false, error: error.message || 'Erreur de connexion au serveur' };
  }
}

// Déconnexion du serveur
async function logoutFromServer() {
  // Simple appel au serveur pour la déconnexion
  try {
    const response = await fetch(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      credentials: 'include'
    });
    
    return response.ok;
  } catch (error) {
    console.error('Erreur lors de la déconnexion du serveur:', error);
    throw error;
  }
}

// Vérifie l'authentification auprès du serveur
async function checkAuthWithServer() {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/check`, {
      method: 'GET',
      credentials: 'include'
    });
    
    if (response.ok) {
      const data = await response.json();
      // Mise à jour de l'état local si différent du serveur
      if (data.authenticated !== isAuthenticated) {
        isAuthenticated = data.authenticated;
        if (isAuthenticated && !authToken) {
          authToken = 'server_validated_' + Date.now();
          chrome.storage.local.set({ 'authToken': authToken });
        } else if (!isAuthenticated && authToken) {
          authToken = null;
          chrome.storage.local.remove('authToken');
        }
      }
      return data.authenticated;
    }
    return false;
  } catch (error) {
    console.error('Erreur lors de la vérification avec le serveur:', error);
    // En cas d'erreur de connexion, on garde l'état local
    return isAuthenticated;
  }
}

// Exécute une tâche sur le serveur
async function executeTaskOnServer(taskType, taskData) {
  try {
    const response = await fetch(`${API_BASE_URL}/tasks`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': authToken ? `Bearer ${authToken}` : ''
      },
      body: JSON.stringify({ type: taskType, data: taskData }),
      credentials: 'include'
    });
    
    if (response.status === 401) {
      // Authentification expirée
      isAuthenticated = false;
      authToken = null;
      chrome.storage.local.remove('authToken');
      throw new Error('Session expirée, veuillez vous reconnecter');
    }
    
    if (!response.ok) {
      throw new Error(`Erreur API: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Erreur lors de l\'exécution de la tâche:', error);
    throw error;
  }
}

// Initialisation au démarrage du service worker
chrome.runtime.onStartup.addListener(() => {
  console.log('Service worker démarré');
  
  // Charger l'URL API et l'état d'authentification
  chrome.storage.local.get(['apiBaseUrl', 'authToken'], (result) => {
    if (result.apiBaseUrl) {
      API_BASE_URL = result.apiBaseUrl;
    }
    
    if (result.authToken) {
      authToken = result.authToken;
      isAuthenticated = true;
    }
    
    console.log('Configuration chargée:', { 
      apiUrl: API_BASE_URL,
      isAuthenticated: isAuthenticated 
    });
  });
});

// Installation/mise à jour de l'extension
chrome.runtime.onInstalled.addListener(() => {
  console.log('FCA-Agent installé/mis à jour');
  
  // Valeurs par défaut si non définies
  chrome.storage.local.get(['apiBaseUrl'], (result) => {
    if (!result.apiBaseUrl) {
      API_BASE_URL = 'http://fca-agent.letsq.xyz/api';
      chrome.storage.local.set({ 'apiBaseUrl': API_BASE_URL });
    }
  });
});