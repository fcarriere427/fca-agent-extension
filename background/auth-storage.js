// FCA-Agent - Module de gestion du stockage pour l'authentification
// Ce module gère la sauvegarde, le chargement et la suppression des tokens d'authentification

import { createLogger } from '../utils/logger.js';

// Création d'une instance de logger spécifique pour ce module
const logger = createLogger('auth-storage');

/**
 * Sauvegarde un token d'authentification dans le stockage local
 * @param {string} token - Token à sauvegarder
 * @returns {Promise<boolean>} - Résultat de l'opération (true si succès)
 * @throws {Error} Si le token est invalide
 */
export async function saveTokenToStorage(token) {
  try {
    if (!token) {
      logger.error('Tentative de sauvegarde d\'un token nul ou vide!');
      return false;
    }
    
    // Variables pour traquer les états de sauvegarde
    let sessionSaveCompleted = false;
    let localSaveCompleted = false;
    
    // Sauvegarde du token normalisé (pour éviter les problèmes d'incohérence)
    const normalizedToken = String(token).trim();
    
    logger.debug('Début de la sauvegarde du token', { 
      tokenLength: normalizedToken.length,
      partialToken: `${normalizedToken.substring(0, 4)}...${normalizedToken.substring(normalizedToken.length-4)}`
    });
    
    // Sauvegarde dans chrome.storage.session pour une récupération rapide
    const sessionPromise = new Promise(resolve => {
      chrome.storage.session.set({'authTokenBackup': normalizedToken}, () => {
        if (chrome.runtime.lastError) {
          logger.error('Impossible de sauvegarder le token en session storage', {
            error: chrome.runtime.lastError.message
          });
          resolve(false);
        } else {
          logger.info('Token sauvegardé en session storage pour récupération d\'urgence');
          sessionSaveCompleted = true;
          resolve(true);
        }
      });
    });
    
    // Sauvegarde dans le stockage local (persistant)
    const localPromise = new Promise((resolve) => {
      chrome.storage.local.set({ 'authToken': normalizedToken }, () => {
        if (chrome.runtime.lastError) {
          logger.error('Erreur lors de l\'enregistrement du token', {
            error: chrome.runtime.lastError.message
          });
          resolve(false);
        } else {
          logger.info('Token enregistré dans le stockage local', {
            partialToken: `${normalizedToken.substring(0, 4)}...${normalizedToken.substring(normalizedToken.length-4)}`
          });
          localSaveCompleted = true;
          resolve(true);
        }
      });
    });
    
    // Vérification des résultats de sauvegarde
    const [sessionSuccess, localSuccess] = await Promise.all([sessionPromise, localPromise]);
    
    if (!sessionSuccess || !localSuccess) {
      logger.warn('Alerte: Certaines opérations de sauvegarde ont échoué!', {
        sessionSuccess,
        localSuccess
      });
    }
    
    // Vérification de cohérence (programmée de manière asynchrone)
    setTimeout(async () => {
      try {
        // Vérification entre session et local storage
        const [sessionToken, localToken] = await Promise.all([
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
        ]);
        
        if (!sessionToken && !localToken) {
          logger.error('ALERTE: Aucun token trouvé dans les stockages après sauvegarde!');
        } else if (sessionToken !== localToken) {
          logger.error('ALERTE: Incohérence entre les tokens du session storage et du local storage!');
          
          // Tentative de réparation
          const validToken = sessionToken || localToken;
          if (validToken) {
            logger.warn('Tentative de réparation des stockages...');
            await Promise.all([
              new Promise(resolve => chrome.storage.session.set({'authTokenBackup': validToken}, resolve)),
              new Promise(resolve => chrome.storage.local.set({'authToken': validToken}, resolve))
            ]);
            logger.info('Réparation effectuée : tokens synchronisés dans les deux stockages');
          }
        } else if (sessionToken !== normalizedToken) {
          logger.error('ALERTE: Incohérence entre le token en mémoire et celui du stockage!');
        } else {
          logger.debug('Vérification positive: tokens cohérents dans tous les stockages');
        }
      } catch (verificationError) {
        logger.error('Erreur pendant la vérification de cohérence des tokens', null, verificationError);
      }
    }, 150);
    
    return sessionSuccess && localSuccess;
  } catch (error) {
    logger.error('Erreur inattendue lors de la sauvegarde du token', null, error);
    throw new Error(`Échec de la sauvegarde du token: ${error.message}`);
  }
}

/**
 * Récupère le token d'authentification depuis le stockage local
 * @returns {Promise<string|null>} - Token récupéré ou null si non trouvé
 */
