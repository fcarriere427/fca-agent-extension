// FCA-Agent - Background Service Worker (version refactorisée)

import { loadInitialConfig, setDefaultConfig } from './background/config.js';
import { loadAuthState, getAuthStatus, checkAuthWithServer } from './background/auth.js';
import { setupMessageHandlers } from './background/handlers.js';
import { checkServerOnline, getServerStatus, forceServerCheck } from './background/server.js';
import { createModuleLogger } from './utils/logger.js';

// Création d'une instance de logger spécifique pour ce module
const logger = createModuleLogger('background.js');

// Fonction de compatibilité pour l'ancien code (sera progressivement remplacée)
function BGLog(message, level = 'info') {
  switch(level) {
    case 'error':
      logger.error(message);
      break;
    case 'warn':
      logger.warn(message);
      break;
    case 'debug':
      logger.log(`DEBUG: ${message}`);
      break;
    default:
      logger.log(message);
  }
}

/**
 * Vérifie l'intégrité du système après initialisation
 * @param {Object} authStatus - État d'authentification actuel
 * @returns {Promise<boolean>} - Résultat de la vérification
 */
async function verifySystemIntegrity(authStatus) {
  logger.log('Démarrage de la vérification d\'intégrité du système...');
  let isSystemConsistent = true;
  
  // 1. Vérification de la cohérence de l'authentification
  if (authStatus.isAuthenticated) {
    logger.log('Vérification de la cohérence de l\'authentification...');
    try {
      // Tentative répétée pour obtenir les headers (jusqu'à 3 essais)
      let authHeaders = null;
      let headerAttempts = 0;
      const maxHeaderAttempts = 3;
      
      while (headerAttempts < maxHeaderAttempts) {
        // Délai progressif entre les tentatives
        if (headerAttempts > 0) {
          await new Promise(resolve => setTimeout(resolve, headerAttempts * 200));
        }
        
        try {
          const authModule = await import('./background/auth.js');
          // Utilisation de la nouvelle version asynchrone de getAuthHeaders
          authHeaders = await authModule.getAuthHeaders();
          
          if (authHeaders && authHeaders.Authorization) {
            logger.log(`Headers d'authentification obtenus après ${headerAttempts + 1} tentative(s)`);
            break;
          } else {
            logger.warn(`Tentative ${headerAttempts + 1}/${maxHeaderAttempts}: headers incomplets, nouvel essai...`);
          }
        } catch (headerError) {
          logger.error(`Erreur lors de la tentative ${headerAttempts + 1}/${maxHeaderAttempts}: ${headerError.message}`);
        }
        headerAttempts++;
      }
      
      if (!authHeaders || !authHeaders.Authorization) {
        logger.error('ALERTE CRITIQUE: Incohérence après initialisation - authentifié mais pas de token!');
        isSystemConsistent = false;
        
        // Tentative de récupération d'urgence
        try {
          const authModule = await import('./background/auth.js');
          const recovered = await authModule.handleTokenInconsistency();
          
          if (recovered) {
            logger.warn('Récupération d\'urgence réussie, système restauré');
            // Vérification que la récupération a fonctionné
            const newHeaders = await authModule.getAuthHeaders();
            if (newHeaders && newHeaders.Authorization) {
              logger.log('Cohérence restaurée après récupération');
              isSystemConsistent = true;
            }
          } else {
            logger.error('Récupération d\'urgence échouée!');
          }
        } catch (recoveryError) {
          logger.error(`Erreur lors de la tentative de récupération: ${recoveryError.message}`);
        }
      } else {
        logger.log('Intégrité de l\'authentification vérifiée et valide');
      }
    } catch (authCheckError) {
      logger.error(`Erreur lors de la vérification d'authentification: ${authCheckError.message}`);
      isSystemConsistent = false;
    }
  } else {
    logger.log('Pas d\'authentification active, vérification d\'intégrité ignorée');
  }
  
  // 2. Vérification de la configuration
  try {
    const configModule = await import('./background/config.js');
    const apiUrl = configModule.getApiUrl();
    
    if (!apiUrl) {
      logger.error('ALERTE: URL de l\'API non définie ou invalide!');
      isSystemConsistent = false;
    } else {
      logger.log(`URL API déja configurée: ${apiUrl}`);
    }
  } catch (configError) {
    logger.error(`Erreur lors de la vérification de configuration: ${configError.message}`);
    isSystemConsistent = false;
  }
  
  // 3. Journal du résultat final
  if (isSystemConsistent) {
    logger.log('Vérification d\'intégrité du système réussie!');
  } else {
    logger.error('Vérification d\'intégrité du système échouée - des problèmes ont été détectés');
  }
  
  return isSystemConsistent;
}

