// FCA-Agent - Background Service Worker
// Gère les communications avec le serveur Raspberry Pi

// Configuration
let API_BASE_URL = 'http://fca-agent.letsq.xyz/api'; // Valeur par défaut, sera mise à jour depuis le stockage
let accessToken = null;
let refreshToken = null;
let userData = null;
let tokenRefreshInProgress = false;

// Définir la durée avant d'essayer de rafraîchir le token (45 minutes en millisecondes)
// Cela permet de rafraîchir le token avant qu'il n'expire (typiquement 1 heure)
const TOKEN_REFRESH_INTERVAL = 45 * 60 * 1000; // 45 minutes
let tokenRefreshTimer = null;

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
  
  if (message.action === 'setAuthTokens') {
    // Met à jour les tokens d'authentification
    accessToken = message.accessToken;
    refreshToken = message.refreshToken;
    userData = message.userData;
    
    // Stocker en session storage (mémoire volatile du navigateur)
    chrome.storage.session.set({
      'accessToken': accessToken,
      'refreshToken': refreshToken,
      'userData': userData,
      'tokenTimestamp': Date.now() // Heure de réception du token
    });
    
    // Démarrer le timer pour rafraîchir automatiquement le token
    scheduleTokenRefresh();
    
    sendResponse({ success: true });
    return true;
  }
  
  if (message.action === 'getUserData') {
    // Renvoie les données utilisateur
    sendResponse({ 
      isAuthenticated: !!accessToken, 
      userData: userData 
    });
    return true;
  }
  
  if (message.action === 'logout') {
    // Déconnexion avec révocation du refresh token sur le serveur
    if (refreshToken) {
      // Appel au serveur pour révoquer le token
      fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ refreshToken }),
        mode: 'cors'
      }).catch(error => {
        console.error('Erreur lors de la révocation du token:', error);
      });
    }
    
    // Nettoyer les données en mémoire
    accessToken = null;
    refreshToken = null;
    userData = null;
    
    // Arrêter le timer de rafraîchissement
    if (tokenRefreshTimer) {
      clearTimeout(tokenRefreshTimer);
      tokenRefreshTimer = null;
    }
    
    // Nettoyer le stockage
    chrome.storage.session.remove(['accessToken', 'refreshToken', 'userData', 'tokenTimestamp']);
    chrome.storage.local.remove(['userData']); // Pour compatibilité avec l'ancien système
    
    sendResponse({ success: true });
    return true;
  }
  
  if (message.action === 'validateToken') {
    // Vérifie si le token est valide et le rafraîcht si nécessaire
    validateAndRefreshTokens()
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

// Programmer le rafraîchissement automatique du token
function scheduleTokenRefresh() {
  // Annuler tout timer existant
  if (tokenRefreshTimer) {
    clearTimeout(tokenRefreshTimer);
  }
  
  // Programmer un nouveau rafraîchissement
  tokenRefreshTimer = setTimeout(async () => {
    console.log('Tentative de rafraîchissement automatique du token');
    try {
      await refreshAccessToken();
      // Programmer le prochain rafraîchissement
      scheduleTokenRefresh();
    } catch (error) {
      console.error('Erreur lors du rafraîchissement automatique du token:', error);
    }
  }, TOKEN_REFRESH_INTERVAL);
  
  console.log(`Token rafraîchissement programmé dans ${TOKEN_REFRESH_INTERVAL / 60000} minutes`);
}

// Rafraîchir le token d'accès en utilisant le refresh token
async function refreshAccessToken() {
  if (!refreshToken || tokenRefreshInProgress) {
    return false;
  }
  
  try {
    tokenRefreshInProgress = true;
    console.log('Rafraîchissement du token d\'accès...');
    console.log('Refresh token utilisé:', refreshToken.substring(0, 20) + '...');
    
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ refreshToken }),
      mode: 'cors'
    });
    
    if (!response.ok) {
      console.error(`Erreur HTTP lors du rafraîchissement: ${response.status}`);
      const errorText = await response.text();
      console.error('Détails de l\'erreur:', errorText);
      throw new Error(`Erreur lors du rafraîchissement du token: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Données reçues du rafraîchissement:', JSON.stringify(data));
    
    if (data.success) {
      // Mettre à jour les tokens
      accessToken = data.accessToken;
      refreshToken = data.refreshToken;
      userData = data.user;
      
      console.log('Nouveaux tokens reçus:');
      console.log('- Access token:', accessToken.substring(0, 20) + '...');
      console.log('- Refresh token:', refreshToken.substring(0, 20) + '...');
      
      // Stocker les nouveaux tokens
      chrome.storage.session.set({
        'accessToken': accessToken,
        'refreshToken': refreshToken,
        'userData': userData,
        'tokenTimestamp': Date.now()
      });
      
      console.log('Token d\'accès rafraîcki avec succès');
      return true;
    } else {
      console.error('Réponse de rafraîchissement sans succès:', data);
      throw new Error('Rafraîchissement échoué: réponse invalide');
    }
  } catch (error) {
    console.error('Erreur lors du rafraîchissement du token:', error);
    
    // Si le rafraîchissement échoue, on considère l'utilisateur comme déconnecté
    accessToken = null;
    refreshToken = null;
    userData = null;
    chrome.storage.session.remove(['accessToken', 'refreshToken', 'userData', 'tokenTimestamp']);
    
    throw error;
  } finally {
    tokenRefreshInProgress = false;
  }
}

// Exécute une tâche via le serveur
async function executeTask(taskType, taskData) {
  try {
    // Vérifier si l'utilisateur est authentifié pour certaines tâches
    const requiresAuth = ['processUserInput', 'email-summary', 'teams-summary', 'draft-email'];
    
    if (requiresAuth.includes(taskType) && !accessToken) {
      // Si l'utilisateur n'est pas authentifié, essayer de rafraîchir le token
      if (refreshToken) {
        const refreshSuccess = await refreshAccessToken();
        if (!refreshSuccess || !accessToken) {
          throw new Error('Authentification requise pour cette action');
        }
      } else {
        throw new Error('Authentification requise pour cette action');
      }
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
    
    // Exécuter la requête avec le token dans l'en-tête Authorization
    if (accessToken) {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify(taskType === 'changePassword' ? taskData : { type: taskType, data: taskData }),
        mode: 'cors'
      });
      
      if (response.status === 401 || response.status === 403) {
        // Token expiré ou invalide, essayer de le rafraîchir
        const refreshSuccess = await refreshAccessToken();
        
        if (refreshSuccess) {
          // Réessayer avec le nouveau token
          return await executeTask(taskType, taskData);
        } else {
          // Échec du rafraîchissement, déconnexion
          throw new Error('Session expirée, veuillez vous reconnecter');
        }
      }
      
      if (!response.ok) {
        throw new Error(`Erreur API: ${response.status}`);
      }
      
      return await response.json();
    } else {
      // Pas de token, requête standard
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(taskType === 'changePassword' ? taskData : { type: taskType, data: taskData }),
        mode: 'cors'
      });
      
      if (!response.ok) {
        throw new Error(`Erreur API: ${response.status}`);
      }
      
      return await response.json();
    }
  } catch (error) {
    console.error('Erreur lors de l\'exécution de la tâche:', error);
    throw error;
  }
}

// Valide le token d'accès et le rafraîchit si nécessaire
async function validateAndRefreshTokens() {
  if (!accessToken) {
    console.log('validateAndRefreshTokens: pas de token d\'accès!');
    
    // Essayer de récupérer les tokens du stockage
    await loadTokensFromStorage();
    
    if (!accessToken && refreshToken) {
      console.log('Token d\'accès absent mais refresh token présent, tentative de rafraîchissement');
      // Essayer de rafraîchir avec le refresh token
      try {
        await refreshAccessToken();
      } catch (error) {
        console.error('Impossible de rafraîchir le token:', error);
        return false;
      }
    }
    
    if (!accessToken) {
      console.log('Aucun token d\'accès disponible après tentative de récupération et rafraîchissement');
      return false;
    }
  }
  
  try {
    console.log('validateAndRefreshTokens: vérification du token d\'accès...');
    console.log('En-tête Authorization: Bearer ' + accessToken.substring(0, 20) + '...');
    
    // Utiliser le token dans l'en-tête Authorization
    const response = await fetch(`${API_BASE_URL}/auth/profile`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      mode: 'cors'
    });
    
    console.log('validateAndRefreshTokens: réponse API status:', response.status);
    
    // Afficher le contenu de la réponse pour déboguer
    const responseText = await response.text();
    console.log('Corps de la réponse:', responseText);
    
    // Parser le JSON seulement si le texte n'est pas vide
    let data;
    if (responseText.trim()) {
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error('Erreur lors du parsing JSON:', e);
      }
    }
    
    if (response.status === 401 || response.status === 403) {
      console.log('Token expiré ou invalide, tentative de rafraîchissement');
      // Token expiré, essayer de le rafraîchir
      if (refreshToken) {
        try {
          const refreshSuccess = await refreshAccessToken();
          if (refreshSuccess) {
            // Token rafraîcki, on revalide
            console.log('Rafraîchissement réussi, nouvelle tentative de validation');
            return await validateAndRefreshTokens();
          } else {
            console.log('Rafraîchissement échoué');
            return false;
          }
        } catch (error) {
          console.error('Erreur lors du rafraîchissement du token:', error);
          return false;
        }
      } else {
        // Pas de refresh token disponible
        console.log('Pas de refresh token disponible pour rafraîchir le token expiré');
        accessToken = null;
        userData = null;
        chrome.storage.session.remove(['accessToken', 'userData', 'tokenTimestamp']);
        return false;
      }
    }
    
    if (!response.ok) {
      // Autre erreur
      console.log('validateAndRefreshTokens: erreur API', response.status);
      return false;
    }
    
    // Réinitialiser la réponse pour pouvoir la lire à nouveau
    if (data) {
      // Utiliser les données déjà parsées
      userData = data.user;
      console.log('validateAndRefreshTokens: token valide, données utilisateur mises à jour');
      console.log('Utilisateur:', userData);
      return true;
    } else {
      console.error('Pas de données valides dans la réponse');
      return false;
    }
  } catch (error) {
    console.error('Erreur lors de la validation du token:', error);
    return false;
  }
}

// Charger les tokens depuis le stockage
async function loadTokensFromStorage() {
  return new Promise((resolve) => {
    chrome.storage.session.get(['accessToken', 'refreshToken', 'userData', 'tokenTimestamp'], (result) => {
      if (result.accessToken) {
        accessToken = result.accessToken;
        console.log('Access token chargé depuis le stockage');
      }
      
      if (result.refreshToken) {
        refreshToken = result.refreshToken;
        console.log('Refresh token chargé depuis le stockage');
      }
      
      if (result.userData) {
        userData = result.userData;
        console.log('Données utilisateur chargées depuis le stockage');
      }
      
      resolve();
    });
  });

}

// Récupérer les données du profil depuis le serveur
async function fetchProfileData() {
  // Vérifier et rafraîchir les tokens si nécessaire
  const isValid = await validateAndRefreshTokens();
  
  if (!isValid || !accessToken) {
    throw new Error('Non authentifié');
  }
  
  try {
    console.log('fetchProfileData: récupération du profil avec token:', accessToken.substring(0, 20) + '...');
    console.log('En-tête Authorization:', `Bearer ${accessToken}`);
    
    // Utiliser le token dans l'en-tête Authorization
    const response = await fetch(`${API_BASE_URL}/auth/profile`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      mode: 'cors'
    });
    
    console.log('fetchProfileData: statut de la réponse:', response.status);
    
    if (response.status === 401 || response.status === 403) {
      console.log('Token expiré ou invalide, tentative de rafraîchissement');
      // Token expiré ou invalide, essayer de le rafraîchir
      const refreshSuccess = await refreshAccessToken();
      
      if (refreshSuccess) {
        console.log('Rafraîchissement réussi, nouvelle tentative de récupération du profil');
        // Réessayer avec le nouveau token
        return await fetchProfileData();
      } else {
        // Échec du rafraîchissement, déconnexion
        console.error('Échec du rafraîchissement du token, déconnexion nécessaire');
        throw new Error('Session expirée, veuillez vous reconnecter');
      }
    }
    
    if (!response.ok) {
      // Déboguer plus de détails sur l'erreur
      const errorText = await response.text();
      console.error(`Erreur API ${response.status}:`, errorText);
      throw new Error(`Erreur API: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Données du profil reçues:', data);
    
    return data;
  } catch (error) {
    console.error('Erreur lors de la récupération du profil:', error);
    throw error;
  }
}

