// FCA-Agent - Module d'authentification principal

import { getApiUrl } from './config.js';
import { createModuleLogger } from '../utils/logger.js';
import { 
  saveTokenToStorage, 
  loadTokenFromStorage, 
  clearTokenFromStorage, 
  getBackupToken,
  getSessionToken
} from './auth-storage.js';
import { 
  loginRequest, 
  logoutRequest, 
  checkAuthRequest, 
  generateDebugToken 
} from './auth-api.js';

// Création d'une instance de logger spécifique pour ce module
const logger = createModuleLogger('auth.js');

// État d'authentification - explicitement marqué comme local
let authToken = null;
let isAuthenticated = false;

// Méthodes d'accès
export function getAuthStatus() {
  logger.log(`getAuthStatus() => isAuthenticated=${isAuthenticated}, hasToken=${!!authToken}`);
  return { isAuthenticated, hasToken: !!authToken };
}

/**
 * Définit l'état d'authentification et gère le token
 * @param {boolean} status - Nouvel état d'authentification
 * @param {string|null} token - Nouveau token (optionnel)
 */
export function setAuthenticated(status, token = null) {
  logger.log(`setAuthenticated(${status}, ${token ? `token ${token.substring(0, 4)}...${token.substring(token.length-4)}` : 'pas de token'})`);
  
  isAuthenticated = status;
  
  // Mettre à jour le token seulement si un nouveau est fourni ou si on déconnecte
  if (status && token) {
    authToken = token;
    
    // Sauvegarde de secours en sessionStorage (pour récupération synchrone)
    chrome.storage.session.set({'authTokenBackup': token}, () => {
      if (chrome.runtime.lastError) {
        logger.error(FILE_NAME, `Impossible de sauvegarder le token en session storage: ${chrome.runtime.lastError.message}`);
      } else {
        logger.log(FILE_NAME, `Token sauvegardé en session storage pour récupération d'urgence`);
      }
    });
    
    // Sauvegarde dans le stockage principal
    saveTokenToStorage(token);
  } else if (!status) {
    // Si déconnecté, effacer le token
    authToken = null;
    clearTokenFromStorage();
  }
  
  // Notifier autres composants (popup, etc.)
  broadcastAuthStatus();
}

/**
 * Diffuse le statut d'authentification aux autres composants
 */
function broadcastAuthStatus() {
  const status = { 
    isAuthenticated, 
    hasToken: !!authToken,
    tokenPreview: authToken ? `${authToken.substring(0, 4)}...${authToken.substring(authToken.length-4)}` : null 
  };
  logger.log(`Diffusion du statut d'authentification: ${JSON.stringify(status)}`);
  
  try {
    chrome.runtime.sendMessage({ 
      action: 'authStatusChanged', 
      status: status 
    }, () => {
      if (chrome.runtime.lastError) {
        logger.warn(`Message authStatusChanged non délivré: ${chrome.runtime.lastError.message}`);
      } else {
        logger.log('Message authStatusChanged délivré avec succès');
      }
    });
  } catch (error) {
    logger.error(`Erreur lors de la diffusion du statut: ${error.message}`);
  }
}

/**
 * Charge l'état d'authentification depuis le stockage local
 * @returns {Promise<Object>} - État d'authentification
 */
export function loadAuthState() {
  logger.log('Chargement du statut d\'authentification depuis le stockage local...');
  
  return new Promise(async (resolve) => {
    const token = await loadTokenFromStorage();
    
    if (token) {
      authToken = token;
      isAuthenticated = true;
      
      // Vérification auprès du serveur pour confirmer la validité
      setTimeout(() => {
        checkAuthWithServer()
          .then(result => {
            if (result === false) {
              logger.error('ALERTE: Le token chargé semble invalide selon le serveur!');
              // On ne reset pas l'authentification ici pour éviter les déconnexions en cas de problème réseau
            } else {
              logger.log('Token chargé validé par le serveur');
            }
          })
          .catch(error => {
            logger.error(`Erreur lors de la validation du token: ${error}`);
          });
      }, 500); // Attendre que les services soient prêts
    } else {
      isAuthenticated = false;
      authToken = null;
      logger.log('Aucune session authentifiée trouvée dans le stockage local');
    }
    
    // Annoncer le statut d'authentification au démarrage
    broadcastAuthStatus();
    
    resolve({ 
      isAuthenticated, 
      hasToken: !!authToken,
      tokenPreview: authToken ? `${authToken.substring(0, 4)}...${authToken.substring(authToken.length-4)}` : null 
    });
  });
}

