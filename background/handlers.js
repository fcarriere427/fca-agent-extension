// FCA-Agent - Module de gestion des messages
// Ce module gère le traitement des messages entre les différentes parties de l'extension

import { getApiUrl, setApiUrl } from './config.js';
import { getAuthHeaders } from './auth-headers.js';
import { 
  getServerStatus, 
  checkServerOnline, 
  executeTaskOnServer, 
  forceServerCheck 
} from './server.js';
import { createLogger } from '../utils/logger.js';

// Création d'un logger dédié au module de gestion des messages
const logger = createLogger('handlers');

/**
 * Configure les gestionnaires de messages pour l'extension
 * @returns {void}
 */
export function setupMessageHandlers() {
  try {
    logger.info('Configuration des gestionnaires de messages');
    
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      const source = sender.tab ? 'content script' : 'popup';
      logger.debug(`Message reçu`, { action: message.action, source });
      
      // Gestion des messages par type d'action
      switch (message.action) {
        case 'getStatus':
          handleGetStatus(sendResponse);
          break;
          
        case 'getAuthStatus':
          handleGetAuthStatus(sendResponse);
          break;
          
        case 'getServerStatus':
          handleGetServerStatus(sendResponse);
          break;
        
        case 'checkServerOnline':
          handleCheckServerOnline(sendResponse);
          break;
          
        case 'forceServerCheck':
          handleForceServerCheck(sendResponse);
          break;
          
        case 'executeTask':
          handleExecuteTask(message.task, message.data, sendResponse);
          break;
          
        case 'login':
          handleLogin(sendResponse);
          break;
          
        case 'logout':
          handleLogout(sendResponse);
          break;
          
        case 'checkAuthentication':
          handleCheckAuthentication(sendResponse);
          break;
          
        case 'updateApiUrl':
          handleUpdateApiUrl(message.url, sendResponse);
          break;
          
        case 'getApiUrl':
          handleGetApiUrl(sendResponse);
          break;
          
        case 'getAuthAndServerStatus':
          handleGetAuthAndServerStatus(sendResponse);
          break;
          
        case 'serverStatusChanged':
          handleServerStatusChanged(sendResponse);
          break;
          
        case 'authStatusChanged':
          handleAuthStatusChanged(sendResponse);
          break;
          
        default:
          handleUnknownAction(message.action, sendResponse);
      }
      
      return true; // Indique que la réponse sera envoyée de manière asynchrone
    });
    
    logger.info('Gestionnaires de messages configurés avec succès');
  } catch (error) {
    logger.error('Erreur lors de la configuration des gestionnaires de messages', null, error);
  }
}

/**
 * Gère la demande de statut global
 * @param {Function} sendResponse - Fonction de callback pour envoyer la réponse
 * @returns {Promise<void>}
 */
async function handleGetStatus(sendResponse) {
  try {
    logger.debug('Traitement de la demande de statut global');
    
    // Vérification complète du serveur
    await checkServerOnline();
    
    // Récupérer le statut complet du serveur
    const fullStatus = getServerStatus();
    
    // Formater la réponse avec authentification toujours valide
    const response = { 
      status: fullStatus.isConnected ? 'connected' : 'disconnected',
      authenticated: true, // Toujours authentifié avec clé API fixe
      authValid: true, // Toujours valide avec clé API fixe
      statusCode: fullStatus.statusCode,
      lastCheck: fullStatus.lastCheck,
      error: fullStatus.error,
      timeout: fullStatus.timeout
    };
    
    logger.info('Statut global récupéré avec succès', {
      connected: response.status === 'connected'
    });
    
    sendResponse(response);
  } catch (error) {
    logger.error('Erreur lors de la récupération du statut global', null, error);
    sendResponse({ 
      status: 'disconnected', 
      authenticated: true, // Toujours authentifié avec clé API fixe
      authValid: true, // Toujours valide avec clé API fixe  
      error: true,
      message: error.message 
    });
  }
}

/**
 * Gère la demande de statut d'authentification
 * @param {Function} sendResponse - Fonction de callback pour envoyer la réponse
 * @returns {void}
 */