// Initialisation: vérification du serveur au démarrage
chrome.runtime.onInstalled.addListener(() => {
  console.log('FCA-Agent installé/mis à jour');
  
  // Récupérer d'abord l'URL de l'API
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
    
    // Ensuite, récupérer les tokens de session
    chrome.storage.session.get(['accessToken', 'refreshToken', 'userData'], (result) => {
      if (result.accessToken) {
        accessToken = result.accessToken;
        console.log('Token d\'accès chargé:', accessToken.substring(0, 15) + '...');
      }
      
      if (result.refreshToken) {
        refreshToken = result.refreshToken;
        console.log('Token de rafraîchissement chargé:', refreshToken.substring(0, 15) + '...');
      }
      
      if (result.userData) {
        userData = result.userData;
        console.log('Données utilisateur chargées:', userData);
      }
      
      // Valider les tokens si présents
      if (accessToken || refreshToken) {
        console.log('Des tokens sont présents, tentative de validation...');
        validateAndRefreshTokens()
          .then(isValid => {
            console.log('Tokens validés:', isValid);
            if (isValid && accessToken) {
              scheduleTokenRefresh();
            }
          })
          .catch(error => {
            console.error('Erreur lors de la validation des tokens:', error);
          });
      } else {
        console.log('Aucun token en session, authentification requise');
      }

      // Vérification du serveur
      checkServerConnection()
        .then(status => {
          console.log('Statut du serveur:', status);
        })
        .catch(error => {
          console.error('Erreur lors de la vérification du serveur:', error);
        });
    });
  });
  });
  
  // La vérification du serveur est déjà effectuée après le chargement des tokens
});

