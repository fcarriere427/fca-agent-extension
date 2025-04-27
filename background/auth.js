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

/**
 * Module d'authentification principal
 * Gère l'authentification des utilisateurs et la persistance des sessions
 * @module auth
 */

// Création d'une instance de logger spécifique pour ce module
const logger = createModuleLogger('auth.js');

// État d'authentification - explicitement marqué comme local
let authToken = null;
let isAuthenticated = false;
let lastSyncTime = 0; // Timestamp de la dernière synchronisation

// Synchroniseur périodique des états d'authentification
const SYNC_INTERVAL = 30000; // 30 secondes
setInterval(async () => {
  // Vérifier s'il faut synchroniser (seulement si ça fait plus de x secondes)
  const now = Date.now();
  if (now - lastSyncTime < SYNC_INTERVAL / 2) {
    return; // Éviter les synchronisations trop fréquentes
  }
  
  try {
    logger.log('Synchronisation périodique des états d\'authentification...');
    
    // 1. Lire l'état actuel depuis les différents stockages
    const [sessionToken, localToken] = await Promise.all([
      new Promise(resolve => {
        chrome.storage.session.get(['authTokenBackup'], result => {
          resolve(result?.authTokenBackup || null);
        });
      }),
      new Promise(resolve => {
        chrome.storage.local.get(['authToken'], result => {
          resolve(result?.authToken || null);
        });
      })
    ]);
    
    // 2. Détecter les incohérences
    if (isAuthenticated && !authToken) {
      logger.warn('Incohérence détectée: authentifié sans token en mémoire');
      // Récupérer le token depuis l'un des stockages
      if (sessionToken || localToken) {
        const validToken = sessionToken || localToken;
        logger.warn(`Correction automatique: restauration du token ${validToken.substring(0, 4)}...`);
        authToken = validToken;
        // Diffuser le nouvel état
        broadcastAuthStatus();
      } else {
        logger.error('Aucun token trouvé dans les stockages mais marqué comme authentifié!');
        // Réinitialiser l'authentification
        resetAuthentication();
      }
    } else if (!isAuthenticated && authToken) {
      logger.warn('Incohérence détectée: token en mémoire mais marqué comme non authentifié');
      // Soit on corrige l'état, soit on supprime le token
      if (sessionToken || localToken) {
        logger.warn('Correction automatique: activation de l\'authentification');
        isAuthenticated = true;
        // Diffuser le nouvel état
        broadcastAuthStatus();
      } else {
        logger.warn('Suppression du token orphelin en mémoire');
        authToken = null;
      }
    } else if (authToken && (sessionToken !== authToken || localToken !== authToken)) {
      logger.warn('Incohérence détectée entre les différents stockages de token');
      // Synchroniser tous les stockages avec le token en mémoire
      await saveTokenToStorage(authToken);
      logger.log('Synchronisation des stockages effectuée');
    }
    
    lastSyncTime = now;
  } catch (error) {
    logger.error(`Erreur lors de la synchronisation périodique: ${error.message}`);
  }
}, SYNC_INTERVAL);

// Méthodes d'accès
/**
 * Retourne l'état d'authentification actuel
 * @returns {Object} État d'authentification {isAuthenticated, hasToken}
 */
