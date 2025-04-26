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
  
  // Variables pour traquer les états de sauvegarde
  let sessionSaveCompleted = false;
  let localSaveCompleted = false;
  
  // Sauvegarde du token normalisé (pour éviter les problèmes d'incohérence dus aux espaces, etc.)
  const normalizedToken = String(token).trim();
  
  // Sauvegarde dans chrome.storage.session pour une récupération rapide
  const sessionPromise = new Promise(resolve => {
    chrome.storage.session.set({'authTokenBackup': normalizedToken}, () => {
      if (chrome.runtime.lastError) {
        authLog(`Impossible de sauvegarder le token en session storage: ${chrome.runtime.lastError.message}`, 'error');
        resolve(false);
      } else {
        authLog('Token sauvegardé en session storage pour récupération d\'urgence');
        sessionSaveCompleted = true;
        resolve(true);
      }
    });
  });
  
  // Sauvegarde dans le stockage local (persistant)
  const localPromise = new Promise((resolve) => {
    chrome.storage.local.set({ 'authToken': normalizedToken }, () => {
      if (chrome.runtime.lastError) {
        authLog(`Erreur lors de l'enregistrement du token: ${chrome.runtime.lastError.message}`, 'error');
        resolve(false);
      } else {
        authLog(`Token enregistré dans le stockage local: ${normalizedToken.substring(0, 4)}...${normalizedToken.substring(normalizedToken.length-4)}`);
        localSaveCompleted = true;
        resolve(true);
      }
    });
  });
  
  // Vérification de la cohérence après sauvegarde (avec délai pour laisser le temps aux opérations)
  return Promise.all([sessionPromise, localPromise])
    .then(([sessionSuccess, localSuccess]) => {
      if (!sessionSuccess || !localSuccess) {
        authLog('Alerte: Certaines opérations de sauvegarde ont échoué!', 'warn');
      }
      
      // Attendre un peu puis vérifier la cohérence
      setTimeout(() => {
        // Vérification entre session et local storage
        Promise.all([
          new Promise(resolve => {
            chrome.storage.session.get(['authTokenBackup'], result => {
              resolve(result?.authTokenBackup);
            });
          }),
          new Promise(resolve => {
            chrome.storage.local.get(['authToken'], result => {
              resolve(result?.authToken);
            });
          })
        ]).then(([sessionToken, localToken]) => {
          if (!sessionToken && !localToken) {
            authLog('ALERTE: Aucun token trouvé dans les stockages après sauvegarde!', 'error');
          } else if (sessionToken !== localToken) {
            authLog(`ALERTE: Incohérence entre les tokens du session storage et du local storage!`, 'error');
            // Tentative de réparation
            const validToken = sessionToken || localToken;
            if (validToken) {
              authLog('Tentative de réparation des stockages...', 'warn');
              Promise.all([
                new Promise(resolve => chrome.storage.session.set({'authTokenBackup': validToken}, resolve)),
                new Promise(resolve => chrome.storage.local.set({'authToken': validToken}, resolve))
              ]).then(() => {
                authLog('Réparation effectuée : tokens synchronisés dans les deux stockages', 'warn');
              });
            }
          } else if (sessionToken !== normalizedToken) {
            authLog(`ALERTE: Incohérence entre le token en mémoire et celui du stockage!`, 'error');
            // Ne pas essayer de corriger ici, laisser le soin à handleTokenInconsistency() de résoudre
          } else {
            authLog('Vérification positive: tokens cohérents dans tous les stockages', 'debug');
          }
        });
      }, 150); // Délai légèrement plus long pour s'assurer que les opérations async sont terminées
      
      return sessionSuccess && localSuccess;
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
        
        // Sauvegarde de secours en chrome.storage.session pour récupération future
        chrome.storage.session.set({'authTokenBackup': token}, () => {
          if (chrome.runtime.lastError) {
            authLog(`Impossible de sauvegarder le token en session storage: ${chrome.runtime.lastError.message}`, 'error');
          } else {
            authLog('Token sauvegardé en session storage après chargement');
          }
        });
        
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
  // Cette fonction doit maintenant retourner une promesse car chrome.storage est asynchrone
  // Pour compatibilité avec le code existant, nous retournons null immédiatement
  authLog('getBackupToken() appelé - cette méthode est obsolète, utilisez getSessionToken() à la place', 'warn');
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
  // Nettoyer la sauvegarde en chrome.storage.session
  // Cette partie est déjà gérée par le code qui suit
  
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