function handleGetAuthStatus(sendResponse) {
  logger.debug('Traitement de la demande de statut d\'authentification');
  
  const serverStatus = getServerStatus();
  const authStatus = {
    isAuthenticated: true, // Toujours authentifié avec clé API fixe
    serverStatus: {
      ...serverStatus,
      authValid: true // Toujours valide avec clé API fixe
    }
  };
  
  logger.info('Statut d\'authentification récupéré');
  sendResponse(authStatus);
}

/**
 * Gère la demande de statut du serveur
 * @param {Function} sendResponse - Fonction de callback pour envoyer la réponse
 * @returns {void}
 */
function handleGetServerStatus(sendResponse) {
  try {
    logger.debug('Traitement de la demande de statut du serveur');
    
    const serverStatus = getServerStatus();
    
    // Modifier le statut pour toujours indiquer que l'authentification est valide
    const modifiedStatus = {
      ...serverStatus,
      authValid: true // Toujours valide avec clé API fixe
    };
    
    logger.info('Statut du serveur récupéré', { 
      isConnected: modifiedStatus.isConnected 
    });
    
    sendResponse(modifiedStatus);
  } catch (error) {
    logger.error('Erreur lors de la récupération du statut du serveur', null, error);
    sendResponse({ 
      isConnected: false,
      authValid: true, // Toujours valide avec clé API fixe
      error: true,
      message: error.message 
    });
  }
}

/**
 * Exécute une tâche sur le serveur
 * @param {string} taskType - Type de tâche à exécuter
 * @param {Object} taskData - Données associées à la tâche
 * @param {Function} sendResponse - Fonction de callback pour envoyer la réponse
 * @returns {Promise<void>}
 */
