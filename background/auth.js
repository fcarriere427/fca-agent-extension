// FCA-Agent - Module d'authentification

import { getApiUrl } from './config.js';

// État d'authentification - explicitement marqué comme local
let authToken = null;
let isAuthenticated = false;

// Logger spécifique à l'authentification avec niveau de débogage amélioré
function authLog(message, level = 'info') {
  const prefix = '[EXT:AUTH]';
  const isDebug = true; // Activer pour plus de détails
  
  // Ajouter un timestamp pour faciliter le suivi
  const now = new Date();
  const timestamp = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}`;
  
  switch(level) {
    case 'error':
      console.error(`${prefix} [${timestamp}] ${message}`);
      break;
    case 'warn':
      console.warn(`${prefix} [${timestamp}] ${message}`);
      break;
    case 'debug':
      if (isDebug) {
        console.debug(`${prefix} [${timestamp}] DEBUG: ${message}`);
      }
      break;
    default:
      console.log(`${prefix} [${timestamp}] ${message}`);
  }
}

// Méthodes d'accès
export function getAuthStatus() {
  authLog(`getAuthStatus() => isAuthenticated=${isAuthenticated}, hasToken=${!!authToken}`);
  return { isAuthenticated, hasToken: !!authToken };
}

export function setAuthenticated(status, token = null) {
  authLog(`setAuthenticated(${status}, ${token ? `token ${token.substring(0, 4)}...${token.substring(token.length-4)}` : 'pas de token'})`);
  
  isAuthenticated = status;
  
  // Mettre à jour le token seulement si un nouveau est fourni ou si on déconnecte
  if (status && token) {
    authToken = token;
    
    // Sauvegarde de secours en sessionStorage (pour récupération synchrone)
    try {
      window.sessionStorage.setItem('authTokenBackup', token);
      authLog(`Token sauvegardé en session storage pour récupération d'urgence`);
    } catch (e) {
      authLog(`Impossible de sauvegarder le token en session storage: ${e.message}`, 'error');
    }
    
    // Stockage local (persistant) avec le token
    chrome.storage.local.set({ 'authToken': token }, () => {
      if (chrome.runtime.lastError) {
        authLog(`Erreur lors de l'enregistrement du token: ${chrome.runtime.lastError.message}`, 'error');
      } else {
        authLog(`Token enregistré dans le stockage local: ${token.substring(0, 4)}...${token.substring(token.length-4)}`);
        
        // Vérification immédiate que le token est correctement stocké
        setTimeout(() => {
          chrome.storage.local.get(['authToken'], (result) => {
            if (!result || !result.authToken) {
              authLog('ALERTE: Token non trouvé dans le stockage après sauvegarde!', 'error');
            } else if (result.authToken !== token) {
              authLog(`ALERTE: Incohérence entre le token en mémoire et celui du stockage!`, 'error');
            } else {
              authLog('Vérification positive: token correctement enregistré et récupérable', 'debug');
            }
          });
        }, 100);
      }
    });
  } else if (!status) {
    // Si déconnecté, effacer le token
    authLog('Effacement du token (déconnexion)');
    authToken = null;
    
    // Nettoyer aussi la sauvegarde en session storage
    try {
      window.sessionStorage.removeItem('authTokenBackup');
    } catch (e) {
      // Ignorer les erreurs ici
    }
    
    chrome.storage.local.remove('authToken', () => {
      if (chrome.runtime.lastError) {
        authLog(`Erreur lors de la suppression du token: ${chrome.runtime.lastError.message}`, 'error');
      } else {
        authLog('Token supprimé du stockage local');
      }
    });
  }
  
  // Notifier autres composants (popup, etc.)
  broadcastAuthStatus();
}

// Méthode dédiée pour diffuser le statut d'authentification
function broadcastAuthStatus() {
  const status = { 
    isAuthenticated, 
    hasToken: !!authToken,
    tokenPreview: authToken ? `${authToken.substring(0, 4)}...${authToken.substring(authToken.length-4)}` : null 
  };
  authLog(`Diffusion du statut d'authentification: ${JSON.stringify(status)}`);
  
  try {
    chrome.runtime.sendMessage({ 
      action: 'authStatusChanged', 
      status: status 
    }, () => {
      if (chrome.runtime.lastError) {
        authLog(`Message authStatusChanged non délivré: ${chrome.runtime.lastError.message}`, 'warn');
      } else {
        authLog('Message authStatusChanged délivré avec succès', 'debug');
      }
    });
  } catch (error) {
    authLog(`Erreur lors de la diffusion du statut: ${error.message}`, 'error');
  }
}

