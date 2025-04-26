// FCA-Agent - Background Service Worker (version refactorisée)

import { loadInitialConfig, setDefaultConfig } from './background/config.js';
import { loadAuthState, getAuthStatus, checkAuthWithServer } from './background/auth.js';
import { setupMessageHandlers } from './background/handlers.js';
import { checkServerOnline, getServerStatus, forceServerCheck } from './background/server.js';


// Logger spécifique au script principal avec timestamp précis
function BGLog(message, level = 'info') {
  const prefix = '[Background.js]';
  
  // Création d'un timestamp précis pour le débogage
  const now = new Date();
  const timestamp = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}`;
  
  switch(level) {
    case 'error':
      console.error(`${timestamp} ${prefix} ${message}`);
      break;
    case 'warn':
      console.warn(`${timestamp} ${prefix} ${message}`);
      break;
    case 'debug':
      console.debug(`${timestamp} ${prefix} DEBUG: ${message}`);
      break;
    default:
      console.log(`${timestamp} ${prefix} ${message}`);
  }
}

// Fonctions d'initialisation séparées par domaine
async function initializeConfig() {
  BGLog('Initialisation de la configuration...');
  await loadInitialConfig();
  BGLog('Configuration chargée');
}

async function initializeAuth() {
  BGLog('Initialisation de l\'authentification...');
  
  try {
    // Chargement de l'état d'authentification depuis le stockage local
    const authStatus = await loadAuthState();
    BGLog(`État initial d'authentification: ${JSON.stringify(authStatus)}`);
  
    if (authStatus.isAuthenticated) {
      BGLog('Authentifié localement, vérification avec le serveur...');
      
      // Vérification des headers pour s'assurer que le token est disponible
      const headers = await import('./background/auth.js').then(module => module.getAuthHeaders());
      if (!headers.Authorization) {
        BGLog('ALERTE: Token manquant dans les headers alors que marqué comme authentifié!', 'error');
        // Tentative de récupération d'urgence
        const recoveryResult = await import('./background/auth.js').then(module => {
          return new Promise(resolve => {
            chrome.storage.local.get(['authToken'], (result) => {
              if (result && result.authToken) {
                BGLog(`Token trouvé dans le stockage: ${result.authToken.substring(0, 4)}...${result.authToken.substring(result.authToken.length-4)}`, 'debug');
                module.setToken(result.authToken);
                resolve(true);
              } else {
                BGLog('Aucun token trouvé dans le stockage, déconnexion forcée', 'error');
                module.resetAuthentication();
                resolve(false);
              }
            });
          });
        });
        
        if (!recoveryResult) {
          BGLog('Récupération d\'urgence du token échouée', 'error');
          return { isAuthenticated: false, hasToken: false };
        }
      } else {
        BGLog(`Token disponible: ${headers.Authorization.substring(0, 15)}...`, 'debug');
      }
      
      // Vérification avec le serveur pour confirmer validité
      try {
        const serverAuthStatus = await checkAuthWithServer();
        BGLog(`Résultat de la vérification avec le serveur: ${JSON.stringify(serverAuthStatus)}`);
        return serverAuthStatus;
      } catch (error) {
        BGLog(`Erreur lors de la vérification avec le serveur: ${error.message}`, 'warn');
        return authStatus;
      }
    } else {
      // Pas d'authentification locale, retourner simplement l'état
      BGLog('Non authentifié localement');
      return authStatus;
    }
  } catch (error) {
    BGLog(`Erreur lors de l'initialisation de l'authentification: ${error.message}`, 'error');
    return { isAuthenticated: false, hasToken: false };
  }
}

async function initializeServer() {
  BGLog('Vérification de l\'état du serveur...');
  try {
    const serverStatus = await checkServerOnline();
    BGLog(`État initial du serveur: ${serverStatus ? 'connecté' : 'déconnecté'}`);
    
    // Force une diffusion de l'état initial
    if (serverStatus) {
      await forceServerCheck();
    }
    
    return serverStatus;
  } catch (error) {
    BGLog(`Erreur lors de la vérification initiale du serveur: ${error.message}`, 'warn');
    return false;
  }
}