export function getAuthStatus() {
  try {
    logger.debug(`getAuthStatus() => isAuthenticated=${isAuthenticated}, hasToken=${!!authToken}`);
    return { isAuthenticated, hasToken: !!authToken };
  } catch (error) {
    logger.error(`Erreur lors de la récupération de l'état d'authentification`, null, error);
    return { isAuthenticated: false, hasToken: false };
  }
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
    
    // Sauvegarde de secours en chrome.storage.session
    chrome.storage.session.set({'authTokenBackup': token}, () => {
      if (chrome.runtime.lastError) {
        logger.error(`Impossible de sauvegarder le token en session storage: ${chrome.runtime.lastError.message}`);
      } else {
        logger.log(`Token sauvegardé en session storage pour récupération d'urgence`);
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
/**
 * Diffuse le statut d'authentification aux autres composants de l'extension
 * Utilise à la fois chrome.runtime.sendMessage et chrome.storage pour la persistance
 */
async function broadcastAuthStatus() {
  try {
    const status = { 
      isAuthenticated, 
      hasToken: !!authToken,
      tokenPreview: authToken ? `${authToken.substring(0, 4)}...${authToken.substring(authToken.length-4)}` : null 
    };
    logger.info(`Diffusion du statut d'authentification`, {
      isAuthenticated: status.isAuthenticated,
      hasToken: status.hasToken
    });
    
    // Essayer d'abord avec chrome.runtime.sendMessage
    const sendMessage = () => {
      return new Promise(resolve => {
        chrome.runtime.sendMessage({ 
          action: 'authStatusChanged', 
          status: status 
        }, response => {
          if (chrome.runtime.lastError) {
            // Message d'erreur plus détaillé pour le débogage
            logger.warn(`Message authStatusChanged non délivré: ${chrome.runtime.lastError.message}`);
            
            // Journaliser l'erreur mais ne pas traiter comme critique
            // (normal au démarrage quand popup n'est pas encore ouvert)
            if (chrome.runtime.lastError.message.includes('Receiving end does not exist')) {
              logger.debug('Aucun récepteur disponible pour le message (normal si popup fermé)');
            }
            resolve(false);
          } else {
            logger.debug('Message authStatusChanged délivré avec succès');
            resolve(true);
          }
        });
      });
    };
    
    // Appel immédiat suivi d'un second appel décalé pour augmenter les chances de réception
    await sendMessage();
    setTimeout(async () => {
      await sendMessage();
    }, 500); // Second envoi après 500ms
    
    // Enregistrer l'état dans le stockage local pour permettre la récupération par d'autres composants
    await new Promise(resolve => {
      chrome.storage.local.set({ 'authStatus': status }, () => {
        if (chrome.runtime.lastError) {
          logger.warn(`Impossible de sauvegarder l'état d'authentification: ${chrome.runtime.lastError.message}`);
          resolve(false);
        } else {
          logger.debug('Statut d\'authentification sauvegardé dans le storage local');
          resolve(true);
        }
      });
    });
  } catch (error) {
    logger.error(`Erreur lors de la diffusion du statut`, null, error);
    
    // Tentative de sauvegarde dans le stockage comme fallback
    try {
      await new Promise(resolve => {
        chrome.storage.local.set({ 'authStatus': {
          isAuthenticated,
          hasToken: !!authToken
        }}, resolve);
      });
    } catch (storageError) {
      logger.error(`Échec complet de la communication`, null, storageError);
    }
  }
}

/**
 * Charge l'état d'authentification depuis le stockage local
 * @returns {Promise<Object>} - État d'authentification
 */
/**
 * Charge l'état d'authentification depuis le stockage local
 * Vérifie également la validité du token auprès du serveur
 * @returns {Promise<Object>} État d'authentification {isAuthenticated, hasToken, tokenPreview}
 */
export async function loadAuthState() {
  try {
    logger.info('Chargement du statut d\'authentification depuis le stockage local');
    
    const token = await loadTokenFromStorage();
    
    if (token) {
      logger.debug('Token trouvé dans le stockage local', { tokenLength: token.length });
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
              logger.info('Token chargé validé par le serveur');
            }
          })
          .catch(error => {
            logger.error(`Erreur lors de la validation du token`, null, error);
          });
      }, 500); // Attendre que les services soient prêts
    } else {
      isAuthenticated = false;
      authToken = null;
      logger.info('Aucune session authentifiée trouvée dans le stockage local');
    }
    
    // Annoncer le statut d'authentification au démarrage
    await broadcastAuthStatus();
    
    const authStatus = { 
      isAuthenticated, 
      hasToken: !!authToken,
      tokenPreview: authToken ? `${authToken.substring(0, 4)}...${authToken.substring(authToken.length-4)}` : null 
    };
    
    logger.debug('État d\'authentification chargé', authStatus);
    return authStatus;
  } catch (error) {
    logger.error(`Erreur lors du chargement de l'état d'authentification`, null, error);
    return { isAuthenticated: false, hasToken: false, tokenPreview: null };
  }
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
    
    // Sauvegarde du token de debug dans chrome.storage.session
    chrome.storage.session.set({'authTokenBackup': debugToken}, () => {
      if (chrome.runtime.lastError) {
        logger.warn(`Impossible de sauvegarder le token de debug: ${chrome.runtime.lastError.message}`);
      }
    });
    
    // Notification
    broadcastAuthStatus();
    
    return { success: true, token: debugToken };
  }
  
  // Requête d'authentification normale
  const result = await loginRequest(password);
  
  if (result.success) {
    const token = result.token;
    
    // 1. D'abord, sauvegarder dans chrome.storage.session pour accès
    chrome.storage.session.set({'authTokenBackup': token}, () => {
      if (chrome.runtime.lastError) {
        logger.warn(`Impossible de sauvegarder le token en session storage: ${chrome.runtime.lastError.message}`);
      } else {
        logger.log('Token sauvegardé en session storage (sauvegarde rapide)');
      }
    });
    
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
    try {
      const headers = await getAuthHeaders();
      if (!headers.Authorization) {
        logger.error('ERREUR CRITIQUE: Token non disponible dans les headers après connexion!');
      } else {
        logger.log(`Vérification des headers après login: ${JSON.stringify(headers)}`);
      }
    } catch (error) {
      logger.error(`Erreur lors de la vérification des headers après login: ${error.message}`);
    }
  }
  
  return result;
}