// Chargement explicite du stockage local
export function loadAuthState() {
  authLog('Chargement du statut d\'authentification depuis le stockage local...');
  
  return new Promise((resolve) => {
    chrome.storage.local.get(['authToken'], (result) => {
      if (chrome.runtime.lastError) {
        authLog(`Erreur lors du chargement du token: ${chrome.runtime.lastError.message}`, 'error');
        isAuthenticated = false;
        authToken = null;
      } else if (result.authToken) {
        authToken = result.authToken;
        isAuthenticated = true;
        authLog(`Session authentifiée chargée: token=${result.authToken.substring(0, 4)}...${result.authToken.substring(result.authToken.length-4)}`);
        
        // Sauvegarde de secours en sessionStorage pour récupération synchrone future
        try {
          window.sessionStorage.setItem('authTokenBackup', result.authToken);
          authLog(`Token sauvegardé en session storage après chargement`);
        } catch (e) {
          authLog(`Impossible de sauvegarder le token en session storage: ${e.message}`, 'error');
        }
        
        // Test immédiat de validité du token pour déboguer
        const headers = getAuthHeaders();
        authLog(`Headers qui seront utilisés: ${JSON.stringify(headers)}`, 'debug');
        
        // Vérification immédiate auprès du serveur pour confirmer la validité
        setTimeout(() => {
          checkAuthWithServer()
            .then(isValid => {
              if (!isValid) {
                authLog('ALERTE: Le token chargé semble invalide selon le serveur!', 'error');
              } else {
                authLog('Token chargé validé par le serveur', 'debug');
              }
            })
            .catch(error => {
              authLog(`Erreur lors de la validation du token: ${error}`, 'error');
            });
        }, 500); // Attendre que les services soient prêts
      } else {
        isAuthenticated = false;
        authToken = null;
        authLog('Aucune session authentifiée trouvée dans le stockage local');
      }
      
      // Annoncer le statut d'authentification au démarrage
      broadcastAuthStatus();
      
      resolve({ 
        isAuthenticated, 
        hasToken: !!authToken,
        tokenPreview: authToken ? `${authToken.substring(0, 4)}...${authToken.substring(authToken.length-4)}` : null 
      });
    });
  });
}

export async function loginToServer(password) {
  const apiUrl = getApiUrl();
  authLog(`Tentative de connexion à ${apiUrl}/auth/login`);
  
  try {
    // D'abord, réinitialiser l'état d'authentification
    isAuthenticated = false;
    authToken = null;
    
    // Supprimer tout ancien token du stockage par précaution
    try {
      window.sessionStorage.removeItem('authTokenBackup');
    } catch (e) {}
    
    const response = await fetch(`${apiUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
      credentials: 'omit'
    });
    
    authLog(`Réponse reçue du serveur: status=${response.status}`, 'debug');
    
    // Lecture du corps de la réponse
    let responseData;
    try {
      responseData = await response.json();
      authLog(`Corps de la réponse parsé: ${JSON.stringify(responseData)}`, 'debug');
    } catch (jsonError) {
      authLog(`Erreur lors du parsing de la réponse: ${jsonError.message}`, 'error');
      responseData = {};
    }
    
    // Si succès, mettre à jour l'état d'authentification
    if (response.ok) {
      // Vérifier explicitement la présence du token
      if (!responseData.token) {
        authLog('ERREUR CRITIQUE: Authentification réussie mais aucun token dans la réponse!', 'error');
        return { 
          success: false, 
          error: 'Token manquant dans la réponse serveur' 
        };
      }
      
      const token = responseData.token;
      authLog(`Token reçu du serveur: ${token.substring(0, 4)}...${token.substring(token.length-4)}`);
      
      // 1. D'abord, sauvegarder dans la session storage pour accès immédiat
      try {
        window.sessionStorage.setItem('authTokenBackup', token);
        authLog('Token sauvegardé en session storage (sauvegarde rapide)');
      } catch (e) {
        authLog(`Impossible de sauvegarder en session storage: ${e.message}`, 'warn');
      }
      
      // 2. Stockage explicite du token dans le storage local (persistant)
      try {
        await new Promise((resolve, reject) => {
          chrome.storage.local.set({ 'authToken': token }, () => {
            if (chrome.runtime.lastError) {
              const error = chrome.runtime.lastError.message;
              authLog(`Erreur lors de l'enregistrement du token: ${error}`, 'error');
              reject(new Error(error));
            } else {
              authLog(`Token enregistré avec succès dans le stockage local`);
              resolve();
            }
          });
        });
      } catch (storageError) {
        authLog(`Échec de sauvegarde du token dans le stockage local: ${storageError.message}`, 'error');
        // Continuer quand même, on a la sauvegarde en session storage
      }
      
      // 3. Mise à jour du statut d'authentification en mémoire
      authToken = token; // Assignation directe pour s'assurer que la variable est renseignée
      isAuthenticated = true;
      
      // 4. Notification à tous les composants
      broadcastAuthStatus();
      
      // 5. Vérification que le token est utilisable
      const headers = getAuthHeaders();
      if (!headers.Authorization) {
        authLog('ERREUR CRITIQUE: Token non disponible dans les headers après connexion!', 'error');
      } else {
        authLog(`Vérification des headers après login: ${JSON.stringify(headers)}`, 'debug');
      }
      
      return { success: true, token };
    } else {
      // Échec d'authentification
      authLog(`Échec d'authentification: ${responseData.error || response.statusText}`, 'error');
      isAuthenticated = false;
      authToken = null;
      return { 
        success: false, 
        error: responseData.error || `Erreur ${response.status}: ${response.statusText}` 
      };
    }
  } catch (networkError) {
    // Gestion du mode debug (pour tests locaux uniquement)
    if (password === 'debug') {
      authLog('Mode debug activé: simulation de connexion réussie', 'warn');
      const debugToken = `debug_auth_${Date.now()}`;
      
      // Sauvegarde directe du token de debug
      authToken = debugToken;
      isAuthenticated = true;
      
      try {
        window.sessionStorage.setItem('authTokenBackup', debugToken);
      } catch (e) {}
      
      // Notification
      broadcastAuthStatus();
      
      return { success: true, token: debugToken };
    }
    
    // Erreur réseau
    authLog(`Erreur réseau: ${networkError.message}`, 'error');
    return { success: false, error: `Erreur de connexion: ${networkError.message}` };
  }
}