async function handleExecuteTask(taskType, taskData, sendResponse) {
  try {
    logger.info('Exécution d\'une tâche demandée', { type: taskType });
    
    // Exécuter la tâche sur le serveur
    logger.debug(`Exécution de la tâche sur le serveur`, { type: taskType });
    const result = await executeTaskOnServer(taskType, taskData);
    
    logger.info('Tâche exécutée avec succès', { type: taskType });
    sendResponse({ success: true, result });
  } catch (error) {
    logger.error('Erreur lors de l\'exécution de la tâche', { type: taskType }, error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Vérifie si le serveur est en ligne
 * @param {Function} sendResponse - Fonction de callback pour envoyer la réponse
 * @returns {Promise<void>}
 */
async function handleCheckServerOnline(sendResponse) {
  try {
    logger.debug('Vérification de la connexion au serveur');
    
    const isOnline = await checkServerOnline();
    const serverStatus = getServerStatus();
    
    // Modifier le statut pour toujours indiquer que l'authentification est valide
    const modifiedStatus = {
      ...serverStatus,
      authValid: true // Toujours valide avec clé API fixe
    };
    
    logger.info('Statut de connexion au serveur vérifié', { isOnline });
    sendResponse({ isConnected: isOnline, ...modifiedStatus });
  } catch (error) {
    logger.error('Erreur lors de la vérification de la connexion au serveur', null, error);
    sendResponse({ 
      isConnected: false, 
      authValid: true, // Toujours valide avec clé API fixe
      error: true, 
      message: error.message
    });
  }
}

/**
 * Force une vérification du serveur
 * @param {Function} sendResponse - Fonction de callback pour envoyer la réponse
 * @returns {Promise<void>}
 */
async function handleForceServerCheck(sendResponse) {
  try {
    logger.info('Vérification forcée de la connexion au serveur');
    
    const isOnline = await forceServerCheck();
    const serverStatus = getServerStatus();
    
    // Modifier le statut pour toujours indiquer que l'authentification est valide
    const modifiedStatus = {
      ...serverStatus,
      authValid: true // Toujours valide avec clé API fixe
    };
    
    logger.info('Vérification forcée terminée', { isOnline });
    sendResponse({ 
      isConnected: isOnline, 
      forced: true,
      ...modifiedStatus
    });
  } catch (error) {
    logger.error('Erreur lors de la vérification forcée du serveur', null, error);
    sendResponse({ 
      isConnected: false, 
      authValid: true, // Toujours valide avec clé API fixe
      error: true, 
      forced: true,
      message: error.message
    });
  }
}

/**
 * Gère une demande de connexion (simplifiée pour clé API fixe)
 * @param {Function} sendResponse - Fonction de callback pour envoyer la réponse
 * @returns {void}
 */
function handleLogin(sendResponse) {
  logger.info('Demande de connexion (toujours authentifié avec clé API fixe)');
  sendResponse({ success: true, authenticated: true });
}

/**
 * Gère une demande de déconnexion (simplifiée pour clé API fixe)
 * @param {Function} sendResponse - Fonction de callback pour envoyer la réponse
 * @returns {void}
 */
function handleLogout(sendResponse) {
  logger.info('Demande de déconnexion (sans effet avec clé API fixe)');
  sendResponse({ success: true });
}

/**
 * Vérifie l'état de l'authentification (simplifiée pour clé API fixe)
 * @param {Function} sendResponse - Fonction de callback pour envoyer la réponse
 * @returns {void}
 */
function handleCheckAuthentication(sendResponse) {
  logger.debug('Vérification de l\'authentification (toujours vrai avec clé API fixe)');
  sendResponse({ authenticated: true });
}

/**
 * Met à jour l'URL de l'API
 * @param {string} url - Nouvelle URL de l'API
 * @param {Function} sendResponse - Fonction de callback pour envoyer la réponse
 * @returns {Promise<void>}
 */
async function handleUpdateApiUrl(url, sendResponse) {
  try {
    logger.info('Mise à jour de l\'URL de l\'API demandée', { url });
    
    await setApiUrl(url);
    
    logger.info('URL de l\'API mise à jour avec succès');
    sendResponse({ success: true });
  } catch (error) {
    logger.error('Erreur lors de la mise à jour de l\'URL de l\'API', { url }, error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Récupère l'URL de l'API
 * @param {Function} sendResponse - Fonction de callback pour envoyer la réponse
 * @returns {Promise<void>}
 */
async function handleGetApiUrl(sendResponse) {
  try {
    logger.debug('Récupération de l\'URL de l\'API');
    
    const url = await getApiUrl();
    
    logger.debug('URL de l\'API récupérée', { url });
    sendResponse({ url });
  } catch (error) {
    logger.error('Erreur lors de la récupération de l\'URL de l\'API', null, error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Récupère à la fois les statuts d'authentification et du serveur
 * @param {Function} sendResponse - Fonction de callback pour envoyer la réponse
 * @returns {void}
 */
function handleGetAuthAndServerStatus(sendResponse) {
  try {
    logger.debug('Récupération des statuts d\'authentification et du serveur');
    
    // Récupérer le statut du serveur et toujours indiquer que l'authentification est valide
    const serverStatus = getServerStatus();
    const fullServerStatus = {
      ...serverStatus,
      authValid: true // Toujours valide avec clé API fixe
    };
    
    logger.info('Statuts d\'authentification et du serveur récupérés', {
      isConnected: fullServerStatus.isConnected
    });
    
    sendResponse(fullServerStatus);
  } catch (error) {
    logger.error('Erreur lors de la récupération des statuts', null, error);
    sendResponse({ 
      isConnected: false, 
      authValid: true, // Toujours valide avec clé API fixe
      error: true, 
      message: error.message 
    });
  }
}

/**
 * Gère les notifications de changement de statut du serveur
 * @param {Function} sendResponse - Fonction de callback pour envoyer la réponse
 * @returns {void}
 */
function handleServerStatusChanged(sendResponse) {
  logger.debug('Notification de changement de statut du serveur reçue');
  sendResponse({ acknowledged: true });
}

/**
 * Gère les notifications de changement de statut d'authentification (sans effet avec clé API fixe)
 * @param {Function} sendResponse - Fonction de callback pour envoyer la réponse
 * @returns {void}
 */
function handleAuthStatusChanged(sendResponse) {
  logger.debug('Notification de changement de statut d\'authentification reçue (sans effet avec clé API fixe)');
  sendResponse({ acknowledged: true });
}

/**
 * Gère les actions non reconnues
 * @param {string} action - Action non reconnue
 * @param {Function} sendResponse - Fonction de callback pour envoyer la réponse
 * @returns {void}
 */
function handleUnknownAction(action, sendResponse) {
  logger.warn('Action non reconnue', { action });
  sendResponse({ success: false, error: 'Action non reconnue' });
}

export default {
  setupMessageHandlers
};