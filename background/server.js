// FCA-Agent - Module de communication avec le serveur
// Ce module gère toutes les interactions avec le serveur de l'application

import { getApiUrl } from './config.js';
import { getAuthHeaders, isAuthConfigured } from './auth-headers.js';
import { createLogger } from '../utils/logger.js';

// Création d'un logger dédié au module serveur
const logger = createLogger('server');

// État du serveur - inclut connexion et authentification
let serverStatus = {
  isConnected: false,  // Serveur accessible (par défaut: non connecté)
  authValid: null,     // Clé API valide (null si inconnu)
  statusCode: null,    // Code HTTP pour diagnostic
  lastCheck: null,     // Horodatage de la dernière vérification
  timeout: false,      // Indique si la dernière requête a expiré
  error: false         // Indique s'il y a eu une erreur
};

/**
 * Récupère l'état actuel du serveur
 * @returns {Object} État actuel du serveur
 */
export async function getServerStatus() {
  try {
    logger.debug('Récupération du statut du serveur');
    return { ...serverStatus };
  } catch (error) {
    logger.error('Erreur lors de la récupération du statut du serveur', null, error);
    return { ...serverStatus };
  }
}

/**
 * Met à jour l'état du serveur et notifie les composants si nécessaire
 * @param {Object} newStatus - Nouvelles valeurs pour l'état du serveur
 * @returns {Promise<void>}
 */
export async function setServerStatus(newStatus) {
  try {
    // Créer une copie de l'ancien statut pour la comparaison
    const previousStatus = { ...serverStatus };
    
    // Mettre à jour les champs fournis et l'horodatage
    serverStatus = {
      ...serverStatus,
      ...newStatus,
      lastCheck: Date.now()
    };
    
    logger.debug('Mise à jour du statut du serveur', { 
      previous: {
        isConnected: previousStatus.isConnected,
        authValid: previousStatus.authValid,
        statusCode: previousStatus.statusCode
      }, 
      current: {
        isConnected: serverStatus.isConnected,
        authValid: serverStatus.authValid,
        statusCode: serverStatus.statusCode
      }
    });
    
    // Vérifier s'il y a eu un changement significatif
    const hasChanged = (
      // Changement d'état de connexion
      previousStatus.isConnected !== serverStatus.isConnected ||
      // Changement de validité d'authentification seulement s'il est définitif (true/false mais pas null)
      ((previousStatus.authValid !== serverStatus.authValid) && 
        (serverStatus.authValid !== null || previousStatus.authValid !== null)) ||
      // Changement de code de statut
      previousStatus.statusCode !== serverStatus.statusCode ||
      // Changement dans l'état d'erreur ou de timeout
      (serverStatus.error !== previousStatus.error) ||
      (serverStatus.timeout !== previousStatus.timeout)
    );
    
    // Si changement de statut, notifier les composants
    if (hasChanged) {
      logger.info('Changement significatif du statut du serveur', {
        isConnected: serverStatus.isConnected,
        authValid: serverStatus.authValid
      });
      
      await broadcastServerStatus();
    }
  } catch (error) {
    logger.error('Erreur lors de la mise à jour du statut du serveur', null, error);
  }
}

/**
 * Diffuse le statut actuel du serveur aux autres composants de l'extension
 * @returns {Promise<void>}
 */
async function broadcastServerStatus() {
  try {
    logger.debug('Diffusion du statut du serveur');
    
    await new Promise((resolve) => {
      chrome.runtime.sendMessage({ 
        action: 'serverStatusChanged', 
        status: { ...serverStatus }
      }, (response) => {
        // Ignorer toute erreur (comme "Receiving end does not exist")
        if (chrome.runtime.lastError) {
          logger.debug('Message serverStatusChanged non délivré (normal au démarrage)');
        } else if (response && response.acknowledged) {
          // Message acquitté par au moins un récepteur
          logger.debug('Notification de statut acquittée');
        }
        resolve();
      });
    });
  } catch (error) {
    logger.error('Erreur lors de la diffusion du statut du serveur', null, error);
  }
}

/**
 * Vérifie si le serveur est en ligne et si la clé API est valide
 * @returns {Promise<boolean>} True si le serveur est en ligne, false sinon
 */