export async function logoutFromServer() {
  const apiUrl = getApiUrl();
  authLog(`Tentative de déconnexion à ${apiUrl}/auth/logout`);
  
  try {
    // D'abord, mise à jour locale pour assurer la déconnexion
    setAuthenticated(false);
    
    // Puis, notification au serveur (avec le token dans l'en-tête)
    const response = await fetch(`${apiUrl}/auth/logout`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'omit'
    });
    
    if (response.ok) {
      authLog('Déconnexion serveur réussie');
    } else {
      authLog(`Déconnexion serveur avec statut ${response.status}`, 'warn');
    }
    
    return true; // On considère toujours la déconnexion comme réussie côté client
  } catch (error) {
    authLog(`Erreur lors de la déconnexion du serveur: ${error.message}`, 'error');
    // On a déjà mis à jour l'état local, donc on considère comme réussi
    return true;
  }
}

export async function checkAuthWithServer() {
  const apiUrl = getApiUrl();
  const headers = getAuthHeaders();
  authLog(`Vérification d'authentification avec le serveur: ${apiUrl}/auth/check`);
  authLog(`Headers utilisés: ${JSON.stringify(headers)}`, 'debug');
  
  // Vérifier la disponibilité du token avant de poursuivre
  if (!headers.Authorization && isAuthenticated) {
    // Incohérence: on est marqué comme authentifié mais pas de token dans les headers
    authLog('ERREUR CRITIQUE: Marqué comme authentifié mais aucun token disponible!', 'error');
    
    // Essayer de récupérer depuis le stockage de secours
    const backupToken = window.sessionStorage.getItem('authTokenBackup');
    if (backupToken) {
      authLog('Récupération du token depuis le stockage de secours', 'warn');
      authToken = backupToken;
      // Récupérer les headers à nouveau
      const updatedHeaders = getAuthHeaders();
      if (updatedHeaders.Authorization) {
        authLog('Headers mis à jour après récupération d\'urgence', 'debug');
      } else {
        // Si toujours pas de token, problème plus grave
        authLog('Impossible de récupérer un token valide, déconnexion forcée', 'error');
        isAuthenticated = false;
        authToken = null;
        broadcastAuthStatus();
        return false;
      }
    } else {
      // Pas de sauvegarde disponible non plus
      authLog('Aucun token de sauvegarde disponible, déconnexion forcée', 'error');
      isAuthenticated = false;
      authToken = null;
      broadcastAuthStatus();
      return false;
    }
  }
  
  try {
    const response = await fetch(`${apiUrl}/auth/check`, {
      method: 'GET',
      credentials: 'omit',
      headers: getAuthHeaders(), // Récupérer les headers à nouveau (potentiellement mis à jour)
      cache: 'no-cache' // IMPORTANT: Ne pas utiliser le cache
    });
    
    authLog(`Réponse du serveur reçue: status=${response.status}`, 'debug');
    
    // Le serveur peut renvoyer 304 Not Modified si rien n'a changé
    if (response.status === 304) {
      authLog('Réponse 304 Not Modified - Aucun changement de statut');
      return isAuthenticated; // On conserve l'état local actuel
    }
    
    // Lecture du corps de la réponse pour les autres codes
    if (response.ok) {
      let data;
      try {
        data = await response.json();
        authLog(`Corps de la réponse: ${JSON.stringify(data)}`, 'debug');
      } catch (jsonError) {
        authLog(`Erreur lors du parsing de la réponse: ${jsonError.message}`, 'error');
        return isAuthenticated; // Conserver l'état actuel en cas d'erreur
      }
      
      authLog(`Résultat du serveur: authenticated=${data.authenticated}`);
      
      // Mise à jour du statut local si différent
      if (data.authenticated !== isAuthenticated) {
        authLog(`Mise à jour du statut local: ${isAuthenticated} -> ${data.authenticated}`);
        if (data.authenticated) {
          // Si le serveur nous dit qu'on est authentifié mais qu'on ne l'était pas avant
          // On utilise notre token actuel ou on en génère un nouveau
          isAuthenticated = true;
          if (!authToken) {
            authToken = `server_validated_${Date.now()}`;
            try { window.sessionStorage.setItem('authTokenBackup', authToken); } catch (e) {}
            chrome.storage.local.set({ 'authToken': authToken });
          }
        } else {
          // Si le serveur nous dit qu'on n'est pas authentifié, on efface le token
          isAuthenticated = false;
          authToken = null;
          try { window.sessionStorage.removeItem('authTokenBackup'); } catch (e) {}
          chrome.storage.local.remove('authToken');
        }
        broadcastAuthStatus();
      }
      
      return data.authenticated;
    } else {
      let errorMsg = `Vérification échouée: statut ${response.status}`;
      try {
        const errorData = await response.json();
        errorMsg += ` - ${JSON.stringify(errorData)}`;
      } catch (e) {
        // Ignorer les erreurs de parsing
      }
      
      authLog(errorMsg, 'warn');
      
      // En cas d'erreur 401 (Unauthorized), c'est probablement un problème de token
      if (response.status === 401) {
        authLog('Token invalide ou expiré, déconnexion forcée', 'warn');
        isAuthenticated = false;
        authToken = null;
        try { window.sessionStorage.removeItem('authTokenBackup'); } catch (e) {}
        chrome.storage.local.remove('authToken');
        broadcastAuthStatus();
      }
      
      return false;
    }
  } catch (error) {
    authLog(`Erreur lors de la vérification avec le serveur: ${error.message}`, 'error');
    // En cas d'erreur de connexion, on garde l'état local inchangé
    return { error: true, authenticated: isAuthenticated };
  }
}

