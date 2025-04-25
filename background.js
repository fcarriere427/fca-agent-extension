// FCA-Agent - Background Service Worker (version ultra-simplifiée)
// Gère les communications avec le serveur Raspberry Pi

// Configuration - URL par défaut, sera chargée depuis le stockage
let API_BASE_URL = 'http://fca-agent.letsq.xyz/api'; 
let isAuthenticated = false;

// Gestionnaire de messages depuis le popup ou les content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Message reçu dans le background script:', message, 'De:', sender.tab ? 'content script' : 'popup');
  
  if (message.action === 'getStatus') {
    // Vérification du statut de connexion
    checkServerConnection()
      .then(status => sendResponse({ status }))
      .catch(error => sendResponse({ status: 'disconnected', error: error.message }));
    return true; // Indique que la réponse sera envoyée de manière asynchrone
  }
  
  if (message.action === 'executeTask') {
    // Envoie une tâche au serveur
    executeTask(message.task, message.data)
      .then(result => sendResponse({ success: true, result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (message.action === 'authenticationUpdated') {
    // Mise à jour du statut d'authentification
    isAuthenticated = message.authenticated;
    sendResponse({ success: true });
    return true;
  }
  
  if (message.action === 'getUserData') {
    // Vérifie l'authentification
    checkAuthentication()
      .then(authenticated => {
        sendResponse({ isAuthenticated: authenticated });
      })
      .catch(() => {
        sendResponse({ isAuthenticated: false });
      });
    return true;
  }
  
  if (message.action === 'logout') {
    // Déconnexion
    logout()
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.action === 'updateApiUrl') {
    // Mettre à jour l'URL de l'API
    API_BASE_URL = message.url;
    // Sauvegarder l'URL dans le stockage local pour persistance
    chrome.storage.local.set({ 'apiBaseUrl': API_BASE_URL });
    sendResponse({ success: true });
    return true;
  }
  
  if (message.action === 'checkAuthentication') {
    // Vérifier l'authentification
    checkAuthentication()
      .then(authenticated => sendResponse({ authenticated }))
      .catch(error => sendResponse({ authenticated: false, error: error.message }));
    return true;
  }
  
  if (message.action === 'getApiUrl') {
    // Renvoie l'URL de l'API actuelle
    sendResponse({ url: API_BASE_URL });
    return true;
  }
  
  if (message.action === 'proxyLogin') {
    // Fonction proxy pour contourner les problèmes CORS
    login(message.password)
      .then(result => {
        console.log('Résultat du login via proxy:', result);
        sendResponse(result);
      })
      .catch(error => {
        console.error('Erreur lors du login via proxy:', error);
        sendResponse({ 
          success: false, 
          error: error instanceof Error ? error.message : 'Erreur de connexion' 
        });
      });
    return true;
  }
});

// Vérifie la connexion au serveur - version simplifiée
async function checkServerConnection() {
  try {
    const response = await fetch(`${API_BASE_URL}/status`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      mode: 'cors'
    });
    
    if (!response.ok) {
      throw new Error(`Statut serveur: ${response.status}`);
    }
    
    const data = await response.json();
    return data.status || 'connected';
  } catch (error) {
    console.error('Erreur de connexion au serveur:', error);
    return 'disconnected';
  }
}

// Vérifie si l'utilisateur est authentifié - version simplifiée
async function checkAuthentication() {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/check`, {
      method: 'GET',
      credentials: 'include',
      mode: 'cors'
    });
    
    if (!response.ok) {
      throw new Error(`Erreur serveur: ${response.status}`);
    }
    
    const data = await response.json();
    isAuthenticated = data.authenticated === true;
    console.log("Vérification d'authentification terminée, résultat:", isAuthenticated);
    return isAuthenticated;
  } catch (error) {
    console.error("Erreur lors de la vérification d'authentification:", error);
    isAuthenticated = false;
    return false;
  }
}

// Déconnexion
async function logout() {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      mode: 'cors'
    });
    
    if (!response.ok) {
      throw new Error(`Erreur lors de la déconnexion: ${response.status}`);
    }
    
    isAuthenticated = false;
    return true;
  } catch (error) {
    console.error('Erreur lors de la déconnexion:', error);
    throw error;
  }
}

// Exécute une tâche via le serveur
async function executeTask(taskType, taskData) {
  try {
    // Vérifier si l'utilisateur est authentifié pour certaines tâches
    const requiresAuth = ['processUserInput', 'email-summary', 'teams-summary', 'draft-email'];
    
    if (requiresAuth.includes(taskType)) {
      // Vérifier l'authentification
      const authenticated = await checkAuthentication();
      if (!authenticated) {
        throw new Error('Authentification requise pour cette action');
      }
    }
    
    // Exécuter la requête avec les cookies inclus
    console.log(`Envoi de la tâche ${taskType} au serveur...`);
    const response = await fetch(`${API_BASE_URL}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: taskType, data: taskData }),
      credentials: 'include',
      mode: 'cors'
    });
    
    if (response.status === 401) {
      isAuthenticated = false;
      throw new Error('Session expirée, veuillez vous reconnecter');
    }
    
    if (!response.ok) {
      throw new Error(`Erreur API: ${response.status}`);
    }
    
    const responseData = await response.json();
    console.log(`Réponse reçue du serveur pour la tâche ${taskType}:`, {
      taskId: responseData.taskId,
      status: responseData.status,
      hasResult: !!responseData.result
    });
    return responseData;
  } catch (error) {
    console.error("Erreur lors de l'exécution de la tâche:", error);
    throw error;
  }
}

// On s'assure de bien initialiser l'URL API au démarrage du service worker
chrome.runtime.onInstalled.addListener(() => {
  console.log('FCA-Agent installé/mis à jour');
  
  // Récupérer l'URL de l'API
  chrome.storage.local.get(['apiBaseUrl'], (result) => {
    if (result.apiBaseUrl) {
      API_BASE_URL = result.apiBaseUrl;
      console.log('URL API chargée depuis le stockage local:', API_BASE_URL);
    } else {
      // Valeur par défaut
      API_BASE_URL = 'http://fca-agent.letsq.xyz/api';
      chrome.storage.local.set({ 'apiBaseUrl': API_BASE_URL });
      console.log('URL API par défaut définie:', API_BASE_URL);
    }
  });
});

// Au démarrage, charger l'URL de l'API depuis le stockage local
chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.get(['apiBaseUrl'], (result) => {
    if (result.apiBaseUrl) {
      API_BASE_URL = result.apiBaseUrl;
      console.log('URL API chargée depuis le stockage local:', API_BASE_URL);
    }
  });
});

// Fonction de login - effectue la requête depuis le background script pour contourner CORS
async function login(password) {
  try {
    console.log('Tentative de connexion au serveur via proxy:', API_BASE_URL);
    
    // Utiliser fetch au lieu de XMLHttpRequest dans un service worker
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
      credentials: 'include',
    });
    
    if (response.ok) {
      console.log('Connexion réussie via proxy');
      isAuthenticated = true;
      
      try {
        const data = await response.json();
        return { success: true, data };
      } catch (e) {
        return { success: true, data: { message: 'Authentification réussie' } };
      }
    } else {
      console.error('Erreur de connexion via proxy:', response.status);
      let errorMsg = 'Erreur de connexion';
      
      try {
        const data = await response.json();
        errorMsg = data.error || errorMsg;
      } catch (e) {}
      
      return { success: false, error: errorMsg };
    }
  } catch (error) {
    console.error('Erreur de connexion via proxy:', error);
    return { success: false, error: error.message || 'Erreur de connexion au serveur' };
  }
}