// Fonction principale d'initialisation
async function initialize() {
  BGLog('Initialisation du service worker FCA-Agent...');
  
  try {
    // Chargement séquentiel des modules
    await initializeConfig();
    const authStatus = await initializeAuth();
    const serverStatus = await initializeServer();
    
    BGLog(`Statut après initialisation - Auth: ${authStatus.isAuthenticated}, Server: ${serverStatus}`);
    
    // Vérification de l'intégrité du système
    if (authStatus.isAuthenticated) {
      const headers = await import('./background/auth.js').then(module => module.getAuthHeaders());
      if (!headers.Authorization) {
        BGLog('ALERTE CRITIQUE: Incohérence après initialisation - authentifié mais pas de token!', 'error');
      } else {
        BGLog('Intégrité de l\'authentification vérifiée', 'debug');
      }
    }
    
    // Configuration des gestionnaires de messages
    setupMessageHandlers();
    
    BGLog('Initialisation du service worker terminée');
    
    // Force une vérification après l'initialisation
    setTimeout(async () => {
      BGLog('Vérification forcée après initialisation');
      await forceServerCheck();
      
      // Test d'une requête d'authentification pour s'assurer que tout est opposé
      if (authStatus.isAuthenticated) {
        BGLog('Test de vérification d\'authentification post-initialisation', 'debug');
        await checkAuthWithServer();
      }
    }, 2000);
    
    return { authStatus, serverStatus };
  } catch (initError) {
    BGLog(`Erreur critique lors de l'initialisation: ${initError.message}`, 'error');
    BGLog(`Stack trace: ${initError.stack}`, 'error');
    return { authStatus: { isAuthenticated: false }, serverStatus: false };
  }
}

// Installation/mise à jour de l'extension
chrome.runtime.onInstalled.addListener(async (details) => {
  BGLog(`FCA-Agent installé/mis à jour: ${details.reason}`);
  
  if (details.reason === 'install') {
    BGLog('Première installation, réinitialisation des paramètres...');
    // Effacer tous les tokens d'authentification lors d'une nouvelle installation
    chrome.storage.local.remove(['authToken'], () => {
      BGLog('Token d\'authentification supprimé (nouvelle installation)');
    });
  }
  
  await setDefaultConfig();
  await initialize();
});

// Démarrage du service worker
chrome.runtime.onStartup.addListener(() => {
  BGLog('Service worker démarré via onStartup');
  initialize();
});

// Initialisation immédiate (pour les cas où onStartup n'est pas déclenché)
let initPromise = initialize().catch(error => {
  BGLog(`Erreur lors de l'initialisation du service worker: ${error.message}`, 'error');
  BGLog(`Stack: ${error.stack}`, 'error');
  return { authStatus: { isAuthenticated: false }, serverStatus: false };
});

// Export de la promesse d'initialisation pour permettre à d'autres modules de s'y synchroniser
export { initPromise };

// Mise en place d'une vérification périodique rapide pour les statuts
setInterval(async () => {
  BGLog('Vérification périodique rapide du serveur...');
  
  try {
    // Vérifier le serveur et forcer la diffusion du statut
    await forceServerCheck();
  } catch (error) {
    BGLog(`Erreur lors de la vérification rapide: ${error.message}`, 'warn');
  }
}, 30 * 1000); // Vérification toutes les 30 secondes

// Mise en place d'une vérification périodique plus complète
setInterval(async () => {
  BGLog('Vérification périodique complète des statuts...');
  
  try {
    // Vérifier d'abord si le serveur est en ligne
    const isServerOnline = await forceServerCheck();
    BGLog(`Serveur en ligne: ${isServerOnline}`);
    
    // Si le serveur est en ligne et que nous sommes authentifiés localement, vérifier avec le serveur
    if (isServerOnline) {
      const authStatus = getAuthStatus();
      if (authStatus.isAuthenticated) {
        BGLog('Authentifié localement, vérification avec le serveur...');
        const serverAuthStatus = await checkAuthWithServer();
        BGLog(`Résultat de la vérification: ${JSON.stringify(serverAuthStatus)}`);
      }
    }
  } catch (error) {
    BGLog(`Erreur lors de la vérification périodique: ${error.message}`, 'warn');
  }
}, 5 * 60 * 1000); // Vérification complète toutes les 5 minutes
