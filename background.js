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
      const headers = await import('./background/auth.js').then(module => module.getAuthHeaders());
      if (!headers.Authorization) {
        logger.error('ALERTE: Token manquant dans les headers alors que marqué comme authentifié!');
        // Tentative de récupération d'urgence
        const recoveryResult = await import('./background/auth.js').then(module => {
          return new Promise(resolve => {
            chrome.storage.local.get(['authToken'], (result) => {
              if (result && result.authToken) {
                logger.log(`Token trouvé dans le stockage: ${result.authToken.substring(0, 4)}...${result.authToken.substring(result.authToken.length-4)}`);
                module.setToken(result.authToken);
                resolve(true);
              } else {
                logger.error('Aucun token trouvé dans le stockage, déconnexion forcée');
                module.resetAuthentication();
                resolve(false);
              }
            });
          });
        });
        
        if (!recoveryResult) {
          logger.error('Récupération d\'urgence du token échouée');
          return { isAuthenticated: false, hasToken: false };
        }
      } else {
        logger.log(`Token disponible: ${headers.Authorization.substring(0, 15)}...`);
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
    // Chargement séquentiel des modules
    await initializeConfig();
    const authStatus = await initializeAuth();
    const serverStatus = await initializeServer();
    
    logger.log(`Statut après initialisation - Auth: ${authStatus.isAuthenticated}, Server: ${serverStatus}`);
    
    // Vérification de l'intégrité du système
    if (authStatus.isAuthenticated) {
      const headers = await import('./background/auth.js').then(module => module.getAuthHeaders());
      if (!headers.Authorization) {
        logger.error('ALERTE CRITIQUE: Incohérence après initialisation - authentifié mais pas de token!');
      } else {
        logger.log('Intégrité de l\'authentification vérifiée');
      }
    }
    
    // Configuration des gestionnaires de messages
    setupMessageHandlers();
    
    logger.log('Initialisation du service worker terminée');
    
    // Force une vérification après l'initialisation
    setTimeout(async () => {
      logger.log('Vérification forcée après initialisation');
      await forceServerCheck();
      
      // Test d'une requête d'authentification pour s'assurer que tout est opposé
      if (authStatus.isAuthenticated) {
        logger.log('Test de vérification d\'authentification post-initialisation');
        await checkAuthWithServer();
      }
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
        const authCheck = authStatus.isAuthenticated ? await authModule.checkAuthWithServer() : false;
        const serverCheck = await serverModule.forceServerCheck();
        
        // Tentative de récupération si nécessaire
        if (!authCheck) {
          await authModule.handleTokenInconsistency();
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