// Événement au démarrage de l'extension
chrome.runtime.onStartup.addListener(() => {
  // Récupérer d'abord l'URL de l'API du stockage local
  chrome.storage.local.get(['apiBaseUrl'], (localResult) => {
    if (localResult.apiBaseUrl) {
      API_BASE_URL = localResult.apiBaseUrl;
      console.log('URL API chargée depuis le stockage local:', API_BASE_URL);
    }
    
    // Ensuite, récupérer les tokens de session
    chrome.storage.session.get(['accessToken', 'refreshToken', 'userData'], (result) => {
      if (result.accessToken) {
        accessToken = result.accessToken;
        console.log('Token d\'accès chargé:', result.accessToken.substring(0, 15) + '...');
      }
      
      if (result.refreshToken) {
        refreshToken = result.refreshToken;
        console.log('Token de rafraîchissement chargé:', result.refreshToken.substring(0, 15) + '...');
      }
      
      if (result.userData) {
        userData = result.userData;
        console.log('Données utilisateur chargées');
      }
      
      // Valider les tokens si présents
      if (accessToken || refreshToken) {
        console.log('Des tokens sont présents, validation...');
        validateAndRefreshTokens()
          .then(isValid => {
            console.log('Résultat de la validation des tokens:', isValid);
            if (isValid && accessToken) {
              console.log('Programmation du rafraîchissement automatique');
              scheduleTokenRefresh();
            }
          })
          .catch(error => {
            console.error('Erreur lors de la validation des tokens:', error);
          });
      } else {
        console.log('Aucun token en session, authentification requise');
      }
    });
  });
});

// Pas besoin d'exporter dans un script d'extension Chrome