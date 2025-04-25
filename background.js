// FCA-Agent - Background Service Worker (version refactorisée)

import { loadInitialConfig, setDefaultConfig } from './background/config.js';
import { loadAuthState, getAuthStatus, checkAuthWithServer } from './background/auth.js';
import { setupMessageHandlers } from './background/handlers.js';
import { checkServerOnline, getServerStatus, forceServerCheck } from './background/server.js';

// Logger spécifique au background script
function bgLog(message, level = 'info') {
  const prefix = '[BG:MAIN]';
  switch(level) {
    case 'error':
      console.error(`${prefix} ${message}`);
      break;
    case 'warn':
      console.warn(`${prefix} ${message}`);
      break;
    default:
      console.log(`${prefix} ${message}`);
  }
}

// Fonctions d'initialisation séparées par domaine
async function initializeConfig() {
  bgLog('Initialisation de la configuration...');
  await loadInitialConfig();
  bgLog('Configuration chargée');
}

async function initializeAuth() {
  bgLog('Initialisation de l\'authentification...');
  const authStatus = await loadAuthState();
  bgLog(`État initial d'authentification: ${JSON.stringify(authStatus)}`);
  
  // Vérification optionnelle avec le serveur si on est déjà authentifié localement
  if (authStatus.isAuthenticated) {
    bgLog('Authentifié localement, vérification avec le serveur...');
    try {
      const serverAuthStatus = await checkAuthWithServer();
      bgLog(`Résultat de la vérification serveur: ${JSON.stringify(serverAuthStatus)}`);
    } catch (error) {
      bgLog(`Erreur lors de la vérification avec le serveur: ${error.message}`, 'warn');
    }
  }
  
  return authStatus;
}

async function initializeServer() {
  bgLog('Vérification de l\'état du serveur...');
  try {
    const serverStatus = await checkServerOnline();
    bgLog(`État initial du serveur: ${serverStatus ? 'connecté' : 'déconnecté'}`);
    
    // Force une diffusion de l'état initial
    if (serverStatus) {
      await forceServerCheck();
    }
    
    return serverStatus;
  } catch (error) {
    bgLog(`Erreur lors de la vérification initiale du serveur: ${error.message}`, 'warn');
    return false;
  }
}

// Fonction principale d'initialisation
async function initialize() {
  bgLog('Initialisation du service worker FCA-Agent...');
  
  // Chargement séquentiel des modules
  await initializeConfig();
  await initializeAuth();
  await initializeServer();
  
  // Configuration des gestionnaires de messages
  setupMessageHandlers();
  
  bgLog('Initialisation du service worker terminée');
  
  // Force une vérification après l'initialisation
  setTimeout(async () => {
    bgLog('Vérification forcée après initialisation');
    await forceServerCheck();
  }, 2000);
}

// Installation/mise à jour de l'extension
chrome.runtime.onInstalled.addListener(async (details) => {
  bgLog(`FCA-Agent installé/mis à jour: ${details.reason}`);
  
  if (details.reason === 'install') {
    bgLog('Première installation, réinitialisation des paramètres...');
    // Effacer tous les tokens d'authentification lors d'une nouvelle installation
    chrome.storage.local.remove(['authToken'], () => {
      bgLog('Token d\'authentification supprimé (nouvelle installation)');
    });
  }
  
  await setDefaultConfig();
  await initialize();
});

// Démarrage du service worker
chrome.runtime.onStartup.addListener(() => {
  bgLog('Service worker démarré via onStartup');
  initialize();
});

// Initialisation immédiate (pour les cas où onStartup n'est pas déclenché)
initialize().catch(error => {
  bgLog(`Erreur lors de l'initialisation du service worker: ${error.message}`, 'error');
});

// Mise en place d'une vérification périodique courte pour les statuts
setInterval(async () => {
  bgLog('Vérification périodique rapide du serveur...');
  
  try {
    // Vérifier le serveur et forcer la diffusion du statut
    await forceServerCheck();
  } catch (error) {
    bgLog(`Erreur lors de la vérification rapide: ${error.message}`, 'warn');
  }
}, 30 * 1000); // Vérification toutes les 30 secondes

// Mise en place d'une vérification périodique plus complète
setInterval(async () => {
  bgLog('Vérification périodique complète des statuts...');
  
  try {
    // Vérifier d'abord si le serveur est en ligne
    const isServerOnline = await forceServerCheck();
    bgLog(`Serveur en ligne: ${isServerOnline}`);
    
    // Si le serveur est en ligne et que nous sommes authentifiés localement, vérifier avec le serveur
    if (isServerOnline) {
      const authStatus = getAuthStatus();
      if (authStatus.isAuthenticated) {
        bgLog('Authentifié localement, vérification avec le serveur...');
        const serverAuthStatus = await checkAuthWithServer();
        bgLog(`Résultat de la vérification: ${JSON.stringify(serverAuthStatus)}`);
      }
    }
  } catch (error) {
    bgLog(`Erreur lors de la vérification périodique: ${error.message}`, 'warn');
  }
}, 5 * 60 * 1000); // Vérification complète toutes les 5 minutes
