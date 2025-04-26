// FCA-Agent - Module de communication API pour l'authentification

import { getApiUrl } from './config.js';
import { authLog } from './auth-logger.js';

/**
 * Effectue une requête d'authentification auprès du serveur
 * @param {string} password - Mot de passe utilisateur
 * @returns {Promise<Object>} - Résultat de l'authentification
 */
export async function loginRequest(password) {
  const apiUrl = getApiUrl();
  authLog(`Tentative de connexion à ${apiUrl}/auth/login`);
  
  try {
    const response = await fetch(`${apiUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
      credentials: 'omit'
    });
    
    authLog(`Réponse reçue du serveur: status=${response.status}`, 'debug');
    
    // Lecture du corps de la réponse
    let responseData;
    try {
      responseData = await response.json();
      authLog(`Corps de la réponse parsé: ${JSON.stringify(responseData)}`, 'debug');
    } catch (jsonError) {
      authLog(`Erreur lors du parsing de la réponse: ${jsonError.message}`, 'error');
      responseData = {};
    }
    
    // Si succès, retourner les données
    if (response.ok) {
      // Vérifier explicitement la présence du token
      if (!responseData.token) {
        authLog('ERREUR CRITIQUE: Authentification réussie mais aucun token dans la réponse!', 'error');
        return { 
          success: false, 
          error: 'Token manquant dans la réponse serveur' 
        };
      }
      
      const token = responseData.token;
      authLog(`Token reçu du serveur: ${token.substring(0, 4)}...${token.substring(token.length-4)}`);
      
      return { success: true, token };
    } else {
      // Échec d'authentification
      authLog(`Échec d'authentification: ${responseData.error || response.statusText}`, 'error');
      return { 
        success: false, 
        error: responseData.error || `Erreur ${response.status}: ${response.statusText}` 
      };
    }
  } catch (networkError) {
    // Erreur réseau
    authLog(`Erreur réseau: ${networkError.message}`, 'error');
    return { success: false, error: `Erreur de connexion: ${networkError.message}` };
  }
}

/**
 * Effectue une requête de déconnexion auprès du serveur
 * @param {Object} headers - En-têtes d'authentification
 * @returns {Promise<boolean>} - Résultat de la déconnexion
 */
export async function logoutRequest(headers) {
  const apiUrl = getApiUrl();
  authLog(`Tentative de déconnexion à ${apiUrl}/auth/logout`);
  
  try {
    const response = await fetch(`${apiUrl}/auth/logout`, {
      method: 'POST',
      headers,
      credentials: 'omit'
    });
    
    if (response.ok) {
      authLog('Déconnexion serveur réussie');
    } else {
      authLog(`Déconnexion serveur avec statut ${response.status}`, 'warn');
    }
    
    return true; // On considère toujours la déconnexion comme réussie côté client
  } catch (error) {
    authLog(`Erreur lors de la déconnexion du serveur: ${error.message}`, 'error');
    return true; // On considère quand même comme réussi en cas d'erreur réseau
  }
}

/**
 * Vérifie la validité de l'authentification auprès du serveur
 * @param {Object} headers - En-têtes d'authentification
 * @returns {Promise<boolean|Object>} - Résultat de la vérification
 */
export async function checkAuthRequest(headers) {
  const apiUrl = getApiUrl();
  authLog(`Vérification d'authentification avec le serveur: ${apiUrl}/auth/check`);
  authLog(`Headers utilisés: ${JSON.stringify(headers)}`, 'debug');
  
  // Vérifier la présence du header d'autorisation
  if (!headers.Authorization) {
    authLog('Impossible de vérifier l\'authentification: pas de token dans les headers', 'error');
    return false;
  }
  
  try {
    const response = await fetch(`${apiUrl}/auth/check`, {
      method: 'GET',
      credentials: 'omit',
      headers,
      cache: 'no-cache' // IMPORTANT: Ne pas utiliser le cache
    });
    
    authLog(`Réponse du serveur reçue: status=${response.status}`, 'debug');
    
    // Le serveur peut renvoyer 304 Not Modified si rien n'a changé
    if (response.status === 304) {
      authLog('Réponse 304 Not Modified - Aucun changement de statut');
      return { noChange: true };
    }
    
    // Lecture du corps de la réponse pour les autres codes
    if (response.ok) {
      let data;
      try {
        data = await response.json();
        authLog(`Corps de la réponse: ${JSON.stringify(data)}`, 'debug');
      } catch (jsonError) {
        authLog(`Erreur lors du parsing de la réponse: ${jsonError.message}`, 'error');
        return { error: true, message: jsonError.message };
      }
      
      authLog(`Résultat du serveur: authenticated=${data.authenticated}`);
      return data.authenticated;
    } else {
      let errorMsg = `Vérification échouée: statut ${response.status}`;
      try {
        const errorData = await response.json();
        errorMsg += ` - ${JSON.stringify(errorData)}`;
      } catch (e) {
        // Ignorer les erreurs de parsing
      }
      
      authLog(errorMsg, 'warn');
      
      // En cas d'erreur 401 (Unauthorized), c'est probablement un problème de token
      if (response.status === 401) {
        return { unauthorized: true };
      }
      
      return false;
    }
  } catch (error) {
    authLog(`Erreur lors de la vérification avec le serveur: ${error.message}`, 'error');
    return { error: true, message: error.message };
  }
}

/**
 * Gère le cas spécial du mode debug (pour tests locaux uniquement)
 * @returns {string} - Token de debug généré
 */
export function generateDebugToken() {
  authLog('Mode debug activé: simulation de connexion réussie', 'warn');
  return `debug_auth_${Date.now()}`;
}