export async function loadTokenFromStorage() {
  try {
    logger.debug('Tentative de chargement du token depuis le stockage local');
    
    return new Promise((resolve) => {
      chrome.storage.local.get(['authToken'], (result) => {
        if (chrome.runtime.lastError) {
          logger.error('Erreur lors du chargement du token', {
            error: chrome.runtime.lastError.message
          });
          resolve(null);
        } else if (result.authToken) {
          const token = result.authToken;
          logger.info('Token chargé depuis le stockage local', {
            tokenLength: token.length,
            partialToken: `${token.substring(0, 4)}...${token.substring(token.length-4)}`
          });
          
          // Sauvegarde de secours en chrome.storage.session
          chrome.storage.session.set({'authTokenBackup': token}, () => {
            if (chrome.runtime.lastError) {
              logger.warn('Impossible de sauvegarder le token en session storage', {
                error: chrome.runtime.lastError.message
              });
            } else {
              logger.debug('Token sauvegardé en session storage après chargement');
            }
          });
          
          resolve(token);
        } else {
          logger.info('Aucun token trouvé dans le stockage local');
          resolve(null);
        }
      });
    });
  } catch (error) {
    logger.error('Erreur inattendue lors du chargement du token', null, error);
    return null;
  }
}

/**
 * Récupère le token depuis la storage session
 * @returns {Promise<string|null>} - Token récupéré ou null si non trouvé
 */
export async function getSessionToken() {
  try {
    logger.debug('Tentative de récupération du token depuis le stockage de session');
    
    return new Promise((resolve) => {
      chrome.storage.session.get(['authTokenBackup'], (result) => {
        if (chrome.runtime.lastError) {
          logger.error('Erreur lors de la récupération du token de session', {
            error: chrome.runtime.lastError.message
          });
          resolve(null);
        } else if (result && result.authTokenBackup) {
          logger.info('Token récupéré depuis le stockage de session', {
            tokenLength: result.authTokenBackup.length
          });
          resolve(result.authTokenBackup);
        } else {
          logger.info('Aucun token trouvé dans le stockage de session');
          resolve(null);
        }
      });
    });
  } catch (error) {
    logger.error('Erreur inattendue lors de la récupération du token de session', null, error);
    return null;
  }
}

/**
 * Supprime le token d'authentification des différents stockages
 * @returns {Promise<boolean>} - Résultat de l'opération (true si succès)
 */
export async function clearTokenFromStorage() {
  try {
    logger.info('Début de la suppression des tokens de tous les stockages');
    
    // Nettoyer le chrome.storage.session
    const sessionPromise = new Promise((resolve) => {
      chrome.storage.session.remove('authTokenBackup', () => {
        if (chrome.runtime.lastError) {
          logger.warn('Erreur lors de la suppression du token de session', {
            error: chrome.runtime.lastError.message
          });
          resolve(false);
        } else {
          logger.debug('Token supprimé du stockage de session');
          resolve(true);
        }
      });
    });
    
    // Nettoyer le stockage local
    const localPromise = new Promise((resolve) => {
      chrome.storage.local.remove('authToken', () => {
        if (chrome.runtime.lastError) {
          logger.error('Erreur lors de la suppression du token local', {
            error: chrome.runtime.lastError.message
          });
          resolve(false);
        } else {
          logger.debug('Token supprimé du stockage local');
          resolve(true);
        }
      });
    });
    
    const [sessionSuccess, localSuccess] = await Promise.all([sessionPromise, localPromise]);
    
    const overallSuccess = sessionSuccess && localSuccess;
    logger.info(`Suppression des tokens ${overallSuccess ? 'réussie' : 'partiellement échouée'}`, {
      sessionSuccess,
      localSuccess
    });
    
    return overallSuccess;
  } catch (error) {
    logger.error('Erreur inattendue lors de la suppression des tokens', null, error);
    return false;
  }
}

/**
 * Vérifie la cohérence des tokens dans les différents stockages
 * @returns {Promise<{isConsistent: boolean, token: string|null}>} Statut de cohérence et token valide si trouvé
 */
export async function checkTokenConsistency() {
  try {
    logger.debug('Vérification de la cohérence des tokens dans les stockages');
    
    const [sessionToken, localToken] = await Promise.all([
      getSessionToken(),
      loadTokenFromStorage()
    ]);
    
    const isConsistent = (sessionToken === localToken) && (sessionToken !== null);
    
    logger.info('Vérification de cohérence terminée', { 
      isConsistent,
      hasSessionToken: !!sessionToken,
      hasLocalToken: !!localToken
    });
    
    return {
      isConsistent,
      token: sessionToken || localToken
    };
  } catch (error) {
    logger.error('Erreur lors de la vérification de cohérence des tokens', null, error);
    return {
      isConsistent: false,
      token: null
    };
  }
}

// Méthode obsolète maintenue pour compatibilité
export async function getBackupToken() {
  logger.warn('getBackupToken() appelé - cette méthode est obsolète, utilisez getSessionToken() à la place');
  return await getSessionToken();
}

export default {
  saveTokenToStorage,
  loadTokenFromStorage,
  getSessionToken,
  clearTokenFromStorage,
  checkTokenConsistency,
  getBackupToken
};