// Fonctions d'initialisation séparées par domaine
async function initializeConfig() {
  logger.log('Initialisation de la configuration...');
  await loadInitialConfig();
  logger.log('Configuration chargée');
}

async function initializeAuth() {
  logger.log('Initialisation de l\'authentification...');
  
  try {
    // Chargement de l'état d'authentification depuis le stockage local
    const authStatus = await loadAuthState();
    logger.log(`État initial d'authentification: ${JSON.stringify(authStatus)}`);
  
    if (authStatus.isAuthenticated) {
      logger.log('Authentifié localement, vérification avec le serveur...');
      
      // Vérification des headers pour s'assurer que le token est disponible
      try {
        const authModule = await import('./background/auth.js');
        const headers = await authModule.getAuthHeaders();
        
        if (!headers.Authorization) {
          logger.error('ALERTE: Token manquant dans les headers alors que marqué comme authentifié!');
          // Tentative de récupération d'urgence
          const recoveryResult = await new Promise(resolve => {
            chrome.storage.local.get(['authToken'], async (result) => {
              if (result && result.authToken) {
                logger.log(`Token trouvé dans le stockage: ${result.authToken.substring(0, 4)}...${result.authToken.substring(result.authToken.length-4)}`);
                await authModule.setToken(result.authToken);
                resolve(true);
              } else {
                logger.error('Aucun token trouvé dans le stockage, déconnexion forcée');
                await authModule.resetAuthentication();
                resolve(false);
              }
            });
          });
          
          if (!recoveryResult) {
            logger.error('Récupération d\'urgence du token échouée');
            return { isAuthenticated: false, hasToken: false };
          }
        } else {
          logger.log(`Token disponible: ${headers.Authorization.substring(0, 15)}...`);
        }
      } catch (headerError) {
        logger.error(`Erreur lors de la récupération des headers: ${headerError.message}`);
        return { isAuthenticated: false, hasToken: false };
      }
      
      // Vérification avec le serveur pour confirmer validité
      try {
        const serverAuthStatus = await checkAuthWithServer();
        logger.log(`Résultat de la vérification avec le serveur: ${JSON.stringify(serverAuthStatus)}`);
        return serverAuthStatus;
      } catch (error) {
        logger.warn(`Erreur lors de la vérification avec le serveur: ${error.message}`);
        return authStatus;
      }
    } else {
      // Pas d'authentification locale, retourner simplement l'état
      logger.log('Non authentifié localement');
      return authStatus;
    }
  } catch (error) {
    logger.error(`Erreur lors de l'initialisation de l'authentification: ${error.message}`);
    return { isAuthenticated: false, hasToken: false };
  }
}

async function initializeServer() {
  logger.log('Vérification de l\'état du serveur...');
  try {
    const serverStatus = await checkServerOnline();
    logger.log(`État initial du serveur: ${serverStatus ? 'connecté' : 'déconnecté'}`);
    
    // Force une diffusion de l'état initial
    if (serverStatus) {
      await forceServerCheck();
    }
    
    return serverStatus;
  } catch (error) {
    logger.warn(`Erreur lors de la vérification initiale du serveur: ${error.message}`);
    return false;
  }
}

