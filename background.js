// FCA-Agent - Background Service Worker (version simplifiée)
// Gère les communications avec le serveur Raspberry Pi

// Configuration
let API_BASE_URL = 'http://fca-agent.letsq.xyz/api'; // Valeur par défaut, sera mise à jour depuis le stockage
let isAuthenticated = false;

// Variables pour éviter les vérifications simultanées
let authCheckInProgress = false;
let lastAuthCheckTime = 0;
const AUTH_CHECK_THROTTLE = 2000; // 2 secondes minimum entre les vérifications

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
    // Vérifie d'abord l'authentification
    checkAuthentication()
      .then(authenticated => {
        sendResponse({ 
          isAuthenticated: authenticated
        });
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
});

// Vérifie la connexion au serveur
async function checkServerConnection() {
  try {
    const response = await fetch(`${API_BASE_URL}/status`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      mode: 'cors' // Explicitement utiliser le mode CORS standard
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

// Vérifie si l'utilisateur est authentifié
async function checkAuthentication() {
  // Éviter les vérifications simultanées
  if (authCheckInProgress) {
    console.log('Vérification d\'authentification déjà en cours, utilisation de l\''état actuel');
    return isAuthenticated;
  }
  
  // Limiter la fréquence des vérifications
  const now = Date.now();
  if (now - lastAuthCheckTime < AUTH_CHECK_THROTTLE) {
    console.log('Vérification d\'authentification trop fréquente, utilisation de l\''état actuel');
    return isAuthenticated;
  }
  
  try {
    authCheckInProgress = true;
    lastAuthCheckTime = now;
    console.log('Exécution d\'une vérification d\'authentification...');
    
    const response = await fetch(`${API_BASE_URL}/auth/check`, {
      method: 'GET',
      credentials: 'include', // Important pour envoyer les cookies
      mode: 'cors'
    });
    
    if (!response.ok) {
      throw new Error(`Erreur serveur: ${response.status}`);
    }
    
    const data = await response.json();
    isAuthenticated = data.authenticated === true;
    console.log('Vérification d\'authentification terminée, résultat:', isAuthenticated);
    return isAuthenticated;
  } catch (error) {
    console.error('Erreur lors de la vérification d\'authentification:', error);
    isAuthenticated = false;
    return false;
  } finally {
    // Déverrouiller la vérification
    setTimeout(() => {
      authCheckInProgress = false;
    }, 500);
  }
}

// Déconnexion
async function logout() {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      credentials: 'include', // Important pour envoyer les cookies
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
    const response = await fetch(`${API_BASE_URL}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: taskType, data: taskData }),
      credentials: 'include', // Important pour envoyer les cookies
      mode: 'cors'
    });
    
    if (response.status === 401) {
      isAuthenticated = false;
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

// Initialisation: vérification du serveur au démarrage
chrome.runtime.onInstalled.addListener(() => {
  console.log('FCA-Agent installé/mis à jour');
  
  // Récupérer l'URL de l'API
  chrome.storage.local.get(['apiBaseUrl'], (localResult) => {
    if (localResult.apiBaseUrl) {
      API_BASE_URL = localResult.apiBaseUrl;
      console.log('URL API chargée depuis le stockage local:', API_BASE_URL);
    } else {
      // Valeur par défaut
      API_BASE_URL = 'http://fca-agent.letsq.xyz/api';
      chrome.storage.local.set({ 'apiBaseUrl': API_BASE_URL });
      console.log('URL API par défaut définie:', API_BASE_URL);
    }
    
    // Une série séquentielle de vérifications avec délai
    setTimeout(() => {
      // Vérifier d'abord le statut du serveur
      checkServerConnection()
        .then(status => {
          console.log('Statut du serveur:', status);
          // Vérifier l'authentification seulement si le serveur est connecté
          if (status === 'connected') {
            // Ajouter un court délai avant de vérifier l'authentification
            setTimeout(() => {
              checkAuthentication()
                .then(authenticated => {
                  console.log('Statut d\'authentification:', authenticated ? 'Authentifié' : 'Non authentifié');
                })
                .catch(error => {
                  console.error('Erreur lors de la vérification d\'authentification:', error);
                });
            }, 500);
          }
        })
        .catch(error => {
          console.error('Erreur lors de la vérification du serveur:', error);
        });
    }, 1000);
  });
});

// Événement au démarrage de l'extension
chrome.runtime.onStartup.addListener(() => {
  // Récupérer l'URL de l'API du stockage local
  chrome.storage.local.get(['apiBaseUrl'], (localResult) => {
    if (localResult.apiBaseUrl) {
      API_BASE_URL = localResult.apiBaseUrl;
      console.log('URL API chargée depuis le stockage local:', API_BASE_URL);
    }
    
    // Une série séquentielle de vérifications avec délai
    setTimeout(() => {
      // Vérifier d'abord le statut du serveur
      checkServerConnection()
        .then(status => {
          console.log('Statut du serveur:', status);
          // Vérifier l'authentification seulement si le serveur est connecté
          if (status === 'connected') {
            // Ajouter un court délai avant de vérifier l'authentification
            setTimeout(() => {
              checkAuthentication()
                .then(authenticated => {
                  console.log('Statut d\'authentification:', authenticated ? 'Authentifié' : 'Non authentifié');
                })
                .catch(error => {
                  console.error('Erreur lors de la vérification d\'authentification:', error);
                });
            }, 500);
          }
        })
        .catch(error => {
          console.error('Erreur lors de la vérification du serveur:', error);
        });
    }, 1000);
  });
});