// FCA-Agent - Module API unifié

/**
 * Récupère l'URL de l'API depuis le background script
 * @returns {Promise<string>} URL de base de l'API
 */
export async function getApiBaseUrl() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'getApiUrl' }, (response) => {
      if (response && response.url) {
        resolve(response.url);
      } else {
        // Valeur par défaut en cas d'échec
        console.warn("Impossible de récupérer l'URL API, utilisation de la valeur par défaut");
        resolve('http://fca-agent.letsq.xyz/api');
      }
    });
  });
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
      headers: { 'Content-Type': 'application/json' }
    });
    return response.ok;
  } catch (error) {
    console.error('Erreur de connexion:', error);
    return false;
  }
}

/**
 * Vérifie l'état d'authentification actuel (toujours vrai avec clé API fixe)
 * @returns {Promise<boolean>} État d'authentification
 */
export async function checkAuthentication() {
  try {
    // Vérification du serveur uniquement (pas d'authentification avec clé API fixe)
    const apiBaseUrl = await getApiBaseUrl();
    const response = await fetch(`${apiBaseUrl}/status`, { 
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    // Si le serveur est accessible, l'authentification est toujours valide avec clé API fixe
    return response.ok;
  } catch (error) {
    console.error("Erreur lors de la vérification de connexion au serveur:", error);
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
    
    // Afficher l'URL complète dans la console pour le débogage
    console.log("URL appelée:", `${apiBaseUrl}/tasks/response/${responseId}`);
    
    // Utiliser fetch standard pour récupérer la réponse
    const response = await fetch(`${apiBaseUrl}/tasks/response/${responseId}`, {
      method: 'GET',
      credentials: 'include'
    });
    
    console.log("Statut de la réponse:", response.status);
    
    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status}`);
    }
    
    // Récupérer le contenu en texte brut
    const textContent = await response.text();
    console.log(`Réponse reçue: ${textContent.length} caractères`);
    
    return textContent;
  } catch (error) {
    console.error('Erreur lors de la récupération de la réponse complète:', error);
    throw error;
  }
}

// La classe ApiClient pour ceux qui préfèrent une approche orientée objet
class ApiClient {
  constructor() {
    this.baseUrl = null; // Sera défini via getApiBaseUrl()
  }
  
  // Utilise la fonction getApiBaseUrl ci-dessus
  async getBaseUrl() {
    if (!this.baseUrl) {
      this.baseUrl = await getApiBaseUrl();
    }
    return this.baseUrl;
  }
  
  // Effectuer une requête GET
  async get(endpoint) {
    const baseUrl = await this.getBaseUrl();
    
    try {
      const response = await fetch(`${baseUrl}/${endpoint}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`Erreur API: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`Erreur lors de la requête GET ${endpoint}:`, error);
      throw error;
    }
  }
  
  // Effectuer une requête POST
  async post(endpoint, data) {
    const baseUrl = await this.getBaseUrl();
    
    try {
      const response = await fetch(`${baseUrl}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`Erreur API: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`Erreur lors de la requête POST ${endpoint}:`, error);
      throw error;
    }
  }
  
  // Exécuter une tâche (comme le résumé d'emails)
  async executeTask(taskType, taskData) {
    return this.post('tasks', { type: taskType, data: taskData });
  }
  
  // Vérifier le statut du serveur
  async checkServerStatus() {
    return this.get('status');
  }
  
  // Vérifier l'authentification
  async checkAuthentication() {
    // Avec clé API fixe, vérifier uniquement la connexion au serveur
    try {
      await this.get('status');
      return true; // Si le serveur répond, l'authentification est toujours valide avec clé API fixe
    } catch (error) {
      console.error("Erreur lors de la vérification de connexion au serveur:", error);
      return false;
    }
  }
  
  // Déconnexion
  async logout() {
    // Avec clé API fixe, la déconnexion ne fait rien
    return true;
  }
}

// Exporter une instance unique du client API
export const apiClient = new ApiClient();
export default apiClient;