export async function checkServerOnline() {
  try {
    const apiUrl = await getApiUrl();
    logger.info('Vérification de la connexion au serveur', { url: `${apiUrl}/status` });
    
    // Récupérer les headers d'authentification (avec la clé API fixe)
    const headers = { 
      'Content-Type': 'application/json',
      ...getAuthHeaders()  // Inclure la clé API
    };
    
    logger.debug('Headers pour vérification', { 
      headerCount: Object.keys(headers).length
    });
    
    // Ajouter un timeout pour éviter les attentes trop longues
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 secondes de timeout
    
    try {
      const response = await fetch(`${apiUrl}/status`, {
        method: 'GET',
        headers: headers,
        cache: 'no-cache', // IMPORTANT: Pas de cache
        credentials: 'omit',  // Ne plus utiliser les cookies
        signal: controller.signal // Ajouter le signal pour le timeout
      });
      
      // Annuler le timeout car la requête a réussi
      clearTimeout(timeoutId);
      
      logger.debug('Réponse reçue du serveur', { statusCode: response.status });
      
      // Mettre à jour le statut en fonction du code de réponse
      if (response.ok) {
        // Code 200: Serveur en ligne et clé API valide
        logger.info('Serveur connecté avec clé API valide');
        await setServerStatus({
          isConnected: true,
          authValid: true,
          statusCode: response.status,
          error: false,
          timeout: false
        });
        return true;
      } else if (response.status === 401 || response.status === 403) {
        // Codes 401/403: Serveur en ligne mais clé API invalide
        logger.warn('Serveur connecté mais clé API invalide ou non acceptée');
        await setServerStatus({
          isConnected: true,
          authValid: false,
          statusCode: response.status,
          error: false,
          timeout: false
        });
        return true; // Le serveur est en ligne même si auth échouée
      } else {
        // Autre code d'erreur: problème avec le serveur
        logger.warn('Serveur accessible mais code d\'erreur inattendu', { statusCode: response.status });
        await setServerStatus({
          isConnected: true,
          authValid: null, // Inconnu
          statusCode: response.status,
          error: true,
          timeout: false
        });
        return true;
      }
    } catch (fetchError) {
      // Annuler le timeout en cas d'erreur fetch
      clearTimeout(timeoutId);
      
      // Vérifier si l'erreur est due au timeout
      if (fetchError.name === 'AbortError') {
        logger.error('Timeout lors de la connexion au serveur');
        // Marquer explicitement le timeout
        await setServerStatus({
          isConnected: false,
          authValid: null,
          statusCode: null,
          error: true,
          timeout: true
        });
      } else {
        logger.error('Erreur réseau lors de la vérification du serveur', null, fetchError);
        // Erreur réseau générique
        await setServerStatus({
          isConnected: false,
          authValid: null,
          statusCode: null,
          error: true,
          timeout: false
        });
      }
      return false;
    }
  } catch (error) {
    logger.error('Exception générale lors de la vérification du serveur', null, error);
    await setServerStatus({
      isConnected: false,
      authValid: null,
      statusCode: null,
      error: true,
      timeout: false
    });
    return false;
  }
}

/**
 * Force une vérification et une diffusion du statut du serveur
 * @returns {Promise<boolean>} True si le serveur est en ligne, false sinon
 */
export async function forceServerCheck() {
  try {
    logger.info('Vérification forcée du statut du serveur et de la clé API');
    
    // Vérification complète avec le serveur (clé API fixe)
    const isReachable = await checkServerOnline();
    
    // Journaliser le résultat détaillé
    if (isReachable) {
      if (serverStatus.authValid === true) {
        logger.info('Serveur en ligne avec clé API valide');
      } else if (serverStatus.authValid === false) {
        logger.warn('Serveur en ligne mais clé API invalide');
      } else {
        logger.info('Serveur en ligne avec statut d\'authentification inconnu', { 
          statusCode: serverStatus.statusCode 
        });
      }
    } else {
      logger.error('Serveur déconnecté ou inaccessible');
    }
    
    // Diffuser à nouveau l'état complet, même s'il n'a pas changé
    const broadcastMessage = async () => {
      try {
        await new Promise((resolve) => {
          chrome.runtime.sendMessage({ 
            action: 'serverStatusChanged', 
            status: { ...serverStatus }
          }, (response) => {
            if (chrome.runtime.lastError) {
              // Ne pas traiter comme critique - normal au démarrage
              logger.debug('Message serverStatusChanged non délivré (normal au démarrage)');
            } else if (response && response.acknowledged) {
              // Message acquitté par au moins un récepteur
              logger.debug('Notification forcée acquittée');
            } else {
              logger.debug('Diffusion forcée délivrée avec succès');
            }
            resolve();
          });
        });
      } catch (error) {
        logger.error('Erreur lors de la diffusion du message', null, error);
      }
    };
    
    // Appel immédiat puis second appel décalé pour augmenter les chances de réception
    await broadcastMessage();
    setTimeout(() => broadcastMessage(), 500); // Second envoi après 500ms
    
    // Sauvegarder le statut complet dans le stockage local comme mécanisme de secours
    try {
      await new Promise((resolve, reject) => {
        chrome.storage.local.set({ 'serverStatus': { ...serverStatus } }, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve();
          }
        });
      });
      
      logger.debug('Statut du serveur sauvegardé dans le stockage local');
    } catch (storageError) {
      logger.warn('Impossible de sauvegarder le statut du serveur dans le stockage local', null, storageError);
    }
    
    return isReachable;
  } catch (error) {
    logger.error('Erreur lors de la vérification forcée du serveur', null, error);
    
    // Sauvegarder l'état déconnecté dans le stockage
    try {
      await new Promise((resolve) => {
        chrome.storage.local.set({ 'serverStatus': { 
          isConnected: false, 
          authValid: null, 
          statusCode: null,
          error: true,
          lastCheck: Date.now(),
          timeout: false
        }}, resolve);
      });
    } catch (e) { 
      // Ignorer les erreurs de stockage en cas d'erreur principale
      logger.debug('Erreur secondaire lors de la sauvegarde de l\'état déconnecté', null, e);
    }
    
    return false;
  }
}