/**
 * Tente de s'authentifier auprès du serveur
 * @param {string} password - Mot de passe utilisateur
 * @returns {Promise<Object>} - Résultat de l'authentification
 */
export async function loginToServer(password) {
  // D'abord, réinitialiser l'état d'authentification
  isAuthenticated = false;
  authToken = null;
  
  // Supprimer tout ancien token du stockage par précaution
  chrome.storage.session.remove('authTokenBackup', () => {
    if (chrome.runtime.lastError) {
      logger.warn(`Erreur lors de la suppression du token de session: ${chrome.runtime.lastError.message}`);
    }
  });
  
  // Gestion du mode debug (pour tests locaux uniquement)
  if (password === 'debug') {
    const debugToken = generateDebugToken();
    
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
  
  // Requête d'authentification normale
  const result = await loginRequest(password);
  
  if (result.success) {
    const token = result.token;
    
    // 1. D'abord, sauvegarder dans la session storage pour accès immédiat
    try {
      window.sessionStorage.setItem('authTokenBackup', token);
      logger.log('Token sauvegardé en session storage (sauvegarde rapide)');
    } catch (e) {
      logger.warn(`Impossible de sauvegarder en session storage: ${e.message}`);
    }
    
    // 2. Stockage explicite du token dans le storage local (persistant)
    try {
      await saveTokenToStorage(token);
    } catch (storageError) {
      logger.error(`Échec de sauvegarde du token dans le stockage local: ${storageError.message}`);
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
      logger.error('ERREUR CRITIQUE: Token non disponible dans les headers après connexion!');
    } else {
      logger.log(`Vérification des headers après login: ${JSON.stringify(headers)}`);
    }
  }
  
  return result;
}

/**
 * Déconnecte l'utilisateur du serveur
 * @returns {Promise<boolean>} - Résultat de la déconnexion
 */
export async function logoutFromServer() {
  // D'abord, mise à jour locale pour assurer la déconnexion
  setAuthenticated(false);
  
  // Puis, notification au serveur (avec le token dans l'en-tête)
  const result = await logoutRequest(getAuthHeaders());
  return result;
}

/**
 * Vérifie l'état d'authentification auprès du serveur
 * @returns {Promise<boolean|Object>} - Résultat de la vérification
 */
export async function checkAuthWithServer() {
  const headers = getAuthHeaders();
  
  // Vérifier la disponibilité du token avant de poursuivre
  if (!headers.Authorization && isAuthenticated) {
    // Incohérence: on est marqué comme authentifié mais pas de token dans les headers
    logger.error('ERREUR CRITIQUE: Marqué comme authentifié mais aucun token disponible!');
    
    // Essayer de récupérer depuis le stockage de secours
    const backupToken = await getSessionToken();
    if (backupToken) {
      logger.warn('Récupération du token depuis le stockage de secours');
      authToken = backupToken;
      return checkAuthWithServer(); // Réessayer avec le token récupéré
    } else {
      // Pas de sauvegarde disponible non plus
      logger.error('Aucun token de sauvegarde disponible, déconnexion forcée');
      resetAuthentication();
      return false;
    }
  }
  
  const result = await checkAuthRequest(headers);
  
  // Traitement du résultat
  if (result === true || result === false) {
    // Si le serveur nous dit que le statut a changé
    if (result !== isAuthenticated) {
      logger.log(`Mise à jour du statut local: ${isAuthenticated} -> ${result}`);
      if (result) {
        // Si le serveur nous dit qu'on est authentifié mais qu'on ne l'était pas avant
        isAuthenticated = true;
        if (!authToken) {
          authToken = `server_validated_${Date.now()}`;
          saveTokenToStorage(authToken);
        }
      } else {
        // Si le serveur nous dit qu'on n'est pas authentifié, on efface le token
        resetAuthentication();
      }
      broadcastAuthStatus();
    }
    return result;
  } else if (result && result.unauthorized) {
    // Token invalide ou expiré
    logger.warn('Token invalide ou expiré, déconnexion forcée');
    resetAuthentication();
    return false;
  } else if (result && result.noChange) {
    // Aucun changement, on conserve l'état actuel
    return isAuthenticated;
  } else if (result && result.error) {
    // Erreur de connexion, conserver l'état local
    logger.error(`Erreur lors de la vérification: ${result.message}`);
    return isAuthenticated;
  }
  
  // Par défaut, on garde l'état actuel
  return isAuthenticated;
}

/**
 * Fournit les en-têtes d'authentification pour les requêtes API
 * @returns {Object} - En-têtes avec le token d'authentification
 */
export function getAuthHeaders() {
  if (!authToken) {
    logger.warn('WARNING: getAuthHeaders appelé sans token disponible!');
    // Tentative de récupération synchrone depuis une variable de sauvegarde
    const backupToken = getBackupToken();
    if (backupToken) {
      logger.warn(`Récupération d'urgence du token depuis la sauvegarde de session`);
      authToken = backupToken;
      isAuthenticated = true;
    } else {
      logger.error('ERREUR CRITIQUE: Aucun token disponible, authentification compromise');
      // IMPORTANT: Déclencher un rechargement d'authentification depuis le stockage
      setTimeout(() => { loadAuthState(); }, 100);
      return {};
    }
  }
  
  logger.log(`Génération des headers d'authentification avec token: ${authToken.substring(0, 4)}...${authToken.substring(authToken.length-4)}`);
  return { 'Authorization': `Bearer ${authToken}` };
}

/**
 * Tente de récupérer un token valide en cas d'incohérence
 * @returns {Promise<boolean>} - Succès de la récupération
 */
export async function handleTokenInconsistency() {
  logger.log('Début de la récupération de token');
  
  // Essayer de récupérer depuis sessionStorage
  const backupToken = getBackupToken();
  if (backupToken) {
    logger.warn('Récupération du token de sauvegarde');
    return setToken(backupToken);
  }
  
  // Essayer de récupérer depuis le stockage local
  const storedToken = await loadTokenFromStorage();
  if (storedToken) {
    logger.warn('Récupération du token stocké localement');
    return setToken(storedToken);
  }
  
  // Aucun token disponible
  logger.error('Aucun token disponible, déconnexion forcée');
  return resetAuthentication();
}

/**
 * Réinitialise complètement l'authentification
 * @returns {boolean} - Succès de l'opération
 */
export function resetAuthentication() {
  logger.log('Réinitialisation forcée de l\'authentification');
  isAuthenticated = false;
  authToken = null;
  
  // Nettoyer les stockages
  clearTokenFromStorage();
  
  // Notifier les composants
  broadcastAuthStatus();

  return false;
}

/**
 * Définit directement un token (utilisée pour les récupérations d'urgence)
 * @param {string} token - Token à définir
 * @returns {boolean} - Succès de l'opération
 */
export function setToken(token) {
  if (!token) {
    logger.error('Tentative de définition d\'un token nul ou vide!');
    return false;
  }
  
  logger.log(`Définition directe du token: ${token.substring(0, 4)}...${token.substring(token.length-4)}`);
  authToken = token;
  isAuthenticated = true;
  
  // Sauvegarder dans les différents stockages
  saveTokenToStorage(token);
  broadcastAuthStatus();
  
  return true;
}
