// FCA-Agent - Background Service Worker
// Gère les communications avec le serveur Raspberry Pi

// Configuration
let API_BASE_URL = 'http://fca-agent.letsq.xyz/api'; // Valeur par défaut, sera mise à jour depuis le stockage
let authToken = null;
let userData = null;

// Gestionnaire de messages depuis le popup ou les content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Message reçu dans le background script:', message);
  
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
  
  if (message.action === 'setAuthToken') {
    // Met à jour le token d'authentification
    authToken = message.token;
    userData = message.userData;
    sendResponse({ success: true });
    return true;
  }
  
  if (message.action === 'getUserData') {
    // Renvoie les données utilisateur
    sendResponse({ 
      isAuthenticated: !!authToken, 
      userData: userData 
    });
    return true;
  }
  
  if (message.action === 'logout') {
    // Déconnexion
    authToken = null;
    userData = null;
    chrome.storage.local.remove(['authToken', 'userData']);
    sendResponse({ success: true });
    return true;
  }
  
  if (message.action === 'validateToken') {
    // Vérifie si le token est valide
    validateAuthToken()
      .then(isValid => sendResponse({ success: isValid }))
      .catch(() => sendResponse({ success: false }));
    return true;
  }

  if (message.action === 'updateApiUrl') {
    // Mettre à jour l'URL de l'API
    API_BASE_URL = message.url;
    sendResponse({ success: true });
    return true;
  }
  
  if (message.action === 'fetchProfile') {
    // Récupérer le profil utilisateur
    fetchProfileData()
      .then(data => sendResponse({ success: true, data }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

// Vérifie la connexion au serveur
async function checkServerConnection() {
  try {
    const response = await fetch(`${API_BASE_URL}/status`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
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

// Exécute une tâche via le serveur
async function executeTask(taskType, taskData) {
  try {
    // Vérifier si l'utilisateur est authentifié pour certaines tâches
    const requiresAuth = ['processUserInput', 'email-summary', 'teams-summary', 'draft-email'];
    
    if (requiresAuth.includes(taskType) && !authToken) {
      throw new Error('Authentification requise pour cette action');
    }
    
    let endpoint = `${API_BASE_URL}/tasks`;
    
    // Rediriger certaines tâches vers les bonnes endpoints
    if (taskType === 'changePassword') {
      endpoint = `${API_BASE_URL}/auth/change-password`;
      taskData = {
        currentPassword: taskData.currentPassword,
        newPassword: taskData.newPassword
      };
    }
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authToken ? `Bearer ${authToken}` : ''
      },
      body: JSON.stringify(taskType === 'changePassword' ? taskData : { type: taskType, data: taskData })
    });
    
    if (response.status === 401 || response.status === 403) {
      // Token expiré ou invalide
      authToken = null;
      userData = null;
      chrome.storage.local.remove(['authToken', 'userData']);
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

// Valide le token d'authentification
async function validateAuthToken() {
  if (!authToken) {
    return false;
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}/auth/profile`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    if (!response.ok) {
      // Token invalide
      authToken = null;
      userData = null;
      chrome.storage.local.remove(['authToken', 'userData']);
      return false;
    }
    
    // Mettre à jour les données utilisateur
    const data = await response.json();
    userData = data.user;
    return true;
  } catch (error) {
    console.error('Erreur lors de la validation du token:', error);
    return false;
  }
}

// Récupérer les données du profil depuis le serveur
async function fetchProfileData() {
  if (!authToken) {
    throw new Error('Non authentifié');
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}/auth/profile`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    if (response.status === 401 || response.status === 403) {
      // Token expiré ou invalide
      authToken = null;
      userData = null;
      chrome.storage.local.remove(['authToken', 'userData']);
      throw new Error('Session expirée, veuillez vous reconnecter');
    }
    
    if (!response.ok) {
      throw new Error(`Erreur API: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Erreur lors de la récupération du profil:', error);
    throw error;
  }
}

// Initialisation: vérification du serveur au démarrage
chrome.runtime.onInstalled.addListener(() => {
  console.log('FCA-Agent installé/mis à jour');
  
  // Récupération des données stockées
  chrome.storage.local.get(['authToken', 'userData', 'apiBaseUrl'], (result) => {
    if (result.authToken) {
      authToken = result.authToken;
      console.log('Token d\'authentification chargé');
    }
    
    if (result.userData) {
      userData = result.userData;
      console.log('Données utilisateur chargées');
    }
    
    if (result.apiBaseUrl) {
      API_BASE_URL = result.apiBaseUrl;
      console.log('URL API chargée:', API_BASE_URL);
    }
    
    // Valider le token si présent
    if (authToken) {
      validateAuthToken()
        .then(isValid => {
          console.log('Token valide:', isValid);
        })
        .catch(error => {
          console.error('Erreur lors de la validation du token:', error);
        });
    }
  });
  
  // Vérification initiale du serveur
  checkServerConnection()
    .then(status => {
      console.log('Statut du serveur:', status);
    })
    .catch(error => {
      console.error('Erreur lors de la vérification initiale du serveur:', error);
    });
});

// Événement au démarrage de l'extension
chrome.runtime.onStartup.addListener(() => {
  // Récupération des données stockées
  chrome.storage.local.get(['authToken', 'userData', 'apiBaseUrl'], (result) => {
    if (result.authToken) {
      authToken = result.authToken;
    }
    
    if (result.userData) {
      userData = result.userData;
    }
    
    if (result.apiBaseUrl) {
      API_BASE_URL = result.apiBaseUrl;
    }
    
    // Valider le token si présent
    if (authToken) {
      validateAuthToken();
    }
  });
});

// Pas besoin d'exporter dans un script d'extension Chrome