// Fonction principale d'initialisation
async function initialize() {
  logger.log('Initialisation du service worker FCA-Agent...');
  
  try {
    // Chargement séquentiel des modules avec délais pour assurer la stabilité
    logger.log('Étape 1: Initialisation de la configuration');
    await initializeConfig();
    
    // Délai court pour assurer que la configuration est bien chargée
    await new Promise(resolve => setTimeout(resolve, 100));
    
    logger.log('Étape 2: Initialisation de l\'authentification');
    // Tentative répétée pour l'authentification (jusqu'à 3 essais)
    let authStatus = null;
    let authAttempts = 0;
    const maxAuthAttempts = 3;
    
    while (authAttempts < maxAuthAttempts) {
      try {
        authStatus = await initializeAuth();
        if (authStatus && (authStatus.hasToken || !authStatus.isAuthenticated)) {
          logger.log(`Authentification réussie après ${authAttempts + 1} tentative(s)`);
          break;
        } else {
          logger.warn(`Tentative d'authentification ${authAttempts + 1}/${maxAuthAttempts} incomplète, nouvel essai...`);
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      } catch (authError) {
        logger.error(`Erreur lors de la tentative d'authentification ${authAttempts + 1}/${maxAuthAttempts}: ${authError.message}`);
      }
      authAttempts++;
    }
    
    if (authAttempts >= maxAuthAttempts) {
      logger.error(`Échec de l'initialisation de l'authentification après ${maxAuthAttempts} tentatives`);
      // Si l'authentification a échoué, on réinitialise l'état
      authStatus = { isAuthenticated: false, hasToken: false };
    }
    
    logger.log('Étape 3: Initialisation de la connexion au serveur');
    const serverStatus = await initializeServer();
    
    logger.log(`Statut après initialisation - Auth: ${authStatus.isAuthenticated}, Server: ${serverStatus}`);
    
    // Vérification complète de l'intégrité du système après initialisation
    await verifySystemIntegrity(authStatus);
    
    // Configuration des gestionnaires de messages
    setupMessageHandlers();
    
    logger.log('Initialisation du service worker terminée');
    
    // Force une vérification complète après l'initialisation avec des délais progressifs
    setTimeout(async () => {
      logger.log('Vérification forcée #1 après initialisation');
      try {
        // Vérification du serveur
        const serverOnline = await forceServerCheck();
        logger.log(`Vérification serveur #1: ${serverOnline ? 'connecté' : 'déconnecté'}`);
        
        // Attente avant la vérification d'authentification
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Test d'authentification si nécessaire
        if (authStatus.isAuthenticated) {
          logger.log('Test de vérification d\'authentification #1');
          try {
            const authResult = await checkAuthWithServer();
            logger.log(`Résultat vérification auth #1: ${JSON.stringify(authResult)}`);
          } catch (authError) {
            logger.error(`Erreur vérification auth #1: ${authError.message}`);
          }
        }
      } catch (error) {
        logger.error(`Erreur lors de la vérification forcée #1: ${error.message}`);
      }
      
      // Deuxième vérification (plus tard) pour s'assurer que tout est stable
      setTimeout(async () => {
        logger.log('Vérification forcée #2 après initialisation');
        try {
          // Nouvelle vérification d'intégrité
          const authModule = await import('./background/auth.js');
          const currentAuthStatus = authModule.getAuthStatus();
          await verifySystemIntegrity(currentAuthStatus);
          
          // Vérification du serveur
          const serverOnline = await forceServerCheck();
          logger.log(`Vérification serveur #2: ${serverOnline ? 'connecté' : 'déconnecté'}`);
          
          // Test d'authentification final
          if (currentAuthStatus.isAuthenticated) {
            logger.log('Test de vérification d\'authentification final');
            await checkAuthWithServer();
          }
          
          logger.log('Initialisation complète et stable confirmée');
        } catch (error) {
          logger.error(`Erreur lors de la vérification forcée #2: ${error.message}`);
        }
      }, 5000);
    }, 2000);
    
    return { authStatus, serverStatus };
  } catch (initError) {
    logger.error(`Erreur critique lors de l'initialisation: ${initError.message}`);
    logger.error(`Stack trace: ${initError.stack}`);
    return { authStatus: { isAuthenticated: false }, serverStatus: false };
  }
}

// Installation/mise à jour de l'extension
chrome.runtime.onInstalled.addListener(async (details) => {
  logger.log(`FCA-Agent installé/mis à jour: ${details.reason}`);
  
  if (details.reason === 'install') {
    logger.log('Première installation, réinitialisation des paramètres...');
    // Effacer tous les tokens d'authentification lors d'une nouvelle installation
    chrome.storage.local.remove(['authToken'], () => {
      logger.log('Token d\'authentification supprimé (nouvelle installation)');
    });
  }
  
  await setDefaultConfig();
  await initialize();
});

// Démarrage du service worker
chrome.runtime.onStartup.addListener(() => {
  logger.log('Service worker démarré via onStartup');
  initialize();
});

// Initialisation immédiate (pour les cas où onStartup n'est pas déclenché)
let initPromise = initialize().catch(error => {
  logger.error(`Erreur lors de l'initialisation du service worker: ${error.message}`);
  logger.error(`Stack: ${error.stack}`);
  return { authStatus: { isAuthenticated: false }, serverStatus: false };
});

// Export de la promesse d'initialisation pour permettre à d'autres modules de s'y synchroniser
export { initPromise };

// Mise en place d'une vérification périodique rapide pour les statuts
setInterval(async () => {
  logger.log('Vérification périodique rapide du serveur...');
  
  try {
    // Vérifier le serveur et forcer la diffusion du statut
    await forceServerCheck();
  } catch (error) {
    logger.warn(`Erreur lors de la vérification rapide: ${error.message}`);
  }
}, 30 * 1000); // Vérification toutes les 30 secondes

// Mise en place d'une vérification périodique plus complète
setInterval(async () => {
  logger.log('Vérification périodique complète des statuts...');
  
  try {
    // Vérifier d'abord si le serveur est en ligne
    const isServerOnline = await forceServerCheck();
    logger.log(`Serveur en ligne: ${isServerOnline}`);
    
    // Si le serveur est en ligne et que nous sommes authentifiés localement, vérifier avec le serveur
    if (isServerOnline) {
      const authStatus = getAuthStatus();
      if (authStatus.isAuthenticated) {
        logger.log('Authentifié localement, vérification avec le serveur...');
        const serverAuthStatus = await checkAuthWithServer();
        logger.log(`Résultat de la vérification: ${JSON.stringify(serverAuthStatus)}`);
      }
    }
  } catch (error) {
    logger.warn(`Erreur lors de la vérification périodique: ${error.message}`);
  }
}, 5 * 60 * 1000); // Vérification complète toutes les 5 minutes

// Mécanisme de supervision avancé
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'systemHealthCheck') {
    logger.log('Réception d\'une demande de vérification de santé système');
    
    const fullSystemCheck = async () => {
      try {
        const authModule = await import('./background/auth.js');
        const serverModule = await import('./background/server.js');
        
        const authStatus = authModule.getAuthStatus();
        const serverStatus = serverModule.getServerStatus();
        
        // Vérifications complètes
        let authCheck = false;
        if (authStatus.isAuthenticated) {
          try {
            authCheck = await authModule.checkAuthWithServer();
          } catch (authError) {
            logger.error(`Erreur lors de la vérification d'authentification: ${authError.message}`);
          }
        }
        
        const serverCheck = await serverModule.forceServerCheck();
        
        // Tentative de récupération si nécessaire
        if (authStatus.isAuthenticated && !authCheck) {
          try {
            await authModule.handleTokenInconsistency();
          } catch (recoveryError) {
            logger.error(`Erreur lors de la tentative de récupération: ${recoveryError.message}`);
          }
        }
        
        return {
          success: true,
          authStatus: authStatus,
          serverStatus: serverStatus,
          authValidated: authCheck,
          serverValidated: serverCheck,
          timestamp: Date.now()
        };
      } catch (error) {
        logger.error(`Erreur lors de la vérification système complète: ${error.message}`);
        return {
          success: false,
          error: error.message,
          timestamp: Date.now()
        };
      }
    };

    // Exécution de la vérification système
    fullSystemCheck().then(result => {
      sendResponse(result);
    }).catch(error => {
      sendResponse({
        success: false,
        error: error.message,
        timestamp: Date.now()
      });
    });
    
    return true; // Indique une réponse asynchrone
  }
});