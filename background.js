// FCA-Agent - Background Service Worker (version refactorisée)

import { loadInitialConfig, setDefaultConfig } from './background/config.js';
import { loadAuthState, getAuthStatus, checkAuthWithServer } from './background/auth.js';
import { setupMessageHandlers } from './background/handlers.js';
import { checkServerOnline, getServerStatus, forceServerCheck } from './background/server.js';
import logger from './util/logger.js';

// Fonctions d'initialisation séparées par domaine
async function initializeConfig() {
  logger.log('Background.js','Initialisation de la configuration...');
  await loadInitialConfig();
  logger.log('Background.js','Configuration chargée');
}

async function initializeAuth() {
  logger.log('Background.js','Initialisation de l\'authentification...');
  const authStatus = await loadAuthState();
  logger.log('Background.js',`État initial d'authentification: ${JSON.stringify(authStatus)}`);
  
  // Vérification optionnelle avec le serveur si on est déjà authentifié localement
  if (authStatus.isAuthenticated) {
    logger.log('Background.js','Authentifié localement, vérification avec le serveur...');
    try {
      const serverAuthStatus = await checkAuthWithServer();
      logger.log('Background.js',`Résultat de la vérification serveur: ${JSON.stringify(serverAuthStatus)}`);
    } catch (error) {
      logger.log('Background.js',`Erreur lors de la vérification avec le serveur: ${error.message}`, 'warn');
    }
  }
  
  return authStatus;
}

async function initializeServer() {
  logger.log('Background.js','Vérification de l\'état du serveur...');
  try {
    const serverStatus = await checkServerOnline();
    logger.log('Background.js',`État initial du serveur: ${serverStatus ? 'connecté' : 'déconnecté'}`);
    
    // Force une diffusion de l'état initial
    if (serverStatus) {
      await forceServerCheck();
    }
    
    return serverStatus;
  } catch (error) {
    logger.log('Background.js',`Erreur lors de la vérification initiale du serveur: ${error.message}`, 'warn');
    return false;
  }
}

// Fonction principale d'initialisation
async function initialize() {
  logger.log('Background.js','Initialisation du service worker FCA-Agent...');
  
  // Chargement séquentiel des modules
  await initializeConfig();
  await initializeAuth();
  await initializeServer();
  
  // Configuration des gestionnaires de messages
  setupMessageHandlers();
  
  logger.log('Background.js','Initialisation du service worker terminée');
  
  // Force une vérification après l'initialisation
  setTimeout(async () => {
    logger.log('Background.js','Vérification forcée après initialisation');
    await forceServerCheck();
  }, 2000);
}

// Installation/mise à jour de l'extension
chrome.runtime.onInstalled.addListener(async (details) => {
  logger.log('Background.js',`FCA-Agent installé/mis à jour: ${details.reason}`);
  
  if (details.reason === 'install') {
    logger.log('Background.js','Première installation, réinitialisation des paramètres...');
    // Effacer tous les tokens d'authentification lors d'une nouvelle installation
    chrome.storage.local.remove(['authToken'], () => {
      logger.log('Background.js','Token d\'authentification supprimé (nouvelle installation)');
    });
  }
  
  await setDefaultConfig();
  await initialize();
});

// Démarrage du service worker
chrome.runtime.onStartup.addListener(() => {
  logger.log('Background.js','Service worker démarré via onStartup');
  initialize();
});

// Initialisation immédiate (pour les cas où onStartup n'est pas déclenché)
initialize().catch(error => {
  logger.log('Background.js',`Erreur lors de l'initialisation du service worker: ${error.message}`, 'error');
});

// Mise en place d'une vérification périodique courte pour les statuts
setInterval(async () => {
  logger.log('Background.js','Vérification périodique rapide du serveur...');
  
  try {
    // Vérifier le serveur et forcer la diffusion du statut
    await forceServerCheck();
  } catch (error) {
    logger.log('Background.js',`Erreur lors de la vérification rapide: ${error.message}`, 'warn');
  }
}, 30 * 1000); // Vérification toutes les 30 secondes

// Mise en place d'une vérification périodique plus complète
setInterval(async () => {
  logger.log('Background.js','Vérification périodique complète des statuts...');
  
  try {
    // Vérifier d'abord si le serveur est en ligne
    const isServerOnline = await forceServerCheck();
    logger.log('Background.js',`Serveur en ligne: ${isServerOnline}`);
    
    // Si le serveur est en ligne et que nous sommes authentifiés localement, vérifier avec le serveur
    if (isServerOnline) {
      const authStatus = getAuthStatus();
      if (authStatus.isAuthenticated) {
        logger.log('Background.js','Authentifié localement, vérification avec le serveur...');
        const serverAuthStatus = await checkAuthWithServer();
        logger.log('Background.js',`Résultat de la vérification: ${JSON.stringify(serverAuthStatus)}`);
      }
    }
  } catch (error) {
    logger.log('Background.js',`Erreur lors de la vérification périodique: ${error.message}`, 'warn');
  }
}, 5 * 60 * 1000); // Vérification complète toutes les 5 minutes
