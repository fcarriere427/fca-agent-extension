// FCA-Agent - Module d'authentification

import { getApiUrl } from './config.js';

// État d'authentification - explicitement marqué comme local
let authToken = null;
let isAuthenticated = false;

// Logger spécifique à l'authentification
function authLog(message, level = 'info') {
  const prefix = '[EXT:AUTH]';
  switch(level) {
    case 'error':
      console.error(`${prefix} ${message}`);
      break;
    case 'warn':
      console.warn(`${prefix} ${message}`);
      break;
    default:
      console.log(`${prefix} ${message}`);
  }
}

// Méthodes d'accès
export function getAuthStatus() {
  authLog(`getAuthStatus() => isAuthenticated=${isAuthenticated}, hasToken=${!!authToken}`);
  return { isAuthenticated, hasToken: !!authToken };
}

export function setAuthenticated(status, token = null) {
  authLog(`setAuthenticated(${status}, ${token ? 'token présent' : 'pas de token'})`);
  
  isAuthenticated = status;
  
  // Mettre à jour le token seulement si un nouveau est fourni ou si on déconnecte
  if (status && token) {
    authToken = token;
    // Stockage local seulement si authentifié avec un token
    chrome.storage.local.set({ 'authToken': token }, () => {
      authLog('Token enregistré dans le stockage local');
    });
  } else if (!status) {
    // Si déconnecté, effacer le token
    authToken = null;
    chrome.storage.local.remove('authToken', () => {
      authLog('Token supprimé du stockage local');
    });
  }
  
  // Notifier autres composants (popup, etc.)
  broadcastAuthStatus();
}

// Méthode dédiée pour diffuser le statut d'authentification
function broadcastAuthStatus() {
  const status = { isAuthenticated, hasToken: !!authToken };
  authLog(`Diffusion du statut d'authentification: ${JSON.stringify(status)}`);
  
  try {
    chrome.runtime.sendMessage({ 
      action: 'authStatusChanged', 
      status: status 
    }, () => {
      if (chrome.runtime.lastError) {
        authLog('Message authStatusChanged non délivré (normal au démarrage)', 'warn');
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
      if (result.authToken) {
        authToken = result.authToken;
        isAuthenticated = true;
        authLog(`Session authentifiée chargée: token=${result.authToken.substring(0, 10)}...`);
      } else {
        isAuthenticated = false;
        authToken = null;
        authLog('Aucune session authentifiée trouvée dans le stockage local');
      }
      
      // Annoncer le statut d'authentification au démarrage
      broadcastAuthStatus();
      
      resolve({ isAuthenticated, hasToken: !!authToken });
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
      credentials: 'include'
    });
    
    // Lecture du corps de la réponse
    let responseData;
    try {
      responseData = await response.json();
    } catch (jsonError) {
      authLog(`Erreur lors du parsing de la réponse: ${jsonError.message}`, 'error');
      responseData = {};
    }
    
    authLog(`Réponse du serveur: status=${response.status}, data=${JSON.stringify(responseData)}`);
    
    // Si succès, mettre à jour l'état d'authentification
    if (response.ok) {
      // Utiliser le token fourni par le serveur ou générer un identifiant local
      const token = responseData.token || `local_auth_${Date.now()}`;
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
    // D'abord, mise à jour locale pour assurer la déconnexion même si le serveur échoue
    setAuthenticated(false);
    
    // Puis, notification au serveur
    const response = await fetch(`${apiUrl}/auth/logout`, {
      method: 'POST',
      credentials: 'include'
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
  authLog(`Vérification d'authentification avec le serveur: ${apiUrl}/auth/check`);
  
  try {
    const response = await fetch(`${apiUrl}/auth/check`, {
      method: 'GET',
      credentials: 'include',
      headers: getAuthHeaders(),
      cache: 'no-cache' // IMPORTANT: Ne pas utiliser le cache
    });
    
    // Le serveur peut renvoyer 304 Not Modified si rien n'a changé
    if (response.status === 304) {
      authLog('Réponse 304 Not Modified - Aucun changement de statut');
      return isAuthenticated; // On conserve l'état local actuel
    }
    
    // Lecture du corps de la réponse pour les autres codes
    if (response.ok) {
      const data = await response.json();
      authLog(`Résultat du serveur: authenticated=${data.authenticated}`);
      
      // Mise à jour du statut local si différent
      if (data.authenticated !== isAuthenticated) {
        authLog(`Mise à jour du statut local: ${isAuthenticated} -> ${data.authenticated}`);
        setAuthenticated(data.authenticated, data.authenticated ? (authToken || `server_validated_${Date.now()}`) : null);
      }
      
      return data.authenticated;
    } else {
      authLog(`Vérification échouée: statut ${response.status}`, 'warn');
      // On considère comme non authentifié si erreur
      if (isAuthenticated) {
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
    return {};
  }
  
  authLog('Génération des headers d\'authentification');
  return { 'Authorization': `Bearer ${authToken}` };
}
