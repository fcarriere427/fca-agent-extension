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
    // Stockage local seulement si authentifié avec un token
    chrome.storage.local.set({ 'authToken': token }, () => {
      if (chrome.runtime.lastError) {
        authLog(`Erreur lors de l'enregistrement du token: ${chrome.runtime.lastError.message}`, 'error');
      } else {
        authLog(`Token enregistré dans le stockage local: ${token.substring(0, 4)}...${token.substring(token.length-4)}`);
      }
    });
  } else if (!status) {
    // Si déconnecté, effacer le token
    authLog('Effacement du token (déconnexion)');
    authToken = null;
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
        // Test immédiat de validité du token pour déboguer
        authLog(`Headers qui seront utilisés: ${JSON.stringify(getAuthHeaders())}`, 'debug');
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

// Méthodes d'interaction avec l'API pour l'authentification
export async function loginToServer(password) {
  const apiUrl = getApiUrl();
  authLog(`Tentative de connexion à ${apiUrl}/auth/login`);
  
  try {
    const response = await fetch(`${apiUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
      // Plus besoin de 'credentials: include' car nous n'utilisons plus les cookies
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
      
      // Stockage explicite du token avant de continuer
      authToken = token;
      await new Promise((resolve) => {
        chrome.storage.local.set({ 'authToken': token }, () => {
          if (chrome.runtime.lastError) {
            authLog(`Erreur lors de l'enregistrement du token: ${chrome.runtime.lastError.message}`, 'error');
          } else {
            authLog(`Token enregistré avec succès dans le stockage local`);
          }
          resolve();
        });
      });
      
      // Mise à jour du statut d'authentification
      setAuthenticated(true, token);
      return { success: true, token };
    } else {
      // Échec d'authentification
      authLog(`Échec d'authentification: ${responseData.error || response.statusText}`, 'error');
      setAuthenticated(false);
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
      setAuthenticated(true, debugToken);
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
  
  try {
    const response = await fetch(`${apiUrl}/auth/check`, {
      method: 'GET',
      // Plus besoin de 'credentials: include' car nous n'utilisons plus les cookies
      credentials: 'omit',
      headers: headers,
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
        setAuthenticated(data.authenticated, data.authenticated ? (authToken || `server_validated_${Date.now()}`) : null);
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
        authLog('Token invalide ou expiré, déconnexion locale', 'warn');
        setAuthenticated(false);
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
    return {};
  }
  
  authLog(`Génération des headers d'authentification avec token: ${authToken.substring(0, 4)}...${authToken.substring(authToken.length-4)}`);
  return { 'Authorization': `Bearer ${authToken}` };
}
