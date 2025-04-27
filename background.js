// FCA-Agent - Background Service Worker (version consolidée)

import { loadInitialConfig, setDefaultConfig, getApiUrl } from './background/config.js';
import { getAuthHeaders } from './background/auth-headers.js';
import { isAuthConfigured } from './background/auth-headers.js';
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
 * @returns {Promise<boolean>} - Résultat de la vérification
 */
async function verifySystemIntegrity() {
  logger.log('Démarrage de la vérification d\'intégrité du système...');
  let isSystemConsistent = true;
  
  // 1. Vérification de la configuration de la clé API
  try {
    if (!isAuthConfigured()) {
      logger.error('ALERTE CRITIQUE: Clé API non configurée!');
      isSystemConsistent = false;
    } else {
      // Vérifier que les headers d'authentification sont générés correctement
      const headers = getAuthHeaders();
      if (!headers || !headers.Authorization) {
        logger.error('ALERTE: Problème avec la génération des headers d\'authentification');
        isSystemConsistent = false;
      } else {
        logger.log('Clé API configurée correctement');
      }
    }
  } catch (authCheckError) {
    logger.error(`Erreur lors de la vérification d'authentification: ${authCheckError.message}`);
    isSystemConsistent = false;
  }
  
  // 2. Vérification de la configuration
  try {
    const apiUrl = getApiUrl();
    
    if (!apiUrl) {
      logger.error('ALERTE: URL de l\'API non définie ou invalide!');
      isSystemConsistent = false;
    } else {
      logger.log(`URL API configurée: ${apiUrl}`);
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

// Fonctions d'initialisation simplifiées
async function initializeConfig() {
  logger.log('Initialisation de la configuration...');
  await loadInitialConfig();
  logger.log('Configuration chargée');
}

async function initializeAuth() {
  logger.log('Initialisation de l\'authentification avec clé API fixe...');
  
  try {
    // Vérification de la configuration de la clé API
    if (!isAuthConfigured()) {
      logger.error('ALERTE CRITIQUE: Clé API non configurée!');
      return { isAuthenticated: false };
    }
    
    // Génération des headers pour vérifier que tout fonctionne
    const headers = getAuthHeaders();
    if (!headers || !headers.Authorization) {
      logger.error('ALERTE: Problème avec la génération des headers d\'authentification');
      return { isAuthenticated: false };
    }
    
    logger.log('Clé API configurée correctement');
    
    // Notification du statut d'authentification avec la clé API fixe
    const authStatus = { isAuthenticated: true };
    broadcastAuthStatus(authStatus);
    
    return authStatus;
  } catch (error) {
    logger.error(`Erreur lors de l'initialisation de l'authentification: ${error.message}`);
    return { isAuthenticated: false };
  }
}

/**
 * Diffuse le statut d'authentification aux autres composants
 * @param {Object} status - Statut d'authentification à diffuser
 */
function broadcastAuthStatus(status = { isAuthenticated: true }) {
  logger.log(`Diffusion du statut d'authentification: ${JSON.stringify(status)}`);
  
  try {
    // Essayer d'abord avec chrome.runtime.sendMessage
    chrome.runtime.sendMessage({ 
      action: 'authStatusChanged', 
      status: status 
    }, response => {
      if (chrome.runtime.lastError) {
        logger.warn(`Message authStatusChanged non délivré: ${chrome.runtime.lastError.message}`);
      } else {
        logger.log('Message authStatusChanged délivré avec succès');
      }
    });
    
    // Enregistrer l'état dans le stockage local pour permettre la récupération par d'autres composants
    chrome.storage.local.set({ 'authStatus': status }, () => {
      if (chrome.runtime.lastError) {
        logger.warn(`Impossible de sauvegarder l'état d'authentification: ${chrome.runtime.lastError.message}`);
      } else {
        logger.log('Statut d\'authentification sauvegardé dans le storage local');
      }
    });
  } catch (error) {
    logger.error(`Erreur lors de la diffusion du statut: ${error.message}`);
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

// Fonction principale d'initialisation simplifiée
async function initialize() {
  logger.log('Initialisation du service worker FCA-Agent avec clé API fixe...');
  
  try {
    // Étape 1: Initialisation de la configuration
    logger.log('Étape 1: Initialisation de la configuration');
    await initializeConfig();
    
    // Étape 2: Initialisation de l'authentification simplifiée
    logger.log('Étape 2: Initialisation de l\'authentification avec clé API fixe');
    const authStatus = await initializeAuth();
    
    // Étape 3: Initialisation du serveur
    logger.log('Étape 3: Initialisation de la connexion au serveur');
    const serverStatus = await initializeServer();
    
    // Récapitulatif
    logger.log(`Statut après initialisation - Auth: ${authStatus.isAuthenticated}, Server: ${serverStatus}`);
    
    // Vérification de l'intégrité du système
    await verifySystemIntegrity();
    
    // Configuration des gestionnaires de messages
    setupMessageHandlers();
    
    logger.log('Initialisation du service worker terminée');
    
    // Vérification rapide du serveur après une courte période
    setTimeout(async () => {
      try {
        // Vérification du serveur
        const serverOnline = await forceServerCheck();
        logger.log(`Vérification finale du serveur: ${serverOnline ? 'connecté' : 'déconnecté'}`);
        logger.log('Initialisation complète et stable confirmée');
      } catch (error) {
        logger.error(`Erreur lors de la vérification finale: ${error.message}`);
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

// Mise en place d'une vérification périodique du serveur uniquement
setInterval(async () => {
  logger.log('Vérification périodique du serveur...');
  
  try {
    // Vérifier le serveur et forcer la diffusion du statut
    await forceServerCheck();
  } catch (error) {
    logger.warn(`Erreur lors de la vérification rapide: ${error.message}`);
  }
}, 30 * 1000); // Vérification toutes les 30 secondes

// Mécanisme de supervision simplifié
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'systemHealthCheck') {
    logger.log('Réception d\'une demande de vérification de santé système');
    
    const fullSystemCheck = async () => {
      try {
        // Vérification du serveur
        const serverStatus = getServerStatus();
        const serverCheck = await forceServerCheck();
        
        // Vérification de l'authentification avec clé API fixe
        const authStatus = { isAuthenticated: isAuthConfigured() };
        
        return {
          success: true,
          authStatus: authStatus,
          serverStatus: serverStatus,
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