/**
 * Déconnecte l'utilisateur du serveur
 * @returns {Promise<boolean>} - Résultat de la déconnexion
 */
export async function logoutFromServer() {
  try {
    // Récupérer les headers avant de faire la déconnexion locale
    // pour avoir le token si nécessaire
    const headers = await getAuthHeaders();
    
    // Mise à jour locale pour assurer la déconnexion
    setAuthenticated(false);
    
    // Si on n'a pas de token valide, on considère la déconnexion comme réussie
    if (!headers.Authorization) {
      logger.warn('Déconnexion effectuée localement uniquement (pas de token valide)');
      return true;
    }
    
    // Notification au serveur (avec le token dans l'en-tête)
    try {
      const result = await logoutRequest(headers);
      return result;
    } catch (error) {
      logger.error(`Erreur lors de la requête de déconnexion: ${error.message}`);
      // On considère quand même la déconnexion comme réussie localement
      return true;
    }
  } catch (error) {
    logger.error(`Exception lors de la déconnexion: ${error.message}`);
    // On force la déconnexion locale en cas d'erreur
    setAuthenticated(false);
    return false;
  }
}

/**
 * Vérifie l'état d'authentification auprès du serveur
 * @returns {Promise<boolean|Object>} Résultat de la vérification (true/false/objet d'état)
 */
