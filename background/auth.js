// FCA-Agent - Module d'authentification

import { getApiUrl } from './config.js';

// État d'authentification
let authToken = null;
let isAuthenticated = false;

// Méthodes d'accès
export function getAuthStatus() {
  return { isAuthenticated, hasToken: !!authToken };
}

export function setAuthenticated(status, token = null) {
  isAuthenticated = status;
  authToken = token;
  
  // Mise à jour du stockage local
  if (isAuthenticated && token) {
    chrome.storage.local.set({ 'authToken': token });
  } else if (!isAuthenticated) {
    chrome.storage.local.remove('authToken');
    authToken = null;
  }
  
  // Envoi du message de manière sécurisée
  try {
    chrome.runtime.sendMessage({ 
      action: 'authStatusChanged', 
      status: { isAuthenticated, hasToken: !!authToken } 
    }, () => {
      // Ignorer toute erreur (comme "Receiving end does not exist")
      if (chrome.runtime.lastError) {
        console.log('Message authStatusChanged non délivré (normal au démarrage)');
      }
    });
  } catch (error) {
    console.log('Erreur lors de l\'envoi du statut d\'authentification (normal au démarrage)');
  }
}

// Chargement initial de l'état d'authentification
export function loadAuthState() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['authToken'], (result) => {
      if (result.authToken) {
        authToken = result.authToken;
        isAuthenticated = true;
        console.log('Session authentifiée chargée depuis le stockage local');
      } else {
        isAuthenticated = false;
        authToken = null;
      }
      resolve({ isAuthenticated, hasToken: !!authToken });
    });
  });
}

// Méthodes d'interaction avec l'API pour l'authentification
export async function loginToServer(password) {
  const apiUrl = getApiUrl();
  
  try {
    // Tenter une connexion avec différentes approches - première tentative
    try {
      const response = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
        credentials: 'include'
      });
      
      // Si succès, on retourne le résultat
      if (response.ok) {
        const data = await response.json();
        // Mise à jour de l'état d'authentification
        setAuthenticated(true, data.token || 'server_auth_' + Date.now());
        return { 
          success: true, 
          token: authToken
        };
      }
      
      // Si échec mais réponse reçue, on tente d'extraire le message d'erreur
      try {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erreur d\'authentification');
      } catch (jsonError) {
        throw new Error(`Erreur ${response.status}: ${response.statusText}`);
      }
    } catch (networkError) {
      // On peut tenter une autre approche si la première échoue
      console.warn('Première tentative de connexion échouée, tentative alternative');
      
      // Mode développement/debug : si mot de passe spécial "debug", on simule une connexion réussie
      if (password === 'debug') {
        console.log('Mode debug activé, simulation de connexion réussie');
        const debugToken = 'debug_auth_' + Date.now();
        setAuthenticated(true, debugToken);
        return { success: true, token: debugToken };
      }
      
      // Sinon, on renvoie l'erreur
      throw networkError;
    }
  } catch (error) {
    console.error('Erreur globale de connexion:', error);
    setAuthenticated(false);
    return { success: false, error: error.message || 'Erreur de connexion au serveur' };
  }
}

export async function logoutFromServer() {
  const apiUrl = getApiUrl();
  
  // Simple appel au serveur pour la déconnexion
  try {
    const response = await fetch(`${apiUrl}/auth/logout`, {
      method: 'POST',
      credentials: 'include'
    });
    
    // Mise à jour de l'état d'authentification (qu'importe le résultat de la requête)
    setAuthenticated(false);
    
    return response.ok;
  } catch (error) {
    console.error('Erreur lors de la déconnexion du serveur:', error);
    // Mise à jour de l'état d'authentification malgré l'erreur
    setAuthenticated(false);
    throw error;
  }
}

export async function checkAuthWithServer() {
  const apiUrl = getApiUrl();
  
  try {
    const response = await fetch(`${apiUrl}/auth/check`, {
      method: 'GET',
      credentials: 'include'
    });
    
    if (response.ok) {
      const data = await response.json();
      // Mise à jour de l'état local si différent du serveur
      if (data.authenticated !== isAuthenticated) {
        setAuthenticated(data.authenticated, data.authenticated ? (authToken || 'server_validated_' + Date.now()) : null);
      }
      return data.authenticated;
    }
    
    // Si serveur répond mais pas OK, on considère non authentifié
    setAuthenticated(false);
    return false;
  } catch (error) {
    console.error('Erreur lors de la vérification avec le serveur:', error);
    // En cas d'erreur de connexion, on garde l'état local mais on le signale
    return { error: true, authenticated: isAuthenticated };
  }
}

// Fournit le token pour les requêtes API
export function getAuthHeaders() {
  return authToken ? { 'Authorization': `Bearer ${authToken}` } : {};
}
