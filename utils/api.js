// FCA-Agent - Module API unifié et simplifié

import { getAuthHeaders, checkServerAuthentication } from './auth.js';
import { createModuleLogger } from './logger.js';

const logger = createModuleLogger('API_CLIENT');

/**
 * Récupère l'URL de l'API depuis le background script
 * @returns {Promise<string>} URL de base de l'API
 */
export async function getApiBaseUrl() {
  try {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action: 'getApiUrl' }, (response) => {
        if (chrome.runtime.lastError) {
          logger.warn(`Erreur lors de la récupération de l'URL API: ${chrome.runtime.lastError.message}`);
          // Valeur par défaut en cas d'erreur
          resolve('http://fca-agent.letsq.xyz/api');
          return;
        }
        
        if (response && response.url) {
          resolve(response.url);
        } else {
          // Valeur par défaut en cas de réponse incorrecte
          logger.warn("Impossible de récupérer l'URL API, utilisation de la valeur par défaut");
          resolve('http://fca-agent.letsq.xyz/api');
        }
      });
    });
  } catch (error) {
    logger.error(`Exception lors de la récupération de l'URL API: ${error.message}`);
    return 'http://fca-agent.letsq.xyz/api';
  }
}

/**
 * Vérifie l'état de connexion au serveur
 * @returns {Promise<boolean>} État de connexion
 */
export async function checkServerConnection() {
  try {
    const apiBaseUrl = await getApiBaseUrl();
    const response = await fetch(`${apiBaseUrl}/status`, { 
      method: 'GET',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' }
    });
    return response.ok;
  } catch (error) {
    logger.error(`Erreur de connexion: ${error.message}`);
    return false;
  }
}

/**
 * Vérifie l'état d'authentification actuel avec le serveur
 * @returns {Promise<boolean>} État d'authentification
 */
export async function checkAuthentication() {
  try {
    const apiBaseUrl = await getApiBaseUrl();
    return await checkServerAuthentication(apiBaseUrl);
  } catch (error) {
    logger.error(`Erreur lors de la vérification d'authentification: ${error.message}`);
    return false;
  }
}

/**
 * Récupère une réponse complète depuis le serveur
 * @param {string} responseId - ID de la réponse à récupérer
 * @returns {Promise<string>} Réponse complète
 */
export async function fetchFullResponse(responseId) {
  try {
    const apiBaseUrl = await getApiBaseUrl();
    logger.debug(`Récupération de la réponse complète: ${responseId}`);
    logger.debug(`URL appelée: ${apiBaseUrl}/tasks/response/${responseId}`);
    
    const response = await fetch(`${apiBaseUrl}/tasks/response/${responseId}`, {
      method: 'GET',
      headers: getAuthHeaders()
    });
    
    logger.debug(`Statut de la réponse: ${response.status}`);
    
    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.success || !data.data || !data.data.response) {
      throw new Error('Format de réponse invalide');
    }
    
    const fullResponse = data.data.response;
    logger.debug(`Réponse reçue: ${fullResponse.length} caractères`);
    
    return fullResponse;
  } catch (error) {
    logger.error(`Erreur lors de la récupération de la réponse complète: ${error.message}`);
    throw error;
  }
}

// La classe ApiClient standardisée
class ApiClient {
  constructor() {
    this.baseUrl = null; // Sera défini via getApiBaseUrl()
  }
  
  /**
   * Récupère l'URL de base de l'API
   * @returns {Promise<string>} URL de base
   */
  async getBaseUrl() {
    if (!this.baseUrl) {
      this.baseUrl = await getApiBaseUrl();
    }
    return this.baseUrl;
  }
  
  /**
   * Effectue une requête GET
   * @param {string} endpoint - Point de terminaison API
   * @returns {Promise<Object>} Réponse de l'API
   */
  async get(endpoint) {
    try {
      const baseUrl = await this.getBaseUrl();
      logger.debug(`GET ${endpoint}`);
      
      const response = await fetch(`${baseUrl}/${endpoint}`, {
        method: 'GET',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`Erreur API (${response.status}): ${errorText}`);
        throw new Error(`Erreur API: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      logger.error(`Erreur lors de la requête GET ${endpoint}: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Effectue une requête POST
   * @param {string} endpoint - Point de terminaison API
   * @param {Object} data - Données à envoyer
   * @returns {Promise<Object>} Réponse de l'API
   */
  async post(endpoint, data) {
    try {
      const baseUrl = await this.getBaseUrl();
      logger.debug(`POST ${endpoint}`);
      
      const response = await fetch(`${baseUrl}/${endpoint}`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`Erreur API (${response.status}): ${errorText}`);
        throw new Error(`Erreur API: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      logger.error(`Erreur lors de la requête POST ${endpoint}: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Exécute une tâche sur le serveur
   * @param {string} taskType - Type de tâche
   * @param {Object} taskData - Données de la tâche
   * @returns {Promise<Object>} Résultat de l'exécution
   */
  async executeTask(taskType, taskData) {
    try {
      logger.info(`Exécution de la tâche: ${taskType}`);
      return await this.post('tasks', { type: taskType, data: taskData });
    } catch (error) {
      logger.error(`Erreur lors de l'exécution de la tâche ${taskType}: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Vérifie le statut du serveur
   * @returns {Promise<Object>} Statut du serveur
   */
  async checkServerStatus() {
    try {
      return await this.get('status');
    } catch (error) {
      logger.error(`Erreur lors de la vérification du statut du serveur: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Vérifie l'authentification
   * @returns {Promise<boolean>} État d'authentification
   */
  async checkAuthentication() {
    try {
      const baseUrl = await this.getBaseUrl();
      return await checkServerAuthentication(baseUrl);
    } catch (error) {
      logger.error(`Erreur lors de la vérification d'authentification: ${error.message}`);
      return false;
    }
  }
}

// Exporter une instance unique du client API
export const apiClient = new ApiClient();
export default apiClient;