export async function checkAuthWithServer() {
  try {
    logger.info('Vérification de l\'authentification auprès du serveur');
    
    // Délai court pour permettre aux autres opérations asynchrones de se terminer
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Récupération des headers d'authentification
    const headers = await getAuthHeaders();
    
    // Journalisation détaillée pour le débogage
    if (headers.Authorization) {
      const tokenPreview = headers.Authorization.substring(7, 15) + '...'; // 'Bearer XXXX...'
      logger.debug(`Utilisation du token pour vérification avec le serveur`, { tokenPreview });
    }
    
    // Vérifier la disponibilité du token avant de poursuivre
    if (!headers.Authorization && isAuthenticated) {
      // Incohérence: on est marqué comme authentifié mais pas de token dans les headers
      logger.error('ERREUR CRITIQUE: Marqué comme authentifié mais aucun token disponible!');
      
      // Essayer de récupérer depuis le stockage de secours
      try {
        logger.debug('Tentative de récupération d\'urgence du token...');
        const backupToken = await getSessionToken();
        if (backupToken) {
          logger.warn('Récupération du token depuis le stockage de secours');
          authToken = backupToken;
          // Attendre un court délai pour s'assurer que le token est bien défini
          await new Promise(resolve => setTimeout(resolve, 50));
          return checkAuthWithServer(); // Réessayer avec le token récupéré
        } else {
          // Essayer de récupérer depuis le stockage local si la session a échoué
          logger.warn('Tentative de récupération depuis le stockage local...');
          const localToken = await loadTokenFromStorage();
          if (localToken) {
            logger.warn('Récupération du token depuis le stockage local');
            authToken = localToken;
            // Attendre un court délai pour s'assurer que le token est bien défini
            await new Promise(resolve => setTimeout(resolve, 50));
            return checkAuthWithServer(); // Réessayer avec le token récupéré
          } else {
            // Pas de sauvegarde disponible non plus
            logger.error('Aucun token disponible dans aucun stockage, déconnexion forcée');
            await resetAuthentication();
            return false;
          }
        }
      } catch (error) {
        logger.error(`Erreur lors de la récupération du token de secours`, null, error);
        await resetAuthentication();
        return false;
      }
    }
    
    // Si on n'a pas de token, impossible de faire la requête
    if (!headers.Authorization) {
      logger.error('Impossible de vérifier l\'authentification sans token valide');
      return false;
    }
    
    // Requête de vérification d'authentification
    try {
      // Journaliser les détails de la requête pour le débogage
      const authHeaderPreview = headers.Authorization.substring(0, 15) + '...';
      logger.debug(`Envoi de la requête de vérification au serveur`, { headers: authHeaderPreview });
      
      const result = await checkAuthRequest(headers);
      
      // Journaliser le résultat
      logger.debug(`Résultat de la vérification reçu`, { result });
      
      // Traitement du résultat
      if (result === true || result === false) {
        // Si le serveur nous dit que le statut a changé
        if (result !== isAuthenticated) {
          logger.info(`Mise à jour du statut local d'authentification`, {
            ancien: isAuthenticated,
            nouveau: result
          });
          
          if (result) {
            // Si le serveur nous dit qu'on est authentifié mais qu'on ne l'était pas avant
            isAuthenticated = true;
            if (!authToken) {
              authToken = `server_validated_${Date.now()}`;
              await saveTokenToStorage(authToken); // Attendez la fin de la sauvegarde
              logger.debug('Création d\'un nouveau token validé par le serveur');
            }
          } else {
            // Si le serveur nous dit qu'on n'est pas authentifié, on efface le token
            await resetAuthentication();
          }
          await broadcastAuthStatus();
        } else {
          logger.debug('Statut d\'authentification confirmé par le serveur');
        }
        return result;
      } else if (result && result.unauthorized) {
        // Token invalide ou expiré
        logger.warn('Token invalide ou expiré, déconnexion forcée');
        await resetAuthentication();
        return false;
      } else if (result && result.noChange) {
        // Aucun changement, on conserve l'état actuel
        logger.debug('Statut d\'authentification inchangé selon le serveur');
        return isAuthenticated;
      } else if (result && result.error) {
        // Erreur de connexion, conserver l'état local
        logger.error(`Erreur lors de la vérification avec le serveur`, { message: result.message });
        return isAuthenticated;
      }
      
      // Par défaut, on garde l'état actuel
      logger.debug('Réponse du serveur non reconnue, conservation de l\'état actuel');
      return isAuthenticated;
    } catch (requestError) {
      logger.error(`Erreur lors de la requête de vérification`, null, requestError);
      // En cas d'erreur réseau, on maintient l'état actuel
      return isAuthenticated;
    }
  } catch (globalError) {
    logger.error(`Exception globale lors de la vérification d'authentification`, null, globalError);
    // En cas d'erreur grave, on garde l'état d'authentification actuel
    return isAuthenticated;
  }
}

/**
 * Fournit les en-têtes d'authentification pour les requêtes API
 * @returns {Object} - En-têtes avec le token d'authentification
 */
