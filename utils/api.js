// FCA-Agent - Utilitaires d'API
// Fonctions utilitaires pour communiquer avec le serveur Raspberry Pi

class ApiClient {
  constructor(baseUrl = 'http://fca-agent.letsq.xyz/api') {
    this.baseUrl = baseUrl;
    this.accessToken = null;
    this.refreshToken = null;
  }
  
  // Définir les tokens d'authentification
  setTokens(accessToken, refreshToken) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
  }
  
  // Récupérer le refresh token
  getRefreshToken() {
    return this.refreshToken;
  }
  
  // Headers par défaut pour les requêtes
  _getHeaders() {
    const headers = {
      'Content-Type': 'application/json'
    };
    
    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
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
    
    if (response && response.success && response.accessToken && response.refreshToken) {
      this.setTokens(response.accessToken, response.refreshToken);
      return response;
    }
    
    return response;
  }
  
  // Rafraîchir le token d'accès
  async refreshToken() {
    if (!this.refreshToken) {
      throw new Error('Pas de refresh token disponible');
    }
    
    try {
      const response = await this.post('auth/refresh', { refreshToken: this.refreshToken });
      
      if (response && response.success && response.accessToken && response.refreshToken) {
        this.setTokens(response.accessToken, response.refreshToken);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Erreur lors du rafraîchissement du token:', error);
      // Réinitialiser les tokens en cas d'échec
      this.accessToken = null;
      this.refreshToken = null;
      return false;
    }
  }
  
  // Déconnexion
  async logout() {
    if (this.refreshToken) {
      try {
        await this.post('auth/logout', { refreshToken: this.refreshToken });
      } catch (error) {
        console.error('Erreur lors de la déconnexion:', error);
      }
    }
    
    this.accessToken = null;
    this.refreshToken = null;
    return true;
  }
  
  // Obtenir le statut actuel de la connexion
  isConnected() {
    return !!this.accessToken;
  }
}

// Exporter une instance unique du client API
const apiClient = new ApiClient();
export default apiClient;