// Fournit le token pour les requêtes API
export function getAuthHeaders() {
  if (!authToken) {
    authLog('WARNING: getAuthHeaders appelé sans token disponible!', 'warn');
    // Tentative de récupération synchrone depuis une variable de sauvegarde
    const backupToken = window.sessionStorage.getItem('authTokenBackup');
    if (backupToken) {
      authLog(`Récupération d'urgence du token depuis la sauvegarde de session`, 'warn');
      authToken = backupToken;
      isAuthenticated = true;
    } else {
      authLog('ERREUR CRITIQUE: Aucun token disponible, authentification compromise', 'error');
      // IMPORTANT: Déclencher un rechargement d'authentification depuis le stockage
      setTimeout(() => { loadAuthState(); }, 100);
      return {};
    }
  }
  
  authLog(`Génération des headers d'authentification avec token: ${authToken.substring(0, 4)}...${authToken.substring(authToken.length-4)}`);
  return { 'Authorization': `Bearer ${authToken}` };
}

// Fonction publique pour réinitialiser l'authentification (utilisée par d'autres modules)
export function resetAuthentication() {
  authLog('Réinitialisation forcée de l\'authentification depuis un module externe');
  isAuthenticated = false;
  authToken = null;
  
  // Nettoyer les stockages
  try { 
    window.sessionStorage.removeItem('authTokenBackup'); 
  } catch (e) {}
  
  chrome.storage.local.remove('authToken', () => {
    if (chrome.runtime.lastError) {
      authLog(`Erreur lors de la suppression du token: ${chrome.runtime.lastError.message}`, 'error');
    } else {
      authLog('Token supprimé du stockage local');
    }
  });
  
  // Notifier les composants
  broadcastAuthStatus();
}

// Fonction publique pour définir directement un token (utilisée pour les récupérations d'urgence)
export function setToken(token) {
  if (!token) {
    authLog('Tentative de définition d\'un token nul ou vide!', 'error');
    return false;
  }
  
  authLog(`Définition directe du token: ${token.substring(0, 4)}...${token.substring(token.length-4)}`);
  authToken = token;
  isAuthenticated = true;
  
  // Sauvegarder dans la session
  try { 
    window.sessionStorage.setItem('authTokenBackup', token); 
  } catch (e) {}
  
  // Sauvegarder dans le stockage local
  chrome.storage.local.set({ 'authToken': token }, () => {
    if (chrome.runtime.lastError) {
      authLog(`Erreur lors de l'enregistrement du token: ${chrome.runtime.lastError.message}`, 'error');
    }
  });
  
  return true;
}