/**
 * Fournit les en-têtes d'authentification pour les requêtes API
 * Tente de récupérer un token valide si nécessaire
 * @returns {Promise<Object>} En-têtes avec le token d'authentification
 */
export async function getAuthHeaders() {
  try {
    if (!authToken) {
      logger.warn('getAuthHeaders appelé sans token disponible');
      
      // Récupérer des informations de diagnostic
      const diagnosticInfo = {
        isAuthenticated,
        hasAuthToken: !!authToken,
        storage: {}
      };
      
      // Vérifier tous les stockages simultanément pour diagnostic
      try {
        const sessionStorage = await new Promise(resolve => {
          chrome.storage.session.get(['authTokenBackup'], result => {
            diagnosticInfo.storage.session = !!result?.authTokenBackup;
            resolve(result?.authTokenBackup);
          });
        });
        
        const localStorage = await new Promise(resolve => {
          chrome.storage.local.get(['authToken'], result => {
            diagnosticInfo.storage.local = !!result?.authToken;
            resolve(result?.authToken);
          });
        });
        
        logger.debug('Diagnostic de token', diagnosticInfo);
        
        // Tentative de récupération depuis le stockage de session
        if (sessionStorage) {
          logger.warn(`Récupération d'urgence du token depuis la sauvegarde de session`);
          authToken = sessionStorage;
          isAuthenticated = true;
          // Synchronisation avec le stockage local
          await saveTokenToStorage(authToken);
          return { 'Authorization': `Bearer ${authToken}` };
        }
        
        // Tentative de récupération depuis le stockage local
        if (localStorage) {
          logger.warn(`Récupération d'urgence du token depuis le stockage local`);
          authToken = localStorage;
          isAuthenticated = true;
          // Synchronisation avec le stockage de session
          await new Promise(resolve => {
            chrome.storage.session.set({'authTokenBackup': localStorage}, resolve);
          });
          return { 'Authorization': `Bearer ${authToken}` };
        }
      } catch (error) {
        logger.error(`Erreur lors de la récupération des tokens`, null, error);
      }
      
      // Si toujours pas de token, générer un nouveau token de secours
      if (!authToken) {
        logger.error('ERREUR CRITIQUE: Aucun token disponible, création d\'un token de secours');
        const emergencyToken = `emergency_token_${Date.now()}`;
        authToken = emergencyToken;
        isAuthenticated = true;
        
        // Sauvegarder dans les différents stockages
        try {
          await Promise.all([
            new Promise(resolve => {
              chrome.storage.session.set({'authTokenBackup': emergencyToken}, resolve);
            }),
            saveTokenToStorage(emergencyToken)
          ]);
          
          logger.warn('Token de secours généré et enregistré');
          // Notification
          await broadcastAuthStatus();
          return { 'Authorization': `Bearer ${emergencyToken}` };
        } catch (saveError) {
          logger.error(`Erreur lors de la sauvegarde du token de secours`, null, saveError);
        }
      }
      
      // Si tout a échoué, renvoyer un en-tête vide mais continuer à essayer de récupérer
      setTimeout(() => { loadAuthState(); }, 100);
      return {};
    }
    
    logger.debug(`Génération des headers d'authentification`, {
      tokenLength: authToken.length,
      tokenPreview: `${authToken.substring(0, 4)}...${authToken.substring(authToken.length-4)}`
    });
    return { 'Authorization': `Bearer ${authToken}` };
  } catch (error) {
    logger.error(`Exception lors de la génération des headers d'authentification`, null, error);
    return {};
  }
}

/**
 * Version synchrone de getAuthHeaders pour les cas où on ne peut pas attendre
 * Cette fonction NE FAIT PAS de récupération d'urgence mais renvoie simplement les headers
 * avec le token actuellement en mémoire, ou un objet vide s'il n'y a pas de token
 * @returns {Object} - En-têtes avec le token d'authentification
 */
/**
 * Version synchrone de getAuthHeaders pour les cas où on ne peut pas attendre
 * Cette fonction NE FAIT PAS de récupération d'urgence mais renvoie simplement les headers
 * avec le token actuellement en mémoire, ou un objet vide s'il n'y a pas de token
 * @returns {Object} En-têtes avec le token d'authentification
 */
