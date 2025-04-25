// FCA-Agent - Background Service Worker (version refactorisée)

import { loadInitialConfig, setDefaultConfig } from './background/config.js';
import { loadAuthState, getAuthStatus } from './background/auth.js';
import { setupMessageHandlers } from './background/handlers.js';
import { checkServerOnline, getServerStatus } from './background/server.js';

// Fonctions d'initialisation séparées par domaine
async function initializeConfig() {
  console.log('Initialisation de la configuration...');
  await loadInitialConfig();
}

async function initializeAuth() {
  console.log('Initialisation de l\'authentification...');
  const authStatus = await loadAuthState();
  console.log('État initial d\'authentification:', authStatus);
  return authStatus;
}

async function initializeServer() {
  console.log('Vérification de l\'état du serveur...');
  try {
    const serverStatus = await checkServerOnline();
    console.log('État initial du serveur:', serverStatus ? 'connecté' : 'déconnecté');
    return serverStatus;
  } catch (error) {
    console.warn('Erreur lors de la vérification initiale du serveur:', error);
    return false;
  }
}

// Fonction principale d'initialisation
async function initialize() {
  console.log('Initialisation du service worker FCA-Agent...');
  
  // Chargement séquentiel des modules
  await initializeConfig();
  await initializeAuth();
  await initializeServer();
  
  // Configuration des gestionnaires de messages
  setupMessageHandlers();
  
  // Notification des états initiaux aux composants intéressés
  notifyStatusToComponents();
  
  console.log('Initialisation du service worker terminée');
}

// Fonction utilitaire pour notifier les composants de l'état actuel
function notifyStatusToComponents() {
  const authStatus = getAuthStatus();
  const serverStatus = getServerStatus();
  
  console.log('Notification des états initiaux - Auth:', authStatus, 'Server:', serverStatus);
  
  // Vérifier si des listeners existent avant d'envoyer des messages
  try {
    // Envoyer les messages de manière sécurisée pour éviter l'erreur "Receiving end does not exist"
    chrome.runtime.sendMessage({ 
      action: 'authStatusChanged', 
      status: authStatus
    }).catch(err => {
      // Ignorer l'erreur "Receiving end does not exist"
      console.log('Pas de destinataire pour le message authStatusChanged, normal au démarrage');
    });
    
    chrome.runtime.sendMessage({ 
      action: 'serverStatusChanged', 
      status: serverStatus
    }).catch(err => {
      // Ignorer l'erreur "Receiving end does not exist"
      console.log('Pas de destinataire pour le message serverStatusChanged, normal au démarrage');
    });
  } catch (error) {
    console.log('Erreur lors de la notification des statuts, normal au démarrage:', error.message);
  }
}

// Installation/mise à jour de l'extension
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('FCA-Agent installé/mis à jour:', details.reason);
  await setDefaultConfig();
  await initialize();
});

// Démarrage du service worker
chrome.runtime.onStartup.addListener(() => {
  console.log('Service worker démarré via onStartup');
  initialize();
});

// Initialisation immédiate (pour les cas où onStartup n'est pas déclenché)
initialize().catch(error => {
  console.error('Erreur lors de l\'initialisation du service worker:', error);
});
