// FCA-Agent - Module de gestion du stockage pour l'authentification

import { authLog } from './auth-logger.js';

/**
 * Sauvegarde un token d'authentification dans le stockage local
 * @param {string} token - Token à sauvegarder
 * @returns {Promise<boolean>} - Résultat de l'opération
 */
export function saveTokenToStorage(token) {
  if (!token) {
    authLog('Tentative de sauvegarde d\'un token nul ou vide!', 'error');
    return Promise.resolve(false);
  }
  
  // Sauvegarde dans sessionStorage pour une récupération rapide
  try {
    window.sessionStorage.setItem('authTokenBackup', token);
    authLog('Token sauvegardé en session storage pour récupération d\'urgence');
  } catch (e) {
    authLog(`Impossible de sauvegarder le token en session storage: ${e.message}`, 'error');
  }
  
  // Sauvegarde dans le stockage local (persistant)
  return new Promise((resolve) => {
    chrome.storage.local.set({ 'authToken': token }, () => {
      if (chrome.runtime.lastError) {
        authLog(`Erreur lors de l'enregistrement du token: ${chrome.runtime.lastError.message}`, 'error');
        resolve(false);
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
        
        resolve(true);
      }
    });
  });
}

/**
 * Récupère le token d'authentification depuis le stockage local
 * @returns {Promise<string|null>} - Token récupéré ou null
 */
export function loadTokenFromStorage() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['authToken'], (result) => {
      if (chrome.runtime.lastError) {
        authLog(`Erreur lors du chargement du token: ${chrome.runtime.lastError.message}`, 'error');
        resolve(null);
      } else if (result.authToken) {
        const token = result.authToken;
        authLog(`Token chargé depuis le stockage: ${token.substring(0, 4)}...${token.substring(token.length-4)}`);
        
        // Sauvegarde de secours en sessionStorage pour récupération synchrone future
        try {
          window.sessionStorage.setItem('authTokenBackup', token);
          authLog('Token sauvegardé en session storage après chargement');
        } catch (e) {
          authLog(`Impossible de sauvegarder le token en session storage: ${e.message}`, 'error');
        }
        
        resolve(token);
      } else {
        authLog('Aucun token trouvé dans le stockage local');
        resolve(null);
      }
    });
  });
}

/**
 * Récupère le token de secours depuis sessionStorage
 * @returns {string|null} - Token de secours ou null
 */
export function getBackupToken() {
  try {
    const token = window.sessionStorage.getItem('authTokenBackup');
    if (token) {
      authLog('Token récupéré depuis la sauvegarde en session storage', 'debug');
      return token;
    }
  } catch (e) {
    authLog(`Erreur lors de la récupération du token de session: ${e.message}`, 'error');
  }
  return null;
}

/**
 * Récupère le token depuis la storage session
 * @returns {Promise<string|null>} - Token récupéré ou null
 */
export function getSessionToken() {
  return new Promise((resolve) => {
    chrome.storage.session.get(['authTokenBackup'], (result) => {
      if (chrome.runtime.lastError) {
        authLog(`Erreur lors de la récupération du token de session: ${chrome.runtime.lastError.message}`, 'error');
        resolve(null);
      } else if (result && result.authTokenBackup) {
        authLog('Token récupéré depuis le stockage de session', 'debug');
        resolve(result.authTokenBackup);
      } else {
        resolve(null);
      }
    });
  });
}

/**
 * Supprime le token d'authentification des différents stockages
 * @returns {Promise<boolean>} - Résultat de l'opération
 */
export function clearTokenFromStorage() {
  // Nettoyer la sauvegarde en session storage
  try {
    window.sessionStorage.removeItem('authTokenBackup');
    authLog('Token supprimé de la session storage');
  } catch (e) {
    authLog(`Erreur lors de la suppression du token de session: ${e.message}`, 'warn');
  }
  
  // Nettoyer le chrome.storage.session
  chrome.storage.session.remove('authTokenBackup', () => {
    if (chrome.runtime.lastError) {
      authLog(`Erreur lors de la suppression du token de session: ${chrome.runtime.lastError.message}`, 'warn');
    } else {
      authLog('Token supprimé du stockage de session');
    }
  });
  
  // Nettoyer le stockage local
  return new Promise((resolve) => {
    chrome.storage.local.remove('authToken', () => {
      if (chrome.runtime.lastError) {
        authLog(`Erreur lors de la suppression du token: ${chrome.runtime.lastError.message}`, 'error');
        resolve(false);
      } else {
        authLog('Token supprimé du stockage local');
        resolve(true);
      }
    });
  });
}