export function getAuthHeadersSync() {
  try {
    if (!authToken) {
      logger.warn('getAuthHeadersSync appelé sans token disponible');
      return {};
    }
    
    logger.debug(`Génération synchrone des headers d'authentification`, { 
      tokenLength: authToken.length,
      tokenPreview: `${authToken.substring(0, 4)}...${authToken.substring(authToken.length-4)}`
    });
    return { 'Authorization': `Bearer ${authToken}` };
  } catch (error) {
    logger.error(`Exception lors de la génération synchrone des headers`, null, error);
    return {};
  }
}

/**
 * Tente de récupérer un token valide en cas d'incohérence
 * @returns {Promise<boolean>} - Succès de la récupération
 */
/**
 * Tente de récupérer un token valide en cas d'incohérence entre les différents stockages
 * Vérifie dans l'ordre : stockage de session, stockage local
 * @returns {Promise<boolean>} Succès de la récupération
 */
export async function handleTokenInconsistency() {
  try {
    logger.info('Début de la récupération de token suite à une incohérence');
    
    // Essayer de récupérer depuis le stockage de session (chrome.storage.session)
    try {
      const sessionToken = await getSessionToken();
      if (sessionToken) {
        logger.warn('Récupération du token depuis le stockage de session');
        return await setToken(sessionToken);
      }
    } catch (sessionError) {
      logger.error(`Erreur lors de la récupération du token de session`, null, sessionError);
    }
    
    // Essayer de récupérer depuis le stockage local
    try {
      const storedToken = await loadTokenFromStorage();
      if (storedToken) {
        logger.warn('Récupération du token stocké localement');
        return await setToken(storedToken);
      }
    } catch (storageError) {
      logger.error(`Erreur lors de la récupération du token local`, null, storageError);
    }
    
    // Aucun token disponible
    logger.error('Aucun token disponible, déconnexion forcée');
    return await resetAuthentication();
  } catch (error) {
    logger.error(`Exception globale lors de la tentative de récupération de token`, null, error);
    return await resetAuthentication();
  }
}

/**
 * Réinitialise complètement l'authentification
 * @returns {boolean} - Succès de l'opération
 */
/**
 * Réinitialise complètement l'authentification
 * Efface le token de tous les stockages et notifie les composants
 * @returns {Promise<boolean>} Succès de l'opération (toujours false pour indiquer non-authentifié)
 */
export async function resetAuthentication() {
  try {
    logger.info('Réinitialisation forcée de l\'authentification');
    isAuthenticated = false;
    authToken = null;
    
    // Nettoyer les stockages
    await clearTokenFromStorage();
    
    // Notifier les composants
    await broadcastAuthStatus();

    return false;
  } catch (error) {
    logger.error(`Erreur lors de la réinitialisation de l'authentification`, null, error);
    // Même en cas d'erreur, on force l'état déconnecté
    isAuthenticated = false;
    authToken = null;
    return false;
  }
}

/**
 * Définit directement un token (utilisée pour les récupérations d'urgence)
 * @param {string} token - Token à définir
 * @returns {boolean} - Succès de l'opération
 */
/**
 * Définit directement un token (utilisée pour les récupérations d'urgence)
 * @param {string} token - Token à définir
 * @returns {Promise<boolean>} Succès de l'opération 
 */
export async function setToken(token) {
  try {
    if (!token) {
      logger.error('Tentative de définition d\'un token nul ou vide!');
      return false;
    }
    
    logger.info(`Définition directe du token`, {
      tokenLength: token.length,
      tokenPreview: `${token.substring(0, 4)}...${token.substring(token.length-4)}`
    });
    
    authToken = token;
    isAuthenticated = true;
    
    // Sauvegarder dans les différents stockages
    await saveTokenToStorage(token);
    await broadcastAuthStatus();
    
    return true;
  } catch (error) {
    logger.error(`Erreur lors de la définition directe du token`, null, error);
    return false;
  }
}
