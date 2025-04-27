// FCA-Agent - Background Service Worker (version simplifiée)

import { loadInitialConfig, setDefaultConfig, getApiUrl } from './background/config.js';
import { getAuthHeaders } from './background/auth-headers-simple.js';
import { setupMessageHandlers } from './background/handlers.js';
import { checkServerOnline, getServerStatus, forceServerCheck } from './background/server.js';
import { createModuleLogger } from './utils/logger.js';

// Création d'une instance de logger spécifique pour ce module
const logger = createModuleLogger('background-simple');

/**
 * Fonction simplifiée de vérification système
 * @returns {Promise<boolean>} - Résultat de la vérification
 */
async function verifySystemIntegrity() {
  logger.log('Vérification simplifiée du système...');
  let isSystemConsistent = true;
  
  // 1. Vérification des headers d'authentification
  try {
    const headers = await getAuthHeaders();
    if (!headers || !headers.Authorization) {
      logger.error('Problème avec la génération des headers d\'authentification');
      isSystemConsistent = false;
    } else {
      logger.log('Headers d\'authentification OK');
    }
  } catch (authError) {
    logger.error(`Erreur d'authentification: ${authError.message}`);
    isSystemConsistent = false;
  }
  
  // 2. Vérification de l'URL API
  try {
    const apiUrl = getApiUrl();
    if (!apiUrl) {
      logger.error('URL de l\'API non définie!');
      isSystemConsistent = false;
    } else {
      logger.log(`URL API: ${apiUrl}`);
    }
  } catch (configError) {
    logger.error(`Erreur de configuration: ${configError.message}`);
    isSystemConsistent = false;
  }
  
  logger.log(`Vérification système: ${isSystemConsistent ? 'OK' : 'Échec'}`);
  return isSystemConsistent;
}

// Fonctions d'initialisation simplifiées
async function initializeConfig() {
  logger.log('Initialisation de la configuration...');
  await loadInitialConfig();
  logger.log('Configuration chargée');
}

async function initializeServer() {
  logger.log('Vérification du serveur...');
  try {
    const serverStatus = await checkServerOnline();
    logger.log(`Serveur: ${serverStatus ? 'connecté' : 'déconnecté'}`);
    return serverStatus;
  } catch (error) {
    logger.warn(`Erreur de vérification serveur: ${error.message}`);
    return false;
  }
}

// Fonction principale d'initialisation simplifiée
async function initialize() {
  logger.log('Initialisation du service worker (version simplifiée)...');
  
  try {
    // Étape 1: Configuration
    await initializeConfig();
    
    // Étape 2: Serveur
    const serverStatus = await initializeServer();
    
    // Étape 3: Vérification système
    await verifySystemIntegrity();
    
    // Configuration des gestionnaires de messages
    setupMessageHandlers();
    
    logger.log('Initialisation terminée');
    
    return { 
      authStatus: { isAuthenticated: true }, // Toujours vrai avec clé API fixe
      serverStatus
    };
  } catch (error) {
    logger.error(`Erreur d'initialisation: ${error.message}`);
    return { 
      authStatus: { isAuthenticated: true },
      serverStatus: false
    };
  }
}

// Installation/mise à jour
chrome.runtime.onInstalled.addListener(async (details) => {
  logger.log(`Extension installée/mise à jour: ${details.reason}`);
  await setDefaultConfig();
  await initialize();
});

// Démarrage
chrome.runtime.onStartup.addListener(() => {
  logger.log('Service worker démarré');
  initialize();
});

// Initialisation immédiate
let initPromise = initialize().catch(error => {
  logger.error(`Erreur d'initialisation: ${error.message}`);
  return {
    authStatus: { isAuthenticated: true },
    serverStatus: false
  };
});

// Export de la promesse d'initialisation
export { initPromise };

// Vérification périodique du serveur
setInterval(async () => {
  try {
    await forceServerCheck();
  } catch (error) {
    logger.warn(`Erreur de vérification périodique: ${error.message}`);
  }
}, 30 * 1000); // 30 secondes

// Gestionnaire de messages pour vérifications système
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'systemHealthCheck') {
    logger.log('Demande de vérification système reçue');
    
    (async () => {
      try {
        const serverStatus = getServerStatus();
        const serverCheck = await forceServerCheck();
        
        sendResponse({
          success: true,
          authStatus: { isAuthenticated: true },
          serverStatus: serverStatus,
          serverValidated: serverCheck,
          timestamp: Date.now()
        });
      } catch (error) {
        sendResponse({
          success: false,
          error: error.message,
          timestamp: Date.now()
        });
      }
    })();
    
    return true; // Réponse asynchrone
  }
});