/**
 * Exécute une tâche sur le serveur
 * @param {string} taskType - Type de tâche à exécuter
 * @param {Object} taskData - Données de la tâche
 * @returns {Promise<Object>} Résultat de l'exécution de la tâche
 * @throws {Error} Si l'exécution de la tâche échoue
 */
export async function executeTaskOnServer(taskType, taskData) {
  try {
    const apiUrl = await getApiUrl();
    logger.info('Exécution d\'une tâche sur le serveur', { 
      type: taskType,
      url: `${apiUrl}/tasks`
    });
    
    // Vérifier que la clé API est configurée
    if (!isAuthConfigured()) {
      logger.error('Clé API non configurée pour l\'exécution de la tâche');
      throw new Error('Clé API non configurée pour cette action');
    }
    
    // Utiliser la clé API pour l'authentification
    const headers = {
      'Content-Type': 'application/json',
      ...getAuthHeaders() // Inclure la clé API dans les en-têtes
    };
    
    logger.debug('Headers pour la requête de tâche', { 
      headerCount: Object.keys(headers).length 
    });
    
    const response = await fetch(`${apiUrl}/tasks`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ type: taskType, data: taskData }),
      credentials: 'omit' // Ne pas utiliser de cookies
    });
    
    // Le serveur a répondu, mettre à jour son statut en fonction du code de réponse
    logger.debug('Réponse reçue pour l\'exécution de la tâche', { 
      statusCode: response.status 
    });
    
    if (response.ok) {
      // Serveur connecté avec authentification valide
      await setServerStatus({
        isConnected: true,
        authValid: true,
        statusCode: response.status,
        error: false,
        timeout: false
      });
    } else if (response.status === 401 || response.status === 403) {
      // Authentification échouée (clé API invalide)
      logger.error('Authentification échouée - clé API invalide ou non acceptée');
      await setServerStatus({
        isConnected: true,
        authValid: false,
        statusCode: response.status,
        error: false,
        timeout: false
      });
      throw new Error('Clé API invalide ou non acceptée par le serveur');
    } else {
      // Autre code d'erreur
      await setServerStatus({
        isConnected: true,
        authValid: null,
        statusCode: response.status,
        error: true,
        timeout: false
      });
    }
    
    if (!response.ok) {
      let errorMessage = `Erreur API: ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage += ` - ${JSON.stringify(errorData)}`;
        logger.error('Détails de l\'erreur d\'exécution de tâche', { 
          error: errorMessage 
        });
      } catch (e) {
        // Ignorer les erreurs de parsing
        logger.debug('Impossible de parser le corps de l\'erreur', null, e);
      }
      throw new Error(errorMessage);
    }
    
    const result = await response.json();
    logger.info('Tâche exécutée avec succès', { type: taskType });
    return result;
  } catch (error) {
    logger.error('Erreur lors de l\'exécution de la tâche', { type: taskType }, error);
    
    // Si erreur de connexion, marquer le serveur comme déconnecté
    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      logger.warn('Erreur de connexion détectée, serveur marqué comme déconnecté');
      await setServerStatus({
        isConnected: false,
        authValid: null,
        statusCode: null,
        error: true,
        timeout: error.message.includes('timeout') || error.message.includes('Timeout')
      });
    }
    
    throw error;
  }
}

export default {
  getServerStatus,
  setServerStatus,
  checkServerOnline,
  forceServerCheck,
  executeTaskOnServer
};
