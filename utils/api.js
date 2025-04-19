// FCA-Agent - Utilitaires d'API
// Fonctions utilitaires pour communiquer avec le serveur Raspberry Pi

class ApiClient {
  constructor(baseUrl = 'http://localhost:3001/api') {
    this.baseUrl = baseUrl;
    this.authToken = null;
  }
  
  // Définir le token d'authentification
  setAuthToken(token) {
    this.authToken = token;
  }
  
  // Headers par défaut pour les requêtes
  _getHeaders() {
    const headers = {
      'Content-Type': 'application/json'
    };
    
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }
    
    return headers;
  }
  
  // Effectuer une requête GET
  async get(endpoint) {
    try {
      const response = await fetch(`${this.baseUrl}/${endpoint}`, {
        method: 'GET',
        headers: this._getHeaders()
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
    try {
      const response = await fetch(`${this.baseUrl}/${endpoint}`, {
        method: 'POST',
        headers: this._getHeaders(),
        body: JSON.stringify(data)
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
  
  // Méthodes spécifiques aux fonctionnalités
  
  // Vérifier l'état du serveur
  async checkStatus() {
    return this.get('status');
  }
  
  // Exécuter une tâche spécifique
  async executeTask(taskType, taskData) {
    return this.post('tasks', { type: taskType, data: taskData });
  }
  
  // Authentification
  async login(username, password) {
    const response = await this.post('auth/login', { username, password });
    
    if (response && response.token) {
      this.setAuthToken(response.token);
      return response;
    }
    
    return response;
  }
  
  // Obtenir le statut actuel de la connexion
  isConnected() {
    return !!this.authToken;
  }
}

// Exporter une instance unique du client API
const apiClient = new ApiClient();
export default apiClient;